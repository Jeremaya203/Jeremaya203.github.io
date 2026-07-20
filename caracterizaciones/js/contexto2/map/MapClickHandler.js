export class MapClickHandler {
    constructor(state, eventBus) {
        this.state = state;
        this.eventBus = eventBus;
        this.handle = null;
    }

    init() {
        if (!this.state.view || this.handle) return;
        this.handle = this.state.view.on('click', async (event) => {
            const layers = this.state.layersGlobal?.length
                ? this.state.layersGlobal
                : [this.state.layerGlobal].filter(Boolean);
            const config = this.state.get('activeLayerConfig');
            const field = config?.filter?.categoryField || config?.legend?.field;
            if (!layers.length || !field) return;

            try {
                const hit = await this.state.view.hitTest(event, { include: layers });
                const graphic = hit?.results?.find(result => layers.includes(result.graphic?.layer))?.graphic;
                const value = this._resolveClassifiedValue(graphic?.attributes || {}, config?.filter?.categoryClassifier, field);
                if (value == null || value === '') return;

                const legendItems = this.state.get('legendItems') || [];
                const geometryLabel = graphic?.layer?.contextoGeometryLabel || null;
                const geometryType = graphic?.layer?.contextoGeometryType || graphic?.layer?.geometryType || null;
                const legendItem = legendItems.find(item =>
                    String(item.value ?? item.code) === String(value)
                    && (!geometryLabel || item.geometryLabel === geometryLabel)
                ) || legendItems.find(item => String(item.value ?? item.code) === String(value));
                const labelField = config?.map?.labelField || 'nomdet';
                const label = legendItem?.label ||
                    graphic?.attributes?.[labelField] ||
                    String(value);

                this.eventBus.emit('selection:changed', {
                    source: 'map',
                    layerId: config.id,
                    field,
                    value,
                    values: [value],
                    geometryLabel,
                    geometryType,
                    label
                });
            } catch (error) {
                this.eventBus.emit('data:error', { source: 'MapClickHandler', error, context: { layerId: config?.id } });
            }
        });
    }

    destroy() {
        this.handle?.remove?.();
        this.handle = null;
    }

    _resolveClassifiedValue(attrs, classifier, fallbackField) {
        if (classifier === 'puertosAeropuertos') {
            const name = String(attrs.nomdet ?? attrs.NomDet ?? '').toUpperCase();
            return name.includes('AEROPUERTO') ? 'Aeropuertos' : 'Puertos';
        }
        return attrs?.[fallbackField];
    }
}
