export class SubLayerNavigator {
    constructor(state, eventBus, layerConfig) {
        this.state = state;
        this.eventBus = eventBus;
        this.layerConfig = layerConfig;
    }

    prev() {
        const list = this.layerConfig.getList(
            this.state.get('currentMode'),
            this.state.get('filtroNivel'),
            this.state.get('condicionantesGroup')
        );
        if (!list || !list.length) return;
        const idx = (this.state.get('currentSubLayerIndex') - 1 + list.length) % list.length;
        this.state.set('currentSubLayerIndex', idx);
        this.eventBus.emit('sublayer:changed', { index: idx });
    }

    next() {
        const list = this.layerConfig.getList(
            this.state.get('currentMode'),
            this.state.get('filtroNivel'),
            this.state.get('condicionantesGroup')
        );
        if (!list || !list.length) return;
        const idx = (this.state.get('currentSubLayerIndex') + 1) % list.length;
        this.state.set('currentSubLayerIndex', idx);
        this.eventBus.emit('sublayer:changed', { index: idx });
    }
}
