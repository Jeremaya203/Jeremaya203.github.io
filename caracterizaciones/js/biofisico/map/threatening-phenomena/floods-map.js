export const floodsMap = {
    id: "inundaciones",
    group: "FENOMENOS",
    strategy: "single-layer",
    supports: config => config?.id === "inundaciones" || config?.id === "inundaciones_depto"
};
