import {
    buildWhereBase,
    buildDefinitionExpression,
    buildExtraWhere,
    createAttributeFilters
} from "./map/filters.js";
import {
    getLayerListForCurrentLevel as getLayerListForCurrentLevelFromState,
    getActiveLayerConfig as getActiveLayerConfigFromState
} from "./app/layer-state.js";

import { initOverview } from "./map/overview.js";
import { initScaleBar } from "./map/scale.js";
import { 
    initMapControls 
} from "./map/map.controls.js";
import {
    initModuleDropdown,
    initDropdownDescargables
} from "./ui/dropdowns.js";
import {
    bindMainButtonEvents,
    bindMasterSliderEvents,
    bindTerritorySelectEvents,
    bindViewAllButton,
    handleBiofisicoDropdownTarget,
    handleDepartamentoSelectChange,
    handleMunicipioSelectChange,
    handleNextSubLayer,
    handlePreviousSubLayer,
    handleRefreshBusqueda,
    handleSetBiofisicoMode,
    handleViewAllClick,
    initBiofisicoDropdownEvents,
    initExternalModuleNavigation
} from "./events/biofisico.events.js?v=component-nav-biofisico-20260623";
import {
    updateBiofisicoUrlByModule
} from "./events/biofisicoNavigation.events.js";
import {
    updateMapViewBadge,
    setLegendLayerTitle,
    clearLegend,
    setSummaryText,
    actualizarTituloGrafico as actualizarTituloGraficoRaw
} from "./ui/ui.helpers.js?v=titulos-departamentales-20260617";
import {
    renderBiofisicoControls,
    renderBiofisicoSubTabs
} from "./ui/biofisico.controls.js?v=axis-labels-final-20260617";
import {
    renderBiofisicoSummary
} from "./ui/biofisicoSummary.renderer.js?v=hipsometria-depto-panel-20260618";
import {
    getDepartamentoDisplayName,
    getMunicipioDisplayName
} from "./ui/biofisicoTerritory.renderer.js";
import {
    andWhere,
    escapeHtml,
    normalizeCode,
    safeCssColor,
    sqlEquals,
    sqlEqualsNumber,
    sqlLiteral,
    sqlStartsWith
} from "./utils/biofisicoFormat.utils.js";
import {
    buildCuencasDictFromRenderer,
    destroyLayerSafe,
    getDeptoCuencasGroupField,
    pickLayerByScale,
    getGeoformasScaleTitle,
    pickExistingField,
    pickVariantByScale
} from "./map/map.helpers.js";
import { createMapController } from "./map/mapController.js?v=geoformas-scale-sync-20260618";
import { createMapRenderContext } from "./map/mapRenderContext.js?v=riesgo-cc-yellow-outline-20260616";
import {
    readBiofisicoState,
    syncBiofisicoStateFromLocals
} from "./state/biofisico.state.js";
import { clearLayers as clearMapLayers } from "./map/layers.js";
import {
    zoomToLayerObjectId,
    resetToColombia
} from "./map/zoom.js";
import {
    zoomMapaGeoformasRenderer,
    zoomMapaOrdenSueloRenderer,
    zoomMapaVocacionRenderer
} from "./map/biofisicoZoom.renderer.js";
import {
    clearBiofisicoHighlight,
    createDebouncedBiofisicoHighlight,
    highlightBiofisicoWhere
} from "./map/biofisicoHighlight.renderer.js";
import { 
    createMainMap 
} from "./map/map.core.js";
import {
   LAYERS_CONFIG,
    DEPTO_ONLY_LAYER_IDS,
    DEPT_TO_MUNI_LAYER_ID,
    LEYENDA_RIESGO_CC,
    coloresCondicionEcos,
    condicionLabelToCode,
    coloresPendientes,
    pendientesLabelToCode
} from "./config.js?v=hipsometria-muni-height-20260619";

import {
    debounce,
    toNum,
    pctOfTotal,
    wrapLabel,
    escapeSqlString,
    ordenarMeses,
    normKey,
    ensureNonEmptyOrExit,
    buildDictFromUniqueValueRenderer
} from "./utils.js?v=orden-suelo-colors-20260616";
import {
    arcRestQuery,
    fetchBF3Stats,
    fetchGroupedStats
} from "./data.js";
import {
   buildLegendFromRenderer,
    buildPaisajeDictFromRenderer as buildPaisajeDictFromRendererRaw,
    getBiofisicoLegendOutFields,
    getSymbolColorRGBA,
    renderBiofisicoLegend,
    syncLegendToLabelSelection,
    sortLegendEntries,
    toggleBiofisicoLegend
} from "./map/biofisicoLegend.renderer.js?v=riesgo-cc-yellow-outline-20260616";
import { applyWhereToLayers, createBiofisicoStationsLayer } from "./map/biofisicoMap.renderer.js";
import { createChartController } from "./charts/chartController.js?v=hipsometria-muni-height-20260619";
import {
    destroyDualChartInstances,
    renderGeoformasDualCharts,
    renderVocacionDualCharts,
    toggleDualCharts
} from "./charts/chartRenderer.js?v=pie-guide-lines-direct-20260617";
import { getAxisTitles } from "./charts/chartOptions.js";
import { ORDEN_DEGRADACION, ORDEN_SISMICA } from "./charts/chartUtils.js";
import { crearGraficaBubbleOrdenSuelo as crearGraficaBubbleOrdenSueloRaw } from "./charts/soils/orden-suelo-bubble.chart.js?v=orden-suelo-muni-height-20260617";
import { createTimeSlider } from "./ui/time-slider.js";
import {
    fetchLayerSource,
    fetchMunicipalityDictionary,
    fetchMunicipalityInfo
} from "./services/biofisicoQuery.service.js";
import {
    cachedQueryExtent,
    cachedQueryFeatures
} from "./services/biofisicoArcgisCache.service.js";
import { clearBiofisicoRuntimeCaches } from "./services/biofisicoCache.service.js";
import {
    measureBiofisicoAsync,
    recordBiofisicoMetric
} from "./services/biofisicoPerformance.service.js";
import {
    coloresOrdenSuelo,
    ensureGeoformasDict,
    ensureOrdenSueloDict,
    ensureVocacionDict,
    findVocacionCodeByLabel,
    findVocacionUsoCodesByLabels,
    geoformasPaisajeDict,
    geoformasRendererDict,
    getGeoformaColor,
    getPaisajeColor,
    getVocacionColor,
    getVocacionUsoColor,
    vocacionMainDict,
    vocacionRendererDict
} from "./services/biofisicoLayer.service.js";
import {
    BIOFISICO_MODE_LABELS,
    STATIONS_LAYER_URL
} from "./config/biofisicoUi.config.js";

function updateURLByModule(module) {
    updateBiofisicoUrlByModule(module);
}
function applyInitialModuleFromURL() {
    const urlTab = globalThis.ModuleNavigation?.parseComponentUrlParams?.()?.tab;
    if (urlTab) return;

    currentMode = "RELIEVE";

    syncBiofisicoStateFromLocals({
        currentMode
    });

    updateMapViewBadge("Relieve");
}
let sliderMode = "zoom"; // "zoom" | "time"

function syncStateFromGlobals() {
    syncBiofisicoStateFromLocals({
        currentMode,
        map,
        view,
        legendWidget,
        layerGlobal,
        layerViewGlobal,
        layersGlobal,
        chartLayerGlobal,
        stationsLayer,
        whereBase,
        municipioActual,
        deptoActual,
        filtroNivel,
        currentSubLayerIndex,
        chartInstance,
        geoPieChartInstance,
        geoDonutChartInstance,
        diccionarioMunicipios,
        diccionarioDepartamentos,
        todosMunicipios,
        bf3LabelToCode,
        geoformasRendererDict,
        geoformasPaisajeDict,
        vocacionRendererDict,
        vocacionMainDict,
        coloresOrdenSuelo,
        renderCycleId,
        scaleHandle,
        highlightHandle,
        lastHoverWhere,
        legendFilterLabel,
        sliderMode,
        updateLegendByExtent
    });
}


function clearLayers() {
    syncStateFromGlobals();

    clearRiesgoCcMunicipioHighlight();
    clearMapLayers();

    const state = readBiofisicoState([
        "layerGlobal",
        "layerViewGlobal",
        "layersGlobal",
        "chartLayerGlobal",
        "stationsLayer",
        "scaleHandle",
        "highlightHandle",
        "renderCycleId",
        "lastHoverWhere",
        "legendFilterLabel"
    ]);

    layerGlobal = state.layerGlobal;
    layerViewGlobal = state.layerViewGlobal;
    layersGlobal = state.layersGlobal;
    chartLayerGlobal = state.chartLayerGlobal;
    stationsLayer = state.stationsLayer;

    scaleHandle = state.scaleHandle;
    highlightHandle = state.highlightHandle;
    renderCycleId = state.renderCycleId;
    lastHoverWhere = state.lastHoverWhere;
    legendFilterLabel = state.legendFilterLabel;

    syncStateFromGlobals();
}

function clearRiesgoCcMunicipioHighlight() {
    if (!riesgoCcMunicipioHighlightLayer) return;
    try {
        riesgoCcMunicipioHighlightLayer.removeAll();
        map?.remove(riesgoCcMunicipioHighlightLayer);
    } catch (_) {}
    riesgoCcMunicipioHighlightLayer = null;
}

async function highlightRiesgoCcMunicipio(layer) {
    clearRiesgoCcMunicipioHighlight();

    const config = getActiveLayerConfig();
    if (!config?.isClima || config?.climaType !== "riesgo_cc" || !municipioActual) return;
    if (!layer || layer.destroyed || !map || !view || !GraphicsLayerCtor || !GraphicCtor) return;

    try {
        const q = layer.createQuery();
        const municipioCode = String(municipioActual).trim();
        q.where = `mpcodigo = '${municipioCode.replace(/'/g, "''")}'`;
        q.outFields = ["mpcodigo"];
        q.returnGeometry = true;

        const res = await cachedQueryFeatures(layer, q);
        const geometry = res?.features?.[0]?.geometry;
        if (!geometry) return;

        riesgoCcMunicipioHighlightLayer = new GraphicsLayerCtor({
            id: "riesgo-cc-municipio-highlight",
            listMode: "hide"
        });
        map.add(riesgoCcMunicipioHighlightLayer);
        riesgoCcMunicipioHighlightLayer.add(new GraphicCtor({
            geometry,
            symbol: {
                type: "simple-fill",
                color: [255, 255, 0, 0],
                outline: {
                    color: [255, 255, 0, 1],
                    width: 3
                }
            }
        }));
    } catch (error) {
        console.warn("No se pudo resaltar municipio en Riesgo CC:", error);
    }
}
function ensureMunicipalLayerIndex(prevId) {
    const list = getLayerListForCurrentLevel(currentMode);

    if (!list || list.length === 0) {
        currentSubLayerIndex = 0;
        return;
    }

    if (currentSubLayerIndex < 0 || currentSubLayerIndex >= list.length) {
        currentSubLayerIndex = 0;
    }

    const mappedId = prevId ? DEPT_TO_MUNI_LAYER_ID[prevId] : null;

    if (mappedId) {
        const idx = list.findIndex(l => l.id === mappedId);
        if (idx !== -1) {
            currentSubLayerIndex = idx;
            return;
        }
    }



    // ProtecciÃ³n extra: evitar quedar en una capa departamental
    const cfg = list[currentSubLayerIndex];
    if (cfg && DEPTO_ONLY_LAYER_IDS.has(cfg.id)) {
        currentSubLayerIndex = 0;
    }
}

function getLayerListForCurrentLevel(mode = currentMode) {
    syncStateFromGlobals();
    syncBiofisicoStateFromLocals({ currentMode: mode });
    return getLayerListForCurrentLevelFromState(mode);
}

function normalizeDepartmentCode(value) {
    const code = normalizeCode(value);
    if (/^\d$/.test(code)) return code.padStart(2, "0");
    return code;
}

function normalizeMunicipalityCode(value) {
    const code = normalizeCode(value);
    if (/^\d{1,4}$/.test(code)) return code.padStart(5, "0");
    return code;
}

function clampSubLayerIndex() {
const activeList = getLayerListForCurrentLevel();
if (!activeList.length) {
    currentSubLayerIndex = 0;
    syncStateFromGlobals();
    return;
}
if (currentSubLayerIndex < 0) currentSubLayerIndex = 0;
if (currentSubLayerIndex >= activeList.length) currentSubLayerIndex = 0;
syncStateFromGlobals();
}

// Estado Global
let currentMode = 'RELIEVE'; // RELIEVE | CLIMA
let stationsLayer = null;

let currentSubLayerIndex = 0; // Ãndice dentro del array de configuration
let layerGlobal = null;
let layerViewGlobal = null;
let whereBase = "";
let municipioActual = "";
let chartInstance = null;
let diccionarioMunicipios = {};
let geoPieChartInstance = null;
let geoDonutChartInstance = null;
window.__geoformaSelectedPaisaje = null;
window.__geoformaPairColorMap = {};
window.__geoformaPaisajeColorMap = {};
let diccionarioDepartamentos = {};
let todosMunicipios = []; // Array de {codigo, nombre, depto}
const municipiosPorDepartamentoCache = new Map();
let layersGlobal = []; // para manejar mÃºltiples capas (cuencas)
let chartLayerGlobal = null;

let map = null;
let view = null;
let legendWidget = null;
let bf3LabelToCode = new Map();
let deptoActual = "";
let filtroNivel = ""; // "", "DEPTO", "MUNI"
let updateLegendByExtent = null;

// (opcional) para no crear watchers infinitos al cambiar escala en cuencas
let scaleHandle = null;
let renderCycleId = 0;
let mapRenderContext = null;
let highlightHandle = null;
let lastHoverWhere = "";
let riesgoCcMunicipioHighlightLayer = null;
let GraphicsLayerCtor = null;
let GraphicCtor = null;
let legendFilterLabel = null; // ej: "Seminatural"
let scheduledLayerLoadTimeout = null;
const hoverDebounceMs = 120;

const mapController = createMapController({
    getState: () => ({
        currentMode,
        currentSubLayerIndex,
        whereBase,
        filtroNivel,
        municipioActual,
        deptoActual,
        layerGlobal,
        layersGlobal
    })
});

window.__vocacionSelectedLabel = null;
window.__vocacionPairColorMap = {};
window.__vocacionMainColorMap = {};

window.__aa_active_filters = new Set();
window.__aa_all_items = [];
window.__aa_full_codes = [];
window.__aa_base_where = "1=1";
window.__legendState = {
    activeCodes: new Set(),
    field: null,
    layer: null,
    baseWhere: "1=1"
};

function toggleGeoformasCharts(show) {
    toggleDualCharts(show);
}

function destroyGeoformasCharts() {
    const refs = getDualChartRefs();
    destroyDualChartInstances(refs);
    commitDualChartRefs(refs);
}

function getDualChartRefs() {
    return {
        geoPieChartInstance,
        geoDonutChartInstance
    };
}

function commitDualChartRefs(refs) {
    geoPieChartInstance = refs.geoPieChartInstance;
    geoDonutChartInstance = refs.geoDonutChartInstance;
}

function getDualChartDeps() {
    return {
        findVocacionCodeByLabel,
        findVocacionUsoCodesByLabels,
        zoomMapaVocacion,
        zoomMapaGeoformas,
        getActiveLayerConfig,
        actualizarGrafica,
        setCategoryCodesActive,
        restoreAllChartCategories,
        getLayerGlobal: () => layerGlobal,
        getRenderCycleId: () => renderCycleId,
        getGeoformasRendererDict: () => geoformasRendererDict
    };
}

function crearGraficasVocacionDual(options) {
    const refs = getDualChartRefs();
    renderVocacionDualCharts(options, refs, getDualChartDeps());
    commitDualChartRefs(refs);
}

function crearGraficasGeoformasDual(options) {
    const refs = getDualChartRefs();
    renderGeoformasDualCharts(options, refs, getDualChartDeps());
    commitDualChartRefs(refs);
}

async function zoomMapaGeoformas(paisajeValue, relieveValue = null) {
    const layer = layerGlobal;

    if (!layer || !view) {
        console.warn("No hay layerGlobal o view disponible para geoformas");
        return;
    }

    const fmtVal = (v) => {
        const s = String(v ?? "").trim();
        if (!s) return null;

        const isNum = /^-?\d+(\.\d+)?$/.test(s);
        return isNum ? s : `'${s.replace(/'/g, "''")}'`;
    };

    const paisVal = fmtVal(paisajeValue);
    const relVal = fmtVal(relieveValue);

    if (!paisVal) {
        console.warn("No se recibiÃ³ paisaje para filtrar geoformas");
        return;
    }

    const isDetalleLayer = Number(layer.layerId) === 9;

    const wherePaisaje = whereBase
        ? `${whereBase} AND paisaje = ${paisVal}`
        : `paisaje = ${paisVal}`;

    const wherePaisajeRelieve = (isDetalleLayer && relVal)
        ? (whereBase
            ? `${whereBase} AND paisaje = ${paisVal} AND trelieve = ${relVal}`
            : `paisaje = ${paisVal} AND trelieve = ${relVal}`)
        : null;

    async function tryExtent(where) {
        try {
            const q = layer.createQuery();
            q.where = where;
            q.returnGeometry = false;

            const result = await cachedQueryExtent(layer, q);

            if (result?.extent) {
                await view.goTo(result.extent.expand(1.2), {
                    duration: 1200,
                    easing: "ease-in-out"
                });
                return true;
            }
            return false;
        } catch (err) {
            console.warn("FallÃ³ queryExtent geoformas con:", where, err);
            return false;
        }
    }

    if (wherePaisajeRelieve) {
        if (await tryExtent(wherePaisajeRelieve)) return;
    }

    if (await tryExtent(wherePaisaje)) return;

    const cfg = getActiveLayerConfig();
    if (cfg && typeof updateLegendByExtent === "function") {
        updateLegendByExtent(layer, cfg);
    }

    console.warn("No se pudo hacer zoom para geoformas");
}

async function zoomMapaVocacion(vocacionValue, usoValue = null) {
    const layer = layerGlobal;

    if (!layer || !view) {
        console.warn("No hay layerGlobal o view disponible para vocaciÃ³n");
        return;
    }

    const fmtVal = (v) => {
        const s = String(v ?? "").trim();
        if (!s) return null;

        const isNum = /^-?\d+(\.\d+)?$/.test(s);
        return isNum ? s : `'${s.replace(/'/g, "''")}'`;
    };

    const vocVal = fmtVal(vocacionValue);
    const usoVal = fmtVal(usoValue);

    if (!vocVal) {
        console.warn("No se recibiÃ³ vocaciÃ³n para filtrar");
        return;
    }

    const isDetalleLayer = Number(layer.layerId) === 30;

    const whereVocacion = whereBase
        ? `${whereBase} AND vocacion = ${vocVal}`
        : `vocacion = ${vocVal}`;

    const whereVocacionUso = (isDetalleLayer && usoVal)
        ? (whereBase
            ? `${whereBase} AND vocacion = ${vocVal} AND usopvoc = ${usoVal}`
            : `vocacion = ${vocVal} AND usopvoc = ${usoVal}`)
        : null;

    layer.definitionExpression = whereVocacionUso || whereVocacion;

    async function tryExtent(where) {
        try {
            const q = layer.createQuery();
            q.where = where;
            q.returnGeometry = false;

            const result = await cachedQueryExtent(layer, q);

            if (result?.extent) {
                await view.goTo(result.extent.expand(1.2), {
                    duration: 1200,
                    easing: "ease-in-out"
                });
                return true;
            }
            return false;
        } catch (err) {
            console.warn("FallÃ³ queryExtent vocaciÃ³n con:", where, err);
            return false;
        }
    }

    if (whereVocacionUso) {
        if (await tryExtent(whereVocacionUso)) return;
    }

    if (await tryExtent(whereVocacion)) return;

    const cfg = getActiveLayerConfig();
    if (cfg && typeof updateLegendByExtent === "function") {
        updateLegendByExtent(layer, cfg);
    }

    console.warn("No se pudo hacer zoom para vocaciÃ³n");
}


async function zoomMapaOrdenSuelo(ordenValue, fertilidadValue) {
    const layer = layerGlobal;

    if (!layer || !view) {
        console.warn("No hay layerGlobal o view disponible para zoom");
        return;
    }

    const isEmptyFert =
        fertilidadValue === null ||
        fertilidadValue === undefined ||
        String(fertilidadValue).trim() === "" ||
        String(fertilidadValue).trim().toLowerCase() === "no aplica" ||
        String(fertilidadValue).trim().toLowerCase() === "sin dato";

    const ordVal = sqlLiteral(ordenValue);
    const fertClause = sqlEquals("fertilidad", fertilidadValue);

    if (ordVal === null) {
        console.warn("No se recibiÃ³ orden de suelo vÃ¡lido para filtrar");
        return;
    }

    const whereSoloOrden = andWhere(whereBase, `ordsuelo = ${ordVal}`);
    const whereOrdenFert = andWhere(whereBase, `ordsuelo = ${ordVal} AND ${fertClause}`);

    const ordenCode = String(ordenValue ?? "").trim();
    if (ordenCode) {
        await setOnlyCategoryCodeActive(ordenCode, "chart");
    } else {
        layer.definitionExpression = whereSoloOrden;
    }

    async function tryExtent(where) {
        try {
            const q = layer.createQuery();
            q.where = where;

            const result = await cachedQueryExtent(layer, q);

            if (result?.extent) {
                await view.goTo(result.extent.expand(1.35), {
                    duration: 1200,
                    easing: "ease-in-out"
                });
                return true;
            }
            return false;
        } catch (err) {
            console.warn("FallÃ³ queryExtent con:", where, err);
            return false;
        }
    }

    // si fertilidad no sirve como filtro real, no la uses
    if (!isEmptyFert) {
        if (await tryExtent(whereOrdenFert)) return;
    }

    if (await tryExtent(whereSoloOrden)) return;

    console.warn("No se pudo hacer zoom con ningÃºn filtro");
}


function setActiveVariantLayerByScale() {
    if (!layersGlobal?.length || !view) return { changed: false, layer: null };

    const desired = pickLayerByScale(layersGlobal, view);
    if (!desired) return { changed: false, layer: null };

    // Cambiar visibilidad
    layersGlobal.forEach(l => (l.visible = (l === desired)));

    const changed = desired !== layerGlobal;
    layerGlobal = desired;
    syncStateFromGlobals();

    const config = getActiveLayerConfig();
    if (!config) return { changed, layer: desired };

    // 1) Actualizar legend widget a la capa visible
    const legendTitle = (config.id === "geoformas")
        ? getGeoformasScaleTitle(view.scale)
        : config.title;

    setLegendLayer(desired, legendTitle);

    // 2) AQUÃ MISMO va lo de cuencas (antes de actualizar grÃ¡fica)
    if (config.isHidro && config.hidroType === "cuencas" && desired.layerId === 20) {
        fetch(desired.url + "?f=pjson")
        .then(r => r.json())
        .then(json => {
            window.cuencasDict = buildCuencasDictFromRenderer(json);

            // si justo cambiÃ³ la capa, renderiza con el dict ya listo
            if (changed) {
            const chartL = chartLayerGlobal || desired;
            chartL.when(() => window.actualizarGrafica?.(chartL, config));
            }
        });

    
        return { changed, layer: desired };
    }

    // 3) TU LÃ“GICA NORMAL (para todas las demÃ¡s capas)
    if (changed) {
        const chartL = chartLayerGlobal || desired;
        chartL.when(() => window.actualizarGrafica?.(chartL, config));
    }

    // despuÃ©s de escoger active y setear visibles:
    if (layerGlobal) {
        if (![19, 20, 21].includes(Number(layerGlobal.layerId))) {
            layerGlobal.labelsVisible = false;
            layerGlobal.labelingInfo = [];
        }

        if (typeof updateLegendByExtent === "function") {
            updateLegendByExtent(layerGlobal, config);
        }
    }

    return { changed, layer: desired };
}


async function cargarDiccionarioMunicipios() {
    try {
        const { municipios, departamentos } = await fetchMunicipalityDictionary();
        diccionarioMunicipios = municipios;
        diccionarioDepartamentos = departamentos;
        syncStateFromGlobals();
    } catch (e) {
        console.error("Error cargando diccionario", e);
    }
}


// function getActiveLayerConfig() {
//     const list = getLayerListForCurrentLevel(currentMode);
//     return (list && list[currentSubLayerIndex]) ? list[currentSubLayerIndex] : null;
// }
function getActiveLayerConfig() {
    syncStateFromGlobals();
    return getActiveLayerConfigFromState();
}

function getCurrentModeLabel(mode = currentMode) {
    return BIOFISICO_MODE_LABELS[mode] || "Vista";
}

function setLegendLayer(layer, titleText) {
    setLegendLayerTitle(titleText);
}



function initAllDropdowns(controllerApi) {
    initBiofisicoDropdownEvents({
        initModuleDropdown,
        onBiofisicoTarget: handleBiofisicoDropdownTarget
    });
    initExternalModuleNavigation({ initModuleDropdown });
}


require([
    "esri/Map",
    "esri/views/MapView",
    "esri/layers/FeatureLayer",
    "esri/Basemap",
    "esri/layers/TileLayer",
    "esri/layers/VectorTileLayer",
    "esri/widgets/Legend",
    "esri/layers/GraphicsLayer",
    "esri/Graphic",
    "esri/geometry/Extent",
    "esri/widgets/Home",
    "esri/widgets/Locate",
    "esri/widgets/BasemapGallery",
    "esri/widgets/Expand",
    "esri/widgets/ScaleBar",
    "esri/request",

    ], function(EsriMap, MapView, FeatureLayer, Basemap, TileLayer, VectorTileLayer, Legend,
    GraphicsLayer, Graphic, Extent, Home, Locate, BasemapGallery, Expand,ScaleBar,esriRequest) {

    GraphicsLayerCtor = GraphicsLayer;
    GraphicCtor = Graphic;
    
    const mainMap = createMainMap({
        EsriMap,
        MapView,
        Basemap,
        TileLayer,
        VectorTileLayer
    });
    

    map = mainMap.map;
    view = mainMap.view;
    const igacSatelitalTopo = mainMap.basemap;

    syncStateFromGlobals();
    initAllDropdowns(createBiofisicoControllerApi());
    initDropdownDescargables();
    initMapControls({
        view,
        Home,
        Locate,
        BasemapGallery
    });
    initScaleBar({
        view,
        ScaleBar
    });
    let extentInicial = null;
    view.when(() => {

        extentInicial = view.map.initialViewProperties?.extent?.clone() || view.extent.clone();
        hideTimeSlider();

    });
    const zoomSlider = document.getElementById("zoomSlider");
    const timeSliderWrap = document.getElementById("timeSliderWrap");
    const timeSlider = document.getElementById("timeSlider");
    const timeSliderLabel = document.getElementById("timeSliderLabel");
    const masterSlider = zoomSlider;

    let timeSliderPeriods = [];
    let timeSliderIndex = 0;
    let timeSliderEnabled = false;
    let timeSliderTouched = false;
    let timeSliderContextKey = "";
    let deforestacionPeriodoActivo = "Todos";
    let deforestacionPeriodosBase = [];

    zoomSlider.value = view.zoom;

    const timeSliderApi = createTimeSlider({
        masterSlider,
        getView: () => view,
        getSliderMode: () => sliderMode,
        setSliderMode: (v) => { sliderMode = v; },
        getTimeSliderEnabled: () => timeSliderEnabled,
        setTimeSliderEnabled: (v) => { timeSliderEnabled = v; },
        getTimeSliderPeriods: () => timeSliderPeriods,
        setTimeSliderPeriods: (v) => { timeSliderPeriods = v; },
        getTimeSliderIndex: () => timeSliderIndex,
        setTimeSliderIndex: (v) => { timeSliderIndex = v; },
        getTimeSliderTouched: () => timeSliderTouched,
        setTimeSliderTouched: (v) => { timeSliderTouched = v; },
        getTimeSliderContextKey: () => timeSliderContextKey,
        setTimeSliderContextKey: (v) => { timeSliderContextKey = v; },
        getDeforestacionPeriodoActivo: () => deforestacionPeriodoActivo,
        setDeforestacionPeriodoActivo: (v) => { deforestacionPeriodoActivo = v; },
        getDeforestacionPeriodosBase: () => deforestacionPeriodosBase,
        setDeforestacionPeriodosBase: (v) => { deforestacionPeriodosBase = v; },
        getWhereBase: () => whereBase,
        getLayerGlobal: () => layerGlobal,
        getLayersGlobal: () => layersGlobal,
        getActiveLayerConfig,
        applyWhereToActiveLayers,
        buildExtraWhere,
        buildDefinitionExpression,
        actualizarGrafica: (layer, config, opts) => actualizarGrafica(layer, config, opts),
        refreshLegend: () => updateLegendByExtent?.(layerGlobal, getActiveLayerConfig()),
        resetLegendCategoryState: () => {
            window.__legendState = {
                allCodes: [],
                activeCodes: new Set(),
                field: null,
                fields: [],
                layer: null,
                baseWhere: whereBase || "1=1"
            };
        }
    });
    var { hideTimeSlider, showTimeSlider, getSelectedTimePeriod, handleTimeSliderInput } = timeSliderApi;
    window.hideTimeSlider = hideTimeSlider;

    function actualizarFuente(layer){
        fetchLayerSource(layer).then(fuente => {
            if (fuente) {
                const fuenteDiv = document.getElementById("mapSource");
                if (fuenteDiv) {
                    fuenteDiv.textContent = "Fuente: " + fuente;
                }
            }
        });
    }

    function renderSubTabs() {
        const list = getLayerListForCurrentLevel(currentMode) || [];

        renderBiofisicoSubTabs({
            list,
            currentSubLayerIndex,
            onSelectSubLayer(idx) {
                if (typeof hideTimeSlider === "function") {
                    hideTimeSlider();
                }
                timeSliderTouched = false;

                const selectedDepto = document.getElementById("departamentos")?.value;
                const selectedMunicipio = document.getElementById("municipios")?.value;
                const hasSelectedTerritory =
                    (!!selectedMunicipio && selectedMunicipio !== "0" && selectedMunicipio !== "COL") ||
                    (!!selectedDepto && selectedDepto !== "0" && selectedDepto !== "COL") ||
                    !!municipioActual ||
                    (filtroNivel === "DEPTO" && !!deptoActual);

                currentSubLayerIndex = idx;
                renderCycleId++;
                syncStateFromGlobals();

                if (hasSelectedTerritory) {
                    try {
                        prepareSectionLoadingState();
                    } catch (error) {
                        console.error("Error preparando cambio de secciÃ³n biofÃ­sica:", error);
                    }
                } else {
                    destroyChartInstance();
                    clearChartCanvasPixels();
                    clearLegend("Leyenda");
                    setSummaryText("Seleccione un departamento o municipio.");
                }

                if (hasSelectedTerritory) {
                    cargarCapaActual();
                }
            }
        });
    }

    bindMasterSliderEvents({
        masterSlider,
        view,
        getSliderMode: () => sliderMode,
        onTimeInput: handleTimeSliderInput
    });

    initOverview({
        EsriMap,
        MapView,
        Basemap,
        TileLayer,
        GraphicsLayer,
        Graphic,
        Extent,
        basemap: igacSatelitalTopo
    });
    const onViewStop = debounce(async () => {
        const config = getActiveLayerConfig();
        if (!config) return;
        const activeLayer = layerGlobal;
        if (!activeLayer) return;

        // guardia
        if (typeof updateLegendByExtent === "function") {
            await updateLegendByExtent(activeLayer, config);
        }
    }, 200);


    function updateNavbarActive(mode) {
        document.querySelectorAll("#navbar button").forEach(b => b.classList.remove("active"));

        const map = {
            RELIEVE: "btnRelieve",
            CLIMA: "btnClima",
            HIDROGRAFIA: "btnHidrografia",
            ECOSISTEMAS: "btnEcosistemas",
            SUELOS: "btnSuelos",
            FENOMENOS: "btnFenomenos"
        };

        const id = map[mode];
        if (id) document.getElementById(id)?.classList.add("active");

        syncDropdownBiofisico(mode);
    }
    

    function syncDropdownBiofisico(mode) {
        const items = document.querySelectorAll("#dropdownBiofisico .dropdown-item");
        if (!items.length) return;

        items.forEach(i => i.classList.remove("active"));

        const map = {
            RELIEVE: "itemRelieve",
            CLIMA: "itemClima",
            HIDROGRAFIA: "itemHidrografia",
            ECOSISTEMAS: "itemEcosistemas",
            SUELOS: "itemSuelos",
            FENOMENOS: "itemFenomenos"
        };

        const activeId = map[mode];
        if (activeId) {
            document.getElementById(activeId)?.classList.add("active");
        }
    }
    
    // InicializaciÃ³n (al final del bootstrap para asegurar handlers y DOM listos)

    function init() {
        bindMainButtonEvents({
            setMode,
            limpiarBusqueda,
            reiniciarConsultaActual,
            applyInitialModuleFromURL,
            cargarMunicipios,
            toggleLegend,
            updateNavbarActive,
            renderControls,
            getCurrentMode: () => currentMode
        });
        bindLegendClickOnce();
        bindMapCategoryClickOnce();
    }

    function limpiarBusqueda() {
        clearBiofisicoRuntimeCaches("limpiarBusqueda");
        hideTimeSlider();
        timeSliderTouched = false;

        // Reset selects
        const selectDepto = document.getElementById("departamentos");
        const selectMuni = document.getElementById("municipios");

        if (selectDepto) selectDepto.value = "0";
        if (selectMuni) {
            selectMuni.innerHTML = `<option value="">Seleccione un municipio</option>`;
            renderizarMunicipios();
            selectMuni.value = "";
        }

        // Reset estado global
        municipioActual = "";
        deptoActual = "";
        filtroNivel = "";
        whereBase = "";
        municipioInfo = null;
        layerViewGlobal = null;
        chartLayerGlobal = null;
        lastHoverWhere = "";
        legendFilterLabel = null;

        syncStateFromGlobals();


        // Limpiar capas y filtros del mapa
        clearLayers();

        // Limpiar highlights
        if (highlightHandle) {
            try { highlightHandle.remove(); } catch (e) {}
            highlightHandle = null;
        }

        // Limpiar grÃ¡fica
        destroyChartInstance();

        // Limpiar leyenda
        const legendTitle = document.getElementById("legendTitle");
        const legendContent = document.getElementById("legendContent");
        if (legendTitle) legendTitle.textContent = "Leyenda";
        if (legendContent) {
            legendContent.innerHTML = `<p style="margin:0; color:#666;">Seleccione un departamento o municipio</p>`;
            legendContent.classList.remove("collapsed");
        }

        // Reiniciar estado visual de leyenda
        window.__legendState = {
            allCodes: [],
            activeCodes: new Set(),
            field: null,
            fields: [],
            layer: null
        };

        // Reset subtipo actual al primero del modo activo
        currentSubLayerIndex = 0;
        clampSubLayerIndex();
        renderControls();

        updateMapViewBadge(getCurrentModeLabel(currentMode));

        // Limpiar resumen
        actualizarResumen();

        // Cerrar popup si existe
        if (view?.popup) {
            view.popup.close();
        }

        // Volver a vista inicial
        if (extentInicial) {
            view.goTo(extentInicial, { duration: 900, easing: "ease-in-out" });
        } else {
            view.goTo(
                { center: [-74.3, 4.6], zoom: 6 },
                { duration: 900, easing: "ease-in-out" }
            );
        }
    }

    function setMode(mode) {
        if (typeof hideTimeSlider === "function") {
            hideTimeSlider();
        }

        timeSliderTouched = false;
        const hasSelectedTerritory = municipioActual || (filtroNivel === "DEPTO" && deptoActual);
        updateURLByModule("BIOFISICO");
        currentMode = mode;
        currentSubLayerIndex = 0;
        renderCycleId++;

        syncStateFromGlobals();
        updateNavbarActive(mode);
        clampSubLayerIndex();
        renderSubTabs();
        updateMapViewBadge(getCurrentModeLabel(mode));

        if (hasSelectedTerritory) {
            try {
                prepareSectionLoadingState();
            } catch (error) {
                console.error("Error preparando cambio de categorÃ­a biofÃ­sica:", error);
            }
            cargarCapaActual();
        } else {
            clearLayers();
            destroyChartInstance();
            clearLegend("Leyenda");
            actualizarResumen();
            actualizarTituloGrafico(getActiveLayerConfig(), null, null);
        }
    }

    function renderControls() {
        clampSubLayerIndex();

        renderBiofisicoControls({
            renderSubTabs
        });
    }
    window.renderControls = renderControls;

    function prevLayer() {
        hideTimeSlider();
        timeSliderTouched = false;

        const list = getLayerListForCurrentLevel(currentMode);
        if (!list || list.length === 0) return;

        const hasSelectedTerritory = municipioActual || (filtroNivel === "DEPTO" && deptoActual);

        const total = list.length;
        currentSubLayerIndex = (currentSubLayerIndex - 1 + total) % total;
        syncStateFromGlobals();
        renderControls();

        if (hasSelectedTerritory) {
            prepareSectionLoadingState();
        }

        if (hasSelectedTerritory) {
            cargarCapaActual();
        }
    }

    function nextLayer() {
        hideTimeSlider();
        timeSliderTouched = false;

        const list = getLayerListForCurrentLevel(currentMode);
        if (!list || list.length === 0) return;

        const hasSelectedTerritory = municipioActual || (filtroNivel === "DEPTO" && deptoActual);

        const total = list.length;
        currentSubLayerIndex = (currentSubLayerIndex + 1) % total;
        syncStateFromGlobals();
        renderControls();

        if (hasSelectedTerritory) {
            prepareSectionLoadingState();
        }

        if (hasSelectedTerritory) {
            cargarCapaActual();
        }
    }

    let municipioInfo = null;


    async function cargarInfoMunicipio(codigo) {
        hideTimeSlider();
        timeSliderTouched = false;                
        try {
            municipioInfo = await fetchMunicipalityInfo(codigo, { sqlEquals });
            actualizarResumen();
        } catch (e) {
            console.error("Error cargando info municipio", e);
            municipioInfo = null;
            actualizarResumen();
        }
    }


    function actualizarResumen() {
        const config = getActiveLayerConfig();
        renderBiofisicoSummary({
            filtroNivel,
            municipioActual,
            config,
            municipioInfo
        });

        if (config?.id === "geoformas") {
            const selectedDept = String(document.getElementById("departamentos")?.value || deptoActual || "").trim();
            const selectedMuni = String(document.getElementById("municipios")?.value || "").trim();
            if (selectedDept && selectedDept !== "0" && selectedDept !== "COL" && !selectedMuni) {
                const deptName = diccionarioDepartamentos?.[selectedDept] || diccionarioDepartamentos?.[deptoActual] || selectedDept;
                const title = document.getElementById("chartTitle");
                if (title) title.textContent = `DistribuciÃ³n de Geoformas en ${deptName}`;
            }
        }
    }


    function toggleLegend() {
        toggleBiofisicoLegend();
    }

    function actualizarLeyenda(labels, colors, codes = null) {
        try {
            const config = getActiveLayerConfig();
            const activeButtonText = String(
                Array.from(document.querySelectorAll(".subtab-btn.active"))
                    .map(button => button.textContent || "")
                    .join(" ")
            ).trim();
            if (
                activeButtonText &&
                config?.title &&
                !activeButtonText.toLowerCase().includes(String(config.title).toLowerCase().trim()) &&
                !String(config.title).toLowerCase().includes(activeButtonText.toLowerCase())
            ) {
                return;
            }
            renderBiofisicoLegend({
                labels,
                colors,
                codes,
                config,
                layer: window.activeFeatureLayer || layerGlobal,
                ordenDegradacion: ORDEN_DEGRADACION,
                ordenSismica: ORDEN_SISMICA
            });
            bindLegendClickOnce();
            applyChartCategoryFilterFromLegend();
            window.__biofisicoApplyGeoformasChartFilter?.(window.__legendState?.activeCodes);
            window.__biofisicoApplyOrdenSueloChartFilter?.(window.__legendState?.activeCodes);
        } catch (e) {
            console.error("actualizarLeyenda error:", e);
        }
    }

    
    const stationsFactory = createBiofisicoStationsLayer({
        FeatureLayer,
        STATIONS_LAYER_URL,
        escapeHtml,
        getDiccionarioMunicipios: () => diccionarioMunicipios,
        getDiccionarioDepartamentos: () => diccionarioDepartamentos
    });
    var { ensureStationsLayer } = stationsFactory;

    function bindLegendClickOnce() {
        const content = document.getElementById("legendContent");
        if (!content || content.__legendBound) return;

        content.__legendBound = true;

        content.addEventListener("click", async (e) => {
            const item = e.target.closest(".legend-item");
            if (!item) return;

            const code = String(item.dataset.code ?? "").trim();
            if (!code) return;

            const st = window.__legendState;
            if (!st) return;

            if (!(st.activeCodes instanceof Set)) {
                st.activeCodes = new Set((st.allCodes || []).map(v => String(v)));
            }

            if (st.activeCodes.has(code)) {
                st.activeCodes.delete(code);
                item.classList.add("off");
                item.classList.remove("active");
                item.setAttribute("aria-pressed", "false");
            } else {
                st.activeCodes.add(code);
                item.classList.remove("off");
                item.classList.add("active");
                item.setAttribute("aria-pressed", "true");
            }

            await applyLegendFilter();
            applyChartCategoryFilterFromLegend();
            window.__biofisicoApplyGeoformasChartFilter?.(st.activeCodes);
            window.__biofisicoApplyOrdenSueloChartFilter?.(st.activeCodes);

            content.dataset.legendFilterSource = "legend";
            delete content.dataset.legendSelectedCode;
            const chartCanvas = document.getElementById("chart");
            if (chartCanvas) {
                chartCanvas.dataset.biofisicoChartSyncSource = "legend";
                delete chartCanvas.dataset.biofisicoChartSelectedCode;
            }
        });
    }

    function getLegendTargetLayers() {
        const active = window.activeFeatureLayer || layerGlobal || null;

        if (active && !active.destroyed) {
            return [active];
        }

        return [];
    }

    function resetLegendVisualState() {
        const st = window.__legendState;
        const content = document.getElementById("legendContent");
        if (!st || !content) return;

        content.querySelectorAll(".legend-item").forEach(node => {
            const code = String(node.dataset.code ?? "").trim();
            const isActive = st.activeCodes.has(code);
            node.classList.toggle("off", !isActive);
            node.classList.toggle("active", isActive);
            node.setAttribute("aria-pressed", isActive ? "true" : "false");
        });
    }

    function normalizeCategoryText(value) {
        return String(Array.isArray(value) ? value.join(" ") : value ?? "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();
    }

    function getLegendCodeByLabel(label, index = -1) {
        const text = normalizeCategoryText(label);
        const items = Array.from(document.querySelectorAll("#legendContent .legend-item"));
        const byText = items.find(item =>
            normalizeCategoryText(item.querySelector(".legend-label")?.textContent || item.textContent) === text
        );

        if (byText?.dataset?.code) return String(byText.dataset.code).trim();

        const st = window.__legendState;
        if (Array.isArray(st?.allCodes) && index >= 0 && st.allCodes[index] != null) {
            return String(st.allCodes[index]).trim();
        }

        return String(label ?? "").trim();
    }

    function ensureChartCategoryState() {
        if (!chartInstance) return null;

        const state = chartInstance.__biofisicoCategoryState;
        if (!state) return null;

        const st = window.__legendState;
        if (!st || !(st.activeCodes instanceof Set) || !Array.isArray(st.allCodes) || !st.allCodes.length) return state;

        const legendCodes = Array.isArray(st.allCodes)
            ? st.allCodes.map(value => String(value ?? "").trim()).filter(Boolean)
            : [];
        const hasLegendCodes = legendCodes.length > 0;
        const chartCodesMatchLegend = state.codes.some(code => legendCodes.includes(String(code ?? "").trim()));

        if (hasLegendCodes && (!state.codes.length || !chartCodesMatchLegend)) {
            state.codes = state.labels.map((label, index) => getLegendCodeByLabel(label, index));
        }

        return state;
    }

    function applyChartCategoryFilterFromLegend() {
        const state = ensureChartCategoryState();
        const st = window.__legendState;
        if (
            !chartInstance ||
            !state ||
            !st ||
            !(st.activeCodes instanceof Set) ||
            !Array.isArray(st.allCodes) ||
            !st.allCodes.length
        ) return;

        const canvas = chartInstance.canvas || document.getElementById("chart");
        const activeCodesText = Array.from(st.activeCodes).map(value => String(value ?? "").trim()).join(",");
        if (canvas) {
            canvas.dataset.biofisicoChartSyncStatus = "applying";
            canvas.dataset.biofisicoChartActiveCodes = activeCodesText;
            canvas.dataset.biofisicoChartTotalCount = String(st.allCodes.length);
            canvas.dataset.biofisicoChartActiveCount = String(st.activeCodes.size);
        }

        if (state.isStacked) {
            chartInstance.data.datasets.forEach((dataset) => {
                const code = String(dataset.__biofisicoCode ?? dataset.gradeCode ?? dataset.rangeCode ?? dataset.code ?? dataset.label ?? "").trim();
                dataset.hidden = code ? !st.activeCodes.has(code) : false;
            });
            chartInstance.update("none");
            if (canvas) {
                canvas.dataset.biofisicoChartSyncStatus = "applied";
            }
            return;
        }

        const dataset = chartInstance.data.datasets?.[0];
        if (!dataset || !Array.isArray(state.fullData)) return;

        dataset.data = state.fullData.map((value, index) => {
            const code = String(state.codes[index] ?? "").trim();
            return code && st.activeCodes.has(code) ? value : null;
        });

        if (Array.isArray(state.fullColors)) {
            dataset.backgroundColor = state.fullColors;
        }

        chartInstance.update("none");
        if (canvas) {
            canvas.dataset.biofisicoChartSyncStatus = "applied";
        }
    }

    async function setOnlyChartCategoryActive(label, index = -1, dataset = null) {
        const st = window.__legendState;
        if (!st || !Array.isArray(st.allCodes) || !st.allCodes.length) return false;

        const code = String(
            dataset?.__biofisicoCode ??
            dataset?.gradeCode ??
            dataset?.rangeCode ??
            dataset?.code ??
            getLegendCodeByLabel(label, index)
        ).trim();

        if (!code) return false;
        if (!st.allCodes.map(value => String(value ?? "").trim()).includes(code)) return false;

        return setOnlyCategoryCodeActive(code, "chart");
    }

    async function setCategoryCodesActive(codes, source = "unknown") {
        const st = window.__legendState;
        const requestedCodes = (Array.isArray(codes) ? codes : [codes])
            .map(code => String(code ?? "").trim())
            .filter(Boolean);

        if (!st || !Array.isArray(st.allCodes) || !st.allCodes.length || !requestedCodes.length) return false;

        const allCodes = st.allCodes.map(value => String(value ?? "").trim()).filter(Boolean);
        const activeCodes = requestedCodes.filter(code => allCodes.includes(code));
        if (!activeCodes.length) return false;

        const legendContent = document.getElementById("legendContent");
        const chartCanvas = document.getElementById("chart");

        st.activeCodes = new Set(activeCodes);
        resetLegendVisualState();
        await applyLegendFilter();
        applyChartCategoryFilterFromLegend();
        window.__biofisicoApplyGeoformasChartFilter?.(st.activeCodes);
        window.__biofisicoApplyOrdenSueloChartFilter?.(st.activeCodes);

        if (legendContent) {
            legendContent.dataset.legendFilterSource = source;
            legendContent.dataset.legendSelectedCode = activeCodes.join(",");
        }

        if (chartCanvas) {
            chartCanvas.dataset.biofisicoChartSyncSource = source;
            chartCanvas.dataset.biofisicoChartSelectedCode = activeCodes.join(",");
        }

        return true;
    }

    async function setOnlyCategoryCodeActive(code, source = "unknown") {
        return setCategoryCodesActive([code], source);
    }

    async function restoreAllChartCategories() {
        const st = window.__legendState;
        if (!st || !Array.isArray(st.allCodes) || !st.allCodes.length) return false;

        st.activeCodes = new Set(st.allCodes.map(value => String(value ?? "").trim()).filter(Boolean));
        resetLegendVisualState();
        await applyLegendFilter();
        applyChartCategoryFilterFromLegend();
        window.__biofisicoApplyGeoformasChartFilter?.(st.activeCodes);
        window.__biofisicoApplyOrdenSueloChartFilter?.(st.activeCodes);

        const legendContent = document.getElementById("legendContent");
        const chartCanvas = document.getElementById("chart");

        if (legendContent) {
            legendContent.dataset.legendFilterSource = "restore";
            delete legendContent.dataset.legendSelectedCode;
        }

        if (chartCanvas) {
            chartCanvas.dataset.biofisicoChartSyncSource = "restore";
            delete chartCanvas.dataset.biofisicoChartSelectedCode;
        }

        return true;
    }

    function readGraphicAttribute(attributes, field) {
        if (!attributes || !field) return "";

        if (Object.prototype.hasOwnProperty.call(attributes, field)) {
            return attributes[field];
        }

        const expected = String(field).toLowerCase();
        const key = Object.keys(attributes).find(name => String(name).toLowerCase() === expected);
        return key ? attributes[key] : "";
    }

    function getLegendCodeFromMapGraphic(graphic) {
        const st = window.__legendState;
        if (!st || !Array.isArray(st.allCodes) || !st.allCodes.length) return "";

        const attributes = graphic?.attributes || {};
        const fields = Array.isArray(st.fields) && st.fields.length
            ? st.fields
            : (st.field ? [st.field] : []);

        if (!fields.length) return "";

        const delimiter = (st.allCodes || []).some(value => String(value ?? "").includes(";")) ? ";" : ",";
        const code = fields
            .map(field => String(readGraphicAttribute(attributes, field) ?? "").trim())
            .join(delimiter);

        if (!code || code.split(",").some(part => !part)) return "";

        const allCodes = st.allCodes.map(value => String(value ?? "").trim());
        return allCodes.includes(code) ? code : "";
    }

    async function syncMapGraphicCategory(graphic) {
        const code = getLegendCodeFromMapGraphic(graphic);
        if (!code) return false;

        return setOnlyCategoryCodeActive(code, "map");
    }

    function bindMapCategoryClickOnce() {
        if (!view || view.__biofisicoCategoryClickBound) return;

        view.__biofisicoCategoryClickBound = true;
        view.on("click", async (event) => {
            const targets = getLegendTargetLayers().filter(layer => layer && !layer.destroyed);
            if (!targets.length) return;

            const st = window.__legendState;
            if (!st || !Array.isArray(st.allCodes) || !st.allCodes.length) return;

            try {
                const hit = await view.hitTest(event, { include: targets });
                const result = (hit?.results || []).find(item =>
                    item?.graphic?.layer && targets.includes(item.graphic.layer)
                );

                if (!result?.graphic) return;

                await syncMapGraphicCategory(result.graphic);
            } catch (error) {
                const message = String(error?.message || "").toLowerCase();
                if (message.includes("cancel") || message.includes("aborted")) return;
                console.warn("No se pudo sincronizar clic de mapa con leyenda/grafico:", error);
            }
        });
    }

    function bindChartRestoreDoubleClick(chart) {
        const canvas = chart?.canvas || document.getElementById("chart");
        if (!canvas) return;

        if (canvas.__biofisicoRestoreDblClickHandler) {
            canvas.removeEventListener("dblclick", canvas.__biofisicoRestoreDblClickHandler);
        }

        const handler = async (event) => {
            const active = typeof chart.getElementsAtEventForMode === "function"
                ? chart.getElementsAtEventForMode(event, "nearest", { intersect: true }, false)
                : [];

            if (active?.length) return;

            if (typeof chart.resetZoom === "function") {
                try { chart.resetZoom(); } catch (_) {}
            }

            await restoreAllChartCategories();
        };

        canvas.__biofisicoRestoreDblClickHandler = handler;
        canvas.addEventListener("dblclick", handler);
    }

    function clearGeoformasInternalLegends() {
        const container = document.getElementById("geoformasChartLegend");
        if (container) container.remove();
    }

    function getGeoformasLegendContainer() {
        const canvas = document.getElementById("chart");
        if (!canvas) return null;

        let container = document.getElementById("geoformasChartLegend");
        if (!container) {
            container = document.createElement("div");
            container.id = "geoformasChartLegend";
            canvas.insertAdjacentElement("afterend", container);
        }

        return container;
    }

    function getGeoformasSegmentActiveCodes(segment, ring) {
        const st = window.__legendState;
        const allCodes = new Set((st?.allCodes || []).map(code => String(code ?? "").trim()).filter(Boolean));
        const segmentCode = String(segment?.code ?? "").trim();
        const legendCode = String(segment?.legendCode ?? "").trim();
        const paisajeCode = String(segment?.paisajeCode ?? segmentCode).trim();
        const childCodes = (segment?.childCodes || []).map(code => String(code ?? "").trim()).filter(Boolean);

        if (ring === "paisaje") {
            if (legendCode && allCodes.has(legendCode)) return [legendCode];
            if (allCodes.has(segmentCode)) return [segmentCode];
            return childCodes.filter(code => allCodes.has(code));
        }

        if (legendCode && allCodes.has(legendCode)) return [legendCode];
        if (allCodes.has(segmentCode)) return [segmentCode];
        if (paisajeCode && allCodes.has(paisajeCode)) return [paisajeCode];
        return segmentCode ? [segmentCode] : [];
    }

    function isGeoformasSegmentActive(segment, ring, activeCodes) {
        if (!(activeCodes instanceof Set)) return true;

        const segmentCode = String(segment?.code ?? "").trim();
        const legendCode = String(segment?.legendCode ?? "").trim();
        const paisajeCode = String(segment?.paisajeCode ?? segmentCode).trim();
        const childCodes = (segment?.childCodes || []).map(code => String(code ?? "").trim()).filter(Boolean);

        if (ring === "paisaje") {
            return (legendCode && activeCodes.has(legendCode)) ||
                activeCodes.has(segmentCode) ||
                childCodes.some(code => activeCodes.has(code));
        }

        return (legendCode && activeCodes.has(legendCode)) ||
            activeCodes.has(segmentCode) ||
            activeCodes.has(paisajeCode);
    }

    function createGeoformasLegendItem({ segment, ring, color, active }) {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "geoformas-chart-legend-item";
        item.style.display = "inline-flex";
        item.style.alignItems = "center";
        item.style.gap = "6px";
        item.style.maxWidth = "100%";
        item.style.border = "0";
        item.style.background = "transparent";
        item.style.padding = "2px 4px";
        item.style.cursor = "pointer";
        item.style.font = "inherit";
        item.style.fontSize = "9.5px";
        item.style.lineHeight = "1.2";
        item.style.opacity = active ? "1" : "0.42";
        item.style.textDecoration = active ? "none" : "line-through";
        item.style.justifyContent = "center";
        item.style.alignItems = "flex-start";
        item.style.minWidth = "0";
        item.style.width = "100%";
        item.setAttribute("aria-pressed", active ? "true" : "false");
        item.title = segment.label;

        const swatch = document.createElement("span");
        swatch.style.width = "9px";
        swatch.style.height = "9px";
        swatch.style.borderRadius = "2px";
        swatch.style.background = color || segment.color || "#999";
        swatch.style.border = "1px solid rgba(0,0,0,0.18)";
        swatch.style.flex = "0 0 auto";

        const label = document.createElement("span");
        label.textContent = segment.label;
        label.style.overflow = "visible";
        label.style.textOverflow = "clip";
        label.style.whiteSpace = "normal";
        label.style.overflowWrap = "anywhere";
        label.style.textAlign = "left";

        item.appendChild(swatch);
        item.appendChild(label);

        item.addEventListener("click", async () => {
            const st = window.__legendState;
            if (!st || !(st.activeCodes instanceof Set)) return;

            const codes = getGeoformasSegmentActiveCodes(segment, ring);
            if (!codes.length) return;

            const hasAnyActive = codes.some(code => st.activeCodes.has(code));
            codes.forEach(code => {
                if (hasAnyActive) st.activeCodes.delete(code);
                else st.activeCodes.add(code);
            });

            resetLegendVisualState();
            await applyLegendFilter();
            applyChartCategoryFilterFromLegend();
            window.__biofisicoApplyGeoformasChartFilter?.(st.activeCodes);
            window.__biofisicoApplyOrdenSueloChartFilter?.(st.activeCodes);
        });

        return item;
    }

    function renderGeoformasChartLegend(chart) {
        if (!chart?.__geoformasMultiSeries) return;

        const container = getGeoformasLegendContainer();
        if (!container) return;

        const activeCodes = window.__legendState?.activeCodes instanceof Set
            ? window.__legendState.activeCodes
            : null;

        const buildPanel = ({ title, ring, dataset }) => {
            const panel = document.createElement("section");
            panel.style.minWidth = "0";
            panel.style.padding = "0";
            panel.style.border = "0";
            panel.style.borderRadius = "0";
            panel.style.background = "transparent";
            panel.style.boxShadow = "none";

            const heading = document.createElement("div");
            heading.textContent = title;
            heading.style.fontSize = "11px";
            heading.style.fontWeight = "600";
            heading.style.marginBottom = "3px";
            heading.style.color = "#0d5f4b";
            heading.style.textAlign = "center";
            panel.appendChild(heading);

            const list = document.createElement("div");
            list.style.display = "grid";
            list.style.gridTemplateColumns = "repeat(auto-fit, minmax(110px, 1fr))";
            list.style.gap = "5px 12px";
            list.style.maxHeight = "none";
            list.style.overflow = "visible";
            list.style.alignItems = "center";
            list.style.justifyContent = "center";
            list.style.width = "100%";

            (dataset?.__segments || [])
                .filter(segment => Number(segment?.value) > 0 && String(segment?.label ?? "").trim())
                .forEach((segment, index) => {
                    list.appendChild(createGeoformasLegendItem({
                        segment,
                        ring,
                        color: dataset.__fullColors?.[index] || dataset.backgroundColor?.[index] || segment.color,
                        active: isGeoformasSegmentActive(segment, ring, activeCodes)
                    }));
                });

            panel.appendChild(list);
            return panel;
        };

        const paisajeDataset = chart.data.datasets.find(dataset => dataset.__geoformasRing === "paisaje");
        const relieveDataset = chart.data.datasets.find(dataset => dataset.__geoformasRing === "relieve");
        const titles = chart.__multiSeriesLegendTitles || {
            inner: "Paisajes",
            outer: "Geoformas"
        };
        const visiblePaisajeCount = (paisajeDataset?.__segments || [])
            .filter(segment => Number(segment?.value) > 0 && String(segment?.label ?? "").trim())
            .length;
        const visibleRelieveCount = (relieveDataset?.__segments || [])
            .filter(segment => Number(segment?.value) > 0 && String(segment?.label ?? "").trim())
            .length;
        const useFullWidthLegend = visiblePaisajeCount + visibleRelieveCount > 14 || visibleRelieveCount > 10;

        container.innerHTML = "";
        container.style.display = "grid";
        container.style.gridTemplateColumns = useFullWidthLegend ? "1fr" : "repeat(2, minmax(0, 1fr))";
        container.style.gap = "12px";
        container.style.marginTop = "6px";
        container.style.padding = "0 2px";
        container.style.background = "transparent";
        container.style.border = "0";
        container.style.boxShadow = "none";

        container.appendChild(buildPanel({
            title: titles.inner,
            ring: "paisaje",
            dataset: paisajeDataset
        }));
        container.appendChild(buildPanel({
            title: titles.outer,
            ring: "relieve",
            dataset: relieveDataset
        }));
    }

    async function selectGeoformasChartSegment(dataset, segment) {
        if (!dataset || !segment) return false;

        const isPaisaje = dataset.__geoformasRing === "paisaje";
        const ring = isPaisaje ? "paisaje" : "relieve";
        const activeCodes = getGeoformasSegmentActiveCodes(segment, ring);

        if (!activeCodes.length) return false;

        await setCategoryCodesActive(activeCodes, "chart");

        const activeConfig = getActiveLayerConfig();

        if (activeConfig?.isSuelos && activeConfig?.suelosType === "vocacion") {
            if (isPaisaje) {
                await zoomMapaVocacion(segment.code);
            } else {
                await zoomMapaVocacion(segment.paisajeCode, segment.code);
            }

            return true;
        }

        if (isPaisaje) {
            await zoomMapaGeoformas(segment.code);
        } else {
            await zoomMapaGeoformas(segment.paisajeCode, segment.code);
        }

        return true;
    }

    function isNumericLegendFieldType(fieldType) {
        const type = String(fieldType || "").toLowerCase();
        return (
            type === "small-integer" ||
            type === "integer" ||
            type === "single" ||
            type === "double" ||
            type === "long" ||
            type === "oid" ||
            type.includes("smallinteger") ||
            type.includes("integer") ||
            type.includes("single") ||
            type.includes("double") ||
            type.includes("oid")
        );
    }

    function buildLegendWhere(field, activeCodes, fieldType) {
        if (!field) return null;

        const values = [...activeCodes];

        if (!values.length) {
            return "1=0";
        }

        const isNumeric = isNumericLegendFieldType(fieldType);

        const formatted = values.map(v => {
            const s = String(v ?? "").trim();

            if (isNumeric && s !== "" && !isNaN(s)) {
                return Number(s);
            }

            return `'${s.replace(/'/g, "''")}'`;
        });

        return `${field} IN (${formatted.join(",")})`;
    }

    function getLayerFieldInfo(layer, field) {
        try {
            return (layer.fields || []).find(f =>
                String(f.name).toLowerCase() === String(field).toLowerCase()
            ) || null;
        } catch (_) {
            return null;
        }
    }

    function formatLegendSqlValue(value, fieldType) {
        const s = String(value ?? "").trim();
        const isNumeric = isNumericLegendFieldType(fieldType);

        if (isNumeric && s !== "" && !isNaN(s)) {
            return String(Number(s));
        }

        return `'${s.replace(/'/g, "''")}'`;
    }

    function buildCompositeLegendWhere(fields, activeCodes, layer) {
        const cleanFields = (fields || [])
            .map(field => String(field ?? "").trim())
            .filter(Boolean);

        if (!cleanFields.length) return null;

        const values = [...activeCodes];
        if (!values.length) return "1=0";

        if (cleanFields.length === 1) {
            const fieldInfo = getLayerFieldInfo(layer, cleanFields[0]);
            return buildLegendWhere(
                fieldInfo?.name || cleanFields[0],
                activeCodes,
                String(fieldInfo?.type || "").toLowerCase()
            );
        }

        const splitCompositeLegendCode = (value) => {
            const raw = String(value ?? "");
            const delimiter = raw.includes(";") ? ";" : ",";
            const parts = raw.split(delimiter);
            if (parts.length <= cleanFields.length) return parts;

            return [
                ...parts.slice(0, cleanFields.length - 1),
                parts.slice(cleanFields.length - 1).join(delimiter)
            ];
        };

        const clauses = values.map(value => {
            const parts = splitCompositeLegendCode(value);
            const fieldClauses = cleanFields.map((field, index) => {
                const fieldInfo = getLayerFieldInfo(layer, field);
                const fieldName = fieldInfo?.name || field;
                const fieldType = String(fieldInfo?.type || "").toLowerCase();
                return `${fieldName} = ${formatLegendSqlValue(parts[index] ?? "", fieldType)}`;
            });

            return `(${fieldClauses.join(" AND ")})`;
        });

        return clauses.length ? clauses.join(" OR ") : "1=0";
    }

    function getRiesgoCcMapBaseWhere(config) {
        if (!config?.isClima || config?.climaType !== "riesgo_cc" || filtroNivel !== "MUNI") return "";

        const depto = String(deptoActual || "").trim();
        if (!depto) return "";

        return `dpcodigo = '${depto.replace(/'/g, "''")}'`;
    }

    async function applyLegendFilter() {
        const st = window.__legendState;
        if (!st?.field) return;
        const legendContent = document.getElementById("legendContent");
        const config = getActiveLayerConfig();
        const isCuencasLegend = config?.isHidro && config?.hidroType === "cuencas";
        const isEcosistemasLegend = config?.isEcosistema && config?.ecosistemaType === "ecosistemas";
        const isDeforestacionLegend = config?.isEcosistema && config?.ecosistemaType === "deforestacion";
        const isOrdenSueloLegend = config?.isSuelos && config?.suelosType === "orden";
        const isRiesgoCcLegend = config?.isClima && config?.climaType === "riesgo_cc";
        const usesDefinitionLegendFilter = isCuencasLegend || isEcosistemasLegend || isDeforestacionLegend || isOrdenSueloLegend || isRiesgoCcLegend;

        if (!(st.activeCodes instanceof Set)) {
            st.activeCodes = new Set((st.allCodes || []).map(v => String(v)));
        }

        const targetLayers = getLegendTargetLayers();
        if (!targetLayers.length) {
            if (legendContent) {
                legendContent.dataset.legendFilterStatus = "no-target-layer";
            }
            return;
        }

        const totalCount = Array.isArray(st.allCodes) ? st.allCodes.length : 0;
        const activeCount = st.activeCodes.size;

        for (const currentLayer of targetLayers) {
            if (!currentLayer || currentLayer.destroyed) continue;

            let whereLegend = null;

            if (activeCount === 0) {
                whereLegend = "1=0";
            } else if (totalCount > 0 && activeCount < totalCount) {
                const fields = Array.isArray(st.fields) && st.fields.length
                    ? st.fields
                    : [st.field];
                if (usesDefinitionLegendFilter) {
                    const inactiveCodes = (st.allCodes || [])
                        .map(value => String(value ?? "").trim())
                        .filter(code => code && !st.activeCodes.has(code));
                    const hiddenWhere = buildCompositeLegendWhere(fields, new Set(inactiveCodes), currentLayer);
                    whereLegend = hiddenWhere ? `NOT (${hiddenWhere})` : null;
                } else {
                    whereLegend = buildCompositeLegendWhere(fields, st.activeCodes, currentLayer);
                }
            }

            const baseWhereCurrent = String(getRiesgoCcMapBaseWhere(config) || whereBase || "").trim();
            const baseWhereStored = String(st.baseWhere || "").trim();
            const baseWhereLayer = String(currentLayer.definitionExpression || "").trim();
            const baseWhereValue = baseWhereCurrent ||
                (/legend|NOT\s*\(/i.test(baseWhereLayer) ? "" : baseWhereLayer) ||
                baseWhereStored;
            const base = baseWhereValue ? `(${baseWhereValue})` : null;

            const finalWhere = whereLegend
                ? (base ? `${base} AND (${whereLegend})` : whereLegend)
                : (base || null);

            if (legendContent) {
                legendContent.dataset.legendFilterStatus = "applying";
                legendContent.dataset.legendFilterWhere = finalWhere || "";
                legendContent.dataset.legendFilterActiveCount = String(activeCount);
                legendContent.dataset.legendFilterTotalCount = String(totalCount);
                legendContent.dataset.legendFilterLayerId = String(currentLayer.layerId ?? "");
                legendContent.dataset.legendFilterScale = String(Math.round(Number(view.scale) || 0));
                legendContent.dataset.legendFilterFields = Array.isArray(st.fields) ? st.fields.join(",") : String(st.field || "");
            }

            try {
                const layerView = await view.whenLayerView(currentLayer);
                if (usesDefinitionLegendFilter) {
                    layerView.filter = null;
                    currentLayer.definitionExpression = finalWhere || (base ? st.baseWhere : whereBase || "1=1");
                    if (legendContent) {
                        legendContent.dataset.legendFilterDefinitionExpression = currentLayer.definitionExpression || "";
                    }
                } else {
                    layerView.filter = finalWhere ? { where: finalWhere } : null;
                }
                if (!usesDefinitionLegendFilter && typeof currentLayer.refresh === "function") {
                    currentLayer.refresh();
                }
                if (legendContent) {
                    legendContent.dataset.legendFilterStatus = "applied";
                }
            } catch (err) {
                if (legendContent) {
                    legendContent.dataset.legendFilterStatus = "error";
                }
                console.warn("No se pudo aplicar filtro de leyenda:", err);
            }
        }

        resetLegendVisualState();
    }

    function cargarCapaActual() {
        if (!mapRenderContext) {
            console.warn("Contexto de render de mapa no inicializado.");
            return;
        }
        window.__legendState = {
            allCodes: [],
            activeCodes: new Set(),
            field: null,
            fields: [],
            layer: null,
            baseWhere: whereBase || "1=1"
        };
        mapController.renderActiveLayer(mapRenderContext);
    }

    async function reiniciarConsultaActual() {
        const hasSelectedTerritory = Boolean(
            municipioActual || (filtroNivel === "DEPTO" && deptoActual)
        );
        if (!hasSelectedTerritory) return;

        const config = getActiveLayerConfig();
        if (!config || !view) return;

        if (typeof hideTimeSlider === "function") {
            hideTimeSlider();
        }
        timeSliderTouched = false;
        timeSliderIndex = 0;
        deforestacionPeriodoActivo = "Todos";

        renderCycleId++;
        syncStateFromGlobals();

        lastHoverWhere = "";
        legendFilterLabel = null;

        const legendContent = document.getElementById("legendContent");
        if (legendContent) {
            delete legendContent.dataset.legendSelectedCode;
            delete legendContent.dataset.legendFilterStatus;
            delete legendContent.dataset.legendFilterWhere;
            delete legendContent.dataset.legendFilterSource;
        }

        whereBase = buildWhereBase(config);
        syncStateFromGlobals();

        try {
            prepareSectionLoadingState();
            mapController.resetRenderKey();
            cargarCapaActual();
        } catch (e) {
            console.warn("No se pudo reiniciar la consulta actual:", e);
        }
    }
    function getFieldDomainLabel(layer, fieldName, code) {
        const field = (layer.fields || []).find(f => f.name === fieldName);
        const coded = field?.domain?.codedValues || [];
        const match = coded.find(cv => String(cv.code) === String(code));
        return match ? match.name : String(code);
    }

    function buildRuralPaletteFromRenderer(layer) {
        const map = new Map();
        const infos = layer?.renderer?.uniqueValueInfos || [];

        infos.forEach(info => {
            const key = String(info.value ?? "").trim(); // RuleID oficial
            if (!key) return;

            const fillColor = rgbaArrayToCss(info?.symbol?.color, "#999");
            const outlineColor = rgbaArrayToCss(info?.symbol?.outline?.color, "rgba(0,0,0,0)");
            const outlineWidth = Number(info?.symbol?.outline?.width ?? 0);

            map.set(key, {
                code: key,
                label: String(info.label ?? key).trim(),
                fillColor,
                outlineColor,
                outlineWidth
            });
        });

        return map;
    }























    async function cargarMunicipios() {
        if (Object.keys(diccionarioMunicipios).length === 0) {
            await cargarDiccionarioMunicipios();
        }

        // El selector territorial no debe depender de servicios ArcGIS ni del render del mapa.
        todosMunicipios = Object.keys(diccionarioMunicipios)
            .map(codigo => {
                const codigoNormalizado = normalizeMunicipalityCode(codigo);
                return {
                    codigo: codigoNormalizado,
                    nombre: diccionarioMunicipios[codigo] || diccionarioMunicipios[codigoNormalizado] || codigoNormalizado,
                    depto: normalizeDepartmentCode(codigoNormalizado.substring(0, 2))
                };
            })
            .sort((a, b) => getMunicipioDisplayName(a).localeCompare(getMunicipioDisplayName(b), "es", { sensitivity: "base" }));
        municipiosPorDepartamentoCache.clear();

        if (todosMunicipios.length > 0) {
            // Cargar departamentos en el select
            cargarDepartamentos();
            // Renderizar todos los municipios inicialmente
            renderizarMunicipios();
        }
    }



    function cargarDepartamentos() {

        const selectDepto = document.getElementById("departamentos");

        // limpiar
        selectDepto.innerHTML = `<option value="0">Seleccione departamento</option>`;

        // agregar Colombia
        const optionColombia = document.createElement("option");
        optionColombia.value = "COL";
        optionColombia.textContent = "Colombia";
        selectDepto.appendChild(optionColombia);

        // Obtener departamentos Ãºnicos
        const deptosUnicos = [...new Set(todosMunicipios.map(m => m.depto))].sort((codigoA, codigoB) => {
            const nombreA = getDepartamentoDisplayName(codigoA, diccionarioDepartamentos);
            const nombreB = getDepartamentoDisplayName(codigoB, diccionarioDepartamentos);
            return nombreA.localeCompare(nombreB, "es", { sensitivity: "base" });
        });

        deptosUnicos.forEach(codigoDepto => {

            const opt = document.createElement("option");

            opt.value = codigoDepto;
            opt.textContent = getDepartamentoDisplayName(codigoDepto, diccionarioDepartamentos);

            selectDepto.appendChild(opt);

        });

    }

    function renderizarMunicipios(deptoFiltro = null) {
        const select = document.getElementById("municipios");
        if (!select) return;

        const deptoNormalizado = deptoFiltro && deptoFiltro !== "0"
            ? normalizeDepartmentCode(deptoFiltro)
            : "";
        const cacheKey = deptoNormalizado || "__ALL__";

        let municipiosFiltrados = municipiosPorDepartamentoCache.get(cacheKey);
        if (!municipiosFiltrados) {
            municipiosFiltrados = deptoNormalizado
                ? todosMunicipios.filter(m => m.depto === deptoNormalizado)
                : todosMunicipios;
            municipiosPorDepartamentoCache.set(cacheKey, municipiosFiltrados);
        }

        select.replaceChildren();
        const defaultOption = document.createElement("option");
        defaultOption.value = "";
        defaultOption.textContent = "Seleccione un municipio";

        const fragment = document.createDocumentFragment();
        fragment.appendChild(defaultOption);

        municipiosFiltrados.forEach(muni => {
            const opt = document.createElement("option");
            opt.value = muni.codigo;
            opt.textContent = getMunicipioDisplayName(muni);
            fragment.appendChild(opt);
        });

        select.appendChild(fragment);
    }

    function createBiofisicoControllerApi() {
        function cancelScheduledCargarCapaActual() {
            if (scheduledLayerLoadTimeout !== null) {
                clearTimeout(scheduledLayerLoadTimeout);
                scheduledLayerLoadTimeout = null;
            }
        }

        return {
            updateURLByModule,
            hideTimeSlider,
            clearDepartmentHipsometryVisualState,
            prepareSectionLoadingState,
            destroyGeoformasCharts,
            toggleGeoformasCharts,
            renderControls,
            clearLayers,
            syncStateFromGlobals,
            actualizarResumen,
            updateChartTitleForCurrentTerritory() {
                actualizarTituloGrafico(getActiveLayerConfig(), null, null);
            },
            cargarCapaActual,
            cancelScheduledCargarCapaActual,
            shouldSkipDepartmentLayerRender() {
                return currentMode === "ECOSISTEMAS" && filtroNivel === "DEPTO" && !municipioActual;
            },
            getDepartmentLayerRenderDelay() {
                const config = getActiveLayerConfig();
                if (config?.isHidro && config?.hidroType === "cuencas" && filtroNivel === "DEPTO" && !municipioActual) {
                    return 700;
                }
                return 0;
            },
            scheduleCargarCapaActual(delayMs = 0) {
                cancelScheduledCargarCapaActual();
                scheduledLayerLoadTimeout = setTimeout(() => {
                    scheduledLayerLoadTimeout = null;
                    cargarCapaActual();
                }, delayMs);
            },
            cargarInfoMunicipio,
            ensureMunicipalLayerIndex,
            renderizarMunicipios,
            applyWhereToActiveLayers,
            destroyChartInstance() {
                destroyChartInstance();
            },
            destroyChartOnly() {
                destroyChartInstance();
            },
            clearMunicipioSelection() {
                document.getElementById("municipios").value = "";
                municipioActual = "";
                municipioInfo = null;
            },
            clearTerritoryFilters() {
                filtroNivel = "";
                deptoActual = "";
                whereBase = "";
            },
            setDepartamentoFilter(deptoSeleccionado) {
                deptoActual = normalizeDepartmentCode(deptoSeleccionado);
                filtroNivel = deptoSeleccionado && deptoSeleccionado !== "0" ? "DEPTO" : "";
            },
            setMunicipioFilter(codigo) {
                const codigoNormalizado = normalizeMunicipalityCode(codigo);
                filtroNivel = "MUNI";
                municipioActual = codigoNormalizado;
                deptoActual = normalizeDepartmentCode(codigoNormalizado.substring(0, 2));
            },
            selectDepartmentSubLayerForCurrentMode() {
                clampSubLayerIndex();
            },
            getPreviousLayerIdForCurrentLevel() {
                const prevList = getLayerListForCurrentLevel(currentMode);
                const prevCfg = prevList?.[currentSubLayerIndex];
                return prevCfg?.id;
            },
            rebuildWhereBaseFromActiveConfig() {
                const config = getActiveLayerConfig();
                whereBase = buildWhereBase(config);
            },
            goToColombia() {
                view.goTo(
                    { center: [-74.3, 4.6], zoom: 6 },
                    { duration: 900, easing: "ease-in-out" }
                );
            },
            hasActiveLayer: () => Boolean(layerGlobal),
            getWhereBase: () => whereBase,
            bumpRenderCycle() {
                renderCycleId++;
                syncStateFromGlobals();
            },
            updateLegendByExtentForActiveLayer() {
                updateLegendByExtent?.(layerGlobal, getActiveLayerConfig());
            },
            zoomToActiveLayerExtent() {
                cachedQueryExtent(layerGlobal, { where: whereBase }).then(res => {
                    if (res.extent) view.goTo(res.extent.expand(1.2));
                });
            }
        };
    }

    bindTerritorySelectEvents({
        onDepartamentoChange: value => handleDepartamentoSelectChange(createBiofisicoControllerApi(), value),
        onMunicipioChange: value => handleMunicipioSelectChange(createBiofisicoControllerApi(), value)
    });


    function crearGraficaBubbleOrdenSuelo(options) {
        destroyChartInstance();
        toggleGeoformasCharts(false);
        destroyGeoformasCharts();
        clearGeoformasInternalLegends();

        crearGraficaBubbleOrdenSueloRaw(options, {
            getCanvas: () => document.getElementById("chart"),
            getChartInstance: () => chartInstance,
            setChartInstance: (v) => { chartInstance = v; },
            zoomMapaOrdenSuelo,
            restoreAllChartCategories
        });
    }

    function formatPiePercentLabel(value) {
        const number = Number(value);
        if (!Number.isFinite(number)) return "";

        return `${number.toLocaleString("es-CO", {
            maximumFractionDigits: 2,
            minimumFractionDigits: number % 1 === 0 ? 0 : 1
        })}%`;
    }

    function createPiePercentageLabelsPlugin() {
        return {
            id: "biofisicoPiePercentageLabels",
            afterDatasetsDraw(chart) {
                const chartType = chart.config?.type;
                if (chartType !== "pie" && chartType !== "doughnut") return;
                if (chart.__geoformasMultiSeries) return;
                if ((chart.data?.datasets || []).length > 1) return;
                if ((chart.data?.datasets || []).some(dataset => Array.isArray(dataset?.__segments))) return;

                const { ctx, chartArea } = chart;
                const internalBoxes = [];
                const externalLabels = [];
                const fontSize = 11;
                const labelHeight = 16;

                const overlaps = (box, boxes) => boxes.some(other =>
                    box.left < other.right &&
                    box.right > other.left &&
                    box.top < other.bottom &&
                    box.bottom > other.top
                );

                const drawText = (text, x, y, align = "center") => {
                    ctx.save();
                    ctx.textAlign = align;
                    ctx.textBaseline = "middle";
                    ctx.font = `600 ${fontSize}px sans-serif`;
                    ctx.fillStyle = "#17352d";
                    ctx.fillText(text, x, y);
                    ctx.restore();
                };

                chart.data.datasets.forEach((dataset, datasetIndex) => {
                    const meta = chart.getDatasetMeta(datasetIndex);
                    if (!meta || meta.hidden) return;

                    meta.data.forEach((arc, dataIndex) => {
                        if (!arc || arc.hidden) return;
                        if (chart.getDataVisibility && !chart.getDataVisibility(dataIndex)) return;

                        const rawValue = dataset?.__segments?.[dataIndex]?.value ?? dataset.data?.[dataIndex];
                        const value = Number(rawValue);
                        if (!Number.isFinite(value) || value <= 0) return;

                        const text = formatPiePercentLabel(value);
                        if (!text) return;

                        const arcProps = typeof arc.getProps === "function"
                            ? arc.getProps(["x", "y", "startAngle", "circumference", "outerRadius", "innerRadius"], true)
                            : arc;
                        const centerX = Number(arcProps.x ?? arc.x ?? 0);
                        const centerY = Number(arcProps.y ?? arc.y ?? 0);
                        const circumference = Number(arcProps.circumference || 0);
                        const outerRadius = Number(arcProps.outerRadius || 0);
                        const innerRadius = Number(arcProps.innerRadius || 0);
                        const radialWidth = outerRadius - innerRadius;
                        const angle = Number(arcProps.startAngle || 0) + circumference / 2;
                        const midRadius = innerRadius + radialWidth * 0.56;
                        const arcLength = Math.abs(circumference) * Math.max(midRadius, 1);
                        const textWidth = text.length * fontSize * 0.62 + 6;
                        const cos = Math.cos(angle);
                        const sin = Math.sin(angle);
                        const internalX = centerX + cos * midRadius;
                        const internalY = centerY + sin * midRadius;
                        const internalBox = {
                            left: internalX - textWidth / 2,
                            right: internalX + textWidth / 2,
                            top: internalY - labelHeight / 2,
                            bottom: internalY + labelHeight / 2
                        };
                        const hasInternalSpace = Math.abs(circumference) >= 0.28 &&
                            arcLength >= textWidth + 10 &&
                            radialWidth >= 14;

                        if (hasInternalSpace && !overlaps(internalBox, internalBoxes)) {
                            internalBoxes.push(internalBox);
                            drawText(text, internalX, internalY);
                            return;
                        }

                        const side = Math.cos(angle) >= 0 ? "right" : "left";
                        const startRadius = Math.max(innerRadius, outerRadius - 0.5);
                        externalLabels.push({
                            text,
                            side,
                            y: centerY + sin * (outerRadius + 16),
                            anchorX: centerX + cos * startRadius,
                            anchorY: centerY + sin * startRadius,
                            textX: side === "right"
                                ? Math.min(chartArea.right - 2, centerX + outerRadius + 34)
                                : Math.max(chartArea.left + 2, centerX - outerRadius - 34)
                        });
                    });
                });

                const adjustExternalLabels = (items) => {
                    const sorted = items.sort((a, b) => a.y - b.y);
                    const minY = chartArea.top + 10;
                    const maxY = chartArea.bottom - 10;
                    const gap = 15;

                    sorted.forEach((item, index) => {
                        const previous = sorted[index - 1];
                        const minAllowed = previous ? previous.y + gap : minY;
                        item.y = Math.max(minAllowed, Math.min(maxY, item.y));
                    });

                    for (let i = sorted.length - 2; i >= 0; i--) {
                        sorted[i].y = Math.min(sorted[i].y, sorted[i + 1].y - gap);
                    }

                    sorted.forEach(item => {
                        item.y = Math.max(minY, Math.min(maxY, item.y));
                    });
                };

                adjustExternalLabels(externalLabels.filter(item => item.side === "left"));
                adjustExternalLabels(externalLabels.filter(item => item.side === "right"));

                ctx.save();
                ctx.strokeStyle = "rgba(23,53,45,0.72)";
                ctx.lineWidth = 1.15;
                ctx.lineCap = "round";
                ctx.lineJoin = "round";
                ctx.fillStyle = "#17352d";
                ctx.font = `600 ${fontSize}px sans-serif`;
                ctx.textBaseline = "middle";

                externalLabels.forEach(item => {
                    const lineEndX = item.side === "right" ? item.textX - 4 : item.textX + 4;
                    ctx.beginPath();
                    ctx.moveTo(item.anchorX, item.anchorY);
                    ctx.lineTo(lineEndX, item.y);
                    ctx.stroke();

                    ctx.beginPath();
                    ctx.arc(item.anchorX, item.anchorY, 1.35, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.textAlign = item.side === "right" ? "left" : "right";
                    ctx.fillText(item.text, item.textX, item.y);
                });

                ctx.restore();
            }
        };
    }

    function splitAxisLabel(text, maxChars = 18, maxLines = 2) {
        const words = String(text ?? "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
        if (!words.length) return "";

        const lines = [];
        let line = "";

        for (const word of words) {
            const candidate = line ? `${line} ${word}` : word;
            if (candidate.length <= maxChars) {
                line = candidate;
                continue;
            }

            if (line) lines.push(line);
            line = word;

            if (lines.length >= maxLines) break;
        }

        if (line && lines.length < maxLines) lines.push(line);

        const consumed = lines.join(" ");
        const original = words.join(" ");
        if (consumed.length < original.length && lines.length) {
            const lastIndex = lines.length - 1;
            const available = Math.max(4, maxChars - 3);
            lines[lastIndex] = `${lines[lastIndex].slice(0, available).trim()}...`;
        }

        return lines.length === 1 ? lines[0] : lines;
    }

    function createAdaptiveEcosystemYAxisLabeler(fullLabels) {
        return function ecosystemYAxisTick(value, index) {
            const labelIndex = Number.isFinite(Number(value)) ? Math.round(Number(value)) : index;
            const label = fullLabels[labelIndex] ?? this.getLabelForValue?.(value) ?? "";
            const total = fullLabels.length;
            const scale = this;
            const min = Number.isFinite(Number(scale.min)) ? Math.floor(Number(scale.min)) : 0;
            const max = Number.isFinite(Number(scale.max)) ? Math.ceil(Number(scale.max)) : total - 1;
            const visibleCount = Math.max(1, max - min + 1);

            const maxVisibleLabels = visibleCount <= 8
                ? visibleCount
                : (visibleCount <= 14 ? 10 : (total >= 24 ? 8 : 9));
            const step = Math.max(1, Math.ceil(visibleCount / Math.max(1, maxVisibleLabels)));
            if (step > 1 && ((labelIndex - min) % step !== 0)) return "";

            if (visibleCount <= 8) return splitAxisLabel(label, 30, 3);
            if (visibleCount <= 14) return splitAxisLabel(label, 24, 3);
            return splitAxisLabel(label, 20, 2);
        };
    }

    function resetChartVisualState() {
        const canvas = document.getElementById("chart");
        const chartCard = canvas?.closest(".chart-card");

        if (chartInstance?.resetZoom) {
            try { chartInstance.resetZoom(); } catch (_) {}
        }

        if (canvas?.__biofisicoRestoreDblClickHandler) {
            canvas.removeEventListener("dblclick", canvas.__biofisicoRestoreDblClickHandler);
            canvas.__biofisicoRestoreDblClickHandler = null;
        }
        if (canvas?.__ordenSueloRestoreDblClickHandler) {
            canvas.removeEventListener("dblclick", canvas.__ordenSueloRestoreDblClickHandler);
            canvas.__ordenSueloRestoreDblClickHandler = null;
        }
        if (canvas?.__ordenSueloClickHandler) {
            canvas.removeEventListener("click", canvas.__ordenSueloClickHandler);
            canvas.__ordenSueloClickHandler = null;
        }

        if (canvas) {
            canvas.removeAttribute("data-biofisico-chart-sync-status");
            canvas.removeAttribute("data-biofisico-chart-active-codes");
            canvas.removeAttribute("data-biofisico-chart-total-count");
            canvas.removeAttribute("data-biofisico-chart-active-count");
            canvas.removeAttribute("data-biofisico-chart-selected-code");
            canvas.style.removeProperty("height");
            canvas.style.removeProperty("max-height");
            canvas.style.removeProperty("min-height");
            canvas.style.removeProperty("width");
            canvas.style.removeProperty("min-width");
            canvas.style.removeProperty("max-width");
        }

        chartCard?.classList.remove("chart-ecosistemas", "chart-hipsometria-depto", "chart-bubble", "chart-bubble-depto");
        chartCard?.style.removeProperty("--biofisico-chart-height");
        chartCard?.style.removeProperty("--biofisico-hipso-depto-height");
        chartCard?.style.removeProperty("height");
        chartCard?.style.removeProperty("max-height");
        chartCard?.style.removeProperty("min-height");

        window.__biofisicoApplyGeoformasChartFilter = null;
        window.__biofisicoApplyOrdenSueloChartFilter = null;
        window.__vocacionSelectedLabel = null;
        window.__geoformaSelectedPaisaje = null;
    }

    function clearDepartmentHipsometryVisualState() {
        const canvas = document.getElementById("chart");
        const chartCard = canvas?.closest(".chart-card");
        chartCard?.classList.remove("chart-hipsometria-depto");
        chartCard?.style.removeProperty("--biofisico-hipso-depto-height");
        if (canvas) {
            canvas.style.removeProperty("max-height");
            canvas.style.removeProperty("min-height");
        }
    }

    function clearChartCanvasPixels() {
        const canvas = document.getElementById("chart");
        if (!canvas) return;

        try {
            const context = canvas.getContext("2d");
            context?.clearRect(0, 0, canvas.width || canvas.clientWidth || 0, canvas.height || canvas.clientHeight || 0);
        } catch (_) {}
    }

    function setBiofisicoLoadingMessage(message = "Cargando informaciÃ³n...") {
        const title = document.getElementById("chartTitle");
        const summary = document.getElementById("summaryDiv");
        const legendTitle = document.getElementById("legendTitle");
        const legendContent = document.getElementById("legendContent");
        const mapSource = document.getElementById("mapSource");

        if (title) title.textContent = message;
        if (summary) summary.textContent = message;
        if (legendTitle) legendTitle.textContent = "Leyenda";
        if (legendContent) {
            legendContent.innerHTML = `<p style="margin:0; color:#666;">${message}</p>`;
            legendContent.classList.remove("collapsed");
            delete legendContent.dataset.legendSelectedCode;
            delete legendContent.dataset.legendFilterStatus;
            delete legendContent.dataset.legendFilterWhere;
        }
        if (mapSource) mapSource.textContent = "";
    }

    function prepareSectionLoadingState() {
        if (scheduledLayerLoadTimeout !== null) {
            clearTimeout(scheduledLayerLoadTimeout);
            scheduledLayerLoadTimeout = null;
        }
        clearDepartmentHipsometryVisualState();
        toggleGeoformasCharts(false);
        destroyGeoformasCharts();
        clearGeoformasInternalLegends();
        clearHighlight();
        destroyChartInstance();
        clearChartCanvasPixels();
        clearLayers();
        setBiofisicoLoadingMessage();

        window.__legendState = {
            allCodes: [],
            activeCodes: new Set(),
            field: null,
            fields: [],
            layer: null,
            baseWhere: "1=1"
        };
        window.__biofisicoApplyGeoformasChartFilter = null;
        window.__biofisicoApplyOrdenSueloChartFilter = null;

        if (view?.popup) {
            try { view.popup.close(); } catch (_) {}
        }
    }

    function destroyChartInstance({ resetVisual = true } = {}) {
        if (chartInstance) {
            if (chartInstance.resetZoom) {
                try { chartInstance.resetZoom(); } catch (_) {}
            }
            chartInstance.destroy();
            chartInstance = null;
        }
        if (resetVisual) resetChartVisualState();
    }


    function crearGrafica(labels, values, colors, type = 'bar', isVertical = false, datasets = null) {
        const layerConfig = getActiveLayerConfig();
        destroyChartInstance();
        toggleGeoformasCharts(false);
        destroyGeoformasCharts();
        clearGeoformasInternalLegends();
        let originalChartLabels = Array.isArray(labels) ? [...labels] : [];
        let originalChartColors = Array.isArray(colors) ? [...colors] : colors;
        const isEcosistemasChart =
            layerConfig?.isEcosistema &&
            layerConfig?.ecosistemaType === "ecosistemas";
        const isHipsometryChart = layerConfig?.id === "hipsometria" || layerConfig?.id === "hipsometria_depto";
        const isDepartmentOnlyPercentContext = () => {
            const deptValue = String(document.getElementById("departamentos")?.value || "").trim();
            const muniValue = String(document.getElementById("municipios")?.value || "").trim();
            return Boolean(
                (filtroNivel === "DEPTO" || (deptValue && deptValue !== "0" && deptValue !== "COL")) &&
                !municipioActual &&
                !muniValue
            );
        };
        const shouldNormalizeDepartmentPercentValues = () => {
            if (!isDepartmentOnlyPercentContext()) return false;
            if (datasets !== null || !Array.isArray(values)) return false;
            if (!["bar", "pie", "doughnut", "polarArea"].includes(type)) return false;

            return Boolean(
                isHipsometryChart ||
                (layerConfig?.isClima && layerConfig?.climaType === "clima_tipo") ||
                (layerConfig?.isHidro && layerConfig?.hidroType === "escorrentia") ||
                (layerConfig?.isEcosistema && layerConfig?.ecosistemaType === "ecosistemas") ||
                (layerConfig?.isSuelos && layerConfig?.suelosType === "conflictos") ||
                (layerConfig?.isFenomenos && ["inundaciones", "degradacion", "sismica"].includes(layerConfig?.fenomenosType))
            );
        };
        const parseChartNumber = (value) => {
            if (typeof value === "number") return Number.isFinite(value) ? value : 0;
            const normalized = String(value ?? "")
                .trim()
                .replace(/\s/g, "")
                .replace(/%$/g, "")
                .replace(",", ".");
            const parsed = Number(normalized);
            return Number.isFinite(parsed) ? parsed : 0;
        };
        const formatPercentAxisTick = (value, withSymbol = false) => {
            const numericValue = parseChartNumber(value);
            if (!Number.isFinite(numericValue)) return value;

            const roundedValue = Number(numericValue.toFixed(2));
            const formattedValue = Number.isInteger(roundedValue)
                ? String(roundedValue)
                : String(roundedValue).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");

            return withSymbol ? `${formattedValue}%` : formattedValue;
        };
        if (shouldNormalizeDepartmentPercentValues()) {
            let rows = values.map((value, index) => ({
                label: Array.isArray(labels) ? labels[index] : index,
                color: Array.isArray(colors) ? colors[index] : colors,
                value: parseChartNumber(value)
            })).filter(row => row.value > 0);

            if (!rows.length) {
                labels = [];
                values = [];
                if (Array.isArray(colors)) colors = [];
                originalChartLabels = [];
                originalChartColors = Array.isArray(colors) ? [] : colors;
            } else if (rows.length !== values.length) {
                labels = rows.map(row => row.label);
                values = rows.map(row => row.value);
                if (Array.isArray(colors)) colors = rows.map(row => row.color);
                originalChartLabels = Array.isArray(labels) ? [...labels] : [];
                originalChartColors = Array.isArray(colors) ? [...colors] : colors;
            }

            const total = rows.reduce((sum, row) => sum + row.value, 0);
            if (total > 100.5) {
                rows = rows.map(row => ({
                    ...row,
                    value: Number(((row.value / total) * 100).toFixed(2))
                }));
                labels = rows.map(row => row.label);
                values = rows.map(row => row.value);
                if (Array.isArray(colors)) colors = rows.map(row => row.color);
                originalChartLabels = Array.isArray(labels) ? [...labels] : [];
                originalChartColors = Array.isArray(colors) ? [...colors] : colors;
            }
        }
        if (isDepartmentOnlyPercentContext() && isHipsometryChart && Array.isArray(labels) && Array.isArray(values)) {
            const rows = values.map((value, index) => ({
                label: labels[index],
                color: Array.isArray(colors) ? colors[index] : colors,
                value: Number(parseChartNumber(value).toFixed(3))
            })).filter(row => row.value > 0);

            labels = rows.map(row => row.label);
            values = rows.map(row => row.value);
            if (Array.isArray(colors)) colors = rows.map(row => row.color);
            originalChartLabels = [...labels];
            originalChartColors = Array.isArray(colors) ? [...colors] : colors;
        }
        const originalChartValues = Array.isArray(values) ? [...values] : [];
        const supportsChartZoomPan = () => Boolean(
            type === "bar" && (
                (layerConfig?.isClima && layerConfig?.climaType === "clima_tipo") ||
                (layerConfig?.isSuelos && layerConfig?.suelosType === "conflictos") ||
                (layerConfig?.isFenomenos && layerConfig?.fenomenosType === "inundaciones") ||
                isEcosistemasChart
            )
        );
        const createChartZoomPanOptions = (mode, categoryCount = 0, axisOptions = {}) => {
            const pluginMode = axisOptions.pluginMode || mode;
            const categoryAxisId = axisOptions.categoryAxisId || mode;
            const valueAxisId = axisOptions.valueAxisId || null;
            const valueMax = Math.max(0, Number(axisOptions.valueMax) || 0);
            const lastCategoryIndex = Math.max(0, Number(categoryCount || 0) - 1);
            const categoryLimits = {
                min: 0,
                max: lastCategoryIndex,
                minRange: lastCategoryIndex > 0 ? 0.9 : 0
            };
            const valueLimits = valueAxisId
                ? {
                    min: 0,
                    max: valueMax > 0 ? valueMax : "original",
                    minRange: valueMax > 0 ? Math.max(valueMax * 0.002, 0.01) : undefined
                }
                : null;
            const getDatasetValueAtIndex = (dataset, index) => {
                const raw = dataset?.data?.[index];
                const value = raw && typeof raw === "object"
                    ? parseChartNumber(raw[valueAxisId] ?? raw.x ?? raw.y ?? raw.r ?? raw.value)
                    : parseChartNumber(raw);
                return Number.isFinite(value) ? Math.max(0, value) : 0;
            };
            const getVisibleDataMax = (chart, min, max) => {
                if (!chart?.data?.datasets?.length) return 0;

                const first = Math.max(0, Math.floor(Number(min) || 0));
                const last = Math.min(lastCategoryIndex, Math.ceil(Number(max) || 0));
                let visibleMax = 0;

                for (let index = first; index <= last; index += 1) {
                    for (const dataset of chart.data.datasets || []) {
                        visibleMax = Math.max(visibleMax, getDatasetValueAtIndex(dataset, index));
                    }
                }

                return visibleMax;
            };
            const keepChartWindowUsable = ({ chart } = {}) => {
                const scale = chart?.scales?.[categoryAxisId];
                const valueScale = valueAxisId ? chart?.scales?.[valueAxisId] : null;
                let changed = false;

                const syncValueScale = (visibleMin = 0, visibleMax = lastCategoryIndex) => {
                    if (!valueScale || valueMax <= 0) return;

                    const currentMax = Number(valueScale.max);
                    const visibleDataMax = getVisibleDataMax(chart, visibleMin, visibleMax);
                    const minVisibleMax = visibleDataMax > 0
                        ? Math.max(valueLimits.minRange || 0.01, visibleDataMax * 1.05)
                        : (valueLimits.minRange || 0.01);
                    const nextMax = Number.isFinite(currentMax)
                        ? Math.max(minVisibleMax, Math.min(valueMax, currentMax))
                        : valueMax;
                    valueScale.options.min = 0;
                    valueScale.options.max = nextMax;
                    changed = true;
                };

                if (!scale || lastCategoryIndex <= 0) {
                    syncValueScale(0, lastCategoryIndex);
                    if (changed) chart?.update("none");
                    return;
                }

                let min = Number(scale.min);
                let max = Number(scale.max);
                if (!Number.isFinite(min) || !Number.isFinite(max)) {
                    if (changed) chart?.update("none");
                    return;
                }

                min = Math.max(0, Math.min(lastCategoryIndex, min));
                max = Math.max(0, Math.min(lastCategoryIndex, max));
                if (max < min) [min, max] = [max, min];

                const firstVisibleIndex = Math.ceil(min);
                const lastVisibleIndex = Math.floor(max);
                if (firstVisibleIndex <= lastVisibleIndex) {
                    scale.options.min = min;
                    scale.options.max = max;
                    syncValueScale(min, max);
                    changed = true;
                    if (changed) chart.update("none");
                    return;
                }

                if (lastCategoryIndex <= 0) {
                    if (changed) chart.update("none");
                    return;
                }

                const nearestIndex = Math.max(
                    0,
                    Math.min(lastCategoryIndex, Math.round((min + max) / 2))
                );
                const halfWindow = 0.45;
                scale.options.min = Math.max(0, nearestIndex - halfWindow);
                scale.options.max = Math.min(lastCategoryIndex, nearestIndex + halfWindow);
                syncValueScale(scale.options.min, scale.options.max);
                changed = true;

                if (changed) {
                    chart.update("none");
                }
            };
            const limits = {
                x: categoryAxisId === "x" ? categoryLimits : { min: "original", max: "original" },
                y: categoryAxisId === "y" ? categoryLimits : { min: "original", max: "original" }
            };

            if (valueAxisId && valueLimits) {
                limits[valueAxisId] = valueLimits;
            }

            return {
                pan: {
                    enabled: true,
                    mode: pluginMode,
                    threshold: 8,
                    onPanComplete: keepChartWindowUsable
                },
                zoom: {
                    wheel: {
                        enabled: true
                    },
                    pinch: {
                        enabled: true
                    },
                    drag: {
                        enabled: false
                    },
                    mode: pluginMode,
                    onZoomComplete: keepChartWindowUsable
                },
                limits
            };
        };
        const ensureChartZoomPluginRegistered = () => {
            const chartCtor = globalThis.Chart;
            const zoomPlugin = globalThis.ChartZoom || globalThis.chartjsPluginZoom;
            if (!chartCtor?.register || !zoomPlugin || chartCtor.__biofisicoZoomRegistered) return;

            try {
                chartCtor.register(zoomPlugin);
                chartCtor.__biofisicoZoomRegistered = true;
            } catch (_) {}
        };
        const isDepartmentOnlyHipsometryContext = () => {
            const deptValue = String(document.getElementById("departamentos")?.value || "").trim();
            const muniValue = String(document.getElementById("municipios")?.value || "").trim();
            const activeText = String(
                Array.from(document.querySelectorAll(".subtab-btn.active, .tab-btn.active, button.active"))
                    .map(button => button.textContent || "")
                    .join(" ")
            ).trim();
            const chartTitle = String(document.querySelector(".chart-title, #chartTitle, .grafico-title, h3")?.textContent || "").trim();
            const hasHipsometryActiveUi =
                /hipsometr/i.test(activeText) ||
                /hipsometr/i.test(chartTitle);
            const isHipsometryUi =
                hasHipsometryActiveUi ||
                (isHipsometryChart && !activeText && !chartTitle);

            return Boolean(
                type === "bar" &&
                !isVertical &&
                isHipsometryUi &&
                deptValue &&
                deptValue !== "0" &&
                deptValue !== "COL" &&
                !muniValue
            );
        };
        const applyDepartmentHipsometryCanvasHeight = () => {
            if (!isDepartmentOnlyHipsometryContext()) return;

            const canvas = document.getElementById("chart");
            if (!canvas) return;

            const labelCount = Array.isArray(originalChartLabels) ? originalChartLabels.length : 0;
            const screenW = window.innerWidth || 1200;
            const isSmallScreen = screenW <= 768;
            const baseHeight = isSmallScreen ? 330 : 300;
            const extraHeight = labelCount >= 13
                ? Math.min(isSmallScreen ? 130 : 170, Math.max(0, (labelCount - 12) * 8))
                : 0;
            const finalHeight = baseHeight + extraHeight;
            const chartCard = canvas.closest(".chart-card");

            chartCard?.classList.remove("chart-ecosistemas");
            chartCard?.classList.add("chart-hipsometria-depto");
            chartCard?.style.removeProperty("--biofisico-chart-height");
            chartCard?.style.setProperty("--biofisico-hipso-depto-height", `${finalHeight}px`);
            canvas.style.setProperty("height", `${finalHeight}px`, "important");
            canvas.style.setProperty("max-height", `${finalHeight}px`, "important");
            canvas.style.removeProperty("min-height");
            if (chartInstance?.resize) {
                try { chartInstance.resize(); } catch (_) {}
            }
        };
        const getOriginalChartLabel = (value, index) => {
            const numericValue = Number(value);
            const labelIndex = Number.isFinite(numericValue) ? Math.round(numericValue) : index;
            const label = originalChartLabels[labelIndex] ?? originalChartLabels[index] ?? value;
            return Array.isArray(label) ? label.join(" ") : String(label ?? "");
        };
        if (type === 'bar' && !isVertical && !isEcosistemasChart) {
            labels = labels.map(l => wrapLabel(l, 22));
        }
        //  TÃ­tulos de ejes segÃºn capa/tipo
        const axisTitles = getAxisTitles(layerConfig, type, isVertical, datasets);

        const ctx = document.getElementById("chart").getContext("2d");

        const isPieLike = (type === "doughnut" || type === "pie");
        const chartDatasets = datasets || [{
            label: (type === 'radar') ? "" : (type === 'line' ? "Cobertura (%)" : "%"),
            data: values,
            backgroundColor: colors || "rgba(0, 121, 193, 0.6)",
            borderColor: isPieLike ? "transparent" : "rgba(0,0,0,0)",
            borderWidth: isPieLike ? 0 : (type === "bar" ? 0 : 2),
            fill: type === 'radar',
            minBarLength: type === "bar" && supportsChartZoomPan() ? 2 : undefined
        }];
        const isGeoformasMultiSeries = (layerConfig?.id === "geoformas" ||
            (layerConfig?.isSuelos && layerConfig?.suelosType === "vocacion")) &&
            type === "doughnut" &&
            Array.isArray(chartDatasets) &&
            chartDatasets.some(dataset => Array.isArray(dataset.__segments));

        if (Array.isArray(datasets)) {
            chartDatasets.forEach(dataset => {
                if (Array.isArray(dataset.__segments)) return;
                dataset.__biofisicoCode = String(dataset.__biofisicoCode ?? dataset.gradeCode ?? dataset.rangeCode ?? dataset.code ?? dataset.label ?? "").trim();
            });
        }

        const isStacked = !isGeoformasMultiSeries && Array.isArray(datasets) && datasets.length > 0;
        // Solo forzamos 0â€“100 en clima apilado
        const isPercentStacked = isStacked && layerConfig?.isClima === true && layerConfig?.isStacked === true;
        const chartValueMax = Math.max(
            0,
            ...chartDatasets.flatMap(dataset => (dataset?.data || [])
                .map(value => parseChartNumber(value))
                .filter(value => Number.isFinite(value) && value > 0)
            )
        );

        const config = {
            type,
            data: { labels, datasets: chartDatasets },
            options: {
            responsive: true,
            plugins: {
                legend: {
                    display: (
                        type === 'pie' ||
                        type === 'doughnut' ||
                        type === 'polarArea' ||
                        datasets !== null
                    ),
                    position: datasets ? 'right' : 'bottom',
                    labels: {
                        boxWidth: 12,
                        font: { size: 10 },
                        usePointStyle: type === "polarArea",
                        pointStyle: "rectRounded"
                    }
                },
                tooltip: {
                    callbacks: {
                        title: function (items) {
                            const item = items?.[0];
                            if (!item) return "";
                            if (isEcosistemasChart) {
                                return String(originalChartLabels[item.dataIndex] ?? item.label ?? "");
                            }
                            if (isHipsometryChart) {
                                return getOriginalChartLabel(item.dataIndex, item.dataIndex);
                            }
                            return item.label || "";
                        },
                        label: function (context) {
                            if (context.dataset?.__segments?.[context.dataIndex]) {
                                const segment = context.dataset.__segments[context.dataIndex];
                                const value = Number(segment.value ?? context.raw ?? 0);
                                return `${context.dataset.label}: ${segment.label} ${value.toFixed(2)}%`;
                            }

                            // Riesgo CC departamental
                            if (layerConfig?.isDeptoRiskCount) {
                                const v = context.parsed?.y ?? context.parsed ?? context.raw;
                                const n = Number(v);
                                if (!Number.isFinite(n)) return "";
                                return `Municipios: ${Math.round(n)}`;
                            }

                            // Radar
                            if (context.chart.config.type === 'radar') {
                                const v = context.raw;
                                if (v == null || Number.isNaN(Number(v))) return '';
                                return Number(v).toFixed(2);
                            }

                            // PolarArea (Pendientes)
                            if (context.chart.config.type === "polarArea") {
                                const label = context.label || "";
                                const rawValue =
                                    context.parsed?.r ??
                                    context.parsed ??
                                    context.raw;

                                const value = Number(rawValue);
                                if (!Number.isFinite(value)) return label;

                                return `${label}: ${value.toFixed(2)}%`;
                            }

                            // Resto de grÃ¡ficos
                            const datasetLabel = String(context.dataset.label || "").trim();
                            const isNoiseDatasetLabel = /^(%|porcentaje|cobertura\s*\(%\)|cobertura|valor\s*\(%\))$/i
                                .test(datasetLabel);
                            let label = datasetLabel && !isNoiseDatasetLabel ? `${datasetLabel}: ` : "";

                            let value = null;
                            if (context.parsed && typeof context.parsed === 'object') {
                                const indexAxis = context.chart?.options?.indexAxis || 'x';
                                if (indexAxis === 'y' && context.parsed.x != null) value = context.parsed.x;
                                else if (context.parsed.y != null) value = context.parsed.y;
                                else if (context.parsed.x != null) value = context.parsed.x;
                            } else if (typeof context.parsed === 'number') {
                                value = context.parsed;
                            }

                            if (value != null && !Number.isNaN(value)) {
                                label += Number(value).toFixed(2) + '%';
                            }

                            return label;
                        }
                    }
                },
            },
            onClick: async (evt, elements) => {
                if (!elements.length) return;
                if (type === 'radar') return;

                const el = elements[0];
                let clickedLabel = chartInstance.data.labels?.[el.index];

                if (Array.isArray(clickedLabel)) clickedLabel = clickedLabel.join(" ");

                // =========================
                // STACKED BIOFÃSICO
                // =========================
                if (datasets !== null && el.datasetIndex !== undefined) {
                    const dataset = chartInstance.data.datasets[el.datasetIndex];
                    const segment = dataset?.__segments?.[el.index];

                    if (layerConfig?.id === "geoformas" && segment) {
                        if (await selectGeoformasChartSegment(dataset, segment)) return;
                    }

                    const periodo = chartInstance.data.labels?.[el.index];
                    const periodoTxt = Array.isArray(periodo) ? periodo.join(" ") : String(periodo ?? "");

                    if (dataset.rangeCode != null && periodoTxt) {
                        filtrarPorRangoPeriodo(dataset.rangeCode, periodoTxt);
                        return;
                    }
                    if (dataset.rangeCode != null) {
                        filtrarPorRangoCodigo(dataset.rangeCode);
                        return;
                    }
                }

                // =========================
                // FLUJO NORMAL BIOFÃSICO
                // =========================
                if (clickedLabel != null) {
                    filtrarPorAtributo(String(clickedLabel));
                }
            },
            onHover: (evt, elements) => {

                if (!elements.length) {
                    clearHighlight();
                    return;
                }

                const el = elements[0];
                let label = chartInstance.data.labels[el.index];

                if (Array.isArray(label)) label = label.join(" ");

                const config = getActiveLayerConfig();

                let where = "";

                // SOLO BF3 (tu caso actual)
                if (config.isBF3) {

                    const code = bf3LabelToCode.get(label);

                    if (code) {
                        const safe = String(code).trim();
                        const isNum = /^-?\d+(\.\d+)?$/.test(safe);
                        where = whereBase
                        ? (isNum ? `${whereBase} AND paisaje = ${safe}` : `${whereBase} AND paisaje = '${safe.replace(/'/g,"''")}'`)
                        : (isNum ? `paisaje = ${safe}` : `paisaje = '${safe.replace(/'/g,"''")}'`);
                    }

                }

                if (where) {
                    highlightWhereDebounced(where);
                }

            }
            }
        };

        if (Array.isArray(datasets) && datasets.length > 0) {
            config.options.plugins.legend.onClick = async (_event, legendItem, legend) => {
                const chart = legend?.chart || chartInstance;
                const datasetIndex = legendItem?.datasetIndex;
                const dataset = Number.isInteger(datasetIndex)
                    ? chart?.data?.datasets?.[datasetIndex]
                    : null;

                if (dataset && await setOnlyChartCategoryActive(dataset.label, datasetIndex, dataset)) {
                    return;
                }

                if (chart && Number.isInteger(datasetIndex)) {
                    chart.setDatasetVisibility(datasetIndex, !chart.isDatasetVisible(datasetIndex));
                    chart.update();
                }
            };
        }

        if (isPieLike) {
            config.plugins = [
                ...(config.plugins || []),
                createPiePercentageLabelsPlugin()
            ];
        }

        // =========================
        // Config por tipo
        // =========================
        if (type === 'bar') {
            const screenW = window.innerWidth || 1200;
            const totalLabels = Array.isArray(labels) ? labels.length : 0;
            const isSmallScreen = screenW <= 768;
            const isVerySmallScreen = screenW <= 480;
            const tooManyItems = totalLabels >= 8;
            const tooManyItemsMobile = totalLabels >= 6;
            const selectedDeptValue = String(document.getElementById("departamentos")?.value || "").trim();
            const selectedMuniValue = String(document.getElementById("municipios")?.value || "").trim();
            const activeSubTabText = String(
                Array.from(document.querySelectorAll(".subtab-btn"))
                    .find(button => button.classList.contains("active"))
                    ?.textContent || ""
            ).trim();
            const isHipsometryUiChart =
                /hipsometr/i.test(activeSubTabText) ||
                (isHipsometryChart && !activeSubTabText);
            const hasDepartmentOnlySelection =
                selectedDeptValue &&
                selectedDeptValue !== "0" &&
                selectedDeptValue !== "COL" &&
                !selectedMuniValue;
            const isDeptoHipsometryChart =
                isHipsometryUiChart &&
                (filtroNivel === "DEPTO" || hasDepartmentOnlySelection);
            const hasManyDeptoHipsometryRanges =
                isDeptoHipsometryChart &&
                totalLabels >= 18;

            if (isVertical) {
                // BARRAS VERTICALES
                config.options.indexAxis = 'x';
                config.options.maintainAspectRatio = false;
                if (supportsChartZoomPan()) {
                    config.options.plugins = config.options.plugins || {};
                    config.options.plugins.zoom = createChartZoomPanOptions("xy", totalLabels, {
                        categoryAxisId: "x",
                        valueAxisId: "y",
                        valueMax: chartValueMax
                    });
                }
                config.options.layout = {
                    padding: {
                        top: 8,
                        right: 10,
                        bottom: isSmallScreen ? 8 : 4,
                        left: 4
                    }
                };

                config.options.scales = {
                    x: {
                        stacked: isStacked,
                        title: {
                            display: !!axisTitles.xTitle,
                            text: axisTitles.xTitle,
                            padding: { top: 12 }
                        },
                        ticks: {
                            autoSkip: false,
                            maxTicksLimit: isVerySmallScreen ? 4 : isSmallScreen ? 5 : 8,
                            maxRotation: isSmallScreen ? 65 : 45,
                            minRotation: isSmallScreen ? 65 : 35,
                            padding: 6,
                            font: {
                                size: isVerySmallScreen ? 9 : isSmallScreen ? 10 : 11
                            }
                        },
                        grid: { display: false }
                    },
                    y: {
                        beginAtZero: true,
                        stacked: isStacked,
                        title: {
                            display: !!axisTitles.yTitle,
                            text: axisTitles.yTitle
                        },
                        suggestedMax: isPercentStacked ? 100 : undefined,
                        max: isPercentStacked ? 100 : undefined,
                        ticks: {
                            callback: (v) => formatPercentAxisTick(v, isPercentStacked),
                            font: {
                                size: isVerySmallScreen ? 9 : 10
                            }
                        }
                    }
                };
            } else {
                // BARRAS HORIZONTALES
                config.options.indexAxis = 'y';
                config.options.maintainAspectRatio = false;
                const isEcoChart =
                    layerConfig?.isEcosistema &&
                    layerConfig?.ecosistemaType === "ecosistemas";

                if (supportsChartZoomPan()) {
                    config.options.plugins = config.options.plugins || {};
                    config.options.plugins.zoom = createChartZoomPanOptions("xy", totalLabels, {
                        categoryAxisId: "y",
                        valueAxisId: "x",
                        valueMax: chartValueMax
                    });
                }
                config.options.layout = {
                    padding: {
                        top: 8,
                        right: 12,
                        bottom: 4,
                        left: 4
                    }
                };

                config.options.scales = {
                    x: {
                        beginAtZero: true,
                        stacked: isStacked,
                        min: isHipsometryChart ? 0 : undefined,
                        max: isHipsometryChart && chartValueMax > 0
                            ? Math.max(1, chartValueMax * 1.15)
                            : (isPercentStacked ? 100 : undefined),
                        title: {
                            display: !!axisTitles.xTitle,
                            text: axisTitles.xTitle
                        },
                        suggestedMax: isPercentStacked ? 100 : undefined,
                        ticks: {
                            callback: (v) => formatPercentAxisTick(v, isPercentStacked),
                            font: {
                                size: isVerySmallScreen ? 9 : 10
                            }
                        }
                    },
                    y: {
                        stacked: isStacked,
                        title: {
                            display: !isEcoChart && !!axisTitles.yTitle,
                            text: axisTitles.yTitle
                        },
                        ticks: {
                            display: true,
                            autoSkip: (isEcoChart || isHipsometryChart) ? false : true,
                            maxTicksLimit: (isEcoChart || isHipsometryChart) ? totalLabels : (
                                isVerySmallScreen
                                    ? 5
                                    : isSmallScreen
                                    ? (tooManyItemsMobile ? 6 : 8)
                                    : (tooManyItems ? 8 : 12)
                            ),
                            padding: hasManyDeptoHipsometryRanges ? 2 : 4,
                            callback: isEcoChart
                                ? createAdaptiveEcosystemYAxisLabeler(originalChartLabels.map(label => String(label ?? "")))
                                : getOriginalChartLabel,
                            font: {
                                size: hasManyDeptoHipsometryRanges
                                    ? (isVerySmallScreen ? 6 : isSmallScreen ? 7 : 8)
                                    : isEcoChart
                                    ? (isVerySmallScreen ? 7 : isSmallScreen ? 8 : 9)
                                    : (isVerySmallScreen ? 8 : isSmallScreen ? 9 : 10)
                            }
                        }
                    }
                };
            }

            // Ajuste dinÃ¡mico del alto del canvas segÃºn cantidad de datos
            const chartCanvas = document.getElementById("chart");
            if (chartCanvas) {
                const chartCard = chartCanvas.closest(".chart-card");
                if (!isVertical) {
                    const isEcoChart =
                        layerConfig?.isEcosistema &&
                        layerConfig?.ecosistemaType === "ecosistemas";
                    chartCard?.classList.toggle("chart-ecosistemas", isEcoChart);
                    if (!isEcoChart) chartCard?.classList.remove("chart-hipsometria-depto");

                    if (isEcoChart) {
                        const minHeight = isVerySmallScreen ? 300 : isSmallScreen ? 340 : 360;
                        const maxHeight = isVerySmallScreen ? 340 : isSmallScreen ? 380 : 420;
                        const extraPerItem = isVerySmallScreen ? 16 : isSmallScreen ? 18 : 20;
                        const dynamicHeight = Math.max(minHeight, 120 + (totalLabels * extraPerItem));
                        const boundedHeight = Math.min(maxHeight, dynamicHeight);
                        chartCard?.style.setProperty("--biofisico-chart-height", `${boundedHeight}px`);
                        chartCanvas.style.height = `${boundedHeight}px`;
                    } else if (isDeptoHipsometryChart) {
                        chartCard?.classList.add("chart-hipsometria-depto");
                        chartCard?.style.removeProperty("--biofisico-chart-height");
                        const manyRanges = totalLabels >= 13;
                        const baseHeight = isSmallScreen ? 330 : 300;
                        const extraHeight = manyRanges
                            ? Math.min(isSmallScreen ? 170 : 230, Math.max(0, (totalLabels - 12) * 10))
                            : 0;
                        chartCard?.style.setProperty("--biofisico-hipso-depto-height", `${baseHeight + extraHeight}px`);
                        chartCanvas.style.height = `${baseHeight + extraHeight}px`;
                    } else {
                        chartCard?.classList.remove("chart-hipsometria-depto");
                        chartCard?.style.removeProperty("--biofisico-chart-height");
                        chartCard?.style.removeProperty("--biofisico-hipso-depto-height");
                        const base = isSmallScreen ? 320 : 280;
                        const extraPerItem = isVerySmallScreen ? 26 : isSmallScreen ? 22 : 18;
                        const dynamicHeight = Math.max(base, 160 + (totalLabels * extraPerItem));
                        chartCanvas.style.height = `${dynamicHeight}px`;
                    }
                } else {
                    chartCanvas.closest(".chart-card")?.classList.remove("chart-ecosistemas", "chart-hipsometria-depto");
                    chartCanvas.closest(".chart-card")?.style.removeProperty("--biofisico-chart-height");
                    chartCanvas.closest(".chart-card")?.style.removeProperty("--biofisico-hipso-depto-height");
                    chartCanvas.style.height = isSmallScreen ? "360px" : "300px";
                }
            }
        } else if (type === 'line') {
            config.options.scales = {
            x: { title: { display: !!axisTitles.xTitle, text: axisTitles.xTitle } },
            y: { beginAtZero: true, title: { display: !!axisTitles.yTitle, text: axisTitles.yTitle || "%" } }
            };

            // Ajustes visuales (solo para el caso simple de 1 dataset)
            if (!datasets) {
            config.data.datasets[0].pointBackgroundColor = colors;
            config.data.datasets[0].pointBorderColor = "#fff";
            config.data.datasets[0].pointRadius = 6;
            config.data.datasets[0].pointHoverRadius = 8;
            config.data.datasets[0].borderColor = "#888";
            config.data.datasets[0].backgroundColor = "rgba(0,0,0,0)";
            config.data.datasets[0].tension = 0.4;
            }
        } else if (type === 'radar') {
            config.options.scales = {
            r: { min: 0, max: 5, ticks: { stepSize: 1, backdropColor: 'transparent' } }
            };
        }
        const prevOnClick = config.options.onClick;

        if (isGeoformasMultiSeries) {
            config.options.maintainAspectRatio = true;
            config.options.cutout = "38%";
            config.options.plugins.legend.display = false;
            config.plugins = [
                ...(config.plugins || []),
                {
                    id: "geoformasHtmlLegend",
                    afterUpdate(chart) {
                        renderGeoformasChartLegend(chart);
                    }
                }
            ];
        }

        config.options.onClick = async (evt, elements) => {
            const activeElements = elements?.length
                ? elements
                : (isGeoformasMultiSeries && chartInstance?.getElementsAtEventForMode
                    ? chartInstance.getElementsAtEventForMode(evt?.native || evt, "nearest", { intersect: true }, false)
                    : []);

            if (activeElements?.length) {
                const idx = activeElements[0].index;
                const clickedLabel = String(originalChartLabels?.[idx] ?? config.data.labels?.[idx] ?? "").trim();
                const clickedDataset = config.data.datasets?.[activeElements[0].datasetIndex];

                if (isGeoformasMultiSeries) {
                    const segment = clickedDataset?.__segments?.[idx];
                    if (segment && await selectGeoformasChartSegment(clickedDataset, segment)) return;
                }

                if (!isGeoformasMultiSeries && await setOnlyChartCategoryActive(clickedLabel, idx, clickedDataset)) {
                    return;
                }

                const cfg = getActiveLayerConfig();
            if (cfg?.id === "pendientes") {
                const code = pendientesLabelToCode[clickedLabel.toLowerCase()];

                if (code) {
                    const whereZoom = `(${whereBase || "1=1"}) AND categoria = ${code}`;

                    applyWhereToActiveLayers(whereZoom);
                    updateLegendByExtent?.(layerGlobal, cfg);

                    const extentLayer = layerGlobal;
                    if (extentLayer) {
                        cachedQueryExtent(extentLayer, { where: whereZoom }).then(res => {
                            if (res?.extent) view.goTo(res.extent.expand(1.3));
                        });
                    }

                    syncLegendToLabelSelection(clickedLabel);
                    return;
                }
            }
        }

        if (typeof prevOnClick === "function") {
            prevOnClick(evt, elements);
        }
        };

        const finalChartCanvas = document.getElementById("chart");
        const finalChartCard = finalChartCanvas?.closest(".chart-card");
        if (!isEcosistemasChart) {
            finalChartCard?.classList.remove("chart-ecosistemas");
            if (!isDepartmentOnlyHipsometryContext()) {
                finalChartCard?.classList.remove("chart-hipsometria-depto");
                finalChartCard?.style.removeProperty("--biofisico-hipso-depto-height");
            }
            finalChartCard?.style.removeProperty("--biofisico-chart-height");
        }

        ensureChartZoomPluginRegistered();
        chartInstance = new Chart(ctx, config);
        applyDepartmentHipsometryCanvasHeight();
        requestAnimationFrame(() => applyDepartmentHipsometryCanvasHeight());
        setTimeout(() => applyDepartmentHipsometryCanvasHeight(), 120);

        if (!isEcosistemasChart) {
            finalChartCard?.classList.remove("chart-ecosistemas");
            if (!isDepartmentOnlyHipsometryContext()) {
                finalChartCard?.classList.remove("chart-hipsometria-depto");
                finalChartCard?.style.removeProperty("--biofisico-hipso-depto-height");
            }
            finalChartCard?.style.removeProperty("--biofisico-chart-height");
            applyDepartmentHipsometryCanvasHeight();
        }

        if (isGeoformasMultiSeries) {
            chartInstance.__geoformasMultiSeries = true;
            chartInstance.__multiSeriesLegendTitles = layerConfig?.isSuelos && layerConfig?.suelosType === "vocacion"
                ? { inner: "Vocaciones", outer: "Usos principales" }
                : { inner: "Paisajes", outer: "Geoformas" };
            chartInstance.data.datasets.forEach(dataset => {
                dataset.__fullColors = Array.isArray(dataset.backgroundColor)
                    ? [...dataset.backgroundColor]
                    : dataset.backgroundColor;
                dataset.__fullBorderColors = Array.isArray(dataset.borderColor)
                    ? [...dataset.borderColor]
                    : dataset.borderColor;
                dataset.__fullData = Array.isArray(dataset.data)
                    ? dataset.data.map(value => Number(value) || 0)
                    : dataset.data;
            });

            window.__biofisicoApplyGeoformasChartFilter = (activeCodesInput) => {
                const activeCodes = activeCodesInput instanceof Set
                    ? activeCodesInput
                    : new Set(Array.isArray(activeCodesInput) ? activeCodesInput : []);

                const relieveDataset = chartInstance.data.datasets.find(dataset => dataset.__geoformasRing === "relieve");

                chartInstance.data.datasets.forEach(dataset => {
                    if (!Array.isArray(dataset.__segments)) return;

                    if (dataset.__geoformasRing === "paisaje") {
                        dataset.data = dataset.__segments.map((segment, index) => {
                            const relatedRelieves = (relieveDataset?.__segments || [])
                                .filter(relieve => String(relieve?.paisajeCode ?? "").trim() === String(segment?.code ?? "").trim());

                            if (relatedRelieves.length) {
                                return relatedRelieves.reduce((sum, relieve) => {
                                    return sum + (isGeoformasSegmentActive(relieve, "relieve", activeCodes)
                                        ? Number(relieve.value) || 0
                                        : 0);
                                }, 0);
                            }

                            return isGeoformasSegmentActive(segment, "paisaje", activeCodes)
                                ? Number(dataset.__fullData?.[index] ?? segment.value) || 0
                                : 0;
                        });
                    } else {
                        dataset.data = dataset.__segments.map((segment, index) => {
                            return isGeoformasSegmentActive(segment, "relieve", activeCodes)
                                ? Number(dataset.__fullData?.[index] ?? segment.value) || 0
                                : 0;
                        });
                    }

                    dataset.backgroundColor = Array.isArray(dataset.__fullColors)
                        ? [...dataset.__fullColors]
                        : dataset.__fullColors;

                    dataset.borderColor = Array.isArray(dataset.__fullBorderColors)
                        ? [...dataset.__fullBorderColors]
                        : dataset.__fullBorderColors;
                });

                chartInstance.update();
                renderGeoformasChartLegend(chartInstance);
            };

            clearGeoformasInternalLegends();
        } else {
            const datasetCategoryCodes = isStacked
                ? chartInstance.data.datasets.map(dataset =>
                    String(dataset.__biofisicoCode ?? dataset.gradeCode ?? dataset.rangeCode ?? dataset.code ?? dataset.label ?? "").trim()
                )
                : null;
            chartInstance.__biofisicoCategoryState = {
                isStacked,
                labels: isStacked
                    ? chartInstance.data.datasets.map(dataset => String(dataset.label ?? ""))
                    : originalChartLabels.map(label => String(label ?? "")),
                codes: isStacked
                    ? datasetCategoryCodes
                    : originalChartLabels.map((label, index) => getLegendCodeByLabel(label, index)),
                fullData: originalChartValues,
                fullColors: originalChartColors
            };
        }

        applyChartCategoryFilterFromLegend();
        if (isGeoformasMultiSeries) {
            window.__biofisicoApplyGeoformasChartFilter?.(window.__legendState?.activeCodes);
        }
        window.__biofisicoApplyOrdenSueloChartFilter?.(window.__legendState?.activeCodes);
        bindChartRestoreDoubleClick(chartInstance);
    }


    function actualizarTituloGrafico(config, mpnombre, dpnombre) {
        actualizarTituloGraficoRaw(config, mpnombre, dpnombre, {
            filtroNivel,
            deptoActual,
            municipioActual,
            diccionarioMunicipios,
            diccionarioDepartamentos
        });
    }

    function buildPaisajeDictFromRenderer(layer){
        const m = new Map();
        const r = layer?.renderer;
        if (!r || r.type !== "unique-value") return m;

        (r.uniqueValueInfos || []).forEach(info => {
            const v = String(info.value ?? "").trim();
            const label = String(info.label ?? v).trim();
            const col = getSymbolColorRGBA(info.symbol) || "#999"; //  AHORA SÃ

            if (v) m.set(v, { label, color: col });
            if (label) m.set(normKey(label), { label, color: col });
        });

        return m;
    }

    


    // =====================
    // LEYENDA POR EXTENT (solo lo visible)
    // =====================

    function getUniqueValueRendererFields(layer) {
        const renderer = layer?.renderer;
        const rendererJson = typeof renderer?.toJSON === "function" ? renderer.toJSON() : renderer;
        const type = String(renderer?.type || rendererJson?.type || "").toLowerCase();
        if (!renderer || (type !== "unique-value" && type !== "uniquevalue")) return [];

        return [
            renderer.field || renderer.field1 || rendererJson?.field || rendererJson?.field1,
            renderer.field2 || rendererJson?.field2,
            renderer.field3 || rendererJson?.field3
        ]
            .map(field => String(field ?? "").trim())
            .filter(Boolean);
    }

    function normalizeRendererParts(value, fields) {
        if (Array.isArray(value) && value.length === 1 && Array.isArray(value[0])) {
            return normalizeRendererParts(value[0], fields);
        }

        if (Array.isArray(value)) {
            return value.map(part => String(part ?? "").trim());
        }

        return String(value ?? "")
            .split(",")
            .slice(0, fields.length || undefined)
            .map(part => part.trim());
    }

    function getAttributeValue(attrs, field) {
        if (!attrs || !field) return "";
        if (Object.prototype.hasOwnProperty.call(attrs, field)) return attrs[field];

        const target = String(field).toLowerCase();
        const key = Object.keys(attrs).find(name => String(name).toLowerCase() === target);
        return key ? attrs[key] : "";
    }

    function normalizeRendererText(value) {
        return String(value ?? "")
            .trim()
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/\s+/g, " ");
    }

    function buildRendererCode(parts) {
        return (parts || [])
            .map(part => String(part ?? "").trim())
            .filter(Boolean)
            .join(";");
    }

    function getRendererCodeFromAttrs(layer, attrs) {
        const fields = getUniqueValueRendererFields(layer);
        if (!fields.length) return "";

        const parts = fields.map(field => String(getAttributeValue(attrs, field) ?? "").trim());
        if (parts.some(part => !part)) return "";
        return buildRendererCode(parts);
    }

    function getLayerRendererFallbackColor(layer) {
        const renderer = layer?.renderer;
        const rendererJson = typeof renderer?.toJSON === "function" ? renderer.toJSON() : renderer;
        const fromSymbol = symbol => getSymbolColorRGBA(symbol) || null;

        if (renderer?.type === "simple") return fromSymbol(renderer.symbol);

        const uniqueValueInfos = renderer?.uniqueValueInfos || rendererJson?.uniqueValueInfos || [];
        const uniqueValueGroups = renderer?.uniqueValueGroups || rendererJson?.uniqueValueGroups || [];

        const firstInfo = uniqueValueInfos.find(info => fromSymbol(info.symbol));
        if (firstInfo) return fromSymbol(firstInfo.symbol);

        for (const group of uniqueValueGroups) {
            const cls = (group.classes || []).find(item => fromSymbol(item.symbol));
            if (cls) return fromSymbol(cls.symbol);
        }

        return null;
    }

    function getRendererClassEntries(layer) {
        const renderer = layer?.renderer;
        const rendererJson = typeof renderer?.toJSON === "function" ? renderer.toJSON() : renderer;
        const type = String(renderer?.type || rendererJson?.type || "").toLowerCase();
        if (!renderer || (type !== "unique-value" && type !== "uniquevalue")) return [];

        const entries = [];
        const fields = getUniqueValueRendererFields(layer);

        const uniqueValueInfos = renderer.uniqueValueInfos || rendererJson?.uniqueValueInfos || [];
        const uniqueValueGroups = renderer.uniqueValueGroups || rendererJson?.uniqueValueGroups || [];

        uniqueValueInfos.forEach(info => {
            const parts = normalizeRendererParts(info.value ?? "", fields);
            entries.push({
                parts,
                code: buildRendererCode(parts),
                label: info.label || parts.join(","),
                color: getSymbolColorRGBA(info.symbol) || getLayerRendererFallbackColor(layer)
            });
        });

        uniqueValueGroups.forEach(group => {
            (group.classes || []).forEach(cls => {
                const rawValues = Array.isArray(cls?.values) && cls.values.length
                    ? cls.values
                    : [cls?.value || []];

                rawValues.forEach(raw => {
                    const parts = normalizeRendererParts(raw, fields);
                    entries.push({
                        parts,
                        code: buildRendererCode(parts),
                        label: cls.label || cls.description || parts.join(","),
                        color: getSymbolColorRGBA(cls.symbol) || getLayerRendererFallbackColor(layer)
                    });
                });
            });
        });

        return entries.filter(entry => entry.code);
    }

    function getRendererEntryFromAttrs(layer, attrs) {
        const fields = getUniqueValueRendererFields(layer);
        if (!fields.length) return null;

        const attrParts = fields.map(field => String(getAttributeValue(attrs, field) ?? "").trim());
        if (attrParts.some(part => !part)) return null;
        const attrCode = buildRendererCode(attrParts);
        const attrCodeNorm = normalizeRendererText(attrCode);

        const entries = getRendererClassEntries(layer);

        return entries.find(entry => entry.code === attrCode) ||
            entries.find(entry => normalizeRendererText(entry.code) === attrCodeNorm) ||
            entries.find(entry =>
                entry.parts.length === attrParts.length &&
                entry.parts.every((part, index) => normalizeRendererText(part) === normalizeRendererText(attrParts[index]))
            ) ||
            entries.find(entry => {
                const lastAttr = attrParts[attrParts.length - 1];
                return lastAttr && entry.parts.some(part => normalizeRendererText(part) === normalizeRendererText(lastAttr));
            }) ||
            entries.find(entry => {
                const label = normalizeRendererText(entry.label);
                return attrParts.some(part => {
                    const normalized = normalizeRendererText(part);
                    return normalized && label.includes(normalized);
                });
            }) ||
            null;
    }

    // 1) Decide quÃ© campos necesita la query segÃºn la capa activa
    function getLegendOutFields(config, layer) {
        if (config.isDeptoRiskCount) return [];
        if (config.isBF3) return ["paisaje"];
        if (!config) return ["*"];

        // Radar -> leyenda fija
        if (config.isRadar) return [];

        // Geoformas
        if (config.isGeoforma) return ["paisaje", "trelieve", config.valueField || "porcentaje"].filter(Boolean);

        // Clima
        if (config.isClima) {
            if (config.climaType === "clima_tipo") return [config.labelField, config.valueField || "porcentaje"].filter(Boolean); // clima
            // temp/precip/temp_cc/precip_cc -> labelField
            return [config.labelField, config.valueField || "porcentaje"].filter(Boolean);
        }

        // Hidro
        if (config.isHidro) {
            if (config.hidroType === "cuencas") {
                const rendererFields = getUniqueValueRendererFields(layer);
                return [
                    ...(rendererFields.length ? rendererFields : ["szhid", "areahidro", "zonahid"]),
                    config.valueField || "porcentaje"
                ].filter(Boolean);
            }
            return [config.labelField, config.valueField || "porcentaje"].filter(Boolean); // escorrentia
        }

        // Ecosistemas
        if (config.isEcosistema) {
            const url = String(layer?.url || "");
            const rendererFields = getUniqueValueRendererFields(layer);
            // capa 25 => condicion
            if (config.ecosistemaType === "ecosistemas" && url.endsWith("/25")) {
                return [
                    ...(rendererFields.length ? rendererFields : ["condicion"]),
                    config.valueField || "porcentaje"
                ].filter(Boolean);
            }
            // capa 26 => ecosgen
            if (config.ecosistemaType === "ecosistemas") {
                return [
                    ...(rendererFields.length ? rendererFields : ["condicion", "ecosgen"]),
                    config.valueField || "porcentaje"
                ].filter(Boolean);
            }
            // deforestacion => cambiobosque
            return [config.labelField, config.valueField || "porcentaje"].filter(Boolean);
        }

        // Suelos
        if (config.isSuelos) {
        if (config.suelosType === "vocacion") return ["vocacion", "usopvoc", config.valueField || "porcentaje"].filter(Boolean);
        if (config.suelosType === "orden") return ["ordsuelo", config.valueField || "porcentaje"].filter(Boolean);  
        return [config.labelField, config.valueField || "porcentaje"].filter(Boolean); // conflictos
        }

        // FenÃ³menos
        if (config.isFenomenos && config.fenomenosType === "degradacion") {
            return ["gradodeg", config.labelField, config.valueField || "porcentaje"].filter(Boolean);
        }
        if (config.isFenomenos) return [config.labelField, config.valueField || "porcentaje"].filter(Boolean);

        // Default (HipsometrÃ­a etc)
        return [config.labelField, config.valueField || "porcentaje"].filter(Boolean);
        }

        // 2) Mapea atributos => {label,color} segÃºn tu lÃ³gica/diccionarios
    function buildLegendEntryFromAttrs(config, attrs, layer) {
        if (!config || !attrs) return null;

        if (config.id === "pendientes") {
            const field = config.labelField || "categoria";
            const code = String(attrs[field] ?? "").trim();
            if (!code) return null;

            const info = coloresPendientes?.[code] || coloresPendientes?.[Number(code)];
            return {
                label: info?.label || code,
                color: info?.color || "#999",
                code
            };
        }

        // Orden del suelo: usar renderer dict (label+color)
        if (config?.isSuelos && config.suelosType === "orden") {
            const field = config.labelField || "ordsuelo";
            const code = String(attrs[field] ?? attrs.ordsuelo ?? "").trim(); // 15001...
            if (!code) return null;

            // 1) primero intenta tu diccionario de colores (coloresBiofisico.js)
            let info = (coloresOrdenSuelo && coloresOrdenSuelo[code]) ? coloresOrdenSuelo[code] : null;

            // 2) si no estÃ¡, cae al renderer real de la capa (labels+colores oficiales)
            if (!info && typeof buildDictFromUniqueValueRenderer === "function") {
                const dict = buildDictFromUniqueValueRenderer(layer);
                info = dict.get(code) || null;
            }

            return {
                label: info?.label || code,
                color: info?.color || "#999",
                code
            };
        }

        // Radar
        if (config.isRadar) {
            return {
                fixed: true,
                labels: LEYENDA_RIESGO_CC.map(i => i.label),
                colors: LEYENDA_RIESGO_CC.map(i => i.color),
                codes: LEYENDA_RIESGO_CC.map((_item, index) => String(index))
            };
        }

        if (config.isBF3) {
            const code = String(attrs.paisaje ?? "");
            const dict = buildPaisajeDictFromRenderer(layer);
            const info = dict.get(code);
            return { label: info?.label || code, color: info?.color || "#999", code };
        }
        // Geoformas: key = "paisaje,trelieve"
        if (config.isGeoforma) {
            const p = String(attrs.paisaje ?? "").trim();
            const t = String(attrs.trelieve ?? "").trim();
            if (!p || !t) return null;

            const key = `${p},${t}`;
            const pair = geoformasRendererDict?.[`${p}||${t}`];
            const info = coloresGeoformas?.[key];
            const paisajeLabel = pair?.paisajeLabel || String(info?.label || "").split(",")[0]?.trim() || p;
            const relieveLabel = pair?.relieveLabel || String(info?.label || "").split(",")[1]?.trim() || t;
            const label = pair
                ? `${paisajeLabel} - ${relieveLabel}`
                : (info?.label ? String(info.label).replace(/\s*,\s*/, " - ") : `${p} - ${t}`);

            return {
            label,
            color: pair?.color || info?.color || "#999",
            code: key
            };
        }

        // Clima
        if (config.isClima) {
            const code = String(attrs[config.labelField] ?? "");

            if (config.climaType === "clima_tipo") {
            const info = coloresClimas?.[code];
            return { label: info?.label || code, color: info?.color || "#999", code };
            }

            let dict = {};
            if (config.climaType === "temp") dict = coloresTemperatura;
            if (config.climaType === "precip") dict = coloresPrecipitacion;
            if (config.climaType === "temp_cc") dict = coloresCambioTemp;
            if (config.climaType === "precip_cc") dict = coloresCambioPrecip;

            const info = dict?.[code];
            return { label: info?.label || code, color: info?.color || "#999", code };
        }

        // HidrografÃ­a
        if (config.isHidro) {
            if (config.hidroType === "cuencas") {
            const rendererEntry = getRendererEntryFromAttrs(layer, attrs);
            const rendererFields = getUniqueValueRendererFields(layer);
            const rendererFieldValues = rendererFields
                .map(field => String(getAttributeValue(attrs, field) ?? "").trim())
                .filter(Boolean);
            const fallbackCode = String(
                (rendererFieldValues.length === rendererFields.length && rendererFieldValues.length
                    ? rendererFieldValues.join(",")
                    : (
                        getAttributeValue(attrs, "szhid") ||
                        getAttributeValue(attrs, "zonahid") ||
                        getAttributeValue(attrs, "areahidro")
                    )) ||
                ""
            ).trim();
            return {
                label: rendererEntry?.label || fallbackCode || "Sin categorÃ­a",
                color: rendererEntry?.color || getLayerRendererFallbackColor(layer) || "#5f7fec",
                code: rendererEntry?.code || fallbackCode
            };
            }

            // escorrentÃ­a
            const code = String(attrs[config.labelField] ?? "");
            const info = coloresEscorrentia?.[code];
            return { label: info?.label || code, color: info?.color || "#999", code };
        }

        // Ecosistemas
        if (config.isEcosistema) {
            if (config.ecosistemaType === "deforestacion") {
            const code = String(attrs[config.labelField] ?? "");
            const info = coloresDeforestacion?.[code];
            return { label: info?.label || code, color: info?.color || "#999", code };
            }

            // ecosistemas: depende de si es /25 o /26
            const url = String(layer?.url || "");
            const rendererEntry = getRendererEntryFromAttrs(layer, attrs);
            const rendererCode = getRendererCodeFromAttrs(layer, attrs);
            if (rendererEntry) {
                return {
                    label: rendererEntry.label,
                    color: rendererEntry.color || "#999",
                    code: rendererCode || rendererEntry.code
                };
            }

            if (config.ecosistemaType === "ecosistemas" && url.endsWith("/25")) {
            const cond = attrs.condicion;
            const info = coloresCondicionEcos?.[cond];
            return { label: info?.label || String(cond ?? ""), color: info?.color || "#999", code: rendererCode || String(cond ?? "") };
            } else {
            const key = String(attrs.ecosgen ?? "");
            const info = coloresEcosistemas?.[key];
            // si no existe en dict, lo mostramos igual
            return { label: info?.label || key, color: info?.color || "#888", code: rendererCode || key };
            }
        }

        // Suelos
        if (config.isSuelos) {
            if (config.suelosType === "vocacion") {
            const v = String(attrs.vocacion ?? "").trim();
            const u = String(attrs.usopvoc ?? "").trim();
            if (!v || !u) return null;

            const key = `${v},${u}`;
            const pair = vocacionRendererDict?.[`${v}||${u}`];
            const info = coloresVocacion?.[key];
            const vocacionLabel = pair?.vocacionLabel || vocacionMainDict?.[v]?.label || String(info?.label || "").split(",")[0]?.trim() || v;
            const usoLabel = pair?.usoLabel || String(info?.label || "").split(",")[1]?.trim() || u;

            return {
                label: `${vocacionLabel} - ${usoLabel}`,
                color: pair?.color || info?.color || "#999",
                code: key
            };
            } else {
            const code = String(attrs[config.labelField] ?? "");
            const info = coloresConflictos?.[code];
            return { label: info?.label || code, color: info?.color || "#999", code };
            }
        }

        // FenÃ³menos
        if (config.isFenomenos) {
            let code = "";

            if (config.fenomenosType === "degradacion") {
                code = String(attrs.gradodeg ?? attrs[config.labelField] ?? "").trim();
            } else {
                code = String(attrs[config.labelField] ?? "").trim();
            }

            let dict = {};
            if (config.fenomenosType === "inundaciones") dict = coloresInundaciones;
            if (config.fenomenosType === "remocion") dict = coloresRemocion;
            if (config.fenomenosType === "degradacion") dict = coloresDegradacion;
            if (config.fenomenosType === "sismica") dict = coloresSismica;

            const info = dict?.[code];
            return { label: info?.label || code, color: info?.color || "#999", code };
        }

        // Default (hipsometrÃ­a y otros simples)
        const code = String(attrs[config.labelField] ?? "");

        // hipsometrÃ­a municipal y departamental (deptoAgg)
        if (config.id === "hipsometria" || config.id === "hipsometria_depto" || config.isDeptoAgg) {
            const info = coloresHipsometricos?.[code];
            return { label: info?.label || code, color: info?.color || "#999", code };
        }

        // si no sabes quÃ© dict usar, deja label=code
        return { label: code, color: "#999", code };
        }

        function parseLegendNumber(value) {
        if (typeof value === "number") return Number.isFinite(value) ? value : 0;
        const normalized = String(value ?? "")
            .trim()
            .replace(/\s/g, "")
            .replace(/%$/g, "")
            .replace(",", ".");
        const parsed = Number(normalized);
        return Number.isFinite(parsed) ? parsed : 0;
        }

        function getLegendEntryValue(config, attrs) {
        if (!config || !attrs) return 0;

        const candidates = [
            config.valueField,
            "porcentaje",
            "sum_pct",
            "pct",
            "__pct",
            "sum_area",
            "area",
            "areat",
            "mparea",
            "st_area(shape)"
        ].filter(Boolean);

        for (const field of candidates) {
            if (Object.prototype.hasOwnProperty.call(attrs, field)) {
                const value = parseLegendNumber(attrs[field]);
                if (Number.isFinite(value)) return value;
            }
        }

        return config.valueField ? 0 : 1;
        }

        async function buildLegendEntriesFromVisibleFeatures(layer, config) {
        const q = layer.createQuery();
        q.where = layer.definitionExpression || whereBase || "1=1";
        q.geometry = view.extent;
        q.spatialRelationship = "intersects";
        q.returnGeometry = false;
        q.outFields = getLegendOutFields(config, layer);

        const res = await cachedQueryFeatures(layer, q);
        const byCode = new Map();

        for (const feature of res?.features || []) {
            const attrs = feature.attributes || {};
            const entry = buildLegendEntryFromAttrs(config, attrs, layer);
            if (!entry || entry.fixed) continue;

            const code = String(entry.code ?? entry.rawCode ?? entry.value ?? entry.label ?? "").trim();
            const label = String(entry.label ?? "").trim();
            const value = getLegendEntryValue(config, attrs);

            if (!code || !label || !Number.isFinite(value) || value <= 0) continue;

            const current = byCode.get(code);
            if (current) {
                current.value += value;
            } else {
                byCode.set(code, {
                    code,
                    label,
                    color: entry.color || "#999",
                    value
                });
            }
        }

        return Array.from(byCode.values())
            .filter(item => Number(item.value) > 0)
            .sort((a, b) => String(a.label).localeCompare(String(b.label), "es"));
        }

        // 3) Ordena labels de manera â€œbonitaâ€ por tipo de capa
        
        // 4) Debounce + anti-race (para que no se mezclen respuestas viejas)
        let __legendReqId = 0;
        updateLegendByExtent = debounce(async (layer, config) => {
        const reqId = ++__legendReqId;

        try {
            if (!layer || layer.destroyed) return;
            if (!view || !view.extent) return;
            if (!config) return;

            // evita correr sobre una capa vieja
            if (layerGlobal && layer !== layerGlobal && !layersGlobal.includes(layer)) {
                return;
            }

            if (config.isGeoforma && config.isGeoformaDualChart) {
                const entries = await buildLegendEntriesFromVisibleFeatures(layer, config);

                actualizarLeyenda(
                    entries.map(entry => entry.label),
                    entries.map(entry => entry.color),
                    entries.map(entry => entry.code)
                );
                return;
            }

            if (config.isFenomenos && config.fenomenosType === "degradacion") {
                const entries = await buildLegendEntriesFromVisibleFeatures(layer, config);
                const ordered = entries.sort(
                    (a, b) => (ORDEN_DEGRADACION[a.label] ?? 999) - (ORDEN_DEGRADACION[b.label] ?? 999)
                );

                actualizarLeyenda(
                    ordered.map(entry => entry.label),
                    ordered.map(entry => entry.color),
                    ordered.map(entry => entry.code)
                );
                return;
            }

            if (config.isRadar || config.isDeptoRiskCount) {
                actualizarLeyenda(
                    LEYENDA_RIESGO_CC.map(i => i.label),
                    LEYENDA_RIESGO_CC.map(i => i.color),
                    LEYENDA_RIESGO_CC.map((_item, index) => String(index))
                );
                return;
            }

            if (config.id === "pendientes" && config.isPendientesPolar) {
                const entries = await buildLegendEntriesFromVisibleFeatures(layer, config);

                actualizarLeyenda(
                    entries.map(item => item.label),
                    entries.map(item => item.color),
                    entries.map(item => item.code)
                );
                return;
            }

            if (config.isSuelos && config.suelosType === "orden") {
                const entries = await buildLegendEntriesFromVisibleFeatures(layer, config);

                actualizarLeyenda(
                    entries.map(entry => entry.label),
                    entries.map(entry => entry.color),
                    entries.map(entry => entry.code)
                );
                return;
            }

            const q = layer.createQuery();
            q.where = layer.definitionExpression || whereBase || "1=1";
            q.geometry = view.extent;
            q.spatialRelationship = "intersects";
            q.returnGeometry = false;
            q.outFields = getLegendOutFields(config, layer);

            if (!layer || layer.destroyed) return;

            const res = await cachedQueryFeatures(layer, q);

            if (reqId !== __legendReqId) return;
            if (!layer || layer.destroyed) return;
            if (!res || !Array.isArray(res.features)) return;

            if (!res.features.length) {
                actualizarLeyenda([], []);
                return;
            }

            const byLabel = new Map();

            for (const f of res.features) {
                const attrs = f.attributes || {};
                const entry = buildLegendEntryFromAttrs(config, attrs, layer);

                if (!entry || entry.fixed) continue;

                const value = getLegendEntryValue(config, attrs);
                if (!Number.isFinite(value) || value <= 0) continue;

                if (entry.label && !byLabel.has(entry.label)) {
                    byLabel.set(entry.label, {
                        label: entry.label,
                        color: entry.color || "#999",
                        code: entry.code ?? entry.rawCode ?? entry.value ?? entry.label
                    });
                }
            }

            const entries = Array.from(byLabel.values());
            const ordered = sortLegendEntries(config, entries);

            actualizarLeyenda(
                ordered.map(e => e.label),
                ordered.map(e => e.color),
                ordered.map(e => String(e.code ?? e.label))
            );

        } catch (e) {
            const msg = String(e?.message || "").toLowerCase();
            const name = String(e?.name || "").toLowerCase();

            if (
                name === "aborterror" ||
                msg.includes("aborted") ||
                msg.includes("instance of 'esri.layers.featurelayer' is already destroyed") ||
                msg.includes("instance-destroyed") ||
                name.includes("instance-destroyed") ||
                msg.includes("load:instance-destroyed") ||
                msg.includes("featureresult")
            ) {
                return;
            }

            console.error("updateLegendByExtent error:", e);
        }
    }, 150);
    // window.updateLegendByExtent = updateLegendByExtent;
    // updateLegendByExtent(layerGlobal, config);
    // const __cfg0 = getActiveLayerConfig();
    // if (__cfg0 && layerGlobal) updateLegendByExtent(layerGlobal, __cfg0);


    function pickExistingField(layer, candidates) {
        const fields = (layer?.fields || []).map(f => String(f.name).toLowerCase());
        for (const c of candidates) {
            if (fields.includes(String(c).toLowerCase())) return c;
        }
        return null;
    }
    /* =======================
    HELPERS
    ======================= */
    

    function pickVariantByScale(config, scale) {
        if (!config?.variants?.length) return null;
        return config.variants.find(v => scale <= v.minScale && scale > v.maxScale) || config.variants[config.variants.length - 1];
    }
    function getDeptoCuencasGroupField(config, layer) {
        // si no hay mapping, cae a lo que tengas por defecto
        const map = config?.cuencasAgg?.groupByLayerId || {};
        const lid = layer?.layerId; // 19,20,21
        return map[lid] || config?.cuencasAgg?.groupField || "zonahid";
    }

    const chartControllerContext = {
        get currentMode() { return currentMode; },
        set currentMode(value) { currentMode = value; },
        get currentSubLayerIndex() { return currentSubLayerIndex; },
        set currentSubLayerIndex(value) { currentSubLayerIndex = Number(value) || 0; },
        get layerGlobal() { return layerGlobal; },
        set layerGlobal(value) { layerGlobal = value; },
        get layersGlobal() { return layersGlobal; },
        set layersGlobal(value) { layersGlobal = Array.isArray(value) ? value : []; },
        get filtroNivel() { return filtroNivel; },
        set filtroNivel(value) { filtroNivel = value; },
        get whereBase() { return whereBase; },
        set whereBase(value) { whereBase = value; },
        get deptoActual() { return deptoActual; },
        set deptoActual(value) { deptoActual = value; },
        get municipioActual() { return municipioActual; },
        set municipioActual(value) { municipioActual = value; },
        get diccionarioDepartamentos() { return diccionarioDepartamentos; },
        set diccionarioDepartamentos(value) { diccionarioDepartamentos = value || {}; },
        get diccionarioMunicipios() { return diccionarioMunicipios; },
        set diccionarioMunicipios(value) { diccionarioMunicipios = value || {}; },
        get renderCycleId() { return renderCycleId; },
        set renderCycleId(value) { renderCycleId = value; },
        get bf3LabelToCode() { return bf3LabelToCode; },
        set bf3LabelToCode(value) { bf3LabelToCode = value; },
        get timeSliderIndex() { return timeSliderIndex; },
        set timeSliderIndex(value) { timeSliderIndex = value; }
    };

    function buildCuencasDictFromRenderer(layerJson) {
        const infos = layerJson?.drawingInfo?.renderer?.uniqueValueInfos || [];
        const map = new Map();

        infos.forEach(info => {
            const value = String(info.value); // ejemplo: "11001,11102"
            const label = String(info.label || value);

            const c = info?.symbol?.color || [150,150,150,255];
            const rgba = `rgba(${c[0]},${c[1]},${c[2]},${(c[3] ?? 255)/255})`;

            map.set(value, { label, color: rgba });
        });

        return map;
    }

    const chartController = createChartController({
        ctx: chartControllerContext,
        arcRestQuery,
        cachedQueryFeatures,
        cachedQueryExtent,
        crearGrafica,
        destroyChartInstance,
        actualizarLeyenda,
        actualizarTituloGrafico,
        crearGraficasGeoformasDual,
        crearGraficasVocacionDual,
        toggleGeoformasCharts,
        destroyGeoformasCharts,
        buildPaisajeDictFromRenderer,
        cargarCapaActual,
        applyWhereToActiveLayers,
        applyLegendFilter,
        updateLegendByExtent,
        getView: () => view,
        getChartInstance: () => chartInstance,
        setChartInstance: value => { chartInstance = value; },
        setOnlyCategoryCodeActive,
        restoreAllChartCategories,
        getTimeSliderIndex: () => timeSliderIndex,
        getTimeSliderTouched: () => timeSliderTouched,
        getTimeSliderPeriods: () => timeSliderPeriods,
        hideTimeSlider,
        showTimeSlider,
        pctOfTotal,
        toNum,
        wrapLabel,
        ordenarMeses,
        fetchBF3Stats,
        fetchGroupedStats,
        getSymbolColorRGBA,
        buildLegendFromRenderer,
        ensureNonEmptyOrExit,
        pickExistingField,
        buildDictFromUniqueValueRenderer,
        crearGraficaBubbleOrdenSuelo,
        getGeoformasRendererDict: () => geoformasRendererDict,
        getPaisajeColor,
        getGeoformaColor,
        normKey,
        getColoresOrdenSuelo: () => coloresOrdenSuelo,
        getDeforestacionPeriodoActivo: () => deforestacionPeriodoActivo,
        getDeforestacionPeriodosBase: () => deforestacionPeriodosBase,
        setDeforestacionPeriodosBase: (value) => { deforestacionPeriodosBase = value; },
        measureBiofisicoAsync,
        recordBiofisicoMetric
    });

    const { actualizarGrafica } = chartController;
    window.actualizarGrafica = actualizarGrafica;

    mapRenderContext = createMapRenderContext({
        FeatureLayer,
        map,
        view,
        getActiveLayerConfig,
        getRenderCycleId: () => renderCycleId,
        setRenderCycleId: value => { renderCycleId = value; },
        clearLayers,
        getWhereBase: () => whereBase,
        getCurrentMode: () => currentMode,
        getFiltroNivel: () => filtroNivel,
        getMunicipioActual: () => municipioActual,
        getDeptoActual: () => deptoActual,
        getLayerGlobal: () => layerGlobal,
        getLayersGlobal: () => layersGlobal,
        getChartLayerGlobal: () => chartLayerGlobal,
        setLayerGlobal: value => { layerGlobal = value; },
        setLayerViewGlobal: value => { layerViewGlobal = value; },
        setLayersGlobal: value => { layersGlobal = value; },
        getScaleHandle: () => scaleHandle,
        setScaleHandle: value => { scaleHandle = value; },
        buildDefinitionExpression,
        pickLayerByScale,
        getGeoformasScaleTitle,
        setLegendLayer,
        setActiveVariantLayerByScale,
        syncStateFromGlobals,
        debounce,
        updateLegendByExtent,
        buildLegendFromRenderer,
        actualizarLeyenda,
        actualizarResumen,
        actualizarGrafica,
        actualizarFuente,
        highlightRiesgoCcMunicipio,
        ensureStationsLayer,
        ensureGeoformasDict,
        ensureOrdenSueloDict,
        cachedQueryExtent,
        cachedQueryFeatures,
        recordBiofisicoMetric
    });

    function applyWhereToActiveLayers(where) {
        // si estÃ¡s en cuencas (3 capas), aplica a todas
        if (layersGlobal.length) {
            layersGlobal.forEach(l => l.definitionExpression = where);
            return;
        }
        if (layerGlobal) layerGlobal.definitionExpression = where;
    }

    function clearHighlight() {
        if (highlightHandle) {
            highlightHandle.remove();
            highlightHandle = null;
        }
        lastHoverWhere = "";
        }

        async function ensureLayerView(layer) {
        if (!layer || !view) return null;
        return await view.whenLayerView(layer);
        }

        async function highlightWhere(where) {
        if (!layerGlobal || !where) return;

        // evita repetir lo mismo 100 veces por el hover
        if (where === lastHoverWhere) return;
        lastHoverWhere = where;

        clearHighlight();

        try {
            const lv = await ensureLayerView(layerGlobal);
            if (!lv) return;

            // OJO: queryObjectIds es barato y sirve perfecto para highlight
            const oids = await layerGlobal.queryObjectIds({ where });
            if (!oids || !oids.length) return;

            highlightHandle = lv.highlight(oids);
        } catch (e) {
            console.error("highlightWhere error:", e);
        }
        }

        // Debounce sencillo para hover (para que no consulte cada pixel)
        const highlightWhereDebounced = (() => {
        let t = null;
        return (where) => {
            clearTimeout(t);
            t = setTimeout(() => highlightWhere(where), hoverDebounceMs);
        };
    })();

    const attrFilters = createAttributeFilters({
        getActiveLayerConfig,
        getWhereBase: () => whereBase,
        getLayerGlobal: () => layerGlobal,
        getView: () => view,
        getBf3LabelToCode: () => bf3LabelToCode,
        applyWhereToActiveLayers,
        syncLegendToLabelSelection,
        cachedQueryExtent,
        sqlEquals,
        andWhere,
        coloresGeoformas: (typeof coloresGeoformas !== "undefined" ? coloresGeoformas : {}),
        coloresTemperatura: (typeof coloresTemperatura !== "undefined" ? coloresTemperatura : window.coloresTemperatura || {}),
        coloresPrecipitacion: (typeof coloresPrecipitacion !== "undefined" ? coloresPrecipitacion : window.coloresPrecipitacion || {}),
        coloresClimas: (typeof coloresClimas !== "undefined" ? coloresClimas : window.coloresClimas || {}),
        coloresCambioTemp: (typeof coloresCambioTemp !== "undefined" ? coloresCambioTemp : window.coloresCambioTemp || {}),
        coloresCambioPrecip: (typeof coloresCambioPrecip !== "undefined" ? coloresCambioPrecip : window.coloresCambioPrecip || {}),
        coloresEscorrentia: (typeof coloresEscorrentia !== "undefined" ? coloresEscorrentia : window.coloresEscorrentia || {}),
        coloresEcosistemas: (typeof coloresEcosistemas !== "undefined" ? coloresEcosistemas : window.coloresEcosistemas || {}),
        coloresVocacion: (typeof coloresVocacion !== "undefined" ? coloresVocacion : window.coloresVocacion || {}),
        coloresConflictos: (typeof coloresConflictos !== "undefined" ? coloresConflictos : window.coloresConflictos || {}),
        coloresInundaciones: (typeof coloresInundaciones !== "undefined" ? coloresInundaciones : window.coloresInundaciones || {}),
        coloresRemocion: (typeof coloresRemocion !== "undefined" ? coloresRemocion : window.coloresRemocion || {}),
        coloresDegradacion: (typeof coloresDegradacion !== "undefined" ? coloresDegradacion : window.coloresDegradacion || {}),
        coloresSismica: (typeof coloresSismica !== "undefined" ? coloresSismica : window.coloresSismica || {}),
        coloresHipsometricos: (typeof coloresHipsometricos !== "undefined" ? coloresHipsometricos : window.coloresHipsometricos || {})
    });
    var { filtrarPorRangoPeriodo, filtrarPorRangoCodigo, filtrarPorAtributo } = attrFilters;

    bindViewAllButton({
        onViewAll: () => handleViewAllClick(createBiofisicoControllerApi())
    });

    function activateBiofisicoTabFromUrl(tabUrl) {
        if (!tabUrl) return;
        handleBiofisicoDropdownTarget(String(tabUrl));
    }

    const urlContext = globalThis.ModuleNavigation?.parseComponentUrlParams?.() || {
        tab: null,
        municipioId: "",
        deptoId: ""
    };

    globalThis.ModuleNavigation?.applyTerritorySelectionFromUrl?.({
        onTab(tabUrl) {
            if (!urlContext.municipioId && !urlContext.deptoId) {
                activateBiofisicoTabFromUrl(tabUrl);
            }
        },
        onApplied({ tab }) {
            if (tab) {
                activateBiofisicoTabFromUrl(tab);
            }
        },
        prepareTerritorySelection({ municipioId, deptoId, selectDepto, selectMuni }) {
            if (deptoId && selectDepto?.querySelector(`option[value="${deptoId}"]`)) {
                renderizarMunicipios(deptoId);
                return;
            }

            if (municipioId && !selectMuni?.querySelector(`option[value="${municipioId}"]`)) {
                renderizarMunicipios();
            }
        }
    });

    window.redirigir = function (e) {
        e.preventDefault();
        const link = e.currentTarget;
        const href = link.getAttribute("href");
        const territory = globalThis.ModuleNavigation?.getTerritoryFromSelects?.(
            document.getElementById("departamentos"),
            document.getElementById("municipios")
        ) || { municipioId: "", deptoId: "" };

        window.location.href = globalThis.ModuleNavigation?.mergeHrefWithTerritory?.(href, territory) || href;
    };

    init();

});
