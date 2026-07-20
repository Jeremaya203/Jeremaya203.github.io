export class OverviewDragHandler {
    constructor(state, eventBus, overviewMap) {
        this.state = state;
        this.eventBus = eventBus;
        this.overviewMap = overviewMap;
        this.eventBus.on('map:ready', () => this._onMapReady());
    }

    _onMapReady() {
        const ovView = this.overviewMap.overviewView;
        if (!ovView) return;

        let isDragging = false;

        ovView.on('drag', (event) => {
            event.stopPropagation();

            const view = this.state.view;
            if (!view) return;

            const mapPoint = ovView.toMap(event);
            if (!mapPoint) return;

            if (event.action === 'start') {
                isDragging = true;
            }

            if (isDragging) {
                view.center = mapPoint;
            }

            if (event.action === 'end') {
                isDragging = false;
            }
        });
    }
}
