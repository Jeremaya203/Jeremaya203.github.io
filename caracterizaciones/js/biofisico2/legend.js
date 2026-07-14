export function buildLegendFromRenderer(layer) {
    const r = layer?.renderer;
    if (!r) return null;
    const rendererJson = typeof r.toJSON === "function" ? r.toJSON() : r;
    const rendererType = String(r.type || rendererJson?.type || "").toLowerCase();

    const pull = (symbol) => getSymbolColorRGBA(symbol) || "#999";

    if (rendererType === "unique-value" || rendererType === "uniquevalue") {
        const labels = [];
        const colors = [];
        const codes = [];

        const uniqueValueInfos = r.uniqueValueInfos || rendererJson?.uniqueValueInfos || [];
        const uniqueValueGroups = r.uniqueValueGroups || rendererJson?.uniqueValueGroups || [];

        // Caso 1: renderer clÃ¡sico
        uniqueValueInfos.forEach(info => {
            const val = info.value ?? "";
            const lbl = info.label || String(val);

            labels.push(lbl);
            colors.push(pull(info.symbol));
            codes.push(String(val));
        });

        // Caso 2: renderer agrupado (como degradaciÃ³n del suelo)
        uniqueValueGroups.forEach(group => {
            (group.classes || []).forEach(cls => {
                const rawValues = Array.isArray(cls?.values) && cls.values.length
                    ? cls.values
                    : [cls?.value ?? cls?.label ?? cls?.description ?? ""];
                const lbl = cls?.label || cls?.description || "";

                rawValues.forEach(raw => {
                    const rawVal = Array.isArray(raw)
                        ? raw.flat(Infinity).map(part => String(part ?? "").trim()).filter(Boolean).join(",")
                        : String(raw ?? "").trim();
                    labels.push(lbl || rawVal);
                    colors.push(pull(cls.symbol));
                    codes.push(rawVal);
                });
            });
        });

        // Evitar duplicados por label+code
        const seen = new Set();
        const finalLabels = [];
        const finalColors = [];
        const finalCodes = [];

        for (let i = 0; i < labels.length; i++) {
            const key = `${codes[i]}||${labels[i]}`;
            if (seen.has(key)) continue;
            seen.add(key);

            finalLabels.push(labels[i]);
            finalColors.push(colors[i]);
            finalCodes.push(codes[i]);
        }

        return {
            labels: finalLabels,
            colors: finalColors,
            codes: finalCodes
        };
    }

    if (rendererType === "class-breaks" || rendererType === "classbreaks") {
        const labels = [];
        const colors = [];
        const codes = [];

        (r.classBreakInfos || []).forEach((info, idx) => {
            const lbl = info.label || `${info.minValue} â€“ ${info.maxValue}`;
            labels.push(lbl);
            colors.push(pull(info.symbol));
            codes.push(String(idx));
        });

        return { labels, colors, codes };
    }

    if (rendererType === "simple") {
        return {
            labels: ["Cobertura"],
            colors: [pull(r.symbol)],
            codes: ["0"]
        };
    }

    return null;
}


export function getSymbolColorRGBA(symbol) {
    const findColor = (value, depth = 0) => {
        if (!value || depth > 4) return null;

        if (Array.isArray(value)) return value;
        if (typeof value === "string") return value;
        if (typeof value.toRgba === "function") return value.toRgba();
        if (typeof value.toRGBA === "function") return value.toRGBA();
        if (typeof value.toCss === "function") return value.toCss();
        if (typeof value.toHex === "function") return value.toHex();
        if (value.r != null && value.g != null && value.b != null) return value;
        if (Array.isArray(value.values)) return value.values;

        return null;
    };

    const symbolJson = typeof symbol?.toJSON === "function" ? symbol.toJSON() : null;
    const candidates = [
        symbol?.color,
        symbol?.material?.color,
        ...(symbol?.symbolLayers || []).flatMap(layer => [
            layer?.color,
            layer?.material?.color,
            layer?.outline?.color
        ]),
        symbol?.outline?.color,
        symbolJson?.color,
        symbolJson?.material?.color,
        ...(symbolJson?.symbolLayers || []).flatMap(layer => [
            layer?.color,
            layer?.material?.color,
            layer?.outline?.color
        ]),
        symbolJson?.outline?.color
    ];

    const c = candidates.map(candidate => findColor(candidate)).find(Boolean);

    if (!c) return null;
    if (Array.isArray(c)) {
        const [r,g,b,a=255] = c;
        const alpha = Number(a) <= 1 ? Number(a) : Number(a) / 255;
        return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha))})`;
    }
    if (typeof c === "object" && c.r != null) {
        const rawAlpha = c.a ?? 1;
        const alpha = Number(rawAlpha) <= 1 ? Number(rawAlpha) : Number(rawAlpha) / 255;
        return `rgba(${c.r},${c.g},${c.b},${Math.max(0, Math.min(1, alpha))})`;
    }
    if (typeof c === "string") return c;
    return null;
    }

    // function normKey(x){
    // return String(x ?? "").trim().toLowerCase();
    // }


export function sortLegendEntries(config, entries) {
    // entries: Array<{label,color, rawCode?}>
    if (!config) return entries;

    // Clima tipo (7001..7023)
    if (config.isClima && config.climaType === "clima_tipo") {
        const order = Object.keys(coloresClimas || {}).sort((a,b)=>Number(a)-Number(b));
        const idx = new Map(order.map((c,i)=>[coloresClimas[c]?.label || c, i]));
        return entries.slice().sort((a,b)=>(idx.get(a.label) ?? 9999) - (idx.get(b.label) ?? 9999));
    }

    // Hipsometría(1001..) municipal y departamental
    if (config.id === "hipsometria" || config.id === "hipsometria_depto" || config.isDeptoAgg) {
        const order = Object.keys(coloresHipsometricos || {}).map(Number).sort((a,b)=>a-b).map(String);
        const idx = new Map(order.map((c,i)=>[(coloresHipsometricos[c]?.label || c), i]));
        return entries.slice().sort((a,b)=>(idx.get(a.label) ?? 9999) - (idx.get(b.label) ?? 9999));
    }

    // EscorrentÃ­a numÃ©rico
    if (config.isHidro && config.hidroType === "escorrentia") {
        const inv = new Map(Object.entries(coloresEscorrentia || {}).map(([k,v])=>[v.label, Number(k)]));
        return entries.slice().sort((a,b)=>(inv.get(a.label) ?? 9999) - (inv.get(b.label) ?? 9999));
    }

    const extraerValorOrden = (label) => {
        const txt = String(label || "")
            .replace(/,/g, ".")
            .replace(/â€“/g, "-")
            .replace(/\s+/g, " ")
            .trim();

        // Casos tipo "> 28" o ">= 28" -> deben ir al final
        if (/^>/.test(txt) || /^>=/.test(txt)) {
            const match = txt.match(/-?\d+(\.\d+)?/);
            return match ? Number(match[0]) + 100000 : 999999;
        }

        // Casos tipo "< 5" o "<= 5" -> deben ir al inicio
        if (/^</.test(txt) || /^<=/.test(txt)) {
            const match = txt.match(/-?\d+(\.\d+)?/);
            return match ? Number(match[0]) - 100000 : -999999;
        }

        // Casos normales tipo "16 - 20"
        const match = txt.match(/-?\d+(\.\d+)?/);
        return match ? Number(match[0]) : 9999;
    };

    // PrecipitaciÃ³n: ordenar dinÃ¡micamente por el primer nÃºmero del label
    if (config.isClima && config.climaType === "precip") {
        return entries.slice().sort((a, b) => {
            return extraerValorOrden(a.label) - extraerValorOrden(b.label);
        });
    }

    // Temperatura: ordenar dinÃ¡micamente por rango y mandar "> x" al final
    if (config.isClima && config.climaType === "temp") {
        return entries.slice().sort((a, b) => {
            return extraerValorOrden(a.label) - extraerValorOrden(b.label);
        });
    }

    // Por defecto: alfabÃ©tico
    return entries.slice().sort((a,b)=>String(a.label).localeCompare(String(b.label), "es"));
}

function _normTxt(value) {
    if (value === null || value === undefined) return "";
    return String(value)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}


export function syncLegendToLabelSelection(clickedLabel){
    const content = document.getElementById("legendContent");
    if (!content) return;

    const items = Array.from(content.querySelectorAll(".legend-item"));
    if (!items.length) return;

    const target = _normTxt(clickedLabel);

    // busca por el texto visible de la leyenda (no por code)
    const hit = items.find(it => {
        const lbl = it.querySelector(".legend-label")?.textContent;
        return _normTxt(lbl) === target;
    });

    // Si no encontrÃ³ match exacto, no rompas nada
    if (!hit) return;

    // Estado global (si existe)
    window.__legendState = window.__legendState || { allCodes: [], activeCodes: new Set() };

    const isAlreadySingle =
        window.__legendState.activeCodes?.size === 1 &&
        window.__legendState.activeCodes.has(String(hit.dataset.code));

    // TOGGLE: si ya estaba solo ese, vuelve a "ver todo"
    if (isAlreadySingle) {
        // prender todo visual
        items.forEach(it => it.classList.remove("off"));
        // estado
        window.__legendState.activeCodes = new Set(items.map(it => String(it.dataset.code)));
        // y quitar filtro del mapa (volver a whereBase)
        if (typeof applyWhereToActiveLayers === "function") applyWhereToActiveLayers(whereBase);
        return;
    }

    // dejar SOLO el seleccionado (visual)
    items.forEach(it => {
        const isHit = it === hit;
        it.classList.toggle("off", !isHit);
    });

    // estado: solo ese code activo
    window.__legendState.activeCodes = new Set([String(hit.dataset.code)]);
}

