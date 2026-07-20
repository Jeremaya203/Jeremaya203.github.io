/**
 * Gráfico de burbujas para Orden del Suelo vs Fertilidad
 */
export function crearGraficaBubbleOrdenSuelo({ xLabels, yLabels, datasets, isDepartment = false }, deps) {
    const {
        getCanvas,
        getChartInstance,
        setChartInstance,
        zoomMapaOrdenSuelo,
        restoreAllChartCategories
    } = deps;

    const canvas = getCanvas();
    const ctx2 = canvas.getContext("2d");

    async function syncPointWithMapAndLegend(chart, point) {
        if (!point) return;

        const ordenValue = point.yValue;
        const fertilidadValue = point.xValue;


        await zoomMapaOrdenSuelo(ordenValue, fertilidadValue);
    }

    const screenW = window.innerWidth || 1200;
    const isSmallScreen = screenW <= 900;
    const isVerySmallScreen = screenW <= 600;

    const totalXLabels = Array.isArray(xLabels) ? xLabels.length : 0;
    const longestXLabel = Math.max(...(xLabels || []).map(v => (v || "").length), 0);

    const useVerticalLabels = isSmallScreen && (totalXLabels >= 6 || longestXLabel >= 12);
    const useShortLabels = isSmallScreen && (totalXLabels >= 7 || longestXLabel >= 14);

    function shortenXLabel(label) {
        if (!label) return "";

        const map = {
            "Baja": "Baja",
            "Media": "Media",
            "Alta": "Alta",
            "Media y baja": "M-baja",
            "Baja y media": "B-media",
            "Media y alta": "M-alta",
            "Alta y media": "A-media",
            "Cuerpos de agua": "Agua",
            "Misceláneo Erosionado": "Misc."
        };

        return map[label] || label;
    }

    function calcularRadioBurbuja(porcentaje) {
        const p = Number(porcentaje || 0);

        if (isDepartment) {
            if (p <= 0) return 3;
            if (p < 1) return 4;
            if (p < 3) return 6;
            if (p < 6) return 8;
            if (p < 10) return 10;
            if (p < 20) return 14;
            if (p < 35) return 18;
            return 22;
        }

        if (p <= 0) return 5;
        if (p < 1) return 8;
        if (p < 3) return 12;
        if (p < 6) return 16;
        if (p < 10) return 20;
        if (p < 20) return 26;
        if (p < 35) return 34;
        return 40;
    }

    function agruparBurbujasOrdenSuelo(datasets, xLabels, yLabels) {
        const xIndex = new Map((xLabels || []).map((label, i) => [label, i]));
        const yIndex = new Map((yLabels || []).map((label, i) => [label, i]));
        const agrupado = new Map();

        (datasets || []).forEach(ds => {
            const dsBg = ds.backgroundColor;
            const dsBorder = ds.borderColor;

            (ds.data || []).forEach(p => {
                const xLabel = p.xLabel || "";
                const yLabel = p.yLabel || "";
                const xValue = p.xValue;
                const yValue = p.yValue;
                const porcentaje = Number(p.porcentaje || 0);

                if (!xLabel || !yLabel || porcentaje <= 0) return;
                if (!xIndex.has(xLabel) || !yIndex.has(yLabel)) return;

                const key = `${yLabel}|||${xLabel}`;

                const pointColor =
                    p.backgroundColor ||
                    (Array.isArray(dsBg) ? dsBg[0] : dsBg) ||
                    "rgba(54, 162, 235, 0.65)";

                const pointBorder =
                    p.borderColor ||
                    (Array.isArray(dsBorder) ? dsBorder[0] : dsBorder) ||
                    "#ffffff";

                if (!agrupado.has(key)) {
                    agrupado.set(key, {
                        x: xIndex.get(xLabel),
                        y: yIndex.get(yLabel),
                        xLabel,
                        yLabel,
                        xValue,
                        yValue,
                        porcentaje: 0,
                        backgroundColor: pointColor,
                        borderColor: pointBorder
                    });
                }

                const item = agrupado.get(key);
                item.porcentaje += porcentaje;
            });
        });

        const dataAgrupada = Array.from(agrupado.values()).map(item => ({
            ...item,
            r: calcularRadioBurbuja(item.porcentaje)
        }));

        return [{
            label: "Distribución",
            data: dataAgrupada,
            backgroundColor: dataAgrupada.map(d => d.backgroundColor),
            borderColor: dataAgrupada.map(d => d.borderColor),
            borderWidth: 1.5,
            hoverBorderWidth: 2
        }];
    }

    const totalPorcentaje = (datasets || []).reduce((acc, ds) => {
        return acc + (ds.data || []).reduce((sum, p) => sum + Number(p.porcentaje || 0), 0);
    }, 0);

    const sumaPorX = {};
    (datasets || []).forEach(ds => {
        (ds.data || []).forEach(p => {
            const key = p.xLabel || "Sin dato";
            sumaPorX[key] = (sumaPorX[key] || 0) + Number(p.porcentaje || 0);
        });
    });

    const datasetsAgrupados = agruparBurbujasOrdenSuelo(datasets, xLabels, yLabels);
    const fullBubbleData = datasetsAgrupados[0]?.data ? [...datasetsAgrupados[0].data] : [];
    const fullBubbleBackground = Array.isArray(datasetsAgrupados[0]?.backgroundColor)
        ? [...datasetsAgrupados[0].backgroundColor]
        : datasetsAgrupados[0]?.backgroundColor;
    const fullBubbleBorder = Array.isArray(datasetsAgrupados[0]?.borderColor)
        ? [...datasetsAgrupados[0].borderColor]
        : datasetsAgrupados[0]?.borderColor;

    const applyActiveOrderCodes = (activeCodesInput) => {
        const chart = getChartInstance();
        const dataset = chart?.data?.datasets?.[0];
        if (!chart || !dataset) return;

        const activeCodes = activeCodesInput instanceof Set
            ? activeCodesInput
            : new Set(Array.isArray(activeCodesInput) ? activeCodesInput.map(String) : []);
        const hasFilter = activeCodesInput instanceof Set || Array.isArray(activeCodesInput);
        const visibleIndexes = [];

        const filteredData = fullBubbleData.filter((point, index) => {
            const code = String(point?.yValue ?? "").trim();
            const visible = !hasFilter || activeCodes.has(code);
            if (visible) visibleIndexes.push(index);
            return visible;
        });

        dataset.data = filteredData;
        dataset.backgroundColor = Array.isArray(fullBubbleBackground)
            ? visibleIndexes.map(index => fullBubbleBackground[index])
            : fullBubbleBackground;
        dataset.borderColor = Array.isArray(fullBubbleBorder)
            ? visibleIndexes.map(index => fullBubbleBorder[index])
            : fullBubbleBorder;
        chart.update("none");
    };

    const totalEl = document.getElementById("chartTotalOrdenSuelo");
    if (totalEl) {
        totalEl.textContent = `Total acumulado: ${totalPorcentaje.toFixed(1)}%`;
    }

    const chartCard = canvas.closest(".chart-card");
    chartCard?.classList.add("chart-bubble");
    chartCard?.classList.toggle("chart-bubble-depto", Boolean(isDepartment));

    const departmentHeight = isVerySmallScreen ? 460 : (isSmallScreen ? 500 : 520);
    const canvasHeight = isDepartment
        ? `${departmentHeight}px`
        : (isVerySmallScreen ? "520px" : (isSmallScreen ? "560px" : "620px"));
    canvas.style.setProperty("width", "100%", "important");
    canvas.style.setProperty("height", canvasHeight, "important");
    canvas.style.setProperty("max-height", canvasHeight, "important");
    canvas.style.minWidth = isDepartment
        ? "100%"
        : (useVerticalLabels
        ? (isVerySmallScreen ? "900px" : "820px")
        : (isVerySmallScreen ? "760px" : (isSmallScreen ? "720px" : "100%")));

    const chartInstance = getChartInstance();
    if (chartInstance) {
        chartInstance.destroy();
        setChartInstance(null);
    }

    const newChart = new Chart(ctx2, {
        type: "bubble",
        data: {
            datasets: datasetsAgrupados
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,

            onClick: async function(evt, elements, chart) {
                if (!elements.length) return;

                const element = elements[0];
                const datasetIndex = element.datasetIndex;
                const index = element.index;
                const data = chart.data.datasets[datasetIndex].data[index];

                await syncPointWithMapAndLegend(chart, data);
            },

            onHover: (event, elements) => {
                event.native.target.style.cursor = elements.length ? "pointer" : "default";
            },

            resizeDelay: 120,
            animation: false,

            layout: {
                padding: {
                    top: 20,
                    right: isDepartment ? 28 : (isSmallScreen ? 16 : 20),
                    bottom: isDepartment ? 58 : (useVerticalLabels ? 95 : (isSmallScreen ? 40 : 28)),
                    left: isDepartment ? 38 : (isSmallScreen ? 22 : 28)
                }
            },

            elements: {
                point: {
                    hoverRadius: 0
                }
            },

            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const raw = context.raw || {};
                            const xLabel = raw.xLabel || "";
                            const yLabel = raw.yLabel || "";
                            const valor = Number(raw.porcentaje || 0);
                            const totalX = Number(sumaPorX[xLabel] || 0);

                            return [
                                `${yLabel} / ${xLabel}: ${valor.toFixed(2)}%`,
                                `Total ${xLabel}: ${totalX.toFixed(2)}%`
                            ];
                        }
                    }
                }
            },

            scales: {
                x: {
                    type: "linear",
                    min: -0.45,
                    max: Math.max(0, xLabels.length - 1) + 0.45,
                    afterBuildTicks(scale) {
                        scale.ticks = xLabels.map((_, i) => ({ value: i }));
                    },
                    ticks: {
                        display: true,
                        autoSkip: false,
                        maxRotation: isDepartment ? 0 : (useVerticalLabels ? 90 : 0),
                        minRotation: isDepartment ? 0 : (useVerticalLabels ? 90 : 0),
                        align: isDepartment ? "center" : (useVerticalLabels ? "start" : "center"),
                        padding: isDepartment ? 8 : (useVerticalLabels ? 6 : 10),
                        color: "#4a4a4a",
                        font: {
                            size: isDepartment ? 9 : (useVerticalLabels ? 10 : (isSmallScreen ? 10 : 11))
                        },
                        callback: function(value) {
                            const original = xLabels[value] ?? "";
                            if (!original) return "";

                            const label = (isDepartment || useShortLabels) ? shortenXLabel(original) : original;

                            if (useVerticalLabels) return label;

                            if (label.length <= 14) return label;

                            const parts = label.split(" ");
                            if (parts.length === 1) return label;

                            const mid = Math.ceil(parts.length / 2);
                            return [
                                parts.slice(0, mid).join(" "),
                                parts.slice(mid).join(" ")
                            ];
                        }
                    },
                    title: {
                        display: true,
                        text: "Fertilidad",
                        color: "#5a5a5a",
                        font: {
                            size: isSmallScreen ? 11 : 12,
                            weight: "normal"
                        },
                        padding: {
                            top: useVerticalLabels ? 28 : 12
                        }
                    },
                    grid: {
                        display: true,
                        drawBorder: true,
                        color: "rgba(0,0,0,0.10)"
                    }
                },

                y: {
                    type: "linear",
                    min: -0.45,
                    max: Math.max(0, yLabels.length - 1) + 0.45,
                    reverse: true,
                    afterBuildTicks(scale) {
                        scale.ticks = yLabels.map((_, i) => ({ value: i }));
                    },
                    ticks: {
                        display: true,
                        autoSkip: false,
                        padding: isSmallScreen ? 4 : 6,
                        color: "#4a4a4a",
                        font: {
                            size: isDepartment ? 8 : (isSmallScreen ? 8 : 10)
                        },
                        callback: function(value) {
                            const label = yLabels[value] ?? "";
                            if (!isDepartment || label.length <= 18) return label;

                            const parts = String(label).split(" ");
                            if (parts.length < 2) return label.slice(0, 18);
                            const mid = Math.ceil(parts.length / 2);
                            return [
                                parts.slice(0, mid).join(" "),
                                parts.slice(mid).join(" ")
                            ];
                        }
                    },
                    title: {
                        display: true,
                        text: "Orden del suelo",
                        color: "#5a5a5a",
                        font: {
                            size: isSmallScreen ? 11 : 12,
                            weight: "normal"
                        },
                        padding: {
                            bottom: 8
                        }
                    },
                    grid: {
                        display: true,
                        drawBorder: true,
                        color: "rgba(0,0,0,0.10)"
                    }
                }
            }
        },

        plugins: [{
            id: "bubbleLabelsOrdenSuelo",
            afterDatasetsDraw(chart) {
                const { ctx, chartArea } = chart;
                if (!chartArea) return;

                ctx.save();
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";

                chart.data.datasets.forEach((dataset, datasetIndex) => {
                    const meta = chart.getDatasetMeta(datasetIndex);
                    if (!meta || meta.hidden) return;

                    meta.data.forEach((element, index) => {
                        const raw = dataset.data[index];
                        if (!raw) return;

                        const x = element.x;
                        const y = element.y;
                        const r = raw.r || 0;
                        const pct = Number(raw.porcentaje || 0);

                        if (pct <= 0) return;
                        if (isDepartment && (r < 14 || pct < 4)) return;
                        if (!isDepartment && r < 20) return;

                        if (
                            x < chartArea.left ||
                            x > chartArea.right ||
                            y < chartArea.top ||
                            y > chartArea.bottom
                        ) {
                            return;
                        }

                        const label = `${pct.toFixed(1)}%`;

                        const fontSize = isSmallScreen
                            ? Math.max(8, Math.min(9, r * 0.30))
                            : Math.max(9, Math.min(11, r * 0.34));

                        ctx.font = `600 ${fontSize}px Outfit, sans-serif`;

                        const textWidth = ctx.measureText(label).width;
                        if (textWidth > (r * (isSmallScreen ? 1.0 : 1.15))) return;

                        ctx.fillStyle = "#ffffff";
                        ctx.strokeStyle = "rgba(0,0,0,0.35)";
                        ctx.lineWidth = 2;

                        ctx.strokeText(label, x, y);
                        ctx.fillText(label, x, y);
                    });
                });

                ctx.restore();
            }
        }]
    });

    setChartInstance(newChart);
    newChart.__ordenSueloBubble = {
        fullData: fullBubbleData,
        applyActiveOrderCodes
    };

    window.__biofisicoApplyOrdenSueloChartFilter = applyActiveOrderCodes;

    if (canvas.__ordenSueloRestoreDblClickHandler) {
        canvas.removeEventListener("dblclick", canvas.__ordenSueloRestoreDblClickHandler);
    }
    if (canvas.__ordenSueloClickHandler) {
        canvas.removeEventListener("click", canvas.__ordenSueloClickHandler);
    }

    canvas.__ordenSueloClickHandler = async (event) => {
        let active = typeof newChart.getElementsAtEventForMode === "function"
            ? newChart.getElementsAtEventForMode(event, "nearest", { intersect: true }, false)
            : [];
        if (!active?.length) {
            const rect = canvas.getBoundingClientRect();
            const clickX = event.clientX - rect.left;
            const clickY = event.clientY - rect.top;
            const meta = newChart.getDatasetMeta?.(0);
            let nearest = null;

            (meta?.data || []).forEach((element, index) => {
                const raw = newChart.data.datasets?.[0]?.data?.[index];
                if (!element || !raw) return;

                const dx = Number(element.x) - clickX;
                const dy = Number(element.y) - clickY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const tolerance = Math.max(Number(raw.r) || 0, 10) + 4;
                if (distance <= tolerance && (!nearest || distance < nearest.distance)) {
                    nearest = { datasetIndex: 0, index, distance };
                }
            });

            active = nearest ? [nearest] : [];
        }
        if (!active?.length) return;

        const element = active[0];
        const data = newChart.data.datasets?.[element.datasetIndex]?.data?.[element.index];
        await syncPointWithMapAndLegend(newChart, data);
    };
    canvas.addEventListener("click", canvas.__ordenSueloClickHandler);

    canvas.__ordenSueloRestoreDblClickHandler = async (event) => {
        const active = typeof newChart.getElementsAtEventForMode === "function"
            ? newChart.getElementsAtEventForMode(event, "nearest", { intersect: true }, false)
            : [];
        if (active?.length) return;
        await restoreAllChartCategories?.();
    };
    canvas.addEventListener("dblclick", canvas.__ordenSueloRestoreDblClickHandler);
}
