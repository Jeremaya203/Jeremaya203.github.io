export async function queryGroupSum({ url, where, groupBy, field, outName = "v_sum", statisticType = "sum", arcRestQuery }) {
    const query = arcRestQuery || globalThis.__biofisicoChartDeps?.arcRestQuery;
    if (typeof query !== "function") {
        throw new Error("arcRestQuery no esta disponible para graficos biofisicos");
    }
    const js = await query(url, {
        f: "json",
        where,
        groupByFieldsForStatistics: groupBy,
        outStatistics: JSON.stringify([{
            statisticType,
            onStatisticField: field,
            outStatisticFieldName: outName
        }]),
        returnGeometry: "false"
    });

    return (js.features || []).map(f => f.attributes || {});
}

export async function queryTotalSum({ url, where, field, outName = "t_sum", arcRestQuery }) {
    const query = arcRestQuery || globalThis.__biofisicoChartDeps?.arcRestQuery;
    if (typeof query !== "function") {
        throw new Error("arcRestQuery no esta disponible para graficos biofisicos");
    }
    const js = await query(url, {
        f: "json",
        where,
        outStatistics: JSON.stringify([{
            statisticType: "sum",
            onStatisticField: field,
            outStatisticFieldName: outName
        }]),
        returnGeometry: "false"
    });

    return Number(js?.features?.[0]?.attributes?.[outName]) || 0;
}

export function mergePctWithDict(pctByCode, dictObj) {
    const temp = [];

    for (const [code, info] of Object.entries(dictObj || {})) {
        const pct = pctByCode.get(String(code));
        if (pct == null) continue;
        temp.push({
            code: String(code),
            label: info?.label || String(code),
            color: info?.color || "#999",
            pct
        });
    }

    for (const [code, pct] of pctByCode.entries()) {
        if (!temp.some(x => x.code === code)) {
            temp.push({ code, label: code, color: "#999", pct });
        }
    }

    return temp;
}

export function sortItems(items, desiredLabelOrder) {
    const arr = [...items];
    arr.sort((a, b) => {
        if (Array.isArray(desiredLabelOrder) && desiredLabelOrder.length) {
            const ia = desiredLabelOrder.indexOf(a.label);
            const ib = desiredLabelOrder.indexOf(b.label);
            const ra = ia === -1 ? 999 : ia;
            const rb = ib === -1 ? 999 : ib;
            if (ra !== rb) return ra - rb;
        }
        return String(a.label).localeCompare(String(b.label), "es");
    });
    return arr;
}

export function fenomenosMeta(type) {
    if (type === "inundaciones") {
        return {
            dict: typeof coloresInundaciones !== "undefined" ? coloresInundaciones : {},
            desiredLabelOrder: ["Baja", "Media", "Alta", "Muy alta", "Sin información"],
            chartKind: "bar"
        };
    }
    if (type === "sismica") {
        return {
            dict: typeof coloresSismica !== "undefined" ? coloresSismica : {},
            desiredLabelOrder: ["Débil", "Ligero", "Moderado", "Fuerte", "Muy fuerte", "Severo", "Violento", "Sin información"],
            chartKind: "bar"
        };
    }
    if (type === "remocion") {
        return {
            dict: typeof coloresRemocion !== "undefined" ? coloresRemocion : {},
            desiredLabelOrder: null,
            chartKind: "pie"
        };
    }
    if (type === "degradacion") {
        return {
            dict: typeof coloresDegradacion !== "undefined" ? coloresDegradacion : {},
            desiredLabelOrder: null,
            chartKind: "bar"
        };
    }
    return { dict: {}, desiredLabelOrder: null, chartKind: "bar" };
}

export function fenomenosTitle(type, depName) {
    if (type === "inundaciones") return `Porcentaje de susceptibilidad a inundaciones en el departamento de ${depName}`;
    if (type === "sismica") return `Distribución de la intensidad sísmica esperada en el departamento de ${depName}`;
    return `Distribución (%) en el departamento de ${depName}`;
}

export const clasesDegradacion = {
    "19203": "Laminar",
    "19204": "Laminar y surcos",
    "19205": "Terraceo y laminar",
    "19207": "Surcos y cárcavas",
    "19208": "Sin evidencia",
    "19209": "Sin evidencia"
};

export const ORDEN_DEGRADACION = {
    "Ligera": 1,
    "Moderada": 2,
    "Severa": 3,
    "Muy severa": 4,
    "No suelo": 5,
    "Sin evidencia": 6
};

export const ORDEN_SISMICA = {
    "Débil": 1,
    "Ligero": 2,
    "Moderado": 3,
    "Fuerte": 4,
    "Muy fuerte": 5,
    "Violento": 6
};
