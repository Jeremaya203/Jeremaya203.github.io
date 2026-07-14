import { CENSO_PECUARIO_MULTI_DOUGHNUT_CONFIG } from "../configs/dynamicsChartsConfig.js?v=global-municipality-required-state-20260604";
import { renderMultiSeriesDoughnutChart } from "../renderers/doughnutChartRenderer.js?v=censo-pecuario-20260507-3";
import { toNum } from "../../utils/shared.js";
import { destroyCanvasChart } from "../core/chartLifecycle.js";

const MUNICIPAL_CATEGORY_LABELS = {
    "1": "Departamento",
    "2": "Municipio",
    "3": "Distrito"
};

export function createCensoPecuarioDoughnutController({
    getMunicipioActual,
    getDeptoActual,
    getFiltroNivel
} = {}) {
    let chartInstance = null;
    let metadataPromise = null;

    function getElements() {
        return {
            panel: document.getElementById("censoPecuarioPanel"),
            title: document.getElementById("censoPecuarioTitle"),
            canvas: document.getElementById("censoPecuarioChart"),
            status: document.getElementById("censoPecuarioStatus"),
            text: document.getElementById("censoPecuarioText")
        };
    }

    function destroyChart() {
        const { canvas } = getElements();
        destroyCanvasChart(canvas);
        chartInstance = null;
    }

    function hideChart() {
        destroyChart();
        const { panel, title, status, text } = getElements();
        if (panel) panel.hidden = true;
        if (title) title.textContent = "";
        if (status) {
            status.hidden = true;
            status.textContent = "";
        }
        if (text) {
            text.hidden = true;
            text.textContent = "";
        }
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
            metadataPromise = fetch(`${CENSO_PECUARIO_MULTI_DOUGHNUT_CONFIG.serviceUrl}?f=json`)
                .then(response => {
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    return response.json();
                });
        }
        return metadataPromise;
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

    function categoryLabel(fieldInfo, value) {
        const label = domainLabel(fieldInfo, value);
        return MUNICIPAL_CATEGORY_LABELS[String(value)] || label || "Municipio";
    }

    function municipalityLabel(fieldInfo, attrs) {
        const rawValue = attrs.mpnombre || attrs.mpcodigo || getMunicipioActual?.();
        const metadataLabel = domainLabel(fieldInfo, rawValue);
        const code = String(rawValue ?? "").trim();
        if (/^\d{5}$/.test(code)) return selectOptionLabel("municipios", code) || metadataLabel;
        return metadataLabel || selectOptionLabel("municipios", getMunicipioActual?.());
    }

    function departmentLabel(fieldInfo, attrs) {
        const rawValue = attrs.dpnombre || attrs.dpcodigo || getDeptoActual?.();
        const metadataLabel = domainLabel(fieldInfo, rawValue);
        const code = String(rawValue ?? "").trim();
        if (/^\d{2}$/.test(code)) return selectOptionLabel("departamentos", code) || metadataLabel;
        return metadataLabel || selectOptionLabel("departamentos", String(attrs.mpcodigo || "").slice(0, 2));
    }

    async function buildTitle(attrs = {}) {
        const metadata = await getLayerMetadata().catch(() => null);
        const fields = metadata?.fields || [];
        const fieldInfo = name => fields.find(field => String(field.name).toLowerCase() === String(name).toLowerCase());
        const category = attrs.mpcategor ? categoryLabel(fieldInfo("mpcategor"), attrs.mpcategor) : "Municipio";
        const municipality = municipalityLabel(fieldInfo("mpnombre"), attrs);
        const department = departmentLabel(fieldInfo("dpnombre"), attrs);
        if (!municipality || !department) return CENSO_PECUARIO_MULTI_DOUGHNUT_CONFIG.title;
        return `Censo pecuario del ${category} de ${municipality}, ${department}`;
    }

    function fields() {
        return [
            ...CENSO_PECUARIO_MULTI_DOUGHNUT_CONFIG.titleFields,
            ...CENSO_PECUARIO_MULTI_DOUGHNUT_CONFIG.groups.map(group => group.field)
        ];
    }

    async function queryFeatures(where) {
        const params = new URLSearchParams({
            f: "json",
            where,
            outFields: [...new Set(fields())].join(","),
            returnGeometry: "false",
            returnDomainNames: "true",
            resultRecordCount: "2000"
        });
        const response = await fetch(`${CENSO_PECUARIO_MULTI_DOUGHNUT_CONFIG.serviceUrl}/query?${params.toString()}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const json = await response.json();
        if (json.error) throw new Error(json.error.message || "Error consultando censo pecuario");
        return json.features || [];
    }

    async function queryDepartmentFeatures(deptoCodigo) {
        const departmentField = CENSO_PECUARIO_MULTI_DOUGHNUT_CONFIG.filterFields.department;
        return queryFeatures(`${departmentField} = '${String(deptoCodigo).replace(/'/g, "''")}'`);
    }

    async function queryMunicipalityFeature(municipioCodigo) {
        const municipalityField = CENSO_PECUARIO_MULTI_DOUGHNUT_CONFIG.filterFields.municipality;
        const rows = await queryFeatures(`${municipalityField} = '${String(municipioCodigo).replace(/'/g, "''")}'`);
        return rows[0] || null;
    }

    function sumAnimalValues(features) {
        const totals = {};
        CENSO_PECUARIO_MULTI_DOUGHNUT_CONFIG.groups.forEach(group => {
            totals[group.field] = 0;
        });
        features.forEach(feature => {
            const attrs = feature.attributes || {};
            CENSO_PECUARIO_MULTI_DOUGHNUT_CONFIG.groups.forEach(group => {
                totals[group.field] += toNum(attrs[group.field]) || 0;
            });
        });
        return totals;
    }

    function percentagesFromTotals(totals) {
        const sum = CENSO_PECUARIO_MULTI_DOUGHNUT_CONFIG.groups
            .reduce((acc, group) => acc + (toNum(totals[group.field]) || 0), 0);
        return CENSO_PECUARIO_MULTI_DOUGHNUT_CONFIG.groups
            .map(group => sum > 0 ? ((toNum(totals[group.field]) || 0) / sum) * 100 : 0);
    }

    function formatPercent(value) {
        const n = Number(value);
        return `${Number.isFinite(n) ? n.toLocaleString("es-CO", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }) : "0,00"} %`;
    }

    async function renderForCurrentFilter() {
        const municipioCodigo = getMunicipioActual?.();
        const { panel, title, canvas, text } = getElements();
        if (!panel || !canvas) return;

        if (!municipioCodigo) {
            panel.hidden = false;
            destroyChart();
            if (title) title.textContent = CENSO_PECUARIO_MULTI_DOUGHNUT_CONFIG.title;
            showStatus("Seleccione un municipio para ver la información.");
            return;
        }

        panel.hidden = false;
        showStatus("Cargando censo pecuario...");

        try {
            const municipioFeature = await queryMunicipalityFeature(municipioCodigo);
            if (!municipioFeature) {
                destroyChart();
                if (title) title.textContent = CENSO_PECUARIO_MULTI_DOUGHNUT_CONFIG.title;
                showStatus("No hay datos de censo pecuario para el municipio seleccionado.");
                return;
            }

            const attrs = municipioFeature.attributes || {};
            const deptoCodigo = attrs.dpcodigo || String(municipioCodigo).slice(0, 2) || getDeptoActual?.();
            const departmentFeatures = await queryDepartmentFeatures(deptoCodigo);
            const municipalTotals = sumAnimalValues([municipioFeature]);
            const departmentTotals = sumAnimalValues(departmentFeatures);
            const municipalPercentages = percentagesFromTotals(municipalTotals);
            const departmentPercentages = percentagesFromTotals(departmentTotals);

            if (!municipalPercentages.some(value => value > 0) && !departmentPercentages.some(value => value > 0)) {
                destroyChart();
                if (title) title.textContent = await buildTitle(attrs);
                showStatus("El censo pecuario no tiene valores disponibles para el filtro seleccionado.");
                return;
            }

            destroyChart();
            if (title) title.textContent = await buildTitle(attrs);
            showStatus("");

            const labels = CENSO_PECUARIO_MULTI_DOUGHNUT_CONFIG.groups.map(group => group.label);
            const colors = CENSO_PECUARIO_MULTI_DOUGHNUT_CONFIG.groups.map(group => group.color);
            canvas.style.display = "block";
            canvas.style.width = "100%";
            canvas.style.height = "330px";

            chartInstance = renderMultiSeriesDoughnutChart({
                canvas,
                labels,
                formatValue: formatPercent,
                datasets: [
                    {
                        label: "Departamento",
                        data: departmentPercentages,
                        backgroundColor: colors,
                        borderColor: "#ffffff",
                        borderWidth: 1,
                        weight: 0.82
                    },
                    {
                        label: "Municipio",
                        data: municipalPercentages,
                        backgroundColor: colors,
                        borderColor: "#ffffff",
                        borderWidth: 1,
                        weight: 1
                    }
                ]
            });

            if (text) {
                text.hidden = true;
                text.textContent = "";
            }
        } catch (error) {
            destroyChart();
            showStatus(`No se pudo cargar el censo pecuario: ${String(error?.message || error)}`);
        }
    }

    return {
        destroyChart,
        hideChart,
        renderForCurrentFilter
    };
}
