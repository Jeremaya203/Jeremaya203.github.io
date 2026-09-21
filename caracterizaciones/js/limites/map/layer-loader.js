import { convertAreaToSquareKilometers } from "../utils.js?v=depto-area-km2-20260716";

// ── Caché de capas para reutilización ──
let _municipalitiesLayer = null;
let _departmentsLayer = null;
let _municipalitiesConfigHash = "";
let _departmentsConfigHash = "";

export function clearLayerCache() {
    if (_municipalitiesLayer) {
        try { _municipalitiesLayer.destroy?.(); } catch (e) {}
        _municipalitiesLayer = null;
    }
    if (_departmentsLayer) {
        try { _departmentsLayer.destroy?.(); } catch (e) {}
        _departmentsLayer = null;
    }
    _municipalitiesConfigHash = "";
    _departmentsConfigHash = "";
}

export function hideAllBoundaryLayers() {
    if (_municipalitiesLayer) _municipalitiesLayer.visible = false;
    if (_departmentsLayer) _departmentsLayer.visible = false;
}

// ── Helper: construir definitionExpression ──
function escapeSqlString(value) {
    return String(value ?? "").replace(/'/g, "''");
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function formatAreaSquareKilometers(value) {
    if (value === null || value === undefined || value === "") return "";

    const number = Number(value);
    if (!Number.isFinite(number)) return "";

    return `${new Intl.NumberFormat("es-CO", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(number)} km\u00b2`;
}

function normalizeDigits(value, length) {
    const digits = String(value ?? "").replace(/\D/g, "");
    return digits.length === length ? digits : "";
}

function buildSegmentedCodeWhere(field, code, codeLength, segmentSize = 5, maxSegments = 4) {
    const cleanCode = normalizeDigits(code, codeLength);
    if (!cleanCode) return "";

    const safeField = field || "LLIdentif";
    const safeCode = escapeSqlString(cleanCode);
    const clauses = [];

    for (let segmentIndex = 0; segmentIndex < maxSegments; segmentIndex++) {
        const prefix = "_".repeat(segmentIndex * segmentSize);
        clauses.push(`${safeField} LIKE '${prefix}${safeCode}%'`);
    }

    return `(${clauses.join(" OR ")})`;
}

function buildMunicipalitiesWhere(config, currentDepartmentId, currentMunicipalityId) {
    if (currentMunicipalityId) {
        return buildSegmentedCodeWhere(config.filterField, currentMunicipalityId, 5) || "1=0";
    }
    if (currentDepartmentId && currentDepartmentId !== "0" && currentDepartmentId !== "COL") {
        return buildSegmentedCodeWhere(config.filterField, currentDepartmentId, 2) || "1=0";
    }
    return "1=1";
}

function buildDepartmentsWhere(config, currentDepartmentId) {
    const fixedWhere = config.fixedWhere || "1=1";
    if (currentDepartmentId && currentDepartmentId !== "0" && currentDepartmentId !== "COL") {
        return `(${fixedWhere}) AND (${config.filterField} = '${escapeSqlString(currentDepartmentId)}')`;
    }
    return fixedWhere;
}

function resolveCodedFieldLabel(layer, fieldName, value) {
    const codedValues = layer?.fields
        ?.find(field => String(field.name).toLowerCase() === String(fieldName).toLowerCase())
        ?.domain
        ?.codedValues;
    if (!codedValues?.length) return value;

    const match = codedValues.find(item => String(item.code) === String(value));
    return match?.name || value;
}

function buildDepartmentRenderer() {
    return {
        type: "simple",
        symbol: {
            type: "simple-fill",
            color: [76, 0, 115, 0.08],
            outline: {
                color: [76, 0, 115, 1],
                width: 2
            }
        }
    };
}

// ── createOrUpdateMunicipalitiesLayer ──
export function createOrUpdateMunicipalitiesLayer({
    FeatureLayer, map, boundariesConfig, currentDepartmentId, currentMunicipalityId,
    onReady, onError
}) {
    const config = boundariesConfig.MUNICIPIOS;
    if (!config) return null;

    const boundariesWhere = buildMunicipalitiesWhere(config, currentDepartmentId, currentMunicipalityId);
    const cacheKey = `muni|${boundariesWhere}`;

    // Si la capa ya existe con el mismo filtro, solo actualizar visibilidad
    if (_municipalitiesLayer && _municipalitiesConfigHash === cacheKey) {
        _municipalitiesLayer.visible = false;
        _departmentsLayer && (_departmentsLayer.visible = false);
        if (onReady) {
            Promise.resolve(onReady({ layer: _municipalitiesLayer, config, whereClause: boundariesWhere, reused: true }))
                .catch(error => { if (onError) onError(error); });
        }
        return { layer: _municipalitiesLayer, config, whereClause: boundariesWhere, reused: true };
    }

    // Si la capa existe pero cambió el filtro — actualizar definitionExpression
    if (_municipalitiesLayer) {
        _municipalitiesLayer.definitionExpression = boundariesWhere;
        _municipalitiesLayer.visible = false;
        _departmentsLayer && (_departmentsLayer.visible = false);
        _municipalitiesConfigHash = cacheKey;
        if (onReady) {
            Promise.resolve(onReady({ layer: _municipalitiesLayer, config, whereClause: boundariesWhere, reused: true }))
                .catch(error => { if (onError) onError(error); });
        }
        return { layer: _municipalitiesLayer, config, whereClause: boundariesWhere, reused: true };
    }

    // Primera creación
    const layer = new FeatureLayer({
        url: config.url,
        definitionExpression: boundariesWhere,
        outFields: config.outFields || ["*"],
        opacity: 1,
        visible: false,
        popupEnabled: true,
        renderer: {
            type: "simple",
            symbol: {
                type: "simple-line",
                color: [230, 40, 40, 255],
                width: 3
            }
        }
    });

    layer.popupTemplate = {
        title: "{LLNombre}",
        outFields: ["LLNombre", "LLJerarqui", "LLNorma", "Fecha", "LLEscala", "LLEstado"],
        content: function (feature) {
            const att = feature.graphic.attributes;
            const fields = [
                { label: "Nombre", value: att.LLNombre },
                { label: "Jerarquía", value: att.LLJerarqui },
                { label: "Normatividad", value: att.LLNorma },
                { label: "Escala", value: att.LLEscala },
                { label: "Estado de la línea", value: att.LLEstado }
            ];

            // Formatear fecha si existe
            let fechaStr = "";
            if (att.Fecha) {
                try {
                    const d = new Date(att.Fecha);
                    if (!isNaN(d.getTime())) {
                        fechaStr = d.toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" });
                    }
                } catch (e) {
                    fechaStr = String(att.Fecha);
                }
            }

            const rows = fields
                .filter(f => f.value !== null && f.value !== undefined && String(f.value).trim() !== "")
                .map(f => `<tr><td class="oot-js-limites-layerloader-1">${escapeHtml(f.label)}</td><td class="oot-js-limites-layerloader-2">${escapeHtml(f.value)}</td></tr>`);

            if (fechaStr) {
                rows.push(`<tr><td class="oot-js-limites-layerloader-1">Fecha</td><td class="oot-js-limites-layerloader-2">${escapeHtml(fechaStr)}</td></tr>`);
            }

            const table = document.createElement("table");
            table.style.borderCollapse = "collapse";
            table.innerHTML = rows.join("");
            return table;
        }
    };

    _municipalitiesLayer = layer;
    _municipalitiesConfigHash = cacheKey;
    _departmentsLayer && (_departmentsLayer.visible = false);

    map.add(layer);

    layer.when(() => {
        if (onReady) return onReady({ layer, config, whereClause: boundariesWhere, reused: false });
    }).catch(error => {
        if (onError) onError(error);
    });

    return { layer, config, whereClause: boundariesWhere, reused: false };
}

// ── createOrUpdateDepartmentsLayer ──
export function createOrUpdateDepartmentsLayer({
    FeatureLayer, map, boundariesConfig, currentDepartmentId,
    onReady
}) {
    const config = boundariesConfig.DEPARTAMENTOS;
    if (!config) return null;

    const boundariesWhere = buildDepartmentsWhere(config, currentDepartmentId);
    const cacheKey = `depto|${boundariesWhere}`;

    // Si la capa ya existe con el mismo filtro, solo actualizar visibilidad
    if (_departmentsLayer && _departmentsConfigHash === cacheKey) {
        _departmentsLayer.visible = true;
        _departmentsLayer.renderer = buildDepartmentRenderer();
        _municipalitiesLayer && (_municipalitiesLayer.visible = false);
        if (onReady) {
            onReady({ layer: _departmentsLayer, config, whereClause: boundariesWhere, reused: true });
        }
        return { layer: _departmentsLayer, config, whereClause: boundariesWhere, reused: true };
    }

    // Si la capa existe pero cambió el filtro — actualizar definitionExpression
    if (_departmentsLayer) {
        _departmentsLayer.definitionExpression = boundariesWhere;
        _departmentsLayer.visible = true;
        _departmentsLayer.renderer = buildDepartmentRenderer();
        _municipalitiesLayer && (_municipalitiesLayer.visible = false);
        _departmentsConfigHash = cacheKey;
        if (onReady) {
            onReady({ layer: _departmentsLayer, config, whereClause: boundariesWhere, reused: true });
        }
        return { layer: _departmentsLayer, config, whereClause: boundariesWhere, reused: true };
    }

    // Primera creación
    const layer = new FeatureLayer({
        url: config.url,
        definitionExpression: boundariesWhere,
        outFields: config.outFields || ["*"],
        opacity: 0.85,
        visible: true,
        popupEnabled: true,
        renderer: buildDepartmentRenderer()
    });

    layer.popupTemplate = {
        title: `{${config.nameField || "dpnombre"}}`,
        outFields: config.outFields || ["*"],
        content: function(feature) {
            const att = feature.graphic.attributes || {};
            const codeField = config.filterField || "dpcodigo";
            const nameField = config.nameField || "dpnombre";
            const areaField = config.areaField || config.valueField || "dparea";
            const normaField = config.normaField || "dpnorma";
            const sourceField = config.sourceField || "fuente";
            const rows = [
                { label: "C\u00f3digo DANE", value: att[codeField] },
                { label: "Departamento", value: resolveCodedFieldLabel(layer, nameField, att[nameField]) },
                { label: "\u00c1rea (km\u00b2)", value: formatAreaSquareKilometers(convertAreaToSquareKilometers(att[areaField], config.areaUnit)) },
                { label: "Normatividad", value: att[normaField] },
                { label: "Fuente", value: att[sourceField] }
            ]
                .filter(row => row.value !== null && row.value !== undefined && String(row.value).trim() !== "")
                .map(row => `
                    <tr>
                        <td class="oot-js-limites-layerloader-1">${escapeHtml(row.label)}</td>
                        <td class="oot-js-limites-layerloader-2">${escapeHtml(row.value)}</td>
                    </tr>
                `);

            const table = document.createElement("table");
            table.style.borderCollapse = "collapse";
            table.innerHTML = rows.join("");
            return table;
        }
    };

    _departmentsLayer = layer;
    _departmentsConfigHash = cacheKey;
    _municipalitiesLayer && (_municipalitiesLayer.visible = false);

    map.add(layer);

    layer.when(() => {
        if (onReady) onReady({ layer, config, whereClause: boundariesWhere, reused: false });
    });

    return { layer, config, whereClause: boundariesWhere, reused: false };
}

// ── Compatibilidad hacia atrás: wrappers para código existente ──
export function createMunicipalitiesLayer(opts) {
    return createOrUpdateMunicipalitiesLayer(opts);
}

export function createDepartmentsLayer(opts) {
    return createOrUpdateDepartmentsLayer(opts);
}
