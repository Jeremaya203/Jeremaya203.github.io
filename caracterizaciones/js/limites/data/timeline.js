/**
 * Linea de tiempo para Limites Municipales.
 * Consulta oficios asociados a LLIdentif, agrupa por lloficioanno y renderiza
 * una linea de tiempo tipo chevron inspirada en la referencia de ocupacion.
 */

const TIMELINE_URL = "https://sigi.igac.gov.co/geografia/rest/services/ordenamiento/componentelineaslimitrofes/MapServer/3";
const LINEAS_URL = "https://mapas2.igac.gov.co/server/rest/services/limites/limites/MapServer/0";

const TIMELINE_FIELDS = [
    "llid",
    "lloficio",
    "lldescoficio",
    "llfuente",
    "lloficioanno",
    "lldesclim"
];

function esc(str) {
    return String(str ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function escAttr(str) {
    return esc(str)
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function cleanText(value, fallback = "") {
    const text = String(value ?? "").trim();
    return text || fallback;
}

function getAttr(attributes, fieldName) {
    if (!attributes || !fieldName) return undefined;
    if (Object.prototype.hasOwnProperty.call(attributes, fieldName)) return attributes[fieldName];

    const target = fieldName.toLowerCase();
    const key = Object.keys(attributes).find(name => name.toLowerCase() === target);
    return key ? attributes[key] : undefined;
}

function normalizeYear(value) {
    if (value === null || value === undefined) return "";

    const raw = String(value).trim();
    if (!raw) return "";

    const fourDigitYear = raw.match(/\b(18|19|20)\d{2}\b/);
    if (fourDigitYear) return fourDigitYear[0];

    const numeric = Number(raw.replace(",", "."));
    if (Number.isFinite(numeric) && numeric >= 1800 && numeric <= 2100) {
        return String(Math.trunc(numeric));
    }

    return "";
}

function sortYears(a, b) {
    if (a === "Sin a\u00f1o") return 1;
    if (b === "Sin a\u00f1o") return -1;

    const aNum = Number(a);
    const bNum = Number(b);
    if (Number.isFinite(aNum) && Number.isFinite(bNum)) return aNum - bNum;
    return String(a).localeCompare(String(b), "es");
}

function eventDescription(event) {
    return cleanText(event.lldescoficio, "Sin descripci\u00f3n");
}

function buildWhereIn(fieldName, values) {
    const unique = Array.from(new Set((values || []).filter(Boolean).map(String)));
    if (!unique.length) return "";

    return `${fieldName} IN (${unique.map(value => `'${value.replace(/'/g, "''")}'`).join(",")})`;
}

async function fetchJson(url) {
    const response = await fetch(url);
    const data = await response.json();
    if (data?.error) throw new Error(data.error.message || "Error consultando servicio");
    return data;
}

async function fetchLineNames(llIdentifs) {
    const where = buildWhereIn("LLIdentif", llIdentifs);
    if (!where) return {};

    const url = `${LINEAS_URL}/query?where=${encodeURIComponent(where)}` +
        "&outFields=LLIdentif,LLNombre&returnGeometry=false&f=json";

    try {
        const data = await fetchJson(url);
        const names = {};

        (data.features || []).forEach(feature => {
            const attributes = feature.attributes || {};
            const id = getAttr(attributes, "LLIdentif");
            if (id) names[String(id)] = cleanText(getAttr(attributes, "LLNombre"), String(id));
        });

        return names;
    } catch (error) {
        console.warn("No se pudieron consultar nombres de lineas limitrofes:", error);
        return {};
    }
}

function groupTimelineFeatures(features, lineNames) {
    const grouped = {};

    (features || []).forEach(feature => {
        const attributes = feature.attributes || {};
        const llid = cleanText(getAttr(attributes, "llid"));
        const year = normalizeYear(getAttr(attributes, "lloficioanno")) || "Sin a\u00f1o";
        const lineDescription = cleanText(getAttr(attributes, "lldesclim"));
        const lineName = cleanText(
            lineNames[String(llid)] || getAttr(attributes, "LLNombre"),
            llid || "Sin nombre"
        );

        if (!grouped[year]) grouped[year] = [];

        grouped[year].push({
            llid,
            LLNombre: lineName,
            lldesclim: lineDescription,
            lloficio: cleanText(getAttr(attributes, "lloficio")),
            lldescoficio: cleanText(getAttr(attributes, "lldescoficio")),
            llfuente: cleanText(getAttr(attributes, "llfuente")),
            lloficioanno: year
        });
    });

    Object.keys(grouped).forEach(year => {
        grouped[year].sort((a, b) => {
            return cleanText(a.lloficio, "").localeCompare(cleanText(b.lloficio, ""), "es");
        });
    });

    return grouped;
}

/**
 * Consulta los oficios/documentos asociados a una lista de LLIdentif.
 */
export async function fetchTimelineData(llIdentifs, options = {}) {
    const ids = Array.from(new Set((llIdentifs || []).filter(Boolean).map(String)));
    if (!ids.length) return {};

    const where = buildWhereIn("llid", ids);
    const url = `${TIMELINE_URL}/query?where=${encodeURIComponent(where)}` +
        `&outFields=${encodeURIComponent(TIMELINE_FIELDS.join(","))}` +
        "&returnGeometry=false&orderByFields=lloficioanno ASC,lloficio ASC&f=json";

    try {
        const providedLineNames = options.lineNames || null;
        const [timelineData, lineNames] = await Promise.all([
            fetchJson(url),
            providedLineNames ? Promise.resolve(providedLineNames) : fetchLineNames(ids)
        ]);

        const grouped = groupTimelineFeatures(timelineData.features || [], lineNames);
        window.__limitesTimelineData = grouped;
        return grouped;
    } catch (error) {
        console.error("Error consultando linea de tiempo:", error);
        return {};
    }
}

function uniqueSources(groupedByYear) {
    const seen = new Set();
    const sources = [];

    Object.keys(groupedByYear || {}).forEach(year => {
        (groupedByYear[year] || []).forEach(event => {
            const source = cleanText(event.llfuente);
            if (!source || seen.has(source)) return;
            seen.add(source);
            sources.push(source);
        });
    });

    return sources;
}

function eventHtml(event, year) {
    const desc = eventDescription(event);
    const needsScroll = desc.length > 70;

    return `
        <button class="timeline-evento" type="button"
            data-llid="${escAttr(event.llid)}"
            data-year="${escAttr(year)}"
            data-oficio="${escAttr(event.lloficio)}">
            <span class="timeline-evento-label">${esc(cleanText(event.lloficio, "Sin oficio"))}</span>
            <span class="timeline-evento-fuente">${esc(cleanText(event.llfuente, "Sin fuente"))}</span>
            <span class="timeline-popup${needsScroll ? " timeline-popup-scroll" : ""}">
                <span>${esc(desc)}</span>
                <small>Fuente: ${esc(cleanText(event.llfuente, "Sin fuente"))}</small>
            </span>
        </button>
    `;
}

function installTimelineStyles() {
    if (document.getElementById("limitesTimelineChevronStyles")) return;

    const style = document.createElement("style");
    style.id = "limitesTimelineChevronStyles";
    style.textContent = `
        #timelineDiv {
            margin-top: 14px;
            font-family: "Outfit", sans-serif;
        }

        #timelineDiv .timeline-container {
            width: 100%;
            box-sizing: border-box;
            background: #fffaf0;
            border: 1px solid #d9d3c8;
            border-radius: 12px;
            padding: 16px 12px 14px;
        }

        #timelineDiv .timeline-header {
            text-align: center;
            margin-bottom: 14px;
        }

        #timelineDiv .timeline-title {
            margin: 0;
            color: #151515;
            font-size: 16px;
            font-weight: 700;
            line-height: 1.2;
        }

        #timelineDiv .timeline-subtitle {
            margin: 5px 0 0;
            color: #6f4c33;
            font-size: 12px;
            font-weight: 500;
            line-height: 1.25;
        }

        #timelineDiv .timeline-chevron-scroll {
            overflow-x: auto;
            overflow-y: visible;
            padding: 8px 4px 18px;
        }

        #timelineDiv .timeline-chevron-track {
            display: flex;
            align-items: flex-start;
            min-width: max-content;
        }

        #timelineDiv .timeline-year-group {
            display: flex;
            flex-direction: column;
            align-items: center;
            min-width: 72px;
        }

        #timelineDiv .timeline-year {
            position: relative;
            width: 78px;
            height: 28px;
            border: 0;
            background: #8f9dff;
            color: #111;
            clip-path: polygon(0 0, calc(100% - 13px) 0, 100% 50%, calc(100% - 13px) 100%, 0 100%, 13px 50%);
            cursor: pointer;
            font-size: 10px;
            font-weight: 700;
            transition: transform 0.16s ease, filter 0.16s ease;
        }

        #timelineDiv .timeline-year:hover,
        #timelineDiv .timeline-year.active {
            transform: translateY(-1px) scale(1.04);
            filter: brightness(1.05);
        }

        #timelineDiv .timeline-year-label {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            height: 100%;
            padding-left: 8px;
            box-sizing: border-box;
        }

        #timelineDiv .timeline-eventos-container {
            display: none;
            flex-direction: column;
            gap: 7px;
            align-items: stretch;
            width: 150px;
            margin-top: 10px;
        }

        #timelineDiv .timeline-eventos-container.open {
            display: flex;
        }

        #timelineDiv .timeline-evento {
            position: relative;
            border: 1px solid #d8b99d;
            border-radius: 8px;
            background: #fff;
            padding: 7px 8px;
            cursor: pointer;
            text-align: left;
            box-shadow: 0 2px 6px rgba(94, 56, 29, 0.08);
        }

        #timelineDiv .timeline-evento:hover,
        #timelineDiv .timeline-evento.active {
            border-color: #d67036;
            box-shadow: 0 4px 10px rgba(94, 56, 29, 0.16);
        }

        #timelineDiv .timeline-evento-label {
            display: block;
            color: #3b2416;
            font-size: 11px;
            font-weight: 700;
            line-height: 1.2;
        }

        #timelineDiv .timeline-evento-fuente {
            display: block;
            margin-top: 2px;
            color: #7a4826;
            font-size: 10px;
            line-height: 1.15;
        }

        #timelineDiv .timeline-popup {
            display: none;
            position: absolute;
            left: 50%;
            bottom: calc(100% + 8px);
            transform: translateX(-50%);
            min-width: 190px;
            max-width: 260px;
            background: #fff;
            border: 1px solid #d8b99d;
            border-radius: 8px;
            padding: 8px 10px;
            box-shadow: 0 8px 18px rgba(94, 56, 29, 0.18);
            z-index: 30;
            color: #3b2416;
            font-size: 11px;
            line-height: 1.3;
        }

        #timelineDiv .timeline-evento:hover .timeline-popup,
        #timelineDiv .timeline-evento:focus .timeline-popup {
            display: block;
        }

        #timelineDiv .timeline-popup small {
            display: block;
            margin-top: 6px;
            color: #6f4c33;
        }

        #timelineDiv .timeline-popup-scroll {
            max-height: 92px;
            overflow-y: auto;
        }

        #timelineDiv .timeline-footer {
            display: flex;
            align-items: center;
            gap: 6px;
            margin-top: 8px;
            border-top: 1px solid #ead7c6;
            padding-top: 8px;
        }

        #timelineDiv .timeline-fuente-label {
            margin: 0;
            color: #6f4c33;
            font-size: 11px;
            font-weight: 700;
        }

        #timelineDiv .timeline-fuentes {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
        }

        #timelineDiv .timeline-fuente-tag {
            border-radius: 999px;
            background: #fff4e8;
            border: 1px solid #ead7c6;
            padding: 3px 7px;
            color: #5e381d;
            font-size: 10px;
        }

        #summaryDiv .oficio-title {
            margin: 0 0 6px;
            color: #9a5a23;
            font-size: 14px;
            font-weight: 700;
        }

        #summaryDiv .oficio-year {
            margin-bottom: 8px;
            color: #6f4c33;
            font-size: 12px;
        }

        #summaryDiv .oficio-list {
            display: grid;
            gap: 8px;
        }

        #summaryDiv .oficio-card {
            border: 1px solid #ead7c6;
            border-radius: 8px;
            background: #fff;
            padding: 8px;
        }

        #summaryDiv .oficio-row {
            color: #3b2416;
            font-size: 12px;
            line-height: 1.35;
            margin-bottom: 4px;
        }

        #summaryDiv .oficio-row:last-child {
            margin-bottom: 0;
        }

        #lineDescriptionsDiv {
            margin-top: 12px;
            font-family: "Outfit", sans-serif;
        }

        #lineDescriptionsDiv .line-desc-container {
            width: 100%;
            box-sizing: border-box;
            padding: 0;
        }

        #lineDescriptionsDiv .line-desc-title {
            margin: 0 0 8px;
            color: #9a5a23;
            font-size: 14px;
            font-weight: 700;
            line-height: 1.25;
        }

        #lineDescriptionsDiv .line-desc-list {
            display: grid;
            gap: 0;
        }

        #lineDescriptionsDiv .line-desc-card {
            border-top: 1px solid #ead7c6;
            padding: 8px 0;
        }

        #lineDescriptionsDiv .line-desc-card:first-child {
            border-top: 0;
            padding-top: 0;
        }

        #lineDescriptionsDiv .line-desc-name {
            margin: 0 0 4px;
            color: #3b2416;
            font-size: 12px;
            font-weight: 700;
            line-height: 1.25;
        }

        #lineDescriptionsDiv .line-desc-text {
            margin: 0;
            color: #4c3a2b;
            font-size: 12px;
            line-height: 1.4;
            white-space: pre-line;
        }
    `;

    document.head.appendChild(style);
}

function yearColor(index, total) {
    if (total <= 1) return "#8f9dff";
    const colors = ["#a7a9ff", "#8fa1ff", "#9fb2ff", "#a78dff", "#d9a3ff"];
    return colors[index % colors.length];
}

function findEvent(groupedByYear, year, llid, oficio) {
    const events = groupedByYear[year] || [];
    return events.find(event =>
        String(event.llid || "") === String(llid || "") &&
        (!oficio || String(event.lloficio || "") === String(oficio))
    ) || events.find(event => String(event.llid || "") === String(llid || ""));
}

function buildLineDescriptions(groupedByYear) {
    const descriptions = new Map();
    const missingByLine = new Map();

    Object.keys(groupedByYear || {}).forEach(year => {
        (groupedByYear[year] || []).forEach(event => {
            const lineName = cleanText(event.LLNombre, event.llid || "Sin nombre");
            const description = cleanText(event.lldesclim);

            if (!description) {
                const missingKey = String(event.llid || lineName);
                if (!missingByLine.has(missingKey)) missingByLine.set(missingKey, lineName);
                return;
            }

            const descriptionKey = description.toLocaleLowerCase("es");
            if (!descriptions.has(descriptionKey)) {
                descriptions.set(descriptionKey, {
                    description,
                    lineNames: new Set()
                });
            }

            descriptions.get(descriptionKey).lineNames.add(lineName);
        });
    });

    const withDescription = Array.from(descriptions.values()).map(item => ({
        description: item.description,
        lineNames: Array.from(item.lineNames).sort((a, b) => a.localeCompare(b, "es"))
    }));

    const missingLineNames = Array.from(missingByLine.values()).sort((a, b) => a.localeCompare(b, "es"));
    const withoutDescription = missingLineNames.length
        ? [{
            description: "Sin descripci\u00f3n disponible.",
            lineNames: missingLineNames
        }]
        : [];

    return withDescription
        .sort((a, b) => a.lineNames.join(", ").localeCompare(b.lineNames.join(", "), "es"))
        .concat(withoutDescription);
}

function renderLineDescriptions(groupedByYear) {
    const container = document.getElementById("lineDescriptionsDiv");
    if (!container) return;

    const descriptions = buildLineDescriptions(groupedByYear);
    container.style.display = "block";

    if (!descriptions.length) {
        container.innerHTML = `
            <div class="line-desc-container">
                <h4 class="line-desc-title">Descripci\u00f3n de la l\u00ednea</h4>
                <p class="line-desc-text">Sin descripci\u00f3n disponible.</p>
            </div>
        `;
        return;
    }

    const itemsHtml = descriptions.map(item => `
        <article class="line-desc-card">
            <p class="line-desc-name">${esc(item.lineNames.join(", "))}</p>
            <p class="line-desc-text">${esc(item.description)}</p>
        </article>
    `).join("");

    container.innerHTML = `
        <div class="line-desc-container">
            <h4 class="line-desc-title">Descripci\u00f3n de la l\u00ednea</h4>
            <div class="line-desc-list">${itemsHtml}</div>
        </div>
    `;
}

/**
 * Construye la linea de tiempo HTML en #timelineDiv.
 */
export function renderTimeline(groupedByYear, municipioNombre, onSelectEvent) {
    const timelineDiv = document.getElementById("timelineDiv");
    if (!timelineDiv) return;
    const summaryDiv = document.getElementById("summaryDiv");
    const lineDescriptionsDiv = document.getElementById("lineDescriptionsDiv");

    installTimelineStyles();
    timelineDiv.style.display = "block";
    if (lineDescriptionsDiv) {
        lineDescriptionsDiv.style.display = "none";
        lineDescriptionsDiv.innerHTML = "";
    }
    if (summaryDiv) {
        summaryDiv.style.display = "none";
        summaryDiv.innerHTML = "";
    }

    const years = Object.keys(groupedByYear || {}).sort(sortYears);

    if (!years.length) {
        timelineDiv.innerHTML = `
            <div class="timeline-container">
                <div class="timeline-header">
                    <h3 class="timeline-title">L\u00ednea del tiempo</h3>
                    <p class="timeline-subtitle">${esc(municipioNombre)}</p>
                </div>
                <p class="oot-js-limites-timeline-1">No se encontraron oficios o documentos para este municipio.</p>
            </div>
        `;
        renderLineDescriptions(groupedByYear);
        updateTimelineSummary(groupedByYear, null);
        return;
    }

    const sources = uniqueSources(groupedByYear);
    const sourcesHtml = sources.map(source => `<span class="timeline-fuente-tag">${esc(source)}</span>`).join("");

    const yearsHtml = years.map((year, index) => {
        const events = groupedByYear[year] || [];
        const eventsHtml = events.map(event => eventHtml(event, year)).join("");

        return `
            <div class="timeline-year-group">
                <button class="timeline-year" type="button" data-year="${escAttr(year)}" data-year-color="${yearColor(index, years.length)}">
                    <span class="timeline-year-label">${esc(year)}</span>
                </button>
                <div class="timeline-eventos-container" id="eventos-${escAttr(year)}">
                    ${eventsHtml}
                </div>
            </div>
        `;
    }).join("");

    timelineDiv.innerHTML = `
        <div class="timeline-container">
            <div class="timeline-header">
                <h3 class="timeline-title">L\u00ednea del tiempo</h3>
                <p class="timeline-subtitle">${esc(municipioNombre)}</p>
            </div>
            <div class="timeline-chevron-scroll">
                <div class="timeline-chevron-track">
                    ${yearsHtml}
                </div>
            </div>
            <div class="timeline-footer">
                <p class="timeline-fuente-label">Fuentes:</p>
                <div class="timeline-fuentes">${sourcesHtml || "\u2014"}</div>
            </div>
        </div>
    `;
    renderLineDescriptions(groupedByYear);

    timelineDiv.querySelectorAll(".timeline-year[data-year-color]").forEach(node => {
        node.style.background = node.dataset.yearColor;
    });

    let activeYear = null;

    timelineDiv.querySelectorAll(".timeline-year").forEach(node => {
        node.addEventListener("click", function () {
            const year = this.dataset.year;
            const wasActive = this.classList.contains("active");

            timelineDiv.querySelectorAll(".timeline-year").forEach(item => item.classList.remove("active"));
            timelineDiv.querySelectorAll(".timeline-eventos-container").forEach(item => item.classList.remove("open"));
            timelineDiv.querySelectorAll(".timeline-evento").forEach(item => item.classList.remove("active"));

            if (wasActive) {
                activeYear = null;
                updateTimelineSummary(groupedByYear, null);
                return;
            }

            activeYear = year;
            this.classList.add("active");
            document.getElementById(`eventos-${year}`)?.classList.add("open");
            updateTimelineSummary(groupedByYear, activeYear);
        });
    });

    timelineDiv.querySelectorAll(".timeline-evento").forEach(node => {
        node.addEventListener("click", function (event) {
            event.stopPropagation();

            const year = this.dataset.year;
            const eventData = findEvent(groupedByYear, year, this.dataset.llid, this.dataset.oficio);
            if (!eventData) return;

            timelineDiv.querySelectorAll(".timeline-evento").forEach(item => item.classList.remove("active"));
            this.classList.add("active");
            updateTimelineSummary({ [year]: [eventData] }, year);

            if (typeof onSelectEvent === "function") {
                onSelectEvent({
                    llid: eventData.llid,
                    LLNombre: eventData.LLNombre,
                    lloficio: eventData.lloficio,
                    lldescoficio: eventData.lldescoficio,
                    llfuente: eventData.llfuente,
                    lldesclim: eventData.lldesclim,
                    year
                });
            }
        });
    });
}

/**
 * Actualiza el panel #summaryDiv con la informacion del anio seleccionado.
 */
export function updateTimelineSummary(groupedByYear, activeYear) {
    const summaryDiv = document.getElementById("summaryDiv");
    if (!summaryDiv) return;

    if (!activeYear || !groupedByYear?.[activeYear]) {
        summaryDiv.innerHTML = "";
        summaryDiv.style.display = "none";
        return;
    }

    const events = groupedByYear[activeYear] || [];
    const itemsHtml = events.map(event => {
        return `
            <div class="oficio-card">
                <div class="oficio-row"><strong>Nombre de la l\u00ednea lim\u00edtrofe:</strong> ${esc(cleanText(event.LLNombre, "\u2014"))}</div>
                <div class="oficio-row"><strong>Oficio:</strong> ${esc(cleanText(event.lloficio, "\u2014"))}</div>
                <div class="oficio-row"><strong>Descripci\u00f3n:</strong> <span class="oficio-desc">${esc(eventDescription(event))}</span></div>
                <div class="oficio-row"><strong>Fuente:</strong> ${esc(cleanText(event.llfuente, "\u2014"))}</div>
            </div>
        `;
    }).join("");

    summaryDiv.style.display = "block";
    summaryDiv.innerHTML = `
        <h4 class="oficio-title">Oficio</h4>
        <div class="oficio-year">A\u00f1o ${esc(activeYear)}</div>
        <div class="oficio-list">${itemsHtml}</div>
    `;
}
