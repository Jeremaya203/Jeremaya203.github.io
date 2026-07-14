export function renderDepartamentosSelect({
    departamentos,
    diccionarioDepartamentos
}) {
    const selectDepto = document.getElementById("departamentos");
    if (!selectDepto) return;

    selectDepto.innerHTML = `<option value="0">Seleccione departamento</option>`;

    const optionColombia = document.createElement("option");
    optionColombia.value = "COL";
    optionColombia.textContent = "Colombia";
    selectDepto.appendChild(optionColombia);

    const departamentosOrdenados = [...departamentos].sort((codigoA, codigoB) => {
        const nombreA = getDepartamentoDisplayName(codigoA, diccionarioDepartamentos);
        const nombreB = getDepartamentoDisplayName(codigoB, diccionarioDepartamentos);
        return nombreA.localeCompare(nombreB, "es", { sensitivity: "base" });
    });

    departamentosOrdenados.forEach(codigoDepto => {
        const option = document.createElement("option");
        option.value = codigoDepto;
        option.textContent = getDepartamentoDisplayName(codigoDepto, diccionarioDepartamentos);
        selectDepto.appendChild(option);
    });
}

export function getDepartamentoDisplayName(codigoDepto, diccionarioDepartamentos = {}) {
    const codigo = String(codigoDepto ?? "").trim();

    if (codigo === "00") {
        return "\u00c1rea en litigio";
    }

    return diccionarioDepartamentos[codigo] || codigo;
}

export function getMunicipioDisplayName(municipio) {
    const codigo = String(municipio?.codigo ?? municipio ?? "").trim();
    const nombre = String(municipio?.nombre ?? "").trim();

    if (codigo === "00000" || nombre === "00000") {
        return "\u00c1rea en litigio";
    }

    return nombre || codigo;
}

export function renderMunicipiosSelect({
    municipios,
    deptoFiltro = null
}) {
    const select = document.getElementById("municipios");
    if (!select) return;

    select.replaceChildren();

    let municipiosFiltrados = municipios;

    if (deptoFiltro && deptoFiltro !== "0") {
        municipiosFiltrados = municipiosFiltrados.filter(m => m.depto === deptoFiltro);
    }

    const fragment = document.createDocumentFragment();
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "Seleccione un municipio";
    fragment.appendChild(defaultOption);

    municipiosFiltrados.forEach(muni => {
        const option = document.createElement("option");
        option.value = muni.codigo;
        option.textContent = getMunicipioDisplayName(muni);
        fragment.appendChild(option);
    });

    select.appendChild(fragment);
}
