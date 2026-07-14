import { socioeconomicoLayerUrl } from "../../services/serviceRoots.js?v=sigi-service-roots-20260604";

const CONECTIVIDAD_TEXT_SERVICE_URL = socioeconomicoLayerUrl(44);
const INFRAESTRUCTURA_COMPLEMENTARIA_SERVICE_URL = socioeconomicoLayerUrl(20);
const TIEMPOS_DESPLAZAMIENTO_SERVICE_URL = socioeconomicoLayerUrl(27);
const INSTITUCIONES_EDUCACION_SERVICE_URL = socioeconomicoLayerUrl(28);
const SALUD_SERVICE_URL = socioeconomicoLayerUrl(32);
const EQUIPAMIENTOS_SERVICE_URL = socioeconomicoLayerUrl(48);
const VIA_FERREA_PREFIX_REGEX = /^Vía\s+férrea\.\s*/i;

function stripViaFerreaPrefix(label) {
    return String(label || "").replace(VIA_FERREA_PREFIX_REGEX, "").trim();
}

export const CONECTIVIDAD_FERREA_BAR_CHART_CONFIG = {
    id: "conectividad-férrea",
    tabLabel: "Vias férreas",
    type: "bar",
    library: "chart.js",
    title: "Conectividad férrea",
    titleTemplate: "Conectividad férrea del {mpcategor} de {mpnombre}, {dpnombre}",
    canvasHeight: 380,
    disableHorizontalScroll: true,
    xAxis: {
        field: "vobservacion",
        label: "Observacion",
        autoSkip: true,
        maxTicksLimit: 6,
        maxRotation: 0,
        minRotation: 0,
        fontSize: 9,
        tickPadding: 8,
        maxLineLength: 14,
        maxLines: 2
    },
    yAxis: {
        field: "vitlong",
        label: "Longitud (Km)",
        decimals: 2,
        suffix: "Km",
        grace: "18%",
        tickPadding: 8
    },
    aggregation: "sum",
    requiredFields: {
        category: { name: "vobservacion", alias: "Observacion", type: "text" },
        value: { name: "vitlong", alias: "Longitud", type: "double" }
    },
    sourcesFromVariants: true,
    includeVariantKeys: ["red_ferrea"],
    colorsFromRenderer: true,
    labelsFromRenderer: false,
    mapInteractionField: "vobservacion",
    mapInteraction: { allLayers: false },
    titleFields: ["mpcategor", "mpnombre", "dpnombre", "mpcodigo", "dpcodigo", "vobservacion"],
    filter: {
        municipalityField: "mpcodigo",
        requiredLevel: "MUNI"
    },
    additionalWhere: "vobservacion LIKE 'Vía férrea%'",
    tooltipFields: ["vitlong"],
    tooltipLabels: {
        vitlong: "Longitud"
    },
    dataLabels: {
        enabled: true,
        decimals: 2,
        suffix: "Km",
        hideSuffix: true,
        strategy: "adaptive-box"
    },
    displayLabel: ({ label }) => stripViaFerreaPrefix(label)
};

export const CONECTIVIDAD_FLUVIAL_BAR_CHART_CONFIG = {
    id: "conectividad-fluvial",
    tabLabel: "Vias fluviales",
    type: "bar",
    library: "chart.js",
    title: "Conectividad fluvial",
    titleTemplate: "Conectividad fluvial del {mpcategor} de {mpnombre}, {dpnombre}",
    canvasHeight: 380,
    disableHorizontalScroll: true,
    xAxis: {
        field: "vifmodalidad",
        label: "Modalidad",
        autoSkip: true,
        maxTicksLimit: 6,
        maxRotation: 0,
        minRotation: 0,
        fontSize: 9,
        tickPadding: 8,
        maxLineLength: 14,
        maxLines: 2
    },
    yAxis: {
        field: "st_length(shape)",
        label: "Longitud (Km)",
        decimals: 2,
        suffix: "Km",
        grace: "18%",
        tickPadding: 8
    },
    aggregation: "sum",
    requiredFields: {
        category: { name: "vifmodalidad", alias: "Modalidad", type: "text" },
        value: { name: "st_length(shape)", alias: "shape_Length", type: "double" }
    },
    categoryColors: {
        Mixto: "rgba(0, 77, 168, 0.95)",
        Pasajeros: "rgba(13, 148, 136, 0.95)",
        Turismo: "rgba(14, 116, 144, 0.95)"
    },
    mapRendererOverride: {
        type: "unique-value",
        field: "vifmodalidad",
        defaultSymbol: {
            type: "simple-line",
            style: "solid",
            color: [100, 116, 139, 255],
            width: 1.4
        },
        uniqueValueInfos: [
            {
                value: "Mixto",
                label: "Mixto",
                symbol: {
                    type: "simple-line",
                    style: "solid",
                    color: [0, 77, 168, 255],
                    width: 1.6
                }
            },
            {
                value: "Pasajeros",
                label: "Pasajeros",
                symbol: {
                    type: "simple-line",
                    style: "solid",
                    color: [13, 148, 136, 255],
                    width: 1.6
                }
            },
            {
                value: "Turismo",
                label: "Turismo",
                symbol: {
                    type: "simple-line",
                    style: "solid",
                    color: [14, 116, 144, 255],
                    width: 1.6
                }
            }
        ]
    },
    sourcesFromVariants: true,
    includeVariantKeys: ["red_fluvial"],
    colorsFromRenderer: true,
    labelsFromRenderer: false,
    mapInteractionField: "vifmodalidad",
    mapInteraction: { allLayers: false },
    titleFields: ["mpcategor", "mpnombre", "dpnombre", "mpcodigo", "dpcodigo", "vifmodalidad"],
    filter: {
        municipalityField: "mpcodigo",
        requiredLevel: "MUNI"
    },
    tooltipFields: ["st_length(shape)"],
    tooltipLabels: {
        "st_length(shape)": "Longitud"
    },
    dataLabels: {
        enabled: true,
        decimals: 2,
        suffix: "Km",
        hideSuffix: true,
        strategy: "adaptive-box"
    },
    valueTransform: (value) => {
        const numericValue = Number(value);
        if (!Number.isFinite(numericValue)) return value;
        return numericValue / 1000;
    }
};

export const INFRAESTRUCTURA_COMPLEMENTARIA_BAR_CHART_CONFIG = {
    id: "infraestructura-complementaria",
    tabLabel: "Infraestructura complementaria",
    type: "bar",
    library: "chart.js",
    title: "Infraestructura complementaria",
    titleTemplate: "Infraestructura complementaria del {mpcategor} de {mpnombre}, {dpnombre}",
    canvasHeight: 390,
    disableHorizontalScroll: true,
    url: INFRAESTRUCTURA_COMPLEMENTARIA_SERVICE_URL,
    layerUrl: INFRAESTRUCTURA_COMPLEMENTARIA_SERVICE_URL,
    serviceUrl: INFRAESTRUCTURA_COMPLEMENTARIA_SERVICE_URL,
    layerId: 20,
    source: "SE_INP",
    fields: ["mpcodigo", "mpnombre", "dpnombre", "mpcategor", "inftipo"],
    xAxis: {
        field: "inftipo",
        label: "Tipo de infraestructura complementaria",
        autoSkip: true,
        maxTicksLimit: 7,
        maxRotation: 0,
        minRotation: 0,
        fontSize: 9,
        tickPadding: 8,
        maxLineLength: 16,
        maxLines: 2
    },
    yAxis: {
        field: "inftipo",
        label: "Cantidad de elementos de infraestructura complementaria",
        decimals: 0,
        grace: "18%",
        tickPadding: 8
    },
    aggregation: "count",
    sourcesFromVariants: true,
    includeVariantKeys: ["infraestructura_complementaria"],
    categoryColors: {
        "16111": "rgba(14, 116, 144, 0.95)",
        "16112": "rgba(37, 99, 235, 0.95)",
        "16113": "rgba(13, 148, 136, 0.95)",
        "16114": "rgba(249, 115, 22, 0.95)"
    },
    requiredFields: {
        category: { name: "inftipo", alias: "Tipo", type: "small-integer" }
    },
    labelsFromDomain: true,
    labelsFromRenderer: true,
    colorsFromRenderer: true,
    mapInteractionField: "inftipo",
    mapInteraction: { allLayers: false },
    titleFields: ["mpcategor", "mpnombre", "dpnombre", "mpcodigo", "dpcodigo", "inftipo"],
    filter: {
        municipalityField: "mpcodigo",
        requiredLevel: "MUNI"
    },
    dataLabels: {
        enabled: true,
        decimals: 0,
        strategy: "adaptive-box"
    },
    textSource: {
        url: CONECTIVIDAD_TEXT_SERVICE_URL,
        field: "analisisreginfra",
        filterField: "mpcodigo",
        emptyMessage: "La información descriptiva para este municipio aún no se encuentra disponible. Actualmente la base de datos se encuentra en proceso de actualización y carga de información."
    }
};

export const CONECTIVIDAD_TERRESTRE_BAR_CHART_CONFIG = {
    id: "conectividad-terrestre",
    type: "bar",
    library: "chart.js",
    title: "Conectividad terrestre",
    titleTemplate: "Conectividad terrestre del municipio de {mpnombre}, {dpnombre}",
    tabLabel: "Vias terrestres",


    xAxis: { field: "vclasmintrans", label: "Clasificación vial MinTransporte" },
    yAxis: { field: "vitlong", label: "Longitud (Km)", decimals: 2, suffix: "Km" },

    aggregation: "sum",
    sourcesFromVariants: true,
    chartSourceVariantKeys: ["red_vial"],
    symbolSourceVariantKeys: ["red_vial", "red_departamental", "otras_vias"],
    includeVariantKeys: ["red_vial", "red_departamental", "otras_vias"],
   
    

    labelsFromDomain: true,
    labelsFromRenderer: true,
    colorsFromRenderer: true,

    mapInteractionField: "vclasmintrans",
    mapInteraction: { allLayers: true },

    titleFields: ["mpcategor", "mpnombre", "dpnombre", "mpcodigo", "dpcodigo", "vclasinvias"],

    filter: {
        municipalityField: "mpcodigo",
        requiredLevel: "MUNI"
    },

    tooltipFields: ["vitlong"],
    tooltipLabels: {
        vitlong: "Longitud"
    },

    dataLabels: {
        enabled: true,
        decimals: 2,
        suffix: "Km",
        hideSuffix: true,
        strategy: "adaptive-box"
    },

    textSource: {
        url: CONECTIVIDAD_TEXT_SERVICE_URL,
        fields: ["introacces", "analisiscobvias"],
        filterField: "mpcodigo",
        mergeStrategy: "fields_without_labels",
        emptyMessage: "La información descriptiva para este municipio aún no se encuentra disponible. Actualmente la base de datos se encuentra en proceso de actualización y carga de información."
    },

    supplementaryCharts: [
        CONECTIVIDAD_FERREA_BAR_CHART_CONFIG,
        CONECTIVIDAD_FLUVIAL_BAR_CHART_CONFIG,
        INFRAESTRUCTURA_COMPLEMENTARIA_BAR_CHART_CONFIG,
    ]
};

export const TIEMPOS_DESPLAZAMIENTO_PIE_CHART_CONFIG = {
    id: "tiempos-desplazamiento",
    type: "pie",
    library: "chart.js",
    title: "Tiempos de desplazamiento",
    titleTemplate: "Relacion de tiempos de desplazamiento desde la cabecera municipal de {mpnombre}, {dpnombre}",
    url: TIEMPOS_DESPLAZAMIENTO_SERVICE_URL,
    layerUrl: TIEMPOS_DESPLAZAMIENTO_SERVICE_URL,
    serviceUrl: TIEMPOS_DESPLAZAMIENTO_SERVICE_URL,
    layerId: 27,
    source: "SE_ISC",
    fields: ["mpcodigo", "dpcodigo", "mpnombre", "dpnombre", "mpcategor", "tdcabecera", "areat"],
    xAxis: { field: "tdcabecera", label: "Tiempo de desplazamiento a la cabecera municipal" },
    yAxis: { field: "areat", label: "Área de desplazamiento", decimals: 2, suffix: "Ha" },
    aggregation: "sum",
    requiredFields: {
        category: { name: "tdcabecera", alias: "Tiempo de desplazamiento a la cabecera municipal", type: "long" },
        value: { name: "areat", alias: "Área", type: "double" }
    },
    labelsFromDomain: true,
    colorsFromRenderer: true,
    mapInteractionField: "tdcabecera",
    titleFields: ["mpcategor", "mpnombre", "dpnombre", "mpcodigo", "dpcodigo", "tdcabecera"],
    filter: {
        departmentField: "dpcodigo",
        municipalityField: "mpcodigo",
        valueSource: "code"
    },
    tooltipFields: ["areat"],
    tooltipLabels: {
        areat: "Área"
    },
    textSource: {
        url: CONECTIVIDAD_TEXT_SERVICE_URL,
        fields: ["analisisreginfra", "conectrecia", "analisistdesp"],
        filterField: "mpcodigo",
        mergeStrategy: "fields_without_labels",
        emptyMessage: "La información descriptiva para este municipio aún no se encuentra disponible. Actualmente la base de datos se encuentra en proceso de actualización y carga de información."
    }
};

export const INSTITUCIONES_EDUCACION_BAR_CHART_CONFIG = {
    id: "instituciones-educación",
    type: "bar",
    library: "chart.js",
    title: "Instituciones de educación",
    titleTemplate: "Instituciones educativas del {mpcategor} de {mpnombre}, {dpnombre}",
    url: INSTITUCIONES_EDUCACION_SERVICE_URL,
    layerUrl: INSTITUCIONES_EDUCACION_SERVICE_URL,
    serviceUrl: INSTITUCIONES_EDUCACION_SERVICE_URL,
    layerId: 28,
    source: "SE_IES",
    fields: ["mpcodigo", "mpnombre", "dpnombre", "mpcategor", "mpitp", "mpit", "mpiuet", "mpuni", "mpstotalbs"],
    xAxis: { field: "caracter_acad", label: "Caracter academico" },
    yAxis: { field: "cantidad", label: "Numero de instituciones", decimals: 0 },
    categoryFields: ["mpitp", "mpit", "mpiuet", "mpuni", "mpstotalbs"],
    filter: {
        municipalityField: "mpcodigo",
        requiredLevel: "MUNI"
    },
    textSource: {
        url: CONECTIVIDAD_TEXT_SERVICE_URL,
        fields: ["analisisedu"],
        filterField: "mpcodigo",
        mergeStrategy: "fields_without_labels",
        emptyMessage: "La información descriptiva para este municipio aún no se encuentra disponible. Actualmente la base de datos se encuentra en proceso de actualización y carga de información."
    }
};

export const SALUD_BAR_CHART_CONFIG = {
    id: "salud-infraestructura",
    type: "bar",
    library: "chart.js",
    title: "Naturaleza del servicio de salud",
    titleTemplate: "Naturaleza del servicio de salud del {mpcategor} de {mpnombre}, {dpnombre}",
    url: SALUD_SERVICE_URL,
    layerUrl: SALUD_SERVICE_URL,
    serviceUrl: SALUD_SERVICE_URL,
    layerId: 32,
    source: "SE_SLD",
    fields: ["mpcodigo", "mpnombre", "dpnombre", "mpcategor", "no_prestadores", "nprivada", "npublica", "nmixta"],
    xAxis: { field: "tipo_cobertura", label: "Naturaleza de cobertura en salud" },
    yAxis: { field: "cantidad", label: "Numero de instituciones", decimals: 0 },
    categoryFields: ["nprivada", "npublica", "nmixta"],
    legendField: "no_prestadores",
    dedupeLegendByLabel: true,
    categoryLabels: {
        nprivada: "Privada",
        npublica: "Pública",
        nmixta: "Mixta"
    },
    categoryColors: {
        nprivada: "rgba(14, 116, 144, 0.95)",
        npublica: "rgba(37, 99, 235, 0.95)",
        nmixta: "rgba(96, 165, 250, 0.95)"
    },
    includeZeroCategories: true,
    requiredFields: {
        private: { name: "nprivada", alias: "Privada", type: "short" },
        public: { name: "npublica", alias: "Pública", type: "short" },
        mixed: { name: "nmixta", alias: "Mixta", type: "short" }
    },
    departmentMapMessage: "Seleccione un municipio para ver la información.",
    filter: {
        departmentField: "dpcodigo",
        municipalityField: "mpcodigo",
        valueSource: "code",
        requiredLevel: "MUNI"
    },
    dataLabels: {
        enabled: true,
        decimals: 0
    },
    preserveViewOnPopup: true,
    allowDepartmentPopup: true,
    textSource: {
        url: CONECTIVIDAD_TEXT_SERVICE_URL,
        field: "analisissld",
        filterField: "mpcodigo",
        emptyMessage: "La información descriptiva para este municipio aún no se encuentra disponible. Actualmente la base de datos se encuentra en proceso de actualización y carga de información."
    }
};

export const EQUIPAMIENTOS_DUAL_CHART_CONFIG = {
    id: "equipamientos-infraestructura",
    type: "equipamientos-dual",
    library: "chart.js",
    title: "Equipamientos",
    pieTitle: "Distribución de los equipamientos",
    pieTitleTemplate: "Distribución de los equipamientos del {mpcategor} de {mpnombre}, {dpnombre}",
    stackedTitle: "Número de equipamientos",
    stackedTitleTemplate: "Número de equipamientos del {mpcategor} de {mpnombre}, {dpnombre}",
    url: EQUIPAMIENTOS_SERVICE_URL,
    layerUrl: EQUIPAMIENTOS_SERVICE_URL,
    serviceUrl: EQUIPAMIENTOS_SERVICE_URL,
    layerId: 48,
    source: "SE_TEQ",
    fields: ["mpcodigo", "mpnombre", "dpnombre", "taqcat", "taqcom"],
    xAxis: { field: "taqcat", label: "Categoría" },
    yAxis: { field: "cantidad", label: "Número de equipamientos", decimals: 0 },
    stackField: "taqcom",
    legendField: "no_prestadores",
    dedupeLegendByLabel: true,
    pie: {
        field: "taqcat",
        label: "Distribución de los equipamientos"
    },
    requiredFields: {
        category: { name: "taqcat", alias: "Categoría", type: "text" },
        component: { name: "taqcom", alias: "Componente", type: "text" }
    },
    filter: {
        municipalityField: "mpcodigo",
        requiredLevel: "MUNI"
    },
    mapFallback: {
        url: SALUD_SERVICE_URL,
        title: "Salud",
        source: "SE_SLD"
    },
    textSource: {
        url: CONECTIVIDAD_TEXT_SERVICE_URL,
        fields: ["introequip", "analisisseg", "analisisrecdep", "analisisclasfmpio"],
        labels: {
            introequip: "Análisis de equipamientos colectivos",
            analisisseg: "Análisis de seguridad y convivencia",
            analisisrecdep: "Análisis de recreación y deportes",
            analisisclasfmpio: "Análisis clasificación del municipio"
        },
        filterField: "mpcodigo",
        emptyMessage: "La información descriptiva para este municipio aún no se encuentra disponible. Actualmente la base de datos se encuentra en proceso de actualización y carga de información."
    }
};

export const infraestructuraChartsConfig = [
    CONECTIVIDAD_TERRESTRE_BAR_CHART_CONFIG,
    TIEMPOS_DESPLAZAMIENTO_PIE_CHART_CONFIG,
    INSTITUCIONES_EDUCACION_BAR_CHART_CONFIG,
    SALUD_BAR_CHART_CONFIG,
    EQUIPAMIENTOS_DUAL_CHART_CONFIG
];
