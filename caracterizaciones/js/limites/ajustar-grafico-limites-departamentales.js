        (function ajustarGraficoLimitesDepartamentales() {
            let ChartOriginal = window.Chart;

            const fuenteGraficoLimites = {
                family: "Outfit, sans-serif",
                weight: "500"
            };
            const tamanoFuenteEjeYDepartamental = 8;
            const tamanoFuenteEjeXDepartamental = 10;

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

            function corregirTextos(valor) {
                if (typeof valor === "string") return corregirTexto(valor);
                if (Array.isArray(valor)) return valor.map(corregirTextos);
                if (!valor || typeof valor !== "object") return valor;

                Object.keys(valor).forEach(clave => {
                    valor[clave] = corregirTextos(valor[clave]);
                });
                return valor;
            }

            function formatearNumeroLimites(valor) {
                const numero = Number(valor);
                if (!Number.isFinite(numero)) return valor;

                return new Intl.NumberFormat("es-CO", {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2
                }).format(numero);
            }

            function obtenerUnidadTooltip(texto) {
                const unidad = corregirTexto(String(texto || ""))
                    .replace(/km\s*(?:Â²|�|2)/gi, "km²")
                    .match(/\s(km²|km)(?:\b|$)/i);

                return unidad ? ` ${unidad[1]}` : "";
            }

            function aplicarFormatoTooltip(config) {
                if (!config) return;
                const opciones = config.options || (config.options = {});
                const plugins = opciones.plugins || (opciones.plugins = {});
                const tooltip = plugins.tooltip || (plugins.tooltip = {});
                const callbacks = tooltip.callbacks || (tooltip.callbacks = {});
                if (callbacks.__limitesFormatoNumerico) return;
                const callbackOriginal = callbacks.label;

                callbacks.label = function etiquetaTooltipFormateada(context) {
                    const etiquetaOriginal = typeof callbackOriginal === "function"
                        ? callbackOriginal(context)
                        : context.raw;
                    const unidad = obtenerUnidadTooltip(etiquetaOriginal);

                    return `${formatearNumeroLimites(context.raw)}${unidad}`;
                };
                Object.defineProperty(callbacks, "__limitesFormatoNumerico", {
                    value: true,
                    enumerable: false
                });
            }

            function esGraficoDepartamental() {
                const titulo = document.getElementById("chartTitle")?.textContent || "";
                return /departamental|departamentos/i.test(corregirTexto(titulo));
            }

            function asegurarFuente(ticks, size) {
                if (!ticks) return;
                ticks.font = {
                    ...fuenteGraficoLimites,
                    ...(ticks.font || {}),
                    family: fuenteGraficoLimites.family,
                    size
                };
            }

            function limpiarCanvasDepartamental(canvas) {
                canvas.removeAttribute("height");
                canvas.removeAttribute("width");
                canvas.style.width = "100%";
                canvas.style.display = "block";
            }

            function esGraficoMunicipal() {
                const titulo = document.getElementById("chartTitle")?.textContent || "";
                return /l[ií]neas\s+lim[ií]trofes|l[ií]mites\s+municipales/i.test(corregirTexto(titulo));
            }

            function cortarTexto(texto, maximo) {
                const limpio = corregirTexto(String(texto || "")).trim();
                if (limpio.length <= maximo) return limpio;
                return limpio.slice(0, Math.max(0, maximo - 1)).trimEnd() + "…";
            }

            function dividirEtiquetaLinea(nombre) {
                const texto = corregirTexto(String(nombre || "Sin nombre")).replace(/\s+/g, " ").trim();
                const maximoLinea = 34;
                if (texto.length <= maximoLinea) return texto;

                const ladosLimite = texto.split(/\s+-\s+/).map(lado => lado.trim()).filter(Boolean);
                if (ladosLimite.length === 2) return ladosLimite;

                const palabras = texto.split(" ");
                let mejorCorte = 1;
                let menorDiferencia = Infinity;

                for (let indice = 1; indice < palabras.length; indice += 1) {
                    const primera = palabras.slice(0, indice).join(" ");
                    const segunda = palabras.slice(indice).join(" ");
                    const diferencia = Math.abs(primera.length - segunda.length);
                    if (diferencia < menorDiferencia) {
                        menorDiferencia = diferencia;
                        mejorCorte = indice;
                    }
                }

                return [
                    palabras.slice(0, mejorCorte).join(" "),
                    palabras.slice(mejorCorte).join(" ")
                ].filter(Boolean);
            }

            function prepararGraficoMunicipal(canvas, config) {
                if (!canvas || !config || !esGraficoMunicipal()) return;

                const canvasEl = canvas instanceof HTMLCanvasElement ? canvas : canvas?.canvas;
                const canvasId = canvasEl?.id || "";
                if (canvasId === "municipalStatusChart" || config.type === "doughnut") return;

                const labels = config.data?.labels || [];
                const total = labels.length;
                if (!total) return;

                const opciones = config.options || (config.options = {});
                const escalas = opciones.scales || (opciones.scales = {});
                const escalaY = escalas.y || (escalas.y = {});
                const escalaX = escalas.x || (escalas.x = {});
                const muchasLineas = total > 12;
                const pocasLineas = total <= 5;
                const visiblesIniciales = muchasLineas ? 12 : total;
                const altoCanvas = total === 1
                    ? 250
                    : muchasLineas
                        ? 520
                        : Math.max(260, Math.min(560, 150 + total * (pocasLineas ? 46 : 34)));
                const fontSizeY = muchasLineas ? 8 : 10;
                const fontSizeX = muchasLineas ? 10 : 11;

                config.data.labels = labels.map(dividirEtiquetaLinea);

                canvas.removeAttribute("height");
                canvas.removeAttribute("width");
                canvas.style.width = "100%";
                canvas.style.display = "block";
                canvas.style.height = `${altoCanvas}px`;
                canvas.style.minHeight = `${altoCanvas}px`;
                canvas.style.maxHeight = `${altoCanvas}px`;

                opciones.responsive = false;
                opciones.maintainAspectRatio = false;
                opciones.indexAxis = "y";
                opciones.layout = opciones.layout || {};
                opciones.layout.padding = muchasLineas
                    ? { top: 12, right: 18, bottom: 14, left: 6 }
                    : { top: 14, right: 18, bottom: 14, left: 8 };

                asegurarFuente(escalaY.ticks || (escalaY.ticks = {}), fontSizeY);
                asegurarFuente(escalaX.ticks || (escalaX.ticks = {}), fontSizeX);
                escalaY.ticks.autoSkip = false;
                escalaY.ticks.maxRotation = 0;
                escalaY.ticks.padding = muchasLineas ? 4 : 7;
                escalaY.ticks.font.lineHeight = 1.12;
                escalaY.afterFit = function ajustarAnchoEjeLineas(axis) {
                    const anchoDisponible = canvasEl?.clientWidth || canvas.clientWidth || 360;
                    const anchoMaximo = Math.min(168, Math.max(145, Math.round(anchoDisponible * 0.5)));
                    axis.width = Math.min(axis.width, anchoMaximo);
                };

                if (muchasLineas) {
                    escalaY.min = 0;
                    escalaY.max = visiblesIniciales - 1;
                } else {
                    delete escalaY.min;
                    delete escalaY.max;
                }

                if (escalaX.title) {
                    escalaX.title.text = corregirTexto(escalaX.title.text || "Longitud (km)");
                    escalaX.title.font = {
                        ...fuenteGraficoLimites,
                        ...(escalaX.title.font || {}),
                        family: fuenteGraficoLimites.family,
                        size: fontSizeX
                    };
                }

                opciones.datasets = opciones.datasets || {};
                opciones.datasets.bar = {
                    ...(opciones.datasets.bar || {}),
                    categoryPercentage: muchasLineas ? 0.74 : 0.68,
                    barPercentage: muchasLineas ? 0.78 : 0.7,
                    minBarLength: 5,
                    borderRadius: 2,
                    borderSkipped: false,
                    borderWidth: 0.3
                };

                (config.data?.datasets || []).forEach(dataset => {
                    dataset.minBarLength = 5;
                    dataset.borderRadius = 2;
                    dataset.borderSkipped = false;
                });

                if (total === 1) opciones.barThickness = 24;
                else if (pocasLineas) opciones.barThickness = 20;
                else delete opciones.barThickness;

                opciones.plugins = opciones.plugins || {};
                opciones.plugins.zoom = {
                    pan: { enabled: muchasLineas, mode: "y", threshold: 5 },
                    zoom: {
                        wheel: { enabled: muchasLineas, speed: 0.06, modifierKey: null },
                        pinch: { enabled: muchasLineas },
                        drag: { enabled: false },
                        mode: "y"
                    },
                    limits: {
                        y: { min: 0, max: Math.max(0, total - 1), minRange: Math.min(visiblesIniciales, total) }
                    }
                };
            }

            function prepararGraficoDepartamental(canvas, config) {
                if (!canvas || !config || !esGraficoDepartamental()) return;

                corregirTextos(config.data);
                corregirTextos(config.options);
                aplicarFormatoTooltip(config);

                const labels = config.data?.labels || [];
                const cantidadBarras = labels.length;
                const esUnaBarra = cantidadBarras === 1;
                const opciones = config.options || (config.options = {});
                const escalas = opciones.scales || (opciones.scales = {});
                const escalaY = escalas.y || (escalas.y = {});
                const escalaX = escalas.x || (escalas.x = {});

                limpiarCanvasDepartamental(canvas);
                asegurarFuente(escalaY.ticks || (escalaY.ticks = {}), tamanoFuenteEjeYDepartamental);
                asegurarFuente(escalaX.ticks || (escalaX.ticks = {}), tamanoFuenteEjeXDepartamental);

                if (escalaX.title?.text) escalaX.title.text = corregirTexto(escalaX.title.text);
                if (escalaX.title) {
                    escalaX.title.font = {
                        ...fuenteGraficoLimites,
                        ...(escalaX.title.font || {}),
                        family: fuenteGraficoLimites.family,
                        size: tamanoFuenteEjeXDepartamental
                    };
                }

                if (esUnaBarra) {
                    canvas.style.height = "240px";
                    canvas.style.minHeight = "240px";
                    canvas.style.maxHeight = "240px";

                    opciones.layout = opciones.layout || {};
                    opciones.layout.padding = { top: 18, right: 20, bottom: 18, left: 8 };

                    escalaY.ticks.padding = 8;
                    escalaY.ticks.autoSkip = false;
                    escalaY.afterFit = function despuesDeAjustarEjeY(axis) {
                        axis.width = Math.max(axis.width, 82);
                    };

                    escalaX.ticks.padding = 6;
                    opciones.datasets = opciones.datasets || {};
                    opciones.datasets.bar = {
                        ...(opciones.datasets.bar || {}),
                        categoryPercentage: 0.52,
                        barPercentage: 0.58,
                        borderWidth: 0.3
                    };
                    opciones.barThickness = 24;
                } else if (cantidadBarras > 1) {
                    const pocosDeptos = cantidadBarras <= 5;
                    const alturaPorBarra = pocosDeptos ? 28 : 18;
                    const canvasHeight = Math.min(520, 100 + cantidadBarras * alturaPorBarra);

                    canvas.style.height = `${canvasHeight}px`;
                    canvas.style.minHeight = `${canvasHeight}px`;
                    canvas.style.maxHeight = `${canvasHeight}px`;
                }
            }

            function ChartAjustado(item, config) {
                const canvas = item?.canvas || item;
                aplicarFormatoTooltip(config);
                prepararGraficoMunicipal(canvas, config);
                prepararGraficoDepartamental(canvas, config);
                return new ChartOriginal(item, config);
            }

            function instalarAjuste(ChartDisponible) {
                if (!ChartDisponible || ChartDisponible.__limitesDepartamentalesAjustado) return;

                ChartOriginal = ChartDisponible;
                Object.setPrototypeOf(ChartAjustado, ChartOriginal);
                ChartAjustado.prototype = ChartOriginal.prototype;
                Object.getOwnPropertyNames(ChartOriginal).forEach(propiedad => {
                    if (!(propiedad in ChartAjustado)) {
                        Object.defineProperty(
                            ChartAjustado,
                            propiedad,
                            Object.getOwnPropertyDescriptor(ChartOriginal, propiedad)
                        );
                    }
                });

                ChartAjustado.__limitesDepartamentalesAjustado = true;
                window.Chart = ChartAjustado;
            }

            if (ChartOriginal) {
                instalarAjuste(ChartOriginal);
            } else {
                Object.defineProperty(window, "Chart", {
                    configurable: true,
                    get() {
                        return undefined;
                    },
                    set(valor) {
                        delete window.Chart;
                        instalarAjuste(valor);
                    }
                });
            }
        })();
    
