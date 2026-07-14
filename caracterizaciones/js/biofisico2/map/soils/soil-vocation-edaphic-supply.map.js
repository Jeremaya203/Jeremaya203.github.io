export const soilVocationEdaphicSupplyMap = {
    id: "vocacion",
    group: "SUELOS",
    strategy: "scale-variants",
    supports: config => config?.id === "vocacion" || config?.id === "vocacion_depto" || config?.id === "suelos_svo"
};
