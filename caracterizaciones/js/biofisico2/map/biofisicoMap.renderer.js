export { createMainMap } from "./map.core.js";
export { initMapControls } from "./map.controls.js";
export { initOverview } from "./overview.js";
export { initScaleBar } from "./scale.js";
export { zoomToLayerObjectId, resetToColombia } from "./zoom.js";
export { clearLayers } from "./layers.js";
export { buildWhereBase, buildDefinitionExpression, buildExtraWhere } from "./filters.js";
export { destroyLayerSafe, pickLayerByScale, getGeoformasScaleTitle } from "./map.helpers.js";
import { buildStationsPopupContent as renderStationsPopupContent } from "./mapPopup.renderer.js";

/**
 * Factory para crear la capa de estaciones meteorologicas.
 */
export function createStationsLayer({ FeatureLayer, STATIONS_LAYER_URL, buildPopupContent }) {
    let stationsLayer = null;

    function ensureStationsLayer() {
        if (stationsLayer) return stationsLayer;

        stationsLayer = new FeatureLayer({
            url: STATIONS_LAYER_URL,
            outFields: [
                "nombest","codest","mpnombre","mpcodigo","dpnombre","dpcodigo","fuente",
                "temene","temfeb","temmar","temabr","temmay","temjun","temjul","temago","temsep","temoct","temnov","temdic","temanual",
                "precene","precfeb","precmar","precabr","precmay","precjun","precjul","precago","precsep","precoct","precnov","precdic","precanual"
            ],
            popupEnabled: true,
            popupTemplate: {
                title: "{nombest}",
                content: buildPopupContent
            },
            minScale: 2500000,
            maxScale: 1
        });

        return stationsLayer;
    }

    return { ensureStationsLayer };
}

export function createBiofisicoStationsLayer({
    FeatureLayer,
    STATIONS_LAYER_URL,
    escapeHtml,
    getDiccionarioMunicipios,
    getDiccionarioDepartamentos
}) {
    return createStationsLayer({
        FeatureLayer,
        STATIONS_LAYER_URL,
        buildPopupContent: (event) => renderStationsPopupContent(event, {
            escapeHtml,
            diccionarioMunicipios: getDiccionarioMunicipios(),
            diccionarioDepartamentos: getDiccionarioDepartamentos()
        })
    });
}

export function applyWhereToLayers({ layers = [], layer = null, where }) {
    if (layers.length) {
        layers.forEach(currentLayer => {
            currentLayer.definitionExpression = where;
        });
        return;
    }

    if (layer) {
        layer.definitionExpression = where;
    }
}

