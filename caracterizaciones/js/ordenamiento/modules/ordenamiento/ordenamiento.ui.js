export function resetOrdenamientoUI({
    hideTimeSlider,
    destroyGeoformasCharts,
    toggleGeoformasCharts,
    chartInstanceRef,
    renderControls
}) {
    hideTimeSlider?.();
    destroyGeoformasCharts?.();
    toggleGeoformasCharts?.(false);

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

export function syncChartSideLayout(currentOrdenamientoTab) {
    const chartDiv = document.getElementById("chartDiv");
    if (!chartDiv) return;

    const isMapAligned =
        currentOrdenamientoTab === "VIGENCIA" ||
        currentOrdenamientoTab === "CLASIFICACION_SUELO" ||
        currentOrdenamientoTab === "AREAS_ACTIVIDAD";
    const isRuralTabs = currentOrdenamientoTab === "ZONIFICACION_RURAL";

    chartDiv.classList.toggle("chartDiv--map-aligned", isMapAligned);
    chartDiv.classList.toggle("chartDiv--rural-tabs", isRuralTabs);
}
