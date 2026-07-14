export function createLegendFilterController({
    getActiveLayer,
    getActiveLayers,
    view
}) {
    function syncChartToLegendState(state) {
        const activeChart = window.__activeSocioChartConfig;
        if (activeChart?.type === "livestockCensusBar" || activeChart?.id === "censo-pecuario-barras") {
            return;
        }

        const activeCodes = state?.activeCodes instanceof Set
            ? [...state.activeCodes].map(value => String(value ?? "").trim()).filter(Boolean)
            : null;
        window.__syncChartLegendFilter?.(activeCodes);
    }

    function bindLegendClickOnce() {
        const content = document.getElementById("legendContent");
        if (!content || content.__legendBound) return;

        content.__legendBound = true;

        const toggleItem = async (item) => {
            if (!item) return;

            const code = String(item.dataset.code ?? "").trim();
            if (!code) return;

            const state = window.__legendState;
            if (!state) return;

            if (!(state.activeCodes instanceof Set)) {
                state.activeCodes = new Set((state.allCodes || []).map(value => String(value)));
            }

            if (state.visibleCodes instanceof Set) {
                state.visibleCodes = null;
            }

            if (state.activeCodes.has(code)) {
                state.activeCodes.delete(code);
                item.classList.add("off");
                item.classList.remove("active");
            } else {
                state.activeCodes.add(code);
                item.classList.remove("off");
                item.classList.add("active");
            }

            await applyLegendFilter();
        };

        content.addEventListener("click", async (e) => {
            const item = e.target.closest(".legend-item");
            await toggleItem(item);
        });

        content.addEventListener("keydown", async (e) => {
            if (e.key !== "Enter" && e.key !== " ") return;
            const item = e.target.closest(".legend-item");
            if (!item) return;
            e.preventDefault();
            await toggleItem(item);
        });
    }

    function getLegendTargetLayers() {
        const stateLayers = window.__legendState?.layers;
        if (Array.isArray(stateLayers) && stateLayers.length) {
            return stateLayers.filter(layer => layer && !layer.destroyed && !layer.__legendExcluded);
        }

        const activeLayers = getActiveLayers?.();
        if (Array.isArray(activeLayers) && activeLayers.length) {
            return activeLayers.filter(layer => layer && !layer.destroyed && !layer.__legendExcluded);
        }

        const active = getActiveLayer();
        return active && !active.destroyed && !active.__legendExcluded ? [active] : [];
    }

    function resetLegendVisualState() {
        const state = window.__legendState;
        const content = document.getElementById("legendContent");
        if (!state || !content) return;

        content.querySelectorAll(".legend-item").forEach(node => {
            const code = String(node.dataset.code ?? "").trim();
            const visibleCodes = state.visibleCodes instanceof Set ? state.visibleCodes : null;
            const visible = !visibleCodes || visibleCodes.has(code);
            const active = state.activeCodes.has(code);
            node.style.display = visible ? "" : "none";
            node.classList.toggle("off", !active);
            node.classList.toggle("active", active);
        });
    }

    function buildLegendWhere(field, activeCodes, fieldType) {
        if (!field) return null;

        const values = [...activeCodes];
        if (!values.length) return "1=0";

        const isNumeric = ["small-integer", "integer", "single", "double", "long"].includes(fieldType);
        const formatted = values.map(value => {
            const stringValue = String(value ?? "").trim();
            if (isNumeric && stringValue !== "" && !isNaN(stringValue)) return Number(stringValue);
            return `'${stringValue.replace(/'/g, "''")}'`;
        });

        return `${field} IN (${formatted.join(",")})`;
    }

    function expandLegendCodes(activeCodes, codeGroups = null) {
        const expanded = new Set();
        const sourceCodes = activeCodes instanceof Set ? activeCodes : new Set(activeCodes || []);

        sourceCodes.forEach(value => {
            const code = String(value ?? "").trim();
            if (!code) return;

            const group = codeGroups?.[code];
            if (Array.isArray(group) && group.length) {
                group.forEach(groupCode => {
                    const normalized = String(groupCode ?? "").trim();
                    if (normalized) expanded.add(normalized);
                });
                return;
            }

            expanded.add(code);
        });

        return expanded;
    }

    async function applyLegendFilter() {
        const state = window.__legendState;
        if (typeof state?.customApply === "function") {
            await state.customApply(state);
            resetLegendVisualState();
            return;
        }

        if (!state?.field) return;

        if (!(state.activeCodes instanceof Set)) {
            state.activeCodes = new Set((state.allCodes || []).map(value => String(value)));
        }

        const targetLayers = getLegendTargetLayers();
        if (!targetLayers.length) return;

        const totalCount = Array.isArray(state.allCodes) ? state.allCodes.length : 0;
        const activeCount = state.activeCodes.size;
        const expandedActiveCodes = expandLegendCodes(state.activeCodes, state.codeGroups);

        for (const currentLayer of targetLayers) {
            if (!currentLayer || currentLayer.destroyed) continue;

            let fieldInfo = null;
            try {
                fieldInfo = (currentLayer.fields || []).find(field =>
                    String(field.name).toLowerCase() === String(state.field).toLowerCase()
                );
            } catch (_) {}

            const fieldName = fieldInfo?.name || state.field;
            const fieldType = String(fieldInfo?.type || "").toLowerCase();

            let whereLegend = null;
            if (activeCount === 0) {
                whereLegend = "1=0";
            } else if (totalCount > 0 && activeCount < totalCount) {
                whereLegend = buildLegendWhere(fieldName, expandedActiveCodes, fieldType);
            }

            const base = state.baseWhere && String(state.baseWhere).trim()
                ? `(${state.baseWhere})`
                : null;
            const finalWhere = whereLegend
                ? (base ? `${base} AND (${whereLegend})` : whereLegend)
                : (base || null);

            try {
                const layerView = await view.whenLayerView(currentLayer);
                layerView.filter = finalWhere ? { where: finalWhere } : null;
            } catch (err) {
                console.warn("No se pudo aplicar filtro de leyenda:", err);
            }
        }

        resetLegendVisualState();
        syncChartToLegendState(state);
    }

    async function setLegendVisibleCodes(codes = null) {
        const state = window.__legendState;
        if (!state) return;

        const normalized = Array.isArray(codes)
            ? codes.map(value => String(value ?? "").trim()).filter(Boolean)
            : null;

        if (normalized?.length) {
            state.visibleCodes = new Set(normalized);
            state.activeCodes = new Set(normalized);
        } else {
            state.visibleCodes = null;
            state.activeCodes = new Set((state.allCodes || []).map(value => String(value)));
        }

        await applyLegendFilter();
        resetLegendVisualState();
    }

    async function clearLegendLayerFilters(layers = null) {
        const targetLayers = Array.isArray(layers) && layers.length
            ? layers.filter(layer => layer && !layer.destroyed && !layer.__legendExcluded)
            : getLegendTargetLayers();

        await Promise.all(targetLayers.map(async layer => {
            try {
                const layerView = await view.whenLayerView(layer);
                layerView.filter = null;
            } catch (_) {
                // Hidden or still-loading layers do not always have a layer view yet.
            }
        }));
    }

    window.__setLegendVisibleCodes = setLegendVisibleCodes;
    window.__clearLegendLayerFilters = clearLegendLayerFilters;

    return {
        bindLegendClickOnce,
        getLegendTargetLayers,
        resetLegendVisualState,
        buildLegendWhere,
        expandLegendCodes,
        applyLegendFilter,
        setLegendVisibleCodes,
        clearLegendLayerFilters
    };
}
