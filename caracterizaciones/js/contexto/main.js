import {
    DEPTO_ONLY_LAYER_IDS,
    DEPT_TO_MUNI_LAYER_ID 
} from "./js/config.js";

import {
    debounce,

} from "./js/utils.js";

import {
    buildLegendFromRenderer,
    getSymbolColorRGBA,
    syncLegendToLabelSelection,
    sortLegendEntries
} from "./js/legend.js";
import { cargarDeterminantes } from "./js/determinantes.js";

// ─── CONFIG CAPAS CONTEXTO LEGAL ─────────────────────────────
const CL_BASE = "https://mapas2.igac.gov.co/server4/rest/services/ordenamiento/componentecontextolegal/MapServer";
const LAYERS_CONFIG = {
    DETERMINANTES: [
        {
            id: "determinantes_textos",
            title: "Textos",
            url: `${CL_BASE}/19`,
            outFields: ["mpcodigo", "nomdet", "determ", "iddts", "confactadm", "actadm", "descrip", "areat", "porcentaje"],
            isDeterminantes: true,
            isDeterminantesTextos: true
        },
        {
            id: "determinantes_graficos",
            title: "Gráficos",
            url: `${CL_BASE}/19`,
            outFields: ["mpcodigo", "nomdet", "determ", "iddts", "confactadm", "actadm", "descrip", "areat", "porcentaje"],
            isDeterminantes: true,
            isDeterminantesGraficos: true
        },
        {
            id: "determinantes_sinap",
            title: "SINAP",
            url: `${CL_BASE}/19`,
            outFields: ["mpcodigo", "subdet", "porcentaje", "tdeterm", "confactadm"],
            isDeterminantes: true,
            isDeterminantesSinap: true
        },
        {
            id: "determinantes_aeie",
            title: "AEIE y Ecosistemas",
            url: `${CL_BASE}/19`,
            outFields: ["mpcodigo", "subdet", "porcentaje", "tdeterm", "confactadm"],
            isDeterminantes: true,
            isDeterminantesAeie: true
        },
        {
            id: "determinantes_ecc",
            title: "Estrategias de Conservación",
            url: `${CL_BASE}/19`,
            outFields: ["mpcodigo", "subdet", "porcentaje", "tdeterm", "confactadm"],
            isDeterminantes: true,
            isDeterminantesEcc: true
        },
        {
            id: "determinantes_eep",
            title: "Estructura Ecológica Principal",
            url: `${CL_BASE}/19`,
            outFields: ["mpcodigo", "subdet", "porcentaje", "tdeterm", "confactadm"],
            isDeterminantes: true,
            isDeterminantesEep: true
        },
        {
            id: "determinantes_grs",
            title: "Gestión del recurso suelo",
            url: `${CL_BASE}/19`,
            outFields: ["mpcodigo", "subdet", "porcentaje", "tdeterm", "confactadm"],
            isDeterminantes: true,
            isDeterminantesGrs: true
        },
        {
            id: "determinantes_localizacion",
            title: "Localización",
            url: `${CL_BASE}/19`,
            outFields: ["mpcodigo", "subdet", "porcentaje", "tdeterm", "confactadm"],
            isDeterminantes: true,
            isDeterminantesLocalizacion: true
        },
        {
            id: "determinantes_densidades",
            title: "Densidades",
            url: `${CL_BASE}/19`,
            outFields: ["mpcodigo", "subdet", "porcentaje", "tdeterm", "confactadm"],
            isDeterminantes: true,
            isDeterminantesDensidades: true
        },
        {
            id: "determinantes_planificacion",
            title: "Derivadas de instrumentos de planificación",
            url: `${CL_BASE}/19`,
            outFields: ["mpcodigo", "subdet", "descrip", "porcentaje", "tdeterm", "confactadm"],
            isDeterminantes: true,
            isDeterminantesPlanificacion: true
        },
        {
            id: "determinantes_riesgo",
            title: "Gestión del riesgo y Cambio Climático",
            url: `${CL_BASE}/19`,
            outFields: ["mpcodigo", "subdet", "descrip", "porcentaje", "tdeterm", "confactadm"],
            isDeterminantes: true,
            isDeterminantesRiesgo: true
        },
        {
            id: "determinantes_patrimonio",
            title: "Patrimonio cultural",
            url: `${CL_BASE}/19`,
            outFields: ["mpcodigo", "subdet", "descrip", "porcentaje", "tdeterm", "confactadm"],
            isDeterminantes: true,
            isDeterminantesPatrimonio: true
        },
        {
            id: "determinantes_control_capas",
            title: "Control de Capas",
            url: `${CL_BASE}/19`,
            outFields: ["mpcodigo", "subdet", "nomdet", "tdeterm", "confactadm"],
            isDeterminantes: true,
            isDeterminantesControlCapas: true
        }
    ],
    DETERMINANTES_LINEA: [
        {
            id: "determinantes_linea_textos",
            title: "Textos",
            url: `${CL_BASE}/16`,
            outFields: ["mpcodigo", "nomdet", "determ", "iddpl", "descrip"],
            isDeterminantesLinea: true,
            isDeterminantesTextos: true
        },
        {
            id: "determinantes_linea_infraestructura",
            title: "Infraestructura",
            url: `${CL_BASE}/16`,
            outFields: ["mpcodigo", "subdet", "longitud", "tdeterm", "determ"],
            isDeterminantesLinea: true,
            isDeterminantesLineaInfraestructura: true
        }
    ],
    DETERMINANTES_PUNTO: [
        {
            id: "determinantes_punto_textos",
            title: "Textos",
            url: `${CL_BASE}/12`,
            outFields: ["mpcodigo", "nomdet", "determ", "iddpp", "descrip"],
            isDeterminantesPunto: true,
            isDeterminantesTextos: true
        },
        {
            id: "determinantes_punto_patrimoniales",
            title: "Patrimoniales",
            url: `${CL_BASE}/12`,
            outFields: ["mpcodigo", "subdet", "tdeterm", "determ"],
            isDeterminantesPunto: true,
            isDeterminantesPuntoPatrimoniales: true
        },
        {
            id: "determinantes_punto_infraestructura",
            title: "Infraestructura",
            url: `${CL_BASE}/15`,
            outFields: ["mpcodigo", "subdet", "tdeterm", "determ"],
            isDeterminantesPunto: true,
            isDeterminantesPuntoInfraestructura: true
        }
    ],
    CONDICIONANTES: [
        {
            id: "condicionantes_textos",
            title: "Textos",
            url: `${CL_BASE}/24`,
            outFields: ["*"],
            isCondicionantes: true,
            isCondicionantesTextos: true
        },
        {
            id: "condicionantes_graficos",
            title: "Gráficos",
            url: `${CL_BASE}/24`,
            outFields: ["*"],
            isCondicionantes: true,
            isCondicionantesGraficos: true
        },
        {
            id: "condicionantes_territorios_colectivos",
            title: "Distribución",
            url: `${CL_BASE}/24`,
            outFields: ["*"],
            isCondicionantes: true,
            isCondicionantesTerritoriosColectivos: true
        },
        {
            id: "condicionantes_acuerdo_paz",
            title: "Acuerdo Final de Paz",
            url: `${CL_BASE}/24`,
            outFields: ["*"],
            isCondicionantes: true,
            isCondicionantesAcuerdoPaz: true
        },
        {
            id: "condicionantes_recursos",
            title: "Recursos No Renovables",
            url: `${CL_BASE}/24`,
            outFields: ["*"],
            isCondicionantes: true,
            isCondicionantesRecursos: true
        }

    ]
};
// ─────────────────────────────────────────────────────────────
let sliderMode = "zoom"; // "zoom" | "time"




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
    const list = LAYERS_CONFIG[mode] || [];

    // Si estoy filtrando por departamento -> SOLO las depto
    if (filtroNivel === "DEPTO") {
        return list.filter(l => DEPTO_ONLY_LAYER_IDS.has(l.id));
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
    const activeList = getLayerListForCurrentLevel();
    if (!activeList.length) {
        currentSubLayerIndex = 0;
        return;
    }
    if (currentSubLayerIndex < 0) currentSubLayerIndex = 0;
    if (currentSubLayerIndex >= activeList.length) currentSubLayerIndex = 0;
}

// Estado Global
let currentMode = 'DETERMINANTES'; // modo actual de contexto legal
let currentMainModule = "CONTEXTO_LEGAL"; // CONTEXTO_LEGAL | ORDENAMIENTO
let currentOrdenamientoTab = "CLASIFICACION_SUELO";
let currentRuralChartView = "CATEGORIA"; // "CATEGORIA" | "USO_PRINCIPAL"
const STATIONS_LAYER_URL = "https://mapas2.igac.gov.co/server/rest/services/ordenamiento/componentebiofisico/MapServer/11";
let stationsLayer = null;

let currentSubLayerIndex = 2; // Índice dentro del array de configuration
let layerGlobal = null;
let layerViewGlobal = null;
let whereBase = "";
let municipioActual = "";
let chartInstance = null;
let diccionarioMunicipios = {};
let pChartInstances = { 1985: null, 1993: null, 2005: null, 2018: null };
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

function rgbaArrayToCss(arr, fallback = "#999") {
    if (!Array.isArray(arr) || arr.length < 3) return fallback;
    const [r, g, b, a = 255] = arr;
    return `rgba(${r}, ${g}, ${b}, ${a / 255})`;
}




function setActiveVariantLayerByScale() {
    if (!layersGlobal?.length || !view) return;

    const desired = pickLayerByScale(layersGlobal);
    if (!desired) return;

    // Cambiar visibilidad
    layersGlobal.forEach(l => (l.visible = (l === desired)));

    const changed = desired !== layerGlobal;
    layerGlobal = desired;

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
        if (![19, 20, 21].includes(layerGlobal.layerId)) {
            layerGlobal.labelsVisible = false;
            layerGlobal.labelingInfo = [];
        }

        if (typeof updateLegendByExtent === "function") {
            updateLegendByExtent(layerGlobal, config);
        }
    }
}

function destroyLayerSafe(layer) {
    try { layer?.destroy?.(); } catch (e) { }
}

function clearLayers() {
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

    lastHoverWhere = "";
    legendFilterLabel = null;

    // limpiar variantes
    if (layersGlobal.length) {
        layersGlobal.forEach(l => {
            try { map.remove(l); } catch (e) { }
            destroyLayerSafe(l);
        });
        layersGlobal = [];
    }

    // limpiar capa principal
    if (layerGlobal) {
        try { map.remove(layerGlobal); } catch (e) { }
        destroyLayerSafe(layerGlobal);
    }

    layerGlobal = null;
    chartLayerGlobal = null;
    layerViewGlobal = null;
    window.activeFeatureLayer = null;

    // limpiar estaciones
    if (stationsLayer) {
        try { map.remove(stationsLayer); } catch (e) { }
        destroyLayerSafe(stationsLayer);
        stationsLayer = null;
    }

    // limpiar estados de leyenda y selecciones visuales
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

    // limpiar fuente del mapa
    const fuenteDiv = document.getElementById("mapSource");
    if (fuenteDiv) {
        fuenteDiv.textContent = "";
    }
}

function pickLayerByScale(layers) {
    if (!view) return layers[0];

    const s = Number(view.scale);
    if (!Number.isFinite(s)) return layers[0];

    return (
        layers.find(l =>
            (l.minScale === 0 || s <= l.minScale) &&
            (l.maxScale === 0 || s >= l.maxScale)
        ) || layers[0]
    );
}
// Diccionario simple para geoformas (ejemplo simplificado, idealmente cargar de servicio o JSON completo)
// Como el renderer usa unique values complejos, simplificaremos mostrando el código o texto si viene disponible.
// En el JSON vimos que el renderer usa valores combinados.
// Para este ejercicio asumo que usaremos los campos disponibles para agrupar.


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
    const list = getLayerListForCurrentLevel(currentMode);
    return (list && list[currentSubLayerIndex]) ? list[currentSubLayerIndex] : null;
}
function updateMapViewBadge(nombre) {
    const badgeText = document.getElementById("mapViewBadgeText");
    if (!badgeText) return;
    badgeText.textContent = nombre || "Vista";
}
function getCurrentModeLabel(mode = currentMode) {
    const labels = {
        DETERMINANTES: "Determinantes",
        DETERMINANTES_LINEA: "Determinantes Línea",
        DETERMINANTES_PUNTO: "Determinantes Punto",
        CONDICIONANTES: "Condicionantes"
    };
    return labels[mode] || mode || "Vista";
}



function setLegendLayer(layer, titleText) {
    const title = document.getElementById("legendTitle");
    if (title) title.textContent = titleText || "Leyenda";
}
function initModuleDropdown(dropdownId, triggerId, menuSelector, onItemClick = null) {
    const dropdown = document.getElementById(dropdownId);
    const trigger = document.getElementById(triggerId);
    const menu = dropdown?.querySelector(menuSelector);
    const items = dropdown?.querySelectorAll(".dropdown-item");

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
                console.log("Seleccionado:", target);
            }

            dropdown.classList.remove("open");
        };
    });
}

function initAllDropdowns() {
    document.addEventListener("click", function (e) {
        document.querySelectorAll(".modulo-dropdown.open").forEach(dropdown => {
            if (!dropdown.contains(e.target)) {
                dropdown.classList.remove("open");
            }
        });
    });

    initModuleDropdown("ocupacionDropdown", "ocupacionTrigger", ".dropdown-menu-custom", function (target) {
        ModuleNavigation.navigateToComponent("ocupacion.html", target);
    });

    initModuleDropdown("limitesDropdown", "limitesTrigger", ".dropdown-menu-custom", function (target) {
        ModuleNavigation.navigateToComponent("limites.html", target);
    });

    initModuleDropdown("ordenamientoDropdown", "ordenamientoTrigger", ".dropdown-menu-custom", function (target) {
        ModuleNavigation.navigateToComponent("ordenamiento.html", target);
    });

    initModuleDropdown("legalDropdown", "legalTrigger", ".dropdown-menu-custom", function (target) {
        if (target === "Determinantes") {
            if (typeof window.setMode === "function") window.setMode("DETERMINANTES");
        } else if (target === "Determinantes Linea") {
            if (typeof window.setMode === "function") window.setMode("DETERMINANTES_LINEA");
        } else if (target === "Determinantes Punto") {
            if (typeof window.setMode === "function") window.setMode("DETERMINANTES_PUNTO");
        } else if (target === "Condicionantes") {
            if (typeof window.setMode === "function") window.setMode("CONDICIONANTES");
        }
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
        console.log("Dropdown descargables no encontrado");
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
                console.log("Descargar base de datos espacial");
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

], function (EsriMap, MapView, FeatureLayer, Basemap, TileLayer, VectorTileLayer, Legend,
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
        await manejarClickMapa(event);
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
            console.log("No se pudo obtener la fuente para esta capa.");
        });
    }

    function showTimeSlider() { }

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

    function handleTimeSliderInput() { }

    const scaleBar = new ScaleBar({
        view: view,
        unit: "metric",    
        style: "ruler"    
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


    // ====== OVERVIEW (MINIMAPA) ======
    const overviewMap = new EsriMap({
        basemap: igacSatelitalTopo
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
            DETERMINANTES: "btnDeterminantes",
            CONDICIONANTES: "btnCondicionantes"
        };

        const id = map[mode];
        if (id) document.getElementById(id)?.classList.add("active");

        syncDropdownLegal(mode);
    }

    function syncDropdownLegal(mode) {
        const items = document.querySelectorAll("#dropdownLegal .dropdown-item");
        if (!items.length) return;

        items.forEach(i => i.classList.remove("active"));

        const map = {
            DETERMINANTES: "Determinantes",
            DETERMINANTES_LINEA: "Determinantes Linea",
            DETERMINANTES_PUNTO: "Determinantes Punto",
            CONDICIONANTES: "Condicionantes"
        };

        const target = map[mode];
        if (target) {
            items.forEach(i => {
                if (i.dataset.target === target) i.classList.add("active");
            });
        }
    }

    // Inicialización
    init();



    function init() {
        document.getElementById("btnDeterminantes").onclick = () => setMode("DETERMINANTES");
        document.getElementById("btnCondicionantes").onclick = () => setMode("CONDICIONANTES");

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

        if (currentMainModule === "ORDENAMIENTO") {
            updateMapViewBadge("Ordenamiento Territorial");
        } else {
            updateMapViewBadge(getCurrentModeLabel(currentMode));
        }

        // Limpiar resumen / determinantes panel
        const summaryDiv = document.getElementById("summaryDiv");
        if (summaryDiv) summaryDiv.innerHTML = 'Seleccione un municipio para ver las determinantes.';

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
        currentMainModule = "CONTEXTO_LEGAL";
        currentMode = mode;
        currentSubLayerIndex = 0;

        updateNavbarActive(mode);
        clampSubLayerIndex();
        renderSubTabs();
        updateMapViewBadge(getCurrentModeLabel(mode));

        // Update panel title
        const ct = document.getElementById("chartTitle");
        if (ct) ct.textContent = getCurrentModeLabel(mode);

        // Clear the summary panel when switching modes to avoid showing stale data (like accordions from another tab)
        const summaryDiv = document.getElementById("summaryDiv");
        if (summaryDiv) summaryDiv.innerHTML = "";

        if (municipioActual || (filtroNivel === "DEPTO" && deptoActual)) {
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

    function prevLayer() {
        if (currentMainModule === "ORDENAMIENTO") return;

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
        if (currentMainModule === "ORDENAMIENTO") return;

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
        const url = "https://mapas2.igac.gov.co/server/rest/services/ordenamiento/componenteocupacion/MapServer/40";
        const queryUrl = `${url}/query?where=mpcodigo='${codigo}'&outFields=*&returnGeometry=false&f=json`;
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
        const config = getActiveLayerConfig();
        const chartCanvas = document.getElementById("chart");

        if (currentMode === "DETERMINANTES") {
            if (config && config.isDeterminantesGraficos) {
                if (chartCanvas) chartCanvas.style.display = "block";
                cargarDeterminantesGraficos(municipioActual, "#chart", "#summaryDiv");
            } else if (config && config.isDeterminantesSinap) {
                if (chartCanvas) chartCanvas.style.display = "block";
                cargarDeterminantesSinap(municipioActual, "#chart", "#summaryDiv");
            } else if (config && config.isDeterminantesAeie) {
                if (chartCanvas) chartCanvas.style.display = "block";
                cargarDeterminantesAeie(municipioActual, "#chart", "#summaryDiv");
            } else if (config && config.isDeterminantesEcc) {
                if (chartCanvas) chartCanvas.style.display = "block";
                cargarDeterminantesEcc(municipioActual, "#chart", "#summaryDiv");
            } else if (config && config.isDeterminantesEep) {
                if (chartCanvas) chartCanvas.style.display = "block";
                cargarDeterminantesEep(municipioActual, "#chart", "#summaryDiv");
            } else if (config && config.isDeterminantesGrs) {
                if (chartCanvas) chartCanvas.style.display = "block";
                cargarDeterminantesGrs(municipioActual, "#chart", "#summaryDiv");
            } else if (config && config.isDeterminantesLocalizacion) {
                if (chartCanvas) chartCanvas.style.display = "block";
                cargarDeterminantesLocalizacion(municipioActual, "#chart", "#summaryDiv");
            } else if (config && config.isDeterminantesDensidades) {
                if (chartCanvas) chartCanvas.style.display = "block";
                cargarDeterminantesDensidades(municipioActual, "#chart", "#summaryDiv");
            } else if (config && config.isDeterminantesPlanificacion) {
                if (chartCanvas) chartCanvas.style.display = "block";
                cargarDeterminantesPlanificacion(municipioActual, "#chart", "#summaryDiv");
            } else if (config && config.isDeterminantesRiesgo) {
                if (chartCanvas) chartCanvas.style.display = "block";
                cargarDeterminantesRiesgo(municipioActual, "#chart", "#summaryDiv");
            } else if (config && config.isDeterminantesPatrimonio) {
                if (chartCanvas) chartCanvas.style.display = "block";
                cargarDeterminantesPatrimonio(municipioActual, "#chart", "#summaryDiv");
            } else if (config && config.isDeterminantesControlCapas) {
                if (chartCanvas) chartCanvas.style.display = "none";
                const chartTitle = document.getElementById("chartTitle");
                if (chartTitle) chartTitle.textContent = "Control de Capas (Planificación y Riesgo)";
                cargarDeterminantesControlCapas(municipioActual, "#summaryDiv");
            } else if (config && config.isDeterminantesTextos) {
                if (chartCanvas) chartCanvas.style.display = "none";
                cargarDeterminantesTextos(municipioActual, "#summaryDiv");
            } else {
                if (chartCanvas) chartCanvas.style.display = "none";
                if (window.determinantesChartInstance) {
                    window.determinantesChartInstance.destroy();
                    window.determinantesChartInstance = null;
                }
                cargarDeterminantes(municipioActual, "#summaryDiv");
            }
        } else if (currentMode === "DETERMINANTES_LINEA") {
            if (config && config.isDeterminantesLineaInfraestructura) {
                if (chartCanvas) chartCanvas.style.display = "block";
                cargarDeterminantesLineaInfraestructura(municipioActual, "#chart", "#summaryDiv");
            } else if (config && config.isDeterminantesTextos) {
                if (chartCanvas) chartCanvas.style.display = "none";
                cargarDeterminantesTextos(municipioActual, "#summaryDiv");
            } else {
                if (chartCanvas) chartCanvas.style.display = "none";
                if (window.determinantesChartInstance) {
                    window.determinantesChartInstance.destroy();
                    window.determinantesChartInstance = null;
                }
            }
        } else if (currentMode === "DETERMINANTES_PUNTO") {
            if (config && config.isDeterminantesPuntoPatrimoniales) {
                if (chartCanvas) chartCanvas.style.display = "block";
                cargarDeterminantesPuntoPatrimoniales(municipioActual, "#chart", "#summaryDiv");
            } else if (config && config.isDeterminantesPuntoInfraestructura) {
                if (chartCanvas) chartCanvas.style.display = "block";
                cargarDeterminantesPuntoInfraestructura(municipioActual, "#chart", "#summaryDiv");
            } else if (config && config.isDeterminantesTextos) {
                if (chartCanvas) chartCanvas.style.display = "none";
                cargarDeterminantesTextos(municipioActual, "#summaryDiv");
            } else {
                if (chartCanvas) chartCanvas.style.display = "none";
                if (window.determinantesChartInstance) {
                    window.determinantesChartInstance.destroy();
                    window.determinantesChartInstance = null;
                }
            }
        } else if (currentMode === "CONDICIONANTES") {
            if (window.determinantesChartInstance) {
                window.determinantesChartInstance.destroy();
                window.determinantesChartInstance = null;
            }
            if (typeof actualizarLeyenda === 'function') actualizarLeyenda([], []);
            const ct = document.getElementById("chartTitle");
            if (ct) ct.textContent = "Condicionantes";

            const sd = document.getElementById("summaryDiv");
            if (config && config.isCondicionantesTerritoriosColectivos) {
                if (chartCanvas) chartCanvas.style.display = "block";
                if (sd) sd.innerHTML = "";
                if (municipioActual && typeof cargarCondicionantesTerritoriosColectivos === "function") {
                    cargarCondicionantesTerritoriosColectivos(municipioActual, "#chart");
                } else if (!municipioActual && sd) {
                    sd.innerHTML = "Seleccione un municipio para ver los territorios colectivos.";
                }
            } else if (config && config.isCondicionantesRecursos) {
                if (chartCanvas) chartCanvas.style.display = "block";
                if (sd) sd.innerHTML = "";
                if (municipioActual && typeof cargarCondicionantesRecursos === "function") {
                    cargarCondicionantesRecursos(municipioActual, "#chart");
                } else if (!municipioActual && sd) {
                    sd.innerHTML = "Seleccione un municipio para ver la explotación de recursos no renovables.";
                }
            } else if (config && config.isCondicionantesAcuerdoPaz) {
                if (chartCanvas) chartCanvas.style.display = "block";
                if (sd) sd.innerHTML = "";
                if (municipioActual && typeof cargarCondicionantesAcuerdoPaz === "function") {
                    cargarCondicionantesAcuerdoPaz(municipioActual, "#chart");
                } else if (!municipioActual && sd) {
                    sd.innerHTML = "Seleccione un municipio para ver el acuerdo final de paz.";
                }
            } else if (config && config.isCondicionantesGraficos) {
                if (chartCanvas) chartCanvas.style.display = "block";
                if (sd) sd.innerHTML = "";
                if (municipioActual && typeof cargarCondicionantesGrafico === "function") {
                    cargarCondicionantesGrafico(municipioActual, "#chart");
                } else if (!municipioActual && sd) {
                    sd.innerHTML = "Seleccione un municipio para ver los condicionantes.";
                }
            } else if (config && config.isCondicionantesTextos) {
                if (chartCanvas) chartCanvas.style.display = "none";
                if (sd) {
                    if (!municipioActual) {
                        sd.innerHTML = "Seleccione un municipio para ver los textos.";
                    } else {
                        if (typeof cargarCondicionantes === "function") {
                            cargarCondicionantes(municipioActual, "#summaryDiv");
                        } else {
                            sd.innerHTML = "Módulo Condicionantes - En desarrollo.";
                        }
                    }
                }
            }
        } else {
            if (chartCanvas) chartCanvas.style.display = "none";
            if (window.determinantesChartInstance) {
                window.determinantesChartInstance.destroy();
                window.determinantesChartInstance = null;
            }
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

            // --- Desduplicar etiquetas nativamente en contexto.html ---
            const seen = new Set();
            const uniqLabels = [];
            const uniqColors = [];
            const uniqCodes = codes ? [] : null;

            for (let i = 0; i < labels.length; i++) {
                const lbl = String(labels[i] || "").trim();
                const colorKey = String(colors[i] || "").trim();
                const key = lbl + "|" + colorKey;

                if (!seen.has(key)) {
                    seen.add(key);
                    uniqLabels.push(labels[i]);
                    uniqColors.push(colors[i]);
                    if (codes) uniqCodes.push(codes[i]);
                }
            }
            labels = uniqLabels;
            colors = uniqColors;
            if (codes) codes = uniqCodes;
            // -----------------------------------------------------------

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


    function cargarCapaActual() {
        if (currentMainModule !== "CONTEXTO_LEGAL" && currentMainModule !== "ORDENAMIENTO") {
            console.log("cargarCapaActual: módulo no soportado", currentMainModule);
            return;
        }
        renderCycleId++;
        const config = getActiveLayerConfig();
        if (!config) return;


        clearLayers();

        // Reset paneles al cambiar cualquier sub-capa
        if (typeof destroyPiramidesCharts === 'function') destroyPiramidesCharts();
        if (typeof togglePiramidesCharts === 'function') togglePiramidesCharts(false);
        if (typeof destroyTransicionCharts === 'function') destroyTransicionCharts();
        if (typeof toggleTransicionCharts === 'function') toggleTransicionCharts(false);

        // =========================
        // CASO VARIANTS (29/30, cuencas 19/20/21, etc.)
        // =========================
        if (Array.isArray(config.variants) && config.variants.length) {

            const vLayers = config.variants.map(v => {
                const l = new FeatureLayer({
                    url: v.url,
                    definitionExpression: whereBase,
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

            const active = pickLayerByScale(layersGlobal);
            layersGlobal.forEach(ly => ly.visible = (ly === active));
            layerGlobal = active;

            window.activeFeatureLayer = active;
            view.whenLayerView(active).then(layerView => {
                layerView.filter = null;
            }).catch(() => { });
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
                    const lid = layerGlobal.layerId;

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
                    .catch(() => { });

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

                /* actualizarGrafica omitted */

                // Leyenda: solo actualizar desde renderer si el handler NO la gestiona
                if (!config.isDistribucion && typeof updateLegendByExtent === "function") {
                    updateLegendByExtent(active, config);
                } else if (!config.isDistribucion) {
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

        const visualUrl = config.mapLayerUrl || config.url;
        let defExpr = whereBase;
        if (config.isDeterminantes || config.isCondicionantes) {
            defExpr = whereBase ? `${whereBase} AND confactadm = 1` : "confactadm = 1";
        }

        let customRenderer = null;
        if (config.isDeterminantes) {
            customRenderer = {
                type: "unique-value",
                field: "determ",
                uniqueValueInfos: [
                    { value: 1, label: "Ambientales", symbol: { type: "simple-fill", color: "#70ad47", outline: { color: "#666", width: 0.5 } } },
                    { value: 2, label: "Soberania Alimentaria", symbol: { type: "simple-fill", color: "#ffc000", outline: { color: "#666", width: 0.5 } } },
                    { value: 3, label: "Patrimoniales", symbol: { type: "simple-fill", color: "#7030a0", outline: { color: "#666", width: 0.5 } } },
                    { value: 4, label: "Infraestructura", symbol: { type: "simple-fill", color: "#a6a6a6", outline: { color: "#666", width: 0.5 } } },
                    { value: 5, label: "Áreas Metropolitanas y Suburbanización", symbol: { type: "simple-fill", color: "#ed4de0", outline: { color: "#666", width: 0.5 } } },
                    { value: 6, label: "Proyectos Turísticos Especiales", symbol: { type: "simple-fill", color: "#4472c4", outline: { color: "#666", width: 0.5 } } }
                ]
            };
        } else if (config.isCondicionantes) {
            customRenderer = {
                type: "unique-value",
                field: "tcondi",
                uniqueValueInfos: [
                    { value: 1, label: "Territorios Colectivos", symbol: { type: "simple-fill", color: "#FFC000", outline: { color: "#666", width: 0.5 } } },
                    { value: 2, label: "Exploración y Explotación de Recursos No Renovables (ERNR)", symbol: { type: "simple-fill", color: "#B58B5D", outline: { color: "#666", width: 0.5 } } },
                    { value: 3, label: "Acuerdo de Paz", symbol: { type: "simple-fill", color: "#EAEAEA", outline: { color: "#666", width: 0.5 } } },
                    { value: 4, label: "Planes de Ordenamiento Sobre la Propiedad Rural (POSPR)", symbol: { type: "simple-fill", color: "#92D050", outline: { color: "#666", width: 0.5 } } },
                    { value: 5, label: "Zonas más Afectadas por el Conflicto Armado (ZOMAC)", symbol: { type: "simple-fill", color: "#C55A11", outline: { color: "#666", width: 0.5 } } }
                ]
            };
        } else if (config.isDeterminantesLineaInfraestructura) {
            customRenderer = {
                type: "unique-value",
                field: "subdet",
                uniqueValueInfos: [
                    { value: 1301, label: "Reservas de la red vial nacional o regional", symbol: { type: "simple-line", color: "#e6194B", width: 2 } },
                    { value: 1302, label: "Puertos y aeropuertos", symbol: { type: "simple-line", color: "#f58231", width: 2 } },
                    { value: 1303, label: "Red Férrea", symbol: { type: "simple-line", color: "#ffe119", width: 2 } },
                    { value: 1304, label: "Sistemas de abastecimiento y saneamiento de agua (Plantas de Tratamiento PTAR - Sistemas de Tratamiento STAR)", symbol: { type: "simple-line", color: "#bfef45", width: 2 } },
                    { value: 1305, label: "Suministro de energía (Lineas de Transmisión - Subestaciones - Represas)", symbol: { type: "simple-line", color: "#3cb44b", width: 2 } },
                    { value: 1306, label: "Disposición de residuos solidos (Rellenos Sanitarios)", symbol: { type: "simple-line", color: "#42d4f4", width: 2 } },
                    { value: 1307, label: "Equipamientos Colectivos de Alto Impacto Ambiental (Cementerios - Hornos Crematorios - Plantas de Beneficio Animal - Criaderos Animales - Sacrificios Animales)", symbol: { type: "simple-line", color: "#4363d8", width: 2 } },
                    { value: 1308, label: "Gasoducto", symbol: { type: "simple-line", color: "#911eb4", width: 2 } },
                    { value: 1309, label: "Poliducto", symbol: { type: "simple-line", color: "#f032e6", width: 2 } },
                    { value: 1310, label: "Transporte de Hidrocarburos (Oleoductos - Combustoleoductos)", symbol: { type: "simple-line", color: "#a9a9a9", width: 2 } },
                    { value: 1311, label: "Telecomunicaciones", symbol: { type: "simple-line", color: "#800000", width: 2 } }
                ]
            };
        } else if (config.isDeterminantesPuntoInfraestructura) {
            customRenderer = {
                type: "unique-value",
                field: "subdet",
                uniqueValueInfos: [
                    { value: 1301, label: "Puerto", symbol: { type: "simple-marker", style: "circle", color: "#e6194B", outline: { color: "#ffffff", width: 1 } } },
                    { value: 1302, label: "Aeropuerto", symbol: { type: "simple-marker", style: "circle", color: "#f58231", outline: { color: "#ffffff", width: 1 } } },
                    { value: 1303, label: "Infraestructura", symbol: { type: "simple-marker", style: "circle", color: "#ffe119", outline: { color: "#ffffff", width: 1 } } }
                ]
            };
        }

        const newLayer = new FeatureLayer({
            url: visualUrl,
            definitionExpression: defExpr,
            // Si usamos una visualUrl distinta (como en pirámides), pedir todos los campos (*) 
            // de esa capa visual para evitar errores con campos de la tabla original
            outFields: (visualUrl !== config.url) ? ["*"] : (config.outFields || ["*"]),
            opacity: 0.8,
            visible: true,
            renderer: customRenderer || undefined,
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

        // Solo intentar layerview si no es tabla
        newLayer.when(() => {
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
            if (currentCycle !== renderCycleId || layerGlobal !== newLayer || newLayer.destroyed) return;

            try {
                // Solo queryExtent si es una capa espacial (no tabla)
                if (newLayer.isTable === false) {
                    const res = await newLayer.queryExtent({ where: whereBase });
                    if (currentCycle !== renderCycleId || layerGlobal !== newLayer || newLayer.destroyed) return;
                    if (res?.extent) {
                        await view.goTo(res.extent.expand(1.2));
                    }
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

            // Si la visual es distinta a la de datos (pirámides), crear capa de datos específica para el gráfico
            let dataLayer = newLayer;
            if (config.mapLayerUrl && config.mapLayerUrl !== config.url) {
                dataLayer = new FeatureLayer({ url: config.url });
            }

            /* actualizarGrafica omitted */

            if (currentCycle !== renderCycleId || layerGlobal !== newLayer || newLayer.destroyed) return;

            // Leyenda: solo actualizar desde renderer si el handler NO la gestiona (excluir isDistribucion, isPiramides, isTransicion, isDeterminantes, isDeterminantesLinea, isCondicionantes)
            const skipLegendUpdate = config.isDistribucion || config.isPiramides || config.isTransicion || config.isDeterminantes || config.isDeterminantesLinea || config.isCondicionantes;

            if (!skipLegendUpdate && typeof updateLegendByExtent === "function") {
                updateLegendByExtent(newLayer, config);
            } else if (!skipLegendUpdate) {
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
            // No sobreescribir leyenda si el handler la gestiona
            const skipLegendUpdate = cfg?.isDistribucion || cfg?.isPiramides || cfg?.isTransicion || cfg?.isDeterminantes || cfg?.isDeterminantesLinea;

            if (cfg && !skipLegendUpdate && typeof updateLegendByExtent === "function") {
                updateLegendByExtent(newLayer, cfg);
            }
        });

    
    }

    const CLASIFICACION_SUELO_PALETTE = {
        "1": {
            label: "Urbano",
            fillColor: "rgba(204, 140, 0, 1)",
            outlineColor: "rgba(204, 140, 0, 1)",
            outlineWidth: 1
        },
        "2": {
            label: "Rural",
            fillColor: "rgba(233, 255, 190, 1)",
            outlineColor: "rgba(207, 230, 166, 1)",
            outlineWidth: 1
        },
        "3": {
            label: "Expansión urbana",
            fillColor: "rgba(166, 13, 13, 1)",
            outlineColor: "rgba(166, 13, 13, 1)",
            outlineWidth: 1
        }
    };


    function applyLegendFilter() {
        const state = window.__legendState;
        if (!state || !state.layer || !state.field) return;

        const codes = Array.from(state.activeCodes);

        // si no hay activos, apaga todo
        if (!codes.length) {
            state.layer.definitionExpression = "1=0";
            return;
        }

        // detectar si el campo es numérico
        const fieldInfo = (state.layer.fields || []).find(f => f.name === state.field);
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
            whereLegend = `(${state.field} IN (${nonNullValues.join(",")}) OR ${state.field} IS NULL)`;
        } else if (nonNullValues.length) {
            whereLegend = `${state.field} IN (${nonNullValues.join(",")})`;
        } else if (hasNull) {
            whereLegend = `${state.field} IS NULL`;
        } else {
            whereLegend = "1=0";
        }

        const baseWhere = state.baseWhere && state.baseWhere.trim() ? `(${state.baseWhere})` : "1=1";
        state.layer.definitionExpression = `${baseWhere} AND (${whereLegend})`;
    }


    async function cargarMunicipios() {
        if (Object.keys(diccionarioMunicipios).length === 0) {
            await cargarDiccionarioMunicipios();
        }

        // Capa de referencia para municipios (Determinantes del contexto legal)
        const tempLayer = new FeatureLayer({
            url: (LAYERS_CONFIG.DETERMINANTES?.[0] || {}).url ||
                `${CL_BASE}/19`
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
                const depto = codigo.substring(0, 2); // Los primeros 2 dígitos son el código del departamento
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

        if (currentMainModule === "ORDENAMIENTO") {
            deptoActual = deptoSeleccionado;
            filtroNivel = deptoSeleccionado && deptoSeleccionado !== "0" ? "DEPTO" : "";

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
            currentSubLayerIndex = 0;
            renderControls();
            whereBase = `dpcodigo = '${deptoSeleccionado}'`;
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
        deptoActual = codigo.substring(0, 2);

        renderControls();

        const prevList = getLayerListForCurrentLevel(currentMode);
        const prevCfg = prevList?.[currentSubLayerIndex];
        const prevId = prevCfg?.id;

        whereBase = `mpcodigo = '${codigo}'`;

        ensureMunicipalLayerIndex(prevId);
        cargarInfoMunicipio(codigo);
        cargarCapaActual();


    };


    let tChartInstance = null;


    async function syncMapLayer(ctx) {
        const lyr = ctx.lyr || ctx.layer;
        if (!lyr) return;

        lyr.visible = true;

        if (typeof lyr.opacity === "number" && lyr.opacity === 0) {
            lyr.opacity = 0.7;
        }

        try {
            lyr.definitionExpression = ctx.whereBase || "1=1";
        } catch (_) { }

        try { lyr.refresh(); } catch (_) { }

        // Si hay una leyenda activa, la reaplicamos encima del whereBase
        try {
            if (window.__legendState?.field) {
                await applyLegendFilter();
            }
        } catch (_) { }
    }

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


    const btnVerTodo = document.getElementById("btnVerTodo");
    if (btnVerTodo) {
        btnVerTodo.onclick = () => {
            if (!layerGlobal) return;

            applyWhereToActiveLayers(whereBase);
            updateLegendByExtent?.(layerGlobal, getActiveLayerConfig());

            layerGlobal.queryExtent({ where: whereBase }).then(res => {
                if (res.extent) view.goTo(res.extent.expand(1.2));
            });
        };
    }

    // --- Autoselección por URL ---
    function resolveContextoModeFromTab(tabUrl) {
        const tab = String(tabUrl || "");
        if (tab === "Determinantes" || tab === "Determinantes Polígono") return "DETERMINANTES";
        if (tab === "Determinantes Linea" || tab === "Determinantes Línea") return "DETERMINANTES_LINEA";
        if (tab === "Determinantes Punto") return "DETERMINANTES_PUNTO";
        if (tab === "Condicionantes") return "CONDICIONANTES";
        return null;
    }

    function applyContextoTabFromUrl(tabUrl) {
        const mode = resolveContextoModeFromTab(tabUrl);
        if (mode && typeof window.setMode === "function") {
            window.setMode(mode);
        }
    }

    const urlContext = ModuleNavigation.parseComponentUrlParams();

    ModuleNavigation.applyTerritorySelectionFromUrl({
        onTab(tabUrl) {
            if (!urlContext.municipioId && !urlContext.deptoId) {
                applyContextoTabFromUrl(tabUrl);
            }
        },
        onApplied({ tab }) {
            if (tab) {
                applyContextoTabFromUrl(tab);
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

    // ─── REQUERIMIENTO 1: GRÁFICOS DINÁMICOS DETERMINANTES ───
    const categoryNames = {
        1: "Ambientales",
        2: "Soberania Alimentaria",
        3: "Patrimoniales",
        4: "Infraestructura",
        5: "Áreas Metropolitanas y Suburbanización",
        6: "Proyectos Turísticos Especiales"
    };
    const categoryColors = {
        1: "#70ad47",
        2: "#ffc000",
        3: "#7030a0",
        4: "#a6a6a6",
        5: "#ed4de0",
        6: "#4472c4"
    };

    async function cargarDeterminantesGraficos(mpcodigo, chartSelector, summarySelector) {
        const container = document.querySelector(summarySelector || "#summaryDiv");
        const canvas = document.querySelector(chartSelector || "#chart");
        if (!container || !canvas) return;

        if (!mpcodigo) {
            canvas.style.display = "none";
            if (window.determinantesChartInstance) {
                window.determinantesChartInstance.destroy();
                window.determinantesChartInstance = null;
            }
            container.innerHTML = '<p style="margin:0;color:#666;">Seleccione un municipio para ver los gráficos.</p>';
            return;
        }

        container.innerHTML = '<p style="margin:0;color:#666;">Cargando datos...</p>';
        canvas.style.display = "block";

        try {
            const where = "mpcodigo = '" + mpcodigo + "' AND confactadm = 1";
            const qUrl = "https://mapas2.igac.gov.co/server4/rest/services/ordenamiento/componentecontextolegal/MapServer/19/query"
                + "?where=" + encodeURIComponent(where)
                + "&outFields=determ,descrip,mpnombre,dpnombre&returnGeometry=false&f=json";
            const res = await fetch(qUrl).then(r => r.json());
            const features = res?.features || [];

            let mpNombre = mpcodigo;
            let dpNombre = "";
            if (features.length > 0) {
                mpNombre = features[0].attributes.mpnombre || mpcodigo;
                dpNombre = features[0].attributes.dpnombre || "";
            } else if (typeof municipioInfo !== 'undefined' && municipioInfo) {
                mpNombre = municipioInfo.mpnombre || municipioInfo.nombre_mpio || mpcodigo;
                dpNombre = municipioInfo.dpnombre || municipioInfo.nombre_dpto || "";
            }
            const chartTitle = document.getElementById("chartTitle");
            if (chartTitle) chartTitle.textContent = dpNombre ? `Distribución de los determinantes del ${mpNombre}, ${dpNombre}` : `Distribución de los determinantes del ${mpNombre}`;

            const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
            let generalDescrip = "";
            features.forEach(f => {
                const det = Number(f.attributes.determ);
                if (counts[det] !== undefined) counts[det]++;

                // Capturar la primera descripción válida para mostrarla de forma general
                if (f.attributes.descrip && !generalDescrip) {
                    generalDescrip = f.attributes.descrip;
                }
            });

            // Filtrar dinámicamente para que solo aparezcan en la gráfica y leyenda los que tienen > 0
            const activeLabels = [];
            const activeData = [];
            const activeBgColors = [];
            const activeUniqueValues = [];
            const activeCategoryNums = [];

            // Iterar en reversa (6 a 1) para mantener el orden en la gráfica horizontal
            for (let i = 6; i >= 1; i--) {
                if (counts[i] > 0) {
                    activeLabels.push(categoryNames[i]);
                    activeData.push(counts[i]);
                    activeBgColors.push(categoryColors[i]);
                    activeCategoryNums.push(i);

                    // Guardar también para la leyenda del mapa
                    activeUniqueValues.push({
                        value: i,
                        label: categoryNames[i],
                        symbol: { type: "simple-fill", color: categoryColors[i], outline: { color: "#666", width: 0.5 } }
                    });
                }
            }

            // Actualizar la leyenda del mapa dinámicamente quitando los ceros
            if (window.activeFeatureLayer && window.activeFeatureLayer.renderer && window.activeFeatureLayer.renderer.type === "unique-value") {
                const newRenderer = window.activeFeatureLayer.renderer.clone();
                // Reordenar uniqueValues de 1 a 6 para la leyenda del mapa
                newRenderer.uniqueValueInfos = activeUniqueValues.reverse();
                window.activeFeatureLayer.renderer = newRenderer;
            }
            if (typeof actualizarLeyenda === 'function') { actualizarLeyenda(activeUniqueValues.map(v => v.label), activeUniqueValues.map(v => v.symbol.color)); }


            const ctx = canvas.getContext("2d");
            if (window.determinantesChartInstance) window.determinantesChartInstance.destroy();

            window.determinantesChartInstance = new Chart(ctx, {
                type: "bar",
                data: {
                    labels: activeLabels,
                    datasets: [{ data: activeData, backgroundColor: activeBgColors, borderWidth: 0, barThickness: 15 }]
                },
                options: {
                    indexAxis: "y",
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: function (c) { return "Cantidad: " + c.raw; }
                            }
                        }
                    },
                    scales: {
                        x: {
                            beginAtZero: true,
                            title: { display: true, text: "Cantidad", font: { family: "Outfit", weight: "bold" } },
                            ticks: { stepSize: 1, font: { family: "Outfit" } },
                            grid: { display: true }
                        },
                        y: {
                            title: { display: true, text: "Tipo de Determinante", font: { family: "Outfit", weight: "bold" } },
                            ticks: { font: { family: "Outfit", size: 9 } },
                            grid: { display: false }
                        }
                    },
                    onClick: function (evt, elements) {
                        if (!elements.length) return;
                        var categoryNum = activeCategoryNums[elements[0].index];
                        filtrarMapaDeterminantes(categoryNum);
                    }
                },
                plugins: [{
                    afterDraw: function (chart) {
                        var c = chart.ctx;
                        c.save();
                        c.font = "bold 11px Outfit, sans-serif";
                        c.fillStyle = "#333";
                        chart.data.datasets.forEach(function (ds, i) {
                            chart.getDatasetMeta(i).data.forEach(function (bar, idx) {
                                var v = ds.data[idx];
                                if (v != null) c.fillText(String(v), bar.x + 5, bar.y + 4);
                            });
                        });
                        c.restore();
                    }
                }]
            });

            // Mostrar el resumen del municipio fijo abajo
            if (generalDescrip) {
                container.innerHTML = '<p style="margin:0;color:#444;">' + generalDescrip + '</p>';
            } else if (municipioInfo && municipioInfo.determinantes_desc) {
                container.innerHTML = '<p style="margin:0;color:#444;">' + municipioInfo.determinantes_desc + '</p>';
            } else {
                container.innerHTML = '<p style="margin:0;color:#666;">No hay descripción general disponible para este municipio.</p>';
            }

        } catch (e) {
            container.innerHTML = '<p style="margin:0;color:#c00;">Error al generar gráficos.</p>';
            console.error("cargarDeterminantesGraficos error:", e);
        }
    }

    // Filtra la capa del mapa por tipo de determinante y actualiza la descripción

    // Nueva función para el sub-tab SINAP
    async function cargarDeterminantesSinap(mpcodigo, chartSelector, summarySelector) {
        const canvas = document.querySelector(chartSelector);
        const summaryContainer = document.querySelector(summarySelector);
        if (!canvas) return;

        if (!mpcodigo) {
            if (window.determinantesChartInstance) window.determinantesChartInstance.destroy();
            if (summaryContainer) summaryContainer.innerHTML = '<p style="margin:0;color:#666;font-style:italic;">Seleccione un municipio</p>';
            return;
        }

        if (window.determinantesChartInstance) window.determinantesChartInstance.destroy();
        if (summaryContainer) summaryContainer.innerHTML = '<div style="text-align:center;padding:10px;">Consultando datos del SINAP...</div>';

        try {
            const cfg = getActiveLayerConfig();
            const url = cfg.url || `${CL_BASE}/19`;

            const qUrl = `${url}/query`;
            const params = new URLSearchParams({
                where: `mpcodigo = '${mpcodigo}' AND tdeterm = 1 AND confactadm = 1`,
                outFields: "subdet,nomdet,porcentaje,mpnombre,dpnombre",
                returnGeometry: "false",
                f: "json"
            });

            const resp = await fetch(`${qUrl}?${params.toString()}`);
            if (!resp.ok) throw new Error("Network error");
            const data = await resp.json();

            let mpNombre = mpcodigo;
            let dpNombre = "";
            if (data.features && data.features.length > 0) {
                mpNombre = data.features[0].attributes.mpnombre || mpcodigo;
                dpNombre = data.features[0].attributes.dpnombre || "";
            } else if (typeof municipioInfo !== 'undefined' && municipioInfo) {
                mpNombre = municipioInfo.mpnombre || municipioInfo.nombre_mpio || mpcodigo;
                dpNombre = municipioInfo.dpnombre || municipioInfo.nombre_dpto || "";
            }
            const chartTitle = document.getElementById("chartTitle");
            if (chartTitle) chartTitle.textContent = dpNombre ? `Distribución de los determinantes del ${mpNombre}, ${dpNombre}` : `Distribución de los determinantes del ${mpNombre}`;

            if (!data.features || data.features.length === 0) {
                if (summaryContainer) summaryContainer.innerHTML = '<p style="margin:0;color:#666;text-align:center;">No hay información del SINAP (tdeterm=1) registrada o aprobada para este municipio.</p>';
                if (typeof actualizarLeyenda === 'function') actualizarLeyenda([], []);
                return;
            }

            // Mapeo oficial de códigos SINAP de Colombia
            const sinapMap = {
                101: "Parque Nacional Natural",
                102: "Reserva Forestal Protectora Nacional",
                103: "Parque Natural Regional",
                104: "Reserva Natural de la Sociedad Civil",
                105: "Distrito de Conservación de Suelos",
                106: "Área de Recreación",
                108: "Distrito Regional de Manejo Integrado",
                110: "Reserva Nacional Natural",
                111: "Reserva Forestal Protectora Regional",
                112: "Santuario de Flora y Fauna",
                113: "Santuario de Flora",
                114: "Santuario de Fauna",
                115: "Vía Parque"
            };

            // Agrupar y sumar porcentajes
            const sumas = {};
            data.features.forEach(f => {
                const sub = f.attributes.subdet;
                const pct = parseFloat(f.attributes.porcentaje) || 0;
                if (sub != null) {
                    if (!sumas[sub]) sumas[sub] = 0;
                    sumas[sub] += pct;
                }
            });

            const labels = [];
            const dataValues = [];
            const palette = ["#43aa8b", "#277da1", "#f8961e", "#f94144", "#90be6d", "#f3722c", "#f9c74f", "#577590"];
            const bgColors = [];

            let colorIdx = 0;
            const activeUniqueValues = [];
            const activeSubdetCodes = [];

            for (const [subdet, totalPct] of Object.entries(sumas)) {
                const code = Number(subdet);
                const name = sinapMap[code] || `Subtipo ${code}`;
                labels.push(name);
                // Redondear a 2 decimales
                dataValues.push(Number(totalPct.toFixed(2)));
                activeSubdetCodes.push(code);

                const colorHex = palette[colorIdx % palette.length];
                bgColors.push(colorHex);

                // Guardar para leyenda del mapa (atributo subdet)
                activeUniqueValues.push({
                    value: code,
                    label: name,
                    symbol: { type: "simple-fill", color: colorHex, outline: { color: "#666", width: 0.5 } }
                });

                colorIdx++;
            }

            if (labels.length === 0) {
                if (summaryContainer) summaryContainer.innerHTML = '<p style="margin:0;color:#666;text-align:center;">Sin porcentajes válidos.</p>';
                return;
            }

            const ctx = canvas.getContext("2d");
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (window.determinantesChartInstance) {
                window.determinantesChartInstance.destroy();
                window.determinantesChartInstance = null;
            }

            // Actualizar mapa y leyenda
            if (window.activeFeatureLayer) {
                if (window.activeFeatureLayer.renderer && window.activeFeatureLayer.renderer.type === "unique-value") {
                    const newRenderer = window.activeFeatureLayer.renderer.clone();
                    newRenderer.field = "subdet";
                    newRenderer.uniqueValueInfos = activeUniqueValues;
                    window.activeFeatureLayer.renderer = newRenderer;
                }
                if (typeof actualizarLeyenda === 'function') { actualizarLeyenda(activeUniqueValues.map(v => v.label), activeUniqueValues.map(v => v.symbol.color)); }


                const filterWhere = "mpcodigo = '" + mpcodigo + "' AND confactadm = 1 AND tdeterm = 1";
                window.activeFeatureLayer.definitionExpression = filterWhere;
            }

            window.determinantesChartInstance = new Chart(ctx, {
                type: "doughnut",
                data: {
                    labels: labels,
                    datasets: [{
                        data: dataValues,
                        backgroundColor: bgColors,
                        borderWidth: 1,
                        borderColor: "#ffffff"
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    onClick: function (evt, elements) {
                        if (!elements.length) return;
                        var idx = elements[0].index;
                        var subdetCode = activeSubdetCodes[idx];

                        var filterWhere = "mpcodigo = '" + mpcodigo + "' AND confactadm = 1 AND tdeterm = 1 AND subdet = " + subdetCode;
                        if (window.activeFeatureLayer) {
                            window.activeFeatureLayer.definitionExpression = filterWhere;
                            window.activeFeatureLayer.queryExtent({ where: filterWhere }).then(function (res) {
                                if (res.extent) view.goTo(res.extent.expand(1.3));
                            });
                        }
                    },
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: { font: { family: "Outfit", size: 11 } }
                        },
                        tooltip: {
                            callbacks: {
                                label: function (context) {
                                    const label = context.label || '';
                                    const val = context.raw || 0;
                                    return `${label}: ${val}%`;
                                }
                            }
                        }
                    }
                }
            });

            // Mostrar resumen básico
            if (summaryContainer) {
                summaryContainer.innerHTML = '<div style="margin-top:10px; font-family:\'Outfit\'; font-size:13px; color:#444;"><strong>Sistema nacional de áreas protegidas del SINAP:</strong> Porcentaje de cubrimiento en relación con el área del municipio.</div>';
            }

        } catch (e) {
            if (summaryContainer) summaryContainer.innerHTML = '<p style="margin:0;color:#c00;">Error al generar gráficos SINAP.</p>';
            console.error("cargarDeterminantesSinap error:", e);
        }
    }

    async function cargarDeterminantesAeie(mpcodigo, chartSelector, summarySelector) {
        const canvas = document.querySelector(chartSelector);
        const summaryContainer = document.querySelector(summarySelector);
        if (!canvas) return;

        if (!mpcodigo) {
            if (window.determinantesChartInstance) window.determinantesChartInstance.destroy();
            if (summaryContainer) summaryContainer.innerHTML = '<p style="margin:0;color:#666;font-style:italic;">Seleccione un municipio</p>';
            return;
        }

        if (window.determinantesChartInstance) window.determinantesChartInstance.destroy();
        if (summaryContainer) summaryContainer.innerHTML = '<div style="text-align:center;padding:10px;">Consultando datos de AEIE...</div>';

        try {
            const cfg = getActiveLayerConfig();
            const url = cfg.url || `${CL_BASE}/19`;

            const qUrl = `${url}/query`;
            const params = new URLSearchParams({
                where: `mpcodigo = '${mpcodigo}' AND tdeterm = 2 AND confactadm = 1`,
                outFields: "subdet,nomdet,porcentaje,mpnombre,dpnombre",
                returnGeometry: "false",
                f: "json"
            });

            const resp = await fetch(`${qUrl}?${params.toString()}`);
            if (!resp.ok) throw new Error("Network error");
            const data = await resp.json();

            let mpNombre = mpcodigo;
            let dpNombre = "";
            if (data.features && data.features.length > 0) {
                mpNombre = data.features[0].attributes.mpnombre || mpcodigo;
                dpNombre = data.features[0].attributes.dpnombre || "";
            } else if (typeof municipioInfo !== 'undefined' && municipioInfo) {
                mpNombre = municipioInfo.mpnombre || municipioInfo.nombre_mpio || mpcodigo;
                dpNombre = municipioInfo.dpnombre || municipioInfo.nombre_dpto || "";
            }
            const chartTitle = document.getElementById("chartTitle");
            if (chartTitle) chartTitle.textContent = dpNombre ? `Distribución de los determinantes del ${mpNombre}, ${dpNombre}` : `Distribución de los determinantes del ${mpNombre}`;

            if (!data.features || data.features.length === 0) {
                if (summaryContainer) summaryContainer.innerHTML = '<p style="margin:0;color:#666;text-align:center;">No hay información de AEIE (tdeterm=2) registrada o aprobada para este municipio.</p>';
                if (typeof actualizarLeyenda === 'function') actualizarLeyenda([], []);
                return;
            }

            const sumas = {};
            const nombres = {};
            data.features.forEach(f => {
                const sub = f.attributes.subdet;
                const nom = f.attributes.nomdet;
                const pct = parseFloat(f.attributes.porcentaje) || 0;
                if (sub != null) {
                    if (!sumas[sub]) sumas[sub] = 0;
                    sumas[sub] += pct;
                    if (nom) nombres[sub] = nom;
                }
            });

            const labels = [];
            const dataValues = [];
            const palette = ["#43aa8b", "#277da1", "#f8961e", "#f94144", "#90be6d", "#f3722c", "#f9c74f", "#577590"];
            const bgColors = [];

            let colorIdx = 0;
            const activeUniqueValues = [];
            const activeSubdetCodes = [];

            for (const [subdet, totalPct] of Object.entries(sumas)) {
                const code = Number(subdet);
                const name = nombres[subdet] || `Subtipo ${code}`;
                labels.push(name);
                dataValues.push(Number(totalPct.toFixed(2)));
                activeSubdetCodes.push(code);

                const colorHex = palette[colorIdx % palette.length];
                bgColors.push(colorHex);

                activeUniqueValues.push({
                    value: code,
                    label: name,
                    symbol: { type: "simple-fill", color: colorHex, outline: { color: "#666", width: 0.5 } }
                });

                colorIdx++;
            }

            if (labels.length === 0) {
                if (summaryContainer) summaryContainer.innerHTML = '<p style="margin:0;color:#666;text-align:center;">Sin porcentajes válidos.</p>';
                return;
            }

            const ctx = canvas.getContext("2d");
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (window.determinantesChartInstance) {
                window.determinantesChartInstance.destroy();
                window.determinantesChartInstance = null;
            }

            if (window.activeFeatureLayer) {
                if (window.activeFeatureLayer.renderer && window.activeFeatureLayer.renderer.type === "unique-value") {
                    const newRenderer = window.activeFeatureLayer.renderer.clone();
                    newRenderer.field = "subdet";
                    newRenderer.uniqueValueInfos = activeUniqueValues;
                    window.activeFeatureLayer.renderer = newRenderer;
                }
                if (typeof actualizarLeyenda === 'function') { actualizarLeyenda(activeUniqueValues.map(v => v.label), activeUniqueValues.map(v => v.symbol.color)); }


                const filterWhere = "mpcodigo = '" + mpcodigo + "' AND confactadm = 1 AND tdeterm = 2";
                window.activeFeatureLayer.definitionExpression = filterWhere;
            }

            window.determinantesChartInstance = new Chart(ctx, {
                type: "doughnut",
                data: {
                    labels: labels,
                    datasets: [{
                        data: dataValues,
                        backgroundColor: bgColors,
                        borderWidth: 1,
                        borderColor: "#ffffff"
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    onClick: function (evt, elements) {
                        if (!elements.length) return;
                        var idx = elements[0].index;
                        var subdetCode = activeSubdetCodes[idx];

                        var filterWhere = "mpcodigo = '" + mpcodigo + "' AND confactadm = 1 AND tdeterm = 2 AND subdet = " + subdetCode;
                        if (window.activeFeatureLayer) {
                            window.activeFeatureLayer.definitionExpression = filterWhere;
                            window.activeFeatureLayer.queryExtent({ where: filterWhere }).then(function (res) {
                                if (res.extent) view.goTo(res.extent.expand(1.3));
                            });
                        }
                    },
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: { font: { family: "Outfit", size: 11 } }
                        },
                        tooltip: {
                            callbacks: {
                                label: function (context) {
                                    const label = context.label || '';
                                    const val = context.raw || 0;
                                    return `${label}: ${val}%`;
                                }
                            }
                        }
                    }
                }
            });

            if (summaryContainer) {
                summaryContainer.innerHTML = '<div style="margin-top:10px; font-family:\'Outfit\'; font-size:13px; color:#444;"><strong>Áreas de especial importancia ecosistémica (AEIE):</strong> Porcentaje de cubrimiento en relación con el área del municipio.</div>';
            }

        } catch (e) {
            if (summaryContainer) summaryContainer.innerHTML = '<p style="margin:0;color:#c00;">Error al generar gráficos AEIE.</p>';
            console.error("cargarDeterminantesAeie error:", e);
        }
    }

    async function cargarDeterminantesEcc(mpcodigo, chartSelector, summarySelector) {
        const canvas = document.querySelector(chartSelector);
        const summaryContainer = document.querySelector(summarySelector);
        if (!canvas) return;

        if (!mpcodigo) {
            if (window.determinantesChartInstance) window.determinantesChartInstance.destroy();
            if (summaryContainer) summaryContainer.innerHTML = '<p style="margin:0;color:#666;font-style:italic;">Seleccione un municipio</p>';
            return;
        }

        if (window.determinantesChartInstance) window.determinantesChartInstance.destroy();
        if (summaryContainer) summaryContainer.innerHTML = '<div style="text-align:center;padding:10px;">Consultando datos de Estrategias de Conservación...</div>';

        try {
            const cfg = getActiveLayerConfig();
            const url = cfg.url || `${CL_BASE}/19`;

            const qUrl = `${url}/query`;
            const params = new URLSearchParams({
                where: `mpcodigo = '${mpcodigo}' AND tdeterm = 3 AND confactadm = 1`,
                outFields: "subdet,nomdet,porcentaje,mpnombre,dpnombre",
                returnGeometry: "false",
                f: "json"
            });

            const resp = await fetch(`${qUrl}?${params.toString()}`);
            if (!resp.ok) throw new Error("Network error");
            const data = await resp.json();

            let mpNombre = mpcodigo;
            let dpNombre = "";
            if (data.features && data.features.length > 0) {
                mpNombre = data.features[0].attributes.mpnombre || mpcodigo;
                dpNombre = data.features[0].attributes.dpnombre || "";
            } else if (typeof municipioInfo !== 'undefined' && municipioInfo) {
                mpNombre = municipioInfo.mpnombre || municipioInfo.nombre_mpio || mpcodigo;
                dpNombre = municipioInfo.dpnombre || municipioInfo.nombre_dpto || "";
            }
            const chartTitle = document.getElementById("chartTitle");
            if (chartTitle) chartTitle.textContent = dpNombre ? `Distribución de los determinantes del ${mpNombre}, ${dpNombre}` : `Distribución de los determinantes del ${mpNombre}`;

            if (!data.features || data.features.length === 0) {
                if (summaryContainer) summaryContainer.innerHTML = '<p style="margin:0;color:#666;text-align:center;">No hay información de Estrategias complementarias de conservación (tdeterm=3) registrada o aprobada para este municipio.</p>';
                if (typeof actualizarLeyenda === 'function') actualizarLeyenda([], []);
                return;
            }

            const sumas = {};
            const nombres = {};
            data.features.forEach(f => {
                const sub = f.attributes.subdet;
                const nom = f.attributes.nomdet;
                const pct = parseFloat(f.attributes.porcentaje) || 0;
                if (sub != null) {
                    if (!sumas[sub]) sumas[sub] = 0;
                    sumas[sub] += pct;
                    if (nom) nombres[sub] = nom;
                }
            });

            const labels = [];
            const dataValues = [];
            const palette = ["#43aa8b", "#277da1", "#f8961e", "#f94144", "#90be6d", "#f3722c", "#f9c74f", "#577590"];
            const bgColors = [];

            let colorIdx = 0;
            const activeUniqueValues = [];
            const activeSubdetCodes = [];

            for (const [subdet, totalPct] of Object.entries(sumas)) {
                const code = Number(subdet);
                const name = nombres[subdet] || `Subtipo ${code}`;
                labels.push(name);
                dataValues.push(Number(totalPct.toFixed(2)));
                activeSubdetCodes.push(code);

                const colorHex = palette[colorIdx % palette.length];
                bgColors.push(colorHex);

                activeUniqueValues.push({
                    value: code,
                    label: name,
                    symbol: { type: "simple-fill", color: colorHex, outline: { color: "#666", width: 0.5 } }
                });

                colorIdx++;
            }

            if (labels.length === 0) {
                if (summaryContainer) summaryContainer.innerHTML = '<p style="margin:0;color:#666;text-align:center;">Sin porcentajes válidos.</p>';
                return;
            }

            const ctx = canvas.getContext("2d");
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (window.determinantesChartInstance) {
                window.determinantesChartInstance.destroy();
                window.determinantesChartInstance = null;
            }

            if (window.activeFeatureLayer) {
                if (window.activeFeatureLayer.renderer && window.activeFeatureLayer.renderer.type === "unique-value") {
                    const newRenderer = window.activeFeatureLayer.renderer.clone();
                    newRenderer.field = "subdet";
                    newRenderer.uniqueValueInfos = activeUniqueValues;
                    window.activeFeatureLayer.renderer = newRenderer;
                }
                if (typeof actualizarLeyenda === 'function') { actualizarLeyenda(activeUniqueValues.map(v => v.label), activeUniqueValues.map(v => v.symbol.color)); }


                const filterWhere = "mpcodigo = '" + mpcodigo + "' AND confactadm = 1 AND tdeterm = 3";
                window.activeFeatureLayer.definitionExpression = filterWhere;
            }

            window.determinantesChartInstance = new Chart(ctx, {
                type: "doughnut",
                data: {
                    labels: labels,
                    datasets: [{
                        data: dataValues,
                        backgroundColor: bgColors,
                        borderWidth: 1,
                        borderColor: "#ffffff"
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    onClick: function (evt, elements) {
                        if (!elements.length) return;
                        var idx = elements[0].index;
                        var subdetCode = activeSubdetCodes[idx];

                        var filterWhere = "mpcodigo = '" + mpcodigo + "' AND confactadm = 1 AND tdeterm = 3 AND subdet = " + subdetCode;
                        if (window.activeFeatureLayer) {
                            window.activeFeatureLayer.definitionExpression = filterWhere;
                            window.activeFeatureLayer.queryExtent({ where: filterWhere }).then(function (res) {
                                if (res.extent) view.goTo(res.extent.expand(1.3));
                            });
                        }
                    },
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: { font: { family: "Outfit", size: 11 } }
                        },
                        tooltip: {
                            callbacks: {
                                label: function (context) {
                                    const label = context.label || '';
                                    const val = context.raw || 0;
                                    return `${label}: ${val}%`;
                                }
                            }
                        }
                    }
                }
            });

            if (summaryContainer) {
                summaryContainer.innerHTML = '<div style="margin-top:10px; font-family:\'Outfit\'; font-size:13px; color:#444;"><strong>Estrategias complementarias de conservación:</strong> Porcentaje de cubrimiento en relación con el área del municipio.</div>';
            }

        } catch (e) {
            if (summaryContainer) summaryContainer.innerHTML = '<p style="margin:0;color:#c00;">Error al generar gráficos de Estrategias de Conservación.</p>';
            console.error("cargarDeterminantesEcc error:", e);
        }
    }

    async function cargarDeterminantesEep(mpcodigo, chartSelector, summarySelector) {
        const canvas = document.querySelector(chartSelector);
        const summaryContainer = document.querySelector(summarySelector);
        if (!canvas) return;

        if (!mpcodigo) {
            if (window.determinantesChartInstance) window.determinantesChartInstance.destroy();
            if (summaryContainer) summaryContainer.innerHTML = '<p style="margin:0;color:#666;font-style:italic;">Seleccione un municipio</p>';
            return;
        }

        if (window.determinantesChartInstance) window.determinantesChartInstance.destroy();
        if (summaryContainer) summaryContainer.innerHTML = '<div style="text-align:center;padding:10px;">Consultando datos de Estructura Ecológica Principal...</div>';

        try {
            const cfg = getActiveLayerConfig();
            const url = cfg.url || `${CL_BASE}/19`;

            const qUrl = `${url}/query`;
            const params = new URLSearchParams({
                where: `mpcodigo = '${mpcodigo}' AND tdeterm = 5 AND confactadm = 1`,
                outFields: "subdet,nomdet,porcentaje,mpnombre,dpnombre",
                returnGeometry: "false",
                f: "json"
            });

            const resp = await fetch(`${qUrl}?${params.toString()}`);
            if (!resp.ok) throw new Error("Network error");
            const data = await resp.json();

            let mpNombre = mpcodigo;
            let dpNombre = "";
            if (data.features && data.features.length > 0) {
                mpNombre = data.features[0].attributes.mpnombre || mpcodigo;
                dpNombre = data.features[0].attributes.dpnombre || "";
            } else if (typeof municipioInfo !== 'undefined' && municipioInfo) {
                mpNombre = municipioInfo.mpnombre || municipioInfo.nombre_mpio || mpcodigo;
                dpNombre = municipioInfo.dpnombre || municipioInfo.nombre_dpto || "";
            }
            const chartTitle = document.getElementById("chartTitle");
            if (chartTitle) chartTitle.textContent = dpNombre ? `Distribución de los determinantes del ${mpNombre}, ${dpNombre}` : `Distribución de los determinantes del ${mpNombre}`;

            if (!data.features || data.features.length === 0) {
                if (summaryContainer) summaryContainer.innerHTML = '<p style="margin:0;color:#666;text-align:center;">No hay información de Estructura Ecológica Principal (tdeterm=5) registrada o aprobada para este municipio.</p>';
                if (typeof actualizarLeyenda === 'function') actualizarLeyenda([], []);
                return;
            }

            const sumas = {};
            const nombres = {};
            data.features.forEach(f => {
                const sub = f.attributes.subdet;
                const nom = f.attributes.nomdet;
                const pct = parseFloat(f.attributes.porcentaje) || 0;
                if (sub != null) {
                    if (!sumas[sub]) sumas[sub] = 0;
                    sumas[sub] += pct;
                    if (nom) nombres[sub] = nom;
                }
            });

            const labels = [];
            const dataValues = [];
            const palette = ["#43aa8b", "#277da1", "#f8961e", "#f94144", "#90be6d", "#f3722c", "#f9c74f", "#577590"];
            const bgColors = [];

            let colorIdx = 0;
            const activeUniqueValues = [];
            const activeSubdetCodes = [];

            for (const [subdet, totalPct] of Object.entries(sumas)) {
                const code = Number(subdet);
                const name = nombres[subdet] || `Subtipo ${code}`;
                labels.push(name);
                dataValues.push(Number(totalPct.toFixed(2)));
                activeSubdetCodes.push(code);

                const colorHex = palette[colorIdx % palette.length];
                bgColors.push(colorHex);

                activeUniqueValues.push({
                    value: code,
                    label: name,
                    symbol: { type: "simple-fill", color: colorHex, outline: { color: "#666", width: 0.5 } }
                });

                colorIdx++;
            }

            if (labels.length === 0) {
                if (summaryContainer) summaryContainer.innerHTML = '<p style="margin:0;color:#666;text-align:center;">Sin porcentajes válidos.</p>';
                return;
            }

            const ctx = canvas.getContext("2d");
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (window.determinantesChartInstance) {
                window.determinantesChartInstance.destroy();
                window.determinantesChartInstance = null;
            }

            if (window.activeFeatureLayer) {
                if (window.activeFeatureLayer.renderer && window.activeFeatureLayer.renderer.type === "unique-value") {
                    const newRenderer = window.activeFeatureLayer.renderer.clone();
                    newRenderer.field = "subdet";
                    newRenderer.uniqueValueInfos = activeUniqueValues;
                    window.activeFeatureLayer.renderer = newRenderer;
                }
                if (typeof actualizarLeyenda === 'function') { actualizarLeyenda(activeUniqueValues.map(v => v.label), activeUniqueValues.map(v => v.symbol.color)); }


                const filterWhere = "mpcodigo = '" + mpcodigo + "' AND confactadm = 1 AND tdeterm = 5";
                window.activeFeatureLayer.definitionExpression = filterWhere;
            }

            window.determinantesChartInstance = new Chart(ctx, {
                type: "doughnut",
                data: {
                    labels: labels,
                    datasets: [{
                        data: dataValues,
                        backgroundColor: bgColors,
                        borderWidth: 1,
                        borderColor: "#ffffff"
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    onClick: function (evt, elements) {
                        if (!elements.length) return;
                        var idx = elements[0].index;
                        var subdetCode = activeSubdetCodes[idx];

                        var filterWhere = "mpcodigo = '" + mpcodigo + "' AND confactadm = 1 AND tdeterm = 5 AND subdet = " + subdetCode;
                        if (window.activeFeatureLayer) {
                            window.activeFeatureLayer.definitionExpression = filterWhere;
                            window.activeFeatureLayer.queryExtent({ where: filterWhere }).then(function (res) {
                                if (res.extent) view.goTo(res.extent.expand(1.3));
                            });
                        }
                    },
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: { font: { family: "Outfit", size: 11 } }
                        },
                        tooltip: {
                            callbacks: {
                                label: function (context) {
                                    const label = context.label || '';
                                    const val = context.raw || 0;
                                    return `${label}: ${val}%`;
                                }
                            }
                        }
                    }
                }
            });

            if (summaryContainer) {
                summaryContainer.innerHTML = '<div style="margin-top:10px; font-family:\'Outfit\'; font-size:13px; color:#444;"><strong>Derivadas de la estructura ecológica principal (EEP):</strong> Porcentaje de cubrimiento en relación con el área del municipio.</div>';
            }

        } catch (e) {
            if (summaryContainer) summaryContainer.innerHTML = '<p style="margin:0;color:#c00;">Error al generar gráficos de EEP.</p>';
            console.error("cargarDeterminantesEep error:", e);
        }
    }

    async function cargarDeterminantesGrs(mpcodigo, chartSelector, summarySelector) {
        const canvas = document.querySelector(chartSelector);
        const summaryContainer = document.querySelector(summarySelector);
        if (!canvas) return;

        if (!mpcodigo) {
            if (window.determinantesChartInstance) window.determinantesChartInstance.destroy();
            if (summaryContainer) summaryContainer.innerHTML = '<p style="margin:0;color:#666;font-style:italic;">Seleccione un municipio</p>';
            return;
        }

        if (window.determinantesChartInstance) window.determinantesChartInstance.destroy();
        if (summaryContainer) summaryContainer.innerHTML = '<div style="text-align:center;padding:10px;">Consultando datos de Gestión del recurso suelo...</div>';

        try {
            const cfg = getActiveLayerConfig();
            const url = cfg.url || `${CL_BASE}/19`;

            const qUrl = `${url}/query`;
            const params = new URLSearchParams({
                where: `mpcodigo = '${mpcodigo}' AND tdeterm = 6 AND confactadm = 1`,
                outFields: "subdet,nomdet,porcentaje,mpnombre,dpnombre",
                returnGeometry: "false",
                f: "json"
            });

            const resp = await fetch(`${qUrl}?${params.toString()}`);
            if (!resp.ok) throw new Error("Network error");
            const data = await resp.json();

            let mpNombre = mpcodigo;
            let dpNombre = "";
            if (data.features && data.features.length > 0) {
                mpNombre = data.features[0].attributes.mpnombre || mpcodigo;
                dpNombre = data.features[0].attributes.dpnombre || "";
            } else if (typeof municipioInfo !== 'undefined' && municipioInfo) {
                mpNombre = municipioInfo.mpnombre || municipioInfo.nombre_mpio || mpcodigo;
                dpNombre = municipioInfo.dpnombre || municipioInfo.nombre_dpto || "";
            }
            const chartTitle = document.getElementById("chartTitle");
            if (chartTitle) chartTitle.textContent = dpNombre ? `Distribución de los determinantes del ${mpNombre}, ${dpNombre}` : `Distribución de los determinantes del ${mpNombre}`;

            if (!data.features || data.features.length === 0) {
                if (summaryContainer) summaryContainer.innerHTML = '<p style="margin:0;color:#666;text-align:center;">No hay información de Gestión del recurso suelo (tdeterm=6) registrada o aprobada para este municipio.</p>';
                if (typeof actualizarLeyenda === 'function') actualizarLeyenda([], []);
                return;
            }

            const sumas = {};
            const nombres = {};
            data.features.forEach(f => {
                const sub = f.attributes.subdet;
                const nom = f.attributes.nomdet;
                const pct = parseFloat(f.attributes.porcentaje) || 0;
                if (sub != null) {
                    if (!sumas[sub]) sumas[sub] = 0;
                    sumas[sub] += pct;
                    if (nom) nombres[sub] = nom;
                }
            });

            const labels = [];
            const dataValues = [];
            const palette = ["#43aa8b", "#277da1", "#f8961e", "#f94144", "#90be6d", "#f3722c", "#f9c74f", "#577590"];
            const bgColors = [];

            let colorIdx = 0;
            const activeUniqueValues = [];
            const activeSubdetCodes = [];

            for (const [subdet, totalPct] of Object.entries(sumas)) {
                const code = Number(subdet);
                const name = nombres[subdet] || `Subtipo ${code}`;
                labels.push(name);
                dataValues.push(Number(totalPct.toFixed(2)));
                activeSubdetCodes.push(code);

                const colorHex = palette[colorIdx % palette.length];
                bgColors.push(colorHex);

                activeUniqueValues.push({
                    value: code,
                    label: name,
                    symbol: { type: "simple-fill", color: colorHex, outline: { color: "#666", width: 0.5 } }
                });

                colorIdx++;
            }

            if (labels.length === 0) {
                if (summaryContainer) summaryContainer.innerHTML = '<p style="margin:0;color:#666;text-align:center;">Sin porcentajes válidos.</p>';
                return;
            }

            const ctx = canvas.getContext("2d");
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (window.determinantesChartInstance) {
                window.determinantesChartInstance.destroy();
                window.determinantesChartInstance = null;
            }

            if (window.activeFeatureLayer) {
                if (window.activeFeatureLayer.renderer && window.activeFeatureLayer.renderer.type === "unique-value") {
                    const newRenderer = window.activeFeatureLayer.renderer.clone();
                    newRenderer.field = "subdet";
                    newRenderer.uniqueValueInfos = activeUniqueValues;
                    window.activeFeatureLayer.renderer = newRenderer;
                }
                if (typeof actualizarLeyenda === 'function') { actualizarLeyenda(activeUniqueValues.map(v => v.label), activeUniqueValues.map(v => v.symbol.color)); }


                const filterWhere = "mpcodigo = '" + mpcodigo + "' AND confactadm = 1 AND tdeterm = 6";
                window.activeFeatureLayer.definitionExpression = filterWhere;
            }

            window.determinantesChartInstance = new Chart(ctx, {
                type: "doughnut",
                data: {
                    labels: labels,
                    datasets: [{
                        data: dataValues,
                        backgroundColor: bgColors,
                        borderWidth: 1,
                        borderColor: "#ffffff"
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    onClick: function (evt, elements) {
                        if (!elements.length) return;
                        var idx = elements[0].index;
                        var subdetCode = activeSubdetCodes[idx];

                        var filterWhere = "mpcodigo = '" + mpcodigo + "' AND confactadm = 1 AND tdeterm = 6 AND subdet = " + subdetCode;
                        if (window.activeFeatureLayer) {
                            window.activeFeatureLayer.definitionExpression = filterWhere;
                            window.activeFeatureLayer.queryExtent({ where: filterWhere }).then(function (res) {
                                if (res.extent) view.goTo(res.extent.expand(1.3));
                            });
                        }
                    },
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: { font: { family: "Outfit", size: 11 } }
                        },
                        tooltip: {
                            callbacks: {
                                label: function (context) {
                                    const label = context.label || '';
                                    const val = context.raw || 0;
                                    return `${label}: ${val}%`;
                                }
                            }
                        }
                    }
                }
            });

            if (summaryContainer) {
                summaryContainer.innerHTML = '<div style="margin-top:10px; font-family:\'Outfit\'; font-size:13px; color:#444;"><strong>Gestión del recurso suelo:</strong> Porcentaje de cubrimiento en relación con el área del municipio.</div>';
            }

        } catch (e) {
            if (summaryContainer) summaryContainer.innerHTML = '<p style="margin:0;color:#c00;">Error al generar gráficos de Gestión del recurso suelo.</p>';
            console.error("cargarDeterminantesGrs error:", e);
        }
    }

    async function cargarDeterminantesLocalizacion(mpcodigo, chartSelector, summarySelector) {
        const canvas = document.querySelector(chartSelector);
        const summaryContainer = document.querySelector(summarySelector);
        if (!canvas) return;

        if (!mpcodigo) {
            if (window.determinantesChartInstance) window.determinantesChartInstance.destroy();
            if (summaryContainer) summaryContainer.innerHTML = '<p style="margin:0;color:#666;font-style:italic;">Seleccione un municipio</p>';
            return;
        }

        if (window.determinantesChartInstance) window.determinantesChartInstance.destroy();
        if (summaryContainer) summaryContainer.innerHTML = '<div style="text-align:center;padding:10px;">Consultando datos de Localización...</div>';

        try {
            const cfg = getActiveLayerConfig();
            const url = cfg.url || `${CL_BASE}/19`;

            const qUrl = `${url}/query`;
            const params = new URLSearchParams({
                where: `mpcodigo = '${mpcodigo}' AND tdeterm = 13 AND confactadm = 1`,
                outFields: "subdet,nomdet,porcentaje,mpnombre,dpnombre",
                returnGeometry: "false",
                f: "json"
            });

            const resp = await fetch(`${qUrl}?${params.toString()}`);
            if (!resp.ok) throw new Error("Network error");
            const data = await resp.json();

            let mpNombre = mpcodigo;
            let dpNombre = "";
            if (data.features && data.features.length > 0) {
                mpNombre = data.features[0].attributes.mpnombre || mpcodigo;
                dpNombre = data.features[0].attributes.dpnombre || "";
            } else if (typeof municipioInfo !== 'undefined' && municipioInfo) {
                mpNombre = municipioInfo.mpnombre || municipioInfo.nombre_mpio || mpcodigo;
                dpNombre = municipioInfo.dpnombre || municipioInfo.nombre_dpto || "";
            }
            const chartTitle = document.getElementById("chartTitle");
            if (chartTitle) chartTitle.textContent = dpNombre ? `Distribución de los determinantes del ${mpNombre}, ${dpNombre}` : `Distribución de los determinantes del ${mpNombre}`;

            if (!data.features || data.features.length === 0) {
                if (summaryContainer) summaryContainer.innerHTML = '<p style="margin:0;color:#666;text-align:center;">No hay información de Localización (tdeterm=13) registrada o aprobada para este municipio.</p>';
                if (typeof actualizarLeyenda === 'function') actualizarLeyenda([], []);
                return;
            }

            const sumas = {};
            const nombres = {};
            data.features.forEach(f => {
                const sub = f.attributes.subdet;
                const nom = f.attributes.nomdet;
                const pct = parseFloat(f.attributes.porcentaje) || 0;
                if (sub != null) {
                    if (!sumas[sub]) sumas[sub] = 0;
                    sumas[sub] += pct;
                    if (nom) nombres[sub] = nom;
                }
            });

            const labels = [];
            const dataValues = [];
            const palette = ["#43aa8b", "#277da1", "#f8961e", "#f94144", "#90be6d", "#f3722c", "#f9c74f", "#577590"];
            const bgColors = [];

            let colorIdx = 0;
            const activeUniqueValues = [];
            const activeSubdetCodes = [];

            for (const [subdet, totalPct] of Object.entries(sumas)) {
                const code = Number(subdet);
                const name = nombres[subdet] || `Subtipo ${code}`;
                labels.push(name);
                dataValues.push(Number(totalPct.toFixed(2)));
                activeSubdetCodes.push(code);

                const colorHex = palette[colorIdx % palette.length];
                bgColors.push(colorHex);

                activeUniqueValues.push({
                    value: code,
                    label: name,
                    symbol: { type: "simple-fill", color: colorHex, outline: { color: "#666", width: 0.5 } }
                });

                colorIdx++;
            }

            if (labels.length === 0) {
                if (summaryContainer) summaryContainer.innerHTML = '<p style="margin:0;color:#666;text-align:center;">Sin porcentajes válidos.</p>';
                return;
            }

            const ctx = canvas.getContext("2d");
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (window.determinantesChartInstance) {
                window.determinantesChartInstance.destroy();
                window.determinantesChartInstance = null;
            }

            if (window.activeFeatureLayer) {
                if (window.activeFeatureLayer.renderer && window.activeFeatureLayer.renderer.type === "unique-value") {
                    const newRenderer = window.activeFeatureLayer.renderer.clone();
                    newRenderer.field = "subdet";
                    newRenderer.uniqueValueInfos = activeUniqueValues;
                    window.activeFeatureLayer.renderer = newRenderer;
                }
                if (typeof actualizarLeyenda === 'function') { actualizarLeyenda(activeUniqueValues.map(v => v.label), activeUniqueValues.map(v => v.symbol.color)); }


                const filterWhere = "mpcodigo = '" + mpcodigo + "' AND confactadm = 1 AND tdeterm = 13";
                window.activeFeatureLayer.definitionExpression = filterWhere;
            }

            window.determinantesChartInstance = new Chart(ctx, {
                type: "doughnut",
                data: {
                    labels: labels,
                    datasets: [{
                        data: dataValues,
                        backgroundColor: bgColors,
                        borderWidth: 1,
                        borderColor: "#ffffff"
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    onClick: function (evt, elements) {
                        if (!elements.length) return;
                        var idx = elements[0].index;
                        var subdetCode = activeSubdetCodes[idx];

                        var filterWhere = "mpcodigo = '" + mpcodigo + "' AND confactadm = 1 AND tdeterm = 13 AND subdet = " + subdetCode;
                        if (window.activeFeatureLayer) {
                            window.activeFeatureLayer.definitionExpression = filterWhere;
                            window.activeFeatureLayer.queryExtent({ where: filterWhere }).then(function (res) {
                                if (res.extent) view.goTo(res.extent.expand(1.3));
                            });
                        }
                    },
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: { font: { family: "Outfit", size: 11 } }
                        },
                        tooltip: {
                            callbacks: {
                                label: function (context) {
                                    const label = context.label || '';
                                    const val = context.raw || 0;
                                    return `${label}: ${val}%`;
                                }
                            }
                        }
                    }
                }
            });

            if (summaryContainer) {
                summaryContainer.innerHTML = '<div style="margin-top:10px; font-family:\'Outfit\'; font-size:13px; color:#444;"><strong>Localización:</strong> Porcentaje de cubrimiento en relación con el área del municipio.</div>';
            }

        } catch (e) {
            if (summaryContainer) summaryContainer.innerHTML = '<p style="margin:0;color:#c00;">Error al generar gráficos de Localización.</p>';
            console.error("cargarDeterminantesLocalizacion error:", e);
        }
    }

    async function cargarDeterminantesDensidades(mpcodigo, chartSelector, summarySelector) {
        const canvas = document.querySelector(chartSelector);
        const summaryContainer = document.querySelector(summarySelector);
        if (!canvas) return;

        if (!mpcodigo) {
            if (window.determinantesChartInstance) window.determinantesChartInstance.destroy();
            if (summaryContainer) summaryContainer.innerHTML = '<p style="margin:0;color:#666;font-style:italic;">Seleccione un municipio</p>';
            return;
        }

        if (window.determinantesChartInstance) window.determinantesChartInstance.destroy();
        if (summaryContainer) summaryContainer.innerHTML = '<div style="text-align:center;padding:10px;">Consultando datos de Densidades...</div>';

        try {
            const cfg = getActiveLayerConfig();
            const url = cfg.url || `${CL_BASE}/19`;

            const qUrl = `${url}/query`;
            const params = new URLSearchParams({
                where: `mpcodigo = '${mpcodigo}' AND tdeterm = 14 AND confactadm = 1`,
                outFields: "subdet,nomdet,porcentaje,mpnombre,dpnombre",
                returnGeometry: "false",
                f: "json"
            });

            const resp = await fetch(`${qUrl}?${params.toString()}`);
            if (!resp.ok) throw new Error("Network error");
            const data = await resp.json();

            let mpNombre = mpcodigo;
            let dpNombre = "";
            if (data.features && data.features.length > 0) {
                mpNombre = data.features[0].attributes.mpnombre || mpcodigo;
                dpNombre = data.features[0].attributes.dpnombre || "";
            } else if (typeof municipioInfo !== 'undefined' && municipioInfo) {
                mpNombre = municipioInfo.mpnombre || municipioInfo.nombre_mpio || mpcodigo;
                dpNombre = municipioInfo.dpnombre || municipioInfo.nombre_dpto || "";
            }
            const chartTitle = document.getElementById("chartTitle");
            if (chartTitle) chartTitle.textContent = dpNombre ? `Distribución de los determinantes del ${mpNombre}, ${dpNombre}` : `Distribución de los determinantes del ${mpNombre}`;

            if (!data.features || data.features.length === 0) {
                if (summaryContainer) summaryContainer.innerHTML = '<p style="margin:0;color:#666;text-align:center;">No hay información de Densidades (tdeterm=14) registrada o aprobada para este municipio.</p>';
                if (typeof actualizarLeyenda === 'function') actualizarLeyenda([], []);
                return;
            }

            const sumas = {};
            const nombres = {};
            data.features.forEach(f => {
                const sub = f.attributes.subdet;
                const nom = f.attributes.nomdet;
                const pct = parseFloat(f.attributes.porcentaje) || 0;
                if (sub != null) {
                    if (!sumas[sub]) sumas[sub] = 0;
                    sumas[sub] += pct;
                    if (nom) nombres[sub] = nom;
                }
            });

            const labels = [];
            const dataValues = [];
            const palette = ["#43aa8b", "#277da1", "#f8961e", "#f94144", "#90be6d", "#f3722c", "#f9c74f", "#577590"];
            const bgColors = [];

            let colorIdx = 0;
            const activeUniqueValues = [];
            const activeSubdetCodes = [];

            for (const [subdet, totalPct] of Object.entries(sumas)) {
                const code = Number(subdet);
                const name = nombres[subdet] || `Subtipo ${code}`;
                labels.push(name);
                dataValues.push(Number(totalPct.toFixed(2)));
                activeSubdetCodes.push(code);

                const colorHex = palette[colorIdx % palette.length];
                bgColors.push(colorHex);

                activeUniqueValues.push({
                    value: code,
                    label: name,
                    symbol: { type: "simple-fill", color: colorHex, outline: { color: "#666", width: 0.5 } }
                });

                colorIdx++;
            }

            if (labels.length === 0) {
                if (summaryContainer) summaryContainer.innerHTML = '<p style="margin:0;color:#666;text-align:center;">Sin porcentajes válidos.</p>';
                return;
            }

            const ctx = canvas.getContext("2d");
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (window.determinantesChartInstance) {
                window.determinantesChartInstance.destroy();
                window.determinantesChartInstance = null;
            }

            if (window.activeFeatureLayer) {
                if (window.activeFeatureLayer.renderer && window.activeFeatureLayer.renderer.type === "unique-value") {
                    const newRenderer = window.activeFeatureLayer.renderer.clone();
                    newRenderer.field = "subdet";
                    newRenderer.uniqueValueInfos = activeUniqueValues;
                    window.activeFeatureLayer.renderer = newRenderer;
                }
                if (typeof actualizarLeyenda === 'function') { actualizarLeyenda(activeUniqueValues.map(v => v.label), activeUniqueValues.map(v => v.symbol.color)); }


                const filterWhere = "mpcodigo = '" + mpcodigo + "' AND confactadm = 1 AND tdeterm = 14";
                window.activeFeatureLayer.definitionExpression = filterWhere;
            }

            window.determinantesChartInstance = new Chart(ctx, {
                type: "doughnut",
                data: {
                    labels: labels,
                    datasets: [{
                        data: dataValues,
                        backgroundColor: bgColors,
                        borderWidth: 1,
                        borderColor: "#ffffff"
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    onClick: function (evt, elements) {
                        if (!elements.length) return;
                        var idx = elements[0].index;
                        var subdetCode = activeSubdetCodes[idx];

                        var filterWhere = "mpcodigo = '" + mpcodigo + "' AND confactadm = 1 AND tdeterm = 14 AND subdet = " + subdetCode;
                        if (window.activeFeatureLayer) {
                            window.activeFeatureLayer.definitionExpression = filterWhere;
                            window.activeFeatureLayer.queryExtent({ where: filterWhere }).then(function (res) {
                                if (res.extent) view.goTo(res.extent.expand(1.3));
                            });
                        }
                    },
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: { font: { family: "Outfit", size: 11 } }
                        },
                        tooltip: {
                            callbacks: {
                                label: function (context) {
                                    const label = context.label || '';
                                    const val = context.raw || 0;
                                    return `${label}: ${val}%`;
                                }
                            }
                        }
                    }
                }
            });

            if (summaryContainer) {
                summaryContainer.innerHTML = '<div style="margin-top:10px; font-family:\'Outfit\'; font-size:13px; color:#444;"><strong>Densidades:</strong> Porcentaje de cubrimiento en relación con el área del municipio.</div>';
            }

        } catch (e) {
            if (summaryContainer) summaryContainer.innerHTML = '<p style="margin:0;color:#c00;">Error al generar gráficos de Densidades.</p>';
            console.error("cargarDeterminantesDensidades error:", e);
        }
    }

    async function cargarDeterminantesPlanificacion(mpcodigo, chartSelector, summarySelector) {
        const canvas = document.querySelector(chartSelector);
        const summaryContainer = document.querySelector(summarySelector);
        if (!canvas) return;

        if (!mpcodigo) {
            if (window.determinantesChartInstance) window.determinantesChartInstance.destroy();
            if (summaryContainer) summaryContainer.innerHTML = '<p style="margin:0;color:#666;font-style:italic;">Seleccione un municipio</p>';
            return;
        }

        if (window.determinantesChartInstance) window.determinantesChartInstance.destroy();
        if (summaryContainer) summaryContainer.innerHTML = '<div style="text-align:center;padding:10px;">Consultando datos de Instrumentos de planificación...</div>';

        try {
            const cfg = getActiveLayerConfig();
            const url = cfg.url || `${CL_BASE}/19`;

            const qUrl = `${url}/query`;
            const params = new URLSearchParams({
                where: `mpcodigo = '${mpcodigo}' AND tdeterm = 4 AND confactadm = 1`,
                outFields: "subdet,nomdet,descrip,porcentaje,mpnombre,dpnombre",
                returnGeometry: "false",
                f: "json"
            });

            const resp = await fetch(`${qUrl}?${params.toString()}`);
            if (!resp.ok) throw new Error("Network error");
            const data = await resp.json();

            let mpNombre = mpcodigo;
            let dpNombre = "";
            if (data.features && data.features.length > 0) {
                mpNombre = data.features[0].attributes.mpnombre || mpcodigo;
                dpNombre = data.features[0].attributes.dpnombre || "";
            } else if (typeof municipioInfo !== 'undefined' && municipioInfo) {
                mpNombre = municipioInfo.mpnombre || municipioInfo.nombre_mpio || mpcodigo;
                dpNombre = municipioInfo.dpnombre || municipioInfo.nombre_dpto || "";
            }
            const chartTitle = document.getElementById("chartTitle");
            if (chartTitle) chartTitle.textContent = dpNombre ? `Distribución de los determinantes del ${mpNombre}, ${dpNombre}` : `Distribución de los determinantes del ${mpNombre}`;

            if (!data.features || data.features.length === 0) {
                if (summaryContainer) summaryContainer.innerHTML = '<p style="margin:0;color:#666;text-align:center;">No hay información de Derivadas de instrumentos de planificación (tdeterm=4) registrada o aprobada para este municipio.</p>';
                if (typeof actualizarLeyenda === 'function') actualizarLeyenda([], []);
                return;
            }

            const subdetMap = {};
            const subdetOrder = [];
            const descripSet = new Set();
            const sumas = {};

            data.features.forEach(f => {
                const sub = f.attributes.subdet;
                const nom = f.attributes.descrip || `Subtipo ${sub}`;
                const desc = f.attributes.descrip || "Sin descripción";
                const pct = parseFloat(f.attributes.porcentaje) || 0;

                if (sub != null) {
                    if (!subdetMap[sub]) {
                        subdetMap[sub] = nom;
                        subdetOrder.push(sub);
                    }
                    descripSet.add(desc);

                    if (!sumas[desc]) sumas[desc] = {};
                    if (!sumas[desc][sub]) sumas[desc][sub] = 0;
                    sumas[desc][sub] += pct;
                }
            });

            const labels = subdetOrder.map(sub => subdetMap[sub]);

            const palette = ["#f8961e", "#43aa8b", "#f9c74f", "#f94144", "#90be6d", "#277da1", "#f3722c", "#577590"];
            const datasets = [];
            let colorIdx = 0;
            const activeUniqueValues = [];

            for (const desc of Array.from(descripSet)) {
                const colorHex = palette[colorIdx % palette.length];
                const dataArray = subdetOrder.map(sub => {
                    const val = sumas[desc][sub] || 0;
                    return Number(val.toFixed(2));
                });

                datasets.push({
                    label: desc,
                    data: dataArray,
                    backgroundColor: colorHex,
                    borderColor: "#ffffff",
                    borderWidth: 1
                });

                activeUniqueValues.push({
                    value: desc,
                    label: desc,
                    symbol: { type: "simple-fill", color: colorHex, outline: { color: "#666", width: 0.5 } }
                });

                colorIdx++;
            }

            if (labels.length === 0) {
                if (summaryContainer) summaryContainer.innerHTML = '<p style="margin:0;color:#666;text-align:center;">Sin porcentajes válidos.</p>';
                return;
            }

            const ctx = canvas.getContext("2d");
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (window.determinantesChartInstance) {
                window.determinantesChartInstance.destroy();
                window.determinantesChartInstance = null;
            }

            if (window.activeFeatureLayer) {
                if (window.activeFeatureLayer.renderer && window.activeFeatureLayer.renderer.type === "unique-value") {
                    const newRenderer = window.activeFeatureLayer.renderer.clone();
                    newRenderer.field = "descrip";
                    newRenderer.uniqueValueInfos = activeUniqueValues;
                    window.activeFeatureLayer.renderer = newRenderer;
                }
                if (typeof actualizarLeyenda === 'function') { actualizarLeyenda(activeUniqueValues.map(v => v.label), activeUniqueValues.map(v => v.symbol.color)); }


                const filterWhere = "mpcodigo = '" + mpcodigo + "' AND confactadm = 1 AND tdeterm = 4";
                window.activeFeatureLayer.definitionExpression = filterWhere;
            }

            window.determinantesChartInstance = new Chart(ctx, {
                type: "bar",
                data: {
                    labels: labels,
                    datasets: datasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            stacked: true,
                            title: { display: true, text: "Sub-tipo de determinante", font: { family: "Outfit" } }
                        },
                        y: {
                            stacked: true,
                            title: { display: true, text: "Porcentaje (%)", font: { family: "Outfit" } }
                        }
                    },
                    onClick: function (evt, elements) {
                        if (!elements.length) return;
                        const element = elements[0];
                        const datasetIndex = element.datasetIndex;
                        const index = element.index;

                        const clickedDescrip = datasets[datasetIndex].label;
                        const clickedSubdet = subdetOrder[index];

                        const filterWhere = `mpcodigo = '${mpcodigo}' AND confactadm = 1 AND tdeterm = 4 AND subdet = ${clickedSubdet} AND descrip = '${clickedDescrip}'`;
                        if (window.activeFeatureLayer) {
                            window.activeFeatureLayer.definitionExpression = filterWhere;
                            window.activeFeatureLayer.queryExtent({ where: filterWhere }).then(function (res) {
                                if (res.extent) view.goTo(res.extent.expand(1.3));
                            });
                        }
                    },
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: { font: { family: "Outfit", size: 11 } }
                        },
                        tooltip: {
                            callbacks: {
                                label: function (context) {
                                    const label = context.dataset.label || '';
                                    const val = context.raw || 0;
                                    return `${label}: ${val}%`;
                                }
                            }
                        }
                    }
                }
            });

            if (summaryContainer) {
                summaryContainer.innerHTML = '<div style="margin-top:10px; font-family:\'Outfit\'; font-size:13px; color:#444;"><strong>Derivadas de instrumentos de planificación:</strong> Porcentaje de cubrimiento en relación con el área del municipio.</div>';
            }

        } catch (e) {
            if (summaryContainer) summaryContainer.innerHTML = '<p style="margin:0;color:#c00;">Error al generar gráficos de Instrumentos de planificación.</p>';
            console.error("cargarDeterminantesPlanificacion error:", e);
        }
    }

    async function cargarDeterminantesRiesgo(mpcodigo, chartSelector, summarySelector) {
        const canvas = document.querySelector(chartSelector);
        const summaryContainer = document.querySelector(summarySelector);
        if (!canvas) return;

        if (!mpcodigo) {
            if (window.determinantesChartInstance) window.determinantesChartInstance.destroy();
            if (summaryContainer) summaryContainer.innerHTML = '<p style="margin:0;color:#666;font-style:italic;">Seleccione un municipio</p>';
            return;
        }

        if (window.determinantesChartInstance) window.determinantesChartInstance.destroy();
        if (summaryContainer) summaryContainer.innerHTML = '<div style="text-align:center;padding:10px;">Consultando datos de Gestión del riesgo y Cambio Climático...</div>';

        try {
            const cfg = getActiveLayerConfig();
            const url = cfg.url || `${CL_BASE}/19`;

            const qUrl = `${url}/query`;
            const params = new URLSearchParams({
                where: `mpcodigo = '${mpcodigo}' AND tdeterm = 7 AND confactadm = 1`,
                outFields: "subdet,nomdet,descrip,porcentaje,mpnombre,dpnombre",
                returnGeometry: "false",
                f: "json"
            });

            const resp = await fetch(`${qUrl}?${params.toString()}`);
            if (!resp.ok) throw new Error("Network error");
            const data = await resp.json();

            let mpNombre = mpcodigo;
            let dpNombre = "";
            if (data.features && data.features.length > 0) {
                mpNombre = data.features[0].attributes.mpnombre || mpcodigo;
                dpNombre = data.features[0].attributes.dpnombre || "";
            } else if (typeof municipioInfo !== 'undefined' && municipioInfo) {
                mpNombre = municipioInfo.mpnombre || municipioInfo.nombre_mpio || mpcodigo;
                dpNombre = municipioInfo.dpnombre || municipioInfo.nombre_dpto || "";
            }
            const chartTitle = document.getElementById("chartTitle");
            if (chartTitle) chartTitle.textContent = dpNombre ? `Distribución de los determinantes del ${mpNombre}, ${dpNombre}` : `Distribución de los determinantes del ${mpNombre}`;

            if (!data.features || data.features.length === 0) {
                if (summaryContainer) summaryContainer.innerHTML = '<p style="margin:0;color:#666;text-align:center;">No hay información de Gestión del riesgo y Cambio Climático (tdeterm=7) registrada o aprobada para este municipio.</p>';
                if (typeof actualizarLeyenda === 'function') actualizarLeyenda([], []);
                return;
            }

            const subdetMap = {};
            const subdetOrder = [];
            const descripSet = new Set();
            const sumas = {};

            data.features.forEach(f => {
                const sub = f.attributes.subdet;
                const nom = f.attributes.descrip || `Subtipo ${sub}`;
                const desc = f.attributes.descrip || "Sin descripción";
                const pct = parseFloat(f.attributes.porcentaje) || 0;

                if (sub != null) {
                    if (!subdetMap[sub]) {
                        subdetMap[sub] = nom;
                        subdetOrder.push(sub);
                    }
                    descripSet.add(desc);

                    if (!sumas[desc]) sumas[desc] = {};
                    if (!sumas[desc][sub]) sumas[desc][sub] = 0;
                    sumas[desc][sub] += pct;
                }
            });

            const labels = subdetOrder.map(sub => subdetMap[sub]);

            const palette = ["#f8961e", "#43aa8b", "#f9c74f", "#f94144", "#90be6d", "#277da1", "#f3722c", "#577590"];
            const datasets = [];
            let colorIdx = 0;
            const activeUniqueValues = [];

            for (const desc of Array.from(descripSet)) {
                const colorHex = palette[colorIdx % palette.length];
                const dataArray = subdetOrder.map(sub => {
                    const val = sumas[desc][sub] || 0;
                    return Number(val.toFixed(2));
                });

                datasets.push({
                    label: desc,
                    data: dataArray,
                    backgroundColor: colorHex,
                    borderColor: "#ffffff",
                    borderWidth: 1
                });

                activeUniqueValues.push({
                    value: desc,
                    label: desc,
                    symbol: { type: "simple-fill", color: colorHex, outline: { color: "#666", width: 0.5 } }
                });

                colorIdx++;
            }

            if (labels.length === 0) {
                if (summaryContainer) summaryContainer.innerHTML = '<p style="margin:0;color:#666;text-align:center;">Sin porcentajes válidos.</p>';
                return;
            }

            const ctx = canvas.getContext("2d");
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (window.determinantesChartInstance) {
                window.determinantesChartInstance.destroy();
                window.determinantesChartInstance = null;
            }

            if (window.activeFeatureLayer) {
                if (window.activeFeatureLayer.renderer && window.activeFeatureLayer.renderer.type === "unique-value") {
                    const newRenderer = window.activeFeatureLayer.renderer.clone();
                    newRenderer.field = "descrip";
                    newRenderer.uniqueValueInfos = activeUniqueValues;
                    window.activeFeatureLayer.renderer = newRenderer;
                }
                if (typeof actualizarLeyenda === 'function') { actualizarLeyenda(activeUniqueValues.map(v => v.label), activeUniqueValues.map(v => v.symbol.color)); }


                const filterWhere = "mpcodigo = '" + mpcodigo + "' AND confactadm = 1 AND tdeterm = 7";
                window.activeFeatureLayer.definitionExpression = filterWhere;
            }

            window.determinantesChartInstance = new Chart(ctx, {
                type: "bar",
                data: {
                    labels: labels,
                    datasets: datasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            stacked: true,
                            title: { display: true, text: "Sub-tipo de determinante", font: { family: "Outfit" } }
                        },
                        y: {
                            stacked: true,
                            title: { display: true, text: "Porcentaje (%)", font: { family: "Outfit" } }
                        }
                    },
                    onClick: function (evt, elements) {
                        if (!elements.length) return;
                        const element = elements[0];
                        const datasetIndex = element.datasetIndex;
                        const index = element.index;

                        const clickedDescrip = datasets[datasetIndex].label;
                        const clickedSubdet = subdetOrder[index];

                        const filterWhere = `mpcodigo = '${mpcodigo}' AND confactadm = 1 AND tdeterm = 7 AND subdet = ${clickedSubdet} AND descrip = '${clickedDescrip}'`;
                        if (window.activeFeatureLayer) {
                            window.activeFeatureLayer.definitionExpression = filterWhere;
                            window.activeFeatureLayer.queryExtent({ where: filterWhere }).then(function (res) {
                                if (res.extent) view.goTo(res.extent.expand(1.3));
                            });
                        }
                    },
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: { font: { family: "Outfit", size: 11 } }
                        },
                        tooltip: {
                            callbacks: {
                                label: function (context) {
                                    const label = context.dataset.label || '';
                                    const val = context.raw || 0;
                                    return `${label}: ${val}%`;
                                }
                            }
                        }
                    }
                }
            });

            if (summaryContainer) {
                summaryContainer.innerHTML = '<div style="margin-top:10px; font-family:\'Outfit\'; font-size:13px; color:#444;"><strong>Gestión del riesgo y Cambio Climático:</strong> Porcentaje de cubrimiento en relación con el área del municipio.</div>';
            }

        } catch (e) {
            if (summaryContainer) summaryContainer.innerHTML = '<p style="margin:0;color:#c00;">Error al generar gráficos de Gestión del riesgo y Cambio Climático.</p>';
            console.error("cargarDeterminantesRiesgo error:", e);
        }
    }

    async function cargarDeterminantesPatrimonio(mpcodigo, chartSelector, summarySelector) {
        const canvas = document.querySelector(chartSelector);
        const summaryContainer = document.querySelector(summarySelector);
        if (!canvas) return;

        if (!mpcodigo) {
            if (window.determinantesChartInstance) window.determinantesChartInstance.destroy();
            if (summaryContainer) summaryContainer.innerHTML = '<p style="margin:0;color:#666;font-style:italic;">Seleccione un municipio</p>';
            return;
        }

        if (window.determinantesChartInstance) window.determinantesChartInstance.destroy();
        if (summaryContainer) summaryContainer.innerHTML = '<div style="text-align:center;padding:10px;">Consultando datos de Patrimonio cultural...</div>';

        try {
            const cfg = getActiveLayerConfig();
            const url = cfg.url || `${CL_BASE}/19`;

            const qUrl = `${url}/query`;
            const params = new URLSearchParams({
                where: `mpcodigo = '${mpcodigo}' AND tdeterm = 9 AND confactadm = 1`,
                outFields: "subdet,nomdet,descrip,porcentaje,mpnombre,dpnombre",
                returnGeometry: "false",
                f: "json"
            });

            const resp = await fetch(`${qUrl}?${params.toString()}`);
            if (!resp.ok) throw new Error("Network error");
            const data = await resp.json();

            let mpNombre = mpcodigo;
            let dpNombre = "";
            if (data.features && data.features.length > 0) {
                mpNombre = data.features[0].attributes.mpnombre || mpcodigo;
                dpNombre = data.features[0].attributes.dpnombre || "";
            } else if (typeof municipioInfo !== 'undefined' && municipioInfo) {
                mpNombre = municipioInfo.mpnombre || municipioInfo.nombre_mpio || mpcodigo;
                dpNombre = municipioInfo.dpnombre || municipioInfo.nombre_dpto || "";
            }
            const chartTitle = document.getElementById("chartTitle");
            if (chartTitle) chartTitle.textContent = dpNombre ? `Distribución de los determinantes del ${mpNombre}, ${dpNombre}` : `Distribución de los determinantes del ${mpNombre}`;

            if (!data.features || data.features.length === 0) {
                if (summaryContainer) summaryContainer.innerHTML = '<p style="margin:0;color:#666;text-align:center;">No hay información de Patrimonio cultural (tdeterm=9) registrada o aprobada para este municipio.</p>';
                if (typeof actualizarLeyenda === 'function') actualizarLeyenda([], []);
                return;
            }

            const subdetMap = {};
            const subdetOrder = [];
            const descripSet = new Set();
            const sumas = {};

            data.features.forEach(f => {
                const sub = f.attributes.subdet;
                const nom = f.attributes.descrip || `Subtipo ${sub}`;
                const desc = f.attributes.descrip || "Sin descripción";
                const pct = parseFloat(f.attributes.porcentaje) || 0;

                if (sub != null) {
                    if (!subdetMap[sub]) {
                        subdetMap[sub] = nom;
                        subdetOrder.push(sub);
                    }
                    descripSet.add(desc);

                    if (!sumas[desc]) sumas[desc] = {};
                    if (!sumas[desc][sub]) sumas[desc][sub] = 0;
                    sumas[desc][sub] += pct;
                }
            });

            const labels = subdetOrder.map(sub => subdetMap[sub]);

            const palette = ["#f8961e", "#43aa8b", "#f9c74f", "#f94144", "#90be6d", "#277da1", "#f3722c", "#577590"];
            const datasets = [];
            let colorIdx = 0;
            const activeUniqueValues = [];

            for (const desc of Array.from(descripSet)) {
                const colorHex = palette[colorIdx % palette.length];
                const dataArray = subdetOrder.map(sub => {
                    const val = sumas[desc][sub] || 0;
                    return Number(val.toFixed(2));
                });

                datasets.push({
                    label: desc,
                    data: dataArray,
                    backgroundColor: colorHex,
                    borderColor: "#ffffff",
                    borderWidth: 1
                });

                activeUniqueValues.push({
                    value: desc,
                    label: desc,
                    symbol: { type: "simple-fill", color: colorHex, outline: { color: "#666", width: 0.5 } }
                });

                colorIdx++;
            }

            if (labels.length === 0) {
                if (summaryContainer) summaryContainer.innerHTML = '<p style="margin:0;color:#666;text-align:center;">Sin porcentajes válidos.</p>';
                return;
            }

            const ctx = canvas.getContext("2d");
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (window.determinantesChartInstance) {
                window.determinantesChartInstance.destroy();
                window.determinantesChartInstance = null;
            }

            if (window.activeFeatureLayer) {
                if (window.activeFeatureLayer.renderer && window.activeFeatureLayer.renderer.type === "unique-value") {
                    const newRenderer = window.activeFeatureLayer.renderer.clone();
                    newRenderer.field = "descrip";
                    newRenderer.uniqueValueInfos = activeUniqueValues;
                    window.activeFeatureLayer.renderer = newRenderer;
                }
                if (typeof actualizarLeyenda === 'function') { actualizarLeyenda(activeUniqueValues.map(v => v.label), activeUniqueValues.map(v => v.symbol.color)); }


                const filterWhere = "mpcodigo = '" + mpcodigo + "' AND confactadm = 1 AND tdeterm = 9";
                window.activeFeatureLayer.definitionExpression = filterWhere;
            }

            window.determinantesChartInstance = new Chart(ctx, {
                type: "bar",
                data: {
                    labels: labels,
                    datasets: datasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            stacked: true,
                            title: { display: true, text: "Sub-tipo de determinante", font: { family: "Outfit" } }
                        },
                        y: {
                            stacked: true,
                            title: { display: true, text: "Porcentaje (%)", font: { family: "Outfit" } }
                        }
                    },
                    onClick: function (evt, elements) {
                        if (!elements.length) return;
                        const element = elements[0];
                        const datasetIndex = element.datasetIndex;
                        const index = element.index;

                        const clickedDescrip = datasets[datasetIndex].label;
                        const clickedSubdet = subdetOrder[index];

                        const filterWhere = `mpcodigo = '${mpcodigo}' AND confactadm = 1 AND tdeterm = 9 AND subdet = ${clickedSubdet} AND descrip = '${clickedDescrip}'`;
                        if (window.activeFeatureLayer) {
                            window.activeFeatureLayer.definitionExpression = filterWhere;
                            window.activeFeatureLayer.queryExtent({ where: filterWhere }).then(function (res) {
                                if (res.extent) view.goTo(res.extent.expand(1.3));
                            });
                        }
                    },
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: { font: { family: "Outfit", size: 11 } }
                        },
                        tooltip: {
                            callbacks: {
                                label: function (context) {
                                    const label = context.dataset.label || '';
                                    const val = context.raw || 0;
                                    return `${label}: ${val}%`;
                                }
                            }
                        }
                    }
                }
            });

            if (summaryContainer) {
                summaryContainer.innerHTML = '<div style="margin-top:10px; font-family:\'Outfit\'; font-size:13px; color:#444;"><strong>Patrimonio cultural:</strong> Porcentaje de cubrimiento en relación con el área del municipio.</div>';
            }

        } catch (e) {
            if (summaryContainer) summaryContainer.innerHTML = '<p style="margin:0;color:#c00;">Error al generar gráficos de Patrimonio cultural.</p>';
            console.error("cargarDeterminantesPatrimonio error:", e);
        }
    }

    async function cargarDeterminantesLineaInfraestructura(mpcodigo, chartSelector, summarySelector) {
        if (typeof actualizarLeyenda === 'function') actualizarLeyenda([], []);
        const summaryContainer = document.querySelector(summarySelector);
        const chartTitle = document.getElementById("chartTitle");
        const canvas = document.querySelector(chartSelector);

        if (summaryContainer) summaryContainer.innerHTML = '<p class="det-loading">Cargando datos de Infraestructura (Línea)...</p>';
        if (chartTitle) chartTitle.textContent = "Cargando...";

        try {
            const cfg = getActiveLayerConfig();
            const url = cfg.url || `${CL_BASE}/16`;

            const qUrl = `${url}/query`;
            const params = new URLSearchParams({
                where: `mpcodigo = '${mpcodigo}' AND determ = 4 AND tdeterm = 13`,
                outFields: "subdet,longitud",
                outStatistics: JSON.stringify([{
                    statisticType: "sum",
                    onStatisticField: "longitud",
                    outStatisticFieldName: "suma_longitud"
                }]),
                groupByFieldsForStatistics: "subdet",
                f: "json"
            });

            const resp = await fetch(`${qUrl}?${params.toString()}`);
            if (!resp.ok) throw new Error("Network error");
            const data = await resp.json();

            // Wait for layer to load to ensure renderer is available
            if (window.activeFeatureLayer) {
                try {
                    await window.activeFeatureLayer.load();
                } catch (e) {
                    console.warn("Could not load activeFeatureLayer", e);
                }
            }

            let mpNombre = "Municipio";
            let dpNombre = "Departamento";
            if (typeof municipioInfo !== 'undefined' && municipioInfo && municipioInfo.mpnombre) {
                mpNombre = municipioInfo.mpnombre || municipioInfo.nombre_mpio || mpcodigo;
                dpNombre = municipioInfo.dpnombre || municipioInfo.nombre_dpto || "";
            } else {
                try {
                    const nmRes = await fetch(`${url}/query?where=mpcodigo='${mpcodigo}'&outFields=mpnombre,dpnombre&returnGeometry=false&resultRecordCount=1&f=json`).then(r => r.json());
                    if (nmRes.features && nmRes.features.length > 0) {
                        mpNombre = nmRes.features[0].attributes.mpnombre || "Municipio";
                        dpNombre = nmRes.features[0].attributes.dpnombre || "Departamento";
                    }
                } catch (e) { }
            }

            if (!data.features || data.features.length === 0) {
                if (summaryContainer) summaryContainer.innerHTML = '<p style="margin:0;color:#666;text-align:center;">No hay información de Infraestructura (Línea) registrada o aprobada para este municipio.</p>';

                // if (chartTitle) chartTitle.textContent = `Distribución de los Determinantes (Línea) del ${mpNombre}, ${dpNombre}, tipo Infraestructura`;
                if (chartTitle) chartTitle.textContent = `Distribución de los Determinantes (Línea) del ${mpNombre}, ${dpNombre}`;
                if (window.determinantesChartInstance) window.determinantesChartInstance.destroy();
                if (typeof actualizarLeyenda === 'function') actualizarLeyenda([], []);
                return;
            }

            // Mapeo de dominios
            const uniqueValuesMap = {};
            if (window.domainDict && window.domainDict["16_subdet"]) {
                Object.assign(uniqueValuesMap, window.domainDict["16_subdet"]);
            } else if (window.domainDict && window.domainDict["19_subdet"]) {
                Object.assign(uniqueValuesMap, window.domainDict["19_subdet"]);
            }



            const fallbackLabels = {
                1301: "red vial nacional o regional",
                1302: "Puertos y aeropuertos",
                1303: "Red Férrea",
                1304: "Plantas de Tratamiento PTAR - Sistemas de Tratamiento STAR)",
                1305: "Suministro de energía",
                1306: "Rellenos Sanitarios",
                1307: "Equipamientos Colectivos de Alto Impacto Ambiental",
                1308: "Gasoducto",
                1309: "Poliducto",
                1310: "Transporte de Hidrocarburos",
                1311: "Telecomunicaciones"
            };

            const results = data.features.map(f => {
                const code = f.attributes.subdet;
                return {
                    subdet: code,
                    label: uniqueValuesMap[code] || fallbackLabels[code] || `Subtipo ${code}`,
                    longitud: f.attributes.suma_longitud || 0
                };
            });

            results.sort((a, b) => b.longitud - a.longitud);

            const labels = results.map(r => r.label);
            const values = results.map(r => r.longitud);

            let bgColors = [];
            let activeUniqueValues = [];
            if (window.activeFeatureLayer && window.activeFeatureLayer.renderer) {
                const renderer = window.activeFeatureLayer.renderer;
                if (renderer.type === "unique-value") {
                    const infos = renderer.uniqueValueInfos || [];
                    results.forEach(r => {
                        const info = infos.find(i => i.value == r.subdet);
                        if (info && info.symbol) {
                            bgColors.push(getSymbolColorRGBA(info.symbol, 0.8));
                            activeUniqueValues.push({ value: r.subdet, label: r.label, symbol: info.symbol });
                        } else {
                            bgColors.push("rgba(100,100,100,0.8)");
                            activeUniqueValues.push({ value: r.subdet, label: r.label, symbol: { color: [100, 100, 100, 204] } });
                        }
                    });
                }
            }

            if (bgColors.length === 0) bgColors = results.map(() => "rgba(0,74,105,0.8)");

            if (chartTitle) {
                chartTitle.textContent = `Distribución de los Determinantes (Línea) del ${mpNombre}, ${dpNombre}, tipo Infraestructura`;
            }

            if (summaryContainer) summaryContainer.innerHTML = "";

            if (window.activeFeatureLayer) {
                if (activeUniqueValues.length > 0 && window.activeFeatureLayer.renderer && window.activeFeatureLayer.renderer.type === "unique-value") {
                    const newRenderer = window.activeFeatureLayer.renderer.clone();
                    newRenderer.field = "subdet";
                    newRenderer.uniqueValueInfos = activeUniqueValues;
                    window.activeFeatureLayer.renderer = newRenderer;
                }
                if (typeof actualizarLeyenda === 'function') actualizarLeyenda(activeUniqueValues.map(v => v.label), activeUniqueValues.map(v => v.symbol.color));

                const filterWhere = "mpcodigo = '" + mpcodigo + "' AND determ = 4 AND tdeterm = 13";
                window.activeFeatureLayer.definitionExpression = filterWhere;
                window.activeFeatureLayer.queryExtent({ where: filterWhere }).then(function (res) {
                    if (res.extent) window.view.goTo(res.extent.expand(1.2));
                }).catch(function (e) { console.warn("Error zoom Infraestructura Línea:", e); });
            }

            const ctx = canvas.getContext("2d");
            if (window.determinantesChartInstance) {
                window.determinantesChartInstance.destroy();
                window.determinantesChartInstance = null;
            }

            window.determinantesChartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: "Longitud (Km)",
                        data: values,
                        backgroundColor: bgColors,
                        borderWidth: 1
                    }]
                },
                options: {
                    onClick: (e, elements) => {
                        if (!window.activeFeatureLayer) return;
                        if (!elements || elements.length === 0) {
                            // Reset filter when clicking outside bars
                            const filterWhere = "mpcodigo = '" + mpcodigo + "' AND determ = 4 AND tdeterm = 13";
                            window.activeFeatureLayer.definitionExpression = filterWhere;
                            window.activeFeatureLayer.queryExtent({ where: filterWhere }).then(function (res) {
                                if (res.extent) window.view.goTo(res.extent.expand(1.2));
                            });
                            return;
                        }
                        // Filter by selected bar
                        const index = elements[0].index;
                        const selectedSubdet = results[index].subdet;
                        const filterWhere = "mpcodigo = '" + mpcodigo + "' AND determ = 4 AND tdeterm = 13 AND subdet = " + selectedSubdet;
                        window.activeFeatureLayer.definitionExpression = filterWhere;
                        window.activeFeatureLayer.queryExtent({ where: filterWhere }).then(function (res) {
                            if (res.extent) window.view.goTo(res.extent.expand(1.2));
                        });
                    },
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: { label: (context) => context.raw.toFixed(2) + ' km' }
                        },
                        datalabels: {
                            anchor: 'end',
                            align: 'end',
                            color: '#444',
                            font: { size: 11, weight: 'bold' },
                            formatter: (val) => val.toFixed(2) + ' km'
                        }
                    },
                    scales: {
                        x: { title: { display: true, text: "Longitud (Km)", font: { size: 13, weight: "bold" } }, ticks: { beginAtZero: true } },
                        y: { title: { display: true, text: "Sub-Tipo", font: { size: 13, weight: "bold" } }, ticks: { autoSkip: false } }
                    }
                }
            });

        } catch (e) {
            console.error("cargarDeterminantesLineaInfraestructura error:", e);
            if (summaryContainer) summaryContainer.innerHTML = '<p style="color:red; text-align:center;">Error cargando datos de Infraestructura Línea.</p>';
        }
    }

    async function cargarDeterminantesPuntoPatrimoniales(mpcodigo, chartSelector, summarySelector) {
        const chartCanvas = document.querySelector(chartSelector);
        const summaryContainer = document.querySelector(summarySelector);
        const chartTitle = document.getElementById("chartTitle");

        if (summaryContainer) summaryContainer.innerHTML = '<p class="det-loading">Cargando gráficos de Patrimoniales...</p>';
        if (typeof actualizarLeyenda === 'function') actualizarLeyenda([], []);

        const cfg = getActiveLayerConfig();
        const url = cfg.url || `${CL_BASE}/12`;

        try {
            const qUrl = `${url}/query`;
            const params = new URLSearchParams({
                where: `mpcodigo = '${mpcodigo}' AND determ = 3 AND tdeterm = 12`,
                outFields: "subdet",
                outStatistics: JSON.stringify([{
                    statisticType: "count",
                    onStatisticField: "subdet",
                    outStatisticFieldName: "count_subdet"
                }]),
                groupByFieldsForStatistics: "subdet",
                f: "json"
            });

            const resp = await fetch(`${qUrl}?${params.toString()}`);
            if (!resp.ok) throw new Error("Network error");
            const data = await resp.json();

            if (window.activeFeatureLayer) {
                try {
                    await window.activeFeatureLayer.load();
                } catch (e) {
                    console.warn("Could not load activeFeatureLayer", e);
                }
            }

            let mpNombre = "Municipio";
            let dpNombre = "Departamento";
            let generalDescrip = "";
            if (typeof municipioInfo !== 'undefined' && municipioInfo && municipioInfo.mpnombre) {
                mpNombre = municipioInfo.mpnombre || municipioInfo.nombre_mpio || mpcodigo;
                dpNombre = municipioInfo.dpnombre || municipioInfo.nombre_dpto || "";
            }
            try {
                const nmRes = await fetch(`${url}/query?where=mpcodigo='${mpcodigo}' AND determ=3 AND tdeterm=12&outFields=mpnombre,dpnombre,descrip&returnGeometry=false&resultRecordCount=1&f=json`).then(r => r.json());
                if (nmRes.features && nmRes.features.length > 0) {
                    if (mpNombre === "Municipio" || mpNombre === mpcodigo) {
                        mpNombre = nmRes.features[0].attributes.mpnombre || "Municipio";
                    }
                    if (dpNombre === "Departamento" || dpNombre === "") {
                        dpNombre = nmRes.features[0].attributes.dpnombre || "Departamento";
                    }
                    generalDescrip = nmRes.features[0].attributes.descrip || "";
                }
            } catch (e) { }

            if (!data.features || data.features.length === 0) {
                if (summaryContainer) summaryContainer.innerHTML = '<p style="margin:0;color:#666;text-align:center;">No hay información Patrimonial (Punto) registrada o aprobada para este municipio.</p>';
                if (chartTitle) chartTitle.textContent = `Distribución de los Determinantes (Punto) del ${mpNombre}, ${dpNombre}, tipo 12_Patrimonio`;
                if (window.determinantesChartInstance) window.determinantesChartInstance.destroy();
                if (typeof actualizarLeyenda === 'function') actualizarLeyenda([], []);
                return;
            }

            const fallbackLabels = {
                1201: "Bienes de interés cultural",
                1202: "Sitios arqueológicos",
                1203: "Patrimonio cultural inmaterial",
                1204: "Paisajes culturales"
            };

            const uniqueValuesMap = {};
            if (window.domainDict && window.domainDict["12_subdet"]) {
                Object.assign(uniqueValuesMap, window.domainDict["12_subdet"]);
            } else if (window.domainDict && window.domainDict["19_subdet"]) {
                Object.assign(uniqueValuesMap, window.domainDict["19_subdet"]);
            }

            const results = data.features.map(f => {
                const code = f.attributes.subdet;
                return {
                    subdet: code,
                    label: uniqueValuesMap[code] || fallbackLabels[code] || `Subtipo ${code}`,
                    count: f.attributes.count_subdet || 0
                };
            });

            results.sort((a, b) => b.count - a.count);

            const labels = results.map(r => r.label);
            const values = results.map(r => r.count);

            // Dynamic colors mapping since server has no subtype colors (Light blue, Light red)
            const colorPalette = ["#63b3ed", "#ff8a8a", "#ffe119", "#4363d8", "#f58231", "#911eb4", "#42d4f4", "#f032e6", "#bfef45", "#fabed4"];
            let bgColors = [];
            let activeUniqueValues = [];

            results.forEach((r, idx) => {
                const colorHex = colorPalette[idx % colorPalette.length];
                bgColors.push(colorHex);
                activeUniqueValues.push({
                    value: r.subdet,
                    label: r.label,
                    symbol: {
                        type: "simple-marker",
                        style: "circle",
                        color: colorHex,
                        size: 8,
                        outline: { color: "#ffffff", width: 1 }
                    }
                });
            });

            if (chartTitle) {
                // chartTitle.textContent = `Distribución de los Determinantes (Punto) del ${mpNombre}, ${dpNombre}, tipo 12_Patrimonio`;
                chartTitle.textContent = `Distribución de los Determinantes (Punto) del ${mpNombre}, ${dpNombre}`;
            }

            if (summaryContainer) {
                summaryContainer.innerHTML = "";
                if (generalDescrip) {
                    const descP = document.createElement("p");
                    descP.style.marginTop = "15px";
                    descP.style.color = "#333";
                    descP.style.fontSize = "14px";
                    descP.style.lineHeight = "1.5";
                    descP.innerHTML = `<strong>Descripción general:</strong><br/>${generalDescrip}`;
                    summaryContainer.appendChild(descP);
                }
            }

            if (window.activeFeatureLayer) {
                const newRenderer = {
                    type: "unique-value",
                    field: "subdet",
                    uniqueValueInfos: activeUniqueValues
                };
                window.activeFeatureLayer.renderer = newRenderer;

                if (typeof actualizarLeyenda === 'function') actualizarLeyenda(activeUniqueValues.map(v => v.label), activeUniqueValues.map(v => v.symbol.color));

                const filterWhere = "mpcodigo = '" + mpcodigo + "' AND determ = 3 AND tdeterm = 12";
                window.activeFeatureLayer.definitionExpression = filterWhere;
                window.activeFeatureLayer.queryExtent({ where: filterWhere }).then(function (res) {
                    if (res.extent) window.view.goTo(res.extent.expand(1.2));
                }).catch(function (e) { console.warn("Error zoom Patrimoniales Punto:", e); });
            }

            const ctx = chartCanvas.getContext("2d");
            if (window.determinantesChartInstance) {
                window.determinantesChartInstance.destroy();
                window.determinantesChartInstance = null;
            }

            window.determinantesChartInstance = new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: labels,
                    datasets: [{
                        data: values,
                        backgroundColor: bgColors,
                        borderWidth: 1
                    }]
                },
                options: {
                    onClick: (e, elements) => {
                        if (!window.activeFeatureLayer) return;
                        if (!elements || elements.length === 0) {
                            const filterWhere = "mpcodigo = '" + mpcodigo + "' AND determ = 3 AND tdeterm = 12";
                            window.activeFeatureLayer.definitionExpression = filterWhere;
                            window.activeFeatureLayer.queryExtent({ where: filterWhere }).then(function (res) {
                                if (res.extent) window.view.goTo(res.extent.expand(1.2));
                            });
                            return;
                        }
                        const index = elements[0].index;
                        const selectedSubdet = results[index].subdet;
                        const filterWhere = "mpcodigo = '" + mpcodigo + "' AND determ = 3 AND tdeterm = 12 AND subdet = " + selectedSubdet;
                        window.activeFeatureLayer.definitionExpression = filterWhere;
                        window.activeFeatureLayer.queryExtent({ where: filterWhere }).then(function (res) {
                            if (res.extent) window.view.goTo(res.extent.expand(1.2));
                        });
                    },
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: true,
                            position: 'right',
                            labels: { font: { size: 11 } }
                        },
                        tooltip: {
                            callbacks: { label: (context) => context.label + ': ' + context.raw + ' sitios' }
                        },
                        datalabels: {
                            color: '#fff',
                            font: { size: 11, weight: 'bold' },
                            formatter: (val) => val
                        }
                    }
                }
            });

        } catch (e) {
            console.error("cargarDeterminantesPuntoPatrimoniales error:", e);
            if (summaryContainer) summaryContainer.innerHTML = '<p style="color:red; text-align:center;">Error cargando datos de Patrimoniales Punto.</p>';
        }
    }
    async function cargarDeterminantesPuntoInfraestructura(mpcodigo, chartSelector, summarySelector) {
        const chartCanvas = document.querySelector(chartSelector);
        const summaryContainer = document.querySelector(summarySelector);
        const chartTitle = document.getElementById("chartTitle");

        if (summaryContainer) summaryContainer.innerHTML = '<p class="det-loading">Cargando gráficos de Infraestructura (Punto)...</p>';
        if (typeof actualizarLeyenda === 'function') actualizarLeyenda([], []);

        const cfg = getActiveLayerConfig();
        const url = cfg.url || `${CL_BASE}/15`;

        try {
            const qUrl = `${url}/query`;
            const params = new URLSearchParams({
                where: `mpcodigo = '${mpcodigo}' AND tdeterm = 13`,
                outFields: "subdet",
                outStatistics: JSON.stringify([{
                    statisticType: "count",
                    onStatisticField: "subdet",
                    outStatisticFieldName: "count_subdet"
                }]),
                groupByFieldsForStatistics: "subdet",
                f: "json"
            });

            const resp = await fetch(`${qUrl}?${params.toString()}`);
            if (!resp.ok) throw new Error("Network error");
            const data = await resp.json();

            if (window.activeFeatureLayer) {
                try {
                    await window.activeFeatureLayer.load();
                } catch (e) {
                    console.warn("Could not load activeFeatureLayer", e);
                }
            }
            let mpNombre = "Municipio";
            let dpNombre = "Departamento";
            let generalDescrip = "";
            if (typeof municipioInfo !== 'undefined' && municipioInfo && municipioInfo.mpnombre) {
                mpNombre = municipioInfo.mpnombre || municipioInfo.nombre_mpio || mpcodigo;
                dpNombre = municipioInfo.dpnombre || municipioInfo.nombre_dpto || "";
            }
            try {
                const nmRes = await fetch(`${url}/query?where=mpcodigo='${mpcodigo}' AND tdeterm=13&outFields=mpnombre,dpnombre,descrip&returnGeometry=false&resultRecordCount=1&f=json`).then(r => r.json());
                if (nmRes.features && nmRes.features.length > 0) {
                    if (mpNombre === "Municipio" || mpNombre === mpcodigo) {
                        mpNombre = nmRes.features[0].attributes.mpnombre || "Municipio";
                    }
                    if (dpNombre === "Departamento" || dpNombre === "") {
                        dpNombre = nmRes.features[0].attributes.dpnombre || "Departamento";
                    }
                    generalDescrip = nmRes.features[0].attributes.descrip || "";
                }
            } catch (e) { }

            if (!data.features || data.features.length === 0) {
                if (summaryContainer) summaryContainer.innerHTML = '<p style="margin:0;color:#666;text-align:center;">No hay información de Infraestructura (Punto) registrada o aprobada para este municipio.</p>';
                if (chartTitle) chartTitle.textContent = `Distribución de los Determinantes (Punto) del ${mpNombre}, ${dpNombre}, tipo Infraestructura`;
                if (window.determinantesChartInstance) window.determinantesChartInstance.destroy();
                if (typeof actualizarLeyenda === 'function') actualizarLeyenda([], []);
                return;
            }

            const fallbackLabels = {
                1301: "Reservas de la red vial nacional o regional",
                1302: "Puertos y aeropuertos",
                1303: "Red Férrea",
                1304: "Sistemas de abastecimiento y saneamiento de agua",
                1305: "Suministro de energía",
                1306: "Disposición de residuos solidos",
                1307: "Equipamientos Colectivos de Alto Impacto Ambiental",
                1308: "Gasoducto",
                1309: "Poliducto",
                1310: "Transporte de Hidrocarburos",
                1311: "Telecomunicaciones"
            };

            const uniqueValuesMap = {};
            if (window.domainDict && window.domainDict["15_subdet"]) {
                Object.assign(uniqueValuesMap, window.domainDict["15_subdet"]);
            } else if (window.domainDict && window.domainDict["19_subdet"]) {
                Object.assign(uniqueValuesMap, window.domainDict["19_subdet"]);
            }

            const results = data.features.map(f => {
                const code = f.attributes.subdet;
                return {
                    subdet: code,
                    label: uniqueValuesMap[code] || fallbackLabels[code] || `Subtipo ${code}`,
                    count: f.attributes.count_subdet || 0
                };
            });

            results.sort((a, b) => b.count - a.count);

            const labels = results.map(r => r.label);
            const values = results.map(r => r.count);

            let bgColors = [];
            let activeUniqueValues = [];
            if (window.activeFeatureLayer && window.activeFeatureLayer.renderer) {
                const renderer = window.activeFeatureLayer.renderer;
                if (renderer.type === "unique-value") {
                    const infos = renderer.uniqueValueInfos || [];
                    results.forEach(r => {
                        const info = infos.find(i => i.value == r.subdet);
                        if (info && info.symbol) {
                            bgColors.push(getSymbolColorRGBA(info.symbol, 0.8));
                            activeUniqueValues.push({ value: r.subdet, label: r.label, symbol: info.symbol });
                        } else {
                            bgColors.push("rgba(100,100,100,0.8)");
                            activeUniqueValues.push({ value: r.subdet, label: r.label, symbol: { type: "simple-marker", style: "circle", color: [100, 100, 100, 204], size: 8, outline: { color: "#ffffff", width: 1 } } });
                        }
                    });
                }
            }

            if (bgColors.length === 0) {
                const colorPalette = ["#63b3ed", "#ff8a8a", "#ffe119", "#4363d8", "#f58231", "#911eb4", "#42d4f4", "#f032e6", "#bfef45", "#fabed4"];
                results.forEach((r, idx) => {
                    const colorHex = colorPalette[idx % colorPalette.length];
                    bgColors.push(colorHex);
                    activeUniqueValues.push({
                        value: r.subdet,
                        label: r.label,
                        symbol: {
                            type: "simple-marker",
                            style: "circle",
                            color: colorHex,
                            size: 8,
                            outline: { color: "#ffffff", width: 1 }
                        }
                    });
                });
            }

            if (chartTitle) {
                chartTitle.textContent = `Distribución de los Determinantes (Punto) del ${mpNombre}, ${dpNombre}, tipo Infraestructura`;
            }

            if (summaryContainer) {
                summaryContainer.innerHTML = "";
                if (generalDescrip) {
                    const descP = document.createElement("p");
                    descP.style.marginTop = "15px";
                    descP.style.color = "#333";
                    descP.style.fontSize = "14px";
                    descP.style.lineHeight = "1.5";
                    descP.innerHTML = `<strong>Descripción general:</strong><br/>${generalDescrip}`;
                    summaryContainer.appendChild(descP);
                }
            }

            if (window.activeFeatureLayer) {
                if (activeUniqueValues.length > 0 && window.activeFeatureLayer.renderer && window.activeFeatureLayer.renderer.type === "unique-value") {
                    const newRenderer = window.activeFeatureLayer.renderer.clone();
                    newRenderer.field = "subdet";
                    newRenderer.uniqueValueInfos = activeUniqueValues;
                    window.activeFeatureLayer.renderer = newRenderer;
                }
                if (typeof actualizarLeyenda === 'function') actualizarLeyenda(activeUniqueValues.map(v => v.label), activeUniqueValues.map(v => (v.symbol.color && v.symbol.color.toHex) ? v.symbol.color.toHex() : v.symbol.color));

                const filterWhere = "mpcodigo = '" + mpcodigo + "' AND tdeterm = 13";
                window.activeFeatureLayer.definitionExpression = filterWhere;
                window.activeFeatureLayer.queryExtent({ where: filterWhere }).then(function (res) {
                    if (res.extent) window.view.goTo(res.extent.expand(1.2));
                }).catch(function (e) { console.warn("Error zoom Infraestructura Punto:", e); });
            }

            const ctx = chartCanvas.getContext("2d");
            if (window.determinantesChartInstance) {
                window.determinantesChartInstance.destroy();
                window.determinantesChartInstance = null;
            }

            window.determinantesChartInstance = new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: labels,
                    datasets: [{
                        data: values,
                        backgroundColor: bgColors,
                        borderWidth: 1
                    }]
                },
                options: {
                    onClick: (e, elements) => {
                        if (!window.activeFeatureLayer) return;
                        if (!elements || elements.length === 0) {
                            const filterWhere = "mpcodigo = '" + mpcodigo + "' AND tdeterm = 13";
                            window.activeFeatureLayer.definitionExpression = filterWhere;
                            window.activeFeatureLayer.queryExtent({ where: filterWhere }).then(function (res) {
                                if (res.extent) window.view.goTo(res.extent.expand(1.2));
                            });
                            return;
                        }
                        const index = elements[0].index;
                        const selectedSubdet = results[index].subdet;
                        const filterWhere = "mpcodigo = '" + mpcodigo + "' AND tdeterm = 13 AND subdet = " + selectedSubdet;
                        window.activeFeatureLayer.definitionExpression = filterWhere;
                        window.activeFeatureLayer.queryExtent({ where: filterWhere }).then(function (res) {
                            if (res.extent) window.view.goTo(res.extent.expand(1.2));
                        });
                    },
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: true,
                            position: 'right',
                            labels: { font: { size: 11 } }
                        },
                        tooltip: {
                            callbacks: { label: (context) => context.label + ': ' + context.raw + ' sitios' }
                        },
                        datalabels: {
                            color: '#fff',
                            font: { size: 11, weight: 'bold' },
                            formatter: (val) => val
                        }
                    }
                }
            });

        } catch (e) {
            console.error("cargarDeterminantesPuntoInfraestructura error:", e);
            if (summaryContainer) summaryContainer.innerHTML = '<p style="color:red; text-align:center;">Error cargando datos de Infraestructura Punto.</p>';
        }
    }

    async function cargarDeterminantesTextos(mpcodigo, summarySelector) {
        const summaryContainer = document.querySelector(summarySelector);
        const chartTitle = document.getElementById("chartTitle");
        if (summaryContainer) summaryContainer.innerHTML = '<p class="det-loading">Cargando textos descriptivos...</p>';

        // Limpiar leyenda del tab anterior
        if (typeof actualizarLeyenda === 'function') actualizarLeyenda([], []);

        try {
            const cfg = getActiveLayerConfig();
            const urlDTS = cfg.url || `${CL_BASE}/19`;

            // Limpiar filtro en la capa activa para que se vea todo el municipio si veníamos de una gráfica filtrada
            if (window.activeFeatureLayer && typeof currentMode !== "undefined") {
                let baseWhere = `mpcodigo = '${mpcodigo}'`;
                if (currentMode === "DETERMINANTES") {
                    baseWhere += ` AND confactadm = 1`;
                }
                window.activeFeatureLayer.definitionExpression = baseWhere;
                window.activeFeatureLayer.queryExtent({ where: baseWhere }).then(function (res) {
                    if (res.extent) window.view.goTo(res.extent.expand(1.2));
                }).catch(() => { });
            }

            let idField = "iddts";
            let whereClause = `mpcodigo = '${mpcodigo}' AND confactadm = 1 AND determ <> 4`;
            if (typeof currentMode !== "undefined") {
                if (currentMode === "DETERMINANTES_LINEA") {
                    idField = "iddpl";
                    whereClause = `mpcodigo = '${mpcodigo}'`;
                } else if (currentMode === "DETERMINANTES_PUNTO") {
                    idField = "iddpp";
                    whereClause = `mpcodigo = '${mpcodigo}'`;
                }
            }

            // Obtener nombres de municipio y departamento
            let mpNombre = "Municipio";
            let dpNombre = "Departamento";
            if (typeof municipioInfo !== 'undefined' && municipioInfo && municipioInfo.mpnombre) {
                mpNombre = municipioInfo.mpnombre || municipioInfo.nombre_mpio || mpcodigo;
                dpNombre = municipioInfo.dpnombre || municipioInfo.nombre_dpto || "";
            } else {
                try {
                    const nmRes = await fetch(`${urlDTS}/query?where=mpcodigo='${mpcodigo}'&outFields=mpnombre,dpnombre&returnGeometry=false&resultRecordCount=1&f=json`).then(r => r.json());
                    if (nmRes.features && nmRes.features.length > 0) {
                        mpNombre = nmRes.features[0].attributes.mpnombre || "Municipio";
                        dpNombre = nmRes.features[0].attributes.dpnombre || "Departamento";
                    }
                } catch (e) { }
            }

            if (chartTitle) {
                chartTitle.textContent = `Textos Normativos y Análisis de ${mpNombre}, ${dpNombre}`;
            }

            const qUrl = `${urlDTS}/query`;
            const params = new URLSearchParams({
                where: whereClause,
                outFields: `${idField},nomdet,determ`,
                returnDistinctValues: "true",
                returnGeometry: "false",
                f: "json"
            });

            const resp = await fetch(`${qUrl}?${params.toString()}`);
            if (!resp.ok) throw new Error("Error en red al consultar capa geográfica");
            const data = await resp.json();

            if (!data.features || data.features.length === 0) {
                if (summaryContainer) summaryContainer.innerHTML = '<p style="margin:0;color:#666;text-align:center;">No hay textos normativos o figuras asociadas para este municipio en esta capa.</p>';
                return;
            }

            const figurasMap = {};
            const determMap = {};
            data.features.forEach(f => {
                const id = f.attributes[idField];
                const nom = f.attributes.nomdet;
                const det = f.attributes.determ;
                if (id) {
                    if (!figurasMap[id]) figurasMap[id] = nom || "Figura sin nombre";
                    determMap[id] = det;
                }
            });

            const uniqueIds = Object.keys(figurasMap);
            if (uniqueIds.length === 0) {
                if (summaryContainer) summaryContainer.innerHTML = '<p style="margin:0;color:#666;text-align:center;">Las figuras encontradas no tienen un identificador válido para consultar textos.</p>';
                return;
            }

            // 2. Consultar la tabla 25 (CL_ADS) usando los Iddts
            // Dividimos en lotes por si hay muchos IDs
            const chunkSize = 100;
            let textosEncontrados = {};

            for (let i = 0; i < uniqueIds.length; i += chunkSize) {
                const chunk = uniqueIds.slice(i, i + chunkSize);
                const idsStr = chunk.map(id => `'${id}'`).join(',');

                const qUrlTabla = `${CL_BASE}/25/query`;
                const paramsTabla = new URLSearchParams({
                    where: `${idField} IN (${idsStr})`,
                    outFields: `${idField},tcldnorm,tclanalisis`,
                    f: "json"
                });

                const respT = await fetch(`${qUrlTabla}?${paramsTabla.toString()}`);
                if (respT.ok) {
                    const dataT = await respT.json();
                    if (dataT.features) {
                        dataT.features.forEach(f => {
                            const id = f.attributes[idField];
                            textosEncontrados[id] = {
                                normativa: f.attributes.tcldnorm,
                                analisis: f.attributes.tclanalisis
                            };
                        });
                    }
                }
            }

            // 3. Renderizar Acordeón
            let html = '<div class="det-accordion">';

            // Opcional: Agrupar por "determ" (Ambientales, Patrimoniales, etc) para que se vea ordenado
            const categorias = {
                1: "Ambientales",
                2: "Soberanía Alimentaria",
                3: "Patrimoniales",
                4: "Infraestructura",
                5: "Áreas Metropolitanas y Suburbanización",
                6: "Proyectos Turísticos Especiales"
            };

            // Agrupar IDs
            const grupos = {};
            uniqueIds.forEach(id => {
                const det = determMap[id];
                if (!grupos[det]) grupos[det] = [];
                grupos[det].push(id);
            });

            // Construir HTML por grupo
            Object.keys(grupos).sort((a, b) => a - b).forEach(det => {
                const catName = categorias[det] || `Determinante Tipo ${det}`;
                html += `<div class="det-group-title">${catName}</div>`;

                grupos[det].sort((a, b) => figurasMap[a].localeCompare(figurasMap[b])).forEach(id => {
                    const nom = figurasMap[id];
                    const textos = textosEncontrados[id] || {};
                    let norm = textos.normativa ? textos.normativa.trim() : "";
                    let anal = textos.analisis ? textos.analisis.trim() : "";

                    if (!norm && !anal) {
                        norm = "No se encontró descripción normativa en la base de datos para este elemento.";
                    }

                    html += `
                            <div class="det-item">
                                <div class="det-item-header" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'block' ? 'none' : 'block'; this.querySelector('.det-arrow').style.transform = this.nextElementSibling.style.display === 'block' ? 'rotate(90deg)' : 'rotate(0deg)';">
                                    <span class="det-arrow">▶</span>
                                    <span class="det-name">${nom}</span>
                                </div>
                                <div class="det-item-body" style="display: none;">
                            `;

                    if (norm) {
                        html += `<div class="det-section"><strong>Descripción Normativa</strong><p>${norm}</p></div>`;
                    }
                    if (anal) {
                        html += `<div class="det-section"><strong>Análisis Temático</strong><p>${anal}</p></div>`;
                    }

                    html += `
                                </div>
                            </div>
                            `;
                });
            });

            html += '</div>';

            if (summaryContainer) {
                summaryContainer.innerHTML = html;
            }

        } catch (error) {
            console.error("Error en cargarDeterminantesTextos:", error);
            if (summaryContainer) summaryContainer.innerHTML = '<p style="color:red; text-align:center;">Ocurrió un error cargando los textos descriptivos.</p>';
        }
    }

    async function cargarCondicionantes(mpcodigo, summarySelector) {
        const summaryContainer = document.querySelector(summarySelector);
        if (!summaryContainer) return;

        if (!mpcodigo) {
            summaryContainer.innerHTML = "Seleccione un municipio para ver los condicionantes.";
            return;
        }

        summaryContainer.innerHTML = '<p style="text-align:center; color:#666;">Cargando textos descriptivos...</p>';

        try {
            const url = `${CL_BASE}/24`;

            const qUrl = `${url}/query`;
            const params = new URLSearchParams({
                where: `mpcodigo = '${mpcodigo}' AND confactadm = 1`,
                outFields: "idcts,nomcon,tcondi",
                returnDistinctValues: "true",
                returnGeometry: "false",
                f: "json"
            });

            const resp = await fetch(`${qUrl}?${params.toString()}`);
            if (!resp.ok) throw new Error("Error en red al consultar capa de condicionantes");
            const data = await resp.json();

            if (!data.features || data.features.length === 0) {
                summaryContainer.innerHTML = '<p style="margin:0;color:#666;text-align:center;">No hay figuras condicionantes registradas o aprobadas para este municipio.</p>';
                return;
            }

            const figurasMap = {};
            const tcondiMap = {};
            data.features.forEach(f => {
                const id = f.attributes.idcts;
                const nom = f.attributes.nomcon;
                const det = f.attributes.tcondi;
                if (id) {
                    if (!figurasMap[id]) figurasMap[id] = nom || "Figura sin nombre";
                    tcondiMap[id] = det;
                }
            });

            const uniqueIds = Object.keys(figurasMap);
            if (uniqueIds.length === 0) {
                summaryContainer.innerHTML = '<p style="margin:0;color:#666;text-align:center;">Las figuras encontradas no tienen un identificador válido para consultar textos.</p>';
                return;
            }

            const chunkSize = 100;
            let textosEncontrados = {};

            for (let i = 0; i < uniqueIds.length; i += chunkSize) {
                const chunk = uniqueIds.slice(i, i + chunkSize);
                const idsStr = chunk.map(id => `'${id}'`).join(',');

                const qUrlTabla = `${CL_BASE}/26/query`;
                const paramsTabla = new URLSearchParams({
                    where: `idcts IN (${idsStr})`,
                    outFields: "idcts,tcldnorm,tclanalisis",
                    f: "json"
                });

                const respT = await fetch(`${qUrlTabla}?${paramsTabla.toString()}`);
                if (respT.ok) {
                    const dataT = await respT.json();
                    if (dataT.features) {
                        dataT.features.forEach(f => {
                            const id = f.attributes.idcts;
                            textosEncontrados[id] = {
                                normativa: f.attributes.tcldnorm,
                                analisis: f.attributes.tclanalisis
                            };
                        });
                    }
                }
            }

            const grupos = {};
            uniqueIds.forEach(id => {
                const det = tcondiMap[id] || 0;
                if (!grupos[det]) grupos[det] = [];
                grupos[det].push(id);
            });

            let html = '<div class="det-accordion">';

            const categorias = {
                1: "Territorios Colectivos",
                2: "Exploración y Explotación de Recursos No Renovables",
                3: "Acuerdo Final de Paz",
                4: "Planes de Ordenamiento Social de la Propiedad Rural (POSPR)",
                5: "Zonas más Afectadas por el Conflicto Armado (ZOMAC)",
                6: "Línea Negra"
            };

            Object.keys(grupos).sort((a, b) => a - b).forEach(det => {
                const catName = categorias[det] || `Condicionante Tipo ${det}`;
                html += `<div class="det-group-title">${catName}</div>`;

                grupos[det].sort((a, b) => figurasMap[a].localeCompare(figurasMap[b])).forEach(id => {
                    const nom = figurasMap[id];
                    const textos = textosEncontrados[id] || {};
                    let norm = textos.normativa ? textos.normativa.trim() : "";
                    let anal = textos.analisis ? textos.analisis.trim() : "";

                    if (!norm && !anal) {
                        norm = "No se encontró descripción normativa en la base de datos para este elemento.";
                    }

                    html += `
                            <div class="det-item">
                                <div class="det-item-header" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'block' ? 'none' : 'block'; this.querySelector('.det-arrow').style.transform = this.nextElementSibling.style.display === 'block' ? 'rotate(90deg)' : 'rotate(0deg)';">
                                    <span class="det-arrow">▶</span>
                                    <span class="det-name">${nom}</span>
                                </div>
                                <div class="det-item-body" style="display: none;">
                            `;

                    if (norm) {
                        html += `<div class="det-section"><strong>Descripción Normativa</strong><p>${norm}</p></div>`;
                    }

                    // Omitir análisis temático para 1, 2, 4, 5 y si mencionaron 3_POSPR lo omitimos si el nombre contiene POSPR o si es 3
                    const omitirAnalisis = [1, 2, 4, 5].includes(Number(det)) || catName.includes("POSPR");
                    if (anal && !omitirAnalisis) {
                        html += `<div class="det-section"><strong>Análisis Temático</strong><p>${anal}</p></div>`;
                    }

                    html += `
                                </div>
                            </div>
                            `;
                });
            });

            html += '</div>';

            if (summaryContainer) {
                summaryContainer.innerHTML = html;
            }

            // ====== ACTUALIZAR LEYENDA ======
            if (typeof actualizarLeyenda === 'function') {
                const activeLegendLabels = [];
                const activeLegendColors = [];
                const catColors = {
                    1: "#FFC000",
                    2: "#B58B5D",
                    3: "#EAEAEA",
                    4: "#92D050",
                    5: "#C55A11"
                };
                const catNames = {
                    1: "Territorios Colectivos",
                    2: "Exploración y Explotación de Recursos No Renovables (ERNR)",
                    3: "Acuerdo de Paz",
                    4: "Planes de Ordenamiento Sobre la Propiedad Rural (POSPR)",
                    5: "Zonas más Afectadas por el Conflicto Armado (ZOMAC)"
                };

                Object.keys(grupos).sort((a, b) => a - b).forEach(det => {
                    const detNum = Number(det);
                    if (catNames[detNum]) {
                        activeLegendLabels.push(catNames[detNum]);
                        activeLegendColors.push(catColors[detNum]);
                    }
                });

                if (activeLegendLabels.length > 0) {
                    actualizarLeyenda(activeLegendLabels, activeLegendColors);
                } else {
                    actualizarLeyenda(["Sin datos de Condicionantes"], ["#cccccc"]);
                }
            }

        } catch (error) {
            console.error("Error en cargarCondicionantes:", error);
            if (summaryContainer) summaryContainer.innerHTML = '<p style="color:red; text-align:center;">Ocurrió un error cargando los textos descriptivos.</p>';
        }
    }
    window.cargarCondicionantes = cargarCondicionantes;

    async function cargarCondicionantesGrafico(mpcodigo, chartSelector) {
        const chartCanvas = document.querySelector(chartSelector);
        if (!chartCanvas) return;

        const ctx = chartCanvas.getContext('2d');
        let existingChart = Chart.getChart(chartCanvas);
        if (existingChart) existingChart.destroy();
        if (window.determinantesChartInstance) {
            window.determinantesChartInstance.destroy();
        }

        try {
            const qUrl = `${CL_BASE}/24/query`;
            const params = new URLSearchParams({
                where: `mpcodigo = '${mpcodigo}' AND confactadm = 1`,
                outFields: "tcondi,descrip",
                returnGeometry: "false",
                f: "json"
            });

            const resp = await fetch(`${qUrl}?${params.toString()}`);
            if (!resp.ok) throw new Error("Error consultando condicionantes para gráficos");
            const data = await resp.json();

            const countMap = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
            let descripText = "";
            if (data.features) {
                data.features.forEach(f => {
                    const tcondi = f.attributes.tcondi;
                    if (countMap.hasOwnProperty(tcondi)) {
                        countMap[tcondi]++;
                    }
                    if (!descripText && f.attributes.descrip) {
                        descripText = f.attributes.descrip;
                    }
                });
            }

            const chartLabels = [
                "Territorios Colectivos",
                "Exploración y Explotación de Recursos No Renovables (ERNR)",
                "Acuerdo de Paz",
                "Planes de Ordenamiento Sobre la Propiedad Rural (POSPR)",
                "Zonas más Afectadas por el Conflicto Armado (ZOMAC)"
            ];

            const bgColors = [
                "#FFC000",
                "#B58B5D",
                "#EAEAEA",
                "#92D050",
                "#C55A11"
            ];

            const dataCounts = [
                countMap[1],
                countMap[2],
                countMap[3],
                countMap[4],
                countMap[5]
            ];

            window.determinantesChartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: chartLabels,
                    datasets: [{
                        data: dataCounts,
                        backgroundColor: bgColors,
                        borderWidth: 1
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
                                    return `Cantidad: ${context.raw}`;
                                }
                            }
                        },
                        datalabels: {
                            anchor: 'end',
                            align: 'end',
                            color: '#000',
                            font: { weight: 'bold' }
                        }
                    },
                    scales: {
                        x: {
                            title: { display: true, text: 'Tipo de Condicionante', font: { weight: 'bold' } },
                            ticks: {
                                autoSkip: false,
                                callback: function (value) {
                                    const text = chartLabels[value] || "";
                                    return text.length > 25 ? text.match(/.{1,75}(\s|$)/g) : text;
                                }
                            }
                        },
                        y: {
                            beginAtZero: true,
                            title: { display: true, text: 'Cantidad', font: { weight: 'bold' } },
                            ticks: {
                                stepSize: 1,
                                precision: 0
                            }
                        }
                    },
                    onClick: function (evt, elements) {
                        const layer = window.activeFeatureLayer;
                        if (!layer) return;

                        if (elements.length > 0) {
                            const index = elements[0].index;
                            const tcondiNum = index + 1; // index 0 is tcondi 1, index 4 is tcondi 5
                            const filterWhere = `mpcodigo = '${mpcodigo}' AND tcondi = ${tcondiNum} AND confactadm = 1`;
                            layer.definitionExpression = filterWhere;
                            layer.queryExtent({ where: filterWhere }).then(function (res) {
                                if (res.extent) window.view.goTo(res.extent.expand(1.2));
                            });
                        } else {
                            // Reset filter when clicking outside bars
                            const filterWhere = `mpcodigo = '${mpcodigo}' AND confactadm = 1`;
                            layer.definitionExpression = filterWhere;
                            layer.queryExtent({ where: filterWhere }).then(function (res) {
                                if (res.extent) window.view.goTo(res.extent.expand(1.2));
                            });
                        }
                    }
                }
            });

            // Add dynamic description
            const container = document.querySelector(chartSelector === "#chart" ? "#summaryDiv" : chartSelector);
            if (container) {
                container.innerHTML = `
                            <p style="margin:0;color:#444;">
                                <strong>Gráficos de Condicionantes</strong><br>
                                ${descripText || "Sin descripción disponible."}
                            </p>
                        `;
            }

            // Update the legend!
            if (typeof actualizarLeyenda === 'function') {
                // Extract only labels that have > 0 count for the legend
                const activeLegendLabels = [];
                const activeLegendColors = [];
                for (let i = 0; i < 5; i++) {
                    if (dataCounts[i] > 0) {
                        activeLegendLabels.push(chartLabels[i]);
                        activeLegendColors.push(bgColors[i]);
                    }
                }
                if (activeLegendLabels.length > 0) {
                    actualizarLeyenda(activeLegendLabels, activeLegendColors);
                } else {
                    actualizarLeyenda(["Sin datos de Condicionantes"], ["#cccccc"]);
                }
            }

        } catch (error) {
            console.error("Error en cargarCondicionantesGrafico:", error);
        }
    }
    window.cargarCondicionantesGrafico = cargarCondicionantesGrafico;

    async function cargarCondicionantesTerritoriosColectivos(mpcodigo, chartSelector) {
        const chartCanvas = document.querySelector(chartSelector);
        if (!chartCanvas) return;

        const ctx = chartCanvas.getContext('2d');
        let existingChart = Chart.getChart(chartCanvas);
        if (existingChart) existingChart.destroy();
        if (window.determinantesChartInstance) {
            window.determinantesChartInstance.destroy();
        }

        try {
            const qUrl = `${CL_BASE}/24/query`;
            const params = new URLSearchParams({
                where: `mpcodigo = '${mpcodigo}' AND confactadm = 1 AND tcondi = 1`,
                outFields: "subcon,porcentaje,descrip",
                returnGeometry: "false",
                f: "json"
            });

            const resp = await fetch(`${qUrl}?${params.toString()}`);
            if (!resp.ok) throw new Error("Error consultando territorios colectivos");
            const data = await resp.json();

            if (!data.features || data.features.length === 0) {
                const container = document.querySelector(chartSelector === "#chart" ? "#summaryDiv" : chartSelector);
                if (container) {
                    container.innerHTML = '<p style="margin:0;color:#666;text-align:center;">No hay datos de territorios colectivos para el municipio seleccionado.</p>';
                }
                if (typeof actualizarLeyenda === 'function') {
                    actualizarLeyenda(["Sin datos de Territorios Colectivos"], ["#cccccc"]);
                }
                return;
            }

            // Extraer descripción y agrupar manualmente
            const groupMap = {};
            let descripText = "";
            data.features.forEach(f => {
                const subcon = f.attributes.subcon;
                const pct = f.attributes.porcentaje || 0;
                if (!groupMap[subcon]) groupMap[subcon] = 0;
                groupMap[subcon] += pct;

                if (!descripText && f.attributes.descrip) {
                    descripText = f.attributes.descrip;
                }
            });

            // Definir nombres de subtipos según los requerimientos y la imagen
            const domainMap = {
                101: "Consejos comunitarios de las comunidades negras",
                102: "Resguardos indígenas",
                1: "Consejos comunitarios de las comunidades negras",
                2: "Resguardos indígenas",
                3: "Zonas de Reserva Campesina",
                4: "Territorios ROM"
            };

            const labelColorMap = {
                "Consejos comunitarios de las comunidades negras": "#005B82",
                "Resguardos indígenas": "#E1612A"
            };

            const bgColorsBase = [
                "#005B82", "#E1612A", "#92D050", "#C55A11", "#1f77b4", "#ff7f0e"
            ];

            const chartLabels = [];
            const dataValues = [];
            const bgColors = [];
            const subconIds = [];

            Object.keys(groupMap).forEach((k, idx) => {
                const subcon = parseInt(k);
                let val = groupMap[k] || 0;
                val = parseFloat(val.toFixed(2));

                let labelName = domainMap[subcon] || `Subtipo ${subcon}`;

                chartLabels.push(labelName);
                dataValues.push(val);
                subconIds.push(subcon);
                bgColors.push(labelColorMap[labelName] || bgColorsBase[idx % bgColorsBase.length]);
            });

            let mpNombre = "Municipio";
            let dpNombre = "Departamento";
            if (typeof municipioInfo !== 'undefined' && municipioInfo && municipioInfo.mpnombre) {
                mpNombre = municipioInfo.mpnombre || municipioInfo.nombre_mpio || mpcodigo;
                dpNombre = municipioInfo.dpnombre || municipioInfo.nombre_dpto || "";
            } else {
                try {
                    const nmRes = await fetch(`${CL_BASE}/24/query?where=mpcodigo='${mpcodigo}'&outFields=mpnombre,dpnombre&returnGeometry=false&resultRecordCount=1&f=json`).then(r => r.json());
                    if (nmRes.features && nmRes.features.length > 0) {
                        mpNombre = nmRes.features[0].attributes.mpnombre || "Municipio";
                        dpNombre = nmRes.features[0].attributes.dpnombre || "Departamento";
                    }
                } catch (e) { }
            }

            window.determinantesChartInstance = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: chartLabels,
                    datasets: [{
                        data: dataValues,
                        backgroundColor: bgColors,
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    onClick: function (evt, elements) {
                        const layer = window.activeFeatureLayer;
                        if (!layer) return;

                        if (elements.length > 0) {
                            const index = elements[0].index;
                            const selectedSubcon = subconIds[index];
                            const filterWhere = `mpcodigo = '${mpcodigo}' AND tcondi = 1 AND subcon = ${selectedSubcon} AND confactadm = 1`;
                            layer.definitionExpression = filterWhere;
                            layer.queryExtent({ where: filterWhere }).then(function (res) {
                                if (res.extent) window.view.goTo(res.extent.expand(1.2));
                            });
                        } else {
                            const filterWhere = `mpcodigo = '${mpcodigo}' AND confactadm = 1`;
                            layer.definitionExpression = filterWhere;
                            layer.queryExtent({ where: filterWhere }).then(function (res) {
                                if (res.extent) window.view.goTo(res.extent.expand(1.2));
                            });
                        }
                    },
                    plugins: {
                        title: {
                            display: false,
                            text: `Distribución de los Condicionantes del ${mpNombre}, ${dpNombre}`,
                            font: { size: 14, weight: 'bold' }
                        },
                        legend: {
                            display: true,
                            position: 'bottom'
                        },
                        tooltip: {
                            callbacks: {
                                label: function (context) {
                                    return `${context.label}: ${context.raw}%`;
                                }
                            }
                        },
                        datalabels: {
                            anchor: 'center',
                            align: 'center',
                            color: '#fff',
                            font: { weight: 'bold' },
                            formatter: function (value, context) {
                                return value + "%";
                            }
                        }
                    }
                }
            });

            // Actualizar el título externo h3
            const ct = document.getElementById("chartTitle");
            if (ct) ct.textContent = `Distribución de los Condicionantes del ${mpNombre}, ${dpNombre}, tipo Territorios colectivos`;

            // Add dynamic description
            const container = document.querySelector(chartSelector === "#chart" ? "#summaryDiv" : chartSelector);
            if (container) {
                container.innerHTML = `
                            <p style="margin:0;color:#444;">
                                <strong>Territorios Colectivos</strong><br>
                                ${descripText || "Proporción de las áreas de territorios colectivos en el municipio."}
                            </p>
                        `;
            }

            // Update the legend!
            if (typeof actualizarLeyenda === 'function') {
                if (chartLabels.length > 0) {
                    actualizarLeyenda(chartLabels, bgColors);
                } else {
                    actualizarLeyenda(["Sin datos"], ["#cccccc"]);
                }
            }

        } catch (error) {
            console.error("Error en cargarCondicionantesTerritoriosColectivos:", error);
        }
    }
    window.cargarCondicionantesTerritoriosColectivos = cargarCondicionantesTerritoriosColectivos;

    async function cargarCondicionantesAcuerdoPaz(mpcodigo, chartSelector) {
        const chartCanvas = document.querySelector(chartSelector);
        if (!chartCanvas) return;

        const ctx = chartCanvas.getContext('2d');
        let existingChart = Chart.getChart(chartCanvas);
        if (existingChart) existingChart.destroy();
        if (window.determinantesChartInstance) {
            window.determinantesChartInstance.destroy();
        }

        try {
            const qUrl = `${CL_BASE}/24/query`;
            const params = new URLSearchParams({
                where: `mpcodigo = '${mpcodigo}' AND confactadm = 1 AND tcondi = 3`,
                outFields: "subcon,porcentaje,descrip",
                returnGeometry: "false",
                f: "json"
            });

            const resp = await fetch(`${qUrl}?${params.toString()}`);
            if (!resp.ok) throw new Error("Error consultando Acuerdo Final de Paz");
            const data = await resp.json();

            if (!data.features || data.features.length === 0) {
                const container = document.querySelector(chartSelector === "#chart" ? "#summaryDiv" : chartSelector);
                if (container) {
                    container.innerHTML = '<p style="margin:0;color:#666;text-align:center;">No hay datos de Acuerdo Final de Paz para el municipio seleccionado.</p>';
                }
                if (typeof actualizarLeyenda === 'function') {
                    actualizarLeyenda(["Sin datos de Acuerdo de Paz"], ["#cccccc"]);
                }
                return;
            }

            const groupMap = {};
            let descripText = "";
            data.features.forEach(f => {
                const subcon = f.attributes.subcon;
                const pct = f.attributes.porcentaje || 0;
                if (!groupMap[subcon]) groupMap[subcon] = 0;
                groupMap[subcon] += pct;

                if (!descripText && f.attributes.descrip) {
                    descripText = f.attributes.descrip;
                }
            });


            const domainMap = {
                301: "Preservación",
                302: "Restauración",
                303: "Uso sostenible para el aprovechamiento de la biodiversidad",
                304: "Uso sostenible para el desarrollo",
                305: "Protección por alta oferta de servicios ecosistémicos",
                306: "Protección con uso sostenible",
                307: "Uso productivo con protección",
                308: "Uso productivo con reconversión",
                309: "Uso productivo"
            };

            const labelColorMap = {
                // Ej: "Subtipo 301": "#hexcolor"
            };

            const bgColorsBase = [
                "#005B82", "#E1612A", "#92D050", "#C55A11", "#1f77b4", "#ff7f0e",
                "#2ca02c", "#d62728", "#9467bd", "#8c564b"
            ];

            const chartLabels = [];
            const dataValues = [];
            const bgColors = [];
            const subconIds = [];

            Object.keys(groupMap).forEach((k, idx) => {
                const subcon = parseInt(k);
                let val = groupMap[k] || 0;
                val = parseFloat(val.toFixed(2));

                let labelName = domainMap[subcon] || `Subtipo ${subcon}`;

                chartLabels.push(labelName);
                dataValues.push(val);
                subconIds.push(subcon);
                bgColors.push(labelColorMap[labelName] || bgColorsBase[idx % bgColorsBase.length]);
            });

            let mpNombre = "Municipio";
            let dpNombre = "Departamento";
            if (typeof municipioInfo !== 'undefined' && municipioInfo && municipioInfo.mpnombre) {
                mpNombre = municipioInfo.mpnombre || municipioInfo.nombre_mpio || mpcodigo;
                dpNombre = municipioInfo.dpnombre || municipioInfo.nombre_dpto || "";
            } else {
                try {
                    const nmRes = await fetch(`${CL_BASE}/24/query?where=mpcodigo='${mpcodigo}'&outFields=mpnombre,dpnombre&returnGeometry=false&resultRecordCount=1&f=json`).then(r => r.json());
                    if (nmRes.features && nmRes.features.length > 0) {
                        mpNombre = nmRes.features[0].attributes.mpnombre || "Municipio";
                        dpNombre = nmRes.features[0].attributes.dpnombre || "Departamento";
                    }
                } catch (e) { }
            }

            window.determinantesChartInstance = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: chartLabels,
                    datasets: [{
                        data: dataValues,
                        backgroundColor: bgColors,
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    onClick: function (evt, elements) {
                        const layer = window.activeFeatureLayer;
                        if (!layer) return;

                        if (elements.length > 0) {
                            const index = elements[0].index;
                            const selectedSubcon = subconIds[index];
                            const filterWhere = `mpcodigo = '${mpcodigo}' AND tcondi = 3 AND subcon = ${selectedSubcon} AND confactadm = 1`;
                            layer.definitionExpression = filterWhere;
                            layer.queryExtent({ where: filterWhere }).then(function (res) {
                                if (res.extent) window.view.goTo(res.extent.expand(1.2));
                            });
                        } else {
                            const filterWhere = `mpcodigo = '${mpcodigo}' AND confactadm = 1`;
                            layer.definitionExpression = filterWhere;
                            layer.queryExtent({ where: filterWhere }).then(function (res) {
                                if (res.extent) window.view.goTo(res.extent.expand(1.2));
                            });
                        }
                    },
                    plugins: {
                        title: {
                            display: false,
                            text: `Distribución de los Condicionantes del ${mpNombre}, ${dpNombre}, tipo Acuerdo Final de Paz`,
                            font: { size: 14, weight: 'bold' }
                        },
                        legend: {
                            display: true,
                            position: 'bottom'
                        },
                        tooltip: {
                            callbacks: {
                                label: function (context) {
                                    return `${context.label}: ${context.raw}%`;
                                }
                            }
                        },
                        datalabels: {
                            anchor: 'center',
                            align: 'center',
                            color: '#fff',
                            font: { weight: 'bold' },
                            formatter: function (value, context) {
                                return value + "%";
                            }
                        }
                    }
                }
            });

            // Actualizar el título externo h3
            const ct = document.getElementById("chartTitle");
            if (ct) ct.textContent = `Distribución de los Condicionantes del ${mpNombre}, ${dpNombre}, tipo Acuerdo Final de Paz`;

            // Add dynamic description
            const container = document.querySelector(chartSelector === "#chart" ? "#summaryDiv" : chartSelector);
            if (container) {
                container.innerHTML = `
                            <p style="margin:0;color:#444;">
                                <strong>Acuerdo Final de Paz</strong><br>
                                ${descripText || "Proporción de las áreas asociadas al Acuerdo Final de Paz en el municipio."}
                            </p>
                        `;
            }

            // Update the legend!
            if (typeof actualizarLeyenda === 'function') {
                if (chartLabels.length > 0) {
                    actualizarLeyenda(chartLabels, bgColors);
                } else {
                    actualizarLeyenda(["Sin datos"], ["#cccccc"]);
                }
            }

        } catch (error) {
            console.error("Error en cargarCondicionantesAcuerdoPaz:", error);
        }
    }
    window.cargarCondicionantesAcuerdoPaz = cargarCondicionantesAcuerdoPaz;

    async function cargarCondicionantesRecursos(mpcodigo, chartSelector) {
        const chartCanvas = document.querySelector(chartSelector);
        if (!chartCanvas) return;

        const ctx = chartCanvas.getContext('2d');
        let existingChart = Chart.getChart(chartCanvas);
        if (existingChart) existingChart.destroy();
        if (window.determinantesChartInstance) {
            window.determinantesChartInstance.destroy();
        }

        try {
            const qUrl = `${CL_BASE}/24/query`;
            const params = new URLSearchParams({
                where: `mpcodigo = '${mpcodigo}' AND confactadm = 1 AND tcondi = 2`,
                outFields: "subcon,porcentaje,descrip",
                returnGeometry: "false",
                f: "json"
            });

            const resp = await fetch(`${qUrl}?${params.toString()}`);
            if (!resp.ok) throw new Error("Error consultando Recursos No Renovables");
            const data = await resp.json();

            if (!data.features || data.features.length === 0) {
                const container = document.querySelector(chartSelector === "#chart" ? "#summaryDiv" : chartSelector);
                if (container) {
                    container.innerHTML = '<p style="margin:0;color:#666;text-align:center;">No hay datos de Recursos No Renovables para el municipio seleccionado.</p>';
                }
                if (typeof actualizarLeyenda === 'function') {
                    actualizarLeyenda(["Sin datos de Recursos No Renovables"], ["#cccccc"]);
                }
                return;
            }

            const groupMap = {};
            let descripText = "";
            data.features.forEach(f => {
                const subcon = f.attributes.subcon;
                const pct = f.attributes.porcentaje || 0;
                if (!groupMap[subcon]) groupMap[subcon] = { pct: 0, count: 0 };
                groupMap[subcon].pct += pct;
                groupMap[subcon].count += 1;

                if (!descripText && f.attributes.descrip) {
                    descripText = f.attributes.descrip;
                }
            });

            // Diccionario temporal para subtipos 2xx
            const domainMap = {
                201: "Títulos mineros activos",
                202: "Bloques de explotación y exploración petrolera"
            };

            const bgColorsBase = [
                "#005B82", "#E1612A", "#92D050", "#C55A11", "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728"
            ];

            const chartLabels = [];
            const dataValues = [];
            const bgColors = [];
            const subconIds = [];

            Object.keys(groupMap).forEach((k, idx) => {
                const subcon = parseInt(k);
                let val = groupMap[k].pct || 0;
                val = parseFloat(val.toFixed(2));
                let count = groupMap[k].count;

                let labelName = domainMap[subcon] || `Subtipo ${subcon}`;
                // "El número por subtipos debe aparecer en el gráfico"
                let labelWithCount = `${labelName} (${count})`;

                chartLabels.push(labelWithCount);
                dataValues.push(val);
                subconIds.push(subcon);
                bgColors.push(bgColorsBase[idx % bgColorsBase.length]);
            });

            let mpNombre = "Municipio";
            let dpNombre = "Departamento";
            if (typeof municipioInfo !== 'undefined' && municipioInfo && municipioInfo.mpnombre) {
                mpNombre = municipioInfo.mpnombre || municipioInfo.nombre_mpio || mpcodigo;
                dpNombre = municipioInfo.dpnombre || municipioInfo.nombre_dpto || "";
            } else {
                try {
                    const nmRes = await fetch(`${CL_BASE}/24/query?where=mpcodigo='${mpcodigo}'&outFields=mpnombre,dpnombre&returnGeometry=false&resultRecordCount=1&f=json`).then(r => r.json());
                    if (nmRes.features && nmRes.features.length > 0) {
                        mpNombre = nmRes.features[0].attributes.mpnombre || "Municipio";
                        dpNombre = nmRes.features[0].attributes.dpnombre || "Departamento";
                    }
                } catch (e) { }
            }

            window.determinantesChartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: chartLabels,
                    datasets: [{
                        data: dataValues,
                        backgroundColor: bgColors,
                        borderWidth: 1
                    }]
                },
                options: {
                    indexAxis: 'y', // Gráfico de barras horizontales
                    responsive: true,
                    maintainAspectRatio: false,
                    onClick: function (evt, elements) {
                        const layer = window.activeFeatureLayer;
                        if (!layer) return;

                        if (elements.length > 0) {
                            const index = elements[0].index;
                            const selectedSubcon = subconIds[index];
                            const filterWhere = `mpcodigo = '${mpcodigo}' AND tcondi = 2 AND subcon = ${selectedSubcon} AND confactadm = 1`;
                            layer.definitionExpression = filterWhere;
                            layer.queryExtent({ where: filterWhere }).then(function (res) {
                                if (res.extent) window.view.goTo(res.extent.expand(1.2));
                            });
                        } else {
                            const filterWhere = `mpcodigo = '${mpcodigo}' AND confactadm = 1`;
                            layer.definitionExpression = filterWhere;
                            layer.queryExtent({ where: filterWhere }).then(function (res) {
                                if (res.extent) window.view.goTo(res.extent.expand(1.2));
                            });
                        }
                    },
                    scales: {
                        x: {
                            title: {
                                display: true,
                                text: "Porcentaje (%)"
                            }
                        },
                        y: {
                            title: {
                                display: true,
                                text: "Tipo de Explotación"
                            }
                        }
                    },
                    plugins: {
                        title: {
                            display: false
                        },
                        legend: {
                            display: false // Usualmente las barras horizontales no necesitan leyenda si los labels están en el eje Y, pero si la piden se puede activar
                        },
                        tooltip: {
                            callbacks: {
                                label: function (context) {
                                    return `Porcentaje: ${context.raw}%`;
                                }
                            }
                        },
                        datalabels: {
                            anchor: 'end',
                            align: 'end',
                            color: '#000',
                            font: { weight: 'bold' },
                            formatter: function (value, context) {
                                return value + "%";
                            }
                        }
                    }
                }
            });

            // Actualizar el título externo h3
            const ct = document.getElementById("chartTitle");
            if (ct) ct.textContent = `Distribución de los Condicionantes del ${mpNombre}, ${dpNombre}, tipo Explotación de recursos no renovables`;

            // Add dynamic description
            const container = document.querySelector(chartSelector === "#chart" ? "#summaryDiv" : chartSelector);
            if (container) {
                container.innerHTML = `
                            <p style="margin:0;color:#444;">
                                <strong>Explotación de recursos no renovables</strong><br>
                                ${descripText || "Proporción de las áreas asociadas a la Explotación de recursos no renovables en el municipio."}
                            </p>
                        `;
            }

            // Update the legend!
            if (typeof actualizarLeyenda === 'function') {
                if (chartLabels.length > 0) {
                    actualizarLeyenda(chartLabels, bgColors);
                } else {
                    actualizarLeyenda(["Sin datos"], ["#cccccc"]);
                }
            }

        } catch (error) {
            console.error("Error en cargarCondicionantesRecursos:", error);
        }
    }
    window.cargarCondicionantesRecursos = cargarCondicionantesRecursos;



    async function cargarDeterminantesControlCapas(mpcodigo, summarySelector) {
        const summaryContainer = document.querySelector(summarySelector);
        if (!summaryContainer) return;

        if (!mpcodigo) {
            if (window.determinantesChartInstance) window.determinantesChartInstance.destroy();
            summaryContainer.innerHTML = '<p style="margin:0;color:#666;font-style:italic;">Seleccione un municipio</p>';
            return;
        }

        if (window.determinantesChartInstance) window.determinantesChartInstance.destroy();
        summaryContainer.innerHTML = '<div style="text-align:center;padding:10px;">Consultando capas disponibles...</div>';

        try {
            const cfg = getActiveLayerConfig();
            const url = cfg.url || `${CL_BASE}/19`;

            const qUrl = `${url}/query`;
            const params = new URLSearchParams({
                where: `mpcodigo = '${mpcodigo}' AND tdeterm IN (4, 7) AND confactadm = 1`,
                outFields: "subdet,descrip,tdeterm",
                returnGeometry: "false",
                f: "json"
            });

            const resp = await fetch(`${qUrl}?${params.toString()}`);
            if (!resp.ok) throw new Error("Network error");
            const data = await resp.json();

            if (!data.features || data.features.length === 0) {
                summaryContainer.innerHTML = '<p style="margin:0;color:#666;text-align:center;">No hay capas de Planificación ni de Riesgo registradas para este municipio.</p>';
                if (typeof actualizarLeyenda === 'function') actualizarLeyenda([], []);
                return;
            }

            const layers = {
                4: { title: "Derivadas de instrumentos de planificación", items: {} },
                7: { title: "Gestión del riesgo y Cambio Climático", items: {} }
            };

            data.features.forEach(f => {
                const t = f.attributes.tdeterm;
                const sub = f.attributes.subdet;
                const nom = f.attributes.descrip || `Subtipo ${sub}`;
                if (sub != null && layers[t]) {
                    layers[t].items[sub] = nom;
                }
            });

            let html = '<div style="margin-top:10px; font-family:\'Outfit\'; font-size:14px; color:#444;">';
            html += '<div style="margin-bottom:10px;"><strong>Marque las casillas para encender las capas en el mapa:</strong></div>';
            html += '<div id="panelControlCapas" style="max-height:400px; overflow-y:auto; padding-left:5px; padding-right:15px;">';

            [4, 7].forEach(t => {
                const items = layers[t].items;
                if (Object.keys(items).length > 0) {
                    html += `<div style="font-weight:600; margin-top:10px; margin-bottom:5px; border-bottom:1px solid #ddd; padding-bottom:3px; display:flex; align-items:center; background-color:#f0f4f8; padding:5px; border-radius:3px;">
                                        <input type="checkbox" class="chk-master" id="chk-master-${t}" data-tdeterm="${t}" checked style="margin-right:8px; cursor:pointer;">
                                        <label for="chk-master-${t}" style="cursor:pointer; margin:0; user-select:none;">${layers[t].title}</label>
                                     </div>`;

                    for (const [sub, nom] of Object.entries(items)) {
                        let isChecked = false;
                        if (t === 4 && nom.includes("POMCA")) isChecked = true;
                        if (t === 7 && nom.toLowerCase().includes("inundaci")) isChecked = true;

                        html += `<div style="margin-bottom:5px; padding-left:25px; display:flex; align-items:center;">
                                            <input type="checkbox" class="chk-child chk-child-${t}" data-tdeterm="${t}" value="${sub}" ${isChecked ? "checked" : ""} style="margin-right:8px; cursor:pointer;" id="chk-child-${t}-${sub}">
                                            <label for="chk-child-${t}-${sub}" style="cursor:pointer; margin:0; display:flex; align-items:center; user-select:none;">${nom}</label>
                                         </div>`;
                    }
                }
            });

            html += '</div></div>';
            summaryContainer.innerHTML = html;

            const applyFilters = () => {
                let conds = [];

                [4, 7].forEach(t => {
                    const master = document.getElementById(`chk-master-${t}`);
                    if (master && master.checked) {
                        const checkedChildren = document.querySelectorAll(`.chk-child-${t}:checked`);
                        const subs = Array.from(checkedChildren).map(cb => cb.value);
                        if (subs.length > 0) {
                            conds.push(`(tdeterm = ${t} AND subdet IN (${subs.join(",")}))`);
                        }
                    }
                });

                let filterWhere = "1=0";
                if (conds.length > 0) {
                    filterWhere = `mpcodigo = '${mpcodigo}' AND confactadm = 1 AND (${conds.join(" OR ")})`;
                }

                if (window.activeFeatureLayer) {
                    window.activeFeatureLayer.definitionExpression = filterWhere;
                    if (typeof layerGlobal !== 'undefined' && layerGlobal.renderer) {
                        window.activeFeatureLayer.renderer = layerGlobal.renderer.clone();
                    }
                    window.activeFeatureLayer.queryExtent({ where: filterWhere }).then(function (res) {
                        if (res.extent) view.goTo(res.extent.expand(1.3));
                    }).catch(() => { });
                }
            };

            const allChks = document.querySelectorAll('.chk-master, .chk-child');
            allChks.forEach(chk => chk.addEventListener('change', applyFilters));

            applyFilters();

        } catch (e) {
            summaryContainer.innerHTML = '<p style="margin:0;color:#c00;">Error al generar panel de Control de Capas.</p>';
            console.error("cargarDeterminantesControlCapas error:", e);
        }
    }

    function filtrarMapaDeterminantes(categoryNum) {
        var active = window.activeFeatureLayer || layerGlobal;
        if (!active) return;

        var filterWhere = whereBase
            ? whereBase + " AND confactadm = 1 AND determ = " + categoryNum
            : "confactadm = 1 AND determ = " + categoryNum;

        active.definitionExpression = filterWhere;

        active.queryExtent({ where: filterWhere }).then(function (res) {
            if (res.extent) view.goTo(res.extent.expand(1.3));
        }).catch(function (e) { console.warn("Error zoom determinantes:", e); });

        syncLegendToLabelSelection(categoryNames[categoryNum] || "");
    }

    // Clic en mapa filtra por tipo de determinante
    async function manejarClickMapa(event) {
        var config = getActiveLayerConfig();
        if (!config || !config.isDeterminantesGraficos) return;

        var response = await view.hitTest(event);
        var active = window.activeFeatureLayer || layerGlobal;
        if (!active) return;

        var hit = (response.results || []).find(function (r) { return r.graphic && r.graphic.layer === active; });
        if (!hit) return;

        var determ = hit.graphic.attributes ? hit.graphic.attributes.determ : null;
        if (determ) filtrarMapaDeterminantes(Number(determ));
    }


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

})