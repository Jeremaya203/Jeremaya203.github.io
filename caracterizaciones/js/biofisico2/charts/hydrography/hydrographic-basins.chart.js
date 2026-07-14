import { queryGroupSum } from "../chartUtils.js";

function getUniqueValueRendererFields(layer) {
    const renderer = layer?.renderer;
    const rendererJson = typeof renderer?.toJSON === "function" ? renderer.toJSON() : renderer;
    const type = String(renderer?.type || rendererJson?.type || "").toLowerCase();
    if (!renderer || (type !== "unique-value" && type !== "uniquevalue")) return [];

    return [
        renderer.field || renderer.field1 || rendererJson?.field || rendererJson?.field1,
        renderer.field2 || rendererJson?.field2,
        renderer.field3 || rendererJson?.field3
    ]
        .map(field => String(field ?? "").trim())
        .filter(Boolean);
}

function normalizeRendererParts(value, fields) {
    if (Array.isArray(value) && value.length === 1 && Array.isArray(value[0])) {
        return normalizeRendererParts(value[0], fields);
    }

    if (Array.isArray(value)) {
        return value.map(part => String(part ?? "").trim());
    }

    return String(value ?? "")
        .split(",")
        .slice(0, fields.length || undefined)
        .map(part => part.trim());
}

function getAttributeValue(attrs, field) {
    if (!attrs || !field) return "";
    if (Object.prototype.hasOwnProperty.call(attrs, field)) return attrs[field];

    const target = String(field).toLowerCase();
    const key = Object.keys(attrs).find(name => String(name).toLowerCase() === target);
    return key ? attrs[key] : "";
}

function normalizeText(value) {
    return String(value ?? "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ");
}

function getLayerRendererFallbackColor(layer, getSymbolColorRGBA) {
    const renderer = layer?.renderer;
    const rendererJson = typeof renderer?.toJSON === "function" ? renderer.toJSON() : renderer;
    const fromSymbol = symbol => getSymbolColorRGBA?.(symbol) || null;

    if (renderer?.type === "simple") return fromSymbol(renderer.symbol);

    const uniqueValueInfos = renderer?.uniqueValueInfos || rendererJson?.uniqueValueInfos || [];
    const uniqueValueGroups = renderer?.uniqueValueGroups || rendererJson?.uniqueValueGroups || [];

    const firstInfo = uniqueValueInfos.find(info => fromSymbol(info.symbol));
    if (firstInfo) return fromSymbol(firstInfo.symbol);

    for (const group of uniqueValueGroups) {
        const cls = (group.classes || []).find(item => fromSymbol(item.symbol));
        if (cls) return fromSymbol(cls.symbol);
    }

    return null;
}

function getRendererClassEntries(layer, getSymbolColorRGBA) {
    const renderer = layer?.renderer;
    const rendererJson = typeof renderer?.toJSON === "function" ? renderer.toJSON() : renderer;
    const type = String(renderer?.type || rendererJson?.type || "").toLowerCase();
    if (!renderer || (type !== "unique-value" && type !== "uniquevalue")) return [];

    const fields = getUniqueValueRendererFields(layer);
    const entries = [];

    const uniqueValueInfos = renderer.uniqueValueInfos || rendererJson?.uniqueValueInfos || [];
    const uniqueValueGroups = renderer.uniqueValueGroups || rendererJson?.uniqueValueGroups || [];

    uniqueValueInfos.forEach(info => {
        const parts = normalizeRendererParts(info.value ?? "", fields);
        entries.push({
            parts,
            code: parts.join(","),
            label: info.label || parts.join(","),
            color: getSymbolColorRGBA?.(info.symbol) || getLayerRendererFallbackColor(layer, getSymbolColorRGBA)
        });
    });

    uniqueValueGroups.forEach(group => {
        (group.classes || []).forEach(cls => {
            const rawValues = Array.isArray(cls?.values) && cls.values.length
                ? cls.values
                : [cls?.value || []];

            rawValues.forEach(raw => {
                const parts = normalizeRendererParts(raw, fields);
                entries.push({
                    parts,
                    code: parts.join(","),
                    label: cls.label || cls.description || parts.join(","),
                    color: getSymbolColorRGBA?.(cls.symbol) || getLayerRendererFallbackColor(layer, getSymbolColorRGBA)
                });
            });
        });
    });

    return entries.filter(entry => entry.code);
}

function getRendererEntryFromAttrs(layer, attrs, getSymbolColorRGBA) {
    const fields = getUniqueValueRendererFields(layer);
    if (!fields.length) return null;

    const attrParts = fields.map(field => String(getAttributeValue(attrs, field) ?? "").trim());
    if (attrParts.some(part => !part)) return null;
    const attrCode = attrParts.join(",");
    const attrCodeNorm = normalizeText(attrCode);

    const entries = getRendererClassEntries(layer, getSymbolColorRGBA);

    return entries.find(entry => entry.code === attrCode) ||
        entries.find(entry => normalizeText(entry.code) === attrCodeNorm) ||
        entries.find(entry =>
            entry.parts.length === attrParts.length &&
            entry.parts.every((part, index) => normalizeText(part) === normalizeText(attrParts[index]))
        ) ||
        entries.find(entry => {
            const lastAttr = attrParts[attrParts.length - 1];
            return lastAttr && entry.parts.some(part => normalizeText(part) === normalizeText(lastAttr));
        }) ||
        entries.find(entry => {
            const label = normalizeText(entry.label);
            return attrParts.some(part => {
                const normalized = normalizeText(part);
                return normalized && label.includes(normalized);
            });
        }) ||
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

function normalizePiePercentValues(items, valueKey = "pct") {
    const total = (items || []).reduce((acc, item) => acc + (Number(item?.[valueKey]) || 0), 0);
    if (total <= 0) return [];

    return items.map(item => ({
        ...item,
        [valueKey]: ((Number(item?.[valueKey]) || 0) / total) * 100
    }));
}

export function cuencasMunicipalHandler(deps = {}) {
    return {
        when: (ctx) =>
            ctx.config?.isHidro &&
            ctx.config?.hidroType === "cuencas" &&
            !ctx.config?.isDeptoCuencasAgg,

        run: async (ctx) => {
            const layer = ctx.layer;
            if (!layer || layer.destroyed) return;

            try {
                deps.hideTimeSlider?.();

                const q = layer.createQuery();
                q.where = ctx.whereBase || "1=1";
                const rendererFields = getUniqueValueRendererFields(layer);
                q.outFields = [
                    ...(ctx.config.outFields || []),
                    ...rendererFields
                ].filter((field, index, arr) => field && arr.indexOf(field) === index);
                q.returnGeometry = false;

                const res = await (ctx.queryFeatures || ctx.cachedQueryFeatures || ((targetLayer, targetQuery) => targetLayer.queryFeatures(targetQuery)))(layer, q);
                if (!res.features?.length) {
                    handleEmptyResult(ctx);
                    return;
                }

                const { mpnombre, dpnombre } = resolveNames(ctx, res.features);
                ctx.actualizarTituloGrafico(ctx.config, mpnombre, dpnombre);

                const data = new Map();

                res.features.forEach(feature => {
                    const attrs = feature.attributes || {};
                    const rendererEntry = getRendererEntryFromAttrs(layer, attrs, deps.getSymbolColorRGBA);
                    const rendererFieldValues = rendererFields
                        .map(field => String(getAttributeValue(attrs, field) ?? "").trim())
                        .filter(Boolean);
                    const fallbackCode = String(
                        (rendererFieldValues.length === rendererFields.length && rendererFieldValues.length
                            ? rendererFieldValues.join(",")
                            : (
                                getAttributeValue(attrs, "szhid") ||
                                getAttributeValue(attrs, "zonahid") ||
                                getAttributeValue(attrs, "areahidro")
                            )) ||
                        ""
                    ).trim();
                    const code = rendererEntry?.code || fallbackCode;
                    if (!code) return;

                    const value = Number(attrs[ctx.config.valueField]) || 0;
                    const current = data.get(code) || {
                        code,
                        label: rendererEntry?.label || fallbackCode,
                        color: rendererEntry?.color || getLayerRendererFallbackColor(layer, deps.getSymbolColorRGBA) || "#5f7fec",
                        value: 0
                    };

                    current.value += value;
                    data.set(code, current);
                });

                const items = Array.from(data.values())
                    .filter(item => Number(item.value) > 0)
                    .sort((a, b) => b.value - a.value);

                const isDepartmentQuery = ctx.filtroNivel === "DEPTO" && !ctx.municipioActual;
                const chartItems = isDepartmentQuery
                    ? normalizePiePercentValues(items, "value")
                    : items;

                const labels = chartItems.map(item => item.label);
                const values = chartItems.map(item => Number(item.value.toFixed(2)));
                const colors = chartItems.map(item => item.color);
                const codes = chartItems.map(item => item.code);

                ctx.crearGrafica(labels, values, colors, "pie", false);
                ctx.actualizarLeyenda(labels, colors, codes);
            } catch (e) {
                console.error("CUENCAS_MUNICIPAL error:", e);
                ctx.destroyChart();
                ctx.actualizarLeyenda([], []);
            }
        }
    };
}

export function cuencasDeptoDonutHandler(deps = {}) {
    return {
        when: (ctx) =>
            ctx.filtroNivel === "DEPTO" &&
            ctx.config?.isHidro &&
            ctx.config?.hidroType === "cuencas" &&
            ctx.config?.isDeptoCuencasAgg &&
            ctx.config?.cuencasAgg,

        run: async (ctx) => {
            try {
                deps.hideTimeSlider?.();

                const { groupField, areaCandidates } = ctx.config.cuencasAgg;
                const lyr = ctx.lyr || ctx.layer;
                await lyr.when();

                const areaField = typeof deps.pickExistingField === "function"
                    ? (deps.pickExistingField(lyr, areaCandidates) || "areat")
                    : "areat";

                const rows = await queryGroupSum({
                    url: ctx.config.url || lyr.url,
                    where: ctx.whereBase || "1=1",
                    groupBy: groupField,
                    field: areaField,
                    outName: "sum_area",
                    statisticType: "sum",
                    arcRestQuery: ctx.arcRestQuery
                });

                if (!deps.ensureNonEmptyOrExit?.(ctx, rows)) return;

                const total = rows.reduce((acc, row) => acc + (Number(row.sum_area) || 0), 0);
                if (total <= 0) {
                    ctx.destroyChart();
                    ctx.actualizarLeyenda([], []);
                    return;
                }

                const zonahidDict = new Map();
                const renderer = lyr.renderer;
                if (renderer && renderer.type === "unique-value" && Array.isArray(renderer.uniqueValueInfos)) {
                    for (const info of renderer.uniqueValueInfos) {
                        const value = String(info.value ?? "");
                        const parts = value.split(",");
                        if (parts.length < 2) continue;
                        const zonahid = parts[1].trim();
                        if (!zonahid) continue;

                        const labelRaw = String(info.label ?? "");
                        const labelParts = labelRaw.split(",");
                        const zoneName = labelParts.length >= 2
                            ? labelParts.slice(1).join(",").trim()
                            : labelRaw.trim();

                        const color = typeof deps.getSymbolColorRGBA === "function"
                            ? deps.getSymbolColorRGBA(info.symbol)
                            : "#999";

                        if (!zonahidDict.has(zonahid)) {
                            zonahidDict.set(zonahid, {
                                label: zoneName || `Zona ${zonahid}`,
                                color: color || "#999"
                            });
                        }
                    }
                }

                const pctOfTotal = typeof deps.pctOfTotal === "function"
                    ? deps.pctOfTotal
                    : ((value, denominator) => denominator ? (Number(value) / Number(denominator)) * 100 : 0);

                const items = rows.map(row => {
                    const code = String(row[groupField] ?? "").trim();
                    const area = Number(row.sum_area) || 0;
                    const pct = pctOfTotal(area, total);
                    const info = zonahidDict.get(code);

                    return {
                        code,
                        label: info?.label || `Zona ${code}`,
                        color: info?.color || "#999",
                        pct
                    };
                });

                const normalizedItems = normalizePiePercentValues(items, "pct");

                normalizedItems.sort((a, b) => (b.pct || 0) - (a.pct || 0));

                const labels = normalizedItems.map(item => item.label);
                const values = normalizedItems.map(item => Number((item.pct || 0).toFixed(2)));
                const colors = normalizedItems.map(item => item.color);

                const depName = ctx.diccionarioDepartamentos?.[ctx.deptoActual] || ctx.deptoActual;
                ctx.setTitle(`Zonas hidrográficas presentes en el departamento de ${depName}`);

                ctx.crearGrafica(labels, values, colors, "doughnut", false);

                const activeChart = deps.getChart?.() || ctx.getChartInstance?.();
                if (activeChart) {
                    activeChart.options.cutout = "60%";
                    activeChart.update();
                }

                ctx.actualizarLeyenda(labels, colors);
            } catch (e) {
                console.error("CUENCAS_DEPTO error:", e);
                ctx.actualizarLeyenda([], []);
                ctx.destroyChart();
            }
        }
    };
}
