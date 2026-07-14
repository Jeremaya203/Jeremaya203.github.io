export function updateMapViewBadge(nombre) {
    const badgeText = document.getElementById("mapViewBadgeText");
    if (!badgeText) return;

    badgeText.textContent = nombre || "Vista";
}

export function setLegendLayerTitle(titleText) {
    const title = document.getElementById("legendTitle");
    if (title) title.textContent = titleText || "Leyenda";
}

export function clearLegend(titleText = "Leyenda") {
    const legendTitle = document.getElementById("legendTitle");
    const legendContent = document.getElementById("legendContent");

    if (legendTitle) legendTitle.textContent = titleText;
    if (legendContent) legendContent.innerHTML = "";

    window.__lastLegendRenderKey = "";
}

export function setSummaryText(text) {
    const summaryDiv = document.getElementById("summaryDiv");
    if (summaryDiv) {
        summaryDiv.textContent = text;
    }
}