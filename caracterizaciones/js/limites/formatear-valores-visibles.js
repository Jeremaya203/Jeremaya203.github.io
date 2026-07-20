        (function formatearValoresVisiblesLimites() {
            function corregirTexto(texto) {
                if (typeof texto !== "string" || !/[ÃÂâ]/.test(texto)) return texto;
                try {
                    const bytes = Uint8Array.from(Array.from(texto), caracter => caracter.charCodeAt(0) & 255);
                    const corregido = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
                    return corregido.includes("�") ? texto : corregido;
                } catch (error) {
                    return texto;
                }
            }

            function normalizarNumero(texto) {
                const tienePunto = texto.includes(".");
                const tieneComa = texto.includes(",");

                if (tienePunto && tieneComa) {
                    const ultimoPunto = texto.lastIndexOf(".");
                    const ultimaComa = texto.lastIndexOf(",");
                    if (ultimaComa > ultimoPunto) {
                        return texto.replace(/\./g, "").replace(",", ".");
                    }
                    return texto.replace(/,/g, "");
                }

                return texto.replace(",", ".");
            }

            function formatearNumero(texto) {
                const numero = Number(normalizarNumero(texto));
                if (!Number.isFinite(numero)) return texto;

                return new Intl.NumberFormat("es-CO", {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2
                }).format(numero);
            }

            function limpiarTextoVisible(texto) {
                return corregirTexto(texto)
                    .replace(/km\s*(?:Â²|�|2)/gi, "km²")
                    .replace(/-?\d+(?:[.,]\d{3})+[.,]\d{3,}|-?\d+[.,]\d{4,}/g, formatearNumero);
            }

            function formatearPopupArcgis(popup) {
                const walker = document.createTreeWalker(popup, NodeFilter.SHOW_TEXT);
                const nodos = [];
                let nodo = walker.nextNode();

                while (nodo) {
                    nodos.push(nodo);
                    nodo = walker.nextNode();
                }

                nodos.forEach(textNode => {
                    const limpio = limpiarTextoVisible(textNode.nodeValue || "");
                    if (limpio !== textNode.nodeValue) textNode.nodeValue = limpio;
                });
            }

            document.addEventListener("DOMContentLoaded", function () {
                const observadorPopup = new MutationObserver(function (mutaciones) {
                    mutaciones.forEach(mutacion => {
                        if (mutacion.type === "characterData") {
                            const popup = mutacion.target?.parentElement?.closest?.(".esri-popup, .esri-popup__main-container, .esri-popup__content");
                            if (popup) formatearPopupArcgis(popup);
                            return;
                        }

                        mutacion.addedNodes.forEach(nodo => {
                            if (!(nodo instanceof HTMLElement)) return;

                            if (nodo.matches(".esri-popup, .esri-popup__main-container, .esri-popup__content")) {
                                formatearPopupArcgis(nodo);
                                return;
                            }

                            nodo.querySelectorAll?.(".esri-popup, .esri-popup__main-container, .esri-popup__content")
                                .forEach(formatearPopupArcgis);
                        });
                    });
                });

                observadorPopup.observe(document.body, { childList: true, characterData: true, subtree: true });
            });
        })();
    
