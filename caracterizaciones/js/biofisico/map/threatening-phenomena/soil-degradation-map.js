export const soilDegradationMap = {
    id: "degradacion",
    group: "FENOMENOS",
    strategy: "single-layer",
    supports: config => config?.id === "degradacion" || config?.id === "degradacion_depto"
};
