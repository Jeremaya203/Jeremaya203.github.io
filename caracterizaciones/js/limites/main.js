import { createMunicipiosLayer, createDepartamentosLayer, hideAllLimitesLayers } from "./map/layer-loader.js?v=depto-area-km2-20260716";
import { initOverview } from "./map/overview.js";
import { initScaleBar } from "./map/scale.js";
import { initMapControls } from "./map/map.controls.js";
import { initModuleDropdown, initDropdownDescargables } from "./ui/dropdowns.js";
import { updateMapViewBadge, setLegendLayerTitle } from "./ui/ui.helpers.js";
import { AppState } from "./app/state.js";
import { clearLayers as clearMapLayers } from "./map/layers.js";
import { createMainMap } from "./map/map.core.js";
import { LIMITES_CONFIG } from "./config.js?v=depto-area-km2-20260716";
import { sqlEquals, sqlStartsWith, sqlContains, normalizeCode, getMunicipioDisplayName, getDepartamentoDisplayName } from "./utils.js?v=depto-area-km2-20260716";
import { actualizarLeyendaLimitesMunicipales } from "./legend.js?v=municipal-coastal-group-20260618";
import { actualizarLeyendaDepartamentosLimites, toggleLegend } from "./ui/legend.ui.js";
import { actualizarResumen } from "./ui/summary.js";
import { cargarDiccionarioDesdeApi } from "./data/territorial.js";
import { renderChart as renderChartMunicipios } from "./chart/municipios/chart.js?v=municipal-axis-labels-20260716d";
import { renderStatusDoughnut, destroyStatusDoughnut, resolveStatusLabel, resolveStatusCode, getLlidsForStatusLabel, getLlidsForStatusCode, getStatusCodeForLabel, filterFeaturesByStatusLabel, filterFeaturesByStatusCode } from "./chart/municipios/status-doughnut.js?v=municipal-status-chart-scale-300-20260706";
import { renderChart as renderChartDepartamentos, highlightDeptoChartBar, highlightDeptoChartByCode, clearDeptoChartHighlight } from "./chart/departamentales/chart.js?v=depto-area-km2-20260716";
import { destroyChart, resetChartLayout } from "./chart/chart.core.js";
import { getColorForLinea } from "./colors.js";
import { fetchTimelineData, renderTimeline } from "./data/timeline.js?v=municipal-performance-20260618";
import { setupMunicipalSync, clearMunicipalSync } from "./interactions/municipal-sync.js";

// ── Estado de tab ──
var currentLimitesTab = "DEPARTAMENTOS";
var layerGlobal = null;
var whereBase = "";
var municipioActual = "";
var diccionarioMunicipios = {};
var diccionarioDepartamentos = {};
var todosMunicipios = [];
var map = null;
var view = null;
var deptoActual = "";
var filtroNivel = "";
var highlightHandle = null;
var extentInicial = null;
var renderCycleId = 0;
var deptoLayerRef = null;
var auxiliaryTerritoryLayer = null;

window.__legendState = { activeCodes: new Set(), field: null, layer: null, baseWhere: "1=1" };

function nextRenderCycle() {
    renderCycleId += 1;
    return renderCycleId;
}

function isRenderCycleCurrent(cycleId) {
    return cycleId === renderCycleId;
}

function syncDeptoFromSelect() {
    var ds = document.getElementById("departamentos");
    if (!ds) return;
    var val = ds.value;
    if (val && val !== "0" && val !== "COL") {
        deptoActual = val;
        return;
    }
    if (!deptoActual || deptoActual === "0" || deptoActual === "COL") {
        deptoActual = "";
    }
}

function escapeLimitesSql(value) {
    return String(value ?? "").replace(/'/g, "''");
}

function getLimitesServiceRoot(layerUrl) {
    return String(layerUrl || "").replace(/\/\d+\/?$/, "");
}

var coastalWhereCache = {};
var LA_GUAJIRA_DEPARTMENT_CODE = "44";
var URIBIA_MUNICIPALITY_CODE = "44847";
var COASTAL_CARTOGRAPHIC_WHERE = "(LLIdentif = '1111111111' OR LLJerarqui = 5)";

function getDepartmentCodeForMunicipalContext(deptoCode, municipioCode) {
    var depto = String(deptoCode || "").trim();
    if (depto && depto !== "0" && depto !== "COL") return depto.slice(0, 2);

    var municipio = String(municipioCode || "").trim();
    return municipio.length >= 2 ? municipio.slice(0, 2) : "";
}

function isLaGuajiraMunicipalContext(deptoCode, municipioCode) {
    return getDepartmentCodeForMunicipalContext(deptoCode, municipioCode) === LA_GUAJIRA_DEPARTMENT_CODE;
}

function mergeFeaturesByObjectId() {
    var merged = [];
    var seen = new Set();

    Array.prototype.forEach.call(arguments, function(features) {
        (features || []).forEach(function(feature) {
            var objectId = Number(feature.attributes && feature.attributes.OBJECTID);
            if (!Number.isFinite(objectId) || seen.has(objectId)) return;
            seen.add(objectId);
            merged.push(feature);
        });
    });

    return merged;
}

async function queryLaGuajiraCoastalCartographicLines(coastLayer, municipioGeometry) {
    if (!coastLayer || !municipioGeometry) return [];

    var result = await coastLayer.queryFeatures({
        where: COASTAL_CARTOGRAPHIC_WHERE,
        geometry: municipioGeometry,
        spatialRelationship: "intersects",
        outFields: ["OBJECTID"],
        returnGeometry: true
    });

    return removeSouthernmostCoastalSegment(result.features || [], 4);
}

function getAveragePoint(points) {
    if (!points || !points.length) return null;
    var sum = points.reduce(function(acc, point) {
        acc[0] += point[0];
        acc[1] += point[1];
        return acc;
    }, [0, 0]);
    return [sum[0] / points.length, sum[1] / points.length];
}

function getGeometryPoints(geometry) {
    var parts = (geometry && (geometry.paths || geometry.rings)) || [];
    if (!parts.length) return [];

    var points = [];
    parts.forEach(function(part) {
        (part || []).forEach(function(point) {
            if (point && point.length >= 2) points.push([Number(point[0]), Number(point[1])]);
        });
    });
    return points;
}

function getPolylinePoints(geometry) {
    return getGeometryPoints(geometry);
}

function getFeatureMinY(feature) {
    var points = getGeometryPoints(feature && feature.geometry);
    if (!points.length) return Infinity;
    return points.reduce(function(minY, point) {
        return Math.min(minY, point[1]);
    }, Infinity);
}

function getFeatureMaxX(feature) {
    var points = getGeometryPoints(feature && feature.geometry);
    if (!points.length) return -Infinity;
    return points.reduce(function(maxX, point) {
        return Math.max(maxX, point[0]);
    }, -Infinity);
}

function removeSouthernmostCoastalSegment(features, maxSegments) {
    var list = features || [];
    if (list.length <= maxSegments) return list;

    var southernmostIndex = -1;
    var southernmostY = Infinity;
    list.forEach(function(feature, index) {
        var minY = getFeatureMinY(feature);
        if (minY < southernmostY) {
            southernmostY = minY;
            southernmostIndex = index;
        }
    });

    if (southernmostIndex < 0) return list;
    return list.filter(function(_, index) {
        return index !== southernmostIndex;
    });
}

function keepEasternmostCoastalSegment(features) {
    var list = features || [];
    if (list.length <= 1) return list;

    var easternmostFeature = null;
    var easternmostX = -Infinity;
    list.forEach(function(feature) {
        var maxX = getFeatureMaxX(feature);
        if (maxX > easternmostX) {
            easternmostX = maxX;
            easternmostFeature = feature;
        }
    });

    return easternmostFeature ? [easternmostFeature] : list;
}

function getPolylineEndpoints(geometry) {
    var paths = geometry && geometry.paths;
    if (!paths || !paths.length) return [];

    var endpoints = [];
    paths.forEach(function(path) {
        if (!path || !path.length) return;
        endpoints.push([Number(path[0][0]), Number(path[0][1])]);
        endpoints.push([Number(path[path.length - 1][0]), Number(path[path.length - 1][1])]);
    });
    return endpoints;
}

function samePoint(a, b, tolerance) {
    if (!a || !b) return false;
    return Math.abs(a[0] - b[0]) <= tolerance && Math.abs(a[1] - b[1]) <= tolerance;
}

function pointDirectionScore(origin, target, candidate) {
    if (!origin || !target || !candidate) return 0;
    return ((target[0] - origin[0]) * (candidate[0] - origin[0])) +
        ((target[1] - origin[1]) * (candidate[1] - origin[1]));
}

function filterLaGuajiraMunicipalCoastalFeatures(coastalFeatures, municipioGeometry, normalFeatures) {
    if (!coastalFeatures?.length || !municipioGeometry) return coastalFeatures || [];

    var tolerance = 0.00001;
    var municipioCenter = getAveragePoint(getGeometryPoints(municipioGeometry));
    if (!municipioCenter) return coastalFeatures || [];

    var normalEndpoints = [];
    (normalFeatures || []).forEach(function(feature) {
        getPolylineEndpoints(feature.geometry).forEach(function(point) {
            normalEndpoints.push(point);
        });
    });

    if (!normalEndpoints.length) return coastalFeatures || [];

    var filtered = coastalFeatures.filter(function(feature) {
        var coastalPoints = getPolylinePoints(feature.geometry);
        var coastalCenter = getAveragePoint(coastalPoints);
        if (!coastalCenter) return false;

        var touchedEndpoints = normalEndpoints.filter(function(endpoint) {
            return coastalPoints.some(function(point) {
                return samePoint(point, endpoint, tolerance);
            });
        });

        if (!touchedEndpoints.length) return true;

        return touchedEndpoints.some(function(endpoint) {
            return pointDirectionScore(endpoint, municipioCenter, coastalCenter) >= 0;
        });
    });

    return filtered.length ? filtered : coastalFeatures;
}

function filterMunicipalCoastalClosures(coastalFeatures, normalFeatures) {
    if (!coastalFeatures?.length || !normalFeatures?.length) return coastalFeatures || [];

    var tolerance = 0.00001;
    var normalEndpoints = [];
    normalFeatures.forEach(function(feature) {
        var objectId = String(feature.attributes?.OBJECTID ?? feature.attributes?.LLIdentif ?? "");
        getPolylineEndpoints(feature.geometry).forEach(function(point) {
            normalEndpoints.push({ objectId: objectId, point: point });
        });
    });

    var filtered = coastalFeatures.filter(function(feature) {
        var coastalPoints = getPolylinePoints(feature.geometry);
        var touchedNormalIds = new Set();

        normalEndpoints.forEach(function(endpoint) {
            if (coastalPoints.some(function(point) { return samePoint(point, endpoint.point, tolerance); })) {
                touchedNormalIds.add(endpoint.objectId);
            }
        });

        return touchedNormalIds.size >= 2;
    });

    return filtered.length ? filtered : coastalFeatures;
}

function filterDepartmentCoastalChain(coastalFeatures, normalFeatures) {
    if (!coastalFeatures?.length || !normalFeatures?.length) return coastalFeatures || [];

    var tolerance = 0.00001;
    var normalEndpoints = [];
    normalFeatures.forEach(function(feature) {
        getPolylineEndpoints(feature.geometry).forEach(function(point) {
            normalEndpoints.push(point);
        });
    });

    function endpointTouchesNormal(point) {
        return normalEndpoints.some(function(endpoint) {
            return samePoint(point, endpoint, tolerance);
        });
    }

    var filtered = coastalFeatures.filter(function(feature) {
        var endpoints = getPolylineEndpoints(feature.geometry);
        if (endpoints.length < 2) return false;
        return endpoints.every(endpointTouchesNormal);
    });

    return filtered.length ? filtered : coastalFeatures;
}

async function buildMunicipalCoastalWhere(FeatureLayerCtor, config, baseWhere, deptoCode, municipioCode) {
    var code = municipioCode || deptoCode;
    if (!FeatureLayerCtor || !config || !code || code === "0" || code === "COL") return "";

    var cacheKey = (municipioCode ? "muni:" : "depto:") + String(code);
    if (Object.prototype.hasOwnProperty.call(coastalWhereCache, cacheKey)) {
        return coastalWhereCache[cacheKey];
    }

    try {
        var serviceRoot = getLimitesServiceRoot(config.url);
        if (!serviceRoot) return "";

        var isMunicipio = !!municipioCode;
        var territoryLayer = new FeatureLayerCtor({
            url: serviceRoot + "/" + (isMunicipio ? "1" : "2"),
            outFields: [isMunicipio ? "MpCodigo" : "DeCodigo"],
            popupEnabled: false
        });

        var codeField = isMunicipio ? "MpCodigo" : "DeCodigo";
        var territoryWhere = codeField + " = '" + escapeLimitesSql(code) + "'";
        var territoryResult = await territoryLayer.queryFeatures({
            where: territoryWhere,
            outFields: [codeField],
            returnGeometry: true
        });

        var geometry = territoryResult.features && territoryResult.features[0] && territoryResult.features[0].geometry;
        if (!geometry) {
            coastalWhereCache[cacheKey] = "";
            return "";
        }

        var coastLayer = new FeatureLayerCtor({
            url: config.url,
            outFields: ["OBJECTID", "LLIdentif", "LLJerarqui"],
            popupEnabled: false
        });

        var coastResult = await coastLayer.queryFeatures({
            where: COASTAL_CARTOGRAPHIC_WHERE,
            geometry: geometry,
            spatialRelationship: "intersects",
            outFields: ["OBJECTID"],
            returnGeometry: true
        });

        var coastalFeatures = coastResult.features || [];
        if (municipioCode) {
            var normalResult = await coastLayer.queryFeatures({
                where: baseWhere || "1=0",
                outFields: ["OBJECTID", "LLIdentif"],
                returnGeometry: true
            });
            coastalFeatures = filterMunicipalCoastalClosures(coastalFeatures, normalResult.features || []);

            if (isLaGuajiraMunicipalContext(deptoCode, municipioCode)) {
                var laGuajiraCoastalFeatures = await queryLaGuajiraCoastalCartographicLines(
                    coastLayer,
                    geometry
                );
                laGuajiraCoastalFeatures = filterLaGuajiraMunicipalCoastalFeatures(
                    laGuajiraCoastalFeatures,
                    geometry,
                    normalResult.features || []
                );
                coastalFeatures = municipioCode === URIBIA_MUNICIPALITY_CODE
                    ? keepEasternmostCoastalSegment(laGuajiraCoastalFeatures)
                    : laGuajiraCoastalFeatures;
            }
        } else if (isLaGuajiraMunicipalContext(deptoCode, municipioCode)) {
            coastalFeatures = removeSouthernmostCoastalSegment(coastalFeatures, 4);
        } else if (coastalFeatures.length) {
            var deptNormalResult = await coastLayer.queryFeatures({
                where: baseWhere || "1=0",
                outFields: ["OBJECTID", "LLIdentif"],
                returnGeometry: true
            });
            coastalFeatures = filterDepartmentCoastalChain(coastalFeatures, deptNormalResult.features || []);
        }

        var objectIds = Array.from(new Set((coastalFeatures || [])
            .map(function(feature) { return Number(feature.attributes && feature.attributes.OBJECTID); })
            .filter(function(id) { return Number.isFinite(id); })));

        var objectIdWhere = objectIds.length ? "OBJECTID IN (" + objectIds.join(",") + ")" : "";
        coastalWhereCache[cacheKey] = objectIdWhere;
        return objectIdWhere;
    } catch (error) {
        console.warn("No se pudieron consultar lineas costeras cartograficas:", error);
        coastalWhereCache[cacheKey] = "";
        return "";
    }
}

async function buildEnhancedMunicipalWhere(FeatureLayerCtor, config, baseWhere, deptoCode, municipioCode) {
    var coastalWhere = await buildMunicipalCoastalWhere(FeatureLayerCtor, config, baseWhere, deptoCode, municipioCode);
    return coastalWhere ? "((" + (baseWhere || "1=1") + ") OR (" + coastalWhere + "))" : (baseWhere || "1=1");
}

function clearAuxiliaryTerritoryLayer() {
    if (auxiliaryTerritoryLayer) {
        try {
            if (map) map.remove(auxiliaryTerritoryLayer);
            auxiliaryTerritoryLayer.destroy?.();
        } catch (error) {}
        auxiliaryTerritoryLayer = null;
    }
    window._auxiliaryTerritoryLayerGlobal = null;
    document.documentElement.removeAttribute("data-aux-territory-layer");
    document.documentElement.removeAttribute("data-aux-territory-where");
    document.documentElement.removeAttribute("data-aux-territory-type");
}

function showAuxiliaryTerritoryLayer(FeatureLayerCtor, config, type, code) {
    clearAuxiliaryTerritoryLayer();
    window._auxiliaryTerritoryLayerGlobal = null;
    if (!FeatureLayerCtor || !config || !map || !code || code === "0" || code === "COL") {
        return null;
    }

    var serviceRoot = getLimitesServiceRoot(config.url);
    if (!serviceRoot) {
        return null;
    }

    var isMunicipio = type === "municipio";
    var layerId = isMunicipio ? "1" : "2";
    var field = isMunicipio ? "MpCodigo" : "DeCodigo";
    var definitionExpression = field + " = '" + escapeLimitesSql(code) + "'";
    var fillColor = isMunicipio ? [0, 0, 0, 0] : [76, 0, 115, 0.08];
    var outlineColor = isMunicipio ? [214, 112, 54, 0.75] : [76, 0, 115, 0.65];

    auxiliaryTerritoryLayer = new FeatureLayerCtor({
        url: serviceRoot + "/" + layerId,
        definitionExpression: definitionExpression,
        outFields: [field],
        popupEnabled: false,
        listMode: "hide",
        title: "Apoyo visual territorial",
        renderer: {
            type: "simple",
            symbol: {
                type: "simple-fill",
                color: fillColor,
                outline: {
                    color: outlineColor,
                    width: 1.3
                }
            }
        }
    });

    map.add(auxiliaryTerritoryLayer, 0);
    window._auxiliaryTerritoryLayerGlobal = auxiliaryTerritoryLayer;
    document.documentElement.setAttribute("data-aux-territory-layer", serviceRoot + "/" + layerId);
    document.documentElement.setAttribute("data-aux-territory-where", definitionExpression);
    document.documentElement.setAttribute("data-aux-territory-type", type);
    return auxiliaryTerritoryLayer;
}

function limpiarVistaLimites(options) {
    options = options || {};
    var cycleId = nextRenderCycle();

    hideAllLimitesLayers();
    clearAuxiliaryTerritoryLayer();
    if (window._departamentosLayerGlobal) window._departamentosLayerGlobal.visible = false;
    if (layerGlobal) layerGlobal.visible = false;

    destroyChart();
    destroyStatusDoughnut();
    resetChartLayout();
    clearMunicipalSync();

    var chartTitle = document.getElementById("chartTitle");
    if (chartTitle && options.chartTitle) chartTitle.textContent = options.chartTitle;

    var lt = document.getElementById("legendTitle");
    var lc = document.getElementById("legendContent");
    if (lt) lt.textContent = "Leyenda";
    if (lc) {
        lc.innerHTML = options.legendMessage || "";
        lc.classList.remove("collapsed");
    }

    window.__lastLegendRenderKey = "";
    window.__legendState = { activeCodes: new Set(), field: null, layer: null, baseWhere: "1=1" };

    municipalActiveCodes = [];
    savedChartLayer = null;
    savedChartConfig = null;
    savedChartWhere = null;
    savedChartFeatures = [];
    selectedStatusLabel = "";

    var td = document.getElementById("timelineDiv");
    if (td) { td.style.display = "none"; td.innerHTML = ""; }
    var ld = document.getElementById("lineDescriptionsDiv");
    if (ld) { ld.style.display = "none"; ld.innerHTML = ""; }

    if (highlightHandle) {
        try { highlightHandle.remove(); } catch (e) {}
        highlightHandle = null;
    }

    if (view && view.popup) view.popup.close();

    if (options.clearLayerRef !== false) {
        setLayerGlobal(null);
        setWhereBase("");
    }

    return cycleId;
}

function setLayerGlobal(layer) { layerGlobal = layer; }
function setWhereBase(value) { whereBase = value; }

function getLimitesTerritoryContext() {
    if (municipioActual) {
        var municipio = todosMunicipios.find(function(m) { return String(m.codigo) === String(municipioActual); });
        var municipioNombre = getMunicipioDisplayName(municipio || municipioActual, diccionarioMunicipios);
        var deptoCodigo = (municipio && municipio.depto) || String(municipioActual).substring(0, 2);
        var deptoNombre = getDepartamentoDisplayName(deptoCodigo, diccionarioDepartamentos);
        return municipioNombre + ", " + deptoNombre;
    }
    if (deptoActual && deptoActual !== "0" && deptoActual !== "COL") {
        return diccionarioDepartamentos[deptoActual] || deptoActual;
    }
    return "Colombia";
}

function buildLimitesChartTitle(baseTitle) {
    var cleanBase = String(baseTitle || "Distribuci\u00f3n")
        .replace(/\s+en\s+.+,\s*.+$/i, "")
        .replace(/\s+en\s+Colombia$/i, "")
        .trim();
    return cleanBase + " en " + getLimitesTerritoryContext();
}

function buildStatusChartTitle() {
    var baseTitle = "Estado de las líneas limítrofes";
    if (municipioActual) {
        return baseTitle + " en " + getLimitesTerritoryContext();
    }
    if (deptoActual && deptoActual !== "0" && deptoActual !== "COL") {
        return baseTitle + " en " + (diccionarioDepartamentos[deptoActual] || deptoActual);
    }
    return baseTitle;
}

function setMunicipalServiceMessage(visible, error) {
    var message = document.getElementById("municipalServiceMessage");
    var canvas = document.getElementById("chart");
    var statusSection = document.getElementById("municipalStatusChartSection");

    if (message) message.hidden = !visible;
    if (canvas) canvas.style.display = visible ? "none" : "block";

    if (visible) {
        destroyChart();
        destroyStatusDoughnut();
        if (statusSection) statusSection.style.display = "none";

        var chartTitle = document.getElementById("chartTitle");
        if (chartTitle) {
            chartTitle.textContent = buildLimitesChartTitle("L\u00edneas lim\u00edtrofes");
        }

        var timeline = document.getElementById("timelineDiv");
        if (timeline) {
            timeline.style.display = "none";
            timeline.innerHTML = "";
        }

        console.warn("Servicio municipal de lineas limitrofes no disponible:", error);
    }
}

function buildLineNameLookup(features) {
    var names = {};
    (features || []).forEach(function(feature) {
        var attributes = feature.attributes || {};
        var id = String(attributes.LLIdentif || "");
        if (!id || names[id]) return;
        names[id] = String(attributes.LLNombre || id);
    });
    return names;
}

function shouldZoom(newExtent) {
    if (!newExtent || !(view && view.extent)) return true;
    var cur = view.extent;
    var dx = Math.abs(newExtent.xmax - newExtent.xmin);
    var dy = Math.abs(newExtent.ymax - newExtent.ymin);
    var cx = Math.abs(cur.xmax - cur.xmin);
    var cy = Math.abs(cur.ymax - cur.ymin);
    var ratioW = cx > 0 ? Math.abs(dx - cx) / cx : 1;
    var ratioH = cy > 0 ? Math.abs(dy - cy) / cy : 1;
    return ratioW > 0.25 || ratioH > 0.25;
}

async function zoomToExtent(extent, duration) {
    if (!extent || !view) return;
    var expanded = extent.expand(1.2);
    await view.goTo(expanded, { duration: duration || 400, easing: "ease-in-out" });
}

// ── Leyenda municipal: toggle real de capa ──
var municipalActiveCodes = [];
var savedChartLayer = null;
var savedChartConfig = null;
var savedChartWhere = null;
var savedChartFeatures = [];
var selectedStatusLabel = "";
var selectedStatusCode = "";

function getBaseMunicipalWhere() {
    var baseWhere = whereBase || String(layerGlobal?.definitionExpression || "1=1");
    baseWhere = baseWhere.replace(/\s*AND\s+LLIdentif\s+IN\s*\([^)]*\)/gi, "");
    baseWhere = baseWhere.replace(/\s*AND\s+LLIdentif\s*=\s*'[^']*'/gi, "");
    baseWhere = baseWhere.replace(/\s*AND\s+LLEstado\s*=\s*'[^']*'/gi, "");
    baseWhere = baseWhere.replace(/\s*AND\s+LLEstado\s*=\s*\d+/gi, "");
    return baseWhere || "1=1";
}

function setLegendActiveCodes(codes) {
    var activeSet = {};
    (codes || []).forEach(function(code) { activeSet[String(code)] = true; });
    var items = document.querySelectorAll("#legendContent .limites-legend-item");
    items.forEach(function(item) {
        var code = item.getAttribute("data-llid");
        var active = !!activeSet[String(code || "")];
        item.classList.toggle("inactive", !active);
        item.setAttribute("aria-pressed", active ? "true" : "false");
    });
}

function restoreMunicipalStatusFilter() {
    selectedStatusLabel = "";
    selectedStatusCode = "";
    if (!layerGlobal || !savedChartLayer || !savedChartConfig || !savedChartWhere) return;

    var baseWhere = getBaseMunicipalWhere();
    layerGlobal.definitionExpression = baseWhere;

    municipalActiveCodes = [];
    var seen = {};
    (savedChartFeatures || []).forEach(function(f) {
        var code = String(f.attributes["LLIdentif"] || "");
        if (code && !seen[code]) { seen[code] = true; municipalActiveCodes.push(code); }
    });
    setLegendActiveCodes(municipalActiveCodes);

    renderChartMunicipios(savedChartLayer, savedChartConfig, savedChartWhere, {
        title: buildLimitesChartTitle(savedChartConfig.title || "L\u00edmites municipales"),
        prefilteredFeatures: savedChartFeatures
    });
    renderStatusDoughnut(savedChartFeatures, { title: buildStatusChartTitle() });

    layerGlobal.queryExtent({ where: baseWhere }).then(function(res) {
        if (res && res.extent && view) view.goTo(res.extent.expand(1.2), { duration: 400, easing: "ease-in-out" });
    }).catch(function() {});
}

function buildMunicipalStatusWhere(baseWhere, statusCode, llids) {
    var ids = Array.from(new Set((llids || []).map(function(id) { return String(id || ""); }).filter(Boolean)));
    if (ids.length) {
        var codesStr = ids.map(function(c) { return "'" + String(c).replace(/'/g, "''") + "'"; }).join(",");
        return {
            where: baseWhere + " AND LLIdentif IN (" + codesStr + ")",
            ids: ids
        };
    }

    var numericCode = parseInt(String(statusCode || ""), 10);
    if (!isNaN(numericCode)) {
        return {
            where: baseWhere + " AND LLEstado = " + numericCode,
            ids: []
        };
    }

    var safeLabel = String(resolveStatusLabel(statusCode) || statusCode || "").replace(/'/g, "''");
    return {
        where: baseWhere + " AND LLEstado = '" + safeLabel + "'",
        ids: []
    };
}

function applyMunicipalStatusFilter(statusLabel, llids, statusCode) {
    if (!layerGlobal || !savedChartLayer || !savedChartConfig || !savedChartWhere) return;

    var resolvedCode = String(statusCode || resolveStatusCode(statusLabel) || getStatusCodeForLabel(statusLabel) || "").trim();
    var resolvedLabel = resolvedCode ? resolveStatusLabel(resolvedCode) : resolveStatusLabel(statusLabel);
    var ids = Array.from(new Set((llids || []).map(function(id) { return String(id || ""); }).filter(Boolean)));
    if (!ids.length && resolvedCode) ids = getLlidsForStatusCode(resolvedCode);
    if (!ids.length) ids = getLlidsForStatusLabel(resolvedLabel);

    var filteredFeatures = resolvedCode
        ? filterFeaturesByStatusCode(savedChartFeatures, resolvedCode)
        : filterFeaturesByStatusLabel(savedChartFeatures, resolvedLabel);
    if (!ids.length) {
        ids = Array.from(new Set(filteredFeatures.map(function(f) {
            return String(f.attributes?.LLIdentif || "").trim();
        }).filter(Boolean)));
    }

    if ((!resolvedCode && !resolvedLabel) || (!ids.length && !filteredFeatures.length)) {
        restoreMunicipalStatusFilter();
        return;
    }

    selectedStatusCode = resolvedCode;
    selectedStatusLabel = resolvedLabel;
    var baseWhere = getBaseMunicipalWhere();
    var statusFilter = buildMunicipalStatusWhere(baseWhere, resolvedCode, ids);
    layerGlobal.definitionExpression = statusFilter.where;

    if (statusFilter.ids.length) {
        municipalActiveCodes = statusFilter.ids;
    } else {
        municipalActiveCodes = ids.slice();
    }
    if (!municipalActiveCodes.length && filteredFeatures.length) {
        municipalActiveCodes = Array.from(new Set(filteredFeatures.map(function(f) {
            return String(f.attributes?.LLIdentif || "").trim();
        }).filter(Boolean)));
    }
    setLegendActiveCodes(municipalActiveCodes);

    if (!filteredFeatures.length && ids.length) {
        var activeSet = {};
        ids.forEach(function(id) { activeSet[id] = true; });
        filteredFeatures = (savedChartFeatures || []).filter(function(f) {
            return activeSet[String(f.attributes["LLIdentif"] || "")];
        });
    }

    renderChartMunicipios(savedChartLayer, savedChartConfig, savedChartWhere, {
        title: buildLimitesChartTitle(savedChartConfig.title || "L\u00edmites municipales"),
        prefilteredFeatures: filteredFeatures
    });
    renderStatusDoughnut(savedChartFeatures, {
        title: buildStatusChartTitle(),
        selectedStatusCode: selectedStatusCode,
        selectedStatusLabel: selectedStatusLabel
    });

    layerGlobal.queryExtent({ where: statusFilter.where }).then(function(res) {
        if (res && res.extent && view) view.goTo(res.extent.expand(1.35), { duration: 400, easing: "ease-in-out" });
    }).catch(function() {});
}

function handleLegendClick(e) {
    var btn = e.target.closest(".limites-legend-item");
    if (!btn) return;
    var layer = layerGlobal;
    if (!layer) return;
    selectedStatusLabel = "";
    selectedStatusCode = "";
    var code = btn.getAttribute("data-llid");
    if (!code) return;

    var isInactive = btn.classList.contains("inactive");
    if (isInactive) {
        btn.classList.remove("inactive");
        btn.setAttribute("aria-pressed", "true");
        if (municipalActiveCodes.indexOf(code) === -1) municipalActiveCodes.push(code);
    } else {
        btn.classList.add("inactive");
        btn.setAttribute("aria-pressed", "false");
        var idx = municipalActiveCodes.indexOf(code);
        if (idx !== -1) municipalActiveCodes.splice(idx, 1);
    }

    var baseWhere = whereBase || String(layer.definitionExpression || "1=1");
    baseWhere = baseWhere.replace(/\s*AND\s+LLIdentif\s+IN\s*\([^)]*\)/gi, "");
    baseWhere = baseWhere.replace(/\s*AND\s+LLIdentif\s+NOT\s+IN\s*\([^)]*\)/gi, "");

    if (municipalActiveCodes.length === 0) {
        layer.definitionExpression = "1=0";
    } else {
        var codesStr = municipalActiveCodes.map(function(c) { return "'" + String(c).replace(/'/g, "''") + "'"; }).join(",");
        layer.definitionExpression = baseWhere + " AND LLIdentif IN (" + codesStr + ")";
    }

    // Sincronizar grafico
    if (savedChartLayer && savedChartConfig && savedChartWhere && savedChartFeatures.length > 0) {
        var activeSet = {};
        municipalActiveCodes.forEach(function(c) { activeSet[c] = true; });
        var filteredFeatures = savedChartFeatures.filter(function(f) {
            return activeSet[String(f.attributes["LLIdentif"] || "")];
        });
        if (filteredFeatures.length === 0) {
            destroyChart();
            destroyStatusDoughnut();
            var cv = document.getElementById("chart");
            if (cv) { cv.style.height = "60px"; cv.style.maxHeight = "60px"; cv.style.minHeight = "60px"; }
        } else {
            renderChartMunicipios(savedChartLayer, savedChartConfig, savedChartWhere, {
                title: buildLimitesChartTitle(savedChartConfig.title || "L\u00edmites municipales"),
                prefilteredFeatures: filteredFeatures
            });
            renderStatusDoughnut(filteredFeatures, { title: buildStatusChartTitle() });
        }
    }
}

var legendHandlerAttached = false;
function bindLegendToggle(layer, features) {
    var legendContent = document.getElementById("legendContent");
    if (!legendContent || !layer) return;
    municipalActiveCodes = [];
    var seen = {};
    (features || []).forEach(function(f) {
        var code = String(f.attributes["LLIdentif"] || "");
        if (code && !seen[code]) { seen[code] = true; municipalActiveCodes.push(code); }
    });
    if (!legendHandlerAttached) {
        legendContent.addEventListener("click", handleLegendClick);
        legendHandlerAttached = true;
    }
}

// ── Sincronizacion grafico → mapa + leyenda ──
var chartSyncAttached = false;
function setupChartSync() {
    if (chartSyncAttached) return;
    chartSyncAttached = true;

    document.addEventListener("limites:status-select", function(e) {
        if (currentLimitesTab !== "MUNICIPIOS") return;
        var detail = e.detail || {};
        var statusCode = detail.selectedStatusCode || detail.statusCode || "";
        var statusLabel = detail.selectedStatusLabel || detail.statusLabel || "";
        applyMunicipalStatusFilter(
            statusLabel,
            detail.llids || getLlidsForStatusCode(statusCode) || getLlidsForStatusLabel(statusLabel),
            statusCode
        );
    });

    document.addEventListener("limites:status-restore", function() {
        if (currentLimitesTab !== "MUNICIPIOS") return;
        restoreMunicipalStatusFilter();
    });
}

// ── Sincronizacion grafico departamental → mapa (solo mapa, grafico nacional intacto) ──
var deptoChartSyncAttached = false;
function buildDeptoSelectionWhere(deCodigo) {
    var config = LIMITES_CONFIG.DEPARTAMENTOS;
    var filterField = config.filterField || "dpcodigo";
    var codeWhere = filterField + " = '" + String(deCodigo).replace(/'/g, "''") + "'";
    var fixedWhere = config.fixedWhere || "1=1";
    return fixedWhere && fixedWhere !== "1=1"
        ? "(" + fixedWhere + ") AND (" + codeWhere + ")"
        : codeWhere;
}

function refreshMunicipioSelectForDepto(deCodigo) {
    var municipioSelect = document.getElementById("municipios");
    if (!municipioSelect) return;

    municipioSelect.innerHTML = '<option value="">Seleccione un municipio</option>';
    var filtrados = todosMunicipios || [];
    if (deCodigo && deCodigo !== "0" && deCodigo !== "COL") {
        filtrados = filtrados.filter(function(municipio) {
            return String(municipio && municipio.depto) === String(deCodigo);
        });
    }

    filtrados.forEach(function(municipio) {
        var option = document.createElement("option");
        option.value = municipio.codigo;
        option.textContent = getMunicipioDisplayName(municipio, diccionarioMunicipios);
        municipioSelect.appendChild(option);
    });
    municipioSelect.value = "";
}

function applyDeptoSelection(deCodigo, options) {
    options = options || {};
    var layer = deptoLayerRef || layerGlobal || window._departamentosLayerGlobal;
    if (!layer || !deCodigo) return;

    var mapFilter = buildDeptoSelectionWhere(deCodigo);
    layer.visible = true;
    layer.definitionExpression = mapFilter;
    setWhereBase(mapFilter);

    deptoActual = String(deCodigo);
    filtroNivel = "DEPTO";
    municipioActual = "";

    if (options.updateSelect !== false) {
        var deptoSelect = document.getElementById("departamentos");
        if (deptoSelect && deptoSelect.value !== String(deCodigo)) {
            deptoSelect.value = String(deCodigo);
        }
        refreshMunicipioSelectForDepto(String(deCodigo));
        actualizarResumen({
            municipioActual: municipioActual,
            deptoActual: deptoActual,
            filtroNivel: filtroNivel,
            diccionarioMunicipios: diccionarioMunicipios,
            diccionarioDepartamentos: diccionarioDepartamentos
        });
    }

    if (view && view.popup) view.popup.close();

    if (typeof options.index === "number") {
        highlightDeptoChartBar(options.index);
    } else {
        highlightDeptoChartByCode(deCodigo);
    }

    if (options.zoom !== false) {
        layer.queryExtent({ where: mapFilter }).then(function(res) {
            if (res && res.extent && view) {
                view.goTo(res.extent.expand(1.2), { duration: 400, easing: "ease-in-out" });
            }
        }).catch(function() {});
    }
}

function setupDeptoChartSync() {
    if (deptoChartSyncAttached) return;
    deptoChartSyncAttached = true;

    document.addEventListener("limites:depto-chart-select", function(e) {
        if (currentLimitesTab !== "DEPARTAMENTOS") return;

        var layer = deptoLayerRef || layerGlobal || window._departamentosLayerGlobal;
        if (!layer) return;

        var deCodigo = e.detail && e.detail.deCodigo;
        var index = e.detail && e.detail.index;
        if (!deCodigo) return;

        applyDeptoSelection(deCodigo, { index: index, updateSelect: true, zoom: true });
    });

    document.addEventListener("limites:depto-chart-restore", function() {
        if (currentLimitesTab !== "DEPARTAMENTOS") return;

        var layer = deptoLayerRef || layerGlobal || window._departamentosLayerGlobal;
        if (!layer) return;

        var restoreWhere = LIMITES_CONFIG.DEPARTAMENTOS.fixedWhere || "1=1";
        deptoActual = "";
        filtroNivel = "";
        whereBase = restoreWhere;
        var deptoSelect = document.getElementById("departamentos");
        if (deptoSelect) deptoSelect.value = "COL";

        layer.definitionExpression = restoreWhere;
        layer.visible = true;

        if (view && view.popup) view.popup.close();

        layer.queryExtent({ where: restoreWhere }).then(function(res) {
            if (res && res.extent && view) {
                view.goTo(res.extent.expand(1.15), { duration: 400, easing: "ease-in-out" });
            }
        }).catch(function() {});

        clearDeptoChartHighlight();
        cargarLimitesDepartamentos();
    });
}

// ── initDropdowns ──
function initAllDropdowns(onLimitesTabChange) {
    document.addEventListener("click", function(e) {
        document.querySelectorAll(".modulo-dropdown.open").forEach(function(d) {
            if (!d.contains(e.target)) d.classList.remove("open");
        });
    });

    initModuleDropdown("limitesDropdown", "limitesTrigger", ".dropdown-menu-custom", function(target) {
        if (typeof onLimitesTabChange === "function") onLimitesTabChange(target);
    });

    initModuleDropdown("ordenamientoDropdown", "ordenamientoTrigger", ".dropdown-menu-custom", function(target) {
        globalThis.ModuleNavigation?.navigateToComponent("ordenamiento.html", target);
    });
    initModuleDropdown("legalDropdown", "legalTrigger", ".dropdown-menu-custom", function(target) {
        globalThis.ModuleNavigation?.navigateToComponent("contexto.html", target);
    });
    initModuleDropdown("biofisicoDropdown", "biofisicoTrigger", ".dropdown-menu-custom", function(target) {
        globalThis.ModuleNavigation?.navigateToComponent("biofisico.html", target);
    });
    initModuleDropdown("ocupacionDropdown", "ocupacionTrigger", ".dropdown-menu-custom", function(target) {
        globalThis.ModuleNavigation?.navigateToComponent("ocupacion.html", target);
    });
    initModuleDropdown("socioeconomicoDropdown", "socioeconomicoTrigger", ".dropdown-menu-custom", function(target) {
        globalThis.ModuleNavigation?.navigateToComponent("socioeconomico.html", target);
    });
}

// ── Punto de entrada ArcGIS ──
window.require([
    "esri/Map", "esri/views/MapView", "esri/layers/FeatureLayer", "esri/Basemap",
    "esri/layers/TileLayer", "esri/layers/VectorTileLayer", "esri/widgets/Legend",
    "esri/layers/GraphicsLayer", "esri/Graphic", "esri/geometry/Extent",
    "esri/widgets/Home", "esri/widgets/Locate", "esri/widgets/BasemapGallery",
    "esri/widgets/Expand", "esri/widgets/ScaleBar", "esri/renderers/UniqueValueRenderer", "esri/request"
], function(EsriMap, MapView, FeatureLayer, Basemap, TileLayer, VectorTileLayer, Legend,
    GraphicsLayer, Graphic, Extent, Home, Locate, BasemapGallery, Expand, ScaleBar, UniqueValueRenderer, esriRequest) {

    var mainMap = createMainMap({ EsriMap: EsriMap, MapView: MapView, Basemap: Basemap, TileLayer: TileLayer, VectorTileLayer: VectorTileLayer });
    map = mainMap.map;
    view = mainMap.view;

    function handleLimitesTabChange(target) {
        var ds = document.getElementById("departamentos");
        var ms = document.getElementById("municipios");

        if (target === "Municipios") {
            currentLimitesTab = "MUNICIPIOS";
            syncDeptoFromSelect();
            municipioActual = "";
            filtroNivel = deptoActual ? "DEPTO" : "";
            whereBase = "";

            if (deptoActual && deptoActual !== "0" && deptoActual !== "COL") {
                if (ds) ds.value = deptoActual;
                if (ms) {
                    ms.innerHTML = '<option value="">Seleccione un municipio</option>';
                    renderizarMunicipios(deptoActual);
                    ms.value = "";
                }
            } else {
                deptoActual = "";
                if (ds) ds.value = "0";
                if (ms) {
                    ms.innerHTML = '<option value="">Seleccione un municipio</option>';
                    renderizarMunicipios();
                    ms.value = "";
                }
            }

            limpiarVistaLimites({
                chartTitle: "L\u00edmites Municipales",
                legendMessage: deptoActual
                    ? '<p class="oot-js-limites-main-1">Cargando l\u00edmites municipales\u2026</p>'
                    : '<p class="oot-js-limites-main-1">Seleccione un departamento o municipio para visualizar los l\u00edmites municipales</p>'
            });

            actualizarResumen({
                municipioActual: municipioActual,
                deptoActual: deptoActual,
                filtroNivel: filtroNivel,
                diccionarioMunicipios: diccionarioMunicipios,
                diccionarioDepartamentos: diccionarioDepartamentos
            });
            updateMapViewBadge("L\u00edmites Municipales");
            cargarLimitesMunicipales();
            return;
        }

        if (target === "Departamentos") {
            currentLimitesTab = "DEPARTAMENTOS";
            municipioActual = "";
            filtroNivel = deptoActual ? "DEPTO" : "";

            limpiarVistaLimites({
                chartTitle: "L\u00edmites Departamentales",
                legendMessage: '<p class="oot-js-limites-main-1">Cargando l\u00edmites departamentales\u2026</p>'
            });

            var sdDepto = document.getElementById("summaryDiv");
            if (sdDepto) sdDepto.textContent = "Cargando informaci\u00f3n\u2026";
            updateMapViewBadge("L\u00edmites Departamentales");
            cargarLimitesDepartamentos();
        }
    }

    initAllDropdowns(handleLimitesTabChange);
    initDropdownDescargables();
    initMapControls({ view: view, Home: Home, Locate: Locate, BasemapGallery: BasemapGallery });
    initScaleBar({ view: view, ScaleBar: ScaleBar });

    view.when(function() {
        extentInicial = (view.map.initialViewProperties && view.map.initialViewProperties.extent)
            ? view.map.initialViewProperties.extent.clone() : view.extent.clone();
    });

    var zs = document.getElementById("zoomSlider");
    var zsc = document.getElementById("zoomSliderContainer");
    if (zsc) zsc.style.display = "none";
    if (zs) { zs.value = view.zoom; zs.addEventListener("input", function() { view.zoom = Number(this.value); }); view.watch("zoom", function(z) { zs.value = z; }); }

    initOverview({ EsriMap: EsriMap, MapView: MapView, GraphicsLayer: GraphicsLayer, Graphic: Graphic, Extent: Extent, basemap: mainMap.basemap });

    function reiniciarConsultaActual() {
        var hasSelectedTerritory = Boolean(
            municipioActual || (filtroNivel === "DEPTO" && deptoActual && deptoActual !== "0" && deptoActual !== "COL")
        );

        if (currentLimitesTab === "MUNICIPIOS" && !hasSelectedTerritory) return;

        if (highlightHandle) {
            try { highlightHandle.remove(); } catch (e) {}
            highlightHandle = null;
        }
        if (view && view.popup) view.popup.close();

        clearDeptoChartHighlight();

        if (currentLimitesTab === "DEPARTAMENTOS") {
            limpiarVistaLimites({
                chartTitle: "L\u00edmites Departamentales",
                legendMessage: '<p class="oot-js-limites-main-1">Cargando l\u00edmites departamentales\u2026</p>'
            });

            var sdDepto = document.getElementById("summaryDiv");
            if (sdDepto) sdDepto.textContent = "Cargando informaci\u00f3n\u2026";
            updateMapViewBadge("L\u00edmites Departamentales");
            cargarLimitesDepartamentos();
            return;
        }

        syncDeptoFromSelect();
        municipioActual = municipioActual || "";
        filtroNivel = municipioActual ? "MUNI" : (deptoActual ? "DEPTO" : filtroNivel);

        limpiarVistaLimites({
            chartTitle: "L\u00edmites Municipales",
            legendMessage: deptoActual
                ? '<p class="oot-js-limites-main-1">Cargando l\u00edmites municipales\u2026</p>'
                : '<p class="oot-js-limites-main-1">Seleccione un departamento o municipio para visualizar los l\u00edmites municipales</p>'
        });

        actualizarResumen({
            municipioActual: municipioActual,
            deptoActual: deptoActual,
            filtroNivel: filtroNivel,
            diccionarioMunicipios: diccionarioMunicipios,
            diccionarioDepartamentos: diccionarioDepartamentos
        });
        updateMapViewBadge("L\u00edmites Municipales");
        cargarLimitesMunicipales();
    }

    init();

    function init() {
        var btnRefreshBusqueda = document.getElementById("btnRefreshBusqueda");
        if (btnRefreshBusqueda) btnRefreshBusqueda.onclick = limpiarBusqueda;

        var btnReiniciarConsulta = document.getElementById("btnReiniciarConsulta");
        if (btnReiniciarConsulta) {
            btnReiniciarConsulta.onclick = function() {
                reiniciarConsultaActual();
            };
        }

        document.getElementById("legendToggle").onclick = toggleLegend;
        setupChartSync();
        setupDeptoChartSync();
        cargarMunicipios();
        cargarLimitesActivos();
    }

    function limpiarBusqueda() {
        var sd = document.getElementById("departamentos");
        var sm = document.getElementById("municipios");
        if (sd) sd.value = "0";
        if (sm) { sm.innerHTML = '<option value="">Seleccione un municipio</option>'; renderizarMunicipios(); sm.value = ""; }
        municipioActual = ""; deptoActual = ""; filtroNivel = ""; whereBase = "";
        selectedStatusLabel = "";
        if (highlightHandle) { try { highlightHandle.remove(); } catch(e) {} highlightHandle = null; }
        destroyChart();
        destroyStatusDoughnut();
        resetChartLayout();
        clearAuxiliaryTerritoryLayer();
        var td = document.getElementById("timelineDiv");
        if (td) { td.style.display = "none"; td.innerHTML = ""; }
        var lt = document.getElementById("legendTitle");
        var lc = document.getElementById("legendContent");
        if (lt) lt.textContent = "Leyenda";
        if (lc) { lc.innerHTML = '<p class="oot-js-limites-main-1">Seleccione un departamento o municipio</p>'; lc.classList.remove("collapsed"); }
        window.__legendState = { allCodes: [], activeCodes: new Set(), field: null, layer: null };
        actualizarResumen({ municipioActual: "", deptoActual: "", filtroNivel: "", diccionarioMunicipios: diccionarioMunicipios, diccionarioDepartamentos: diccionarioDepartamentos });
        if (view && view.popup) view.popup.close();
        if (extentInicial) view.goTo(extentInicial, { duration: 400, easing: "ease-in-out" });
        else view.goTo({ center: [-74.3, 4.6], zoom: 6 }, { duration: 400, easing: "ease-in-out" });
        setTimeout(function() { cargarLimitesActivos(); }, 350);
    }

    // ── cargarMunicipios ──
    function cargarMunicipios() {
        var ds = document.getElementById("departamentos");
        if (!ds) return;
        ds.innerHTML = '<option value="">Cargando...</option>';
        cargarDiccionarioDesdeApi().then(function(data) {
            if (!data || !Array.isArray(data.todosMunicipios) || data.todosMunicipios.length === 0) {
                ds.innerHTML = '<option value="">Error al cargar</option>';
                var selectMuniError = document.getElementById("municipios");
                if (selectMuniError) {
                    selectMuniError.innerHTML = '<option value="">Error al cargar</option>';
                }
                return;
            }
            diccionarioMunicipios = data.diccionarioMunicipios;
            diccionarioDepartamentos = data.diccionarioDepartamentos;
            todosMunicipios = data.todosMunicipios;
            poblarSelectDepartamentos(ds);
            renderizarMunicipios();
        }).catch(function() { ds.innerHTML = '<option value="">Error al cargar</option>'; });

        ds.onchange = function() {
            var cod = this.value;
            if (cod === "0") return;
            if (cod === "COL") {
                deptoActual = ""; filtroNivel = ""; municipioActual = ""; whereBase = "";
                selectedStatusLabel = "";
                destroyChart();
                destroyStatusDoughnut();
                resetChartLayout();
                clearAuxiliaryTerritoryLayer();
                var td2 = document.getElementById("timelineDiv"); if (td2) { td2.style.display = "none"; td2.innerHTML = ""; }
                var ld2 = document.getElementById("lineDescriptionsDiv"); if (ld2) { ld2.style.display = "none"; ld2.innerHTML = ""; }
                var ms2 = document.getElementById("municipios"); if (ms2) { ms2.innerHTML = '<option value="">Seleccione un municipio</option>'; renderizarMunicipios(); ms2.value = ""; }
                var lt2 = document.getElementById("legendTitle"); var lc2 = document.getElementById("legendContent");
                if (lt2) lt2.textContent = "Leyenda"; if (lc2) { lc2.innerHTML = '<p class="oot-js-limites-main-1">Seleccione un departamento o municipio</p>'; lc2.classList.remove("collapsed"); }
                window.__legendState = { allCodes: [], activeCodes: new Set(), field: null, layer: null };
                actualizarResumen({ municipioActual: "", deptoActual: "", filtroNivel: "", diccionarioMunicipios: diccionarioMunicipios, diccionarioDepartamentos: diccionarioDepartamentos });
                if (view && view.popup) view.popup.close();
                if (extentInicial) view.goTo(extentInicial, { duration: 400, easing: "ease-in-out" });
                else view.goTo({ center: [-74.3, 4.6], zoom: 6 }, { duration: 400, easing: "ease-in-out" });
                setTimeout(function() { ds.value = "0"; }, 300);
                setTimeout(function() { cargarLimitesActivos(); }, 350);
                return;
            }
            deptoActual = cod; filtroNivel = "DEPTO"; municipioActual = "";
            document.getElementById("municipios").innerHTML = '<option value="">Seleccione un municipio</option>';
            renderizarMunicipios(cod);
            actualizarResumen({ municipioActual: municipioActual, deptoActual: deptoActual, filtroNivel: filtroNivel, diccionarioMunicipios: diccionarioMunicipios, diccionarioDepartamentos: diccionarioDepartamentos });
            cargarLimitesActivos();
        };

        var ms = document.getElementById("municipios");
        if (ms) {
            ms.onchange = function() {
                var cod = this.value;
                municipioActual = cod || ""; filtroNivel = municipioActual ? "MUNI" : (deptoActual ? "DEPTO" : "");
                if (!municipioActual) { limpiarBusqueda(); return; }
                whereBase = sqlContains("mpcodigo", cod);
                actualizarResumen({ municipioActual: municipioActual, deptoActual: deptoActual, filtroNivel: filtroNivel, diccionarioMunicipios: diccionarioMunicipios, diccionarioDepartamentos: diccionarioDepartamentos });
                cargarLimitesActivos();
            };
        }
    }

    function obtenerCodigosDepartamentoDisponibles() {
        var codigos = Array.from(new Set(
            (todosMunicipios || [])
                .map(function(municipio) { return String(municipio && municipio.depto || "").trim(); })
                .filter(function(codigo) { return /^\d{2}$/.test(codigo); })
        ));

        return codigos.sort(function(a, b) {
            var nombreA = getDepartamentoDisplayName(a, diccionarioDepartamentos);
            var nombreB = getDepartamentoDisplayName(b, diccionarioDepartamentos);
            return String(nombreA).localeCompare(String(nombreB), "es", { sensitivity: "base" })
                || String(a).localeCompare(String(b), "es", { sensitivity: "base" });
        });
    }

    function poblarSelectDepartamentos(select) {
        if (!select) return;

        select.innerHTML = '<option value="0">Seleccione un departamento</option>';
        var optionColombia = document.createElement("option");
        optionColombia.value = "COL";
        optionColombia.textContent = "Colombia";
        select.appendChild(optionColombia);

        obtenerCodigosDepartamentoDisponibles().forEach(function(cod) {
            var option = document.createElement("option");
            option.value = cod;
            option.textContent = getDepartamentoDisplayName(cod, diccionarioDepartamentos);
            select.appendChild(option);
        });
    }

    function renderizarMunicipios(deptoFiltro) {
        var select = document.getElementById("municipios"); if (!select) return;
        select.innerHTML = '<option value="">Seleccione un municipio</option>';
        var filtrados = todosMunicipios;
        if (deptoFiltro && deptoFiltro !== "0" && deptoFiltro !== "COL") filtrados = todosMunicipios.filter(function(m) { return m.depto === deptoFiltro; });
        filtrados.forEach(function(m) { var o = document.createElement("option"); o.value = m.codigo; o.textContent = getMunicipioDisplayName(m, diccionarioMunicipios); select.appendChild(o); });
    }

    function cargarLimitesActivos() {
        if (currentLimitesTab === "DEPARTAMENTOS") return cargarLimitesDepartamentos();
        return cargarLimitesMunicipales();
    }

    async function cargarLimitesMunicipales() {
        var cycleId = renderCycleId;

        hideAllLimitesLayers();
        clearAuxiliaryTerritoryLayer();
        if (window._departamentosLayerGlobal) window._departamentosLayerGlobal.visible = false;
        if (layerGlobal) layerGlobal.visible = false;
        setMunicipalServiceMessage(false);

        if (!deptoActual && !municipioActual) {
            if (!isRenderCycleCurrent(cycleId)) return;
            selectedStatusLabel = "";
            destroyChart();
            destroyStatusDoughnut();
            resetChartLayout();
            clearAuxiliaryTerritoryLayer();
            var chartTitleEmpty = document.getElementById("chartTitle");
            if (chartTitleEmpty) chartTitleEmpty.textContent = "L\u00edmites Municipales";
            var lt0 = document.getElementById("legendTitle");
            var lc0 = document.getElementById("legendContent");
            if (lt0) lt0.textContent = "Leyenda";
            if (lc0) {
                lc0.innerHTML = '<p class="oot-js-limites-main-1">Seleccione un departamento o municipio para visualizar los l\u00edmites municipales</p>';
                lc0.classList.remove("collapsed");
            }
            var sd0 = document.getElementById("summaryDiv");
            if (sd0) sd0.textContent = "Seleccione un departamento o municipio para ver el resumen.";
            var ld0 = document.getElementById("lineDescriptionsDiv");
            if (ld0) { ld0.style.display = "none"; ld0.innerHTML = ""; }
            updateMapViewBadge("L\u00edmites Municipales");
            return;
        }

        createMunicipiosLayer({
            FeatureLayer: FeatureLayer, map: map, LIMITES_CONFIG: LIMITES_CONFIG, deptoActual: deptoActual, municipioActual: municipioActual,
            onReady: async function(args) {
                if (!isRenderCycleCurrent(cycleId)) return;

                var layer = args.layer, config = args.config, whereClause = args.whereClause, reused = args.reused;
                var enhancedWhereClause = await buildEnhancedMunicipalWhere(FeatureLayer, config, whereClause, deptoActual, municipioActual);
                if (!isRenderCycleCurrent(cycleId)) return;

                hideAllLimitesLayers();
                showAuxiliaryTerritoryLayer(
                    FeatureLayer,
                    config,
                    municipioActual ? "municipio" : "departamento",
                    municipioActual || deptoActual
                );
                layer.definitionExpression = enhancedWhereClause;
                setLayerGlobal(layer);
                setWhereBase(enhancedWhereClause);
                setLegendLayerTitle(config.title);
                updateMapViewBadge("L\u00edmites municipales");

                var results = await Promise.all([
                    layer.queryExtent({ where: enhancedWhereClause }).catch(function() { return null; }),
                    layer.queryFeatures({ where: enhancedWhereClause, outFields: ["OBJECTID","LLIdentif","LLNombre","LLJerarqui","LLNorma","Fecha","LLEscala","LLEstado","SHAPE_Length"], returnGeometry: false, orderByFields: ["LLNombre"] })
                        .then(function(result) { return { ok: true, result: result }; })
                        .catch(function(error) { return { ok: false, error: error }; })
                ]);
                if (!isRenderCycleCurrent(cycleId)) return;

                var extentResult = results[0];
                var featureQuery = results[1];
                if (!featureQuery || !featureQuery.ok) {
                    layer.visible = false;
                    setMunicipalServiceMessage(true, featureQuery && featureQuery.error);
                    return;
                }

                setMunicipalServiceMessage(false);
                var features = (featureQuery.result && featureQuery.result.features) || [];
                var lineNameLookup = buildLineNameLookup(features);

                var renderer = new UniqueValueRenderer({ field: "LLIdentif", defaultSymbol: { type: "simple-line", color: [180,180,180,255], width: 2.5 } });
                features.forEach(function(f) {
                    var llIdentif = f.attributes["LLIdentif"], llNombre = f.attributes["LLNombre"] || llIdentif || "Sin nombre";
                    var c = getColorForLinea(llIdentif);
                    renderer.addUniqueValueInfo({ value: String(llIdentif || ""), label: String(llNombre), symbol: { type: "simple-line", color: [c[0],c[1],c[2],255], width: 3 } });
                });
                layer.renderer = renderer;

                if (extentResult && extentResult.extent && shouldZoom(extentResult.extent)) {
                    await zoomToExtent(extentResult.extent, reused ? 0 : 400);
                    if (!isRenderCycleCurrent(cycleId)) return;
                }

                layer.visible = true;
                actualizarLeyendaLimitesMunicipales(features);

                savedChartLayer = layer;
                savedChartConfig = config;
                savedChartWhere = enhancedWhereClause;
                savedChartFeatures = features;
                municipalActiveCodes = [];
                var seenMunicipalCodes = {};
                features.forEach(function(f) {
                    var code = String(f.attributes["LLIdentif"] || "");
                    if (code && !seenMunicipalCodes[code]) {
                        seenMunicipalCodes[code] = true;
                        municipalActiveCodes.push(code);
                    }
                });
                selectedStatusLabel = "";

                renderChartMunicipios(layer, config, enhancedWhereClause, {
                    title: buildLimitesChartTitle(config.title || "L\u00edmites municipales"),
                    prefilteredFeatures: features
                });
                setupMunicipalSync({
                    view: view,
                    layer: layer,
                    features: features,
                    baseWhere: enhancedWhereClause
                });
                renderStatusDoughnut(features, { title: buildStatusChartTitle() });
                if (!isRenderCycleCurrent(cycleId)) return;

                if (municipioActual) {
                    var llIdentifs = features.map(function(f) { return f.attributes["LLIdentif"]; }).filter(Boolean);
                    var municipioNombre = getLimitesTerritoryContext();
                    var timelineData = await fetchTimelineData(llIdentifs, { lineNames: lineNameLookup });
                    if (!isRenderCycleCurrent(cycleId)) return;
                    var timelineDiv = document.getElementById("timelineDiv");
                    if (timelineDiv) {
                        renderTimeline(timelineData, municipioNombre, function(evento) {
                            var llidWhere = "LLIdentif = '" + String(evento.llid).replace(/'/g, "''") + "'";
                            layer.queryExtent({ where: llidWhere }).then(function(res) {
                                if (res && res.extent && view) view.goTo(res.extent.expand(1.5), { duration: 400, easing: "ease-in-out" });
                            }).catch(function() {});
                        });
                    }
                } else {
                    var timelineDivEmpty = document.getElementById("timelineDiv");
                    if (timelineDivEmpty) { timelineDivEmpty.style.display = "none"; timelineDivEmpty.innerHTML = ""; }
                    var lineDescriptionsEmpty = document.getElementById("lineDescriptionsDiv");
                    if (lineDescriptionsEmpty) { lineDescriptionsEmpty.style.display = "none"; lineDescriptionsEmpty.innerHTML = ""; }
                }

                actualizarResumen({
                    municipioActual: municipioActual,
                    deptoActual: deptoActual,
                    filtroNivel: filtroNivel,
                    diccionarioMunicipios: diccionarioMunicipios,
                    diccionarioDepartamentos: diccionarioDepartamentos
                });

            },
            onError: function(error) {
                if (!isRenderCycleCurrent(cycleId)) return;
                setMunicipalServiceMessage(true, error);
            }
        });
    }

    async function cargarLimitesDepartamentos() {
        var cycleId = renderCycleId;
        var selectedDepto = (deptoActual && deptoActual !== "0" && deptoActual !== "COL")
            ? String(deptoActual)
            : "";

        hideAllLimitesLayers();
        clearAuxiliaryTerritoryLayer();
        destroyStatusDoughnut();
        setMunicipalServiceMessage(false);
        if (layerGlobal) layerGlobal.visible = false;

        createDepartamentosLayer({
            FeatureLayer: FeatureLayer, map: map, LIMITES_CONFIG: LIMITES_CONFIG, deptoActual: "",
            onReady: async function(args) {
                if (!isRenderCycleCurrent(cycleId)) return;

                var layer = args.layer, config = args.config, whereClause = args.whereClause, reused = args.reused;
                hideAllLimitesLayers();
                layer.visible = true;
                setLayerGlobal(layer);
                setWhereBase(whereClause);
                setLegendLayerTitle(config.title);
                updateMapViewBadge("L\u00edmites departamentales");
                deptoLayerRef = layer;
                window._departamentosLayerGlobal = layer;

                var lc = document.getElementById("legendContent");
                if (lc) lc.innerHTML = "";

                var results = await Promise.all([
                    layer.queryExtent({ where: whereClause }).catch(function() { return null; }),
                    renderChartDepartamentos(layer, config, whereClause, { title: (config.title || "L\u00edmites departamentales") + " en Colombia" })
                ]);
                if (!isRenderCycleCurrent(cycleId)) return;

                var extentResult = results[0];
                if (selectedDepto) {
                    applyDeptoSelection(selectedDepto, { updateSelect: false, zoom: true });
                } else if (extentResult && extentResult.extent && shouldZoom(extentResult.extent)) {
                    await zoomToExtent(extentResult.extent, reused ? 0 : 400);
                    clearDeptoChartHighlight();
                }

                actualizarLeyendaDepartamentosLimites();

                var legendContentEl = document.getElementById("legendContent");
                if (legendContentEl && !legendContentEl._deptoLegendBound) {
                    legendContentEl._deptoLegendBound = true;
                    legendContentEl.addEventListener("click", function(e) {
                        var btn = e.target.closest(".limites-depto-legend-toggle");
                        if (!btn || !deptoLayerRef) return;
                        var isActive = btn.getAttribute("aria-pressed") === "true";
                        if (isActive) {
                            btn.setAttribute("aria-pressed", "false");
                            btn.classList.add("inactive");
                            btn.style.opacity = "0.42";
                            deptoLayerRef.visible = false;
                        } else {
                            btn.setAttribute("aria-pressed", "true");
                            btn.classList.remove("inactive");
                            btn.style.opacity = "1";
                            deptoLayerRef.visible = true;
                        }
                    });
                }
            }
        });
    }

    window.cargarLimitesMunicipales = cargarLimitesMunicipales;
    window.cargarLimitesDepartamentos = cargarLimitesDepartamentos;

    document.getElementById("btnVerTodo").onclick = function() {
        if (!layerGlobal) return;
        layerGlobal.definitionExpression = whereBase;
        if (typeof actualizarLeyendaLimitesMunicipales === "function") actualizarLeyendaLimitesMunicipales();
        layerGlobal.queryExtent({ where: whereBase }).then(function(res) { if (res.extent) view.goTo(res.extent.expand(1.2), { duration: 400, easing: "ease-in-out" }); });
    };

    function markLimitesDropdownActive(target) {
        var dropdown = document.getElementById("limitesDropdown");
        if (!dropdown) return;
        dropdown.querySelectorAll(".dropdown-item").forEach(function(item) {
            item.classList.toggle("active", item.dataset.target === target);
        });
    }

    function resolveLimitesTabFromUrl(ctx) {
        var tab = String((ctx && ctx.tab) || "");
        if (tab === "Departamentos" || tab === "Municipios") return tab;
        if (ctx && ctx.municipioId) return "Municipios";
        return null;
    }

    function activateLimitesTabFromUrl(tabUrl) {
        var tab = String(tabUrl || "");
        if (tab !== "Departamentos" && tab !== "Municipios") return;
        markLimitesDropdownActive(tab);
        handleLimitesTabChange(tab);
    }

    var urlContext = globalThis.ModuleNavigation && globalThis.ModuleNavigation.parseComponentUrlParams
        ? globalThis.ModuleNavigation.parseComponentUrlParams()
        : { tab: null, municipioId: "", deptoId: "" };

    if (globalThis.ModuleNavigation && globalThis.ModuleNavigation.applyTerritorySelectionFromUrl) {
        globalThis.ModuleNavigation.applyTerritorySelectionFromUrl({
            onTab: function(tabUrl) {
                if (!urlContext.municipioId && !urlContext.deptoId) {
                    activateLimitesTabFromUrl(tabUrl);
                }
            },
            prepareTerritorySelection: function(ctx) {
                var municipioId = ctx.municipioId;
                var deptoId = ctx.deptoId;
                var selectDepto = ctx.selectDepto;
                var selectMuni = ctx.selectMuni;
                var tabToApply = resolveLimitesTabFromUrl({
                    tab: ctx.tab || urlContext.tab,
                    municipioId: municipioId,
                    deptoId: deptoId
                });

                if (deptoId && deptoId !== "0" && deptoId !== "COL") {
                    deptoActual = deptoId;
                }

                if (tabToApply) {
                    activateLimitesTabFromUrl(tabToApply);
                }

                if (deptoId && selectDepto && selectDepto.querySelector('option[value="' + deptoId + '"]')) {
                    renderizarMunicipios(deptoId);
                    return;
                }

                if (municipioId && selectMuni && !selectMuni.querySelector('option[value="' + municipioId + '"]')) {
                    renderizarMunicipios(deptoId || undefined);
                }
            }
        });
    }

    window.redirigir = function(e) {
        e.preventDefault();
        var link = e.currentTarget;
        var href = link.getAttribute("href");
        var territory = globalThis.ModuleNavigation && globalThis.ModuleNavigation.getTerritoryFromSelects
            ? globalThis.ModuleNavigation.getTerritoryFromSelects(
                document.getElementById("departamentos"),
                document.getElementById("municipios")
            )
            : { municipioId: "", deptoId: "" };

        window.location.href = globalThis.ModuleNavigation && globalThis.ModuleNavigation.mergeHrefWithTerritory
            ? globalThis.ModuleNavigation.mergeHrefWithTerritory(href, territory)
            : href;
    };
});
