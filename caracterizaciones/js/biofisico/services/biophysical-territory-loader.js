/**
 * biophysical-territory-loader.js
 * 
 * Módulo que encapsula toda la carga de datos territoriales:
 * - Diccionarios municipio/departamento
 * - Info de municipio
 * - Códigos de municipios desde FeatureLayer
 * - Renderizado de selects
 * - URL navigation helpers
 */

import {
    fetchLayerSource,
    fetchMunicipalityDictionary,
    fetchMunicipalityInfo
} from "./biophysical-query-service.js";
import { normalizeCode, sqlEquals } from "../utils/biophysical-format-utils.js";
import {
    renderDepartmentSelect,
    renderMunicipalitySelect
} from "../ui/biophysical-territory-renderer.js";
import {
    getInitialBiofisicoModuleFromUrl,
    updateBiofisicoUrlByModule
} from "../events/biophysical-navigation-events.js";

/**
 * Crea el loader territorial que opera sobre el contexto compartido (ctx).
 * Todas las propiedades de ctx son getters/setters a AppState.
 * 
 * @param {Object} ctx - BiofisicoContext (getters/setters a AppState)
 * @param {Object} dependencies - Dependencias 
 * @returns {Object} API del loader territorial
 */
export function createTerritoryLoader(ctx, dependencies = {}) {
    const {
        renderBiofisicoSummary,
        hideTimeSlider,
        setTimeSliderTouched,
        actualizarResumenLocal
    } = dependencies;

    // ============ HELPERS DE FUENTE ============

    async function updateSource(layer) {
        fetchLayerSource(layer).then(fuente => {
            if (fuente) {
                const sourceElement = document.getElementById("mapSource");
                if (sourceElement) {
                    sourceElement.textContent = "Fuente: " + fuente;
                }
            }
        });
    }

    // ============ DICCIONARIOS ============

    async function loadMunicipalityDictionary() {
        try {
            const { municipios, departamentos } = await fetchMunicipalityDictionary();
            ctx.municipalityNames = municipios;
            ctx.departmentNames = departamentos;
        } catch (e) {
            console.error("Error cargando diccionario", e);
        }
    }

    // ============ INFO DE MUNICIPIO ============

    /**
     * Variable mutable local (no es parte del estado compartido,
     * es solo para el resumen textual).
     */
    let municipalityInfo = null;

    async function loadMunicipalityInfo(codigo) {
        if (typeof hideTimeSlider === "function") {
            hideTimeSlider();
        }
        if (typeof setTimeSliderTouched === "function") {
            setTimeSliderTouched(false);
        }
        try {
            municipalityInfo = await fetchMunicipalityInfo(codigo, { sqlEquals });
            updateSummary();
        } catch (e) {
            console.error("Error cargando info municipio", e);
            municipalityInfo = null;
            updateSummary();
        }
    }

    async function updateSummary() {
        // El config se obtiene desde el estado (via ctx)
        // Pero getActiveLayerConfig es una función del scope de main
        // que debemos recibir como dependencia
        if (typeof actualizarResumenLocal === "function") {
            actualizarResumenLocal(municipalityInfo);
        } else if (renderBiofisicoSummary) {
            const config = dependencies.getActiveLayerConfig?.();
            renderBiofisicoSummary({
                territoryLevel: ctx.territoryLevel,
                currentMunicipalityId: ctx.currentMunicipalityId,
                config,
                municipalityInfo
            });
        }
    }

    // ============ CARGA DE MUNICIPIOS ============

    async function loadMunicipalities() {
        if (Object.keys(ctx.municipalityNames).length === 0) {
            await loadMunicipalityDictionary();
        }

        ctx.municipalities = Object.keys(ctx.municipalityNames)
            .map(codigo => ({
                codigo,
                nombre: ctx.municipalityNames[codigo],
                depto: normalizeCode(codigo).substring(0, 2)
            }))
            .sort((a, b) => String(a.nombre || a.codigo).localeCompare(String(b.nombre || b.codigo), "es", { sensitivity: "base" }));

        if (ctx.municipalities.length > 0) {
            loadDepartments();
            renderMunicipalities();
        }
    }

    function loadDepartments() {
        const uniqueDepartmentCodes = [...new Set(ctx.municipalities.map(m => m.depto))].sort();
        renderDepartmentSelect({
            departamentos: uniqueDepartmentCodes,
            departmentNames: ctx.departmentNames
        });
    }

    function renderMunicipalities(deptoFiltro = null) {
        renderMunicipalitySelect({
            municipios: ctx.municipalities,
            deptoFiltro
        });
    }

    // ============ URL NAVIGATION ============

    function updateURLByModule(module) {
        updateBiofisicoUrlByModule(module);
    }

    function getInitialModuleFromURL() {
        return getInitialBiofisicoModuleFromUrl();
    }

    function applyInitialModuleFromURL() {



        ctx.currentMode = "RELIEVE";
        updateMapViewBadge("Relieve");
    }

    // ============ RESET DE BUSQUEDA ============

    function resetSearchState() {
        ctx.currentMunicipalityId = "";
        ctx.currentDepartmentId = "";
        ctx.territoryLevel = "";
        ctx.whereBase = "";
        municipalityInfo = null;
        ctx.layerViewGlobal = null;
        ctx.chartLayerGlobal = null;
        ctx.lastHoverWhere = "";
        ctx.legendFilterLabel = null;
    }

    function clearMunicipalitySelection() {
        const selectEl = document.getElementById("municipios");
        if (selectEl) selectEl.value = "";
        ctx.currentMunicipalityId = "";
        municipalityInfo = null;
    }

    function clearTerritoryFilters() {
        ctx.territoryLevel = "";
        ctx.currentDepartmentId = "";
        ctx.whereBase = "";
    }

    function setDepartmentFilter(deptoSeleccionado) {
        ctx.currentDepartmentId = deptoSeleccionado;
        ctx.territoryLevel = deptoSeleccionado && deptoSeleccionado !== "0" ? "DEPTO" : "";
    }

    function setMunicipalityFilter(codigo) {
        ctx.territoryLevel = "MUNI";
        ctx.currentMunicipalityId = codigo;
        ctx.currentDepartmentId = normalizeCode(codigo).substring(0, 2);
    }

    function hasTerritoryFilter() {
        return Boolean(ctx.currentMunicipalityId || (ctx.territoryLevel === "DEPTO" && ctx.currentDepartmentId));
    }

    // ============ SELECT DE SUBLAYER POR DEPTO ============

    function selectDepartmentSubLayerForCurrentMode() {
        if (ctx.currentMode === "CLIMA") {
            const temperatureDepartmentIndex = (LAYERS_CONFIG.CLIMA || [])
                .findIndex(l => l.id === "temperatura_depto");
            ctx.currentSubLayerIndex = (temperatureDepartmentIndex >= 0) ? temperatureDepartmentIndex : 0;
            return;
        }

        if (ctx.currentMode === "FENOMENOS") {
            const floodDepartmentIndex = (LAYERS_CONFIG.FENOMENOS || [])
                .findIndex(l => l.id === "inundaciones_depto");
            ctx.currentSubLayerIndex = (floodDepartmentIndex >= 0) ? floodDepartmentIndex : 0;
            return;
        }

        const hypsometryDepartmentIndex = (LAYERS_CONFIG.RELIEVE || [])
            .findIndex(l => l.id === "hipsometria_depto");
        ctx.currentSubLayerIndex = (hypsometryDepartmentIndex >= 0) ? hypsometryDepartmentIndex : 0;
    }


    return {
        loadMunicipalityDictionary,
        loadMunicipalityInfo,
        loadMunicipalities,
        loadDepartments,
        renderMunicipalities,
        updateSource,
        updateSummary,
        updateURLByModule,
        getInitialModuleFromURL,
        applyInitialModuleFromURL,
        resetSearchState,
        clearMunicipalitySelection,
        clearTerritoryFilters,
        setDepartmentFilter,
        setMunicipalityFilter,
        hasTerritoryFilter,
        selectDepartmentSubLayerForCurrentMode,
        getMunicipioInfo: () => municipalityInfo,
        setMunicipioInfo: (v) => { municipalityInfo = v; }
    };
}
