export function createInitController({
    setMode,
    clearSearch,
    restartCurrentQuery,
    loadMunicipalities,
    toggleLegend,
    updateNavbarActive = () => {},
    getCurrentMode,
    renderControls
}) {
    function init() {       

        const refreshSearchButton = document.getElementById("refreshSearchButton");
        if (refreshSearchButton) refreshSearchButton.onclick = clearSearch;

        const restartQueryButton = document.getElementById("restartQueryButton");
        if (restartQueryButton && restartCurrentQuery) {
            restartQueryButton.onclick = () => {
                restartCurrentQuery();
            };
        }

        const municipalitiesPromise = loadMunicipalities();
        document.getElementById("legendToggle").onclick = toggleLegend;
        updateNavbarActive(getCurrentMode());
        renderControls();
        return municipalitiesPromise;
    }

    return { init };
}
