export function createLayerSelectors({
    state,
    layersConfig,
    deptoOnlyLayerIds,
    deptToMuniLayerId,
    getLayerListForCurrentLevelBase,
    clampSubLayerIndexBase,
    ensureMunicipalLayerIndexBase,
    getActiveLayerConfigBase
}) {
    function getLayerListForCurrentLevel(mode = state.get("currentMode")) {
        return getLayerListForCurrentLevelBase({
            layersConfig,
            deptoOnlyLayerIds,
            filtroNivel: state.get("filtroNivel"),
            mode
        });
    }

    function clampSubLayerIndex() {
        state.set("currentSubLayerIndex", clampSubLayerIndexBase({
            getList: () => getLayerListForCurrentLevel(state.get("currentMode")),
            currentSubLayerIndex: state.get("currentSubLayerIndex")
        }));
    }

    function ensureMunicipalLayerIndex(prevId) {
        state.set("currentSubLayerIndex", ensureMunicipalLayerIndexBase({
            prevId,
            getList: () => getLayerListForCurrentLevel(state.get("currentMode")),
            currentSubLayerIndex: state.get("currentSubLayerIndex"),
            deptToMuniLayerId,
            deptoOnlyLayerIds
        }));
    }

    function getActiveLayerConfig() {
        return getActiveLayerConfigBase({
            getList: () => getLayerListForCurrentLevel(state.get("currentMode")),
            currentSubLayerIndex: state.get("currentSubLayerIndex")
        });
    }

    return {
        getLayerListForCurrentLevel,
        clampSubLayerIndex,
        ensureMunicipalLayerIndex,
        getActiveLayerConfig
    };
}
