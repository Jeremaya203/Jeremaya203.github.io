export const AppState = {
    // Módulo activo
    currentMode: "ORDENAMIENTO",
    currentMainModule: "ORDENAMIENTO",
    currentLandUsePlanningTab: "VIGENCIA",
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
    currentMunicipalityId: "",
    deptoActual: "",
    territoryLevel: "",

    // Índices
    currentSubLayerIndex: 0,

    // Charts
    chartInstance: null,
    geoPieChartInstance: null,
    geoDonutChartInstance: null,

    // Diccionarios
    municipalityNames: {},
    departmentNames: {},
    municipalities: [],

    // Render/control
    renderCycleId: 0,
    scaleHandle: null,
    highlightHandle: null,
    lastHoverWhere: "",
    legendFilterLabel: null,

    // Legend
    updateLegendByExtent: null
};
