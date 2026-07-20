/**
 * PieRenderer.js — Renderer de Gráficos Pie
 *
 * Renderiza gráficos de tipo pie para distribuciones simples
 * (ej: determinantes punto patrimoniales).
 *
 * Responsabilidad:
 *   - render(codigo, config): query y renderizado pie
 *   - Manejar click → emitir evento
 *
 * Dependencias:
 *   - ChartFactory.js, ChartLifecycle.js
 *   - ArcGISStatisticService.js
 *   - EventBus.js
 */
export class PieRenderer {
    constructor(statService, chartFactory, chartLifecycle, eventBus) {
        this.statService = statService;
        this.chartFactory = chartFactory;
        this.chartLifecycle = chartLifecycle;
        this.eventBus = eventBus;
    }

    render(codigo, config) { }
}
