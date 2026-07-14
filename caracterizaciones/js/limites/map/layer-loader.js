// ── Caché de capas para reutilización ──
let _municipiosLayer = null;
let _departamentosLayer = null;
let _municipiosConfigHash = "";
let _departamentosConfigHash = "";

export function clearLayerCache() {
    if (_municipiosLayer) {
        try { _municipiosLayer.destroy?.(); } catch (e) {}
        _municipiosLayer = null;
    }
    if (_departamentosLayer) {
        try { _departamentosLayer.destroy?.(); } catch (e) {}
        _departamentosLayer = null;
    }
    _municipiosConfigHash = "";
    _departamentosConfigHash = "";
}

export function hideAllLimitesLayers() {
    if (_municipiosLayer) _municipiosLayer.visible = false;
    if (_departamentosLayer) _departamentosLayer.visible = false;
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

function formatAreaKm2(value) {
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

function buildWhereMunicipios(config, deptoActual, municipioActual) {
    if (municipioActual) {
        return buildSegmentedCodeWhere(config.filterField, municipioActual, 5) || "1=0";
    }
    if (deptoActual && deptoActual !== "0" && deptoActual !== "COL") {
        return buildSegmentedCodeWhere(config.filterField, deptoActual, 2) || "1=0";
    }
    return "1=1";
}

function buildWhereDepartamentos(config, deptoActual) {
    if (deptoActual && deptoActual !== "0" && deptoActual !== "COL") {
        return `${config.filterField} = '${escapeSqlString(deptoActual)}'`;
    }
    return "1=1";
}

// ── createOrUpdateMunicipiosLayer ──
export function createOrUpdateMunicipiosLayer({
    FeatureLayer, map, LIMITES_CONFIG, deptoActual, municipioActual,
    onReady
}) {
    const config = LIMITES_CONFIG.MUNICIPIOS;
    if (!config) return null;

    const whereLimites = buildWhereMunicipios(config, deptoActual, municipioActual);
    const cacheKey = `muni|${whereLimites}`;

    // Si la capa ya existe con el mismo filtro, solo actualizar visibilidad
    if (_municipiosLayer && _municipiosConfigHash === cacheKey) {
        _municipiosLayer.visible = false;
        _departamentosLayer && (_departamentosLayer.visible = false);
        if (onReady) {
            onReady({ layer: _municipiosLayer, config, whereClause: whereLimites, reused: true });
        }
        return { layer: _municipiosLayer, config, whereClause: whereLimites, reused: true };
    }

    // Si la capa existe pero cambió el filtro — actualizar definitionExpression
    if (_municipiosLayer) {
        _municipiosLayer.definitionExpression = whereLimites;
        _municipiosLayer.visible = false;
        _departamentosLayer && (_departamentosLayer.visible = false);
        _municipiosConfigHash = cacheKey;
        if (onReady) {
            onReady({ layer: _municipiosLayer, config, whereClause: whereLimites, reused: true });
        }
        return { layer: _municipiosLayer, config, whereClause: whereLimites, reused: true };
    }

    // Primera creación
    const layer = new FeatureLayer({
        url: config.url,
        definitionExpression: whereLimites,
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
                .map(f => `<tr><td style="font-weight:600;padding:4px 8px 4px 0;white-space:nowrap;vertical-align:top;color:#555;">${f.label}</td><td style="padding:4px 0;color:#222;">${String(f.value).replace(/</g, "<").replace(/>/g, ">")}</td></tr>`);

            if (fechaStr) {
                rows.push(`<tr><td style="font-weight:600;padding:4px 8px 4px 0;white-space:nowrap;vertical-align:top;color:#555;">Fecha</td><td style="padding:4px 0;color:#222;">${fechaStr}</td></tr>`);
            }

            const table = document.createElement("table");
            table.style.borderCollapse = "collapse";
            table.innerHTML = rows.join("");
            return table;
        }
    };

    _municipiosLayer = layer;
    _municipiosConfigHash = cacheKey;
    _departamentosLayer && (_departamentosLayer.visible = false);

    map.add(layer);

    layer.when(() => {
        if (onReady) onReady({ layer, config, whereClause: whereLimites, reused: false });
    });

    return { layer, config, whereClause: whereLimites, reused: false };
}

// ── createOrUpdateDepartamentosLayer ──
export function createOrUpdateDepartamentosLayer({
    FeatureLayer, map, LIMITES_CONFIG, deptoActual,
    onReady
}) {
    const config = LIMITES_CONFIG.DEPARTAMENTOS;
    if (!config) return null;

    const whereLimites = buildWhereDepartamentos(config, deptoActual);
    const cacheKey = `depto|${whereLimites}`;

    // Si la capa ya existe con el mismo filtro, solo actualizar visibilidad
    if (_departamentosLayer && _departamentosConfigHash === cacheKey) {
        _departamentosLayer.visible = true;
        _municipiosLayer && (_municipiosLayer.visible = false);
        if (onReady) {
            onReady({ layer: _departamentosLayer, config, whereClause: whereLimites, reused: true });
        }
        return { layer: _departamentosLayer, config, whereClause: whereLimites, reused: true };
    }

    // Si la capa existe pero cambió el filtro — actualizar definitionExpression
    if (_departamentosLayer) {
        _departamentosLayer.definitionExpression = whereLimites;
        _departamentosLayer.visible = true;
        _municipiosLayer && (_municipiosLayer.visible = false);
        _departamentosConfigHash = cacheKey;
        if (onReady) {
            onReady({ layer: _departamentosLayer, config, whereClause: whereLimites, reused: true });
        }
        return { layer: _departamentosLayer, config, whereClause: whereLimites, reused: true };
    }

    // Primera creación
    const layer = new FeatureLayer({
        url: config.url,
        definitionExpression: whereLimites,
        outFields: config.outFields || ["*"],
        opacity: 0.85,
        visible: true,
        popupEnabled: true
    });

    layer.popupTemplate = {
        title: "{DeNombre}",
        outFields: ["DeCodigo", "DeNombre", "DeArea", "DeNorma"],
        content: function(feature) {
            const att = feature.graphic.attributes || {};
            const rows = [
                { label: "C\u00f3digo DANE", value: att.DeCodigo },
                { label: "Departamento", value: att.DeNombre },
                { label: "\u00c1rea (km\u00b2)", value: formatAreaKm2(att.DeArea) },
                { label: "Normatividad", value: att.DeNorma }
            ]
                .filter(row => row.value !== null && row.value !== undefined && String(row.value).trim() !== "")
                .map(row => `
                    <tr>
                        <td style="font-weight:600;padding:4px 8px 4px 0;white-space:nowrap;vertical-align:top;color:#555;">${escapeHtml(row.label)}</td>
                        <td style="padding:4px 0;color:#222;">${escapeHtml(row.value)}</td>
                    </tr>
                `);

            const table = document.createElement("table");
            table.style.borderCollapse = "collapse";
            table.innerHTML = rows.join("");
            return table;
        }
    };

    _departamentosLayer = layer;
    _departamentosConfigHash = cacheKey;
    _municipiosLayer && (_municipiosLayer.visible = false);

    map.add(layer);

    layer.when(() => {
        if (onReady) onReady({ layer, config, whereClause: whereLimites, reused: false });
    });

    return { layer, config, whereClause: whereLimites, reused: false };
}

// ── Compatibilidad hacia atrás: wrappers para código existente ──
export function createMunicipiosLayer(opts) {
    return createOrUpdateMunicipiosLayer(opts);
}

export function createDepartamentosLayer(opts) {
    return createOrUpdateDepartamentosLayer(opts);
}
