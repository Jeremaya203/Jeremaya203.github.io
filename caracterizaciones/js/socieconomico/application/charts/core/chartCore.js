import { destroyCanvasChart } from "./chartLifecycle.js";

export function createChartCore({
    getChartInstance,
    setChartInstance,
    onDestroy
} = {}) {
    let rowsByLabel = new Map();
    let selectedLabel = null;
    let activeRenderTimer = null;
    let chartInstance = null;

    function getInstance() {
        return chartInstance || getChartInstance?.() || null;
    }

    function setInstance(instance) {
        chartInstance = instance;
        setChartInstance?.(instance);
    }

    function destroyChart() {
        if (chartInstance && chartInstance.canvas) {
            destroyCanvasChart(chartInstance.canvas);
        } else {
            const currentChart = chartInstance;
            if (currentChart) currentChart.destroy();
        }
        chartInstance = null;
        rowsByLabel = new Map();
        selectedLabel = null;
        onDestroy?.();
    }

    function setRows(rows) {
        rowsByLabel = new Map((rows || []).map(row => [row.label, row]));
    }

    function getRowsByLabel() {
        return rowsByLabel;
    }

    function setSelectedLabel(label) {
        selectedLabel = label ?? null;
    }

    function getSelectedLabel() {
        return selectedLabel;
    }

    function schedule(callback, delay = 250) {
        if (activeRenderTimer) window.clearTimeout(activeRenderTimer);
        activeRenderTimer = window.setTimeout(async () => {
            activeRenderTimer = null;
            await callback();
        }, delay);
    }

    return {
        destroyChart,
        getInstance,
        setInstance,
        setRows,
        getRowsByLabel,
        setSelectedLabel,
        getSelectedLabel,
        schedule
    };
}
