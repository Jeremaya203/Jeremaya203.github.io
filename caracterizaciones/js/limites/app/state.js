export const AppState = {
    // Módulo activo
    currentBoundariesTab: "DEPARTAMENTOS",

    // ArcGIS
    map: null,
    view: null,
    overviewView: null,

    // Capas
    layerGlobal: null,
    layerViewGlobal: null,
    layersGlobal: [],
    chartLayerGlobal: null,

    // Filtros territoriales
    whereBase: "",
    currentMunicipalityId: "",
    currentDepartmentId: "",
    territoryLevel: "",

    // Diccionarios
    municipalityNames: {},
    departmentNames: {},
    municipalities: [],

    // Render/control
    renderCycleId: 0,
    scaleHandle: null,
    highlightHandle: null,
    lastHoverWhere: "",
    legendFilterLabel: null
};