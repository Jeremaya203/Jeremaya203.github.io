        (function mejorarLineaTiempoMunicipalLimites() {
            return;
            const TIMELINE_QUERY_RE = /componentelineaslimitrofes\/FeatureServer\/3\/query/i;
            const LINEAS_QUERY_URL = "https://mapas2.igac.gov.co/server/rest/services/limites/limites/MapServer/0/query";
            const fetchOriginal = window.fetch?.bind(window);

            if (!fetchOriginal) return;

            window.__limitesTimelineAgrupado = {};

            function esc(texto) {
                const div = document.createElement("div");
                div.textContent = texto == null ? "" : String(texto);
                return div.innerHTML;
            }

            function textoEvento(valor, fallback = "—") {
                const limpio = String(valor || "").trim();
                return limpio || fallback;
            }

            function agruparEventos(features) {
                const agrupado = {};

                (features || []).forEach(feature => {
                    const att = feature.attributes || {};
                    const year = att.lloficioanno ? String(att.lloficioanno) : "Sin año";
                    if (!agrupado[year]) agrupado[year] = [];
                    agrupado[year].push({
                        llid: att.llid,
                        linea: att.LLNombre || att.lldesclim || att.llid || "—",
                        lloficio: att.lloficio || "",
                        lldescoficio: att.lldescoficio || "",
                        llfuente: att.llfuente || "",
                        year
                    });
                });

                return agrupado;
            }

            async function consultarNombresLineas(llids) {
                const ids = Array.from(new Set((llids || []).filter(Boolean).map(String)));
                if (!ids.length) return {};

                const where = "LLIdentif IN (" + ids.map(id => "'" + id.replace(/'/g, "''") + "'").join(",") + ")";
                const url = LINEAS_QUERY_URL +
                    "?where=" + encodeURIComponent(where) +
                    "&outFields=LLIdentif,LLNombre&returnGeometry=false&f=json";

                try {
                    const resp = await fetchOriginal(url);
                    const data = await resp.json();
                    const mapa = {};
                    (data.features || []).forEach(feature => {
                        const att = feature.attributes || {};
                        if (att.LLIdentif) mapa[String(att.LLIdentif)] = att.LLNombre || att.LLIdentif;
                    });
                    return mapa;
                } catch (error) {
                    return {};
                }
            }

            window.fetch = async function fetchLimitesMejorado(input, init) {
                const response = await fetchOriginal(input, init);
                const url = typeof input === "string" ? input : input?.url || "";

                if (!TIMELINE_QUERY_RE.test(url)) return response;

                try {
                    const data = await response.clone().json();
                    const llids = (data.features || []).map(feature => feature.attributes?.llid).filter(Boolean);
                    const nombres = await consultarNombresLineas(llids);

                    (data.features || []).forEach(feature => {
                        const att = feature.attributes || {};
                        const nombreLinea = nombres[String(att.llid)] || att.lldesclim || att.llid || "";
                        att.LLNombre = nombreLinea;
                        att.lldesclim = nombreLinea;
                        feature.attributes = att;
                    });

                    window.__limitesTimelineAgrupado = agruparEventos(data.features || []);

                    return new Response(JSON.stringify(data), {
                        status: response.status,
                        statusText: response.statusText,
                        headers: { "Content-Type": "application/json; charset=utf-8" }
                    });
                } catch (error) {
                    return response;
                }
            };

            function eventoPorNodo(nodo) {
                const year = nodo?.dataset?.year;
                const llid = nodo?.dataset?.llid;
                const oficio = nodo?.dataset?.oficio || "";
                const eventos = window.__limitesTimelineAgrupado?.[year] || [];

                return eventos.find(evento =>
                    String(evento.llid || "") === String(llid || "") &&
                    (!oficio || String(evento.lloficio || "") === String(oficio))
                ) || eventos.find(evento => String(evento.llid || "") === String(llid || ""));
            }

            function renderizarResumenOficio(eventos, year) {
                const summaryDiv = document.getElementById("summaryDiv");
                if (!summaryDiv) return;

                const lista = Array.isArray(eventos) ? eventos.filter(Boolean) : [];
                if (!lista.length) {
                    summaryDiv.innerHTML = "<p class='oot-js-limites-timeline2-1'>Seleccione un año en la línea del tiempo para ver los detalles.</p>";
                    return;
                }

                const tarjetas = lista.map(evento => {
                    const descripcion = textoEvento(evento.lldescoficio, "Sin descripción");
                    return `
                        <div class="oficio-card">
                            <div class="oficio-row"><strong>Nombre de la línea limítrofe:</strong> ${esc(textoEvento(evento.linea))}</div>
                            <div class="oficio-row"><strong>Oficio:</strong> ${esc(textoEvento(evento.lloficio))}</div>
                            <div class="oficio-row"><strong>Descripción:</strong> <span class="oficio-desc">${esc(descripcion)}</span></div>
                            <div class="oficio-row"><strong>Fuente:</strong> ${esc(textoEvento(evento.llfuente))}</div>
                        </div>
                    `;
                }).join("");

                summaryDiv.innerHTML = `
                    <h4 class="oficio-title">Oficio</h4>
                    ${year ? `<div class="oficio-year">Año ${esc(year)}</div>` : ""}
                    <div class="oficio-list">${tarjetas}</div>
                `;
            }

            function actualizarPopupEvento(nodo) {
                const evento = eventoPorNodo(nodo);
                if (!evento) return;

                const descripcion = textoEvento(evento.lldescoficio, "Sin descripción");
                const fuente = textoEvento(evento.llfuente);
                const popup = nodo.querySelector(".timeline-popup");
                if (!popup) return;

                popup.classList.toggle("timeline-popup-scroll", descripcion.length > 70);
                popup.innerHTML = `
                    <p>${esc(descripcion)}</p>
                    <small>Fuente: ${esc(fuente)}</small>
                `;

                if (!nodo.querySelector(".timeline-evento-fuente")) {
                    const fuenteEl = document.createElement("span");
                    fuenteEl.className = "timeline-evento-fuente";
                    fuenteEl.textContent = fuente;
                    nodo.appendChild(fuenteEl);
                }
            }

            function mejorarTimeline() {
                const timelineDiv = document.getElementById("timelineDiv");
                if (!timelineDiv || timelineDiv.style.display === "none") return;

                const titulo = timelineDiv.querySelector(".timeline-title");
                if (titulo) titulo.textContent = "Línea del tiempo";

                timelineDiv.querySelectorAll(".timeline-evento").forEach(actualizarPopupEvento);

                timelineDiv.querySelectorAll(".timeline-node").forEach(nodo => {
                    if (nodo.dataset.limitesMejorado) return;
                    nodo.dataset.limitesMejorado = "true";
                    nodo.addEventListener("click", function () {
                        const year = this.dataset.year;
                        setTimeout(() => {
                            if (!this.classList.contains("active")) return;
                            renderizarResumenOficio(window.__limitesTimelineAgrupado?.[year] || [], year);
                        }, 0);
                    });
                });

                timelineDiv.querySelectorAll(".timeline-evento").forEach(nodo => {
                    if (nodo.dataset.limitesResumenMejorado) return;
                    nodo.dataset.limitesResumenMejorado = "true";
                    nodo.addEventListener("click", function () {
                        const evento = eventoPorNodo(this);
                        setTimeout(() => renderizarResumenOficio(evento ? [evento] : [], this.dataset.year), 0);
                    });
                });
            }

            function instalarEstilosTimeline() {
                if (document.getElementById("limitesTimelineMunicipalStyles")) return;
                const style = document.createElement("style");
                style.id = "limitesTimelineMunicipalStyles";
                style.textContent = `
                    #timelineDiv { margin-top: 14px; }
                    #timelineDiv .timeline-container {
                        background: #fffaf0;
                        border: 1px solid #d9d3c8;
                        border-radius: 12px;
                        padding: 14px 12px 16px;
                    }
                    #timelineDiv .timeline-header { text-align: center; margin-bottom: 10px; }
                    #timelineDiv .timeline-title {
                        margin: 0;
                        color: #9a5a23;
                        font-family: "Outfit", sans-serif;
                        font-size: 16px;
                        font-weight: 600;
                    }
                    #timelineDiv .timeline-subtitle {
                        margin: 4px 0 0;
                        color: #6f4c33;
                        font-size: 12px;
                        line-height: 1.25;
                    }
                    #timelineDiv .timeline-scroll { overflow-x: auto; padding: 8px 4px 18px; }
                    #timelineDiv .timeline-track { position: relative; min-width: max-content; padding: 18px 6px 0; }
                    #timelineDiv .timeline-line {
                        position: absolute;
                        left: 12px;
                        right: 12px;
                        top: 34px;
                        height: 2px;
                        background: #c9874e;
                    }
                    #timelineDiv .timeline-nodes {
                        display: flex;
                        align-items: flex-start;
                        gap: 18px;
                        position: relative;
                    }
                    #timelineDiv .timeline-node-group {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        min-width: 78px;
                    }
                    #timelineDiv .timeline-node {
                        min-width: 54px;
                        height: 30px;
                        padding: 0 10px;
                        border-radius: 16px;
                        border: 1px solid #c9874e;
                        background: #fff4e8;
                        color: #5e381d;
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        cursor: pointer;
                        font-weight: 600;
                        font-size: 12px;
                        position: relative;
                        z-index: 1;
                    }
                    #timelineDiv .timeline-node.active,
                    #timelineDiv .timeline-node:hover {
                        background: #d67036;
                        color: #fff;
                    }
                    #timelineDiv .timeline-eventos-container {
                        margin-top: 10px;
                        flex-direction: column;
                        gap: 6px;
                        align-items: stretch;
                        min-width: 118px;
                    }
                    #timelineDiv .timeline-evento {
                        position: relative;
                        border: 1px solid #ead7c6;
                        background: #fff;
                        border-radius: 8px;
                        padding: 6px 8px;
                        cursor: pointer;
                        box-shadow: 0 2px 6px rgba(94, 56, 29, 0.08);
                    }
                    #timelineDiv .timeline-evento-label {
                        display: block;
                        color: #3b2416;
                        font-size: 11px;
                        font-weight: 600;
                        line-height: 1.2;
                    }
                    #timelineDiv .timeline-evento-fuente {
                        display: block;
                        margin-top: 2px;
                        color: #9c745a;
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
                        z-index: 20;
                        color: #3b2416;
                        font-size: 11px;
                        line-height: 1.3;
                    }
                    #timelineDiv .timeline-popup p { margin: 0; }
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
                        margin-top: 8px;
                        border-top: 1px solid #ead7c6;
                        padding-top: 8px;
                    }
                    #timelineDiv .timeline-fuente-label {
                        margin: 0 0 4px;
                        font-size: 11px;
                        font-weight: 600;
                        color: #6f4c33;
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
                        font-weight: 600;
                    }
                    #summaryDiv .oficio-year {
                        color: #6f4c33;
                        font-size: 12px;
                        margin-bottom: 8px;
                    }
                    #summaryDiv .oficio-list { display: grid; gap: 8px; }
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
                    #summaryDiv .oficio-row:last-child { margin-bottom: 0; }
                `;
                document.head.appendChild(style);
            }

            document.addEventListener("DOMContentLoaded", function () {
                instalarEstilosTimeline();
                const timelineDiv = document.getElementById("timelineDiv");
                if (!timelineDiv) return;

                const observer = new MutationObserver(function () {
                    setTimeout(mejorarTimeline, 0);
                });
                observer.observe(timelineDiv, { childList: true, subtree: true });
                mejorarTimeline();
            });
        })();
    
