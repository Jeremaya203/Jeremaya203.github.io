/**
 * MapHighlighter.js — Resaltado de Features en el Mapa
 *
 * Maneja el highlight visual de features al hacer hover o click.
 *
 * Responsabilidad:
 *   - highlight(where): resalta features que coinciden con el WHERE
 *   - clearHighlight(): limpia el highlight actual
 *   - Manejar debounce para hover (evitar consultas excesivas)
 *
 * Dependencias:
 *   - State.js (para obtener view y layerGlobal)
 *   - ArcGIS JS API (highlight)
 */
export class MapHighlighter {
    constructor(state) {
        this.state = state;
        this.lastWhere = '';
        this.handle = null;
    }

    highlight(where) { }
    clear() { }
}
