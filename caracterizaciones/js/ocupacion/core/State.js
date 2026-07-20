export class State {
    constructor(initialState = {}) {
        this._data = {
            currentMode: "CONTEXTO_HISTORICO",
            currentSubLayerIndex: 0,
            municipioActual: "",
            deptoActual: "",
            filtroNivel: "",
            whereBase: "",
            activeSelection: null,
            activeFilter: "",
            ...initialState
        };
        this._listeners = new Map();
    }

    get(key) {
        return this._data[key];
    }

    set(key, value) {
        this._data[key] = value;
        this._notify(key, value);
    }

    merge(values = {}) {
        Object.entries(values).forEach(([key, value]) => this.set(key, value));
    }

    resetSelection() {
        this.set("activeSelection", null);
        this.set("activeFilter", "");
    }

    onChange(key, listener) {
        if (!this._listeners.has(key)) {
            this._listeners.set(key, new Set());
        }

        this._listeners.get(key).add(listener);
        return () => this._listeners.get(key)?.delete(listener);
    }

    _notify(key, value) {
        this._listeners.get(key)?.forEach(listener => listener(value));
    }
}
