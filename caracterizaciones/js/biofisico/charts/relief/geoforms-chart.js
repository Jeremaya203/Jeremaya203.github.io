function renderDualLandformsFromFeatures(ctx, features, deps = {}) {
    const { field1, field2, valueField } = ctx.config.geoAgg;
    const landformRendererDictionary = deps.getGeoformasRendererDict?.() || {};
    const getLandscapeColor = deps.getLandscapeColor || (() => "#888");
    const getLandformColor = deps.getLandformColor || (() => "#999");

    const landscapeMap = new Map();
    const reliefMap = new Map();

    for (const feature of features) {
        const attrs = feature.attributes || {};

        const landscapeCode = String(attrs[field1] ?? "").trim();
        const reliefCode = String(attrs[field2] ?? "").trim();
        const percentage = Number(attrs[valueField]) || 0;

        if (!landscapeCode || !reliefCode || percentage <= 0) continue;

        const pair = landformRendererDictionary?.[`${landscapeCode}||${reliefCode}`];

        const landscapeLabel = pair?.landscapeLabel || landscapeCode || "Sin dato";
        const reliefLabel = pair?.reliefLabel || reliefCode || "Sin dato";
        const landscapeColor = getLandscapeColor(landscapeLabel);
        const reliefColor = getLandformColor(landscapeLabel, reliefLabel);

        if (!landscapeMap.has(landscapeCode)) {
            landscapeMap.set(landscapeCode, {
                code: landscapeCode,
                label: landscapeLabel,
                color: landscapeColor,
                value: 0,
                childCodes: new Set()
            });
        }

        landscapeMap.get(landscapeCode).value += percentage;
        landscapeMap.get(landscapeCode).childCodes.add(`${landscapeCode},${reliefCode}`);

        const reliefKey = `${landscapeCode}||${reliefCode}`;
        if (!reliefMap.has(reliefKey)) {
            reliefMap.set(reliefKey, {
                code: reliefCode,
                legendCode: `${landscapeCode},${reliefCode}`,
                landscapeCode,
                label: reliefLabel,
                legendLabel: `${landscapeLabel} - ${reliefLabel}`,
                landscapeLabel,
                color: reliefColor,
                value: 0
            });
        }

        reliefMap.get(reliefKey).value += percentage;
    }

    const landscapeSegments = Array.from(landscapeMap.values())
        .filter(segment => Number(segment.value) > 0)
        .map(segment => ({
            ...segment,
            value: Number(segment.value.toFixed(2)),
            childCodes: Array.from(segment.childCodes)
        }))
        .sort((a, b) => String(a.label).localeCompare(String(b.label), "es"));

    const reliefSegments = Array.from(reliefMap.values())
        .filter(segment => Number(segment.value) > 0)
        .map(segment => ({
            ...segment,
            value: Number(segment.value.toFixed(2))
        }))
        .sort((a, b) => String(a.label).localeCompare(String(b.label), "es"));

    const labels = reliefSegments.map(segment => segment.label);
    const values = reliefSegments.map(segment => segment.value);
    const colors = reliefSegments.map(segment => segment.color);
    const datasets = [
        {
            label: "Paisajes",
            data: landscapeSegments.map(segment => segment.value),
            backgroundColor: landscapeSegments.map(segment => segment.color),
            borderColor: "#ffffff",
            borderWidth: 2,
            weight: 0.85,
            __geoformasRing: "paisaje",
            __segments: landscapeSegments
        },
        {
            label: "Tipos de relieve",
            data: values,
            backgroundColor: colors,
            borderColor: "#ffffff",
            borderWidth: 2,
            weight: 1.15,
            __geoformasRing: "relieve",
            __segments: reliefSegments
        }
    ];

    ctx.createChart(labels, values, colors, "doughnut", false, datasets);

    ctx.updateLegend(
        reliefSegments.map(segment => segment.legendLabel || `${segment.landscapeLabel} - ${segment.label}`),
        reliefSegments.map(segment => segment.color),
        reliefSegments.map(segment => segment.legendCode || `${segment.landscapeCode},${segment.code}`)
    );
}

async function renderDualLandformsDepartmentFromArea(ctx, layer, deps = {}) {
    const { field1, field2 } = ctx.config.geoAgg;
    const areaField = typeof deps.pickExistingField === "function"
        ? (deps.pickExistingField(layer, [
            "areat",
            "shape_area",
            "shape__area",
            "Shape_Area",
            "Shape__Area",
            "st_area(shape)",
            "st_area",
            "mparea"
        ]) || "areat")
        : "areat";

    const js = await ctx.arcRestQuery(ctx.config.url || layer.url, {
        f: "json",
        where: ctx.whereBase || "1=1",
        groupByFieldsForStatistics: `${field1},${field2}`,
        outStatistics: JSON.stringify([{
            statisticType: "sum",
            onStatisticField: areaField,
            outStatisticFieldName: "sum_area"
        }]),
        returnGeometry: "false"
    });

    const rows = (js.features || [])
        .map(feature => feature.attributes || {})
        .filter(row => Number(row.sum_area) > 0);

    const total = rows.reduce((acc, row) => acc + (Number(row.sum_area) || 0), 0);
    if (total <= 0) {
        ctx.destroyLandformCharts?.();
        ctx.updateLegend([], []);
        return true;
    }

    const features = rows.map(row => ({
        attributes: {
            [field1]: row[field1],
            [field2]: row[field2],
            __pct: ((Number(row.sum_area) || 0) / total) * 100
        }
    }));

    const selectedDept = String(document.getElementById("departamentos")?.value || ctx.currentDepartmentId || "").trim();
    const depName = ctx.departmentNames?.[selectedDept] ||
        ctx.departmentNames?.[ctx.currentDepartmentId] ||
        ctx.currentDepartmentId;
    const titleElement = document.getElementById("chartTitle");
    if (titleElement) {
        titleElement.textContent = `Distribución de Geoformas en ${depName}`;
    }
    renderDualLandformsFromFeatures(
        {
            ...ctx,
            config: {
                ...ctx.config,
                geoAgg: {
                    ...ctx.config.geoAgg,
                    valueField: "__pct"
                }
            }
        },
        features,
        deps
    );

    return true;
}

export function dualLandformsHandler(deps = {}) {
    return {
        when: (ctx) =>
            ctx.config?.isGeoforma &&
            ctx.config?.isGeoformaDualChart &&
            ctx.config?.geoAgg,

        run: async (ctx) => {
            const layer = ctx.layer;
            if (!layer || layer.destroyed) return;
            try {
                const selectedDept = String(document.getElementById("departamentos")?.value || ctx.currentDepartmentId || "").trim();
                const selectedMuni = String(document.getElementById("municipios")?.value || "").trim();
                const isDepartmentOnly = Boolean(
                    selectedDept &&
                    selectedDept !== "0" &&
                    selectedDept !== "COL" &&
                    !selectedMuni
                );

                if (isDepartmentOnly) {
                    await renderDualLandformsDepartmentFromArea(ctx, layer, deps);
                    return;
                }

                const q = layer.createQuery();
                q.where = ctx.whereBase || "1=1";
                q.outFields = ctx.config.outFields;
                q.returnGeometry = false;

                const res = await (ctx.queryFeatures || ctx.cachedQueryFeatures || ((targetLayer, targetQuery) => targetLayer.queryFeatures(targetQuery)))(layer, q);
                if (!res.features?.length) {
                    if (ctx.territoryLevel === "DEPTO" && ctx.currentDepartmentId) {
                        const departmentCode = Number(ctx.currentDepartmentId);
                        if (Number.isFinite(departmentCode)) {
                            const altWhere = `dpcodigo = ${departmentCode}`;
                            if (ctx.whereBase !== altWhere) {
                                ctx.whereBase = altWhere;
                                ctx.setWhereBase?.(altWhere);
                                ctx.applyWhereToActiveLayers?.(altWhere);
                                ctx.loadCurrentLayer?.();
                                return;
                            }
                        }
                    }

                    ctx.destroyLandformCharts?.();
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
                renderDualLandformsFromFeatures(ctx, res.features, deps);
            } catch (e) {
                console.error("GEOFORMAS_DUAL error:", e);
                ctx.destroyLandformCharts?.();
                ctx.updateLegend([], []);
            }
        }
    };
}

export function bf3LandformsDepartmentPieHandler(deps = {}) {
    const normKey = deps.normKey || ((value) => String(value ?? "").trim().toLowerCase());

    return {
        when: (ctx) =>
            ctx.config?.isBF3 &&
            ctx.config?.bf3,

        run: async (ctx) => {
            try {
                const where = ctx.whereBase || "1=1";
                const bf3Layer = ctx.lyr || ctx.layer;
                await bf3Layer.when();

                const shapeAreaField = (typeof deps.pickExistingField === "function")
                    ? deps.pickExistingField(bf3Layer, [
                        "st_area(shape)",
                        "shape_area",
                        "shape__area",
                        "Shape_Area",
                        "Shape__Area"
                    ])
                    : null;

                if (!shapeAreaField) {
                    console.error("BF3: No se encontró campo Shape_Area/Shape__Area/shape_area en la capa.");
                    ctx.destroyChart();
                    ctx.updateLegend([], []);
                    return;
                }

                const rows = await deps.fetchBF3Stats({
                    layerUrl: ctx.config.url || ctx.layer.url,
                    where,
                    groupField: ctx.config.bf3.groupField,
                    numField: ctx.config.bf3.numField,
                    denField: shapeAreaField
                });

                if (!rows.length) {
                    ctx.destroyChart();
                    ctx.updateLegend([], []);
                    return;
                }

                let sumShapeAreaDept = 0;
                const aggNumByCat = new Map();

                for (const row of rows) {
                    const cat = row[ctx.config.bf3.groupField];
                    const sumNum = Number(row.sum_num) || 0;
                    const sumDen = Number(row.sum_den) || 0;

                    sumShapeAreaDept += sumDen;

                    const key = (cat == null || cat === "") ? "SIN_DATO" : String(cat);
                    aggNumByCat.set(key, (aggNumByCat.get(key) || 0) + sumNum);
                }

                if (sumShapeAreaDept <= 0) {
                    ctx.destroyChart();
                    ctx.updateLegend([], []);
                    console.warn("BF3: Sumatoria Shape_Area del depto = 0");
                    return;
                }

                const paisDict = ctx.buildLandscapeDictionaryFromRenderer(bf3Layer);
                let totalAreat = 0;
                for (const value of aggNumByCat.values()) totalAreat += value;

                if (totalAreat <= 0) {
                    ctx.destroyChart();
                    ctx.updateLegend([], []);
                    console.warn("BF3: Sumatoria areat del depto = 0");
                    return;
                }

                const entries = Array.from(aggNumByCat.entries())
                    .map(([code, sumAreat]) => {
                        const info = paisDict.get(String(code)) || paisDict.get(normKey(code));
                        const label = info?.label || String(code);
                        const color = info?.color || "#999";
                        const pct = (sumAreat / totalAreat) * 100;

                        return { code: String(code), label, color, pct };
                    })
                    .filter(item => Number.isFinite(item.pct))
                    .sort((a, b) => b.pct - a.pct);

                ctx.setBf3LabelToCode(new Map(entries.map(entry => [entry.label, entry.code])));

                const labels = entries.map(entry => entry.label);
                const values = entries.map(entry => Number(entry.pct.toFixed(3)));
                const colors = entries.map(entry => entry.color);

                ctx.createChart(labels, values, colors, "pie", false);
                ctx.updateLegend(labels, colors);
            } catch (e) {
                console.error("BF3 error:", e);
                ctx.updateLegend([], []);
            }
        }
    };
}
