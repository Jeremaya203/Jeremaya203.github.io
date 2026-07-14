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

function renderDeforestacionSerieTemporal(ctx, features, deps = {}) {
    const periodField = "periodobosque";
    const dynField = "cambiobosque";
    const valueField = "porcentaje";

    const dict = typeof deps.buildDictFromUniqueValueRenderer === "function"
        ? deps.buildDictFromUniqueValueRenderer(ctx.layer || ctx.lyr)
        : new Map();
    const defCode = "14001";
    const regCode = "14002";
    const fallbackDict = deps.coloresDeforestacion || globalThis.coloresDeforestacion || {};
    const isUsefulColor = value => {
        const color = String(value ?? "").trim().toLowerCase();
        return color && color !== "#999" && color !== "rgb(153, 153, 153)" && color !== "rgba(153,153,153,1)";
    };
    const defInfo = dict.get(defCode) || fallbackDict[defCode];
    const regInfo = dict.get(regCode) || fallbackDict[regCode];
    const fallbackDefInfo = fallbackDict[defCode] || {};
    const fallbackRegInfo = fallbackDict[regCode] || {};
    const colorDef = isUsefulColor(defInfo?.color) ? defInfo.color : (fallbackDefInfo.color || "rgba(255, 127, 127, 1)");
    const colorReg = isUsefulColor(regInfo?.color) ? regInfo.color : (fallbackRegInfo.color || "rgba(76, 230, 0, 1)");
    const labelDef = defInfo?.label || "Deforestación";
    const labelReg = regInfo?.label || "Regeneración";

    const periodsSet = new Set();

    for (const feature of features) {
        const attrs = feature.attributes || {};
        const periodo = String(attrs[periodField] ?? "").trim();
        if (periodo) periodsSet.add(periodo);
    }

    const orderedPeriodsCurrent = Array.from(periodsSet).sort((a, b) => {
        const ya = parseInt((a.match(/\d{4}/) || ["9999"])[0], 10);
        const yb = parseInt((b.match(/\d{4}/) || ["9999"])[0], 10);
        return ya - yb;
    });

    const activePeriod = deps.getDeforestacionPeriodoActivo?.() || "Todos";
    let periodosBase = deps.getDeforestacionPeriodosBase?.() || [];

    if (!periodosBase.length || activePeriod === "Todos") {
        periodosBase = [...orderedPeriodsCurrent];
        deps.setDeforestacionPeriodosBase?.(periodosBase);
    }

    const orderedPeriods = periodosBase.length
        ? [...periodosBase]
        : [...orderedPeriodsCurrent];

    const byPeriod = new Map();
    for (const period of orderedPeriods) {
        byPeriod.set(period, { def: 0, reg: 0 });
    }

    for (const feature of features) {
        const attrs = feature.attributes || {};
        const periodo = String(attrs[periodField] ?? "").trim();
        const dinamica = String(attrs[dynField] ?? "").trim();
        const valor = Number(attrs[valueField]) || 0;

        if (!periodo || !byPeriod.has(periodo)) continue;

        const row = byPeriod.get(periodo);
        if (dinamica === defCode) row.def += valor;
        else if (dinamica === regCode) row.reg += valor;
    }

    const defData = orderedPeriods.map(period => +(byPeriod.get(period)?.def || 0).toFixed(2));
    const regData = orderedPeriods.map(period => +(byPeriod.get(period)?.reg || 0).toFixed(2));

    const selectedPeriod = activePeriod || "Todos";
    let safeIndex = 0;
    if (selectedPeriod !== "Todos") {
        const foundIndex = orderedPeriods.indexOf(selectedPeriod);
        safeIndex = foundIndex >= 0 ? foundIndex + 1 : 0;
    }

    deps.setTimeSliderIndex?.(safeIndex);
    deps.showTimeSlider?.(orderedPeriods, safeIndex, "deforestacion|periodo");

    ctx.setTitle(
        selectedPeriod === "Todos"
            ? "Dinámica del Cambio de Bosque"
            : `Dinámica del Cambio de Bosque - ${selectedPeriod}`
    );

    const datasets = [
        {
            label: "Deforestación",
            label: labelDef,
            rangeCode: defCode,
            __biofisicoCode: defCode,
            data: defData,
            borderColor: colorDef,
            backgroundColor: colorDef,
            pointBackgroundColor: orderedPeriods.map(period =>
                (selectedPeriod === "Todos" || period === selectedPeriod)
                    ? colorDef
                    : "rgba(255,127,127,0.20)"
            ),
            pointBorderColor: "#fff",
            pointRadius: orderedPeriods.map(period =>
                selectedPeriod === "Todos"
                    ? 5
                    : (period === selectedPeriod ? 7 : 3)
            ),
            borderWidth: 2,
            tension: 0.25,
            fill: false
        },
        {
            label: "Regeneración",
            label: labelReg,
            rangeCode: regCode,
            __biofisicoCode: regCode,
            data: regData,
            borderColor: colorReg,
            backgroundColor: colorReg,
            pointBackgroundColor: orderedPeriods.map(period =>
                (selectedPeriod === "Todos" || period === selectedPeriod)
                    ? colorReg
                    : "rgba(76,230,0,0.20)"
            ),
            pointBorderColor: "#fff",
            pointRadius: orderedPeriods.map(period =>
                selectedPeriod === "Todos"
                    ? 5
                    : (period === selectedPeriod ? 7 : 3)
            ),
            borderWidth: 2,
            tension: 0.25,
            fill: false
        }
    ];

    ctx.crearGrafica(orderedPeriods, [], null, "line", false, datasets);

    ctx.actualizarLeyenda(
        [labelDef, labelReg],
        [colorDef, colorReg],
        [defCode, regCode]
    );
}

export function deforestacionMunicipalSerieHandler(deps = {}) {
    return {
        when: (ctx) =>
            ctx.config?.isEcosistema &&
            ctx.config?.ecosistemaType === "deforestacion" &&
            !ctx.config?.isDeptoBosqueSerieAgg,

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
                    handleEmptyResult(ctx);
                    return;
                }

                renderDeforestacionSerieTemporal(ctx, res.features, deps);
            } catch (e) {
                console.error("DEFORESTACION_MUNICIPAL_SERIE error:", e);
                ctx.destroyChart();
                ctx.actualizarLeyenda([], []);
            }
        }
    };
}

export function bosqueDeptoLineaHandler(deps = {}) {
    return {
        when: (ctx) =>
            ctx.filtroNivel === "DEPTO" &&
            ctx.config?.isEcosistema &&
            ctx.config?.ecosistemaType === "bosque" &&
            ctx.config?.isDeptoBosqueSerieAgg &&
            ctx.config?.deptoBosqueSerieAgg,

        run: async (ctx) => {
            try {
                const agg = ctx.config.deptoBosqueSerieAgg;
                const { seriesField, xField, numField, denField, numAreaFactor } = agg;

                const lyr = ctx.lyr || ctx.layer;
                await lyr.when();

                const jsNum = await ctx.arcRestQuery(ctx.config.url || lyr.url, {
                    f: "json",
                    where: ctx.whereBase || "1=1",
                    groupByFieldsForStatistics: `${xField},${seriesField}`,
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
                const byPeriod = new Map();

                for (const row of rows) {
                    const period = String(row[xField] ?? "").trim();
                    const serie = String(row[seriesField] ?? "").trim();
                    const num = Number(row.sum_num) || 0;
                    const pct = ((num * factor) / totalDen) * 100;

                    if (!byPeriod.has(period)) byPeriod.set(period, {});
                    byPeriod.get(period)[serie] = (byPeriod.get(period)[serie] || 0) + pct;
                }

                const periods = Array.from(byPeriod.keys()).sort((a, b) => {
                    const pa = parseInt(String(a).split("-")[0], 10);
                    const pb = parseInt(String(b).split("-")[0], 10);
                    if (Number.isFinite(pa) && Number.isFinite(pb)) return pa - pb;
                    return String(a).localeCompare(String(b));
                });

                const defCode = "14001";
                const regCode = "14002";

                const defData = periods.map(period => Number(((byPeriod.get(period)?.[defCode]) || 0).toFixed(3)));
                const regData = periods.map(period => Number(((byPeriod.get(period)?.[regCode]) || 0).toFixed(3)));

                const defInfo = dict.get(defCode);
                const regInfo = dict.get(regCode);

                ctx.setTitle("Dinámica del Cambio de Bosque");

                const datasets = [
                    {
                        label: defInfo?.label || "Deforestación",
                        data: defData,
                        borderColor: defInfo?.color || "#ff7f7f",
                        backgroundColor: defInfo?.color || "#ff7f7f",
                        tension: 0.25,
                        pointRadius: 3
                    },
                    {
                        label: regInfo?.label || "Regeneración",
                        data: regData,
                        borderColor: regInfo?.color || "#4ce600",
                        backgroundColor: regInfo?.color || "#4ce600",
                        tension: 0.25,
                        pointRadius: 3
                    }
                ];

                ctx.crearGrafica(periods, [], [], "line", true, datasets);

                ctx.actualizarLeyenda(
                    datasets.map(dataset => dataset.label),
                    datasets.map(dataset => dataset.borderColor)
                );
            } catch (e) {
                console.error("BOSQUE_DEPTO_LINEA error:", e);
                ctx.destroyChart();
                ctx.actualizarLeyenda([], []);
            }
        }
    };
}
