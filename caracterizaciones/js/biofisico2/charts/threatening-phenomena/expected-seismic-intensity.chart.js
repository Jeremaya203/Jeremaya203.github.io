import { ORDEN_SISMICA } from "../chartUtils.js";

export const expectedSeismicIntensityChart = {
    id: "intensidad_sismica",
    mode: "FENOMENOS",
    title: "Intensidad sísmica esperada"
};

function resolveNames(ctx, features) {
    const firstAttrs = features?.[0]?.attributes || {};
    let mpnombre = firstAttrs.mpnombre;
    let dpnombre = firstAttrs.dpnombre;

    if ((!mpnombre || !isNaN(mpnombre)) && ctx.municipioActual) {
        mpnombre = ctx.diccionarioMunicipios?.[ctx.municipioActual] || ctx.municipioActual;
    }

    if ((!dpnombre || !isNaN(dpnombre)) && ctx.municipioActual) {
        const dpCode = String(ctx.municipioActual).substring(0, 2);
        dpnombre = ctx.diccionarioDepartamentos?.[dpCode] || dpCode;
    }

    return { mpnombre, dpnombre };
}

function clearChart(ctx) {
    ctx.destroyChart();
    ctx.actualizarLeyenda([], []);
}

export function sismicaMunicipalHandler(deps = {}) {
    const coloresSismica = deps.coloresSismica || globalThis.coloresSismica || {};

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
                ctx.actualizarTituloGrafico(ctx.config, mpnombre, dpnombre);

                const data = {};
                const labelInfo = {};

                features.forEach(feature => {
                    const attrs = feature.attributes || {};
                    const key = attrs[ctx.config.labelField];
                    const info = coloresSismica?.[key];
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
                    (ORDEN_SISMICA[a.label] ?? 999) -
                    (ORDEN_SISMICA[b.label] ?? 999)
                );

                const labels = rows.map(row => row.label);
                const values = rows.map(row => row.value);
                const colors = rows.map(row => row.color);

                ctx.crearGrafica(labels, values, colors, "bar", true);
                ctx.actualizarLeyenda(labels, colors);
            } catch (e) {
                console.error("SISMICA_MUNICIPAL error:", e);
                clearChart(ctx);
            }
        }
    };
}
