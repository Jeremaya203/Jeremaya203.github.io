function roundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
        ctx.roundRect(x, y, width, height, radius);
        return;
    }
    ctx.rect(x, y, width, height);
}

function boxesOverlap(a, b, gap = 2) {
    return !(
        a.right + gap < b.left ||
        a.left - gap > b.right ||
        a.bottom + gap < b.top ||
        a.top - gap > b.bottom
    );
}

function boxFitsChartArea(box, chartArea) {
    return box.left >= chartArea.left
        && box.right <= chartArea.right
        && box.top >= chartArea.top
        && box.bottom <= chartArea.bottom;
}

function barIntersectsChartArea(props, chartArea, isHorizontal) {
    const x = Number(props.x);
    const y = Number(props.y);
    const base = Number(props.base);
    const width = Number(props.width);
    const height = Number(props.height);
    if (![x, y, base, width, height].every(Number.isFinite)) return false;

    const bounds = isHorizontal
        ? {
            left: Math.min(x, base),
            right: Math.max(x, base),
            top: y - height / 2,
            bottom: y + height / 2
        }
        : {
            left: x - width / 2,
            right: x + width / 2,
            top: Math.min(y, base),
            bottom: Math.max(y, base)
        };

    const visibleWidth = Math.min(bounds.right, chartArea.right) - Math.max(bounds.left, chartArea.left);
    const visibleHeight = Math.min(bounds.bottom, chartArea.bottom) - Math.max(bounds.top, chartArea.top);
    return visibleWidth > 0 && visibleHeight > 0;
}

export function createAdaptiveBarValueLabelsPlugin({
    id = "adaptive-bar-value-labels",
    resolveValue = rawValue => Number(rawValue),
    formatValue = value => String(value),
    font = "600 10px Outfit, sans-serif",
    textColor = "#0f172a",
    backgroundColor = "rgba(255, 255, 255, 0.94)",
    borderColor = "rgba(15, 23, 42, 0.32)"
} = {}) {
    return {
        id,
        afterDatasetsDraw(chart) {
            const { ctx, chartArea } = chart;
            if (!chartArea) return;
            const placed = [];
            ctx.save();
            ctx.font = font;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.lineWidth = 1;

            chart.data.datasets.forEach((dataset, datasetIndex) => {
                const meta = chart.getDatasetMeta(datasetIndex);
                if (meta?.hidden) return;

                (meta?.data || []).forEach((bar, index) => {
                    const value = Number(resolveValue(dataset.data?.[index], dataset, index));
                    if (!Number.isFinite(value) || bar?.hidden) return;

                    const text = formatValue(value, dataset, index);
                    if (!text) return;

                    const props = bar.getProps?.(["x", "y", "base", "width", "height"], true) || bar;
                    const isHorizontal = String(chart.options?.indexAxis || "").toLowerCase() === "y";
                    if (!barIntersectsChartArea(props, chartArea, isHorizontal)) return;

                    const textWidth = ctx.measureText(text).width;
                    const boxWidth = textWidth + 10;
                    const boxHeight = 18;
                    const barLength = isHorizontal
                        ? Math.abs(Number(props.x) - Number(props.base))
                        : Math.abs(Number(props.base) - Number(props.y));
                    const barThickness = isHorizontal ? Number(props.height) : Number(props.width);
                    const fitsInside = barLength >= boxWidth + 8 && barThickness >= boxHeight + 2;

                    let centerX;
                    let centerY;
                    if (isHorizontal) {
                        centerX = fitsInside
                            ? (Number(props.x) + Number(props.base)) / 2
                            : Number(props.x) + Math.sign(Number(props.x) - Number(props.base) || 1) * (boxWidth / 2 + 5);
                        centerY = Number(props.y);
                    } else {
                        centerX = Number(props.x);
                        centerY = fitsInside
                            ? (Number(props.y) + Number(props.base)) / 2
                            : Number(props.y) - boxHeight / 2 - 5;
                    }

                    const box = {
                        left: centerX - boxWidth / 2,
                        right: centerX + boxWidth / 2,
                        top: centerY - boxHeight / 2,
                        bottom: centerY + boxHeight / 2
                    };
                    if (!boxFitsChartArea(box, chartArea)) return;
                    if (placed.some(existing => boxesOverlap(box, existing, 3))) return;

                    ctx.fillStyle = backgroundColor;
                    ctx.strokeStyle = borderColor;
                    roundedRect(ctx, box.left, box.top, boxWidth, boxHeight, 5);
                    ctx.fill();
                    ctx.stroke();
                    ctx.fillStyle = textColor;
                    ctx.fillText(text, centerX, centerY);
                    placed.push(box);
                });
            });

            ctx.restore();
        }
    };
}
