import { setChartTitle, prepareVisibleChartCanvas } from "../ui/chartPanel.js?v=local-chart-title-20260529";
import { setChartStatus } from "../ui/chartStatus.js";
import { buildAdaptiveFont, resolveChartLabel } from "../core/chartOptions.js?v=global-safe-zoom-labels-20260604";
import { destroyCanvasChart, createChart } from "../core/chartLifecycle.js";

function toNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

function formatInteger(value) {
    return Number(value || 0).toLocaleString("es-CO", {
        maximumFractionDigits: 0
    });
}

function normalizeSpeciesKey(label) {
    return String(label || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

export function createLivestockCensusBarChartController({
    chartCore,
    getWhereBase,
    refreshSummary
} = {}) {
    let metadataPromise = null;
    let derivedChart = null;
    let activeDerivedSpecies = "";
    let lastInteractiveHoverLabel = "";
    let lastInteractiveHoverAt = 0;
    let livestockRenderTimer = null;

    function escapeSqlString(value) {
        return String(value ?? "").replace(/'/g, "''");
    }

    function selectedMunicipalityName() {
        const select = document.getElementById("municipios");
        const text = select?.options?.[select.selectedIndex]?.textContent?.trim() || "";
        return text && text !== "Seleccione municipio" ? text : "";
    }

    function selectedMunicipalityCode() {
        return document.getElementById("municipios")?.value?.trim() || "";
    }

    function buildLivestockWhere(chartConfig) {
        const municipalityField = chartConfig?.filter?.municipalityField || chartConfig?.filterField || "mpcodigo";
        if (municipalityField === "mpnombre") {
            const municipalityValue = selectedMunicipalityCode() || selectedMunicipalityName();
            if (municipalityValue) return `mpnombre = '${escapeSqlString(municipalityValue)}'`;
        }

        return getWhereBase?.() || "1=1";
    }

    async function getServiceMetadata(chartConfig) {
        if (!metadataPromise) {
            metadataPromise = fetch(`${chartConfig.serviceUrl}?f=json`)
                .then(response => response.json());
        }
        return metadataPromise;
    }

    async function validateFields(chartConfig, fields) {
        const metadata = await getServiceMetadata(chartConfig);
        const available = new Set((metadata.fields || []).map(field => String(field.name).toLowerCase()));
        const missing = [...new Set(fields)]
            .filter(Boolean)
            .filter(field => !available.has(String(field).toLowerCase()));

        if (missing.length) {
            throw new Error(`Campos no disponibles en SE_CPE: ${missing.join(", ")}`);
        }
    }

    async function queryLivestockRows(chartConfig) {
        const where = buildLivestockWhere(chartConfig);

        const fields = [
            chartConfig.filterField || "mpcodigo",
            ...(chartConfig.titleFields || []),
            ...(chartConfig.groups || []).flatMap(group => [
                group.animalsField,
                group.farmsField
            ])
        ];
        await validateFields(chartConfig, fields);

        const params = new URLSearchParams({
            f: "json",
            where,
            outFields: [...new Set(fields)].join(","),
            returnGeometry: "false",
            returnDomainNames: "true",
            resultRecordCount: "1"
        });

        const response = await fetch(`${chartConfig.serviceUrl}/query?${params.toString()}`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const json = await response.json();

        if (json.error) {
            throw new Error(json.error.message || "Error consultando censo pecuario");
        }

        return json.features || [];
    }

    function buildRows(feature, chartConfig) {
        const attrs = feature?.attributes || {};

        return (chartConfig.groups || []).map(group => ({
            label: group.label,
            animals: toNumber(attrs[group.animalsField]),
            farms: toNumber(attrs[group.farmsField])
        }));
    }
function selectOptionLabel(selectId, value) {
    const option = document.querySelector(
        `#${selectId} option[value="${CSS.escape(String(value ?? ""))}"]`
    );

    return option?.textContent?.trim() || "";
}

function resolvePlaceValue(field, value, attrs = {}) {
    const rawValue = String(value ?? "").trim();

    if (field === "mpcategor") {
        if (!rawValue) return "municipio";
        const labels = {
            "1": "departamento",
            "2": "municipio",
            "3": "distrito"
        };

        return labels[rawValue] || rawValue;
    }

    if (field === "mpnombre") {
        return selectOptionLabel("municipios", attrs.mpcodigo) || rawValue;
    }

    if (field === "dpnombre") {
        const deptCode = String(attrs.dpcodigo || attrs.mpcodigo || "").slice(0, 2);
        return selectOptionLabel("departamentos", deptCode) || rawValue;
    }

    return rawValue;
}

function resolveTitle(chartConfig, attrs = {}) {
    let title = chartConfig.titleTemplate || chartConfig.title || "Registro pecuario";

    title = title.replace(/\{([^}]+)\}/g, (_, field) => {
        return resolvePlaceValue(field, attrs[field], attrs);
    });

    return title;
}

    function getMetricDatasets(rows) {
        const speciesPalette = {
            porcinos: {
                animals: "#C77827",
                farms: "#8F4E14"
            },
            aves: {
                animals: "#D9A128",
                farms: "#9B6B12"
            },
            bovinos: {
                animals: "#3C8D5A",
                farms: "#235E3B"
            },
            bufalos: {
                animals: "#4C6F8C",
                farms: "#2F4C63"
            }
        };
        const defaultPalette = {
            animals: "#A66A2C",
            farms: "#6E4318"
        };
        const animalColors = rows.map(row => {
            const palette = speciesPalette[normalizeSpeciesKey(row.label)] || defaultPalette;
            return palette.animals;
        });
        const farmColors = rows.map(row => {
            const palette = speciesPalette[normalizeSpeciesKey(row.label)] || defaultPalette;
            return palette.farms;
        });
        return [
            {
                label: "Total de animales",
                data: rows.map(row => row.animals),
                backgroundColor: animalColors,
                borderColor: animalColors,
                borderWidth: 1,
                legendColor: "#B97B2F"
            },
            {
                label: "Total de predios",
                data: rows.map(row => row.farms),
                backgroundColor: farmColors,
                borderColor: farmColors,
                borderWidth: 1,
                legendColor: "#73411A"
            }
        ];
    }

    function hasMetricData(rows) {
        return rows.some(row => row.animals > 0 || row.farms > 0);
    }

    function interactiveSpecies(label) {
        const normalized = String(label || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase();
        if (normalized === "porcinos") return "porcinos";
        if (normalized === "aves") return "aves";
        return "";
    }

    function transparentize(color, alpha = 0.35) {
        const value = String(color || "");
        const hex = value.match(/^#([0-9a-f]{6})$/i);
        if (hex) {
            const int = parseInt(hex[1], 16);
            return `rgba(${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255}, ${alpha})`;
        }

        if (/^rgb\(/i.test(value)) {
            return value.replace(/^rgb\(/i, "rgba(").replace(/\)$/, `, ${alpha})`);
        }

        return value;
    }

    function applyInteractiveHighlight(chart, activeLabel = "") {
        const labels = chart?.data?.labels || [];
        const active = String(activeLabel || "");
        chart.data.datasets.forEach(dataset => {
            const baseColors = dataset.__baseBackgroundColors || dataset.backgroundColor;
            dataset.__baseBackgroundColors = Array.isArray(baseColors) ? [...baseColors] : labels.map(() => baseColors);
            dataset.backgroundColor = labels.map((label, index) => {
                const color = dataset.__baseBackgroundColors[index] || dataset.__baseBackgroundColors[0];
                if (!interactiveSpecies(label)) return color;
                if (!active) return color;
                return label === active ? color : transparentize(color, 0.35);
            });
            dataset.borderWidth = labels.map(label => label === active ? 3 : (interactiveSpecies(label) ? 2 : 1));
        });
        chart.update();
    }

    function isDerivedPanelVisible() {
        const panel = document.getElementById("livestockDerivedPanel");
        return Boolean(panel && !panel.hidden);
    }

    function triggerDerivedChart(label) {
        const species = interactiveSpecies(label);
        if (!species) {
            hideDerivedPanel();
            return false;
        }

        if (activeDerivedSpecies === species && isDerivedPanelVisible()) {
            hideDerivedPanel();
            return false;
        }

        activeDerivedSpecies = species;
        window.__activeLivestockDerivedSpecies = species;
        window.dispatchEvent(new CustomEvent("livestock:census-species-selected", {
            detail: { species, label }
        }));

        if (species === "porcinos") {
            window.renderCensoPecuarioPorcinosSoon?.(0);
        } else if (species === "aves") {
            window.renderCensoPecuarioAvesSoon?.(0);
        }
        return true;
    }

    function ensureDerivedPanel() {
        let panel = document.getElementById("livestockDerivedPanel");
        const anchor = document.getElementById("pibChartScroll") || document.getElementById("chart");
        if (!anchor?.parentNode) return panel || null;

        if (panel) {
            const expectedParent = anchor.parentNode;
            const expectedPrevious = anchor;
            const isAlreadyPositioned = panel.parentNode === expectedParent
                && panel.previousElementSibling === expectedPrevious;
            if (!isAlreadyPositioned) {
                anchor.insertAdjacentElement("afterend", panel);
            }
            return panel;
        }

        panel = document.createElement("section");
        panel.id = "livestockDerivedPanel";
        panel.className = "livestock-derived-panel";
        panel.hidden = true;
        panel.innerHTML = `
            <div class="livestock-derived-panel__header">
                <h4 id="livestockDerivedTitle" class="livestock-derived-panel__title"></h4>
                <button type="button" id="livestockDerivedClose" class="livestock-derived-panel__close" aria-label="Cerrar">x</button>
            </div>
            <div class="livestock-derived-panel__scroll">
                <canvas id="livestockDerivedChart"></canvas>
            </div>
            <div id="livestockDerivedStatus" class="pib-chart-status" hidden></div>
        `;
        anchor.insertAdjacentElement("afterend", panel);
        panel.querySelector("#livestockDerivedClose")?.addEventListener("click", () => hideDerivedPanel());
        return panel;
    }

    function setDerivedStatus(message = "") {
        const status = document.getElementById("livestockDerivedStatus");
        if (!status) return;
        status.textContent = message;
        status.hidden = !message;
    }

    function revealDerivedPanel(panel) {
        if (!panel) return;
        panel.hidden = false;
        panel.closest(".chart-card")?.classList.add("livestock-derived-open");
        window.requestAnimationFrame(() => {
            panel.scrollIntoView?.({
                block: "start",
                inline: "nearest",
                behavior: "smooth"
            });
        });
    }

    function hideDerivedPanel({ keepActiveSpecies = false } = {}) {
        const panel = document.getElementById("livestockDerivedPanel");
        if (panel) panel.hidden = true;
        panel?.closest(".chart-card")?.classList.remove("livestock-derived-open");
        destroyCanvasChart(document.getElementById("livestockDerivedChart"));
        derivedChart = null;
        setDerivedStatus("");
        if (!keepActiveSpecies) {
            activeDerivedSpecies = "";
            window.__activeLivestockDerivedSpecies = "";
        }
    }

    async function queryDerivedRows(chartConfig, derivedConfig) {
        const fields = [
            chartConfig.filterField || "mpnombre",
            ...(chartConfig.titleFields || []),
            ...(derivedConfig.groups || []).flatMap(group => [group.animalsField, group.farmsField])
        ];
        await validateFields(chartConfig, fields);

        const params = new URLSearchParams({
            f: "json",
            where: buildLivestockWhere(chartConfig),
            outFields: [...new Set(fields)].join(","),
            returnGeometry: "false",
            returnDomainNames: "true",
            resultRecordCount: "1"
        });

        const response = await fetch(`${chartConfig.serviceUrl}/query?${params.toString()}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const json = await response.json();
        if (json.error) throw new Error(json.error.message || "Error consultando producción porcina");

        const attrs = json.features?.[0]?.attributes || null;
        if (!attrs) return { attrs: null, rows: [] };

        const rows = (derivedConfig.groups || []).map(group => ({
            label: group.label,
            animals: toNumber(attrs[group.animalsField]),
            farms: toNumber(attrs[group.farmsField])
        }));

        return { attrs, rows };
    }

    function createValueLabelsPlugin() {
        return {
            id: "livestockDerivedValueLabels",
            afterDatasetsDraw(chart) {
                const { ctx } = chart;
                ctx.save();
                ctx.font = "11px sans-serif";
                ctx.fillStyle = "#333";
                ctx.textAlign = "center";
                ctx.textBaseline = "bottom";
                chart.data.datasets.forEach((dataset, datasetIndex) => {
                    const meta = chart.getDatasetMeta(datasetIndex);
                    meta.data.forEach((bar, index) => {
                        const value = dataset.data[index];
                        if (!Number.isFinite(Number(value)) || Number(value) <= 0) return;
                        ctx.fillText(formatInteger(value), bar.x, bar.y - 4);
                    });
                });
                ctx.restore();
            }
        };
    }

    function getCanvasPointer(chart, event) {
        const native = event?.native || event;
        const canvas = chart?.canvas;
        if (!native || !canvas) return null;

        const rect = canvas.getBoundingClientRect?.();
        if (rect?.width && rect?.height
            && Number.isFinite(Number(native.clientX))
            && Number.isFinite(Number(native.clientY))) {
            return {
                x: Number(native.clientX) - rect.left,
                y: Number(native.clientY) - rect.top
            };
        }

        if (Number.isFinite(native.offsetX) && Number.isFinite(native.offsetY)) {
            return { x: native.offsetX, y: native.offsetY };
        }

        if (window.Chart?.helpers?.getRelativePosition) {
            try {
                return window.Chart.helpers.getRelativePosition(native, chart);
            } catch (_) {}
        }

        if (!rect?.width || !rect?.height) return null;
        return null;
    }

    function resolveRowLabelFromYAxis(chart, event) {
        const yScale = chart?.scales?.y;
        const labels = chart?.data?.labels || [];
        const pointer = getCanvasPointer(chart, event);
        if (!pointer || !yScale || !labels.length) return "";

        const pointerX = pointer.x;
        const pointerY = pointer.y;
        const canvasWidth = chart?.canvas?.width || chart?.width || 0;
        const leftBound = 0;
        const rightBound = Math.max(canvasWidth, yScale.right || 0);

        if (!Number.isFinite(pointerX) || !Number.isFinite(pointerY)) return "";
        if (pointerX < leftBound || pointerX > rightBound) return "";
        if (pointerY < yScale.top || pointerY > yScale.bottom) return "";

        let bestIndex = -1;
        let bestDistance = Number.POSITIVE_INFINITY;
        labels.forEach((_, index) => {
            const pixel = yScale.getPixelForTick(index);
            const distance = Math.abs(pointerY - pixel);
            if (distance < bestDistance) {
                bestDistance = distance;
                bestIndex = index;
            }
        });

        const rowTolerance = Math.max(18, Math.min(48, (yScale.height || 0) / Math.max(labels.length, 1) / 2));
        if (bestIndex < 0 || bestDistance > rowTolerance) return "";
        return labels[bestIndex] || "";
    }

    function resolveClickedLabelFromYAxis(chart, event) {
        const label = resolveRowLabelFromYAxis(chart, event);
        return interactiveSpecies(label) ? label : "";
    }

    function resolveClickedSpeciesLabel(chart, event, elements = []) {
        const directIndex = elements?.[0]?.index;
        if (directIndex != null) {
            const directLabel = chart.data.labels?.[directIndex] || "";
            if (interactiveSpecies(directLabel)) return directLabel;
        }

        const nativeEvent = event?.native || event;
        const nearest = typeof chart.getElementsAtEventForMode === "function"
            ? chart.getElementsAtEventForMode(nativeEvent, "nearest", { intersect: false, axis: "y" }, true)
            : [];
        const nearestIndex = nearest?.[0]?.index;
        if (nearestIndex != null) {
            const nearestLabel = chart.data.labels?.[nearestIndex] || "";
            if (interactiveSpecies(nearestLabel)) return nearestLabel;
        }

        return resolveClickedLabelFromYAxis(chart, event);
    }

    function resolveSpeciesLabelForPointer(chart, nativeEvent) {
        const event = { native: nativeEvent };
        const label = resolveClickedSpeciesLabel(chart, event, []);
        if (label) return label;

        const hoverIsFresh = lastInteractiveHoverLabel
            && (Date.now() - lastInteractiveHoverAt) < 1500;
        return hoverIsFresh ? lastInteractiveHoverLabel : "";
    }

    function toggleMetricDatasetFromLegend(event, legendItem, legend) {
        const chart = legend?.chart;
        const datasetIndex = legendItem?.datasetIndex;
        if (!chart || datasetIndex == null) return;

        const defaultLegendClick = Chart?.defaults?.plugins?.legend?.onClick;
        if (typeof defaultLegendClick === "function") {
            defaultLegendClick.call(legend, event, legendItem, legend);
        } else {
            const isVisible = chart.isDatasetVisible(datasetIndex);
            chart.setDatasetVisibility(datasetIndex, !isVisible);
        }
        chart.update("none");
    }

    function getLegendVisualColor(color, hidden) {
        if (!hidden) return color;
        const rgba = String(color || "").match(/rgba?\(([^)]+)\)/i);
        if (rgba) {
            const parts = rgba[1].split(",").map(part => part.trim());
            return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, 0.28)`;
        }
        return "#b8b8b8";
    }

    function removeMetricHtmlLegend() {
        document.getElementById("livestockMetricLegend")?.remove();
    }

    function syncMetricHtmlLegend(chart) {
        const legend = document.getElementById("livestockMetricLegend");
        if (!legend || !chart) return;

        legend.querySelectorAll("[data-dataset-index]").forEach(button => {
            const index = Number(button.dataset.datasetIndex);
            const isVisible = chart.isDatasetVisible(index);
            button.classList.toggle("is-disabled", !isVisible);
            button.setAttribute("aria-pressed", String(isVisible));
            button.title = isVisible
                ? "Ocultar esta categoría del gráfico"
                : "Mostrar esta categoría en el gráfico";
        });
    }

    function renderMetricHtmlLegend(canvas, chart) {
        removeMetricHtmlLegend();

        const anchor = document.getElementById("pibChartScroll") || canvas;
        if (!anchor?.parentNode || !chart?.data?.datasets?.length) return;

        const legend = document.createElement("div");
        legend.id = "livestockMetricLegend";
        legend.className = "livestock-metric-legend";

        chart.data.datasets.forEach((dataset, datasetIndex) => {
            const color = dataset.legendColor
                || (Array.isArray(dataset.backgroundColor)
                    ? dataset.backgroundColor[0]
                    : dataset.backgroundColor)
                || "#8a5a2b";
            const button = document.createElement("button");
            button.type = "button";
            button.className = "livestock-metric-legend__item";
            button.dataset.datasetIndex = String(datasetIndex);
            button.setAttribute("aria-pressed", "true");
            button.innerHTML = `
                <span class="livestock-metric-legend__swatch" style="background:${color}"></span>
                <span class="livestock-metric-legend__label">${dataset.label || ""}</span>
            `;
            button.addEventListener("click", event => {
                event.preventDefault();
                event.stopPropagation();
                const isVisible = chart.isDatasetVisible(datasetIndex);
                chart.setDatasetVisibility(datasetIndex, !isVisible);
                chart.update("none");
                syncMetricHtmlLegend(chart);
            });
            legend.appendChild(button);
        });

        anchor.insertAdjacentElement("afterend", legend);
        syncMetricHtmlLegend(chart);
    }

    function renderDerivedChart(canvas, rows, derivedConfig) {
        canvas.style.display = "block";
        canvas.style.height = "330px";
        canvas.style.width = "100%";
        canvas.style.maxWidth = "100%";
        canvas.style.minWidth = "0";

        derivedChart = createChart(canvas, {
            type: "bar",
            data: {
                labels: rows.map(row => row.label),
                datasets: [
                    {
                        label: "Cantidad de animales",
                        data: rows.map(row => row.animals),
                        backgroundColor: "#2563EB",
                        borderColor: "#1D4ED8",
                        borderWidth: 1
                    },
                    {
                        label: "Cantidad de predios",
                        data: rows.map(row => row.farms),
                        backgroundColor: "#F59E0B",
                        borderColor: "#B45309",
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: { top: 20 }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: derivedConfig.xAxis?.label || "Categorías"
                        },
                        ticks: {
                            autoSkip: false,
                            callback(value, index) {
                                return resolveChartLabel(rows.map(row => row.label), index, {
                                    maxLineLength: 14,
                                    maxLines: 3
                                });
                            },
                            font: buildAdaptiveFont(rows.map(row => row.label), { baseSize: 10, minSize: 8 })
                        }
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: derivedConfig.yAxis?.label || "Cantidad de animales y predios"
                        }
                    }
                },
                plugins: {
                    legend: { position: "bottom" },
                    tooltip: {
                        callbacks: {
                            label(context) {
                                return `${context.dataset.label}: ${formatInteger(context.raw)}`;
                            }
                        }
                    }
                }
            },
            plugins: [createValueLabelsPlugin()]
        });
    }

    async function renderDerivedSpecies(species, chartConfig) {
        const derivedConfig = chartConfig?.derivedCharts?.[species];
        const panel = ensureDerivedPanel();
        const canvas = document.getElementById("livestockDerivedChart");
        const title = document.getElementById("livestockDerivedTitle");
        if (!derivedConfig || !panel || !canvas) return;

        const derivedTitle = String(derivedConfig.title || species || "producción").toLowerCase();

        revealDerivedPanel(panel);
        setDerivedStatus(`Cargando ${derivedTitle}...`);

        try {
            const { attrs, rows } = await queryDerivedRows(chartConfig, derivedConfig);
            if (!attrs || !rows.length || !hasMetricData(rows)) {
                hideDerivedPanel({ keepActiveSpecies: true });
                revealDerivedPanel(panel);
                setDerivedStatus(`No hay valores disponibles para ${derivedTitle} en este municipio.`);
                return;
            }

            if (title) title.textContent = resolveTitle(derivedConfig, attrs);
            setDerivedStatus("");
            renderDerivedChart(canvas, rows, derivedConfig);
            revealDerivedPanel(panel);
        } catch (error) {
            if (derivedChart) {
                derivedChart.destroy();
                derivedChart = null;
            }
            revealDerivedPanel(panel);
            setDerivedStatus(`No se pudo cargar ${derivedTitle}: ${String(error?.message || error)}`);
        }
    }

    function renderChart(canvas, rows, chartConfig) {
        chartCore?.destroyChart?.();

        const chart = createChart(canvas, {
            type: "bar",
            data: {
                labels: rows.map(row => row.label),
                datasets: getMetricDatasets(rows)
            },
            options: {
                indexAxis: "y",
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: chartConfig.xAxis?.label || "Cantidad de animales y predios"
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: chartConfig.yAxis?.label || "Especies pecuarias"
                        },
                        ticks: {
                            callback(value, index) {
                                return resolveChartLabel(rows.map(row => row.label), index, {
                                    maxLineLength: 16,
                                    maxLines: 3
                                });
                            },
                            font: buildAdaptiveFont(rows.map(row => row.label), { baseSize: 10, minSize: 8 })
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false,
                        position: "bottom",
                        onClick(event, legendItem, legend) {
                            toggleMetricDatasetFromLegend(event, legendItem, legend);
                        },
                        labels: {
                            generateLabels(chartInstance) {
                                const defaultGenerator = Chart.defaults.plugins.legend.labels.generateLabels;
                                return defaultGenerator(chartInstance).map(item => {
                                    const dataset = chartInstance.data.datasets?.[item.datasetIndex];
                                    const legendColor = dataset?.legendColor
                                        || (Array.isArray(dataset?.backgroundColor)
                                            ? dataset.backgroundColor[0]
                                            : dataset?.backgroundColor);
                                    const visualColor = getLegendVisualColor(legendColor, item.hidden);
                                    return {
                                        ...item,
                                        fillStyle: visualColor,
                                        strokeStyle: visualColor,
                                        color: item.hidden ? "#8a8a8a" : undefined,
                                        fontColor: item.hidden ? "#8a8a8a" : undefined
                                    };
                                });
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label(context) {
                                return `${context.dataset.label}: ${formatInteger(context.raw)}`;
                            }
                        }
                    }
                },
                onClick() {},
                onHover(event, elements, chart) {
                    const index = elements?.[0]?.index;
                    const labelFromBar = index == null ? "" : chart.data.labels?.[index];
                    const labelFromAxis = resolveClickedLabelFromYAxis(chart, event);
                    const label = labelFromBar || labelFromAxis;
                    const interactive = Boolean(interactiveSpecies(label));
                    if (interactive) {
                        lastInteractiveHoverLabel = label;
                        lastInteractiveHoverAt = Date.now();
                    }
                    event.native.target.style.cursor = interactive ? "pointer" : "default";
                }
            }
        });

        if (canvas.__livestockCensusClickHandler) {
            canvas.removeEventListener("click", canvas.__livestockCensusClickHandler);
            canvas.removeEventListener("pointerup", canvas.__livestockCensusClickHandler);
            canvas.removeEventListener("pointerdown", canvas.__livestockCensusClickHandler);
        }
        canvas.__livestockCensusClickHandler = (nativeEvent) => {
            const pointer = getCanvasPointer(chart, nativeEvent);
            if (pointer && chart.chartArea && pointer.y > chart.chartArea.bottom) return;

            const rowLabel = resolveRowLabelFromYAxis(chart, { native: nativeEvent });
            const label = interactiveSpecies(rowLabel)
                ? rowLabel
                : (rowLabel ? "" : resolveSpeciesLabelForPointer(chart, nativeEvent));
            if (!label) {
                if (rowLabel) {
                    hideDerivedPanel();
                    applyInteractiveHighlight(chart, "");
                }
                return;
            }
            const activated = triggerDerivedChart(label);
            applyInteractiveHighlight(chart, activated ? label : "");
        };
        canvas.addEventListener("pointerdown", canvas.__livestockCensusClickHandler);

        applyInteractiveHighlight(chart);
        chartCore?.setInstance?.(chart);
        renderMetricHtmlLegend(canvas, chart);
    }

    async function actualizarGrafica(layer, config) {
        const chartConfig = config?.chartConfig;
        const canvas = document.getElementById("chart");

        if (!canvas || !chartConfig?.serviceUrl) return true;

        prepareVisibleChartCanvas(canvas);
        canvas.style.height = "360px";
        canvas.style.display = "block";
        hideDerivedPanel();
        removeMetricHtmlLegend();
        if (livestockRenderTimer) clearTimeout(livestockRenderTimer);
        window.renderCensoPecuarioPorcinosSoon = (delay = 0) => {
            if (livestockRenderTimer) clearTimeout(livestockRenderTimer);
            livestockRenderTimer = window.setTimeout(() => renderDerivedSpecies("porcinos", chartConfig), delay);
        };
        window.renderCensoPecuarioAvesSoon = (delay = 0) => {
            if (livestockRenderTimer) clearTimeout(livestockRenderTimer);
            livestockRenderTimer = window.setTimeout(() => renderDerivedSpecies("aves", chartConfig), delay);
        };
        window.hideCensoPecuarioPorcinosPanel = hideDerivedPanel;

        try {
            window.setEconomicChartSubtitle?.(chartConfig.title || config.title);
            setChartStatus(canvas, "Cargando censo pecuario...");

            const features = await queryLivestockRows(chartConfig);
            const feature = features[0];

            if (!feature) {
                chartCore?.destroyChart?.();
                removeMetricHtmlLegend();
                window.setEconomicChartSubtitle?.(chartConfig.title || config.title);
                setChartStatus(canvas, "No hay datos para el filtro seleccionado.");
                return true;
            }

            const attrs = feature.attributes || {};
            const rows = buildRows(feature, chartConfig);

            const hasData = hasMetricData(rows);

            if (!hasData) {
                chartCore?.destroyChart?.();
                removeMetricHtmlLegend();
                window.setEconomicChartSubtitle?.(resolveTitle(chartConfig, attrs));
                setChartStatus(canvas, "No hay valores disponibles para el censo pecuario en este municipio.");
                return true;
            }

            setChartStatus(canvas, "");
            window.setEconomicChartSubtitle?.(resolveTitle(chartConfig, attrs));

            renderChart(canvas, rows, chartConfig);

            refreshSummary?.();

            return true;
        } catch (error) {
            chartCore?.destroyChart?.();
            removeMetricHtmlLegend();
            window.setEconomicChartSubtitle?.(chartConfig.title || config.title);
            setChartStatus(canvas, `No se pudo cargar el censo pecuario: ${String(error?.message || error)}`);
            return true;
        }
    }

    return {
        actualizarGrafica,
        removeMetricHtmlLegend
    };
}
