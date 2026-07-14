export const massRemovalHazardChart = {
    id: "remocion_masa",
    mode: "FENOMENOS",
    title: "Amenaza por remoción en masa"
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

function normalizePiePercentValues(values) {
    const total = (values || []).reduce((acc, value) => acc + (Number(value) || 0), 0);
    if (total <= 0) return values || [];
    return values.map(value => ((Number(value) || 0) / total) * 100);
}

export function remocionMunicipalHandler(deps = {}) {
    const coloresRemocion = deps.coloresRemocion || globalThis.coloresRemocion || {};

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
                ctx.actualizarTituloGrafico(ctx.config, mpnombre, dpnombre);

                const data = {};
                const labelInfo = {};

                features.forEach(feature => {
                    const attrs = feature.attributes || {};
                    const key = attrs[ctx.config.labelField];
                    const info = coloresRemocion?.[key];
                    const label = info ? info.label : key;
                    const value = Number(attrs[ctx.config.valueField]) || 0;

                    if (info) labelInfo[label] = info.color;
                    data[label] = (data[label] || 0) + value;
                });

                const labels = Object.keys(data);
                const rawValues = Object.values(data);
                const values = (ctx.filtroNivel === "DEPTO" && !ctx.municipioActual)
                    ? normalizePiePercentValues(rawValues)
                    : rawValues;
                const colors = labels.map(label => labelInfo[label] || "#999");

                ctx.crearGrafica(labels, values.map(value => Number((Number(value) || 0).toFixed(2))), colors, "pie", false);
                ctx.actualizarLeyenda(labels, colors);
            } catch (e) {
                console.error("REMOCION_MUNICIPAL error:", e);
                clearChart(ctx);
            }
        }
    };
}
