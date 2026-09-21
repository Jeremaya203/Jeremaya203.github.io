const FALLBACK_TERRITORIES_URL = 'https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentecontextolegal/MapServer/2';
const BOUNDARIES_FEATURE_SERVER_URL = 'https://mapas2.igac.gov.co/server/rest/services/limites/limites/FeatureServer/1';
const TERRITORIAL_CACHE_KEY = 'contexto:territorial-catalog:v4';
const TERRITORIAL_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const PRIMARY_TIMEOUT_MS = 2600;
const FALLBACK_TIMEOUT_MS = 5000;

const SPECIAL_DEPARTMENT_NAMES = Object.freeze({
    '00': '\u00c1rea en litigio',
    '11': 'Bogot\u00e1, D.C.',
    '88': 'San Andr\u00e9s y Providencia'
});

function normalizeMunicipalityCode(value) {
    const code = String(value ?? '').trim();
    return /^\d{5}$/.test(code) ? code : '';
}

function normalizeDepartmentCode(value) {
    const code = String(value ?? '').trim();
    return /^\d{2}$/.test(code) ? code : '';
}

function normalizeName(value) {
    return String(value ?? '').trim();
}

function specialDepartmentName(code) {
    return SPECIAL_DEPARTMENT_NAMES[String(code ?? '').trim()] || '';
}

function sortMunicipalities(firstMunicipality, secondMunicipality) {
    return String(firstMunicipality.nombre || '').localeCompare(String(secondMunicipality.nombre || ''), 'es', { sensitivity: 'base' })
        || String(firstMunicipality.codigo || '').localeCompare(String(secondMunicipality.codigo || ''), 'es', { sensitivity: 'base' });
}

export class TerritorialCatalogService {
    constructor(queryService, dictService, layerConfig) {
        this.queryService = queryService;
        this.dictService = dictService;
        this.layerConfig = layerConfig;
        this._catalogPromise = null;
    }

    async loadCatalog() {
        if (this._catalogPromise) return this._catalogPromise;

        const cached = this._loadFromCache();
        if (cached) {
            this._mergeCatalogIntoDictionary(cached);
            return cached;
        }

        this._catalogPromise = this._loadCatalog().catch(error => {
            this._catalogPromise = null;
            throw error;
        });
        return this._catalogPromise;
    }

    async _loadCatalog() {
        const primaryPromise = this._withTimeout(
                this._loadPrimaryCatalog(),
                PRIMARY_TIMEOUT_MS,
                'catalogo principal contexto legal'
            )
            .then(catalog => this._assertValidCatalog(catalog, 'catalogo principal contexto legal'));

        const fallbackPromise = this._withTimeout(
                this._loadFallbackCatalog(),
                FALLBACK_TIMEOUT_MS,
                'fallback MapServer/2 contexto legal'
            )
            .then(catalog => this._assertValidCatalog(catalog, 'fallback MapServer/2 contexto legal'));

        const boundariesCatalogPromise = this._withTimeout(
                this._loadBoundariesCatalog(),
                FALLBACK_TIMEOUT_MS,
                'fallback FeatureServer/1 limites'
            )
            .then(catalog => this._assertValidCatalog(catalog, 'fallback FeatureServer/1 limites'));

        const catalog = await this._firstValidCatalog([
            primaryPromise,
            fallbackPromise,
            boundariesCatalogPromise
        ]);
        this._saveToCache(catalog);
        this._mergeCatalogIntoDictionary(catalog);
        return catalog;
    }

    async _loadPrimaryCatalog() {
        await this.dictService.load();

        if (!this.dictService.hasMunicipioNames?.() || !this.dictService.hasDepartamentoNames?.()) {
            throw new Error('El diccionario no devolvio nombres territoriales suficientes.');
        }

        const municipalityCodes = this.dictService.getMunicipioCodes?.() || [];

        return this._buildCatalogFromCodes(municipalityCodes);
    }

    async _loadFallbackCatalog() {
        const params = new URLSearchParams({
            where: '1=1',
            outFields: 'mpcodigo,mpnombre,dpcodigo,dpnombre',
            returnGeometry: 'false',
            resultRecordCount: '2000',
            f: 'json'
        });
        const json = await this._fetchJsonWithTimeout(
            `${FALLBACK_TERRITORIES_URL}/query?${params.toString()}`,
            FALLBACK_TIMEOUT_MS
        );
        const features = Array.isArray(json?.features) ? json.features : [];

        const catalog = this._buildCatalogFromAttributes((features || []).map(feature => feature?.attributes || {}));
        return catalog;
    }

    async _loadBoundariesCatalog() {
        const params = new URLSearchParams({
            where: '1=1',
            outFields: 'MpCodigo,MpNombre,Depto',
            returnGeometry: 'false',
            resultRecordCount: '2000',
            f: 'json'
        });
        const json = await this._fetchJsonWithTimeout(
            `${BOUNDARIES_FEATURE_SERVER_URL}/query?${params.toString()}`,
            FALLBACK_TIMEOUT_MS
        );
        const features = Array.isArray(json?.features) ? json.features : [];

        return this._buildCatalogFromBoundaryFeatures(features);
    }

    _buildCatalogFromBoundaryFeatures(features) {
        const rows = features.map((feature) => {
            const attributes = feature?.attributes || {};
            const municipalityCode = normalizeMunicipalityCode(attributes.MpCodigo);
            const departmentCode = municipalityCode.slice(0, 2);
            return {
                mpcodigo: municipalityCode,
                mpnombre: normalizeName(attributes.MpNombre),
                dpcodigo: departmentCode,
                dpnombre: normalizeName(attributes.Depto)
            };
        });
        return this._buildCatalogFromAttributes(rows);
    }

    _buildCatalogFromCodes(municipalityCodes) {
        const municipalities = municipalityCodes.map((municipalityCode) => ({
            codigo: municipalityCode,
            nombre: municipalityCode === '00000'
                ? specialDepartmentName('00')
                : this.dictService.getMunicipalityName(municipalityCode),
            depto: municipalityCode.substring(0, 2)
        })).sort(sortMunicipalities);

        return {
            municipalities: municipalities,
            municipalityNames: Object.fromEntries(municipalities.map((item) => [item.codigo, item.nombre])),
            departmentNames: Object.fromEntries([...new Set(municipalities.map((item) => item.depto))]
                .map(code => [code, specialDepartmentName(code) || this.dictService.getDepartmentName(code)]))
        };
    }

    _buildCatalogFromAttributes(rows) {
        const municipalityNames = {};
        const departmentNames = {};
        const municipalities = [];
        const seenCodes = new Set();

        rows.forEach((attributes) => {
            const municipalityCode = normalizeMunicipalityCode(attributes.mpcodigo ?? attributes.MPCODIGO);
            const departmentCode = normalizeDepartmentCode(attributes.dpcodigo ?? attributes.DPCODIGO) || municipalityCode.substring(0, 2);
            if (!municipalityCode || !departmentCode || seenCodes.has(municipalityCode)) return;

            const municipalityName = municipalityCode === '00000'
                ? specialDepartmentName('00')
                : normalizeName(attributes.mpnombre ?? attributes.MPNOMBRE) || this.dictService.getMunicipalityName(municipalityCode);
            const departmentName = specialDepartmentName(departmentCode)
                || normalizeName(attributes.dpnombre ?? attributes.DPNOMBRE)
                || this.dictService.getDepartmentName(departmentCode);

            seenCodes.add(municipalityCode);
            municipalityNames[municipalityCode] = municipalityName || municipalityCode;
            departmentNames[departmentCode] = departmentName || departmentCode;
            municipalities.push({
                codigo: municipalityCode,
                nombre: municipalityNames[municipalityCode],
                depto: departmentCode
            });
        });

        municipalities.sort(sortMunicipalities);
        return {
            municipalities: municipalities,
            municipalityNames: municipalityNames,
            departmentNames: departmentNames
        };
    }

    _assertValidCatalog(catalog, sourceName) {
        if (catalog?.municipalities?.length) return catalog;
        throw new Error(`${sourceName} no devolvió municipios válidos.`);
    }

    _firstValidCatalog(promises) {
        return new Promise((resolve, reject) => {
            const errors = [];
            let pending = promises.length;
            let settled = false;

            promises.forEach(promise => {
                promise.then(catalog => {
                    if (settled) return;
                    settled = true;
                    resolve(catalog);
                }).catch(error => {
                    errors.push(error);
                    pending -= 1;
                    if (!pending && !settled) {
                        reject(new Error(errors.map(item => item?.message || item).join(' | ')));
                    }
                });
            });
        });
    }

    _withTimeout(promise, timeoutMs, label) {
        let timeoutId = null;
        const timeout = new Promise((_, reject) => {
            timeoutId = setTimeout(() => {
                reject(new Error(`${label} supero ${timeoutMs} ms.`));
            }, timeoutMs);
        });

        return Promise.race([promise, timeout]).finally(() => {
            clearTimeout(timeoutId);
        });
    }

    async _fetchJsonWithTimeout(url, timeoutMs) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, { signal: controller.signal });
            if (!response.ok) throw new Error(`HTTP ${response.status} al consultar ${url}`);
            const json = await response.json();
            if (json?.error) throw new Error(json.error.message || JSON.stringify(json.error));
            return json;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    _mergeCatalogIntoDictionary(catalog) {
        this.dictService.mergeTerritories?.({
            municipalityNames: catalog.municipalityNames,
            departmentNames: catalog.departmentNames
        });
    }

    _loadFromCache() {
        try {
            const raw = window.sessionStorage?.getItem(TERRITORIAL_CACHE_KEY)
                || window.localStorage?.getItem(TERRITORIAL_CACHE_KEY);
            if (!raw) return null;
            const cached = JSON.parse(raw);
            if (!cached?.createdAt || Date.now() - cached.createdAt > TERRITORIAL_CACHE_TTL_MS) return null;
            return this._assertValidCatalog(cached.catalog, 'cache territorial contexto legal');
        } catch {
            return null;
        }
    }

    _saveToCache(catalog) {
        try {
            const payload = JSON.stringify({ createdAt: Date.now(), catalog });
            window.sessionStorage?.setItem(TERRITORIAL_CACHE_KEY, payload);
            window.localStorage?.setItem(TERRITORIAL_CACHE_KEY, payload);
        } catch {
            // La cache es una optimizacion; si el navegador la bloquea, el flujo normal sigue.
        }
    }
}
