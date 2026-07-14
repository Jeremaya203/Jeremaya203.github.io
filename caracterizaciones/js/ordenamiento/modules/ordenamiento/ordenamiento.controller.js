import { AppState } from "../../app/state.js?v=vigencia-section-20260623";

export function setOrdenamientoTab(target) {
    AppState.currentMainModule = "ORDENAMIENTO";

    if (target === "Vigencia") {
        AppState.currentOrdenamientoTab = "VIGENCIA";
    } else if (target === "Clasificación del suelo") {
        AppState.currentOrdenamientoTab = "CLASIFICACION_SUELO";
    } else if (target === "Áreas de actividad") {
        AppState.currentOrdenamientoTab = "AREAS_ACTIVIDAD";
    } else if (target === "Zonificación de uso del suelo rural") {
        AppState.currentOrdenamientoTab = "ZONIFICACION_RURAL";
        AppState.currentRuralChartView = "CATEGORIA";
    }

    return AppState.currentOrdenamientoTab;
}
