const DEFAULT_SETTLEMENT_SYMBOLS = {
    "14091": {
        label: "Rural",
        color: [46, 125, 50, 230],
        style: "diagonal-cross"
    },
    "14092": {
        label: "Urbano",
        color: [239, 138, 12, 230],
        style: "vertical"
    }
};

const DEFAULT_OUTLINE = {
    type: "simple-line",
    style: "solid",
    color: [85, 85, 85, 115],
    width: 0.65
};

function hexToColor(hex, alpha = 230) {
    const clean = String(hex || "").replace("#", "").trim();
    if (!/^[0-9a-f]{6}$/i.test(clean)) return null;
    return [
        parseInt(clean.slice(0, 2), 16),
        parseInt(clean.slice(2, 4), 16),
        parseInt(clean.slice(4, 6), 16),
        alpha
    ];
}

function symbolConfigForCode(code, chartConfig = {}) {
    const defaults = DEFAULT_SETTLEMENT_SYMBOLS[String(code)] || {};
    const configuredColor = chartConfig?.settlementMapColors?.[String(code)];
    const configuredStyle = chartConfig?.settlementMapStyles?.[String(code)];
    return {
        label: chartConfig?.settlementLabels?.[String(code)] || defaults.label || String(code),
        color: hexToColor(configuredColor) || defaults.color || [148, 163, 184, 230],
        style: configuredStyle || defaults.style || "vertical"
    };
}

function outlineForColor(color) {
    return {
        ...DEFAULT_OUTLINE,
        color: Array.isArray(color)
            ? [color[0], color[1], color[2], 255]
            : DEFAULT_OUTLINE.color
    };
}

function buildOpacityStops(rangeLabels = {}) {
    const codes = Object.keys(rangeLabels)
        .map(Number)
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
    const values = codes.length ? codes : [1, 7];
    const min = values[0];
    const max = values[values.length - 1];

    if (min === max) {
        return [{ value: min, opacity: 0.65 }];
    }

    return values.map(value => {
        const ratio = (value - min) / (max - min);
        return {
            value,
            opacity: Number((0.28 + ratio * 0.48).toFixed(2))
        };
    });
}

export function buildPublicServicesSettlementRenderer(chartConfig = {}) {
    const settlementField = chartConfig?.settlementField || chartConfig?.mapInteractionField || "spsasentam";
    const rangeField = chartConfig?.mapRenderer?.rangeField
        || chartConfig?.requiredFields?.sewer?.name
        || "spsralcantarillado";
    const settlementCodes = Object.keys(chartConfig?.settlementLabels || DEFAULT_SETTLEMENT_SYMBOLS);

    return {
        type: "unique-value",
        field: settlementField,
        legendOptions: { title: "Asentamiento" },
        uniqueValueInfos: settlementCodes.map(code => {
            const symbolConfig = symbolConfigForCode(code, chartConfig);
            return {
                value: code,
                label: symbolConfig.label,
                symbol: {
                    type: "simple-fill",
                    style: symbolConfig.style,
                    color: symbolConfig.color,
                    outline: outlineForColor(symbolConfig.color)
                }
            };
        }),
        defaultSymbol: {
            type: "simple-fill",
            style: "none",
            color: [0, 0, 0, 0],
            outline: DEFAULT_OUTLINE
        },
        visualVariables: [{
            type: "opacity",
            field: rangeField,
            stops: buildOpacityStops(chartConfig?.rangeLabels)
        }]
    };
}
