import { createPieChartOptions } from "../core/chartOptions.js?v=global-safe-zoom-labels-20260604";
import { destroyCanvasChart } from "../core/chartLifecycle.js";

export function renderPieChart({
    canvas,
    labels = [],
    values = [],
    title = "",
    type = "pie",
    colors = [],
    showLegend = true,
    formatValue,
    onSliceClick,
    onSliceHover,
    onSliceLeave,
    hoverOffset = 6,
    plugins = []
}) {
    if (!canvas || typeof Chart === "undefined") return null;
    destroyCanvasChart(canvas);
    return new Chart(canvas, {
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
            onSliceClick,
            onSliceHover,
            onSliceLeave
        }),
        plugins
    });
}
