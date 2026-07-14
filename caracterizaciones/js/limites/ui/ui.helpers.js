export function updateMapViewBadge(nombre) {
    const badgeText = document.getElementById("mapViewBadgeText");
    if (!badgeText) return;

    badgeText.textContent = nombre || "Vista";
}

export function setLegendLayerTitle(titleText) {
    const title = document.getElementById("legendTitle");
    if (title) title.textContent = titleText || "Leyenda";
}