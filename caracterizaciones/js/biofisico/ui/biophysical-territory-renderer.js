export function renderDepartmentSelect({
    departamentos,
    departmentNames
}) {
    const departmentSelect = document.getElementById("departamentos");
    if (!departmentSelect) return;

    departmentSelect.innerHTML = `<option value="0">Seleccione departamento</option>`;

    const optionColombia = document.createElement("option");
    optionColombia.value = "COL";
    optionColombia.textContent = "Colombia";
    departmentSelect.appendChild(optionColombia);

    const sortedDepartments = [...departamentos].sort((codigoA, codigoB) => {
        const firstName = getDepartmentDisplayName(codigoA, departmentNames);
        const secondName = getDepartmentDisplayName(codigoB, departmentNames);
        return firstName.localeCompare(secondName, "es", { sensitivity: "base" });
    });

    sortedDepartments.forEach(codigoDepto => {
        const option = document.createElement("option");
        option.value = codigoDepto;
        option.textContent = getDepartmentDisplayName(codigoDepto, departmentNames);
        departmentSelect.appendChild(option);
    });
}

export function getDepartmentDisplayName(departmentCode, departmentNames = {}) {
    const code = String(departmentCode ?? "").trim();

    if (code === "00") {
        return "\u00c1rea en litigio";
    }

    return departmentNames[code] || code;
}

export function getMunicipalityDisplayName(municipality) {
    const code = String(municipality?.codigo ?? municipality ?? "").trim();
    const name = String(municipality?.nombre ?? "").trim();

    if (code === "00000" || name === "00000") {
        return "\u00c1rea en litigio";
    }

    return name || code;
}

export function renderMunicipalitySelect({
    municipios,
    deptoFiltro = null
}) {
    const select = document.getElementById("municipios");
    if (!select) return;

    select.replaceChildren();

    let filteredMunicipalities = municipios;

    if (deptoFiltro && deptoFiltro !== "0") {
        filteredMunicipalities = filteredMunicipalities.filter(m => m.depto === deptoFiltro);
    }

    const fragment = document.createDocumentFragment();
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "Seleccione un municipio";
    fragment.appendChild(defaultOption);

    filteredMunicipalities.forEach(muni => {
        const option = document.createElement("option");
        option.value = muni.codigo;
        option.textContent = getMunicipalityDisplayName(muni);
        fragment.appendChild(option);
    });

    select.appendChild(fragment);
}
