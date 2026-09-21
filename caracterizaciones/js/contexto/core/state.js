export class State {
    constructor() {
        this._data = {
            currentMode: 'DETERMINANTES',
            currentMainModule: 'CONTEXTO_LEGAL',
            currentSubLayerIndex: 0,
            condicionantesGroup: null,
            currentMunicipalityId: '',
            currentDepartmentId: '',
            territoryLevel: '',
            whereBase: '',
            activeSelection: null,
            activeFilter: '',
            legendItems: [],
            municipalities: [],
        };
        this._listeners = {};
        this.layerGlobal = null;
        this.view = null;
        this.map = null;
    }

    get(key) {
        return this._data[key];
    }

    set(key, value) {
        this._data[key] = value;
        this._notify(key, value);
    }

    onChange(key, fn) {
        if (!this._listeners[key]) this._listeners[key] = [];
        this._listeners[key].push(fn);
    }

    _notify(key, value) {
        (this._listeners[key] || []).forEach(fn => fn(value));
    }
}
