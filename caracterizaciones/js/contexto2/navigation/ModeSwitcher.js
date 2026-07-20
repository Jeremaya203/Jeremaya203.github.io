/**
 * ModeSwitcher.js — Cambio entre Modos de Contexto Legal
 *
 * Maneja el cambio entre modos (Determinantes, Condicionantes,
 * Ambientales, etc.) y coordina la actualización de UI, mapa y gráficos.
 *
 * Responsabilidad:
 *   - switchMode(mode): cambia el modo actual, resetea subtab index
 *   - Actualizar navbar, dropdown, badge y título
 *   - Emitir evento 'mode:changed' via EventBus
 *
 * Dependencias:
 *   - State.js, EventBus.js, ModeConfig.js
 *   - NavbarManager.js, DropdownManager.js, MapViewBadge.js
 */
export class ModeSwitcher {
    constructor(state, eventBus, modeConfig) {
        this.state = state;
        this.eventBus = eventBus;
        this.modeConfig = modeConfig;
    }

    switch(mode) {
        this.state.currentMode = mode;
        this.state.currentSubLayerIndex = 0;
        this.eventBus.emit('mode:changed', { mode });
    }
}
