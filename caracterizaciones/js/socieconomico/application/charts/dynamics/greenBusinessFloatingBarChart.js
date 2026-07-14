import { setChartTitle, prepareVisibleChartCanvas, configureScrollableChartViewport } from "../ui/chartPanel.js?v=local-chart-title-20260529";
import { setChartStatus } from "../ui/chartStatus.js";
import { createZoomOptions, ensureZoomKeepsVisibleData } from "../core/chartOptions.js?v=global-safe-zoom-labels-20260604";
import { destroyCanvasChart } from "../core/chartLifecycle.js";
import { createAdaptiveBarValueLabelsPlugin } from "../core/adaptiveBarValueLabels.js?v=global-safe-zoom-labels-20260604";

function escapeSqlString(value) {
    return String(value ?? "").replace(/'/g, "''");
}

function normalizeText(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
}

function truncateLabel(value, maxLength = 22) {
    const text = normalizeText(value);
    if (!text || text.length <= maxLength) return text;
    return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
}

function stripInitialNumericPrefix(value) {
    return normalizeText(value).replace(/^\d+(?:\.\d+)*\.?\s+/, "").trim();
}

function isNoAplica(value) {
    const normalized = normalizeText(value)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
    return !normalized || normalized === "no aplica";
}

function selectedMunicipalityCode() {
    return document.getElementById("municipios")?.value?.trim() || "";
}

function selectedOptionLabel(selectId, value) {
    const option = document.querySelector(`#${selectId} option[value="${CSS.escape(String(value ?? ""))}"]`);
    return option?.textContent?.trim() || "";
}

function resolvePlaceValue(field, value, attrs = {}) {
    const rawValue = normalizeText(value);

    if (field === "mpcategor") {
        const labels = { "1": "departamento", "2": "municipio", "3": "distrito" };
        return labels[rawValue] || rawValue || "municipio";
    }

    if (field === "mpnombre") {
        return selectedOptionLabel("municipios", attrs.mpcodigo) || rawValue;
    }

    if (field === "dpnombre") {
        const deptCode = String(attrs.dpcodigo || attrs.mpcodigo || "").slice(0, 2);
        return selectedOptionLabel("departamentos", deptCode) || rawValue;
    }

    return rawValue;
}

function resolveTitle(chartConfig, attrs = {}) {
    const template = chartConfig.titleTemplate || chartConfig.title || "Negocios verdes";
    return template.replace(/\{([^}]+)\}/g, (_, field) => resolvePlaceValue(field, attrs[field], attrs));
}

function createValueLabelsPlugin() {
    return {
        id: "greenBusinessValueLabels",
        afterDatasetsDraw(chart) {
            const { ctx, chartArea } = chart;
            if (!chartArea) return;
            const isHorizontal = String(chart?.options?.indexAxis || "").toLowerCase() === "y";
            ctx.save();
            ctx.beginPath();
            ctx.rect(chartArea.left, chartArea.top, chartArea.right - chartArea.left, chartArea.bottom - chartArea.top);
            ctx.clip();
            ctx.font = "600 10px sans-serif";
            ctx.fillStyle = "#333";
            chart.data.datasets.forEach((dataset, datasetIndex) => {
                if (!chart.isDatasetVisible(datasetIndex)) return;
                const meta = chart.getDatasetMeta(datasetIndex);
                meta.data.forEach((bar, index) => {
                    const value = Array.isArray(dataset.data[index])
                        ? dataset.data[index][1] - dataset.data[index][0]
                        : dataset.data[index];
                    if (!Number.isFinite(Number(value)) || Number(value) <= 0) return;
                    const label = String(Math.trunc(value));
                    if (isHorizontal) {
                        const maxX = chartArea.right - 6;
                        const preferredX = Number(bar.x) + 6;
                        const labelWidth = ctx.measureText(label).width;
                        const fitsRight = preferredX + labelWidth <= maxX;
                        ctx.textAlign = fitsRight ? "left" : "right";
                        ctx.textBaseline = "middle";
                        const x = fitsRight ? preferredX : Math.max(chartArea.left + labelWidth + 6, maxX);
                        const y = Math.min(chartArea.bottom - 8, Math.max(chartArea.top + 8, Number(bar.y)));
                        ctx.fillText(label, x, y);
                        return;
                    }

                    ctx.textAlign = "center";
                    ctx.textBaseline = "bottom";
                    const x = Math.min(chartArea.right - 8, Math.max(chartArea.left + 8, Number(bar.x)));
                    const y = Math.max(chartArea.top + 12, Number(bar.y) - 4);
                    ctx.fillText(label, x, y);
                });
            });
            ctx.restore();
        }
    };
}

function getLegendDatasetIndex(chart, event) {
    const legend = chart?.legend;
    const boxes = legend?.legendHitBoxes || [];
    const items = legend?.legendItems || [];
    if (!legend || !boxes.length || !items.length) return null;

    const point = Chart?.helpers?.getRelativePosition
        ? Chart.helpers.getRelativePosition(event, chart)
        : (() => {
            const rect = chart.canvas.getBoundingClientRect();
            return { x: event.clientX - rect.left, y: event.clientY - rect.top };
        })();

    const hitIndex = boxes.findIndex(box => {
        const padding = 8;
        return point.x >= box.left - padding
            && point.x <= box.left + box.width + padding
            && point.y >= box.top - padding
            && point.y <= box.top + box.height + padding;
    });

    if (hitIndex < 0) return null;
    return Number.isInteger(items[hitIndex]?.datasetIndex)
        ? items[hitIndex].datasetIndex
        : hitIndex;
}

function toggleDatasetVisibility(chart, datasetIndex) {
    if (!chart || !Number.isInteger(datasetIndex)) return;
    chart.setDatasetVisibility(datasetIndex, !chart.isDatasetVisible(datasetIndex));
    chart.update("none");
}

function bindDatasetLegendPointerToggle(chart, canvas, handlersKey = "$greenBusinessLegendHandlers") {
    if (!chart || !canvas) return;
    if (canvas[handlersKey]) {
        canvas.removeEventListener("pointerdown", canvas[handlersKey].pointerdown, true);
        canvas.removeEventListener("click", canvas[handlersKey].click, true);
    }

    let suppressNextClick = false;

    const toggleFromLegendEvent = event => {
        const datasetIndex = getLegendDatasetIndex(chart, event);
        if (!Number.isInteger(datasetIndex)) return false;

        event.preventDefault();
        event.stopImmediatePropagation();
        toggleDatasetVisibility(chart, datasetIndex);
        return true;
    };

    const pointerdown = event => {
        if (event.button != null && event.button !== 0) return;
        suppressNextClick = toggleFromLegendEvent(event);
    };

    const click = event => {
        const datasetIndex = getLegendDatasetIndex(chart, event);
        if (!Number.isInteger(datasetIndex)) return;

        event.preventDefault();
        event.stopImmediatePropagation();
        if (suppressNextClick) {
            suppressNextClick = false;
            return;
        }
        toggleDatasetVisibility(chart, datasetIndex);
    };

    canvas[handlersKey] = { pointerdown, click };
    canvas.addEventListener("pointerdown", pointerdown, true);
    canvas.addEventListener("click", click, true);
}

function createSupportZoomOptions(mode = "xy") {
    return {
        ...createZoomOptions(),
        pan: {
            enabled: true,
            mode,
            modifierKey: "shift"
        },
        zoom: {
            wheel: { enabled: true },
            pinch: { enabled: true },
            drag: {
                enabled: true,
                modifierKey: "ctrl",
                backgroundColor: "rgba(2, 132, 199, 0.12)",
                borderColor: "rgba(2, 132, 199, 0.35)",
                borderWidth: 1
            },
            mode,
            onZoom: ensureZoomKeepsVisibleData,
            onZoomComplete: ensureZoomKeepsVisibleData
        },
        limits: {
            x: { min: "original", max: "original" },
            y: { min: "original", max: "original" }
        }
    };
}

function isCategoryScaleZoomed(scale, totalRows) {
    if (!scale || totalRows <= 0) return false;
    const min = Number(scale.min);
    const max = Number(scale.max);
    if (!Number.isFinite(min) || !Number.isFinite(max)) return false;
    return min > 0 || max < totalRows - 1;
}

function normalizeIrrigationFullYAxis(chart) {
    const labels = chart?.data?.labels || [];
    const scale = chart?.scales?.y;
    if (!scale || !labels.length) return false;

    const min = Number(scale.min);
    const max = Number(scale.max);
    if (!Number.isFinite(min) || !Number.isFinite(max)) return false;
    if (min > 0.01 || max < labels.length - 1 - 0.01) return false;

    chart.options.scales.y.min = undefined;
    chart.options.scales.y.max = undefined;
    return true;
}

function createIrrigationZoomOptions(rowCount = 0) {
    const base = createSupportZoomOptions("y");
    return {
        ...base,
        pan: {
            enabled: false,
            mode: "y",
            modifierKey: null
        },
        zoom: {
            ...(base.zoom || {}),
            mode: "y",
            onZoom(context) {
                ensureZoomKeepsVisibleData(context);
            },
            onZoomComplete(context) {
                ensureZoomKeepsVisibleData(context);
                if (normalizeIrrigationFullYAxis(context?.chart)) {
                    context.chart.update("none");
                }
            }
        },
        limits: {
            ...(base.limits || {}),
            y: {
                min: 0,
                max: Math.max(0, Number(rowCount) - 1)
            }
        }
    };
}

function bindIrrigationPointerPan(chart) {
    const canvas = chart?.canvas;
    if (!canvas) return;
    if (canvas.__irrigationPointerPanHandlers) {
        const handlers = canvas.__irrigationPointerPanHandlers;
        canvas.removeEventListener("pointerdown", handlers.pointerdown);
        canvas.removeEventListener("pointermove", handlers.pointermove);
        canvas.removeEventListener("pointerup", handlers.stopPan);
        canvas.removeEventListener("pointercancel", handlers.stopPan);
        canvas.removeEventListener("pointerleave", handlers.stopPan);
    }

    let panState = null;

    function getPanContext(event) {
        const area = chart.chartArea;
        const labels = chart.data?.labels || [];
        const yScale = chart.scales?.y;
        const canPanY = isCategoryScaleZoomed(yScale, labels.length);
        if (!area || !labels.length || !canPanY) return null;

        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const withinChart = x >= area.left && x <= area.right && y >= area.top && y <= area.bottom;
        if (!withinChart) return null;

        return { area, labels, y, yScale };
    }

    const pointerdown = event => {
        if (event.button !== 0) return;
        const context = getPanContext(event);
        if (!context) return;

        panState = {
            pointerId: event.pointerId,
            startY: context.y,
            yMin: Number(context.yScale?.min),
            yMax: Number(context.yScale?.max),
            area: context.area,
            labels: context.labels
        };
        canvas.style.cursor = "grabbing";
        canvas.setPointerCapture?.(event.pointerId);
        event.preventDefault();
    };

    const pointermove = event => {
        if (!panState) {
            canvas.style.cursor = getPanContext(event) ? "grab" : "";
            return;
        }

        const rect = canvas.getBoundingClientRect();
        const currentY = event.clientY - rect.top;
        const deltaY = currentY - panState.startY;
        const visibleSpanY = Math.max(1, panState.yMax - panState.yMin);
        const pixelsPerRow = Math.max(1, (panState.area.bottom - panState.area.top) / visibleSpanY);
        const deltaRows = deltaY / pixelsPerRow;
        const maxYStart = Math.max(0, panState.labels.length - 1 - visibleSpanY);
        const nextYMin = Math.min(maxYStart, Math.max(0, panState.yMin - deltaRows));

        chart.options.scales.y.min = nextYMin;
        chart.options.scales.y.max = nextYMin + visibleSpanY;
        chart.update("none");
        event.preventDefault();
    };

    function stopPan(event) {
        if (!panState) return;
        panState = null;
        canvas.style.cursor = getPanContext(event || {}) ? "grab" : "";
        canvas.releasePointerCapture?.(event?.pointerId);
    }

    canvas.__irrigationPointerPanHandlers = { pointerdown, pointermove, stopPan };
    canvas.addEventListener("pointerdown", pointerdown);
    canvas.addEventListener("pointermove", pointermove);
    canvas.addEventListener("pointerup", stopPan);
    canvas.addEventListener("pointercancel", stopPan);
    canvas.addEventListener("pointerleave", stopPan);
}

export function createGreenBusinessFloatingBarChartController({
    chartCore,
    getWhereBase,
    getMunicipioActual,
    getFiltroNivel,
    refreshSummary
} = {}) {
    let metadataPromise = null;
    let irrigationChart = null;

    async function getMetadata(chartConfig) {
        if (!metadataPromise) {
            metadataPromise = fetch(`${chartConfig.serviceUrl}?f=json`).then(response => response.json());
        }
        return metadataPromise;
    }

    async function validateFields(chartConfig, extraFields = []) {
        const metadata = await getMetadata(chartConfig);
        const available = new Set((metadata.fields || []).map(field => String(field.name).toLowerCase()));
        const required = [
            chartConfig.filterField || "mpcodigo",
            ...(chartConfig.titleFields || []),
            chartConfig.xAxis?.field,
            chartConfig.series?.field,
            ...extraFields
        ].filter(Boolean);
        const missing = [...new Set(required)]
            .filter(field => !available.has(String(field).toLowerCase()));
        if (missing.length) throw new Error(`Campos no disponibles en SE_IAT: ${missing.join(", ")}`);
    }

    function buildWhere(chartConfig) {
        const baseWhere = getWhereBase?.() || "1=1";
        const filters = [`(${baseWhere})`];
        const categoryField = chartConfig.series?.field || "categoria";
        const subsectorField = chartConfig.xAxis?.field || "subsector";
        filters.push(`${categoryField} <> 'No Aplica'`);
        filters.push(`${subsectorField} <> 'No Aplica'`);
        filters.push(`${categoryField} IS NOT NULL`);
        filters.push(`${subsectorField} IS NOT NULL`);
        return filters.join(" AND ");
    }

    async function queryRows(chartConfig) {
        await validateFields(chartConfig);
        const fields = [
            chartConfig.filterField || "mpcodigo",
            ...(chartConfig.titleFields || []),
            chartConfig.series?.field || "categoria",
            chartConfig.xAxis?.field || "subsector"
        ];
        const params = new URLSearchParams({
            f: "json",
            where: buildWhere(chartConfig),
            outFields: [...new Set(fields)].join(","),
            returnGeometry: "false",
            returnDomainNames: "true",
            resultRecordCount: "2000"
        });

        const response = await fetch(`${chartConfig.serviceUrl}/query?${params.toString()}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const json = await response.json();
        if (json.error) throw new Error(json.error.message || "Error consultando negocios verdes");

        return json.features || [];
    }

    function buildGroupedData(features, chartConfig) {
        const categoryField = chartConfig.series?.field || "categoria";
        const subsectorField = chartConfig.xAxis?.field || "subsector";
        const counts = new Map();
        const categories = [];
        const subsectors = [];

        for (const feature of features || []) {
            const attrs = feature.attributes || {};
            const category = normalizeText(attrs[categoryField]);
            const subsector = normalizeText(attrs[subsectorField]);
            if (isNoAplica(category) || isNoAplica(subsector)) continue;
            if (!categories.includes(category)) categories.push(category);
            if (!subsectors.includes(subsector)) subsectors.push(subsector);
            const key = `${category}||${subsector}`;
            counts.set(key, (counts.get(key) || 0) + 1);
        }

        return { counts, categories, subsectors };
    }

    async function queryText(chartConfig) {
        const textSource = chartConfig.textSource;
        const municipality = selectedMunicipalityCode();
        if (!textSource?.url || !municipality) return textSource?.emptyMessage || "";

        const fields = textSource.fields || [];
        const params = new URLSearchParams({
            f: "json",
            where: `${textSource.filterField || "mpcodigo"} = '${escapeSqlString(municipality)}'`,
            outFields: fields.join(","),
            returnGeometry: "false",
            resultRecordCount: "1"
        });

        try {
            const response = await fetch(`${textSource.url}/query?${params.toString()}`);
            const json = await response.json();
            const attrs = json.features?.[0]?.attributes || {};
            const parts = fields.map(field => normalizeText(attrs[field])).filter(Boolean);
            return parts.length ? parts.join("\n\n") : (textSource.emptyMessage || "");
        } catch {
            return textSource.emptyMessage || "";
        }
    }

    function updateTextPanel(text) {
        const summary = document.getElementById("summaryDiv");
        if (!summary) return;
        summary.textContent = normalizeText(text) || "La información se encuentra en proceso de actualización.";
    }

    function renderChart(canvas, grouped, chartConfig, attrs) {
        chartCore?.destroyChart?.();
        destroyCanvasChart(canvas);
        const colors = chartConfig.colorPalette || ["#2E7D32", "#0284C7"];
        const displayCategories = new Map(grouped.categories.map(category => [
            category,
            stripInitialNumericPrefix(category) || category
        ]));
        const displaySubsectors = new Map(grouped.subsectors.map(subsector => [
            subsector,
            stripInitialNumericPrefix(subsector) || subsector
        ]));
        const datasets = grouped.categories.map((category, categoryIndex) => ({
            label: displayCategories.get(category) || category,
            rawLabel: category,
            data: grouped.subsectors.map(subsector => {
                const value = grouped.counts.get(`${category}||${subsector}`) || 0;
                return [0, value];
            }),
            backgroundColor: colors[categoryIndex % colors.length],
            borderColor: colors[categoryIndex % colors.length],
            borderWidth: 1
        }));

        const chart = new Chart(canvas, {
            type: "bar",
            data: {
                labels: grouped.subsectors.map(subsector => displaySubsectors.get(subsector) || subsector),
                datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: chartConfig.xAxis?.label || "Subsector"
                        },
                        ticks: {
                            display: false
                        }
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: chartConfig.yAxis?.label || "Numero de registros"
                        },
                        ticks: {
                            precision: 0,
                            color: "#334155",
                            font: { size: 10 }
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: "bottom",
                        onClick(event, legendItem, legend) {
                            toggleDatasetVisibility(legend?.chart, legendItem?.datasetIndex);
                        }
                    },
                    zoom: createSupportZoomOptions("xy"),
                    tooltip: {
                        displayColors: false,
                        callbacks: {
                            title(items) {
                                const index = items?.[0]?.dataIndex;
                                if (index == null) return "";
                                const rawLabel = grouped.subsectors[index] || "";
                                return displaySubsectors.get(rawLabel) || rawLabel;
                            },
                            label(context) {
                                return null;
                            }
                        }
                    }
                }
            },
            plugins: [createAdaptiveBarValueLabelsPlugin({
                id: "green-business-adaptive-box-labels",
                resolveValue(rawValue) {
                    const value = Array.isArray(rawValue)
                        ? Number(rawValue[1]) - Number(rawValue[0])
                        : Number(rawValue);
                    return value > 0 ? value : Number.NaN;
                },
                formatValue: value => String(Math.trunc(value))
            })]
        });

        canvas.dataset.chartLegendInteractive = "1";
        bindDatasetLegendPointerToggle(chart, canvas);
        chartCore?.setInstance?.(chart);
        chartCore?.setRows?.(grouped.subsectors.map(label => ({
            label: displaySubsectors.get(label) || label,
            rawLabel: label,
            value: grouped.categories.reduce((sum, category) => sum + (grouped.counts.get(`${category}||${label}`) || 0), 0),
            attributes: attrs
        })));
    }

    function ensureIrrigationPanel() {
        let panel = document.getElementById("irrigationDistrictsPanel");
        if (panel) return panel;
        const anchor = document.getElementById("pibChartScroll") || document.getElementById("chart");
        if (!anchor?.parentNode) return null;
        panel = document.createElement("section");
        panel.id = "irrigationDistrictsPanel";
        panel.className = "support-parallel-chart-panel";
        panel.innerHTML = `
            <h4 id="irrigationDistrictsTitle" class="support-parallel-chart-panel__title"></h4>
            <div class="support-parallel-chart-panel__scroll">
                <canvas id="irrigationDistrictsChart"></canvas>
            </div>
            <div id="irrigationDistrictsStatus" class="pib-chart-status" hidden></div>
        `;
        anchor.insertAdjacentElement("afterend", panel);
        return panel;
    }

    function hideIrrigationPanel() {
        const panel = document.getElementById("irrigationDistrictsPanel");
        if (panel) panel.hidden = true;
        if (irrigationChart) {
            irrigationChart.destroy();
            irrigationChart = null;
        }
    }

    function destroyIrrigationPanel() {
        hideIrrigationPanel();
        const panel = document.getElementById("irrigationDistrictsPanel");
        if (panel) panel.remove();
    }

    function setIrrigationStatus(message = "") {
        const status = document.getElementById("irrigationDistrictsStatus");
        if (!status) return;
        status.textContent = message;
        status.hidden = !message;
    }

    async function queryIrrigationRows(chartConfig, irrigationConfig) {
        const fields = [
            chartConfig.filterField || "mpcodigo",
            ...(chartConfig.titleFields || []),
            ...(irrigationConfig.fields || [])
        ];
        await validateFields(chartConfig, fields);
        const nameField = irrigationConfig.yAxis?.field || "nombredistrito";
        const scaleField = irrigationConfig.series?.field || "escaladistrito";
        const valueField = irrigationConfig.xAxis?.field || "nrofamilias";
        const where = [
            `(${getWhereBase?.() || "1=1"})`,
            `${nameField} <> 'No Aplica'`,
            `${scaleField} <> 'No Aplica'`,
            `${nameField} IS NOT NULL`,
            `${scaleField} IS NOT NULL`,
            `${valueField} IS NOT NULL`
        ].join(" AND ");

        const params = new URLSearchParams({
            f: "json",
            where,
            outFields: [...new Set(fields)].join(","),
            returnGeometry: "false",
            returnDomainNames: "true",
            resultRecordCount: "2000"
        });
        const response = await fetch(`${chartConfig.serviceUrl}/query?${params.toString()}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const json = await response.json();
        if (json.error) throw new Error(json.error.message || "Error consultando distritos de riego");

        return (json.features || [])
            .map(feature => feature.attributes || {})
            .filter(attrs => {
                const value = Number(attrs[valueField]);
                return !isNoAplica(attrs[nameField]) && !isNoAplica(attrs[scaleField]) && Number.isFinite(value);
            })
            .map(attrs => ({
                label: normalizeText(attrs[nameField]),
                scale: normalizeText(attrs[scaleField]),
                value: Number(attrs[valueField]),
                attrs
            }));
    }

    function renderIrrigationChart(rows, chartConfig, irrigationConfig) {
        const panel = ensureIrrigationPanel();
        const canvas = document.getElementById("irrigationDistrictsChart");
        const title = document.getElementById("irrigationDistrictsTitle");
        if (!panel || !canvas) return;

        if (!rows.length) {
            hideIrrigationPanel();
            return;
        }

        const colors = irrigationConfig.colorPalette || ["#2563EB", "#16A34A", "#F59E0B"];
        const scales = [...new Set(rows.map(row => row.scale))];
        const colorByScale = new Map(scales.map((scale, index) => [scale, colors[index % colors.length]]));

        panel.hidden = false;
        setIrrigationStatus("");
        if (title) title.textContent = resolveTitle(irrigationConfig, rows[0]?.attrs || {});
        destroyCanvasChart(canvas);
        canvas.style.height = `${Math.max(300, rows.length * 34)}px`;
        canvas.style.minWidth = "0";

        irrigationChart = new Chart(canvas, {
            type: "bar",
            data: {
                labels: rows.map(row => row.label),
                datasets: [{
                    label: irrigationConfig.xAxis?.label || "Beneficiarios",
                    data: rows.map(row => row.value),
                    backgroundColor: rows.map(row => colorByScale.get(row.scale)),
                    borderColor: rows.map(row => colorByScale.get(row.scale)),
                    borderWidth: 1,
                    scales: rows.map(row => row.scale)
                }]
            },
            options: {
                indexAxis: "y",
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        beginAtZero: true,
                        title: { display: true, text: irrigationConfig.xAxis?.label || "Beneficiarios" }
                    },
                    y: {
                        title: { display: true, text: irrigationConfig.yAxis?.label || "Nombre del distrito de riego" },
                        ticks: {
                            autoSkip: false,
                            color: "#334155",
                            font: { size: 10 },
                            callback(value) {
                                const label = this.getLabelForValue?.(value) ?? value;
                                return truncateLabel(label, 26);
                            }
                        }
                    }
                },
                plugins: {
                    zoom: createIrrigationZoomOptions(rows.length),
                    legend: {
                        position: "bottom",
                        labels: {
                            generateLabels(chart) {
                                return scales.map((scale, index) => ({
                                    text: scale,
                                    fillStyle: colorByScale.get(scale),
                                    strokeStyle: colorByScale.get(scale),
                                    lineWidth: 1,
                                    hidden: false,
                                    datasetIndex: 0,
                                    index
                                }));
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            title(context) {
                                const row = rows[context?.[0]?.dataIndex];
                                return row?.label || "";
                            },
                            label(context) {
                                const scale = rows[context.dataIndex]?.scale || "";
                                return `${scale}: ${Math.trunc(context.raw)} beneficiarios`;
                            }
                        }
                    }
                }
            },
            plugins: [createValueLabelsPlugin()]
        });
        bindIrrigationPointerPan(irrigationChart);
    }

    async function renderParallelCharts(chartConfig) {
        const irrigationConfig = chartConfig.parallelCharts?.irrigationDistricts;
        if (!irrigationConfig) return;
        try {
            const rows = await queryIrrigationRows(chartConfig, irrigationConfig);
            renderIrrigationChart(rows, chartConfig, irrigationConfig);
        } catch (error) {
            const panel = ensureIrrigationPanel();
            if (panel) panel.hidden = false;
            if (irrigationChart) {
                irrigationChart.destroy();
                irrigationChart = null;
            }
            setIrrigationStatus(`No se pudo cargar distritos de riego: ${String(error?.message || error)}`);
        }
    }

    async function actualizarGrafica(layer, config) {
        const chartConfig = config?.chartConfig;
        const canvas = document.getElementById("chart");
        if (!canvas || !chartConfig?.serviceUrl) return true;
        canvas.dataset.chartLegendInteractive = "1";

        prepareVisibleChartCanvas(canvas, {
            disableHorizontalScroll: true,
            responsive: true,
            canvasHeight: 380
        });
        configureScrollableChartViewport(canvas, {
            contentHeight: 380,
            viewportHeight: 420,
            allowHorizontal: false
        });
        hideIrrigationPanel();

        const municipalityCode = String(getMunicipioActual?.() || selectedMunicipalityCode()).trim();
        const hasMunicipalityFilter = /\bmpcodigo\s*=/i.test(String(getWhereBase?.() || ""));
        const hasMunicipality = /^\d{5}$/.test(municipalityCode)
            && (getFiltroNivel?.() === "MUNI" || hasMunicipalityFilter);
        if (!hasMunicipality) {
            chartCore?.destroyChart?.();
            setChartTitle(chartConfig.title || config.title);
            setChartStatus(canvas, "Seleccione un municipio para ver la información.");
            return true;
        }

        try {
            setChartTitle(chartConfig.title || config.title);
            setChartStatus(canvas, "Cargando negocios verdes...");
            const features = await queryRows(chartConfig);
            const grouped = buildGroupedData(features, chartConfig);
            const attrs = features[0]?.attributes || {};

            if (!grouped.categories.length || !grouped.subsectors.length) {
                chartCore?.destroyChart?.();
                setChartStatus(canvas, "No hay registros válidos de negocios verdes para el filtro seleccionado.");
                await renderParallelCharts(chartConfig);
                const text = await queryText(chartConfig);
                updateTextPanel(text);
                window.setTimeout(() => updateTextPanel(text), 350);
                return true;
            }

            setChartStatus(canvas, "");
            setChartTitle(resolveTitle(chartConfig, attrs));
            renderChart(canvas, grouped, chartConfig, attrs);
            await renderParallelCharts(chartConfig);
            const text = await queryText(chartConfig);
            updateTextPanel(text);
            window.setTimeout(() => updateTextPanel(text), 350);
            return true;
        } catch (error) {
            chartCore?.destroyChart?.();
            setChartStatus(canvas, `No se pudo cargar negocios verdes: ${String(error?.message || error)}`);
            return true;
        }
    }

    return {
        actualizarGrafica,
        hideChart() {
            chartCore?.destroyChart?.();
            destroyIrrigationPanel();
        }
    };
}
