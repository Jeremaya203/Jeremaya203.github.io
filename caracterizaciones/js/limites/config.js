export const LIMITES_CONFIG = {
    
    MUNICIPIOS: {
        id: "limites_municipios",
        title: "Líneas limítrofes",
        url: "https://mapas2.igac.gov.co/server/rest/services/limites/limites/MapServer/0",
        outFields: [
            "OBJECTID",
            "LLIdentif",
            "LLNombre",
            "LLJerarqui",
            "LLNorma",
            "Fecha",
            "LLEscala",
            "LLEstado",
            "SHAPE_Length"
        ],
        filterField: "LLIdentif",
        
        nameField: "LLNombre",
        lengthField: "SHAPE_Length",
        labelField: "LLNombre",
        valueField: "SHAPE_Length",
        relationTableUrl: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentelineaslimitrofes/MapServer/3",
        relationLayerField: "LLIdentif",
        relationTableField: "llid",
        relationTextField: "lldesclim"
    },

    DEPARTAMENTOS: {
        id: "limites_departamentos",
        title: "Departamentos",
        url: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentelineaslimitrofes/MapServer/0",
        outFields: [
            "objectid",
            "dpcodigo",
            "dpnombre",
            "dparea",
            "dpnorma",
            "fuente"
        ],
        filterField: "dpcodigo",
        fixedWhere: "dpcodigo <> '00'",
        nameField: "dpnombre",
        labelField: "dpnombre",
        valueField: "dparea",
        areaField: "dparea",
        areaUnit: "ha",
        normaField: "dpnorma",
        sourceField: "fuente"
    }
};
