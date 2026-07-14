import { LEYENDA_RIESGO_CC } from "../../config.js";

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

export function riesgoCCMunicipalRadarHandler() {
    return {
        when: (ctx) =>
            ctx.config?.isClima &&
            ctx.config?.isRadar &&
            ctx.config?.climaType === "riesgo_cc" &&
            !ctx.config?.isDeptoRiskCount,

        run: async (ctx) => {
            const layer = ctx.layer;
            if (!layer || layer.destroyed) return;

            try {
                const q = layer.createQuery();
                q.where = ctx.whereBase || "1=1";
                q.outFields = ctx.config.outFields;
                q.returnGeometry = false;

                const res = await (ctx.queryFeatures || ctx.cachedQueryFeatures || ((targetLayer, targetQuery) => targetLayer.queryFeatures(targetQuery)))(layer, q);
                if (!res.features?.length) {
                    ctx.destroyChart();
                    ctx.actualizarLeyenda([], []);
                    return;
                }

                const { mpnombre, dpnombre } = resolveNames(ctx, res.features);
                ctx.actualizarTituloGrafico(ctx.config, mpnombre, dpnombre);

                let sumAmenaza = 0;
                let sumSens = 0;
                let sumCap = 0;
                let sumVuln = 0;
                let sumRiesgo = 0;
                let count = 0;

                res.features.forEach(feature => {
                    const attrs = feature.attributes || {};
                    sumAmenaza += attrs.amenaza || 0;
                    sumSens += attrs.sensibilidad || 0;
                    sumCap += attrs.capadapta || 0;
                    sumVuln += attrs.vulnerabilidad || 0;
                    sumRiesgo += attrs.riesgocc || 0;
                    count++;
                });

                if (count === 0) count = 1;

                const labels = ["Amenaza", "Sensibilidad", "Cap. Adaptación", "Vulnerabilidad", "Riesgo CC"];
                const values = [
                    Number((sumAmenaza / count).toFixed(2)),
                    Number((sumSens / count).toFixed(2)),
                    Number((sumCap / count).toFixed(2)),
                    Number((sumVuln / count).toFixed(2)),
                    Number((sumRiesgo / count).toFixed(2))
                ];

                ctx.crearGrafica(labels, values, "rgba(171, 65, 36, 0.5)", "radar", false);
            } catch (e) {
                console.error("RIESGO_CC_RADAR error:", e);
                ctx.destroyChart();
                ctx.actualizarLeyenda([], []);
            }
        }
    };
}

export function riesgoCCDeptoCountHandler() {
    return {
        when: (ctx) =>
            ctx.filtroNivel === "DEPTO" &&
            ctx.config?.isDeptoRiskCount,

        run: async (ctx) => {
            try {
                const layerUrl = ctx.config.url || ctx.layer.url;

                const buildWhere = () => {
                    const whereBase = ctx.whereBase;
                    if (whereBase && String(whereBase).trim()) return whereBase;

                    if (ctx.deptoActual) {
                        const n = Number(ctx.deptoActual);
                        if (Number.isFinite(n)) return `dpcodigo = ${n}`;
                        return `dpcodigo = '${String(ctx.deptoActual).replace(/'/g, "''")}'`;
                    }
                    return "1=1";
                };

                const where = buildWhere();

                const tryCountDistinct = async () => {
                    return await ctx.arcRestQuery(layerUrl, {
                        f: "json",
                        where,
                        groupByFieldsForStatistics: "riesgocc",
                        outStatistics: JSON.stringify([{
                            statisticType: "countDistinct",
                            onStatisticField: "mpcodigo",
                            outStatisticFieldName: "mun_count"
                        }]),
                        returnGeometry: "false"
                    });
                };

                const fallbackGroupByMuni = async () => {
                    return await ctx.arcRestQuery(layerUrl, {
                        f: "json",
                        where,
                        groupByFieldsForStatistics: "riesgocc,mpcodigo",
                        outStatistics: JSON.stringify([{
                            statisticType: "count",
                            onStatisticField: "mpcodigo",
                            outStatisticFieldName: "n"
                        }]),
                        returnGeometry: "false"
                    });
                };

                let js;
                try {
                    js = await tryCountDistinct();
                } catch (e) {
                    console.warn("RIESGO_CC_DEPTO: countDistinct no soportado, usando fallback.", e);
                    js = await fallbackGroupByMuni();
                }

                const rows = (js.features || []).map(f => f.attributes || {});
                if (!rows.length) {
                    ctx.destroyChart();
                    ctx.actualizarLeyenda([], []);
                    return;
                }

                const byRisk = new Map();
                const isFallback = rows.some(row => row.mpcodigo != null);

                for (const row of rows) {
                    const rawRisk = row.riesgocc;
                    const key = (rawRisk == null || rawRisk === "") ? 0 : Number(rawRisk);
                    if (!Number.isFinite(key)) continue;

                    if (isFallback) {
                        byRisk.set(key, (byRisk.get(key) || 0) + 1);
                    } else {
                        const count = Number(row.mun_count) || 0;
                        byRisk.set(key, (byRisk.get(key) || 0) + count);
                    }
                }

                const labels = LEYENDA_RIESGO_CC.map(item => item.label);
                const colors = LEYENDA_RIESGO_CC.map(item => item.color);
                const values = [0, 1, 2, 3, 4, 5].map(key => byRisk.get(key) || 0);

                ctx.crearGrafica(labels, values, colors, "bar", true);
                ctx.actualizarTituloGrafico(ctx.config, null, null);
                ctx.actualizarLeyenda(labels, colors);
            } catch (e) {
                console.error("RIESGO_CC_DEPTO error:", e);
                ctx.actualizarLeyenda([], []);
                ctx.destroyChart();
            }
        }
    };
}
