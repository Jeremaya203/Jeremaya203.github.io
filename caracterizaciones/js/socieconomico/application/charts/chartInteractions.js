import { getSqlValue, normalizeChartLabel } from "./core/chartUtils.js";

export function createChartInteractions({
    chartCore,
    getView,
    getLayerGlobal,
    getLayersGlobal,
    getHighlightHandle,
    setHighlightHandle,
    applyWhereToActiveLayers,
    getDiccionarioDepartamentos,
    getWhereBase,
    getFiltroNivel,
    getMunicipioActual
}) {
    const chartSelectionColor = "#166534";
    const chartDefaultColor = "#16a34a";
    const chartBorderColor = "#15803d";
    const municipalityScopedLayerFilters = new Map();

    function transparentize(color, alpha = 0.35) {
        const rgba = String(color || "").match(/rgba?\(([^)]+)\)/i);
        if (!rgba) return color || chartDefaultColor;
        const parts = rgba[1].split(",").map(part => part.trim());
        return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
    }

    function scrollChartToLabel(label) {
        const canvas = document.getElementById("chart");
        const chartScroll = document.getElementById("pibChartScroll");
        if (!canvas || !chartScroll || !label) return;

        const chartInstance = chartCore.getInstance();
        const labels = chartInstance?.data?.labels || [...chartCore.getRowsByLabel().keys()];
        const index = labels.findIndex(item => normalizeChartLabel(item) === normalizeChartLabel(label));
        if (index < 0) return;

        let targetX = 0;
        const xScale = chartInstance?.scales?.x;
        if (xScale && typeof xScale.getPixelForValue === "function") {
            targetX = xScale.getPixelForValue(label);
            if (!Number.isFinite(targetX)) targetX = xScale.getPixelForValue(index);
        } else {
            targetX = ((index + 0.5) / Math.max(labels.length, 1)) * canvas.clientWidth;
        }

        const left = Math.max(0, targetX - chartScroll.clientWidth / 2);
        chartScroll.scrollTo({ left, behavior: "smooth" });
    }

    function updateChartSelection(label, options = {}) {
        chartCore.setSelectedLabel(label);
        const chartInstance = chartCore.getInstance();
        if (!chartInstance) return;
        const rowsByLabel = chartCore.getRowsByLabel();
        const allLabels = [...rowsByLabel.keys()];
        const exclusive = options.exclusiveCategory === true;
        const solidSiblings = options.solidSiblings === true;
        const labels = exclusive && label ? [label] : allLabels;
        chartInstance.data.labels = labels;
        const dataset = chartInstance.data?.datasets?.[0];
        if (!dataset) return;
        dataset.data = labels.map(item => rowsByLabel.get(item)?.value ?? null);
        dataset.backgroundColor = labels.map(item => {
            const rowColor = rowsByLabel.get(item)?.color || chartDefaultColor;
            if (!label) return rowColor;
            return item === label || exclusive
                ? (options.selectedFillColor || rowColor)
                : (solidSiblings ? rowColor : transparentize(rowColor, 0.35));
        });
        dataset.borderColor = labels.map(item =>
            label && item === label
                ? (options.selectedBorderColor || chartSelectionColor)
                : (rowsByLabel.get(item)?.color || chartBorderColor)
        );
        const selectedBorderWidth = Number.isFinite(options.selectedBorderWidth) ? options.selectedBorderWidth : 3;
        const defaultBorderWidth = Number.isFinite(options.defaultBorderWidth) ? options.defaultBorderWidth : 1;
        dataset.borderWidth = labels.map(item => label && item === label ? selectedBorderWidth : defaultBorderWidth);
        chartInstance.update();
        scrollChartToLabel(label);
    }

    function syncChartLegendFilter(codes = null) {
        const chartInstance = chartCore.getInstance();
        if (!chartInstance) return;

        const rowsByLabel = chartCore.getRowsByLabel();
        const allLabels = [...rowsByLabel.keys()];
        const normalizedCodes = Array.isArray(codes)
            ? codes.map(value => normalizeChartLabel(value)).filter(Boolean)
            : null;
        const labels = normalizedCodes
            ? allLabels.filter(label => {
                const row = rowsByLabel.get(label);
                return normalizedCodes.includes(normalizeChartLabel(row?.rawLabel || label));
            })
            : allLabels;

        chartCore.setSelectedLabel(labels.length === 1 ? labels[0] : null);
        chartInstance.data.labels = labels;
        const dataset = chartInstance.data?.datasets?.[0];
        if (!dataset) return;
        dataset.data = labels.map(item => rowsByLabel.get(item)?.value ?? null);
        dataset.backgroundColor = labels.map(item => rowsByLabel.get(item)?.color || chartDefaultColor);
        dataset.borderColor = labels.map(item => rowsByLabel.get(item)?.color || chartBorderColor);
        dataset.borderWidth = labels.map(() => 1);
        chartInstance.update();
    }

    function installDefaultLegendHooks() {
        window.__restoreChartCategoryFilter = () => {
            updateChartSelection(null, { exclusiveCategory: false });
        };
        window.__syncChartLegendFilter = syncChartLegendFilter;
    }

    installDefaultLegendHooks();

    function findMatchingLabel(value) {
        const requested = String(value ?? "").trim();
        const chartInstance = chartCore.getInstance();
        const rowsByLabel = chartCore.getRowsByLabel();
        const labels = chartInstance?.data?.labels || [...rowsByLabel.keys()];
        return labels.find(label => {
            const row = rowsByLabel.get(label);
            return normalizeChartLabel(label) === normalizeChartLabel(requested) ||
                normalizeChartLabel(row?.rawLabel) === normalizeChartLabel(requested);
        }) || requested;
    }

    function highlightBar(department, options = {}) {
        const matched = findMatchingLabel(department);
        const rowsByLabel = chartCore.getRowsByLabel();
        updateChartSelection(matched, options);
        return rowsByLabel.get(matched) ? matched : null;
    }

    function syncLegendToCategory(code, { hideOthers = false } = {}) {
        const normalized = String(code ?? "").trim();
        if (!normalized) return;

        const state = window.__legendState;
        if (state) {
            state.visibleCodes = hideOthers ? new Set([normalized]) : null;
            state.activeCodes = new Set([normalized]);
        }

        document.querySelectorAll("#legendContent .legend-item").forEach(node => {
            const itemCode = String(node.dataset.code ?? "").trim();
            const selected = itemCode === normalized;
            const visible = !hideOthers || selected;
            node.style.display = visible ? "" : "none";
            node.classList.toggle("active", selected);
            node.classList.toggle("off", !selected);
        });
    }

    function resolveDepartmentCodeFromChartValue(selectedValue) {
        const matched = findMatchingLabel(selectedValue);
        const selectedRow = chartCore.getRowsByLabel().get(String(matched ?? "").trim());
        const directCode = String(selectedRow?.rawLabel ?? "").trim();
        if (directCode) return directCode;

        const requested = normalizeChartLabel(selectedValue);
        const departments = getDiccionarioDepartamentos?.() || {};
        const matchedEntry = Object.entries(departments).find(([code, name]) =>
            normalizeChartLabel(code) === requested ||
            normalizeChartLabel(name) === requested
        );

        return matchedEntry?.[0] || "";
    }

    async function navigatePibDepartmentFromChart(selectedValue) {
        const departmentCode = resolveDepartmentCodeFromChartValue(selectedValue);
        const departmentsSelect = document.getElementById("departamentos");
        if (!departmentCode || !departmentsSelect) return null;

        const currentHighlight = getHighlightHandle?.();
        if (currentHighlight) {
            currentHighlight.remove();
            setHighlightHandle?.(null);
        }

        highlightBar(selectedValue, {
            exclusiveCategory: false,
            solidSiblings: true,
            selectedFillColor: "#166534",
            selectedBorderColor: "#14532d",
            selectedBorderWidth: 1
        });

        departmentsSelect.value = departmentCode;
        departmentsSelect.dispatchEvent(new Event("change"));
        return findMatchingLabel(selectedValue);
    }

    async function clearCategorySelection() {
        await restoreMunicipalityScopedFilters();
        const currentHighlight = getHighlightHandle?.();
        if (currentHighlight) {
            currentHighlight.remove();
            setHighlightHandle?.(null);
        }

        updateChartSelection(null, { exclusiveCategory: false });
        await window.__setLegendVisibleCodes?.(null);
    }

    async function restoreMunicipalityScopedFilters() {
        const entries = [...municipalityScopedLayerFilters.entries()];
        municipalityScopedLayerFilters.clear();
        await Promise.all(entries.map(async ([targetLayer, baseFilter]) => {
            if (!targetLayer || targetLayer.destroyed || !getView?.()) return;
            try {
                const layerView = await getView().whenLayerView(targetLayer);
                layerView.filter = baseFilter && baseFilter !== "1=1" ? { where: baseFilter } : null;
            } catch (_) {}
        }));
    }

    async function toggleMunicipalityScopedMapSelection(layer, chartConfig, selectedValue) {
        const view = getView?.();
        const municipalityCode = String(getMunicipioActual?.() || "").trim();
        const municipalityWhere = String(getWhereBase?.() || "").trim();
        const field = chartConfig?.mapInteractionField || chartConfig?.xAxis?.field;
        if (!view || !layer || !field || !municipalityCode || !municipalityWhere) return null;

        const matched = findMatchingLabel(selectedValue);
        const selectedRow = chartCore.getRowsByLabel().get(String(matched ?? "").trim());
        const mapValue = selectedRow?.rawLabel ?? selectedValue;
        const currentLabel = chartCore.getSelectedLabel();
        const isSameSelection = normalizeChartLabel(currentLabel) === normalizeChartLabel(matched)
            || normalizeChartLabel(currentLabel) === normalizeChartLabel(mapValue);

        if (isSameSelection) {
            const currentHighlight = getHighlightHandle?.();
            currentHighlight?.remove?.();
            setHighlightHandle?.(null);
            updateChartSelection(null, { exclusiveCategory: false });
            await restoreMunicipalityScopedFilters();
            return null;
        }

        const layerView = await view.whenLayerView(layer);
        if (!municipalityScopedLayerFilters.has(layer)) {
            municipalityScopedLayerFilters.set(
                layer,
                String(layerView.filter?.where || layer.definitionExpression || "1=1").trim() || "1=1"
            );
        }

        const baseFilter = municipalityScopedLayerFilters.get(layer) || "1=1";
        const categoryWhere = `${field} = '${getSqlValue(mapValue)}'`;
        const contextWhere = `((${baseFilter}) AND NOT (${municipalityWhere}))`;
        const selectedMunicipalityWhere = `((${municipalityWhere}) AND (${categoryWhere}))`;
        layerView.filter = { where: `${contextWhere} OR ${selectedMunicipalityWhere}` };

        const currentHighlight = getHighlightHandle?.();
        currentHighlight?.remove?.();
        setHighlightHandle?.(null);

        try {
            const query = layer.createQuery();
            query.where = selectedMunicipalityWhere;
            query.outFields = [layer.objectIdField || "OBJECTID"];
            query.returnGeometry = false;
            const result = await layer.queryFeatures(query);
            const objectIdField = layer.objectIdField || "OBJECTID";
            const objectIds = (result?.features || [])
                .map(feature => feature.attributes?.[objectIdField])
                .filter(value => value != null);
            if (objectIds.length) setHighlightHandle?.(layerView.highlight(objectIds));
        } catch (_) {}

        updateChartSelection(matched, { exclusiveCategory: false });
        return matched;
    }

    async function toggleChartMapSelection(layer, chartConfig, selectedValue) {
        if (chartConfig?.id === "pib-departamental") {
            return navigatePibDepartmentFromChart(selectedValue);
        }

        if (chartConfig?.municipalityScopedMapInteraction === true
            && getFiltroNivel?.() === "MUNI"
            && String(getMunicipioActual?.() || "").trim()) {
            return toggleMunicipalityScopedMapSelection(layer, chartConfig, selectedValue);
        }

        const matched = findMatchingLabel(selectedValue);
        const selectedRow = chartCore.getRowsByLabel().get(String(matched ?? "").trim());
        const mapValue = selectedRow?.rawLabel ?? selectedValue;
        const currentLabel = chartCore.getSelectedLabel();
        const isSameSelection = normalizeChartLabel(currentLabel) === normalizeChartLabel(matched) ||
            normalizeChartLabel(currentLabel) === normalizeChartLabel(mapValue);

        if (isSameSelection) {
            await clearCategorySelection();
            return null;
        }

        highlightBar(selectedValue, chartConfig?.id === "pib-departamental"
            ? {
                exclusiveCategory: false,
                solidSiblings: true,
                selectedFillColor: "#166534",
                selectedBorderColor: "#14532d",
                selectedBorderWidth: 1
            }
            : { exclusiveCategory: false });
        await highlightMapByChartValue(layer, chartConfig, selectedValue);
        return matched;
    }

    async function highlightMapByChartValue(layer, chartConfig, selectedValue) {
        const xField = chartConfig?.mapInteractionField || chartConfig?.xAxis?.field;
        const view = getView?.();
        if (!layer || !xField || selectedValue == null || !view) return;

        const selectedRow = chartCore.getRowsByLabel().get(String(selectedValue ?? "").trim());
        const mapValue = selectedRow?.rawLabel ?? selectedValue;
        const categoryWhere = `${xField} = '${getSqlValue(mapValue)}'`;
        const baseWhere = String(window.__legendState?.baseWhere || "").trim();
        const where = baseWhere && baseWhere !== "1=1"
            ? `(${baseWhere}) AND (${categoryWhere})`
            : categoryWhere;

        syncLegendToCategory(mapValue, { hideOthers: true });
        await window.__setLegendVisibleCodes?.([mapValue]);

        const targetLayers = chartConfig?.mapInteraction?.allLayers
            ? (getLayersGlobal?.() || []).filter(Boolean)
            : [layer].filter(Boolean);

        try {
            const currentHighlight = getHighlightHandle?.();
            if (currentHighlight) {
                currentHighlight.remove();
                setHighlightHandle?.(null);
            }

            const handles = [];
            for (const targetLayer of targetLayers) {
                const query = targetLayer.createQuery();
                query.where = where;
                const objectIdField = targetLayer.objectIdField || "OBJECTID";
                query.outFields = [objectIdField, xField];
                query.returnGeometry = false;
                const result = await targetLayer.queryFeatures(query);
                const objectIds = (result.features || [])
                    .map(feature => feature.attributes?.[objectIdField] ?? feature.attributes?.OBJECTID ?? feature.attributes?.objectid)
                    .filter(value => value != null);
                if (objectIds.length) {
                    try {
                        const layerView = await view.whenLayerView(targetLayer);
                        handles.push(layerView.highlight(objectIds));
                    } catch (_) {
                        // Hidden or scale-limited layers may not have a layer view ready yet.
                    }
                }
            }

            if (handles.length) {
                setHighlightHandle?.({
                    remove() {
                        handles.forEach(handle => handle.remove?.());
                    }
                });
            }

            if (!chartConfig?.mapInteraction?.preserveView) {
                const extents = await Promise.all(targetLayers
                    .map(targetLayer => targetLayer.queryExtent({ where }).catch(() => null)));
                const firstExtent = extents.find(item => item?.extent)?.extent;
                if (firstExtent) await view.goTo(firstExtent.expand(1.2));
            }
        } catch (e) {
            console.warn("No se pudo resaltar el mapa desde el gráfico:", e);
        }
    }

    async function handleMapClick(event, { chartConfig }) {
        const xField = chartConfig?.mapInteractionField || chartConfig?.xAxis?.field;
        const view = getView?.();
        if (!chartConfig || !xField || !view) return;

        const hit = await view.hitTest(event);
        const layersGlobal = getLayersGlobal?.() || [];
        const layerGlobal = getLayerGlobal?.();
        const graphic = hit?.results
            ?.map(result => result.graphic)
            ?.find(item => item?.layer === layerGlobal || layersGlobal.includes(item?.layer));
        const selectedValue = graphic?.attributes?.[xField]
            || (graphic?.attributes?.dpcodigo ? getDiccionarioDepartamentos?.()?.[graphic.attributes.dpcodigo] : "");
        if (selectedValue == null) return;

        highlightBar(selectedValue, chartConfig?.id === "pib-departamental"
            ? {
                exclusiveCategory: false,
                solidSiblings: true,
                selectedFillColor: "#166534",
                selectedBorderColor: "#14532d",
                selectedBorderWidth: 1
            }
            : { exclusiveCategory: false });
        if (!chartConfig?.mapInteraction?.preserveLegendOnMapClick) {
            syncLegendToCategory(selectedValue, { hideOthers: false });
        }
    }

    return {
        clearCategorySelection,
        highlightBar,
        highlightMapByChartValue,
        handleMapClick,
        installDefaultLegendHooks,
        scrollChartToLabel,
        toggleChartMapSelection,
        updateChartSelection
    };
}
