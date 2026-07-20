/**
 * ChartRegistry.js — Registro Central de Configuraciones de Gráficos
 *
 * Almacena todas las configuraciones de gráficos organizadas por
 * id de capa. Permite registrar nuevos gráficos sin modificar
 * otras partes del código.
 *
 * Responsabilidad:
 *   - register(id, config): agrega una nueva configuración de gráfico
 *   - get(id): obtiene la configuración para un id de capa
 *   - getAll(): retorna todas las configuraciones registradas
 *
 * Cada configuración puede tener:
 *   - renderer: instancia de una clase renderer específica
 *   - tdeterm: código de tipo de determinante (para genéricos)
 *   - tipo: 'doughnut', 'bar', 'stacked-bar', 'pie'
 *   - titulo: texto descriptivo
 *
 * Uso:
 *   registry.register('determinantes_sinap', {
 *       tdeterm: 1,
 *       titulo: 'SINAP',
 *       tipo: 'doughnut'
 *   });
 */
export class ChartRegistry {
    constructor() {
        this._entries = {};
    }

    register(id, config) {
        this._entries[id] = config;
    }

    get(id) {
        return this._entries[id] || null;
    }

    getAll() {
        return { ...this._entries };
    }
}
