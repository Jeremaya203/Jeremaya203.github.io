import { socioeconomicoFeatureLayerUrl } from "./serviceRoots.js";

const DICCIONARIO_URL = "https://serviciosgeovisor.igac.gov.co:8080/Geovisor/config?cmd=config_diccionario2";
const TERRITORIOS_SOCIOECONOMICO_URL = socioeconomicoFeatureLayerUrl(2);
const DICCIONARIO_TIMEOUT_MS = 2500;
const FALLBACK_TIMEOUT_MS = 5000;

const SPECIAL_DEPARTMENT_NAMES = {
    "00": "\u00c1rea en litigio",
    "11": "Bogot\u00e1, D.C.",
    "88": "San Andr\u00e9s y Providencia"
};

function specialDepartmentName(code) {
    return SPECIAL_DEPARTMENT_NAMES[String(code || "").trim()] || "";
}

function normalizeMunicipioCode(value) {
    const code = String(value || "").trim();
    return /^\d{5}$/.test(code) ? code : "";
}

function normalizeDepartmentCode(value) {
    const code = String(value || "").trim();
    return /^\d{2}$/.test(code) ? code : "";
}

function normalizeName(value) {
    return String(value || "").trim();
}

function sortMunicipios(a, b) {
    return String(a.nombre || "").localeCompare(String(b.nombre || ""), "es", { sensitivity: "base" })
        || String(a.codigo || "").localeCompare(String(b.codigo || ""), "es", { sensitivity: "base" });
}

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = FALLBACK_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        if (!response.ok) throw new Error("HTTP " + response.status + " al consultar " + url);
        return await response.json();
    } finally {
        clearTimeout(timeoutId);
    }
}

function normalizeTerritorialData({ municipios = [], departamentos = [] } = {}) {
    const diccionarioMunicipios = {};
    const diccionarioDepartamentos = {};
    const todosMunicipios = [];
    const seenMunicipios = new Set();

    municipios.forEach(item => {
        const codigo = normalizeMunicipioCode(item.codigo ?? item.id ?? item.mpcodigo ?? item.MpCodigo);
        const nombreOriginal = normalizeName(item.nombre ?? item.text ?? item.mpnombre ?? item.MpNombre);
        if (!codigo || !nombreOriginal || seenMunicipios.has(codigo)) return;

        const nombre = codigo === "00000" ? specialDepartmentName("00") : nombreOriginal;
        const depto = codigo.slice(0, 2);

        seenMunicipios.add(codigo);
        diccionarioMunicipios[codigo] = nombre;
        todosMunicipios.push({ codigo, nombre, depto });
    });

    departamentos.forEach(item => {
        const codigo = normalizeDepartmentCode(item.codigo ?? item.id ?? item.dpcodigo ?? item.DpCodigo);
        if (!codigo) return;

        const nombre = specialDepartmentName(codigo)
            || normalizeName(item.nombre ?? item.text ?? item.dpnombre ?? item.DpNombre)
            || codigo;
        diccionarioDepartamentos[codigo] = nombre;
    });

    todosMunicipios.forEach(municipio => {
        if (!diccionarioDepartamentos[municipio.depto]) {
            diccionarioDepartamentos[municipio.depto] = specialDepartmentName(municipio.depto) || municipio.depto;
        }
    });

    todosMunicipios.sort(sortMunicipios);

    return {
        diccionarioMunicipios,
        diccionarioDepartamentos,
        todosMunicipios
    };
}

function assertValidTerritorialData(data, sourceName) {
    if (data?.todosMunicipios?.length > 0) return data;
    throw new Error(sourceName + " no devolvio municipios validos.");
}

async function cargarTerritoriosDesdeDiccionario() {
    const json = await fetchJsonWithTimeout(DICCIONARIO_URL, {}, DICCIONARIO_TIMEOUT_MS);
    const unidades = Array.isArray(json?.UNIDAD) ? json.UNIDAD : [];

    return normalizeTerritorialData({
        municipios: unidades.filter(unit => unit?.type === "MUNI"),
        departamentos: unidades.filter(unit => unit?.type === "DEPTO")
    });
}

async function cargarTerritoriosDesdeSocioeconomico() {
    const params = new URLSearchParams({
        where: "1=1",
        outFields: "mpcodigo,mpnombre,dpcodigo,dpnombre",
        returnDistinctValues: "true",
        returnGeometry: "false",
        f: "json"
    });
    const json = await fetchJsonWithTimeout(TERRITORIOS_SOCIOECONOMICO_URL + "/query?" + params.toString(), {}, FALLBACK_TIMEOUT_MS);
    const features = Array.isArray(json?.features) ? json.features : [];

    return normalizeTerritorialData({
        municipios: features.map(feature => feature?.attributes || {}),
        departamentos: features.map(feature => feature?.attributes || {})
    });
}

export function getMunicipioDisplayName(municipio, diccionarioMunicipios = {}) {
    const codigo = String(municipio?.codigo ?? municipio ?? "").trim();
    const nombre = String(municipio?.nombre ?? diccionarioMunicipios[codigo] ?? "").trim();

    if (codigo === "00000" || nombre === "00000") {
        return "Área en litigio";
    }

    return nombre || codigo;
}

export function createMunicipalDataController({
    getDiccionarioMunicipios,
    setDiccionarioMunicipios,
    getDiccionarioDepartamentos,
    setDiccionarioDepartamentos,
    getTodosMunicipios,
    setTodosMunicipios
}) {
    async function cargarDiccionarioMunicipios() {
        try {
            const data = assertValidTerritorialData(
                await cargarTerritoriosDesdeDiccionario(),
                "Diccionario GeoVisor"
            );
            aplicarDatosTerritoriales(data);
            return;
        } catch (error) {
            console.warn("Diccionario GeoVisor no disponible. Se usara FeatureServer/2 como respaldo:", error);
        }

        try {
            const data = assertValidTerritorialData(
                await cargarTerritoriosDesdeSocioeconomico(),
                "FeatureServer/2 socioeconomico"
            );
            aplicarDatosTerritoriales(data);
        } catch (fallbackError) {
            console.error("Error cargando diccionario territorial socioeconomico", fallbackError);
        }
    }

    function aplicarDatosTerritoriales(data) {
        const municipios = {
            ...getDiccionarioMunicipios(),
            ...data.diccionarioMunicipios
        };
        const departamentos = {
            ...getDiccionarioDepartamentos(),
            ...data.diccionarioDepartamentos
        };

        setDiccionarioMunicipios(municipios);
        setDiccionarioDepartamentos(departamentos);
        setTodosMunicipios(data.todosMunicipios);
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

        if (getTodosMunicipios().length) {
            cargarDepartamentos();
            renderizarMunicipios();
            return;
        }

        if (buildMunicipiosFromDictionary()) return;
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
