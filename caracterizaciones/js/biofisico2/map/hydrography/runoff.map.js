export const runoffMap = {
    id: "escorrentia",
    group: "HIDROGRAFIA",
    strategy: "single-layer",
    supports: config => config?.id === "escorrentia" || config?.id === "escorrentia_depto"
};
