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

function handleEmptyResult(ctx) {
    if (ctx.filtroNivel === "DEPTO" && ctx.deptoActual) {
        const deptoCode = Number(ctx.deptoActual);
        if (Number.isFinite(deptoCode)) {
            const altWhere = `dpcodigo = ${deptoCode}`;
            if (ctx.whereBase !== altWhere) {
                ctx.whereBase = altWhere;
                ctx.setWhereBase?.(altWhere);
                ctx.applyWhereToActiveLayers?.(altWhere);
                ctx.cargarCapaActual?.();
                return true;
            }
        }
    }

    ctx.destroyChart();
    ctx.actualizarLeyenda([], []);
    return true;
}

export function escorrentiaMunicipalHandler(deps = {}) {
    const coloresEscorrentia = deps.coloresEscorrentia || globalThis.coloresEscorrentia || {};

    return {
        when: (ctx) =>
            ctx.config?.isHidro &&
            ctx.config?.hidroType === "escorrentia" &&
            !ctx.config?.isDeptoEscorrentiaAgg,

        run: async (ctx) => {
            const layer = ctx.layer;
            if (!layer || layer.destroyed) return;

            try {
                deps.hideTimeSlider?.();

                const q = layer.createQuery();
                q.where = ctx.whereBase || "1=1";
                q.outFields = ctx.config.outFields;
                q.returnGeometry = false;

                const res = await (ctx.queryFeatures || ctx.cachedQueryFeatures || ((targetLayer, targetQuery) => targetLayer.queryFeatures(targetQuery)))(layer, q);
                if (!res.features?.length) {
                    handleEmptyResult(ctx);
                    return;
                }

                const { mpnombre, dpnombre } = resolveNames(ctx, res.features);
                ctx.actualizarTituloGrafico(ctx.config, mpnombre, dpnombre);

                const dataByCode = {};

                res.features.forEach(feature => {
                    const attrs = feature.attributes || {};
                    const code = String(attrs[ctx.config.labelField]);
                    const value = Number(attrs[ctx.config.valueField]) || 0;
                    dataByCode[code] = (dataByCode[code] || 0) + value;
                });

                const codes = Object.keys(dataByCode).sort((a, b) => Number(a) - Number(b));
                const labels = codes.map(code => coloresEscorrentia?.[code]?.label || code);
                const values = codes.map(code => dataByCode[code] || 0);
                const colors = codes.map(code => coloresEscorrentia?.[code]?.color || "#999");

                ctx.crearGrafica(labels, values, colors, "line", false);
            } catch (e) {
                console.error("ESCORRENTIA_MUNICIPAL error:", e);
                ctx.destroyChart();
                ctx.actualizarLeyenda([], []);
            }
        }
    };
}

export function escorrentiaDeptoPctVerticalHandler(deps = {}) {
    return {
        when: (ctx) =>
            ctx.filtroNivel === "DEPTO" &&
            ctx.config?.isHidro &&
            ctx.config?.hidroType === "escorrentia" &&
            ctx.config?.isDeptoEscorrentiaAgg &&
            ctx.config?.deptoEscorrentiaAgg,

        run: async (ctx) => {
            try {
                deps.hideTimeSlider?.();

                const { groupField, numField, denField, numAreaFactor } = ctx.config.deptoEscorrentiaAgg;

                const lyr = ctx.lyr || ctx.layer;
                await lyr.when();

                const jsNum = await ctx.arcRestQuery(ctx.config.url || lyr.url, {
                    f: "json",
                    where: ctx.whereBase || "1=1",
                    groupByFieldsForStatistics: groupField,
                    outStatistics: JSON.stringify([{
                        statisticType: "sum",
                        onStatisticField: numField,
                        outStatisticFieldName: "sum_num"
                    }]),
                    returnGeometry: "false"
                });

                const rows = (jsNum.features || []).map(f => f.attributes || {});
                if (!rows.length) {
                    ctx.destroyChart();
                    ctx.actualizarLeyenda([], []);
                    return;
                }

                let totalDen = 0;
                try {
                    const jsDen = await ctx.arcRestQuery(ctx.config.url || lyr.url, {
                        f: "json",
                        where: ctx.whereBase || "1=1",
                        outStatistics: JSON.stringify([{
                            statisticType: "sum",
                            onStatisticField: denField,
                            outStatisticFieldName: "sum_den"
                        }]),
                        returnGeometry: "false"
                    });
                    totalDen = Number(jsDen?.features?.[0]?.attributes?.sum_den) || 0;
                } catch (_) {
                    totalDen = 0;
                }

                if (totalDen <= 0) {
                    totalDen = rows.reduce((acc, row) => acc + (Number(row.sum_num) || 0), 0);
                }
                if (totalDen <= 0) {
                    ctx.destroyChart();
                    ctx.actualizarLeyenda([], []);
                    return;
                }

                const dict = typeof deps.buildDictFromUniqueValueRenderer === "function"
                    ? deps.buildDictFromUniqueValueRenderer(lyr)
                    : new Map();

                const factor = Number(numAreaFactor) || 1;

                const items = rows.map(row => {
                    const code = String(row[groupField] ?? "").trim();
                    const num = Number(row.sum_num) || 0;
                    const pct = ((num * factor) / totalDen) * 100;
                    const info = dict.get(code);

                    return {
                        code,
                        label: info?.label || code || "Sin información",
                        color: info?.color || "#999",
                        pct
                    };
                });

                items.sort((a, b) => Number(a.code) - Number(b.code));

                const labels = items.map(item => item.label);
                const values = items.map(item => Number(item.pct.toFixed(2)));
                const colors = items.map(item => item.color);

                const depName = ctx.diccionarioDepartamentos?.[ctx.deptoActual] || ctx.deptoActual;
                ctx.setTitle(`Distribución de escorrentía en el departamento de ${depName}`);
                ctx.crearGrafica(labels, values, colors, "bar", true);
                ctx.actualizarLeyenda(labels, colors);
            } catch (e) {
                console.error("ESCORRENTIA_DEPTO_PCT error:", e);
                ctx.destroyChart();
                ctx.actualizarLeyenda([], []);
            }
        }
    };
}
