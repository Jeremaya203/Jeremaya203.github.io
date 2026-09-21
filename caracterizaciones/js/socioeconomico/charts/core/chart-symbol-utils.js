export function colorToCss(color) {
    if (!color) return "";

    if (Array.isArray(color)) {
        const [r, g, b, a = 255] = color;
        return `rgba(${r}, ${g}, ${b}, ${Number(a) / 255})`;
    }

    if (typeof color === "object") {
        const r = color.r ?? color.red;
        const g = color.g ?? color.green;
        const b = color.b ?? color.blue;
        const alpha = color.a ?? color.alpha ?? 1;

        if ([r, g, b].every(value => value != null && Number.isFinite(Number(value)))) {
            const cssAlpha = Number(alpha) > 1 ? Number(alpha) / 255 : Number(alpha);
            return `rgba(${Number(r)}, ${Number(g)}, ${Number(b)}, ${Math.max(0, Math.min(1, cssAlpha))})`;
        }
    }

    return "";
}

export function splitRendererLabel(label) {
    const parts = String(label || "").split(".");
    return parts.length > 1 ? parts.slice(1).join(".").trim() : String(label || "").trim();
}

function symbolColor(symbol) {
    if (!symbol) return "";

    const directColor = colorToCss(symbol.color || symbol.symbol?.color || symbol.outline?.color);
    if (directColor) return directColor;

    if (Array.isArray(symbol.layers)) {
        for (const layer of symbol.layers) {
            const layerColor = symbolColor(layer);
            if (layerColor) return layerColor;

            const materialColor = colorToCss(layer?.material?.color || layer?.materialColor);
            if (materialColor) return materialColor;
        }
    }

    if (Array.isArray(symbol.symbolLayers)) {
        for (const layer of symbol.symbolLayers) {
            const layerColor = symbolColor(layer);
            if (layerColor) return layerColor;
        }
    }

    return "";
}

function rendererInfos(renderer) {
    const uniqueValueInfos = renderer?.uniqueValueInfos || [];
    if (uniqueValueInfos.length) return uniqueValueInfos;

    const groupedInfos = renderer?.uniqueValueGroups?.flatMap(group => group.classes || []) || [];
    if (groupedInfos.length) return groupedInfos;

    const classBreakInfos = renderer?.classBreakInfos || [];
    if (classBreakInfos.length) return classBreakInfos;

    return [];
}

export function normalizeRendererType(renderer) {
    const type = String(renderer?.type || "").trim();
    if (type === "uniqueValue") return "unique-value";
    if (type === "classBreaks") return "class-breaks";
    return type;
}

function rendererDefaultColor(renderer) {
    return symbolColor(renderer?.symbol || renderer?.defaultSymbol) || "";
}

function rendererFieldNames(renderer) {
    return [
        renderer?.field,
        renderer?.field1,
        renderer?.field2,
        renderer?.field3
    ].map(value => String(value || "").trim()).filter(Boolean);
}

function resolveRendererInteractionIndex(renderer, chartConfig) {
    const targetField = String(
        chartConfig?.mapInteractionField ||
        chartConfig?.xAxis?.field ||
        ""
    ).trim().toLowerCase();
    const fieldNames = rendererFieldNames(renderer);
    if (!targetField || !fieldNames.length) return 0;

    const matchIndex = fieldNames.findIndex(field => field.toLowerCase() === targetField);
    return matchIndex >= 0 ? matchIndex : 0;
}

function rendererValueForInfo(info, renderer, chartConfig) {
    if (info.values?.[0]) {
        const values = Array.isArray(info.values[0]) ? info.values[0] : info.values;
        const interactionIndex = resolveRendererInteractionIndex(renderer, chartConfig);
        return String(values[interactionIndex] ?? values[0] ?? "").trim();
    }

    if (info.value != null) {
        const values = String(info.value).split(renderer?.fieldDelimiter || ",");
        const interactionIndex = resolveRendererInteractionIndex(renderer, chartConfig);
        return String(values[interactionIndex] ?? values[0] ?? info.value).trim();
    }

    if (info.minValue != null || info.maxValue != null) {
        return `${info.minValue ?? ""}-${info.maxValue ?? ""}`;
    }

    return "";
}

export function getRendererLegendItems(renderer, chartConfig = {}) {
    return rendererInfos(renderer).map(info => {
        const code = rendererValueForInfo(info, renderer, chartConfig);
        const label = splitRendererLabel(info.label) || code;
        const color = symbolColor(info.symbol);
        return { code, label, color, symbol: info.symbol || null };
    }).filter(item => item.code);
}

function normalizeRendererValue(value) {
    return String(value ?? "").trim().toLowerCase();
}

function findUniqueValueInfo(renderer, value, chartConfig = {}) {
    const normalizedValue = normalizeRendererValue(value);
    return rendererInfos(renderer).find(info =>
        normalizeRendererValue(rendererValueForInfo(info, renderer, chartConfig)) === normalizedValue
    ) || null;
}

function findClassBreakInfo(renderer, value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return null;

    const infos = rendererInfos(renderer);
    for (const info of infos) {
        const minValue = Number(info?.minValue);
        const maxValue = Number(info?.maxValue);
        if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) continue;
        if (numericValue >= minValue && numericValue <= maxValue) return info;
    }
    return null;
}

export function getRendererVisualForValue(renderer, value, chartConfig = {}) {
    if (!renderer || value == null || String(value).trim() === "") {
        return {
            code: String(value ?? "").trim(),
            label: "",
            color: rendererDefaultColor(renderer)
        };
    }

    let info = null;
    const rendererType = normalizeRendererType(renderer);
    if (rendererType === "unique-value") {
        info = findUniqueValueInfo(renderer, value, chartConfig);
    } else if (rendererType === "class-breaks") {
        info = findClassBreakInfo(renderer, value);
    }

    if (info) {
        return {
            code: rendererValueForInfo(info, renderer, chartConfig) || String(value).trim(),
            label: splitRendererLabel(info.label) || String(value).trim(),
            color: symbolColor(info.symbol) || rendererDefaultColor(renderer),
            symbol: info.symbol || null
        };
    }

    const firstLegendItem = getRendererLegendItems(renderer, chartConfig)[0] || null;
    return {
        code: String(value ?? "").trim(),
        label: firstLegendItem?.label || String(value ?? "").trim(),
        color: rendererDefaultColor(renderer) || firstLegendItem?.color || "",
        symbol: firstLegendItem?.symbol || renderer?.defaultSymbol || renderer?.symbol || null
    };
}

function mergeRenderer(renderer, chartConfig, lookups) {
    getRendererLegendItems(renderer, chartConfig).forEach(item => {
        if (chartConfig?.labelsFromRenderer && item.label && !lookups.labelByValue.has(item.code)) {
            lookups.labelByValue.set(item.code, item.label);
        }

        if (chartConfig?.colorsFromRenderer && item.color && !lookups.colorByValue.has(item.code)) {
            lookups.colorByValue.set(item.code, item.color);
        }
    });

    if (chartConfig?.colorsFromRenderer && !lookups.defaultColor) {
        const defaultColor = rendererDefaultColor(renderer);
        if (defaultColor) {
            lookups.defaultColor = defaultColor;
        }
    }
}

async function rendererFromUrl(url) {
    const response = await fetch(`${url}?f=json`);
    if (!response.ok) return null;
    const json = await response.json();
    return json.drawingInfo?.renderer || null;
}

export async function getChartSymbolLookups({ layers = [], urls = [], chartConfig } = {}) {
    const lookups = {
        labelByValue: new Map(),
        colorByValue: new Map(),
        defaultLabel: "",
        defaultColor: ""
    };

    if (!chartConfig?.colorsFromRenderer && !chartConfig?.labelsFromRenderer) return lookups;

    Object.entries(chartConfig?.categoryColors || {}).forEach(([code, color]) => {
        const normalizedCode = String(code || "").trim();
        const normalizedColor = String(color || "").trim();
        if (!normalizedCode || !normalizedColor) return;
        lookups.colorByValue.set(normalizedCode, normalizedColor);
        if (!lookups.defaultColor) {
            lookups.defaultColor = normalizedColor;
        }
    });

    (layers || []).forEach(layer => {
        if (layer?.renderer) mergeRenderer(layer.renderer, chartConfig, lookups);
    });

    const urlsMissingRenderer = (urls || []).filter(url =>
        !(layers || []).some(layer => String(layer?.__sourceUrl || layer?.url || "") === String(url) && layer?.renderer)
    );

    await Promise.all(urlsMissingRenderer.map(async url => {
        try {
            const renderer = await rendererFromUrl(url);
            if (renderer) mergeRenderer(renderer, chartConfig, lookups);
        } catch {
            // Missing renderer metadata should not block chart rendering.
        }
    }));

    if (chartConfig?.labelsFromRenderer && lookups.labelByValue.size === 1) {
        lookups.defaultLabel = lookups.labelByValue.values().next().value || "";
    }

    if (chartConfig?.colorsFromRenderer && !lookups.defaultColor && lookups.colorByValue.size === 1) {
        lookups.defaultColor = lookups.colorByValue.values().next().value || "";
    }

    return lookups;
}
