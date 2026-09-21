export class ChartLifecycle {
    constructor() {
        this.instances = new Map();
    }

    set(key, chart) {
        this.destroy(key);
        this.instances.set(key, chart);
        return chart;
    }

    get(key) {
        return this.instances.get(key) || null;
    }

    destroy(key) {
        const chart = this.instances.get(key);
        chart?.destroy?.();
        this.instances.delete(key);
    }

    destroyAll() {
        this.instances.forEach(chart => chart?.destroy?.());
        this.instances.clear();
    }
}
