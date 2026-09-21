export const precipitationMap = {
    id: "precipitacion",
    group: "CLIMA",
    strategy: "single-layer-with-stations",
    supports: config => config?.id === "precipitacion" || config?.id === "precipitacion_depto"
};
