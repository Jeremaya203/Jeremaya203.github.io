export function addBiofisicoLayerToMap(map, layer) {
    map.add(layer);
    window.activeFeatureLayer = layer;
    return layer;
}

export function setVisibleLayer(layers, activeLayer) {
    layers.forEach(layer => {
        layer.visible = layer === activeLayer;
    });
}

export async function clearLayerViewFilter(view, layer) {
    try {
        const layerView = await view.whenLayerView(layer);
        layerView.filter = null;
        return layerView;
    } catch (_) {
        return null;
    }
}

export async function zoomToLayerExtent({
    view,
    layer,
    where,
    cachedQueryExtent,
    createExtentQuery,
    expand = 1.2,
    beforeGoTo = null
}) {
    const result = await cachedQueryExtent(layer, createExtentQuery(where));
    if (typeof beforeGoTo === "function" && !beforeGoTo(result)) {
        return result;
    }
    if (result?.extent) {
        await view.goTo(result.extent.expand(expand));
    }
    return result;
}

export function renderFallbackLegend({ layer, buildLegendFromRenderer, actualizarLeyenda }) {
    const legendData = buildLegendFromRenderer(layer);
    if (legendData?.labels?.length) {
        actualizarLeyenda(legendData.labels, legendData.colors, legendData.codes);
    }
}

export function updateLayerLegend({ layer, config, updateLegendByExtent, buildLegendFromRenderer, actualizarLeyenda }) {
    if (typeof updateLegendByExtent === "function") {
        updateLegendByExtent(layer, config);
        return;
    }

    renderFallbackLegend({ layer, buildLegendFromRenderer, actualizarLeyenda });
}

export function createStationaryLegendWatcher({
    view,
    layer,
    getLayerGlobal,
    getActiveLayerConfig,
    updateLegendByExtent
}) {
    return view.watch("stationary", (isStationary) => {
        if (!isStationary) return;
        if (!getLayerGlobal() || getLayerGlobal() !== layer) return;

        const config = getActiveLayerConfig();
        if (config && typeof updateLegendByExtent === "function") {
            updateLegendByExtent(layer, config);
        }
    });
}
