import { getColorCSS } from "./colors.js";

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function ensureLegendStyles() {
    if (document.getElementById("limitesMunicipalLegendStyles")) return;

    const style = document.createElement("style");
    style.id = "limitesMunicipalLegendStyles";
    style.textContent = `
        .limites-legend-item {
            width: 100%;
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 4px;
            padding: 4px 5px;
            border: 1px solid transparent;
            border-radius: 6px;
            background: transparent;
            cursor: pointer;
            text-align: left;
            font-family: "Outfit", sans-serif;
        }
        .limites-legend-item:hover,
        .limites-legend-item.selected {
            background: rgba(214, 112, 54, 0.12);
            border-color: rgba(214, 112, 54, 0.45);
        }
        .limites-legend-item.inactive {
            opacity: 0.42;
        }
        .limites-legend-swatch {
            display: inline-block;
            width: 18px;
            height: 4px;
            border-radius: 2px;
            flex-shrink: 0;
        }
        .limites-legend-label {
            color: #333;
            font-size: 12px;
            line-height: 1.3;
        }
    `;
    document.head.appendChild(style);
}

/**
 * Construye la leyenda HTML a partir de los features (líneas limítrofes).
 * Cada ítem muestra el nombre de la línea con su color asignado.
 * @param {Array} features - Features obtenidos del query de la capa
 */
export function actualizarLeyendaLimitesMunicipales(features) {
    const title = document.getElementById("legendTitle");
    const content = document.getElementById("legendContent");

    if (title) title.textContent = "Líneas limítrofes";
    if (!content) return;
    ensureLegendStyles();

    if (!features || features.length === 0) {
        content.innerHTML = `<p style="margin:0; color:#666;">No hay líneas para mostrar</p>`;
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
        const llNombre = att["LLNombre"] || llIdentif || "Sin nombre";
        const color = getColorCSS(llIdentif);

        return `
            <button class="limites-legend-item active" type="button" data-llid="${escapeHtml(llIdentif)}" title="Mostrar u ocultar línea">
                <span class="limites-legend-swatch" style="background:${color};"></span>
                <span class="limites-legend-label">${escapeHtml(llNombre)}</span>
            </button>
        `;
    });

    content.innerHTML = items.join("");
}
