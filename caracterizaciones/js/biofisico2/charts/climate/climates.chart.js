function getClimatesDict(deps = {}) {
    return deps.coloresClimas || globalThis.coloresClimas || {};
}

function normalizeCode(value) {
    const raw = String(value ?? "").trim();
    if (raw !== "" && !Number.isNaN(Number(raw))) {
        return String(Number(raw));
    }
    return raw;
}

function buildRendererDict(layer, deps = {}) {
    if (typeof deps.buildDictFromUniqueValueRenderer === "function") {
        return deps.buildDictFromUniqueValueRenderer(layer);
    }

    const map = new Map();
    const renderer = layer?.renderer;
    if (!renderer || renderer.type !== "unique-value") return map;

    (renderer.uniqueValueInfos || []).forEach(info => {
        const value = normalizeCode(info.value);
        const label = String(info.label ?? value).trim();
        const color = (typeof deps.getSymbolColorRGBA === "function"
            ? deps.getSymbolColorRGBA(info.symbol)
            : "#999") || "#999";

        if (value) map.set(value, { label: label || value, color });
    });

    return map;
}

function getClimateInfo(code, rendererDict, coloresClimas) {
    const normalizedCode = normalizeCode(code);
    return rendererDict.get(normalizedCode) ||
        coloresClimas?.[normalizedCode] ||
        coloresClimas?.[String(code ?? "").trim()] ||
        null;
}

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

export function climasMunicipalHandler(deps = {}) {
    const coloresClimas = getClimatesDict(deps);

    return {
        when: (ctx) =>
            ctx.config?.isClima &&
            ctx.config?.climaType === "clima_tipo" &&
            !ctx.config?.isDeptoClimaTipoAgg,

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

                const dataByCode = {};
                const rendererDict = buildRendererDict(layer, deps);
                for (const feature of res.features) {
                    const attrs = feature.attributes || {};
                    const code = normalizeCode(attrs[ctx.config.labelField]);
                    const porcentaje = Number(attrs[ctx.config.valueField]) || 0;
                    dataByCode[code] = (dataByCode[code] || 0) + porcentaje;
                }

                const domainCodes = Array.from(new Set([
                    ...Object.keys(coloresClimas || {}).map(normalizeCode),
                    ...Array.from(rendererDict.keys()).map(normalizeCode),
                    ...Object.keys(dataByCode).map(normalizeCode)
                ]))
                    .filter(code => (dataByCode[code] || 0) > 0)
                    .sort((a, b) => Number(a) - Number(b));

                const labels = domainCodes.map(code => getClimateInfo(code, rendererDict, coloresClimas)?.label || code);
                const values = domainCodes.map(code => dataByCode[code] || 0);
                const colors = domainCodes.map(code => getClimateInfo(code, rendererDict, coloresClimas)?.color || "#999");

                ctx.crearGrafica(labels, values, colors, "bar", false);
            } catch (e) {
                console.error("CLIMAS_MUNICIPAL error:", e);
                ctx.destroyChart();
                ctx.actualizarLeyenda([], []);
            }
        }
    };
}

export function climasDeptoPctHandler(deps = {}) {
    return {
        when: (ctx) =>
            ctx.filtroNivel === "DEPTO" &&
            ctx.config?.isClima &&
            ctx.config?.isDeptoClimaTipoAgg &&
            ctx.config?.deptoClimaTipoAgg,

        run: async (ctx) => {
            try {
                const { groupField, numField, denField } = ctx.config.deptoClimaTipoAgg;

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

                const dictFromRenderer =
                    (typeof deps.buildDictFromUniqueValueRenderer === "function")
                        ? deps.buildDictFromUniqueValueRenderer(lyr)
                        : (() => {
                            const map = new Map();
                            const renderer = lyr?.renderer;
                            if (!renderer || renderer.type !== "unique-value") return map;

                            (renderer.uniqueValueInfos || []).forEach(info => {
                                const value = String(info.value ?? "").trim();
                                const label = String(info.label ?? value).trim();
                                const color = (typeof deps.getSymbolColorRGBA === "function" ? deps.getSymbolColorRGBA(info.symbol) : "#999") || "#999";
                                if (value) map.set(value, { label: label || value, color });
                            });
                            return map;
                        })();

                const factor = Number(ctx.config.deptoClimaTipoAgg?.numAreaFactor) || 1;

                const items = rows.map(row => {
                    const code = normalizeCode(row[groupField]);
                    const num = Number(row.sum_num) || 0;
                    const pct = ((num * factor) / totalDen) * 100;
                    const info = getClimateInfo(code, dictFromRenderer, getClimatesDict(deps));

                    return {
                        code,
                        label: info?.label || code || "Sin información",
                        color: info?.color || "#999",
                        pct
                    };
                });

                items.sort((a, b) => b.pct - a.pct);

                const labels = items.map(item => item.label);
                const values = items.map(item => Number(item.pct.toFixed(2)));
                const colors = items.map(item => item.color);

                const depName = ctx.diccionarioDepartamentos?.[ctx.deptoActual] || ctx.deptoActual;
                ctx.setTitle(`Distribución de tipos de clima en el departamento de ${depName}`);

                ctx.crearGrafica(labels, values, colors, "bar", false);
                ctx.actualizarLeyenda(labels, colors);
            } catch (e) {
                console.error("CLIMAS_DEPTO_PCT error:", e);
                ctx.actualizarLeyenda([], []);
                ctx.destroyChart();
            }
        }
    };
}
