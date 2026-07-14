import { measureBiofisicoAsync } from "./services/biofisicoPerformance.service.js";

const QUERY_CACHE_TTL_MS = 5 * 60 * 1000;
const QUERY_CACHE_MAX_ENTRIES = 200;
const ARC_REST_TIMEOUT_MS = 25000;
const queryCache = new Map();

function buildQueryCacheKey(layerUrl, params = {}) {
    const sortedParams = Object.keys(params)
        .sort()
        .map(key => [key, params[key]]);

    return JSON.stringify({
        layerUrl: String(layerUrl || "").replace(/\/+$/, ""),
        params: sortedParams
    });
}

function rememberQuery(key, promise) {
    if (queryCache.size >= QUERY_CACHE_MAX_ENTRIES) {
        const oldestKey = queryCache.keys().next().value;
        queryCache.delete(oldestKey);
    }

    queryCache.set(key, {
        expiresAt: Date.now() + QUERY_CACHE_TTL_MS,
        promise
    });
}

export function clearArcRestQueryCache() {
    queryCache.clear();
}

function fetchWithTimeout(url, timeoutMs = ARC_REST_TIMEOUT_MS) {
    if (typeof AbortController === "undefined") {
        return fetch(url);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    return fetch(url, { signal: controller.signal })
        .finally(() => clearTimeout(timeoutId));
}

export async function arcRestQuery(layerUrl, params){
    const cacheKey = buildQueryCacheKey(layerUrl, params);
    const cached = queryCache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
        return cached.promise;
    }

    if (cached) {
        queryCache.delete(cacheKey);
    }

    const url = new URL(layerUrl.replace(/\/+$/, "") + "/query");
    for (const [k,v] of Object.entries(params)) url.searchParams.set(k, v);

    const requestPromise = measureBiofisicoAsync(
        "arcRestQuery",
        () => fetchWithTimeout(url.toString())
            .then(async res => {
                if (!res.ok) throw new Error(`HTTP ${res.status} consultando ${layerUrl}`);
                const js = await res.json();
                if (js.error) throw new Error(js.error.message || "Error ArcGIS query");
                return js;
            }),
        {
            layerUrl: String(layerUrl || ""),
            where: String(params?.where || ""),
            fields: String(params?.outFields || params?.groupByFieldsForStatistics || "")
        }
    )
        .catch(error => {
            queryCache.delete(cacheKey);
            throw error;
        });

    rememberQuery(cacheKey, requestPromise);
    return requestPromise;
}

    // BF3: SUM(areat) y SUM(mparea) agrupado por paisaje
export async function fetchBF3Stats({ layerUrl, where, groupField, numField, denField }) {
    const outStatistics = [
        { statisticType: "sum", onStatisticField: numField, outStatisticFieldName: "sum_num" },
        { statisticType: "sum", onStatisticField: denField, outStatisticFieldName: "sum_den" }
    ];

    const js = await arcRestQuery(layerUrl, {
        f: "json",
        where: where || "1=1",
        groupByFieldsForStatistics: groupField,
        outStatistics: JSON.stringify(outStatistics),
        returnGeometry: "false"
    });

    const rows = (js.features || []).map(f => f.attributes || {});
    return rows;
}

export async function fetchGroupedStats({
    layerUrl,
    where = "1=1",
    groupField,
    sumField,
    outFieldName = "sum_area"
}) {
    const outStatistics = [{
        statisticType: "sum",
        onStatisticField: sumField,
        outStatisticFieldName: outFieldName
    }];

    const js = await arcRestQuery(layerUrl, {
        f: "json",
        where,
        groupByFieldsForStatistics: groupField,
        outStatistics: JSON.stringify(outStatistics),
        returnGeometry: "false"
    });

    return (js.features || []).map(f => f.attributes || {});
}
