export function createAppController({
    hideTimeSlider,
    setTimeSliderTouched,
    renderMunicipalities,
    clearLayers,
    renderControls,
    updateMapViewBadge,
    getCurrentModeLabel,
    updateNavbarActive,
    clampSubLayerIndex,
    renderSubTabs,
    updateSummary,
    loadCurrentLayer,
    getExtentInicial,
    getView,
    getChartInstance,
    setChartInstance,
    getCurrentMainModule,
    setCurrentMainModule,
    setCurrentMode,
    setCurrentSubLayerIndex,
    setMunicipioActual,
    setDeptoActual,
    setFiltroNivel,
    setWhereBase,
    setMunicipalityInfo,
    setLayerViewGlobal,
    setChartLayerGlobal,
    setLastHoverWhere,
    setLegendFilterLabel,
    getCurrentMunicipalityId,
    getTerritoryLevel,
    getCurrentDepartmentId
}) {

    function clearSearch() {
        hideTimeSlider();
        setTimeSliderTouched(false);

        setMunicipioActual("");
        setDeptoActual("");
        setFiltroNivel("");
        setWhereBase("");

        clearLayers();
        renderControls();
        updateSummary();
    }

    function setMode(mode) {
        hideTimeSlider();
        setTimeSliderTouched(false);

        setCurrentMainModule("SOCIOECONOMICO");
        setCurrentMode(mode);
        setCurrentSubLayerIndex(0);

        updateNavbarActive(mode);
        clampSubLayerIndex();
        renderSubTabs();
        updateMapViewBadge(getCurrentModeLabel(mode));

        if (getCurrentMunicipalityId() || (getTerritoryLevel() === "DEPTO" && getCurrentDepartmentId())) {
            loadCurrentLayer();
        }
    }

    return {
        clearSearch,
        setMode
    };
}