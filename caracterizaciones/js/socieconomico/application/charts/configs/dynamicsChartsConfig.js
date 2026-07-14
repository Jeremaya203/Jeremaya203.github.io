import { socioeconomicoLayerUrl } from "../../services/serviceRoots.js";
import { TURISMO_INFRAESTRUCTURA_BAR_CHART_CONFIG } from "./dinamicasSocioeconomicasChartsConfig.js?v=popup-department-exception-20260604";

const PIB_SERVICE_URL = socioeconomicoLayerUrl(7);
const VALOR_AGREGADO_SERVICE_URL = socioeconomicoLayerUrl(8);
const ACTIVIDADES_ECONOMICAS_SERVICE_URL = socioeconomicoLayerUrl(12);
const CENSO_PECUARIO_SERVICE_URL = socioeconomicoLayerUrl(50);
const SUPPORT_INFRASTRUCTURE_MAP_URL = socioeconomicoLayerUrl(14);
const SUPPORT_INFRASTRUCTURE_TABLE_URL = socioeconomicoLayerUrl(46);
const DYNAMICS_TEXT_SERVICE_URL = socioeconomicoLayerUrl(44);
const LIVESTOCK_CENSUS_GROUPS = [
    { label: "Porcinos", animalsField: "totalporcinos", farmsField: "totalprediosporcinos" },
    { label: "Aves", animalsField: "totalavestrasco", farmsField: "totalpreave" },
    { label: "Bovinos", animalsField: "totalbovinos", farmsField: "totalprediosbovinos" },
    { label: "Bufalos", animalsField: "totalbufalos", farmsField: "totalprediosbufalos" }
];

export const PIB_VALUE_ADDED_PIE_CHART_CONFIG = {
    id: "valor-agregado-sectores",
    tabLabel: "Valor agregado",
    type: "pie",
    library: "chart.js",
    title: "Sectores económicos",

    serviceUrl: VALOR_AGREGADO_SERVICE_URL,
    layerUrl: VALOR_AGREGADO_SERVICE_URL,
    url: VALOR_AGREGADO_SERVICE_URL,

    filterField: "mpcodigo",
    titleFields: ["mpcategor", "mpnombre", "dpnombre"],
    rendererField: "pvagregadokmcop",
    requireMunicipality: true,

    fields: [
        { field: "paprimarias", label: "Actividades primarias" },
        { field: "pasecundarias", label: "Actividades secundarias" },
        { field: "paterciarias", label: "Actividades terciarias" }
    ],

    colorPalette: ["#16a34a", "#f59e0b", "#0ea5e9"]
};

export const PIB_DEPARTMENTAL_BAR_CHART_CONFIG = {
    id: "pib-departamental",
    tabLabel: "PIB",
    type: "bar",
    library: "chart.js",
    title: "PIB por departamento",
    disableHorizontalScroll: true,
    responsive: true,
    canvasHeight: 420,
    zoom: {
        pan: {
            enabled: true,
            mode: "x",
            modifierKey: null,
            threshold: 8
        },
        zoom: {
            mode: "x",
            wheel: { enabled: true },
            pinch: { enabled: true },
            drag: {
                enabled: true,
                modifierKey: "ctrl"
            }
        }
    },

    serviceUrl: PIB_SERVICE_URL,
    layerUrl: PIB_SERVICE_URL,
    url: PIB_SERVICE_URL,

    xAxis: {
        field: "dpcodigo",
        label: "Departamentos",
        autoSkip: true,
        autoSkipPadding: 2,
        maxRotation: 90,
        minRotation: 90,
        fontSize: 8,
        fontWeight: "600",
        fontFamily: "Outfit, Arial, sans-serif",
        tickColor: "#526071",
        tickPadding: 4,
        bottomPadding: 18,
        maxLineLength: 100,
        maxLines: 1,
        tickLabelIndexSource: "value"
    },

    yAxis: {
        field: "pibdpto",
        label: "% PIB",
        decimals: 2,
        suffix: "%"
    },

    aggregation: "unique",

    filter: {
        scope: "allDepartments",
        departmentField: "dpcodigo",
        valueSource: "code"
    },

    tooltipFields: ["posiciondptonal", "pibdptokmcop"],
    tooltipLabels: {
        posiciondptonal: "Posición en la nación",
        pibdptokmcop: "PIB Departamento en miles de millones"
    },

    colorsFromRenderer: true,
    labelsFromRenderer: false,
    mapInteractionField: "dpcodigo",
    mapInteraction: { allLayers: false },

    colorPalette: "royalblue",

    subitems: [
        { id: "pib", label: "PIB", type: "main" },
        { id: "valor-agregado", label: "Valor agregado", type: "sectorPie" }
    ]
};

export const PIB_CHART_VARIANTS = [
    {
        key: "PIB",
        url: PIB_SERVICE_URL,
        minScale: 0,
        maxScale: 0
    },
    {
        key: "VALOR_AGREGADO",
        url: VALOR_AGREGADO_SERVICE_URL,
        minScale: 0,
        maxScale: 0
    }
];


// Configuración para el gráfico de Censo Agrícola EVA
export const EVA_PIE_CHART_CONFIG = {
    id: "eva-censo-agricola",
    tabLabel: "Censo agrícola",
    type: "pie",
    library: "chart.js",
    title: "Distribución de ciclo productivo",
    serviceUrl: socioeconomicoLayerUrl(45),
    filterField: "mpcodigo",
    filter: {
        municipalityField: "mpcodigo",
        requiredLevel: "MUNI"
    },
    titleFields: ["mpcategor", "mpnombre", "dpnombre"],
    textSource: {
        url: socioeconomicoLayerUrl(44),
        filterField: "mpcodigo",
        fields: ["obseva", "analisiseva"],
        mergeStrategy: "fields_without_labels"
    },
    fields: [
        { field: "evaciccult", label: "Ciclo del cultivo" },
        { field: "evaper", label: "Periodo" },
        { field: "evaha", label: "Área sembrada (ha)" },
        { field: "evadescult", label: "Desagregación cultivo" },
        { field: "evatha", label: "Rendimiento (t/ha)" }
    ],
    categories: [
        {
            key: "permanente",
            label: "Permanente",
            condition: record => record.evaciccult === "Permanente",
            color: "#15803d"
        },
        {
            key: "transitorio_a",
            label: "Transitorio A",
            condition: record => record.evaciccult === "Transitorio" && String(record.evaper || "").trim().endsWith("A"),
            color: "#f59e0b"
        },
        {
            key: "transitorio_b",
            label: "Transitorio B",
            condition: record => record.evaciccult === "Transitorio" && String(record.evaper || "").trim().endsWith("B"),
            color: "#dc2626"
        }
    ],
    parallelCharts: {
        areaByCrop: {
            id: "eva-area-cultivo",
            titleTemplate: "Área sembrada por tipo de cultivo en el {mpcategor} de {mpnombre}, {dpnombre}",
            xAxis: { label: "Área sembrada (ha)" },
            yAxis: { label: "Cultivo" },
            emptyMessage: "No hay datos válidos de area sembrada por tipo de cultivo para el municipio seleccionado.",
            series: {
                transitorio: {
                    label: "Transitorio",
                    color: "#B91C1C",
                    borderColor: "#991B1B"
                },
                permanente: {
                    label: "Permanente",
                    color: "#15803D",
                    borderColor: "#166534"
                }
            }
        },
        yieldByCrop: {
            id: "eva-rendimiento-cultivo",
            titleTemplate: "Rendimiento por tipo de cultivo en el {mpcategor} de {mpnombre}, {dpnombre}",
            xAxis: { label: "Rendimiento (t/ha)" },
            yAxis: { label: "Cultivo" },
            emptyMessage: "No hay datos válidos de rendimiento por tipo de cultivo para el municipio seleccionado.",
            series: {
                label: "Rendimiento (t/ha)",
                color: "#0F766E",
                borderColor: "#115E59"
            }
        }
    }
};

export const ECONOMIC_ACTIVITIES_BAR_CHART_CONFIG = {
    id: "actividades-económicas-bar",
    tabLabel: "Actividades económicas",
    type: "economicActivitiesBar",
    library: "chart.js",
    title: "Actividades económicas",
    titleTemplate: "Actividades económicas en el {mpcategor} de {mpnombre}, {dpnombre}",
    serviceUrl: ACTIVIDADES_ECONOMICAS_SERVICE_URL,
    layerUrl: ACTIVIDADES_ECONOMICAS_SERVICE_URL,
    url: ACTIVIDADES_ECONOMICAS_SERVICE_URL,
    fields: ["aetactividad", "porcentaje", "cdcobert", "mpcodigo", "mpnombre", "dpnombre", "dpcodigo", "mpcategor"],
    filterField: "mpcodigo",
    mapInteractionField: "aetactividad",
    mapInteraction: {
        preserveView: true,
        preserveLegendOnMapClick: true
    },
    colorsFromRenderer: true,
    labelsFromRenderer: true,
    xAxis: {
        field: "porcentaje",
        label: "Área (%)"
    },
    yAxis: {
        field: "aetactividad",
        label: "Actividad económica"
    },
    filter: {
        municipalityField: "mpcodigo",
        requiredLevel: "MUNI"
    },
    textSource: {
        url: DYNAMICS_TEXT_SERVICE_URL,
        filterField: "mpcodigo",
        fields: ["analisisae", "analisismin", "analisisciiu"],
        mergeStrategy: "fields_without_labels",
        emptyMessage: "La información descriptiva para este municipio se encuentra actualmente en proceso de actualización."
    }
};




export const CENSO_PECUARIO_MULTI_DOUGHNUT_CONFIG = {
    id: "censo-pecuario",
    type: "multi-series-doughnut",
    library: "chart.js",
    title: "Censo pecuario",
    serviceUrl: CENSO_PECUARIO_SERVICE_URL,
    colorsFromRenderer: true,
    labelsFromRenderer: true,
    useGlobalLegendOrder: false,
    mapInteractionField: "aetactividad",
    filter: {
        municipalityField: "mpcodigo",
        requiredLevel: "MUNI"
    },
    filterFields: {
        department: "dpcodigo",
        municipality: "mpcodigo"
    },
    titleFields: ["mpnombre", "dpnombre", "mpcodigo", "dpcodigo"],
    datasets: [
        { key: "departamento", label: "Departamento" },
        { key: "municipio", label: "Municipio" }
    ],
    groups: [
        { field: "totalporcinos", label: "Porcinos", color: "#7A4A21" },
        { field: "totalavestrasco", label: "Aves traspatio", color: "#C58A3A" },
        { field: "totalequinos", label: "Equinos", color: "#8C6239" },
        { field: "totalbovinos", label: "Bovinos", color: "#D6A85F" },
        { field: "totalbufalos", label: "Bufalos", color: "#5F3A24" },
        { field: "totalcaprino", label: "Caprinos", color: "#B66A2C" },
        { field: "totalovinos", label: "Ovinos", color: "#E2C08D" }
    ],
    textSource: {
        url: DYNAMICS_TEXT_SERVICE_URL,
        field: "analisiscpe",
        filterField: "mpcodigo"
    },
    subitems: [
        { id: "censo-pecuario", label: "Censo pecuario", type: "doughnut" },
        { id: "eva-censo-agricola", label: "Censo agrícola", type: "pie", chartConfig: EVA_PIE_CHART_CONFIG },
        { id: "actividades-económicas", label: "Actividades económicas", type: "economicActivitiesBar", chartConfig: ECONOMIC_ACTIVITIES_BAR_CHART_CONFIG },
        { id: "registro-pecuario", label: "Cantidad de animales y predios", type: "livestockBar" }
    ]
};

export const LIVESTOCK_CENSUS_BAR_CHART_CONFIG = {
    id: "censo-pecuario-barras",
    tabLabel: "Censo pecuario",

    type: "livestockCensusBar",
    library: "chart.js",

    title: "Registro pecuario",
    titleTemplate: "Registro pecuario en el {mpcategor} de {mpnombre}, {dpnombre}",

    serviceUrl: CENSO_PECUARIO_SERVICE_URL,
    layerUrl: CENSO_PECUARIO_SERVICE_URL,
    url: CENSO_PECUARIO_SERVICE_URL,

    sourcesFromVariants: false,
    filterField: "mpnombre",
    titleFields: ["mpnombre", "dpnombre", "mpcodigo", "dpcodigo"],

    filter: {
        municipalityField: "mpnombre",
        requiredLevel: "MUNI"
    },

    xAxis: {
        label: "Cantidad de animales y predios"
    },

    yAxis: {
        label: "Especies pecuarias"
    },

    textSource: {
        url: DYNAMICS_TEXT_SERVICE_URL,
        field: "analisiscpe",
        filterField: "mpcodigo",
        emptyMessage: "La información descriptiva del censo pecuario se encuentra en proceso de actualización."
    },

    groups: [
        { label: "Porcinos", animalsField: "totalporcinos", farmsField: "totalprediosporcinos" },
        { label: "Aves", animalsField: "totalavestrasco", farmsField: "totalpreave" },
        { label: "Bovinos", animalsField: "totalbovinos", farmsField: "totalprediosbovinos" },
        { label: "Búfalos", animalsField: "totalbufalos", farmsField: "totalprediosbufalos" }
    ]
    ,
    derivedCharts: {
        porcinos: {
            id: "producción-porcina",
            title: "Tipo de producción porcina",
            titleTemplate: "Tipo de producción en el {mpcategor} de {mpnombre}, {dpnombre}",
            xAxis: { label: "Categorías" },
            yAxis: { label: "Cantidad de animales y predios" },
            textSource: {
                url: DYNAMICS_TEXT_SERVICE_URL,
                field: "analisiscpe",
                filterField: "mpcodigo",
                emptyMessage: "La información descriptiva del censo pecuario se encuentra en proceso de actualización."
            },
            groups: [
                { label: "Porcinos traspatio", animalsField: "totalcerdostraspatio", farmsField: "totalprediostraspatio" },
                { label: "Comercial o familiar", animalsField: "totalporciccialfamiliar", farmsField: "totalprediosccialfamiliar" },
                { label: "Comercial e industrial", animalsField: "totalporciccialindustrial", farmsField: "totalprediosccialindustrial" },
                { label: "Producción tecnificada", animalsField: "totalporciptecni", farmsField: "totalgrantecni" }
            ]
        },
        aves: {
            id: "producción-avicola",
            title: "Tipo de producción avicola",
            titleTemplate: "Tipo de producción avicola en el {mpcategor} de {mpnombre}, {dpnombre}",
            xAxis: { label: "Categorías" },
            yAxis: { label: "Cantidad de animales y predios" },
            textSource: {
                url: DYNAMICS_TEXT_SERVICE_URL,
                field: "analisiscpe",
                filterField: "mpcodigo",
                emptyMessage: "La información descriptiva del censo pecuario se encuentra en proceso de actualización."
            },
            groups: [
                { label: "Aves traspatio", animalsField: "totalavestraspatio", farmsField: "totalprediosatraspatio" },
                { label: "Aves capacidad ocupada", animalsField: "totalavesco", farmsField: "totalprediosaves" }
            ]
        }
    }
};




const livestockSubitem = CENSO_PECUARIO_MULTI_DOUGHNUT_CONFIG.subitems
    .find(item => item.id === "registro-pecuario");
if (livestockSubitem) {
    livestockSubitem.chartConfig = LIVESTOCK_CENSUS_BAR_CHART_CONFIG;
}

export const GREEN_BUSINESS_FLOATING_BAR_CHART_CONFIG = {
    id: "negocios-verdes",
    tabLabel: "Negocios verdes",
    type: "greenBusinessFloatingBar",
    library: "chart.js",
    title: "Negocios verdes",
    titleTemplate: "Registro de negocios verdes en el {mpcategor} de {mpnombre}, {dpnombre}",
    serviceUrl: SUPPORT_INFRASTRUCTURE_TABLE_URL,
    layerUrl: SUPPORT_INFRASTRUCTURE_TABLE_URL,
    url: SUPPORT_INFRASTRUCTURE_TABLE_URL,
    filterField: "mpcodigo",
    filter: {
        municipalityField: "mpcodigo",
        requiredLevel: "MUNI"
    },
    titleFields: ["mpnombre", "dpnombre", "mpcodigo", "dpcodigo"],
    fields: ["categoria", "subsector"],
    excludeValues: ["No Aplica"],
    xAxis: {
        field: "subsector",
        label: "Subsector"
    },
    yAxis: {
        aggregation: "count",
        label: "Numero de registros"
    },
    series: {
        field: "categoria",
        label: "Categoría"
    },
    colorPalette: [
        "#2E7D32",
        "#0284C7",
        "#7C3AED",
        "#D97706"
    ],
    textSource: {
        url: DYNAMICS_TEXT_SERVICE_URL,
        filterField: "mpcodigo",
        fields: ["obsiat", "analisisiat"],
        mergeStrategy: "fields_without_labels",
        emptyMessage: "La información descriptiva sobre infraestructura de apoyo productivo se encuentra en proceso de actualización."
    },
    parallelCharts: {
        irrigationDistricts: {
            id: "distritos-riego",
            title: "Distritos de riego",
            titleTemplate: "Registro de Distritos de riego en el {mpcategor} de {mpnombre}, {dpnombre}",
            type: "horizontalBar",
            xAxis: {
                field: "nrofamilias",
                label: "Beneficiarios"
            },
            yAxis: {
                field: "nombredistrito",
                label: "Nombre del distrito de riego"
            },
            series: {
                field: "escaladistrito",
                label: "Escala del distrito"
            },
            fields: ["nombredistrito", "escaladistrito", "nrofamilias"],
            colorPalette: ["#2563EB", "#16A34A", "#F59E0B", "#7C3AED"],
            emptyMessage: "El municipio no registra información válida de distritos de riego."
        }
    }
};




export const DynamicsChartsConfig = [
    PIB_DEPARTMENTAL_BAR_CHART_CONFIG,
    PIB_VALUE_ADDED_PIE_CHART_CONFIG,
    PIB_CHART_VARIANTS,
    CENSO_PECUARIO_MULTI_DOUGHNUT_CONFIG,
    LIVESTOCK_CENSUS_BAR_CHART_CONFIG,
    GREEN_BUSINESS_FLOATING_BAR_CHART_CONFIG,
    EVA_PIE_CHART_CONFIG 
];

export const SOCIAL_DYNAMICS_CONFIG = [
    {
        id: 100,
        title: "PIB y Valor agregado",
        key: "PIB_DEPARTMENT",
        filterField: "mpcodigo",
        type: "feature-layer",
        chartConfig: PIB_DEPARTMENTAL_BAR_CHART_CONFIG,
        textSource: {
            url: DYNAMICS_TEXT_SERVICE_URL,
            field: "analisispib",
            filterField: "mpcodigo"
        },
        chartVariantKey: "PIB",
        variants: [
            ...PIB_CHART_VARIANTS
        ]
    },
    // {
    //     id: 102,
    //     title: "Actividades económicas",
    //     key: "ECONOMIC_ACTIVITIES",
    //     url: ACTIVIDADES_ECONOMICAS_SERVICE_URL,
    //     filterField: "mpcodigo",
    //     legendField: "aetactividad",
    //     type: "feature-layer",
    //     preserveMapView: true,
    //     chartConfig: CENSO_PECUARIO_MULTI_DOUGHNUT_CONFIG,
    //     textSource: {
    //         url: DYNAMICS_TEXT_SERVICE_URL,
    //         field: "analisiscpe",
    //         filterField: "mpcodigo"
    //     }
    // },

       {
        id: 102,
        title: "Actividades económicas",
        key: "ECONOMIC_ACTIVITIES",
        url: ACTIVIDADES_ECONOMICAS_SERVICE_URL,
        filterField: "mpcodigo",
        legendField: "aetactividad",
        type: "feature-layer",
        preserveMapView: false,
        prioritizeMapRendering: true,
        chartConfig: CENSO_PECUARIO_MULTI_DOUGHNUT_CONFIG  // Este ya incluye el nuevo subitem
    },
    {
        id: 104,
        title: "Turismo",
        key: "TOURISM",
        url: socioeconomicoLayerUrl(17),
        filterField: "mpcodigo",
        forceRendererLegend: true,
        onlyActiveRendererLegendItems: true,
        legendField: "tipologiatur",
        type: "feature-layer",
        chartConfig: TURISMO_INFRAESTRUCTURA_BAR_CHART_CONFIG,
        textSource: {
            url: DYNAMICS_TEXT_SERVICE_URL,
            filterField: "mpcodigo",
            fields: ["obsitr", "analisisitr"],
            mergeStrategy: "tourism_obs_then_analysis",
            emptyMessage: "La información descriptiva sobre turismo para este municipio se encuentra en proceso de actualización."
        }
    },
    {
        id: 103,
        title: "Infraestructuras de apoyo productivo",
        key: "SUPPORT_INFRASTRUCTURE",
        url: SUPPORT_INFRASTRUCTURE_TABLE_URL,
        filterField: "mpcodigo",
        forceRendererLegend: true,
        onlyActiveRendererLegendItems: true,
        legendField: "mpnoiap",
        type: "table-layer",
        subitems: [
            { id: "negocios-verdes", label: "Negocios verdes", type: "chart", chartConfig: GREEN_BUSINESS_FLOATING_BAR_CHART_CONFIG }
        ],
        mapFallback: {
            url: SUPPORT_INFRASTRUCTURE_MAP_URL,
            title: "Infraestructuras de apoyo productivo"
        },
        chartConfig: GREEN_BUSINESS_FLOATING_BAR_CHART_CONFIG,
        textSource: {
            url: DYNAMICS_TEXT_SERVICE_URL,
            filterField: "mpcodigo",
            fields: ["obsiat", "analisisiat"],
            mergeStrategy: "fields_without_labels",
            emptyMessage: "La información descriptiva sobre infraestructura de apoyo productivo se encuentra en proceso de actualización."
        }
    }
    
];
