export function renderBiofisicoSummary({
    filtroNivel,
    municipioActual,
    config,
    municipioInfo
}) {
    const div = document.getElementById("summaryDiv");
    if (!div) return;

    if (filtroNivel === "DEPTO" && config?.id === "hipsometria") {
        div.textContent = "Resumen disponible solo al seleccionar un municipio.";
        return;
    }

    if (filtroNivel === "DEPTO") {
        div.textContent = "Resumen disponible solo al seleccionar un municipio.";
        return;
    }

    if (!municipioActual) {
        div.textContent = "Seleccione un municipio para ver el resumen.";
        return;
    }

    if (!config || !municipioInfo) {
        div.textContent = "Cargando información o no disponible...";
        return;
    }

    const field = config.summaryField;
    if (field && municipioInfo[field]) {
        div.textContent = "";
        const paragraph = document.createElement("p");
        paragraph.textContent = municipioInfo[field];
        div.appendChild(paragraph);
        return;
    }

    div.textContent = "No hay información disponible para esta capa.";
}
