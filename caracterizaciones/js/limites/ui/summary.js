import { escapeHtml, getMunicipioDisplayName, getDepartamentoDisplayName } from "../utils.js";

export function actualizarResumen({
    municipioActual,
    deptoActual,
    filtroNivel,
    diccionarioMunicipios,
    diccionarioDepartamentos
}) {
    const summaryDiv = document.getElementById("summaryDiv");
    if (!summaryDiv) return;

    if (!municipioActual && filtroNivel !== "DEPTO") {
        summaryDiv.innerHTML = deptoActual
            ? "Seleccione un municipio para ver el resumen."
            : "Seleccione un departamento o municipio para ver el resumen.";
        return;
    }

    const nombreMuni = getMunicipioDisplayName(municipioActual, diccionarioMunicipios);
    const nombreDepto = deptoActual ? getDepartamentoDisplayName(deptoActual, diccionarioDepartamentos) : "";

    let html = `<strong>Resumen</strong><br>`;
    if (nombreDepto) html += `Departamento: ${escapeHtml(nombreDepto)}<br>`;
    if (municipioActual && nombreMuni) html += `Municipio: ${escapeHtml(nombreMuni)}<br>`;

    summaryDiv.innerHTML = html;
}
