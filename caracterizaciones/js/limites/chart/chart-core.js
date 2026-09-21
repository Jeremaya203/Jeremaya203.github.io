let _chartInstance = null;

export function createChart(canvas, chartConfig) {
    destroyChart();
    _chartInstance = new Chart(canvas, chartConfig);
    return _chartInstance;
}

export function destroyChart() {
    if (_chartInstance) {
        _chartInstance.destroy();
        _chartInstance = null;
    }
}

export function resetChartLayout() {
    const canvas = document.getElementById("chart");
    if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.removeAttribute("height");
        canvas.removeAttribute("width");
        canvas.style.height = "";
        canvas.style.maxHeight = "";
        canvas.style.minHeight = "";
        canvas.style.width = "100%";
        canvas.style.display = "";
    }
    const chartDiv = document.getElementById("chartDiv");
    if (chartDiv) {
        chartDiv.style.overflowY = "";
        chartDiv.style.display = "";
        chartDiv.style.flexDirection = "";
        chartDiv.style.justifyContent = "";
    }
}

export function getChartInstance() {
    return _chartInstance;
}
