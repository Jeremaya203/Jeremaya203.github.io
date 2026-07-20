import { getChartBaseWhere } from "../core/chartUtils.js?v=travel-time-pie-20260511";
import { createHorizontalStackedBarOptions, ensureZoomKeepsVisibleData } from "../core/chartOptions.js?v=global-safe-zoom-labels-20260604";
import { renderPieChart } from "../renderers/pieChartRenderer.js?v=shared-pie-labels-20260701";
import { prepareVisibleChartCanvas, setChartTitle } from "../ui/chartPanel.js?v=local-chart-title-20260529";
import { setChartStatus } from "../ui/chartStatus.js";
import { buildAdaptiveFont, resolveChartLabel } from "../core/chartOptions.js?v=global-safe-zoom-labels-20260604";
import { getRendererLegendItems, getRendererVisualForValue } from "../core/chartSymbolUtils.js?v=facilities-municipal-renderer-symbol-legend-20260604";
import { destroyCanvasChart } from "../core/chartLifecycle.js";

const EQUIPMENT_CHART_ID = "equipamientos-infraestructura";
const DEFAULT_COLORS = [
    "#2563eb",
    "#0f766e",
    "#7c3aed",
    "#dc2626",
    "#ca8a04",
    "#0891b2",
    "#4f46e5",
    "#16a34a",
    "#be123c",
    "#9333ea"
];
const unknownLabel = "Sin información";

export function createEquipamientosChartController({
    chartCore,
    getWhereBase,
    getFiltroNivel,
    getDeptoActual,
    getDiccionarioDepartamentos,
    getLayerGlobal,
    getView,
    refreshSummary
}) {
    let pieChart = null;
    let stackedChart = null;
    let activeCategoryCode = "";

    function isEquipamientosChart(chartConfig) {
        return chartConfig?.id === EQUIPMENT_CHART_ID;
    }

    function destroyCharts() {
        destroyCanvasChart(document.getElementById("equipamientosPieChart"));
        destroyCanvasChart(document.getElementById("equipamientosStackedChart"));
        pieChart = null;
        stackedChart = null;
        activeCategoryCode = "";
        const panel = document.getElementById("equipamientosChartsPanel");
        if (panel) panel.hidden = true;
        const chartScroll = document.getElementById("pibChartScroll");
        if (chartScroll) chartScroll.style.display = "block";
    }

    function buildWhere(chartConfig) {
        return getChartBaseWhere({
            chartConfig,
            whereBase: getWhereBase?.(),
            filtroNivel: getFiltroNivel?.(),
            deptoActual: getDeptoActual?.(),
            diccionarioDepartamentos: getDiccionarioDepartamentos?.()
        });
    }

    function ensurePanel() {
        const mainCanvas = document.getElementById("chart");
        if (!mainCanvas) return null;

        let panel = document.getElementById("equipamientosChartsPanel");
        if (!panel) {
            panel = document.createElement("section");
            panel.id = "equipamientosChartsPanel";
            panel.className = "equipamientos-charts-panel";
            panel.innerHTML = `
                <article class="equipamientos-chart-box">
                    <h4 id="equipamientosPieTitle" class="equipamientos-chart-title"></h4>
                    <div class="equipamientos-chart-canvas"><canvas id="equipamientosPieChart"></canvas></div>
                    <div id="equipamientosPieStatus" class="pib-chart-status" hidden></div>
                </article>
                <article class="equipamientos-chart-box">
                    <h4 id="equipamientosStackedTitle" class="equipamientos-chart-title"></h4>
                    <div class="equipamientos-chart-canvas"><canvas id="equipamientosStackedChart"></canvas></div>
                    <div id="equipamientosStackedStatus" class="pib-chart-status" hidden></div>
                </article>
            `;
        }
        const chartScroll = mainCanvas.closest("#pibChartScroll");
        const anchor = chartScroll || mainCanvas;
        if (panel.parentNode !== anchor.parentNode || panel.previousElementSibling !== anchor) {
            anchor.insertAdjacentElement("afterend", panel);
        }
        return panel;
    }

    function setStatus(id, message = "") {
        const status = document.getElementById(id);
        if (!status) return;
        status.textContent = message;
        status.hidden = !message;
    }

    function preparePanel(config) {
        const canvas = document.getElementById("chart");
        if (canvas) prepareVisibleChartCanvas(canvas);
        const chartScroll = document.getElementById("pibChartScroll");
        if (chartScroll) chartScroll.style.display = "none";
        const panel = ensurePanel();
        if (panel) panel.hidden = false;
        if (canvas) canvas.style.display = "none";
        setChartTitle("");
        document.getElementById("equipamientosPieTitle").textContent = config?.chartConfig?.pieTitle || "";
        document.getElementById("equipamientosStackedTitle").textContent = config?.chartConfig?.stackedTitle || "";
        setStatus("equipamientosPieStatus", "Cargando gráfico...");
        setStatus("equipamientosStackedStatus", "Cargando gráfico...");
    }

    function getFieldInfo(layer, fieldName) {
        return (layer?.fields || []).find(field =>
            String(field?.name || "").toLowerCase() === String(fieldName || "").toLowerCase()
        ) || null;
    }

    function getDomainLabel(layer, fieldName, value) {
        const raw = String(value ?? "").trim();
        if (!raw) return unknownLabel;
        const codedValues = getFieldInfo(layer, fieldName)?.domain?.codedValues
            || layer?.domainByField?.[String(fieldName || "").toLowerCase()]?.codedValues
            || [];
        const hit = codedValues.find(item => String(item.code) === raw);
        return String(hit?.name ?? raw).trim();
    }

    function validateFields(layer, chartConfig) {
        const required = Object.values(chartConfig?.requiredFields || {}).filter(item => item?.name);
        if (!required.length) return;
        const fieldNames = new Set((layer?.fields || []).map(field => String(field?.name || "").toLowerCase()));
        const missing = required.filter(field => !fieldNames.has(String(field.name).toLowerCase()));
        if (missing.length) {
            throw new Error(`La configuración del gráfico requiere campos no disponibles en la tabla: ${missing.map(field => field.name).join(", ")}`);
        }
    }

    function getEquipmentFields(chartConfig) {
        return [
            ...(chartConfig?.fields || []),
            chartConfig?.xAxis?.field,
            chartConfig?.stackField,
            chartConfig?.filter?.municipalityField,
            ...(Object.values(chartConfig?.requiredFields || {}).map(field => field?.name).filter(Boolean))
        ].filter(Boolean);
    }

    function selectOptionLabel(selectId, value) {
        const option = document.querySelector(`#${selectId} option[value="${CSS.escape(String(value ?? ""))}"]`);
        return option?.textContent?.trim() || "";
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
            mpcategor: "Municipio",
            mpnombre: municipality || attrs.mpnombre || "",
            dpnombre: department || attrs.dpnombre || ""
        };
    }

    function resolveTitle(template, attrs = {}) {
        if (!template) return "";
        const place = readablePlace(attrs);
        return template.replace(/\{(\w+)\}/g, (_, key) => place[key] || attrs[key] || "");
    }

    async function fetchJson(url) {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const json = await response.json();
        if (json.error) throw new Error(json.error.message || "Error consultando servicio de equipamientos");
        return json;
    }

    async function getQueryMetadata(layer, chartConfig) {
        const url = chartConfig?.serviceUrl || chartConfig?.layerUrl || chartConfig?.url;
        const metadata = Array.isArray(layer?.fields) && layer.fields.length
            ? { fields: layer.fields }
            : await fetchJson(`${url}?f=json`);
        const domainByField = {};
        try {
            const rootUrl = url.replace(/\/\d+\/?$/, "");
            const domainsJson = await fetchJson(`${rootUrl}/queryDomains?layers=${encodeURIComponent(`[${chartConfig.layerId}]`)}&f=json`);
            const domains = domainsJson?.domains || [];
            (chartConfig?.fields || []).forEach(fieldName => {
                const normalizedField = String(fieldName || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
                const domain = domains.find(item =>
                    String(item?.name || "").replace(/[^a-z0-9]/gi, "").toLowerCase().includes(normalizedField)
                );
                if (domain) domainByField[String(fieldName).toLowerCase()] = domain;
            });
        } catch (error) {
            console.warn("No se pudieron resolver dominios de equipamientos:", error);
        }
        return {
            fields: metadata.fields || [],
            domainByField,
            url
        };
    }

    async function queryAllFeatures(layer, chartConfig) {
        const queryLayer = await getQueryMetadata(layer, chartConfig);
        validateFields(queryLayer, chartConfig);

        const where = buildWhere(chartConfig);
        const outFields = [...new Set(getEquipmentFields(chartConfig))];
        const features = [];
        let offset = 0;
        const pageSize = 2000;
        const url = chartConfig?.serviceUrl || chartConfig?.layerUrl || chartConfig?.url;

        while (true) {
            const params = new URLSearchParams({
                f: "json",
                where,
                outFields: outFields.join(","),
                returnGeometry: "false",
                resultRecordCount: String(pageSize),
                resultOffset: String(offset)
            });
            const result = await fetchJson(`${url}/query?${params.toString()}`);
            const batch = result?.features || [];
            features.push(...batch);
            if (!result?.exceededTransferLimit && batch.length < pageSize) break;
            if (!batch.length) break;
            offset += batch.length;
        }

        return { features, where, layer: queryLayer };
    }

    function buildRows(features, layer, chartConfig) {
        const categoryField = chartConfig?.xAxis?.field;
        const componentField = chartConfig?.stackField;
        const categoryMap = new Map();
        const componentSet = new Set();
        let firstAttrs = {};

        (features || []).forEach(feature => {
            const attrs = feature?.attributes || {};
            if (!firstAttrs.mpcodigo) firstAttrs = attrs;
            const categoryCode = String(attrs[categoryField] ?? "").trim() || unknownLabel;
            const componentCode = String(attrs[componentField] ?? "").trim() || unknownLabel;
            componentSet.add(componentCode);
            if (!categoryMap.has(categoryCode)) {
                categoryMap.set(categoryCode, {
                    code: categoryCode,
                    label: getDomainLabel(layer, categoryField, categoryCode),
                    total: 0,
                    components: new Map(),
                    attributes: attrs
                });
            }
            const category = categoryMap.get(categoryCode);
            category.total += 1;
            category.components.set(componentCode, (category.components.get(componentCode) || 0) + 1);
        });

        const categories = [...categoryMap.values()].sort((a, b) => a.label.localeCompare(b.label, "es"));
        const components = [...componentSet].map(code => ({
            code,
            label: getDomainLabel(layer, componentField, code)
        })).sort((a, b) => a.label.localeCompare(b.label, "es"));

        return {
            total: features.length,
            firstAttrs,
            categories,
            components
        };
    }

    function formatInteger(value) {
        const numericValue = Number(value);
        return Number.isFinite(numericValue) ? numericValue.toLocaleString("es-CO") : "0";
    }

    function wrapLabelLines(value, maxLineLength = 20, maxLines = 3) {
        const text = String(value || "").trim();
        if (!text) return [""];
        const lines = [];
        let current = "";
        text.split(/\s+/).forEach(word => {
            const candidate = current ? `${current} ${word}` : word;
            if (!current || candidate.length <= maxLineLength) {
                current = candidate;
                return;
            }
            lines.push(current);
            current = word;
        });
        if (current) lines.push(current);
        if (lines.length <= maxLines) return lines;
        const visibleLines = lines.slice(0, maxLines);
        visibleLines[maxLines - 1] = `${visibleLines[maxLines - 1].slice(0, Math.max(1, maxLineLength - 3)).trim()}...`;
        return visibleLines;
    }

    function categoryByLabel(rows, label) {
        return rows.categories.find(category => category.label === label) || null;
    }

    function applyLinkedCategoryHighlight(categoryCode) {
        const normalizedCode = String(categoryCode || "").trim();
        if (!normalizedCode) {
            clearLinkedCategoryHighlight();
            return;
        }
        if (activeCategoryCode === normalizedCode) return;
        activeCategoryCode = normalizedCode;

        if (pieChart) {
            const categories = pieChart.$equipamientosCategories || [];
            const dataset = pieChart.data?.datasets?.[0];
            if (dataset) {
                pieChart.stop?.();
                dataset.borderColor = categories.map(category =>
                    String(category.code) === normalizedCode ? "#064e3b" : "#ffffff"
                );
                dataset.borderWidth = categories.map(category =>
                    String(category.code) === normalizedCode ? 4 : 1
                );
                dataset.offset = categories.map(() => 0);
                pieChart.update("none");
            }
        }

        if (stackedChart) {
            stackedChart.stop?.();
            stackedChart.data.datasets.forEach(dataset => {
                const selected = String(dataset.categoryCode) === normalizedCode;
                dataset.backgroundColor = selected ? dataset.baseColor : `${dataset.baseColor}55`;
                dataset.borderColor = selected ? "#064e3b" : dataset.baseColor;
                dataset.borderWidth = selected ? 3 : 1;
                dataset.borderSkipped = selected ? false : "start";
            });
            stackedChart.update("none");
        }
    }

    function clearLinkedCategoryHighlight() {
        if (!activeCategoryCode) return;
        activeCategoryCode = "";

        if (pieChart) {
            const categories = pieChart.$equipamientosCategories || [];
            const dataset = pieChart.data?.datasets?.[0];
            if (dataset) {
                pieChart.stop?.();
                dataset.borderColor = categories.map(() => "#ffffff");
                dataset.borderWidth = categories.map(() => 1);
                dataset.offset = categories.map(() => 0);
                pieChart.update("none");
            }
        }

        if (stackedChart) {
            stackedChart.stop?.();
            stackedChart.data.datasets.forEach(dataset => {
                dataset.backgroundColor = dataset.baseColor;
                dataset.borderColor = dataset.baseColor;
                dataset.borderWidth = 1;
                dataset.borderSkipped = "start";
            });
            stackedChart.update("none");
        }
    }

    function createEquipamientosStackedValueLabelsPlugin() {
        return {
            id: "equipamientos-stacked-value-labels",
            afterDatasetsDraw(chart) {
                const { ctx, chartArea } = chart;
                if (!chartArea) return;

                const rowCount = Math.max(
                    ...(chart.data?.labels || []).map(label =>
                        Array.isArray(label) ? label.length : 1
                    ),
                    chart.data?.labels?.length || 0
                );
                const fontSize = rowCount > 14 ? 8 : 9;

                ctx.save();
                ctx.font = `500 ${fontSize}px Outfit, sans-serif`;
                ctx.textBaseline = "middle";

                (chart.data?.datasets || []).forEach((dataset, datasetIndex) => {
                    if (!chart.isDatasetVisible(datasetIndex)) return;
                    const meta = chart.getDatasetMeta(datasetIndex);
                    (meta?.data || []).forEach((bar, index) => {
                        const value = Number(dataset.data?.[index]);
                        if (!Number.isFinite(value) || value <= 0 || bar?.hidden) return;
                        if (!bar || !Number.isFinite(bar.y)) return;
                        if (bar.y < chartArea.top + 4 || bar.y > chartArea.bottom - 4) return;

                        const barStart = Math.min(bar.base ?? 0, bar.x ?? 0);
                        const barEnd = Math.max(bar.base ?? 0, bar.x ?? 0);
                        const barWidth = Math.max(0, barEnd - barStart);
                        const label = formatInteger(value);
                        const textWidth = ctx.measureText(label).width;
                        const fitsInside = barWidth >= textWidth + 8;

                        if (fitsInside) {
                            ctx.fillStyle = "#ffffff";
                            ctx.textAlign = "center";
                            ctx.fillText(label, barStart + barWidth / 2, bar.y);
                        } else {
                            ctx.fillStyle = "#333333";
                            ctx.textAlign = "left";
                            const labelX = Math.min(barEnd + 4, chartArea.right - textWidth - 2);
                            ctx.fillText(label, labelX, bar.y);
                        }
                    });
                });
                ctx.restore();
            }
        };
    }

    function createLinkedCategoryBorderPlugin() {
        return {
            id: "equipamientos-linked-category-border",
            afterDatasetsDraw(chart) {
                if (!activeCategoryCode) return;
                const datasetIndex = chart.data.datasets.findIndex(dataset =>
                    String(dataset.categoryCode) === activeCategoryCode
                );
                if (datasetIndex < 0 || !chart.isDatasetVisible(datasetIndex)) return;

                const meta = chart.getDatasetMeta(datasetIndex);
                const dataset = chart.data.datasets[datasetIndex];
                const ctx = chart.ctx;
                ctx.save();
                ctx.strokeStyle = "#064e3b";
                ctx.lineWidth = 3;
                ctx.lineJoin = "round";
                (meta?.data || []).forEach((bar, index) => {
                    if (Number(dataset.data?.[index]) <= 0 || bar?.hidden) return;
                    const left = Math.min(Number(bar.x), Number(bar.base));
                    const right = Math.max(Number(bar.x), Number(bar.base));
                    const top = Number(bar.y) - Number(bar.height) / 2;
                    const width = right - left;
                    const height = Number(bar.height);
                    if (![left, top, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return;
                    const inset = ctx.lineWidth / 2;
                    ctx.strokeRect(
                        left + inset,
                        top + inset,
                        Math.max(0, width - ctx.lineWidth),
                        Math.max(0, height - ctx.lineWidth)
                    );
                });
                ctx.restore();
            }
        };
    }

    function mapServerLegendInfo(layer) {
        const url = String(layer?.__sourceUrl || layer?.url || "").trim();
        const match = url.match(/^(.*\/MapServer)\/(\d+)(?:\?.*)?$/i);
        return match
            ? { url: `${match[1]}/legend?f=json`, layerId: Number(match[2]) }
            : null;
    }

    async function resolveServiceLegendSymbol(layer, renderer, code, label, chartConfig) {
        const legendInfo = mapServerLegendInfo(layer);
        if (!legendInfo) return null;

        try {
            const json = await fetchJson(legendInfo.url);
            const layerLegend = (json?.layers || []).find(item =>
                Number(item?.layerId ?? item?.id) === legendInfo.layerId
            );
            const entries = layerLegend?.legend || [];
            const rendererItems = getRendererLegendItems(renderer, chartConfig);
            const rendererIndex = rendererItems.findIndex(item => String(item?.code ?? "").trim() === String(code ?? "").trim());
            const normalizedLabel = String(label || "").trim().toLowerCase();
            const entry = entries.find(item => String(item?.label || "").trim().toLowerCase() === normalizedLabel)
                || (rendererIndex >= 0 ? entries[rendererIndex] : null);
            const imageData = String(entry?.imageData || "").trim();
            if (!imageData) return null;
            return {
                type: "legend-image",
                imageData,
                contentType: String(entry?.contentType || "image/png").trim() || "image/png"
            };
        } catch {
            return null;
        }
    }

    async function queryMapLegendItem(chartConfig) {
        const mapLayer = getLayerGlobal?.();
        if (!mapLayer?.createQuery) return null;

        const rendererField = String(chartConfig?.legendField || "no_prestadores").trim();
        if (!rendererField) return null;

        try {
            await mapLayer.when?.();
            const renderer = mapLayer.renderer;
            if (!renderer) return null;

            const query = mapLayer.createQuery();
            query.where = String(mapLayer.definitionExpression || buildWhere(chartConfig) || "1=1").trim() || "1=1";
            query.outFields = [rendererField];
            query.returnGeometry = false;
            query.num = 1;
            const result = await mapLayer.queryFeatures(query);
            const attrs = result?.features?.[0]?.attributes || {};
            const value = attrs?.[rendererField];
            if (value == null || String(value).trim() === "") return null;
            const visual = getRendererVisualForValue(renderer, value, chartConfig);
            const code = String(visual?.code || value || "").trim();
            const label = String(visual?.label || "").trim();
            const color = String(visual?.color || "").trim() || "#999";
            if (!code || !label) return null;
            const serviceSymbol = await resolveServiceLegendSymbol(mapLayer, renderer, code, label, chartConfig);
            return {
                code,
                label,
                color,
                symbol: serviceSymbol
                    ? { ...(visual?.symbol || {}), ...serviceSymbol }
                    : visual?.symbol || null,
                layer: mapLayer,
                field: rendererField
            };
        } catch (error) {
            console.warn("No se pudo resolver la leyenda del mapa para equipamientos:", error);
            return null;
        }
    }

    async function applyLegend(chartConfig) {
        if (typeof window.actualizarLeyenda !== "function") return;
        const legendItem = await queryMapLegendItem(chartConfig);
        if (!legendItem) return;
        const legendBaseWhere = String(legendItem.layer?.definitionExpression || buildWhere(chartConfig) || "1=1").trim() || "1=1";
        window.actualizarLeyenda(
            [legendItem.label],
            [legendItem.color],
            [legendItem.code],
            {
                field: legendItem.field || chartConfig?.legendField || "no_prestadores",
                baseWhere: legendBaseWhere,
                layers: [legendItem.layer],
                symbols: [legendItem.symbol],
                preserveOrder: true,
                customApply: async (state) => {
                    const mapLayer = legendItem?.layer || getLayerGlobal?.();
                    const view = getView?.();
                    if (!mapLayer) return;
                    const activeCodes = state?.activeCodes instanceof Set
                        ? [...state.activeCodes].map(value => String(value ?? "").trim()).filter(Boolean)
                        : null;
                    const shouldShowLayer = !Array.isArray(activeCodes) || activeCodes.length > 0;
                    try {
                        const layerView = view ? await view.whenLayerView(mapLayer) : null;
                        if (layerView) {
                            layerView.filter = shouldShowLayer ? null : { where: "1=0" };
                            return;
                        }
                    } catch (_) {}
                    mapLayer.visible = shouldShowLayer;
                }
            }
        );
    }

    async function actualizarGrafica(layer, config) {
        const chartConfig = config?.chartConfig;
        if (!isEquipamientosChart(chartConfig)) return false;

        destroyCharts();
        preparePanel(config);
        chartCore.destroyChart();
        window.__activeSocioChartConfig = chartConfig;
        refreshSummary?.();

        if (typeof Chart === "undefined") {
            setStatus("equipamientosPieStatus", "Chart.js no está cargado.");
            setStatus("equipamientosStackedStatus", "Chart.js no está cargado.");
            return true;
        }

        const { features, layer: queryLayer } = await queryAllFeatures(layer, chartConfig);
        if (!features.length) {
            setStatus("equipamientosPieStatus", "No hay datos para el filtro seleccionado.");
            setStatus("equipamientosStackedStatus", "No hay datos para el filtro seleccionado.");
            return true;
        }

        const rows = buildRows(features, queryLayer, chartConfig);
        const pieCanvas = document.getElementById("equipamientosPieChart");
        const stackedCanvas = document.getElementById("equipamientosStackedChart");
        const categoryColors = rows.categories.map((_, index) => DEFAULT_COLORS[index % DEFAULT_COLORS.length]);
        const componentLabels = rows.components.map(component => component.label);
        const wrappedComponentLabels = componentLabels.map(label => wrapLabelLines(label));

        setChartTitle("");
        document.getElementById("equipamientosPieTitle").textContent = resolveTitle(chartConfig.pieTitleTemplate, rows.firstAttrs);
        document.getElementById("equipamientosStackedTitle").textContent = resolveTitle(chartConfig.stackedTitleTemplate, rows.firstAttrs);
        setStatus("equipamientosPieStatus", "");
        setStatus("equipamientosStackedStatus", "");
        if (stackedCanvas) {
            stackedCanvas.style.height = "330px";
            stackedCanvas.style.minHeight = "330px";
            stackedCanvas.style.maxWidth = "100%";
            stackedCanvas.style.minWidth = "0";
        }

        await applyLegend(chartConfig);

        pieChart = renderPieChart({
            canvas: pieCanvas,
            labels: rows.categories.map(row => row.label),
            values: rows.categories.map(row => {
                const percentage = rows.total > 0 ? (row.total / rows.total) * 100 : 0;
                return percentage;
            }),
            title: chartConfig.pieTitle || chartConfig.title,
            type: "pie",
            colors: categoryColors,
            showLegend: true,
            formatValue: value => `${Number(value).toFixed(0)}%`,
            onSliceHover: label => {
                const category = categoryByLabel(rows, label);
                if (category) applyLinkedCategoryHighlight(category.code);
            },
            onSliceLeave: clearLinkedCategoryHighlight,
            onSliceClick: label => {
                const category = categoryByLabel(rows, label);
                if (category) applyLinkedCategoryHighlight(category.code);
            }
        });

        if (pieChart) {
            pieChart.$equipamientosTotal = rows.total;
            pieChart.$equipamientosCounts = rows.categories.map(row => row.total);
            pieChart.$equipamientosCategories = rows.categories;
        }

        const stackedDatasets = rows.categories.map((category, index) => ({
            label: category.label,
            categoryCode: category.code,
            baseColor: categoryColors[index],
            data: rows.components.map(component => category.components.get(component.code) || 0),
            backgroundColor: categoryColors[index],
            borderColor: categoryColors[index],
            borderWidth: 1,
            borderRadius: 3,
            borderSkipped: "start",
            maxBarThickness: 20,
            barPercentage: 0.72,
            categoryPercentage: 0.78,
            stack: "equipamientos"
        })).filter(dataset => dataset.data.some(value => value > 0));

        const stackedOptions = createHorizontalStackedBarOptions({
            xTitle: chartConfig.yAxis?.label || "Número de equipamientos",
            yTitle: "Subcategorías de equipamientos",
            yTickFontSize: rows.components.length > 14 ? 8 : 10,
            formatValue: formatInteger,
            onBarHover: ({ sector }) => {
                const category = categoryByLabel(rows, sector);
                if (category) applyLinkedCategoryHighlight(category.code);
            },
            onBarLeave: clearLinkedCategoryHighlight,
            onBarClick: ({ sector }) => {
                const category = categoryByLabel(rows, sector);
                if (category) applyLinkedCategoryHighlight(category.code);
            }
        });

        stackedOptions.plugins = {
            ...(stackedOptions.plugins || {}),
            tooltip: {
                callbacks: {
                    title(items) {
                        const index = items?.[0]?.dataIndex;
                        return index == null ? "" : (componentLabels[index] || "");
                    },
                    label(context) {
                        const label = context.dataset?.label || "";
                        return `${label}: ${formatInteger(context.parsed.x)}`;
                    }
                }
            }
        };

        stackedOptions.scales = {
            ...(stackedOptions.scales || {}),
            y: {
                ...(stackedOptions.scales?.y || {}),
                ticks: {
                    ...(stackedOptions.scales?.y?.ticks || {}),
                    autoSkip: false,
                    font: buildAdaptiveFont(componentLabels, { baseSize: rows.components.length > 14 ? 8 : 10, minSize: 8 }),
                    callback(value, index) {
                        return wrappedComponentLabels[index] || resolveChartLabel(componentLabels, index);
                    }
                }
            }
        };

        stackedOptions.plugins = {
            ...(stackedOptions.plugins || {}),
            zoom: {
                pan: {
                    enabled: true,
                    mode: "xy",
                    modifierKey: "shift"
                },
                zoom: {
                    wheel: { enabled: true },
                    pinch: { enabled: true },
                    drag: {
                        enabled: true,
                        modifierKey: "ctrl",
                        backgroundColor: "rgba(22, 101, 52, 0.12)",
                        borderColor: "rgba(22, 101, 52, 0.35)",
                        borderWidth: 1
                    },
                    mode: "xy",
                    onZoom: ensureZoomKeepsVisibleData,
                    onZoomComplete: ensureZoomKeepsVisibleData
                },
                limits: {
                    x: { min: "original", max: "original" },
                    y: { min: "original", max: "original" }
                }
            }
        };

        stackedChart = new Chart(stackedCanvas, {
            type: "bar",
            data: {
                labels: wrappedComponentLabels,
                rawLabels: componentLabels,
                datasets: stackedDatasets
            },
            options: stackedOptions,
            plugins: [
                createLinkedCategoryBorderPlugin(),
                createEquipamientosStackedValueLabelsPlugin()
            ]
        });

        return true;
    }

    function prepareChartPanelForConfig(config) {
        if (!isEquipamientosChart(config?.chartConfig)) return false;
        destroyCharts();
        preparePanel(config);
        return true;
    }

    return {
        actualizarGrafica,
        destroyCharts,
        isEquipamientosChart,
        prepareChartPanelForConfig
    };
}

