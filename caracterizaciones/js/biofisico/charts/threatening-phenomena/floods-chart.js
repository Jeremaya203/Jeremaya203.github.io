import {
    mergePctWithDict,
    queryGroupSum,
    sortItems
} from "../chart-utils.js";

const FLOOD_ORDER = ["Muy baja", "Baja", "Media", "Alta", "Muy alta", "Sin información"];

function resolveNames(ctx, features) {
    const firstAttrs = features?.[0]?.attributes || {};
    let mpnombre = firstAttrs.mpnombre;
    let dpnombre = firstAttrs.dpnombre;

    if ((!mpnombre || !isNaN(mpnombre)) && ctx.currentMunicipalityId) {
        mpnombre = ctx.municipalityNames?.[ctx.currentMunicipalityId] || ctx.currentMunicipalityId;
    }

    if ((!dpnombre || !isNaN(dpnombre)) && ctx.currentMunicipalityId) {
        const dpCode = String(ctx.currentMunicipalityId).substring(0, 2);
        dpnombre = ctx.departmentNames?.[dpCode] || dpCode;
    }

    return { mpnombre, dpnombre };
}

function clearChart(ctx) {
    ctx.destroyChart();
    ctx.updateLegend([], []);
}

function pctOfTotal(value, total, deps) {
    if (typeof deps.pctOfTotal === "function") return deps.pctOfTotal(value, total);
    return total ? (Number(value) / Number(total)) * 100 : 0;
}

function ensureRows(ctx, rows, deps) {
    if (typeof deps.ensureNonEmptyOrExit === "function") {
        return deps.ensureNonEmptyOrExit(ctx, rows);
    }

    if (!rows?.length) {
        clearChart(ctx);
        return false;
    }

    return true;
}

function getFenomenosMeta(type, deps) {
    const floodColors = deps.floodColors || globalThis.floodColors || {};
    const massRemovalColors = deps.massRemovalColors || globalThis.massRemovalColors || {};
    const degradationColors = deps.degradationColors || globalThis.degradationColors || {};
    const seismicColors = deps.seismicColors || globalThis.seismicColors || {};

    if (type === "inundaciones") {
        return { dict: floodColors, desiredLabelOrder: FLOOD_ORDER, chartKind: "bar" };
    }
    if (type === "sismica") {
        return {
            dict: seismicColors,
            desiredLabelOrder: ["Débil", "Ligero", "Moderado", "Fuerte", "Muy fuerte", "Severo", "Violento", "Sin información"],
            chartKind: "bar"
        };
    }
    if (type === "remocion") {
        return { dict: massRemovalColors, desiredLabelOrder: null, chartKind: "pie" };
    }
    if (type === "degradacion") {
        return { dict: degradationColors, desiredLabelOrder: null, chartKind: "bar" };
    }

    return { dict: {}, desiredLabelOrder: null, chartKind: "bar" };
}

function getFenomenosTitle(type, depName) {
    if (type === "inundaciones") return `Porcentaje de susceptibilidad a inundaciones en el departamento de ${depName}`;
    if (type === "sismica") return `Distribución de la intensidad sísmica esperada en el departamento de ${depName}`;
    return `Distribución (%) en el departamento de ${depName}`;
}

export function floodsMunicipalHandler(deps = {}) {
    const floodColors = deps.floodColors || globalThis.floodColors || {};

    return {
        when: (ctx) =>
            ctx.config?.isFenomenos &&
            ctx.config?.fenomenosType === "inundaciones" &&
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
                ctx.updateChartTitle(ctx.config, mpnombre, dpnombre);

                const data = {};
                const labelInfo = {};

                features.forEach(feature => {
                    const attrs = feature.attributes || {};
                    const key = attrs[ctx.config.labelField];
                    const info = floodColors?.[key];
                    const label = info ? info.label : key;
                    const value = Number(attrs[ctx.config.valueField]) || 0;

                    if (info) labelInfo[label] = info.color;
                    data[label] = (data[label] || 0) + value;
                });

                const rows = Object.keys(data).map(label => ({
                    label,
                    value: Number(data[label]) || 0,
                    color: labelInfo[label] || "#999"
                }));

                rows.sort((a, b) => {
                    const orderA = FLOOD_ORDER.indexOf(a.label);
                    const orderB = FLOOD_ORDER.indexOf(b.label);
                    const rankA = orderA === -1 ? 999 : orderA;
                    const rankB = orderB === -1 ? 999 : orderB;
                    return rankA - rankB;
                });

                const labels = rows.map(row => row.label);
                const values = rows.map(row => row.value);
                const colors = rows.map(row => row.color);

                ctx.createChart(labels, values, colors, "bar", true);
                ctx.updateLegend(labels, colors);
            } catch (e) {
                console.error("INUNDACIONES_MUNICIPAL error:", e);
                clearChart(ctx);
            }
        }
    };
}

export function phenomenaDepartmentPercentageHandler(deps = {}) {
    return {
        when: (ctx) =>
            ctx.territoryLevel === "DEPTO" &&
            ctx.config?.isFenomenos &&
            ctx.config?.isDeptoFenAgg &&
            ctx.config?.deptoAgg,

        run: async (ctx) => {
            const { groupField, numField } = ctx.config.deptoAgg;
            const url = ctx.config.url || ctx.layer.url;

            const rows = await queryGroupSum({
                url,
                where: ctx.whereBase,
                groupBy: groupField,
                field: numField,
                outName: "sum_area",
                arcRestQuery: ctx.arcRestQuery
            });

            if (!ensureRows(ctx, rows, deps)) return;

            const total = rows.reduce((acc, row) => acc + (Number(row.sum_area) || 0), 0);
            if (total <= 0) {
                clearChart(ctx);
                return;
            }

            const pctByCode = new Map(
                rows.map(row => [String(row[groupField]), pctOfTotal(row.sum_area, total, deps)])
            );

            const { dict, desiredLabelOrder, chartKind } = getFenomenosMeta(ctx.config.fenomenosType, deps);
            const items = mergePctWithDict(pctByCode, dict);
            const ordered = sortItems(items, desiredLabelOrder);

            const labels = ordered.map(item => item.label);
            const values = ordered.map(item => Number((item.pct || 0).toFixed(2)));
            const colors = ordered.map(item => item.color);

            const depName = ctx.departmentNames?.[ctx.currentDepartmentId] || ctx.currentDepartmentId;
            ctx.setTitle(getFenomenosTitle(ctx.config.fenomenosType, depName));

            if (chartKind === "pie") ctx.createChart(labels, values, colors, "pie", false);
            else ctx.createChart(labels, values, colors, "bar", true);

            ctx.updateLegend(labels, colors);
        }
    };
}
