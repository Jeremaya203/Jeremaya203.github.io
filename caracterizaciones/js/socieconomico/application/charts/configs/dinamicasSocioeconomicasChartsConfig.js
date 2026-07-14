import { socioeconomicoLayerUrl } from "../../services/serviceRoots.js?v=sigi-service-roots-20260604";

const SE_ITR_URL = socioeconomicoLayerUrl(17);

export const TURISMO_INFRAESTRUCTURA_BAR_CHART_CONFIG = {
    id: "turismo-infraestructura",
    type: "bar",
    library: "chart.js",
    title: "Infraestructura turística",
    titleTemplate: "Cantidad de recursos y servicios turísticos en el {mpcategor} de {mpnombre}, {dpnombre}",
    serviceUrl: SE_ITR_URL,
    layerUrl: SE_ITR_URL,
    url: SE_ITR_URL,
    source: "SE_ITR",
    preserveViewOnPopup: true,
    allowDepartmentPopup: true,
    includeZeroCategories: true,
    fields: [
        "mpcodigo",
        "mpnombre",
        "dpnombre",
        "mpcategor",
        "dpcodigo",
        "tipologiatur",
        "mprtur",
        "mpstur"
    ],
    categoryFields: ["mprtur", "mpstur"],
    categoryLabels: {
        mprtur: "Recursos turísticos",
        mpstur: "Servicios turísticos"
    },
    categoryColors: {
        mprtur: "rgba(13, 148, 136, 0.92)",
        mpstur: "rgba(59, 130, 246, 0.9)"
    },
    xAxis: { field: "categoria", label: "Categorías" },
    yAxis: { field: "cantidad", label: "Numero de registros", decimals: 0 },
    filter: {
        municipalityField: "mpcodigo",
        requiredLevel: "MUNI"
    },
    typologiaField: "tipologiatur",
    emptyTypologiaTemplate: "Este {mpcategor} no registra datos sobre información turística.",
    subRequirementPanels: {
        mprtur: {
            side: "left",

            derivedChart: {
                id: "tourism-resources-doughnut",
                type: "doughnut",
                subtitle: "",
                titleTemplate: "Recursos turísticos en el {mpcategor} de {mpnombre}, {dpnombre}",
                emptyMessage: "El municipio seleccionado no registra subcategorías válidas de recursos turísticos.",
                fields: [
                    { name: "rtur1p", label: "Otros tipos de hospedaje turísticos no permanentes", color: "#0f766e" },
                    { name: "rtur2p", label: "Viviendas turísticas", color: "#0d9488" },
                    { name: "rtur3p", label: "Bares", color: "#14b8a6" },
                    { name: "rtur4p", label: "Establecimientos de gastronomia", color: "#06b6d4" },
                    { name: "rtur5p", label: "Establecimientos de gastronomia y similares", color: "#3b82f6" },
                    { name: "rtur6p", label: "Establecimientos de alojamiento turistico", color: "#6366f1" },
                    { name: "rtur7p", label: "Parques tematicos", color: "#8b5cf6" }
                ]
            }
        },
        mpstur: {
            side: "right",     
        
            derivedChart: {
                id: "tourism-services-doughnut",
                type: "doughnut",
                subtitle: "",
                titleTemplate: "Servicios turísticos en el {mpcategor} de {mpnombre}, {dpnombre}",
                emptyMessage: "El municipio seleccionado no registra subcategorías válidas de servicios turísticos.",
                fields: [
                    { name: "stur1p", label: "Empresas de tiempo compartido y multipropiedad", color: "#7c3aed" },
                    { name: "stur2p", label: "Organizadores de boda destino", color: "#8b5cf6" },
                    { name: "stur3p", label: "Operadores profesionales de congresos, ferias y convenciones", color: "#a855f7" },
                    { name: "stur4p", label: "Concesionarios de servicios turísticos en parque", color: "#c084fc" },
                    { name: "stur5p", label: "Empresas captadoras de ahorro para viajes", color: "#ec4899" },
                    { name: "stur6p", label: "Guias de turismo", color: "#f43f5e" },
                    { name: "stur7p", label: "Compañías de intercambio vacacional", color: "#ef4444" },
                    { name: "stur8p", label: "Arrendadores de vehiculos para turismo nacional e internacional", color: "#f97316" },
                    { name: "stur9p", label: "Usuarios industriales, operadores o desarrolladores de servicios turísticos de zonas francas", color: "#f59e0b" },
                    { name: "stur10p", label: "Agencias de viajes", color: "#84cc16" },
                    { name: "stur11p", label: "Operadores de plataformas electrónicas o digitales de servicios turísticos", color: "#22c55e" },
                    { name: "stur12p", label: "Oficinas de representación turística", color: "#10b981" },
                    { name: "stur13p", label: "Empresas de transporte terrestre automotor", color: "#06b6d4" }
                ]
            }
        }
    }
};
