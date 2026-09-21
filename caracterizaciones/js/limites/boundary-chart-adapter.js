        (function initializeBoundaryChartAdapter() {
            let ChartOriginal = window.Chart;

            const BOUNDARY_CHART_FONT = {
                family: "Outfit, sans-serif",
                weight: "500"
            };
            const departmentYAxisFontSize = 8;
            const departmentXAxisFontSize = 10;

            function repairMojibake(text) {
                if (typeof text !== "string" || !/[ÃÂâ]/.test(text)) return text;
                try {
                    const bytes = Uint8Array.from(Array.from(text), caracter => caracter.charCodeAt(0) & 255);
                    const corregido = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
                    return corregido.includes("�") ? text : corregido;
                } catch (error) {
                    return text;
                }
            }

            function repairTextValues(valor) {
                if (typeof valor === "string") return repairMojibake(valor);
                if (Array.isArray(valor)) return valor.map(repairTextValues);
                if (!valor || typeof valor !== "object") return valor;

                Object.keys(valor).forEach(clave => {
                    valor[clave] = repairTextValues(valor[clave]);
                });
                return valor;
            }

            function formatBoundaryNumber(valor) {
                const numero = Number(valor);
                if (!Number.isFinite(numero)) return valor;

                return new Intl.NumberFormat("es-CO", {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2
                }).format(numero);
            }

            function getTooltipUnit(text) {
                const unit = repairMojibake(String(text || ""))
                    .replace(/km\s*(?:Â²|�|2)/gi, "km²")
                    .match(/\s(km²|km)(?:\b|$)/i);

                return unit ? ` ${unit[1]}` : "";
            }

            function applyTooltipFormatting(config) {
                if (!config) return;
                const chartOptions = config.options || (config.options = {});
                const plugins = chartOptions.plugins || (chartOptions.plugins = {});
                const tooltip = plugins.tooltip || (plugins.tooltip = {});
                const callbacks = tooltip.callbacks || (tooltip.callbacks = {});
                if (callbacks.__limitesFormatoNumerico) return;
                const callbackOriginal = callbacks.label;

                callbacks.label = function etiquetaTooltipFormateada(context) {
                    const etiquetaOriginal = typeof callbackOriginal === "function"
                        ? callbackOriginal(context)
                        : context.raw;
                    const unit = getTooltipUnit(etiquetaOriginal);

                    return `${formatBoundaryNumber(context.raw)}${unit}`;
                };
                Object.defineProperty(callbacks, "__limitesFormatoNumerico", {
                    value: true,
                    enumerable: false
                });
            }

            function isDepartmentChart() {
                const titulo = document.getElementById("chartTitle")?.textContent || "";
                return /departamental|departamentos/i.test(repairMojibake(titulo));
            }

            function ensureFont(ticks, size) {
                if (!ticks) return;
                ticks.font = {
                    ...BOUNDARY_CHART_FONT,
                    ...(ticks.font || {}),
                    family: BOUNDARY_CHART_FONT.family,
                    size
                };
            }

            function clearDepartmentCanvasSizing(canvas) {
                canvas.removeAttribute("height");
                canvas.removeAttribute("width");
                canvas.style.width = "100%";
                canvas.style.display = "block";
            }

            function isMunicipalChart() {
                const titulo = document.getElementById("chartTitle")?.textContent || "";
                return /l[ií]neas\s+lim[ií]trofes|l[ií]mites\s+municipales/i.test(repairMojibake(titulo));
            }

            function truncateText(text, maximo) {
                const limpio = repairMojibake(String(text || "")).trim();
                if (limpio.length <= maximo) return limpio;
                return limpio.slice(0, Math.max(0, maximo - 1)).trimEnd() + "…";
            }

            function splitBoundaryLabel(nombre) {
                const text = repairMojibake(String(nombre || "Sin nombre")).replace(/\s+/g, " ").trim();
                const maximumLineValue = 34;
                if (text.length <= maximumLineValue) return text;

                const boundarySides = text.split(/\s+-\s+/).map(lado => lado.trim()).filter(Boolean);
                if (boundarySides.length === 2) return boundarySides;

                const palabras = text.split(" ");
                let mejorCorte = 1;
                let menorDiferencia = Infinity;

                for (let index = 1; index < palabras.length; index += 1) {
                    const primera = palabras.slice(0, index).join(" ");
                    const segunda = palabras.slice(index).join(" ");
                    const diferencia = Math.abs(primera.length - segunda.length);
                    if (diferencia < menorDiferencia) {
                        menorDiferencia = diferencia;
                        mejorCorte = index;
                    }
                }

                return [
                    palabras.slice(0, mejorCorte).join(" "),
                    palabras.slice(mejorCorte).join(" ")
                ].filter(Boolean);
            }

            function prepareMunicipalChart(canvas, config) {
                if (!canvas || !config || !isMunicipalChart()) return;

                const canvasEl = canvas instanceof HTMLCanvasElement ? canvas : canvas?.canvas;
                const canvasId = canvasEl?.id || "";
                if (canvasId === "municipalStatusChart" || config.type === "doughnut") return;

                const labels = config.data?.labels || [];
                const total = labels.length;
                if (!total) return;

                const chartOptions = config.options || (config.options = {});
                const escalas = chartOptions.scales || (chartOptions.scales = {});
                const escalaY = escalas.y || (escalas.y = {});
                const escalaX = escalas.x || (escalas.x = {});
                const hasManyLines = total > 12;
                const hasFewLines = total <= 5;
                const visiblesIniciales = hasManyLines ? 12 : total;
                const canvasHeight = total === 1
                    ? 250
                    : hasManyLines
                        ? 520
                        : Math.max(260, Math.min(560, 150 + total * (hasFewLines ? 46 : 34)));
                const fontSizeY = hasManyLines ? 8 : 10;
                const fontSizeX = hasManyLines ? 10 : 11;

                config.data.labels = labels.map(splitBoundaryLabel);

                canvas.removeAttribute("height");
                canvas.removeAttribute("width");
                canvas.style.width = "100%";
                canvas.style.display = "block";
                canvas.style.height = `${canvasHeight}px`;
                canvas.style.minHeight = `${canvasHeight}px`;
                canvas.style.maxHeight = `${canvasHeight}px`;

                chartOptions.responsive = false;
                chartOptions.maintainAspectRatio = false;
                chartOptions.indexAxis = "y";
                chartOptions.layout = chartOptions.layout || {};
                chartOptions.layout.padding = hasManyLines
                    ? { top: 12, right: 18, bottom: 14, left: 6 }
                    : { top: 14, right: 18, bottom: 14, left: 8 };

                ensureFont(escalaY.ticks || (escalaY.ticks = {}), fontSizeY);
                ensureFont(escalaX.ticks || (escalaX.ticks = {}), fontSizeX);
                escalaY.ticks.autoSkip = false;
                escalaY.ticks.maxRotation = 0;
                escalaY.ticks.padding = hasManyLines ? 4 : 7;
                escalaY.ticks.font.lineHeight = 1.12;
                escalaY.afterFit = function adjustBoundaryAxisWidth(axis) {
                    const availableWidth = canvasEl?.clientWidth || canvas.clientWidth || 360;
                    const maximumWidth = Math.min(168, Math.max(145, Math.round(availableWidth * 0.5)));
                    axis.width = Math.min(axis.width, maximumWidth);
                };

                if (hasManyLines) {
                    escalaY.min = 0;
                    escalaY.max = visiblesIniciales - 1;
                } else {
                    delete escalaY.min;
                    delete escalaY.max;
                }

                if (escalaX.title) {
                    escalaX.title.text = repairMojibake(escalaX.title.text || "Longitud (km)");
                    escalaX.title.font = {
                        ...BOUNDARY_CHART_FONT,
                        ...(escalaX.title.font || {}),
                        family: BOUNDARY_CHART_FONT.family,
                        size: fontSizeX
                    };
                }

                chartOptions.datasets = chartOptions.datasets || {};
                chartOptions.datasets.bar = {
                    ...(chartOptions.datasets.bar || {}),
                    categoryPercentage: hasManyLines ? 0.74 : 0.68,
                    barPercentage: hasManyLines ? 0.78 : 0.7,
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

                if (total === 1) chartOptions.barThickness = 24;
                else if (hasFewLines) chartOptions.barThickness = 20;
                else delete chartOptions.barThickness;

                chartOptions.plugins = chartOptions.plugins || {};
                chartOptions.plugins.zoom = {
                    pan: { enabled: hasManyLines, mode: "y", threshold: 5 },
                    zoom: {
                        wheel: { enabled: hasManyLines, speed: 0.06, modifierKey: null },
                        pinch: { enabled: hasManyLines },
                        drag: { enabled: false },
                        mode: "y"
                    },
                    limits: {
                        y: { min: 0, max: Math.max(0, total - 1), minRange: Math.min(visiblesIniciales, total) }
                    }
                };
            }

            function prepareDepartmentChart(canvas, config) {
                if (!canvas || !config || !isDepartmentChart()) return;

                repairTextValues(config.data);
                repairTextValues(config.options);
                applyTooltipFormatting(config);

                const labels = config.data?.labels || [];
                const barCount = labels.length;
                const esUnaBarra = barCount === 1;
                const chartOptions = config.options || (config.options = {});
                const escalas = chartOptions.scales || (chartOptions.scales = {});
                const escalaY = escalas.y || (escalas.y = {});
                const escalaX = escalas.x || (escalas.x = {});

                clearDepartmentCanvasSizing(canvas);
                ensureFont(escalaY.ticks || (escalaY.ticks = {}), departmentYAxisFontSize);
                ensureFont(escalaX.ticks || (escalaX.ticks = {}), departmentXAxisFontSize);

                if (escalaX.title?.text) escalaX.title.text = repairMojibake(escalaX.title.text);
                if (escalaX.title) {
                    escalaX.title.font = {
                        ...BOUNDARY_CHART_FONT,
                        ...(escalaX.title.font || {}),
                        family: BOUNDARY_CHART_FONT.family,
                        size: departmentXAxisFontSize
                    };
                }

                if (esUnaBarra) {
                    canvas.style.height = "240px";
                    canvas.style.minHeight = "240px";
                    canvas.style.maxHeight = "240px";

                    chartOptions.layout = chartOptions.layout || {};
                    chartOptions.layout.padding = { top: 18, right: 20, bottom: 18, left: 8 };

                    escalaY.ticks.padding = 8;
                    escalaY.ticks.autoSkip = false;
                    escalaY.afterFit = function despuesDeAjustarEjeY(axis) {
                        axis.width = Math.max(axis.width, 82);
                    };

                    escalaX.ticks.padding = 6;
                    chartOptions.datasets = chartOptions.datasets || {};
                    chartOptions.datasets.bar = {
                        ...(chartOptions.datasets.bar || {}),
                        categoryPercentage: 0.52,
                        barPercentage: 0.58,
                        borderWidth: 0.3
                    };
                    chartOptions.barThickness = 24;
                } else if (barCount > 1) {
                    const hasFewDepartments = barCount <= 5;
                    const alturaPorBarra = hasFewDepartments ? 28 : 18;
                    const canvasHeight = Math.min(520, 100 + barCount * alturaPorBarra);

                    canvas.style.height = `${canvasHeight}px`;
                    canvas.style.minHeight = `${canvasHeight}px`;
                    canvas.style.maxHeight = `${canvasHeight}px`;
                }
            }

            function AdaptedChart(item, config) {
                const canvas = item?.canvas || item;
                applyTooltipFormatting(config);
                prepareMunicipalChart(canvas, config);
                prepareDepartmentChart(canvas, config);
                return new ChartOriginal(item, config);
            }

            function installChartAdapter(ChartDisponible) {
                if (!ChartDisponible || ChartDisponible.__limitesDepartamentalesAjustado) return;

                ChartOriginal = ChartDisponible;
                Object.setPrototypeOf(AdaptedChart, ChartOriginal);
                AdaptedChart.prototype = ChartOriginal.prototype;
                Object.getOwnPropertyNames(ChartOriginal).forEach(propiedad => {
                    if (!(propiedad in AdaptedChart)) {
                        Object.defineProperty(
                            AdaptedChart,
                            propiedad,
                            Object.getOwnPropertyDescriptor(ChartOriginal, propiedad)
                        );
                    }
                });

                AdaptedChart.__limitesDepartamentalesAjustado = true;
                window.Chart = AdaptedChart;
            }

            if (ChartOriginal) {
                installChartAdapter(ChartOriginal);
            } else {
                Object.defineProperty(window, "Chart", {
                    configurable: true,
                    get() {
                        return undefined;
                    },
                    set(valor) {
                        delete window.Chart;
                        installChartAdapter(valor);
                    }
                });
            }
        })();
    
