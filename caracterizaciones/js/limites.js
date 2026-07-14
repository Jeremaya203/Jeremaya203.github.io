import {
    cargarLimitesMunicipales as cargarLimitesMunicipalesModulo
} from "./modules/limites/limites-municipales.loader.js";
import {
    buildWhereBase,
    buildDefinitionExpression,
    buildExtraWhere
} from "./map/filters.js";
import {
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
    destroyLayerSafe
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
    LIMITES_CONFIG,
    DEPTO_ONLY_LAYER_IDS,
    DEPT_TO_MUNI_LAYER_ID,
    LEYENDA_RIESGO_CC
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
    fetchGroupedStats
} from "./data.js";
import {
    buildLegendFromRenderer,
    getSymbolColorRGBA,
    syncLegendToLabelSelection,
    sortLegendEntries,
    actualizarLeyendaLimitesMunicipales
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

function updateURLByModule() {
    const url = new URL(window.location.href);
    url.searchParams.set("vista", "limites");
    window.history.replaceState({}, "", url.pathname + url.search);
}

function applyInitialModuleFromURL() {
    currentMainModule = "LIMITES";
    currentLimitesTab = "MUNICIPIOS";
    AppState.currentMainModule = "LIMITES";
    AppState.currentLimitesTab = "MUNICIPIOS";
    updateMapViewBadge("Límites municipales");
}

function syncStateFromGlobals() {
    AppState.currentMainModule = currentMainModule;
    AppState.currentLimitesTab = currentLimitesTab;

    AppState.map = map;
    AppState.view = view;
    AppState.currentSubLayerIndex = currentSubLayerIndex;
    AppState.layerGlobal = layerGlobal;
    AppState.whereBase = whereBase;
    AppState.municipioActual = municipioActual;
    AppState.deptoActual = deptoActual;
    AppState.filtroNivel = filtroNivel;
    AppState.chartInstance = chartInstance;
}

function clearLayers() {
    if (layerGlobal && !layerGlobal.destroyed) {
        map.remove(layerGlobal);
    }
    layerGlobal = null;
    layerViewGlobal = null;
    window.activeFeatureLayer = null;
}

let currentMainModule = "LIMITES";
let currentLimitesTab = "MUNICIPIOS";

let currentSubLayerIndex = 0;
let layerGlobal = null;
let layerViewGlobal = null;
let whereBase = "";
let municipioActual = "";
let chartInstance = null;
let diccionarioMunicipios = {};
let diccionarioDepartamentos = {};
let todosMunicipios = [];

let map = null;
let view = null;
let legendWidget = null;
let deptoActual = "";
let filtroNivel = "";
let updateLegendByExtent = null;

let scaleHandle = null;
let renderCycleId = 0;
let highlightHandle = null;
let lastHoverWhere = "";
let legendFilterLabel = null;
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

async function zoomMapaLineaLimite(objectId) {
    return zoomToLayerObjectId(objectId, 1.3);
}

async function zoomMapaDepartamentoLimites(objectId) {
    return zoomToLayerObjectId(objectId, 1.2);
}

async function cargarDiccionarioMunicipios() {
    try {
        const url = "https://serviciosgeovisor.igac.gov.co:8080/Geovisor/config?cmd=config_diccionario2";
        const res = await fetch(url);
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
        console.error("Error cargando diccionario", e);
    }
}

function getActiveLayerConfig() {
    syncStateFromGlobals();
    return getActiveLayerConfigFromState();
}

function setLegendLayer(layer, titleText) {
    setLegendLayerTitle(titleText);
}

function actualizarLeyendaDepartamentosLimites() {
    const title = document.getElementById("legendTitle");
    const content = document.getElementById("legendContent");

    if (title) title.textContent = "Departamentos";
    if (!content) return;

    content.innerHTML = `
        <div class="legend-item" style="display:flex;align-items:center;gap:8px;color:black;">
            <span style="
                width:14px;
                height:14px;
                display:inline-block;
                background:rgba(245,245,245,0.4);
                border:2px solid rgba(76,0,115,1);
            "></span>
            <span>Límite departamental</span>
        </div>
    `;
}

function initAllDropdowns() {
    document.addEventListener("click", function (e) {
        document.querySelectorAll(".modulo-dropdown.open").forEach(dropdown => {
            if (!dropdown.contains(e.target)) {
                dropdown.classList.remove("open");
            }
        });
    });

    initModuleDropdown("limitesDropdown", "limitesTrigger", ".dropdown-menu-custom", function(target) {
        currentMainModule = "LIMITES";
        updateURLByModule();
        if (target === "Municipios") {
            currentLimitesTab = "MUNICIPIOS";
        } else if (target === "Departamentos") {
            currentLimitesTab = "DEPARTAMENTOS";
        }

        hideTimeSlider();

        if (chartInstance) {
            chartInstance.destroy();
            chartInstance = null;
        }

        const legendTitle = document.getElementById("legendTitle");
        const legendContent = document.getElementById("legendContent");
        if (legendTitle) legendTitle.textContent = "Leyenda";
        if (legendContent) legendContent.innerHTML = "";
        window.__lastLegendRenderKey = "";

        const summaryDiv = document.getElementById("summaryDiv");
        if (summaryDiv) {
            summaryDiv.textContent = "Cargando información...";
        }

        renderControls();

        if (currentLimitesTab === "MUNICIPIOS") {
            window.cargarLimitesMunicipales?.();
        } else if (currentLimitesTab === "DEPARTAMENTOS") {
            window.cargarLimitesDepartamentos?.();
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

    let sliderMode = "zoom";

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
        container.style.display = "none";
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

        if (typeof updateLegendByExtent === "function") {
            await updateLegendByExtent(activeLayer, config);
        }
    }, 200);

    async function cargarMunicipios() {
        if (Object.keys(diccionarioMunicipios).length === 0) {
            await cargarDiccionarioMunicipios();
        }

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

            todosMunicipios = codigos.map(codigo => {
                const depto = normalizeCode(codigo).substring(0, 2);
                return {
                    codigo: codigo,
                    nombre: diccionarioMunicipios[codigo] || codigo,
                    depto: depto
                };
            });

            cargarDepartamentos();
            renderizarMunicipios();

        } catch (e) {
            console.error("Error cargando municipios", e);
        }
    }

    function cargarDepartamentos() {
        const selectDepto = document.getElementById("departamentos");
        selectDepto.innerHTML = `<option value="0">Seleccione departamento</option>`;

        const optionColombia = document.createElement("option");
        optionColombia.value = "COL";
        optionColombia.textContent = "Colombia";
        selectDepto.appendChild(optionColombia);

        const deptosUnicos = [...new Set(todosMunicipios.map(m => m.depto))].sort();

        deptosUnicos.forEach(codigoDepto => {
            const opt = document.createElement("option");
            opt.value = codigoDepto;
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

        if (deptoSeleccionado === "COL") {
            document.getElementById("municipios").value = "";
            municipioActual = "";
            filtroNivel = "";
            deptoActual = "";
            whereBase = "";
            clearLayers();
            if (chartInstance) chartInstance.destroy();
            view.goTo(
                { center: [-74.3, 4.6], zoom: 6 },
                { duration: 900, easing: "ease-in-out" }
            );
            return;
        }

        renderizarMunicipios(deptoSeleccionado);
        document.getElementById("municipios").value = "";
        municipioActual = "";

        if (currentMainModule === "LIMITES") {
            deptoActual = deptoSeleccionado;
            filtroNivel = deptoSeleccionado && deptoSeleccionado !== "0" ? "DEPTO" : "";

            if (currentLimitesTab === "DEPARTAMENTOS") {
                cargarLimitesDepartamentos();
            } else {
                cargarLimitesMunicipales();
            }
            return;
        }

        filtroNivel = "";
        deptoActual = "";
        whereBase = "";
        clearLayers();
        if (chartInstance) chartInstance.destroy();
    };

    document.getElementById("municipios").onchange = function () {
        const codigo = this.value;
        if (!codigo) return;

        filtroNivel = "MUNI";
        municipioActual = codigo;
        deptoActual = normalizeCode(codigo).substring(0, 2);

        if (currentMainModule === "LIMITES") {
            if (currentLimitesTab === "MUNICIPIOS") {
                cargarLimitesMunicipales();
            } else if (currentLimitesTab === "DEPARTAMENTOS") {
                cargarLimitesDepartamentos();
            }
            return;
        }
    };

    init();

    function init() {
        document.getElementById("btnRefreshBusqueda").onclick = limpiarBusqueda;
        applyInitialModuleFromURL();
        cargarMunicipios();
        document.getElementById("legendToggle").onclick = toggleLegend;
        renderControls();
    }

    function limpiarBusqueda() {
        hideTimeSlider();
        timeSliderTouched = false;

        const selectDepto = document.getElementById("departamentos");
        const selectMuni = document.getElementById("municipios");

        if (selectDepto) selectDepto.value = "0";
        if (selectMuni) {
            selectMuni.innerHTML = `<option value="">Seleccione un municipio</option>`;
            renderizarMunicipios();
            selectMuni.value = "";
        }

        municipioActual = "";
        deptoActual = "";
        filtroNivel = "";
        whereBase = "";
        layerViewGlobal = null;
        lastHoverWhere = "";
        legendFilterLabel = null;

        syncStateFromGlobals();

        clearLayers();

        if (highlightHandle) {
            try { highlightHandle.remove(); } catch (e) {}
            highlightHandle = null;
        }

        if (chartInstance) {
            chartInstance.destroy();
            chartInstance = null;
        }

        const legendTitle = document.getElementById("legendTitle");
        const legendContent = document.getElementById("legendContent");
        if (legendTitle) legendTitle.textContent = "Leyenda";
        if (legendContent) {
            legendContent.innerHTML = `<p style="margin:0; color:#666;">Seleccione un departamento o municipio</p>`;
            legendContent.classList.remove("collapsed");
        }

        window.__legendState = {
            allCodes: [],
            activeCodes: new Set(),
            field: null,
            layer: null
        };

        currentSubLayerIndex = 0;
        renderControls();

        updateMapViewBadge("Límites municipales");

        if (view?.popup) {
            view.popup.close();
        }

        if (extentInicial) {
            view.goTo(extentInicial, { duration: 900, easing: "ease-in-out" });
        } else {
            view.goTo(
                { center: [-74.3, 4.6], zoom: 6 },
                { duration: 900, easing: "ease-in-out" }
            );
        }
    }

    function renderControls() {
        renderSubTabs();
    }
    window.renderControls = renderControls;

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

            if (!content || !title) return;

            title.textContent = "Leyenda";

            if (!labels || !labels.length) {
                content.innerHTML = "<p style='margin:0; color:#666;'>Sin clases</p>";
                return;
            }

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

    async function cargarLimitesMunicipales() {
        return cargarLimitesMunicipalesModulo({
            FeatureLayer,
            map,
            view,
            LIMITES_CONFIG,
            municipioActual,
            clearLayers,
            setLegendLayer,
            updateMapViewBadge,
            actualizarLeyendaLimitesMunicipales,
            renderGraficaLimitesMunicipales,
            setLayerGlobal: (layer) => {
                layerGlobal = layer;
                syncStateFromGlobals();
            },
            setWhereBase: (value) => {
                whereBase = value;
                syncStateFromGlobals();
            }
        });
    }
    async function cargarLimitesDepartamentos() {
        clearLayers();

        const config = LIMITES_CONFIG.DEPARTAMENTOS;
        if (!config) return;

        let whereLimites = "1=1";

        if (deptoActual && deptoActual !== "0" && deptoActual !== "COL") {
            const dep = String(deptoActual).replace(/'/g, "''");
            whereLimites = `${config.filterField} = '${dep}'`;
        }

        whereBase = whereLimites;

        const layer = new FeatureLayer({
            url: config.url,
            definitionExpression: whereLimites,
            outFields: config.outFields || ["*"],
            opacity: 0.85,
            visible: true,
            popupEnabled: true
        });

        layer.popupTemplate = {
            title: "{DeNombre}",
            content: [
                {
                    type: "fields",
                    fieldInfos: [
                        { fieldName: "DeCodigo", label: "Código DANE" },
                        { fieldName: "DeNombre", label: "Departamento" },
                        { fieldName: "DeArea", label: "Área (km²)" },
                        { fieldName: "DeNorma", label: "Normatividad" }
                    ]
                }
            ]
        };

        map.add(layer);
        layerGlobal = layer;
        window.activeFeatureLayer = layer;

        setLegendLayer(layer, config.title);
        updateMapViewBadge("Límites departamentales");

        const legendContent = document.getElementById("legendContent");
        if (legendContent) legendContent.innerHTML = "";

        await layer.when();

        try {
            const res = await layer.queryExtent({ where: whereLimites });
            if (res?.extent) {
                await view.goTo(res.extent.expand(1.15));
            }
        } catch (e) {
            console.warn("No se pudo hacer zoom a departamentos:", e);
        }

        actualizarLeyendaDepartamentosLimites();
        await renderGraficaLimitesDepartamentos(layer, config, whereLimites);
    }
    window.cargarLimitesMunicipales = cargarLimitesMunicipales;
    window.cargarLimitesDepartamentos = cargarLimitesDepartamentos;

    async function renderGraficaLimitesMunicipales(layer, config, whereClause) {
        try {
            const q = layer.createQuery();
            q.where = whereClause || "1=1";
            q.outFields = [
                "OBJECTID",
                config.nameField,
                config.lengthField
            ];
            q.returnGeometry = false;
            q.orderByFields = [`${config.nameField} ASC`];

            const res = await layer.queryFeatures(q);
            const features = res?.features || [];

            if (chartInstance) {
                chartInstance.destroy();
                chartInstance = null;
            }

            const subtabs = document.getElementById("subtabsControls");
            if (subtabs) {
                subtabs.innerHTML = "";
                subtabs.style.display = "none";
            }

            const titleElement = document.getElementById("chartTitle");
            if (titleElement) {
                titleElement.textContent = "Líneas limítrofes";
            }

            const summaryDiv = document.getElementById("summaryDiv");

            if (!features.length) {
                if (summaryDiv) {
                    summaryDiv.innerHTML = "No se encontraron líneas limítrofes para el municipio seleccionado.";
                }
                return;
            }

            const items = features.map(f => {
                const a = f.attributes || {};
                return {
                    oid: a.OBJECTID,
                    nombre: a[config.nameField] || "Sin nombre",
                    km: Number(((Number(a[config.lengthField]) || 0) / 1000).toFixed(2))
                };
            });

            if (summaryDiv) {
                summaryDiv.innerHTML = `
                    <b>Descripción de la línea</b><br>
                    Seleccione una barra o una línea en el mapa.
                `;
            }

            const colors = items.map((_, i) => {
                const palette = [
                    "#0b7fab", "#2c7be5", "#00a884", "#f59e0b",
                    "#ef4444", "#8b5cf6", "#14b8a6", "#64748b"
                ];
                return palette[i % palette.length];
            });

            const ctx = document.getElementById("chart").getContext("2d");

            chartInstance = new Chart(ctx, {
                type: "bar",
                data: {
                    labels: items.map(i => i.nombre),
                    datasets: [{
                        label: "Longitud (Km)",
                        data: items.map(i => i.km),
                        backgroundColor: colors,
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    indexAxis: items.length > 6 ? "y" : "x",
                    plugins: {
                        legend: {
                            display: true,
                            position: "top"
                        },
                        tooltip: {
                            callbacks: {
                                label: ctx => `${Number(ctx.raw || 0).toFixed(2)} Km`
                            }
                        }
                    },
                    scales: {
                        x: {
                            title: {
                                display: true,
                                text: items.length > 6 ? "Longitud (Km)" : "Línea limítrofe"
                            }
                        },
                        y: {
                            title: {
                                display: true,
                                text: items.length > 6 ? "Línea limítrofe" : "Longitud (Km)"
                            },
                            beginAtZero: true
                        }
                    },
                    onClick: async (evt, elements) => {
                        if (!elements.length) return;

                        const idx = elements[0].index;
                        const selected = items[idx];

                        await zoomMapaLineaLimite(selected.oid);
                    },
                    onHover: (event, elements) => {
                        event.native.target.style.cursor = elements.length ? "pointer" : "default";
                    }
                }
            });

        } catch (e) {
            console.error("renderGraficaLimitesMunicipales error:", e);
        }
    }

    async function renderGraficaLimitesDepartamentos(layer, config, whereClause) {
        try {
            const q = layer.createQuery();
            q.where = whereClause || "1=1";
            q.outFields = [
                "OBJECTID",
                config.nameField,
                config.areaField,
                config.normaField
            ];
            q.returnGeometry = false;
            q.orderByFields = [`${config.nameField} ASC`];

            const res = await layer.queryFeatures(q);
            const features = res?.features || [];

            if (chartInstance) {
                chartInstance.destroy();
                chartInstance = null;
            }

            const titleElement = document.getElementById("chartTitle");
            if (titleElement) titleElement.textContent = "Departamentos";

            const summaryDiv = document.getElementById("summaryDiv");

            if (!features.length) {
                if (summaryDiv) summaryDiv.textContent = "No se encontró información departamental.";
                return;
            }

            const items = features.map(f => {
                const a = f.attributes || {};
                return {
                    oid: a.OBJECTID,
                    nombre: a[config.nameField] || "Sin nombre",
                    area: Number(a[config.areaField] || 0),
                    norma: a[config.normaField] || "Sin norma"
                };
            });

            const ctx = document.getElementById("chart").getContext("2d");

            chartInstance = new Chart(ctx, {
                type: "bar",
                data: {
                    labels: items.map(i => i.nombre),
                    datasets: [{
                        label: "Área (km²)",
                        data: items.map(i => i.area),
                        backgroundColor: "#7b3fb2"
                    }]
                },
                options: {
                    responsive: true,
                    indexAxis: items.length > 12 ? "y" : "x",
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: ctx => `${Number(ctx.raw || 0).toLocaleString("es-CO")} km²`
                            }
                        }
                    },
                    scales: {
                        x: {
                            title: {
                                display: true,
                                text: items.length > 12 ? "Área (km²)" : "Departamento"
                            }
                        },
                        y: {
                            title: {
                                display: true,
                                text: items.length > 12 ? "Departamento" : "Área (km²)"
                            }
                        }
                    },
                    onClick: async (evt, elements) => {
                        if (!elements.length) return;
                        const idx = elements[0].index;
                        const selected = items[idx];
                        await zoomMapaDepartamentoLimites(selected.oid);
                    }
                }
            });

            if (summaryDiv) {
                const totalArea = items.reduce((acc, i) => acc + i.area, 0);
                summaryDiv.innerHTML = `
                    <b>Departamentos cargados:</b> ${items.length}<br>
                    <b>Área total:</b> ${totalArea.toLocaleString("es-CO", {
                        maximumFractionDigits: 2
                    })} km²
                `;
            }

        } catch (e) {
            console.error("renderGraficaLimitesDepartamentos error:", e);
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
            const key = String(info.value ?? "").trim();
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

    function applyWhereToActiveLayers(where) {
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

    const highlightWhereDebounced = (() => {
        let t = null;
        return (where) => {
            clearTimeout(t);
            t = setTimeout(() => highlightWhere(where), hoverDebounceMs);
        };
    })();

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
