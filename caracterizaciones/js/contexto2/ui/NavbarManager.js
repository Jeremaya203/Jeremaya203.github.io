/**
 * NavbarManager.js — Barra de Navegación Interna
 *
 * Maneja los botones de la navbar de Contexto Legal
 * (Determinantes, Condicionantes) y sincroniza el estado
 * activo.
 *
 * Responsabilidad:
 *   - init(): registra eventos click en btnDeterminantes y btnCondicionantes
 *   - setActive(mode): marca el botón activo según el modo
 *
 * Dependencias:
 *   - State.js, EventBus.js, ModeConfig.js
 */
export class NavbarManager {
    constructor(state, eventBus, modeConfig) {
        this.state = state;
        this.eventBus = eventBus;
        this.modeConfig = modeConfig;
    }

    init() { }
    setActive(mode) { }
}
