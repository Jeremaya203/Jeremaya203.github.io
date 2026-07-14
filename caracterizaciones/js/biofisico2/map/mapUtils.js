export function getMapNow() {
    return globalThis.performance?.now ? globalThis.performance.now() : Date.now();
}

export function buildActiveLayerRenderKey({
    config,
    currentMode,
    currentSubLayerIndex,
    whereBase,
    filtroNivel,
    municipioActual,
    deptoActual
}) {
    const variantKeys = Array.isArray(config?.variants)
        ? config.variants.map(variant => variant.key || variant.url).join("|")
        : "";

    return [
        currentMode,
        currentSubLayerIndex,
        config?.id || "",
        config?.url || "",
        variantKeys,
        whereBase || "1=1",
        filtroNivel || "",
        municipioActual || "",
        deptoActual || ""
    ].join("::");
}

export function hasRenderableActiveLayer({ layerGlobal, layersGlobal }) {
    if (layerGlobal && !layerGlobal.destroyed) return true;
    return Array.isArray(layersGlobal) && layersGlobal.some(layer => layer && !layer.destroyed);
}

export function isStaleLayerRender({ currentCycle, renderCycleId, layerGlobal, expectedLayer }) {
    return currentCycle !== renderCycleId || layerGlobal !== expectedLayer || expectedLayer?.destroyed;
}

export function isLayerAlive(layer) {
    return Boolean(layer && !layer.destroyed);
}
