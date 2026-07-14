import { createChart, getChartInstance } from "../chart.core.js";
import { defaultBarOptions, buildDataset } from "../chart.helpers.js";

const DEPTO_BAR_COLOR = "#4C0073";
const DEPTO_BAR_DIM_COLOR = "rgba(76, 0, 115, 0.35)";

function formatAreaKm2(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return `0,00 km\u00b2`;

    return `${new Intl.NumberFormat("es-CO", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(number)} km\u00b2`;
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
    if (titleEl) titleEl.textContent = options.title || config.title || "Distribución departamental";

    try {
        const res = await layer.queryFeatures({
            where: whereClause,
            outFields: config.outFields || ["*"],
            returnGeometry: false,
            orderByFields: [config.labelField || "DeNombre"]
        });

        const features = res.features || [];
        const numDeptos = features.length;
        const labels = [];
        const values = [];
        const colors = [];
        const deCodigos = [];

        features.forEach(f => {
            const att = f.attributes;
            labels.push(String(att[config.labelField || config.nameField || "DeNombre"] || "Sin nombre"));
            values.push(Number(att[config.valueField || config.areaField || "DeArea"] || 0));
            colors.push(config.color || DEPTO_BAR_COLOR);
            deCodigos.push(String(att[config.filterField || "DeCodigo"] || ""));
        });

        // â”€â”€ MultilÃ­nea para nombres largos de departamentos â”€â”€
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

        // â”€â”€ Altura dinÃ¡mica del grÃ¡fico segÃºn cantidad de barras visibles â”€â”€
        const numBarras = numDeptos;
        const esUnaBarra = numBarras === 1;
        const pocosDeptos = numBarras <= 5;

        // ParÃ¡metros de altura
        const ALTURA_BASE = 100;                 // espacio para ejes, tÃ­tulos y padding
        const ALTURA_POR_BARRA_MUCHOS = 18;      // px por barra cuando hay >5 deptos
        const ALTURA_POR_BARRA_POCOS = 28;       // px por barra cuando hay 2-5 deptos
        const ALTURA_UNA_BARRA = 300;            // altura ideal para 1 sola barra con textos legibles
        const ALTURA_MAXIMA_NACIONAL = 520;      // altura para la vista nacional (~33 deptos)

        let canvasHeight;
        if (esUnaBarra) {
            canvasHeight = ALTURA_UNA_BARRA;
        } else {
            const alturaPorBarra = pocosDeptos ? ALTURA_POR_BARRA_POCOS : ALTURA_POR_BARRA_MUCHOS;
            canvasHeight = Math.min(ALTURA_MAXIMA_NACIONAL, ALTURA_BASE + numBarras * alturaPorBarra);
        }

        // â”€â”€ TamaÃ±os de fuente y mÃ¡rgenes segÃºn cantidad de barras â”€â”€
        const fontSizeY = esUnaBarra ? 10 : (pocosDeptos ? 10 : 8);
        const fontSizeX = esUnaBarra ? 9 : (pocosDeptos ? 11 : 10);
        const tickPaddingY = esUnaBarra ? 8 : (pocosDeptos ? 6 : 3);
        const layoutPadding = esUnaBarra
            ? { top: 18, bottom: 14, left: 10, right: 18 }
            : { top: 8, bottom: 8, left: 0, right: 12 };
        const barThickness = esUnaBarra ? 28 : (pocosDeptos ? 16 : undefined);
        const barPercentage = esUnaBarra ? 0.55 : (pocosDeptos ? 0.70 : 0.82);
        const categoryPercentage = esUnaBarra ? 0.65 : (pocosDeptos ? 0.70 : 0.75);

        // â”€â”€ Ajustar dinÃ¡micamente el summaryDiv para que no genere espacio vacÃ­o â”€â”€
        const summaryDiv = document.getElementById("summaryDiv");
        if (summaryDiv) {
            if (numBarras <= 3) {
                summaryDiv.style.minHeight = "80px";
                summaryDiv.style.maxHeight = "200px";
            } else {
                summaryDiv.style.minHeight = "";
                summaryDiv.style.maxHeight = "";
            }
        }

        // â”€â”€ Establecer altura directamente en el canvas â”€â”€
        // Limpiar cualquier estilo residual antes de asignar nueva altura
        canvas.removeAttribute("height");
        canvas.style.height = canvasHeight + "px";
        canvas.style.maxHeight = canvasHeight + "px";
        canvas.style.minHeight = canvasHeight + "px";
        canvas.style.width = "100%";

        // â”€â”€ Restaurar estilos del chartDiv para vista nacional â”€â”€
        const chartDiv = document.getElementById("chartDiv");
        if (chartDiv) {
            // Quitar TODOS los estilos inline para que el CSS original tome el control
            chartDiv.removeAttribute("style");
            // Luego aplicar solo lo necesario
            chartDiv.style.overflowY = numBarras > 15 ? "auto" : "hidden";
            // Compactar solo cuando hay pocas barras
            if (numBarras <= 3) {
                chartDiv.style.display = "flex";
                chartDiv.style.flexDirection = "column";
                chartDiv.style.justifyContent = "flex-start";
            }
            // Para vista nacional (>3 barras) no se aplica nada adicional,
            // el CSS original (#chartDiv) define el layout correcto
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
                    // responsive: false para evitar que Chart.js observe el contenedor
                    // y genere ciclos de redimensionamiento
                    responsive: false,
                    maintainAspectRatio: false,
                    devicePixelRatio: 2,

                    onClick: function(event, elements) {
                        if (!elements || !elements.length) return;
                        const index = elements[0].index;
                        const deCodigo = deCodigos[index];
                        if (!deCodigo) return;

                        document.dispatchEvent(new CustomEvent("limites:depto-chart-select", {
                            detail: {
                                deCodigo: deCodigo,
                                index: index,
                                source: "chart"
                            }
                        }));
                    },

                    onHover: function(event, elements) {
                        if (event?.native?.target) {
                            event.native.target.style.cursor = elements?.length ? "pointer" : "default";
                        }
                    },

                    layout: {
                        padding: layoutPadding
                    },

                    scales: {
                        y: {
                            stacked: false,
                            ticks: {
                                autoSkip: false,
                                maxRotation: 0,
                                font: {
                                    size: fontSizeY,
                                    family: "Outfit, sans-serif",
                                    weight: "500"
                                },
                                padding: tickPaddingY
                            }
                        },
                        x: {
                            ticks: {
                                font: {
                                    size: fontSizeX,
                                    family: "Outfit, sans-serif",
                                    weight: "500"
                                }
                            }
                        }
                    },

                    ...(barThickness ? {
                        barThickness: barThickness
                    } : {}),
                    datasets: {
                        bar: {
                            categoryPercentage: categoryPercentage,
                            barPercentage: barPercentage,
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
                            pan: {
                                enabled: true,
                                mode: "y",
                                threshold: 5
                            },
                            zoom: {
                                wheel: {
                                    enabled: true,
                                    speed: 0.06,
                                    modifierKey: null
                                },
                                pinch: {
                                    enabled: true
                                },
                                drag: {
                                    enabled: false
                                },
                                mode: "y"
                            },
                            limits: {
                                y: {
                                    min: 0,
                                    max: Math.max(5, numDeptos + 2)
                                }
                            }
                        }
                    }
                }
            })
        });

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

    } catch (e) {
        console.warn("Error renderizando grÃ¡fica lÃ­mites departamentales:", e);
    }
}
