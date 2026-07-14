import { socioeconomicoLayerUrl } from "../../services/serviceRoots.js?v=sigi-service-roots-20260604";
import { ECONOMIC_SECTOR_COLORS } from "./economicSectorColors.js?v=economic-sector-shared-colors-20260603";

const EMPRESAS_SERVICE_URL = socioeconomicoLayerUrl(43);
const EMPRESAS_TEXT_SERVICE_URL = socioeconomicoLayerUrl(44);

export const EMPRESAS_SECTOR_STACKED_BAR_CONFIG = {
    id: "empresas-sector",
    type: "stacked-horizontal-bar",
    library: "chart.js",
    title: "Registro de empresas por sector económico",
    serviceUrl: EMPRESAS_SERVICE_URL,
    groupBy: "ciiura",
    stackField: "ciiuse",
    aggregation: "count",
    filterFields: {
        department: "dpcodigo",
        municipality: "mpcodigo"
    },
    titleFields: ["mpnombre", "dpnombre", "mpcodigo", "dpcodigo"],
    xAxis: { label: "Cantidad de empresas" },
    yAxis: { label: "Rama actividad" },
    textSource: {
        url: EMPRESAS_TEXT_SERVICE_URL,
        field: "analisisdes",
        filterField: "mpcodigo"
    },
    sectors: [
        { key: "primarias", label: "Actividades primarias", color: ECONOMIC_SECTOR_COLORS.primarias },
        { key: "secundarias", label: "Actividades secundarias", color: ECONOMIC_SECTOR_COLORS.secundarias },
        { key: "terciarias", label: "Actividades terciarias", color: ECONOMIC_SECTOR_COLORS.terciarias }
    ]
};
