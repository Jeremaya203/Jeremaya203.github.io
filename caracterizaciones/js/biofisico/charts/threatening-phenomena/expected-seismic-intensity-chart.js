import { SEISMIC_ORDER } from "../chart-utils.js";

export const expectedSeismicIntensityChart = {
    id: "intensidad_sismica",
    mode: "FENOMENOS",
    title: "Intensidad sísmica esperada"
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

export function seismicMunicipalHandler(deps = {}) {
    const seismicColors = deps.seismicColors || globalThis.seismicColors || {};

    return {
        when: (ctx) =>
            ctx.config?.isFenomenos &&
            ctx.config?.fenomenosType === "sismica" &&
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

                features.forEach(feature => {
                    const attrs = feature.attributes || {};
                    const key = attrs[ctx.config.labelField];
                    const info = seismicColors?.[key];
                    const label = info ? info.label : key;
                    const value = Number(attrs[ctx.config.valueField]) || 0;

                    if (info) labelInfo[label] = info.color;
                    data[label] = (data[label] || 0) + value;
                });

                const rows = Object.keys(data).map(label => ({
                    label,
                    value: Number(data[label]) || 0,
                    color: labelInfo[label] || "#999"
                }));

                rows.sort((a, b) =>
                    (SEISMIC_ORDER[a.label] ?? 999) -
                    (SEISMIC_ORDER[b.label] ?? 999)
                );

                const labels = rows.map(row => row.label);
                const values = rows.map(row => row.value);
                const colors = rows.map(row => row.color);

                ctx.createChart(labels, values, colors, "bar", true);
                ctx.updateLegend(labels, colors);
            } catch (e) {
                console.error("SISMICA_MUNICIPAL error:", e);
                clearChart(ctx);
            }
        }
    };
}
