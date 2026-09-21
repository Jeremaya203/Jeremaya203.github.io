export function resetLandUsePlanningUi({
    hideTimeSlider,
    destroyLandformCharts,
    toggleLandformCharts,
    chartInstanceRef,
    renderControls
}) {
    hideTimeSlider?.();
    destroyLandformCharts?.();
    toggleLandformCharts?.(false);

    window.__vocacionSelectedLabel = null;
    window.__aa_active_filters = new Set();
    window.__aa_all_items = [];
    window.__aa_full_codes = [];
    window.__aa_base_where = "1=1";
    window.__lastLegendRenderKey = "";

    if (chartInstanceRef?.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
    }

    const legendTitle = document.getElementById("legendTitle");
    const legendContent = document.getElementById("legendContent");
    if (legendTitle) legendTitle.textContent = "Leyenda";
    if (legendContent) legendContent.innerHTML = "";

    const summaryDiv = document.getElementById("summaryDiv");
    if (summaryDiv) summaryDiv.textContent = "Cargando información...";

    renderControls?.();
}

export function syncChartSideLayout(currentLandUsePlanningTab) {
    const chartDiv = document.getElementById("chartDiv");
    const mapDiv = document.getElementById("mapDiv");
    if (!chartDiv) return;

    const previousTab = chartDiv.dataset.layoutTab || "";
    const changedTab = previousTab !== currentLandUsePlanningTab;
    chartDiv.dataset.layoutTab = currentLandUsePlanningTab;

    const isClassification = currentLandUsePlanningTab === "CLASIFICACION_SUELO";
    const isValidity = currentLandUsePlanningTab === "VIGENCIA";
    const isMapAligned =
        isValidity ||
        isClassification ||
        currentLandUsePlanningTab === "AREAS_ACTIVIDAD";
    const isRuralTabs = currentLandUsePlanningTab === "ZONIFICACION_RURAL";

    chartDiv.classList.toggle("chartDiv--map-aligned", isMapAligned);
    chartDiv.classList.toggle("chartDiv--vigencia", isValidity);
    chartDiv.classList.toggle("chartDiv--classification", isClassification);
    chartDiv.classList.toggle("chartDiv--rural-tabs", isRuralTabs);
    mapDiv?.classList.toggle("mapDiv--classification", isClassification);
    mapDiv?.classList.toggle("mapDiv--rural-tabs", isRuralTabs);

    if (changedTab) {
        chartDiv.scrollTop = 0;
    }
}
