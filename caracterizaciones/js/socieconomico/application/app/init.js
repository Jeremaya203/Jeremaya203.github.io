export function createInitController({
    setMode,
    limpiarBusqueda,
    reiniciarConsultaActual,
    cargarMunicipios,
    toggleLegend,
    updateNavbarActive = () => {},
    getCurrentMode,
    renderControls
}) {
    function init() {       

        const btnRefreshBusqueda = document.getElementById("btnRefreshBusqueda");
        if (btnRefreshBusqueda) btnRefreshBusqueda.onclick = limpiarBusqueda;

        const btnReiniciarConsulta = document.getElementById("btnReiniciarConsulta");
        if (btnReiniciarConsulta && reiniciarConsultaActual) {
            btnReiniciarConsulta.onclick = () => {
                reiniciarConsultaActual();
            };
        }

        const municipiosPromise = cargarMunicipios();
        document.getElementById("legendToggle").onclick = toggleLegend;
        updateNavbarActive(getCurrentMode());
        renderControls();
        return municipiosPromise;
    }

    return { init };
}
