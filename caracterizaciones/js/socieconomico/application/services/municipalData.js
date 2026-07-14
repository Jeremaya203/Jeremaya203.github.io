export function getMunicipioDisplayName(municipio, diccionarioMunicipios = {}) {
    const codigo = String(municipio?.codigo ?? municipio ?? "").trim();
    const nombre = String(municipio?.nombre ?? diccionarioMunicipios[codigo] ?? "").trim();

    if (codigo === "00000" || nombre === "00000") {
        return "Área en litigio";
    }

    return nombre || codigo;
}

export function createMunicipalDataController({
    FeatureLayer,
    layersConfig,
    getDiccionarioMunicipios,
    setDiccionarioMunicipios,
    getDiccionarioDepartamentos,
    setDiccionarioDepartamentos,
    getTodosMunicipios,
    setTodosMunicipios
}) {
    async function cargarDiccionarioMunicipios() {
        try {
            const url = "https://serviciosgeovisor.igac.gov.co:8080/Geovisor/config?cmd=config_diccionario2";
            const res = await fetch(url);
            const json = await res.json();
            const municipios = { ...getDiccionarioMunicipios() };
            const departamentos = { ...getDiccionarioDepartamentos() };

            if (json && json.UNIDAD) {
                json.UNIDAD
                    .filter(unit => unit.type === "MUNI")
                    .forEach(muni => {
                        municipios[muni.id] = muni.text;
                    });

                json.UNIDAD
                    .filter(unit => unit.type === "DEPTO")
                    .forEach(depto => {
                        departamentos[depto.id] = depto.id === "00"
                            ? "Área en litigio"
                            : depto.id === "88"
                                ? "San Andrés y Providencia"
                                : depto.text;
                    });
            }

            setDiccionarioMunicipios(municipios);
            setDiccionarioDepartamentos(departamentos);
        } catch (e) {
            console.error("Error cargando diccionario", e);
        }
    }

    function buildMunicipiosFromDictionary() {
        const diccionarioMunicipios = getDiccionarioMunicipios();
        const municipios = Object.keys(diccionarioMunicipios)
            .filter(codigo => /^\d{5}$/.test(String(codigo)))
            .sort()
            .map(codigo => ({
                codigo,
                nombre: diccionarioMunicipios[codigo] || codigo,
                depto: codigo.substring(0, 2)
            }));

        if (municipios.length) {
            setTodosMunicipios(municipios);
            cargarDepartamentos();
            renderizarMunicipios();
        }

        return municipios.length;
    }

    async function cargarMunicipios() {
        if (Object.keys(getDiccionarioMunicipios()).length === 0) {
            await cargarDiccionarioMunicipios();
        }

        if (buildMunicipiosFromDictionary()) return;

        const tempLayer = new FeatureLayer({
            url: layersConfig.RELIEVE[0].url
        });

        const query = tempLayer.createQuery();
        query.where = "1=1";
        query.outFields = ["mpcodigo"];
        query.returnDistinctValues = true;
        query.returnGeometry = false;

        try {
            const res = await tempLayer.queryFeatures(query);

            if (!res || !res.features || res.features.length === 0) {
                console.warn("No hay municipios disponibles (servicio vacio)");
                return;
            }

            const diccionarioMunicipios = getDiccionarioMunicipios();
            const codigos = [...new Set(res.features.map(feature => feature.attributes.mpcodigo))].sort();

            setTodosMunicipios(codigos.map(codigo => ({
                codigo,
                nombre: diccionarioMunicipios[codigo] || codigo,
                depto: codigo.substring(0, 2)
            })));

            cargarDepartamentos();
            renderizarMunicipios();
        } catch (e) {
            console.error("Error cargando municipios", e);
            if (!buildMunicipiosFromDictionary()) {
                cargarDepartamentos();
                renderizarMunicipios();
            }
        }
    }

    function cargarDepartamentos() {
        const selectDepto = document.getElementById("departamentos");
        if (!selectDepto) return;

        selectDepto.innerHTML = `<option value="0">Seleccionar departamento</option>`;

        const optionColombia = document.createElement("option");
        optionColombia.value = "COL";
        optionColombia.textContent = "Colombia";
        selectDepto.appendChild(optionColombia);

        const diccionarioDepartamentos = getDiccionarioDepartamentos();

        const deptosUnicos = [
            ...new Set(getTodosMunicipios().map(muni => muni.depto))
        ]
            .map(codigoDepto => ({
                codigo: codigoDepto,
                nombre: codigoDepto === "00"
                    ? "Área en litigio"
                    : (diccionarioDepartamentos[codigoDepto] || codigoDepto)
            }))
            .sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));

        deptosUnicos.forEach(({ codigo, nombre }) => {
            const opt = document.createElement("option");
            opt.value = codigo;
            opt.textContent = nombre;

            selectDepto.appendChild(opt);
        });
    }

    function renderizarMunicipios(deptoFiltro = null) {
        const select = document.getElementById("municipios");
        if (!select) return;

        let filtro = deptoFiltro;
        if (!filtro || filtro === "0") {
            const selectedDepto = document.getElementById("departamentos")?.value;
            if (selectedDepto && selectedDepto !== "0" && selectedDepto !== "COL") {
                filtro = selectedDepto;
            }
        }

        if (!filtro || filtro === "0") {
            select.innerHTML = `<option value="">Seleccionar municipio</option>`;
            return;
        }

        select.innerHTML = `<option value="">Seleccionar municipio</option>`;
        select.disabled = false;

        const municipiosFiltrados = getTodosMunicipios().filter(muni => muni.depto === filtro);

        municipiosFiltrados.forEach(muni => {
            const opt = document.createElement("option");
            opt.value = muni.codigo;
            opt.textContent = getMunicipioDisplayName(muni, getDiccionarioMunicipios());
            select.appendChild(opt);
        });
    }

    return {
        cargarDiccionarioMunicipios,
        cargarMunicipios,
        cargarDepartamentos,
        renderizarMunicipios,
        getMunicipioDisplayName
    };
}
