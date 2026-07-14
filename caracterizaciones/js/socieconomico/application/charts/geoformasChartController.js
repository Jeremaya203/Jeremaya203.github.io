export function createGeoformasChartController({
    getGeoPieChartInstance,
    setGeoPieChartInstance,
    getGeoDonutChartInstance,
    setGeoDonutChartInstance
}) {
    function toggleGeoformasCharts(show) {
        const dual = document.getElementById("geoformasCharts");
        const single = document.getElementById("chart");
        const chartCard = single?.closest(".chart-card");
        const status = document.getElementById("pibChartStatus");
        const pieCanvas = document.getElementById("geoPieChart");
        const donutCanvas = document.getElementById("geoDonutChart");
        if (show && chartCard) chartCard.classList.remove("chart-ready");
        if (show && status) status.style.display = "none";
        if (dual) dual.style.display = show ? "block" : "none";
        if (single) single.style.display = show ? "none" : "block";
        if (pieCanvas?.parentElement) pieCanvas.parentElement.style.display = show ? "block" : "none";
        if (donutCanvas?.parentElement) donutCanvas.parentElement.style.display = show ? "block" : "none";
    }

    function destroyGeoformasCharts() {
        const pieChart = getGeoPieChartInstance?.();
        if (pieChart) {
            pieChart.destroy();
            setGeoPieChartInstance?.(null);
        }

        const donutChart = getGeoDonutChartInstance?.();
        if (donutChart) {
            donutChart.destroy();
            setGeoDonutChartInstance?.(null);
        }
    }

    return {
        destroyGeoformasCharts,
        toggleGeoformasCharts
    };
}
