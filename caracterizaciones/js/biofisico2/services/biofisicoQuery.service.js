export { arcRestQuery, fetchBF3Stats, fetchGroupedStats } from "../data.js";

let municipalityDictionaryPromise = null;
const municipalityInfoCache = new Map();
const distinctMunicipalityCodesCache = new Map();
const layerSourceCache = new Map();

export async function fetchMunicipalityDictionary() {
    if (municipalityDictionaryPromise) {
        return municipalityDictionaryPromise;
    }

    const url = "https://serviciosgeovisor.igac.gov.co:8080/Geovisor/config?cmd=config_diccionario2";

    municipalityDictionaryPromise = fetch(url)
        .then(res => res.json())
        .then(json => {
            const municipios = {};
            const departamentos = {};

            if (json && json.UNIDAD) {
                json.UNIDAD
                    .filter(unit => unit.type === "MUNI")
                    .forEach(unit => {
                        municipios[unit.id] = unit.text;
                    });

                json.UNIDAD
                    .filter(unit => unit.type === "DEPTO")
                    .forEach(unit => {
                        if (unit.id === "00") {
                            departamentos[unit.id] = "Area en litigio";
                        } else if (unit.id === "88") {
                            departamentos[unit.id] = "San Andres, Providencia y Santa Catalina";
                        } else {
                            departamentos[unit.id] = unit.text;
                        }
                    });
            }

            return { municipios, departamentos };
        })
        .catch(error => {
            municipalityDictionaryPromise = null;
            throw error;
        });

    return municipalityDictionaryPromise;
}

export async function fetchMunicipalityInfo(codigo, { sqlEquals }) {
    const cacheKey = String(codigo || "").trim();

    if (municipalityInfoCache.has(cacheKey)) {
        return municipalityInfoCache.get(cacheKey);
    }

    const url = "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentebiofisico/MapServer/40";
    const where = sqlEquals("mpcodigo", codigo);
    const params = new URLSearchParams({
        where,
        outFields: "*",
        returnGeometry: "false",
        f: "json"
    });
    const queryUrl = `${url}/query?${params.toString()}`;

    const infoPromise = fetch(queryUrl)
        .then(res => res.json())
        .then(json => (
            json.features && json.features.length > 0
                ? json.features[0].attributes
                : null
        ))
        .catch(error => {
            municipalityInfoCache.delete(cacheKey);
            throw error;
        });

    municipalityInfoCache.set(cacheKey, infoPromise);
    return infoPromise;
}

export async function fetchDistinctMunicipalityCodes({ FeatureLayer, url }) {
    const cacheKey = String(url || "").trim();

    if (distinctMunicipalityCodesCache.has(cacheKey)) {
        return distinctMunicipalityCodesCache.get(cacheKey);
    }

    const tempLayer = new FeatureLayer({ url });
    const query = tempLayer.createQuery();
    query.where = "1=1";
    query.outFields = ["mpcodigo"];
    query.returnDistinctValues = true;
    query.returnGeometry = false;

    const codesPromise = tempLayer.queryFeatures(query)
        .then(result => [...new Set(
            result.features.map(feature => feature.attributes.mpcodigo)
        )].sort())
        .catch(error => {
            distinctMunicipalityCodesCache.delete(cacheKey);
            throw error;
        });

    distinctMunicipalityCodesCache.set(cacheKey, codesPromise);
    return codesPromise;
}

export async function fetchLayerSource(layer) {
    const cacheKey = String(layer?.url || "").trim();

    if (cacheKey && layerSourceCache.has(cacheKey)) {
        return layerSourceCache.get(cacheKey);
    }

    const sourcePromise = layer.queryFeatures({
            where: "1=1",
            outFields: ["Fuente"],
            num: 1,
            returnGeometry: false
        })
        .then(result => (
            result.features.length > 0
                ? result.features[0].attributes.Fuente
                : ""
        ))
        .catch(error => {
            if (cacheKey) layerSourceCache.delete(cacheKey);
            throw error;
        });

    if (cacheKey) {
        layerSourceCache.set(cacheKey, sourcePromise);
    }

    return sourcePromise;
}

export function clearBiofisicoQueryServiceCache() {
    municipalityDictionaryPromise = null;
    municipalityInfoCache.clear();
    distinctMunicipalityCodesCache.clear();
    layerSourceCache.clear();
}
