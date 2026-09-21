/**
 * pie-renderer.js — Renderer de Gráficos Pie
 *
 * Renderiza gráficos de tipo pie para distribuciones simples
 * (ej: determinantes punto patrimoniales).
 *
 * Responsabilidad:
 *   - render(codigo, config): query y renderizado pie
 *   - Manejar click → emitir evento
 *
 * Dependencias:
 *   - chart-factory.js, chart-lifecycle.js
 *   - arcgis-statistic-service.js
 *   - event-bus.js
 */
export class PieRenderer {
    constructor(statService, chartFactory, chartLifecycle, eventBus) {
        this.statService = statService;
        this.chartFactory = chartFactory;
        this.chartLifecycle = chartLifecycle;
        this.eventBus = eventBus;
    }

    render(code, config) { }
}
