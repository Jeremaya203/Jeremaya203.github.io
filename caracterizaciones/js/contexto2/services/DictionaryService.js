const GEOVISOR_DICTIONARY_URL = 'https://serviciosgeovisor.igac.gov.co:8080/Geovisor/config?cmd=config_diccionario2';

export class DictionaryService {
    constructor() {
        this.municipios = {};
        this.departamentos = {};
        this._loaded = false;
        this.timeoutMs = 2500;
    }

    async load() {
        if (this._loaded) return true;

        try {
            const json = await this._fetchJsonWithTimeout(GEOVISOR_DICTIONARY_URL, this.timeoutMs);
            const unidades = Array.isArray(json?.UNIDAD) ? json.UNIDAD : [];

            unidades.forEach(unit => {
                if (unit.type === 'MUNI') {
                    this.municipios[unit.id] = unit.id === '00000' ? '\u00c1rea en litigio' : unit.text;
                }
                if (unit.type === 'DEPTO') {
                    this.departamentos[unit.id] = unit.id === '00' ? '\u00c1rea en litigio' : unit.text;
                }
            });

            if (this.hasMunicipioNames() && this.hasDepartamentoNames()) {
                this._loaded = true;
                return true;
            }
        } catch (error) {
            console.warn('Error cargando diccionario territorial GeoVisor', error);
        }

        return false;
    }

    async _fetchJsonWithTimeout(url, timeoutMs) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, { signal: controller.signal });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status} al consultar ${url}`);
            }
            return await response.json();
        } finally {
            clearTimeout(timeoutId);
        }
    }

    mergeTerritories({ municipios = {}, departamentos = {} } = {}) {
        this.municipios = { ...this.municipios, ...municipios };
        this.departamentos = { ...this.departamentos, ...departamentos };
        if (Object.keys(municipios).length || Object.keys(departamentos).length) {
            this._loaded = true;
        }
    }

    hasMunicipioNames() {
        return Object.keys(this.municipios || {}).length > 0;
    }

    hasDepartamentoNames() {
        return Object.keys(this.departamentos || {}).length > 0;
    }

    getMunicipioCodes() {
        return Object.keys(this.municipios || {}).filter(code => /^\d{5}$/.test(String(code)));
    }

    getMunicipioName(codigo) {
        return this.municipios[codigo] || codigo;
    }

    getDepartamentoName(codigo) {
        return this.departamentos[codigo] || codigo;
    }
}
