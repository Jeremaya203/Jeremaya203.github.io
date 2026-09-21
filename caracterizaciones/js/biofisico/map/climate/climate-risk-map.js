export const climateRiskMap = {
    id: "riesgo_cc",
    group: "CLIMA",
    strategy: "single-layer",
    supports: config => config?.id === "riesgo_cc" || config?.id === "riesgo_cc_depto"
};
