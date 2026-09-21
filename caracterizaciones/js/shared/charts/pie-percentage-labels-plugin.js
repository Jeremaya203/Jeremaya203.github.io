// Plugin generico de etiquetas de porcentaje sobre tajadas de pie/doughnut.
//
// Algoritmo: intenta ubicar el texto dentro de la tajada si hay espacio suficiente;
// si no cabe, lo saca con una linea guia hacia el exterior del circulo, evitando
// solapamientos entre etiquetas externas consecutivas. Incluye halo para legibilidad.

export function formatPercentEs(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "";
    return `${n.toLocaleString("es-CO", { minimumFractionDigits: 0, maximumFractionDigits: 1 })}%`;
}

export function createPiePercentageLabelsPlugin({
    id = "piePercentageLabels",
    textColor = "#17352d",
    guideColor = "rgba(23,53,45,0.72)",
    haloColor = "rgba(255,255,255,0.9)",
    fontFamily = "Outfit, sans-serif",
    fontWeight = 600,
    fontSize = 11,
    formatValue = formatPercentEs,
    resolveValue = (dataset, dataIndex) => Number(dataset?.data?.[dataIndex]),
    valuesArePercentages = true,
    shouldSkip = (chart) => (chart.data?.datasets || []).length > 1
} = {}) {
    return {
        id,
        afterDatasetsDraw(chart) {
            const chartType = chart.config?.type;
            if (chartType !== "pie" && chartType !== "doughnut") return;
            if (shouldSkip(chart)) return;

            const dataset = chart.data?.datasets?.[0];
            if (!dataset) return;

            let total = 1;
            if (!valuesArePercentages) {
                total = (dataset.data || []).reduce((sum, _, index) => {
                    const raw = Number(resolveValue(dataset, index));
                    return sum + (Number.isFinite(raw) && raw > 0 ? raw : 0);
                }, 0);
                if (total <= 0) return;
            }

            const { ctx, chartArea } = chart;
            const internalBoxes = [];
            const externalLabels = [];
            const labelHeight = 16;
            const font = `${fontWeight} ${fontSize}px ${fontFamily}`;
            const isNarrowChart = Number(chart.width || 0) <= 520;
            const safeHorizontalPadding = isNarrowChart ? 7 : 5;
            const labelBounds = {
                left: safeHorizontalPadding,
                right: Math.max(safeHorizontalPadding, Number(chart.width || chartArea.right) - safeHorizontalPadding)
            };

            const measureTextWidth = (text) => {
                ctx.save();
                ctx.font = font;
                const width = Math.ceil(ctx.measureText(text).width);
                ctx.restore();
                return Math.max(width, fontSize * 2);
            };

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
                ctx.font = font;
                ctx.lineJoin = "round";
                ctx.miterLimit = 2;
                ctx.lineWidth = 3;
                ctx.strokeStyle = haloColor;
                ctx.strokeText(text, x, y);
                ctx.fillStyle = textColor;
                ctx.fillText(text, x, y);
                ctx.restore();
            };

            const meta = chart.getDatasetMeta(0);
            if (!meta) return;

            meta.data.forEach((arc, dataIndex) => {
                if (!arc || arc.hidden) return;
                if (chart.getDataVisibility && !chart.getDataVisibility(dataIndex)) return;

                const rawValue = Number(resolveValue(dataset, dataIndex));
                if (!Number.isFinite(rawValue) || rawValue <= 0) return;

                const percent = valuesArePercentages ? rawValue : (rawValue / total) * 100;
                const text = formatValue(percent);
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
                const textWidth = measureTextWidth(text) + 2;
                const minInternalRadius = innerRadius + radialWidth * 0.54;
                const maxInternalRadius = innerRadius + radialWidth * 0.78;
                const requiredInternalRadius = (textWidth + 8) /
                    Math.max(Math.abs(circumference), 0.001);
                const internalRadius = Math.min(
                    maxInternalRadius,
                    Math.max(minInternalRadius, requiredInternalRadius)
                );
                const arcLength = Math.abs(circumference) * Math.max(internalRadius, 1);
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);
                const internalX = centerX + cos * internalRadius;
                const internalY = centerY + sin * internalRadius;
                const internalBox = {
                    left: internalX - textWidth / 2,
                    right: internalX + textWidth / 2,
                    top: internalY - labelHeight / 2,
                    bottom: internalY + labelHeight / 2
                };
                const hasInternalSpace = Math.abs(circumference) >= 0.16 &&
                    requiredInternalRadius <= maxInternalRadius &&
                    arcLength >= textWidth + 8 &&
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
                    textWidth,
                    side,
                    y: centerY + sin * (outerRadius + 16),
                    anchorX: centerX + cos * startRadius,
                    anchorY: centerY + sin * startRadius,
                    textX: side === "right"
                        ? Math.max(
                            labelBounds.left,
                            Math.min(
                                labelBounds.right - textWidth,
                                centerX + outerRadius + (isNarrowChart ? 18 : 34)
                            )
                        )
                        : Math.min(
                            labelBounds.right,
                            Math.max(
                                labelBounds.left + textWidth,
                                centerX - outerRadius - (isNarrowChart ? 18 : 34)
                            )
                        )
                });
            });

            const adjustExternalLabels = (items) => {
                const sorted = items.sort((a, b) => a.y - b.y);
                if (!sorted.length) return;

                const minY = chartArea.top + labelHeight / 2 + 3;
                const maxY = chartArea.bottom - labelHeight / 2 - 3;
                const availableHeight = Math.max(0, maxY - minY);
                const gap = sorted.length > 1
                    ? Math.min(labelHeight + 4, availableHeight / (sorted.length - 1))
                    : 0;

                sorted[0].y = Math.max(minY, Math.min(maxY, sorted[0].y));
                for (let index = 1; index < sorted.length; index++) {
                    const desiredY = Math.max(minY, Math.min(maxY, sorted[index].y));
                    sorted[index].y = Math.max(desiredY, sorted[index - 1].y + gap);
                }

                if (sorted[sorted.length - 1].y > maxY) {
                    sorted[sorted.length - 1].y = maxY;
                    for (let index = sorted.length - 2; index >= 0; index--) {
                        sorted[index].y = Math.min(
                            sorted[index].y,
                            sorted[index + 1].y - gap
                        );
                    }
                }

                if (sorted[0].y < minY) {
                    const displacement = minY - sorted[0].y;
                    sorted.forEach(item => {
                        item.y = Math.min(maxY, item.y + displacement);
                    });
                }
            };

            adjustExternalLabels(externalLabels.filter(item => item.side === "left"));
            adjustExternalLabels(externalLabels.filter(item => item.side === "right"));

            ctx.save();
            ctx.fillStyle = textColor;
            ctx.font = font;
            ctx.textBaseline = "middle";

            externalLabels.forEach(item => {
                const lineEndX = item.side === "right" ? item.textX - 4 : item.textX + 4;
                const direction = item.side === "right" ? 1 : -1;
                const elbowX = direction > 0
                    ? Math.min(lineEndX, item.anchorX + (isNarrowChart ? 9 : 14))
                    : Math.max(lineEndX, item.anchorX - (isNarrowChart ? 9 : 14));
                const elbowY = item.anchorY + ((item.y - item.anchorY) * 0.65);

                ctx.strokeStyle = guideColor;
                ctx.lineWidth = 1.15;
                ctx.lineCap = "round";
                ctx.lineJoin = "round";
                ctx.beginPath();
                ctx.moveTo(item.anchorX, item.anchorY);
                ctx.lineTo(elbowX, elbowY);
                ctx.lineTo(lineEndX, item.y);
                ctx.stroke();

                ctx.beginPath();
                ctx.arc(item.anchorX, item.anchorY, 1.35, 0, Math.PI * 2);
                ctx.fill();

                ctx.textAlign = item.side === "right" ? "left" : "right";
                ctx.lineWidth = 3;
                ctx.strokeStyle = haloColor;
                ctx.strokeText(item.text, item.textX, item.y);
                ctx.fillText(item.text, item.textX, item.y);
            });

            ctx.restore();
        }
    };
}

export function withPiePercentageLabels(config, pluginOptions = {}) {
    if (config?.type !== "pie" && config?.type !== "doughnut") return config;
    config.plugins = [
        ...(config.plugins || []),
        createPiePercentageLabelsPlugin(pluginOptions)
    ];
    return config;
}
