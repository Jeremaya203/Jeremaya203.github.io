export function createMapRenderContext(deps) {
    function incrementRenderCycle() {
        const nextCycle = Number(deps.getRenderCycleId?.() || 0) + 1;
        deps.setRenderCycleId(nextCycle);
        return nextCycle;
    }

    function replaceScaleHandle(handle) {
        const currentHandle = deps.getScaleHandle?.();
        if (currentHandle && currentHandle !== handle) {
            try {
                currentHandle.remove();
            } catch (_) {}
        }
        deps.setScaleHandle(handle || null);
    }

    return {
        FeatureLayer: deps.FeatureLayer,
        ImageryLayer: deps.ImageryLayer,
        Extent: deps.Extent,
        esriRequest: deps.esriRequest,
        map: deps.map,
        view: deps.view,
        getActiveLayerConfig: deps.getActiveLayerConfig,
        getRenderCycleId: deps.getRenderCycleId,
        incrementRenderCycle,
        clearLayers: deps.clearLayers,
        getWhereBase: deps.getWhereBase,
        getCurrentMode: deps.getCurrentMode,
        getFiltroNivel: deps.getFiltroNivel,
        getMunicipioActual: deps.getMunicipioActual,
        getDeptoActual: deps.getDeptoActual,
        getLayerGlobal: deps.getLayerGlobal,
        getLayersGlobal: deps.getLayersGlobal,
        getChartLayerGlobal: deps.getChartLayerGlobal,
        setLayerGlobal: deps.setLayerGlobal,
        setChartLayerGlobal: deps.setChartLayerGlobal,
        setLayerViewGlobal: deps.setLayerViewGlobal,
        setLayersGlobal: deps.setLayersGlobal,
        setStationsLayer: deps.setStationsLayer,
        replaceScaleHandle,
        buildDefinitionExpression: deps.buildDefinitionExpression,
        pickLayerByScale: deps.pickLayerByScale,
        getLandformsScaleTitle: deps.getLandformsScaleTitle,
        setLegendLayer: deps.setLegendLayer,
        setActiveVariantLayerByScale: deps.setActiveVariantLayerByScale,
        syncStateFromGlobals: deps.syncStateFromGlobals,
        debounce: deps.debounce,
        updateLegendByExtent: deps.updateLegendByExtent,
        buildLegendFromRenderer: deps.buildLegendFromRenderer,
        updateLegend: deps.updateLegend,
        updateSummary: deps.updateSummary,
        updateChart: deps.updateChart,
        updateSource: deps.updateSource,
        highlightClimateRiskMunicipality: deps.highlightClimateRiskMunicipality,
        ensureStationsLayer: deps.ensureStationsLayer,
        ensureLandformDictionary: deps.ensureLandformDictionary,
        ensureSoilOrderDictionary: deps.ensureSoilOrderDictionary,
        cachedQueryExtent: deps.cachedQueryExtent,
        cachedQueryFeatures: deps.cachedQueryFeatures,
        recordBiofisicoMetric: deps.recordBiofisicoMetric
    };
}
