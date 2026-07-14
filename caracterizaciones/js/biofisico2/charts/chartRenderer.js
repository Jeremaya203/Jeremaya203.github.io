let activeChart = null;

const DEFAULT_HYPSOMETRY_COLORS = {
    1001: { color: "rgba(175,240,233,1)", label: "< - 0" },
    1002: { color: "rgba(177,242,211,1)", label: "0 - 1" },
    1003: { color: "rgba(176,245,185,1)", label: "1 - 2" },
    1004: { color: "rgba(195,247,178,1)", label: "2 - 5" },
    1005: { color: "rgba(223,250,177,1)", label: "5 - 10" },
    1006: { color: "rgba(255,255,179,1)", label: "10 - 20" },
    1007: { color: "rgba(199,230,129,1)", label: "20 - 30" },
    1008: { color: "rgba(133,204,86,1)", label: "30 - 40" },
    1009: { color: "rgba(63,179,50,1)", label: "40 - 50" },
    1010: { color: "rgba(21,153,48,1)", label: "50 - 75" },
    1011: { color: "rgba(0,128,64,1)", label: "75 - 100" },
    1012: { color: "rgba(49,142,58,1)", label: "100 - 150" },
    1013: { color: "rgba(98,156,52,1)", label: "150 - 200" },
    1014: { color: "rgba(147,170,46,1)", label: "200 - 250" },
    1015: { color: "rgba(197,185,40,1)", label: "250 - 300" },
    1016: { color: "rgba(245,196,37,1)", label: "300 - 400" },
    1017: { color: "rgba(222,147,27,1)", label: "400 - 500" },
    1018: { color: "rgba(199,102,18,1)", label: "500 - 600" },
    1019: { color: "rgba(173,59,10,1)", label: "600 - 700" },
    1020: { color: "rgba(150,26,5,1)", label: "700 - 800" },
    1021: { color: "rgba(128,0,0,1)", label: "800 - 900" },
    1022: { color: "rgba(126,12,3,1)", label: "900 - 1000" },
    1023: { color: "rgba(125,25,7,1)", label: "1000 - 1250" },
    1024: { color: "rgba(124,37,10,1)", label: "1250 - 1500" },
    1025: { color: "rgba(123,50,14,1)", label: "1500 - 1750" },
    1026: { color: "rgba(121,62,17,1)", label: "1750 - 2000" },
    1027: { color: "rgba(134,87,51,1)", label: "2000 - 2250" },
    1028: { color: "rgba(147,111,84,1)", label: "2250 - 2500" },
    1029: { color: "rgba(159,136,118,1)", label: "2500 - 3000" },
    1030: { color: "rgba(172,160,151,1)", label: "3000 - 3500" },
    1031: { color: "rgba(185,185,185,1)", label: "3500 - 4000" },
    1032: { color: "rgba(198,198,198,1)", label: "4000 - 4500" },
    1033: { color: "rgba(212,212,212,1)", label: "4500 - 5000" },
    1034: { color: "rgba(225,225,226,1)", label: "5000 - 5500" },
    1035: { color: "rgba(239,239,240,1)", label: "5500 - >" }
};

function toChartNumber(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    const parsed = Number(String(value ?? "").trim().replace(/\s/g, "").replace("%", "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
}

function getHypsometryColors(deps = {}) {
    const globalColors = typeof coloresHipsometricos !== "undefined"
        ? coloresHipsometricos
        : globalThis.coloresHipsometricos;
    const colors = deps.coloresHipsometricos || globalColors || {};
    return Object.keys(colors).length ? colors : DEFAULT_HYPSOMETRY_COLORS;
}

function getHypsometryCode(value, colors) {
    const raw = String(value ?? "").trim();
    if (!raw) return null;
    if (colors?.[raw]) return raw;

    const numeric = Number(raw.replace(",", "."));
    if (Number.isFinite(numeric)) {
        const code = String(Math.trunc(numeric));
        if (colors?.[code]) return code;
    }

    const match = Object.entries(colors || {})
        .find(([, info]) => String(info?.label ?? "").trim() === raw);
    return match?.[0] || raw;
}

function buildHypsometrySeries(features, config, deps = {}) {
    const colorsDict = getHypsometryColors(deps);
    const areaByCode = {};
    const pctByCode = {};
    let totalArea = 0;

    for (const feature of features || []) {
        const attrs = feature.attributes || {};
        const code = getHypsometryCode(attrs[config.labelField], colorsDict);
        if (!code) continue;

        const area = toChartNumber(attrs.areat);
        if (area > 0) {
            areaByCode[code] = (areaByCode[code] || 0) + area;
            totalArea += area;
            continue;
        }

        const pct = toChartNumber(attrs[config.valueField]);
        if (pct > 0) pctByCode[code] = (pctByCode[code] || 0) + pct;
    }

    const dataByCode = totalArea > 0
        ? Object.fromEntries(Object.entries(areaByCode).map(([code, area]) => [code, (area / totalArea) * 100]))
        : pctByCode;

    const codes = Object.keys(colorsDict)
        .map(Number)
        .sort((a, b) => a - b)
        .map(String)
        .filter(code => toChartNumber(dataByCode[code]) > 0)
        .reverse();

    return {
        labels: codes.map(code => colorsDict?.[code]?.label || code),
        values: codes.map(code => Number(toChartNumber(dataByCode[code]).toFixed(4))),
        colors: codes.map(code => colorsDict?.[code]?.color || "#999")
    };
}

function formatPiePercentLabel(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "";

    return `${number.toLocaleString("es-CO", {
        maximumFractionDigits: 2,
        minimumFractionDigits: number % 1 === 0 ? 0 : 1
    })}%`;
}

function createPiePercentageLabelsPlugin() {
    return {
        id: "biofisicoPiePercentageLabels",
        afterDatasetsDraw(chart) {
            const chartType = chart.config?.type;
            if (chartType !== "pie" && chartType !== "doughnut") return;
            if ((chart.data?.datasets || []).length > 1) return;
            if ((chart.data?.datasets || []).some(dataset => Array.isArray(dataset?.__segments))) return;

            const { ctx, chartArea } = chart;
            const internalBoxes = [];
            const externalLabels = [];
            const fontSize = 11;
            const labelHeight = 16;

            const overlaps = (box, boxes) => boxes.some(other =>
                box.left < other.right &&
                box.right > other.left &&
                box.top < other.bottom &&
                box.bottom > other.top
            );

            const drawText = (text, x, y, align = "center") => {
                ctx.save();
                ctx.textAlign = align;
                ctx.textBaseline = "middle";
                ctx.font = `600 ${fontSize}px sans-serif`;
                ctx.fillStyle = "#17352d";
                ctx.fillText(text, x, y);
                ctx.restore();
            };

            chart.data.datasets.forEach((dataset, datasetIndex) => {
                const meta = chart.getDatasetMeta(datasetIndex);
                if (!meta || meta.hidden) return;

                meta.data.forEach((arc, dataIndex) => {
                    if (!arc || arc.hidden) return;

                    const value = Number(dataset?.__segments?.[dataIndex]?.value ?? dataset.data?.[dataIndex]);
                    if (!Number.isFinite(value) || value <= 0) return;

                    const text = formatPiePercentLabel(value);
                    if (!text) return;

                    const arcProps = typeof arc.getProps === "function"
                        ? arc.getProps(["x", "y", "startAngle", "circumference", "outerRadius", "innerRadius"], true)
                        : arc;
                    const centerX = Number(arcProps.x ?? arc.x ?? 0);
                    const centerY = Number(arcProps.y ?? arc.y ?? 0);
                    const circumference = Number(arcProps.circumference || 0);
                    const outerRadius = Number(arcProps.outerRadius || 0);
                    const innerRadius = Number(arcProps.innerRadius || 0);
                    const radialWidth = outerRadius - innerRadius;
                    const angle = Number(arcProps.startAngle || 0) + circumference / 2;
                    const midRadius = innerRadius + radialWidth * 0.56;
                    const arcLength = Math.abs(circumference) * Math.max(midRadius, 1);
                    const textWidth = text.length * fontSize * 0.62 + 6;
                    const cos = Math.cos(angle);
                    const sin = Math.sin(angle);
                    const internalX = centerX + cos * midRadius;
                    const internalY = centerY + sin * midRadius;
                    const internalBox = {
                        left: internalX - textWidth / 2,
                        right: internalX + textWidth / 2,
                        top: internalY - labelHeight / 2,
                        bottom: internalY + labelHeight / 2
                    };
                    const hasInternalSpace = Math.abs(circumference) >= 0.28 &&
                        arcLength >= textWidth + 10 &&
                        radialWidth >= 14;

                    if (hasInternalSpace && !overlaps(internalBox, internalBoxes)) {
                        internalBoxes.push(internalBox);
                        drawText(text, internalX, internalY);
                        return;
                    }

                    const side = Math.cos(angle) >= 0 ? "right" : "left";
                    const startRadius = Math.max(innerRadius, outerRadius - 0.5);
                    externalLabels.push({
                        text,
                        side,
                        y: centerY + sin * (outerRadius + 16),
                        anchorX: centerX + cos * startRadius,
                        anchorY: centerY + sin * startRadius,
                        textX: side === "right"
                            ? Math.min(chartArea.right - 2, centerX + outerRadius + 34)
                            : Math.max(chartArea.left + 2, centerX - outerRadius - 34)
                    });
                });
            });

            const adjustExternalLabels = (items) => {
                const sorted = items.sort((a, b) => a.y - b.y);
                const minY = chartArea.top + 10;
                const maxY = chartArea.bottom - 10;
                const gap = 15;

                sorted.forEach((item, index) => {
                    const previous = sorted[index - 1];
                    const minAllowed = previous ? previous.y + gap : minY;
                    item.y = Math.max(minAllowed, Math.min(maxY, item.y));
                });

                for (let i = sorted.length - 2; i >= 0; i--) {
                    sorted[i].y = Math.min(sorted[i].y, sorted[i + 1].y - gap);
                }

                sorted.forEach(item => {
                    item.y = Math.max(minY, Math.min(maxY, item.y));
                });
            };

            adjustExternalLabels(externalLabels.filter(item => item.side === "left"));
            adjustExternalLabels(externalLabels.filter(item => item.side === "right"));

            ctx.save();
            ctx.strokeStyle = "rgba(23,53,45,0.72)";
            ctx.lineWidth = 1.15;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.fillStyle = "#17352d";
            ctx.font = `600 ${fontSize}px sans-serif`;
            ctx.textBaseline = "middle";

            externalLabels.forEach(item => {
                const lineEndX = item.side === "right" ? item.textX - 4 : item.textX + 4;
                ctx.beginPath();
                ctx.moveTo(item.anchorX, item.anchorY);
                ctx.lineTo(lineEndX, item.y);
                ctx.stroke();

                ctx.beginPath();
                ctx.arc(item.anchorX, item.anchorY, 1.35, 0, Math.PI * 2);
                ctx.fill();

                ctx.textAlign = item.side === "right" ? "left" : "right";
                ctx.fillText(item.text, item.textX, item.y);
            });

            ctx.restore();
        }
    };
}

function withPiePercentageLabels(config) {
    if (config?.type !== "pie" && config?.type !== "doughnut") return config;
    config.plugins = [
        ...(config.plugins || []),
        createPiePercentageLabelsPlugin()
    ];
    return config;
}

export function destroyActiveChart() {
    if (activeChart) {
        activeChart.destroy();
        activeChart = null;
    }
}

export function renderChart(canvas, config) {
    destroyActiveChart();
    activeChart = new Chart(canvas.getContext("2d"), withPiePercentageLabels(config));
    return activeChart;
}

export function getActiveChart() {
    return activeChart;
}

export function renderGenericChartFromFeatures(ctx, features, deps = {}) {
    const { config } = ctx;

    deps.hideTimeSlider?.();

    if (config?.id === "hipsometria") {
        const { labels, values, colors } = buildHypsometrySeries(features, config, deps);
        ctx.crearGrafica(labels, values, colors, "bar", false);
        ctx.actualizarLeyenda(labels, colors);
        return;
    }

    const data = {};

    features.forEach(feature => {
        const attrs = feature.attributes || {};
        const label = attrs[config.labelField];
        const value = Number(attrs[config.valueField]) || 0;
        data[label] = (data[label] || 0) + value;
    });

    const labels = Object.keys(data);
    const values = Object.values(data);
    const colors = labels.map(() => "#999");

    ctx.crearGrafica(labels, values, colors, "bar", false);
    ctx.actualizarLeyenda(labels, colors);
}

export function toggleDualCharts(show) {
    const dual = document.getElementById("geoformasCharts");
    const single = document.getElementById("chart");

    if (dual) dual.style.display = show ? "block" : "none";
    if (single) single.style.display = show ? "none" : "block";
}

export function destroyDualChartInstances(refs) {
    if (refs.geoPieChartInstance) {
        refs.geoPieChartInstance.destroy();
        refs.geoPieChartInstance = null;
    }

    if (refs.geoDonutChartInstance) {
        refs.geoDonutChartInstance.destroy();
        refs.geoDonutChartInstance = null;
    }
}

export function renderVocacionDualCharts({
    pieLabels,
    pieValues,
    pieColors,
    donutLabels,
    donutValues,
    donutColors,
    selectedVocacion
}, refs, deps) {
    toggleDualCharts(true);
    destroyDualChartInstances(refs);
    document.getElementById("geoformasChartLegend")?.remove();

    const pieTitle = document.getElementById("geoPieTitle");
    const donutTitle = document.getElementById("geoDonutTitle");
    const donutSubtitle = document.getElementById("geoDonutSubtitle");

    if (pieTitle) pieTitle.textContent = "Vocación";
    if (donutTitle) donutTitle.textContent = "Uso principal";
    if (donutSubtitle) donutSubtitle.textContent = `Vocación: ${selectedVocacion || "Todas"}`;

    const pieCanvas = document.getElementById("geoPieChart");
    const donutCanvas = document.getElementById("geoDonutChart");
    const pieWrap = pieCanvas?.parentElement;
    const donutWrap = donutCanvas?.parentElement;

    if (pieWrap) pieWrap.style.display = "block";
    if (donutWrap) donutWrap.style.display = "block";

    if (pieCanvas) pieCanvas.style.cursor = "pointer";
    if (donutCanvas) donutCanvas.style.cursor = "pointer";

    refs.geoPieChartInstance = new Chart(pieCanvas.getContext("2d"), withPiePercentageLabels({
        type: "pie",
        data: {
            labels: pieLabels,
            datasets: [{
                data: pieValues,
                backgroundColor: pieColors,
                borderColor: "#ffffff",
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: true, position: "bottom" }
            },
            onClick: async function (_evt, elements) {
                if (!elements.length) return;

                const idx = elements[0].index;
                const vocacionLabel = pieLabels[idx];

                window.__vocacionSelectedLabel = vocacionLabel;

                const vocacionCode = deps.findVocacionCodeByLabel(vocacionLabel);
                if (!vocacionCode) return;

                await deps.zoomMapaVocacion(vocacionCode);

                const clickedLayer = deps.getLayerGlobal();
                const clickedConfig = deps.getActiveLayerConfig();

                if (clickedLayer && !clickedLayer.destroyed) {
                    await deps.actualizarGrafica(clickedLayer, clickedConfig, { skipSyncMap: true });
                }
            },
            onHover: (event, elements) => {
                event.native.target.style.cursor = elements.length ? "pointer" : "default";
            }
        }
    }));

    refs.geoDonutChartInstance = new Chart(donutCanvas.getContext("2d"), withPiePercentageLabels({
        type: "doughnut",
        data: {
            labels: donutLabels,
            datasets: [{
                data: donutValues,
                backgroundColor: donutColors,
                borderColor: "#ffffff",
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            cutout: "58%",
            plugins: {
                legend: { display: true, position: "bottom" }
            },
            onClick: async function (_evt, elements) {
                if (!elements.length) return;

                const idx = elements[0].index;
                const usoLabel = donutLabels[idx];
                const vocacionLabel = selectedVocacion;

                const codes = deps.findVocacionUsoCodesByLabels(vocacionLabel, usoLabel);
                if (!codes) return;

                await deps.zoomMapaVocacion(codes.vocacion, codes.usopvoc);

                const clickedLayer = deps.getLayerGlobal();
                const clickedConfig = deps.getActiveLayerConfig();

                if (clickedLayer && !clickedLayer.destroyed) {
                    await deps.actualizarGrafica(clickedLayer, clickedConfig, { skipSyncMap: true });
                }
            },
            onHover: (event, elements) => {
                event.native.target.style.cursor = elements.length ? "pointer" : "default";
            }
        }
    }));
}

export function renderGeoformasDualCharts({
    paisajeSegments = [],
    relieveSegments = []
}, refs, deps) {
    toggleDualCharts(true);
    destroyDualChartInstances(refs);

    const pieCanvas = document.getElementById("geoPieChart");
    const donutCanvas = document.getElementById("geoDonutChart");
    const pieWrap = pieCanvas?.parentElement;
    const donutWrap = donutCanvas?.parentElement;
    const pieTitle = document.getElementById("geoPieTitle");
    const donutSubtitle = document.getElementById("geoDonutSubtitle");

    if (pieWrap) pieWrap.style.display = "block";
    if (donutWrap) donutWrap.style.display = "none";
    if (pieTitle) pieTitle.textContent = "Geoformas";
    if (donutSubtitle) donutSubtitle.textContent = "";
    if (!pieCanvas) return;

    pieCanvas.style.cursor = "pointer";

    const formatPercent = value => `${Number(value || 0).toLocaleString("es-CO", {
        maximumFractionDigits: 2
    })}%`;
    const transparent = "rgba(0,0,0,0)";
    const innerColors = paisajeSegments.map(segment => segment.color);
    const outerColors = relieveSegments.map(segment => segment.color);

    refs.geoPieChartInstance = new Chart(pieCanvas.getContext("2d"), withPiePercentageLabels({
        type: "doughnut",
        data: {
            labels: [
                ...paisajeSegments.map(segment => segment.label),
                ...relieveSegments.map(segment => segment.label)
            ],
            datasets: [
                {
                    label: "Paisajes",
                    data: paisajeSegments.map(segment => segment.value),
                    backgroundColor: innerColors,
                    borderColor: "#ffffff",
                    borderWidth: 2,
                    weight: 0.85,
                    __segments: paisajeSegments,
                    __fullColors: innerColors
                },
                {
                    label: "Tipos de relieve",
                    data: relieveSegments.map(segment => segment.value),
                    backgroundColor: outerColors,
                    borderColor: "#ffffff",
                    borderWidth: 2,
                    weight: 1.15,
                    __segments: relieveSegments,
                    __fullColors: outerColors
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            cutout: "38%",
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label(context) {
                            const segment = context.dataset.__segments?.[context.dataIndex];
                            if (!segment) return "";
                            return `${context.dataset.label}: ${segment.label} ${formatPercent(segment.value)}`;
                        }
                    }
                }
            },
            onClick: async function (_evt, elements) {
                if (!elements.length) return;

                const element = elements[0];
                const chart = refs.geoPieChartInstance;
                const dataset = chart?.data?.datasets?.[element.datasetIndex];
                const segment = dataset?.__segments?.[element.index];
                if (!segment) return;

                const clickedLayer = deps.getLayerGlobal();
                const clickedConfig = deps.getActiveLayerConfig();
                const clickedCycle = deps.getRenderCycleId();
                const isPaisaje = element.datasetIndex === 0;
                const activeCodes = isPaisaje ? (segment.childCodes || [segment.code]) : [segment.code];

                await deps.setCategoryCodesActive?.(activeCodes, "chart");

                if (isPaisaje) {
                    await deps.zoomMapaGeoformas(segment.code);
                } else {
                    await deps.zoomMapaGeoformas(segment.paisajeCode, segment.code);
                }

                if (
                    clickedCycle === deps.getRenderCycleId() &&
                    clickedLayer &&
                    !clickedLayer.destroyed &&
                    clickedLayer === deps.getLayerGlobal()
                ) {
                    await deps.actualizarGrafica(clickedLayer, clickedConfig, { skipSyncMap: true });
                }
            },
            onHover: (event, elements) => {
                event.native.target.style.cursor = elements.length ? "pointer" : "default";
            }
        }
    }));
    refs.geoPieChartInstance.__geoformasMultiSeries = {
        paisajeSegments,
        relieveSegments
    };

    window.__biofisicoApplyGeoformasChartFilter = (activeCodesInput) => {
        const chart = refs.geoPieChartInstance;
        if (!chart || chart.destroyed) return;

        const activeCodes = activeCodesInput instanceof Set
            ? activeCodesInput
            : new Set(Array.isArray(activeCodesInput) ? activeCodesInput : []);

        chart.data.datasets.forEach((dataset, datasetIndex) => {
            dataset.backgroundColor = dataset.__segments.map((segment, index) => {
                const isPaisaje = datasetIndex === 0;
                const visible = isPaisaje
                    ? activeCodes.has(String(segment.code)) || (segment.childCodes || []).some(code => activeCodes.has(String(code)))
                    : activeCodes.has(String(segment.code)) || activeCodes.has(String(segment.paisajeCode));

                return visible ? dataset.__fullColors[index] : transparent;
            });

            dataset.borderColor = dataset.__segments.map((segment) => {
                const isPaisaje = datasetIndex === 0;
                const visible = isPaisaje
                    ? activeCodes.has(String(segment.code)) || (segment.childCodes || []).some(code => activeCodes.has(String(code)))
                    : activeCodes.has(String(segment.code)) || activeCodes.has(String(segment.paisajeCode));

                return visible ? "#ffffff" : transparent;
            });
        });

        chart.update("none");
    };

    pieCanvas.ondblclick = async (event) => {
        const chart = refs.geoPieChartInstance;
        const active = typeof chart?.getElementsAtEventForMode === "function"
            ? chart.getElementsAtEventForMode(event, "nearest", { intersect: true }, false)
            : [];

        if (active?.length) return;

        await deps.restoreAllChartCategories?.();
    };

    refs.geoDonutChartInstance = null;
}
