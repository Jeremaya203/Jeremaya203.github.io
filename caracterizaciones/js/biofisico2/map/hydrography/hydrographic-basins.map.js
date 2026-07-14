export const hydrographicBasinsMap = {
    id: "cuencas",
    group: "HIDROGRAFIA",
    strategy: "scale-variants",
    supports: config => config?.id === "cuencas" || config?.id === "cuencas_depto"
};
