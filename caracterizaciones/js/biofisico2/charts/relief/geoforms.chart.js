function renderGeoformasDualFromFeatures(ctx, features, deps = {}) {
    const { field1, field2, valueField } = ctx.config.geoAgg;
    const geoformasRendererDict = deps.getGeoformasRendererDict?.() || {};
    const getPaisajeColor = deps.getPaisajeColor || (() => "#888");
    const getGeoformaColor = deps.getGeoformaColor || (() => "#999");

    const paisajeMap = new Map();
    const relieveMap = new Map();

    for (const feature of features) {
        const attrs = feature.attributes || {};

        const paisajeCode = String(attrs[field1] ?? "").trim();
        const relieveCode = String(attrs[field2] ?? "").trim();
        const porcentaje = Number(attrs[valueField]) || 0;

        if (!paisajeCode || !relieveCode || porcentaje <= 0) continue;

        const pair = geoformasRendererDict?.[`${paisajeCode}||${relieveCode}`];

        const paisajeLabel = pair?.paisajeLabel || paisajeCode || "Sin dato";
        const relieveLabel = pair?.relieveLabel || relieveCode || "Sin dato";
        const paisajeColor = getPaisajeColor(paisajeLabel);
        const relieveColor = getGeoformaColor(paisajeLabel, relieveLabel);

        if (!paisajeMap.has(paisajeCode)) {
            paisajeMap.set(paisajeCode, {
                code: paisajeCode,
                label: paisajeLabel,
                color: paisajeColor,
                value: 0,
                childCodes: new Set()
            });
        }

        paisajeMap.get(paisajeCode).value += porcentaje;
        paisajeMap.get(paisajeCode).childCodes.add(`${paisajeCode},${relieveCode}`);

        const relieveKey = `${paisajeCode}||${relieveCode}`;
        if (!relieveMap.has(relieveKey)) {
            relieveMap.set(relieveKey, {
                code: relieveCode,
                legendCode: `${paisajeCode},${relieveCode}`,
                paisajeCode,
                label: relieveLabel,
                legendLabel: `${paisajeLabel} - ${relieveLabel}`,
                paisajeLabel,
                color: relieveColor,
                value: 0
            });
        }

        relieveMap.get(relieveKey).value += porcentaje;
    }

    const paisajeSegments = Array.from(paisajeMap.values())
        .filter(segment => Number(segment.value) > 0)
        .map(segment => ({
            ...segment,
            value: Number(segment.value.toFixed(2)),
            childCodes: Array.from(segment.childCodes)
        }))
        .sort((a, b) => String(a.label).localeCompare(String(b.label), "es"));

    const relieveSegments = Array.from(relieveMap.values())
        .filter(segment => Number(segment.value) > 0)
        .map(segment => ({
            ...segment,
            value: Number(segment.value.toFixed(2))
        }))
        .sort((a, b) => String(a.label).localeCompare(String(b.label), "es"));

    const labels = relieveSegments.map(segment => segment.label);
    const values = relieveSegments.map(segment => segment.value);
    const colors = relieveSegments.map(segment => segment.color);
    const datasets = [
        {
            label: "Paisajes",
            data: paisajeSegments.map(segment => segment.value),
            backgroundColor: paisajeSegments.map(segment => segment.color),
            borderColor: "#ffffff",
            borderWidth: 2,
            weight: 0.85,
            __geoformasRing: "paisaje",
            __segments: paisajeSegments
        },
        {
            label: "Tipos de relieve",
            data: values,
            backgroundColor: colors,
            borderColor: "#ffffff",
            borderWidth: 2,
            weight: 1.15,
            __geoformasRing: "relieve",
            __segments: relieveSegments
        }
    ];

    ctx.crearGrafica(labels, values, colors, "doughnut", false, datasets);

    ctx.actualizarLeyenda(
        relieveSegments.map(segment => segment.legendLabel || `${segment.paisajeLabel} - ${segment.label}`),
        relieveSegments.map(segment => segment.color),
        relieveSegments.map(segment => segment.legendCode || `${segment.paisajeCode},${segment.code}`)
    );
}

async function renderGeoformasDualDeptoFromArea(ctx, layer, deps = {}) {
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
        ctx.destroyGeoformasCharts?.();
        ctx.actualizarLeyenda([], []);
        return true;
    }

    const features = rows.map(row => ({
        attributes: {
            [field1]: row[field1],
            [field2]: row[field2],
            __pct: ((Number(row.sum_area) || 0) / total) * 100
        }
    }));

    const selectedDept = String(document.getElementById("departamentos")?.value || ctx.deptoActual || "").trim();
    const depName = ctx.diccionarioDepartamentos?.[selectedDept] ||
        ctx.diccionarioDepartamentos?.[ctx.deptoActual] ||
        ctx.deptoActual;
    const titleElement = document.getElementById("chartTitle");
    if (titleElement) {
        titleElement.textContent = `Distribución de Geoformas en ${depName}`;
    }
    renderGeoformasDualFromFeatures(
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

export function geoformasDualHandler(deps = {}) {
    return {
        when: (ctx) =>
            ctx.config?.isGeoforma &&
            ctx.config?.isGeoformaDualChart &&
            ctx.config?.geoAgg,

        run: async (ctx) => {
            const layer = ctx.layer;
            if (!layer || layer.destroyed) return;
            try {
                const selectedDept = String(document.getElementById("departamentos")?.value || ctx.deptoActual || "").trim();
                const selectedMuni = String(document.getElementById("municipios")?.value || "").trim();
                const isDepartmentOnly = Boolean(
                    selectedDept &&
                    selectedDept !== "0" &&
                    selectedDept !== "COL" &&
                    !selectedMuni
                );

                if (isDepartmentOnly) {
                    await renderGeoformasDualDeptoFromArea(ctx, layer, deps);
                    return;
                }

                const q = layer.createQuery();
                q.where = ctx.whereBase || "1=1";
                q.outFields = ctx.config.outFields;
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

                    ctx.destroyGeoformasCharts?.();
                    ctx.actualizarLeyenda([], []);
                    return;
                }

                const firstAttrs = res.features[0].attributes || {};
                let mpnombre = firstAttrs.mpnombre;
                let dpnombre = firstAttrs.dpnombre;

                if ((!mpnombre || !isNaN(mpnombre)) && ctx.municipioActual) {
                    mpnombre = ctx.diccionarioMunicipios?.[ctx.municipioActual] || ctx.municipioActual;
                }

                if ((!dpnombre || !isNaN(dpnombre)) && ctx.municipioActual) {
                    const dpCode = String(ctx.municipioActual).substring(0, 2);
                    dpnombre = ctx.diccionarioDepartamentos?.[dpCode] || dpCode;
                }

                ctx.actualizarTituloGrafico(ctx.config, mpnombre, dpnombre);
                renderGeoformasDualFromFeatures(ctx, res.features, deps);
            } catch (e) {
                console.error("GEOFORMAS_DUAL error:", e);
                ctx.destroyGeoformasCharts?.();
                ctx.actualizarLeyenda([], []);
            }
        }
    };
}

export function bf3GeoformasDeptoPieHandler(deps = {}) {
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
                    ctx.actualizarLeyenda([], []);
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
                    ctx.actualizarLeyenda([], []);
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
                    ctx.actualizarLeyenda([], []);
                    console.warn("BF3: Sumatoria Shape_Area del depto = 0");
                    return;
                }

                const paisDict = ctx.buildPaisajeDictFromRenderer(bf3Layer);
                let totalAreat = 0;
                for (const value of aggNumByCat.values()) totalAreat += value;

                if (totalAreat <= 0) {
                    ctx.destroyChart();
                    ctx.actualizarLeyenda([], []);
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

                ctx.crearGrafica(labels, values, colors, "pie", false);
                ctx.actualizarLeyenda(labels, colors);
            } catch (e) {
                console.error("BF3 error:", e);
                ctx.actualizarLeyenda([], []);
            }
        }
    };
}
