export const precipitationChangeCcMap = {
    id: "cambio_precip",
    group: "CLIMA",
    strategy: "single-layer",
    supports: config => config?.id === "cambio_precip" || config?.id === "cambio_precip_depto"
};
