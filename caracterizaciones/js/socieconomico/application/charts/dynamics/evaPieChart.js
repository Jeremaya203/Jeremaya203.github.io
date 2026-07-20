import { renderPieChart } from "../renderers/pieChartRenderer.js";
import { toNum } from "../../utils/shared.js";
import { buildAdaptiveFont, createZoomOptions, ensureZoomKeepsVisibleData, formatChartLabel } from "../core/chartOptions.js?v=global-safe-zoom-labels-20260604";
import { configureScrollableChartViewport, prepareVisibleChartCanvas, setChartTitle } from "../ui/chartPanel.js?v=local-chart-title-20260529";
import { setChartStatus } from "../ui/chartStatus.js";
import { destroyCanvasChart } from "../core/chartLifecycle.js";

const MUNICIPAL_CATEGORY_LABELS = {
    "1": "Departamento",
    "2": "Municipio",
    "3": "Distrito"
};
const YIELD_CHART_FIXED_HEIGHT = 345;
function truncateLabel(value, maxLength = 26) {
    const text = String(value ?? "").replace(/\s+/g, " ").trim();
    if (!text || text.length <= maxLength) return text;
    return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
}

function createEvaZoomOptions(mode = "xy") {
    const base = createZoomOptions();
    return {
        ...base,
        pan: {
            ...(base.pan || {}),
            enabled: true,
            mode
        },
        zoom: {
            ...(base.zoom || {}),
            mode
        },
        limits: {
            x: { min: "original", max: "original" },
            y: { min: "original", max: "original" }
        }
    };
}

function createCategoryZoomLimits(rowCount, xLimit = null) {
    const maxIndex = Math.max(0, Number(rowCount) - 1);
    const limits = {
        y: {
            min: 0,
            max: maxIndex
        }
    };
    if (Number.isFinite(Number(xLimit)) && Number(xLimit) > 0) {
        limits.x = {
            min: 0,
            max: Number(xLimit)
        };
    }
    return limits;
}

function createEvaAreaZoomOptions(rowCount = 0, {
    xLimit = null,
    onZoom,
    onZoomComplete,
    useNativePan = true
} = {}) {
    const base = createZoomOptions({
        pan: {
            enabled: true,
            mode: "y",
            modifierKey: null,
            threshold: 4
        },
        zoom: {
            mode: "y",
            drag: {
                enabled: true,
                modifierKey: "ctrl"
            }
        }
    });
        return {
        ...base,
        pan: {
            ...(base.pan || {}),
            enabled: useNativePan,
            mode: "xy"
        },
        zoom: {
            ...(base.zoom || {}),
            mode: "xy",
            onZoom(context) {
                ensureZoomKeepsVisibleData(context);
                onZoom?.(context);
            },
            onZoomComplete(context) {
                ensureZoomKeepsVisibleData(context);
                onZoomComplete?.(context);
            }
        },
        limits: createCategoryZoomLimits(rowCount, xLimit)
    };
}

function createEvaYieldZoomOptions(rowCount = 0, {
    onZoomComplete
} = {}) {
    const base = createZoomOptions({
        pan: {
            enabled: true,
            mode: "y",
            modifierKey: null,
            threshold: 2
        },
        zoom: {
            mode: "y",
            wheel: { enabled: true },
            pinch: { enabled: true },
            drag: {
                enabled: true,
                modifierKey: "ctrl"
            }
        }
    });

    return {
        ...base,
        pan: {
            ...(base.pan || {}),
            enabled: true,
            mode: "y"
        },
        zoom: {
            ...(base.zoom || {}),
            mode: "y",
            onZoom: ensureZoomKeepsVisibleData,
            onZoomComplete(context) {
                ensureZoomKeepsVisibleData(context);
                onZoomComplete?.(context);
            }
        },
        limits: createCategoryZoomLimits(rowCount)
    };
}

function configureParallelChartViewport(canvas, {
    contentHeight = 345,
    viewportHeight = 560,
    allowVerticalScroll = false
} = {}) {
    const container = canvas?.parentElement;
    if (!container) return null;

    const visibleHeight = Math.min(contentHeight, viewportHeight);
    container.style.position = "relative";
    container.style.width = "100%";
    container.style.setProperty("min-height", `${visibleHeight}px`, "important");
    container.style.setProperty("height", `${visibleHeight}px`, "important");
    container.style.setProperty("max-height", "none", "important");
    container.style.overflowX = "hidden";
    container.style.overflowY = allowVerticalScroll && contentHeight > visibleHeight ? "auto" : "hidden";

    canvas.style.display = "block";
    canvas.style.setProperty("width", "100%", "important");
    canvas.style.setProperty("max-width", "100%", "important");
    canvas.style.setProperty("min-width", "0", "important");
    canvas.style.setProperty("height", `${contentHeight}px`, "important");
    canvas.style.setProperty("min-height", `${contentHeight}px`, "important");
    canvas.style.setProperty("max-height", "none", "important");
    canvas.width = Math.max(320, Math.floor(container.clientWidth || canvas.clientWidth || 360));
    canvas.height = Math.round(contentHeight);

    return container;
}

function visibleCategoryCount(scale, fallbackCount) {
    const min = Number.isFinite(Number(scale?.min)) ? Math.floor(Number(scale.min)) : 0;
    const max = Number.isFinite(Number(scale?.max)) ? Math.ceil(Number(scale.max)) : Math.max(0, fallbackCount - 1);
    return Math.max(1, Math.min(fallbackCount, max - min + 1));
}

function areaTickStep(scale, totalRows) {
    if (totalRows <= 12) return 1;
    const visibleRows = visibleCategoryCount(scale, totalRows);
    if (visibleRows <= 24) return 1;
    if (visibleRows <= 36) return 2;
    return Math.ceil(visibleRows / 18);
}

function getAreaRowLabelY(chart, rowIndex) {
    const yPixels = [];
    (chart.data?.datasets || []).forEach((_, datasetIndex) => {
        if (!chart.isDatasetVisible(datasetIndex)) return;
        const bar = chart.getDatasetMeta(datasetIndex)?.data?.[rowIndex];
        if (!bar || !Number.isFinite(bar.y)) return;
        yPixels.push(bar.y);
    });
    if (yPixels.length) {
        return yPixels.reduce((sum, y) => sum + y, 0) / yPixels.length;
    }
    const yScale = chart.scales?.y;
    return typeof yScale?.getPixelForValue === "function"
        ? yScale.getPixelForValue(rowIndex)
        : null;
}

export function createEvaPieChartController({
    getMunicipioActual,
    getDeptoActual,
    getFiltroNivel,
    refreshSummary
} = {}) {
    let pieChartInstance = null;
    let areaChartInstance = null;
    let yieldChartInstance = null;
    let metadataPromise = null;
    let currentConfig = null;

    function ensureYieldTitleNode() {
        let node = document.getElementById("evaYieldChartTitle");
        if (node) return node;

        node = document.createElement("h4");
        node.id = "evaYieldChartTitle";
        node.className = "pib-sector-title";
        node.hidden = true;
        return node;
    }

    function restoreDefaultEvaLayout() {
        const row = document.getElementById("attrCategoryChartRow");
        const piePanel = document.getElementById("pibSectorPiePanel");
        const chartDiv = document.getElementById("chartDiv");
        const chartCard = document.querySelector("#chartDiv .chart-card");
        const yieldTitle = document.getElementById("evaYieldChartTitle");
        row?.classList.remove("eva-yield-layout");
        chartDiv?.classList.remove("eva-layout-active");
        chartCard?.classList.remove("eva-layout-active");
        if (yieldTitle) {
            yieldTitle.hidden = true;
            yieldTitle.textContent = "";
            yieldTitle.remove();
        }
        if (row && piePanel?.parentNode === row.parentNode && row.nextElementSibling !== piePanel) {
            piePanel.parentNode.insertBefore(row, piePanel);
        }
    }

    function activateEvaLayout() {
        const row = document.getElementById("attrCategoryChartRow");
        const areaPanel = document.getElementById("pibEmpresasPanel");
        const chartDiv = document.getElementById("chartDiv");
        const chartCard = document.querySelector("#chartDiv .chart-card");
        if (!row || !areaPanel?.parentNode || row.parentNode !== areaPanel.parentNode) return;
        row.classList.add("eva-yield-layout");
        chartDiv?.classList.add("eva-layout-active");
        chartCard?.classList.add("eva-layout-active");

        const yieldTitle = ensureYieldTitleNode();
        if (yieldTitle.parentNode !== row) {
            row.insertBefore(yieldTitle, row.firstChild);
        }
        if (areaPanel.nextElementSibling !== row) {
            areaPanel.insertAdjacentElement("afterend", row);
        }
    }

    function getElements() {
        return {
            piePanel: document.getElementById("pibSectorPiePanel"),
            pieTitle: document.getElementById("pibSectorPieTitle"),
            pieCanvas: document.getElementById("pibSectorPieChart"),
            pieStatus: document.getElementById("pibSectorPieStatus"),
            areaPanel: document.getElementById("pibEmpresasPanel"),
            areaTitle: document.getElementById("pibEmpresasTitle"),
            areaCanvas: document.getElementById("pibEmpresasChart"),
            areaStatus: document.getElementById("pibEmpresasStatus"),
            areaText: document.getElementById("pibEmpresasText"),
            yieldCanvas: document.getElementById("chart")
        };
    }

    function destroyCharts() {
        const { pieCanvas, areaCanvas, yieldCanvas } = getElements();
        destroyCanvasChart(pieCanvas);
        destroyCanvasChart(areaCanvas);
        destroyCanvasChart(yieldCanvas);
        pieChartInstance = null;
        areaChartInstance = null;
        yieldChartInstance = null;
    }

    function hideChart() {
        destroyCharts();
        restoreDefaultEvaLayout();
        const {
            piePanel,
            pieTitle,
            pieStatus,
            areaPanel,
            areaTitle,
            areaStatus,
            areaText
        } = getElements();

        if (piePanel) {
            piePanel.hidden = true;
            piePanel.classList.remove("eva-parallel-panel");
        }
        if (pieTitle) pieTitle.textContent = "";
        if (pieStatus) {
            pieStatus.hidden = true;
            pieStatus.textContent = "";
            pieStatus.style.color = "";
        }

        if (areaPanel) {
            areaPanel.hidden = true;
            areaPanel.classList.remove("eva-parallel-panel");
        }
        if (areaTitle) areaTitle.textContent = "";
        if (areaStatus) {
            areaStatus.hidden = true;
            areaStatus.textContent = "";
            areaStatus.style.color = "";
        }
        if (areaText) {
            areaText.hidden = true;
            areaText.textContent = "";
        }
        const yieldTitle = document.getElementById("evaYieldChartTitle");
        if (yieldTitle) {
            yieldTitle.hidden = true;
            yieldTitle.textContent = "";
        }
        const { yieldCanvas } = getElements();
        if (yieldCanvas) setChartStatus(yieldCanvas, "");
        setChartTitle("");
    }

    function showPieStatus(message, isError = false) {
        const { piePanel, pieStatus } = getElements();
        if (piePanel) piePanel.hidden = false;
        if (!pieStatus) return;
        pieStatus.hidden = !message;
        pieStatus.textContent = message || "";
        pieStatus.style.color = "";
    }

    function showAreaStatus(message, isError = false) {
        const { areaPanel, areaStatus } = getElements();
        if (areaPanel) areaPanel.hidden = false;
        if (!areaStatus) return;
        areaStatus.hidden = !message;
        areaStatus.textContent = message || "";
        areaStatus.style.color = "";
    }

    async function getLayerMetadata() {
        if (!metadataPromise && currentConfig?.serviceUrl) {
            metadataPromise = fetch(`${currentConfig.serviceUrl}?f=json`)
                .then(response => {
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    return response.json();
                });
        }
        return metadataPromise;
    }

    async function validateRequiredFields() {
        const metadata = await getLayerMetadata();
        const available = new Set((metadata?.fields || []).map(field => String(field.name || "").toLowerCase()));
        const required = [
            ...(currentConfig?.fields || []).map(field => field?.field).filter(Boolean),
            "mpcodigo",
            "mpnombre",
            "dpnombre",
            "dpcodigo"
        ];
        const missing = [...new Set(required)].filter(field => !available.has(String(field).toLowerCase()));
        if (missing.length) {
            throw new Error(`Campos no disponibles en SE_EVA: ${missing.join(", ")}`);
        }
    }

    function domainLabel(fieldInfo, value) {
        const codedValues = fieldInfo?.domain?.codedValues || [];
        const hit = codedValues.find(item => String(item.code) === String(value));
        return String(hit?.name ?? value ?? "").trim();
    }

    function selectOptionLabel(selectId, value) {
        if (!value) return "";
        const option = document.querySelector(`#${selectId} option[value="${CSS.escape(String(value))}"]`);
        return option?.textContent?.trim() || "";
    }

    function resolvePlace(attrs = {}, metadataFields = []) {
        const fieldInfo = name => metadataFields.find(field => String(field.name).toLowerCase() === String(name).toLowerCase());
        const municipalityCode = String(attrs.mpcodigo || "").trim();
        const categoryValue = String(attrs.mpcategor || "").trim();
        let category = MUNICIPAL_CATEGORY_LABELS[categoryValue] || domainLabel(fieldInfo("mpcategor"), categoryValue) || "Municipio";
        if (/^\d{5}$/.test(municipalityCode) && categoryValue !== "3") category = "Municipio";
        if (/^\d{2}$/.test(municipalityCode)) category = "Departamento";

        const municipality = /^\d{5}$/.test(String(attrs.mpnombre || "").trim()) || !attrs.mpnombre
            ? (selectOptionLabel("municipios", attrs.mpcodigo) || String(attrs.mpnombre || attrs.mpcodigo || "").trim())
            : String(attrs.mpnombre).trim();

        const departmentCode = String(attrs.dpcodigo || attrs.mpcodigo || "").slice(0, 2);
        const department = /^\d{2}$/.test(String(attrs.dpnombre || "").trim()) || !attrs.dpnombre
            ? (selectOptionLabel("departamentos", departmentCode) || String(attrs.dpnombre || departmentCode || "").trim())
            : String(attrs.dpnombre).trim();

        return {
            mpcategor: category,
            mpnombre: municipality,
            dpnombre: department
        };
    }

    async function buildTitle(template, attrs = {}) {
        const metadata = await getLayerMetadata().catch(() => null);
        const place = resolvePlace(attrs, metadata?.fields || []);
        return String(template || "")
            .replace(/\{(\w+)\}/g, (_, key) => place[key] || attrs[key] || "");
    }

    async function queryFeatures(municipioCodigo) {
        if (!currentConfig?.serviceUrl) {
            throw new Error("Configuración del servicio no disponible");
        }

        await validateRequiredFields();

        const outFields = [
            ...(currentConfig.fields || []).map(field => field.field).filter(Boolean),
            "mpcodigo",
            "mpnombre",
            "dpnombre",
            "dpcodigo"
        ];

        const params = new URLSearchParams({
            f: "json",
            where: `${currentConfig.filterField || "mpcodigo"} = '${String(municipioCodigo).replace(/'/g, "''")}'`,
            outFields: [...new Set(outFields)].join(","),
            returnGeometry: "false",
            returnDomainNames: "true",
            resultRecordCount: "2000"
        });

        const response = await fetch(`${currentConfig.serviceUrl}/query?${params.toString()}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const json = await response.json();
        if (json.error) throw new Error(json.error.message || "Failed to execute query.");
        return json.features || [];
    }

    function formatHaNumber(value) {
        const n = Number(value);
        return Number.isFinite(n) ? n.toLocaleString("es-CO", {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1
        }) : "0,0";
    }

    function formatHa(value) {
        return `${formatHaNumber(value)} Ha`;
    }

    function aggregateByCycle(features, categories = []) {
        const totals = Object.fromEntries(categories.map(category => [category.key, 0]));
        (features || []).forEach(feature => {
            const attrs = feature.attributes || {};
            categories.forEach(category => {
                if (!category.condition?.(attrs)) return;
                totals[category.key] += toNum(attrs.evaha) || 0;
            });
        });
        return totals;
    }

    function aggregateAreaByCrop(features = []) {
        const grouped = new Map();
        (features || []).forEach(feature => {
            const attrs = feature.attributes || {};
            const crop = String(attrs.evadescult || "").trim();
            const cycle = String(attrs.evaciccult || "").trim();
            const area = toNum(attrs.evaha);
            if (!crop || !Number.isFinite(area) || area <= 0) return;
            if (cycle !== "Transitorio" && cycle !== "Permanente") return;

            if (!grouped.has(crop)) {
                grouped.set(crop, { label: crop, transitorio: 0, permanente: 0 });
            }
            const row = grouped.get(crop);
            if (cycle === "Transitorio") row.transitorio += area;
            if (cycle === "Permanente") row.permanente += area;
        });

        return [...grouped.values()]
            .filter(row => row.transitorio > 0 || row.permanente > 0)
            .sort((a, b) => (b.transitorio + b.permanente) - (a.transitorio + a.permanente));
    }

    function aggregateYieldByCrop(features = []) {
        const grouped = new Map();
        (features || []).forEach(feature => {
            const attrs = feature.attributes || {};
            const crop = String(attrs.evadescult || "").trim();
            const cycle = String(attrs.evaciccult || "").trim();
            const area = toNum(attrs.evaha);
            const yieldValue = toNum(attrs.evatha);
            if (!crop || !Number.isFinite(area) || area <= 0 || !Number.isFinite(yieldValue) || yieldValue <= 0) return;
            if (cycle !== "Transitorio" && cycle !== "Permanente") return;

            if (!grouped.has(crop)) {
                grouped.set(crop, {
                    label: crop,
                    transitorioWeightedYield: 0,
                    transitorioArea: 0,
                    permanenteWeightedYield: 0,
                    permanenteArea: 0
                });
            }

            const row = grouped.get(crop);
            if (cycle === "Transitorio") {
                row.transitorioWeightedYield += yieldValue * area;
                row.transitorioArea += area;
            }
            if (cycle === "Permanente") {
                row.permanenteWeightedYield += yieldValue * area;
                row.permanenteArea += area;
            }
        });

        return [...grouped.values()]
            .map(row => ({
                label: row.label,
                transitorio: row.transitorioArea > 0 ? row.transitorioWeightedYield / row.transitorioArea : 0,
                permanente: row.permanenteArea > 0 ? row.permanenteWeightedYield / row.permanenteArea : 0
            }))
            .filter(row => (Number.isFinite(row.transitorio) && row.transitorio > 0) || (Number.isFinite(row.permanente) && row.permanente > 0))
            .sort((a, b) => (b.transitorio + b.permanente) - (a.transitorio + a.permanente));
    }

    function createAreaYAxisLabelsPlugin() {
        return {
            id: "eva-area-y-axis-labels",
            afterDatasetsDraw(chart) {
                const yScale = chart.scales?.y;
                const labels = chart.data?.labels || [];
                const chartArea = chart.chartArea;
                if (!yScale || !labels.length || !chartArea) return;

                const tickOptions = chart.options?.scales?.y?.ticks || {};
                const fontSize = tickOptions.font?.size || 9;
                const fontWeight = tickOptions.font?.weight || "600";
                const padding = tickOptions.padding ?? 6;
                const step = areaTickStep(yScale, labels.length);
                const { ctx } = chart;

                ctx.save();
                ctx.fillStyle = tickOptions.color || "#334155";
                ctx.font = `${fontWeight} ${fontSize}px Outfit, sans-serif`;
                ctx.textAlign = "right";
                ctx.textBaseline = "middle";

                const labelX = yScale.right - padding;
                labels.forEach((label, rowIndex) => {
                    if (step > 1 && rowIndex % step !== 0) return;
                    const centerY = getAreaRowLabelY(chart, rowIndex);
                    if (!Number.isFinite(centerY)) return;
                    if (centerY < chartArea.top - 4 || centerY > chartArea.bottom + 4) return;
                    const text = String(label ?? "").trim();
                    if (!text) return;
                    ctx.fillText(text, labelX, centerY);
                });
                ctx.restore();
            }
        };
    }

    function drawAreaBarValueLabel(ctx, chart, bar, label) {
        const chartArea = chart.chartArea || {};
        const gap = 4;
        const textWidth = ctx.measureText(label).width;
        const barEnd = Math.max(bar.base ?? 0, bar.x ?? 0);

        ctx.fillStyle = "#333333";
        ctx.textAlign = "left";
        let labelX = barEnd + gap;
        const maxX = Number.isFinite(chartArea.right)
            ? chartArea.right - textWidth - 2
            : labelX;
        labelX = Math.min(labelX, maxX);
        ctx.fillText(label, labelX, bar.y);
    }

    function createAreaValueLabelsPlugin() {
        return {
            id: "eva-area-value-labels",
            afterDatasetsDraw(chart) {
                const { ctx } = chart;
                const chartArea = chart.chartArea;
                if (!chartArea) return;

                const rowCount = Math.max(
                    ...(chart.data.datasets || []).map((_, datasetIndex) =>
                        chart.getDatasetMeta(datasetIndex)?.data?.length || 0
                    ),
                    0
                );
                const compact = rowCount > 12;
                const fontSize = compact ? 9 : 10;

                ctx.save();
                ctx.font = `500 ${fontSize}px Outfit, sans-serif`;
                ctx.textBaseline = "middle";

                (chart.data.datasets || []).forEach((dataset, datasetIndex) => {
                    if (!chart.isDatasetVisible(datasetIndex)) return;
                    const meta = chart.getDatasetMeta(datasetIndex);
                    (meta?.data || []).forEach((bar, index) => {
                        const value = Number(dataset.data[index]);
                        if (!Number.isFinite(value) || value <= 0) return;
                        if (!bar || !Number.isFinite(bar.y)) return;
                        if (bar.y < chartArea.top + 4 || bar.y > chartArea.bottom - 4) return;

                        drawAreaBarValueLabel(ctx, chart, bar, formatHaNumber(value));
                    });
                });
                ctx.restore();
            }
        };
    }

    function isScaleZoomed(scale, totalRows) {
        if (!scale || totalRows <= 0) return false;
        const min = Number(scale.min);
        const max = Number(scale.max);
        if (!Number.isFinite(min) || !Number.isFinite(max)) return false;
        return min > 0 || max < totalRows - 1;
    }

    function isValueScaleZoomed(scale, limit) {
        const min = Number(scale?.min);
        const max = Number(scale?.max);
        const maxLimit = Number(limit);
        if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(maxLimit) || maxLimit <= 0) return false;
        return min > 0 || max < maxLimit;
    }

    function normalizeFullYAxisView(chart) {
        const labels = chart?.data?.labels || [];
        const scale = chart?.scales?.y;
        if (!scale || labels.length <= 0) return false;

        const min = Number(scale.min);
        const max = Number(scale.max);
        const originalMin = 0;
        const originalMax = labels.length - 1;
        if (!Number.isFinite(min) || !Number.isFinite(max)) return false;
        if (min > originalMin + 0.01 || max < originalMax - 0.01) return false;

        if (chart.options?.scales?.y) {
            chart.options.scales.y.min = undefined;
            chart.options.scales.y.max = undefined;
        }
        if (scale.options) {
            scale.options.min = undefined;
            scale.options.max = undefined;
        }
        return true;
    }

    function normalizeFullXAxisView(chart) {
        const scale = chart?.scales?.x;
        const maxLimit = Number(chart?.options?.plugins?.zoom?.limits?.x?.max);
        if (!scale || !Number.isFinite(maxLimit) || maxLimit <= 0) return false;

        const min = Number(scale.min);
        const max = Number(scale.max);
        if (!Number.isFinite(min) || !Number.isFinite(max)) return false;
        if (min > 0.01 || max < maxLimit - 0.01) return false;

        if (chart.options?.scales?.x) {
            chart.options.scales.x.min = undefined;
            chart.options.scales.x.max = undefined;
        }
        if (scale.options) {
            scale.options.min = undefined;
            scale.options.max = undefined;
        }
        return true;
    }

    function normalizeFullChartView(chart) {
        const normalizedY = normalizeFullYAxisView(chart);
        const normalizedX = normalizeFullXAxisView(chart);
        return normalizedY || normalizedX;
    }

    function getVisibleAreaRowIndexes(chart) {
        const labels = chart?.data?.labels || [];
        const datasets = chart?.data?.datasets || [];
        return labels
            .map((_, index) => index)
            .filter(index => datasets.some((dataset, datasetIndex) => {
                if (!chart.isDatasetVisible(datasetIndex)) return false;
                const value = Number(dataset?.data?.[index]);
                return Number.isFinite(value) && value > 0;
            }));
    }

    function getAreaMaxValueForRows(chart, rowIndexes = []) {
        const datasets = chart?.data?.datasets || [];
        return rowIndexes.reduce((max, rowIndex) => {
            const rowMax = datasets.reduce((datasetMax, dataset, datasetIndex) => {
                if (!chart.isDatasetVisible(datasetIndex)) return datasetMax;
                const value = Number(dataset?.data?.[rowIndex]);
                return Number.isFinite(value) ? Math.max(datasetMax, value) : datasetMax;
            }, 0);
            return Math.max(max, rowMax);
        }, 0);
    }

    function keepAreaZoomOnData(chart) {
        const xScale = chart?.scales?.x;
        const yScale = chart?.scales?.y;
        const labels = chart?.data?.labels || [];
        const visibleRows = getVisibleAreaRowIndexes(chart);
        if (!xScale || !yScale || !labels.length || !visibleRows.length) return false;

        let changed = false;
        const yMin = Number(yScale.min);
        const yMax = Number(yScale.max);
        if (Number.isFinite(yMin) && Number.isFinite(yMax)) {
            const rowsInView = visibleRows.filter(index => index >= yMin && index <= yMax);
            if (!rowsInView.length) {
                const span = Math.max(0.5, Math.min(labels.length - 1, yMax - yMin));
                const center = (yMin + yMax) / 2;
                const nearestRow = visibleRows.reduce((nearest, index) => (
                    Math.abs(index - center) < Math.abs(nearest - center) ? index : nearest
                ), visibleRows[0]);
                const nextMin = Math.min(
                    Math.max(0, labels.length - 1 - span),
                    Math.max(0, nearestRow - span / 2)
                );
                chart.options.scales.y.min = nextMin;
                chart.options.scales.y.max = nextMin + span;
                changed = true;
            }
        }

        const nextYMin = Number(chart.options?.scales?.y?.min ?? yScale.min);
        const nextYMax = Number(chart.options?.scales?.y?.max ?? yScale.max);
        const rowsInCurrentView = visibleRows.filter(index => {
            if (!Number.isFinite(nextYMin) || !Number.isFinite(nextYMax)) return true;
            return index >= nextYMin && index <= nextYMax;
        });
        const rowScope = rowsInCurrentView.length ? rowsInCurrentView : visibleRows;
        const maxVisibleValue = getAreaMaxValueForRows(chart, rowScope);
        const xMin = Number(xScale.min);
        const xMax = Number(xScale.max);
        const xLimit = Number(chart?.options?.plugins?.zoom?.limits?.x?.max);
        if (Number.isFinite(xMin) && Number.isFinite(xMax) && maxVisibleValue > 0) {
            const span = Math.max(0.0001, xMax - xMin);
            const maxStart = Number.isFinite(xLimit) && xLimit > 0
                ? Math.max(0, xLimit - span)
                : Math.max(0, maxVisibleValue - span);
            if (xMax <= 0 || xMin > maxVisibleValue) {
                const nextMin = Math.min(maxStart, Math.max(0, maxVisibleValue - span * 0.75));
                chart.options.scales.x.min = nextMin;
                chart.options.scales.x.max = nextMin + span;
                changed = true;
            }
        }

        return changed;
    }

    function createVerticalPanPlugin(pluginId) {
        const state = new WeakMap();
        return {
            id: pluginId,
            beforeEvent(chart, args) {
                const event = args?.event;
                const type = event?.type;
                const area = chart.chartArea;
                const scale = chart.scales?.y;
                const labels = chart.data?.labels || [];
                if (!event || !area || !scale || !labels.length) return;

                const withinChart = event.x >= area.left
                    && event.x <= area.right
                    && event.y >= area.top
                    && event.y <= area.bottom;

                if (type === "mousedown" && withinChart && isScaleZoomed(scale, labels.length)) {
                    state.set(chart, {
                        startY: event.y,
                        min: Number(scale.min),
                        max: Number(scale.max)
                    });
                    if (chart.canvas) chart.canvas.style.cursor = "grabbing";
                    args.changed = true;
                    return;
                }

                if (type === "mouseup" || type === "mouseout") {
                    if (state.has(chart)) {
                        state.delete(chart);
                        if (chart.canvas) chart.canvas.style.cursor = isScaleZoomed(scale, labels.length) ? "grab" : "";
                        args.changed = true;
                    }
                    return;
                }

                const panState = state.get(chart);
                if (type !== "mousemove" || !panState) {
                    if (chart.canvas && type === "mousemove") {
                        chart.canvas.style.cursor = withinChart && isScaleZoomed(scale, labels.length) ? "grab" : "";
                    }
                    return;
                }

                const visibleSpan = Math.max(1, panState.max - panState.min);
                const pixelsPerRow = Math.max(1, (area.bottom - area.top) / visibleSpan);
                const deltaRows = (event.y - panState.startY) / pixelsPerRow;
                const maxStart = Math.max(0, labels.length - 1 - visibleSpan);
                const nextMin = Math.min(maxStart, Math.max(0, panState.min - deltaRows));
                const nextMax = nextMin + visibleSpan;

                scale.options.min = nextMin;
                scale.options.max = nextMax;
                normalizeFullYAxisView(chart);
                chart.update("none");
                args.changed = true;
            }
        };
    }

    function createAreaVerticalPanPlugin() {
        return createVerticalPanPlugin("eva-area-vertical-pan");
    }

    function createYieldVerticalPanPlugin() {
        return createVerticalPanPlugin("eva-yield-vertical-pan");
    }

    function bindCategoryPointerPan(chart, {
        handlersKey = "$evaCategoryPointerPanHandlers",
        axes = "y",
        implicitVerticalPan = false,
        smoothPreview = false
    } = {}) {
        const canvas = chart?.canvas;
        if (!canvas) return;
        if (canvas[handlersKey]) {
            const handlers = canvas[handlersKey];
            canvas.removeEventListener("pointerdown", handlers.pointerdown);
            canvas.removeEventListener("pointermove", handlers.pointermove);
            canvas.removeEventListener("pointerup", handlers.stopPan);
            canvas.removeEventListener("pointercancel", handlers.stopPan);
            canvas.removeEventListener("pointerleave", handlers.stopPan);
        }

        let panState = null;

        function getPanContext(event) {
            const area = chart.chartArea;
            const yScale = chart.scales?.y;
            const xScale = chart.scales?.x;
            const labels = chart.data?.labels || [];
            const xLimit = chart.options?.plugins?.zoom?.limits?.x?.max;
            const canPanY = axes.includes("y") && isScaleZoomed(yScale, labels.length);
            const canPanX = axes.includes("x") && isValueScaleZoomed(xScale, xLimit);
            const canStartImplicitY = axes.includes("y")
                && implicitVerticalPan
                && labels.length > 3
                && isValueScaleZoomed(xScale, xLimit);
            if (!area || !labels.length || (!canPanY && !canPanX && !canStartImplicitY)) return null;

            const rect = canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            const withinChart = x >= area.left && x <= area.right && y >= area.top && y <= area.bottom;
            if (!withinChart) return null;

            return { area, labels, x, y, xLimit, xScale, yScale, canPanX, canPanY, canStartImplicitY };
        }

        const pointerdown = event => {
            if (event.button !== 0) return;
            const context = getPanContext(event);
            if (!context) return;

            panState = {
                pointerId: event.pointerId,
                startX: context.x,
                startY: context.y,
                xMin: Number(context.xScale?.min),
                xMax: Number(context.xScale?.max),
                yMin: context.canPanY ? Number(context.yScale?.min) : 0,
                yMax: context.canPanY
                    ? Number(context.yScale?.max)
                    : Math.min(context.labels.length - 1, Math.max(2, Math.ceil(context.labels.length * 0.55))),
                xLimit: Number(context.xLimit),
                canPanX: context.canPanX,
                canPanY: context.canPanY,
                canStartImplicitY: context.canStartImplicitY,
                area: context.area,
                labels: context.labels,
                nextXMin: Number(context.xScale?.min),
                nextXMax: Number(context.xScale?.max),
                nextYMin: context.canPanY ? Number(context.yScale?.min) : 0,
                nextYMax: context.canPanY
                    ? Number(context.yScale?.max)
                    : Math.min(context.labels.length - 1, Math.max(2, Math.ceil(context.labels.length * 0.55)))
            };
            canvas.style.cursor = "grabbing";
            if (smoothPreview) {
                canvas.style.willChange = "transform";
                canvas.style.transition = "none";
            }
            canvas.setPointerCapture?.(event.pointerId);
            event.preventDefault();
        };

        const pointermove = event => {
            if (!panState) {
                const context = getPanContext(event);
                canvas.style.cursor = context ? "grab" : "";
                return;
            }

            const rect = canvas.getBoundingClientRect();
            const currentX = event.clientX - rect.left;
            const currentY = event.clientY - rect.top;
            const deltaX = currentX - panState.startX;
            const deltaY = currentY - panState.startY;

            if (!panState.canPanY
                && panState.canStartImplicitY
                && Math.abs(deltaY) > 6
                && Math.abs(deltaY) >= Math.abs(deltaX) * 0.7) {
                panState.canPanY = true;
            }

            if (panState.canPanX) {
                const visibleSpanX = Math.max(0.0001, panState.xMax - panState.xMin);
                const pixelsPerUnit = Math.max(1, (panState.area.right - panState.area.left) / visibleSpanX);
                const deltaUnits = deltaX / pixelsPerUnit;
                const maxXStart = Math.max(0, panState.xLimit - visibleSpanX);
                panState.nextXMin = Math.min(maxXStart, Math.max(0, panState.xMin - deltaUnits));
                panState.nextXMax = panState.nextXMin + visibleSpanX;
            }

            if (panState.canPanY) {
                const visibleSpanY = Math.max(1, panState.yMax - panState.yMin);
                const pixelsPerRow = Math.max(1, (panState.area.bottom - panState.area.top) / visibleSpanY);
                const deltaRows = deltaY / pixelsPerRow;
                const maxYStart = Math.max(0, panState.labels.length - 1 - visibleSpanY);
                panState.nextYMin = Math.min(maxYStart, Math.max(0, panState.yMin - deltaRows));
                panState.nextYMax = panState.nextYMin + visibleSpanY;
            }

            if (smoothPreview) {
                const visibleSpanY = Math.max(1, panState.yMax - panState.yMin);
                const pixelsPerRow = Math.max(1, (panState.area.bottom - panState.area.top) / visibleSpanY);
                const previewRows = panState.yMin - panState.nextYMin;
                canvas.style.transform = `translateY(${previewRows * pixelsPerRow}px)`;
                event.preventDefault();
                return;
            }

            if (panState.canPanX) {
                chart.options.scales.x.min = panState.nextXMin;
                chart.options.scales.x.max = panState.nextXMax;
            }
            if (panState.canPanY) {
                chart.options.scales.y.min = panState.nextYMin;
                chart.options.scales.y.max = panState.nextYMax;
            }
            normalizeFullChartView(chart);
            chart.update("none");
            event.preventDefault();
        };

        function stopPan(event) {
            if (!panState) return;
            if (smoothPreview) {
                if (panState.canPanX) {
                    chart.options.scales.x.min = panState.nextXMin;
                    chart.options.scales.x.max = panState.nextXMax;
                }
                if (panState.canPanY) {
                    chart.options.scales.y.min = panState.nextYMin;
                    chart.options.scales.y.max = panState.nextYMax;
                }
                canvas.style.transform = "";
                canvas.style.willChange = "";
                normalizeFullChartView(chart);
                chart.update("none");
            }
            panState = null;
            canvas.style.cursor = "grab";
            canvas.releasePointerCapture?.(event.pointerId);
        }

        canvas[handlersKey] = { pointerdown, pointermove, stopPan };
        canvas.addEventListener("pointerdown", pointerdown);
        canvas.addEventListener("pointermove", pointermove);
        canvas.addEventListener("pointerup", stopPan);
        canvas.addEventListener("pointercancel", stopPan);
        canvas.addEventListener("pointerleave", stopPan);
    }

    function createYieldValueLabelsPlugin() {
        return {
            id: "eva-yield-value-labels",
            afterDatasetsDraw(chart) {
                const { ctx } = chart;
                const chartArea = chart.chartArea;
                const maxBars = (chart.data.datasets || []).reduce((max, _, datasetIndex) => {
                    const datasetMeta = chart.getDatasetMeta(datasetIndex);
                    return Math.max(max, (datasetMeta?.data || []).length);
                }, 0);
                const labelStep = maxBars > 30 ? 4 : (maxBars > 14 ? 2 : 1);
                ctx.save();
                ctx.beginPath();
                ctx.rect(
                    chartArea.left,
                    chartArea.top,
                    chartArea.right - chartArea.left,
                    chartArea.bottom - chartArea.top
                );
                ctx.clip();
                ctx.font = `600 ${maxBars > 30 ? 8 : 10}px Outfit, sans-serif`;
                ctx.fillStyle = "#334155";
                ctx.textBaseline = "middle";
                chart.data.datasets.forEach((dataset, datasetIndex) => {
                    if (!chart.isDatasetVisible(datasetIndex)) return;
                    const meta = chart.getDatasetMeta(datasetIndex);
                    (meta?.data || []).forEach((bar, index) => {
                        if (labelStep > 1 && index % labelStep !== 0) return;
                        const value = Math.abs(Number(dataset?.data?.[index]));
                        if (!Number.isFinite(value) || value <= 0) return;
                        const label = `${value.toLocaleString("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} t/ha`;
                        if (bar.y < chartArea.top + 6 || bar.y > chartArea.bottom - 6) return;
                        const y = bar.y;
                        const isNegative = Number(dataset?.data?.[index]) < 0;
                        ctx.textAlign = isNegative ? "right" : "left";
                        ctx.fillText(
                            label,
                            isNegative
                                ? Math.max(chartArea.left + 56, bar.x - 8)
                                : Math.min(chartArea.right - 56, bar.x + 8),
                            y
                        );
                    });
                });
                ctx.restore();
            }
        };
    }

    async function renderPieChartPanel(features = [], attrs = {}) {
        const { piePanel, pieTitle, pieCanvas } = getElements();
        if (!piePanel || !pieCanvas) return;

        const categories = currentConfig.categories || [];
        const totals = aggregateByCycle(features, categories);
        const hasData = Object.values(totals).some(value => value > 0);

        if (!hasData) {
            pieChartInstance?.destroy?.();
            pieChartInstance = null;
            if (pieTitle) {
                pieTitle.textContent = await buildTitle(
                    "Distribución de ciclo productivo en el {mpcategor} de {mpnombre}, {dpnombre}",
                    attrs
                );
            }
            showPieStatus("El censo agricola no tiene valores de area sembrada para el filtro seleccionado.", true);
            return;
        }

        piePanel.hidden = false;
        piePanel.classList.add("eva-parallel-panel");
        if (pieTitle) {
            pieTitle.textContent = await buildTitle(
                "Distribución de ciclo productivo en el {mpcategor} de {mpnombre}, {dpnombre}",
                attrs
            );
        }
        showPieStatus("");

        pieChartInstance?.destroy?.();
        pieCanvas.style.display = "block";
        pieCanvas.style.width = "100%";
        pieCanvas.style.height = "330px";

        pieChartInstance = renderPieChart({
            canvas: pieCanvas,
            labels: categories.map(category => category.label),
            values: categories.map(category => totals[category.key] || 0),
            colors: categories.map(category => category.color || "#94a3b8"),
            formatValue: formatHa,
            title: pieTitle?.textContent || currentConfig.title
        });
        if (pieChartInstance) {
            pieChartInstance.options.plugins.zoom = createEvaZoomOptions("xy");
            pieChartInstance.options.plugins.legend.labels.font = buildAdaptiveFont(categories.map(category => category.label), {
                baseSize: 11,
                minSize: 9
            });
            pieChartInstance.options.plugins.tooltip.callbacks = {
                title: () => "",
                label(context) {
                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                    const value = context.parsed;
                    const pct = total > 0 ? ((value / total) * 100) : 0;
                    return `${pct.toLocaleString("es-CO", {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1
                    })}%`;
                }
            };
            pieChartInstance.update("none");
        }
    }

    function getAreaChartLayout(rowCount) {
        const denseRows = rowCount > 14;
        const contentHeight = denseRows
            ? Math.min(600, Math.max(360, rowCount * 14 + 105))
            : Math.min(400, Math.max(300, rowCount * 22 + 95));
        const denseBarThickness = denseRows
            ? Math.max(3, Math.min(6, Math.floor((contentHeight - 105) / Math.max(rowCount * 2.4, 1))))
            : undefined;
        const barLayout = denseRows
            ? {
                barThickness: denseBarThickness,
                maxBarThickness: denseBarThickness,
                categoryPercentage: 0.82,
                barPercentage: 0.72
            }
            : {
                maxBarThickness: 18,
                categoryPercentage: 0.76,
                barPercentage: 0.76
            };
        return { denseRows, contentHeight, barLayout };
    }

    function applyAreaChartViewport(canvas, rowCount) {
        const { contentHeight } = getAreaChartLayout(rowCount);
        configureParallelChartViewport(canvas, {
            contentHeight,
            viewportHeight: contentHeight,
            allowVerticalScroll: false
        });
    }

    function getPositiveAxisLimit(values = []) {
        const maxValue = values.reduce((max, value) => {
            const numericValue = Number(value);
            return Number.isFinite(numericValue) ? Math.max(max, numericValue) : max;
        }, 0);
        return maxValue > 0 ? Math.ceil((maxValue * 1.15) * 10) / 10 : null;
    }

    function applyAreaVisibleRows(chart, canvas) {
        const original = chart?.$evaAreaOriginalState;
        if (!chart || !original) return;

        const activeDatasetIndexes = original.datasets
            .map((_, index) => index)
            .filter(index => chart.isDatasetVisible(index));

        const visibleIndexes = original.labels
            .map((_, index) => index)
            .filter(index => activeDatasetIndexes.some(datasetIndex => {
                const value = Number(original.datasets[datasetIndex]?.data?.[index]);
                return Number.isFinite(value) && value > 0;
            }));

        chart.$evaAreaVisibleLabels = visibleIndexes.map(index => original.labels[index]);
        chart.data.labels = chart.$evaAreaVisibleLabels;
        chart.data.datasets.forEach((dataset, datasetIndex) => {
            const originalDataset = original.datasets[datasetIndex] || {};
            dataset.data = visibleIndexes.map(index => originalDataset.data?.[index] ?? null);
            dataset.evaTooltip = visibleIndexes.map(index => originalDataset.evaTooltip?.[index] || {});
            Object.assign(dataset, getAreaChartLayout(visibleIndexes.length).barLayout);
        });

        applyAreaChartViewport(canvas, Math.max(visibleIndexes.length, 1));
        const labels = chart.$evaAreaVisibleLabels;
        const denseRows = labels.length > 14;
        if (chart.options?.scales?.y?.ticks) {
            chart.options.scales.y.ticks.maxTicksLimit = labels.length;
            chart.options.scales.y.ticks.font = {
                size: denseRows ? 8 : 9,
                weight: "600",
                family: "Outfit, sans-serif"
            };
        }
        if (chart.options?.plugins?.zoom) {
            const activeValues = activeDatasetIndexes.flatMap(datasetIndex => {
                const originalDataset = original.datasets[datasetIndex] || {};
                return visibleIndexes.map(index => originalDataset.data?.[index]);
            });
            chart.options.plugins.zoom.limits = createCategoryZoomLimits(labels.length, getPositiveAxisLimit(activeValues));
        }
    }

    function getYieldChartLayout(rowCount) {
        const denseRows = rowCount > 14;
        return { denseRows, contentHeight: YIELD_CHART_FIXED_HEIGHT };
    }

    function applyYieldChartViewport(canvas, rowCount) {
        const { contentHeight } = getYieldChartLayout(Math.max(rowCount, 1));
        configureScrollableChartViewport(canvas, {
            contentHeight,
            viewportHeight: contentHeight,
            allowHorizontal: false
        });
        lockYieldCanvasHeight(canvas, contentHeight);
        return contentHeight;
    }

    function applyStableYieldChartViewport(canvas, original, fallbackRowCount) {
        const rowCount = original?.rowCount || original?.labels?.length || fallbackRowCount || 1;
        const contentHeight = original?.contentHeight || getYieldChartLayout(Math.max(rowCount, 1)).contentHeight;
        configureScrollableChartViewport(canvas, {
            contentHeight,
            viewportHeight: contentHeight,
            allowHorizontal: false
        });
        lockYieldCanvasHeight(canvas, contentHeight);
        return contentHeight;
    }

    function lockYieldCanvasHeight(canvas, contentHeight) {
        if (!canvas || !Number.isFinite(Number(contentHeight))) return;
        const height = Math.round(Number(contentHeight));
        const container = canvas.parentElement;
        if (container) {
            container.style.setProperty("height", `${height}px`, "important");
            container.style.setProperty("min-height", `${height}px`, "important");
            container.style.setProperty("max-height", `${height}px`, "important");
            container.style.overflowY = "hidden";
        }
        canvas.style.setProperty("height", `${height}px`, "important");
        canvas.style.setProperty("min-height", `${height}px`, "important");
        canvas.style.setProperty("max-height", `${height}px`, "important");
        canvas.height = height;
    }

    function updateYieldXAxis(chart, visibleIndexes, activeDatasetIndexes) {
        const original = chart?.$evaYieldOriginalState;
        const values = activeDatasetIndexes.flatMap(datasetIndex => {
            const dataset = original?.datasets?.[datasetIndex];
            return (visibleIndexes || []).map(index => Number(dataset?.data?.[index]) || 0);
        });
        const positives = values.filter(value => value > 0);
        const negatives = values.filter(value => value < 0);
        const maxAbs = values.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
        const limit = maxAbs > 0 ? Math.ceil((maxAbs * 1.15) * 10) / 10 : undefined;
        const xScale = chart?.options?.scales?.x;
        if (!xScale) return;

        if (!Number.isFinite(limit)) {
            xScale.min = undefined;
            xScale.max = undefined;
            return;
        }
        if (positives.length && negatives.length) {
            xScale.min = -limit;
            xScale.max = limit;
            return;
        }
        if (positives.length) {
            xScale.min = 0;
            xScale.max = limit;
            return;
        }
        xScale.min = -limit;
        xScale.max = 0;
    }

    function applyYieldVisibleRows(chart, canvas) {
        const original = chart?.$evaYieldOriginalState;
        if (!chart || !original) return;

        const activeDatasetIndexes = original.datasets
            .map((_, index) => index)
            .filter(index => chart.isDatasetVisible(index));

        const visibleIndexes = original.labels
            .map((_, index) => index)
            .filter(index => activeDatasetIndexes.some(datasetIndex => {
                const value = Math.abs(Number(original.datasets[datasetIndex]?.data?.[index]) || 0);
                return Number.isFinite(value) && value > 0;
            }));

        chart.data.labels = visibleIndexes.map(index => original.labels[index]);
        chart.data.datasets.forEach((dataset, datasetIndex) => {
            const originalDataset = original.datasets[datasetIndex] || {};
            dataset.data = visibleIndexes.map(index => originalDataset.data?.[index] ?? 0);
        });

        applyStableYieldChartViewport(canvas, original, original.labels.length);
        updateYieldXAxis(chart, visibleIndexes, activeDatasetIndexes);

        const yScaleOptions = chart.options?.scales?.y;
        if (yScaleOptions) {
            yScaleOptions.min = undefined;
            yScaleOptions.max = undefined;
        }
        if (chart.scales?.y?.options) {
            chart.scales.y.options.min = undefined;
            chart.scales.y.options.max = undefined;
        }

        if (chart.options?.scales?.y?.ticks) {
            chart.options.scales.y.ticks.maxTicksLimit = chart.data.labels.length;
        }
        if (chart.options?.plugins?.zoom) {
            chart.options.plugins.zoom.limits = createCategoryZoomLimits(chart.data.labels.length);
        }
    }

    function toggleAreaDatasetVisibility(chart, datasetIndex, canvas) {
        if (!chart || !Number.isInteger(datasetIndex)) return;

        const visibleCount = chart.data.datasets
            .filter((_, index) => chart.isDatasetVisible(index))
            .length;
        if (chart.isDatasetVisible(datasetIndex) && visibleCount <= 1) return;

        chart.setDatasetVisibility(datasetIndex, !chart.isDatasetVisible(datasetIndex));
        applyAreaVisibleRows(chart, canvas);
        chart.update("none");
    }

    function toggleYieldDatasetVisibility(chart, datasetIndex, canvas) {
        if (!chart || !Number.isInteger(datasetIndex)) return;

        const visibleCount = chart.data.datasets
            .filter((_, index) => chart.isDatasetVisible(index))
            .length;
        if (chart.isDatasetVisible(datasetIndex) && visibleCount <= 1) return;

        chart.setDatasetVisibility(datasetIndex, !chart.isDatasetVisible(datasetIndex));
        applyYieldVisibleRows(chart, canvas);
        applyStableYieldChartViewport(canvas, chart.$evaYieldOriginalState, chart.data?.labels?.length);
        chart.update("none");
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

    function bindDatasetLegendClickFallback(chart, canvas, {
        handlersKey = "$evaDatasetLegendClickHandler",
        toggleDataset
    } = {}) {
        if (!chart || !canvas) return;
        if (canvas[handlersKey]) {
            const previousHandlers = canvas[handlersKey];
            if (typeof previousHandlers === "function") {
                canvas.removeEventListener("click", previousHandlers, true);
            } else {
                canvas.removeEventListener("pointerdown", previousHandlers.pointerdown, true);
                canvas.removeEventListener("click", previousHandlers.click, true);
            }
        }

        let suppressNextClick = false;

        const toggleFromLegendEvent = event => {
            const datasetIndex = getLegendDatasetIndex(chart, event);
            if (!Number.isInteger(datasetIndex)) return false;

            event.preventDefault();
            event.stopImmediatePropagation();
            toggleDataset?.(chart, datasetIndex, canvas);
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
            toggleDataset?.(chart, datasetIndex, canvas);
        };

        canvas[handlersKey] = { pointerdown, click };
        canvas.addEventListener("pointerdown", pointerdown, true);
        canvas.addEventListener("click", click, true);
    }

    async function renderAreaByCropPanel(features = [], attrs = {}) {
        const parallelConfig = currentConfig?.parallelCharts?.areaByCrop;
        const { areaPanel, areaTitle, areaCanvas, areaText } = getElements();
        if (!parallelConfig || !areaPanel || !areaCanvas) return;

        const rows = aggregateAreaByCrop(features);
        areaPanel.hidden = false;
        areaPanel.classList.add("eva-parallel-panel");
        areaCanvas.dataset.chartLegendInteractive = "1";
        if (areaText) {
            areaText.hidden = true;
            areaText.textContent = "";
        }

        if (!rows.length) {
            areaChartInstance?.destroy?.();
            areaChartInstance = null;
            if (areaTitle) {
                areaTitle.textContent = await buildTitle(parallelConfig.titleTemplate, attrs);
            }
            showAreaStatus(parallelConfig.emptyMessage || "No hay datos válidos para el gráfico.", true);
            return;
        }

        if (areaTitle) {
            areaTitle.textContent = await buildTitle(parallelConfig.titleTemplate, attrs);
        }
        showAreaStatus("");

        areaChartInstance?.destroy?.();
        areaCanvas.style.display = "block";
        areaCanvas.style.width = "100%";
        areaCanvas.style.touchAction = "none";
        const { denseRows, barLayout } = getAreaChartLayout(rows.length);
        applyAreaChartViewport(areaCanvas, rows.length);
        const areaXLimit = getPositiveAxisLimit(rows.flatMap(row => [row.transitorio, row.permanente]));
        const areaDatasets = [
            {
                label: parallelConfig.series.transitorio.label,
                data: rows.map(row => row.transitorio > 0 ? row.transitorio : null),
                evaTooltip: rows.map(row => ({
                    crop: row.label,
                    type: parallelConfig.series.transitorio.label,
                    area: row.transitorio
                })),
                backgroundColor: parallelConfig.series.transitorio.color,
                borderColor: parallelConfig.series.transitorio.borderColor,
                borderWidth: 1,
                ...barLayout,
                minBarLength: 4
            },
            {
                label: parallelConfig.series.permanente.label,
                data: rows.map(row => row.permanente > 0 ? row.permanente : null),
                evaTooltip: rows.map(row => ({
                    crop: row.label,
                    type: parallelConfig.series.permanente.label,
                    area: row.permanente
                })),
                backgroundColor: parallelConfig.series.permanente.color,
                borderColor: parallelConfig.series.permanente.borderColor,
                borderWidth: 1,
                ...barLayout,
                minBarLength: 4
            }
        ];
        destroyCanvasChart(areaCanvas);
        areaChartInstance = new Chart(areaCanvas, {
            type: "bar",
            data: {
                labels: rows.map(row => row.label),
                datasets: areaDatasets
            },
            options: {
                indexAxis: "y",
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                resizeDelay: 0,
                events: ["mousemove", "mouseout", "click", "mousedown", "mouseup", "wheel", "touchstart", "touchmove", "touchend"],
                interaction: { mode: "nearest", intersect: true },
                layout: {
                    padding: {
                        left: 6,
                        right: 18,
                        top: 12,
                        bottom: 6
                    }
                },
                plugins: {
                    legend: {
                        position: "bottom",
                        onClick(event, legendItem, legend) {
                            toggleAreaDatasetVisibility(legend.chart, legendItem.datasetIndex, areaCanvas);
                        },
                        labels: {
                            boxWidth: 12,
                            color: "#334155",
                            font: buildAdaptiveFont(rows.map(row => row.label), { baseSize: 11, minSize: 8 }),
                            generateLabels(chart) {
                                const base = Chart.defaults.plugins.legend.labels.generateLabels(chart);
                                return base.map(item => ({
                                    ...item,
                                    text: formatChartLabel(item.text, { maxLineLength: 16, maxLines: 2 })
                                }));
                            }
                        }
                    },
                    title: { display: false },
                    zoom: createEvaAreaZoomOptions(rows.length, {
                        xLimit: areaXLimit,
                        useNativePan: false,
                        onZoom({ chart }) {
                            keepAreaZoomOnData(chart);
                        },
                        onZoomComplete({ chart }) {
                            if (keepAreaZoomOnData(chart) || normalizeFullChartView(chart)) chart.update("none");
                        }
                    }),
                    tooltip: {
                        callbacks: {
                            title(items) {
                                const item = items?.[0];
                                const index = item?.dataIndex;
                                const meta = item?.dataset?.evaTooltip?.[index];
                                return `Cultivo: ${meta?.crop || item?.label || areaChartInstance?.data?.labels?.[index] || ""}`;
                            },
                            label(context) {
                                const meta = context.dataset?.evaTooltip?.[context.dataIndex] || {};
                                const type = meta.type || context.dataset?.label || "";
                                const value = Number(meta.area ?? context.parsed?.x ?? context.raw ?? 0);
                                return `Tipo: ${type} - Área sembrada: ${formatHa(Math.abs(value))}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: parallelConfig.xAxis?.label || "Área sembrada (ha)"
                        },
                        grid: { color: "rgba(31, 41, 55, 0.08)" },
                        ticks: {
                            color: "#334155",
                            font: { size: 10 },
                            maxTicksLimit: denseRows ? 6 : 8,
                            callback(value) {
                                return Math.abs(Number(value)).toLocaleString("es-CO", {
                                    minimumFractionDigits: 1,
                                    maximumFractionDigits: 1
                                });
                            }
                        }
                    },
                    y: {
                        title: {
                            display: false,
                            text: parallelConfig.yAxis?.label || "Cultivo"
                        },
                        grid: { display: false },
                        border: { display: false },
                        afterFit(axis) {
                            const labels = axis.chart?.data?.labels || [];
                            const fontSize = denseRows ? 8 : 9;
                            const maxChars = Math.max(
                                8,
                                ...labels.map(label => String(label ?? "").trim().length)
                            );
                            axis.width = Math.min(
                                220,
                                Math.max(96, Math.ceil(maxChars * fontSize * 0.52) + 12)
                            );
                        },
                        ticks: {
                            display: false,
                            autoSkip: false,
                            maxTicksLimit: rows.length,
                            color: "#334155",
                            padding: denseRows ? 7 : 6,
                            font: {
                                size: denseRows ? 8 : 9,
                                weight: "600",
                                family: "Outfit, sans-serif"
                            }
                        }
                    }
                }
            },
            plugins: [createAreaYAxisLabelsPlugin(), createAreaValueLabelsPlugin()]
        });
        areaChartInstance.$evaAreaOriginalState = {
            labels: rows.map(row => row.label),
            xLimit: areaXLimit,
            datasets: areaDatasets.map(dataset => ({
                data: [...dataset.data],
                evaTooltip: [...dataset.evaTooltip]
            }))
        };
        areaChartInstance.$evaAreaVisibleLabels = rows.map(row => row.label);
        bindDatasetLegendClickFallback(areaChartInstance, areaCanvas, {
            handlersKey: "$evaAreaLegendClickHandler",
            toggleDataset: toggleAreaDatasetVisibility
        });
        bindCategoryPointerPan(areaChartInstance, {
            handlersKey: "$evaAreaPointerPanHandlers",
            axes: "xy",
            implicitVerticalPan: true
        });
    }

    async function renderYieldByCropChart(features = [], attrs = {}) {
        const yieldConfig = currentConfig?.parallelCharts?.yieldByCrop;
        const { yieldCanvas } = getElements();
        if (!yieldConfig || !yieldCanvas) return;
        yieldCanvas.dataset.chartLegendInteractive = "1";
        activateEvaLayout();

        const rows = aggregateYieldByCrop(features);
        const yieldTitle = ensureYieldTitleNode();
        yieldTitle.hidden = false;
        yieldTitle.textContent = await buildTitle(yieldConfig.titleTemplate, attrs);
        const areaSeries = currentConfig?.parallelCharts?.areaByCrop?.series || {};
        const transitorioSeries = areaSeries.transitorio || {};
        const permanenteSeries = areaSeries.permanente || {};
        prepareVisibleChartCanvas(yieldCanvas, {
            disableHorizontalScroll: true,
            responsive: true,
            canvasHeight: 680
        });
        const { denseRows } = getYieldChartLayout(rows.length);
        const maxYield = rows.reduce((max, row) => Math.max(max, Math.abs(Number(row.transitorio) || 0), Math.abs(Number(row.permanente) || 0)), 0);
        const mirroredLimit = maxYield > 0 ? Math.ceil((maxYield * 1.15) * 10) / 10 : undefined;
        const stableContentHeight = applyYieldChartViewport(yieldCanvas, rows.length);
        setChartTitle("");

        if (!rows.length) {
            yieldChartInstance?.destroy?.();
            yieldChartInstance = null;
            setChartStatus(yieldCanvas, yieldConfig.emptyMessage || "No hay datos válidos para el gráfico.");
            return;
        }

        setChartStatus(yieldCanvas, "");
        destroyCanvasChart(yieldCanvas);
        const yieldDatasets = [{
            label: "Transitorio",
            data: rows.map(row => row.transitorio > 0 ? -row.transitorio : 0),
            backgroundColor: transitorioSeries.color || "#D97706",
            borderColor: transitorioSeries.borderColor || "#B45309",
            borderWidth: 1,
            borderRadius: 4,
            barPercentage: 0.72,
            categoryPercentage: 0.78
        }, {
            label: "Permanente",
            data: rows.map(row => row.permanente > 0 ? row.permanente : 0),
            backgroundColor: permanenteSeries.color || yieldConfig.series?.color || "#0F766E",
            borderColor: permanenteSeries.borderColor || yieldConfig.series?.borderColor || "#115E59",
            borderWidth: 1,
            borderRadius: 4,
            barPercentage: 0.72,
            categoryPercentage: 0.78
        }];
        yieldChartInstance = new Chart(yieldCanvas, {
            type: "bar",
            data: {
                labels: rows.map(row => row.label),
                datasets: yieldDatasets
            },
            options: {
                indexAxis: "y",
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                resizeDelay: 0,
                events: ["mousemove", "mouseout", "click", "mousedown", "mouseup", "wheel", "touchstart", "touchmove", "touchend"],
                interaction: { mode: "nearest", intersect: true },
                layout: {
                    padding: {
                        left: 4,
                        right: 18,
                        top: 10,
                        bottom: 10
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: "bottom",
                        onClick(event, legendItem, legend) {
                            toggleYieldDatasetVisibility(legend.chart, legendItem.datasetIndex, yieldCanvas);
                        },
                        labels: {
                            boxWidth: 12,
                            color: "#334155",
                            font: { size: 11, weight: "600" }
                        }
                    },
                    title: { display: false },
                    zoom: createEvaYieldZoomOptions(rows.length, {
                        onZoomComplete({ chart }) {
                            if (normalizeFullChartView(chart)) chart.update("none");
                        }
                    }),
                    tooltip: {
                        callbacks: {
                            title(items) {
                                const index = items?.[0]?.dataIndex;
                                return index == null ? "" : (yieldChartInstance?.data?.labels?.[index] || "");
                            },
                            label(context) {
                                return `${context.dataset?.label || yieldConfig.series?.label || "Rendimiento"}: ${Math.abs(Number(context.parsed.x || 0)).toLocaleString("es-CO", {
                                    minimumFractionDigits: 1,
                                    maximumFractionDigits: 1
                                })} t/ha`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: false,
                        min: Number.isFinite(mirroredLimit) ? -mirroredLimit : undefined,
                        max: Number.isFinite(mirroredLimit) ? mirroredLimit : undefined,
                        title: {
                            display: true,
                            text: yieldConfig.xAxis?.label || "Rendimiento (t/ha)"
                        },
                        grid: { color: "rgba(31, 41, 55, 0.08)" },
                        ticks: {
                            color: "#334155",
                            padding: 2,
                            font: { size: 9 },
                            maxTicksLimit: denseRows ? 6 : 8,
                            callback(value) {
                                return Math.abs(Number(value)).toLocaleString("es-CO", {
                                    minimumFractionDigits: 1,
                                    maximumFractionDigits: 1
                                });
                            }
                        }
                    },
                    y: {
                        title: {
                            display: false,
                            text: yieldConfig.yAxis?.label || "Cultivo"
                        },
                        afterFit(scale) {
                            scale.width = 12;
                        },
                        grid: { display: false },
                        ticks: {
                            display: false,
                            autoSkip: false,
                            maxTicksLimit: rows.length,
                            color: "#334155",
                            padding: 2,
                            font: buildAdaptiveFont(rows.map(row => row.label), { baseSize: denseRows ? 7 : 8, minSize: 6 }),
                            callback(value, index) {
                                return truncateLabel(rows[index]?.label || value, denseRows ? 12 : 18);
                            }
                        }
                    }
                }
            },
            plugins: [createYieldValueLabelsPlugin(), createYieldVerticalPanPlugin()]
        });
        yieldChartInstance.$evaYieldOriginalState = {
            labels: rows.map(row => row.label),
            rowCount: rows.length,
            contentHeight: stableContentHeight,
            datasets: yieldDatasets.map(dataset => ({
                data: [...dataset.data]
            }))
        };
        bindDatasetLegendClickFallback(yieldChartInstance, yieldCanvas, {
            handlersKey: "$evaYieldLegendClickHandler",
            toggleDataset: toggleYieldDatasetVisibility
        });
        bindCategoryPointerPan(yieldChartInstance, {
            handlersKey: "$evaYieldPointerPanHandlers"
        });
    }

    async function renderForCurrentFilter() {
        if (!currentConfig) {
            hideChart();
            return;
        }

        const municipioCodigo = getMunicipioActual?.();
        const { piePanel, pieTitle, areaPanel, areaTitle, yieldCanvas } = getElements();
        if (!piePanel || !areaPanel) return;
        activateEvaLayout();

        if (!municipioCodigo) {
            destroyCharts();
            if (pieTitle) pieTitle.textContent = currentConfig.title || "Distribución de ciclo productivo";
            if (areaTitle) areaTitle.textContent = "Área sembrada por tipo de cultivo";
            setChartTitle("");
            const yieldTitle = ensureYieldTitleNode();
            yieldTitle.hidden = false;
            yieldTitle.textContent = "Rendimiento por tipo de cultivo";
            piePanel.hidden = false;
            areaPanel.hidden = false;
            piePanel.classList.add("eva-parallel-panel");
            areaPanel.classList.add("eva-parallel-panel");
            if (yieldCanvas) {
                prepareVisibleChartCanvas(yieldCanvas, {
                    disableHorizontalScroll: true,
                    responsive: true,
                    canvasHeight: 420
                });
                setChartStatus(yieldCanvas, "Seleccione un municipio para ver la información.");
            }
            showPieStatus("Seleccione un municipio para ver la información.");
            showAreaStatus("Seleccione un municipio para ver la información.");
            return;
        }

        piePanel.hidden = false;
        areaPanel.hidden = false;
        piePanel.classList.add("eva-parallel-panel");
        areaPanel.classList.add("eva-parallel-panel");
        showPieStatus("Cargando censo agricola...");
        showAreaStatus("Cargando area sembrada por tipo de cultivo...");

        try {
            const features = await queryFeatures(municipioCodigo);
            if (!features.length) {
                destroyCharts();
                if (pieTitle) pieTitle.textContent = currentConfig.title || "Distribución de ciclo productivo";
                if (areaTitle) areaTitle.textContent = "Área sembrada por tipo de cultivo";
                setChartTitle("");
                const yieldTitle = ensureYieldTitleNode();
                yieldTitle.hidden = false;
                yieldTitle.textContent = "Rendimiento por tipo de cultivo";
                if (yieldCanvas) {
                    prepareVisibleChartCanvas(yieldCanvas, {
                        disableHorizontalScroll: true,
                        responsive: true,
                        canvasHeight: 420
                    });
                    setChartStatus(yieldCanvas, "No hay datos de rendimiento por tipo de cultivo para el municipio seleccionado.");
                }
                showPieStatus("No hay datos de censo agricola para el municipio seleccionado.", true);
                showAreaStatus("No hay datos de area sembrada por tipo de cultivo para el municipio seleccionado.", true);
                return;
            }

            const attrs = features[0]?.attributes || {};
            await renderYieldByCropChart(features, attrs);
            await renderPieChartPanel(features, attrs);
            await renderAreaByCropPanel(features, attrs);
            refreshSummary?.();
        } catch (error) {
            destroyCharts();
            if (yieldCanvas) {
                prepareVisibleChartCanvas(yieldCanvas, {
                    disableHorizontalScroll: true,
                    responsive: true,
                    canvasHeight: 420
                });
                setChartStatus(yieldCanvas, `No se pudo cargar el rendimiento por tipo de cultivo: ${String(error?.message || error)}`);
            }
            showPieStatus(`No se pudo cargar el censo agricola: ${String(error?.message || error)}`, true);
            showAreaStatus(`No se pudo cargar el area sembrada por tipo de cultivo: ${String(error?.message || error)}`, true);
        }
    }

    function setConfig(config) {
        restoreDefaultEvaLayout();
        currentConfig = config;
        metadataPromise = null;
        destroyCharts();
    }

    function getConfig() {
        return currentConfig;
    }

    return {
        destroyChart: destroyCharts,
        hideChart,
        renderForCurrentFilter,
        setConfig,
        getConfig
    };
}
