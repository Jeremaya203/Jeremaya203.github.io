export class LayerConfig {
    static layers = {
        DISTRIBUCION_POBLACION: [
            {
                id: "densidad_poblacion",
                title: "Densidad de población",
                url: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componenteocupacion/MapServer/11",
                outFields: ["tzn", "denpobha", "mpcodigo", "mpnombre", "dpcodigo", "dpnombre"],
                isDistribucion: true,
                labelField: "tzn",
                valueField: "denpobha",
                summaryTableUrl: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componenteocupacion/MapServer/25",
                summaryField: "dendesc"
            },
            {
                id: "concentracion_poblacion",
                title: "Concentración de la población",
                url: "https://mapas2.igac.gov.co/image2/rest/services/ot/OA_CPP_Nacional/ImageServer",
                municipalImageUrl: "https://mapas2.igac.gov.co/image2/rest/services/ot/OA_CPP_Municipios/ImageServer",
                isConcentracionPoblacion: true,
                summaryTableUrl: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componenteocupacion/MapServer/25",
                summaryFields: ["distesppob", "infrabio", "detcond"],
                roadLayerUrls: [
                    "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentesocioeconomico/MapServer/22",
                    "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentesocioeconomico/MapServer/23",
                    "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentesocioeconomico/MapServer/24"
                ]
            },
            {
                id: "estructura_piramides",
                title: "Estructura poblacional por pirámides",
                url: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componenteocupacion/MapServer/26",
                outFields: ["edad", "h1985", "m1985", "h1993", "m1993", "h2005", "m2005", "h2018", "m2018", "mpcodigo"],
                isPiramides: true,
                mapLayerUrl: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componenteocupacion/MapServer/11",
                summaryTableUrl: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componenteocupacion/MapServer/25",
                summaryField: "estrucpiram"
            },
            {
                id: "transicion_demografica",
                title: "Transición demográfica",
                url: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componenteocupacion/MapServer/26",
                outFields: ["eptrango", "h1985", "m1985", "h1993", "m1993", "h2005", "m2005", "h2018", "m2018", "mpcodigo"],
                isTransicion: true,
                mapLayerUrl: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componenteocupacion/MapServer/11",
                summaryTableUrl: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componenteocupacion/MapServer/25",
                summaryField: "compevolucion"
            }
        ],
        COMPOSICION_POBLACION: [
            {
                id: "estructura_poblacion",
                title: "Estructura población edad y área",
                url: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componenteocupacion/MapServer/15",
                mapLayerUrl: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componenteocupacion/MapServer/11",
                outFields: ["tzn", "nm", "nf", "jm", "jf", "am", "af", "amm", "amf", "mpcodigo", "mpnombre", "dpcodigo", "dpnombre"],
                isComposicion: true,
                summaryTableUrl: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componenteocupacion/MapServer/25",
                summaryFields: ["competar", "distrzona", "bregen"]
            },
            {
                id: "tasa_crecimiento",
                title: "Tasa de crecimiento intercensal",
                url: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componenteocupacion/MapServer/16",
                outFields: ["pt2018", "pt2005", "drci", "mpcodigo", "mpnombre", "dpcodigo", "dpnombre"],
                isTasaCrecimiento: true,
                summaryTableUrl: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componenteocupacion/MapServer/25",
                summaryField: "facpob"
            },
            {
                id: "migracion_externa",
                title: "Migración Externa",
                url: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componenteocupacion/MapServer/27",
                mapLayerUrl: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componenteocupacion/MapServer/16",
                outFields: ["zonatipo", "menonacido", "memimp", "meotmp", "meotps", "menoinf", "mpcodigo", "mpnombre", "dpcodigo", "dpnombre"],
                isMigracionExterna: true,
                summaryTableUrl: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componenteocupacion/MapServer/25",
                summaryFields: ["desctotalmg", "antotalmig"]
            },
            {
                id: "migracion_interna",
                title: "Migración Interna",
                url: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componenteocupacion/MapServer/28",
                mapLayerUrl: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componenteocupacion/MapServer/16",
                outFields: ["migcbacb", "migcbacp", "migcbard", "migcpacp", "migcpacb", "migcpard", "migrdard", "migrdacb", "migrdacp", "mpcodigo", "mpnombre", "dpcodigo", "dpnombre"],
                isMigracionInterna: true,
                summaryTableUrl: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componenteocupacion/MapServer/25",
                summaryField: "miganzon"
            },
            {
                id: "autoreconocimiento_etnico",
                title: "Autoreconocimiento étnico",
                url: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componenteocupacion/MapServer/17",
                outFields: ["pobtet", "pobindig", "pobnmaa", "pobgt", "pobrz", "pobpq", "mpcodigo", "mpnombre", "dpcodigo", "dpnombre"],
                isAutoreconocimientoEtnico: true,
                labelField: "pobtet",
                summaryTableUrl: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componenteocupacion/MapServer/25",
                summaryFields: ["rnetntercol", "divetn"]
            },
            {
                id: "condiciones_seguridad",
                title: "Condiciones de seguridad",
                url: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componenteocupacion/MapServer/18",
                outFields: ["clasisus", "indhv", "puntgai", "indcoca", "indcorredores", "indmina", "mpcodigo", "mpnombre", "dpcodigo", "dpnombre"],
                isCondicionesSeguridad: true,
                labelField: "clasisus",
                summaryTableUrl: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componenteocupacion/MapServer/25",
                summaryField: "descisus"
            }
        ],
        TAMANO_DISTRIBUCION_PROPIEDAD: [
            {
                id: "propiedad_rural",
                title: "Tamaño y distribución rural",
                url: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componenteocupacion/MapServer/24",
                outFields: ["tprpesp", "mpcodigo", "mpnombre", "dpnombre"],
                isPropiedadRural: true,
                summaryTableUrl: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componenteocupacion/MapServer/25",
                summaryField: "icmanalisis"
            },
            {
                id: "indices_complementarios",
                title: "Índices complementarios",
                url: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componenteocupacion/MapServer/21",
                outFields: ["icmgini", "icmtheil", "icmdispsup", "icmdispinf", "icminformal", "icminformalporc", "mpcodigo", "mpnombre", "dpcodigo", "dpnombre"],
                isIndicesComplementarios: true,
                summaryTableUrl: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componenteocupacion/MapServer/25",
                summaryField: "icmanalisis"
            }
        ],
        CONTEXTO_HISTORICO: [
            {
                id: "contexto_historico",
                title: "Periodo",
                url: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componenteocupacion/MapServer/6",
                outFields: ["*"],
                isContextoHistorico: true,
                summaryTableUrl: "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componenteocupacion/MapServer/29"
            }
        ]
    };

    static listForMode(mode) {
        return this.layers[mode] || [];
    }
}
