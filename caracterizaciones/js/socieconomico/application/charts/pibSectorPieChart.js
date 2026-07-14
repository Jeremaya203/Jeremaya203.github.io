import { PIB_VALUE_ADDED_PIE_CHART_CONFIG } from "./configs/dynamicsChartsConfig.js?v=global-municipality-required-state-20260604";
import { renderPieChart } from "./renderers/pieChartRenderer.js?v=pib-sector-instant-hover-20260604";
import { colorToCss } from "./core/chartSymbolUtils.js?v=travel-time-pie-20260511";
import { toNum } from "../utils/shared.js?v=pib-number-parser-20260506";
import { ECONOMIC_SECTOR_COLOR_PALETTE } from "./configs/economicSectorColors.js?v=economic-sector-shared-colors-20260603";

export function createPibSectorPieChartController({
    getMunicipioActual,
    getDeptoActual,
    getFiltroNivel,
    getWhereBase,
    getActiveMapLayer,
    getView,
    getHighlightHandle,
    setHighlightHandle,
    onSectorHover,
    onSectorLeave
} = {}) {
    let pieInstance = null;
    let metadataPromise = null;
    let activeSectorKey = "";

    function getElements() {
        return {
            panel: document.getElementById("pibSectorPiePanel"),
            title: document.getElementById("pibSectorPieTitle"),
            canvas: document.getElementById("pibSectorPieChart"),
            status: document.getElementById("pibSectorPieStatus"),
            mainTitle: document.getElementById("chartTitle"),
            mainCanvas: document.getElementById("chart")
        };
    }

    function destroyPieChart() {
        const canvas = getElements().canvas;
        if (canvas?.__pibSectorPointerHandlers) {
            canvas.removeEventListener("pointermove", canvas.__pibSectorPointerHandlers.pointermove);
            canvas.removeEventListener("pointerleave", canvas.__pibSectorPointerHandlers.pointerleave);
            canvas.__pibSectorPointerHandlers = null;
        }
        pieInstance?.destroy?.();
        pieInstance = null;
        activeSectorKey = "";
    }

    function clearMunicipalityHighlight() {
        const currentHighlight = getHighlightHandle?.();
        currentHighlight?.remove?.();
        setHighlightHandle?.(null);
    }

    function hidePieChart() {
        destroyPieChart();
        const { panel, status, title, canvas } = getElements();
        if (panel) panel.hidden = true;
        if (canvas) canvas.style.display = "none";
        if (status) {
            status.hidden = true;
            status.textContent = "";
        }
        if (title) title.textContent = "";
    }

    function showStatus(message) {
        const { panel, status } = getElements();
        if (panel) panel.hidden = false;
        if (!status) return;
        status.hidden = !message;
        status.textContent = message || "";
    }

    async function getLayerMetadata() {
        if (!metadataPromise) {
            metadataPromise = fetch(`${PIB_VALUE_ADDED_PIE_CHART_CONFIG.serviceUrl}?f=json`)
                .then(response => {
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    return response.json();
                });
        }
        return metadataPromise;
    }

    async function getRendererPalette() {
        return ECONOMIC_SECTOR_COLOR_PALETTE;
    }

    async function syncRendererLegend() {
        const layer = getActiveMapLayer?.();
        const metadata = await getLayerMetadata().catch(() => null);
        const infos = layer?.renderer?.classBreakInfos || metadata?.drawingInfo?.renderer?.classBreakInfos || [];
        if (!infos.length || typeof window.actualizarLeyenda !== "function") return;

        const labels = infos.map(info => String(info.label || "").trim()).filter(Boolean);
        const colors = infos.map(info => colorToCss(info?.symbol?.color || info?.symbol?.outline?.color) || "#999");
        const codes = infos.map((info, index) => `${info.minValue ?? index}-${info.maxValue ?? index}`);
        window.__chartLegendOrder = [];
        window.actualizarLeyenda(labels, colors, codes, {
            field: layer?.renderer?.field || PIB_VALUE_ADDED_PIE_CHART_CONFIG.rendererField || "pvagregadokmcop",
            baseWhere: String(layer?.definitionExpression || getWhereBase?.() || "1=1").trim() || "1=1",
            layers: [layer].filter(Boolean),
            preserveOrder: true
        });
    }

    function domainLabel(fieldInfo, value) {
        const codedValues = fieldInfo?.domain?.codedValues || [];
        const hit = codedValues.find(item => String(item.code) === String(value));
        return String(hit?.name ?? value ?? "").trim();
    }

    function selectOptionLabel(selectId, value) {
        const option = document.querySelector(`#${selectId} option[value="${CSS.escape(String(value ?? ""))}"]`);
        return option?.textContent?.trim() || "";
    }

    function selectedDepartmentLabel() {
        const deptCode = getDeptoActual?.();
        return selectOptionLabel("departamentos", deptCode) || "";
    }

    function departmentTitle() {
        const department = selectedDepartmentLabel();
        return department
            ? `Sectores económicos del departamento de ${department}`
            : PIB_VALUE_ADDED_PIE_CHART_CONFIG.title;
    }

    function departmentLabel(fieldInfo, attrs) {
        const rawValue = attrs?.dpnombre;
        const metadataLabel = domainLabel(fieldInfo, rawValue);
        const code = String(rawValue ?? "").trim();
        if (/^\d{2}$/.test(code)) {
            return selectOptionLabel("departamentos", code) || metadataLabel || selectedDepartmentLabel();
        }
        return metadataLabel
            || selectedDepartmentLabel()
            || selectOptionLabel("departamentos", String(attrs?.mpcodigo || "").slice(0, 2));
    }

    async function buildReadableTitle(attrs) {
        const metadata = await getLayerMetadata().catch(() => null);
        const fields = metadata?.fields || [];
        const fieldInfo = name => fields.find(field => String(field.name).toLowerCase() === String(name).toLowerCase());
        const municipality = domainLabel(fieldInfo("mpnombre"), attrs.mpnombre);
        const department = departmentLabel(fieldInfo("dpnombre"), attrs);

        if (!municipality) return PIB_VALUE_ADDED_PIE_CHART_CONFIG.title;
        return department
            ? `Sectores económicos del Municipio de ${municipality}, ${department}`
            : `Sectores económicos del Municipio de ${municipality}`;
    }

    async function queryMunicipalityRows(municipioCodigo) {
        const fields = [
            PIB_VALUE_ADDED_PIE_CHART_CONFIG.filterField,
            ...PIB_VALUE_ADDED_PIE_CHART_CONFIG.titleFields,
            ...PIB_VALUE_ADDED_PIE_CHART_CONFIG.fields.map(item => item.field)
        ];
        const params = new URLSearchParams({
            f: "json",
            where: `${PIB_VALUE_ADDED_PIE_CHART_CONFIG.filterField} = '${String(municipioCodigo).replace(/'/g, "''")}'`,
            outFields: [...new Set(fields)].join(","),
            returnGeometry: "false",
            returnDomainNames: "true",
            resultRecordCount: "1"
        });

        const response = await fetch(`${PIB_VALUE_ADDED_PIE_CHART_CONFIG.serviceUrl}/query?${params.toString()}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const json = await response.json();
        if (json.error) throw new Error(json.error.message || "Error consultando sectores económicos");
        return json.features || [];
    }

    function formatPercent(value) {
        const n = Number(value);
        return `${Number.isFinite(n) ? n.toFixed(1) : "0.0"}%`;
    }

    function formatSlicePercent(value) {
        const n = Number(value);
        return `${Number.isFinite(n) ? n.toLocaleString("es-CO", {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1
        }) : "0,0"}%`;
    }

    function boxesOverlap(a, b, padding = 2) {
        return !(
            a.right + padding < b.left ||
            a.left - padding > b.right ||
            a.bottom + padding < b.top ||
            a.top - padding > b.bottom
        );
    }

    function createSectorPercentLabelsPlugin() {
        return {
            id: "pib-sector-percent-labels",
            afterDatasetsDraw(chart) {
                const dataset = chart.data?.datasets?.[0];
                const meta = chart.getDatasetMeta(0);
                const values = (dataset?.data || []).map(value => Number(value) || 0);
                const total = values.reduce((sum, value) => sum + Math.max(0, value), 0);
                if (!total || !meta?.data?.length) return;

                const { ctx, chartArea } = chart;
                const placed = [];
                const slices = meta.data
                    .map((arc, index) => ({ arc, index, value: values[index] || 0 }))
                    .filter(item => item.value > 0)
                    .sort((a, b) => b.value - a.value);

                ctx.save();
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillStyle = "#ffffff";
                ctx.strokeStyle = "rgba(15, 23, 42, 0.45)";
                ctx.lineWidth = 3;

                slices.forEach(({ arc, value }) => {
                    const percent = (value / total) * 100;
                    const props = arc.getProps([
                        "x",
                        "y",
                        "startAngle",
                        "endAngle",
                        "circumference",
                        "outerRadius",
                        "innerRadius"
                    ], true);
                    const circumference = Math.abs(Number(props.circumference) || 0);
                    if (percent < 3 || circumference < 0.24) return;

                    const radius = (Number(props.innerRadius) + Number(props.outerRadius)) / 2 || Number(props.outerRadius) * 0.58;
                    const angle = (Number(props.startAngle) + Number(props.endAngle)) / 2;
                    const x = Number(props.x) + Math.cos(angle) * radius;
                    const y = Number(props.y) + Math.sin(angle) * radius;
                    if (
                        x < chartArea.left ||
                        x > chartArea.right ||
                        y < chartArea.top ||
                        y > chartArea.bottom
                    ) return;

                    const label = formatSlicePercent(percent);
                    const fontSize = Math.max(9, Math.min(12, Math.round(Number(props.outerRadius) * 0.09)));
                    ctx.font = `700 ${fontSize}px Outfit, sans-serif`;
                    const textWidth = ctx.measureText(label).width;
                    const availableArc = Math.max(0, radius * circumference * 0.72);
                    if (textWidth > availableArc) return;

                    const box = {
                        left: x - textWidth / 2,
                        right: x + textWidth / 2,
                        top: y - fontSize / 2,
                        bottom: y + fontSize / 2
                    };
                    if (placed.some(existing => boxesOverlap(box, existing, 4))) return;

                    ctx.strokeText(label, x, y);
                    ctx.fillText(label, x, y);
                    placed.push(box);
                });

                ctx.restore();
            }
        };
    }

    function normalizeSectorLabel(label) {
        const text = String(label ?? "").toLowerCase();
        if (text.includes("primaria")) return "primarias";
        if (text.includes("secundaria")) return "secundarias";
        if (text.includes("terciaria")) return "terciarias";
        return text;
    }

    function highlightSector(sector) {
        if (!pieInstance) return;
        const requested = normalizeSectorLabel(sector);
        if (requested === activeSectorKey) return;
        const labels = pieInstance.data?.labels || [];
        const activeIndex = labels.findIndex(label => normalizeSectorLabel(label) === requested);
        const dataset = pieInstance.data?.datasets?.[0];
        if (!dataset) return;
        activeSectorKey = activeIndex >= 0 ? requested : "";
        pieInstance.stop?.();
        dataset.borderColor = labels.map((_, index) => index === activeIndex ? "#064e3b" : "#ffffff");
        dataset.borderWidth = labels.map((_, index) => index === activeIndex ? 4 : 1);
        dataset.offset = labels.map(() => 0);
        pieInstance.update("none");
    }

    function clearSectorHighlight() {
        if (!pieInstance || !activeSectorKey) return;
        const labels = pieInstance.data?.labels || [];
        const dataset = pieInstance.data?.datasets?.[0];
        if (!dataset) return;
        activeSectorKey = "";
        pieInstance.stop?.();
        dataset.borderColor = labels.map(() => "#ffffff");
        dataset.borderWidth = labels.map(() => 1);
        dataset.offset = labels.map(() => 0);
        pieInstance.update("none");
    }

    function bindPreciseSectorPointer(canvas) {
        if (!canvas || !pieInstance) return;
        if (canvas.__pibSectorPointerHandlers) {
            canvas.removeEventListener("pointermove", canvas.__pibSectorPointerHandlers.pointermove);
            canvas.removeEventListener("pointerleave", canvas.__pibSectorPointerHandlers.pointerleave);
        }

        const pointermove = event => {
            const elements = pieInstance?.getElementsAtEventForMode?.(
                event,
                "nearest",
                { intersect: true },
                false
            ) || [];
            const index = elements[0]?.index;
            if (index == null) {
                clearSectorHighlight();
                onSectorLeave?.();
                return;
            }
            const sector = pieInstance.data?.labels?.[index];
            highlightSector(sector);
            onSectorHover?.(sector);
        };
        const pointerleave = () => {
            clearSectorHighlight();
            onSectorLeave?.();
        };

        canvas.__pibSectorPointerHandlers = { pointermove, pointerleave };
        canvas.addEventListener("pointermove", pointermove);
        canvas.addEventListener("pointerleave", pointerleave);
    }

    async function highlightMunicipalityOnMap() {
        const layer = getActiveMapLayer?.();
        const view = getView?.();
        const where = getWhereBase?.();
        if (!layer || !view || !where) return;

        try {
            clearMunicipalityHighlight();
            const query = layer.createQuery();
            query.where = where;
            query.outFields = [layer.objectIdField || "OBJECTID"];
            query.returnGeometry = false;
            const result = await layer.queryFeatures(query);
            const objectIds = (result?.features || [])
                .map(feature => feature.attributes?.[layer.objectIdField || "OBJECTID"])
                .filter(value => value != null);
            if (!objectIds.length) return;

            const layerView = await view.whenLayerView(layer);
            const handle = layerView.highlight(objectIds);
            setHighlightHandle?.(handle);
        } catch (error) {
            console.warn("No se pudo iluminar el municipio para valor agregado:", error);
        }
    }

    async function renderForSelectedMunicipality() {
        const municipioCodigo = getMunicipioActual?.();
        const { panel, title, canvas, mainTitle, mainCanvas } = getElements();
        if (!panel || !canvas) return;

        if (!municipioCodigo || getFiltroNivel?.() !== "MUNI") {
            destroyPieChart();
            panel.hidden = false;
            canvas.style.display = "none";
            if (mainTitle) mainTitle.textContent = "";
            if (mainCanvas) mainCanvas.style.display = "none";
            if (title) {
                title.textContent = getFiltroNivel?.() === "DEPTO"
                    ? departmentTitle()
                    : PIB_VALUE_ADDED_PIE_CHART_CONFIG.title;
            }
            await syncRendererLegend();
            showStatus("Seleccione un municipio para ver la información.");
            return;
        }

        panel.hidden = false;
        showStatus("Cargando sectores económicos...");

        try {
            const features = await queryMunicipalityRows(municipioCodigo);
            const attrs = features[0]?.attributes || null;
            if (!attrs) {
            destroyPieChart();
            canvas.style.display = "none";
            if (mainTitle) mainTitle.textContent = "";
            if (mainCanvas) mainCanvas.style.display = "none";
            if (title) title.textContent = PIB_VALUE_ADDED_PIE_CHART_CONFIG.title;
            showStatus("No hay datos de sectores económicos para el municipio seleccionado.");
            return;
        }

            const labels = PIB_VALUE_ADDED_PIE_CHART_CONFIG.fields.map(item => item.label);
            const values = PIB_VALUE_ADDED_PIE_CHART_CONFIG.fields.map(item => toNum(attrs[item.field]) ?? 0);
            if (!values.some(value => Number.isFinite(value) && value > 0)) {
                destroyPieChart();
                canvas.style.display = "none";
                if (mainTitle) mainTitle.textContent = "";
                if (mainCanvas) mainCanvas.style.display = "none";
                if (title) title.textContent = await buildReadableTitle(attrs);
                showStatus("Los sectores económicos no tienen valores disponibles para este municipio.");
                return;
            }

            destroyPieChart();
            if (title) title.textContent = await buildReadableTitle(attrs);
            showStatus("");
            if (mainTitle) mainTitle.textContent = "";
            if (mainCanvas) mainCanvas.style.display = "none";

            canvas.style.display = "block";
            canvas.style.width = "100%";
            canvas.style.height = "295px";
            canvas.height = 295;

            pieInstance = renderPieChart({
                canvas,
                labels,
                values,
                title: PIB_VALUE_ADDED_PIE_CHART_CONFIG.title,
                type: "pie",
                colors: await getRendererPalette(),
                formatValue: formatPercent,
                hoverOffset: 0,
                plugins: [createSectorPercentLabelsPlugin()]
            });
            bindPreciseSectorPointer(canvas);
            await syncRendererLegend();
        } catch (error) {
            destroyPieChart();
            canvas.style.display = "none";
            showStatus(`No se pudo cargar sectores económicos: ${String(error?.message || error)}`);
        }
    }

    async function handleMapClick(event) {
        return;
    }

    return {
        destroyPieChart,
        clearSectorHighlight,
        clearMunicipalityHighlight,
        handleMapClick,
        highlightMunicipalityOnMap,
        highlightSector,
        hidePieChart,
        renderForSelectedMunicipality
    };
}
