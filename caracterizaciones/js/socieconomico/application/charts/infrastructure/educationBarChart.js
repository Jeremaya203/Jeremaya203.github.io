import { prepareVisibleChartCanvas, setChartTitle } from "../ui/chartPanel.js?v=local-chart-title-20260529";
import { setChartStatus } from "../ui/chartStatus.js";
import { MUNICIPALITY_REQUIRED_CHART_MESSAGE } from "../ui/municipalityRequiredState.js?v=global-municipality-required-state-20260604";
import { createDefaultBarDataset, createBarChartOptions } from "../core/chartOptions.js?v=global-safe-zoom-labels-20260604";
import { getChartBaseWhere } from "../core/chartUtils.js?v=travel-time-pie-20260511";
import { renderDoughnutChart } from "../renderers/doughnutChartRenderer.js";
import { getRendererLegendItems, getRendererVisualForValue } from "../core/chartSymbolUtils.js?v=support-infra-rest-legend2-20260516";
import { destroyCanvasChart } from "../core/chartLifecycle.js";
import { createAdaptiveBarValueLabelsPlugin } from "../core/adaptiveBarValueLabels.js?v=global-safe-zoom-labels-20260604";

const CATEGORY_COLOR_STOPS = [
    "rgba(21, 128, 61, 1)",
    "rgba(34, 197, 94, 1)",
    "rgba(14, 116, 144, 1)",
    "rgba(59, 130, 246, 1)",
    "rgba(234, 179, 8, 1)"
];
const ATTRIBUTE_CATEGORY_CHART_IDS = new Set([
    "instituciones-educacion",
    "salud-infraestructura",
    "turismo-infraestructura"
]);

const TURISMO_CHART_ID = "turismo-infraestructura";
const HEALTH_CHART_ID = "salud-infraestructura";
const EDUCATION_CHART_ID = "instituciones-educacion";
const ADAPTIVE_BOX_LABEL_CHART_IDS = new Set([
    EDUCATION_CHART_ID,
    HEALTH_CHART_ID,
    TURISMO_CHART_ID
]);
const NUMERIC_POPUP_FORMAT_CHART_IDS = new Set([
    "instituciones-educacion",
    HEALTH_CHART_ID,
    TURISMO_CHART_ID
]);
const tourismDerivedCharts = new Map();
let lastTourismHoverLabel = "";
let lastTourismHoverAt = 0;

function applyTourismLayoutMode(active = false) {
    const row = document.getElementById("attrCategoryChartRow");
    if (!row) return;
    row.classList.toggle("tourism-layout-active", Boolean(active));
    if (!active) {
        row.classList.remove("tourism-derived-open");
    }
}

function destroyTourismDerivedChart(chartKey = null) {
    if (chartKey) {
        tourismDerivedCharts.get(chartKey)?.destroy?.();
        tourismDerivedCharts.delete(chartKey);
        return;
    }
    tourismDerivedCharts.forEach(chart => chart?.destroy?.());
    tourismDerivedCharts.clear();
}

function hideTourismRequirementPanels() {
    destroyTourismDerivedChart();
    ["tourismReq15Panel", "tourismReq16Panel"].forEach(id => {
        const node = document.getElementById(id);
        if (!node) return;
        node.hidden = true;
        node.replaceChildren();
        delete node.dataset.openFor;
    });
    applyTourismLayoutMode(false);
}

function normalizeEducationSummaryText(value) {
    return String(value || "")
        .replace(/\r\n/g, "\n")
        .replace(/\s+/g, " ")
        .trim();
}

function educationParagraphStartsWith(value) {
    return normalizeEducationSummaryText(value)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .startsWith("en educacion");
}

function extractEducationParagraphSafe(value, fallbackMessage) {
    const text = String(value || "").trim();
    if (!text) return fallbackMessage;
    const paragraphs = text
        .replace(/\r\n/g, "\n")
        .split(/\n\s*\n/)
        .map(item => normalizeEducationSummaryText(item))
        .filter(Boolean);
    const match = paragraphs.find(item => educationParagraphStartsWith(item));
    return match || fallbackMessage;
}

function fillTourismPanel(panel, { requirementTitle, categoryTitle, count, place }) {
    if (!panel) return;
    panel.replaceChildren();
    const h4 = document.createElement("h4");
    h4.className = "tourism-req-panel__req";
    h4.textContent = requirementTitle;
    const h5 = document.createElement("h5");
    h5.className = "tourism-req-panel__cat";
    h5.textContent = categoryTitle;
    const pCount = document.createElement("p");
    pCount.className = "tourism-req-panel__count";
    pCount.textContent = `Registros: ${Number(count).toLocaleString("es-CO")}`;
    const pPlace = document.createElement("p");
    pPlace.className = "tourism-req-panel__place";
    pPlace.textContent = `${place.mpnombre}, ${place.dpnombre}`;
    panel.append(h4, h5, pCount, pPlace);
}

function ensureTourismDerivedPanel(panel, spec, title, place, chartId) {
    if (!panel) return null;
    panel.replaceChildren();

    const req = document.createElement("h4");
    req.className = "tourism-req-panel__req";
    req.textContent = spec.requirementTitle || "";

    const heading = document.createElement("h5");
    heading.className = "tourism-req-panel__cat";
    heading.textContent = title || spec.categoryTitle || "";

    const subtitle = document.createElement("p");
    subtitle.className = "tourism-req-panel__count";
    subtitle.textContent = spec.derivedChart?.subtitle || spec.categoryTitle || "";

    const chartBox = document.createElement("div");
    chartBox.className = "tourism-req-panel__chart-box";
    const canvas = document.createElement("canvas");
    canvas.id = chartId;
    chartBox.appendChild(canvas);

    const status = document.createElement("p");
    status.className = "tourism-req-panel__status";
    status.hidden = true;

    panel.append(req, heading, subtitle, chartBox, status);
    return { canvas, status };
}

function setTourismDerivedStatus(statusNode, message) {
    if (!statusNode) return;
    statusNode.hidden = !message;
    statusNode.textContent = message || "";
}

function createTourismDataLabelPlugin(chartId) {
    return {
        id: `${chartId}-tourism-labels`,
        afterDatasetsDraw(chartInstance) {
            const ctx = chartInstance.ctx;
            const meta = chartInstance.getDatasetMeta(0);
            const dataset = chartInstance.data?.datasets?.[0];
            const values = Array.isArray(dataset?.data)
                ? dataset.data.map(item => Number(item) || 0)
                : [];
            const total = values.reduce((sum, value) => sum + value, 0);
            const maxLabels = 3;
            let visibleCount = 0;
            ctx.save();
            ctx.fillStyle = "#334155";
            ctx.font = "600 10px Outfit, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            (meta?.data || []).forEach((arc, index) => {
                const value = Number(values[index]);
                if (!Number.isFinite(value)) return;
                const percent = total > 0 ? (value / total) * 100 : 0;
                if (percent < 10 || visibleCount >= maxLabels) return;
                const angle = (arc.startAngle + arc.endAngle) / 2;
                const radius = (arc.outerRadius || 0) + 16;
                const x = arc.x + Math.cos(angle) * radius;
                const y = arc.y + Math.sin(angle) * radius;
                ctx.fillText(`${percent.toFixed(1)}%`, x, y);
                visibleCount += 1;
            });
            ctx.restore();
        }
    };
}

function formatTourismPercent(value) {
    const n = Number(value);
    return `${Number.isFinite(n) ? n.toFixed(1) : "0.0"}%`;
}

async function rendererFromLayerMetadata(layer) {
    const url = String(layer?.__sourceUrl || layer?.url || "").trim();
    if (!url) return null;
    try {
        const response = await fetch(`${url}?f=json`);
        if (!response.ok) return null;
        const json = await response.json();
        return json?.drawingInfo?.renderer || null;
    } catch {
        return null;
    }
}

function toPlainArray(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value.toArray === "function") return value.toArray();
    if (Array.isArray(value.items)) return value.items;
    return [];
}

function symbolToCssColor(symbol) {
    const color = symbol?.color || symbol?.symbol?.color || symbol?.outline?.color;
    if (Array.isArray(color)) {
        const [r, g, b, a = 255] = color;
        return `rgba(${r}, ${g}, ${b}, ${Number(a) / 255})`;
    }
    if (color && typeof color === "object") {
        const r = color.r ?? color.red;
        const g = color.g ?? color.green;
        const b = color.b ?? color.blue;
        const alpha = color.a ?? color.alpha ?? 1;
        if ([r, g, b].every(value => value != null && Number.isFinite(Number(value)))) {
            const cssAlpha = Number(alpha) > 1 ? Number(alpha) / 255 : Number(alpha);
            return `rgba(${Number(r)}, ${Number(g)}, ${Number(b)}, ${Math.max(0, Math.min(1, cssAlpha))})`;
        }
    }
    return "#999";
}

function rendererInfoCode(info) {
    const values = toPlainArray(info?.values);
    if (values.length) {
        const first = Array.isArray(values[0]) ? values[0] : toPlainArray(values[0]);
        return String(first?.[0] ?? values[0] ?? "").trim();
    }
    if (info?.value != null) return String(info.value).trim();
    return "";
}

function rendererLegendItemsDirect(renderer) {
    const uniqueInfos = toPlainArray(renderer?.uniqueValueInfos);
    const groupedInfos = toPlainArray(renderer?.uniqueValueGroups)
        .flatMap(group => toPlainArray(group?.classes));
    const infos = uniqueInfos.length ? uniqueInfos : groupedInfos;
    return infos.map(info => ({
        code: rendererInfoCode(info),
        label: String(info?.label || info?.description || "").trim(),
        color: symbolToCssColor(info?.symbol)
    })).filter(item => item.code && item.label);
}

async function queryExistingLegendCodes(layer, field, where) {
    if (!layer || !field) return [];

    const codes = new Set();
    const query = layer.createQuery ? layer.createQuery() : {};
    query.where = where || layer.definitionExpression || "1=1";
    query.outFields = [field];
    query.returnGeometry = false;
    query.returnDistinctValues = true;
    query.num = 2000;

    try {
        const result = await layer.queryFeatures(query);
        (result?.features || []).forEach(feature => {
            const value = feature?.attributes?.[field];
            if (value != null && String(value).trim() !== "") {
                codes.add(String(value).trim());
            }
        });
    } catch {
        const fallbackQuery = layer.createQuery ? layer.createQuery() : {};
        fallbackQuery.where = query.where;
        fallbackQuery.outFields = [field];
        fallbackQuery.returnGeometry = false;
        fallbackQuery.num = 2000;
        try {
            const result = await layer.queryFeatures(fallbackQuery);
            (result?.features || []).forEach(feature => {
                const value = feature?.attributes?.[field];
                if (value != null && String(value).trim() !== "") {
                    codes.add(String(value).trim());
                }
            });
        } catch {}
    }

    return [...codes];
}

function rendererFieldName(renderer, fallback = null) {
    return String(
        renderer?.field ||
        renderer?.field1 ||
        renderer?.field2 ||
        renderer?.field3 ||
        fallback ||
        ""
    ).trim() || null;
}

async function refreshTourismRendererLegend(layer, chartConfig, where) {
    if (typeof window.actualizarLeyenda !== "function" || !layer) return;

    const renderer = (await rendererFromLayerMetadata(layer)) || layer.renderer;
    const legendField = rendererFieldName(renderer, chartConfig?.typologiaField || chartConfig?.legendField || "tipologiatur");
    const legendWhere = String(layer.definitionExpression || where || "1=1").trim() || "1=1";
    const rendererItems = rendererLegendItemsDirect(renderer).length
        ? rendererLegendItemsDirect(renderer)
        : getRendererLegendItems(renderer, {
        ...chartConfig,
        mapInteractionField: legendField,
        labelsFromRenderer: true,
        colorsFromRenderer: true
    });
    if (!rendererItems.length) return;

    const existingCodes = new Set(await queryExistingLegendCodes(layer, legendField, legendWhere));
    const items = existingCodes.size
        ? rendererItems.filter(item => existingCodes.has(String(item.code).trim()))
        : rendererItems;
    if (!items.length) return;

    window.actualizarLeyenda(
        items.map(item => item.label),
        items.map(item => item.color || "#999"),
        items.map(item => item.code),
        {
            field: legendField,
            baseWhere: legendWhere,
            layers: [layer],
            preserveOrder: true
        }
    );
}

async function renderTourismDerivedChart({
    panel,
    spec,
    row,
    place,
    attrs,
    layer,
    where,
    openLayerPopup,
    preserveViewOnPopup
}) {
    const derivedChart = spec?.derivedChart;
    if (!panel || !derivedChart) return;

    const panelChartId = spec.side === "right" ? "tourismReq16Chart" : "tourismReq15Chart";
    destroyTourismDerivedChart(panelChartId);
    const title = String(derivedChart.titleTemplate || "")
        .replace(/\{(\w+)\}/g, (_, key) => place[key] || attrs?.[key] || "");
    const refs = ensureTourismDerivedPanel(panel, spec, title, place, panelChartId);
    if (!refs?.canvas) return;

    const fieldNames = new Set((layer?.fields || []).map(field => String(field?.name || "").toLowerCase()));
    const missing = (derivedChart.fields || [])
        .map(field => field?.name)
        .filter(field => field && !fieldNames.has(String(field).toLowerCase()));
    if (missing.length) {
        setTourismDerivedStatus(refs.status, `Faltan campos requeridos para ${spec.categoryTitle || "turismo"}: ${missing.join(", ")}`);
        panel.hidden = false;
        panel.dataset.openFor = row.rawLabel;
        return;
    }

    const query = layer.createQuery();
    query.where = where;
    query.outFields = [...new Set([
        "mpcodigo",
        "mpnombre",
        "dpnombre",
        "mpcategor",
        "dpcodigo",
        ...(derivedChart.fields || []).map(field => field.name)
    ])];
    query.returnGeometry = true;
    query.num = 1;

    const result = await layer.queryFeatures(query);
    const feature = result?.features?.[0];
    const sourceAttrs = feature?.attributes || attrs || {};
    const rows = (derivedChart.fields || []).map(field => {
        const value = Number(sourceAttrs[field.name]);
        if (!Number.isFinite(value) || value <= 0) return null;
        return {
            label: field.label,
            value,
            color: field.color
        };
    }).filter(Boolean);

    if (!rows.length) {
        setTourismDerivedStatus(refs.status, derivedChart.emptyMessage || "No hay datos válidos para el gráfico derivado.");
        panel.hidden = false;
        panel.dataset.openFor = row.rawLabel;
        return;
    }

    refs.canvas.style.height = "320px";
    setTourismDerivedStatus(refs.status, "");
    const chartInstance = renderDoughnutChart({
        canvas: refs.canvas,
        labels: rows.map(item => item.label),
        values: rows.map(item => item.value),
        title,
        colors: rows.map(item => item.color),
        showLegend: true,
        formatValue: formatTourismPercent,
        onSliceClick: async () => {
            await openLayerPopup(layer, where, {
                preserveView: Boolean(preserveViewOnPopup)
            });
        },
        plugins: [createTourismDataLabelPlugin(derivedChart.id || panelChartId)]
    });
    tourismDerivedCharts.set(panelChartId, chartInstance);

    panel.hidden = false;
    panel.dataset.openFor = row.rawLabel;
    document.getElementById("attrCategoryChartRow")?.classList.add("tourism-derived-open");
    window.requestAnimationFrame(() => {
        panel.scrollIntoView?.({
            block: "start",
            inline: "nearest",
            behavior: "smooth"
        });
    });
}

async function toggleTourismRequirementPanel(chartConfig, rawLabel, row, place, context = {}) {
    const specAll = chartConfig?.subRequirementPanels || {};
    const spec = specAll[rawLabel];
    if (!spec) return;

    const isLeft = spec.side !== "right";
    const panelId = isLeft ? "tourismReq15Panel" : "tourismReq16Panel";
    const panel = document.getElementById(panelId);
    if (!panel) return;

    if (!panel.hidden && panel.dataset.openFor === rawLabel) {
        if (spec.derivedChart) {
            destroyTourismDerivedChart(spec.side === "right" ? "tourismReq16Chart" : "tourismReq15Chart");
        }
        panel.hidden = true;
        panel.replaceChildren();
        delete panel.dataset.openFor;
        document.getElementById("attrCategoryChartRow")?.classList.remove("tourism-derived-open");
        return;
    }

    if (spec.derivedChart) {
        await renderTourismDerivedChart({
            panel,
            spec,
            row,
            place,
            attrs: context.attrs,
            layer: context.layer,
            where: context.where,
            openLayerPopup: context.openLayerPopup,
            preserveViewOnPopup: context.preserveViewOnPopup
        });
        return;
    }

    fillTourismPanel(panel, {
        requirementTitle: spec.requirementTitle || "",
        categoryTitle: spec.categoryTitle || row?.label || "",
        count: row?.value ?? 0,
        place
    });
    panel.hidden = false;
    panel.dataset.openFor = rawLabel;
    document.getElementById("attrCategoryChartRow")?.classList.add("tourism-derived-open");
    window.requestAnimationFrame(() => {
        panel.scrollIntoView?.({
            block: "start",
            inline: "nearest",
            behavior: "smooth"
        });
    });
}

export function createEducationBarChartController({
    chartCore,
    getWhereBase,
    getFiltroNivel,
    getMunicipioActual,
    getDeptoActual,
    getDiccionarioDepartamentos,
    getView,
    getHighlightHandle,
    setHighlightHandle
}) {
    let activeEducationLayer = null;
    let activeEducationWhere = "1=1";
    let activeEducationChartConfig = null;

    function buildWhere(chartConfig) {
        return getChartBaseWhere({
            chartConfig,
            whereBase: getWhereBase?.(),
            filtroNivel: getFiltroNivel?.(),
            deptoActual: getDeptoActual?.(),
            diccionarioDepartamentos: getDiccionarioDepartamentos?.()
        });
    }

    function withAlpha(color, alpha = 1) {
        const rgba = String(color || "").match(/rgba?\(([^)]+)\)/i);
        if (!rgba) return color || "";
        const parts = rgba[1].split(",").map(part => part.trim());
        if (parts.length < 3) return color || "";
        return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
    }

    function solidChartColor(color) {
        return withAlpha(color, 1);
    }

    function fadeColor(color, alpha = 0.72) {
        return withAlpha(color, alpha);
    }

    function codeToCssColor(code) {
        const visual = getRendererVisualForValue(activeEducationLayer?.renderer, code, activeEducationChartConfig || {});
        return solidChartColor(visual?.color || "");
    }

    function rendererLabelForCode(code) {
        const visual = getRendererVisualForValue(activeEducationLayer?.renderer, code, activeEducationChartConfig || {});
        return String(visual?.label || "").trim();
    }

    function categoryCodesForField(fieldName, chartConfig) {
        const rawCode = chartConfig?.categoryRendererCodes?.[fieldName];
        return rawCode ? [String(rawCode)] : [];
    }

    function categoryFieldsForCode(code, chartConfig) {
        const normalizedCode = String(code || "").trim();
        return Object.entries(chartConfig?.categoryRendererCodes || {})
            .filter(([, currentCode]) => String(currentCode || "").trim() === normalizedCode)
            .map(([fieldName]) => fieldName);
    }

    function isHealthChart(chartConfig) {
        return chartConfig?.id === HEALTH_CHART_ID;
    }

    function resolveDominantCategoryFields(attrs = {}, chartConfig) {
        const rows = (chartConfig?.categoryFields || []).map(fieldName => ({
            fieldName,
            value: Number(attrs?.[fieldName])
        })).filter(item => Number.isFinite(item.value));
        if (!rows.length) return [];
        const maxValue = Math.max(...rows.map(item => item.value));
        if (!Number.isFinite(maxValue)) return [];
        return rows
            .filter(item => item.value === maxValue && maxValue > 0)
            .map(item => item.fieldName);
    }

    function resolveHealthLegendItem(attrs = {}, chartConfig) {
        const rendererField = chartConfig?.legendField || "no_prestadores";
        const rendererValue = attrs?.[rendererField];
        const visual = getRendererVisualForValue(activeEducationLayer?.renderer, rendererValue, chartConfig || {});
        const code = String(visual?.code || rendererValue || "").trim();
        const label = String(visual?.label || "").trim();
        const color = solidChartColor(visual?.color || "");
        if (!code || !label) return null;
        return {
            code,
            label,
            color: color || "#999",
            symbol: visual?.symbol || null
        };
    }

    function isNumericPopupValue(value) {
        if (typeof value === "number") return Number.isFinite(value);
        if (typeof value !== "string") return false;
        const text = value.trim();
        if (!text) return false;
        return /^-?\d+(?:\.\d+)?$/.test(text);
    }

    function formatTourismPopupValue(value) {
        if (!isNumericPopupValue(value)) return value;
        const numericValue = Number(value);
        if (!Number.isFinite(numericValue)) return value;
        if (Number.isInteger(numericValue)) return String(numericValue);
        return numericValue.toFixed(2).replace(/\.?0+$/, "");
    }

    function buildEducationPopupTemplate(layer, { formatNumericValues = false } = {}) {
        const technicalNames = new Set([
            "shape",
            "geometry",
            "objectid",
            "mpcodigo",
            "dpcodigo",
            "shape_area",
            "shape_length",
            "shape__area",
            "shape__length",
            "st_area(shape)",
            "st_perimeter(shape)"
        ]);

        const fieldMap = new Map((layer?.fields || []).map(field => [String(field?.name || "").toLowerCase(), field]));
        const resolveDomainValue = (fieldName, value) => {
            const field = fieldMap.get(String(fieldName || "").toLowerCase());
            const codedValues = field?.domain?.codedValues || [];
            const hit = codedValues.find(item => String(item.code) === String(value));
            return hit?.name ?? value;
        };
        const resolvePopupValue = (fieldName, attrs, value) => {
            const normalizedField = String(fieldName || "").toLowerCase();
            const place = readablePlace(attrs);
            let resolvedValue = value;
            if (normalizedField === "mpnombre") return place.mpnombre || value;
            if (normalizedField === "dpnombre") return place.dpnombre || value;
            if (normalizedField === "mpcategor") return place.mpcategor || value;
            if (normalizedField === "mpcracdm") {
                resolvedValue = rendererLabelForCode(value) || resolveDomainValue(fieldName, value);
            } else {
                resolvedValue = resolveDomainValue(fieldName, value);
            }
            return formatNumericValues ? formatTourismPopupValue(resolvedValue) : resolvedValue;
        };

        return {
            title: (event) => {
                const attrs = event?.graphic?.attributes || {};
                const place = readablePlace(attrs);
                return `${place.mpnombre || attrs.mpnombre || ""}, ${place.dpnombre || attrs.dpnombre || ""}`.trim().replace(/^,\s*|\s*,$/g, "");
            },
            content: (event) => {
                const attrs = event?.graphic?.attributes || {};
                const rows = (layer?.fields || [])
                    .filter(field => {
                        const name = String(field?.name || "").toLowerCase();
                        if (!name || technicalNames.has(name)) return false;
                        const value = attrs[field.name];
                        return value != null && String(value).trim() !== "" && String(value).toLowerCase() !== "null";
                    })
                    .map(field => {
                        const value = resolvePopupValue(field.name, attrs, attrs[field.name]);
                        return `
                            <tr>
                                <th style="text-align:left; padding:4px 8px 4px 0; vertical-align:top;">${field.alias || field.name}</th>
                                <td style="padding:4px 0; vertical-align:top;">${String(value)}</td>
                            </tr>
                        `;
                    });
                return rows.length
                    ? `<table style="border-collapse:collapse; width:100%;">${rows.join("")}</table>`
                    : "<p>Sin atributos descriptivos disponibles.</p>";
            }
        };
    }

    function ensureEducationPopupTemplate(layer, options = {}) {
        const popupMode = options.formatNumericValues ? "tourism" : "default";
        if (!layer || layer.__educationPopupConfigured === popupMode) return;
        layer.popupEnabled = true;
        layer.popupTemplate = buildEducationPopupTemplate(layer, options);
        layer.__educationPopupConfigured = popupMode;
    }

    function updateChartHighlight(selectedFields = []) {
        const chart = chartCore.getInstance();
        if (!chart) return;
        const selectedSet = new Set((selectedFields || []).map(value => String(value)));
        const rows = [...chartCore.getRowsByLabel().values()];
        const dataset = chart.data?.datasets?.[0];
        if (!dataset) return;
        const hasSelection = selectedSet.size > 0;
        dataset.backgroundColor = rows.map(row =>
            !hasSelection || selectedSet.has(String(row.rawLabel)) ? solidChartColor(row.color) : fadeColor(row.color)
        );
        dataset.borderColor = rows.map(row =>
            hasSelection && selectedSet.has(String(row.rawLabel)) ? "#0f172a" : solidChartColor(row.color)
        );
        dataset.borderWidth = rows.map(row =>
            hasSelection && selectedSet.has(String(row.rawLabel)) ? 2 : 1
        );
        chart.update();
    }

    async function applyEducationLegendSelection(activeCodes = null) {
        const view = getView?.();
        const layer = activeEducationLayer;
        const chartConfig = activeEducationChartConfig;
        if (!view || !layer || !chartConfig) return;

        const normalizedCodes = Array.isArray(activeCodes)
            ? activeCodes.map(value => String(value ?? "").trim()).filter(Boolean)
            : null;
        const hasExplicitSelection = Array.isArray(normalizedCodes);
        const featureCode = String(layer.__educationFeatureCode || "").trim();
        const visible = !hasExplicitSelection
            ? true
            : normalizedCodes.length === 0
                ? false
                : (!featureCode || normalizedCodes.includes(featureCode));

        try {
            const layerView = await view.whenLayerView(layer);
            layerView.filter = visible ? null : { where: "1=0" };
        } catch (_) {}
    }

    async function applyHealthLegendSelection(activeCodes = null) {
        const view = getView?.();
        const layer = activeEducationLayer;
        if (!view || !layer) return;

        const normalizedCodes = Array.isArray(activeCodes)
            ? activeCodes.map(value => String(value ?? "").trim()).filter(Boolean)
            : null;
        const hasExplicitSelection = Array.isArray(normalizedCodes);
        const shouldShowLayer = !hasExplicitSelection || normalizedCodes.length > 0;

        try {
            const layerView = await view.whenLayerView(layer);
            layerView.filter = shouldShowLayer ? null : { where: "1=0" };
        } catch (_) {}
    }

    function validateFields(layer, chartConfig) {
        const fieldNames = new Set((layer?.fields || []).map(field => String(field?.name || "").toLowerCase()));
        const configuredRequiredFields = Object.values(chartConfig?.requiredFields || {})
            .map(field => field?.name)
            .filter(Boolean);
        const requiredFields = configuredRequiredFields.length
            ? configuredRequiredFields
            : (chartConfig?.categoryFields || []);
        const missing = requiredFields.filter(field => !fieldNames.has(String(field).toLowerCase()));
        if (missing.length) {
            throw new Error(`La configuración del gráfico requiere campos no disponibles en la capa: ${missing.join(", ")}`);
        }
    }

    function readablePlace(attrs = {}) {
        const selectOptionLabel = (selectId, value) => {
            const option = document.querySelector(`#${selectId} option[value="${CSS.escape(String(value ?? ""))}"]`);
            return option?.textContent?.trim() || "";
        };

        const mpCode = attrs.mpcodigo;
        const dpCode = attrs.dpcodigo || String(mpCode || "").slice(0, 2);
        const mpCodeText = String(mpCode || "").trim();
        const municipality = /^\d{5}$/.test(String(attrs.mpnombre || "")) || !attrs.mpnombre
            ? selectOptionLabel("municipios", mpCode)
            : attrs.mpnombre;
        const department = /^\d{2}$/.test(String(attrs.dpnombre || "")) || !attrs.dpnombre
            ? selectOptionLabel("departamentos", dpCode)
            : attrs.dpnombre;
        const categoryLabels = {
            "1": "Departamento",
            "2": "Municipio",
            "3": "Distrito"
        };
        let category = categoryLabels[String(attrs.mpcategor)] || String(attrs.mpcategor || "Municipio");
        if (/^\d{5}$/.test(mpCodeText) && String(attrs.mpcategor) !== "3") {
            category = "Municipio";
        } else if (/^\d{2}$/.test(mpCodeText)) {
            category = "Departamento";
        }
        return {
            mpcategor: category,
            mpnombre: municipality || attrs.mpnombre || "",
            dpnombre: department || attrs.dpnombre || ""
        };
    }

    function resolveTitle(chartConfig, config, attrs = {}) {
        if (!chartConfig?.titleTemplate) return chartConfig?.title || config?.title;
        const place = readablePlace(attrs);
        return chartConfig.titleTemplate.replace(/\{(\w+)\}/g, (_, key) => place[key] || attrs[key] || "");
    }

    function resolveTypologiaMessage(chartConfig, attrs = {}) {
        const template = String(chartConfig?.emptyTypologiaTemplate || "").trim()
            || "Este {mpcategor} no registra datos sobre información turística.";
        const place = readablePlace(attrs);
        return template.replace(/\{(\w+)\}/g, (_, key) => place[key] || attrs[key] || "");
    }

    function isTourismTypologyValid(attrs, chartConfig) {
        const field = chartConfig?.typologiaField || "tipologiatur";
        const raw = attrs?.[field];
        const n = Number(raw);
        return Number.isFinite(n) && n !== 0;
    }

    function getCanvasPointer(chart, event) {
        const native = event?.native || event;
        const canvas = chart?.canvas;
        if (!native || !canvas) return null;

        const rect = canvas.getBoundingClientRect?.();
        if (rect?.width && rect?.height
            && Number.isFinite(Number(native.clientX))
            && Number.isFinite(Number(native.clientY))) {
            return {
                x: Number(native.clientX) - rect.left,
                y: Number(native.clientY) - rect.top
            };
        }

        if (Number.isFinite(native.offsetX) && Number.isFinite(native.offsetY)) {
            return { x: native.offsetX, y: native.offsetY };
        }

        if (window.Chart?.helpers?.getRelativePosition) {
            try {
                return window.Chart.helpers.getRelativePosition(native, chart);
            } catch (_) {}
        }

        return null;
    }

    function resolveTourismLabelFromXAxis(chart, event) {
        const xScale = chart?.scales?.x;
        const labels = chart?.data?.labels || [];
        const pointer = getCanvasPointer(chart, event);
        if (!pointer || !xScale || !labels.length) return "";

        const pointerX = pointer.x;
        const pointerY = pointer.y;
        const canvasHeight = chart?.canvas?.height || chart?.height || 0;

        if (!Number.isFinite(pointerX) || !Number.isFinite(pointerY)) return "";
        if (pointerX < xScale.left || pointerX > xScale.right) return "";
        if (pointerY < 0 || pointerY > Math.max(canvasHeight, xScale.bottom || 0)) return "";

        let bestIndex = -1;
        let bestDistance = Number.POSITIVE_INFINITY;
        labels.forEach((_, index) => {
            const pixel = xScale.getPixelForTick(index);
            const distance = Math.abs(pointerX - pixel);
            if (distance < bestDistance) {
                bestDistance = distance;
                bestIndex = index;
            }
        });

        const tickTolerance = Math.max(28, Math.min(90, (xScale.width || 0) / Math.max(labels.length, 1) / 2));
        return bestIndex >= 0 && bestDistance <= tickTolerance ? labels[bestIndex] : "";
    }

    function resolveTourismLabelForPointer(chart, event, elements = []) {
        const directIndex = elements?.[0]?.index;
        if (directIndex != null) {
            const directLabel = chart?.data?.labels?.[directIndex] || "";
            if (directLabel) return directLabel;
        }

        const nativeEvent = event?.native || event;
        const nearest = typeof chart?.getElementsAtEventForMode === "function"
            ? chart.getElementsAtEventForMode(nativeEvent, "nearest", { intersect: false, axis: "x" }, true)
            : [];
        const nearestIndex = nearest?.[0]?.index;
        if (nearestIndex != null) {
            const nearestLabel = chart?.data?.labels?.[nearestIndex] || "";
            if (nearestLabel) return nearestLabel;
        }

        const axisLabel = resolveTourismLabelFromXAxis(chart, event);
        if (axisLabel) return axisLabel;

        const hoverIsFresh = lastTourismHoverLabel && (Date.now() - lastTourismHoverAt) < 1500;
        return hoverIsFresh ? lastTourismHoverLabel : "";
    }

    function resolveRows(layer, chartConfig, attrs = {}) {
        const fieldInfoByName = new Map((layer?.fields || []).map(field => [String(field?.name || "").toLowerCase(), field]));

        return (chartConfig?.categoryFields || []).map((fieldName, index) => {
            const fieldInfo = fieldInfoByName.get(String(fieldName).toLowerCase());
            const parsed = Number(attrs[fieldName]);
            const rawValue = Number.isFinite(parsed)
                ? parsed
                : (chartConfig.id === TURISMO_CHART_ID ? 0 : NaN);
            if (!Number.isFinite(rawValue)) {
                throw new Error(`El campo ${fieldName} debe contener un valor numerico para el gráfico.`);
            }
            const rendererCode = chartConfig?.categoryRendererCodes?.[fieldName];
            const alias = String(chartConfig?.categoryLabels?.[fieldName] || fieldInfo?.alias || fieldName).trim();
            const color = solidChartColor(
                chartConfig?.categoryColors?.[fieldName]
                || codeToCssColor(rendererCode)
                || CATEGORY_COLOR_STOPS[index % CATEGORY_COLOR_STOPS.length]
            );
            return {
                rawLabel: fieldName,
                label: alias,
                rendererCode: rendererCode ? String(rendererCode) : "",
                rendererLabel: rendererCode ? rendererLabelForCode(rendererCode) : "",
                value: rawValue,
                color,
                attributes: {
                    ...attrs,
                    [chartConfig?.yAxis?.field || "cantidad"]: rawValue,
                    [chartConfig?.xAxis?.field || "categoria"]: fieldName
                }
            };
        }).filter(row => {
            if (!row.label) return false;
            return chartConfig?.includeZeroCategories ? Number.isFinite(row.value) : Number.isFinite(row.value) && row.value > 0;
        });
    }

    function extractEducationParagraph(value, fallbackMessage) {
        const text = String(value || "").trim();
        if (!text) return fallbackMessage;
        const normalized = text.replace(/\r\n/g, "\n");
        const paragraphs = normalized
            .split(/\n\s*\n/)
            .map(item => item.replace(/\s+/g, " ").trim())
            .filter(Boolean);
        const match = paragraphs.find(item => /^En educaci[oó]n/i.test(item));
        return match || fallbackMessage;
    }

    async function openLayerPopup(layer, where, { preserveView = false, keepHighlight = false } = {}) {
        const view = getView?.();
        if (!view || !layer?.createQuery) return;
        ensureEducationPopupTemplate(layer, {
            formatNumericValues: NUMERIC_POPUP_FORMAT_CHART_IDS.has(activeEducationChartConfig?.id)
        });

        const query = layer.createQuery();
        query.where = where;
        query.outFields = ["*"];
        query.returnGeometry = true;
        query.num = 1;
        const result = await layer.queryFeatures(query);
        const feature = result?.features?.[0];
        if (!feature?.geometry) return;

        const currentHighlight = getHighlightHandle?.();
        currentHighlight?.remove?.();
        setHighlightHandle?.(null);

        if (keepHighlight) {
            try {
                const layerView = await view.whenLayerView(layer);
                const objectIdField = layer.objectIdField || "OBJECTID";
                const objectId = feature.attributes?.[objectIdField];
                if (objectId != null) {
                    setHighlightHandle?.(layerView.highlight([objectId]));
                }
            } catch (_) {}
        }

        if (!preserveView) {
            await view.goTo(feature.geometry, { duration: 600 }).catch(() => {});
        }
        const popupLocation = feature.geometry?.extent?.center || feature.geometry?.centroid || feature.geometry;
        view.popup.open({
            features: [feature],
            location: popupLocation
        });
    }

    async function actualizarGrafica(layer, config) {
        const chartConfig = config?.chartConfig;
        if (!chartConfig || !ATTRIBUTE_CATEGORY_CHART_IDS.has(chartConfig.id)) return false;

        const canvas = document.getElementById("chart");
        if (!canvas) return true;

        const isDepartmentWithoutMunicipality = chartConfig.allowDepartmentPopup === true
            && getFiltroNivel?.() === "DEPTO"
            && !String(getMunicipioActual?.() || "").trim();

        if (isDepartmentWithoutMunicipality) {
            chartCore.destroyChart();
            await layer?.when?.();
            ensureEducationPopupTemplate(layer, {
                formatNumericValues: NUMERIC_POPUP_FORMAT_CHART_IDS.has(chartConfig.id)
            });
            setChartTitle(chartConfig.title || config.title);
            setChartStatus(canvas, MUNICIPALITY_REQUIRED_CHART_MESSAGE);
            canvas.style.setProperty("display", "none", "important");
            if (chartConfig.id === TURISMO_CHART_ID) {
                hideTourismRequirementPanels();
                applyTourismLayoutMode(false);
            }
            return true;
        }

        hideTourismRequirementPanels();
        chartCore.destroyChart();
        prepareVisibleChartCanvas(canvas);
        setChartTitle(chartConfig.title || config.title);
        setChartStatus(canvas, "Cargando gráfico...");

        if (typeof Chart === "undefined") {
            setChartStatus(canvas, "Chart.js no está cargado.");
            return true;
        }

        await layer.when?.();
        ensureEducationPopupTemplate(layer, {
            formatNumericValues: NUMERIC_POPUP_FORMAT_CHART_IDS.has(chartConfig.id)
        });
        validateFields(layer, chartConfig);

        const where = buildWhere(chartConfig);
        const query = layer.createQuery();
        query.where = where;
        query.outFields = chartConfig.fields;
        query.returnGeometry = true;
        query.num = 1;
        const result = await layer.queryFeatures(query);
        const feature = result?.features?.[0];
        if (!feature) {
            setChartStatus(canvas, "Seleccione un municipio para ver la información.");
            return true;
        }

        const attrs = feature.attributes || {};
        activeEducationLayer = layer;
        activeEducationWhere = where;
        activeEducationChartConfig = chartConfig;
        layer.__educationFeatureCode = String(attrs?.[chartConfig.mapInteractionField || "mpcracdm"] ?? "").trim();
        if (chartConfig.id === TURISMO_CHART_ID) {
            applyTourismLayoutMode(true);
            window.__educationSummaryTransform = null;
            if (!isTourismTypologyValid(attrs, chartConfig)) {
                chartCore.destroyChart();
                prepareVisibleChartCanvas(canvas);
                setChartTitle(chartConfig.title || config.title);
                setChartStatus(canvas, resolveTypologiaMessage(chartConfig, attrs));
                await refreshTourismRendererLegend(layer, chartConfig, where);
                return true;
            }
        } else {
            window.__educationSummaryTransform = extractEducationParagraphSafe;
        }

        const rows = resolveRows(layer, chartConfig, attrs);
        if (!rows.length) {
            const emptyMsg = chartConfig.id === TURISMO_CHART_ID
                ? "No hay datos de infraestructura turística para el municipio seleccionado."
                : "No hay instituciones registradas para el municipio seleccionado.";
            setChartStatus(canvas, emptyMsg);
            if (chartConfig.id === TURISMO_CHART_ID) {
                await refreshTourismRendererLegend(layer, chartConfig, where);
            }
            return true;
        }

        chartCore.setRows(rows);
        window.__chartLegendOrder = rows.map(row => ({
            code: row.rawLabel,
            label: row.label,
            color: row.color
        }));

        if (typeof window.actualizarLeyenda === "function" && chartConfig.id !== TURISMO_CHART_ID) {
            if (isHealthChart(chartConfig)) {
                const healthLegendItem = resolveHealthLegendItem(attrs, chartConfig);
                window.actualizarLeyenda(
                    healthLegendItem ? [healthLegendItem.label] : [],
                    healthLegendItem ? [healthLegendItem.color] : [],
                    healthLegendItem ? [healthLegendItem.code] : [],
                    {
                        field: chartConfig.legendField || "no_prestadores",
                        baseWhere: where,
                        layers: [layer],
                        symbols: healthLegendItem ? [healthLegendItem.symbol] : [],
                        preserveOrder: true,
                        customApply: async (state) => {
                            const activeCodes = state?.activeCodes instanceof Set
                                ? [...state.activeCodes].map(value => String(value))
                                : null;
                            await applyHealthLegendSelection(activeCodes);
                        }
                    }
                );
            } else {
                const municipalityRendererCode = String(attrs?.[chartConfig.legendField || chartConfig.mapInteractionField || "mpcracdm"] ?? "").trim();
                const municipalityRendererLabel = rendererLabelForCode(municipalityRendererCode) || "Caracter academico";
                const municipalityRendererColor = codeToCssColor(municipalityRendererCode) || rows[0]?.color || "#999";
                window.actualizarLeyenda(
                    municipalityRendererCode ? [municipalityRendererLabel] : [],
                    municipalityRendererCode ? [municipalityRendererColor] : [],
                    municipalityRendererCode ? [municipalityRendererCode] : [],
                    {
                        field: chartConfig.legendField || chartConfig.mapInteractionField || null,
                        baseWhere: where,
                        layers: [layer],
                        preserveOrder: true,
                        customApply: async (state) => {
                            const activeCodes = state?.activeCodes instanceof Set
                                ? [...state.activeCodes].map(value => String(value))
                                : null;
                            await applyEducationLegendSelection(activeCodes);
                        }
                    }
                );
            }
        }

        setChartStatus(canvas, "");
        setChartTitle(resolveTitle(chartConfig, config, attrs));

        const place = readablePlace(attrs);
        const baseChartOptions = createBarChartOptions({
            chartConfig,
            labels: rows.map(row => row.label),
            rowsByLabel: chartCore.getRowsByLabel(),
            onBarClick: async label => {
                const row = chartCore.getRowsByLabel().get(label);
                if (!row) return;
                chartCore.setSelectedLabel(label);
                const dataset = chart.data.datasets?.[0];
                if (dataset) {
                    dataset.backgroundColor = rows.map(item => item.label === label ? solidChartColor(item.color) : fadeColor(item.color));
                    dataset.borderColor = rows.map(item => item.label === label ? "#0f172a" : solidChartColor(item.color));
                    dataset.borderWidth = rows.map(item => item.label === label ? 2 : 1);
                    chart.update();
                }
                if (chartConfig.id === TURISMO_CHART_ID) {
                    await toggleTourismRequirementPanel(chartConfig, row.rawLabel, row, place, {
                        attrs,
                        layer,
                        where,
                        openLayerPopup,
                        preserveViewOnPopup: chartConfig.preserveViewOnPopup
                    });
                    return;
                }
                if (isHealthChart(chartConfig)) {
                    await openLayerPopup(layer, where, {
                        preserveView: Boolean(chartConfig.preserveViewOnPopup),
                        keepHighlight: false
                    });
                    return;
                }
                // This layer is aggregated at municipality level, so clicking a bar must not
                // hide the only rendered feature when the bar category differs from mpcracdm.
                await applyEducationLegendSelection(null);
                await openLayerPopup(layer, where, {
                    preserveView: Boolean(chartConfig.preserveViewOnPopup)
                });
            }
        });
        const chartOptions = chartConfig.id === TURISMO_CHART_ID
            ? {
                ...baseChartOptions,
                layout: {
                    ...(baseChartOptions.layout || {}),
                    padding: {
                        top: 8,
                        right: 12,
                        bottom: 8,
                        left: 12
                    }
                },
                interaction: {
                    mode: "nearest",
                    intersect: false,
                    axis: "x"
                },
                onClick() {},
                onHover(event, elements, chartInstance) {
                    const label = resolveTourismLabelForPointer(chartInstance, event, elements);
                    const interactive = Boolean(chartCore.getRowsByLabel().get(label));
                    if (interactive) {
                        lastTourismHoverLabel = label;
                        lastTourismHoverAt = Date.now();
                    }
                    if (event?.native?.target) {
                        event.native.target.style.cursor = interactive ? "pointer" : "default";
                    }
                }
            }
            : baseChartOptions;
        destroyCanvasChart(canvas);
        const defaultDataLabelPlugin = {
            id: `${chartConfig.id || "attribute-category"}-data-labels`,
            afterDatasetsDraw(chartInstance) {
                const ctx = chartInstance.ctx;
                const meta = chartInstance.getDatasetMeta(0);
                const dataset = chartInstance.data?.datasets?.[0];
                ctx.save();
                ctx.fillStyle = "#334155";
                ctx.font = "600 11px Outfit, sans-serif";
                ctx.textAlign = "center";
                ctx.textBaseline = "bottom";
                (meta?.data || []).forEach((element, index) => {
                    const value = Number(dataset?.data?.[index]);
                    if (!Number.isFinite(value)) return;
                    const position = element.tooltipPosition?.();
                    if (!position) return;
                    const topLimit = (chartInstance.chartArea?.top || 0) + 14;
                    ctx.fillText(value.toLocaleString("es-CO"), position.x, Math.max(topLimit, position.y - 6));
                });
                ctx.restore();
            }
        };
        const dataLabelPlugin = ADAPTIVE_BOX_LABEL_CHART_IDS.has(chartConfig.id)
            ? createAdaptiveBarValueLabelsPlugin({
                id: `${chartConfig.id}-adaptive-box-labels`,
                formatValue: value => Number(value).toLocaleString("es-CO")
            })
            : defaultDataLabelPlugin;

        const chart = new Chart(canvas, {
            type: "bar",
            data: {
                labels: rows.map(row => row.label),
                datasets: [createDefaultBarDataset({
                    label: chartConfig.title || config.title,
                    data: rows.map(row => row.value),
                    rows,
                    colors: {
                        background: rows.map(row => solidChartColor(row.color)),
                        border: null
                    }
                })]
            },
            options: chartOptions,
            plugins: [dataLabelPlugin]
        });

        if (chartConfig.id === TURISMO_CHART_ID) {
            await refreshTourismRendererLegend(layer, chartConfig, where);
            if (canvas.__tourismCategoryClickHandler) {
                canvas.removeEventListener("pointerdown", canvas.__tourismCategoryClickHandler);
                canvas.removeEventListener("click", canvas.__tourismCategoryClickHandler);
            }
            canvas.__tourismCategoryClickHandler = async nativeEvent => {
                const label = resolveTourismLabelForPointer(chart, { native: nativeEvent }, []);
                const row = chartCore.getRowsByLabel().get(label);
                if (!row) return;

                chartCore.setSelectedLabel(label);
                const dataset = chart.data.datasets?.[0];
                if (dataset) {
                    dataset.backgroundColor = rows.map(item => item.label === label ? solidChartColor(item.color) : fadeColor(item.color));
                    dataset.borderColor = rows.map(item => item.label === label ? "#0f172a" : solidChartColor(item.color));
                    dataset.borderWidth = rows.map(item => item.label === label ? 2 : 1);
                    chart.update();
                }
                await toggleTourismRequirementPanel(chartConfig, row.rawLabel, row, place, {
                    attrs,
                    layer,
                    where,
                    openLayerPopup,
                    preserveViewOnPopup: chartConfig.preserveViewOnPopup
                });
            };
            canvas.addEventListener("pointerdown", canvas.__tourismCategoryClickHandler);
        }

        chartCore.setInstance(chart);
        return true;
    }

    function prepareChartPanelForConfig(config) {
        if (!config?.chartConfig || !ATTRIBUTE_CATEGORY_CHART_IDS.has(config.chartConfig.id)) return false;
        const canvas = document.getElementById("chart");
        if (!canvas) return true;
        hideTourismRequirementPanels();
        applyTourismLayoutMode(config.chartConfig.id === TURISMO_CHART_ID);
        if (config.chartConfig.allowDepartmentPopup === true
            && getFiltroNivel?.() === "DEPTO"
            && !String(getMunicipioActual?.() || "").trim()) {
            chartCore.destroyChart();
            setChartTitle(config.chartConfig.title || config.title);
            setChartStatus(canvas, MUNICIPALITY_REQUIRED_CHART_MESSAGE);
            canvas.style.setProperty("display", "none", "important");
            return true;
        }
        prepareVisibleChartCanvas(canvas);
        setChartTitle(config.chartConfig.title || config.title);
        setChartStatus(canvas, "Cargando gráfico...");
        return true;
    }

    return {
        actualizarGrafica,
        prepareChartPanelForConfig,
        async handleMapClick(event, config) {
            const chartConfig = config?.chartConfig;
            const view = getView?.();
            if (!view || !activeEducationLayer || !chartConfig) return;
            const hit = await view.hitTest(event);
            const graphic = hit?.results
                ?.map(result => result.graphic)
                ?.find(item => item?.layer === activeEducationLayer);
            if (!graphic) return;
            if (isHealthChart(chartConfig)) {
                updateChartHighlight(resolveDominantCategoryFields(graphic.attributes || {}, chartConfig));
                return;
            }
            const rendererCode = String(graphic?.attributes?.[chartConfig.mapInteractionField || "mpcracdm"] ?? "").trim();
            if (!rendererCode) return;
            updateChartHighlight(categoryFieldsForCode(rendererCode, chartConfig));
        },
        extractEducationParagraph,
        isAttributeCategoryChart: chartConfig => ATTRIBUTE_CATEGORY_CHART_IDS.has(chartConfig?.id),
        hideAttributeCategoryExtras: hideTourismRequirementPanels
    };
}
