export function initBiofisicoDropdownEvents({
    initModuleDropdown,
    onBiofisicoTarget
}) {
    document.addEventListener("click", function (event) {
        document.querySelectorAll(".modulo-dropdown.open").forEach(dropdown => {
            if (!dropdown.contains(event.target)) {
                dropdown.classList.remove("open");
            }
        });
    });

    initModuleDropdown("biofisicoDropdown", "biofisicoTrigger", ".dropdown-menu-custom", onBiofisicoTarget);
}

export function initExternalModuleNavigation({ initModuleDropdown }) {
    const nav = globalThis.ModuleNavigation;
    if (!nav?.navigateToComponent) return;

    initModuleDropdown("limitesDropdown", "limitesTrigger", ".dropdown-menu-custom", (target) => {
        nav.navigateToComponent("limites.html", target);
    });

    initModuleDropdown("ordenamientoDropdown", "ordenamientoTrigger", ".dropdown-menu-custom", (target) => {
        nav.navigateToComponent("ordenamiento.html", target);
    });

    initModuleDropdown("legalDropdown", "legalTrigger", ".dropdown-menu-custom", (target) => {
        nav.navigateToComponent("contexto.html", target);
    });

    initModuleDropdown("ocupacionDropdown", "ocupacionTrigger", ".dropdown-menu-custom", (target) => {
        nav.navigateToComponent("ocupacion.html", target);
    });

    initModuleDropdown("socioeconomicoDropdown", "socioeconomicoTrigger", ".dropdown-menu-custom", (target) => {
        nav.navigateToComponent("socioeconomico.html", target);
    });
}

export function handleBiofisicoDropdownTarget(target) {
    if (target === "Relieve") {
        document.getElementById("btnRelieve")?.click();
    } else if (target === "Clima") {
        document.getElementById("btnClima")?.click();
    } else if (target === "Hidrografia" || target === "Hidrografía") {
        document.getElementById("btnHidrografia")?.click();
    } else if (target === "Ecosistemas") {
        document.getElementById("btnEcosistemas")?.click();
    } else if (target === "Suelos") {
        document.getElementById("btnSuelos")?.click();
    } else if (target === "Fenomenos Amenazantes" || target === "Fenómenos Amenazantes") {
        document.getElementById("btnFenomenos")?.click();
    }
}

export function handleDepartmentSelectChange(api, deptoSeleccionado) {
    api.cancelScheduledCurrentLayerLoad?.();
    api.bumpRenderCycle?.();

    if (deptoSeleccionado === "COL") {
        api.clearMunicipalitySelection();
        api.clearTerritoryFilters();
        api.clearLayers();
        api.destroyChartOnly();
        api.updateSummary();
        api.updateChartTitleForCurrentTerritory?.();
        api.goToColombia();
        return;
    }

    api.renderMunicipalities(deptoSeleccionado);
    api.clearMunicipalitySelection();

    if (deptoSeleccionado && deptoSeleccionado !== "0") {
        api.setDepartmentFilter(deptoSeleccionado);
        api.renderControls();
        api.syncStateFromGlobals();
        api.rebuildWhereBaseFromActiveConfig();
        api.syncStateFromGlobals();
        api.updateSummary();

        if (api.shouldSkipDepartmentLayerRender?.()) {
            api.clearLayers();
            api.destroyChartInstance?.();
            resetLegendUiForSearch();
            return;
        }

        api.scheduleCargarCapaActual?.(api.getDepartmentLayerRenderDelay?.() ?? 0);
        return;
    }

    api.clearTerritoryFilters();
    api.clearLayers();
    api.destroyChartOnly();
    api.updateSummary();
    api.updateChartTitleForCurrentTerritory?.();
}

export function handleMunicipalitySelectChange(api, codigo) {
    if (!codigo) return;

    api.cancelScheduledCurrentLayerLoad?.();
    api.bumpRenderCycle?.();
    api.setMunicipalityFilter(codigo);
    api.renderControls();

    const prevId = api.getPreviousLayerIdForCurrentLevel();
    api.syncStateFromGlobals();
    api.rebuildWhereBaseFromActiveConfig();
    api.syncStateFromGlobals();
    api.ensureMunicipalLayerIndex(prevId);
    api.loadMunicipalityInfo(codigo);
    api.loadCurrentLayer();
}

export function bindMainButtonEvents({
    setMode,
    clearSearch,
    restartCurrentQuery,
    applyInitialModuleFromURL,
    loadMunicipalities,
    toggleLegend,
    updateNavbarActive,
    renderControls,
    getCurrentMode
}) {
    document.getElementById("btnRelieve").onclick = () => setMode("RELIEVE");
    document.getElementById("btnClima").onclick = () => setMode("CLIMA");
    document.getElementById("btnHidrografia").onclick = () => setMode("HIDROGRAFIA");
    document.getElementById("btnEcosistemas").onclick = () => setMode("ECOSISTEMAS");
    document.getElementById("btnSuelos").onclick = () => setMode("SUELOS");
    document.getElementById("btnFenomenos").onclick = () => setMode("FENOMENOS");

    const refreshSearchButton = document.getElementById("refreshSearchButton");
    if (refreshSearchButton) {
        refreshSearchButton.onclick = clearSearch;
    }

    const restartQueryButton = document.getElementById("restartQueryButton");
    if (restartQueryButton && restartCurrentQuery) {
        restartQueryButton.onclick = () => {
            restartCurrentQuery();
        };
    }

    document.getElementById("legendToggle").onclick = toggleLegend;

    applyInitialModuleFromURL();
    loadMunicipalities();
    updateNavbarActive(getCurrentMode());
    renderControls();
}

export function bindMasterSliderEvents({
    masterSlider,
    view,
    getSliderMode,
    onTimeInput
}) {
    masterSlider.addEventListener("input", function () {
        if (getSliderMode() === "time") {
            onTimeInput(Number(this.value) || 0);
            return;
        }

        view.zoom = Number(this.value);
    });

    view.watch("zoom", function (zoom) {
        if (getSliderMode() === "zoom") {
            masterSlider.value = zoom;
        }
    });
}

export function bindTerritorySelectEvents({
    onDepartamentoChange,
    onMunicipioChange
}) {
    document.getElementById("departamentos").onchange = function () {
        onDepartamentoChange(this.value);
    };

    document.getElementById("municipios").onchange = function () {
        onMunicipioChange(this.value);
    };
}

export function bindViewAllButton({ onViewAll }) {
    document.getElementById("btnVerTodo").onclick = onViewAll;
}

export function handleViewAllClick(api) {
    if (!api.hasActiveLayer()) return;

    api.applyWhereToActiveLayers(api.getWhereBase());
    api.updateLegendByExtentForActiveLayer();
    api.zoomToActiveLayerExtent();
}

export function handleSearchRefresh(api) {
    api.cancelScheduledCurrentLayerLoad?.();
    api.hideTimeSlider();
    api.setTimeSliderTouched(false);

    const departmentSelect = document.getElementById("departamentos");
    const selectMuni = document.getElementById("municipios");

    if (departmentSelect) departmentSelect.value = "0";
    if (selectMuni) {
        selectMuni.innerHTML = `<option value="">Seleccione un municipio</option>`;
        api.renderMunicipalities();
        selectMuni.value = "";
    }

    api.resetSearchState();
    api.syncStateFromGlobals();
    api.clearLayers();
    api.clearHighlight();
    api.destroyChartInstance();
    resetLegendUiForSearch();
    api.resetCurrentSubLayerIndex();
    api.renderControls();
    api.updateMapViewBadge(api.getCurrentModeLabel());
    api.updateSummary();
    api.updateChartTitleForCurrentTerritory?.();
    api.closePopup();
    api.goToInitialExtent();
}

export function handlePreviousSubLayer(api) {
    changeSubLayer(api, -1);
}

export function handleNextSubLayer(api) {
    changeSubLayer(api, 1);
}

export function handleSetBiofisicoMode(api, mode) {
    api.hideTimeSlider();
    api.setTimeSliderTouched(false);
    const hasTerritoryFilter = api.hasTerritoryFilter?.();
    api.updateURLByModule("BIOFISICO");
    api.setCurrentMode(mode);
    api.setCurrentSubLayerIndex(0);
    api.syncStateFromGlobals();

    if (hasTerritoryFilter) {
        api.prepareSectionLoadingState?.();
    } else {
        api.clearLayers?.();
        api.destroyChartInstance?.();
        resetLegendUiForSearch();
    }

    api.updateNavbarActive(mode);
    api.clampSubLayerIndex();
    api.renderSubTabs();
    api.updateMapViewBadge(api.getCurrentModeLabel(mode));

    if (api.hasTerritoryFilter()) {
        api.loadCurrentLayer();
    } else {
        api.updateSummary?.();
        api.updateChartTitleForCurrentTerritory?.();
    }
}

function resetLegendUiForSearch() {
    const legendTitle = document.getElementById("legendTitle");
    const legendContent = document.getElementById("legendContent");
    if (legendTitle) legendTitle.textContent = "Leyenda";
    if (legendContent) {
        legendContent.innerHTML = `<p class="oot-js-biofisico-events-1">Seleccione un departamento o municipio</p>`;
        legendContent.classList.remove("collapsed");
    }

    window.__legendState = {
        allCodes: [],
        activeCodes: new Set(),
        field: null,
        layer: null
    };
}

function changeSubLayer(api, delta) {
    api.hideTimeSlider();
    api.setTimeSliderTouched(false);

    const list = api.getLayerListForCurrentLevel();
    if (!list || list.length === 0) return;

    const total = list.length;
    api.setCurrentSubLayerIndex((api.getCurrentSubLayerIndex() + delta + total) % total);
    api.syncStateFromGlobals?.();
    api.renderControls();

    if (api.hasTerritoryFilter?.()) {
        api.prepareSectionLoadingState?.();
    } else {
        api.destroyChartInstance?.();
        resetLegendUiForSearch();
    }

    if (api.hasTerritoryFilter()) {
        api.loadCurrentLayer();
    }
}
