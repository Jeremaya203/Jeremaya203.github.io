const ORDEN_FENOMENOS = {
    riesgo: {
        "Muy baja": 1,
        Baja: 2,
        Media: 3,
        Alta: 4,
        "Muy alta": 5,
        "Sin información": 99,
        "Sin información": 99,
    },
    degradacion: {
        "Sin degradación": 1,
        "Sin degradación": 1,
        Ligera: 2,
        Moderada: 3,
        Severa: 4,
        "Muy severa": 5,
        "Sin información": 99,
        "Sin información": 99,
    },
    sismica: {
        Baja: 1,
        Intermedia: 2,
        Alta: 3,
        "Sin información": 99,
        "Sin información": 99,
    },
};

export function createLegendRenderer({ getActiveLayerConfig }) {
    function colorToCss(color, fallback = "#999") {
        if (Array.isArray(color)) {
            const [r, g, b, a = 255] = color;
            const alpha = Number(a) > 1 ? Number(a) / 255 : Number(a);
            return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
        }

        if (color && typeof color === "object") {
            const r = color.r ?? color.red;
            const g = color.g ?? color.green;
            const b = color.b ?? color.blue;
            const a = color.a ?? color.alpha ?? 1;
            if ([r, g, b].every(value => value != null && Number.isFinite(Number(value)))) {
                const alpha = Number(a) > 1 ? Number(a) / 255 : Number(a);
                return `rgba(${Number(r)}, ${Number(g)}, ${Number(b)}, ${Math.max(0, Math.min(1, alpha))})`;
            }
        }

        return color || fallback;
    }

    function colorWithAlpha(color, alpha, fallback = "#999") {
        if (Array.isArray(color)) {
            const [r, g, b] = color;
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }

        if (color && typeof color === "object") {
            const r = color.r ?? color.red;
            const g = color.g ?? color.green;
            const b = color.b ?? color.blue;
            if ([r, g, b].every(value => value != null && Number.isFinite(Number(value)))) {
                return `rgba(${Number(r)}, ${Number(g)}, ${Number(b)}, ${alpha})`;
            }
        }

        const hex = String(color || "").match(/^#([0-9a-f]{6})$/i);
        if (hex) {
            const value = parseInt(hex[1], 16);
            return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
        }

        return fallback;
    }

    function isTransparentColor(color) {
        if (!color) return true;

        if (Array.isArray(color)) {
            const alpha = color.length > 3 ? Number(color[3]) : 255;
            return Number.isFinite(alpha) && alpha <= 0;
        }

        if (typeof color === "object") {
            const alpha = color.a ?? color.alpha;
            if (alpha == null) return false;
            const normalizedAlpha = Number(alpha) > 1 ? Number(alpha) / 255 : Number(alpha);
            return Number.isFinite(normalizedAlpha) && normalizedAlpha <= 0;
        }

        return false;
    }

    function legendPatternBackground(symbol, fallbackColor) {
        const baseColor = colorWithAlpha(symbol?.color || fallbackColor, 0.48, fallbackColor);
        const patternLineSource = isTransparentColor(symbol?.outline?.color)
            ? symbol?.color
            : symbol?.outline?.color || symbol?.color;
        const lineColor = colorToCss(patternLineSource, fallbackColor);
        const style = String(symbol?.style || "").toLowerCase();
        const normalizedStyle = style.replace(/[^a-z]/g, "");
        const isDiagonalCross = normalizedStyle.includes("diagonalcross") || style.includes("diagonal-cross");
        const isCross = isDiagonalCross || normalizedStyle.includes("cross");
        const isVertical = normalizedStyle.includes("vertical");
        const isHorizontal = normalizedStyle.includes("horizontal");
        const isBackwardDiagonal = normalizedStyle.includes("backwarddiagonal");
        const isForwardDiagonal = normalizedStyle.includes("forwarddiagonal");
        const isDiagonal = isBackwardDiagonal || isForwardDiagonal || normalizedStyle.includes("diagonal");

        if (isCross) {
            return [
                `repeating-linear-gradient(45deg, transparent 0 4px, ${lineColor} 4px 5px)`,
                `repeating-linear-gradient(-45deg, transparent 0 4px, ${lineColor} 4px 5px)`,
                `linear-gradient(${baseColor}, ${baseColor})`
            ].join(",");
        }

        if (isVertical) {
            return [
                `repeating-linear-gradient(90deg, transparent 0 4px, ${lineColor} 4px 5px)`,
                `linear-gradient(${baseColor}, ${baseColor})`
            ].join(",");
        }

        if (isHorizontal) {
            return [
                `repeating-linear-gradient(0deg, transparent 0 4px, ${lineColor} 4px 5px)`,
                `linear-gradient(${baseColor}, ${baseColor})`
            ].join(",");
        }

        if (isDiagonal) {
            const angle = isBackwardDiagonal ? "-45deg" : "45deg";
            return [
                `repeating-linear-gradient(${angle}, transparent 0 4px, ${lineColor} 4px 5px)`,
                `linear-gradient(${baseColor}, ${baseColor})`
            ].join(",");
        }

        return baseColor;
    }

    function legendSolidBackground(symbol, fallbackColor) {
        return colorWithAlpha(symbol?.color || fallbackColor, 0.65, fallbackColor);
    }

    function isLineSymbol(symbol) {
        const type = String(symbol?.type || "").toLowerCase();
        return type === "simple-line" || type === "esrisls" || type.includes("line");
    }

    function isPictureMarkerSymbol(symbol) {
        const type = String(symbol?.type || "").toLowerCase();
        return type === "picture-marker" || type === "esripms" || Boolean(symbol?.imageData);
    }

    function pictureMarkerSource(symbol) {
        const imageData = String(symbol?.imageData || "").trim();
        if (imageData) {
            const contentType = String(symbol?.contentType || "image/png").trim() || "image/png";
            return `data:${contentType};base64,${imageData}`;
        }

        const url = String(symbol?.url || "").trim();
        return /^https?:\/\//i.test(url) || url.startsWith("data:") ? url : "";
    }

    function appendPictureMarkerSymbol(swatch, symbol) {
        const src = pictureMarkerSource(symbol);
        if (!src) return false;

        const img = document.createElement("img");
        img.src = src;
        img.alt = "";
        img.decoding = "async";
        img.loading = "lazy";
        img.style.display = "block";
        img.style.width = "20px";
        img.style.height = "20px";
        img.style.objectFit = "contain";
        img.style.pointerEvents = "none";
        swatch.appendChild(img);
        return true;
    }

    function lineDashForSymbol(symbol) {
        const style = String(symbol?.style || "").toLowerCase();
        if (style.includes("shortdashdotdot")) return "5 2 1.5 2 1.5 2";
        if (style.includes("dashdotdot")) return "9 3 2 3 2 3";
        if (style.includes("longdashdot")) return "13 4 2 4";
        if (style.includes("dashdot")) return "9 3 2 3";
        if (style.includes("longdash")) return "14 5";
        if (style.includes("shortdash")) return "5 3";
        if (style.includes("dash")) return "8 4";
        if (style.includes("shortdot")) return "1.5 2.5";
        if (style.includes("dot")) return "2 4";
        return "";
    }

    function appendLineSymbol(swatch, symbol, fallbackColor) {
        const lineColor = colorToCss(symbol?.color || symbol?.outline?.color, fallbackColor);
        const rawWidth = Number(symbol?.width || 1);
        const strokeWidth = Math.max(1.4, Math.min(5, rawWidth * 2));
        const dashArray = lineDashForSymbol(symbol);
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");

        svg.setAttribute("viewBox", "0 0 34 14");
        svg.setAttribute("width", "34");
        svg.setAttribute("height", "14");
        svg.setAttribute("aria-hidden", "true");
        svg.style.display = "block";
        svg.style.overflow = "visible";

        line.setAttribute("x1", "2");
        line.setAttribute("y1", "7");
        line.setAttribute("x2", "32");
        line.setAttribute("y2", "7");
        line.setAttribute("stroke", lineColor || fallbackColor || "#999");
        line.setAttribute("stroke-width", String(strokeWidth));
        line.setAttribute("stroke-linecap", dashArray ? "butt" : "round");
        line.setAttribute("shape-rendering", "geometricPrecision");
        if (dashArray) {
            line.setAttribute("stroke-dasharray", dashArray);
        }

        svg.appendChild(line);
        swatch.appendChild(svg);
    }

    function resolveOrder(config) {
        if (!config?.isFenomenos) return null;

        if (
            config.fenomenosType === "inundaciones" ||
            config.fenomenosType === "remocion"
        ) {
            return ORDEN_FENOMENOS.riesgo;
        }

        if (config.fenomenosType === "degradacion")
            return ORDEN_FENOMENOS.degradacion;
        if (config.fenomenosType === "sismica") return ORDEN_FENOMENOS.sismica;

        return null;
    }

function actualizarLeyenda(labels, colors, codes = null, options = {}) {
    try {
        const content = document.getElementById("legendContent");
        const title = document.getElementById("legendTitle");
        const config = getActiveLayerConfig();

            if (!content || !title) return;

            if (!config) {
                content.innerHTML =
                    "<p style='margin:0; color:#666;'>No hay capa activa</p>";
                title.textContent = "Leyenda";
                return;
            }

            title.textContent = config.title || "Leyenda";
            window.__lastLegendRenderKey = window.__lastLegendRenderKey || "";

            if (!labels || !labels.length) {
                content.innerHTML = "<p style='margin:0; color:#666;'>Sin clases</p>";
                const legendState = window.__legendState || {};
                window.__legendState = {
                    ...legendState,
                    allCodes: [],
                activeCodes: new Set(),
                visibleCodes: null,
                field: options.field || legendState.field || null,
                customApply: options.customApply || legendState.customApply || null,
                codeGroups: options.codeGroups || null,
                    baseWhere: options.baseWhere || legendState.baseWhere || "1=1",
                    layers: options.layers || legendState.layers || []
                };
                return;
            }

            let keys =
                codes && codes.length === labels.length
                    ? codes.map((value) => String(value ?? "").trim())
                    : labels.map((value) => String(value ?? "").trim());

            const legendState = window.__legendState || {};
            window.__legendState = {
                ...legendState,
                allCodes: keys,
                activeCodes: new Set(keys),
                visibleCodes: null,
                field: options.field || legendState.field || null,
                customApply: options.customApply || legendState.customApply || null,
                codeGroups: options.codeGroups || null,
                baseWhere: options.baseWhere || legendState.baseWhere || "1=1",
                layers: options.layers || legendState.layers || []
            };

            const orden = options.preserveOrder ? null : resolveOrder(config);
            if (orden) {
                const items = labels.map((label, index) => ({
                    label,
                    color: colors[index] || "#ccc",
                    code: keys[index],
                    symbol: options.symbols?.[index] || null,
                    section: options.sections?.[index] || ""
                }));

                items.sort(
                    (a, b) => (orden?.[a.label] ?? 999) - (orden?.[b.label] ?? 999),
                );

                labels = items.map((item) => item.label);
                colors = items.map((item) => item.color);
                keys = items.map((item) => item.code);
                options.symbols = items.map((item) => item.symbol);
                options.sections = items.map((item) => item.section);
            }

            content.innerHTML = "";
            const frag = document.createDocumentFragment();
            const legendHeading = String(options.legendHeading || config?.chartConfig?.legendHeading || "").trim();
            const sections = Array.isArray(options.sections)
                ? options.sections.map(value => String(value || "").trim())
                : [];
            const hasSections = sections.some(Boolean);
            if (legendHeading && !hasSections) {
                const heading = document.createElement("div");
                heading.className = "legend-section-heading";
                heading.textContent = legendHeading;
                heading.style.fontWeight = "700";
                heading.style.fontSize = "12px";
                heading.style.color = "#5c3a12";
                heading.style.margin = "0 0 8px";
                heading.style.lineHeight = "1.25";
                frag.appendChild(heading);
            }

            let currentSection = null;
            labels.forEach((label, index) => {
                const section = sections[index] || "";
                if (section && section !== currentSection) {
                    currentSection = section;
                    const heading = document.createElement("div");
                    heading.className = "legend-section-heading";
                    heading.textContent = section;
                    heading.style.fontWeight = "700";
                    heading.style.fontSize = "12px";
                    heading.style.color = "#5c3a12";
                    heading.style.margin = index === 0 ? "0 0 8px" : "10px 0 8px";
                    heading.style.lineHeight = "1.25";
                    frag.appendChild(heading);
                }

                const row = document.createElement("div");
                row.className = "legend-row legend-item active";
                row.dataset.code = keys[index] || "";
                row.setAttribute("role", "button");
                row.setAttribute("tabindex", "0");
                row.title = "Activar o desactivar categoría";
                row.style.display = "flex";
                row.style.alignItems = "center";
                row.style.gap = "8px";
                row.style.marginBottom = "6px";
                row.style.cursor = "pointer";

                const swatch = document.createElement("span");
                swatch.className = "legend-swatch";
                swatch.style.display = "inline-block";
                swatch.style.width = "12px";
                swatch.style.height = "12px";
                swatch.style.minWidth = "12px";
                swatch.style.borderRadius = "2px";
                swatch.style.marginRight = "8px";
                swatch.style.flex = "0 0 12px";
                const symbol = options.symbols?.[index] || null;
                if (symbol && isPictureMarkerSymbol(symbol) && appendPictureMarkerSymbol(swatch, symbol)) {
                    swatch.style.width = "22px";
                    swatch.style.height = "22px";
                    swatch.style.minWidth = "22px";
                    swatch.style.flex = "0 0 22px";
                    swatch.style.borderRadius = "0";
                    swatch.style.marginRight = "6px";
                    swatch.style.background = "transparent";
                    swatch.style.border = "0";
                    swatch.style.display = "inline-flex";
                    swatch.style.alignItems = "center";
                    swatch.style.justifyContent = "center";
                } else if (symbol && isLineSymbol(symbol)) {
                    swatch.style.width = "34px";
                    swatch.style.height = "14px";
                    swatch.style.minWidth = "34px";
                    swatch.style.flex = "0 0 34px";
                    swatch.style.borderRadius = "0";
                    swatch.style.marginRight = "4px";
                    swatch.style.background = "transparent";
                    swatch.style.border = "0";
                    swatch.style.transform = "none";
                    appendLineSymbol(swatch, symbol, colors[index] || "#999");
                } else {
                    swatch.style.background = symbol
                        ? legendPatternBackground(symbol, colors[index] || "#999")
                        : colors[index] || "#999";
                    if (symbol) {
                        swatch.style.width = "18px";
                        swatch.style.height = "18px";
                        swatch.style.minWidth = "18px";
                        swatch.style.flex = "0 0 18px";
                        if (!String(symbol?.style || "").trim() || String(symbol?.style || "").toLowerCase() === "solid") {
                            swatch.style.background = legendSolidBackground(symbol, colors[index] || "#999");
                        }
                        swatch.style.border = `1px solid ${colorToCss(symbol?.outline?.color, colors[index] || "#999")}`;
                    }
                }

                const text = document.createElement("span");
                text.className = "legend-label";
                text.textContent = label ?? "Sin etiqueta";

                row.appendChild(swatch);
                row.appendChild(text);
                frag.appendChild(row);
            });

            content.appendChild(frag);
        } catch (e) {
            console.error("actualizarLeyenda error:", e);
        }
    }

    window.actualizarLeyenda = actualizarLeyenda;

    return { actualizarLeyenda };
}
