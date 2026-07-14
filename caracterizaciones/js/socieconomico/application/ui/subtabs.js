/**
 * ============================================================
 * SUBTABS CONTROLLER (SOCIOECONÓMICO)
 * ============================================================
 *
 * Este controlador se encarga de:
 *
 * 1. Generar dinámicamente los botones (subtabs) en la interfaz
 *    a partir de la configuración de capas (LAYERS_CONFIG).
 *
 * 2. Manejar la interacción del usuario:
 *    - Detectar qué botón se selecciona
 *    - Actualizar el estado actual (subLayerIndex)
 *
 * 3. Controlar el flujo visual y del mapa:
 *    - Ocultar controles innecesarios (time slider)
 *    - Recargar la capa correspondiente
 *    - Actualizar la leyenda del mapa
 *    - Actualizar el badge/título del mapa
 *
 * ------------------------------------------------------------
 * FLUJO GENERAL
 * ------------------------------------------------------------
 *
 * Dropdown → setCurrentMode()
 *          → renderSubTabs()
 *          → se crean botones dinámicos
 *
 * Click en botón:
 *          → setCurrentSubLayerIndex()
 *          → renderSubTabs() (refresca UI)
 *          → cargarCapaActual()
 *          → actualizar leyenda + badge
 *
 * ------------------------------------------------------------
 * DEPENDENCIAS (inyectadas)
 * ------------------------------------------------------------
 *
 * getLayerListForCurrentLevel(mode)
 *   → Retorna la lista de capas según el modo actual
 *
 * getCurrentMode()
 *   → Retorna el modo activo (ej: SOCIOECONOMIC_INFRASTRUCTURE)
 *
 * getCurrentSubLayerIndex()
 *   → Índice del botón activo
 *
 * setCurrentSubLayerIndex(idx)
 *   → Guarda el botón seleccionado
 *
 * cargarCapaActual()
 *   → Carga la capa en el mapa
 *
 * setLegendLayer(layer, title)
 *   → Actualiza la leyenda
 *
 * updateMapViewBadge(title)
 *   → Actualiza el título del mapa
 *
 * getLayerGlobal()
 *   → Retorna la capa actualmente cargada
 *
 * ------------------------------------------------------------
 * COMPORTAMIENTO CLAVE
 * ------------------------------------------------------------
 *
 * - Si no hay capas → no muestra botones
 * - Cada botón representa una capa/configuración
 * - El botón activo se resalta visualmente
 * - Solo carga capas si hay municipio o departamento seleccionado
 *
 * ============================================================
 */

export function createSubtabsController({
    getLayerListForCurrentLevel,
    getCurrentMode,
    getCurrentSubLayerIndex,
    setCurrentSubLayerIndex,
    hideTimeSlider,
    setTimeSliderTouched,
    cargarCapaActual,
    getMunicipioActual,
    getFiltroNivel,
    getDeptoActual,
    setLegendLayer,
    updateMapViewBadge,
    getLayerGlobal
}) {

    function renderSubTabs() {
        const container = document.getElementById("subtabsControls");
        if (!container) return;

        // Limpia los botones actuales
        container.innerHTML = "";

        // Obtiene la lista de capas según el modo actual
        const list = getLayerListForCurrentLevel(getCurrentMode()) || [];

        // Si no hay datos, oculta el contenedor
        if (!list.length) {
            container.style.display = "none";
            return;
        }

        container.style.display = "flex";

        // Crea un botón por cada capa/configuración
        list.forEach((cfg, idx) => {
            const btn = document.createElement("button");
            btn.type = "button";

            // Marca el botón activo
            btn.className =
                "subtab-btn" +
                (idx === getCurrentSubLayerIndex() ? " active" : "");

            // Texto del botón
            btn.textContent = cfg.title || `Capa ${idx + 1}`;

            // Evento click
            btn.onclick = async function () {
                await window.__clearSocioVisualState?.({
                    preservePibTabs: false,
                    preserveEconomicTabs: false,
                    preserveMainCanvas: false,
                    preserveSummary: false,
                    preserveLegend: false
                });

                // Oculta slider y reinicia interacción
                hideTimeSlider();
                setTimeSliderTouched(false);

                // Guarda selección
                setCurrentSubLayerIndex(idx);
                await window.__syncPovertyInitialTerritoryFromSelects?.(cfg);
                window.prepareChartPanelForConfig?.(cfg);

                // Re-render UI (actualiza botón activo)
                renderSubTabs();

                // Carga la capa en el mapa usando el filtro activo si existe
                cargarCapaActual();
                if (cfg.key === "ECONOMIC_ACTIVITIES") {
                    window.renderActiveEconomicSubitem?.(700);
                    window.renderActiveEconomicSubitem?.(1700);
                } else if (cfg.key === "PIB_DEPARTMENT") {
                    window.renderActivePibSubitem?.(700);
                    window.renderActivePibSubitem?.(1700);
                } else {
                    window.renderActiveChartSoon?.(700);
                    window.renderActiveChartSoon?.(1600);
                    window.renderActiveEconomicSubitem?.(0);
                }
                if (cfg.key !== "PIB_DEPARTMENT") {
                    window.renderPibSectorPieSoon?.(900);
                    window.renderPibEmpresasSoon?.(900);
                }

                // Actualiza leyenda y badge
                const layer = getLayerGlobal();

                if (layer && cfg.title) {
                    setLegendLayer(layer, cfg.title);
                    updateMapViewBadge(cfg.title);
                }
            };

            container.appendChild(btn);
        });
    }

    return { renderSubTabs };
}
