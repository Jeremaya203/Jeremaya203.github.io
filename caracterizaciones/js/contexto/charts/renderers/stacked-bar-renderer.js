/**
 * stacked-bar-renderer.js — Renderer de Barras Apiladas
 *
 * Renderiza gráficos de barras apiladas para subtipos de
 * determinantes que tienen múltiples descripciones (Planificación, Riesgo, Patrimonio).
 *
 * Responsabilidad:
 *   - render(codigo, config): query agrupado y renderizado stacked-bar
 *   - Manejar click → emitir 'chart:stacked-click' con subdet y descrip
 *
 * Dependencias:
 *   - chart-factory.js, chart-lifecycle.js
 *   - arcgis-query-service.js, arcgis-statistic-service.js
 *   - event-bus.js
 */
export class StackedBarRenderer {
    constructor(queryService, statService, chartFactory, chartLifecycle, eventBus) {
        this.queryService = queryService;
        this.statService = statService;
        this.chartFactory = chartFactory;
        this.chartLifecycle = chartLifecycle;
        this.eventBus = eventBus;
    }

    render(code, config) { }
}
