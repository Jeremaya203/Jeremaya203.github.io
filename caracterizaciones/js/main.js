import {
    buildWhereBase,
    buildDefinitionExpression,
    buildExtraWhere
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
    updateMapViewBadge,
    setLegendLayerTitle,
    clearLegend,
    setSummaryText
} from "./ui/ui.helpers.js";
import {
    destroyLayerSafe,
    pickLayerByScale,
    getGeoformasScaleTitle
} from "./map/map.helpers.js";
import { 
    AppState 
} from "./app/state.js";
import { clearLayers as clearMapLayers } from "./map/layers.js";
import {
    zoomToLayerObjectId,
    resetToColombia
} from "./map/zoom.js";
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
} from "./config.js";

import {
    debounce,
    toNum,
    pctOfTotal,
    wrapLabel,
    escapeSqlString,
    ordenarMeses,
    rgbaFromEsriColor,
    rgbaFromEsriColorArr,
    normKey
} from "./utils.js";
import {
    arcRestQuery,
    fetchBF3Stats,
    fetchGroupedStats
} from "./data.js";
import {
    buildLegendFromRenderer,
    // actualizarLeyenda,
    getSymbolColorRGBA,
    syncLegendToLabelSelection,
    sortLegendEntries
} from "./legend.js";
import { createChart, destroyChart } from "./charts/chart-core.js";
import { registerHandler, getRegisteredHandlers } from "./charts/handler-registry.js";
import "./charts/relief/hypsometry.chart.js";

const SQL_NUMBER_RE = /^-?\d+(\.\d+)?$/;
const SAFE_COLOR_RE = /^(#(?:[0-9a-f]{3,8})|rgba?\([\d\s.,%+-]+\)|hsla?\([\d\s.,%+-]+\)|[a-zA-Z]+)$/;

function escapeHtml(value, fallback = "—") {
    if (value === null || value === undefined || value === "") return fallback;
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function escapeAttr(value, fallback = "") {
    return escapeHtml(value, fallback);
}

function normalizeCode(value) {
    return String(value ?? "").trim();
}

function sqlLiteral(value, type = "string") {
    if (value === null || value === undefined) return null;

    const s = String(value).replace(/\u0000/g, "").trim();

    if (!s || s.toLowerCase() === "null" || s.toLowerCase() === "nan") {
        return null;
    }

    if (type === "number") {
        const n = Number(s);
        return Number.isFinite(n) ? String(n) : null;
    }

    return `'${s.replace(/'/g, "''")}'`;
}

function sqlEquals(field, value, options = {}) {
    const literal = sqlLiteral(value, options.type || "string");
    return literal === null ? `${field} IS NULL` : `${field} = ${literal}`;
}

function sqlEqualsNumber(field, value) {
    return sqlEquals(field, value, { type: "number" });
}

function sqlStartsWith(field, prefix) {
    const s = String(prefix ?? "").replace(/\u0000/g, "").trim();

    if (!s) return "1=1";

    return `${field} LIKE '${s.replace(/'/g, "''")}%'`;
}

function andWhere(baseWhere, clause) {
    const base = baseWhere && String(baseWhere).trim()
        ? String(baseWhere).trim()
        : "1=1";

    return clause ? `${base} AND ${clause}` : base;
}

function safeCssColor(value, fallback = "#999") {
    const s = String(value ?? "").trim();
    return SAFE_COLOR_RE.test(s) ? s : fallback;
}

let sliderMode = "zoom"; // "zoom" | "time"

function syncStateFromGlobals() {
    AppState.currentMode = currentMode;
    AppState.currentMainModule = currentMainModule;

    AppState.map = map;
    AppState.view = view;
    AppState.layerGlobal = layerGlobal;
    AppState.layerViewGlobal = layerViewGlobal;
    AppState.layersGlobal = layersGlobal;
    AppState.chartLayerGlobal = chartLayerGlobal;
    AppState.stationsLayer = stationsLayer;

    AppState.whereBase = whereBase;
    AppState.municipioActual = municipioActual;
    AppState.deptoActual = deptoActual;
    AppState.filtroNivel = filtroNivel;

    AppState.currentSubLayerIndex = currentSubLayerIndex;

    AppState.chartInstance = chartInstance;
    AppState.geoPieChartInstance = geoPieChartInstance;
    AppState.geoDonutChartInstance = geoDonutChartInstance;

    AppState.diccionarioMunicipios = diccionarioMunicipios;
    AppState.diccionarioDepartamentos = diccionarioDepartamentos;
    AppState.todosMunicipios = todosMunicipios;

    AppState.renderCycleId = renderCycleId;
    AppState.scaleHandle = scaleHandle;
    AppState.highlightHandle = highlightHandle;
    AppState.lastHoverWhere = lastHoverWhere;
    AppState.legendFilterLabel = legendFilterLabel;

    AppState.updateLegendByExtent = updateLegendByExtent;
}


function clearLayers() {
    syncStateFromGlobals();

    clearMapLayers();

    layerGlobal = AppState.layerGlobal;
    layerViewGlobal = AppState.layerViewGlobal;
    layersGlobal = AppState.layersGlobal;
    chartLayerGlobal = AppState.chartLayerGlobal;
    stationsLayer = AppState.stationsLayer;

    scaleHandle = AppState.scaleHandle;
    highlightHandle = AppState.highlightHandle;
    renderCycleId = AppState.renderCycleId;
    lastHoverWhere = AppState.lastHoverWhere;
    legendFilterLabel = AppState.legendFilterLabel;

    syncStateFromGlobals();
}


function ensureMunicipalLayerIndex(prevId) {
    const list = getLayerListForCurrentLevel(currentMode);

    if (!list || list.length === 0) {
        currentSubLayerIndex = 0;
        return;
    }

    // Normalizar índice
    if (currentSubLayerIndex < 0 || currentSubLayerIndex >= list.length) {
        currentSubLayerIndex = 0;
    }

    // Si veníamos de una capa departamental intentar mapear a municipal
    const mappedId = prevId ? DEPT_TO_MUNI_LAYER_ID[prevId] : null;

    if (mappedId) {
        const idx = list.findIndex(l => l.id === mappedId);
        if (idx !== -1) {
            currentSubLayerIndex = idx;
            return;
        }
    }

    // Protección extra: evitar quedar en una capa departamental
    const cfg = list[currentSubLayerIndex];
    if (cfg && DEPTO_ONLY_LAYER_IDS.has(cfg.id)) {
        currentSubLayerIndex = 0;
    }
}

function getLayerListForCurrentLevel(mode = currentMode) {
    syncStateFromGlobals();
    AppState.currentMode = mode;
    return getLayerListForCurrentLevelFromState(mode);
}


function clampSubLayerIndex() {
const activeList = getLayerListForCurrentLevel();
if (!activeList.length) {
    currentSubLayerIndex = 0;
    return;
}
if (currentSubLayerIndex < 0) currentSubLayerIndex = 0;
if (currentSubLayerIndex >= activeList.length) currentSubLayerIndex = 0;
}

// Estado Global
let currentMode = 'RELIEVE'; // RELIEVE | CLIMA
let currentMainModule = "BIOFISICO";
const STATIONS_LAYER_URL = "https://mapas2.igac.gov.co/server/rest/services/ordenamiento/componentebiofisico/MapServer/11";
let stationsLayer = null;

let currentSubLayerIndex = 0; // Índice dentro del array de configuration
let layerGlobal = null;
let layerViewGlobal = null;
let whereBase = "";
let municipioActual = "";
let chartInstance = null;
let diccionarioMunicipios = {};
let geoPieChartInstance = null;
let geoDonutChartInstance = null;
let geoformasRendererDict = null;
let geoformasPaisajeDict = null;
window.__geoformaSelectedPaisaje = null;
window.__geoformaPairColorMap = {};
window.__geoformaPaisajeColorMap = {};
let diccionarioDepartamentos = {};
let todosMunicipios = []; // Array de {codigo, nombre, depto}
let layersGlobal = []; // para manejar múltiples capas (cuencas)
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
let highlightHandle = null;
let lastHoverWhere = "";
let legendFilterLabel = null; // ej: "Seminatural"
const hoverDebounceMs = 120;

window.__legendState = {
    activeCodes: new Set(),
    field: null,
    layer: null,
    baseWhere: "1=1"
};

function rgbaArrayToCss(arr, fallback = "#999") {
    if (!Array.isArray(arr) || arr.length < 3) return fallback;
    const [r, g, b, a = 255] = arr;
    return `rgba(${r}, ${g}, ${b}, ${a / 255})`;
}

async function ensureRuralCategoriaDict(layerUrl) {
    if (ruralCategoriaDict) return ruralCategoriaDict;

    const url = String(layerUrl).replace(/\/+$/, "") + "?f=pjson";
    const res = await fetch(url);
    const json = await res.json();

    ruralCategoriaDict = {};
    window.__ruralCategoriaColorMap = {};

    const renderer = json?.drawingInfo?.renderer || {};
    const groups = renderer?.uniqueValueGroups || [];
    const infos = renderer?.uniqueValueInfos || [];

    if (groups.length) {
        groups.forEach(group => {
            (group.classes || []).forEach(cls => {
                const vals = cls.values?.[0] || [];
                const code = String(vals[0] ?? "").trim();
                if (!code) return;

                const fill = rgbaArrayToCss(cls?.symbol?.color, "#999");
                const outline = rgbaArrayToCss(cls?.symbol?.outline?.color, "rgba(0,0,0,0)");
                const width = Number(cls?.symbol?.outline?.width ?? 0);
                const label = String(cls.label || cls.description || code).trim();

                ruralCategoriaDict[code] = {
                    code,
                    label,
                    fillColor: fill,
                    outlineColor: outline,
                    outlineWidth: width
                };

                window.__ruralCategoriaColorMap[label] = fill;
            });
        });
    }

    if (!Object.keys(ruralCategoriaDict).length && infos.length) {
        infos.forEach(info => {
            const code = String(info.value ?? "").trim();
            if (!code) return;

            const fill = rgbaArrayToCss(info?.symbol?.color, "#999");
            const outline = rgbaArrayToCss(info?.symbol?.outline?.color, "rgba(0,0,0,0)");
            const width = Number(info?.symbol?.outline?.width ?? 0);
            const label = String(info.label ?? code).trim();

            ruralCategoriaDict[code] = {
                code,
                label,
                fillColor: fill,
                outlineColor: outline,
                outlineWidth: width
            };

            window.__ruralCategoriaColorMap[label] = fill;
        });
    }

    return ruralCategoriaDict;
}

async function ensureGeoformasDict() {
    if (geoformasRendererDict && geoformasPaisajeDict) return;

    const urlPaisaje = "https://mapas2.igac.gov.co/server/rest/services/ordenamiento/componentebiofisico/MapServer/8";
    const urlRelieve = "https://mapas2.igac.gov.co/server/rest/services/ordenamiento/componentebiofisico/MapServer/9";

    const [resPaisaje, resRelieve] = await Promise.all([
        fetch(urlPaisaje + "?f=pjson"),
        fetch(urlRelieve + "?f=pjson")
    ]);

    const [jsonPaisaje, jsonRelieve] = await Promise.all([
        resPaisaje.json(),
        resRelieve.json()
    ]);

    geoformasRendererDict = {};
    geoformasPaisajeDict = {};
    window.__geoformaPairColorMap = {};
    window.__geoformaPaisajeColorMap = {};

    // =========================
    // 1. Diccionario de paisaje desde servicio 8
    // =========================
    const groupsPaisaje = jsonPaisaje?.drawingInfo?.renderer?.uniqueValueGroups || [];

    groupsPaisaje.forEach(group => {
        (group.classes || []).forEach(cls => {
            const vals = cls.values?.[0] || [];
            const paisaje = String(vals[0] ?? "").trim();
            if (!paisaje) return;

            const c = cls?.symbol?.color || [150,150,150,255];
            const color = `rgba(${c[0]},${c[1]},${c[2]},${(c[3] ?? 255) / 255})`;

            const paisajeLabel = String(cls.label || cls.description || paisaje).trim();

            geoformasPaisajeDict[paisaje] = {
                code: paisaje,
                label: paisajeLabel,
                color
            };

            window.__geoformaPaisajeColorMap[paisajeLabel] = color;
        });
    });

    // =========================
    // 2. Diccionario de combinaciones desde servicio 9
    // =========================
    const groupsRelieve = jsonRelieve?.drawingInfo?.renderer?.uniqueValueGroups || [];

    groupsRelieve.forEach(group => {
        (group.classes || []).forEach(cls => {
            const vals = cls.values?.[0] || [];
            const paisaje = String(vals[0] ?? "").trim();
            const relieve = String(vals[1] ?? "").trim();
            if (!paisaje || !relieve) return;

            const c = cls?.symbol?.color || [150,150,150,255];
            const color = `rgba(${c[0]},${c[1]},${c[2]},${(c[3] ?? 255) / 255})`;

            const labelParts = String(cls.label || "").split(",");
            const paisajeLabel =
                (geoformasPaisajeDict[paisaje]?.label) ||
                (labelParts[0] || paisaje).trim();

            const relieveLabel = (labelParts[1] || relieve).trim();

            geoformasRendererDict[`${paisaje}||${relieve}`] = {
                paisaje,
                relieve,
                paisajeLabel,
                relieveLabel,
                color
            };

            window.__geoformaPairColorMap[`${paisajeLabel}||${relieveLabel}`] = color;

            if (!geoformasPaisajeDict[paisaje]) {
                geoformasPaisajeDict[paisaje] = {
                    code: paisaje,
                    label: paisajeLabel,
                    color
                };
            }

            if (!window.__geoformaPaisajeColorMap[paisajeLabel]) {
                window.__geoformaPaisajeColorMap[paisajeLabel] = geoformasPaisajeDict[paisaje].color || color;
            }
        });
    });
}

async function ensureVocacionDict() {
    if (vocacionRendererDict && vocacionMainDict) return;

    const urlMain = "https://mapas2.igac.gov.co/server/rest/services/ordenamiento/componentebiofisico/MapServer/29";
    const urlDetail = "https://mapas2.igac.gov.co/server/rest/services/ordenamiento/componentebiofisico/MapServer/30";

    const [resMain, resDetail] = await Promise.all([
        fetch(urlMain + "?f=pjson"),
        fetch(urlDetail + "?f=pjson")
    ]);

    const [jsonMain, jsonDetail] = await Promise.all([
        resMain.json(),
        resDetail.json()
    ]);

    vocacionRendererDict = {};
    vocacionMainDict = {};
    window.__vocacionPairColorMap = {};
    window.__vocacionMainColorMap = {};

    // Servicio 29 -> solo vocacion
    const groupsMain = jsonMain?.drawingInfo?.renderer?.uniqueValueGroups || [];
    groupsMain.forEach(group => {
        (group.classes || []).forEach(cls => {
            const vals = cls.values?.[0] || [];
            const vocacion = String(vals[0] ?? "").trim();
            if (!vocacion) return;

            const c = cls?.symbol?.color || [150,150,150,255];
            const color = `rgba(${c[0]},${c[1]},${c[2]},${(c[3] ?? 255) / 255})`;
            const label = String(cls.label || cls.description || vocacion).trim();

            vocacionMainDict[vocacion] = {
                code: vocacion,
                label,
                color
            };

            window.__vocacionMainColorMap[label] = color;
        });
    });

    // Servicio 30 -> vocacion + usopvoc
    const groupsDetail = jsonDetail?.drawingInfo?.renderer?.uniqueValueGroups || [];
    groupsDetail.forEach(group => {
        (group.classes || []).forEach(cls => {
            const vals = cls.values?.[0] || [];
            const vocacion = String(vals[0] ?? "").trim();
            const usopvoc = String(vals[1] ?? "").trim();
            if (!vocacion || !usopvoc) return;

            const c = cls?.symbol?.color || [150,150,150,255];
            const color = `rgba(${c[0]},${c[1]},${c[2]},${(c[3] ?? 255) / 255})`;

            const parts = String(cls.label || "").split(",");
            const vocacionLabel =
                (vocacionMainDict[vocacion]?.label) ||
                (parts[0] || vocacion).trim();

            const usoLabel = (parts[1] || usopvoc).trim();

            vocacionRendererDict[`${vocacion}||${usopvoc}`] = {
                vocacion,
                usopvoc,
                vocacionLabel,
                usoLabel,
                color
            };

            window.__vocacionPairColorMap[`${vocacionLabel}||${usoLabel}`] = color;
        });
    });
}

function getVocacionColor(vocacionLabel) {
    return window.__vocacionMainColorMap?.[vocacionLabel] || "#888";
}

function getVocacionUsoColor(vocacionLabel, usoLabel) {
    return window.__vocacionPairColorMap?.[`${vocacionLabel}||${usoLabel}`] || "#999";
}

function findVocacionCodeByLabel(vocacionLabel) {
    for (const item of Object.values(vocacionMainDict || {})) {
        if (item.label === vocacionLabel) return item.code;
    }
    return null;
}

function findVocacionUsoCodesByLabels(vocacionLabel, usoLabel) {
    for (const item of Object.values(vocacionRendererDict || {})) {
        if (item.vocacionLabel === vocacionLabel && item.usoLabel === usoLabel) {
            return {
                vocacion: item.vocacion,
                usopvoc: item.usopvoc
            };
        }
    }
    return null;
}

function getGeoformaColor(paisajeLabel, relieveLabel) {
    return window.__geoformaPairColorMap?.[`${paisajeLabel}||${relieveLabel}`] || "#999";
}

function getPaisajeColor(paisajeLabel) {
    return window.__geoformaPaisajeColorMap?.[paisajeLabel] || "#888";
}

function toggleGeoformasCharts(show) {
    const dual = document.getElementById("geoformasCharts");
    const single = document.getElementById("chart");

    if (dual) dual.style.display = show ? "block" : "none";
    if (single) single.style.display = show ? "none" : "block";
}

function destroyGeoformasCharts() {
    if (geoPieChartInstance) {
        geoPieChartInstance.destroy();
        geoPieChartInstance = null;
    }
    if (geoDonutChartInstance) {
        geoDonutChartInstance.destroy();
        geoDonutChartInstance = null;
    }
}

function crearGraficasVocacionDual({
    pieLabels,
    pieValues,
    pieColors,
    donutLabels,
    donutValues,
    donutColors,
    selectedVocacion
}) {
    toggleGeoformasCharts(true);
    destroyGeoformasCharts();

    const pieTitle = document.getElementById("geoPieTitle");
    const donutTitle = document.getElementById("geoDonutTitle");
    const donutSubtitle = document.getElementById("geoDonutSubtitle");

    if (pieTitle) pieTitle.textContent = "Vocación";
    if (donutTitle) donutTitle.textContent = "Uso principal";
    if (donutSubtitle) donutSubtitle.textContent = `Vocación: ${selectedVocacion || "Todas"}`;

    const pieCanvas = document.getElementById("geoPieChart");
    const donutCanvas = document.getElementById("geoDonutChart");

    if (pieCanvas) pieCanvas.style.cursor = "pointer";
    if (donutCanvas) donutCanvas.style.cursor = "pointer";

    geoPieChartInstance = new Chart(pieCanvas.getContext("2d"), {
        type: "pie",
        data: {
            labels: pieLabels,
            datasets: [{
                data: pieValues,
                backgroundColor: pieColors,
                borderColor: "#ffffff",
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: true, position: "bottom" }
            },
            onClick: async function(evt, elements) {
                if (!elements.length) return;

                const idx = elements[0].index;
                const vocacionLabel = pieLabels[idx];

                window.__vocacionSelectedLabel = vocacionLabel;

                const vocacionCode = findVocacionCodeByLabel(vocacionLabel);
                if (!vocacionCode) return;

                await zoomMapaVocacion(vocacionCode);

                const clickedLayer = layerGlobal;
                const clickedConfig = getActiveLayerConfig();

                if (clickedLayer && !clickedLayer.destroyed) {
                    await actualizarGrafica(clickedLayer, clickedConfig, { skipSyncMap: true });
                }
            },
            onHover: (event, elements) => {
                event.native.target.style.cursor = elements.length ? "pointer" : "default";
            }
        }
    });

    geoDonutChartInstance = new Chart(donutCanvas.getContext("2d"), {
        type: "doughnut",
        data: {
            labels: donutLabels,
            datasets: [{
                data: donutValues,
                backgroundColor: donutColors,
                borderColor: "#ffffff",
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            cutout: "58%",
            plugins: {
                legend: { display: true, position: "bottom" }
            },
            onClick: async function(evt, elements) {
                if (!elements.length) return;

                const idx = elements[0].index;
                const usoLabel = donutLabels[idx];
                const vocacionLabel = selectedVocacion;

                const codes = findVocacionUsoCodesByLabels(vocacionLabel, usoLabel);
                if (!codes) return;

                await zoomMapaVocacion(codes.vocacion, codes.usopvoc);

                const clickedLayer = layerGlobal;
                const clickedConfig = getActiveLayerConfig();

                if (clickedLayer && !clickedLayer.destroyed) {
                    await actualizarGrafica(clickedLayer, clickedConfig, { skipSyncMap: true });
                }
            },
            onHover: (event, elements) => {
                event.native.target.style.cursor = elements.length ? "pointer" : "default";
            }
        }
    });
}



function crearGraficasGeoformasDual({
    pieLabels,
    pieValues,
    pieColors,
    donutLabels,
    donutValues,
    donutColors,
    selectedPaisaje
}) {
    toggleGeoformasCharts(true);
    destroyGeoformasCharts();

    const pieCanvas = document.getElementById("geoPieChart");
    const donutCanvas = document.getElementById("geoDonutChart");
    const donutSubtitle = document.getElementById("geoDonutSubtitle");

    if (donutSubtitle) {
        donutSubtitle.textContent = `Paisaje: ${selectedPaisaje}`;
    }

    if (pieCanvas) pieCanvas.style.cursor = "pointer";
    if (donutCanvas) donutCanvas.style.cursor = "pointer";

    geoPieChartInstance = new Chart(pieCanvas.getContext("2d"), {
        type: "pie",
        data: {
            labels: pieLabels,
            datasets: [{
                data: pieValues,
                backgroundColor: pieColors,
                borderColor: "#ffffff",
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: true,
                    position: "bottom"
                }
            },
            onClick: async function(evt, elements) {
                if (!elements.length) return;

                const idx = elements[0].index;
                const paisajeLabel = pieLabels[idx];
                const clickedLayer = layerGlobal;
                const clickedConfig = getActiveLayerConfig();
                const clickedCycle = renderCycleId;

                window.__geoformaSelectedPaisaje = paisajeLabel;

                let paisajeCode = null;

                Object.values(geoformasRendererDict || {}).forEach(v => {
                    if (v.paisajeLabel === paisajeLabel && !paisajeCode) {
                        paisajeCode = v.paisaje;
                    }
                });

                if (!paisajeCode) {
                    console.warn("No se encontró código de paisaje para:", paisajeLabel);
                    return;
                }

                await zoomMapaGeoformas(paisajeCode);

                if (
                    clickedCycle === renderCycleId &&
                    clickedLayer &&
                    !clickedLayer.destroyed &&
                    clickedLayer === layerGlobal
                ) {
                    await actualizarGrafica(clickedLayer, clickedConfig, { skipSyncMap: true });
                }
            },
            onHover: (event, elements) => {
                event.native.target.style.cursor = elements.length ? "pointer" : "default";
            }
        }
    });

    geoDonutChartInstance = new Chart(donutCanvas.getContext("2d"), {
        type: "doughnut",
        data: {
            labels: donutLabels,
            datasets: [{
                data: donutValues,
                backgroundColor: donutColors,
                borderColor: "#ffffff",
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            cutout: "58%",
            plugins: {
                legend: {
                    display: true,
                    position: "bottom"
                }
            },
            onClick: async function(evt, elements) {
                if (!elements.length) return;

                const idx = elements[0].index;
                const relieveLabel = donutLabels[idx];
                const paisajeLabel = selectedPaisaje;
                const clickedLayer = layerGlobal;
                const clickedConfig = getActiveLayerConfig();
                const clickedCycle = renderCycleId;

                let paisajeCode = null;
                let relieveCode = null;

                Object.values(geoformasRendererDict || {}).forEach(v => {
                    if (
                        v.paisajeLabel === paisajeLabel &&
                        v.relieveLabel === relieveLabel &&
                        !paisajeCode
                    ) {
                        paisajeCode = v.paisaje;
                        relieveCode = v.relieve;
                    }
                });

                if (!paisajeCode) {
                    console.warn("No se encontró código geoformas para:", paisajeLabel, relieveLabel);
                    return;
                }

                await zoomMapaGeoformas(paisajeCode, relieveCode);

                if (
                    clickedCycle === renderCycleId &&
                    clickedLayer &&
                    !clickedLayer.destroyed &&
                    clickedLayer === layerGlobal
                ) {
                    await actualizarGrafica(clickedLayer, clickedConfig, { skipSyncMap: true });
                }
            },
            onHover: (event, elements) => {
                event.native.target.style.cursor = elements.length ? "pointer" : "default";
            }
        }
    });
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
        console.warn("No se recibió paisaje para filtrar geoformas");
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

    layer.definitionExpression = wherePaisajeRelieve || wherePaisaje;

    async function tryExtent(where) {
        try {
            const q = layer.createQuery();
            q.where = where;
            q.returnGeometry = false;

            const result = await layer.queryExtent(q);

            if (result?.extent) {
                await view.goTo(result.extent.expand(1.2), {
                    duration: 1200,
                    easing: "ease-in-out"
                });
                return true;
            }
            return false;
        } catch (err) {
            console.warn("Falló queryExtent geoformas con:", where, err);
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
        console.warn("No hay layerGlobal o view disponible para vocación");
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
        console.warn("No se recibió vocación para filtrar");
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

            const result = await layer.queryExtent(q);

            if (result?.extent) {
                await view.goTo(result.extent.expand(1.2), {
                    duration: 1200,
                    easing: "ease-in-out"
                });
                return true;
            }
            return false;
        } catch (err) {
            console.warn("Falló queryExtent vocación con:", where, err);
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

    console.warn("No se pudo hacer zoom para vocación");
}
async function zoomMapaLineaLimite(objectId) {
    return zoomToLayerObjectId(objectId, 1.3);
}

async function zoomMapaDepartamentoLimites(objectId) {
    return zoomToLayerObjectId(objectId, 1.2);
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
        console.warn("No se recibió orden de suelo válido para filtrar");
        return;
    }

    const whereSoloOrden = andWhere(whereBase, `ordsuelo = ${ordVal}`);
    const whereOrdenFert = andWhere(whereBase, `ordsuelo = ${ordVal} AND ${fertClause}`);

    // filtra el mapa para apagar las demás
    layer.definitionExpression = isEmptyFert ? whereSoloOrden : whereOrdenFert;

    async function tryExtent(where) {
        try {
            const q = layer.createQuery();
            q.where = where;

            const result = await layer.queryExtent(q);

            if (result?.extent) {
                await view.goTo(result.extent.expand(1.35), {
                    duration: 1200,
                    easing: "ease-in-out"
                });
                return true;
            }
            return false;
        } catch (err) {
            console.warn("Falló queryExtent con:", where, err);
            return false;
        }
    }

    // si fertilidad no sirve como filtro real, no la uses
    if (!isEmptyFert) {
        if (await tryExtent(whereOrdenFert)) return;
    }

    if (await tryExtent(whereSoloOrden)) return;

    console.warn("No se pudo hacer zoom con ningún filtro");
}


function setActiveVariantLayerByScale() {
    if (!layersGlobal?.length || !view) return;

    const desired = pickLayerByScale(layersGlobal, view);
    if (!desired) return;

    // Cambiar visibilidad
    layersGlobal.forEach(l => (l.visible = (l === desired)));

    const changed = desired !== layerGlobal;
    layerGlobal = desired;
    syncStateFromGlobals();

    const config = getActiveLayerConfig();
    if (!config) return;

    // 1) Actualizar legend widget a la capa visible
    const legendTitle = (config.id === "geoformas")
        ? getGeoformasScaleTitle(view.scale)
        : config.title;

    setLegendLayer(desired, legendTitle);

    // 2) AQUÍ MISMO va lo de cuencas (antes de actualizar gráfica)
    if (config.isHidro && config.hidroType === "cuencas" && desired.layerId === 20) {
        fetch(desired.url + "?f=pjson")
        .then(r => r.json())
        .then(json => {
            window.cuencasDict = buildCuencasDictFromRenderer(json);

            // si justo cambió la capa, renderiza con el dict ya listo
            if (changed) {
            const chartL = chartLayerGlobal || desired;
            chartL.when(() => window.actualizarGrafica?.(chartL, config));
            }
        });

    
        return;
    }

    // 3) TU LÓGICA NORMAL (para todas las demás capas)
    if (changed) {
        const chartL = chartLayerGlobal || desired;
        chartL.when(() => window.actualizarGrafica?.(chartL, config));
    }

    // después de escoger active y setear visibles:
    if (layerGlobal) {
        if (![19, 20, 21].includes(Number(layerGlobal.layerId))) {
            layerGlobal.labelsVisible = false;
            layerGlobal.labelingInfo = [];
        }

        if (typeof updateLegendByExtent === "function") {
            updateLegendByExtent(layerGlobal, config);
        }
    }
}


async function cargarDiccionarioMunicipios() {
    try {
        const url = "https://serviciosgeovisor.igac.gov.co:8080/Geovisor/config?cmd=config_diccionario2";
        const res = await fetch(url);
        const json = await res.json();
        if (json && json.UNIDAD) {
            // Cargar municipios
            json.UNIDAD
                .filter(u => u.type === "MUNI")
                .forEach(m => {
                    diccionarioMunicipios[m.id] = m.text;
                });

            // Cargar departamentos
            json.UNIDAD
                .filter(u => u.type === "DEPTO")
                .forEach(d => {
                    if (d.id === "00") {
                        diccionarioDepartamentos[d.id] = "Área en litigio";
                    } else if (d.id === "88") {
                        diccionarioDepartamentos[d.id] = "San Andrés, Providencia y Santa Catalina";
                    } else {
                        diccionarioDepartamentos[d.id] = d.text;
                    }
                });
        }
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
    const labels = {
        RELIEVE: "Relieve",
        CLIMA: "Clima",
        HIDROGRAFIA: "Hidrografía",
        ECOSISTEMAS: "Ecosistemas",
        SUELOS: "Suelos",
        FENOMENOS: "Fenómenos Amenazantes"
    };
    return labels[mode] || "Vista";
}

function setLegendLayer(layer, titleText) {
    setLegendLayerTitle(titleText);
}



function initAllDropdowns() {
    document.addEventListener("click", function (e) {
        document.querySelectorAll(".modulo-dropdown.open").forEach(dropdown => {
            if (!dropdown.contains(e.target)) {
                dropdown.classList.remove("open");
            }
        });
    });

    initModuleDropdown("biofisicoDropdown", "biofisicoTrigger", ".dropdown-menu-custom", function (target) {
        if (target === "Relieve") {
            document.getElementById("btnRelieve")?.click();
        } else if (target === "Clima") {
            document.getElementById("btnClima")?.click();
        } else if (target === "Hidrografía") {
            document.getElementById("btnHidrografia")?.click();
        } else if (target === "Ecosistemas") {
            document.getElementById("btnEcosistemas")?.click();
        } else if (target === "Suelos") {
            document.getElementById("btnSuelos")?.click();
        } else if (target === "Fenómenos Amenazantes") {
            document.getElementById("btnFenomenos")?.click();
        } else if (target === "Relaciones Ambientales") {
            console.log("Pendiente lógica para:", target);
        }
    });

    initModuleDropdown("legalDropdown", "legalTrigger", ".dropdown-menu-custom");
    initModuleDropdown("ocupacionDropdown", "ocupacionTrigger", ".dropdown-menu-custom");
    initModuleDropdown("socioeconomicoDropdown", "socioeconomicoTrigger", ".dropdown-menu-custom");
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
    initAllDropdowns();
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

    function actualizarFuente(layer){

        layer.queryFeatures({
            where: "1=1",
            outFields: ["Fuente"],
            num: 1,
            returnGeometry: false
        }).then((result)=>{

            if(result.features.length > 0){

                const fuente = result.features[0].attributes.Fuente;

                const fuenteDiv = document.getElementById("mapSource");

                if(fuenteDiv){
                    fuenteDiv.textContent = "Fuente: " + fuente;
                }

            }

        });

    }

    function showTimeSlider(periods, activeIndex = 0, contextKey = "") {
        if (!Array.isArray(periods) || !periods.length) {
            hideTimeSlider();
            return;
        }

        const periodsWithAll = ["Todos", ...periods];

        const sameContext = contextKey && timeSliderContextKey === contextKey;
        const samePeriods =
            sameContext &&
            Array.isArray(timeSliderPeriods) &&
            timeSliderPeriods.length === periodsWithAll.length &&
            timeSliderPeriods.every((p, i) => p === periodsWithAll[i]);

        if (contextKey && !sameContext) {
            timeSliderTouched = false;
            timeSliderContextKey = contextKey;
            timeSliderIndex = 0;
        }

        timeSliderEnabled = true;
        sliderMode = "time";

        if (!samePeriods) {
            timeSliderPeriods = periodsWithAll;
            masterSlider.min = 0;
            masterSlider.max = periodsWithAll.length - 1;
            masterSlider.step = 1;
        }

        timeSliderIndex = Math.max(0, Math.min(activeIndex, timeSliderPeriods.length - 1));
        masterSlider.value = timeSliderIndex;

        const container = document.getElementById("zoomSliderContainer");
        const mapSliderLabel = document.getElementById("mapSliderLabel");

        if (container) {
            container.style.display = "block";
            container.classList.add("time-mode");
        }

        if (mapSliderLabel) {
            mapSliderLabel.textContent = `Periodo: ${timeSliderPeriods[timeSliderIndex]}`;
        }
    }

    function getSelectedTimePeriod() {
        if (!timeSliderEnabled || !timeSliderPeriods.length) return null;
        return timeSliderPeriods[timeSliderIndex] || null;
    }

    function renderSubTabs() {
        const container = document.getElementById("subtabsControls");
        if (!container) return;

        container.innerHTML = "";

        const list = getLayerListForCurrentLevel(currentMode) || [];

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
                currentSubLayerIndex = idx;
                renderSubTabs();

                if (municipioActual || (filtroNivel === "DEPTO" && deptoActual)) {
                    cargarCapaActual();
                }
            };

            container.appendChild(btn);
        });
    }

    function handleTimeSliderInput(value) {
        timeSliderIndex = Number(value) || 0;

        const selectedPeriod = timeSliderPeriods[timeSliderIndex];

        if (timeSliderLabel && selectedPeriod) {
            timeSliderLabel.textContent = `Periodo: ${selectedPeriod}`;
        }

        const mapSliderLabel = document.getElementById("mapSliderLabel");
        if (mapSliderLabel && selectedPeriod) {
            mapSliderLabel.textContent = `Periodo: ${selectedPeriod}`;
        }

        const activeConfig = getActiveLayerConfig();
        const activeLayer =
            (typeof layerGlobal !== "undefined" && layerGlobal)
                ? layerGlobal
                : (Array.isArray(layersGlobal) && layersGlobal.length ? layersGlobal[0] : null);

        if (!activeLayer || !activeConfig) return;
        if (!timeSliderEnabled || !timeSliderPeriods?.length) return;

        timeSliderTouched = timeSliderIndex > 0;

        // ===== DEFORESTACIÓN / REGENERACIÓN =====
        if (
            activeConfig?.id === "deforestacion" ||
            activeConfig?.ecosistemaType === "deforestacion"
        ) {
            const periodo = selectedPeriod || "Todos";
            deforestacionPeriodoActivo = periodo;

            const baseWhereStable =
                (whereBase && String(whereBase).trim())
                    ? whereBase
                    : "1=1";

            if (periodo === "Todos") {
                if (activeLayer?.definitionExpression !== baseWhereStable) {
                    applyWhereToActiveLayers(baseWhereStable);
                }
            } else {
                const periodoSafe = String(periodo).replace(/'/g, "''");
                const extraWhere = buildExtraWhere(activeConfig, {
                    timePeriod: periodo
                });

                const wherePeriodo = buildDefinitionExpression({
                    baseWhere: baseWhereStable,
                    extraWhere
                });

                if (activeLayer?.definitionExpression !== wherePeriodo) {
                    applyWhereToActiveLayers(wherePeriodo);
                }
            }

            requestAnimationFrame(() => {
                actualizarGrafica(activeLayer, activeConfig, { skipSyncMap: true });
            });
            return;
        }

        // ===== CLIMA STACKED =====
        if (
            activeConfig?.isClima &&
            activeConfig?.isStacked &&
            activeConfig?.periodField &&
            ["temp", "precip", "temp_cc", "precip_cc"].includes(activeConfig.climaType)
        ) {
            const baseWhereStable =
                (whereBase && String(whereBase).trim())
                    ? whereBase
                    : "1=1";

            if (timeSliderIndex === 0) {
                if (layerGlobal?.definitionExpression !== baseWhereStable) {
                    applyWhereToActiveLayers(baseWhereStable);
                }

                requestAnimationFrame(() => {
                    actualizarGrafica(activeLayer, activeConfig);
                });
                return;
            }

            const selectedPeriodSafe = String(selectedPeriod ?? "").replace(/'/g, "''");
            const extraWhere = buildExtraWhere(activeConfig, {
                timePeriod: selectedPeriod
            });

            const wherePeriodo = buildDefinitionExpression({
                baseWhere: baseWhereStable,
                extraWhere
            });

            if (layerGlobal?.definitionExpression !== wherePeriodo) {
                applyWhereToActiveLayers(wherePeriodo);
            }

            requestAnimationFrame(() => {
                actualizarGrafica(activeLayer, activeConfig);
            });
            return;
        }

        actualizarGrafica(activeLayer, activeConfig);
    }

    initOverview({
        EsriMap,
        MapView,
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
    
    // Inicialización
    init();

    function init() {
        document.getElementById("btnRelieve").onclick = () => setMode("RELIEVE");
        document.getElementById("btnClima").onclick = () => setMode("CLIMA");
        document.getElementById("btnHidrografia").onclick = () => setMode("HIDROGRAFIA");
        document.getElementById("btnEcosistemas").onclick = () => setMode("ECOSISTEMAS");
        document.getElementById("btnSuelos").onclick = () => setMode("SUELOS");
        document.getElementById("btnFenomenos").onclick = () => setMode("FENOMENOS");
        document.getElementById("btnRefreshBusqueda").onclick = limpiarBusqueda;
        cargarMunicipios();
        document.getElementById("legendToggle").onclick = toggleLegend;
        updateNavbarActive(currentMode);
        renderControls();
    }

    function limpiarBusqueda() {
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
            legendContent.innerHTML = `<p style="margin:0; color:#666;">Seleccione un departamento o municipio</p>`;
            legendContent.classList.remove("collapsed");
        }

        // Reiniciar estado visual de leyenda
        window.__legendState = {
            allCodes: [],
            activeCodes: new Set(),
            field: null,
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
        currentMainModule = "BIOFISICO";
        currentMode = mode;
        currentSubLayerIndex = 0;

        syncStateFromGlobals();

        updateNavbarActive(mode);
        clampSubLayerIndex();
        renderSubTabs();
        updateMapViewBadge(getCurrentModeLabel(mode));

        if (municipioActual || (filtroNivel === "DEPTO" && deptoActual)) {
            cargarCapaActual();
        }
    }

    function renderControls() {
        clampSubLayerIndex();
        renderSubTabs();
    }

    function prevLayer() {
        hideTimeSlider();
        timeSliderTouched = false;

        const list = getLayerListForCurrentLevel(currentMode);
        if (!list || list.length === 0) return;

        const total = list.length;
        currentSubLayerIndex = (currentSubLayerIndex - 1 + total) % total;

        renderControls();

        if (municipioActual || (filtroNivel === "DEPTO" && deptoActual)) {
            cargarCapaActual();
        }
    }

    function nextLayer() {
        hideTimeSlider();
        timeSliderTouched = false;

        const list = getLayerListForCurrentLevel(currentMode);
        if (!list || list.length === 0) return;

        const total = list.length;
        currentSubLayerIndex = (currentSubLayerIndex + 1) % total;

        renderControls();

        if (municipioActual || (filtroNivel === "DEPTO" && deptoActual)) {
            cargarCapaActual();
        }
    }

    let municipioInfo = null;


    async function cargarInfoMunicipio(codigo) {
        hideTimeSlider();
        timeSliderTouched = false;                
        const url = "https://mapas2.igac.gov.co/server/rest/services/ordenamiento/componentebiofisico/MapServer/40";
        const where = sqlEquals("mpcodigo", codigo);
        const params = new URLSearchParams({
            where,
            outFields: "*",
            returnGeometry: "false",
            f: "json"
        });
        const queryUrl = `${url}/query?${params.toString()}`;
        try {
            const res = await fetch(queryUrl);
            const json = await res.json();
            if (json.features && json.features.length > 0) {
                municipioInfo = json.features[0].attributes;
            } else {
                municipioInfo = null;
            }
            actualizarResumen();
        } catch (e) {
            console.error("Error cargando info municipio", e);
            municipioInfo = null;
            actualizarResumen();
        }
    }


    function actualizarResumen() {
        const div = document.getElementById("summaryDiv");
        if (!div) return;

        if (filtroNivel === "DEPTO") {
            div.textContent = "Resumen disponible solo al seleccionar un municipio.";
            return;
        }

        const config = getActiveLayerConfig();

        if (!municipioActual) {
            div.textContent = "Seleccione un municipio para ver el resumen.";
            return;
        }

        if (!config || !municipioInfo) {
            div.textContent = "Cargando información o no disponible...";
            return;
        }

        const field = config.summaryField;
        if (field && municipioInfo[field]) {
            // div.innerHTML = `<b></b><br>${municipioInfo[field]}`;
            div.textContent = "";
            const p = document.createElement("p");
            p.textContent = municipioInfo[field]; // seguro
            div.appendChild(p);
        } else {
            div.textContent = "No hay información disponible para esta capa.";
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

    function actualizarLeyenda(labels, colors, codes = null) {
        try {
            const content = document.getElementById("legendContent");
            const title = document.getElementById("legendTitle");
            const config = getActiveLayerConfig();

            if (!content || !title) return;

            if (!config) {
                content.innerHTML = "<p style='margin:0; color:#666;'>No hay capa activa</p>";
                title.textContent = "Leyenda";
                return;
            }

            title.textContent = config.title || "Leyenda";
            window.__lastLegendRenderKey = window.__lastLegendRenderKey || "";

            if (!labels || !labels.length) {
                content.innerHTML = "<p style='margin:0; color:#666;'>Sin clases</p>";
                return;
            }

            let keys = (codes && codes.length === labels.length)
                ? codes.map(v => String(v ?? "").trim())
                : labels.map(v => String(v ?? "").trim());

            // Orden fenómenos
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
                    code: keys[index]
                }));

                items.sort((a, b) => (orden?.[a.label] ?? 999) - (orden?.[b.label] ?? 999));

                labels = items.map(x => x.label);
                colors = items.map(x => x.color);
                keys = items.map(x => x.code);
            }

            // Render simple y seguro
            content.innerHTML = "";

            const frag = document.createDocumentFragment();

            labels.forEach((label, i) => {
                const row = document.createElement("div");
                row.className = "legend-row";
                row.style.display = "flex";
                row.style.alignItems = "center";
                row.style.gap = "8px";
                row.style.marginBottom = "6px";

                const swatch = document.createElement("span");
                swatch.className = "legend-swatch";
                swatch.style.display = "inline-block";
                swatch.style.width = "12px";
                swatch.style.height = "12px";
                swatch.style.minWidth = "12px";
                swatch.style.borderRadius = "2px";
                swatch.style.marginRight = "8px";
                swatch.style.flex = "0 0 12px";
                swatch.style.background = colors[i] || "#999";

                const text = document.createElement("span");
                text.className = "legend-label";
                text.textContent = label ?? "Sin etiqueta";

                row.appendChild(swatch);
                row.appendChild(text);
                frag.appendChild(row);
            });

            content.appendChild(frag);

        } catch (e) {
            console.error("actualizarLeyenda error:", e);
        }
    }

    
    function buildStationsPopupContent(evt) {
        const g = evt?.graphic || evt;
        const a = g?.attributes || {};

        const meses = [
            { key: "ENE", t: "temene", p: "precene" },
            { key: "FEB", t: "temfeb", p: "precfeb" },
            { key: "MAR", t: "temmar", p: "precmar" },
            { key: "ABR", t: "temabr", p: "precabr" },
            { key: "MAY", t: "temmay", p: "precmay" },
            { key: "JUN", t: "temjun", p: "precjun" },
            { key: "JUL", t: "temjul", p: "precjul" },
            { key: "AGO", t: "temago", p: "precago" },
            { key: "SEP", t: "temsep", p: "precsep" },
            { key: "OCT", t: "temoct", p: "precoct" },
            { key: "NOV", t: "temnov", p: "precnov" },
            { key: "DIC", t: "temdic", p: "precdic" },
        ];

        const esc = (v) => escapeHtml(v);

        const toNum = (v) => {
            if (v == null) return null;
            const s = String(v).trim();
            if (!s) return null;
            const n = Number(s.replace(/\./g, "").replace(",", "."));
            return Number.isFinite(n) ? n : null;
        };

        const fmt = (v) => {
            const n = toNum(v);
            if (n == null) return "—";
            return n.toFixed(1).replace(".", ",");
        };

        const fila = (m) => `
            <tr>
            <td style="padding:4px 6px; border-bottom:1px solid #eee;">${m.key}</td>
            <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:right;">${fmt(a[m.t])}</td>
            <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:right;">${fmt(a[m.p])}</td>
            </tr>
        `;
        const mpCode = String(a.mpcodigo ?? "").trim();
        const dpCode = String(a.dpcodigo ?? "").trim();

        const mpNombreRaw = String(a.mpnombre ?? "").trim();
        const dpNombreRaw = String(a.dpnombre ?? "").trim();

        const mpNombreFinal = (!mpNombreRaw || mpNombreRaw === mpCode || !isNaN(mpNombreRaw))
            ? (diccionarioMunicipios?.[mpCode] || mpNombreRaw || mpCode)
            : mpNombreRaw;

        const dpNombreFinal = (!dpNombreRaw || dpNombreRaw === dpCode || !isNaN(dpNombreRaw))
            ? (diccionarioDepartamentos?.[dpCode] || dpNombreRaw || dpCode)
            : dpNombreRaw;

        return `
            <div style="font-size:12px; line-height:1.3;">
            <div><b>Estación:</b> ${esc(a.nombest)} (${esc(a.codest)})</div>
            <div><b>Municipio:</b> ${esc(mpNombreFinal)} (${esc(mpCode)})</div>
            <div><b>Departamento:</b> ${esc(dpNombreFinal)} (${esc(dpCode)})</div>
            <div><b>Fuente:</b> ${esc(a.fuente)}</div>

            <hr style="margin:8px 0;">

            <div style="font-weight:600; margin-bottom:6px;">Promedios mensuales</div>
            <table style="width:100%; border-collapse:collapse;">
                <thead>
                <tr>
                    <th style="text-align:left; padding:4px 6px; border-bottom:1px solid #ddd;">Mes</th>
                    <th style="text-align:right; padding:4px 6px; border-bottom:1px solid #ddd;">Temp (°C)</th>
                    <th style="text-align:right; padding:4px 6px; border-bottom:1px solid #ddd;">Precip (mm)</th>
                </tr>
                </thead>
                <tbody>
                ${meses.map(fila).join("")}
                <tr>
                    <td style="padding:4px 6px; border-top:1px solid #ddd;"><b>ANUAL</b></td>
                    <td style="padding:4px 6px; border-top:1px solid #ddd; text-align:right;"><b>${fmt(a.temanual)}</b></td>
                    <td style="padding:4px 6px; border-top:1px solid #ddd; text-align:right;"><b>${fmt(a.precanual)}</b></td>
                </tr>
                </tbody>
            </table>
            </div>
        `;
        }

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
            content: buildStationsPopupContent
            },
            minScale: 2500000,
            maxScale: 1
        });

        return stationsLayer;
    }

    function _normTxt(s){
        return String(s ?? "")
            .trim()
            .toLowerCase()
            .replace(/\s+/g, " ");
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

            const st = window.__legendState;
            if (!st) return;

            if (!(st.activeCodes instanceof Set)) {
                st.activeCodes = new Set((st.allCodes || []).map(v => String(v)));
            }

            if (st.activeCodes.has(code)) {
                st.activeCodes.delete(code);
                item.classList.add("off");
            } else {
                st.activeCodes.add(code);
                item.classList.remove("off");
            }

            await applyLegendFilter();
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
            node.classList.toggle("off", !st.activeCodes.has(code));
        });
    }

    function buildLegendWhere(field, activeCodes, fieldType) {
        if (!field) return null;

        const values = [...activeCodes];

        if (!values.length) {
            return "1=0";
        }

        const isNumeric =
            fieldType === "small-integer" ||
            fieldType === "integer" ||
            fieldType === "single" ||
            fieldType === "double" ||
            fieldType === "long";

        const formatted = values.map(v => {
            const s = String(v ?? "").trim();

            if (isNumeric && s !== "" && !isNaN(s)) {
                return Number(s);
            }

            return `'${s.replace(/'/g, "''")}'`;
        });

        return `${field} IN (${formatted.join(",")})`;
    }

    async function applyLegendFilter() {
        const st = window.__legendState;
        if (!st?.field) return;

        if (!(st.activeCodes instanceof Set)) {
            st.activeCodes = new Set((st.allCodes || []).map(v => String(v)));
        }

        const targetLayers = getLegendTargetLayers();
        if (!targetLayers.length) return;

        const totalCount = Array.isArray(st.allCodes) ? st.allCodes.length : 0;
        const activeCount = st.activeCodes.size;

        for (const currentLayer of targetLayers) {
            if (!currentLayer || currentLayer.destroyed) continue;

            let fieldInfo = null;
            try {
                fieldInfo = (currentLayer.fields || []).find(f =>
                    String(f.name).toLowerCase() === String(st.field).toLowerCase()
                );
            } catch (_) {}

            const fieldName = fieldInfo?.name || st.field;
            const fieldType = String(fieldInfo?.type || "").toLowerCase();

            let whereLegend = null;

            if (activeCount === 0) {
                whereLegend = "1=0";
            } else if (totalCount > 0 && activeCount < totalCount) {
                whereLegend = buildLegendWhere(fieldName, st.activeCodes, fieldType);
            }

            const base = st.baseWhere && String(st.baseWhere).trim()
                ? `(${st.baseWhere})`
                : null;

            const finalWhere = whereLegend
                ? (base ? `${base} AND (${whereLegend})` : whereLegend)
                : (base || null);

            try {
                const layerView = await view.whenLayerView(currentLayer);
                layerView.filter = finalWhere ? { where: finalWhere } : null;
            } catch (err) {
                console.warn("No se pudo aplicar filtro de leyenda:", err);
            }
        }

        resetLegendVisualState();
    }

    
    function cargarCapaActual() {
        renderCycleId++;
        const config = getActiveLayerConfig();
        if (!config) return;
        

        clearLayers();

        // =========================
        // CASO VARIANTS (29/30, cuencas 19/20/21, etc.)
        // =========================
        if (Array.isArray(config.variants) && config.variants.length) {

            const vLayers = config.variants.map(v => {
            const l = new FeatureLayer({
                url: v.url,
                definitionExpression: buildDefinitionExpression({
                    baseWhere: whereBase
                }),
                outFields: config.outFields || ["*"],
                opacity: 0.8,
                visible: false,
                minScale: v.minScale,
                maxScale: v.maxScale
            });

            map.add(l);
            l.when(() => {
                const placement = "always-horizontal";
                let expr = null;

                if (l.layerId === 19) expr = "DomainName($feature, 'areahidro')";
                else if (l.layerId === 20) expr = "DomainName($feature, 'zonahid')";
                else if (l.layerId === 21) expr = "$feature.szhid";
                else {
                    l.labelsVisible = false;
                    l.labelingInfo = [];         
                    l.popupEnabled = false;
                return;
                }

                l.labelsVisible = true;
                l.labelingInfo = [{
                labelPlacement: placement,
                labelExpressionInfo: { expression: expr },
                deconflictionStrategy: "none",
                symbol: {
                    type: "text",
                    color: "black",
                    haloColor: "white",
                    haloSize: 1,
                    font: { size: 10, family: "sans-serif" }
                }
                }];
                
            });

            return { key: v.key, layer: l };
            });

            layersGlobal = vLayers.map(x => x.layer);

            const active = pickLayerByScale(layersGlobal, view);
            layersGlobal.forEach(ly => ly.visible = (ly === active));
            layerGlobal = active;
            syncStateFromGlobals();

            window.activeFeatureLayer = active;
            view.whenLayerView(active).then(layerView => {
                layerView.filter = null;
            }).catch(() => {}); 
            const legendTitle = (config.id === "geoformas")
                ? getGeoformasScaleTitle(view.scale)
                : config.title;

            setLegendLayer(layerGlobal, legendTitle);

            // watcher de escala (cambia capa activa)
            if (scaleHandle) { scaleHandle.remove(); scaleHandle = null; }
            const onScale = debounce(() => {
            if (filtroNivel === "MUNI" && !municipioActual) return;
            if (filtroNivel === "DEPTO" && !deptoActual) return;
            if (layerGlobal) {
            const lid = Number(layerGlobal.layerId);

            if ([19, 20, 21].includes(lid)) {
                // si está muy alejado, apaga; si está cerca, prende
                layerGlobal.labelsVisible = (view.scale <= 2000000);
            } else {
                // cualquier otra capa: no labels
                layerGlobal.labelsVisible = false;
                layerGlobal.labelingInfo = layerGlobal.labelingInfo || [];
            }
            }

            // esto debe alternar visible 29/30 y setear layerGlobal
            setActiveVariantLayerByScale();
            window.activeFeatureLayer = layerGlobal;

            
            if (layerGlobal) updateLegendByExtent?.(layerGlobal, config);
            }, 180);

            scaleHandle = view.watch("scale", onScale);

            active.when(async () => {
                active.queryExtent({ where: whereBase })
                    .then(res => { if (res.extent) view.goTo(res.extent.expand(1.2)); })
                    .catch(() => {});

                if (config.isGeoforma && config.isGeoformaDualChart) {
                    try {
                        await ensureGeoformasDict();
                    } catch (e) {
                        console.warn("No se pudo cargar dict geoformas:", e);
                    }
                }

                const chartLayer = config.chartVariantKey
                    ? (vLayers.find(v => v.key === config.chartVariantKey)?.layer || active)
                    : active;

                actualizarGrafica(chartLayer, config);

                if (typeof updateLegendByExtent === "function") {
                    updateLegendByExtent(active, config);
                } else {
                    const legendData = buildLegendFromRenderer(active);
                    if (legendData?.labels?.length) {
                        actualizarLeyenda(legendData.labels, legendData.colors, legendData.codes);
                    }
                }

                actualizarResumen();
            });

            return;
        }

        // =========================
        // CASO NORMAL (1 capa)
        // =========================
        const currentCycle = ++renderCycleId;
        const newLayer = new FeatureLayer({
            url: config.url,
            definitionExpression: buildDefinitionExpression({
                baseWhere: whereBase
            }),
            outFields: config.outFields || ["*"],
            opacity: 0.8,
            visible: true,
            minScale: 0,
            maxScale: 0
        });

        if (config.id === "cuencas_depto") {
            newLayer.labelsVisible = false;
        }

        map.add(newLayer);
        layerGlobal = newLayer;
        window.activeFeatureLayer = newLayer;
        setLegendLayer(newLayer, config.title);
        actualizarFuente(newLayer);

        // estaciones SOLO en temp/precip
        if (currentMode === "CLIMA" && config.isClima && (config.climaType === "temp" || config.climaType === "precip")) {
            const st = ensureStationsLayer();
            st.definitionExpression = whereBase;
            map.add(st);
        }

        actualizarResumen();

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

        newLayer.when(async () => {
            if (currentCycle !== renderCycleId || layerGlobal !== newLayer || newLayer.destroyed) return;

            try {
                const res = await newLayer.queryExtent({ where: whereBase });

                if (currentCycle !== renderCycleId || layerGlobal !== newLayer || newLayer.destroyed) return;

                if (res?.extent) {
                    await view.goTo(res.extent.expand(1.2));
                }
            } catch (e) {
                if (e?.name === "AbortError" || String(e?.message || "").toLowerCase().includes("aborted")) return;
                console.error("queryExtent error:", e);
            }

            if (config.isSuelos && config.suelosType === "orden") {
                try {
                    await ensureOrdenSueloDict(config.url);
                } catch (e) {
                    console.warn("No se pudo cargar dict orden suelo:", e);
                }
            }

            if (currentCycle !== renderCycleId || layerGlobal !== newLayer || newLayer.destroyed) return;

            if (config.isGeoforma && config.isGeoformaDualChart) {
                try {
                    await ensureGeoformasDict(config.url);
                } catch (e) {
                    console.warn("No se pudo cargar dict geoformas:", e);
                }
            }

            if (currentCycle !== renderCycleId || layerGlobal !== newLayer || newLayer.destroyed) return;

            actualizarGrafica(newLayer, config);

            if (currentCycle !== renderCycleId || layerGlobal !== newLayer || newLayer.destroyed) return;

            if (typeof updateLegendByExtent === "function") {
                updateLegendByExtent(newLayer, config);
            } else {
                const legendData = buildLegendFromRenderer(newLayer);
                if (legendData?.labels?.length) {
                    actualizarLeyenda(legendData.labels, legendData.colors, legendData.codes);
                }
            }
        });
        if (scaleHandle) {
            scaleHandle.remove();
            scaleHandle = null;
        }

        scaleHandle = view.watch("stationary", (isStationary) => {
            if (!isStationary) return;
            if (!layerGlobal || layerGlobal !== newLayer) return;

            const cfg = getActiveLayerConfig();
            if (cfg && typeof updateLegendByExtent === "function") {
                updateLegendByExtent(newLayer, cfg);
            }
        });

    }






    async function cargarMunicipios() {
        if (Object.keys(diccionarioMunicipios).length === 0) {
            await cargarDiccionarioMunicipios();
        }

        // Usamos la capa 6 como referencia para obtener municipios
        const tempLayer = new FeatureLayer({
            url: LAYERS_CONFIG.RELIEVE[0].url
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
                const depto = normalizeCode(codigo).substring(0, 2);
                return {
                    codigo: codigo,
                    nombre: diccionarioMunicipios[codigo] || codigo,
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

        // Obtener departamentos únicos
        const deptosUnicos = [...new Set(todosMunicipios.map(m => m.depto))].sort();

        deptosUnicos.forEach(codigoDepto => {

            const opt = document.createElement("option");

            opt.value = codigoDepto;

            // renombrar 00
            if (codigoDepto === "00") {
                opt.textContent = "Área en litigio";
            } else {
                opt.textContent = diccionarioDepartamentos[codigoDepto] || codigoDepto;
            }

            selectDepto.appendChild(opt);

        });

    }

    function renderizarMunicipios(deptoFiltro = null) {
        const select = document.getElementById("municipios");
        select.innerHTML = `<option value="">Seleccione un municipio</option>`;

        let municipiosFiltrados = todosMunicipios;

        // Filtrar por departamento
        if (deptoFiltro && deptoFiltro !== "0") {
            municipiosFiltrados = municipiosFiltrados.filter(m => m.depto === deptoFiltro);
        }

        municipiosFiltrados.forEach(muni => {
            const opt = document.createElement("option");
            opt.value = muni.codigo;
            opt.textContent = muni.nombre;
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

            // limpiar capas
            clearLayers();

            // limpiar gráfica
            if (chartInstance) chartInstance.destroy();

            actualizarResumen();

            
            // enfocar Colombia
            view.goTo(
                { center: [-74.3, 4.6], zoom: 6 },
                { duration: 900, easing: "ease-in-out" }
            );

            return;
        }

        // =====================================================
        // FILTRAR MUNICIPIOS
        // =====================================================
        renderizarMunicipios(deptoSeleccionado);
        document.getElementById("municipios").value = "";
        municipioActual = "";
        municipioInfo = null;

        // =====================================================
        // NIVEL DEPARTAMENTAL
        // =====================================================
        if (deptoSeleccionado && deptoSeleccionado !== "0") {

            filtroNivel = "DEPTO";
            deptoActual = deptoSeleccionado;

            // abrir capa departamental dependiendo del modo
            if (currentMode === "CLIMA") {

                const idxTempDepto = (LAYERS_CONFIG.CLIMA || [])
                    .findIndex(l => l.id === "temperatura_depto");

                currentSubLayerIndex = (idxTempDepto >= 0) ? idxTempDepto : 0;

            } 
            else if (currentMode === "FENOMENOS") {

                const idxInuDepto = (LAYERS_CONFIG.FENOMENOS || [])
                    .findIndex(l => l.id === "inundaciones_depto");

                currentSubLayerIndex = (idxInuDepto >= 0) ? idxInuDepto : 0;

            } 
            else {

                const idxHipsoDepto = (LAYERS_CONFIG.RELIEVE || [])
                    .findIndex(l => l.id === "hipsometria_depto");

                currentSubLayerIndex = (idxHipsoDepto >= 0) ? idxHipsoDepto : 0;
            }

            renderControls();

            syncStateFromGlobals();

            const config = getActiveLayerConfig();
            whereBase = buildWhereBase(config);

            syncStateFromGlobals();
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

            clearLayers();

            if (chartInstance) chartInstance.destroy();

            actualizarResumen();
        }
    };


    document.getElementById("municipios").onchange = function () {
        const codigo = this.value;
        if (!codigo) return;

        filtroNivel = "MUNI";
        municipioActual = codigo;
        deptoActual = normalizeCode(codigo).substring(0, 2);

        renderControls();

        const prevList = getLayerListForCurrentLevel(currentMode);
        const prevCfg = prevList?.[currentSubLayerIndex];
        const prevId = prevCfg?.id;

        syncStateFromGlobals();

        const config = getActiveLayerConfig();
        whereBase = buildWhereBase(config);

        syncStateFromGlobals();

        ensureMunicipalLayerIndex(prevId);
        cargarInfoMunicipio(codigo);
        cargarCapaActual();
    };


    function getAxisTitles(layerConfig, chartType, isVertical, datasets) {
        // Riesgo CC departamental: conteo de municipios
        if (layerConfig?.isDeptoRiskCount) {
            return { xTitle: "Nivel de riesgo", yTitle: "Cantidad de municipios" };
        }
        // Defaults
        let xTitle = "";
        let yTitle = "";

        // Radar / Pie: no aplica
        if (chartType === "pie" || chartType === "radar") return { xTitle, yTitle };

        // Si hay stacked o line CC etc, seguimos usando % como valor
        // const valueTitle = (chartType === "line") ? "%" : "%";
        const valueTitle = "Porcentaje (%)";
        // Hipsometría (bar horizontal): X = %, Y = Rangos
        if (layerConfig?.id === "hipsometria") {
            if (isVertical) {
            xTitle = "Rangos (m)";
            yTitle = "Porcentaje (%)";
            } else {
            xTitle = "Porcentaje (%)";
            yTitle = "Rangos (m)";
            }
            return { xTitle, yTitle };
        }

        // Clima stacked (vertical): X = Meses, Y = %
        if (layerConfig?.isClima && layerConfig?.isStacked) {
            xTitle = "Periodo";
            yTitle = "Porcentaje (%)";
            return { xTitle, yTitle };
        }

        // Cambio climático line (horizontal por default, pero tú lo manejas)
        if (layerConfig?.isClima && layerConfig?.isLine) {
            xTitle = "Periodo";
            yTitle = "Porcentaje (%)";
            return { xTitle, yTitle };
        }
        if (layerConfig?.isClima && layerConfig?.climaType === 'clima_tipo') {
            xTitle = "Porcentaje (%)";
            yTitle = "Tipo de clima";
            return { xTitle, yTitle };
        }
        if (layerConfig?.id === "escorrentia") {
            xTitle = "Rangos de escorrentía (mm)/año";
            yTitle = "Porcentaje (%)";
            return { xTitle, yTitle };
        }
        // Ecosistemas (bar horizontal): X = Porcentaje, Y = Ecosistemas
        if (layerConfig?.isEcosistema && layerConfig?.ecosistemaType === "ecosistemas") {
            if (isVertical) {
                xTitle = "Ecosistemas";
                yTitle = "Porcentaje (%)";
            } else {
                xTitle = "Porcentaje (%)";
                yTitle = "Ecosistemas";
            }
            return { xTitle, yTitle };
        }
        if (layerConfig?.isFenomenos) {
            if (layerConfig.fenomenosType === 'inundaciones') {
                xTitle = "Susceptibilidad por inundación";
                yTitle = "Porcentaje (%)";
                return { xTitle, yTitle };
            }

            if (layerConfig.fenomenosType === 'degradacion') {
                xTitle = "Clase de degradación";
                yTitle = "Porcentaje (%)";
                return { xTitle, yTitle };
            }

            if (layerConfig.fenomenosType === 'sismica') {
                xTitle = "Intensidad sísmica";
                yTitle = "Porcentaje (%)";
                return { xTitle, yTitle };
            }
        }
        if (layerConfig?.isSuelos && layerConfig?.suelosType === "conflictos") {
            if (isVertical) {
                xTitle = "Tipo de conflicto";
                yTitle = "Porcentaje (%)";
            } else {
                xTitle = "Porcentaje (%)";
                yTitle = "Tipo de conflicto";
            }
            return { xTitle, yTitle };
        }
        // Casos generales barras:
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

        // Line:
        if (chartType === "line") {
            xTitle = "Categoría";
            yTitle = valueTitle;
            return { xTitle, yTitle };
        }

        return { xTitle, yTitle };
    }

    function crearGraficaBubbleOrdenSuelo({ xLabels, yLabels, datasets }) {
        const canvas = document.getElementById("chart");
        const ctx2 = canvas.getContext("2d");

        const screenW = window.innerWidth || 1200;
        const isSmallScreen = screenW <= 900;
        const isVerySmallScreen = screenW <= 600;

        const totalXLabels = Array.isArray(xLabels) ? xLabels.length : 0;
        const longestXLabel = Math.max(...(xLabels || []).map(v => (v || "").length), 0);

        const useVerticalLabels = isSmallScreen && (totalXLabels >= 6 || longestXLabel >= 12);
        const useShortLabels = isSmallScreen && (totalXLabels >= 7 || longestXLabel >= 14);

        function shortenXLabel(label) {
            if (!label) return "";

            const map = {
                "Baja": "Baja",
                "Media": "Media",
                "Alta": "Alta",
                "Media y baja": "M-baja",
                "Baja y media": "B-media",
                "Media y alta": "M-alta",
                "Alta y media": "A-media",
                "Cuerpos de agua": "Agua",
                "Misceláneo Erosionado": "Misc."
            };

            return map[label] || label;
        }

        function calcularRadioBurbuja(porcentaje) {
            const p = Number(porcentaje || 0);

            if (p <= 0) return 5;
            if (p < 1) return 8;
            if (p < 3) return 12;
            if (p < 6) return 16;
            if (p < 10) return 20;
            if (p < 20) return 26;
            if (p < 35) return 34;
            return 40;
        }

        function agruparBurbujasOrdenSuelo(datasets, xLabels, yLabels) {
            const xIndex = new Map((xLabels || []).map((label, i) => [label, i]));
            const yIndex = new Map((yLabels || []).map((label, i) => [label, i]));
            const agrupado = new Map();

            (datasets || []).forEach(ds => {
                const dsBg = ds.backgroundColor;
                const dsBorder = ds.borderColor;

                (ds.data || []).forEach(p => {
                    const xLabel = p.xLabel || "";
                    const yLabel = p.yLabel || "";
                    const xValue = p.xValue;
                    const yValue = p.yValue;
                    const porcentaje = Number(p.porcentaje || 0);

                    if (!xLabel || !yLabel || porcentaje <= 0) return;
                    if (!xIndex.has(xLabel) || !yIndex.has(yLabel)) return;

                    const key = `${yLabel}|||${xLabel}`;

                    const pointColor =
                        p.backgroundColor ||
                        (Array.isArray(dsBg) ? dsBg[0] : dsBg) ||
                        "rgba(54, 162, 235, 0.65)";

                    const pointBorder =
                        p.borderColor ||
                        (Array.isArray(dsBorder) ? dsBorder[0] : dsBorder) ||
                        "#ffffff";

                    if (!agrupado.has(key)) {
                        agrupado.set(key, {
                            x: xIndex.get(xLabel),
                            y: yIndex.get(yLabel),
                            xLabel,
                            yLabel,
                            xValue,
                            yValue,
                            porcentaje: 0,
                            backgroundColor: pointColor,
                            borderColor: pointBorder
                        });
                    }

                    const item = agrupado.get(key);
                    item.porcentaje += porcentaje;
                });
            });

            const dataAgrupada = Array.from(agrupado.values()).map(item => ({
                ...item,
                r: calcularRadioBurbuja(item.porcentaje)
            }));

            return [{
                label: "Distribución",
                data: dataAgrupada,
                backgroundColor: dataAgrupada.map(d => d.backgroundColor),
                borderColor: dataAgrupada.map(d => d.borderColor),
                borderWidth: 1.5,
                hoverBorderWidth: 2
            }];
        }

        const totalPorcentaje = (datasets || []).reduce((acc, ds) => {
            return acc + (ds.data || []).reduce((sum, p) => sum + Number(p.porcentaje || 0), 0);
        }, 0);

        const sumaPorX = {};
        (datasets || []).forEach(ds => {
            (ds.data || []).forEach(p => {
                const key = p.xLabel || "Sin dato";
                sumaPorX[key] = (sumaPorX[key] || 0) + Number(p.porcentaje || 0);
            });
        });

        const datasetsAgrupados = agruparBurbujasOrdenSuelo(datasets, xLabels, yLabels);

        const totalEl = document.getElementById("chartTotalOrdenSuelo");
        if (totalEl) {
            totalEl.textContent = `Total acumulado: ${totalPorcentaje.toFixed(1)}%`;
        }

        canvas.style.width = "100%";
        canvas.style.height = isVerySmallScreen ? "520px" : (isSmallScreen ? "560px" : "620px");
        canvas.style.minWidth = useVerticalLabels
            ? (isVerySmallScreen ? "900px" : "820px")
            : (isVerySmallScreen ? "760px" : (isSmallScreen ? "720px" : "100%"));

        if (chartInstance) {
            chartInstance.destroy();
            chartInstance = null;
        }

        chartInstance = new Chart(ctx2, {
            type: "bubble",
            data: {
                datasets: datasetsAgrupados
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,

                onClick: function(evt, elements, chart) {
                    if (!elements.length) return;

                    const element = elements[0];
                    const datasetIndex = element.datasetIndex;
                    const index = element.index;
                    const data = chart.data.datasets[datasetIndex].data[index];

                    const ordenLabel = data.yLabel;
                    const fertilidadLabel = data.xLabel;
                    const ordenValue = data.yValue;
                    const fertilidadValue = data.xValue;

                    console.log("Orden label:", ordenLabel);
                    console.log("Fertilidad label:", fertilidadLabel);
                    console.log("Orden value:", ordenValue);
                    console.log("Fertilidad value:", fertilidadValue);

                    zoomMapaOrdenSuelo(ordenValue, fertilidadValue);
                },

                onHover: (event, elements) => {
                    event.native.target.style.cursor = elements.length ? "pointer" : "default";
                },

                resizeDelay: 120,
                animation: false,

                layout: {
                    padding: {
                        top: 20,
                        right: isSmallScreen ? 16 : 20,
                        bottom: useVerticalLabels ? 95 : (isSmallScreen ? 40 : 28),
                        left: isSmallScreen ? 22 : 28
                    }
                },

                elements: {
                    point: {
                        hoverRadius: 0
                    }
                },

                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const raw = context.raw || {};
                                const xLabel = raw.xLabel || "";
                                const yLabel = raw.yLabel || "";
                                const valor = Number(raw.porcentaje || 0);
                                const totalX = Number(sumaPorX[xLabel] || 0);

                                return [
                                    `${yLabel} / ${xLabel}: ${valor.toFixed(2)}%`,
                                    `Total ${xLabel}: ${totalX.toFixed(2)}%`
                                ];
                            }
                        }
                    }
                },

                scales: {
                    x: {
                        type: "linear",
                        min: 0,
                        max: xLabels.length - 1,
                        afterBuildTicks(scale) {
                            scale.ticks = xLabels.map((_, i) => ({ value: i }));
                        },
                        ticks: {
                            display: true,
                            autoSkip: false,
                            maxRotation: useVerticalLabels ? 90 : 0,
                            minRotation: useVerticalLabels ? 90 : 0,
                            align: useVerticalLabels ? "start" : "center",
                            padding: useVerticalLabels ? 6 : 10,
                            color: "#4a4a4a",
                            font: {
                                size: useVerticalLabels ? 10 : (isSmallScreen ? 10 : 11)
                            },
                            callback: function(value) {
                                const original = xLabels[value] ?? "";
                                if (!original) return "";

                                const label = useShortLabels ? shortenXLabel(original) : original;

                                if (useVerticalLabels) return label;

                                if (label.length <= 14) return label;

                                const parts = label.split(" ");
                                if (parts.length === 1) return label;

                                const mid = Math.ceil(parts.length / 2);
                                return [
                                    parts.slice(0, mid).join(" "),
                                    parts.slice(mid).join(" ")
                                ];
                            }
                        },
                        title: {
                            display: true,
                            text: "Fertilidad",
                            color: "#5a5a5a",
                            font: {
                                size: isSmallScreen ? 11 : 12,
                                weight: "normal"
                            },
                            padding: {
                                top: useVerticalLabels ? 28 : 12
                            }
                        },
                        grid: {
                            display: true,
                            drawBorder: true,
                            color: "rgba(0,0,0,0.10)"
                        }
                    },

                    y: {
                        type: "linear",
                        min: 0,
                        max: yLabels.length - 1,
                        reverse: true,
                        afterBuildTicks(scale) {
                            scale.ticks = yLabels.map((_, i) => ({ value: i }));
                        },
                        ticks: {
                            display: true,
                            autoSkip: false,
                            padding: isSmallScreen ? 4 : 6,
                            color: "#4a4a4a",
                            font: {
                                size: isSmallScreen ? 8 : 10
                            },
                            callback: function(value) {
                                return yLabels[value] ?? "";
                            }
                        },
                        title: {
                            display: true,
                            text: "Orden del suelo",
                            color: "#5a5a5a",
                            font: {
                                size: isSmallScreen ? 11 : 12,
                                weight: "normal"
                            },
                            padding: {
                                bottom: 8
                            }
                        },
                        grid: {
                            display: true,
                            drawBorder: true,
                            color: "rgba(0,0,0,0.10)"
                        }
                    }
                }
            },

            plugins: [{
                id: "bubbleLabelsOrdenSuelo",
                afterDatasetsDraw(chart) {
                    const { ctx, chartArea } = chart;
                    if (!chartArea) return;

                    ctx.save();
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";

                    chart.data.datasets.forEach((dataset, datasetIndex) => {
                        const meta = chart.getDatasetMeta(datasetIndex);
                        if (!meta || meta.hidden) return;

                        meta.data.forEach((element, index) => {
                            const raw = dataset.data[index];
                            if (!raw) return;

                            const x = element.x;
                            const y = element.y;
                            const r = raw.r || 0;
                            const pct = Number(raw.porcentaje || 0);

                            if (r < 20 || pct <= 0) return;

                            if (
                                x < chartArea.left ||
                                x > chartArea.right ||
                                y < chartArea.top ||
                                y > chartArea.bottom
                            ) {
                                return;
                            }

                            const label = `${pct.toFixed(1)}%`;

                            const fontSize = isSmallScreen
                                ? Math.max(8, Math.min(9, r * 0.30))
                                : Math.max(9, Math.min(11, r * 0.34));

                            ctx.font = `600 ${fontSize}px Outfit, sans-serif`;

                            const textWidth = ctx.measureText(label).width;
                            if (textWidth > (r * (isSmallScreen ? 1.0 : 1.15))) return;

                            ctx.fillStyle = "#ffffff";
                            ctx.strokeStyle = "rgba(0,0,0,0.35)";
                            ctx.lineWidth = 2;

                            ctx.strokeText(label, x, y);
                            ctx.fillText(label, x, y);
                        });
                    });

                    ctx.restore();
                }
            }]
        });
    }


    function crearGrafica(labels, values, colors, type = 'bar', isVertical = false, datasets = null) {
        const layerConfig = getActiveLayerConfig();
        toggleGeoformasCharts(false);
        destroyGeoformasCharts();
        if (type === 'bar' && !isVertical) {
            labels = labels.map(l => wrapLabel(l, 22));
        }
        //  Títulos de ejes según capa/tipo
        const axisTitles = getAxisTitles(layerConfig, type, isVertical, datasets);

        //  Control de visibilidad de etiquetas (para no saturar en algunas capas)
        let showYLabels = true;
        if (
            layerConfig &&
            (layerConfig.ecosistemaType === 'ecosistemas')
        ) {
            showYLabels = false;
        }

        const ctx = document.getElementById("chart").getContext("2d");
        if (chartInstance) chartInstance.destroy();

        const isPieLike = (type === "doughnut" || type === "pie");
        const chartDatasets = datasets || [{
            label: (type === 'radar') ? "" : (type === 'line' ? "Cobertura (%)" : "%"),
            data: values,
            backgroundColor: colors || "rgba(0, 121, 193, 0.6)",
            borderColor: isPieLike ? "transparent" : "rgba(0,0,0,0)",
            borderWidth: isPieLike ? 0 : (type === "bar" ? 0 : 2),
            fill: type === 'radar'
        }];

        const isStacked = Array.isArray(datasets) && datasets.length > 0;
        // Solo forzamos 0–100 en clima apilado
        const isPercentStacked = isStacked && layerConfig?.isClima === true && layerConfig?.isStacked === true;

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
                        label: function (context) {
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

                            // Resto de gráficos
                            let label = context.dataset.label || '';
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
                // STACKED BIOFÍSICO
                // =========================
                if (datasets !== null && el.datasetIndex !== undefined) {
                    const dataset = chartInstance.data.datasets[el.datasetIndex];
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
                // FLUJO NORMAL BIOFÍSICO
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
                // BARRAS VERTICALES
                config.options.indexAxis = 'x';
                config.options.maintainAspectRatio = false;
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
                            callback: (v) => isPercentStacked ? `${v}%` : v,
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

                if (isEcoChart) {
                    config.options.plugins = config.options.plugins || {};
                    config.options.plugins.zoom = {
                        pan: {
                            enabled: true,
                            mode: 'y',
                            modifierKey: 'ctrl'
                        },
                        zoom: {
                            wheel: {
                                enabled: true,
                                // modifierKey: 'ctrl'
                            },
                            pinch: {
                                enabled: true
                            },
                            drag: {
                                enabled: false
                            },
                            mode: 'y'
                        }
                    };
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
                        title: {
                            display: !!axisTitles.xTitle,
                            text: axisTitles.xTitle
                        },
                        suggestedMax: isPercentStacked ? 100 : undefined,
                        max: isPercentStacked ? 100 : undefined,
                        ticks: {
                            callback: (v) => isPercentStacked ? `${v}%` : v,
                            font: {
                                size: isVerySmallScreen ? 9 : 10
                            }
                        }
                    },
                    y: {
                        stacked: isStacked,
                        title: {
                            display: !!axisTitles.yTitle,
                            text: axisTitles.yTitle
                        },
                        ticks: {
                            display: showYLabels,
                            autoSkip: isEcoChart ? false : true,
                            maxTicksLimit: isEcoChart ? totalLabels : (
                                isVerySmallScreen
                                    ? 5
                                    : isSmallScreen
                                    ? (tooManyItemsMobile ? 6 : 8)
                                    : (tooManyItems ? 8 : 12)
                            ),
                            padding: 4,
                            font: {
                                size: isVerySmallScreen ? 8 : isSmallScreen ? 9 : 10
                            }
                        }
                    }
                };
            }

            // Ajuste dinámico del alto del canvas según cantidad de datos
            const chartCanvas = document.getElementById("chart");
            if (chartCanvas) {
                if (!isVertical) {
                    const isEcoChart =
                        layerConfig?.isEcosistema &&
                        layerConfig?.ecosistemaType === "ecosistemas";

                    if (isEcoChart) {
                        const base = isSmallScreen ? 420 : 380;
                        const extraPerItem = isVerySmallScreen ? 18 : isSmallScreen ? 20 : 22;
                        const dynamicHeight = Math.max(base, 120 + (totalLabels * extraPerItem));
                        chartCanvas.style.height = `${dynamicHeight}px`;
                    } else {
                        const base = isSmallScreen ? 320 : 280;
                        const extraPerItem = isVerySmallScreen ? 26 : isSmallScreen ? 22 : 18;
                        const dynamicHeight = Math.max(base, 160 + (totalLabels * extraPerItem));
                        chartCanvas.style.height = `${dynamicHeight}px`;
                    }
                } else {
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

        config.options.onClick = (evt, elements) => {
            if (elements?.length) {
                const idx = elements[0].index;
                const clickedLabel = String(config.data.labels?.[idx] ?? "").trim();

                const cfg = getActiveLayerConfig();
            if (cfg?.id === "pendientes") {
                const code = pendientesLabelToCode[clickedLabel.toLowerCase()];

                if (code) {
                    const whereZoom = `(${whereBase || "1=1"}) AND categoria = ${code}`;

                    applyWhereToActiveLayers(whereZoom);
                    updateLegendByExtent?.(layerGlobal, cfg);

                    const extentLayer = layerGlobal;
                    extentLayer?.queryExtent({ where: whereZoom }).then(res => {
                        if (res?.extent) view.goTo(res.extent.expand(1.3));
                    });

                    syncLegendToLabelSelection(clickedLabel);
                    return;
                }
            }
        }

        if (typeof prevOnClick === "function") {
            prevOnClick(evt, elements);
        }
        };

        chartInstance = new Chart(ctx, config);
    }


    function actualizarTituloGrafico(config, mpnombre, dpnombre) {
        const titleElement = document.getElementById("chartTitle");
        if (!titleElement) return;

        let titulo = "Distribución (%)";
        if (filtroNivel === "DEPTO" && deptoActual) {
            const depName = diccionarioDepartamentos[deptoActual] || deptoActual;

            if (config?.isDeptoRiskCount) {
                titleElement.textContent = `Municipios por nivel de riesgo ante cambio climático en el departamento de ${depName}`;
                return;
            }
            if (config?.isBF3) {
                titleElement.textContent = `Distribución de geoformas`;
                return;
            }
            if (config?.isClima && config?.climaType === "temp") {
                titleElement.textContent = `Distribución de rangos de temperatura`;
                return;
            }
            if (config?.isClima && config?.climaType === "precip") {
                titleElement.textContent = `Distribución de rangos de precipitación`;
                return;
            }
            if (config?.isClima && config?.climaType === "temp_cc") {
                titleElement.textContent = `Escenario de cambio en las temperaturas`;
                return;
            }
            if (config?.isClima && config?.climaType === "precip_cc") {
                titleElement.textContent = `Escenario de cambio en las precipitaciones`;
                return;
            }
            if (config?.isFenomenos && config?.fenomenosType === "inundaciones") {
                titleElement.textContent = `Porcentaje de susceptibilidad a inundaciones`;
                return;
            }
            if (config?.isFenomenos && config?.fenomenosType === "degradacion") {
                titleElement.textContent = `Grado y clase de degradación del suelo`;
                return;
            }
            if (config?.isFenomenos && config?.fenomenosType === "sismica") {
                titleElement.textContent = `Distribución de la intensidad sísmica esperada`;
                return;
            }
            if (config?.isFenomenos && config?.fenomenosType === "remocion") {
                titleElement.textContent = `Amenaza por remoción en masa`;
                return;
            }
            if (config?.isSuelos && config?.suelosType === "orden") {
                titleElement.textContent = `Distribución del orden del suelo`;
                return;
            }
            if (config?.isHidro && config?.hidroType === "cuencas" && config?.isDeptoCuencasAgg) {
                titleElement.textContent = `Zonas hidrográficas presentes`;
                return;
            }
            // fallback depto
            titleElement.textContent = `Distribución (%)`;
            return;
        }
        // Caso departamental BF3 (Geoformas)
        // if (config?.isBF3 && filtroNivel === "DEPTO") {
        //     const depName = diccionarioDepartamentos[deptoActual] || deptoActual;
        //     titulo = `Distribución de geoformas`;
        //     titleElement.textContent = titulo;
        //     return;
        // }
        if (config?.isGeoforma && config?.isGeoformaDualChart) {
            titulo = `Distribución de geoformas y paisajes`;
            titleElement.textContent = titulo;
            return;
        }
        


        if (config && mpnombre && dpnombre) {
            //  Caso solicitado (Hipsometría)
            if (config.id === "hipsometria") {
            titulo = `Distribución de rangos hipsométricos`;
            }
            // Clima
            else if (config.climaType === 'temp') {
            titulo = `Distribución de rangos de temperatura`;
            } else if (config.climaType === 'precip') {
            titulo = `Distribución de rangos de precipitación`;
            } else if (config.climaType === 'clima_tipo') {
            titulo = `Distribución de los tipos de climas`;
            } else if (config.climaType === 'temp_cc') {
            titulo = `Escenario de cambio en las temperaturas`;
            } else if (config.climaType === 'precip_cc') {
            titulo = `Escenario de cambio en las precipitaciones`;
            } else if (config.climaType === 'riesgo_cc') {
            titulo = `Calificación de índices y subíndices por riesgo ante cambio climático`;
            } else if (config.ecosistemaType === 'ecosistemas') {
            titulo = `Distribución de ecosistemas`;
            }else if (config.isHidro && config.hidroType === 'cuencas') {
            titulo = `Distribución de las subzonas hidrográficas`;
            }else if (config.id === "escorrentia") {
            titulo = `Distribución de la escorrentía por rangos`;
            } else if (config.isSuelos && config.suelosType === 'orden') {
            titulo = `Distribución de órdenes y fertilidad de los suelos`;
            }else if (config.isSuelos && config.suelosType === 'vocacion') {
            titulo = `Distribución de vocaciones de los suelos y usos principales`;
            }else if (config.isSuelos && config.suelosType === 'conflictos') {
            titulo = `Distribución de los tipos de conflictos de los suelo`;
            }else if (config.id === "inundaciones") {
            titulo = `Distribución de la susceptibilidad a inundaciones`;
            }else if (config.isFenomenos && config.fenomenosType === "remocion") {
            titulo = `Distribución de las categorías de amenaza por remoción en masa`;
            }else if (config.isFenomenos && config.fenomenosType === 'degradacion') {
            titulo = `Distribución de la degradación del suelo`;
            } else if (config.isFenomenos && config.fenomenosType === 'sismica') {
            titulo = `Distribución de la intensidad sísmica esperada`;
            }
        }

        titleElement.textContent = titulo;
    }

    function buildPaisajeDictFromRenderer(layer){
        const m = new Map();
        const r = layer?.renderer;
        if (!r || r.type !== "unique-value") return m;

        (r.uniqueValueInfos || []).forEach(info => {
            const v = String(info.value ?? "").trim();
            const label = String(info.label ?? v).trim();
            const col = getSymbolColorRGBA(info.symbol) || "#999"; //  AHORA SÍ

            if (v) m.set(v, { label, color: col });
            if (label) m.set(normKey(label), { label, color: col });
        });

        return m;
    }

    


    // =====================
    // LEYENDA POR EXTENT (solo lo visible)
    // =====================

    // 1) Decide qué campos necesita la query según la capa activa
    function getLegendOutFields(config, layer) {
        if (config.isDeptoRiskCount) return [];
        if (config.isBF3) return ["paisaje"];
        if (!config) return ["*"];

        // Radar -> leyenda fija
        if (config.isRadar) return [];

        // Geoformas
        if (config.isGeoforma) return ["paisaje", "trelieve"];

        // Clima
        if (config.isClima) {
            if (config.climaType === "clima_tipo") return [config.labelField]; // clima
            // temp/precip/temp_cc/precip_cc -> labelField
            return [config.labelField];
        }

        // Hidro
        if (config.isHidro) {
            if (config.hidroType === "cuencas") return ["szhid", "areahidro"];
            return [config.labelField]; // escorrentia
        }

        // Ecosistemas
        if (config.isEcosistema) {
            const url = String(layer?.url || "");
            // capa 25 => condicion
            if (config.ecosistemaType === "ecosistemas" && url.endsWith("/25")) return ["condicion"];
            // capa 26 => ecosgen
            if (config.ecosistemaType === "ecosistemas") return ["ecosgen"];
            // deforestacion => cambiobosque
            return [config.labelField];
        }

        // Suelos
        if (config.isSuelos) {
        if (config.suelosType === "vocacion") return ["vocacion", "usopvoc"];
        if (config.suelosType === "orden") return ["ordsuelo"];  
        return [config.labelField]; // conflictos
        }

        // Fenómenos
        if (config.isFenomenos) return [config.labelField];

        // Default (hipsometría etc)
        return [config.labelField];
        }

        // 2) Mapea atributos => {label,color} según tu lógica/diccionarios
        function buildLegendEntryFromAttrs(config, attrs, layer) {
        if (!config || !attrs) return null;

        // Orden del suelo: usar renderer dict (label+color)
        if (config?.isSuelos && config.suelosType === "orden") {
            const field = config.labelField || "ordsuelo";
            const code = String(attrs[field] ?? attrs.ordsuelo ?? "").trim(); // 15001...
            if (!code) return null;

            let info = null;
            if (typeof buildDictFromUniqueValueRenderer === "function") {
                const dict = buildDictFromUniqueValueRenderer(layer);
                info = dict.get(code) || null;
            }

            return {
                label: info?.label || code,
                color: info?.color || "#999"
            };
        }

        // Radar
        if (config.isRadar) {
            return {
            fixed: true,
            labels: LEYENDA_RIESGO_CC.map(i => i.label),
            colors: LEYENDA_RIESGO_CC.map(i => i.color),
            };
        }

        if (config.isBF3) {
            const code = String(attrs.paisaje ?? "");
            const dict = buildPaisajeDictFromRenderer(layer);
            const info = dict.get(code);
            return { label: info?.label || code, color: info?.color || "#999" };
        }
        // Geoformas: key = "paisaje,trelieve"
        if (config.isGeoforma) {
            const p = attrs.paisaje;
            const t = attrs.trelieve;
            const key = `${p},${t}`;
            const info = coloresGeoformas?.[key];
            return {
            label: info?.label || key,
            color: info?.color || "#999",
            };
        }

        // Clima
        if (config.isClima) {
            const code = String(attrs[config.labelField] ?? "");

            if (config.climaType === "clima_tipo") {
            const info = coloresClimas?.[code];
            return { label: info?.label || code, color: info?.color || "#999" };
            }

            let dict = {};
            if (config.climaType === "temp") dict = coloresTemperatura;
            if (config.climaType === "precip") dict = coloresPrecipitacion;
            if (config.climaType === "temp_cc") dict = coloresCambioTemp;
            if (config.climaType === "precip_cc") dict = coloresCambioPrecip;

            const info = dict?.[code];
            return { label: info?.label || code, color: info?.color || "#999" };
        }

        // Hidrografía
        if (config.isHidro) {
            if (config.hidroType === "cuencas") {
            const label = String(attrs.szhid ?? "");
            const areaCode = String(attrs.areahidro ?? "");
            const areaInfo = coloresCuencas?.[areaCode];
            return { label: label || "—", color: areaInfo?.color || "#999" };
            }

            // escorrentía
            const code = String(attrs[config.labelField] ?? "");
            const info = coloresEscorrentia?.[code];
            return { label: info?.label || code, color: info?.color || "#999" };
        }

        // Ecosistemas
        if (config.isEcosistema) {
            if (config.ecosistemaType === "deforestacion") {
            const code = String(attrs[config.labelField] ?? "");
            const info = coloresDeforestacion?.[code];
            return { label: info?.label || code, color: info?.color || "#999" };
            }

            // ecosistemas: depende de si es /25 o /26
            const url = String(layer?.url || "");
            if (config.ecosistemaType === "ecosistemas" && url.endsWith("/25")) {
            const cond = attrs.condicion;
            const info = coloresCondicionEcos?.[cond];
            return { label: info?.label || String(cond ?? ""), color: info?.color || "#999" };
            } else {
            const key = String(attrs.ecosgen ?? "");
            const info = coloresEcosistemas?.[key];
            // si no existe en dict, lo mostramos igual
            return { label: info?.label || key, color: info?.color || "#888" };
            }
        }

        // Suelos
        if (config.isSuelos) {
            if (config.suelosType === "vocacion") {
            const v = attrs.vocacion;
            const u = attrs.usopvoc;
            const key = `${v},${u}`;
            const info = coloresVocacion?.[key];
            return { label: info?.label || key, color: info?.color || "#999" };
            } else {
            const code = String(attrs[config.labelField] ?? "");
            const info = coloresConflictos?.[code];
            return { label: info?.label || code, color: info?.color || "#999" };
            }
        }

        // Fenómenos
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
            return { label: info?.label || code, color: info?.color || "#999" };
        }

        // Default (hipsometría y otros simples)
        const code = String(attrs[config.labelField] ?? "");

        // hipsometría municipal y departamental (deptoAgg)
        if (config.id === "hipsometria" || config.id === "hipsometria_depto" || config.isDeptoAgg) {
            const info = coloresHipsometricos?.[code];
            return { label: info?.label || code, color: info?.color || "#999" };
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

            if (config.isGeoforma && config.isGeoformaDualChart) {
                const legendData = buildLegendFromRenderer(layer);
                if (legendData?.labels?.length) {
                    const unique = new Map();

                    legendData.labels.forEach((label, i) => {
                        const cleanLabel = String(label ?? "").trim();
                        if (!cleanLabel) return;

                        if (!unique.has(cleanLabel)) {
                            unique.set(cleanLabel, {
                                label: cleanLabel,
                                color: legendData.colors?.[i] || "#999",
                                code: String(legendData.codes?.[i] ?? cleanLabel).trim()
                            });
                        }
                    });

                    actualizarLeyenda(
                        Array.from(unique.values()).map(x => x.label),
                        Array.from(unique.values()).map(x => x.color),
                        Array.from(unique.values()).map(x => x.code)
                    );
                }
                return;
            }

            if (config.isFenomenos && config.fenomenosType === "degradacion") {
                const legendData = buildLegendFromRenderer(layer);
                if (legendData?.labels?.length) {
                    const unique = new Map();

                    legendData.labels.forEach((label, i) => {
                        const cleanLabel = String(label ?? "").trim();
                        if (!cleanLabel) return;

                        if (!unique.has(cleanLabel)) {
                            unique.set(cleanLabel, {
                                label: cleanLabel,
                                color: legendData.colors?.[i] || "#999",
                                code: String(legendData.codes?.[i] ?? cleanLabel).trim()
                            });
                        }
                    });

                    const ordered = Array.from(unique.values()).sort(
                        (a, b) => (ORDEN_DEGRADACION[a.label] ?? 999) - (ORDEN_DEGRADACION[b.label] ?? 999)
                    );

                    actualizarLeyenda(
                        ordered.map(x => x.label),
                        ordered.map(x => x.color),
                        ordered.map(x => x.code)
                    );
                }
                return;
            }

            if (config.isRadar || config.isDeptoRiskCount) {
                actualizarLeyenda(
                    LEYENDA_RIESGO_CC.map(i => i.label),
                    LEYENDA_RIESGO_CC.map(i => i.color)
                );
                return;
            }

            if (config.isSuelos && config.suelosType === "orden") {
                const legendData = buildLegendFromRenderer(layer);
                if (legendData?.labels?.length) {
                    actualizarLeyenda(legendData.labels, legendData.colors, legendData.codes);
                }
                return;
            }

            const q = layer.createQuery();
            q.where = layer.definitionExpression || whereBase || "1=1";
            q.geometry = view.extent;
            q.spatialRelationship = "intersects";
            q.returnGeometry = false;
            q.outFields = getLegendOutFields(config, layer);

            if (!layer || layer.destroyed) return;

            const res = await layer.queryFeatures(q);

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

    function buildCtx(layer, config, options = {}) {
        const lyr = (typeof layerGlobal !== "undefined" && layerGlobal) ? layerGlobal : layer;

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
            actualizarLeyenda,
            actualizarTituloGrafico,
            destroyChart: () => { if (typeof chartInstance !== "undefined" && chartInstance) chartInstance.destroy(); },
            setTitle: (t) => { const el = document.getElementById("chartTitle"); if (el) el.textContent = t; },
            cycleId: renderCycleId,
            skipSyncMap: !!options.skipSyncMap,
        };
    }
    async function queryGroupSum({ url, where, groupBy, field, outName = "v_sum", statisticType = "sum" }) {
        const js = await arcRestQuery(url, {
            f: "json",
            where,
            groupByFieldsForStatistics: groupBy,
            outStatistics: JSON.stringify([{
            statisticType,
            onStatisticField: field,
            outStatisticFieldName: outName
            }]),
            returnGeometry: "false"
        });

        return (js.features || []).map(f => f.attributes || {});
        }

        async function queryTotalSum({ url, where, field, outName = "t_sum" }) {
        const js = await arcRestQuery(url, {
            f: "json",
            where,
            outStatistics: JSON.stringify([{
            statisticType: "sum",
            onStatisticField: field,
            outStatisticFieldName: outName
            }]),
            returnGeometry: "false"
        });

        return Number(js?.features?.[0]?.attributes?.[outName]) || 0;
    }


    function mergePctWithDict(pctByCode, dictObj) {
        const temp = [];

        for (const [code, info] of Object.entries(dictObj || {})) {
            const pct = pctByCode.get(String(code));
            if (pct == null) continue;
            temp.push({
            code: String(code),
            label: info?.label || String(code),
            color: info?.color || "#999",
            pct
            });
        }

        for (const [code, pct] of pctByCode.entries()) {
            if (!temp.some(x => x.code === code)) {
            temp.push({ code, label: code, color: "#999", pct });
            }
        }

        return temp;
    }

    function sortItems(items, desiredLabelOrder) {
        const arr = [...items];
        arr.sort((a, b) => {
            if (Array.isArray(desiredLabelOrder) && desiredLabelOrder.length) {
            const ia = desiredLabelOrder.indexOf(a.label);
            const ib = desiredLabelOrder.indexOf(b.label);
            const ra = (ia === -1) ? 999 : ia;
            const rb = (ib === -1) ? 999 : ib;
            if (ra !== rb) return ra - rb;
            }
            return String(a.label).localeCompare(String(b.label), "es");
        });
        return arr;
    }

    function fenomenosMeta(type) {
        if (type === "inundaciones") {
            return {
            dict: (typeof coloresInundaciones !== "undefined") ? coloresInundaciones : {},
            desiredLabelOrder: ["Baja", "Media", "Alta", "Muy alta", "Sin información"],
            chartKind: "bar"
            };
        }
        if (type === "sismica") {
            return {
            dict: (typeof coloresSismica !== "undefined") ? coloresSismica : {},
            desiredLabelOrder: ["Débil", "Ligero", "Moderado", "Fuerte", "Muy fuerte", "Severo", "Violento", "Sin información"],
            chartKind: "bar"
            };
        }
        if (type === "remocion") {
            return {
            dict: (typeof coloresRemocion !== "undefined") ? coloresRemocion : {},
            desiredLabelOrder: null,
            chartKind: "pie"
            };
        }
        if (type === "degradacion") {
            return {
            dict: (typeof coloresDegradacion !== "undefined") ? coloresDegradacion : {},
            desiredLabelOrder: null,
            chartKind: "bar"
            };
        }
        return { dict: {}, desiredLabelOrder: null, chartKind: "bar" };
        }

        function fenomenosTitle(type, depName) {
        if (type === "inundaciones") return `Porcentaje de susceptibilidad a inundaciones en el departamento de ${depName}`;
        if (type === "sismica") return `Distribución de la intensidad sísmica esperada en el departamento de ${depName}`;
        return `Distribución (%) en el departamento de ${depName}`;
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
        } catch (_) {}

        try { lyr.refresh(); } catch (_) {}

        // Si hay una leyenda activa, la reaplicamos encima del whereBase
        try {
            if (window.__legendState?.field) {
                await applyLegendFilter();
            }
        } catch (_) {}
    }
    /* =======================
    HANDLERS
    ======================= */
    function fenomDeptoPctHandler() {
        return {
            when: (ctx) =>
            ctx.filtroNivel === "DEPTO" &&
            ctx.config.isFenomenos &&
            ctx.config.isDeptoFenAgg &&
            ctx.config.deptoAgg,

            run: async (ctx) => {
            const { groupField, numField } = ctx.config.deptoAgg;
            const url = ctx.config.url || ctx.layer.url;

            const rows = await queryGroupSum({
                url,
                where: ctx.whereBase,
                groupBy: groupField,
                field: numField,
                outName: "sum_area"
            });

            if (!ensureNonEmptyOrExit(ctx, rows)) return;

            const total = rows.reduce((acc, r) => acc + (Number(r.sum_area) || 0), 0);
            if (total <= 0) {
                ctx.destroyChart();
                ctx.actualizarLeyenda([], []);
                
                return;
            }

            const pctByCode = new Map(
                rows.map(r => [String(r[groupField]), pctOfTotal(r.sum_area, total)])
            );

            const { dict, desiredLabelOrder, chartKind } = fenomenosMeta(ctx.config.fenomenosType);

            const items = mergePctWithDict(pctByCode, dict);
            const ordered = sortItems(items, desiredLabelOrder);

            const labels = ordered.map(x => x.label);
            const values = ordered.map(x => Number((x.pct || 0).toFixed(2)));
            const colors = ordered.map(x => x.color);

            const depName = ctx.diccionarioDepartamentos[ctx.deptoActual] || ctx.deptoActual;
            ctx.setTitle(fenomenosTitle(ctx.config.fenomenosType, depName));

            if (chartKind === "pie") ctx.crearGrafica(labels, values, colors, "pie", false);
            else ctx.crearGrafica(labels, values, colors, "bar", true);

            ctx.actualizarLeyenda(labels, colors);
            }
        };
    }


    function vocacionDeptoDonutHandler() {
        return {
            when: (ctx) =>
            ctx.filtroNivel === "DEPTO" &&
            ctx.config.isSuelos &&
            ctx.config.suelosType === "vocacion" &&
            ctx.config.isDeptoVocacionAgg &&
            ctx.config.vocacionAgg,

            run: async (ctx) => {
            try {
                const { groupField, areaCandidates } = ctx.config.vocacionAgg;

                const lyr = ctx.lyr || ctx.layer;
                await lyr.when();

                // Detectar campo de área disponible (preferimos areat)
                const areaField = (typeof pickExistingField === "function"
                ? (pickExistingField(lyr, areaCandidates) || "areat")
                : "areat"
                );

                const url = ctx.config.url || lyr.url;

                // group sum(areaField) por vocación
                const rows = await queryGroupSum({
                url,
                where: ctx.whereBase || "1=1",
                groupBy: groupField,
                field: areaField,
                outName: "sum_area",
                statisticType: "sum"
                });

                if (!ensureNonEmptyOrExit(ctx, rows)) return;

                const total = rows.reduce((acc, r) => acc + (Number(r.sum_area) || 0), 0);
                if (total <= 0) {
                ctx.destroyChart();
                ctx.actualizarLeyenda([], []);
                return;
                }

                // Diccionario label/color desde renderer (si existe)
                const dictFromRenderer = buildDictFromUniqueValueRenderer(lyr);

                // Armar items
                const items = rows.map(r => {
                const code = String(r[groupField] ?? "").trim();
                const area = Number(r.sum_area) || 0;
                const pct = pctOfTotal(area, total);

                const info = dictFromRenderer.get(code);
                return {
                    code,
                    label: info?.label || code || "Sin información",
                    color: info?.color || "#999",
                    pct
                };
                });

                // Orden por porcentaje desc (como tu donut)
                items.sort((a, b) => (b.pct || 0) - (a.pct || 0));

                const labels = items.map(x => x.label);
                const values = items.map(x => Number((x.pct || 0).toFixed(2)));
                const colors = items.map(x => x.color);

                // Título
                const depName = ctx.diccionarioDepartamentos?.[ctx.deptoActual] || ctx.deptoActual;
                ctx.setTitle(`Proporción de la vocación de uso del suelo en el departamento de ${depName}`);

                // Doughnut (anillo)
                ctx.crearGrafica(labels, values, colors, "doughnut", false);

                // Ajuste del hueco (cutout) para que se vea como tu imagen
                if (typeof chartInstance !== "undefined" && chartInstance) {
                chartInstance.options.cutout = "60%";
                chartInstance.update();
                }

                ctx.actualizarLeyenda(labels, colors);

            } catch (e) {
                console.error("VOCACION_DEPTO error:", e);
                ctx.actualizarLeyenda([], []);
                ctx.destroyChart();
            }
            }
        };
    }

    function cuencasDeptoDonutHandler() {
        return {
            when: (ctx) =>
            ctx.filtroNivel === "DEPTO" &&
            ctx.config.isHidro &&
            ctx.config.hidroType === "cuencas" &&
            ctx.config.isDeptoCuencasAgg &&
            ctx.config.cuencasAgg,

            run: async (ctx) => {
            try {
                const { groupField, areaCandidates } = ctx.config.cuencasAgg;

                const lyr = ctx.lyr || ctx.layer;
                await lyr.when();

                // 1) elegir campo de área existente
                const areaField = (typeof pickExistingField === "function"
                ? (pickExistingField(lyr, areaCandidates) || "areat")
                : "areat"
                );

                const url = ctx.config.url || lyr.url;

                // 2) sumar área por zonahid dentro del depto (ctx.whereBase ya trae dpcodigo = 'xx')
                const rows = await queryGroupSum({
                url,
                where: ctx.whereBase || "1=1",
                groupBy: groupField,
                field: areaField,
                outName: "sum_area",
                statisticType: "sum"
                });

                if (!ensureNonEmptyOrExit(ctx, rows)) return;

                const total = rows.reduce((acc, r) => acc + (Number(r.sum_area) || 0), 0);
                if (total <= 0) {
                ctx.destroyChart();
                ctx.actualizarLeyenda([], []);
                return;
                }

                // 3) construir diccionario zonahid -> {label,color} desde el renderer de la capa
                //    OJO: el renderer tiene value: "areahidro,zonahid" y label: "AreaName,ZonaName"
                const zonahidDict = new Map();
                const r = lyr.renderer;
                if (r && r.type === "unique-value" && Array.isArray(r.uniqueValueInfos)) {
                for (const info of r.uniqueValueInfos) {
                    const v = String(info.value ?? "");
                    const parts = v.split(",");
                    if (parts.length < 2) continue;
                    const zonahid = parts[1].trim();
                    if (!zonahid) continue;

                    const lblRaw = String(info.label ?? "");
                    const lblParts = lblRaw.split(",");
                    const zoneName = (lblParts.length >= 2) ? lblParts.slice(1).join(",").trim() : lblRaw.trim();

                    const color = (typeof getSymbolColorRGBA === "function")
                    ? getSymbolColorRGBA(info.symbol)
                    : "#999";

                    if (!zonahidDict.has(zonahid)) {
                    zonahidDict.set(zonahid, {
                        label: zoneName || `Zona ${zonahid}`,
                        color: color || "#999"
                    });
                    }
                }
                }

                // 4) armar items: porcentaje por zonahid
                const items = rows.map(r => {
                const code = String(r[groupField] ?? "").trim(); // zonahid
                const area = Number(r.sum_area) || 0;
                const pct = pctOfTotal(area, total);

                const info = zonahidDict.get(code);
                return {
                    code,
                    label: info?.label || `Zona ${code}`,
                    color: info?.color || "#999",
                    pct
                };
                });

                // ordenar desc (como tu donut)
                items.sort((a, b) => (b.pct || 0) - (a.pct || 0));

                const labels = items.map(x => x.label);
                const values = items.map(x => Number((x.pct || 0).toFixed(2)));
                const colors = items.map(x => x.color);

                // 5) título
                const depName = ctx.diccionarioDepartamentos?.[ctx.deptoActual] || ctx.deptoActual;
                ctx.setTitle(`Zonas hidrográficas presentes en el departamento de ${depName}`);

                // 6) doughnut
                ctx.crearGrafica(labels, values, colors, "doughnut", false);

                // hueco como tu imagen
                if (typeof chartInstance !== "undefined" && chartInstance) {
                chartInstance.options.cutout = "60%";
                chartInstance.update();
                }

                ctx.actualizarLeyenda(labels, colors);

            } catch (e) {
                console.error("CUENCAS_DEPTO error:", e);
                ctx.actualizarLeyenda([], []);
                ctx.destroyChart();
            }
            }
        };
    }                   

    function riesgoCCDeptoCountHandler() {
        return {
            when: (ctx) =>
            ctx.filtroNivel === "DEPTO" &&
            ctx.config.isDeptoRiskCount,

            run: async (ctx) => {
            try {
                const layerUrl = ctx.config.url || ctx.layer.url;

                // Normaliza where (y maneja el caso dpcodigo numérico)
                const buildWhere = () => {
                const wb = ctx.whereBase;
                if (wb && String(wb).trim()) return wb;

                if (ctx.deptoActual) {
                    const n = Number(ctx.deptoActual);
                    if (Number.isFinite(n)) return `dpcodigo = ${n}`;
                    return `dpcodigo = '${String(ctx.deptoActual).replace(/'/g, "''")}'`;
                }
                return "1=1";
                };

                const where = buildWhere();

                // --- intento 1: countDistinct (si el servidor lo soporta) ---
                const tryCountDistinct = async () => {
                return await ctx.arcRestQuery(layerUrl, {
                    f: "json",
                    where,
                    groupByFieldsForStatistics: "riesgocc",
                    outStatistics: JSON.stringify([{
                    statisticType: "countDistinct",
                    onStatisticField: "mpcodigo",
                    outStatisticFieldName: "mun_count"
                    }]),
                    returnGeometry: "false"
                });
                };

                // --- fallback: agrupar por (riesgocc, mpcodigo) y contar filas por riesgocc ---
                const fallbackGroupByMuni = async () => {
                return await ctx.arcRestQuery(layerUrl, {
                    f: "json",
                    where,
                    groupByFieldsForStatistics: "riesgocc,mpcodigo",
                    outStatistics: JSON.stringify([{
                    statisticType: "count",
                    onStatisticField: "mpcodigo",
                    outStatisticFieldName: "n"
                    }]),
                    returnGeometry: "false"
                });
                };

                let js;
                try {
                js = await tryCountDistinct();
                } catch (e) {
                console.warn("RIESGO_CC_DEPTO: countDistinct no soportado, usando fallback.", e);
                js = await fallbackGroupByMuni();
                }

                const rows = (js.features || []).map(f => f.attributes || {});
                if (!rows.length) {
                ctx.destroyChart();
                ctx.actualizarLeyenda([], []);
                return;
                }

                // Construir conteos:
                // - Si venimos de countDistinct: viene "mun_count" por riesgocc.
                // - Si venimos del fallback: viene 1 fila por (riesgocc, mpcodigo) => sumamos 1 por cada fila.
                const byRisk = new Map(); // key: 0..5 (0 = sin info)
                const isFallback = rows.some(r => r.mpcodigo != null); // heuristic: en fallback hay mpcodigo

                for (const r of rows) {
                const rawRisk = r.riesgocc;
                const k = (rawRisk == null || rawRisk === "") ? 0 : Number(rawRisk);
                if (!Number.isFinite(k)) continue;

                if (isFallback) {
                    byRisk.set(k, (byRisk.get(k) || 0) + 1);
                } else {
                    const c = Number(r.mun_count) || 0;
                    byRisk.set(k, (byRisk.get(k) || 0) + c);
                }
                }

                // Labels en el orden de tu leyenda fija (Sin info, Muy bajo, Bajo, Medio, Alto, Muy alto)
                const labels = (typeof LEYENDA_RIESGO_CC !== "undefined" ? LEYENDA_RIESGO_CC : []).map(x => x.label);
                const colors = (typeof LEYENDA_RIESGO_CC !== "undefined" ? LEYENDA_RIESGO_CC : []).map(x => x.color);

                // OJO: aquí sí usamos 0..5 (0 = sin info, 1..5 niveles)
                const values = [0, 1, 2, 3, 4, 5].map(k => byRisk.get(k) || 0);

                // Gráfico: barras verticales (X: niveles, Y: cantidad)
                ctx.crearGrafica(labels, values, colors, "bar", true);

                // Título y leyenda
                ctx.actualizarTituloGrafico(ctx.config, null, null);
                ctx.actualizarLeyenda(labels, colors);

            } catch (e) {
                console.error("RIESGO_CC_DEPTO error:", e);
                ctx.actualizarLeyenda([], []);
                ctx.destroyChart();
            }
            }
        };
    }

    function degradacionDeptoStackedHandler() {
        return {
            when: (ctx) =>
            ctx.filtroNivel === "DEPTO" &&
            ctx.config.isFenomenos &&
            ctx.config.fenomenosType === "degradacion" &&
            ctx.config.isDeptoDegStacked &&
            ctx.config.degDeptoAgg,

            run: async (ctx) => {
            try {
                const { classField, gradeField, areaField } = ctx.config.degDeptoAgg;

                const outStatistics = [{
                statisticType: "sum",
                onStatisticField: areaField,
                outStatisticFieldName: "sum_area"
                }];

                const js = await ctx.arcRestQuery(ctx.config.url || ctx.layer.url, {
                f: "json",
                where: ctx.whereBase || "1=1",
                groupByFieldsForStatistics: `${classField},${gradeField}`,
                outStatistics: JSON.stringify(outStatistics),
                returnGeometry: "false"
                });

                const rows = (js.features || []).map(f => f.attributes || {});
                if (!rows.length) {
                ctx.destroyChart();
                ctx.actualizarLeyenda([], []);
                return;
                }

                // total area depto (solo dentro de la selección depto)
                const total = rows.reduce((acc, r) => acc + (Number(r.sum_area) || 0), 0);
                if (total <= 0) {
                ctx.destroyChart();
                ctx.actualizarLeyenda([], []);
                return;
                }

                // ---------- Helpers: labels y colores ----------
                // 1) Grado (gradodeg) -> label/color
                //    Usa coloresDegradacion si lo tienes, sino cae a colores básicos.
                const gradoInfo = (code) => {
                const k = String(code ?? "").trim();
                const d = (typeof coloresDegradacion !== "undefined") ? coloresDegradacion : null;
                if (d && d[k]) return { code: k, label: d[k].label || k, color: d[k].color || "#999" };

                // fallback por nombres comunes
                const low = k.toLowerCase();
                if (low.includes("lig")) return { code: k, label: "Ligera", color: "#f2c400" };
                if (low.includes("mod")) return { code: k, label: "Moderada", color: "#f39c12" };
                if (low.includes("sev")) return { code: k, label: "Severa", color: "#d35400" };
                if (low.includes("sin")) return { code: k, label: "Sin evidencia", color: "#b0b0b0" };
                return { code: k || "NA", label: k || "Sin evidencia", color: "#b0b0b0" };
                };

                // 2) Clase (clasedeg) -> label (si tienes diccionario úsalo)
                //    Si no existe, usa el valor tal cual.
                const claseInfo = (code) => {
                const k = String(code ?? "").trim();

                if (clasesDegradacion[k]) {
                    return {
                        code: k,
                        label: clasesDegradacion[k]
                    };
                }

                const d = (typeof coloresClaseDegradacion !== "undefined") ? coloresClaseDegradacion : null;
                if (d && d[k]) {
                    return {
                        code: k,
                        label: d[k].label || k
                    };
                }

                return {
                    code: k || "NA",
                    label: k || "Sin evidencia"
                };
            };

                // ---------- Construir matriz clase->grado->pct ----------
                const classSet = new Set();
                const gradeSet = new Set();
                const matrix = {}; // matrix[classCode][gradeCode] = pct

                for (const r of rows) {
                const c = claseInfo(r[classField]);
                const g = gradoInfo(r[gradeField]);

                classSet.add(c.code);
                gradeSet.add(g.code);

                if (!matrix[c.code]) matrix[c.code] = {};
                const pct = ((Number(r.sum_area) || 0) / total) * 100;
                matrix[c.code][g.code] = (matrix[c.code][g.code] || 0) + pct;
                }

                // Orden “bonito” por etiqueta (como tu imagen)
                const desiredClassOrder = ["Laminar", "Laminar y Surcos", "Terraceo y Laminar", "Sin evidencia"];

                const classArr = Array.from(classSet).map(code => ({
                code,
                label: claseInfo(code).label
                }));

                classArr.sort((a, b) => {
                const ia = desiredClassOrder.indexOf(a.label);
                const ib = desiredClassOrder.indexOf(b.label);
                const ra = (ia === -1) ? 999 : ia;
                const rb = (ib === -1) ? 999 : ib;
                if (ra !== rb) return ra - rb;
                return String(a.label).localeCompare(String(b.label), "es");
                });

                // Orden grados (ligera→moderada→severa→sin evidencia)
                const desiredGradeOrder = ["Ligera", "Moderada", "Severa", "Sin evidencia"];
                const gradeArr = Array.from(gradeSet).map(code => ({
                code,
                ...gradoInfo(code)
                }));

                gradeArr.sort((a, b) => {
                const ia = desiredGradeOrder.indexOf(a.label);
                const ib = desiredGradeOrder.indexOf(b.label);
                const ra = (ia === -1) ? 999 : ia;
                const rb = (ib === -1) ? 999 : ib;
                if (ra !== rb) return ra - rb;
                return String(a.label).localeCompare(String(b.label), "es");
                });

                const xLabels = classArr.map(x => x.label);

                const datasets = gradeArr.map(g => ({
                label: g.label,
                data: classArr.map(c => Number((matrix[c.code]?.[g.code] || 0).toFixed(2))),
                backgroundColor: g.color,
                borderColor: "#fff",
                borderWidth: 1,
                stack: "Stack 0",
                gradeCode: g.code
                }));

                // Título
                const depName = ctx.diccionarioDepartamentos?.[ctx.deptoActual] || ctx.deptoActual;
                ctx.setTitle(`Grado y clase de degradación del suelo en el departamento de ${depName}`);

                // Crear apilado vertical + leyenda
                ctx.crearGrafica(xLabels, null, null, "bar", true, datasets);
                // ctx.actualizarLeyenda(datasets.map(d => d.label), datasets.map(d => d.backgroundColor));

            } catch (e) {
                console.error("DEGRADACION_DEPTO stacked error:", e);
                ctx.actualizarLeyenda([], []);
                ctx.destroyChart();
            }
            }
        };
    }

    function conflictosSueloDeptoPctHandler() {
        return {
            when: (ctx) =>
            ctx.filtroNivel === "DEPTO" &&
            ctx.config.isSuelos &&
            ctx.config.isDeptoConflictosAgg &&
            ctx.config.conflictosAgg,

            run: async (ctx) => {
            try {
                const { groupField, numField } = ctx.config.conflictosAgg;

                const lyr = ctx.lyr || ctx.layer;
                await lyr.when();

                // 1) Numerador: SUM(areat) agrupado por tconflicto
                const js = await ctx.arcRestQuery(ctx.config.url || lyr.url, {
                f: "json",
                where: ctx.whereBase || "1=1",
                groupByFieldsForStatistics: groupField,
                outStatistics: JSON.stringify([{
                    statisticType: "sum",
                    onStatisticField: numField,
                    outStatisticFieldName: "sum_area"
                }]),
                returnGeometry: "false"
                });

                const rows = (js.features || []).map(f => f.attributes || {});
                if (!rows.length) {
                ctx.destroyChart();
                ctx.actualizarLeyenda([], []);
                return;
                }

                // 2) Total para porcentaje
                const total = rows.reduce((acc, r) => acc + (Number(r.sum_area) || 0), 0);
                if (total <= 0) {
                ctx.destroyChart();
                ctx.actualizarLeyenda([], []);
                return;
                }

                // 3) Armar dict desde renderer (labels + colores)
                //    (usa helper si lo tienes; si no, lo construye igual)
                const dictFromRenderer =
                (typeof buildDictFromUniqueValueRenderer === "function")
                    ? buildDictFromUniqueValueRenderer(lyr)
                    : (() => {
                        const m = new Map();
                        const r = lyr?.renderer;
                        if (!r || r.type !== "unique-value") return m;

                        (r.uniqueValueInfos || []).forEach(info => {
                        const v = String(info.value ?? "").trim(); // 16001..16012
                        const lbl = String(info.label ?? v).trim();
                        const col = (typeof getSymbolColorRGBA === "function" ? getSymbolColorRGBA(info.symbol) : "#999") || "#999";
                        if (v) m.set(v, { label: lbl || v, color: col });
                        });
                        return m;
                    })();

                // 4) Items: % por categoría
                const items = rows.map(r => {
                const code = String(r[groupField] ?? "").trim();
                const area = Number(r.sum_area) || 0;
                const pct = (area / total) * 100;
                const info = dictFromRenderer.get(code);

                return {
                    code,
                    label: info?.label || code || "Sin información",
                    color: info?.color || "#999",
                    pct
                };
                });

                // 5) Orden (por código asc). Si prefieres por % desc, cambia el sort.
                items.sort((a, b) => Number(a.code) - Number(b.code));

                const labels = items.map(x => x.label);
                const values = items.map(x => Number(x.pct.toFixed(2)));
                const colors = items.map(x => x.color);

                // 6) Título
                const depName = ctx.diccionarioDepartamentos?.[ctx.deptoActual] || ctx.deptoActual;
                ctx.setTitle(`Porcentaje de tipos de conflicto de uso del suelo en el departamento de ${depName}`);

                // 7) Gráfico: horizontal (como tu screenshot)
                ctx.crearGrafica(labels, values, colors, "bar", false); // horizontal
                ctx.actualizarLeyenda(labels, colors);

            } catch (e) {
                console.error("CONFLICTOS_DEPTO error:", e);
                ctx.actualizarLeyenda([], []);
                ctx.destroyChart();
            }
            }
        };
    }

    function ordenSueloDeptoPieHandler() {
        return {
            when: (ctx) =>
            ctx.filtroNivel === "DEPTO" &&
            ctx.config.isSuelos &&
            ctx.config.isDeptoSoilAgg &&
            ctx.config.soilAgg,

            run: async (ctx) => {
            try {
                const { groupField, numField, denField } = ctx.config.soilAgg;
                const url = ctx.config.url || ctx.layer.url;

                // 1) Numerador: sum(areat) agrupado por ordsuelo
                const jsNum = await ctx.arcRestQuery(url, {
                f: "json",
                where: ctx.whereBase || "1=1",
                groupByFieldsForStatistics: groupField,
                outStatistics: JSON.stringify([{
                    statisticType: "sum",
                    onStatisticField: numField,
                    outStatisticFieldName: "sum_num"
                }]),
                returnGeometry: "false"
                });

                const rowsNum = (jsNum.features || []).map(f => f.attributes || {});
                if (!rowsNum.length) {
                ctx.destroyChart();
                ctx.actualizarLeyenda([], []);
                return;
                }

                // 2) Denominador: sum(Shape_Area) total (sin group)
                const jsDen = await ctx.arcRestQuery(url, {
                f: "json",
                where: ctx.whereBase || "1=1",
                outStatistics: JSON.stringify([{
                    statisticType: "sum",
                    onStatisticField: denField,
                    outStatisticFieldName: "sum_den"
                }]),
                returnGeometry: "false"
                });

                const den = Number(jsDen?.features?.[0]?.attributes?.sum_den) || 0;
                if (den <= 0) {
                ctx.destroyChart();
                ctx.actualizarLeyenda([], []);
                return;
                }

                // 3) Colores/labels: intentar sacarlos del renderer del servicio
                //    OJO: tu código original usaba "layer?.renderer", aquí conservamos la misma idea,
                //    pero usamos ctx.layer para que coincida con lo que está en actualizarGrafica.
                const dictFromRenderer =
                (typeof buildDictFromUniqueValueRenderer === "function")
                    ? buildDictFromUniqueValueRenderer(ctx.layer)
                    : (() => {
                        const m = new Map();
                        const r = ctx.layer?.renderer;
                        if (!r || r.type !== "unique-value") return m;

                        (r.uniqueValueInfos || []).forEach(info => {
                        const v = String(info.value ?? "").trim();
                        const lbl = String(info.label ?? v).trim();
                        const col = (typeof getSymbolColorRGBA === "function" ? getSymbolColorRGBA(info.symbol) : "#999") || "#999";
                        if (v) m.set(v, { label: lbl || v, color: col });
                        });
                        return m;
                    })();

                // 4) Armar % por categoría
                const items = rowsNum
                .map(r => {
                    const code = String(r[groupField] ?? "").trim();
                    const sumNum = Number(r.sum_num) || 0;
                    const pct = (sumNum * 100) / den;

                    const info = dictFromRenderer.get(code);
                    return {
                    code,
                    label: info?.label || code || "Sin información",
                    color: info?.color || "#999",
                    pct
                    };
                })
                .filter(x => x.code || x.label)
                .sort((a, b) => (b.pct || 0) - (a.pct || 0)); // mayor primero

                const labels = items.map(x => x.label);
                const values = items.map(x => Number((x.pct || 0).toFixed(2)));
                const colors = items.map(x => x.color);

                // Título (depto)
                const depName = ctx.diccionarioDepartamentos?.[ctx.deptoActual] || ctx.deptoActual;
                ctx.setTitle("Distribución de órdenes y fertilidad de los suelos");

                // 5) PIE (torta)
                ctx.crearGrafica(labels, values, colors, "pie", false);
                ctx.actualizarLeyenda(labels, colors);

            } catch (e) {
                console.error("ORDEN_SUELO_DEPTO pie error:", e);
                ctx.actualizarLeyenda([], []);
                ctx.destroyChart();
            }
            }
        };
    }

    function climaDeptoAggStackedHandler() {
        return {
            when: (ctx) =>
            ctx.filtroNivel === "DEPTO" &&
            ctx.config.isClima &&
            ctx.config.isDeptoClimaAgg &&
            ctx.config.deptoClimaAgg,

            run: async (ctx) => {
            try {
                const { periodField, rangeField, valueField, statisticType } = ctx.config.deptoClimaAgg;

                const outStatistics = [{
                statisticType: statisticType || "sum",
                onStatisticField: valueField,
                outStatisticFieldName: "v_sum"
                }];

                // stats agrupadas por (periodo, rango)
                const js = await ctx.arcRestQuery(ctx.config.url || ctx.layer.url, {
                f: "json",
                where: ctx.whereBase || "1=1",
                groupByFieldsForStatistics: `${periodField},${rangeField}`,
                outStatistics: JSON.stringify(outStatistics),
                returnGeometry: "false"
                });

                const rows = (js.features || []).map(f => f.attributes || {});
                if (!rows.length) {
                ctx.destroyChart();
                ctx.actualizarLeyenda([], []);
                return;
                }

                // Armar dataByPeriod[periodo][rango] = sum
                const dataByPeriod = {};
                const rangeSet = new Set();

                for (const r of rows) {
                const periodo = String(r[periodField] ?? "");
                const rango = String(r[rangeField] ?? "");
                const v = Number(r.v_sum) || 0;
                if (!periodo || !rango) continue;

                if (!dataByPeriod[periodo]) dataByPeriod[periodo] = {};
                dataByPeriod[periodo][rango] = (dataByPeriod[periodo][rango] || 0) + v;
                rangeSet.add(rango);
                }

                // Meses ordenados fijos
                let xLabels = [];

                // si es mensual (temp/precip) usa Enero..Diciembre
                const isMensual = (ctx.config.climaType === "temp" || ctx.config.climaType === "precip");

                if (isMensual) {
                xLabels = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
                xLabels.forEach(m => { if (!dataByPeriod[m]) dataByPeriod[m] = {}; });
                } else {
                // CC: periodos reales (2021-2040, 2041-2060...) ordenados por el primer año
                xLabels = Object.keys(dataByPeriod).sort((a,b) => {
                    const ya = parseInt(String(a).match(/\d{4}/)?.[0] || "9999", 10);
                    const yb = parseInt(String(b).match(/\d{4}/)?.[0] || "9999", 10);
                    return ya - yb;
                });
                }
                xLabels.forEach(m => { if (!dataByPeriod[m]) dataByPeriod[m] = {}; });

                // Normalizar por mes para que cada mes sume 100
                for (const mes of xLabels) {
                const obj = dataByPeriod[mes] || {};
                const total = Object.values(obj).reduce((a,b) => a + (Number(b) || 0), 0);
                if (total > 0) {
                    Object.keys(obj).forEach(k => { obj[k] = (obj[k] / total) * 100; });
                }
                }

                // Colores según climaType
                let dict = {};
                if (ctx.config.climaType === "temp") dict = (typeof coloresTemperatura !== "undefined") ? coloresTemperatura : {};
                if (ctx.config.climaType === "precip") dict = (typeof coloresPrecipitacion !== "undefined") ? coloresPrecipitacion : {};
                if (ctx.config.climaType === "temp_cc") dict = (typeof coloresCambioTemp !== "undefined") ? coloresCambioTemp : {};
                if (ctx.config.climaType === "precip_cc") dict = (typeof coloresCambioPrecip !== "undefined") ? coloresCambioPrecip : {};

                const rangesArray = Array.from(rangeSet).sort((a,b) => Number(a) - Number(b));

                const datasets = rangesArray.map(rangeCode => {
                const info = dict?.[rangeCode];
                const rangeLabel = info ? info.label : String(rangeCode);
                const rangeColor = info ? info.color : "#999";
                const dataPoints = xLabels.map(m => dataByPeriod[m]?.[rangeCode] || 0);

                return {
                    label: rangeLabel,
                    data: dataPoints,
                    backgroundColor: rangeColor,
                    borderColor: "#fff",
                    borderWidth: 1,
                    stack: "Stack 0",
                    rangeCode
                };
                });

                // gráfico stacked vertical
                ctx.crearGrafica(xLabels, null, null, "bar", true, datasets);

                // conservar tu comportamiento: título con tu función existente
                ctx.actualizarTituloGrafico(ctx.config, null, null);

            } catch (e) {
                console.error("CLIMA DEPTO AGG error:", e);
                ctx.actualizarLeyenda([], []);
            }
            }
        };
    }

    function hipsometriaDeptoAggHandler() {
        return {
            when: (ctx) =>
            ctx.config.isDeptoAgg &&
            ctx.config.deptoAgg,

            run: async (ctx) => {
            try {
                const { groupField, numField } = ctx.config.deptoAgg;

                const outStatistics = [{
                statisticType: "sum",
                onStatisticField: numField,
                outStatisticFieldName: "sum_area"
                }];

                const js = await ctx.arcRestQuery(ctx.config.url || ctx.layer.url, {
                f: "json",
                where: ctx.whereBase || "1=1",
                groupByFieldsForStatistics: groupField,
                outStatistics: JSON.stringify(outStatistics),
                returnGeometry: "false"
                });

                const rows = (js.features || []).map(f => f.attributes || {});
                if (!rows.length) {
                ctx.destroyChart();
                ctx.actualizarLeyenda([], []);
                return;
                }

                // total
                const total = rows.reduce((acc, r) => acc + (Number(r.sum_area) || 0), 0);
                if (total <= 0) {
                ctx.destroyChart();
                ctx.actualizarLeyenda([], []);
                return;
                }

                // Orden por códigos hipsométricos (1001..)
                const codesOrden = Object.keys((typeof coloresHipsometricos !== "undefined" && coloresHipsometricos) ? coloresHipsometricos : {})
                .map(Number).sort((a, b) => a - b).map(String);

                const mapByCode = new Map(
                rows.map(r => [String(r[groupField]), (Number(r.sum_area) || 0)])
                );

                const codes = codesOrden
                .filter(c => (mapByCode.get(c) || 0) > 0)
                .reverse();

                const labels = codes.map(c => coloresHipsometricos?.[c]?.label || c);
                const values = codes.map(c => ((mapByCode.get(c) || 0) / total) * 100);
                const colors = codes.map(c => coloresHipsometricos?.[c]?.color || "#999");

                // Título departamental
                const depName = ctx.diccionarioDepartamentos?.[ctx.deptoActual] || ctx.deptoActual;
                ctx.setTitle(`Distribución de rangos hipsométricos en el departamento de ${depName}`);

                // Horizontal bar (como tu caso especial)
                ctx.crearGrafica(labels, values.map(v => Number(v.toFixed(3))), colors, "bar", false);
                ctx.actualizarLeyenda(labels, colors);

            } catch (e) {
                console.error("DEPT AGG error:", e);
                ctx.actualizarLeyenda([], []);
            }
            }
        };
    }

    function bf3GeoformasDeptoPieHandler() {
        return {
            when: (ctx) =>
            ctx.config.isBF3 &&
            ctx.config.bf3,

            run: async (ctx) => {
            try {
                const where = ctx.whereBase || "1=1";

                // usa la capa REAL para leer fields/renderer
                const bf3Layer = ctx.lyr || ctx.layer;
                await bf3Layer.when();

                // detectar el nombre real del área (puede variar)
                const shapeAreaField = (typeof pickExistingField === "function")
                ? pickExistingField(bf3Layer, [
                    "st_area(shape)",   // tu campo real
                    "shape_area", "shape__area", "Shape_Area", "Shape__Area"
                    ])
                : null;

                if (!shapeAreaField) {
                console.error("BF3: No se encontró campo Shape_Area/Shape__Area/shape_area en la capa.");
                ctx.destroyChart();
                ctx.actualizarLeyenda([], []);
                return;
                }

                // stats: SUM(areat) y SUM(Shape_Area) por paisaje, filtrado por depto (whereBase)
                const rows = await fetchBF3Stats({
                layerUrl: ctx.config.url || ctx.layer.url,
                where,
                groupField: ctx.config.bf3.groupField, // "paisaje"
                numField: ctx.config.bf3.numField,     // "areat"
                denField: shapeAreaField               // Shape_Area real
                });

                if (!rows.length) {
                ctx.destroyChart();
                ctx.actualizarLeyenda([], []);
                return;
                }

                // denominador departamental = SUM(Shape_Area) total (sumando sum_den de todos los grupos)
                let sumShapeAreaDept = 0;
                const aggNumByCat = new Map(); // cat -> sum(areat)

                for (const r of rows) {
                const cat = r[ctx.config.bf3.groupField];
                const sumNum = Number(r.sum_num) || 0;
                const sumDen = Number(r.sum_den) || 0;

                sumShapeAreaDept += sumDen;

                const k = (cat == null || cat === "") ? "SIN_DATO" : String(cat);
                aggNumByCat.set(k, (aggNumByCat.get(k) || 0) + sumNum);
                }

                if (sumShapeAreaDept <= 0) {
                ctx.destroyChart();
                ctx.actualizarLeyenda([], []);
                console.warn("BF3: Sumatoria Shape_Area del depto = 0");
                return;
                }

                // renderer => label + color correctos
                const paisDict = buildPaisajeDictFromRenderer(bf3Layer);

                // total departamental con el MISMO numerador (areat)
                let totalAreat = 0;
                for (const v of aggNumByCat.values()) totalAreat += v;

                if (totalAreat <= 0) {
                ctx.destroyChart();
                ctx.actualizarLeyenda([], []);
                console.warn("BF3: Sumatoria areat del depto = 0");
                return;
                }

                console.log("BF3 rows:", rows.length);
                console.log("sumShapeAreaDept:", sumShapeAreaDept);
                console.log("totalAreat:", totalAreat);

                const entries = Array.from(aggNumByCat.entries())
                .map(([code, sumAreat]) => {
                    const info = paisDict.get(String(code)) || paisDict.get(normKey(code));
                    const label = info?.label || String(code);
                    const color = info?.color || "#999";

                    // porcentaje real (0..100)
                    const pct = (sumAreat / totalAreat) * 100;

                    return { code: String(code), label, color, pct };
                })
                .filter(x => Number.isFinite(x.pct))
                .sort((a, b) => b.pct - a.pct);

                // conserva el side-effect global
                bf3LabelToCode = new Map(entries.map(e => [e.label, e.code]));

                const labels = entries.map(e => e.label);
                const values = entries.map(e => Number(e.pct.toFixed(3))); // 3 decimales
                const colors = entries.map(e => e.color);

                ctx.crearGrafica(labels, values, colors, "pie", false);
                ctx.actualizarLeyenda(labels, colors);

            } catch (e) {
                console.error("BF3 error:", e);
                ctx.actualizarLeyenda([], []);
            }
            }
        };
    }

    function defaultQueryAndRenderHandler() {
        return {
            // Catch-all: siempre aplica si nadie aplicó antes
            when: (_ctx) => true,

            run: async (ctx) => {
                // ====== 1) Query ======
                const thisCycle = ctx.cycleId;
                const thisLayer = ctx.layer;

                if (!thisLayer || thisLayer.destroyed) return;
                if (thisCycle !== renderCycleId) return;

                const q = thisLayer.createQuery();
                q.where = ctx.whereBase;
                q.outFields = ctx.config.outFields;
                q.returnGeometry = false;

                let res;
                try {
                    res = await thisLayer.queryFeatures(q);
                } catch (e) {
                    const msg = String(e?.message || "").toLowerCase();

                    if (
                        e?.name === "AbortError" ||
                        msg.includes("aborted") ||
                        msg.includes("instance of 'esri.layers.featurelayer' is already destroyed") ||
                        msg.includes("instance-destroyed")
                    ) {
                        return;
                    }

                    console.error("defaultQueryAndRenderHandler queryFeatures error:", e);
                    ctx.destroyChart();
                    ctx.actualizarLeyenda([], []);
                    return;
                }

                // si cambió el ciclo o la capa ya no es la actual, ignora este resultado viejo
                if (thisCycle !== renderCycleId) return;
                if (!thisLayer || thisLayer.destroyed) return;
                if (thisLayer !== layerGlobal && !layersGlobal.includes(thisLayer)) return;
            // ====== 2) Fallback depto dpcodigo numérico ======
            // (idéntico a tu código)
            if (ctx.filtroNivel === "DEPTO" && ctx.deptoActual && res.features?.length === 0) {
                const n = Number(ctx.deptoActual);
                if (Number.isFinite(n)) {
                const altWhere = `dpcodigo = ${n}`;
                if (ctx.whereBase !== altWhere) {
                    ctx.whereBase = altWhere;

                    // IMPORTANTÍSIMO: mantener tu comportamiento
                    // (estas funciones son globales en tu proyecto)
                    whereBase = altWhere;
                    applyWhereToActiveLayers(whereBase);
                    cargarCapaActual();
                    return;
                }
                }
            }

            // ====== 3) Nombres mp/dp para título ======
            let mpnombre = null;
            let dpnombre = null;

            if (res.features.length > 0) {
                mpnombre = res.features[0].attributes.mpnombre;
                dpnombre = res.features[0].attributes.dpnombre;
            }

            if ((!mpnombre || !isNaN(mpnombre)) && ctx.municipioActual) {
                mpnombre = ctx.diccionarioMunicipios?.[ctx.municipioActual] || ctx.municipioActual;
            }

            if ((!dpnombre || !isNaN(dpnombre)) && ctx.municipioActual) {
                const dpCode = String(ctx.municipioActual).substring(0, 2);
                dpnombre = ctx.diccionarioDepartamentos?.[dpCode] || dpCode;
            }

            ctx.actualizarTituloGrafico(ctx.config, mpnombre, dpnombre);

            // ====== 4) Radar (Riesgo CC) ======
            if (ctx.config.isRadar) {
                let sumAmenaza = 0, sumSens = 0, sumCap = 0, sumVuln = 0, sumRiesgo = 0;
                let count = 0;

                res.features.forEach(f => {
                sumAmenaza += (f.attributes.amenaza || 0);
                sumSens   += (f.attributes.sensibilidad || 0);
                sumCap    += (f.attributes.capadapta || 0);
                sumVuln   += (f.attributes.vulnerabilidad || 0);
                sumRiesgo += (f.attributes.riesgocc || 0);
                count++;
                });

                if (count === 0) count = 1;

                const labels = ["Amenaza", "Sensibilidad", "Cap. Adaptación", "Vulnerabilidad", "Riesgo CC"];
                const values = [
                Number((sumAmenaza / count).toFixed(2)),
                Number((sumSens / count).toFixed(2)),
                Number((sumCap / count).toFixed(2)),
                Number((sumVuln / count).toFixed(2)),
                Number((sumRiesgo / count).toFixed(2))
                ];

                const bgColors = "rgba(171, 65, 36, 0.5)";
                ctx.crearGrafica(labels, values, bgColors, "radar", false);
                return;
            }

            // ====== 5) General render (SIN cambiar tu lógica) ======
            renderGeneralFromFeatures(ctx, res.features);
            }
        };
    }

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


    function renderGeneralFromFeatures(ctx, features) {
        const { config } = ctx;

        if (
            config?.isGeoforma &&
            config?.isGeoformaDualChart &&
            config?.geoAgg
        ) {
            const { field1, field2, valueField } = config.geoAgg;

            const pieMap = {};
            const donutMap = {};

            for (const f of features) {
                const a = f.attributes || {};

                const paisajeCode = String(a[field1] ?? "").trim();
                const relieveCode = String(a[field2] ?? "").trim();
                const porcentaje = Number(a[valueField]) || 0;

                const pair = geoformasRendererDict?.[`${paisajeCode}||${relieveCode}`];

                const paisajeLabel = pair?.paisajeLabel || paisajeCode || "Sin dato";
                const relieveLabel = pair?.relieveLabel || relieveCode || "Sin dato";

                pieMap[paisajeLabel] = (pieMap[paisajeLabel] || 0) + porcentaje;

                if (!donutMap[paisajeLabel]) donutMap[paisajeLabel] = {};
                donutMap[paisajeLabel][relieveLabel] = (donutMap[paisajeLabel][relieveLabel] || 0) + porcentaje;
            }

            const pieLabels = Object.keys(pieMap);
            const pieValues = pieLabels.map(l => Number(pieMap[l].toFixed(2)));
            const pieColors = pieLabels.map(l => getPaisajeColor(l));

            let selectedPaisaje = window.__geoformaSelectedPaisaje || pieLabels[0];
            if (!donutMap[selectedPaisaje]) {
                selectedPaisaje = pieLabels[0];
                window.__geoformaSelectedPaisaje = selectedPaisaje;
            }

            const donutLabels = Object.keys(donutMap[selectedPaisaje] || {});
            const donutValues = donutLabels.map(l => Number(donutMap[selectedPaisaje][l].toFixed(2)));
            const donutColors = donutLabels.map(l => getGeoformaColor(selectedPaisaje, l));

            crearGraficasGeoformasDual({
                pieLabels,
                pieValues,
                pieColors,
                donutLabels,
                donutValues,
                donutColors,
                selectedPaisaje
            });

            actualizarLeyenda(donutLabels, donutColors);
            return;
        }

        // =============================
        // ORDEN DEL SUELO - BUBBLE
        // X = fertilidad
        // Y = ordsuelo
        // radio = porcentaje
        // =============================
        if (
            config?.isSuelos &&
            config?.suelosType === "orden" &&
            config?.isBubbleOrdenSuelo &&
            config?.ordenAgg
        ) {
            const { yField, xField, valueField } = config.ordenAgg;

            const fertilidadInfo = (val) => {
                const k = String(val ?? "").trim();
                return {
                    code: k,
                    label: k || "Sin dato"
                };
            };

            const ordenInfo = (val) => {
                const k = String(val ?? "").trim();

                if (typeof coloresOrdenSuelo !== "undefined" && coloresOrdenSuelo && coloresOrdenSuelo[k]) {
                    return {
                        code: k,
                        label: coloresOrdenSuelo[k].label || k,
                        color: coloresOrdenSuelo[k].color || "#5DA5DA"
                    };
                }

                return {
                    code: k,
                    label: k || "Sin dato",
                    color: "#5DA5DA"
                };
            };

            const fertSet = new Set();
            const ordenSet = new Set();
            const grouped = [];

            for (const f of features) {
                const a = f.attributes || {};

                const fert = fertilidadInfo(a[xField]);
                const ord = ordenInfo(a[yField]);
                const pct = Number(a[valueField]) || 0;

                fertSet.add(fert.label);
                ordenSet.add(ord.code);

                grouped.push({
                    xLabel: fert.label,
                    xCode: fert.code,
                    yCode: ord.code,
                    yLabel: ord.label,
                    color: ord.color,
                    value: pct
                });
            }

            const desiredXOrder = [
                "Baja",
                "Media",
                "Alta",
                "Alta y media",
                "Media y baja",
                "Cuerpos de agua",
                "No aplica"
            ];

            const xLabels = Array.from(fertSet);
            xLabels.sort((a, b) => {
                const ia = desiredXOrder.indexOf(a);
                const ib = desiredXOrder.indexOf(b);
                const ra = ia === -1 ? 999 : ia;
                const rb = ib === -1 ? 999 : ib;
                if (ra !== rb) return ra - rb;
                return String(a).localeCompare(String(b), "es");
            });

            const ordenArr = Array.from(ordenSet).map(code => ordenInfo(code));

            // ordenar primero
            ordenArr.sort((a, b) => String(a.label).localeCompare(String(b.label), "es"));

            // yLabels DESPUÉS del sort
            const yLabels = ordenArr.map(o => o.label);

            const xIndex = new Map(xLabels.map((v, i) => [v, i]));
            const yIndex = new Map(ordenArr.map((v, i) => [v.code, i]));

            // dataset por orden del suelo
            const datasets = ordenArr.map(ord => {
                const points = grouped
                    .filter(g => g.yCode === ord.code)
                    .map(g => ({
                        x: xIndex.get(g.xLabel),
                        y: yIndex.get(g.yCode),

                        r: Math.max(8, Math.min(20, Math.sqrt(g.value) * 3.8)),

                        porcentaje: g.value,

                        // labels visibles
                        xLabel: g.xLabel,
                        yLabel: g.yLabel,

                        // valores reales para filtrar el mapa
                        xValue: g.xCode,
                        yValue: g.yCode
                    }));

                return {
                    label: ord.label,
                    data: points,
                    backgroundColor: ord.color,
                    borderColor: "#ffffff",
                    borderWidth: 1.2
                };
            });

            crearGraficaBubbleOrdenSuelo({
                xLabels,
                yLabels,
                datasets
            });

            ctx.actualizarLeyenda(
                ordenArr.map(o => o.label),
                ordenArr.map(o => o.color),
                ordenArr.map(o => o.code)
            );

            return;
        }

        // =============================
        // DEGRADACIÓN MUNICIPAL STACKED
        // X = clasedeg
        // Serie = gradodeg
        // Y = porcentaje
        // =============================
        if (
            config?.isFenomenos &&
            config?.fenomenosType === "degradacion" &&
            config?.isStackedDegradacion &&
            config?.degAgg
        ) {
            const { classField, gradeField, valueField } = config.degAgg;

            const gradoInfo = (code) => {
                const k = String(code ?? "").trim();
                const d = (typeof coloresDegradacion !== "undefined") ? coloresDegradacion : null;

                if (d && d[k]) {
                    return {
                        code: k,
                        label: d[k].label || k,
                        color: d[k].color || "#999"
                    };
                }

                return { code: k || "NA", label: k || "Sin evidencia", color: "#999" };
            };

            const claseInfo = (code) => {
                const k = String(code ?? "").trim();

                const clasesDegradacion = {
                    "19203": "Laminar",
                    "19204": "Laminar y surcos",
                    "19205": "Terraceo y laminar",
                    "19207": "Surcos y cárcavas",
                    "19208": "Sin evidencia",
                    "19209": "Sin evidencia"
                };

                if (clasesDegradacion[k]) {
                    return {
                        code: k,
                        label: clasesDegradacion[k]
                    };
                }

                const d = (typeof coloresClaseDegradacion !== "undefined") ? coloresClaseDegradacion : null;

                if (d && d[k]) {
                    return {
                        code: k,
                        label: d[k].label || k
                    };
                }

                return {
                    code: k || "NA",
                    label: k || "Sin evidencia"
                };
            };

            const matrix = {};
            const classSet = new Set();
            const gradeSet = new Set();

            for (const f of features) {
                const a = f.attributes || {};

                const c = claseInfo(a[classField]);
                const g = gradoInfo(a[gradeField]);
                const val = Number(a[valueField]) || 0;

                classSet.add(c.code);
                gradeSet.add(g.code);

                if (!matrix[c.code]) matrix[c.code] = {};
                matrix[c.code][g.code] = (matrix[c.code][g.code] || 0) + val;
            }

            const desiredClassOrder = [
                "Laminar",
                "Laminar y Surcos",
                "Terraceo y Laminar",
                "Surcos y cárcavas",
                "Sin evidencia"
            ];

            const classArr = Array.from(classSet).map(code => ({
                code,
                label: claseInfo(code).label
            }));

            classArr.sort((a, b) => {
                const ia = desiredClassOrder.indexOf(a.label);
                const ib = desiredClassOrder.indexOf(b.label);
                const ra = ia === -1 ? 999 : ia;
                const rb = ib === -1 ? 999 : ib;
                if (ra !== rb) return ra - rb;
                return String(a.label).localeCompare(String(b.label), "es");
            });

            const desiredGradeOrder = [
                "Ligera",
                "Moderada",
                "Severa",
                "Muy severa",
                "No suelo",
                "Sin evidencia"
            ];

            const gradeArr = Array.from(gradeSet).map(code => ({
                code,
                ...gradoInfo(code)
            }));

            gradeArr.sort((a, b) => {
                const ia = desiredGradeOrder.indexOf(a.label);
                const ib = desiredGradeOrder.indexOf(b.label);
                const ra = ia === -1 ? 999 : ia;
                const rb = ib === -1 ? 999 : ib;
                if (ra !== rb) return ra - rb;
                return String(a.label).localeCompare(String(b.label), "es");
            });

            const labels = classArr.map(c => claseInfo(c.code).label);

            const datasets = gradeArr.map(g => ({
                label: g.label,
                data: classArr.map(c => Number((matrix[c.code]?.[g.code] || 0).toFixed(2))),
                backgroundColor: g.color,
                borderColor: "#fff",
                borderWidth: 1,
                stack: "Stack 0",
                gradeCode: g.code
            }));

            ctx.crearGrafica(labels, null, null, "bar", true, datasets);
            ctx.actualizarLeyenda(
                datasets.map(d => d.label),
                datasets.map(d => d.backgroundColor)
            );

            return;
        }

        // =============================
        // CLIMA STACKED (Temperatura / Precipitación / CC)
        // =============================
        if (
            config?.isClima &&
            config.isStacked &&
            config.periodField &&
            ["temp", "precip", "temp_cc", "precip_cc"].includes(config.climaType)
        ) {
            const periodField = config.periodField;
            const rangeField = config.labelField;
            const valueField = config.valueField;

            let dict = {};
            if (config.climaType === "temp") dict = coloresTemperatura;
            if (config.climaType === "precip") dict = coloresPrecipitacion;
            if (config.climaType === "temp_cc") dict = coloresCambioTemp;
            if (config.climaType === "precip_cc") dict = coloresCambioPrecip;

            const matrix = {};
            const periodsSet = new Set();
            const rangesSet = new Set();

            for (const f of features) {
                const a = f.attributes || {};
                const period = String(a[periodField] ?? "").trim();
                const rangeCode = String(a[rangeField] ?? "").trim();
                const val = Number(a[valueField]) || 0;

                if (!period || !rangeCode) continue;

                periodsSet.add(period);
                rangesSet.add(rangeCode);

                matrix[rangeCode] = matrix[rangeCode] || {};
                matrix[rangeCode][period] = (matrix[rangeCode][period] || 0) + val;
            }

            const periods = ordenarMeses(Array.from(periodsSet));

            let ranges = Object.keys(dict)
                .map(String)
                .filter(code => rangesSet.has(code));

            const extras = Array.from(rangesSet)
                .map(String)
                .filter(code => !ranges.includes(code));

            ranges = [...ranges, ...extras];

            // Normalizar a 100 por periodo
            for (const p of periods) {
                let total = 0;
                for (const r of ranges) {
                    total += (Number(matrix?.[r]?.[p]) || 0);
                }

                if (total > 0) {
                    const factor = 100 / total;
                    for (const r of ranges) {
                        matrix[r][p] = (Number(matrix?.[r]?.[p]) || 0) * factor;
                    }
                }
            }

            // Mostrar slider, pero sin activar modo temporal todavía
            let safeIndex = timeSliderIndex;
            if (safeIndex >= (periods.length + 1)) safeIndex = 0;

            // NO usar ctx.whereBase porque cambia cuando filtras por periodo
            const sliderKey = [
                config.id,
                filtroNivel || "",
                deptoActual || "",
                municipioActual || ""
            ].join("|");

            showTimeSlider(periods, safeIndex, sliderKey);

            const orderedLabels = ranges.map(code => dict?.[code]?.label || code);
            const orderedColors = ranges.map(code => dict?.[code]?.color || "#999");

            // ==========================
            // CASO 1: como estaba antes
            // ==========================
            if (!timeSliderTouched) {
                const datasets = ranges.map(rangeCode => {
                    const info = dict[rangeCode];
                    return {
                        label: info ? info.label : rangeCode,
                        data: periods.map(p => Number(matrix?.[rangeCode]?.[p]) || 0),
                        backgroundColor: info?.color || "#999",
                        rangeCode
                    };
                });

                ctx.crearGrafica(periods, [], [], "bar", true, datasets);
                ctx.actualizarLeyenda(orderedLabels, orderedColors, ranges);
                return;
            }

            // ==========================
            // CASO 2: ya movió slider
            // ==========================
            const selectedPeriod = timeSliderPeriods[timeSliderIndex] || "Todos";

            if (selectedPeriod === "Todos") {
                const baseWhereStable = whereBase || "1=1";

                if (layerGlobal?.definitionExpression !== baseWhereStable) {
                    applyWhereToActiveLayers(baseWhereStable);
                }

                const datasets = ranges.map(rangeCode => {
                    const info = dict[rangeCode];
                    return {
                        label: info ? info.label : rangeCode,
                        data: periods.map(p => Number(matrix?.[rangeCode]?.[p]) || 0),
                        backgroundColor: info?.color || "#999",
                        rangeCode
                    };
                });

                ctx.crearGrafica(periods, [], [], "bar", true, datasets);
                ctx.actualizarLeyenda(orderedLabels, orderedColors, ranges);
                return;
            }

            const datasets = ranges.map(rangeCode => {
                const info = dict[rangeCode];
                return {
                    label: info ? info.label : rangeCode,
                    data: [Number(matrix?.[rangeCode]?.[selectedPeriod]) || 0],
                    backgroundColor: info?.color || "#999",
                    rangeCode
                };
            });

            const selectedPeriodSafe = String(selectedPeriod).replace(/'/g, "''");
            const baseWhereStable = whereBase || "1=1";
            const wherePeriodo = `${baseWhereStable} AND ${config.periodField} = '${selectedPeriodSafe}'`;

            // aplicar filtro sin contaminar el contexto del slider
            if (layerGlobal?.definitionExpression !== wherePeriodo) {
                applyWhereToActiveLayers(wherePeriodo);
            }

            ctx.crearGrafica([selectedPeriod], [], [], "bar", true, datasets);
            ctx.actualizarLeyenda(orderedLabels, orderedColors, ranges);

            return;
        }

        hideTimeSlider();

        // // =====================================================
        // // FIX: CLIMA apilado (temp/precip/temp_cc/precip_cc) por periodo
        // // Evita sumar porcentajes entre periodos (que rompe 100%)
        // // =====================================================
        // if (
        // config?.isClima &&
        // config.isStacked &&
        // config.periodField &&
        // ["temp", "precip", "temp_cc", "precip_cc"].includes(config.climaType)
        // ) {
        // const periodField = config.periodField;
        // const rangeField = config.labelField;     // ej: rangotcc / rangot / rangop / rangopcc
        // const valueField = config.valueField;     // porcentaje

        // // dict de colores/labels según tipo
        // let dict = {};
        // if (config.climaType === "temp") dict = coloresTemperatura;
        // if (config.climaType === "precip") dict = coloresPrecipitacion;
        // if (config.climaType === "temp_cc") dict = coloresCambioTemp;
        // if (config.climaType === "precip_cc") dict = coloresCambioPrecip;

        // // matriz: period -> rangeLabel -> valor
        // const matrix = {};
        // const rangesSet = new Set();
        // const periodsSet = new Set();

        // for (const f of features) {
        //     const a = f.attributes || {};
        //     const period = String(a[periodField] ?? "").trim();
        //     const rangeCode = a[rangeField];
        //     const val = Number(a[valueField]) || 0;

        //     if (!period) continue;

        //     const info = dict[rangeCode];
        //     const rangeLabel = info ? info.label : String(rangeCode);

        //     periodsSet.add(period);
        //     rangesSet.add(rangeLabel);

        //     matrix[period] = matrix[period] || {};
        //     matrix[period][rangeLabel] = (matrix[period][rangeLabel] || 0) + val;
        // }

        // // ordena periodos si quieres (si son strings tipo "2021-2100" quedará alfabético)
        // const periods = Array.from(periodsSet).sort();
        // const ranges = Array.from(rangesSet);

        // for (const p of periods) {
        //     const row = matrix[p] || {};
        //     const total = ranges.reduce((acc, r) => acc + (row[r] || 0), 0) || 1;
        //     for (const r of ranges) {
        //     row[r] = ((row[r] || 0) / total) * 100;
        //     }
        // }

        // // Construye datasets (stacked)
        // const datasets = ranges.map(rangeLabel => {
        //     // intenta recuperar color desde dict (buscando por label)
        //     let color = "#999";
        //     // si tienes labelInfo por label, úsalo; si no, busca en dict:
        //     for (const [code, info] of Object.entries(dict)) {
        //     if (info?.label === rangeLabel && info?.color) { color = info.color; break; }
        //     }

        //     return {
        //     label: rangeLabel,
        //     data: periods.map(p => (matrix[p]?.[rangeLabel] || 0)),
        //     backgroundColor: color
        //     };
        // });

        // ctx.crearGraficaStacked?.(periods, datasets, "bar", true); // true = vertical

        // // Si NO tienes crearGraficaStacked, dime y te paso el patch exacto de Chart.js
        // return;
        // }

        if (config?.isEcosistema && config.ecosistemaType === "deforestacion") {
            renderDeforestacionSerieTemporal(ctx, features);
            return;
        }
        if (config?.isSuelos && config.suelosType === "orden") {
            renderSuelosOrdenBubble(ctx, features);
            return;
        }
        const climaDict =
        (config.isClima && config.climaType === "temp") ? coloresTemperatura :
        (config.isClima && config.climaType === "precip") ? coloresPrecipitacion :
        (config.isClima && config.climaType === "temp_cc") ? coloresCambioTemp :
        (config.isClima && config.climaType === "precip_cc") ? coloresCambioPrecip :
        (config.isClima && config.climaType === "riesgo") ? coloresRiesgo :
        null;

        const hidroDict =
        (config.isHidro && config.hidroType === "escorrentia") ? coloresEscorrentia :
        null;

        const ecoDict =
        (config.isEcosistema && config.ecosistemaType === "deforestacion") ? coloresDeforestacion :
        (config.isEcosistema && config.ecosistemaType === "ecosistemas") ? coloresEcosistemas :
        null;

        const fenDict =
        (config.isFenomenos && config.fenomenosType === "inundaciones") ? coloresInundaciones :
        (config.isFenomenos && config.fenomenosType === "remocion") ? coloresRemocion :
        (config.isFenomenos && config.fenomenosType === "degradacion") ? coloresDegradacion :
        (config.isFenomenos && config.fenomenosType === "sismica") ? coloresSismica :
        null;
        

        // 2. Procesamiento General
        const data = {};
        const labelInfo = {};
        const dataByCode = {};

        features.forEach(f => {
            let key = "";
            let label = "";

            if (config.isGeoforma) {
            const p = f.attributes.paisaje;
            const t = f.attributes.trelieve;
            key = `${p},${t}`;

            const info = coloresGeoformas[key];
            label = info ? info.label : key;
            if (info) labelInfo[label] = info.color;

            } else if (config.isClima) {
            if (config.climaType === "clima_tipo") {
                const code = String(f.attributes[config.labelField]);
                const porcentaje = Number(f.attributes[config.valueField]) || 0;
                dataByCode[code] = (dataByCode[code] || 0) + porcentaje;

                const info = coloresClimas[code];
                const lbl = info ? info.label : code;
                if (info) labelInfo[lbl] = info.color;

                return;
            }

            key = f.attributes[config.labelField];
            let dict = {};
            if (config.climaType === "temp") dict = coloresTemperatura;
            if (config.climaType === "precip") dict = coloresPrecipitacion;
            if (config.climaType === "temp_cc") dict = coloresCambioTemp;
            if (config.climaType === "precip_cc") dict = coloresCambioPrecip;
            if (config.climaType === "riesgo") dict = coloresRiesgo;

            const info = dict[key];
            label = info ? info.label : key;
            if (info) labelInfo[label] = info.color;

            } else if (config.isHidro) {
            key = f.attributes[config.labelField];
            const pVal = Number(f.attributes[config.valueField]) || 0;

            if (config.hidroType === "cuencas") {
                label = String(key);

                const areaCode = String(f.attributes.areahidro ?? "");
                const areaInfo = coloresCuencas[areaCode];
                labelInfo[label] = areaInfo?.color || "#999";

                data[label] = (data[label] || 0) + pVal;
                return;
            }

            let dict = {};
            if (config.hidroType === "escorrentia") dict = coloresEscorrentia;

            const code = String(key);
            dataByCode[code] = (dataByCode[code] || 0) + pVal;

            const info = dict[code];
            label = info ? info.label : code;
            if (info?.color) labelInfo[label] = info.color;

            data[label] = (data[label] || 0) + pVal;

            } else if (config.isEcosistema) {
            if (config.ecosistemaType === "ecosistemas" && String(ctx.layer.url).endsWith("/25")) {
                const cond = f.attributes.condicion;
                const info = coloresCondicionEcos[cond];
                const label = info ? info.label : String(cond);
                if (info) labelInfo[label] = info.color;

                const pVal = Number(f.attributes[config.valueField]) || 0;
                data[label] = (data[label] || 0) + pVal;
                return;
            }

            key = f.attributes[config.labelField];
            let dict = {};
            if (config.ecosistemaType === "deforestacion") dict = coloresDeforestacion;
            if (config.ecosistemaType === "ecosistemas") dict = coloresEcosistemas;

            let info = dict[key];
            label = info ? info.label : key;

            if (info) labelInfo[label] = info.color;
            else if (config.ecosistemaType === "ecosistemas") {
                label = key;
                if (coloresEcosistemas[key]) labelInfo[label] = coloresEcosistemas[key].color;
                else labelInfo[label] = "#888";
            }

            } else if (config.isSuelos) {
            if (config.suelosType === "vocacion") {
                const voc = f.attributes.vocacion;
                const uso = f.attributes.usopvoc;
                key = `${voc},${uso}`;

                const info = coloresVocacion[key];
                label = info ? info.label : key;
                if (info) labelInfo[label] = info.color;

            } else {
                key = f.attributes[config.labelField];
                const info = coloresConflictos[key];
                label = info ? info.label : key;
                if (info) labelInfo[label] = info.color;
            }

            } else if (config.isFenomenos) {
            key = f.attributes[config.labelField];
            let dict = {};
            if (config.fenomenosType === "inundaciones") dict = coloresInundaciones;
            if (config.fenomenosType === "remocion") dict = coloresRemocion;
            if (config.fenomenosType === "degradacion") dict = coloresDegradacion;
            if (config.fenomenosType === "sismica") dict = coloresSismica;

            const info = dict[key];
            label = info ? info.label : key;
            if (info) labelInfo[label] = info.color;

            } else {
            key = f.attributes[config.labelField];
            const info = coloresHipsometricos[key];
            label = info ? info.label : key;
            if (info) labelInfo[label] = info.color;
            }

            const pVal = Number(f.attributes[config.valueField]) || 0;
            data[label] = (data[label] || 0) + pVal;
        });

        // ---- tus “special” dentro del general (igual) ----
        if (config.isClima && config.climaType === "clima_tipo") {
            const domainCodes = Object.keys(coloresClimas)
            .sort((a, b) => Number(a) - Number(b))
            .filter(c => (dataByCode[c] || 0) > 0);

            const orderedLabels = domainCodes.map(c => coloresClimas[c]?.label || c);
            const orderedValues = domainCodes.map(c => dataByCode[c] || 0);
            const orderedColors = domainCodes.map(c => coloresClimas[c]?.color || "#999");

            ctx.crearGrafica(orderedLabels, orderedValues, orderedColors, "bar", false);
            return;
        }

        if (config.id === "hipsometria") {
            const dataByCode2 = {};
            for (const [code, info] of Object.entries(coloresHipsometricos)) {
            const label = info.label;
            dataByCode2[String(code)] = Number(data[label]) || 0;
            }

            const codes = Object.keys(coloresHipsometricos)
            .map(Number)
            .sort((a, b) => a - b)
            .map(String);

            const codesFiltrados = codes.filter(c => (dataByCode2[c] || 0) > 0);

            let labelsH = codesFiltrados.map(c => coloresHipsometricos[c]?.label || c);
            let valuesH = codesFiltrados.map(c => dataByCode2[c] || 0);
            let colorsH = codesFiltrados.map(c => coloresHipsometricos[c]?.color || "#999");

            labelsH = labelsH.reverse();
            valuesH = valuesH.reverse();
            colorsH = colorsH.reverse();

            ctx.crearGrafica(labelsH, valuesH, colorsH, "bar", false);
            return;
        }

        if (config.isHidro && config.hidroType === "escorrentia") {
            const codes = Object.keys(dataByCode).sort((a, b) => Number(a) - Number(b));

            const labelsEsc = codes.map(c => coloresEscorrentia[c]?.label || c);
            const valuesEsc = codes.map(c => dataByCode[c] || 0);
            const colorsEsc = codes.map(c => coloresEscorrentia[c]?.color || "#999");

            ctx.crearGrafica(labelsEsc, valuesEsc, colorsEsc, "line", false);
            return;
        }

        let labels = Object.keys(data);
        let values = Object.values(data);
        let bgColors = labels.map(l => labelInfo[l] || "#999");

        // =====================================================
        // ORDEN PARA DEGRADACIÓN
        // =====================================================
        if (config?.isFenomenos && config?.fenomenosType === "degradacion") {

            const rows = labels.map((label, i) => ({
                label,
                value: Number(values[i]) || 0,
                color: bgColors[i]
            }));

            rows.sort((a, b) =>
                (ORDEN_DEGRADACION[a.label] ?? 999) -
                (ORDEN_DEGRADACION[b.label] ?? 999)
            );

            labels = rows.map(r => r.label);
            values = rows.map(r => r.value);
            bgColors = rows.map(r => r.color);
        }

        // =====================================================
        // ORDEN PARA SÍSMICA
        // =====================================================
        if (config?.isFenomenos && config?.fenomenosType === "sismica") {

            const rows = labels.map((label, i) => ({
                label,
                value: Number(values[i]) || 0,
                color: bgColors[i]
            }));

            rows.sort((a, b) =>
                (ORDEN_SISMICA[a.label] ?? 999) -
                (ORDEN_SISMICA[b.label] ?? 999)
            );

            labels = rows.map(r => r.label);
            values = rows.map(r => r.value);
            bgColors = rows.map(r => r.color);
        }

        if (config?.isFenomenos && config?.fenomenosType === "inundaciones") {
            const ordenInundaciones = {
                "Muy baja": 1,
                "Baja": 2,
                "Media": 3,
                "Alta": 4,
                "Muy alta": 5,
                "Sin información": 99
            };

            const rows = labels.map((label, i) => ({
                label,
                value: Number(values[i]) || 0,
                color: bgColors[i]
            }));

            rows.sort((a, b) => {
                const oa = ordenInundaciones[a.label] ?? 999;
                const ob = ordenInundaciones[b.label] ?? 999;
                return oa - ob;
            });

            labels = rows.map(r => r.label);
            values = rows.map(r => r.value);
            bgColors = rows.map(r => r.color);
        }

        //  ORDENAR SOLO PARA "Ecosistemas" (municipal) por % desc
        if (config?.isEcosistema && config.ecosistemaType === "ecosistemas") {
            const rows = labels.map((label, i) => ({
                label,
                value: Number(values[i]) || 0,
                color: bgColors[i]
        }));

            rows.sort((a, b) => b.value - a.value);

            labels = rows.map(r => r.label);
            values = rows.map(r => r.value);
            bgColors = rows.map(r => r.color);
        }

        let chartType = "bar";
        let isVertical = false;

        if (config.isGeoforma) chartType = "pie";
        else if (config.isHidro) {
            if (config.hidroType === "cuencas") chartType = "pie";
            else {
            chartType = (config.hidroType === "escorrentia") ? "line" : "bar";
            if (chartType === "bar") isVertical = true;
            }
        }
        else if (config.isEcosistema) {
            chartType = (config.ecosistemaType === "deforestacion") ? "line" : "bar";
        }
        else if (config.isSuelos) {
            chartType = "bar";

        }
        else if (config.isFenomenos) {
            chartType = (config.fenomenosType === "remocion") ? "pie" : "bar";
            if (chartType === "bar") isVertical = true;
        }
        else if (config.isClima) {
            chartType = "bar";
            if (["temp", "precip", "temp_cc", "precip_cc"].includes(config.climaType)) isVertical = true;
            if (config.climaType === "riesgo") chartType = "radar";
        }
        
        if (config?.isSuelos && config?.suelosType === "orden") {
            titleElement.textContent = "Distribución de órdenes y fertilidad de los suelos";
            return;
        }

        ctx.crearGrafica(labels, values, bgColors, chartType, isVertical);

        if (!(config?.isFenomenos && config?.fenomenosType === "degradacion")) {
            ctx.actualizarLeyenda(labels, bgColors);
        }
    }

    function renderDeforestacionSerieTemporal(ctx, features) {
        const { config } = ctx;
        if (!features?.length) return;

        const periodField = "periodobosque";
        const dynField = "cambiobosque";
        const valueField = "porcentaje";

        const colorDef = "rgba(255, 127, 127, 1)";
        const colorReg = "rgba(76, 230, 0, 1)";

        const periodsSet = new Set();

        for (const f of features) {
            const a = f.attributes || {};
            const periodo = String(a[periodField] ?? "").trim();
            if (periodo) periodsSet.add(periodo);
        }

        const orderedPeriodsCurrent = Array.from(periodsSet).sort((a, b) => {
            const ya = parseInt((a.match(/\d{4}/) || ["9999"])[0], 10);
            const yb = parseInt((b.match(/\d{4}/) || ["9999"])[0], 10);
            return ya - yb;
        });

        // Mantener la lista completa de periodos para que el slider no se reduzca
        if (!deforestacionPeriodosBase.length || deforestacionPeriodoActivo === "Todos") {
            deforestacionPeriodosBase = [...orderedPeriodsCurrent];
        }

        const orderedPeriods = deforestacionPeriodosBase.length
            ? [...deforestacionPeriodosBase]
            : [...orderedPeriodsCurrent];

        const byPeriod = new Map();
        for (const p of orderedPeriods) {
            byPeriod.set(p, { def: 0, reg: 0 });
        }

        for (const f of features) {
            const a = f.attributes || {};
            const periodo = String(a[periodField] ?? "").trim();
            const dinamica = String(a[dynField] ?? "").trim();
            const valor = Number(a[valueField]) || 0;

            if (!periodo || !byPeriod.has(periodo)) continue;

            const row = byPeriod.get(periodo);

            if (dinamica === "14001") row.def += valor;
            else if (dinamica === "14002") row.reg += valor;
        }

        const defData = orderedPeriods.map(p => +(byPeriod.get(p)?.def || 0).toFixed(2));
        const regData = orderedPeriods.map(p => +(byPeriod.get(p)?.reg || 0).toFixed(2));

        const selectedPeriod = deforestacionPeriodoActivo || "Todos";

        let safeIndex = 0;
        if (selectedPeriod !== "Todos") {
            const foundIndex = orderedPeriods.indexOf(selectedPeriod);
            safeIndex = foundIndex >= 0 ? foundIndex + 1 : 0;
        }

        timeSliderIndex = safeIndex;
        showTimeSlider(orderedPeriods, safeIndex, "deforestacion|periodo");

        ctx.setTitle(
            (selectedPeriod === "Todos")
                ? "Dinámica del Cambio de Bosque"
                : `Dinámica del Cambio de Bosque - ${selectedPeriod}`
        );

        const datasets = [
            {
                label: "Deforestación",
                data: defData,
                borderColor: colorDef,
                backgroundColor: colorDef,
                pointBackgroundColor: orderedPeriods.map(p =>
                    (selectedPeriod === "Todos" || p === selectedPeriod)
                        ? colorDef
                        : "rgba(255,127,127,0.20)"
                ),
                pointBorderColor: "#fff",
                pointRadius: orderedPeriods.map(p =>
                    (selectedPeriod === "Todos")
                        ? 5
                        : (p === selectedPeriod ? 7 : 3)
                ),
                borderWidth: 2,
                tension: 0.25,
                fill: false
            },
            {
                label: "Regeneración",
                data: regData,
                borderColor: colorReg,
                backgroundColor: colorReg,
                pointBackgroundColor: orderedPeriods.map(p =>
                    (selectedPeriod === "Todos" || p === selectedPeriod)
                        ? colorReg
                        : "rgba(76,230,0,0.20)"
                ),
                pointBorderColor: "#fff",
                pointRadius: orderedPeriods.map(p =>
                    (selectedPeriod === "Todos")
                        ? 5
                        : (p === selectedPeriod ? 7 : 3)
                ),
                borderWidth: 2,
                tension: 0.25,
                fill: false
            }
        ];

        ctx.crearGrafica(orderedPeriods, [], null, "line", false, datasets);

        ctx.actualizarLeyenda(
            ["Deforestación", "Regeneración"],
            [colorDef, colorReg],
            ["14001", "14002"]
        );
    }

    function ecosistemasCondicionDeptoDonutHandler() {
        return {
            when: (ctx) =>
            ctx.filtroNivel === "DEPTO" &&
            ctx.config.isEcosistema &&
            ctx.config.ecosistemaType === "ecosistemas" &&
            ctx.config.isDeptoEcosCondAgg &&
            ctx.config.ecosCondAgg,

            run: async (ctx) => {
            try {
                const { groupField, areaCandidates } = ctx.config.ecosCondAgg;

                const lyr = ctx.lyr || ctx.layer;
                await lyr.when();

                // 1) elegir campo de área existente
                const areaField =
                (typeof pickExistingField === "function"
                    ? (pickExistingField(lyr, areaCandidates) || "areat")
                    : "areat");

                const url = ctx.config.url || lyr.url;

                // 2) SUM(area) por condicion dentro del depto
                const rows = await queryGroupSum({
                url,
                where: ctx.whereBase || "1=1",
                groupBy: groupField,
                field: areaField,
                outName: "sum_area",
                statisticType: "sum"
                });

                if (!ensureNonEmptyOrExit(ctx, rows)) return;

                const total = rows.reduce((acc, r) => acc + (Number(r.sum_area) || 0), 0);
                if (total <= 0) {
                ctx.destroyChart();
                ctx.actualizarLeyenda([], []);
                return;
                }

                // 3) % por código
                const pctByCode = new Map(
                rows.map(r => [String(r[groupField]), pctOfTotal(r.sum_area, total)])
                );

                // 4) ordenar como en tu ejemplo (Natural → ... → Altamente transformado)
                const orderCodes = ["13001", "13002", "13003", "13004", "13005"];
                const items = orderCodes
                .map(code => {
                    const pct = pctByCode.get(code);
                    if (pct == null || pct <= 0) return null;
                    const info = (typeof coloresCondicionEcos !== "undefined") ? coloresCondicionEcos[Number(code)] : null;
                    return {
                    code,
                    label: info?.label || code,
                    color: info?.color || "#999",
                    pct
                    };
                })
                .filter(Boolean);

                // agrega “otros” si llegaran códigos raros
                for (const [code, pct] of pctByCode.entries()) {
                if (items.some(x => x.code === code)) continue;
                items.push({ code, label: code, color: "#999", pct });
                }

                const labels = items.map(x => x.label);
                const values = items.map(x => Number((x.pct || 0).toFixed(2)));
                const colors = items.map(x => x.color);

                // 5) título
                const depName = ctx.diccionarioDepartamentos?.[ctx.deptoActual] || ctx.deptoActual;
                ctx.setTitle(`Dona de Condición (Estados) - Ecosistemas en el departamento de ${depName}`);

                // 6) doughnut (anillo)
                ctx.crearGrafica(labels, values, colors, "doughnut", false);

                // hueco como tu imagen
                if (typeof chartInstance !== "undefined" && chartInstance) {
                chartInstance.options.cutout = "60%";
                chartInstance.update();
                }

                ctx.actualizarLeyenda(labels, colors);

            } catch (e) {
                console.error("ECOSISTEMAS_DEPTO_CONDICION error:", e);
                ctx.actualizarLeyenda([], []);
                ctx.destroyChart();
            }
            }
        };
    }

    async function getLayerViewSafe(view, layer) {
        if (!view || !layer) return null;
        try {
            return await view.whenLayerView(layer);
        } catch {
            return null;
        }
    }

    // function ecosCondMuniDonutHandler() {
    //     return {
    //         when: (ctx) =>
    //         ctx.filtroNivel === "MUNI" &&
    //         ctx.config.id === "pendientes" &&
    //         ctx.config.isMuniEcosCondDonut &&
    //         ctx.config.ecosCondAgg,

    //         run: async (ctx) => {
    //         try {
    //             const { groupField, areaCandidates } = ctx.config.ecosCondAgg;

    //             const lyr = ctx.lyr || ctx.layer;
    //             await lyr.when();

    //             // escoger campo de área real
    //             const areaField = (typeof pickExistingField === "function"
    //             ? (pickExistingField(lyr, areaCandidates) || "areat")
    //             : "areat"
    //             );

    //             const url = ctx.config.url || lyr.url;

    //             // SUM(area) por condicion dentro del municipio
    //             const rows = await queryGroupSum({
    //             url,
    //             where: ctx.whereBase || "1=1", // mpcodigo='xxxx'
    //             groupBy: groupField,
    //             field: areaField,
    //             outName: "sum_area",
    //             statisticType: "sum"
    //             });

    //             if (!rows?.length) {
    //             ctx.destroyChart();
    //             ctx.actualizarLeyenda([], []);
    //             return;
    //             }

    //             const total = rows.reduce((acc, r) => acc + (Number(r.sum_area) || 0), 0);
    //             if (total <= 0) {
    //             ctx.destroyChart();
    //             ctx.actualizarLeyenda([], []);
    //             return;
    //             }

    //             // items
    //             const items = rows
    //             .map(r => {
    //                 const codeRaw = r[groupField];
    //                 const code = String(codeRaw ?? "").trim(); // 13001..13005
    //                 const area = Number(r.sum_area) || 0;
    //                 const pct = (area / total) * 100;

    //                 const info = coloresCondicionEcos?.[code] || coloresCondicionEcos?.[Number(code)];
    //                 return {
    //                 code, // IMPORTANTE: lo usamos para zoom
    //                 label: info?.label || code,
    //                 color: info?.color || "#999",
    //                 pct
    //                 };
    //             })
    //             .filter(x => x.code && x.pct > 0);

    //             // orden fijo (Natural → ... → Altamente transformado)
    //             const order = ["Natural","Seminatural","Semitransformado","Transformado","Altamente transformado"];
    //             items.sort((a,b) => (order.indexOf(a.label) - order.indexOf(b.label)));

    //             const labels = items.map(x => x.label);
    //             const values = items.map(x => Number(x.pct.toFixed(2)));
    //             const colors = items.map(x => x.color);

    //             // título
    //             const mp = ctx.diccionarioMunicipios?.[ctx.municipioActual] || ctx.municipioActual;
    //             const dp = ctx.diccionarioDepartamentos?.[String(ctx.municipioActual).substring(0,2)] || "";
    //             ctx.setTitle(`Condición de ecosistemas en el municipio de ${mp}${dp ? ", " + dp : ""}`);

    //             // donut
    //             ctx.crearGrafica(labels, values, colors, "doughnut", false);

    //             // ====== CLICK => resaltar + filtrar (apagar resto) + zoom ======
    //             if (typeof chartInstance !== "undefined" && chartInstance) {
    //                 chartInstance.options.cutout = "60%";

    //                 const buildWhereCond = (condCode) => {
    //                     const c = String(condCode ?? "").trim();
    //                     const isNum = /^-?\d+(\.\d+)?$/.test(c);
    //                     const condWhere = isNum ? `condicion = ${c}` : `condicion = '${c.replace(/'/g, "''")}'`;

    //                     const base = (ctx.whereBase && String(ctx.whereBase).trim()) ? ctx.whereBase : "1=1";
    //                     return `${base} AND ${condWhere}`;
    //                 };

    //                 // guardamos el último where aplicado para hacer toggle
    //                 ctx.__pendientes_lastWhere = ctx.__pendientes_lastWhere || null;

    //                 chartInstance.options.onClick = async (evt) => {
    //                     const points = chartInstance.getElementsAtEventForMode(
    //                     evt, "nearest", { intersect: true }, true
    //                     );
    //                     if (!points.length) return;

    //                     const i = points[0].index;

    //                     // 1) resaltar slice clickeado (offset)
    //                     const n = chartInstance.data.labels.length;
    //                     chartInstance.data.datasets[0].offset =
    //                     Array.from({ length: n }, (_, k) => (k === i ? 18 : 0));
    //                     chartInstance.update();

    //                     // 2) obtener code real
    //                     const clickedLabel = chartInstance.data.labels[i];
    //                     const it = items.find(x => x.label === clickedLabel);
    //                     const condCode = it?.code;
    //                     if (!condCode) return;

    //                     const where = buildWhereCond(condCode);

    //                     try {
    //                     // LayerView para filtrar sin romper otras cosas
    //                     const lv = await getLayerViewSafe(view, lyr);

    //                     // TOGGLE: si clickeas la misma categoría, quita filtro y muestra todo
    //                     const same = ctx.__pendientes_lastWhere === where;

    //                     if (lv) {
    //                         if (same) {
    //                         lv.filter = null;              // vuelve a mostrar todo
    //                         ctx.__pendientes_lastWhere = null;
    //                         } else {
    //                         lv.filter = { where };          // APAGA el resto (solo queda lo filtrado)
    //                         ctx.__pendientes_lastWhere = where;
    //                         }
    //                     }

    //                     // 3) zoom al extent del filtro (o al municipio completo si quitaste filtro)
    //                     const zoomWhere = same ? (ctx.whereBase || "1=1") : where;
    //                     const extRes = await lyr.queryExtent({ where: zoomWhere });

    //                     if (extRes?.extent && view) {
    //                         await view.goTo(extRes.extent.expand(1.25), { duration: 350 });
    //                     }
    //                     } catch (e) {
    //                     if (e?.name === "AbortError") return;
    //                     console.error("Filtro+Zoom donut error:", e);
    //                     }
    //                 };

    //                 chartInstance.update();
    //             }

    //             ctx.actualizarLeyenda(labels, colors);

    //         } catch (e) {
    //             console.error("ECOS_COND_MUNI donut error:", e);
    //             ctx.actualizarLeyenda([], []);
    //             ctx.destroyChart();
    //         }
    //         }
    //     };
    // }

    function pendientesPolarHandler() {
        return {
            when: (ctx) =>
                ctx.filtroNivel === "MUNI" &&
                ctx.config.id === "pendientes" &&
                ctx.config.isPendientesPolar === true,

            run: async (ctx) => {
                try {
                    const lyr = ctx.lyr || ctx.layer;
                    await lyr.when();

                    const url = ctx.config.url || lyr.url;

                    // Consultar porcentaje por categoría dentro del municipio
                    const rows = await queryGroupSum({
                        url,
                        where: ctx.whereBase || "1=1",
                        groupBy: "categoria",
                        field: "porcentaje",
                        outName: "sum_pct",
                        statisticType: "sum"
                    });

                    if (!rows?.length) {
                        ctx.destroyChart();
                        ctx.actualizarLeyenda([], []);
                        return;
                    }

                    const desiredOrder = ["2001", "2002", "2003", "2004", "2005", "2006", "2007"];

                    const items = rows
                        .map(r => {
                            const code = String(r.categoria ?? "").trim();
                            const value = Number(r.sum_pct) || 0;
                            const info = coloresPendientes[code] || coloresPendientes[Number(code)];

                            return {
                                code,
                                label: info?.label || code,
                                color: info?.color || "#999",
                                value: Number(value.toFixed(2))
                            };
                        })
                        .filter(x => x.code && x.value > 0)
                        .sort((a, b) => desiredOrder.indexOf(a.code) - desiredOrder.indexOf(b.code));

                    const labels = items.map(x => x.label);
                    const values = items.map(x => x.value);
                    const colors = items.map(x => x.color);

                    const mp = ctx.diccionarioMunicipios?.[ctx.municipioActual] || ctx.municipioActual;
                    const dp = ctx.diccionarioDepartamentos?.[String(ctx.municipioActual).substring(0, 2)] || "";

                    ctx.setTitle(`Distribución de las categorías de pendiente`);

                    // polar area
                    ctx.crearGrafica(labels, values, colors, "polarArea", false);

                    // leyenda
                    // ctx.actualizarLeyenda(labels, colors);
                    // ctx.actualizarLeyenda(labels, colors, items.map(x => x.code));

                    // click sobre categoría => filtra/zoom en mapa
                    if (typeof chartInstance !== "undefined" && chartInstance) {
                        chartInstance.options.onClick = (evt, elements) => {
                            if (!elements?.length) return;

                            const idx = elements[0].index;
                            const selected = items[idx];
                            if (!selected?.code) return;

                            const whereZoom = `(${ctx.whereBase || "1=1"}) AND categoria = ${selected.code}`;

                            applyWhereToActiveLayers(whereZoom);
                            updateLegendByExtent?.(layerGlobal, ctx.config);

                            const extentLayer = layerGlobal;
                            extentLayer?.queryExtent({ where: whereZoom }).then(res => {
                                if (res?.extent) view.goTo(res.extent.expand(1.3));
                            });
                        };

                        chartInstance.update();
                    }

                } catch (e) {
                    console.error("PENDIENTES_POLAR error:", e);
                    ctx.destroyChart();
                    ctx.actualizarLeyenda([], []);
                }
            }
        };
    }
    
    function renderSuelosOrdenBubble(ctx, features) {

        const data = {};

        features.forEach(f => {
            const ord = f.attributes.ordsuelo;
            const fert = f.attributes.fertilidad;
            const pct = Number(f.attributes.porcentaje) || 0;

            if (!ord || !fert) return;

            const key = `${ord} - ${fert}`;
            data[key] = (data[key] || 0) + pct;
        });

        const labels = Object.keys(data);
        const values = Object.values(data);
        const colors = labels.map(() => "rgba(54,162,235,0.8)");

        ctx.setTitle("Distribución de órdenes y fertilidad de los suelos");

        ctx.crearGrafica(
            labels,
            values,
            colors,
            "bar",
            true
        );

        ctx.actualizarLeyenda(labels, colors);
    }

    function climasDeptoPctHandler() {
        return {
            when: (ctx) =>
            ctx.filtroNivel === "DEPTO" &&
            ctx.config.isClima &&
            ctx.config.isDeptoClimaTipoAgg &&
            ctx.config.deptoClimaTipoAgg,

            run: async (ctx) => {
            try {
                const { groupField, numField, denField } = ctx.config.deptoClimaTipoAgg;

                const lyr = ctx.lyr || ctx.layer;
                await lyr.when();

                // 1) Numerador: SUM(areat) agrupado por clima
                const jsNum = await ctx.arcRestQuery(ctx.config.url || lyr.url, {
                f: "json",
                where: ctx.whereBase || "1=1",
                groupByFieldsForStatistics: groupField,
                outStatistics: JSON.stringify([{
                    statisticType: "sum",
                    onStatisticField: numField,
                    outStatisticFieldName: "sum_num"
                }]),
                returnGeometry: "false"
                });

                const rows = (jsNum.features || []).map(f => f.attributes || {});
                if (!rows.length) {
                ctx.destroyChart();
                ctx.actualizarLeyenda([], []);
                return;
                }

                // 2) Denominador: SUM(Shape_Area) (en servicio: st_area(shape))
                let totalDen = 0;
                try {
                const jsDen = await ctx.arcRestQuery(ctx.config.url || lyr.url, {
                    f: "json",
                    where: ctx.whereBase || "1=1",
                    outStatistics: JSON.stringify([{
                    statisticType: "sum",
                    onStatisticField: denField,     // "st_area(shape)"
                    outStatisticFieldName: "sum_den"
                    }]),
                    returnGeometry: "false"
                });
                totalDen = Number(jsDen?.features?.[0]?.attributes?.sum_den) || 0;
                } catch (e) {
                // fallback: si el servicio no acepta bien "st_area(shape)" en estadísticas
                totalDen = 0;
                }

                // fallback final: si el denominador no llegó, usa la suma del numerador
                if (totalDen <= 0) {
                totalDen = rows.reduce((acc, r) => acc + (Number(r.sum_num) || 0), 0);
                }

                if (totalDen <= 0) {
                ctx.destroyChart();
                ctx.actualizarLeyenda([], []);
                return;
                }

                // 3) Dict desde renderer (labels + colores)
                const dictFromRenderer =
                (typeof buildDictFromUniqueValueRenderer === "function")
                    ? buildDictFromUniqueValueRenderer(lyr)
                    : (() => {
                        const m = new Map();
                        const r = lyr?.renderer;
                        if (!r || r.type !== "unique-value") return m;

                        (r.uniqueValueInfos || []).forEach(info => {
                        const v = String(info.value ?? "").trim(); // 7001..7023
                        const lbl = String(info.label ?? v).trim();
                        const col = (typeof getSymbolColorRGBA === "function" ? getSymbolColorRGBA(info.symbol) : "#999") || "#999";
                        if (v) m.set(v, { label: lbl || v, color: col });
                        });
                        return m;
                    })();

                // FACTOR DE CONVERSIÓN (km² → m²)
                const factor = Number(ctx.config.deptoClimaTipoAgg?.numAreaFactor) || 1;

                const items = rows.map(r => {
                const code = String(r[groupField] ?? "").trim();
                const num = Number(r.sum_num) || 0;

                const pct = ((num * factor) / totalDen) * 100;

                const info = dictFromRenderer.get(code);

                return {
                    code,
                    label: info?.label || code || "Sin información",
                    color: info?.color || "#999",
                    pct
                };
                });

                // Orden por % desc (similar al screenshot)
                items.sort((a, b) => (b.pct - a.pct));

                const labels = items.map(x => x.label);
                const values = items.map(x => Number(x.pct.toFixed(2)));
                const colors = items.map(x => x.color);

                const depName = ctx.diccionarioDepartamentos?.[ctx.deptoActual] || ctx.deptoActual;
                ctx.setTitle(`Distribución de tipos de clima en el departamento de ${depName}`);

                // Horizontal tipo tu imagen
                ctx.crearGrafica(labels, values, colors, "bar", false);
                ctx.actualizarLeyenda(labels, colors);

            } catch (e) {
                console.error("CLIMAS_DEPTO_PCT error:", e);
                ctx.actualizarLeyenda([], []);
                ctx.destroyChart();
            }
            }
        };
    }

        function escorrentiaDeptoPctVerticalHandler() {
            return {
                when: (ctx) =>
                ctx.filtroNivel === "DEPTO" &&
                ctx.config.isHidro &&
                ctx.config.hidroType === "escorrentia" &&
                ctx.config.isDeptoEscorrentiaAgg &&
                ctx.config.deptoEscorrentiaAgg,

                run: async (ctx) => {
                try {
                    const { groupField, numField, denField, numAreaFactor } = ctx.config.deptoEscorrentiaAgg;

                    const lyr = ctx.lyr || ctx.layer;
                    await lyr.when();

                    // 1) SUM(areat) por rangoesc
                    const jsNum = await ctx.arcRestQuery(ctx.config.url || lyr.url, {
                    f: "json",
                    where: ctx.whereBase || "1=1",
                    groupByFieldsForStatistics: groupField,
                    outStatistics: JSON.stringify([{
                        statisticType: "sum",
                        onStatisticField: numField,
                        outStatisticFieldName: "sum_num"
                    }]),
                    returnGeometry: "false"
                    });

                    const rows = (jsNum.features || []).map(f => f.attributes || {});
                    if (!rows.length) {
                    ctx.destroyChart();
                    ctx.actualizarLeyenda([], []);
                    return;
                    }

                    // 2) SUM(st_area(shape)) total (denominador)
                    let totalDen = 0;
                    try {
                    const jsDen = await ctx.arcRestQuery(ctx.config.url || lyr.url, {
                        f: "json",
                        where: ctx.whereBase || "1=1",
                        outStatistics: JSON.stringify([{
                        statisticType: "sum",
                        onStatisticField: denField,
                        outStatisticFieldName: "sum_den"
                        }]),
                        returnGeometry: "false"
                    });
                    totalDen = Number(jsDen?.features?.[0]?.attributes?.sum_den) || 0;
                    } catch (e) {
                    totalDen = 0;
                    }

                    // fallback si st_area(shape) no funcionó
                    if (totalDen <= 0) {
                    totalDen = rows.reduce((acc, r) => acc + (Number(r.sum_num) || 0), 0);
                    }
                    if (totalDen <= 0) {
                    ctx.destroyChart();
                    ctx.actualizarLeyenda([], []);
                    return;
                    }

                    // 3) dict de renderer (label+color por rangoesc)
                    const dict =
                    (typeof buildDictFromUniqueValueRenderer === "function")
                        ? buildDictFromUniqueValueRenderer(lyr)
                        : new Map();

                    const factor = Number(numAreaFactor) || 1;

                    // 4) items %
                    const items = rows.map(r => {
                    const code = String(r[groupField] ?? "").trim();   // 12001..12015
                    const num = Number(r.sum_num) || 0;
                    const pct = ((num * factor) / totalDen) * 100;

                    const info = dict.get(code);
                    return {
                        code,
                        label: info?.label || code || "Sin información",
                        color: info?.color || "#999",
                        pct
                    };
                    });

                    // orden natural por “12001..”
                    items.sort((a, b) => Number(a.code) - Number(b.code));

                    const labels = items.map(x => x.label);
                    const values = items.map(x => Number(x.pct.toFixed(2)));
                    const colors = items.map(x => x.color);

                    const depName = ctx.diccionarioDepartamentos?.[ctx.deptoActual] || ctx.deptoActual;
                    ctx.setTitle(`Distribución de escorrentía en el departamento de ${depName}`);
                    ctx.crearGrafica(labels, values, colors, "bar", true);
                    ctx.actualizarLeyenda(labels, colors);

                } catch (e) {
                    console.error("ESCORRENTIA_DEPTO_PCT error:", e);
                    ctx.destroyChart();
                    ctx.actualizarLeyenda([], []);
                }
                }
            };
        }

        function bosqueDeptoLineaHandler() {
            return {
                when: (ctx) =>
                ctx.filtroNivel === "DEPTO" &&
                ctx.config.isEcosistema &&
                ctx.config.ecosistemaType === "bosque" &&
                ctx.config.isDeptoBosqueSerieAgg &&
                ctx.config.deptoBosqueSerieAgg,

                run: async (ctx) => {
                try {
                    const agg = ctx.config.deptoBosqueSerieAgg;
                    const { seriesField, xField, numField, denField, numAreaFactor } = agg;

                    const lyr = ctx.lyr || ctx.layer;
                    await lyr.when();

                    // 1) Numerador: SUM(areat) agrupado por (periodo, tipo)
                    const jsNum = await ctx.arcRestQuery(ctx.config.url || lyr.url, {
                    f: "json",
                    where: ctx.whereBase || "1=1",
                    groupByFieldsForStatistics: `${xField},${seriesField}`,
                    outStatistics: JSON.stringify([{
                        statisticType: "sum",
                        onStatisticField: numField,
                        outStatisticFieldName: "sum_num"
                    }]),
                    returnGeometry: "false"
                    });

                    const rows = (jsNum.features || []).map(f => f.attributes || {});
                    if (!rows.length) {
                    ctx.destroyChart();
                    ctx.actualizarLeyenda([], []);
                    return;
                    }

                    // 2) Denominador: SUM(st_area(shape))
                    let totalDen = 0;
                    try {
                    const jsDen = await ctx.arcRestQuery(ctx.config.url || lyr.url, {
                        f: "json",
                        where: ctx.whereBase || "1=1",
                        outStatistics: JSON.stringify([{
                        statisticType: "sum",
                        onStatisticField: denField,
                        outStatisticFieldName: "sum_den"
                        }]),
                        returnGeometry: "false"
                    });
                    totalDen = Number(jsDen?.features?.[0]?.attributes?.sum_den) || 0;
                    } catch (e) {
                    totalDen = 0;
                    }

                    // fallback si st_area(shape) falla
                    if (totalDen <= 0) {
                    totalDen = rows.reduce((acc, r) => acc + (Number(r.sum_num) || 0), 0);
                    }
                    if (totalDen <= 0) {
                    ctx.destroyChart();
                    ctx.actualizarLeyenda([], []);
                    return;
                    }

                    // 3) Colores/labels desde renderer (14001/14002)
                    const dict =
                    (typeof buildDictFromUniqueValueRenderer === "function")
                        ? buildDictFromUniqueValueRenderer(lyr)
                        : new Map();

                    const factor = Number(numAreaFactor) || 1;

                    // 4) Armar matriz: periodo -> {14001: pct, 14002: pct}
                    const byPeriod = new Map();

                    for (const r of rows) {
                    const period = String(r[xField] ?? "").trim();
                    const serie = String(r[seriesField] ?? "").trim(); // "14001" o "14002"
                    const num = Number(r.sum_num) || 0;

                    const pct = ((num * factor) / totalDen) * 100;

                    if (!byPeriod.has(period)) byPeriod.set(period, {});
                    byPeriod.get(period)[serie] = (byPeriod.get(period)[serie] || 0) + pct;
                    }

                    // 5) Orden de periodos (1990-2000, 2000-2005, ...)
                    const periods = Array.from(byPeriod.keys()).sort((a, b) => {
                    const pa = parseInt(String(a).split("-")[0], 10);
                    const pb = parseInt(String(b).split("-")[0], 10);
                    if (Number.isFinite(pa) && Number.isFinite(pb)) return pa - pb;
                    return String(a).localeCompare(String(b));
                    });

                    // 6) Construir series en el mismo orden de periodos
                    const defCode = "14001";
                    const regCode = "14002";

                    const defData = periods.map(p => Number(((byPeriod.get(p)?.[defCode]) || 0).toFixed(3)));
                    const regData = periods.map(p => Number(((byPeriod.get(p)?.[regCode]) || 0).toFixed(3)));

                    const defInfo = dict.get(defCode);
                    const regInfo = dict.get(regCode);

                    const depName = ctx.diccionarioDepartamentos?.[ctx.deptoActual] || ctx.deptoActual;
                    ctx.setTitle(`Dinámica del Cambio de Bosque`);

                    // 7) Crear chart line con 2 datasets
                    const datasets = [
                    {
                        label: defInfo?.label || "Deforestación",
                        data: defData,
                        borderColor: defInfo?.color || "#ff7f7f",
                        backgroundColor: defInfo?.color || "#ff7f7f",
                        tension: 0.25,
                        pointRadius: 3
                    },
                    {
                        label: regInfo?.label || "Regeneración",
                        data: regData,
                        borderColor: regInfo?.color || "#4ce600",
                        backgroundColor: regInfo?.color || "#4ce600",
                        tension: 0.25,
                        pointRadius: 3
                    }
                    ];

                    // IMPORTANTE: si tu crearGrafica espera values/colors, pásale arrays vacíos y usa datasets
                    ctx.crearGrafica(periods, [], [], "line", true, datasets);

                    // leyenda (opcional)
                    ctx.actualizarLeyenda(
                    datasets.map(d => d.label),
                    datasets.map(d => d.borderColor)
                    );

                } catch (e) {
                    console.error("BOSQUE_DEPTO_LINEA error:", e);
                    ctx.destroyChart();
                    ctx.actualizarLeyenda([], []);
                }
                }
            };
        }
    function vocacionDualHandler() {
        return {
            when: ({ config, filtroNivel }) =>
                config?.isSuelos &&
                config?.suelosType === "vocacion" &&
                filtroNivel !== "DEPTO",

            run: async (ctx) => {
                const { layer, config, destroyChart, actualizarLeyenda } = ctx;

                await ensureVocacionDict();

                const q = layer.createQuery();
                q.where = layer.definitionExpression || whereBase || "1=1";
                q.outFields = ["vocacion", "usopvoc", "porcentaje"];
                q.returnGeometry = false;

                const result = await layer.queryFeatures(q);
                const features = result?.features || [];

                if (!features.length) {
                    toggleGeoformasCharts(false);
                    destroyGeoformasCharts();
                    destroyChart?.();
                    actualizarLeyenda?.([], []);
                    return;
                }

                const pieMap = new Map();

                for (const f of features) {
                    const a = f.attributes || {};
                    const voc = String(a.vocacion ?? "").trim();
                    const pct = Number(a.porcentaje) || 0;
                    if (!voc) continue;

                    const vocLabel = vocacionMainDict?.[voc]?.label || voc;
                    pieMap.set(vocLabel, (pieMap.get(vocLabel) || 0) + pct);
                }

                let selectedVocacion = window.__vocacionSelectedLabel;
                if (!selectedVocacion || !pieMap.has(selectedVocacion)) {
                    const first = [...pieMap.entries()].sort((a, b) => b[1] - a[1])[0];
                    selectedVocacion = first?.[0] || null;
                    window.__vocacionSelectedLabel = selectedVocacion;
                }

                const donutMap = new Map();

                for (const f of features) {
                    const a = f.attributes || {};
                    const voc = String(a.vocacion ?? "").trim();
                    const uso = String(a.usopvoc ?? "").trim();
                    const pct = Number(a.porcentaje) || 0;
                    if (!voc || !uso) continue;

                    const vocLabel = vocacionMainDict?.[voc]?.label || voc;
                    if (vocLabel !== selectedVocacion) continue;

                    let usoLabel = uso;

                    for (const item of Object.values(vocacionRendererDict || {})) {
                        if (item.vocacion === voc && item.usopvoc === uso) {
                            usoLabel = item.usoLabel;
                            break;
                        }
                    }

                    donutMap.set(usoLabel, (donutMap.get(usoLabel) || 0) + pct);
                }

                const pieRows = [...pieMap.entries()]
                    .map(([label, value]) => ({
                        label,
                        value: +value.toFixed(2),
                        color: getVocacionColor(label)
                    }))
                    .sort((a, b) => b.value - a.value);

                const donutRows = [...donutMap.entries()]
                    .map(([label, value]) => ({
                        label,
                        value: +value.toFixed(2),
                        color: getVocacionUsoColor(selectedVocacion, label)
                    }))
                    .sort((a, b) => b.value - a.value);

                crearGraficasVocacionDual({
                    pieLabels: pieRows.map(r => r.label),
                    pieValues: pieRows.map(r => r.value),
                    pieColors: pieRows.map(r => r.color),
                    donutLabels: donutRows.map(r => r.label),
                    donutValues: donutRows.map(r => r.value),
                    donutColors: donutRows.map(r => r.color),
                    selectedVocacion
                });

                actualizarLeyenda?.(
                    donutRows.map(r => r.label),
                    donutRows.map(r => r.color)
                );
            }
        };
    }



    /* =======================
    ROUTER
    ======================= */
    registerHandler(pendientesPolarHandler());
    registerHandler(fenomDeptoPctHandler());
    registerHandler(vocacionDeptoDonutHandler());
    registerHandler(cuencasDeptoDonutHandler());
    registerHandler(riesgoCCDeptoCountHandler());
    registerHandler(degradacionDeptoStackedHandler());
    registerHandler(conflictosSueloDeptoPctHandler());
    registerHandler(ordenSueloDeptoPieHandler());
    registerHandler(climaDeptoAggStackedHandler());
    registerHandler(hipsometriaDeptoAggHandler());
    registerHandler(bf3GeoformasDeptoPieHandler());
    registerHandler(ecosistemasCondicionDeptoDonutHandler());
    registerHandler(climasDeptoPctHandler());
    registerHandler(escorrentiaDeptoPctVerticalHandler());
    registerHandler(bosqueDeptoLineaHandler());
    registerHandler(vocacionDualHandler());
    registerHandler(defaultQueryAndRenderHandler());

    const clasesDegradacion = {
        "19203": "Laminar",
        "19204": "Laminar y surcos",
        "19205": "Terraceo y laminar",
        "19207": "Surcos y cárcavas",
        "19208": "Sin evidencia",
        "19209": "Sin evidencia"
    };

    const ORDEN_DEGRADACION = {
        "Ligera": 1,
        "Moderada": 2,
        "Severa": 3,
        "Muy severa": 4,
        "No suelo": 5,
        "Sin evidencia": 6
    };

    const ORDEN_SISMICA = {
        "Débil": 1,
        "Ligero": 2,
        "Moderado": 3,
        "Fuerte": 4,
        "Muy fuerte": 5,
        "Violento": 6
    };
    

    async function actualizarGrafica(layer, config, options = {}) {
        const ctx = buildCtx(layer, config, options);

        if (!ctx.skipSyncMap) {
            await syncMapLayer(ctx);
        }

        const handlers = getRegisteredHandlers();
        for (const h of handlers) {
            if (h.when(ctx)) {
                await h.run(ctx);
                return;
            }
        }
    }
    window.actualizarGrafica = actualizarGrafica;

    function applyWhereToActiveLayers(where) {
        // si estás en cuencas (3 capas), aplica a todas
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

    function filtrarPorRangoPeriodo(rangeCode, periodo) {
        const config = getActiveLayerConfig();
        if (!config || !config.periodField) return;

        const where = andWhere(
            whereBase,
            `${sqlEquals(config.labelField, rangeCode)} AND ${sqlEquals(config.periodField, periodo)}`
        );

        if (layerGlobal && where) {
            // layerGlobal.definitionExpression = where;
            applyWhereToActiveLayers(where);
            layerGlobal.queryExtent({ where }).then(res => {
            if (res.extent) view.goTo(res.extent.expand(1.3));
            });
        }
    }

    function filtrarPorRangoCodigo(rangeCode) {
        const config = getActiveLayerConfig();
        if (!config) return;

        let where = andWhere(whereBase, sqlEquals(config.labelField, rangeCode));

        if (layerGlobal && where) {
            // layerGlobal.definitionExpression = where;
            applyWhereToActiveLayers(where);
            layerGlobal.queryExtent({ where }).then(res => {
                if (res.extent) view.goTo(res.extent.expand(1.3));
            });
        }
    }

    function filtrarPorAtributo(val) {
        const config = getActiveLayerConfig();
        if (!config) return;
        if (config.isRadar) return;

        let where = "";

        //  1) BF3 primero (pie)
        if (config.isBF3) {
            const code = bf3LabelToCode?.get(val);

            if (code != null) {
            const s = String(code).trim();
            const isNum = /^-?\d+(\.\d+)?$/.test(s);

            where = isNum
                ? `${whereBase} AND paisaje = ${s}`
                : `${whereBase} AND paisaje = '${s.replace(/'/g, "''")}'`;
            }

        //  2) resto de casos como antes
        } else if (config.isGeoforma) {
            let foundKey = null;
            for (const [key, info] of Object.entries(coloresGeoformas)) {
            if (info.label === val) { foundKey = key; break; }
            }
            if (foundKey) {
            const [p, t] = foundKey.split(",");
            where = `${whereBase} AND paisaje = ${p} AND trelieve = ${t}`;
            }

        } else if (config.isClima) {
            let dict = {};
            if (config.climaType === 'temp') dict = coloresTemperatura;
            else if (config.climaType === 'precip') dict = coloresPrecipitacion;
            else if (config.climaType === 'clima_tipo') dict = coloresClimas;
            else if (config.climaType === 'temp_cc') dict = coloresCambioTemp;
            else if (config.climaType === 'precip_cc') dict = coloresCambioPrecip;

            let foundKey = null;
            for (const [key, info] of Object.entries(dict)) {
            if (info.label === val) { foundKey = key; break; }
            }
            if (foundKey != null) {
            where = `${whereBase} AND ${config.labelField} = ${foundKey}`;
            }

        } else if (config.isHidro) {
            if (config.hidroType === 'cuencas') {
            const s = String(val).trim();
            const isNum = /^-?\d+(\.\d+)?$/.test(s);
            where = isNum
                ? `${whereBase} AND ${config.labelField} = ${s}`
                : `${whereBase} AND ${config.labelField} = '${s.replace(/'/g, "''")}'`;
            } else {
            let foundKey = null;
            for (const [key, info] of Object.entries(coloresEscorrentia || {})) {
                if (info.label === val) { foundKey = key; break; }
            }
            if (foundKey) where = `${whereBase} AND ${config.labelField} = ${foundKey}`;
            }

        } else if (config.isEcosistema) {
            if (config.ecosistemaType === 'deforestacion') {
            const foundKey = (val === "Deforestación") ? 14001 : (val === "Regeneración") ? 14002 : null;
            if (foundKey) where = `${whereBase} AND ${config.labelField} = ${foundKey}`;
            } else {
            let foundKey = null;
            for (const [k, info] of Object.entries(coloresEcosistemas || {})) {
                if (info.label === val) { foundKey = k; break; }
            }
            const valueToSearch = foundKey || val;
            where = `${whereBase} AND ${config.labelField} = '${String(valueToSearch).replace(/'/g, "''")}'`;
            }

        } else if (config.isSuelos) {
            if (config.suelosType === 'vocacion') {
            let foundKey = null;
            for (const [k, info] of Object.entries(coloresVocacion || {})) {
                if (info.label === val) { foundKey = k; break; }
            }
            if (foundKey) {
                const [v, u] = foundKey.split(",");
                where = `${whereBase} AND vocacion = ${v} AND usopvoc = ${u}`;
            }
            } else {
            let foundKey = null;
            for (const [k, info] of Object.entries(coloresConflictos || {})) {
                if (info.label === val) { foundKey = k; break; }
            }
            if (foundKey) where = `${whereBase} AND ${config.labelField} = ${foundKey}`;
            }

        } else if (config.isFenomenos) {
            let dict = {};
            if (config.fenomenosType === 'inundaciones') dict = coloresInundaciones;
            if (config.fenomenosType === 'remocion') dict = coloresRemocion;
            if (config.fenomenosType === 'degradacion') dict = coloresDegradacion;
            if (config.fenomenosType === 'sismica') dict = coloresSismica;

            let foundKey = null;
            for (const [k, info] of Object.entries(dict || {})) {
            if (info.label === val) { foundKey = k; break; }
            }
            if (foundKey != null) where = `${whereBase} AND ${config.labelField} = ${foundKey}`;

        } else {
            // Hipsometría
            let foundKey = null;
            for (const [k, info] of Object.entries(coloresHipsometricos || {})) {
            if (info.label === val) { foundKey = k; break; }
            }
            if (foundKey != null) where = `${whereBase} AND ${config.labelField} = ${foundKey}`;
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

    document.getElementById("btnVerTodo").onclick = () => {
        if (!layerGlobal) return;

        applyWhereToActiveLayers(whereBase);
        updateLegendByExtent?.(layerGlobal, getActiveLayerConfig());

        layerGlobal.queryExtent({ where: whereBase }).then(res => {
            if (res.extent) view.goTo(res.extent.expand(1.2));
        });
    };

    // --- Autoselección por URL ---
    const urlParams = new URLSearchParams(window.location.search);
    const mpCodigoUrl = urlParams.get("id");

    if (mpCodigoUrl) {
        const codigoUrlNormalizado = normalizeCode(mpCodigoUrl);
        let intentosMunicipios = 0;
        const maxIntentosMunicipios = 20;

        const esperarMunicipios = setInterval(() => {
            intentosMunicipios += 1;

            const selectMuni = document.getElementById("municipios");

            if (selectMuni && selectMuni.options.length > 1) {
                selectMuni.value = codigoUrlNormalizado;

                if (selectMuni.value === codigoUrlNormalizado) {
                    clearInterval(esperarMunicipios);
                    selectMuni.dispatchEvent(new Event("change"));
                    return;
                }
            }

            if (intentosMunicipios >= maxIntentosMunicipios) {
                clearInterval(esperarMunicipios);
                console.warn("No se pudo autoseleccionar el municipio desde la URL:", codigoUrlNormalizado);
            }
        }, 500);
    }

    // Función para redirigir manteniendo el ID
    window.redirigir = function (e) {
        e.preventDefault();
        const link = e.currentTarget;
        const href = link.getAttribute("href");
        const val = document.getElementById("municipios").value;

        if (val) {
            const sep = href.includes('?') ? '&' : '?';
            window.location.href = `${href}${sep}id=${encodeURIComponent(val)}`;
        } else {
            window.location.href = href;
        }
    };

});