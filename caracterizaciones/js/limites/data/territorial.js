const GEOVISOR_URL = "https://serviciosgeovisor.igac.gov.co:8080/Geovisor/config?cmd=config_diccionario2";
const FS1_URL = "https://mapas2.igac.gov.co/server/rest/services/limites/limites/FeatureServer/1/query";
const GEOVISOR_TIMEOUT_MS = 2500;
const FALLBACK_TIMEOUT_MS = 5000;

const SPECIAL_DEPARTMENT_NAMES = {
    "00": "\u00c1rea en litigio",
    "88": "San Andr\u00e9s y Providencia"
};

function getSpecialDepartmentName(code) {
    return SPECIAL_DEPARTMENT_NAMES[String(code || "").trim()] || "";
}

function normalizarCodigoMunicipio(value) {
    const codigo = String(value || "").trim();
    return /^\d{5}$/.test(codigo) ? codigo : "";
}

function normalizarCodigoDepartamento(value) {
    const codigo = String(value || "").trim();
    return /^\d{2}$/.test(codigo) ? codigo : "";
}

function normalizarNombre(value) {
    return String(value || "").trim();
}

function ordenarMunicipiosPorNombre(a, b) {
    return String(a.nombre || "").localeCompare(String(b.nombre || ""), "es", { sensitivity: "base" })
        || String(a.codigo || "").localeCompare(String(b.codigo || ""), "es", { sensitivity: "base" });
}

function normalizarTerritorios(payload) {
    const municipiosFuente = Array.isArray(payload?.municipios) ? payload.municipios : [];
    const departamentosFuente = Array.isArray(payload?.departamentos) ? payload.departamentos : [];

    const diccionarioMunicipios = {};
    const diccionarioDepartamentos = {};
    const todosMunicipios = [];
    const codigosMunicipales = new Set();

    municipiosFuente.forEach(item => {
        const codigo = normalizarCodigoMunicipio(item?.codigo ?? item?.id);
        const nombreOriginal = normalizarNombre(item?.nombre ?? item?.text);
        if (!codigo || !nombreOriginal || codigosMunicipales.has(codigo)) return;

        const nombre = codigo === "00000" ? getSpecialDepartmentName("00") : nombreOriginal;
        const depto = codigo.slice(0, 2);

        codigosMunicipales.add(codigo);
        diccionarioMunicipios[codigo] = nombre;
        todosMunicipios.push({ codigo, nombre, depto });
    });

    departamentosFuente.forEach(item => {
        const codigo = normalizarCodigoDepartamento(item?.codigo ?? item?.id);
        if (!codigo) return;

        const nombre = getSpecialDepartmentName(codigo) || normalizarNombre(item?.nombre ?? item?.text) || codigo;
        diccionarioDepartamentos[codigo] = nombre;
    });

    todosMunicipios.forEach(municipio => {
        if (!diccionarioDepartamentos[municipio.depto]) {
            diccionarioDepartamentos[municipio.depto] = getSpecialDepartmentName(municipio.depto) || municipio.depto;
        }
    });

    todosMunicipios.sort(ordenarMunicipiosPorNombre);

    return {
        diccionarioMunicipios,
        diccionarioDepartamentos,
        todosMunicipios
    };
}

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = FALLBACK_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        if (!response.ok) {
            throw new Error("HTTP " + response.status + " al consultar " + url);
        }
        return await response.json();
    } finally {
        clearTimeout(timeoutId);
    }
}

async function cargarDiccionarioDesdeGeoVisor() {
    const json = await fetchJsonWithTimeout(GEOVISOR_URL, {}, GEOVISOR_TIMEOUT_MS);
    const unidades = Array.isArray(json?.UNIDAD) ? json.UNIDAD : [];

    return normalizarTerritorios({
        municipios: unidades.filter(unit => unit?.type === "MUNI"),
        departamentos: unidades.filter(unit => unit?.type === "DEPTO")
    });
}

function validarDiccionarioTerritorial(data, sourceName) {
    if (data?.todosMunicipios?.length > 0) return data;
    throw new Error(sourceName + " no devolvio municipios validos.");
}

export async function cargarDiccionarioDesdeApi() {
    const geoVisorPromise = cargarDiccionarioDesdeGeoVisor()
        .then(data => validarDiccionarioTerritorial(data, "GeoVisor"));

    const fallbackPromise = cargarDiccionarioDesdeFeatureServer()
        .then(data => validarDiccionarioTerritorial(data, "FeatureServer/1"));

    try {
        return await Promise.any([geoVisorPromise, fallbackPromise]);
    } catch (error) {
        const detalles = error instanceof AggregateError ? error.errors : [error];
        detalles.forEach(detalle => console.warn("Fuente territorial no disponible:", detalle));
        console.error("No fue posible construir el diccionario territorial desde ninguna fuente.");
        return null;
    }
}

async function cargarDiccionarioDesdeFeatureServer() {
    const params = new URLSearchParams({
        where: "1=1",
        outFields: "MpCodigo,MpNombre,Depto",
        returnGeometry: "false",
        f: "json"
    });

    const json = await fetchJsonWithTimeout(FS1_URL + "?" + params.toString(), {}, FALLBACK_TIMEOUT_MS);
    const features = Array.isArray(json?.features) ? json.features : [];

    return normalizarTerritorios({
        municipios: features.map(feature => {
            const attributes = feature?.attributes || {};
            return {
                codigo: attributes.MpCodigo,
                nombre: attributes.MpNombre
            };
        }),
        departamentos: features.map(feature => {
            const attributes = feature?.attributes || {};
            return {
                codigo: String(attributes.MpCodigo || "").trim().slice(0, 2),
                nombre: attributes.Depto
            };
        })
    });
}
