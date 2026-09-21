export class LayerFilter {
    constructor({ getLayers, state }) {
        this.getLayers = getLayers;
        this.state = state;
    }

    apply(where = "1=1") {
        const layers = this.getLayers().filter(Boolean);
        layers.forEach(layer => {
            layer.definitionExpression = where;
        });

        this.state?.set("activeFilter", where);
    }

    clear(baseWhere = "1=1") {
        this.apply(baseWhere);
    }
}
