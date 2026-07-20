export class QueryCache {
    constructor({ ttlMs = 300000 } = {}) {
        this.ttlMs = ttlMs;
        this.entries = new Map();
    }

    get(key) {
        const entry = this.entries.get(key);
        if (!entry) return null;

        if (Date.now() - entry.createdAt > entry.ttlMs) {
            this.entries.delete(key);
            return null;
        }

        return entry.value;
    }

    set(key, value, ttlMs = this.ttlMs) {
        this.entries.set(key, {
            value,
            ttlMs,
            createdAt: Date.now()
        });
        return value;
    }

    getOrSet(key, loader, ttlMs = this.ttlMs) {
        const cached = this.get(key);
        if (cached) return Promise.resolve(cached);

        return Promise.resolve(loader()).then(value => this.set(key, value, ttlMs));
    }

    clearByPrefix(prefix) {
        Array.from(this.entries.keys()).forEach(key => {
            if (String(key).startsWith(prefix)) this.entries.delete(key);
        });
    }

    clear() {
        this.entries.clear();
    }

    static stableKey(parts) {
        return parts
            .filter(part => part !== undefined && part !== null)
            .map(part => String(part))
            .join("|");
    }
}
