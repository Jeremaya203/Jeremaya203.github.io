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
    currentMunicipalityId: "",
    currentDepartmentId: "",
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
    bf3LabelToCode: new Map(),
    landformRendererDictionary: null,
    landformLandscapeDictionary: null,
    landSuitabilityRendererDictionary: null,
    landSuitabilityMainDictionary: null,
    soilOrderColors: null,

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
    activeDeforestationPeriod: "Todos",
    deforestationBasePeriods: [],

    // Legend
    updateLegendByExtent: null
};
