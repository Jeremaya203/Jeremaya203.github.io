import FeatureLayer from "https://js.arcgis.com/4.29/@arcgis/core/layers/FeatureLayer.js";
import { createBarChartOptions, createDefaultBarDataset, createHorizontalStackedBarOptions } from "../core/chartOptions.js?v=global-safe-zoom-labels-20260604";
import { destroyCanvasChart } from "../core/chartLifecycle.js";
import {
    getChartBaseWhere,
    getChartFields,
    getCurrentDepartmentChartLabel,
    getDepartmentDisplayLabel,
    groupChartFeatures
} from "../core/chartUtils.js?v=travel-time-pie-20260511";
import { getChartSymbolLookups, getRendererLegendItems } from "../core/chartSymbolUtils.js?v=connectivity-line-style-legend-20260602";
import { createAdaptiveBarValueLabelsPlugin } from "../core/adaptiveBarValueLabels.js?v=global-safe-zoom-labels-20260604";
import {
    ensureChartScrollContainer,
    prepareVisibleChartCanvas,
    setChartTitle
} from "../ui/chartPanel.js?v=local-chart-title-20260529";
import { setChartStatus } from "../ui/chartStatus.js";

const compactBarSlotWidth = 22;
const comfortBarSlotWidth = 28;
const maxInitialOverflowFactor = 1.35;
const chartMetadataCache = new Map();
const pibDepartmentBarThickness = 5;
const pibDepartmentDragThresholdPx = 6;

export function renderHorizontalStackedBarChart({
    canvas,
    labels = [],
    rawLabels = labels,
    datasets = [],
    xTitle = "",
    yTitle = "",
    yTickFontSize,
    formatValue,
    onBarClick,
    onBarHover,
    onBarLeave,
    plugins = []
}) {
    if (!canvas || typeof Chart === "undefined") return null;
    destroyCanvasChart(canvas);
    return new Chart(canvas, {
        type: "bar",
        data: { labels, rawLabels, datasets },
        options: createHorizontalStackedBarOptions({
            xTitle,
            yTitle,
            yTickFontSize,
            formatValue,
            onBarClick,
            onBarHover,
            onBarLeave
        }),
        plugins
    });
}

export function applyScrollableChartSize(canvas, rows, chartConfig = null) {
    const chartScroll = ensureChartScrollContainer(canvas);
    const chartCard = canvas.closest(".chart-card");
    const chartDiv = document.getElementById("chartDiv");
    const visibleWidth = chartScroll?.clientWidth || chartCard?.clientWidth || chartDiv?.clientWidth || 360;
    if (chartConfig?.disableHorizontalScroll) {
        const fitWidth = Math.max(320, Math.floor(visibleWidth));
        canvas.style.setProperty("width", `${fitWidth}px`, "important");
        canvas.style.setProperty("min-width", "0px", "important");
        canvas.style.setProperty("max-width", "100%", "important");
        canvas.width = fitWidth;
        if (chartScroll) {
            chartScroll.style.overflowX = "hidden";
            chartScroll.classList.remove("is-scrollable");
        }
        if (chartCard) {
            chartCard.style.overflowX = "hidden";
            chartCard.classList.remove("chart-scrollable");
        }
        return;
    }
    const barCount = Math.max(rows.length, 1);
    const compactWidth = barCount * compactBarSlotWidth;
    const comfortWidth = barCount * comfortBarSlotWidth;
    const readableMinimum = barCount > 30 ? 680 : 620;
    const maxInitialWidth = Math.max(visibleWidth, visibleWidth * maxInitialOverflowFactor);
    const targetWidth = Math.min(
        comfortWidth,
        Math.max(readableMinimum, compactWidth, maxInitialWidth)
    );
    const baseWidth = Math.max(visibleWidth, targetWidth);
    const minWidth = Math.round(baseWidth);
    canvas.style.setProperty("width", `${minWidth}px`, "important");
    canvas.style.setProperty("min-width", `${minWidth}px`, "important");
    canvas.width = Math.floor(minWidth);
    if (chartScroll) {
        chartScroll.style.overflowX = minWidth > visibleWidth ? "auto" : "hidden";
        chartScroll.classList.toggle("is-scrollable", minWidth > visibleWidth);
    }
    if (chartCard) {
        chartCard.style.overflowX = "visible";
        chartCard.classList.toggle("chart-scrollable", minWidth > visibleWidth);
    }
}

function resetPibDepartmentCanvas(canvas, chartConfig = null) {
    if (!canvas || chartConfig?.id !== "pib-departamental") return;

    const chartScroll = ensureChartScrollContainer(canvas);
    const chartCard = canvas.closest(".chart-card");
    const chartDiv = document.getElementById("chartDiv");
    const visibleWidth = chartScroll?.clientWidth || chartCard?.clientWidth || chartDiv?.clientWidth || 360;
    const height = Number.isFinite(chartConfig?.canvasHeight) ? chartConfig.canvasHeight : 360;
    const width = Math.max(320, Math.floor(visibleWidth));

    if (canvas.__barChartClickHandler) {
        canvas.removeEventListener("click", canvas.__barChartClickHandler);
        canvas.__barChartClickHandler = null;
    }
    cleanupPibDepartmentPanGuard(canvas);

    if (chartScroll) {
        chartScroll.scrollLeft = 0;
        chartScroll.scrollTop = 0;
        chartScroll.style.maxHeight = "";
        chartScroll.style.height = "";
        chartScroll.style.overflowX = "hidden";
        chartScroll.style.overflowY = "hidden";
        chartScroll.style.cursor = "default";
        chartScroll.classList.remove("is-scrollable");
    }

    if (chartCard) {
        chartCard.style.minHeight = "455px";
        chartCard.style.overflowX = "hidden";
        chartCard.style.overflowY = "visible";
        chartCard.classList.remove("chart-scrollable");
    }

    canvas.style.setProperty("display", "block", "important");
    canvas.style.setProperty("width", `${width}px`, "important");
    canvas.style.setProperty("min-width", "0px", "important");
    canvas.style.setProperty("max-width", "100%", "important");
    canvas.style.setProperty("height", `${height}px`, "important");
    canvas.style.setProperty("min-height", `${height}px`, "important");
    canvas.style.setProperty("max-height", `${height}px`, "important");
    canvas.width = width;
    canvas.height = height;
}

function cleanupPibDepartmentPanGuard(canvas) {
    const guard = canvas?.__pibDepartmentPanGuard;
    if (!guard) return;

    canvas.removeEventListener("pointerdown", guard.onPointerDown);
    canvas.removeEventListener("pointermove", guard.onPointerMove);
    canvas.removeEventListener("pointerup", guard.onPointerUp);
    canvas.removeEventListener("pointercancel", guard.onPointerCancel);
    guard.scrollContainer?.removeEventListener("scroll", guard.onScroll);
    canvas.__pibDepartmentPanGuard = null;
}

function installPibDepartmentPanGuard(canvas) {
    if (!canvas) return null;

    cleanupPibDepartmentPanGuard(canvas);

    const scrollContainer = ensureChartScrollContainer(canvas);
    const state = {
        active: false,
        dragged: false,
        startX: 0,
        startY: 0,
        startScrollLeft: 0,
        startScrollTop: 0,
        ignoreNextClick: false
    };

    function markDragged() {
        state.dragged = true;
        state.ignoreNextClick = true;
    }

    function onPointerDown(event) {
        state.active = true;
        state.dragged = false;
        state.ignoreNextClick = false;
        state.startX = event.clientX;
        state.startY = event.clientY;
        state.startScrollLeft = scrollContainer?.scrollLeft || 0;
        state.startScrollTop = scrollContainer?.scrollTop || 0;
    }

    function onPointerMove(event) {
        if (!state.active) return;

        const dx = Math.abs(event.clientX - state.startX);
        const dy = Math.abs(event.clientY - state.startY);
        if (dx > pibDepartmentDragThresholdPx || dy > pibDepartmentDragThresholdPx) {
            markDragged();
        }
    }

    function onPointerUp() {
        state.active = false;
    }

    function onPointerCancel() {
        state.active = false;
        if (state.dragged) state.ignoreNextClick = true;
    }

    function onScroll() {
        if (!state.active || !scrollContainer) return;

        const dx = Math.abs(scrollContainer.scrollLeft - state.startScrollLeft);
        const dy = Math.abs(scrollContainer.scrollTop - state.startScrollTop);
        if (dx > 0 || dy > 0) markDragged();
    }

    const guard = {
        state,
        scrollContainer,
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onPointerCancel,
        onScroll
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerCancel);
    scrollContainer?.addEventListener("scroll", onScroll, { passive: true });
    canvas.__pibDepartmentPanGuard = guard;

    return guard;
}

function shouldIgnorePibDepartmentClick(canvas, chartConfig = null) {
    if (chartConfig?.id !== "pib-departamental") return false;

    const guardState = canvas?.__pibDepartmentPanGuard?.state;
    if (!guardState?.ignoreNextClick) return false;

    guardState.ignoreNextClick = false;
    return true;
}

function applyPibDepartmentDatasetSizing(dataset, chartConfig = null) {
    if (!dataset || chartConfig?.id !== "pib-departamental") return dataset;
    dataset.barThickness = pibDepartmentBarThickness;
    dataset.maxBarThickness = pibDepartmentBarThickness;
    dataset.categoryPercentage = 1;
    dataset.barPercentage = 1;
    return dataset;
}

function applyConfiguredBarDatasetSizing(dataset, chartConfig = null) {
    const sizing = chartConfig?.barSizing;
    if (!dataset || !sizing) return dataset;

    [
        "barPercentage",
        "categoryPercentage",
        "barThickness",
        "maxBarThickness",
        "minBarLength"
    ].forEach(property => {
        const value = Number(sizing[property]);
        if (Number.isFinite(value) && value >= 0) {
            dataset[property] = value;
        }
    });

    return dataset;
}

function applyPibDepartmentChartSizing(chartOptions, chartConfig = null) {
    if (!chartOptions || chartConfig?.id !== "pib-departamental") return chartOptions;
    chartOptions.datasets = {
        ...(chartOptions.datasets || {}),
        bar: {
            ...((chartOptions.datasets || {}).bar || {}),
            barThickness: pibDepartmentBarThickness,
            maxBarThickness: pibDepartmentBarThickness,
            categoryPercentage: 1,
            barPercentage: 1
        }
    };
    return chartOptions;
}

export function createBarChartRenderer({
    chartCore,
    chartInteractions,
    getWhereBase,
    getFiltroNivel,
    getDeptoActual,
    getDiccionarioDepartamentos,
    getLayersGlobal,
    applyWhereToActiveLayers,
    destroyGeoformasCharts
}) {
    function buildWhere(chartConfig) {
        const baseWhere = getChartBaseWhere({
            chartConfig,
            whereBase: getWhereBase?.(),
            filtroNivel: getFiltroNivel?.(),
            deptoActual: getDeptoActual?.(),
            diccionarioDepartamentos: getDiccionarioDepartamentos?.()
        });
        const extraWhere = String(chartConfig?.additionalWhere || "").trim();
        if (!extraWhere) return baseWhere;
        if (!baseWhere || baseWhere === "1=1") return extraWhere;
        return `(${baseWhere}) AND (${extraWhere})`;
    }

    function isServiceUnavailableError(error) {
        const message = String(error?.message || error || "").toLowerCase();
        return message.includes("service") && message.includes("not started");
    }

    function groupRows(features, chartConfig) {
        const departments = getDiccionarioDepartamentos?.() || {};
        return groupChartFeatures(features, chartConfig, {
            getDisplayLabel: (value, attrs) => {
                const rendererLabel = attrs?.__chartLabel;
                const baseLabel = rendererLabel || getDepartmentDisplayLabel(value, departments);
                if (typeof chartConfig?.displayLabel === "function") {
                    return chartConfig.displayLabel({
                        value,
                        attrs,
                        label: baseLabel,
                        departments
                    });
                }
                return baseLabel;
            }
        });
    }



    async function getChartFieldInfo({ layers = [], urls = [], fieldName } = {}) {
        const normalizedFieldName = String(fieldName || "").trim().toLowerCase();
        if (!normalizedFieldName) return null;

        const layerField = (layers || [])
            .flatMap(layer => Array.isArray(layer?.fields) ? layer.fields : [])
            .find(field => String(field?.name || "").trim().toLowerCase() === normalizedFieldName);
        if (layerField) return layerField;

        for (const url of urls || []) {
            const normalizedUrl = String(url || "").trim();
            if (!normalizedUrl) continue;

            let metadataPromise = chartMetadataCache.get(normalizedUrl);
            if (!metadataPromise) {
                metadataPromise = fetch(`${normalizedUrl}?f=json`)
                    .then(response => {
                        if (!response.ok) throw new Error(`HTTP ${response.status}`);
                        return response.json();
                    })
                    .catch(() => null);
                chartMetadataCache.set(normalizedUrl, metadataPromise);
            }

            const metadata = await metadataPromise;
            const fieldInfo = (metadata?.fields || [])
                .find(field => String(field?.name || "").trim().toLowerCase() === normalizedFieldName);
            if (fieldInfo) return fieldInfo;
        }

        return null;
    }

    function getDomainLabel(fieldInfo, value) {
        const codedValues = fieldInfo?.domain?.codedValues || [];
        const hit = codedValues.find(item => String(item.code) === String(value));
        return String(hit?.name ?? "").trim();
    }

    function normalizeFeatureForChart(feature, chartConfig, rendererLookups = null, fieldInfo = null) {
        const attrs = feature?.attributes || {};
        const xField = chartConfig?.xAxis?.field;
        const yField = chartConfig?.yAxis?.field;
        const rawValue = String(attrs[xField] ?? "").trim();
        const sourceValue = attrs[yField];
        const domainLabel = chartConfig?.labelsFromDomain
            ? getDomainLabel(fieldInfo, rawValue)
            : "";
        const transformedValue = typeof chartConfig?.valueTransform === "function"
            ? chartConfig.valueTransform(sourceValue, attrs)
            : sourceValue;

        feature.attributes = {
            ...attrs,
            [yField]: transformedValue,
            __chartLabel: chartConfig?.labelsFromRenderer
                ? (rendererLookups?.labelByValue?.get(rawValue) || rendererLookups?.defaultLabel || domainLabel || "")
                : (domainLabel || ""),
            __chartColor: rendererLookups?.colorByValue?.get(rawValue) || rendererLookups?.defaultColor || ""
        };

        return feature;
    }

    function válidateRequiredChartFields(layers, chartConfig) {
        const required = Object.values(chartConfig?.requiredFields || {}).filter(item => item?.name);
        if (!required.length) return;

        const availableFields = (layers || [])
            .flatMap(layer => Array.isArray(layer?.fields) ? layer.fields : [])
            .filter(Boolean);
        if (!availableFields.length) return;

        const fieldNames = new Set(availableFields.map(field => String(field.name || "").toLowerCase()));
        const missing = required.filter(field => !fieldNames.has(String(field.name).toLowerCase()));
        if (missing.length) {
            throw new Error(`La configuración del gráfico requiere campos no disponibles en la capa: ${missing.map(field => field.name).join(", ")}`);
        }
    }

    function createDataLabelPlugin(chartConfig) {
        if (!chartConfig?.dataLabels?.enabled) return null;

        const decimals = Number.isInteger(chartConfig.dataLabels?.decimals)
            ? chartConfig.dataLabels.decimals
            : chartConfig.yAxis?.decimals;
        const suffix = chartConfig.dataLabels?.hideSuffix
            ? ""
            : (chartConfig.dataLabels?.suffix || chartConfig.yAxis?.suffix || "");
        const formatValue = rawValue => {
            const numericValue = Number(rawValue);
            const label = Number.isInteger(decimals) && Number.isFinite(numericValue)
                ? numericValue.toLocaleString("es-CO", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
                : String(rawValue);
            return `${label}${suffix ? ` ${suffix}` : ""}`;
        };

        if (chartConfig.dataLabels?.strategy === "adaptive-box") {
            return createAdaptiveBarValueLabelsPlugin({
                id: `bar-data-labels-${chartConfig.id || chartConfig.title || "default"}`,
                formatValue
            });
        }

        return {
            id: `bar-data-labels-${chartConfig.id || chartConfig.title || "default"}`,
            afterDatasetsDraw(chart) {
                const ctx = chart.ctx;
                const meta = chart.getDatasetMeta(0);
                const dataset = chart.data?.datasets?.[0];

                ctx.save();
                ctx.fillStyle = "#334155";
                ctx.font = "600 11px Outfit, sans-serif";
                ctx.textAlign = "center";
                ctx.textBaseline = "bottom";

                (meta?.data || []).forEach((element, index) => {
                    const rawValue = dataset?.data?.[index];
                    const numericValue = Number(rawValue);
                    if (!Number.isFinite(numericValue)) return;

                    const position = element.tooltipPosition?.();
                    if (!position) return;

                    const topLimit = (chart.chartArea?.top || 0) + 14;
                    ctx.fillText(formatValue(rawValue), position.x, Math.max(topLimit, position.y - 6));
                });

                ctx.restore();
            }
        };
    }

    function selectOptionLabel(selectId, value) {
        const option = document.querySelector(`#${selectId} option[value="${CSS.escape(String(value ?? ""))}"]`);
        return option?.textContent?.trim() || "";
    }

    function categoryLabel(value) {
        const labels = {
            "1": "Departamento",
            "2": "Municipio",
            "3": "Distrito"
        };
        return labels[String(value)] || String(value || "Municipio");
    }

    function readablePlace(attrs = {}) {
        const mpCode = attrs.mpcodigo;
        const dpCode = attrs.dpcodigo || String(mpCode || "").slice(0, 2);
        const municipality = /^\d{5}$/.test(String(attrs.mpnombre || "")) || !attrs.mpnombre
            ? selectOptionLabel("municipios", mpCode)
            : attrs.mpnombre;
        const department = /^\d{2}$/.test(String(attrs.dpnombre || "")) || !attrs.dpnombre
            ? selectOptionLabel("departamentos", dpCode)
            : attrs.dpnombre;
        return {
            mpcategor: categoryLabel(attrs.mpcategor),
            mpnombre: municipality || attrs.mpnombre || "",
            dpnombre: department || attrs.dpnombre || ""
        };
    }

    function resolveTitle(chartConfig, config, rows = []) {
        if (!chartConfig?.titleTemplate) return chartConfig?.title || config?.title;
        const attrs = rows[0]?.attributes || {};
        const place = readablePlace(attrs);
        return chartConfig.titleTemplate.replace(/\{(\w+)\}/g, (_, key) => place[key] || attrs[key] || "");
    }

    function resolveChartUrls(config, chartConfig) {
        const chartVariant = config.chartVariantKey
            ? (config.variants || []).find(variant => variant.key === config.chartVariantKey)
            : null;

        const variantKeysForChart = chartConfig.chartSourceVariantKeys || chartConfig.includeVariantKeys;

        const variantUrls = chartConfig.sourcesFromVariants
            ? (config.variants || []).filter(variant =>
                variant?.url &&
                (!variantKeysForChart?.length || variantKeysForChart.includes(variant.key))
            ).map(variant => String(variant.url))
            : [];

        const directUrls = [
            chartConfig?.serviceUrl,
            chartConfig?.layerUrl,
            chartConfig?.url,
            chartVariant?.url,
            config?.url
        ].map(value => String(value || "").trim()).filter(Boolean);

        const urls = variantUrls.length ? variantUrls : directUrls;
        if (!urls.length) {
            throw new Error(`chartConfig no tiene URL de servicio válida para ${chartConfig?.id || chartConfig?.title || "gráfico"}`);
        }

        return [...new Set(urls)];
    }

    function resolveSymbolUrls(config, chartConfig, dataUrls = []) {
        const symbolVariantKeys = chartConfig?.symbolSourceVariantKeys;
        if (!chartConfig?.sourcesFromVariants || !Array.isArray(symbolVariantKeys) || !symbolVariantKeys.length) {
            return dataUrls;
        }

        const symbolUrls = (config?.variants || [])
            .filter(variant => variant?.url && symbolVariantKeys.includes(variant.key))
            .map(variant => String(variant.url));

        return symbolUrls.length ? [...new Set(symbolUrls)] : dataUrls;
    }

    async function queryChartRowsFromRest(config, chartConfig) {
        const urls = resolveChartUrls(config, chartConfig);
        const symbolUrls = resolveSymbolUrls(config, chartConfig, urls);

        const fields = [...new Set(getChartFields(chartConfig))];
        const where = buildWhere(chartConfig);
        const activeLayers = (getLayersGlobal?.() || []).filter(layer =>
            urls.some(url => String(layer?.__sourceUrl || layer?.url || "") === String(url))
        );
        const symbolLayers = (getLayersGlobal?.() || []).filter(layer =>
            symbolUrls.some(url => String(layer?.__sourceUrl || layer?.url || "") === String(url))
        );
        válidateRequiredChartFields(activeLayers, chartConfig);
        const rendererLookups = await getChartSymbolLookups({
            layers: symbolLayers.length ? symbolLayers : activeLayers,
            urls: symbolUrls,
            chartConfig
        });
        const fieldInfo = chartConfig?.labelsFromDomain
            ? await getChartFieldInfo({ layers: activeLayers, urls, fieldName: chartConfig?.xAxis?.field })
            : null;
        const features = [];
        const params = new URLSearchParams({
            f: "json",
            where,
            outFields: fields.join(","),
            returnGeometry: "false",
            resultRecordCount: "2000"
        });

        const settledResponses = await Promise.allSettled(urls.map(async url => {
            const response = await fetch(`${url}/query?${params.toString()}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const json = await response.json();
            if (json.error) throw new Error(json.error.message || "Error consultando servicio de gráfico");
            (json.features || []).forEach(feature => {
                features.push(normalizeFeatureForChart(feature, chartConfig, rendererLookups, fieldInfo));
            });
        }));

        const fulfilledCount = settledResponses.filter(result => result.status === "fulfilled").length;
        if (!fulfilledCount) {
            const firstFailure = settledResponses.find(result => result.status === "rejected");
            throw firstFailure?.reason || new Error("No se pudo consultar ninguna fuente del gráfico");
        }

        settledResponses.forEach((result, index) => {
            if (result.status === "rejected") {
                console.warn(`No se pudo consultar la fuente del gráfico ${urls[index]}:`, result.reason);
            }
        });

        return groupRows(features, chartConfig).map(row => ({
            ...row,
            color: row.attributes?.__chartColor
        }));
    }

    function renderRowsIntoChart(canvas, rows, chartConfig, layer = null, options = {}) {
        const chartRows = chartConfig?.id === "pib-departamental"
            ? rows.map(row => ({
                ...row,
                color: "#22c55e"
            }))
            : rows;
        if (canvas.__barChartResizeTimer) {
            window.clearTimeout(canvas.__barChartResizeTimer);
            canvas.__barChartResizeTimer = null;
        }
        chartCore.destroyChart();
        resetPibDepartmentCanvas(canvas, chartConfig);
        prepareVisibleChartCanvas(canvas, chartConfig);
        chartCore.setRows(chartRows);
        const shouldSyncLegendFromChart = chartConfig?.id !== "pib-departamental";
        window.__chartLegendOrder = shouldSyncLegendFromChart
            ? (chartRows || []).map(row => ({
                code: String(row.rawLabel ?? row.label ?? "").trim(),
                label: row.label,
                color: row.color
            })).filter(item => item.code)
            : [];

        const labels = chartRows.map(row => row.label);
        const values = chartRows.map(row => row.value);
        const legendCodes = chartRows.map(row => String(row.rawLabel ?? row.label ?? "").trim());
        const legendColors = chartRows.map(row => row.color || "#999");
        const legendField = chartConfig?.mapInteractionField || chartConfig?.xAxis?.field;
        const legendBaseWhere = String(options.baseWhere || buildWhere(chartConfig) || getWhereBase?.() || "1=1").trim() || "1=1";
        const legendLayers = Array.isArray(options.legendLayers) && options.legendLayers.length
            ? options.legendLayers.filter(currentLayer => currentLayer && !currentLayer.destroyed && !currentLayer.__legendExcluded)
            : (chartConfig?.mapInteraction?.allLayers
                ? (getLayersGlobal?.() || []).filter(currentLayer => currentLayer && !currentLayer.destroyed && !currentLayer.__legendExcluded)
                : [layer].filter(currentLayer => currentLayer && !currentLayer.destroyed && !currentLayer.__legendExcluded));
        const symbolByCode = new Map();
        const labelByCode = new Map();
        const colorByCode = new Map();
        let fallbackLegendSymbol = null;
        [...legendLayers, layer].forEach(currentLayer => {
            if (!currentLayer?.renderer) return;
            const rendererItems = getRendererLegendItems(currentLayer.renderer, chartConfig);
            if (!fallbackLegendSymbol && rendererItems.length === 1 && rendererItems[0]?.symbol) {
                fallbackLegendSymbol = rendererItems[0].symbol;
            }
            rendererItems.forEach(item => {
                const code = String(item?.code ?? "").trim();
                if (code && item?.symbol && !symbolByCode.has(code)) {
                    symbolByCode.set(code, item.symbol);
                }
                if (code && item?.label && !labelByCode.has(code)) {
                    labelByCode.set(code, item.label);
                }
                if (code && item?.color && !colorByCode.has(code)) {
                    colorByCode.set(code, item.color);
                }
            });
        });
        const legendLabels = legendCodes.map((code, index) => labelByCode.get(String(code).trim()) || labels[index]);
        const resolvedLegendColors = legendCodes.map((code, index) => colorByCode.get(String(code).trim()) || legendColors[index]);
        const usesMultiLayerConnectivityLegend = chartConfig?.mapInteraction?.allLayers && legendLayers.length > 1;
        const legendSymbols = legendCodes.map(code =>
            symbolByCode.get(String(code).trim()) || (usesMultiLayerConnectivityLegend ? null : fallbackLegendSymbol) || null
        );
        window.__clearLegendLayerFilters?.(legendLayers);
        const syncLegendFromChartRows = () => {
            if (typeof window.actualizarLeyenda !== "function") return;
            window.actualizarLeyenda(legendLabels, resolvedLegendColors, legendCodes, {
                field: legendField,
                baseWhere: legendBaseWhere,
                layers: legendLayers,
                symbols: legendSymbols,
                preserveOrder: true
            });
        };
        if (shouldSyncLegendFromChart) {
            syncLegendFromChartRows();
            window.setTimeout(syncLegendFromChartRows, 250);
        }

        applyScrollableChartSize(canvas, rows, chartConfig);
        setChartStatus(canvas, "");

        if (typeof Chart === "undefined") {
            setChartStatus(canvas, "Chart.js no está cargado.");
            return;
        }

        const dataLabelPlugin = createDataLabelPlugin(chartConfig);
        const datasetColors = chartConfig?.id === "pib-departamental"
            ? {
                background: rows.map(() => "rgba(22, 163, 74, 1)"),
                border: "rgba(21, 128, 61, 1)"
            }
            : {};
        const chartOptions = applyPibDepartmentChartSizing(createBarChartOptions({
            chartConfig,
            labels,
            rawLabels: labels,
            rowsByLabel: chartCore.getRowsByLabel(),
            onBarClick: async department => {
                if (layer && typeof chartInteractions.toggleChartMapSelection === "function") {
                    await chartInteractions.toggleChartMapSelection(layer, chartConfig, department);
                    return;
                }
                chartInteractions.highlightBar(department, chartConfig?.id === "pib-departamental"
                    ? {
                        exclusiveCategory: false,
                        solidSiblings: true,
                        selectedFillColor: "#166534",
                        selectedBorderColor: "#14532d",
                        selectedBorderWidth: 1
                    }
                    : { exclusiveCategory: false });
                if (layer) await chartInteractions.highlightMapByChartValue(layer, chartConfig, department);
            }
        }), chartConfig);

        destroyCanvasChart(canvas);
        const chartInstance = new Chart(canvas, {
            type: chartConfig.type || "bar",
            data: {
                labels,
                datasets: [(() => {
                    const dataset = applyPibDepartmentDatasetSizing(applyConfiguredBarDatasetSizing(createDefaultBarDataset({
                        label: chartConfig.title || "PIB por departamento",
                        data: values,
                        rows,
                        colors: datasetColors
                    }), chartConfig), chartConfig);
                    return dataset;
                })()]
            },
            options: chartOptions,
            plugins: dataLabelPlugin ? [dataLabelPlugin] : []
        });

        chartCore.setInstance(chartInstance);
        if (canvas.__barChartClickHandler) {
            canvas.removeEventListener("click", canvas.__barChartClickHandler);
        }
        if (chartConfig?.id === "pib-departamental") {
            installPibDepartmentPanGuard(canvas);
        } else {
            cleanupPibDepartmentPanGuard(canvas);
        }
        canvas.__barChartClickHandler = async event => {
            if (shouldIgnorePibDepartmentClick(canvas, chartConfig)) return;

            const points = chartInstance.getElementsAtEventForMode?.(
                event,
                "nearest",
                { intersect: false },
                true
            ) || [];
            if (!points.length) return;

            const label = chartInstance.data?.labels?.[points[0].index];
            if (!label) return;
            if (layer && typeof chartInteractions.toggleChartMapSelection === "function") {
                await chartInteractions.toggleChartMapSelection(layer, chartConfig, label);
                return;
            }
            chartInteractions.highlightBar(label, chartConfig?.id === "pib-departamental"
                ? {
                    exclusiveCategory: false,
                    solidSiblings: true,
                    selectedFillColor: "#166534",
                    selectedBorderColor: "#14532d",
                    selectedBorderWidth: 1
                }
                : { exclusiveCategory: false });
            if (layer) await chartInteractions.highlightMapByChartValue(layer, chartConfig, label);
        };
        canvas.addEventListener("click", canvas.__barChartClickHandler);
        canvas.__barChartResizeTimer = window.setTimeout(() => {
            canvas.__barChartResizeTimer = null;
            if (chartCore.getInstance() !== chartInstance || Chart.getChart?.(canvas) !== chartInstance) return;

            applyScrollableChartSize(canvas, rows, chartConfig);
            const width = Math.max(320, Math.floor(canvas.getBoundingClientRect().width || canvas.width || 320));
            const height = Number.isFinite(chartConfig?.canvasHeight) ? chartConfig.canvasHeight : 345;
            chartInstance.resize(width, height);
            chartInstance.update("none");
        }, 100);

        const selectedDepartment = getCurrentDepartmentChartLabel(
            rows,
            getDeptoActual?.(),
            getDiccionarioDepartamentos?.()
        );
        if (selectedDepartment) {
            chartInteractions.highlightBar(selectedDepartment, chartConfig?.id === "pib-departamental"
                ? {
                    exclusiveCategory: false,
                    solidSiblings: true,
                    selectedFillColor: "#166534",
                    selectedBorderColor: "#14532d",
                    selectedBorderWidth: 1
                }
                : undefined);
        }
    }

    async function renderChartFromLayer(layer, config) {
        const chartConfig = config?.chartConfig;
        if (!chartConfig || chartConfig.library !== "chart.js") return false;

        destroyGeoformasCharts?.();

        if (typeof Chart === "undefined") {
            console.error("Chart.js no está cargado");
            return true;
        }

        const canvas = document.getElementById("chart");
        if (!canvas) {
            console.error("Canvas #chart no existe");
            return true;
        }
        prepareVisibleChartCanvas(canvas, chartConfig);

        const fields = getChartFields(chartConfig);
        const xField = chartConfig.xAxis?.field;
        const yField = chartConfig.yAxis?.field;
        if (!xField || !yField) return true;

        const sourceUrl = layer?.__sourceUrl || layer?.url;
        const queryLayer = typeof layer?.createQuery === "function"
            ? layer
            : (sourceUrl ? new FeatureLayer({ url: sourceUrl, outFields: fields }) : layer);
        await queryLayer.when?.();

        const query = queryLayer.createQuery();
        query.where = buildWhere(chartConfig);
        query.outFields = fields;
        query.returnGeometry = false;
        if (chartConfig?.filter?.scope !== "allDepartments") {
            applyWhereToActiveLayers?.(query.where);
        }

        const result = await queryLayer.queryFeatures(query);
        if (queryLayer !== layer) queryLayer.destroy?.();
        const fieldInfo = chartConfig?.labelsFromDomain
            ? await getChartFieldInfo({
                layers: [queryLayer],
                urls: [String(sourceUrl || "")].filter(Boolean),
                fieldName: chartConfig?.xAxis?.field
            })
            : null;
        const features = (result.features || []).map(feature =>
            normalizeFeatureForChart(feature, chartConfig, null, fieldInfo)
        );

        if (!features.length) {
            chartCore.destroyChart();
            prepareVisibleChartCanvas(canvas, chartConfig);
            setChartTitle(chartConfig.title || config.title);
            setChartStatus(canvas, "No hay datos para el filtro seleccionado.");
            return true;
        }

        const rows = groupRows(features, chartConfig);
        if (!rows.length) {
            chartCore.destroyChart();
            prepareVisibleChartCanvas(canvas, chartConfig);
            setChartTitle(chartConfig.title || config.title);
            setChartStatus(canvas, "No hay datos para el filtro seleccionado.");
            return true;
        }

        setChartTitle(chartConfig.title || config.title);
        setChartTitle(resolveTitle(chartConfig, config, rows));
        renderRowsIntoChart(canvas, rows, chartConfig, layer);
        return true;
    }

    async function actualizarGrafica(layer, config) {
        const canvas = document.getElementById("chart");
        try {
            if (await renderChartFromLayer(layer, config)) return;
            chartCore.destroyChart();
            setChartTitle(config?.title || "");
        } catch (error) {
            chartCore.destroyChart();
            if (canvas) {
                prepareVisibleChartCanvas(canvas, config?.chartConfig);
                setChartStatus(
                    canvas,
                    isServiceUnavailableError(error)
                        ? "El servicio del gráfico no está disponible en este momento."
                        : `No se pudo cargar el gráfico: ${String(error?.message || error)}`
                );
            }
            throw error;
        }
    }

    return {
        actualizarGrafica,
        applyScrollableChartSize,
        prepareVisibleChartCanvas,
        queryChartRowsFromRest,
        renderChartFromLayer,
        renderRowsIntoChart,
        resolveTitle,
        setChartStatus,
        setChartTitle
    };
}
