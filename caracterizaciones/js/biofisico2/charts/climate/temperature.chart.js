import {
    climateStackedWhen,
    getClimateDict,
    runClimateStackedHandler
} from "./climate-stacked.utils.js";

export function temperaturaStackedHandler(deps = {}) {
    return {
        when: climateStackedWhen("temp"),
        run: async (ctx) => {
            try {
                await runClimateStackedHandler(ctx, deps);
            } catch (e) {
                console.error("TEMPERATURA_STACKED error:", e);
                ctx.destroyChart();
                ctx.actualizarLeyenda([], []);
            }
        }
    };
}

export function climaDeptoAggStackedHandler(deps = {}) {
    return {
        when: (ctx) =>
            ctx.filtroNivel === "DEPTO" &&
            ctx.config?.isClima &&
            ctx.config?.isDeptoClimaAgg &&
            ctx.config?.deptoClimaAgg,

        run: async (ctx) => {
            try {
                const { periodField, rangeField, valueField, statisticType } = ctx.config.deptoClimaAgg;

                const js = await ctx.arcRestQuery(ctx.config.url || ctx.layer.url, {
                    f: "json",
                    where: ctx.whereBase || "1=1",
                    groupByFieldsForStatistics: `${periodField},${rangeField}`,
                    outStatistics: JSON.stringify([{
                        statisticType: statisticType || "sum",
                        onStatisticField: valueField,
                        outStatisticFieldName: "v_sum"
                    }]),
                    returnGeometry: "false"
                });

                const rows = (js.features || []).map(f => f.attributes || {});
                if (!rows.length) {
                    ctx.destroyChart();
                    ctx.actualizarLeyenda([], []);
                    return;
                }

                const dataByPeriod = {};
                const rangeSet = new Set();

                for (const row of rows) {
                    const period = String(row[periodField] ?? "");
                    const range = String(row[rangeField] ?? "");
                    const value = Number(row.v_sum) || 0;
                    if (!period || !range) continue;

                    if (!dataByPeriod[period]) dataByPeriod[period] = {};
                    dataByPeriod[period][range] = (dataByPeriod[period][range] || 0) + value;
                    rangeSet.add(range);
                }

                let xLabels = [];
                const isMonthly = ctx.config.climaType === "temp" || ctx.config.climaType === "precip";

                if (isMonthly) {
                    xLabels = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
                    xLabels.forEach(month => { if (!dataByPeriod[month]) dataByPeriod[month] = {}; });
                } else {
                    xLabels = Object.keys(dataByPeriod).sort((a, b) => {
                        const ya = parseInt(String(a).match(/\d{4}/)?.[0] || "9999", 10);
                        const yb = parseInt(String(b).match(/\d{4}/)?.[0] || "9999", 10);
                        return ya - yb;
                    });
                }

                xLabels.forEach(label => { if (!dataByPeriod[label]) dataByPeriod[label] = {}; });

                for (const label of xLabels) {
                    const item = dataByPeriod[label] || {};
                    const total = Object.values(item).reduce((acc, value) => acc + (Number(value) || 0), 0);
                    if (total > 0) {
                        Object.keys(item).forEach(key => { item[key] = (item[key] / total) * 100; });
                    }
                }

                const dict = getClimateDict(ctx.config.climaType, deps);
                const rangesArray = Array.from(rangeSet).sort((a, b) => Number(a) - Number(b));

                const datasets = rangesArray.map(rangeCode => {
                    const info = dict?.[rangeCode];
                    return {
                        label: info ? info.label : String(rangeCode),
                        data: xLabels.map(label => dataByPeriod[label]?.[rangeCode] || 0),
                        backgroundColor: info?.color || "#999",
                        borderColor: "#fff",
                        borderWidth: 1,
                        stack: "Stack 0",
                        rangeCode
                    };
                });

                ctx.crearGrafica(xLabels, null, null, "bar", true, datasets);
                ctx.actualizarTituloGrafico(ctx.config, null, null);
            } catch (e) {
                console.error("CLIMA DEPTO AGG error:", e);
                ctx.actualizarLeyenda([], []);
            }
        }
    };
}
