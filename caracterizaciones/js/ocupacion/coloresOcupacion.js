// =============================================================================
// coloresOcupacion.js
// Diccionarios de colores para el módulo de Procesos de Ocupación.
// Colores extraídos del renderer de ArcGIS MapServer (componenteocupacion).
// Patrón idéntico a coloresBiofisico.js
// =============================================================================

// ─── MapServer/11 ─────────────────────────────────────────────────────────────
// Densidad de población — campo renderer: denpobha (classBreaks, naturalBreaks)
// Colores del gradiente verde-pálido → violeta del renderer real
const clasesBreaksDensidad = [
    { max: 14.82267113, color: "rgba(198,214,178,1)", label: "0,000 - 14,82 hab/ha" },
    { max: 39.866406, color: "rgba(207,198,165,1)", label: "14,83 - 39,86 hab/ha" },
    { max: 67.759722, color: "rgba(204,161,153,1)", label: "39,87 - 67,75 hab/ha" },
    { max: 112.190705, color: "rgba(196,139,168,1)", label: "67,76 - 112,19 hab/ha" },
    { max: Infinity, color: "rgba(184,126,194,1)", label: "112,20 - 234,25 hab/ha" }
];

const densidadCabeceraCentroColors = ["#A80000", "#AF1831", "#B63162", "#BC4993", "#C362C4", "#CA7AF5"];
const densidadRuralColors = ["#EDFCD4", "#D4EECE", "#9FDAB8", "#D0BC94", "#C79430", "#A86600"];

const densidadNacionalBreaks = {
    urbano: [
        { max: 18.747347, label: "<= 18,74 (hab/ha)" },
        { max: 28.741165, label: "18,75 - 28,74 (hab/ha)" },
        { max: 46.512966, label: "28,75 - 46,51 (hab/ha)" },
        { max: 78.116194, label: "46,52 - 78,11 (hab/ha)" },
        { max: 134.315562, label: "78,12 - 134,31 (hab/ha)" },
        { max: 234.253743, label: "134,32 - 234,25 (hab/ha)" }
    ],
    rural: [
        { max: 0.054327, label: "<= 0,054 (hab/ha)" },
        { max: 0.065832, label: "0,055 - 0,065 (hab/ha)" },
        { max: 0.119879, label: "0,066 - 0,119 (hab/ha)" },
        { max: 0.373767, label: "0,120 - 0,373 (hab/ha)" },
        { max: 1.566432, label: "0,374 - 1,566 (hab/ha)" },
        { max: 7.169079, label: "1,566 - 7,169 (hab/ha)" }
    ]
};

const densidadDepartamentalBreaks = {
    "05": { urbano: [18.747347, 28.741165, 46.512966, 78.116194, 134.315562, 234.253743], rural: [0.096216, 0.115712, 0.195023, 0.517655, 1.830105, 7.169079] },
    "08": { urbano: [42.985, 63.877, 77.444, 91.011, 111.903, 144.075], rural: [0.037643, 0.067696, 0.110762, 0.172475, 0.260912, 0.387643] },
    "11": { urbano: [102.715854, 171.458128], rural: [0.105541] },
    "13": { urbano: [29.574405, 42.833066, 50.025479, 63.28414, 87.72546, 132.78115], rural: [0.021517, 0.03059, 0.045606, 0.070455, 0.111574, 0.179619] },
    "15": { urbano: [20.128684, 27.122914, 29.677026, 36.671256, 55.824393, 108.273721], rural: [0.12045, 0.198007, 0.297777, 0.42612, 0.591219, 0.803603] },
    "17": { urbano: [21.427445, 33.292696, 48.556119, 68.19094, 93.449113, 125.94115], rural: [0.083241, 0.165965, 0.284509, 0.454384, 0.697818, 1.04666] },
    "18": { urbano: [15.938077, 27.323394, 41.451863, 58.984415, 80.741219, 107.74006], rural: [0.012974, 0.023559, 0.033409, 0.042576, 0.051106, 0.059043] },
    "19": { urbano: [21.629339, 32.36612, 39.338388, 50.075169, 66.609022, 92.069942], rural: [0.101861, 0.220322, 0.372711, 0.568742, 0.820917, 1.145314] },
    "20": { urbano: [23.825659, 31.76246, 41.972337, 55.106291, 72.001769, 93.736061], rural: [0.029993, 0.035654, 0.048606, 0.078233, 0.146008, 0.301047] },
    "23": { urbano: [22.500377, 27.900446, 36.520784, 50.281761, 72.24894, 107.315994], rural: [0.083856, 0.160851, 0.302784, 0.564428, 1.046747, 1.935866] },
    "25": { urbano: [18.771937, 28.241923, 44.487094, 72.354676, 120.159784, 202.166476], rural: [0.174879, 0.24717, 0.395621, 0.700469, 1.326482, 2.612016] },
    "27": { urbano: [22.12455, 36.96526, 55.381658, 78.235261, 106.59516, 141.788029], rural: [0.02142, 0.030427, 0.034974, 0.043981, 0.061824, 0.097171] },
    "41": { urbano: [21.283738, 33.066005, 41.90146, 53.683727, 69.395633, 90.347797], rural: [0.07238, 0.103238, 0.156172, 0.246976, 0.402746, 0.66996] },
    "44": { urbano: [16.256999, 27.397088, 40.73272, 56.696607, 75.806737, 98.683187], rural: [0.041291, 0.063295, 0.103859, 0.178634, 0.316476, 0.391252] },
    "47": { urbano: [45.104711, 55.212931, 59.631684, 69.739904, 92.863199, 145.759427], rural: [0.01887, 0.026036, 0.038328, 0.059414, 0.095587, 0.157638] },
    "50": { urbano: [15.835123, 22.992415, 32.199535, 44.043545, 59.279643, 78.879313], rural: [0.012949, 0.017797, 0.028117, 0.050085, 0.09685, 0.196401] },
    "52": { urbano: [23.02222, 33.4665, 50.749873, 79.350694, 126.679822, 205.000872], rural: [0.073894, 0.144447, 0.265475, 0.473093, 0.829248, 1.44021] },
    "54": { urbano: [19.712699, 34.010685, 45.954687, 60.252673, 77.368578, 97.857772], rural: [0.074102, 0.096425, 0.128414, 0.174254, 0.239944, 0.334079] },
    "63": { urbano: [32.898244, 52.747683, 67.106652, 77.493846, 85.007882, 95.395076], rural: [0.178454, 0.260468, 0.326559, 0.379818, 0.445908, 0.527923] },
    "66": { urbano: [35.853385, 43.696932, 54.936833, 71.043752, 94.12517, 127.201132], rural: [0.160896, 0.218769, 0.321683, 0.504693, 0.830135, 1.408863] },
    "68": { urbano: [25.352167, 29.545214, 30.406266, 34.599313, 55.018089, 154.450899], rural: [0.087908, 0.117073, 0.176966, 0.299956, 0.552521, 1.071168] },
    "70": { urbano: [18.483671, 26.498288, 37.577473, 52.89303, 74.064831, 103.332141], rural: [0.068847, 0.08191, 0.110737, 0.174351, 0.314729, 0.624507] },
    "73": { urbano: [15.823443, 24.212448, 37.1309, 57.024366, 87.658844, 134.833687], rural: [0.05889, 0.076646, 0.117261, 0.210173, 0.422716, 0.908924] },
    "76": { urbano: [33.203194, 42.023302, 44.713901, 53.534009, 82.447393, 177.228969], rural: [0.076391, 0.105449, 0.148616, 0.212741, 0.307998, 0.449504] },
    "81": { urbano: [10.32148, 17.182376, 25.105215, 34.254366, 44.819642, 57.020232], rural: [0.009915, 0.021031, 0.036398, 0.05764, 0.087005, 0.108247] },
    "85": { urbano: [7.956305, 13.052026, 19.607146, 28.039632, 38.887157, 52.84138], rural: [0.012579, 0.020798, 0.030288, 0.041247, 0.053902, 0.068517] },
    "86": { urbano: [15.647515, 24.422705, 33.519357, 42.949245, 52.724578, 62.85801], rural: [0.040426, 0.060024, 0.092455, 0.146124, 0.234935, 0.381901] },
    "88": { urbano: [10.658302, 15.038046, 24.587762, 45.410225], rural: [0.482388, 0.882371] },
    "91": { urbano: [6.503309, 9.771034, 15.178522, 24.126926, 29.534414, 32.80214], rural: [0.000395, 0.000665, 0.001308, 0.002832, 0.006445, 0.015013] },
    "94": { urbano: [8.410172, 15.686073, 22.961973, 30.237874, 37.513775, 44.789676], rural: [0.000926, 0.001205, 0.001719, 0.002667, 0.004413, 0.005361] },
    "95": { urbano: [10.552383, 12.152217, 15.946021, 24.942549, 46.276678, 55.273206], rural: [0.003026, 0.004283, 0.005541, 0.006799] },
    "97": { urbano: [6.175196, 10.786333, 16.11119, 20.722327, 24.715407, 28.173272], rural: [0.00133, 0.001684, 0.00236, 0.003652, 0.006121, 0.010838] },
    "99": { urbano: [5.112986, 6.661191, 9.13265, 13.077935, 19.375945, 29.429701], rural: [0.003049, 0.004022, 0.004995, 0.005968] }
};

function densidadFormatNumber(value, decimals = 3) {
    return Number(value).toLocaleString("es-CO", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function densidadBuildBreaksFromUpperValues(values = []) {
    return values.map((max, index) => {
        const previous = index > 0 ? values[index - 1] : null;
        const decimals = max < 0.01 ? 4 : max < 1 ? 3 : 3;
        return {
            max,
            label: index === 0
                ? `<= ${densidadFormatNumber(max, decimals)} (hab/ha)`
                : `${densidadFormatNumber(previous, decimals)} - ${densidadFormatNumber(max, decimals)} (hab/ha)`
        };
    });
}

function resolveDensidadPaletteColor(palette, index, breakCount, { alignTail = false } = {}) {
    const colors = Array.isArray(palette) && palette.length ? palette : ["#999999"];
    const count = Math.max(1, Number(breakCount) || colors.length);
    const offset = alignTail && count < colors.length ? colors.length - count : 0;
    return colors[offset + index] || colors[colors.length - 1];
}

function getDensidadBreaksForDepto(deptoCode) {
    const normalized = String(deptoCode || "").padStart(2, "0");
    const spec = densidadDepartamentalBreaks[normalized];
    if (!spec) return densidadNacionalBreaks;

    const breaks = {
        urbano: densidadBuildBreaksFromUpperValues(spec.urbano || []),
        rural: densidadBuildBreaksFromUpperValues(spec.rural || [])
    };

    if (normalized === "11") {
        if (breaks.urbano[0]) {
            breaks.urbano[0].min = 33.973;
            breaks.urbano[0].label = "33,973 - 102,715 (hab/ha)";
        }
        if (breaks.urbano[1]) {
            breaks.urbano[1].label = "102,715 - 171,458 (hab/ha)";
        }
        if (breaks.rural[0]) breaks.rural[0].label = "0,105 (hab/ha)";
    }

    return breaks;
}

function densidadGetArcadeBreakData(breakItems = []) {
    const limites = breakItems.map(item => Number(item.max));
    const mins = breakItems.map((item, index) => item.min != null
        ? Number(item.min)
        : (index > 0 ? Number(breakItems[index - 1].max) : 0));
    const inclusive = breakItems.map((item, index) => (item.min != null || index === 0) ? 1 : 0);
    return { limites, mins, inclusive };
}

function densidadResolveBreakIndex(breakItems = [], value) {
    const numericValue = Number(value) || 0;
    for (let index = 0; index < breakItems.length; index++) {
        const item = breakItems[index];
        const minBound = item.min != null
            ? Number(item.min)
            : (index > 0 ? Number(breakItems[index - 1].max) : 0);
        const matchesMin = (item.min != null || index === 0)
            ? numericValue >= minBound
            : numericValue > minBound;
        if (matchesMin && numericValue <= Number(item.max)) return index;
    }
    return Math.max(0, breakItems.length - 1);
}

function buildDensidadZoneClassExpression(limitesName, minsName, inclusiveName, prefixExpr) {
    return `
            for (var i = 0; i < Count(${limitesName}); i++) {
                if (IIF(${inclusiveName}[i] == 1, densidad >= ${minsName}[i], densidad > ${minsName}[i]) && densidad <= ${limitesName}[i]) {
                    return ${prefixExpr} + Text(i + 1);
                }
            }
            return ${prefixExpr} + Text(Count(${limitesName}));
        `;
}

function buildDensidadPoblacionalRenderer(deptoCode = null) {
    const breaks = deptoCode ? getDensidadBreaksForDepto(deptoCode) : densidadNacionalBreaks;
    const urbanArcade = densidadGetArcadeBreakData(breaks.urbano || []);
    const ruralArcade = densidadGetArcadeBreakData(breaks.rural || []);
    const infos = [];

    const urbanoCount = (breaks.urbano || []).length;
    const ruralCount = (breaks.rural || []).length;

    (breaks.urbano || []).forEach((item, index) => {
        const color = resolveDensidadPaletteColor(densidadCabeceraCentroColors, index, urbanoCount, { alignTail: true });
        infos.push({
            value: `C${index + 1}`,
            label: `Cabecera municipal ${item.label}`,
            symbol: {
                type: "simple-fill",
                color,
                outline: { color: "#ffffff", width: 0.35 }
            }
        });
        infos.push({
            value: `P${index + 1}`,
            label: `Centros poblados ${item.label}`,
            symbol: {
                type: "simple-fill",
                color,
                outline: { color: "#ffffff", width: 0.35 }
            }
        });
    });

    (breaks.rural || []).forEach((item, index) => {
        infos.push({
            value: `R${index + 1}`,
            label: `Rural disperso ${item.label}`,
            symbol: {
                type: "simple-fill",
                color: resolveDensidadPaletteColor(densidadRuralColors, index, ruralCount),
                outline: { color: "#ffffff", width: 0.35 }
            }
        });
    });

    return {
        type: "unique-value",
        valueExpressionTitle: "Densidad poblacional (hab/ha)",
        valueExpression: `
            var zona = Number($feature.tzn);
            var densidad = Number($feature.denpobha);
            var urbanLimites = ${JSON.stringify(urbanArcade.limites)};
            var urbanMins = ${JSON.stringify(urbanArcade.mins)};
            var urbanInclusive = ${JSON.stringify(urbanArcade.inclusive)};
            var ruralLimites = ${JSON.stringify(ruralArcade.limites)};
            var ruralMins = ${JSON.stringify(ruralArcade.mins)};
            var ruralInclusive = ${JSON.stringify(ruralArcade.inclusive)};

            if (zona == 3) {${buildDensidadZoneClassExpression("ruralLimites", "ruralMins", "ruralInclusive", '"R"')}
            }
            var prefijo = IIF(zona == 2, "P", "C");
            ${buildDensidadZoneClassExpression("urbanLimites", "urbanMins", "urbanInclusive", "prefijo")}
        `,
        uniqueValueInfos: infos,
        defaultSymbol: { type: "simple-fill", color: [180, 180, 180, 0.35], outline: { color: "#ffffff", width: 0.35 } },
        defaultLabel: "Sin rango de densidad"
    };
}

function getDensidadColorByZona(value, tzn = 1, deptoCode = null) {
    const tipo = Number(tzn) === 3 ? "rural" : "urbano";
    const breaks = deptoCode ? getDensidadBreaksForDepto(deptoCode) : densidadNacionalBreaks;
    const palette = tipo === "rural" ? densidadRuralColors : densidadCabeceraCentroColors;
    const groupBreaks = breaks[tipo] || [];
    const resolvedIndex = densidadResolveBreakIndex(groupBreaks, value);
    return resolveDensidadPaletteColor(
        palette,
        resolvedIndex,
        groupBreaks.length,
        { alignTail: tipo === "urbano" }
    );
}

function getDensidadLegendItems(deptoCode = null) {
    const breaks = deptoCode ? getDensidadBreaksForDepto(deptoCode) : densidadNacionalBreaks;
    const items = [];
    const pushItems = (group, prefix, palette, groupTitle, zoneFilter, alignTail = false) => {
        const groupBreaks = breaks[group] || [];
        groupBreaks.forEach((item, index) => {
            const entry = {
                label: item.label,
                color: resolveDensidadPaletteColor(palette, index, groupBreaks.length, { alignTail }),
                code: `${prefix}${index + 1}`,
                group: groupTitle,
                max: item.max,
                min: item.min != null ? item.min : (index === 0 ? null : breaks[group][index - 1].max),
                minInclusive: item.min != null
            };

            if (Array.isArray(zoneFilter)) {
                entry.tznValues = zoneFilter;
            } else {
                entry.tzn = zoneFilter;
            }

            items.push(entry);
        });
    };

    // Vista nacional y departamental: mismos subtítulos, rangos según el nivel territorial.
    pushItems(
        "urbano",
        "C",
        densidadCabeceraCentroColors,
        "Cabecera municipal",
        1,
        true
    );
    pushItems(
        "urbano",
        "P",
        densidadCabeceraCentroColors,
        "Centros poblados",
        2,
        true
    );
    pushItems("rural", "R", densidadRuralColors, "Rural disperso", 3, false);
    return items;
}

function buildDensidadLegendItemWhere(item) {
    const maxWhere = `denpobha <= ${Number(item.max)}`;
    let minWhere = "";
    if (item.min != null) {
        minWhere = item.minInclusive
            ? ` AND denpobha >= ${Number(item.min)}`
            : ` AND denpobha > ${Number(item.min)}`;
    }
    const tznClause = Array.isArray(item.tznValues) && item.tznValues.length
        ? `(${item.tznValues.map(t => `tzn = ${Number(t)}`).join(" OR ")})`
        : `tzn = ${Number(item.tzn)}`;

    return `${tznClause} AND ${maxWhere}${minWhere}`;
}

// Retorna { color, rangeLabel } según el valor de denpobha
function getColorByDensidad(value) {
    for (const cls of clasesBreaksDensidad) {
        if (value <= cls.max) return { color: cls.color, rangeLabel: cls.label };
    }
    return { color: "rgba(184,126,194,1)", rangeLabel: "> 112,20 hab/ha" };
}

// Labels fijos por tipo de zona (campo tzn) — para etiquetas de la gráfica
const tznLabels = {
    1: "Cabecera",
    2: "Centro poblado",
    3: "Rural"
};

// Mapeo inverso label → código tzn (para filtrarPorAtributo)
const densidadLabelToTzn = {
    "Cabecera": 1,
    "Centro poblado": 2,
    "Rural": 3,
    "Cabecera Municipal": 1,
    "Centros Poblados": 2,
    "Rural Disperso": 3
};

// ─── MapServer/15 ─────────────────────────────────────────────────────────────
// Estructura población edad y área (campos: nm, nf, jm, jf, am, af, amm, amf)
const coloresComposicion = {
    "amf": { color: "#C0504D", label: "Adultos mayores femenino" },
    "amm": { color: "#767100", label: "Adultos mayores masculino" },
    "af": { color: "#92D050", label: "Adultos femenino" },
    "am": { color: "#FFFF00", label: "Adultos masculino" },
    "jf": { color: "#FABF8F", label: "Jóvenes femenino" },
    "jm": { color: "#4B6432", label: "Jóvenes masculino" },
    "nf": { color: "#953735", label: "Niños femenino" },
    "nm": { color: "#F79646", label: "Niños masculino" }
};

// Orden solicitado para el slider de estructura de poblacion.
const ordenComposicion = ["nm", "nf", "jm", "jf", "am", "af", "amm", "amf"];

const composicionNacionalColors = ["#FDE0DD", "#FCAE91", "#FB6A4A", "#EF3B2C", "#CB181D", "#A50F15", "#67000D"];
const composicionMasculinoUrbanoColors = ["#D1FF73", "#9DDB96", "#68B8B9", "#3494DC", "#0070FF"];
const composicionMasculinoRuralColors = ["#E9FFBE", "#B9FFB7", "#AFFFDF", "#A8EBFF", "#A1AEFF"];
const composicionFemeninoUrbanoColors = ["#FFD37F", "#EFA3BF", "#DF73FF", "#C43AF2", "#A900E6"];
const composicionFemeninoRuralColors = ["#F5A27A", "#ED848F", "#E68EBD", "#F24BDE", "#C500FF"];
const composicionLowDensityDepartments = ["18", "27", "63", "66", "81", "85", "86", "88", "91", "94", "95", "97", "99"];

const composicionNacionalBreaks = {
    nm: [2390, 8947, 23815, 52476, 110579, 207095, 680674],
    nf: [2223, 8213, 21588, 46022, 105044, 199108, 653276],
    jm: [2333, 7555, 17196, 38584, 97175, 206298, 626714],
    jf: [2169, 7243, 17533, 39486, 96002, 204659, 625701],
    am: [4219, 17216, 54328, 135288, 248298, 554692, 1730122],
    af: [4702, 19763, 66066, 155263, 275250, 635464, 1918194],
    amm: [1052, 3704, 10865, 25067, 66206, 147188, 396076],
    amf: [1799, 5457, 15665, 35111, 91029, 217826, 550712]
};

const composicionMunicipalBreaks = {
    baja: {
        urbano: {
            nm: [227.937045, 248.958302, 476.895347, 2948.455384, 29748],
            nf: [656, 1745, 3474, 8397, 28924],
            jm: [137.184648, 147.288641, 284.473289, 2147.066495, 27436],
            jf: [115.923764, 123.727409, 239.651173, 1961.707986, 27543],
            am: [259.455973, 308.084403, 597.540375, 5095.22257, 74982],
            af: [65.655038, 444.958503, 2636.27728, 15296.003392, 88434],
            amm: [79.737479, 84.427705, 164.165184, 1519.764218, 24566],
            amf: [18.730471, 137.124543, 885.455544, 5615.82671, 35516]
        },
        rural: {
            nm: [346.841697, 421.846486, 752.688183, 2212.011395, 8649],
            nf: [253.552553, 298.162485, 533.715038, 1777.49646, 8345],
            jm: [130.43183, 389.117598, 944.770755, 2138.305416, 4702],
            jf: [73.065001, 228.094165, 609.193689, 1546.029334, 3849],
            am: [203.957819, 596.943474, 1441.086517, 3254.282397, 7149],
            af: [151.91385, 476.030716, 1237.750755, 3027.899553, 7235],
            amm: [60.93735, 188.863625, 476.287111, 1122.067353, 2573],
            amf: [60.314458, 181.277069, 441.102949, 999.205043, 2198]
        }
    },
    alta: {
        urbano: {
            nm: [89.714556, 902.347013, 8263.153735, 74937.17731, 678869],
            nf: [121.948323, 1131.537257, 9489.748284, 78685.922261, 651549],
            jm: [17.043704, 248.450702, 3390.326322, 46048.424378, 625229],
            jf: [41.002315, 485.597373, 5306.416976, 57579.381466, 624384],
            am: [47.061422, 686.027119, 9361.437825, 127149.843665, 1726395],
            af: [52.196104, 760.876773, 10382.826574, 141022.650614, 1914755],
            amm: [21.774364, 268.737976, 3069.785447, 34839.109099, 395165],
            amf: [21.320605, 285.89604, 3569.112517, 44311.785553, 549903]
        },
        rural: {
            nm: [381.517495, 426.513911, 799.031407, 3883.038897, 29415],
            nf: [343.530121, 381.583665, 711.113786, 3564.727066, 28276],
            jm: [256.6967, 290.66113, 536.35783, 2313.713419, 15171],
            jf: [244.956059, 276.536035, 515.492094, 2323.599799, 16005],
            am: [657.120398, 771.569477, 1403.689875, 4894.99097, 24178],
            af: [551.143075, 631.477007, 1162.620083, 4674.373582, 27893],
            amm: [199.848585, 248.427934, 444.27652, 1233.843884, 4417],
            amf: [190.089619, 229.270477, 418.360097, 1330.920116, 5735]
        }
    }
};

function composicionFormatNumber(value) {
    const numeric = Number(value) || 0;
    return numeric >= 1000
        ? Math.round(numeric).toLocaleString("es-CO")
        : numeric.toLocaleString("es-CO", { maximumFractionDigits: 3 });
}

function composicionBuildLegendItems(values = [], colors = [], group = "") {
    let previous = 0;
    return values.map((max, index) => {
        const label = index === 0
            ? `<= ${composicionFormatNumber(max)} personas`
            : `${composicionFormatNumber(previous + 1)} - ${composicionFormatNumber(max)} personas`;
        const item = {
            label,
            color: colors[index] || colors[colors.length - 1] || "#999999",
            code: `${group || "N"}${index + 1}`,
            group,
            min: index === 0 ? null : previous,
            max
        };
        previous = Math.ceil(Number(max) || 0);
        return item;
    });
}

function getComposicionDensityGroup(deptoCode = "") {
    const code = String(deptoCode || "").padStart(2, "0").slice(0, 2);
    return composicionLowDensityDepartments.includes(code) ? "baja" : "alta";
}

function getComposicionLegendItems(field = "nm", options = {}) {
    const activeField = ordenComposicion.includes(field) ? field : "nm";
    if (options.national) {
        return composicionBuildLegendItems(composicionNacionalBreaks[activeField] || [], composicionNacionalColors, "Nacional");
    }

    const densityGroup = getComposicionDensityGroup(options.deptoCode);
    const gender = activeField.endsWith("f") ? "femenino" : "masculino";
    const urbanoColors = gender === "femenino" ? composicionFemeninoUrbanoColors : composicionMasculinoUrbanoColors;
    const ruralColors = gender === "femenino" ? composicionFemeninoRuralColors : composicionMasculinoRuralColors;
    return [
        ...composicionBuildLegendItems(composicionMunicipalBreaks[densityGroup].urbano[activeField] || [], urbanoColors, "Cabecera y centros poblados"),
        ...composicionBuildLegendItems(composicionMunicipalBreaks[densityGroup].rural[activeField] || [], ruralColors, "Rural disperso")
    ];
}

function buildComposicionRenderer(field = "nm", options = {}) {
    const activeField = ordenComposicion.includes(field) ? field : "nm";
    const legendItems = getComposicionLegendItems(activeField, options);
    const infos = legendItems.map(item => ({
        value: item.code,
        label: item.label,
        symbol: {
            type: "simple-fill",
            color: item.color,
            outline: { color: "#ffffff", width: 0.35 }
        }
    }));

    const nationalLimits = JSON.stringify(composicionNacionalBreaks[activeField] || []);
    const densityGroup = getComposicionDensityGroup(options.deptoCode);
    const urbanoLimits = JSON.stringify(composicionMunicipalBreaks[densityGroup].urbano[activeField] || []);
    const ruralLimits = JSON.stringify(composicionMunicipalBreaks[densityGroup].rural[activeField] || []);

    return {
        type: "unique-value",
        valueExpressionTitle: coloresComposicion[activeField]?.label || activeField,
        valueExpression: `
            var valor = Number($feature.${activeField});
            var zona = Number($feature.tzn);
            var nacional = ${options.national ? "true" : "false"};
            var limites = IIf(nacional, ${nationalLimits}, IIf(zona == 3, ${ruralLimits}, ${urbanoLimits}));
            var prefijo = IIf(nacional, "Nacional", IIf(zona == 3, "Rural disperso", "Cabecera y centros poblados"));
            for (var i = 0; i < Count(limites); i++) {
                if (valor <= limites[i]) return prefijo + Text(i + 1);
            }
            return prefijo + Text(Count(limites));
        `,
        uniqueValueInfos: infos,
        defaultSymbol: { type: "simple-fill", color: [220, 220, 220, 0.25], outline: { color: "#ffffff", width: 0.25 } },
        defaultLabel: "Sin rango"
    };
}

// ─── MapServer/6 ─────────────────────────────────────────────────────────────
// Áreas de ocupación del territorio (campo: descripcion, uniqueValue)
// Tasa de crecimiento intercensal (MapServer/16; campos: pt2005, pt2018, drci)
const tasaCrecimientoCampos = [
    { field: "pt2005", label: "Poblacion DANE 2005", unit: "personas" },
    { field: "pt2018", label: "Poblacion DANE 2018", unit: "personas" },
    { field: "drci", label: "Tasa de crecimiento intercensal", unit: "" }
];

const tasaPoblacionColors = ["#FF7F7F", "#FFBEBE", "#FFBE9F", "#FFEBAF", "#E9FFBE", "#E9FF9D", "#B4D79E"];
const tasaPoblacionBreaks = {
    pt2005: [
        { max: 6678.082268, label: "4 - 6678 personas" },
        { max: 7923.241489, label: "6679 - 7923 personas" },
        { max: 14597.323758, label: "7924 - 14597 personas" },
        { max: 50370.559324, label: "14598 - 50371 personas" },
        { max: 242115.930659, label: "50372 - 242116 personas" },
        { max: 1269875.562874, label: "242117 - 1269876 personas" },
        { max: 6778691, label: "1269877 - 6778691 personas" }
    ],
    pt2018: [
        { max: 7236.485334, label: "166 - 7236 personas" },
        { max: 8555.600031, label: "7237 - 8556 personas" },
        { max: 15626.085365, label: "8557 - 15630 personas" },
        { max: 53524.050544, label: "15640 - 53520 personas" },
        { max: 256658.021829, label: "53530 - 256700 personas" },
        { max: 1345460.813595, label: "256800 - 1345000 personas" },
        { max: 7181469, label: "1346000 - 7181000 personas" }
    ]
};

const tasaDrciBreaks = [
    { value: 1, label: "Decrecimiento alto", color: "#FF7F7F" },
    { value: 2, label: "Decrecimiento moderado", color: "#FFBEBE" },
    { value: 3, label: "Crecimiento neutro", color: "#FFEBAF" },
    { value: 4, label: "Crecimiento moderado", color: "#E9FFBE" },
    { value: 5, label: "Crecimiento alto", color: "#B4D79E" }
];

function getTasaCrecimientoFieldInfo(field = "pt2005") {
    return tasaCrecimientoCampos.find(item => item.field === field) || tasaCrecimientoCampos[0];
}

function getTasaCrecimientoLegendItems(field = "pt2005") {
    const activeField = getTasaCrecimientoFieldInfo(field).field;
    if (activeField === "drci") {
        return tasaDrciBreaks.map(item => ({
            label: item.label,
            color: item.color,
            code: String(item.value),
            value: item.value,
            field: activeField
        }));
    }

    return (tasaPoblacionBreaks[activeField] || []).map((item, index) => ({
        label: item.label,
        color: tasaPoblacionColors[index] || tasaPoblacionColors[tasaPoblacionColors.length - 1],
        code: `${activeField}_${index + 1}`,
        min: index === 0 ? null : tasaPoblacionBreaks[activeField][index - 1].max,
        max: item.max,
        field: activeField
    }));
}

function buildTasaCrecimientoRenderer(field = "pt2005") {
    const activeField = getTasaCrecimientoFieldInfo(field).field;

    if (activeField === "drci") {
        return {
            type: "unique-value",
            field: activeField,
            uniqueValueInfos: tasaDrciBreaks.map(item => ({
                value: item.value,
                label: item.label,
                symbol: {
                    type: "simple-fill",
                    color: item.color,
                    outline: { color: "#ffffff", width: 0.35 }
                }
            })),
            defaultSymbol: { type: "simple-fill", color: [220, 220, 220, 0.25], outline: { color: "#ffffff", width: 0.25 } },
            defaultLabel: "Sin dato de tasa intercensal"
        };
    }

    return {
        type: "class-breaks",
        field: activeField,
        classBreakInfos: getTasaCrecimientoLegendItems(activeField).map((item, index) => ({
            minValue: index === 0 ? 0 : item.min,
            maxValue: item.max,
            label: item.label,
            symbol: {
                type: "simple-fill",
                color: item.color,
                outline: { color: "#ffffff", width: 0.35 }
            }
        })),
        defaultSymbol: { type: "simple-fill", color: [220, 220, 220, 0.25], outline: { color: "#ffffff", width: 0.25 } },
        defaultLabel: "En 2005 las condiciones de conflicto impidieron la captura de informacion censal"
    };
}

const autoreconocimientoBreaks = [
    { max: 6200, label: "0 - 6200", color: "#FFFFBE" },
    { max: 22000, label: "6201 - 22000", color: "#E9DB8E" },
    { max: 48000, label: "22001 - 48000", color: "#D4B85F" },
    { max: 130000, label: "48001 - 130000", color: "#BE9430" },
    { max: 271989, label: "130001 - 271989", color: "#A87000" }
];

const condicionesSeguridadClasses = [
    { value: 1, label: "Muy baja", color: "#D5DEE2" },
    { value: 2, label: "Baja", color: "#BBCAD1" },
    { value: 3, label: "Media", color: "#87A5AB" },
    { value: 4, label: "Alta", color: "#376E6F" }
];

function getAutoreconocimientoLegendItems() {
    return autoreconocimientoBreaks.map((item, index) => ({
        label: item.label,
        color: item.color,
        code: `pobtet_${index + 1}`,
        min: index === 0 ? null : autoreconocimientoBreaks[index - 1].max,
        max: item.max,
        field: "pobtet"
    }));
}

function getCondicionesSeguridadLegendItems() {
    return condicionesSeguridadClasses.map(item => ({
        label: item.label,
        color: item.color,
        code: String(item.value),
        value: item.value,
        field: "clasisus"
    }));
}

function buildAutoreconocimientoRenderer() {
    return {
        type: "class-breaks",
        field: "pobtet",
        classBreakInfos: getAutoreconocimientoLegendItems().map((item, index) => ({
            minValue: index === 0 ? 0 : item.min,
            maxValue: item.max,
            label: item.label,
            symbol: {
                type: "simple-fill",
                color: item.color,
                outline: { color: "#6e6e6e", width: 0.7 }
            }
        })),
        defaultSymbol: {
            type: "simple-fill",
            color: [220, 220, 220, 0.25],
            outline: { color: "#6e6e6e", width: 0.35 }
        },
        defaultLabel: "Sin dato de autoreconocimiento etnico"
    };
}

function buildCondicionesSeguridadRenderer() {
    return {
        type: "unique-value",
        field: "clasisus",
        uniqueValueInfos: condicionesSeguridadClasses.map(item => ({
            value: item.value,
            label: item.label,
            symbol: {
                type: "simple-fill",
                color: item.color,
                outline: { color: "#6e6e6e", width: 0.35 }
            }
        })),
        defaultSymbol: {
            type: "simple-fill",
            color: [220, 220, 220, 0.25],
            outline: { color: "#6e6e6e", width: 0.35 }
        },
        defaultLabel: "Sin clasificacion de seguridad"
    };
}

const coloresAreasOcupacion = {
    "Explotaciones mineras": { color: "rgba(245,162,122,0.80)", label: "Explotaciones mineras" },
    "Region Caribe": { color: "rgba(56,168,0,1)", label: "Región Caribe" },
    "Region Central": { color: "rgba(76,0,115,1)", label: "Región Central" },
    "Region Occidental": { color: "rgba(245,122,122,1)", label: "Región Occidental" },
    "Valles aluviales": { color: "rgba(252,215,251,0.80)", label: "Valles aluviales" },
    "Áreas de altiplanos": { color: "rgba(255,211,127,0.80)", label: "Áreas de altiplanos" },
    "Urabá": { color: "rgba(245,122,122,1)", label: "Urabá", style: "backward-diagonal" },
    "Orinoquía": { color: "rgba(199, 241, 199, 1)", label: "Orinoquía" },
    "Muisca": { color: "rgba(255,210,128,1)", label: "Ocupación Indígena" },
    "Yarigui": { color: "rgba(255,210,128,1)", label: "Ocupación Indígena" },
    "Yalcón": { color: "rgba(255,210,128,1)", label: "Ocupación Indígena" },
    "Tumaco": { color: "rgba(255,210,128,1)", label: "Ocupación Indígena" },
    "Tairona": { color: "rgba(255,210,128,1)", label: "Ocupación Indígena" },
    "Sinú": { color: "rgba(255,210,128,1)", label: "Ocupación Indígena" },
    "Quillacinga-Pasto": { color: "rgba(255,210,128,1)", label: "Ocupación Indígena" },
    "Pijao": { color: "rgba(255,210,128,1)", label: "Ocupación Indígena" },
    "Paez": { color: "rgba(255,210,128,1)", label: "Ocupación Indígena" },
    "Loma": { color: "rgba(255,210,128,1)", label: "Ocupación Indígena" },
    "Guambiano": { color: "rgba(255,210,128,1)", label: "Ocupación Indígena" },
    "Guane": { color: "rgba(255,210,128,1)", label: "Ocupación Indígena" },
    "Embera": { color: "rgba(255,210,128,1)", label: "Ocupación Indígena" },
    "Ansema,Quimbaya,Quindio": { color: "rgba(255,210,128,1)", label: "Ocupación Indígena" },
    "Cuna": { color: "rgba(255,210,128,1)", label: "Ocupación Indígena" },
    "Chimila": { color: "rgba(255,210,128,1)", label: "Ocupación Indígena" },
    "Magdalena Medio": { color: "rgba(92,137,68,1)", label: "Magdalena Medio", style: "backward-diagonal" },
    "Amazonía": { color: "rgba(255,211,127,1)", label: "Amazonía", style: "backward-diagonal" }
};

// Exponer API usada por app.js (type=module) sin duplicar lógica.
if (typeof window !== "undefined") {
    Object.assign(window, {
        buildDensidadPoblacionalRenderer,
        getDensidadLegendItems,
        buildDensidadLegendItemWhere,
        getDensidadColorByZona,
        densidadLabelToTzn,
        tznLabels,
        tasaCrecimientoCampos,
        ordenComposicion,
        coloresComposicion,
        buildTasaCrecimientoRenderer,
        getTasaCrecimientoLegendItems,
        getTasaCrecimientoFieldInfo,
        buildComposicionRenderer,
        getComposicionLegendItems,
        buildAutoreconocimientoRenderer,
        getAutoreconocimientoLegendItems,
        buildCondicionesSeguridadRenderer,
        getCondicionesSeguridadLegendItems
    });
}
