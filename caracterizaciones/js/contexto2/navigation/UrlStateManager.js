/**
 * UrlStateManager.js — Sincronización del Estado con la URL
 *
 * Lee y escribe el estado (tab, municipioId, deptoId) en los
 * parámetros de la URL para permitir enlaces directos y
 * navegación con historia.
 *
 * Responsabilidad:
 *   - parse(): lee parámetros de la URL actual
 *   - apply(): aplica el estado de la URL a la app
 *   - sync(): escribe el estado actual en la URL
 *
 * Dependencias:
 *   - State.js, ModeConfig.js
 *   - ModuleNavigation global (moduleNavigation.js)
 */
export class UrlStateManager {
    constructor(state, modeConfig) {
        this.state = state;
        this.modeConfig = modeConfig;
    }

    parse() {
        const params = new URLSearchParams(window.location.search);
        return {
            tab: params.get('tab'),
            municipioId: params.get('id'),
            deptoId: params.get('depto')
        };
    }

    apply() {
        const urlParams = this.parse();
        if (urlParams.tab) {
            const mode = this.modeConfig.resolveFromTab(urlParams.tab);
            if (mode) this.state.currentMode = mode;
        }
    }
}
