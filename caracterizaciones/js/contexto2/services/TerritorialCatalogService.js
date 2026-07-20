const FALLBACK_TERRITORIES_URL = 'https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentecontextolegal/MapServer/2';
const LIMITES_FEATURESERVER_URL = 'https://mapas2.igac.gov.co/server/rest/services/limites/limites/FeatureServer/1';
const TERRITORIAL_CACHE_KEY = 'contexto2:territorial-catalog:v3';
const TERRITORIAL_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const PRIMARY_TIMEOUT_MS = 2600;
const FALLBACK_TIMEOUT_MS = 5000;

const SPECIAL_DEPARTMENT_NAMES = {
    '00': '\u00c1rea en litigio',
    '11': 'Bogot\u00e1, D.C.',
    '88': 'San Andr\u00e9s y Providencia'
};

function normalizeMunicipioCode(value) {
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

function sortMunicipios(a, b) {
    return String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es', { sensitivity: 'base' })
        || String(a.codigo || '').localeCompare(String(b.codigo || ''), 'es', { sensitivity: 'base' });
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

        const limitesPromise = this._withTimeout(
                this._loadLimitesCatalog(),
                FALLBACK_TIMEOUT_MS,
                'fallback FeatureServer/1 limites'
            )
            .then(catalog => this._assertValidCatalog(catalog, 'fallback FeatureServer/1 limites'));

        const catalog = await this._firstValidCatalog([
            primaryPromise,
            fallbackPromise,
            limitesPromise
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

        const codigos = this.dictService.getMunicipioCodes?.() || [];

        return this._buildCatalogFromCodes(codigos);
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

    async _loadLimitesCatalog() {
        const params = new URLSearchParams({
            where: '1=1',
            outFields: 'MpCodigo,MpNombre,Depto',
            returnGeometry: 'false',
            resultRecordCount: '2000',
            f: 'json'
        });
        const json = await this._fetchJsonWithTimeout(
            `${LIMITES_FEATURESERVER_URL}/query?${params.toString()}`,
            FALLBACK_TIMEOUT_MS
        );
        const features = Array.isArray(json?.features) ? json.features : [];

        return this._buildCatalogFromLimitesFeatures(features);
    }

    _buildCatalogFromLimitesFeatures(features) {
        const rows = features.map(feature => {
            const attributes = feature?.attributes || {};
            const codigo = normalizeMunicipioCode(attributes.MpCodigo);
            const depto = codigo.slice(0, 2);
            return {
                mpcodigo: codigo,
                mpnombre: normalizeName(attributes.MpNombre),
                dpcodigo: depto,
                dpnombre: normalizeName(attributes.Depto)
            };
        });
        return this._buildCatalogFromAttributes(rows);
    }

    _buildCatalogFromCodes(codigos) {
        const todosMunicipios = codigos.map(codigo => ({
            codigo,
            nombre: codigo === '00000'
                ? specialDepartmentName('00')
                : this.dictService.getMunicipioName(codigo),
            depto: codigo.substring(0, 2)
        })).sort(sortMunicipios);

        return {
            todosMunicipios,
            diccionarioMunicipios: Object.fromEntries(todosMunicipios.map(item => [item.codigo, item.nombre])),
            diccionarioDepartamentos: Object.fromEntries([...new Set(todosMunicipios.map(item => item.depto))]
                .map(code => [code, specialDepartmentName(code) || this.dictService.getDepartamentoName(code)]))
        };
    }

    _buildCatalogFromAttributes(rows) {
        const diccionarioMunicipios = {};
        const diccionarioDepartamentos = {};
        const todosMunicipios = [];
        const seen = new Set();

        rows.forEach(attrs => {
            const codigo = normalizeMunicipioCode(attrs.mpcodigo ?? attrs.MPCODIGO);
            const depto = normalizeDepartmentCode(attrs.dpcodigo ?? attrs.DPCODIGO) || codigo.substring(0, 2);
            if (!codigo || !depto || seen.has(codigo)) return;

            const nombre = codigo === '00000'
                ? specialDepartmentName('00')
                : normalizeName(attrs.mpnombre ?? attrs.MPNOMBRE) || this.dictService.getMunicipioName(codigo);
            const nombreDepto = specialDepartmentName(depto)
                || normalizeName(attrs.dpnombre ?? attrs.DPNOMBRE)
                || this.dictService.getDepartamentoName(depto);

            seen.add(codigo);
            diccionarioMunicipios[codigo] = nombre || codigo;
            diccionarioDepartamentos[depto] = nombreDepto || depto;
            todosMunicipios.push({
                codigo,
                nombre: diccionarioMunicipios[codigo],
                depto
            });
        });

        todosMunicipios.sort(sortMunicipios);
        return { todosMunicipios, diccionarioMunicipios, diccionarioDepartamentos };
    }

    _assertValidCatalog(catalog, sourceName) {
        if (catalog?.todosMunicipios?.length) return catalog;
        throw new Error(`${sourceName} no devolvio municipios validos.`);
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
            municipios: catalog.diccionarioMunicipios,
            departamentos: catalog.diccionarioDepartamentos
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
        } catch (_error) {
            return null;
        }
    }

    _saveToCache(catalog) {
        try {
            const payload = JSON.stringify({ createdAt: Date.now(), catalog });
            window.sessionStorage?.setItem(TERRITORIAL_CACHE_KEY, payload);
            window.localStorage?.setItem(TERRITORIAL_CACHE_KEY, payload);
        } catch (_error) {
            // La cache es una optimizacion; si el navegador la bloquea, el flujo normal sigue.
        }
    }
}
