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

function buildRendererDict(layer, deps) {
    if (typeof deps.buildDictFromUniqueValueRenderer === "function") {
        return deps.buildDictFromUniqueValueRenderer(layer);
    }

    const map = new Map();
    const renderer = layer?.renderer;
    if (!renderer || renderer.type !== "unique-value") return map;

    (renderer.uniqueValueInfos || []).forEach(info => {
        const value = String(info.value ?? "").trim();
        const label = String(info.label ?? value).trim();
        const color = (typeof deps.getSymbolColorRGBA === "function"
            ? deps.getSymbolColorRGBA(info.symbol)
            : "#999") || "#999";

        if (value) map.set(value, { label: label || value, color });
    });

    return map;
}

function renderOrdenSueloBubble(ctx, features, deps) {
    const { yField, xField, valueField } = ctx.config.ordenAgg;
    const coloresOrdenSuelo = deps.getColoresOrdenSuelo?.() || deps.coloresOrdenSuelo || globalThis.coloresOrdenSuelo || {};
    const rendererDict = buildRendererDict(ctx.layer || ctx.lyr, deps);

    const fertilidadInfo = (value) => {
        const key = String(value ?? "").trim();
        return {
            code: key,
            label: key || "Sin dato"
        };
    };

    const ordenInfo = (value) => {
        const key = String(value ?? "").trim();
        const rendererInfo = rendererDict.get(key);
        const info = rendererInfo || coloresOrdenSuelo?.[key];

        return {
            code: key,
            label: info?.label || key || "Sin dato",
            color: info?.color || "#5DA5DA"
        };
    };

    const fertSet = new Set();
    const ordenSet = new Set();
    const grouped = [];

    for (const feature of features) {
        const attrs = feature.attributes || {};
        const fert = fertilidadInfo(attrs[xField]);
        const ord = ordenInfo(attrs[yField]);
        const value = Number(attrs[valueField]) || 0;

        fertSet.add(fert.label);
        ordenSet.add(ord.code);
        grouped.push({
            xLabel: fert.label,
            xCode: fert.code,
            yCode: ord.code,
            yLabel: ord.label,
            color: ord.color,
            value
        });
    }

    const desiredXOrder = [
        "Baja",
        "Media",
        "Alta",
        "Alta y media",
        "Media y baja",
        "Cuerpos de agua",
        "No aplica"
    ];

    const xLabels = Array.from(fertSet);
    xLabels.sort((a, b) => {
        const ia = desiredXOrder.indexOf(a);
        const ib = desiredXOrder.indexOf(b);
        const ra = ia === -1 ? 999 : ia;
        const rb = ib === -1 ? 999 : ib;
        if (ra !== rb) return ra - rb;
        return String(a).localeCompare(String(b), "es");
    });

    const ordenArr = Array.from(ordenSet).map(code => ordenInfo(code));
    ordenArr.sort((a, b) => String(a.label).localeCompare(String(b.label), "es"));

    const yLabels = ordenArr.map(item => item.label);
    const xIndex = new Map(xLabels.map((value, index) => [value, index]));
    const yIndex = new Map(ordenArr.map((value, index) => [value.code, index]));
    const isDepartmentQuery = ctx.filtroNivel === "DEPTO" && !ctx.municipioActual;
    const totalGroupedValue = isDepartmentQuery
        ? grouped.reduce((sum, group) => sum + (Number(group.value) || 0), 0)
        : 0;

    if (isDepartmentQuery && totalGroupedValue > 0) {
        grouped.forEach(group => {
            group.value = ((Number(group.value) || 0) / totalGroupedValue) * 100;
        });
    }

    const datasets = ordenArr.map(ord => {
        const points = grouped
            .filter(group => group.yCode === ord.code)
            .map(group => ({
                x: xIndex.get(group.xLabel),
                y: yIndex.get(group.yCode),
                r: Math.max(8, Math.min(20, Math.sqrt(group.value) * 3.8)),
                porcentaje: group.value,
                xLabel: group.xLabel,
                yLabel: group.yLabel,
                xValue: group.xCode,
                yValue: group.yCode
            }));

        return {
            label: ord.label,
            data: points,
            backgroundColor: ord.color,
            borderColor: "#ffffff",
            borderWidth: 1.2
        };
    });

    deps.crearGraficaBubbleOrdenSuelo?.({
        xLabels,
        yLabels,
        datasets,
        isDepartment: isDepartmentQuery
    });

    ctx.actualizarLeyenda(
        ordenArr.map(item => item.label),
        ordenArr.map(item => item.color),
        ordenArr.map(item => item.code)
    );
}

function renderOrdenSueloSimple(ctx, features) {
    const data = {};

    features.forEach(feature => {
        const attrs = feature.attributes || {};
        const ord = attrs.ordsuelo;
        const fert = attrs.fertilidad;
        const pct = Number(attrs.porcentaje) || 0;

        if (!ord || !fert) return;

        const key = `${ord} - ${fert}`;
        data[key] = (data[key] || 0) + pct;
    });

    const labels = Object.keys(data);
    const values = Object.values(data);
    const colors = labels.map(() => "rgba(54,162,235,0.8)");

    ctx.setTitle("Distribución de órdenes y fertilidad de los suelos");
    ctx.crearGrafica(labels, values, colors, "bar", true);
    ctx.actualizarLeyenda(labels, colors);
}

export function ordenSueloMunicipalHandler(deps = {}) {
    return {
        when: (ctx) =>
            ctx.config?.isSuelos &&
            ctx.config?.suelosType === "orden" &&
            !ctx.config?.isDeptoSoilAgg,

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

                if (ctx.config?.isBubbleOrdenSuelo && ctx.config?.ordenAgg) {
                    renderOrdenSueloBubble(ctx, features, deps);
                    return;
                }

                renderOrdenSueloSimple(ctx, features);
            } catch (e) {
                console.error("ORDEN_SUELO_MUNICIPAL error:", e);
                clearChart(ctx);
            }
        }
    };
}

export function ordenSueloDeptoPieHandler(deps = {}) {
    return {
        when: (ctx) =>
            ctx.filtroNivel === "DEPTO" &&
            ctx.config?.isSuelos &&
            ctx.config?.isDeptoSoilAgg &&
            ctx.config?.soilAgg,

        run: async (ctx) => {
            try {
                const { groupField, numField, denField } = ctx.config.soilAgg;
                const url = ctx.config.url || ctx.layer.url;

                const jsNum = await ctx.arcRestQuery(url, {
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

                const rowsNum = (jsNum.features || []).map(feature => feature.attributes || {});
                if (!rowsNum.length) {
                    clearChart(ctx);
                    return;
                }

                const jsDen = await ctx.arcRestQuery(url, {
                    f: "json",
                    where: ctx.whereBase || "1=1",
                    outStatistics: JSON.stringify([{
                        statisticType: "sum",
                        onStatisticField: denField,
                        outStatisticFieldName: "sum_den"
                    }]),
                    returnGeometry: "false"
                });

                const denominator = Number(jsDen?.features?.[0]?.attributes?.sum_den) || 0;
                if (denominator <= 0) {
                    clearChart(ctx);
                    return;
                }

                const dictFromRenderer = buildRendererDict(ctx.layer, deps);

                const items = rowsNum
                    .map(row => {
                        const code = String(row[groupField] ?? "").trim();
                        const sumNum = Number(row.sum_num) || 0;
                        const pct = (sumNum * 100) / denominator;
                        const info = dictFromRenderer.get(code);

                        return {
                            code,
                            label: info?.label || code || "Sin información",
                            color: info?.color || "#999",
                            pct
                        };
                    })
                    .filter(item => item.code || item.label)
                    .sort((a, b) => (b.pct || 0) - (a.pct || 0));

                const labels = items.map(item => item.label);
                const values = items.map(item => Number((item.pct || 0).toFixed(2)));
                const colors = items.map(item => item.color);

                ctx.setTitle("Distribución de órdenes y fertilidad de los suelos");
                ctx.crearGrafica(labels, values, colors, "pie", false);
                ctx.actualizarLeyenda(labels, colors);
            } catch (e) {
                console.error("ORDEN_SUELO_DEPTO pie error:", e);
                clearChart(ctx);
            }
        }
    };
}
