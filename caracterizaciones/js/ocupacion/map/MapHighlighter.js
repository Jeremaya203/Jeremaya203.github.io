export class MapHighlighter {
    constructor({ view, getLayer }) {
        this.view = view;
        this.getLayer = getLayer;
        this.highlightHandle = null;
        this.lastWhere = "";
    }

    clear() {
        this.highlightHandle?.remove();
        this.highlightHandle = null;
        this.lastWhere = "";
    }

    async highlightWhere(where) {
        const layer = this.getLayer();
        if (!this.view || !layer || !where || where === this.lastWhere) return;

        this.lastWhere = where;
        this.clear();

        const layerView = await this.view.whenLayerView(layer);
        const objectIds = await layer.queryObjectIds({ where });
        if (objectIds?.length) {
            this.highlightHandle = layerView.highlight(objectIds);
        }
    }
}
