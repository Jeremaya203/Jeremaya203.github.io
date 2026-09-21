/**
 * Time Slider - Control de periodos temporales (clima, deforestación)
 */
export function createTimeSlider(deps) {
    const {
        masterSlider,
        getView,
        getSliderMode,
        setSliderMode,
        getTimeSliderEnabled,
        setTimeSliderEnabled,
        getTimeSliderPeriods,
        setTimeSliderPeriods,
        getTimeSliderIndex,
        setTimeSliderIndex,
        getTimeSliderTouched,
        setTimeSliderTouched,
        getTimeSliderContextKey,
        setTimeSliderContextKey,
        getDeforestacionPeriodoActivo,
        setDeforestacionPeriodoActivo,
        getDeforestacionPeriodosBase,
        setDeforestacionPeriodosBase,
        getWhereBase,
        getLayerGlobal,
        getLayersGlobal,
        getActiveLayerConfig,
        applyWhereToActiveLayers,
        buildExtraWhere,
        buildDefinitionExpression,
        updateChart,
        refreshLegend,
        resetLegendCategoryState
    } = deps;

    function refreshActiveLegend() {
        if (typeof refreshLegend === "function") {
            refreshLegend();
        }
    }

    function hideTimeSlider() {
        setTimeSliderEnabled(false);
        setTimeSliderPeriods([]);
        setTimeSliderIndex(0);
        setTimeSliderTouched(false);
        setTimeSliderContextKey("");

        setSliderMode("zoom");

        masterSlider.min = 2;
        masterSlider.max = 12;
        masterSlider.step = 0.1;
        masterSlider.value = getView().zoom;

        const container = document.getElementById("zoomSliderContainer");
        const mapSliderLabel = document.getElementById("mapSliderLabel");

        if (container) {
            container.classList.remove("time-mode");
            container.style.display = "none";
        }

        if (mapSliderLabel) {
            mapSliderLabel.textContent = "";
        }
    }

    function showTimeSlider(periods, activeIndex = 0, contextKey = "") {
        if (!Array.isArray(periods) || !periods.length) {
            hideTimeSlider();
            return;
        }

        const periodsWithAll = ["Todos", ...periods];

        const sameContext = contextKey && getTimeSliderContextKey() === contextKey;
        const currentPeriods = getTimeSliderPeriods();
        const samePeriods =
            sameContext &&
            Array.isArray(currentPeriods) &&
            currentPeriods.length === periodsWithAll.length &&
            currentPeriods.every((p, i) => p === periodsWithAll[i]);

        if (contextKey && !sameContext) {
            setTimeSliderTouched(false);
            setTimeSliderContextKey(contextKey);
            setTimeSliderIndex(0);
        }

        setTimeSliderEnabled(true);
        setSliderMode("time");

        if (!samePeriods) {
            setTimeSliderPeriods(periodsWithAll);
            masterSlider.min = 0;
            masterSlider.max = periodsWithAll.length - 1;
            masterSlider.step = 1;
        }

        const idx = Math.max(0, Math.min(activeIndex, periodsWithAll.length - 1));
        setTimeSliderIndex(idx);
        masterSlider.value = idx;

        const container = document.getElementById("zoomSliderContainer");
        const mapSliderLabel = document.getElementById("mapSliderLabel");

        if (container) {
            container.style.display = "block";
            container.classList.add("time-mode");
        }

        if (mapSliderLabel) {
            mapSliderLabel.textContent = `Periodo: ${periodsWithAll[idx]}`;
        }
    }

    function getSelectedTimePeriod() {
        const enabled = getTimeSliderEnabled();
        const periods = getTimeSliderPeriods();
        if (!enabled || !periods.length) return null;
        return periods[getTimeSliderIndex()] || null;
    }

    function handleTimeSliderInput(value) {
        setTimeSliderIndex(Number(value) || 0);

        const periods = getTimeSliderPeriods();
        const selectedPeriod = periods[getTimeSliderIndex()];

        const timeSliderLabel = document.getElementById("timeSliderLabel");
        if (timeSliderLabel && selectedPeriod) {
            timeSliderLabel.textContent = `Periodo: ${selectedPeriod}`;
        }

        const mapSliderLabel = document.getElementById("mapSliderLabel");
        if (mapSliderLabel && selectedPeriod) {
            mapSliderLabel.textContent = `Periodo: ${selectedPeriod}`;
        }

        const activeConfig = getActiveLayerConfig();
        const layerGlobal = getLayerGlobal();
        const layersGlobal = getLayersGlobal();
        const activeLayer =
            (typeof layerGlobal !== "undefined" && layerGlobal)
                ? layerGlobal
                : (Array.isArray(layersGlobal) && layersGlobal.length ? layersGlobal[0] : null);

        if (!activeLayer || !activeConfig) return;
        if (!getTimeSliderEnabled() || !periods?.length) return;

        setTimeSliderTouched(getTimeSliderIndex() > 0);
        if (typeof resetLegendCategoryState === "function") {
            resetLegendCategoryState();
        }

        // ===== DEFORESTACIÓN / REGENERACIÓN =====
        if (
            activeConfig?.id === "deforestacion" ||
            activeConfig?.ecosistemaType === "deforestacion"
        ) {
            const period = selectedPeriod || "Todos";
            setDeforestacionPeriodoActivo(period);

            const whereBase = getWhereBase();
            const baseWhereStable =
                (whereBase && String(whereBase).trim())
                    ? whereBase
                    : "1=1";

            if (period === "Todos") {
                if (activeLayer?.definitionExpression !== baseWhereStable) {
                    applyWhereToActiveLayers(baseWhereStable);
                }
            } else {
                const safePeriod = String(period).replace(/'/g, "''");
                const extraWhere = buildExtraWhere(activeConfig, {
                    timePeriod: period
                });

                const periodWhere = buildDefinitionExpression({
                    baseWhere: baseWhereStable,
                    extraWhere
                });

                if (activeLayer?.definitionExpression !== periodWhere) {
                    applyWhereToActiveLayers(periodWhere);
                }
            }

            requestAnimationFrame(() => {
                updateChart(activeLayer, activeConfig, { skipSyncMap: true });
                refreshActiveLegend();
            });
            return;
        }

        // ===== CLIMA STACKED =====
        if (
            activeConfig?.isClima &&
            activeConfig?.isStacked &&
            activeConfig?.periodField &&
            ["temp", "precip", "temp_cc", "precip_cc"].includes(activeConfig.climaType)
        ) {
            const whereBase = getWhereBase();
            const baseWhereStable =
                (whereBase && String(whereBase).trim())
                    ? whereBase
                    : "1=1";

            if (getTimeSliderIndex() === 0) {
                if (layerGlobal?.definitionExpression !== baseWhereStable) {
                    applyWhereToActiveLayers(baseWhereStable);
                }

                requestAnimationFrame(() => {
                    updateChart(activeLayer, activeConfig);
                    refreshActiveLegend();
                });
                return;
            }

            const selectedPeriodSafe = String(selectedPeriod ?? "").replace(/'/g, "''");
            const extraWhere = buildExtraWhere(activeConfig, {
                timePeriod: selectedPeriod
            });

            const periodWhere = buildDefinitionExpression({
                baseWhere: baseWhereStable,
                extraWhere
            });

            if (layerGlobal?.definitionExpression !== periodWhere) {
                applyWhereToActiveLayers(periodWhere);
            }

            requestAnimationFrame(() => {
                updateChart(activeLayer, activeConfig);
                refreshActiveLegend();
            });
            return;
        }

        updateChart(activeLayer, activeConfig);
        refreshActiveLegend();
    }

    return {
        hideTimeSlider,
        showTimeSlider,
        getSelectedTimePeriod,
        handleTimeSliderInput
    };
}
