import { createPieChartOptions } from "../core/chart-options.js?v=adaptive-internal-pie-labels-20260724";
import { destroyCanvasChart } from "../core/chart-lifecycle.js";
import { withPiePercentageLabels } from "../core/pie-data-labels-plugin.js?v=adaptive-internal-pie-labels-20260724";

export function renderPieChart({
    canvas,
    labels = [],
    values = [],
    title = "",
    type = "pie",
    colors = [],
    showLegend = true,
    legendShowPercent = false,
    formatValue,
    onSliceClick,
    onSliceHover,
    onSliceLeave,
    hoverOffset = 6,
    plugins = []
}) {
    if (!canvas || typeof Chart === "undefined") return null;
    destroyCanvasChart(canvas);

    const config = {
        type,
        data: {
            labels,
            datasets: [{
                label: title,
                data: values,
                backgroundColor: colors,
                borderColor: labels.map(() => "#ffffff"),
                borderWidth: labels.map(() => 1),
                hoverOffset
            }]
        },
        options: createPieChartOptions({
            formatValue,
            showLegend,
            legendShowPercent,
            onSliceClick,
            onSliceHover,
            onSliceLeave
        }),
        plugins
    };

    const skipOnChartPercent = plugins.length > 0 || legendShowPercent;
    return new Chart(canvas, skipOnChartPercent ? config : withPiePercentageLabels(config));
}
