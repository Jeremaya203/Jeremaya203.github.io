import {
    measureBiofisicoAsync,
    recordBiofisicoMetric
} from "./biofisicoPerformance.service.js";

const FEATURE_QUERY_CACHE_TTL_MS = 5 * 60 * 1000;
const FEATURE_QUERY_CACHE_MAX_ENTRIES = 250;

const featureQueryCache = new Map();
const extentQueryCache = new Map();

function pruneCache(cache) {
    while (cache.size > FEATURE_QUERY_CACHE_MAX_ENTRIES) {
        const oldestKey = cache.keys().next().value;
        cache.delete(oldestKey);
    }
}

function layerKey(layer) {
    return [
        String(layer?.url || ""),
        String(layer?.layerId ?? ""),
        String(layer?.id || "")
    ].join("|");
}

function geometryKey(geometry) {
    if (!geometry) return "";

    const sr = geometry.spatialReference?.wkid || geometry.spatialReference?.latestWkid || "";

    if (
        geometry.xmin !== undefined ||
        geometry.ymin !== undefined ||
        geometry.xmax !== undefined ||
        geometry.ymax !== undefined
    ) {
        return [
            geometry.xmin,
            geometry.ymin,
            geometry.xmax,
            geometry.ymax,
            sr
        ].map(value => String(value ?? "")).join(",");
    }

    if (geometry.x !== undefined || geometry.y !== undefined) {
        return [geometry.x, geometry.y, sr].map(value => String(value ?? "")).join(",");
    }

    return JSON.stringify({
        type: geometry.type || "",
        spatialReference: sr
    });
}

function normalizeOutFields(outFields) {
    if (!Array.isArray(outFields)) return String(outFields || "");
    return outFields.map(field => String(field)).sort().join(",");
}

function queryKey(layer, query = {}, type) {
    return JSON.stringify({
        type,
        layer: layerKey(layer),
        where: String(query.where || layer?.definitionExpression || "1=1"),
        outFields: normalizeOutFields(query.outFields),
        returnGeometry: String(query.returnGeometry ?? ""),
        geometry: geometryKey(query.geometry),
        spatialRelationship: String(query.spatialRelationship || ""),
        groupByFieldsForStatistics: String(query.groupByFieldsForStatistics || ""),
        outStatistics: JSON.stringify(query.outStatistics || ""),
        orderByFields: normalizeOutFields(query.orderByFields),
        num: String(query.num ?? ""),
        start: String(query.start ?? ""),
        returnDistinctValues: String(query.returnDistinctValues ?? "")
    });
}

function remember(cache, key, promise) {
    cache.set(key, {
        expiresAt: Date.now() + FEATURE_QUERY_CACHE_TTL_MS,
        promise
    });
    pruneCache(cache);
}

function read(cache, key) {
    const cached = cache.get(key);
    if (!cached) return null;

    if (cached.expiresAt <= Date.now()) {
        cache.delete(key);
        return null;
    }

    return cached.promise;
}

function cacheableFeatureQuery(query = {}) {
    return query.returnGeometry === false || query.returnGeometry === "false";
}

export async function cachedQueryFeatures(layer, query) {
    if (!layer || typeof layer.queryFeatures !== "function") {
        return layer?.queryFeatures?.(query);
    }

    if (!cacheableFeatureQuery(query)) {
        return layer.queryFeatures(query);
    }

    const key = queryKey(layer, query, "features");
    const cached = read(featureQueryCache, key);
    if (cached) {
        recordBiofisicoMetric("queryFeatures.cacheHit", 0, {
            layerUrl: String(layer?.url || ""),
            where: String(query?.where || "")
        });
        return cached;
    }

    const promise = measureBiofisicoAsync(
        "queryFeatures",
        () => layer.queryFeatures(query),
        {
            layerUrl: String(layer?.url || ""),
            where: String(query?.where || ""),
            outFields: normalizeOutFields(query?.outFields)
        }
    )
        .catch(error => {
            featureQueryCache.delete(key);
            throw error;
        });

    remember(featureQueryCache, key, promise);
    return promise;
}

export async function cachedQueryExtent(layer, query) {
    if (!layer || typeof layer.queryExtent !== "function") {
        return layer?.queryExtent?.(query);
    }

    const key = queryKey(layer, query, "extent");
    const cached = read(extentQueryCache, key);
    if (cached) {
        recordBiofisicoMetric("queryExtent.cacheHit", 0, {
            layerUrl: String(layer?.url || ""),
            where: String(query?.where || "")
        });
        return cached;
    }

    const promise = measureBiofisicoAsync(
        "queryExtent",
        () => layer.queryExtent(query),
        {
            layerUrl: String(layer?.url || ""),
            where: String(query?.where || "")
        }
    )
        .catch(error => {
            extentQueryCache.delete(key);
            throw error;
        });

    remember(extentQueryCache, key, promise);
    return promise;
}

export function clearBiofisicoArcgisCache() {
    featureQueryCache.clear();
    extentQueryCache.clear();
}
