export class EventBus {
    constructor() {
        this._handlers = new Map();
    }

    on(eventName, handler) {
        if (!this._handlers.has(eventName)) {
            this._handlers.set(eventName, new Set());
        }

        this._handlers.get(eventName).add(handler);
        return () => this.off(eventName, handler);
    }

    off(eventName, handler) {
        this._handlers.get(eventName)?.delete(handler);
    }

    emit(eventName, payload = {}) {
        this._handlers.get(eventName)?.forEach(handler => handler(payload));
    }
}
