/**
 * BiofisicoContext - Fuente única de verdad para todo el estado de la aplicación.
 * 
 * Todas las propiedades son getters/setters que leen/escriben directamente
 * del objeto AppState compartido. Esto elimina la necesidad de sincronización
 * manual entre variables locales y el estado global.
 * 
 * Uso:
 *   Importar createBiofisicoContext desde el modulo de contexto de estado.
 *   const ctx = createBiofisicoContext();
 *   ctx.currentMode = "RELIEVE";
 *   console.log(ctx.currentMode); // "RELIEVE"
 */

import { AppState } from "../app/state.js";

// Lista completa de todas las propiedades de estado
// (debe coincidir con las claves de AppState y BIOFISICO_STATE_KEYS)
const STATE_PROPS = [
    // Módulo activo
    "currentMode",

    // ArcGIS
    "map",
    "view",
    "legendWidget",

    // Capas
    "layerGlobal",
    "layerViewGlobal",
    "layersGlobal",
    "chartLayerGlobal",
    "stationsLayer",

    // Filtros territoriales
    "whereBase",
    "municipioActual",
    "deptoActual",
    "filtroNivel",

    // Índices
    "currentSubLayerIndex",

    // Charts
    "chartInstance",
    "geoPieChartInstance",
    "geoDonutChartInstance",

    // Diccionarios
    "diccionarioMunicipios",
    "diccionarioDepartamentos",
    "todosMunicipios",
    "bf3LabelToCode",
    "geoformasRendererDict",
    "geoformasPaisajeDict",
    "vocacionRendererDict",
    "vocacionMainDict",
    "coloresOrdenSuelo",

    // Render/control
    "renderCycleId",
    "scaleHandle",
    "highlightHandle",
    "lastHoverWhere",
    "legendFilterLabel",

    // Sliders temporales
    "sliderMode",
    "timeSliderPeriods",
    "timeSliderIndex",
    "timeSliderEnabled",
    "timeSliderTouched",
    "timeSliderContextKey",
    "deforestacionPeriodoActivo",
    "deforestacionPeriodosBase",

    // Legend
    "updateLegendByExtent"
];

/**
 * Crea un objeto contexto donde cada propiedad del estado
 * es un getter/setter que lee/escribe de AppState.
 * 
 * Esto permite usar sintaxis natural:
 *   ctx.currentMode = "RELIEVE"
 * en vez de:
 *   AppState.currentMode = "RELIEVE"
 * 
 * Y elimina la necesidad de syncStateFromGlobals/readBiofisicoState.
 */
export function createBiofisicoContext() {
    const ctx = {};

    for (const prop of STATE_PROPS) {
        Object.defineProperty(ctx, prop, {
            get() {
                return AppState[prop];
            },
            set(value) {
                AppState[prop] = value;
            },
            enumerable: true,
            configurable: true
        });
    }

    // Métodos helper
    ctx.syncFromLocals = function (locals) {
        for (const key of STATE_PROPS) {
            if (Object.prototype.hasOwnProperty.call(locals, key)) {
                AppState[key] = locals[key];
            }
        }
    };

    ctx.readSnapshot = function (keys = STATE_PROPS) {
        const snapshot = {};
        for (const key of keys) {
            snapshot[key] = AppState[key];
        }
        return snapshot;
    };

    ctx.reset = function () {
        AppState.currentMode = AppState.currentMode || "RELIEVE";
        AppState.currentSubLayerIndex = Number(AppState.currentSubLayerIndex) || 0;
        AppState.filtroNivel = AppState.filtroNivel || "";
        AppState.whereBase = AppState.whereBase || "";
    };

    return ctx;
}

export { STATE_PROPS };
