/**
 * ChartLifecycle.js — Ciclo de Vida de Gráficos Chart.js
 *
 * Gestiona la creación, destrucción y limpieza de instancias Chart.js
 * para evitar memory leaks y gráficos huérfanos.
 *
 * Responsabilidad:
 *   - destroy(instance): destruye una instancia de Chart
 *   - destroyAll(): destruye todos los gráficos activos
 *   - register(instance): registra una instancia para tracking
 *   - clearCanvas(canvas): limpia el contexto del canvas
 *
 * Dependencias:
 *   - Chart.js (global)
 */
export class ChartLifecycle {
    constructor() {
        this._instances = [];
    }

    register(instance) {
        this._instances.push(instance);
    }

    destroy(instance) {
        if (instance) {
            instance.destroy();
            this._instances = this._instances.filter(i => i !== instance);
        }
    }

    destroyCanvasChart(canvas) {
        const chart = canvas && window.Chart?.getChart
            ? window.Chart.getChart(canvas)
            : null;
        if (chart) this.destroy(chart);
    }

    destroyAll() {
        this._instances.forEach(i => i.destroy());
        this._instances = [];
    }

    clearCanvas(canvas) {
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }
}
