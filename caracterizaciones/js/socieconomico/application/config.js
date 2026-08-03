import {
    CONECTIVIDAD_TERRESTRE_BAR_CHART_CONFIG,
    TIEMPOS_DESPLAZAMIENTO_PIE_CHART_CONFIG,
    INSTITUCIONES_EDUCACION_BAR_CHART_CONFIG,
    SALUD_BAR_CHART_CONFIG,
    EQUIPAMIENTOS_DUAL_CHART_CONFIG
} from "./charts/configs/infraestructuraChartsConfig.js?v=travel-municipality-scope-20260721";
import {
    POVERTY_IPM_NBI_GROUPED_CONFIG,
    PUBLIC_SERVICES_RADAR_CHART_CONFIG
} from "./charts/configs/condicionesChartsConfig.js?v=telecom-diccionario-url-20260707";
import { socioeconomicoLayerUrl } from "./services/serviceRoots.js?v=sigi-service-roots-20260604";

import {
    SOCIAL_DYNAMICS_CONFIG
} from "./charts/configs/dynamicsChartsConfig.js?v=livestock-summary-textsource-20260604";

export const LAYERS_CONFIG = {

    SOCIOECONOMIC: [
        {
            id: 1,
            title: "Dinámicas socioeconómicas",
            key: "DYNAMICS"
        },
        {
            id: 2,
            title: "Infraestructura",
            key: "INFRASTRUCTURE"
        },
        {
            id: 3,
            title: "Condiciones socioeconómicas",
            key: "CONDITIONS"
        },
        {
            id: 4,
            title: "Presiones socioeconómicas",
            key: "PRESSURES"
        }
    ],

    SOCIOECONOMIC_SOCIAL_DYNAMICS: SOCIAL_DYNAMICS_CONFIG,

    SOCIOECONOMIC_INFRASTRUCTURE: [
        {
            id: 200,
            title: "Conectividad",
            key: "CONNECTIVITY",

            filterField: "mpcodigo",
            type: "feature-layer",
            chartConfig: CONECTIVIDAD_TERRESTRE_BAR_CHART_CONFIG,
            textSource: {
                url: socioeconomicoLayerUrl(44),
                fields: ["introacces", "analisiscobvias"],
                filterField: "mpcodigo",
                mergeStrategy: "fields_without_labels"
            },

            variants: [
                {
                    key: "red_vial",
                    url: socioeconomicoLayerUrl(22),
                    minScale: 0,
                    maxScale: 0
                },
                {
                    key: "red_departamental",
                    url: socioeconomicoLayerUrl(23),
                    minScale: 0,
                    maxScale: 0
                },
                {
                    key: "otras_vias",
                    url: socioeconomicoLayerUrl(24),
                    minScale: 0,
                    maxScale: 0
                },
                {
                    key: "red_ferrea",
                    url: socioeconomicoLayerUrl(25),
                    minScale: 0,
                    maxScale: 0
                },
                {
                    key: "red_fluvial",
                    url: socioeconomicoLayerUrl(26),
                    minScale: 0,
                    maxScale: 0
                },
                {
                    key: "infraestructura_complementaria",
                    url: socioeconomicoLayerUrl(20),
                    minScale: 0,
                    maxScale: 0
                }
            ]
        },

        {
            id: 201,
            title: "Tiempos de desplazamiento",
            key: "TRAVEL_TIME",
            keepDepartmentMapOnMunicipality: true,
            filterField: "mpcodigo",
            type: "feature-layer",
            chartConfig: TIEMPOS_DESPLAZAMIENTO_PIE_CHART_CONFIG,
            textSource: {
                url: socioeconomicoLayerUrl(44),
                fields: ["analisisreginfra", "conectrecia", "analisistdesp"],
                filterField: "mpcodigo",
                mergeStrategy: "fields_without_labels"
            },
            url: socioeconomicoLayerUrl(27),
        },
        {
            id: 202,
            title: "Instituciones de educación",
            key: "EDUCATION",
            keepDepartmentMapOnMunicipality: true,
            url: socioeconomicoLayerUrl(28),
        },
        {
            id: 203,
            title: "Salud",
            key: "HEALTH",
            keepDepartmentMapOnMunicipality: true,
            filterField: "mpcodigo",
            type: "feature-layer",
            chartConfig: {
                ...SALUD_BAR_CHART_CONFIG,
                useServiceRendererLegend: true
            },
            mapLayerUrl: socioeconomicoLayerUrl(31),
            mapLayerLegendHeading: "Naturaleza del servicio de salud",
            mapLayerLegendOrder: 2,
            mapLayerDrawOrder: 1,
            supplementaryMapLayers: [
                {
                    url: socioeconomicoLayerUrl(32),
                    title: "Prestadores de servicios de salud",
                    legendHeading: "Prestadores de servicios de salud",
                    legendOrder: 1,
                    drawOrder: 2
                }
            ],
            forceRendererLegend: true,
            onlyActiveRendererLegendItems: true,
            useMultilayerLegendSections: true,
            textSource: {
                url: socioeconomicoLayerUrl(44),
                field: "analisissld",
                filterField: "mpcodigo",
                emptyMessage: "La información descriptiva para este municipio aún no se encuentra disponible. Actualmente la base de datos se encuentra en proceso de actualización y carga de información."
            },
            url: socioeconomicoLayerUrl(32),
        },
        {
            id: 204,
            title: "Equipamientos",
            key: "FACILITIES",
            keepDepartmentMapOnMunicipality: true,
            filterField: "mpcodigo",
            type: "table-layer",
            chartConfig: EQUIPAMIENTOS_DUAL_CHART_CONFIG,
            textSource: EQUIPAMIENTOS_DUAL_CHART_CONFIG.textSource,
            mapFallback: {
                url: socioeconomicoLayerUrl(32),
                title: "Salud"
            },
            url: socioeconomicoLayerUrl(48),
        }
    ],

SOCIOECONOMIC_CONDITIONS: [
        {
            id: 300,
            title: "Nivel de pobreza",
            key: "POVERTY_LEVEL",
            url: socioeconomicoLayerUrl(49),
            mapLayerUrl: socioeconomicoLayerUrl(36),
            mapLayerLegendHeading: "Índice de pobreza multidimensional",
            supplementaryMapLayers: [
                {
                    url: socioeconomicoLayerUrl(34),
                    legendHeading: "Nivel de pobreza (34)"
                },
                {
                    url: socioeconomicoLayerUrl(35),
                    legendHeading: "Necesidades básicas insatisfechas"
                }
            ],
            filterField: "mpcodigo",
            type: "feature-layer",
            chartConfig: POVERTY_IPM_NBI_GROUPED_CONFIG,
            forceRendererLegend: true,
            onlyActiveRendererLegendItems: true,
            textSource: {
                url: socioeconomicoLayerUrl(44),
                fields: ["introconse", "sintesisnpz", "indicescontexto"],
                filterField: "mpcodigo",
                departmentFilterField: "dpcodigo",
                mergeStrategy: "fields_without_labels",
                emptyMessage: "El análisis de los indicadores IPM y NBI para este municipio se encuentra en proceso de actualización."
            }
        },
        {
            id: 301,
            title: "Servicios públicos",
            key: "PUBLIC_SERVICES",
            keepDepartmentMapOnMunicipality: true,
            variants: [
                {
                    key: "acueducto",
                    url: socioeconomicoLayerUrl(38),
                    minScale: 0,
                    maxScale: 0
                },
                {
                    key: "alcantarillado",
                    url: socioeconomicoLayerUrl(39),
                    minScale: 0,
                    maxScale: 0
                },
                {
                    key: "energia",
                    url: socioeconomicoLayerUrl(40),
                    minScale: 0,
                    maxScale: 0
                }
            ]

        }],


   RELIEVE: [
        {
            id: 'hipsometria',
            title: 'Hipsometría',
            url: 'https://mapas2.igac.gov.co/server/rest/services/ordenamiento/componentebiofisico/MapServer/6',
            outFields: ["rangoh", "porcentaje"],
            labelField: "rangoh",
            valueField: "porcentaje",
            isGeoforma: false,
            summaryField: 'hps'
        },
        
    ]}
    

export const ORDENAMIENTO_CONFIG = {
    CLASIFICACION_SUELO: {
        id: "clasificacion_suelo",
        title: "Clasificación del suelo",
        url: "https://mapas2.igac.gov.co/server/rest/services/ordenamiento/clasificacionsuelopot/FeatureServer/1",
        outFields: [
            "OBJECTID",
            "mpcodigo",
            "mpnombre",
            "dpnombre",
            "Tipo_Clasificacion_Suelo",
            "CSArea"
        ],
        filterField: "mpcodigo",
        areaField: "CSArea",
        typeField: "Tipo_Clasificacion_Suelo",
        isOrdenamiento: true,
        ordenamientoType: "clasificacion_suelo",
        chartTypes: {
            main: "doughnut"
        },
        normativaTableUrl: "https://mapas2.igac.gov.co/server4/rest/services/ordenamiento/componentepot/MapServer/1",
        normativaJoinField: "mpcodigo",
        normativaTypeField: "cstiposuelo",
        normativaSpecificTextField: "csarticulo"
    },

    AREAS_ACTIVIDAD: {
        id: "areas_actividad",
        title: "Áreas de actividad",
        url: "https://mapas2.igac.gov.co/server/rest/services/ordenamiento/areasdeactividad/MapServer/0",

        outFields: [
            "OBJECTID",
            "Mp_Codigo",
            "MpNombre",
            "Uso_Principal",
            "Detalle_Uso_Principal",
            "AActArea"
        ],

        filterField: "Mp_Codigo",
        areaField: "AActArea",
        useField: "Uso_Principal",

        ordenamientoType: "areas_actividad",

        // TABLA NORMATIVA
        normativaTableUrl: "https://mapas2.igac.gov.co/server4/rest/services/ordenamiento/componentepot/MapServer/0",
        normativaJoinField: "mpcodigo",
        normativaUseField: "zuusoprincipal",
        normativaGeneralTextField: "zuarticulo",
        normativaSpecificTextField: "upriarticulo"
    },

    ZONIFICACION_RURAL: {
        id: "zonificacion_rural",
        title: "Zonificación del suelo rural",
        url: "https://mapas2.igac.gov.co/server/rest/services/ordenamiento/zonificacionsuelorural/FeatureServer/0",
        outFields: [
            "OBJECTID",
            "Tipo_Categoria_Rural",
            "Uso_Principal",
            "Detalle_Uso_Principal",
            "UsoArea",
            "Mp_Codigo",
            "MpNombre",
            "RuleID"
        ],
        filterField: "Mp_Codigo",
        areaField: "UsoArea",
        categoryField: "Tipo_Categoria_Rural",
        useField: "Uso_Principal",
        rendererField: "RuleID",
        isOrdenamiento: true,
        ordenamientoType: "zonificacion_rural",
        chartTypes: {
            main: "doughnut",
            secondary: "doughnut"
        },
        normativaTableUrl: "https://mapas2.igac.gov.co/server4/rest/services/ordenamiento/componentepot/MapServer/2"
    }
};


export const DEPTO_ONLY_LAYER_IDS = new Set([
    "hipsometria_depto",
    "bf3_geoformas",
    "temperatura_depto",
    "precipitacion_depto",
    "cambio_precip_depto",
    "cambio_temp_depto",
    "riesgo_cc_depto",
    "inundaciones_depto",
    "degradacion_depto",
    "sismica_depto",
    "remocion_depto" ,
    "orden_suelo_depto",
    "conflictos_depto",
    "vocacion_depto",
    "cuencas_depto",
    "ecosistemas_depto",
    "suelos_svo",
    "climas_depto",
    "escorrentia_depto",
    "bosque_depto",
]);

export const DEPT_TO_MUNI_LAYER_ID = {
    hipsometria_depto: "hipsometria",
    bf3_geoformas: "geoformas",
    temperatura_depto: "temperatura",
    precipitacion_depto: "precipitacion",
    cambio_temp_depto: "cambio_temp",
    cambio_precip_depto: "cambio_precip",
    riesgo_cc_depto: "riesgo_cc",
    inundaciones_depto: "inundaciones",
    degradacion_depto: "degradacion",
    sismica_depto: "sismica" ,
    remocion_depto: "remocion" ,
    conflictos_depto: "conflictos",
    cuencas_depto: "cuencas",
    ecosistemas_depto: "ecosistemas",
    suelos_svo: "vocacion",
    climas_depto: "climas",
    escorrentia_depto: "escorrentia",
    bosque_depto: "bosque", 
            
};
