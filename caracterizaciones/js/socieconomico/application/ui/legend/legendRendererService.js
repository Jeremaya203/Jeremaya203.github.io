import { colorToCss, getChartSymbolLookups, getRendererLegendItems, getRendererVisualForValue, normalizeRendererType } from "../../charts/core/chartSymbolUtils.js?v=connectivity-line-style-legend-20260602";

export function buildLegendFromRenderer(source, options = {}) {
    const renderer = source?.renderer || source;
    if (!renderer) return null;

    const rendererType = normalizeRendererType(renderer);

    if (rendererType === "unique-value") {
        return buildUniqueValueLegend(renderer, options.chartConfig);
    }

    if (rendererType === "class-breaks") {
        return buildClassBreaksLegend(renderer, options.chartConfig);
    }

    if (rendererType === "simple") {
        return {
            labels: ["Cobertura"],
            colors: [colorToCss(renderer.symbol?.color || renderer.symbol?.outline?.color) || "#999"],
            codes: ["0"]
        };
    }

    return null;
}

function buildUniqueValueLegend(renderer, chartConfig) {
    return legendItemsToData(getRendererLegendItems(renderer, chartConfig), chartConfig);
}

function buildClassBreaksLegend(renderer, chartConfig) {
    return legendItemsToData(getRendererLegendItems(renderer, chartConfig), chartConfig);
}

function legendItemsToData(items, chartConfig = {}) {
    const dedupeByLabel = Boolean(chartConfig?.dedupeLegendByLabel);
    const seen = new Set();
    const labels = [];
    const colors = [];
    const codes = [];
    const symbols = [];
    const codeGroups = {};

    for (const item of items || []) {
        const code = String(item.code ?? "").trim();
        const label = String(item.label ?? "").trim();
        const color = item.color || "#999";
        const key = dedupeByLabel
            ? (label || code).toLowerCase()
            : `${code}||${label}`;
        if (seen.has(key)) {
            if (dedupeByLabel) {
                const existingIndex = labels.findIndex((currentLabel, index) =>
                    String(currentLabel || codes[index] || "").trim().toLowerCase() === key
                );
                const existingCode = codes[existingIndex];
                if (existingCode && code) {
                    codeGroups[existingCode] = [...new Set([...(codeGroups[existingCode] || [existingCode]), code])];
                }
            }
            continue;
        }
        seen.add(key);

        labels.push(label);
        colors.push(color);
        codes.push(code);
        symbols.push(item.symbol || null);
        if (dedupeByLabel && code) codeGroups[code] = [code];
    }

    return {
        labels,
        colors,
        codes,
        symbols,
        codeGroups: Object.keys(codeGroups).length ? codeGroups : null
    };
}

async function queryExistingCodes(layer, field, where) {
    if (!layer || layer.destroyed || !field) return [];

    const values = new Set();
    const query = layer.createQuery ? layer.createQuery() : {};
    query.where = where || layer.definitionExpression || "1=1";
    query.outFields = [field];
    query.returnGeometry = false;
    query.returnDistinctValues = true;
    query.num = 2000;

    try {
        const result = await layer.queryFeatures(query);
        (result?.features || []).forEach(feature => {
            const value = feature.attributes?.[field];
            if (value != null && String(value).trim() !== "") values.add(String(value).trim());
        });
    } catch {
        const fallbackQuery = layer.createQuery ? layer.createQuery() : {};
        fallbackQuery.where = query.where;
        fallbackQuery.outFields = [field];
        fallbackQuery.returnGeometry = false;
        fallbackQuery.num = 2000;

        try {
            const result = await layer.queryFeatures(fallbackQuery);
            (result?.features || []).forEach(feature => {
                const value = feature.attributes?.[field];
                if (value != null && String(value).trim() !== "") values.add(String(value).trim());
            });
        } catch {}
    }

    return [...values];
}

export async function buildFilteredLegendFromLayers({ layers = [], field, where, chartConfig = {} } = {}) {
    const targetLayers = (layers || []).filter(layer => layer && !layer.destroyed);
    if (!targetLayers.length || !field) return null;

    const existingCodes = new Set();
    const rendererItems = [];
    const urls = [];

    await Promise.all(targetLayers.map(async layer => {
        (await queryExistingCodes(layer, field, where)).forEach(code => existingCodes.add(code));
        rendererItems.push(...getRendererLegendItems(layer.renderer, chartConfig));
        if (layer?.__sourceUrl || layer?.url) urls.push(layer.__sourceUrl || layer.url);
    }));

    const globalLegendOrder = chartConfig?.useGlobalLegendOrder === false ? [] : (window.__chartLegendOrder || []);
    const order = (chartConfig?.legendOrder || globalLegendOrder || [])
        .map(item => ({
            code: String(item?.code ?? item?.rawLabel ?? item?.label ?? "").trim(),
            label: item?.label,
            color: item?.color
        }))
        .filter(item => item.code);

    if (!existingCodes.size) {
        return order.length ? legendItemsToData(order, chartConfig) : { labels: [], colors: [], codes: [] };
    }

    const symbolLookups = await getChartSymbolLookups({
        layers: targetLayers,
        urls: [...new Set(urls)],
        chartConfig: {
            ...chartConfig,
            colorsFromRenderer: true,
            labelsFromRenderer: Boolean(chartConfig?.labelsFromRenderer)
        }
    });

    const itemByCode = new Map();
    rendererItems.forEach(item => {
        if (item?.code && !itemByCode.has(String(item.code))) {
            itemByCode.set(String(item.code), item);
        }
    });

    const filteredOrder = order.filter(item => existingCodes.has(item.code));

    const orderedCodes = filteredOrder.length
        ? filteredOrder.map(item => item.code)
        : [...existingCodes];

    const items = orderedCodes.map(code => {
        const orderedItem = filteredOrder.find(item => item.code === code);
        const symbolItem = itemByCode.get(code);
        const rendererVisual = targetLayers[0]?.renderer
            ? getRendererVisualForValue(targetLayers[0].renderer, code, chartConfig)
            : null;
        return {
            code,
            label: orderedItem?.label ||
                rendererVisual?.label ||
                (chartConfig?.labelsFromRenderer ? symbolLookups.labelByValue.get(code) || symbolItem?.label : null) ||
                code,
            color: orderedItem?.color ||
                rendererVisual?.color ||
                symbolLookups.colorByValue.get(code) ||
                symbolItem?.color ||
                symbolLookups.defaultColor ||
                "#999",
            symbol: rendererVisual?.symbol || symbolItem?.symbol || null
        };
    });

    return legendItemsToData(items, chartConfig);
}
