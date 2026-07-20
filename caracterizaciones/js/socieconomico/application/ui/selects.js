import { setState } from "../state/store.js";

export function createSelectsController({
    layersConfig,
    getCurrentMainModule,
    getCurrentMode,
    getCurrentSubLayerIndex,
    setCurrentSubLayerIndex,
    getLayerListForCurrentLevel,
    ensureMunicipalLayerIndex,
    renderizarMunicipios,
    renderControls,
    clearLayers,
    actualizarResumen,
    cargarInfoMunicipio,
    cargarCapaActual,
    getActiveLayerConfig,
    applyWhereToActiveLayers,
    getUpdateLegendByExtent,
    getLayerGlobal,
    getWhereBase,
    setWhereBase,
    getChartInstance,
    setMunicipioActual,
    setMunicipioInfo,
    setFiltroNivel,
    setDeptoActual,
    getView
}) {
    function bindSelectEvents() {
        const departamentos = document.getElementById("departamentos");
        const municipios = document.getElementById("municipios");
        const btnVerTodo = document.getElementById("btnVerTodo");

        if (departamentos) departamentos.onchange = onDepartamentoChange;
        if (municipios) municipios.onchange = onMunicipioChange;
        if (btnVerTodo) btnVerTodo.onclick = onVerTodoClick;

        bindRedirigir();
    }

    function ensureCurrentSubLayerIndexExists(preferredLayerId = null) {
        const list = getLayerListForCurrentLevel?.(getCurrentMode?.()) || [];
        const currentIndex = Number(getCurrentSubLayerIndex?.() ?? 0);

        if (preferredLayerId != null) {
            const preferredIndex = list.findIndex(layer => layer?.id === preferredLayerId);
            if (preferredIndex >= 0) {
                setCurrentSubLayerIndex(preferredIndex);
                return;
            }
        }

        if (!list.length || (currentIndex >= 0 && currentIndex < list.length)) return;
        setCurrentSubLayerIndex(0);
    }

    function zoomToActiveFilteredLayer(delay = 1400) {
        window.setTimeout(async () => {
            const layer = getLayerGlobal?.();
            const view = getView?.();
            if (!layer || layer.destroyed || !view) return;

            const where = String(getWhereBase?.() || layer.definitionExpression || "1=1").trim() || "1=1";
            try {
                await layer.when?.();
                const result = await layer.queryExtent({ where });
                if (result?.extent) {
                    await view.goTo(result.extent.expand?.(1.2) || result.extent, { duration: 700 });
                    return;
                }
            } catch (_) {}

            try {
                const query = layer.createQuery();
                query.where = where;
                query.outFields = [layer.objectIdField || "objectid"];
                query.returnGeometry = true;
                query.num = 1;
                const result = await layer.queryFeatures(query);
                const geometry = result?.features?.[0]?.geometry;
                const target = geometry?.extent?.expand?.(1.2) || geometry;
                if (target) await view.goTo(target, { duration: 700 });
            } catch (_) {}
        }, delay);
    }

    async function onDepartamentoChange() {
        const deptoSeleccionado = this.value;
        const deptoNombre = this.options?.[this.selectedIndex]?.textContent?.trim() || "";
        const view = getView();
        await window.__clearSocioVisualState?.({
            preservePibTabs: false,
            preserveEconomicTabs: false,
            preserveMainCanvas: false,
            preserveSummary: false,
            preserveLegend: false
        });

        if (deptoSeleccionado === "COL") {
            renderizarMunicipios("0");
            document.getElementById("municipios").value = "";
            setMunicipioActual("");
            setMunicipioInfo(null);
            setFiltroNivel("");
            setDeptoActual("");
            setWhereBase("");

            clearLayers();
            window.renderActivePibSubitem?.(0);
            window.renderCensoPecuarioSoon?.(0);

            const chartInstance = getChartInstance();
            if (chartInstance) chartInstance.destroy();
            if (window.chartInstance) {
                window.chartInstance.destroy();
                window.chartInstance = null;
            }

            actualizarResumen();

            view.goTo(
                { center: [-74.3, 4.6], zoom: 6 },
                { duration: 900, easing: "ease-in-out" }
            );

            return;
        }

        renderizarMunicipios(deptoSeleccionado);
        document.getElementById("municipios").value = "";
        setMunicipioActual("");
        setMunicipioInfo(null);
        const previousActiveConfig = getActiveLayerConfig?.();

        if (getCurrentMainModule() === "ORDENAMIENTO") {
            setDeptoActual(deptoSeleccionado);
            setFiltroNivel(deptoSeleccionado && deptoSeleccionado !== "0" ? "DEPTO" : "");

            if (typeof window.cargarOrdenamientoActual === "function") {
                window.cargarOrdenamientoActual();
            }
            return;
        }

        if (deptoSeleccionado && deptoSeleccionado !== "0") {
            setFiltroNivel("DEPTO");
            setDeptoActual(deptoSeleccionado);
            ensureCurrentSubLayerIndexExists(previousActiveConfig?.id);

            const activeConfig = getActiveLayerConfig();
            if (activeConfig?.key === "PIB_DEPARTMENT") {
                window.__pibMapVariantKey = "PIB";
                activeConfig.chartVariantKey = "PIB";
            }
            const chartDepartmentField = activeConfig?.chartConfig?.filter?.departmentField;
            window.prepareChartPanelForConfig?.(activeConfig);

            if (activeConfig?.key === "PIB_DEPARTMENT") {
                setWhereBase(`dpcodigo = '${deptoSeleccionado}'`);
            } else if (activeConfig?.chartConfig && chartDepartmentField) {
                const source = activeConfig.chartConfig.filter?.valueSource || "label";
                const departmentValue = source === "code" ? deptoSeleccionado : deptoNombre;
                setWhereBase(`${chartDepartmentField} = '${departmentValue.replace(/'/g, "''")}'`);
            } else if (String(getCurrentMode()).startsWith("SOCIOECONOMIC")) {
                // Socioeconomico conserva el subtab elegido; no debe caer en defaults heredados de biofisico.
            } else if (getCurrentMode() === "CLIMA") {
                const idxTempDepto = (layersConfig.CLIMA || [])
                    .findIndex(layer => layer.id === "temperatura_depto");

                setCurrentSubLayerIndex((idxTempDepto >= 0) ? idxTempDepto : 0);
            } else if (getCurrentMode() === "FENOMENOS") {
                const idxInuDepto = (layersConfig.FENOMENOS || [])
                    .findIndex(layer => layer.id === "inundaciones_depto");

                setCurrentSubLayerIndex((idxInuDepto >= 0) ? idxInuDepto : 0);
            } else {
                const idxHipsoDepto = (layersConfig.RELIEVE || [])
                    .findIndex(layer => layer.id === "hipsometria_depto");

                setCurrentSubLayerIndex((idxHipsoDepto >= 0) ? idxHipsoDepto : 0);
            }

            renderControls();
            if (!(activeConfig?.chartConfig && chartDepartmentField)) {
                setWhereBase(`dpcodigo = '${deptoSeleccionado}'`);
            }
            window.renderCensoPecuarioSoon?.(900);
            cargarCapaActual();
            if (activeConfig?.key === "PIB_DEPARTMENT") {
                window.renderActivePibSubitem?.(900);
            } else {
                window.renderActiveChartSoon?.(900);
            }
            actualizarResumen();
        } else {
            setFiltroNivel("");
            setDeptoActual("");
            setWhereBase("");

            clearLayers();
            window.renderActivePibSubitem?.(0);
            window.renderCensoPecuarioSoon?.(0);

            const chartInstance = getChartInstance();
            if (chartInstance) chartInstance.destroy();
            if (window.chartInstance) {
                window.chartInstance.destroy();
                window.chartInstance = null;
            }

            actualizarResumen();
        }
    }


async function onMunicipioChange() {
    const codigo = this.value;
    if (!codigo) return;

    await window.__clearSocioVisualState?.({
        preservePibTabs: false,
        preserveEconomicTabs: false,
        preserveMainCanvas: false,
        preserveSummary: false,
        preserveLegend: false
    });

    setFiltroNivel("MUNI");


    setState({ municipio: codigo });

    setMunicipioActual(codigo);
    setDeptoActual(codigo.substring(0, 2));

    renderControls();

    if (getCurrentMainModule() === "ORDENAMIENTO") {
        if (typeof window.cargarOrdenamientoActual === "function") {
            window.cargarOrdenamientoActual();
        }
        return;
    }

    const prevList = getLayerListForCurrentLevel(getCurrentMode());
    const prevCfg = prevList?.[getCurrentSubLayerIndex()];
    const prevId = prevCfg?.id;

    setWhereBase(`mpcodigo = '${codigo}'`);

    ensureMunicipalLayerIndex(prevId);
    cargarInfoMunicipio(codigo);
    const activeConfig = getActiveLayerConfig();
    const keepDepartmentContext = activeConfig?.key === "POVERTY_LEVEL"
        || activeConfig?.key === "SUPPORT_INFRASTRUCTURE"
        || activeConfig?.keepDepartmentMapOnMunicipality === true;
    if (activeConfig?.key === "PIB_DEPARTMENT") {
        window.__pibMapVariantKey = "VALOR_AGREGADO";
        activeConfig.chartVariantKey = "VALOR_AGREGADO";
        cargarCapaActual();
        window.renderActivePibSubitem?.(900);
    } else if (activeConfig?.mapLayerUrl && activeConfig?.url && activeConfig.mapLayerUrl !== activeConfig.url) {
        cargarCapaActual();
        if (!keepDepartmentContext) {
            zoomToActiveFilteredLayer(1800);
        }
        window.renderActiveChartSoon?.(900);
    } else if (activeConfig?.type === "table-layer" && activeConfig?.mapFallback?.url) {
        cargarCapaActual();
        if (!keepDepartmentContext) {
            zoomToActiveFilteredLayer(1800);
        }
        window.renderActiveChartSoon?.(900);
    } else {
        window.renderActiveChartSoon?.(900);
        window.renderPibSectorPieSoon?.(900);
        window.renderPibEmpresasSoon?.(900);
    }
    window.renderCensoPecuarioSoon?.(900);
    window.setTimeout(() => cargarInfoMunicipio(codigo), 1800);
}

    function onVerTodoClick() {
        const layerGlobal = getLayerGlobal();
        if (!layerGlobal) return;

        applyWhereToActiveLayers(getWhereBase());
        getUpdateLegendByExtent()?.(layerGlobal, getActiveLayerConfig());

        layerGlobal.queryExtent({ where: getWhereBase() }).then(res => {
            if (res.extent) getView().goTo(res.extent.expand(1.2));
        });
    }

    function bindRedirigir() {
        window.redirigir = function (e) {
            e.preventDefault();
            const link = e.currentTarget;
            const href = link.getAttribute("href");
            const territory = globalThis.ModuleNavigation?.getTerritoryFromSelects?.(
                document.getElementById("departamentos"),
                document.getElementById("municipios")
            ) || { municipioId: "", deptoId: "" };

            window.location.href = globalThis.ModuleNavigation?.mergeHrefWithTerritory?.(href, territory) || href;
        };
    }

    return { bindSelectEvents };
}
