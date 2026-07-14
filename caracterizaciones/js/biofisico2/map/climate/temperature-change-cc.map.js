export const temperatureChangeCcMap = {
    id: "cambio_temp",
    group: "CLIMA",
    strategy: "single-layer",
    supports: config => config?.id === "cambio_temp" || config?.id === "cambio_temp_depto"
};
