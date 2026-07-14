import { AppState } from "../app/state.js";

export function clearLayers() {
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

    // No destruir capas cacheadas de layer-loader — solo limpiar referencias
    if (AppState.layersGlobal.length) {
        AppState.layersGlobal = [];
    }

    AppState.layerGlobal = null;
    AppState.chartLayerGlobal = null;
    AppState.layerViewGlobal = null;

    window.__lastLegendRenderKey = "";
    window.__legendState = {
        allCodes: [],
        activeCodes: new Set(),
        field: null,
        layer: null,
        baseWhere: "1=1"
    };

    const fuenteDiv = document.getElementById("mapSource");
    if (fuenteDiv) {
        fuenteDiv.textContent = "";
    }
}