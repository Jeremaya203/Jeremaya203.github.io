import { renderPieChart } from "./pieChartRenderer.js";
import { createMultiSeriesDoughnutOptions } from "../core/chartOptions.js?v=global-safe-zoom-labels-20260604";
import { destroyCanvasChart } from "../core/chartLifecycle.js";

export function renderDoughnutChart(options = {}) {
    return renderPieChart({
        ...options,
        type: "doughnut"
    });
}

export function renderMultiSeriesDoughnutChart({
    canvas,
    labels = [],
    datasets = [],
    formatValue
}) {
    if (!canvas || typeof Chart === "undefined") return null;
    destroyCanvasChart(canvas);
    return new Chart(canvas, {
        type: "doughnut",
        data: { labels, datasets },
        options: createMultiSeriesDoughnutOptions({ formatValue })
    });
}
