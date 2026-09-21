export function clearBiofisicoHighlight({
    getHighlightHandle,
    setHighlightHandle,
    setLastHoverWhere
}) {
    const handle = getHighlightHandle();
    if (handle) {
        handle.remove();
        setHighlightHandle(null);
    }
    setLastHoverWhere("");
}

export async function highlightBiofisicoWhere({
    where,
    layer,
    view,
    getLastHoverWhere,
    setLastHoverWhere,
    clearHighlight,
    setHighlightHandle
}) {
    if (!layer || !where) return;

    if (where === getLastHoverWhere()) return;
    setLastHoverWhere(where);

    clearHighlight();

    try {
        const layerView = await ensureLayerView(layer, view);
        if (!layerView) return;

        const objectIds = await layer.queryObjectIds({ where });
        if (!objectIds || !objectIds.length) return;

        setHighlightHandle(layerView.highlight(objectIds));
    } catch (error) {
        console.error("highlightWhere error:", error);
    }
}

export function createDebouncedBiofisicoHighlight({
    delay,
    highlightWhere
}) {
    let timeout = null;

    return (where) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => highlightWhere(where), delay);
    };
}

async function ensureLayerView(layer, view) {
    if (!layer || !view) return null;
    return await view.whenLayerView(layer);
}
