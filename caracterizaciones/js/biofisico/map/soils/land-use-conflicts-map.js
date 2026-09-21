export const landUseConflictsMap = {
    id: "conflictos",
    group: "SUELOS",
    strategy: "scale-variants",
    supports: config => config?.id === "conflictos" || config?.id === "conflictos_depto"
};
