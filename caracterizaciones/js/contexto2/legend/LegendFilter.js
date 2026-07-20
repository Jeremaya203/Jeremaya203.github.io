/**
 * LegendFilter.js — Filtro del Mapa por Clic en Leyenda
 *
 * Permite al usuario hacer clic en los items de la leyenda
 * para filtrar el mapa (mostrar/ocultar categorías).
 *
 * Responsabilidad:
 *   - bindClickEvents(): registra clic en items de leyenda
 *   - applyFilter(code): aplica filtro WHERE en la capa activa
 *   - resetFilter(): restaura todas las categorías visibles
 *   - syncState(): sincroniza estado visual con legendState
 *
 * Dependencias:
 *   - State.js, EventBus.js
 *   - LegendRenderer.js
 */
export class LegendFilter {
    constructor(state, eventBus, legendRenderer) {
        this.state = state;
        this.eventBus = eventBus;
        this.legendRenderer = legendRenderer;
    }

    bind() { }
    apply(code) { }
    reset() { }
}
