import { AppState } from "../app/state.js";

export function clearLayers({ preserveStationsLayer = false } = {}) {
    const map = AppState.map;

    if (!map) return;

    AppState.renderCycleId++;

    if (AppState.scaleHandle) {
        try { AppState.scaleHandle.remove(); } catch (e) {}
        AppState.scaleHandle = null;
    }

    if (AppState.highlightHandle) {
        try { AppState.highlightHandle.remove(); } catch (e) {}
        AppState.highlightHandle = null;
    }

    AppState.lastHoverWhere = "";
    AppState.legendFilterLabel = null;

    if (AppState.layersGlobal.length) {
        AppState.layersGlobal.forEach(l => {
            try { map.remove(l); } catch (e) {}
            try { l?.destroy?.(); } catch(e){}
        });
        AppState.layersGlobal = [];
    }

    if (AppState.chartLayerGlobal && AppState.chartLayerGlobal !== AppState.layerGlobal) {
        try { AppState.chartLayerGlobal?.destroy?.(); } catch(e){}
    }

    if (AppState.layerGlobal) {
        try { map.remove(AppState.layerGlobal); } catch (e) {}
        try { AppState.layerGlobal?.destroy?.(); } catch(e){}
    }

    AppState.layerGlobal = null;
    AppState.chartLayerGlobal = null;
    AppState.layerViewGlobal = null;
    window.activeFeatureLayer = null;

    if (AppState.stationsLayer && !preserveStationsLayer) {
        try { map.remove(AppState.stationsLayer); } catch (e) {}
        try { AppState.stationsLayer?.destroy?.(); } catch(e){}
        AppState.stationsLayer = null;
    }

    window.__lastLegendRenderKey = "";
    window.__legendState = {
        allCodes: [],
        activeCodes: new Set(),
        field: null,
        fields: [],
        layer: null,
        baseWhere: "1=1"
    };

    window.__geoformaSelectedPaisaje = null;
    window.__vocacionSelectedLabel = null;

    const fuenteDiv = document.getElementById("mapSource");
    if (fuenteDiv) {
        fuenteDiv.textContent = "";
    }
}
