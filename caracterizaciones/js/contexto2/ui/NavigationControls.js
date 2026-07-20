/**
 * NavigationControls.js — Botones de Navegación entre Capas
 *
 * Maneja los botones anterior/siguiente para navegar entre
 * las subcapas de cada modo.
 *
 * Responsabilidad:
 *   - prevLayer(): decrementa currentSubLayerIndex y recarga
 *   - nextLayer(): incrementa currentSubLayerIndex y recarga
 *   - Emitir eventos de cambio via EventBus
 *
 * Dependencias:
 *   - State.js, EventBus.js, LayerConfig.js
 */
export class NavigationControls {
    constructor(state, eventBus, layerConfig) {
        this.state = state;
        this.eventBus = eventBus;
        this.layerConfig = layerConfig;
    }

    prev() { }
    next() { }
}
