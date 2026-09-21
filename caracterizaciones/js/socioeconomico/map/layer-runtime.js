export function pickLayerByScale({ layersGlobal = [], layerGlobal = null, view = null }) {
    if (!layersGlobal?.length) return layerGlobal;
    const scale = view?.scale;
    return layersGlobal.find(layer => {
        const min = Number(layer.minScale) || 0;
        const max = Number(layer.maxScale) || 0;
        if (!scale) return layer.visible;
        const insideMin = min === 0 || scale <= min;
        const insideMax = max === 0 || scale >= max;
        return layer.visible && insideMin && insideMax;
    }) || layerGlobal;
}

export function applyWhereToLayers({ where, whereBase = "", layersGlobal = [], layerGlobal = null }) {
    const expression = where || whereBase || "1=1";
    const targets = layersGlobal?.length ? layersGlobal : [layerGlobal].filter(Boolean);
    targets.forEach(layer => {
        if (!layer || layer.destroyed) return;
        layer.definitionExpression = expression;
    });
}
