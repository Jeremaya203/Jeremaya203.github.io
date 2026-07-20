export class ChartManager {
    constructor({ lifecycle, eventBus }) {
        this.lifecycle = lifecycle;
        this.eventBus = eventBus;
    }

    register(key, chart) {
        return this.lifecycle.set(key, chart);
    }

    clear() {
        this.lifecycle.destroyAll();
        this.eventBus?.emit("selection:cleared", { source: "chart" });
    }

    emitSelection(selection) {
        this.eventBus?.emit("selection:changed", {
            source: "chart",
            ...selection
        });
    }
}
