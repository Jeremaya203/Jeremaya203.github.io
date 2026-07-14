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
    return `(${base}) AND (${buildVisibilityWhere()})`;
}

function getChartMeta() {
    const chart = getChartInstance();
    return { chart, meta: chart?.$limitesMunicipales };
}

function syncLegend() {
    document.querySelectorAll("#legendContent .limites-legend-item").forEach(item => {
        const id = item.dataset.llid || "";
        const visible = state.visibleIds.has(id);
        const selected = state.selectedId === id;
        item.classList.toggle("active", visible);
        item.classList.toggle("inactive", !visible);
        item.classList.toggle("selected", selected);
        item.setAttribute("aria-pressed", String(visible));
    });
}

function syncChart() {
    const { chart, meta } = getChartMeta();
    if (!chart || !meta?.ids?.length) return;

    meta.ids.forEach((id, index) => {
        chart.setDataVisibility(index, state.visibleIds.has(id));
    });

    const dataset = chart.data.datasets[0];
    dataset.backgroundColor = meta.ids.map((id, index) => {
        const color = meta.colors[index];
        if (!state.visibleIds.has(id)) return "rgba(190, 190, 190, 0.25)";
        if (!state.selectedId) return color;
        return state.selectedId === id ? color : "rgba(190, 190, 190, 0.35)";
    });
    dataset.borderColor = meta.ids.map(id => state.selectedId === id ? "#111111" : "rgba(0,0,0,0.12)");
    dataset.borderWidth = meta.ids.map(id => state.selectedId === id ? 2 : 1);
    chart.update();
}

async function syncLayerVisibility() {
    if (!state.layer) return;
    state.layer.definitionExpression = combinedWhere();
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

function syncAll() {
    syncLegend();
    syncChart();
    syncLayerVisibility();
    highlightSelected(false);
}

function selectLine(llid, { openPopup = false } = {}) {
    if (!llid || !state.ids.includes(llid) || !state.visibleIds.has(llid)) return;
    state.selectedId = llid;
    syncLegend();
    syncChart();
    highlightSelected(openPopup);
}

function toggleLine(llid) {
    if (!llid || !state.ids.includes(llid)) return;

    if (state.visibleIds.has(llid)) {
        state.visibleIds.delete(llid);
        if (state.selectedId === llid) state.selectedId = "";
    } else {
        state.visibleIds.add(llid);
    }

    syncAll();
}

function bindLegend() {
    const content = document.getElementById("legendContent");
    if (!content || content.dataset.limitesMunicipalSync === "true") return;
    content.dataset.limitesMunicipalSync = "true";

    content.addEventListener("click", event => {
        const item = event.target.closest(".limites-legend-item");
        if (!item) return;
        toggleLine(item.dataset.llid || "");
    });
}

function bindChartSelection() {
    if (document.body.dataset.limitesMunicipalChartSync === "true") return;
    document.body.dataset.limitesMunicipalChartSync = "true";

    document.addEventListener("limites:municipal-select", event => {
        selectLine(event.detail?.llid || "", { openPopup: true });
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
