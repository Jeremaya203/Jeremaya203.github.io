import { renderPieChart } from "./pie-chart-renderer.js?v=adaptive-internal-pie-labels-20260724";
import { createMultiSeriesDoughnutOptions } from "../core/chart-options.js?v=adaptive-internal-pie-labels-20260724";
import { destroyCanvasChart } from "../core/chart-lifecycle.js";

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
