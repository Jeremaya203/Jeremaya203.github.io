export const SOCIOECONOMICO_SERVICE_ROOT = globalThis.__SOCIOECONOMICO_SERVICE_ROOT__
    || "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentesocioeconomico/MapServer";

export const SOCIOECONOMICO_FEATURE_SERVICE_ROOT = globalThis.__SOCIOECONOMICO_FEATURE_SERVICE_ROOT__
    || "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentesocioeconomico/FeatureServer";

export function socioeconomicoLayerUrl(layerId) {
    return `${String(SOCIOECONOMICO_SERVICE_ROOT).replace(/\/+$/, "")}/${layerId}`;
}

export function socioeconomicoFeatureLayerUrl(layerId) {
    return `${String(SOCIOECONOMICO_FEATURE_SERVICE_ROOT).replace(/\/+$/, "")}/${layerId}`;
}
