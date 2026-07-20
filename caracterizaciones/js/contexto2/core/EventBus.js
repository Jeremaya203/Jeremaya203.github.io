/**
 * EventBus.js — Bus de Eventos Desacoplado
 *
 * Sistema pub/sub para comunicación entre módulos.
 * Ninguna clase necesita importar directamente a otra clase de dominio diferente.
 *
 * Responsabilidad:
 *   - Canal único de comunicación entre map, charts, legend, ui y services
 *   - emit(evento, datos) → dispara el evento
 *   - on(evento, callback) → escucha el evento
 *   - off(evento, callback) → remueve listener
 *
 * Uso:
 *   eventBus.emit('chart:slice-click', { where: '...' });
 *   eventBus.on('chart:slice-click', (data) => { ... });
 */
export class EventBus {
    constructor() {
        this._handlers = {};
    }

    on(event, fn) {
        if (!this._handlers[event]) this._handlers[event] = [];
        this._handlers[event].push(fn);
    }

    off(event, fn) {
        this._handlers[event] = (this._handlers[event] || []).filter(f => f !== fn);
    }

    emit(event, data) {
        (this._handlers[event] || []).forEach(fn => fn(data));
    }
}
