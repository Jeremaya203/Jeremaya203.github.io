export const massRemovalHazardMap = {
    id: "remocion",
    group: "FENOMENOS",
    strategy: "single-layer",
    supports: config => config?.id === "remocion" || config?.id === "remocion_depto"
};
