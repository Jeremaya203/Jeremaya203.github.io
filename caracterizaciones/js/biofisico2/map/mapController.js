import {
    buildActiveLayerRenderKey,
    getMapNow,
    hasRenderableActiveLayer,
    isStaleLayerRender
} from "./mapUtils.js";
import { getBiofisicoMapRegistryEntry } from "./mapRegistry.js";
import {
    createBiofisicoFeatureLayer,
    createBiofisicoVariantLayers,
    configureVariantLayerLabels
} from "./mapLayerFactory.js?v=cuencas-no-map-labels-20260617";
import {
    buildFeatureQuerySignature,
    createChartPrefetchQuery,
    createExtentQuery
} from "./mapQueryBuilder.js";
import {
    addBiofisicoLayerToMap,
    clearLayerViewFilter,
    createStationaryLegendWatcher,
    setVisibleLayer,
    updateLayerLegend,
    zoomToLayerExtent
} from "./mapRenderer.js";

export function createMapController({ getState }) {
    let activeLayerRenderKey = "";
    let activeLayerStructureKey = "";

    function getRenderKey(config) {
        const state = getState();
        const registryEntry = getBiofisicoMapRegistryEntry(config);

        return buildActiveLayerRenderKey({
            config,
            currentMode: state.currentMode,
            currentSubLayerIndex: state.currentSubLayerIndex,
            whereBase: state.whereBase,
            filtroNivel: state.filtroNivel,
            municipioActual: state.municipioActual,
            deptoActual: state.deptoActual,
            registryEntry
        });
    }

    function hasActiveRenderableLayer() {
        const state = getState();
        return hasRenderableActiveLayer({
            layerGlobal: state.layerGlobal,
            layersGlobal: state.layersGlobal
        });
    }

    function getChartLayerForConfig(deps, fallbackLayer) {
        const chartVariantKey = deps.config?.chartVariantKey;
        if (!chartVariantKey) return fallbackLayer;

        const chartVariant = (deps.config.variants || []).find(variant => variant.key === chartVariantKey);
        if (!chartVariant) return fallbackLayer;

        const layers = deps.getLayersGlobal?.() || [];
        return layers.find(layer => String(layer.url || "") === String(chartVariant.url || "")) || fallbackLayer;
    }

    function buildLayerStructureKey(config) {
        const variantKeys = Array.isArray(config?.variants)
            ? config.variants.map(variant => variant.key || variant.url).join("|")
            : "";

        const state = getState();
        return [
            state.currentMode,
            state.currentSubLayerIndex,
            config?.id || "",
            config?.url || "",
            variantKeys
        ].join("::");
    }

    function buildRiesgoCcDepartmentWhere(deps) {
        if (deps.config?.id !== "riesgo_cc" || !deps.getMunicipioActual?.()) {
            return null;
        }

        const municipio = String(deps.getMunicipioActual?.() || "").trim();
        const depto = String(deps.getDeptoActual?.() || municipio.substring(0, 2)).trim();
        if (!depto) return null;

        return `dpcodigo = '${depto.replace(/'/g, "''")}'`;
    }

    function getMapWhereForConfig(deps) {
        return buildRiesgoCcDepartmentWhere(deps) || deps.getWhereBase() || "1=1";
    }

function canReuseSingleLayer(deps, config, nextStructureKey) {
        if (!config || Array.isArray(config.variants) && config.variants.length) return false;
        if (nextStructureKey !== activeLayerStructureKey) return false;

        const currentLayer = deps.getLayerGlobal?.();
        if (!currentLayer || currentLayer.destroyed) return false;

        return String(currentLayer.url || "") === String(config.url || "");
    }

    function shouldDeferLayerVisibility(config) {
        return config?.id === "pendientes" && config?.isPendientesPolar === true;
    }

    function shouldRenderChartBeforeMap(deps) {
        if (deps.config?.id !== "hipsometria") return false;

        const deptValue = String(document.getElementById("departamentos")?.value || deps.getDeptoActual?.() || "").trim();
        const muniValue = String(document.getElementById("municipios")?.value || deps.getMunicipioActual?.() || "").trim();

        return Boolean(deptValue && deptValue !== "0" && deptValue !== "COL" && !muniValue);
    }

    function revealLayerWhenReady({ layer, config, zoomPromise, isCurrent }) {
        if (!shouldDeferLayerVisibility(config)) return;

        Promise.resolve(zoomPromise)
            .catch(() => {})
            .finally(() => {
                if (typeof isCurrent === "function" && !isCurrent()) return;
                if (layer && !layer.destroyed) {
                    layer.visible = true;
                }
            });
    }

    function renderActiveLayer(deps) {
        const cargarCapaStart = getMapNow();
        const config = deps.getActiveLayerConfig();
        if (!config) return;

        const nextRenderKey = getRenderKey(config);
        if (nextRenderKey === activeLayerRenderKey && hasActiveRenderableLayer()) {
            const activeLayer = deps.getChartLayerGlobal?.() || deps.getLayerGlobal?.();
            if (activeLayer) {
                deps.actualizarGrafica(activeLayer, config);
            }
            deps.actualizarResumen();
            return;
        }

        const nextStructureKey = buildLayerStructureKey(config);
        if (canReuseSingleLayer(deps, config, nextStructureKey)) {
            const currentCycle = deps.incrementRenderCycle();
            activeLayerRenderKey = nextRenderKey;
            renderReusedSingleLayer({
                ...deps,
                config,
                currentCycle,
                cargarCapaStart
            });
            return;
        }

        deps.clearLayers();
        const currentCycle = deps.incrementRenderCycle();
        activeLayerRenderKey = nextRenderKey;
        activeLayerStructureKey = nextStructureKey;

        if (Array.isArray(config.variants) && config.variants.length) {
            renderVariantLayers({
                ...deps,
                config,
                cargarCapaStart
            });
            return;
        }

        renderSingleLayer({
            ...deps,
            config,
            currentCycle,
            cargarCapaStart
        });
    }

    function renderVariantLayers(deps) {
        const vLayers = createBiofisicoVariantLayers({
            FeatureLayer: deps.FeatureLayer,
            config: deps.config,
            definitionExpression: deps.buildDefinitionExpression({
                baseWhere: deps.getWhereBase()
            })
        });

        vLayers.forEach(({ layer }) => {
            deps.map.add(layer);
            layer.when(() => configureVariantLayerLabels(layer));
        });

        const layers = vLayers.map(x => x.layer);
        deps.setLayersGlobal(layers);

        const active = deps.pickLayerByScale(layers, deps.view);
        setVisibleLayer(layers, active);
        deps.setLayerGlobal(active);
        deps.syncStateFromGlobals();

        window.activeFeatureLayer = active;
        clearLayerViewFilter(deps.view, active);
        const legendTitle = (deps.config.id === "geoformas")
            ? deps.getGeoformasScaleTitle(deps.view.scale)
            : deps.config.title;

        deps.setLegendLayer(active, legendTitle);
        deps.replaceScaleHandle(createVariantScaleWatcher(deps));

        active.when(async () => {
            zoomToLayerExtent({
                view: deps.view,
                layer: active,
                where: deps.getWhereBase(),
                cachedQueryExtent: deps.cachedQueryExtent,
                createExtentQuery
            }).catch(() => {});

            if (deps.config.isGeoforma && deps.config.isGeoformaDualChart) {
                try {
                    await deps.ensureGeoformasDict();
                } catch (e) {
                    console.warn("No se pudo cargar dict geoformas:", e);
                }
            }

            const chartLayer = deps.config.chartVariantKey
                ? (vLayers.find(v => v.key === deps.config.chartVariantKey)?.layer || getChartLayerForConfig(deps, active))
                : active;

            await chartLayer.when();
            deps.actualizarGrafica(chartLayer, deps.config, {
                skipSyncMap: chartLayer !== active
            });
            updateLayerLegend({
                layer: active,
                config: deps.config,
                updateLegendByExtent: deps.updateLegendByExtent,
                buildLegendFromRenderer: deps.buildLegendFromRenderer,
                actualizarLeyenda: deps.actualizarLeyenda
            });

            deps.actualizarResumen();
            deps.recordBiofisicoMetric(
                "cargarCapaActual.variants",
                getMapNow() - deps.cargarCapaStart,
                {
                    configId: deps.config.id,
                    mode: deps.getCurrentMode(),
                    where: deps.getWhereBase() || "1=1"
                }
            );
        });
    }

    function createVariantScaleWatcher(deps) {
        const onScale = deps.debounce(() => {
            if (deps.getFiltroNivel() === "MUNI" && !deps.getMunicipioActual()) return;
            if (deps.getFiltroNivel() === "DEPTO" && !deps.getDeptoActual()) return;

            const currentLayer = deps.getLayerGlobal();
            if (currentLayer) {
                const lid = Number(currentLayer.layerId);
                if ([19, 20, 21].includes(lid)) {
                    currentLayer.labelsVisible = false;
                    currentLayer.labelingInfo = [];
                } else {
                    currentLayer.labelsVisible = false;
                    currentLayer.labelingInfo = currentLayer.labelingInfo || [];
                }
            }

            const scaleChange = deps.setActiveVariantLayerByScale();
            window.activeFeatureLayer = deps.getLayerGlobal();

            if (deps.getLayerGlobal()) {
                deps.updateLegendByExtent?.(deps.getLayerGlobal(), deps.config);
            }

            if (deps.config?.id === "geoformas") {
                const legendTitle = deps.getGeoformasScaleTitle?.(deps.view.scale) || deps.config.title;
                deps.setLegendLayer?.(deps.getLayerGlobal(), legendTitle);

                if (scaleChange?.changed) {
                    const chartLayer = getChartLayerForConfig(deps, deps.getLayerGlobal());
                    chartLayer?.when?.(() => {
                        deps.actualizarGrafica?.(chartLayer, deps.config, {
                            skipSyncMap: chartLayer !== deps.getLayerGlobal()
                        });
                    });
                }
            }
        }, 180);

        return deps.view.watch("scale", onScale);
    }

    function renderSingleLayer(deps) {
        const deferVisibility = shouldDeferLayerVisibility(deps.config);
        const mapWhere = getMapWhereForConfig(deps);
        const newLayer = createBiofisicoFeatureLayer({
            FeatureLayer: deps.FeatureLayer,
            config: deps.config,
            definitionExpression: deps.buildDefinitionExpression({
                baseWhere: mapWhere
            }),
            visible: !deferVisibility
        });

        if (deps.config.id === "cuencas_depto") {
            newLayer.labelsVisible = false;
        }

        deps.setLayerGlobal(newLayer);
        deps.setLegendLayer(newLayer, deps.config.title);
        deps.actualizarFuente(newLayer);
        const chartBeforeMap = shouldRenderChartBeforeMap(deps);

        if (chartBeforeMap) {
            deps.actualizarGrafica(newLayer, deps.config, { skipSyncMap: true });
        }

        addBiofisicoLayerToMap(deps.map, newLayer);

        if (
            deps.getCurrentMode() === "CLIMA" &&
            deps.config.isClima &&
            (deps.config.climaType === "temp" || deps.config.climaType === "precip")
        ) {
            const st = deps.ensureStationsLayer();
            st.definitionExpression = deps.getWhereBase();
            deps.map.add(st);
        }

        deps.actualizarResumen();

        deps.view.whenLayerView(newLayer)
            .then(layerView => {
                deps.setLayerViewGlobal(layerView);
                layerView.filter = null;
            })
            .catch(e => {
                if (String(e?.name || "").includes("cancelled:layerview-create")) return;
                if (String(e?.message || "").toLowerCase().includes("cancelled")) return;
                console.error("whenLayerView error:", e);
            });

        newLayer.when(async () => {
            if (isStaleLayerRender({
                currentCycle: deps.currentCycle,
                renderCycleId: deps.getRenderCycleId(),
                layerGlobal: deps.getLayerGlobal(),
                expectedLayer: newLayer
            })) return;

            const zoomPromise = zoomToLayerExtent({
                view: deps.view,
                layer: newLayer,
                where: mapWhere,
                cachedQueryExtent: deps.cachedQueryExtent,
                createExtentQuery,
                beforeGoTo: () => !isStaleLayerRender({
                    currentCycle: deps.currentCycle,
                    renderCycleId: deps.getRenderCycleId(),
                    layerGlobal: deps.getLayerGlobal(),
                    expectedLayer: newLayer
                })
            }).catch(e => {
                if (e?.name === "AbortError" || String(e?.message || "").toLowerCase().includes("aborted")) return;
                console.error("queryExtent error:", e);
            });
            void zoomPromise;
            deps.highlightRiesgoCcMunicipio?.(newLayer);
            revealLayerWhenReady({
                layer: newLayer,
                config: deps.config,
                zoomPromise,
                isCurrent: () => !isStaleLayerRender({
                    currentCycle: deps.currentCycle,
                    renderCycleId: deps.getRenderCycleId(),
                    layerGlobal: deps.getLayerGlobal(),
                    expectedLayer: newLayer
                })
            });

            if (deps.config.isSuelos && deps.config.suelosType === "orden") {
                try {
                    await deps.ensureOrdenSueloDict(deps.config.url);
                } catch (e) {
                    console.warn("No se pudo cargar dict orden suelo:", e);
                }
            }

            if (isStaleLayerRender({
                currentCycle: deps.currentCycle,
                renderCycleId: deps.getRenderCycleId(),
                layerGlobal: deps.getLayerGlobal(),
                expectedLayer: newLayer
            })) return;

            if (deps.config.isGeoforma && deps.config.isGeoformaDualChart) {
                try {
                    await deps.ensureGeoformasDict(deps.config.url);
                } catch (e) {
                    console.warn("No se pudo cargar dict geoformas:", e);
                }
            }

            if (isStaleLayerRender({
                currentCycle: deps.currentCycle,
                renderCycleId: deps.getRenderCycleId(),
                layerGlobal: deps.getLayerGlobal(),
                expectedLayer: newLayer
            })) return;

            if (!chartBeforeMap) {
                const chartLayer = getChartLayerForConfig(deps, newLayer);
                await chartLayer.when();
                const chartOptions = {};
                const prefetchedChartQuery = createChartPrefetchQuery(chartLayer, deps.config, deps.getWhereBase());
                if (prefetchedChartQuery) {
                    chartOptions.prefetchedFeatures = deps.cachedQueryFeatures(chartLayer, prefetchedChartQuery);
                    chartOptions.prefetchedFeaturesSignature = buildFeatureQuerySignature(chartLayer, prefetchedChartQuery);
                }

                deps.actualizarGrafica(chartLayer, deps.config, {
                    ...chartOptions,
                    skipSyncMap: chartLayer !== newLayer ||
                        (deps.config?.isClima && deps.config?.climaType === "riesgo_cc")
                });
            }

            if (isStaleLayerRender({
                currentCycle: deps.currentCycle,
                renderCycleId: deps.getRenderCycleId(),
                layerGlobal: deps.getLayerGlobal(),
                expectedLayer: newLayer
            })) return;

            updateLayerLegend({
                layer: newLayer,
                config: deps.config,
                updateLegendByExtent: deps.updateLegendByExtent,
                buildLegendFromRenderer: deps.buildLegendFromRenderer,
                actualizarLeyenda: deps.actualizarLeyenda
            });

            deps.recordBiofisicoMetric(
                "cargarCapaActual.layerReady",
                getMapNow() - deps.cargarCapaStart,
                {
                    configId: deps.config.id,
                    mode: deps.getCurrentMode(),
                    where: mapWhere || "1=1"
                }
            );
        });

        deps.replaceScaleHandle(createStationaryLegendWatcher({
            view: deps.view,
            layer: newLayer,
            getLayerGlobal: deps.getLayerGlobal,
            getActiveLayerConfig: deps.getActiveLayerConfig,
            updateLegendByExtent: deps.updateLegendByExtent
        }));
    }

    function renderReusedSingleLayer(deps) {
        const layer = deps.getLayerGlobal();
        const where = getMapWhereForConfig(deps);
        const deferVisibility = shouldDeferLayerVisibility(deps.config);
        const definitionExpression = deps.buildDefinitionExpression({
            baseWhere: where
        });

        layer.definitionExpression = definitionExpression;
        layer.visible = !deferVisibility;
        window.activeFeatureLayer = layer;
        const chartBeforeMap = shouldRenderChartBeforeMap(deps);

        deps.setLegendLayer(layer, deps.config.title);

        if (
            deps.getCurrentMode() === "CLIMA" &&
            deps.config.isClima &&
            (deps.config.climaType === "temp" || deps.config.climaType === "precip")
        ) {
            const st = deps.ensureStationsLayer();
            st.definitionExpression = where;
            try {
                deps.map.add(st);
            } catch (_) {}
        }

        deps.actualizarResumen();
        if (chartBeforeMap) {
            deps.actualizarGrafica(layer, deps.config, { skipSyncMap: true });
        }

        clearLayerViewFilter(deps.view, layer);

        layer.when(async () => {
            if (isStaleLayerRender({
                currentCycle: deps.currentCycle,
                renderCycleId: deps.getRenderCycleId(),
                layerGlobal: deps.getLayerGlobal(),
                expectedLayer: layer
            })) return;

            const zoomPromise = zoomToLayerExtent({
                view: deps.view,
                layer,
                where,
                cachedQueryExtent: deps.cachedQueryExtent,
                createExtentQuery,
                beforeGoTo: () => !isStaleLayerRender({
                    currentCycle: deps.currentCycle,
                    renderCycleId: deps.getRenderCycleId(),
                    layerGlobal: deps.getLayerGlobal(),
                    expectedLayer: layer
                })
            }).catch(e => {
                if (e?.name === "AbortError" || String(e?.message || "").toLowerCase().includes("aborted")) return;
                console.error("queryExtent error:", e);
            });
            void zoomPromise;
            deps.highlightRiesgoCcMunicipio?.(layer);
            revealLayerWhenReady({
                layer,
                config: deps.config,
                zoomPromise,
                isCurrent: () => !isStaleLayerRender({
                    currentCycle: deps.currentCycle,
                    renderCycleId: deps.getRenderCycleId(),
                    layerGlobal: deps.getLayerGlobal(),
                    expectedLayer: layer
                })
            });

            if (isStaleLayerRender({
                currentCycle: deps.currentCycle,
                renderCycleId: deps.getRenderCycleId(),
                layerGlobal: deps.getLayerGlobal(),
                expectedLayer: layer
            })) return;

            if (!chartBeforeMap) {
                const chartLayer = getChartLayerForConfig(deps, layer);
                await chartLayer.when();
                const chartOptions = {};
                const prefetchedChartQuery = createChartPrefetchQuery(chartLayer, deps.config, deps.getWhereBase());
                if (prefetchedChartQuery) {
                    chartOptions.prefetchedFeatures = deps.cachedQueryFeatures(chartLayer, prefetchedChartQuery);
                    chartOptions.prefetchedFeaturesSignature = buildFeatureQuerySignature(chartLayer, prefetchedChartQuery);
                }

                deps.actualizarGrafica(chartLayer, deps.config, {
                    ...chartOptions,
                    skipSyncMap: chartLayer !== layer ||
                        (deps.config?.isClima && deps.config?.climaType === "riesgo_cc")
                });
            }

            if (isStaleLayerRender({
                currentCycle: deps.currentCycle,
                renderCycleId: deps.getRenderCycleId(),
                layerGlobal: deps.getLayerGlobal(),
                expectedLayer: layer
            })) return;

            updateLayerLegend({
                layer,
                config: deps.config,
                updateLegendByExtent: deps.updateLegendByExtent,
                buildLegendFromRenderer: deps.buildLegendFromRenderer,
                actualizarLeyenda: deps.actualizarLeyenda
            });

            deps.recordBiofisicoMetric(
                "cargarCapaActual.reuseLayer",
                getMapNow() - deps.cargarCapaStart,
                {
                    configId: deps.config.id,
                    mode: deps.getCurrentMode(),
                    where: where || "1=1"
                }
            );
        });
    }

    return {
        getRenderKey,
        hasActiveRenderableLayer,
        getRegistryEntry: getBiofisicoMapRegistryEntry,
        renderActiveLayer,
        resetRenderKey() {
            activeLayerRenderKey = "";
            activeLayerStructureKey = "";
        }
    };
}
