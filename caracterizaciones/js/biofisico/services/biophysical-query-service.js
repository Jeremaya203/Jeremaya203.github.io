export { arcRestQuery, fetchBF3Stats, fetchGroupedStats } from "../data.js";
import { loadTerritorialCatalog } from "../../shared/territorial-catalog.js";

let municipalityDictionaryPromise = null;
const municipalityInfoCache = new Map();
const distinctMunicipalityCodesCache = new Map();
const layerSourceCache = new Map();

export async function fetchMunicipalityDictionary() {
    if (municipalityDictionaryPromise) {
        return municipalityDictionaryPromise;
    }

    municipalityDictionaryPromise = loadTerritorialCatalog()
        .then(catalog => {
            if (!catalog?.municipalities?.length) {
                throw new Error("No fue posible cargar el catálogo territorial.");
            }
            return {
                municipalityNames: catalog.municipalityNames,
                departmentNames: catalog.departmentNames
            };
        })
        .catch(error => {
            municipalityDictionaryPromise = null;
            throw error;
        });

    return municipalityDictionaryPromise;
}

export async function fetchMunicipalityInfo(code, { sqlEquals }) {
    const cacheKey = String(code || "").trim();

    if (municipalityInfoCache.has(cacheKey)) {
        return municipalityInfoCache.get(cacheKey);
    }

    const url = "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentebiofisico/MapServer/40";
    const where = sqlEquals("mpcodigo", code);
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
