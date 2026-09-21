export function renderBiofisicoSummary({
    territoryLevel,
    currentMunicipalityId,
    config,
    municipalityInfo
}) {
    const div = document.getElementById("summaryDiv");
    if (!div) return;

    if (territoryLevel === "DEPTO" && config?.id === "hipsometria") {
        div.textContent = "Resumen disponible solo al seleccionar un municipio.";
        return;
    }

    if (territoryLevel === "DEPTO") {
        div.textContent = "Resumen disponible solo al seleccionar un municipio.";
        return;
    }

    if (!currentMunicipalityId) {
        div.textContent = "Seleccione un municipio para ver el resumen.";
        return;
    }

    if (!config || !municipalityInfo) {
        div.textContent = "Cargando información o no disponible...";
        return;
    }

    const field = config.summaryField;
    if (field && municipalityInfo[field]) {
        div.textContent = "";
        const paragraph = document.createElement("p");
        paragraph.textContent = municipalityInfo[field];
        div.appendChild(paragraph);
        return;
    }

    div.textContent = "No hay información disponible para esta capa.";
}
