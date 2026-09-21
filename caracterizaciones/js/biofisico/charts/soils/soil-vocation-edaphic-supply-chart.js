import {
    soilOrderColors,
    ruralCategoryDictionary,
    landformRendererDictionary,
    landformLandscapeDictionary,
    landSuitabilityRendererDictionary,
    landSuitabilityMainDictionary,
    ensureSoilOrderDictionary,
    ensureRuralCategoryDictionary,
    ensureLandformDictionary,
    ensureLandSuitabilityDictionary,
    getLandSuitabilityColor,
    getLandSuitabilityUseColor,
    getLandformColor,
    getLandscapeColor
} from "../../services/biophysical-layer-service.js";
import {
    queryGroupSum,
    queryTotalSum,
    mergePctWithDict,
    sortItems,
    fenomenosMeta,
    fenomenosTitle,
    degradationClasses,
    DEGRADATION_ORDER,
    SEISMIC_ORDER
} from "../chart-utils.js";

export function landSuitabilityDepartmentDoughnutHandler(deps = {}) {
    const {
        pctOfTotal, toNum, wrapLabel, sortMonths, arcRestQuery, fetchBF3Stats, fetchGroupedStats,
        getSymbolColorRGBA, buildLegendFromRenderer, ensureNonEmptyOrExit, pickExistingField,
        buildDictFromUniqueValueRenderer, createSoilOrderBubbleChart, createDualLandformCharts,
        createDualLandSuitabilityCharts, toggleLandformCharts, destroyLandformCharts, getAxisTitles
    } = deps;
        return {
            when: (ctx) =>
            ctx.territoryLevel === "DEPTO" &&
            ctx.config.isSuelos &&
            ctx.config.suelosType === "vocacion" &&
            ctx.config.isDeptoVocacionAgg &&
            ctx.config.vocacionAgg,

            run: async (ctx) => {
            try {
                const { groupField, areaCandidates } = ctx.config.vocacionAgg;

                const lyr = ctx.lyr || ctx.layer;
                await lyr.when();

                // Detectar campo de área disponible (preferimos areat)
                const areaField = (typeof pickExistingField === "function"
                ? (pickExistingField(lyr, areaCandidates) || "areat")
                : "areat"
                );

                const url = ctx.config.url || lyr.url;

                // group sum(areaField) por vocación
                const rows = await queryGroupSum({
                url,
                where: ctx.whereBase || "1=1",
                groupBy: groupField,
                field: areaField,
                outName: "sum_area",
                statisticType: "sum"
                });

                if (!ensureNonEmptyOrExit(ctx, rows)) return;

                const total = rows.reduce((acc, r) => acc + (Number(r.sum_area) || 0), 0);
                if (total <= 0) {
                ctx.destroyChart();
                ctx.updateLegend([], []);
                return;
                }

                // Diccionario label/color desde renderer (si existe)
                const dictFromRenderer = buildDictFromUniqueValueRenderer(lyr);

                // Armar items
                const items = rows.map(r => {
                const code = String(r[groupField] ?? "").trim();
                const area = Number(r.sum_area) || 0;
                const pct = pctOfTotal(area, total);

                const info = dictFromRenderer.get(code);
                return {
                    code,
                    label: info?.label || code || "Sin información",
                    color: info?.color || "#999",
                    pct
                };
                });

                // Orden por porcentaje desc (como tu donut)
                items.sort((a, b) => (b.pct || 0) - (a.pct || 0));

                const labels = items.map(x => x.label);
                const values = items.map(x => Number((x.pct || 0).toFixed(2)));
                const colors = items.map(x => x.color);

                // Título
                const depName = ctx.departmentNames?.[ctx.currentDepartmentId] || ctx.currentDepartmentId;
                ctx.setTitle(`Proporción de la vocación de uso del suelo en el departamento de ${depName}`);

                // Doughnut (anillo)
                ctx.createChart(labels, values, colors, "doughnut", false);

                // Ajuste del hueco (cutout) para que se vea como tu imagen
                const activeChart = deps.getChart?.();
                if (activeChart) {
                activeChart.options.cutout = "60%";
                activeChart.update();
                }

                ctx.updateLegend(labels, colors);

            } catch (e) {
                console.error("VOCACION_DEPTO error:", e);
                ctx.updateLegend([], []);
                ctx.destroyChart();
            }
            }
        };
    }

export function dualLandSuitabilityHandler(deps = {}) {
    const {
        pctOfTotal, toNum, wrapLabel, sortMonths, arcRestQuery, fetchBF3Stats, fetchGroupedStats,
        getSymbolColorRGBA, buildLegendFromRenderer, ensureNonEmptyOrExit, pickExistingField,
        buildDictFromUniqueValueRenderer, createSoilOrderBubbleChart, createDualLandformCharts,
        createDualLandSuitabilityCharts, toggleLandformCharts, destroyLandformCharts, getAxisTitles
    } = deps;
        return {
            id: "vocacion-dual",
            when: ({ config }) => {
                return config?.isSuelos &&
                    config?.suelosType === "vocacion";
            },

            run: async (ctx) => {
                const { layer, config, destroyChart, updateLegend } = ctx;

                try {
                    ctx.setChartMessage?.(
                        "Cargando información de vocación y oferta edáfica...",
                        "Cargando información..."
                    );

                    await ensureLandSuitabilityDictionary();

                    const q = layer.createQuery();
                    q.where = layer.definitionExpression || ctx.whereBase || "1=1";
                    q.outFields = ["vocacion", "usopvoc", "porcentaje"];
                    q.returnGeometry = false;

                    const result = await (ctx.queryFeatures || ctx.cachedQueryFeatures || ((targetLayer, targetQuery) => targetLayer.queryFeatures(targetQuery)))(layer, q);
                    const features = result?.features || [];

                    if (!features.length) {
                        toggleLandformCharts(false);
                        destroyLandformCharts();
                        destroyChart?.();
                        updateLegend?.([], []);
                        return;
                    }

                    const landSuitabilityMap = new Map();
                    const usoMap = new Map();
                    const isDepartmentQuery = ctx.territoryLevel === "DEPTO" && !ctx.currentMunicipalityId;

                    for (const f of features) {
                        const a = f.attributes || {};
                        const voc = String(a.vocacion ?? "").trim();
                        const uso = String(a.usopvoc ?? "").trim();
                        const pct = Number(a.porcentaje) || 0;
                        if (!voc || !uso || pct <= 0) continue;

                        const vocLabel = landSuitabilityMainDictionary?.[voc]?.label || voc;
                        const pair = landSuitabilityRendererDictionary?.[`${voc}||${uso}`];
                        const usoLabel = pair?.usoLabel || uso;
                        const landSuitabilityColor = getLandSuitabilityColor(vocLabel);
                        const usoColor = getLandSuitabilityUseColor(vocLabel, usoLabel);

                        if (!landSuitabilityMap.has(voc)) {
                            landSuitabilityMap.set(voc, {
                                code: voc,
                                label: vocLabel,
                                color: landSuitabilityColor,
                                value: 0,
                                childCodes: new Set()
                            });
                        }

                        landSuitabilityMap.get(voc).value += pct;
                        landSuitabilityMap.get(voc).childCodes.add(`${voc},${uso}`);

                        const usoKey = `${voc}||${uso}`;
                        if (!usoMap.has(usoKey)) {
                            usoMap.set(usoKey, {
                                code: uso,
                                legendCode: `${voc},${uso}`,
                                landscapeCode: voc,
                                label: usoLabel,
                                legendLabel: `${vocLabel} - ${usoLabel}`,
                                landscapeLabel: vocLabel,
                                color: usoColor,
                                value: 0
                            });
                        }

                        usoMap.get(usoKey).value += pct;
                    }

                    if (isDepartmentQuery) {
                        const totalLandSuitability = Array.from(landSuitabilityMap.values())
                            .reduce((sum, row) => sum + (Number(row.value) || 0), 0);
                        const totalUso = Array.from(usoMap.values())
                            .reduce((sum, row) => sum + (Number(row.value) || 0), 0);

                        if (totalLandSuitability > 0) {
                            landSuitabilityMap.forEach(row => {
                                row.value = ((Number(row.value) || 0) / totalLandSuitability) * 100;
                            });
                        }

                        if (totalUso > 0) {
                            usoMap.forEach(row => {
                                row.value = ((Number(row.value) || 0) / totalUso) * 100;
                            });
                        }
                    }

                    const landSuitabilityRows = Array.from(landSuitabilityMap.values())
                        .map(row => ({
                            ...row,
                            value: +row.value.toFixed(2),
                            childCodes: Array.from(row.childCodes)
                        }))
                        .sort((a, b) => b.value - a.value);

                    const usoRows = Array.from(usoMap.values())
                        .map(row => ({
                            ...row,
                            value: +row.value.toFixed(2)
                        }))
                        .sort((a, b) => b.value - a.value);

                    ctx.setTitle?.("Distribución de vocaciones de los suelos y usos principales");

                    ctx.createChart(
                        usoRows.map(row => row.label),
                        usoRows.map(row => row.value),
                        usoRows.map(row => row.color),
                        "doughnut",
                        false,
                        [
                            {
                                label: "Vocaciones",
                                data: landSuitabilityRows.map(row => row.value),
                                backgroundColor: landSuitabilityRows.map(row => row.color),
                                borderColor: "#ffffff",
                                borderWidth: 2,
                                weight: 0.85,
                                __geoformasRing: "paisaje",
                                __segments: landSuitabilityRows
                            },
                            {
                                label: "Usos principales",
                                data: usoRows.map(row => row.value),
                                backgroundColor: usoRows.map(row => row.color),
                                borderColor: "#ffffff",
                                borderWidth: 2,
                                weight: 1.15,
                                __geoformasRing: "relieve",
                                __segments: usoRows
                            }
                        ]
                    );

                    updateLegend?.(
                        usoRows.map(r => r.legendLabel || `${r.landscapeLabel} - ${r.label}`),
                        usoRows.map(r => r.color),
                        usoRows.map(r => r.legendCode || `${r.landscapeCode},${r.code}`)
                    );
                } catch (error) {
                    console.error("VOCACION_DUAL error:", error);
                    toggleLandformCharts(false);
                    destroyLandformCharts();
                    destroyChart?.();
                    updateLegend?.([], []);
                }
            }
        };
    }
