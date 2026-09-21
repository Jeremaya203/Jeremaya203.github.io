export const temperatureMap = {
    id: "temperatura",
    group: "CLIMA",
    strategy: "single-layer-with-stations",
    supports: config => config?.id === "temperatura" || config?.id === "temperatura_depto"
};
