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
    ].map(field => String(field ?? "").trim()).filter(Boolean);
}

function normalizeRendererParts(value, fields) {
    if (Array.isArray(value) && value.length === 1 && Array.isArray(value[0])) {
        return normalizeRendererParts(value[0], fields);
    }
    if (Array.isArray(value)) return value.map(part => String(part ?? "").trim());
    return String(value ?? "").split(",").slice(0, fields.length || undefined).map(part => part.trim());
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

function buildRendererCode(parts) {
    return (parts || []).map(part => String(part ?? "").trim()).filter(Boolean).join(";");
}

function getRendererCodeFromAttrs(layer, attrs) {
    const fields = getUniqueValueRendererFields(layer);
    if (!fields.length) return "";

    const parts = fields.map(field => String(getAttributeValue(attrs, field) ?? "").trim());
    if (parts.some(part => !part)) return "";
    return buildRendererCode(parts);
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
            code: buildRendererCode(parts),
            label: info.label || parts.join(","),
            color: getSymbolColorRGBA?.(info.symbol) || "#999"
        });
    });

    uniqueValueGroups.forEach(group => {
        (group.classes || []).forEach(cls => {
            const rawValues = Array.isArray(cls?.values) && cls.values.length ? cls.values : [cls?.value || []];
            rawValues.forEach(raw => {
                const parts = normalizeRendererParts(raw, fields);
                entries.push({
                    parts,
                    code: buildRendererCode(parts),
                    label: cls.label || cls.description || parts.join(","),
                    color: getSymbolColorRGBA?.(cls.symbol) || "#999"
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
    const attrCode = buildRendererCode(attrParts);
    const attrCodeNorm = normalizeText(attrCode);
    const entries = getRendererClassEntries(layer, getSymbolColorRGBA);

    return entries.find(entry => entry.code === attrCode) ||
        entries.find(entry => normalizeText(entry.code) === attrCodeNorm) ||
        entries.find(entry =>
            entry.parts.length === attrParts.length &&
            entry.parts.every((part, index) => normalizeText(part) === normalizeText(attrParts[index]))
        ) ||
        entries.find(entry => normalizeText(entry.label).includes(normalizeText(attrParts[attrParts.length - 1]))) ||
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

export function ecosistemasMunicipalHandler(deps = {}) {
    return {
        when: (ctx) =>
            ctx.config?.isEcosistema &&
            ctx.config?.ecosistemaType === "ecosistemas" &&
            !ctx.config?.isDeptoEcosCondAgg,

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
                const isConditionLayer = String(layer.url || "").endsWith("/25");
                const valueField = ctx.config.valueField || "porcentaje";

                res.features.forEach(feature => {
                    const attrs = feature.attributes || {};
                    const rendererEntry = getRendererEntryFromAttrs(layer, attrs, deps.getSymbolColorRGBA);
                    const fallbackField = isConditionLayer ? "condicion" : (ctx.config.labelField || "ecosgen");
                    const fallbackCode = getRendererCodeFromAttrs(layer, attrs) ||
                        String(getAttributeValue(attrs, fallbackField) ?? "").trim();
                    const code = fallbackCode || rendererEntry?.code;
                    if (!code) return;

                    const value = Number(attrs[valueField]) || 0;
                    const current = data.get(code) || {
                        code,
                        label: rendererEntry?.label || fallbackCode,
                        color: rendererEntry?.color || "#999",
                        value: 0
                    };
                    current.value += value;
                    data.set(code, current);
                });

                const rows = Array.from(data.values())
                    .filter(row => Number(row.value) > 0)
                    .sort((a, b) => b.value - a.value);

                const labels = rows.map(row => row.label);
                const values = rows.map(row => row.value);
                const colors = rows.map(row => row.color);
                const codes = rows.map(row => row.code);

                ctx.crearGrafica(labels, values, colors, "bar", false);
                ctx.actualizarLeyenda(labels, colors, codes);
            } catch (e) {
                console.error("ECOSISTEMAS_MUNICIPAL error:", e);
                ctx.destroyChart();
                ctx.actualizarLeyenda([], []);
            }
        }
    };
}

export function ecosistemasCondicionDeptoDonutHandler(deps = {}) {
    const coloresCondicionEcos = deps.coloresCondicionEcos || globalThis.coloresCondicionEcos || {};

    return {
        when: (ctx) =>
            ctx.filtroNivel === "DEPTO" &&
            ctx.config?.isEcosistema &&
            ctx.config?.ecosistemaType === "ecosistemas" &&
            ctx.config?.isDeptoEcosCondAgg &&
            ctx.config?.ecosCondAgg,

        run: async (ctx) => {
            try {
                deps.hideTimeSlider?.();

                const { groupField, areaCandidates } = ctx.config.ecosCondAgg;

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

                const pctOfTotal = typeof deps.pctOfTotal === "function"
                    ? deps.pctOfTotal
                    : ((value, denominator) => denominator ? (Number(value) / Number(denominator)) * 100 : 0);

                const pctByCode = new Map(
                    rows.map(row => [String(row[groupField]), pctOfTotal(row.sum_area, total)])
                );

                const orderCodes = ["13001", "13002", "13003", "13004", "13005"];
                const items = orderCodes
                    .map(code => {
                        const pct = pctByCode.get(code);
                        if (pct == null || pct <= 0) return null;
                        const info = coloresCondicionEcos?.[Number(code)] || coloresCondicionEcos?.[code];
                        return {
                            code,
                            label: info?.label || code,
                            color: info?.color || "#999",
                            pct
                        };
                    })
                    .filter(Boolean);

                for (const [code, pct] of pctByCode.entries()) {
                    if (items.some(item => item.code === code)) continue;
                    items.push({ code, label: code, color: "#999", pct });
                }

                const labels = items.map(item => item.label);
                const values = items.map(item => Number((item.pct || 0).toFixed(2)));
                const colors = items.map(item => item.color);

                const depName = ctx.diccionarioDepartamentos?.[ctx.deptoActual] || ctx.deptoActual;
                ctx.setTitle(`Dona de Condición (Estados) - Ecosistemas en el departamento de ${depName}`);

                ctx.crearGrafica(labels, values, colors, "doughnut", false);

                const activeChart = deps.getChart?.() || ctx.getChartInstance?.();
                if (activeChart) {
                    activeChart.options.cutout = "60%";
                    activeChart.update();
                }

                ctx.actualizarLeyenda(labels, colors);
            } catch (e) {
                console.error("ECOSISTEMAS_DEPTO_CONDICION error:", e);
                ctx.actualizarLeyenda([], []);
                ctx.destroyChart();
            }
        }
    };
}
