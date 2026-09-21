export class LayerManager {
    constructor({ map, view }) {
        this.map = map;
        this.view = view;
        this.layers = [];
    }

    add(layer) {
        if (!layer || !this.map) return;
        this.map.add(layer);
        this.layers.push(layer);
    }

    clear() {
        this.layers.forEach(layer => {
            try {
                this.map?.remove(layer);
                layer.destroy?.();
            } catch (error) {
                console.warn("No se pudo limpiar la capa", error);
            }
        });

        this.layers = [];
        this.view?.graphics?.removeAll();
    }
}
