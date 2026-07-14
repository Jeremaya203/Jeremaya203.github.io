import {
            LAYERS_CONFIG,
            // ORDENAMIENTO_CONFIG,
            DEPTO_ONLY_LAYER_IDS,
            DEPT_TO_MUNI_LAYER_ID,
            // LEYENDA_RIESGO_CC,
            // coloresCondicionEcos,
            // condicionLabelToCode,
            // coloresPendientes,
            // pendientesLabelToCode
        } from "../config.js";
    
export let currentMode = 'PIB Y Valor agregado';
export let filtroNivel = ""; 
export let currentSubLayerIndex = 0;
    
    export function ensureMunicipalLayerIndex(prevId) {
            const list = getLayerListForCurrentLevel(currentMode);

            if (!list || list.length === 0) {
                currentSubLayerIndex = 0;
                return;
            }

            // Normalizar índice
            if (currentSubLayerIndex < 0 || currentSubLayerIndex >= list.length) {
                currentSubLayerIndex = 0;
            }

            // Si veníamos de una capa departamental intentar mapear a municipal
            const mappedId = prevId ? DEPT_TO_MUNI_LAYER_ID[prevId] : null;

            if (mappedId) {
                const idx = list.findIndex(l => l.id === mappedId);
                if (idx !== -1) {
                    currentSubLayerIndex = idx;
                    return;
                }
            }

            // Protección extra: evitar quedar en una capa departamental
            const cfg = list[currentSubLayerIndex];
            if (cfg && DEPTO_ONLY_LAYER_IDS.has(cfg.id)) {
                currentSubLayerIndex = 0;
            }
        }

export function getLayerListForCurrentLevel(mode = currentMode) {
        const list = LAYERS_CONFIG[mode] || [];

        // Si estoy filtrando por departamento -> SOLO las depto
        if (filtroNivel === "DEPTO") {
            return list.filter(l => DEPTO_ONLY_LAYER_IDS.has(l.id));
        }

        // Si estoy en municipio -> BLOQUEAR las depto
        if (filtroNivel === "MUNI") {
            return list.filter(l => !DEPTO_ONLY_LAYER_IDS.has(l.id));
        }

        // Si no hay nivel (inicio) -> por defecto NO mostrar las depto
        // (evita que se metan “por accidente” antes de escoger municipio)
        return list.filter(l => !DEPTO_ONLY_LAYER_IDS.has(l.id));
        }

export function clampSubLayerIndex() {
        const activeList = getLayerListForCurrentLevel();
        if (!activeList.length) {
            currentSubLayerIndex = 0;
            return;
        }
        if (currentSubLayerIndex < 0) currentSubLayerIndex = 0;
        if (currentSubLayerIndex >= activeList.length) currentSubLayerIndex = 0;
}



export function getActiveLayerConfig() {
            const list = getLayerListForCurrentLevel(currentMode);
            return (list && list[currentSubLayerIndex]) ? list[currentSubLayerIndex] : null;
        }

