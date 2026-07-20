/**
 * TerritoryDataService.js — Carga de Datos del Municipio
 *
 * Carga información específica de un municipio desde el servicio
 * ArcGIS de ocupación (MapServer/40).
 *
 * Responsabilidad:
 *   - loadMunicipioInfo(codigo): carga atributos del municipio
 *   - cachear resultados para evitar consultas repetidas
 *
 * Dependencias:
 *   - Fetch API (nativo)
 */
export class TerritoryDataService {
    constructor() {
        this._cache = {};
        this.BASE_URL = 'https://mapas2.igac.gov.co/server/rest/services/ordenamiento/componenteocupacion/MapServer/40';
    }

    async loadInfo(codigo) {
        if (this._cache[codigo]) return this._cache[codigo];

        const url = `${this.BASE_URL}/query?where=mpcodigo='${codigo}'&outFields=*&returnGeometry=false&f=json`;
        const res = await fetch(url);
        const json = await res.json();

        const info = json.features?.[0]?.attributes || null;
        this._cache[codigo] = info;
        return info;
    }
}
