import { getChartBaseWhere } from "./core/chartUtils.js?v=travel-time-pie-20260511";
import { getRendererLegendItems } from "./core/chartSymbolUtils.js?v=travel-time-pie-20260511";
import { prepareVisibleChartCanvas, setChartTitle } from "./ui/chartPanel.js?v=local-chart-title-20260529";
import { setChartStatus } from "./ui/chartStatus.js";
import { createVerticalGroupedBarOptions, formatChartLabel } from "./core/chartOptions.js?v=global-safe-zoom-labels-20260604";
import { destroyCanvasChart } from "./core/chartLifecycle.js";
import { createAdaptiveBarValueLabelsPlugin } from "./core/adaptiveBarValueLabels.js?v=global-safe-zoom-labels-20260604";

const POVERTY_GROUPED_CHART_ID = "poverty-ipm-nbi-grouped";

function normKey(text) {
    return String(text || "")
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

function labelScore(a, b) {
    const na = normKey(a);
    const nb = normKey(b);
    if (!na || !nb) return 0;
    if (na.includes(nb) || nb.includes(na)) return 1;
    const ta = new Set(na.split(" ").filter(Boolean));
    const tb = new Set(nb.split(" ").filter(Boolean));
    let inter = 0;
    ta.forEach(t => {
        if (tb.has(t)) inter++;
    });
    return inter / Math.max(Math.min(ta.size, tb.size), 1);
}

function settlementLabelFromIpmAlias(alias) {
    const raw = String(alias || "").trim();
    const label = raw
        .replace(/^IPM\s+/i, "")
        .replace(/\s*\([^)]*\)\s*$/g, "")
        .trim();
    return label ? `${label.charAt(0).toLocaleUpperCase("es-CO")}${label.slice(1)}` : "";
}

function seriesTokenFromAlias(alias) {
    const raw = String(alias || "").trim();
    const m = /^([A-Za-zÁÉÍÓÚáéíóúÑñ]+)/.exec(raw);
    return (m?.[1] || raw.split(/\s+/)[0] || "").trim();
}

function fieldByName(layer, name) {
    const want = String(name || "").toLowerCase();
    return (layer?.fields || []).find(f => String(f?.name || "").toLowerCase() === want) || null;
}

function validatePivotFields(layer, chartConfig) {
    const required = chartConfig?.pivot?.requiredFields || [];
    const names = new Set((layer?.fields || []).map(f => String(f?.name || "").toLowerCase()));
    const missing = required.filter(f => !names.has(String(f).toLowerCase()));
    if (missing.length) {
        throw new Error(`La capa no expone los campos requeridos: ${missing.join(", ")}`);
    }
}

function readNumeric(attrs, field) {
    const v = Number(attrs?.[field]);
    return Number.isFinite(v) ? v : NaN;
}

function greedyMatchCellsToLegend(cells, legendItems) {
    const items = [...legendItems];
    const assignments = new Array(cells.length).fill(null);
    const pairs = [];
    cells.forEach((cell, ci) => {
        items.forEach((item, li) => {
            const blob = `${item.label} ${item.code}`;
            const s = Math.max(
                labelScore(cell.matchKey, item.label),
                labelScore(cell.matchKey, blob),
                labelScore(cell.matchKeyShort, item.label)
            );
            pairs.push({ ci, li, s });
        });
    });
    pairs.sort((a, b) => b.s - a.s);
    const usedCell = new Set();
    const usedItem = new Set();
    for (const { ci, li, s } of pairs) {
        if (usedCell.has(ci) || usedItem.has(li)) continue;
        if (s < 0.18) continue;
        assignments[ci] = items[li];
        usedCell.add(ci);
        usedItem.add(li);
    }
    for (let ci = 0; ci < cells.length; ci++) {
        if (assignments[ci]) continue;
        const li = items.findIndex((_, idx) => !usedItem.has(idx));
        if (li >= 0) {
            assignments[ci] = items[li];
            usedItem.add(li);
        }
    }
    return assignments.map((item, ci) => ({
        code: String(item?.code ?? cells[ci].legendLabel ?? `cat_${ci}`).trim(),
        label: String(item?.label || cells[ci].legendLabel || "").trim(),
        color: item?.color || cells[ci].fallbackColor || "#94a3b8"
    }));
}

function layerSourceUrl(layer) {
    return String(layer?.__sourceUrl || layer?.url || "");
}

async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    if (json?.error) throw new Error(json.error.message || "Error consultando servicio de pobreza");
    return json;
}

async function resolveQueryMetadata(layer, chartConfig) {
    if (Array.isArray(layer?.fields) && layer.fields.length) return layer;
    const url = layerSourceUrl(layer) || chartConfig?.serviceUrl || chartConfig?.url;
    if (!url) return layer;
    const metadata = await fetchJson(`${url}?f=json`);
    return {
        fields: metadata.fields || [],
        renderer: metadata.drawingInfo?.renderer || layer?.renderer || null,
        __sourceUrl: url
    };
}

async function queryPovertyFeature(layer, chartConfig, where, outFields) {
    const url = layerSourceUrl(layer) || chartConfig?.serviceUrl || chartConfig?.url;
    if (url) {
        const params = new URLSearchParams({
            f: "json",
            where,
            outFields: outFields.join(","),
            returnGeometry: "false",
            resultRecordCount: "1"
        });
        return fetchJson(`${url}/query?${params.toString()}`);
    }

    const query = layer.createQuery();
    query.where = where;
    query.outFields = outFields;
    query.returnGeometry = false;
    query.num = 1;
    return layer.queryFeatures(query);
}

export function createPovertyGroupedBarChartController({
    chartCore,
    chartInteractions,
    getWhereBase,
    getFiltroNivel,
    getDeptoActual,
    getDiccionarioDepartamentos,
    getView,
    getHighlightHandle,
    setHighlightHandle,
    getActiveLayerConfig,
    getLayerGlobal
}) {
    let lastSelectionKey = null;

    function clearPovertyState() {
        window.__povertyGroupedState = null;
        lastSelectionKey = null;
    }

    function categoryLabel(value) {
        const labels = {
            "1": "Departamento",
            "2": "Municipio",
            "3": "Distrito"
        };
        return labels[String(value)] || String(value || "Municipio");
    }

    function readablePlace(attrs = {}) {
        const selectOptionLabel = (selectId, value) => {
            const option = document.querySelector(`#${selectId} option[value="${CSS.escape(String(value ?? ""))}"]`);
            return option?.textContent?.trim() || "";
        };
        const mpCode = attrs.mpcodigo;
        const dpCode = attrs.dpcodigo || String(mpCode || "").slice(0, 2);
        const municipality = /^\d{5}$/.test(String(attrs.mpnombre || "")) || !attrs.mpnombre
            ? selectOptionLabel("municipios", mpCode)
            : attrs.mpnombre;
        const department = /^\d{2}$/.test(String(attrs.dpnombre || "")) || !attrs.dpnombre
            ? selectOptionLabel("departamentos", dpCode)
            : attrs.dpnombre;
        return {
            mpcategor: categoryLabel(attrs.mpcategor),
            mpnombre: municipality || attrs.mpnombre || "",
            dpnombre: department || attrs.dpnombre || ""
        };
    }

    function resolveTitle(chartConfig, attrs) {
        const place = readablePlace(attrs);
        const isCapital = String(attrs.mpcategor) === "3" || /distrito/i.test(place.mpcategor);
        const entity = isCapital ? "la ciudad" : "el municipio";
        const tpl = chartConfig?.titleTemplate || chartConfig?.title || "";
        return tpl
            .replace(/\{entity\}/g, entity)
            .replace(/\{mpnombre\}/g, place.mpnombre)
            .replace(/\{dpnombre\}/g, place.dpnombre)
            .replace(/\{mpcategor\}/g, place.mpcategor);
    }

    function applyChartSelection(chart, datasetIndex, dataIndex, active) {
        if (!chart?.data?.datasets) return;
        const basePalette = chart.__povertyBaseBg || [];
        chart.data.datasets.forEach((ds, di) => {
            const n = ds.data?.length || 0;
            const baseBg = Array.isArray(basePalette[di])
                ? basePalette[di]
                : (Array.isArray(ds.backgroundColor) ? ds.backgroundColor : Array(n).fill(ds.backgroundColor));
            ds.backgroundColor = [...baseBg];
            const borderW = [];
            const borderC = [];
            for (let i = 0; i < n; i++) {
                const isSel = active && di === datasetIndex && i === dataIndex;
                borderW.push(isSel ? 3 : 1);
                borderC.push(isSel ? "#0f172a" : baseBg[i] || "#64748b");
            }
            ds.borderColor = borderC;
            ds.borderWidth = borderW;
        });
        chart.update("none");
    }

    function buildWhere(chartConfig) {
        return getChartBaseWhere({
            chartConfig,
            whereBase: getWhereBase?.(),
            filtroNivel: getFiltroNivel?.(),
            deptoActual: getDeptoActual?.(),
            diccionarioDepartamentos: getDiccionarioDepartamentos?.()
        });
    }

    function destroyCharts() {
        chartCore.destroyChart();
        clearPovertyState();
        const canvas = document.getElementById("chart");
        if (canvas) {
            setChartStatus(canvas, "");
        }
    }

    function isPovertyGroupedChart(chartConfig) {
        return chartConfig?.id === POVERTY_GROUPED_CHART_ID;
    }

    function hasMunicipalitySelection() {
        const municipalityCode = String(document.getElementById("municipios")?.value || "").trim();
        return /^\d{5}$/.test(municipalityCode);
    }

    function showMunicipalityRequiredState(canvas, config) {
        chartCore.destroyChart();
        clearPovertyState();
        prepareVisibleChartCanvas(canvas);
        setChartTitle(config?.chartConfig?.title || config?.title || "Nivel de pobreza");
        setChartStatus(canvas, "Seleccione un municipio para ver la información.");
        canvas.style.setProperty("display", "none", "important");
    }

    function prepareChartPanelForConfig(config) {
        if (!isPovertyGroupedChart(config?.chartConfig)) return false;
        const canvas = document.getElementById("chart");
        if (!canvas) return true;
        if (!hasMunicipalitySelection()) {
            showMunicipalityRequiredState(canvas, config);
            return true;
        }
        prepareVisibleChartCanvas(canvas);
        setChartTitle(config.chartConfig.title || config.title);
        setChartStatus(canvas, "Cargando gráfico...");
        return true;
    }

    async function handleMapClick(event) {
        const config = getActiveLayerConfig?.();
        if (!isPovertyGroupedChart(config?.chartConfig)) return;
        const state = window.__povertyGroupedState;
        if (!state?.mapField || !state.codeGrid) return;

        const view = getView?.();
        if (!view) return;
        const hit = await view.hitTest(event);
        const layersGlobal = state.layersGlobal || [];
        const graphic = hit?.results
            ?.map(r => r.graphic)
            ?.find(g => g?.layer === state.layer || layersGlobal.includes(g?.layer));
        const code = graphic?.attributes?.[state.mapField];
        if (code == null || String(code).trim() === "") return;

        const codeStr = String(code).trim();
        let found = null;
        state.codeGrid.forEach((row, di) => {
            row.forEach((c, xi) => {
                if (String(c).trim() === codeStr) found = { di, xi };
            });
        });
        if (!found) return;

        const chart = chartCore.getInstance();
        if (chart) {
            const key = `${found.di}|${found.xi}`;
            if (lastSelectionKey === key) {
                lastSelectionKey = null;
                applyChartSelection(chart, null, null, false);
                if (!state.skipSyncMap) {
                    await chartInteractions.clearCategorySelection?.();
                }
                return;
            }
            lastSelectionKey = key;
            applyChartSelection(chart, found.di, found.xi, true);
        }

        if (!state.skipSyncMap) {
            await chartInteractions.highlightMapByChartValue?.(state.layer, {
                mapInteractionField: state.mapField
            }, codeStr);
        }
    }

    async function actualizarGrafica(layer, config, options = {}) {
        const chartConfig = config?.chartConfig;
        if (!isPovertyGroupedChart(chartConfig)) return false;

        const canvas = document.getElementById("chart");
        if (!canvas) return true;

        if (!hasMunicipalitySelection()) {
            showMunicipalityRequiredState(canvas, config);
            return true;
        }

        chartCore.destroyChart();
        clearPovertyState();
        prepareVisibleChartCanvas(canvas);
        setChartTitle(chartConfig.title || config.title);
        setChartStatus(canvas, "Cargando gráfico...");

        if (typeof Chart === "undefined") {
            setChartStatus(canvas, "Chart.js no está cargado.");
            return true;
        }

        const targetUrl = layerSourceUrl(layer);
        const globalLayer = getLayerGlobal?.();
        const mapLayer = globalLayer && targetUrl && layerSourceUrl(globalLayer) === targetUrl
            ? globalLayer
            : layer;
        if (!mapLayer?.createQuery) {
            setChartStatus(canvas, "No hay capa en el mapa para consultar el nivel de pobreza.");
            return true;
        }

        try {
            await Promise.race([
                mapLayer.when?.() || Promise.resolve(),
                new Promise(resolve => window.setTimeout(resolve, 2500))
            ]);
        } catch (_) {}
        const queryLayer = await resolveQueryMetadata(mapLayer, chartConfig);
        try {
            validatePivotFields(queryLayer, chartConfig);
        } catch (e) {
            setChartStatus(canvas, String(e?.message || e));
            return true;
        }

        const pivot = chartConfig.pivot;
        const slots = pivot?.xSlots || [];
        const seriesDefs = pivot?.series || [];
        if (slots.length !== 3 || seriesDefs.length !== 2) {
            setChartStatus(canvas, "Configuración de pivot incompleta.");
            return true;
        }

        const ipmInfo = fieldByName(queryLayer, seriesDefs[0].valueFields[0]);
        const nbiInfo = fieldByName(queryLayer, seriesDefs[1].valueFields[0]);
        const seriesLabels = {
            ipm: seriesTokenFromAlias(ipmInfo?.alias || "IPM"),
            nbi: seriesTokenFromAlias(nbiInfo?.alias || "NBI")
        };

        const xLabels = slots.map((slot, idx) => {
            const fi = fieldByName(queryLayer, slot.ipmField);
            return settlementLabelFromIpmAlias(fi?.alias || `Grupo ${idx + 1}`);
        });

        const where = buildWhere(chartConfig);
        const result = await queryPovertyFeature(mapLayer, chartConfig, where, [...pivot.requiredFields]);
        const feature = result?.features?.[0];
        if (!feature) {
            setChartStatus(canvas, "No hay datos de pobreza para el filtro seleccionado.");
            return true;
        }

        const attrs = feature.attributes || {};
        const ipmVals = slots.map(s => readNumeric(attrs, s.ipmField));
        const nbiVals = slots.map(s => readNumeric(attrs, s.nbiField));
        if (ipmVals.some(v => !Number.isFinite(v)) || nbiVals.some(v => !Number.isFinite(v))) {
            setChartStatus(canvas, "Los valores de indicadores no son numéricos válidos para graficar.");
            return true;
        }

        const renderer = mapLayer.renderer;
        const mapField = String(renderer?.field || renderer?.field1 || "").trim();
        const legendItems = getRendererLegendItems(renderer, chartConfig);

        const cells = [];
        for (let xi = 0; xi < slots.length; xi++) {
            cells.push({
                matchKey: `${seriesLabels.ipm} ${xLabels[xi]}`,
                matchKeyShort: `${seriesLabels.ipm} ${normKey(xLabels[xi])}`,
                legendLabel: `${seriesLabels.ipm} — ${xLabels[xi]}`,
                fallbackColor: "rgba(13, 148, 136, 0.85)",
                di: 0,
                xi
            });
            cells.push({
                matchKey: `${seriesLabels.nbi} ${xLabels[xi]}`,
                matchKeyShort: `${seriesLabels.nbi} ${normKey(xLabels[xi])}`,
                legendLabel: `${seriesLabels.nbi} — ${xLabels[xi]}`,
                fallbackColor: "rgba(59, 130, 246, 0.85)",
                di: 1,
                xi
            });
        }

        const matched = legendItems.length
            ? greedyMatchCellsToLegend(cells, legendItems)
            : cells.map((c, i) => ({
                code: `v${i}`,
                label: c.legendLabel,
                color: c.fallbackColor
            }));

        const codeGrid = [[], []];
        const colorsIpM = [];
        const colorsNbi = [];
        matched.forEach((m, idx) => {
            const cell = cells[idx];
            if (cell.di === 0) {
                colorsIpM[cell.xi] = m.color;
                codeGrid[0][cell.xi] = m.code;
            } else {
                colorsNbi[cell.xi] = m.color;
                codeGrid[1][cell.xi] = m.code;
            }
        });

        const legendOrder = [];
        for (let xi = 0; xi < slots.length; xi++) {
            const i1 = xi * 2;
            const i2 = xi * 2 + 1;
            legendOrder.push({
                code: matched[i1].code,
                label: matched[i1].label || cells[i1].legendLabel,
                color: matched[i1].color
            });
            legendOrder.push({
                code: matched[i2].code,
                label: matched[i2].label || cells[i2].legendLabel,
                color: matched[i2].color
            });
        }

        const keepRendererLegend = Boolean(chartConfig?.legendDrivenByMapRenderer);
        window.__chartLegendOrder = keepRendererLegend ? [] : legendOrder;
        if (mapField) {
            chartConfig.mapInteractionField = mapField;
        }

        const baseWhere = String(where || "1=1").trim() || "1=1";
        window.__povertyGroupedState = {
            mapField,
            codeGrid,
            layer: mapLayer,
            layersGlobal: [mapLayer],
            baseWhere,
            skipSyncMap: Boolean(options.skipSyncMap)
        };

        if (!keepRendererLegend && typeof window.actualizarLeyenda === "function" && mapField) {
            window.actualizarLeyenda(
                legendOrder.map(o => o.label),
                legendOrder.map(o => o.color),
                legendOrder.map(o => o.code),
                {
                    field: mapField,
                    baseWhere,
                    layers: [mapLayer],
                    preserveOrder: true
                }
            );
        }

        setChartStatus(canvas, "");
        setChartTitle(resolveTitle(chartConfig, attrs));

        const decimals = Number.isInteger(chartConfig.yAxis?.decimals) ? chartConfig.yAxis.decimals : 2;
        const suffix = chartConfig.yAxis?.suffix || "";

        destroyCanvasChart(canvas);
        const chart = new Chart(canvas, {
            type: "bar",
            data: {
                labels: xLabels,
                datasets: [
                    {
                        label: seriesLabels.ipm,
                        data: ipmVals,
                        backgroundColor: colorsIpM,
                        borderColor: colorsIpM,
                        borderWidth: 1,
                        borderRadius: 4,
                        maxBarThickness: 36,
                        categoryPercentage: 0.75,
                        barPercentage: 0.9
                    },
                    {
                        label: seriesLabels.nbi,
                        data: nbiVals,
                        backgroundColor: colorsNbi,
                        borderColor: colorsNbi,
                        borderWidth: 1,
                        borderRadius: 4,
                        maxBarThickness: 36,
                        categoryPercentage: 0.75,
                        barPercentage: 0.9
                    }
                ]
            },
            options: createVerticalGroupedBarOptions({
                xTitle: chartConfig.xAxis?.label || "",
                yTitle: chartConfig.yAxis?.label || "",
                ySuggestedMax: chartConfig.ySuggestedMax ?? null,
                decimals,
                suffix,
                xTicks: {
                    autoSkip: true,
                    autoSkipPadding: 10,
                    minRotation: 0,
                    maxRotation: 0,
                    fontSize: 10,
                    fontWeight: "600",
                    padding: 8,
                    bottomPadding: 14,
                    callback(value) {
                        const label = this.getLabelForValue?.(value) ?? value;
                        return formatChartLabel(label, {
                            maxLineLength: 18,
                            maxLines: 3
                        });
                    }
                },
                onGroupedBarClick: async ({ datasetIndex, dataIndex }) => {
                    const code = codeGrid[datasetIndex]?.[dataIndex];
                    if (!code || !mapField) return;
                    const chartInst = chartCore.getInstance();
                    const key = `${datasetIndex}|${dataIndex}`;
                    if (lastSelectionKey === key) {
                        lastSelectionKey = null;
                        applyChartSelection(chartInst, null, null, false);
                        if (!options.skipSyncMap) {
                            await chartInteractions.clearCategorySelection?.();
                        }
                        return;
                    }
                    lastSelectionKey = key;
                    if (chartInst) applyChartSelection(chartInst, datasetIndex, dataIndex, true);
                    if (!options.skipSyncMap) {
                        await chartInteractions.highlightMapByChartValue?.(mapLayer, {
                            mapInteractionField: mapField
                        }, code);
                    }
                }
            }),
            plugins: [createAdaptiveBarValueLabelsPlugin({
                id: `${POVERTY_GROUPED_CHART_ID}-adaptive-box-labels`,
                formatValue: value => Number(value).toLocaleString("es-CO", {
                    minimumFractionDigits: decimals,
                    maximumFractionDigits: decimals
                })
            })]
        });

        chart.__povertyBaseBg = [
            [...colorsIpM],
            [...colorsNbi]
        ];
        chartCore.setInstance(chart);

        const scroll = document.getElementById("pibChartScroll");
        if (scroll) {
            scroll.style.overflowX = "hidden";
            scroll.classList.remove("is-scrollable");
        }
        canvas.style.setProperty("width", "100%", "important");
        canvas.style.setProperty("max-width", "100%", "important");

        return true;
    }

    return {
        actualizarGrafica,
        prepareChartPanelForConfig,
        handleMapClick,
        destroyCharts,
        isPovertyGroupedChart
    };
}
