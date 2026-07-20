/**
 * LineaInfraestructuraRenderer.js — Renderer de Infraestructura (Línea)
 *
 * Renderiza el gráfico de barras horizontal para determinantes
 * de línea tipo infraestructura, mostrando longitud en km.
 *
 * Responsabilidad:
 *   - render(codigo): query con outStatistics (SUM de longitud)
 *   - Renderizado de barras horizontales con colores del renderer
 *   - Manejar click → filtrar mapa por subdet seleccionado
 *
 * Dependencias:
 *   - ChartFactory.js, ChartLifecycle.js
 *   - ArcGISStatisticService.js
 *   - EventBus.js
 */
export class LineaInfraestructuraRenderer {
    constructor(statService, chartFactory, chartLifecycle, eventBus) {
        this.statService = statService;
        this.chartFactory = chartFactory;
        this.chartLifecycle = chartLifecycle;
        this.eventBus = eventBus;
    }

    render(codigo) { }
}
