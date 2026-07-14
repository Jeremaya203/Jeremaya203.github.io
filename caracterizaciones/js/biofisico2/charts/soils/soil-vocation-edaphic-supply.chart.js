import {
    coloresOrdenSuelo,
    ruralCategoriaDict,
    geoformasRendererDict,
    geoformasPaisajeDict,
    vocacionRendererDict,
    vocacionMainDict,
    ensureOrdenSueloDict,
    ensureRuralCategoriaDict,
    ensureGeoformasDict,
    ensureVocacionDict,
    getVocacionColor,
    getVocacionUsoColor,
    getGeoformaColor,
    getPaisajeColor
} from "../../services/biofisicoLayer.service.js";
import {
    queryGroupSum,
    queryTotalSum,
    mergePctWithDict,
    sortItems,
    fenomenosMeta,
    fenomenosTitle,
    clasesDegradacion,
    ORDEN_DEGRADACION,
    ORDEN_SISMICA
} from "../chartUtils.js";

export function vocacionDeptoDonutHandler(deps = {}) {
    const {
        pctOfTotal, toNum, wrapLabel, ordenarMeses, arcRestQuery, fetchBF3Stats, fetchGroupedStats,
        getSymbolColorRGBA, buildLegendFromRenderer, ensureNonEmptyOrExit, pickExistingField,
        buildDictFromUniqueValueRenderer, crearGraficaBubbleOrdenSuelo, crearGraficasGeoformasDual,
        crearGraficasVocacionDual, toggleGeoformasCharts, destroyGeoformasCharts, getAxisTitles
    } = deps;
        return {
            when: (ctx) =>
            ctx.filtroNivel === "DEPTO" &&
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
                ctx.actualizarLeyenda([], []);
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
                const depName = ctx.diccionarioDepartamentos?.[ctx.deptoActual] || ctx.deptoActual;
                ctx.setTitle(`Proporción de la vocación de uso del suelo en el departamento de ${depName}`);

                // Doughnut (anillo)
                ctx.crearGrafica(labels, values, colors, "doughnut", false);

                // Ajuste del hueco (cutout) para que se vea como tu imagen
                const activeChart = deps.getChart?.();
                if (activeChart) {
                activeChart.options.cutout = "60%";
                activeChart.update();
                }

                ctx.actualizarLeyenda(labels, colors);

            } catch (e) {
                console.error("VOCACION_DEPTO error:", e);
                ctx.actualizarLeyenda([], []);
                ctx.destroyChart();
            }
            }
        };
    }

export function vocacionDualHandler(deps = {}) {
    const {
        pctOfTotal, toNum, wrapLabel, ordenarMeses, arcRestQuery, fetchBF3Stats, fetchGroupedStats,
        getSymbolColorRGBA, buildLegendFromRenderer, ensureNonEmptyOrExit, pickExistingField,
        buildDictFromUniqueValueRenderer, crearGraficaBubbleOrdenSuelo, crearGraficasGeoformasDual,
        crearGraficasVocacionDual, toggleGeoformasCharts, destroyGeoformasCharts, getAxisTitles
    } = deps;
        return {
            id: "vocacion-dual",
            when: ({ config }) => {
                return config?.isSuelos &&
                    config?.suelosType === "vocacion";
            },

            run: async (ctx) => {
                const { layer, config, destroyChart, actualizarLeyenda } = ctx;

                try {
                    ctx.setChartMessage?.(
                        "Cargando información de vocación y oferta edáfica...",
                        "Cargando información..."
                    );

                    await ensureVocacionDict();

                    const q = layer.createQuery();
                    q.where = layer.definitionExpression || ctx.whereBase || "1=1";
                    q.outFields = ["vocacion", "usopvoc", "porcentaje"];
                    q.returnGeometry = false;

                    const result = await (ctx.queryFeatures || ctx.cachedQueryFeatures || ((targetLayer, targetQuery) => targetLayer.queryFeatures(targetQuery)))(layer, q);
                    const features = result?.features || [];

                    if (!features.length) {
                        toggleGeoformasCharts(false);
                        destroyGeoformasCharts();
                        destroyChart?.();
                        actualizarLeyenda?.([], []);
                        return;
                    }

                    const vocacionMap = new Map();
                    const usoMap = new Map();
                    const isDepartmentQuery = ctx.filtroNivel === "DEPTO" && !ctx.municipioActual;

                    for (const f of features) {
                        const a = f.attributes || {};
                        const voc = String(a.vocacion ?? "").trim();
                        const uso = String(a.usopvoc ?? "").trim();
                        const pct = Number(a.porcentaje) || 0;
                        if (!voc || !uso || pct <= 0) continue;

                        const vocLabel = vocacionMainDict?.[voc]?.label || voc;
                        const pair = vocacionRendererDict?.[`${voc}||${uso}`];
                        const usoLabel = pair?.usoLabel || uso;
                        const vocacionColor = getVocacionColor(vocLabel);
                        const usoColor = getVocacionUsoColor(vocLabel, usoLabel);

                        if (!vocacionMap.has(voc)) {
                            vocacionMap.set(voc, {
                                code: voc,
                                label: vocLabel,
                                color: vocacionColor,
                                value: 0,
                                childCodes: new Set()
                            });
                        }

                        vocacionMap.get(voc).value += pct;
                        vocacionMap.get(voc).childCodes.add(`${voc},${uso}`);

                        const usoKey = `${voc}||${uso}`;
                        if (!usoMap.has(usoKey)) {
                            usoMap.set(usoKey, {
                                code: uso,
                                legendCode: `${voc},${uso}`,
                                paisajeCode: voc,
                                label: usoLabel,
                                legendLabel: `${vocLabel} - ${usoLabel}`,
                                paisajeLabel: vocLabel,
                                color: usoColor,
                                value: 0
                            });
                        }

                        usoMap.get(usoKey).value += pct;
                    }

                    if (isDepartmentQuery) {
                        const totalVocacion = Array.from(vocacionMap.values())
                            .reduce((sum, row) => sum + (Number(row.value) || 0), 0);
                        const totalUso = Array.from(usoMap.values())
                            .reduce((sum, row) => sum + (Number(row.value) || 0), 0);

                        if (totalVocacion > 0) {
                            vocacionMap.forEach(row => {
                                row.value = ((Number(row.value) || 0) / totalVocacion) * 100;
                            });
                        }

                        if (totalUso > 0) {
                            usoMap.forEach(row => {
                                row.value = ((Number(row.value) || 0) / totalUso) * 100;
                            });
                        }
                    }

                    const vocacionRows = Array.from(vocacionMap.values())
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

                    ctx.crearGrafica(
                        usoRows.map(row => row.label),
                        usoRows.map(row => row.value),
                        usoRows.map(row => row.color),
                        "doughnut",
                        false,
                        [
                            {
                                label: "Vocaciones",
                                data: vocacionRows.map(row => row.value),
                                backgroundColor: vocacionRows.map(row => row.color),
                                borderColor: "#ffffff",
                                borderWidth: 2,
                                weight: 0.85,
                                __geoformasRing: "paisaje",
                                __segments: vocacionRows
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

                    actualizarLeyenda?.(
                        usoRows.map(r => r.legendLabel || `${r.paisajeLabel} - ${r.label}`),
                        usoRows.map(r => r.color),
                        usoRows.map(r => r.legendCode || `${r.paisajeCode},${r.code}`)
                    );
                } catch (error) {
                    console.error("VOCACION_DUAL error:", error);
                    toggleGeoformasCharts(false);
                    destroyGeoformasCharts();
                    destroyChart?.();
                    actualizarLeyenda?.([], []);
                }
            }
        };
    }
