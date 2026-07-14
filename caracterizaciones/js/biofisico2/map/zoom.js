import { AppState } from "../app/state.js";

export async function zoomToExtent(extent, options = {}) {
    if (!AppState.view || !extent) return;

    await AppState.view.goTo(
        extent.expand ? extent.expand(options.expand || 1.2) : extent,
        {
            duration: options.duration || 900,
            easing: options.easing || "ease-in-out"
        }
    );
}

export async function zoomToLayerObjectId(objectId, expand = 1.2) {
    const layer = AppState.layerGlobal;
    const view = AppState.view;

    if (!layer || !view || !objectId) return;

    const q = layer.createQuery();
    q.where = `OBJECTID = ${objectId}`;
    q.returnGeometry = false;

    const res = await layer.queryExtent(q);

    if (res?.extent) {
        await zoomToExtent(res.extent, { expand });
    }
}

export function resetToColombia() {
    if (!AppState.view) return;

    AppState.view.goTo(
        {
            center: [-73.5, 4.5],
            zoom: 5
        },
        {
            duration: 700,
            easing: "ease-in-out"
        }
    );
}