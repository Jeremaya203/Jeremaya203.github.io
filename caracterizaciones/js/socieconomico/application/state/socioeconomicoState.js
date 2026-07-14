export const STATIONS_LAYER_URL = "https://mapas2.igac.gov.co/server/rest/services/ordenamiento/componentebiofisico/MapServer/11";

export function initializeWindowState(target = window) {
    target.__geoformaSelectedPaisaje = null;
    target.__geoformaPairColorMap = {};
    target.__geoformaPaisajeColorMap = {};
    target.__ruralCategoriaColorMap = {};
    target.__vocacionSelectedLabel = null;
    target.__vocacionPairColorMap = {};
    target.__vocacionMainColorMap = {};
    target.__aa_active_filters = new Set();
    target.__aa_all_items = [];
    target.__aa_full_codes = [];
    target.__aa_base_where = "1=1";
    target.__legendState = {
        allCodes: [],
        activeCodes: new Set(),
        field: null,
        layer: null,
        baseWhere: "1=1"
    };
    target.__activeSocioChartConfig = null;
}

export function createSocioeconomicoState() {
    const values = {
        coloresOrdenSuelo: null,
        sliderMode: "zoom",
        currentMode: "PIB Y Valor agregado",
        currentMainModule: "SOCIOECONOMICO",
        currentOrdenamientoTab: "CLASIFICACION_SUELO",
        currentRuralChartView: "CATEGORIA",
        stationsLayer: null,
        currentSubLayerIndex: 0,
        layerGlobal: null,
        layerViewGlobal: null,
        whereBase: "",
        municipioActual: "",
        municipioInfo: null,
        chartInstance: null,
        diccionarioMunicipios: {},
        geoPieChartInstance: null,
        geoDonutChartInstance: null,
        geoformasRendererDict: null,
        geoformasPaisajeDict: null,
        diccionarioDepartamentos: {},
        todosMunicipios: [],
        layersGlobal: [],
        chartLayerGlobal: null,
        map: null,
        view: null,
        legendWidget: null,
        bf3LabelToCode: new Map(),
        deptoActual: "",
        filtroNivel: "",
        updateLegendByExtent: null,
        scaleHandle: null,
        renderCycleId: 0,
        highlightHandle: null,
        lastHoverWhere: "",
        legendFilterLabel: null,
        hoverDebounceMs: 120,
        vocacionRendererDict: null,
        vocacionMainDict: null,
        ruralCategoriaDict: null,
        extentInicial: null
    };

    return {
        STATIONS_LAYER_URL,
        get(key) {
            return values[key];
        },
        set(key, value) {
            values[key] = value;
            return value;
        },
        increment(key) {
            values[key] += 1;
            return values[key];
        },
        accessors() {
            return values;
        }
    };
}

export function createLayerStateAdapter(appState) {
    const values = appState.accessors();

    return {
        get currentMainModule() { return values.currentMainModule; }, set currentMainModule(value) { values.currentMainModule = value; },
        get renderCycleId() { return values.renderCycleId; }, set renderCycleId(value) { values.renderCycleId = value; },
        get currentMode() { return values.currentMode; }, set currentMode(value) { values.currentMode = value; },
        get currentSubLayerIndex() { return values.currentSubLayerIndex; }, set currentSubLayerIndex(value) { values.currentSubLayerIndex = value; },
        get layerGlobal() { return values.layerGlobal; }, set layerGlobal(value) { values.layerGlobal = value; },
        get layerViewGlobal() { return values.layerViewGlobal; }, set layerViewGlobal(value) { values.layerViewGlobal = value; },
        get whereBase() { return values.whereBase; }, set whereBase(value) { values.whereBase = value; },
        get municipioActual() { return values.municipioActual; }, set municipioActual(value) { values.municipioActual = value; },
        get chartInstance() { return values.chartInstance; }, set chartInstance(value) { values.chartInstance = value; },
        get layersGlobal() { return values.layersGlobal; }, set layersGlobal(value) { values.layersGlobal = value; },
        get chartLayerGlobal() { return values.chartLayerGlobal; }, set chartLayerGlobal(value) { values.chartLayerGlobal = value; },
        get map() { return values.map; }, set map(value) { values.map = value; },
        get view() { return values.view; }, set view(value) { values.view = value; },
        get scaleHandle() { return values.scaleHandle; }, set scaleHandle(value) { values.scaleHandle = value; },
        get updateLegendByExtent() { return values.updateLegendByExtent; }, set updateLegendByExtent(value) { values.updateLegendByExtent = value; },
        get stationsLayer() { return values.stationsLayer; }, set stationsLayer(value) { values.stationsLayer = value; },
        get filtroNivel() { return values.filtroNivel; }, set filtroNivel(value) { values.filtroNivel = value; },
        get deptoActual() { return values.deptoActual; }, set deptoActual(value) { values.deptoActual = value; },
        get currentOrdenamientoTab() { return values.currentOrdenamientoTab; }, set currentOrdenamientoTab(value) { values.currentOrdenamientoTab = value; },
        get currentRuralChartView() { return values.currentRuralChartView; }, set currentRuralChartView(value) { values.currentRuralChartView = value; },
        get legendFilterLabel() { return values.legendFilterLabel; }, set legendFilterLabel(value) { values.legendFilterLabel = value; }
    };
}
