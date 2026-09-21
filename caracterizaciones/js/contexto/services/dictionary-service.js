import { loadTerritorialCatalog } from '../../shared/territorial-catalog.js';

export class DictionaryService {
    constructor() {
        this.municipalityNames = {};
        this.departmentNames = {};
        this._loaded = false;
    }

    async load() {
        if (this._loaded) return true;

        try {
            const catalog = await loadTerritorialCatalog();
            if (!catalog?.municipalities?.length) return false;
            this.municipalityNames = { ...catalog.municipalityNames };
            this.departmentNames = { ...catalog.departmentNames };

            if (this.hasMunicipioNames() && this.hasDepartamentoNames()) {
                this._loaded = true;
                return true;
            }
        } catch (error) {
            console.warn('Error cargando catálogo territorial', error);
        }

        return false;
    }

    mergeTerritories({ municipalityNames = {}, departmentNames = {} } = {}) {
        this.municipalityNames = { ...this.municipalityNames, ...municipalityNames };
        this.departmentNames = { ...this.departmentNames, ...departmentNames };
        if (Object.keys(municipalityNames).length || Object.keys(departmentNames).length) {
            this._loaded = true;
        }
    }

    hasMunicipioNames() {
        return Object.keys(this.municipalityNames || {}).length > 0;
    }

    hasDepartamentoNames() {
        return Object.keys(this.departmentNames || {}).length > 0;
    }

    getMunicipioCodes() {
        return Object.keys(this.municipalityNames || {}).filter(code => /^\d{5}$/.test(String(code)));
    }

    getMunicipalityName(code) {
        return this.municipalityNames[code] || code;
    }

    getDepartmentName(code) {
        return this.departmentNames[code] || code;
    }
}
