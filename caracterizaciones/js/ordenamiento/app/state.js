export const AppState = {
    // Módulo activo
    currentMode: "ORDENAMIENTO",
    currentMainModule: "ORDENAMIENTO",
    currentOrdenamientoTab: "VIGENCIA",
    currentRuralChartView: "CATEGORIA",

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

    // Render/control
    renderCycleId: 0,
    scaleHandle: null,
    highlightHandle: null,
    lastHoverWhere: "",
    legendFilterLabel: null,

    // Legend
    updateLegendByExtent: null
};
