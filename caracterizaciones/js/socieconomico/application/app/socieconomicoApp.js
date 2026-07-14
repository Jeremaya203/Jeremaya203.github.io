import {
    LAYERS_CONFIG,
} from "../config.js?v=livestock-summary-textsource-20260604";
import { INFRAESTRUCTURA_COMPLEMENTARIA_BAR_CHART_CONFIG } from "../charts/configs/infraestructuraChartsConfig.js?v=popup-department-exception-20260604";
import { PUBLIC_SERVICES_RADAR_CHART_CONFIG } from "../charts/configs/condicionesChartsConfig.js?v=global-municipality-required-state-20260604";

import {
    createIgacSatelitalTopo,
    initBasemapGallery,
    bindBasemapPanelToggle
} from "../map/basemap.js";

import {
    getLayerListForCurrentLevel as getLayerListForCurrentLevelBase,
    clampSubLayerIndex as clampSubLayerIndexBase,
    ensureMunicipalLayerIndex as ensureMunicipalLayerIndexBase,
    getActiveLayerConfig as getActiveLayerConfigBase
} from "../map/layers.js";

import {
    bindZoomButtons,
    bindMapActionButtons,
    bindOverviewToggle
} from "../ui/mapControls.js";

import { buildFilteredLegendFromLayers, buildLegendFromRenderer } from "../ui/legend/legendRendererService.js?v=health-legend-dedupe-20260602";
import { getRendererLegendItems, getRendererVisualForValue } from "../charts/core/chartSymbolUtils.js?v=fluvial-colors-20260515";
import { createMunicipalDataController } from "../services/municipalData.js?v=component-nav-socio-20260626";
import { socioeconomicoLayerUrl } from "../services/serviceRoots.js?v=sigi-service-roots-20260604";
import { createSummaryController } from "../ui/summary.js?v=global-municipality-required-state-20260604";
import { createLegendFilterController } from "../ui/legend/legendFilters.js?v=livestock-map-legend-no-chart-sync-20260604";
import { createLegendRenderer } from "../ui/legend/legendRenderer.js?v=support-infrastructure-legend-patterns-20260603";
import { getSocioeconomicoRanges } from "../ui/color.js";
import { createUiControlsController } from "../ui/uiControls.js?v=conditions-mode-fix-20260519";
import { createSliderController } from "../ui/sliderControls.js?v=app-orchestrator-phase1-20260507";
import { createMapCoreController } from "../map/mapCore.js?v=ferrea-legend-toggle-20260511";
import { createMapEnvironment } from "../map/mapEnvironment.js";
import { createInitController } from "./init.js?v=component-nav-socio-20260627";
import { createOverviewController } from "../map/overview.js";
import { actualizarFuente } from "../map/mapHelpers.js?v=error-cleanup-20260509";
import { createSubtabsController } from "../ui/subtabs.js?v=poverty-initial-filter-sync-20260604";
import { toggleLegend } from "../ui/legend/legend.js";
import { createSelectsController } from "../ui/selects.js?v=component-nav-socio-20260623";
import { createLayerController } from "../map/layerController.js?v=tourism-department-context-20260604";
import { createPibBarChartController } from "../charts/pibBarChart.js?v=irrigation-pointer-pan-20260604";
import { createPibSectorPieChartController } from "../charts/pibSectorPieChart.js?v=global-municipality-required-state-20260604";
import { createPibEmpresasStackedBarChartController } from "../charts/pibEmpresasStackedBarChart.js?v=pib-sector-visible-bar-border-20260604";
import { createCensoPecuarioDoughnutController } from "../charts/dynamics/censoPecuarioDoughnutChart.js?v=global-municipality-required-state-20260604";
import { createEvaPieChartController } from "../charts/dynamics/evaPieChart.js?v=global-municipality-required-state-20260604";
import { prepareVisibleChartCanvas, setChartTitle } from "../charts/ui/chartPanel.js?v=local-chart-title-20260529";
import {
    chartRequiresMunicipality,
    hasMunicipalitySelection,
    showMunicipalityRequiredChartState
} from "../charts/ui/municipalityRequiredState.js?v=global-municipality-required-state-20260604";
import { initializeWindowState } from "../state/socioeconomicoState.js?v=infra-complementaria-20260511";
import { setState } from "../state/store.js";
import { applyWhereToLayers } from "../map/layerRuntime.js?v=ferrea-legend-toggle-20260511";
import EsriMap from "https://js.arcgis.com/4.29/@arcgis/core/Map.js";
import MapView from "https://js.arcgis.com/4.29/@arcgis/core/views/MapView.js";
import FeatureLayer from "https://js.arcgis.com/4.29/@arcgis/core/layers/FeatureLayer.js";
import Basemap from "https://js.arcgis.com/4.29/@arcgis/core/Basemap.js";
import TileLayer from "https://js.arcgis.com/4.29/@arcgis/core/layers/TileLayer.js";
import VectorTileLayer from "https://js.arcgis.com/4.29/@arcgis/core/layers/VectorTileLayer.js";
import GraphicsLayer from "https://js.arcgis.com/4.29/@arcgis/core/layers/GraphicsLayer.js";
import Graphic from "https://js.arcgis.com/4.29/@arcgis/core/Graphic.js";
import Extent from "https://js.arcgis.com/4.29/@arcgis/core/geometry/Extent.js";
import Home from "https://js.arcgis.com/4.29/@arcgis/core/widgets/Home.js";
import Locate from "https://js.arcgis.com/4.29/@arcgis/core/widgets/Locate.js";
import BasemapGallery from "https://js.arcgis.com/4.29/@arcgis/core/widgets/BasemapGallery.js";
import ScaleBar from "https://js.arcgis.com/4.29/@arcgis/core/widgets/ScaleBar.js";


let sliderMode = "zoom"; // "zoom" | "time"
const socioDeptOnlyLayerIds = new Set();
const socioDualLevelLayerIds = new Set([200, 201, 202, 203, 204, 300, 301]);
const socioDeptToMuniLayerId = {};

const educationConfig = LAYERS_CONFIG?.SOCIOECONOMIC_INFRASTRUCTURE?.find(item => item?.id === 202);
const publicServicesConfig = LAYERS_CONFIG?.SOCIOECONOMIC_CONDITIONS?.find(item => item?.id === 301);
if (educationConfig) {
    const normalizeEducationSummaryText = value => String(value || "")
        .replace(/\r\n/g, "\n")
        .replace(/\s+/g, " ")
        .trim();
    const educationParagraphStartsWith = value => normalizeEducationSummaryText(value)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .startsWith("en educacion");

    educationConfig.filterField = "mpcodigo";
    educationConfig.type = "feature-layer";
    educationConfig.chartConfig = {
        ...(educationConfig.chartConfig || {}),
        id: "instituciones-educacion",
        type: "bar",
        library: "chart.js",
        title: "Instituciones de educacion",
        titleTemplate: "Instituciones educativas del {mpcategor} de {mpnombre}, {dpnombre}",
        canvasHeight: 380,
        disableHorizontalScroll: true,
        url: educationConfig.url,
        layerUrl: educationConfig.url,
        serviceUrl: educationConfig.url,
        layerId: 28,
        source: "SE_IES",
        fields: ["mpcodigo", "mpnombre", "dpnombre", "mpcategor", "mpcracdm", "mpitp", "mpit", "mpiuet", "mpuni", "mpstotalbs"],
        xAxis: { field: "caracter_acad", label: "Caracter academico" },
        yAxis: { field: "cantidad", label: "Numero de instituciones", decimals: 0, grace: "18%", tickPadding: 8 },
        categoryFields: ["mpitp", "mpit", "mpiuet", "mpuni", "mpstotalbs"],
        mapInteractionField: "mpcracdm",
        legendField: "mpcracdm",
        categoryRendererCodes: {
            mpstotalbs: "12121",
            mpitp: "12122",
            mpit: "12123",
            mpiuet: "12124",
            mpuni: "12124"
        },
        filter: {
            municipalityField: "mpcodigo",
            requiredLevel: "MUNI"
        }
    };
    educationConfig.textSource = {
        url: socioeconomicoLayerUrl(44),
        fields: ["analisisedu"],
        filterField: "mpcodigo",
        mergeStrategy: "fields_without_labels"
    };
    educationConfig.chartConfig.textTransform = (value, fallbackMessage) => {
        const text = String(value || "").trim();
        if (!text) return fallbackMessage;
        const paragraphs = text
            .replace(/\r\n/g, "\n")
            .split(/\n\s*\n/)
            .map(item => normalizeEducationSummaryText(item))
            .filter(Boolean);
        return paragraphs.find(item => educationParagraphStartsWith(item)) || fallbackMessage;
    };
    educationConfig.chartConfig.textTransform = (value, fallbackMessage) => {
        const text = String(value || "").trim();
        if (!text) return fallbackMessage;
        const normalized = text.replace(/\r\n/g, "\n");
        const paragraphs = normalized
            .split(/\n\s*\n/)
            .map(item => item.replace(/\s+/g, " ").trim())
            .filter(Boolean);
        return paragraphs.find(item => /^En educaci[oó]n/i.test(item)) || fallbackMessage;
    };
    educationConfig.chartConfig.textTransform = (value, fallbackMessage) => {
        const text = String(value || "").trim();
        if (!text) return fallbackMessage;
        const paragraphs = text
            .replace(/\r\n/g, "\n")
            .split(/\n\s*\n/)
            .map(item => normalizeEducationSummaryText(item))
            .filter(Boolean);
        return paragraphs.find(item => educationParagraphStartsWith(item)) || fallbackMessage;
    };
}

if (publicServicesConfig) {
    const publicServicesVariantUrl = key =>
        (publicServicesConfig.variants || []).find(variant => variant?.key === key)?.url ||
        socioeconomicoLayerUrl(key === "acueducto" ? 38 : key === "alcantarillado" ? 39 : 40);
    publicServicesConfig.variants = [];
    publicServicesConfig.url = PUBLIC_SERVICES_RADAR_CHART_CONFIG.url;
    publicServicesConfig.mapLayerUrl = publicServicesVariantUrl("acueducto");
    publicServicesConfig.mapLayerLegendHeading = "Acueducto";
    publicServicesConfig.mapLayerLegendOrder = 1;
    publicServicesConfig.mapLayerDrawOrder = 3;
    publicServicesConfig.supplementaryMapLayers = [
        {
            url: publicServicesVariantUrl("alcantarillado"),
            legendHeading: "Alcantarillado",
            legendOrder: 2,
            drawOrder: 2
        },
        {
            url: publicServicesVariantUrl("energia"),
            legendHeading: "Energia",
            legendOrder: 3,
            drawOrder: 1
        }
    ];
    publicServicesConfig.filterField = "mpcodigo";
    publicServicesConfig.type = "feature-layer";
    publicServicesConfig.forceRendererLegend = true;
    publicServicesConfig.onlyActiveRendererLegendItems = true;
    publicServicesConfig.chartConfig = {
        ...PUBLIC_SERVICES_RADAR_CHART_CONFIG,
        useServiceRendererLegend: true,
        mapLegendMode: null,
        mapRenderer: null
    };
    publicServicesConfig.textSource = PUBLIC_SERVICES_RADAR_CHART_CONFIG.textSource;
}

const connectivityConfig = LAYERS_CONFIG?.SOCIOECONOMIC_INFRASTRUCTURE?.find(item => item?.id === 200);
if (connectivityConfig?.chartConfig?.supplementaryCharts?.length) {
    connectivityConfig.chartConfig.supplementaryCharts = connectivityConfig.chartConfig.supplementaryCharts.map(chart =>
        chart?.id === "infraestructura-complementaria"
            ? { ...INFRAESTRUCTURA_COMPLEMENTARIA_BAR_CHART_CONFIG }
            : chart
    );
}


function getLayerListForCurrentLevel(mode = currentMode) {
    if (mode === "SOCIOECONOMIC_SOCIAL_DYNAMICS") {
        return LAYERS_CONFIG?.[mode] || [];
    }

    if (mode === "SOCIOECONOMIC_INFRASTRUCTURE") {
        const list = LAYERS_CONFIG?.[mode] || [];
        if (filtroNivel === "DEPTO") {
            return list.filter(layer => socioDeptOnlyLayerIds.has(layer.id) || socioDualLevelLayerIds.has(layer.id));
        }
        if (filtroNivel === "MUNI") {
            return list.filter(layer => !socioDeptOnlyLayerIds.has(layer.id) || socioDualLevelLayerIds.has(layer.id));
        }
    }

    if (mode === "SOCIOECONOMIC_CONDITIONS") {
        const list = LAYERS_CONFIG?.[mode] || [];
        if (filtroNivel === "DEPTO") {
            return list.filter(layer => socioDeptOnlyLayerIds.has(layer.id) || socioDualLevelLayerIds.has(layer.id));
        }
        if (filtroNivel === "MUNI") {
            return list.filter(layer => !socioDeptOnlyLayerIds.has(layer.id) || socioDualLevelLayerIds.has(layer.id));
        }
    }

    return getLayerListForCurrentLevelBase({
        layersConfig: LAYERS_CONFIG,
        deptoOnlyLayerIds: socioDeptOnlyLayerIds,
        filtroNivel,
        mode
    });
}

function clampSubLayerIndex() {
    currentSubLayerIndex = clampSubLayerIndexBase({
        getList: () => getLayerListForCurrentLevel(currentMode),
        currentSubLayerIndex
    });
}

function ensureMunicipalLayerIndex(prevId) {
    currentSubLayerIndex = ensureMunicipalLayerIndexBase({
        prevId,
        getList: () => getLayerListForCurrentLevel(currentMode),
        currentSubLayerIndex,
        deptToMuniLayerId: socioDeptToMuniLayerId,
        deptoOnlyLayerIds: socioDeptOnlyLayerIds
    });
}

let currentMode = "SOCIOECONOMIC_SOCIAL_DYNAMICS";
let currentMainModule = "SOCIOECONOMICO";


let currentSubLayerIndex = 0; // Índice dentro del array de configuration
let layerGlobal = null;
let layerViewGlobal = null;
let whereBase = "";
let municipioActual = "";
let municipioInfo = null;
let chartInstance = null;
let diccionarioMunicipios = {};
let diccionarioDepartamentos = {};
let todosMunicipios = []; // Array de {código, nombre, depto}
let layersGlobal = [];
let chartLayerGlobal = null;

let map = null;
let view = null;
let deptoActual = "";
let filtroNivel = ""; // "", "DEPTO", "MUNI"
let updateLegendByExtent = null;

let scaleHandle = null;
let renderCycleId = 0;
let highlightHandle = null;
let lastHoverWhere = "";
let legendFilterLabel = null;
initializeWindowState();

function isExpectedArcgisAbort(reason) {
    const name = String(reason?.name || "").toLowerCase();
    const message = String(reason?.message || reason || "").toLowerCase();
    return name === "aborterror" || message.includes("aborted");
}

window.addEventListener("unhandledrejection", event => {
    if (isExpectedArcgisAbort(event.reason)) {
        event.preventDefault();
    }
});

const { clearLayers } = createMapCoreController({
    getMap: () => map,
    incrementRenderCycleId: () => { renderCycleId++; },
    getScaleHandle: () => scaleHandle,
    setScaleHandle: (value) => { scaleHandle = value; },
    getHighlightHandle: () => highlightHandle,
    setHighlightHandle: (value) => { highlightHandle = value; },
    setLastHoverWhere: (value) => { lastHoverWhere = value; },
    setLegendFilterLabel: (value) => { legendFilterLabel = value; },
    getLayersGlobal: () => layersGlobal,
    setLayersGlobal: (value) => { layersGlobal = value; },
    getLayerGlobal: () => layerGlobal,
    setLayerGlobal: (value) => { layerGlobal = value; },
    setChartLayerGlobal: (value) => { chartLayerGlobal = value; },
    setLayerViewGlobal: (value) => { layerViewGlobal = value; }
});

function getActiveLayerConfig() {
    return getActiveLayerConfigBase({
        getList: () => getLayerListForCurrentLevel(currentMode),
        currentSubLayerIndex
    });
}
const {
    updateMapViewBadge,
    setLegendLayer,
    initModuleDropdown,
    initDropdownDescargables,
    renderControls
} = createUiControlsController({
    getCurrentMainModule: () => currentMainModule,
    setCurrentMainModule: (value) => { currentMainModule = value; },
    setCurrentSubLayerIndex: (value) => { currentSubLayerIndex = value; },
    setCurrentMode: (value) => { currentMode = value; },
    hideTimeSlider: () => hideTimeSlider(),
    getChartInstance: () => chartInstance,
    setChartInstance: (value) => { chartInstance = value; },
    setLegendFilterLabel: (value) => { legendFilterLabel = value; },
    renderSubTabs: () => renderSubTabs(),
    clampSubLayerIndex: () => clampSubLayerIndex()
});

function resolveSocioeconomicoTabTarget(tabUrl) {
    const tab = String(tabUrl || "");
    if (tab === "Infraestructura" || tab.includes("Infraestructura")) {
        return "Infraestructura";
    }
    if (
        tab === "Dinámicas Socioeconómicas" ||
        tab === "DinÃ¡micas SocioeconÃ³micas" ||
        tab.includes("inamicas")
    ) {
        return "Dinámicas Socioeconómicas";
    }
    if (
        tab === "Condiciones Socioeconómicas" ||
        tab === "Condiciones SocioeconÃ³micas" ||
        tab.includes("Condiciones")
    ) {
        return "Condiciones Socioeconómicas";
    }
    if (
        tab === "Presiones Socioeconómicas" ||
        tab === "Presiones SocioeconÃ³micas" ||
        tab.includes("Presiones")
    ) {
        return "Presiones Socioeconómicas";
    }
    return null;
}

function markSocioeconomicoDropdownActive(target) {
    const dropdown = document.getElementById("socioeconomicoDropdown");
    if (!dropdown) return;
    dropdown.querySelectorAll(".dropdown-item").forEach((item) => {
        item.classList.toggle("active", item.dataset.target === target);
    });
}

function applySocioeconomicoTabState(target) {
    const resolvedTarget = resolveSocioeconomicoTabTarget(target);
    if (!resolvedTarget) return false;

    currentMainModule = "SOCIOECONOMICO";

    if (resolvedTarget === "Infraestructura") {
        window.currentSocioTab = "INFRASTRUCTURE";
        currentMode = "SOCIOECONOMIC_INFRASTRUCTURE";
    } else if (resolvedTarget === "Dinámicas Socioeconómicas") {
        window.currentSocioTab = "DYNAMICS";
        currentMode = "SOCIOECONOMIC_SOCIAL_DYNAMICS";
    } else if (resolvedTarget === "Condiciones Socioeconómicas") {
        window.currentSocioTab = "CONDITIONS";
        currentMode = "SOCIOECONOMIC_CONDITIONS";
    } else if (resolvedTarget === "Presiones Socioeconómicas") {
        window.currentSocioTab = "PRESSURES";
        currentMode = "SOCIOECONOMIC_SOCIAL_DYNAMICS";
    }

    currentSubLayerIndex = 0;
    markSocioeconomicoDropdownActive(resolvedTarget);
    renderSubTabs();
    return true;
}

async function handleSocioeconomicoTabChange(target) {
    await clearSocioVisualState({
        preservePibTabs: false,
        preserveEconomicTabs: false,
        preserveMainCanvas: false,
        preserveSummary: false,
        preserveLegend: false
    });

    if (!applySocioeconomicoTabState(target)) return;

    const activeConfig = getActiveLayerConfig();
    await syncPovertyInitialTerritoryFromSelects(activeConfig);
    prepareChartPanelForConfig(activeConfig);
    cargarCapaActual();
    if (activeConfig?.key === "POVERTY_LEVEL") {
        renderActiveChartSoon(700);
        renderActiveChartSoon(1600);
    }
    window.renderActivePibSubitem?.(900);
    window.renderActiveEconomicSubitem?.(900);
}

function navigateToExternalComponent(targetPage, tab) {
    const nav = globalThis.ModuleNavigation;
    const territory = nav?.getTerritoryFromSelects?.(
        document.getElementById("departamentos"),
        document.getElementById("municipios")
    ) || { municipioId: "", deptoId: "" };

    if (nav && typeof nav.navigateToComponent === "function") {
        nav.navigateToComponent(targetPage, tab);
        return;
    }

    if (nav && typeof nav.buildComponentHref === "function") {
        window.location.assign(nav.buildComponentHref(targetPage, { tab, ...territory }));
        return;
    }

    const params = new URLSearchParams();
    if (tab) params.set("tab", tab);
    if (territory.deptoId) params.set("depto", territory.deptoId);
    if (territory.municipioId) params.set("id", territory.municipioId);
    const query = params.toString();
    window.location.assign(query ? `${targetPage}?${query}` : targetPage);
}

const EXTERNAL_MODULE_ROUTES = {
    limitesDropdown: "limites.html",
    ordenamientoDropdown: "ordenamiento.html",
    legalDropdown: "contexto.html",
    biofisicoDropdown: "biofisico.html",
    ocupacionDropdown: "ocupacion.html"
};

let moduleNavigationBound = false;

function bindExternalModuleNavigation() {
    const container = document.querySelector(".modulos-container");
    if (!container || container.dataset.externalNavBound === "true") return;
    container.dataset.externalNavBound = "true";

    container.addEventListener("click", (event) => {
        const item = event.target.closest(".dropdown-item");
        if (!item || !container.contains(item)) return;

        const dropdown = item.closest(".modulo-dropdown");
        if (!dropdown || dropdown.id === "socioeconomicoDropdown") return;

        const targetPage = EXTERNAL_MODULE_ROUTES[dropdown.id];
        if (!targetPage) return;

        event.preventDefault();
        event.stopPropagation();

        dropdown.querySelectorAll(".dropdown-item").forEach((el) => el.classList.remove("active"));
        item.classList.add("active");
        dropdown.classList.remove("open");

        navigateToExternalComponent(targetPage, item.dataset.target || "");
    });
}

function bindSocioeconomicoDropdown() {
    if (moduleNavigationBound) return;
    moduleNavigationBound = true;

    document.addEventListener("click", (event) => {
        document.querySelectorAll(".modulo-dropdown.open").forEach((dropdown) => {
            if (!dropdown.contains(event.target)) dropdown.classList.remove("open");
        });
    });

    initModuleDropdown(
        "socioeconomicoDropdown",
        "socioeconomicoTrigger",
        ".dropdown-menu-custom",
        handleSocioeconomicoTabChange
    );
    bindExternalModuleNavigation();
}

const mapEnvironment = createMapEnvironment({
    state: {
        set(key, value) {
            if (key === "map") map = value;
            if (key === "view") view = value;
        }
    },
    mapDeps: {
        EsriMap,
        MapView,
        Basemap,
        TileLayer,
        VectorTileLayer,
        GraphicsLayer,
        Graphic,
        Extent,
        Home,
        Locate,
        BasemapGallery,
        ScaleBar
    },
    mapControls: {
        bindMapActionButtons,
        bindOverviewToggle
    },
    basemapController: {
        createIgacSatelitalTopo,
        initBasemapGallery,
        bindBasemapPanelToggle
    },
    overviewControllerFactory: createOverviewController,
    onMapClick: async (event) => {
        await manejarClickMapaAreasActividad(event);
    }
});

({ map, view } = mapEnvironment);
const zoomSlider = document.getElementById("zoomSlider");
const timeSliderLabel = document.getElementById("timeSliderLabel");
const masterSlider = zoomSlider;

const {
    bindMasterSlider,
    hideTimeSlider,
    showTimeSlider,
    getSelectedTimePeriod,
    handleTimeSliderInput,
    setTimeSliderTouched,
    isTimeSliderTouched
} = createSliderController({
    view,
    masterSlider,
    timeSliderLabel,
    getSliderMode: () => sliderMode,
    setSliderMode: (value) => { sliderMode = value; },
    getWhereBase: () => whereBase,
    getLayerGlobal: () => layerGlobal,
    getLayersGlobal: () => layersGlobal,
    getActiveLayerConfig,
    applyWhereToActiveLayers: (...args) => applyWhereToActiveLayers(...args),
    // actualizarGrafica: (...args) => actualizarGrafica(...args)
    actualizarGrafica: (...args) => actualizarGrafica(...args)
});
window.hideTimeSlider = hideTimeSlider;
bindMasterSlider();



mapEnvironment.bindViewReady({
    hideTimeSlider,
    bindZoomButtons
});
const municipalDataController = createMunicipalDataController({
    FeatureLayer,
    layersConfig: LAYERS_CONFIG,
    getDiccionarioMunicipios: () => diccionarioMunicipios,
    setDiccionarioMunicipios: (value) => { diccionarioMunicipios = value; },
    getDiccionarioDepartamentos: () => diccionarioDepartamentos,
    setDiccionarioDepartamentos: (value) => { diccionarioDepartamentos = value; },
    getTodosMunicipios: () => todosMunicipios,
    setTodosMunicipios: (value) => { todosMunicipios = value; }
});

const summaryController = createSummaryController({
    getFiltroNivel: () => filtroNivel,
    getMunicipioActual: () => municipioActual,
    getDeptoActual: () => deptoActual,
    getMunicipioInfo: () => municipioInfo,
    setMunicipioInfo: (value) => { municipioInfo = value; },
    getActiveLayerConfig,
    hideTimeSlider,
    setTimeSliderTouched: (value) => { setTimeSliderTouched(value); }
});

const legendFilterController = createLegendFilterController({
    getActiveLayer: () => window.activeFeatureLayer || layerGlobal || null,
    getActiveLayers: () => layersGlobal?.length ? layersGlobal : [window.activeFeatureLayer || layerGlobal].filter(Boolean),
    view
});

const legendRenderer = createLegendRenderer({
    getActiveLayerConfig
});

const { cargarMunicipios, cargarDepartamentos, renderizarMunicipios } = municipalDataController;
const { cargarInfoMunicipio, actualizarResumen } = summaryController;
const { actualizarLeyenda } = legendRenderer;
const { bindLegendClickOnce } = legendFilterController;
bindLegendClickOnce();

function applyWhereToActiveLayers(where) {
    applyWhereToLayers({ where, whereBase, layersGlobal, layerGlobal });
}

const chartController = createPibBarChartController({
    getActiveLayerConfig,
    getChartInstance: () => chartInstance,
    setChartInstance: value => { chartInstance = value; },
    getWhereBase: () => whereBase,
    getFiltroNivel: () => filtroNivel,
    getDeptoActual: () => deptoActual,
    getMunicipioActual: () => municipioActual,
    getDiccionarioDepartamentos: () => diccionarioDepartamentos,
    getLayerGlobal: () => layerGlobal,
    getLayersGlobal: () => layersGlobal,
    getChartLayerGlobal: () => chartLayerGlobal,
    getView: () => view,
    getHighlightHandle: () => highlightHandle,
    setHighlightHandle: value => { highlightHandle = value; },
    applyWhereToActiveLayers,
    refreshSummary: () => actualizarResumen()
});

const {
    actualizarGrafica,
    clearChartSelections,
    destroyChart,
    manejarClickMapaAreasActividad: manejarClickMapaAreasActividadBase,
    prepareChartPanelForConfig,
    resetAuxiliaryCharts,
    renderActiveChartSoon
} = chartController;

let pibEmpresasController = null;
const pibSectorPieController = createPibSectorPieChartController({
    getMunicipioActual: () => municipioActual,
    getDeptoActual: () => deptoActual,
    getFiltroNivel: () => filtroNivel,
    getWhereBase: () => whereBase,
    getActiveMapLayer: () => window.activeFeatureLayer || layerGlobal,
    getView: () => view,
    getHighlightHandle: () => highlightHandle,
    setHighlightHandle: value => { highlightHandle = value; },
    onSectorHover: sector => pibEmpresasController?.highlightSector(sector),
    onSectorLeave: () => pibEmpresasController?.clearSectorHighlight()
});

pibEmpresasController = createPibEmpresasStackedBarChartController({
    getMunicipioActual: () => municipioActual,
    getDeptoActual: () => deptoActual,
    getFiltroNivel: () => filtroNivel,
    highlightPieSector: sector => pibSectorPieController.highlightSector(sector),
    clearPieSectorHighlight: () => pibSectorPieController.clearSectorHighlight(),
    highlightMunicipalityOnMap: () => pibSectorPieController.highlightMunicipalityOnMap?.()
});

function normalizeMunicipalityCode(value, departmentCode = "") {
    const raw = String(value ?? "").trim();
    if (/^\d{5}$/.test(raw)) return raw;
    if (/^\d{4}$/.test(raw) && /^\d{2}$/.test(departmentCode)) return `${departmentCode.slice(0, 1)}${raw}`;
    const digits = raw.replace(/\D/g, "");
    if (/^\d{5}$/.test(digits)) return digits;
    if (/^\d{4}$/.test(digits) && /^\d{2}$/.test(departmentCode)) return `${departmentCode.slice(0, 1)}${digits}`;
    return "";
}

function resolveMunicipalityCodeFromAttributes(attrs = {}, departmentCode = "") {
    const candidates = [
        attrs.mpcodigo,
        attrs.MPCODIGO,
        attrs.cod_mpio,
        attrs.COD_MPIO,
        attrs.codmpio,
        attrs.CODMPIO,
        attrs.mpcode,
        attrs.MPCODE,
        attrs.divipola,
        attrs.DIVIPOLA
    ];
    return candidates
        .map(value => normalizeMunicipalityCode(value, departmentCode))
        .find(Boolean) || "";
}

async function queryMunicipalityCodeAtMapPoint(event, targetLayers, departmentCode) {
    if (!event?.mapPoint) return "";
    const layers = [...targetLayers].filter(layer => layer?.queryFeatures && !layer.destroyed && layer.visible !== false);

    for (const layer of layers) {
        try {
            await layer.when?.();
            const query = layer.createQuery();
            query.geometry = event.mapPoint;
            query.spatialRelationship = "intersects";
            query.where = `dpcodigo = '${String(departmentCode).replace(/'/g, "''")}'`;
            query.outFields = ["*"];
            query.returnGeometry = false;
            query.num = 1;
            const result = await layer.queryFeatures(query);
            const code = resolveMunicipalityCodeFromAttributes(result?.features?.[0]?.attributes || {}, departmentCode);
            if (code) return code;
        } catch (_) {}
    }

    return "";
}

async function resolveClickedMunicipalityCode(event, activeDepartmentCode) {
    const hit = await view.hitTest(event);
    const targetLayers = new Set((layersGlobal || []).filter(Boolean));
    if (layerGlobal) targetLayers.add(layerGlobal);
    if (chartLayerGlobal) targetLayers.add(chartLayerGlobal);

    const graphic = hit?.results
        ?.map(result => result.graphic)
        ?.find(item => item?.attributes && (!targetLayers.size || targetLayers.has(item.layer)));
    let municipalityCode = resolveMunicipalityCodeFromAttributes(graphic?.attributes || {}, activeDepartmentCode);
    if (!municipalityCode) {
        municipalityCode = await queryMunicipalityCodeAtMapPoint(event, targetLayers, activeDepartmentCode);
    }
    return municipalityCode;
}

function selectMunicipalityFromMapClick(municipalityCode) {
    const selectDepto = document.getElementById("departamentos");
    const selectMuni = document.getElementById("municipios");
    if (!selectMuni) return false;

    const departmentCode = municipalityCode.slice(0, 2);
    if (selectDepto && selectDepto.value !== departmentCode) {
        selectDepto.value = departmentCode;
    }

    if (![...selectMuni.options].some(option => option.value === municipalityCode)) {
        renderizarMunicipios(departmentCode);
    }

    selectMuni.value = municipalityCode;
    if (selectMuni.value !== municipalityCode) return false;
    selectMuni.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
}

async function handlePibDepartmentMunicipalityMapClick(event) {
    if (!isPibActive() || !["DEPTO", "MUNI"].includes(String(filtroNivel || ""))) return false;
    if (!view) return false;

    const activeDepartmentCode = String(deptoActual || municipioActual?.slice?.(0, 2) || "").trim();
    if (!activeDepartmentCode) return false;

    const municipalityCode = await resolveClickedMunicipalityCode(event, activeDepartmentCode);
    if (!municipalityCode || municipalityCode.slice(0, 2) !== activeDepartmentCode) return false;
    if (municipalityCode === String(municipioActual || "").trim()) return false;

    return selectMunicipalityFromMapClick(municipalityCode);
}

async function handlePovertyDepartmentMunicipalityMapClick(event) {
    if (!isPovertyLevelActive() || !["DEPTO", "MUNI"].includes(String(filtroNivel || ""))) return false;
    if (!view) return false;

    const activeDepartmentCode = String(deptoActual || municipioActual?.slice?.(0, 2) || "").trim();
    if (!activeDepartmentCode) return false;

    const municipalityCode = await resolveClickedMunicipalityCode(event, activeDepartmentCode);
    if (!municipalityCode || municipalityCode.slice(0, 2) !== activeDepartmentCode) return false;
    if (municipalityCode === String(municipioActual || "").trim()) return false;

    return selectMunicipalityFromMapClick(municipalityCode);
}

async function handleSupportInfrastructureMunicipalityMapClick(event) {
    if (!isSupportInfrastructureActive() || !["DEPTO", "MUNI"].includes(String(filtroNivel || ""))) return false;
    if (!view) return false;

    const activeDepartmentCode = String(deptoActual || municipioActual?.slice?.(0, 2) || "").trim();
    if (!activeDepartmentCode) return false;

    const municipalityCode = await resolveClickedMunicipalityCode(event, activeDepartmentCode);
    if (!municipalityCode || municipalityCode.slice(0, 2) !== activeDepartmentCode) return false;
    if (municipalityCode === String(municipioActual || "").trim()) return false;

    return selectMunicipalityFromMapClick(municipalityCode);
}

const censoPecuarioController = createCensoPecuarioDoughnutController({
    getMunicipioActual: () => municipioActual,
    getDeptoActual: () => deptoActual,
    getFiltroNivel: () => filtroNivel
});

// NUEVO: Controlador para Censo Agrícola EVA
const evaPieController = createEvaPieChartController({
    getMunicipioActual: () => municipioActual,
    getDeptoActual: () => deptoActual,
    getFiltroNivel: () => filtroNivel,
    refreshSummary: () => actualizarResumen()
});

async function manejarClickMapaAreasActividad(event) {
    if (await handlePibDepartmentMunicipalityMapClick(event)) return;
    if (await handlePovertyDepartmentMunicipalityMapClick(event)) return;
    if (await handleSupportInfrastructureMunicipalityMapClick(event)) return;

    if (isPibActive() && activePibSubitem === "valor-agregado") {
        await pibSectorPieController.handleMapClick?.(event);
        return;
    }
    await manejarClickMapaAreasActividadBase(event);
}

function isPibActive() {
    return getActiveLayerConfig()?.key === "PIB_DEPARTMENT";
}

function isPovertyLevelActive() {
    return getActiveLayerConfig()?.key === "POVERTY_LEVEL";
}

function isSupportInfrastructureActive() {
    return getActiveLayerConfig()?.key === "SUPPORT_INFRASTRUCTURE";
}

let activePibSubitem = "pib";
let activeEconomicSubitem = "censo-pecuario";
let economicSubitemRenderRequestId = 0;

function getPibSubitems() {
    return getActiveLayerConfig()?.chartConfig?.subitems || [];
}

function ensurePibSubitemTabs() {
    let container = document.getElementById("pibSubitemTabs");
    if (container) return container;
    const chartTitle = document.getElementById("chartTitle");
    if (!chartTitle?.parentNode) return null;
    container = document.createElement("div");
    container.id = "pibSubitemTabs";
    container.className = "chart-switch-tabs";
    container.hidden = true;
    chartTitle.insertAdjacentElement("afterend", container);
    return container;
}

function hidePibSubitemTabs() {
    const container = document.getElementById("pibSubitemTabs");
    if (!container) return;
    container.hidden = true;
    container.innerHTML = "";
}

function setMainPibChartVisible(visible) {
    const chartScroll = document.getElementById("pibChartScroll");
    const canvas = document.getElementById("chart");
    if (chartScroll) chartScroll.style.display = visible ? "block" : "none";
    if (canvas) canvas.style.display = visible ? "block" : "none";
}

function setPibMainChartTitle(text = "") {
    setChartTitle(text);
}

function setPibValueAddedLayout(active = false) {
    document.querySelector(".chart-card")?.classList.toggle("pib-value-added-flow", Boolean(active));
    reorderPibValueAddedTextBlocks(active);
}

function reorderPibValueAddedTextBlocks(active = false) {
    const summary = document.getElementById("summaryDiv");
    const sectorPanel = document.getElementById("pibSectorPiePanel");
    const empresasPanel = document.getElementById("pibEmpresasPanel");
    const censoPanel = document.getElementById("censoPecuarioPanel");
    if (!summary?.parentNode) return;

    if (active && empresasPanel?.parentNode) {
        empresasPanel.parentNode.insertBefore(summary, empresasPanel.nextSibling);
        return;
    }

    if (!active && censoPanel?.parentNode) {
        censoPanel.parentNode.insertBefore(summary, censoPanel.nextSibling);
    }
}

function placeSummaryAfterCensoPecuarioPanel() {
    const summary = document.getElementById("summaryDiv");
    const censoPanel = document.getElementById("censoPecuarioPanel");
    if (!summary || !censoPanel?.parentNode) return;
    censoPanel.parentNode.insertBefore(summary, censoPanel.nextSibling);
}

function getPibFlowMode() {
    return filtroNivel === "MUNI" && String(municipioActual || "").trim()
        ? "valor-agregado"
        : "pib";
}

function getPibVariantKeyForSubitem(subitemId = getPibFlowMode()) {
    if (subitemId === "valor-agregado") return "VALOR_AGREGADO";
    return "PIB";
}

function hexToEsriColor(hex, alpha = 255) {
    const normalized = String(hex || "").trim().replace(/^#/, "");
    if (!/^[0-9a-f]{6}$/i.test(normalized)) return [153, 153, 153, alpha];
    return [
        Number.parseInt(normalized.slice(0, 2), 16),
        Number.parseInt(normalized.slice(2, 4), 16),
        Number.parseInt(normalized.slice(4, 6), 16),
        alpha
    ];
}

function normalizeOutlineSymbol(outline) {
    return {
        type: "simple-line",
        style: "solid",
        color: Array.isArray(outline?.color) ? outline.color : [166, 166, 166, 255],
        width: Number.isFinite(Number(outline?.width)) ? Number(outline.width) : 0.7
    };
}

function parseRangeLowerBound(label, fallback = 0) {
    const match = String(label || "").match(/-?\d+(?:[.,]\d+)?/);
    if (!match) return fallback;
    const normalized = match[0].replace(/\./g, "").replace(",", ".");
    const value = Number(normalized);
    return Number.isFinite(value) ? value : fallback;
}

function parseLegendRangeCode(code) {
    const match = String(code || "").trim().match(/^\s*(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (!match) return null;
    const min = Number(match[1]);
    const max = Number(match[2]);
    if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
    return { min, max };
}

function resolvePibDepartmentCode() {
    const municipalityCode = String(municipioActual || "").trim();
    if (/^\d{5}$/.test(municipalityCode)) return municipalityCode.slice(0, 2);
    const departmentCode = String(deptoActual || "").trim();
    if (/^\d{2}$/.test(departmentCode)) return departmentCode;
    const selectedDepartment = String(document.getElementById("departamentos")?.value || "").trim();
    if (/^\d{2}$/.test(selectedDepartment)) return selectedDepartment;
    return "";
}

function resolvePibRendererField(layer) {
    const fieldNames = new Set((layer?.fields || []).map(field => String(field?.name || "").toLowerCase()));
    if (fieldNames.has("pvagregadokmcop")) return "pvagregadokmcop";
    if (fieldNames.has("pibdptokmcop")) return "pibdptokmcop";
    if (fieldNames.has("pibdpto")) return "pibdpto";
    return String(layer?.renderer?.field || "").trim();
}

function buildPibCustomRenderer(layer, dpcodigo) {
    const rangesConfig = getSocioeconomicoRanges(dpcodigo);
    const rendererField = resolvePibRendererField(layer);
    if (!rangesConfig?.ranges?.length || !rendererField) return null;

    const outline =
        layer?.renderer?.backgroundFillSymbol?.outline ||
        layer?.renderer?.defaultSymbol?.outline || {
            type: "simple-line",
            style: "solid",
            color: [166, 166, 166, 255],
            width: 0.7
        };
    const normalizedOutline = normalizeOutlineSymbol(outline);

    let previousUpper = null;
    const classBreakInfos = rangesConfig.ranges.map((range, index) => {
        const lowerFromLabel = parseRangeLowerBound(range.label, previousUpper ?? 0);
        const minValue = index === 0
            ? lowerFromLabel
            : Math.max(previousUpper ?? lowerFromLabel, lowerFromLabel);
        const maxValue = Number(range.upperValue);
        previousUpper = maxValue;
        return {
            minValue,
            maxValue,
            label: range.label,
            symbol: {
                type: "simple-fill",
                style: "solid",
                color: hexToEsriColor(range.colorHex, 255),
                outline: normalizedOutline
            }
        };
    }).filter(info => Number.isFinite(info.maxValue));

    if (!classBreakInfos.length) return null;

    return {
        type: "class-breaks",
        field: rendererField,
        classificationMethod: "natural-breaks",
        legendOptions: { order: "ascendingValues" },
        defaultSymbol: {
            type: "simple-fill",
            style: "solid",
            color: [0, 0, 0, 0],
            outline: normalizedOutline
        },
        defaultLabel: "Sin información",
        classBreakInfos
    };
}

async function applyCustomPibRenderer(layer) {
    if (!layer) return;
    await layer.when?.();
    const dpcodigo = resolvePibDepartmentCode();
    const renderer = buildPibCustomRenderer(layer, dpcodigo);
    if (!renderer) return;
    layer.renderer = renderer;
}

function buildPibDepartmentWhereForMunicipalityFlow() {
    const departmentCode = resolvePibDepartmentCode();
    if (!departmentCode) return String(whereBase || "1=1").trim() || "1=1";
    return `dpcodigo = '${String(departmentCode).replace(/'/g, "''")}'`;
}

function removePibMunicipalityHighlightGraphics() {
    if (!view?.graphics) return;
    const highlights = [];
    view.graphics.forEach(graphic => {
        if (graphic?.attributes?.__pibMunicipalityHighlight) {
            highlights.push(graphic);
        }
    });
    if (highlights.length) view.graphics.removeMany(highlights);
}

async function clearPibMunicipalityContextEffect() {
    removePibMunicipalityHighlightGraphics();
    if (!view) return;
    const candidates = Array.isArray(layersGlobal) ? layersGlobal.filter(Boolean) : [];
    await Promise.all(candidates.map(async layer => {
        if (!layer || layer.destroyed) return;
        try {
            const layerView = await view.whenLayerView(layer);
            if (layerView?.featureEffect) {
                layerView.featureEffect = null;
            }
        } catch (_) {}
    }));
}

async function applyPibMunicipalityContextEffect(targetLayer) {
    await clearPibMunicipalityContextEffect();

    const municipalityCode = String(municipioActual || "").trim();
    if (!targetLayer || targetLayer.destroyed || !view || !municipalityCode) return;

    try {
        const query = targetLayer.createQuery();
        query.where = `mpcodigo = '${municipalityCode.replace(/'/g, "''")}'`;
        query.returnGeometry = true;
        query.outFields = [targetLayer.objectIdField || "OBJECTID", "mpcodigo", "mpnombre"];
        query.num = 1;

        const result = await targetLayer.queryFeatures(query);
        const geometry = result?.features?.[0]?.geometry;
        if (!geometry) return;

        const highlightAttributes = {
            __pibMunicipalityHighlight: true,
            mpcodigo: municipalityCode
        };
        const softHalo = new Graphic({
            geometry,
            attributes: highlightAttributes,
            symbol: {
                type: "simple-fill",
                color: [255, 255, 255, 0],
                outline: {
                    type: "simple-line",
                    color: [250, 176, 45, 120],
                    width: 3.2
                }
            }
        });
        const crispBorder = new Graphic({
            geometry,
            attributes: highlightAttributes,
            symbol: {
                type: "simple-fill",
                color: [255, 255, 255, 0],
                outline: {
                    type: "simple-line",
                    color: [0, 74, 105, 210],
                    width: 1.2
                }
            },
            popupTemplate: null
        });

        view.graphics.addMany([softHalo, crispBorder]);
    } catch (error) {
        console.warn("No se pudo aplicar resaltado municipal en PIB y Valor agregado:", error);
    }
}

async function applyPibLegendSelection(state, targetLayer, rendererField, baseWhere = "1=1") {
    if (!state || !targetLayer || !view) return;

    const activeCodes = state?.activeCodes instanceof Set
        ? [...state.activeCodes].map(value => String(value ?? "").trim()).filter(Boolean)
        : [];
    const totalCodes = Array.isArray(state?.allCodes)
        ? state.allCodes.map(value => String(value ?? "").trim()).filter(Boolean)
        : [];

    let rangeWhere = null;
    if (!activeCodes.length) {
        rangeWhere = "1=0";
    } else if (totalCodes.length && activeCodes.length < totalCodes.length) {
        const clauses = activeCodes
            .map(parseLegendRangeCode)
            .filter(Boolean)
            .map(range => {
                const min = Number(range.min);
                const max = Number(range.max);
                return `(${rendererField} >= ${min} AND ${rendererField} <= ${max})`;
            });
        rangeWhere = clauses.length ? clauses.join(" OR ") : null;
    }

    const base = String(baseWhere || "1=1").trim() || "1=1";
    const finalWhere = rangeWhere ? `((${base}) AND (${rangeWhere}))` : base;

    try {
        const layerView = await view.whenLayerView(targetLayer);
        layerView.filter = finalWhere && finalWhere !== "1=1" ? { where: finalWhere } : null;
    } catch (_) {}
}

async function buildActivePibLegendData(targetLayer, legendField, baseWhere = "1=1") {
    if (!targetLayer?.renderer || !targetLayer?.createQuery || !legendField) return null;

    const activeCodes = new Set();
    const safeWhere = String(baseWhere || "1=1").trim() || "1=1";
    const candidateLayers = Array.isArray(layersGlobal) && layersGlobal.length
        ? layersGlobal.filter(layer => layer && !layer.destroyed)
        : [targetLayer];

    await Promise.all(candidateLayers.map(async layer => {
        const layerField = String(layer?.renderer?.field || legendField || "").trim();
        if (!layerField || !layer?.createQuery || !layer?.renderer) return;

        const query = layer.createQuery();
        query.where = safeWhere;
        query.outFields = [layerField];
        query.returnGeometry = false;
        query.returnDistinctValues = true;
        query.num = 5000;

        let features = [];
        try {
            const result = await layer.queryFeatures(query);
            features = result?.features || [];
        } catch (_) {
            const fallbackQuery = layer.createQuery();
            fallbackQuery.where = query.where;
            fallbackQuery.outFields = [layerField];
            fallbackQuery.returnGeometry = false;
            fallbackQuery.num = 5000;
            try {
                const fallbackResult = await layer.queryFeatures(fallbackQuery);
                features = fallbackResult?.features || [];
            } catch (_) {
                features = [];
            }
        }

        features.forEach(feature => {
            const value = feature?.attributes?.[layerField];
            const visual = getRendererVisualForValue(layer.renderer, value, {
                colorsFromRenderer: true,
                labelsFromRenderer: true
            });
            const code = String(visual?.code || "").trim();
            if (code) activeCodes.add(code);
        });
    }));

    if (!activeCodes.size) return null;

    const orderedItems = getRendererLegendItems(targetLayer.renderer, {
        colorsFromRenderer: true,
        labelsFromRenderer: true
    }).filter(item => activeCodes.has(String(item?.code || "").trim()));

    const isMunicipalityWhere = /mpcodigo\s*=/.test(safeWhere);
    const isDepartmentWhere = !isMunicipalityWhere && /dpcodigo\s*=/.test(safeWhere);
    if (isDepartmentWhere && orderedItems.length <= 1) {
        const rendererLegend = buildLegendFromRenderer(targetLayer.renderer, {
            chartConfig: {
                useGlobalLegendOrder: false,
                colorsFromRenderer: true,
                labelsFromRenderer: true
            }
        });
        if (rendererLegend?.labels?.length) {
            return rendererLegend;
        }
    }

    if (!orderedItems.length) return null;

    return {
        labels: orderedItems.map(item => item.label),
        colors: orderedItems.map(item => item.color || "#999"),
        codes: orderedItems.map(item => item.code)
    };
}

function buildConfiguredPibLegendData(dpcodigo) {
    const rangesConfig = getSocioeconomicoRanges(dpcodigo);
    if (!rangesConfig?.ranges?.length) return null;

    let previousUpper = null;
    const items = rangesConfig.ranges.map((range, index) => {
        const lowerFromLabel = parseRangeLowerBound(range.label, previousUpper ?? 0);
        const minValue = index === 0
            ? lowerFromLabel
            : Math.max(previousUpper ?? lowerFromLabel, lowerFromLabel);
        const maxValue = Number(range.upperValue);
        previousUpper = maxValue;
        if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) return null;
        return {
            code: `${minValue}-${maxValue}`,
            label: range.label,
            color: range.colorHex || "#999"
        };
    }).filter(Boolean);

    if (!items.length) return null;

    return {
        labels: items.map(item => item.label),
        colors: items.map(item => item.color),
        codes: items.map(item => item.code)
    };
}

function resolvePibVisibleMapWhere() {
    const isMunicipalValueAdded = window.__pibMapVariantKey === "VALOR_AGREGADO"
        && filtroNivel === "MUNI"
        && String(municipioActual || "").trim();
    return isMunicipalValueAdded
        ? buildPibDepartmentWhereForMunicipalityFlow()
        : (String(whereBase || "1=1").trim() || "1=1");
}

async function forceRendererLegendForLayer(targetLayer, config, fieldOverride = null, baseWhereOverride = null) {
    if (!targetLayer?.renderer) return;
    const baseWhere = String(baseWhereOverride || (config?.key === "PIB_DEPARTMENT" ? resolvePibVisibleMapWhere() : whereBase) || "1=1").trim() || "1=1";
    const legendField = fieldOverride || targetLayer.renderer?.field || config?.legendField || null;
    const isDepartmentWhere = config?.key === "PIB_DEPARTMENT"
        && /dpcodigo\s*=/.test(baseWhere)
        && !/mpcodigo\s*=/.test(baseWhere);
    const legendData = config?.key === "PIB_DEPARTMENT"
        ? (isDepartmentWhere
            ? (buildConfiguredPibLegendData(resolvePibDepartmentCode()) || buildLegendFromRenderer(targetLayer.renderer, {
                chartConfig: {
                    useGlobalLegendOrder: false,
                    colorsFromRenderer: true,
                    labelsFromRenderer: true
                }
            }))
            : await buildActivePibLegendData(targetLayer, legendField, baseWhere))
        : buildLegendFromRenderer(targetLayer.renderer, {
            chartConfig: {
                useGlobalLegendOrder: false,
                colorsFromRenderer: true,
                labelsFromRenderer: true
            }
        });
    if (!legendData?.labels?.length) return;

    window.__chartLegendOrder = [];
    actualizarLeyenda(legendData.labels, legendData.colors, legendData.codes, {
        field: legendField,
        baseWhere,
        layers: [targetLayer],
        preserveOrder: true,
        customApply: config?.key === "PIB_DEPARTMENT"
            ? async (state) => {
                await applyPibLegendSelection(state, targetLayer, legendField, baseWhere);
            }
            : null
    });
}

async function syncPibVariantMap(subitemId = activePibSubitem) {
    const config = getActiveLayerConfig();
    if (!config || config.key !== "PIB_DEPARTMENT") return;

    const targetVariantKey = getPibVariantKeyForSubitem(subitemId);
    window.__pibMapVariantKey = targetVariantKey;
    config.chartVariantKey = targetVariantKey;
    const variants = config.variants || [];
    const targetVariant = variants.find(variant => variant.key === targetVariantKey) || variants[0];
    const targetUrl = String(targetVariant?.url || "").trim();
    const baseWhere = String(whereBase || "1=1").trim() || "1=1";
    if (!targetUrl || !layersGlobal?.length) return;

    const useDepartmentContextForMunicipality = targetVariantKey === "VALOR_AGREGADO"
        && filtroNivel === "MUNI"
        && String(municipioActual || "").trim();
    const mapWhere = useDepartmentContextForMunicipality
        ? buildPibDepartmentWhereForMunicipalityFlow()
        : baseWhere;

    layersGlobal.forEach(layer => {
        const sameSource = String(layer?.__sourceUrl || layer?.url || "").trim() === targetUrl;
        layer.visible = sameSource;
        layer.definitionExpression = sameSource ? mapWhere : baseWhere;
    });

    layerGlobal = layersGlobal.find(layer => layer?.visible) || layersGlobal[0] || null;
    chartLayerGlobal = layerGlobal;
    window.activeFeatureLayer = layerGlobal;

    if (!layerGlobal) return;
    await layerGlobal.when?.();
    if (!layerGlobal || layerGlobal.destroyed) return;
    await Promise.all((layersGlobal || []).map(layer => applyCustomPibRenderer(layer)));
    if (!layerGlobal || layerGlobal.destroyed) return;
    setLegendLayer(layerGlobal, config.title);
    updateMapViewBadge(config.title);

    if (view) {
        await Promise.all((layersGlobal || []).map(async layer => {
            if (!layer || layer.destroyed) return;
            try {
                const layerView = await view.whenLayerView(layer);
                layerView.filter = null;
            } catch (_) {}
        }));
    }

    if (useDepartmentContextForMunicipality) {
        await applyPibMunicipalityContextEffect(layerGlobal);
    } else {
        await clearPibMunicipalityContextEffect();
    }

    if (useDepartmentContextForMunicipality && view) {
        try {
            const extent = (await layerGlobal.queryExtent({ where: mapWhere }))?.extent;
            if (extent && !layerGlobal.destroyed) {
                await view.goTo(extent.expand?.(1.18) || extent, { duration: 700 });
            }
        } catch (error) {
            console.warn("No se pudo hacer zoom departamental para valor agregado:", error);
        }
    }

    const legendRendererField = layerGlobal?.renderer?.field || config.chartConfig?.rendererField;
    if (!layerGlobal || layerGlobal.destroyed) return;
    await forceRendererLegendForLayer(layerGlobal, config, legendRendererField, mapWhere);
    window.setTimeout(() => {
        if (!layerGlobal || layerGlobal.destroyed) return;
        forceRendererLegendForLayer(layerGlobal, config, layerGlobal.renderer?.field || config.chartConfig?.rendererField, mapWhere);
    }, 250);
}

function renderPibSubitemTabs() {
    activePibSubitem = getPibFlowMode();
    hidePibSubitemTabs();
}

function renderActivePibSubitem(delay = 0) {
    window.setTimeout(async () => {
        if (!isPibActive()) {
            await clearSocioVisualState({
                preservePibTabs: false,
                preserveEconomicTabs: false,
                preserveMainCanvas: true,
                preserveSummary: false,
                preserveLegend: true
            });
            return;
        }

        const activeConfig = getActiveLayerConfig();
        activePibSubitem = getPibFlowMode();
        window.__pibMapVariantKey = getPibVariantKeyForSubitem(activePibSubitem);
        if (activeConfig) {
            activeConfig.chartVariantKey = window.__pibMapVariantKey;
        }
        await clearSocioVisualState({
            preservePibTabs: true,
            preserveEconomicTabs: false,
            preserveMainCanvas: true,
            preserveSummary: false,
            preserveLegend: false
        });
        renderPibSubitemTabs();
        window.__activeSocioChartConfig = activeConfig?.chartConfig || null;
        actualizarResumen();
        if (activePibSubitem === "valor-agregado") {
            setMainPibChartVisible(false);
            setPibMainChartTitle("");
            setPibValueAddedLayout(true);
            await syncPibVariantMap("valor-agregado");
            await pibSectorPieController.renderForSelectedMunicipality();
            await pibEmpresasController.renderForCurrentFilter();
            await forceRendererLegendForLayer(layerGlobal, activeConfig, layerGlobal?.renderer?.field || "pvagregadokmcop");
            window.setTimeout(() => {
                forceRendererLegendForLayer(layerGlobal, activeConfig, layerGlobal?.renderer?.field || "pvagregadokmcop");
            }, 300);
            return;
        }

        await syncPibVariantMap("pib");
        setMainPibChartVisible(true);
        setPibValueAddedLayout(false);
        setPibMainChartTitle("PIB por departamento");
        pibSectorPieController.hidePieChart();
        pibEmpresasController.hideChart();
        renderActiveChartSoon(0);
    }, delay);
}

function isEconomicActivitiesActive() {
    return getActiveLayerConfig()?.key === "ECONOMIC_ACTIVITIES";
}

function getEconomicSubitems() {
    return getActiveLayerConfig()?.chartConfig?.subitems || [];
}

function ensureEconomicSubitemTabs() {
    let container = document.getElementById("economicActivitiesSubitemTabs");
    const chartTitle = document.getElementById("chartTitle");
    if (container) return container;
    if (!chartTitle?.parentNode) return null;
    container = document.createElement("div");
    container.id = "economicActivitiesSubitemTabs";
    container.className = "chart-switch-tabs";
    container.hidden = true;
    chartTitle.insertAdjacentElement("afterend", container);
    return container;
}

function hideEconomicSubitemTabs() {
    const container = document.getElementById("economicActivitiesSubitemTabs");
    if (!container) return;
    container.hidden = true;
    container.innerHTML = "";
}

function ensureEconomicChartSubtitle() {
    let node = document.getElementById("economicChartSubtitle");
    if (node) return node;
    const tabs = document.getElementById("economicActivitiesSubitemTabs");
    const chartTitle = document.getElementById("chartTitle");
    const anchor = tabs || chartTitle;
    if (!anchor?.parentNode) return null;
    node = document.createElement("h4");
    node.id = "economicChartSubtitle";
    node.className = "economic-chart-subtitle pib-sector-title";
    node.hidden = true;
    anchor.insertAdjacentElement("afterend", node);
    return node;
}

function setEconomicChartSubtitle(text = "") {
    const node = ensureEconomicChartSubtitle();
    if (!node) return;
    node.textContent = text || "";
    node.hidden = !text;
}

function hideEconomicChartSubtitle() {
    const node = document.getElementById("economicChartSubtitle");
    if (!node) return;
    node.hidden = true;
    node.textContent = "";
}

function resetTerritorialSelects() {
    cargarDepartamentos();
    renderizarMunicipios();

    const selectDepto = document.getElementById("departamentos");
    const selectMuni = document.getElementById("municipios");

    if (selectDepto) {
        selectDepto.value = "0";
        if (selectDepto.value !== "0") selectDepto.value = "";
    }

    if (selectMuni) {
        selectMuni.value = "";
    }
}

function hideSocioSubtabsUi() {
    const subtabsControls = document.getElementById("subtabsControls");
    if (subtabsControls) {
        subtabsControls.innerHTML = "";
        subtabsControls.style.display = "none";
    }

    document.querySelectorAll(".dropdown-menu-custom .dropdown-item.active").forEach(item => {
        item.classList.remove("active");
    });
}

function resetMapToInitialView() {
    try {
        view?.popup?.close?.();
    } catch (_) {}

    try {
        view?.graphics?.removeAll?.();
    } catch (_) {}

    try {
        map?.layers?.forEach?.(layer => {
            try { map.remove(layer); } catch (_) {}
            try { layer.destroy?.(); } catch (_) {}
        });
    } catch (_) {}

    try {
        view?.goTo?.({ center: [-73.5, 4.5], zoom: 5 }, { duration: 700, easing: "ease-in-out" });
    } catch (_) {}
}

function resetInitialDomState() {
    const chartTitle = document.getElementById("chartTitle");
    if (chartTitle) chartTitle.textContent = "";
    setChartTitle("");

    updateMapViewBadge("PiB Y Valor agregado");

    const summaryDiv = document.getElementById("summaryDiv");
    if (summaryDiv) summaryDiv.innerHTML = "Seleccione un municipio para ver el resumen.";

    const legendTitle = document.getElementById("legendTitle");
    if (legendTitle) legendTitle.textContent = "Leyenda";

    const legendContent = document.getElementById("legendContent");
    if (legendContent) legendContent.innerHTML = "";

    const mapSource = document.getElementById("mapSource");
    if (mapSource) mapSource.textContent = "";
}

function resetMainChartContainer({
    preserveTitle = false,
    preserveCanvasVisibility = false
} = {}) {
    const chartScroll = document.getElementById("pibChartScroll");
    const canvas = document.getElementById("chart");
    const chartStatus = document.getElementById("pibChartStatus");
    const chartTitle = document.getElementById("chartTitle");
    const chartCard = canvas?.closest(".chart-card");

    if (chartScroll) {
        chartScroll.scrollLeft = 0;
        chartScroll.scrollTop = 0;
        chartScroll.style.height = "";
        chartScroll.style.minHeight = "";
        chartScroll.style.maxHeight = "";
        chartScroll.style.overflow = "";
        chartScroll.style.overflowX = "hidden";
        chartScroll.style.overflowY = "hidden";
        chartScroll.style.cursor = "default";
        chartScroll.classList.remove("is-scrollable");
        chartScroll.classList.remove("economic-activities-chart-active");
        if (!preserveCanvasVisibility) chartScroll.style.display = "none";
    }

    if (canvas) {
        if (!preserveCanvasVisibility) canvas.style.display = "none";
        canvas.classList.remove("economic-activities-chart-active");
        canvas.style.height = "";
        canvas.style.minHeight = "";
        canvas.style.maxHeight = "";
        canvas.style.width = "";
        canvas.style.minWidth = "";
        canvas.style.maxWidth = "";
    }

    if (chartCard) {
        chartCard.classList.remove("economic-activities-chart-active");
        chartCard.style.minHeight = "455px";
    }

    chartStatus?.remove?.();
    if (chartTitle && !preserveTitle) chartTitle.textContent = "";
    if (!preserveTitle) setChartTitle("");
}

async function clearSocioVisualState({
    preservePibTabs = false,
    preserveEconomicTabs = false,
    preserveMainCanvas = false,
    preserveSummary = false,
    preserveLegend = false
} = {}) {
    try {
        await clearChartSelections?.();
    } catch (_) {}

    await clearPibMunicipalityContextEffect();

    pibSectorPieController.hidePieChart?.();
    pibSectorPieController.clearMunicipalityHighlight?.();
    pibEmpresasController.hideChart?.();
    censoPecuarioController.hideChart?.();
    evaPieController.hideChart?.();
    window.hideCensoPecuarioPorcinosPanel?.();
    destroyChart?.();
    resetAuxiliaryCharts?.();

    window.__activeSocioChartConfig = null;
    window.__chartLegendOrder = [];
    window.__connectivityDebug = null;

    resetMainChartContainer({
        preserveTitle: false,
        preserveCanvasVisibility: preserveMainCanvas
    });

    if (!preservePibTabs) hidePibSubitemTabs();
    if (!preserveEconomicTabs) hideEconomicSubitemTabs();
    hideEconomicChartSubtitle();

    if (!preserveLegend) {
        try {
            await window.__clearLegendLayerFilters?.();
        } catch (_) {}

        actualizarLeyenda([], [], [], {
            field: null,
            baseWhere: String(whereBase || "1=1").trim() || "1=1",
            layers: []
        });
    }

    if (!preserveSummary) {
        const summaryDiv = document.getElementById("summaryDiv");
        if (summaryDiv) summaryDiv.innerHTML = "";
    }
}

function renderEconomicSubitemTabs() {
    const container = ensureEconomicSubitemTabs();
    const subitems = getEconomicSubitems();
    if (!container || !isEconomicActivitiesActive() || subitems.length <= 1) {
        hideEconomicSubitemTabs();
        return;
    }

    if (!subitems.some(item => item.id === activeEconomicSubitem)) activeEconomicSubitem = subitems[0].id;
    container.hidden = false;
    container.innerHTML = "";
    subitems.forEach(item => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `chart-switch-tab${item.id === activeEconomicSubitem ? " active" : ""}`;
        button.textContent = item.label || item.id;
        button.onclick = () => {
            activeEconomicSubitem = item.id;
            renderEconomicSubitemTabs();
            renderActiveEconomicSubitem(0);
        };
        container.appendChild(button);
    });
}


function isEconomicActivitiesMapLayerReady(activeConfig) {
    if (!activeConfig || activeConfig.key !== "ECONOMIC_ACTIVITIES") return true;
    const expectedUrl = String(activeConfig.url || activeConfig.chartConfig?.layerUrl || activeConfig.chartConfig?.serviceUrl || "").trim();
    const currentUrl = String(layerGlobal?.__sourceUrl || layerGlobal?.url || "").trim();
    return Boolean(layerGlobal && !layerGlobal.destroyed && layerGlobal.visible && currentUrl === expectedUrl);
}

async function zoomToActiveEconomicExtent() {
    if (!isEconomicActivitiesActive() || !layerGlobal || layerGlobal.destroyed || !view) return;

    const activeWhere = String(layerGlobal.definitionExpression || whereBase || "1=1").trim() || "1=1";
    try {
        await layerGlobal.when?.();
        const result = await layerGlobal.queryExtent({ where: activeWhere });
        if (result?.extent) {
            await view.goTo(result.extent.expand?.(1.2) || result.extent);
        }
    } catch (error) {
        console.warn("No se pudo hacer zoom a actividades económicas:", error);
    }
}

function renderActiveEconomicSubitem(delay = 0) {
    const requestId = ++economicSubitemRenderRequestId;
    window.setTimeout(async () => {
        if (requestId !== economicSubitemRenderRequestId) return;
        if (!isEconomicActivitiesActive()) {
            await clearSocioVisualState({
                preservePibTabs: false,
                preserveEconomicTabs: false,
                preserveMainCanvas: !isPibActive(),
                preserveSummary: false,
                preserveLegend: true
            });
            if (!isPibActive()) setMainPibChartVisible(true);
            return;
        }

        const activeConfig = getActiveLayerConfig();
        const subitems = getEconomicSubitems();
        const activeSubitem = subitems.find(item => item.id === activeEconomicSubitem) || subitems[0];

        if (activeConfig?.prioritizeMapRendering && window.__economicMapRenderReadyPromise) {
            await window.__economicMapRenderReadyPromise;
            if (requestId !== economicSubitemRenderRequestId || !isEconomicActivitiesActive()) return;
        }

        if (!isEconomicActivitiesMapLayerReady(activeConfig)) {
            cargarCapaActual();
            return;
        }

        if (!activeSubitem) {
            await clearSocioVisualState({
                preservePibTabs: false,
                preserveEconomicTabs: false,
                preserveMainCanvas: true,
                preserveSummary: false,
                preserveLegend: false
            });
            return;
        }

        activeEconomicSubitem = activeSubitem.id;
        await clearSocioVisualState({
            preservePibTabs: false,
            preserveEconomicTabs: true,
            preserveMainCanvas: true,
            preserveSummary: false,
            preserveLegend: true
        });
        renderEconomicSubitemTabs();
        setChartTitle("");

        const activeChartConfig = activeSubitem.chartConfig || activeConfig?.chartConfig;
        if (
            chartRequiresMunicipality(activeChartConfig)
            && !hasMunicipalitySelection({
                getFiltroNivel: () => filtroNivel,
                getMunicipioActual: () => municipioActual
            })
        ) {
            censoPecuarioController.hideChart?.();
            evaPieController.hideChart?.();
            window.__activeSocioChartConfig = activeChartConfig;
            setMainPibChartVisible(true);
            hideEconomicChartSubtitle();
            showMunicipalityRequiredChartState({
                canvas: document.getElementById("chart"),
                chartConfig: activeChartConfig,
                title: activeChartConfig?.title || activeConfig?.title,
                destroyChart,
                prepareCanvas: prepareVisibleChartCanvas,
                setTitle: setChartTitle,
                setStatus: (canvas, message) => {
                    let status = document.getElementById("pibChartStatus");
                    if (!status) {
                        status = document.createElement("div");
                        status.id = "pibChartStatus";
                        status.className = "pib-chart-status";
                        canvas.insertAdjacentElement("afterend", status);
                    }
                    status.textContent = message;
                }
            });
            actualizarResumen();
            return;
        }

        if (activeSubitem.type === "pie" && activeSubitem.id === "eva-censo-agricola") {
            evaPieController.setConfig(activeSubitem.chartConfig);
            window.__activeSocioChartConfig = activeSubitem.chartConfig;
            hideEconomicChartSubtitle();
            setMainPibChartVisible(true);
            actualizarResumen();
            evaPieController.renderForCurrentFilter();
            return;
        }

        if (activeSubitem.type === "livestockBar" && activeSubitem.chartConfig) {
            setMainPibChartVisible(true);
            actualizarGrafica(null, {
                ...activeConfig,
                chartConfig: activeSubitem.chartConfig
            });
            return;
        }

        if (activeSubitem.type === "economicActivitiesBar" && activeSubitem.chartConfig) {
            setMainPibChartVisible(true);
            await actualizarGrafica(null, {
                ...activeConfig,
                chartConfig: activeSubitem.chartConfig
            });
            if (!activeConfig?.prioritizeMapRendering) {
                await zoomToActiveEconomicExtent();
            }
            return;
        }

        hideEconomicChartSubtitle();
        setMainPibChartVisible(false);
        placeSummaryAfterCensoPecuarioPanel();
        window.__activeSocioChartConfig = activeConfig?.chartConfig || null;
        actualizarResumen();
        censoPecuarioController.renderForCurrentFilter();
    }, delay);
}

function isCensoPecuarioActive() {
    const activeConfig = getActiveLayerConfig?.();
    return activeConfig?.key === "ECONOMIC_ACTIVITIES";
}

function renderPibSectorPieSoon(delay = 450) {
    window.setTimeout(async () => {
        if (isPibActive()) renderPibSubitemTabs();
        if (!isPibActive() || activePibSubitem !== "valor-agregado") {
            pibSectorPieController.hidePieChart();
            return;
        }
        await syncPibVariantMap("valor-agregado");
        await pibSectorPieController.renderForSelectedMunicipality();
    }, delay);
}

function renderPibEmpresasSoon(delay = 450) {
    window.setTimeout(() => {
        if (isPibActive()) renderPibSubitemTabs();
        if (!isPibActive() || activePibSubitem !== "valor-agregado") {
            pibEmpresasController.hideChart();
            return;
        }
        pibEmpresasController.renderForCurrentFilter();
    }, delay);
}

function renderCensoPecuarioSoon(delay = 450) {
    window.setTimeout(() => {
        if (!isCensoPecuarioActive()) {
            censoPecuarioController.hideChart();
            evaPieController.hideChart();  // NUEVO: ocultar EVA
            return;
        }
        renderActiveEconomicSubitem(0);
    }, delay);
}

async function syncPovertyInitialTerritoryFromSelects(config = getActiveLayerConfig()) {
    if (config?.key !== "POVERTY_LEVEL") return false;

    const selectDepto = document.getElementById("departamentos");
    const selectMuni = document.getElementById("municipios");
    const selectedMunicipality = String(selectMuni?.value || "").trim();
    const selectedDepartment = String(selectDepto?.value || "").trim();

    if (selectedMunicipality) {
        const departmentCode = selectedMunicipality.slice(0, 2) || selectedDepartment;
        filtroNivel = "MUNI";
        municipioActual = selectedMunicipality;
        deptoActual = departmentCode;
        whereBase = `mpcodigo = '${selectedMunicipality.replace(/'/g, "''")}'`;
        await cargarInfoMunicipio(selectedMunicipality);
        return true;
    }

    if (selectedDepartment && selectedDepartment !== "0") {
        filtroNivel = "DEPTO";
        deptoActual = selectedDepartment;
        municipioActual = "";
        municipioInfo = null;
        whereBase = `dpcodigo = '${selectedDepartment.replace(/'/g, "''")}'`;
        actualizarResumen();
        return true;
    }

    filtroNivel = "";
    municipioActual = "";
    deptoActual = "";
    municipioInfo = null;
    whereBase = "";
    actualizarResumen();
    return true;
}

window.prepareChartPanelForConfig = prepareChartPanelForConfig;
window.renderActiveChartSoon = renderActiveChartSoon;
window.__clearSocioVisualState = clearSocioVisualState;
window.__syncPovertyInitialTerritoryFromSelects = syncPovertyInitialTerritoryFromSelects;
window.renderPibSectorPieSoon = renderPibSectorPieSoon;
window.renderPibEmpresasSoon = renderPibEmpresasSoon;
window.renderActivePibSubitem = renderActivePibSubitem;
window.renderPibSubitemTabs = renderPibSubitemTabs;
window.renderActiveEconomicSubitem = renderActiveEconomicSubitem;
window.renderEconomicSubitemTabs = renderEconomicSubitemTabs;
window.setEconomicChartSubtitle = setEconomicChartSubtitle;
window.hideEconomicChartSubtitle = hideEconomicChartSubtitle;
window.renderCensoPecuarioSoon = renderCensoPecuarioSoon;

const layerState = {
    get currentMainModule() { return currentMainModule; }, set currentMainModule(value) { currentMainModule = value; },
    get renderCycleId() { return renderCycleId; }, set renderCycleId(value) { renderCycleId = value; },
    get currentMode() { return currentMode; }, set currentMode(value) { currentMode = value; },
    get currentSubLayerIndex() { return currentSubLayerIndex; }, set currentSubLayerIndex(value) { currentSubLayerIndex = value; },
    get layerGlobal() { return layerGlobal; }, set layerGlobal(value) { layerGlobal = value; },
    get layerViewGlobal() { return layerViewGlobal; }, set layerViewGlobal(value) { layerViewGlobal = value; },
    get whereBase() { return whereBase; }, set whereBase(value) { whereBase = value; },
    get municipioActual() { return municipioActual; }, set municipioActual(value) { municipioActual = value; },
    get chartInstance() { return chartInstance; }, set chartInstance(value) { chartInstance = value; },
    get layersGlobal() { return layersGlobal; }, set layersGlobal(value) { layersGlobal = value; },
    get chartLayerGlobal() { return chartLayerGlobal; }, set chartLayerGlobal(value) { chartLayerGlobal = value; },
    get map() { return map; }, set map(value) { map = value; },
    get view() { return view; }, set view(value) { view = value; },
    get scaleHandle() { return scaleHandle; }, set scaleHandle(value) { scaleHandle = value; },
    get updateLegendByExtent() { return updateLegendByExtent; }, set updateLegendByExtent(value) { updateLegendByExtent = value; },
    get filtroNivel() { return filtroNivel; }, set filtroNivel(value) { filtroNivel = value; },
    get deptoActual() { return deptoActual; }, set deptoActual(value) { deptoActual = value; },
    get legendFilterLabel() { return legendFilterLabel; }, set legendFilterLabel(value) { legendFilterLabel = value; }
};


const { cargarCapaActual } = createLayerController({
    state: layerState,
    deps: {
        FeatureLayer,
        getActiveLayerConfig,
        clearLayers,
        setLegendLayer,
        updateMapViewBadge,
        actualizarResumen,
        actualizarGrafica: (...args) => actualizarGrafica(...args),
        renderActiveChartSoon: (...args) => renderActiveChartSoon(...args),
        renderActivePibSubitem: (...args) => renderActivePibSubitem(...args),
        buildFilteredLegendFromLayers: (...args) => buildFilteredLegendFromLayers(...args),
        buildLegendFromRenderer: (...args) => buildLegendFromRenderer(...args),
        actualizarLeyenda,
        actualizarFuente
    }
});

const { renderSubTabs } = createSubtabsController({
    getCurrentMainModule: () => currentMainModule,
    getLayerGlobal: () => layerGlobal,
    getMunicipioActual: () => municipioActual,
    getFiltroNivel: () => filtroNivel,
    getDeptoActual: () => deptoActual,
    setLegendLayer,
    updateMapViewBadge,
    getLayerListForCurrentLevel: (mode) => getLayerListForCurrentLevel(mode),
    getCurrentMode: () => currentMode,
    getCurrentSubLayerIndex: () => currentSubLayerIndex,
    setCurrentSubLayerIndex: (value) => { currentSubLayerIndex = value; },
    hideTimeSlider,
    setTimeSliderTouched,
    cargarCapaActual
});

async function limpiarBusqueda() {
    hideTimeSlider();
    setTimeSliderTouched(false);
    currentMainModule = "SOCIOECONOMICO";
    currentMode = "SOCIOECONOMIC_SOCIAL_DYNAMICS";
    currentSubLayerIndex = 0;
    window.currentSocioTab = "";
    municipioActual = "";
    deptoActual = "";
    filtroNivel = "";
    whereBase = "";
    municipioInfo = null;
    layerViewGlobal = null;
    chartLayerGlobal = null;
    lastHoverWhere = "";
    legendFilterLabel = null;
    activePibSubitem = "pib";
    activeEconomicSubitem = "censo-pecuario";

    setState({ municipio: null, depto: null });
    resetTerritorialSelects();

    await clearSocioVisualState({
        preservePibTabs: false,
        preserveEconomicTabs: false,
        preserveMainCanvas: false,
        preserveSummary: false,
        preserveLegend: false
    });
    clearLayers();
    resetMapToInitialView();
    hideSocioSubtabsUi();
    resetInitialDomState();

    try {
        const url = new URL(window.location.href);
        if (url.searchParams.has("id")) {
            url.searchParams.delete("id");
            window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
        }
    } catch (_) {}
}

window.__resetSocioSearch = limpiarBusqueda;

async function reiniciarConsultaActual() {
    const selectDepto = document.getElementById("departamentos");
    const selectMuni = document.getElementById("municipios");
    const selectedMunicipality = String(selectMuni?.value || municipioActual || "").trim();
    const selectedDepartment = String(selectDepto?.value || deptoActual || "").trim();
    const hasSelectedTerritory = Boolean(
        selectedMunicipality
        || (selectedDepartment && selectedDepartment !== "0" && selectedDepartment !== "COL")
    );

    if (!hasSelectedTerritory) return;

    const config = getActiveLayerConfig();
    if (!config || !view) return;

    hideTimeSlider();
    setTimeSliderTouched(false);
    lastHoverWhere = "";
    legendFilterLabel = null;

    if (highlightHandle) {
        try { highlightHandle.remove(); } catch (_) {}
        highlightHandle = null;
    }
    if (view.popup) {
        try { view.popup.close(); } catch (_) {}
    }

    await clearSocioVisualState({
        preservePibTabs: false,
        preserveEconomicTabs: false,
        preserveMainCanvas: false,
        preserveSummary: false,
        preserveLegend: false
    });

    if (config.key === "POVERTY_LEVEL") {
        await syncPovertyInitialTerritoryFromSelects(config);
    } else {
        const deptoNombre = selectDepto?.options?.[selectDepto?.selectedIndex]?.textContent?.trim() || "";

        if (selectedMunicipality) {
            municipioActual = selectedMunicipality;
            deptoActual = selectedMunicipality.slice(0, 2) || selectedDepartment;
            filtroNivel = "MUNI";
            whereBase = `mpcodigo = '${selectedMunicipality.replace(/'/g, "''")}'`;
        } else if (selectedDepartment && selectedDepartment !== "0" && selectedDepartment !== "COL") {
            deptoActual = selectedDepartment;
            municipioActual = "";
            filtroNivel = "DEPTO";
            municipioInfo = null;

            if (config.key === "PIB_DEPARTMENT") {
                whereBase = `dpcodigo = '${selectedDepartment.replace(/'/g, "''")}'`;
            } else if (config.chartConfig?.filter?.departmentField) {
                const field = config.chartConfig.filter.departmentField;
                const source = config.chartConfig.filter?.valueSource || "label";
                const departmentValue = source === "code" ? selectedDepartment : deptoNombre;
                whereBase = `${field} = '${departmentValue.replace(/'/g, "''")}'`;
            } else {
                whereBase = `dpcodigo = '${selectedDepartment.replace(/'/g, "''")}'`;
            }
        }
    }

    window.prepareChartPanelForConfig?.(config);
    renderCycleId++;

    await cargarCapaActual();

    if (config.key === "ECONOMIC_ACTIVITIES") {
        window.renderActiveEconomicSubitem?.(700);
        window.renderActiveEconomicSubitem?.(1700);
    } else if (config.key === "PIB_DEPARTMENT") {
        window.renderActivePibSubitem?.(700);
        window.renderActivePibSubitem?.(1700);
    } else {
        window.renderActiveChartSoon?.(700);
        window.renderActiveChartSoon?.(1600);
        window.renderActiveEconomicSubitem?.(0);
    }

    if (config.key !== "PIB_DEPARTMENT") {
        window.renderPibSectorPieSoon?.(900);
        window.renderPibEmpresasSoon?.(900);
    }

    window.renderCensoPecuarioSoon?.(900);
    actualizarResumen();
}

const { init: runAppInit } = createInitController({
    setMode: () => { },
    limpiarBusqueda,
    reiniciarConsultaActual,
    cargarMunicipios,
    toggleLegend,
    getCurrentMode: () => currentMode,
    renderControls
});

function init() {
    bindSocioeconomicoDropdown();
    initDropdownDescargables();
    return runAppInit();
}

function syncSocioTerritoryStateFromSelects(selectDepto, selectMuni, municipioId = "", deptoId = "") {
    const nav = globalThis.ModuleNavigation;
    const resolvedDepto = nav?.resolveDeptoSelectValue?.(selectDepto, deptoId)
        || nav?.normalizeDeptoId?.(deptoId)
        || deptoId
        || (municipioId ? municipioId.substring(0, 2) : "");

    if (resolvedDepto && selectDepto?.querySelector(`option[value="${resolvedDepto}"]`)) {
        selectDepto.value = resolvedDepto;
        deptoActual = resolvedDepto;
        renderizarMunicipios(resolvedDepto);
    }

    if (municipioId && selectMuni) {
        filtroNivel = "MUNI";
        municipioActual = municipioId;
        if (!deptoActual && municipioId.length >= 2) {
            deptoActual = municipioId.substring(0, 2);
        }
    } else if (resolvedDepto) {
        filtroNivel = "DEPTO";
        municipioActual = "";
    }
}

async function applySocioeconomicoUrlContext() {
    const nav = globalThis.ModuleNavigation;
    if (!nav?.parseComponentUrlParams) return;

    const urlContext = nav.parseComponentUrlParams();
    const tabTarget = resolveSocioeconomicoTabTarget(urlContext.tab);
    let deptoId = urlContext.deptoId || "";
    const municipioId = urlContext.municipioId || "";

    if (!deptoId && municipioId) {
        deptoId = nav.normalizeDeptoId?.(municipioId.substring(0, 2)) || municipioId.substring(0, 2);
    }

    const selectDepto = document.getElementById("departamentos");
    const selectMuni = document.getElementById("municipios");
    if (!selectDepto || !selectMuni) return;

    const hasTerritory = Boolean(municipioId || deptoId);

    if (tabTarget && hasTerritory) {
        applySocioeconomicoTabState(tabTarget);
    }

    if (municipioId) {
        syncSocioTerritoryStateFromSelects(selectDepto, selectMuni, municipioId, deptoId);
        selectMuni.value = municipioId;
        if (selectMuni.value !== municipioId) {
            console.warn("No se pudo autoseleccionar el municipio desde la URL:", municipioId);
            return;
        }
        selectMuni.dispatchEvent(new Event("change", { bubbles: true }));
        return;
    }

    if (deptoId) {
        syncSocioTerritoryStateFromSelects(selectDepto, selectMuni, "", deptoId);
        const resolvedDepto = nav.resolveDeptoSelectValue?.(selectDepto, deptoId) || deptoId;
        if (!selectDepto.querySelector(`option[value="${resolvedDepto}"]`)) {
            console.warn("No se pudo autoseleccionar el departamento desde la URL:", deptoId);
            return;
        }
        selectDepto.value = resolvedDepto;
        selectDepto.dispatchEvent(new Event("change", { bubbles: true }));
        return;
    }

    if (tabTarget) {
        await handleSocioeconomicoTabChange(tabTarget);
    }
}

async function bootstrapSocieconomicoApp() {
    const urlContext = globalThis.ModuleNavigation?.parseComponentUrlParams?.() || {
        tab: null,
        municipioId: "",
        deptoId: ""
    };
    const hasTerritoryUrl = Boolean(urlContext.municipioId || urlContext.deptoId);
    const hasTabUrl = Boolean(urlContext.tab);

    try {
        await init();
    } catch (error) {
        console.error("Error inicializando socioeconomico:", error);
    }

    bindSelectEvents();
    await applySocioeconomicoUrlContext();

    if (!hasTerritoryUrl && !hasTabUrl) {
        window.prepareChartPanelForConfig?.(getActiveLayerConfig());
        cargarCapaActual();
        window.renderPibSubitemTabs?.();
        window.renderActivePibSubitem?.(900);
        window.renderEconomicSubitemTabs?.();
        window.renderActiveEconomicSubitem?.(900);
    }
}

const { bindSelectEvents } = createSelectsController({
    layersConfig: LAYERS_CONFIG,
    getCurrentMainModule: () => currentMainModule,
    getCurrentMode: () => currentMode,
    getCurrentSubLayerIndex: () => currentSubLayerIndex,
    setCurrentSubLayerIndex: (value) => { currentSubLayerIndex = value; },
    getLayerListForCurrentLevel,
    ensureMunicipalLayerIndex,
    renderizarMunicipios,
    renderControls,
    clearLayers,
    actualizarResumen,
    cargarInfoMunicipio,
    cargarCapaActual,
    getActiveLayerConfig,
    applyWhereToActiveLayers: (...args) => applyWhereToActiveLayers(...args),
    getUpdateLegendByExtent: () => updateLegendByExtent,
    getLayerGlobal: () => layerGlobal,
    getWhereBase: () => whereBase,
    setWhereBase: (value) => { whereBase = value; },
    getChartInstance: () => chartInstance,
    setMunicipioActual: (value) => { municipioActual = value; },
    setMunicipioInfo: (value) => { municipioInfo = value; },
    setFiltroNivel: (value) => { filtroNivel = value; },
    setDeptoActual: (value) => { deptoActual = value; },
    getView: () => view
});

function activateSocioeconomicoTabFromUrl(tabUrl) {
    const target = resolveSocioeconomicoTabTarget(tabUrl);
    if (!target) return;
    handleSocioeconomicoTabChange(target);
}

window.cargarCapaActual = cargarCapaActual;
window.__refreshSocioSummary = actualizarResumen;

bootstrapSocieconomicoApp();
