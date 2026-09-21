// Catálogo territorial compartido por los componentes de Caracterizaciones.
const GEOVIEWER_URL = "https://serviciosgeovisor.igac.gov.co:8080/Geovisor/config?cmd=config_diccionario2";
const BOUNDARIES_FEATURE_SERVICE_URL = "https://mapas2.igac.gov.co/server/rest/services/limites/limites/FeatureServer/1/query";
const GEOVIEWER_TIMEOUT_MS = 2500;
const FALLBACK_TIMEOUT_MS = 5000;
let territorialCatalogPromise = null;

const SPECIAL_DEPARTMENT_NAMES = Object.freeze({
    "00": "\u00c1rea en litigio",
    "88": "San Andr\u00e9s y Providencia"
});

function getSpecialDepartmentName(code) {
    return SPECIAL_DEPARTMENT_NAMES[String(code || "").trim()] || "";
}
function normalizeMunicipalityCode(value) {
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

function sortMunicipalitiesByName(firstMunicipality, secondMunicipality) {
    return String(firstMunicipality.nombre || "").localeCompare(
        String(secondMunicipality.nombre || ""),
        "es",
        { sensitivity: "base" }
    ) || String(firstMunicipality.codigo || "").localeCompare(
        String(secondMunicipality.codigo || ""),
        "es",
        { sensitivity: "base" }
    );
}

function normalizeTerritories(payload) {
    const sourceMunicipalities = Array.isArray(payload?.municipios) ? payload.municipios : [];
    const sourceDepartments = Array.isArray(payload?.departamentos) ? payload.departamentos : [];
    const municipalityNames = {};
    const departmentNames = {};
    const municipalities = [];
    const municipalityCodes = new Set();

    sourceMunicipalities.forEach((item) => {
        const code = normalizeMunicipalityCode(item?.codigo ?? item?.id);
        const originalName = normalizeName(item?.nombre ?? item?.text);
        if (!code || !originalName || municipalityCodes.has(code)) return;

        const name = code === "00000" ? getSpecialDepartmentName("00") : originalName;
        const departmentCode = code.slice(0, 2);
        municipalityCodes.add(code);
        municipalityNames[code] = name;
        municipalities.push({ codigo: code, nombre: name, depto: departmentCode });
    });

    sourceDepartments.forEach((item) => {
        const code = normalizeDepartmentCode(item?.codigo ?? item?.id);
        if (!code) return;
        departmentNames[code] = getSpecialDepartmentName(code)
            || normalizeName(item?.nombre ?? item?.text)
            || code;
    });

    municipalities.forEach((municipality) => {
        if (!departmentNames[municipality.depto]) {
            departmentNames[municipality.depto] = getSpecialDepartmentName(municipality.depto)
                || municipality.depto;
        }
    });
    municipalities.sort(sortMunicipalitiesByName);

    return {
        municipalityNames: municipalityNames,
        departmentNames: departmentNames,
        municipalities: municipalities
    };
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

async function loadDictionaryFromGeoViewer() {
    const json = await fetchJsonWithTimeout(GEOVIEWER_URL, {}, GEOVIEWER_TIMEOUT_MS);
    const units = Array.isArray(json?.UNIDAD) ? json.UNIDAD : [];

    return normalizeTerritories({
        municipios: units.filter((unit) => unit?.type === "MUNI"),
        departamentos: units.filter((unit) => unit?.type === "DEPTO")
    });
}

function validateTerritorialCatalog(data, sourceName) {
    if (data?.municipalities?.length > 0) return data;
    throw new Error(sourceName + " no devolvio municipios validos.");
}

export function loadTerritorialCatalog() {
    if (territorialCatalogPromise) return territorialCatalogPromise;

    const geoViewerPromise = loadDictionaryFromGeoViewer()
        .then((data) => validateTerritorialCatalog(data, "GeoVisor"));
    const fallbackPromise = loadDictionaryFromFeatureService()
        .then((data) => validateTerritorialCatalog(data, "FeatureServer/1"));

    territorialCatalogPromise = Promise.any([geoViewerPromise, fallbackPromise])
        .catch((error) => {
            territorialCatalogPromise = null;
            const details = error instanceof AggregateError ? error.errors : [error];
            details.forEach((detail) => console.warn("Fuente territorial no disponible:", detail));
            console.error("No fue posible construir el diccionario territorial desde ninguna fuente.");
            return null;
        });

    return territorialCatalogPromise;
}

async function loadDictionaryFromFeatureService() {
    const params = new URLSearchParams({
        where: "1=1",
        outFields: "MpCodigo,MpNombre,Depto",
        returnGeometry: "false",
        f: "json"
    });
    const json = await fetchJsonWithTimeout(
        BOUNDARIES_FEATURE_SERVICE_URL + "?" + params.toString(),
        {},
        FALLBACK_TIMEOUT_MS
    );
    const features = Array.isArray(json?.features) ? json.features : [];

    return normalizeTerritories({
        municipios: features.map((feature) => {
            const attributes = feature?.attributes || {};
            return { codigo: attributes.MpCodigo, nombre: attributes.MpNombre };
        }),
        departamentos: features.map((feature) => {
            const attributes = feature?.attributes || {};
            return {
                codigo: String(attributes.MpCodigo || "").trim().slice(0, 2),
                nombre: attributes.Depto
            };
        })
    });
}
