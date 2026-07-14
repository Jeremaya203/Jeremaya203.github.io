export const AppState = {
    // Módulo activo
    currentMode: "RELIEVE",

    // ArcGIS
    map: null,
    view: null,
    legendWidget: null,

    // Capas
    layerGlobal: null,
    layerViewGlobal: null,
    layersGlobal: [],
    chartLayerGlobal: null,
    stationsLayer: null,

    // Filtros territoriales
    whereBase: "",
    municipioActual: "",
    deptoActual: "",
    filtroNivel: "",

    // Índices
    currentSubLayerIndex: 0,

    // Charts
    chartInstance: null,
    geoPieChartInstance: null,
    geoDonutChartInstance: null,

    // Diccionarios
    diccionarioMunicipios: {},
    diccionarioDepartamentos: {},
    todosMunicipios: [],
    bf3LabelToCode: new Map(),
    geoformasRendererDict: null,
    geoformasPaisajeDict: null,
    vocacionRendererDict: null,
    vocacionMainDict: null,
    coloresOrdenSuelo: null,

    // Render/control
    renderCycleId: 0,
    scaleHandle: null,
    highlightHandle: null,
    lastHoverWhere: "",
    legendFilterLabel: null,

    // Sliders temporales
    sliderMode: "zoom",
    timeSliderPeriods: [],
    timeSliderIndex: 0,
    timeSliderEnabled: false,
    timeSliderTouched: false,
    timeSliderContextKey: "",
    deforestacionPeriodoActivo: "Todos",
    deforestacionPeriodosBase: [],

    // Legend
    updateLegendByExtent: null
};
