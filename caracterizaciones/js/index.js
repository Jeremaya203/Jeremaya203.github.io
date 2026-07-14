        import {
            LAYERS_CONFIG,
            ORDENAMIENTO_CONFIG,
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
   

import { handleTimeSliderInput } 
from "./map/layerController.js";
        
      
        let coloresOrdenSuelo = null; // { "15001": {label, color}, ... }
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
        let currentMode = 'RELIEVE'; // RELIEVE | CLIMA
        let currentMainModule = "BIOFISICO"; // BIOFISICO | ORDENAMIENTO
        let currentOrdenamientoTab = "CLASIFICACION_SUELO"; 
        let currentRuralChartView = "CATEGORIA"; // "CATEGORIA" | "USO_PRINCIPAL"
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

        let vocacionRendererDict = null;
        let vocacionMainDict = null;
        let ruralCategoriaDict = null;
        window.__ruralCategoriaColorMap = {};
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


        function destroyLayerSafe(layer){
            try { layer?.destroy?.(); } catch(e) {}
            }

        function clearLayers() {
            if (!map) return;

            // invalida cargas anteriores
            renderCycleId++;

            if (scaleHandle) {
                try { scaleHandle.remove(); } catch (e) {}
                scaleHandle = null;
            }

            // limpiar highlight activo
            if (highlightHandle) {
                try { highlightHandle.remove(); } catch (e) {}
                highlightHandle = null;
            }

            lastHoverWhere = "";
            legendFilterLabel = null;

            // limpiar variantes
            if (layersGlobal.length) {
                layersGlobal.forEach(l => {
                    try { map.remove(l); } catch (e) {}
                    destroyLayerSafe(l);
                });
                layersGlobal = [];
            }

            // limpiar capa principal
            if (layerGlobal) {
                try { map.remove(layerGlobal); } catch (e) {}
                destroyLayerSafe(layerGlobal);
            }

            layerGlobal = null;
            chartLayerGlobal = null;
            layerViewGlobal = null;
            window.activeFeatureLayer = null;

            // limpiar estaciones
            if (stationsLayer) {
                try { map.remove(stationsLayer); } catch (e) {}
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
                RELIEVE: "Relieve",
                CLIMA: "Clima",
                HIDROGRAFIA: "Hidrografía",
                ECOSISTEMAS: "Ecosistemas",
                SUELOS: "Suelos",
                FENOMENOS: "Fenómenos Amenazantes"
            };
            return labels[mode] || "Vista";
        }

        

        function initModuleDropdown(dropdownId, triggerId, menuSelector, onItemClick = null) {
            const dropdown = document.getElementById(dropdownId);
            const trigger = document.getElementById(triggerId);
            const menu = dropdown?.querySelector(menuSelector);
            const items = dropdown?.querySelectorAll(".dropdown-item");

            if (!dropdown || !trigger || !menu || !items?.length) return;

            trigger.onclick = function (e) {
                e.stopPropagation();

                document.querySelectorAll(".modulo-dropdown.open").forEach(d => {
                    if (d !== dropdown) d.classList.remove("open");
                });

                dropdown.classList.toggle("open");
            };

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

            initModuleDropdown("limitesDropdown", "limitesTrigger", ".dropdown-menu-custom");
            initModuleDropdown("ordenamientoDropdown", "ordenamientoTrigger", ".dropdown-menu-custom", function(target) {
                currentMainModule = "ORDENAMIENTO";

                if (target === "Clasificación del suelo") {
                    currentOrdenamientoTab = "CLASIFICACION_SUELO";
                } else if (target === "Áreas de actividad") {
                    currentOrdenamientoTab = "AREAS_ACTIVIDAD";
                } else if (target === "Zonificación de uso del suelo rural") {
                    currentOrdenamientoTab = "ZONIFICACION_RURAL";
                    currentRuralChartView = "CATEGORIA";
                }

                hideTimeSlider();
                destroyGeoformasCharts();
                toggleGeoformasCharts(false);

                
                window.__vocacionSelectedLabel = null;
                legendFilterLabel = null;
                window.__aa_active_filters = new Set();
                window.__aa_all_items = [];
                window.__aa_full_codes = [];
                window.__aa_base_where = "1=1";

                // limpiar gráfica anterior
                if (chartInstance) {
                    chartInstance.destroy();
                    chartInstance = null;
                }

                // limpiar leyenda anterior de inmediato
                const legendTitle = document.getElementById("legendTitle");
                const legendContent = document.getElementById("legendContent");

                if (legendTitle) legendTitle.textContent = "Leyenda";
                if (legendContent) legendContent.innerHTML = "";
                window.__lastLegendRenderKey = "";

                // limpiar resumen mientras carga la nueva vista
                const summaryDiv = document.getElementById("summaryDiv");
                if (summaryDiv) {
                    summaryDiv.textContent = "Cargando información...";
                }

                renderControls();

                if (typeof window.cargarOrdenamientoActual === "function") {
                    window.cargarOrdenamientoActual();
                } else {
                    console.warn("cargarOrdenamientoActual aún no está disponible");
                }
            });
            initModuleDropdown("legalDropdown", "legalTrigger", ".dropdown-menu-custom");
            initModuleDropdown("ocupacionDropdown", "ocupacionTrigger", ".dropdown-menu-custom");
            initModuleDropdown("socioeconomicoDropdown", "socioeconomicoTrigger", ".dropdown-menu-custom");
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

            ], function(EsriMap, MapView, FeatureLayer, Basemap, TileLayer, VectorTileLayer, Legend,
           GraphicsLayer, Graphic, Extent, Home, Locate, BasemapGallery, Expand,ScaleBar) {

            
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
                await manejarClickMapaAreasActividad(event);
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
                        const wherePeriodo = `${baseWhereStable} AND periodobosque = '${periodoSafe}'`;

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
                    const wherePeriodo = `${baseWhereStable} AND ${activeConfig.periodField} = '${selectedPeriodSafe}'`;

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

                // initDropdownBiofisico();

                // document.getElementById("btnPrev").onclick = prevLayer;
                // document.getElementById("btnNext").onclick = nextLayer;
               

            
                updateNavbarActive(currentMode);
                renderControls();
            }

            function setMode(mode) {
                if (typeof hideTimeSlider === "function") {
                    hideTimeSlider();
                }

                timeSliderTouched = false;
                currentMainModule = "BIOFISICO";
                currentMode = mode;
                currentSubLayerIndex = 0;

                updateNavbarActive(mode);
                clampSubLayerIndex();
                renderSubTabs();
                updateMapViewBadge(getCurrentModeLabel(mode));

                if (municipioActual || (filtroNivel === "DEPTO" && deptoActual)) {
                    cargarCapaActual();
                }
            }

  
            function renderControls() {
                if (currentMainModule === "ORDENAMIENTO") {
                    renderSubTabs();
                    return;
                }

                clampSubLayerIndex();
                renderSubTabs();
            }
            window.renderControls = renderControls;                 
      
        

 
        });