export function getLayerListForCurrentLevel({ layersConfig, deptoOnlyLayerIds, filtroNivel, mode }) {
    const list = layersConfig[mode] || [];

    if (filtroNivel === "DEPTO") {
        return list.filter(layer => deptoOnlyLayerIds.has(layer.id));
    }

    if (filtroNivel === "MUNI") {
        return list.filter(layer => !deptoOnlyLayerIds.has(layer.id));
    }

    return list.filter(layer => !deptoOnlyLayerIds.has(layer.id));
}

export function clampSubLayerIndex({ getList, currentSubLayerIndex }) {
    const activeList = getList();

    if (!activeList.length) return 0;
    if (currentSubLayerIndex < 0) return 0;
    if (currentSubLayerIndex >= activeList.length) return 0;

    return currentSubLayerIndex;
}

export function ensureMunicipalLayerIndex({
    prevId,
    getList,
    currentSubLayerIndex,
    deptToMuniLayerId,
    deptoOnlyLayerIds
}) {
    const list = getList();

    if (!list || list.length === 0) return 0;

    let nextIndex = currentSubLayerIndex;
    if (nextIndex < 0 || nextIndex >= list.length) nextIndex = 0;

    const mappedId = prevId ? deptToMuniLayerId[prevId] : null;
    if (mappedId) {
        const idx = list.findIndex(layer => layer.id === mappedId);
        if (idx !== -1) return idx;
    }

    const cfg = list[nextIndex];
    if (cfg && deptoOnlyLayerIds.has(cfg.id)) return 0;

    return nextIndex;
}

export function getActiveLayerConfig({ getList, currentSubLayerIndex }) {
    const list = getList();
    return (list && list[currentSubLayerIndex]) ? list[currentSubLayerIndex] : null;
}

export function destroyLayerSafe(layer) {
    try {
        layer?.destroy?.();
    } catch (e) {}
}
