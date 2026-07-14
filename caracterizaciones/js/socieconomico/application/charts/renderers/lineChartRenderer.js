import { destroyCanvasChart } from "../core/chartLifecycle.js";

export function renderLineChart({
    canvas,
    labels = [],
    datasets = [],
    options = {}
} = {}) {
    if (!canvas || typeof Chart === "undefined") return null;
    destroyCanvasChart(canvas);

    return new Chart(canvas, {
        type: "line",
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            ...options
        }
    });
}
