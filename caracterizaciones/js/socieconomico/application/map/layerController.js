import { subscribe } from "../state/store.js";
import { prepareVisibleChartCanvas, setChartTitle } from "../charts/ui/chartPanel.js?v=local-chart-title-20260529";
import { createBoundedCache, destroyCanvasChart } from "../charts/core/chartLifecycle.js";
import { setChartStatus } from "../charts/ui/chartStatus.js";
import {
    MUNICIPALITY_REQUIRED_CHART_MESSAGE,
    MUNICIPALITY_REQUIRED_SUMMARY_MESSAGE
} from "../charts/ui/municipalityRequiredState.js?v=global-municipality-required-state-20260604";
import { socioeconomicoLayerUrl } from "../services/serviceRoots.js?v=sigi-service-roots-20260604";
import esriRequest from "https://js.arcgis.com/4.29/@arcgis/core/request.js";

const serviceAvailabilityCache = createBoundedCache(50);
const CONNECTIVITY_DEPARTMENT_LIMITS_LAYER_URL = socioeconomicoLayerUrl(1);
const CONNECTIVITY_MUNICIPAL_LIMITS_LAYER_URL = socioeconomicoLayerUrl(2);
const DEPARTMENT_BOUNDARY_OUTLINE_COLOR = [111, 111, 111, 230];
const DEPARTMENT_INFRASTRUCTURE_LAYER_IDS = new Set([200, 201, 202, 203, 204]);
const DEPARTMENT_CONDITIONS_LAYER_IDS = new Set([300, 301]);

export function createLayerController({ state, deps }) {
    const {
        FeatureLayer,
        ORDENAMIENTO_CONFIG,
        getActiveLayerConfig,
        clearLayers,
        setLegendLayer,
        updateMapViewBadge,
        actualizarGrafica,
        buildFilteredLegendFromLayers,
        buildLegendFromRenderer,
        actualizarLeyenda,
        ensureStationsLayer,
        ensureOrdenSueloDict,
        ensureGeoformasDict,
        actualizarFuente,
        renderZonificacionRuralCharts,
        renderAreasActividadCharts,
        renderClasificacionSueloCharts
    } = deps;

    subscribe((storeState) => {
        if (!storeState.municipio) return;

        setTimeout(() => {
            cargarCapaActual();
        }, 0);
    });

    function escapeSqlString(value) {
        return String(value ?? "").replace(/'/g, "''");
    }

    function isAbortError(error) {
        const name = String(error?.name || "").toLowerCase();
        const message = String(error?.message || error || "").toLowerCase();
        return name === "aborterror" || message.includes("aborted");
    }

    function isServiceUnavailableError(error) {
        const name = String(error?.name || "").toLowerCase();
        const message = String(error?.message || error || "").toLowerCase();
        return name === "request:server" || message.includes("service") && message.includes("not started");
    }

    function isExpectedLayerError(error) {
        return isAbortError(error) || isServiceUnavailableError(error);
    }

    async function isServiceAvailable(url) {
        const layerUrl = String(url || "").trim();
        if (!layerUrl) return false;
        if (serviceAvailabilityCache.has(layerUrl)) {
            return serviceAvailabilityCache.get(layerUrl);
        }

        try {
            const response = await fetch(`${layerUrl}?f=json`);
            if (!response.ok) {
                const available = response.status < 500;
                serviceAvailabilityCache.set(layerUrl, available);
                return available;
            }

            const json = await response.json();
            const available = !(json?.error && isServiceUnavailableError(json.error));
            serviceAvailabilityCache.set(layerUrl, available);
            return available;
        } catch {
            serviceAvailabilityCache.set(layerUrl, true);
            return true;
        }
    }

    let connectivityDepartmentBoundaryLayer = null;
    let connectivityMunicipalityBoundaryLayer = null;
    let povertyMunicipalityHighlightLayer = null;

    function isConnectivityConfig(config) {
        return config?.key === "CONNECTIVITY";
    }

    function isPovertyConfig(config) {
        return config?.key === "POVERTY_LEVEL";
    }

    function isTourismConfig(config) {
        return config?.key === "TOURISM" || config?.chartConfig?.id === "turismo-infraestructura";
    }

    function isPibDepartmentConfig(config) {
        return config?.key === "PIB_DEPARTMENT";
    }

    function isSupportInfrastructureConfig(config) {
        return config?.key === "SUPPORT_INFRASTRUCTURE";
    }

    function prioritizesMapRendering(config) {
        return config?.prioritizeMapRendering === true;
    }

    async function waitForFirstMapRender(layer, timeoutMs = 10000) {
        if (!layer || !state.view) return null;
        try {
            const layerView = await state.view.whenLayerView(layer);
            state.layerViewGlobal = layerView;
            layerView.filter = null;

            await new Promise(resolve => {
                let finished = false;
                let handle = null;
                let timeoutId = null;
                const finish = () => {
                    if (finished) return;
                    finished = true;
                    handle?.remove?.();
                    if (timeoutId) clearTimeout(timeoutId);
                    requestAnimationFrame(() => requestAnimationFrame(resolve));
                };

                if (!layerView.updating) {
                    finish();
                    return;
                }

                handle = layerView.watch("updating", updating => {
                    if (!updating) finish();
                });
                timeoutId = setTimeout(finish, timeoutMs);
            });
            return layerView;
        } catch (error) {
            if (!isExpectedLayerError(error)) console.warn("No se pudo confirmar el primer render cartografico:", error);
            return null;
        }
    }

    function isDepartmentInfrastructureConfig(config) {
        return state.currentMode === "SOCIOECONOMIC_INFRASTRUCTURE"
            && state.filtroNivel === "DEPTO"
            && DEPARTMENT_INFRASTRUCTURE_LAYER_IDS.has(Number(config?.id));
    }

    function isDepartmentConditionsConfig(config) {
        return state.currentMode === "SOCIOECONOMIC_CONDITIONS"
            && state.filtroNivel === "DEPTO"
            && DEPARTMENT_CONDITIONS_LAYER_IDS.has(Number(config?.id));
    }

    function isDepartmentContextConfig(config) {
        return isDepartmentInfrastructureConfig(config) || isDepartmentConditionsConfig(config);
    }

    function isMapOnlyDepartmentInfrastructureConfig(config) {
        return isDepartmentInfrastructureConfig(config)
            && !isConnectivityConfig(config)
            && config?.chartConfig?.filter?.requiredLevel === "MUNI";
    }

    function isMapOnlyDepartmentConfig(config) {
        return isMapOnlyDepartmentInfrastructureConfig(config)
            || (state.filtroNivel === "DEPTO"
                && DEPARTMENT_CONDITIONS_LAYER_IDS.has(Number(config?.id))
                && Boolean(config?.chartConfig?.mapOnlyOnDepartment));
    }

    function isDepartmentPopupOnlyConfig(config) {
        return config?.chartConfig?.allowDepartmentPopup === true
            && state.filtroNivel === "DEPTO"
            && !String(state.municipioActual || "").trim();
    }

    function getConnectivityDepartmentCode() {
        const departmentCode = String(state.deptoActual || "").trim();
        if (departmentCode) return departmentCode;

        const municipalityCode = String(state.municipioActual || "").trim();
        return municipalityCode.length >= 2 ? municipalityCode.slice(0, 2) : "";
    }

    function getConnectivityMapWhere(config) {
        if (!isConnectivityConfig(config)) {
            return String(state.whereBase || "1=1").trim() || "1=1";
        }

        const departmentCode = getConnectivityDepartmentCode();
        if (!departmentCode) return String(state.whereBase || "1=1").trim() || "1=1";
        return `dpcodigo = '${escapeSqlString(departmentCode)}'`;
    }

    function useDepartmentMapContextForMunicipality(config) {
        return (isPovertyConfig(config)
            || isSupportInfrastructureConfig(config)
            || isTourismConfig(config)
            || config?.keepDepartmentMapOnMunicipality === true)
            && state.filtroNivel === "MUNI";
    }

    function getDepartmentContextWhere(config) {
        const departmentField = config?.chartConfig?.filter?.departmentField || "dpcodigo";
        const departmentCode = getConnectivityDepartmentCode();
        if (!departmentCode) return String(state.whereBase || "1=1").trim() || "1=1";
        return `${departmentField} = '${escapeSqlString(departmentCode)}'`;
    }

    function usePibDepartmentContextForMunicipality(config, variantKey = null) {
        const activeVariantKey = String(variantKey || window.__pibMapVariantKey || config?.chartVariantKey || "").trim();
        return isPibDepartmentConfig(config)
            && activeVariantKey === "VALOR_AGREGADO"
            && state.filtroNivel === "MUNI"
            && String(state.municipioActual || "").trim();
    }

    function getPibDepartmentContextWhere() {
        const departmentCode = getConnectivityDepartmentCode();
        if (!departmentCode) return String(state.whereBase || "1=1").trim() || "1=1";
        return `dpcodigo = '${escapeSqlString(departmentCode)}'`;
    }

    function getMapWhereForConfig(config) {
        if (useDepartmentMapContextForMunicipality(config)) {
            return getDepartmentContextWhere(config);
        }
        if (usePibDepartmentContextForMunicipality(config)) {
            return getPibDepartmentContextWhere();
        }
        return String(state.whereBase || "1=1").trim() || "1=1";
    }

    function getConnectivityMunicipalityWhere() {
        return String(state.whereBase || "1=1").trim() || "1=1";
    }

    function getConnectivityContextWhere(config) {
        const mapWhere = getConnectivityMapWhere(config);
        const municipalityWhere = getConnectivityMunicipalityWhere();
        if (!isConnectivityConfig(config) || state.filtroNivel !== "MUNI" || !municipalityWhere || municipalityWhere === "1=1") {
            return mapWhere;
        }

        return `(${mapWhere}) AND NOT (${municipalityWhere})`;
    }

    function getConnectivityLayerWhere(config, role = "default") {
        if (!isConnectivityConfig(config)) {
            return String(state.whereBase || "1=1").trim() || "1=1";
        }

        if (role === "municipality") return getConnectivityMunicipalityWhere();
        if (role === "context") return getConnectivityContextWhere(config);
        return getConnectivityMapWhere(config);
    }

    function getConnectivityBoundaryWhere(layer, code, candidateNames) {
        const normalizedFields = (layer?.fields || []).map(field => ({
            name: field?.name,
            lower: String(field?.name || "").toLowerCase()
        }));
        const match = candidateNames
            .map(candidate => normalizedFields.find(field => field.lower === candidate))
            .find(Boolean);
        const fieldName = match?.name || candidateNames[0];
        const escapedCode = escapeSqlString(code);

        return String(fieldName).toLowerCase() === "llidentif"
            ? `${fieldName} LIKE '${escapedCode}%'`
            : `${fieldName} = '${escapedCode}'`;
    }

    function getConnectivityDepartmentBoundaryWhere(layer, departmentCode) {
        return getConnectivityBoundaryWhere(layer, departmentCode, [
            "dpcodigo",
            "cod_dpto",
            "coddepto",
            "depcodigo",
            "dppto_cdd",
            "llidentif"
        ]);
    }

    function getConnectivityMunicipalityBoundaryWhere(layer, municipalityCode) {
        return getConnectivityBoundaryWhere(layer, municipalityCode, [
            "mpcodigo",
            "divipola",
            "cod_mpio",
            "codmpio",
            "mpio_ccdgo",
            "llidentif"
        ]);
    }

    function createConnectivityBoundaryLayer({ url, title }) {
        return new FeatureLayer({
            url,
            definitionExpression: "1=0",
            outFields: ["*"],
            listMode: "hide",
            title,
            popupEnabled: false,
            minScale: 0,
            maxScale: 0,
            renderer: {
                type: "simple",
                symbol: {
                    type: "simple-fill",
                    color: [255, 255, 255, 0],
                    outline: {
                        type: "simple-line",
                        color: DEPARTMENT_BOUNDARY_OUTLINE_COLOR,
                        width: 1.2,
                        style: "solid"
                    }
                }
            }
        });
    }

    function clearConnectivityDepartmentBoundary() {
        if (!connectivityDepartmentBoundaryLayer) return;
        try {
            state.map?.remove(connectivityDepartmentBoundaryLayer);
        } catch (_) { }
        try {
            connectivityDepartmentBoundaryLayer.destroy?.();
        } catch (_) { }
        connectivityDepartmentBoundaryLayer = null;
    }

    function clearConnectivityMunicipalityBoundary() {
        if (!connectivityMunicipalityBoundaryLayer) return;
        try {
            state.map?.remove(connectivityMunicipalityBoundaryLayer);
        } catch (_) { }
        try {
            connectivityMunicipalityBoundaryLayer.destroy?.();
        } catch (_) { }
        connectivityMunicipalityBoundaryLayer = null;
    }

    function clearPovertyMunicipalityHighlight() {
        if (!povertyMunicipalityHighlightLayer) return;
        try {
            state.map?.remove(povertyMunicipalityHighlightLayer);
        } catch (_) { }
        try {
            povertyMunicipalityHighlightLayer.destroy?.();
        } catch (_) { }
        povertyMunicipalityHighlightLayer = null;
    }

    async function ensureConnectivityDepartmentBoundary(config) {
        const shouldShowDepartmentBoundary = isConnectivityConfig(config)
            || (isDepartmentContextConfig(config) && state.filtroNivel !== "MUNI");
        const shouldShowPovertyMunicipalContext = useDepartmentMapContextForMunicipality(config);
        if (!shouldShowDepartmentBoundary && !shouldShowPovertyMunicipalContext) {
            clearConnectivityDepartmentBoundary();
            return;
        }

        const departmentCode = getConnectivityDepartmentCode();
        if (!departmentCode || !state.map) {
            clearConnectivityDepartmentBoundary();
            return;
        }

        if (!connectivityDepartmentBoundaryLayer) {
            connectivityDepartmentBoundaryLayer = createConnectivityBoundaryLayer({
                url: CONNECTIVITY_DEPARTMENT_LIMITS_LAYER_URL,
                title: "Límite departamental seleccionado"
            });
            connectivityDepartmentBoundaryLayer.__sourceUrl = CONNECTIVITY_DEPARTMENT_LIMITS_LAYER_URL;
            state.map.add(connectivityDepartmentBoundaryLayer);
        }

        try {
            await connectivityDepartmentBoundaryLayer.when?.();
            connectivityDepartmentBoundaryLayer.definitionExpression =
                getConnectivityDepartmentBoundaryWhere(connectivityDepartmentBoundaryLayer, departmentCode);
            connectivityDepartmentBoundaryLayer.visible = true;
            state.map.reorder?.(connectivityDepartmentBoundaryLayer, state.map.layers.length - 1);
        } catch (error) {
            if (!isExpectedLayerError(error)) {
                console.warn("No se pudo dibujar el límite departamental de infraestructura:", error);
            }
        }
    }

    async function ensureConnectivityMunicipalityBoundary(config) {
        if (!isConnectivityConfig(config) || state.filtroNivel !== "MUNI") {
            clearConnectivityMunicipalityBoundary();
            return;
        }

        const municipalityCode = String(state.municipioActual || "").trim();
        if (!municipalityCode || !state.map) {
            clearConnectivityMunicipalityBoundary();
            return;
        }

        let definitionExpression = "1=0";
        if (!connectivityMunicipalityBoundaryLayer) {
            connectivityMunicipalityBoundaryLayer = new FeatureLayer({
                url: CONNECTIVITY_MUNICIPAL_LIMITS_LAYER_URL,
                definitionExpression,
                outFields: ["*"],
                listMode: "hide",
                title: "Límite municipal seleccionado",
                popupEnabled: false,
                minScale: 0,
                maxScale: 0,
                renderer: {
                    type: "simple",
                    symbol: {
                        type: "simple-fill",
                        color: [255, 255, 255, 0],
                        outline: {
                            type: "simple-line",
                            color: [0, 0, 0, 230],
                            width: 1.2,
                            style: "solid"
                        }
                    }
                }
            });
            connectivityMunicipalityBoundaryLayer.__sourceUrl = CONNECTIVITY_MUNICIPAL_LIMITS_LAYER_URL;
            state.map.add(connectivityMunicipalityBoundaryLayer);
        }

        try {
            await connectivityMunicipalityBoundaryLayer.when?.();
            definitionExpression = getConnectivityMunicipalityBoundaryWhere(connectivityMunicipalityBoundaryLayer, municipalityCode);
            connectivityMunicipalityBoundaryLayer.definitionExpression = definitionExpression;
            connectivityMunicipalityBoundaryLayer.visible = true;
            state.map.reorder?.(connectivityMunicipalityBoundaryLayer, state.map.layers.length - 1);
        } catch (error) {
            if (!isExpectedLayerError(error)) {
                console.warn("No se pudo dibujar el límite municipal de conectividad:", error);
            }
        }
    }

    async function ensurePovertyMunicipalityHighlight(config) {
        if (!useDepartmentMapContextForMunicipality(config)) {
            clearPovertyMunicipalityHighlight();
            return;
        }

        const municipalityCode = String(state.municipioActual || "").trim();
        if (!municipalityCode || !state.map) {
            clearPovertyMunicipalityHighlight();
            return;
        }

        if (!povertyMunicipalityHighlightLayer) {
            povertyMunicipalityHighlightLayer = new FeatureLayer({
                url: CONNECTIVITY_MUNICIPAL_LIMITS_LAYER_URL,
                definitionExpression: "1=0",
                outFields: ["*"],
                listMode: "hide",
                title: "Municipio seleccionado",
                popupEnabled: false,
                minScale: 0,
                maxScale: 0,
                renderer: {
                    type: "simple",
                    symbol: {
                        type: "simple-fill",
                        color: [255, 255, 255, 0],
                        outline: {
                            type: "simple-line",
                            color: [255, 190, 0, 255],
                            width: 2.4,
                            style: "solid"
                        }
                    }
                }
            });
            povertyMunicipalityHighlightLayer.__sourceUrl = CONNECTIVITY_MUNICIPAL_LIMITS_LAYER_URL;
            state.map.add(povertyMunicipalityHighlightLayer);
        }

        try {
            await povertyMunicipalityHighlightLayer.when?.();
            povertyMunicipalityHighlightLayer.definitionExpression =
                getConnectivityMunicipalityBoundaryWhere(povertyMunicipalityHighlightLayer, municipalityCode);
            povertyMunicipalityHighlightLayer.visible = true;
            state.map.reorder?.(povertyMunicipalityHighlightLayer, state.map.layers.length - 1);
        } catch (error) {
            if (!isExpectedLayerError(error)) {
                console.warn("No se pudo resaltar el municipio seleccionado:", error);
            }
        }
    }

    async function ensureConnectivityBoundary(config) {
        if (!isConnectivityConfig(config) && !isDepartmentContextConfig(config) && !useDepartmentMapContextForMunicipality(config)) {
            clearConnectivityDepartmentBoundary();
            clearConnectivityMunicipalityBoundary();
            clearPovertyMunicipalityHighlight();
            return;
        }

        if (useDepartmentMapContextForMunicipality(config)) {
            clearConnectivityMunicipalityBoundary();
            await ensureConnectivityDepartmentBoundary(config);
            await ensurePovertyMunicipalityHighlight(config);
            return;
        }

        clearPovertyMunicipalityHighlight();
        if (state.filtroNivel === "MUNI") {
            if (isConnectivityConfig(config)) {
                await ensureConnectivityDepartmentBoundary(config);
                await ensureConnectivityMunicipalityBoundary(config);
            } else {
                clearConnectivityDepartmentBoundary();
                clearConnectivityMunicipalityBoundary();
            }
            return;
        }

        clearConnectivityMunicipalityBoundary();
        await ensureConnectivityDepartmentBoundary(config);
    }

    async function queryConnectivityNavigationExtent(config, fallbackLayer) {
        if (((isConnectivityConfig(config) || isDepartmentContextConfig(config)) && state.filtroNivel !== "MUNI" || useDepartmentMapContextForMunicipality(config)) && connectivityDepartmentBoundaryLayer) {
            const where = connectivityDepartmentBoundaryLayer.definitionExpression || "1=0";
            const extent = (await connectivityDepartmentBoundaryLayer.queryExtent({ where }))?.extent;
            if (extent) {
                return {
                    extent,
                    where,
                    layerUrl: connectivityDepartmentBoundaryLayer.__sourceUrl || connectivityDepartmentBoundaryLayer.url || ""
                };
            }
        }

        const where = useDepartmentMapContextForMunicipality(config)
            ? getDepartmentContextWhere(config)
            : usePibDepartmentContextForMunicipality(config)
            ? getPibDepartmentContextWhere()
            : getConnectivityMapWhere(config);
        const extent = (await fallbackLayer.queryExtent({ where }))?.extent;
        return {
            extent,
            where,
            layerUrl: fallbackLayer?.__sourceUrl || fallbackLayer?.url || ""
        };
    }

    function getSelectedDepartmentName() {
        const select = document.getElementById("departamentos");
        const text = select?.options?.[select.selectedIndex]?.textContent?.trim();
        return text && text !== "Seleccione departamento" && text !== "Colombia" ? text : "";
    }

    function normalizeChartWhere(config) {
        const filterConfig = config?.chartConfig?.filter;
        const departmentField = filterConfig?.departmentField;
        if (filterConfig?.scope === "allDepartments") return;
        if (state.filtroNivel === "MUNI") return;
        if (!departmentField || !state.deptoActual || !state.filtroNivel) return;

        const departmentName = getSelectedDepartmentName();
        const departmentValue = filterConfig?.valueSource === "code"
            ? state.deptoActual
            : departmentName;
        if (!departmentValue) return;

        state.whereBase = `${departmentField} = '${escapeSqlString(departmentValue)}'`;
    }

    function applyVariantLabeling(layer, variant) {
        const expression = variant?.labelExpression || variant?.labelExpressionInfo?.expression;
        if (!expression) {
            layer.labelsVisible = false;
            layer.labelingInfo = [];
            layer.popupEnabled = false;
            return;
        }

        layer.labelsVisible = true;
        layer.labelingInfo = [{
            labelPlacement: variant.labelPlacement || "always-horizontal",
            labelExpressionInfo: { expression },
            deconflictionStrategy: variant.deconflictionStrategy || "none",
            symbol: variant.labelSymbol || {
                type: "text",
                color: "black",
                haloColor: "white",
                haloSize: 1,
                font: { size: 10, family: "sans-serif" }
            }
        }];
    }

    function parseLegendRangeCode(code) {
        const normalized = String(code ?? "").trim();
        if (!normalized) return null;
        const parts = normalized
            .replace(/,/g, ".")
            .split(/\s*-\s*/)
            .map(value => Number(String(value).replace(/[^\d.+-]/g, "")));
        if (parts.length < 2 || parts.some(value => !Number.isFinite(value))) return null;
        return { min: parts[0], max: parts[1] };
    }

    function rendererFieldName(renderer, fallback = null) {
        return String(
            renderer?.field ||
            renderer?.field1 ||
            renderer?.field2 ||
            renderer?.field3 ||
            fallback ||
            ""
        ).trim() || null;
    }

    function toPlainArray(value) {
        if (!value) return [];
        if (Array.isArray(value)) return value;
        if (typeof value.toArray === "function") return value.toArray();
        if (Array.isArray(value.items)) return value.items;
        return [];
    }

    function rendererSymbolColor(symbol) {
        const color = symbol?.color || symbol?.symbol?.color || symbol?.outline?.color;
        if (Array.isArray(color)) {
            const [r, g, b, a = 255] = color;
            return `rgba(${r}, ${g}, ${b}, ${Number(a) / 255})`;
        }
        if (color && typeof color === "object") {
            const r = color.r ?? color.red;
            const g = color.g ?? color.green;
            const b = color.b ?? color.blue;
            const alpha = color.a ?? color.alpha ?? 1;
            if ([r, g, b].every(value => value != null && Number.isFinite(Number(value)))) {
                const cssAlpha = Number(alpha) > 1 ? Number(alpha) / 255 : Number(alpha);
                return `rgba(${Number(r)}, ${Number(g)}, ${Number(b)}, ${Math.max(0, Math.min(1, cssAlpha))})`;
            }
        }
        return "#999";
    }

    function rendererInfoCode(info) {
        const values = toPlainArray(info?.values);
        if (values.length) {
            const first = Array.isArray(values[0]) ? values[0] : toPlainArray(values[0]);
            return String(first?.[0] ?? values[0] ?? "").trim();
        }
        if (info?.value != null) return String(info.value).trim();
        const maxValue = info?.maxValue ?? info?.classMaxValue;
        if (info?.minValue != null || maxValue != null) {
            return `${info.minValue ?? ""}-${maxValue ?? ""}`;
        }
        return "";
    }

    function rendererLabelForNumericValue(renderer, value, chartConfig = {}) {
        const numericValue = Number(value);
        if (!Number.isFinite(numericValue)) return String(value ?? "").trim();

        const infos = [
            ...toPlainArray(renderer?.uniqueValueInfos),
            ...toPlainArray(renderer?.uniqueValueGroups).flatMap(group => toPlainArray(group?.classes)),
            ...toPlainArray(renderer?.classBreakInfos)
        ];

        let previousClassMax = Number(renderer?.minValue);
        if (!Number.isFinite(previousClassMax)) previousClassMax = null;

        for (const info of infos) {
            if (info?.value != null && String(info.value).trim() === String(value).trim()) {
                return String(info.label || chartConfig?.rangeLabels?.[String(value)] || value).trim();
            }

            const min = Number(info?.minValue);
            const max = Number(info?.maxValue ?? info?.classMaxValue);
            if (Number.isFinite(min) && Number.isFinite(max) && numericValue >= min && numericValue <= max) {
                return String(info.label || chartConfig?.rangeLabels?.[String(value)] || value).trim();
            }

            if (!Number.isFinite(min) && Number.isFinite(max)) {
                const isFirstBreak = previousClassMax == null || previousClassMax === Number(renderer?.minValue);
                const inBreak = numericValue <= max && (isFirstBreak ? numericValue >= Number(renderer?.minValue ?? numericValue) : numericValue > previousClassMax);
                previousClassMax = max;
                if (inBreak) {
                    return String(info.label || chartConfig?.rangeLabels?.[String(value)] || value).trim();
                }
            }
        }

        return String(chartConfig?.rangeLabels?.[String(value)] || value).trim();
    }

    function rendererColorForNumericValue(renderer, value) {
        const numericValue = Number(value);
        if (!Number.isFinite(numericValue)) return "#999";

        const infos = [
            ...toPlainArray(renderer?.uniqueValueInfos),
            ...toPlainArray(renderer?.uniqueValueGroups).flatMap(group => toPlainArray(group?.classes)),
            ...toPlainArray(renderer?.classBreakInfos)
        ];

        let previousClassMax = Number(renderer?.minValue);
        if (!Number.isFinite(previousClassMax)) previousClassMax = null;

        for (const info of infos) {
            if (info?.value != null && String(info.value).trim() === String(value).trim()) {
                return rendererSymbolColor(info?.symbol);
            }

            const min = Number(info?.minValue);
            const max = Number(info?.maxValue ?? info?.classMaxValue);
            if (Number.isFinite(min) && Number.isFinite(max) && numericValue >= min && numericValue <= max) {
                return rendererSymbolColor(info?.symbol);
            }

            if (!Number.isFinite(min) && Number.isFinite(max)) {
                const isFirstBreak = previousClassMax == null || previousClassMax === Number(renderer?.minValue);
                const inBreak = numericValue <= max && (isFirstBreak ? numericValue >= Number(renderer?.minValue ?? numericValue) : numericValue > previousClassMax);
                previousClassMax = max;
                if (inBreak) {
                    return rendererSymbolColor(info?.symbol);
                }
            }
        }

        return rendererSymbolColor(renderer?.defaultSymbol || renderer?.symbol);
    }

    async function buildPublicServicesActiveLegendData(layer, renderer, chartConfig, where) {
        if (chartConfig?.mapLegendMode === "settlement") {
            const settlementField = chartConfig?.settlementField || chartConfig?.mapInteractionField;
            const labelsByCode = chartConfig?.settlementLabels || {};
            const colorsByCode = chartConfig?.settlementMapColors || {};
            const orderedCodes = Object.keys(labelsByCode);
            if (!layer || !settlementField || !orderedCodes.length) return null;

            const query = layer.createQuery();
            query.where = where || layer.definitionExpression || "1=1";
            query.outFields = [settlementField];
            query.returnGeometry = false;
            query.num = 2000;

            try {
                const result = await layer.queryFeatures(query);
                const activeCodes = new Set((result?.features || [])
                    .map(feature => String(feature?.attributes?.[settlementField] ?? "").trim())
                    .filter(Boolean));
                const visibleCodes = orderedCodes.filter(code => activeCodes.has(String(code)));
                if (!visibleCodes.length) return null;
                const rendererInfos = toPlainArray(renderer?.uniqueValueInfos);
                const symbolByCode = new Map(rendererInfos.map(info => [
                    String(info?.value ?? rendererInfoCode(info)).trim(),
                    info?.symbol
                ]));
                return {
                    labels: visibleCodes.map(code => labelsByCode[code] || code),
                    colors: visibleCodes.map(code => colorsByCode[code] || rendererColorForNumericValue(renderer, code)),
                    codes: visibleCodes,
                    symbols: visibleCodes.map(code => symbolByCode.get(String(code)) || null)
                };
            } catch (error) {
                if (!isExpectedLayerError(error)) {
                    console.warn("No se pudo construir leyenda activa de servicios pÃºblicos:", error);
                }
                return null;
            }
        }

        const rendererField = rendererFieldName(renderer, chartConfig?.rendererField || chartConfig?.mapInteractionField);
        const fields = (rendererField ? [rendererField] : (chartConfig?.axes || [])
            .map(axis => String(axis?.field || "").trim())
            .filter(Boolean));
        if (!layer || !fields.length) return null;

        const query = layer.createQuery();
        query.where = where || layer.definitionExpression || "1=1";
        query.outFields = [...new Set(fields)];
        query.returnGeometry = false;
        query.num = 2000;

        try {
            const result = await layer.queryFeatures(query);
            const activeCodes = new Set();
            (result?.features || []).forEach(feature => {
                const attrs = feature?.attributes || {};
                fields.forEach(field => {
                    const value = attrs[field];
                    if (value == null || String(value).trim() === "") return;
                    activeCodes.add(String(value).trim());
                });
            });

            const orderedCodes = Object.keys(chartConfig?.rangeLabels || {})
                .filter(code => activeCodes.has(String(code)))
                .concat([...activeCodes].filter(code => !Object.prototype.hasOwnProperty.call(chartConfig?.rangeLabels || {}, code)).sort((a, b) => Number(a) - Number(b)));

            if (!orderedCodes.length) return null;

            return {
                labels: orderedCodes.map(code => rendererLabelForNumericValue(renderer, code, chartConfig)),
                colors: orderedCodes.map(code => rendererColorForNumericValue(renderer, code)),
                codes: orderedCodes
            };
        } catch (error) {
            if (!isExpectedLayerError(error)) {
                console.warn("No se pudo construir leyenda activa de servicios públicos:", error);
            }
            return null;
        }
    }

    function buildRendererLegendData(renderer) {
        if (!renderer) return null;

        const uniqueInfos = toPlainArray(renderer.uniqueValueInfos);
        const groupedInfos = toPlainArray(renderer.uniqueValueGroups)
            .flatMap(group => toPlainArray(group?.classes));
        const classBreakInfos = toPlainArray(renderer.classBreakInfos);
        const infos = uniqueInfos.length ? uniqueInfos : (groupedInfos.length ? groupedInfos : classBreakInfos);

        const labels = [];
        const colors = [];
        const codes = [];
        const seen = new Set();

        infos.forEach(info => {
            const code = rendererInfoCode(info);
            const label = String(info?.label || info?.description || code || "").trim();
            if (!code || !label) return;
            const key = `${code}||${label}`;
            if (seen.has(key)) return;
            seen.add(key);
            labels.push(label);
            colors.push(rendererSymbolColor(info?.symbol));
            codes.push(code);
        });

        return labels.length ? { labels, colors, codes } : null;
    }

    function rendererLegendItems(renderer) {
        if (!renderer) return [];

        const uniqueInfos = toPlainArray(renderer.uniqueValueInfos);
        const groupedInfos = toPlainArray(renderer.uniqueValueGroups)
            .flatMap(group => toPlainArray(group?.classes));
        const classBreakInfos = toPlainArray(renderer.classBreakInfos);
        const infos = uniqueInfos.length ? uniqueInfos : (groupedInfos.length ? groupedInfos : classBreakInfos);

        if (!infos.length && renderer.symbol) {
            return [{
                code: "__simple__",
                label: renderer.label || renderer.description || "Cobertura",
                color: rendererSymbolColor(renderer.symbol),
                symbol: renderer.symbol,
                rendererType: "simple"
            }];
        }

        return infos.map(info => {
            const code = rendererInfoCode(info);
            const label = String(info?.label || info?.description || code || "").trim();
            if (!code || !label) return null;
            return {
                code,
                label,
                color: rendererSymbolColor(info?.symbol),
                symbol: info?.symbol || null,
                rendererType: String(renderer?.type || "").trim()
            };
        }).filter(Boolean);
    }

    function prefixedLegendCode(layerKey, code) {
        const key = String(layerKey || "").trim();
        const value = String(code ?? "").trim();
        return key ? `${key}::${value}` : value;
    }

    function splitPrefixedLegendCode(code) {
        const value = String(code ?? "").trim();
        const separatorIndex = value.indexOf("::");
        if (separatorIndex === -1) {
            return { layerKey: "", code: value };
        }
        return {
            layerKey: value.slice(0, separatorIndex),
            code: value.slice(separatorIndex + 2)
        };
    }

    function buildLegendDataFromItems(items, chartConfig = {}) {
        const dedupeByLabel = Boolean(chartConfig?.dedupeLegendByLabel);
        const labels = [];
        const colors = [];
        const codes = [];
        const symbols = [];
        const sections = [];
        const codeGroups = {};
        const seen = new Map();

        (items || []).forEach(item => {
            const code = String(item?.code ?? "").trim();
            const label = String(item?.label ?? "").trim();
            const section = String(item?.section || "").trim();
            if (!code || !label) return;

            const key = dedupeByLabel ? `${section.toLowerCase()}||${label.toLowerCase()}` : `${code}||${label}`;
            const existingIndex = seen.get(key);
            if (existingIndex != null) {
                const existingCode = codes[existingIndex];
                codeGroups[existingCode] = [...new Set([...(codeGroups[existingCode] || [existingCode]), code])];
                return;
            }

            seen.set(key, labels.length);
            labels.push(label);
            colors.push(item.color || "#999");
            codes.push(code);
            symbols.push(item.symbol || null);
            sections.push(section);
            if (dedupeByLabel) codeGroups[code] = [code];
        });

        return labels.length
            ? {
                labels,
                colors,
                codes,
                symbols,
                sections,
                codeGroups: Object.keys(codeGroups).length ? codeGroups : null
            }
            : null;
    }

    function rendererItemWhere(fieldName, item, rendererType, fieldType = "") {
        if (!fieldName || !item?.code) return null;
        if (item.code === "__simple__" || item.rendererType === "simple") return null;

        const normalizedType = String(rendererType || item.rendererType || "").trim();
        if (normalizedType === "class-breaks" || normalizedType === "classBreaks") {
            const range = parseLegendRangeCode(item.code);
            return range ? `(${fieldName} >= ${range.min} AND ${fieldName} <= ${range.max})` : null;
        }

        const isNumeric = ["small-integer", "integer", "single", "double", "long"].includes(String(fieldType || "").toLowerCase());
        const stringValue = String(item.code ?? "").trim();
        const value = isNumeric && stringValue !== "" && !isNaN(stringValue)
            ? Number(stringValue)
            : `'${stringValue.replace(/'/g, "''")}'`;
        return `${fieldName} = ${value}`;
    }

    async function layerHasFeaturesForLegendItem(layer, fieldName, item, baseWhere, strict = false) {
        if (!layer?.queryFeatureCount) return true;
        const rendererType = String(layer?.renderer?.type || "").trim();
        let fieldInfo = null;
        try {
            fieldInfo = (layer.fields || []).find(field =>
                String(field.name || "").toLowerCase() === String(fieldName || "").toLowerCase()
            );
        } catch (_) {}

        const itemWhere = rendererItemWhere(fieldName, item, rendererType, fieldInfo?.type);
        if (!itemWhere && item?.rendererType !== "simple" && item?.code !== "__simple__") {
            return false;
        }
        const where = itemWhere
            ? `((${baseWhere || "1=1"}) AND (${itemWhere}))`
            : (baseWhere || "1=1");
        try {
            return (await layer.queryFeatureCount({ where })) > 0;
        } catch (_) {
            return !strict;
        }
    }

    function mapServerLegendUrlForLayer(layer) {
        const url = String(layer?.__sourceUrl || layer?.url || "").trim();
        const match = url.match(/^(.*\/MapServer)\/(\d+)(?:\?.*)?$/i);
        if (!match) return null;
        return {
            url: `${match[1]}/legend`,
            layerId: Number(match[2])
        };
    }

    async function rendererLegendImagesForLayer(layer) {
        const legendInfo = mapServerLegendUrlForLayer(layer);
        if (!legendInfo) return new Map();

        try {
            const response = await esriRequest(legendInfo.url, {
                query: { f: "json" },
                responseType: "json"
            });
            const layerLegend = toPlainArray(response?.data?.layers)
                .find(item => Number(item?.layerId ?? item?.id) === legendInfo.layerId);
            const legendEntries = toPlainArray(layerLegend?.legend);
            return new Map(legendEntries
                .map((entry, index) => {
                    const label = String(entry?.label || "").trim();
                    const key = label || `__index_${index}`;
                    const imageData = String(entry?.imageData || "").trim();
                    if (!key || !imageData) return null;
                    return [key.toLowerCase(), {
                        imageData,
                        contentType: String(entry?.contentType || "image/png").trim() || "image/png"
                    }];
                })
                .filter(Boolean));
        } catch (error) {
            if (!isExpectedLayerError(error)) {
                console.warn("No se pudo obtener la simbologia de leyenda del servicio:", error);
            }
            return new Map();
        }
    }

    async function buildMultilayerRendererLegendData(layers, chartConfig, baseWhere) {
        const items = [];
        const isRendererDrivenLegend = chartConfig?.useServiceRendererLegend || chartConfig?.legendDrivenByMapRenderer;
        const orderedLayers = [...(layers || [])]
            .filter(layer => layer && !layer.destroyed)
            .sort((a, b) => Number(a.__legendSectionOrder ?? 999) - Number(b.__legendSectionOrder ?? 999));

        for (const layer of orderedLayers) {
            if (!layer || layer.destroyed) continue;
            const renderer = layer.renderer || await rendererFromLayerMetadata(layer);
            if (!renderer) continue;

            const fieldName = rendererFieldName(
                renderer,
                isRendererDrivenLegend ? null : (chartConfig?.rendererField || chartConfig?.mapInteractionField)
            );
            const layerItems = rendererLegendItems(renderer);
            const useServiceLegendImages = chartConfig?.id === "public-services-radar" || chartConfig?.useServiceRendererLegend;
            const serviceLegendImages = useServiceLegendImages
                ? await rendererLegendImagesForLayer(layer)
                : new Map();
            for (const [index, item] of layerItems.entries()) {
                if (await layerHasFeaturesForLegendItem(layer, fieldName, item, baseWhere, isRendererDrivenLegend)) {
                    const layerKey = String(layer.__legendLayerKey || layer.__sourceUrl || layer.url || "").trim();
                    const serviceLegendSymbol = serviceLegendImages.get(String(item.label || "").trim().toLowerCase())
                        || serviceLegendImages.get(`__index_${index}`);
                    items.push({
                        ...item,
                        rawCode: item.code,
                        code: prefixedLegendCode(layerKey, item.code),
                        symbol: serviceLegendSymbol
                            ? { ...(item.symbol || {}), ...serviceLegendSymbol, type: "legend-image" }
                            : item.symbol,
                        section: layer.__legendHeading || layer.title || ""
                    });
                }
            }
        }

        return buildLegendDataFromItems(items, chartConfig);
    }

    function expandLegendGroupCodes(activeCodes, codeGroups = null) {
        const expanded = new Set();
        const sourceCodes = activeCodes instanceof Set ? activeCodes : new Set(activeCodes || []);

        sourceCodes.forEach(value => {
            const code = String(value ?? "").trim();
            if (!code) return;

            const group = codeGroups?.[code];
            if (Array.isArray(group) && group.length) {
                group.forEach(groupCode => {
                    const normalized = String(groupCode ?? "").trim();
                    if (normalized) expanded.add(normalized);
                });
                return;
            }

            expanded.add(code);
        });

        return [...expanded];
    }

    async function rendererFromLayerMetadata(layer) {
        const url = String(layer?.__sourceUrl || layer?.url || "").trim();
        if (!url) return null;
        try {
            const response = await esriRequest(url, {
                query: { f: "json" },
                responseType: "json"
            });
            return response?.data?.drawingInfo?.renderer || null;
        } catch {
            return null;
        }
    }

    async function applyRendererLegendSelection(legendState, layerOrLayers, rendererField, baseWhere = "1=1") {
        if (!legendState || !state.view || !rendererField) return;

        const targetLayers = (Array.isArray(layerOrLayers) ? layerOrLayers : [layerOrLayers])
            .filter(currentLayer => currentLayer && !currentLayer.destroyed);
        if (!targetLayers.length) return;

        const activeCodes = legendState?.activeCodes instanceof Set
            ? [...legendState.activeCodes].map(value => String(value ?? "").trim()).filter(Boolean)
            : [];
        const expandedActiveCodes = expandLegendGroupCodes(legendState?.activeCodes, legendState?.codeGroups);
        const totalCodes = Array.isArray(legendState?.allCodes)
            ? legendState.allCodes.map(value => String(value ?? "").trim()).filter(Boolean)
            : [];

        const base = String(baseWhere || "1=1").trim() || "1=1";

        await Promise.all(targetLayers.map(async currentLayer => {
            try {
                const layerRendererField = rendererFieldName(currentLayer.renderer, rendererField) || rendererField;
                const layerKey = String(currentLayer.__legendLayerKey || currentLayer.__sourceUrl || currentLayer.url || "").trim();
                const layerAllCodes = totalCodes
                    .map(splitPrefixedLegendCode)
                    .filter(item => !item.layerKey || !layerKey || item.layerKey === layerKey)
                    .map(item => item.code)
                    .filter(Boolean);
                const layerActiveCodes = expandedActiveCodes
                    .map(splitPrefixedLegendCode)
                    .filter(item => !item.layerKey || !layerKey || item.layerKey === layerKey)
                    .map(item => item.code)
                    .filter(Boolean);
                const rendererType = String(currentLayer?.renderer?.type || "").trim();
                let fieldInfo = null;
                try {
                    fieldInfo = (currentLayer.fields || []).find(field =>
                        String(field.name || "").toLowerCase() === String(layerRendererField).toLowerCase()
                    );
                } catch (_) {}

                let layerRendererWhere = null;
                if (!activeCodes.length || (layerAllCodes.length && !layerActiveCodes.length)) {
                    layerRendererWhere = "1=0";
                } else if (layerAllCodes.length && layerActiveCodes.length < layerAllCodes.length) {
                    if (rendererType === "class-breaks" || rendererType === "classBreaks") {
                        const clauses = layerActiveCodes
                            .map(parseLegendRangeCode)
                            .filter(Boolean)
                            .map(range => `(${layerRendererField} >= ${range.min} AND ${layerRendererField} <= ${range.max})`);
                        layerRendererWhere = clauses.length ? clauses.join(" OR ") : null;
                    } else {
                        const fieldType = String(fieldInfo?.type || "").toLowerCase();
                        const isNumeric = ["small-integer", "integer", "single", "double", "long"].includes(fieldType);
                        const values = layerActiveCodes
                            .filter(value => String(value ?? "").trim() !== "__simple__")
                            .map(value => {
                                const stringValue = String(value ?? "").trim();
                                if (isNumeric && stringValue !== "" && !isNaN(stringValue)) return Number(stringValue);
                                return `'${stringValue.replace(/'/g, "''")}'`;
                            });
                        layerRendererWhere = values.length ? `${layerRendererField} IN (${values.join(",")})` : null;
                    }
                }

                const layerFinalWhere = layerRendererWhere ? `((${base}) AND (${layerRendererWhere}))` : base;
                const layerView = await state.view.whenLayerView(currentLayer);
                layerView.filter = layerFinalWhere && layerFinalWhere !== "1=1" ? { where: layerFinalWhere } : null;
            } catch (err) {
                console.warn("No se pudo aplicar filtro del renderer en la leyenda:", err);
            }
        }));
    }

    async function queryLayerNavigationTarget(layer, where) {
        if (!layer || layer.destroyed) return null;
        const safeWhere = String(where || layer.definitionExpression || "1=1").trim() || "1=1";

        try {
            const result = await layer.queryExtent({ where: safeWhere });
            if (result?.extent) return result.extent.expand(1.2);
        } catch (error) {
            if (!isExpectedLayerError(error)) {
                console.warn("No se pudo consultar extent de la capa:", error);
            }
        }

        try {
            const query = layer.createQuery();
            query.where = safeWhere;
            query.outFields = [layer.objectIdField || "objectid"];
            query.returnGeometry = true;
            query.num = 1;
            const result = await layer.queryFeatures(query);
            const geometry = result?.features?.[0]?.geometry;
            return geometry?.extent?.expand?.(1.2) || geometry || null;
        } catch (error) {
            if (!isExpectedLayerError(error)) {
                console.warn("No se pudo consultar geometria de la capa:", error);
            }
        }

        return null;
    }

    function isStillActiveConfig(config) {
        const active = getActiveLayerConfig();
        return active === config
            || (active?.id != null && active.id === config?.id)
            || (active?.key && active.key === config?.key);
    }

    async function updateLegend(layer, config) {
        if (isDepartmentInfrastructureConfig(config) && layer) {
            const legendRenderer = layer.renderer || await rendererFromLayerMetadata(layer);
            const chartConfig = config?.chartConfig || {};
            const legendField = rendererFieldName(
                legendRenderer,
                config?.legendField || chartConfig?.mapInteractionField || chartConfig?.legendField || chartConfig?.xAxis?.field
            );
            const legendBaseWhere = String(layer?.definitionExpression || state.whereBase || "1=1").trim() || "1=1";
            let legendData = null;

            if (legendField && typeof buildFilteredLegendFromLayers === "function") {
                legendData = await buildFilteredLegendFromLayers({
                    layers: [layer],
                    field: legendField,
                    where: legendBaseWhere,
                    chartConfig: {
                        ...chartConfig,
                        useGlobalLegendOrder: false,
                        colorsFromRenderer: true,
                        labelsFromRenderer: true
                    }
                });
            }

            if (!legendData?.labels?.length && !legendField && legendRenderer) {
                legendData = buildLegendFromRenderer(legendRenderer, {
                    chartConfig: {
                        ...chartConfig,
                        useGlobalLegendOrder: false,
                        colorsFromRenderer: true,
                        labelsFromRenderer: true
                    }
                });
            }

            if (legendData?.labels?.length) {
                actualizarLeyenda(legendData.labels, legendData.colors, legendData.codes, {
                    field: legendField,
                    baseWhere: legendBaseWhere,
                    layers: [layer],
                    symbols: legendData.symbols,
                    codeGroups: legendData.codeGroups,
                    preserveOrder: true
                });
            } else {
                actualizarLeyenda([], [], [], {
                    field: legendField,
                    baseWhere: legendBaseWhere,
                    layers: [layer],
                    preserveOrder: true
                });
            }
            return;
        }

        const useExtentLegend = typeof state.updateLegendByExtent === "function"
            && !config?.forceRendererLegend
            && !(config?.type === "table-layer" && config?.mapFallback?.url);

        if (useExtentLegend) {
            state.updateLegendByExtent(layer, config);
            return;
        }

        if (config?.key === "PIB_DEPARTMENT" && layer?.renderer) {
            const legendData = buildLegendFromRenderer(layer.renderer, {
                chartConfig: {
                    useGlobalLegendOrder: false,
                    colorsFromRenderer: true,
                    labelsFromRenderer: true
                }
            });
            if (legendData?.labels?.length) {
                actualizarLeyenda(legendData.labels, legendData.colors, legendData.codes, {
                    field: layer.renderer?.field || (window.__pibMapVariantKey === "VALOR_AGREGADO" ? "pvagregadokmcop" : "pibdpto"),
                    baseWhere: String(layer.definitionExpression || state.whereBase || "1=1").trim() || "1=1",
                    layers: [layer],
                    codeGroups: legendData.codeGroups,
                    preserveOrder: true
                });
            }
            return;
        }

        if (config?.forceRendererLegend && layer) {
            const legendRenderer = layer.renderer || await rendererFromLayerMetadata(layer);
            if (!legendRenderer) return;
            const chartConfig = config?.chartConfig || {};
            const isRendererDrivenLegend = chartConfig?.useServiceRendererLegend || chartConfig?.legendDrivenByMapRenderer;
            const legendField = rendererFieldName(
                legendRenderer,
                isRendererDrivenLegend ? null : config?.legendField
            );
            const legendLayers = (state.layersGlobal?.length ? state.layersGlobal : [layer])
                .filter(currentLayer => currentLayer && !currentLayer.destroyed && !currentLayer.__legendExcluded);
            const legendBaseWhere = String(
                layer?.definitionExpression ||
                state.whereBase ||
                "1=1"
            ).trim() || "1=1";
            let legendData = null;

            if (chartConfig?.id === "public-services-radar" && !chartConfig?.useServiceRendererLegend) {
                legendData = await buildPublicServicesActiveLegendData(layer, legendRenderer, chartConfig, legendBaseWhere);
            }

            if (!legendData?.labels?.length && legendLayers.length > 1) {
                legendData = await buildMultilayerRendererLegendData(legendLayers, chartConfig, legendBaseWhere);
            }

            if (!legendData?.labels?.length && config?.onlyActiveRendererLegendItems && legendField && typeof buildFilteredLegendFromLayers === "function") {
                legendData = await buildFilteredLegendFromLayers({
                    layers: legendLayers,
                    field: legendField,
                    where: legendBaseWhere,
                    chartConfig: {
                        ...chartConfig,
                        useGlobalLegendOrder: false,
                        colorsFromRenderer: true,
                        labelsFromRenderer: true
                    }
                });
            }

            if (!legendData?.labels?.length) {
                legendData = buildRendererLegendData(legendRenderer) || buildLegendFromRenderer(legendRenderer, {
                    chartConfig: {
                        ...chartConfig,
                        useGlobalLegendOrder: false,
                        colorsFromRenderer: true,
                        labelsFromRenderer: true
                    }
                });
            }

            if (legendData?.labels?.length) {
                actualizarLeyenda(legendData.labels, legendData.colors, legendData.codes, {
                    field: legendField,
                    baseWhere: legendBaseWhere,
                    layers: legendLayers,
                    symbols: legendData.symbols,
                    codeGroups: legendData.codeGroups,
                    sections: legendData.sections,
                    preserveOrder: true,
                    customApply: legendField && (chartConfig?.id !== "public-services-radar" || chartConfig?.useServiceRendererLegend)
                        ? async (legendState) => {
                            await applyRendererLegendSelection(legendState, legendLayers, legendField, legendBaseWhere);
                        }
                        : null
                });
            }
            return;
        }

        const chartConfig = config?.chartConfig;
        if (Array.isArray(chartConfig?.categoryFields) && chartConfig.categoryFields.length) {
            return;
        }
        const legendField = (
            config?.type === "table-layer" && config?.mapFallback?.url
                ? chartConfig?.legendField
                : null
        ) || chartConfig?.mapInteractionField || chartConfig?.xAxis?.field || config?.legendField;
        const candidateLayers = chartConfig?.mapInteraction?.allLayers || chartConfig?.sourcesFromVariants
            ? (state.layersGlobal?.length ? state.layersGlobal : [layer].filter(Boolean))
            : [layer].filter(Boolean);
        const legendCandidates = candidateLayers.filter(currentLayer => currentLayer && !currentLayer.__legendExcluded);
        const visibleLegendLayers = legendCandidates.filter(currentLayer => currentLayer && !currentLayer.destroyed && currentLayer.visible);
        const legendLayers = visibleLegendLayers.length ? visibleLegendLayers : legendCandidates.filter(Boolean);
        const legendBaseWhere = String(
            legendLayers[0]?.__legendBaseWhere ||
            layer?.__legendBaseWhere ||
            legendLayers[0]?.definitionExpression ||
            layer?.definitionExpression ||
            state.whereBase ||
            "1=1"
        ).trim() || "1=1";

        if (typeof buildFilteredLegendFromLayers === "function" && legendField) {
            const legendData = await buildFilteredLegendFromLayers({
                layers: legendLayers,
                field: legendField,
                where: legendBaseWhere,
                chartConfig
            });

            if (legendData) {
                actualizarLeyenda(legendData.labels, legendData.colors, legendData.codes, {
                    field: legendField,
                    baseWhere: legendBaseWhere,
                    layers: legendLayers,
                    symbols: legendData.symbols,
                    codeGroups: legendData.codeGroups,
                    preserveOrder: true
                });
                return;
            }
        }

        const legendData = buildLegendFromRenderer(layer.renderer, { chartConfig });
        if (legendData?.labels?.length) {
            actualizarLeyenda(legendData.labels, legendData.colors, legendData.codes, {
                field: legendField,
                baseWhere: legendBaseWhere,
                layers: legendLayers,
                symbols: legendData.symbols,
                codeGroups: legendData.codeGroups,
                preserveOrder: true
            });
        }
    }

    async function renderChart(layer, config, options) {
        if (typeof actualizarGrafica === "function") {
            await actualizarGrafica(layer, config, options);
            return;
        }

        console.warn("actualizarGrafica no definida");
    }

    function showUnavailableState(config, url) {
        const targetUrl = String(url || config?.url || "").trim();
        const serviceName = targetUrl.includes("componentesocioeconomico")
            ? "servicio socioeconomico"
            : "servicio de la capa";
        const message = `No se pudo cargar ${config?.title || "la capa"} porque el ${serviceName} no está disponible.`;

        const summaryDiv = document.getElementById("summaryDiv");
        if (summaryDiv) {
            summaryDiv.textContent = message;
        }

        setChartTitle(config?.chartConfig?.title || config?.title || "Distribución (%)");

        const canvas = document.getElementById("chart");
        if (!canvas || !config?.chartConfig) return;

        canvas.style.display = "block";
        canvas.style.visibility = "visible";
        canvas.style.opacity = "1";

        let status = document.getElementById("pibChartStatus");
        if (!status) {
            status = document.createElement("div");
            status.id = "pibChartStatus";
            status.className = "pib-chart-status";
            canvas.insertAdjacentElement("afterend", status);
        }

        status.textContent = `${message} Intenta nuevamente en unos minutos.`;
    }

    async function queryFeatureCountSafe(layer, where) {
        if (!layer?.queryFeatureCount) return null;
        try {
            await layer.when?.();
            return await layer.queryFeatureCount({ where: String(where || "1=1").trim() || "1=1" });
        } catch (error) {
            if (!isExpectedLayerError(error)) console.warn("No se pudo consultar conteo de entidades:", error);
            return null;
        }
    }

    function showDepartmentMapOnlyState(config, featureCount = null) {
        const canvas = document.getElementById("chart");
        const title = config?.chartConfig?.title || config?.title || "";
        const message = MUNICIPALITY_REQUIRED_CHART_MESSAGE;

        setChartTitle(title);

        if (canvas) {
            destroyCanvasChart(canvas);
            prepareVisibleChartCanvas(canvas, config?.chartConfig);
            setChartStatus(canvas, message);
            canvas.style.setProperty("display", "none", "important");
        }

        const summaryDiv = document.getElementById("summaryDiv");
        if (summaryDiv) summaryDiv.textContent = MUNICIPALITY_REQUIRED_SUMMARY_MESSAGE;
    }




    async function cargarCapaActual() {
        if (state.currentMainModule === "ORDENAMIENTO") {
            return;
        }
        state.renderCycleId++;
        const config = getActiveLayerConfig();
        if (!config) return;
        normalizeChartWhere(config);

        clearConnectivityDepartmentBoundary();
        clearConnectivityMunicipalityBoundary();
        clearLayers();

        // if (config.skipMapLayer) {
        //     state.layerGlobal = null;
        //     state.layersGlobal = [];
        //     state.chartLayerGlobal = null;
        //     window.activeFeatureLayer = null;
        //     setLegendLayer(null, config.title);
        //     updateMapViewBadge(config.title);
        //     deps.actualizarResumen();
        //     return;
        // }
        if (config.skipMapLayer) {
            state.layerGlobal = null;
            state.layersGlobal = [];
            state.chartLayerGlobal = null;
            window.activeFeatureLayer = null;

            setLegendLayer(null, config.title);
            updateMapViewBadge(config.title);
            deps.actualizarResumen();

            if (config.chartConfig && typeof actualizarGrafica === "function") {
                await renderChart(null, config);
            }

            return;
        }

        if (config.type === "table-layer" && config.mapFallback?.url) {
            const currentCycle = ++state.renderCycleId;
            (async () => {
                const mapUrl = config.mapFallback.url;
                const tableUrl = config.url || config.chartConfig?.serviceUrl;
                const mapDefinitionExpression = getMapWhereForConfig(config);
                const mapLayer = new FeatureLayer({
                    url: mapUrl,
                    definitionExpression: mapDefinitionExpression,
                    outFields: ["*"],
                    opacity: 0.8,
                    visible: true,
                    minScale: 0,
                    maxScale: 0
                });
                mapLayer.__sourceUrl = mapUrl;
                const tableLayer = new FeatureLayer({
                    url: tableUrl,
                    outFields: config.chartConfig?.fields || ["*"]
                });
                tableLayer.__sourceUrl = tableUrl;

                state.map.add(mapLayer);
                state.layerGlobal = mapLayer;
                state.layersGlobal = [mapLayer];
                state.chartLayerGlobal = tableLayer;
                window.activeFeatureLayer = mapLayer;
                setLegendLayer(mapLayer, config.mapFallback.title || config.title);
                updateLegend(mapLayer, config).catch(e => {
                    if (!isExpectedLayerError(e)) console.error("table-layer initial updateLegend error:", e);
                });
                updateMapViewBadge(config.title);
                actualizarFuente(mapLayer);
                deps.actualizarResumen();

                try {
                    await mapLayer.when?.();
                } catch (e) {
                    if (!isExpectedLayerError(e)) console.error("table-layer map when error:", e);
                }

                if (currentCycle !== state.renderCycleId || state.layerGlobal !== mapLayer || mapLayer.destroyed) return;
                if (config !== getActiveLayerConfig()) return;

                await ensureConnectivityBoundary(config);
                if (currentCycle !== state.renderCycleId || state.layerGlobal !== mapLayer || mapLayer.destroyed) return;
                if (config !== getActiveLayerConfig()) return;

                try {
                    const target = isDepartmentContextConfig(config) || useDepartmentMapContextForMunicipality(config)
                        ? (await queryConnectivityNavigationExtent(config, mapLayer))?.extent
                        : await queryLayerNavigationTarget(mapLayer, mapDefinitionExpression);
                    if (currentCycle !== state.renderCycleId || state.layerGlobal !== mapLayer || mapLayer.destroyed) return;
                    if (target) await state.view.goTo(target, { duration: 700 });
                } catch (e) {
                    if (!isExpectedLayerError(e)) console.error("table-layer map extent error:", e);
                }

                if (currentCycle !== state.renderCycleId || state.layerGlobal !== mapLayer || mapLayer.destroyed) return;
                if (config !== getActiveLayerConfig()) return;

                try {
                    await updateLegend(mapLayer, config);
                } catch (e) {
                    if (!isExpectedLayerError(e)) console.error("table-layer updateLegend error:", e);
                }

                if (currentCycle !== state.renderCycleId || state.layerGlobal !== mapLayer || mapLayer.destroyed) return;
                if (config !== getActiveLayerConfig()) return;

                try {
                    await tableLayer.when?.();
                } catch (e) {
                    if (!isExpectedLayerError(e)) console.error("table-layer table when error:", e);
                }

                if (currentCycle !== state.renderCycleId || state.layerGlobal !== mapLayer || mapLayer.destroyed) return;
                if (config !== getActiveLayerConfig()) return;

                if (isMapOnlyDepartmentConfig(config)) {
                    const count = await queryFeatureCountSafe(mapLayer, mapLayer.definitionExpression || state.whereBase);
                    showDepartmentMapOnlyState(config, count);
                } else {
                    try {
                        await renderChart(tableLayer, config, {
                            skipSyncMap: useDepartmentMapContextForMunicipality(config)
                        });
                    } catch (e) {
                        if (!isExpectedLayerError(e)) console.error("table-layer renderChart error:", e);
                    }
                }

                if (currentCycle !== state.renderCycleId || state.layerGlobal !== mapLayer || mapLayer.destroyed) return;
                if (config !== getActiveLayerConfig()) return;

                if (config.forceRendererLegend) {
                    try {
                        await updateLegend(mapLayer, config);
                    } catch (e) {
                        if (!isExpectedLayerError(e)) console.error("table-layer post-render updateLegend error:", e);
                    }
                }

                if (config.chartConfig?.type !== "greenBusinessFloatingBar") {
                    deps.actualizarResumen();
                }
            })();

            return;
        }

        if (config.mapLayerUrl && config.url && config.mapLayerUrl !== config.url) {
            const currentCycle = ++state.renderCycleId;
            (async () => {
                const mapUrl = config.mapLayerUrl;
                const chartUrl = config.url || config.chartConfig?.serviceUrl;
                const mapDefinitionExpression = getMapWhereForConfig(config);
                const mapLayer = new FeatureLayer({
                    url: mapUrl,
                    definitionExpression: mapDefinitionExpression,
                    outFields: ["*"],
                    opacity: 0.8,
                    visible: true,
                    minScale: 0,
                    maxScale: 0
                });
                mapLayer.__sourceUrl = mapUrl;
                mapLayer.__legendLayerKey = mapUrl;
                mapLayer.__legendHeading = config.mapLayerLegendHeading || config.chartConfig?.legendHeading || config.title;
                mapLayer.__legendSectionOrder = Number(config.mapLayerLegendOrder ?? 999);
                if (config.mapLayerDrawOrder != null) {
                    mapLayer.__mapDrawOrder = Number(config.mapLayerDrawOrder);
                }
                const supplementaryLayerConfigs = [
                    ...(config.supplementaryMapLayers || []),
                    ...(config.supplementaryMapLayerUrls || []).map(url => ({ url }))
                ];
                const supplementaryMapLayers = supplementaryLayerConfigs
                    .filter(item => item?.url && item.url !== mapUrl)
                    .map((item, index) => {
                        const supplementaryLayer = new FeatureLayer({
                            url: item.url,
                            definitionExpression: mapDefinitionExpression,
                            outFields: ["*"],
                            opacity: 0.8,
                            visible: true,
                            minScale: 0,
                            maxScale: 0
                        });
                        supplementaryLayer.__sourceUrl = item.url;
                        supplementaryLayer.__legendLayerKey = item.url;
                        supplementaryLayer.__legendHeading = item.legendHeading || item.title || `${config.title || "Capa suplementaria"} ${index + 1}`;
                        supplementaryLayer.__legendSectionOrder = Number(item.legendOrder ?? index + 1);
                        if (item.drawOrder != null) {
                            supplementaryLayer.__mapDrawOrder = Number(item.drawOrder);
                        }
                        supplementaryLayer.title = item.title || supplementaryLayer.__legendHeading;
                        return supplementaryLayer;
                    });
                const chartLayer = new FeatureLayer({
                    url: chartUrl,
                    outFields: config.chartConfig?.fields || ["*"]
                });
                chartLayer.__sourceUrl = chartUrl;

                const drawLayers = [mapLayer, ...supplementaryMapLayers];
                const hasExplicitDrawOrder = drawLayers.some(layer => Number.isFinite(Number(layer.__mapDrawOrder)));
                const orderedDrawLayers = hasExplicitDrawOrder
                    ? [...drawLayers].sort((a, b) => Number(a.__mapDrawOrder ?? 0) - Number(b.__mapDrawOrder ?? 0))
                    : drawLayers;
                orderedDrawLayers.forEach(layer => state.map.add(layer));
                state.layerGlobal = mapLayer;
                state.layersGlobal = [mapLayer, ...supplementaryMapLayers];
                state.chartLayerGlobal = chartLayer;
                window.activeFeatureLayer = mapLayer;
                setLegendLayer(mapLayer, config.title);
                updateLegend(mapLayer, config).catch(e => {
                    if (!isExpectedLayerError(e)) console.error("dual-layer initial updateLegend error:", e);
                });
                updateMapViewBadge(config.title);
                actualizarFuente(mapLayer);
                deps.actualizarResumen();

                try {
                    await mapLayer.when?.();
                } catch (e) {
                    if (!isExpectedLayerError(e)) console.error("dual-layer map when error:", e);
                }
                supplementaryMapLayers.forEach(layer => {
                    layer.when?.().catch(error => {
                        if (!isExpectedLayerError(error)) console.warn("No se pudo cargar capa suplementaria:", error);
                    });
                });

                if (currentCycle !== state.renderCycleId || state.layerGlobal !== mapLayer || mapLayer.destroyed) return;
                if (!isStillActiveConfig(config)) return;

                await ensureConnectivityBoundary(config);
                if (currentCycle !== state.renderCycleId || state.layerGlobal !== mapLayer || mapLayer.destroyed) return;
                if (!isStillActiveConfig(config)) return;

                try {
                    const target = isDepartmentContextConfig(config) || useDepartmentMapContextForMunicipality(config)
                        ? (await queryConnectivityNavigationExtent(config, mapLayer))?.extent
                        : await queryLayerNavigationTarget(mapLayer, mapDefinitionExpression);
                    if (currentCycle !== state.renderCycleId || state.layerGlobal !== mapLayer || mapLayer.destroyed) return;
                    if (target) await state.view.goTo(target, { duration: 700 });
                } catch (e) {
                    if (!isExpectedLayerError(e)) console.error("dual-layer map extent error:", e);
                }

                if (currentCycle !== state.renderCycleId || state.layerGlobal !== mapLayer || mapLayer.destroyed) return;
                if (!isStillActiveConfig(config)) return;

                if (supplementaryMapLayers.length) {
                    await Promise.allSettled(supplementaryMapLayers.map(currentLayer => currentLayer.when?.() || Promise.resolve()));
                }

                if (currentCycle !== state.renderCycleId || state.layerGlobal !== mapLayer || mapLayer.destroyed) return;
                if (!isStillActiveConfig(config)) return;

                try {
                    await updateLegend(mapLayer, config);
                } catch (e) {
                    if (!isExpectedLayerError(e)) console.error("dual-layer updateLegend error:", e);
                }

                if (currentCycle !== state.renderCycleId || state.layerGlobal !== mapLayer || mapLayer.destroyed) return;
                if (!isStillActiveConfig(config)) return;

                try {
                    await chartLayer.when?.();
                } catch (e) {
                    if (!isExpectedLayerError(e)) console.error("dual-layer chart when error:", e);
                }

                if (currentCycle !== state.renderCycleId || state.layerGlobal !== mapLayer || mapLayer.destroyed) return;
                if (!isStillActiveConfig(config)) return;

                if (isMapOnlyDepartmentConfig(config)) {
                    const count = await queryFeatureCountSafe(mapLayer, mapLayer.definitionExpression || state.whereBase);
                    showDepartmentMapOnlyState(config, count);
                } else {
                    try {
                        await renderChart(chartLayer, config, {
                            skipSyncMap: useDepartmentMapContextForMunicipality(config)
                        });
                    } catch (e) {
                        if (!isExpectedLayerError(e)) console.error("dual-layer renderChart error:", e);
                    }
                }

                if (currentCycle !== state.renderCycleId || state.layerGlobal !== mapLayer || mapLayer.destroyed) return;
                if (!isStillActiveConfig(config)) return;

                if (config.forceRendererLegend) {
                    try {
                        await updateLegend(mapLayer, config);
                    } catch (e) {
                        if (!isExpectedLayerError(e)) console.error("dual-layer post-render updateLegend error:", e);
                    }
                }

                deps.actualizarResumen();
            })();

            return;
        }

        if (Array.isArray(config.variants) && config.variants.length) {
            const currentCycle = state.renderCycleId;
            (async () => {
                const initialMapWhere = getConnectivityMapWhere(config);
                const initialLegendWhere = String(state.whereBase || "1=1").trim() || "1=1";
                const availableVariants = [];
                for (const variant of config.variants.filter(item => item?.url)) {
                    if (await isServiceAvailable(variant.url)) {
                        availableVariants.push(variant);
                    }
                }

                if (currentCycle !== state.renderCycleId) return;
                if (config !== getActiveLayerConfig()) return;

                const variantEntries = availableVariants.flatMap(variant => {
                    const initialPibVariantKey = window.__pibMapVariantKey || config.chartVariantKey || variant.key;
                    const variantShouldBeVisible = config.key === "PIB_DEPARTMENT"
                        ? variant.key === initialPibVariantKey
                        : true;
                    const createVariantLayer = (role = "default") => {
                        const usesPibDepartmentContext = usePibDepartmentContextForMunicipality(config, variant.key);
                        return new FeatureLayer({
                            url: variant.url,
                            definitionExpression: usesPibDepartmentContext
                                ? getPibDepartmentContextWhere()
                                : getConnectivityLayerWhere(config, role),
                            outFields: config.outFields || ["*"],
                            visible: variantShouldBeVisible,
                            minScale: variant.minScale ?? 0,
                            maxScale: variant.maxScale ?? 0,
                            opacity: 0.7
                        });
                    };

                    const usesConnectivityMunicipalitySplit = isConnectivityConfig(config) && state.filtroNivel === "MUNI";
                    const layer = createVariantLayer(usesConnectivityMunicipalitySplit ? "context" : "default");
                    layer.__variantKey = variant.key;
                    layer.__connectivityRole = usesConnectivityMunicipalitySplit ? "context" : "default";
                    layer.__legendExcluded = usesConnectivityMunicipalitySplit;
                    layer.__legendBaseWhere = initialLegendWhere;
                    // ArcGIS normalizes FeatureLayer.url to the MapServer root; keep the configured
                    // sublayer URL so chart/legend sync can identify the correct variant.
                    layer.__sourceUrl = variant.url;
                    state.map.add(layer);

                    layer.when?.(() => {
                        applyVariantLabeling(layer, variant);
                    }).catch(() => { });

                    if (!usesConnectivityMunicipalitySplit) {
                        return [{ key: variant.key, layer, role: layer.__connectivityRole }];
                    }

                    const municipalityLayer = createVariantLayer("municipality");
                    municipalityLayer.__variantKey = variant.key;
                    municipalityLayer.__connectivityRole = "municipality";
                    municipalityLayer.__legendBaseWhere = initialLegendWhere;
                    municipalityLayer.__sourceUrl = variant.url;
                    state.map.add(municipalityLayer);

                    municipalityLayer.when?.(() => {
                        applyVariantLabeling(municipalityLayer, variant);
                    }).catch(() => { });

                    return [
                        { key: variant.key, layer, role: "context" },
                        { key: variant.key, layer: municipalityLayer, role: "municipality" }
                    ];
                });

                if (window.__SOCIOECONOMICO_DEBUG__ === true) console.info("connectivity:variant-layers-created", {
                    mode: state.currentMode,
                    title: config.title,
                    whereBase: state.whereBase || "1=1",
                    mapWhere: initialMapWhere,
                    variants: variantEntries.map(entry => ({
                        key: entry.key,
                        url: entry.layer?.__sourceUrl || entry.layer?.url || "",
                        visible: entry.layer?.visible,
                        definitionExpression: entry.layer?.definitionExpression || ""
                    }))
                });

                state.layersGlobal = variantEntries.map(entry => entry.layer);
                if (window.__SOCIOECONOMICO_DEBUG__ === true) window.__debugLayers = state.layersGlobal;
                const initialActiveVariantKey = config.key === "PIB_DEPARTMENT"
                    ? (window.__pibMapVariantKey || config.chartVariantKey || variantEntries[0]?.key)
                    : null;
                state.layerGlobal = isConnectivityConfig(config)
                    ? (variantEntries.find(entry => entry.role === "municipality")?.layer || state.layersGlobal[0] || null)
                    : config.key === "PIB_DEPARTMENT"
                    ? (variantEntries.find(entry => entry.key === initialActiveVariantKey)?.layer || variantEntries.find(entry => entry.layer?.visible)?.layer || state.layersGlobal[0] || null)
                    : (state.layersGlobal[0] || null);
                window.activeFeatureLayer = state.layerGlobal;

                if (!state.layerGlobal) {
                    setLegendLayer(null, config.title);
                    updateMapViewBadge(config.title);
                    showUnavailableState(config, (config.variants || [])[0]?.url || "");
                    deps.actualizarResumen();
                    return;
                }

                setLegendLayer(state.layerGlobal, config.title);
                updateMapViewBadge(config.title);
                actualizarFuente(state.layerGlobal);
                deps.actualizarResumen();

                state.view.whenLayerView(state.layerGlobal)
                    .then(layerView => {
                        state.layerViewGlobal = layerView;
                        layerView.filter = null;
                    })
                    .catch(e => {
                        if (String(e?.name || "").includes("cancelled:layerview-create")) return;
                        if (String(e?.message || "").toLowerCase().includes("cancelled")) return;
                        if (isExpectedLayerError(e) || String(e?.name || "").includes("layerview:create-error")) return;
                        console.error("whenLayerView error:", e);
                    });

                const results = await Promise.allSettled(variantEntries.map(entry =>
                    entry.layer.when?.() || Promise.resolve()
                ));
                if (currentCycle !== state.renderCycleId) return;
                if (config !== getActiveLayerConfig()) return;
                const loadedEntries = variantEntries.filter((entry, index) =>
                    results[index]?.status === "fulfilled"
                );
                if (loadedEntries.length) {
                    state.layersGlobal = loadedEntries.map(entry => entry.layer);
                    if (window.__SOCIOECONOMICO_DEBUG__ === true) window.__debugLayers = state.layersGlobal;
                    const loadedActiveVariantKey = config.key === "PIB_DEPARTMENT"
                        ? (window.__pibMapVariantKey || config.chartVariantKey || loadedEntries[0]?.key)
                        : null;
                    state.layerGlobal = isConnectivityConfig(config)
                        ? (loadedEntries.find(entry => entry.role === "municipality")?.layer || state.layersGlobal[0] || null)
                        : config.key === "PIB_DEPARTMENT"
                        ? (loadedEntries.find(entry => entry.key === loadedActiveVariantKey)?.layer || loadedEntries.find(entry => entry.layer?.visible)?.layer || state.layersGlobal[0] || null)
                        : (state.layersGlobal[0] || null);
                    window.activeFeatureLayer = state.layerGlobal;
                }

                if (!loadedEntries.length) {
                    setLegendLayer(null, config.title);
                    updateMapViewBadge(config.title);
                    showUnavailableState(config, (config.variants || [])[0]?.url || config.url || "");
                    deps.actualizarResumen();
                    return;
                }

                if (currentCycle !== state.renderCycleId || !state.layerGlobal || state.layerGlobal.destroyed) return;
                if (config !== getActiveLayerConfig()) return;

                await ensureConnectivityBoundary(config);
                if (currentCycle !== state.renderCycleId || !state.layerGlobal || state.layerGlobal.destroyed) return;
                if (config !== getActiveLayerConfig()) return;

                try {
                    const navigationTarget = await queryConnectivityNavigationExtent(config, state.layerGlobal);
                    const extent = navigationTarget?.extent;
                    if (window.__SOCIOECONOMICO_DEBUG__ === true) console.info("connectivity:query-extent", {
                        title: config.title,
                        layerUrl: navigationTarget?.layerUrl || state.layerGlobal?.__sourceUrl || state.layerGlobal?.url || "",
                        where: navigationTarget?.where || "",
                        hasExtent: Boolean(extent)
                    });
                    if (currentCycle !== state.renderCycleId || !state.layerGlobal || state.layerGlobal.destroyed) return;
                    if (config !== getActiveLayerConfig()) return;
                    if (extent) await state.view.goTo(typeof extent.expand === "function" ? extent.expand(1.2) : extent);
                } catch (e) {
                    if (!isExpectedLayerError(e)) {
                        console.error("queryExtent error:", e);
                    }
                }

                const activeChartVariantKey = config.key === "PIB_DEPARTMENT"
                    ? (window.__pibMapVariantKey || config.chartVariantKey)
                    : config.chartVariantKey;
                const chartLayer = activeChartVariantKey
                    ? (loadedEntries.find(entry =>
                        entry.key === activeChartVariantKey &&
                        (!isConnectivityConfig(config) || entry.role === "municipality")
                    )?.layer || loadedEntries.find(entry => entry.key === activeChartVariantKey)?.layer || state.layerGlobal)
                    : state.layerGlobal;
                if (config !== getActiveLayerConfig()) return;
                state.chartLayerGlobal = chartLayer;

                const chartUsesConnectivityViews = Boolean(config?.chartConfig?.supplementaryCharts?.length);
                if (config.key === "PIB_DEPARTMENT" && typeof deps.renderActivePibSubitem === "function") {
                    deps.renderActivePibSubitem(0);
                } else if (chartUsesConnectivityViews && typeof deps.renderActiveChartSoon === "function") {
                    deps.renderActiveChartSoon(0);
                } else {
                    try {
                        await renderChart(chartLayer, config);
                    } catch (e) {
                        if (isExpectedLayerError(e)) return;
                        console.error("renderChart error:", e);
                    }

                    try {
                        await updateLegend(state.layerGlobal, config);
                    } catch (e) {
                        if (isExpectedLayerError(e)) return;
                        console.error("updateLegend error:", e);
                    }
                }

                deps.actualizarResumen();
            })();

            return;
        }

        const currentCycle = ++state.renderCycleId;
        (async () => {
            const mapPriority = prioritizesMapRendering(config);
            const mapLoadStartedAt = performance.now();
            let resolveMapReady = null;
            if (mapPriority) {
                window.__economicMapRenderReadyPromise = new Promise(resolve => {
                    resolveMapReady = resolve;
                });
            }

            const serviceAvailable = mapPriority ? true : await isServiceAvailable(config.url);
            if (currentCycle !== state.renderCycleId) {
                resolveMapReady?.();
                return;
            }
            if (!serviceAvailable) {
                resolveMapReady?.();
                setLegendLayer(null, config.title);
                updateMapViewBadge(config.title);
                showUnavailableState(config, config.url);
                deps.actualizarResumen();
                return;
            }

            const mapDefinitionExpression = getMapWhereForConfig(config);
            const newLayer = new FeatureLayer({
                url: config.url,
                definitionExpression: mapDefinitionExpression,
                outFields: config.outFields || ["*"],
                opacity: 0.8,
                visible: true,
                minScale: 0,
                maxScale: 0
            });
            newLayer.__sourceUrl = config.url;

            state.map.add(newLayer);
            state.layerGlobal = newLayer;
            state.layersGlobal = [newLayer];
            window.activeFeatureLayer = newLayer;
            setLegendLayer(newLayer, config.title);
            updateMapViewBadge(config.title);
            actualizarFuente(newLayer);
            newLayer.__mapPriorityReady = !mapPriority;
            if (mapPriority) {
                if (window.__SOCIOECONOMICO_DEBUG__ === true) window.__mapPerformanceMetrics = {
                    key: config.key,
                    where: newLayer.definitionExpression || "1=1",
                    layerAddedMs: Math.round(performance.now() - mapLoadStartedAt),
                    firstRenderMs: null
                };
                if (window.__SOCIOECONOMICO_DEBUG__ === true) console.info("map-performance:layer-added", window.__mapPerformanceMetrics);
            }

            // estaciones SOLO en temp/precip
            if (state.currentMode === "CLIMA" && config.isClima && (config.climaType === "temp" || config.climaType === "precip")) {
                const st = ensureStationsLayer();
                st.definitionExpression = state.whereBase;
                state.map.add(st);
            }

            if (!mapPriority) deps.actualizarResumen();

            if (!mapPriority) {
                state.view.whenLayerView(newLayer)
                    .then(layerView => {
                        state.layerViewGlobal = layerView;
                        layerView.filter = null;
                    })
                    .catch(e => {
                        if (String(e?.name || "").includes("cancelled:layerview-create")) return;
                        if (String(e?.message || "").toLowerCase().includes("cancelled")) return;
                        if (isExpectedLayerError(e) || String(e?.name || "").includes("layerview:create-error")) return;
                        console.error("whenLayerView error:", e);
                    });
            }

            newLayer.when(async () => {
                if (currentCycle !== state.renderCycleId || state.layerGlobal !== newLayer || newLayer.destroyed) {
                    resolveMapReady?.();
                    return;
                }

                if (isDepartmentPopupOnlyConfig(config)) {
                    try {
                        await renderChart(newLayer, config, {
                            skipSyncMap: useDepartmentMapContextForMunicipality(config)
                        });
                    } catch (e) {
                        if (!isExpectedLayerError(e)) console.error("popup-only department chart setup error:", e);
                    }
                }

                if (config.forceRendererLegend) {
                    try {
                        await updateLegend(newLayer, config);
                    } catch (e) {
                        if (isExpectedLayerError(e)) return;
                        console.error("early updateLegend error:", e);
                    }
                }

                if (currentCycle !== state.renderCycleId || state.layerGlobal !== newLayer || newLayer.destroyed) return;

                await ensureConnectivityBoundary(config);
                if (currentCycle !== state.renderCycleId || state.layerGlobal !== newLayer || newLayer.destroyed) return;

                try {
                    const res = isDepartmentContextConfig(config) || useDepartmentMapContextForMunicipality(config)
                        ? { extent: (await queryConnectivityNavigationExtent(config, newLayer))?.extent }
                        : await newLayer.queryExtent({ where: getMapWhereForConfig(config) });

                    if (currentCycle !== state.renderCycleId || state.layerGlobal !== newLayer || newLayer.destroyed) {
                        resolveMapReady?.();
                        return;
                    }

                    if (res?.extent && !config.preserveMapView) {
                        await state.view.goTo(res.extent.expand(1.2));
                    }
                } catch (e) {
                    if (isExpectedLayerError(e)) {
                        resolveMapReady?.();
                        return;
                    }
                    console.error("queryExtent error:", e);
                }

                if (mapPriority) {
                    await waitForFirstMapRender(newLayer);
                    if (currentCycle !== state.renderCycleId || state.layerGlobal !== newLayer || newLayer.destroyed) {
                        resolveMapReady?.();
                        return;
                    }
                    newLayer.__mapPriorityReady = true;
                    resolveMapReady?.();
                    const firstRenderMs = Math.round(performance.now() - mapLoadStartedAt);
                    if (window.__mapPerformanceMetrics?.key === config.key) {
                        window.__mapPerformanceMetrics.firstRenderMs = firstRenderMs;
                    }
                    if (window.__SOCIOECONOMICO_DEBUG__ === true) console.info("map-performance:first-render", {
                        key: config.key,
                        elapsedMs: firstRenderMs,
                        where: newLayer.definitionExpression || "1=1"
                    });
                }

                if (config.isSuelos && config.suelosType === "orden" && typeof ensureOrdenSueloDict === "function") {
                    try {
                        await ensureOrdenSueloDict(config.url);
                    } catch (e) {
                        console.warn("No se pudo cargar dict orden suelo:", e);
                    }
                }

                if (currentCycle !== state.renderCycleId || state.layerGlobal !== newLayer || newLayer.destroyed) return;

                if (config.isGeoforma && config.isGeoformaDualChart && typeof ensureGeoformasDict === "function") {
                    try {
                        await ensureGeoformasDict(config.url);
                    } catch (e) {
                        console.warn("No se pudo cargar dict geoformas:", e);
                    }
                }

                if (currentCycle !== state.renderCycleId || state.layerGlobal !== newLayer || newLayer.destroyed) return;

                if (isMapOnlyDepartmentConfig(config)) {
                    const count = await queryFeatureCountSafe(newLayer, newLayer.definitionExpression || state.whereBase);
                    showDepartmentMapOnlyState(config, count);
                } else if (config.chartConfig?.renderExternally || config.key === "ECONOMIC_ACTIVITIES") {
                    window.renderActiveEconomicSubitem?.(0);
                } else {
                    try {
                        await renderChart(newLayer, config, {
                            skipSyncMap: useDepartmentMapContextForMunicipality(config)
                        });
                    } catch (e) {
                        if (isExpectedLayerError(e)) return;
                        console.error("renderChart error:", e);
                    }
                }

                if (currentCycle !== state.renderCycleId || state.layerGlobal !== newLayer || newLayer.destroyed) return;
                if (config !== getActiveLayerConfig()) return;

                try {
                    await updateLegend(newLayer, config);
                } catch (e) {
                    if (isExpectedLayerError(e)) return;
                    console.error("updateLegend error:", e);
                }

                if (mapPriority) deps.actualizarResumen();
            }).catch(e => {
                resolveMapReady?.();
                if (!isExpectedLayerError(e)) {
                    console.error("layer when error:", e);
                }
                if (currentCycle !== state.renderCycleId || state.layerGlobal !== newLayer) return;
                setLegendLayer(null, config.title);
                updateMapViewBadge(config.title);
                showUnavailableState(config, config.url);
                deps.actualizarResumen();
            });
            if (state.scaleHandle) {
                state.scaleHandle.remove();
                state.scaleHandle = null;
            }

            state.scaleHandle = state.view.watch("stationary", (isStationary) => {
                if (!isStationary) return;
                if (!state.layerGlobal || state.layerGlobal !== newLayer) return;
                if (mapPriority && !newLayer.__mapPriorityReady) return;

                const cfg = getActiveLayerConfig();
                if (cfg && typeof state.updateLegendByExtent === "function") {
                    state.updateLegendByExtent(newLayer, cfg);
                }
            });
        })();




    }

    async function cargarOrdenamientoActual() {
        clearLayers();

        const config = ORDENAMIENTO_CONFIG[state.currentOrdenamientoTab];
        if (!config) return;


        let whereOrdenamiento = "1=1";

        const filterField = config.filterField || "mpcodigo";

        if (state.municipioActual) {
            whereOrdenamiento = `${filterField} = '${String(state.municipioActual).replace(/'/g, "''")}'`;
        } else if (state.filtroNivel === "DEPTO" && state.deptoActual) {
            if (config.deptoFilterField) {
                whereOrdenamiento = `${config.deptoFilterField} = '${String(state.deptoActual).replace(/'/g, "''")}'`;
            } else if (
                filterField.toLowerCase() === "mpcodigo" ||
                filterField.toLowerCase() === "mp_codigo"
            ) {
                whereOrdenamiento = `SUBSTRING(${filterField},1,2) = '${String(state.deptoActual).replace(/'/g, "''")}'`;
            }
        }
        const currentCycle = ++state.renderCycleId;
        const newLayer = new FeatureLayer({
            url: config.url,
            definitionExpression: whereOrdenamiento,
            outFields: config.outFields || ["*"],
            opacity: 0.85,
            visible: true
        });

        state.map.add(newLayer);
        state.layerGlobal = newLayer;
        window.activeFeatureLayer = newLayer;

        setLegendLayer(newLayer, config.title);
        updateMapViewBadge(config.title);
        const legendContent = document.getElementById("legendContent");
        if (legendContent) {
            legendContent.innerHTML = "";
        }
        window.__lastLegendRenderKey = "";
        state.legendFilterLabel = null;

        newLayer.when(async () => {
            if (currentCycle !== state.renderCycleId || state.layerGlobal !== newLayer || newLayer.destroyed) return;

            try {
                const res = await newLayer.queryExtent({ where: whereOrdenamiento });
                if (currentCycle !== state.renderCycleId || state.layerGlobal !== newLayer || newLayer.destroyed) return;

                if (res?.extent) {
                    await state.view.goTo(res.extent.expand(1.2));
                }
            } catch (e) {
                if (String(e?.name || "") === "AbortError") return;
                console.warn("No se pudo hacer zoom a la capa de ordenamiento:", e);
            }

            if (currentCycle !== state.renderCycleId || state.layerGlobal !== newLayer || newLayer.destroyed) return;

            if (config.ordenamientoType === "zonificacion_rural") {
                await renderZonificacionRuralCharts(newLayer, config, whereOrdenamiento);
                if (currentCycle !== state.renderCycleId || state.layerGlobal !== newLayer || newLayer.destroyed) return;

            } else if (config.ordenamientoType === "areas_actividad") {
                await renderAreasActividadCharts(newLayer, config, whereOrdenamiento);
                if (currentCycle !== state.renderCycleId || state.layerGlobal !== newLayer || newLayer.destroyed) return;

            } else if (config.ordenamientoType === "clasificacion_suelo") {
                await renderClasificacionSueloCharts(newLayer, config, whereOrdenamiento);
                if (currentCycle !== state.renderCycleId || state.layerGlobal !== newLayer || newLayer.destroyed) return;

            } else {
                await actualizarGrafica(newLayer, config, { skipSyncMap: true });
                if (currentCycle !== state.renderCycleId || state.layerGlobal !== newLayer || newLayer.destroyed) return;
            }

            if (
                typeof state.updateLegendByExtent === "function" &&
                config.ordenamientoType !== "areas_actividad" &&
                config.ordenamientoType !== "clasificacion_suelo" &&
                config.ordenamientoType !== "zonificacion_rural"
            ) {
                state.updateLegendByExtent(newLayer, config);
            }
        });
    }

    return {
        cargarCapaActual,
        cargarOrdenamientoActual
    };
}
