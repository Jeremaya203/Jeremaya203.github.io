export function defaultBarOptions({ indexAxis = "y", xTitle, tooltipSuffix = "", overrides = {} } = {}) {
    return deepMerge({
        responsive: true,
        maintainAspectRatio: false,
        indexAxis,
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    label: function (context) {
                        return `${context.raw}${tooltipSuffix}`;
                    }
                }
            }
        },
        scales: {
            x: {
                beginAtZero: true,
                title: xTitle ? { display: true, text: xTitle } : undefined
            },
            y: {
                ticks: { autoSkip: false, font: { size: 10 } }
            }
        }
    }, overrides);
}

function deepMerge(target, source) {
    const out = { ...target };
    for (const key of Object.keys(source)) {
        if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key]) && target[key] && typeof target[key] === "object") {
            out[key] = deepMerge(target[key], source[key]);
        } else {
            out[key] = source[key];
        }
    }
    return out;
}

export function buildDataset(data, colors, borderAlpha = 0.1) {
    return {
        data,
        backgroundColor: colors,
        borderColor: colors.map(() => `rgba(0,0,0,${borderAlpha})`),
        borderWidth: 1
    };
}
