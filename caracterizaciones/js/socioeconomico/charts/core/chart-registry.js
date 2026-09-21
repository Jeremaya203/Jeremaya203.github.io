import { createBarChartRenderer } from "../renderers/bar-chart-renderer.js?v=connectivity-tab-resize-20260716";
import { renderPieChart } from "../renderers/pie-chart-renderer.js?v=adaptive-internal-pie-labels-20260724";
import { renderLineChart } from "../renderers/line-chart-renderer.js";
import { renderDoughnutChart } from "../renderers/doughnut-chart-renderer.js?v=adaptive-internal-pie-labels-20260724";

export function createChartRegistry(dependencies = {}) {
    const renderers = new Map();

    if (dependencies.chartCore && dependencies.chartInteractions) {
        renderers.set("bar", createBarChartRenderer(dependencies));
    }

    renderers.set("pie", { render: renderPieChart });
    renderers.set("line", { render: renderLineChart });
    renderers.set("doughnut", { render: renderDoughnutChart });

    function getRenderer(type) {
        return renderers.get(String(type || "").toLowerCase()) || null;
    }

    function registerRenderer(type, renderer) {
        if (!type || !renderer) return;
        renderers.set(String(type).toLowerCase(), renderer);
    }

    function renderChart({ type, ...options } = {}) {
        const renderer = getRenderer(type);
        if (!renderer) {
            throw new Error(`No hay renderer registrado para el tipo de gráfico: ${type}`);
        }

        if (typeof renderer === "function") return renderer(options);
        if (typeof renderer.render === "function") return renderer.render(options);
        if (typeof renderer.renderChartFromLayer === "function") {
            return renderer.renderChartFromLayer(options.layer, options.config);
        }
        throw new Error(`Renderer inválido para el tipo de gráfico: ${type}`);
    }

    return {
        getRenderer,
        registerRenderer,
        renderChart
    };
}
