export function createSliderController({
    view,
    masterSlider,
    timeSliderLabel,
    getSliderMode,
    setSliderMode,
    getWhereBase,
    getLayerGlobal,
    getLayersGlobal,
    getActiveLayerConfig,
    applyWhereToActiveLayers,
    actualizarGrafica
}) {
    let timeSliderPeriods = [];
    let timeSliderIndex = 0;
    let timeSliderEnabled = false;
    let timeSliderTouched = false;
    let timeSliderContextKey = "";
    let deforestacionPeriodoActivo = "Todos";

    function setTimeSliderTouched(value) {
        timeSliderTouched = value;
    }

    function isTimeSliderTouched() {
        return timeSliderTouched;
    }

    function hideTimeSlider() {
        timeSliderEnabled = false;
        timeSliderPeriods = [];
        timeSliderIndex = 0;
        timeSliderTouched = false;
        timeSliderContextKey = "";

        setSliderMode("zoom");

        masterSlider.min = 2;
        masterSlider.max = 12;
        masterSlider.step = 0.1;
        masterSlider.value = view.zoom;

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
        const sameContext = contextKey && timeSliderContextKey === contextKey;
        const samePeriods =
            sameContext &&
            Array.isArray(timeSliderPeriods) &&
            timeSliderPeriods.length === periodsWithAll.length &&
            timeSliderPeriods.every((period, index) => period === periodsWithAll[index]);

        if (contextKey && !sameContext) {
            timeSliderTouched = false;
            timeSliderContextKey = contextKey;
            timeSliderIndex = 0;
        }

        timeSliderEnabled = true;
        setSliderMode("time");

        if (!samePeriods) {
            timeSliderPeriods = periodsWithAll;
            masterSlider.min = 0;
            masterSlider.max = periodsWithAll.length - 1;
            masterSlider.step = 1;
        }

        timeSliderIndex = Math.max(0, Math.min(activeIndex, timeSliderPeriods.length - 1));
        masterSlider.value = timeSliderIndex;

        const container = document.getElementById("zoomSliderContainer");
        const mapSliderLabel = document.getElementById("mapSliderLabel");

        if (container) {
            container.style.display = "block";
            container.classList.add("time-mode");
        }

        if (mapSliderLabel) {
            mapSliderLabel.textContent = `Periodo: ${timeSliderPeriods[timeSliderIndex]}`;
        }
    }

    function getSelectedTimePeriod() {
        if (!timeSliderEnabled || !timeSliderPeriods.length) return null;
        return timeSliderPeriods[timeSliderIndex] || null;
    }

    function handleTimeSliderInput(value) {
        timeSliderIndex = Number(value) || 0;

        const selectedPeriod = timeSliderPeriods[timeSliderIndex];

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
        const activeLayer = layerGlobal || (Array.isArray(layersGlobal) && layersGlobal.length ? layersGlobal[0] : null);

        if (!activeLayer || !activeConfig) return;
        if (!timeSliderEnabled || !timeSliderPeriods?.length) return;

        timeSliderTouched = timeSliderIndex > 0;

        if (
            activeConfig?.id === "deforestacion" ||
            activeConfig?.ecosistemaType === "deforestacion"
        ) {
            const periodo = selectedPeriod || "Todos";
            deforestacionPeriodoActivo = periodo;

            const baseWhereStable =
                (getWhereBase() && String(getWhereBase()).trim())
                    ? getWhereBase()
                    : "1=1";

            if (periodo === "Todos") {
                if (activeLayer?.definitionExpression !== baseWhereStable) {
                    applyWhereToActiveLayers(baseWhereStable);
                }
            } else {
                const periodoSafe = String(periodo).replace(/'/g, "''");
                const wherePeriodo = `${baseWhereStable} AND periodobosque = '${periodoSafe}'`;

                if (activeLayer?.definitionExpression !== wherePeriodo) {
                    applyWhereToActiveLayers(wherePeriodo);
                }
            }

            requestAnimationFrame(() => {
                actualizarGrafica(activeLayer, activeConfig, { skipSyncMap: true });
            });
            return;
        }

        if (
            activeConfig?.isClima &&
            activeConfig?.isStacked &&
            activeConfig?.periodField &&
            ["temp", "precip", "temp_cc", "precip_cc"].includes(activeConfig.climaType)
        ) {
            const baseWhereStable =
                (getWhereBase() && String(getWhereBase()).trim())
                    ? getWhereBase()
                    : "1=1";

            if (timeSliderIndex === 0) {
                if (getLayerGlobal()?.definitionExpression !== baseWhereStable) {
                    applyWhereToActiveLayers(baseWhereStable);
                }

                requestAnimationFrame(() => {
                    actualizarGrafica(activeLayer, activeConfig);
                });
                return;
            }

            const selectedPeriodSafe = String(selectedPeriod ?? "").replace(/'/g, "''");
            const wherePeriodo = `${baseWhereStable} AND ${activeConfig.periodField} = '${selectedPeriodSafe}'`;

            if (getLayerGlobal()?.definitionExpression !== wherePeriodo) {
                applyWhereToActiveLayers(wherePeriodo);
            }

            requestAnimationFrame(() => {
                actualizarGrafica(activeLayer, activeConfig);
            });
            return;
        }

        actualizarGrafica(activeLayer, activeConfig);
    }

    function bindMasterSlider() {
        if (!masterSlider || !view) return;

        masterSlider.value = view.zoom;

        masterSlider.addEventListener("input", function () {
            if (getSliderMode() === "time") {
                handleTimeSliderInput(Number(this.value) || 0);
                return;
            }

            view.zoom = Number(this.value);
        });

        view.watch("zoom", function (z) {
            if (getSliderMode() === "zoom") {
                masterSlider.value = z;
            }
        });
    }

    return {
        bindMasterSlider,
        hideTimeSlider,
        showTimeSlider,
        getSelectedTimePeriod,
        handleTimeSliderInput,
        setTimeSliderTouched,
        isTimeSliderTouched
    };
}
