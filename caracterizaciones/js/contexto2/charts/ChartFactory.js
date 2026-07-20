/**
 * ChartFactory.js — Fábrica de Instancias Chart.js
 *
 * Crea la instancia de Chart.js en el canvas según el tipo
 * de gráfico solicitado (doughnut, bar, pie, stacked-bar).
 *
 * Responsabilidad:
 *   - create(type, canvas, data, options): retorna new Chart()
 *   - getContext(canvasSelector): obtiene el contexto 2D del canvas
 *
 * Dependencias:
 *   - Chart.js (global)
 */
export class ChartFactory {
    create(type, canvas, data, options, plugins = []) {
        if (!canvas) return null;
        if (!window.Chart) throw new Error('Chart.js no está disponible');

        const mergedOptions = {
            ...options,
            devicePixelRatio: options?.devicePixelRatio ?? Math.min(window.devicePixelRatio || 1, 2)
        };

        return new window.Chart(canvas.getContext('2d'), {
            type,
            data,
            options: mergedOptions,
            plugins
        });
    }

    getContext(selector) {
        return document.querySelector(selector);
    }
}
