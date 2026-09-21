export const expectedSeismicIntensityMap = {
    id: "sismica",
    group: "FENOMENOS",
    strategy: "single-layer",
    supports: config => config?.id === "sismica" || config?.id === "sismica_depto"
};
