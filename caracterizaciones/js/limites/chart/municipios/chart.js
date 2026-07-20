import { createChart } from "../chart.core.js";
import { buildDataset } from "../chart.helpers.js";
import { getColorCSS } from "../../colors.js";

// Guardar todas las features para restaurar/refiltrar sin reconsultar
var _allChartFeatures = [];
var _currentFilteredFeatures = [];

var alignMunicipalBarBasePlugin = {
    id: "alignMunicipalBarBase",
    beforeDatasetsDraw: function(chart) {
        var zeroPixel = chart.scales?.x?.getPixelForValue?.(0);
        if (!Number.isFinite(zeroPixel)) return;

        chart.data.datasets.forEach(function(_dataset, datasetIndex) {
            var meta = chart.getDatasetMeta(datasetIndex);
            (meta?.data || []).forEach(function(bar) {
                bar.base = zeroPixel;
            });
        });
    }
};

function fitMunicipalYAxis(axis) {
    var chart = axis.chart;
    var labels = chart?.data?.labels || [];
    var tickFont = axis.options?.ticks?.font || {};
    var fontSize = Number(tickFont.size) || 10;
    var fontWeight = tickFont.weight || "500";
    var fontFamily = tickFont.family || "Outfit, sans-serif";
    var context = chart?.ctx;
    if (!context) return;

    context.save();
    context.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    var widestLine = labels.reduce(function(currentMax, label) {
        var lines = Array.isArray(label) ? label : [label];
        return lines.reduce(function(lineMax, line) {
            return Math.max(lineMax, context.measureText(String(line || "")).width);
        }, currentMax);
    }, 0);
    context.restore();

    var tickPadding = Number(axis.options?.ticks?.padding) || 0;
    axis.width = Math.ceil(Math.min(178, Math.max(72, widestLine + tickPadding + 12)));
}

function wrapBoundaryLabel(value) {
    var text = String(value || "Sin nombre").replace(/\s+/g, " ").trim();
    var maxLineLength = 29;
    if (text.length <= maxLineLength) return text;

    var words = text.split(" ");
    var bestLines = [text];
    var bestScore = Infinity;

    for (var index = 1; index < words.length; index += 1) {
        var firstLine = words.slice(0, index).join(" ");
        var secondLine = words.slice(index).join(" ");
        var longestLine = Math.max(firstLine.length, secondLine.length);
        var balance = Math.abs(firstLine.length - secondLine.length);
        var score = (longestLine * 10) + balance;

        if (score < bestScore) {
            bestScore = score;
            bestLines = [firstLine, secondLine];
        }
    }

    return bestLines;
}

function groupFeaturesByLineId(features) {
    var grouped = new Map();

    (features || []).forEach(function(feature) {
        var att = feature.attributes || {};
        var id = String(att["LLIdentif"] || "");
        var key = id || String(att["LLNombre"] || "");
        if (!key) return;

        if (!grouped.has(key)) {
            grouped.set(key, {
                attributes: {
                    LLIdentif: id,
                    LLNombre: att["LLNombre"] || id || "Sin nombre",
                    SHAPE_Length: 0
                }
            });
        }

        var target = grouped.get(key);
        target.attributes.SHAPE_Length += Number(att["SHAPE_Length"] || 0);
    });

    return Array.from(grouped.values());
}

export async function renderChart(layer, config, whereClause, options) {
    if (!layer || !config) return;
    options = options || {};

    var canvas = document.getElementById("chart");
    if (!canvas) return;

    var titleEl = document.getElementById("chartTitle");
    if (titleEl) titleEl.textContent = options.title || config.title || "Distribuci\u00f3n";

    try {
        var features;
        if (options.prefilteredFeatures) {
            features = options.prefilteredFeatures;
        } else {
            var res = await layer.queryFeatures({
                where: whereClause,
                outFields: ["LLIdentif", "LLNombre", "SHAPE_Length"],
                returnGeometry: false,
                orderByFields: [config.labelField || "LLNombre"]
            });
            features = res.features || [];
        }
        features = groupFeaturesByLineId(features);

        var labels = [];
        var values = [];
        var colors = [];
        var ids = [];

        // Limpiar estilos inline residuales
        canvas.removeAttribute("height");
        canvas.style.height = "";
        canvas.style.maxHeight = "";
        canvas.style.minHeight = "";
        var chartDiv = document.getElementById("chartDiv");
        if (chartDiv) {
            chartDiv.style.display = "";
            chartDiv.style.flexDirection = "";
            chartDiv.style.justifyContent = "";
            chartDiv.style.overflowY = "";
        }

        features.forEach(function(f) {
            var att = f.attributes;
            labels.push(String(att["LLNombre"] || "Sin nombre"));
            values.push((Number(att["SHAPE_Length"] || 0)) / 1000);
            colors.push(getColorCSS(att["LLIdentif"]));
            ids.push(String(att["LLIdentif"] || ""));
        });

        var numBarras = features.length;
        var esUnaBarra = numBarras === 1;
        var pocasBarras = numBarras <= 5;

        var ALTURA_BASE = 130;
        var ALTURA_POR_BARRA_MUCHAS = 22;
        var ALTURA_POR_BARRA_POCAS = 34;
        var ALTURA_UNA_BARRA = 280;
        var ALTURA_MAXIMA = 600;
        var ALTURA_MINIMA = 180;

        var canvasHeight;
        if (esUnaBarra) {
            canvasHeight = ALTURA_UNA_BARRA;
        } else {
            var alturaPorBarra = pocasBarras ? ALTURA_POR_BARRA_POCAS : ALTURA_POR_BARRA_MUCHAS;
            canvasHeight = Math.min(ALTURA_MAXIMA, Math.max(ALTURA_MINIMA, ALTURA_BASE + numBarras * alturaPorBarra));
        }

        canvas.style.height = canvasHeight + "px";
        canvas.style.maxHeight = canvasHeight + "px";
        canvas.style.minHeight = canvasHeight + "px";

        var fontSizeY = esUnaBarra ? 12 : (pocasBarras ? 11 : 9);
        var fontSizeX = esUnaBarra ? 11 : (pocasBarras ? 12 : 10);
        // Mantener ancho fijo de barras: usar siempre barThickness y barPercentage fijos
        var barThickness = 16;
        var barPercentage = 0.85;
        var categoryPercentage = 0.8;
        var layoutPadding = esUnaBarra
            ? { top: 20, bottom: 14, left: 10, right: 18 }
            : { top: 10, bottom: 10, left: 0, right: 12 };

        var chart = createChart(canvas, {
            type: "bar",
            plugins: [alignMunicipalBarBasePlugin],
            data: {
                labels: labels,
                datasets: [buildDataset(values, colors)]
            },
            options: {
                responsive: false,
                maintainAspectRatio: false,
                indexAxis: "y",
                devicePixelRatio: 2,
                layout: { padding: layoutPadding },
                onClick: function(event, elements) {
                    if (!elements || !elements.length) return;
                    var index = elements[0].index;
                    var llid = this.$limitesMunicipales?.currentIds?.[index] || ids[index];
                    if (!llid) return;
                    // Disparar evento para que main.js sincronice mapa y leyenda
                    document.dispatchEvent(new CustomEvent("limites:chart-select", {
                        detail: { llid: llid, source: "chart" }
                    }));
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(ctx) { return ctx.raw + " km"; }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        title: { display: true, text: "Longitud (km)" },
                        ticks: {
                            font: { size: fontSizeX, family: "Outfit, sans-serif", weight: "500" }
                        }
                    },
                    y: {
                        ticks: {
                            autoSkip: false,
                            maxRotation: 0,
                            font: { size: fontSizeY, family: "Outfit, sans-serif", weight: "500" },
                            padding: esUnaBarra ? 8 : (pocasBarras ? 6 : 3)
                        }
                    }
                },
                barThickness: barThickness,
                datasets: {
                    bar: {
                        categoryPercentage: categoryPercentage,
                        barPercentage: barPercentage,
                        borderWidth: 0.3
                    }
                }
            }
        });
        var displayLabels = labels.map(wrapBoundaryLabel);
        chart.data.labels = displayLabels;
        chart.options.scales.x.min = 0;
        chart.options.scales.x.offset = false;
        chart.options.scales.x.grace = 0;
        chart.options.scales.y.afterFit = fitMunicipalYAxis;
        chart.data.datasets.forEach(function(dataset) {
            dataset.base = 0;
            dataset.borderSkipped = "start";
            dataset.borderRadius = {
                topLeft: 0,
                bottomLeft: 0,
                topRight: 2,
                bottomRight: 2
            };
        });
        chart.update("none");
        chart.$limitesMunicipales = {
            ids: ids,
            currentIds: ids.slice(),
            labels: displayLabels,
            values: values,
            colors: colors,
            originalLabels: labels.slice()
        };

        // Doble clic en el canvas restaura el grafico completo
        canvas.onclick = null;
        canvas.ondblclick = function(e) {
            document.dispatchEvent(new CustomEvent("limites:chart-restore", {
                detail: { source: "chart" }
            }));
        };

    } catch (e) {
        console.warn("Error renderizando grafica limites municipales:", e);
    }
}
