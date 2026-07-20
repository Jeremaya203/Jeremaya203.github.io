import { createChartCore } from "./core/chartCore.js";
import { createChartInteractions } from "./chartInteractions.js?v=pib-stable-bar-width-20260523";
import { createBarChartRenderer } from "./renderers/barChartRenderer.js?v=connectivity-tab-resize-20260716";
import { createTravelTimePieChartController } from "./infrastructure/travelTimePieChart.js?v=department-map-municipality-selection-20260717b";
import { createEducationBarChartController } from "./infrastructure/educationBarChart.js?v=tourism-legend-on-empty-chart-20260604";
import { createEquipamientosChartController } from "./infrastructure/equipamientosChart.js?v=equipamientos-bar-values-20260707b";
import { getRendererLegendItems, getRendererVisualForValue } from "./core/chartSymbolUtils.js?v=connectivity-line-style-legend-20260602";
import { createPublicServicesRadarChartController } from "./conditions/publicServicesRadarChart.js?v=department-map-municipality-selection-20260717";
import { createPovertyGroupedBarChartController } from "./povertyGroupedBarChart.js?v=poverty-first-entry-visible-message-20260604";
import { createEconomicActivitiesBarChartController } from "./dynamics/economicActivitiesBarChart.js?v=economic-no-scroll-20260707";
import {
    chartRequiresMunicipality,
    hasMunicipalitySelection,
    showMunicipalityRequiredChartState
} from "./ui/municipalityRequiredState.js?v=global-municipality-required-state-20260604";

// Dynamic charts configs
import { createLivestockCensusBarChartController } from "../charts/dynamics/livestockCensusBarChart.js?v=global-safe-zoom-labels-20260604";
import { createGreenBusinessFloatingBarChartController } from "../charts/dynamics/greenBusinessFloatingBarChart.js?v=irrigation-pointer-pan-20260604";
import { createEvaPieChartController } from "./dynamics/evaPieChart.js?v=eva-area-bar-values-20260707e";

export function createPibBarChartController({
    getActiveLayerConfig,
    getChartInstance,
    setChartInstance,
    getWhereBase,
    getFiltroNivel,
    getDeptoActual,
    getMunicipioActual,        // ← NUEVO: agregar este parámetro
    getDiccionarioDepartamentos,
    getLayerGlobal,
    getLayersGlobal,
    getChartLayerGlobal,
    getView,
    getHighlightHandle,
    setHighlightHandle,
    applyWhereToActiveLayers,
    refreshSummary,
    destroyGeoformasCharts
}) {
    const chartCore = createChartCore({
        getChartInstance,
        setChartInstance,
        onDestroy: () => document.getElementById("pibChartStatus")?.remove()
    });

    const chartInteractions = createChartInteractions({
        chartCore,
        getView,
        getLayerGlobal,
        getLayersGlobal,
        getHighlightHandle,
        setHighlightHandle,
        applyWhereToActiveLayers,
        getDiccionarioDepartamentos
    });

    const barRenderer = createBarChartRenderer({
        chartCore,
        chartInteractions,
        getWhereBase,
        getFiltroNivel,
        getDeptoActual,
        getDiccionarioDepartamentos,
        getLayersGlobal,
        applyWhereToActiveLayers,
        destroyGeoformasCharts
    });
    
    const travelTimePieController = createTravelTimePieChartController({
        chartCore,
        chartInteractions,
        getWhereBase,
        getFiltroNivel,
        getDeptoActual,
        getDiccionarioDepartamentos,
        getLayersGlobal,
        applyWhereToActiveLayers
    });
    
    const educationBarController = createEducationBarChartController({
        chartCore,
        getWhereBase,
        getFiltroNivel,
        getMunicipioActual,
        getDeptoActual,
        getDiccionarioDepartamentos,
        getView,
        getHighlightHandle,
        setHighlightHandle
    });

    const publicServicesRadarController = createPublicServicesRadarChartController({
        chartCore,
        chartInteractions,
        getWhereBase,
        getFiltroNivel,
        getDeptoActual,
        getDiccionarioDepartamentos,
        getView,
        getLayerGlobal,
        getLayersGlobal,
        getHighlightHandle,
        setHighlightHandle,
        applyWhereToActiveLayers
    });
    
    const equipamientosController = createEquipamientosChartController({
        chartCore,
        getWhereBase,
        getFiltroNivel,
        getDeptoActual,
        getDiccionarioDepartamentos,
        getLayerGlobal,
        getView,
        refreshSummary
    });
    
    const povertyBarController = createPovertyGroupedBarChartController({
        chartCore,
        chartInteractions,
        getWhereBase,
        getFiltroNivel,
        getDeptoActual,
        getDiccionarioDepartamentos,
        getView,
        getHighlightHandle,
        setHighlightHandle,
        getActiveLayerConfig,
        getLayerGlobal
    });

    // Dynamic charts controllers
    const livestockCensusBarController = createLivestockCensusBarChartController({
        chartCore,
        getWhereBase,
        getFiltroNivel,
        getDeptoActual,
        getDiccionarioDepartamentos,
        refreshSummary
    });
    const greenBusinessController = createGreenBusinessFloatingBarChartController({
        chartCore,
        getWhereBase,
        getMunicipioActual,
        getFiltroNivel,
        refreshSummary
    });

    // NUEVO: Controlador para Censo Agrícola EVA
    const evaPieController = createEvaPieChartController({
        getMunicipioActual,
        getDeptoActual,
        getFiltroNivel
    });
    const economicActivitiesBarController = createEconomicActivitiesBarChartController({
        chartCore,
        chartInteractions,
        getMunicipioActual,
        getFiltroNivel,
        refreshSummary
    });

    let activeConnectivityChartId = null;

    function isAttributeCategoryChart(chartConfig) {
        return Boolean(educationBarController.isAttributeCategoryChart?.(chartConfig));
    }

    function isEquipamientosChart(chartConfig) {
        return Boolean(equipamientosController.isEquipamientosChart?.(chartConfig));
    }

    function isGreenBusinessChart(chartConfig) {
        return chartConfig?.type === "greenBusinessFloatingBar";
    }

    function cleanupSpecialCharts(chartConfig = null) {
        if (chartConfig?.type !== "livestockCensusBar") {
            livestockCensusBarController.removeMetricHtmlLegend?.();
        }
        if (!isEquipamientosChart(chartConfig)) {
            equipamientosController.destroyCharts?.();
        }
        if (!povertyBarController.isPovertyGroupedChart?.(chartConfig)) {
            povertyBarController.destroyCharts?.();
        }
        if (chartConfig?.type !== "radar") {
            publicServicesRadarController.hideTelecomPanels?.();
        }
    }

    function setActiveChartContext(chartConfig = null) {
        window.__activeSocioChartConfig = chartConfig || null;
        refreshSummary?.();
    }

    function isServiceUnavailableError(error) {
        const message = String(error?.message || error || "").toLowerCase();
        return message.includes("service") && message.includes("not started");
    }

    function getSupplementaryCharts(config) {
        return config?.chartConfig?.supplementaryCharts || [];
    }

    function hasConnectivityTabs(config) {
        return getSupplementaryCharts(config).length > 0;
    }

    function isConnectivityDepartmentMode(config) {
        return hasConnectivityTabs(config) && getFiltroNivel?.() !== "MUNI" && Boolean(getDeptoActual?.());
    }

    function ensureConnectivityTabsContainer() {
        let container = document.getElementById("connectivityChartTabs");
        if (container) return container;

        const chartTitle = document.getElementById("chartTitle");
        if (!chartTitle?.parentNode) return null;

        container = document.createElement("div");
        container.id = "connectivityChartTabs";
        container.className = "chart-switch-tabs";
        container.hidden = true;
        chartTitle.insertAdjacentElement("afterend", container);
        return container;
    }

    function hideConnectivityTabs() {
        const container = document.getElementById("connectivityChartTabs");
        if (!container) return;
        container.hidden = true;
        container.innerHTML = "";
    }

    function renderConnectivityTabs(variants = []) {
        const container = ensureConnectivityTabsContainer();
        if (!container) return;

        if (!variants.length || variants.length === 1) {
            container.hidden = true;
            container.innerHTML = "";
            return;
        }

        container.hidden = false;
        container.innerHTML = "";

        variants.forEach(variant => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = `chart-switch-tab${variant.id === activeConnectivityChartId ? " active" : ""}`;
            button.textContent = variant.tabLabel || variant.chartConfig?.tabLabel || variant.chartConfig?.title || variant.id;
            button.onclick = () => {
                activeConnectivityChartId = variant.id;
                renderConnectivityTabs(variants);
                renderActiveChartSoon(0);
            };
            container.appendChild(button);
        });
    }

    function isMunicipalityRequiredWithoutSelection(config) {
        return config?.key !== "CONNECTIVITY"
            && config?.chartConfig?.allowDepartmentPopup !== true
            && chartRequiresMunicipality(config?.chartConfig)
            && !hasMunicipalitySelection({ getFiltroNivel, getMunicipioActual });
    }

    function showMunicipalityRequiredMessage(config) {
        const canvas = document.getElementById("chart");
        if (!canvas) return;
        showMunicipalityRequiredChartState({
            canvas,
            chartConfig: config?.chartConfig,
            title: config?.chartConfig?.title || config?.title,
            destroyChart: chartCore.destroyChart,
            prepareCanvas: barRenderer.prepareVisibleChartCanvas,
            setTitle: barRenderer.setChartTitle,
            setStatus: barRenderer.setChartStatus
        });
    }

    function prepareChartPanelForConfig(config) {
        educationBarController.hideAttributeCategoryExtras?.();
        if (!config?.chartConfig) {
            setActiveChartContext(null);
            cleanupSpecialCharts(null);
            return;
        }
        cleanupSpecialCharts(config.chartConfig);
        if (isMunicipalityRequiredWithoutSelection(config)) {
            setActiveChartContext(config.chartConfig);
            hideConnectivityTabs();
            showMunicipalityRequiredMessage(config);
            return;
        }
        if (isEquipamientosChart(config.chartConfig)) {
            setActiveChartContext(config.chartConfig);
            hideConnectivityTabs();
            equipamientosController.prepareChartPanelForConfig(config);
            return;
        }
        if (isAttributeCategoryChart(config.chartConfig)) {
            chartInteractions.installDefaultLegendHooks?.();
            setActiveChartContext(config.chartConfig);
            hideConnectivityTabs();
            educationBarController.prepareChartPanelForConfig(config);
            return;
        }
        if (config.chartConfig.type === "pie") {
            chartInteractions.installDefaultLegendHooks?.();
            setActiveChartContext(config.chartConfig);
            hideConnectivityTabs();
            travelTimePieController.prepareChartPanelForConfig(config);
            return;
        }
        if (config.chartConfig.type === "radar") {
            setActiveChartContext(config.chartConfig);
            hideConnectivityTabs();
            publicServicesRadarController.prepareChartPanelForConfig(config);
            return;
        }
        if (povertyBarController.isPovertyGroupedChart?.(config.chartConfig)) {
            chartInteractions.installDefaultLegendHooks?.();
            setActiveChartContext(config.chartConfig);
            hideConnectivityTabs();
            povertyBarController.prepareChartPanelForConfig(config);
            return;
        }
        if (isGreenBusinessChart(config.chartConfig)) {
            setActiveChartContext(config.chartConfig);
            hideConnectivityTabs();
            const canvas = document.getElementById("chart");
            if (canvas) {
                barRenderer.prepareVisibleChartCanvas(canvas);
                barRenderer.setChartTitle(config.chartConfig.title || config.title);
                barRenderer.setChartStatus(canvas, "Cargando gráfico...");
            }
            return;
        }
        if (config.chartConfig.type !== "bar") {
            chartInteractions.installDefaultLegendHooks?.();
            setActiveChartContext(null);
            return;
        }
        const canvas = document.getElementById("chart");
        if (!canvas) return;
        setActiveChartContext(config.chartConfig);

        if (hasConnectivityTabs(config)) {
            activeConnectivityChartId = activeConnectivityChartId || "main";
            hideConnectivityTabs();
        } else {
            activeConnectivityChartId = null;
            hideConnectivityTabs();
        }

        barRenderer.prepareVisibleChartCanvas(canvas, config.chartConfig);
        barRenderer.setChartTitle(config.chartConfig.title || config.title);
        barRenderer.setChartStatus(canvas, "Cargando gráfico...");
    }

    function resolveChartLayer(config, chartConfig = config?.chartConfig) {
        if (config?.type === "table-layer") {
            const explicitChartLayer = getChartLayerGlobal?.();
            if (explicitChartLayer) return explicitChartLayer;

            const tableUrl = chartConfig?.serviceUrl || config?.url || chartConfig?.url;
            const tableLayer = tableUrl
                ? (getLayersGlobal?.() || []).find(item => getLayerSourceUrl(item) === tableUrl)
                : null;
            return tableLayer || null;
        }

        const chartVariant = config.chartVariantKey
            ? (config.variants || []).find(variant => variant.key === config.chartVariantKey)
            : null;
        const variantUrls = (config.variants || [])
            .filter(variant =>
                variant?.url &&
                (!chartConfig?.includeVariantKeys?.length || chartConfig.includeVariantKeys.includes(variant.key))
            )
            .map(variant => variant.url);
        const chartUrl = chartVariant?.url || config.url || variantUrls[0] || chartConfig?.serviceUrl;
        const chartLayer = chartUrl
            ? (getLayersGlobal?.() || []).find(item => getLayerSourceUrl(item) === chartUrl)
            : null;
        const municipalChartLayer = chartUrl
            ? (getLayersGlobal?.() || []).find(item =>
                getLayerSourceUrl(item) === chartUrl &&
                String(item?.__connectivityRole || "") === "municipality"
            )
            : null;
        const activeLayer = getChartLayerGlobal?.() || getLayerGlobal?.();
        const activeLayerMatches = !chartUrl || getLayerSourceUrl(activeLayer) === chartUrl;
        if (municipalChartLayer) return municipalChartLayer;
        if (chartLayer) return chartLayer;
        if (activeLayer && activeLayerMatches) return activeLayer;
        return chartUrl && !chartConfig?.categoryFields?.length ? { url: chartUrl } : null;
    }

    function getLayerSourceUrl(layer) {
        return String(layer?.__sourceUrl || layer?.url || "");
    }

    function getVariantUrlsForChartConfig(config, chartConfig = config?.chartConfig) {
        const variantUrls = (config?.variants || [])
            .filter(variant =>
                variant?.url &&
                (!chartConfig?.includeVariantKeys?.length || chartConfig.includeVariantKeys.includes(variant.key))
            )
            .map(variant => String(variant.url));

        if (variantUrls.length) return variantUrls;

        const layer = resolveChartLayer(config, chartConfig);
        return layer?.url ? [String(layer.url)] : [];
    }

    function buildMapWhereForChart(chartConfig) {
        const baseWhere = String(getWhereBase?.() || "1=1").trim() || "1=1";
        const extraWhere = String(chartConfig?.additionalWhere || "").trim();
        if (!extraWhere) return baseWhere;
        if (baseWhere === "1=1") return extraWhere;
        return `(${baseWhere}) AND (${extraWhere})`;
    }

    function escapeSqlString(value) {
        return String(value ?? "").replace(/'/g, "''");
    }

    function resolveConnectivityDepartmentCode() {
        const departmentCode = String(getDeptoActual?.() || "").trim();
        if (departmentCode) return departmentCode;

        const municipalityCode = String(getMunicipioActual?.() || "").trim();
        return municipalityCode.length >= 2 ? municipalityCode.slice(0, 2) : "";
    }

    function buildConnectivityMapWhereForChart(chartConfig) {
        if (getFiltroNivel?.() !== "MUNI") {
            const departmentCode = resolveConnectivityDepartmentCode();
            const departmentWhere = departmentCode
                ? `dpcodigo = '${escapeSqlString(departmentCode)}'`
                : String(getWhereBase?.() || "1=1").trim() || "1=1";
            const extraWhere = String(chartConfig?.additionalWhere || "").trim();
            if (!extraWhere) return departmentWhere;
            if (departmentWhere === "1=1") return extraWhere;
            return `(${departmentWhere}) AND (${extraWhere})`;
        }

        const departmentCode = resolveConnectivityDepartmentCode();
        const departmentWhere = departmentCode
            ? `dpcodigo = '${escapeSqlString(departmentCode)}'`
            : String(getWhereBase?.() || "1=1").trim() || "1=1";
        const extraWhere = String(chartConfig?.additionalWhere || "").trim();
        if (!extraWhere) return departmentWhere;
        if (departmentWhere === "1=1") return extraWhere;
        return `(${departmentWhere}) AND (${extraWhere})`;
    }

    function buildConnectivityContextWhereForChart(chartConfig) {
        const mapWhere = buildConnectivityMapWhereForChart(chartConfig);
        const baseWhere = String(getWhereBase?.() || "1=1").trim() || "1=1";
        if (getFiltroNivel?.() !== "MUNI" || !baseWhere || baseWhere === "1=1") {
            return mapWhere;
        }

        return `(${mapWhere}) AND NOT (${baseWhere})`;
    }

    async function syncConnectivityMapLayers(config, chartConfig = config?.chartConfig) {
        const activeUrls = new Set(getVariantUrlsForChartConfig(config, chartConfig));
        const layers = getLayersGlobal?.() || [];
        const visibleLayers = [];
        const chartWhere = buildMapWhereForChart(chartConfig);
        const mapWhere = buildConnectivityMapWhereForChart(chartConfig);
        const contextWhere = buildConnectivityContextWhereForChart(chartConfig);
        const baseWhere = String(getWhereBase?.() || "1=1").trim() || "1=1";
        const view = getView?.();

        function cloneRenderer(renderer) {
            return renderer ? JSON.parse(JSON.stringify(renderer)) : null;
        }

        function applyRendererOverride(layer, override = null) {
            if (!layer || layer.destroyed) return;
            const hadOverride = Boolean(layer.__rendererOverrideActive);
            const wantsOverride = Boolean(override);

            if (!wantsOverride && !hadOverride) {
                return;
            }

            if (wantsOverride && !layer.__originalRenderer) {
                layer.__originalRenderer = cloneRenderer(layer.renderer);
            }

            if (wantsOverride) {
                layer.renderer = cloneRenderer(override);
                layer.__rendererOverrideActive = true;
                return;
            }

            if (layer.__originalRenderer) {
                layer.renderer = cloneRenderer(layer.__originalRenderer);
            }
            layer.__rendererOverrideActive = false;
        }

        layers.forEach(layer => {
            const shouldBeVisible = activeUrls.has(getLayerSourceUrl(layer));
            const role = String(layer?.__connectivityRole || "default");
            layer.visible = shouldBeVisible;
            layer.definitionExpression = shouldBeVisible
                ? (role === "context" ? contextWhere : role === "municipality" ? chartWhere : mapWhere)
                : baseWhere;
            layer.__legendBaseWhere = shouldBeVisible && role !== "context"
                ? (role === "default" ? mapWhere : chartWhere)
                : baseWhere;
            const rendererOverride = shouldBeVisible ? chartConfig?.mapRendererOverride : null;
            applyRendererOverride(layer, rendererOverride);
            if (shouldBeVisible && role !== "context") {
                visibleLayers.push(layer);
            }
        });

        if (view) {
            await Promise.all(layers.map(async layer => {
                if (!layer || layer.destroyed) return;
                try {
                    const layerView = await view.whenLayerView(layer);
                    layerView.filter = null;
                } catch (_) {
                    // Some hidden/unloaded layers may not have a view yet; that should not block syncing.
                }
            }));
        }

        const nextPrimaryLayer = visibleLayers[0] || layers[0] || null;
        if (nextPrimaryLayer) {
            window.activeFeatureLayer = nextPrimaryLayer;
        }

        if (window.__SOCIOECONOMICO_DEBUG__ === true) window.__connectivityDebug = {
            activeChartId: activeConnectivityChartId,
            activeUrls: [...activeUrls],
            activeWhere: chartWhere,
            chartWhere,
            mapWhere,
            contextWhere,
            baseWhere,
            visibleLayers: visibleLayers.map(layer => ({
                url: layer?.url || "",
                sourceUrl: getLayerSourceUrl(layer),
                visible: layer?.visible,
                definitionExpression: layer?.definitionExpression || "",
                legendBaseWhere: layer?.__legendBaseWhere || "",
                role: layer?.__connectivityRole || "",
                rendererType: layer?.renderer?.type || "",
                opacity: layer?.opacity
            })),
            allLayers: layers.map(layer => ({
                url: layer?.url || "",
                sourceUrl: getLayerSourceUrl(layer),
                visible: layer?.visible,
                definitionExpression: layer?.definitionExpression || "",
                legendBaseWhere: layer?.__legendBaseWhere || "",
                role: layer?.__connectivityRole || "",
                rendererType: layer?.renderer?.type || "",
                opacity: layer?.opacity
            }))
        };

        return {
            layer: nextPrimaryLayer,
            visibleLayers,
            activeWhere: chartWhere,
            chartWhere,
            mapWhere,
            contextWhere,
            baseWhere
        };
    }

    function resolveLayerFieldName(layer, fieldName) {
        const target = String(fieldName || "").trim().toLowerCase();
        if (!target) return "";
        const field = (layer?.fields || [])
            .find(item => String(item?.name || "").trim().toLowerCase() === target);
        return field?.name || fieldName;
    }

    async function queryConnectivityLegendValues(layer, chartConfig, where) {
        const field = resolveLayerFieldName(
            layer,
            chartConfig?.mapInteractionField || chartConfig?.xAxis?.field
        );
        if (!layer || layer.destroyed || !field) return [];

        const queryWhere = String(where || layer.definitionExpression || "1=1").trim() || "1=1";
        const query = layer.createQuery?.() || {};
        query.where = queryWhere;
        query.outFields = [field];
        query.returnGeometry = false;
        query.returnDistinctValues = true;
        query.orderByFields = [field];

        try {
            const result = await layer.queryFeatures(query);
            return [...new Set((result?.features || [])
                .map(feature => String(feature?.attributes?.[field] ?? "").trim())
                .filter(Boolean))];
        } catch (error) {
            const fallbackQuery = layer.createQuery?.() || {};
            fallbackQuery.where = queryWhere;
            fallbackQuery.outFields = [field];
            fallbackQuery.returnGeometry = false;
            fallbackQuery.num = 2000;
            const result = await layer.queryFeatures(fallbackQuery);
            return [...new Set((result?.features || [])
                .map(feature => String(feature?.attributes?.[field] ?? "").trim())
                .filter(Boolean))];
        }
    }

    async function syncConnectivityLegendFromFilteredData(chartConfig, syncState) {
        const legendLayers = (syncState?.visibleLayers || [])
            .filter(layer => layer && !layer.destroyed && !layer.__legendExcluded);
        const legendItems = [];
        const seenCodes = new Set();

        function rendererItemMatchesValue(item, value) {
            const normalizedValue = String(value || "").trim();
            const codeParts = String(item?.code || "")
                .split(",")
                .map(part => part.trim())
                .filter(Boolean);
            return codeParts.includes(normalizedValue) || String(item?.code || "").trim() === normalizedValue;
        }

        function pushLegendItem(item) {
            const code = String(item?.code || "").trim();
            if (!code || seenCodes.has(code)) return;
            seenCodes.add(code);
            legendItems.push({
                code,
                label: item.label || code,
                color: item.color || "#999",
                symbol: item.symbol || null
            });
        }

        for (const layer of legendLayers) {
            const values = await queryConnectivityLegendValues(layer, chartConfig, layer.definitionExpression || syncState?.mapWhere);
            const rendererItems = getRendererLegendItems(layer.renderer, chartConfig);
            if (rendererItems.length) {
                rendererItems
                    .filter(item => values.some(value => rendererItemMatchesValue(item, value)))
                    .forEach(pushLegendItem);
                continue;
            }

            values
                .map(value => getRendererVisualForValue(layer.renderer, value, chartConfig))
                .forEach(pushLegendItem);
        }

        if (typeof window.actualizarLeyenda !== "function") return;

        window.__clearLegendLayerFilters?.(legendLayers);
        window.actualizarLeyenda(
            legendItems.map(item => item.label),
            legendItems.map(item => item.color || "#999"),
            legendItems.map(item => item.code),
            {
                field: chartConfig?.mapInteractionField || chartConfig?.xAxis?.field,
                baseWhere: syncState?.mapWhere || syncState?.activeWhere || "1=1",
                layers: legendLayers,
                symbols: legendItems.map(item => item.symbol || null)
            }
        );
    }

    async function buildConnectivityVariants(config) {
        const departmentMode = isConnectivityDepartmentMode(config);
        const mainVariant = {
            id: "main",
            tabLabel: config?.chartConfig?.tabLabel || config?.chartConfig?.title || config?.title,
            chartConfig: config?.chartConfig,
            layer: resolveChartLayer(config, config?.chartConfig),
            rows: null
        };

        const variants = [mainVariant];
        for (const supplementaryChart of getSupplementaryCharts(config)) {
            if (departmentMode) {
                variants.push({
                    id: supplementaryChart.id,
                    tabLabel: supplementaryChart.tabLabel || supplementaryChart.title,
                    chartConfig: supplementaryChart,
                    layer: resolveChartLayer(config, supplementaryChart),
                    rows: null
                });
                continue;
            }

            try {
                const rows = await barRenderer.queryChartRowsFromRest(config, supplementaryChart);
                if (!rows.length) continue;
                variants.push({
                    id: supplementaryChart.id,
                    tabLabel: supplementaryChart.tabLabel || supplementaryChart.title,
                    chartConfig: supplementaryChart,
                    layer: resolveChartLayer(config, supplementaryChart),
                    rows
                });
            } catch (error) {
                if (!isServiceUnavailableError(error)) {
                    console.warn(`No se pudo preparar el gráfico complementario ${supplementaryChart.id}:`, error);
                }
            }
        }

        if (!variants.some(variant => variant.id === activeConnectivityChartId)) {
            activeConnectivityChartId = "main";
        }

        renderConnectivityTabs(variants);
        return variants;
    }

    async function renderVariantRows(canvas, config, variant) {
        setActiveChartContext(variant.chartConfig);
        const syncState = await syncConnectivityMapLayers(config, variant.chartConfig);
        barRenderer.setChartTitle(variant.chartConfig.title || config.title);
        barRenderer.prepareVisibleChartCanvas(canvas, variant.chartConfig);
        barRenderer.setChartTitle(barRenderer.resolveTitle(variant.chartConfig, config, variant.rows));
        barRenderer.renderRowsIntoChart(canvas, variant.rows, variant.chartConfig, variant.layer, {
            baseWhere: syncState?.activeWhere,
            legendLayers: syncState?.visibleLayers
        });
    }

    function renderActiveChartSoon(delay = 250) {
        chartCore.schedule(async () => {
            const config = getActiveLayerConfig?.();
            if (!config?.chartConfig) return;
            const renderOptions = {
                skipSyncMap: config.keepDepartmentMapOnMunicipality === true
                    && getFiltroNivel?.() === "MUNI"
            };
            if (isMunicipalityRequiredWithoutSelection(config)) {
                hideConnectivityTabs();
                setActiveChartContext(config.chartConfig);
                showMunicipalityRequiredMessage(config);
                return;
            }
            
            // NUEVO: Manejar Censo Agrícola EVA
            if (config?.chartConfig?.id === "eva-censo-agricola") {
                evaPieController.setConfig(config.chartConfig);
                await evaPieController.renderForCurrentFilter();
                return;
            }
            
            if (isEquipamientosChart(config.chartConfig)) {
                hideConnectivityTabs();
                setActiveChartContext(config.chartConfig);
                const equipamientosLayer = resolveChartLayer(config, config.chartConfig);
                if (!equipamientosLayer) return;
                await equipamientosController.actualizarGrafica(equipamientosLayer, config);
                return;
            }
            if (isAttributeCategoryChart(config.chartConfig)) {
                hideConnectivityTabs();
                setActiveChartContext(config.chartConfig);
                chartInteractions.installDefaultLegendHooks?.();
                const educationLayer = resolveChartLayer(config, config.chartConfig);
                if (!educationLayer) return;
                await educationBarController.actualizarGrafica(educationLayer, config);
                return;
            }
            if (povertyBarController.isPovertyGroupedChart?.(config.chartConfig)) {
                hideConnectivityTabs();
                setActiveChartContext(config.chartConfig);
                const povertyLayer = resolveChartLayer(config, config.chartConfig);
                if (!povertyLayer?.createQuery && !povertyLayer?.url) return;
                await povertyBarController.actualizarGrafica(povertyLayer, config);
                return;
            }
            if (config.chartConfig.type === "pie") {
                hideConnectivityTabs();
                setActiveChartContext(config.chartConfig);
                chartInteractions.installDefaultLegendHooks?.();
                const pieLayer = resolveChartLayer(config, config.chartConfig);
                if (!pieLayer) return;
                await travelTimePieController.actualizarGrafica(pieLayer, config, renderOptions);
                return;
            }
            if (config.chartConfig.type === "radar") {
                hideConnectivityTabs();
                setActiveChartContext(config.chartConfig);
                const radarLayer = resolveChartLayer(config, config.chartConfig);
                if (!radarLayer) return;
                await publicServicesRadarController.actualizarGrafica(radarLayer, config, renderOptions);
                return;
            }
            if (isGreenBusinessChart(config.chartConfig)) {
                hideConnectivityTabs();
                setActiveChartContext(config.chartConfig);
                chartInteractions.installDefaultLegendHooks?.();
                await greenBusinessController.actualizarGrafica(resolveChartLayer(config, config.chartConfig), config);
                return;
            }
            if (config.chartConfig.type !== "bar") return;
            chartInteractions.installDefaultLegendHooks?.();
            const chartConfig = config.chartConfig;
            const canvas = document.getElementById("chart");
            if (!canvas) return;

            const layer = resolveChartLayer(config);
            if (!layer) {
                console.warn("No hay capa disponible para renderizar chartConfig", {
                    key: config?.key,
                    title: config?.title,
                    hasChartConfig: Boolean(config?.chartConfig),
                    variants: (config?.variants || []).map(variant => variant.key || variant.url)
                });
                barRenderer.setChartStatus(canvas, "No hay capa disponible para el gráfico.");
                return;
            }

            try {
                if (hasConnectivityTabs(config)) {
                    const variants = await buildConnectivityVariants(config);
                    const activeVariant = variants.find(variant => variant.id === activeConnectivityChartId) || variants[0];
                    if (isConnectivityDepartmentMode(config)) {
                        setActiveChartContext(activeVariant.chartConfig);
                        const syncState = await syncConnectivityMapLayers(config, activeVariant.chartConfig);
                        await syncConnectivityLegendFromFilteredData(activeVariant.chartConfig, syncState);
                        barRenderer.setChartTitle(activeVariant.chartConfig.title || config.title);
                        barRenderer.prepareVisibleChartCanvas(canvas, activeVariant.chartConfig);
                        barRenderer.setChartStatus(canvas, "Seleccione un municipio para ver la información.");
                        canvas.style.setProperty("display", "none", "important");
                        return;
                    }
                    if (activeVariant?.id !== "main" && activeVariant?.rows?.length) {
                        await renderVariantRows(canvas, config, activeVariant);
                        return;
                    }
                    setActiveChartContext(chartConfig);
                    await syncConnectivityMapLayers(config, chartConfig);
                } else {
                    hideConnectivityTabs();
                    setActiveChartContext(chartConfig);
                }

                barRenderer.setChartTitle(chartConfig.title || config.title);
                barRenderer.prepareVisibleChartCanvas(canvas, chartConfig);
                const rows = await barRenderer.queryChartRowsFromRest(config, chartConfig);
                if (!rows.length) {
                    barRenderer.setChartStatus(canvas, "No hay datos para el filtro seleccionado.");
                    return;
                }
                barRenderer.setChartTitle(barRenderer.resolveTitle(chartConfig, config, rows));
                barRenderer.renderRowsIntoChart(canvas, rows, chartConfig, layer, {
                    baseWhere: buildMapWhereForChart(chartConfig),
                    legendLayers: getVariantUrlsForChartConfig(config, chartConfig).length
                        ? (getLayersGlobal?.() || []).filter(item =>
                            item &&
                            !item.__legendExcluded &&
                            getVariantUrlsForChartConfig(config, chartConfig).includes(getLayerSourceUrl(item))
                        )
                        : [layer].filter(Boolean)
                });
            } catch (error) {
                if (isServiceUnavailableError(error)) {
                    try {
                        const rendered = await barRenderer.renderChartFromLayer(layer, config);
                        if (rendered) return;
                    } catch (fallbackError) {
                        if (!isServiceUnavailableError(fallbackError)) {
                            console.error("El fallback del gráfico PIB fallo:", fallbackError);
                        }
                    }
                    barRenderer.prepareVisibleChartCanvas(canvas, chartConfig);
                    barRenderer.setChartStatus(canvas, "El servicio del gráfico no está disponible en este momento.");
                    return;
                }

                console.error("No se pudo forzar el render visual del gráfico:", error);
                barRenderer.prepareVisibleChartCanvas(canvas, chartConfig);
                barRenderer.setChartStatus(canvas, `No se pudo cargar el gráfico: ${String(error?.message || error)}`);
            }
        }, delay);
    }

    async function manejarClickMapaAreasActividad(event) {
        const config = getActiveLayerConfig?.();
        if (isEquipamientosChart(config?.chartConfig)) return;
        if (isAttributeCategoryChart(config?.chartConfig)) {
            await educationBarController.handleMapClick?.(event, config);
            return;
        }
        if (povertyBarController.isPovertyGroupedChart?.(config?.chartConfig)) {
            await povertyBarController.handleMapClick(event);
            return;
        }
        if (config?.chartConfig?.type === "pie") {
            chartInteractions.installDefaultLegendHooks?.();
            await travelTimePieController.handleMapClick(event, config);
            return;
        }
        if (config?.chartConfig?.type === "radar") {
            await publicServicesRadarController.handleMapClick(event, config);
            return;
        }
        if (hasConnectivityTabs(config)) {
            const hit = await getView?.()?.hitTest?.(event);
            const layersGlobal = getLayersGlobal?.() || [];
            const layerGlobal = getLayerGlobal?.();
            const graphic = hit?.results
                ?.map(result => result.graphic)
                ?.find(item => item?.layer === layerGlobal || layersGlobal.includes(item?.layer));

            if (graphic) {
                const supplementaryChart = getSupplementaryCharts(config)
                    .find(chartConfig => {
                        const targetLayer = resolveChartLayer(config, chartConfig);
                        return targetLayer && graphic.layer === targetLayer;
                    });

                activeConnectivityChartId = supplementaryChart?.id || "main";
                renderActiveChartSoon(0);
                window.setTimeout(() => {
                    const targetConfig = supplementaryChart || config.chartConfig;
                    const xField = targetConfig?.mapInteractionField || targetConfig?.xAxis?.field;
                    const selectedValue = graphic.attributes?.[xField];
                    if (selectedValue != null) {
                        chartInteractions.highlightBar(selectedValue, { exclusiveCategory: false });
                    }
                }, 450);
                return;
            }
        }
        await chartInteractions.handleMapClick(event, {
            chartConfig: config?.chartConfig
        });
    }

    async function actualizarGrafica(layer, config, options = {}) {

        if (isMunicipalityRequiredWithoutSelection(config)) {
            setActiveChartContext(config.chartConfig);
            showMunicipalityRequiredMessage(config);
            return;
        }

        // NUEVO: Manejar Censo Agrícola EVA
        if (config?.chartConfig?.id === "eva-censo-agricola") {
            setActiveChartContext(config.chartConfig);
            evaPieController.setConfig(config.chartConfig);
            await evaPieController.renderForCurrentFilter();
            return;
        }
        
     if (config?.chartConfig?.type === "livestockCensusBar") {
        setActiveChartContext(config.chartConfig);
        chartInteractions.installDefaultLegendHooks?.();
        await livestockCensusBarController.actualizarGrafica(layer, config);
        return;
    }
        if (config?.chartConfig?.type === "greenBusinessFloatingBar") {
        setActiveChartContext(config.chartConfig);
        chartInteractions.installDefaultLegendHooks?.();
        await greenBusinessController.actualizarGrafica(layer, config);
        return;
    }
        if (config?.chartConfig?.type === "economicActivitiesBar") {
            setActiveChartContext(config.chartConfig);
            await economicActivitiesBarController.actualizarGrafica(
                layer || resolveChartLayer(config, config.chartConfig) || getLayerGlobal?.(),
                config
            );
            return;
        }
        
        if (isEquipamientosChart(config?.chartConfig)) {
            setActiveChartContext(config.chartConfig);
            await equipamientosController.actualizarGrafica(layer, config, options);
            return;
        }

        if (isAttributeCategoryChart(config?.chartConfig)) {
            setActiveChartContext(config.chartConfig);
            chartInteractions.installDefaultLegendHooks?.();
            await educationBarController.actualizarGrafica(layer, config, options);
            return;
        }

        if (povertyBarController.isPovertyGroupedChart?.(config?.chartConfig)) {
            setActiveChartContext(config.chartConfig);
            chartInteractions.installDefaultLegendHooks?.();
            await povertyBarController.actualizarGrafica(layer, config, options);
            return;
        }

        if (config?.chartConfig?.type === "pie") {
            setActiveChartContext(config.chartConfig);
            chartInteractions.installDefaultLegendHooks?.();
            await travelTimePieController.actualizarGrafica(layer, config, options);
            return;
        }

        if (config?.chartConfig?.type === "radar") {
            setActiveChartContext(config.chartConfig);
            await publicServicesRadarController.actualizarGrafica(layer, config, options);
            return;
        }

        chartInteractions.installDefaultLegendHooks?.();
        await barRenderer.actualizarGrafica(layer, config);
    }

    return {
        actualizarGrafica,
        clearChartSelections: chartInteractions.clearCategorySelection,
        destroyChart: chartCore.destroyChart,
        resetAuxiliaryCharts() {
            hideConnectivityTabs();
            cleanupSpecialCharts(null);
            greenBusinessController.hideChart?.();
            setActiveChartContext(null);
        },
        highlightBar: chartInteractions.highlightBar,
        manejarClickMapaAreasActividad,
        prepareChartPanelForConfig,
        renderActiveChartSoon
    };
}
