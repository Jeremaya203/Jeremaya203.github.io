const MAX_METRICS = 300;

function now() {
    return globalThis.performance?.now ? globalThis.performance.now() : Date.now();
}

function getMetricsStore() {
    const root = globalThis.window || globalThis;
    if (!root.__biofisicoPerformanceMetrics) {
        root.__biofisicoPerformanceMetrics = [];
    }
    return root.__biofisicoPerformanceMetrics;
}

function shouldLog() {
    const root = globalThis.window || globalThis;
    return root.__BIOFISICO_PERF__ === true;
}

export function recordBiofisicoMetric(name, durationMs, meta = {}) {
    const metric = {
        name,
        durationMs: Number(durationMs.toFixed(2)),
        meta,
        timestamp: Date.now()
    };

    const store = getMetricsStore();
    store.push(metric);

    while (store.length > MAX_METRICS) {
        store.shift();
    }

    if (shouldLog()) {
        console.debug(`[Biofisico perf] ${name}: ${metric.durationMs} ms`, meta);
    }

    return metric;
}

export async function measureBiofisicoAsync(name, fn, meta = {}) {
    const start = now();

    try {
        return await fn();
    } finally {
        recordBiofisicoMetric(name, now() - start, meta);
    }
}

export function getBiofisicoPerformanceMetrics() {
    return [...getMetricsStore()];
}

export function clearBiofisicoPerformanceMetrics() {
    getMetricsStore().length = 0;
}
