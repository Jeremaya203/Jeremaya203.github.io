export const massRemovalHazardChart = {
    id: "remocion_masa",
    mode: "FENOMENOS",
    title: "Amenaza por remoción en masa"
};

function resolveNames(ctx, features) {
    const firstAttrs = features?.[0]?.attributes || {};
    let mpnombre = firstAttrs.mpnombre;
    let dpnombre = firstAttrs.dpnombre;

    if ((!mpnombre || !isNaN(mpnombre)) && ctx.currentMunicipalityId) {
        mpnombre = ctx.municipalityNames?.[ctx.currentMunicipalityId] || ctx.currentMunicipalityId;
    }

    if ((!dpnombre || !isNaN(dpnombre)) && ctx.currentMunicipalityId) {
        const dpCode = String(ctx.currentMunicipalityId).substring(0, 2);
        dpnombre = ctx.departmentNames?.[dpCode] || dpCode;
    }

    return { mpnombre, dpnombre };
}

function clearChart(ctx) {
    ctx.destroyChart();
    ctx.updateLegend([], []);
}

function normalizePiePercentValues(values) {
    const total = (values || []).reduce((acc, value) => acc + (Number(value) || 0), 0);
    if (total <= 0) return values || [];
    return values.map(value => ((Number(value) || 0) / total) * 100);
}

function normalizeRendererKey(value) {
    const raw = String(value ?? "").trim();
    if (!raw) return "";

    const numeric = Number(raw);
    return Number.isFinite(numeric) ? String(numeric) : raw.toLocaleLowerCase("es");
}

function buildServiceRendererLookup(layer, deps) {
    const lookup = new Map();
    const legend = deps.buildLegendFromRenderer?.(layer);

    (legend?.codes || []).forEach((code, index) => {
        const label = String(legend.labels?.[index] ?? code).trim();
        const color = legend.colors?.[index];
        if (!color) return;

        const info = { label: label || String(code ?? "").trim(), color };
        const codeKey = normalizeRendererKey(code);
        const labelKey = normalizeRendererKey(label);

        if (codeKey) lookup.set(codeKey, info);
        if (labelKey) lookup.set(labelKey, info);
    });

    return lookup;
}

export function massRemovalMunicipalHandler(deps = {}) {
    const massRemovalColors = deps.massRemovalColors || globalThis.massRemovalColors || {};

    return {
        when: (ctx) =>
            ctx.config?.isFenomenos &&
            ctx.config?.fenomenosType === "remocion" &&
            !ctx.config?.isDeptoFenAgg,

        run: async (ctx) => {
            const layer = ctx.layer;
            if (!layer || layer.destroyed) return;

            try {
                deps.hideTimeSlider?.();

                const query = layer.createQuery();
                query.where = ctx.whereBase || "1=1";
                query.outFields = ctx.config.outFields;
                query.returnGeometry = false;

                const result = await (ctx.queryFeatures || ctx.cachedQueryFeatures || ((targetLayer, targetQuery) => targetLayer.queryFeatures(targetQuery)))(layer, query);
                const features = result?.features || [];
                if (!features.length) {
                    clearChart(ctx);
                    return;
                }

                const { mpnombre, dpnombre } = resolveNames(ctx, features);
                ctx.updateChartTitle(ctx.config, mpnombre, dpnombre);

                const data = {};
                const labelInfo = {};
                const rendererLookup = buildServiceRendererLookup(layer, deps);

                features.forEach(feature => {
                    const attrs = feature.attributes || {};
                    const key = attrs[ctx.config.labelField];
                    const fallbackInfo = massRemovalColors?.[key] ||
                        massRemovalColors?.[normalizeRendererKey(key)];
                    const rendererInfo = rendererLookup.get(normalizeRendererKey(key)) ||
                        rendererLookup.get(normalizeRendererKey(fallbackInfo?.label));
                    const label = rendererInfo?.label || fallbackInfo?.label || key;
                    const value = Number(attrs[ctx.config.valueField]) || 0;

                    labelInfo[label] = rendererInfo?.color || fallbackInfo?.color || "#999";
                    data[label] = (data[label] || 0) + value;
                });

                const labels = Object.keys(data);
                const rawValues = Object.values(data);
                const values = (ctx.territoryLevel === "DEPTO" && !ctx.currentMunicipalityId)
                    ? normalizePiePercentValues(rawValues)
                    : rawValues;
                const colors = labels.map(label => labelInfo[label] || "#999");

                ctx.createChart(labels, values.map(value => Number((Number(value) || 0).toFixed(2))), colors, "pie", false);
                ctx.updateLegend(labels, colors);
            } catch (e) {
                console.error("REMOCION_MUNICIPAL error:", e);
                clearChart(ctx);
            }
        }
    };
}
