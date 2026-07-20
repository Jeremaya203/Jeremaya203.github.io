export class MapViewBadge {
    constructor(state, eventBus, modeConfig) {
        this.state = state;
        this.eventBus = eventBus;
        this.modeConfig = modeConfig;
        this.eventBus.on('mode:changed', (data) => this._onModeChanged(data));
    }

    _onModeChanged(data) {
        const label = this.modeConfig.getContextLabel(data.mode, data);
        this.update(label);
    }

    update(text) {
        const el = document.getElementById('mapViewBadgeText');
        if (el) el.textContent = text || 'Vista';
    }
}
