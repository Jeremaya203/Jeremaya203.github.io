import { getColorCSS } from "./colors.js";

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/**
 * Construye la leyenda HTML a partir de los features (líneas limítrofes).
 * Cada ítem muestra el nombre de la línea con su color asignado.
 * @param {Array} features - Features obtenidos del query de la capa
 */
export function updateMunicipalBoundaryLegend(features) {
    const title = document.getElementById("legendTitle");
    const content = document.getElementById("legendContent");

    if (title) title.textContent = "Líneas limítrofes";
    if (!content) return;

    if (!features || features.length === 0) {
        content.innerHTML = `<p class="oot-js-limites-legend-1">No hay líneas para mostrar</p>`;
        return;
    }

    const uniqueFeatures = [];
    const seen = new Set();
    (features || []).forEach(f => {
        const att = f.attributes || {};
        const key = String(att["LLIdentif"] || att["LLNombre"] || "");
        if (!key || seen.has(key)) return;
        seen.add(key);
        uniqueFeatures.push(f);
    });

    const items = uniqueFeatures.map((f, i) => {
        const att = f.attributes;
        const llIdentif = att["LLIdentif"];
        const boundaryName = att["LLNombre"] || llIdentif || "Sin nombre";
        const color = getColorCSS(llIdentif);

        return `
            <button class="limites-legend-item active" type="button" data-llid="${escapeHtml(llIdentif)}" title="Mostrar u ocultar línea">
                <span class="limites-legend-swatch" data-swatch-color="${color}"></span>
                <span class="limites-legend-label">${escapeHtml(boundaryName)}</span>
            </button>
        `;
    });

    content.innerHTML = items.join("");
    content.querySelectorAll(".limites-legend-swatch[data-swatch-color]").forEach(el => {
        el.style.background = el.dataset.swatchColor;
    });
}
