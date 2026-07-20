import { socioeconomicoLayerUrl } from "../../services/serviceRoots.js?v=sigi-service-roots-20260604";

const SE_NPZ_URL = socioeconomicoLayerUrl(49);
const SE_SPS_URL = socioeconomicoLayerUrl(39);
const SE_ASC_URL = socioeconomicoLayerUrl(44);
const DICCIONARIO_GEO_FEATURE_SERVER = "https://mapas2.igac.gov.co/server/rest/services/diccionariogeografico/bnngNombresGeograficos/MapServer";
const DICCIONARIO_GEO_DEPARTMENT_SOCIAL_URL = `${DICCIONARIO_GEO_FEATURE_SERVER}/9`;
const DICCIONARIO_GEO_MUNICIPAL_SOCIAL_URL = `${DICCIONARIO_GEO_FEATURE_SERVER}/20`;
const DICCIONARIO_GEO_REF_DEPARTMENT_SOCIAL_URL = `${DICCIONARIO_GEO_FEATURE_SERVER}/30`;
const DICCIONARIO_GEO_REF_MUNICIPAL_SOCIAL_URL = `${DICCIONARIO_GEO_FEATURE_SERVER}/37`;

export const POVERTY_IPM_NBI_GROUPED_CONFIG = {
    id: "poverty-ipm-nbi-grouped",
    type: "groupedBar",
    library: "chart.js",
    title: "Mediciones multidimensionales de Pobreza (IPM y NBI)",
    titleTemplate: "Mediciones multidimensionales de Pobreza (IPM y NBI) para {entity} de {mpnombre}, {dpnombre}",
    serviceUrl: SE_NPZ_URL,
    url: SE_NPZ_URL,
    source: "SE_NPZ",
    legendDrivenByMapRenderer: true,
    dedupeLegendByLabel: true,
    legendHeading: "Nivel de pobreza (%)",
    mapOnlyOnDepartment: true,
    departmentMapMessage: "Seleccione un municipio para ver la información.",
    filter: {
        departmentField: "dpcodigo",
        municipalityField: "mpcodigo",
        valueSource: "code",
        requiredLevel: "MUNI"
    },
    pivot: {
        xSlots: [
            { ipmField: "seipm", nbiField: "senbi" },
            { ipmField: "seipmcb", nbiField: "senbicb" },
            { ipmField: "seipmcp", nbiField: "senbicp" }
        ],
        series: [
            { key: "ipm", valueFields: ["seipm", "seipmcb", "seipmcp"] },
            { key: "nbi", valueFields: ["senbi", "senbicb", "senbicp"] }
        ],
        requiredFields: [
            "seipm",
            "seipmcb",
            "seipmcp",
            "senbi",
            "senbicb",
            "senbicp",
            "mpcodigo",
            "mpnombre",
            "dpnombre",
            "mpcategor"
        ]
    },
    xAxis: { label: "Tipos de asentamiento" },
    yAxis: { label: "% de Hogares", decimals: 2, suffix: "%" },
    ySuggestedMax: 100
};

export const PUBLIC_SERVICES_RADAR_CHART_CONFIG = {
    id: "public-services-radar",
    type: "radar",
    library: "chart.js",
    title: "Servicios públicos",
    titleTemplateMunicipality: "Rangos de cobertura en servicios públicos de saneamiento básico del municipio de {mpnombre}, {dpnombre}",
    titleTemplateCapital: "Rangos de cobertura en servicios públicos de saneamiento básico de la ciudad de {mpnombre}, {dpnombre}",
    serviceUrl: SE_SPS_URL,
    url: SE_SPS_URL,
    layerUrl: SE_SPS_URL,
    layerId: 39,
    source: "SE_SPS",
    fields: [
        "mpcodigo",
        "dpcodigo",
        "mpnombre",
        "dpnombre",
        "mpcategor",
        "spsralcantarillado",
        "spsasentam",
        "spsracueducto",
        "spsraseo"
    ],
    requiredFields: {
        settlement: { name: "spsasentam", alias: "Asentamiento", type: "small-integer" },
        aqueduct: { name: "spsracueducto", alias: "Rango acueducto", type: "long" },
        sewer: { name: "spsralcantarillado", alias: "Rango alcantarillado", type: "long" },
        cleaning: { name: "spsraseo", alias: "Rango aseo", type: "long" }
    },
    axes: [
        { field: "spsracueducto", label: "Acueducto" },
        { field: "spsralcantarillado", label: "Alcantarillado" },
        { field: "spsraseo", label: "Aseo" }
    ],
    settlementField: "spsasentam",
    settlementLabels: {
        "14091": "Rural",
        "14092": "Urbano"
    },
    settlementChartColors: {
        "14091": "#2e7d32",
        "14092": "#ef8a0c"
    },
    settlementMapColors: {
        "14091": "#2e7d32",
        "14092": "#ef8a0c"
    },
    settlementMapStyles: {
        "14091": "diagonal-cross",
        "14092": "vertical"
    },
    mapLegendMode: "settlement",
    mapRenderer: {
        rangeField: "spsralcantarillado"
    },
    rangeLabels: {
        "1": "[0% - 15%]",
        "2": "[15%-30%]",
        "3": "[30%-45%]",
        "4": "[45%-60%]",
        "5": "[60%-75%]",
        "6": "[75%-90%]",
        "7": "[90%-100%]"
    },
    filter: {
        departmentField: "dpcodigo",
        municipalityField: "mpcodigo",
        valueSource: "code",
        requiredLevel: "MUNI"
    },
    colorsFromRenderer: true,
    labelsFromRenderer: true,
    mapInteractionField: "spsasentam",
    textSource: {
        url: SE_ASC_URL,
        fields: ["analisissps", "analisistelec"],
        filterField: "mpcodigo",
        mergeStrategy: "fields_without_labels",
        emptyMessage: "La información descriptiva para este municipio aún no se encuentra disponible. Actualmente la base de datos se encuentra en proceso de actualización y carga de información."
    },
    specialAreaMessage: "Para las áreas no municipalizadas de Amazonas, Guainia, Vaupes y el Área en Litigio Cauca - Huila no se genera este gráfico.",
    telecomCharts: {
        departmentServiceUrl: DICCIONARIO_GEO_DEPARTMENT_SOCIAL_URL,
        municipalityServiceUrl: DICCIONARIO_GEO_MUNICIPAL_SOCIAL_URL,
        departmentFallbackServiceUrls: [DICCIONARIO_GEO_REF_DEPARTMENT_SOCIAL_URL],
        municipalityFallbackServiceUrls: [DICCIONARIO_GEO_REF_MUNICIPAL_SOCIAL_URL],
        municipalityField: "divipola",
        departmentField: "divipola",
        requiredFields: [
            "divipola",
            "total_internet_fijo",
            "total_emisoras",
            "total_com_fm",
            "total_comunitarias_fm",
            "total_publico_fm",
            "total_com_am",
            "total_publico_am"
        ],
        doughnutTitleMunicipality: "Suscripciones a internet fijo del municipio de {mpnombre} y el departamento de {dpnombre}",
        doughnutTitleCapital: "Suscripciones a internet fijo de la ciudad de {mpnombre} y el departamento de {dpnombre}",
        radioTitleMunicipality: "Acceso a servicios de telecomunicaciones (radio) para el municipio de {mpnombre} en el departamento de {dpnombre}",
        radioTitleCapital: "Acceso a servicios de telecomunicaciones (radio) para la ciudad de {mpnombre} en el departamento de {dpnombre}"
    }
};
