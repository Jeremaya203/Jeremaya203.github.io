export const hypsometryMap = {
    id: "hipsometria",
    group: "RELIEVE",
    strategy: "single-layer",
    supports: config => config?.id === "hipsometria" || config?.id === "hipsometria_depto"
};
