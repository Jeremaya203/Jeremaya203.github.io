export const MUNICIPALITY_REQUIRED_CHART_MESSAGE = "Seleccione un municipio para ver la información.";
export const MUNICIPALITY_REQUIRED_SUMMARY_MESSAGE = "Resumen disponible solo al seleccionar un municipio.";

export function hasMunicipalitySelection({
    getFiltroNivel,
    getMunicipioActual
} = {}) {
    const selectedCode = String(
        getMunicipioActual?.() || document.getElementById("municipios")?.value || ""
    ).trim();
    const level = String(getFiltroNivel?.() || "").trim();
    return /^\d{5}$/.test(selectedCode) && (!level || level === "MUNI");
}

export function chartRequiresMunicipality(chartConfig) {
    return chartConfig?.filter?.requiredLevel === "MUNI"
        || chartConfig?.requireMunicipality === true;
}

export function showMunicipalityRequiredChartState({
    canvas,
    chartConfig,
    title,
    destroyChart,
    prepareCanvas,
    setTitle,
    setStatus
} = {}) {
    if (!canvas) return false;
    destroyChart?.();
    prepareCanvas?.(canvas, chartConfig);
    setTitle?.(title || chartConfig?.title || "");
    setStatus?.(canvas, MUNICIPALITY_REQUIRED_CHART_MESSAGE);
    canvas.style.setProperty("display", "none", "important");
    return true;
}
