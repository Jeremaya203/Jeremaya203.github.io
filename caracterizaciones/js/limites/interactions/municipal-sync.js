import { getChartInstance } from "../chart/chart.core.js";

let state = {
    view: null,
    layer: null,
    baseWhere: "1=1",
    ids: [],
    visibleIds: new Set(),
    selectedId: "",
    highlightHandle: null,
    clickHandle: null
};

function escSql(value) {
    return String(value ?? "").replace(/'/g, "''");
}

function buildVisibilityWhere() {
    if (!state.visibleIds.size) return "1=0";
    const values = Array.from(state.visibleIds)
        .map(id => `'${escSql(id)}'`)
        .join(",");
    return `LLIdentif IN (${values})`;
}

function combinedWhere() {
    const base = state.baseWhere || "1=1";
    if (state.selectedId && state.visibleIds.has(state.selectedId)) {
        return `(${base}) AND (LLIdentif = '${escSql(state.selectedId)}')`;
    }
    return `(${base}) AND (${buildVisibilityWhere()})`;
}

function getChartMeta() {
    const chart = getChartInstance();
    return { chart, meta: chart?.$limitesMunicipales };
}

function colorWithOpacity(color, opacity) {
    const alpha = Math.max(0, Math.min(1, Number(opacity)));
    const text = String(color || "").trim();
    const hex = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (hex) {
        const raw = hex[1].length === 3
            ? hex[1].split("").map(char => char + char).join("")
            : hex[1];
        const value = parseInt(raw, 16);
        return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
    }

    const rgb = text.match(/^rgba?\(([^)]+)\)$/i);
    if (rgb) {
        const parts = rgb[1].split(",").map(part => Number(String(part).trim()));
        if (parts.length >= 3 && parts.slice(0, 3).every(Number.isFinite)) {
            return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
        }
    }

    return text;
}

function syncLegend() {
    document.querySelectorAll("#legendContent .limites-legend-item").forEach(item => {
        const id = item.dataset.llid || "";
        const manuallyVisible = state.visibleIds.has(id);
        const selected = state.selectedId === id;
        const visuallyActive = manuallyVisible && (!state.selectedId || selected);
        item.classList.toggle("active", visuallyActive);
        item.classList.toggle("inactive", !visuallyActive);
        item.classList.toggle("selected", selected);
        item.dataset.legendVisible = String(manuallyVisible);
        item.setAttribute("aria-pressed", String(visuallyActive));
    });
}

function syncChart() {
    const { chart, meta } = getChartMeta();
    if (!chart || !meta?.ids?.length) return;

    const rows = meta.ids
        .map((id, index) => ({
            id,
            label: meta.labels?.[index] ?? meta.originalLabels?.[index] ?? "",
            value: meta.values?.[index] ?? chart.data.datasets?.[0]?.data?.[index] ?? 0,
            color: meta.colors?.[index] || "rgba(190, 190, 190, 0.35)"
        }))
        .filter(row => state.visibleIds.has(row.id));

    const dataset = chart.data.datasets[0];
    chart.data.labels = rows.map(row => row.label);
    dataset.data = rows.map(row => row.value);
    dataset.backgroundColor = rows.map(row => {
        const color = row.color;
        if (!state.selectedId) return color;
        return state.selectedId === row.id ? color : colorWithOpacity(color, 0.32);
    });
    dataset.borderColor = rows.map(row => state.selectedId === row.id ? "#111111" : colorWithOpacity(row.color, 0.45));
    dataset.borderWidth = rows.map(row => state.selectedId === row.id ? 2 : 1);
    meta.currentIds = rows.map(row => row.id);
    chart.update("none");
}

async function syncLayerVisibility() {
    if (!state.layer) return;
    const where = combinedWhere();
    state.layer.definitionExpression = where;
    try { state.layer.refresh?.(); } catch (error) {}
    if (!state.view) return;
    try {
        const layerView = await state.view.whenLayerView(state.layer);
        layerView.filter = { where };
    } catch (error) {}
}

async function zoomToSelected() {
    if (!state.selectedId || !state.layer || !state.view || !state.visibleIds.has(state.selectedId)) return;
    const where = `LLIdentif = '${escSql(state.selectedId)}'`;
    try {
        const result = await state.layer.queryExtent({ where });
        if (result?.extent) {
            state.view.goTo(result.extent.expand(3), {
                duration: 400,
                easing: "ease-in-out"
            }).catch(() => {});
        }
    } catch (error) {}
}

async function highlightSelected(openPopup = false) {
    if (state.highlightHandle) {
        try { state.highlightHandle.remove(); } catch (error) {}
        state.highlightHandle = null;
    }

    if (!state.selectedId || !state.layer || !state.view || !state.visibleIds.has(state.selectedId)) {
        return;
    }

    const where = `LLIdentif = '${escSql(state.selectedId)}'`;
    try {
        const layerView = await state.view.whenLayerView(state.layer);
        const result = await layerView.queryFeatures({
            where,
            returnGeometry: true,
            outFields: ["*"]
        });

        if (!result.features?.length) return;
        state.highlightHandle = layerView.highlight(result.features);

        if (openPopup && state.view.popup) {
            state.view.popup.open({
                features: result.features,
                location: result.features[0].geometry?.extent?.center
            });
        }
    } catch (error) {
        console.warn("No se pudo resaltar la línea limítrofe:", error);
    }
}

function syncAll({ highlight = true } = {}) {
    syncLegend();
    syncChart();
    syncLayerVisibility();
    if (highlight) {
        highlightSelected(false);
    } else if (state.highlightHandle) {
        try { state.highlightHandle.remove(); } catch (error) {}
        state.highlightHandle = null;
    }
}

function selectLine(llid, { openPopup = false, highlight = true, zoom = false } = {}) {
    if (!llid || !state.ids.includes(llid) || !state.visibleIds.has(llid)) return;
    state.selectedId = llid;
    syncAll({ highlight });
    if (zoom) zoomToSelected();
    if (openPopup && highlight) highlightSelected(true);
    if (!openPopup && state.view?.popup) state.view.popup.close();
}

function toggleLine(llid) {
    if (!llid || !state.ids.includes(llid)) return;
    const wasSelected = state.selectedId === llid;
    const wasVisible = state.visibleIds.has(llid);
    const hadSelection = Boolean(state.selectedId);
    state.selectedId = "";

    if (hadSelection && wasVisible && !wasSelected) {
        syncAll();
        return;
    }

    if (wasVisible) {
        state.visibleIds.delete(llid);
    } else {
        state.visibleIds.add(llid);
    }

    syncAll();
}

function bindLegend() {
    const content = document.getElementById("legendContent");
    if (!content) return;
    if (content.__limitesMunicipalSyncHandler) {
        content.removeEventListener("click", content.__limitesMunicipalSyncHandler);
    }
    content.dataset.limitesMunicipalSync = "true";

    content.__limitesMunicipalSyncHandler = event => {
        const item = event.target.closest(".limites-legend-item");
        if (!item) return;
        event.preventDefault();
        event.stopPropagation();
        toggleLine(item.dataset.llid || "");
    };
    content.addEventListener("click", content.__limitesMunicipalSyncHandler);
}

function bindChartSelection() {
    if (document.body.dataset.limitesMunicipalChartSync === "true") return;
    document.body.dataset.limitesMunicipalChartSync = "true";

    const onSelect = event => {
        selectLine(event.detail?.llid || "", {
            openPopup: false,
            highlight: false,
            zoom: true
        });
    };
    document.addEventListener("limites:municipal-select", onSelect);
    document.addEventListener("limites:chart-select", onSelect);
    document.addEventListener("limites:chart-restore", () => {
        state.selectedId = "";
        syncAll();
    });
}

function bindMapClick() {
    if (!state.view || !state.layer) return;
    if (state.clickHandle) {
        try { state.clickHandle.remove(); } catch (error) {}
        state.clickHandle = null;
    }

    state.clickHandle = state.view.on("click", async event => {
        try {
            const hit = await state.view.hitTest(event);
            const result = hit.results?.find(item => item.graphic?.layer === state.layer);
            const llid = result?.graphic?.attributes?.LLIdentif;
            if (!llid) return;
            selectLine(String(llid), { openPopup: true });
        } catch (error) {
            console.warn("No se pudo sincronizar clic del mapa:", error);
        }
    });
}

export function setupMunicipalSync({ view, layer, features, baseWhere }) {
    const ids = (features || [])
        .map(feature => String(feature.attributes?.LLIdentif || ""))
        .filter(Boolean);

    if (state.highlightHandle) {
        try { state.highlightHandle.remove(); } catch (error) {}
    }

    state = {
        ...state,
        view,
        layer,
        baseWhere: baseWhere || "1=1",
        ids,
        visibleIds: new Set(ids),
        selectedId: "",
        highlightHandle: null
    };

    bindLegend();
    bindChartSelection();
    bindMapClick();
    syncAll();
}

export function clearMunicipalSync() {
    if (state.highlightHandle) {
        try { state.highlightHandle.remove(); } catch (error) {}
    }
    if (state.clickHandle) {
        try { state.clickHandle.remove(); } catch (error) {}
    }
    const content = document.getElementById("legendContent");
    if (content?.__limitesMunicipalSyncHandler) {
        content.removeEventListener("click", content.__limitesMunicipalSyncHandler);
        delete content.__limitesMunicipalSyncHandler;
        delete content.dataset.limitesMunicipalSync;
    }
    if (state.layer && state.view) {
        state.view.whenLayerView(state.layer)
            .then(layerView => { layerView.filter = null; })
            .catch(() => {});
    }

    state = {
        view: null,
        layer: null,
        baseWhere: "1=1",
        ids: [],
        visibleIds: new Set(),
        selectedId: "",
        highlightHandle: null,
        clickHandle: null
    };
}
