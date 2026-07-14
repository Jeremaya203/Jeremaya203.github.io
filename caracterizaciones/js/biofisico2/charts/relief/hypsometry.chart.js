const DEFAULT_HYPSOMETRY_COLORS = {
    1001: { color: "rgba(175,240,233,1)", label: "< - 0" },
    1002: { color: "rgba(177,242,211,1)", label: "0 - 1" },
    1003: { color: "rgba(176,245,185,1)", label: "1 - 2" },
    1004: { color: "rgba(195,247,178,1)", label: "2 - 5" },
    1005: { color: "rgba(223,250,177,1)", label: "5 - 10" },
    1006: { color: "rgba(255,255,179,1)", label: "10 - 20" },
    1007: { color: "rgba(199,230,129,1)", label: "20 - 30" },
    1008: { color: "rgba(133,204,86,1)", label: "30 - 40" },
    1009: { color: "rgba(63,179,50,1)", label: "40 - 50" },
    1010: { color: "rgba(21,153,48,1)", label: "50 - 75" },
    1011: { color: "rgba(0,128,64,1)", label: "75 - 100" },
    1012: { color: "rgba(49,142,58,1)", label: "100 - 150" },
    1013: { color: "rgba(98,156,52,1)", label: "150 - 200" },
    1014: { color: "rgba(147,170,46,1)", label: "200 - 250" },
    1015: { color: "rgba(197,185,40,1)", label: "250 - 300" },
    1016: { color: "rgba(245,196,37,1)", label: "300 - 400" },
    1017: { color: "rgba(222,147,27,1)", label: "400 - 500" },
    1018: { color: "rgba(199,102,18,1)", label: "500 - 600" },
    1019: { color: "rgba(173,59,10,1)", label: "600 - 700" },
    1020: { color: "rgba(150,26,5,1)", label: "700 - 800" },
    1021: { color: "rgba(128,0,0,1)", label: "800 - 900" },
    1022: { color: "rgba(126,12,3,1)", label: "900 - 1000" },
    1023: { color: "rgba(125,25,7,1)", label: "1000 - 1250" },
    1024: { color: "rgba(124,37,10,1)", label: "1250 - 1500" },
    1025: { color: "rgba(123,50,14,1)", label: "1500 - 1750" },
    1026: { color: "rgba(121,62,17,1)", label: "1750 - 2000" },
    1027: { color: "rgba(134,87,51,1)", label: "2000 - 2250" },
    1028: { color: "rgba(147,111,84,1)", label: "2250 - 2500" },
    1029: { color: "rgba(159,136,118,1)", label: "2500 - 3000" },
    1030: { color: "rgba(172,160,151,1)", label: "3000 - 3500" },
    1031: { color: "rgba(185,185,185,1)", label: "3500 - 4000" },
    1032: { color: "rgba(198,198,198,1)", label: "4000 - 4500" },
    1033: { color: "rgba(212,212,212,1)", label: "4500 - 5000" },
    1034: { color: "rgba(225,225,226,1)", label: "5000 - 5500" },
    1035: { color: "rgba(239,239,240,1)", label: "5500 - >" }
};

function getHypsometryDict(deps = {}) {
    const dict = deps.coloresHipsometricos || globalThis.coloresHipsometricos || {};
    return Object.keys(dict).length ? dict : DEFAULT_HYPSOMETRY_COLORS;
}

function toHypsometryNumber(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;

    const normalized = String(value ?? "")
        .trim()
        .replace(/\s/g, "")
        .replace("%", "")
        .replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
}

function getHypsometryCode(value, coloresHipsometricos) {
    const raw = String(value ?? "").trim();
    if (!raw) return null;
    if (coloresHipsometricos?.[raw]) return raw;

    const numeric = Number(raw.replace(",", "."));
    if (Number.isFinite(numeric)) {
        const numericCode = String(Math.trunc(numeric));
        if (coloresHipsometricos?.[numericCode]) return numericCode;
    }

    const entry = Object.entries(coloresHipsometricos || {})
        .find(([, info]) => String(info?.label ?? "").trim() === raw);
    return entry?.[0] || raw;
}

function buildOrderedHypsometrySeriesFromCodes(dataByCode, coloresHipsometricos) {
    const codes = Object.keys(coloresHipsometricos || {})
        .map(Number)
        .sort((a, b) => a - b)
        .map(String)
        .filter(code => toHypsometryNumber(dataByCode[code]) > 0)
        .reverse();

    return {
        codes,
        labels: codes.map(code => coloresHipsometricos?.[code]?.label || code),
        values: codes.map(code => Number(toHypsometryNumber(dataByCode[code]).toFixed(4))),
        colors: codes.map(code => coloresHipsometricos?.[code]?.color || "#999")
    };
}

function clearHypsometryCanvas() {
    const canvas = document.getElementById("chart");
    if (!canvas?.getContext) return;
    const ChartCtor = globalThis.Chart;
    if (!ChartCtor) return;

    try {
        const ctx = canvas.getContext("2d");
        ctx?.clearRect(0, 0, canvas.width || 0, canvas.height || 0);
    } catch (_) {}
}

function getMunicipalTitleParts(ctx, firstAttrs = {}) {
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

function buildHypsometryDataByCode(rows, labelField, valueField, coloresHipsometricos) {
    const dataByCode = {};

    for (const attrs of rows || []) {
        const code = getHypsometryCode(attrs[labelField], coloresHipsometricos);
        if (!code) continue;

        const value = toHypsometryNumber(attrs[valueField]);
        dataByCode[code] = (dataByCode[code] || 0) + value;
    }

    return dataByCode;
}

function buildMunicipalHypsometryData(rows, labelField, valueField, coloresHipsometricos) {
    const areaByCode = {};
    let totalArea = 0;

    for (const attrs of rows || []) {
        const code = getHypsometryCode(attrs[labelField], coloresHipsometricos);
        if (!code) continue;

        const area = toHypsometryNumber(attrs.areat);
        if (area <= 0) continue;

        areaByCode[code] = (areaByCode[code] || 0) + area;
        totalArea += area;
    }

    if (totalArea > 0) {
        const pctByCode = {};
        for (const [code, area] of Object.entries(areaByCode)) {
            pctByCode[code] = (area / totalArea) * 100;
        }
        return pctByCode;
    }

    return buildHypsometryDataByCode(rows, labelField, valueField, coloresHipsometricos);
}

function resetMunicipalHypsometryLayout() {
    const canvas = document.getElementById("chart");
    if (!canvas) return;

    canvas.style.removeProperty("height");
    const card = canvas.closest(".chart-card");
    card?.classList.remove("chart-ecosistemas", "chart-hipsometria-depto", "chart-bubble", "chart-bubble-depto");
    card?.style.removeProperty("--biofisico-chart-height");
}

function applyMunicipalHypsometryHeight(labelCount) {
    const canvas = document.getElementById("chart");
    if (!canvas) return 0;

    const isSmallScreen = (window.innerWidth || 1200) <= 768;
    const baseHeight = isSmallScreen ? 360 : 340;
    const extraPerRange = isSmallScreen ? 20 : 18;
    const maxHeight = isSmallScreen ? 700 : 660;
    const extraHeight = labelCount > 8
        ? Math.max(0, (labelCount - 8) * extraPerRange)
        : 0;
    const finalHeight = Math.min(maxHeight, baseHeight + extraHeight);
    const card = canvas.closest(".chart-card");

    card?.classList.remove("chart-ecosistemas", "chart-hipsometria-depto", "chart-bubble", "chart-bubble-depto");
    card?.style.setProperty("--biofisico-chart-height", `${finalHeight}px`);
    card?.style.removeProperty("--biofisico-hipso-depto-height");
    canvas.style.setProperty("height", `${finalHeight}px`, "important");
    canvas.style.setProperty("max-height", `${finalHeight}px`, "important");
    canvas.style.removeProperty("min-height");
    return finalHeight;
}

function applyDepartmentHypsometryHeight(labelCount) {
    const canvas = document.getElementById("chart");
    if (!canvas) return;

    const isSmallScreen = (window.innerWidth || 1200) <= 768;
    const baseHeight = isSmallScreen ? 330 : 300;
    const extraHeight = labelCount >= 13
        ? Math.min(isSmallScreen ? 130 : 170, Math.max(0, (labelCount - 12) * 8))
        : 0;

    canvas.style.height = `${baseHeight + extraHeight}px`;
    canvas.closest(".chart-card")?.classList.remove("chart-ecosistemas");
    canvas.closest(".chart-card")?.style.removeProperty("--biofisico-chart-height");
}

function bindHypsometryRestoreDoubleClick(canvas, chart, ctx) {
    if (!canvas) return;

    if (canvas.__biofisicoHypsometryDblClickHandler) {
        canvas.removeEventListener("dblclick", canvas.__biofisicoHypsometryDblClickHandler);
    }

    const handler = async (event) => {
        const active = typeof chart.getElementsAtEventForMode === "function"
            ? chart.getElementsAtEventForMode(event, "nearest", { intersect: true }, false)
            : [];

        if (active?.length) return;
        await ctx.restoreAllChartCategories?.();
    };

    canvas.__biofisicoHypsometryDblClickHandler = handler;
    canvas.addEventListener("dblclick", handler);
}

function renderCleanMunicipalHypsometryChart(ctx, labels, values, colors, codes) {
    const canvas = document.getElementById("chart");
    if (!canvas?.getContext) return;
    const ChartCtor = globalThis.Chart;
    if (!ChartCtor) return;

    ctx.destroyChart?.();
    clearHypsometryCanvas();
    const finalHeight = applyMunicipalHypsometryHeight(labels.length);

    const numericValues = values.map(value => toHypsometryNumber(value));
    const maxValue = Math.max(0, ...numericValues);
    const axisMax = maxValue > 0 ? Math.max(1, maxValue * 1.15) : 1;
    const manyRanges = labels.length >= 16;
    const chart = new ChartCtor(canvas.getContext("2d"), {
        type: "bar",
        data: {
            labels,
            datasets: [{
                label: "%",
                data: numericValues,
                backgroundColor: colors,
                borderColor: "rgba(0,0,0,0)",
                borderWidth: 0,
                minBarLength: 2,
                categoryPercentage: manyRanges ? 0.74 : 0.82,
                barPercentage: manyRanges ? 0.82 : 0.88
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: "y",
            animation: false,
            layout: {
                padding: { top: 8, right: 12, bottom: 4, left: 4 }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    min: 0,
                    max: axisMax,
                    title: {
                        display: true,
                        text: "Porcentaje (%)"
                    },
                    ticks: {
                        callback(value) {
                            const number = toHypsometryNumber(value);
                            return Number(number.toFixed(2)).toString();
                        },
                        font: { size: manyRanges ? 9 : 10 }
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: "Rangos (m)"
                    },
                    ticks: {
                        autoSkip: false,
                        padding: manyRanges ? 5 : 4,
                        font: { size: manyRanges ? 9 : 10 }
                    }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title(items) {
                            return items?.[0]?.label || "";
                        },
                        label(context) {
                            const value = toHypsometryNumber(context.raw);
                            return `${Number(value.toFixed(2))}%`;
                        }
                    }
                }
            },
            onClick: async (event, elements, chartRef) => {
                const element = elements?.[0];
                if (!element) return;

                const code = String(codes?.[element.index] ?? "").trim();
                if (!code) return;

                await ctx.setOnlyCategoryCodeActive?.(code, "chart");
            }
        }
    });

    chart.__biofisicoCategoryState = {
        isStacked: false,
        labels: labels.map(label => String(label ?? "")),
        codes: codes.map(code => String(code ?? "")),
        fullData: [...numericValues],
        fullColors: Array.isArray(colors) ? [...colors] : colors
    };

    ctx.setChartInstance?.(chart);
    if (finalHeight && typeof chart.resize === "function") {
        try { chart.resize(); } catch (_) {}
    }
    bindHypsometryRestoreDoubleClick(canvas, chart, ctx);
}

function isDepartmentOnlyContext(ctx) {
    const deptValue = String(document.getElementById("departamentos")?.value || "").trim();
    const muniValue = String(document.getElementById("municipios")?.value || "").trim();
    const hasDept = Boolean(deptValue && deptValue !== "0" && deptValue !== "COL");
    return hasDept && !muniValue;
}

function buildMunicipalHypsometryWhere(ctx) {
    const municipalityCode = String(
        document.getElementById("municipios")?.value ||
        ctx.municipioActual ||
        ""
    ).trim();

    if (!municipalityCode) return ctx.whereBase || "1=1";

    return `mpcodigo = '${municipalityCode.replace(/'/g, "''")}'`;
}

async function renderDepartmentHypsometryFromArea(ctx) {
    const selectedDept = String(
        document.getElementById("departamentos")?.value ||
        ctx.deptoActual ||
        ""
    ).trim();
    const deptoCode = selectedDept && selectedDept !== "0" && selectedDept !== "COL"
        ? selectedDept
        : String(ctx.deptoActual || "").trim();
    const requestDeptoCode = String(deptoCode || "").trim();
    const depName = ctx.diccionarioDepartamentos?.[ctx.deptoActual] || ctx.deptoActual || "";
    const finalDeptoCode = String(document.getElementById("departamentos")?.value || ctx.deptoActual || "").trim();
    if (!ctx.isCurrentRenderTarget?.() || (requestDeptoCode && finalDeptoCode !== requestDeptoCode)) return true;

    const title = "Seleccione un municipio para ver el gráfico de hipsometría.";
    const message = "Resumen disponible solo al seleccionar un municipio.";

    if (typeof ctx.setChartMessage === "function") {
        ctx.setChartMessage(title, message);
    } else {
        ctx.destroyChart();
        const titleEl = document.getElementById("chartTitle");
        if (titleEl) titleEl.textContent = title;
        const summary = document.getElementById("summaryDiv");
        if (summary) summary.textContent = message;
    }

    return true;
}

export function hipsometriaMunicipalHandler(deps = {}) {
    const coloresHipsometricos = getHypsometryDict(deps);

    return {
        when: (ctx) =>
            ctx.config?.id === "hipsometria" &&
            !ctx.config?.isDeptoAgg,

        run: async (ctx) => {
            const layer = ctx.lyr || ctx.layer;
            if (!layer || layer.destroyed) return;

            try {
                if (isDepartmentOnlyContext(ctx)) {
                    const handled = await renderDepartmentHypsometryFromArea(ctx, coloresHipsometricos);
                    if (handled) return;
                }

                const q = layer.createQuery();
                q.where = buildMunicipalHypsometryWhere(ctx);
                q.outFields = Array.from(new Set([
                    ...(ctx.config.outFields || []),
                    "areat",
                    "mpnombre",
                    "dpnombre",
                    "mpcodigo",
                    "dpcodigo"
                ]));
                q.returnGeometry = false;

                const res = await (ctx.queryFeatures || ctx.cachedQueryFeatures || ((targetLayer, targetQuery) => targetLayer.queryFeatures(targetQuery)))(layer, q);
                if (!res.features?.length) {
                    if (ctx.filtroNivel === "DEPTO" && ctx.deptoActual) {
                        const deptoCode = Number(ctx.deptoActual);
                        if (Number.isFinite(deptoCode)) {
                            const altWhere = `dpcodigo = ${deptoCode}`;
                            if (ctx.whereBase !== altWhere) {
                                ctx.whereBase = altWhere;
                                ctx.setWhereBase?.(altWhere);
                                ctx.applyWhereToActiveLayers?.(altWhere);
                                ctx.cargarCapaActual?.();
                                return;
                            }
                        }
                    }

                    ctx.destroyChart();
                    clearHypsometryCanvas();
                    ctx.actualizarLeyenda([], []);
                    return;
                }

                const firstAttrs = res.features[0].attributes || {};
                const { mpnombre, dpnombre } = getMunicipalTitleParts(ctx, firstAttrs);

                ctx.actualizarTituloGrafico(ctx.config, mpnombre, dpnombre);

                const dataByCode = buildMunicipalHypsometryData(
                    res.features.map(feature => feature.attributes || {}),
                    ctx.config.labelField,
                    ctx.config.valueField,
                    coloresHipsometricos
                );

                const { codes, labels, values, colors } = buildOrderedHypsometrySeriesFromCodes(dataByCode, coloresHipsometricos);
                if (!labels.length || !values.some(value => toHypsometryNumber(value) > 0)) {
                    ctx.destroyChart();
                    clearHypsometryCanvas();
                    ctx.actualizarLeyenda([], []);
                    return;
                }
                resetMunicipalHypsometryLayout();
                renderCleanMunicipalHypsometryChart(ctx, labels, values, colors, codes);
                ctx.actualizarLeyenda(labels, colors, codes);
            } catch (e) {
                console.error("HIPSOMETRIA_MUNICIPAL error:", e);
                ctx.destroyChart();
                ctx.actualizarLeyenda([], []);
            }
        }
    };
}

export function hipsometriaDeptoAggHandler(deps = {}) {
    const coloresHipsometricos = getHypsometryDict(deps);

    return {
        when: (ctx) =>
            ctx.config?.isDeptoAgg &&
            ctx.config?.deptoAgg,

        run: async (ctx) => {
            try {
                const { groupField, numField } = ctx.config.deptoAgg;

                const outStatistics = [{
                    statisticType: "sum",
                    onStatisticField: numField,
                    outStatisticFieldName: "sum_area"
                }];

                const js = await ctx.arcRestQuery(ctx.config.url || ctx.layer.url, {
                    f: "json",
                    where: ctx.whereBase || "1=1",
                    groupByFieldsForStatistics: groupField,
                    outStatistics: JSON.stringify(outStatistics),
                    returnGeometry: "false"
                });

                const rows = (js.features || []).map(f => f.attributes || {});
                if (!rows.length) {
                    ctx.destroyChart();
                    ctx.actualizarLeyenda([], []);
                    return;
                }

                const total = rows.reduce((acc, r) => acc + (Number(r.sum_area) || 0), 0);
                if (total <= 0) {
                    ctx.destroyChart();
                    ctx.actualizarLeyenda([], []);
                    return;
                }

                const codesOrder = Object.keys(coloresHipsometricos || {})
                    .map(Number)
                    .sort((a, b) => a - b)
                    .map(String);

                const mapByCode = new Map(
                    rows.map(r => [String(r[groupField]), (Number(r.sum_area) || 0)])
                );

                const codes = codesOrder
                    .filter(code => (mapByCode.get(code) || 0) > 0)
                    .reverse();

                const labels = codes.map(code => coloresHipsometricos?.[code]?.label || code);
                const values = codes.map(code => ((mapByCode.get(code) || 0) / total) * 100);
                const colors = codes.map(code => coloresHipsometricos?.[code]?.color || "#999");

                const depName = ctx.diccionarioDepartamentos?.[ctx.deptoActual] || ctx.deptoActual;
                ctx.setTitle(`Distribución de rangos hipsométricos en el departamento de ${depName}`);

                ctx.crearGrafica(labels, values.map(v => Number(v.toFixed(3))), colors, "bar", false);
                applyDepartmentHypsometryHeight(labels.length);
                ctx.actualizarLeyenda(labels, colors);
            } catch (e) {
                console.error("DEPT AGG error:", e);
                ctx.actualizarLeyenda([], []);
            }
        }
    };
}
