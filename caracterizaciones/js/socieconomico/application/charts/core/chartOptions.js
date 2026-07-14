function normalizeLabelText(label) {
    if (Array.isArray(label)) return label.join(" ");
    return String(label ?? "").replace(/\s+/g, " ").trim();
}

function wrapLongWord(word, chunkSize) {
    if (word.length <= chunkSize) return [word];
    const chunks = [];
    for (let index = 0; index < word.length; index += chunkSize) {
        chunks.push(word.slice(index, index + chunkSize));
    }
    return chunks;
}

export function wrapChartLabel(label, {
    maxLineLength = 16,
    maxLines = 3
} = {}) {
    const text = normalizeLabelText(label);
    if (!text) return [""];

    const words = text.split(" ").flatMap(word => wrapLongWord(word, Math.max(6, maxLineLength - 2)));
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
    if (lines.length <= maxLines) return lines;

    const limited = lines.slice(0, maxLines);
    limited[maxLines - 1] = `${limited[maxLines - 1].slice(0, Math.max(0, maxLineLength - 3)).trim()}...`;
    return limited;
}

export function formatChartLabel(label, options = {}) {
    const lines = wrapChartLabel(label, options);
    return lines.length === 1 ? lines[0] : lines;
}

export function resolveChartLabel(rawLabels = [], index, options = {}) {
    const label = rawLabels[index];
    return formatChartLabel(label, options);
}

function abbreviateAxisLabel(label, {
    maxLength = 8,
    strategy = "short",
    wordLength = 4
} = {}) {
    const text = normalizeLabelText(label);
    if (!text || text.length <= maxLength) return text;

    const connectorWords = new Set(["de", "del", "y", "e"]);
    const words = text
        .replace(/[.,;:]+/g, " ")
        .split(" ")
        .map(word => word.trim())
        .filter(Boolean);
    const significantWords = words.filter(word => !connectorWords.has(word.toLowerCase()));

    if (strategy === "acronym") {
        if (significantWords.length >= 2) {
            return significantWords
                .slice(0, 3)
                .map(word => word[0] || "")
                .join("")
                .toUpperCase();
        }
        return text.slice(0, 3).toUpperCase();
    }

    if (significantWords.length >= 2) {
        const first = significantWords[0].slice(0, Math.min(wordLength, significantWords[0].length));
        const second = significantWords[1].slice(0, Math.min(3, significantWords[1].length));
        return `${first}. ${second}.`;
    }

    return `${text.slice(0, Math.max(3, maxLength - 1)).trim()}.`;
}

function elementIntersectsChartArea(element, chartArea) {
    const props = element?.getProps?.(["x", "y", "base", "width", "height", "horizontal"], true) || element;
    const x = Number(props?.x);
    const y = Number(props?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;

    const base = Number(props?.base);
    const width = Number(props?.width);
    const height = Number(props?.height);
    if ([base, width, height].every(Number.isFinite)) {
        const isHorizontal = Boolean(props?.horizontal);
        const left = isHorizontal ? Math.min(x, base) : x - width / 2;
        const right = isHorizontal ? Math.max(x, base) : x + width / 2;
        const top = isHorizontal ? y - height / 2 : Math.min(y, base);
        const bottom = isHorizontal ? y + height / 2 : Math.max(y, base);
        return Math.min(right, chartArea.right) > Math.max(left, chartArea.left)
            && Math.min(bottom, chartArea.bottom) > Math.max(top, chartArea.top);
    }

    return x >= chartArea.left
        && x <= chartArea.right
        && y >= chartArea.top
        && y <= chartArea.bottom;
}

export function ensureZoomKeepsVisibleData({ chart } = {}) {
    const chartArea = chart?.chartArea;
    if (!chartArea || typeof chart?.resetZoom !== "function") return;
    const hasVisibleElement = (chart.getSortedVisibleDatasetMetas?.() || [])
        .some(meta => (meta?.data || []).some(element => elementIntersectsChartArea(element, chartArea)));
    if (!hasVisibleElement) chart.resetZoom("none");
}

export function buildAdaptiveFont(labels = [], {
    baseSize = 11,
    minSize = 8,
    weight = "600"
} = {}) {
    const normalized = labels.map(normalizeLabelText);
    const longest = normalized.reduce((max, text) => Math.max(max, text.length), 0);
    const count = normalized.length;
    let size = baseSize;
    if (longest > 42) size -= 3;
    else if (longest > 28) size -= 2;
    else if (longest > 18) size -= 1;
    if (count > 18) size -= 1;
    if (count > 32) size -= 1;
    return {
        size: Math.max(minSize, size),
        weight
    };
}

export function createBarChartOptions({
    chartConfig,
    labels,
    rawLabels = labels,
    rowsByLabel,
    yField = chartConfig?.yAxis?.field,
    onBarClick
}) {
    function resolveTickLabel(value, index) {
        const useScaleValue = chartConfig?.xAxis?.tickLabelIndexSource === "value";
        const numericValue = Number(value);
        const labelIndex = useScaleValue && Number.isFinite(numericValue)
            ? Math.round(numericValue)
            : index;
        const fallbackLabel = typeof this?.getLabelForValue === "function"
            ? this.getLabelForValue(value)
            : rawLabels?.[index];
        const sourceLabel = rawLabels?.[labelIndex] ?? fallbackLabel ?? "";
        const labelForAxis = chartConfig?.xAxis?.labelStrategy === "abbreviated"
            ? abbreviateAxisLabel(sourceLabel, {
                maxLength: Number.isFinite(chartConfig?.xAxis?.abbreviationMaxLength)
                    ? chartConfig.xAxis.abbreviationMaxLength
                    : 8,
                strategy: chartConfig?.xAxis?.abbreviationStrategy || "short",
                wordLength: Number.isFinite(chartConfig?.xAxis?.abbreviationWordLength)
                    ? chartConfig.xAxis.abbreviationWordLength
                    : 4
            })
            : sourceLabel;
        return formatChartLabel(labelForAxis, {
            maxLineLength: Number.isFinite(chartConfig?.xAxis?.maxLineLength) ? chartConfig.xAxis.maxLineLength : 16,
            maxLines: Number.isFinite(chartConfig?.xAxis?.maxLines) ? chartConfig.xAxis.maxLines : 3
        });
    }

    function formatTooltipValue(value, { decimals, suffix } = {}) {
        const numericValue = Number(value);
        const formatted = Number.isFinite(numericValue) && Number.isInteger(decimals)
            ? numericValue.toLocaleString("es-CO", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
            : value;
        return `${formatted}${suffix ? ` ${suffix}` : ""}`;
    }

    const bottomPadding = Number.isFinite(chartConfig?.xAxis?.bottomPadding)
        ? chartConfig.xAxis.bottomPadding
        : 8;

    return {
        responsive: Boolean(chartConfig?.responsive),
        maintainAspectRatio: false,
        interaction: { mode: "nearest", intersect: true },
        layout: {
            padding: { top: 10, right: 18, bottom: bottomPadding, left: 6 }
        },
        plugins: {
            legend: { display: false },
            title: { display: false },
            zoom: createZoomOptions(chartConfig?.zoom),
            tooltip: {
                callbacks: {
                    title: items => {
                        const item = items?.[0];
                        if (!item) return "";
                        return normalizeLabelText(rawLabels?.[item.dataIndex] ?? item.label ?? "");
                    },
                    label: context => {
                        const label = chartConfig.yAxis?.label || yField || "";
                        const value = formatTooltipValue(context.parsed.y, {
                            decimals: chartConfig.yAxis?.decimals,
                            suffix: chartConfig.yAxis?.suffix
                        });
                        return label ? `${label}: ${value}` : value;
                    },
                    afterLabel: context => {
                        const attrs = rowsByLabel.get(context.label)?.attributes || {};
                        const yAxisField = String(yField || "").toLowerCase();
                        return (chartConfig.tooltipFields || [])
                            .filter(field => String(field || "").toLowerCase() !== yAxisField)
                            .map(field => `${chartConfig.tooltipLabels?.[field] || field}: ${attrs[field] ?? "Sin dato"}`);
                    }
                }
            }
        },
        scales: {
            x: {
                title: { display: Boolean(chartConfig.xAxis?.label), text: chartConfig.xAxis?.label },
                grid: { display: false },
                ticks: {
                    autoSkip: chartConfig?.xAxis?.autoSkip ?? false,
                    autoSkipPadding: Number.isFinite(chartConfig?.xAxis?.autoSkipPadding)
                        ? chartConfig.xAxis.autoSkipPadding
                        : undefined,
                    maxTicksLimit: Number.isFinite(chartConfig?.xAxis?.maxTicksLimit) ? chartConfig.xAxis.maxTicksLimit : undefined,
                    maxRotation: Number.isFinite(chartConfig?.xAxis?.maxRotation) ? chartConfig.xAxis.maxRotation : 55,
                    minRotation: Number.isFinite(chartConfig?.xAxis?.minRotation) ? chartConfig.xAxis.minRotation : 50,
                    font: Number.isFinite(chartConfig?.xAxis?.fontSize)
                        ? {
                            size: chartConfig.xAxis.fontSize,
                            weight: chartConfig.xAxis.fontWeight || "600",
                            family: chartConfig.xAxis.fontFamily
                        }
                        : buildAdaptiveFont(rawLabels, { baseSize: labels.length > 30 ? 9 : 10, minSize: 8, weight: "600" }),
                    color: chartConfig?.xAxis?.tickColor || "#334155",
                    padding: Number.isFinite(chartConfig?.xAxis?.tickPadding) ? chartConfig.xAxis.tickPadding : 4,
                    callback: resolveTickLabel
                }
            },
            y: {
                beginAtZero: true,
                grace: chartConfig?.yAxis?.grace,
                suggestedMax: Number.isFinite(chartConfig?.yAxis?.suggestedMax) ? chartConfig.yAxis.suggestedMax : undefined,
                title: { display: Boolean(chartConfig.yAxis?.label), text: chartConfig.yAxis?.label },
                grid: { color: "rgba(31, 41, 55, 0.08)" },
                ticks: { font: { size: 10 }, color: "#334155", padding: Number.isFinite(chartConfig?.yAxis?.tickPadding) ? chartConfig.yAxis.tickPadding : 5 }
            }
        },
        onClick: async (event, elements, chart) => {
            if (!elements.length) return;
            const currentLabels = chart?.data?.labels || labels;
            await onBarClick?.(currentLabels[elements[0].index], event, elements);
        }
    };
}

export function createZoomOptions(config = {}) {
    const panConfig = config?.pan || {};
    const panOptions = {
        enabled: panConfig.enabled ?? true,
        mode: panConfig.mode || "x"
    };
    const panModifierKey = panConfig.modifierKey === null
        ? ""
        : (panConfig.modifierKey || "shift");
    if (panModifierKey) panOptions.modifierKey = panModifierKey;
    if (Number.isFinite(panConfig.threshold)) panOptions.threshold = panConfig.threshold;

    const zoomConfig = config?.zoom || {};
    const dragConfig = zoomConfig.drag || {};
    const limitConfig = config?.limits || {};
    const onZoom = zoomConfig.onZoom;
    const onZoomComplete = zoomConfig.onZoomComplete;

    return {
        pan: panOptions,
        zoom: {
            wheel: { enabled: zoomConfig.wheel?.enabled ?? true },
            pinch: { enabled: zoomConfig.pinch?.enabled ?? true },
            drag: {
                enabled: dragConfig.enabled ?? true,
                modifierKey: dragConfig.modifierKey || "ctrl",
                backgroundColor: "rgba(22, 101, 52, 0.12)",
                borderColor: "rgba(22, 101, 52, 0.35)",
                borderWidth: 1
            },
            mode: zoomConfig.mode || "x",
            onZoom(context) {
                ensureZoomKeepsVisibleData(context);
                onZoom?.(context);
            },
            onZoomComplete(context) {
                ensureZoomKeepsVisibleData(context);
                onZoomComplete?.(context);
            }
        },
        limits: {
            x: {
                min: "original",
                max: "original",
                ...(limitConfig.x || {})
            },
            y: {
                min: "original",
                max: "original",
                ...(limitConfig.y || {})
            }
        }
    };
}

export function createVerticalGroupedBarOptions({
    xTitle = "",
    yTitle = "",
    ySuggestedMax = null,
    decimals = 2,
    suffix = "",
    xTicks = {},
    onGroupedBarClick
} = {}) {
    function formatTooltipValue(value) {
        const numericValue = Number(value);
        if (!Number.isFinite(numericValue)) return String(value ?? "");
        return `${numericValue.toLocaleString("es-CO", {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        })}${suffix ? suffix : ""}`;
    }

    return {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "nearest", intersect: true },
        layout: {
            padding: {
                top: 12,
                right: 16,
                bottom: Number.isFinite(xTicks.bottomPadding) ? xTicks.bottomPadding : 8,
                left: 8
            }
        },
        plugins: {
            legend: {
                display: true,
                position: "bottom",
                labels: {
                    boxWidth: 12,
                    color: "#334155",
                    font: { size: 11, weight: "600" }
                }
            },
            title: { display: false },
            zoom: createZoomOptions(),
            tooltip: {
                callbacks: {
                    label: context => {
                        const ds = context.dataset?.label || "";
                        return `${ds}: ${formatTooltipValue(context.parsed?.y)}`;
                    }
                }
            }
        },
        scales: {
            x: {
                stacked: false,
                title: { display: Boolean(xTitle), text: xTitle },
                grid: { display: false },
                ticks: {
                    autoSkip: xTicks.autoSkip ?? false,
                    autoSkipPadding: Number.isFinite(xTicks.autoSkipPadding) ? xTicks.autoSkipPadding : undefined,
                    maxRotation: Number.isFinite(xTicks.maxRotation) ? xTicks.maxRotation : 30,
                    minRotation: Number.isFinite(xTicks.minRotation) ? xTicks.minRotation : 0,
                    color: "#334155",
                    padding: Number.isFinite(xTicks.padding) ? xTicks.padding : 4,
                    font: {
                        size: Number.isFinite(xTicks.fontSize) ? xTicks.fontSize : 10,
                        weight: xTicks.fontWeight || "600"
                    },
                    callback: typeof xTicks.callback === "function" ? xTicks.callback : undefined
                }
            },
            y: {
                stacked: false,
                beginAtZero: true,
                suggestedMax: ySuggestedMax != null ? ySuggestedMax : undefined,
                title: { display: Boolean(yTitle), text: yTitle },
                grid: { color: "rgba(31, 41, 55, 0.08)" },
                ticks: {
                    color: "#334155",
                    font: { size: 10 }
                }
            }
        },
        onClick: async (event, elements, chart) => {
            if (!elements.length) return;
            const el = elements[0];
            await onGroupedBarClick?.({
                datasetIndex: el.datasetIndex,
                dataIndex: el.index,
                chart
            });
        }
    };
}

export function createDefaultBarDataset({ label, data, rows, colors = {} }) {
    const background = colors.background || rows.map(row => row.color || colors.fallback || "#94a3b8");
    const border = colors.border
        ? rows.map(() => colors.border)
        : rows.map(row => row.color || colors.fallback || "#94a3b8");
    const rowCount = Array.isArray(rows) ? rows.length : 0;
    const isSingleBar = rowCount === 1;
    return {
        label,
        data,
        backgroundColor: background,
        borderColor: border,
        borderWidth: 1,
        borderRadius: 4,
        barPercentage: isSingleBar ? 0.5 : 0.68,
        categoryPercentage: isSingleBar ? 0.5 : 0.72,
        maxBarThickness: isSingleBar ? 22 : 24
    };
}

export function createHorizontalStackedBarOptions({
    xTitle = "",
    yTitle = "",
    formatValue = value => value,
    yTickFontSize = 10,
    onBarClick,
    onBarHover,
    onBarLeave
} = {}) {
    let lastHoverKey = "";
    return {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "nearest", intersect: true },
        plugins: {
            legend: {
                position: "bottom",
                labels: { boxWidth: 12, color: "#334155", font: { size: 11, weight: "600" } }
            },
            title: { display: false },
            tooltip: {
                callbacks: {
                    label: context => {
                        const label = context.dataset?.label || "";
                        return `${label}: ${formatValue(context.parsed.x)}`;
                    }
                }
            }
        },
        scales: {
            x: {
                stacked: true,
                beginAtZero: true,
                title: { display: Boolean(xTitle), text: xTitle },
                grid: { color: "rgba(31, 41, 55, 0.08)" },
                ticks: { precision: 0, color: "#334155", font: { size: 10 } }
            },
            y: {
                stacked: true,
                title: { display: Boolean(yTitle), text: yTitle },
                grid: { display: false },
                ticks: {
                    autoSkip: false,
                    color: "#334155",
                    font: { size: yTickFontSize, weight: "600" }
                }
            }
        },
        onHover: (event, elements, chart) => {
            if (!elements.length) {
                if (lastHoverKey) {
                    lastHoverKey = "";
                    onBarLeave?.();
                }
                return;
            }
            const element = elements[0];
            const sector = chart.data.datasets[element.datasetIndex]?.label;
            const label = chart.data.rawLabels?.[element.index] || chart.data.labels[element.index];
            const hoverKey = `${sector}|${label}`;
            if (hoverKey === lastHoverKey) return;
            lastHoverKey = hoverKey;
            onBarHover?.({ sector, label, event, elements, chart });
        },
        onClick: async (event, elements, chart) => {
            if (!elements.length) return;
            const element = elements[0];
            await onBarClick?.({
                sector: chart.data.datasets[element.datasetIndex]?.label,
                label: chart.data.rawLabels?.[element.index] || chart.data.labels[element.index],
                event,
                elements,
                chart
            });
        }
    };
}

export function createVerticalStackedBarOptions({
    xTitle = "",
    yTitle = "",
    formatValue = value => value,
    onBarClick
} = {}) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "nearest", intersect: true },
        plugins: {
            legend: {
                position: "bottom",
                labels: { boxWidth: 12, color: "#334155", font: { size: 11, weight: "600" } }
            },
            title: { display: false },
            tooltip: {
                callbacks: {
                    label: context => {
                        const label = context.dataset?.label || "";
                        return `${label}: ${formatValue(context.parsed.y)}`;
                    }
                }
            }
        },
        scales: {
            x: {
                stacked: true,
                title: { display: Boolean(xTitle), text: xTitle },
                grid: { display: false },
                ticks: {
                    autoSkip: false,
                    maxRotation: 45,
                    minRotation: 35,
                    color: "#334155",
                    font: { size: 10, weight: "600" }
                }
            },
            y: {
                stacked: true,
                beginAtZero: true,
                title: { display: Boolean(yTitle), text: yTitle },
                grid: { color: "rgba(31, 41, 55, 0.08)" },
                ticks: { precision: 0, color: "#334155", font: { size: 10 } }
            }
        },
        onClick: async (event, elements, chart) => {
            if (!elements.length) return;
            const element = elements[0];
            await onBarClick?.({
                category: chart.data.labels[element.index],
                component: chart.data.datasets[element.datasetIndex]?.label,
                event,
                elements,
                chart
            });
        }
    };
}

export function createPieChartOptions({
    formatValue = value => value,
    showLegend = true,
    onSliceClick,
    onSliceHover,
    onSliceLeave
} = {}) {
    let lastHoverLabel = "";
    return {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "nearest", intersect: true },
        plugins: {
            legend: {
                display: showLegend,
                position: "bottom",
                labels: { boxWidth: 12, color: "#334155", font: { size: 11, weight: "600" } }
            },
            tooltip: {
                callbacks: {
                    label: context => {
                        const label = normalizeLabelText(context.label);
                        return `${label}: ${formatValue(context.parsed)}`;
                    }
                }
            }
        },
        onClick: async (event, elements, chart) => {
            if (!elements.length) return;
            const index = elements[0].index;
            await onSliceClick?.(chart.data.labels[index], event, elements);
        },
        onHover: (event, elements, chart) => {
            if (!elements.length) {
                if (lastHoverLabel) {
                    lastHoverLabel = "";
                    onSliceLeave?.();
                }
                return;
            }
            const label = normalizeLabelText(chart.data.labels[elements[0].index]);
            if (label === lastHoverLabel) return;
            lastHoverLabel = label;
            onSliceHover?.(label, event, elements);
        }
    };
}

export function createMultiSeriesDoughnutOptions({
    formatValue = value => value
} = {}) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "nearest", intersect: true },
        cutout: "38%",
        plugins: {
            legend: {
                position: "bottom",
                labels: { boxWidth: 12, color: "#334155", font: { size: 11, weight: "600" } }
            },
            tooltip: {
                callbacks: {
                    label: context => {
                        const datasetLabel = context.dataset?.label || "";
                        const label = normalizeLabelText(context.label);
                        return `${datasetLabel} - ${label}: ${formatValue(context.parsed)}`;
                    }
                }
            },
            title: { display: false }
        }
    };
}
