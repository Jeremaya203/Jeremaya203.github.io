/**
 * biofisicoTerritory.loader.js
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
} from "./biofisicoQuery.service.js";
import { normalizeCode, sqlEquals } from "../utils/biofisicoFormat.utils.js";
import {
    renderDepartamentosSelect,
    renderMunicipiosSelect
} from "../ui/biofisicoTerritory.renderer.js";
import {
    getInitialBiofisicoModuleFromUrl,
    updateBiofisicoUrlByModule
} from "../events/biofisicoNavigation.events.js";

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

    async function actualizarFuente(layer) {
        fetchLayerSource(layer).then(fuente => {
            if (fuente) {
                const fuenteDiv = document.getElementById("mapSource");
                if (fuenteDiv) {
                    fuenteDiv.textContent = "Fuente: " + fuente;
                }
            }
        });
    }

    // ============ DICCIONARIOS ============

    async function cargarDiccionarioMunicipios() {
        try {
            const { municipios, departamentos } = await fetchMunicipalityDictionary();
            ctx.diccionarioMunicipios = municipios;
            ctx.diccionarioDepartamentos = departamentos;
        } catch (e) {
            console.error("Error cargando diccionario", e);
        }
    }

    // ============ INFO DE MUNICIPIO ============

    /**
     * Variable mutable local (no es parte del estado compartido,
     * es solo para el resumen textual).
     */
    let municipioInfo = null;

    async function cargarInfoMunicipio(codigo) {
        if (typeof hideTimeSlider === "function") {
            hideTimeSlider();
        }
        if (typeof setTimeSliderTouched === "function") {
            setTimeSliderTouched(false);
        }
        try {
            municipioInfo = await fetchMunicipalityInfo(codigo, { sqlEquals });
            actualizarResumen();
        } catch (e) {
            console.error("Error cargando info municipio", e);
            municipioInfo = null;
            actualizarResumen();
        }
    }

    async function actualizarResumen() {
        // El config se obtiene desde el estado (via ctx)
        // Pero getActiveLayerConfig es una función del scope de main
        // que debemos recibir como dependencia
        if (typeof actualizarResumenLocal === "function") {
            actualizarResumenLocal(municipioInfo);
        } else if (renderBiofisicoSummary) {
            const config = dependencies.getActiveLayerConfig?.();
            renderBiofisicoSummary({
                filtroNivel: ctx.filtroNivel,
                municipioActual: ctx.municipioActual,
                config,
                municipioInfo
            });
        }
    }

    // ============ CARGA DE MUNICIPIOS ============

    async function cargarMunicipios() {
        if (Object.keys(ctx.diccionarioMunicipios).length === 0) {
            await cargarDiccionarioMunicipios();
        }

        ctx.todosMunicipios = Object.keys(ctx.diccionarioMunicipios)
            .map(codigo => ({
                codigo,
                nombre: ctx.diccionarioMunicipios[codigo],
                depto: normalizeCode(codigo).substring(0, 2)
            }))
            .sort((a, b) => String(a.nombre || a.codigo).localeCompare(String(b.nombre || b.codigo), "es", { sensitivity: "base" }));

        if (ctx.todosMunicipios.length > 0) {
            cargarDepartamentos();
            renderizarMunicipios();
        }
    }

    function cargarDepartamentos() {
        const deptosUnicos = [...new Set(ctx.todosMunicipios.map(m => m.depto))].sort();
        renderDepartamentosSelect({
            departamentos: deptosUnicos,
            diccionarioDepartamentos: ctx.diccionarioDepartamentos
        });
    }

    function renderizarMunicipios(deptoFiltro = null) {
        renderMunicipiosSelect({
            municipios: ctx.todosMunicipios,
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
        ctx.municipioActual = "";
        ctx.deptoActual = "";
        ctx.filtroNivel = "";
        ctx.whereBase = "";
        municipioInfo = null;
        ctx.layerViewGlobal = null;
        ctx.chartLayerGlobal = null;
        ctx.lastHoverWhere = "";
        ctx.legendFilterLabel = null;
    }

    function clearMunicipioSelection() {
        const selectEl = document.getElementById("municipios");
        if (selectEl) selectEl.value = "";
        ctx.municipioActual = "";
        municipioInfo = null;
    }

    function clearTerritoryFilters() {
        ctx.filtroNivel = "";
        ctx.deptoActual = "";
        ctx.whereBase = "";
    }

    function setDepartamentoFilter(deptoSeleccionado) {
        ctx.deptoActual = deptoSeleccionado;
        ctx.filtroNivel = deptoSeleccionado && deptoSeleccionado !== "0" ? "DEPTO" : "";
    }

    function setMunicipioFilter(codigo) {
        ctx.filtroNivel = "MUNI";
        ctx.municipioActual = codigo;
        ctx.deptoActual = normalizeCode(codigo).substring(0, 2);
    }

    function hasTerritoryFilter() {
        return Boolean(ctx.municipioActual || (ctx.filtroNivel === "DEPTO" && ctx.deptoActual));
    }

    // ============ SELECT DE SUBLAYER POR DEPTO ============

    function selectDepartmentSubLayerForCurrentMode() {
        if (ctx.currentMode === "CLIMA") {
            const idxTempDepto = (LAYERS_CONFIG.CLIMA || [])
                .findIndex(l => l.id === "temperatura_depto");
            ctx.currentSubLayerIndex = (idxTempDepto >= 0) ? idxTempDepto : 0;
            return;
        }

        if (ctx.currentMode === "FENOMENOS") {
            const idxInuDepto = (LAYERS_CONFIG.FENOMENOS || [])
                .findIndex(l => l.id === "inundaciones_depto");
            ctx.currentSubLayerIndex = (idxInuDepto >= 0) ? idxInuDepto : 0;
            return;
        }

        const idxHipsoDepto = (LAYERS_CONFIG.RELIEVE || [])
            .findIndex(l => l.id === "hipsometria_depto");
        ctx.currentSubLayerIndex = (idxHipsoDepto >= 0) ? idxHipsoDepto : 0;
    }


    return {
        cargarDiccionarioMunicipios,
        cargarInfoMunicipio,
        cargarMunicipios,
        cargarDepartamentos,
        renderizarMunicipios,
        actualizarFuente,
        actualizarResumen,
        updateURLByModule,
        getInitialModuleFromURL,
        applyInitialModuleFromURL,
        resetSearchState,
        clearMunicipioSelection,
        clearTerritoryFilters,
        setDepartamentoFilter,
        setMunicipioFilter,
        hasTerritoryFilter,
        selectDepartmentSubLayerForCurrentMode,
        getMunicipioInfo: () => municipioInfo,
        setMunicipioInfo: (v) => { municipioInfo = v; }
    };
}
