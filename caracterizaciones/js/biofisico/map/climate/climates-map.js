export const climatesMap = {
    id: "climas",
    group: "CLIMA",
    strategy: "single-layer",
    supports: config => config?.id === "climas" || config?.id === "climas_depto"
};
