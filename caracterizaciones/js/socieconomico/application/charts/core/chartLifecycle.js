export function destroyCanvasChart(canvas) {
    if (!canvas || typeof Chart === "undefined" || typeof Chart.getChart !== "function") return;
    const existing = Chart.getChart(canvas);
    if (existing) existing.destroy();
}

export function destroyCanvasChartById(canvasId) {
    if (!canvasId) return;
    destroyCanvasChart(document.getElementById(canvasId));
}

export function destroyChartsByCanvas(...canvases) {
    canvases.forEach(canvas => destroyCanvasChart(canvas));
}

export function createChart(canvas, config) {
    destroyCanvasChart(canvas);
    return new Chart(canvas, config);
}

export function createBoundedCache(maxSize = 50) {
    const cache = new Map();
    return {
        get(key) { return cache.get(key); },
        set(key, value) {
            if (cache.size >= maxSize) {
                const firstKey = cache.keys().next().value;
                if (firstKey !== undefined) cache.delete(firstKey);
            }
            cache.set(key, value);
        },
        has(key) { return cache.has(key); },
        delete(key) { cache.delete(key); },
        clear() { cache.clear(); },
        get size() { return cache.size; },
        keys() { return cache.keys(); },
        values() { return cache.values(); },
        entries() { return cache.entries(); },
        forEach(fn) { cache.forEach(fn); }
    };
}
