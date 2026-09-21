import { escapeHtml, getMunicipalityDisplayName, getDepartmentDisplayName } from "../utils.js";

export function updateSummary({
    currentMunicipalityId: currentMunicipalityId,
    currentDepartmentId: currentDepartmentId,
    territoryLevel: territoryLevel,
    municipalityNames: municipalityNames,
    departmentNames: departmentNames
}) {
    const summaryDiv = document.getElementById("summaryDiv");
    if (!summaryDiv) return;

    if (!currentMunicipalityId && territoryLevel !== "DEPTO") {
        summaryDiv.innerHTML = currentDepartmentId
            ? "Seleccione un municipio para ver el resumen."
            : "Seleccione un departamento o municipio para ver el resumen.";
        return;
    }

    const municipalityName = getMunicipalityDisplayName(currentMunicipalityId, municipalityNames);
    const departmentName = currentDepartmentId ? getDepartmentDisplayName(currentDepartmentId, departmentNames) : "";

    let summaryHtml = `<strong>Resumen</strong><br>`;
    if (departmentName) summaryHtml += `Departamento: ${escapeHtml(departmentName)}<br>`;
    if (currentMunicipalityId && municipalityName) summaryHtml += `Municipio: ${escapeHtml(municipalityName)}<br>`;

    summaryDiv.innerHTML = summaryHtml;
}
