const FEATURE_PREFETCH_CHART_IDS = new Set([
    "hipsometria",
    "geoformas",
    "temperatura",
    "precipitacion",
    "cambio_temp",
    "cambio_precip",
    "climas",
    "riesgo_cc",
    "cuencas",
    "escorrentia",
    "ecosistemas",
    "deforestacion",
    "orden_suelo",
    "vocacion",
    "conflictos",
    "inundaciones",
    "remocion",
    "degradacion",
    "sismica"
]);

export function normalizeFeatureOutFields(outFields) {
    return Array.isArray(outFields)
        ? outFields.map(field => String(field)).sort().join(",")
        : String(outFields || "");
}

export function buildFeatureQuerySignature(layer, query = {}) {
    return JSON.stringify({
        url: String(layer?.url || ""),
        layerId: String(layer?.layerId ?? ""),
        where: String(query.where || layer?.definitionExpression || "1=1"),
        outFields: normalizeFeatureOutFields(query.outFields),
        returnGeometry: String(query.returnGeometry ?? "")
    });
}

export function createExtentQuery(where) {
    return { where: where || "1=1" };
}

export function shouldPrefetchChartFeatures(config) {
    if (!config?.id || !Array.isArray(config.outFields) || !config.outFields.length) return false;
    if (config.isPendientesPolar) return false;
    if (String(config.id).endsWith("_depto")) return false;
    return FEATURE_PREFETCH_CHART_IDS.has(config.id);
}

export function createChartPrefetchQuery(layer, config, where) {
    if (!layer || !shouldPrefetchChartFeatures(config)) return null;

    const query = layer.createQuery();
    query.where = where || "1=1";
    query.outFields = config.outFields;
    query.returnGeometry = false;
    return query;
}
