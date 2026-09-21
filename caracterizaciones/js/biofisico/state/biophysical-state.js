import { AppState } from "../app/state.js";

export const BIOFISICO_STATE_KEYS = [
    "currentMode",
    "map",
    "view",
    "legendWidget",
    "layerGlobal",
    "layerViewGlobal",
    "layersGlobal",
    "chartLayerGlobal",
    "stationsLayer",
    "whereBase",
    "currentMunicipalityId",
    "currentDepartmentId",
    "territoryLevel",
    "currentSubLayerIndex",
    "chartInstance",
    "geoPieChartInstance",
    "geoDonutChartInstance",
    "municipalityNames",
    "departmentNames",
    "municipalities",
    "bf3LabelToCode",
    "landformRendererDictionary",
    "landformLandscapeDictionary",
    "landSuitabilityRendererDictionary",
    "landSuitabilityMainDictionary",
    "soilOrderColors",
    "renderCycleId",
    "scaleHandle",
    "highlightHandle",
    "lastHoverWhere",
    "legendFilterLabel",
    "sliderMode",
    "timeSliderPeriods",
    "timeSliderIndex",
    "timeSliderEnabled",
    "timeSliderTouched",
    "timeSliderContextKey",
    "activeDeforestationPeriod",
    "deforestationBasePeriods",
    "updateLegendByExtent"
];

export function syncBiofisicoStateFromLocals(localState) {
    for (const key of BIOFISICO_STATE_KEYS) {
        if (Object.prototype.hasOwnProperty.call(localState, key)) {
            AppState[key] = localState[key];
        }
    }

    return AppState;
}

export function readBiofisicoState(keys = BIOFISICO_STATE_KEYS) {
    const snapshot = {};
    for (const key of keys) {
        snapshot[key] = AppState[key];
    }
    return snapshot;
}

export function resetBiofisicoState() {
    AppState.currentMode = AppState.currentMode || "RELIEVE";
    AppState.currentSubLayerIndex = Number(AppState.currentSubLayerIndex) || 0;
    AppState.territoryLevel = AppState.territoryLevel || "";
    AppState.whereBase = AppState.whereBase || "";
    return AppState;
}
