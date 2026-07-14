import { getChartBaseWhere, getChartFields } from "../core/chartUtils.js?v=travel-time-pie-20260511";
import { getChartSymbolLookups, getRendererLegendItems, getRendererVisualForValue } from "../core/chartSymbolUtils.js?v=travel-time-pie-20260511";
import { renderPieChart } from "../renderers/pieChartRenderer.js?v=travel-time-pie-20260511";
import { prepareVisibleChartCanvas, setChartTitle } from "../ui/chartPanel.js?v=local-chart-title-20260529";
import { setChartStatus } from "../ui/chartStatus.js";
import { MUNICIPALITY_REQUIRED_CHART_MESSAGE, hasMunicipalitySelection } from "../ui/municipalityRequiredState.js?v=global-municipality-required-state-20260604";

export function createTravelTimePieChartController({
    chartCore,
    chartInteractions,
    getWhereBase,
    getFiltroNivel,
    getDeptoActual,
    getDiccionarioDepartamentos,
    getLayersGlobal,
    applyWhereToActiveLayers
}) {
    function applyPieChartLayout(canvas) {
        const chartScroll = document.getElementById("pibChartScroll");
        const chartCard = canvas?.closest(".chart-card");

        if (chartScroll) {
            chartScroll.style.overflowX = "hidden";
            chartScroll.style.overflowY = "hidden";
            chartScroll.classList.remove("is-scrollable");
        }

        if (chartCard) {
            chartCard.classList.remove("chart-scrollable");
            chartCard.style.overflowX = "hidden";
        }

        canvas.style.setProperty("width", "100%", "important");
        canvas.style.setProperty("min-width", "0", "important");
        canvas.style.setProperty("max-width", "100%", "important");
        canvas.style.setProperty("height", "345px", "important");
        canvas.style.setProperty("min-height", "345px", "important");

        const parentWidth = chartScroll?.clientWidth || chartCard?.clientWidth || canvas.clientWidth || 360;
        canvas.width = Math.max(280, Math.floor(parentWidth));
        canvas.height = 345;
    }

    function buildWhere(chartConfig) {
        const baseWhere = getChartBaseWhere({
            chartConfig,
            whereBase: getWhereBase?.(),
            filtroNivel: getFiltroNivel?.(),
            deptoActual: getDeptoActual?.(),
            diccionarioDepartamentos: getDiccionarioDepartamentos?.()
        });
        const extraWhere = String(chartConfig?.additionalWhere || "").trim();
        if (!extraWhere) return baseWhere;
        if (!baseWhere || baseWhere === "1=1") return extraWhere;
        return `(${baseWhere}) AND (${extraWhere})`;
    }

    function validateRequiredFields(layer, chartConfig) {
        const required = Object.values(chartConfig?.requiredFields || {}).filter(item => item?.name);
        if (!required.length) return;
        const fieldNames = new Set((layer?.fields || []).map(field => String(field?.name || "").toLowerCase()));
        const missing = required.filter(field => !fieldNames.has(String(field.name).toLowerCase()));
        if (missing.length) {
            throw new Error(`La configuración del gráfico requiere campos no disponibles en la capa: ${missing.map(field => field.name).join(", ")}`);
        }
    }

    function getFieldInfo(layer, fieldName) {
        return (layer?.fields || []).find(field =>
            String(field?.name || "").toLowerCase() === String(fieldName || "").toLowerCase()
        ) || null;
    }

    function domainLabel(fieldInfo, value) {
        const codedValues = fieldInfo?.domain?.codedValues || [];
        const hit = codedValues.find(item => String(item.code) === String(value));
        return String(hit?.name ?? "").trim();
    }

    function selectOptionLabel(selectId, value) {
        const option = document.querySelector(`#${selectId} option[value="${CSS.escape(String(value ?? ""))}"]`);
        return option?.textContent?.trim() || "";
    }

    function readablePlace(attrs = {}) {
        const mpCode = attrs.mpcodigo;
        const dpCode = attrs.dpcodigo || String(mpCode || "").slice(0, 2);
        const municipality = /^\d{5}$/.test(String(attrs.mpnombre || "")) || !attrs.mpnombre
            ? selectOptionLabel("municipios", mpCode)
            : attrs.mpnombre;
        const department = /^\d{2}$/.test(String(attrs.dpnombre || "")) || !attrs.dpnombre
            ? selectOptionLabel("departamentos", dpCode)
            : attrs.dpnombre;
        const categoryLabels = {
            "1": "Departamento",
            "2": "Municipio",
            "3": "Distrito"
        };
        return {
            mpcategor: categoryLabels[String(attrs.mpcategor)] || String(attrs.mpcategor || "Municipio"),
            mpnombre: municipality || attrs.mpnombre || "",
            dpnombre: department || attrs.dpnombre || ""
        };
    }

    function resolveTitle(chartConfig, config, rows = []) {
        if (!chartConfig?.titleTemplate) return chartConfig?.title || config?.title;
        const attrs = rows[0]?.attributes || {};
        const place = readablePlace(attrs);
        return chartConfig.titleTemplate.replace(/\{(\w+)\}/g, (_, key) => place[key] || attrs[key] || "");
    }

    function formatArea(value) {
        const numericValue = Number(value);
        if (!Number.isFinite(numericValue)) return "0.00 Ha";
        return `${numericValue.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Ha`;
    }

    function buildRows(features, chartConfig, layer, rendererLookups) {
        const categoryField = chartConfig?.xAxis?.field;
        const valueField = chartConfig?.yAxis?.field;
        const fieldInfo = getFieldInfo(layer, categoryField);
        const rendererItems = getRendererLegendItems(layer?.renderer, chartConfig);
        const rendererItemByCode = new Map(
            rendererItems
                .map(item => [String(item?.code || "").trim(), item])
                .filter(([code]) => code)
        );
        const grouped = new Map();

        (features || []).forEach(feature => {
            const attrs = feature?.attributes || {};
            const rawLabel = String(attrs[categoryField] ?? "").trim();
            const numericValue = Number(attrs[valueField]);
            if (!rawLabel || !Number.isFinite(numericValue)) return;
            const rendererVisual = getRendererVisualForValue(layer?.renderer, rawLabel, chartConfig);

            const label = domainLabel(fieldInfo, rawLabel)
                || rendererLookups?.labelByValue?.get(rawLabel)
                || rendererVisual?.label
                || rawLabel;

            if (!grouped.has(rawLabel)) {
                grouped.set(rawLabel, {
                    rawLabel,
                    label,
                    value: 0,
                    color: rendererVisual?.color
                        || rendererLookups?.colorByValue?.get(rawLabel)
                        || rendererItemByCode.get(rawLabel)?.color
                        || rendererLookups?.defaultColor
                        || "",
                    attributes: attrs
                });
            }

            const row = grouped.get(rawLabel);
            row.value += numericValue;
            row.attributes = { ...row.attributes, [valueField]: row.value };
        });

        const rendererOrder = getRendererLegendItems(layer?.renderer, chartConfig)
            .map(item => String(item.code || "").trim())
            .filter(Boolean);
        const orderIndex = new Map(rendererOrder.map((code, index) => [code, index]));

        return [...grouped.values()]
            .filter(row => Number.isFinite(row.value) && row.value > 0)
            .sort((a, b) => {
                const aIndex = orderIndex.has(a.rawLabel) ? orderIndex.get(a.rawLabel) : Number.MAX_SAFE_INTEGER;
                const bIndex = orderIndex.has(b.rawLabel) ? orderIndex.get(b.rawLabel) : Number.MAX_SAFE_INTEGER;
                if (aIndex !== bIndex) return aIndex - bIndex;
                return a.label.localeCompare(b.label, "es");
            });
    }

    async function actualizarGrafica(layer, config) {
        const chartConfig = config?.chartConfig;
        if (!chartConfig || chartConfig.type !== "pie" || chartConfig.library !== "chart.js") return false;

        const canvas = document.getElementById("chart");
        if (!canvas) return true;

        chartCore.destroyChart();
        prepareVisibleChartCanvas(canvas);
        applyPieChartLayout(canvas);
        setChartTitle(chartConfig.title || config.title);
        setChartStatus(canvas, "Cargando gráfico...");

        if (typeof Chart === "undefined") {
            setChartStatus(canvas, "Chart.js no está cargado.");
            return true;
        }

        if (!layer?.createQuery) {
            setChartStatus(canvas, "No hay capa disponible para el gráfico.");
            return true;
        }

        if (!hasMunicipalitySelection({
            getFiltroNivel,
            getMunicipioActual: () => document.getElementById("municipios")?.value || ""
        })) {
            chartCore.destroyChart();
            prepareVisibleChartCanvas(canvas);
            applyPieChartLayout(canvas);
            setChartTitle(chartConfig.title || config.title);
            setChartStatus(canvas, MUNICIPALITY_REQUIRED_CHART_MESSAGE);
            canvas.style.setProperty("display", "none", "important");
            document.getElementById("pibChartScroll")?.style.setProperty("display", "none", "important");
            return true;
        }

        await layer.when?.();
        validateRequiredFields(layer, chartConfig);

        const where = buildWhere(chartConfig);
        const query = layer.createQuery();
        query.where = where;
        query.outFields = [...new Set(getChartFields(chartConfig))];
        query.returnGeometry = false;
        if (chartConfig?.filter?.scope !== "allDepartments") {
            applyWhereToActiveLayers?.(where);
        }

        const result = await layer.queryFeatures(query);
        const features = result?.features || [];
        if (!features.length) {
            chartCore.destroyChart();
            prepareVisibleChartCanvas(canvas);
            applyPieChartLayout(canvas);
            setChartTitle(chartConfig.title || config.title);
            setChartStatus(canvas, "No hay datos para el filtro seleccionado.");
            return true;
        }

        const rendererLookups = await getChartSymbolLookups({
            layers: [layer, ...(getLayersGlobal?.() || []).filter(Boolean)],
            urls: [String(layer?.__sourceUrl || layer?.url || "")].filter(Boolean),
            chartConfig: {
                ...chartConfig,
                labelsFromRenderer: true,
                colorsFromRenderer: true
            }
        });

        const rows = buildRows(features, chartConfig, layer, rendererLookups);
        if (!rows.length) {
            chartCore.destroyChart();
            prepareVisibleChartCanvas(canvas);
            applyPieChartLayout(canvas);
            setChartTitle(chartConfig.title || config.title);
            setChartStatus(canvas, "No hay datos para el filtro seleccionado.");
            return true;
        }

        chartCore.setRows(rows);
        window.__chartLegendOrder = rows.map(row => ({
            code: String(row.rawLabel ?? "").trim(),
            label: row.label,
            color: row.color
        })).filter(item => item.code);

        const labels = rows.map(row => row.label);
        const values = rows.map(row => row.value);
        const colors = rows.map(row => row.color);
        const total = values.reduce((sum, value) => sum + value, 0);

        if (typeof window.actualizarLeyenda === "function") {
            window.actualizarLeyenda(labels, colors, rows.map(row => row.rawLabel), {
                field: chartConfig.mapInteractionField || chartConfig.xAxis?.field,
                baseWhere: where,
                layers: [layer],
                preserveOrder: true
            });
        }

        setChartStatus(canvas, "");
        setChartTitle(resolveTitle(chartConfig, config, rows));
        applyPieChartLayout(canvas);

        const pieInstance = renderPieChart({
            canvas,
            labels,
            values,
            title: chartConfig.title || config.title,
            type: "pie",
            colors,
            showLegend: false,
            formatValue: value => {
                const numericValue = Number(value);
                const percent = total > 0 ? (numericValue / total) * 100 : 0;
                return `${formatArea(numericValue)} (${percent.toFixed(1)}%)`;
            },
            onSliceClick: async label => {
                await chartInteractions.toggleChartMapSelection(layer, chartConfig, label);
            }
        });

        chartCore.setInstance(pieInstance);
        return true;
    }

    function prepareChartPanelForConfig(config) {
        if (!config?.chartConfig || config.chartConfig.type !== "pie") return false;
        const canvas = document.getElementById("chart");
        if (!canvas) return true;
        prepareVisibleChartCanvas(canvas);
        applyPieChartLayout(canvas);
        setChartTitle(config.chartConfig.title || config.title);
        setChartStatus(canvas, "Cargando gráfico...");
        return true;
    }

    async function handleMapClick(event, config) {
        await chartInteractions.handleMapClick(event, {
            chartConfig: config?.chartConfig
        });
    }

    return {
        actualizarGrafica,
        handleMapClick,
        prepareChartPanelForConfig
    };
}
