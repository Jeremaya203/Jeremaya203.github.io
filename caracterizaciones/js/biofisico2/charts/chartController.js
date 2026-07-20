/**
 * chartController.js - Router de gráficos y orquestador.
 * 
 * Contiene TODO lo que estaba en main.js sobre gráficos:
 * - buildCtx: construye el contexto para handlers
 * - syncMapLayer: sincroniza capa del mapa con whereBase
 * - defaultQueryAndRenderHandler: handler catch-all
 * - deps: dependencias para handlers
 * - HANDLERS: lista de handlers
 * - actualizarGrafica: router principal
 * 
 * Recibe el ctx (BiofisicoContext) y helpers de main.js.
 */

import { renderGenericChartFromFeatures } from "./chartRenderer.js?v=hipsometria-muni-height-20260619";
import { createBiofisicoChartHandlers } from "./chartRegistry.js?v=pendientes-imageserver-20260716";
import { getAxisTitles } from "./chartOptions.js";
import { buildChartTitleWithTerritory } from "../ui/ui.helpers.js?v=titulos-departamentales-20260617";

export function createChartController(mainDeps) {
    // mainDeps contiene referencias a funciones/estado que viven en el scope de main.js
   
    const {
        ctx,
        arcRestQuery,
        cachedQueryFeatures,
        cachedQueryExtent,
        crearGrafica,
        destroyChartInstance,
        actualizarLeyenda,
        actualizarTituloGrafico,
        crearGraficasGeoformasDual,
        toggleGeoformasCharts,
        destroyGeoformasCharts,
        buildPaisajeDictFromRenderer,
        cargarCapaActual,
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
        ordenarMeses,
        fetchBF3Stats,
        fetchGroupedStats,
        getSymbolColorRGBA,
        buildLegendFromRenderer,
        ensureNonEmptyOrExit,
        pickExistingField,
        buildDictFromUniqueValueRenderer,
        crearGraficaBubbleOrdenSuelo,
        getGeoformasRendererDict,
        getPaisajeColor,
        getGeoformaColor,
        normKey,
        getColoresOrdenSuelo,
        // helpers del time slider
        getDeforestacionPeriodoActivo,
        getDeforestacionPeriodosBase,
        setDeforestacionPeriodosBase,
        crearGraficasVocacionDual,
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
            filtroNivel: ctx.filtroNivel,
            whereBase: (ctx.whereBase && String(ctx.whereBase).trim()) ? ctx.whereBase : "1=1",
            deptoActual: ctx.deptoActual,
            municipioActual: ctx.municipioActual,
            diccionarioDepartamentos: ctx.diccionarioDepartamentos,
            diccionarioMunicipios: ctx.diccionarioMunicipios,
            arcRestQuery,
            cachedQueryFeatures,
            cachedQueryExtent,
            queryFeatures,
            crearGrafica: runIfCurrent(crearGrafica),
            actualizarLeyenda: runIfCurrent(actualizarLeyenda),
            actualizarTituloGrafico: runIfCurrent(actualizarTituloGrafico),
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
                            filtroNivel: ctx.filtroNivel,
                            deptoActual: ctx.deptoActual,
                            municipioActual: ctx.municipioActual,
                            diccionarioDepartamentos: ctx.diccionarioDepartamentos,
                            diccionarioMunicipios: ctx.diccionarioMunicipios
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
            cargarCapaActual,
            crearGraficasGeoformasDual,
            toggleGeoformasCharts,
            destroyGeoformasCharts,
            buildPaisajeDictFromRenderer
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
                    chartCtx.actualizarLeyenda([], []);
                    return;
                }

                if (thisCycle !== ctx.renderCycleId) return;
                if (!thisLayer || thisLayer.destroyed) return;
                if (thisLayer !== ctx.layerGlobal && !ctx.layersGlobal.includes(thisLayer)) return;

                // Fallback depto dpcodigo numerico
                if (chartCtx.filtroNivel === "DEPTO" && chartCtx.deptoActual && res.features?.length === 0) {
                    const n = Number(chartCtx.deptoActual);
                    if (Number.isFinite(n)) {
                        const altWhere = `dpcodigo = ${n}`;
                        if (chartCtx.whereBase !== altWhere) {
                            chartCtx.setWhereBase(altWhere);
                            ctx.whereBase = altWhere;
                            applyWhereToActiveLayers(altWhere);
                            cargarCapaActual();
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
                if ((!mpnombre || !isNaN(mpnombre)) && chartCtx.municipioActual) {
                    mpnombre = chartCtx.diccionarioMunicipios?.[chartCtx.municipioActual] || chartCtx.municipioActual;
                }
                if ((!dpnombre || !isNaN(dpnombre)) && chartCtx.municipioActual) {
                    const dpCode = String(chartCtx.municipioActual).substring(0, 2);
                    dpnombre = chartCtx.diccionarioDepartamentos?.[dpCode] || dpCode;
                }

                if (!chartCtx.isCurrentRenderTarget?.()) return;
                chartCtx.actualizarTituloGrafico(chartCtx.config, mpnombre, dpnombre);
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
        ordenarMeses,
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
        crearGraficaBubbleOrdenSuelo,
        crearGraficasGeoformasDual,
        crearGraficasVocacionDual,
        toggleGeoformasCharts,
        destroyGeoformasCharts,
        getAxisTitles,
        coloresHipsometricos: (typeof coloresHipsometricos !== "undefined" ? coloresHipsometricos : window.coloresHipsometricos),
        getGeoformasRendererDict,
        getPaisajeColor,
        getGeoformaColor,
        normKey,
        coloresTemperatura: (typeof coloresTemperatura !== "undefined" ? coloresTemperatura : window.coloresTemperatura),
        coloresPrecipitacion: (typeof coloresPrecipitacion !== "undefined" ? coloresPrecipitacion : window.coloresPrecipitacion),
        coloresCambioTemp: (typeof coloresCambioTemp !== "undefined" ? coloresCambioTemp : window.coloresCambioTemp),
        coloresCambioPrecip: (typeof coloresCambioPrecip !== "undefined" ? coloresCambioPrecip : window.coloresCambioPrecip),
        coloresClimas: (typeof coloresClimas !== "undefined" ? coloresClimas : window.coloresClimas),
        coloresCuencas: (typeof coloresCuencas !== "undefined" ? coloresCuencas : window.coloresCuencas),
        coloresEscorrentia: (typeof coloresEscorrentia !== "undefined" ? coloresEscorrentia : window.coloresEscorrentia),
        coloresCondicionEcos: (typeof coloresCondicionEcos !== "undefined" ? coloresCondicionEcos : window.coloresCondicionEcos),
        coloresEcosistemas: (typeof coloresEcosistemas !== "undefined" ? coloresEcosistemas : window.coloresEcosistemas),
        getColoresOrdenSuelo,
        coloresConflictos: (typeof coloresConflictos !== "undefined" ? coloresConflictos : window.coloresConflictos),
        coloresInundaciones: (typeof coloresInundaciones !== "undefined" ? coloresInundaciones : window.coloresInundaciones),
        coloresRemocion: (typeof coloresRemocion !== "undefined" ? coloresRemocion : window.coloresRemocion),
        coloresDegradacion: (typeof coloresDegradacion !== "undefined" ? coloresDegradacion : window.coloresDegradacion),
        coloresClaseDegradacion: (typeof coloresClaseDegradacion !== "undefined" ? coloresClaseDegradacion : window.coloresClaseDegradacion),
        coloresSismica: (typeof coloresSismica !== "undefined" ? coloresSismica : window.coloresSismica),
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
    // actualizarGrafica
    // =====================
    async function runActualizarGrafica(layer, config, options = {}) {
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

    async function actualizarGrafica(layer, config, options = {}) {
        if (typeof measureBiofisicoAsync === "function") {
            return measureBiofisicoAsync(
                "actualizarGrafica",
                () => runActualizarGrafica(layer, config, options),
                {
                    configId: config?.id || "",
                    mode: ctx.currentMode,
                    where: ctx.whereBase || "1=1",
                    skipSyncMap: !!options.skipSyncMap
                }
            );
        }

        return runActualizarGrafica(layer, config, options);
    }

    return {
        actualizarGrafica,
        buildCtx,
        syncMapLayer,
        deps,
        HANDLERS
    };
}
