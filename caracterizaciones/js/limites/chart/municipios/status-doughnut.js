var statusChartInstance = null;
var currentStatusIdsByLabel = {};
var currentSelectedStatusLabel = "";
var currentSelectedStatusCode = "";
var currentDisplayCodes = [];
var fullStatusSnapshot = null;

var STATUS_COLORS = [
    "#5E2A84",
    "#D66F36",
    "#2F9C95",
    "#C9A227",
    "#3F6FB5",
    "#9A3D64",
    "#6A8F3A",
    "#7A5A35"
];

var STATUS_DOMAIN = {
    "1": "Límite Provisional",
    "2": "Oficializar/Requiere Deslinde Ley 1447/2011",
    "3": "Definir y oficializar/Requiere Deslinde Ley 1447/2011",
    "4": "En Estudio",
    "5": "Límite Certificado Ley 1447/2011",
    "6": "Expedición Norma Ley 1447/2011",
    "7": "Finalizado Deslinde/Conforme Ley 1447/2011",
    "8": "Delimitado por tratado"
};

var STATUS_SERVICE_NAMES = {
    "1": "Límite_Provisional",
    "2": "Oficializar/Requiere_Deslinde_Ley_1447/2011",
    "3": "Definiryoficializar/Requiere_Deslinde_Ley_1447/2011",
    "4": "En_Estudio",
    "5": "Límite_Certificado_Ley_1447/2011",
    "6": "Expedición_Norma _Ley_1447/2011",
    "7": "Finalizado_Deslinde/Conforme_Ley_1447/2011",
    "8": "Delimitado_por_tratado"
};

var STATUS_CODE_BY_KEY = buildStatusCodeByKey();

function buildStatusCodeByKey() {
    var map = {};
    Object.keys(STATUS_DOMAIN).forEach(function(code) {
        map[normalizeStatusKey(STATUS_DOMAIN[code])] = code;
        if (STATUS_SERVICE_NAMES[code]) {
            map[normalizeStatusKey(STATUS_SERVICE_NAMES[code])] = code;
        }
    });
    return map;
}

function normalizeStatusKey(text) {
    return String(text || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/definiryoficializar/g, "definir y oficializar")
        .replace(/delinde/g, "deslinde")
        .replace(/\s*\/\s*/g, "/")
        .replace(/[_]+/g, " ")
        .replace(/,+(?=\S)/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function normalizeStatus(value) {
    var code = getStatusCodeFromValue(value);
    if (code && STATUS_DOMAIN[code]) return STATUS_DOMAIN[code];

    var raw = String(value ?? "").trim();
    if (!raw) return "Sin estado";

    var text = raw
        .replace(/Definiryoficializar/gi, "Definir y oficializar")
        .replace(/delinde/gi, "deslinde")
        .replace(/[_]+/g, " ")
        .replace(/,+(?=\S)/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    var key = normalizeStatusKey(text);
    if (STATUS_CODE_BY_KEY[key] && STATUS_DOMAIN[STATUS_CODE_BY_KEY[key]]) {
        return STATUS_DOMAIN[STATUS_CODE_BY_KEY[key]];
    }

    return text || "Sin estado";
}

function getStatusCodeFromValue(value) {
    if (value == null || value === "") return null;

    if (typeof value === "object") {
        if (value.code != null && value.code !== "") return String(parseInt(value.code, 10));
        if (value.name != null) value = value.name;
    }

    var raw = String(value).trim();
    if (!raw) return null;
    if (STATUS_DOMAIN[raw]) return raw;

    if (/^\d+(?:\.0+)?$/.test(raw)) {
        return String(parseInt(raw, 10));
    }

    var key = normalizeStatusKey(raw);
    if (STATUS_CODE_BY_KEY[key]) return STATUS_CODE_BY_KEY[key];

    return null;
}

function getStatusCodeForLabel(label) {
    return getStatusCodeFromValue(label) || resolveStatusCode(label);
}

function resolveStatusCode(labelOrCode) {
    var raw = String(labelOrCode || "").trim();
    if (!raw) return "";

    if (STATUS_DOMAIN[raw]) return raw;

    var codeFromValue = getStatusCodeFromValue(raw);
    if (codeFromValue) return codeFromValue;

    var targetKey = normalizeStatusKey(raw);
    if (STATUS_CODE_BY_KEY[targetKey]) return STATUS_CODE_BY_KEY[targetKey];

    var snapshot = fullStatusSnapshot;
    if (snapshot && snapshot.codes) {
        for (var i = 0; i < snapshot.labels.length; i++) {
            if (normalizeStatusKey(snapshot.labels[i]) === targetKey) {
                return String(snapshot.codes[i]);
            }
        }
    }

    return "";
}

function resolveStatusLabel(labelOrCode) {
    var code = resolveStatusCode(labelOrCode);
    if (code && STATUS_DOMAIN[code]) return STATUS_DOMAIN[code];

    var trimmed = String(labelOrCode || "").trim();
    if (!trimmed) return "";

    var targetKey = normalizeStatusKey(trimmed);
    if (STATUS_CODE_BY_KEY[targetKey]) {
        return STATUS_DOMAIN[STATUS_CODE_BY_KEY[targetKey]];
    }

    return normalizeStatus(trimmed);
}

function getSnapshotFeatures() {
    return (fullStatusSnapshot && fullStatusSnapshot.features) || [];
}

function featureMatchesStatusCode(feature, code) {
    if (!code) return false;
    return String(getStatusCodeFromValue(feature?.attributes?.LLEstado) || "") === String(code);
}

function featureMatchesStatusLabel(feature, label) {
    var code = resolveStatusCode(label);
    if (code) return featureMatchesStatusCode(feature, code);
    return normalizeStatus(feature?.attributes?.LLEstado) === resolveStatusLabel(label);
}

function getLlidsForStatusCode(code) {
    var resolvedCode = String(code || "").trim();
    if (!resolvedCode) return [];

    var idsByCode = (fullStatusSnapshot && fullStatusSnapshot.idsByCode) || {};
    var llids = (idsByCode[resolvedCode] || []).slice();
    if (llids.length) return llids;

    var seen = {};
    getSnapshotFeatures().forEach(function(feature) {
        if (!featureMatchesStatusCode(feature, resolvedCode)) return;
        var llid = String(feature.attributes?.LLIdentif || "").trim();
        if (!llid || seen[llid]) return;
        seen[llid] = true;
        llids.push(llid);
    });
    return llids;
}

function getLlidsForStatusLabel(label) {
    return getLlidsForStatusCode(getStatusCodeForLabel(label));
}

function filterFeaturesByStatusCode(features, code) {
    var resolvedCode = String(code || "").trim();
    if (!resolvedCode) return [];
    return (features || []).filter(function(feature) {
        return featureMatchesStatusCode(feature, resolvedCode);
    });
}

function filterFeaturesByStatusLabel(features, label) {
    var code = getStatusCodeForLabel(label);
    if (code) return filterFeaturesByStatusCode(features, code);
    var resolved = resolveStatusLabel(label);
    if (!resolved) return [];
    return (features || []).filter(function(feature) {
        return normalizeStatus(feature.attributes?.LLEstado) === resolved;
    });
}

function codesMatch(left, right) {
    return String(resolveStatusCode(left)) === String(resolveStatusCode(right));
}

function dispatchStatusSelection(chart, index) {
    var label = chart.data.labels[index];
    var code = currentDisplayCodes[index];
    if (!label && !code) return;
    dispatchStatusFilter(label, code);
}

function getStatusIdsByLabel() {
    if (fullStatusSnapshot && fullStatusSnapshot.idsByLabel) {
        return fullStatusSnapshot.idsByLabel;
    }
    return currentStatusIdsByLabel;
}

function dispatchStatusFilter(label, code) {
    var resolvedCode = String(code || resolveStatusCode(label) || "").trim();
    if (!resolvedCode) return;

    var resolvedLabel = STATUS_DOMAIN[resolvedCode] || resolveStatusLabel(label);
    var nextCode = currentSelectedStatusCode === resolvedCode ? "" : resolvedCode;
    var llids = getLlidsForStatusCode(resolvedCode);

    document.dispatchEvent(new CustomEvent(nextCode ? "limites:status-select" : "limites:status-restore", {
        detail: {
            statusLabel: resolvedLabel,
            selectedStatusLabel: nextCode ? resolvedLabel : "",
            statusCode: nextCode || resolvedCode,
            selectedStatusCode: nextCode,
            llids: llids,
            source: "status-doughnut"
        }
    }));
}

function bindStatusLegendEvents() {
    var legendContainer = document.getElementById("municipalStatusChartLegend");
    if (!legendContainer || legendContainer._statusLegendBound) return;

    legendContainer._statusLegendBound = true;
    legendContainer.addEventListener("click", function(event) {
        var item = event.target.closest(".municipal-status-chart__legend-item");
        if (!item || !legendContainer.contains(item)) return;
        event.preventDefault();
        event.stopPropagation();
        dispatchStatusFilter(
            item.getAttribute("data-status-label"),
            item.getAttribute("data-status-code")
        );
    });
}

function bindStatusRestoreEvents() {
    var section = document.getElementById("municipalStatusChartSection");
    if (!section || section._statusRestoreBound) return;

    section._statusRestoreBound = true;
    section.addEventListener("dblclick", function(event) {
        if (event.target.closest("#municipalStatusChart")) return;
        if (!currentSelectedStatusCode) return;
        document.dispatchEvent(new CustomEvent("limites:status-restore", {
            detail: { source: "status-doughnut" }
        }));
    });
}

function getLegendDisplayLabels() {
    var snapshot = fullStatusSnapshot;
    var codes = currentDisplayCodes.slice();
    if (snapshot && codes.length) {
        return codes.map(function(code, index) {
            var idx = snapshot.codes.indexOf(String(code));
            if (idx >= 0) return snapshot.labels[idx];
            if (statusChartInstance && statusChartInstance.data.labels) {
                return statusChartInstance.data.labels[index] || "";
            }
            return resolveStatusLabel(code);
        });
    }
    if (statusChartInstance && statusChartInstance.data.labels) {
        return statusChartInstance.data.labels.slice();
    }
    return [];
}

function renderHtmlLegend(chart, selectedCode) {
    var legendContainer = document.getElementById("municipalStatusChartLegend");
    if (!legendContainer) return;

    legendContainer.innerHTML = "";
    var labels = getLegendDisplayLabels();
    var colors = (chart.data.datasets[0] && chart.data.datasets[0].backgroundColor) || [];
    var codes = currentDisplayCodes.slice();
    var resolvedSelected = selectedCode ? String(selectedCode) : "";

    legendContainer.classList.toggle("has-many-items", labels.length >= 3);

    labels.forEach(function(text, index) {
        var fullLabel = String(text || resolveStatusLabel(codes[index]) || "").trim();
        var code = codes[index] || resolveStatusCode(fullLabel);
        var button = document.createElement("button");
        button.type = "button";
        button.className = "municipal-status-chart__legend-item";
        button.setAttribute("data-status-index", String(index));
        button.setAttribute("data-status-label", fullLabel);
        button.setAttribute("data-status-code", code);
        button.setAttribute("aria-pressed", "true");
        button.classList.toggle("is-selected", !!resolvedSelected && String(code) === resolvedSelected);
        button.title = fullLabel;

        var swatch = document.createElement("span");
        swatch.className = "municipal-status-chart__legend-swatch";
        swatch.style.background = colors[index] || STATUS_COLORS[index % STATUS_COLORS.length];

        var label = document.createElement("span");
        label.className = "municipal-status-chart__legend-label";
        label.textContent = fullLabel;

        button.appendChild(swatch);
        button.appendChild(label);
        legendContainer.appendChild(button);
    });
    bindStatusLegendEvents();
}

var statusHtmlLegendPlugin = {
    id: "limitesMunicipalStatusHtmlLegend",
    afterUpdate: function(chart) {
        renderHtmlLegend(chart, currentSelectedStatusCode || "");
    }
};

function drawStatusSegmentValueLabels(chart) {
    var ctx = chart.ctx;
    var dataset = chart.data.datasets[0];
    var meta = chart.getDatasetMeta(0);
    if (!ctx || !dataset || !meta || meta.hidden) return;

    var arcs = meta.data || [];
    var singleSegment = arcs.length === 1;

    arcs.forEach(function(arc, index) {
        var value = Number(dataset.data[index] || 0);
        if (!value) return;

        var angle = (arc.startAngle + arc.endAngle) / 2;
        var midRadius = (arc.innerRadius + arc.outerRadius) / 2;
        var x = singleSegment ? arc.x : arc.x + Math.cos(angle) * midRadius;
        var y = singleSegment ? arc.y : arc.y + Math.sin(angle) * midRadius;
        var arcSpan = arc.endAngle - arc.startAngle;
        var fontSize = singleSegment ? 24 : (arcSpan < 0.32 ? 10 : (arcSpan < 0.55 ? 11 : 13));
        var label = String(value);

        ctx.save();
        ctx.font = "700 " + fontSize + "px Outfit, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#fffaf5";
        ctx.strokeStyle = "rgba(38, 30, 43, 0.72)";
        ctx.lineWidth = singleSegment ? 3 : 2;
        ctx.lineJoin = "round";
        ctx.strokeText(label, x, y);
        ctx.fillText(label, x, y);
        ctx.restore();
    });
}

var statusValueLabelsPlugin = {
    id: "limitesMunicipalStatusValueLabels",
    afterDatasetsDraw: function(chart) {
        drawStatusSegmentValueLabels(chart);
    }
};

function getUniqueStatusFeatures(features) {
    var seen = new Set();
    var output = [];

    (features || []).forEach(function(feature) {
        var att = feature.attributes || {};
        var id = String(att.LLIdentif || "").trim();
        var name = String(att.LLNombre || "").trim();
        var status = normalizeStatus(att.LLEstado);
        var key = id || (name + "|" + status);
        if (!key || seen.has(key)) return;
        seen.add(key);
        output.push(feature);
    });

    return output;
}

function buildStatusSnapshot(features) {
    var uniqueFeatures = getUniqueStatusFeatures(features);
    var groups = new Map();

    uniqueFeatures.forEach(function(feature) {
        var att = feature.attributes || {};
        var code = getStatusCodeFromValue(att.LLEstado);
        var label = normalizeStatus(att.LLEstado);
        if (!code) {
            code = "label:" + normalizeStatusKey(label);
        }

        if (!groups.has(code)) {
            groups.set(code, {
                code: String(code),
                label: label,
                count: 0,
                llids: []
            });
        }

        var group = groups.get(code);
        group.count += 1;
        var llid = String(att.LLIdentif || "").trim();
        if (llid && group.llids.indexOf(llid) === -1) {
            group.llids.push(llid);
        }
    });

    var orderedGroups = Array.from(groups.values()).sort(function(a, b) {
        var numA = parseInt(a.code, 10);
        var numB = parseInt(b.code, 10);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return String(a.label).localeCompare(String(b.label), "es");
    });

    var labels = [];
    var values = [];
    var codes = [];
    var idsByLabel = {};
    var idsByCode = {};
    var colorByCode = {};

    orderedGroups.forEach(function(group, index) {
        labels.push(group.label);
        values.push(group.count);
        codes.push(group.code);
        idsByLabel[group.label] = group.llids.slice();
        idsByCode[group.code] = group.llids.slice();
        colorByCode[group.code] = STATUS_COLORS[index % STATUS_COLORS.length];
    });

    return {
        labels: labels,
        values: values,
        codes: codes,
        idsByLabel: idsByLabel,
        idsByCode: idsByCode,
        colorByCode: colorByCode,
        total: values.reduce(function(sum, value) { return sum + value; }, 0),
        features: uniqueFeatures
    };
}

function findSnapshotIndexByCode(snapshot, selectedCode) {
    var resolvedCode = String(selectedCode || "").trim();
    if (!resolvedCode) return -1;
    for (var i = 0; i < snapshot.codes.length; i++) {
        if (String(snapshot.codes[i]) === resolvedCode) return i;
    }
    return -1;
}

function getDisplayData(snapshot, selectedCode) {
    if (!selectedCode) {
        return {
            labels: snapshot.labels.slice(),
            values: snapshot.values.slice(),
            codes: snapshot.codes.slice(),
            colors: snapshot.codes.map(function(code) { return snapshot.colorByCode[code]; }),
            total: snapshot.total
        };
    }

    var index = findSnapshotIndexByCode(snapshot, selectedCode);
    if (index === -1) {
        return {
            labels: snapshot.labels.slice(),
            values: snapshot.values.slice(),
            codes: snapshot.codes.slice(),
            colors: snapshot.codes.map(function(code) { return snapshot.colorByCode[code]; }),
            total: snapshot.total
        };
    }

    var code = snapshot.codes[index];
    return {
        labels: [snapshot.labels[index]],
        values: [snapshot.values[index]],
        codes: [code],
        colors: [snapshot.colorByCode[code]],
        total: snapshot.values[index]
    };
}

function destroyStatusDoughnut() {
    if (statusChartInstance) {
        statusChartInstance.destroy();
        statusChartInstance = null;
    }
    currentStatusIdsByLabel = {};
    currentSelectedStatusLabel = "";
    currentSelectedStatusCode = "";
    currentDisplayCodes = [];
    fullStatusSnapshot = null;

    var section = document.getElementById("municipalStatusChartSection");
    if (section) {
        section.style.display = "none";
        section.removeAttribute("data-status-labels");
    }
    var legendContainer = document.getElementById("municipalStatusChartLegend");
    if (legendContainer) legendContainer.innerHTML = "";

    var canvas = document.getElementById("municipalStatusChart");
    if (canvas) {
        canvas.ondblclick = null;
        var ctx = canvas.getContext("2d");
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

function renderStatusDoughnut(features, options) {
    options = options || {};
    var section = document.getElementById("municipalStatusChartSection");
    var canvas = document.getElementById("municipalStatusChart");
    if (!section || !canvas || typeof Chart === "undefined") return;

    if (statusChartInstance) {
        statusChartInstance.destroy();
        statusChartInstance = null;
    }

    var selectedCode = String(
        options.selectedStatusCode ||
        resolveStatusCode(options.selectedStatusLabel) ||
        ""
    ).trim();
    var snapshot = buildStatusSnapshot(features);

    if (!selectedCode) {
        fullStatusSnapshot = snapshot;
    } else if (!fullStatusSnapshot) {
        fullStatusSnapshot = snapshot;
    }

    var activeSnapshot = fullStatusSnapshot || snapshot;
    currentStatusIdsByLabel = activeSnapshot.idsByLabel;
    currentSelectedStatusCode = selectedCode;
    currentSelectedStatusLabel = selectedCode ? resolveStatusLabel(selectedCode) : "";

    var display = getDisplayData(activeSnapshot, selectedCode);
    currentDisplayCodes = display.codes.slice();
    var labels = display.labels;
    var values = display.values;
    var total = display.total;

    if (!total) {
        section.style.display = "none";
        section.removeAttribute("data-status-labels");
        currentDisplayCodes = [];
        return;
    }

    section.style.display = "";
    section.setAttribute("data-status-labels", activeSnapshot.labels.join("|"));
    var titleEl = section.querySelector("h3");
    if (titleEl) titleEl.textContent = options.title || "Estado de las líneas limítrofes";
    var subtitleEl = document.getElementById("municipalStatusChartSubtitle");
    if (subtitleEl) subtitleEl.textContent = "";
    canvas.removeAttribute("width");
    canvas.removeAttribute("height");
    canvas.style.width = "";
    canvas.style.maxWidth = "";
    canvas.style.height = "";
    canvas.style.minHeight = "";
    canvas.style.maxHeight = "";

    statusChartInstance = new Chart(canvas, {
        type: "doughnut",
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: display.colors,
                borderColor: "#fffaf0",
                borderWidth: labels.length === 1 ? 4 : 2,
                hoverOffset: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 1,
            cutout: "50%",
            radius: "96%",
            layout: { padding: 0 },
            onClick: function(event, elements, chart) {
                if (!elements || !elements.length) return;
                dispatchStatusSelection(chart, elements[0].index);
            },
            scales: {
                x: {
                    display: false,
                    grid: { display: false, drawBorder: false },
                    ticks: { display: false },
                    border: { display: false }
                },
                y: {
                    display: false,
                    grid: { display: false, drawBorder: false },
                    ticks: { display: false },
                    border: { display: false }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: "rgba(38, 30, 43, 0.88)",
                    padding: 10,
                    displayColors: true,
                    boxWidth: 10,
                    boxHeight: 10,
                    titleFont: { family: "Outfit, sans-serif", size: 11, weight: "700" },
                    bodyFont: { family: "Outfit, sans-serif", size: 10, weight: "500" },
                    callbacks: {
                        title: function(items) {
                            return items && items[0] ? items[0].label : "";
                        },
                        label: function(context) {
                            var value = Number(context.raw || 0);
                            var percent = total ? ((value / total) * 100).toFixed(1) : "0.0";
                            return value + " (" + percent + "%)";
                        }
                    }
                }
            }
        },
        plugins: [statusHtmlLegendPlugin, statusValueLabelsPlugin]
    });

    canvas.ondblclick = function() {
        if (!currentSelectedStatusCode) return;
        document.dispatchEvent(new CustomEvent("limites:status-restore", {
            detail: { source: "status-doughnut" }
        }));
    };

    bindStatusRestoreEvents();
    renderHtmlLegend(statusChartInstance, selectedCode);
}

export {
    renderStatusDoughnut,
    destroyStatusDoughnut,
    resolveStatusLabel,
    resolveStatusCode,
    getLlidsForStatusLabel,
    getLlidsForStatusCode,
    getStatusCodeForLabel,
    getStatusCodeFromValue,
    filterFeaturesByStatusLabel,
    filterFeaturesByStatusCode,
    normalizeStatus
};
