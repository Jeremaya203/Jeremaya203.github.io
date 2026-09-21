import { AppState } from "../../app/state.js?v=vigencia-section-20260623";

export function setLandUsePlanningTab(target) {
    AppState.currentMainModule = "ORDENAMIENTO";

    if (target === "Vigencia") {
        AppState.currentLandUsePlanningTab = "VIGENCIA";
    } else if (target === "Clasificación del suelo") {
        AppState.currentLandUsePlanningTab = "CLASIFICACION_SUELO";
    } else if (target === "Áreas de actividad") {
        AppState.currentLandUsePlanningTab = "AREAS_ACTIVIDAD";
    } else if (target === "Zonificación de uso del suelo rural") {
        AppState.currentLandUsePlanningTab = "ZONIFICACION_RURAL";
        AppState.currentRuralChartView = "CATEGORIA";
    }

    return AppState.currentLandUsePlanningTab;
}
