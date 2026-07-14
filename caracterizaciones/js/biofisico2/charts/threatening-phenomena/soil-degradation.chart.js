import {
    clasesDegradacion,
    ORDEN_DEGRADACION
} from "../chartUtils.js";

const CLASS_ORDER = [
    "Laminar",
    "Laminar y Surcos",
    "Terraceo y Laminar",
    "Surcos y cárcavas",
    "Sin evidencia"
];

const GRADE_ORDER = [
    "Ligera",
    "Moderada",
    "Severa",
    "Muy severa",
    "No suelo",
    "Sin evidencia"
];

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

function getColoresDegradacion(deps) {
    return deps.coloresDegradacion || globalThis.coloresDegradacion || {};
}

function getColoresClaseDegradacion(deps) {
    return deps.coloresClaseDegradacion || globalThis.coloresClaseDegradacion || {};
}

function gradoInfo(code, deps) {
    const key = String(code ?? "").trim();
    const coloresDegradacion = getColoresDegradacion(deps);
    const info = coloresDegradacion?.[key];

    if (info) {
        return {
            code: key,
            label: info.label || key,
            color: info.color || "#999"
        };
    }

    const low = key.toLowerCase();
    if (low.includes("lig")) return { code: key, label: "Ligera", color: "#f2c400" };
    if (low.includes("mod")) return { code: key, label: "Moderada", color: "#f39c12" };
    if (low.includes("sev")) return { code: key, label: "Severa", color: "#d35400" };
    if (low.includes("sin")) return { code: key, label: "Sin evidencia", color: "#b0b0b0" };

    return {
        code: key || "NA",
        label: key || "Sin evidencia",
        color: "#999"
    };
}

function claseInfo(code, deps) {
    const key = String(code ?? "").trim();

    if (clasesDegradacion[key]) {
        return {
            code: key,
            label: clasesDegradacion[key]
        };
    }

    const coloresClaseDegradacion = getColoresClaseDegradacion(deps);
    const info = coloresClaseDegradacion?.[key];

    if (info) {
        return {
            code: key,
            label: info.label || key
        };
    }

    return {
        code: key || "NA",
        label: key || "Sin evidencia"
    };
}

function buildStackedDatasets(rows, classField, gradeField, valueField, deps) {
    const matrix = {};
    const classSet = new Set();
    const gradeSet = new Set();

    for (const row of rows) {
        const classItem = claseInfo(row[classField], deps);
        const gradeItem = gradoInfo(row[gradeField], deps);
        const value = Number(row[valueField]) || 0;

        classSet.add(classItem.code);
        gradeSet.add(gradeItem.code);

        if (!matrix[classItem.code]) matrix[classItem.code] = {};
        matrix[classItem.code][gradeItem.code] = (matrix[classItem.code][gradeItem.code] || 0) + value;
    }

    const classArr = Array.from(classSet).map(code => ({
        code,
        label: claseInfo(code, deps).label
    }));

    classArr.sort((a, b) => {
        const ia = CLASS_ORDER.indexOf(a.label);
        const ib = CLASS_ORDER.indexOf(b.label);
        const ra = ia === -1 ? 999 : ia;
        const rb = ib === -1 ? 999 : ib;
        if (ra !== rb) return ra - rb;
        return String(a.label).localeCompare(String(b.label), "es");
    });

    const gradeArr = Array.from(gradeSet).map(code => ({
        code,
        ...gradoInfo(code, deps)
    }));

    gradeArr.sort((a, b) => {
        const ia = GRADE_ORDER.indexOf(a.label);
        const ib = GRADE_ORDER.indexOf(b.label);
        const ra = ia === -1 ? 999 : ia;
        const rb = ib === -1 ? 999 : ib;
        if (ra !== rb) return ra - rb;
        return String(a.label).localeCompare(String(b.label), "es");
    });

    const labels = classArr.map(item => item.label);
    const datasets = gradeArr.map(grade => ({
        label: grade.label,
        data: classArr.map(classItem => Number((matrix[classItem.code]?.[grade.code] || 0).toFixed(2))),
        backgroundColor: grade.color,
        borderColor: "#fff",
        borderWidth: 1,
        stack: "Stack 0",
        gradeCode: grade.code,
        rangeCode: grade.code,
        __biofisicoCode: grade.code,
        hidden: false
    }));

    return { labels, datasets };
}

export function degradacionMunicipalStackedHandler(deps = {}) {
    return {
        when: (ctx) =>
            ctx.config?.isFenomenos &&
            ctx.config?.fenomenosType === "degradacion" &&
            ctx.config?.isStackedDegradacion &&
            ctx.config?.degAgg,

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

                const { classField, gradeField, valueField } = ctx.config.degAgg;
                const rows = features.map(feature => feature.attributes || {});
                const { labels, datasets } = buildStackedDatasets(rows, classField, gradeField, valueField, deps);

                ctx.crearGrafica(labels, null, null, "bar", true, datasets);
                ctx.actualizarLeyenda(
                    datasets.map(dataset => dataset.label),
                    datasets.map(dataset => dataset.backgroundColor),
                    datasets.map(dataset => dataset.gradeCode)
                );
            } catch (e) {
                console.error("DEGRADACION_MUNICIPAL_STACKED error:", e);
                clearChart(ctx);
            }
        }
    };
}

export function degradacionMunicipalSimpleHandler(deps = {}) {
    const coloresDegradacion = getColoresDegradacion(deps);

    return {
        when: (ctx) =>
            ctx.config?.isFenomenos &&
            ctx.config?.fenomenosType === "degradacion" &&
            !ctx.config?.isStackedDegradacion &&
            !ctx.config?.isDeptoDegStacked &&
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
                ctx.actualizarTituloGrafico(ctx.config, mpnombre, dpnombre);

                const data = {};
                const labelInfo = {};

                features.forEach(feature => {
                    const attrs = feature.attributes || {};
                    const key = attrs[ctx.config.labelField];
                    const info = coloresDegradacion?.[key];
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

                rows.sort((a, b) =>
                    (ORDEN_DEGRADACION[a.label] ?? 999) -
                    (ORDEN_DEGRADACION[b.label] ?? 999)
                );

                const labels = rows.map(row => row.label);
                const values = rows.map(row => row.value);
                const colors = rows.map(row => row.color);

                ctx.crearGrafica(labels, values, colors, "bar", true);
            } catch (e) {
                console.error("DEGRADACION_MUNICIPAL_SIMPLE error:", e);
                clearChart(ctx);
            }
        }
    };
}

export function degradacionDeptoStackedHandler(deps = {}) {
    return {
        when: (ctx) =>
            ctx.filtroNivel === "DEPTO" &&
            ctx.config?.isFenomenos &&
            ctx.config?.fenomenosType === "degradacion" &&
            ctx.config?.isDeptoDegStacked &&
            ctx.config?.degDeptoAgg,

        run: async (ctx) => {
            try {
                const { classField, gradeField, areaField } = ctx.config.degDeptoAgg;

                const js = await ctx.arcRestQuery(ctx.config.url || ctx.layer.url, {
                    f: "json",
                    where: ctx.whereBase || "1=1",
                    groupByFieldsForStatistics: `${classField},${gradeField}`,
                    outStatistics: JSON.stringify([{
                        statisticType: "sum",
                        onStatisticField: areaField,
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

                const pctRows = rows.map(row => ({
                    ...row,
                    __pct: ((Number(row.sum_area) || 0) / total) * 100
                }));

                const { labels, datasets } = buildStackedDatasets(pctRows, classField, gradeField, "__pct", deps);

                const depName = ctx.diccionarioDepartamentos?.[ctx.deptoActual] || ctx.deptoActual;
                ctx.setTitle(`Grado y clase de degradación del suelo en el departamento de ${depName}`);
                ctx.crearGrafica(labels, null, null, "bar", true, datasets);
            } catch (e) {
                console.error("DEGRADACION_DEPTO stacked error:", e);
                clearChart(ctx);
            }
        }
    };
}
