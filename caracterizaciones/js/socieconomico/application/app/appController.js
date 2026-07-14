export function createAppController({
    hideTimeSlider,
    setTimeSliderTouched,
    renderizarMunicipios,
    clearLayers,
    renderControls,
    updateMapViewBadge,
    getCurrentModeLabel,
    updateNavbarActive,
    clampSubLayerIndex,
    renderSubTabs,
    actualizarResumen,
    cargarCapaActual,
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
    setMunicipioInfo,
    setLayerViewGlobal,
    setChartLayerGlobal,
    setLastHoverWhere,
    setLegendFilterLabel,
    getMunicipioActual,
    getFiltroNivel,
    getDeptoActual
}) {

    function limpiarBusqueda() {
        hideTimeSlider();
        setTimeSliderTouched(false);

        setMunicipioActual("");
        setDeptoActual("");
        setFiltroNivel("");
        setWhereBase("");

        clearLayers();
        renderControls();
        actualizarResumen();
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

        if (getMunicipioActual() || (getFiltroNivel() === "DEPTO" && getDeptoActual())) {
            cargarCapaActual();
        }
    }

    return {
        limpiarBusqueda,
        setMode
    };
}