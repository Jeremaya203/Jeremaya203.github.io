/**
 * chart-controller.js - Router de gráficos y orquestador.
 * 
 * Contiene TODO lo que estaba en main.js sobre gráficos:
 * - buildCtx: construye el contexto para handlers
 * - syncMapLayer: sincroniza capa del mapa con whereBase
 * - defaultQueryAndRenderHandler: handler catch-all
 * - deps: dependencias para handlers
 * - HANDLERS: lista de handlers
 * - updateChart: router principal
 * 
 * Recibe el ctx (BiofisicoContext) y helpers de main.js.
 */

import { renderGenericChartFromFeatures } from "./chart-renderer.js?v=hipsometria-muni-height-20260619";
import { createBiofisicoChartHandlers } from "./chart-registry.js?v=degradacion-domain-labels-v2-20260724";
import { getAxisTitles } from "./chart-options.js";
import { buildChartTitleWithTerritory } from "../ui/ui-helpers.js?v=titulos-departamentales-20260617";

export function createChartController(mainDeps) {
    // mainDeps contiene referencias a funciones/estado que viven en el scope de main.js
   
    const {
        ctx,
        arcRestQuery,
        cachedQueryFeatures,
        cachedQueryExtent,
        createChart,
        destroyChartInstance,
        updateLegend,
        updateChartTitle,
        createDualLandformCharts,
        toggleLandformCharts,
        destroyLandformCharts,
        buildLandscapeDictionaryFromRenderer,
        loadCurrentLayer,
        applyWhereToActiveLayers,
        applyLegendFilter,
        updateLegendByExtent,
        getView,
        getChartInstance,
        setChartInstance,
        setOnlyCategoryCodeActive,
        restoreAllChartCategories,
        getTimeSliderIndex,
        getTimeSliderTouched,
        getTimeSliderPeriods,
        hideTimeSlider,
        showTimeSlider,
        // dependencias del deps original
        pctOfTotal,
        toNum,
        wrapLabel,
        sortMonths,
        fetchBF3Stats,
        fetchGroupedStats,
        getSymbolColorRGBA,
        buildLegendFromRenderer,
        ensureNonEmptyOrExit,
        pickExistingField,
        buildDictFromUniqueValueRenderer,
        createSoilOrderBubbleChart,
        getGeoformasRendererDict,
        getLandscapeColor,
        getLandformColor,
        normKey,
        getColoresOrdenSuelo,
        // helpers del time slider
        getDeforestacionPeriodoActivo,
        getDeforestacionPeriodosBase,
        setDeforestacionPeriodosBase,
        createDualLandSuitabilityCharts,
        measureBiofisicoAsync,
        recordBiofisicoMetric
    } = mainDeps;

    // =====================
    // buildCtx
    // =====================
    function buildCtx(layer, config, options = {}) {
        const lyr = (ctx.layerGlobal) ? ctx.layerGlobal : layer;
        const ownerMode = ctx.currentMode;
        const ownerSubLayerIndex = ctx.currentSubLayerIndex;
        const ownerConfigId = config?.id || "";
        const isCurrentRenderTarget = () =>
            ctx.currentMode === ownerMode &&
            ctx.currentSubLayerIndex === ownerSubLayerIndex;
        const runIfCurrent = (fn, fallback) => (...args) => {
            if (!isCurrentRenderTarget()) return fallback;
            return fn(...args);
        };
        const queryFeatures = (targetLayer, targetQuery) => {
            if (options.prefetchedFeatures && typeof options.prefetchedFeaturesSignature === "string") {
                const outFields = Array.isArray(targetQuery?.outFields)
                    ? targetQuery.outFields.map(field => String(field)).sort().join(",")
                    : String(targetQuery?.outFields || "");
                const signature = JSON.stringify({
                    url: String(targetLayer?.url || ""),
                    layerId: String(targetLayer?.layerId ?? ""),
                    where: String(targetQuery?.where || targetLayer?.definitionExpression || "1=1"),
                    outFields,
                    returnGeometry: String(targetQuery?.returnGeometry ?? "")
                });

                if (signature === options.prefetchedFeaturesSignature) {
                    if (typeof recordBiofisicoMetric === "function") {
                        recordBiofisicoMetric("queryFeatures.prefetchHit", 0, {
                            layerUrl: String(targetLayer?.url || ""),
                            where: String(targetQuery?.where || "")
                        });
                    }
                    return options.prefetchedFeatures;
                }
            }

            const query = cachedQueryFeatures || ((currentLayer, currentQuery) => currentLayer.queryFeatures(currentQuery));
            return query(targetLayer, targetQuery);
        };

        return {
            layer, lyr, config,
            territoryLevel: ctx.territoryLevel,
            whereBase: (ctx.whereBase && String(ctx.whereBase).trim()) ? ctx.whereBase : "1=1",
            currentDepartmentId: ctx.currentDepartmentId,
            currentMunicipalityId: ctx.currentMunicipalityId,
            departmentNames: ctx.departmentNames,
            municipalityNames: ctx.municipalityNames,
            arcRestQuery,
            cachedQueryFeatures,
            cachedQueryExtent,
            queryFeatures,
            createChart: runIfCurrent(createChart),
            updateLegend: runIfCurrent(updateLegend),
            updateChartTitle: runIfCurrent(updateChartTitle),
            destroyChart: () => {
                if (!isCurrentRenderTarget()) return;
                if (typeof destroyChartInstance === "function") {
                    destroyChartInstance();
                    return;
                }
                const ci = getChartInstance();
                if (ci) ci.destroy();
            },
            setTitle: (t) => {
                if (!isCurrentRenderTarget()) return;
                const el = document.getElementById("chartTitle");
                if (el) {
                    el.textContent = buildChartTitleWithTerritory(t, {
                        deps: {
                            territoryLevel: ctx.territoryLevel,
                            currentDepartmentId: ctx.currentDepartmentId,
                            currentMunicipalityId: ctx.currentMunicipalityId,
                            departmentNames: ctx.departmentNames,
                            municipalityNames: ctx.municipalityNames
                        }
                    });
                }
            },
            setChartMessage: (titleText, summaryText = titleText) => {
                if (!isCurrentRenderTarget()) return;

                if (typeof destroyChartInstance === "function") {
                    destroyChartInstance();
                } else {
                    const ci = getChartInstance();
                    if (ci) ci.destroy();
                }

                const canvas = document.getElementById("chart");
                if (canvas?.getContext) {
                    try {
                        const canvasCtx = canvas.getContext("2d");
                        canvasCtx?.clearRect(0, 0, canvas.width || 0, canvas.height || 0);
                    } catch (_) {}
                }

                const title = document.getElementById("chartTitle");
                const summary = document.getElementById("summaryDiv");

                if (title) title.textContent = titleText || "";
                if (summary) summary.textContent = summaryText || "";
            },
            isCurrentRenderTarget,
            ownerMode,
            ownerSubLayerIndex,
            ownerConfigId,
            cycleId: ctx.renderCycleId,
            skipSyncMap: !!options.skipSyncMap,
            getView,
            getLayerGlobal: () => ctx.layerGlobal,
            getChartInstance,
            setChartInstance,
            setOnlyCategoryCodeActive,
            restoreAllChartCategories,
            getWhereBase: () => ctx.whereBase,
            setWhereBase: (value) => { ctx.whereBase = value; },
            getTimeSliderIndex,
            getTimeSliderTouched,
            getTimeSliderPeriods,
            getBf3LabelToCode: () => ctx.bf3LabelToCode,
            setBf3LabelToCode: (v) => { ctx.bf3LabelToCode = v; },
            getCurrentMode: () => ctx.currentMode,
            getRenderCycleId: () => ctx.renderCycleId,
            applyWhereToActiveLayers,
            updateLegendByExtent,
            loadCurrentLayer,
            createDualLandformCharts,
            toggleLandformCharts,
            destroyLandformCharts,
            buildLandscapeDictionaryFromRenderer
        };
    }

    // =====================
    // syncMapLayer
    // =====================
    async function syncMapLayer(chartCtx) {
        const lyr = chartCtx.lyr || chartCtx.layer;
        if (!lyr) return;

        lyr.visible = true;

        if (typeof lyr.opacity === "number" && lyr.opacity === 0) {
            lyr.opacity = 0.7;
        }

        const nextWhere = chartCtx.whereBase || "1=1";
        let shouldRefresh = false;

        try {
            shouldRefresh = String(lyr.definitionExpression || "") !== String(nextWhere);
            if (shouldRefresh) {
                lyr.definitionExpression = nextWhere;
            }
        } catch (_) {}

        if (shouldRefresh) {
            try { lyr.refresh(); } catch (_) {}
        }

        // Reaplicar filtro de leyenda encima del whereBase
        try {
            if (window.__legendState?.field) {
                if (typeof applyLegendFilter === "function") {
                    await applyLegendFilter();
                }
            }
        } catch (_) {}
    }

    // =====================
    // defaultQueryAndRenderHandler
    // =====================
    function defaultQueryAndRenderHandler() {
        return {
            id: "default-generic",
            when: (_c) => true,
            run: async (chartCtx) => {
                const thisCycle = chartCtx.cycleId;
                const thisLayer = chartCtx.layer;

                if (!thisLayer || thisLayer.destroyed) return;
                if (thisCycle !== ctx.renderCycleId) return;

                const q = thisLayer.createQuery();
                q.where = chartCtx.whereBase;
                q.outFields = chartCtx.config.outFields;
                q.returnGeometry = false;

                let res;
                try {
                    res = await (chartCtx.queryFeatures || chartCtx.cachedQueryFeatures || ((targetLayer, targetQuery) => targetLayer.queryFeatures(targetQuery)))(thisLayer, q);
                } catch (e) {
                    const msg = String(e?.message || "").toLowerCase();
                    if (
                        e?.name === "AbortError" ||
                        msg.includes("aborted") ||
                        msg.includes("instance of 'esri.layers.featurelayer' is already destroyed") ||
                        msg.includes("instance-destroyed")
                    ) {
                        return;
                    }
                    console.error("defaultQueryAndRenderHandler queryFeatures error:", e);
                    chartCtx.destroyChart();
                    chartCtx.updateLegend([], []);
                    return;
                }

                if (thisCycle !== ctx.renderCycleId) return;
                if (!thisLayer || thisLayer.destroyed) return;
                if (thisLayer !== ctx.layerGlobal && !ctx.layersGlobal.includes(thisLayer)) return;

                // Fallback depto dpcodigo numerico
                if (chartCtx.territoryLevel === "DEPTO" && chartCtx.currentDepartmentId && res.features?.length === 0) {
                    const n = Number(chartCtx.currentDepartmentId);
                    if (Number.isFinite(n)) {
                        const altWhere = `dpcodigo = ${n}`;
                        if (chartCtx.whereBase !== altWhere) {
                            chartCtx.setWhereBase(altWhere);
                            ctx.whereBase = altWhere;
                            applyWhereToActiveLayers(altWhere);
                            loadCurrentLayer();
                            return;
                        }
                    }
                }

                let mpnombre = null;
                let dpnombre = null;
                if (res.features.length > 0) {
                    mpnombre = res.features[0].attributes.mpnombre;
                    dpnombre = res.features[0].attributes.dpnombre;
                }
                if ((!mpnombre || !isNaN(mpnombre)) && chartCtx.currentMunicipalityId) {
                    mpnombre = chartCtx.municipalityNames?.[chartCtx.currentMunicipalityId] || chartCtx.currentMunicipalityId;
                }
                if ((!dpnombre || !isNaN(dpnombre)) && chartCtx.currentMunicipalityId) {
                    const dpCode = String(chartCtx.currentMunicipalityId).substring(0, 2);
                    dpnombre = chartCtx.departmentNames?.[dpCode] || dpCode;
                }

                if (!chartCtx.isCurrentRenderTarget?.()) return;
                chartCtx.updateChartTitle(chartCtx.config, mpnombre, dpnombre);
                renderGenericChartFromFeatures(chartCtx, res.features, { hideTimeSlider });
            }
        };
    }

    // =====================
    // deps (para los handlers externos)
    // =====================
    const deps = {
        pctOfTotal,
        toNum,
        wrapLabel,
        sortMonths,
        arcRestQuery,
        cachedQueryFeatures,
        cachedQueryExtent,
        fetchBF3Stats,
        fetchGroupedStats,
        getSymbolColorRGBA,
        buildLegendFromRenderer,
        ensureNonEmptyOrExit,
        pickExistingField,
        buildDictFromUniqueValueRenderer,
        createSoilOrderBubbleChart,
        createDualLandformCharts,
        createDualLandSuitabilityCharts,
        toggleLandformCharts,
        destroyLandformCharts,
        getAxisTitles,
        hypsometricColors: (typeof hypsometricColors !== "undefined" ? hypsometricColors : window.hypsometricColors),
        getGeoformasRendererDict,
        getLandscapeColor,
        getLandformColor,
        normKey,
        temperatureColors: (typeof temperatureColors !== "undefined" ? temperatureColors : window.temperatureColors),
        precipitationColors: (typeof precipitationColors !== "undefined" ? precipitationColors : window.precipitationColors),
        temperatureChangeColors: (typeof temperatureChangeColors !== "undefined" ? temperatureChangeColors : window.temperatureChangeColors),
        precipitationChangeColors: (typeof precipitationChangeColors !== "undefined" ? precipitationChangeColors : window.precipitationChangeColors),
        climateColors: (typeof climateColors !== "undefined" ? climateColors : window.climateColors),
        basinColors: (typeof basinColors !== "undefined" ? basinColors : window.basinColors),
        runoffColors: (typeof runoffColors !== "undefined" ? runoffColors : window.runoffColors),
        ecosystemConditionColors: (typeof ecosystemConditionColors !== "undefined" ? ecosystemConditionColors : window.ecosystemConditionColors),
        ecosystemColors: (typeof ecosystemColors !== "undefined" ? ecosystemColors : window.ecosystemColors),
        getColoresOrdenSuelo,
        conflictColors: (typeof conflictColors !== "undefined" ? conflictColors : window.conflictColors),
        floodColors: (typeof floodColors !== "undefined" ? floodColors : window.floodColors),
        massRemovalColors: (typeof massRemovalColors !== "undefined" ? massRemovalColors : window.massRemovalColors),
        degradationColors: (typeof degradationColors !== "undefined" ? degradationColors : window.degradationColors),
        degradationClassColors: (typeof degradationClassColors !== "undefined" ? degradationClassColors : window.degradationClassColors),
        seismicColors: (typeof seismicColors !== "undefined" ? seismicColors : window.seismicColors),
        showTimeSlider,
        hideTimeSlider,
        getChart: getChartInstance,
        getTimeSliderIndex,
        setTimeSliderIndex: (value) => { ctx.timeSliderIndex = value; },
        getTimeSliderTouched,
        getTimeSliderPeriods,
        getDeforestacionPeriodoActivo,
        getDeforestacionPeriodosBase,
        setDeforestacionPeriodosBase
    };

    const externalHandlers = createBiofisicoChartHandlers(deps);
    const HANDLERS = [
        ...externalHandlers,
        defaultQueryAndRenderHandler()
    ];

    // =====================
    // updateChart
    // =====================
    async function runChartUpdate(layer, config, options = {}) {
        const chartCtx = buildCtx(layer, config, options);

        if (!chartCtx.skipSyncMap) {
            await syncMapLayer(chartCtx);
        }

        for (const h of HANDLERS) {
            if (h.when(chartCtx)) {
                await h.run(chartCtx);
                return;
            }
        }
    }

    async function updateChart(layer, config, options = {}) {
        if (typeof measureBiofisicoAsync === "function") {
            return measureBiofisicoAsync(
                "updateChart",
                () => runChartUpdate(layer, config, options),
                {
                    configId: config?.id || "",
                    mode: ctx.currentMode,
                    where: ctx.whereBase || "1=1",
                    skipSyncMap: !!options.skipSyncMap
                }
            );
        }

        return runChartUpdate(layer, config, options);
    }

    return {
        updateChart,
        buildCtx,
        syncMapLayer,
        deps,
        HANDLERS
    };
}
