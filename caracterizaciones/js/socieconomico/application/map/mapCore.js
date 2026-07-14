import { destroyLayerSafe } from "./layers.js";

export function createMapCoreController({
    getMap,
    incrementRenderCycleId,
    getScaleHandle,
    setScaleHandle,
    getHighlightHandle,
    setHighlightHandle,
    setLastHoverWhere,
    setLegendFilterLabel,
    getLayersGlobal,
    setLayersGlobal,
    getLayerGlobal,
    setLayerGlobal,
    setChartLayerGlobal,
    // setLayerViewGlobal,
    getStationsLayer = () => null,
    setStationsLayer = () => {},
    setLayerViewGlobal
}) {
    function clearLayers() {
        const map = getMap();
        if (!map) return;

        incrementRenderCycleId();

        const scaleHandle = getScaleHandle();
        if (scaleHandle) {
            try { scaleHandle.remove(); } catch (e) {}
            setScaleHandle(null);
        }

        const highlightHandle = getHighlightHandle();
        if (highlightHandle) {
            try { highlightHandle.remove(); } catch (e) {}
            setHighlightHandle(null);
        }

        setLastHoverWhere("");
        setLegendFilterLabel(null);

        const layersGlobal = getLayersGlobal();
        if (layersGlobal.length) {
            layersGlobal.forEach(layer => {
                try { map.remove(layer); } catch (e) {}
                destroyLayerSafe(layer);
            });
            setLayersGlobal([]);
        }

        const layerGlobal = getLayerGlobal();
        if (layerGlobal) {
            try { map.remove(layerGlobal); } catch (e) {}
            destroyLayerSafe(layerGlobal);
        }

        setLayerGlobal(null);
        setChartLayerGlobal(null);
        setLayerViewGlobal(null);
        window.activeFeatureLayer = null;

        const stationsLayer = getStationsLayer();
        if (stationsLayer) {
            try { map.remove(stationsLayer); } catch (e) {}
            destroyLayerSafe(stationsLayer);
            setStationsLayer(null);
        }

        window.__lastLegendRenderKey = "";
        window.__legendState = {
            allCodes: [],
            activeCodes: new Set(),
            field: null,
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

    return { clearLayers };
}
