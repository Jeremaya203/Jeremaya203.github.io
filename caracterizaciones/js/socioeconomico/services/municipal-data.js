import { socioeconomicoFeatureLayerUrl } from "./service-roots.js";
import { loadTerritorialCatalog } from "../../shared/territorial-catalog.js";

const SOCIOECONOMIC_TERRITORIES_URL = socioeconomicoFeatureLayerUrl(2);
const FALLBACK_TIMEOUT_MS = 5000;

const SPECIAL_DEPARTMENT_NAMES = Object.freeze({
    "00": "\u00c1rea en litigio",
    "11": "Bogot\u00e1, D.C.",
    "88": "San Andr\u00e9s y Providencia"
});

function specialDepartmentName(code) {
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

function sortMunicipalities(firstMunicipality, secondMunicipality) {
    return String(firstMunicipality.nombre || "").localeCompare(String(secondMunicipality.nombre || ""), "es", { sensitivity: "base" })
        || String(firstMunicipality.codigo || "").localeCompare(String(secondMunicipality.codigo || ""), "es", { sensitivity: "base" });
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

function normalizeTerritorialData({ municipalities: sourceMunicipalities = [], departments: sourceDepartments = [] } = {}) {
    const municipalityNames = {};
    const departmentNames = {};
    const municipalities = [];
    const seenMunicipalityCodes = new Set();

    sourceMunicipalities.forEach((item) => {
        const code = normalizeMunicipalityCode(item.codigo ?? item.id ?? item.mpcodigo ?? item.MpCodigo);
        const originalName = normalizeName(item.nombre ?? item.text ?? item.mpnombre ?? item.MpNombre);
        if (!code || !originalName || seenMunicipalityCodes.has(code)) return;

        const name = code === "00000" ? specialDepartmentName("00") : originalName;
        const departmentCode = code.slice(0, 2);

        seenMunicipalityCodes.add(code);
        municipalityNames[code] = name;
        municipalities.push({ codigo: code, nombre: name, depto: departmentCode });
    });

    sourceDepartments.forEach((item) => {
        const code = normalizeDepartmentCode(item.codigo ?? item.id ?? item.dpcodigo ?? item.DpCodigo);
        if (!code) return;

        const name = specialDepartmentName(code)
            || normalizeName(item.nombre ?? item.text ?? item.dpnombre ?? item.DpNombre)
            || code;
        departmentNames[code] = name;
    });

    municipalities.forEach((municipality) => {
        if (!departmentNames[municipality.depto]) {
            departmentNames[municipality.depto] = specialDepartmentName(municipality.depto) || municipality.depto;
        }
    });

    municipalities.sort(sortMunicipalities);

    return {
        municipalityNames,
        departmentNames,
        municipalities
    };
}

function assertValidTerritorialData(data, sourceName) {
    if (data?.municipalities?.length > 0) return data;
    throw new Error(sourceName + " no devolvio municipios validos.");
}

async function loadTerritoriesFromSocioeconomicService() {
    const params = new URLSearchParams({
        where: "1=1",
        outFields: "mpcodigo,mpnombre,dpcodigo,dpnombre",
        returnDistinctValues: "true",
        returnGeometry: "false",
        f: "json"
    });
    const json = await fetchJsonWithTimeout(SOCIOECONOMIC_TERRITORIES_URL + "/query?" + params.toString(), {}, FALLBACK_TIMEOUT_MS);
    const features = Array.isArray(json?.features) ? json.features : [];

    return normalizeTerritorialData({
        municipalities: features.map((feature) => feature?.attributes || {}),
        departments: features.map((feature) => feature?.attributes || {})
    });
}

export function getMunicipalityDisplayName(municipality, municipalityNames = {}) {
    const code = String(municipality?.codigo ?? municipality ?? "").trim();
    const name = String(municipality?.nombre ?? municipalityNames[code] ?? "").trim();

    if (code === "00000" || name === "00000") {
        return "Área en litigio";
    }

    return name || code;
}

export function createMunicipalDataController({
    getMunicipalityNames,
    setMunicipalityNames,
    getDepartmentNames,
    setDepartmentNames,
    getMunicipalities,
    setMunicipalities
}) {
    async function loadMunicipalityDictionary() {
        try {
            const data = assertValidTerritorialData(await loadTerritorialCatalog(), "Catálogo territorial");
            applyTerritorialData(data);
            return;
        } catch (error) {
            console.warn("Catálogo territorial compartido no disponible. Se usará FeatureServer/2 como respaldo:", error);
        }

        try {
            const data = assertValidTerritorialData(
                await loadTerritoriesFromSocioeconomicService(),
                "FeatureServer/2 socioeconomico"
            );
            applyTerritorialData(data);
        } catch (fallbackError) {
            console.error("Error cargando diccionario territorial socioeconomico", fallbackError);
        }
    }

    function applyTerritorialData(data) {
        const mergedMunicipalityNames = {
            ...getMunicipalityNames(),
            ...data.municipalityNames
        };
        const mergedDepartmentNames = {
            ...getDepartmentNames(),
            ...data.departmentNames
        };

        setMunicipalityNames(mergedMunicipalityNames);
        setDepartmentNames(mergedDepartmentNames);
        setMunicipalities(data.municipalities);
    }

    function buildMunicipalitiesFromDictionary() {
        const municipalityNames = getMunicipalityNames();
        const dictionaryMunicipalities = Object.keys(municipalityNames)
            .filter((code) => /^\d{5}$/.test(String(code)))
            .sort()
            .map((code) => ({
                codigo: code,
                nombre: municipalityNames[code] || code,
                depto: code.substring(0, 2)
            }));

        if (dictionaryMunicipalities.length) {
            setMunicipalities(dictionaryMunicipalities);
            loadDepartments();
            renderMunicipalities();
        }

        return dictionaryMunicipalities.length;
    }

    async function loadMunicipalities() {
        if (Object.keys(getMunicipalityNames()).length === 0) {
            await loadMunicipalityDictionary();
        }

        if (getMunicipalities().length) {
            loadDepartments();
            renderMunicipalities();
            return;
        }

        if (buildMunicipalitiesFromDictionary()) return;
    }

    function loadDepartments() {
        const departmentSelect = document.getElementById("departamentos");
        if (!departmentSelect) return;

        departmentSelect.innerHTML = `<option value="0">Seleccionar departamento</option>`;

        const optionColombia = document.createElement("option");
        optionColombia.value = "COL";
        optionColombia.textContent = "Colombia";
        departmentSelect.appendChild(optionColombia);

        const departmentNames = getDepartmentNames();

        const uniqueDepartments = [
            ...new Set(getMunicipalities().map((municipality) => municipality.depto))
        ]
            .map(codigoDepto => ({
                codigo: codigoDepto,
                nombre: codigoDepto === "00"
                    ? "Área en litigio"
                    : (departmentNames[codigoDepto] || codigoDepto)
            }))
            .sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));

        uniqueDepartments.forEach(({ codigo: code, nombre: name }) => {
            const option = document.createElement("option");
            option.value = code;
            option.textContent = name;

            departmentSelect.appendChild(option);
        });
    }

    function renderMunicipalities(departmentFilter = null) {
        const select = document.getElementById("municipios");
        if (!select) return;

        let activeDepartmentFilter = departmentFilter;
        if (!activeDepartmentFilter || activeDepartmentFilter === "0") {
            const selectedDepartment = document.getElementById("departamentos")?.value;
            if (selectedDepartment && selectedDepartment !== "0" && selectedDepartment !== "COL") {
                activeDepartmentFilter = selectedDepartment;
            }
        }

        if (!activeDepartmentFilter || activeDepartmentFilter === "0") {
            select.innerHTML = `<option value="">Seleccionar municipio</option>`;
            return;
        }

        select.innerHTML = `<option value="">Seleccionar municipio</option>`;
        select.disabled = false;

        const filteredMunicipalities = getMunicipalities().filter((municipality) => municipality.depto === activeDepartmentFilter);

        filteredMunicipalities.forEach((municipality) => {
            const option = document.createElement("option");
            option.value = municipality.codigo;
            option.textContent = getMunicipalityDisplayName(municipality, getMunicipalityNames());
            select.appendChild(option);
        });
    }

    return {
        loadMunicipalityDictionary,
        loadMunicipalities,
        loadDepartments,
        renderMunicipalities,
        getMunicipalityDisplayName
    };
}
