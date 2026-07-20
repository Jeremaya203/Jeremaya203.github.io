import { createChart, getChartInstance } from "../chart.core.js";
import { defaultBarOptions, buildDataset } from "../chart.helpers.js";
import { convertAreaToKm2, normalizeDepartamentoDisplayName } from "../../utils.js?v=depto-area-km2-20260716";

const DEPTO_BAR_COLOR = "#4C0073";
const DEPTO_BAR_DIM_COLOR = "rgba(76, 0, 115, 0.35)";

function formatAreaKm2(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "0,00 km\u00b2";

    return `${new Intl.NumberFormat("es-CO", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(number)} km\u00b2`;
}

function resolveCodedFieldLabel(layer, fieldName, value) {
    const codedValues = layer?.fields
        ?.find(field => String(field.name).toLowerCase() === String(fieldName).toLowerCase())
        ?.domain
        ?.codedValues;
    if (!codedValues?.length) return value;

    const match = codedValues.find(item => String(item.code) === String(value));
    return match?.name || value;
}

export function highlightDeptoChartBar(selectedIndex) {
    const chart = getChartInstance();
    if (!chart || selectedIndex < 0) return;

    const dataset = chart.data?.datasets?.[0];
    const count = dataset?.data?.length || 0;
    if (!count) return;

    dataset.backgroundColor = Array.from({ length: count }, (_, index) =>
        index === selectedIndex ? DEPTO_BAR_COLOR : DEPTO_BAR_DIM_COLOR
    );
    chart.update("none");
}

export function highlightDeptoChartByCode(deCodigo) {
    const chart = getChartInstance();
    const codes = chart?.$limitesDepartamentos?.deCodigos || [];
    const index = codes.findIndex(code => String(code) === String(deCodigo));
    if (index >= 0) highlightDeptoChartBar(index);
}

export function clearDeptoChartHighlight() {
    const chart = getChartInstance();
    if (!chart) return;

    const dataset = chart.data?.datasets?.[0];
    const count = dataset?.data?.length || 0;
    if (!count) return;

    dataset.backgroundColor = Array(count).fill(DEPTO_BAR_COLOR);
    chart.update("none");
}

export async function renderChart(layer, config, whereClause, options = {}) {
    if (!layer || !config) return;

    const canvas = document.getElementById("chart");
    if (!canvas) return;

    const titleEl = document.getElementById("chartTitle");
    if (titleEl) titleEl.textContent = options.title || config.title || "Distribuci\u00f3n departamental";

    try {
        const labelField = config.labelField || config.nameField || "dpnombre";
        const valueField = config.valueField || config.areaField || "dparea";
        const codeField = config.filterField || "dpcodigo";
        const res = await layer.queryFeatures({
            where: whereClause,
            outFields: config.outFields || ["*"],
            returnGeometry: false,
            orderByFields: [labelField]
        });

        const features = res.features || [];
        const numDeptos = features.length;
        const labels = [];
        const values = [];
        const colors = [];
        const deCodigos = [];

        features.forEach(feature => {
            const att = feature.attributes || {};
            const code = String(att[codeField] || "");
            const rawLabel = att[labelField];
            const label = resolveCodedFieldLabel(layer, labelField, rawLabel) || rawLabel || "Sin nombre";
            labels.push(String(normalizeDepartamentoDisplayName(label, code)));
            values.push(convertAreaToKm2(att[valueField], config.areaUnit) ?? 0);
            colors.push(config.color || DEPTO_BAR_COLOR);
            deCodigos.push(code);
        });

        function wrapDepartmentLabel(name) {
            if (!name) return [""];
            const maxLen = 22;
            if (name.length <= maxLen) return [name];

            const words = name.split(" ");
            const lines = [];
            let current = "";

            for (const word of words) {
                const test = current ? current + " " + word : word;
                if (test.length > maxLen && current) {
                    lines.push(current);
                    current = word;
                } else {
                    current = test;
                }
            }
            if (current) lines.push(current);
            return lines.length > 0 ? lines : [name];
        }

        const wrappedLabels = labels.map(wrapDepartmentLabel);
        const esUnaBarra = numDeptos === 1;
        const pocosDeptos = numDeptos <= 5;
        const alturaPorBarra = pocosDeptos ? 28 : 18;
        const canvasHeight = esUnaBarra
            ? 300
            : Math.min(520, 100 + numDeptos * alturaPorBarra);
        const fontSizeY = esUnaBarra ? 10 : (pocosDeptos ? 10 : 8);
        const fontSizeX = esUnaBarra ? 9 : (pocosDeptos ? 11 : 10);
        const tickPaddingY = esUnaBarra ? 8 : (pocosDeptos ? 6 : 3);
        const layoutPadding = esUnaBarra
            ? { top: 18, bottom: 14, left: 10, right: 18 }
            : { top: 8, bottom: 8, left: 0, right: 12 };
        const barThickness = esUnaBarra ? 28 : (pocosDeptos ? 16 : undefined);
        const barPercentage = esUnaBarra ? 0.55 : (pocosDeptos ? 0.70 : 0.82);
        const categoryPercentage = esUnaBarra ? 0.65 : (pocosDeptos ? 0.70 : 0.75);

        const summaryDiv = document.getElementById("summaryDiv");
        if (summaryDiv) {
            if (numDeptos <= 3) {
                summaryDiv.style.minHeight = "80px";
                summaryDiv.style.maxHeight = "200px";
            } else {
                summaryDiv.style.minHeight = "";
                summaryDiv.style.maxHeight = "";
            }
        }

        canvas.removeAttribute("height");
        canvas.style.height = canvasHeight + "px";
        canvas.style.maxHeight = canvasHeight + "px";
        canvas.style.minHeight = canvasHeight + "px";
        canvas.style.width = "100%";

        const chartDiv = document.getElementById("chartDiv");
        if (chartDiv) {
            chartDiv.removeAttribute("style");
            chartDiv.style.overflowY = numDeptos > 15 ? "auto" : "hidden";
            if (numDeptos <= 3) {
                chartDiv.style.display = "flex";
                chartDiv.style.flexDirection = "column";
                chartDiv.style.justifyContent = "flex-start";
            }
        }

        const chart = createChart(canvas, {
            type: "bar",
            data: {
                labels: wrappedLabels,
                datasets: [buildDataset(values, colors)]
            },
            options: defaultBarOptions({
                xTitle: "\u00c1rea (km\u00b2)",
                overrides: {
                    responsive: false,
                    maintainAspectRatio: false,
                    devicePixelRatio: 2,
                    onClick: function(event, elements) {
                        if (!elements || !elements.length) return;
                        const index = elements[0].index;
                        const deCodigo = deCodigos[index];
                        if (!deCodigo) return;

                        document.dispatchEvent(new CustomEvent("limites:depto-chart-select", {
                            detail: { deCodigo, index, source: "chart" }
                        }));
                    },
                    onHover: function(event, elements) {
                        if (event?.native?.target) {
                            event.native.target.style.cursor = elements?.length ? "pointer" : "default";
                        }
                    },
                    layout: { padding: layoutPadding },
                    scales: {
                        y: {
                            stacked: false,
                            ticks: {
                                autoSkip: false,
                                maxRotation: 0,
                                font: { size: fontSizeY, family: "Outfit, sans-serif", weight: "500" },
                                padding: tickPaddingY
                            }
                        },
                        x: {
                            ticks: {
                                font: { size: fontSizeX, family: "Outfit, sans-serif", weight: "500" }
                            }
                        }
                    },
                    ...(barThickness ? { barThickness } : {}),
                    datasets: {
                        bar: {
                            categoryPercentage,
                            barPercentage,
                            borderWidth: 0.3
                        }
                    },
                    plugins: {
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return formatAreaKm2(context.raw);
                                }
                            }
                        },
                        zoom: {
                            pan: { enabled: true, mode: "y", threshold: 5 },
                            zoom: {
                                wheel: { enabled: true, speed: 0.06, modifierKey: null },
                                pinch: { enabled: true },
                                drag: { enabled: false },
                                mode: "y"
                            },
                            limits: {
                                y: { min: 0, max: Math.max(5, numDeptos + 2) }
                            }
                        }
                    }
                }
            })
        });

        chart.$limitesDepartamentos = {
            deCodigos: deCodigos.slice()
        };

        canvas.ondblclick = function(event) {
            const hits = chart.getElementsAtEventForMode(
                event,
                "nearest",
                { intersect: true },
                false
            );
            if (hits && hits.length) return;

            document.dispatchEvent(new CustomEvent("limites:depto-chart-restore", {
                detail: { source: "chart" }
            }));
        };
    } catch (error) {
        console.warn("Error renderizando grafica limites departamentales:", error);
    }
}
