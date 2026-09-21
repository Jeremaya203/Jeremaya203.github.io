export const soilOrderMap = {
    id: "orden_suelo",
    group: "SUELOS",
    strategy: "single-layer",
    supports: config => config?.id === "orden_suelo" || config?.id === "orden_suelo_depto"
};
