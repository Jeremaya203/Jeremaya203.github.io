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
        normativaTableUrl: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentepot/MapServer/1",
        normativaJoinField: "mpcodigo",
        normativaTypeField: "cstiposuelo",
        normativaSpecificTextField: "csarticulo"
    },



    CLASIFICACION_SUELO: {
        id: "clasificacion_suelo",
        title: "Clasificación del suelo",
        url: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentepot/MapServer/4",
        mapServerUrl: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentepot/MapServer",
        mapServerLayerId: 4,
        outFields: [
            "objectid",
            "mp_codigo",
            "mpnombre",
            "tipo_clasificacion_suelo",
            "csarea",
            "ruleid"
        ],
        filterField: "mp_codigo",
        areaField: "csarea",
        typeField: "tipo_clasificacion_suelo",
        isOrdenamiento: true,
        ordenamientoType: "clasificacion_suelo",
        chartTypes: {
            main: "doughnut"
        },
        normativaTableUrl: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentepot/MapServer/1",
        normativaJoinField: "mpcodigo",
        normativaTypeField: "cstiposuelo",
        normativaSpecificTextField: "csarticulo"
    },

    AREAS_ACTIVIDAD: {
        id: "areas_actividad",
        title: "Áreas de actividad",
        url: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentepot/MapServer/3",

        outFields: [
            "objectid",
            "mp_codigo",
            "mpnombre",
            "uso_principal",
            "detalle_uso_principal",
            "aactarea",
            "ruleid"
        ],

        filterField: "mp_codigo",
        areaField: "aactarea",
        useField: "uso_principal",
        rendererField: "ruleid",

        ordenamientoType: "areas_actividad",

        // TABLA NORMATIVA
        normativaTableUrl: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentepot/MapServer/0",
        normativaJoinField: "mpcodigo",
        normativaUseField: "zuusoprincipal",
        normativaGeneralTextField: "zuarticulo",
        normativaSpecificTextField: "upriarticulo"
    },

    ZONIFICACION_RURAL: {
        id: "zonificacion_rural",
        title: "Zonificación del suelo rural",
        url: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentepot/MapServer/5",
        outFields: [
            "objectid",
            "tipo_categoria_rural",
            "uso_principal",
            "detalle_uso_principal",
            "usoarea",
            "mp_codigo",
            "mpnombre",
            "ruleid"
        ],
        filterField: "mp_codigo",
        areaField: "usoarea",
        areaFallbackField: "st_area(shape)",
        categoryField: "tipo_categoria_rural",
        useField: "uso_principal",
        rendererField: "ruleid",
        isOrdenamiento: true,
        ordenamientoType: "zonificacion_rural",
        chartTypes: {
            main: "doughnut",
            secondary: "doughnut"
        },
        normativaTableUrl: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentepot/MapServer/2"
    }
};

