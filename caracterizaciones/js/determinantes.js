import { escapeHtml, escapeHtmlWithBreaks, escapeSqlString, normalizeMunicipalityCode } from "./shared/security/security-utils.js";

// determinantes.js — Requerimiento 0: Contexto Legal > Determinantes
// Queries layer 19 (CL_DTS) and table 25 (CL_ADS) from componentecontextolegal
https://mapas2.igac.gov.co/server4/rest/services/ordenamiento/componentecontextolegal
const BASE_URL = "/MapServer";
const LAYER_DTS = `${BASE_URL}/19`; // CL_DTS (Determinantes - polygon layer)
const TABLE_ADS = `${BASE_URL}/25`; // CL_ADS (Analisis determinantes - table)

const DETERM_DOMAIN = {
    1: "1_Ambientales",
    2: "Soberanía Alimentaria",
    3: "3_Patrimoniales",
    4: "4_Infraestructura",
    5: "5_Áreas Metropolitanas y Suburbanización",
    6: "6_Proyectos Turísticos Especiales"
};

/**
 * Loads determinantes figuras for a given municipality code.
 * Filters by confactadm=1 (Si) and excludes determ=4 (Infraestructura).
 * Renders accordion in the target container.
 */
export async function cargarDeterminantes(mpcodigo, containerSelector = "#summaryDiv") {
    const container = document.querySelector(containerSelector);
    if (!container) return;

    const safeMunicipalityCode = normalizeMunicipalityCode(mpcodigo);

    if (!safeMunicipalityCode) {
        container.innerHTML = '<p class="oot-js-carac-determinantes-1">Seleccione un municipio para ver las determinantes.</p>';
        return;
    }

    container.innerHTML = '<p class="oot-js-carac-determinantes-1">Cargando determinantes...</p>';

    try {
        // Step 1: Query layer 19 for figuras matching this municipality
        const where = `mpcodigo = '${escapeSqlString(safeMunicipalityCode)}' AND confactadm = 1 AND determ <> 4`;
        const qUrl = `${LAYER_DTS}/query?where=${encodeURIComponent(where)}&outFields=iddts,nomdet,determ,actadm,descrip&returnGeometry=false&orderByFields=determ,nomdet&f=json`;
        const res = await fetch(qUrl).then(r => r.json());
        const features = res?.features || [];

        if (!features.length) {
            container.innerHTML = '<p class="oot-js-carac-determinantes-1">No se encontraron determinantes para este municipio.</p>';
            return;
        }

        // Deduplicate by iddts
        const seen = new Set();
        const figuras = [];
        for (const f of features) {
            const a = f.attributes;
            const id = a.iddts;
            if (!id || seen.has(id)) continue;
            seen.add(id);
            figuras.push({
                iddts: id,
                nomdet: a.nomdet || id,
                determ: a.determ,
                determLabel: DETERM_DOMAIN[a.determ] || `Tipo ${a.determ}`,
                actadm: a.actadm || "",
                descrip: a.descrip || ""
            });
        }

        // Step 2: Group by determ category
        const groups = {};
        for (const fig of figuras) {
            if (!groups[fig.determ]) {
                groups[fig.determ] = { label: fig.determLabel, items: [] };
            }
            groups[fig.determ].items.push(fig);
        }

        // Step 3: Render accordion HTML
        let html = '<div class="det-accordion">';

        for (const key of Object.keys(groups).sort((a, b) => Number(a) - Number(b))) {
            const group = groups[key];
            html += `<div class="det-group-title">${escapeHtml(group.label)}</div>`;

            for (const fig of group.items) {
                html += `
                <div class="det-item" data-iddts="${escapeHtml(fig.iddts)}">
                    <div class="det-item-header">
                        <span class="det-arrow">▶</span>
                        <span class="det-name">${escapeHtml(fig.nomdet)}</span>
                    </div>
                    <div class="det-item-body oot-js-carac-determinantes-2">
                        <p class="det-loading">Cargando...</p>
                    </div>
                </div>`;
            }
        }

        html += '</div>';
        container.innerHTML = html;

        // Step 4: Bind click events for accordion
        container.querySelectorAll(".det-item-header").forEach(header => {
            header.addEventListener("click", async function () {
                const item = this.closest(".det-item");
                const body = item.querySelector(".det-item-body");
                const arrow = item.querySelector(".det-arrow");
                const iddts = item.dataset.iddts;

                const isOpen = body.style.display !== "none";
                if (isOpen) {
                    body.style.display = "none";
                    arrow.textContent = "▶";
                    return;
                }

                body.style.display = "block";
                arrow.textContent = "▼";

                // Only fetch if not already loaded
                if (body.dataset.loaded) return;

                try {
                    const aUrl = `${TABLE_ADS}/query?where=${encodeURIComponent(`iddts = '${escapeSqlString(iddts)}'`)}&outFields=tcldnorm,tclanalisis&returnGeometry=false&f=json`;
                    const aRes = await fetch(aUrl).then(r => r.json());
                    const attrs = aRes?.features?.[0]?.attributes;

                    let content = "";
                    if (attrs?.tcldnorm) {
                        content += `<div class="det-section"><strong>Descripción normativa</strong><p>${escapeHtmlWithBreaks(attrs.tcldnorm)}</p></div>`;
                    }
                    if (attrs?.tclanalisis) {
                        content += `<div class="det-section"><strong>Análisis temático</strong><p>${escapeHtmlWithBreaks(attrs.tclanalisis)}</p></div>`;
                    }
                    if (!content) {
                        content = '<p class="det-empty">Sin descripción disponible.</p>';
                    }

                    body.innerHTML = content;
                    body.dataset.loaded = "1";
                } catch (e) {
                    body.innerHTML = '<p class="det-empty">Error al cargar información.</p>';
                    console.warn("No se pudo consultar el detalle de la determinante.");
                }
            });
        });

    } catch (e) {
        container.innerHTML = '<p class="oot-js-carac-determinantes-3">Error al consultar determinantes.</p>';
        console.error("cargarDeterminantes error:", e);
    }
}
