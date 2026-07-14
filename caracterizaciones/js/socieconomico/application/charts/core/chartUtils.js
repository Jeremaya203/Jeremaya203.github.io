import { toNum } from "../../utils/shared.js?v=pib-number-parser-20260506";

export function getSqlValue(value) {
    return String(value ?? "").replace(/'/g, "''");
}

export function getChartFields(chartConfig) {
    return [
        ...(chartConfig?.fields || []),
        chartConfig?.xAxis?.field,
        chartConfig?.yAxis?.field,
        chartConfig?.filter?.departmentField,
        chartConfig?.filter?.municipalityField,
        chartConfig?.mapInteractionField,
        ...(chartConfig?.titleFields || []),
        ...(chartConfig?.tooltipFields || [])
    ].filter(Boolean);
}

export function getChartBaseWhere({
    chartConfig,
    whereBase,
    filtroNivel,
    deptoActual,
    diccionarioDepartamentos = {}
}) {
    if (chartConfig?.filter?.scope === "allDepartments") return "1=1";
    if (chartConfig?.filter?.requiredLevel && filtroNivel !== chartConfig.filter.requiredLevel) return "1=0";

    const departmentField = chartConfig?.filter?.departmentField;
    const municipalityField = chartConfig?.filter?.municipalityField;
    if (
        municipalityField &&
        whereBase &&
        String(whereBase).includes(municipalityField)
    ) {
        return whereBase;
    }

    if (
        departmentField &&
        whereBase &&
        String(whereBase).includes(departmentField)
    ) {
        return whereBase;
    }

    if ((filtroNivel === "DEPTO" || filtroNivel === "MUNI") && deptoActual) {
        const departmentName = chartConfig?.filter?.valueSource === "code"
            ? deptoActual
            : (diccionarioDepartamentos?.[deptoActual] || deptoActual);
        if (departmentField && departmentName) return `${departmentField} = '${getSqlValue(departmentName)}'`;
    }

    return "1=1";
}

export function normalizeChartLabel(value) {
    return String(value ?? "")
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
}

export function findChartRowLabel(value, rows = []) {
    const normalized = normalizeChartLabel(value);
    if (!normalized) return "";
    const match = rows.find(row =>
        normalizeChartLabel(row.label) === normalized ||
        normalizeChartLabel(row.rawLabel) === normalized
    );
    return match?.label || String(value ?? "").trim();
}

export function getDepartmentDisplayLabel(value, diccionarioDepartamentos = {}) {
    const raw = String(value ?? "").trim();
    return diccionarioDepartamentos?.[raw] || raw;
}

export function getCurrentDepartmentChartLabel(rows = [], deptoActual, diccionarioDepartamentos = {}) {
    if (!deptoActual) return "";
    const departmentName = diccionarioDepartamentos?.[deptoActual] || deptoActual;
    return findChartRowLabel(departmentName, rows) || findChartRowLabel(deptoActual, rows);
}

export function groupChartFeatures(features, chartConfig, { getDisplayLabel } = {}) {
    const xField = chartConfig.xAxis?.field;
    const yField = chartConfig.yAxis?.field;
    const grouped = new Map();
    const shouldSum = chartConfig.aggregation === "sum";
    const shouldCount = chartConfig.aggregation === "count";

    (features || []).forEach(feature => {
        const attrs = feature.attributes || {};
        const rawLabel = String(attrs[xField] ?? "").trim();
        const value = toNum(attrs[yField]);
        if (!rawLabel) return;
        if (!shouldCount && !Number.isFinite(value)) return;
        if (!grouped.has(rawLabel)) {
            grouped.set(rawLabel, {
                rawLabel,
                label: getDisplayLabel ? getDisplayLabel(rawLabel, attrs) : rawLabel,
                value: shouldSum || shouldCount ? 0 : value,
                attributes: attrs
            });
        }
        if (shouldSum) {
            const row = grouped.get(rawLabel);
            row.value += value;
            row.attributes = yField && yField !== xField
                ? { ...row.attributes, [yField]: row.value }
                : { ...row.attributes, __chartAggregatedValue: row.value };
        } else if (shouldCount) {
            const row = grouped.get(rawLabel);
            row.value += 1;
            row.attributes = yField && yField !== xField
                ? { ...row.attributes, [yField]: row.value }
                : { ...row.attributes, __chartAggregatedValue: row.value };
        }
    });

    return [...grouped.values()].sort((a, b) => a.label.localeCompare(b.label, "es"));
}

export function buildChartRowsByLabel(rows = []) {
    return new Map(rows.map(row => [row.label, row]));
}
