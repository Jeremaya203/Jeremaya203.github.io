export const CLIMATE_STACKED_TYPES = ["temp", "precip", "temp_cc", "precip_cc"];

export function getClimateDict(climaType, deps = {}) {
    if (climaType === "temp") return deps.temperatureColors || globalThis.temperatureColors || {};
    if (climaType === "precip") return deps.precipitationColors || globalThis.precipitationColors || {};
    if (climaType === "temp_cc") return deps.temperatureChangeColors || globalThis.temperatureChangeColors || {};
    if (climaType === "precip_cc") return deps.precipitationChangeColors || globalThis.precipitationChangeColors || {};
    return {};
}

export function buildClimateStackedData({ features, config, dict, sortMonths }) {
    const periodField = config.periodField;
    const rangeField = config.labelField;
    const valueField = config.valueField;

    const matrix = {};
    const periodsSet = new Set();
    const rangesSet = new Set();

    for (const feature of features || []) {
        const attrs = feature.attributes || {};
        const period = String(attrs[periodField] ?? "").trim();
        const rangeCode = String(attrs[rangeField] ?? "").trim();
        const value = Number(attrs[valueField]) || 0;

        if (!period || !rangeCode || value <= 0) continue;

        periodsSet.add(period);
        rangesSet.add(rangeCode);

        matrix[rangeCode] = matrix[rangeCode] || {};
        matrix[rangeCode][period] = (matrix[rangeCode][period] || 0) + value;
    }

    const sortPeriods = typeof sortMonths === "function"
        ? sortMonths
        : (periods) => [...periods].sort();

    const periods = sortPeriods(Array.from(periodsSet));

    const rangesFromDict = Object.keys(dict || {})
        .map(String)
        .filter(code => rangesSet.has(code));

    const extras = Array.from(rangesSet)
        .map(String)
        .filter(code => !rangesFromDict.includes(code));

    const ranges = [...rangesFromDict, ...extras];

    for (const period of periods) {
        let total = 0;
        for (const rangeCode of ranges) {
            total += Number(matrix?.[rangeCode]?.[period]) || 0;
        }

        if (total > 0) {
            const factor = 100 / total;
            for (const rangeCode of ranges) {
                matrix[rangeCode][period] = (Number(matrix?.[rangeCode]?.[period]) || 0) * factor;
            }
        }
    }

    const orderedLabels = ranges.map(code => dict?.[code]?.label || code);
    const orderedColors = ranges.map(code => dict?.[code]?.color || "#999");

    return { matrix, periods, ranges, orderedLabels, orderedColors };
}

export function createClimateDatasets({ ranges, periods, matrix, dict, selectedPeriod = null }) {
    return ranges.map(rangeCode => {
        const info = dict?.[rangeCode];
        return {
            label: info ? info.label : rangeCode,
            data: selectedPeriod
                ? [Number(matrix?.[rangeCode]?.[selectedPeriod]) || 0]
                : periods.map(period => Number(matrix?.[rangeCode]?.[period]) || 0),
            backgroundColor: info?.color || "#999",
            rangeCode
        };
    });
}

export function getActiveClimateRanges({ ranges, periods, matrix, selectedPeriod = null }) {
    return (ranges || []).filter(rangeCode => {
        if (selectedPeriod) {
            return Number(matrix?.[rangeCode]?.[selectedPeriod]) > 0;
        }

        return (periods || []).some(period => Number(matrix?.[rangeCode]?.[period]) > 0);
    });
}

export function buildClimateLegendItems({ ranges, dict }) {
    return (ranges || []).map(code => ({
        code,
        label: dict?.[code]?.label || code,
        color: dict?.[code]?.color || "#999"
    }));
}

export function climateStackedWhen(climaType) {
    return (ctx) =>
        ctx.config?.isClima &&
        ctx.config?.isStacked &&
        ctx.config?.periodField &&
        ctx.config?.climaType === climaType;
}

export async function runClimateStackedHandler(ctx, deps = {}) {
    const layer = ctx.layer;
    if (!layer || layer.destroyed) return;

    const q = layer.createQuery();
    q.where = ctx.whereBase || "1=1";
    q.outFields = ctx.config.outFields;
    q.returnGeometry = false;

    const res = await (ctx.queryFeatures || ctx.cachedQueryFeatures || ((targetLayer, targetQuery) => targetLayer.queryFeatures(targetQuery)))(layer, q);
    if (!res.features?.length) {
        ctx.destroyChart();
        ctx.updateLegend([], []);
        return;
    }

    const firstAttrs = res.features[0].attributes || {};
    let mpnombre = firstAttrs.mpnombre;
    let dpnombre = firstAttrs.dpnombre;

    if ((!mpnombre || !isNaN(mpnombre)) && ctx.currentMunicipalityId) {
        mpnombre = ctx.municipalityNames?.[ctx.currentMunicipalityId] || ctx.currentMunicipalityId;
    }

    if ((!dpnombre || !isNaN(dpnombre)) && ctx.currentMunicipalityId) {
        const dpCode = String(ctx.currentMunicipalityId).substring(0, 2);
        dpnombre = ctx.departmentNames?.[dpCode] || dpCode;
    }

    ctx.updateChartTitle(ctx.config, mpnombre, dpnombre);

    const dict = getClimateDict(ctx.config.climaType, deps);
    const { matrix, periods, ranges } = buildClimateStackedData({
        features: res.features,
        config: ctx.config,
        dict,
        sortMonths: deps.sortMonths
    });

    let safeIndex = deps.getTimeSliderIndex?.() ?? 0;
    if (safeIndex >= periods.length + 1) safeIndex = 0;

    const sliderKey = [
        ctx.config.id,
        ctx.territoryLevel || "",
        ctx.currentDepartmentId || "",
        ctx.currentMunicipalityId || ""
    ].join("|");

    deps.showTimeSlider?.(periods, safeIndex, sliderKey);

    const timeSliderTouched = deps.getTimeSliderTouched?.() || false;
    if (!timeSliderTouched) {
        const activeRanges = getActiveClimateRanges({ ranges, periods, matrix });
        const legendItems = buildClimateLegendItems({ ranges: activeRanges, dict });
        const datasets = createClimateDatasets({ ranges: activeRanges, periods, matrix, dict });
        ctx.createChart(periods, [], [], "bar", true, datasets);
        ctx.updateLegend(
            legendItems.map(item => item.label),
            legendItems.map(item => item.color),
            legendItems.map(item => item.code)
        );
        return;
    }

    const timeSliderPeriods = deps.getTimeSliderPeriods?.() || [];
    const timeSliderIndex = deps.getTimeSliderIndex?.() ?? 0;
    const selectedPeriod = timeSliderPeriods[timeSliderIndex] || "Todos";

    if (selectedPeriod === "Todos") {
        const baseWhereStable = ctx.getWhereBase?.() || "1=1";
        const activeLayer = ctx.getLayerGlobal?.();

        if (activeLayer?.definitionExpression !== baseWhereStable) {
            ctx.applyWhereToActiveLayers?.(baseWhereStable);
        }

        const activeRanges = getActiveClimateRanges({ ranges, periods, matrix });
        const legendItems = buildClimateLegendItems({ ranges: activeRanges, dict });
        const datasets = createClimateDatasets({ ranges: activeRanges, periods, matrix, dict });
        ctx.createChart(periods, [], [], "bar", true, datasets);
        ctx.updateLegend(
            legendItems.map(item => item.label),
            legendItems.map(item => item.color),
            legendItems.map(item => item.code)
        );
        return;
    }

    const activeRanges = getActiveClimateRanges({ ranges, periods, matrix, selectedPeriod });
    const legendItems = buildClimateLegendItems({ ranges: activeRanges, dict });
    const datasets = createClimateDatasets({ ranges: activeRanges, periods, matrix, dict, selectedPeriod });
    const selectedPeriodSafe = String(selectedPeriod).replace(/'/g, "''");
    const baseWhereStable = ctx.getWhereBase?.() || "1=1";
    const periodWhere = `${baseWhereStable} AND ${ctx.config.periodField} = '${selectedPeriodSafe}'`;
    const activeLayer = ctx.getLayerGlobal?.();

    if (activeLayer?.definitionExpression !== periodWhere) {
        ctx.applyWhereToActiveLayers?.(periodWhere);
    }

    ctx.createChart([selectedPeriod], [], [], "bar", true, datasets);
    ctx.updateLegend(
        legendItems.map(item => item.label),
        legendItems.map(item => item.color),
        legendItems.map(item => item.code)
    );
}
