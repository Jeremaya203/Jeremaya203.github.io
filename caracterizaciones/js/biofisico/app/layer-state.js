import { AppState } from "./state.js";
import {
    LAYERS_CONFIG,
    DEPARTMENT_ONLY_LAYER_IDS
} from "../config.js";

export function getLayerListForCurrentLevel(mode = AppState.currentMode) {
    const list = LAYERS_CONFIG[mode] || [];

    if (AppState.territoryLevel === "DEPTO") {
        const departmentLayers = list.filter(l => DEPARTMENT_ONLY_LAYER_IDS.has(l.id));
        if (departmentLayers.length) return departmentLayers;
        return list.filter(l => !DEPARTMENT_ONLY_LAYER_IDS.has(l.id));
    }

    if (AppState.territoryLevel === "MUNI") {
        return list.filter(l => !DEPARTMENT_ONLY_LAYER_IDS.has(l.id));
    }

    return list.filter(l => !DEPARTMENT_ONLY_LAYER_IDS.has(l.id));
}

export function getActiveLayerConfig() {
    const list = getLayerListForCurrentLevel(AppState.currentMode);
    return list?.[AppState.currentSubLayerIndex] || null;
}
