export const AppState = {
    // Módulo activo
    currentLimitesTab: "DEPARTAMENTOS",

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
    municipioActual: "",
    deptoActual: "",
    filtroNivel: "",

    // Diccionarios
    diccionarioMunicipios: {},
    diccionarioDepartamentos: {},
    todosMunicipios: [],

    // Render/control
    renderCycleId: 0,
    scaleHandle: null,
    highlightHandle: null,
    lastHoverWhere: "",
    legendFilterLabel: null
};