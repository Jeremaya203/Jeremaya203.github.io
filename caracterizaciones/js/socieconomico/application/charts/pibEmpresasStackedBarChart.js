import { EMPRESAS_SECTOR_STACKED_BAR_CONFIG } from "./configs/empresasChartsConfig.js?v=economic-sector-shared-colors-20260603";
import { renderHorizontalStackedBarChart } from "./renderers/barChartRenderer.js?v=pib-sector-linked-border-20260604";

const EMPRESAS_BAR_THICKNESS = 18;
const EMPRESAS_MIN_HEIGHT = 340;
const EMPRESAS_MAX_HEIGHT = 420;

const MUNICIPAL_CATEGORY_LABELS = {
    "1": "Departamento",
    "2": "Municipio",
    "3": "Distrito"
};

export function createPibEmpresasStackedBarChartController({
    getMunicipioActual,
    getDeptoActual,
    getFiltroNivel,
    highlightPieSector,
    clearPieSectorHighlight,
    highlightMunicipalityOnMap
} = {}) {
    let chartInstance = null;
    let metadataPromise = null;
    let activeSectorKey = "";

    function getElements() {
        return {
            panel: document.getElementById("pibEmpresasPanel"),
            title: document.getElementById("pibEmpresasTitle"),
            canvas: document.getElementById("pibEmpresasChart"),
            status: document.getElementById("pibEmpresasStatus"),
            text: document.getElementById("pibEmpresasText")
        };
    }

    function destroyChart() {
        chartInstance?.destroy?.();
        chartInstance = null;
        activeSectorKey = "";
    }

    function resetEmpresasChartViewport(canvas, rows = []) {
        if (!canvas) return;

        const box = canvas.closest(".pib-empresas-chart-box");
        const rowCount = Math.max(Array.isArray(rows) ? rows.length : 0, 1);
        const height = Math.min(
            EMPRESAS_MAX_HEIGHT,
            Math.max(EMPRESAS_MIN_HEIGHT, rowCount * 24 + 120)
        );

        if (box) {
            box.style.position = "relative";
            box.style.width = "100%";
            box.style.height = `${height}px`;
            box.style.minHeight = `${height}px`;
            box.style.maxHeight = `${height}px`;
            box.style.overflowX = "hidden";
            box.style.overflowY = "hidden";
        }

        canvas.style.display = "block";
        canvas.style.width = "100%";
        canvas.style.maxWidth = "100%";
        canvas.style.minWidth = "0";
        canvas.style.height = `${height}px`;
        canvas.style.minHeight = `${height}px`;
        canvas.style.maxHeight = `${height}px`;
        canvas.width = Math.max(320, Math.floor(box?.clientWidth || canvas.clientWidth || 360));
        canvas.height = height;
    }

    function hideChart() {
        destroyChart();
        const { panel, status, title, text } = getElements();
        if (panel) panel.hidden = true;
        if (status) {
            status.hidden = true;
            status.textContent = "";
        }
        if (title) title.textContent = "";
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
            metadataPromise = fetch(`${EMPRESAS_SECTOR_STACKED_BAR_CONFIG.serviceUrl}?f=json`)
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

    function normalizeText(value) {
        return String(value ?? "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim();
    }

    function normalizeSector(value) {
        const text = normalizeText(value);
        if (text.includes("primaria") || text.includes("primario")) return "primarias";
        if (text.includes("secundaria") || text.includes("secundario")) return "secundarias";
        if (text.includes("terciaria") || text.includes("terciario")) return "terciarias";
        return text || "sin-sector";
    }

    function wrapLabelLines(value, maxLineLength = 18, maxLines = 3) {
        const text = String(value || "").trim();
        if (!text) return [""];
        const words = text.split(/\s+/);
        const lines = [];
        let current = "";
        words.forEach(word => {
            const next = current ? `${current} ${word}` : word;
            if (next.length <= maxLineLength || !current) {
                current = next;
                return;
            }
            lines.push(current);
            current = word;
        });
        if (current) lines.push(current);
        if (lines.length <= maxLines) return lines;
        const limited = lines.slice(0, maxLines);
        limited[maxLines - 1] = `${limited[maxLines - 1].slice(0, Math.max(0, maxLineLength - 1)).trim()}…`;
        return limited;
    }

    function categoryLabel(fieldInfo, value) {
        const label = domainLabel(fieldInfo, value);
        return MUNICIPAL_CATEGORY_LABELS[String(value)] || label || "Municipio";
    }

    function departmentLabel(fieldInfo, attrs) {
        const rawValue = attrs.dpnombre || attrs.dpcodigo || getDeptoActual?.();
        const metadataLabel = domainLabel(fieldInfo, rawValue);
        const code = String(rawValue ?? "").trim();
        if (/^\d{2}$/.test(code)) return selectOptionLabel("departamentos", code) || metadataLabel;
        return metadataLabel || selectOptionLabel("departamentos", String(attrs.mpcodigo || "").slice(0, 2));
    }

    function municipalityLabel(fieldInfo, attrs) {
        const rawValue = attrs.mpnombre || attrs.mpcodigo || getMunicipioActual?.();
        const metadataLabel = domainLabel(fieldInfo, rawValue);
        const code = String(rawValue ?? "").trim();
        if (/^\d{5}$/.test(code)) return selectOptionLabel("municipios", code) || metadataLabel;
        return metadataLabel || selectOptionLabel("municipios", getMunicipioActual?.());
    }

    async function buildReadableTitle(attrs = {}) {
        const metadata = await getLayerMetadata().catch(() => null);
        const fields = metadata?.fields || [];
        const fieldInfo = name => fields.find(field => String(field.name).toLowerCase() === String(name).toLowerCase());
        const department = departmentLabel(fieldInfo("dpnombre"), attrs);

        if (getFiltroNivel?.() === "DEPTO" && !getMunicipioActual?.()) {
            return `Registro de empresas por sector económico del departamento de ${department || "seleccionado"}`;
        }

        const category = attrs.mpcategor
            ? categoryLabel(fieldInfo("mpcategor"), attrs.mpcategor)
            : "Municipio";
        const municipality = municipalityLabel(fieldInfo("mpnombre"), attrs);
        if (!municipality || !department) return EMPRESAS_SECTOR_STACKED_BAR_CONFIG.title;
        return `Registro de empresas por sector económico del ${category} de ${municipality}, ${department}`;
    }

    function buildWhere() {
        const municipio = getMunicipioActual?.();
        if (municipio) {
            return `${EMPRESAS_SECTOR_STACKED_BAR_CONFIG.filterFields.municipality} = '${String(municipio).replace(/'/g, "''")}'`;
        }
        const depto = getDeptoActual?.();
        if (depto && getFiltroNivel?.() === "DEPTO") {
            return `${EMPRESAS_SECTOR_STACKED_BAR_CONFIG.filterFields.department} = '${String(depto).replace(/'/g, "''")}'`;
        }
        return "";
    }

    async function queryRows(where) {
        const fields = [
            EMPRESAS_SECTOR_STACKED_BAR_CONFIG.groupBy,
            EMPRESAS_SECTOR_STACKED_BAR_CONFIG.stackField,
            ...EMPRESAS_SECTOR_STACKED_BAR_CONFIG.titleFields,
            EMPRESAS_SECTOR_STACKED_BAR_CONFIG.filterFields.department,
            EMPRESAS_SECTOR_STACKED_BAR_CONFIG.filterFields.municipality
        ];
        const uniqueFields = [...new Set(fields)];
        const allFeatures = [];
        let offset = 0;
        const pageSize = 2000;

        while (offset < 10000) {
            const params = new URLSearchParams({
                f: "json",
                where,
                outFields: uniqueFields.join(","),
                returnGeometry: "false",
                returnDomainNames: "true",
                resultOffset: String(offset),
                resultRecordCount: String(pageSize)
            });
            const response = await fetch(`${EMPRESAS_SECTOR_STACKED_BAR_CONFIG.serviceUrl}/query?${params.toString()}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const json = await response.json();
            if (json.error) throw new Error(json.error.message || "Error consultando directorio de empresas");
            const page = json.features || [];
            allFeatures.push(...page);
            if (page.length < pageSize) break;
            offset += pageSize;
        }
        return allFeatures;
    }

    async function queryAnalysisText() {
        const municipio = getMunicipioActual?.();
        const { textSource } = EMPRESAS_SECTOR_STACKED_BAR_CONFIG;
        if (!municipio || !textSource?.url || !textSource?.field) return "";
        const params = new URLSearchParams({
            f: "json",
            where: `${textSource.filterField} = '${String(municipio).replace(/'/g, "''")}'`,
            outFields: textSource.field,
            returnGeometry: "false",
            resultRecordCount: "1"
        });
        const response = await fetch(`${textSource.url}/query?${params.toString()}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const json = await response.json();
        if (json.error) throw new Error(json.error.message || "Error consultando analisisdes");
        return String(json.features?.[0]?.attributes?.[textSource.field] || "").trim();
    }

    function aggregateFeatures(features) {
        const rowsByBranch = new Map();
        const sectorsByKey = new Map(
            EMPRESAS_SECTOR_STACKED_BAR_CONFIG.sectors.map(sector => [sector.key, { ...sector }])
        );
        const groupField = EMPRESAS_SECTOR_STACKED_BAR_CONFIG.groupBy;
        const stackField = EMPRESAS_SECTOR_STACKED_BAR_CONFIG.stackField;

        features.forEach(feature => {
            const attrs = feature.attributes || {};
            const branch = String(attrs[groupField] || "Sin rama de actividad").trim();
            const rawSector = String(attrs[stackField] || "Sin sector").trim();
            const sectorKey = normalizeSector(rawSector);
            if (!sectorsByKey.has(sectorKey)) {
                sectorsByKey.set(sectorKey, {
                    key: sectorKey,
                    label: rawSector || "Sin sector",
                    color: "#94a3b8"
                });
            }
            if (!rowsByBranch.has(branch)) rowsByBranch.set(branch, new Map());
            const sectorCounts = rowsByBranch.get(branch);
            sectorCounts.set(sectorKey, (sectorCounts.get(sectorKey) || 0) + 1);
        });

        const sectors = [...sectorsByKey.values()];
        const rows = [...rowsByBranch.entries()]
            .map(([label, counts]) => ({
                label,
                counts,
                total: [...counts.values()].reduce((sum, value) => sum + value, 0)
            }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 30);

        return { rows, sectors };
    }

    function createLinkedSectorBorderPlugin() {
        return {
            id: "pib-empresas-linked-sector-border",
            afterDatasetsDraw(chart) {
                if (!activeSectorKey) return;
                const datasetIndex = chart.data.datasets.findIndex(
                    dataset => dataset.sectorKey === activeSectorKey
                );
                if (datasetIndex < 0 || !chart.isDatasetVisible(datasetIndex)) return;

                const meta = chart.getDatasetMeta(datasetIndex);
                const dataset = chart.data.datasets[datasetIndex];
                const ctx = chart.ctx;
                ctx.save();
                ctx.strokeStyle = "#064e3b";
                ctx.lineWidth = 3;
                ctx.lineJoin = "round";

                (meta?.data || []).forEach((bar, index) => {
                    if (Number(dataset.data?.[index]) <= 0 || bar?.hidden) return;
                    const left = Math.min(Number(bar.x), Number(bar.base));
                    const right = Math.max(Number(bar.x), Number(bar.base));
                    const top = Number(bar.y) - Number(bar.height) / 2;
                    const width = right - left;
                    const height = Number(bar.height);
                    if (![left, top, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return;

                    const inset = ctx.lineWidth / 2;
                    ctx.strokeRect(
                        left + inset,
                        top + inset,
                        Math.max(0, width - ctx.lineWidth),
                        Math.max(0, height - ctx.lineWidth)
                    );
                });
                ctx.restore();
            }
        };
    }

    function applySectorHighlight(sector) {
        if (!chartInstance) return;
        const sectorKey = normalizeSector(sector);
        const selectedDataset = chartInstance.data.datasets.find(dataset => dataset.sectorKey === sectorKey);
        if (!selectedDataset) {
            clearSectorHighlight();
            return;
        }
        const highlightIsAlreadyVisible = activeSectorKey === sectorKey
            && selectedDataset.borderColor === "#064e3b"
            && selectedDataset.borderSkipped === false;
        if (highlightIsAlreadyVisible) return;
        activeSectorKey = sectorKey;
        chartInstance.stop?.();
        chartInstance.data.datasets.forEach(dataset => {
            const isSelected = dataset.sectorKey === sectorKey;
            dataset.backgroundColor = isSelected ? dataset.baseColor : `${dataset.baseColor}55`;
            dataset.borderColor = isSelected ? "#064e3b" : dataset.baseColor;
            dataset.borderWidth = isSelected
                ? { top: 3, right: 3, bottom: 3, left: 3 }
                : 1;
            dataset.borderSkipped = isSelected ? false : "start";
        });
        chartInstance.update("none");
    }

    function clearSectorHighlight() {
        if (!chartInstance || !activeSectorKey) return;
        activeSectorKey = "";
        chartInstance.stop?.();
        chartInstance.data.datasets.forEach(dataset => {
            dataset.backgroundColor = dataset.baseColor;
            dataset.borderColor = dataset.baseColor;
            dataset.borderWidth = 1;
            dataset.borderSkipped = "start";
        });
        chartInstance.update("none");
    }

    async function renderForCurrentFilter() {
        const where = buildWhere();
        if (!where) {
            hideChart();
            return;
        }

        const { panel, title, canvas, text } = getElements();
        if (!panel || !canvas) return;
        panel.hidden = false;
        panel.classList.remove("eva-parallel-panel");
        showStatus("Cargando directorio de empresas...");

        try {
            const features = await queryRows(where);
            if (!features.length) {
                destroyChart();
                if (title) title.textContent = await buildReadableTitle();
                showStatus("No hay datos de empresas para el filtro seleccionado.");
                return;
            }

            const { rows, sectors } = aggregateFeatures(features);
            if (!rows.length) {
                destroyChart();
                if (title) title.textContent = await buildReadableTitle(features[0]?.attributes);
                showStatus("No hay ramas de actividad disponibles para el filtro seleccionado.");
                return;
            }

            destroyChart();
            if (title) title.textContent = await buildReadableTitle(features[0]?.attributes || {});
            showStatus("");

            const labels = rows.map(row => row.label);
            const wrappedLabels = labels.map(label => wrapLabelLines(label));
            const datasets = sectors.map(sector => ({
                label: sector.label,
                sectorKey: sector.key,
                baseColor: sector.color,
                data: rows.map(row => row.counts.get(sector.key) || 0),
                backgroundColor: sector.color,
                borderColor: sector.color,
                borderWidth: 1,
                borderRadius: 4,
                barThickness: EMPRESAS_BAR_THICKNESS,
                maxBarThickness: EMPRESAS_BAR_THICKNESS,
                barPercentage: 0.72,
                categoryPercentage: 0.78
            })).filter(dataset => dataset.data.some(value => value > 0));

            resetEmpresasChartViewport(canvas, rows);

            chartInstance = renderHorizontalStackedBarChart({
                canvas,
                labels: wrappedLabels,
                rawLabels: labels,
                datasets,
                xTitle: EMPRESAS_SECTOR_STACKED_BAR_CONFIG.xAxis.label,
                yTitle: EMPRESAS_SECTOR_STACKED_BAR_CONFIG.yAxis.label,
                yTickFontSize: rows.length > 16 ? 9 : 10,
                formatValue: value => `${Number(value || 0).toLocaleString("es-CO")} empresas`,
                onBarHover: ({ sector }) => {
                    applySectorHighlight(sector);
                    highlightPieSector?.(sector);
                },
                onBarLeave: () => {
                    clearSectorHighlight();
                    clearPieSectorHighlight?.();
                },
                onBarClick: async ({ sector }) => {
                    applySectorHighlight(sector);
                    highlightPieSector?.(sector);
                    await highlightMunicipalityOnMap?.();
                },
                plugins: [createLinkedSectorBorderPlugin()]
            });

            const analysisText = await queryAnalysisText().catch(() => "");
            if (text) {
                text.hidden = !analysisText;
                text.textContent = analysisText;
            }
        } catch (error) {
            destroyChart();
            showStatus(`No se pudo cargar el directorio de empresas: ${String(error?.message || error)}`);
        }
    }

    return {
        clearSectorHighlight,
        destroyChart,
        hideChart,
        highlightSector: applySectorHighlight,
        renderForCurrentFilter
    };
}
