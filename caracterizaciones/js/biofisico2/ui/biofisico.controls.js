export function renderBiofisicoSubTabs({
    list,
    currentSubLayerIndex,
    onSelectSubLayer
}) {
    const container = document.getElementById("subtabsControls");
    if (!container) return;

    container.innerHTML = "";
    const clearPreviousSectionVisuals = () => {
        const title = document.getElementById("chartTitle");
        const summary = document.getElementById("summaryDiv");
        const legendTitle = document.getElementById("legendTitle");
        const legendContent = document.getElementById("legendContent");
        const canvas = document.getElementById("chart");
        const card = canvas?.closest(".chart-card");

        if (title) title.textContent = "Cargando información...";
        if (summary) summary.textContent = "Cargando información...";
        if (legendTitle) legendTitle.textContent = "Leyenda";
        if (legendContent) {
            legendContent.innerHTML = `<p class="oot-js-biofisico-controls-1">Cargando información...</p>`;
            legendContent.classList.remove("collapsed");
        }

        card?.classList.remove("chart-ecosistemas", "chart-hipsometria-depto", "chart-bubble");
        card?.style.removeProperty("--biofisico-chart-height");
        card?.style.removeProperty("--biofisico-hipso-depto-height");

        if (canvas) {
            try {
                const context = canvas.getContext("2d");
                context?.clearRect(0, 0, canvas.width || canvas.clientWidth || 0, canvas.height || canvas.clientHeight || 0);
            } catch (_) {}
        }

        document.getElementById("geoformasChartLegend")?.remove();
        const geoformasCharts = document.getElementById("geoformasCharts");
        if (geoformasCharts) geoformasCharts.style.display = "none";
    };

    const selectSubtab = (index) => {
        Array.from(container.querySelectorAll("button.subtab-btn")).forEach((button, buttonIndex) => {
            button.classList.toggle("active", buttonIndex === index);
        });
        clearPreviousSectionVisuals();
        onSelectSubLayer(index);
    };

    if (!list?.length) {
        container.style.display = "none";
        return;
    }

    container.style.display = "flex";

    list.forEach((cfg, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "subtab-btn" + (index === currentSubLayerIndex ? " active" : "");
        button.dataset.subLayerIndex = String(index);
        button.textContent = cfg.title || `Capa ${index + 1}`;
        button.addEventListener("click", () => selectSubtab(index));
        container.appendChild(button);
    });
}

export function renderBiofisicoControls({
    renderSubTabs
}) {
    renderSubTabs();
}
