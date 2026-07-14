export const MUNICIPIOS_SOURCE_LAYER_URL = "https://mapas2.igac.gov.co/server/rest/services/ordenamiento/componentebiofisico/MapServer/6";


export const ORDENAMIENTO_CONFIG = {

        VIGENCIA: {
        id: "vigencia",
        title: "Vigencia",
        url: "https://mapas2.igac.gov.co/server/rest/services/ordenamiento/datosnacionalespot/MapServer/0",
        mapServerLayerId: 0,
        outFields: [
            "OBJECTID",
            "MDANMCodig",
            "PotTipo",
            "Vigencia",
            "AprobacionAño"
        ],

        filterField: "MDANMCodig",
        typeField: "PotTipo",
        statusField: "Vigencia",
        isOrdenamiento: true,
        ordenamientoType: "vigencia",
        chartTypes: {
            main: "doughnut"
        },
        normativaTableUrl: "https://mapas2.igac.gov.co/server4/rest/services/ordenamiento/componentepot/MapServer/1",
        normativaJoinField: "mpcodigo",
        normativaTypeField: "cstiposuelo",
        normativaSpecificTextField: "csarticulo"
    },



    CLASIFICACION_SUELO: {
        id: "clasificacion_suelo",
        title: "Clasificación del suelo",
        url: "https://mapas2.igac.gov.co/server/rest/services/ordenamiento/clasificacionsuelopot/FeatureServer/1",
        mapServerUrl: "https://mapas2.igac.gov.co/server/rest/services/ordenamiento/clasificacionsuelopot/MapServer",
        mapServerLayerId: 1,
        outFields: [
            "OBJECTID",
            "Mp_Codigo",
            "MpNombre",
            "Tipo_Clasificacion_Suelo",
            "CSArea"
        ],
        filterField: "Mp_Codigo",
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
        url: "https://mapas2.igac.gov.co/server/rest/services/ordenamiento/areasdeactividad/FeatureServer/0",

        outFields: [
            "OBJECTID",
            "Mp_Codigo",
            "MpNombre",
            "Uso_Principal",
            "Detalle_Uso_Principal",
            "AActArea",
            "RuleID"
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

