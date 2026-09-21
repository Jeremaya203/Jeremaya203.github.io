export function setChartStatus(canvas, message = "") {
    let status = document.getElementById("pibChartStatus");
    if (!message) {
        if (status) status.remove();
        return null;
    }

    if (!status) {
        status = document.createElement("div");
        status.id = "pibChartStatus";
        status.className = "pib-chart-status";
        canvas.insertAdjacentElement("afterend", status);
    }

    status.textContent = message;
    return status;
}
