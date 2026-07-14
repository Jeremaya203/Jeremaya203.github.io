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

function normalizeCode(value) {
    const raw = String(value ?? "").trim();
    if (raw !== "" && !Number.isNaN(Number(raw))) {
        return String(Number(raw));
    }
    return raw;
}

function buildRendererDict(layer, deps) {
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

function getConflictInfo(code, rendererDict, coloresConflictos) {
    const normalizedCode = normalizeCode(code);
    return rendererDict.get(normalizedCode) ||
        coloresConflictos?.[normalizedCode] ||
        coloresConflictos?.[String(code ?? "").trim()] ||
        null;
}

export function conflictosSueloMunicipalHandler(deps = {}) {
    const coloresConflictos = deps.coloresConflictos || globalThis.coloresConflictos || {};

    return {
        when: (ctx) =>
            ctx.config?.isSuelos &&
            ctx.config?.suelosType === "conflictos" &&
            !ctx.config?.isDeptoConflictosAgg,

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
                const rendererDict = buildRendererDict(layer, deps);

                features.forEach(feature => {
                    const attrs = feature.attributes || {};
                    const key = normalizeCode(attrs[ctx.config.labelField]);
                    const info = getConflictInfo(key, rendererDict, coloresConflictos);
                    const label = info ? info.label : key;
                    const value = Number(attrs[ctx.config.valueField]) || 0;

                    if (info) labelInfo[label] = info.color;
                    data[label] = (data[label] || 0) + value;
                });

                const labels = Object.keys(data);
                const values = Object.values(data);
                const colors = labels.map(label => labelInfo[label] || "#999");

                ctx.crearGrafica(labels, values, colors, "bar", false);
                ctx.actualizarLeyenda(labels, colors);
            } catch (e) {
                console.error("CONFLICTOS_MUNICIPAL error:", e);
                clearChart(ctx);
            }
        }
    };
}

export function conflictosSueloDeptoPctHandler(deps = {}) {
    return {
        when: (ctx) =>
            ctx.filtroNivel === "DEPTO" &&
            ctx.config?.isSuelos &&
            ctx.config?.isDeptoConflictosAgg &&
            ctx.config?.conflictosAgg,

        run: async (ctx) => {
            try {
                const { groupField, numField } = ctx.config.conflictosAgg;
                const lyr = ctx.lyr || ctx.layer;
                await lyr.when();

                const js = await ctx.arcRestQuery(ctx.config.url || lyr.url, {
                    f: "json",
                    where: ctx.whereBase || "1=1",
                    groupByFieldsForStatistics: groupField,
                    outStatistics: JSON.stringify([{
                        statisticType: "sum",
                        onStatisticField: numField,
                        outStatisticFieldName: "sum_area"
                    }]),
                    returnGeometry: "false"
                });

                const rows = (js.features || []).map(feature => feature.attributes || {});
                if (!rows.length) {
                    clearChart(ctx);
                    return;
                }

                const total = rows.reduce((acc, row) => acc + (Number(row.sum_area) || 0), 0);
                if (total <= 0) {
                    clearChart(ctx);
                    return;
                }

                const dictFromRenderer = buildRendererDict(lyr, deps);

                const items = rows.map(row => {
                    const code = normalizeCode(row[groupField]);
                    const area = Number(row.sum_area) || 0;
                    const pct = (area / total) * 100;
                    const info = getConflictInfo(code, dictFromRenderer, deps.coloresConflictos || globalThis.coloresConflictos || {});

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
                ctx.setTitle(`Porcentaje de tipos de conflicto de uso del suelo en el departamento de ${depName}`);
                ctx.crearGrafica(labels, values, colors, "bar", false);
                ctx.actualizarLeyenda(labels, colors);
            } catch (e) {
                console.error("CONFLICTOS_DEPTO error:", e);
                clearChart(ctx);
            }
        }
    };
}
