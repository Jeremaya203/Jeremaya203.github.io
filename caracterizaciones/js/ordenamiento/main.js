import {
    setOrdenamientoTab
} from "./modules/ordenamiento/ordenamiento.controller.js?v=vigencia-section-20260623";
import {
    resetOrdenamientoUI,
    syncChartSideLayout
} from "./modules/ordenamiento/ordenamiento.ui.js?v=vigencia-native-scroll-20260715";
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
    setLegendLayerTitle
} from "./ui/ui.helpers.js";
import {
    AppState
} from "./app/state.js?v=vigencia-section-20260623";
import { clearLayers as clearMapLayers } from "./map/layers.js";
import {
    createMainMap
} from "./map/map.core.js";
import {
    MUNICIPIOS_SOURCE_LAYER_URL,
    ORDENAMIENTO_CONFIG,
} from "./config.js?v=rural-area-fallback-20260716";

import {
    debounce,
    wrapLabel,
    rgbaFromEsriColorArr,
    normKey,
    getDepartamentoDisplayName,
    getMunicipioDisplayName,
    sortDepartamentoCodesAlphabetically
} from "./utils.js?v=territory-display-names-20260622";
import {
    arcRestQuery,
    fetchGroupedStats
} from "./data.js";
import {
    buildLegendFromRenderer,
    // actualizarLeyenda,
    getSymbolColorRGBA,
    syncLegendToLabelSelection,
    sortLegendEntries,
} from "./legend.js";
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

function cleanOrdenamientoChartTitle(title) {
    return String(title || "Distribución")
        .replace(/\s+en\s+.+,\s*.+$/i, "")
        .replace(/\s+en\s+Colombia$/i, "")
        .replace(/^Distribución nacional de\s+/i, "Distribución de ")
        .trim();
}

function getOrdenamientoTerritoryContext() {
    if (municipioActual) {
        const municipio = todosMunicipios.find(m => String(m.codigo) === String(municipioActual));
        const municipioNombre = getMunicipioDisplayName(municipio || municipioActual, diccionarioMunicipios);
        const deptoCodigo = municipio?.depto || String(municipioActual).substring(0, 2);
        const deptoNombre = getDepartamentoDisplayName(deptoCodigo, diccionarioDepartamentos);
        return `${municipioNombre}, ${deptoNombre}`;
    }

    if (deptoActual && deptoActual !== "0" && deptoActual !== "COL") {
        return diccionarioDepartamentos[deptoActual] || deptoActual;
    }

    return "Colombia";
}

function buildOrdenamientoChartTitle(baseTitle) {
    return `${cleanOrdenamientoChartTitle(baseTitle)} en ${getOrdenamientoTerritoryContext()}`;
}

function getOrdenamientoDeptoPrefixFields() {
    return new Set(["mpcodigo", "mp_codigo", "mdanmcodig"]);
}

function sqlStartsWith(field, prefix) {
    const s = String(prefix ?? "").replace(/\u0000/g, "").trim();

    if (!s) return "1=1";

    return `${field} LIKE '${s.replace(/'/g, "''")}%'`;
}

function sqlInList(field, values, options = {}) {
    const literals = Array.from(new Set((values || []).map(value => sqlLiteral(value, options.type || "string"))))
        .filter(value => value !== null);

    if (!literals.length) return "1=0";

    return `${field} IN (${literals.join(",")})`;
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

function toRgbaWithAlpha(value, alpha = 0.25) {
    const color = String(value ?? "").trim();
    const safeAlpha = Math.max(0, Math.min(1, Number(alpha)));

    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color)) {
        const hex = color.length === 4
            ? color.slice(1).split("").map(ch => ch + ch).join("")
            : color.slice(1);
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
    }

    const rgbaMatch = color.match(/^rgba?\(([^)]+)\)$/i);
    if (rgbaMatch) {
        const parts = rgbaMatch[1].split(",").map(part => part.trim());
        if (parts.length >= 3) {
            return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${safeAlpha})`;
        }
    }

    return color;
}

function withCombiningStrikethrough(value) {
    return String(value ?? "")
        .split("")
        .map(ch => ch === " " ? ch : `${ch}\u0336`)
        .join("");
}

function initializeOrdenamientoModule() {
    currentMainModule = "ORDENAMIENTO";
    currentOrdenamientoTab = "VIGENCIA";

    AppState.currentMainModule = "ORDENAMIENTO";
    AppState.currentOrdenamientoTab = "VIGENCIA";

    updateMapViewBadge("Vigencia");
}

// =========================
// Orden del suelo (MapServer/28) - dict desde renderer
// =========================
let coloresOrdenSuelo = null; // { "15001": {label, color}, ... }
async function ensureOrdenSueloDict(layerUrl28) {
    if (coloresOrdenSuelo) return coloresOrdenSuelo;

    const url = layerUrl28.replace(/\/+$/, "") + "?f=pjson";
    const res = await fetch(url);
    const json = await res.json();

    const infos = json?.drawingInfo?.renderer?.uniqueValueInfos || [];
    const dict = {};

    infos.forEach(info => {
        const value = String(info.value ?? "").trim();          // ej "15001"
        const label = String(info.label ?? value).trim();       // ej "Alfisoles" (o lo que tenga)
        const color = rgbaFromEsriColorArr(info?.symbol?.color); // color renderer
        if (value) dict[value] = { label, color };
    });

    coloresOrdenSuelo = dict;
    return dict;
}

function syncStateFromGlobals() {
    AppState.currentMainModule = currentMainModule;
    AppState.currentOrdenamientoTab = currentOrdenamientoTab;
    AppState.currentRuralChartView = currentRuralChartView;

    AppState.map = map;
    AppState.view = view;
    AppState.layerGlobal = layerGlobal;
    AppState.layerViewGlobal = layerViewGlobal;
    AppState.layersGlobal = layersGlobal;
    AppState.chartLayerGlobal = chartLayerGlobal;


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


    scaleHandle = AppState.scaleHandle;
    highlightHandle = AppState.highlightHandle;
    renderCycleId = AppState.renderCycleId;
    lastHoverWhere = AppState.lastHoverWhere;
    legendFilterLabel = AppState.legendFilterLabel;

    syncStateFromGlobals();
}

// Estado Global
let currentMainModule = "ORDENAMIENTO"; // ORDENAMIENTO
let currentOrdenamientoTab = "VIGENCIA";
let currentRuralChartView = "CATEGORIA"; // "CATEGORIA" | "USO_PRINCIPAL"


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
let lastAreasMapClickAt = 0;
let areasActividadSelectionTimer = null;
let areasActividadSelectionToken = 0;
let areasActividadChartCodes = [];
let areasActividadChartHighlightedCode = null;
let areasActividadCanvasChartState = null;
let zonificacionRuralCanvasChartState = null;
let zonificacionRuralSelectionTimer = null;
let zonificacionRuralRenderSeq = 0;
let vigenciaTipoChartInstance = null;
let vigenciaEstadoChartInstance = null;
let vigenciaMunicipioHighlightLayer = null;
let vigenciaMunicipioHighlightHandle = null;
let vigenciaHighlightedMunicipio = null;
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
let currentMode = "";
let updateLegendByExtent = null;
let clasificacionNormativaLayer = null;
let clasificacionVisualLayer = null;
let clasificacionTerritoryLayer = null;
const clasificacionCategoryLayers = new Map();
const clasificacionTerritoryExtentCache = new Map();
const clasificacionStatsCache = new Map();
const CLASIFICACION_STATS_CACHE_LIMIT = 24;
let clasificacionBaseWhere = "1=1";
let clasificacionVisualWhereApplied = null;
let clasificacionVisualVisibleApplied = null;
let clasificacionChartTimer = null;
let clasificacionZoomRequestId = 0;
let clasificacionLegendFilterTimer = null;
let clasificacionLegendFilterSeq = 0;
let clasificacionLegendLastSignature = "";
let clasificacionCategoryModeActive = false;
let clasificacionCategoryBaseWhereApplied = "";
let clasificacionCategoryPrewarmTimer = null;
let clasificacionCategoryPrewarmSeq = 0;
let clasificacionCategoryPrewarmSignature = "";
let clasificacionSummaryRequestId = 0;
let clasificacionDeptWarmupTimer = null;
let clasificacionDeptWarmupSeq = 0;
let clasificacionAuxBackoffUntil = 0;
const clasificacionLegendWhereCache = new Map();
const clasificacionRecentTerritoryCache = new Map();
const CLASIFICACION_LEGEND_TOGGLE_DELAY_MS = 16;
const CLASIFICACION_CATEGORY_PREWARM_MUNI_DELAY_MS = 1200;
const CLASIFICACION_CATEGORY_PREWARM_DEPTO_DELAY_MS = 2600;
const CLASIFICACION_RECENT_TERRITORIES_LIMIT = 8;
const CLASIFICACION_DEPT_WARMUP_LIMIT = 5;
const CLASIFICACION_MUNI_NEIGHBOR_WARMUP_LIMIT = 4;
const CLASIFICACION_DEPT_WARMUP_DELAY_MS = 3600;
const CLASIFICACION_MUNI_WARMUP_DELAY_MS = 2600;
const CLASIFICACION_DEPT_WARMUP_STEP_MS = 900;
const CLASIFICACION_VISUAL_IDLE_TIMEOUT_MS = 2600;
const CLASIFICACION_AUX_VISUAL_IDLE_TIMEOUT_MS = 3200;
const CLASIFICACION_AUX_BACKOFF_MS = 12000;

// (opcional) para no crear watchers infinitos al cambiar escala en cuencas
let scaleHandle = null;
let renderCycleId = 0;
let highlightHandle = null;
let lastHoverWhere = "";
let legendFilterLabel = null; // ej: "Seminatural"
const hoverDebounceMs = 120;

const scheduleOrdenamientoRender = debounce(() => {
    if (currentMainModule !== "ORDENAMIENTO") return;
    if (typeof window.cargarOrdenamientoActual === "function") {
        window.cargarOrdenamientoActual();
    }
}, 140);

function markClasificacionPerf(stage, cycleId = renderCycleId, extra = {}) {
    const now = typeof performance !== "undefined" && typeof performance.now === "function"
        ? performance.now()
        : Date.now();
    const entry = {
        stage,
        cycleId,
        t: Number(now.toFixed ? now.toFixed(2) : now),
        ...extra
    };

    window.__clasificacionPerf = window.__clasificacionPerf || [];
    window.__clasificacionPerf.push(entry);
    if (window.__clasificacionPerf.length > 80) {
        window.__clasificacionPerf.shift();
    }

    if (window.__debugClasificacionPerf) {
        console.debug("[Clasificacion suelo perf]", entry);
    }

    return entry;
}

function isExpectedClasificacionAsyncError(error) {
    const name = String(error?.name || "");
    const message = String(error?.message || error || "").toLowerCase();
    return (
        name === "AbortError" ||
        message.includes("abort") ||
        message.includes("timeout") ||
        message.includes("tiempo de espera") ||
        message.includes("sobrepas")
    );
}

function recordClasificacionAsyncIssue(stage, error, cycleId = renderCycleId, extra = {}) {
    markClasificacionPerf(stage, cycleId, {
        expected: isExpectedClasificacionAsyncError(error),
        message: String(error?.message || error || ""),
        ...extra
    });

    if (window.__debugClasificacionPerf && !isExpectedClasificacionAsyncError(error)) {
        console.debug(`[Clasificacion suelo] ${stage}`, error);
    }
}

function rememberClasificacionStats(cacheKey, rows) {
    clasificacionStatsCache.set(cacheKey, rows.map(row => ({ ...row })));
    while (clasificacionStatsCache.size > CLASIFICACION_STATS_CACHE_LIMIT) {
        clasificacionStatsCache.delete(clasificacionStatsCache.keys().next().value);
    }
}

let vocacionRendererDict = null;
let vocacionMainDict = null;
let ruralCategoriaDict = null;
let ruralCategoriaDefaultInfo = null;
// Caché de estadísticas agrupadas de Zonificación Rural por filtro territorial.
// La data del servicio es estática durante la sesión, así que para un mismo
// `where` (departamento/municipio) los resultados de categorías y usos no
// cambian; evita reconsultar al alternar entre "Categorías" y "Uso principal"
// o al repetir un territorio. Clave: where -> { catRows, useRows }.
const zonificacionRuralStatsCache = new Map();
const ZONIFICACION_RURAL_STATS_CACHE_LIMIT = 60;
const vigenciaStatsCache = new Map();
const vigenciaStatsInFlight = new Map();
const VIGENCIA_STATS_CACHE_LIMIT = 80;
window.__ruralCategoriaColorMap = {};
window.__vocacionSelectedLabel = null;
window.__vocacionPairColorMap = {};
window.__vocacionMainColorMap = {};

window.__aa_active_filters = new Set();
window.__aa_all_items = [];
window.__aa_full_codes = [];
window.__aa_base_where = "1=1";
window.__aa_selected_code = null;
window.__aa_map_click_debug_count = 0;
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

// Color de respaldo deterministico para "Categorias rurales" cuando el
// servicio no trae un renderer compatible con Tipo_Categoria_Rural.
const RURAL_CATEGORIA_FALLBACK_COLORS = [
    "#0079C1", "#2A9D8F", "#E9C46A", "#F4A261", "#E76F51",
    "#6A3D9A", "#1F78B4", "#33A02C", "#FB9A99", "#B15928"
];

function ruralCategoriaFallbackColor(code) {
    const key = String(code ?? "");
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
        hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
    }
    return RURAL_CATEGORIA_FALLBACK_COLORS[hash % RURAL_CATEGORIA_FALLBACK_COLORS.length];
}

async function ensureRuralCategoriaDict(layerUrl) {
    // Solo reutilizar la caché si tiene categorías; un objeto vacío (truthy)
    // dejaría las "Categorías rurales" sin colores de forma permanente.
    if (ruralCategoriaDict && Object.keys(ruralCategoriaDict).length) return ruralCategoriaDict;

    const url = String(layerUrl).replace(/\/+$/, "") + "?f=pjson";
    let json = null;
    try {
        const res = await fetch(url);
        json = await res.json();
    } catch (e) {
        // El servicio rural puede ser lento/inestable. No bloquear el flujo:
        // devolver lo que haya (o vacío) para reintentar en la próxima consulta.
        console.warn("No se pudo cargar el diccionario de categorías rurales:", e);
        return ruralCategoriaDict || {};
    }

    ruralCategoriaDict = {};
    ruralCategoriaDefaultInfo = null;
    window.__ruralCategoriaColorMap = {};

    const renderer = json?.drawingInfo?.renderer || {};
    const groups = renderer?.uniqueValueGroups || [];
    const infos = renderer?.uniqueValueInfos || [];
    const categoryField = ORDENAMIENTO_CONFIG?.ZONIFICACION_RURAL?.categoryField || "Tipo_Categoria_Rural";
    const rendererField = String(renderer?.field1 || renderer?.field || "").trim();
    const rendererUsesCategoryField = rendererField
        ? rendererField.toLowerCase() === String(categoryField).toLowerCase()
        : true;
    const categoryFieldInfo = (json?.fields || []).find(
        field => String(field?.name || "").toLowerCase() === String(categoryField).toLowerCase()
    );
    const categoryDomainValues = categoryFieldInfo?.domain?.codedValues || [];

    // El servicio de Zonificacion Rural simboliza por RuleID, pero el grafico
    // "Categorias rurales" agrupa por Tipo_Categoria_Rural. Si usamos el
    // renderer de RuleID como paleta de categorias, el grafico y el mapa quedan
    // desalineados y categorias como codigo 1 (Agropecuario) no tienen simbolo.
    if (!rendererUsesCategoryField && categoryDomainValues.length) {
        categoryDomainValues.forEach(domainValue => {
            const code = String(domainValue?.code ?? "").trim();
            if (!code) return;

            const fill = ruralCategoriaFallbackColor(code);
            const label = String(domainValue?.name || code).trim();

            ruralCategoriaDict[code] = {
                code,
                label,
                fillColor: fill,
                outlineColor: "rgba(0,0,0,0.25)",
                outlineWidth: 0.4
            };

            window.__ruralCategoriaColorMap[label] = fill;
        });

        return ruralCategoriaDict;
    }

    const defaultSymbol = renderer?.defaultSymbol;
    if (defaultSymbol) {
        const defaultFill = rgbaArrayToCss(defaultSymbol?.color, "");
        ruralCategoriaDefaultInfo = {
            code: "__default__",
            label: String(renderer?.defaultLabel || "Otro").trim(),
            fillColor: defaultFill,
            outlineColor: rgbaArrayToCss(defaultSymbol?.outline?.color, "rgba(0,0,0,0)"),
            outlineWidth: Number(defaultSymbol?.outline?.width ?? 0)
        };
        if (!ruralCategoriaDefaultInfo.fillColor) {
            ruralCategoriaDefaultInfo = null;
        }
    }

    if (groups.length) {
        groups.forEach(group => {
            (group.classes || []).forEach(cls => {
                const vals = cls.values?.[0] || [];
                const code = String(vals[0] ?? "").trim();
                if (!code) return;

                const fill = rgbaArrayToCss(cls?.symbol?.color, "");
                if (!fill) return;
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

            const fill = rgbaArrayToCss(info?.symbol?.color, "");
            if (!fill) return;
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

    // No cachear un diccionario vacío: permitir reintento en la próxima consulta
    // (el servicio rural a veces responde sin renderer parseable).
    if (!Object.keys(ruralCategoriaDict).length) {
        const empty = ruralCategoriaDict;
        ruralCategoriaDict = null;
        return empty;
    }

    return ruralCategoriaDict;
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

async function cargarDiccionarioMunicipios() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const url = "https://serviciosgeovisor.igac.gov.co:8080/Geovisor/config?cmd=config_diccionario2";
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        const json = await res.json();
        if (json && json.UNIDAD) {
            json.UNIDAD
                .filter(u => u.type === "MUNI")
                .forEach(m => {
                    diccionarioMunicipios[m.id] = m.text;
                });

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
        console.warn("Error cargando diccionario, se usarón códigos como etiquetas:", e.message || e);
    }
}

function getActiveLayerConfig() {
    syncStateFromGlobals();
    return ORDENAMIENTO_CONFIG[currentOrdenamientoTab] || null;
}

function setLegendLayer(layer, titleText) {
    setLegendLayerTitle(titleText);
}

function removeVigenciaVisualLayers(keepLayer = null) {
    if (!map?.layers) return;

    // URL completa del servicio (incluye el índice de capa, p.ej. ".../MapServer/0").
    const vigenciaFullUrl = String(ORDENAMIENTO_CONFIG.VIGENCIA?.url || "").replace(/\/+$/, "");
    // URL base del servicio sin el índice de capa (".../MapServer").
    const vigenciaBaseUrl = vigenciaFullUrl.replace(/\/\d+$/, "");
    const vigenciaTitle = String(ORDENAMIENTO_CONFIG.VIGENCIA?.title || "");

    const layers = typeof map.layers.toArray === "function"
        ? map.layers.toArray()
        : [];

    layers.forEach(layer => {
        if (keepLayer && layer === keepLayer) return;
        if (layer === vigenciaMunicipioHighlightLayer) return;

        const layerUrl = String(layer?.url || "").replace(/\/+$/, "");
        const layerTitle = String(layer?.title || "");
        const isVigenciaLayer =
            (vigenciaTitle && layerTitle === vigenciaTitle) ||
            (vigenciaFullUrl && layerUrl === vigenciaFullUrl) ||
            (vigenciaBaseUrl && layerUrl === vigenciaBaseUrl);

        if (!isVigenciaLayer) return;

        try { map.remove(layer); } catch (_) { }
        try { layer.destroy?.(); } catch (_) { }
    });

    if (
        window.activeVisualLayer &&
        window.activeVisualLayer !== keepLayer &&
        window.activeVisualLayer?.title === ORDENAMIENTO_CONFIG.VIGENCIA?.title
    ) {
        window.activeVisualLayer = null;
    }
    layersGlobal = layersGlobal.filter(layer =>
        layer &&
        !layer.destroyed &&
        (layer === keepLayer || String(layer?.title || "") !== ORDENAMIENTO_CONFIG.VIGENCIA?.title)
    );
    AppState.layersGlobal = layersGlobal;
}

function removeClasificacionVisualLayers() {
    if (!map?.layers) return;

    const config = ORDENAMIENTO_CONFIG.CLASIFICACION_SUELO || {};
    const featureUrl = String(config.url || "").replace(/\/+$/, "");
    const mapServerUrl = String(config.mapServerUrl || "").replace(/\/+$/, "");
    const title = String(config.title || "");
    const layers = typeof map.layers.toArray === "function"
        ? map.layers.toArray()
        : [];

    layers.forEach(layer => {
        const layerUrl = String(layer?.url || "").replace(/\/+$/, "");
        const layerTitle = String(layer?.title || "");
        const isClasificacionLayer =
            (featureUrl && layerUrl === featureUrl) ||
            (mapServerUrl && layerUrl === mapServerUrl) ||
            (title && (layerTitle === title || layerTitle.startsWith(`${title} -`)));

        if (!isClasificacionLayer) return;

        try { layer.visible = false; } catch (_) { }
        try { map.remove(layer); } catch (_) { }
        try { layer.destroy?.(); } catch (_) { }
    });

    if (clasificacionVisualLayer && !clasificacionVisualLayer.destroyed) {
        try { clasificacionVisualLayer.visible = false; } catch (_) { }
        try { map.remove(clasificacionVisualLayer); } catch (_) { }
        try { clasificacionVisualLayer.destroy?.(); } catch (_) { }
    }

    for (const layer of clasificacionCategoryLayers.values()) {
        if (!layer || layer.destroyed) continue;
        try { layer.visible = false; } catch (_) { }
        try { map.remove(layer); } catch (_) { }
        try { layer.destroy?.(); } catch (_) { }
    }

    clasificacionVisualLayer = null;
    clasificacionVisualWhereApplied = null;
    clasificacionVisualVisibleApplied = null;
    clasificacionCategoryLayers.clear();
    clasificacionCategoryModeActive = false;
    clasificacionCategoryBaseWhereApplied = "";
    clasificacionCategoryPrewarmSignature = "";

    if (window.activeVisualLayer?.title === title) {
        window.activeVisualLayer = null;
    }
    layersGlobal = layersGlobal.filter(layer => layer && !layer.destroyed && !String(layer?.title || "").startsWith(title));
    AppState.layersGlobal = layersGlobal;
}

// Nombres de los servicios de datos de Ordenamiento. Se usan como "huella"
// (substring) para detectar capas residuales sin depender de la URL exacta,
// ya que FeatureLayer.url devuelve la URL del servicio SIN el índice de capa
// (".../FeatureServer") mientras que config.url incluye el índice (".../0").
const ORDENAMIENTO_DATA_SERVICE_FINGERPRINTS = [
    "datosnacionalespot",
    "clasificacionsuelopot",
    "areasdeactividad",
    "zonificacionsuelorural"
];

function layerBelongsToOrdenamientoDataService(layer) {
    const url = String(layer?.url || "").toLowerCase();
    if (!url) return false;
    return ORDENAMIENTO_DATA_SERVICE_FINGERPRINTS.some(fp => url.includes(fp));
}

// Elimina cualquier capa de datos de Ordenamiento que haya quedado residual en el
// mapa (consulta anterior, capa nacional inicial u orfandades de renders previos),
// dejando solo la capa indicada en keepLayer. Evita que coexistan resultados de
// departamentos/municipios anteriores con el actual.
function removeStrayOrdenamientoDataLayers(keepLayer = null) {
    if (!map?.layers) return;

    const layers = typeof map.layers.toArray === "function"
        ? map.layers.toArray()
        : [];

    layers.forEach(layer => {
        if (keepLayer && layer === keepLayer) return;
        if (layerBelongsToOrdenamientoDataService(layer)) {
            try { map.remove(layer); } catch (_) { }
            try { layer?.destroy?.(); } catch (_) { }
        }
    });

    layersGlobal = layersGlobal.filter(layer =>
        layer &&
        !layer.destroyed &&
        (layer === keepLayer || !layerBelongsToOrdenamientoDataService(layer))
    );
    AppState.layersGlobal = layersGlobal;
}

// Alias retrocompatible (la lógica es genérica para todas las capas de datos de
// Ordenamiento, no solo Zonificación Rural).
const removeStrayRuralLayers = removeStrayOrdenamientoDataLayers;

function getOrdenamientoLayerOwnership(layer) {
    if (!layer) return "";

    const layerUrl = String(layer.url || "").replace(/\/+$/, "");
    const layerTitle = String(layer.title || "");

    for (const [tabKey, config] of Object.entries(ORDENAMIENTO_CONFIG || {})) {
        const featureUrl = String(config?.url || "").replace(/\/+$/, "");
        const mapServerUrl = String(config?.mapServerUrl || "").replace(/\/+$/, "");
        const mapServerBaseUrl = featureUrl.replace(/\/\d+$/, "");
        const title = String(config?.title || "");

        if (
            (featureUrl && layerUrl === featureUrl) ||
            (mapServerUrl && layerUrl === mapServerUrl) ||
            (mapServerBaseUrl && layerUrl === mapServerBaseUrl) ||
            (title && (layerTitle === title || layerTitle.startsWith(`${title} -`)))
        ) {
            return tabKey;
        }
    }

    return "";
}

function removeOrdenamientoResidualLayers(targetTab = currentOrdenamientoTab, options = {}) {
    if (!map?.layers) return;

    const keepTab = String(targetTab || "");
    const removeTarget = options.removeTarget === true;
    const layers = typeof map.layers.toArray === "function"
        ? map.layers.toArray()
        : [];

    layers.forEach(layer => {
        if (!layer || layer === vigenciaMunicipioHighlightLayer) return;

        const ownerTab = getOrdenamientoLayerOwnership(layer);
        if (!ownerTab || (ownerTab === keepTab && !removeTarget)) return;

        try { layer.visible = false; } catch (_) { }
        try { map.remove(layer); } catch (_) { }
        try { layer.destroy?.(); } catch (_) { }
    });

    const layerGlobalOwner = getOrdenamientoLayerOwnership(layerGlobal);
    if (layerGlobal && layerGlobalOwner && (layerGlobalOwner !== keepTab || removeTarget)) {
        layerGlobal = null;
        AppState.layerGlobal = null;
    }

    const chartLayerOwner = getOrdenamientoLayerOwnership(chartLayerGlobal);
    if (chartLayerGlobal && chartLayerOwner && (chartLayerOwner !== keepTab || removeTarget)) {
        chartLayerGlobal = null;
        AppState.chartLayerGlobal = null;
    }

    layersGlobal = layersGlobal.filter(layer => {
        if (!layer || layer.destroyed) return false;
        const ownerTab = getOrdenamientoLayerOwnership(layer);
        return !ownerTab || (ownerTab === keepTab && !removeTarget);
    });
    AppState.layersGlobal = layersGlobal;

    const activeFeatureOwner = getOrdenamientoLayerOwnership(window.activeFeatureLayer);
    if (window.activeFeatureLayer && activeFeatureOwner && (activeFeatureOwner !== keepTab || removeTarget)) {
        window.activeFeatureLayer = null;
    }
    const activeVisualOwner = getOrdenamientoLayerOwnership(window.activeVisualLayer);
    if (window.activeVisualLayer && activeVisualOwner && (activeVisualOwner !== keepTab || removeTarget)) {
        window.activeVisualLayer = null;
    }
}

function resetOrdenamientoInteractionStateForTabChange(targetTab = currentOrdenamientoTab) {
    if (areasActividadSelectionTimer) {
        clearTimeout(areasActividadSelectionTimer);
        areasActividadSelectionTimer = null;
    }
    if (zonificacionRuralSelectionTimer) {
        clearTimeout(zonificacionRuralSelectionTimer);
        zonificacionRuralSelectionTimer = null;
    }
    if (clasificacionLegendFilterTimer) {
        clearTimeout(clasificacionLegendFilterTimer);
        clasificacionLegendFilterTimer = null;
    }
    if (clasificacionChartTimer) {
        clearTimeout(clasificacionChartTimer);
        clasificacionChartTimer = null;
    }

    areasActividadSelectionToken++;
    zonificacionRuralRenderSeq++;
    areasActividadChartHighlightedCode = null;
    areasActividadChartCodes = [];
    areasActividadCanvasChartState = null;
    zonificacionRuralCanvasChartState = null;
    window.__aa_selected_code = null;
    window.__aa_active_filters = new Set();
    window.__aa_all_items = [];
    window.__aa_full_codes = [];
    window.__aa_base_where = "1=1";
    window.__zr_selected_code = null;
    window.__legendState = {
        allCodes: [],
        activeCodes: new Set(),
        field: null,
        layer: null,
        baseWhere: "1=1"
    };

    if (String(targetTab || "") !== "CLASIFICACION_SUELO") {
        clasificacionBaseWhere = "1=1";
        clasificacionVisualWhereApplied = null;
        clasificacionVisualVisibleApplied = null;
    }
}

function cleanupOrdenamientoVisualStateForTab(targetTab = currentOrdenamientoTab) {
    renderCycleId++;
    AppState.renderCycleId = renderCycleId;
    resetOrdenamientoInteractionStateForTabChange(targetTab);
    removeOrdenamientoResidualLayers(targetTab, { removeTarget: true });
    if (chartInstance) {
        try { chartInstance.destroy(); } catch (_) { }
        chartInstance = null;
    }
    if (vigenciaTipoChartInstance) {
        try { vigenciaTipoChartInstance.destroy(); } catch (_) { }
        vigenciaTipoChartInstance = null;
    }
    if (vigenciaEstadoChartInstance) {
        try { vigenciaEstadoChartInstance.destroy(); } catch (_) { }
        vigenciaEstadoChartInstance = null;
    }
    document.getElementById("vigenciaCharts")?.remove();
    document.getElementById("chartHighlightOverlay")?.remove();
    const chartCanvas = document.getElementById("chart");
    if (chartCanvas) {
        chartCanvas.onclick = null;
        chartCanvas.ondblclick = null;
        chartCanvas.style.display = "none";
        chartCanvas.style.visibility = "hidden";
        chartCanvas.style.opacity = "0";
    }
    if (highlightHandle) {
        try { highlightHandle.remove(); } catch (_) { }
        highlightHandle = null;
    }
    legendFilterLabel = null;
    window.__lastLegendRenderKey = "";
    window.__legendState = {
        allCodes: [],
        activeCodes: new Set(),
        field: null,
        layer: null,
        baseWhere: "1=1"
    };

    const tab = String(targetTab || "");
    if (tab !== "CLASIFICACION_SUELO") {
        if (typeof cancelClasificacionAuxiliaryLoad === "function") cancelClasificacionAuxiliaryLoad();
        if (typeof cancelClasificacionCategoryPrewarm === "function") cancelClasificacionCategoryPrewarm();
        if (typeof cancelClasificacionDepartmentWarmup === "function") cancelClasificacionDepartmentWarmup();
        removeClasificacionVisualLayers();
    }

    if (tab !== "VIGENCIA") {
        removeVigenciaVisualLayers();
        vigenciaHighlightedMunicipio = null;
        if (vigenciaMunicipioHighlightLayer?.graphics) {
            try { vigenciaMunicipioHighlightLayer.graphics.removeAll(); } catch (_) { }
        }
    }
}

function initAllDropdowns() {
    document.addEventListener("click", function (e) {
        document.querySelectorAll(".modulo-dropdown.open").forEach(dropdown => {
            if (!dropdown.contains(e.target)) {
                dropdown.classList.remove("open");
            }
        });
    });

    initModuleDropdown("ordenamientoDropdown", "ordenamientoTrigger", ".dropdown-menu-custom", function (target) {
        setOrdenamientoTab(target);

        currentMainModule = AppState.currentMainModule;
        currentOrdenamientoTab = AppState.currentOrdenamientoTab;
        currentRuralChartView = AppState.currentRuralChartView;

        syncStateFromGlobals();
        cleanupOrdenamientoVisualStateForTab(currentOrdenamientoTab);

        resetOrdenamientoUI({
            hideTimeSlider,
            destroyGeoformasCharts,
            toggleGeoformasCharts,
            chartInstanceRef: {
                get current() { return chartInstance; },
                set current(value) { chartInstance = value; }
            },
            renderControls
        });

        if (typeof window.cargarOrdenamientoActual === "function") {
            window.cargarOrdenamientoActual();
        } else {
            console.warn("cargarOrdenamientoActual a\u00fan no est\u00e1 disponible");
        }
    });

    initModuleDropdown("limitesDropdown", "limitesTrigger", ".dropdown-menu-custom", function (target) {
        globalThis.ModuleNavigation?.navigateToComponent("limites.html", target);
    });

    initModuleDropdown("legalDropdown", "legalTrigger", ".dropdown-menu-custom", function (target) {
        globalThis.ModuleNavigation?.navigateToComponent("contexto.html", target);
    });

    initModuleDropdown("biofisicoDropdown", "biofisicoTrigger", ".dropdown-menu-custom", function (target) {
        globalThis.ModuleNavigation?.navigateToComponent("biofisico.html", target);
    });

    initModuleDropdown("ocupacionDropdown", "ocupacionTrigger", ".dropdown-menu-custom", function (target) {
        globalThis.ModuleNavigation?.navigateToComponent("ocupacion.html", target);
    });

    initModuleDropdown("socioeconomicoDropdown", "socioeconomicoTrigger", ".dropdown-menu-custom", function (target) {
        globalThis.ModuleNavigation?.navigateToComponent("socioeconomico.html", target);
    });
}

function getArcgisRequire() {
    const directRequire = globalThis.require || window.require || (typeof require === "function" ? require : null);
    return typeof directRequire === "function" ? directRequire : null;
}

function waitForArcgisRequire(timeoutMs = 10000) {
    return new Promise(resolve => {
        const existingRequire = getArcgisRequire();
        if (typeof existingRequire === "function") {
            resolve(existingRequire);
            return;
        }

        const start = Date.now();
        const timer = setInterval(() => {
            const candidate = getArcgisRequire();
            if (typeof candidate === "function" || Date.now() - start >= timeoutMs) {
                clearInterval(timer);
                resolve(typeof candidate === "function" ? candidate : null);
            }
        }, 50);
    });
}

const arcgisRequire = await waitForArcgisRequire();

if (typeof arcgisRequire !== "function") {
    console.warn("No se pudo inicializar ArcGIS: window.require no está disponible.");
} else {
    arcgisRequire([
        "esri/Map",
        "esri/views/MapView",
        "esri/layers/FeatureLayer",
        "esri/layers/MapImageLayer",
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

    ], function (EsriMap, MapView, FeatureLayer, MapImageLayer, Basemap, TileLayer, VectorTileLayer, Legend,
        GraphicsLayer, Graphic, Extent, Home, Locate, BasemapGallery, Expand, ScaleBar, esriRequest) {


        const mainMap = createMainMap({
            EsriMap,
            MapView,
            Basemap,
            TileLayer,
            VectorTileLayer
        });


        map = mainMap.map;
        view = mainMap.view;

        currentMode = "ORDENAMIENTO";
        syncStateFromGlobals();
        AppState.currentMode = "ORDENAMIENTO";
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

        window.cargarOrdenamientoActual = cargarOrdenamientoActual;

        view.on("click", async (event) => {
            await manejarClickMapaVigencia(event);
            await manejarClickMapaClasificacionSuelo(event);
            await manejarClickMapaAreasActividad(event);
            await manejarClickMapaZonificacionRural(event);
        });
        bindAreasActividadMapClickFallback();
        let extentInicial = null;

        view.when(() => {
            extentInicial = view.map.initialViewProperties?.extent?.clone() || view.extent.clone();
            hideTimeSlider();

            // MAPA PRIMERO: Cargar la capa inicial apenas el view está listo,
            // sin esperar a que los municipios terminen de cargar
            if (typeof window.cargarOrdenamientoActual === "function") {
                window.cargarOrdenamientoActual();
            }
        });
        const zoomSlider = document.getElementById("zoomSlider");
        if (zoomSlider) {
            zoomSlider.value = view.zoom;
            zoomSlider.addEventListener("input", function () {
                view.zoom = Number(this.value);
            });
        }

        view.watch("zoom", function (z) {
            if (zoomSlider) {
                zoomSlider.value = z;
            }
        });

        function hideTimeSlider() {
            if (zoomSlider) {
                zoomSlider.min = 2;
                zoomSlider.max = 12;
                zoomSlider.step = 0.1;
                zoomSlider.value = view.zoom;
            }

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
                        clearZonificacionRuralSelection();

                        if (
                            currentMainModule === "ORDENAMIENTO" &&
                            currentOrdenamientoTab === "ZONIFICACION_RURAL" &&
                            layerGlobal
                        ) {
                            const config = ORDENAMIENTO_CONFIG[currentOrdenamientoTab];
                            const whereOrdenamiento = buildWhereOrdenamientoForCurrentTerritory(config);
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

            container.style.display = "none";
        }

        initOverview({
            EsriMap,
            MapView,
            Basemap,
            TileLayer,
            GraphicsLayer,
            Graphic,
            Extent
        });
        const onViewStop = debounce(async () => {
            const config = getActiveLayerConfig();
            if (!config) return;
            if (config.isOrdenamiento || config.ordenamientoType) return;

            const activeLayer = layerGlobal;
            if (!activeLayer) return;

            // guardia
            if (typeof updateLegendByExtent === "function") {
                await updateLegendByExtent(activeLayer, config);
            }
        }, 200);


        // Inicialización
        init();

        function init() {
            document.getElementById("btnRefreshBusqueda").onclick = limpiarBusqueda;
            const btnReiniciarConsulta = document.getElementById("btnReiniciarConsulta");
            if (btnReiniciarConsulta) {
                btnReiniciarConsulta.onclick = () => {
                    reiniciarConsultaActual();
                };
            }
            initializeOrdenamientoModule();
            syncChartSideLayout(currentOrdenamientoTab);
            cargarMunicipios();
            document.getElementById("legendToggle").onclick = toggleLegend;
            renderControls();
            setOrdenamientoInitialChartState();
            requestAnimationFrame(() => {
                cargarOrdenamientoActual();
            });
        }

        function limpiarBusqueda() {
            hideTimeSlider();

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
            layerViewGlobal = null;
            chartLayerGlobal = null;
            lastHoverWhere = "";
            legendFilterLabel = null;

            syncStateFromGlobals();

            // Limpiar capas y filtros del mapa
            clearLayers();

            // Limpiar highlights
            if (highlightHandle) {
                try { highlightHandle.remove(); } catch (e) { }
                highlightHandle = null;
            }
            clearVigenciaMunicipioHighlight();

            // Limpiar gráfica
            setOrdenamientoInitialChartState();

            // Limpiar leyenda
            const legendTitle = document.getElementById("legendTitle");
            const legendContent = document.getElementById("legendContent");
            if (legendTitle) legendTitle.textContent = "Leyenda";
            if (legendContent) {
                legendContent.innerHTML = `<p class="oot-js-ordenamiento-main-1">Seleccione un departamento o municipio</p>`;
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
            renderControls();

            if (currentMainModule === "ORDENAMIENTO") {
                updateMapViewBadge("Ordenamiento Territorial");
            }

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

        function destroyOrdenamientoChartInstance() {
            if (chartInstance) {
                try { chartInstance.destroy(); } catch (_) { }
                chartInstance = null;
            }
            if (vigenciaTipoChartInstance) {
                try { vigenciaTipoChartInstance.destroy(); } catch (_) { }
                vigenciaTipoChartInstance = null;
            }
            if (vigenciaEstadoChartInstance) {
                try { vigenciaEstadoChartInstance.destroy(); } catch (_) { }
                vigenciaEstadoChartInstance = null;
            }

            const vigenciaCharts = document.getElementById("vigenciaCharts");
            if (vigenciaCharts) {
                vigenciaCharts.remove();
            }

            document.getElementById("chartHighlightOverlay")?.remove();
            document.querySelectorAll("[data-aa-empty-msg='true']").forEach(el => el.remove());
            document.querySelectorAll("[data-zr-empty-msg='true']").forEach(el => el.remove());
            areasActividadCanvasChartState = null;
            zonificacionRuralCanvasChartState = null;
            areasActividadChartHighlightedCode = null;

            const canvas = document.getElementById("chart");
            if (canvas) {
                canvas.onclick = null;
                canvas.ondblclick = null;
                canvas.__aaItems = null;
                canvas.__zrItems = null;

                const bounds = typeof canvas.getBoundingClientRect === "function"
                    ? canvas.getBoundingClientRect()
                    : { width: 0, height: 0 };
                const width = Math.max(1, Math.floor(canvas.clientWidth || bounds.width || 320));
                const height = Math.max(1, Math.floor(canvas.clientHeight || bounds.height || 280));
                canvas.width = width;
                canvas.height = height;
                canvas.style.display = "none";
                canvas.style.visibility = "hidden";
                canvas.style.opacity = "0";
            }
        }

        function hasOrdenamientoActiveTerritorySelection() {
            return Boolean(
                municipioActual ||
                (filtroNivel === "DEPTO" && deptoActual && deptoActual !== "0" && deptoActual !== "COL")
            );
        }

        function hasOrdenamientoActiveCategoryFilters() {
            if (currentOrdenamientoTab === "AREAS_ACTIVIDAD") {
                const fullCodes = window.__aa_full_codes;
                const activeFilters = window.__aa_active_filters;
                if (Array.isArray(fullCodes) && fullCodes.length && activeFilters instanceof Set) {
                    return activeFilters.size > 0 && activeFilters.size < fullCodes.length;
                }
            }

            if (currentOrdenamientoTab === "CLASIFICACION_SUELO") {
                const state = window.__legendState;
                if (state?.isClasificacionSuelo && Array.isArray(state.allCodes) && state.allCodes.length && state.activeCodes instanceof Set) {
                    return state.activeCodes.size > 0 && state.activeCodes.size < state.allCodes.length;
                }
            }

            if (currentOrdenamientoTab === "ZONIFICACION_RURAL") {
                const state = window.__legendState;
                if (Array.isArray(state?.allCodes) && state.allCodes.length && state.activeCodes instanceof Set) {
                    return state.activeCodes.size > 0 && state.activeCodes.size < state.allCodes.length;
                }
            }

            if (window.__vocacionSelectedLabel) return true;

            return false;
        }

        function shouldShowOrdenamientoNoData(options = {}) {
            const serviceResponded = options.serviceResponded !== false;
            const zeroRecords = options.zeroRecords !== false;

            if (!serviceResponded || !zeroRecords) return false;

            return hasOrdenamientoActiveTerritorySelection() || hasOrdenamientoActiveCategoryFilters();
        }

        function getOrdenamientoDefaultChartBaseTitle() {
            if (currentOrdenamientoTab === "VIGENCIA") {
                return "Distribución de instrumentos de ordenamiento territorial";
            }
            if (currentOrdenamientoTab === "CLASIFICACION_SUELO") {
                return "Distribución de la clasificación del suelo";
            }
            if (currentOrdenamientoTab === "AREAS_ACTIVIDAD") {
                return "Distribución de áreas de actividad";
            }
            if (currentOrdenamientoTab === "ZONIFICACION_RURAL") {
                return currentRuralChartView === "CATEGORIA"
                    ? "Distribución de categorías de zonificación rural"
                    : "Distribución del uso principal de la zonificación rural";
            }
            return "Ordenamiento Territorial";
        }

        function getOrdenamientoInitialChartSummary() {
            if (hasOrdenamientoActiveTerritorySelection()) return "";
            return "Seleccione un departamento o municipio para consultar.";
        }

        function setOrdenamientoInitialChartState(options = {}) {
            const baseTitle = options.baseTitle || getOrdenamientoDefaultChartBaseTitle();
            setOrdenamientoChartStatus(buildOrdenamientoChartTitle(baseTitle), {
                summary: options.summary ?? getOrdenamientoInitialChartSummary()
            });
        }

        function setOrdenamientoChartStatus(message, options = {}) {
            destroyOrdenamientoChartInstance();

            const titleElement = document.getElementById("chartTitle");
            if (titleElement) {
                titleElement.textContent = message;
            }

            const summaryDiv = document.getElementById("summaryDiv");
            if (summaryDiv) {
                const summary = options.summary ?? "";
                summaryDiv.textContent = summary;
                summaryDiv.style.display = summary ? "" : "none";
            }
        }

        function setOrdenamientoChartLoading() {
            setOrdenamientoChartStatus("Cargando gráfico...");
        }

        function setOrdenamientoChartNoData(summary = "", options = {}) {
            if (!shouldShowOrdenamientoNoData(options)) {
                setOrdenamientoInitialChartState({
                    summary: summary || getOrdenamientoInitialChartSummary()
                });
                return;
            }
            setOrdenamientoChartStatus("Sin datos", { summary });
        }

        function setOrdenamientoChartError(summary = "No fue posible cargar el gráfico. Intente nuevamente.") {
            setOrdenamientoChartStatus("Error al cargar el gráfico", { summary });
        }

        function showOrdenamientoChartCanvas() {
            const canvas = document.getElementById("chart");
            if (!canvas) return;

            canvas.style.display = "block";
            canvas.style.visibility = "visible";
            canvas.style.opacity = "1";

            const summaryDiv = document.getElementById("summaryDiv");
            if (summaryDiv) {
                summaryDiv.style.display = "";
            }
        }

        function renderControls() {
            renderSubTabs();
            syncChartSideLayout(currentOrdenamientoTab);
        }
        window.renderControls = renderControls;

        function toggleLegend() {
            const content = document.getElementById("legendContent");
            const toggle = document.getElementById("legendToggle");

            if (content.classList.contains("collapsed")) {
                content.classList.remove("collapsed");
                toggle.textContent = "-";
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
                    content.innerHTML = "<p class='oot-js-ordenamiento-main-1'>No hay capa activa</p>";
                    title.textContent = "Leyenda";
                    return;
                }

                title.textContent = config.title || "Leyenda";
                window.__lastLegendRenderKey = window.__lastLegendRenderKey || "";

                if (!labels || !labels.length) {
                    content.innerHTML = "<p class='oot-js-ordenamiento-main-1'>Sin clases</p>";
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



        function _normTxt(s) {
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

            const targetLayers = layerGlobal ? [layerGlobal] : [];
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
                } catch (_) { }

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

        async function zoomOrdenamientoLayerToWhere(layer, whereClause, cycleId, options = {}) {
            if (!layer || !view || layer.destroyed) return false;

            const where = String(whereClause || "1=1").trim() || "1=1";

            if (options.skipNational && where === "1=1") {
                return false;
            }

            try {
                const res = await layer.queryExtent({ where });
                if (cycleId !== renderCycleId || layerGlobal !== layer || layer.destroyed) return false;

                if (res?.extent) {
                    await view.goTo(res.extent.expand(1.2), {
                        duration: 700,
                        easing: "ease-in-out"
                    });
                    return true;
                }
            } catch (e) {
                if (String(e?.name || "") === "AbortError") return false;
                console.warn("No se pudo hacer zoom a la capa de ordenamiento:", e);
            }
            return false;
        }

        function hasClasificacionTerritoryFilter() {
            return hasOrdenamientoActiveTerritorySelection();
        }

        function getClasificacionMunicipioCacheKey(municipioCode) {
            const code = normalizeCode(municipioCode || "");
            return code ? `MUNI:${code}` : "";
        }

        function getClasificacionDeptCacheKey(deptoCode) {
            const code = normalizeCode(deptoCode || "");
            return code ? `DEPTO:${code}` : "";
        }

        function getClasificacionVisualWhere(whereClause) {
            if (!hasClasificacionTerritoryFilter()) return "1=0";
            return whereClause && String(whereClause).trim() ? whereClause : "1=1";
        }

        function ensureClasificacionTerritoryLayer() {
            if (!clasificacionTerritoryLayer || clasificacionTerritoryLayer.destroyed) {
                clasificacionTerritoryLayer = new FeatureLayer({
                    url: MUNICIPIOS_SOURCE_LAYER_URL,
                    outFields: ["mpcodigo"]
                });
            }
            return clasificacionTerritoryLayer;
        }

        async function zoomClasificacionToTerritory(cycleId) {
            if (!view || (!municipioActual && !(filtroNivel === "DEPTO" && deptoActual))) return false;

            const requestId = ++clasificacionZoomRequestId;
            const where = municipioActual
                ? sqlEquals("mpcodigo", municipioActual)
                : sqlStartsWith("mpcodigo", deptoActual);
            const cacheKey = municipioActual
                ? getClasificacionMunicipioCacheKey(municipioActual)
                : getClasificacionDeptCacheKey(deptoActual);
            markClasificacionPerf("zoom-territory-start", cycleId, { cacheKey });

            try {
                const cachedExtent = clasificacionTerritoryExtentCache.get(cacheKey);
                if (cachedExtent) {
                    if (cycleId !== renderCycleId || requestId !== clasificacionZoomRequestId) return false;
                    const extent = typeof cachedExtent.clone === "function" ? cachedExtent.clone() : cachedExtent;
                    await view.goTo(extent.expand(municipioActual ? 1.35 : 1.18), {
                        duration: 800,
                        easing: "ease-in-out"
                    });
                    markClasificacionPerf("zoom-territory-cache", cycleId, { cacheKey });
                    return true;
                }

                const result = await ensureClasificacionTerritoryLayer().queryExtent({ where });

                if (cycleId !== renderCycleId || requestId !== clasificacionZoomRequestId) return false;

                if (result?.extent) {
                    const extent = typeof result.extent.clone === "function" ? result.extent.clone() : result.extent;
                    clasificacionTerritoryExtentCache.set(cacheKey, extent);
                    await view.goTo(extent.expand(municipioActual ? 1.35 : 1.18), {
                        duration: 800,
                        easing: "ease-in-out"
                    });
                    markClasificacionPerf("zoom-territory-query", cycleId, { cacheKey });
                    return true;
                }
            } catch (e) {
                if (String(e?.name || "") !== "AbortError") {
                    console.warn("No se pudo hacer zoom al territorio seleccionado:", e);
                }
            }

            return false;
        }

        function withTimeout(promise, timeoutMs, fallbackValue) {
            return Promise.race([
                promise,
                new Promise(resolve => setTimeout(() => resolve(fallbackValue), timeoutMs))
            ]);
        }

        function getClasificacionTerritoryCacheKey() {
            if (municipioActual) return `MUNI:${municipioActual}`;
            if (filtroNivel === "DEPTO" && deptoActual) return `DEPTO:${deptoActual}`;
            return "";
        }

        function rememberClasificacionTerritoryRender(baseWhere, items = null) {
            const cacheKey = getClasificacionTerritoryCacheKey();
            if (!cacheKey) return;

            if (clasificacionRecentTerritoryCache.has(cacheKey)) {
                clasificacionRecentTerritoryCache.delete(cacheKey);
            }
            clasificacionRecentTerritoryCache.set(cacheKey, {
                baseWhere,
                itemCodes: getClasificacionCategoryCodes(items),
                t: Date.now()
            });

            while (clasificacionRecentTerritoryCache.size > CLASIFICACION_RECENT_TERRITORIES_LIMIT) {
                clasificacionRecentTerritoryCache.delete(clasificacionRecentTerritoryCache.keys().next().value);
            }
        }

        function getClasificacionCategorySignature(baseWhere, items = null) {
            return [
                getClasificacionTerritoryCacheKey(),
                getClasificacionVisualWhere(baseWhere),
                getClasificacionCategoryCodes(items).join(",")
            ].join("|");
        }

        function hasClasificacionCategoryLayerSet(baseWhere, items = null) {
            const codes = getClasificacionCategoryCodes(items);
            if (!codes.length || clasificacionCategoryBaseWhereApplied !== baseWhere) return false;
            return codes.every(code => {
                const layer = clasificacionCategoryLayers.get(String(code));
                return layer && !layer.destroyed;
            });
        }

        function cancelClasificacionCategoryPrewarm() {
            if (clasificacionCategoryPrewarmTimer) {
                clearTimeout(clasificacionCategoryPrewarmTimer);
                clasificacionCategoryPrewarmTimer = null;
            }
            clasificacionCategoryPrewarmSeq++;
        }

        function parkClasificacionCategoryLayers(source = "render") {
            let changed = false;
            clasificacionCategoryModeActive = false;

            for (const layer of clasificacionCategoryLayers.values()) {
                if (!layer || layer.destroyed) continue;
                if (layer.visible !== false) {
                    layer.visible = false;
                    changed = true;
                }
                if (layer.opacity !== 0.001) {
                    layer.opacity = 0.001;
                    changed = true;
                }
                const sublayer = layer.findSublayerById?.(ORDENAMIENTO_CONFIG.CLASIFICACION_SUELO.mapServerLayerId ?? 1);
                if (sublayer && sublayer.visible !== false) {
                    sublayer.visible = false;
                    changed = true;
                }
            }

            if (changed) {
                markClasificacionPerf("category-layers-parked", renderCycleId, { source });
            }
        }

        function blankClasificacionVisualLayerForNewQuery(source = "territory-change") {
            const config = ORDENAMIENTO_CONFIG.CLASIFICACION_SUELO || {};
            const sublayerId = config.mapServerLayerId ?? 1;

            clasificacionVisualWhereApplied = null;
            clasificacionVisualVisibleApplied = false;
            clasificacionLegendLastSignature = "";

            if (clasificacionVisualLayer && !clasificacionVisualLayer.destroyed) {
                try {
                    const sublayer = getClasificacionVisualSublayer(sublayerId);
                    if (sublayer) {
                        sublayer.definitionExpression = "1=0";
                        sublayer.visible = false;
                    } else {
                        clasificacionVisualLayer.sublayers = [{
                            id: sublayerId,
                            visible: false,
                            minScale: 0,
                            maxScale: 0,
                            definitionExpression: "1=0"
                        }];
                    }
                } catch (_) { }

                try { clasificacionVisualLayer.visible = false; } catch (_) { }
                try { clasificacionVisualLayer.refresh?.(); } catch (_) { }
            }

            markClasificacionPerf("visual-blanked", renderCycleId, { source });
        }

        function waitForClasificacionViewStationary(timeoutMs = 1800) {
            if (!view || view.destroyed || view.stationary) return Promise.resolve(true);

            return new Promise(resolve => {
                let done = false;
                let handle = null;
                const finish = value => {
                    if (done) return;
                    done = true;
                    try {
                        if (handle && typeof handle.remove === "function") handle.remove();
                    } catch (_) { }
                    clearTimeout(timer);
                    resolve(value);
                };
                const timer = setTimeout(() => finish(false), timeoutMs);

                try {
                    handle = view.watch?.("stationary", stationary => {
                        if (stationary) finish(true);
                    });
                } catch (_) {
                    finish(false);
                }
            });
        }

        function cancelClasificacionDepartmentWarmup() {
            if (clasificacionDeptWarmupTimer) {
                clearTimeout(clasificacionDeptWarmupTimer);
                clasificacionDeptWarmupTimer = null;
            }
            clasificacionDeptWarmupSeq++;
        }

        function getClasificacionMunicipiosForDept(deptoCode) {
            const depto = normalizeCode(deptoCode || "");
            if (!depto || !Array.isArray(todosMunicipios)) return [];

            return todosMunicipios
                .filter(muni => String(muni?.depto || "") === depto)
                .map(muni => normalizeCode(muni.codigo || ""))
                .filter(Boolean);
        }

        function buildClasificacionWarmupMunicipios(deptoCode, priorityMunicipio = "", limit = CLASIFICACION_DEPT_WARMUP_LIMIT) {
            const municipiosDepto = getClasificacionMunicipiosForDept(deptoCode);
            if (!municipiosDepto.length) return [];

            const selected = normalizeCode(priorityMunicipio || "");
            const ordered = [];
            const pushIfUseful = code => {
                const normalized = normalizeCode(code || "");
                const cacheKey = getClasificacionMunicipioCacheKey(normalized);
                if (
                    normalized &&
                    !ordered.includes(normalized) &&
                    !clasificacionTerritoryExtentCache.has(cacheKey)
                ) {
                    ordered.push(normalized);
                }
            };

            if (selected && municipiosDepto.includes(selected)) {
                pushIfUseful(selected);
                const index = municipiosDepto.indexOf(selected);
                for (let offset = 1; ordered.length < limit && offset < municipiosDepto.length; offset++) {
                    pushIfUseful(municipiosDepto[index + offset]);
                    if (ordered.length >= limit) break;
                    pushIfUseful(municipiosDepto[index - offset]);
                }
            }

            for (const code of municipiosDepto) {
                if (ordered.length >= limit) break;
                pushIfUseful(code);
            }

            return ordered.slice(0, limit);
        }

        async function warmupClasificacionMunicipioExtent(municipioCode, seq, cycleId) {
            const code = normalizeCode(municipioCode || "");
            const cacheKey = getClasificacionMunicipioCacheKey(code);
            if (!code || !cacheKey || clasificacionTerritoryExtentCache.has(cacheKey)) {
                return false;
            }

            const startedAt = typeof performance !== "undefined" && typeof performance.now === "function"
                ? performance.now()
                : Date.now();

            const result = await withTimeout(
                ensureClasificacionTerritoryLayer().queryExtent({
                    where: sqlEquals("mpcodigo", code)
                }),
                3500,
                null
            );

            if (
                seq !== clasificacionDeptWarmupSeq ||
                cycleId !== renderCycleId ||
                currentOrdenamientoTab !== "CLASIFICACION_SUELO"
            ) {
                return false;
            }

            if (result?.extent) {
                clasificacionTerritoryExtentCache.set(
                    cacheKey,
                    typeof result.extent.clone === "function" ? result.extent.clone() : result.extent
                );
                const finishedAt = typeof performance !== "undefined" && typeof performance.now === "function"
                    ? performance.now()
                    : Date.now();
                markClasificacionPerf("dept-warmup-extent", cycleId, {
                    municipio: code,
                    elapsedMs: Math.round(finishedAt - startedAt)
                });
                return true;
            }

            markClasificacionPerf("dept-warmup-empty", cycleId, { municipio: code });
            return false;
        }

        function scheduleClasificacionDepartmentWarmup(deptoCode, options = {}) {
            cancelClasificacionDepartmentWarmup();

            if (
                currentOrdenamientoTab !== "CLASIFICACION_SUELO" ||
                !deptoCode ||
                deptoCode === "0" ||
                deptoCode === "COL"
            ) {
                return;
            }

            const cycleId = Number(options.cycleId || renderCycleId);
            const priorityMunicipio = options.priorityMunicipio || municipioActual || "";
            const limit = Number(options.limit || (
                priorityMunicipio
                    ? CLASIFICACION_MUNI_NEIGHBOR_WARMUP_LIMIT
                    : CLASIFICACION_DEPT_WARMUP_LIMIT
            ));
            const municipios = buildClasificacionWarmupMunicipios(deptoCode, priorityMunicipio, limit);

            if (isClasificacionAuxBackoffActive()) {
                markClasificacionPerf("dept-warmup-skipped", cycleId, {
                    depto: deptoCode,
                    reason: "aux-backoff"
                });
                return;
            }

            if (!municipios.length) {
                markClasificacionPerf("dept-warmup-skipped", cycleId, {
                    depto: deptoCode,
                    reason: "cached-or-empty"
                });
                return;
            }

            const seq = ++clasificacionDeptWarmupSeq;
            const delayMs = Number(options.delayMs ?? (
                priorityMunicipio
                    ? CLASIFICACION_MUNI_WARMUP_DELAY_MS
                    : CLASIFICACION_DEPT_WARMUP_DELAY_MS
            ));

            markClasificacionPerf("dept-warmup-scheduled", cycleId, {
                depto: deptoCode,
                priorityMunicipio,
                count: municipios.length,
                delayMs
            });

            clasificacionDeptWarmupTimer = setTimeout(() => {
                clasificacionDeptWarmupTimer = null;

                Promise.resolve()
                    .then(async () => {
                        if (
                            seq !== clasificacionDeptWarmupSeq ||
                            cycleId !== renderCycleId ||
                            currentOrdenamientoTab !== "CLASIFICACION_SUELO"
                        ) {
                            markClasificacionPerf("dept-warmup-skipped", cycleId, { reason: "stale-before-start" });
                            return;
                        }

                        const visualReady = await waitForClasificacionVisualReady(cycleId, "dept-warmup", 1800);
                        if (
                            !visualReady ||
                            seq !== clasificacionDeptWarmupSeq ||
                            cycleId !== renderCycleId ||
                            currentOrdenamientoTab !== "CLASIFICACION_SUELO"
                        ) {
                            markClasificacionPerf("dept-warmup-skipped", cycleId, { reason: visualReady ? "stale-after-idle" : "visual-busy" });
                            return;
                        }

                        markClasificacionPerf("dept-warmup-start", cycleId, {
                            depto: deptoCode,
                            count: municipios.length
                        });

                        let cached = 0;
                        for (const code of municipios) {
                            if (
                                seq !== clasificacionDeptWarmupSeq ||
                                cycleId !== renderCycleId ||
                                currentOrdenamientoTab !== "CLASIFICACION_SUELO"
                            ) {
                                markClasificacionPerf("dept-warmup-stopped", cycleId, { cached });
                                return;
                            }

                            try {
                                if (await warmupClasificacionMunicipioExtent(code, seq, cycleId)) {
                                    cached++;
                                }
                            } catch (e) {
                                recordClasificacionAsyncIssue("dept-warmup-error", e, cycleId, { municipio: code });
                            }

                            await new Promise(resolve => setTimeout(resolve, CLASIFICACION_DEPT_WARMUP_STEP_MS));
                        }

                        markClasificacionPerf("dept-warmup-finished", cycleId, {
                            depto: deptoCode,
                            cached
                        });
                    })
                    .catch(e => {
                        recordClasificacionAsyncIssue("dept-warmup-error", e, cycleId, { depto: deptoCode });
                    });
            }, delayMs);
        }

        async function waitForClasificacionLayerIdle(layer, timeoutMs = 1800) {
            if (!view || !layer || layer.destroyed) return false;

            try {
                const layerView = await view.whenLayerView(layer);
                if (!layerView || layerView.destroyed || !layerView.updating) return true;

                return await new Promise(resolve => {
                    let done = false;
                    let handle = null;
                    const finish = value => {
                        if (done) return;
                        done = true;
                        try {
                            if (handle && typeof handle.remove === "function") handle.remove();
                        } catch (_) { }
                        clearTimeout(timer);
                        resolve(value);
                    };
                    const timer = setTimeout(() => finish(false), timeoutMs);

                    try {
                        handle = layerView.watch?.("updating", updating => {
                            if (!updating) finish(true);
                        });
                    } catch (_) {
                        finish(false);
                    }
                });
            } catch (_) {
                return false;
            }
        }

        function isClasificacionAuxBackoffActive() {
            return Date.now() < clasificacionAuxBackoffUntil;
        }

        function activateClasificacionAuxBackoff(source, cycleId = renderCycleId) {
            clasificacionAuxBackoffUntil = Math.max(
                clasificacionAuxBackoffUntil,
                Date.now() + CLASIFICACION_AUX_BACKOFF_MS
            );
            markClasificacionPerf("aux-backoff", cycleId, {
                source,
                untilMs: clasificacionAuxBackoffUntil
            });
        }

        async function waitForClasificacionVisualReady(cycleId, source, timeoutMs = CLASIFICACION_VISUAL_IDLE_TIMEOUT_MS) {
            if (
                cycleId !== renderCycleId ||
                !clasificacionVisualLayer ||
                clasificacionVisualLayer.destroyed ||
                currentOrdenamientoTab !== "CLASIFICACION_SUELO"
            ) {
                markClasificacionPerf("visual-ready-skipped", cycleId, { source, reason: "stale" });
                return false;
            }

            await waitForClasificacionViewStationary(1200);

            if (
                cycleId !== renderCycleId ||
                !clasificacionVisualLayer ||
                clasificacionVisualLayer.destroyed ||
                currentOrdenamientoTab !== "CLASIFICACION_SUELO"
            ) {
                markClasificacionPerf("visual-ready-skipped", cycleId, { source, reason: "stale-after-stationary" });
                return false;
            }

            const ready = await waitForClasificacionLayerIdle(clasificacionVisualLayer, timeoutMs);
            if (!ready) {
                markClasificacionPerf("visual-busy-skip-aux", cycleId, { source, timeoutMs });
                activateClasificacionAuxBackoff(source, cycleId);
                return false;
            }

            markClasificacionPerf("visual-ready", cycleId, { source });
            return true;
        }

        function nudgeClasificacionVisualPaint(cycleId, source = "render") {
            if (
                cycleId !== renderCycleId ||
                !view ||
                !clasificacionVisualLayer ||
                clasificacionVisualLayer.destroyed
            ) {
                return;
            }

            requestAnimationFrame(() => {
                if (
                    cycleId !== renderCycleId ||
                    !view ||
                    !clasificacionVisualLayer ||
                    clasificacionVisualLayer.destroyed
                ) {
                    return;
                }

                try {
                    if (view && typeof view.resize === "function") view.resize();
                } catch (_) { }
                try {
                    if (clasificacionVisualLayer && typeof clasificacionVisualLayer.refresh === "function") {
                        clasificacionVisualLayer.refresh();
                    }
                } catch (_) { }
                markClasificacionPerf("visual-paint-nudge", cycleId, { source });
            });
        }

        function getClasificacionVisualSublayer(sublayerId) {
            if (!clasificacionVisualLayer || clasificacionVisualLayer.destroyed) return null;

            let sublayer = clasificacionVisualLayer.findSublayerById?.(sublayerId);
            if (sublayer) return sublayer;

            const sublayers = clasificacionVisualLayer.sublayers;
            if (typeof sublayers?.find === "function") {
                sublayer = sublayers.find(item => Number(item?.id) === Number(sublayerId));
            } else if (Array.isArray(sublayers)) {
                sublayer = sublayers.find(item => Number(item?.id) === Number(sublayerId));
            }

            return sublayer || null;
        }

        function allowClasificacionSublayerAtAllScales(sublayer) {
            if (!sublayer) return false;

            let changed = false;
            if (Number(sublayer.minScale || 0) !== 0) {
                sublayer.minScale = 0;
                changed = true;
            }
            if (Number(sublayer.maxScale || 0) !== 0) {
                sublayer.maxScale = 0;
                changed = true;
            }
            return changed;
        }

        function reapplyClasificacionVisualWhenReady(whereClause, cycleId, source = "layer-ready") {
            if (!clasificacionVisualLayer || clasificacionVisualLayer.destroyed) return;

            Promise.resolve(
                clasificacionVisualLayer && typeof clasificacionVisualLayer.when === "function"
                    ? clasificacionVisualLayer.when()
                    : null
            )
                .then(async () => {
                    if (
                        cycleId !== renderCycleId ||
                        !clasificacionVisualLayer ||
                        clasificacionVisualLayer.destroyed
                    ) {
                        return;
                    }

                    const sublayerId = ORDENAMIENTO_CONFIG.CLASIFICACION_SUELO.mapServerLayerId ?? 1;
                    const sublayer = getClasificacionVisualSublayer(sublayerId);
                    if (sublayer && typeof sublayer.load === "function") {
                        await sublayer.load();
                    }

                    if (
                        cycleId !== renderCycleId ||
                        !clasificacionVisualLayer ||
                        clasificacionVisualLayer.destroyed
                    ) {
                        return;
                    }

                    allowClasificacionSublayerAtAllScales(sublayer);

                    applyClasificacionVisualWhere(whereClause, {
                        updateCategoryLayers: false,
                        forceRefresh: true,
                        source
                    });
                    nudgeClasificacionVisualPaint(cycleId, source);
                })
                .catch(e => {
                    recordClasificacionAsyncIssue("visual-layer-ready-error", e, cycleId, { source });
                });
        }

        function scheduleClasificacionCategoryPrewarm(baseWhere, items = null, cycleId = renderCycleId, delayMs = null) {
            cancelClasificacionCategoryPrewarm();

            if (!hasClasificacionTerritoryFilter() || getClasificacionVisualWhere(baseWhere) === "1=0") {
                markClasificacionPerf("category-prewarm-skipped", cycleId, { reason: "no-territory" });
                return;
            }

            if (isClasificacionAuxBackoffActive()) {
                markClasificacionPerf("category-prewarm-skipped", cycleId, { reason: "aux-backoff" });
                return;
            }

            // A nivel departamental NO se precargan capas por categoría: cada categoría
            // sería un MapImageLayer que cubre todo el departamento y, al pasar luego a
            // una consulta municipal, esas capas quedarían como residuo mostrando el
            // departamento completo. Se mantiene el prewarm solo a nivel municipal.
            if (!municipioActual) {
                markClasificacionPerf("category-prewarm-skipped", cycleId, { reason: "department-too-heavy" });
                return;
            }

            const effectiveItems = Array.isArray(items) && items.length ? items : getClasificacionFallbackItems();
            const signature = getClasificacionCategorySignature(baseWhere, effectiveItems);
            rememberClasificacionTerritoryRender(baseWhere, effectiveItems);

            if (
                signature === clasificacionCategoryPrewarmSignature &&
                hasClasificacionCategoryLayerSet(baseWhere, effectiveItems)
            ) {
                markClasificacionPerf("category-prewarm-skipped", cycleId, { reason: "cached" });
                return;
            }

            const seq = ++clasificacionCategoryPrewarmSeq;
            const waitMs = Number.isFinite(Number(delayMs))
                ? Number(delayMs)
                : (municipioActual ? CLASIFICACION_CATEGORY_PREWARM_MUNI_DELAY_MS : CLASIFICACION_CATEGORY_PREWARM_DEPTO_DELAY_MS);

            markClasificacionPerf("category-prewarm-scheduled", cycleId, {
                delayMs: waitMs,
                territory: getClasificacionTerritoryCacheKey()
            });

            clasificacionCategoryPrewarmTimer = setTimeout(() => {
                clasificacionCategoryPrewarmTimer = null;

                Promise.resolve()
                    .then(async () => {
                        if (
                            seq !== clasificacionCategoryPrewarmSeq ||
                            cycleId !== renderCycleId ||
                            !clasificacionVisualLayer ||
                            clasificacionVisualLayer.destroyed
                        ) {
                            markClasificacionPerf("category-prewarm-skipped", cycleId, { reason: "stale-before-idle" });
                            return;
                        }

                        markClasificacionPerf("category-prewarm-waiting-idle", cycleId);
                        const visualReady = await waitForClasificacionVisualReady(cycleId, "category-prewarm", 1600);
                        if (!visualReady) {
                            markClasificacionPerf("category-prewarm-skipped", cycleId, { reason: "visual-busy" });
                            return;
                        }

                        if (
                            seq !== clasificacionCategoryPrewarmSeq ||
                            cycleId !== renderCycleId ||
                            !clasificacionVisualLayer ||
                            clasificacionVisualLayer.destroyed
                        ) {
                            markClasificacionPerf("category-prewarm-skipped", cycleId, { reason: "stale-after-idle" });
                            return;
                        }

                        markClasificacionPerf("category-prewarm-start", cycleId, {
                            territory: getClasificacionTerritoryCacheKey()
                        });
                        if (ensureClasificacionCategoryLayers(baseWhere, effectiveItems, {
                            prewarm: true,
                            source: "idle-prewarm"
                        })) {
                            clasificacionCategoryPrewarmSignature = signature;
                        }
                    })
                    .catch(e => {
                        recordClasificacionAsyncIssue("category-prewarm-error", e, cycleId);
                    });
            }, waitMs);
        }

        function applyClasificacionVisualWhere(whereClause, options = {}) {
            const where = whereClause && String(whereClause).trim() ? whereClause : "1=1";
            const updateVisual = options.updateVisual !== false;
            const updateFeatureLayer = options.updateFeatureLayer !== false;
            const updateCategoryLayers = options.updateCategoryLayers === true;
            const source = options.source || "render";
            const forceRefresh = options.forceRefresh === true;
            const visualWhere = getClasificacionVisualWhere(where);
            const canRenderVisual = visualWhere !== "1=0";
            const useMunicipalFeatureVisual = Boolean(municipioActual && canRenderVisual);
            let didChange = false;

            if ((updateFeatureLayer || municipioActual) && layerGlobal && !layerGlobal.destroyed) {
                if (layerGlobal.definitionExpression !== visualWhere) {
                    layerGlobal.definitionExpression = visualWhere;
                    didChange = true;
                }
                if (layerGlobal.minScale !== 0) layerGlobal.minScale = 0;
                if (layerGlobal.maxScale !== 0) layerGlobal.maxScale = 0;
                if (layerGlobal.visible !== useMunicipalFeatureVisual) {
                    layerGlobal.visible = useMunicipalFeatureVisual;
                    didChange = true;
                }
            }

            if (!updateVisual) return;

            if (clasificacionVisualLayer && !clasificacionVisualLayer.destroyed) {
                const showMapImage = canRenderVisual && !useMunicipalFeatureVisual;
                if (clasificacionVisualLayer.visible !== showMapImage) {
                    clasificacionVisualLayer.visible = showMapImage;
                    didChange = true;
                }
            }

            const sublayerId = ORDENAMIENTO_CONFIG.CLASIFICACION_SUELO.mapServerLayerId ?? 1;
            const sublayer = getClasificacionVisualSublayer(sublayerId);
            if (sublayer) {
                sublayer.renderer = buildClasificacionSueloRenderer(
                    ORDENAMIENTO_CONFIG.CLASIFICACION_SUELO
                );
                if (allowClasificacionSublayerAtAllScales(sublayer)) {
                    didChange = true;
                }
                if (sublayer.definitionExpression !== visualWhere) {
                    sublayer.definitionExpression = visualWhere;
                    didChange = true;
                }
                const showMapImage = canRenderVisual && !useMunicipalFeatureVisual;
                if (sublayer.visible !== showMapImage) {
                    sublayer.visible = showMapImage;
                    didChange = true;
                }
            } else if (clasificacionVisualLayer && !clasificacionVisualLayer.destroyed) {
                clasificacionVisualLayer.sublayers = [{
                    id: sublayerId,
                    visible: canRenderVisual,
                    minScale: 0,
                    maxScale: 0,
                    definitionExpression: visualWhere,
                    renderer: buildClasificacionSueloRenderer(
                        ORDENAMIENTO_CONFIG.CLASIFICACION_SUELO
                    )
                }];
                didChange = true;
                markClasificacionPerf("visual-sublayer-reset", renderCycleId, {
                    source,
                    visible: canRenderVisual
                });
            }

            if (
                clasificacionVisualWhereApplied !== visualWhere ||
                clasificacionVisualVisibleApplied !== canRenderVisual
            ) {
                didChange = true;
                clasificacionVisualWhereApplied = visualWhere;
                clasificacionVisualVisibleApplied = canRenderVisual;
            }
            markClasificacionPerf("visual-filter-ready", renderCycleId, {
                visible: canRenderVisual,
                changed: didChange,
                source
            });

            if (forceRefresh && didChange && clasificacionVisualLayer && !clasificacionVisualLayer.destroyed) {
                try { clasificacionVisualLayer.refresh?.(); } catch (_) { }
            }

            if (updateCategoryLayers) {
                ensureClasificacionCategoryLayers(where, getClasificacionFallbackItems(), {
                    prewarm: true,
                    source
                });
            }

            return canRenderVisual;
        }

        function syncClasificacionManagedLayers() {
            const managed = [];
            if (clasificacionVisualLayer && !clasificacionVisualLayer.destroyed) {
                managed.push(clasificacionVisualLayer);
            }
            for (const layer of clasificacionCategoryLayers.values()) {
                if (layer && !layer.destroyed) managed.push(layer);
            }
            layersGlobal = managed;
            AppState.layersGlobal = layersGlobal;
        }

        function resetClasificacionCategoryVisuals() {
            cancelClasificacionCategoryPrewarm();
            cancelClasificacionDepartmentWarmup();
            // Eliminar realmente las capas por categoría del mapa (no solo limpiar la
            // referencia). Si solo se limpia el Map, las capas quedan huérfanas en el
            // mapa y se ven como residuos del territorio anterior.
            for (const layer of clasificacionCategoryLayers.values()) {
                if (!layer) continue;
                try { layer.visible = false; } catch (_) { }
                try { map?.remove(layer); } catch (_) { }
                try { layer.destroy?.(); } catch (_) { }
            }
            clasificacionCategoryLayers.clear();
            clasificacionCategoryModeActive = false;
            clasificacionCategoryBaseWhereApplied = "";
            clasificacionCategoryPrewarmSignature = "";
        }

        function getClasificacionCategoryCodes(items = null) {
            const fromItems = Array.isArray(items)
                ? items.map(item => String(item.code ?? "").trim()).filter(Boolean)
                : [];
            const codes = fromItems.length
                ? fromItems
                : Object.keys(CLASIFICACION_SUELO_PALETTE);
            return Array.from(new Set(codes)).sort((a, b) => Number(a) - Number(b));
        }

        function buildClasificacionCategoryWhere(baseWhere, code) {
            const config = ORDENAMIENTO_CONFIG.CLASIFICACION_SUELO;
            const typeField = config.typeField || "Tipo_Clasificacion_Suelo";
            const visualWhere = getClasificacionVisualWhere(baseWhere);
            const numericCode = Number(String(code).trim());

            if (visualWhere === "1=0" || !Number.isFinite(numericCode)) return "1=0";
            return `(${visualWhere}) AND (${typeField} = ${numericCode})`;
        }

        function ensureClasificacionCategoryLayers(baseWhere, items = null, options = {}) {
            if (!map || !clasificacionVisualLayer || clasificacionVisualLayer.destroyed) return false;

            const config = ORDENAMIENTO_CONFIG.CLASIFICACION_SUELO;
            const codes = getClasificacionCategoryCodes(items);
            const canRender = getClasificacionVisualWhere(baseWhere) !== "1=0";
            const isPrewarm = options.prewarm === true;
            const opacity = clasificacionCategoryModeActive ? 0.92 : 0.001;
            const legendState = window.__legendState?.isClasificacionSuelo ? window.__legendState : null;
            let created = 0;
            let updated = 0;

            for (const code of codes) {
                const categoryWhere = buildClasificacionCategoryWhere(baseWhere, code);
                const paletteInfo = CLASIFICACION_SUELO_PALETTE[String(code)] || {};
                const shouldShow = canRender && !isPrewarm && (
                    !clasificacionCategoryModeActive ||
                    !legendState?.activeCodes ||
                    legendState.activeCodes.has(String(code))
                );
                let layer = clasificacionCategoryLayers.get(String(code));

                if (!layer || layer.destroyed) {
                    layer = new MapImageLayer({
                        url: config.mapServerUrl,
                        title: `${config.title} - ${paletteInfo.label || code}`,
                        opacity,
                        visible: shouldShow,
                        listMode: "hide",
                        sublayers: [{
                            id: config.mapServerLayerId ?? 1,
                            visible: shouldShow,
                            minScale: 0,
                            maxScale: 0,
                            definitionExpression: categoryWhere,
                            renderer: buildClasificacionSueloRenderer(config)
                        }]
                    });
                    clasificacionCategoryLayers.set(String(code), layer);
                    map.add(layer);
                    layer.when(() => {
                        allowClasificacionSublayerAtAllScales(
                            layer.findSublayerById?.(config.mapServerLayerId ?? 1)
                        );
                    }).catch(() => { });
                    created++;
                } else {
                    const sublayer = layer.findSublayerById?.(config.mapServerLayerId ?? 1);
                    allowClasificacionSublayerAtAllScales(sublayer);
                    if (sublayer) {
                        sublayer.renderer = buildClasificacionSueloRenderer(config);
                    }
                    if (sublayer && sublayer.definitionExpression !== categoryWhere) {
                        sublayer.definitionExpression = categoryWhere;
                        updated++;
                    }
                    if (sublayer && sublayer.visible !== shouldShow) {
                        sublayer.visible = shouldShow;
                        updated++;
                    }
                    if (layer.visible !== shouldShow) {
                        layer.visible = shouldShow;
                        updated++;
                    }
                    if (layer.opacity !== opacity) {
                        layer.opacity = opacity;
                        updated++;
                    }
                }
            }

            for (const [code, layer] of Array.from(clasificacionCategoryLayers.entries())) {
                if (!codes.includes(code)) {
                    try { map.remove(layer); } catch (_) { }
                    try {
                        if (layer && typeof layer.destroy === "function") layer.destroy();
                    } catch (_) { }
                    clasificacionCategoryLayers.delete(code);
                }
            }

            clasificacionCategoryBaseWhereApplied = baseWhere;
            syncClasificacionManagedLayers();

            if (created || updated || options.source) {
                markClasificacionPerf("category-layers-ready", renderCycleId, {
                    source: options.source || "render",
                    created,
                    updated,
                    count: clasificacionCategoryLayers.size,
                    prewarm: Boolean(options.prewarm)
                });
            }

            return true;
        }

        function applyClasificacionCategoryVisibility(state, options = {}) {
            if (!state?.activeCodes || !clasificacionCategoryLayers.size) return false;

            const activeCodes = state.activeCodes;
            const startedAt = Number(options.startedAt || (
                typeof performance !== "undefined" && typeof performance.now === "function"
                    ? performance.now()
                    : Date.now()
            ));
            let changed = false;

            clasificacionCategoryModeActive = true;

            if (municipioActual && layerGlobal && !layerGlobal.destroyed) {
                const compiled = getClasificacionLegendFilter(state);
                if (layerGlobal.definitionExpression !== compiled.where) {
                    layerGlobal.definitionExpression = compiled.where;
                    changed = true;
                }
                const shouldShowFeatureLayer = compiled.where !== "1=0";
                if (layerGlobal.visible !== shouldShowFeatureLayer) {
                    layerGlobal.visible = shouldShowFeatureLayer;
                    changed = true;
                }
                if (clasificacionVisualLayer && !clasificacionVisualLayer.destroyed) {
                    clasificacionVisualLayer.visible = false;
                }
                for (const layer of clasificacionCategoryLayers.values()) {
                    if (layer && !layer.destroyed) layer.visible = false;
                }

                markClasificacionPerf("category-toggle-applied", renderCycleId, {
                    active: activeCodes.size,
                    all: state.allCodes?.length || clasificacionCategoryLayers.size,
                    changed,
                    municipalFeatureLayer: true
                });
                return true;
            }

            if (clasificacionVisualLayer && !clasificacionVisualLayer.destroyed && clasificacionVisualLayer.visible !== false) {
                clasificacionVisualLayer.visible = false;
                changed = true;
            }

            for (const [code, layer] of clasificacionCategoryLayers.entries()) {
                if (!layer || layer.destroyed) continue;
                const shouldShow = activeCodes.has(String(code));
                if (layer.visible !== shouldShow) {
                    layer.visible = shouldShow;
                    changed = true;
                }
                if (layer.opacity !== 0.92) {
                    layer.opacity = 0.92;
                    changed = true;
                }
                const sublayer = layer.findSublayerById?.(ORDENAMIENTO_CONFIG.CLASIFICACION_SUELO.mapServerLayerId ?? 1);
                if (sublayer && sublayer.visible !== shouldShow) {
                    sublayer.visible = shouldShow;
                    changed = true;
                }
            }

            const finishedAt = typeof performance !== "undefined" && typeof performance.now === "function"
                ? performance.now()
                : Date.now();

            markClasificacionPerf("category-toggle-applied", renderCycleId, {
                active: activeCodes.size,
                all: state.allCodes?.length || clasificacionCategoryLayers.size,
                changed,
                elapsedMs: Math.round(finishedAt - startedAt)
            });

            return true;
        }

        function cancelClasificacionAuxiliaryLoad() {
            if (clasificacionChartTimer) {
                clearTimeout(clasificacionChartTimer);
                clasificacionChartTimer = null;
            }
        }

        // Lectura sincrónica del caché de estadísticas (sin disparar red).
        // Permite renderizar el gráfico al instante cuando ya hay datos cacheados.
        function getClasificacionStatsFromCacheSync(layer, config, whereClause) {
            const areaField = config.areaField || "CSArea";
            const typeField = config.typeField || "Tipo_Clasificacion_Suelo";
            const primaryLayerUrl = config.mapServerUrl && config.mapServerLayerId !== undefined
                ? `${String(config.mapServerUrl).replace(/\/+$/, "")}/${config.mapServerLayerId}`
                : (config.url || layer?.url);
            const where = whereClause || layer?.definitionExpression || "1=1";
            const cacheKey = [
                String(primaryLayerUrl || "").replace(/\/+$/, ""),
                where,
                typeField,
                areaField
            ].join("|");
            return clasificacionStatsCache.has(cacheKey) ? clasificacionStatsCache.get(cacheKey) : null;
        }

        function runClasificacionChartRender(layer, config, whereClause, cycleId, stage) {
            Promise.resolve()
                .then(async () => {
                    if (cycleId !== renderCycleId || layerGlobal !== layer || layer?.destroyed) {
                        markClasificacionPerf("aux-skipped-stale", cycleId, { stage });
                        return;
                    }
                    markClasificacionPerf("aux-start", cycleId, { stage });
                    // El gráfico se consulta en paralelo con el mapa: NO espera a que
                    // la capa visual de Clasificación del suelo termine de pintarse.
                    await renderClasificacionSueloCharts(layer, config, whereClause, cycleId);
                })
                .catch(e => {
                    recordClasificacionAsyncIssue("aux-error", e, cycleId);
                    if (cycleId === renderCycleId && layerGlobal === layer && !layer?.destroyed) {
                        setOrdenamientoChartError(
                            "El servicio de Clasificación del suelo está tardando más de lo normal. La capa se muestra en el mapa; vuelva a intentarlo."
                        );
                    }
                })
                .finally(() => {
                    if (cycleId === renderCycleId && layerGlobal === layer && !layer?.destroyed) {
                        markClasificacionPerf("aux-finished", cycleId, { stage });
                    }
                });
        }

        function scheduleClasificacionAuxiliaryLoad(layer, config, whereClause, cycleId, delayMs = 250) {
            cancelClasificacionAuxiliaryLoad();

            if (!hasClasificacionTerritoryFilter()) return;

            // Caché disponible -> renderizar el gráfico de inmediato (sin demora ni
            // espera a la capa del mapa).
            if (getClasificacionStatsFromCacheSync(layer, config, whereClause)) {
                markClasificacionPerf("aux-cache-immediate", cycleId, { where: whereClause });
                runClasificacionChartRender(layer, config, whereClause, cycleId, "cache-immediate");
                return;
            }

            markClasificacionPerf("aux-scheduled", cycleId, {
                delayMs,
                where: whereClause
            });

            clasificacionChartTimer = setTimeout(() => {
                clasificacionChartTimer = null;
                runClasificacionChartRender(layer, config, whereClause, cycleId, "scheduled");
            }, delayMs);
        }

        function cancelClasificacionLegendFilter() {
            if (clasificacionLegendFilterTimer) {
                clearTimeout(clasificacionLegendFilterTimer);
                clasificacionLegendFilterTimer = null;
            }
            clasificacionLegendFilterSeq++;
        }

        function getClasificacionLegendFilter(state) {
            const field = state?.field || ORDENAMIENTO_CONFIG.CLASIFICACION_SUELO.typeField || "Tipo_Clasificacion_Suelo";
            const baseWhere = state?.baseWhere && String(state.baseWhere).trim()
                ? String(state.baseWhere).trim()
                : "1=1";
            const allCodes = Array.from(state?.allCodes || [])
                .map(code => String(code).trim())
                .filter(Boolean)
                .sort();
            const activeCodes = Array.from(state?.activeCodes || [])
                .map(code => String(code).trim())
                .filter(Boolean)
                .sort();
            const signature = [
                baseWhere,
                field,
                allCodes.join(","),
                activeCodes.join(",")
            ].join("|");

            const cachedWhere = clasificacionLegendWhereCache.get(signature);
            if (cachedWhere) {
                return {
                    where: cachedWhere,
                    signature,
                    activeCount: activeCodes.length,
                    allCount: allCodes.length,
                    cacheHit: true
                };
            }

            let where = baseWhere;

            if (!activeCodes.length) {
                where = "1=0";
            } else if (allCodes.length && activeCodes.length < allCodes.length) {
                const values = activeCodes
                    .map(code => Number(code))
                    .filter(value => Number.isFinite(value));
                where = values.length
                    ? `(${baseWhere}) AND (${field} IN (${values.join(",")}))`
                    : "1=0";
            }

            clasificacionLegendWhereCache.set(signature, where);
            while (clasificacionLegendWhereCache.size > 40) {
                clasificacionLegendWhereCache.delete(clasificacionLegendWhereCache.keys().next().value);
            }

            return {
                where,
                signature,
                activeCount: activeCodes.length,
                allCount: allCodes.length,
                cacheHit: false
            };
        }

        function syncClasificacionLegendDomState(state) {
            const content = document.getElementById("legendContent");
            if (!content || !state?.activeCodes) return;

            content.querySelectorAll(".legend-item").forEach(node => {
                const code = String(node.dataset.code || "");
                const isActive = state.activeCodes.has(code);
                node.classList.toggle("active", isActive);
                node.classList.toggle("off", !isActive);
                node.setAttribute("aria-pressed", isActive ? "true" : "false");
                node.style.opacity = isActive ? "1" : "0.35";
            });
        }

        function scheduleClasificacionLegendMapFilter(state, options = {}) {
            if (!state?.isClasificacionSuelo || !(state.activeCodes instanceof Set)) return;

            const startedAt = Number(options.startedAt || markClasificacionPerf("legend-toggle-start").t);
            const delayMs = Number(options.delayMs ?? CLASIFICACION_LEGEND_TOGGLE_DELAY_MS);
            const compiled = getClasificacionLegendFilter(state);

            syncClasificacionLegendDomState(state);

            if (compiled.signature === clasificacionLegendLastSignature && !clasificacionLegendFilterTimer) {
                markClasificacionPerf("legend-toggle-noop", renderCycleId, {
                    active: compiled.activeCount,
                    all: compiled.allCount,
                    cacheHit: compiled.cacheHit
                });
                return;
            }

            if (clasificacionLegendFilterTimer) {
                clearTimeout(clasificacionLegendFilterTimer);
            }

            const seq = ++clasificacionLegendFilterSeq;
            markClasificacionPerf("legend-toggle-queued", renderCycleId, {
                delayMs,
                active: compiled.activeCount,
                all: compiled.allCount,
                cacheHit: compiled.cacheHit
            });

            clasificacionLegendFilterTimer = setTimeout(() => {
                clasificacionLegendFilterTimer = null;

                const content = document.getElementById("legendContent");
                if (
                    seq !== clasificacionLegendFilterSeq ||
                    (content?.__clasificacionLegendState !== state && window.__legendState !== state)
                ) {
                    markClasificacionPerf("legend-toggle-skipped-stale", renderCycleId);
                    return;
                }

                const latest = getClasificacionLegendFilter(state);
                if (latest.signature === clasificacionLegendLastSignature) {
                    markClasificacionPerf("legend-toggle-noop", renderCycleId, {
                        active: latest.activeCount,
                        all: latest.allCount,
                        cacheHit: latest.cacheHit
                    });
                    return;
                }

                const categoryItems = Array.from(state.allCodes || []).map(code => ({ code }));
                const baseWhere = state.baseWhere || clasificacionBaseWhere;
                const hasLocalLayers = hasClasificacionCategoryLayerSet(baseWhere, categoryItems);
                let usedLocalToggle = false;

                // Camino confiable: si ya existen las capas por categoría (prewarm),
                // se alternan por visibilidad (instantáneo, sin consultas). Si no, se
                // aplica el filtro compilado al sublayer existente del mapa (filtro en
                // el servidor, SIN recrear la capa). Cualquiera de los dos garantiza
                // que el mapa muestre únicamente las categorías activas.
                if (hasLocalLayers) {
                    ensureClasificacionCategoryLayers(baseWhere, categoryItems, {
                        prewarm: false,
                        source: "legend-toggle"
                    });
                    usedLocalToggle = applyClasificacionCategoryVisibility(state, { startedAt });
                }

                if (!usedLocalToggle) {
                    parkClasificacionCategoryLayers("legend-toggle-direct");
                    applyClasificacionVisualWhere(latest.where, {
                        updateFeatureLayer: false,
                        updateCategoryLayers: false,
                        source: "legend-toggle-direct"
                    });
                    scheduleClasificacionCategoryPrewarm(baseWhere, categoryItems, renderCycleId, municipioActual ? 650 : 1600);
                }
                clasificacionLegendLastSignature = latest.signature;

                const finishedAt = typeof performance !== "undefined" && typeof performance.now === "function"
                    ? performance.now()
                    : Date.now();
                markClasificacionPerf("legend-toggle-applied", renderCycleId, {
                    active: latest.activeCount,
                    all: latest.allCount,
                    cacheHit: latest.cacheHit,
                    local: usedLocalToggle,
                    elapsedMs: Math.round(finishedAt - startedAt)
                });
            }, delayMs);
        }

        function getClasificacionMapServerLayerUrl(config = ORDENAMIENTO_CONFIG.CLASIFICACION_SUELO) {
            if (config?.mapServerUrl && config.mapServerLayerId !== undefined) {
                return `${String(config.mapServerUrl).replace(/\/+$/, "")}/${config.mapServerLayerId}`;
            }
            return config?.url || layerGlobal?.url || "";
        }

        function getClasificacionLegendState() {
            const content = document.getElementById("legendContent");
            let state = content?.__clasificacionLegendState || window.__legendState;
            const items = window.__cs_items || [];

            if (!state?.isClasificacionSuelo && items.length) {
                const config = ORDENAMIENTO_CONFIG.CLASIFICACION_SUELO;
                state = {
                    activeCodes: new Set(items.map(item => String(item.code))),
                    allCodes: items.map(item => String(item.code)),
                    field: config.typeField || "Tipo_Clasificacion_Suelo",
                    layer: layerGlobal || window.activeFeatureLayer,
                    baseWhere: clasificacionBaseWhere || layerGlobal?.definitionExpression || "1=1",
                    fieldType: "integer",
                    isClasificacionSuelo: true
                };
                window.__legendState = state;
                if (content) content.__clasificacionLegendState = state;
            }

            return state?.isClasificacionSuelo ? state : null;
        }

        function syncClasificacionChartWithLegend(state = getClasificacionLegendState(), selectedCode = null) {
            const dataset = chartInstance?.data?.datasets?.[0];
            if (!dataset || !Array.isArray(dataset.codes) || !state?.activeCodes) return;

            const codes = dataset.codes.map(code => String(code));
            const safeSelected = selectedCode !== null && selectedCode !== undefined
                ? String(selectedCode)
                : null;

            // Mostrar/ocultar segmentos del gráfico según las categorías activas.
            // Las categorías desactivadas desaparecen del gráfico (no solo se atenúan).
            if (
                typeof chartInstance.getDataVisibility === "function" &&
                typeof chartInstance.toggleDataVisibility === "function"
            ) {
                codes.forEach((code, i) => {
                    const shouldBeVisible = state.activeCodes.has(code);
                    const isVisible = chartInstance.getDataVisibility(i);
                    if (shouldBeVisible !== isVisible) {
                        chartInstance.toggleDataVisibility(i);
                    }
                });
            }

            // Colores normales para Clasificacion del suelo; la seleccion es funcional,
            // pero este grafico no debe mostrar borde/offset de seleccion.
            dataset.backgroundColor = codes.map(code => {
                const paletteInfo = CLASIFICACION_SUELO_PALETTE[code] || {};
                return String(paletteInfo.fillColor || "#999");
            });
            dataset.borderColor = codes.map(code => {
                const paletteInfo = CLASIFICACION_SUELO_PALETTE[code] || {};
                return String(paletteInfo.outlineColor || "rgba(0,0,0,0)");
            });
            dataset.borderWidth = codes.map(code => {
                const paletteInfo = CLASIFICACION_SUELO_PALETTE[code] || {};
                return Number(paletteInfo.outlineWidth || 1);
            });
            dataset.offset = codes.map(() => 0);
            dataset.hoverOffset = 0;
            chartInstance.update?.("none");
        }

        function applyClasificacionSingleSelection(code, options = {}) {
            const safeCode = String(code ?? "").trim();
            const state = getClasificacionLegendState();
            if (!safeCode || !state?.allCodes?.map(String).includes(safeCode)) return null;

            state.activeCodes = new Set([safeCode]);
            syncClasificacionLegendDomState(state);
            syncClasificacionChartWithLegend(state, safeCode);

            if (options.applyMap !== false) {
                applyClasificacionLegendFilter(state, {
                    delayMs: 0,
                    startedAt: markClasificacionPerf("selection-sync-start", renderCycleId, { code: safeCode }).t
                });
            }

            if (options.updateSummary !== false) {
                actualizarResumenClasificacionSuelo(
                    ORDENAMIENTO_CONFIG.CLASIFICACION_SUELO,
                    safeCode,
                    renderCycleId
                ).catch(() => { });
            }

            return state;
        }

        // Restaura TODAS las categorías: vuelven al mapa, al gráfico y a la leyenda,
        // eliminando cualquier filtro/selección previa.
        function restaurarClasificacionLegendCompleto() {
            const state = getClasificacionLegendState();
            if (!state?.allCodes || !state.allCodes.length) return null;

            const allActive = new Set(state.allCodes.map(code => String(code)));
            if (state.activeCodes && state.activeCodes.size === allActive.size) {
                let alreadyFull = true;
                for (const code of allActive) {
                    if (!state.activeCodes.has(code)) { alreadyFull = false; break; }
                }
                if (alreadyFull) return state;
            }

            state.activeCodes = allActive;
            syncClasificacionLegendDomState(state);
            syncClasificacionChartWithLegend(state, null);
            applyClasificacionLegendFilter(state, {
                delayMs: 0,
                startedAt: markClasificacionPerf("legend-restore-start", renderCycleId, {
                    all: allActive.size
                }).t
            });
            return state;
        }

        async function obtenerCodigoClasificacionDesdeMapa(event) {
            if (
                currentMainModule !== "ORDENAMIENTO" ||
                currentOrdenamientoTab !== "CLASIFICACION_SUELO" ||
                !view ||
                (event?.button != null && event.button !== 0)
            ) {
                return null;
            }

            const config = ORDENAMIENTO_CONFIG.CLASIFICACION_SUELO;
            const typeField = config.typeField || "Tipo_Clasificacion_Suelo";
            const mapPoint = event.mapPoint || (
                event?.x != null && event?.y != null
                    ? view.toMap({ x: event.x, y: event.y })
                    : null
            );
            if (!mapPoint) return null;

            const sourceUrl = getClasificacionMapServerLayerUrl(config);
            if (!sourceUrl) return null;

            try {
                const queryLayer = new FeatureLayer({
                    url: sourceUrl,
                    outFields: [typeField]
                });
                const query = queryLayer.createQuery();
                query.geometry = mapPoint;
                query.distance = Math.max(Number(view.resolution || 0) * 24, 120);
                query.units = "meters";
                query.spatialRelationship = "intersects";
                const legendState = getClasificacionLegendState();
                const legendWhere = legendState ? getClasificacionLegendFilter(legendState).where : "";
                query.where = clasificacionVisualWhereApplied || legendWhere || clasificacionBaseWhere || "1=1";
                query.returnGeometry = false;
                query.outFields = [typeField];
                query.num = 1;

                const result = await queryLayer.queryFeatures(query);
                const attrs = result?.features?.[0]?.attributes;
                const value = attrs?.[typeField];
                return value === null || value === undefined || String(value).trim() === "" ? null : String(value).trim();
            } catch (e) {
                console.warn("Clasificación del suelo: no se pudo identificar categoría desde MapServer:", e);
                return null;
            }
        }

        async function manejarClickMapaClasificacionSuelo(event) {
            const code = await obtenerCodigoClasificacionDesdeMapa(event);
            console.log("[Clasificación] clic en mapa -> código:", code);
            if (!code) return;
            applyClasificacionSingleSelection(code, { applyMap: true });
        }


        function buildWhereOrdenamientoForCurrentTerritory(config = ORDENAMIENTO_CONFIG[currentOrdenamientoTab]) {
            if (!config) return "1=1";

            let whereOrdenamiento = "1=1";
            const filterField = config.filterField || "mpcodigo";
            const selectedMunicipio = normalizeCode(document.getElementById("municipios")?.value || "");
            const selectedDepto = normalizeCode(document.getElementById("departamentos")?.value || "");
            const effectiveMunicipio = normalizeCode(municipioActual || selectedMunicipio);
            const effectiveDepto = normalizeCode(
                deptoActual ||
                (effectiveMunicipio ? effectiveMunicipio.substring(0, 2) : "") ||
                selectedDepto
            );
            const hasDeptoSelection =
                effectiveDepto &&
                effectiveDepto !== "0" &&
                effectiveDepto !== "COL";

            if (effectiveMunicipio) {
                whereOrdenamiento = sqlEquals(filterField, effectiveMunicipio);
            } else if ((filtroNivel === "DEPTO" || hasDeptoSelection) && hasDeptoSelection) {
                if (
                    config.ordenamientoType === "vigencia" &&
                    String(filterField).toLowerCase() === "mdanmcodig"
                ) {
                    whereOrdenamiento = sqlStartsWith(filterField, effectiveDepto);
                } else if (config.deptoFilterField) {
                    whereOrdenamiento = sqlEquals(config.deptoFilterField, effectiveDepto);
                } else if (
                    getOrdenamientoDeptoPrefixFields().has(filterField.toLowerCase())
                ) {
                    whereOrdenamiento = sqlStartsWith(filterField, effectiveDepto);
                }
            }

            return whereOrdenamiento;
        }

        function buildVigenciaDepartmentWhere(config = ORDENAMIENTO_CONFIG.VIGENCIA) {
            const filterField = config?.filterField || "MDANMCodig";
            const deptoCode = deptoActual || (municipioActual ? normalizeCode(municipioActual).substring(0, 2) : "");
            if (!deptoCode || deptoCode === "0" || deptoCode === "COL") return "1=1";

            return sqlStartsWith(filterField, deptoCode);
        }

        function getVigenciaMapDisplayWhere(config, chartWhere) {
            if (config?.ordenamientoType !== "vigencia") return chartWhere || "1=1";
            // El mapa siempre muestra el departamento completo cuando hay un municipio
            // o un departamento seleccionado (salvo Colombia / sin selección, que es
            // contexto nacional). Se calcula directamente desde el estado para no
            // depender de que el "where" del gráfico llegue correcto.
            const hasDeptoContext =
                filtroNivel === "DEPTO" &&
                deptoActual &&
                deptoActual !== "0" &&
                deptoActual !== "COL";
            if (municipioActual || hasDeptoContext) {
                return buildVigenciaDepartmentWhere(config);
            }
            return chartWhere || "1=1";
        }

        function clearVigenciaMunicipioHighlight() {
            vigenciaHighlightedMunicipio = null;
            if (vigenciaMunicipioHighlightHandle) {
                try { vigenciaMunicipioHighlightHandle.remove(); } catch (_) {}
                vigenciaMunicipioHighlightHandle = null;
            }
            if (vigenciaMunicipioHighlightLayer?.graphics) {
                try { vigenciaMunicipioHighlightLayer.graphics.removeAll(); } catch (_) {}
            }
        }

        // Mantiene la capa de resaltado del municipio siempre por encima de las
        // demás capas, para que el borde amarillo no quede tapado cuando la capa
        // de Vigencia termina de dibujarse o se agregan otras capas.
        function bringVigenciaHighlightToFront() {
            return;
        }

        async function highlightVigenciaMunicipio(municipioCode = municipioActual) {
            return highlightVigenciaMunicipioDesdeCapaActiva(municipioCode);
            const code = String(municipioCode || "").trim();
            if (!code || !map || !view) {
                clearVigenciaMunicipioHighlight();
                return;
            }

            try {
                if (!vigenciaMunicipioHighlightLayer) {
                    vigenciaMunicipioHighlightLayer = new GraphicsLayer({
                        title: "Municipio seleccionado Vigencia",
                        listMode: "hide"
                    });
                    map.add(vigenciaMunicipioHighlightLayer);
                } else if (!map.layers.find(layer => layer === vigenciaMunicipioHighlightLayer)) {
                    map.add(vigenciaMunicipioHighlightLayer);
                }

                // Si el municipio ya está resaltado y su gráfico sigue presente, no
                // se vuelve a consultar (evita parpadeo); solo se asegura que quede
                // por encima de las capas recién dibujadas.
                const vigenciaLayer = layerGlobal;
                const filterField = ORDENAMIENTO_CONFIG.VIGENCIA?.filterField || "MDANMCodig";
                if (!vigenciaLayer || vigenciaLayer.destroyed || currentOrdenamientoTab !== "VIGENCIA") {
                    clearVigenciaMunicipioHighlight();
                    return;
                }

                const query = typeof vigenciaLayer.createQuery === "function"
                    ? vigenciaLayer.createQuery()
                    : {};
                query.where = sqlEquals(filterField, code);
                query.outFields = [filterField];
                query.returnGeometry = true;
                query.num = 500;

                const result = await vigenciaLayer.queryFeatures(query);
                // Si mientras se consultaba cambió la selección, no pisar el estado nuevo.
                if (
                    String(municipioActual || "").trim() !== code ||
                    layerGlobal !== vigenciaLayer ||
                    currentOrdenamientoTab !== "VIGENCIA"
                ) return;

                const geometries = (result?.features || [])
                    .map(feature => feature.geometry)
                    .filter(Boolean);
                if (!geometries.length) {
                    clearVigenciaMunicipioHighlight();
                    return;
                }

                vigenciaMunicipioHighlightLayer.graphics.removeAll();
                geometries.forEach(geometry => {
                    vigenciaMunicipioHighlightLayer.graphics.add(new Graphic({
                        geometry,
                        symbol: {
                            type: "simple-fill",
                            color: [255, 255, 0, 0.03],
                            outline: {
                                color: [255, 220, 0, 1],
                                width: 3
                            }
                        }
                    }));
                });
                vigenciaHighlightedMunicipio = code;
                bringVigenciaHighlightToFront();
            } catch (e) {
                console.warn("Vigencia: no se pudo resaltar el municipio seleccionado.", e);
            }
        }

        async function highlightVigenciaMunicipioDesdeCapaActiva(municipioCode = municipioActual) {
            const code = String(municipioCode || "").trim();
            if (!code || !view) {
                clearVigenciaMunicipioHighlight();
                return;
            }

            try {
                const vigenciaLayer = layerGlobal;
                const filterField = ORDENAMIENTO_CONFIG.VIGENCIA?.filterField || "MDANMCodig";
                if (!vigenciaLayer || vigenciaLayer.destroyed || currentOrdenamientoTab !== "VIGENCIA") {
                    clearVigenciaMunicipioHighlight();
                    return;
                }

                const objectIds = await vigenciaLayer.queryObjectIds({
                    where: sqlEquals(filterField, code)
                });
                if (
                    String(municipioActual || "").trim() !== code ||
                    layerGlobal !== vigenciaLayer ||
                    currentOrdenamientoTab !== "VIGENCIA"
                ) return;

                if (!Array.isArray(objectIds) || !objectIds.length) {
                    clearVigenciaMunicipioHighlight();
                    return;
                }

                if (vigenciaMunicipioHighlightHandle) {
                    try { vigenciaMunicipioHighlightHandle.remove(); } catch (_) {}
                    vigenciaMunicipioHighlightHandle = null;
                }
                if (view?.highlightOptions) {
                    view.highlightOptions = {
                        color: [126, 63, 242, 1],
                        haloOpacity: 1,
                        fillOpacity: 0.03
                    };
                }

                const layerView = await view.whenLayerView(vigenciaLayer);
                if (
                    String(municipioActual || "").trim() !== code ||
                    layerGlobal !== vigenciaLayer ||
                    currentOrdenamientoTab !== "VIGENCIA"
                ) return;

                vigenciaMunicipioHighlightHandle = layerView.highlight(objectIds);
                vigenciaHighlightedMunicipio = code;
            } catch (e) {
                console.warn("Vigencia: no se pudo resaltar el municipio seleccionado desde la capa activa.", e);
            }
        }

        async function manejarClickMapaVigencia(event) {
            if (
                currentMainModule !== "ORDENAMIENTO" ||
                currentOrdenamientoTab !== "VIGENCIA" ||
                !view ||
                !layerGlobal ||
                layerGlobal.destroyed ||
                (event?.button != null && event.button !== 0)
            ) {
                return;
            }

            try {
                const hit = await view.hitTest(event, { include: layerGlobal });
                const feature = hit?.results?.find(result => result?.graphic?.layer === layerGlobal)?.graphic;
                const code = String(feature?.attributes?.MDANMCodig ?? feature?.attributes?.mdanmcodig ?? "").trim();
                if (!code) return;

                municipioActual = code;
                deptoActual = normalizeCode(code).substring(0, 2);
                filtroNivel = "MUNI";

                const selectDepto = document.getElementById("departamentos");
                const selectMuni = document.getElementById("municipios");
                if (selectDepto) selectDepto.value = deptoActual;
                renderizarMunicipios(deptoActual);
                if (selectMuni) selectMuni.value = code;

                renderControls();
                await highlightVigenciaMunicipioDesdeCapaActiva(code);
                scheduleOrdenamientoRender();
            } catch (e) {
                console.warn("Vigencia: no se pudo seleccionar municipio desde el mapa.", e);
            }
        }

        async function zoomToInitialQueryExtent(whereOrdenamiento = buildWhereOrdenamientoForCurrentTerritory()) {
            if (!view) return;

            if (currentOrdenamientoTab === "VIGENCIA") {
                const config = ORDENAMIENTO_CONFIG.VIGENCIA;
                const mapWhere = getVigenciaMapDisplayWhere(config, whereOrdenamiento);
                if (layerGlobal && !layerGlobal.destroyed) {
                    await zoomOrdenamientoLayerToWhere(layerGlobal, mapWhere, renderCycleId, { skipNational: true });
                }
                return;
            }

            if (
                currentOrdenamientoTab === "CLASIFICACION_SUELO" &&
                hasClasificacionTerritoryFilter()
            ) {
                await zoomClasificacionToTerritory(renderCycleId);
                return;
            }

            if (!layerGlobal || layerGlobal.destroyed) {
                if (extentInicial) {
                    await view.goTo(extentInicial, { duration: 900, easing: "ease-in-out" });
                }
                return;
            }

            try {
                const res = await layerGlobal.queryExtent({ where: whereOrdenamiento || "1=1" });
                if (res?.extent) {
                    await view.goTo(res.extent.expand(1.2), {
                        duration: 900,
                        easing: "ease-in-out"
                    });
                } else if (extentInicial) {
                    await view.goTo(extentInicial, { duration: 900, easing: "ease-in-out" });
                }
            } catch (e) {
                console.warn("No se pudo restaurar la extensión inicial de la consulta:", e);
            }
        }

        function reiniciarClasificacionConsultaVisual(whereOrdenamiento) {
            cancelClasificacionLegendFilter();

            const content = document.getElementById("legendContent");
            const state = content?.__clasificacionLegendState || window.__legendState;

            if (state?.allCodes?.length) {
                state.activeCodes = new Set(state.allCodes.map(code => String(code)));
                syncClasificacionLegendDomState(state);
                applyClasificacionLegendFilter(state);
            }

            parkClasificacionCategoryLayers("query-reset");
            applyClasificacionVisualWhere(whereOrdenamiento, {
                updateCategoryLayers: true,
                source: "query-reset"
            });
        }

        function paintZonificacionRuralViewFromItems(layer, config, whereClause, catItems = [], useItems = []) {
            let activeItems = [];
            let chartTitleText = "";
            let legendTitleText = "";

            if (currentRuralChartView === "CATEGORIA") {
                activeItems = catItems;
                chartTitleText = municipioActual
                    ? "Distribución de categorías de zonificación rural"
                    : "Distribución nacional de categorías de zonificación rural";
                legendTitleText = "Categorías rurales";
            } else {
                activeItems = useItems;
                chartTitleText = municipioActual
                    ? "Distribución del uso principal de la zonificación rural"
                    : "Distribución nacional del uso principal de la zonificación rural";
                legendTitleText = "Uso principal rural";
            }

            if (!activeItems.length) {
                actualizarLeyendaOrdenamientoRural(legendTitleText, [], whereClause);
                setOrdenamientoChartNoData();
                return;
            }

            const labels = activeItems.map(x => x.label);
            const values = activeItems.map(x => Number(x.value.toFixed(2)));
            const colors = activeItems.map(x => x.color);

            const titleElement = document.getElementById("chartTitle");
            if (titleElement) {
                titleElement.textContent = buildOrdenamientoChartTitle(chartTitleText);
            }

            const ruralDataset = [{
                label: "%",
                data: values,
                backgroundColor: activeItems.map(x => String(x.color)),
                borderColor: activeItems.map(x => String(x.borderColor)),
                borderWidth: activeItems.map(x => Number(x.borderWidth || 0)),
                codes: activeItems.map(x => String(x.code))
            }];

            actualizarLeyendaOrdenamientoRural(legendTitleText, activeItems, whereClause);
            crearGrafica(labels, values, colors, "doughnut", false, ruralDataset);
            // Actualizar el resumen/textos inmediatamente después de crear el gráfico,
            // para que aunque un paso posterior (leyenda, interacciones) falle, la
            // sección de textos descriptivos no quede nula.
            actualizarResumenOrdenamientoRural(layer, config, whereClause);
            // Los pasos de leyenda/interacción no deben romper el render del gráfico
            // ni la sección de textos si fallan: aislarlos.
            try {
                if (chartInstance) {
                    chartInstance.$zrAllItems = (window.__legendState?.allItems || activeItems)
                        .map(normalizeZonificacionRuralChartItem);
                }
                configureZonificacionRuralChartLegend(chartInstance);
                chartInstance?.update?.("none");
                updateZonificacionRuralChartEmptyMessage(chartInstance, false);
                bindZonificacionRuralCanvasInteractions(activeItems, config);

                // El texto de la leyenda se superpone al gráfico la primera vez porque
                // al crearse el canvas aún no tiene su tamaño final y Chart.js calcula
                // mal el espacio de la leyenda (al desactivar una categoría se corrige
                // porque se vuelve a hacer layout). Forzamos un recálculo de layout en
                // el siguiente frame, cuando el canvas ya tiene su tamaño definitivo.
                const chartRef = chartInstance;
                requestAnimationFrame(() => {
                    if (chartInstance !== chartRef || chartRef?.destroyed) return;
                    try {
                        chartRef.resize();
                        chartRef.update("none");
                    } catch (_) { }
                });
            } catch (paintErr) {
                console.warn("Zonificación rural: error en pasos posteriores al gráfico:", paintErr);
            }
        }

        function bindZonificacionRuralCanvasInteractions(items = [], config = ORDENAMIENTO_CONFIG.ZONIFICACION_RURAL) {
            const canvas = document.getElementById("chart");
            if (!canvas || !Array.isArray(items) || !items.length) return;

            const rect = canvas.getBoundingClientRect();
            const cssWidth = Math.max(1, rect.width || canvas.clientWidth || 300);
            const cssHeight = Math.max(1, rect.height || canvas.clientHeight || 280);
            const total = items.reduce((sum, item) => sum + Number(item.value || 0), 0) || 1;
            const cx = cssWidth * 0.42;
            const cy = cssHeight * 0.50;
            const outerRadius = Math.max(55, Math.min(cssWidth * 0.32, cssHeight * 0.40));
            const innerRadius = outerRadius * 0.48;
            const slices = [];
            let start = -Math.PI / 2;

            items.forEach(item => {
                const value = Number(item.value || 0);
                const angle = (value / total) * Math.PI * 2;
                const end = start + angle;
                slices.push({ start, end, item });
                start = end;
            });

            zonificacionRuralCanvasChartState = {
                items,
                slices,
                cx,
                cy,
                innerRadius,
                outerRadius,
                config
            };
            canvas.__zrItems = items;

            const getItemFromEvent = event => {
                const state = zonificacionRuralCanvasChartState;
                if (!state) return null;

                const bounds = canvas.getBoundingClientRect();
                const x = event.clientX - bounds.left;
                const y = event.clientY - bounds.top;
                const dx = x - state.cx;
                const dy = y - state.cy;
                const radius = Math.sqrt(dx * dx + dy * dy);
                if (radius < state.innerRadius || radius > state.outerRadius) return null;

                let angle = Math.atan2(dy, dx);
                if (angle < -Math.PI / 2) angle += Math.PI * 2;
                return state.slices.find(slice => angle >= slice.start && angle <= slice.end)?.item || null;
            };

            canvas.onclick = async event => {
                if (
                    currentMainModule !== "ORDENAMIENTO" ||
                    currentOrdenamientoTab !== "ZONIFICACION_RURAL"
                ) {
                    return;
                }
                if (event.detail > 1) return;

                const selected = getItemFromEvent(event);
                if (!selected) return;

                const selectedCode = String(selected.code);
                applyZonificacionRuralSingleSelection(selectedCode);
                await selectZonificacionRuralFromCode(selectedCode, {
                    temporaryMs: 2200,
                    highlightMap: true
                });

                if (currentRuralChartView === "CATEGORIA") {
                    await zoomMapaZonificacionRural(null, selectedCode);
                } else {
                    await zoomMapaZonificacionRural(selectedCode, null);
                }
            };

            canvas.ondblclick = event => {
                if (
                    currentMainModule !== "ORDENAMIENTO" ||
                    currentOrdenamientoTab !== "ZONIFICACION_RURAL"
                ) {
                    return;
                }

                if (getItemFromEvent(event)) return;
                setTimeout(() => restoreZonificacionRuralLegendFilter(), 0);
            };
        }

        async function reiniciarConsultaActual() {
            if (currentMainModule !== "ORDENAMIENTO") return;

            const config = ORDENAMIENTO_CONFIG[currentOrdenamientoTab];
            if (!config || !layerGlobal || layerGlobal.destroyed || !view) return;

            const whereOrdenamiento = buildWhereOrdenamientoForCurrentTerritory(config);

            clearHighlight();
            lastHoverWhere = "";
            legendFilterLabel = null;
            if (view.popup) {
                try { view.popup.close(); } catch (_) { }
            }

            if (areasActividadSelectionTimer) {
                clearTimeout(areasActividadSelectionTimer);
                areasActividadSelectionTimer = null;
            }
            areasActividadSelectionToken++;

            try {
                if (currentOrdenamientoTab === "VIGENCIA") {
                    layerGlobal.definitionExpression = getVigenciaMapDisplayWhere(config, whereOrdenamiento);
                    if (municipioActual) {
                        await highlightVigenciaMunicipioDesdeCapaActiva(municipioActual);
                    } else {
                        clearVigenciaMunicipioHighlight();
                    }
                    await renderVigenciaCharts(layerGlobal, config, whereOrdenamiento);
                } else if (currentOrdenamientoTab === "AREAS_ACTIVIDAD") {
                    window.__aa_selected_code = null;
                    await restaurarAreasActividadLegend();

                    const titleElement = document.getElementById("chartTitle");
                    if (titleElement) {
                        titleElement.textContent = buildOrdenamientoChartTitle("Distribución de áreas de actividad");
                    }
                } else if (currentOrdenamientoTab === "CLASIFICACION_SUELO") {
                    reiniciarClasificacionConsultaVisual(whereOrdenamiento);
                    clasificacionBaseWhere = whereOrdenamiento;
                    if (layerGlobal && !layerGlobal.destroyed) {
                        layerGlobal.definitionExpression = whereOrdenamiento;
                    }
                    await renderClasificacionSueloCharts(layerGlobal, config, whereOrdenamiento, renderCycleId);
                } else if (currentOrdenamientoTab === "ZONIFICACION_RURAL") {
                    const catItems = window.__zr_categoria_items || [];
                    const useItems = window.__zr_uso_items || [];
                    const activeItems = currentRuralChartView === "CATEGORIA" ? catItems : useItems;

                    if (window.__legendState && activeItems.length) {
                        window.__legendState.activeCodes = new Set(activeItems.map(item => String(item.code)));
                        window.__legendState.baseWhere = whereOrdenamiento;
                        resetLegendVisualState();
                        applyLegendFilter();
                    }

                    layerGlobal.definitionExpression = whereOrdenamiento;
                    paintZonificacionRuralViewFromItems(layerGlobal, config, whereOrdenamiento, catItems, useItems);
                } else {
                    layerGlobal.definitionExpression = whereOrdenamiento;
                }

                await zoomToInitialQueryExtent(whereOrdenamiento);
            } catch (e) {
                console.warn("No se pudo reiniciar la consulta actual:", e);
            }
        }

        async function cargarOrdenamientoActual() {
            const config = ORDENAMIENTO_CONFIG[currentOrdenamientoTab];
            if (!config) return;

            const whereOrdenamiento = buildWhereOrdenamientoForCurrentTerritory(config);
            const isClasificacionSuelo = config.ordenamientoType === "clasificacion_suelo";
            const isVigencia = config.ordenamientoType === "vigencia";
            if (isVigencia) {
                removeClasificacionVisualLayers();
            } else if (isClasificacionSuelo) {
                removeVigenciaVisualLayers();
            } else {
                removeVigenciaVisualLayers();
                removeClasificacionVisualLayers();
            }
            if (!isClasificacionSuelo) {
                cancelClasificacionAuxiliaryLoad();
                cancelClasificacionCategoryPrewarm();
                cancelClasificacionDepartmentWarmup();
                resetClasificacionCategoryVisuals();
            }

            const configUrl = String(config.url || "").replace(/\/+$/, "");
            const visualUrl = String(config.mapServerUrl || "").replace(/\/+$/, "");
            const canReuseClasificacionLayer =
                isClasificacionSuelo &&
                layerGlobal &&
                !layerGlobal.destroyed &&
                String(layerGlobal.url || "").replace(/\/+$/, "") === configUrl &&
                clasificacionVisualLayer &&
                !clasificacionVisualLayer.destroyed &&
                String(clasificacionVisualLayer.url || "").replace(/\/+$/, "") === visualUrl;
            const canReuseVigenciaLayer =
                isVigencia &&
                layerGlobal &&
                !layerGlobal.destroyed &&
                String(layerGlobal.url || "").replace(/\/+$/, "") === configUrl;
            const canReuseDataLayer = canReuseClasificacionLayer || canReuseVigenciaLayer;

            if (!canReuseDataLayer) {
                clearLayers();
                resetClasificacionCategoryVisuals();
                if (isClasificacionSuelo) {
                    removeClasificacionVisualLayers();
                    clasificacionVisualLayer = null;
                    clasificacionVisualWhereApplied = null;
                    clasificacionVisualVisibleApplied = null;
                    resetClasificacionCategoryVisuals();
                }
            }

            const currentCycle = ++renderCycleId;
            const vigenciaMapWhere = isVigencia
                ? getVigenciaMapDisplayWhere(config, whereOrdenamiento)
                : whereOrdenamiento;
            if (
                isVigencia ||
                config.ordenamientoType === "zonificacion_rural" ||
                config.ordenamientoType === "areas_actividad" ||
                isClasificacionSuelo
            ) {
                setOrdenamientoChartLoading();
            }
            if (isClasificacionSuelo) {
                cancelClasificacionAuxiliaryLoad();
                cancelClasificacionCategoryPrewarm();
                cancelClasificacionDepartmentWarmup();
                // Si el territorio consultado cambió (p.ej. Cundinamarca → Boyacá, o
                // departamento → municipio), eliminar por completo las capas por
                // categoría del territorio anterior para que NO queden residuos en el
                // mapa. Antes solo se ocultaban (park), lo que podía dejar geometrías
                // del territorio previo.
                const clasificacionTerritoryChanged = clasificacionBaseWhere !== whereOrdenamiento;
                if (canReuseClasificacionLayer && clasificacionTerritoryChanged) {
                    blankClasificacionVisualLayerForNewQuery("render-territory-change");
                    resetClasificacionCategoryVisuals();
                    const legendContent = document.getElementById("legendContent");
                    if (legendContent) {
                        legendContent.__clasificacionLegendState = null;
                    }
                    if (window.__legendState?.isClasificacionSuelo) {
                        window.__legendState = {
                            allCodes: [],
                            activeCodes: new Set(),
                            field: null,
                            layer: null,
                            baseWhere: whereOrdenamiento,
                            isClasificacionSuelo: true
                        };
                    }
                }
                parkClasificacionCategoryLayers("render-start");
                clasificacionBaseWhere = whereOrdenamiento;
                markClasificacionPerf("render-start", currentCycle, {
                    reused: canReuseClasificacionLayer,
                    where: whereOrdenamiento
                });
            }

            const newLayer = canReuseDataLayer
                ? layerGlobal
                : new FeatureLayer({
                    url: config.url,
                    definitionExpression: isClasificacionSuelo
                        ? whereOrdenamiento
                        : vigenciaMapWhere,
                    outFields: config.outFields || ["*"],
                    opacity: 0.85,
                    minScale: isClasificacionSuelo ? 0 : undefined,
                    maxScale: isClasificacionSuelo ? 0 : undefined,
                    listMode: isClasificacionSuelo ? "hide" : undefined,
                    popupEnabled: !isClasificacionSuelo,
                    visible: !isClasificacionSuelo
                });
            const vigenciaMapWhereChanged = isVigencia && (
                !canReuseVigenciaLayer ||
                String(newLayer.__vigenciaMapWhere || "") !== String(vigenciaMapWhere)
            );

            if (isClasificacionSuelo && !canReuseClasificacionLayer) {
                const visualWhere = hasClasificacionTerritoryFilter()
                    ? "1=0"
                    : getClasificacionVisualWhere(whereOrdenamiento);
                const canRenderVisual = visualWhere !== "1=0";

                clasificacionVisualLayer = new MapImageLayer({
                    url: config.mapServerUrl,
                    title: config.title,
                    opacity: 0.92,
                    visible: canRenderVisual,
                    sublayers: [{
                        id: config.mapServerLayerId ?? 1,
                        visible: canRenderVisual,
                        minScale: 0,
                        maxScale: 0,
                        definitionExpression: visualWhere,
                        renderer: buildClasificacionSueloRenderer(config)
                    }]
                });

                map.add(clasificacionVisualLayer);
                layersGlobal = [clasificacionVisualLayer];
                syncClasificacionManagedLayers();
                markClasificacionPerf("visual-layer-created", currentCycle, {
                    visible: canRenderVisual
                });
            } else if (isClasificacionSuelo) {
                markClasificacionPerf("visual-layer-reused", currentCycle);
            }

            newLayer.opacity = 0.85;
            if (isClasificacionSuelo) {
                newLayer.renderer = buildClasificacionSueloRenderer(config);
                newLayer.visible = false;
            } else {
                if (newLayer.definitionExpression !== vigenciaMapWhere) {
                    newLayer.definitionExpression = vigenciaMapWhere;
                }
                if (isVigencia) {
                    newLayer.__vigenciaMapWhere = vigenciaMapWhere;
                }
                newLayer.visible = true;
            }

            if (config.ordenamientoType === "areas_actividad") {
                applyAreasActividadPaletteRenderer(newLayer, config);
            }

            if (!canReuseDataLayer) {
                map.add(newLayer);
            }
            if (isClasificacionSuelo) {
                newLayer.when(() => {
                    if (currentCycle !== renderCycleId || layerGlobal !== newLayer || newLayer.destroyed) return;
                    newLayer.minScale = 0;
                    newLayer.maxScale = 0;
                    applyClasificacionVisualWhere(whereOrdenamiento, {
                        updateCategoryLayers: false,
                        source: "feature-layer-ready"
                    });
                }).catch(() => { });
            }
            // Áreas de actividad: eliminar capas residuales (departamento/municipio
            // anterior) para que NO coexistan con la consulta actual. Se reafirma al
            // terminar de cargar la capa por si una capa previa lenta cargó tarde.
            if (config.ordenamientoType === "areas_actividad") {
                removeStrayOrdenamientoDataLayers(newLayer);
                newLayer.when(() => {
                    if (currentCycle !== renderCycleId || layerGlobal !== newLayer || newLayer.destroyed) return;
                    removeStrayOrdenamientoDataLayers(newLayer);
                }).catch(() => {});
            }
            // Zonificación Rural: garantizar una sola capa del servicio en el mapa
            // (elimina cualquier capa residual que dejara visible todo el país) y
            // reafirmar el filtro territorial una vez la capa termine de cargar, por
            // si el definitionExpression no quedó aplicado antes del load.
            if (config.ordenamientoType === "zonificacion_rural") {
                removeStrayRuralLayers(newLayer);
                newLayer.when(() => {
                    if (currentCycle !== renderCycleId || layerGlobal !== newLayer || newLayer.destroyed) return;
                    removeStrayRuralLayers(newLayer);
                    if (newLayer.definitionExpression !== whereOrdenamiento) {
                        newLayer.definitionExpression = whereOrdenamiento;
                    }
                    if (window.__RURAL_DEBUG) {
                        try {
                            const snap = (map.layers?.toArray?.() || []).map(l => ({
                                title: l.title,
                                type: l.type,
                                url: l.url,
                                def: l.definitionExpression,
                                visible: l.visible
                            }));
                            console.log("[RURAL] where=", whereOrdenamiento, "newLayer.def=", newLayer.definitionExpression, "layers=", snap);
                        } catch (_) { }
                    }
                }).catch(() => {});
            }
            layerGlobal = newLayer;
            window.activeFeatureLayer = newLayer;
            window.activeVisualLayer = isClasificacionSuelo
                ? clasificacionVisualLayer
                : newLayer;
            syncStateFromGlobals();
            if (isClasificacionSuelo) {
                if (hasClasificacionTerritoryFilter()) {
                    // La leyenda permanece vacía hasta confirmar que hay elementos en el
                    // mapa; solo se muestra "Cargando gráfico..." mientras responde el servicio.
                    actualizarLeyendaClasificacionSuelo("Clasificación del suelo", []);
                    setOrdenamientoChartLoading();
                } else {
                    actualizarLeyendaClasificacionSuelo("Clasificación del suelo", []);
                    setOrdenamientoInitialChartState();
                }
                if (hasClasificacionTerritoryFilter()) {
                    const territorySource = municipioActual ? "municipality" : "department";
                    applyClasificacionVisualWhere("1=0", {
                        updateFeatureLayer: false,
                        updateCategoryLayers: false,
                        source: `render-before-${territorySource}-zoom`
                    });
                    try {
                        await withTimeout(zoomClasificacionToTerritory(currentCycle), 5000, false);
                    } catch (e) {
                        if (String(e?.name || "") !== "AbortError") {
                            console.warn("No se pudo hacer zoom a Clasificacion del suelo:", e);
                        }
                    }
                    if (currentCycle !== renderCycleId || layerGlobal !== newLayer || newLayer.destroyed) return;
                    applyClasificacionVisualWhere(whereOrdenamiento, {
                        updateCategoryLayers: false,
                        forceRefresh: true,
                        source: `render-after-${territorySource}-zoom`
                    });
                    nudgeClasificacionVisualPaint(currentCycle, `${territorySource}-after-zoom`);
                    reapplyClasificacionVisualWhenReady(whereOrdenamiento, currentCycle, `${territorySource}-layer-ready`);
                } else {
                    applyClasificacionVisualWhere(whereOrdenamiento, {
                        updateCategoryLayers: false,
                        forceRefresh: true,
                        source: "render"
                    });
                    reapplyClasificacionVisualWhenReady(whereOrdenamiento, currentCycle, "territory-layer-ready");
                    withTimeout(zoomClasificacionToTerritory(currentCycle), 5000, false)
                        .then(() => {
                            nudgeClasificacionVisualPaint(currentCycle, "territory-after-zoom");
                        })
                        .catch(e => {
                            if (String(e?.name || "") !== "AbortError") {
                                console.warn("No se pudo hacer zoom a Clasificacion del suelo:", e);
                            }
                        });
                }

                scheduleClasificacionAuxiliaryLoad(newLayer, config, whereOrdenamiento, currentCycle);
                scheduleClasificacionDepartmentWarmup(deptoActual, {
                    cycleId: currentCycle,
                    priorityMunicipio: municipioActual,
                    delayMs: municipioActual
                        ? CLASIFICACION_MUNI_WARMUP_DELAY_MS
                        : CLASIFICACION_DEPT_WARMUP_DELAY_MS
                });
            }

            setLegendLayer(newLayer, config.title);
            updateMapViewBadge(config.title);
            const legendContent = document.getElementById("legendContent");
            if (legendContent && !isClasificacionSuelo) {
                legendContent.innerHTML = "";
            }
            window.__lastLegendRenderKey = "";
            legendFilterLabel = null;

            if (config.ordenamientoType === "vigencia") {
                // Defensa: garantizar una sola capa de Vigencia en el mapa. Elimina
                // cualquier capa residual del servicio (p.ej. la capa nacional inicial)
                // que pudiera quedar de fondo mostrando todo el país.
                removeVigenciaVisualLayers(newLayer);
                // Reafirmar el filtro departamental/municipal una vez la capa cargue,
                // por si el definitionExpression no quedó aplicado antes del load.
                newLayer.when(() => {
                    if (currentCycle !== renderCycleId || layerGlobal !== newLayer || newLayer.destroyed) return;
                    if (newLayer.definitionExpression !== vigenciaMapWhere) {
                        newLayer.definitionExpression = vigenciaMapWhere;
                    }
                    // La capa de Vigencia ya está dibujada: asegurar que el resaltado
                    // amarillo del municipio quede por encima y permanezca visible.
                    if (municipioActual) {
                        bringVigenciaHighlightToFront();
                    }
                }).catch(() => {});
                actualizarLeyendaVigencia("Vigencia", [], newLayer, config, whereOrdenamiento);
                requestAnimationFrame(async () => {
                    if (currentCycle !== renderCycleId || layerGlobal !== newLayer || newLayer.destroyed) return;
                    await renderVigenciaCharts(newLayer, config, whereOrdenamiento);
                });
                if (municipioActual) {
                    highlightVigenciaMunicipioDesdeCapaActiva(municipioActual);
                } else {
                    clearVigenciaMunicipioHighlight();
                }
                if (vigenciaMapWhereChanged) {
                    void withTimeout(
                        zoomOrdenamientoLayerToWhere(newLayer, vigenciaMapWhere, currentCycle, { skipNational: true }),
                        5000,
                        false
                    ).catch((error) => {
                        if (String(error?.name || "") !== "AbortError") {
                            console.warn("No se pudo completar el zoom de Vigencia:", error);
                        }
                    });
                }
                return;
            }

            newLayer.when(async () => {
                if (currentCycle !== renderCycleId || layerGlobal !== newLayer || newLayer.destroyed) return;

                if (isClasificacionSuelo) return;

                // ZONIFICACIÓN RURAL: el render del gráfico NO debe quedar encadenado
                // detrás del queryExtent (zoom). El servicio rural es lento y, si el
                // queryExtent se cuelga, el render nunca se ejecutaría y solo la primera
                // consulta funcionaría. Aquí: render primero, zoom aparte con timeout.
                if (config.ordenamientoType === "zonificacion_rural") {
                    requestAnimationFrame(async () => {
                        if (currentCycle !== renderCycleId || layerGlobal !== newLayer || newLayer.destroyed) return;
                        await renderZonificacionRuralCharts(newLayer, config, whereOrdenamiento);
                    });
                    try {
                        const res = await withTimeout(
                            newLayer.queryExtent({ where: whereOrdenamiento }),
                            6000,
                            null
                        );
                        if (currentCycle !== renderCycleId || layerGlobal !== newLayer || newLayer.destroyed) return;
                        if (res?.extent) {
                            await view.goTo(res.extent.expand(1.2));
                        }
                    } catch (e) {
                        if (String(e?.name || "") !== "AbortError") {
                            console.warn("No se pudo hacer zoom a la zonificación rural:", e);
                        }
                    }
                    return;
                }

                try {
                    const res = await newLayer.queryExtent({ where: whereOrdenamiento });
                    if (currentCycle !== renderCycleId || layerGlobal !== newLayer || newLayer.destroyed) return;

                    if (res?.extent) {
                        await view.goTo(res.extent.expand(1.2));
                    }
                } catch (e) {
                    if (String(e?.name || "") === "AbortError") return;
                    console.warn("No se pudo hacer zoom a la capa de ordenamiento:", e);
                }

                // MAPA PRIMERO: Diferir carga de gráficos y datos para que el mapa
                // se renderice visualmente antes de ejecutar consultas pesadas
                requestAnimationFrame(async () => {
                    if (currentCycle !== renderCycleId || layerGlobal !== newLayer || newLayer.destroyed) return;

                    if (config.ordenamientoType === "vigencia") {
                        await renderVigenciaCharts(newLayer, config, whereOrdenamiento);
                        if (currentCycle !== renderCycleId || layerGlobal !== newLayer || newLayer.destroyed) return;

                    } else if (config.ordenamientoType === "zonificacion_rural") {
                        await renderZonificacionRuralCharts(newLayer, config, whereOrdenamiento);
                        if (currentCycle !== renderCycleId || layerGlobal !== newLayer || newLayer.destroyed) return;

                    } else if (config.ordenamientoType === "areas_actividad") {
                        await renderAreasActividadCharts(newLayer, config, whereOrdenamiento);
                        if (currentCycle !== renderCycleId || layerGlobal !== newLayer || newLayer.destroyed) return;

                    } else {
                        await actualizarGrafica(newLayer, config, { skipSyncMap: true });
                        if (currentCycle !== renderCycleId || layerGlobal !== newLayer || newLayer.destroyed) return;
                    }

                    if (
                        typeof updateLegendByExtent === "function" &&
                        config.ordenamientoType !== "areas_actividad" &&
                        config.ordenamientoType !== "clasificacion_suelo" &&
                        config.ordenamientoType !== "zonificacion_rural" &&
                        config.ordenamientoType !== "vigencia"
                    ) {
                        updateLegendByExtent(newLayer, config);
                    }
                });
            });
        }
        window.cargarOrdenamientoActual = cargarOrdenamientoActual;

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

                const fillColor = rgbaArrayToCss(info?.symbol?.color, "");
                if (!fillColor) return;
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

        const CLASIFICACION_SUELO_PALETTE = {
            "1": {
                label: "Urbano",
                fillColor: "#F57A7A",
                outlineColor: "#E1E1E1",
                outlineWidth: 1
            },
            "2": {
                label: "Rural",
                fillColor: "#E9FFBE",
                outlineColor: "#E1E1E1",
                outlineWidth: 1
            },
            "3": {
                label: "Expansión urbana",
                fillColor: "#FFAA00",
                outlineColor: "#E1E1E1",
                outlineWidth: 1
            }
        };

        function buildClasificacionSueloRenderer(config = ORDENAMIENTO_CONFIG.CLASIFICACION_SUELO) {
            const field = config?.typeField || "tipo_clasificacion_suelo";

            return {
                type: "unique-value",
                field,
                uniqueValueInfos: Object.entries(CLASIFICACION_SUELO_PALETTE).map(([code, info]) => ({
                    value: code,
                    label: info.label,
                    symbol: {
                        type: "simple-fill",
                        color: info.fillColor,
                        outline: {
                            color: info.outlineColor,
                            width: info.outlineWidth
                        }
                    }
                }))
            };
        }

        function getClasificacionFallbackItems() {
            return Object.entries(CLASIFICACION_SUELO_PALETTE).map(([code, info]) => ({
                code,
                label: info.label,
                value: 0,
                color: info.fillColor,
                borderColor: info.outlineColor,
                borderWidth: info.outlineWidth
            }));
        }

        const RURAL_USE_PALETTE = {
            "1": { label: "Agrícola", fillColor: "#E9C46A", outlineColor: "rgba(0,0,0,0)", outlineWidth: 0 },
            "2": { label: "Pecuario", fillColor: "#BC8A5F", outlineColor: "rgba(0,0,0,0)", outlineWidth: 0 },
            "3": { label: "Forestal", fillColor: "#A8A800", outlineColor: "rgba(0,0,0,0)", outlineWidth: 0 },
            "4": { label: "Acuicultura", fillColor: "#5DA9A6", outlineColor: "rgba(0,0,0,0)", outlineWidth: 0 },
            "5": { label: "Mineria", fillColor: "#7A7A7A", outlineColor: "rgba(0,0,0,0)", outlineWidth: 0 },
            "6": { label: "Hidrocarburos", fillColor: "#4F4F4F", outlineColor: "rgba(0,0,0,0)", outlineWidth: 0 },
            "7": { label: "Residencial", fillColor: "#E6E600", outlineColor: "rgba(0,0,0,0)", outlineWidth: 0 },
            "8": { label: "Dotacional_Institucional", fillColor: "#9C89B8", outlineColor: "rgba(0,0,0,0)", outlineWidth: 0 },
            "9": { label: "Industrial", fillColor: "#F57AB6", outlineColor: "rgba(0,0,0,0)", outlineWidth: 0 },
            "10": { label: "Turismo", fillColor: "#6EC5B8", outlineColor: "rgba(0,0,0,0)", outlineWidth: 0 },
            "11": { label: "Comercial_Servicios", fillColor: "#E76F51", outlineColor: "rgba(0,0,0,0)", outlineWidth: 0 },
            "12": { label: "Centro_Poblado", fillColor: "#F4A261", outlineColor: "rgba(0,0,0,0)", outlineWidth: 0 },
            "13": { label: "Conservacion_Proteccion_Ambiental.Preservacion", fillColor: "#344E41", outlineColor: "rgba(0,0,0,0)", outlineWidth: 0 },
            "14": { label: "Conservacion_Proteccion_Ambiental.Conservacion", fillColor: "#4C8F5A", outlineColor: "rgba(0,0,0,0)", outlineWidth: 0 },
            "15": { label: "Conservacion_Proteccion_Ambiental.Restauracion", fillColor: "#6E9B4D", outlineColor: "rgba(0,0,0,0)", outlineWidth: 0 },
            "16": { label: "Conservacion_Proteccion_Ambiental.Conocimiento", fillColor: "#A3BFA6", outlineColor: "rgba(0,0,0,0)", outlineWidth: 0 },
            "17": { label: "Conservacion_Proteccion_Ambiental.Uso_Sostenible", fillColor: "#AAFF00", outlineColor: "rgba(0,0,0,0)", outlineWidth: 0 },
            "18": { label: "Conservacion_Proteccion_Ambiental.Disfrute", fillColor: "#7FC8A9", outlineColor: "rgba(0,0,0,0)", outlineWidth: 0 },
            "19": { label: "Conservacion_Proteccion_Ambiental.Historico_Cultural", fillColor: "#D3FFBE", outlineColor: "rgba(0,0,0,0)", outlineWidth: 0 },
            "20": { label: "Otro", fillColor: "#BDBDBD", outlineColor: "rgba(0,0,0,0)", outlineWidth: 0 }
        };

        function normalizeZonificacionRuralLabel(value) {
            let label = String(value ?? "").trim();
            if (!label) return "";

            label = label
                .replace(/_/g, " ")
                .replace(/\s*\.\s*/g, ". ")
                .replace(/\s+/g, " ")
                .trim();

            const replacements = [
                [/\bAgricola\b/g, "Agrícola"],
                [/\bMineria\b/g, "Minería"],
                [/\bConservacion\b/g, "Conservación"],
                [/\bProteccion\b/g, "Protección"],
                [/\bPreservacion\b/g, "Preservación"],
                [/\bRestauracion\b/g, "Restauración"],
                [/\bHistorico\b/g, "Histórico"]
            ];

            replacements.forEach(([pattern, replacement]) => {
                label = label.replace(pattern, replacement);
            });

            return label;
        }

        const AREA_ACTIVIDAD_PALETTE = {
            "1": { fillColor: "#FFD966", outlineColor: "#666666", outlineWidth: 0.3, label: "Residencial" },
            "2": { fillColor: "#F4A261", outlineColor: "#666666", outlineWidth: 0.3, label: "Comercial" },
            "3": { fillColor: "#5DADE2", outlineColor: "#666666", outlineWidth: 0.3, label: "Servicios" },
            "4": { fillColor: "#F57AB6", outlineColor: "#666666", outlineWidth: 0.3, label: "Industrial" },
            "5": { fillColor: "#8E7CC3", outlineColor: "#666666", outlineWidth: 0.3, label: "Institucional" },
            "6": { fillColor: "#8E7CC3", outlineColor: "#666666", outlineWidth: 0.3, label: "Dotacional" },
            "7": { fillColor: "#D7C29E", outlineColor: "#666666", outlineWidth: 0.3, label: "Mixto" },
            "8": { fillColor: "#98E600", outlineColor: "#666666", outlineWidth: 0.3, label: "Otro" }
        };

        function getAreaActividadPaletteInfo(code) {
            const safeCode = String(code ?? "").trim();
            return AREA_ACTIVIDAD_PALETTE[safeCode] || AREA_ACTIVIDAD_PALETTE["8"];
        }

        function normalizeAreaActividadCode(value, layer = null, fieldName = "Uso_Principal") {
            const raw = String(value ?? "").trim();
            if (!raw) return "";
            if (AREA_ACTIVIDAD_PALETTE[raw]) return raw;

            const rawKey = normKey(raw);
            const paletteMatch = Object.entries(AREA_ACTIVIDAD_PALETTE).find(([, info]) =>
                normKey(info.label) === rawKey
            );
            if (paletteMatch) return paletteMatch[0];

            const field = (layer?.fields || []).find(f => f.name === fieldName);
            const coded = field?.domain?.codedValues || [];
            const domainMatch = coded.find(cv =>
                String(cv.code) === raw || normKey(cv.name) === rawKey
            );

            return domainMatch ? String(domainMatch.code) : raw;
        }

        function buildAreaActividadItem(code, value = 0) {
            const safeCode = String(code ?? "").trim() || "8";
            const paletteInfo = getAreaActividadPaletteInfo(safeCode);

            return {
                code: safeCode,
                label: String(paletteInfo.label),
                value,
                color: String(paletteInfo.fillColor),
                borderColor: String(paletteInfo.outlineColor),
                borderWidth: Number(paletteInfo.outlineWidth || 1)
            };
        }

        function buildAreasActividadRenderer(config = ORDENAMIENTO_CONFIG.AREAS_ACTIVIDAD) {
            const useField = config?.useField || "Uso_Principal";
            const defaultInfo = getAreaActividadPaletteInfo("8");

            return {
                type: "unique-value",
                field: useField,
                defaultSymbol: {
                    type: "simple-fill",
                    color: defaultInfo.fillColor,
                    outline: {
                        color: defaultInfo.outlineColor,
                        width: Number(defaultInfo.outlineWidth || 1)
                    }
                },
                defaultLabel: defaultInfo.label,
                uniqueValueInfos: Object.entries(AREA_ACTIVIDAD_PALETTE).map(([code, info]) => ({
                    value: Number.isFinite(Number(code)) ? Number(code) : code,
                    label: info.label,
                    symbol: {
                        type: "simple-fill",
                        color: info.fillColor,
                        outline: {
                            color: info.outlineColor,
                            width: Number(info.outlineWidth || 1)
                        }
                    }
                }))
            };
        }

        function applyAreasActividadPaletteRenderer(layer, config) {
            if (!layer || layer.destroyed) return;
            layer.renderer = buildAreasActividadRenderer(config);
        }

        function getRuralCategoriaPaletteInfo(code) {
            const safeCode = String(code ?? "").trim();
            return ruralCategoriaDict?.[safeCode] || ruralCategoriaDefaultInfo;
        }

        function getRuralUsePaletteInfo(code) {
            const safeCode = String(code ?? "").trim();
            return RURAL_USE_PALETTE[safeCode] || RURAL_USE_PALETTE["20"];
        }

        function buildRuralCategoriaItem(code, value = 0, layer = null, fieldName = "Tipo_Categoria_Rural") {
            const safeCode = String(code ?? "").trim();
            const paletteInfo = getRuralCategoriaPaletteInfo(safeCode);
            const domainLabel = layer ? getFieldDomainLabel(layer, fieldName, safeCode) : safeCode;

            return {
                code: safeCode,
                label: normalizeZonificacionRuralLabel(paletteInfo?.label || domainLabel || safeCode),
                value,
                color: paletteInfo?.fillColor ? String(paletteInfo.fillColor) : ruralCategoriaFallbackColor(safeCode),
                borderColor: paletteInfo?.outlineColor ? String(paletteInfo.outlineColor) : "rgba(0,0,0,0.25)",
                borderWidth: Number(paletteInfo?.outlineWidth || 0)
            };
        }

        function buildRuralUseItem(code, value = 0) {
            const safeCode = (code === null || code === undefined || String(code).trim() === "")
                ? "20"
                : String(code).trim();
            const paletteInfo = getRuralUsePaletteInfo(safeCode);

            return {
                code: safeCode,
                label: normalizeZonificacionRuralLabel(paletteInfo.label),
                value,
                color: String(paletteInfo.fillColor),
                borderColor: String(paletteInfo.outlineColor),
                borderWidth: Number(paletteInfo.outlineWidth || 0)
            };
        }

        function normalizeZonificacionRuralChartItem(item) {
            return {
                code: String(item?.code ?? ""),
                label: String(item?.label ?? item?.code ?? ""),
                value: Number(item?.value || 0),
                color: String(item?.color || "rgba(0,0,0,0)"),
                borderColor: String(item?.borderColor || "rgba(0,0,0,0)"),
                borderWidth: Number(item?.borderWidth || 0)
            };
        }

        function buildZonificacionRuralCategoriaRenderer(config = ORDENAMIENTO_CONFIG.ZONIFICACION_RURAL) {
            const categoryField = config?.categoryField || "Tipo_Categoria_Rural";
            const renderer = {
                type: "unique-value",
                field: categoryField,
                uniqueValueInfos: Object.entries(ruralCategoriaDict || {}).map(([code, info]) => ({
                    value: Number.isFinite(Number(code)) ? Number(code) : code,
                    label: info.label,
                    symbol: {
                        type: "simple-fill",
                        color: info.fillColor,
                        outline: {
                            color: info.outlineColor,
                            width: Number(info.outlineWidth || 0)
                        }
                    }
                }))
            };

            if (ruralCategoriaDefaultInfo) {
                renderer.defaultSymbol = {
                    type: "simple-fill",
                    color: ruralCategoriaDefaultInfo.fillColor,
                    outline: {
                        color: ruralCategoriaDefaultInfo.outlineColor,
                        width: Number(ruralCategoriaDefaultInfo.outlineWidth || 0)
                    }
                };
                renderer.defaultLabel = ruralCategoriaDefaultInfo.label;
            }

            return renderer;
        }

        function buildZonificacionRuralUsoRenderer(config = ORDENAMIENTO_CONFIG.ZONIFICACION_RURAL) {
            const useField = config?.useField || "Uso_Principal";
            const defaultInfo = getRuralUsePaletteInfo("20");

            return {
                type: "unique-value",
                field: useField,
                defaultSymbol: {
                    type: "simple-fill",
                    color: defaultInfo.fillColor,
                    outline: {
                        color: defaultInfo.outlineColor,
                        width: Number(defaultInfo.outlineWidth || 0)
                    }
                },
                defaultLabel: defaultInfo.label,
                uniqueValueInfos: Object.entries(RURAL_USE_PALETTE).map(([code, info]) => ({
                    value: Number.isFinite(Number(code)) ? Number(code) : code,
                    label: info.label,
                    symbol: {
                        type: "simple-fill",
                        color: info.fillColor,
                        outline: {
                            color: info.outlineColor,
                            width: Number(info.outlineWidth || 0)
                        }
                    }
                }))
            };
        }

        function applyZonificacionRuralPaletteRenderer(layer, config) {
            if (!layer || layer.destroyed) return;
            const rendererView = currentRuralChartView === "USO_PRINCIPAL" ? "USO_PRINCIPAL" : "CATEGORIA";
            // Evitar re-aplicar el mismo renderer a la misma capa: reasignar el
            // renderer fuerza un redibujo del mapa innecesario. Solo aplicar cuando
            // cambia la vista (Categorías/Uso) o la capa.
            if (layer.__zrRendererView === rendererView) return;
            layer.renderer = rendererView === "USO_PRINCIPAL"
                ? buildZonificacionRuralUsoRenderer(config)
                : buildZonificacionRuralCategoriaRenderer(config);
            layer.__zrRendererView = rendererView;
        }

        const VIGENCIA_FALLBACK_COLORS = [
            "#0079C1",
            "#6A3D9A",
            "#2A9D8F",
            "#F4A261",
            "#E76F51",
            "#8BC34A",
            "#546E7A",
            "#D81B60"
        ];
        let vigenciaRendererDict = null;
        let vigenciaRendererDictPromise = null;
        const VIGENCIA_TIPO_LABELS = {
            EOT: "Esquema de Ordenamiento Territorial",
            PBOT: "Plan Básico de Ordenamiento Territorial",
            POT: "Plan de Ordenamiento Territorial",
            SIN_POT: "Sin POT"
        };
        const VIGENCIA_TIPO_ORDER = ["EOT", "PBOT", "POT", "SIN_POT"];
        let vigenciaTipoItemsFull = [];
        let vigenciaEstadoItemsFull = [];

        async function ensureVigenciaRendererDict(layerUrl) {
            if (vigenciaRendererDict) return vigenciaRendererDict;
            if (vigenciaRendererDictPromise) return vigenciaRendererDictPromise;

            vigenciaRendererDictPromise = (async () => {
                try {
                    const url = String(layerUrl || ORDENAMIENTO_CONFIG.VIGENCIA.url).replace(/\/+$/, "") + "?f=pjson";
                    const res = await fetch(url);
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const json = await res.json();
                    const renderer = json?.drawingInfo?.renderer || {};
                    const infos = renderer?.uniqueValueInfos || [];
                    const groups = renderer?.uniqueValueGroups || [];
                    const dict = {};

                    infos.forEach((info, index) => {
                        const code = String(info.value ?? info.label ?? "").trim();
                        if (!code) return;

                        dict[code] = {
                            code,
                            label: String(info.label || code).trim(),
                            color: rgbaArrayToCss(info?.symbol?.color, VIGENCIA_FALLBACK_COLORS[index % VIGENCIA_FALLBACK_COLORS.length]),
                            borderColor: rgbaArrayToCss(info?.symbol?.outline?.color, "rgba(0,0,0,0)"),
                            borderWidth: Number(info?.symbol?.outline?.width || 1)
                        };
                    });

                    groups.forEach(group => {
                        (group.classes || []).forEach((cls, index) => {
                            const values = cls.values?.[0] || [];
                            const code = String(values[0] ?? cls.label ?? "").trim();
                            if (!code || dict[code]) return;

                            dict[code] = {
                                code,
                                label: String(cls.label || code).trim(),
                                color: rgbaArrayToCss(cls?.symbol?.color, VIGENCIA_FALLBACK_COLORS[index % VIGENCIA_FALLBACK_COLORS.length]),
                                borderColor: rgbaArrayToCss(cls?.symbol?.outline?.color, "rgba(0,0,0,0)"),
                                borderWidth: Number(cls?.symbol?.outline?.width || 1)
                            };
                        });
                    });

                    vigenciaRendererDict = dict;
                } catch (error) {
                    console.warn("Vigencia: no se pudieron cargar los metadatos de simbologia; se usaran colores locales.", error);
                    vigenciaRendererDict = {};
                }
                return vigenciaRendererDict;
            })();

            try {
                return await vigenciaRendererDictPromise;
            } finally {
                if (!vigenciaRendererDict) vigenciaRendererDictPromise = null;
            }
        }

        function getVigenciaRendererInfo(layer, code, index = 0) {
            const safeCode = String(code ?? "").trim();
            const dictInfo = vigenciaRendererDict?.[safeCode];
            if (dictInfo) return dictInfo;

            const infos = layer?.renderer?.uniqueValueInfos || [];
            const match = infos.find(info => String(info.value ?? info.label ?? "").trim() === safeCode);
            const fillColor = rgbaArrayToCss(match?.symbol?.color, "");
            const outlineColor = rgbaArrayToCss(match?.symbol?.outline?.color, "rgba(0,0,0,0)");

            return {
                label: String(match?.label || safeCode || "Sin clasificar"),
                color: fillColor || VIGENCIA_FALLBACK_COLORS[index % VIGENCIA_FALLBACK_COLORS.length],
                borderColor: outlineColor,
                borderWidth: Number(match?.symbol?.outline?.width || 1)
            };
        }

        function normalizeVigenciaTipoCode(value) {
            const raw = String(value ?? "").trim();
            const base = raw.split(",")[0].trim().toUpperCase();
            if (base === "EOT") return "EOT";
            if (base === "PBOT") return "PBOT";
            if (base === "POT") return "POT";
            if (!raw || base.includes("SIN")) return "SIN_POT";
            return base || "SIN_POT";
        }

        function getVigenciaTipoLabel(code) {
            const safeCode = String(code ?? "").trim().toUpperCase();
            return VIGENCIA_TIPO_LABELS[safeCode] || safeCode || "Sin POT";
        }

        function getVigenciaTipoSortIndex(code) {
            const index = VIGENCIA_TIPO_ORDER.indexOf(String(code ?? "").trim().toUpperCase());
            return index >= 0 ? index : VIGENCIA_TIPO_ORDER.length;
        }

        function getVigenciaTipoInfoFromRawValues(rawValues = [], code = "", index = 0) {
            const values = Array.isArray(rawValues) && rawValues.length ? rawValues : [code];
            const rawInfo = values
                .map(value => getVigenciaRendererInfo(layerGlobal, value, index))
                .find(info => info?.color);
            return {
                label: getVigenciaTipoLabel(code),
                color: rawInfo?.color || VIGENCIA_FALLBACK_COLORS[index % VIGENCIA_FALLBACK_COLORS.length],
                borderColor: rawInfo?.borderColor || "rgba(0,0,0,0.35)",
                borderWidth: Number(rawInfo?.borderWidth || 1)
            };
        }

        async function fetchVigenciaStats(layer, config, whereClause) {
            const typeField = config.typeField || "PotTipo";
            const objectIdField = layer?.objectIdField || "OBJECTID";
            const layerUrl = config.url || layer.url;
            const where = whereClause || layer.definitionExpression || "1=1";

            try {
                const js = await withTimeout(
                    arcRestQuery(layerUrl, {
                        f: "json",
                        where,
                        groupByFieldsForStatistics: typeField,
                        outStatistics: JSON.stringify([{
                            statisticType: "count",
                            onStatisticField: objectIdField,
                            outStatisticFieldName: "total"
                        }]),
                        returnGeometry: "false"
                    }, { timeoutMs: 10000 }),
                    12000,
                    null
                );

                if (js?.features?.length) {
                    return js.features.map(feature => feature.attributes || {});
                }
            } catch (e) {
                console.warn("Vigencia: no se pudo consultar estadística agrupada, se intentará consulta liviana.", e);
            }

            const raw = await withTimeout(
                arcRestQuery(layerUrl, {
                    f: "json",
                    where,
                    outFields: typeField,
                    returnGeometry: "false",
                    resultRecordCount: "2000"
                }, { timeoutMs: 8000 }),
                9000,
                null
            );

            const grouped = new Map();
            for (const feature of raw?.features || []) {
                const code = String(feature.attributes?.[typeField] ?? "Sin clasificar").trim() || "Sin clasificar";
                grouped.set(code, (grouped.get(code) || 0) + 1);
            }

            return Array.from(grouped.entries()).map(([code, total]) => ({
                [typeField]: code,
                total
            }));
        }

        async function fetchVigenciaRows(layer, config, whereClause, fieldNames = []) {
            const layerUrl = config.url || layer.url;
            const where = whereClause || layer.definitionExpression || "1=1";
            const safeFields = Array.from(new Set(fieldNames.filter(Boolean)));
            const cacheKey = [
                "raw",
                String(layerUrl || "").replace(/\/+$/, ""),
                String(where),
                safeFields.map(field => String(field).toLowerCase()).sort().join(",")
            ].join("|");

            if (vigenciaStatsCache.has(cacheKey)) {
                return vigenciaStatsCache.get(cacheKey).map(row => ({ ...row }));
            }
            if (vigenciaStatsInFlight.has(cacheKey)) {
                const pendingRows = await vigenciaStatsInFlight.get(cacheKey);
                return pendingRows.map(row => ({ ...row }));
            }

            const requestPromise = (async () => {
                try {
                    const js = await arcRestQuery(layerUrl, {
                        f: "json",
                        where,
                        outFields: safeFields.join(","),
                        returnGeometry: "false",
                        resultRecordCount: "2000"
                    }, { timeoutMs: 8000 });
                    return Array.isArray(js?.features)
                        ? js.features.map(feature => feature.attributes || {})
                        : [];
                } catch (error) {
                    console.warn(`Vigencia: no respondio la consulta liviana (${safeFields.join(", ")}).`, error);
                    return [];
                }
            })();

            vigenciaStatsInFlight.set(cacheKey, requestPromise);
            try {
                const rows = await requestPromise;
                if (rows.length) {
                    vigenciaStatsCache.set(cacheKey, rows.map(row => ({ ...row })));
                    while (vigenciaStatsCache.size > VIGENCIA_STATS_CACHE_LIMIT) {
                        vigenciaStatsCache.delete(vigenciaStatsCache.keys().next().value);
                    }
                }
                return rows.map(row => ({ ...row }));
            } finally {
                vigenciaStatsInFlight.delete(cacheKey);
            }
        }

        function countVigenciaRowsByField(rows, fieldName) {
            const grouped = new Map();
            for (const row of rows || []) {
                const code = String(row?.[fieldName] ?? "Sin clasificar").trim() || "Sin clasificar";
                grouped.set(code, (grouped.get(code) || 0) + 1);
            }
            return Array.from(grouped.entries()).map(([code, total]) => ({
                [fieldName]: code,
                total
            }));
        }

        function buildVigenciaCountItems(rows, fieldName, colorResolver) {
            const totals = new Map();

            for (const row of rows || []) {
                const code = String(row[fieldName] ?? "Sin clasificar").trim() || "Sin clasificar";
                const total = Number(row.total ?? row.TOTAL ?? row.count ?? 0);
                if (Number.isFinite(total) && total > 0) {
                    totals.set(code, (totals.get(code) || 0) + total);
                }
            }

            const totalCount = Array.from(totals.values()).reduce((acc, value) => acc + value, 0);
            return Array.from(totals.entries())
                .map(([code, count], index) => {
                    const info = colorResolver(code, index);
                    return {
                        code,
                        label: info.label || code,
                        count,
                        value: totalCount ? (count / totalCount) * 100 : 0,
                        color: info.color,
                        borderColor: info.borderColor || "rgba(0,0,0,0)",
                        borderWidth: Number(info.borderWidth || 1)
                    };
                })
                .sort((a, b) => b.count - a.count);
        }

        function buildVigenciaTipoItems(rows, fieldName) {
            const totals = new Map();
            const rawValues = new Map();

            for (const row of rows || []) {
                const rawCode = String(row[fieldName] ?? "Sin POT").trim() || "Sin POT";
                const code = normalizeVigenciaTipoCode(rawCode);
                const total = Number(row.total ?? row.TOTAL ?? row.count ?? 0);
                if (!Number.isFinite(total) || total <= 0) continue;

                totals.set(code, (totals.get(code) || 0) + total);
                if (!rawValues.has(code)) rawValues.set(code, new Set());
                rawValues.get(code).add(rawCode);
            }

            const totalCount = Array.from(totals.values()).reduce((acc, value) => acc + value, 0);
            return Array.from(totals.entries())
                .map(([code, count], index) => {
                    const values = Array.from(rawValues.get(code) || []);
                    const info = getVigenciaTipoInfoFromRawValues(values, code, index);
                    return {
                        code,
                        rawValues: values,
                        label: info.label,
                        count,
                        value: totalCount ? (count / totalCount) * 100 : 0,
                        color: info.color,
                        borderColor: info.borderColor || "rgba(0,0,0,0.35)",
                        borderWidth: Number(info.borderWidth || 1)
                    };
                })
                .sort((a, b) => {
                    const byOrder = getVigenciaTipoSortIndex(a.code) - getVigenciaTipoSortIndex(b.code);
                    return byOrder || b.count - a.count;
                });
        }

        function getVigenciaEstadoInfo(code, index = 0) {
            const safeCode = String(code ?? "").trim();
            const color = VIGENCIA_FALLBACK_COLORS[(index + 4) % VIGENCIA_FALLBACK_COLORS.length];
            return {
                label: safeCode || "Sin clasificar",
                color,
                borderColor: "rgba(110,110,110,1)",
                borderWidth: 1
            };
        }

        function ensureVigenciaChartsContainer() {
            const chartCanvas = document.getElementById("chart");
            const chartCard = chartCanvas?.closest(".chart-card");
            if (!chartCanvas || !chartCard) return null;

            chartCard.classList.add("chart-card--vigencia");
            chartCanvas.style.display = "none";
            chartCanvas.style.visibility = "hidden";
            chartCanvas.style.opacity = "0";

            let container = document.getElementById("vigenciaCharts");
            if (!container) {
                container = document.createElement("div");
                container.id = "vigenciaCharts";
                container.className = "vigencia-charts";
                chartCanvas.insertAdjacentElement("afterend", container);
            }

            container.innerHTML = `
            <div class="vigencia-chart-block">
                <div class="vigencia-canvas-wrap">
                    <canvas id="vigenciaTipoChart"></canvas>
                </div>
            </div>
            <div class="vigencia-chart-block vigencia-chart-block--estado">
                <h4 class="vigencia-chart-title">${buildOrdenamientoChartTitle("Estado de vigencia de los instrumentos")}</h4>
                <div class="vigencia-canvas-wrap">
                    <canvas id="vigenciaEstadoChart"></canvas>
                </div>
                <div class="vigencia-chart-legend vigencia-chart-legend--estado" aria-label="Leyenda del estado de vigencia"></div>
            </div>
        `;

            return {
                tipoCanvas: document.getElementById("vigenciaTipoChart"),
                estadoCanvas: document.getElementById("vigenciaEstadoChart")
            };
        }

        function getVigenciaActiveItems(items = [], activeCodes = null) {
            if (!(activeCodes instanceof Set)) return items;
            return items.filter(item => activeCodes.has(String(item.code)));
        }

        function updateVigenciaChartSize(wrap, itemCount) {
            if (!wrap) return;
            const size = getOrdenamientoPieChartHeight(itemCount, { compact: true });
            wrap.style.setProperty("--vigencia-chart-size", `${size}px`);
        }

        function applyVigenciaChartItems(chart, allItems = [], activeCodes = null) {
            if (!chart?.data?.datasets?.[0]) return;
            const activeItems = getVigenciaActiveItems(allItems, activeCodes);
            const dataset = chart.data.datasets[0];
            const wrap = chart.canvas?.closest(".vigencia-canvas-wrap");
            updateVigenciaChartSize(wrap, activeItems.length);

            // Reconstruir el gráfico SOLO con las categorías activas y
            // re-normalizar los porcentajes entre ellas, para que la torta
            // refleje exactamente el estado de visibilidad (sin categorías
            // ocultas ni atenuadas, y con porcentajes coherentes).
            const activeTotalCount = activeItems.reduce(
                (acc, item) => acc + (Number(item.count) || 0),
                0
            );

            chart.data.labels = activeItems.map(item => item.label);
            dataset.data = activeItems.map(item => {
                const count = Number(item.count) || 0;
                const pct = activeTotalCount ? (count / activeTotalCount) * 100 : 0;
                return Number(pct.toFixed(2));
            });
            dataset.backgroundColor = activeItems.map(item => item.color);
            dataset.borderColor = activeItems.map(item => item.borderColor);
            dataset.borderWidth = activeItems.map(item => Number(item.borderWidth || 1));
            dataset.codes = activeItems.map(item => String(item.code));
            dataset.counts = activeItems.map(item => Number(item.count));
            dataset.empty = activeItems.length === 0;
            chart.update?.("none");
            updateVigenciaChartEmptyState(chart);
        }

        // Estado vacío del gráfico: cuando no hay categorías activas, se oculta
        // la torta (conservando el espacio del contenedor) y se muestra un
        // mensaje. La leyenda HTML permanece visible para reactivar categorías.
        function updateVigenciaChartEmptyState(chart) {
            const canvas = chart?.canvas;
            const wrap = canvas?.closest(".vigencia-canvas-wrap");
            if (!wrap) return;

            const dataset = chart?.data?.datasets?.[0];
            const isEmpty = !!dataset?.empty || !(dataset?.data?.length);
            let msg = wrap.querySelector(".vigencia-empty-msg");

            if (isEmpty) {
                if (!msg) {
                    msg = document.createElement("div");
                    msg.className = "vigencia-empty-msg";
                    msg.textContent = "Active una categoría para ver el gráfico.";
                    wrap.appendChild(msg);
                }
                canvas.style.visibility = "hidden";
            } else {
                if (msg) msg.remove();
                canvas.style.visibility = "";
            }
        }

        function createVigenciaDoughnut(canvas, items, options = {}) {
            if (!canvas || typeof Chart === "undefined") return null;
            const allItems = Array.isArray(items) ? items : [];
            const activeCodes = options.activeCodes instanceof Set
                ? options.activeCodes
                : new Set(allItems.map(item => String(item.code)));
            const initialItems = getVigenciaActiveItems(allItems, activeCodes);
            const wrap = canvas.closest(".vigencia-canvas-wrap");
            updateVigenciaChartSize(wrap, initialItems.length);
            canvas.style.height = "100%";

            const chart = new Chart(canvas.getContext("2d"), {
                type: "doughnut",
                data: {
                    labels: initialItems.map(item => item.label),
                    datasets: [{
                        label: "%",
                        data: initialItems.map(item => Number(item.value.toFixed(2))),
                        backgroundColor: initialItems.map(item => item.color),
                        borderColor: initialItems.map(item => item.borderColor),
                        borderWidth: initialItems.map(item => Number(item.borderWidth || 1)),
                        codes: initialItems.map(item => String(item.code)),
                        counts: initialItems.map(item => Number(item.count)),
                        empty: initialItems.length === 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    aspectRatio: 1,
                    cutout: "58%",
                    radius: "88%",
                    onClick(_event, elements, activeChart) {
                        if (!elements?.length || typeof options.onSelect !== "function") return;

                        const dataIndex = elements[0].index;
                        const code = activeChart?.data?.datasets?.[0]?.codes?.[dataIndex];
                        if (code === null || code === undefined || String(code).trim() === "") return;

                        options.onSelect(String(code), activeChart);
                    },
                    layout: {
                        padding: {
                            top: 2,
                            right: 34,
                            bottom: 2,
                            left: 34
                        }
                    },
                    plugins: {
                        // La leyenda interactiva se renderiza como HTML DEBAJO del
                        // canvas (ver renderVigenciaChartLegend). Se desactiva la
                        // leyenda interna de Chart.js para que NUNCA se superponga
                        // con la torta al redibujar/redimensionar.
                        legend: {
                            display: false
                        },
                        tooltip: {
                            callbacks: {
                                label(context) {
                                    const label = context.label || "";
                                    const value = Number(context.raw);
                                    const count = context.dataset?.counts?.[context.dataIndex] || 0;
                                    return `${label}: ${Number.isFinite(value) ? value.toFixed(2) : "0.00"}% (${Number(count).toLocaleString("es-CO")})`;
                                }
                            }
                        }
                    }
                },
                plugins: [
                    createOrdenamientoPiePercentageLabelsPlugin()
                ]
            });
            chart.$vigenciaItems = allItems;
            chart.$vigenciaActiveCodes = activeCodes;
            chart.$vigenciaOnToggle = options.onToggle || null;
            chart.update?.("none");
            renderVigenciaChartLegend(chart);
            updateVigenciaChartEmptyState(chart);

            canvas.ondblclick = event => {
                if (typeof options.onRestore !== "function") return;

                const hits = typeof chart.getElementsAtEventForMode === "function"
                    ? chart.getElementsAtEventForMode(
                        event,
                        "nearest",
                        { intersect: true },
                        true
                    )
                    : [];
                if (hits.length) return;

                options.onRestore(chart);
            };

            return chart;
        }

        // Leyenda interactiva en HTML, ubicada DEBAJO del canvas (flujo normal),
        // por lo que es imposible que se monte sobre la torta. Replica el toggle
        // original: activar/desactivar categorías y sincronizar.
        function renderVigenciaChartLegend(chart) {
            if (!chart) return;
            const canvas = chart.canvas;
            const block = canvas?.closest(".vigencia-chart-block");
            if (!block) return;

            let legendEl = block.querySelector(".vigencia-chart-legend");
            if (!legendEl) {
                legendEl = document.createElement("div");
                legendEl.className = "vigencia-chart-legend";
                block.appendChild(legendEl);
            }
            legendEl.innerHTML = "";

            const items = chart.$vigenciaItems || [];
            const activeSet = chart.$vigenciaActiveCodes instanceof Set
                ? chart.$vigenciaActiveCodes
                : new Set(items.map(it => String(it.code)));

            items.forEach(item => {
                const code = String(item.code);
                const active = activeSet.has(code);

                const row = document.createElement("button");
                row.type = "button";
                row.className = "vigencia-legend-item" + (active ? "" : " off");
                row.dataset.code = code;

                const sw = document.createElement("span");
                sw.className = "vigencia-legend-color";
                sw.style.background = item.color || "#999";
                sw.style.borderColor = item.borderColor || "transparent";

                const lab = document.createElement("span");
                lab.className = "vigencia-legend-label";
                lab.textContent = String(item.label || "");

                row.appendChild(sw);
                row.appendChild(lab);

                row.addEventListener("click", (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const set = chart.$vigenciaActiveCodes instanceof Set
                        ? chart.$vigenciaActiveCodes
                        : new Set(items.map(it => String(it.code)));
                    if (set.has(code)) {
                        set.delete(code);
                    } else {
                        set.add(code);
                    }
                    chart.$vigenciaActiveCodes = set;
                    applyVigenciaChartItems(chart, items, set);
                    if (typeof chart.$vigenciaOnToggle === "function") {
                        chart.$vigenciaOnToggle(code, set, chart);
                    }
                    renderVigenciaChartLegend(chart);
                });

                legendEl.appendChild(row);
            });
        }

        function syncVigenciaChartWithLegend(state = window.__legendState) {
            if (
                currentOrdenamientoTab !== "VIGENCIA" ||
                !state?.activeCodes ||
                !vigenciaTipoChartInstance?.data?.datasets?.[0]
            ) {
                return;
            }

            vigenciaTipoChartInstance.$vigenciaActiveCodes = new Set(state.activeCodes);
            applyVigenciaChartItems(vigenciaTipoChartInstance, vigenciaTipoItemsFull, state.activeCodes);
            renderVigenciaChartLegend(vigenciaTipoChartInstance);
        }

        function syncVigenciaLegendDom(state = window.__legendState) {
            if (!state?.activeCodes) return;
            document.querySelectorAll("#legendContent .legend-item[data-code]").forEach(row => {
                const active = state.activeCodes.has(String(row.dataset.code || ""));
                row.classList.toggle("active", active);
                row.classList.toggle("off", !active);
                row.style.opacity = active ? "1" : "0.35";
            });
        }

        function applyVigenciaSingleSelection(code) {
            const safeCode = String(code ?? "").trim();
            const state = window.__legendState;
            if (!safeCode || !state?.activeCodes) return;

            state.activeCodes = new Set([safeCode]);
            syncVigenciaLegendDom(state);
            applyVigenciaLegendFilter(state);
            syncVigenciaChartWithLegend(state);
        }

        function restoreVigenciaAllCategories() {
            const state = window.__legendState;
            if (!state?.isVigencia || !Array.isArray(state.allCodes)) return;

            state.activeCodes = new Set(state.allCodes.map(code => String(code)));
            syncVigenciaLegendDom(state);
            applyVigenciaLegendFilter(state);
            syncVigenciaChartWithLegend(state);
        }

        function applyVigenciaLegendFilter(state = window.__legendState) {
            if (!state?.field) return;

            const activeCodes = state.activeCodes instanceof Set
                ? state.activeCodes
                : new Set((state.allCodes || []).map(code => String(code)));
            const totalCount = Array.isArray(state.allCodes) ? state.allCodes.length : 0;
            const activeCount = activeCodes.size;
            let typeWhere = "";

            if (activeCount === 0) {
                typeWhere = "1=0";
            } else if (totalCount > 0 && activeCount < totalCount) {
                const rawValues = [];
                activeCodes.forEach(code => {
                    const values = state.filterValuesByCode?.[String(code)];
                    if (Array.isArray(values) && values.length) {
                        rawValues.push(...values);
                    } else {
                        rawValues.push(code);
                    }
                });
                typeWhere = buildLegendWhere(state.field, new Set(rawValues), "string");
            }

            const mapBaseWhere = state.mapBaseWhere || state.baseWhere;
            const baseWhere = mapBaseWhere && String(mapBaseWhere).trim()
                ? String(mapBaseWhere).trim()
                : "1=1";
            const finalWhere = typeWhere ? `${baseWhere} AND (${typeWhere})` : baseWhere;

            if (state.layer && !state.layer.destroyed) {
                state.layer.definitionExpression = finalWhere;
            }

            const sublayer = state.visualLayer?.findSublayerById?.(state.mapServerLayerId ?? 0);
            if (sublayer) {
                sublayer.definitionExpression = finalWhere;
            }
        }

        function actualizarLeyendaVigencia(titleText, items = [], layer = layerGlobal, config = ORDENAMIENTO_CONFIG.VIGENCIA, whereClause = "1=1") {
            const title = document.getElementById("legendTitle");
            const content = document.getElementById("legendContent");

            if (title) title.textContent = titleText || "Vigencia";
            if (!content) return;

            content.innerHTML = "";

            if (!items.length) {
                window.__legendState = {
                    allCodes: [],
                    activeCodes: new Set(),
                    field: config.typeField || "PotTipo",
                    layer,
                    visualLayer: window.activeVisualLayer,
                    mapServerLayerId: config.mapServerLayerId ?? 0,
                    baseWhere: whereClause,
                    mapBaseWhere: getVigenciaMapDisplayWhere(config, whereClause),
                    isVigencia: true
                };
                return;
            }

            window.__legendState = {
                allCodes: items.map(item => String(item.code)),
                activeCodes: new Set(items.map(item => String(item.code))),
                filterValuesByCode: Object.fromEntries(items.map(item => [
                    String(item.code),
                    Array.isArray(item.rawValues) && item.rawValues.length
                        ? item.rawValues.map(value => String(value))
                        : [String(item.code)]
                ])),
                field: config.typeField || "PotTipo",
                layer,
                visualLayer: window.activeVisualLayer,
                mapServerLayerId: config.mapServerLayerId ?? 0,
                baseWhere: whereClause,
                mapBaseWhere: getVigenciaMapDisplayWhere(config, whereClause),
                isVigencia: true
            };

            items.forEach(item => {
                const row = document.createElement("div");
                row.className = "legend-item active";
                row.dataset.code = String(item.code);
                row.style.cursor = "pointer";
                row.style.display = "flex";
                row.style.alignItems = "center";
                row.style.gap = "8px";
                row.style.marginBottom = "6px";
                row.style.color = "black";
                row.style.opacity = "1";

                const swatch = document.createElement("span");
                swatch.className = "legend-color";
                swatch.style.display = "inline-block";
                swatch.style.width = "12px";
                swatch.style.height = "12px";
                swatch.style.minWidth = "12px";
                swatch.style.borderRadius = "2px";
                swatch.style.background = item.color || "#999";
                swatch.style.border = `1px solid ${item.borderColor || "rgba(0,0,0,0)"}`;

                const label = document.createElement("span");
                label.className = "legend-label";
                label.style.color = "black";
                label.textContent = String(item.label || item.code || "Sin clasificar");

                row.appendChild(swatch);
                row.appendChild(label);
                row.addEventListener("click", event => {
                    event.preventDefault();
                    event.stopPropagation();

                    const state = window.__legendState;
                    const code = String(row.dataset.code || "");
                    if (!state?.activeCodes || !code) return;

                    if (state.activeCodes.has(code)) {
                        state.activeCodes.delete(code);
                    } else {
                        state.activeCodes.add(code);
                    }

                    syncVigenciaLegendDom(state);
                    applyVigenciaLegendFilter(state);
                    syncVigenciaChartWithLegend(state);
                });
                content.appendChild(row);
            });
        }

        async function renderVigenciaCharts(layer, config, whereClause) {
            try {
                if (currentOrdenamientoTab !== "VIGENCIA" || layerGlobal !== layer || layer?.destroyed) return;
                setOrdenamientoChartLoading();
                const rendererPromise = ensureVigenciaRendererDict(config.url || layer.url);

                const typeField = config.typeField || "PotTipo";
                const estadoField = config.statusField || "estado_instrumento";
                // Mapa y leyenda conservan el contexto departamental; los gráficos usan
                // la información específica del municipio seleccionado. Cuando hay
                // municipio, la leyenda se arma con el "where" del departamento.
                const mapLegendWhere = getVigenciaMapDisplayWhere(config, whereClause);
                const needsSeparateLegend =
                    !!mapLegendWhere &&
                    String(mapLegendWhere).trim() !== String(whereClause || "").trim();

                const [, chartRows, legendRows] = await Promise.all([
                    rendererPromise,
                    fetchVigenciaRows(layer, config, whereClause, [typeField, estadoField]),
                    needsSeparateLegend
                        ? fetchVigenciaRows(layer, config, mapLegendWhere, [typeField])
                        : Promise.resolve(null)
                ]);
                if (currentOrdenamientoTab !== "VIGENCIA" || layerGlobal !== layer || layer?.destroyed) return;

                const tipoRows = countVigenciaRowsByField(chartRows, typeField);
                const estadoRows = countVigenciaRowsByField(chartRows, estadoField);
                const legendTipoRows = needsSeparateLegend
                    ? countVigenciaRowsByField(legendRows || [], typeField)
                    : null;

                const items = buildVigenciaTipoItems(tipoRows, typeField);
                const estadoItems = buildVigenciaCountItems(
                    estadoRows,
                    estadoField,
                    (code, index) => getVigenciaEstadoInfo(code, index)
                );
                // Categorías de la leyenda del mapa (departamento completo).
                const legendItems = needsSeparateLegend
                    ? buildVigenciaTipoItems(legendTipoRows || [], typeField)
                    : items;

                if (!items.length && !estadoItems.length) {
                    actualizarLeyendaVigencia("Vigencia", legendItems, layer, config, whereClause);
                    setOrdenamientoChartNoData("No se encontraron instrumentos de ordenamiento territorial para la selección actual.");
                    return;
                }

                destroyOrdenamientoChartInstance();
                const titleElement = document.getElementById("chartTitle");
                if (currentOrdenamientoTab !== "VIGENCIA" || layerGlobal !== layer || layer?.destroyed) return;

                if (titleElement) {
                    titleElement.textContent = buildOrdenamientoChartTitle("Distribución de instrumentos de ordenamiento territorial");
                }

                const chartTargets = ensureVigenciaChartsContainer();
                if (!chartTargets) {
                    setOrdenamientoChartError("No fue posible preparar los gráficos de Vigencia.");
                    return;
                }

                vigenciaTipoItemsFull = items;
                vigenciaEstadoItemsFull = estadoItems;
                vigenciaTipoChartInstance = createVigenciaDoughnut(chartTargets.tipoCanvas, items, {
                    activeCodes: new Set(items.map(item => String(item.code))),
                    onSelect(code) {
                        applyVigenciaSingleSelection(code);
                    },
                    onRestore() {
                        restoreVigenciaAllCategories();
                    },
                    onToggle(_code, activeSet) {
                        const state = window.__legendState;
                        if (!state?.isVigencia) return;
                        state.activeCodes = new Set(activeSet);
                        syncVigenciaLegendDom(state);
                        applyVigenciaLegendFilter(state);
                    }
                });
                vigenciaEstadoChartInstance = createVigenciaDoughnut(chartTargets.estadoCanvas, estadoItems, {
                    activeCodes: new Set(estadoItems.map(item => String(item.code)))
                });
                actualizarLeyendaVigencia("Vigencia", legendItems, layer, config, whereClause);
            } catch (e) {
                console.warn("No se pudo renderizar gráfico de Vigencia:", e);
                actualizarLeyendaVigencia("Vigencia", [], layer, config, whereClause);
                setOrdenamientoChartError("No fue posible cargar la distribución por tipo de instrumento.");
            }
        }

        async function fetchClasificacionRawStatsFallback({
            layerUrl,
            where,
            typeField,
            areaField,
            cycleId = renderCycleId
        }) {
            const grouped = new Map();
            const pageSize = 2000;
            const maxPages = 1;

            for (let page = 0; page < maxPages; page++) {
                const resultOffset = page * pageSize;
                markClasificacionPerf("stats-raw-fallback-page-start", cycleId, {
                    where,
                    resultOffset
                });
                const js = await arcRestQuery(layerUrl, {
                    f: "json",
                    where,
                    outFields: `${typeField},${areaField}`,
                    returnGeometry: "false",
                    resultOffset: String(resultOffset),
                    resultRecordCount: String(pageSize)
                }, { timeoutMs: 12000 });

                const features = Array.isArray(js.features) ? js.features : [];
                for (const feature of features) {
                    const attrs = feature.attributes || {};
                    const code = String(attrs[typeField] ?? "").trim();
                    const area = Number(attrs[areaField] ?? 0);
                    if (code && Number.isFinite(area) && area > 0) {
                        grouped.set(code, (grouped.get(code) || 0) + area);
                    }
                }

                markClasificacionPerf("stats-raw-fallback-page-finished", cycleId, {
                    where,
                    resultOffset,
                    rows: features.length,
                    exceededTransferLimit: Boolean(js.exceededTransferLimit)
                });

                if (!js.exceededTransferLimit || features.length < pageSize) break;
            }

            return Array.from(grouped.entries()).map(([code, area]) => ({
                [typeField]: code,
                sum_area: area
            }));
        }

        async function fetchClasificacionSueloStats(layer, config, whereClause, cycleId = renderCycleId) {
            const areaField = config.areaField || "CSArea";
            const typeField = config.typeField || "Tipo_Clasificacion_Suelo";
            const primaryLayerUrl = config.mapServerUrl && config.mapServerLayerId !== undefined
                ? `${String(config.mapServerUrl).replace(/\/+$/, "")}/${config.mapServerLayerId}`
                : (config.url || layer.url);
            const fallbackLayerUrl = config.url || layer.url || "";
            const where = whereClause || layer.definitionExpression || "1=1";
            const cacheKey = [
                String(primaryLayerUrl || "").replace(/\/+$/, ""),
                where,
                typeField,
                areaField
            ].join("|");

            if (clasificacionStatsCache.has(cacheKey)) {
                markClasificacionPerf("stats-cache-hit", cycleId, { where });
                return clasificacionStatsCache.get(cacheKey).map(row => ({ ...row }));
            }

            const attempts = [{
                source: "MapServer",
                layerUrl: primaryLayerUrl,
                timeoutMs: 15000
            }];
            if (
                fallbackLayerUrl &&
                String(fallbackLayerUrl).replace(/\/+$/, "") !== String(primaryLayerUrl || "").replace(/\/+$/, "")
            ) {
                attempts.push({
                    source: "FeatureServer stats fallback",
                    layerUrl: fallbackLayerUrl,
                    timeoutMs: 12000
                });
            }

            let rows = [];
            let lastError = null;

            for (const attempt of attempts) {
                try {
                    markClasificacionPerf("stats-query-start", cycleId, {
                        where,
                        source: attempt.source
                    });
                    rows = await fetchGroupedStats({
                        layerUrl: attempt.layerUrl,
                        where,
                        groupField: typeField,
                        sumField: areaField,
                        outFieldName: "sum_area",
                        timeoutMs: attempt.timeoutMs
                    });
                    markClasificacionPerf("stats-query-finished", cycleId, {
                        where,
                        rows: rows.length,
                        source: attempt.source
                    });
                    if (rows.length || attempt === attempts[attempts.length - 1]) break;
                    markClasificacionPerf("stats-empty-retry", cycleId, {
                        where,
                        source: attempt.source
                    });
                } catch (e) {
                    lastError = e;
                    markClasificacionPerf("stats-query-failed", cycleId, {
                        where,
                        source: attempt.source,
                        message: String(e?.message || e || "")
                    });
                }
            }

            if (!rows.length && fallbackLayerUrl) {
                try {
                    markClasificacionPerf("stats-raw-fallback-start", cycleId, { where });
                    rows = await fetchClasificacionRawStatsFallback({
                        layerUrl: fallbackLayerUrl,
                        where,
                        typeField,
                        areaField,
                        cycleId
                    });
                    markClasificacionPerf("stats-raw-fallback-finished", cycleId, {
                        where,
                        rows: rows.length
                    });
                } catch (e) {
                    markClasificacionPerf("stats-raw-fallback-failed", cycleId, {
                        where,
                        message: String(e?.message || e || "")
                    });
                    if (lastError) throw lastError;
                    throw e;
                }
            }

            if (!rows.length && lastError) throw lastError;

            rememberClasificacionStats(cacheKey, rows);
            return rows.map(row => ({ ...row }));
        }

        async function renderZonificacionRuralCharts(layer, config, whereClause) {
            const seq = ++zonificacionRuralRenderSeq;
            const requestedView = currentRuralChartView;
            try {
                if (
                    currentOrdenamientoTab !== "ZONIFICACION_RURAL" ||
                    layerGlobal !== layer ||
                    layer?.destroyed
                ) {
                    return;
                }
                // Estado limpio en cada consulta: cancelar selección/resaltado temporal
                // de consultas anteriores para que no queden residuos (Req. consultas
                // departamentales/municipales sin mezclas ni geometrías previas).
                if (zonificacionRuralSelectionTimer) {
                    clearTimeout(zonificacionRuralSelectionTimer);
                    zonificacionRuralSelectionTimer = null;
                }
                clearHighlight();
                zonificacionRuralCanvasChartState = null;
                document.querySelectorAll("#legendContent .legend-item.selected").forEach(row => {
                    row.classList.remove("selected");
                    row.style.background = "transparent";
                    row.style.outline = "none";
                });
                // Limpiar el estado de la consulta anterior para que una nueva
                // consulta no reutilice items previos (evita textos/resúmenes nulos
                // o desfasados entre consultas).
                window.__zr_categoria_items = [];
                window.__zr_uso_items = [];
                setOrdenamientoChartLoading();
                actualizarLeyendaOrdenamientoRural(
                    requestedView === "CATEGORIA" ? "Categorías rurales" : "Uso principal rural",
                    [],
                    whereClause || layer.definitionExpression || "1=1"
                );
                // El diccionario de categorías es necesario para los colores de
                // "Categorías rurales", pero su carga no debe bloquear el render si
                // el servicio falla: continuar con lo que haya disponible.
                try {
                    await ensureRuralCategoriaDict(config.url || layer.url);
                } catch (dictErr) {
                    console.warn("Diccionario de categorías rurales no disponible:", dictErr);
                }
                if (
                    seq !== zonificacionRuralRenderSeq ||
                    currentOrdenamientoTab !== "ZONIFICACION_RURAL" ||
                    currentRuralChartView !== requestedView ||
                    layerGlobal !== layer ||
                    layer?.destroyed
                ) {
                    return;
                }
                applyZonificacionRuralPaletteRenderer(layer, config);

                const areaField = config.areaField || "UsoArea";
                const areaFallbackField = config.areaFallbackField || "st_area(shape)";
                const categoryField = config.categoryField || "Tipo_Categoria_Rural";
                const useField = config.useField || "Uso_Principal";
                const statsWhere = whereClause || layer.definitionExpression || "1=1";
                const statsCacheKey = `${config.url || layer.url}|${statsWhere}`;

                const hasPositiveArea = rows => Array.isArray(rows) && rows.some(row => {
                    const value = Number(row?.sum_area);
                    return Number.isFinite(value) && value > 0;
                });

                const fetchRuralStats = async groupField => {
                    const primaryRows = await fetchGroupedStats({
                        layerUrl: config.url || layer.url,
                        where: statsWhere,
                        groupField,
                        sumField: areaField,
                        outFieldName: "sum_area",
                        timeoutMs: 20000
                    });

                    if (hasPositiveArea(primaryRows) || areaFallbackField === areaField) {
                        return primaryRows;
                    }

                    return fetchGroupedStats({
                        layerUrl: config.url || layer.url,
                        where: statsWhere,
                        groupField,
                        sumField: areaFallbackField,
                        outFieldName: "sum_area",
                        timeoutMs: 20000
                    });
                };

                // Reutilizar resultados ya consultados para el mismo filtro (mismo
                // departamento/municipio). Si no hay caché, consultar y guardar.
                let catRows;
                let useRows;
                const cachedStats = zonificacionRuralStatsCache.get(statsCacheKey);
                if (
                    cachedStats &&
                    hasPositiveArea(cachedStats.catRows) &&
                    hasPositiveArea(cachedStats.useRows)
                ) {
                    catRows = cachedStats.catRows;
                    useRows = cachedStats.useRows;
                } else {
                    [catRows, useRows] = await Promise.all([
                        fetchRuralStats(categoryField),
                        fetchRuralStats(useField)
                    ]);
                    // Guardar solo respuestas válidas (evita cachear fallos/vacíos
                    // por timeouts del servicio, que sí deben poder reintentarse).
                    if ((catRows && catRows.length) || (useRows && useRows.length)) {
                        if (zonificacionRuralStatsCache.size >= ZONIFICACION_RURAL_STATS_CACHE_LIMIT) {
                            const oldestKey = zonificacionRuralStatsCache.keys().next().value;
                            if (oldestKey !== undefined) zonificacionRuralStatsCache.delete(oldestKey);
                        }
                        zonificacionRuralStatsCache.set(statsCacheKey, { catRows, useRows });
                    }
                }
                if (
                    seq !== zonificacionRuralRenderSeq ||
                    currentOrdenamientoTab !== "ZONIFICACION_RURAL" ||
                    currentRuralChartView !== requestedView ||
                    layerGlobal !== layer ||
                    layer?.destroyed
                ) {
                    return;
                }

                if (!catRows.length && !useRows.length) {
                    actualizarLeyendaOrdenamientoRural(
                        requestedView === "CATEGORIA" ? "Categorías rurales" : "Uso principal rural",
                        [],
                        whereClause
                    );
                    window.__zr_categoria_items = [];
                    window.__zr_uso_items = [];
                    setOrdenamientoChartNoData();
                    // No dejar la sección de textos nula: mostrar mensaje controlado.
                    actualizarResumenOrdenamientoRural(layer, config, whereClause);
                    return;
                }

                const catMap = new Map();
                const useMap = new Map();

                for (const a of catRows) {
                    const catCode = String(a[categoryField] ?? "").trim();
                    const area = Number(a.sum_area) || 0;
                    if (catCode) catMap.set(catCode, area);
                }

                for (const a of useRows) {
                    const useCode = String(a[useField] ?? "").trim();
                    const area = Number(a.sum_area) || 0;
                    if (useCode) useMap.set(useCode, area);
                }

                const totalCat = Array.from(catMap.values()).reduce((acc, v) => acc + v, 0);
                const totalUse = Array.from(useMap.values()).reduce((acc, v) => acc + v, 0);

                const catItems = Array.from(catMap.entries())
                    .map(([code, area]) => {
                        return buildRuralCategoriaItem(
                            code,
                            totalCat ? (area / totalCat) * 100 : 0,
                            layer,
                            categoryField
                        );
                    })
                    .filter(item => item.color)
                    .sort((a, b) => b.value - a.value);

                const useItems = Array.from(useMap.entries())
                    .map(([code, area]) => {
                        return buildRuralUseItem(
                            code,
                            totalUse ? (area / totalUse) * 100 : 0
                        );
                    })
                    .sort((a, b) => b.value - a.value);

                window.__zr_categoria_items = catItems;
                window.__zr_uso_items = useItems;

                if (
                    seq !== zonificacionRuralRenderSeq ||
                    currentOrdenamientoTab !== "ZONIFICACION_RURAL" ||
                    currentRuralChartView !== requestedView ||
                    layerGlobal !== layer ||
                    layer?.destroyed
                ) {
                    return;
                }
                paintZonificacionRuralViewFromItems(layer, config, whereClause, catItems, useItems);

            } catch (e) {
                if (
                    seq !== zonificacionRuralRenderSeq ||
                    currentOrdenamientoTab !== "ZONIFICACION_RURAL"
                ) {
                    return;
                }
                console.error("renderZonificacionRuralCharts error:", e);
                // Solo mostrar el estado de error si el gráfico NO llegó a construirse.
                // Si ya existe un gráfico con datos, el error proviene de un paso
                // posterior (no crítico) y no debemos destruir el gráfico válido.
                const chartHasData = !!(
                    chartInstance &&
                    Array.isArray(chartInstance.data?.datasets) &&
                    chartInstance.data.datasets[0]?.data?.length
                );
                if (!chartHasData) {
                    // No dejar el módulo bloqueado ni la sección de textos nula tras un
                    // error: dejar un estado controlado para permitir nuevas consultas.
                    setOrdenamientoChartError("No fue posible cargar el gráfico de zonificación rural. Intente nuevamente.");
                    const div = document.getElementById("summaryDiv");
                    if (div) {
                        div.style.display = "";
                    }
                }
            }
        }

        async function renderClasificacionSueloCharts(layer, config, whereClause, cycleId = renderCycleId) {
            try {
                if (currentOrdenamientoTab !== "CLASIFICACION_SUELO" || cycleId !== renderCycleId || layerGlobal !== layer || layer?.destroyed) return;
                markClasificacionPerf("chart-render-start", cycleId);

                const areaField = config.areaField || "CSArea";
                const typeField = config.typeField || "Tipo_Clasificacion_Suelo";
                const titleElement = document.getElementById("chartTitle");
                const summaryDiv = document.getElementById("summaryDiv");

                // Estado "Cargando gráfico..." persistente mientras el servicio responde.
                const showClasificacionLoadingState = () => {
                    setOrdenamientoChartLoading();
                    if (summaryDiv) {
                        summaryDiv.style.display = "";
                        summaryDiv.textContent = municipioActual
                            ? "Cargando información del municipio..."
                            : (filtroNivel === "DEPTO"
                                ? "Cargando resumen departamental..."
                                : "Cargando información de la clasificación del suelo...");
                    }
                };

                // IMPORTANTE: solo se reintenta la CONSULTA de datos (red). El gráfico
                // se construye UNA sola vez después de obtener los datos, para evitar
                // que se reinicie/parpadee cada pocos segundos. Mantenemos el estado
                // "Cargando gráfico..." hasta ~60s antes de mostrar un error.
                const maxLoadingMs = 60000;
                const loadingStartedAt = Date.now();
                let attempt = 0;
                let lastFetchError = null;
                let rows = null;
                let gotData = false;

                // Mostrar el estado de carga una sola vez al inicio.
                showClasificacionLoadingState();

                while (Date.now() - loadingStartedAt < maxLoadingMs) {
                    attempt++;
                    if (currentOrdenamientoTab !== "CLASIFICACION_SUELO" || cycleId !== renderCycleId || layerGlobal !== layer || layer?.destroyed) return;
                    try {
                        const result = await withTimeout(
                            fetchClasificacionSueloStats(layer, config, whereClause, cycleId),
                            25000,
                            null
                        );
                        if (currentOrdenamientoTab !== "CLASIFICACION_SUELO" || cycleId !== renderCycleId || layerGlobal !== layer || layer?.destroyed) return;
                        if (result === null) throw new Error("timeout-clasificacion-stats");
                        rows = result;
                        gotData = true;
                        break;
                    } catch (e) {
                        lastFetchError = e;
                        markClasificacionPerf("clasificacion-fetch-failed", cycleId, {
                            attempt,
                            elapsedMs: Date.now() - loadingStartedAt,
                            message: String(e?.message || e || "")
                        });
                        if (currentOrdenamientoTab !== "CLASIFICACION_SUELO" || cycleId !== renderCycleId || layerGlobal !== layer || layer?.destroyed) return;
                        const elapsed = Date.now() - loadingStartedAt;
                        if (elapsed >= maxLoadingMs) break;
                        // Reintentar la CONSULTA tras una breve pausa, sin tocar el gráfico.
                        const waitMs = Math.min(2000, Math.max(0, maxLoadingMs - elapsed));
                        await new Promise(resolve => setTimeout(resolve, waitMs));
                        if (currentOrdenamientoTab !== "CLASIFICACION_SUELO" || cycleId !== renderCycleId || layerGlobal !== layer || layer?.destroyed) return;
                    }
                }

                if (currentOrdenamientoTab !== "CLASIFICACION_SUELO" || cycleId !== renderCycleId || layerGlobal !== layer || layer?.destroyed) return;

                if (!gotData) {
                    console.error(
                        "Clasificación del suelo: la consulta de datos no respondió a tiempo.",
                        lastFetchError
                    );
                    markClasificacionPerf("clasificacion-fetch-exhausted", cycleId, {
                        message: String(lastFetchError?.message || lastFetchError || "")
                    });
                    setOrdenamientoChartError(
                        "El servicio de Clasificación del suelo está tardando más de lo normal. La capa se muestra en el mapa; vuelva a intentarlo."
                    );
                    return;
                }

                const features = rows.map(a => ({ attributes: a }));

                if (!features.length) {
                    // Sin elementos en el mapa para esta selección: la leyenda queda vacía.
                    actualizarLeyendaClasificacionSuelo("Clasificación del suelo", []);
                    setOrdenamientoChartNoData();
                    return;
                }

                const typeMap = new Map();
                let totalArea = 0;

                features.forEach(feature => {
                    const attrs = feature.attributes || {};
                    const rawCode = attrs[typeField];

                    if (rawCode === null || rawCode === undefined || String(rawCode).trim() === "") {
                        return;
                    }

                    const safeCode = String(rawCode).trim();
                    const rawArea = Number(attrs.sum_area ?? attrs[areaField] ?? 0);
                    const areaHa = rawArea * 1000;

                    if (!Number.isFinite(areaHa) || areaHa <= 0) return;

                    totalArea += areaHa;
                    typeMap.set(safeCode, (typeMap.get(safeCode) || 0) + areaHa);
                });

                const items = Array.from(typeMap.entries())
                    .map(([code, area]) => {
                        const safeCode = String(code).trim();
                        const domainLabel = getFieldDomainLabel(layer, typeField, safeCode);
                        const paletteInfo = CLASIFICACION_SUELO_PALETTE[safeCode] || {};

                        return {
                            code: safeCode,
                            label: String(paletteInfo.label || domainLabel || safeCode),
                            value: totalArea ? (Number(area) / totalArea) * 100 : 0,
                            color: String(paletteInfo.fillColor || "#999"),
                            borderColor: String(paletteInfo.outlineColor || "rgba(0,0,0,0)"),
                            borderWidth: Number(paletteInfo.outlineWidth || 1)
                        };
                    })
                    .filter(item => Number.isFinite(item.value) && item.value > 0)
                    .sort((a, b) => b.value - a.value);

                window.__cs_items = items;

                const labels = items.map(x => String(x.label));
                const values = items.map(x => Number(x.value.toFixed(2)));
                const colors = items.map(x => String(x.color));

                if (currentOrdenamientoTab !== "CLASIFICACION_SUELO" || cycleId !== renderCycleId || layerGlobal !== layer || layer?.destroyed) return;

                if (titleElement) {
                    titleElement.textContent = buildOrdenamientoChartTitle("Distribución de la clasificación del suelo");
                }

                const csDataset = [{
                    label: "%",
                    data: values,
                    backgroundColor: items.map(x => String(x.color || "#999")),
                    borderColor: items.map(x => String(x.borderColor || "rgba(0,0,0,0)")),
                    borderWidth: items.map(x => Number(x.borderWidth || 1)),
                    codes: items.map(x => String(x.code))
                }];

                crearGrafica(labels, values, colors, "doughnut", false, csDataset);
                markClasificacionPerf("chart-rendered", cycleId, { items: items.length });

                // El clic en segmentos del gráfico se maneja dentro de crearGrafica()
                // (config.options.onClick), que es la forma fiable en Chart.js 4.

                // Doble clic fuera de un segmento del gráfico -> restaurar todas las
                // categorías en mapa, gráfico y leyenda.
                const csChartCanvas = document.getElementById("chart");
                if (csChartCanvas) {
                    csChartCanvas.ondblclick = (event) => {
                        if (
                            currentMainModule !== "ORDENAMIENTO" ||
                            currentOrdenamientoTab !== "CLASIFICACION_SUELO"
                        ) {
                            return;
                        }
                        const hit = (chartInstance && typeof chartInstance.getElementsAtEventForMode === "function")
                            ? chartInstance.getElementsAtEventForMode(event, "nearest", { intersect: true }, true)
                            : [];
                        if (hit.length) return;
                        restaurarClasificacionLegendCompleto();
                    };
                }

                // La leyenda y el resumen son pasos NO críticos: si fallan, NO deben
                // destruir ni reconstruir el gráfico ya dibujado.
                try {
                    actualizarLeyendaClasificacionSuelo("Clasificación del suelo", items);
                    syncClasificacionChartWithLegend();
                    markClasificacionPerf("legend-ready", cycleId, { items: items.length });
                } catch (legendErr) {
                    console.warn("Clasificación del suelo: la leyenda no pudo actualizarse (el gráfico sigue visible).", legendErr);
                }
                if (cycleId !== renderCycleId || layerGlobal !== layer || layer?.destroyed) return;

                try {
                    await actualizarResumenClasificacionSuelo(config, null, cycleId);
                    if (cycleId !== renderCycleId || layerGlobal !== layer || layer?.destroyed) return;
                } catch (_) {
                    markClasificacionPerf("summary-timeout", cycleId);
                    if (summaryDiv) {
                        summaryDiv.textContent = "La capa y el grafico de Clasificacion del suelo se muestran en el mapa. El resumen normativo tardo demasiado en responder.";
                    }
                }

            } catch (e) {
                if (cycleId !== renderCycleId || layerGlobal !== layer || layer?.destroyed) return;
                markClasificacionPerf("chart-error", cycleId, {
                    message: String(e?.message || e || "")
                });
                console.error("Clasificación del suelo: error inesperado al renderizar el gráfico.", e);
                setOrdenamientoChartError(
                    "El servicio de Clasificación del suelo está tardando más de lo normal. La capa se muestra en el mapa; vuelva a intentarlo."
                );
            }
        }

        async function renderAreasActividadCharts(layer, config, whereClause, cargarNormativa = true, options = {}) {
            try {
                if (options.showLoading !== false) {
                    setOrdenamientoChartLoading();
                }
                const areaField = config.areaField || "AActArea";
                const useField = config.useField || "Uso_Principal";
                const filterField = config.filterField || "Mp_Codigo";
                let baseWhere = "1=1";

                if (municipioActual) {
                    baseWhere = `${filterField} = '${String(municipioActual).replace(/'/g, "''")}'`;
                } else if (filtroNivel === "DEPTO" && deptoActual) {
                    if (config.deptoFilterField) {
                        baseWhere = `${config.deptoFilterField} = '${String(deptoActual).replace(/'/g, "''")}'`;
                    } else if (
                        String(filterField).toLowerCase() === "mpcodigo" ||
                        String(filterField).toLowerCase() === "mp_codigo"
                    ) {
                        baseWhere = sqlStartsWith(filterField, deptoActual);
                    }
                }

                window.__aa_base_where = baseWhere;

                const query = layer.createQuery();
                query.where = whereClause || "1=1";
                query.outFields = config.outFields || ["*"];
                query.returnGeometry = false;
                const isBaseLegendRender = String(whereClause || "1=1") === String(baseWhere || "1=1");

                const result = await layer.queryFeatures(query);
                const features = result?.features || [];

                if (!features.length) {
                    const fullItems = window.__aa_all_items?.length ? window.__aa_all_items : [];
                    const allCategoriesDisabled =
                        currentOrdenamientoTab === "AREAS_ACTIVIDAD" &&
                        whereClause === "1=0" &&
                        fullItems.length > 0 &&
                        window.__aa_active_filters instanceof Set &&
                        window.__aa_active_filters.size === 0;

                    if (allCategoriesDisabled) {
                        window.__aa_items = [];
                        renderAreasActividadCanvasChart(fullItems, config);
                        actualizarLeyendaAreasActividad("Áreas de actividad", fullItems);
                        actualizarResumenAreasActividadSinNormativa();
                        return;
                    }

                    actualizarLeyendaAreasActividad(
                        "Áreas de actividad",
                        fullItems
                    );
                    setOrdenamientoChartNoData();
                    return;
                }

                const useMap = new Map();
                let totalArea = 0;

                features.forEach(feature => {
                    const attrs = feature.attributes || {};
                    const rawCode = attrs[useField];

                    if (rawCode === null || rawCode === undefined || String(rawCode).trim() === "") {
                        return;
                    }

                    const safeCode = String(rawCode).trim();

                    const rawArea = Number(attrs[areaField] || 0);
                    const areaHa = rawArea * 1000;

                    if (!Number.isFinite(areaHa) || areaHa <= 0) return;

                    totalArea += areaHa;
                    useMap.set(safeCode, (useMap.get(safeCode) || 0) + areaHa);
                });

                const items = Array.from(useMap.entries())
                    .map(([code, area]) => {
                        const safeCode = String(code).trim();
                        const areaItem = buildAreaActividadItem(
                            safeCode,
                            totalArea ? (Number(area) / totalArea) * 100 : 0
                        );

                        return {
                            ...areaItem,
                            code: safeCode
                        };
                    })
                    .filter(item => Number.isFinite(item.value) && item.value > 0)
                    .sort((a, b) => b.value - a.value);

                window.__aa_items = items;

                // guardar universo completo de códigos solo cuando se carga la vista base
                if (isBaseLegendRender || !window.__aa_full_codes?.length) {
                    window.__aa_full_codes = items.map(x => String(x.code));
                    window.__aa_all_items = items;
                }

                // inicializar o depurar activos contra el universo completo,
                // no contra la consulta filtrada; asi lo apagado no desaparece.
                if (isBaseLegendRender || !window.__aa_active_filters || !(window.__aa_active_filters instanceof Set)) {
                    window.__aa_active_filters = new Set(window.__aa_full_codes);
                    window.__aa_selected_code = null;
                } else {
                    const validCodes = new Set(window.__aa_full_codes);
                    window.__aa_active_filters = new Set(
                        Array.from(window.__aa_active_filters).filter(code => validCodes.has(String(code)))
                    );
                }

                const labels = items.map(x => String(x.label));
                const values = items.map(x => Number(x.value.toFixed(2)));
                const colors = items.map(x => String(x.color));

                const titleElement = document.getElementById("chartTitle");
                if (titleElement) {
                    titleElement.textContent = buildOrdenamientoChartTitle("Distribución de áreas de actividad");
                }

                const aaDataset = [{
                    label: "%",
                    data: values,
                    backgroundColor: context => String(items[context.dataIndex]?.color || "#BDBDBD"),
                    borderColor: context => {
                        const item = items[context.dataIndex];
                        const code = item ? normalizeAreaActividadCode(item.code, layerGlobal) : null;
                        return code && code === areasActividadChartHighlightedCode
                            ? "#5B2EFF"
                            : String(item?.borderColor || "rgba(0,0,0,0)");
                    },
                    borderWidth: context => {
                        const item = items[context.dataIndex];
                        const code = item ? normalizeAreaActividadCode(item.code, layerGlobal) : null;
                        return code && code === areasActividadChartHighlightedCode
                            ? 4
                            : Number(item?.borderWidth || 1);
                    },
                    borderAlign: "inner",
                    hoverOffset: 0,
                    offset: 0
                }];

                renderAreasActividadCanvasChart(items, config);
                areasActividadChartCodes = items.map(x => String(x.code));
                if (chartInstance) {
                    chartInstance.$areasActividadCodes = areasActividadChartCodes;
                    syncStateFromGlobals();
                }

                if (chartInstance) {
                    chartInstance.options = chartInstance.options || {};
                    chartInstance.options.onClick = async function (evt, elements) {
                        if (!elements || !elements.length) return;

                        const idx = elements[0].index;
                        const selected = items[idx];
                        if (!selected) return;

                        window.__aa_active_filters = new Set([String(selected.code)]);
                        seleccionarCategoriaAreasActividad(null, { highlightChart: false });
                        await aplicarFiltroAreasActividadDesdeLeyenda();
                        const normativaCode = getNormativaUseCodeAreasActividad(selected);
                        await actualizarResumenAreasActividad(config, normativaCode);
                    };

                    const chartCanvas = document.getElementById("chart");
                    if (chartCanvas) {
                        chartCanvas.ondblclick = async (event) => {
                            const hitItems = chartInstance && typeof chartInstance.getElementsAtEventForMode === "function"
                                ? chartInstance.getElementsAtEventForMode(
                                    event,
                                    "nearest",
                                    { intersect: true },
                                    true
                                )
                                : [];

                            if (hitItems.length) return;
                            await restaurarAreasActividadLegend();
                        };
                    }
                }

                actualizarLeyendaAreasActividad(
                    "Áreas de actividad",
                    window.__aa_all_items?.length ? window.__aa_all_items : items
                );

                if (window.__aa_selected_code) {
                    seleccionarCategoriaAreasActividad(window.__aa_selected_code);
                }

                if (cargarNormativa) {
                    await actualizarResumenAreasActividad(config, null);
                } else {
                    actualizarResumenAreasActividadSinNormativa();
                }

            } catch (e) {
                console.error("renderAreasActividadCharts error:", e);
            }
        }

        function actualizarResumenOrdenamientoRural(layer, config, whereClause) {
            const div = document.getElementById("summaryDiv");
            if (!div) return;

            // Garantizar que la sección de textos descriptivos sea visible: los
            // estados de carga (setOrdenamientoChartLoading) dejan el contenedor en
            // display:none, por lo que el texto quedaba escrito pero oculto (nulo).
            div.style.display = "";

            try {
                const useItems = Array.isArray(window.__zr_uso_items) ? window.__zr_uso_items : [];
                const catItems = Array.isArray(window.__zr_categoria_items) ? window.__zr_categoria_items : [];

                if (!municipioActual) {
                    div.innerHTML = `
                <p class="oot-js-ordenamiento-main-2">
                    Visualización nacional de la zonificación del suelo rural.
                    Seleccione un municipio para ver el resumen específico.
                </p>
            `;
                    return;
                }

                const topUso = [...useItems].sort((a, b) => b.value - a.value)[0];
                const topCat = [...catItems].sort((a, b) => b.value - a.value)[0];

                // Si no hay categorías ni usos identificados, no dejar la sección
                // vacía ni nula: mostrar un mensaje controlado.
                if (!catItems.length && !useItems.length) {
                    div.innerHTML = `
                <p class="oot-js-ordenamiento-main-3"><b>Municipio:</b> ${escapeHtml(getMunicipioDisplayName(municipioActual, diccionarioMunicipios))}</p>
                <p class="oot-js-ordenamiento-main-2">No existe texto descriptivo para la categoría seleccionada en este municipio.</p>
            `;
                    return;
                }

                div.innerHTML = `
            <p class="oot-js-ordenamiento-main-3"><b>Municipio:</b> ${escapeHtml(getMunicipioDisplayName(municipioActual, diccionarioMunicipios))}</p>
            <p class="oot-js-ordenamiento-main-3"><b>Categorías rurales identificadas:</b> ${catItems.length}</p>
            <p class="oot-js-ordenamiento-main-3"><b>Categoría predominante:</b> ${topCat ? escapeHtml(topCat.label) : "Sin información"}</p>
            <p class="oot-js-ordenamiento-main-2"><b>Uso principal predominante:</b> ${topUso ? escapeHtml(topUso.label) : "Sin información"}</p>
        `;
            } catch (e) {
                console.warn("No se pudo construir el resumen de zonificación rural:", e);
                div.style.display = "";
                div.innerHTML = `
                <p class="oot-js-ordenamiento-main-2">No existe texto descriptivo para la categoría seleccionada en este municipio.</p>
            `;
            }
        }

        async function actualizarResumenClasificacionSuelo(config, selectedTypeCode = null, cycleId = renderCycleId) {
            const div = document.getElementById("summaryDiv");
            if (!div) return;

            const requestId = ++clasificacionSummaryRequestId;
            const municipioResumen = municipioActual;
            const items = window.__cs_items || [];

            if (!municipioResumen) {
                div.innerHTML = `
                <p class="oot-js-ordenamiento-main-2">
                    Visualización nacional de la clasificación del suelo.
                    Seleccione un municipio para ver el resumen específico.
                </p>
            `;
                return;
            }

            const topItem = [...items].sort((a, b) => b.value - a.value)[0];
            let normHtml = "";

            try {
                if (cycleId !== renderCycleId || requestId !== clasificacionSummaryRequestId) return;

                if (!clasificacionNormativaLayer || clasificacionNormativaLayer.destroyed) {
                    clasificacionNormativaLayer = new FeatureLayer({
                        url: config.normativaTableUrl,
                        outFields: [
                            config.normativaSpecificTextField,
                            config.normativaTypeField
                        ]
                    });
                }

                const q = clasificacionNormativaLayer.createQuery();
                const baseWhere = sqlEquals(config.normativaJoinField, municipioResumen);
                const selectedTypeValue = String(selectedTypeCode ?? "").trim();
                const selectedTypeWhere = selectedTypeValue && SQL_NUMBER_RE.test(selectedTypeValue)
                    ? sqlEqualsNumber(config.normativaTypeField, selectedTypeValue)
                    : sqlEquals(config.normativaTypeField, selectedTypeValue);
                q.where = selectedTypeValue
                    ? `${baseWhere} AND ${selectedTypeWhere}`
                    : baseWhere;
                q.returnGeometry = false;
                q.outFields = [
                    config.normativaSpecificTextField,
                    config.normativaTypeField
                ];

                const res = await withTimeout(clasificacionNormativaLayer.queryFeatures(q), 5500, null);
                if (
                    cycleId !== renderCycleId ||
                    requestId !== clasificacionSummaryRequestId ||
                    municipioActual !== municipioResumen
                ) {
                    return;
                }

                if (!res) {
                    markClasificacionPerf("summary-norm-timeout", cycleId, { municipio: municipioResumen });
                }

                const textos = (res?.features || [])
                    .map(f => f.attributes?.[config.normativaSpecificTextField])
                    .filter(Boolean);

                if (textos.length) {
                    const selectedItem = selectedTypeValue
                        ? items.find(item => String(item.code) === selectedTypeValue)
                        : null;
                    const selectedLabel = selectedItem?.label || CLASIFICACION_SUELO_PALETTE[selectedTypeValue]?.label || selectedTypeValue;
                    const title = selectedTypeValue
                        ? `Texto normativo especifico (${escapeHtml(selectedLabel)}):`
                        : "Texto normativo:";
                    normHtml = `
                    <p class="oot-js-ordenamiento-main-4"><b>${title}</b></p>
                    <div>${[...new Set(textos)].map(t => `<p class="oot-js-ordenamiento-main-5">${escapeHtml(t).replace(/\n/g, "<br>")}</p>`).join("")}</div>
                `;
                } else if (selectedTypeValue) {
                    normHtml = `
                    <p class="oot-js-ordenamiento-main-4"><b>Texto normativo:</b> No existe texto normativo para la categoría seleccionada en este municipio.</p>
                `;
                }
            } catch (e) {
                if (
                    cycleId !== renderCycleId ||
                    requestId !== clasificacionSummaryRequestId ||
                    municipioActual !== municipioResumen
                ) {
                    return;
                }
                recordClasificacionAsyncIssue("summary-norm-error", e, cycleId, { municipio: municipioResumen });
            }

            if (
                cycleId !== renderCycleId ||
                requestId !== clasificacionSummaryRequestId ||
                municipioActual !== municipioResumen
            ) {
                return;
            }

            div.innerHTML = `
            <p class="oot-js-ordenamiento-main-3"><b>Municipio:</b> ${escapeHtml(getMunicipioDisplayName(municipioResumen, diccionarioMunicipios))}</p>
            <p class="oot-js-ordenamiento-main-3"><b>Categorías identificadas:</b> ${items.length}</p>
            <p class="oot-js-ordenamiento-main-3"><b>Tipo predominante:</b> ${topItem ? escapeHtml(topItem.label) : "Sin información"}</p>
            ${normHtml}
        `;
        }

        function queryArcGISJsonp(layerUrl, params = {}) {
            return new Promise((resolve, reject) => {
                const callbackName =
                    "__jsonpArcGIS_" + Date.now() + "_" + Math.floor(Math.random() * 10000);

                const query = new URLSearchParams();

                Object.entries(params).forEach(([key, value]) => {
                    query.set(key, value);
                });

                query.set("f", "json");
                query.set("callback", callbackName);

                const script = document.createElement("script");
                script.src = `${String(layerUrl).replace(/\/+$/, "")}/query?${query.toString()}`;

                window[callbackName] = function (data) {
                    delete window[callbackName];
                    script.remove();
                    resolve(data);
                };

                script.onerror = function () {
                    delete window[callbackName];
                    script.remove();
                    reject(new Error("No se pudo consultar ArcGIS por JSONP"));
                };

                document.body.appendChild(script);
            });
        }

        const AREAS_ACTIVIDAD_NORMATIVA_CODE_BY_LABEL = {
            "Agricola": 1,
            "Agrícola": 1,
            "Pecuario": 2,
            "Forestal": 3,
            "Acuicultura": 4,
            "Mineria": 5,
            "Minería": 5,
            "Hidrocarburos": 6,
            "Residencial": 7,
            "Dotacional_Institucional": 8,
            "Dotacional Institucional": 8,
            "Institucional dotacional": 8,
            "Industrial": 9,
            "Turismo": 10,
            "Comercial_Servicios": 11,
            "Comercial Servicios": 11,
            "Comercial": 11,
            "Servicios": 11,
            "Centro_Poblado": 12,
            "Centro Poblado": 12,
            "Otro": 20
        };
        function getNormativaUseCodeAreasActividad(itemOrCode) {
            if (!itemOrCode) return null;

            if (typeof itemOrCode === "object") {
                const label = String(itemOrCode.label || "").trim();
                return AREAS_ACTIVIDAD_NORMATIVA_CODE_BY_LABEL[label] ?? Number(itemOrCode.code);
            }

            return Number(itemOrCode);
        }

        async function actualizarResumenAreasActividad(config, selectedUseCode = null) {
            const div = document.getElementById("summaryDiv");
            if (!div) return;

            const items = window.__aa_items || [];

            if (!municipioActual) {
                div.innerHTML = `
                <p class="oot-js-ordenamiento-main-2">
                    Visualización nacional de las áreas de actividad.
                    Seleccione un municipio para ver la descripción normativa.
                </p>
            `;
                return;
            }

            const esc = (v) => String(v ?? "")
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;")
                .replace(/\n/g, "<br>");

            let normHtml = `
            <p class="oot-js-ordenamiento-main-6">
                <b>Descripción normativa:</b> No se encontró información normativa para este municipio.
            </p>
        `;

            try {
                const where = `${config.normativaJoinField} = '${String(municipioActual).replace(/'/g, "''")}'`;

                const json = await queryArcGISJsonp(config.normativaTableUrl, {
                    where,
                    outFields: "*",
                    returnGeometry: "false"
                });

                const features = json?.features || [];

                let filtered = features;

                if (selectedUseCode !== null && selectedUseCode !== undefined) {
                    filtered = filtered.filter(f =>
                        Number(f.attributes?.[config.normativaUseField]) === Number(selectedUseCode)
                    );
                }

                if (filtered.length) {

                    const generalText = filtered
                        .map(f => f.attributes?.[config.normativaGeneralTextField])
                        .filter(Boolean)[0];

                    const bloques = filtered.map(f => {
                        const a = f.attributes || {};
                        const usoCode = Number(a[config.normativaUseField]);

                        // ðŸ⬝¥ BUSCAR LABEL CORRECTO (por equivalencia)
                        const item = items.find(i =>
                            Number(i.normativaCode ?? i.code) === usoCode
                        );

                        const usoLabel = item?.label || `Uso ${usoCode}`;
                        const texto = a[config.normativaSpecificTextField] || "";

                        return `
                        <div class="oot-js-ordenamiento-main-7">
                            <p class="oot-js-ordenamiento-main-8"><b>${esc(usoLabel)}</b></p>
                            <p class="oot-js-ordenamiento-main-2">${esc(texto)}</p>
                        </div>
                    `;
                    }).join("");

                    normHtml = `
                    ${generalText ? `
                        <p class="oot-js-ordenamiento-main-9"><b>Texto normativo general:</b></p>
                        <p class="oot-js-ordenamiento-main-2">${esc(generalText)}</p>
                    ` : ""}

                    <p class="oot-js-ordenamiento-main-10"><b>Texto normativo por uso:</b></p>
                    ${bloques}
                `;
                }

            } catch (e) {
                console.warn("No se pudo consultar normativa de Áreas de actividad:", e);
            }

            div.innerHTML = `
            ${normHtml}
        `;
        }

        function arcgisJsonpQuery(layerUrl, params = {}) {
            return new Promise((resolve, reject) => {
                const callbackName = "__arcgis_jsonp_" + Date.now() + "_" + Math.floor(Math.random() * 10000);

                const url = new URL(layerUrl.replace(/\/+$/, "") + "/query");

                Object.entries(params).forEach(([key, value]) => {
                    url.searchParams.set(key, value);
                });

                url.searchParams.set("f", "json");
                url.searchParams.set("callback", callbackName);

                const script = document.createElement("script");

                window[callbackName] = function (data) {
                    delete window[callbackName];
                    script.remove();

                    if (data?.error) {
                        reject(data.error);
                    } else {
                        resolve(data);
                    }
                };

                script.onerror = function () {
                    delete window[callbackName];
                    script.remove();
                    reject(new Error("Error cargando JSONP ArcGIS"));
                };

                script.src = url.toString();
                document.body.appendChild(script);
            });
        }

        function actualizarResumenAreasActividadSinNormativa() {
            const div = document.getElementById("summaryDiv");
            if (!div) return;

            if (!municipioActual) {
                div.innerHTML = `
                <p class="oot-js-ordenamiento-main-2">
                    Seleccione un municipio para ver la descripción normativa.
                </p>
            `;
                return;
            }

            const config = ORDENAMIENTO_CONFIG?.AREAS_ACTIVIDAD;

            if (config) {
                actualizarResumenAreasActividad(config, null);
            } else {
                div.innerHTML = `
                <p class="oot-js-ordenamiento-main-2">
                    Cargando descripción normativa...
                </p>
            `;
            }
        }

        function updateOrdenamientoCanvasEmptyMessage(canvas, isEmpty, options = {}) {
            const parent = canvas?.parentElement;
            if (!parent) return;

            const attr = options.attr || "data-ordenamiento-empty-msg";
            let msg = parent.querySelector(`[${attr}='true']`);

            if (!isEmpty) {
                if (msg) msg.remove();
                if (options.hideCanvas) {
                    canvas.style.visibility = "";
                }
                return;
            }

            if (!msg) {
                msg = document.createElement("div");
                msg.className = "vigencia-empty-msg";
                msg.setAttribute(attr, "true");
                msg.textContent = "Active una categoría para ver el gráfico.";
                parent.appendChild(msg);
            }

            if (getComputedStyle(parent).position === "static") {
                parent.style.position = "relative";
            }

            msg.style.inset = "auto";
            msg.style.left = `${Math.max(0, Number(options.left || 0))}px`;
            msg.style.top = `${Math.max(0, Number(options.top || 0))}px`;
            msg.style.width = `${Math.max(1, Number(options.width || canvas.clientWidth || 320))}px`;
            msg.style.height = `${Math.max(1, Number(options.height || canvas.clientHeight || 260))}px`;

            if (options.hideCanvas) {
                canvas.style.visibility = "hidden";
            }
        }

        function updateAreasActividadChartEmptyMessage(canvas, isEmpty, bounds = {}) {
            updateOrdenamientoCanvasEmptyMessage(canvas, isEmpty, {
                attr: "data-aa-empty-msg",
                ...bounds
            });
        }

        function drawAreasActividadSliceLabels(ctx, options = {}) {
            const slices = Array.isArray(options.slices) ? options.slices : [];
            const total = Number(options.total) || 0;
            if (!slices.length || total <= 0) return;

            const cx = Number(options.cx) || 0;
            const cy = Number(options.cy) || 0;
            const outerRadius = Number(options.outerRadius) || 0;
            const innerRadius = Number(options.innerRadius) || 0;
            const cssWidth = Number(options.cssWidth) || 0;
            const cssHeight = Number(options.cssHeight) || 0;
            const chartRight = Math.max(0, cssWidth - (Number(options.legendWidth) || 0) - 6);
            const chartLeft = 6;
            const fontSize = slices.length >= 10 ? 8 : slices.length >= 7 ? 9 : 10;
            const labelHeight = fontSize + 8;
            const labelPadX = 5;
            const textColor = "#17352d";
            const labelBg = "rgba(255,250,240,0.94)";
            const labelStroke = "rgba(23,53,45,0.18)";
            const connectorColor = "rgba(23,53,45,0.58)";
            const internalBoxes = [];
            const externalLabels = [];

            const overlaps = (box, boxes) => boxes.some(other =>
                box.left < other.right &&
                box.right > other.left &&
                box.top < other.bottom &&
                box.bottom > other.top
            );

            const roundRect = (x, y, width, height, radius = 5) => {
                const r = Math.min(radius, width / 2, height / 2);
                ctx.beginPath();
                ctx.moveTo(x + r, y);
                ctx.lineTo(x + width - r, y);
                ctx.quadraticCurveTo(x + width, y, x + width, y + r);
                ctx.lineTo(x + width, y + height - r);
                ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
                ctx.lineTo(x + r, y + height);
                ctx.quadraticCurveTo(x, y + height, x, y + height - r);
                ctx.lineTo(x, y + r);
                ctx.quadraticCurveTo(x, y, x + r, y);
                ctx.closePath();
            };

            const drawText = (text, x, y) => {
                ctx.save();
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.font = `700 ${fontSize}px Arial, sans-serif`;
                ctx.lineWidth = 3;
                ctx.strokeStyle = "rgba(255,250,240,0.88)";
                ctx.strokeText(text, x, y);
                ctx.fillStyle = textColor;
                ctx.fillText(text, x, y);
                ctx.restore();
            };

            ctx.save();
            ctx.font = `700 ${fontSize}px Arial, sans-serif`;

            slices.forEach(slice => {
                const value = Number(slice?.item?.value || 0);
                if (!Number.isFinite(value) || value <= 0) return;

                const percent = (value / total) * 100;
                const text = formatOrdenamientoPiePercentLabel(percent);
                if (!text) return;

                const angleSize = Math.abs(Number(slice.end) - Number(slice.start));
                const angle = Number(slice.start) + (Number(slice.end) - Number(slice.start)) / 2;
                const radialWidth = outerRadius - innerRadius;
                const midRadius = innerRadius + radialWidth * 0.62;
                const arcLength = angleSize * Math.max(midRadius, 1);
                const textWidth = ctx.measureText(text).width + 5;
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);
                const internalX = cx + cos * midRadius;
                const internalY = cy + sin * midRadius;
                const internalBox = {
                    left: internalX - textWidth / 2,
                    right: internalX + textWidth / 2,
                    top: internalY - labelHeight / 2,
                    bottom: internalY + labelHeight / 2
                };
                const fitsInsideChart = internalBox.left >= chartLeft &&
                    internalBox.right <= chartRight &&
                    internalBox.top >= 6 &&
                    internalBox.bottom <= cssHeight - 6;
                const hasInternalSpace = angleSize >= 0.22 &&
                    arcLength >= textWidth + 4 &&
                    radialWidth >= 14;

                if (fitsInsideChart && hasInternalSpace && !overlaps(internalBox, internalBoxes)) {
                    internalBoxes.push(internalBox);
                    drawText(text, internalX, internalY);
                    return;
                }

                const side = cos >= 0 ? "right" : "left";
                const boxWidth = textWidth + labelPadX * 2;
                const baseX = side === "right"
                    ? Math.min(chartRight - boxWidth, cx + outerRadius + 18)
                    : Math.max(chartLeft, cx - outerRadius - 18 - boxWidth);
                externalLabels.push({
                    text,
                    side,
                    boxWidth,
                    boxX: baseX,
                    y: cy + sin * (outerRadius + 14),
                    anchorX: cx + cos * outerRadius,
                    anchorY: cy + sin * outerRadius,
                    elbowX: cx + cos * (outerRadius + 11),
                    elbowY: cy + sin * (outerRadius + 11)
                });
            });

            const adjustExternalLabels = items => {
                const sorted = items.sort((a, b) => a.y - b.y);
                const minY = labelHeight / 2 + 6;
                const maxY = cssHeight - labelHeight / 2 - 6;
                const gap = labelHeight + 2;

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

            ctx.strokeStyle = connectorColor;
            ctx.lineWidth = 1;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.textBaseline = "middle";
            ctx.font = `700 ${fontSize}px Arial, sans-serif`;

            externalLabels.forEach(item => {
                const boxY = item.y - labelHeight / 2;
                const lineEndX = item.side === "right" ? item.boxX - 3 : item.boxX + item.boxWidth + 3;

                ctx.beginPath();
                ctx.moveTo(item.anchorX, item.anchorY);
                ctx.lineTo(item.elbowX, item.elbowY);
                ctx.lineTo(lineEndX, item.y);
                ctx.stroke();

                ctx.beginPath();
                ctx.arc(item.anchorX, item.anchorY, 1.2, 0, Math.PI * 2);
                ctx.fillStyle = textColor;
                ctx.fill();

                ctx.fillStyle = labelBg;
                ctx.strokeStyle = labelStroke;
                roundRect(item.boxX, boxY, item.boxWidth, labelHeight, 5);
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = textColor;
                ctx.textAlign = "left";
                ctx.fillText(item.text, item.boxX + labelPadX, item.y);

                ctx.strokeStyle = connectorColor;
            });

            ctx.restore();
        }

        function updateZonificacionRuralChartEmptyMessage(chart, isEmpty) {
            const canvas = chart?.canvas || document.getElementById("chart");
            if (!canvas) return;

            const rect = canvas.getBoundingClientRect?.() || {};
            updateOrdenamientoCanvasEmptyMessage(canvas, isEmpty, {
                attr: "data-zr-empty-msg",
                width: rect.width || canvas.clientWidth || 320,
                height: rect.height || canvas.clientHeight || 260,
                hideCanvas: true
            });
        }

        function renderAreasActividadCanvasChart(items, config) {
            const canvas = document.getElementById("chart");
            if (!canvas?.getContext) return;

            showOrdenamientoChartCanvas();
            document.getElementById("chartHighlightOverlay")?.remove();
            canvas.classList.remove("chart-canvas--pie-like");
            canvas.classList.add("chart-canvas--ordenamiento-adaptive");
            const chartCard = canvas.closest(".chart-card");
            chartCard?.classList.remove("chart-card--pie-like");
            chartCard?.classList.add("chart-card--ordenamiento-adaptive");
            chartCard?.classList.add("chart-card--areas-activity");
            if (chartInstance) {
                chartInstance.destroy();
                chartInstance = null;
            }

            const rect = canvas.getBoundingClientRect();
            const cssWidth = Math.max(320, Math.floor(rect.width || canvas.clientWidth || 360));
            const activeFilters = window.__aa_active_filters instanceof Set
                ? window.__aa_active_filters
                : new Set(items.map(item => String(item.code)));
            const chartItems = items.filter(item => activeFilters.has(String(item.code)));
            const legendItems = window.__aa_all_items?.length ? window.__aa_all_items : items;
            const adaptiveLayout = getOrdenamientoAdaptiveChartLayout(legendItems.length);
            const legendColumns = cssWidth >= 560 ? 3 : cssWidth >= 380 ? 2 : 1;
            const legendRowHeight = 20;
            const legendRows = Math.max(1, Math.ceil(Math.max(legendItems.length, 1) / legendColumns));
            const legendAreaHeight = legendRows * legendRowHeight + 20;
            const cssHeight = Math.min(
                adaptiveLayout.max,
                Math.max(adaptiveLayout.min, adaptiveLayout.size, 220 + legendAreaHeight)
            );
            const dpr = window.devicePixelRatio || 1;

            canvas.style.display = "block";
            canvas.style.visibility = "visible";
            canvas.style.opacity = "1";
            canvas.style.setProperty("--ordenamiento-chart-size", `${cssHeight}px`);
            canvas.style.height = `${cssHeight}px`;
            canvas.width = Math.round(cssWidth * dpr);
            canvas.height = Math.round(cssHeight * dpr);

            const ctx = canvas.getContext("2d");
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, cssWidth, cssHeight);

            const isUserDisabledEmpty = Boolean(legendItems.length && chartItems.length === 0);

            const total = chartItems.reduce((sum, item) => sum + Number(item.value || 0), 0) || 1;
            const chartAreaHeight = Math.max(180, cssHeight - legendAreaHeight);
            const cx = cssWidth * 0.5;
            const cy = chartAreaHeight * 0.52;
            const outerRadius = Math.max(86, Math.min(cssWidth * 0.39, chartAreaHeight * 0.46));
            const innerRadius = outerRadius * (adaptiveLayout.cutout / 100);
            let start = -Math.PI / 2;
            const slices = [];

            chartItems.forEach(item => {
                const value = Number(item.value || 0);
                const angle = (value / total) * Math.PI * 2;
                const end = start + angle;

                ctx.beginPath();
                ctx.arc(cx, cy, outerRadius, start, end);
                ctx.arc(cx, cy, innerRadius, end, start, true);
                ctx.closePath();
                ctx.fillStyle = String(item.color || "#BDBDBD");
                ctx.fill();
                ctx.lineWidth = Number(item.borderWidth || 1);
                ctx.strokeStyle = String(item.borderColor || "rgba(0,0,0,0)");
                ctx.stroke();

                const normalizedCode = normalizeAreaActividadCode(item.code, layerGlobal);
                if (normalizedCode && normalizedCode === areasActividadChartHighlightedCode) {
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(cx, cy, outerRadius - 3, start, end);
                    ctx.arc(cx, cy, innerRadius + 3, end, start, true);
                    ctx.closePath();
                    ctx.lineWidth = 3.5;
                    ctx.strokeStyle = "#5B2EFF";
                    ctx.lineJoin = "round";
                    ctx.stroke();
                    ctx.restore();
                }

                slices.push({ start, end, item });
                start = end;
            });

            updateAreasActividadChartEmptyMessage(canvas, isUserDisabledEmpty, {
                left: 0,
                top: 0,
                width: Math.max(1, cssWidth),
                height: chartAreaHeight
            });

            drawAreasActividadSliceLabels(ctx, {
                slices,
                total,
                cx,
                cy,
                innerRadius,
                outerRadius,
                cssWidth,
                cssHeight: chartAreaHeight,
                legendWidth: 0
            });

            const chartDescription = chartItems.map(item => {
                const paletteItem = buildAreaActividadItem(item.code, Number(item.value || 0));
                const percent = total ? (Number(item.value || 0) / total) * 100 : 0;
                return `${paletteItem.label}: ${formatOrdenamientoPiePercentLabel(percent)}`;
            }).join("; ");
            canvas.setAttribute(
                "aria-label",
                chartDescription
                    ? `Distribucion de areas de actividad. ${chartDescription}`
                    : "Distribucion de areas de actividad sin categorias activas."
            );

            const legendTop = chartAreaHeight + 12;
            const legendHits = [];
            ctx.font = "11px Arial, sans-serif";
            ctx.textBaseline = "middle";
            const legendEntries = legendItems.map(item => {
                const code = String(item.code);
                const paletteItem = buildAreaActividadItem(code, Number(item.value || 0));
                const labelText = String(paletteItem.label || code);
                return {
                    code,
                    paletteItem,
                    labelText,
                    width: Math.min(cssWidth - 28, 18 + ctx.measureText(labelText).width + 16)
                };
            });
            const legendRowsData = [];
            legendEntries.forEach((entry, index) => {
                const row = Math.floor(index / legendColumns);
                if (!legendRowsData[row]) legendRowsData[row] = [];
                legendRowsData[row].push(entry);
            });

            legendRowsData.forEach((rowItems, row) => {
                const legendY = legendTop + row * legendRowHeight;
                const gap = rowItems.length > 1 ? 18 : 0;
                const rowWidth = rowItems.reduce((sum, entry) => sum + entry.width, 0) + gap * Math.max(0, rowItems.length - 1);
                let legendX = Math.max(14, (cssWidth - rowWidth) / 2);

                rowItems.forEach(entry => {
                    const isActive = activeFilters.has(entry.code);
                    const labelX = legendX + 18;
                    const rowTop = legendY - 10;

                    ctx.save();
                    ctx.globalAlpha = isActive ? 1 : 0.35;
                    ctx.fillStyle = String(entry.paletteItem.color || "#BDBDBD");
                    ctx.fillRect(legendX, legendY - 6, 12, 12);
                    ctx.strokeStyle = String(entry.paletteItem.borderColor || "#666666");
                    ctx.lineWidth = Number(entry.paletteItem.borderWidth ?? 0.3);
                    ctx.strokeRect(legendX, legendY - 6, 12, 12);
                    ctx.fillStyle = "#666";
                    ctx.fillText(entry.labelText, labelX, legendY);
                    if (!isActive) {
                        const textWidth = ctx.measureText(entry.labelText).width;
                        ctx.beginPath();
                        ctx.strokeStyle = "#666";
                        ctx.lineWidth = 1;
                        ctx.moveTo(labelX, legendY);
                        ctx.lineTo(labelX + textWidth, legendY);
                        ctx.stroke();
                    }
                    ctx.restore();

                    legendHits.push({
                        code: entry.code,
                        x: legendX,
                        y: rowTop,
                        width: entry.width,
                        height: legendRowHeight
                    });

                    legendX += entry.width + gap;
                });
            });

            areasActividadCanvasChartState = {
                items: chartItems,
                legendItems,
                legendHits,
                slices,
                cx,
                cy,
                innerRadius,
                outerRadius,
                config
            };
            canvas.__aaItems = chartItems;
            canvas.onclick = async event => {
                const state = areasActividadCanvasChartState;
                if (!state) return;

                const bounds = canvas.getBoundingClientRect();
                const x = event.clientX - bounds.left;
                const y = event.clientY - bounds.top;

                const legendHit = (state.legendHits || []).find(entry =>
                    x >= entry.x &&
                    x <= entry.x + entry.width &&
                    y >= entry.y &&
                    y <= entry.y + entry.height
                );

                if (legendHit) {
                    const code = String(legendHit.code);
                    const wasActive = window.__aa_active_filters?.has(code);
                    if (wasActive && String(window.__aa_selected_code || "") === code) {
                        seleccionarCategoriaAreasActividad(null);
                    }
                    await toggleAreaActividadCategory(code);
                    return;
                }

                const dx = x - state.cx;
                const dy = y - state.cy;
                const radius = Math.sqrt(dx * dx + dy * dy);
                if (radius < state.innerRadius || radius > state.outerRadius) return;

                let angle = Math.atan2(dy, dx);
                if (angle < -Math.PI / 2) angle += Math.PI * 2;
                const selected = state.slices.find(slice => angle >= slice.start && angle <= slice.end)?.item;
                if (!selected) return;

                window.__aa_active_filters = new Set([String(selected.code)]);
                seleccionarCategoriaAreasActividad(null, { highlightChart: false });
                await aplicarFiltroAreasActividadDesdeLeyenda();
                const normativaCode = getNormativaUseCodeAreasActividad(selected);
                await actualizarResumenAreasActividad(state.config, normativaCode);
            };
            canvas.onmousemove = event => {
                const state = areasActividadCanvasChartState;
                if (!state) return;

                const bounds = canvas.getBoundingClientRect();
                const x = event.clientX - bounds.left;
                const y = event.clientY - bounds.top;
                const overLegend = (state.legendHits || []).some(entry =>
                    x >= entry.x &&
                    x <= entry.x + entry.width &&
                    y >= entry.y &&
                    y <= entry.y + entry.height
                );
                canvas.style.cursor = overLegend ? "pointer" : "default";
            };
            canvas.onmouseleave = () => {
                canvas.style.cursor = "default";
            };
            canvas.ondblclick = async event => {
                const state = areasActividadCanvasChartState;
                if (!state) return;

                const bounds = canvas.getBoundingClientRect();
                const x = event.clientX - bounds.left;
                const y = event.clientY - bounds.top;
                const dx = x - state.cx;
                const dy = y - state.cy;
                const radius = Math.sqrt(dx * dx + dy * dy);
                if (radius >= state.innerRadius && radius <= state.outerRadius) return;
                await restaurarAreasActividadLegend();
            };
        }

        function bindAreasActividadMapClickFallback() {
            if (window.__aa_map_click_fallback_bound) return;
            window.__aa_map_click_fallback_bound = true;

            const isAreasActividadMapUiClick = target => {
                if (!target || typeof target.closest !== "function") return false;
                return Boolean(target.closest([
                    "#mapLegend",
                    "#legendContent",
                    ".legend-item",
                    ".legend-toggle",
                    "#overviewDiv",
                    "#overviewMap",
                    "#mapTools",
                    "#basemapPanel",
                    "#zoomSliderContainer",
                    ".esri-ui",
                    ".esri-widget",
                    ".esri-popup",
                    ".esri-attribution",
                    ".esri-scale-bar",
                    ".esri-component"
                ].join(",")));
            };

            const handleMapDomClick = async (event) => {
                const mapDivNode = document.getElementById("mapDiv");
                if (!mapDivNode || !mapDivNode.contains(event.target)) return;
                if (isAreasActividadMapUiClick(event.target)) return;

                const rect = mapDivNode.getBoundingClientRect();
                if (
                    event.clientX < rect.left ||
                    event.clientX > rect.right ||
                    event.clientY < rect.top ||
                    event.clientY > rect.bottom
                ) {
                    return;
                }

                await manejarClickMapaAreasActividad({
                    x: event.clientX - rect.left,
                    y: event.clientY - rect.top,
                    button: event.button,
                    source: `dom-${event.type}`
                });
                await manejarClickMapaZonificacionRural({
                    x: event.clientX - rect.left,
                    y: event.clientY - rect.top,
                    button: event.button,
                    source: `dom-${event.type}`
                });
            };

            document.addEventListener("click", handleMapDomClick, true);
        }

        async function manejarClickMapaAreasActividad(event) {
            currentOrdenamientoTab = AppState.currentOrdenamientoTab || currentOrdenamientoTab;
            const activeLayer = layerGlobal || AppState.layerGlobal;
            const isAreasActividad = currentOrdenamientoTab === "AREAS_ACTIVIDAD";

            if (
                !isAreasActividad ||
                !activeLayer ||
                activeLayer.destroyed ||
                !view
            ) {
                return;
            }

            if (event?.button != null && event.button !== 0) {
                return;
            }

            try {
                const config = ORDENAMIENTO_CONFIG.AREAS_ACTIVIDAD;
                const useField = config.useField || "Uso_Principal";
                const rawUseCode = await obtenerCodigoAreasActividadDesdeClick(event, config, activeLayer);
                const useCode = normalizeAreaActividadCode(rawUseCode, activeLayer, useField);

                if (useCode === null || useCode === undefined || String(useCode).trim() === "") {
                    return;
                }

                const now = Date.now();
                if (now - lastAreasMapClickAt < 350) return;
                lastAreasMapClickAt = now;

                seleccionarCategoriaAreasActividad(useCode, { temporaryMs: 2200 });
                const titleElement = document.getElementById("chartTitle");
                if (titleElement) {
                    titleElement.textContent = `${buildOrdenamientoChartTitle("Distribución de áreas de actividad")} - ${buildAreaActividadItem(useCode).label}`;
                }
                await actualizarResumenAreasActividad(config, useCode);

            } catch (e) {
                console.warn("Error en click de mapa para Áreas de actividad:", e);
            }
        }

        async function manejarClickMapaZonificacionRural(event) {
            currentOrdenamientoTab = AppState.currentOrdenamientoTab || currentOrdenamientoTab;
            if (currentOrdenamientoTab !== "ZONIFICACION_RURAL") return;

            const activeLayer = layerGlobal || AppState.layerGlobal;
            if (!activeLayer || activeLayer.destroyed || !view) return;
            if (event?.button != null && event.button !== 0) return;

            const config = ORDENAMIENTO_CONFIG.ZONIFICACION_RURAL;
            const field = getZonificacionRuralActiveField(config);
            const readCode = attrs => {
                if (!attrs) return null;
                if (attrs[field] !== null && attrs[field] !== undefined) return attrs[field];
                const key = Object.keys(attrs).find(k => k.toLowerCase() === String(field).toLowerCase());
                return key ? attrs[key] : null;
            };

            const screenPoint = { x: event?.x, y: event?.y };
            if (screenPoint.x == null || screenPoint.y == null) return;

            try {
                const hit = await view.hitTest(event, { include: activeLayer });
                const graphicHit = (hit?.results || []).find(result => result?.graphic?.layer === activeLayer);
                const hitCode = readCode(graphicHit?.graphic?.attributes);
                if (hitCode !== null && hitCode !== undefined && String(hitCode).trim() !== "") {
                    await selectZonificacionRuralFromCode(hitCode, { temporaryMs: 2200 });
                    return;
                }
            } catch (_) { }

            try {
                const mapPoint = event.mapPoint || view.toMap(screenPoint);
                if (!mapPoint || !activeLayer.createQuery) return;

                const query = activeLayer.createQuery();
                query.geometry = mapPoint;
                query.distance = Math.max(Number(view.resolution || 0) * 24, 120);
                query.units = "meters";
                query.spatialRelationship = "intersects";
                query.where = activeLayer.definitionExpression || window.__legendState?.baseWhere || "1=1";
                query.returnGeometry = false;
                query.outFields = [field];
                query.num = 5;

                const result = await activeLayer.queryFeatures(query);
                for (const feature of result?.features || []) {
                    const code = readCode(feature.attributes);
                    if (code !== null && code !== undefined && String(code).trim() !== "") {
                        await selectZonificacionRuralFromCode(code, { temporaryMs: 2200 });
                        return;
                    }
                }
            } catch (e) {
                console.warn("Zonificación rural: no se pudo identificar categoría en el clic:", e);
            }
        }

        async function obtenerCodigoAreasActividadDesdeClick(event, config, activeLayer = layerGlobal || AppState.layerGlobal) {
            const useField = config.useField || "Uso_Principal";
            const readUseCode = attrs => {
                if (!attrs) return null;
                if (attrs[useField] !== null && attrs[useField] !== undefined) return attrs[useField];
                const key = Object.keys(attrs).find(k => k.toLowerCase() === String(useField).toLowerCase());
                return key ? attrs[key] : null;
            };

            const readCodeFromGraphic = graphic => {
                const code = readUseCode(graphic?.attributes);
                return code === null || code === undefined || String(code).trim() === "" ? null : code;
            };

            if (!activeLayer || activeLayer.destroyed || !view) return null;

            const screenPoint = {
                x: event?.x,
                y: event?.y
            };
            if (screenPoint.x == null || screenPoint.y == null) {
                return null;
            }

            try {
                const layerView = await view.whenLayerView(activeLayer);
                if (layerView?.hitTest) {
                    const layerViewHit = await layerView.hitTest(screenPoint);
                    const layerViewGraphic = layerViewHit?.graphic
                        || layerViewHit?.results?.[0]?.graphic;
                    const layerViewCode = readCodeFromGraphic(layerViewGraphic);
                    if (layerViewCode != null) return layerViewCode;
                }
            } catch (_) { }

            try {
                const hit = await view.hitTest(event, { include: activeLayer });
                const graphicHit = (hit?.results || []).find(result => result?.graphic?.layer === activeLayer);
                const hitCode = readCodeFromGraphic(graphicHit?.graphic);
                if (hitCode != null) return hitCode;
            } catch (_) { }

            try {
                const hit = await view.hitTest(event);
                const graphicHit = (hit?.results || []).find(result => {
                    const code = readCodeFromGraphic(result?.graphic);
                    if (code == null) return false;
                    const hitLayer = result?.graphic?.layer;
                    return hitLayer === activeLayer || hitLayer?.url === activeLayer?.url;
                });
                const genericHitCode = readCodeFromGraphic(graphicHit?.graphic);
                if (genericHitCode != null) return genericHitCode;
            } catch (_) { }

            try {
                const mapPoint = event.mapPoint || view.toMap(screenPoint);
                if (!mapPoint || !activeLayer.createQuery) return null;

                const query = activeLayer.createQuery();
                query.geometry = mapPoint;
                query.distance = Math.max(Number(view.resolution || 0) * 24, 120);
                query.units = "meters";
                query.spatialRelationship = "intersects";
                query.where = activeLayer.definitionExpression || window.__aa_base_where || "1=1";
                query.returnGeometry = false;
                query.outFields = ["*", useField];
                query.num = 5;

                const result = await activeLayer.queryFeatures(query);
                for (const feature of result?.features || []) {
                    const code = readCodeFromGraphic(feature);
                    if (code != null) return code;
                }
            } catch (e) {
                console.warn("Áreas de actividad: consulta espacial falló:", e);
            }

            return null;
        }

        async function resaltarCategoriaAreasActividadEnMapa(useCode, activeLayer = layerGlobal || AppState.layerGlobal) {
            if (!activeLayer || activeLayer.destroyed || !view) return;

            const config = ORDENAMIENTO_CONFIG.AREAS_ACTIVIDAD;
            const useField = config?.useField || "Uso_Principal";
            const normalizedCode = normalizeAreaActividadCode(useCode, activeLayer, useField);
            if (!normalizedCode) return;

            clearHighlight();

            const baseWhere = activeLayer.definitionExpression || window.__aa_base_where || "1=1";
            const where = andWhere(baseWhere, sqlEqualsNumber(useField, normalizedCode));

            try {
                const layerView = await ensureLayerView(activeLayer);
                if (!layerView) return;

                const oids = await activeLayer.queryObjectIds({ where });
                if (!oids?.length) return;

                highlightHandle = layerView.highlight(oids);
                syncStateFromGlobals();
            } catch (e) {
                console.warn("Áreas de actividad: no se pudo resaltar el mapa:", e);
            }
        }

        function getAreasActividadChartCodes(dataset) {
            if (Array.isArray(dataset?.codes) && dataset.codes.length) {
                return dataset.codes.map(code => String(code));
            }
            if (areasActividadChartCodes.length) {
                return areasActividadChartCodes;
            }
            return (chartInstance?.$areasActividadCodes || []).map(code => String(code));
        }

        function clearAreaActividadChartHighlight() {
            const overlay = document.getElementById("chartHighlightOverlay");
            if (overlay) {
                overlay.remove();
            }

            const dataset = chartInstance?.data?.datasets?.[0];
            const codes = getAreasActividadChartCodes(dataset);

            if (!dataset || !Array.isArray(codes) || !codes.length) {
                areasActividadChartHighlightedCode = null;
                if (areasActividadCanvasChartState?.items?.length) {
                    renderAreasActividadCanvasChart(areasActividadCanvasChartState.items, areasActividadCanvasChartState.config);
                }
                return;
            }

            areasActividadChartHighlightedCode = null;
            dataset.borderAlign = "inner";
            dataset.hoverOffset = 0;
            dataset.offset = 0;
            chartInstance.update?.("none");
        }

        function resaltarCategoriaAreasActividadEnGrafica(useCode) {
            if (!chartInstance && areasActividadCanvasChartState?.items?.length) {
                const normalizedCanvasCode = normalizeAreaActividadCode(useCode, layerGlobal);
                areasActividadChartHighlightedCode = normalizedCanvasCode;
                renderAreasActividadCanvasChart(areasActividadCanvasChartState.items, areasActividadCanvasChartState.config);
                return;
            }

            if (!chartInstance) return;

            const dataset = chartInstance.data?.datasets?.[0];
            const codes = getAreasActividadChartCodes(dataset);
            if (!dataset || !Array.isArray(codes) || !codes.length) return;

            const normalizedCode = normalizeAreaActividadCode(useCode, layerGlobal);
            const idx = codes.findIndex(code =>
                normalizeAreaActividadCode(code, layerGlobal) === normalizedCode
            );
            if (idx === -1) {
                console.warn("Áreas de actividad: la categoría clicada no está en el gráfico activo.", {
                    clicked: useCode,
                    normalized: normalizedCode,
                    chartCodes: codes
                });
                return;
            }

            areasActividadChartHighlightedCode = normalizedCode;
            dataset.borderAlign = "inner";
            dataset.hoverOffset = 0;
            dataset.offset = 0;
            chartInstance.update?.("none");
        }

        function actualizarEstadoLeyendaAreasActividad() {
            const content = document.getElementById("legendContent");
            if (!content) return;

            const activeCodes = window.__aa_active_filters instanceof Set
                ? window.__aa_active_filters
                : new Set();
            const selectedCode = window.__aa_selected_code != null
                ? String(window.__aa_selected_code)
                : null;

            content.querySelectorAll(".legend-item[data-code]").forEach(row => {
                const code = String(row.dataset.code || "");
                const isActive = activeCodes.has(code);
                const isSelected = selectedCode === code;

                row.classList.toggle("active", isActive);
                row.classList.toggle("selected", isSelected);
                row.style.opacity = isActive ? "1" : "0.35";
                row.style.background = isSelected ? "rgba(0, 121, 193, 0.10)" : "transparent";
                row.style.outline = isSelected ? "1px solid rgba(0, 121, 193, 0.45)" : "none";
                row.style.borderRadius = "4px";
                row.style.padding = "2px 4px";
            });
        }

        function seleccionarCategoriaAreasActividad(code, options = {}) {
            const safeCode = code === null || code === undefined ? null : String(code);
            window.__aa_selected_code = safeCode;

            if (areasActividadSelectionTimer) {
                clearTimeout(areasActividadSelectionTimer);
                areasActividadSelectionTimer = null;
            }

            if (safeCode && options.highlightChart !== false) {
                if (typeof chartInstance?.setActiveElements === "function") {
                    chartInstance.setActiveElements([]);
                }
                if (chartInstance?.tooltip?.setActiveElements) {
                    chartInstance.tooltip.setActiveElements([], { x: 0, y: 0 });
                }
                resaltarCategoriaAreasActividadEnGrafica(safeCode);
                resaltarCategoriaAreasActividadEnMapa(safeCode);
            } else if (!safeCode) {
                clearHighlight();
                if (chartInstance?.data?.datasets?.[0]) {
                    clearAreaActividadChartHighlight();
                }
            }

            actualizarEstadoLeyendaAreasActividad();

            const temporaryMs = Number(options.temporaryMs || 0);
            if (safeCode && temporaryMs > 0) {
                const token = ++areasActividadSelectionToken;
                areasActividadSelectionTimer = setTimeout(() => {
                    if (token !== areasActividadSelectionToken) return;
                    window.__aa_selected_code = null;
                    clearHighlight();
                    clearAreaActividadChartHighlight();
                    actualizarEstadoLeyendaAreasActividad();

                    const titleElement = document.getElementById("chartTitle");
                    if (titleElement) {
                        titleElement.textContent = buildOrdenamientoChartTitle("Distribución de áreas de actividad");
                    }
                    areasActividadSelectionTimer = null;
                }, temporaryMs);
            }
        }

        async function zoomMapaZonificacionRural(useCode = null, categoryCode = null) {
            const layer = layerGlobal;

            if (!layer || !view) {
                console.warn("No hay layerGlobal o view disponible para zonificación rural");
                return;
            }

            const config = ORDENAMIENTO_CONFIG[currentOrdenamientoTab];
            if (!config) return;

            const filterField = config.filterField || "Mp_Codigo";
            const useField = config.useField || "Uso_Principal";
            const categoryField = config.categoryField || "Tipo_Categoria_Rural";

            const clauses = [];

            // filtro territorial actual
            if (municipioActual) {
                clauses.push(`${filterField} = '${String(municipioActual).replace(/'/g, "''")}'`);
            }

            // filtro por uso principal
            if (useCode !== null && useCode !== undefined && String(useCode).trim() !== "") {
                const safeUse = String(useCode).trim();
                const isNumUse = /^-?\d+(\.\d+)?$/.test(safeUse);
                clauses.push(
                    isNumUse
                        ? `${useField} = ${safeUse}`
                        : `${useField} = '${safeUse.replace(/'/g, "''")}'`
                );
            }

            // filtro por categoría rural
            if (categoryCode !== null && categoryCode !== undefined && String(categoryCode).trim() !== "") {
                const safeCat = String(categoryCode).trim();
                const isNumCat = /^-?\d+(\.\d+)?$/.test(safeCat);
                clauses.push(
                    isNumCat
                        ? `${categoryField} = ${safeCat}`
                        : `${categoryField} = '${safeCat.replace(/'/g, "''")}'`
                );
            }

            const whereZoom = clauses.length ? clauses.join(" AND ") : "1=1";

            // importante: dejar filtrado el mapa al dar clic
            layer.definitionExpression = whereZoom;

            try {
                const q = layer.createQuery();
                q.where = whereZoom;
                q.returnGeometry = false;

                const result = await layer.queryExtent(q);

                if (result?.extent) {
                    await view.goTo(result.extent.expand(1.25), {
                        duration: 1000,
                        easing: "ease-in-out"
                    });
                }
            } catch (err) {
                console.warn("No se pudo hacer zoom en zonificación rural:", err);
            }
        }

        function getZonificacionRuralActiveField(config = ORDENAMIENTO_CONFIG.ZONIFICACION_RURAL) {
            return currentRuralChartView === "CATEGORIA"
                ? (config?.categoryField || "Tipo_Categoria_Rural")
                : (config?.useField || "Uso_Principal");
        }

        function clearZonificacionRuralSelection() {
            if (zonificacionRuralSelectionTimer) {
                clearTimeout(zonificacionRuralSelectionTimer);
                zonificacionRuralSelectionTimer = null;
            }

            clearHighlight();

            if (chartInstance?.data?.datasets?.[0]) {
                const dataset = chartInstance.data.datasets[0];
                const codes = Array.isArray(dataset.codes) ? dataset.codes.map(code => String(code)) : [];
                dataset.borderColor = codes.map(code => {
                    const item = currentRuralChartView === "CATEGORIA"
                        ? buildRuralCategoriaItem(code, 0, layerGlobal, getZonificacionRuralActiveField())
                        : buildRuralUseItem(code, 0);
                    return item.borderColor;
                });
                dataset.borderWidth = codes.map(code => {
                    const item = currentRuralChartView === "CATEGORIA"
                        ? buildRuralCategoriaItem(code, 0, layerGlobal, getZonificacionRuralActiveField())
                        : buildRuralUseItem(code, 0);
                    return Number(item.borderWidth || 0);
                });
                dataset.offset = codes.map(() => 0);
                dataset.hoverOffset = 0;
                chartInstance.update?.("none");
            }

            document.querySelectorAll("#legendContent .legend-item.selected").forEach(row => {
                row.classList.remove("selected");
                row.style.background = "transparent";
                row.style.outline = "none";
            });

            const titleElement = document.getElementById("chartTitle");
            if (titleElement && currentOrdenamientoTab === "ZONIFICACION_RURAL") {
                const baseTitle = currentRuralChartView === "CATEGORIA"
                    ? "Distribución de categorías de zonificación rural"
                    : "Distribución del uso principal de la zonificación rural";
                titleElement.textContent = buildOrdenamientoChartTitle(baseTitle);
            }
        }

        async function selectZonificacionRuralFromCode(code, options = {}) {
            const config = ORDENAMIENTO_CONFIG.ZONIFICACION_RURAL;
            const safeCode = String(code ?? "").trim();
            if (!safeCode) return;

            if (zonificacionRuralSelectionTimer) {
                clearTimeout(zonificacionRuralSelectionTimer);
                zonificacionRuralSelectionTimer = null;
            }

            const field = getZonificacionRuralActiveField(config);
            const item = currentRuralChartView === "CATEGORIA"
                ? buildRuralCategoriaItem(safeCode, 0, layerGlobal, field)
                : buildRuralUseItem(safeCode, 0);

            if (chartInstance?.data?.datasets?.[0]) {
                const dataset = chartInstance.data.datasets[0];
                const codes = Array.isArray(dataset.codes) ? dataset.codes.map(value => String(value)) : [];
                dataset.borderColor = codes.map(value => String(value) === safeCode ? "#5B2EFF" : (
                    currentRuralChartView === "CATEGORIA"
                        ? buildRuralCategoriaItem(value, 0, layerGlobal, field).borderColor
                        : buildRuralUseItem(value, 0).borderColor
                ));
                dataset.borderWidth = codes.map(value => String(value) === safeCode ? 3 : (
                    currentRuralChartView === "CATEGORIA"
                        ? Number(buildRuralCategoriaItem(value, 0, layerGlobal, field).borderWidth || 0)
                        : Number(buildRuralUseItem(value, 0).borderWidth || 0)
                ));
                dataset.offset = codes.map(() => 0);
                dataset.hoverOffset = 0;
                chartInstance.update?.("none");
            }

            document.querySelectorAll("#legendContent .legend-item[data-code]").forEach(row => {
                const selected = String(row.dataset.code || "") === safeCode;
                row.classList.toggle("selected", selected);
                row.style.background = selected ? "rgba(0, 121, 193, 0.10)" : "transparent";
                row.style.outline = selected ? "1px solid rgba(0, 121, 193, 0.45)" : "none";
            });

            const titleElement = document.getElementById("chartTitle");
            if (titleElement) {
                const baseTitle = currentRuralChartView === "CATEGORIA"
                    ? "Distribución de categorías de zonificación rural"
                    : "Distribución del uso principal de la zonificación rural";
                titleElement.textContent = `${buildOrdenamientoChartTitle(baseTitle)} - ${item.label}`;
            }

            if (options.highlightMap !== false) {
                const valueWhere = /^-?\d+(\.\d+)?$/.test(safeCode)
                    ? `${field} = ${safeCode}`
                    : `${field} = '${safeCode.replace(/'/g, "''")}'`;
                const baseWhere = layerGlobal?.definitionExpression || window.__legendState?.baseWhere || "1=1";
                try {
                    const layerView = await ensureLayerView(layerGlobal);
                    if (layerView && layerGlobal?.queryObjectIds) {
                        const oids = await layerGlobal.queryObjectIds({ where: andWhere(baseWhere, valueWhere) });
                        clearHighlight();
                        if (oids?.length) {
                            highlightHandle = layerView.highlight(oids);
                            syncStateFromGlobals();
                        }
                    }
                } catch (e) {
                    console.warn("No se pudo resaltar zonificación rural:", e);
                }
            }

            const temporaryMs = Number(options.temporaryMs || 0);
            if (temporaryMs > 0) {
                zonificacionRuralSelectionTimer = setTimeout(() => {
                    clearZonificacionRuralSelection();
                }, temporaryMs);
            }
        }

        async function zoomMapaClasificacionSuelo(typeCode = null) {
            const layer = layerGlobal;

            if (!layer || !view) {
                console.warn("No hay layerGlobal o view disponible para Clasificación del suelo");
                return;
            }

            const config = ORDENAMIENTO_CONFIG[currentOrdenamientoTab];
            if (!config) return;

            const filterField = config.filterField || "mpcodigo";
            const typeField = config.typeField || "Tipo_Clasificacion_Suelo";

            const clauses = [];

            if (municipioActual) {
                clauses.push(`${filterField} = '${String(municipioActual).replace(/'/g, "''")}'`);
            } else if (filtroNivel === "DEPTO" && deptoActual) {
                clauses.push(sqlStartsWith(filterField, deptoActual));
            }

            if (typeCode !== null && typeCode !== undefined) {
                clauses.push(`${typeField} = ${Number(typeCode)}`);
            }

            const where = clauses.length ? clauses.join(" AND ") : "1=1";

            applyClasificacionVisualWhere(where);

            try {
                if (hasClasificacionTerritoryFilter()) {
                    withTimeout(zoomClasificacionToTerritory(renderCycleId), 5000, false)
                        .catch(e => {
                            if (String(e?.name || "") !== "AbortError") {
                                console.warn("No se pudo hacer zoom en Clasificacion del suelo:", e);
                            }
                        });
                    return;
                }

                const q = layer.createQuery();
                q.where = where;
                q.returnGeometry = false;

                const extentResult = await layer.queryExtent(q);

                if (extentResult?.extent) {
                    await view.goTo(extentResult.extent.expand(1.2), {
                        duration: 1200,
                        easing: "ease-in-out"
                    });
                } else if (municipioActual || (filtroNivel === "DEPTO" && deptoActual)) {
                    await zoomClasificacionToTerritory(renderCycleId);
                }
                applyClasificacionVisualWhere(where);
            } catch (e) {
                console.warn("No se pudo hacer zoom en Clasificación del suelo:", e);
                await zoomClasificacionToTerritory(renderCycleId);
                applyClasificacionVisualWhere(where);
            }
        }

        async function zoomMapaAreasActividad(useCode = null) {
            const layer = layerGlobal;

            if (!layer || !view) {
                console.warn("No hay layerGlobal o view disponible para Áreas de actividad");
                return;
            }

            const config = ORDENAMIENTO_CONFIG[currentOrdenamientoTab];
            if (!config) return;

            const filterField = config.filterField || "Mp_codigo";
            const useField = config.useField || "Uso_Principal";

            const clauses = [];

            if (municipioActual) {
                clauses.push(`${filterField} = '${String(municipioActual).replace(/'/g, "''")}'`);
            }

            if (useCode !== null && useCode !== undefined) {
                clauses.push(`${useField} = ${Number(useCode)}`);
            }

            const where = clauses.length ? clauses.join(" AND ") : "1=1";

            layer.definitionExpression = where;

            try {
                const q = layer.createQuery();
                q.where = where;
                q.returnGeometry = false;

                const extentResult = await layer.queryExtent(q);

                if (extentResult?.extent) {
                    await view.goTo(extentResult.extent.expand(1.2), {
                        duration: 1200,
                        easing: "ease-in-out"
                    });
                }
            } catch (e) {
                console.warn("No se pudo hacer zoom en Áreas de actividad:", e);
            }
        }

        function applyLegendFilter() {
            const state = window.__legendState;
            if (!state || !state.layer || !state.field) return;

            if (state.isClasificacionSuelo) {
                scheduleClasificacionLegendMapFilter(state);
                return;
            }

            if (state.isVigencia) {
                applyVigenciaLegendFilter(state);
                return;
            }

            const codes = Array.from(state.activeCodes);
            // si no hay activos, apaga todo
            if (!codes.length) {
                state.layer.definitionExpression = "1=0";
                return;
            }

            // detectar si el campo es numérico
            const fieldInfo = (state.layer.fields || []).find(f => f.name === state.field);
            const fieldType = String(state.fieldType || fieldInfo?.type || "").toLowerCase();

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
                whereLegend = `(${state.field} IN (${nonNullValues.join(",")}) OR ${state.field} IS NULL)`;
            } else if (nonNullValues.length) {
                whereLegend = `${state.field} IN (${nonNullValues.join(",")})`;
            } else if (hasNull) {
                whereLegend = `${state.field} IS NULL`;
            } else {
                whereLegend = "1=0";
            }

            const baseWhere = state.baseWhere && state.baseWhere.trim() ? `(${state.baseWhere})` : "1=1";
            const finalWhere = `${baseWhere} AND (${whereLegend})`;

            state.layer.definitionExpression = finalWhere;
        }

        function syncZonificacionRuralChartWithLegend(state = window.__legendState) {
            if (
                currentOrdenamientoTab !== "ZONIFICACION_RURAL" ||
                !state?.activeCodes ||
                !chartInstance?.data?.datasets?.[0]
            ) {
                return;
            }

            const dataset = chartInstance.data.datasets[0];
            const allItems =
                Array.isArray(state.allItems) && state.allItems.length
                    ? state.allItems.map(normalizeZonificacionRuralChartItem)
                    : Array.isArray(chartInstance.$zrAllItems) && chartInstance.$zrAllItems.length
                        ? chartInstance.$zrAllItems.map(normalizeZonificacionRuralChartItem)
                        : Array.isArray(dataset.allItems) && dataset.allItems.length
                            ? dataset.allItems.map(normalizeZonificacionRuralChartItem)
                            : (Array.isArray(dataset.codes) ? dataset.codes.map(code => {
                                const item = currentRuralChartView === "CATEGORIA"
                                    ? buildRuralCategoriaItem(code, 0, layerGlobal, getZonificacionRuralActiveField())
                                    : buildRuralUseItem(code, 0);
                                return normalizeZonificacionRuralChartItem({ ...item, value: 0, code: String(code) });
                            }) : []);
            if (!allItems.length) return;

            const activeItems = allItems.filter(item => state.activeCodes.has(String(item.code)));
            const isEmpty = activeItems.length === 0;
            // No usar `...dataset`: el dataset es un objeto proxy de Chart.js y
            // copiar sus internos provoca recursión (_scriptable->_scriptable).
            // Construir un dataset limpio solo con las propiedades necesarias.
            const rebuiltDataset = {
                label: typeof dataset.label === "string" ? dataset.label : "%",
                data: activeItems.map(item => Number(Number(item.value || 0).toFixed(2))),
                backgroundColor: activeItems.map(item => String(item.color)),
                borderColor: activeItems.map(item => String(item.borderColor)),
                borderWidth: activeItems.map(item => Number(item.borderWidth || 0)),
                codes: activeItems.map(item => String(item.code)),
                empty: isEmpty
            };

            chartInstance.$zrAllItems = allItems.map(normalizeZonificacionRuralChartItem);
            chartInstance.data.labels = activeItems.map(item => item.label);
            chartInstance.data.datasets = [rebuiltDataset];
            chartInstance.update?.("none");
            updateZonificacionRuralChartEmptyMessage(chartInstance, isEmpty);
            if (isEmpty) {
                zonificacionRuralCanvasChartState = null;
                const canvas = chartInstance.canvas || document.getElementById("chart");
                if (canvas) canvas.__zrItems = [];
            } else {
                bindZonificacionRuralCanvasInteractions(activeItems, ORDENAMIENTO_CONFIG.ZONIFICACION_RURAL);
            }
        }

        function configureZonificacionRuralChartLegend(chart = chartInstance) {
            const dataset = chart?.data?.datasets?.[0];
            const allItems = Array.isArray(chart?.$zrAllItems) && chart.$zrAllItems.length
                ? chart.$zrAllItems.map(normalizeZonificacionRuralChartItem)
                : Array.isArray(dataset?.allItems)
                    ? dataset.allItems.map(normalizeZonificacionRuralChartItem)
                    : [];
            if (!chart || !allItems.length) return;

            // IMPORTANTE: no usar el patrón `x = x || {}` sobre chart.options.*,
            // porque reasigna el objeto proxy de Chart.js sobre sí mismo y provoca
            // recursión infinita (_scriptable->_scriptable / Maximum call stack).
            // Solo crear objetos cuando realmente falten y, si no, mutar hojas.
            if (!chart.options.plugins) chart.options.plugins = {};
            if (!chart.options.plugins.legend) chart.options.plugins.legend = {};
            if (!chart.options.plugins.legend.labels) chart.options.plugins.legend.labels = {};
            chart.options.plugins.legend.display = true;
            chart.options.plugins.legend.position = "bottom";
            chart.options.plugins.legend.labels.generateLabels = function () {
                const state = window.__legendState;
                const activeCodes = state?.activeCodes instanceof Set
                    ? state.activeCodes
                    : new Set(allItems.map(item => String(item.code)));

                return allItems.map((item, index) => {
                    const code = String(item.code);
                    const active = activeCodes.has(code);
                    const label = String(item.label || code);
                    return {
                        text: active ? label : withCombiningStrikethrough(label),
                        fillStyle: active ? item.color : toRgbaWithAlpha(item.color, 0.25),
                        strokeStyle: active ? item.borderColor : toRgbaWithAlpha(item.borderColor, 0.25),
                        lineWidth: Number(item.borderWidth || 0),
                        hidden: false,
                        datasetIndex: 0,
                        index,
                        code
                    };
                });
            };
            chart.options.plugins.legend.onClick = (_event, legendItem) => {
                const code = String(legendItem?.code ?? "");
                const state = window.__legendState;
                if (!code || !state?.activeCodes) return;

                if (state.activeCodes.has(code)) {
                    state.activeCodes.delete(code);
                } else {
                    state.activeCodes.add(code);
                }

                syncZonificacionRuralLegendDom(state);
                applyLegendFilter();
                syncZonificacionRuralChartWithLegend(state);
            };
        }

        function syncZonificacionRuralLegendDom(state = window.__legendState) {
            if (!state?.activeCodes) return;

            document.querySelectorAll("#legendContent .legend-item[data-code]").forEach(row => {
                const active = state.activeCodes.has(String(row.dataset.code || ""));
                row.classList.toggle("active", active);
                row.style.opacity = active ? "1" : "0.35";
            });
        }

        function applyZonificacionRuralSingleSelection(code) {
            const safeCode = String(code ?? "").trim();
            const state = window.__legendState;
            if (!safeCode || !state?.activeCodes) return;

            state.activeCodes = new Set([safeCode]);
            syncZonificacionRuralLegendDom(state);
            applyLegendFilter();
            syncZonificacionRuralChartWithLegend(state);
        }

        function restoreZonificacionRuralLegendFilter() {
            const state = window.__legendState;
            const dataset = chartInstance?.data?.datasets?.[0];
            const codes = Array.isArray(chartInstance?.$zrAllItems) && chartInstance.$zrAllItems.length
                ? chartInstance.$zrAllItems.map(item => String(item.code))
                : Array.isArray(dataset?.allItems) && dataset.allItems.length
                    ? dataset.allItems.map(item => String(item.code))
                    : (Array.isArray(dataset?.codes) ? dataset.codes.map(code => String(code)) : []);
            if (!state?.activeCodes || !codes.length) return;

            state.activeCodes = new Set(codes);
            syncZonificacionRuralLegendDom(state);
            applyLegendFilter();
            syncZonificacionRuralChartWithLegend(state);
            clearZonificacionRuralSelection();
        }

        function applyClasificacionLegendFilter(state, options = {}) {
            scheduleClasificacionLegendMapFilter(state, options);
        }

        function actualizarLeyendaOrdenamientoRural(titleText, items = [], baseWhereOverride = null) {
            const title = document.getElementById("legendTitle");
            const content = document.getElementById("legendContent");

            if (title) {
                title.textContent = titleText || "Leyenda";
            }

            if (!content) return;

            const config = ORDENAMIENTO_CONFIG[currentOrdenamientoTab] || {};
            const baseWhere = String(baseWhereOverride || "").trim()
                || buildWhereOrdenamientoForCurrentTerritory(config);

            if (!items.length) {
                content.innerHTML = "<p class='oot-js-ordenamiento-main-1'>Sin clases</p>";
                window.__legendState = {
                    allCodes: [],
                    activeCodes: new Set(),
                    allItems: [],
                    field: null,
                    fieldType: "",
                    layer: layerGlobal || window.activeFeatureLayer,
                    baseWhere
                };
                return;
            }

            const field = currentRuralChartView === "CATEGORIA"
                ? (config.categoryField || "Tipo_Categoria_Rural")
                : (config.useField || "Uso_Principal");
            const fieldInfo = (layerGlobal?.fields || []).find(
                f => String(f.name).toLowerCase() === String(field).toLowerCase()
            );

            window.__legendState = {
                allCodes: items.map(i => String(i.code)),
                activeCodes: new Set(items.map(i => String(i.code))),
                allItems: items.map(normalizeZonificacionRuralChartItem),
                field,
                fieldType: fieldInfo?.type || "",
                layer: layerGlobal || window.activeFeatureLayer,
                baseWhere
            };

            let html = "";

            items.forEach(item => {
                const code = String(item.code);
                const safeCode = escapeAttr(code);
                const paletteItem = currentRuralChartView === "CATEGORIA"
                    ? buildRuralCategoriaItem(code, Number(item.value || 0), layerGlobal, config.categoryField || "Tipo_Categoria_Rural")
                    : buildRuralUseItem(code, Number(item.value || 0));
                const color = paletteItem.color;
                const borderColor = paletteItem.borderColor;
                const borderWidth = Number(paletteItem.borderWidth || 0);

                html += `
                <div class="legend-item active oot-js-ordenamiento-main-11" data-code="${safeCode}">
                    <div class="legend-color"
                        data-legend-color="${color}" data-legend-border-width="${borderWidth}" data-legend-border-color="${borderColor}">
                    </div>
                    <div class="legend-label">${escapeHtml(paletteItem.label)}</div>
                </div>
            `;
            });

            content.innerHTML = html;

            content.querySelectorAll(".legend-color[data-legend-color]").forEach(el => {
                el.style.background = el.dataset.legendColor;
                el.style.border = el.dataset.legendBorderWidth + "px solid " + el.dataset.legendBorderColor;
            });

            content.querySelectorAll(".legend-item").forEach(el => {
                el.addEventListener("click", function (event) {
                    event.preventDefault();
                    event.stopPropagation();

                    const code = String(this.dataset.code);
                    const state = window.__legendState;

                    if (state.activeCodes.has(code)) {
                        state.activeCodes.delete(code);
                        this.classList.remove("active");
                        this.style.opacity = "0.35";
                    } else {
                        state.activeCodes.add(code);
                        this.classList.add("active");
                        this.style.opacity = "1";
                    }

                    applyLegendFilter();
                    syncZonificacionRuralChartWithLegend(state);
                });
            });
        }

        function actualizarLeyendaClasificacionSuelo(titleText, items = []) {
            const title = document.getElementById("legendTitle");
            const content = document.getElementById("legendContent");
            const config = ORDENAMIENTO_CONFIG.CLASIFICACION_SUELO;

            if (title) {
                title.textContent = titleText || "Leyenda";
            }

            if (!content) return;

            cancelClasificacionLegendFilter();
            content.innerHTML = "";

            if (!items.length) {
                clasificacionLegendLastSignature = "";
                content.innerHTML = "";
                content.__clasificacionLegendState = null;
                if (window.__legendState?.isClasificacionSuelo) {
                    window.__legendState = {
                        allCodes: [],
                        activeCodes: new Set(),
                        field: null,
                        layer: null,
                        isClasificacionSuelo: true
                    };
                }
                return;
            }

            const baseWhere = clasificacionBaseWhere || layerGlobal?.definitionExpression || getClasificacionVisualWhere("1=1");
            const legendState = {
                activeCodes: new Set(items.map(i => String(i.code))),
                allCodes: items.map(i => String(i.code)),
                field: config.typeField || "Tipo_Clasificacion_Suelo",
                layer: layerGlobal || window.activeFeatureLayer,
                baseWhere,
                fieldType: "integer",
                isClasificacionSuelo: true
            };
            window.__legendState = legendState;
            content.__clasificacionLegendState = legendState;
            // Las capas por categoría son una optimización: si fallan, NO deben
            // impedir que se dibuje la leyenda ni que se adjunten sus eventos.
            try {
                clasificacionLegendLastSignature = getClasificacionLegendFilter(legendState).signature;
                if (clasificacionCategoryModeActive) {
                    ensureClasificacionCategoryLayers(baseWhere, items, {
                        prewarm: false,
                        source: "legend-render-active"
                    });
                    applyClasificacionCategoryVisibility(legendState);
                } else {
                    scheduleClasificacionCategoryPrewarm(baseWhere, items, renderCycleId);
                }
            } catch (prewarmErr) {
                console.warn("Clasificación del suelo: no se pudo preparar capas por categoría (continúa la leyenda).", prewarmErr);
            }

            items.forEach(item => {
                const row = document.createElement("div");
                row.className = "legend-item active";
                row.dataset.code = String(item.code);
                row.setAttribute("role", "button");
                row.setAttribute("tabindex", "0");
                row.setAttribute("aria-pressed", "true");
                row.style.display = "flex";
                row.style.alignItems = "center";
                row.style.gap = "8px";
                row.style.marginBottom = "6px";
                row.style.color = "black";

                const swatch = document.createElement("span");
                swatch.className = "legend-color";
                swatch.style.display = "inline-block";
                swatch.style.width = "12px";
                swatch.style.height = "12px";
                swatch.style.minWidth = "12px";
                swatch.style.borderRadius = "2px";
                swatch.style.background = item.color || "#999";
                swatch.style.border = `1px solid ${item.borderColor || "rgba(0,0,0,0)"}`;

                const label = document.createElement("span");
                label.className = "legend-label";
                label.style.color = "black";
                label.textContent = String(item.label || "");

                row.appendChild(swatch);
                row.appendChild(label);
                content.appendChild(row);
            });

            content.querySelectorAll(".legend-item").forEach(el => {
                el.addEventListener("click", function (event) {
                    event.preventDefault();
                    event.stopPropagation();

                    const code = String(this.dataset.code || "");
                    const state = content.__clasificacionLegendState || window.__legendState;
                    console.log("[Clasificación] clic en leyenda:", code, "state?", !!state, "activeCodes?", !!state?.activeCodes);
                    if (!code || !state?.activeCodes) return;
                    const startedAt = markClasificacionPerf("legend-toggle-click", renderCycleId, {
                        code,
                        wasActive: state.activeCodes.has(code)
                    }).t;

                    if (state.activeCodes.has(code)) {
                        state.activeCodes.delete(code);
                        this.classList.remove("active");
                        this.classList.add("off");
                        this.style.opacity = "0.35";
                    } else {
                        state.activeCodes.add(code);
                        this.classList.add("active");
                        this.classList.remove("off");
                        this.style.opacity = "1";
                    }

                    syncClasificacionChartWithLegend(state);
                    applyClasificacionLegendFilter(state, { startedAt });
                });
            });
        }

        function actualizarLeyendaAreasActividad(titleText, items = []) {
            const title = document.getElementById("legendTitle");
            const content = document.getElementById("legendContent");

            if (title) {
                title.textContent = titleText || "Leyenda";
            }

            if (!content) return;

            if (!window.__aa_all_items || !window.__aa_all_items.length) {
                window.__aa_all_items = items;
            }

            if (!window.__aa_active_filters || !(window.__aa_active_filters instanceof Set)) {
                window.__aa_active_filters = new Set(items.map(x => String(x.code)));
            }

            if (!items.length) {
                content.innerHTML = "<div class='oot-js-ordenamiento-main-12'>Sin clases</div>";
                return;
            }

            content.innerHTML = "";

            items.forEach(item => {
                const code = String(item.code);
                const isActive = window.__aa_active_filters.has(code);
                const paletteItem = buildAreaActividadItem(code, Number(item.value || 0));

                const row = document.createElement("div");
                row.className = "legend-item" + (isActive ? " active" : "");
                row.dataset.code = code;
                row.style.cursor = "pointer";
                row.style.display = "flex";
                row.style.alignItems = "center";
                row.style.gap = "8px";
                row.style.marginBottom = "6px";
                row.style.color = "black";
                row.style.opacity = isActive ? "1" : "0.35";

                const swatch = document.createElement("span");
                swatch.className = "legend-color";
                swatch.style.display = "inline-block";
                swatch.style.width = "12px";
                swatch.style.height = "12px";
                swatch.style.minWidth = "12px";
                swatch.style.borderRadius = "2px";
                swatch.style.background = paletteItem.color;
                swatch.style.border = `${Number(paletteItem.borderWidth ?? 0.3)}px solid ${paletteItem.borderColor}`;

                const label = document.createElement("span");
                label.className = "legend-label";
                label.style.color = "black";
                label.textContent = paletteItem.label;

                row.appendChild(swatch);
                row.appendChild(label);

                row.onclick = async event => {
                    event.preventDefault();
                    event.stopPropagation();
                    const wasActive = window.__aa_active_filters?.has(code);
                    if (wasActive && String(window.__aa_selected_code || "") === code) {
                        seleccionarCategoriaAreasActividad(null);
                    } else if (!wasActive) {
                        actualizarEstadoLeyendaAreasActividad();
                    }
                    row.classList.toggle("active", !wasActive);
                    row.style.opacity = wasActive ? "0.35" : "1";
                    await toggleAreaActividadCategory(code);
                };

                content.appendChild(row);
            });

            actualizarEstadoLeyendaAreasActividad();
        }
        async function toggleAreaActividadCategory(code) {
            code = String(code);

            if (!window.__aa_active_filters || !(window.__aa_active_filters instanceof Set)) {
                window.__aa_active_filters = new Set();
            }

            if (window.__aa_active_filters.has(code)) {
                window.__aa_active_filters.delete(code);
            } else {
                window.__aa_active_filters.add(code);
            }

            await aplicarFiltroAreasActividadDesdeLeyenda();
        }

        async function aplicarFiltroAreasActividadDesdeLeyenda() {
            const config = ORDENAMIENTO_CONFIG[currentOrdenamientoTab];
            if (!config || currentOrdenamientoTab !== "AREAS_ACTIVIDAD" || !layerGlobal) return;

            const activeCodes = Array.from(window.__aa_active_filters || []);
            const filterField = config.filterField || "Mp_Codigo";
            const useField = config.useField || "Uso_Principal";

            const baseWhere = window.__aa_base_where || "1=1";

            let finalWhere = baseWhere;

            if (activeCodes.length > 0) {
                finalWhere = `${baseWhere} AND ${useField} IN (${activeCodes.join(",")})`;
            } else {
                finalWhere = "1=0";
            }

            layerGlobal.definitionExpression = finalWhere;

            await renderAreasActividadCharts(layerGlobal, config, finalWhere, false, { showLoading: false });
        }

        async function restaurarAreasActividadLegend() {
            const fullCodes = window.__aa_full_codes || [];
            window.__aa_active_filters = new Set(fullCodes.map(code => String(code)));
            window.__aa_selected_code = null;
            actualizarEstadoLeyendaAreasActividad();
            await aplicarFiltroAreasActividadDesdeLeyenda();
        }

        async function cargarMunicipios() {
            if (Object.keys(diccionarioMunicipios).length === 0) {
                await cargarDiccionarioMunicipios();
            }

            // Intentar obtener municipios desde el FeatureLayer
            let codigos = [];
            try {
                const tempLayer = new FeatureLayer({
                    url: MUNICIPIOS_SOURCE_LAYER_URL
                });

                const q = tempLayer.createQuery();
                q.where = "1=1";
                q.outFields = ["mpcodigo"];
                q.returnDistinctValues = true;
                q.returnGeometry = false;

                const res = await tempLayer.queryFeatures(q);

                codigos = [...new Set(
                    res.features.map(f => f.attributes.mpcodigo)
                )].sort();
            } catch (e) {
                console.warn("Error consultando FeatureLayer para municipios, usando diccionario como fallback:", e);
                // Fallback: usar las claves del diccionario como códigos de municipio
                codigos = Object.keys(diccionarioMunicipios)
                    .filter(k => k && k.length >= 4 && !isNaN(Number(k)))
                    .sort();
            }

            // Si aún no hay códigos, poblar con algunos códigos por defecto para que no quede vacío
            if (!codigos.length) {
                console.warn("No se obtuvieron códigos de municipio. El select quedaría vacío.");
                cargarDepartamentosFallback();
                renderizarMunicipiosFallback();
                return;
            }

            // Guardar todos los municipios con su departamento
            todosMunicipios = codigos.map(codigo => {
                const depto = normalizeCode(codigo).substring(0, 2);
                return {
                    codigo: codigo,
                    nombre: diccionarioMunicipios[codigo] || String(codigo),
                    depto: depto
                };
            });

            // Poblar selects
            cargarDepartamentos();
            renderizarMunicipios();
        }

        function cargarDepartamentosFallback() {
            const selectDepto = document.getElementById("departamentos");
            if (!selectDepto) return;
            selectDepto.innerHTML = `<option value="0">Seleccione departamento</option>`;
            const optionColombia = document.createElement("option");
            optionColombia.value = "COL";
            optionColombia.textContent = "Colombia";
            selectDepto.appendChild(optionColombia);
        }

        function renderizarMunicipiosFallback() {
            const select = document.getElementById("municipios");
            if (!select) return;
            select.innerHTML = `<option value="">Seleccione un municipio</option>`;
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

            const deptosUnicos = sortDepartamentoCodesAlphabetically(
                todosMunicipios.map(m => m.depto),
                diccionarioDepartamentos
            );

            deptosUnicos.forEach(codigoDepto => {
                const opt = document.createElement("option");
                opt.value = codigoDepto;
                opt.textContent = getDepartamentoDisplayName(codigoDepto, diccionarioDepartamentos);
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
                opt.textContent = getMunicipioDisplayName(muni, diccionarioMunicipios);
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

                // limpiar filtros
                filtroNivel = "";
                deptoActual = "";
                whereBase = "";
                clasificacionBaseWhere = "1=1";
                cancelClasificacionAuxiliaryLoad();
                cancelClasificacionCategoryPrewarm();
                cancelClasificacionDepartmentWarmup();

                // limpiar capas
                clearLayers();
                resetClasificacionCategoryVisuals();

                // limpiar gráfica
                if (chartInstance) chartInstance.destroy();

                if (currentMainModule === "ORDENAMIENTO") {
                    setOrdenamientoChartLoading();
                    scheduleOrdenamientoRender();
                } else {
                    const summaryDiv = document.getElementById("summaryDiv");
                    if (summaryDiv) {
                        summaryDiv.textContent = "Seleccione un municipio para ver el resumen.";
                    }
                }


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

            if (currentMainModule === "ORDENAMIENTO") {
                deptoActual = deptoSeleccionado;
                filtroNivel = deptoSeleccionado && deptoSeleccionado !== "0" ? "DEPTO" : "";

                if (currentOrdenamientoTab === "CLASIFICACION_SUELO") {
                    cancelClasificacionAuxiliaryLoad();
                    cancelClasificacionCategoryPrewarm();
                    cancelClasificacionDepartmentWarmup();
                    renderCycleId++;
                } else if (currentOrdenamientoTab === "ZONIFICACION_RURAL") {
                    zonificacionRuralRenderSeq++;
                    clearZonificacionRuralSelection();
                }
                scheduleOrdenamientoRender();
                return;
            }

        };

        document.getElementById("municipios").onchange = function () {
            const codigo = this.value;
            if (!codigo) return;

            filtroNivel = "MUNI";
            municipioActual = codigo;
            deptoActual = normalizeCode(codigo).substring(0, 2);

            renderControls();

            if (currentMainModule === "ORDENAMIENTO") {
                if (currentOrdenamientoTab === "CLASIFICACION_SUELO") {
                    cancelClasificacionAuxiliaryLoad();
                    cancelClasificacionCategoryPrewarm();
                    cancelClasificacionDepartmentWarmup();
                    renderCycleId++;
                } else if (currentOrdenamientoTab === "ZONIFICACION_RURAL") {
                    zonificacionRuralRenderSeq++;
                    clearZonificacionRuralSelection();
                }
                scheduleOrdenamientoRender();
                return;
            }
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

            // Line:
            if (chartType === "line") {
                xTitle = "Categoría";
                yTitle = valueTitle;
                return { xTitle, yTitle };
            }

            return { xTitle, yTitle };
        }

        function formatOrdenamientoPiePercentLabel(value) {
            const number = Number(value);
            if (!Number.isFinite(number)) return "";

            return `${number.toLocaleString("es-CO", {
                maximumFractionDigits: 2,
                minimumFractionDigits: number % 1 === 0 ? 0 : 1
            })}%`;
        }

        function createOrdenamientoPiePercentageLabelsPlugin() {
            return {
                id: "ordenamientoPiePercentageLabels",
                afterDatasetsDraw(chart) {
                    const chartType = chart.config?.type;
                    if (chartType !== "pie" && chartType !== "doughnut") return;
                    if ((chart.data?.datasets || []).length > 1) return;

                    const { ctx, chartArea } = chart;
                    const internalBoxes = [];
                    const externalLabels = [];
                    const visibleValues = (chart.data?.datasets?.[0]?.data || [])
                        .map(value => Number(value))
                        .filter(value => Number.isFinite(value) && value > 0);
                    const totalVisible = visibleValues.length;
                    const crowded = totalVisible >= 10;
                    const veryCrowded = totalVisible >= 14;
                    const fontSize = veryCrowded ? 8 : crowded ? 9 : 10;
                    const labelHeight = fontSize + 8;
                    const externalGap = veryCrowded ? 12 : crowded ? 13 : 15;
                    const labelPadX = veryCrowded ? 4 : 5;
                    const connectorColor = "rgba(23,53,45,0.55)";
                    const textColor = "#17352d";
                    const labelBg = "rgba(255,250,240,0.94)";
                    const labelStroke = "rgba(23,53,45,0.16)";
                    ctx.font = `600 ${fontSize}px sans-serif`;

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
                        ctx.lineWidth = 3;
                        ctx.strokeStyle = "rgba(255,250,240,0.86)";
                        ctx.strokeText(text, x, y);
                        ctx.fillStyle = textColor;
                        ctx.fillText(text, x, y);
                        ctx.restore();
                    };

                    const roundRect = (x, y, width, height, radius = 5) => {
                        const r = Math.min(radius, height / 2, width / 2);
                        ctx.beginPath();
                        ctx.moveTo(x + r, y);
                        ctx.lineTo(x + width - r, y);
                        ctx.quadraticCurveTo(x + width, y, x + width, y + r);
                        ctx.lineTo(x + width, y + height - r);
                        ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
                        ctx.lineTo(x + r, y + height);
                        ctx.quadraticCurveTo(x, y + height, x, y + height - r);
                        ctx.lineTo(x, y + r);
                        ctx.quadraticCurveTo(x, y, x + r, y);
                        ctx.closePath();
                    };

                    chart.data.datasets.forEach((dataset, datasetIndex) => {
                        const meta = chart.getDatasetMeta(datasetIndex);
                        if (!meta || meta.hidden) return;

                        meta.data.forEach((arc, dataIndex) => {
                            if (!arc || arc.hidden) return;
                            if (chart.getDataVisibility && !chart.getDataVisibility(dataIndex)) return;

                            const rawValue = dataset.data?.[dataIndex];
                            const value = Number(rawValue);
                            if (!Number.isFinite(value) || value <= 0) return;

                            const text = formatOrdenamientoPiePercentLabel(value);
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
                            const midRadius = innerRadius + radialWidth * 0.58;
                            const arcLength = Math.abs(circumference) * Math.max(midRadius, 1);
                            const textWidth = ctx.measureText(text).width + 4;
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
                            const fitsInsideChart = internalBox.left >= chartArea.left + 2 &&
                                internalBox.right <= chartArea.right - 2 &&
                                internalBox.top >= chartArea.top + 2 &&
                                internalBox.bottom <= chartArea.bottom - 2;
                            const hasInternalSpace = Math.abs(circumference) >= (veryCrowded ? 0.14 : crowded ? 0.16 : 0.18) &&
                                arcLength >= textWidth + 2 &&
                                radialWidth >= 10;

                            if (fitsInsideChart && hasInternalSpace && !overlaps(internalBox, internalBoxes)) {
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
                                elbowX: centerX + cos * (outerRadius + (veryCrowded ? 11 : 15)),
                                elbowY: centerY + sin * (outerRadius + (veryCrowded ? 11 : 15)),
                                boxWidth: textWidth,
                                textX: side === "right"
                                    ? Math.min(chartArea.right - textWidth - 2, centerX + outerRadius + (veryCrowded ? 22 : 30))
                                    : Math.max(chartArea.left + textWidth + 2, centerX - outerRadius - (veryCrowded ? 22 : 30))
                            });
                        });
                    });

                    const adjustExternalLabels = (items) => {
                        const sorted = items.sort((a, b) => a.y - b.y);
                        const minY = chartArea.top + labelHeight / 2 + 2;
                        const maxY = chartArea.bottom - labelHeight / 2 - 2;

                        sorted.forEach((item, index) => {
                            const previous = sorted[index - 1];
                            const minAllowed = previous ? previous.y + externalGap : minY;
                            item.y = Math.max(minAllowed, Math.min(maxY, item.y));
                        });

                        for (let i = sorted.length - 2; i >= 0; i--) {
                            sorted[i].y = Math.min(sorted[i].y, sorted[i + 1].y - externalGap);
                        }

                        sorted.forEach(item => {
                            item.y = Math.max(minY, Math.min(maxY, item.y));
                        });
                    };

                    adjustExternalLabels(externalLabels.filter(item => item.side === "left"));
                    adjustExternalLabels(externalLabels.filter(item => item.side === "right"));

                    ctx.save();
                    ctx.strokeStyle = connectorColor;
                    ctx.lineWidth = veryCrowded ? 0.9 : 1;
                    ctx.lineCap = "round";
                    ctx.lineJoin = "round";
                    ctx.fillStyle = textColor;
                    ctx.font = `600 ${fontSize}px sans-serif`;
                    ctx.textBaseline = "middle";

                    externalLabels.forEach(item => {
                        const boxX = item.side === "right"
                            ? item.textX
                            : item.textX - item.boxWidth;
                        const boxY = item.y - labelHeight / 2;
                        const lineEndX = item.side === "right" ? boxX - 3 : boxX + item.boxWidth + 3;

                        ctx.beginPath();
                        ctx.moveTo(item.anchorX, item.anchorY);
                        ctx.lineTo(item.elbowX, item.elbowY);
                        ctx.lineTo(lineEndX, item.y);
                        ctx.stroke();

                        ctx.beginPath();
                        ctx.arc(item.anchorX, item.anchorY, veryCrowded ? 1 : 1.2, 0, Math.PI * 2);
                        ctx.fill();

                        ctx.fillStyle = labelBg;
                        ctx.strokeStyle = labelStroke;
                        ctx.lineWidth = 1;
                        roundRect(boxX, boxY, item.boxWidth, labelHeight, 5);
                        ctx.fill();
                        ctx.stroke();

                        ctx.fillStyle = textColor;
                        ctx.textAlign = "left";
                        ctx.fillText(item.text, boxX + labelPadX, item.y);

                        ctx.strokeStyle = connectorColor;
                        ctx.lineWidth = veryCrowded ? 0.9 : 1;
                    });

                    ctx.restore();
                }
            };
        }

        function getOrdenamientoAdaptiveChartLayout(itemCount) {
            const count = Math.max(0, Number(itemCount) || 0);
            const screenW = window.innerWidth || 1200;
            const isSmallScreen = screenW <= 768;
            const isVerySmallScreen = screenW <= 480;

            const min = isVerySmallScreen ? 300 : isSmallScreen ? 325 : 330;
            const ideal = isVerySmallScreen ? 335 : isSmallScreen ? 355 : 370;
            const max = isVerySmallScreen ? 375 : isSmallScreen ? 400 : 420;
            let size = ideal;

            if (count <= 3) {
                size = min;
            } else if (count <= 6) {
                size = ideal - 10;
            } else if (count > 8) {
                const step = isVerySmallScreen ? 5 : 6;
                size = ideal + (count - 8) * step;
            }

            size = Math.min(max, Math.max(min, Math.round(size)));

            return {
                min,
                ideal,
                max,
                size,
                cutout: count <= 4 ? 62 : count <= 9 ? 59 : 56,
                radius: count <= 4 ? 82 : count <= 9 ? 80 : 75,
                legendFontSize: count >= 15 ? 8 : count >= 10 ? 9 : 10,
                legendPadding: count >= 12 ? 6 : 8,
                outerPadding: count >= 10 ? 46 : 34
            };
        }

        function getOrdenamientoPieChartHeight(itemCount, options = {}) {
            const count = Math.max(0, Number(itemCount) || 0);
            const screenW = window.innerWidth || 1200;
            const isSmallScreen = screenW <= 768;
            const isVerySmallScreen = screenW <= 480;

            if (!options.compact) {
                return getOrdenamientoAdaptiveChartLayout(count).size;
            }

            const base = isSmallScreen ? 340 : 370;
            const extra = count > 8
                ? (count - 8) * (isVerySmallScreen ? 10 : isSmallScreen ? 9 : 8)
                : 0;
            const maxHeight = isSmallScreen ? 450 : 460;

            return Math.min(maxHeight, Math.max(base, base + extra));
        }

        function crearGrafica(labels, values, colors, type = 'bar', isVertical = false, datasets = null) {
            const layerConfig = (currentMainModule === "ORDENAMIENTO")
                ? (ORDENAMIENTO_CONFIG[currentOrdenamientoTab] || null)
                : getActiveLayerConfig();
            toggleGeoformasCharts(false);
            destroyGeoformasCharts();
            if (type === 'bar' && !isVertical) {
                labels = labels.map(l => wrapLabel(l, 22));
            }
            //  Títulos de ejes según capa/tipo
            const axisTitles = getAxisTitles(layerConfig, type, isVertical, datasets);

            //  Control de visibilidad de etiquetas (para no saturar en algunas capas)
            let showYLabels = true;

            showOrdenamientoChartCanvas();
            const ctx = document.getElementById("chart").getContext("2d");
            document.getElementById("chartHighlightOverlay")?.remove();
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

            const pieItemCount = isPieLike
                ? Math.max(
                    Array.isArray(labels) ? labels.length : 0,
                    ...(chartDatasets || []).map(dataset => Array.isArray(dataset?.data) ? dataset.data.length : 0)
                )
                : 0;
            const isClasificacionSueloChart = layerConfig?.ordenamientoType === "clasificacion_suelo";
            const isZonificacionRuralChart = currentMainModule === "ORDENAMIENTO" &&
                currentOrdenamientoTab === "ZONIFICACION_RURAL";
            const isAdaptiveOrdenamientoChart = isPieLike &&
                currentMainModule === "ORDENAMIENTO" &&
                (isZonificacionRuralChart || isClasificacionSueloChart);
            const baseAdaptivePieLayout = isAdaptiveOrdenamientoChart
                ? getOrdenamientoAdaptiveChartLayout(pieItemCount)
                : null;
            const adaptiveSizeBoost = isClasificacionSueloChart
                ? ((window.innerWidth || 1200) <= 480 ? 24 : 32)
                : (isZonificacionRuralChart
                    ? ((window.innerWidth || 1200) <= 480 ? 20 : 28)
                    : 0);
            const adaptiveSizeLimit = baseAdaptivePieLayout
                ? baseAdaptivePieLayout.max + (isZonificacionRuralChart ? adaptiveSizeBoost : 0)
                : 0;
            const adaptivePieLayout = baseAdaptivePieLayout
                ? {
                    ...baseAdaptivePieLayout,
                    size: Math.min(
                        adaptiveSizeLimit,
                        baseAdaptivePieLayout.size + adaptiveSizeBoost
                    )
                }
                : null;
            const legendPosition = isAdaptiveOrdenamientoChart || isClasificacionSueloChart
                ? "bottom"
                : (datasets ? "right" : "bottom");

            const renderCanvas = ctx.canvas;
            const chartCard = renderCanvas.closest(".chart-card");
            chartCard?.classList.remove("chart-card--vigencia");
            chartCard?.classList.remove("chart-card--areas-activity");
            renderCanvas.classList.toggle("chart-canvas--pie-like", isPieLike);
            chartCard?.classList.toggle("chart-card--pie-like", isPieLike);
            renderCanvas.classList.toggle("chart-canvas--ordenamiento-adaptive", isAdaptiveOrdenamientoChart);
            chartCard?.classList.toggle("chart-card--ordenamiento-adaptive", isAdaptiveOrdenamientoChart);

            if (adaptivePieLayout) {
                renderCanvas.style.setProperty(
                    "--ordenamiento-chart-size",
                    `${adaptivePieLayout.size}px`
                );
            } else {
                renderCanvas.style.removeProperty("--ordenamiento-chart-size");
            }

            if (isPieLike) {
                renderCanvas.style.height = "";
                renderCanvas.style.maxHeight = "";
                renderCanvas.style.aspectRatio = "";
            } else {
                renderCanvas.style.width = "";
                renderCanvas.style.maxWidth = "";
                renderCanvas.style.aspectRatio = "";
            }

            const isStacked = Array.isArray(datasets) && datasets.length > 0;
            // Solo forzamos 0-100 en clima apilado
            const isPercentStacked = isStacked && layerConfig?.isClima === true && layerConfig?.isStacked === true;

            const config = {
                type,
                data: { labels, datasets: chartDatasets },
                options: {
                    responsive: true,
                    layout: isPieLike ? {
                        padding: {
                            top: pieItemCount >= 10 ? 12 : 8,
                            right: adaptivePieLayout?.outerPadding ?? (isClasificacionSueloChart ? 34 : (pieItemCount >= 10 ? 48 : 34)),
                            bottom: isClasificacionSueloChart ? 18 : (pieItemCount >= 10 ? 12 : 8),
                            left: adaptivePieLayout?.outerPadding ?? (pieItemCount >= 10 ? 48 : 34)
                        }
                    } : undefined,
                    plugins: {
                        legend: {
                            display: (
                                type === 'pie' ||
                                type === 'doughnut' ||
                                type === 'polarArea' ||
                                datasets !== null
                            ),
                            position: legendPosition,
                            labels: {
                                boxWidth: adaptivePieLayout ? 10 : 12,
                                padding: adaptivePieLayout?.legendPadding,
                                font: { size: adaptivePieLayout?.legendFontSize ?? 10 },
                                usePointStyle: type === "polarArea",
                                pointStyle: "rectRounded"
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function (context) {
                                    // Riesgo CC departamental
                                    if (layerConfig?.isDeptoRiskCount) {
                                        const parsedY = context.parsed?.y;
                                        const v = parsedY != null ? parsedY : (context.parsed != null ? context.parsed : context.raw);
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
                                        const parsedR = context.parsed?.r;
                                        const rawValue = parsedR != null
                                            ? parsedR
                                            : (context.parsed != null ? context.parsed : context.raw);

                                        const value = Number(rawValue);
                                        if (!Number.isFinite(value)) return label;

                                        return `${label}: ${value.toFixed(2)}%`;
                                    }

                                    // Resto de gráficos
                                    if (layerConfig?.ordenamientoType === "vigencia") {
                                        const labelText = context.label || "";
                                        const value = Number(context.raw);
                                        const count = context.dataset?.counts?.[context.dataIndex];
                                        const countText = Number.isFinite(Number(count))
                                            ? `${Number(count).toLocaleString("es-CO")} instrumentos`
                                            : "instrumentos";
                                        return `${labelText}: ${Number.isFinite(value) ? value.toFixed(2) : "0.00"}% (${countText})`;
                                    }

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
                        const resolvedElements = elements?.length
                            ? elements
                            : (
                                chartInstance && typeof chartInstance.getElementsAtEventForMode === "function"
                                    ? chartInstance.getElementsAtEventForMode(
                                        evt,
                                        "nearest",
                                        { intersect: false },
                                        true
                                    )
                                    : []
                            );

                        if (!resolvedElements.length) return;
                        if (type === 'radar') return;

                        const el = resolvedElements[0];
                        let clickedLabel = chartInstance.data.labels?.[el.index];

                        if (Array.isArray(clickedLabel)) clickedLabel = clickedLabel.join(" ");

                        // =========================
                        // ORDENAMIENTO RURAL
                        // =========================
                        if (
                            currentMainModule === "ORDENAMIENTO" &&
                            currentOrdenamientoTab === "ZONIFICACION_RURAL"
                        ) {
                            const clickedCode =
                                chartInstance.data.datasets?.[el.datasetIndex]?.codes?.[el.index] != null
                                    ? chartInstance.data.datasets?.[el.datasetIndex]?.codes?.[el.index]
                                    : null;

                            if (clickedCode != null) {
                                applyZonificacionRuralSingleSelection(clickedCode);
                                await selectZonificacionRuralFromCode(clickedCode, {
                                    temporaryMs: 2200,
                                    highlightMap: true
                                });
                                if (currentRuralChartView === "CATEGORIA") {
                                    await zoomMapaZonificacionRural(null, clickedCode);
                                } else {
                                    await zoomMapaZonificacionRural(clickedCode, null);
                                }
                            }
                            return;
                        }

                        // =========================
                        // ORDENAMIENTO - CLASIFICACION DEL SUELO
                        // =========================
                        if (
                            currentMainModule === "ORDENAMIENTO" &&
                            currentOrdenamientoTab === "CLASIFICACION_SUELO"
                        ) {
                            const dataCodes = chartInstance?.data?.datasets?.[el.datasetIndex]?.codes;
                            const clickedCode = Array.isArray(dataCodes) && dataCodes[el.index] != null
                                ? String(dataCodes[el.index])
                                : null;
                            console.log("[Clasificación] clic en gráfico:", clickedCode);
                            if (clickedCode) {
                                applyClasificacionSingleSelection(clickedCode, { applyMap: true });
                                await zoomMapaClasificacionSuelo(clickedCode);
                            }
                            return;
                        }

                        // =========================
                        // ORDENAMIENTO - no click handling for other tabs
                        // =========================
                        if (currentMainModule === "ORDENAMIENTO") {
                            return;
                        }
                    },
                    onHover: (evt, elements) => {

                        if (!elements.length) {
                            clearHighlight();
                            return;
                        }

                        if (currentMainModule === "ORDENAMIENTO") {
                            return;
                        }

                    }
                }
            };

            if (isPieLike) {
                config.options.maintainAspectRatio = !isAdaptiveOrdenamientoChart;
                if (!isAdaptiveOrdenamientoChart) {
                    config.options.aspectRatio = 1;
                }
                if (type === "doughnut") {
                    config.options.cutout = adaptivePieLayout
                        ? `${adaptivePieLayout.cutout}%`
                        : (pieItemCount >= 10 ? "52%" : "56%");
                    config.options.radius = adaptivePieLayout
                        ? `${adaptivePieLayout.radius}%`
                        : (pieItemCount >= 10 ? "76%" : "82%");
                }
                config.plugins = [
                    ...(config.plugins || []),
                    createOrdenamientoPiePercentageLabelsPlugin()
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
                    const rawClickedLabel = config.data.labels?.[idx];
                    const clickedLabel = String(rawClickedLabel != null ? rawClickedLabel : "").trim();

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
            const chartCanvas = document.getElementById("chart");
            if (chartCanvas) {
                chartCanvas.ondblclick = async (event) => {
                    if (
                        currentMainModule === "ORDENAMIENTO" &&
                        currentOrdenamientoTab === "ZONIFICACION_RURAL"
                    ) {
                        const hitItems = chartInstance && typeof chartInstance.getElementsAtEventForMode === "function"
                            ? chartInstance.getElementsAtEventForMode(
                                event,
                                "nearest",
                                { intersect: true },
                                true
                            )
                            : [];

                        if (hitItems.length) return;
                        restoreZonificacionRuralLegendFilter();
                        return;
                    }

                    if (
                        currentMainModule !== "ORDENAMIENTO" ||
                        currentOrdenamientoTab !== "AREAS_ACTIVIDAD"
                    ) {
                        return;
                    }

                    const hitItems = chartInstance && typeof chartInstance.getElementsAtEventForMode === "function"
                        ? chartInstance.getElementsAtEventForMode(
                            event,
                            "nearest",
                            { intersect: true },
                            true
                        )
                        : [];

                    if (hitItems.length) return;
                    await restaurarAreasActividadLegend();
                };
            }
        }

        function actualizarTituloGrafico(config, mpnombre, dpnombre) {
            const titleElement = document.getElementById("chartTitle");
            if (!titleElement) return;

            let titulo = "Distribución (%)";
            if (filtroNivel === "DEPTO" && deptoActual) {
                const depName = diccionarioDepartamentos[deptoActual] || deptoActual;

                // fallback depto
                titleElement.textContent = `Distribución (%)`;
                return;
            }




            titleElement.textContent = titulo;
        }

        function buildPaisajeDictFromRenderer(layer) {
            const m = new Map();
            const r = layer?.renderer;
            if (!r || r.type !== "unique-value") return m;

            (r.uniqueValueInfos || []).forEach(info => {
                const v = String(info.value ?? "").trim();
                const label = String(info.label ?? v).trim();
                const col = getSymbolColorRGBA(info.symbol) || "#999";
                if (v) m.set(v, { label, color: col });
                if (label) m.set(normKey(label), { label, color: col });
            });

            return m;
        }



        // =====================
        // LEYENDA POR EXTENT (solo lo visible)
        // =====================

        function getLegendOutFields(config, layer) {
            if (config.isDeptoRiskCount) return [];
            if (!config) return ["*"];
            if (config.isRadar) return [];
            return [config.labelField];
        }

        // 2) Mapea atributos => {label,color} según tu lógica/diccionarios
        function buildLegendEntryFromAttrs(config, attrs, layer) {
            if (!config || !attrs) return null;



            const primaryValue = attrs[config?.labelField];
            const fallbackValue = attrs[Object.keys(attrs || {})[0]];
            const code = String(primaryValue != null ? primaryValue : (fallbackValue != null ? fallbackValue : ""));
            return { label: code || "—", color: "#999" };
        }

        // 3) Ordena labels de manera bonita por tipo de capa

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


        function pickExistingField(layer, candidates) {
            const fields = (layer?.fields || []).map(f => String(f.name).toLowerCase());
            for (const c of candidates) {
                if (fields.includes(String(c).toLowerCase())) return c;
            }
            return null;
        }



        /* =======================
        HANDLERS
        ======================= */

        function buildCuencasDictFromRenderer(layerJson) {
            const infos = layerJson?.drawingInfo?.renderer?.uniqueValueInfos || [];
            const map = new Map();

            infos.forEach(info => {
                const value = String(info.value);
                const label = String(info.label || value);

                const c = info?.symbol?.color || [150, 150, 150, 255];
                const rgba = `rgba(${c[0]},${c[1]},${c[2]},${(c[3] ?? 255) / 255})`;

                map.set(value, { label, color: rgba });
            });

            return map;
        }

        function renderGeneralFromFeatures(ctx, features) {
            // No-op: this function is not used by Ordenamiento module
        }


        async function getLayerViewSafe(view, layer) {
            if (!view || !layer) return null;
            try {
                return await view.whenLayerView(layer);
            } catch {
                return null;
            }
        }



        /* =======================
        ROUTER
        ======================= */



        function applyWhereToActiveLayers(where) {
            if (currentOrdenamientoTab === "CLASIFICACION_SUELO") {
                applyClasificacionVisualWhere(where);
                return;
            }
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

        document.getElementById("btnVerTodo").onclick = () => {
            if (!layerGlobal) return;

            applyWhereToActiveLayers(whereBase);
            const config = getActiveLayerConfig();
            if (!config?.isOrdenamiento && !config?.ordenamientoType) {
                updateLegendByExtent?.(layerGlobal, config);
            }

            layerGlobal.queryExtent({ where: whereBase }).then(res => {
                if (res.extent) view.goTo(res.extent.expand(1.2));
            });
        };

        function resolveOrdenamientoTabTarget(tabUrl) {
            const tab = String(tabUrl || "");
            if (tab.includes("Vigencia")) {
                return "Vigencia";
            }
            if (tab.includes("Clasific") || tab === "Clasificaci\u00f3n del suelo") {
                return "Clasificaci\u00f3n del suelo";
            }
            if (tab.includes("reas de actividad") || tab === "\u00c1reas de actividad") {
                return "\u00c1reas de actividad";
            }
            if (tab.includes("onificaci") || tab.includes("Zonific")) {
                return "Zonificaci\u00f3n de uso del suelo rural";
            }
            return null;
        }

        function activateOrdenamientoTabFromUrl(tabUrl) {
            const target = resolveOrdenamientoTabTarget(tabUrl);
            if (!target) return;

            setOrdenamientoTab(target);
            currentMainModule = AppState.currentMainModule;
            currentOrdenamientoTab = AppState.currentOrdenamientoTab;
            currentRuralChartView = AppState.currentRuralChartView;
            syncStateFromGlobals();
            cleanupOrdenamientoVisualStateForTab(currentOrdenamientoTab);
            resetOrdenamientoUI({
                hideTimeSlider,
                destroyGeoformasCharts,
                toggleGeoformasCharts,
                chartInstanceRef: {
                    get current() { return chartInstance; },
                    set current(value) { chartInstance = value; }
                },
                renderControls
            });

            if (typeof cargarOrdenamientoActual === "function") {
                cargarOrdenamientoActual();
            }
        }

        const urlContext = globalThis.ModuleNavigation?.parseComponentUrlParams?.() || {
            tab: null,
            municipioId: "",
            deptoId: ""
        };

        globalThis.ModuleNavigation?.applyTerritorySelectionFromUrl?.({
            onTab(tabUrl) {
                if (!urlContext.municipioId && !urlContext.deptoId) {
                    activateOrdenamientoTabFromUrl(tabUrl);
                }
            },
            onApplied({ tab }) {
                if (tab) {
                    activateOrdenamientoTabFromUrl(tab);
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

    });
}

