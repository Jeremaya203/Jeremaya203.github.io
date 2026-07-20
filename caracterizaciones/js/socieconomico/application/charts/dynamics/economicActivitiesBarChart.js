import { getRendererVisualForValue } from "../core/chartSymbolUtils.js?v=travel-time-pie-20260511";
import { createZoomOptions, ensureZoomKeepsVisibleData } from "../core/chartOptions.js?v=global-safe-zoom-labels-20260604";
import { destroyCanvasChart } from "../core/chartLifecycle.js";
import {
    ensureChartScrollContainer,
    prepareVisibleChartCanvas,
    setChartTitle
} from "../ui/chartPanel.js?v=economic-no-scroll-20260707";
import { setChartStatus } from "../ui/chartStatus.js";

function formatPercent(value) {
    const number = Number(value);
    return `${Number.isFinite(number) ? number.toLocaleString("es-CO", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }) : "0,00"} %`;
}

function formatBarValue(value) {
    return formatPercent(value).replace(/\s*%$/, "");
}

function formatAxisInteger(value) {
    const number = Number(value);
    return Number.isFinite(number)
        ? Math.round(number).toLocaleString("es-CO", { maximumFractionDigits: 0 })
        : "0";
}

function fadeColor(color, alpha = 0.35) {
    const rgba = String(color || "").match(/rgba?\(([^)]+)\)/i);
    if (rgba) {
        const parts = rgba[1].split(",").map(part => part.trim());
        return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
    }
    const hex = String(color || "").match(/^#([0-9a-f]{6})$/i);
    if (hex) {
        const int = parseInt(hex[1], 16);
        return `rgba(${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255}, ${alpha})`;
    }
    return color || "#94a3b8";
}

const ACTIVE_BAR_BORDER_WIDTH = 1.4;
const ECONOMIC_BAR_THICKNESS = 14;
const ECONOMIC_VIEWPORT_MIN_HEIGHT = 260;

function maxWrappedLineCount(wrappedLabels = []) {
    return Math.max(1, ...wrappedLabels.map(label => Array.isArray(label) ? label.length : 1));
}

function economicLabelFontSize(rowCount, wrappedLabels = []) {
    const maxLines = maxWrappedLineCount(wrappedLabels);
    if (rowCount > 14 || maxLines > 2) return 8;
    if (rowCount > 8) return 8;
    return 9;
}

function economicLabelLineHeight(fontSize) {
    return Math.ceil(fontSize * 1.22);
}

function economicBarThickness(rowCount) {
    if (rowCount > 18) return 10;
    if (rowCount > 12) return 11;
    if (rowCount > 6) return 12;
    return ECONOMIC_BAR_THICKNESS;
}

function economicRowHeightForIndex(rowCount, wrappedLabels = [], rowIndex = 0) {
    const wrapped = wrappedLabels[rowIndex] || [""];
    const lineCount = Array.isArray(wrapped) ? wrapped.length : 1;
    const fontSize = economicLabelFontSize(rowCount, wrappedLabels);
    const lineHeight = economicLabelLineHeight(fontSize);
    const dense = rowCount > 10;
    const labelBlock = lineCount * lineHeight + (dense ? 4 : 8);
    const barBlock = economicBarThickness(rowCount) + (dense ? 6 : 8);
    const rowGap = rowCount > 14 ? 6 : rowCount > 10 ? 7 : rowCount > 6 ? 8 : 10;
    return Math.max(dense ? 26 : 30, labelBlock, barBlock) + rowGap;
}

function computeEconomicChartHeights(rowCount, wrappedLabels = []) {
    const safeRows = Math.max(rowCount, 1);
    const rowHeights = Array.from({ length: safeRows }, (_, index) =>
        economicRowHeightForIndex(rowCount, wrappedLabels, index)
    );
    const viewportPadding = rowCount > 14 ? 58 : rowCount > 10 ? 64 : 72;
    const contentHeight = Math.max(
        ECONOMIC_VIEWPORT_MIN_HEIGHT,
        viewportPadding + rowHeights.reduce((sum, height) => sum + height, 0)
    );
    return { contentHeight };
}

function economicYAxisWidth(wrappedLabels = [], fontSize = 9) {
    const charWidth = fontSize * 0.52;
    const maxLineChars = Math.max(
        8,
        ...wrappedLabels.flatMap(label =>
            (Array.isArray(label) ? label : [String(label || "")]).map(line => line.length)
        )
    );
    return Math.min(162, Math.max(102, Math.ceil(maxLineChars * charWidth) + 6));
}

function applyEconomicYAxisLayout(chart, rowCount, wrappedLabels = []) {
    if (!chart?.options?.scales?.y) return;
    chart.$economicWrappedLabels = wrappedLabels;
    chart.$economicRowCount = rowCount;
    const fontSize = economicLabelFontSize(rowCount, wrappedLabels);
    chart.options.scales.y.ticks.font.size = fontSize;
    chart.options.scales.y.ticks.padding = 5;
    chart.options.scales.y.afterFit = axis => {
        const labels = axis.chart?.$economicWrappedLabels || wrappedLabels;
        const count = axis.chart?.$economicRowCount || labels.length || rowCount;
        const size = economicLabelFontSize(count, labels);
        axis.width = economicYAxisWidth(labels, size);
    };
}

function economicBarSpacing(rowCount) {
    if (rowCount > 16) return { barPercentage: 0.84, categoryPercentage: 0.9 };
    if (rowCount > 10) return { barPercentage: 0.8, categoryPercentage: 0.86 };
    if (rowCount > 6) return { barPercentage: 0.74, categoryPercentage: 0.78 };
    return { barPercentage: 0.66, categoryPercentage: 0.7 };
}

function applyEconomicBarSpacing(dataset, rowCount) {
    if (!dataset) return;
    const spacing = economicBarSpacing(rowCount);
    dataset.barPercentage = spacing.barPercentage;
    dataset.categoryPercentage = spacing.categoryPercentage;
}

function configureEconomicActivitiesViewport(canvas, rowCount, wrappedLabels = []) {
    const { contentHeight } = computeEconomicChartHeights(rowCount, wrappedLabels);
    const container = ensureChartScrollContainer(canvas);
    const chartCard = canvas.closest(".chart-card");

    canvas.classList.add("economic-activities-chart-active");
    canvas.style.setProperty("width", "100%", "important");
    canvas.style.setProperty("min-width", "0px", "important");
    canvas.style.setProperty("height", `${contentHeight}px`, "important");
    canvas.style.setProperty("min-height", `${contentHeight}px`, "important");
    canvas.style.setProperty("max-height", "none", "important");
    canvas.height = Math.round(contentHeight);

    if (container) {
        container.classList.add("economic-activities-chart-active");
        container.classList.remove("is-scrollable");
        container.scrollTop = 0;
        container.scrollLeft = 0;
        container.style.height = `${contentHeight}px`;
        container.style.minHeight = `${contentHeight}px`;
        container.style.maxHeight = "none";
        container.style.overflowY = "hidden";
        container.style.overflowX = "hidden";
        container.style.cursor = "default";
    }
    if (chartCard) {
        chartCard.classList.add("economic-activities-chart-active");
        chartCard.style.minHeight = `${contentHeight + 88}px`;
        chartCard.style.overflowY = "visible";
    }
}

function isCategoryScaleZoomed(scale, totalRows) {
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

function normalizeEconomicFullView(chart) {
    let changed = false;
    const labels = chart?.data?.labels || [];
    const yScale = chart?.scales?.y;
    const xScale = chart?.scales?.x;
    const xLimit = Number(chart?.$economicPanXLimit);

    if (yScale && labels.length) {
        const min = Number(yScale.min);
        const max = Number(yScale.max);
        if (Number.isFinite(min) && Number.isFinite(max) && min <= 0.01 && max >= labels.length - 1 - 0.01) {
            chart.options.scales.y.min = undefined;
            chart.options.scales.y.max = undefined;
            changed = true;
        }
    }

    if (xScale && Number.isFinite(xLimit) && xLimit > 0) {
        const min = Number(xScale.min);
        const max = Number(xScale.max);
        if (Number.isFinite(min) && Number.isFinite(max) && min <= 0.01 && max >= xLimit - 0.01) {
            chart.options.scales.x.min = undefined;
            chart.options.scales.x.max = undefined;
            changed = true;
        }
    }

    return changed;
}

function bindEconomicPointerPan(chart) {
    const canvas = chart?.canvas;
    if (!canvas) return;
    if (canvas.__economicPointerPanHandlers) {
        const handlers = canvas.__economicPointerPanHandlers;
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
        const xScale = chart.scales?.x;
        const yScale = chart.scales?.y;
        const xLimit = Number(chart.$economicPanXLimit);
        const canPanX = isValueScaleZoomed(xScale, xLimit);
        const canPanY = isCategoryScaleZoomed(yScale, labels.length);
        if (!area || !labels.length || (!canPanX && !canPanY)) return null;

        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const withinChart = x >= area.left && x <= area.right && y >= area.top && y <= area.bottom;
        if (!withinChart) return null;

        return { area, labels, x, y, xScale, yScale, xLimit, canPanX, canPanY };
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
            yMin: Number(context.yScale?.min),
            yMax: Number(context.yScale?.max),
            xLimit: context.xLimit,
            canPanX: context.canPanX,
            canPanY: context.canPanY,
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
        const currentX = event.clientX - rect.left;
        const currentY = event.clientY - rect.top;
        const deltaX = currentX - panState.startX;
        const deltaY = currentY - panState.startY;

        if (panState.canPanX) {
            const visibleSpanX = Math.max(0.0001, panState.xMax - panState.xMin);
            const pixelsPerUnit = Math.max(1, (panState.area.right - panState.area.left) / visibleSpanX);
            const deltaUnits = deltaX / pixelsPerUnit;
            const maxXStart = Math.max(0, panState.xLimit - visibleSpanX);
            const nextXMin = Math.min(maxXStart, Math.max(0, panState.xMin - deltaUnits));
            chart.options.scales.x.min = nextXMin;
            chart.options.scales.x.max = nextXMin + visibleSpanX;
        }

        if (panState.canPanY) {
            const visibleSpanY = Math.max(1, panState.yMax - panState.yMin);
            const pixelsPerRow = Math.max(1, (panState.area.bottom - panState.area.top) / visibleSpanY);
            const deltaRows = deltaY / pixelsPerRow;
            const maxYStart = Math.max(0, panState.labels.length - 1 - visibleSpanY);
            const nextYMin = Math.min(maxYStart, Math.max(0, panState.yMin - deltaRows));
            chart.options.scales.y.min = nextYMin;
            chart.options.scales.y.max = nextYMin + visibleSpanY;
        }

        if (normalizeEconomicFullView(chart)) chart.update("none");
        else chart.update("none");
        event.preventDefault();
    };

    function stopPan(event) {
        if (!panState) return;
        panState = null;
        canvas.style.cursor = getPanContext(event || {}) ? "grab" : "";
        canvas.releasePointerCapture?.(event?.pointerId);
    }

    canvas.__economicPointerPanHandlers = { pointerdown, pointermove, stopPan };
    canvas.addEventListener("pointerdown", pointerdown);
    canvas.addEventListener("pointermove", pointermove);
    canvas.addEventListener("pointerup", stopPan);
    canvas.addEventListener("pointercancel", stopPan);
    canvas.addEventListener("pointerleave", stopPan);
}

function normalizeCoverageLabel(value) {
    return String(value || "")
        .replace(/^\s*\d+(?:\.\d+)?\s*/u, "")
        .replace(/\s+/g, " ")
        .trim();
}

function buildDistinctLabel(row, duplicateLabels) {
    const baseLabel = String(row.baseLabel || row.rawLabel || "").trim();
    const coverageLabels = [...(row.coverageLabels || [])]
        .map(normalizeCoverageLabel)
        .filter(Boolean);
    if (!duplicateLabels.has(baseLabel)) return baseLabel;
    if (coverageLabels.length === 1) return coverageLabels[0];
    if (coverageLabels.length > 1) {
        return `${baseLabel} - ${coverageLabels[0]}`;
    }
    return `${baseLabel} - categoría ${row.rawLabel}`;
}

function resetChartViewport(canvas) {
    const container = ensureChartScrollContainer(canvas);
    if (!container) return;
    container.style.height = "";
    container.style.minHeight = "";
    container.style.maxHeight = "";
    container.style.overflowY = "hidden";
    container.style.overflowX = "hidden";
    container.style.cursor = "default";
    container.scrollTop = 0;
    container.scrollLeft = 0;
    container.classList.remove("economic-activities-chart-active");
    canvas.classList.remove("economic-activities-chart-active");
    const chartCard = canvas.closest(".chart-card");
    chartCard?.classList.remove("economic-activities-chart-active");
    chartCard?.style.setProperty("min-height", "455px");
}

function filterRowsByLegendCodes(rows, codes = null) {
    const normalizedCodes = Array.isArray(codes)
        ? codes.map(value => String(value ?? "").trim().toLowerCase()).filter(Boolean)
        : null;

    if (!normalizedCodes) return [...(rows || [])];
    if (!normalizedCodes.length) return [];

    return (rows || []).filter(row =>
        normalizedCodes.includes(String(row?.rawLabel ?? "").trim().toLowerCase())
    );
}

function findRowByLabelOrCode(rows, value) {
    const requested = String(value ?? "").trim().toLowerCase();
    if (!requested) return null;
    return (rows || []).find(row =>
        String(row?.label ?? "").trim().toLowerCase() === requested ||
        String(row?.rawLabel ?? "").trim().toLowerCase() === requested
    ) || null;
}

function splitLongEconomicWord(word, chunkSize) {
    if (word.length <= chunkSize) return [word];
    const chunks = [];
    for (let index = 0; index < word.length; index += chunkSize) {
        chunks.push(word.slice(index, index + chunkSize));
    }
    return chunks;
}

function wrapEconomicLabelLines(value, maxLineLength = 26) {
    const text = String(value || "").trim();
    if (!text) return [""];
    const words = text
        .split(/\s+/)
        .flatMap(word => splitLongEconomicWord(word, Math.max(8, maxLineLength)));
    const lines = [];
    let current = "";
    words.forEach(word => {
        const next = current ? `${current} ${word}` : word;
        if (next.length <= maxLineLength || !current) {
            current = next;
            return;
        }
        lines.push(current);
        current = word;
    });
    if (current) lines.push(current);
    return lines.length ? lines : [""];
}

function wrapEconomicLabelsForRows(labels = []) {
    const count = labels.length;
    const maxLineLength = count > 16 ? 22 : count > 10 ? 24 : count > 7 ? 26 : 30;
    return labels.map(label => wrapEconomicLabelLines(label, maxLineLength));
}

function getCanvasPointer(chart, event) {
    const native = event?.native || event;
    const canvas = chart?.canvas;
    if (!native || !canvas) return null;

    const rect = canvas.getBoundingClientRect?.();
    if (rect?.width && rect?.height
        && Number.isFinite(Number(native.clientX))
        && Number.isFinite(Number(native.clientY))) {
        const scaleX = (chart.width || rect.width) / rect.width;
        const scaleY = (chart.height || rect.height) / rect.height;
        return {
            x: (Number(native.clientX) - rect.left) * scaleX,
            y: (Number(native.clientY) - rect.top) * scaleY
        };
    }

    if (Number.isFinite(native.offsetX) && Number.isFinite(native.offsetY)) {
        return { x: native.offsetX, y: native.offsetY };
    }

    return null;
}

function resolveRowFromYAxis(chart, event) {
    const yScale = chart?.scales?.y;
    const labels = chart?.data?.labels || [];
    const pointer = getCanvasPointer(chart, event);
    if (!pointer || !yScale || !labels.length) return null;

    if (!Number.isFinite(pointer.x) || !Number.isFinite(pointer.y)) return null;
    if (pointer.x < 0 || pointer.x > (chart.width || chart.canvas?.width || 0)) return null;
    if (pointer.y < yScale.top || pointer.y > yScale.bottom) return null;

    let bestIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    labels.forEach((_, index) => {
        const pixel = yScale.getPixelForTick(index);
        const distance = Math.abs(pointer.y - pixel);
        if (distance < bestDistance) {
            bestDistance = distance;
            bestIndex = index;
        }
    });

    const rowTolerance = Math.max(18, Math.min(48, (yScale.height || 0) / Math.max(labels.length, 1) / 2));
    if (bestIndex < 0 || bestDistance > rowTolerance) return null;
    return {
        label: labels[bestIndex] || "",
        index: bestIndex
    };
}

export function createEconomicActivitiesBarChartController({
    chartCore,
    chartInteractions,
    getMunicipioActual,
    getFiltroNivel,
    refreshSummary
} = {}) {
    let metadataPromise = null;

    async function getMetadata(chartConfig) {
        if (!metadataPromise) {
            metadataPromise = fetch(`${chartConfig.serviceUrl}?f=json`)
                .then(response => {
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    return response.json();
                });
        }
        return metadataPromise;
    }

    async function validateFields(layer, chartConfig) {
        const metadata = await getMetadata(chartConfig);
        const available = new Set([
            ...((layer?.fields || []).map(field => String(field.name || "").toLowerCase())),
            ...((metadata?.fields || []).map(field => String(field.name || "").toLowerCase()))
        ]);
        const missing = (chartConfig.fields || []).filter(field => !available.has(String(field).toLowerCase()));
        if (missing.length) {
            throw new Error(`Campos no disponibles en SE_AES: ${missing.join(", ")}`);
        }
    }

    async function readablePlace(attrs = {}, chartConfig) {
        const metadata = await getMetadata(chartConfig).catch(() => null);
        const fields = metadata?.fields || [];
        const fieldInfo = name => fields.find(field => String(field.name).toLowerCase() === String(name).toLowerCase());
        const selectOptionLabel = (selectId, value) => {
            const option = document.querySelector(`#${selectId} option[value="${CSS.escape(String(value ?? ""))}"]`);
            return option?.textContent?.trim() || "";
        };

        const mpCode = String(attrs.mpcodigo || "").trim();
        const dpCode = String(attrs.dpcodigo || mpCode || "").slice(0, 2);
        const rawCategory = String(attrs.mpcategor || "").trim();
        const codedValues = fieldInfo("mpcategor")?.domain?.codedValues || [];
        const domainHit = codedValues.find(item => String(item.code) === rawCategory);
        let mpcategor = String(domainHit?.name || rawCategory || "Municipio").trim();
        if (/^\d{5}$/.test(mpCode) && rawCategory !== "3") mpcategor = "Municipio";
        if (/^\d{2}$/.test(mpCode)) mpcategor = "Departamento";

        const mpnombre = /^\d{5}$/.test(String(attrs.mpnombre || "").trim()) || !attrs.mpnombre
            ? (selectOptionLabel("municipios", mpCode) || String(attrs.mpnombre || mpCode || "").trim())
            : String(attrs.mpnombre).trim();
        const dpnombre = /^\d{2}$/.test(String(attrs.dpnombre || "").trim()) || !attrs.dpnombre
            ? (selectOptionLabel("departamentos", dpCode) || String(attrs.dpnombre || dpCode || "").trim())
            : String(attrs.dpnombre).trim();

        return { mpcategor, mpnombre, dpnombre };
    }

    async function queryRows(layer, chartConfig) {
        await layer.when?.();
        await validateFields(layer, chartConfig);

        const query = layer.createQuery();
        query.where = layer.definitionExpression || "1=1";
        query.outFields = chartConfig.fields;
        query.returnGeometry = false;
        query.num = 5000;
        const result = await layer.queryFeatures(query);
        const features = result?.features || [];
        if (!features.length) return { attrs: null, rows: [] };

        const grouped = new Map();
        features.forEach(feature => {
            const attrs = feature.attributes || {};
            const code = String(attrs.aetactividad ?? "").trim();
            const percent = Number(attrs.porcentaje);
            if (!code || !Number.isFinite(percent)) return;
            if (!grouped.has(code)) {
                const visual = getRendererVisualForValue(layer.renderer, code, chartConfig);
                grouped.set(code, {
                    rawLabel: code,
                    baseLabel: visual.label || code,
                    color: visual.color || "#94a3b8",
                    value: 0,
                    attributes: attrs,
                    coverageLabels: new Set()
                });
            }
            const row = grouped.get(code);
            row.value += percent;
            const coverageLabel = normalizeCoverageLabel(attrs.cdcobert);
            if (coverageLabel) row.coverageLabels.add(coverageLabel);
        });

        const duplicateLabels = new Set(
            [...grouped.values()]
                .map(row => String(row.baseLabel || "").trim())
                .filter(Boolean)
                .filter((label, index, items) => items.indexOf(label) !== index)
        );

        const rows = [...grouped.values()]
            .map(row => ({
                ...row,
                label: buildDistinctLabel(row, duplicateLabels)
            }))
            .filter(row => row.value > 0)
            .sort((a, b) => b.value - a.value);
        return { attrs: features[0]?.attributes || null, rows };
    }

    function createValueLabelsPlugin() {
        return {
            id: "economic-activities-value-labels",
            afterDatasetsDraw(chart) {
                const { ctx } = chart;
                const meta = chart.getDatasetMeta(0);
                const dataset = chart.data?.datasets?.[0];
                ctx.save();
                ctx.font = "600 10px Outfit, sans-serif";
                ctx.fillStyle = "#334155";
                ctx.textAlign = "left";
                ctx.textBaseline = "middle";
                (meta?.data || []).forEach((bar, index) => {
                    const value = Number(dataset?.data?.[index]);
                    if (!Number.isFinite(value)) return;
                    ctx.fillText(formatBarValue(value), bar.x + 8, bar.y);
                });
                ctx.restore();
            }
        };
    }

    function applyHighlight(chart, activeLabel = "") {
        const rowsByLabel = chartCore.getRowsByLabel();
        const labels = chart.data?.rawLabels || chart.data?.labels || [];
        const dataset = chart.data?.datasets?.[0];
        if (!dataset) return;
        dataset.backgroundColor = labels.map(label => {
            const color = rowsByLabel.get(label)?.color || "#94a3b8";
            if (!activeLabel) return color;
            return label === activeLabel ? color : fadeColor(color, 0.35);
        });
        dataset.borderColor = labels.map(label => label === activeLabel ? "#0f172a" : (rowsByLabel.get(label)?.color || "#94a3b8"));
        dataset.borderWidth = labels.map(label => label === activeLabel ? ACTIVE_BAR_BORDER_WIDTH : 1);
        chart.update();
    }

    function installEconomicLegendHooks(chart, rows = []) {
        const getActiveRows = () => chart.__economicActiveRows || rows;

        const applyRowsToChart = (filteredRows = [], activeLabel = "") => {
            const dataset = chart?.data?.datasets?.[0];
            if (!chart || !dataset) return;

            const nextRows = Array.isArray(filteredRows) ? filteredRows : [];
            chart.__economicActiveRows = nextRows;
            const nextLabels = nextRows.map(row => row.label);
            const nextWrappedLabels = wrapEconomicLabelsForRows(nextLabels);
            chart.data.rawLabels = nextLabels;
            chart.data.labels = nextWrappedLabels;
            dataset.data = nextRows.map(row => row.value);
            dataset.backgroundColor = nextRows.map(row =>
                activeLabel && row.label !== activeLabel
                    ? fadeColor(row.color, 0.35)
                    : row.color
            );
            dataset.borderColor = nextRows.map(row =>
                activeLabel && row.label === activeLabel ? "#0f172a" : row.color
            );
            dataset.borderWidth = nextRows.map(row =>
                activeLabel && row.label === activeLabel ? ACTIVE_BAR_BORDER_WIDTH : 1
            );
            configureEconomicActivitiesViewport(chart.canvas, nextRows.length, nextWrappedLabels);
            applyEconomicBarSpacing(dataset, nextRows.length);
            dataset.barThickness = economicBarThickness(nextRows.length);
            dataset.maxBarThickness = economicBarThickness(nextRows.length);
            if (chart.options?.scales?.y?.ticks?.font) {
                applyEconomicYAxisLayout(chart, nextRows.length, nextWrappedLabels);
            }
            chart.resize();
            chart.update();
        };

        window.__restoreChartCategoryFilter = () => {
            chartCore.setSelectedLabel(null);
            applyRowsToChart(rows, "");
        };

        window.__syncChartLegendFilter = (codes = null) => {
            const filteredRows = filterRowsByLegendCodes(rows, codes);
            if (!filteredRows.length) {
                chartCore.setSelectedLabel(null);
                applyRowsToChart(rows, "");
                return;
            }
            const currentSelected = String(chartCore.getSelectedLabel?.() || "").trim();
            const selectedRow = findRowByLabelOrCode(filteredRows, currentSelected);
            chartCore.setSelectedLabel(selectedRow?.label || null);
            applyRowsToChart(filteredRows, selectedRow?.label || "");
        };

        chart.__economicFindActiveRow = value => findRowByLabelOrCode(getActiveRows(), value);
    }

    async function selectEconomicCategory(row, chart, layer, chartConfig) {
        if (!row || !chart) return;
        chartCore.setSelectedLabel(row.label);
        if (typeof chartInteractions?.highlightMapByChartValue === "function") {
            await chartInteractions.highlightMapByChartValue(layer, chartConfig, row.rawLabel);
        } else {
            await window.__setLegendVisibleCodes?.([row.rawLabel]);
        }
        applyHighlight(chart, row.label);
    }

    async function restoreEconomicCategories(chart, rows = [], layer = null) {
        chartCore.setSelectedLabel(null);

        const state = window.__legendState;
        if (state) {
            state.visibleCodes = null;
            state.activeCodes = new Set((state.allCodes || []).map(value => String(value)));
        }

        await window.__setLegendVisibleCodes?.(null);
        await window.__clearLegendLayerFilters?.([layer].filter(Boolean));

        document.querySelectorAll("#legendContent .legend-item").forEach(node => {
            node.style.display = "";
            node.classList.remove("off");
            node.classList.add("active");
        });

        chart.__economicActiveRows = rows;
        window.__restoreChartCategoryFilter?.();
        applyHighlight(chart, "");
    }

    function installEconomicCanvasReset(canvas, chart, rows = [], layer = null) {
        if (!canvas || !chart) return;
        const container = ensureChartScrollContainer(canvas);
        if (canvas.__economicDblClickHandler) {
            canvas.removeEventListener("dblclick", canvas.__economicDblClickHandler);
            container?.removeEventListener("dblclick", canvas.__economicDblClickHandler);
        }

        canvas.__economicDblClickHandler = async event => {
            if (event.__economicResetHandled) return;
            const points = chart.getElementsAtEventForMode?.(
                event,
                "nearest",
                { intersect: true },
                true
            ) || [];
            if (points.length) return;

            event.__economicResetHandled = true;
            await restoreEconomicCategories(chart, rows, layer);
        };

        canvas.addEventListener("dblclick", canvas.__economicDblClickHandler);
        container?.addEventListener("dblclick", canvas.__economicDblClickHandler);
    }

    function installEconomicCanvasClick(canvas, chart, rows = [], layer, chartConfig) {
        if (!canvas || !chart) return;
        if (canvas.__economicClickHandler) {
            canvas.removeEventListener("click", canvas.__economicClickHandler);
            canvas.removeEventListener("pointerdown", canvas.__economicClickHandler);
        }
        if (canvas.__economicPointerDownHandler) {
            canvas.removeEventListener("pointerdown", canvas.__economicPointerDownHandler);
            canvas.removeEventListener("pointermove", canvas.__economicPointerMoveHandler);
            canvas.removeEventListener("pointerup", canvas.__economicPointerUpHandler);
            canvas.removeEventListener("pointercancel", canvas.__economicPointerUpHandler);
        }

        const dragState = {
            active: false,
            moved: false,
            startX: 0,
            startY: 0
        };
        canvas.__economicPointerDownHandler = event => {
            dragState.active = true;
            dragState.moved = false;
            dragState.startX = Number(event.clientX) || 0;
            dragState.startY = Number(event.clientY) || 0;
        };
        canvas.__economicPointerMoveHandler = event => {
            if (!dragState.active || dragState.moved) return;
            const deltaX = (Number(event.clientX) || 0) - dragState.startX;
            const deltaY = (Number(event.clientY) || 0) - dragState.startY;
            dragState.moved = Math.hypot(deltaX, deltaY) > 3;
        };
        canvas.__economicPointerUpHandler = () => {
            dragState.active = false;
            window.setTimeout(() => {
                dragState.moved = false;
            }, 0);
        };

        canvas.__economicClickHandler = async event => {
            if (dragState.moved) return;
            const points = chart.getElementsAtEventForMode?.(
                event,
                "nearest",
                { intersect: false, axis: "y" },
                true
            ) || [];

            const yAxisHit = resolveRowFromYAxis(chart, event);
            const index = points?.[0]?.index ?? yAxisHit?.index;
            if (index == null) return;

            const label = chart.data?.rawLabels?.[index] || yAxisHit?.label;
            const row = chart.__economicFindActiveRow?.(label) || findRowByLabelOrCode(rows, label);
            await selectEconomicCategory(row, chart, layer, chartConfig);
        };

        canvas.addEventListener("pointerdown", canvas.__economicPointerDownHandler);
        canvas.addEventListener("pointermove", canvas.__economicPointerMoveHandler);
        canvas.addEventListener("pointerup", canvas.__economicPointerUpHandler);
        canvas.addEventListener("pointercancel", canvas.__economicPointerUpHandler);
        canvas.addEventListener("click", canvas.__economicClickHandler);
    }

    async function actualizarGrafica(layer, config) {
        const chartConfig = config?.chartConfig;
        const canvas = document.getElementById("chart");
        if (!canvas || chartConfig?.type !== "economicActivitiesBar") return false;

        const requiresMunicipality = chartConfig?.filter?.requiredLevel === "MUNI";
        const hasMunicipality = getFiltroNivel?.() === "MUNI"
            && Boolean(String(getMunicipioActual?.() || "").trim());
        if (requiresMunicipality && !hasMunicipality) {
            chartCore.destroyChart();
            resetChartViewport(canvas);
            prepareVisibleChartCanvas(canvas, chartConfig);
            window.setEconomicChartSubtitle?.(chartConfig.title || config.title);
            setChartStatus(canvas, "Seleccione un municipio para ver la información.");
            return true;
        }

        if (!layer) return false;

        prepareVisibleChartCanvas(canvas);
        resetChartViewport(canvas);
        window.setEconomicChartSubtitle?.(chartConfig.title || config.title);
        setChartStatus(canvas, "Cargando actividades económicas...");

        try {
            const { attrs, rows } = await queryRows(layer, chartConfig);
            if (!attrs || !rows.length) {
                chartCore.destroyChart();
                window.setEconomicChartSubtitle?.(chartConfig.title || config.title);
                setChartStatus(canvas, "No hay datos válidos de actividades económicas para el municipio seleccionado.");
                return true;
            }

            const place = await readablePlace(attrs, chartConfig);
            window.setEconomicChartSubtitle?.(
                (chartConfig.titleTemplate || chartConfig.title || "")
                    .replace(/\{(\w+)\}/g, (_, key) => place[key] || attrs[key] || "")
            );
            setChartStatus(canvas, "");
            chartCore.destroyChart();
            chartCore.setRows(rows);
            const labels = rows.map(row => row.label);
            const wrappedLabels = wrapEconomicLabelsForRows(labels);
            configureEconomicActivitiesViewport(canvas, rows.length, wrappedLabels);

            if (typeof window.actualizarLeyenda === "function") {
                window.actualizarLeyenda(
                    rows.map(row => row.label),
                    rows.map(row => row.color),
                    rows.map(row => row.rawLabel),
                    {
                        field: chartConfig.mapInteractionField || "aetactividad",
                        baseWhere: layer.definitionExpression || "1=1",
                        layers: [layer],
                        preserveOrder: true
                    }
                );
            }

            destroyCanvasChart(canvas);
            const barThickness = economicBarThickness(rows.length);
            const barSpacing = economicBarSpacing(rows.length);
            const chart = new Chart(canvas, {
                type: "bar",
                data: {
                    labels: wrappedLabels,
                    rawLabels: labels,
                    datasets: [{
                        label: chartConfig.title || config.title,
                        data: rows.map(row => row.value),
                        backgroundColor: rows.map(row => row.color),
                        borderColor: rows.map(row => row.color),
                        borderWidth: 1,
                        borderRadius: 4,
                        barThickness,
                        maxBarThickness: barThickness,
                        barPercentage: barSpacing.barPercentage,
                        categoryPercentage: barSpacing.categoryPercentage
                    }]
                },
                options: {
                    indexAxis: "y",
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: "nearest", intersect: true },
                    layout: {
                        padding: {
                            left: 4,
                            right: 36,
                            top: 8,
                            bottom: 8
                        }
                    },
                    plugins: {
                        legend: { display: false },
                        zoom: {
                            ...createZoomOptions({
                                pan: {
                                    enabled: false,
                                    mode: "xy",
                                    modifierKey: null,
                                    threshold: 0
                                },
                                zoom: {
                                    mode: "xy"
                                }
                            }),
                            pan: {
                                enabled: false,
                                mode: "xy",
                                threshold: 0
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
                                y: {
                                    min: "original",
                                    max: "original",
                                    minRange: 1
                                }
                            }
                        },
                        tooltip: {
                            callbacks: {
                                title(items) {
                                    const index = items?.[0]?.dataIndex;
                                    return index == null ? "" : (rows[index]?.label || "");
                                },
                                label(context) {
                                    return formatPercent(context.parsed.x);
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: chartConfig.xAxis?.label || "Área (%)"
                            },
                            grid: { color: "rgba(31, 41, 55, 0.08)" },
                            ticks: {
                                color: "#334155",
                                font: { size: 10 },
                                callback(value) {
                                    return formatAxisInteger(value);
                                }
                            }
                        },
                        y: {
                            offset: true,
                            title: {
                                display: true,
                                text: chartConfig.yAxis?.label || "Actividad económica"
                            },
                            grid: { display: false },
                            ticks: {
                                autoSkip: false,
                                color: "#334155",
                                padding: 5,
                                font: {
                                    size: economicLabelFontSize(rows.length, wrappedLabels),
                                    weight: "500",
                                    lineHeight: 1.2
                                },
                                callback(value) {
                                    const labelIndex = Number(value);
                                    const currentLabels = this?.chart?.data?.labels || wrappedLabels;
                                    return currentLabels[labelIndex] || this?.getLabelForValue?.(value) || "";
                                }
                            }
                        }
                    },
                    onHover: (event, elements) => {
                        const target = event?.native?.target;
                        if (target) target.style.cursor = elements?.length ? "pointer" : "default";
                    }
                },
                plugins: [createValueLabelsPlugin()]
            });

            applyEconomicYAxisLayout(chart, rows.length, wrappedLabels);
            chartCore.setInstance(chart);
            chart.$economicPanXLimit = Math.max(0, ...rows.map(row => Number(row.value) || 0));
            bindEconomicPointerPan(chart);
            installEconomicLegendHooks(chart, rows);
            installEconomicCanvasClick(canvas, chart, rows, layer, chartConfig);
            installEconomicCanvasReset(canvas, chart, rows, layer);
            refreshSummary?.();
            return true;
        } catch (error) {
            chartCore.destroyChart();
            setChartStatus(canvas, `No se pudo cargar el gráfico: ${String(error?.message || error)}`);
            return true;
        }
    }

    return {
        actualizarGrafica
    };
}
