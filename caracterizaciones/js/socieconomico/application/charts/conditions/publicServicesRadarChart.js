import { getChartBaseWhere } from "../core/chartUtils.js?v=travel-time-pie-20260511";
import { getChartSymbolLookups, getRendererVisualForValue } from "../core/chartSymbolUtils.js?v=travel-time-pie-20260511";
import { prepareVisibleChartCanvas, setChartTitle } from "../ui/chartPanel.js?v=local-chart-title-20260529";
import { setChartStatus } from "../ui/chartStatus.js";
import { destroyCanvasChart } from "../core/chartLifecycle.js";

const DEFAULT_SETTLEMENT_LABELS = {
    "14091": "Rural",
    "14092": "Urbano"
};

const DEFAULT_RANGE_LABELS = {
    "1": "[0% - 15%]",
    "2": "[15%-30%]",
    "3": "[30%-45%]",
    "4": "[45%-60%]",
    "5": "[60%-75%]",
    "6": "[75%-90%]",
    "7": "[90%-100%]"
};

const FALLBACK_DATASET_COLORS = {
    "14091": "rgba(14, 116, 144, 0.88)",
    "14092": "rgba(21, 128, 61, 0.88)"
};

const DEFAULT_TELECOM_COLORS = [
    "rgba(14, 116, 144, 0.92)",
    "rgba(21, 128, 61, 0.92)",
    "rgba(217, 119, 6, 0.92)",
    "rgba(148, 163, 184, 0.92)"
];

const SPECIAL_AREA_DEPARTMENTS = new Set([
    "amazonas",
    "guainia",
    "vaupes",
    "area en litigio cauca - huila"
]);

function normalizeText(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function toInteger(value) {
    const normalized = String(value ?? "")
        .replace(/\./g, "")
        .replace(/,/g, ".")
        .replace(/[^\d.-]/g, "")
        .trim();
    const numericValue = Number(normalized);
    return Number.isFinite(numericValue) ? Math.max(0, Math.round(numericValue)) : 0;
}

function formatInteger(value) {
    return toInteger(value).toLocaleString("es-CO", {
        maximumFractionDigits: 0
    });
}

function toOpaqueBorder(color) {
    const rgba = String(color || "").match(/rgba?\(([^)]+)\)/i);
    if (!rgba) return color || "#335";
    const parts = rgba[1].split(",").map(part => part.trim());
    if (parts.length < 3) return color || "#335";
    return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, 1)`;
}

function toSoftFill(color, alpha = 0.18) {
    const rgba = String(color || "").match(/rgba?\(([^)]+)\)/i);
    if (!rgba) return color || "#ccc";
    const parts = rgba[1].split(",").map(part => part.trim());
    if (parts.length < 3) return color || "#ccc";
    return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
}

function modeValue(values = []) {
    const counts = new Map();
    values.forEach(value => {
        const numericValue = Number(value);
        if (!Number.isFinite(numericValue)) return;
        counts.set(numericValue, (counts.get(numericValue) || 0) + 1);
    });
    let bestValue = null;
    let bestCount = -1;
    counts.forEach((count, value) => {
        if (count > bestCount || (count === bestCount && Number(value) > Number(bestValue))) {
            bestValue = value;
            bestCount = count;
        }
    });
    return bestValue;
}

function selectOptionLabel(selectId, value) {
    const option = document.querySelector(`#${selectId} option[value="${CSS.escape(String(value ?? ""))}"]`);
    return option?.textContent?.trim() || "";
}

function fieldByName(layer, fieldName) {
    return (layer?.fields || []).find(field =>
        String(field?.name || "").toLowerCase() === String(fieldName || "").toLowerCase()
    ) || null;
}

function codedDomainLabel(fieldInfo, value) {
    const codedValues = fieldInfo?.domain?.codedValues || [];
    const hit = codedValues.find(item => String(item.code) === String(value));
    return String(hit?.name || "").trim();
}

function readablePlace(attrs = {}) {
    const mpCode = String(attrs.mpcodigo || "").trim();
    const dpCode = String(attrs.dpcodigo || mpCode.slice(0, 2) || "").trim();
    const municipality = /^\d{5}$/.test(String(attrs.mpnombre || "")) || !attrs.mpnombre
        ? selectOptionLabel("municipios", mpCode)
        : String(attrs.mpnombre || "").trim();
    const department = /^\d{2}$/.test(String(attrs.dpnombre || "")) || !attrs.dpnombre
        ? selectOptionLabel("departamentos", dpCode)
        : String(attrs.dpnombre || "").trim();
    const rawCategory = String(attrs.mpcategor || "").trim();
    const categoryLookup = {
        "1": "Departamento",
        "2": "Municipio",
        "3": "Distrito"
    };
    return {
        mpcodigo: mpCode,
        mpcategor: categoryLookup[rawCategory] || rawCategory || "Municipio",
        mpnombre: municipality || String(attrs.mpnombre || "").trim(),
        dpnombre: department || String(attrs.dpnombre || "").trim()
    };
}

function isCapitalMunicipality(place = {}, attrs = {}) {
    const code = String(place.mpcodigo || attrs.mpcodigo || "").trim();
    return /^\d{5}$/.test(code) && code.endsWith("001");
}

function isSpecialArea(place = {}) {
    const department = normalizeText(place.dpnombre);
    const municipality = normalizeText(place.mpnombre);
    const category = normalizeText(place.mpcategor);
    return SPECIAL_AREA_DEPARTMENTS.has(department) && (
        municipality.includes("area no municipalizada") ||
        municipality.includes("corregimiento departamental") ||
        category.includes("area") ||
        category.includes("corregimiento")
    );
}

function resolveTitle(chartConfig, attrs = {}) {
    const place = readablePlace(attrs);
    const template = isCapitalMunicipality(place, attrs)
        ? chartConfig?.titleTemplateCapital
        : chartConfig?.titleTemplateMunicipality;
    return String(template || chartConfig?.title || "Servicios públicos")
        .replace(/\{(\w+)\}/g, (_, key) => place[key] || attrs[key] || "");
}

function resolveTelecomTitle(templateMunicipality, templateCapital, attrs = {}) {
    const place = readablePlace(attrs);
    const template = isCapitalMunicipality(place, attrs)
        ? templateCapital
        : templateMunicipality;
    return String(template || "")
        .replace(/\{(\w+)\}/g, (_, key) => place[key] || attrs[key] || "");
}

function resolveTelecomPalette(rendererLookups = {}, count = 4) {
    const colors = [];
    const pushColor = (value) => {
        if (!value) return;
        const color = toOpaqueBorder(value);
        if (!colors.includes(color)) colors.push(color);
    };

    if (rendererLookups?.colorByValue instanceof Map) {
        rendererLookups.colorByValue.forEach(color => pushColor(color));
    }
    pushColor(rendererLookups?.defaultColor);

    DEFAULT_TELECOM_COLORS.forEach(pushColor);
    return colors.slice(0, Math.max(2, count));
}

function buildTelecomNarrative(place, municipalityValues) {
    return `En cuanto al acceso a telecomunicaciones ${place.mpnombre} registra ${formatInteger(municipalityValues.total_internet_fijo)} suscripciones a internet fijo y ${formatInteger(municipalityValues.total_emisoras)} emisoras de radio, que en conjunto se aproximan al conocimiento de las condiciones de calidad de vida de la poblacion y cuyas limitantes de acceso afectan el desarrollo humano sostenible, por consiguiente, el fortalecimiento de la capacidad institucional de los territorios debera garantizar el acceso equitativo de la poblacion a servicios basicos.`;
}

const TELECOM_QUERY_TIMEOUT_MS = 90000;
const TELECOM_UNAVAILABLE_MESSAGE = "La información de telecomunicaciones no se encuentra disponible en el servicio.";

function withTimeout(promise, ms, message) {
    let timeoutId = null;
    const timeout = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

async function queryServiceJson(serviceUrl, queryOptions = {}, timeoutMessage = "La consulta no respondio a tiempo.") {
    if (!serviceUrl) throw new Error("No hay URL de servicio para consultar.");
    const params = new URLSearchParams({
        f: "json",
        where: queryOptions.where || "1=1",
        outFields: Array.isArray(queryOptions.outFields) && queryOptions.outFields.length
            ? queryOptions.outFields.join(",")
            : "*",
        returnGeometry: queryOptions.returnGeometry ? "true" : "false"
    });
    if (queryOptions.resultRecordCount) {
        params.set("resultRecordCount", String(queryOptions.resultRecordCount));
    }
    const timeoutMs = Number.isFinite(Number(queryOptions.timeoutMs))
        ? Number(queryOptions.timeoutMs)
        : 15000;
    const response = await withTimeout(
        fetch(`${serviceUrl}/query?${params.toString()}`, { cache: "no-store" }),
        timeoutMs,
        timeoutMessage
    );
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    if (payload?.error) {
        throw new Error(payload.error.message || "Consulta ArcGIS inválida.");
    }
    return payload;
}

function installRadarLayout(canvas) {
    const chartScroll = document.getElementById("pibChartScroll");
    const chartCard = canvas?.closest(".chart-card");
    if (chartScroll) {
        chartScroll.style.overflowX = "hidden";
        chartScroll.style.overflowY = "hidden";
        chartScroll.classList.remove("is-scrollable");
    }
    if (chartCard) {
        chartCard.classList.remove("chart-scrollable");
        chartCard.style.overflowX = "hidden";
    }
    canvas.style.setProperty("width", "100%", "important");
    canvas.style.setProperty("min-width", "0", "important");
    canvas.style.setProperty("max-width", "100%", "important");
    canvas.style.setProperty("height", "390px", "important");
    canvas.style.setProperty("min-height", "390px", "important");
    const parentWidth = chartScroll?.clientWidth || chartCard?.clientWidth || canvas.clientWidth || 360;
    canvas.width = Math.max(300, Math.floor(parentWidth));
    canvas.height = 390;
}

function usesRendererLegend(config = {}) {
    return Boolean(config?.forceRendererLegend || config?.chartConfig?.legendDrivenByMapRenderer);
}

export function createPublicServicesRadarChartController({
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
}) {
    let allDatasets = [];
    let selectedSettlementCode = null;
    let telecomDoughnutChart = null;
    let telecomRadioChart = null;

    function buildTelecomWhereVariants(fieldName, code) {
        const field = String(fieldName || "").trim();
        const value = String(code ?? "").trim();
        if (!field || !value) return [];
        const escaped = value.replace(/'/g, "''");
        const variants = [`${field} = '${escaped}'`];
        if (/^\d+$/.test(value)) {
            variants.push(`${field} = ${Number(value)}`);
        }
        return [...new Set(variants)];
    }

    function hasUsableTelecomAttributes(attrs) {
        return Boolean(attrs && typeof attrs === "object" && Object.keys(attrs).length);
    }

    async function queryTelecomRow(serviceUrl, fieldName, code, requiredFields = []) {
        const outFields = [...new Set(requiredFields)].filter(Boolean);
        const whereAttempts = buildTelecomWhereVariants(fieldName, code);
        let lastError = null;

        for (const where of whereAttempts) {
            try {
                const payload = await queryServiceJson(serviceUrl, {
                    where,
                    outFields: outFields.length ? outFields : ["*"],
                    returnGeometry: false,
                    resultRecordCount: 1,
                    timeoutMs: TELECOM_QUERY_TIMEOUT_MS
                }, `La consulta de telecomunicaciones no respondio a tiempo (${fieldName}=${code}).`);
                const attrs = payload?.features?.[0]?.attributes || null;
                if (hasUsableTelecomAttributes(attrs)) return attrs;
                continue;
            } catch (error) {
                lastError = error;
                console.warn(`Consulta de telecomunicaciones fallida (${where}) en ${serviceUrl}:`, error);
                if (/no respondio a tiempo/i.test(String(error?.message || "")) || !outFields.length) {
                    throw error;
                }
            }

            try {
                const payload = await queryServiceJson(serviceUrl, {
                    where,
                    outFields: ["*"],
                    returnGeometry: false,
                    resultRecordCount: 1,
                    timeoutMs: TELECOM_QUERY_TIMEOUT_MS
                }, `La consulta de telecomunicaciones no respondio a tiempo (${fieldName}=${code}).`);
                const attrs = payload?.features?.[0]?.attributes || null;
                if (hasUsableTelecomAttributes(attrs)) return attrs;
            } catch (error) {
                lastError = error;
                console.warn(`Consulta alternativa de telecomunicaciones fallida (${where}) en ${serviceUrl}:`, error);
                if (/no respondio a tiempo/i.test(String(error?.message || ""))) {
                    throw error;
                }
            }
        }

        if (lastError) throw lastError;
        return null;
    }

    async function queryTelecomRowWithFallback(serviceUrls = [], fieldName, code, requiredFields = []) {
        const urls = [...new Set([].concat(serviceUrls).filter(Boolean))];
        let lastError = null;
        for (const serviceUrl of urls) {
            try {
                const row = await queryTelecomRow(serviceUrl, fieldName, code, requiredFields);
                if (row) return row;
            } catch (error) {
                lastError = error;
                console.warn(`No se pudo consultar telecomunicaciones en ${serviceUrl}:`, error);
            }
        }
        if (lastError) throw lastError;
        return null;
    }

    function getTelecomPanels() {
        return {
            doughnutPanel: document.getElementById("pibSectorPiePanel"),
            doughnutTitle: document.getElementById("pibSectorPieTitle"),
            doughnutCanvas: document.getElementById("pibSectorPieChart"),
            doughnutStatus: document.getElementById("pibSectorPieStatus"),
            radioPanel: document.getElementById("pibEmpresasPanel"),
            radioTitle: document.getElementById("pibEmpresasTitle"),
            radioCanvas: document.getElementById("pibEmpresasChart"),
            radioStatus: document.getElementById("pibEmpresasStatus"),
            radioText: document.getElementById("pibEmpresasText")
        };
    }

    function destroyTelecomCharts() {
        const { doughnutCanvas, radioCanvas } = getTelecomPanels();
        destroyCanvasChart(doughnutCanvas);
        destroyCanvasChart(radioCanvas);
        telecomDoughnutChart = null;
        telecomRadioChart = null;
    }

    function setPublicServicesTextFlow(active = false) {
        document.querySelector("#chartDiv .chart-card")
            ?.classList.toggle("public-services-text-flow", Boolean(active));
    }

    function placePublicServicesSummaryBeforeTelecomText() {
        const summary = document.getElementById("summaryDiv");
        const radioText = document.getElementById("pibEmpresasText");
        if (!summary || !radioText?.parentNode) return;
        radioText.parentNode.insertBefore(summary, radioText);
    }

    function hideTelecomPanels() {
        setPublicServicesTextFlow(false);
        destroyTelecomCharts();
        const {
            doughnutPanel,
            doughnutTitle,
            doughnutStatus,
            radioPanel,
            radioTitle,
            radioStatus,
            radioText
        } = getTelecomPanels();
        if (doughnutPanel) doughnutPanel.hidden = true;
        if (doughnutTitle) doughnutTitle.textContent = "";
        if (doughnutStatus) {
            doughnutStatus.hidden = true;
            doughnutStatus.textContent = "";
            doughnutStatus.style.color = "";
        }
        if (radioPanel) radioPanel.hidden = true;
        if (radioTitle) radioTitle.textContent = "";
        if (radioStatus) {
            radioStatus.hidden = true;
            radioStatus.textContent = "";
            radioStatus.style.color = "";
        }
        if (radioText) {
            radioText.hidden = true;
            radioText.textContent = "";
        }
    }

    function showTelecomStatus(target, message = "") {
        if (!target) return;
        target.hidden = !message;
        target.textContent = message || "";
        target.style.color = "";
    }

    function installLegendSyncHooks(config = null) {
        const keepRendererLegend = usesRendererLegend(config);
        window.__syncChartLegendFilter = (codes = null) => {
            if (keepRendererLegend) return;
            syncDatasetsToCodes(codes);
        };
        window.__restoreChartCategoryFilter = () => {
            if (keepRendererLegend) return;
            setSelectedDataset(null);
        };
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

    function validateRequiredFields(layer, chartConfig) {
        const required = Object.values(chartConfig?.requiredFields || {}).map(item => item?.name).filter(Boolean);
        const fieldNames = new Set((layer?.fields || []).map(field => String(field?.name || "").toLowerCase()));
        const missing = required.filter(name => !fieldNames.has(String(name).toLowerCase()));
        if (missing.length) {
            throw new Error(`La configuración del gráfico requiere campos no disponibles en la capa: ${missing.join(", ")}`);
        }
    }

    function settlementLabel(fieldInfo, rawCode, chartConfig) {
        return codedDomainLabel(fieldInfo, rawCode)
            || chartConfig?.settlementLabels?.[String(rawCode)]
            || DEFAULT_SETTLEMENT_LABELS[String(rawCode)]
            || String(rawCode);
    }

    function rangeLabel(value, chartConfig) {
        return chartConfig?.rangeLabels?.[String(value)]
            || DEFAULT_RANGE_LABELS[String(value)]
            || String(value ?? "");
    }

    function resolveDatasetColor(rawCode, rendererLookups, layer, chartConfig) {
        const code = String(rawCode ?? "").trim();
        const visual = getRendererVisualForValue(layer?.renderer, code, chartConfig);
        return chartConfig?.settlementChartColors?.[code]
            || visual?.color
            || rendererLookups?.colorByValue?.get(code)
            || FALLBACK_DATASET_COLORS[code]
            || rendererLookups?.defaultColor
            || "rgba(51, 65, 85, 0.88)";
    }

    function buildDatasets(features, layer, chartConfig, rendererLookups) {
        const settlementField = chartConfig?.settlementField || chartConfig?.mapInteractionField;
        const settlementFieldInfo = fieldByName(layer, settlementField);
        const grouped = new Map();

        (features || []).forEach(feature => {
            const attrs = feature?.attributes || {};
            const rawCode = String(attrs[settlementField] ?? "").trim();
            if (!rawCode) return;
            if (!grouped.has(rawCode)) {
                grouped.set(rawCode, {
                    rawCode,
                    label: settlementLabel(settlementFieldInfo, rawCode, chartConfig),
                    attributes: attrs,
                    axisValues: new Map((chartConfig?.axes || []).map(axis => [axis.field, []]))
                });
            }

            const entry = grouped.get(rawCode);
            entry.attributes = { ...entry.attributes, ...attrs };
            (chartConfig?.axes || []).forEach(axis => {
                const rawValue = Number(attrs?.[axis.field]);
                if (!Number.isFinite(rawValue) || rawValue <= 0) return;
                entry.axisValues.get(axis.field)?.push(rawValue);
            });
        });

        const order = Object.keys(chartConfig?.settlementLabels || DEFAULT_SETTLEMENT_LABELS);
        const orderIndex = new Map(order.map((code, index) => [code, index]));

        return [...grouped.values()]
            .map(entry => {
                const color = resolveDatasetColor(entry.rawCode, rendererLookups, layer, chartConfig);
                const data = (chartConfig?.axes || []).map(axis => modeValue(entry.axisValues.get(axis.field) || []));
                return {
                    rawCode: entry.rawCode,
                    label: entry.label,
                    color,
                    borderColor: toOpaqueBorder(color),
                    backgroundColor: "rgba(0, 0, 0, 0)",
                    pointBackgroundColor: toOpaqueBorder(color),
                    pointBorderColor: "#ffffff",
                    pointHoverBackgroundColor: "#ffffff",
                    pointHoverBorderColor: toOpaqueBorder(color),
                    data,
                    attributes: entry.attributes
                };
            })
            .filter(dataset => dataset.data.some(value => Number.isFinite(Number(value))))
            .sort((a, b) => {
                const aIndex = orderIndex.has(a.rawCode) ? orderIndex.get(a.rawCode) : Number.MAX_SAFE_INTEGER;
                const bIndex = orderIndex.has(b.rawCode) ? orderIndex.get(b.rawCode) : Number.MAX_SAFE_INTEGER;
                if (aIndex !== bIndex) return aIndex - bIndex;
                return a.label.localeCompare(b.label, "es");
            });
    }

    function resolveRadarValueLabelPosition({
        point,
        centerX,
        centerY,
        rawValue,
        datasetIndex,
        datasetCount,
        radialScale
    }) {
        const dx = point.x - centerX;
        const dy = point.y - centerY;
        const distance = Math.hypot(dx, dy) || 1;
        const unitX = dx / distance;
        const unitY = dy / distance;
        const tangentX = -unitY;
        const tangentY = unitX;
        const min = Number(radialScale?.min) || 1;
        const max = Number(radialScale?.max) || 7;
        const valueRatio = (rawValue - min) / Math.max(max - min, 1);

        const radialOffset = valueRatio >= 0.85
            ? -30
            : valueRatio >= 0.65
                ? -20
                : valueRatio >= 0.35
                    ? -6
                    : 14;
        const tangentOffset = datasetCount > 1
            ? (datasetIndex - (datasetCount - 1) / 2) * 12
            : 0;

        return {
            x: point.x + unitX * radialOffset + tangentX * tangentOffset,
            y: point.y + unitY * radialOffset + tangentY * tangentOffset
        };
    }

    function createPublicServicesRadarValueLabelsPlugin(chartConfig) {
        return {
            id: "public-services-radar-value-labels",
            afterDraw(chart) {
                const { ctx, chartArea } = chart;
                const radialScale = chart.scales?.r;
                const centerX = radialScale?.xCenter;
                const centerY = radialScale?.yCenter;
                if (!Number.isFinite(centerX) || !Number.isFinite(centerY) || !chartArea) return;

                const visibleDatasetIndexes = (chart.data?.datasets || [])
                    .map((_, index) => index)
                    .filter(index => chart.isDatasetVisible(index));
                const datasetCount = visibleDatasetIndexes.length;

                visibleDatasetIndexes.forEach(datasetIndex => {
                    const dataset = chart.data.datasets[datasetIndex];
                    const meta = chart.getDatasetMeta(datasetIndex);
                    (meta?.data || []).forEach((point, index) => {
                        const rawValue = Number(dataset?.data?.[index]);
                        if (!Number.isFinite(rawValue) || rawValue <= 0) return;
                        if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return;

                        const label = rangeLabel(rawValue, chartConfig);
                        if (!label) return;

                        const visibleIndex = visibleDatasetIndexes.indexOf(datasetIndex);
                        const { x: labelX, y: labelY } = resolveRadarValueLabelPosition({
                            point,
                            centerX,
                            centerY,
                            rawValue,
                            datasetIndex: visibleIndex,
                            datasetCount,
                            radialScale
                        });

                        if (
                            labelX < chartArea.left + 4 ||
                            labelX > chartArea.right - 4 ||
                            labelY < chartArea.top + 4 ||
                            labelY > chartArea.bottom - 4
                        ) {
                            return;
                        }

                        ctx.save();
                        ctx.font = "600 10px Outfit, sans-serif";
                        ctx.textAlign = "center";
                        ctx.textBaseline = "middle";
                        ctx.lineWidth = 3;
                        ctx.strokeStyle = "rgba(255, 255, 250, 0.92)";
                        ctx.fillStyle = String(dataset?.borderColor || "#334155");
                        ctx.strokeText(label, labelX, labelY);
                        ctx.fillText(label, labelX, labelY);
                        ctx.restore();
                    });
                });
            }
        };
    }

    function createTelecomCenterLabelPlugin(getPercentText) {
        return {
            id: "telecom-center-label",
            afterDraw(chart) {
                const meta = chart.getDatasetMeta(0);
                const arc = meta?.data?.[0];
                if (!arc) return;
                const { ctx } = chart;
                const x = arc.x;
                const y = arc.y;
                ctx.save();
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillStyle = "#0f172a";
                ctx.font = "700 22px Outfit, sans-serif";
                ctx.fillText(getPercentText(), x, y - 6);
                ctx.fillStyle = "#64748b";
                ctx.font = "600 10px Outfit, sans-serif";
                ctx.fillText("Participacion", x, y + 16);
                ctx.restore();
            }
        };
    }

    function createTelecomPolarValueLabelsPlugin(values = []) {
        return {
            id: "telecom-polar-value-labels",
            afterDatasetsDraw(chart) {
                const { ctx, chartArea } = chart;
                const meta = chart.getDatasetMeta(0);
                if (!meta?.data?.length) return;

                ctx.save();
                ctx.fillStyle = "#111827";
                ctx.font = "700 22px Outfit, sans-serif";
                ctx.textBaseline = "middle";
                meta.data.forEach((arc, index) => {
                    const value = toInteger(values[index]);
                    if (value <= 0) return;
                    const label = formatInteger(value).replace(/\./g, "");
                    const angle = ((arc.startAngle || 0) + (arc.endAngle || 0)) / 2;
                    const radius = Math.max(28, (arc.outerRadius || 0) * (index === 0 ? 0.78 : 0.55));
                    const x = arc.x + Math.cos(angle) * radius;
                    const y = arc.y + Math.sin(angle) * radius;
                    const labelWidth = ctx.measureText(label).width;
                    ctx.textAlign = index === 0 ? "left" : "center";
                    ctx.fillText(
                        label,
                        Math.min(chartArea.right - labelWidth - 4, Math.max(chartArea.left + 4, x)),
                        Math.min(chartArea.bottom - 14, Math.max(chartArea.top + 14, y))
                    );
                });
                ctx.restore();
            }
        };
    }

    function createTelecomRadioTotalsPlugin() {
        return {
            id: "telecom-radio-totals",
            afterDatasetsDraw(chart) {
                const { ctx, chartArea } = chart;
                const labels = chart.data?.labels || [];
                ctx.save();
                ctx.textAlign = "center";
                ctx.textBaseline = "bottom";
                ctx.fillStyle = "#334155";
                ctx.font = "600 10px Outfit, sans-serif";
                labels.forEach((_, index) => {
                    const total = (chart.data.datasets || []).reduce((sum, dataset) => sum + toInteger(dataset?.data?.[index]), 0);
                    if (total <= 0) return;
                    const topBar = chart.getDatasetMeta((chart.data.datasets || []).length - 1)?.data?.[index];
                    if (!topBar) return;
                    ctx.fillText(
                        formatInteger(total),
                        topBar.x,
                        Math.max(chartArea.top + 10, topBar.y - 6)
                    );
                });
                ctx.restore();
            }
        };
    }

    function resetTelecomRadioCanvas(canvas) {
        if (!canvas) return;
        const container = canvas.parentElement;
        if (container) {
            container.style.setProperty("position", "relative", "important");
            container.style.setProperty("width", "100%", "important");
            container.style.setProperty("height", "340px", "important");
            container.style.setProperty("min-height", "340px", "important");
            container.style.setProperty("max-height", "340px", "important");
            container.style.setProperty("overflow-x", "hidden", "important");
            container.style.setProperty("overflow-y", "hidden", "important");
            container.classList.remove("is-scrollable");
        }

        canvas.removeAttribute("style");
        canvas.style.setProperty("display", "block", "important");
        canvas.style.setProperty("visibility", "visible", "important");
        canvas.style.setProperty("width", "100%", "important");
        canvas.style.setProperty("max-width", "100%", "important");
        canvas.style.setProperty("min-width", "0", "important");
        canvas.style.setProperty("height", "340px", "important");
        canvas.style.setProperty("min-height", "340px", "important");
        canvas.style.setProperty("max-height", "340px", "important");

        const width = Math.max(300, Math.floor(container?.clientWidth || canvas.clientWidth || 360));
        canvas.width = width;
        canvas.height = 340;
    }

    async function renderTelecomCharts(layer, chartConfig, attrs = {}, rendererLookups = null) {
        const telecomConfig = chartConfig?.telecomCharts;
        if (!telecomConfig) {
            hideTelecomPanels();
            return;
        }

        const {
            doughnutPanel,
            doughnutTitle,
            doughnutCanvas,
            doughnutStatus,
            radioPanel,
            radioTitle,
            radioCanvas,
            radioStatus,
            radioText
        } = getTelecomPanels();

        if (!doughnutPanel || !doughnutCanvas || !radioPanel || !radioCanvas) return;

        setPublicServicesTextFlow(true);
        placePublicServicesSummaryBeforeTelecomText();
        doughnutPanel.hidden = false;
        radioPanel.hidden = false;
        showTelecomStatus(doughnutStatus, "Cargando suscripciones a internet fijo...");
        showTelecomStatus(radioStatus, "Cargando acceso a telecomunicaciones...");
        if (radioText) {
            radioText.hidden = true;
            radioText.textContent = "";
        }

        const place = readablePlace(attrs);
        const municipalityCode = String(place.mpcodigo || attrs.mpcodigo || "").trim();
        const departmentCode = String(attrs.dpcodigo || municipalityCode.slice(0, 2) || "").trim();

        if (!municipalityCode || municipalityCode.length !== 5 || !departmentCode) {
            showTelecomStatus(doughnutStatus, "Seleccione un municipio para ver la información.");
            showTelecomStatus(radioStatus, "Seleccione un municipio para ver la información.");
            return;
        }

        let municipalityAttrs = null;
        let departmentAttrs = null;
        const telecomDataWarning = TELECOM_UNAVAILABLE_MESSAGE;
        const [municipalityResult, departmentResult] = await Promise.allSettled([
            queryTelecomRowWithFallback(
                [telecomConfig.municipalityServiceUrl, ...(telecomConfig.municipalityFallbackServiceUrls || [])],
                telecomConfig.municipalityField,
                municipalityCode,
                telecomConfig.requiredFields
            ),
            queryTelecomRowWithFallback(
                [telecomConfig.departmentServiceUrl, ...(telecomConfig.departmentFallbackServiceUrls || [])],
                telecomConfig.departmentField,
                departmentCode,
                telecomConfig.requiredFields
            )
        ]);

        if (municipalityResult.status === "fulfilled") {
            municipalityAttrs = municipalityResult.value;
        } else {
            console.warn("Telecomunicaciones municipales sin datos consultables:", municipalityResult.reason);
        }

        if (departmentResult.status === "fulfilled") {
            departmentAttrs = departmentResult.value;
        } else {
            console.warn("Telecomunicaciones departamentales sin datos consultables:", departmentResult.reason);
        }

        const hasMunicipalityData = hasUsableTelecomAttributes(municipalityAttrs);
        const hasDepartmentData = hasUsableTelecomAttributes(departmentAttrs);
        if (!hasMunicipalityData) municipalityAttrs = {};
        if (!hasDepartmentData) departmentAttrs = {};

        const municipalityValues = {
            total_internet_fijo: toInteger(municipalityAttrs.total_internet_fijo),
            total_emisoras: toInteger(municipalityAttrs.total_emisoras),
            total_com_fm: toInteger(municipalityAttrs.total_com_fm),
            total_comunitarias_fm: toInteger(municipalityAttrs.total_comunitarias_fm),
            total_publico_fm: toInteger(municipalityAttrs.total_publico_fm),
            total_com_am: toInteger(municipalityAttrs.total_com_am),
            total_publico_am: toInteger(municipalityAttrs.total_publico_am)
        };
        const departmentInternet = toInteger(departmentAttrs.total_internet_fijo);
        const percent = departmentInternet > 0
            ? (municipalityValues.total_internet_fijo / departmentInternet) * 100
            : 0;
        const doughnutData = [
            municipalityValues.total_internet_fijo,
            departmentInternet
        ];
        const hasInternetValues = hasMunicipalityData && hasDepartmentData && doughnutData.some(value => Number(value) > 0);

        const palette = resolveTelecomPalette(rendererLookups, 4);
        const internetPalette = hasInternetValues
            ? ["rgba(255, 99, 132, 0.94)", "rgba(75, 192, 192, 0.94)"]
            : ["rgba(100, 116, 139, 0.72)", "rgba(203, 213, 225, 0.82)"];
        doughnutTitle.textContent = resolveTelecomTitle(
            telecomConfig.doughnutTitleMunicipality,
            telecomConfig.doughnutTitleCapital,
            attrs
        );
        radioTitle.textContent = resolveTelecomTitle(
            telecomConfig.radioTitleMunicipality,
            telecomConfig.radioTitleCapital,
            attrs
        );

        destroyCanvasChart(doughnutCanvas);
        doughnutCanvas.style.setProperty("display", "block", "important");
        doughnutCanvas.style.setProperty("visibility", "visible", "important");
        doughnutCanvas.style.setProperty("width", "100%", "important");
        doughnutCanvas.style.setProperty("max-width", "100%", "important");
        doughnutCanvas.style.setProperty("height", "295px", "important");
        doughnutCanvas.style.setProperty("min-height", "295px", "important");
        doughnutCanvas.style.setProperty("max-height", "295px", "important");
        telecomDoughnutChart = new Chart(doughnutCanvas.getContext("2d"), {
            type: "polarArea",
            data: {
                labels: hasInternetValues ? [place.mpnombre, place.dpnombre] : ["Sin datos", "Servicio fuente"],
                datasets: [{
                    data: hasInternetValues ? doughnutData : [1, 1],
                    backgroundColor: internetPalette,
                    borderColor: internetPalette.map(color => toOpaqueBorder(color)),
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                startAngle: -90,
                layout: {
                    padding: {
                        left: 8,
                        right: 8,
                        top: 4,
                        bottom: 0
                    }
                },
                scales: {
                    r: {
                        beginAtZero: true,
                        grid: {
                            color: "rgba(148, 163, 184, 0.22)"
                        },
                        angleLines: {
                            color: "rgba(148, 163, 184, 0.14)"
                        },
                        ticks: {
                            backdropColor: "rgba(255, 255, 255, 0)",
                            color: "rgba(71, 85, 105, 0.72)",
                            font: { size: 9, weight: "600" },
                            callback: value => formatInteger(value).replace(/\./g, "")
                        },
                        pointLabels: {
                            display: false
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: "top",
                        labels: {
                            boxWidth: 26,
                            boxHeight: 6,
                            color: "#334155",
                            padding: 14,
                            font: { size: 11, weight: "600" }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label(context) {
                                if (!hasInternetValues) return "Sin datos disponibles en el servicio";
                                if (context.dataIndex === 0) {
                                    return `${place.mpnombre} Numero de suscripciones: ${formatInteger(municipalityValues.total_internet_fijo)}`;
                                }
                                return `${place.dpnombre} Numero de suscripciones: ${formatInteger(departmentInternet)}`;
                            }
                        }
                    }
                }
            },
            plugins: [createTelecomPolarValueLabelsPlugin(hasInternetValues ? doughnutData : [])]
        });
        if (telecomDoughnutChart) {
            telecomDoughnutChart.$telecomParticipation = hasInternetValues ? percent : 0;
        }
        telecomDoughnutChart.options.onClick = function (event, elements, chart) {
            const hit = elements?.[0];
            if (!hit) return;
            const meta = chart.getDatasetMeta(hit.datasetIndex)?.data?.[hit.index];
            if (!meta) return;
            chart.setActiveElements([{ datasetIndex: hit.datasetIndex, index: hit.index }]);
            chart.tooltip.setActiveElements([{ datasetIndex: hit.datasetIndex, index: hit.index }], {
                x: meta.x,
                y: meta.y
            });
            chart.update();
        };
        telecomDoughnutChart.update("none");
        showTelecomStatus(doughnutStatus, hasInternetValues ? "" : telecomDataWarning);

        const radioData = {
            comercial: [municipalityValues.total_com_fm, municipalityValues.total_com_am],
            comunitarias: [municipalityValues.total_comunitarias_fm, 0],
            interesPublico: [municipalityValues.total_publico_fm, municipalityValues.total_publico_am]
        };
        const hasRadioData = hasMunicipalityData;

        destroyCanvasChart(radioCanvas);
        resetTelecomRadioCanvas(radioCanvas);
        telecomRadioChart = new Chart(radioCanvas.getContext("2d"), {
            type: "bar",
            data: {
                labels: ["Comunitarias", "Comercial", "Interés Publico"],
                datasets: [{
                    label: "FM",
                    data: [
                        radioData.comunitarias[0],
                        radioData.comercial[0],
                        radioData.interesPublico[0]
                    ],
                    backgroundColor: palette[2],
                    borderColor: toOpaqueBorder(palette[2]),
                    borderWidth: 1,
                    stack: "radio"
                }, {
                    label: "AM",
                    data: [
                        radioData.comunitarias[1],
                        radioData.comercial[1],
                        radioData.interesPublico[1]
                    ],
                    backgroundColor: palette[3],
                    borderColor: toOpaqueBorder(palette[3]),
                    borderWidth: 1,
                    stack: "radio"
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        stacked: true,
                        title: {
                            display: true,
                            text: "Categorías de emisoras"
                        },
                        grid: { display: false },
                        ticks: {
                            color: "#334155",
                            font: { size: 11, weight: "600" }
                        }
                    },
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: "Cantidad de emisoras"
                        },
                        ticks: {
                            precision: 0,
                            color: "#334155",
                            callback: value => formatInteger(value)
                        },
                        grid: {
                            color: "rgba(148, 163, 184, 0.24)"
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: "bottom",
                        labels: {
                            boxWidth: 12,
                            color: "#334155",
                            font: { size: 11, weight: "600" }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label(context) {
                                return `${context.dataset?.label || ""}: ${formatInteger(context.parsed?.y)}`;
                            }
                        }
                    }
                }
            },
            plugins: [createTelecomRadioTotalsPlugin()]
        });
        showTelecomStatus(radioStatus, hasRadioData ? "" : telecomDataWarning);

        if (radioText) {
            radioText.hidden = false;
            radioText.textContent = hasRadioData
                ? buildTelecomNarrative(place, municipalityValues)
                : "La información de telecomunicaciones para este municipio se encuentra en proceso de actualización en el servicio fuente.";
        }
    }

    function syncDatasetsToCodes(codes = null) {
        const chartInstance = chartCore.getInstance();
        if (!chartInstance) return;

        const normalized = Array.isArray(codes)
            ? codes.map(value => String(value ?? "").trim()).filter(Boolean)
            : null;
        const visibleDatasets = normalized?.length
            ? allDatasets.filter(dataset => normalized.includes(String(dataset.rawCode)))
            : allDatasets;

        chartInstance.data.datasets = visibleDatasets.map(dataset => decorateDataset(dataset, {
            selectedCode: selectedSettlementCode,
            dimOthers: Boolean(selectedSettlementCode)
        }));
        chartInstance.update();
    }

    function decorateDataset(dataset, options = {}) {
        const selectedCode = String(options.selectedCode ?? "").trim();
        const isSelected = selectedCode && String(dataset.rawCode) === selectedCode;
        const dimmed = selectedCode && !isSelected && options.dimOthers;
        return {
            label: dataset.label,
            data: dataset.data,
            rawCode: dataset.rawCode,
            borderColor: dimmed ? toSoftFill(dataset.borderColor, 0.35) : dataset.borderColor,
            backgroundColor: "rgba(0, 0, 0, 0)",
            pointBackgroundColor: dimmed ? toSoftFill(dataset.borderColor, 0.35) : dataset.pointBackgroundColor,
            pointBorderColor: dataset.pointBorderColor,
            pointHoverBackgroundColor: dataset.pointHoverBackgroundColor,
            pointHoverBorderColor: dataset.pointHoverBorderColor,
            pointRadius: isSelected ? 5 : 4,
            pointHoverRadius: isSelected ? 7 : 6,
            borderWidth: isSelected ? 3 : 2,
            spanGaps: false,
            fill: false
        };
    }

    function syncLegendVisual(code = null, hideOthers = false, config = null) {
        if (usesRendererLegend(config)) return;
        const normalized = String(code ?? "").trim();
        const state = window.__legendState;
        if (state) {
            state.visibleCodes = hideOthers && normalized ? new Set([normalized]) : null;
            state.activeCodes = normalized ? new Set([normalized]) : new Set((state.allCodes || []).map(value => String(value)));
        }
        document.querySelectorAll("#legendContent .legend-item").forEach(node => {
            const itemCode = String(node.dataset.code ?? "").trim();
            const visible = !hideOthers || !normalized || itemCode === normalized;
            const active = !normalized || itemCode === normalized;
            node.style.display = visible ? "" : "none";
            node.classList.toggle("active", active);
            node.classList.toggle("off", !active);
        });
    }

    function setSelectedDataset(code = null, options = {}) {
        selectedSettlementCode = code ? String(code).trim() : null;
        const chartInstance = chartCore.getInstance();
        if (!chartInstance) return;
        const visibleCodes = new Set((chartInstance.data.datasets || [])
            .map(dataset => String(dataset.rawCode ?? "").trim())
            .filter(Boolean));
        const sourceDatasets = allDatasets.filter(dataset => visibleCodes.has(String(dataset.rawCode)));
        chartInstance.data.datasets = sourceDatasets.map(dataset =>
            decorateDataset(dataset, {
                selectedCode: selectedSettlementCode,
                dimOthers: !options.keepPeers
            })
        );
        chartInstance.update();
        syncLegendVisual(selectedSettlementCode, options.hideOthers === true, options.config);
    }

    async function clearSelection(config = null) {
        const currentHighlight = getHighlightHandle?.();
        if (currentHighlight) {
            currentHighlight.remove();
            setHighlightHandle?.(null);
        }
        selectedSettlementCode = null;
        setSelectedDataset(null, { keepPeers: true, config });
        if (!usesRendererLegend(config)) {
            await window.__setLegendVisibleCodes?.(null);
        }
    }

    async function highlightMapBySettlement(layer, chartConfig, settlementCode, config = null) {
        const field = chartConfig?.settlementField || chartConfig?.mapInteractionField;
        const view = getView?.();
        if (!layer?.createQuery || !field || !view || !settlementCode) return;

        const categoryWhere = `${field} = ${Number(settlementCode)}`;
        const baseWhere = String(window.__legendState?.baseWhere || buildWhere(chartConfig) || "1=1").trim() || "1=1";
        const where = baseWhere !== "1=1" ? `(${baseWhere}) AND (${categoryWhere})` : categoryWhere;

        if (!usesRendererLegend(config)) {
            syncLegendVisual(settlementCode, true, config);
            await window.__setLegendVisibleCodes?.([settlementCode]);
        }

        try {
            const currentHighlight = getHighlightHandle?.();
            if (currentHighlight) {
                currentHighlight.remove();
                setHighlightHandle?.(null);
            }

            const query = layer.createQuery();
            query.where = where;
            query.outFields = [layer.objectIdField || "OBJECTID", field];
            query.returnGeometry = false;
            const result = await layer.queryFeatures(query);
            const objectIdField = layer.objectIdField || "OBJECTID";
            const objectIds = (result?.features || [])
                .map(feature => feature.attributes?.[objectIdField])
                .filter(value => value != null);

            if (objectIds.length) {
                const layerView = await view.whenLayerView(layer);
                const handle = layerView.highlight(objectIds);
                setHighlightHandle?.(handle);
                window.__lastPublicServicesSelection = {
                    field,
                    code: String(settlementCode),
                    objectIds
                };
            }
        } catch (error) {
            console.warn("No se pudo resaltar la capa de servicios públicos:", error);
        }
    }

    async function toggleSelectionFromChart(layer, chartConfig, settlementCode, config = null) {
        const normalized = String(settlementCode ?? "").trim();
        if (!normalized) return;
        if (selectedSettlementCode === normalized) {
            await clearSelection(config);
            return;
        }
        setSelectedDataset(normalized, { hideOthers: true, config });
        await highlightMapBySettlement(layer, chartConfig, normalized, config);
    }

    function buildTooltipLabel(chartConfig, chart) {
        return (context) => {
            const dataset = chart?.data?.datasets?.[context.datasetIndex];
            const rawValue = Number(context.raw);
            const axisLabel = chartConfig?.axes?.[context.dataIndex]?.label || context.label;
            return `${dataset?.label || "Cobertura"} - ${axisLabel}: ${rangeLabel(rawValue, chartConfig)}`;
        };
    }

    async function actualizarGrafica(layer, config, options = {}) {
        const chartConfig = config?.chartConfig;
        if (!chartConfig || chartConfig.type !== "radar" || chartConfig.library !== "chart.js") return false;

        const canvas = document.getElementById("chart");
        if (!canvas) return true;

        chartCore.destroyChart();
        prepareVisibleChartCanvas(canvas);
        installRadarLayout(canvas);
        setChartTitle(chartConfig.title || config.title);
        setChartStatus(canvas, "Cargando gráfico...");
        installLegendSyncHooks(config);

        if (typeof Chart === "undefined") {
            setChartStatus(canvas, "Chart.js no está cargado.");
            return true;
        }

        if (!layer?.createQuery) {
            setChartStatus(canvas, "No hay capa disponible para el gráfico.");
            return true;
        }

        await layer.when?.();
        validateRequiredFields(layer, chartConfig);

        const where = buildWhere(chartConfig);
        if (!options.skipSyncMap && chartConfig?.filter?.scope !== "allDepartments") {
            applyWhereToActiveLayers?.(where);
        }

        const query = layer.createQuery();
        query.where = where;
        query.outFields = [...new Set(chartConfig.fields || [])];
        query.returnGeometry = false;

        let result = null;
        try {
            result = await withTimeout(
                layer.queryFeatures(query),
                15000,
                "La consulta de servicios públicos no respondio a tiempo."
            );
        } catch (queryError) {
            console.warn("Fallback JSON para servicios públicos:", queryError);
            result = await queryServiceJson(layer?.url || chartConfig?.url || chartConfig?.serviceUrl, {
                where,
                outFields: query.outFields,
                returnGeometry: false,
                resultRecordCount: 2000
            }, "La consulta JSON de servicios públicos no respondio a tiempo.");
        }
        const features = result?.features || [];
        if (!features.length) {
            hideTelecomPanels();
            setChartStatus(canvas, "No hay datos para el filtro seleccionado.");
            return true;
        }

        const place = readablePlace(features[0]?.attributes || {});
        if (isSpecialArea(place)) {
            chartCore.destroyChart();
            hideTelecomPanels();
            prepareVisibleChartCanvas(canvas);
            installRadarLayout(canvas);
            setChartTitle(resolveTitle(chartConfig, features[0]?.attributes || {}));
            setChartStatus(canvas, chartConfig.specialAreaMessage || "No se genera gráfico para este tipo de entidad territorial.");
            if (typeof window.actualizarLeyenda === "function") {
                window.actualizarLeyenda([], [], [], {
                    field: chartConfig.settlementField,
                    baseWhere: where,
                    layers: [layer],
                    preserveOrder: true
                });
            }
            return true;
        }

        const rendererLookups = await getChartSymbolLookups({
            layers: [layer, getLayerGlobal?.(), ...(getLayersGlobal?.() || [])].filter(Boolean),
            urls: [String(layer?.__sourceUrl || layer?.url || "")].filter(Boolean),
            chartConfig
        });

        allDatasets = buildDatasets(features, layer, chartConfig, rendererLookups);
        if (!allDatasets.length) {
            hideTelecomPanels();
            setChartStatus(canvas, "No hay datos válidos para el filtro seleccionado.");
            return true;
        }

        chartCore.setRows(allDatasets.map(dataset => ({
            label: dataset.label,
            rawLabel: dataset.rawCode,
            value: dataset.data.filter(value => Number.isFinite(Number(value))).length,
            color: dataset.borderColor
        })));

        if (usesRendererLegend(config)) {
            window.__chartLegendOrder = [];
        } else {
            window.__chartLegendOrder = allDatasets.map(dataset => ({
                code: dataset.rawCode,
                label: dataset.label,
                color: dataset.borderColor
            }));
        }

        if (!usesRendererLegend(config) && typeof window.actualizarLeyenda === "function") {
            window.actualizarLeyenda(
                allDatasets.map(dataset => dataset.label),
                allDatasets.map(dataset => dataset.borderColor),
                allDatasets.map(dataset => dataset.rawCode),
                {
                    field: chartConfig.settlementField,
                    baseWhere: where,
                    layers: [layer],
                    preserveOrder: true
                }
            );
        }

        const labels = (chartConfig.axes || []).map(axis => axis.label);
        const ctx = canvas.getContext("2d");
        const radarChart = new Chart(ctx, {
            type: "radar",
            data: {
                labels,
                datasets: allDatasets.map(dataset => decorateDataset(dataset))
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                interaction: {
                    mode: "nearest",
                    intersect: true
                },
                elements: {
                    line: {
                        tension: 0.18
                    }
                },
                scales: {
                    r: {
                        min: 1,
                        max: 7,
                        ticks: {
                            display: false,
                            stepSize: 1,
                            backdropColor: "transparent",
                            color: "#475569",
                            callback: value => rangeLabel(value, chartConfig)
                        },
                        grid: {
                            color: "rgba(148, 163, 184, 0.35)"
                        },
                        angleLines: {
                            color: "rgba(148, 163, 184, 0.35)"
                        },
                        pointLabels: {
                            color: "#0f172a",
                            font: {
                                size: 12,
                                weight: "600"
                            }
                        }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: buildTooltipLabel(chartConfig, null)
                        }
                    }
                },
                onClick: async (event, elements, chart) => {
                    const hits = elements?.length
                        ? elements
                        : chart.getElementsAtEventForMode(event, "nearest", { intersect: true }, true);
                    const hit = hits?.[0];
                    if (!hit) return;
                    const dataset = chart.data.datasets?.[hit.datasetIndex];
                    const settlementCode = dataset?.rawCode;
                    if (!settlementCode) return;
                    await toggleSelectionFromChart(layer, chartConfig, settlementCode, config);
                }
            },
            plugins: [createPublicServicesRadarValueLabelsPlugin(chartConfig)]
        });

        radarChart.options.plugins.tooltip.callbacks.label = buildTooltipLabel(chartConfig, radarChart);

        chartCore.setInstance(radarChart);
        setChartTitle(resolveTitle(chartConfig, features[0]?.attributes || {}));
        setChartStatus(canvas, "");
        installRadarLayout(canvas);
        selectedSettlementCode = null;
        try {
            await renderTelecomCharts(layer, chartConfig, features[0]?.attributes || {}, rendererLookups);
        } catch (error) {
            const detail = String(error?.message || error || "Error desconocido");
            console.warn("No se pudieron renderizar los gráficos de telecomunicaciones:", error);
            const { doughnutStatus, radioStatus } = getTelecomPanels();
            showTelecomStatus(doughnutStatus, `No se pudo cargar el gráfico de suscripciones a internet fijo. ${detail}`);
            showTelecomStatus(radioStatus, `No se pudo cargar el gráfico de acceso a telecomunicaciones. ${detail}`);
        }
        return true;
    }

    function prepareChartPanelForConfig(config) {
        if (!config?.chartConfig || config.chartConfig.type !== "radar") return false;
        const canvas = document.getElementById("chart");
        if (!canvas) return true;
        hideTelecomPanels();
        prepareVisibleChartCanvas(canvas);
        installRadarLayout(canvas);
        installLegendSyncHooks(config);
        setChartTitle(config.chartConfig.title || config.title);
        setChartStatus(canvas, "Cargando gráfico...");
        return true;
    }

    async function handleMapClick(event, config) {
        const chartConfig = config?.chartConfig;
        const field = chartConfig?.settlementField || chartConfig?.mapInteractionField;
        const view = getView?.();
        if (!field || !view) return;

        const hit = await view.hitTest(event);
        const layersGlobal = getLayersGlobal?.() || [];
        const layerGlobal = getLayerGlobal?.();
        const graphic = hit?.results
            ?.map(result => result.graphic)
            ?.find(item => item?.layer === layerGlobal || layersGlobal.includes(item?.layer));
        const settlementCode = graphic?.attributes?.[field];
        if (settlementCode == null) return;

        const normalized = String(settlementCode).trim();
        if (!allDatasets.some(dataset => String(dataset.rawCode) === normalized)) return;
        setSelectedDataset(normalized, { hideOthers: false, config });
        syncLegendVisual(normalized, false, config);
    }

    return {
        actualizarGrafica,
        handleMapClick,
        prepareChartPanelForConfig,
        installLegendSyncHooks,
        hideTelecomPanels
    };
}
