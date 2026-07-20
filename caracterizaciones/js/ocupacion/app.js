import { State } from "./core/State.js";
import { EventBus } from "./core/EventBus.js";
import { LayerConfig } from "./config/LayerConfig.js";
import { ModeConfig } from "./config/ModeConfig.js";
import { DomainConfig } from "./config/DomainConfig.js";
import { ArcGISQueryService } from "./services/ArcGISQueryService.js";
import { QueryCache } from "./services/QueryCache.js";
import { RequestCoordinator } from "./services/RequestCoordinator.js";
import { OcupacionUtils } from "./utils/OcupacionUtils.js";
import { LegendDataExtractor } from "./legend/LegendDataExtractor.js";
import { LegendRenderer } from "./legend/LegendRenderer.js";
import { escapeHtml, escapeHtmlWithBreaks } from "../shared/security/security-utils.js";
import "./moduleNavigation.js";

const ModuleNavigation = window.ModuleNavigation;

const state = new State();
const eventBus = new EventBus();
const queryCache = new QueryCache({ ttlMs: 300000 });
const requestCoordinator = new RequestCoordinator();
const LAYERS_CONFIG = LayerConfig.layers;
const DEPTO_ONLY_LAYER_IDS = DomainConfig.deptoOnlyLayerIds;
const DEPT_TO_MUNI_LAYER_ID = DomainConfig.deptToMuniLayerId;
const debounce = (...args) => OcupacionUtils.debounce(...args);
const wrapLabel = (...args) => OcupacionUtils.wrapLabel(...args);
const arcRestQuery = (layerUrl, params = {}, options = {}) => ArcGISQueryService.query(layerUrl, params, {
    cache: queryCache,
    cacheKey: buildQueryCacheKey("arcRest", layerUrl, params),
    signal: getActiveRequestSignal(),
    ...options
});
const buildLegendFromRenderer = (...args) => LegendDataExtractor.buildFromRenderer(...args);
const getSymbolColorRGBA = (...args) => LegendDataExtractor.getSymbolColorRGBA(...args);
const sortLegendEntries = (...args) => LegendDataExtractor.sortEntries(...args);
window.ocupacionState = state;
window.ocupacionEventBus = eventBus;

let sliderMode = "zoom";




// let currentSubLayerIndex = 0; // Índice dentro del array de configuration
let currentSubLayerIndex = 0; // Índice dentro del array de configuration
const activeSubLayerIdsByMode = {};

function rememberActiveSubLayer(layerConfig, mode = currentMode) {
    if (!mode || !layerConfig?.id) return;
    activeSubLayerIdsByMode[mode] = layerConfig.id;
}

function restoreSubLayerSelection(list = getLayerListForCurrentLevel(currentMode), mode = currentMode) {
    if (!list?.length) {
        currentSubLayerIndex = 0;
        return null;
    }

    const savedId = activeSubLayerIdsByMode[mode];
    if (savedId) {
        const savedIndex = list.findIndex(layer => layer.id === savedId);
        if (savedIndex !== -1) {
            currentSubLayerIndex = savedIndex;
            return list[savedIndex];
        }
    }

    if (currentSubLayerIndex >= 0 && currentSubLayerIndex < list.length) {
        rememberActiveSubLayer(list[currentSubLayerIndex], mode);
        return list[currentSubLayerIndex];
    }

    currentSubLayerIndex = Math.max(0, Math.min(currentSubLayerIndex, list.length - 1));
    rememberActiveSubLayer(list[currentSubLayerIndex], mode);
    return list[currentSubLayerIndex];
}

function ensureMunicipalLayerIndex(prevId) {
    const list = getLayerListForCurrentLevel(currentMode);

    if (!list || list.length === 0) {
        currentSubLayerIndex = 0;
        return;
    }

    restoreSubLayerSelection(list);

    const mappedId = prevId ? DEPT_TO_MUNI_LAYER_ID[prevId] : null;
    if (mappedId) {
        const idx = list.findIndex(layer => layer.id === mappedId);
        if (idx !== -1) {
            currentSubLayerIndex = idx;
            rememberActiveSubLayer(list[idx]);
            return;
        }
    }

    const cfg = list[currentSubLayerIndex];
    if (cfg && DEPTO_ONLY_LAYER_IDS.has(cfg.id)) {
        const fallbackIdx = list.findIndex(layer => !DEPTO_ONLY_LAYER_IDS.has(layer.id));
        if (fallbackIdx !== -1) {
            currentSubLayerIndex = fallbackIdx;
            rememberActiveSubLayer(list[fallbackIdx]);
        }
    }
}

function getLayerListForCurrentLevel(mode = currentMode) {
    const list = LAYERS_CONFIG[mode] || [];

    // Si estoy filtrando por departamento -> SOLO las depto, o todas si no hay configuradas
    if (filtroNivel === "DEPTO") {
        const deptoOnly = list.filter(l => DEPTO_ONLY_LAYER_IDS.has(l.id));
        if (deptoOnly.length) return deptoOnly;
        return list.filter(l => !DEPTO_ONLY_LAYER_IDS.has(l.id));
    }

    // Si estoy en municipio -> BLOQUEAR las depto
    if (filtroNivel === "MUNI") {
        return list.filter(l => !DEPTO_ONLY_LAYER_IDS.has(l.id));
    }

    // Si no hay nivel (inicio) -> por defecto NO mostrar las depto
    // (evita que se metan “por accidente” antes de escoger municipio)
    return list.filter(l => !DEPTO_ONLY_LAYER_IDS.has(l.id));
}


function clampSubLayerIndex() {
    restoreSubLayerSelection();
}

// Estado Global
// let currentMode = 'DISTRIBUCION_POBLACION'; // modo actual de ocupacion
let currentMode = 'CONTEXTO_HISTORICO'; // modo actual de ocupacion
let currentMainModule = "OCUPACION"; // OCUPACION | ORDENAMIENTO
let currentOrdenamientoTab = "CLASIFICACION_SUELO";
let currentRuralChartView = "CATEGORIA"; // "CATEGORIA" | "USO_PRINCIPAL"

let layerGlobal = null;
let layerViewGlobal = null;
let whereBase = "";
let municipioActual = "";
let chartInstance = null;
let tcChartInstance = null;
let diccionarioMunicipios = {};
let pChartInstances = { 1985: null, 1993: null, 2005: null, 2018: null };
let diccionarioDepartamentos = {};
let todosMunicipios = []; // Array de {codigo, nombre, depto}
let layersGlobal = []; // para manejar múltiples capas (cuencas)
let lineNegraLayers = [];
let lineaNegraTerritoryGeometry = null;
let lineaNegraLoadToken = 0;
const lineaNegraLayerCache = new Map();
let chartLayerGlobal = null;
let activeFeatureLayer = null;
let lastLegendRenderKey = "";
let geoformaSelectedPaisaje = null;
let vocacionSelectedLabel = null;
let lastRenderedLayerKey = "";
const featureLayerCache = new Map();
let contextoHistoricoPeriodoActivo = "Todos";
let contextoHistoricoTimelineKeyActivo = null;

let map = null;
let view = null;
let applyLegendLayerViewFilter = async () => { };
let resetLegendVisualState = () => { };
let getActiveLayerConfigForSync = () => null;

let deptoActual = "";
let filtroNivel = ""; // "", "DEPTO", "MUNI"
const MUNICIPALITY_REQUIRED_SUMMARY_MESSAGE = "Resumen disponible solo al seleccionar un municipio.";

function isDepartmentOnlySelection() {
    return filtroNivel === "DEPTO" && !!deptoActual && !municipioActual;
}

let composicionCampoActivo = "nm";
let tasaCrecimientoCampoActivo = "pt2005";
let indiceComplementarioCampoActivo = "icmgini";
let updateLegendByExtent = null;

function ocupacionGlobal(name) {
    return typeof window !== "undefined" ? window[name] : undefined;
}

const DEPTO_DISPLAY_NAME_OVERRIDES = {
    "00": "Área en litigio",
    "88": "San Andrés y Providencia"
};

function getDepartamentoDisplayName(codigoDepto) {
    const codigo = String(codigoDepto ?? "").trim();
    if (DEPTO_DISPLAY_NAME_OVERRIDES[codigo]) {
        return DEPTO_DISPLAY_NAME_OVERRIDES[codigo];
    }
    return diccionarioDepartamentos[codigo] || codigo;
}

function getMunicipioDisplayName(codigo, nombre = "") {
    const codigoMuni = String(codigo ?? "").trim();
    const nombreMuni = String(nombre ?? "").trim();

    if (codigoMuni === "00000" || nombreMuni === "00000") {
        return "Área en litigio";
    }

    return nombreMuni || diccionarioMunicipios[codigoMuni] || codigoMuni;
}

function sortDepartamentoCodes(codigos = []) {
    return [...codigos].sort((a, b) =>
        getDepartamentoDisplayName(a).localeCompare(getDepartamentoDisplayName(b), "es", { sensitivity: "base" })
    );
}

function applyDepartamentoDictionaryOverrides() {
    Object.entries(DEPTO_DISPLAY_NAME_OVERRIDES).forEach(([codigo, nombre]) => {
        diccionarioDepartamentos[codigo] = nombre;
    });
}

// (opcional) para no crear watchers infinitos al cambiar escala en cuencas
let scaleHandle = null;
let renderCycleId = 0;
let highlightHandle = null;
let lastHoverWhere = "";
const hoverDebounceMs = 120;
let legendState = {
    activeCodes: new Set(),
    selectedCode: null,
    field: null,
    layer: null,
    baseWhere: "1=1"
};
const CONTEXTO_HISTORICO_LEGEND_FIELD = "__contexto_historico_label";
const CONTEXTO_HISTORICO_INDIGENA_LABEL = "Ocupaci\u00f3n Ind\u00edgena";
state.set("legendState", legendState);
let barChartSyncState = null;

function setLegendState(nextLegendState) {
    legendState = nextLegendState;
    state.set("legendState", legendState);
    if (barChartSyncState?.chart) {
        const highlight = legendState?.selectedCode != null
            ? String(legendState.selectedCode)
            : null;
        syncBarChartToLegendState(highlight);
    }
    resetLegendVisualState();
}

function resetLegendFilterState() {
    setLegendState({
        allCodes: [],
        activeCodes: new Set(),
        selectedCode: null,
        field: null,
        layer: null,
        baseWhere: "1=1"
    });
}

function prepareMigrationChartShell(canvas, heightPx) {
    if (!canvas) return;
    const shell = canvas.closest(".migracion-chart-shell");
    if (shell) {
        shell.style.height = `${heightPx}px`;
        shell.style.maxHeight = `${heightPx}px`;
        shell.style.overflow = "hidden";
    }
    canvas.removeAttribute("height");
    canvas.removeAttribute("width");
    canvas.style.height = "100%";
    canvas.style.maxHeight = `${heightPx}px`;
    canvas.style.width = "100%";
}

function resetChartCanvasElement(canvasOrId) {
    const canvas = typeof canvasOrId === "string"
        ? document.getElementById(canvasOrId)
        : canvasOrId;
    if (!canvas) return;

    try {
        const ctx = canvas.getContext?.("2d");
        if (ctx) ctx.clearRect(0, 0, canvas.width || 0, canvas.height || 0);
    } catch (_) { }

    canvas.removeAttribute("height");
    canvas.removeAttribute("width");
    canvas.style.removeProperty("height");
    canvas.style.removeProperty("min-height");
    canvas.style.removeProperty("max-height");
    canvas.style.removeProperty("width");
    canvas.style.removeProperty("min-width");
    canvas.style.removeProperty("max-width");
    canvas.ondblclick = null;
}

function resetChartPanelCanvases(panelOrId) {
    const panel = typeof panelOrId === "string"
        ? document.getElementById(panelOrId)
        : panelOrId;
    if (!panel) return;
    panel.querySelectorAll("canvas").forEach(resetChartCanvasElement);
    panel.querySelectorAll("[id$='Notice']").forEach(el => {
        el.textContent = "";
        el.style.display = "none";
    });
}

function clearLegendForPendingLoad(message = "Cargando información...") {
    resetLegendFilterState();
    const content = document.getElementById("legendContent");
    const title = document.getElementById("legendTitle");
    if (title) title.textContent = "Leyenda";
    if (content) content.innerHTML = `<p class='oot-js-ocupacion-app-1'>${escapeHtml(message)}</p>`;
}

function resetAllChartContainers({ includeMain = true } = {}) {
    if (includeMain) resetChartCanvasElement("chart");
    [
        "piramidesCharts",
        "transicionCharts",
        "indicesCharts",
        "tasaCrecimientoCharts",
        "migracionExternaCharts",
        "migracionInternaCharts",
        "autoreconocimientoCharts",
        "condicionesSeguridadCharts"
    ].forEach(resetChartPanelCanvases);
}

function destroyMainChartCanvas() {
    if (typeof chartInstance !== "undefined" && chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
    }
    barChartSyncState = null;
    const chartCanvas = document.getElementById("chart");
    resetChartCanvasElement(chartCanvas);
}

function hideMainChartCanvasDuringLoad() {
    const chartCanvas = document.getElementById("chart");
    if (!chartCanvas) return;
    chartCanvas.style.display = "none";
    chartCanvas.closest(".chart-card")?.classList.remove("composicion-chart-active");
}

function setConcentracionSummaryPanelActive(active) {
    const chartDiv = document.getElementById("chartDiv");
    const chartCard = document.getElementById("summaryDiv")?.closest(".chart-card");
    chartDiv?.classList.toggle("concentracion-summary-active", !!active);
    chartCard?.classList.toggle("concentracion-summary-active", !!active);
}

function showMainChartCanvasForRender() {
    const chartCanvas = document.getElementById("chart");
    if (!chartCanvas) return null;
    setConcentracionSummaryPanelActive(false);
    chartCanvas.style.display = "block";
    return chartCanvas;
}

function syncLegendToLabelSelection(clickedLabel) {
    new LegendRenderer({
        getLegendState: () => legendState,
        setLegendState
    }).syncToLabelSelection(clickedLabel);
}

function normalizeCategoryLabel(label) {
    if (Array.isArray(label)) return label.join(" ");
    return String(label ?? "").replace(/\s+/g, " ").trim();
}

function getCategoryCodeFromLabel(label) {
    const config = getActiveLayerConfigForSync();
    const cleanLabel = normalizeCategoryLabel(label);

    if (config?.isDistribucion) {
        const map = (typeof densidadLabelToTzn !== "undefined")
            ? densidadLabelToTzn
            : { "Cabecera Municipal": 1, "Centros Poblados": 2, "Rural Disperso": 3 };
        return map[cleanLabel] != null ? String(map[cleanLabel]) : cleanLabel;
    }

    if (config?.isPropiedadRural) {
        const map = {
            "Microfundio": 1,
            "Minifundio": 2,
            "Pequeña propiedad": 3,
            "Pequeña propiedad": 3,
            "Mediana propiedad": 4,
            "Gran propiedad": 5
        };
        return map[cleanLabel] != null ? String(map[cleanLabel]) : cleanLabel;
    }

    if (config?.isComposicion) {
        const map = { "Cabecera": 1, "Centro poblado": 2, "Rural": 3 };
        return map[cleanLabel] != null ? String(map[cleanLabel]) : cleanLabel;
    }

    return cleanLabel;
}

function cloneDatasetForSync(dataset) {
    const clone = { ...dataset };
    Object.keys(clone).forEach(key => {
        if (Array.isArray(clone[key])) clone[key] = [...clone[key]];
    });
    return clone;
}

function filterDatasetByIndexes(dataset, indexes) {
    const filtered = { ...dataset };
    Object.keys(filtered).forEach(key => {
        if (Array.isArray(filtered[key]) && filtered[key].length === dataset.data?.length) {
            filtered[key] = indexes.map(i => filtered[key][i]);
        }
    });
    filtered.data = indexes.map(i => dataset.data[i]);
    return filtered;
}

function registerSyncedBarChart(chart, labels, options = {}) {
    if (!chart || chart.config?.type !== "bar") return;

    const sourceLabels = labels.map(label => Array.isArray(label) ? [...label] : label);
    const sourceDatasets = chart.data.datasets.map(cloneDatasetForSync);
    const codes = (options.codes && options.codes.length === sourceLabels.length)
        ? options.codes.map(code => String(code))
        : sourceLabels.map(getCategoryCodeFromLabel);

    barChartSyncState = {
        chart,
        sourceLabels,
        sourceDatasets,
        codes,
        visibleCodes: [...codes],
        highlightedCode: null
    };

    syncBarChartToLegendState();
}

function syncBarChartToLegendState(highlightCode = barChartSyncState?.highlightedCode || null) {
    if (!barChartSyncState?.chart) return;

    const chart = barChartSyncState.chart;
    const activeCodes = legendState?.field && legendState?.activeCodes instanceof Set
        ? legendState.activeCodes
        : new Set(barChartSyncState.codes);

    const indexes = barChartSyncState.codes
        .map((code, index) => ({ code, index }))
        .filter(item => activeCodes.has(String(item.code)))
        .map(item => item.index);

    barChartSyncState.visibleCodes = indexes.map(i => String(barChartSyncState.codes[i]));
    barChartSyncState.highlightedCode = highlightCode ? String(highlightCode) : null;

    chart.data.labels = indexes.map(i => barChartSyncState.sourceLabels[i]);
    chart.data.datasets = barChartSyncState.sourceDatasets.map(dataset => {
        const nextDataset = filterDatasetByIndexes(dataset, indexes);
        const baseBorderColor = Array.isArray(nextDataset.backgroundColor)
            ? nextDataset.backgroundColor
            : nextDataset.backgroundColor || "#004A69";

        nextDataset.borderColor = barChartSyncState.visibleCodes.map((code, i) => {
            if (barChartSyncState.highlightedCode && String(code) === barChartSyncState.highlightedCode) {
                return "#00364d";
            }
            return Array.isArray(baseBorderColor) ? baseBorderColor[i] : "rgba(0,0,0,0)";
        });
        nextDataset.borderWidth = barChartSyncState.visibleCodes.map(code =>
            barChartSyncState.highlightedCode && String(code) === barChartSyncState.highlightedCode ? 3 : 0
        );

        return nextDataset;
    });

    chart.update();
}

async function applyCurrentLegendSelectionToMap({ zoom = false } = {}) {
    if (!legendState?.layer || !legendState?.field) return;
    await applyLegendLayerViewFilter();

    if (zoom && legendState.layer?.queryExtent) {
        try {
            const res = await legendState.layer.queryExtent({ where: legendState.layer.definitionExpression || "1=1" });
            if (res?.extent) view.goTo(res.extent.expand(1.25));
        } catch (_) { }
    }
}

async function selectOnlyLegendCode(code, { zoom = true } = {}) {
    if (!legendState?.field || !legendState?.allCodes?.length) return false;

    const selectedCode = String(code);
    if (!legendState.allCodes.map(String).includes(selectedCode)) return false;
    if (legendState.activeCodes instanceof Set && !legendState.activeCodes.has(selectedCode)) return false;

    legendState.selectedCode = selectedCode;
    setLegendState(legendState);
    await applyCurrentLegendSelectionToMap({ zoom });
    return true;
}

async function clearLegendSelection({ zoom = true } = {}) {
    if (!legendState?.field || legendState.selectedCode == null) return false;

    legendState.selectedCode = null;
    setLegendState(legendState);
    await applyCurrentLegendSelectionToMap({ zoom });
    return true;
}

async function showAllLegendCodes({ zoom = true } = {}) {
    if (!legendState?.field || !legendState?.allCodes?.length) return false;

    legendState.activeCodes = new Set(legendState.allCodes.map(String));
    legendState.selectedCode = null;
    setLegendState(legendState);
    await applyCurrentLegendSelectionToMap({ zoom });
    return true;
}

let seleccionarMunicipioPorCodigoImpl = null;
let highlightMunicipioOnMapImpl = null;

function supportsMunicipioMapClick(config = {}) {
    return !!(
        config.isDistribucion ||
        config.isPiramides ||
        config.isTransicion ||
        config.isComposicion ||
        config.isTasaCrecimiento ||
        config.isMigracionExterna ||
        config.isMigracionInterna ||
        config.isAutoreconocimientoEtnico ||
        config.isCondicionesSeguridad ||
        config.isIndicesComplementarios
    );
}

function isMunicipioMapClickLayer(graphicLayer) {
    if (!graphicLayer) return false;
    return graphicLayer === layerGlobal ||
        graphicLayer === activeFeatureLayer ||
        graphicLayer === legendState?.layer ||
        (Array.isArray(layersGlobal) && layersGlobal.includes(graphicLayer));
}

function extractMunicipioCodeFromGraphicAttributes(attrs = {}) {
    const rawCode = attrs.mpcodigo ?? attrs.MPCODIGO ?? attrs.MpCodigo;
    return String(rawCode ?? "").trim();
}

async function queryMunicipioCodeFromLayerAtEvent(event, layer) {
    if (!view || !layer || layer.destroyed) return "";

    try {
        const mapPoint = view.toMap({ x: event.x, y: event.y });
        if (!mapPoint) return "";

        const query = layer.createQuery();
        query.geometry = mapPoint;
        query.spatialRelationship = "intersects";
        query.returnGeometry = false;
        query.outFields = ["mpcodigo"];
        query.num = 1;

        const result = await layer.queryFeatures(query);
        const attrs = result?.features?.[0]?.attributes;
        return extractMunicipioCodeFromGraphicAttributes(attrs);
    } catch (error) {
        console.warn("queryMunicipioCodeFromLayerAtEvent error:", error);
        return "";
    }
}

async function resolveMunicipioCodeFromMapClick(event, config) {
    if (!view || !layerGlobal) return "";

    try {
        const response = await view.hitTest(event);
        for (const result of response.results || []) {
            if (!result.graphic?.attributes) continue;
            if (!isMunicipioMapClickLayer(result.graphic.layer)) continue;
            const codigo = extractMunicipioCodeFromGraphicAttributes(result.graphic.attributes);
            if (codigo) return codigo;
        }
    } catch (error) {
        console.warn("resolveMunicipioCodeFromMapClick hitTest error:", error);
    }

    if (config?.isComposicion) {
        const codigo = await queryMunicipioCodeFromLayerAtEvent(event, layerGlobal);
        if (codigo) return codigo;
    }

    return "";
}

async function syncMunicipioFromMapClick(event) {
    if (currentMainModule !== "OCUPACION") return false;

    const config = getActiveLayerConfig();
    if (!supportsMunicipioMapClick(config) || !view || !layerGlobal) return false;

    try {
        const codigo = await resolveMunicipioCodeFromMapClick(event, config);
        if (!codigo) return false;

        if (codigo === municipioActual) {
            if (typeof highlightMunicipioOnMapImpl === "function") {
                await highlightMunicipioOnMapImpl(codigo);
            }
            return true;
        }

        if (typeof seleccionarMunicipioPorCodigoImpl === "function") {
            seleccionarMunicipioPorCodigoImpl(codigo);
            return true;
        }

        return false;
    } catch (error) {
        console.warn("syncMunicipioFromMapClick error:", error);
        return false;
    }
}

async function syncCategoryFromMapClick(event) {
    if (!legendState?.field || !legendState?.layer || !view) return false;

    try {
        const response = await view.hitTest(event);
        const hit = response.results.find(result => {
            const graphicLayer = result.graphic?.layer;
            return graphicLayer && (
                graphicLayer === legendState.layer ||
                graphicLayer === layerGlobal ||
                graphicLayer === activeFeatureLayer ||
                (Array.isArray(layersGlobal) && layersGlobal.includes(graphicLayer))
            );
        });

        const attrs = hit?.graphic?.attributes;
        if (!attrs) return false;

        if (legendState.field === CONTEXTO_HISTORICO_LEGEND_FIELD) {
            const code = normalizeContextoHistoricoLabel(attrs.categoria, attrs.descripcion);
            if (!code) return false;
            return await selectOnlyLegendCode(code, { zoom: false });
        }

        if (!(legendState.field in attrs)) return false;

        const code = String(attrs[legendState.field] ?? "").trim();
        if (!code) return false;

        return await selectOnlyLegendCode(code, { zoom: false });
    } catch (error) {
        console.warn("syncCategoryFromMapClick error:", error);
        return false;
    }
}

function getCacheContextParts() {
    return [
        "ocupacion",
        currentMode,
        activeSubLayerIdsByMode[currentMode] || `IDX_${currentSubLayerIndex}`,
        currentSubLayerIndex,
        filtroNivel || "SIN_FILTRO",
        deptoActual || "SIN_DEPTO",
        municipioActual || "SIN_MUNI",
        whereBase || "1=1"
    ];
}

function normalizeQueryParams(params = {}) {
    return Object.keys(params)
        .sort()
        .map(key => `${key}=${JSON.stringify(params[key])}`)
        .join("&");
}

function buildQueryCacheKey(kind, url, params = {}) {
    return QueryCache.stableKey([
        ...getCacheContextParts(),
        kind,
        url,
        normalizeQueryParams(params)
    ]);
}

function getActiveRequestSignal() {
    return state.get("activeRequestSignal") || undefined;
}

async function fetchJsonCached(url, { cacheKey = url, ttlMs = 300000, signal = getActiveRequestSignal() } = {}) {
    // Optimización: las consultas GET repetidas alimentan mapa, gráfico, leyenda y textos.
    // Cachearlas por contexto evita golpear el servicio al volver entre submenús equivalentes.
    return queryCache.getOrSet(cacheKey, async () => {
        const response = await fetch(url, { signal });
        if (!response.ok) throw new Error(`HTTP ${response.status} consultando ${url}`);
        return response.json();
    }, ttlMs);
}

function getGeometryCachePart(geometry) {
    if (!geometry) return "";
    const extent = geometry.extent || geometry;
    return [
        Math.round((extent.xmin ?? 0) * 1000) / 1000,
        Math.round((extent.ymin ?? 0) * 1000) / 1000,
        Math.round((extent.xmax ?? 0) * 1000) / 1000,
        Math.round((extent.ymax ?? 0) * 1000) / 1000,
        extent.spatialReference?.wkid || ""
    ].join(",");
}

async function queryLayerFeaturesCached(layer, query, kind = "layer-query", ttlMs = 180000) {
    const cacheKey = buildQueryCacheKey(kind, layer?.url || "layer", {
        where: query.where || "1=1",
        outFields: query.outFields || [],
        returnGeometry: query.returnGeometry === true,
        returnDistinctValues: query.returnDistinctValues === true,
        geometry: getGeometryCachePart(query.geometry),
        spatialRelationship: query.spatialRelationship || ""
    });

    // Optimización: cachear resultados de leyenda/gráficos evita repetir la misma
    // queryFeatures cuando solo cambia la visibilidad o se vuelve a un submenú ya cargado.
    return queryCache.getOrSet(cacheKey, () => layer.queryFeatures(query), ttlMs);
}

function beginLoadRequest(scope = "ocupacion:load") {
    const request = requestCoordinator.start(scope);
    state.set("activeRequestSignal", request.signal);
    return request;
}

function isCurrentRequest(request) {
    return requestCoordinator.isCurrent(request);
}

function syncStateSnapshot(extra = {}) {
    state.merge({
        currentMode,
        currentSubLayerIndex,
        activeSubLayerId: activeSubLayerIdsByMode[currentMode] || null,
        municipioActual,
        deptoActual,
        filtroNivel,
        whereBase,
        ...extra
    });
}

eventBus.on("selection:changed", (selection) => {
    state.set("activeSelection", selection);
    state.set("activeFilter", selection?.where || "");

    if (selection?.where && typeof applyWhereToActiveLayers === "function") {
        applyWhereToActiveLayers(selection.where);
    }
});

eventBus.on("selection:cleared", () => {
    state.resetSelection();

    if (typeof applyWhereToActiveLayers === "function") {
        applyWhereToActiveLayers(whereBase || "1=1");
    }
});

function rgbaArrayToCss(arr, fallback = "#999") {
    if (!Array.isArray(arr) || arr.length < 3) return fallback;
    const [r, g, b, a = 255] = arr;
    return `rgba(${r}, ${g}, ${b}, ${a / 255})`;
}




function destroyLayerSafe(layer) {
    try { layer?.destroy?.(); } catch (e) { }
}

function getFeatureLayerCacheKey({ url, definitionExpression = "1=1", outFields = ["*"], role = "map" }) {
    return QueryCache.stableKey([
        "FeatureLayer",
        role,
        url,
        definitionExpression || "1=1",
        Array.isArray(outFields) ? outFields.join(",") : String(outFields)
    ]);
}

function getOrCreateFeatureLayer(options, role, FeatureLayerClass) {
    const cacheKey = getFeatureLayerCacheKey({
        url: options.url,
        definitionExpression: options.definitionExpression,
        outFields: options.outFields,
        role
    });

    const cachedLayer = featureLayerCache.get(cacheKey);
    if (cachedLayer && !cachedLayer.destroyed) {
        cachedLayer.definitionExpression = options.definitionExpression || cachedLayer.definitionExpression || "1=1";
        if (options.orderByFields) cachedLayer.orderByFields = options.orderByFields;
        if (options.renderer) cachedLayer.renderer = options.renderer;
        cachedLayer.visible = options.visible ?? true;
        cachedLayer.opacity = options.opacity ?? cachedLayer.opacity;
        cachedLayer.minScale = options.minScale ?? cachedLayer.minScale;
        cachedLayer.maxScale = options.maxScale ?? cachedLayer.maxScale;
        try { cachedLayer.refresh?.(); } catch (_) { }
        return cachedLayer;
    }

    const layer = new FeatureLayerClass(options);
    layer.__ocupacionCacheKey = cacheKey;
    featureLayerCache.set(cacheKey, layer);
    return layer;
}

function clearLineaNegraLayers({ destroy = false } = {}) {
    lineaNegraLoadToken += 1;
    const cachedLayers = Array.from(lineaNegraLayerCache.values());
    const layersToClear = Array.from(new Set([...lineNegraLayers, ...cachedLayers]));

    layersToClear.forEach(layer => {
        layer.visible = false;
        try { map?.remove(layer); } catch (_) { }
        if (destroy) {
            lineaNegraLayerCache.delete(layer.__lineaNegraId);
            destroyLayerSafe(layer);
        }
    });
    document.querySelector(".legend-linea-negra-group")?.remove();
    lineNegraLayers = [];
    lineaNegraTerritoryGeometry = null;
}

function clearLayers({ preserveContextoHistoricoPeriod = false } = {}) {
    if (!map) return;

    // invalida cargas anteriores
    renderCycleId++;

    if (scaleHandle) {
        try { scaleHandle.remove(); } catch (e) { }
        scaleHandle = null;
    }

    // limpiar highlight activo
    if (highlightHandle) {
        try { highlightHandle.remove(); } catch (e) { }
        highlightHandle = null;
    }

    try { view.graphics.removeAll(); } catch (e) { }

    lastHoverWhere = "";

    // limpiar variantes
    if (layersGlobal.length) {
        layersGlobal.forEach(l => {
            try { map.remove(l); } catch (e) { }
            if (!l.__ocupacionCacheKey) destroyLayerSafe(l);
        });
        layersGlobal = [];
    }

    // Siempre invalida las cargas de Linea Negra. Una consulta anterior puede
    // estar esperando el servicio aunque todavia no haya agregado sus capas.
    clearLineaNegraLayers({ destroy: false });

    // limpiar capa principal
    if (layerGlobal) {
        try { map.remove(layerGlobal); } catch (e) { }
        if (!layerGlobal.__ocupacionCacheKey) destroyLayerSafe(layerGlobal);
    }

    layerGlobal = null;
    chartLayerGlobal = null;
    layerViewGlobal = null;
    activeFeatureLayer = null;
    barChartSyncState = null;
    if (!preserveContextoHistoricoPeriod) {
        contextoHistoricoPeriodoActivo = "Todos";
        contextoHistoricoTimelineKeyActivo = null;
        document.querySelectorAll(".timeline-item.active").forEach(item => item.classList.remove("active"));
    }
    const periodoSlider = document.getElementById("periodoSlider");
    const periodoSliderLabel = document.getElementById("periodoSliderLabel");
    const mapSliderLabel = document.getElementById("mapSliderLabel");
    const timeSliderLabel = document.getElementById("timeSliderLabel");
    if (!preserveContextoHistoricoPeriod) {
        if (periodoSlider) periodoSlider.value = 0;
        if (periodoSliderLabel) periodoSliderLabel.textContent = "Periodo: Todos";
        if (mapSliderLabel) mapSliderLabel.textContent = "Periodo: Todos";
        if (timeSliderLabel) timeSliderLabel.textContent = "Periodo: Todos";
    }

    // limpiar estados de leyenda y selecciones visuales
    lastLegendRenderKey = "";
    setLegendState({
        allCodes: [],
        activeCodes: new Set(),
        field: null,
        layer: null,
        baseWhere: "1=1"
    });

    geoformaSelectedPaisaje = null;
    vocacionSelectedLabel = null;

    // limpiar fuente del mapa
    const fuenteDiv = document.getElementById("mapSource");
    if (fuenteDiv) {
        fuenteDiv.textContent = "";
    }
}

async function cargarDiccionarioMunicipios() {
    try {
        const url = "https://serviciosgeovisor.igac.gov.co:8080/Geovisor/config?cmd=config_diccionario2";
        const json = await fetchJsonCached(url, {
            cacheKey: QueryCache.stableKey(["diccionario-territorial", url]),
            ttlMs: 3600000
        });
        if (json && json.UNIDAD) {
            // Cargar municipios
            json.UNIDAD
                .filter(u => u.type === "MUNI")
                .forEach(m => {
                    if (m.id === "00000") {
                        diccionarioMunicipios[m.id] = "Área en litigio";
                    } else {
                        diccionarioMunicipios[m.id] = m.text;
                    }
                });

            // Cargar departamentos
            json.UNIDAD
                .filter(u => u.type === "DEPTO")
                .forEach(d => {
                    diccionarioDepartamentos[d.id] = d.text;
                });
            applyDepartamentoDictionaryOverrides();
        }
    } catch (e) {
        console.error("Error cargando diccionario", e);
    }
}


function getActiveLayerConfig() {
    const list = getLayerListForCurrentLevel(currentMode);
    return restoreSubLayerSelection(list) || null;
}
getActiveLayerConfigForSync = getActiveLayerConfig;

function getSummaryOutFieldsForCurrentModule() {
    const fields = new Set();
    Object.values(LAYERS_CONFIG).flat().forEach(layerConfig => {
        if (layerConfig.summaryField) fields.add(layerConfig.summaryField);
        (layerConfig.summaryFields || []).forEach(field => fields.add(field));
    });
    return Array.from(fields);
}
function updateMapViewBadge(nombre) {
    const badgeText = document.getElementById("mapViewBadgeText");
    if (!badgeText) return;
    badgeText.textContent = nombre || "Vista";
}
function getCurrentModeLabel(mode = currentMode) {
    return ModeConfig.getLabel(mode);
}


function setLegendLayer(layer, titleText) {
    const title = document.getElementById("legendTitle");
    if (title) title.textContent = titleText || "Leyenda";
}
function initModuleDropdown(dropdownId, triggerId, menuSelector, onItemClick = null) {
    const dropdown = document.getElementById(dropdownId);
    const trigger = document.getElementById(triggerId);
    const menu = dropdown?.querySelector(menuSelector);
    const items = dropdown?.querySelectorAll(".dropdown-item, .dropdown-subitem");

    if (!dropdown || !trigger || !menu || !items?.length) return;

    dropdown.addEventListener("mouseenter", function (e) {
        document.querySelectorAll(".modulo-dropdown.open").forEach(d => {
            if (d !== dropdown) d.classList.remove("open");
        });
        dropdown.classList.add("open");
    });

    dropdown.addEventListener("mouseleave", function (e) {
        dropdown.classList.remove("open");
    });

    items.forEach(item => {
        item.onclick = function (e) {
            e.stopPropagation();

            items.forEach(i => i.classList.remove("active"));
            item.classList.add("active");

            const target = item.dataset.target;

            if (typeof onItemClick === "function") {
                onItemClick(target, item);
            } else {
            }

            dropdown.classList.remove("open");
        };
    });
}

function initAllDropdowns() {
    document.addEventListener("click", function (e) {

        if (e.target.closest(".dropdown-item, .dropdown-subitem")) {
            document.querySelectorAll(".modulo-dropdown.open").forEach(d => d.classList.remove("open"));
            return;
        }

        document.querySelectorAll(".modulo-dropdown.open").forEach(dropdown => {
            if (!dropdown.contains(e.target)) {
                dropdown.classList.remove("open");
            }
        });
    });

    initModuleDropdown("ocupacionDropdown", "ocupacionTrigger", ".dropdown-menu-custom", function (target) {
        if (target.includes("Distribu")) {
            document.getElementById("btnDistribucionPoblacion")?.click();
        } else if (target.includes("Composici")) {
            document.getElementById("btnComposicionPoblacion")?.click();
        } else if (target.includes("Contexto")) {
            document.getElementById("btnContextoHistorico")?.click();
        } else if (target.includes("Tama")) {
            document.getElementById("btnPropiedadRural")?.click();
        }
    });

    initModuleDropdown("limitesDropdown", "limitesTrigger", ".dropdown-menu-custom", function (target) {
        ModuleNavigation.navigateToComponent("limites.html", target);
    });
    initModuleDropdown("ordenamientoDropdown", "ordenamientoTrigger", ".dropdown-menu-custom", function (target) {
        ModuleNavigation.navigateToComponent("ordenamiento.html", target);
    });

    initModuleDropdown("legalDropdown", "legalTrigger", ".dropdown-menu-custom", function (target) {
        ModuleNavigation.navigateToComponent("contexto.html", target);
    });

    initModuleDropdown("biofisicoDropdown", "biofisicoTrigger", ".dropdown-menu-custom", function (target) {
        ModuleNavigation.navigateToComponent("biofisico.html", target);
    });

    initModuleDropdown("socioeconomicoDropdown", "socioeconomicoTrigger", ".dropdown-menu-custom", function (target) {
        ModuleNavigation.navigateToComponent("socioeconomico.html", target);
    });
}

function initDropdownDescargables() {
    const dropdown = document.getElementById("descargablesDropdown");
    const trigger = document.getElementById("btnDescargables");
    const panel = document.getElementById("descargablesMenu");
    const items = document.querySelectorAll(".descargables-menu .descargables-item");

    if (!dropdown || !trigger || !panel) {
        return;
    }

    trigger.onclick = function (e) {
        e.stopPropagation();
        dropdown.classList.toggle("open");
    };

    document.addEventListener("click", function (e) {
        if (!dropdown.contains(e.target)) {
            dropdown.classList.remove("open");
        }
    });

    items.forEach(item => {
        item.onclick = function (e) {
            e.stopPropagation();

            const target = item.dataset.download;

            if (target === "memoria") {
                document.getElementById("btnDescargarPDF")?.click();
            } else if (target === "bd") {
                // aquí pones la lógica real de descarga
                // ejemplo:
                // descargarBaseDatosEspacial();
            }

            dropdown.classList.remove("open");
        };
    });
}

initAllDropdowns();
initDropdownDescargables();


require([
    "esri/Map",
    "esri/views/MapView",
    "esri/layers/FeatureLayer",
    "esri/layers/ImageryLayer",
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

], function (EsriMap, MapView, FeatureLayer, ImageryLayer, Basemap, TileLayer, VectorTileLayer, Legend,
    GraphicsLayer, Graphic, Extent, Home, Locate, BasemapGallery, Expand, ScaleBar) {


    const igacSatelitalTopo = new Basemap({
        title: "Mapa Satelital-Topográfico Colombia",
        baseLayers: [
            new TileLayer({
                url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
                attribution: "Earthstar Geographics"
            }),
            new TileLayer({
                url: "https://tiles.arcgis.com/tiles/RVvWzU3lgJISqdke/arcgis/rest/services/BasemapRaster/MapServer",
                attribution: "Instituto Geográfico Agustín Codazzi - IGAC"
            }),
            new VectorTileLayer({
                url: "https://tiles.arcgis.com/tiles/RVvWzU3lgJISqdke/arcgis/rest/services/BasemapOTT20240925/VectorTileServer",
                attribution: "IGAC"
            })
        ]
    });

    const overviewSatelliteBasemap = new Basemap({
        title: "Mapa satelital",
        baseLayers: [
            new TileLayer({
                url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
                attribution: "Earthstar Geographics"
            })
        ]
    });

    map = new EsriMap({
        basemap: igacSatelitalTopo,
        layers: []
    });


    view = new MapView({
        container: "mapDiv",
        map: map,
        center: [-73.5, 4.5],
        zoom: 5,
        ui: {
            components: ["attribution"]
        }
    });
    view.on("click", async (event) => {
        const handledMunicipio = await syncMunicipioFromMapClick(event);
        if (handledMunicipio) return;

        const handledCategory = await syncCategoryFromMapClick(event);
        if (handledCategory) return;

        if (typeof manejarClickMapaAreasActividad === "function") {
            await manejarClickMapaAreasActividad(event);
        }
    });

    // Tooltip flotante para mapas
    let hoverTooltip = document.getElementById("hoverTooltip");
    if (!hoverTooltip) {
        hoverTooltip = document.createElement("div");
        hoverTooltip.id = "hoverTooltip";
        hoverTooltip.style.position = "absolute";
        hoverTooltip.style.background = "rgba(0, 0, 0, 0.75)";
        hoverTooltip.style.color = "white";
        hoverTooltip.style.padding = "8px 12px";
        hoverTooltip.style.borderRadius = "6px";
        hoverTooltip.style.pointerEvents = "none";
        hoverTooltip.style.display = "none";
        hoverTooltip.style.zIndex = "999";
        hoverTooltip.style.fontSize = "12px";
        hoverTooltip.style.lineHeight = "1.5";
        document.body.appendChild(hoverTooltip);
    }

    view.on("pointer-move", async (event) => {
        const config = getActiveLayerConfig();

        if (!config || (!config.isAutoreconocimientoEtnico && !config.isIndicesComplementarios)) {
            if (hoverTooltip) hoverTooltip.style.display = "none";
            return;
        }
        const response = await view.hitTest(event);
        const graphicHit = response.results.find(r => r.graphic && layerGlobal && r.graphic.layer === layerGlobal);

        if (graphicHit) {
            const attrs = graphicHit.graphic.attributes;

            if (config.isAutoreconocimientoEtnico) {
                const pobtet = Number(attrs.pobtet) || 0;
                const ind = Number(attrs.pobindig) || 0;
                const afro = Number(attrs.pobnmaa) || 0;
                const git = Number(attrs.pobgt) || 0;
                const rai = Number(attrs.pobrz) || 0;
                const pal = Number(attrs.pobpq) || 0;

                let html = `<strong class="oot-js-ocupacion-app-2">Autoreconocimiento Étnico</strong><br>`;
                html += `Total capa: <b class="oot-js-ocupacion-app-3">${pobtet.toLocaleString('es-CO')}</b><hr class="oot-js-ocupacion-app-4">`;
                let hasData = false;

                if (ind > 0) { html += `Indígenas: <b>${ind.toLocaleString('es-CO')}</b><br>`; hasData = true; }
                if (afro > 0) { html += `Afrodescendientes: <b>${afro.toLocaleString('es-CO')}</b><br>`; hasData = true; }
                if (git > 0) { html += `Gitanos: <b>${git.toLocaleString('es-CO')}</b><br>`; hasData = true; }
                if (rai > 0) { html += `Raizales: <b>${rai.toLocaleString('es-CO')}</b><br>`; hasData = true; }
                if (pal > 0) { html += `Palenqueros: <b>${pal.toLocaleString('es-CO')}</b>`; hasData = true; }

                if (!hasData) html += `Sin datos`;
                hoverTooltip.innerHTML = html;

            } else if (config.isIndicesComplementarios) {

                // const mpNombre = attrs.mpnombre || attrs.mpcodigo || "";
                const vGini = Number(attrs.icmgini) || 0;
                const vTheil = Number(attrs.icmtheil) || 0;
                const vDispSup = Number(attrs.icmdispsup) || 0;
                const vDispInf = Number(attrs.icmdispinf) || 0;
                const vInformal = Number(attrs.icminformalporc) || 0;

                let html = `<strong class="oot-js-ocupacion-app-2">Índices Complementarios</strong>`;
                // if (mpNombre) html += `<br><span class="oot-js-ocupacion-app-5">${mpNombre}</span>`;                        
                html += `<hr class="oot-js-ocupacion-app-4">`;

                html += `<span class="oot-js-ocupacion-app-6">■</span> Gini: <b>${vGini.toFixed(5)}</b><br>`;
                html += `<span class="oot-js-ocupacion-app-7">${gini(vGini) || "Sin rango"}</span><br>`;

                html += `<span class="oot-js-ocupacion-app-8">■</span> Theil: <b>${vTheil.toFixed(5)}</b><br>`;
                html += `<span class="oot-js-ocupacion-app-7">${theil(vTheil) || "Sin rango"}</span><br>`;

                html += `<span class="oot-js-ocupacion-app-9">■</span> Disp. Superior: <b>${vDispSup.toFixed(5)}</b><br>`;
                html += `<span class="oot-js-ocupacion-app-7">${disparidadSuperior(vDispSup) || "Sin rango"}</span><br>`;

                html += `<span class="oot-js-ocupacion-app-10">■</span> Disp. Inferior: <b>${vDispInf.toFixed(5)}</b><br>`;
                html += `<span class="oot-js-ocupacion-app-7">${disparidadInferior(vDispInf) || "Sin rango"}</span><br>`;

                html += `<span class="oot-js-ocupacion-app-11">■</span> Informalidad: <b>${vInformal.toFixed(2)}%</b><br>`;
                html += `<span class="oot-js-ocupacion-app-7">${informalidad(vInformal) || "Sin rango"}</span>`;

                hoverTooltip.innerHTML = html;
            }

            hoverTooltip.style.display = "block";
            hoverTooltip.style.left = (event.x + 15) + "px";
            hoverTooltip.style.top = (event.y + 15) + "px";
        } else {
            if (hoverTooltip) hoverTooltip.style.display = "none";
        }
    });

    view.on("pointer-leave", () => {
        if (hoverTooltip) hoverTooltip.style.display = "none";
    });
    let extentInicial = null;

    view.when(() => {

        extentInicial = view.map.initialViewProperties?.extent?.clone() || view.extent.clone();
        hideTimeSlider();

        const btnZoomIn = document.getElementById("btnZoomIn");
        const btnZoomOut = document.getElementById("btnZoomOut");

        if (btnZoomIn) {
            btnZoomIn.onclick = () => {
                view.goTo({
                    zoom: view.zoom + 1
                });
            };
        }

        if (btnZoomOut) {
            btnZoomOut.onclick = () => {
                view.goTo({
                    zoom: view.zoom - 1
                });
            };
        }

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

    masterSlider.addEventListener("input", function () {
        if (sliderMode === "time") {
            handleTimeSliderInput(Number(this.value) || 0);
            return;
        }

        view.zoom = Number(this.value);
    });

    view.watch("zoom", function (z) {
        if (sliderMode === "zoom") {
            masterSlider.value = z;
        }
    });


    function hideTimeSlider() {
        timeSliderEnabled = false;
        timeSliderPeriods = [];
        timeSliderIndex = 0;
        timeSliderTouched = false;
        timeSliderContextKey = "";

        sliderMode = "zoom";

        masterSlider.min = 2;
        masterSlider.max = 12;
        masterSlider.step = 0.1;
        masterSlider.value = view.zoom;

        const container = document.getElementById("zoomSliderContainer");
        const mapSliderLabel = document.getElementById("mapSliderLabel");

        if (container) {
            container.classList.remove("time-mode");
            container.style.display = "none";
        }

        if (mapSliderLabel) {
            mapSliderLabel.textContent = "";
        }
    }
    window.hideTimeSlider = hideTimeSlider;

    function actualizarFuente(layer) {
        if (!layer || layer.isTable) return;

        layer.queryFeatures({
            where: "1=1",
            outFields: ["Fuente"],
            num: 1,
            returnGeometry: false
        }).then((result) => {
            if (result && result.features && result.features.length > 0) {
                const fuente = result.features[0].attributes.Fuente;
                const fuenteDiv = document.getElementById("mapSource");
                if (fuenteDiv && fuente) {
                    fuenteDiv.textContent = "Fuente: " + fuente;
                }
            }
        }).catch(err => {
        });
    }

    function renderSubTabs() {
        const container = document.getElementById("subtabsControls");
        if (!container) return;

        container.innerHTML = "";

        // =========================
        // ORDENAMIENTO - ZONIFICACIÓN RURAL
        // =========================
        if (
            currentMainModule === "ORDENAMIENTO" &&
            currentOrdenamientoTab === "ZONIFICACION_RURAL"
        ) {
            container.style.display = "flex";

            const tabs = [
                { key: "CATEGORIA", label: "Categorías rurales" },
                { key: "USO_PRINCIPAL", label: "Uso principal" }
            ];

            tabs.forEach(tab => {
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = "subtab-btn" + (currentRuralChartView === tab.key ? " active" : "");
                btn.textContent = tab.label;

                btn.onclick = function () {
                    currentRuralChartView = tab.key;
                    renderSubTabs();

                    if (
                        currentMainModule === "ORDENAMIENTO" &&
                        currentOrdenamientoTab === "ZONIFICACION_RURAL" &&
                        layerGlobal
                    ) {
                        const config = ORDENAMIENTO_CONFIG[currentOrdenamientoTab];

                        let whereOrdenamiento = "1=1";
                        const filterField = config.filterField || "mpcodigo";

                        if (municipioActual) {
                            whereOrdenamiento = `${filterField} = '${String(municipioActual).replace(/'/g, "''")}'`;
                        } else if (filtroNivel === "DEPTO" && deptoActual) {
                            if (config.deptoFilterField) {
                                whereOrdenamiento = `${config.deptoFilterField} = '${String(deptoActual).replace(/'/g, "''")}'`;
                            } else if (
                                filterField.toLowerCase() === "mpcodigo" ||
                                filterField.toLowerCase() === "mp_codigo"
                            ) {
                                whereOrdenamiento = `SUBSTRING(${filterField},1,2) = '${String(deptoActual).replace(/'/g, "''")}'`;
                            }
                        }

                        layerGlobal.definitionExpression = whereOrdenamiento;
                        setLegendLayer(layerGlobal, config.title);
                        updateMapViewBadge(config.title);
                        renderZonificacionRuralCharts(layerGlobal, config, whereOrdenamiento);
                    }
                };

                container.appendChild(btn);
            });

            return;
        }

        // ORDENAMIENTO: no mostrar subtabs en otras pestañas
        if (currentMainModule === "ORDENAMIENTO") {
            container.style.display = "none";
            return;
        }

        const list = getLayerListForCurrentLevel(currentMode) || [];
        restoreSubLayerSelection(list);

        if (!list.length) {
            container.style.display = "none";
            return;
        }

        container.style.display = "flex";

        list.forEach((cfg, idx) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "subtab-btn" + (idx === currentSubLayerIndex ? " active" : "");
            btn.textContent = cfg.title || `Capa ${idx + 1}`;

            btn.onclick = function () {
                if (typeof hideTimeSlider === "function") {
                    hideTimeSlider();
                }
                timeSliderTouched = false;
                if (cfg?.isTasaCrecimiento) {
                    destroyMainChartCanvas();
                    if (typeof destroyTasaCrecimientoCharts === "function") destroyTasaCrecimientoCharts();
                    if (typeof toggleTasaCrecimientoCharts === "function") toggleTasaCrecimientoCharts(true);
                    const title = document.getElementById("chartTitle");
                    if (title) title.textContent = cfg.title || "Tasa de crecimiento intercensal";
                }
                if (cfg?.isMigracionExterna) {
                    destroyMainChartCanvas();
                    if (typeof destroyMigracionExternaCharts === "function") destroyMigracionExternaCharts();
                    if (typeof toggleMigracionExternaCharts === "function") toggleMigracionExternaCharts(true);
                    const title = document.getElementById("chartTitle");
                    if (title) title.textContent = cfg.title || "Migración Externa";
                }
                if (cfg?.isMigracionInterna) {
                    destroyMainChartCanvas();
                    if (typeof destroyMigracionInternaCharts === "function") destroyMigracionInternaCharts();
                    if (typeof toggleMigracionInternaCharts === "function") toggleMigracionInternaCharts(true);
                    const title = document.getElementById("chartTitle");
                    if (title) title.textContent = cfg.title || "Migración Interna";
                }
                if (cfg?.isComposicion) {
                    prepareComposicionChartPanel();
                    const title = document.getElementById("chartTitle");
                    if (title) title.textContent = cfg.title || "Estructura población edad y área";
                }
                if (cfg?.isAutoreconocimientoEtnico) {
                    destroyMainChartCanvas();
                    if (typeof destroyAutoreconocimientoCharts === "function") destroyAutoreconocimientoCharts();
                    if (typeof toggleAutoreconocimientoCharts === "function") toggleAutoreconocimientoCharts(true);
                    const title = document.getElementById("chartTitle");
                    if (title) title.textContent = cfg.title || "Autoreconocimiento étnico";
                }
                if (cfg?.isCondicionesSeguridad) {
                    destroyMainChartCanvas();
                    if (typeof destroyCondicionesSeguridadCharts === "function") destroyCondicionesSeguridadCharts();
                    if (typeof toggleCondicionesSeguridadCharts === "function") toggleCondicionesSeguridadCharts(true);
                    const title = document.getElementById("chartTitle");
                    if (title) title.textContent = cfg.title || "Condiciones de seguridad";
                }
                currentSubLayerIndex = idx;
                rememberActiveSubLayer(cfg);
                renderSubTabs();

                const canLoadWithoutTerritory =
                    cfg?.isDistribucion ||
                    cfg?.isConcentracionPoblacion ||
                    cfg?.isComposicion ||
                    cfg?.isTasaCrecimiento ||
                    cfg?.isMigracionExterna ||
                    cfg?.isMigracionInterna ||
                    cfg?.isIndicesComplementarios ||
                    cfg?.isAutoreconocimientoEtnico ||
                    cfg?.isCondicionesSeguridad ||
                    cfg?.isContextoHistorico;

                if (municipioActual || (filtroNivel === "DEPTO" && deptoActual) || canLoadWithoutTerritory) {
                    cargarCapaActual();
                }
            };

            container.appendChild(btn);
        });
    }

    const scaleBar = new ScaleBar({
        view: view,
        unit: "metric",     // metric | non-metric | dual
        style: "ruler"      // ruler | line
    });

    view.ui.add(scaleBar, {
        position: "bottom-left"
    });

    // --- Widgets nativos ---
    const homeWidget = new Home({ view });
    const locateWidget = new Locate({
        view,
        useHeadingEnabled: false,
        goToOverride: (view, goToParams) => view.goTo(goToParams.target, { duration: 800 })
    });

    // BasemapGallery (usa tu basemap actual y los default de Esri)
    const basemapGallery = new BasemapGallery({
        view,
        container: "basemapGalleryDiv"
    });

    // --- Botón HOME (Inicio) ---
    document.getElementById("btnHome").addEventListener("click", () => {
        homeWidget.go();
    });

    // --- Botón UBICACIÓN ACTUAL ---
    document.getElementById("btnLocate").addEventListener("click", () => {
        locateWidget.locate();
    });

    document.getElementById("btnResetZoom").addEventListener("click", () => {
        view.goTo({
            center: [-73.5, 4.5],
            zoom: 5
        }, {
            duration: 700,
            easing: "ease-in-out"
        });
    });

    // --- Botón VISTA GENERAL (toggle minimapa) ---
    const overviewDivEl = document.getElementById("overviewDiv");
    const overviewMiniToggle = document.getElementById("overviewMiniToggle");

    overviewMiniToggle.addEventListener("click", (e) => {
        e.stopPropagation();

        const minimized = overviewDivEl.classList.toggle("minimized");
        overviewMiniToggle.textContent = minimized ? "+" : "−";
        overviewMiniToggle.title = minimized ? "Expandir mapa" : "Minimizar mapa";

        if (!minimized) {
            setTimeout(() => {
                overviewView?.resize?.();
                syncOverviewExtent();
                drawMainExtent();
            }, 50);
        }
    });

    // --- Botón BASEMAPS (toggle panel) ---
    const btnBasemaps = document.getElementById("btnBasemaps");
    const basemapPanel = document.getElementById("basemapPanel");
    const basemapWrap = document.querySelector(".tool-dropdown-wrap");

    btnBasemaps.addEventListener("click", (e) => {
        e.stopPropagation();

        const visible = basemapPanel.style.display !== "none";
        basemapPanel.style.display = visible ? "none" : "block";
    });

    // cerrar al hacer clic fuera
    document.addEventListener("click", (e) => {
        if (!basemapWrap.contains(e.target)) {
            basemapPanel.style.display = "none";
        }
    });


    // ====== OVERVIEW (MINIMAPA DE LOCALIZACIÓN) ======
    const overviewMap = new EsriMap({
        basemap: overviewSatelliteBasemap
    });

    overviewMap.watch("basemap", (nextBasemap) => {
        if (nextBasemap !== overviewSatelliteBasemap) {
            overviewMap.basemap = overviewSatelliteBasemap;
        }
    });

    const overviewGraphics = new GraphicsLayer({ listMode: "hide" });
    overviewMap.add(overviewGraphics);

    const overviewView = new MapView({
        container: "overviewMap",
        map: overviewMap,
        constraints: { rotationEnabled: false },
        ui: { components: [] }
    });



    // --- Mantener escala proporcional (no exagerada)
    function syncOverviewExtent() {
        if (!view || !overviewView || !view.extent) return;
        if (overviewDivEl.classList.contains("minimized")) return;

        const center = view.extent.center;
        const width = view.extent.width * 4;
        const height = view.extent.height * 4;

        overviewView.extent = new Extent({
            xmin: center.x - width / 2,
            ymin: center.y - height / 2,
            xmax: center.x + width / 2,
            ymax: center.y + height / 2,
            spatialReference: view.extent.spatialReference
        });
    }

    function drawMainExtent() {
        if (!view?.extent) return;
        if (overviewDivEl.classList.contains("minimized")) return;

        overviewGraphics.removeAll();

        const graphic = new Graphic({
            geometry: view.extent.clone(),
            symbol: {
                type: "simple-fill",
                color: [0, 120, 255, 0.03],
                outline: {
                    color: [0, 120, 255, 0.9],
                    width: 2
                }
            }
        });

        overviewGraphics.add(graphic);
    }

    // Sincronizar cuando el mapa principal termina de moverse
    view.watch("stationary", (isStationary) => {
        if (isStationary) {
            syncOverviewExtent();
            drawMainExtent();
        }
    });

    // Primera carga
    overviewView.when(() => {
        syncOverviewExtent();
        drawMainExtent();
    });

    // ---- MOVIMIENTO SUAVE REAL ----
    let isDragging = false;

    overviewView.on("drag", (event) => {
        event.stopPropagation();

        const mapPoint = overviewView.toMap(event);

        if (!mapPoint) return;

        if (event.action === "start") {
            isDragging = true;
        }

        if (isDragging) {
            // Movimiento suave continuo sin animación brusca
            view.center = mapPoint;
        }

        if (event.action === "end") {
            isDragging = false;
        }
    });

    function updateNavbarActive(mode) {
        document.querySelectorAll("#navbar button").forEach(b => b.classList.remove("active"));

        // Mapa de modos → IDs de botones del navbar de Ocupación
        const map = {
            DISTRIBUCION_POBLACION: "btnDistribucionPoblacion",
            COMPOSICION_POBLACION: "btnComposicionPoblacion",
            CONTEXTO_HISTORICO: "btnContextoHistorico",
            TAMANO_DISTRIBUCION_PROPIEDAD: "btnPropiedadRural"
        };

        const id = map[mode];
        if (id) document.getElementById(id)?.classList.add("active");

        syncDropdownOcupacion(mode);
    }

    function syncDropdownOcupacion(mode) {
        const items = document.querySelectorAll("#dropdownOcupacion .dropdown-item");
        if (!items.length) return;

        items.forEach(i => i.classList.remove("active"));

        const map = {
            DISTRIBUCION_POBLACION: "itemDistribucionPoblacion",
            COMPOSICION_POBLACION: "itemComposicionPoblacion",
            CONTEXTO_HISTORICO: "itemContextoHistorico",
            TAMANO_DISTRIBUCION_PROPIEDAD: "itemPropiedadRural"
        };

        const activeId = map[mode];
        if (activeId) {
            document.getElementById(activeId)?.classList.add("active");
        }
    }

    // Inicialización



    function init() {
        // Listeners Navbar
        document.getElementById("btnDistribucionPoblacion").onclick = () => setMode("DISTRIBUCION_POBLACION");
        document.getElementById("btnComposicionPoblacion").onclick = () => setMode("COMPOSICION_POBLACION");
        document.getElementById("btnPropiedadRural").onclick = () => setMode("TAMANO_DISTRIBUCION_PROPIEDAD");

        // Listeners Dropdown
        document.getElementById("itemContextoHistorico").onclick = () => setMode("CONTEXTO_HISTORICO");
        document.getElementById("itemDistribucionPoblacion").onclick = () => setMode("DISTRIBUCION_POBLACION");
        document.getElementById("itemComposicionPoblacion").onclick = () => setMode("COMPOSICION_POBLACION");
        document.getElementById("itemPropiedadRural").onclick = () => setMode("TAMANO_DISTRIBUCION_PROPIEDAD");


        document.getElementById("btnRefreshBusqueda").onclick = limpiarBusqueda;
        document.getElementById("btnReiniciarConsulta")?.addEventListener("click", reiniciarConsultaActual);

        cargarMunicipios();
        document.getElementById("legendToggle").onclick = toggleLegend;
        setMode(currentMode);
    }

    function limpiarBusqueda() {
        hideTimeSlider();
        timeSliderTouched = false;
        requestCoordinator.abort("ocupacion:load");

        // Reset selects
        const selectDepto = document.getElementById("departamentos");
        const selectMuni = document.getElementById("municipios");

        if (selectDepto) selectDepto.value = "COL";
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
        barChartSyncState = null;

        // Limpiar capas y filtros del mapa
        clearLayers();

        // Limpiar highlights
        if (highlightHandle) {
            try { highlightHandle.remove(); } catch (e) { }
            highlightHandle = null;
        }

        // Limpiar gráfica
        if (chartInstance) {
            chartInstance.destroy();
            chartInstance = null;
        }

        // Limpiar leyenda
        const legendTitle = document.getElementById("legendTitle");
        const legendContent = document.getElementById("legendContent");
        if (legendTitle) legendTitle.textContent = "Leyenda";
        if (legendContent) {
            legendContent.innerHTML = `<p class="oot-js-ocupacion-app-1">Seleccione un departamento o municipio</p>`;
            legendContent.classList.remove("collapsed");
        }

        // Reiniciar estado visual de leyenda
        setLegendState({
            allCodes: [],
            activeCodes: new Set(),
            field: null,
            layer: null,
            baseWhere: "1=1"
        });

        // Reset subtipo actual solo al limpiar la consulta territorial
        currentSubLayerIndex = 0;
        delete activeSubLayerIdsByMode[currentMode];
        clampSubLayerIndex();
        syncStateSnapshot({ activeSelection: null, activeFilter: "" });
        renderControls();

        if (currentMainModule === "ORDENAMIENTO") {
            updateMapViewBadge("Ordenamiento Territorial");
        } else {
            updateMapViewBadge(getCurrentModeLabel(currentMode));
        }

        // Limpiar resumen
        actualizarResumen();

        // Cerrar popup si existe
        try { view?.closePopup?.(); } catch (_) { }

        // Volver a la vista inicial sin lanzar una nueva consulta.
        resetLegendFilterState();
        lastRenderedLayerKey = "";
        zoomToCurrentTerritory({ duration: 650 });
    }

    function reiniciarConsultaActual() {
        if (currentMainModule !== "OCUPACION") return;

        const selectDepto = document.getElementById("departamentos");
        const selectMuni = document.getElementById("municipios");
        const selectedMunicipality = String(selectMuni?.value || municipioActual || "").trim();
        const selectedDepartment = String(selectDepto?.value || deptoActual || "").trim();
        const hasSelectedTerritory = Boolean(
            selectedMunicipality
            || (selectedDepartment && selectedDepartment !== "0" && selectedDepartment !== "COL")
        );

        if (!hasSelectedTerritory || !view) return;

        if (selectedMunicipality) {
            municipioActual = selectedMunicipality;
            deptoActual = selectedMunicipality.substring(0, 2) || selectedDepartment;
            filtroNivel = "MUNI";
            whereBase = `mpcodigo = '${selectedMunicipality.replace(/'/g, "''")}'`;
        } else {
            municipioActual = "";
            deptoActual = selectedDepartment;
            filtroNivel = "DEPTO";
            whereBase = `dpcodigo = '${selectedDepartment.replace(/'/g, "''")}'`;
        }

        hideTimeSlider();
        timeSliderTouched = false;
        requestCoordinator.abort("ocupacion:load");
        lastHoverWhere = "";
        lastRenderedLayerKey = "";
        resetLegendFilterState();
        syncStateSnapshot({ activeSelection: null, activeFilter: "" });

        clearLayers();
        if (chartInstance) {
            chartInstance.destroy();
            chartInstance = null;
        }

        try { view.closePopup?.(); } catch (_) { }

        cargarCapaActual();
        zoomToCurrentTerritory({ duration: 650 });
    }

    function setMode(mode) {
        if (typeof hideTimeSlider === "function") {
            hideTimeSlider();
        }

        timeSliderTouched = false;
        currentMainModule = "OCUPACION";
        currentMode = mode;
        syncStateSnapshot({ activeSelection: null, activeFilter: "" });

        updateNavbarActive(mode);
        restoreSubLayerSelection();
        renderSubTabs();
        updateMapViewBadge(getCurrentModeLabel(mode));



        if (mode === "CONTEXTO_HISTORICO") {
            if (typeof toggleContextoHistoricoCharts === "function") {
                toggleContextoHistoricoCharts(true);
            }
            if (!municipioActual) {
                document.querySelectorAll('.timeline-item').forEach(item => {
                    item.onclick = async function () {
                        const key = this.getAttribute("data-periodo");
                        const timelinePeriodo = contextoHistoricoTimelineToPeriodo[key] || "Todos";
                        await applyContextoHistoricoPeriodSelection(timelinePeriodo, { timelineKey: key });

                        const sumDiv = document.getElementById("summaryDiv");
                        if (sumDiv) {
                            sumDiv.innerHTML = MUNICIPALITY_REQUIRED_SUMMARY_MESSAGE;
                        }
                    };
                });
            }
        } else {
            contextoHistoricoPeriodoActivo = "Todos";
            contextoHistoricoTimelineKeyActivo = null;
            if (typeof toggleContextoHistoricoCharts === "function") {
                toggleContextoHistoricoCharts(false);
            }
            if (mode === "COMPOSICION_POBLACION") {
                prepareComposicionChartPanel();
            }
        }

        const activeConfig = getActiveLayerConfig();
        const canLoadWithoutTerritory =
            activeConfig?.isContextoHistorico ||
            activeConfig?.isDistribucion ||
            activeConfig?.isConcentracionPoblacion ||
            activeConfig?.isComposicion ||
            activeConfig?.isTasaCrecimiento ||
            activeConfig?.isMigracionExterna ||
            activeConfig?.isMigracionInterna ||
            activeConfig?.isIndicesComplementarios ||
            activeConfig?.isAutoreconocimientoEtnico ||
            activeConfig?.isCondicionesSeguridad;

        if (municipioActual || (filtroNivel === "DEPTO" && deptoActual) || canLoadWithoutTerritory) {
            resetLegendFilterState();
            cargarCapaActual();
        }
    }
    window.setMode = setMode;
    function renderControls() {
        if (currentMainModule === "ORDENAMIENTO") {
            renderSubTabs();
            return;
        }

        clampSubLayerIndex();
        renderSubTabs();
    }
    window.renderControls = renderControls;

    let municipioInfo = null;


    async function cargarInfoMunicipio(codigo) {
        hideTimeSlider();
        timeSliderTouched = false;
        const url = "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componenteocupacion/MapServer/25";
        const summaryFields = getSummaryOutFieldsForCurrentModule();
        const outFields = summaryFields.length ? summaryFields.join(",") : "*";
        const queryUrl = `${url}/query?where=mpcodigo='${codigo}'&outFields=${outFields}&returnGeometry=false&f=json`;
        try {
            const json = await fetchJsonCached(queryUrl, {
                cacheKey: buildQueryCacheKey("municipio-resumen", queryUrl),
                ttlMs: 600000
            });
            if (json.features && json.features.length > 0) {
                municipioInfo = json.features[0].attributes;
            } else {
                municipioInfo = null;
            }
            actualizarResumen();
        } catch (e) {
            if (e?.name === "AbortError" || String(e?.message || "").toLowerCase().includes("aborted")) return;
            console.error("Error cargando info municipio", e);
            municipioInfo = null;
            actualizarResumen();
        }
    }


    function actualizarResumen() {
        const div = document.getElementById("summaryDiv");
        const config = getActiveLayerConfig();

        if (config?.id === "densidad_poblacion" && !municipioActual && filtroNivel !== "DEPTO") {
            div.innerHTML = "Seleccione un municipio para ver el gráfico.";
            return;
        }

        if (isDepartmentOnlySelection()) {
            div.innerHTML = MUNICIPALITY_REQUIRED_SUMMARY_MESSAGE;
            return;
        }
        if (!div) return;

        if (!municipioActual) {
            if (config?.isComposicion || config?.isTasaCrecimiento || config?.isMigracionExterna || config?.isMigracionInterna || config?.isIndicesComplementarios) {
                if (filtroNivel === "DEPTO" && deptoActual) {
                    div.innerHTML = "Seleccione un municipio para ver el resumen descriptivo.";
                } else {
                    div.innerHTML = "Seleccione un municipio para ver el resumen.";
                }
            } else {
                div.innerHTML = "Seleccione un municipio para ver el resumen.";
            }
            return;
        }

        if (config?.isComposicion || config?.isTasaCrecimiento || config?.isMigracionExterna || config?.isMigracionInterna || config?.isIndicesComplementarios || config?.isContextoHistorico) {
            return;
        }

        if (!config || !municipioInfo) {
            div.innerHTML = "Cargando información o no disponible...";
            return;
        }

        const field = config.summaryField;
        if (field && municipioInfo[field]) {
            // div.innerHTML = `<b></b><br>${municipioInfo[field]}`;
            div.innerHTML = ""; // limpia
            const p = document.createElement("p");
            p.textContent = municipioInfo[field]; // seguro
            div.appendChild(p);
        } else {
            div.innerHTML = "No hay información disponible para esta capa.";
        }
    }


    function toggleLegend() {
        const content = document.getElementById("legendContent");
        const toggle = document.getElementById("legendToggle");

        if (content.classList.contains("collapsed")) {
            content.classList.remove("collapsed");
            toggle.textContent = "−";
        } else {
            content.classList.add("collapsed");
            toggle.textContent = "+";
        }
    }

    function actualizarLeyenda(labels, colors, codes = null, styles = null, groups = null, itemWheres = null) {
        try {
            const content = document.getElementById("legendContent");
            const title = document.getElementById("legendTitle");
            const config = getActiveLayerConfig();

            if (!content || !title) return;

            if (!config) {
                content.innerHTML = "<p class='oot-js-ocupacion-app-1'>No hay capa activa</p>";
                title.textContent = "Leyenda";
                return;
            }

            title.textContent = (config.isPiramides || config.isTransicion || config.isMigracionInterna || config.isMigracionExterna)
                ? "Tasa de crecimiento intercensal"
                : (config.title || "Leyenda");
            lastLegendRenderKey = lastLegendRenderKey || "";
            const isDensidadStyleLegend =
                (config?.isDistribucion || config?.isPiramides || config?.isTransicion) &&
                Array.isArray(groups) &&
                groups.length === labels.length;
            const isVisualOnlyDensidadLegend = isDensidadStyleLegend;
            const hasCustomLegendWheres = Array.isArray(itemWheres) && itemWheres.length === labels.length;

            if (!labels || !labels.length) {
                content.innerHTML = "<p class='oot-js-ocupacion-app-1'>Sin clases</p>";
                return;
            }

            let keys = (codes && codes.length === labels.length)
                ? codes.map(v => String(v ?? "").trim())
                : labels.map(v => String(v ?? "").trim());

            // Orden fenómenos
            if (config?.isContextoHistorico) {
                setLegendState({
                    field: CONTEXTO_HISTORICO_LEGEND_FIELD,
                    allCodes: keys,
                    activeCodes: new Set(keys.map(String)),
                    selectedCode: null,
                    layer: activeFeatureLayer || layerGlobal,
                    baseWhere: whereBase || "1=1",
                    itemWheres: null
                });
            } else if (
                codes &&
                codes.length === labels.length &&
                config?.labelField &&
                layerGlobal &&
                (
                    (hasCustomLegendWheres && !isVisualOnlyDensidadLegend) ||
                    (
                        !isVisualOnlyDensidadLegend &&
                        (!legendState?.field || legendState.layer !== layerGlobal || legendState.field !== config.labelField)
                    )
                )
            ) {
                setLegendState({
                    field: config.labelField,
                    allCodes: keys,
                    activeCodes: new Set(keys.map(String)),
                    selectedCode: null,
                    layer: layerGlobal,
                    baseWhere: whereBase || "1=1",
                    itemWheres: hasCustomLegendWheres
                        ? Object.fromEntries(keys.map((key, index) => [String(key), itemWheres[index]]))
                        : null
                });
            }

            if (
                config?.isFenomenos &&
                ["inundaciones", "remocion", "degradacion", "sismica"].includes(config?.fenomenosType)
            ) {
                let orden = null;

                if (config.fenomenosType === "inundaciones" || config.fenomenosType === "remocion") {
                    orden = {
                        "Muy baja": 1,
                        "Baja": 2,
                        "Media": 3,
                        "Alta": 4,
                        "Muy alta": 5,
                        "Sin información": 99
                    };
                }

                if (config.fenomenosType === "degradacion") {
                    orden = ORDEN_DEGRADACION;
                }

                if (config.fenomenosType === "sismica") {
                    orden = ORDEN_SISMICA;
                }

                const items = labels.map((label, index) => ({
                    label,
                    color: colors[index] || "#ccc",
                    code: keys[index],
                    style: (styles && styles[index]) ? styles[index] : "solid"
                }));

                items.sort((a, b) => (orden?.[a.label] ?? 999) - (orden?.[b.label] ?? 999));

                labels = items.map(x => x.label);
                colors = items.map(x => x.color);
                keys = items.map(x => x.code);
                styles = items.map(x => x.style);
            }

            // Render simple y seguro
            content.innerHTML = "";

            const frag = document.createDocumentFragment();

            const showGroupedLegend =
                (config?.isContextoHistorico || config?.isDistribucion || config?.isComposicion || config?.isPiramides || config?.isTransicion) &&
                Array.isArray(groups) &&
                groups.length === labels.length;
            let lastGroupTitle = "";

            labels.forEach((label, i) => {
                if (showGroupedLegend) {
                    const groupTitle = String(groups[i] || "").trim();
                    if (groupTitle && groupTitle !== lastGroupTitle) {
                        const subtitle = document.createElement("div");
                        subtitle.className = "legend-period-subtitle";
                        subtitle.textContent = groupTitle;
                        subtitle.style.position = isDensidadStyleLegend ? "sticky" : "";
                        subtitle.style.top = isDensidadStyleLegend ? "0" : "";
                        subtitle.style.zIndex = isDensidadStyleLegend ? "2" : "";
                        subtitle.style.background = isDensidadStyleLegend ? "#fffdf4" : "";
                        subtitle.style.fontWeight = "700";
                        subtitle.style.fontSize = "12px";
                        subtitle.style.color = "#004A69";
                        subtitle.style.margin = lastGroupTitle ? "10px 0 6px" : "0 0 6px";
                        subtitle.style.padding = isDensidadStyleLegend ? "6px 0 4px" : "4px 0 2px";
                        subtitle.style.borderBottom = "1px solid rgba(0, 74, 105, 0.18)";
                        frag.appendChild(subtitle);
                        lastGroupTitle = groupTitle;
                    }
                }

                const row = document.createElement("div");
                row.className = "legend-row legend-item";
                row.dataset.code = keys[i] ?? label;
                if (itemWheres && itemWheres[i]) row.dataset.where = itemWheres[i];
                row.style.display = "flex";
                row.style.alignItems = "center";
                row.style.gap = "8px";
                row.style.marginBottom = "6px";
                row.style.cursor = "pointer";
                row.title = "Clic para filtrar capa";

                const swatch = document.createElement("span");
                swatch.className = "legend-swatch";
                swatch.style.display = "inline-block";
                swatch.style.width = "12px";
                swatch.style.height = "12px";
                swatch.style.minWidth = "12px";
                swatch.style.borderRadius = "2px";
                swatch.style.marginRight = "8px";
                swatch.style.flex = "0 0 12px";

                const color = colors[i] || "#999";
                const style = (styles && styles[i]) ? styles[i] : "solid";
                const isLineLegend = String(style || "").toLowerCase().includes("line");

                if (isLineLegend) {
                    swatch.style.width = "22px";
                    swatch.style.height = "12px";
                    swatch.style.minWidth = "22px";
                    swatch.style.flex = "0 0 22px";
                    swatch.style.border = "0";
                    swatch.style.borderRadius = "0";
                    swatch.style.background = `linear-gradient(to bottom, transparent 0 5px, ${color} 5px 7px, transparent 7px 100%)`;

                    if (config?.isContextoHistorico) {
                        const arrow = document.createElement("span");
                        arrow.setAttribute("aria-hidden", "true");
                        arrow.style.position = "absolute";
                        arrow.style.right = "-1px";
                        arrow.style.top = "3px";
                        arrow.style.width = "0";
                        arrow.style.height = "0";
                        arrow.style.borderTop = "3px solid transparent";
                        arrow.style.borderBottom = "3px solid transparent";
                        arrow.style.borderLeft = `6px solid ${color}`;
                        swatch.style.position = "relative";
                        swatch.style.overflow = "visible";
                        swatch.appendChild(arrow);
                    }
                } else {
                    swatch.style.border = `1px solid ${color}`;
                }

                if (isLineLegend) {
                    // La línea se dibuja arriba; no necesita relleno de polígono.
                } else if (style === "backward-diagonal" || style === "esriSFSBackwardDiagonal") {
                    swatch.style.background = `repeating-linear-gradient(-45deg, ${color}, ${color} 2px, transparent 2px, transparent 4px)`;
                } else if (style === "forward-diagonal" || style === "esriSFSForwardDiagonal") {
                    swatch.style.background = `repeating-linear-gradient(45deg, ${color}, ${color} 2px, transparent 2px, transparent 4px)`;
                } else if (style === "horizontal" || style === "esriSFSHorizontal") {
                    swatch.style.background = `repeating-linear-gradient(180deg, ${color}, ${color} 2px, transparent 2px, transparent 5px)`;
                } else if (style === "dot-pattern") {
                    swatch.style.backgroundColor = "transparent";
                    swatch.style.backgroundImage = `radial-gradient(circle, ${color} 1.25px, transparent 1.35px)`;
                    swatch.style.backgroundSize = "8px 8px";
                } else if (style === "diagonal-cross" || style === "esriSFSDiagonalCross") {
                    swatch.style.background = `repeating-linear-gradient(-45deg, ${color}, ${color} 1px, transparent 1px, transparent 3px), repeating-linear-gradient(45deg, ${color}, ${color} 1px, transparent 1px, transparent 3px)`;
                } else {
                    swatch.style.background = color;
                }

                const text = document.createElement("span");
                text.className = "legend-label";
                text.textContent = label ?? "Sin etiqueta";

                row.appendChild(swatch);
                row.appendChild(text);
                frag.appendChild(row);
            });

            content.appendChild(frag);
            if (showGroupedLegend && config?.isDistribucion) {
                content.scrollTop = 0;
            }

            if (typeof bindLegendClickOnce === "function") bindLegendClickOnce();
            if (typeof resetLegendVisualState === "function") resetLegendVisualState();

        } catch (e) {
            console.error("actualizarLeyenda error:", e);
        }
    }


    function bindLegendClickOnce() {
        const content = document.getElementById("legendContent");
        if (!content || content.__legendBound) return;

        content.__legendBound = true;

        content.addEventListener("click", async (e) => {
            const item = e.target.closest(".legend-item");
            if (!item) return;

            const code = String(item.dataset.code ?? "").trim();
            if (!code) return;

            const st = legendState;
            if (!st) return;

            if (!(st.activeCodes instanceof Set)) {
                st.activeCodes = new Set((st.allCodes || []).map(v => String(v)));
            }

            if (st.activeCodes.has(code)) {
                st.activeCodes.delete(code);
                if (String(st.selectedCode || "") === code) st.selectedCode = null;
            } else {
                st.activeCodes.add(code);
                st.selectedCode = null;
            }

            setLegendState(st);
            await applyCurrentLegendSelectionToMap({ zoom: false });
        });
    }

    resetLegendVisualState = function resetLegendVisualState() {
        const st = legendState;
        const content = document.getElementById("legendContent");
        if (!content) return;

        if (!st?.field) {
            content.querySelectorAll(".legend-item").forEach(node => node.classList.remove("off"));
            return;
        }

        const allCodes = (st.allCodes || []).map(code => String(code));
        const activeCodes = st.activeCodes instanceof Set
            ? st.activeCodes
            : new Set(allCodes);
        const selectedCode = st.selectedCode != null ? String(st.selectedCode) : null;

        content.querySelectorAll(".legend-item").forEach(node => {
            const code = String(node.dataset.code ?? "").trim();
            if (!code) {
                node.classList.remove("off");
                return;
            }

            const isTrackedCode = !allCodes.length || allCodes.includes(code);
            if (!isTrackedCode) {
                node.classList.remove("off");
                return;
            }

            if (!activeCodes.has(code)) {
                node.classList.add("off");
                return;
            }

            if (selectedCode) {
                node.classList.toggle("off", code !== selectedCode);
                return;
            }

            node.classList.remove("off");
        });
    };

    function getLegendTargetLayers() {
        const candidates = [
            legendState?.layer,
            activeFeatureLayer,
            layerGlobal,
            ...(Array.isArray(layersGlobal) ? layersGlobal : [])
        ];

        return [...new Set(candidates)].filter(layer => layer && !layer.destroyed && !layer.isTable);
    }

    function buildLegendWhere(field, activeCodes, fieldType) {
        if (!field) return null;

        const values = Array.from(activeCodes || []);
        if (!values.length) return "1=0";

        const isNumeric =
            fieldType.includes("small-integer") ||
            fieldType.includes("integer") ||
            fieldType.includes("double") ||
            fieldType.includes("single") ||
            fieldType.includes("long");

        const formattedValues = values.map(code => {
            const value = String(code ?? "").trim();

            if (value === "null" || value === "" || value.toLowerCase() === "nan") {
                return "NULL";
            }

            if (isNumeric) {
                return Number(value);
            }

            return `'${value.replace(/'/g, "''")}'`;
        });

        const nonNullValues = formattedValues.filter(value => value !== "NULL");
        const hasNull = formattedValues.includes("NULL");

        if (nonNullValues.length && hasNull) {
            return `(${field} IN (${nonNullValues.join(",")}) OR ${field} IS NULL)`;
        }

        if (nonNullValues.length) {
            return `${field} IN (${nonNullValues.join(",")})`;
        }

        if (hasNull) {
            return `${field} IS NULL`;
        }

        return "1=0";
    }

    function buildCustomLegendWhere(itemWheres, activeCodes) {
        const values = Array.from(activeCodes || []).map(value => String(value));
        if (!values.length) return "1=0";
        const clauses = values
            .map(value => itemWheres?.[value])
            .filter(Boolean)
            .map(where => `(${where})`);
        return clauses.length ? clauses.join(" OR ") : "1=0";
    }

    function getDensidadOriginalColor(value, layer = layerGlobal, tzn = null) {
        const numericValue = Number(value);
        if (typeof getDensidadColorByZona === "function" && tzn != null) {
            return getDensidadColorByZona(numericValue || 0, tzn, deptoActual || null);
        }

        const infos = layer?.renderer?.classBreakInfos || [];

        if (!Number.isNaN(numericValue) && infos.length) {
            const match = infos.find((info, index) => {
                const minValue = index === 0 && info.minValue == null ? -Infinity : Number(info.minValue ?? -Infinity);
                const maxValue = Number(info.maxValue ?? Infinity);
                return numericValue >= minValue && numericValue <= maxValue;
            });
            const rendererColor = getSymbolColorRGBA(match?.symbol);
            if (rendererColor) return rendererColor;
        }

        if (typeof getColorByDensidad === "function") {
            return getColorByDensidad(numericValue || 0).color;
        }

        return "#999";
    }

    function cargarCapaActual() {
        if (currentMainModule !== "OCUPACION" && currentMainModule !== "ORDENAMIENTO") {
            return;
        }
        const config = getActiveLayerConfig();
        if (!config) return;
        setConcentracionSummaryPanelActive(!!config.isConcentracionPoblacion);

        const layerRequest = beginLoadRequest();
        const layerRenderKey = QueryCache.stableKey([
            ...getCacheContextParts(),
            config.id,
            config.url,
            config.mapLayerUrl || ""
        ]);

        // Optimización: si el filtro/submenú no cambió, evita reconstruir capa,
        // gráfico y leyenda. Esto reduce renders repetidos al reabrir submenús.
        if (lastRenderedLayerKey === layerRenderKey && layerGlobal && !layerGlobal.destroyed && map?.layers?.includes(layerGlobal)) {
            syncStateSnapshot();
            actualizarResumen();
            if (config.isContextoHistorico) {
                if (typeof toggleContextoHistoricoCharts === "function") toggleContextoHistoricoCharts(true);
                setLegendLayer(layerGlobal, config.title);
                actualizarFuente(layerGlobal);
                actualizarGrafica(layerGlobal, config, { skipSyncMap: true });
            } else if (config.isTasaCrecimiento) {
                destroyMainChartCanvas();
                if (typeof toggleTasaCrecimientoCharts === "function") toggleTasaCrecimientoCharts(true);
                const mapWhere = municipioActual && deptoActual
                    ? buildDepartmentMapWhereForConfig(config, deptoActual)
                    : (whereBase || "1=1");
                ensureMapCategorySliderUi({ where: mapWhere, layer: layerGlobal });
                actualizarGrafica(layerGlobal, config, { skipSyncMap: true });
            } else if (config.isMigracionExterna) {
                destroyMainChartCanvas();
                if (typeof toggleMigracionExternaCharts === "function") toggleMigracionExternaCharts(true);
                const mapWhere = municipioActual && deptoActual
                    ? buildDepartmentMapWhereForConfig(config, deptoActual)
                    : (whereBase || "1=1");
                ensureMapCategorySliderUi({ where: mapWhere, layer: layerGlobal });
                actualizarGrafica(layerGlobal, config, { skipSyncMap: true });
            } else if (config.isMigracionInterna) {
                destroyMainChartCanvas();
                if (typeof toggleMigracionInternaCharts === "function") toggleMigracionInternaCharts(true);
                const mapWhere = municipioActual && deptoActual
                    ? buildDepartmentMapWhereForConfig(config, deptoActual)
                    : (whereBase || "1=1");
                ensureMapCategorySliderUi({ where: mapWhere, layer: layerGlobal });
                if (municipioActual) highlightMunicipioOnMap(municipioActual);
                actualizarGrafica(layerGlobal, config, { skipSyncMap: true });
            } else if (config.isComposicion) {
                prepareComposicionChartPanel();
                const isNationalComposicion = !deptoActual && filtroNivel !== "MUNI";
                const mapWhere = municipioActual && deptoActual
                    ? buildDepartmentMapWhereForConfig(config, deptoActual)
                    : (whereBase || "1=1");
                if (layerGlobal) {
                    layerGlobal.definitionExpression = mapWhere;
                    try { layerGlobal.refresh?.(); } catch (_) { }
                }
                ensureComposicionUi({ isNational: isNationalComposicion, deptoCode: deptoActual, where: mapWhere });
                if (municipioActual) highlightMunicipioOnMap(municipioActual);
                actualizarGrafica(layerGlobal, config, { skipSyncMap: true });
            } else if (config.isIndicesComplementarios) {
                const mapWhere = municipioActual && deptoActual
                    ? buildDepartmentMapWhereForConfig(config, deptoActual)
                    : (whereBase || "1=1");
                setupIndicesComplementariosSlider({ where: mapWhere, layer: layerGlobal });
                refreshIndiceComplementarioMapAndLegend({ where: mapWhere, field: indiceComplementarioCampoActivo, layer: layerGlobal });
                if (municipioActual) highlightMunicipioOnMap(municipioActual);
                actualizarGrafica(layerGlobal, config, { skipSyncMap: true });
            } else if (config.isAutoreconocimientoEtnico) {
                destroyMainChartCanvas();
                if (typeof toggleAutoreconocimientoCharts === "function") toggleAutoreconocimientoCharts(true);
                ensureAutoreconocimientoUi({ where: getCurrentTerritoryWhere(), layer: layerGlobal });
                actualizarGrafica(layerGlobal, config, { skipSyncMap: true });
            } else if (config.isCondicionesSeguridad) {
                destroyMainChartCanvas();
                if (typeof toggleCondicionesSeguridadCharts === "function") toggleCondicionesSeguridadCharts(true);
                ensureCondicionesSeguridadUi({ where: getCurrentTerritoryWhere(), layer: layerGlobal });
                actualizarGrafica(layerGlobal, config, { skipSyncMap: true });
            } else if (config.isDistribucion) {
                const dpCode = deptoActual || (municipioActual ? String(municipioActual).slice(0, 2) : "");
                const mapWhere = municipioActual && dpCode
                    ? buildDepartmentMapWhereForConfig(config, dpCode)
                    : (whereBase || "1=1");
                const { buildRenderer } = getDensidadLegendApi();
                if (layerGlobal && typeof buildRenderer === "function") {
                    layerGlobal.renderer = buildRenderer(dpCode || null);
                    layerGlobal.orderByFields = ["tzn"];
                    try { layerGlobal.refresh?.(); } catch (_) { }
                }
                applyWhereToActiveLayers(mapWhere);
                if (municipioActual) highlightMunicipioOnMap(municipioActual);
                actualizarGrafica(layerGlobal, config, { skipSyncMap: true });
            } else if (config.isConcentracionPoblacion) {
                actualizarGrafica(layerGlobal, config, { skipSyncMap: true });
            }
            return;
        }

        lastRenderedLayerKey = layerRenderKey;

        clearLegendForPendingLoad();
        resetAllChartContainers();
        barChartSyncState = null;
        if (typeof window !== "undefined") {
            window.__restoreChartCategoryFilter = null;
            window.__applyLegendRowsToChart = null;
        }

        clearLayers({ preserveContextoHistoricoPeriod: !!config.isContextoHistorico });

        // Reset paneles al cambiar cualquier sub-capa
        if (typeof destroyPiramidesCharts === 'function') destroyPiramidesCharts();
        if (typeof togglePiramidesCharts === 'function') togglePiramidesCharts(false);
        if (typeof destroyTransicionCharts === 'function') destroyTransicionCharts();
        if (typeof toggleTransicionCharts === 'function') toggleTransicionCharts(false);
        if (typeof destroyTasaCrecimientoCharts === 'function') destroyTasaCrecimientoCharts();
        if (typeof toggleTasaCrecimientoCharts === 'function') toggleTasaCrecimientoCharts(false);
        if (typeof destroyMigracionExternaCharts === 'function') destroyMigracionExternaCharts();
        if (typeof toggleMigracionExternaCharts === 'function') toggleMigracionExternaCharts(false);
        if (typeof destroyMigracionInternaCharts === 'function') destroyMigracionInternaCharts();
        if (typeof toggleMigracionInternaCharts === 'function') toggleMigracionInternaCharts(false);
        if (typeof destroyAutoreconocimientoCharts === 'function') destroyAutoreconocimientoCharts();
        if (typeof toggleAutoreconocimientoCharts === 'function') toggleAutoreconocimientoCharts(false);
        if (typeof destroyCondicionesSeguridadCharts === 'function') destroyCondicionesSeguridadCharts();
        if (typeof toggleCondicionesSeguridadCharts === 'function') toggleCondicionesSeguridadCharts(false);
        if (config.isTasaCrecimiento) {
            destroyMainChartCanvas();
            if (typeof toggleTasaCrecimientoCharts === 'function') toggleTasaCrecimientoCharts(true);
            const title = document.getElementById("chartTitle");
            if (title) title.textContent = config.title || "Tasa de crecimiento intercensal";
        }
        if (config.isMigracionExterna) {
            destroyMainChartCanvas();
            if (typeof toggleMigracionExternaCharts === 'function') toggleMigracionExternaCharts(true);
            const title = document.getElementById("chartTitle");
            if (title) title.textContent = config.title || "Migración Externa";
        }
        if (config.isMigracionInterna) {
            destroyMainChartCanvas();
            if (typeof toggleMigracionInternaCharts === 'function') toggleMigracionInternaCharts(true);
            const title = document.getElementById("chartTitle");
            if (title) title.textContent = config.title || "Migración Interna";
        }
        if (config.isIndicesComplementarios) {
            destroyMainChartCanvas();
            if (typeof toggleIndicesCharts === 'function') toggleIndicesCharts(true);
            const title = document.getElementById("chartTitle");
            if (title) title.textContent = config.title || "Índices complementarios";
        }
        if (config.isComposicion) {
            prepareComposicionChartPanel();
            const title = document.getElementById("chartTitle");
            if (title) title.textContent = config.title || "Estructura población edad y área";
        }
        if (config.isAutoreconocimientoEtnico) {
            destroyMainChartCanvas();
            if (typeof toggleAutoreconocimientoCharts === "function") toggleAutoreconocimientoCharts(true);
            const title = document.getElementById("chartTitle");
            if (title) title.textContent = config.title || "Autoreconocimiento étnico";
        }
        if (config.isCondicionesSeguridad) {
            destroyMainChartCanvas();
            if (typeof toggleCondicionesSeguridadCharts === "function") toggleCondicionesSeguridadCharts(true);
            const title = document.getElementById("chartTitle");
            if (title) title.textContent = config.title || "Condiciones de seguridad";
        }
        if (config.isConcentracionPoblacion) {
            syncStateSnapshot();
            void actualizarGrafica(null, config, { skipSyncMap: true });
            return;
        }

        // =========================
        // CASO NORMAL (1 capa o Contexto Histórico dual)
        // =========================
        const currentCycle = ++renderCycleId;
        zoomToCurrentTerritory({
            request: layerRequest,
            duration: 650,
            drawTerritory: !!config.isContextoHistorico,
            zoomDepartmentWhenMunicipal: !!config.isContextoHistorico
        });

        if (config.isContextoHistorico) {
            const l_hpl = getOrCreateFeatureLayer({
                url: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componenteocupacion/MapServer/6",
                definitionExpression: "1=1",
                outFields: ["*"],
                opacity: 0.8,
                visible: true
            }, "contexto-historico-poligono", FeatureLayer);
            const l_hln = getOrCreateFeatureLayer({
                url: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componenteocupacion/MapServer/7",
                definitionExpression: "1=1",
                outFields: ["*"],
                opacity: 0.8,
                visible: true
            }, "contexto-historico-linea", FeatureLayer);

            // Simbología homologada solicitada para Contexto Histórico: agrupa
            // Prehispánico como "Ocupación Indígena" y respeta colores por periodo.
            l_hpl.renderer = buildContextoHistoricoRenderer("polygon");
            l_hln.renderer = buildContextoHistoricoRenderer("line");
            l_hpl.labelingInfo = [{
                where: "periodo = 'Prehispánico'",
                labelExpressionInfo: {
                    expression: "DefaultValue($feature.descripcion, '')"
                },
                symbol: {
                    type: "text",
                    color: "#4a2a00",
                    haloColor: "#ffffff",
                    haloSize: 1,
                    font: {
                        family: "Arial",
                        size: 9,
                        weight: "bold"
                    }
                },
                labelPlacement: "always-horizontal"
            }];
            l_hpl.labelsVisible = true;
            map.add(l_hpl);
            map.add(l_hln);

            layersGlobal = [l_hpl, l_hln];
            layerGlobal = l_hpl;
            activeFeatureLayer = l_hpl;
            setLegendLayer(l_hpl, config.title);
            actualizarFuente(l_hpl);

            Promise.all([l_hpl.when(), l_hln.when()]).then(() => {
                if (!isCurrentRequest(layerRequest)) return;
                view.whenLayerView(l_hpl).then(lv => {
                    layerViewGlobal = lv;
                });
                actualizarGrafica(l_hpl, config);
            }).catch(error => {
                if (String(error?.message || "").toLowerCase().includes("cancel")) return;
                console.error("contexto historico layers error:", error);
            });

            actualizarResumen();
            return;
        }

        // Usar mapLayerUrl si está definido (para tablas que necesitan una capa visual de apoyo)
        const visualUrl = config.mapLayerUrl || config.url;

        let defExpr = whereBase || "1=1";
        if (config.id === "densidad_poblacion" && deptoActual && defExpr.includes("mpcodigo =")) {
            defExpr = defExpr.replace(/mpcodigo\s*=\s*'[^']+'+/, `dpcodigo = '${deptoActual}'`);
        }
        if (municipioActual && deptoActual && shouldShowDepartmentMapWhenMunicipal(config)) {
            defExpr = buildDepartmentMapWhereForConfig(config, deptoActual);
        }

        const attachLoadedLayer = (newLayer) => {
            map.add(newLayer);
            layerGlobal = newLayer;
            activeFeatureLayer = newLayer;
            setLegendLayer(newLayer, config.title);
            actualizarFuente(newLayer);

            if (config.isComposicion) {
                const isNationalComposicion = !deptoActual && filtroNivel !== "MUNI";
                ensureComposicionUi({ isNational: isNationalComposicion, deptoCode: deptoActual, where: defExpr, layer: newLayer });
                if (municipioActual) highlightMunicipioOnMap(municipioActual, { request: layerRequest });
            }
            if (config.isDistribucion && municipioActual) {
                highlightMunicipioOnMap(municipioActual, { request: layerRequest });
            }
            if (config.isTasaCrecimiento) {
                ensureTasaCrecimientoUi({ where: defExpr, layer: newLayer });
            }
            if (config.isMigracionExterna) {
                ensureMapCategorySliderUi({ where: defExpr, layer: newLayer });
            }
            if (config.isMigracionInterna) {
                ensureMapCategorySliderUi({ where: defExpr, layer: newLayer });
                if (municipioActual) highlightMunicipioOnMap(municipioActual, { request: layerRequest });
            }
            if (config.isIndicesComplementarios) {
                setupIndicesComplementariosSlider({ where: defExpr, layer: newLayer });
                refreshIndiceComplementarioMapAndLegend({ where: defExpr, field: indiceComplementarioCampoActivo, layer: newLayer });
                if (municipioActual) highlightMunicipioOnMap(municipioActual, { request: layerRequest });
            }
            if (config.isAutoreconocimientoEtnico) {
                ensureAutoreconocimientoUi({ where: defExpr, layer: newLayer });
            }
            if (config.isCondicionesSeguridad) {
                ensureCondicionesSeguridadUi({ where: defExpr, layer: newLayer });
            }

            actualizarResumen();

            newLayer.when(() => {
                if (!isCurrentRequest(layerRequest)) return;
                if (!newLayer.isTable) {
                    view.whenLayerView(newLayer)
                        .then(layerView => {
                            layerViewGlobal = layerView;
                            layerView.filter = null;
                        })
                        .catch(e => {
                            if (String(e?.name || "").includes("cancelled:layerview-create")) return;
                            if (String(e?.message || "").toLowerCase().includes("cancelled")) return;
                            console.error("whenLayerView error:", e);
                        });
                }
            });

            newLayer.when(async () => {
                if (!isCurrentRequest(layerRequest)) return;
                if (currentCycle !== renderCycleId || layerGlobal !== newLayer || newLayer.destroyed) return;

                try {
                    if (newLayer.isTable === false && !config.isContextoHistorico && !municipioActual && !(filtroNivel === "DEPTO" && deptoActual)) {
                        const res = await newLayer.queryExtent({ where: defExpr });
                        if (currentCycle !== renderCycleId || layerGlobal !== newLayer || newLayer.destroyed) return;
                        if (res?.extent) {
                            await view.goTo(res.extent.expand(1.2));
                        }
                    }
                } catch (e) {
                    if (e?.name === "AbortError" || String(e?.message || "").toLowerCase().includes("aborted")) return;
                    console.error("queryExtent error:", e);
                }

                if (currentCycle !== renderCycleId || layerGlobal !== newLayer || newLayer.destroyed) return;

                let dataLayer = newLayer;
                if (config.mapLayerUrl && config.mapLayerUrl !== config.url) {
                    dataLayer = getOrCreateFeatureLayer({
                        url: config.url,
                        outFields: config.outFields || ["*"]
                    }, `data:${config.id}`, FeatureLayer);
                }

                actualizarGrafica(dataLayer, config, {
                    skipSyncMap: config.isDistribucion && !!municipioActual
                });

                if (currentCycle !== renderCycleId || layerGlobal !== newLayer || newLayer.destroyed) return;

                const skipLegendUpdate = config.isDistribucion || config.isConcentracionPoblacion || config.isPiramides || config.isTransicion || config.isPropiedadRural || config.isIndicesComplementarios || config.isComposicion || config.isTasaCrecimiento || config.isMigracionExterna || config.isMigracionInterna || config.isAutoreconocimientoEtnico || config.isCondicionesSeguridad;

                if (!skipLegendUpdate && typeof updateLegendByExtent === "function") {
                    updateLegendByExtent(newLayer, config);
                } else if (!skipLegendUpdate) {
                    const legendData = buildLegendFromRenderer(newLayer);
                    if (legendData?.labels?.length) {
                        actualizarLeyenda(legendData.labels, legendData.colors, legendData.codes, legendData.styles);
                    }
                }
            });
        };

        if (config.isComposicion && config.mapLayerUrl) {
            const isNationalComposicion = !deptoActual && filtroNivel !== "MUNI";
            createComposicionMapLayer({
                territoryWhere: defExpr,
                isNational: isNationalComposicion,
                deptoCode: deptoActual,
                field: composicionCampoActivo,
                signal: layerRequest.signal
            }).then((newLayer) => {
                if (!isCurrentRequest(layerRequest) || currentCycle !== renderCycleId) return;
                newLayer.definitionExpression = defExpr;
                attachLoadedLayer(newLayer);
            }).catch(async (error) => {
                if (error?.name === "AbortError" || String(error?.message || "").toLowerCase().includes("aborted")) return;
                if (String(error?.message || "").toLowerCase().includes("cancel")) return;
                console.error("createComposicionMapLayer error:", error);
                try {
                    if (!isCurrentRequest(layerRequest) || currentCycle !== renderCycleId) return;
                    const fallbackLayer = getOrCreateFeatureLayer({
                        url: config.mapLayerUrl,
                        definitionExpression: defExpr,
                        outFields: ["*"],
                        opacity: 0.8,
                        visible: true,
                        minScale: 0,
                        maxScale: 0,
                        renderer: typeof ocupacionGlobal("buildComposicionRenderer") === "function"
                            ? ocupacionGlobal("buildComposicionRenderer")(composicionCampoActivo, {
                                national: isNationalComposicion,
                                deptoCode: deptoActual
                            })
                            : undefined
                    }, `visual:${config.id}:fallback`, FeatureLayer);
                    attachLoadedLayer(fallbackLayer);
                } catch (fallbackError) {
                    console.error("createComposicionMapLayer fallback error:", fallbackError);
                }
            });
            return;
        }

        const isDensidadVisualLayer = config.id === "densidad_poblacion" || config.isPiramides || config.isTransicion;
        const newLayer = getOrCreateFeatureLayer({
            url: visualUrl,
            definitionExpression: defExpr,
            // Si usamos una visualUrl distinta (como en pirámides), pedir todos los campos (*) 
            // de esa capa visual para evitar errores con campos de la tabla original
            outFields: (visualUrl !== config.url) ? ["*"] : (config.outFields || ["*"]),
            opacity: 0.8,
            visible: true,
            minScale: 0,
            maxScale: 0,
            orderByFields: isDensidadVisualLayer ? ["tzn"] : undefined,
            renderer: isDensidadVisualLayer && typeof buildDensidadPoblacionalRenderer === "function"
                ? buildDensidadPoblacionalRenderer(deptoActual || null)
                : config.isComposicion && typeof ocupacionGlobal("buildComposicionRenderer") === "function"
                        ? ocupacionGlobal("buildComposicionRenderer")(composicionCampoActivo, { national: !deptoActual && filtroNivel !== "MUNI", deptoCode: deptoActual })
                    : (config.isTasaCrecimiento || config.isMigracionExterna || config.isMigracionInterna) && typeof ocupacionGlobal("buildTasaCrecimientoRenderer") === "function"
                        ? ocupacionGlobal("buildTasaCrecimientoRenderer")(tasaCrecimientoCampoActivo)
                        : config.isIndicesComplementarios
                            ? buildIndiceComplementarioRenderer(indiceComplementarioCampoActivo)
                            : config.isAutoreconocimientoEtnico && typeof ocupacionGlobal("buildAutoreconocimientoRenderer") === "function"
                                ? ocupacionGlobal("buildAutoreconocimientoRenderer")()
                                : config.isCondicionesSeguridad && typeof ocupacionGlobal("buildCondicionesSeguridadRenderer") === "function"
                                    ? ocupacionGlobal("buildCondicionesSeguridadRenderer")()
                                    : undefined
        }, `visual:${config.id}`, FeatureLayer);

        if ((config.id === "densidad_poblacion" || config.isPiramides || config.isTransicion) && typeof buildDensidadPoblacionalRenderer === "function") {
            newLayer.renderer = buildDensidadPoblacionalRenderer(deptoActual || null);
            newLayer.orderByFields = ["tzn"];
        }
        if (config.isComposicion && typeof ocupacionGlobal("buildComposicionRenderer") === "function") {
            const isNationalComposicion = !deptoActual && filtroNivel !== "MUNI";
            newLayer.renderer = ocupacionGlobal("buildComposicionRenderer")(composicionCampoActivo, { national: isNationalComposicion, deptoCode: deptoActual });
        }
        if ((config.isTasaCrecimiento || config.isMigracionExterna || config.isMigracionInterna) && typeof ocupacionGlobal("buildTasaCrecimientoRenderer") === "function") {
            newLayer.renderer = ocupacionGlobal("buildTasaCrecimientoRenderer")(tasaCrecimientoCampoActivo);
        }
        if (config.isIndicesComplementarios) {
            newLayer.renderer = buildIndiceComplementarioRenderer(indiceComplementarioCampoActivo);
        }
        if (config.isAutoreconocimientoEtnico && typeof ocupacionGlobal("buildAutoreconocimientoRenderer") === "function") {
            newLayer.renderer = ocupacionGlobal("buildAutoreconocimientoRenderer")();
        }
        if (config.isCondicionesSeguridad && typeof ocupacionGlobal("buildCondicionesSeguridadRenderer") === "function") {
            newLayer.renderer = ocupacionGlobal("buildCondicionesSeguridadRenderer")();
        }
        if (config.isPropiedadRural) {
            newLayer.when(() => ensurePropiedadRuralRenderer(newLayer)).catch(() => ensurePropiedadRuralRenderer(newLayer));
        }

        attachLoadedLayer(newLayer);
        if (scaleHandle) {
            scaleHandle.remove();
            scaleHandle = null;
        }

        scaleHandle = view.watch("stationary", (isStationary) => {
            if (!isStationary) return;
            if (!layerGlobal || layerGlobal !== newLayer) return;

            const cfg = getActiveLayerConfig();
            // No sobreescribir leyenda si el handler la gestiona
            const skipLegendUpdate = cfg?.isDistribucion || cfg?.isConcentracionPoblacion || cfg?.isPiramides || cfg?.isTransicion || cfg?.isPropiedadRural || cfg?.isIndicesComplementarios || cfg?.isComposicion || cfg?.isTasaCrecimiento || cfg?.isMigracionExterna || cfg?.isMigracionInterna || cfg?.isAutoreconocimientoEtnico || cfg?.isCondicionesSeguridad;

            if (cfg && !skipLegendUpdate && typeof updateLegendByExtent === "function") {
                updateLegendByExtent(newLayer, cfg);
            }
        });


    }



    function applyLegendFilter() {
        const currentLegendState = legendState;
        if (!currentLegendState || !currentLegendState.layer || !currentLegendState.field) return;

        const codes = Array.from(currentLegendState.activeCodes);

        // si no hay activos, apaga todo
        if (!codes.length) {
            currentLegendState.layer.definitionExpression = "1=0";
            return;
        }

        // detectar si el campo es numérico
        const fieldInfo = (currentLegendState.layer.fields || []).find(f => f.name === currentLegendState.field);
        const fieldType = String(fieldInfo?.type || "").toLowerCase();

        const isNumeric =
            fieldType.includes("small-integer") ||
            fieldType.includes("integer") ||
            fieldType.includes("double") ||
            fieldType.includes("single") ||
            fieldType.includes("long");

        const formattedValues = codes.map(code => {
            const v = String(code).trim();

            if (v === "null" || v === "" || v.toLowerCase() === "nan") {
                return "NULL";
            }

            if (isNumeric) {
                return Number(v);
            }

            return `'${v.replace(/'/g, "''")}'`;
        });

        const nonNullValues = formattedValues.filter(v => v !== "NULL");
        const hasNull = formattedValues.includes("NULL");

        let whereLegend = "";

        if (nonNullValues.length && hasNull) {
            whereLegend = `(${currentLegendState.field} IN (${nonNullValues.join(",")}) OR ${currentLegendState.field} IS NULL)`;
        } else if (nonNullValues.length) {
            whereLegend = `${currentLegendState.field} IN (${nonNullValues.join(",")})`;
        } else if (hasNull) {
            whereLegend = `${currentLegendState.field} IS NULL`;
        } else {
            whereLegend = "1=0";
        }

        const baseWhere = currentLegendState.baseWhere && currentLegendState.baseWhere.trim() ? `(${currentLegendState.baseWhere})` : "1=1";
        currentLegendState.layer.definitionExpression = `${baseWhere} AND (${whereLegend})`;
    }

    applyLegendLayerViewFilter = async function () {
        const currentLegendState = legendState;
        if (!currentLegendState || !currentLegendState.layer || !currentLegendState.field) return;

        if (!(currentLegendState.activeCodes instanceof Set)) {
            currentLegendState.activeCodes = new Set((currentLegendState.allCodes || []).map(v => String(v)));
        }

        const totalCount = Array.isArray(currentLegendState.allCodes) ? currentLegendState.allCodes.length : 0;
        const selectedCode = currentLegendState.selectedCode && currentLegendState.activeCodes.has(String(currentLegendState.selectedCode))
            ? String(currentLegendState.selectedCode)
            : null;
        const filterCodes = selectedCode ? new Set([selectedCode]) : currentLegendState.activeCodes;
        const activeCount = filterCodes.size;
        const targetLayers = getLegendTargetLayers();
        if (!targetLayers.length) return;
        const config = getActiveLayerConfig();
        const baseWhere = currentLegendState.baseWhere && String(currentLegendState.baseWhere).trim()
            ? String(currentLegendState.baseWhere)
            : "1=1";
        const shouldApplyDefinitionFilter = config?.isDistribucion && !deptoActual && !municipioActual;

        for (const currentLayer of targetLayers) {
            let fieldInfo = null;
            try {
                fieldInfo = (currentLayer.fields || []).find(field =>
                    String(field.name).toLowerCase() === String(currentLegendState.field).toLowerCase()
                );
            } catch (_) { }

            let whereLegend = null;
            if (activeCount === 0) {
                whereLegend = "1=0";
            } else if (currentLegendState.itemWheres) {
                whereLegend = !totalCount || activeCount < totalCount
                    ? buildCustomLegendWhere(currentLegendState.itemWheres, filterCodes)
                    : null;
            } else if (currentLegendState.field === CONTEXTO_HISTORICO_LEGEND_FIELD) {
                whereLegend = activeCount < totalCount
                    ? buildContextoHistoricoLegendWhere(filterCodes)
                    : null;
            } else if (!totalCount || activeCount < totalCount) {
                const fieldName = fieldInfo?.name || currentLegendState.field;
                const fieldType = String(fieldInfo?.type || "").toLowerCase();
                whereLegend = buildLegendWhere(fieldName, filterCodes, fieldType);
            }

            if (shouldApplyDefinitionFilter) {
                currentLayer.definitionExpression = whereLegend ? `(${baseWhere}) AND (${whereLegend})` : baseWhere;
                try { currentLayer.refresh?.(); } catch (_) { }
                continue;
            }

            try {
                const layerView = await view.whenLayerView(currentLayer);
                // Interactividad de leyenda estilo Contexto Legal:
                // se ocultan geometrías por categoría sin modificar la simbología ni apagar la capa.
                layerView.filter = whereLegend ? { where: whereLegend } : null;
            } catch (error) {
                console.warn("No se pudo aplicar filtro de leyenda:", error);
            }
        }
    };



    async function cargarMunicipios() {
        if (Object.keys(diccionarioMunicipios).length === 0) {
            await cargarDiccionarioMunicipios();
        }

        // Capa de referencia para municipios (densidad de población)
        const tempLayer = new FeatureLayer({
            url: (LAYERS_CONFIG.DISTRIBUCION_POBLACION[0] || {}).url ||
                "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componenteocupacion/MapServer/11"
        });

        const q = tempLayer.createQuery();
        q.where = "1=1";
        q.outFields = ["mpcodigo"];
        q.returnDistinctValues = true;
        q.returnGeometry = false;

        try {
            const res = await tempLayer.queryFeatures(q);

            const codigos = [...new Set(
                res.features.map(f => f.attributes.mpcodigo)
            )].sort();

            // Guardar todos los municipios con su departamento
            todosMunicipios = codigos.map(codigo => {
                const depto = codigo.substring(0, 2);
                const nombre = getMunicipioDisplayName(codigo, diccionarioMunicipios[codigo] || codigo);
                return {
                    codigo: codigo,
                    nombre,
                    depto: depto
                };
            });

            // Cargar departamentos en el select
            cargarDepartamentos();

            // Renderizar todos los municipios inicialmente
            renderizarMunicipios();

        } catch (e) {
            console.error("Error cargando municipios", e);
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

        // Obtener departamentos únicos en orden alfabético (Colombia se mantiene aparte)
        const deptosUnicos = sortDepartamentoCodes([...new Set(todosMunicipios.map(m => m.depto))]);

        deptosUnicos.forEach(codigoDepto => {
            const opt = document.createElement("option");
            opt.value = codigoDepto;
            opt.textContent = getDepartamentoDisplayName(codigoDepto);
            selectDepto.appendChild(opt);
        });

        if (!filtroNivel && !deptoActual && !municipioActual) {
            selectDepto.value = "COL";
        }

    }

    function renderizarMunicipios(deptoFiltro = null) {
        const select = document.getElementById("municipios");
        select.innerHTML = `<option value="">Seleccione un municipio</option>`;

        let municipiosFiltrados = todosMunicipios;

        // Filtrar por departamento
        if (deptoFiltro && deptoFiltro !== "0") {
            municipiosFiltrados = municipiosFiltrados.filter(m => m.depto === deptoFiltro);
        }

        municipiosFiltrados
            .slice()
            .sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }))
            .forEach(muni => {
            const opt = document.createElement("option");
            opt.value = muni.codigo;
            opt.textContent = getMunicipioDisplayName(muni.codigo, muni.nombre);
            select.appendChild(opt);
        });
    }

    document.getElementById("departamentos").onchange = function () {

        const deptoSeleccionado = this.value;

        // =====================================================
        // CASO ESPECIAL: COLOMBIA
        // =====================================================
        if (deptoSeleccionado === "COL") {

            // limpiar municipios
            document.getElementById("municipios").value = "";
            municipioActual = "";
            municipioInfo = null;

            // limpiar filtros
            filtroNivel = "";
            deptoActual = "";
            whereBase = "";
            resetLegendFilterState();
            syncStateSnapshot({ activeSelection: null, activeFilter: "" });

            // limpiar capas
            clearLayers();

            // limpiar gráfica
            if (chartInstance) chartInstance.destroy();

            renderControls();
            cargarCapaActual();
            actualizarResumen();


            // enfocar Colombia
            zoomToCurrentTerritory({ duration: 650 });

            return;
        }

        // =====================================================
        // FILTRAR MUNICIPIOS
        // =====================================================
        renderizarMunicipios(deptoSeleccionado);
        document.getElementById("municipios").value = "";
        municipioActual = "";
        municipioInfo = null;

        if (currentMainModule === "ORDENAMIENTO") {
            deptoActual = deptoSeleccionado;
            filtroNivel = deptoSeleccionado && deptoSeleccionado !== "0" ? "DEPTO" : "";
            syncStateSnapshot({ activeSelection: null, activeFilter: "" });

            if (typeof window.cargarOrdenamientoActual === "function") {
                window.cargarOrdenamientoActual();
            }
            return;
        }

        // =====================================================
        // NIVEL DEPARTAMENTAL
        // =====================================================
        if (deptoSeleccionado && deptoSeleccionado !== "0") {

            filtroNivel = "DEPTO";
            deptoActual = deptoSeleccionado;
            resetLegendFilterState();

            restoreSubLayerSelection();
            renderControls();

            // filtro departamental
            whereBase = `dpcodigo = '${deptoSeleccionado}'`;
            syncStateSnapshot({ activeSelection: null, activeFilter: "" });

            // cargar capa y gráfica
            cargarCapaActual();
            actualizarResumen();

        }
        // =====================================================
        // SIN SELECCIÓN
        // =====================================================
        else {

            filtroNivel = "";
            deptoActual = "";
            whereBase = "";
            resetLegendFilterState();
            syncStateSnapshot({ activeSelection: null, activeFilter: "" });

            clearLayers();

            if (chartInstance) chartInstance.destroy();

            actualizarResumen();
        }
    };


    function seleccionarMunicipioPorCodigo(codigo) {
        if (!codigo) return;

        const dpCode = codigo.substring(0, 2);
        const selectDepto = document.getElementById("departamentos");
        const selectMuni = document.getElementById("municipios");

        if (selectDepto && selectDepto.value !== dpCode) {
            selectDepto.value = dpCode;
            renderizarMunicipios(dpCode);
        }
        if (selectMuni) {
            selectMuni.value = codigo;
        }

        filtroNivel = "MUNI";
        municipioActual = codigo;
        deptoActual = dpCode;
        resetLegendFilterState();
        syncStateSnapshot({ activeSelection: null, activeFilter: "" });

        if (currentMainModule === "ORDENAMIENTO") {
            renderControls();
            if (typeof window.cargarOrdenamientoActual === "function") {
                window.cargarOrdenamientoActual();
            }
            return;
        }

        const prevList = getLayerListForCurrentLevel(currentMode);
        const prevCfg = prevList?.[currentSubLayerIndex];
        const prevId = prevCfg?.id;

        whereBase = `mpcodigo = '${String(codigo).replace(/'/g, "''")}'`;
        syncStateSnapshot({ activeSelection: null, activeFilter: "" });

        ensureMunicipalLayerIndex(prevId);
        renderControls();
        cargarInfoMunicipio(codigo);
        cargarCapaActual();
    }

    seleccionarMunicipioPorCodigoImpl = seleccionarMunicipioPorCodigo;

    document.getElementById("municipios").onchange = function () {
        const codigo = this.value;
        if (!codigo) return;
        seleccionarMunicipioPorCodigo(codigo);
    };


    function getAxisTitles(layerConfig, chartType, isVertical, datasets) {
        let xTitle = "";
        let yTitle = "";

        if (layerConfig?.id === "densidad_poblacion") {
            if (isVertical) {
                xTitle = "Zonas";
                yTitle = "Densidad (hab/ha)";
            } else {
                xTitle = "Densidad (hab/ha)";
                yTitle = "Zonas";
            }
            return { xTitle, yTitle };
        }

        const valueTitle = "Porcentaje (%)";

        if (chartType === "bar") {
            if (isVertical) {
                xTitle = "Categoría";
                yTitle = valueTitle;
            } else {
                xTitle = valueTitle;
                yTitle = "Categoría";
            }
            return { xTitle, yTitle };
        }

        return { xTitle, yTitle };
    }

    function toggleContextoHistoricoCharts(show) {
        const single = document.getElementById("chart");
        const panel = document.getElementById("contextoHistoricoTimeline");
        const slider = document.getElementById("periodoSliderContainer");
        const chartDiv = document.getElementById("chartDiv");
        const chartCard = panel?.closest(".chart-card");

        // Hide others
        const others = ["piramidesCharts", "transicionCharts", "geoformasCharts", "indicesCharts", "tasaCrecimientoCharts", "migracionExternaCharts", "migracionInternaCharts", "autoreconocimientoCharts", "condicionesSeguridadCharts"];
        others.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = "none";
        });

        if (panel) panel.style.display = show ? "block" : "none";
        if (slider) slider.style.display = show ? "flex" : "none";
        if (single) single.style.display = show ? "none" : "block";
        chartDiv?.classList.toggle("contexto-historico-active", show);
        chartCard?.classList.toggle("contexto-historico-active", show);
    }

    function prepareComposicionChartPanel() {
        toggleContextoHistoricoCharts(false);
        togglePiramidesCharts(false);
        toggleTransicionCharts(false);
        toggleTasaCrecimientoCharts(false);
        toggleMigracionExternaCharts(false);
        toggleMigracionInternaCharts(false);
        toggleAutoreconocimientoCharts(false);
        toggleCondicionesSeguridadCharts(false);
        toggleIndicesCharts(false);

        hideMainChartCanvasDuringLoad();
    }



    // ─── PIRÁMIDES POBLACIONALES ─────────────────────────────────────────
    function togglePiramidesCharts(show) {
        const ctxHist = document.getElementById("contextoHistoricoTimeline");
        if (ctxHist) ctxHist.style.display = "none";
        const ctxSlider = document.getElementById("periodoSliderContainer");
        if (ctxSlider) ctxSlider.style.display = "none";

        const panel = document.getElementById("piramidesCharts");
        const single = document.getElementById("chart");
        const transicion = document.getElementById("transicionCharts");
        const geo = document.getElementById("geoformasCharts");
        const indices = document.getElementById("indicesCharts");
        const tc = document.getElementById("tasaCrecimientoCharts");
        const mge = document.getElementById("migracionExternaCharts");
        const mgi = document.getElementById("migracionInternaCharts");
        const auto = document.getElementById("autoreconocimientoCharts");
        const csg = document.getElementById("condicionesSeguridadCharts");

        if (panel) panel.style.display = show ? "block" : "none";
        if (single) single.style.display = show ? "none" : "block";
        if (transicion) transicion.style.display = "none";
        if (geo) geo.style.display = "none";
        if (indices) indices.style.display = "none";
        if (tc) tc.style.display = "none";
        if (mge) mge.style.display = "none";
        if (mgi) mgi.style.display = "none";
        if (auto) auto.style.display = "none";
        if (csg) csg.style.display = "none";
    }

    function destroyPiramidesCharts() {
        [1985, 1993, 2005, 2018].forEach(yr => {
            if (pChartInstances[yr]) { pChartInstances[yr].destroy(); pChartInstances[yr] = null; }
        });
        resetChartPanelCanvases("piramidesCharts");
    }

    // ─── TRANSICIÓN DEMOGRÁFICA ──────────────────────────────────────────
    let tChartInstance = null;

    function toggleTransicionCharts(show) {
        const ctxHist = document.getElementById("contextoHistoricoTimeline");
        if (ctxHist) ctxHist.style.display = "none";
        const ctxSlider = document.getElementById("periodoSliderContainer");
        if (ctxSlider) ctxSlider.style.display = "none";

        const panel = document.getElementById("transicionCharts");
        const single = document.getElementById("chart");
        const piramides = document.getElementById("piramidesCharts");
        const geo = document.getElementById("geoformasCharts");
        const indices = document.getElementById("indicesCharts");
        const tc = document.getElementById("tasaCrecimientoCharts");
        const mge = document.getElementById("migracionExternaCharts");
        const mgi = document.getElementById("migracionInternaCharts");
        const auto = document.getElementById("autoreconocimientoCharts");
        const csg = document.getElementById("condicionesSeguridadCharts");

        if (panel) panel.style.display = show ? "block" : "none";
        if (single) single.style.display = show ? "none" : "block";
        if (piramides) piramides.style.display = "none";
        if (geo) geo.style.display = "none";
        if (indices) indices.style.display = "none";
        if (tc) tc.style.display = "none";
        if (mge) mge.style.display = "none";
        if (mgi) mgi.style.display = "none";
        if (auto) auto.style.display = "none";
        if (csg) csg.style.display = "none";
    }

    function destroyTransicionCharts() {
        if (tChartInstance) {
            tChartInstance.destroy();
            tChartInstance = null;
        }
        resetChartPanelCanvases("transicionCharts");
    }

    // ─── ÍNDICES COMPLEMENTARIOS ────────────────────────────────────────
    let indicesChartInstances = { 1: null, 2: null, 3: null };

    function toggleIndicesCharts(show) {
        const ctxHist = document.getElementById("contextoHistoricoTimeline");
        if (ctxHist) ctxHist.style.display = "none";
        const ctxSlider = document.getElementById("periodoSliderContainer");
        if (ctxSlider) ctxSlider.style.display = show ? "flex" : "none";

        const panel = document.getElementById("indicesCharts");
        const single = document.getElementById("chart");
        const piramides = document.getElementById("piramidesCharts");
        const transicion = document.getElementById("transicionCharts");
        const geo = document.getElementById("geoformasCharts");
        const tc = document.getElementById("tasaCrecimientoCharts");
        const mge = document.getElementById("migracionExternaCharts");
        const mgi = document.getElementById("migracionInternaCharts");
        const auto = document.getElementById("autoreconocimientoCharts");
        const csg = document.getElementById("condicionesSeguridadCharts");

        if (panel) panel.style.display = show ? "block" : "none";
        if (single) single.style.display = show ? "none" : "block";
        if (piramides) piramides.style.display = "none";
        if (transicion) transicion.style.display = "none";
        if (geo) geo.style.display = "none";
        if (tc) tc.style.display = "none";
        if (mge) mge.style.display = "none";
        if (mgi) mgi.style.display = "none";
        if (auto) auto.style.display = "none";
        if (csg) csg.style.display = "none";
    }

    function toggleTasaCrecimientoCharts(show) {
        const ctxHist = document.getElementById("contextoHistoricoTimeline");
        if (ctxHist) ctxHist.style.display = "none";
        const ctxSlider = document.getElementById("periodoSliderContainer");
        if (ctxSlider) ctxSlider.style.display = show ? "flex" : "none";

        const panel = document.getElementById("tasaCrecimientoCharts");
        const single = document.getElementById("chart");
        const piramides = document.getElementById("piramidesCharts");
        const transicion = document.getElementById("transicionCharts");
        const indices = document.getElementById("indicesCharts");
        const geo = document.getElementById("geoformasCharts");
        const mge = document.getElementById("migracionExternaCharts");
        const mgi = document.getElementById("migracionInternaCharts");
        const auto = document.getElementById("autoreconocimientoCharts");
        const csg = document.getElementById("condicionesSeguridadCharts");

        if (panel) panel.style.display = show ? "block" : "none";
        if (single) single.style.display = show ? "none" : "block";
        if (piramides) piramides.style.display = "none";
        if (transicion) transicion.style.display = "none";
        if (indices) indices.style.display = "none";
        if (geo) geo.style.display = "none";
        if (mge) mge.style.display = "none";
        if (mgi) mgi.style.display = "none";
        if (auto) auto.style.display = "none";
        if (csg) csg.style.display = "none";
    }

    function destroyTasaCrecimientoCharts() {
        if (tcChartInstance) {
            tcChartInstance.destroy();
            tcChartInstance = null;
        }
        resetChartPanelCanvases("tasaCrecimientoCharts");
    }

    // ─── AUTORECONOCIMIENTO ÉTNICO ─────────────────────────────────────────
    let mgeChartInstance = null;

    function toggleMigracionExternaCharts(show) {
        const ctxHist = document.getElementById("contextoHistoricoTimeline");
        if (ctxHist) ctxHist.style.display = "none";
        const ctxSlider = document.getElementById("periodoSliderContainer");
        if (ctxSlider) ctxSlider.style.display = show ? "flex" : "none";

        const panel = document.getElementById("migracionExternaCharts");
        const single = document.getElementById("chart");
        const piramides = document.getElementById("piramidesCharts");
        const transicion = document.getElementById("transicionCharts");
        const indices = document.getElementById("indicesCharts");
        const geo = document.getElementById("geoformasCharts");
        const tc = document.getElementById("tasaCrecimientoCharts");
        const mgi = document.getElementById("migracionInternaCharts");
        const auto = document.getElementById("autoreconocimientoCharts");
        const csg = document.getElementById("condicionesSeguridadCharts");

        if (panel) panel.style.display = show ? "block" : "none";
        if (single) single.style.display = show ? "none" : "block";
        if (piramides) piramides.style.display = "none";
        if (transicion) transicion.style.display = "none";
        if (indices) indices.style.display = "none";
        if (geo) geo.style.display = "none";
        if (tc) tc.style.display = "none";
        if (mgi) mgi.style.display = "none";
        if (auto) auto.style.display = "none";
        if (csg) csg.style.display = "none";
    }

    function destroyMigracionExternaCharts() {
        if (mgeChartInstance) {
            mgeChartInstance.destroy();
            mgeChartInstance = null;
        }
        resetChartPanelCanvases("migracionExternaCharts");
    }

    let mgiChartInstance = null;

    function toggleMigracionInternaCharts(show) {
        const ctxHist = document.getElementById("contextoHistoricoTimeline");
        if (ctxHist) ctxHist.style.display = "none";
        const ctxSlider = document.getElementById("periodoSliderContainer");
        if (ctxSlider) ctxSlider.style.display = show ? "flex" : "none";

        const panel = document.getElementById("migracionInternaCharts");
        const single = document.getElementById("chart");
        const piramides = document.getElementById("piramidesCharts");
        const transicion = document.getElementById("transicionCharts");
        const indices = document.getElementById("indicesCharts");
        const geo = document.getElementById("geoformasCharts");
        const tc = document.getElementById("tasaCrecimientoCharts");
        const mge = document.getElementById("migracionExternaCharts");
        const auto = document.getElementById("autoreconocimientoCharts");
        const csg = document.getElementById("condicionesSeguridadCharts");

        if (panel) panel.style.display = show ? "block" : "none";
        if (single) single.style.display = show ? "none" : "block";
        if (piramides) piramides.style.display = "none";
        if (transicion) transicion.style.display = "none";
        if (indices) indices.style.display = "none";
        if (geo) geo.style.display = "none";
        if (tc) tc.style.display = "none";
        if (mge) mge.style.display = "none";
        if (auto) auto.style.display = "none";
        if (csg) csg.style.display = "none";
    }

    function destroyMigracionInternaCharts() {
        if (mgiChartInstance) {
            mgiChartInstance.destroy();
            mgiChartInstance = null;
        }
        resetChartPanelCanvases("migracionInternaCharts");
    }

    let aeChartInstance = null;

    function toggleAutoreconocimientoCharts(show) {
        const ctxHist = document.getElementById("contextoHistoricoTimeline");
        if (ctxHist) ctxHist.style.display = "none";
        const ctxSlider = document.getElementById("periodoSliderContainer");
        if (ctxSlider) ctxSlider.style.display = "none";

        const panel = document.getElementById("autoreconocimientoCharts");
        const single = document.getElementById("chart");
        const piramides = document.getElementById("piramidesCharts");
        const transicion = document.getElementById("transicionCharts");
        const indices = document.getElementById("indicesCharts");
        const geo = document.getElementById("geoformasCharts");
        const tc = document.getElementById("tasaCrecimientoCharts");
        const mge = document.getElementById("migracionExternaCharts");
        const mgi = document.getElementById("migracionInternaCharts");
        const csg = document.getElementById("condicionesSeguridadCharts");

        if (panel) panel.style.display = show ? "block" : "none";
        if (single) single.style.display = show ? "none" : "block";
        if (piramides) piramides.style.display = "none";
        if (transicion) transicion.style.display = "none";
        if (indices) indices.style.display = "none";
        if (geo) geo.style.display = "none";
        if (tc) tc.style.display = "none";
        if (mge) mge.style.display = "none";
        if (mgi) mgi.style.display = "none";
        if (csg) csg.style.display = "none";
    }

    function destroyAutoreconocimientoCharts() {
        if (aeChartInstance) {
            aeChartInstance.destroy();
            aeChartInstance = null;
        }
        resetChartPanelCanvases("autoreconocimientoCharts");
    }

    // ─── CONDICIONES DE SEGURIDAD ──────────────────────────────────────────
    let csgChartInstance = null;

    function toggleCondicionesSeguridadCharts(show) {
        const ctxHist = document.getElementById("contextoHistoricoTimeline");
        if (ctxHist) ctxHist.style.display = "none";
        const ctxSlider = document.getElementById("periodoSliderContainer");
        if (ctxSlider) ctxSlider.style.display = "none";

        const panel = document.getElementById("condicionesSeguridadCharts");
        const single = document.getElementById("chart");
        const piramides = document.getElementById("piramidesCharts");
        const transicion = document.getElementById("transicionCharts");
        const indices = document.getElementById("indicesCharts");
        const geo = document.getElementById("geoformasCharts");
        const tc = document.getElementById("tasaCrecimientoCharts");
        const mge = document.getElementById("migracionExternaCharts");
        const mgi = document.getElementById("migracionInternaCharts");
        const auto = document.getElementById("autoreconocimientoCharts");

        if (panel) panel.style.display = show ? "block" : "none";
        if (single) single.style.display = show ? "none" : "block";
        if (piramides) piramides.style.display = "none";
        if (transicion) transicion.style.display = "none";
        if (indices) indices.style.display = "none";
        if (geo) geo.style.display = "none";
        if (tc) tc.style.display = "none";
        if (mge) mge.style.display = "none";
        if (mgi) mgi.style.display = "none";
        if (auto) auto.style.display = "none";
    }

    function destroyCondicionesSeguridadCharts() {
        if (csgChartInstance) {
            csgChartInstance.destroy();
            csgChartInstance = null;
        }
        resetChartPanelCanvases("condicionesSeguridadCharts");
    }

    function destroyIndicesCharts() {
        [1, 2, 3].forEach(id => {
            if (indicesChartInstances[id]) {
                indicesChartInstances[id].destroy();
                indicesChartInstances[id] = null;
            }
        });
        resetChartPanelCanvases("indicesCharts");
    }

    function crearGraficaIndices(canvasId, title, labels, datasets, yAxisTitle, isPercentage = false) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;

        const screenWidth = window.innerWidth || 1200;
        const isSmallScreen = screenWidth <= 768;
        const isVerySmallScreen = screenWidth <= 480;
        const axisFontFamily = "'Segoe UI', 'Outfit', sans-serif";
        const axisTextColor = "#4c4c4c";
        const chartLabels = labels.map(label => wrapLabel(label, isVerySmallScreen ? 10 : isSmallScreen ? 13 : 16));
        const styledDatasets = datasets.map(dataset => ({
            ...dataset,
            borderWidth: 0,
            borderRadius: 8,
            borderSkipped: false,
            barPercentage: isSmallScreen ? 0.52 : 0.58,
            categoryPercentage: isSmallScreen ? 0.62 : 0.68,
            hoverBorderColor: "rgba(0, 84, 112, 0.85)",
            hoverBorderWidth: 2
        }));
        const formatIndexValue = (value, decimals = 2) => {
            const numeric = Number(value) || 0;
            return `${numeric.toLocaleString("es-CO", {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals
            })}${isPercentage ? "%" : ""}`;
        };
        const chartHeight = isSmallScreen ? 240 : 260;
        canvas.style.height = `${chartHeight}px`;
        canvas.style.minHeight = `${chartHeight}px`;
        canvas.style.maxHeight = `${chartHeight}px`;

        return new Chart(canvas.getContext("2d"), {
            type: "bar",
            data: {
                labels: chartLabels,
                datasets: styledDatasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 420,
                    easing: "easeOutQuart"
                },
                layout: {
                    padding: {
                        top: isSmallScreen ? 34 : 42,
                        right: isSmallScreen ? 12 : 18,
                        bottom: isSmallScreen ? 8 : 10,
                        left: isSmallScreen ? 8 : 14
                    }
                },
                plugins: {
                    legend: {
                        display: datasets.length > 1 && !datasets.every(d => d.hideLegend),
                        position: "bottom",
                        labels: {
                            boxWidth: 12,
                            boxHeight: 12,
                            color: "#465a63",
                            padding: 12,
                            usePointStyle: true,
                            pointStyle: "rectRounded",
                            font: {
                                family: axisFontFamily,
                                size: isVerySmallScreen ? 9 : 10,
                                weight: "600"
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: "rgba(0, 72, 96, 0.94)",
                        titleColor: "#ffffff",
                        bodyColor: "#ffffff",
                        borderColor: "rgba(255, 255, 255, 0.22)",
                        borderWidth: 1,
                        cornerRadius: 8,
                        padding: 10,
                        displayColors: true,
                        boxPadding: 4,
                        callbacks: {
                            title: (items) => {
                                const index = items?.[0]?.dataIndex ?? 0;
                                return labels[index] || "";
                            },
                            label: (ctx) => {
                                const val = Number(ctx.parsed.y) || 0;
                                const classLabel = ctx.dataset.datalabels?.[ctx.dataIndex];
                                const base = `${ctx.dataset.label || "Valor"}: ${val.toLocaleString("es-CO", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 5
                                })}${isPercentage ? "%" : ""}`;
                                return classLabel ? [base, `Clasificación: ${classLabel}`] : base;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: labels[0] === "Informalidad" ? "Índice de informalidad " : "Índice complementario",
                            color: axisTextColor,
                            font: {
                                family: axisFontFamily,
                                size: isVerySmallScreen ? 10 : 11,
                                weight: "normal"
                            },
                            padding: { top: 12 }
                        },
                        ticks: {
                            autoSkip: false,
                            maxRotation: 0,
                            minRotation: 0,
                            color: axisTextColor,
                            padding: 8,
                            font: {
                                family: axisFontFamily,
                                size: isVerySmallScreen ? 9 : 10,
                                weight: "600"
                            }
                        },
                        grid: { display: false },
                        border: { display: false }
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: yAxisTitle,
                            color: axisTextColor,
                            font: {
                                family: axisFontFamily,
                                size: isVerySmallScreen ? 10 : 11,
                                weight: "normal"
                            },
                            padding: { bottom: 4 }
                        },
                        ticks: {
                            color: axisTextColor,
                            padding: 8,
                            font: {
                                family: axisFontFamily,
                                size: isVerySmallScreen ? 9 : 10,
                                weight: "600"
                            },
                            callback: (v) => {
                                const numeric = Number(v) || 0;
                                return `${numeric.toLocaleString("es-CO", { maximumFractionDigits: 1 })}${isPercentage ? "%" : ""}`;
                            }
                        },
                        grid: {
                            color: "rgba(0, 72, 96, 0.08)",
                            drawBorder: false
                        },
                        border: { display: false }
                    }
                }
            },
            plugins: [{
                id: 'indicesBarLabels',
                afterDatasetsDraw(chart) {
                    const { ctx, chartArea } = chart;
                    ctx.save();
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.font = `700 ${isVerySmallScreen ? 8 : 9}px ${axisFontFamily}`;

                    chart.data.datasets.forEach((dataset, i) => {
                        const meta = chart.getDatasetMeta(i);
                        meta.data.forEach((bar, index) => {
                            const rawValue = dataset.data[index];
                            const val = Number(rawValue);
                            if (rawValue === null || rawValue === undefined || !Number.isFinite(val)) return;

                            const label = (dataset.datalabels && dataset.datalabels[index])
                                ? dataset.datalabels[index]
                                : "";

                            if (label) {
                                const valueStr = formatIndexValue(val, 2);
                                // Separar por salto de línea o por la barra vertical (|)
                                const wrapIndexLabelLine = (text, maxWidth) => {
                                    const words = String(text || "").split(/\s+/).filter(Boolean);
                                    const wrapped = [];
                                    let current = "";
                                    words.forEach(word => {
                                        const candidate = current ? `${current} ${word}` : word;
                                        if (!current || ctx.measureText(candidate).width <= maxWidth) {
                                            current = candidate;
                                        } else {
                                            wrapped.push(current);
                                            current = word;
                                        }
                                    });
                                    if (current) wrapped.push(current);
                                    return wrapped;
                                };
                                const maxLabelWidth = isSmallScreen ? 76 : 92;
                                const labelLines = label
                                    .split(/[\n|]+/)
                                    .map(s => s.trim())
                                    .filter(Boolean)
                                    .flatMap(line => wrapIndexLabelLine(line, maxLabelWidth));
                                const lines = [valueStr, ...labelLines];

                                const lineHeight = isVerySmallScreen ? 10 : 11;
                                const boxPaddingX = 6;
                                const boxPaddingY = 7;
                                const boxWidth = Math.min(
                                    isSmallScreen ? 94 : 112,
                                    Math.max(...lines.map(line => ctx.measureText(line).width), 0) + boxPaddingX * 2
                                );
                                const boxHeight = (lines.length * lineHeight) + boxPaddingY * 2;
                                const props = bar.getProps(["x", "y", "base"], true);
                                const barTop = Math.min(props.y, props.base);
                                const barBottom = Math.max(props.y, props.base);
                                const barHeight = barBottom - barTop;
                                const fitsInside = val !== 0 && barHeight >= boxHeight + 10;
                                const boxX = Math.max(
                                    chartArea.left + 2,
                                    Math.min(props.x - boxWidth / 2, chartArea.right - boxWidth - 2)
                                );
                                let boxY = val === 0
                                    ? Math.max(chartArea.top + 2, Math.min(chartArea.bottom - boxHeight - 2, props.base - boxHeight - 6))
                                    : fitsInside
                                        ? barTop + (barHeight - boxHeight) / 2
                                        : barTop - boxHeight - 6;
                                if (boxY < chartArea.top + 2) {
                                    boxY = Math.min(barTop + 6, chartArea.bottom - boxHeight - 2);
                                }
                                ctx.shadowColor = "rgba(0,72,96,0.12)";
                                ctx.shadowBlur = 6;
                                ctx.shadowOffsetX = 0;
                                ctx.shadowOffsetY = 2;
                                ctx.beginPath();
                                if (typeof ctx.roundRect === "function") {
                                    ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 6);
                                } else {
                                    ctx.rect(boxX, boxY, boxWidth, boxHeight);
                                }
                                ctx.fillStyle = "rgba(255,255,255,0.96)";
                                ctx.fill();
                                ctx.shadowColor = "transparent";
                                ctx.lineWidth = 1;
                                ctx.strokeStyle = "rgba(0,72,96,0.14)";
                                ctx.stroke();
                                ctx.fillStyle = "#24434d";
                                const firstLineY = boxY + boxPaddingY + lineHeight / 2;
                                for (let j = 0; j < lines.length; j++) {
                                    // 12px de alto aproximado por cada línea. Dibujamos de abajo hacia arriba.
                                    const lineY = firstLineY + (j * lineHeight);
                                    ctx.fillText(lines[j], boxX + boxWidth / 2, lineY);
                                }
                            }
                        });
                    });
                    ctx.restore();
                }
            }]
        });
    }


    function crearGraficaTransicion(labels, datasets) {
        // console.log(labels, datasets);
        const canvas = document.getElementById("tChart");
        if (!canvas) return;
        destroyTransicionCharts();

        tChartInstance = new Chart(canvas.getContext("2d"), {
            type: "line",
            data: {
                labels: labels.map(l => `Censo ${l}`),
                datasets: datasets
            },
            options: {
                responsive: true,
                interaction: {
                    mode: 'nearest',
                    intersect: true,
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: {
                            boxWidth: 12,
                            font: { size: 10 },
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                return `${context.dataset.label}: ${context.parsed.y.toFixed(2)}%`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: 'Porcentaje Población (%)' },
                        ticks: {
                            callback: function (value) {
                                return value + "%";
                            }
                        }
                    },
                    x: {
                        title: { display: true, text: 'Censos' }
                    }
                }
            }
        });
    }

    function crearPiramidesChart(canvasId, year, edadLabels, hombresData, mujeresData) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const colorH = "rgba(79,129,189,0.85)";
        const colorM = "rgba(255,35,196,0.90)";
        const maxValue = Math.max(
            1,
            ...hombresData.map(v => Math.abs(Number(v) || 0)),
            ...mujeresData.map(v => Math.abs(Number(v) || 0))
        );
        const axisLimit = Math.ceil(maxValue * 1.12);
        const shell = canvas.closest(".piramide-chart-shell");
        if (shell) {
            shell.style.height = "280px";
            shell.style.maxHeight = "280px";
        }
        canvas.removeAttribute("height");
        canvas.removeAttribute("width");
        canvas.style.height = "100%";
        canvas.style.maxHeight = "280px";

        return new Chart(canvas.getContext("2d"), {
            type: "bar",
            data: {
                labels: edadLabels,
                datasets: [
                    {
                        label: `% Hombres ${year}`,
                        data: hombresData.map(v => -Math.abs(Number(v) || 0)),
                        backgroundColor: colorH,
                        borderColor: colorH,
                        borderWidth: 0
                    },
                    {
                        label: `% Mujeres ${year}`,
                        data: mujeresData.map(v => Math.abs(Number(v) || 0)),
                        backgroundColor: colorM,
                        borderColor: colorM,
                        borderWidth: 0
                    }
                ]
            },
            options: {
                indexAxis: "y",
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: true, position: "bottom", labels: { boxWidth: 10, font: { size: 9 } } },
                    tooltip: {
                        callbacks: {
                            label: ctx => {
                                const v = Math.abs(ctx.parsed.x ?? ctx.parsed.y ?? 0);
                                return ` ${ctx.dataset.label}: ${v.toFixed(2)}%`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        stacked: true,
                        min: -axisLimit,
                        max: axisLimit,
                        title: {
                            display: true,
                            text: "Porcentaje de población (%)",
                            font: { size: 8, weight: "600" },
                            color: "#4f4f4f",
                            padding: { top: 2 }
                        },
                        ticks: {
                            font: { size: 8 },
                            callback: v => Math.abs(v) + "%"
                        },
                        grid: { display: false }
                    },
                    y: {
                        stacked: true,
                        ticks: { font: { size: 8 } }
                    }
                },
                onClick: (evt, elements, chart) => {
                    if (!elements.length) return;
                    const active = elements.map(el => ({
                        datasetIndex: el.datasetIndex,
                        index: el.index
                    }));
                    chart.setActiveElements(active);
                    chart.tooltip?.setActiveElements(active, {
                        x: evt?.x ?? 0,
                        y: evt?.y ?? 0
                    });
                    chart.update();
                }
            }
        });
    }

    function crearCuatroPiramides({ edadLabels, censos }) {
        togglePiramidesCharts(true);
        destroyPiramidesCharts();
        [1985, 1993, 2005, 2018].forEach(yr => {
            const d = censos[yr];
            if (!d) return;
            pChartInstances[yr] = crearPiramidesChart(`pChart${yr}`, yr, edadLabels, d.hombres, d.mujeres);
        });
    }

    function getEdadPiramideRank(edad) {
        const label = String(edad || "").trim();
        if (!label) return 9999;
        if (/^100\+/.test(label)) return 100;
        const match = label.match(/\d+/);
        return match ? Number(match[0]) : 9999;
    }

    function sortPiramideRowsByEdad(rows = []) {
        return rows.slice().sort((a, b) => {
            const rankDiff = getEdadPiramideRank(a.edad) - getEdadPiramideRank(b.edad);
            if (rankDiff !== 0) return rankDiff;
            return String(a.edad || "").localeCompare(String(b.edad || ""), "es", { numeric: true });
        });
    }
    // ────────────────────────────────────────────────────────────────────

    function crearGrafica(labels, values, colors, type = 'bar', isVertical = false, datasets = null, chartOptions = {}) {

        const layerConfig = getActiveLayerConfig();
        const valueSuffix = chartOptions.valueSuffix || (layerConfig?.id === "densidad_poblacion" ? " hab/ha" : "%");
        const isDensidadBarChart = layerConfig?.id === "densidad_poblacion" && type === "bar";
        const disconnectDensidadMapSync = isDensidadBarChart && filtroNivel === "MUNI";
        const isPropiedadRuralBarChart = layerConfig?.id === "propiedad_rural" && type === "bar";
        const isStyledVerticalBarChart = isDensidadBarChart || isPropiedadRuralBarChart;
        if (typeof togglePiramidesCharts === 'function') togglePiramidesCharts(false);
        if (typeof destroyPiramidesCharts === 'function') destroyPiramidesCharts();
        if (typeof toggleTransicionCharts === 'function') toggleTransicionCharts(false);
        if (typeof destroyTransicionCharts === 'function') destroyTransicionCharts();
        if (typeof toggleMigracionExternaCharts === 'function') toggleMigracionExternaCharts(false);
        if (typeof destroyMigracionExternaCharts === 'function') destroyMigracionExternaCharts();
        if (typeof toggleMigracionInternaCharts === 'function') toggleMigracionInternaCharts(false);
        if (typeof destroyMigracionInternaCharts === 'function') destroyMigracionInternaCharts();
        if (!layerConfig?.isComposicion && !layerConfig?.isContextoHistorico && !layerConfig?.isTasaCrecimiento && !layerConfig?.isMigracionExterna && !layerConfig?.isMigracionInterna && !layerConfig?.isIndicesComplementarios) {
            const slider = document.getElementById("periodoSliderContainer");
            if (slider) slider.style.display = "none";
        }
        if (type === 'bar' && !isVertical) {
            labels = labels.map(l => wrapLabel(l, 22));
        }
        const axisTitles = getAxisTitles(layerConfig, type, isVertical, datasets);

        const chartCanvas = document.getElementById("chart");
        chartCanvas?.closest(".chart-card")?.classList.remove("composicion-chart-active");
        const ctx = chartCanvas.getContext("2d");
        if (chartInstance) chartInstance.destroy();

        const chartDatasets = datasets || [{
            label: "",
            data: values,
            backgroundColor: colors || "rgba(0, 121, 193, 0.6)",
            borderColor: "rgba(0,0,0,0)",
            borderWidth: type === "bar" ? 0 : 2,
            borderRadius: type === "bar" ? 7 : 0,
            borderSkipped: false,
            barPercentage: isDensidadBarChart ? 0.58 : 0.72,
            categoryPercentage: isDensidadBarChart ? 0.62 : 0.78,
            hoverBorderColor: "rgba(0, 84, 112, 0.85)",
            hoverBorderWidth: type === "bar" ? 2 : 0
        }];

        const isStacked = Array.isArray(datasets) && datasets.length > 0;

        const config = {
            type,
            data: { labels, datasets: chartDatasets },
            options: {
                responsive: true,
                interaction: {
                    mode: "nearest",
                    intersect: true
                },
                animation: {
                    duration: 420,
                    easing: "easeOutQuart"
                },
                onClick: async (evt, elements) => {
                    if (disconnectDensidadMapSync) return;
                    if (!elements.length) return;

                    const el = elements[0];
                    const clickedCode = barChartSyncState?.visibleCodes?.[el.index];
                    if (clickedCode && await selectOnlyLegendCode(clickedCode, { zoom: true })) return;
                    if (legendState?.field && barChartSyncState?.chart) return;

                    let clickedLabel = chartInstance.data.labels?.[el.index];

                    if (Array.isArray(clickedLabel)) clickedLabel = clickedLabel.join(" ");

                    if (clickedLabel != null) {
                        filtrarPorAtributo(String(clickedLabel));
                    }
                },
                plugins: {
                    legend: {
                        display: datasets !== null,
                        position: datasets ? 'right' : 'bottom',
                        labels: {
                            boxWidth: 12,
                            font: { size: 10 },
                            usePointStyle: false,
                            pointStyle: "rectRounded"
                        }
                    },
                    tooltip: {
                        backgroundColor: "rgba(0, 72, 96, 0.94)",
                        titleColor: "#ffffff",
                        bodyColor: "#ffffff",
                        borderColor: "rgba(255, 255, 255, 0.22)",
                        borderWidth: 1,
                        cornerRadius: 8,
                        padding: 10,
                        displayColors: true,
                        boxPadding: 4,
                        callbacks: {
                            title: function (items) {
                                const item = items?.[0];
                                const label = item?.label || "";
                                return Array.isArray(label) ? label.join(" ") : String(label);
                            },
                            label: function (context) {
                                let label = context.dataset.label || '';
                                if (!label && isDensidadBarChart) label = "Densidad";
                                if (label) label += ': ';

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
                                    const decimals = Math.abs(Number(value)) >= 100 ? 1 : 2;
                                    label += Number(value).toFixed(decimals).replace('.', ',') + valueSuffix;
                                }

                                return label;
                            }
                        }
                    }
                }
            }
        };

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

            if (isVertical) {
                config.options.indexAxis = 'x';
                config.options.maintainAspectRatio = false;
                config.options.layout = {
                    padding: {
                        top: isStyledVerticalBarChart ? 22 : 8,
                        right: isStyledVerticalBarChart ? 24 : 10,
                        bottom: isStyledVerticalBarChart ? 12 : (isSmallScreen ? 8 : 4),
                        left: isStyledVerticalBarChart ? 18 : (isSmallScreen ? 8 : 16)
                    }
                };

                config.options.scales = {
                    x: {
                        stacked: isStacked,
                        title: {
                            display: !!axisTitles.xTitle,
                            text: axisTitles.xTitle,
                            color: "#4c4c4c",
                            font: {
                                family: isStyledVerticalBarChart ? "'Segoe UI', 'Outfit', sans-serif" : undefined,
                                size: isStyledVerticalBarChart ? (isVerySmallScreen ? 10 : 11) : (isVerySmallScreen ? 9 : isSmallScreen ? 10 : 11),
                                weight: "normal"
                            },
                            padding: { top: isStyledVerticalBarChart ? 14 : 12 }
                        },
                        ticks: {
                            autoSkip: false,
                            maxTicksLimit: isVerySmallScreen ? 4 : isSmallScreen ? 5 : 8,
                            maxRotation: isStyledVerticalBarChart ? 0 : (isSmallScreen ? 65 : 45),
                            minRotation: isStyledVerticalBarChart ? 0 : (isSmallScreen ? 65 : 35),
                            padding: isStyledVerticalBarChart ? 10 : 6,
                            font: {
                                family: isStyledVerticalBarChart ? "'Segoe UI', 'Outfit', sans-serif" : undefined,
                                size: isStyledVerticalBarChart ? (isVerySmallScreen ? 9 : 10) : (isVerySmallScreen ? 9 : isSmallScreen ? 10 : 11),
                                weight: isStyledVerticalBarChart ? "600" : "normal"
                            },
                            color: "#4f4f4f",
                            callback: function (value) {
                                const label = this.getLabelForValue(value);
                                return isStyledVerticalBarChart ? wrapLabel(label, isSmallScreen ? 10 : 14) : label;
                            }
                        },
                        grid: { display: false },
                        border: { display: false }
                    },
                    y: {
                        beginAtZero: true,
                        stacked: isStacked,
                        title: {
                            display: !!axisTitles.yTitle,
                            text: axisTitles.yTitle,
                            color: "#4c4c4c",
                            font: {
                                family: isStyledVerticalBarChart ? "'Segoe UI', 'Outfit', sans-serif" : undefined,
                                size: isStyledVerticalBarChart ? 10 : 11,
                                weight: isStyledVerticalBarChart ? "normal" : "600"
                            },
                            padding: { bottom: isStyledVerticalBarChart ? 4 : 4 }
                        },
                        ticks: {
                            color: isStyledVerticalBarChart ? "#4c4c4c" : "#5f5f5f",
                            padding: isStyledVerticalBarChart ? 8 : 3,
                            font: {
                                family: isStyledVerticalBarChart ? "'Segoe UI', 'Outfit', sans-serif" : undefined,
                                size: isStyledVerticalBarChart ? (isVerySmallScreen ? 9 : 10) : (isVerySmallScreen ? 9 : 10),
                                weight: isStyledVerticalBarChart ? "600" : undefined
                            },
                            callback: function (value) {
                                const decimals = Math.abs(Number(value)) >= 100 ? 0 : 1;
                                return Number(value).toLocaleString("es-CO", {
                                    maximumFractionDigits: decimals
                                });
                            }
                        },
                        grid: {
                            color: "rgba(0, 72, 96, 0.08)",
                            drawBorder: false
                        },
                        border: { display: false }
                    }
                };
            } else {
                config.options.indexAxis = 'y';
                config.options.maintainAspectRatio = false;
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
                        title: {
                            display: !!axisTitles.xTitle,
                            text: axisTitles.xTitle,
                            padding: { top: 10 }
                        },
                        ticks: {
                            font: {
                                size: isVerySmallScreen ? 9 : 10
                            }
                        }
                    },
                    y: {
                        stacked: isStacked,
                        title: {
                            display: !!axisTitles.yTitle,
                            text: axisTitles.yTitle,
                            padding: { bottom: 12 }
                        },
                        ticks: {
                            autoSkip: false,
                            maxTicksLimit: (
                                isVerySmallScreen
                                    ? 5
                                    : isSmallScreen
                                        ? (tooManyItemsMobile ? 6 : 8)
                                        : (tooManyItems ? 8 : 12)
                            ),
                            padding: 4,
                            font: {
                                size: isVerySmallScreen ? 8 : isSmallScreen ? 9 : 10
                            },
                            callback: function (value) {
                                const label = this.getLabelForValue(value);
                                return wrapLabel(label, isSmallScreen ? 18 : 24);
                            }
                        }
                    }
                };
            }

            if (chartCanvas) {
                if (!isVertical) {
                    const base = isSmallScreen ? 360 : 320;
                    const extraPerItem = isVerySmallScreen ? 34 : isSmallScreen ? 30 : 26;
                    const dynamicHeight = Math.max(base, 160 + (totalLabels * extraPerItem));
                    chartCanvas.style.height = `${dynamicHeight}px`;
                } else {
                    chartCanvas.style.height = isDensidadBarChart
                        ? (isSmallScreen ? "390px" : "340px")
                        : isPropiedadRuralBarChart
                            ? (isSmallScreen ? "390px" : "340px")
                        : (isSmallScreen ? "360px" : "300px");
                }
            }
        }

        if (layerConfig?.id === "densidad_poblacion" && type === 'bar') {
            config.plugins = [{
                id: 'barLabels',
                afterDatasetsDraw(chart) {
                    const { ctx, chartArea } = chart;
                    ctx.save();
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.font = '700 11px "Outfit", sans-serif';
                    chart.data.datasets.forEach((dataset, i) => {
                        const meta = chart.getDatasetMeta(i);
                        meta.data.forEach((bar, index) => {
                            const val = dataset.data[index];
                            if (val === null || val === undefined) return;

                            const decimals = Math.abs(Number(val)) >= 100 ? 1 : 2;
                            const text = Number(val).toFixed(decimals).replace('.', ',') + valueSuffix;
                            const textWidth = ctx.measureText(text).width;
                            const paddingX = 8;
                            const paddingY = 4;
                            const h = 20;
                            const w = textWidth + paddingX * 2;
                            const isVerticalChart = chart.options.indexAxis !== 'y';
                            let x;
                            let y;

                            if (isVerticalChart) {
                                const barTop = Math.min(bar.y, bar.base);
                                const barBottom = Math.max(bar.y, bar.base);
                                const barHeight = barBottom - barTop;
                                const hasVerticalRoom = barHeight >= h + 8;

                                x = Math.min(Math.max(bar.x - w / 2, chartArea.left + 2), chartArea.right - w - 2);
                                y = hasVerticalRoom
                                    ? barTop + (barHeight - h) / 2
                                    : barTop - h - 6;

                                if (y < chartArea.top + 2) {
                                    y = Math.min(barTop + 6, chartArea.bottom - h - 2);
                                }
                            } else {
                                const barLeft = Math.min(bar.x, bar.base);
                                const barRight = Math.max(bar.x, bar.base);
                                const barWidth = barRight - barLeft;
                                const hasHorizontalRoom = barWidth >= w + 12;

                                x = hasHorizontalRoom
                                    ? barLeft + (barWidth - w) / 2
                                    : barRight + 8;
                                x = Math.min(Math.max(x, chartArea.left + 2), chartArea.right - w - 2);
                                y = bar.y - h / 2;
                            }

                            // Sombra opcional para parecerse más a la imagen
                            ctx.shadowColor = 'rgba(0,72,96,0.14)';
                            ctx.shadowBlur = 7;
                            ctx.shadowOffsetX = 0;
                            ctx.shadowOffsetY = 2;

                            ctx.beginPath();
                            if (ctx.roundRect) {
                                ctx.roundRect(x, y, w, h, 4);
                            } else {
                                ctx.rect(x, y, w, h);
                            }
                            ctx.fillStyle = '#ffffff';
                            ctx.fill();

                            ctx.shadowColor = 'transparent';
                            ctx.lineWidth = 1;
                            ctx.strokeStyle = 'rgba(0,72,96,0.12)';
                            ctx.stroke();

                            ctx.fillStyle = '#24434d';
                            ctx.fillText(text, x + w / 2, y + h / 2);
                        });
                    });
                    ctx.restore();
                }
            }];
        }

        if (layerConfig?.id === "propiedad_rural" && type === 'bar') {
            config.plugins = [{
                id: 'propiedadRuralBarLabels',
                afterDatasetsDraw(chart) {
                    const { ctx, chartArea } = chart;
                    ctx.save();
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.font = '700 10px "Segoe UI", "Outfit", sans-serif';

                    chart.data.datasets.forEach((dataset, i) => {
                        const meta = chart.getDatasetMeta(i);
                        meta.data.forEach((bar, index) => {
                            const rawValue = dataset.data[index];
                            const val = Number(rawValue);
                            if (rawValue === null || rawValue === undefined || !Number.isFinite(val)) return;

                            const text = val.toLocaleString("es-CO", { maximumFractionDigits: 0 });
                            const textWidth = ctx.measureText(text).width;
                            const paddingX = 8;
                            const h = 20;
                            const w = textWidth + paddingX * 2;
                            const props = bar.getProps(["x", "y", "base"], true);
                            const barTop = Math.min(props.y, props.base);
                            const barBottom = Math.max(props.y, props.base);
                            const barHeight = barBottom - barTop;
                            const hasVerticalRoom = val !== 0 && barHeight >= h + 10;

                            const x = Math.min(Math.max(props.x - w / 2, chartArea.left + 2), chartArea.right - w - 2);
                            let y = val === 0
                                ? Math.max(chartArea.top + 2, Math.min(chartArea.bottom - h - 2, props.base - h - 6))
                                : hasVerticalRoom
                                    ? barTop + (barHeight - h) / 2
                                    : barTop - h - 6;

                            if (y < chartArea.top + 2) {
                                y = Math.min(barTop + 6, chartArea.bottom - h - 2);
                            }

                            ctx.shadowColor = 'rgba(0,72,96,0.14)';
                            ctx.shadowBlur = 7;
                            ctx.shadowOffsetX = 0;
                            ctx.shadowOffsetY = 2;
                            ctx.beginPath();
                            if (ctx.roundRect) {
                                ctx.roundRect(x, y, w, h, 4);
                            } else {
                                ctx.rect(x, y, w, h);
                            }
                            ctx.fillStyle = '#ffffff';
                            ctx.fill();

                            ctx.shadowColor = 'transparent';
                            ctx.lineWidth = 1;
                            ctx.strokeStyle = 'rgba(0,72,96,0.12)';
                            ctx.stroke();
                            ctx.fillStyle = '#24434d';
                            ctx.fillText(text, x + w / 2, y + h / 2);
                        });
                    });
                    ctx.restore();
                }
            }];
        }

        chartInstance = new Chart(ctx, config);
        if (disconnectDensidadMapSync) {
            barChartSyncState = null;
        } else {
            registerSyncedBarChart(chartInstance, labels, { codes: chartOptions.codes });
        }

        chartCanvas.ondblclick = disconnectDensidadMapSync ? null : async (evt) => {
            const clickedBars = chartInstance.getElementsAtEventForMode(evt, "nearest", { intersect: true }, false);
            if (!clickedBars.length) {
                await clearLegendSelection({ zoom: true });
            }
        };
    }


    function actualizarTituloGrafico(config, mpnombre, dpnombre) {
        const titleElement = document.getElementById("chartTitle");
        if (!titleElement) return;

        let titulo = "Distribución (%)";
        if (filtroNivel === "DEPTO" && deptoActual) {
            const depName = diccionarioDepartamentos[deptoActual] || deptoActual;


            titleElement.textContent = `Distribución (%)`;
            return;
        }

        titleElement.textContent = titulo;
    }



    // =====================
    // LEYENDA POR EXTENT (solo lo visible)
    // =====================

    // 1) Decide qué campos necesita la query según la capa activa
    const contextoHistoricoIndigenaLabels = new Set([
        "Muisca", "Yarigui", "Yalcón", "Tumaco", "Tairona", "Sinú",
        "Quillacinga-Pasto", "Pijao", "Paez", "Loma", "Guambiano",
        "Guane", "Embera", "Ansema,Quimbaya,Quindio", "Cuna", "Chimila"
    ]);

    const contextoHistoricoSymbolSpecs = {
        "Ocupación Indígena": { color: "#FFD37F", outline: "#FFAA00", style: "solid", lineWidth: 0.7 },
        "Region Caribe": { color: "#E39E00", outline: "#E39E00", style: "backward-diagonal", lineWidth: 0.4 },
        "Region Central": { color: "#4C0073", outline: "#4C0073", style: "backward-diagonal", lineWidth: 0.4 },
        "Region Occidental": { color: "#F57A7A", outline: "#F57A7A", style: "horizontal", lineWidth: 0.4 },
        "Áreas de altiplanos": { color: "#FFD37F", outline: "#FFAA00", style: "solid", lineWidth: 0.7 },
        "Explotaciones mineras": { color: "#F5A27A", outline: "#F5A27A", style: "solid", lineWidth: 0.7 },
        "Valles aluviales": { color: "#FDD6FB", outline: "#FDBDFF", style: "solid", lineWidth: 0.7 },
        "Colonización antioqueña": { color: "#FFD37F", outline: "#FFD37F", style: "solid", lineWidth: 12 },
        "Cundinamarquesa": { color: "#F5A27A", outline: "#F5A27A", style: "solid", lineWidth: 12 },
        "De los valles del río Sinú y San Jorge": { color: "#4C7300", outline: "#4C7300", style: "solid", lineWidth: 12 },
        "Del valle del río Magdalena": { color: "#A87000", outline: "#A87000", style: "solid", lineWidth: 12 },
        "Santandereana": { color: "#A80084", outline: "#A80084", style: "solid", lineWidth: 12 },
        "Amazonía": { color: "#FFD37F", outline: "#FFD37F", style: "forward-diagonal", lineWidth: 0.4 },
        "Magdalena Medio": { color: "#5C8944", outline: "#267300", style: "forward-diagonal", lineWidth: 0.4 },
        "Orinoquía": { color: "#88C874", outline: "#6EAA5D", style: "dot-pattern", lineWidth: 0.4 },
        "Urabá": { color: "#F57A7A", outline: "#F57A7A", style: "forward-diagonal", lineWidth: 0.4 }
    };

    Object.values(contextoHistoricoSymbolSpecs).forEach(spec => {
        if (spec?.lineWidth === 12) {
            spec.strokeWidth = 1;
            delete spec.lineWidth;
        }
    });
    contextoHistoricoSymbolSpecs["Frente de expansión"] = { color: "#E69800", outline: "#E69800", style: "solid", strokeWidth: 1 };
    const contextoHistoricoOrinoquiaPatternUrl = `data:image/svg+xml,${encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="1.25" fill="#88C874"/></svg>'
    )}`;

    const contextoHistoricoLabelAliases = {
        "Región Caribe": "Region Caribe",
        "Región Central": "Region Central",
        "Región Occidental": "Region Occidental",
        "Areas de altiplanos": "Áreas de altiplanos",
        "Amazonia": "Amazonía",
        "Orinoquia": "Orinoquía",
        "Uraba": "Urabá",
        "Colonizacion antioqueña": "Colonización antioqueña",
        "De los valles del rio Sinu y San Jorge": "De los valles del río Sinú y San Jorge",
        "Del valle del rio Magdalena": "Del valle del río Magdalena"
    };

    contextoHistoricoLabelAliases["Frente de expansion"] = "Frente de expansión";

    function sqlLiteral(value) {
        return `'${String(value ?? "").replace(/'/g, "''")}'`;
    }

    function uniqueSqlValues(values) {
        return [...new Set(values.map(value => String(value ?? "").trim()).filter(Boolean))];
    }

    function getContextoHistoricoSqlVariants(label) {
        const baseLabel = String(label ?? "").trim();
        const variants = [baseLabel];

        Object.entries(contextoHistoricoLabelAliases).forEach(([rawLabel, normalizedLabel]) => {
            if (normalizedLabel === baseLabel) variants.push(rawLabel);
        });

        return uniqueSqlValues(variants);
    }

    function isContextoHistoricoIndigenaLabel(label) {
        const normalized = String(label ?? "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase();

        return normalized.includes("indig") || normalized.includes("prehisp");
    }

    function buildContextoHistoricoLegendWhere(activeCodes) {
        const selectedLabels = uniqueSqlValues(Array.from(activeCodes || []));
        if (!selectedLabels.length) return "1=0";

        const clauses = [];
        const regularValues = [];
        let includesIndigena = false;

        selectedLabels.forEach(label => {
            if (isContextoHistoricoIndigenaLabel(label) || isContextoHistoricoIndigenaLabel(normalizeContextoHistoricoLabel(label, ""))) {
                includesIndigena = true;
                return;
            }

            regularValues.push(...getContextoHistoricoSqlVariants(label));
        });

        if (includesIndigena) {
            const indigenousCategoryValues = uniqueSqlValues([
                CONTEXTO_HISTORICO_INDIGENA_LABEL,
                "Ocupacion Indigena",
                "Prehisp\u00e1nico"
            ]);
            const indigenousDescriptionValues = uniqueSqlValues(Array.from(contextoHistoricoIndigenaLabels || []));

            clauses.push(`(categoria IN (${indigenousCategoryValues.map(sqlLiteral).join(",")}) OR categoria LIKE '%Indigena%' OR categoria LIKE '%Ind\u00edgena%' OR descripcion IN (${indigenousDescriptionValues.map(sqlLiteral).join(",")}))`);
        }

        const regularSqlValues = uniqueSqlValues(regularValues);
        if (regularSqlValues.length) {
            const valuesSql = regularSqlValues.map(sqlLiteral).join(",");
            clauses.push(`(categoria IN (${valuesSql}) OR descripcion IN (${valuesSql}))`);
        }

        return clauses.length ? clauses.join(" OR ") : "1=0";
    }

    function normalizeContextoHistoricoLabel(cat, desc) {
        const cleanCat = String(cat || "").trim();
        const cleanDesc = String(desc || "").trim();

        if (
            cleanCat === "Ocupación Indígena" ||
            cleanCat === "Ocupacion Indigena" ||
            cleanCat === "Prehispánico" ||
            cleanCat.includes("Indígena") ||
            contextoHistoricoIndigenaLabels.has(cleanDesc)
        ) {
            return "Ocupación Indígena";
        }

        const label = cleanDesc || cleanCat;
        return contextoHistoricoLabelAliases[label] || label;
    }

    function getContextoHistoricoSpec(label) {
        return contextoHistoricoSymbolSpecs[label] || null;
    }

    function buildContextoHistoricoValueExpression() {
        const indigenous = [
            "Muisca", "Yarigui", "Yalcón", "Tumaco", "Tairona", "Sinú",
            "Quillacinga-Pasto", "Pijao", "Paez", "Loma", "Guambiano",
            "Guane", "Embera", "Ansema,Quimbaya,Quindio", "Cuna", "Chimila"
        ].join(",");

        return `
            var c = DefaultValue($feature.categoria, '');
            var d = DefaultValue($feature.descripcion, '');
            var indigenous = ',${indigenous},';
            if (c == 'Ocupación Indígena' || c == 'Ocupacion Indigena' || c == 'Prehispánico' || Find('Indígena', c) > -1 || Find(',' + d + ',', indigenous) > -1) {
                return 'Ocupación Indígena';
            }
            var label = IIF(IsEmpty(d), c, d);
            return Decode(
                label,
                'Región Caribe', 'Region Caribe',
                'Región Central', 'Region Central',
                'Región Occidental', 'Region Occidental',
                'Areas de altiplanos', 'Áreas de altiplanos',
                'Amazonia', 'Amazonía',
                'Orinoquia', 'Orinoquía',
                'Uraba', 'Urabá',
                'Colonizacion antioqueña', 'Colonización antioqueña',
                'De los valles del rio Sinu y San Jorge', 'De los valles del río Sinú y San Jorge',
                'Del valle del rio Magdalena', 'Del valle del río Magdalena',
                'Frente de expansion', 'Frente de expansión',
                label
            );
        `;
    }

    function buildContextoHistoricoSymbol(label, geometryKind = "polygon") {
        const spec = getContextoHistoricoSpec(label) || { color: "#999999", outline: "#666666", style: "solid" };

        if (geometryKind === "line") {
            return {
                type: "simple-line",
                color: spec.outline || spec.color,
                width: spec.strokeWidth || spec.lineWidth || 1,
                style: "solid",
                // El servicio digitaliza el flujo en su sentido histórico; la flecha marca su extremo final.
                marker: {
                    type: "line-marker",
                    style: "arrow",
                    placement: "end",
                    color: spec.outline || spec.color
                }
            };
        }

        if (label === "Orinoquía") {
            return {
                type: "picture-fill",
                url: contextoHistoricoOrinoquiaPatternUrl,
                width: "8px",
                height: "8px",
                outline: {
                    color: spec.outline,
                    width: spec.lineWidth || 0.4
                }
            };
        }

        return {
            type: "simple-fill",
            style: spec.style || "solid",
            color: spec.color,
            outline: {
                color: spec.outline || spec.color,
                width: spec.lineWidth || 0.7
            }
        };
    }

    function buildContextoHistoricoRenderer(geometryKind = "polygon") {
        const labels = Object.keys(contextoHistoricoSymbolSpecs);

        return {
            type: "unique-value",
            valueExpressionTitle: "Contexto histórico",
            valueExpression: buildContextoHistoricoValueExpression(),
            uniqueValueInfos: labels.map(label => ({
                value: label,
                label,
                symbol: buildContextoHistoricoSymbol(label, geometryKind)
            })),
            defaultSymbol: geometryKind === "line"
                ? { type: "simple-line", color: "#999999", width: 1 }
                : {
                    type: "simple-fill",
                    style: "solid",
                    color: [153, 153, 153, 0.35],
                    outline: { color: "#666666", width: 0.4 }
                },
            defaultLabel: "Sin clasificar"
        };
    }

    const contextoHistoricoPeriodos = ["Todos", "Prehispánico", "Colonial", "Republicano", "Contemporáneo"];
    const contextoHistoricoLegendPeriodOrder = [
        "Prehisp\u00e1nico",
        "Colonial",
        "Republicano Temprano",
        "Contempor\u00e1neo"
    ];

    const contextoHistoricoTimelineToPeriodo = {
        perpreh: "Prehispánico",
        percol: "Colonial",
        perrep: "Republicano",
        percon: "Republicano",
        permod: "Republicano",
        percont: "Contemporáneo"
    };
    const contextoHistoricoPeriodoToTimeline = {
        "Prehispánico": "perpreh",
        Colonial: "percol",
        Republicano: "perrep",
        "Contemporáneo": "percont"
    };

    function getContextoHistoricoPeriodoQueryValue(periodo) {
        return periodo === "Republicano" ? "República" : periodo;
    }

    function getContextoHistoricoPeriodoWhere(periodo) {
        if (!periodo || periodo === "Todos") return "1=1";
        return `periodo = '${getContextoHistoricoPeriodoQueryValue(periodo)}'`;
    }

    function normalizeContextoHistoricoLegendPeriod(periodo, categoryLabel = "") {
        const raw = String(periodo || "").trim();
        const clean = raw
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase();
        const labelClean = String(categoryLabel || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase();

        if (clean.includes("prehisp") || labelClean.includes("indig")) return "Prehisp\u00e1nico";
        if (clean.includes("colon")) return "Colonial";
        if (clean.includes("republic") || clean.includes("republica")) return "Republicano Temprano";
        if (clean.includes("contempor")) return "Contempor\u00e1neo";
        return "";
    }

    function getContextoHistoricoLegendPeriodRank(periodo) {
        const normalizedPeriod = normalizeContextoHistoricoLegendPeriod(periodo);
        const index = contextoHistoricoLegendPeriodOrder.indexOf(normalizedPeriod);
        return index >= 0 ? index : 999;
    }

    function getContextoHistoricoTerritoryWhereForLayer(layer) {
        const fields = (layer?.fields || []).map(field => String(field.name || "").toLowerCase());

        if (municipioActual && fields.includes("mpcodigo")) {
            return `mpcodigo = '${String(municipioActual).replace(/'/g, "''")}'`;
        }

        if (deptoActual && fields.includes("dpcodigo")) {
            return `dpcodigo = '${String(deptoActual).replace(/'/g, "''")}'`;
        }

        return "";
    }

    function combineWhereClauses(...clauses) {
        const validClauses = clauses
            .map(clause => String(clause || "").trim())
            .filter(clause => clause && clause !== "1=1");

        return validClauses.length ? validClauses.map(clause => `(${clause})`).join(" AND ") : "1=1";
    }

    async function filterLegendItemsWithLayerData({ layer, baseWhere = "1=1", items = [], wheres = [] } = {}) {
        if (!layer || !Array.isArray(items) || !items.length) {
            return { items: [], wheres: [] };
        }

        const validations = await Promise.all(items.map(async (item, index) => {
            const itemWhere = wheres[index] || "1=1";
            const where = combineWhereClauses(baseWhere, itemWhere);

            try {
                let count = 0;
                if (typeof layer.queryFeatureCount === "function") {
                    count = await layer.queryFeatureCount({ where });
                } else if (typeof layer.queryFeatures === "function") {
                    const result = await layer.queryFeatures({
                        where,
                        returnGeometry: false,
                        outFields: ["objectid"],
                        num: 1
                    });
                    count = result?.features?.length || 0;
                }

                return count > 0 ? { item, where: itemWhere } : null;
            } catch (error) {
                console.warn("No fue posible validar una categoria de la leyenda; se conserva como respaldo.", error);
                return { item, where: itemWhere };
            }
        }));

        const filtered = validations.filter(Boolean);
        return {
            items: filtered.map(entry => entry.item),
            wheres: filtered.map(entry => entry.where)
        };
    }

    function getCurrentTerritoryWhere() {
        if (municipioActual) {
            return `mpcodigo = '${String(municipioActual).replace(/'/g, "''")}'`;
        }

        if (filtroNivel === "DEPTO" && deptoActual) {
            return `dpcodigo = '${String(deptoActual).replace(/'/g, "''")}'`;
        }

        return "1=1";
    }

    function shouldShowDepartmentMapWhenMunicipal(config = {}) {
        return !!(
            config.isDistribucion ||
            config.isComposicion ||
            config.isTasaCrecimiento ||
            config.isMigracionExterna ||
            config.isMigracionInterna ||
            config.isAutoreconocimientoEtnico ||
            config.isCondicionesSeguridad ||
            config.isIndicesComplementarios ||
            config.isPiramides ||
            config.isTransicion
        );
    }

    function buildDepartmentMapWhereForConfig(config = {}, dpCode = "") {
        const cleanCode = String(dpCode || "").replace(/'/g, "''");
        if (!cleanCode) return "1=1";

        if (config.isAutoreconocimientoEtnico || config.isCondicionesSeguridad) {
            return `SUBSTRING(mpcodigo,1,2) = '${cleanCode}'`;
        }

        return `dpcodigo = '${cleanCode}'`;
    }

    function getCurrentTerritoryLabel(attrs = {}) {
        if (municipioActual) {
            const mpNombre = diccionarioMunicipios?.[municipioActual] || attrs.mpnombre || municipioActual;
            const dpCode = deptoActual || String(municipioActual).slice(0, 2);
            const dpNombre = diccionarioDepartamentos?.[dpCode] || attrs.dpnombre || dpCode;
            return `${mpNombre}, ${dpNombre}`;
        }

        if (filtroNivel === "DEPTO" && deptoActual) {
            return diccionarioDepartamentos?.[deptoActual] || attrs.dpnombre || deptoActual;
        }

        return "Colombia";
    }

    async function zoomToCurrentTerritory({
        request = null,
        duration = 700,
        drawTerritory = false,
        zoomDepartmentWhenMunicipal = false
    } = {}) {
        if (!view) return;

        try {
            await view.when();
        } catch {
            return;
        }

        const shouldZoomDepartment = zoomDepartmentWhenMunicipal && municipioActual && deptoActual;
        const zoomWhere = shouldZoomDepartment
            ? `dpcodigo = '${String(deptoActual).replace(/'/g, "''")}'`
            : getCurrentTerritoryWhere();
        const drawWhere = getCurrentTerritoryWhere();
        const where = zoomWhere;
        if (!drawTerritory) {
            try { view.graphics.removeAll(); } catch (e) { }
        }

        if (where === "1=1") {
            if (drawTerritory) {
                try { view.graphics.removeAll(); } catch (e) { }
            }
            const fallbackTarget = { center: [-74.3, 4.6], zoom: 5 };
            const target = extentInicial || fallbackTarget;

            try {
                await view.goTo(target, { duration, easing: "ease-in-out" });
            } catch (error) {
                if (String(error?.message || "").toLowerCase().includes("aborted")) return;
                await view.goTo(fallbackTarget, { duration, easing: "ease-in-out" });
            }
            return;
        }

        try {
            const zoomLayerUrl = (shouldZoomDepartment || (filtroNivel === "DEPTO" && deptoActual && !municipioActual))
                ? "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componenteocupacion/MapServer/1"
                : "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componenteocupacion/MapServer/2";
            const zoomLayer = getOrCreateFeatureLayer({
                url: zoomLayerUrl,
                outFields: ["*"],
                visible: false
            }, `territory-zoom:${zoomLayerUrl}`, FeatureLayer);

            const res = await zoomLayer.queryExtent({ where: zoomWhere });
            if (request && !isCurrentRequest(request)) return;

            if (res?.extent) {
                const margin = shouldZoomDepartment || (filtroNivel === "DEPTO" && deptoActual && !municipioActual) ? 1.12 : 1.18;
                await view.goTo(res.extent.expand(margin), {
                    duration,
                    easing: "ease-in-out"
                });
            }

            if (drawTerritory) {
                const drawLayerUrl = municipioActual
                    ? "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componenteocupacion/MapServer/2"
                    : zoomLayerUrl;
                const drawLayer = drawLayerUrl === zoomLayerUrl
                    ? zoomLayer
                    : getOrCreateFeatureLayer({
                        url: drawLayerUrl,
                        outFields: ["*"],
                        visible: false
                    }, `territory-draw:${drawLayerUrl}`, FeatureLayer);
                const query = drawLayer.createQuery();
                query.where = drawWhere;
                query.returnGeometry = true;
                query.outFields = ["*"];
                if (view.spatialReference) query.outSpatialReference = view.spatialReference;

                const features = await drawLayer.queryFeatures(query);
                if (request && !isCurrentRequest(request)) return;

                try { view.graphics.removeAll(); } catch (e) { }
                const drawnFeatures = features?.features || [];
                drawnFeatures.forEach(feature => {
                    feature.symbol = {
                        type: "simple-fill",
                        color: [0, 0, 0, 0],
                        outline: {
                            color: [0, 174, 239, 1],
                            width: 1.5
                        }
                    };
                    view.graphics.add(feature);
                });

                if (shouldZoomDepartment && drawnFeatures[0]?.geometry?.extent?.center) {
                    await view.goTo({
                        center: drawnFeatures[0].geometry.extent.center,
                        scale: view.scale
                    }, {
                        duration: 350,
                        easing: "ease-in-out"
                    });
                }
            }
        } catch (error) {
            if (String(error?.message || "").toLowerCase().includes("aborted")) return;
            console.warn("No fue posible acercar el mapa al territorio seleccionado.", error);
        }
    }

    function updateContextoHistoricoPeriodControls(periodo, timelineKey = null) {
        contextoHistoricoPeriodoActivo = periodo || "Todos";
        contextoHistoricoTimelineKeyActivo = timelineKey || contextoHistoricoPeriodoToTimeline[contextoHistoricoPeriodoActivo] || null;

        const slider = document.getElementById("periodoSlider");
        const sliderLabel = document.getElementById("periodoSliderLabel");
        const mapSliderLabel = document.getElementById("mapSliderLabel");
        const timeSliderLabel = document.getElementById("timeSliderLabel");
        const idx = contextoHistoricoPeriodos.indexOf(contextoHistoricoPeriodoActivo);

        if (slider && idx >= 0) slider.value = idx;
        if (sliderLabel) sliderLabel.textContent = "Periodo: " + contextoHistoricoPeriodoActivo;
        if (mapSliderLabel) mapSliderLabel.textContent = "Periodo: " + contextoHistoricoPeriodoActivo;
        if (timeSliderLabel) timeSliderLabel.textContent = "Periodo: " + contextoHistoricoPeriodoActivo;

        document.querySelectorAll(".timeline-item").forEach(item => {
            const key = item.getAttribute("data-periodo");
            item.classList.toggle("active", !!contextoHistoricoTimelineKeyActivo && key === contextoHistoricoTimelineKeyActivo);
        });
    }

    async function applyContextoHistoricoPeriodSelection(periodo = "Todos", { timelineKey = null, refreshLegend = true } = {}) {
        const selectedPeriodo = periodo || "Todos";
        const periodWhere = getContextoHistoricoPeriodoWhere(selectedPeriodo);

        updateContextoHistoricoPeriodControls(selectedPeriodo, timelineKey);
        state.merge({
            contextoHistoricoPeriodo: selectedPeriodo,
            contextoHistoricoPeriodoWhere: periodWhere
        });

        if (layersGlobal.length >= 2) {
            const l_hpl = layersGlobal[0];
            const l_hln = layersGlobal[1];

            const hplWhere = combineWhereClauses(getContextoHistoricoTerritoryWhereForLayer(l_hpl), periodWhere);
            const hlnWhere = combineWhereClauses(getContextoHistoricoTerritoryWhereForLayer(l_hln), periodWhere);

            if (selectedPeriodo === "Todos") {
                l_hpl.visible = true;
                l_hln.visible = true;
                l_hpl.definitionExpression = hplWhere;
                l_hln.definitionExpression = hlnWhere;
                activeFeatureLayer = l_hpl;
            } else if (selectedPeriodo === "Contemporáneo") {
                l_hpl.visible = true;
                l_hln.visible = true;
                l_hpl.definitionExpression = hplWhere;
                l_hln.definitionExpression = hlnWhere;
                activeFeatureLayer = l_hpl;
            } else if (selectedPeriodo === "Republicano") {
                l_hpl.visible = false;
                l_hln.visible = true;
                l_hln.definitionExpression = hlnWhere;
                activeFeatureLayer = l_hln;
            } else {
                l_hpl.visible = true;
                l_hln.visible = false;
                l_hpl.definitionExpression = hplWhere;
                activeFeatureLayer = l_hpl;
            }
        } else if (layerGlobal) {
            layerGlobal.definitionExpression = combineWhereClauses(
                getContextoHistoricoTerritoryWhereForLayer(layerGlobal),
                periodWhere
            );
            activeFeatureLayer = layerGlobal;
        }

        // Mantener el filtro de leyenda sincronizado con el periodo seleccionado.
        if (legendState?.field && typeof applyLegendLayerViewFilter === "function") {
            await applyLegendLayerViewFilter();
        }

        if (refreshLegend && typeof updateLegendByExtent === "function" && activeFeatureLayer) {
            updateLegendByExtent(activeFeatureLayer, getActiveLayerConfig());
        }
    }

    function resetContextoHistoricoPeriodSelection({ refreshLegend = true } = {}) {
        return applyContextoHistoricoPeriodSelection("Todos", { timelineKey: null, refreshLegend });
    }

    function getLegendOutFields(config, layer) {
        if (config.isContextoHistorico) return ["categoria", "descripcion", "periodo"];
        if (!config) return ["*"];

        return [config.labelField];
    }

    // 2) Mapea atributos => {label,color} según tu lógica/diccionarios
    function buildLegendEntryFromAttrs(config, attrs, layer) {
        if (!config || !attrs) return null;

        // Default (hipsometría y otros simples)
        const code = String(attrs[config.labelField] ?? "");

        if (config.isContextoHistorico) {
            const isLineLayer = String(layer?.geometryType || "").toLowerCase().includes("polyline");
            const cat = String(attrs["categoria"] ?? "").trim();
            const desc = String(attrs["descripcion"] ?? "").trim();
            const periodo = normalizeContextoHistoricoLegendPeriod(attrs["periodo"], cat || desc);

            let label = normalizeContextoHistoricoLabel(cat, desc);
            let colorCode = label;

            // Reglas específicas basadas en la especificación del usuario
            if (cat === "Ocupación Indígena" || cat === "Ocupacion Indigena" || cat === "Prehispánico" || cat.includes("Indígena")) {
                label = "Ocupación Indígena";
                colorCode = "Ocupación Indígena";
            } else if (cat === "Frente de expansión" || cat === "Frente de expansion") {
                label = "Frente de expansión";
                colorCode = "Frente de expansión";
            } else if (desc) {
                label = desc;
                colorCode = desc;
            } else {
                label = cat;
                colorCode = cat;
            }

            if (contextoHistoricoIndigenaLabels.has(desc) || normalizeContextoHistoricoLabel(cat, desc) === "Ocupación Indígena") {
                label = "Ocupación Indígena";
                colorCode = "Ocupación Indígena";
            }

            if (contextoHistoricoIndigenaLabels.has(desc)) {
                const indigenousLabel = normalizeContextoHistoricoLabel("Prehispánico", "");
                label = indigenousLabel;
                colorCode = indigenousLabel;
            }

            const normalizedHistoricalLabel = normalizeContextoHistoricoLabel(cat, desc);
            if (getContextoHistoricoSpec(normalizedHistoricalLabel)) {
                label = normalizedHistoricalLabel;
                colorCode = normalizedHistoricalLabel;
            }

            // Intentar obtener color del diccionario extendido (si existe), sino del original, sino fallback
            const defaultColors = {
                "Ocupación Indígena": "#FFD37F",
                "Frente de expansión": "#E69800",
                "Region Caribe": "#38A800",
                "Region Central": "#4C0073",
                "Region Occidental": "#F57A7A",
                "Áreas de altiplanos": "#FFD37F",
                "Explotaciones mineras": "#F5A27A",
                "Valles aluviales": "#FDD6FB",
                "Amazonía": "#FFD37F",
                "Magdalena Medio": "#5C8944",
                "Orinoquía": "rgba(37, 155, 37, 1)",
                "Urabá": "#F57A7A",
                "Colonización antioqueña": "#FFD37F",
                "Cundinamarquesa": "#F5A27A",
                "De los valles del río Sinú y San Jorge": "#4C7300",
                "Del valle del río Magdalena": "#A87000",
                "Santandereana": "#A80084"
            };

            const spec = getContextoHistoricoSpec(label);
            const dictColor = (typeof coloresAreasOcupacion !== "undefined") ? coloresAreasOcupacion[colorCode]?.color : null;
            const finalColor = spec?.color || dictColor || defaultColors[label] || "#999";
            const finalStyle = spec?.style || ((typeof coloresAreasOcupacion !== "undefined") ? coloresAreasOcupacion[colorCode]?.style : null);

            if (!label) return null;

            return {
                label: label,
                color: finalColor,
                style: isLineLayer ? "line" : finalStyle,
                code: label,
                period: periodo
            };
        }

        // si no sabes qué dict usar, deja label=code
        return { label: code, color: "#999" };
    }

    // 3) Ordena labels de manera “bonita” por tipo de capa

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

            if (config.isPropiedadRural) {
                const legendData = buildLegendFromRenderer(layer);
                if (legendData?.labels?.length) {
                    actualizarLeyenda(legendData.labels, legendData.colors, legendData.codes, legendData.styles);
                }
                return;
            }

            // Índices complementarios: filtrar leyenda por datos presentes
            if (config.isIndicesComplementarios) {
                const activeField = layer?.renderer?.field || indiceComplementarioCampoActivo;
                const baseWhere = legendState?.field === activeField
                    ? (legendState.baseWhere || whereBase || "1=1")
                    : (whereBase || layer.definitionExpression || "1=1");
                await refreshIndiceComplementarioMapAndLegend({
                    where: baseWhere,
                    field: activeField,
                    layer
                });
                return;
            }

            if (config.isTasaCrecimiento || config.isMigracionExterna || config.isMigracionInterna) {
                const baseWhere = legendState?.baseWhere || whereBase || layer.definitionExpression || "1=1";
                await refreshTasaCrecimientoMapAndLegend({
                    where: baseWhere,
                    field: tasaCrecimientoCampoActivo,
                    layer
                });
                return;
            }

            let features = [];
            if (config.isContextoHistorico && layersGlobal.length) {
                for (const lyr of layersGlobal) {
                    if (lyr.visible) {
                        const q = lyr.createQuery();
                        q.where = lyr.definitionExpression || "1=1";
                        q.returnGeometry = false;
                        q.returnDistinctValues = true;
                        q.outFields = ["categoria", "descripcion", "periodo"];
                        try {
                            const res = await lyr.queryFeatures(q);
                            if (res && res.features) {
                                res.features.forEach(feature => {
                                    feature.__legendLayer = lyr;
                                });
                                features = features.concat(res.features);
                            }
                        } catch (e) {
                            console.error("Error querying historical layer", e);
                        }
                    }
                }
            } else {
                const q = layer.createQuery();
                q.where = layer.definitionExpression || whereBase || "1=1";
                q.returnGeometry = false;
                const outFields = getLegendOutFields(config, layer);
                q.outFields = outFields;

                q.geometry = view.extent;
                q.spatialRelationship = "intersects";

                if (!layer || layer.destroyed) return;
                const res = await layer.queryFeatures(q);
                if (res && res.features) features = res.features;
            }

            if (reqId !== __legendReqId) return;
            if (!layer || layer.destroyed) return;
            if (!features || !Array.isArray(features)) return;

            if (!features.length) {
                actualizarLeyenda([], []);
                return;
            }

            const byLabel = new Map();

            for (const f of features) {
                const attrs = f.attributes || {};
                const entry = buildLegendEntryFromAttrs(config, attrs, f.__legendLayer || layer);

                if (!entry || entry.fixed) continue;

                const legendKey = config.isContextoHistorico
                    ? `${entry.period || ""}||${entry.label}`
                    : entry.label;

                if (entry.label && !byLabel.has(legendKey)) {
                    byLabel.set(legendKey, {
                        label: entry.label,
                        color: entry.color || "#999",
                        code: entry.code ?? entry.rawCode ?? entry.value ?? entry.label,
                        style: entry.style,
                        period: entry.period || ""
                    });
                }
            }

            const entries = Array.from(byLabel.values());
            const ordered = config.isContextoHistorico
                ? entries.slice().sort((a, b) => {
                    const periodDiff = getContextoHistoricoLegendPeriodRank(a.period) - getContextoHistoricoLegendPeriodRank(b.period);
                    if (periodDiff !== 0) return periodDiff;
                    return String(a.label).localeCompare(String(b.label), "es");
                })
                : sortLegendEntries(config, entries);

            actualizarLeyenda(
                ordered.map(e => e.label),
                ordered.map(e => e.color),
                ordered.map(e => String(e.code ?? e.label)),
                ordered.map(e => e.style || "solid"),
                ordered.map(e => e.period || "")
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


    function buildCtx(layer, config, options = {}) {
        const lyr = (typeof layerGlobal !== "undefined" && layerGlobal) ? layerGlobal : layer;
        const ctxCycleId = renderCycleId;

        return {
            layer,
            lyr,
            config,
            filtroNivel,
            whereBase: (typeof whereBase !== "undefined" && whereBase && String(whereBase).trim()) ? whereBase : "1=1",
            deptoActual,
            municipioActual,
            diccionarioDepartamentos,
            diccionarioMunicipios,
            arcRestQuery,
            crearGrafica,
            actualizarLeyenda: (...args) => {
                if (renderCycleId !== ctxCycleId) return;
                actualizarLeyenda(...args);
            },
            actualizarTituloGrafico,
            destroyChart: () => {
                destroyMainChartCanvas();
            },
            setTitle: (t) => { const el = document.getElementById("chartTitle"); if (el) el.textContent = t; },
            cycleId: ctxCycleId,
            skipSyncMap: !!options.skipSyncMap,
        };
    }
    async function syncMapLayer(ctx) {
        const lyr = ctx.lyr || ctx.layer;
        if (!lyr) return;

        lyr.visible = true;

        if (typeof lyr.opacity === "number" && lyr.opacity === 0) {
            lyr.opacity = 0.7;
        }

        // IMPORTANTE:
        // syncMapLayer NO debe usar layerView.filter porque ese filtro
        // queda reservado exclusivamente para la leyenda interactiva.
        try {
            lyr.definitionExpression = ctx.whereBase || "1=1";
        } catch (_) { }

        try { lyr.refresh(); } catch (_) { }

        // Si hay una leyenda activa para la capa visible, reaplicamos el filtro del mapa.
        try {
            const legendLayer = legendState?.layer;
            const legendMatchesLayer = legendLayer === lyr ||
                legendLayer === activeFeatureLayer ||
                (Array.isArray(layersGlobal) && layersGlobal.includes(legendLayer));

            if (legendState?.field && legendMatchesLayer) {
                await applyLegendLayerViewFilter();
            }
        } catch (_) { }
    }
    /* =======================
    HANDLERS
    ======================= */
    function estructuraPiramidesHandler() {
        return {
            name: "estructuraPiramides",
            when: (ctx) => ctx.config?.isPiramides === true,
            run: async (ctx) => {
                destroyPiramidesCharts();

                const mpCode = ctx.municipioActual;
                if (!mpCode) {
                    togglePiramidesCharts(false);
                    ctx.actualizarLeyenda([], []);
                    return;
                }

                try {
                    const url = ctx.config.url;           // tabla MapServer/26 (sin geometría)
                    const mapUrl = ctx.config.mapLayerUrl; // capa de mapa MapServer/11
                    const where = `mpcodigo = '${mpCode}'`;

                    // ── 1) Capa visual en el mapa: usar mapLayerUrl (capa densidad)
                    //    Reemplazar layerGlobal con la capa de mapa si es distinta
                    if (mapUrl && (!layerGlobal || layerGlobal.url !== mapUrl)) {
                        const mapLayer = new FeatureLayer({
                            url: mapUrl,
                            definitionExpression: where,
                            outFields: ["*"],
                            opacity: 0.8,
                            visible: true,
                            minScale: 0,
                            maxScale: 0
                        });
                        clearLayers();
                        map.add(mapLayer);
                        layerGlobal = mapLayer;
                        activeFeatureLayer = mapLayer;
                        mapLayer.when(() => {
                            mapLayer.queryExtent({ where }).then(res => {
                                if (res?.extent) view.goTo(res.extent.expand(1.3));
                            }).catch(() => { });
                        });
                    } else {
                        applyWhereToActiveLayers(where);
                        layerGlobal?.queryExtent({ where }).then(res => {
                            if (res?.extent) view.goTo(res.extent.expand(1.3));
                        }).catch(() => { });
                    }

                    // ── 2) Consultar datos de la tabla (MapServer/26) ───────────
                    const fields = "edad,h1985,m1985,h1993,m1993,h2005,m2005,h2018,m2018";
                    const queryUrl = `${url}/query?where=${encodeURIComponent(where)}&outFields=${fields}&orderByFields=edad&f=json`;
                    const json = await fetchJsonCached(queryUrl, { cacheKey: buildQueryCacheKey("json", queryUrl) });
                    const features = (json.features || []).map(f => f.attributes);

                    if (!features.length) {
                        togglePiramidesCharts(false);
                        ctx.actualizarLeyenda([], []);
                        return;
                    }

                    // ── 3) Preparar datos por censo ────────────────────────────
                    const edadLabels = features.map(f => f.edad).reverse();
                    const censos = {};
                    [1985, 1993, 2005, 2018].forEach(yr => {
                        censos[yr] = {
                            hombres: features.map(f => Number(f[`h${yr}`]) || 0).reverse(),
                            mujeres: features.map(f => Number(f[`m${yr}`]) || 0).reverse()
                        };
                    });

                    // ── 4) Título ──────────────────────────────────────────────
                    const mpNombre = ctx.diccionarioMunicipios?.[mpCode] || mpCode;
                    const dpNombre = ctx.diccionarioDepartamentos?.[deptoActual] || ctx.deptoActual;
                    ctx.setTitle(`Estructura poblacional del municipio ${mpNombre}, ${dpNombre}`);

                    // ── 5) Renderizar 4 pirámides ──────────────────────────────
                    crearCuatroPiramides({ edadLabels, censos });

                    // ── 6) Leyenda simple ──────────────────────────────────────
                    ctx.actualizarLeyenda(
                        ["% Hombres", "% Mujeres"],
                        ["rgba(79,129,189,0.85)", "rgba(255,35,196,0.90)"]
                    );

                    // ── 7) Texto descriptivo ───────────────────────────────────
                    if (isMunicipal && ctx.config.summaryTableUrl && ctx.config.summaryField) {
                        try {
                            const sUrl = `${ctx.config.summaryTableUrl}/query?where=${encodeURIComponent(where)}&outFields=${ctx.config.summaryField}&f=json`;
                            const sJson = await fetchJsonCached(sUrl, { cacheKey: buildQueryCacheKey("json", sUrl) });
                            const text = sJson.features?.[0]?.attributes?.[ctx.config.summaryField] || "";
                            const sumDiv = document.getElementById("summaryDiv");
                            if (sumDiv) {
                                let html = `<b>Estructura poblacional:</b><br><br>${escapeHtmlWithBreaks(text || "Sin descripción disponible.")}`;
                                html += `<br><br><b>Interpretación:</b><br>`;
                                html += `<ul>
                                            <li>Las barras <span class="oot-js-ocupacion-app-12">rosadas</span> representan el porcentaje de población femenina.</li>
                                            <li>Las barras <span class="oot-js-ocupacion-app-13">azules</span> representan el porcentaje de población masculina.</li>
                                        </ul>`;
                                html = html
                                    .replace("rgba(210,96,118,1)", "rgba(255,35,196,1)")
                                    .replace(">rosadas<", ">fucsias<");
                                sumDiv.innerHTML = html;
                            }
                        } catch (_) { }
                    }

                } catch (e) {
                    console.error("estructuraPiramidesHandler error:", e);
                    togglePiramidesCharts(false);
                    ctx.actualizarLeyenda([], []);
                }
            }
        };
    }

    const propiedadRuralLegendItems = [
        { code: 1, label: "Microfundio", color: "#D1FF73" },
        { code: 2, label: "Minifundio", color: "#AAFF00" },
        { code: 3, label: "Pequeña propiedad", color: "#70A800" },
        { code: 4, label: "Mediana propiedad", color: "#E6E600" },
        { code: 5, label: "Gran propiedad", color: "#A87000" }
    ];

    function buildPropiedadRuralRenderer() {
        return {
            type: "unique-value",
            field: "tprpesp",
            uniqueValueInfos: propiedadRuralLegendItems.map(item => ({
                value: item.code,
                label: item.label,
                symbol: {
                    type: "simple-fill",
                    color: item.color,
                    outline: { color: "#ffffff", width: 0.35 }
                }
            })),
            defaultSymbol: {
                type: "simple-fill",
                color: [220, 220, 220, 0.25],
                outline: { color: "#ffffff", width: 0.25 }
            },
            defaultLabel: "Sin clasificación"
        };
    }

    function hasPropiedadRuralRendererInfos(renderer) {
        return Boolean(renderer?.uniqueValueInfos?.length || renderer?.classBreakInfos?.length);
    }

    function ensurePropiedadRuralRenderer(layer) {
        if (!layer) return;
        if (!hasPropiedadRuralRendererInfos(layer.renderer)) {
            layer.renderer = buildPropiedadRuralRenderer();
        }
    }

    function getPropiedadRuralLegendItem(code) {
        return propiedadRuralLegendItems.find(item => String(item.code) === String(code));
    }

    function propiedadRuralWhereFor(code) {
        return `tprpesp = ${Number(code)}`;
    }

    function propiedadRuralTerritoryWhere({ mpCode = "", dpCode = "", isMunicipal = false, isDepartmental = false } = {}) {
        if (isMunicipal) return `mpcodigo = '${String(mpCode).replace(/'/g, "''")}'`;
        if (isDepartmental) return `SUBSTRING(mpcodigo,1,2) = '${String(dpCode).replace(/'/g, "''")}'`;
        return "1=1";
    }

    function propiedadRuralHandler() {
        return {
            name: "propiedadRural",
            when: (ctx) => ctx.config?.isPropiedadRural === true,
            run: async (ctx) => {
                ctx.destroyChart();

                const mpCode = ctx.municipioActual;
                const dpCode = ctx.deptoActual || deptoActual;
                const isMunicipal = !!mpCode;
                const isDepartmental = !isMunicipal && !!dpCode;
                const isNational = !isMunicipal && !isDepartmental;
                const propMpNombre = isMunicipal ? (ctx.diccionarioMunicipios?.[mpCode] || mpCode) : "";
                const propDpNombre = isDepartmental
                    ? (ctx.diccionarioDepartamentos?.[dpCode] || dpCode)
                    : isMunicipal
                        ? (ctx.diccionarioDepartamentos?.[deptoActual] || deptoActual)
                        : "";
                const titleText = isMunicipal
                    ? `Distribuci\u00f3n del tama\u00f1o de la propiedad rural en el municipio de ${propMpNombre}, ${propDpNombre}`
                    : isDepartmental
                        ? `Distribuci\u00f3n del tama\u00f1o de la propiedad rural en ${propDpNombre}`
                        : "Distribuci\u00f3n del tama\u00f1o de la propiedad rural en Colombia";

                try {
                    const url = ctx.config.url;
                    const where = propiedadRuralTerritoryWhere({ mpCode, dpCode, isMunicipal, isDepartmental });

                    ctx.setTitle(titleText);
                    updateMapViewBadge(ctx.config.title || "Tama\u00f1o y distribuci\u00f3n rural");
                    ensurePropiedadRuralRenderer(layerGlobal);
                    applyWhereToActiveLayers(where);
                    const extentPromise = layerGlobal?.queryExtent({ where }).then(res => {
                        if (res?.extent) view.goTo(res.extent.expand(isMunicipal ? 1.18 : 1.12));
                    }).catch(() => { });

                    // 1) Consultar estadísticas: Conteo por tprpesp
                    // tprpesp: 1=Microfundio, 2=Minifundio, 3=Pequeña, 4=Mediana, 5=Gran
                    const stats = await arcRestQuery(url, {
                        f: "json",
                        where,
                        returnGeometry: false,
                        outStatistics: JSON.stringify([{
                            statisticType: "count",
                            onStatisticField: "tprpesp",
                            outStatisticFieldName: "conteo"
                        }]),
                        groupByFieldsForStatistics: "tprpesp",
                        orderByFields: "tprpesp"
                    });
                    if (ctx.cycleId !== renderCycleId) return;

                    const features = (stats.features || []).filter(f => {
                        const attrs = f.attributes || {};
                        return attrs.tprpesp != null && Number(attrs.conteo) > 0;
                    });
                    if (!features.length) {
                        ctx.destroyChart();
                        ctx.setTitle("Sin datos para Tama\u00f1o y distribuci\u00f3n rural");
                        updateMapViewBadge("Sin datos");
                        ctx.actualizarLeyenda([], []);
                        const sumDiv = document.getElementById("summaryDiv");
                        if (sumDiv) sumDiv.innerHTML = "Sin datos disponibles para la consulta.";
                        return;
                    }

                    // 2) Obtener etiquetas y colores (desde el renderer si es posible)
                    // Si no hay renderer cargado, usamos un fallback
                    const domainLabels = {
                        1: "Microfundio",
                        2: "Minifundio",
                        3: "Pequeña propiedad",
                        4: "Mediana propiedad",
                        5: "Gran propiedad"
                    };

                    const labels = [];
                    const values = [];
                    const colors = [];
                    const codes = [];

                    // Intentar sacar colores del renderer de layerGlobal
                    const renderer = layerGlobal?.renderer;
                    const classBreaks = renderer?.classBreakInfos || renderer?.uniqueValueInfos || [];

                    features.sort((a, b) => Number(a.attributes?.tprpesp) - Number(b.attributes?.tprpesp));

                    features.forEach(f => {
                        const code = f.attributes.tprpesp;
                        const count = f.attributes.conteo;
                        const legendItem = getPropiedadRuralLegendItem(code);
                        const label = legendItem?.label || domainLabels[code] || `Categoría ${code}`;

                        // Buscar color en el renderer
                        let color = legendItem?.color || "#0079C1"; // fallback
                        const match = classBreaks.find(c => String(c.value) === String(code) || c.label === label);
                        if (match && match.symbol) {
                            color = getSymbolColorRGBA(match.symbol) || color;
                        }

                        labels.push(label);
                        values.push(count);
                        colors.push(color);
                        codes.push(code);
                    });

                    // 3) Renderizar gráfico de barras verticales sin esperar al zoom del mapa.
                    ctx.crearGrafica(labels, values, colors, "bar", true);

                    // Ajustar tooltip
                    if (chartInstance) {
                        chartInstance.options.plugins.tooltip.callbacks.label = function (context) {
                            return `${context.dataset.label}: ${context.parsed.y.toLocaleString()} predios`;
                        };
                        chartInstance.options.scales.y.title.text = "Cantidad de predios (Conteo)";
                        chartInstance.update();
                    }

                    // 6) Leyenda
                    setLegendState({
                        field: "tprpesp",
                        allCodes: codes.map(String),
                        activeCodes: new Set(codes.map(code => String(code))),
                        layer: layerGlobal,
                        baseWhere: where,
                        itemWheres: Object.fromEntries(codes.map(code => [String(code), propiedadRuralWhereFor(code)]))
                    });
                    ctx.actualizarLeyenda(
                        labels,
                        colors,
                        codes,
                        null,
                        null,
                        codes.map(code => propiedadRuralWhereFor(code))
                    );

                    // 7) Texto descriptivo (icmanalisis de Capa 25)
                    if (isMunicipal && ctx.config.summaryTableUrl && ctx.config.summaryField) {
                        try {
                            const sUrl = `${ctx.config.summaryTableUrl}/query?where=${encodeURIComponent(where)}&outFields=${ctx.config.summaryField}&f=json`;
                            const sJson = await fetchJsonCached(sUrl, { cacheKey: buildQueryCacheKey("json", sUrl) });
                            const text = sJson.features?.[0]?.attributes?.[ctx.config.summaryField] || "";
                            const sumDiv = document.getElementById("summaryDiv");
                            if (sumDiv) {
                                sumDiv.innerHTML = `<b>Análisis de la propiedad rural:</b><br><br>${escapeHtmlWithBreaks(text || "Sin descripción disponible.")}`;
                            }
                        } catch (_) { }
                    }

                } catch (e) {
                    console.error("propiedadRuralHandler error:", e);
                    ctx.actualizarLeyenda([], []);
                    ctx.destroyChart();
                }
            }
        };
    }

    const COMPOSICION_MAP_FIELDS = ["nm", "nf", "jm", "jf", "am", "af", "amm", "amf"];
    const COMPOSICION_GEOMETRY_LAYER_URL = "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componenteocupacion/MapServer/11";
    const COMPOSICION_DATA_LAYER_URL = "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componenteocupacion/MapServer/15";
    const COMPOSICION_PROPORTIONS_LAYER_URL = "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componenteocupacion/MapServer/26";

    async function arcRestQueryAllFeatures(layerUrl, params = {}, options = {}) {
        const pageSize = Number(params.resultRecordCount) || 2000;
        const allFeatures = [];
        let offset = Number(params.resultOffset) || 0;
        let lastJson = null;

        while (true) {
            const pageParams = {
                ...params,
                resultOffset: offset,
                resultRecordCount: pageSize
            };
            const pageJson = await arcRestQuery(layerUrl, pageParams, {
                ...options,
                cacheKey: buildQueryCacheKey("arcRestPage", layerUrl, pageParams)
            });
            const pageFeatures = pageJson.features || [];
            allFeatures.push(...pageFeatures);
            lastJson = pageJson;

            const hasMore = pageJson.exceededTransferLimit === true || pageFeatures.length >= pageSize;
            if (!hasMore || pageFeatures.length === 0) break;
            offset += pageSize;
        }

        return {
            ...(lastJson || {}),
            features: allFeatures
        };
    }

    function aggregateComposicionProportions(features = []) {
        let pnm = 0;
        let pnf = 0;
        let pjm = 0;
        let pjf = 0;
        let pam = 0;
        let paf = 0;
        let pamm = 0;
        let pamf = 0;

        features.forEach((feature) => {
            const attrs = feature?.attributes || feature || {};
            const age = attrs.edad;
            const h = Number(attrs.h2018) || 0;
            const m = Number(attrs.m2018) || 0;

            if (["0-4", "5-9", "10-14"].includes(age)) {
                pnm += h;
                pnf += m;
            } else if (["15-19", "20-24"].includes(age)) {
                pjm += h;
                pjf += m;
            } else if (["25-29", "30-34", "35-39", "40-44", "45-49", "50-54", "55-59"].includes(age)) {
                pam += h;
                paf += m;
            } else {
                pamm += h;
                pamf += m;
            }
        });

        return { pnm, pnf, pjm, pjf, pam, paf, pamm, pamf };
    }

    function buildRuralComposicionAttributes(totalRuralPop, proportions = {}) {
        const { pnm, pnf, pjm, pjf, pam, paf, pamm, pamf } = proportions;
        return {
            tzn: 3,
            nm: Math.round((pnm / 100) * totalRuralPop),
            nf: Math.round((pnf / 100) * totalRuralPop),
            jm: Math.round((pjm / 100) * totalRuralPop),
            jf: Math.round((pjf / 100) * totalRuralPop),
            am: Math.round((pam / 100) * totalRuralPop),
            af: Math.round((paf / 100) * totalRuralPop),
            amm: Math.round((pamm / 100) * totalRuralPop),
            amf: Math.round((pamf / 100) * totalRuralPop)
        };
    }

    async function buildRuralComposicionLookup(territoryWhere = "1=1", options = {}) {
        const ruralWhere = territoryWhere && territoryWhere !== "1=1"
            ? `(${territoryWhere}) AND tzn = 3`
            : "tzn = 3";

        const [ruralPopResult, proportionsResult] = await Promise.all([
            arcRestQueryAllFeatures(COMPOSICION_GEOMETRY_LAYER_URL, {
                f: "json",
                where: ruralWhere,
                outFields: "mpcodigo,pob2018",
                returnGeometry: "false",
                resultRecordCount: 2000
            }, options),
            arcRestQueryAllFeatures(COMPOSICION_PROPORTIONS_LAYER_URL, {
                f: "json",
                where: territoryWhere || "1=1",
                outFields: "edad,h2018,m2018,mpcodigo",
                returnGeometry: "false",
                resultRecordCount: 2000
            }, options)
        ]);

        const proportionsByMuni = new Map();
        (proportionsResult.features || []).forEach((feature) => {
            const mpcodigo = feature.attributes?.mpcodigo;
            if (!mpcodigo) return;
            if (!proportionsByMuni.has(mpcodigo)) proportionsByMuni.set(mpcodigo, []);
            proportionsByMuni.get(mpcodigo).push(feature);
        });

        const lookup = new Map();
        (ruralPopResult.features || []).forEach((feature) => {
            const mpcodigo = feature.attributes?.mpcodigo;
            const totalRuralPop = Number(feature.attributes?.pob2018) || 0;
            if (!mpcodigo || totalRuralPop <= 0) return;

            const proportions = proportionsByMuni.get(mpcodigo);
            if (!proportions?.length) return;

            lookup.set(mpcodigo, buildRuralComposicionAttributes(
                totalRuralPop,
                aggregateComposicionProportions(proportions)
            ));
        });

        return lookup;
    }

    async function createComposicionMapLayer({
        territoryWhere = "1=1",
        isNational = false,
        deptoCode = "",
        field = composicionCampoActivo,
        signal = null
    } = {}) {
        const geometryWhere = territoryWhere && String(territoryWhere).trim()
            ? String(territoryWhere).trim()
            : "1=1";

        await view.when();

        const queryOptions = { signal: signal || getActiveRequestSignal() };

        const [geometryResult, urbanAttrsResult, ruralLookup] = await Promise.all([
            arcRestQueryAllFeatures(COMPOSICION_GEOMETRY_LAYER_URL, {
                f: "json",
                where: geometryWhere,
                outFields: "mpcodigo,dpcodigo,tzn",
                returnGeometry: "true",
                outSR: view.spatialReference?.wkid || view.spatialReference?.latestWkid || 102100,
                resultRecordCount: 2000
            }, queryOptions),
            arcRestQueryAllFeatures(COMPOSICION_DATA_LAYER_URL, {
                f: "json",
                where: geometryWhere,
                outFields: ["mpcodigo", "tzn", ...COMPOSICION_MAP_FIELDS].join(","),
                returnGeometry: "false",
                resultRecordCount: 2000
            }, queryOptions),
            buildRuralComposicionLookup(geometryWhere, queryOptions)
        ]);

        const urbanLookup = new Map();
        (urbanAttrsResult.features || []).forEach((feature) => {
            const attrs = feature.attributes || {};
            urbanLookup.set(`${attrs.mpcodigo}_${attrs.tzn}`, attrs);
        });

        const spatialReference = geometryResult.spatialReference
            || view.spatialReference?.toJSON?.()
            || view.spatialReference
            || { wkid: 102100 };

        const graphics = (geometryResult.features || []).flatMap((feature, index) => {
            const attrs = feature.attributes || {};
            const mpcodigo = attrs.mpcodigo;
            const tzn = Number(attrs.tzn);
            const geometryJson = feature.geometry;
            if (!geometryJson?.rings?.length && !geometryJson?.paths?.length) return [];

            const key = `${mpcodigo}_${tzn}`;
            let composicionSource = urbanLookup.get(key);

            if (!composicionSource && tzn === 3) {
                composicionSource = ruralLookup.get(mpcodigo);
            }

            const composicionAttrs = {};
            COMPOSICION_MAP_FIELDS.forEach((fieldName) => {
                composicionAttrs[fieldName] = Number(composicionSource?.[fieldName]) || 0;
            });

            return [new Graphic({
                geometry: {
                    type: "polygon",
                    rings: geometryJson.rings,
                    spatialReference: geometryJson.spatialReference || spatialReference
                },
                attributes: {
                    objectid: index + 1,
                    mpcodigo,
                    dpcodigo: attrs.dpcodigo || "",
                    tzn,
                    ...composicionAttrs
                }
            })];
        });

        if (!graphics.length) {
            throw new Error("No se encontraron geometrías para composición poblacional.");
        }

        const buildComposicionRendererFn = ocupacionGlobal("buildComposicionRenderer");
        const activeField = ocupacionGlobal("ordenComposicion")?.includes(field) ? field : "nm";
        const renderer = typeof buildComposicionRendererFn === "function"
            ? buildComposicionRendererFn(activeField, { national: isNational, deptoCode })
            : undefined;

        return new FeatureLayer({
            source: graphics,
            fields: [
                { name: "objectid", type: "oid" },
                { name: "mpcodigo", type: "string" },
                { name: "dpcodigo", type: "string" },
                { name: "tzn", type: "integer" },
                ...COMPOSICION_MAP_FIELDS.map((name) => ({ name, type: "integer" }))
            ],
            objectIdField: "objectid",
            geometryType: "polygon",
            spatialReference,
            renderer,
            opacity: 0.8,
            visible: true,
            minScale: 0,
            maxScale: 0
        });
    }

    function buildComposicionLegendWhere(item, field, isNational) {
        const maxClause = `${field} <= ${Number(item.max)}`;
        const minClause = item.min == null ? "" : ` AND ${field} > ${Number(item.min)}`;
        if (isNational) return `${maxClause}${minClause}`;
        const zoneClause = item.group === "Rural disperso" ? "tzn = 3" : "tzn IN (1, 2)";
        return `${zoneClause} AND ${maxClause}${minClause}`;
    }

    async function refreshComposicionMapAndLegend({ isNational = false, deptoCode = "", where = "1=1", field = composicionCampoActivo, layer = layerGlobal } = {}) {
        const buildComposicionRendererFn = ocupacionGlobal("buildComposicionRenderer");
        const getComposicionLegendItemsFn = ocupacionGlobal("getComposicionLegendItems");
        const ordenComposicionList = ocupacionGlobal("ordenComposicion");
        if (!layer || typeof buildComposicionRendererFn !== "function") return;
        const activeField = (Array.isArray(ordenComposicionList) && ordenComposicionList.includes(field)) ? field : "nm";
        composicionCampoActivo = activeField;
        layer.renderer = buildComposicionRendererFn(activeField, { national: isNational, deptoCode });
        try { layer.refresh?.(); } catch (_) { }

        if (typeof getComposicionLegendItemsFn !== "function") return;
        const candidateItems = getComposicionLegendItemsFn(activeField, { national: isNational, deptoCode });
        const candidateWheres = candidateItems.map(item => buildComposicionLegendWhere(item, activeField, isNational));
        const { items: legendItems, wheres: legendWheres } = await filterLegendItemsWithLayerData({
            layer,
            baseWhere: where,
            items: candidateItems,
            wheres: candidateWheres
        });
        const legendCodes = legendItems.map(item => item.code);

        setLegendState({
            field: activeField,
            allCodes: legendCodes,
            activeCodes: new Set(legendCodes.map(String)),
            selectedCode: null,
            layer,
            baseWhere: where,
            itemWheres: Object.fromEntries(legendCodes.map((code, index) => [String(code), legendWheres[index]]))
        });

        actualizarLeyenda(
            legendItems.map(item => item.label),
            legendItems.map(item => item.color),
            legendCodes,
            null,
            legendItems.map(item => item.group),
            legendWheres
        );
    }

    function ensureComposicionUi({ isNational = false, deptoCode = "", where = "1=1", layer = layerGlobal } = {}) {
        setupComposicionSlider({ isNational, deptoCode, where });
        refreshComposicionMapAndLegend({ isNational, deptoCode, where, field: composicionCampoActivo, layer });
    }

    function buildAutoreconocimientoLegendWhere(item, field = "pobtet") {
        const maxClause = `${field} <= ${Number(item.max)}`;
        const minClause = item.min == null ? "" : ` AND ${field} > ${Number(item.min)}`;
        return `${maxClause}${minClause}`;
    }

    function buildCondicionesSeguridadLegendWhere(item) {
        return `clasisus = ${Number(item.value)}`;
    }

    async function refreshAutoreconocimientoMapAndLegend({ where = "1=1", layer = layerGlobal } = {}) {
        const buildRendererFn = ocupacionGlobal("buildAutoreconocimientoRenderer");
        const getLegendItemsFn = ocupacionGlobal("getAutoreconocimientoLegendItems");
        if (!layer || typeof buildRendererFn !== "function") return;

        layer.renderer = buildRendererFn();
        try { layer.refresh?.(); } catch (_) { }

        if (typeof getLegendItemsFn !== "function") return;
        const candidateItems = getLegendItemsFn();
        const candidateWheres = candidateItems.map(item => buildAutoreconocimientoLegendWhere(item, "pobtet"));
        const { items: legendItems, wheres: legendWheres } = await filterLegendItemsWithLayerData({
            layer,
            baseWhere: where,
            items: candidateItems,
            wheres: candidateWheres
        });
        const legendCodes = legendItems.map(item => item.code);

        setLegendState({
            field: "pobtet",
            allCodes: legendCodes,
            activeCodes: new Set(legendCodes.map(String)),
            selectedCode: null,
            layer,
            baseWhere: where,
            itemWheres: Object.fromEntries(legendCodes.map((code, index) => [String(code), legendWheres[index]]))
        });

        actualizarLeyenda(
            legendItems.map(item => item.label),
            legendItems.map(item => item.color),
            legendCodes,
            null,
            null,
            legendWheres
        );
        appendLineaNegraLegendItems();
    }

    async function refreshCondicionesSeguridadMapAndLegend({ where = "1=1", layer = layerGlobal } = {}) {
        const buildRendererFn = ocupacionGlobal("buildCondicionesSeguridadRenderer");
        const getLegendItemsFn = ocupacionGlobal("getCondicionesSeguridadLegendItems");
        if (!layer || typeof buildRendererFn !== "function") return;

        layer.renderer = buildRendererFn();
        try { layer.refresh?.(); } catch (_) { }

        if (typeof getLegendItemsFn !== "function") return;
        const candidateItems = getLegendItemsFn();
        const candidateWheres = candidateItems.map(item => buildCondicionesSeguridadLegendWhere(item));
        const { items: legendItems, wheres: legendWheres } = await filterLegendItemsWithLayerData({
            layer,
            baseWhere: where,
            items: candidateItems,
            wheres: candidateWheres
        });
        const legendCodes = legendItems.map(item => item.code);

        setLegendState({
            field: "clasisus",
            allCodes: legendCodes,
            activeCodes: new Set(legendCodes.map(String)),
            selectedCode: null,
            layer,
            baseWhere: where,
            itemWheres: Object.fromEntries(legendCodes.map((code, index) => [String(code), legendWheres[index]]))
        });

        actualizarLeyenda(
            legendItems.map(item => item.label),
            legendItems.map(item => item.color),
            legendCodes,
            null,
            null,
            legendWheres
        );
    }

    function ensureAutoreconocimientoUi({ where = "1=1", layer = layerGlobal } = {}) {
        return refreshAutoreconocimientoMapAndLegend({ where, layer });
    }

    const LINEA_NEGRA_LAYER_CONFIGS = [
        {
            id: "espacios_sagrados",
            label: "Espacios sagrados",
            url: "https://services2.arcgis.com/RVvWzU3lgJISqdke/ArcGIS/rest/services/lineanegra/FeatureServer/2",
            symbol: {
                type: "simple-marker",
                style: "triangle",
                color: "#00734C",
                size: 9,
                outline: { color: "#ffffff", width: 0.8 }
            },
            geometryLabel: "Punto",
            legendOrder: 1,
            legendStyle: "point",
            drawOrder: 2,
            color: "#00734C"
        },
        {
            id: "area_maritima",
            label: "Área Marítima",
            url: "https://services2.arcgis.com/RVvWzU3lgJISqdke/ArcGIS/rest/services/lineanegra/FeatureServer/0",
            useServiceRenderer: true,
            geometryLabel: "Polígono",
            legendOrder: 2,
            legendStyle: "line",
            drawOrder: 0,
            color: "#0070FF"
        },
        {
            id: "area_terrestre",
            label: "Área terrestre",
            url: "https://services2.arcgis.com/RVvWzU3lgJISqdke/ArcGIS/rest/services/lineanegra/FeatureServer/1",
            useServiceRenderer: true,
            geometryLabel: "Polígono",
            legendOrder: 3,
            legendStyle: "line",
            drawOrder: 0,
            color: "#895A44"
        },
        {
            id: "territorio_ancestral",
            label: "Territorio Ancestral",
            url: "https://services2.arcgis.com/RVvWzU3lgJISqdke/ArcGIS/rest/services/lineanegra/FeatureServer/3",
            useServiceRenderer: true,
            geometryLabel: "Polígono",
            legendOrder: 4,
            legendStyle: "line",
            drawOrder: 0,
            color: "#FFBEE8"
        }
    ];
    const LINEA_NEGRA_TERRITORY_MUNI_LAYER_URL = "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componenteocupacion/MapServer/2";
    const LINEA_NEGRA_TERRITORY_DEPT_LAYER_URL = "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componenteocupacion/MapServer/1";
    const LINEA_NEGRA_DEPTO_CODES = new Set(["20", "44", "47"]);
    const LINEA_NEGRA_LABELS = {
        espacios_sagrados: "Espacios sagrados",
        area_maritima: "Área Marítima",
        area_terrestre: "Área terrestre",
        territorio_ancestral: "Territorio Ancestral"
    };

    function getLineaNegraLabel(item) {
        return LINEA_NEGRA_LABELS[item?.id] || item?.label || "";
    }

    function isLineaNegraContextActive({ cycleId = renderCycleId, configId = "" } = {}) {
        const activeConfig = getActiveLayerConfig();
        return cycleId === renderCycleId &&
            activeConfig?.isAutoreconocimientoEtnico === true &&
            (!configId || activeConfig.id === configId);
    }

    async function getLineaNegraTerritoryGeometry({ isMunicipal = false, isDepartmental = false, mpCode = "", dpCode = "" } = {}) {
        const escapeSql = value => String(value || "").replace(/'/g, "''");
        let where = "";
        let layerUrl = LINEA_NEGRA_TERRITORY_MUNI_LAYER_URL;

        if (isMunicipal && mpCode) {
            where = `mpcodigo = '${escapeSql(mpCode)}'`;
        } else if (isDepartmental && dpCode) {
            layerUrl = LINEA_NEGRA_TERRITORY_DEPT_LAYER_URL;
            where = `dpcodigo = '${escapeSql(dpCode)}'`;
        } else {
            return null;
        }

        const boundaryLayer = getOrCreateFeatureLayer({
            url: layerUrl,
            outFields: ["*"],
            visible: false
        }, `linea-negra-territory:${layerUrl}`, FeatureLayer);

        const query = boundaryLayer.createQuery();
        query.where = where;
        query.returnGeometry = true;
        query.outFields = ["*"];
        if (view?.spatialReference) query.outSpatialReference = view.spatialReference;

        const result = await boundaryLayer.queryFeatures(query);
        const features = result?.features || [];
        if (!features.length) return null;
        return features[0].geometry || null;
    }

    async function lineaNegraLayerIntersectsTerritory(layer, territoryGeometry) {
        if (!layer || !territoryGeometry) return false;
        try {
            const query = layer.createQuery();
            query.geometry = territoryGeometry;
            query.spatialRelationship = "intersects";
            query.returnGeometry = false;
            query.num = 1;
            const result = await layer.queryFeatures(query);
            return (result?.features?.length || 0) > 0;
        } catch (_) {
            return false;
        }
    }

    async function applyLineaNegraTerritoryFilter({ isMunicipal = false, isDepartmental = false, mpCode = "", dpCode = "", token = lineaNegraLoadToken } = {}) {
        lineaNegraTerritoryGeometry = await getLineaNegraTerritoryGeometry({ isMunicipal, isDepartmental, mpCode, dpCode });
        if (token !== lineaNegraLoadToken) return;
        if (!lineaNegraTerritoryGeometry || !lineNegraLayers.length || !view) return;

        await Promise.all(lineNegraLayers.map(async layer => {
            if (token !== lineaNegraLoadToken) return;
            const intersects = await lineaNegraLayerIntersectsTerritory(layer, lineaNegraTerritoryGeometry);
            if (token !== lineaNegraLoadToken) return;
            layer.__lineaNegraVisibleInTerritory = intersects;
            if (!intersects) {
                layer.visible = false;
                return;
            }

            layer.visible = true;
            try {
                const layerView = await view.whenLayerView(layer);
                layerView.filter = {
                    geometry: lineaNegraTerritoryGeometry,
                    spatialRelationship: "intersects"
                };
            } catch (_) { }
        }));
        if (token === lineaNegraLoadToken) appendLineaNegraLegendItems();
    }

    function getLineaNegraLegendSymbol(config, layer) {
        const rendererSymbol = layer?.renderer?.symbol;
        if (rendererSymbol) return rendererSymbol;
        return config?.symbol || null;
    }

    function buildLineaNegraLegendSwatch(config, layer) {
        const symbol = getLineaNegraLegendSymbol(config, layer);
        if (!symbol) {
            return {
                className: `legend-color${config.legendStyle === "line" ? " legend-line-symbol" : ""}`,
                style: config.legendStyle === "line"
                    ? `background:transparent;border-top:2px solid ${config.color};height:0;`
                    : `background:${config.color};border-radius:50%;`
            };
        }

        const symbolType = String(symbol.type || "").toLowerCase();
        if (symbolType === "picture-marker" && symbol.url) {
            return {
                className: "legend-color legend-picture-symbol",
                style: `background:transparent url("${symbol.url}") center/contain no-repeat;width:16px;height:16px;min-width:16px;border:0;border-radius:0;`
            };
        }

        if (symbolType === "simple-marker" || symbolType === "esrisms") {
            const fill = rgbaArrayToCss(symbol.color, config.color);
            const outline = symbol.outline || {};
            const outlineColor = rgbaArrayToCss(outline.color, "#ffffff");
            const outlineWidth = Number(outline.width) || 0;
            const style = String(symbol.style || "").toLowerCase();
            const isCircle = style.includes("circle");
            const isTriangle = style.includes("triangle");
            if (isTriangle) {
                return {
                    className: "legend-color legend-triangle-symbol",
                    style: [
                        "width:0",
                        "height:0",
                        "min-width:0",
                        "background:transparent",
                        "border-left:6px solid transparent",
                        "border-right:6px solid transparent",
                        `border-bottom:12px solid ${fill}`,
                        "border-radius:0",
                        "display:inline-block"
                    ].join(";")
                };
            }
            return {
                className: "legend-color",
                style: [
                    `background:${fill}`,
                    `border-radius:${isCircle ? "50%" : "0"}`,
                    `box-sizing:border-box`,
                    outlineWidth > 0 ? `border:${outlineWidth}px solid ${outlineColor}` : "border:0",
                    "width:12px",
                    "height:12px",
                    "min-width:12px",
                    "display:inline-block"
                ].join(";")
            };
        }

        const outlineColor = symbol.outline?.color
            ? rgbaArrayToCss(symbol.outline.color, config.color)
            : config.color;
        const width = Math.max(2, Number(symbol.outline?.width) || 2);
        return {
            className: "legend-color legend-line-symbol",
            style: `background:transparent;border-top:${width}px solid ${outlineColor};height:0;`
        };
    }

    function sortLineaNegraLegendItems(items) {
        return [...items].sort((a, b) => (a.legendOrder ?? 99) - (b.legendOrder ?? 99));
    }

    function appendLineaNegraLegendItems() {
        const content = document.getElementById("legendContent");
        if (!content || !lineNegraLayers.length) return;

        content.querySelector(".legend-linea-negra-group")?.remove();
        const layersById = new Map(lineNegraLayers.map(layer => [String(layer.__lineaNegraId || ""), layer]));
        const legendItemsOrdered = sortLineaNegraLegendItems(
            LINEA_NEGRA_LAYER_CONFIGS.filter(item => {
                const layer = layersById.get(item.id);
                return layer && layer.__lineaNegraVisibleInTerritory !== false;
            })
        );
        if (!legendItemsOrdered.length) return;

        const orderedWrapper = document.createElement("div");
        orderedWrapper.className = "legend-linea-negra-group";
        orderedWrapper.innerHTML = `
            <div class="legend-linea-negra-title">Cobertura Línea Negra</div>
            ${legendItemsOrdered.map(item => {
                const swatch = buildLineaNegraLegendSwatch(item, layersById.get(item.id));
                return `
                <div class="legend-item legend-linea-negra-item" data-linea-negra-id="${item.id}" title="Activar/desactivar ${getLineaNegraLabel(item)}">
                    <span class="${swatch.className} oot-linea-negra-swatch" data-swatch-style="${swatch.style}"></span>
                    <span class="legend-label">${getLineaNegraLabel(item)}</span>
                </div>
            `;
            }).join("")}
        `;
        orderedWrapper.querySelectorAll(".oot-linea-negra-swatch").forEach(el => {
            (el.dataset.swatchStyle || "").split(";").forEach(decl => {
                const idx = decl.indexOf(":");
                if (idx === -1) return;
                const prop = decl.slice(0, idx).trim();
                const value = decl.slice(idx + 1).trim();
                if (prop && value) el.style.setProperty(prop, value);
            });
        });
        orderedWrapper.addEventListener("click", event => {
            const row = event.target.closest(".legend-linea-negra-item");
            if (!row) return;
            event.stopPropagation();
            const layer = layersById.get(String(row.dataset.lineaNegraId || ""));
            if (!layer) return;
            layer.visible = !layer.visible;
            row.classList.toggle("off", !layer.visible);
        });
        content.appendChild(orderedWrapper);
    }

    async function loadLineaNegraLayersForAutoreconocimiento({
        isMunicipal = false,
        isDepartmental = false,
        dpCode = "",
        mpCode = "",
        cycleId = renderCycleId,
        configId = ""
    } = {}) {
        clearLineaNegraLayers({ destroy: false });
        const token = ++lineaNegraLoadToken;
        const appliesToTerritory = (isMunicipal || isDepartmental) && LINEA_NEGRA_DEPTO_CODES.has(String(dpCode || "").padStart(2, "0"));
        if (!appliesToTerritory || !map || !isLineaNegraContextActive({ cycleId, configId })) return [];

        const orderedConfigs = LINEA_NEGRA_LAYER_CONFIGS
            .map((config, originalIndex) => ({ ...config, originalIndex }))
            .sort((a, b) => (a.drawOrder ?? 1) - (b.drawOrder ?? 1) || a.originalIndex - b.originalIndex);

        lineNegraLayers = orderedConfigs.map(config => {
            let layer = lineaNegraLayerCache.get(config.id);
            if (!layer) {
                const layerOptions = {
                    url: config.url,
                    title: getLineaNegraLabel(config),
                    outFields: ["*"],
                    visible: true,
                    opacity: 1,
                    listMode: "hide"
                };
                if (!config.useServiceRenderer && config.symbol) {
                    layerOptions.renderer = {
                        type: "simple",
                        symbol: config.symbol
                    };
                }
                layer = new FeatureLayer(layerOptions);
                layer.__lineaNegraId = config.id;
                lineaNegraLayerCache.set(config.id, layer);
            }
            layer.__lineaNegraVisibleInTerritory = true;
            layer.visible = true;
            return layer;
        });

        if (token !== lineaNegraLoadToken || !isLineaNegraContextActive({ cycleId, configId })) {
            clearLineaNegraLayers({ destroy: false });
            return [];
        }

        lineNegraLayers.forEach(layer => {
            if (!map.findLayerById?.(layer.id)) map.add(layer);
        });
        appendLineaNegraLegendItems();

        Promise.resolve()
            .then(() => Promise.all(lineNegraLayers.map(layer => layer.load().catch(() => null))))
            .then(() => {
                if (token !== lineaNegraLoadToken || !isLineaNegraContextActive({ cycleId, configId })) return null;
                return applyLineaNegraTerritoryFilter({ isMunicipal, isDepartmental, mpCode, dpCode, token });
            })
            .then(() => {
                if (token !== lineaNegraLoadToken || !isLineaNegraContextActive({ cycleId, configId })) return;
                lineNegraLayers.forEach(layer => {
                    try { layer.refresh?.(); } catch (_) { }
                });
            })
            .catch(error => console.warn("Línea Negra no pudo cargarse en segundo plano:", error));
        return lineNegraLayers;
    }

    function ensureCondicionesSeguridadUi({ where = "1=1", layer = layerGlobal } = {}) {
        return refreshCondicionesSeguridadMapAndLegend({ where, layer });
    }

    function getComposicionMapContext() {
        const config = getActiveLayerConfig();
        const isNational = !municipioActual && !(filtroNivel === "DEPTO" && deptoActual);
        const deptoCode = deptoActual || "";
        const mapWhere = municipioActual && deptoActual && config
            ? buildDepartmentMapWhereForConfig(config, deptoActual)
            : (whereBase || "1=1");
        return { config, isNational, deptoCode, mapWhere };
    }

    function getComposicionZoneGroupFromChartLabel(zoneLabel) {
        const groupMap = {
            "Rural": "Rural disperso",
            "Cabecera": "Cabecera y centros poblados",
            "Centro poblado": "Cabecera y centros poblados",
            "Nacional": "Nacional"
        };
        return groupMap[zoneLabel] || null;
    }

    function syncComposicionLegendToZoneGroup(zoneLabel) {
        const targetGroup = getComposicionZoneGroupFromChartLabel(zoneLabel);
        if (!targetGroup || !legendState?.allCodes?.length) return;

        const getComposicionLegendItemsFn = ocupacionGlobal("getComposicionLegendItems");
        if (typeof getComposicionLegendItemsFn !== "function") return;

        const { isNational, deptoCode } = getComposicionMapContext();
        const allItems = getComposicionLegendItemsFn(composicionCampoActivo, { isNational, deptoCode });
        const codeToGroup = new Map(allItems.map(item => [String(item.code), item.group]));

        const activeCodes = (legendState.allCodes || [])
            .map(code => String(code))
            .filter(code => codeToGroup.get(code) === targetGroup);

        if (!activeCodes.length) return;

        legendState.activeCodes = new Set(activeCodes);
        legendState.selectedCode = null;
        setLegendState(legendState);

        if (typeof resetLegendVisualState === "function") {
            resetLegendVisualState();
        }
    }

    async function syncComposicionSliderToField(fieldKey, { isNational = false, deptoCode = "", where = "1=1" } = {}) {
        const ordenComposicionList = ocupacionGlobal("ordenComposicion");
        const coloresComposicionMap = ocupacionGlobal("coloresComposicion");
        const slider = document.getElementById("periodoSlider");
        const label = document.getElementById("periodoSliderLabel");

        if (!Array.isArray(ordenComposicionList)) return;

        composicionCampoActivo = ordenComposicionList.includes(fieldKey) ? fieldKey : "nm";

        if (slider) {
            slider.value = Math.max(0, ordenComposicionList.indexOf(composicionCampoActivo));
        }
        if (label) {
            const text = coloresComposicionMap?.[composicionCampoActivo]?.label || composicionCampoActivo;
            label.textContent = `Categoria: ${text}`;
        }

        await refreshComposicionMapAndLegend({
            isNational,
            deptoCode,
            where,
            field: composicionCampoActivo,
            layer: layerGlobal
        });
    }

    function setupComposicionSlider({ isNational = false, deptoCode = "", where = "1=1" } = {}) {
        const sliderContainer = document.getElementById("periodoSliderContainer");
        const slider = document.getElementById("periodoSlider");
        const label = document.getElementById("periodoSliderLabel");
        const ordenComposicionList = ocupacionGlobal("ordenComposicion");
        const coloresComposicionMap = ocupacionGlobal("coloresComposicion");
        if (!sliderContainer || !slider || !label || !Array.isArray(ordenComposicionList)) return;

        sliderContainer.style.display = "flex";
        slider.min = 0;
        slider.max = Math.max(ordenComposicionList.length - 1, 0);
        slider.step = 1;
        const currentIndex = Math.max(0, ordenComposicionList.indexOf(composicionCampoActivo));
        slider.value = currentIndex;

        const updateLabel = () => {
            const field = ordenComposicionList[Number(slider.value)] || "nm";
            const text = coloresComposicionMap?.[field]?.label || field;
            label.textContent = `Categoria: ${text}`;
        };

        slider.oninput = () => {
            composicionCampoActivo = ordenComposicionList[Number(slider.value)] || "nm";
            updateLabel();
            refreshComposicionMapAndLegend({ isNational, deptoCode, where, field: composicionCampoActivo, layer: layerGlobal });
        };

        updateLabel();
    }

    async function applyComposicionChartSelection(fieldKey, zoneLabel) {
        const { isNational, deptoCode, mapWhere } = getComposicionMapContext();
        await syncComposicionSliderToField(fieldKey, { isNational, deptoCode, where: mapWhere });

        const tznCode = { "Cabecera": 1, "Centro poblado": 2, "Rural": 3 }[zoneLabel];
        const where = tznCode != null ? `${mapWhere} AND tzn = ${tznCode}` : mapWhere;

        applyWhereToActiveLayers(where);
        layerGlobal?.queryExtent({ where }).then(res => {
            if (res?.extent) view.goTo(res.extent.expand(1.5));
        });

        syncComposicionLegendToZoneGroup(zoneLabel);
    }

    function buildTasaCrecimientoLegendWhere(item, field) {
        if (field === "drci") return `${field} = ${Number(item.value)}`;
        const maxClause = `${field} <= ${Number(item.max)}`;
        const minClause = item.min == null ? "" : ` AND ${field} > ${Number(item.min)}`;
        return `${field} IS NOT NULL AND ${maxClause}${minClause}`;
    }

    async function refreshTasaCrecimientoMapAndLegend({ where = "1=1", field = tasaCrecimientoCampoActivo, layer = layerGlobal } = {}) {
        const buildTasaCrecimientoRendererFn = ocupacionGlobal("buildTasaCrecimientoRenderer");
        const getTasaCrecimientoFieldInfoFn = ocupacionGlobal("getTasaCrecimientoFieldInfo");
        const getTasaCrecimientoLegendItemsFn = ocupacionGlobal("getTasaCrecimientoLegendItems");
        if (!layer || typeof buildTasaCrecimientoRendererFn !== "function") return;
        const activeField = (typeof getTasaCrecimientoFieldInfoFn === "function")
            ? getTasaCrecimientoFieldInfoFn(field).field
            : field;
        const baseWhere = where || "1=1";
        tasaCrecimientoCampoActivo = activeField;
        layer.definitionExpression = baseWhere;
        layer.renderer = buildTasaCrecimientoRendererFn(activeField);
        try { layer.refresh?.(); } catch (_) { }

        if (typeof getTasaCrecimientoLegendItemsFn !== "function") return;
        const candidateItems = getTasaCrecimientoLegendItemsFn(activeField);
        const candidateWheres = candidateItems.map(item => buildTasaCrecimientoLegendWhere(item, activeField));
        const { items: legendItems, wheres: legendWheres } = await filterLegendItemsWithLayerData({
            layer,
            baseWhere,
            items: candidateItems,
            wheres: candidateWheres
        });
        const legendCodes = legendItems.map(item => item.code);

        if (!legendItems.length) {
            setLegendState({
                field: activeField,
                allCodes: [],
                activeCodes: new Set(),
                selectedCode: null,
                layer,
                baseWhere,
                itemWheres: {}
            });
            actualizarLeyenda([], []);
            return;
        }

        setLegendState({
            field: activeField,
            allCodes: legendCodes,
            activeCodes: new Set(legendCodes.map(String)),
            selectedCode: null,
            layer,
            baseWhere,
            itemWheres: Object.fromEntries(legendCodes.map((code, index) => [String(code), legendWheres[index]]))
        });

        actualizarLeyenda(
            legendItems.map(item => item.label),
            legendItems.map(item => item.color),
            legendCodes,
            null,
            null,
            legendWheres
        );
    }

    function ensureMapCategorySliderUi({ where = "1=1", layer = layerGlobal } = {}) {
        setupTasaCrecimientoSlider({ where });
        refreshTasaCrecimientoMapAndLegend({ where, field: tasaCrecimientoCampoActivo, layer });
    }

    function ensureTasaCrecimientoUi({ where = "1=1", layer = layerGlobal } = {}) {
        toggleTasaCrecimientoCharts(true);
        ensureMapCategorySliderUi({ where, layer });
    }

    function setupTasaCrecimientoSlider({ where = "1=1" } = {}) {
        const sliderContainer = document.getElementById("periodoSliderContainer");
        const slider = document.getElementById("periodoSlider");
        const label = document.getElementById("periodoSliderLabel");
        const tasaCrecimientoCamposList = ocupacionGlobal("tasaCrecimientoCampos");
        if (!sliderContainer || !slider || !label || !Array.isArray(tasaCrecimientoCamposList) || !tasaCrecimientoCamposList.length) return;

        sliderContainer.style.display = "flex";
        slider.min = 0;
        slider.max = Math.max(tasaCrecimientoCamposList.length - 1, 0);
        slider.step = 1;
        const currentIndex = Math.max(0, tasaCrecimientoCamposList.findIndex(item => item.field === tasaCrecimientoCampoActivo));
        slider.value = currentIndex;

        const updateLabel = () => {
            const info = tasaCrecimientoCamposList[Number(slider.value)] || tasaCrecimientoCamposList[0];
            label.textContent = `Categoria: ${info.label}`;
        };

        slider.oninput = () => {
            const info = tasaCrecimientoCamposList[Number(slider.value)] || tasaCrecimientoCamposList[0];
            tasaCrecimientoCampoActivo = info.field;
            updateLabel();
            refreshTasaCrecimientoMapAndLegend({ where, field: tasaCrecimientoCampoActivo, layer: layerGlobal });
        };

        updateLabel();
    }

    const indicesComplementariosCampos = [
        { field: "icmgini", label: "Índice de Gini" },
        { field: "icmtheil", label: "Índice de Theil" },
        { field: "icmdispsup", label: "Índice de Disparidad Superior" },
        { field: "icmdispinf", label: "Índice de Disparidad Inferior" },
        { field: "icminformal", mapField: "icminformalporc", label: "Índice de informalidad de la tenencia" }
    ];

    const indicesComplementariosBreaks = {
        icmgini: [
            { max: 0.45, label: "Desigualdad baja", color: "#FFF3B0" },
            { max: 0.60, label: "Desigualdad media", color: "#F3BAB2" },
            { max: 0.75, label: "Desigualdad alta", color: "#F3BAB2" },
            { max: 1, label: "Desigualdad muy alta", color: "#CDB4DB" }
        ],
        icmtheil: [
            { max: 0.06, label: "Muy alta igualdad", color: "#EFEDF5" },
            { max: 0.10, label: "Alta igualdad", color: "#DADAEB" },
            { max: 0.18, label: "Igualdad moderada", color: "#9E9AC8" },
            { max: 0.30, label: "Desigualdad moderada", color: "#756BB1" },
            { max: 1, label: "Alta desigualdad", color: "#54278F" }
        ],
        icmdispsup: [
            { max: 2.7, label: "Disparidad superior baja", color: "#EFEDF5" },
            { max: 5.2, label: "Disparidad superior media", color: "#DADAEB" },
            { max: 7.0, label: "Disparidad superior alta", color: "#9E9AC8" },
            { max: 8.5, label: "Muy alta disparidad superior", color: "#756BB1" },
            { max: null, label: "Disparidad superior extrema", color: "#54278F", openEnded: true }
        ],
        icmdispinf: [
            { max: 0.01, label: "Disparidad inferior muy alta", color: "#EFEDF5" },
            { max: 0.02, label: "Disparidad inferior alta", color: "#DADAEB" },
            { max: 0.055, label: "Disparidad inferior moderada", color: "#9E9AC8" },
            { max: 0.231, label: "Disparidad inferior media", color: "#756BB1" },
            { max: 1, label: "Disparidad inferior baja", color: "#54278F" }
        ],
        icminformal: [
            { max: 1, label: "Nivel muy bajo de informalidad", color: "#EFEDF5" },
            { max: 2, label: "Nivel bajo de informalidad", color: "#DADAEB" },
            { max: 3, label: "Nivel medio de informalidad", color: "#9E9AC8" },
            { max: 4, label: "Nivel alto de informalidad", color: "#756BB1" },
            { max: null, label: "Nivel muy alto de informalidad", color: "#54278F", openEnded: true }
        ]
    };

    function getIndiceComplementarioInfo(field = indiceComplementarioCampoActivo) {
        return indicesComplementariosCampos.find(item => item.field === field) || indicesComplementariosCampos[0];
    }

    function getIndiceComplementarioMapField(field = indiceComplementarioCampoActivo) {
        const info = getIndiceComplementarioInfo(field);
        return info.mapField || info.field;
    }

    function getIndiceComplementarioLegendItems(field = indiceComplementarioCampoActivo) {
        const info = getIndiceComplementarioInfo(field);
        const activeField = info.field;
        const mapField = getIndiceComplementarioMapField(field);
        const breaks = indicesComplementariosBreaks[activeField] || [];
        return breaks.map((item, index) => ({
            ...item,
            code: `${activeField}_${index + 1}`,
            min: index === 0 ? null : breaks[index - 1].max,
            field: activeField,
            mapField,
            isLast: index === breaks.length - 1
        }));
    }

    function buildIndiceComplementarioRenderer(field = indiceComplementarioCampoActivo) {
        const info = getIndiceComplementarioInfo(field);
        const mapField = getIndiceComplementarioMapField(info.field);
        const legendItems = getIndiceComplementarioLegendItems(info.field);
        return {
            type: "class-breaks",
            field: mapField,
            classBreakInfos: legendItems.map((item, index) => ({
                minValue: index === 0 ? -999999999 : Number(item.min),
                maxValue: item.openEnded || item.isLast ? 999999999 : Number(item.max),
                label: item.label,
                symbol: {
                    type: "simple-fill",
                    color: item.color,
                    outline: { color: "#ffffff", width: 0.35 }
                }
            })),
            defaultSymbol: {
                type: "simple-fill",
                color: [220, 220, 220, 0.25],
                outline: { color: "#ffffff", width: 0.25 }
            },
            defaultLabel: "Sin dato"
        };
    }

    async function highlightMunicipioOnMap(mpcodigo, { request = null } = {}) {
        if (!view || !mpcodigo) return;

        try {
            const muniLayerUrl = "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componenteocupacion/MapServer/2";
            const muniLayer = getOrCreateFeatureLayer({
                url: muniLayerUrl,
                outFields: ["*"],
                visible: false
            }, `territory-highlight:${muniLayerUrl}`, FeatureLayer);
            const query = muniLayer.createQuery();
            query.where = `mpcodigo = '${String(mpcodigo).replace(/'/g, "''")}'`;
            query.returnGeometry = true;
            query.outFields = ["*"];
            if (view.spatialReference) query.outSpatialReference = view.spatialReference;

            const res = await muniLayer.queryFeatures(query);
            if (request && !isCurrentRequest(request)) return;

            try { view.graphics.removeAll(); } catch (e) { }
            (res?.features || []).forEach(feature => {
                feature.symbol = {
                    type: "simple-fill",
                    color: [0, 0, 0, 0],
                    outline: { color: [0, 174, 239, 1], width: 1.5 }
                };
                view.graphics.add(feature);
            });
        } catch (error) {
            if (String(error?.message || "").toLowerCase().includes("aborted")) return;
            console.warn("No fue posible resaltar el municipio seleccionado.", error);
        }
    }

    highlightMunicipioOnMapImpl = highlightMunicipioOnMap;

    function getDensidadLegendApi() {
        return {
            getItems: globalThis.getDensidadLegendItems,
            buildWhere: globalThis.buildDensidadLegendItemWhere,
            buildRenderer: globalThis.buildDensidadPoblacionalRenderer
        };
    }

    async function renderDensidadMapLegend({ deptoCode = null, where = "1=1", features = null, layer = layerGlobal } = {}) {
        const { getItems, buildWhere } = getDensidadLegendApi();
        if (typeof getItems !== "function") return false;

        const candidateItems = getItems(deptoCode || null);
        if (!candidateItems.length) return false;

        const baseWhere = where || "1=1";
        let legendItems = [];
        let legendWheres = [];

        if (layer) {
            const candidateWheres = typeof buildWhere === "function"
                ? candidateItems.map(item => buildWhere(item))
                : [];
            const filtered = await filterLegendItemsWithLayerData({
                layer,
                baseWhere,
                items: candidateItems,
                wheres: candidateWheres
            });
            legendItems = filtered.items;
            legendWheres = filtered.wheres;
        }

        if (!legendItems.length) {
            let sourceFeatures = Array.isArray(features) && features.length ? features : null;
            if (!sourceFeatures?.length && layer?.url) {
                try {
                    const queryUrl = `${layer.url}/query?where=${encodeURIComponent(baseWhere)}&outFields=tzn,denpobha&returnGeometry=false&f=json`;
                    const json = await fetchJsonCached(queryUrl, {
                        cacheKey: buildQueryCacheKey("densidad-legend", queryUrl)
                    });
                    sourceFeatures = json.features || [];
                } catch (_) { }
            }

            if (sourceFeatures?.length) {
                legendItems = candidateItems.filter(item => densidadLegendItemHasFeature(item, sourceFeatures));
                legendWheres = typeof buildWhere === "function"
                    ? legendItems.map(item => buildWhere(item))
                    : [];
            }
        }

        if (!legendItems.length) {
            setLegendState({
                field: "tzn",
                allCodes: [],
                activeCodes: new Set(),
                selectedCode: null,
                layer,
                baseWhere,
                itemWheres: {}
            });
            actualizarLeyenda([], []);
            return false;
        }

        const legendCodes = legendItems.map(item => item.code);

        setLegendState({
            field: "tzn",
            allCodes: legendCodes,
            activeCodes: new Set(legendCodes.map(String)),
            selectedCode: null,
            layer,
            baseWhere,
            itemWheres: legendWheres.length
                ? Object.fromEntries(legendCodes.map((code, index) => [String(code), legendWheres[index]]))
                : {}
        });

        actualizarLeyenda(
            legendItems.map(item => item.label),
            legendItems.map(item => item.color),
            legendCodes,
            null,
            legendItems.map(item => item.group),
            legendWheres.length ? legendWheres : null
        );
        return true;
    }

    async function configureDensidadVisualLegendForLayer(ctx, { where, deptoCode = "", layer = layerGlobal } = {}) {
        const { buildRenderer } = getDensidadLegendApi();
        if (!layer) return;

        if (typeof buildRenderer === "function") {
            layer.renderer = buildRenderer(deptoCode || null);
        }
        layer.orderByFields = ["tzn"];
        try { layer.refresh?.(); } catch (_) { }

        await renderDensidadMapLegend({ deptoCode, where, layer });
    }

    function buildIndiceComplementarioLegendWhere(item, field = indiceComplementarioCampoActivo) {
        const mapField = item?.mapField || getIndiceComplementarioMapField(field);
        if (item?.openEnded || item?.isLast) {
            if (item.min == null) {
                return `${mapField} IS NOT NULL`;
            }
            return `${mapField} IS NOT NULL AND ${mapField} > ${Number(item.min)}`;
        }
        const maxClause = `${mapField} <= ${Number(item.max)}`;
        const minClause = item.min == null ? "" : ` AND ${mapField} > ${Number(item.min)}`;
        return `${mapField} IS NOT NULL AND ${maxClause}${minClause}`;
    }

    async function refreshIndiceComplementarioMapAndLegend({ where = "1=1", field = indiceComplementarioCampoActivo, layer = layerGlobal } = {}) {
        if (!layer) return;
        const info = getIndiceComplementarioInfo(field);
        const baseWhere = where || "1=1";
        indiceComplementarioCampoActivo = info.field;
        layer.definitionExpression = baseWhere;
        layer.renderer = buildIndiceComplementarioRenderer(info.field);
        try { layer.refresh?.(); } catch (_) { }
        try {
            if (view && typeof view.whenLayerView === "function") {
                const layerView = await view.whenLayerView(layer);
                if (layerView) layerView.filter = null;
            }
        } catch (_) { }

        const candidateItems = getIndiceComplementarioLegendItems(info.field);
        const candidateWheres = candidateItems.map(item => buildIndiceComplementarioLegendWhere(item, info.field));
        const { items: legendItems, wheres: legendWheres } = await filterLegendItemsWithLayerData({
            layer,
            baseWhere,
            items: candidateItems,
            wheres: candidateWheres
        });
        const legendCodes = legendItems.map(item => item.code);

        if (!legendItems.length) {
            setLegendState({
                field: getIndiceComplementarioMapField(info.field),
                allCodes: [],
                activeCodes: new Set(),
                selectedCode: null,
                layer,
                baseWhere,
                itemWheres: {}
            });
            actualizarLeyenda([], []);
            return;
        }

        setLegendState({
            field: getIndiceComplementarioMapField(info.field),
            allCodes: legendCodes,
            activeCodes: new Set(legendCodes.map(String)),
            selectedCode: null,
            layer,
            baseWhere,
            itemWheres: Object.fromEntries(legendCodes.map((code, index) => [String(code), legendWheres[index]]))
        });

        actualizarLeyenda(
            legendItems.map(item => item.label),
            legendItems.map(item => item.color),
            legendCodes,
            null,
            null,
            legendWheres
        );
    }

    function setupIndicesComplementariosSlider({ where = "1=1", layer = layerGlobal } = {}) {
        const sliderContainer = document.getElementById("periodoSliderContainer");
        const slider = document.getElementById("periodoSlider");
        const label = document.getElementById("periodoSliderLabel");
        if (!sliderContainer || !slider || !label) return;

        sliderContainer.style.display = "flex";
        slider.min = 0;
        slider.max = Math.max(indicesComplementariosCampos.length - 1, 0);
        slider.step = 1;
        const currentIndex = Math.max(0, indicesComplementariosCampos.findIndex(item => item.field === indiceComplementarioCampoActivo));
        slider.value = currentIndex;

        const updateLabel = () => {
            const info = indicesComplementariosCampos[Number(slider.value)] || indicesComplementariosCampos[0];
            label.textContent = `Índice: ${info.label}`;
        };

        slider.oninput = () => {
            const info = indicesComplementariosCampos[Number(slider.value)] || indicesComplementariosCampos[0];
            indiceComplementarioCampoActivo = info.field;
            updateLabel();
            refreshIndiceComplementarioMapAndLegend({ where, field: indiceComplementarioCampoActivo, layer });
        };

        updateLabel();
    }

    function transicionDemograficaHandler() {
        return {
            name: "transicionDemografica",
            when: (ctx) => ctx.config?.isTransicion === true,
            run: async (ctx) => {
                toggleTransicionCharts(true);
                destroyTransicionCharts();

                const mpCode = ctx.municipioActual;
                if (!mpCode) {
                    ctx.actualizarLeyenda([], []);
                    return;
                }

                try {
                    const url = ctx.config.url;
                    const where = `mpcodigo = '${mpCode}'`;

                    // ── 1) Capa visual ──────────────────────────────────────────
                    applyWhereToActiveLayers(mapWhere);
                    layerGlobal?.queryExtent({ where: mapWhere }).then(res => {
                        if (ctx.cycleId !== renderCycleId || !getActiveLayerConfig()?.isTasaCrecimiento) return;
                        if (res?.extent) {
                            view.goTo(res.extent.expand(1.12)).then(() => {
                                if (isMunicipal) highlightMunicipioOnMap(mpCode);
                            });
                        }
                    });

                    // ── 2) Consultar datos de la tabla ──────────────────────────
                    const fields = "eptrango,h1985,m1985,h1993,m1993,h2005,m2005,h2018,m2018";
                    const queryUrl = `${url}/query?where=${encodeURIComponent(where)}&outFields=${fields}&orderByFields=eptrango&f=json`;
                    const json = await fetchJsonCached(queryUrl, { cacheKey: buildQueryCacheKey("json", queryUrl) });
                    const features = (json.features || []).map(f => f.attributes);

                    if (!features.length) {
                        toggleTransicionCharts(false);
                        ctx.actualizarLeyenda([], []);
                        return;
                    }

                    // ── 3) Procesar grupos etarios (Agrupación y Porcentajes) ──
                    const labels = ["1985", "1993", "2005", "2018"];
                    const colorMap = {
                        "0014": { label: "Niños y Adolescentes", color: "#4f81bd" },
                        "1524": { label: "Jóvenes", color: "#c0504d" },
                        "2559": { label: "Adultos", color: "#9bbb59" },
                        "6000": { label: "Adultos Mayores", color: "#efc000" }
                    };

                    // 3.1) Calcular total general por año del municipio (sumando todos los registros)
                    const totalsByYear = {};
                    labels.forEach(yr => {
                        totalsByYear[yr] = features.reduce((sum, f) => {
                            return sum + (Number(f[`h${yr}`]) || 0) + (Number(f[`m${yr}`]) || 0);
                        }, 0);
                    });

                    // 3.2) Agrupar por rango etario y calcular porcentajes
                    const datasets = Object.keys(colorMap).map(rango => {
                        const groupFeatures = features.filter(f => String(f.eptrango) === rango);

                        return {
                            label: colorMap[rango].label,
                            data: labels.map(yr => {
                                const totalMuni = totalsByYear[yr];
                                if (totalMuni === 0) return 0;

                                // Sumar todos los registros de este rango para el año actual
                                const valRango = groupFeatures.reduce((sum, f) => {
                                    return sum + (Number(f[`h${yr}`]) || 0) + (Number(f[`m${yr}`]) || 0);
                                }, 0);

                                return (valRango / totalMuni) * 100;
                            }),
                            borderColor: colorMap[rango].color,
                            backgroundColor: colorMap[rango].color,
                            borderDash: [5, 5],
                            pointStyle: 'circle',
                            pointRadius: 5,
                            pointHoverRadius: 7,
                            tension: 0,
                            fill: false
                        };
                    });

                    // ── 4) Título ──────────────────────────────────────────────
                    const mpNombre = isMunicipal ? (ctx.diccionarioMunicipios?.[mpCode] || feat.mpnombre || mpCode) : "";
                    const dpNombre = isDepartmental
                        ? (ctx.diccionarioDepartamentos?.[dpCode] || feat.dpnombre || dpCode)
                        : isMunicipal
                            ? (ctx.diccionarioDepartamentos?.[deptoActual] || feat.dpnombre || deptoActual)
                            : "";
                    ctx.setTitle(`Transición demográfica de Municipio ${mpNombre}, ${dpNombre}`);

                    // ── 5) Renderizar ──────────────────────────────────────────
                    crearGraficaTransicion(labels, datasets);

                    // ── 6) Leyenda ─────────────────────────────────────────────
                    ctx.actualizarLeyenda(
                        datasets.map(d => d.label),
                        datasets.map(d => d.borderColor)
                    );

                    // ── 7) Texto descriptivo ───────────────────────────────────
                    if (isMunicipal && ctx.config.summaryTableUrl && ctx.config.summaryField) {
                        try {
                            const sUrl = `${ctx.config.summaryTableUrl}/query?where=${encodeURIComponent(where)}&outFields=${ctx.config.summaryField}&f=json`;
                            const sJson = await fetchJsonCached(sUrl, { cacheKey: buildQueryCacheKey("json", sUrl) });
                            const text = sJson.features?.[0]?.attributes?.[ctx.config.summaryField] || "";
                            const sumDiv = document.getElementById("summaryDiv");
                            if (sumDiv) {
                                sumDiv.innerHTML = `<b>Transición demográfica:</b><br><br>${escapeHtmlWithBreaks(text || "Sin descripción disponible.")}`;
                            }
                        } catch (_) { }
                    }

                } catch (e) {
                    console.error("transicionDemograficaHandler error:", e);
                    toggleTransicionCharts(false);
                    ctx.actualizarLeyenda([], []);
                }
            }
        };
    }

    function estructuraPiramidesHandler() {
        return {
            name: "estructuraPiramides",
            when: (ctx) => ctx.config?.isPiramides === true,
            run: async (ctx) => {
                destroyPiramidesCharts();

                const mpCode = ctx.municipioActual;
                const dpCode = ctx.deptoActual || deptoActual || (mpCode ? String(mpCode).slice(0, 2) : "");
                const isMunicipal = !!mpCode;
                const isDepartmental = !isMunicipal && !!dpCode;

                if (!isMunicipal && !isDepartmental) {
                    togglePiramidesCharts(false);
                    ctx.actualizarLeyenda([], []);
                    return;
                }

                try {
                    const where = isMunicipal
                        ? `mpcodigo = '${String(mpCode).replace(/'/g, "''")}'`
                        : `dpcodigo = '${String(dpCode).replace(/'/g, "''")}'`;
                    const mapWhere = isMunicipal
                        ? `dpcodigo = '${String(dpCode).replace(/'/g, "''")}'`
                        : where;

                    applyWhereToActiveLayers(mapWhere);
                    await configureDensidadVisualLegendForLayer(ctx, { where: mapWhere, deptoCode: dpCode, layer: layerGlobal });
                    layerGlobal?.queryExtent({ where: mapWhere }).then(res => {
                        if (ctx.cycleId !== renderCycleId || !getActiveLayerConfig()?.isPiramides) return;
                        if (res?.extent) {
                            view.goTo(res.extent.expand(1.12)).then(() => {
                                if (isMunicipal) highlightMunicipioOnMap(mpCode);
                            });
                        }
                    }).catch(() => { });

                    const fields = "edad,h1985,m1985,h1993,m1993,h2005,m2005,h2018,m2018";
                    const queryUrl = `${ctx.config.url}/query?where=${encodeURIComponent(where)}&outFields=${fields}&orderByFields=edad&f=json`;
                    const json = await fetchJsonCached(queryUrl, { cacheKey: buildQueryCacheKey("json", queryUrl) });
                    const features = (json.features || []).map(f => f.attributes);

                    if (!features.length) {
                        togglePiramidesCharts(false);
                        return;
                    }

                    const groupedByEdad = new Map();
                    features.forEach(feature => {
                        const key = String(feature.edad ?? "");
                        if (!key) return;
                        const row = groupedByEdad.get(key) || { edad: key };
                        [1985, 1993, 2005, 2018].forEach(yr => {
                            row[`h${yr}`] = (Number(row[`h${yr}`]) || 0) + (Number(feature[`h${yr}`]) || 0);
                            row[`m${yr}`] = (Number(row[`m${yr}`]) || 0) + (Number(feature[`m${yr}`]) || 0);
                        });
                        groupedByEdad.set(key, row);
                    });

                    const aggregatedFeatures = sortPiramideRowsByEdad(Array.from(groupedByEdad.values()));
                    const edadLabels = aggregatedFeatures.map(f => f.edad).reverse();
                    const censos = {};
                    [1985, 1993, 2005, 2018].forEach(yr => {
                        censos[yr] = {
                            hombres: aggregatedFeatures.map(f => Number(f[`h${yr}`]) || 0).reverse(),
                            mujeres: aggregatedFeatures.map(f => Number(f[`m${yr}`]) || 0).reverse()
                        };
                    });

                    const mpNombre = isMunicipal ? (ctx.diccionarioMunicipios?.[mpCode] || mpCode) : "";
                    const dpNombre = ctx.diccionarioDepartamentos?.[dpCode] || dpCode;
                    ctx.setTitle(isMunicipal
                        ? `Estructura poblacional del municipio ${mpNombre}, ${dpNombre}`
                        : `Estructura poblacional de ${dpNombre}`);

                    crearCuatroPiramides({ edadLabels, censos });

                    if (isMunicipal && ctx.config.summaryTableUrl && ctx.config.summaryField) {
                        try {
                            const sUrl = `${ctx.config.summaryTableUrl}/query?where=${encodeURIComponent(where)}&outFields=${ctx.config.summaryField}&f=json`;
                            const sJson = await fetchJsonCached(sUrl, { cacheKey: buildQueryCacheKey("json", sUrl) });
                            const text = sJson.features?.[0]?.attributes?.[ctx.config.summaryField] || "";
                            const sumDiv = document.getElementById("summaryDiv");
                            if (sumDiv) {
                                let html = `<b>Estructura poblacional:</b><br><br>${escapeHtmlWithBreaks(text || "Sin descripción disponible.")}`;
                                html += `<br><br><b>Interpretación:</b><br>`;
                                html += `<ul>
                                            <li>Las barras <span class="oot-js-ocupacion-app-14">fucsias</span> representan el porcentaje de población femenina registrada en cada rango de edad.</li>
                                            <li>Las barras <span class="oot-js-ocupacion-app-13">azules</span> representan el porcentaje de población masculina registrada en cada rango de edad.</li>
                                        </ul>`;
                                sumDiv.innerHTML = html;
                            }
                        } catch (_) { }
                    }
                } catch (e) {
                    console.error("estructuraPiramidesHandler error:", e);
                    togglePiramidesCharts(false);
                    ctx.actualizarLeyenda([], []);
                }
            }
        };
    }

    function transicionDemograficaHandler() {
        return {
            name: "transicionDemografica",
            when: (ctx) => ctx.config?.isTransicion === true,
            run: async (ctx) => {
                toggleTransicionCharts(true);
                destroyTransicionCharts();

                const mpCode = ctx.municipioActual;
                const dpCode = ctx.deptoActual || deptoActual || (mpCode ? String(mpCode).slice(0, 2) : "");
                const isMunicipal = !!mpCode;
                const isDepartmental = !isMunicipal && !!dpCode;

                if (!isMunicipal && !isDepartmental) {
                    ctx.actualizarLeyenda([], []);
                    return;
                }

                try {
                    const where = isMunicipal
                        ? `mpcodigo = '${String(mpCode).replace(/'/g, "''")}'`
                        : `dpcodigo = '${String(dpCode).replace(/'/g, "''")}'`;
                    const mapWhere = isMunicipal
                        ? `dpcodigo = '${String(dpCode).replace(/'/g, "''")}'`
                        : where;

                    applyWhereToActiveLayers(mapWhere);
                    await configureDensidadVisualLegendForLayer(ctx, { where: mapWhere, deptoCode: dpCode, layer: layerGlobal });
                    layerGlobal?.queryExtent({ where: mapWhere }).then(res => {
                        if (ctx.cycleId !== renderCycleId || !getActiveLayerConfig()?.isTransicion) return;
                        if (res?.extent) {
                            view.goTo(res.extent.expand(1.12)).then(() => {
                                if (isMunicipal) highlightMunicipioOnMap(mpCode);
                            });
                        }
                    }).catch(() => { });

                    const fields = "eptrango,h1985,m1985,h1993,m1993,h2005,m2005,h2018,m2018";
                    const queryUrl = `${ctx.config.url}/query?where=${encodeURIComponent(where)}&outFields=${fields}&orderByFields=eptrango&f=json`;
                    const json = await fetchJsonCached(queryUrl, { cacheKey: buildQueryCacheKey("json", queryUrl) });
                    const features = (json.features || []).map(f => f.attributes);

                    if (!features.length) {
                        toggleTransicionCharts(false);
                        return;
                    }

                    const labels = ["1985", "1993", "2005", "2018"];
                    const colorMap = {
                        "0014": { label: "Ninos y Adolescentes", color: "#4f81bd" },
                        "1524": { label: "Jovenes", color: "#c0504d" },
                        "2559": { label: "Adultos", color: "#9bbb59" },
                        "6000": { label: "Adultos Mayores", color: "#efc000" }
                    };

                    const totalsByYear = {};
                    labels.forEach(yr => {
                        totalsByYear[yr] = features.reduce((sum, f) =>
                            sum + (Number(f[`h${yr}`]) || 0) + (Number(f[`m${yr}`]) || 0), 0);
                    });

                    const datasets = Object.keys(colorMap).map(rango => {
                        const groupFeatures = features.filter(f => String(f.eptrango) === rango);
                        return {
                            label: colorMap[rango].label,
                            data: labels.map(yr => {
                                const total = totalsByYear[yr];
                                if (!total) return 0;
                                const value = groupFeatures.reduce((sum, f) =>
                                    sum + (Number(f[`h${yr}`]) || 0) + (Number(f[`m${yr}`]) || 0), 0);
                                return (value / total) * 100;
                            }),
                            borderColor: colorMap[rango].color,
                            backgroundColor: colorMap[rango].color,
                            borderDash: [5, 5],
                            pointStyle: "circle",
                            pointRadius: 5,
                            pointHoverRadius: 7,
                            tension: 0,
                            fill: false
                        };
                    });

                    const mpNombre = isMunicipal ? (ctx.diccionarioMunicipios?.[mpCode] || mpCode) : "";
                    const dpNombre = ctx.diccionarioDepartamentos?.[dpCode] || dpCode;
                    ctx.setTitle(isMunicipal
                        ? `Transición demográfica de Municipio ${mpNombre}, ${dpNombre}`
                        : `Transición demográfica de ${dpNombre}`);

                    crearGraficaTransicion(labels, datasets);

                    if (isMunicipal && ctx.config.summaryTableUrl && ctx.config.summaryField) {
                        try {
                            const sUrl = `${ctx.config.summaryTableUrl}/query?where=${encodeURIComponent(where)}&outFields=${ctx.config.summaryField}&f=json`;
                            const sJson = await fetchJsonCached(sUrl, { cacheKey: buildQueryCacheKey("json", sUrl) });
                            const text = sJson.features?.[0]?.attributes?.[ctx.config.summaryField] || "";
                            const sumDiv = document.getElementById("summaryDiv");
                            if (sumDiv) {
                                sumDiv.innerHTML = `<b>Transición demográfica:</b><br><br>${escapeHtmlWithBreaks(text || "Sin descripcion disponible.")}`;
                            }
                        } catch (_) { }
                    }
                } catch (e) {
                    console.error("transicionDemograficaHandler error:", e);
                    toggleTransicionCharts(false);
                    ctx.actualizarLeyenda([], []);
                }
            }
        };
    }

    function composicionPoblacionHandler() {
        return {
            name: "composicionPoblacion",
            when: (ctx) => ctx.config?.isComposicion === true,
            run: async (ctx) => {
                ctx.destroyChart();
                prepareComposicionChartPanel();

                const mpCode = ctx.municipioActual;
                const dpCode = ctx.deptoActual || deptoActual;
                const isMunicipal = !!mpCode;
                const isDepartmental = !isMunicipal && !!dpCode;
                const isNational = !isMunicipal && !isDepartmental;

                try {
                    const url = ctx.config.url;
                    const where = isMunicipal
                        ? `mpcodigo = '${String(mpCode).replace(/'/g, "''")}'`
                        : isDepartmental
                            ? `SUBSTRING(mpcodigo,1,2) = '${String(dpCode).replace(/'/g, "''")}'`
                            : "1=1";

                    // ── 1) Consultar datos de zonas urbanas (Capa 15) ────────────
                    const queryUrl = `${url}/query?where=${encodeURIComponent(where)}&outFields=tzn,nm,nf,jm,jf,am,af,amm,amf,mpnombre,dpnombre,dpcodigo&orderByFields=tzn&f=json`;
                    const json = await fetchJsonCached(queryUrl, { cacheKey: buildQueryCacheKey("json", queryUrl) });
                    let features = json.features || [];
                    if (ctx.cycleId !== renderCycleId || !getActiveLayerConfig()?.isComposicion) return;

                    // ── 2) Completar zona rural ausente en la capa 15 ─────────────
                    try {
                        const ruralLookup = await buildRuralComposicionLookup(where);
                        ruralLookup.forEach((attrs, mpcodigo) => {
                            const alreadyHasRural = features.some(
                                (feature) => String(feature.attributes?.mpcodigo) === String(mpcodigo)
                                    && Number(feature.attributes?.tzn) === 3
                            );
                            if (!alreadyHasRural) {
                                features.push({
                                    attributes: {
                                        ...attrs,
                                        mpcodigo
                                    }
                                });
                            }
                        });
                    } catch (errRural) {
                        console.warn("Error sintetizando datos rurales:", errRural);
                    }

                    if (!features.length) {
                        ctx.destroyChart();
                        ctx.actualizarLeyenda([], []);
                        return;
                    }

                    // ── 3) Preparar datos para el gráfico agrupado ────────────────
                    const labels = isNational ? ["Nacional"] : ["Centro poblado", "Cabecera", "Rural"];
                    const datasetKeys = (typeof ordenComposicion !== "undefined") ? ordenComposicion : ["amf", "amm", "af", "am", "jf", "jm", "nf", "nm"];
                    const datasetData = {};

                    // Inicializar cada dataset con 3 ceros
                    datasetKeys.forEach(k => datasetData[k] = labels.map(() => 0));

                    const tznToIndex = isNational ? { 4: 0 } : { 2: 0, 1: 1, 3: 2 };

                    features.forEach(f => {
                        const tzn = Number(f.attributes.tzn);
                        if (isNational) {
                            datasetKeys.forEach(k => {
                                datasetData[k][0] += Number(f.attributes[k]) || 0;
                            });
                            return;
                        }

                        const idx = tznToIndex[tzn];
                        if (idx !== undefined) {
                            datasetKeys.forEach(k => {
                                datasetData[k][idx] += Number(f.attributes[k]) || 0;
                            });
                        }
                    });

                    const datasets = datasetKeys.map(k => {
                        const info = (typeof coloresComposicion !== "undefined") ? coloresComposicion[k] : { label: k, color: "#999" };
                        return {
                            label: info.label,
                            data: datasetData[k],
                            backgroundColor: info.color,
                            borderColor: "rgba(255,255,255,0.5)",
                            borderWidth: 1
                        };
                    });

                    // ── 4) Título dinámico ──────────────────────────────────────
                    const firstFeat = features.find(f => f.attributes.mpnombre || f.attributes.dpnombre) || features[0];
                    //const dpNombre = firstFeat.attributes.dpnombre || ctx.diccionarioDepartamentos?.[mpCode.substring(0, 2)] || "";
                    const mpNombre = isMunicipal ? (ctx.diccionarioMunicipios?.[mpCode] || firstFeat?.attributes?.mpnombre || mpCode) : "";
                    const dpNombre = isDepartmental
                        ? (ctx.diccionarioDepartamentos?.[dpCode] || firstFeat?.attributes?.dpnombre || dpCode)
                        : isMunicipal
                            ? (ctx.diccionarioDepartamentos?.[dpCode] || firstFeat?.attributes?.dpnombre || dpCode)
                            : "";

                    ctx.setTitle(`Estructura población Edad y áreas – ${mpNombre}`);

                    // ── 5) Renderizar gráfico ───────────────────────────────────
                    ctx.setTitle(isNational
                        ? "Estructura población edad y áreas - Colombia"
                        : isDepartmental
                            ? `Estructura población edad y áreas - ${dpNombre}`
                            : `Estructura población edad y áreas - ${mpNombre}, ${dpNombre}`);
                    const axisTitles = { xTitle: "Población", yTitle: "Tipo zona" };
                    if (ctx.cycleId !== renderCycleId || !getActiveLayerConfig()?.isComposicion) return;
                    crearGraficaComposicion(labels, datasets, axisTitles, ctx);

                    // ── 6) Filtrar mapa y leyenda ─────────────────────────────
                    const mapWhere = isMunicipal
                        ? buildDepartmentMapWhereForConfig(ctx.config, dpCode)
                        : where;
                    if (layerGlobal) {
                        layerGlobal.definitionExpression = mapWhere;
                        try { layerGlobal.refresh?.(); } catch (_) { }
                    }
                    applyWhereToActiveLayers(mapWhere);
                    layerGlobal?.queryExtent({ where: mapWhere }).then(res => {
                        if (ctx.cycleId !== renderCycleId || !getActiveLayerConfig()?.isComposicion) return;
                        if (res?.extent) {
                            view.goTo(res.extent.expand(1.12)).then(() => {
                                if (isMunicipal) highlightMunicipioOnMap(mpCode);
                            });
                        }
                    });

                    if (ctx.cycleId !== renderCycleId || !getActiveLayerConfig()?.isComposicion) return;
                    setupComposicionSlider({ isNational, deptoCode: dpCode, where: mapWhere });
                    refreshComposicionMapAndLegend({ isNational, deptoCode: dpCode, where: mapWhere, field: composicionCampoActivo });

                    // ── 7) Texto descriptivo ──────────────────────────────────
                    if (isMunicipal && ctx.config.summaryTableUrl && ctx.config.summaryFields) {
                        try {
                            const sFields = ctx.config.summaryFields.join(",");
                            const sUrl = `${ctx.config.summaryTableUrl}/query?where=${encodeURIComponent(where)}&outFields=${sFields}&f=json`;
                            const sJson = await fetchJsonCached(sUrl, { cacheKey: buildQueryCacheKey("json", sUrl) });
                            const attrs = sJson.features?.[0]?.attributes || {};

                            const sumDiv = document.getElementById("summaryDiv");
                            if (sumDiv) {
                                let html = `<b>Composición de la población:</b><br><br>`;
                                if (attrs.competar) html += `<b>Composición etaria:</b> ${escapeHtmlWithBreaks(attrs.competar)}<br><br>`;
                                if (attrs.distrzona) html += `<b>Distribución espacial por zona:</b> ${escapeHtmlWithBreaks(attrs.distrzona)}<br><br>`;
                                if (attrs.bregen) html += `<b>Brechas de género:</b> ${escapeHtmlWithBreaks(attrs.bregen)}`;
                                sumDiv.innerHTML = html || "Sin descripción disponible.";
                            }
                        } catch (_) { }
                    }

                } catch (e) {
                    if (e?.name === "AbortError" || String(e?.message || "").toLowerCase().includes("aborted")) return;
                    console.error("composicionPoblacionHandler error:", e);
                    ctx.actualizarLeyenda([], []);
                    ctx.destroyChart();
                }
            }
        };
    }

    function tasaCrecimientoHandler() {
        return {
            name: "tasaCrecimiento",
            when: (ctx) => ctx.config?.isTasaCrecimiento === true,
            run: async (ctx) => {
                toggleTasaCrecimientoCharts(true);
                ctx.destroyChart();
                destroyTasaCrecimientoCharts();

                const mpCode = ctx.municipioActual;
                const dpCode = ctx.deptoActual || deptoActual;
                const isMunicipal = !!mpCode;
                const isDepartmental = !isMunicipal && !!dpCode;
                const isNational = !isMunicipal && !isDepartmental;

                const where = isMunicipal
                    ? `mpcodigo = '${String(mpCode).replace(/'/g, "''")}'`
                    : isDepartmental
                        ? `dpcodigo = '${String(dpCode).replace(/'/g, "''")}'`
                        : "1=1";
                const mapWhere = isMunicipal
                    ? buildDepartmentMapWhereForConfig(ctx.config, dpCode)
                    : where;
                const dataWhere = isMunicipal ? mapWhere : where;

                ensureTasaCrecimientoUi({ where: mapWhere, layer: layerGlobal });

                try {
                    const url = ctx.config.url;

                    // 1) Capa visual + zoom
                    applyWhereToActiveLayers(mapWhere);
                    layerGlobal?.queryExtent({ where: mapWhere }).then(res => {
                        if (ctx.cycleId !== renderCycleId || !getActiveLayerConfig()?.isTasaCrecimiento) return;
                        if (res?.extent) {
                            view.goTo(res.extent.expand(1.12)).then(() => {
                                if (isMunicipal) highlightMunicipioOnMap(mpCode);
                            });
                        }
                    });

                    // 2) Consultar datos
                    const fields = "pt2005,pt2018,drci,mpnombre,dpnombre,dpcodigo";
                    const json = await arcRestQuery(url, {
                        f: "json",
                        where: dataWhere,
                        outFields: fields,
                        returnGeometry: "false"
                    }, { cacheKey: buildQueryCacheKey("json", url, { where: dataWhere, fields }) });
                    const rows = (json.features || []).map(feature => feature.attributes || {});
                    if (ctx.cycleId !== renderCycleId || !getActiveLayerConfig()?.isTasaCrecimiento) return;

                    const dpNombre = (isDepartmental || isMunicipal)
                        ? (ctx.diccionarioDepartamentos?.[dpCode] || rows[0]?.dpnombre || dpCode)
                        : "";

                    ctx.setTitle(isNational
                        ? "Tasa de crecimiento intercensal - Colombia"
                        : `Tasa de crecimiento intercensal - ${dpNombre}`);

                    if (!rows.length) {
                        return;
                    }

                    const labels = ["PT2005", "PT2018"];
                    const values = [
                        rows.reduce((sum, item) => sum + (Number(item.pt2005) || 0), 0),
                        rows.reduce((sum, item) => sum + (Number(item.pt2018) || 0), 0)
                    ];

                    // 3) Renderizar gráfico de línea
                    if (ctx.cycleId !== renderCycleId || !getActiveLayerConfig()?.isTasaCrecimiento) return;
                    crearGraficaTasaCrecimiento(labels, values, ctx);
                    refreshTasaCrecimientoMapAndLegend({ where: mapWhere, field: tasaCrecimientoCampoActivo, layer: layerGlobal });

                    // 4) Texto descriptivo (facpob de Capa 25)
                    if (ctx.config.summaryTableUrl && ctx.config.summaryField) {
                        try {
                            const sUrl = `${ctx.config.summaryTableUrl}/query?where=${encodeURIComponent(dataWhere)}&outFields=${ctx.config.summaryField}&f=json`;
                            const sJson = await fetchJsonCached(sUrl, { cacheKey: buildQueryCacheKey("json", sUrl) });
                            const text = sJson.features?.[0]?.attributes?.[ctx.config.summaryField] || "";
                            const sumDiv = document.getElementById("summaryDiv");
                            if (sumDiv) {
                                sumDiv.innerHTML = `<b>Factores de atracción/expulsión:</b><br><br>${escapeHtmlWithBreaks(text || "Sin descripción disponible.")}`;
                            }
                        } catch (_) { }
                    }

                } catch (e) {
                    if (e?.name === "AbortError" || String(e?.message || "").toLowerCase().includes("aborted")) return;
                    console.error("tasaCrecimientoHandler error:", e);
                }
            }
        };
    }

    function migracionExternaHandler() {
        return {
            name: "migracionExterna",
            when: (ctx) => ctx.config?.isMigracionExterna === true,
            run: async (ctx) => {
                toggleMigracionExternaCharts(true);
                destroyMigracionExternaCharts();
                ctx.destroyChart();

                const mpCode = ctx.municipioActual;
                const dpCode = ctx.deptoActual || deptoActual || (mpCode ? String(mpCode).slice(0, 2) : "");
                const isMunicipal = !!mpCode;
                const isDepartmental = !isMunicipal && !!dpCode;
                const dataWhere = getCurrentTerritoryWhere();
                const mapWhere = isMunicipal
                    ? buildDepartmentMapWhereForConfig(ctx.config, dpCode)
                    : dataWhere;

                try {
                    ensureMapCategorySliderUi({ where: mapWhere, layer: layerGlobal });
                    applyWhereToActiveLayers(mapWhere);
                    layerGlobal?.queryExtent({ where: mapWhere }).then(res => {
                        if (res?.extent) {
                            view.goTo(res.extent.expand(1.12)).then(() => {
                                if (isMunicipal) highlightMunicipioOnMap(mpCode);
                            });
                        }
                    });

                    const json = await arcRestQueryAllFeatures(ctx.config.url, {
                        f: "json",
                        where: dataWhere,
                        outFields: "*",
                        returnGeometry: "false",
                        resultRecordCount: 2000
                    });
                    const rows = (json.features || []).map(feature => feature.attributes || {});

                    if (ctx.cycleId !== renderCycleId || !getActiveLayerConfig()?.isMigracionExterna) return;

                    if (!rows.length) {
                        const labels = ["Cabecera", "Centro poblado", "Rural disperso"];
                        const emptyDatasets = [
                            { label: "No había nacido", data: [0, 0, 0], backgroundColor: "#ff5b7f", borderColor: "#ff5b7f" },
                            { label: "En este municipio", data: [0, 0, 0], backgroundColor: "#36a2eb", borderColor: "#36a2eb" },
                            { label: "En otro municipio", data: [0, 0, 0], backgroundColor: "#ffcd56", borderColor: "#ffcd56" },
                            { label: "En otro país", data: [0, 0, 0], backgroundColor: "#e6e6e6", borderColor: "#e6e6e6" },
                            { label: "No informa", data: [0, 0, 0], backgroundColor: "#4bc0c0", borderColor: "#4bc0c0" }
                        ];
                        crearGraficaMigracionExterna(labels, emptyDatasets, "No hay información disponible para Migración Externa en esta consulta.");
                        const sumDiv = document.getElementById("summaryDiv");
                        if (sumDiv) sumDiv.innerHTML = "No hay información disponible para Migración Externa.";
                        return;
                    }

                    const firstRow = rows.find(row => row.mpnombre || row.dpnombre) || rows[0] || {};
                    const mpNombre = isMunicipal ? (ctx.diccionarioMunicipios?.[mpCode] || firstRow.mpnombre || mpCode) : "";
                    const dpNombre = isDepartmental
                        ? (ctx.diccionarioDepartamentos?.[dpCode] || firstRow.dpnombre || dpCode)
                        : isMunicipal
                            ? (ctx.diccionarioDepartamentos?.[dpCode] || firstRow.dpnombre || dpCode)
                            : "";

                    ctx.setTitle(isMunicipal
                        ? `Migración Externa en el municipio de ${mpNombre}, ${dpNombre}`
                        : isDepartmental
                            ? `Migración Externa en ${dpNombre}`
                            : "Migración Externa en Colombia");

                    const normalizeZone = (value) => String(value || "")
                        .normalize("NFD")
                        .replace(/[\u0300-\u036f]/g, "")
                        .toLowerCase();
                    const zoneDefinitions = [
                        { code: "cabecera", label: "Cabecera", aliases: ["cabecera"], values: ["1"] },
                        { code: "centro", label: "Centro poblado", aliases: ["centro", "poblado"], values: ["2"] },
                        { code: "rural", label: "Rural disperso", aliases: ["rural"], values: ["3"] }
                    ];
                    const fieldLookup = new Map(Object.keys(rows[0] || {}).map(field => [String(field).toLowerCase(), field]));
                    const pickField = (...candidates) => {
                        for (const candidate of candidates) {
                            const found = fieldLookup.get(String(candidate).toLowerCase());
                            if (found) return found;
                        }
                        return null;
                    };
                    const zoneField = pickField("zonatipo", "tzn", "tipozona", "tipo_zona", "zona");
                    const metrics = [
                        { field: pickField("menonacido", "mignonacido", "mignonacidos", "migNoNacidos"), label: "No había nacido", color: "#ff5b7f" },
                        { field: pickField("memimp", "migmismomun", "migMismoMun", "me_mismo_mun"), label: "En este municipio", color: "#36a2eb" },
                        { field: pickField("meotmp", "migotromun", "migOtroMun", "me_otro_mun"), label: "En otro municipio", color: "#ffcd56" },
                        { field: pickField("meotps", "migotropais", "migOtroPais", "me_otro_pais"), label: "En otro país", color: "#e6e6e6" },
                        { field: pickField("menoinf", "mignoinfo", "migNoInfo", "me_no_inf"), label: "No informa", color: "#4bc0c0" }
                    ];
                    const hasMigrationFields = Boolean(zoneField) && metrics.some(metric => metric.field);
                    const grouped = new Map(zoneDefinitions.map(zone => [
                        zone.code,
                        Object.fromEntries(metrics.map(metric => [metric.label, 0]))
                    ]));

                    rows.forEach(row => {
                        const zoneValue = zoneField ? row[zoneField] : "";
                        const rawZone = normalizeZone(zoneValue);
                        const zone = zoneDefinitions.find(def => def.aliases.some(alias => rawZone.includes(alias)))
                            || zoneDefinitions.find(def => def.values.includes(String(zoneValue).trim()))
                            || null;
                        if (!zone) return;
                        const bucket = grouped.get(zone.code);
                        metrics.forEach(metric => {
                            bucket[metric.label] += metric.field ? Number(row[metric.field]) || 0 : 0;
                        });
                    });

                    const labels = zoneDefinitions.map(zone => zone.label);
                    const datasets = metrics.map(metric => ({
                        label: metric.label,
                        data: zoneDefinitions.map(zone => grouped.get(zone.code)?.[metric.label] || 0),
                        backgroundColor: metric.color,
                        borderColor: metric.color
                    }));

                    const hasData = datasets.some(dataset => dataset.data.some(value => Number(value) > 0));
                    const chartNotice = hasMigrationFields
                        ? (!hasData ? "No hay registros numéricos para graficar en esta consulta." : "")
                        : "El servicio publicado para Migración Externa no contiene los campos requeridos: zonatipo, menonacido, memimp, meotmp, meotps y menoinf.";

                    crearGraficaMigracionExterna(labels, datasets, chartNotice);

                    if (ctx.config.summaryTableUrl && ctx.config.summaryFields) {
                        try {
                            const sFields = ctx.config.summaryFields.join(",");
                            const sUrl = `${ctx.config.summaryTableUrl}/query?where=${encodeURIComponent(dataWhere)}&outFields=${sFields}&f=json`;
                            const sJson = await fetchJsonCached(sUrl, { cacheKey: buildQueryCacheKey("json", sUrl) });
                            const attrs = sJson.features?.[0]?.attributes || {};
                            const sumDiv = document.getElementById("summaryDiv");
                            if (sumDiv) {
                                const desc = attrs.desctotalmg || "";
                                const analysis = attrs.antotalmig || "";
                                sumDiv.innerHTML = [
                                    "<b>Migración Externa:</b><br><br>",
                                    desc ? `<b>Descripción:</b> ${escapeHtmlWithBreaks(desc)}<br><br>` : "",
                                    analysis ? `<b>Análisis:</b> ${escapeHtmlWithBreaks(analysis)}` : ""
                                ].join("") || "Sin descripción disponible.";
                            }
                        } catch (_) { }
                    }

                    await refreshTasaCrecimientoMapAndLegend({ where: mapWhere, field: tasaCrecimientoCampoActivo, layer: layerGlobal });
                } catch (e) {
                    if (e?.name === "AbortError" || String(e?.message || "").toLowerCase().includes("aborted")) return;
                    console.error("migracionExternaHandler error:", e);
                    toggleMigracionExternaCharts(false);
                }
            }
        };
    }

    function migracionInternaHandler() {
        return {
            name: "migracionInterna",
            when: (ctx) => ctx.config?.isMigracionInterna === true,
            run: async (ctx) => {
                toggleMigracionInternaCharts(true);
                destroyMigracionInternaCharts();
                ctx.destroyChart();

                const mpCode = ctx.municipioActual;
                const dpCode = ctx.deptoActual || deptoActual || (mpCode ? String(mpCode).slice(0, 2) : "");
                const isMunicipal = !!mpCode;
                const isDepartmental = !isMunicipal && !!dpCode;
                const dataWhere = getCurrentTerritoryWhere();
                const mapWhere = isMunicipal
                    ? buildDepartmentMapWhereForConfig(ctx.config, dpCode)
                    : dataWhere;

                try {
                    ensureMapCategorySliderUi({ where: mapWhere, layer: layerGlobal });
                    applyWhereToActiveLayers(mapWhere);
                    layerGlobal?.queryExtent({ where: mapWhere }).then(res => {
                        if (res?.extent) {
                            view.goTo(res.extent.expand(1.12)).then(() => {
                                if (isMunicipal) highlightMunicipioOnMap(mpCode);
                            });
                        } else if (isMunicipal) {
                            highlightMunicipioOnMap(mpCode);
                        }
                    });

                    const json = await arcRestQueryAllFeatures(ctx.config.url, {
                        f: "json",
                        where: dataWhere,
                        outFields: (ctx.config.outFields || ["*"]).join(","),
                        returnGeometry: "false",
                        resultRecordCount: 2000
                    });
                    const rows = (json.features || []).map(feature => feature.attributes || {});

                    if (ctx.cycleId !== renderCycleId || !getActiveLayerConfig()?.isMigracionInterna) return;

                    const firstRow = rows.find(row => row.mpnombre || row.dpnombre) || rows[0] || {};
                    const mpNombre = isMunicipal ? (ctx.diccionarioMunicipios?.[mpCode] || firstRow.mpnombre || mpCode) : "";
                    const dpNombre = isDepartmental
                        ? (ctx.diccionarioDepartamentos?.[dpCode] || firstRow.dpnombre || dpCode)
                        : isMunicipal
                            ? (ctx.diccionarioDepartamentos?.[dpCode] || firstRow.dpnombre || dpCode)
                            : "";

                    ctx.setTitle(isMunicipal
                        ? `Migración Interna en el municipio de ${mpNombre}, ${dpNombre}`
                        : isDepartmental
                            ? `Migración Interna en ${dpNombre}`
                            : "Migración Interna en Colombia");

                    const metrics = [
                        { field: "migcbacb", label: "Permanencia en Cabecera", color: "#0B7FAB" },
                        { field: "migcbacp", label: "Cabecera a Centro Poblado", color: "#38A3A5" },
                        { field: "migcbard", label: "Cabecera a Rural", color: "#80B918" },
                        { field: "migcpacp", label: "Permanencia en Centro Poblado", color: "#FFB703" },
                        { field: "migcpacb", label: "Centro Poblado a Cabecera", color: "#FB8500" },
                        { field: "migcpard", label: "Centro Poblado a Rural", color: "#D95D39" },
                        { field: "migrdard", label: "Permanencia en Zona Rural", color: "#6C875E" },
                        { field: "migrdacb", label: "Zona Rural a Cabecera", color: "#8E5AA9" },
                        { field: "migrdacp", label: "Zona Rural a Centro Poblado", color: "#C65D7B" }
                    ];
                    const totals = metrics.map(metric => rows.reduce((sum, row) => sum + (Number(row[metric.field]) || 0), 0));
                    const hasData = totals.some(value => value > 0);
                    crearGraficaMigracionInterna(metrics.map(metric => metric.label), totals, metrics.map(metric => metric.color), hasData ? "" : "No hay información disponible para Migración Interna en esta consulta.");

                    if (ctx.config.summaryTableUrl && ctx.config.summaryField) {
                        try {
                            const sUrl = `${ctx.config.summaryTableUrl}/query?where=${encodeURIComponent(dataWhere)}&outFields=${ctx.config.summaryField}&f=json`;
                            const sJson = await fetchJsonCached(sUrl, { cacheKey: buildQueryCacheKey("json", sUrl) });
                            const attrs = sJson.features?.[0]?.attributes || {};
                            const sumDiv = document.getElementById("summaryDiv");
                            if (sumDiv) {
                                const analysis = attrs[ctx.config.summaryField] || "";
                                sumDiv.innerHTML = analysis
                                    ? `<b>Migración Interna:</b><br><br><b>Análisis:</b> ${escapeHtmlWithBreaks(analysis)}`
                                    : "Sin descripción disponible.";
                            }
                        } catch (_) { }
                    }
                    await refreshTasaCrecimientoMapAndLegend({ where: mapWhere, field: tasaCrecimientoCampoActivo, layer: layerGlobal });
                } catch (e) {
                    if (e?.name === "AbortError" || String(e?.message || "").toLowerCase().includes("aborted")) return;
                    console.error("migracionInternaHandler error:", e);
                    toggleMigracionInternaCharts(false);
                }
            }
        };
    }

    function autoreconocimientoEtnicoHandler() {
        return {
            name: "autoreconocimientoEtnico",
            when: (ctx) => ctx.config?.isAutoreconocimientoEtnico === true,
            run: async (ctx) => {
                const isActive = () => isLineaNegraContextActive({
                    cycleId: ctx.cycleId,
                    configId: ctx.config?.id
                });
                if (!isActive()) return;
                toggleAutoreconocimientoCharts(true);
                destroyAutoreconocimientoCharts();

                const mpCode = ctx.municipioActual;
                const dpCode = ctx.deptoActual || deptoActual || (mpCode ? String(mpCode).slice(0, 2) : "");
                const isMunicipal = !!mpCode;
                const isDepartmental = !isMunicipal && !!dpCode;
                const where = getCurrentTerritoryWhere();
                const mapWhere = isMunicipal
                    ? buildDepartmentMapWhereForConfig(ctx.config, dpCode)
                    : where;

                try {
                    const url = ctx.config.url;

                    applyWhereToActiveLayers(mapWhere);
                    const autoreconocimientoLayer = ctx.layer || layerGlobal;
                    autoreconocimientoLayer?.queryExtent({ where: mapWhere }).then(res => {
                        if (!isActive()) return;
                        if (res?.extent) {
                            view.goTo(res.extent.expand(1.12)).then(() => {
                                if (isActive() && isMunicipal) highlightMunicipioOnMap(mpCode);
                            });
                        }
                    });
                    loadLineaNegraLayersForAutoreconocimiento({
                        isMunicipal,
                        isDepartmental,
                        dpCode,
                        mpCode,
                        cycleId: ctx.cycleId,
                        configId: ctx.config?.id
                    });

                    const json = await arcRestQueryAllFeatures(url, {
                        f: "json",
                        where,
                        outFields: "*",
                        returnGeometry: "false",
                        resultRecordCount: 2000
                    });
                    if (!isActive()) return;
                    const rows = (json.features || []).map(feature => feature.attributes || {});

                    if (!rows.length) {
                        toggleAutoreconocimientoCharts(false);
                        ctx.actualizarLeyenda([], []);
                        appendLineaNegraLegendItems();
                        return;
                    }

                    const firstRow = rows.find(row => row.mpnombre || row.dpnombre) || rows[0] || {};
                    const mpNombre = isMunicipal ? (ctx.diccionarioMunicipios?.[mpCode] || firstRow.mpnombre || mpCode) : "";
                    const dpNombre = isDepartmental
                        ? (ctx.diccionarioDepartamentos?.[dpCode] || firstRow.dpnombre || dpCode)
                        : isMunicipal
                            ? (ctx.diccionarioDepartamentos?.[dpCode] || firstRow.dpnombre || dpCode)
                            : "";

                    ctx.setTitle(isMunicipal
                        ? `Autoreconocimiento étnico de ${mpNombre}, ${dpNombre}`
                        : isDepartmental
                            ? `Autoreconocimiento étnico de ${dpNombre}`
                            : "Autoreconocimiento étnico de Colombia");

                    const labels = [
                        "No. indígenas",
                        "No. Personas afro",
                        "No. Personas Gitanas",
                        "No. Personas Raizales",
                        "No. Personas Palenqueras"
                    ];
                    const sumField = (fieldName) => rows.reduce((sum, row) => sum + (Number(row[fieldName]) || 0), 0);
                    const values = [
                        sumField("pobindig"),
                        sumField("pobnmaa"),
                        sumField("pobgt"),
                        sumField("pobrz"),
                        sumField("pobpq")
                    ];

                    if (ctx.cycleId !== renderCycleId || !getActiveLayerConfig()?.isAutoreconocimientoEtnico) return;

                    crearGraficaAutoreconocimiento(labels, values, ctx);

                    // Descriptive text from service 25
                    if (ctx.config.summaryTableUrl && ctx.config.summaryFields) {
                        try {
                            const sFields = ctx.config.summaryFields.join(",");
                            const sUrl = `${ctx.config.summaryTableUrl}/query?where=${encodeURIComponent(where)}&outFields=${sFields}&f=json`;
                            const sJson = await fetchJsonCached(sUrl, { cacheKey: buildQueryCacheKey("json", sUrl) });
                            if (!isActive()) return;
                            const textAttrs = sJson.features?.[0]?.attributes || {};
                            const sumDiv = document.getElementById("summaryDiv");
                            if (sumDiv) {
                                let html = `<b>Autoreconocimiento étnico:</b><br><br>`;
                                if (textAttrs.rnetntercol) html += `<b>Relación población étnica y territorios colectivos:</b> ${escapeHtmlWithBreaks(textAttrs.rnetntercol)}<br><br>`;
                                if (textAttrs.divetn) html += `<b>Diversidad étnica municipal:</b> ${escapeHtmlWithBreaks(textAttrs.divetn)}`;
                                sumDiv.innerHTML = html || "Sin descripción disponible.";
                            }
                        } catch (_) { }
                    }

                    if (!isActive()) return;
                    await refreshAutoreconocimientoMapAndLegend({ where: mapWhere, layer: autoreconocimientoLayer });
                    if (!isActive()) return;
                    appendLineaNegraLegendItems();

                } catch (e) {
                    if (e?.name === "AbortError" || String(e?.message || "").toLowerCase().includes("aborted")) return;
                    console.error("autoreconocimientoEtnicoHandler error:", e);
                    if (isActive()) toggleAutoreconocimientoCharts(false);
                }
            }
        };
    }

    function condicionesSeguridadHandler() {
        return {
            name: "condicionesSeguridad",
            when: (ctx) => ctx.config?.isCondicionesSeguridad === true,
            run: async (ctx) => {
                toggleCondicionesSeguridadCharts(true);
                destroyCondicionesSeguridadCharts();

                const mpCode = ctx.municipioActual;
                const dpCode = ctx.deptoActual || deptoActual || (mpCode ? String(mpCode).slice(0, 2) : "");
                const isMunicipal = !!mpCode;
                const isDepartmental = !isMunicipal && !!dpCode;
                const where = getCurrentTerritoryWhere();
                const mapWhere = isMunicipal
                    ? buildDepartmentMapWhereForConfig(ctx.config, dpCode)
                    : where;

                try {
                    const url = ctx.config.url;

                    applyWhereToActiveLayers(mapWhere);
                    layerGlobal?.queryExtent({ where: mapWhere }).then(res => {
                        if (res?.extent) {
                            view.goTo(res.extent.expand(1.12)).then(() => {
                                if (isMunicipal) highlightMunicipioOnMap(mpCode);
                            });
                        }
                    });

                    const json = await arcRestQueryAllFeatures(url, {
                        f: "json",
                        where,
                        outFields: "*",
                        returnGeometry: "false",
                        resultRecordCount: 2000
                    });
                    const rows = (json.features || []).map(feature => feature.attributes || {});

                    if (!rows.length) {
                        toggleCondicionesSeguridadCharts(false);
                        ctx.actualizarLeyenda([], []);
                        return;
                    }

                    const firstRow = rows.find(row => row.mpnombre || row.dpnombre) || rows[0] || {};
                    const mpNombre = isMunicipal ? (ctx.diccionarioMunicipios?.[mpCode] || firstRow.mpnombre || mpCode) : "";
                    const dpNombre = isDepartmental
                        ? (ctx.diccionarioDepartamentos?.[dpCode] || firstRow.dpnombre || dpCode)
                        : isMunicipal
                            ? (ctx.diccionarioDepartamentos?.[dpCode] || firstRow.dpnombre || dpCode)
                            : "";

                    ctx.setTitle(isMunicipal
                        ? `Susceptibilidad asociada a las Condiciones de Seguridad de ${mpNombre}, ${dpNombre}`
                        : isDepartmental
                            ? `Susceptibilidad asociada a las Condiciones de Seguridad de ${dpNombre}`
                            : "Susceptibilidad asociada a las Condiciones de Seguridad de Colombia");

                    const labels = [
                        ["Índice de hechos", "victimizantes"],
                        "Puntaje GAI",
                        ["Índice de cultivos", "de uso ilícito"],
                        ["Índice de corredores", "ilícitos"],
                        ["Índice de afectación", "por minas antipersona"]
                    ];
                    const averageField = (fieldName) => {
                        const values = rows
                            .map(row => Number(row[fieldName]))
                            .filter(value => Number.isFinite(value));
                        return values.length
                            ? values.reduce((sum, value) => sum + value, 0) / values.length
                            : 0;
                    };

                    const values = [
                        averageField("indhv") > 1 ? 0.1 : averageField("indhv"),
                        averageField("puntgai"),
                        averageField("indcoca"),
                        averageField("indcorredores"),
                        averageField("indmina")
                    ];


                    if (ctx.cycleId !== renderCycleId || !getActiveLayerConfig()?.isCondicionesSeguridad) return;

                    crearGraficaCondicionesSeguridad(labels, values, ctx);

                    // Descriptive text from service 25
                    if (isMunicipal && ctx.config.summaryTableUrl && ctx.config.summaryField) {
                        try {
                            const sUrl = `${ctx.config.summaryTableUrl}/query?where=${encodeURIComponent(where)}&outFields=${ctx.config.summaryField}&f=json`;
                            const sJson = await fetchJsonCached(sUrl, { cacheKey: buildQueryCacheKey("json", sUrl) });
                            const text = sJson.features?.[0]?.attributes?.[ctx.config.summaryField] || "";
                            const sumDiv = document.getElementById("summaryDiv");
                            if (sumDiv) {
                                let html = `<b>Análisis cualitativo de condiciones de seguridad:</b><br><br>${escapeHtmlWithBreaks(text || "Sin descripción disponible.")}`;
                                sumDiv.innerHTML = html;
                            }
                        } catch (_) { }
                    }

                    await refreshCondicionesSeguridadMapAndLegend({ where: mapWhere, layer: layerGlobal });

                } catch (e) {
                    if (e?.name === "AbortError" || String(e?.message || "").toLowerCase().includes("aborted")) return;
                    console.error("condicionesSeguridadHandler error:", e);
                    toggleCondicionesSeguridadCharts(false);
                }
            }
        };
    }


    function contextoHistoricoHandler() {
        return {
            name: "contextoHistorico",
            when: (ctx) => ctx.config?.isContextoHistorico === true,
            run: async (ctx) => {
                toggleContextoHistoricoCharts(true);
                ctx.setTitle(ctx.config?.title || "Contexto Histórico");

                const slider = document.getElementById("periodoSlider");
                const label = document.getElementById("periodoSliderLabel");
                const sumDiv = document.getElementById("summaryDiv");
                const periodos = contextoHistoricoPeriodos;
                let contextoHistoricoSummaryAttrs = null;
                let contextoHistoricoSummaryLoaded = false;

                function setSummaryMessage(message) {
                    if (sumDiv) sumDiv.textContent = message;
                }

                function mergeSummaryRows(features = []) {
                    const fields = ["perpreh", "percol", "perrep", "percon", "permod", "percont"];
                    const merged = {};

                    features.forEach(feature => {
                        const attrs = feature?.attributes || {};
                        fields.forEach(field => {
                            if (!merged[field] && attrs[field]) {
                                merged[field] = attrs[field];
                            }
                        });
                    });

                    return Object.keys(merged).length ? merged : null;
                }

                function getSummaryTitle(field, periodo) {
                    const item = field ? document.querySelector(`.timeline-item[data-periodo="${field}"]`) : null;
                    const itemLabel = item?.querySelector(".timeline-label")?.innerText;
                    return String(itemLabel || periodo || "").replace("\n", " ").trim();
                }

                function updateSummaryText(periodo = contextoHistoricoPeriodoActivo || "Todos", timelineKey = null) {
                    if (!sumDiv) return;

                    if (isDepartmentOnlySelection()) {
                        setSummaryMessage(MUNICIPALITY_REQUIRED_SUMMARY_MESSAGE);
                        return;
                    }

                    if (contextoHistoricoSummaryLoaded && !contextoHistoricoSummaryAttrs) {
                        setSummaryMessage("No hay informacion disponible.");
                        return;
                    }

                    if (!periodo || periodo === "Todos") {
                        setSummaryMessage("Seleccione un periodo en la linea de tiempo para ver la informacion.");
                        return;
                    }

                    const field = timelineKey || contextoHistoricoPeriodoToTimeline[periodo] || null;
                    const title = getSummaryTitle(field, periodo);
                    const text = field && contextoHistoricoSummaryAttrs[field]
                        ? contextoHistoricoSummaryAttrs[field]
                        : "Sin descripcion disponible.";

                    sumDiv.innerHTML = `<b>${escapeHtml(title)}:</b><br><br>${escapeHtmlWithBreaks(text)}`;
                }

                if (slider && label) {
                    slider.min = 0;
                    slider.max = periodos.length - 1;
                    slider.step = 1;
                    if (Number(slider.value) > periodos.length - 1) slider.value = 0;
                    label.textContent = "Periodo: " + (periodos[Number(slider.value) || 0] || "Todos");
                    slider.oninput = async function () {
                        const val = Number(this.value) || 0;
                        const perName = periodos[val] || "Todos";
                        const timelineKey = contextoHistoricoPeriodoToTimeline[perName] || null;
                        await applyContextoHistoricoPeriodSelection(perName, { timelineKey });
                        updateSummaryText(perName, timelineKey);
                    };
                }

                if (isDepartmentOnlySelection()) {
                    setSummaryMessage(MUNICIPALITY_REQUIRED_SUMMARY_MESSAGE);
                } else {
                    setSummaryMessage("Cargando informacion...");
                }
                ctx.setTitle(`Contexto historico de ${getCurrentTerritoryLabel()}`);

                try {
                    await applyContextoHistoricoPeriodSelection(
                        contextoHistoricoPeriodoActivo || "Todos",
                        { timelineKey: contextoHistoricoTimelineKeyActivo, refreshLegend: true }
                    );

                    if (!isDepartmentOnlySelection() && ctx.config.summaryTableUrl) {
                        try {
                            const whereInfo = getCurrentTerritoryWhere();
                            const sUrl = `${ctx.config.summaryTableUrl}/query?where=${encodeURIComponent(whereInfo)}&outFields=*&returnGeometry=false&f=json`;
                            const sJson = await fetchJsonCached(sUrl, { cacheKey: buildQueryCacheKey("json", sUrl) });
                            contextoHistoricoSummaryAttrs = mergeSummaryRows(sJson.features || []);
                            contextoHistoricoSummaryLoaded = true;
                        } catch (summaryError) {
                            console.warn("No fue posible cargar el resumen de contexto historico.", summaryError);
                            contextoHistoricoSummaryAttrs = null;
                            contextoHistoricoSummaryLoaded = true;
                        }
                    } else {
                        contextoHistoricoSummaryLoaded = true;
                    }

                    updateSummaryText(contextoHistoricoPeriodoActivo, contextoHistoricoTimelineKeyActivo);

                    document.querySelectorAll(".timeline-item").forEach(item => {
                        item.onclick = async function () {
                            const key = this.getAttribute("data-periodo");
                            const timelinePeriodo = contextoHistoricoTimelineToPeriodo[key] || "Todos";
                            await applyContextoHistoricoPeriodSelection(timelinePeriodo, { timelineKey: key });
                            updateSummaryText(timelinePeriodo, key);
                        };
                    });
                } catch (error) {
                    console.error("contextoHistoricoHandler error:", error);
                    setSummaryMessage("No fue posible cargar la informacion.");
                }
            }
        };
    }

    function setDistribucionChartPanelState(mode = "chart") {
        const chartCanvas = document.getElementById("chart");
        const chartTitle = document.getElementById("chartTitle");
        const summaryDiv = document.getElementById("summaryDiv");

        if (mode === "rangesText") {
            if (chartCanvas) chartCanvas.style.display = "none";
            if (chartTitle) {
                chartTitle.textContent = "";
                chartTitle.style.display = "none";
            }
            if (summaryDiv) {
                summaryDiv.innerHTML = "Seleccione un municipio para ver el gráfico.";
                summaryDiv.style.display = "";
            }
            return;
        }

        if (chartCanvas) chartCanvas.style.display = "";
        if (chartTitle) chartTitle.style.display = "";
    }

    function densidadLegendItemHasFeature(item, features = []) {
        return features.some(feature => {
            const attrs = feature.attributes || {};
            const density = Number(attrs.denpobha);
            const zone = Number(attrs.tzn);
            if (!Number.isFinite(density) || !Number.isFinite(zone)) return false;

            const zoneMatches = Array.isArray(item.tznValues)
                ? item.tznValues.map(Number).includes(zone)
                : zone === Number(item.tzn);
            const minMatches = item.min == null
                ? true
                : item.minInclusive
                    ? density >= Number(item.min)
                    : density > Number(item.min);
            const maxMatches = density <= Number(item.max);

            return zoneMatches && minMatches && maxMatches;
        });
    }

    const CONCENTRACION_NACIONAL_LEGEND = [
        ["0,001 - 1", "#F6FD96"],
        ["1,001 - 2,706", "#F6F287"],
        ["2,707 - 7,323", "#F6E578"],
        ["7,324 - 19,818", "#F5D869"],
        ["19,819 - 53,630", "#F4CB5A"],
        ["53,631 - 145,132", "#F2BE4A"],
        ["145,133 - 392,749", "#E7A93C"],
        ["392,750 - 1.062,836", "#D28C28"],
        ["1.062,837 - 2.876,194", "#BE6E24"],
        ["2.876,195 - 7.386,345", "#AA5019"],
        ["7.386,346 - 21.063,116", "#942D0E"],
        ["21.063,117 - 57.000", "#7F0D05"]
    ];

    function renderConcentracionLegend({ isNational = false } = {}) {
        const title = document.getElementById("legendTitle");
        const content = document.getElementById("legendContent");
        if (!content) return;

        if (isNational) {
            if (title) title.textContent = "Concentración de población. Valor de personas por km²";
            content.innerHTML = CONCENTRACION_NACIONAL_LEGEND.map(([label, color]) => `
                <div class="legend-item">
                    <span class="legend-color" data-swatch-color="${color}"></span>
                    <span>${label}</span>
                </div>
            `).join("");
            content.querySelectorAll(".legend-color[data-swatch-color]").forEach(el => {
                el.style.background = el.dataset.swatchColor;
            });
            return;
        }

        if (title) title.textContent = "Grado de ocupación";
        content.innerHTML = `
            <div class="oot-js-ocupacion-app-15">
                <span class="oot-js-ocupacion-app-16">Menor</span>
                <span class="oot-js-ocupacion-app-17"></span>
                <span class="oot-js-ocupacion-app-16">Mayor</span>
            </div>
        `;
    }

    function setConcentracionSource({ isNational = false } = {}) {
        const fuenteDiv = document.getElementById("mapSource");
        if (!fuenteDiv) return;
        fuenteDiv.textContent = isNational
            ? "Fuente: IGAC, 2026; DANE, 2024"
            : "Fuente: IGAC, 2026; Invías, 2024";
    }

    function buildConcentracionSummary({ isNational = false, isMunicipal = false, attrs = {} } = {}) {
        if (isNational) {
            return `
                <b>Concentración de la población</b><br><br>
                La grilla fuente corresponde a celdas regulares de 1 km × 1 km, por lo que cada celda representa una superficie de 1 km². En consecuencia, los valores de población por celda pueden interpretarse directamente como número de personas por kilómetro cuadrado. Los límites de clase presentan valores decimales debido a que fueron calculados mediante una progresión geométrica; esta condición no modifica la unidad temática de la variable, sino únicamente los umbrales utilizados para clasificarla cartográficamente.
            `;
        }

        const note = "La capa fue procesada por el IGAC a partir de la grilla poblacional DANE Vihope N6, criterios adoptados de la metodología DEGURBA y construcciones rurales de la cartografía 1:100 000.";
        if (!isMunicipal) return `<b>Concentración de la población</b><br><br>${note}`;

        const sections = [
            ["Distribución espacial de la población", attrs.distesppob],
            ["Infraestructura y biofísico", attrs.infrabio],
            ["Determinantes y condicionantes", attrs.detcond]
        ].filter(([, value]) => value);

        return `
            <b>Concentración de la población</b><br><br>
            ${note}
            ${sections.map(([label, value]) => `<br><br><b>${escapeHtml(label)}:</b><br>${escapeHtmlWithBreaks(value)}`).join("") || "<br><br>Sin descripción disponible."}
        `;
    }

    function buildConcentracionRoadWhere(layer, { mpCode = "", dpCode = "", isMunicipal = false, isDepartmental = false } = {}) {
        const fields = (layer?.fields || []).map(field => String(field.name || "").toLowerCase());
        const escapeSql = value => String(value || "").replace(/'/g, "''");
        if (isMunicipal && mpCode && fields.includes("mpcodigo")) return `mpcodigo = '${escapeSql(mpCode)}'`;
        if ((isMunicipal || isDepartmental) && dpCode && fields.includes("dpcodigo")) return `dpcodigo = '${escapeSql(dpCode)}'`;
        if ((isMunicipal || isDepartmental) && dpCode && fields.includes("cod_dpto")) return `cod_dpto = '${escapeSql(dpCode)}'`;
        if ((isMunicipal || isDepartmental) && dpCode && fields.includes("depto")) return `depto = '${escapeSql(dpCode)}'`;
        return "1=1";
    }

    async function loadConcentracionRoadLayers(config, territory) {
        const urls = Array.isArray(config.roadLayerUrls) ? config.roadLayerUrls : [];
        if (!urls.length || (!territory.isDepartmental && !territory.isMunicipal)) return [];

        const layers = urls.map((url, index) => new FeatureLayer({
            url,
            outFields: ["*"],
            opacity: 0.9,
            visible: true,
            title: `Infraestructura vial ${index + 1}`
        }));

        await Promise.all(layers.map(async layer => {
            try {
                await layer.load();
                layer.definitionExpression = buildConcentracionRoadWhere(layer, territory);
            } catch (_) { }
        }));

        return layers;
    }

    async function resolveConcentracionRoadSource(layer) {
        if (!layer || typeof layer.queryFeatures !== "function") return "";
        const sourceField = (layer.fields || []).find(field => String(field.name || "").toLowerCase() === "fuente")?.name;
        if (!sourceField) return "";

        try {
            const result = await layer.queryFeatures({
                where: layer.definitionExpression || "1=1",
                outFields: [sourceField],
                returnGeometry: false,
                num: 1
            });
            return result.features?.[0]?.attributes?.[sourceField] || "";
        } catch (_) {
            return "";
        }
    }

    async function concentracionPoblacionHandlerRun(ctx) {
        ctx.destroyChart();
        hideMainChartCanvasDuringLoad();
        setConcentracionSummaryPanelActive(true);
        hideTimeSlider();
        clearLayers();

        const mpCode = ctx.municipioActual;
        const dpCode = ctx.deptoActual || deptoActual || (mpCode ? String(mpCode).slice(0, 2) : "");
        const isMunicipal = !!mpCode;
        const isDepartmental = !isMunicipal && !!dpCode;
        const isNational = !isMunicipal && !isDepartmental;
        const escapeSql = value => String(value || "").replace(/'/g, "''");

        const imageUrl = isNational ? ctx.config.url : ctx.config.municipalImageUrl;
        const mosaicWhere = isNational
            ? ""
            : isMunicipal
                ? `name LIKE '%_${escapeSql(mpCode)}'`
                : `name LIKE 'CPP_${escapeSql(dpCode)}_%'`;

        const imageLayerOptions = {
            url: imageUrl,
            opacity: 0.82,
            visible: true,
            title: ctx.config.title || "Concentración de la población"
        };
        if (mosaicWhere) imageLayerOptions.mosaicRule = { where: mosaicWhere };

        const imageLayer = new ImageryLayer(imageLayerOptions);

        layerGlobal = imageLayer;
        activeFeatureLayer = imageLayer;
        layersGlobal = [imageLayer];
        map.add(imageLayer);

        const roadLayers = await loadConcentracionRoadLayers(ctx.config, { mpCode, dpCode, isMunicipal, isDepartmental });
        roadLayers.forEach(layer => {
            map.add(layer);
            layersGlobal.push(layer);
        });

        updateMapViewBadge(ctx.config.title || "Concentración de la población");
        ctx.setTitle("Concentración de la población");
        renderConcentracionLegend({ isNational });
        setConcentracionSource({ isNational });
        resetLegendFilterState();
        if (!isNational && roadLayers[0]) {
            const roadSource = await resolveConcentracionRoadSource(roadLayers[0]);
            const fuenteDiv = document.getElementById("mapSource");
            if (fuenteDiv && roadSource) {
                fuenteDiv.textContent = `Fuente: IGAC, 2026; ${roadSource}`;
            }
        }

        const summaryDiv = document.getElementById("summaryDiv");
        if (summaryDiv) {
            summaryDiv.style.display = "";
            summaryDiv.innerHTML = buildConcentracionSummary({ isNational, isMunicipal });
        }

        if (isMunicipal && ctx.config.summaryTableUrl && Array.isArray(ctx.config.summaryFields)) {
            try {
                const fields = ctx.config.summaryFields.join(",");
                const where = `mpcodigo = '${escapeSql(mpCode)}'`;
                const sUrl = `${ctx.config.summaryTableUrl}/query?where=${encodeURIComponent(where)}&outFields=${fields}&returnGeometry=false&f=json`;
                const sJson = await fetchJsonCached(sUrl, { cacheKey: buildQueryCacheKey("json", sUrl) });
                const attrs = sJson.features?.[0]?.attributes || {};
                if (summaryDiv) {
                    summaryDiv.innerHTML = buildConcentracionSummary({ isNational, isMunicipal, attrs });
                }
            } catch (_) { }
        }

        zoomToCurrentTerritory({
            duration: 650,
            drawTerritory: false,
            zoomDepartmentWhenMunicipal: false
        });
    }

    function concentracionPoblacionHandler() {
        return {
            name: "concentracionPoblacion",
            when: (ctx) => ctx.config?.isConcentracionPoblacion === true,
            run: concentracionPoblacionHandlerRun
        };
    }

    function distribucionPoblacionHandler() {
        return {
            name: "distribucionPoblacion",
            when: (ctx) => ctx.config?.isDistribucion === true,
            run: async (ctx) => {
                ctx.destroyChart();

                const mpCode = ctx.municipioActual;
                const dpCode = ctx.deptoActual || deptoActual || (mpCode ? String(mpCode).slice(0, 2) : "");
                const isMunicipal = !!mpCode;
                const isDepartmental = !isMunicipal && !!dpCode;
                const isNational = !isMunicipal && !isDepartmental;
                const isAggregatedView = isDepartmental || isNational;

                try {
                    const url = ctx.config.url;
                    const where = isMunicipal
                        ? `mpcodigo = '${String(mpCode).replace(/'/g, "''")}'`
                        : isDepartmental
                            ? `dpcodigo = '${String(dpCode).replace(/'/g, "''")}'`
                            : "1=1";
                    const mapWhere = isMunicipal
                        ? buildDepartmentMapWhereForConfig(ctx.config, dpCode)
                        : where;

                    // ── 1) Consultar datos del municipio ─────────────────────────
                    const queryUrl = `${url}/query?where=${encodeURIComponent(where)}&outFields=tzn,denpobha,mpcodigo,mpnombre,dpcodigo,dpnombre&orderByFields=tzn&returnGeometry=false&f=json`;
                    const json = await fetchJsonCached(queryUrl, { cacheKey: buildQueryCacheKey("json", queryUrl) });
                    const features = json.features || [];

                    if (!features.length) {
                        ctx.destroyChart();
                        ctx.actualizarLeyenda([], []);
                        return;
                    }

                    let labels = [];
                    let values = [];
                    let colors = [];
                    const getDensidadZoneLabel = (tzn) => {
                        if (Number(tzn) === 3) return "Rural disperso";
                        return (typeof tznLabels !== "undefined")
                            ? (tznLabels[tzn] || `Zona ${tzn}`)
                            : ["", "Cabecera Municipal", "Centros Poblados", "Rural disperso"][tzn] || `Zona ${tzn}`;
                    };

                    features.forEach(f => {
                        const tzn = Number(f.attributes.tzn);
                        const val = Number(f.attributes.denpobha) || 0;

                        // Label por zona (tzn), color por rango de densidad (denpobha)
                        // → coincide con el renderer classBreaks del mapa
                        const zoneLabel = getDensidadZoneLabel(tzn);
                        const zoneColors = {
                            1: "#c7a4b6", // Cabecera Municipal
                            2: "#d3d0a8", // Centros Poblados
                            3: "#c1d4b6"  // Rural Disperso
                        };
                        const color = zoneColors[tzn] || "#999";
                        labels.push(zoneLabel);
                        values.push(val);
                        colors.push(color);
                    });

                    const grouped = new Map();
                    features.forEach(f => {
                        const attrs = f.attributes || {};
                        const tzn = Number(attrs.tzn);
                        const val = Number(attrs.denpobha) || 0;
                        if (!tzn) return;

                        const current = grouped.get(tzn) || { tzn, sum: 0, count: 0, max: 0 };
                        current.sum += val;
                        current.count += 1;
                        current.max = Math.max(current.max, val);
                        grouped.set(tzn, current);
                    });

                    const rows = Array.from(grouped.values())
                        .sort((a, b) => a.tzn - b.tzn)
                        .map(row => ({
                            ...row,
                            avg: row.count ? row.sum / row.count : 0
                        }));
                    const maxAvg = Math.max(...rows.map(row => row.avg), 0);

                    labels = rows.map(row => getDensidadZoneLabel(row.tzn));
                    values = rows.map(row => isDepartmental && maxAvg > 0 ? (row.avg / maxAvg) * 100 : row.avg);
                    colors = rows.map(row => getDensidadOriginalColor(row.avg, layerGlobal, row.tzn));
                    const codes = rows.map(row => String(row.tzn));
                    const valueSuffix = isDepartmental ? "%" : " hab/ha";

                    // ── 2) Renderer del mapa (cabecera vs centro poblado vs rural) ──
                    const { buildRenderer } = getDensidadLegendApi();
                    if (layerGlobal && typeof buildRenderer === "function") {
                        layerGlobal.renderer = buildRenderer(
                            isAggregatedView && isDepartmental ? dpCode : (dpCode || null)
                        );
                        layerGlobal.orderByFields = ["tzn"];
                        try { layerGlobal.refresh?.(); } catch (_) { }
                    }

                    applyWhereToActiveLayers(mapWhere);
                    if (!isNational) {
                        layerGlobal?.queryExtent({ where: mapWhere }).then(res => {
                            if (res?.extent) {
                                view.goTo(res.extent.expand(isMunicipal ? 1.12 : 1.3)).then(() => {
                                    if (isMunicipal) highlightMunicipioOnMap(mpCode);
                                });
                            } else if (isMunicipal) {
                                highlightMunicipioOnMap(mpCode);
                            }
                        });
                    }

                    // ── 3) Título y gráfica ─────────────────────────────────
                    if (isAggregatedView) {
                        setDistribucionChartPanelState("rangesText");
                    } else {
                        setDistribucionChartPanelState("chart");

                        const mpNombre = ctx.diccionarioMunicipios?.[mpCode] || mpCode;
                        const dpNombre = ctx.diccionarioDepartamentos?.[deptoActual] || ctx.deptoActual;
                        ctx.setTitle(`Densidad de población por zona municipio de ${mpNombre}, ${dpNombre}`);

                        ctx.crearGrafica(labels, values, colors, "bar", true, null, {
                            codes,
                            valueSuffix
                        });

                        if (chartInstance && valueSuffix) {
                            chartInstance.options.scales.y.title.text = "Densidad (hab/ha)";
                            chartInstance.update();
                        }
                    }

                    // ── 5) Leyenda interactiva con los mismos colores del mapa ────────────
                    if (isMunicipal) {
                        await configureDensidadVisualLegendForLayer(ctx, {
                            where: mapWhere,
                            deptoCode: dpCode,
                            layer: layerGlobal
                        });
                    } else if (isAggregatedView) {
                        await renderDensidadMapLegend({
                            deptoCode: isDepartmental ? dpCode : null,
                            where,
                            features,
                            layer: layerGlobal
                        });
                    } else {
                        setLegendState({
                            field: "tzn",
                            allCodes: codes,
                            activeCodes: new Set(codes.map(String)),
                            selectedCode: null,
                            layer: layerGlobal,
                            baseWhere: where,
                            itemWheres: null
                        });
                        ctx.actualizarLeyenda(labels, colors, codes);
                    }

                    // ── 6) Resumen textual ───────────────────────────────
                    if (!isAggregatedView && ctx.config.summaryTableUrl && ctx.config.summaryField) {
                        try {
                            const sUrl = `${ctx.config.summaryTableUrl}/query?where=${encodeURIComponent(where)}&outFields=${ctx.config.summaryField}&f=json`;
                            const sJson = await fetchJsonCached(sUrl, { cacheKey: buildQueryCacheKey("json", sUrl) });
                            const text = sJson.features?.[0]?.attributes?.[ctx.config.summaryField] || "";
                            const sumDiv = document.getElementById("summaryDiv");
                            if (sumDiv && text) sumDiv.innerHTML = `<b>Densidad poblacional:</b><br><br>${escapeHtmlWithBreaks(text)}`;
                        } catch (_) { }
                    }

                } catch (e) {
                    if (e?.name === "AbortError" || String(e?.message || "").toLowerCase().includes("aborted")) return;
                    console.error("distribucionPoblacionHandler error:", e);
                    if (isAggregatedView || isMunicipal) {
                        await renderDensidadMapLegend({
                            deptoCode: (isDepartmental || isMunicipal) ? dpCode : null,
                            where: isMunicipal
                                ? buildDepartmentMapWhereForConfig(ctx.config, dpCode)
                                : isDepartmental
                                ? `dpcodigo = '${String(dpCode).replace(/'/g, "''")}'`
                                : "1=1",
                            layer: layerGlobal
                        });
                    } else {
                        ctx.actualizarLeyenda([], []);
                    }
                    ctx.destroyChart();
                }
            }
        };
    }

    function gini(datos) {
        const data = Number(datos) || 0;
        let texto = '';

        if (data <= 0.30) {
            texto = 'Desigualdad Muy Baja | <= 0.30';
        } else if (data > 0.30 && data <= 0.45) {
            texto = 'Desigualdad Baja | >0.30 <= 0.45';
        } else if (data > 0.45 && data <= 0.60) {
            texto = 'Desigualdad Media | >0.45 <= 0.60';
        } else if (data > 0.60 && data <= 0.75) {
            texto = 'Desigualdad Alta | >0.60 <= 0.75';
        } else if (data > 0.75 && data <= 1.0) {
            texto = 'Desigualdad Muy Alta | >0.75 <= 1.0';
        }

        return texto;
    }

    function theil(datos) {
        const data = Number(datos) || 0;
        let texto = '';

        if (data <= 0.06) {
            texto = 'Dispersión Muy Baja - Muy alta igualdad | <= 0.06';
        } else if (data > 0.06 && data <= 0.10) {
            texto = 'Dispersión baja - Alta igualdad | >0.06 <= 0.10';
        } else if (data > 0.10 && data <= 0.18) {
            texto = 'Dispersión media - Igualdad moderada | >0.10 <= 0.18';
        } else if (data > 0.18 && data <= 0.30) {
            texto = 'Dispersión alta - Desigualdad moderada | >0.18 <= 0.30';
        } else if (data > 0.30 && data <= 1.0) {
            texto = 'Dispersión muy alta - Alta desigualdad | >0.30 <= 1.0';
        }

        return texto;
    }

    function disparidadSuperior(datos) {
        const data = Number(datos) || 0;
        let texto = '';

        if (data <= 2.7) {
            texto = 'Disparidad superior baja | <= 2.7';
        } else if (data > 2.7 && data <= 5.2) {
            texto = 'Disparidad superior media | >2.7 <= 5.2';
        } else if (data > 5.2 && data <= 7.0) {
            texto = 'Disparidad superior alta | >5.2 <= 7.0';
        } else if (data > 7.0 && data <= 8.5) {
            texto = 'Muy alta disparidad superior | >7.0 <= 8.5';
        } else if (data > 8.5) {
            texto = 'Disparidad superior extrema | >8.5';
        }

        return texto;
    }

    function disparidadInferior(datos) {
        const data = Number(datos) || 0;
        let texto = '';

        if (data <= 0.01) {
            texto = 'Disparidad inferior muy alta | <= 0.01';
        } else if (data > 0.01 && data <= 0.02) {
            texto = 'Disparidad inferior alta | >0.01 <= 0.02';
        } else if (data > 0.02 && data <= 0.055) {
            texto = 'Disparidad inferior moderada | >0.02 <= 0.055';
        } else if (data > 0.055 && data <= 0.231) {
            texto = 'Disparidad inferior media | >0.055 <= 0.231';
        } else if (data > 0.231 && data <= 1.0) {
            texto = 'Disparidad inferior baja | >0.231 <= 1.0';
        }

        return texto;
    }

    function informalidad(datos) {
        const data = Number(datos) || 0;
        let texto = '';

        if (data <= 10) {
            texto = 'Nivel muy bajo de informalidad | <= 10';
        } else if (data > 10 && data <= 30) {
            texto = 'Nivel bajo de informalidad | >10 <= 30';
        } else if (data > 30 && data <= 50) {
            texto = 'Nivel medio de informalidad | >30 <= 50';
        } else if (data > 50 && data <= 70) {
            texto = 'Nivel alto de informalidad | >50 <= 70';
        } else if (data > 70 && data <= 100) {
            texto = 'Nivel muy alto de informalidad | >70 <= 100';
        }

        return texto;
    }

    function indicesComplementariosHandler() {
        return {
            name: "indicesComplementarios",
            when: (ctx) => ctx.config?.isIndicesComplementarios === true,
            run: async (ctx) => {
                toggleIndicesCharts(true);
                destroyIndicesCharts();

                const mpCode = ctx.municipioActual;
                const dpCode = ctx.deptoActual || deptoActual;
                const isMunicipal = !!mpCode;
                const isDepartmental = !isMunicipal && !!dpCode;
                const isNational = !isMunicipal && !isDepartmental;

                try {
                    const url = ctx.config.url;
                    const where = isMunicipal
                        ? `mpcodigo = '${String(mpCode).replace(/'/g, "''")}'`
                        : isDepartmental
                            ? `dpcodigo = '${String(dpCode).replace(/'/g, "''")}'`
                            : "1=1";
                    const mapWhere = isMunicipal
                        ? buildDepartmentMapWhereForConfig(ctx.config, dpCode)
                        : where;

                    // 1) Capa visual + zoom
                    applyWhereToActiveLayers(mapWhere);
                    layerGlobal?.queryExtent({ where: mapWhere }).then(res => {
                        if (res?.extent) {
                            view.goTo(res.extent.expand(1.12)).then(() => {
                                if (isMunicipal) highlightMunicipioOnMap(mpCode);
                            });
                        }
                    });
                    setupIndicesComplementariosSlider({ where: mapWhere, layer: layerGlobal });
                    await refreshIndiceComplementarioMapAndLegend({ where: mapWhere, field: indiceComplementarioCampoActivo, layer: layerGlobal });

                    // 2) Consultar datos
                    const fields = "icmgini,icmtheil,icmdispsup,icmdispinf,icminformal,icminformalporc,mpnombre,dpnombre,dpcodigo";
                    const queryUrl = `${url}/query?where=${encodeURIComponent(where)}&outFields=${fields}&f=json`;
                    const json = await fetchJsonCached(queryUrl, { cacheKey: buildQueryCacheKey("json", queryUrl) });
                    const rows = (json.features || []).map(feature => feature.attributes || {});
                    const feat = rows[0];

                    if (!feat) {
                        ctx.actualizarLeyenda([], []);
                        return;
                    }

                    const avg = (field, fallbackField = null) => {
                        const values = rows
                            .map(item => Number(item[field] ?? (fallbackField ? item[fallbackField] : null)))
                            .filter(value => Number.isFinite(value));
                        if (!values.length) return 0;
                        return values.reduce((sum, value) => sum + value, 0) / values.length;
                    };

                    const chartValues = {
                        icmgini: avg("icmgini"),
                        icmtheil: avg("icmtheil"),
                        icmdispsup: avg("icmdispsup"),
                        icmdispinf: avg("icmdispinf"),
                        icminformal: avg("icminformal", "icminformalporc")
                    };

                    // const mpNombre = feat.mpnombre || ctx.diccionarioMunicipios?.[mpCode] || mpCode;
                    // const dpNombre = feat.dpnombre || ctx.diccionarioDepartamentos?.[deptoActual] || deptoActual;
                    const mpNombre = isMunicipal ? (ctx.diccionarioMunicipios?.[mpCode] || feat.mpnombre || mpCode) : "";
                    const dpNombre = isDepartmental
                        ? (ctx.diccionarioDepartamentos?.[dpCode] || feat.dpnombre || dpCode)
                        : isMunicipal
                            ? (ctx.diccionarioDepartamentos?.[deptoActual] || feat.dpnombre || deptoActual)
                            : "";

                    ctx.setTitle(isNational
                        ? "Índices Complementarios en Colombia"
                        : isDepartmental
                            ? `Índices Complementarios en ${dpNombre}`
                            : `Índices Complementarios en el municipio de ${mpNombre}, ${dpNombre}`);

                    // Gráfico 1: Gini, Theil, Disparidad Superior
                    indicesChartInstances[1] = crearGraficaIndices("chartIndices1", "", ["Gini", "Theil", "Disparidad Superior"], [
                        {
                            label: "Índice",
                            data: [
                                chartValues.icmgini,
                                chartValues.icmtheil,
                                chartValues.icmdispsup
                            ],
                            backgroundColor: ["#4f81bd", "#c0504d", "#9bbb59"],
                            datalabels: [
                                gini(chartValues.icmgini),
                                theil(chartValues.icmtheil),
                                disparidadSuperior(chartValues.icmdispsup)
                            ],
                            hideLegend: true
                        }
                    ], "Rango numérico del índice");

                    // Gráfico 2: Disparidad Inferior
                    indicesChartInstances[2] = crearGraficaIndices("chartIndices2", "", ["Disparidad Inferior"], [
                        {
                            label: "Índice",
                            data: [chartValues.icmdispinf],
                            backgroundColor: ["#efc000"],
                            datalabels: [disparidadInferior(chartValues.icmdispinf)],
                            hideLegend: true
                        }
                    ], "Rango numérico del índice");

                    // Gráfico 3: Informalidad (%)
                    indicesChartInstances[3] = crearGraficaIndices("chartIndices3", "", ["Informalidad"], [
                        {
                            label: "Índice",
                            data: [chartValues.icminformal],
                            backgroundColor: ["#004A69"],
                            datalabels: [informalidad(chartValues.icminformal)],
                            hideLegend: true
                        }
                    ], "Porcentaje (%)", true);

                    // 3) Resumen descriptivo e interpretación de leyendas
                    if (isMunicipal && ctx.config.summaryTableUrl && ctx.config.summaryField) {
                        try {
                            const sUrl = `${ctx.config.summaryTableUrl}/query?where=${encodeURIComponent(where)}&outFields=${ctx.config.summaryField}&f=json`;
                            const sJson = await fetchJsonCached(sUrl, { cacheKey: buildQueryCacheKey("json", sUrl) });
                            const text = sJson.features?.[0]?.attributes?.[ctx.config.summaryField] || "";
                            const sumDiv = document.getElementById("summaryDiv");
                            if (sumDiv) {
                                let html = `<b>Análisis de la propiedad rural:</b><br><br>${escapeHtmlWithBreaks(text || "Sin descripción disponible.")}`;
                                html += `<br><br><b>Referencia de colores en gráficos:</b><br>`;
                                html += `<ul class="oot-js-ocupacion-app-18">
                                            <li><span class="oot-js-ocupacion-app-19">■</span> Índice de Gini</li>
                                            <li><span class="oot-js-ocupacion-app-20">■</span> Índice de Theil</li>
                                            <li><span class="oot-js-ocupacion-app-21">■</span> Disparidad Superior</li>
                                            <li><span class="oot-js-ocupacion-app-22">■</span> Disparidad Inferior</li>
                                            <li><span class="oot-js-ocupacion-app-23">■</span> Informalidad (%)</li>
                                        </ul>`;
                                sumDiv.innerHTML = html;
                            }
                        } catch (_) { }
                    }

                    // 4) Mantener leyenda y mapa sincronizados con el índice activo del slider.
                    await refreshIndiceComplementarioMapAndLegend({ where: mapWhere, field: indiceComplementarioCampoActivo, layer: layerGlobal });

                } catch (e) {
                    console.error("indicesComplementariosHandler error:", e);
                    toggleIndicesCharts(false);
                }
            }
        };
    }

    /* =======================
    ROUTER
    ======================= */
    function getHandlers() {
        return [
            contextoHistoricoHandler(),
            composicionPoblacionHandler(),
            tasaCrecimientoHandler(),
            migracionExternaHandler(),
            migracionInternaHandler(),
            autoreconocimientoEtnicoHandler(),
            condicionesSeguridadHandler(),
            indicesComplementariosHandler(),
            propiedadRuralHandler(),
            estructuraPiramidesHandler(),
            transicionDemograficaHandler(),
            concentracionPoblacionHandler(),
            distribucionPoblacionHandler()
        ];
    }


    function crearGraficaMigracionExterna(labels, datasets, notice = "") {
        const canvas = document.getElementById("mgeChart");
        if (!canvas) return;
        const panel = canvas.parentElement;
        let noticeEl = document.getElementById("mgeChartNotice");
        if (!noticeEl && panel) {
            noticeEl = document.createElement("div");
            noticeEl.id = "mgeChartNotice";
            noticeEl.className = "oot-js-ocupacion-app-notice";
            panel.insertBefore(noticeEl, canvas);
        }
        if (noticeEl) {
            noticeEl.textContent = notice || "";
            noticeEl.style.display = notice ? "block" : "none";
        }

        const screenWidth = window.innerWidth || 1200;
        const isSmallScreen = screenWidth <= 768;
        const isVerySmallScreen = screenWidth <= 480;
        const ctx = canvas.getContext("2d");
        if (mgeChartInstance) mgeChartInstance.destroy();

        const formatPersons = (value) => Number(value || 0).toLocaleString("es-CO");
        const axisTextColor = "#4c4c4c";
        const axisFontFamily = "'Segoe UI', 'Outfit', sans-serif";
        const axisTitleFont = {
            family: axisFontFamily,
            size: isVerySmallScreen ? 9 : 10,
            weight: "600"
        };
        const axisTickFont = {
            family: axisFontFamily,
            size: isVerySmallScreen ? 9 : 10,
            weight: "600"
        };
        const preparedDatasets = datasets.map(dataset => ({
            ...dataset,
            borderWidth: 1,
            borderColor: "rgba(255, 255, 255, 0.92)",
            borderRadius: 0,
            borderSkipped: false,
            barPercentage: isSmallScreen ? 0.56 : 0.62,
            categoryPercentage: isSmallScreen ? 0.54 : 0.62,
            hoverBorderColor: "rgba(0, 84, 112, 0.85)",
            hoverBorderWidth: 2
        }));
        const chartHeight = isSmallScreen ? 420 : 440;
        prepareMigrationChartShell(canvas, chartHeight);

        mgeChartInstance = new Chart(ctx, {
            type: "bar",
            data: {
                labels,
                datasets: preparedDatasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: "nearest",
                    intersect: true
                },
                animation: {
                    duration: 420,
                    easing: "easeOutQuart"
                },
                layout: {
                    padding: {
                        top: 34,
                        right: isSmallScreen ? 18 : 28,
                        bottom: 10,
                        left: isSmallScreen ? 10 : 18
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: "bottom",
                        labels: {
                            boxWidth: 12,
                            boxHeight: 12,
                            color: "#465a63",
                            padding: 13,
                            font: {
                                family: "'Segoe UI', 'Outfit', sans-serif",
                                size: isVerySmallScreen ? 9 : 10,
                                weight: "600"
                            },
                            usePointStyle: true,
                            pointStyle: "rectRounded"
                        }
                    },
                    tooltip: {
                        backgroundColor: "rgba(0, 72, 96, 0.94)",
                        titleColor: "#ffffff",
                        bodyColor: "#ffffff",
                        borderColor: "rgba(255, 255, 255, 0.22)",
                        borderWidth: 1,
                        cornerRadius: 8,
                        padding: 10,
                        displayColors: true,
                        boxPadding: 4,
                        callbacks: {
                            label: (context) => ` ${context.dataset.label}: ${formatPersons(context.raw)} personas`,
                            footer: (items) => {
                                const dataIndex = items?.[0]?.dataIndex;
                                if (dataIndex === undefined) return "";
                                const total = items[0].chart.data.datasets.reduce((sum, dataset) => {
                                    return sum + (Number(dataset.data?.[dataIndex]) || 0);
                                }, 0);
                                return `Total: ${formatPersons(total)} personas`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        stacked: true,
                        title: {
                            display: true,
                            text: "Tipo de zona",
                            color: axisTextColor,
                            font: axisTickFont,
                            padding: { top: 12 }
                        },
                        ticks: {
                            autoSkip: false,
                            maxRotation: 0,
                            minRotation: 0,
                            color: axisTextColor,
                            padding: 10,
                            font: axisTickFont,
                            callback: function (value) {
                                return wrapLabel(this.getLabelForValue(value), isSmallScreen ? 11 : 16);
                            }
                        },
                        grid: { display: false },
                        border: { display: false }
                    },
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: "Número de personas",
                            color: axisTextColor,
                            font: axisTickFont,
                            padding: { bottom: 4 }
                        },
                        ticks: {
                            color: axisTextColor,
                            padding: 8,
                            font: axisTickFont,
                            callback: (value) => Number(value).toLocaleString("es-CO")
                        },
                        grid: {
                            color: "rgba(0, 72, 96, 0.08)",
                            drawBorder: false
                        },
                        border: { display: false },
                        grace: "12%"
                    }
                }
            },
            plugins: [{
                id: "migrationStackLabels",
                afterDatasetsDraw(chart) {
                    const { ctx, chartArea } = chart;
                    ctx.save();
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.font = `700 ${isVerySmallScreen ? 8 : 9}px ${axisFontFamily}`;

                    chart.data.datasets.forEach((dataset, datasetIndex) => {
                        if (!chart.isDatasetVisible(datasetIndex)) return;
                        const meta = chart.getDatasetMeta(datasetIndex);

                        meta.data.forEach((bar, index) => {
                            const rawValue = dataset.data[index];
                            const value = Number(rawValue);
                            if (rawValue === null || rawValue === undefined || !Number.isFinite(value)) return;

                            const props = bar.getProps(["x", "y", "base"], true);
                            const segmentTop = Math.min(props.y, props.base);
                            const segmentBottom = Math.max(props.y, props.base);
                            const segmentHeight = Math.abs(segmentBottom - segmentTop);
                            const text = formatPersons(value);
                            const textWidth = ctx.measureText(text).width;
                            const labelFitsInside = segmentHeight >= 18 && textWidth <= Math.max(26, bar.width + 18);

                            if (value === 0) {
                                const zeroLabelY = Math.max(
                                    chartArea.top + 8,
                                    Math.min(chartArea.bottom - 8, props.base - 8 - (datasetIndex * 10))
                                );
                                ctx.fillStyle = "#32464f";
                                ctx.fillText(text, props.x, zeroLabelY);
                                return;
                            }

                            if (labelFitsInside) {
                                ctx.fillStyle = dataset.label === "En otro país" ? "#4c4c4c" : "#ffffff";
                                ctx.fillText(text, props.x, segmentTop + (segmentHeight / 2));
                                return;
                            }

                            // Si el segmento es muy pequeño, el tooltip conserva el valor sin ensuciar el gráfico.
                        });
                    });

                    ctx.restore();
                }
            }]
        });
    }

    function crearGraficaMigracionInterna(labels, data, colors, notice = "") {
        const canvas = document.getElementById("mgiChart");
        if (!canvas) return;
        const panel = canvas.parentElement;
        let noticeEl = document.getElementById("mgiChartNotice");
        if (!noticeEl && panel) {
            noticeEl = document.createElement("div");
            noticeEl.id = "mgiChartNotice";
            noticeEl.className = "oot-js-ocupacion-app-notice";
            panel.insertBefore(noticeEl, canvas);
        }
        if (noticeEl) {
            noticeEl.textContent = notice || "";
            noticeEl.style.display = notice ? "block" : "none";
        }

        const screenWidth = window.innerWidth || 1200;
        const isSmallScreen = screenWidth <= 768;
        const isVerySmallScreen = screenWidth <= 480;
        const ctx = canvas.getContext("2d");
        if (mgiChartInstance) mgiChartInstance.destroy();

        const total = data.reduce((sum, value) => sum + (Number(value) || 0), 0);
        const formatPersons = (value) => Number(value || 0).toLocaleString("es-CO");
        const axisTextColor = "#4c4c4c";
        const axisFontFamily = "'Segoe UI', 'Outfit', sans-serif";
        const axisTitleFont = {
            family: axisFontFamily,
            size: isVerySmallScreen ? 9 : 10,
            weight: "600"
        };
        const axisTickFont = {
            family: axisFontFamily,
            size: isVerySmallScreen ? 8 : 9,
            weight: "600"
        };
        const xAxisTickFont = {
            family: axisFontFamily,
            size: isVerySmallScreen ? 7 : 8,
            weight: "normal"
        };
        const wrapCanvasLabel = (text, maxWidth) => {
            const words = String(text || "").split(/\s+/).filter(Boolean);
            const lines = [];
            let current = "";
            words.forEach(word => {
                const candidate = current ? `${current} ${word}` : word;
                if (ctx.measureText(candidate).width <= maxWidth || !current) {
                    current = candidate;
                } else {
                    lines.push(current);
                    current = word;
                }
            });
            if (current) lines.push(current);
            return lines;
        };
        const chartHeight = isSmallScreen ? 540 : 510;
        prepareMigrationChartShell(canvas, chartHeight);

        mgiChartInstance = new Chart(ctx, {
            type: "bar",
            data: {
                labels,
                datasets: [{
                    label: "Número de personas",
                    data,
                    backgroundColor: colors,
                    borderColor: colors,
                    borderWidth: 0,
                    borderRadius: 7,
                    borderSkipped: false,
                    barPercentage: isSmallScreen ? 0.52 : 0.58,
                    categoryPercentage: isSmallScreen ? 0.58 : 0.66,
                    hoverBorderColor: "rgba(0, 84, 112, 0.85)",
                    hoverBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: "nearest",
                    intersect: true
                },
                animation: {
                    duration: 420,
                    easing: "easeOutQuart"
                },
                layout: {
                    padding: {
                        top: 26,
                        right: isSmallScreen ? 12 : 20,
                        bottom: isSmallScreen ? 92 : 82,
                        left: isSmallScreen ? 8 : 14
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: "rgba(0, 72, 96, 0.94)",
                        titleColor: "#ffffff",
                        bodyColor: "#ffffff",
                        borderColor: "rgba(255, 255, 255, 0.22)",
                        borderWidth: 1,
                        cornerRadius: 8,
                        padding: 10,
                        displayColors: true,
                        boxPadding: 4,
                        callbacks: {
                            label: (context) => {
                                const value = Number(context.raw) || 0;
                                const pct = total > 0 ? (value / total) * 100 : 0;
                                return ` ${formatPersons(value)} personas (${pct.toFixed(2)}%)`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: "Flujo migratorio entre zonas",
                            color: axisTextColor,
                            font: axisTitleFont,
                            padding: { top: 12 }
                        },
                        ticks: {
                            autoSkip: false,
                            maxRotation: 0,
                            minRotation: 0,
                            color: axisTextColor,
                            padding: 8,
                            font: xAxisTickFont,
                            callback: function (value) {
                                return wrapLabel(this.getLabelForValue(value), isSmallScreen ? 6 : 8);
                            }
                        },
                        grid: { display: false },
                        border: { display: false }
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: "Número de personas",
                            color: axisTextColor,
                            font: axisTitleFont,
                            padding: { bottom: 4 }
                        },
                        ticks: {
                            color: axisTextColor,
                            padding: 8,
                            font: axisTickFont,
                            callback: (value) => Number(value).toLocaleString("es-CO")
                        },
                        grid: {
                            color: "rgba(0, 72, 96, 0.08)",
                            drawBorder: false
                        },
                        border: { display: false },
                        grace: "12%"
                    }
                }
            },
            plugins: [{
                id: "migracionInternaLabels",
                afterDatasetsDraw(chart) {
                    const { ctx, chartArea } = chart;
                    ctx.save();
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.font = `700 ${isVerySmallScreen ? 8 : 9}px ${axisFontFamily}`;

                    const meta = chart.getDatasetMeta(0);
                    meta.data.forEach((bar, index) => {
                        const rawValue = chart.data.datasets[0].data[index];
                        const value = Number(rawValue);
                        if (rawValue === null || rawValue === undefined || !Number.isFinite(value)) return;
                        const text = formatPersons(value);
                        const props = bar.getProps(["x", "y", "base"], true);
                        const barTop = Math.min(props.y, props.base);
                        const barBottom = Math.max(props.y, props.base);
                        const barHeight = Math.abs(barBottom - barTop);
                        const textWidth = ctx.measureText(text).width;
                        const boxPaddingX = 6;
                        const boxWidth = textWidth + boxPaddingX * 2;
                        const boxHeight = 18;
                        const fitsInside = value !== 0 && barHeight >= boxHeight + 12;
                        const labelX = props.x;
                        const labelY = value === 0
                            ? Math.max(chartArea.top + 10, Math.min(chartArea.bottom - 10, props.base - 10))
                            : fitsInside
                            ? barTop + (barHeight / 2)
                            : barTop - 10;

                        if (value !== 0 && !fitsInside && labelY < chartArea.top + 9) {
                            return;
                        }

                        const minBoxX = (chartArea.left || 0) + 2;
                        const maxBoxX = (chartArea.right || minBoxX + boxWidth) - boxWidth - 2;
                        const boxX = Math.max(minBoxX, Math.min(labelX - boxWidth / 2, maxBoxX));
                        const boxY = labelY - boxHeight / 2;
                        ctx.fillStyle = fitsInside ? "rgba(255, 255, 255, 0.92)" : "rgba(255, 255, 255, 0.96)";
                        ctx.strokeStyle = "rgba(0, 72, 96, 0.16)";
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        if (typeof ctx.roundRect === "function") {
                            ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 5);
                        } else {
                            ctx.rect(boxX, boxY, boxWidth, boxHeight);
                        }
                        ctx.fill();
                        ctx.stroke();
                        ctx.fillStyle = axisTextColor;
                        ctx.fillText(text, labelX, labelY + 0.5);
                    });
                    ctx.restore();
                }
            }]
        });
    }

    function crearGraficaAutoreconocimientoLegacy(labels, data, ctx_parent) {
        const canvas = document.getElementById("aeChart");
        if (!canvas) return;
        const isSmallScreen = window.innerWidth <= 768;
        const ctx = canvas.getContext("2d");
        if (aeChartInstance) aeChartInstance.destroy();
        const newLabels = labels.map(l => l.replace('No. ', '').replace('Personas ', ''));
        aeChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: newLabels,
                datasets: [{
                    label: 'Número de personas',
                    data: data,
                    backgroundColor: [
                        "#d34a27", // Indígena (orange-ish)
                        "#2edf2e", // Afrodescendiente (brown-ish)
                        "#8e44ad", // Gitana (purple)
                        "#16a085", // Raizal (teal)
                        "#f1c40f"  // Palenquera (yellow)
                    ],
                    borderWidth: 1,
                    borderColor: "#ffffff"
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: {
                        left: isSmallScreen ? 8 : 18,
                        right: 12,
                        top: 8,
                        bottom: 8
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom', // Pone la leyenda en la parte inferior
                        labels: {
                            // Genera la leyenda basándose en cada barra individual en lugar del dataset completo
                            generateLabels: (chart) => {
                                const data = chart.data;
                                if (data.labels.length && data.datasets.length) {
                                    const dataset = data.datasets[0];
                                    return data.labels.map((label, i) => {
                                        let newLabel = label.replace('No. ', '').replace('Personas ', '');
                                        return {
                                            text: newLabel,
                                            fillStyle: dataset.backgroundColor[i],
                                            strokeStyle: dataset.borderColor || '#fff',
                                            lineWidth: dataset.borderWidth || 1,
                                            hidden: !chart.getDataVisibility(i),
                                            index: i
                                        };
                                    });
                                }
                                return [];
                            }
                        },
                        // Al hacer clic en la leyenda, se oculta/muestra la barra correspondiente
                        onClick: (e, legendItem, legend) => {
                            const index = legendItem.index;
                            const chart = legend.chart;
                            chart.toggleDataVisibility(index);
                            chart.update();
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                return ` ${context.dataset.label}: ${context.raw.toLocaleString('es-CO')}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Número de personas'
                        },
                        ticks: {
                            callback: (v) => v.toLocaleString('es-CO')
                        }, grace: '10%'
                    },
                    x: {
                        ticks: {
                            autoSkip: false,
                            maxRotation: 45,
                            minRotation: 0
                        }
                    }
                },
                onClick: (evt, elements) => {
                    if (!elements.length) return;
                    const where = whereBase;
                    applyWhereToActiveLayers(where);
                    layerGlobal?.queryExtent({ where }).then(res => {
                        if (res?.extent) view.goTo(res.extent.expand(1.3));
                    });
                }
            },
            plugins: [{
                id: 'barLabels',
                afterDatasetsDraw(chart) {
                    const { ctx } = chart;
                    ctx.save();
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'bottom';
                    ctx.font = 'bold 11px sans-serif';
                    ctx.fillStyle = '#333';
                    chart.data.datasets.forEach((dataset, i) => {
                        const meta = chart.getDatasetMeta(i);
                        meta.data.forEach((bar, index) => {
                            const val = dataset.data[index];
                            if (val === null || val === undefined) return;
                            // Formatear el número con los puntos de miles
                            const text = val.toLocaleString('es-CO');
                            // Dibujar el texto centrado en la coordenada X de la barra 
                            // y un poco más arriba de la coordenada Y (bar.y - 5)
                            ctx.fillText(text, bar.x, bar.y - 5);
                        });
                    });
                    ctx.restore();
                }
            }]
        });

        canvas.style.height = `400px`;
    }

    function crearGraficaAutoreconocimiento(labels, data, ctx_parent) {
        const canvas = document.getElementById("aeChart");
        if (!canvas) return;

        const screenWidth = window.innerWidth || 1200;
        const isSmallScreen = screenWidth <= 768;
        const isVerySmallScreen = screenWidth <= 480;
        const ctx = canvas.getContext("2d");
        if (aeChartInstance) aeChartInstance.destroy();

        const normalizeEthnicLabel = (value) => String(value || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase();
        const newLabels = labels.map(label => {
            const cleanLabel = String(label || "").replace("No. ", "").replace("Personas ", "").trim();
            const normalized = normalizeEthnicLabel(cleanLabel);
            if (normalized.includes("indig")) return "Indígenas";
            if (normalized.includes("afro")) return "Afrodescendientes";
            if (normalized.includes("git")) return "Gitanas";
            if (normalized.includes("raiz")) return "Raizales";
            if (normalized.includes("palen")) return "Palenqueras";
            return cleanLabel;
        });
        const chartLabels = newLabels.map(label => wrapLabel(label, isSmallScreen ? 12 : 16));
        const maxValue = Math.max(...data.map(value => Number(value) || 0), 0);
        const suggestedMax = maxValue > 0 ? maxValue * 1.18 : 1;
        const ethnicColors = ["#C86A2A", "#3F8A4D", "#8E5AA9", "#0F8F88", "#D7A61F"];
        const formatPersons = (value) => Number(value || 0).toLocaleString("es-CO");
        const axisTextColor = "#4c4c4c";
        const axisFontFamily = "'Segoe UI', 'Outfit', sans-serif";
        const axisTitleFont = {
            family: axisFontFamily,
            size: isVerySmallScreen ? 9 : 10,
            weight: "600"
        };
        const axisTickFont = {
            family: axisFontFamily,
            size: isVerySmallScreen ? 9 : 10,
            weight: "600"
        };

        aeChartInstance = new Chart(ctx, {
            type: "bar",
            data: {
                labels: chartLabels,
                datasets: [{
                    label: "Número de personas",
                    data,
                    backgroundColor: ethnicColors,
                    borderColor: ethnicColors,
                    borderWidth: 0,
                    borderRadius: 8,
                    borderSkipped: false,
                    barPercentage: isSmallScreen ? 0.56 : 0.62,
                    categoryPercentage: isSmallScreen ? 0.64 : 0.7,
                    hoverBorderColor: "rgba(0, 84, 112, 0.85)",
                    hoverBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 420,
                    easing: "easeOutQuart"
                },
                interaction: {
                    mode: "nearest",
                    intersect: true
                },
                layout: {
                    padding: {
                        left: isSmallScreen ? 8 : 18,
                        right: isSmallScreen ? 12 : 22,
                        top: 24,
                        bottom: isSmallScreen ? 8 : 12
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: "bottom",
                        labels: {
                            boxWidth: 12,
                            boxHeight: 12,
                            color: "#465a63",
                            padding: 14,
                            font: {
                                family: "'Segoe UI', 'Outfit', sans-serif",
                                size: isVerySmallScreen ? 9 : 10,
                                weight: "600"
                            },
                            usePointStyle: true,
                            pointStyle: "rectRounded",
                            generateLabels: (chart) => {
                                const dataset = chart.data.datasets?.[0];
                                if (!dataset) return [];
                                return newLabels.map((label, index) => ({
                                    text: label,
                                    fillStyle: dataset.backgroundColor[index],
                                    strokeStyle: dataset.backgroundColor[index],
                                    lineWidth: 0,
                                    hidden: !chart.getDataVisibility(index),
                                    index
                                }));
                            }
                        },
                        onClick: (event, legendItem, legend) => {
                            const index = legendItem.index;
                            const chart = legend.chart;
                            chart.toggleDataVisibility(index);
                            chart.update();
                        }
                    },
                    tooltip: {
                        backgroundColor: "rgba(0, 72, 96, 0.94)",
                        titleColor: "#ffffff",
                        bodyColor: "#ffffff",
                        borderColor: "rgba(255, 255, 255, 0.22)",
                        borderWidth: 1,
                        cornerRadius: 8,
                        padding: 10,
                        displayColors: true,
                        boxPadding: 4,
                        callbacks: {
                            title: (items) => {
                                const index = items?.[0]?.dataIndex ?? 0;
                                return newLabels[index] || "";
                            },
                            label: (context) => ` ${context.dataset.label}: ${formatPersons(context.raw)}`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        suggestedMax,
                        title: {
                            display: true,
                            text: "Número de personas",
                            color: axisTextColor,
                            font: axisTitleFont,
                            padding: { bottom: 4 }
                        },
                        ticks: {
                            color: axisTextColor,
                            padding: 8,
                            font: axisTickFont,
                            callback: (value) => Number(value).toLocaleString("es-CO")
                        },
                        grid: {
                            color: "rgba(0, 72, 96, 0.08)",
                            drawBorder: false
                        },
                        border: { display: false },
                        grace: "10%"
                    },
                    x: {
                        title: {
                            display: true,
                            text: "Población étnica",
                            color: axisTextColor,
                            font: axisTitleFont,
                            padding: { top: 12 }
                        },
                        ticks: {
                            autoSkip: false,
                            maxRotation: 0,
                            minRotation: 0,
                            color: axisTextColor,
                            padding: 10,
                            font: axisTickFont
                        },
                        grid: { display: false },
                        border: { display: false }
                    }
                },
                onClick: (evt, elements) => {
                    if (!elements.length) return;
                    const where = whereBase;
                    applyWhereToActiveLayers(where);
                    layerGlobal?.queryExtent({ where }).then(res => {
                        if (res?.extent) view.goTo(res.extent.expand(1.3));
                    });
                }
            },
            plugins: [{
                id: "barLabels",
                afterDatasetsDraw(chart) {
                    const { ctx, chartArea } = chart;
                    ctx.save();
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.font = `700 ${isVerySmallScreen ? 9 : 10}px ${axisFontFamily}`;
                    chart.data.datasets.forEach((dataset, datasetIndex) => {
                        const meta = chart.getDatasetMeta(datasetIndex);
                        meta.data.forEach((bar, index) => {
                            const rawValue = dataset.data[index];
                            const val = Number(rawValue);
                            if (rawValue === null || rawValue === undefined || !Number.isFinite(val)) return;

                            const props = bar.getProps(["x", "y", "base"], true);
                            const barTop = Math.min(props.y, props.base);
                            const barBase = Math.max(props.y, props.base);
                            const barHeight = Math.abs(barBase - barTop);
                            const text = formatPersons(val);
                            const textWidth = ctx.measureText(text).width;
                            const boxPaddingX = 6;
                            const boxWidth = textWidth + boxPaddingX * 2;
                            const boxHeight = 18;
                            const labelFitsInside = val !== 0 && barHeight >= boxHeight + 10;
                            const labelY = val === 0
                                ? Math.max(chartArea.top + 10, Math.min(chartArea.bottom - 10, props.base - 10))
                                : labelFitsInside
                                ? barTop + (barHeight / 2)
                                : Math.max(chartArea.top + 10, barTop - 10);

                            const minBoxX = (chartArea.left || 0) + 2;
                            const maxBoxX = (chartArea.right || minBoxX + boxWidth) - boxWidth - 2;
                            const boxX = Math.max(minBoxX, Math.min(props.x - boxWidth / 2, maxBoxX));
                            const boxY = labelY - boxHeight / 2;
                            ctx.fillStyle = labelFitsInside ? "rgba(255, 255, 255, 0.9)" : "rgba(255, 255, 255, 0.96)";
                            ctx.strokeStyle = "rgba(0, 72, 96, 0.16)";
                            ctx.lineWidth = 1;
                            ctx.beginPath();
                            if (typeof ctx.roundRect === "function") {
                                ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 5);
                            } else {
                                ctx.rect(boxX, boxY, boxWidth, boxHeight);
                            }
                            ctx.fill();
                            ctx.stroke();
                            ctx.fillStyle = axisTextColor;
                            ctx.fillText(text, props.x, labelY + 0.5);
                        });
                    });
                    ctx.restore();
                }
            }]
        });

        canvas.style.height = `${isSmallScreen ? 380 : 420}px`;
    }

    function crearGraficaCondicionesSeguridad(labels, data, ctx_parent) {
        const canvas = document.getElementById("csChart");
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (csgChartInstance) csgChartInstance.destroy();
        const screenWidth = window.innerWidth || 1200;
        const isSmallScreen = screenWidth <= 768;
        const isVerySmallScreen = screenWidth <= 480;
        const axisFontFamily = "'Segoe UI', 'Outfit', sans-serif";
        const normalizedLabels = labels.map(label => Array.isArray(label) ? label.join(" ") : String(label || ""));
        const chartLabels = normalizedLabels.map(label => wrapLabel(label, isVerySmallScreen ? 10 : isSmallScreen ? 12 : 14));
        const maxValue = Math.max(...data.map(value => Number(value) || 0), 0);
        const suggestedMax = maxValue > 0 ? Math.max(1, maxValue * 1.18) : 1;
        const formatScore = (value) => {
            const numeric = Number(value) || 0;
            return numeric >= 10
                ? numeric.toLocaleString("es-CO", { maximumFractionDigits: 1 })
                : numeric.toLocaleString("es-CO", { maximumFractionDigits: 2 });
        };
        const pointLabelFontSize = isVerySmallScreen ? 7 : isSmallScreen ? 8 : 8;
        const pointLabelLineHeight = Math.round(pointLabelFontSize * 1.22);
        const condicionesPointLabelsPlugin = {
            id: "condicionesSeguridadCenteredPointLabels",
            afterDraw(chart) {
                const scale = chart.scales?.r;
                if (!scale) return;
                const { ctx, chartArea } = chart;
                const labelRadius = (scale.drawingArea || 0) + (isSmallScreen ? 15 : 18);

                ctx.save();
                ctx.font = `700 ${pointLabelFontSize}px ${axisFontFamily}`;
                ctx.fillStyle = "#344b55";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";

                chartLabels.forEach((label, index) => {
                    const lines = Array.isArray(label) ? label : [String(label || "")];
                    let position;
                    if (typeof scale.getPointPosition === "function") {
                        position = scale.getPointPosition(index, labelRadius);
                    } else {
                        const angle = (-Math.PI / 2) + ((Math.PI * 2) / Math.max(chartLabels.length, 1)) * index;
                        position = {
                            x: scale.xCenter + Math.cos(angle) * labelRadius,
                            y: scale.yCenter + Math.sin(angle) * labelRadius
                        };
                    }

                    const textWidth = Math.max(...lines.map(line => ctx.measureText(line).width), 0);
                    const totalHeight = lines.length * pointLabelLineHeight;
                    const centerX = Math.max(
                        (chartArea.left || 0) + textWidth / 2 + 2,
                        Math.min(position.x, (chartArea.right || position.x) - textWidth / 2 - 2)
                    );
                    const centerY = Math.max(
                        (chartArea.top || 0) + totalHeight / 2 + 2,
                        Math.min(position.y, (chartArea.bottom || position.y) - totalHeight / 2 - 2)
                    );
                    const firstLineY = centerY - ((lines.length - 1) * pointLabelLineHeight) / 2;

                    lines.forEach((line, lineIndex) => {
                        ctx.fillText(line, centerX, firstLineY + lineIndex * pointLabelLineHeight);
                    });
                });

                ctx.restore();
            }
        };

        csgChartInstance = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: chartLabels,
                datasets: [{
                    label: 'Puntaje',
                    data: data,
                    backgroundColor: 'transparent',
                    borderColor: '#ed7d31',
                    borderWidth: 2,
                    pointBackgroundColor: '#ed7d31',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: '#ed7d31'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: {
                        left: isSmallScreen ? 18 : 24,
                        right: isSmallScreen ? 18 : 24,
                        top: isSmallScreen ? 2 : 4,
                        bottom: isSmallScreen ? 14 : 18
                    }
                },
                plugins: {
                    legend: {
                        display: false // Title is enough, single dataset
                    },
                    tooltip: {
                        backgroundColor: "rgba(0, 72, 96, 0.94)",
                        titleColor: "#ffffff",
                        bodyColor: "#ffffff",
                        borderColor: "rgba(255, 255, 255, 0.22)",
                        borderWidth: 1,
                        cornerRadius: 8,
                        padding: 10,
                        callbacks: {
                            title: function (items) {
                                const index = items?.[0]?.dataIndex ?? 0;
                                return normalizedLabels[index] || "";
                            },
                            label: function (context) {
                                return ` ${context.dataset.label}: ${formatScore(context.raw)}`;
                            }
                        }
                    }
                },
                scales: {
                    r: {
                        beginAtZero: true,
                        suggestedMax,
                        angleLines: {
                            display: true,
                            color: "rgba(0, 72, 96, 0.12)"
                        },
                        grid: {
                            color: "rgba(0, 72, 96, 0.10)"
                        },
                        pointLabels: {
                            color: "rgba(52, 75, 85, 0)",
                            textAlign: "center",
                            padding: isSmallScreen ? 6 : 8,
                            font: {
                                family: axisFontFamily,
                                size: pointLabelFontSize,
                                weight: "700",
                                lineHeight: 1.18
                            },
                            callback: function (_, index) {
                                return chartLabels[index] || "";
                            }
                        },
                        ticks: {
                            backdropColor: 'transparent',
                            backdropPadding: 2,
                            color: "#60737b",
                            showLabelBackdrop: false,
                            maxTicksLimit: 5,
                            font: {
                                family: axisFontFamily,
                                size: isVerySmallScreen ? 8 : 9,
                                weight: "600"
                            },
                            callback: (value) => formatScore(value)
                        },
                        border: {
                            color: "rgba(0, 72, 96, 0.16)"
                        }
                    }
                }
            },
            plugins: [condicionesPointLabelsPlugin]
        });

        const chartHeight = isVerySmallScreen ? 380 : isSmallScreen ? 410 : 430;
        canvas.style.height = `${chartHeight}px`;
        canvas.style.minHeight = `${chartHeight}px`;
        canvas.style.maxHeight = `${chartHeight}px`;
    }

    function crearGraficaComposicion(labels, datasets, axisTitles, ctx_parent) {
        const canvas = showMainChartCanvasForRender();
        if (!canvas) return;
        canvas.closest(".chart-card")?.classList.add("composicion-chart-active");
        const ctx = canvas.getContext("2d");
        if (chartInstance) chartInstance.destroy();

        const screenW = window.innerWidth || 1200;
        const isSmallScreen = screenW <= 768;
        const isVerySmallScreen = screenW <= 480;
        const normalizedLabels = labels.map(label => Array.isArray(label) ? label.join(" ") : String(label));
        const styledDatasets = datasets.map(dataset => ({
            ...dataset,
            borderWidth: 0,
            borderColor: "rgba(255, 250, 240, 0.82)",
            borderRadius: 0,
            borderSkipped: false,
            barThickness: isVerySmallScreen ? 8 : isSmallScreen ? 9 : 10,
            maxBarThickness: isVerySmallScreen ? 9 : isSmallScreen ? 10 : 11,
            barPercentage: 0.9,
            categoryPercentage: 0.72,
            hoverBorderColor: "rgba(0, 74, 105, 0.75)",
            hoverBorderWidth: 1
        }));

        // Calcular totales por zona para los porcentajes en tooltip
        const totalsByZone = labels.map((_, i) => {
            return datasets.reduce((sum, ds) => sum + (ds.data[i] || 0), 0);
        });

        const composicionZoneSeparatorPlugin = {
            id: "composicionZoneSeparators",
            beforeDatasetsDraw(chart) {
                const { ctx, chartArea, scales } = chart;
                const yScale = scales?.y;
                if (!ctx || !chartArea || !yScale || !Array.isArray(chart.data.labels)) return;

                ctx.save();
                chart.data.labels.forEach((_, index) => {
                    const center = yScale.getPixelForValue(index);
                    const next = index < chart.data.labels.length - 1
                        ? yScale.getPixelForValue(index + 1)
                        : chartArea.bottom + (center - yScale.getPixelForValue(index - 1 || 0));
                    const prev = index > 0
                        ? yScale.getPixelForValue(index - 1)
                        : chartArea.top - (next - center);
                    const bandTop = Math.max(chartArea.top, (prev + center) / 2);
                    const bandBottom = Math.min(chartArea.bottom, (center + next) / 2);

                    if (index % 2 === 0) {
                        ctx.fillStyle = "rgba(0, 74, 105, 0.018)";
                        ctx.fillRect(chartArea.left, bandTop, chartArea.right - chartArea.left, bandBottom - bandTop);
                    }

                    if (index > 0) {
                        ctx.beginPath();
                        ctx.moveTo(chartArea.left, bandTop);
                        ctx.lineTo(chartArea.right, bandTop);
                        ctx.strokeStyle = "rgba(0, 74, 105, 0.08)";
                        ctx.lineWidth = 1;
                        ctx.stroke();
                    }
                });
                ctx.restore();
            }
        };

        const isCompactScreen = screenW <= 1024;
        const chartHeight = isCompactScreen
            ? Math.min(430, Math.max(310, 260 + (normalizedLabels.length * 48)))
            : 470;
        canvas.style.setProperty("height", `${chartHeight}px`, "important");
        canvas.style.setProperty("min-height", `${chartHeight}px`, "important");
        canvas.style.setProperty("max-height", `${chartHeight}px`, "important");
        canvas.setAttribute("height", String(chartHeight));

        chartInstance = new Chart(ctx, {
            type: 'bar',
            data: { labels: normalizedLabels, datasets: styledDatasets },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 420,
                    easing: "easeOutQuart"
                },
                interaction: {
                    mode: "nearest",
                    intersect: true
                },
                layout: {
                    padding: {
                        top: 12,
                        right: isSmallScreen ? 16 : 26,
                        bottom: 12,
                        left: isSmallScreen ? 8 : 12
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: {
                            boxWidth: 10,
                            boxHeight: 10,
                            padding: isSmallScreen ? 8 : 12,
                            color: "#4f4f4f",
                            font: {
                                family: "'Segoe UI', 'Outfit', sans-serif",
                                size: isVerySmallScreen ? 9 : 10,
                                weight: "500"
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: "rgba(0, 72, 96, 0.94)",
                        titleColor: "#ffffff",
                        bodyColor: "#ffffff",
                        borderColor: "rgba(255, 255, 255, 0.22)",
                        borderWidth: 1,
                        cornerRadius: 8,
                        padding: 10,
                        displayColors: true,
                        boxPadding: 4,
                        callbacks: {
                            title: function (items) {
                                const label = items?.[0]?.label || "";
                                return Array.isArray(label) ? label.join(" ") : String(label);
                            },
                            label: function (context) {
                                const val = context.raw || 0;
                                const zoneIdx = context.dataIndex;
                                const total = totalsByZone[zoneIdx] || 1;
                                const pct = (val * 100 / total).toFixed(1);
                                return `${context.dataset.label}: ${Number(val).toLocaleString("es-CO")} (${pct}%)`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        stacked: false,
                        title: {
                            display: true,
                            text: axisTitles.xTitle,
                            color: "#4c4c4c",
                            font: {
                                family: "'Segoe UI', 'Outfit', sans-serif",
                                size: 11,
                                weight: "600"
                            },
                            padding: { top: 10 }
                        },
                        beginAtZero: true,
                        ticks: {
                            color: "#5f5f5f",
                            padding: 6,
                            font: {
                                family: "'Segoe UI', 'Outfit', sans-serif",
                                size: isVerySmallScreen ? 9 : 10
                            },
                            callback: value => Number(value).toLocaleString("es-CO")
                        },
                        grid: {
                            color: "rgba(0, 72, 96, 0.08)",
                            drawBorder: false
                        },
                        border: { display: false }
                    },
                    y: {
                        stacked: false,
                        title: {
                            display: true,
                            text: axisTitles.yTitle,
                            color: "#4c4c4c",
                            font: {
                                family: "'Segoe UI', 'Outfit', sans-serif",
                                size: 11,
                                weight: "600"
                            },
                            padding: { bottom: 8 }
                        },
                        ticks: {
                            autoSkip: false,
                            color: "#4f4f4f",
                            padding: 8,
                            font: {
                                family: "'Segoe UI', 'Outfit', sans-serif",
                                size: isVerySmallScreen ? 9 : 10,
                                weight: "600"
                            },
                            callback: function (value) {
                                return wrapLabel(this.getLabelForValue(value), isSmallScreen ? 14 : 18);
                            }
                        },
                        grid: { display: false },
                        border: { display: false }
                    }
                },
                onClick: (evt, elements) => {
                    if (!elements.length) return;
                    const el = elements[0];
                    const zoneLabel = labels[el.index];
                    const datasetKeys = ocupacionGlobal("ordenComposicion") || ["amf", "amm", "af", "am", "jf", "jm", "nf", "nm"];
                    const fieldKey = datasetKeys[el.datasetIndex];
                    if (!fieldKey) return;

                    applyComposicionChartSelection(fieldKey, zoneLabel).catch(error => {
                        console.warn("applyComposicionChartSelection error:", error);
                    });
                }
            },
            plugins: [composicionZoneSeparatorPlugin]
        });

        // Ajustar altura dinámica para que las barras agrupadas no se vean amontonadas
        chartInstance.resize();
    }

    function crearGraficaTasaCrecimiento(labels, data, ctx_parent) {
        const canvas = document.getElementById("tcChart");
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        if (tcChartInstance) tcChartInstance.destroy();

        const primaryColor = "#0974b6"; // IGAC Blue
        const secondaryColor = "#b4d79e"; // From renderer green
        canvas.style.height = "380px";

        tcChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Población DANE',
                    data: data,
                    borderColor: primaryColor,
                    backgroundColor: primaryColor,
                    pointBackgroundColor: [secondaryColor, primaryColor],
                    pointRadius: 8,
                    pointHoverRadius: 10,
                    tension: 0.1,
                    fill: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                return `Población: ${context.raw.toLocaleString()}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: "Población DANE 2018 vs 2005",
                            color: "#4c4c4c",
                            font: {
                                family: "'Segoe UI', 'Outfit', sans-serif",
                                size: 11,
                                weight: "normal"
                            }
                        }
                    },
                    y: {
                        beginAtZero: false,
                        title: {
                            display: true,
                            text: "Población total",
                            color: "#4c4c4c",
                            font: {
                                family: "'Segoe UI', 'Outfit', sans-serif",
                                size: 11,
                                weight: "normal"
                            }
                        },
                        ticks: {
                            callback: (v) => v.toLocaleString()
                        }
                    }
                },
                onClick: (evt, elements) => {
                    if (!elements.length) return;
                    const el = elements[0];
                    const yearIdx = el.index;
                    const year = labels[yearIdx];

                    // Zoom y Resaltado
                    const where = whereBase;
                    applyWhereToActiveLayers(where);
                    layerGlobal?.queryExtent({ where }).then(res => {
                        if (res?.extent) view.goTo(res.extent.expand(1.3));
                    });

                    // Mostrar información detallada (opcional: abrir popup)
                    view.openPopup({
                        location: view.center,
                        title: `Población ${year}`,
                        content: `Municipio: ${ctx_parent.diccionarioMunicipios?.[ctx_parent.municipioActual] || ctx_parent.municipioActual}<br>Población DANE ${year}: ${data[yearIdx].toLocaleString()}`
                    });
                }
            }
        });
    }




    async function actualizarGrafica(layer, config, options = {}) {
        const ctx = buildCtx(layer, config, options);

        if (!ctx.skipSyncMap) {
            await syncMapLayer(ctx);
        }

        // El usuario pudo cambiar de seccion mientras el mapa se sincronizaba.
        // Una respuesta anterior nunca debe ejecutar el handler del menu previo.
        const activeConfig = getActiveLayerConfig();
        if (ctx.cycleId !== renderCycleId || activeConfig?.id !== ctx.config?.id) return;

        for (const h of getHandlers()) {
            if (h.when(ctx)) {
                await h.run(ctx);
                if (filtroNivel === "DEPTO" && !municipioActual && !ctx.config?.isConcentracionPoblacion) {
                    actualizarResumen();
                }
                return;
            }
        }
    }
    window.actualizarGrafica = actualizarGrafica;

    function applyWhereToActiveLayers(where) {
        let finalWhere = where;
        const config = getActiveLayerConfig();

        if (config && config.id === "densidad_poblacion" && filtroNivel === "DEPTO" && !municipioActual && deptoActual && finalWhere && finalWhere.includes("mpcodigo =")) {
            finalWhere = finalWhere.replace(/mpcodigo\s*=\s*'[^']+'/, `dpcodigo = '${deptoActual}'`);
        }
        state.set("activeFilter", finalWhere || "");

        // si estás en cuencas (3 capas), aplica a todas
        if (layersGlobal.length) {
            layersGlobal.forEach(l => {
                l.definitionExpression = finalWhere;
                try { l.refresh?.(); } catch (_) { }
            });
            return;
        }
        if (layerGlobal) {
            layerGlobal.definitionExpression = finalWhere;
            try { layerGlobal.refresh?.(); } catch (_) { }
        }
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

    function filtrarPorAtributo(val) {
        const config = getActiveLayerConfig();
        if (!config) return;

        let where = "";

        if (config.isDistribucion) {
            const tznCode = (typeof densidadLabelToTzn !== "undefined")
                ? densidadLabelToTzn[val]
                : { "Cabecera Municipal": 1, "Centros Poblados": 2, "Rural Disperso": 3 }[val];

            if (tznCode != null) {
                where = whereBase
                    ? `${whereBase} AND tzn = ${tznCode}`
                    : `tzn = ${tznCode}`;
            }

        } else if (config.isPropiedadRural) {
            const domainCodes = {
                "Microfundio": 1,
                "Minifundio": 2,
                "Pequeña propiedad": 3,
                "Mediana propiedad": 4,
                "Gran propiedad": 5
            };
            const code = domainCodes[val];
            if (code != null) {
                where = `${whereBase} AND tprpesp = ${code}`;
            }

        } else if (config.isComposicion) {
            const tznCode = { "Cabecera": 1, "Centro poblado": 2, "Rural": 3 }[val];
            if (tznCode != null) {
                where = `${whereBase} AND tzn = ${tznCode}`;
            }
        }

        //  aplicar + zoom
        if (layerGlobal && where) {
            applyWhereToActiveLayers(where);

            // usa la capa visible real para extent
            const extentLayer = layerGlobal; // (en tu caso BF3 no son variants)
            extentLayer.queryExtent({ where }).then(res => {
                if (res.extent) view.goTo(res.extent.expand(1.3));
            });
            syncLegendToLabelSelection(val);

        }
    }

    const btnVerTodo = document.getElementById("btnVerTodo");
    if (btnVerTodo) {
        btnVerTodo.onclick = async () => {
            if (!layerGlobal) return;

            await clearLegendSelection({ zoom: false });
            applyWhereToActiveLayers(whereBase);
            updateLegendByExtent?.(layerGlobal, getActiveLayerConfig());

            layerGlobal.queryExtent({ where: layerGlobal.definitionExpression }).then(res => {
                if (res.extent) view.goTo(res.extent.expand(1.2));
            });
        };
    }


    function resolveOcupacionModeFromTab(tabUrl) {
        return ModeConfig.fromTabLabel(tabUrl);
    }

    function applyOcupacionTabFromUrl(tabUrl) {
        const mode = resolveOcupacionModeFromTab(tabUrl);
        if (mode && typeof window.setMode === "function") {
            window.setMode(mode);
        }
    }

    // Inicialización diferida: evita usar constantes de Contexto Histórico antes
    // de que el módulo termine de declararlas en el navegador.
    init();

    const urlContext = ModuleNavigation.parseComponentUrlParams();

    ModuleNavigation.applyTerritorySelectionFromUrl({
        onTab(tabUrl) {
            if (!urlContext.municipioId && !urlContext.deptoId) {
                applyOcupacionTabFromUrl(tabUrl);
            }
        },
        onApplied({ tab }) {
            if (tab) {
                applyOcupacionTabFromUrl(tab);
            }
        },
        prepareTerritorySelection({ municipioId, deptoId, selectDepto, selectMuni }) {
            if (deptoId && Array.from(selectDepto?.options || []).some(option => option.value === deptoId)) {
                renderizarMunicipios(deptoId);
                return;
            }

            if (municipioId && !Array.from(selectMuni?.options || []).some(option => option.value === municipioId)) {
                renderizarMunicipios();
            }
        }
    });

    // Función para redirigir manteniendo el contexto territorial
    window.redirigir = function (e) {
        e.preventDefault();
        const link = e.currentTarget;
        const href = link.getAttribute("href");
        const territory = ModuleNavigation.getTerritoryFromSelects(
            document.getElementById("departamentos"),
            document.getElementById("municipios")
        );

        window.location.href = ModuleNavigation.mergeHrefWithTerritory(href, territory);
    };

});
