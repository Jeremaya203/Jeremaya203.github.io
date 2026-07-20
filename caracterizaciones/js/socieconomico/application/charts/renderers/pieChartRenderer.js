import { createPieChartOptions } from "../core/chartOptions.js?v=global-safe-zoom-labels-20260604";
import { destroyCanvasChart } from "../core/chartLifecycle.js";
import { withPiePercentageLabels } from "../core/pieDataLabelsPlugin.js?v=shared-pie-labels-20260701";

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
