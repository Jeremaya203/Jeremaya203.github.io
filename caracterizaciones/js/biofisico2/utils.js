export function debounce(fn, ms = 120) {
    let t = null;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), ms);
    };
}


export function toNum(v) {
    if (v == null) return null;
    const s = String(v).trim();
    if (!s) return null;
    // convierte "155,8" -> 155.8
    const n = Number(s.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
}


export function pctOfTotal(value, total) {
    const v = Number(value) || 0;
    const t = Number(total) || 0;
    return t > 0 ? (v / t) * 100 : 0;
    }

export function ensureNonEmptyOrExit(ctx, rows) {
    if (rows && rows.length) return true;
    ctx.destroyChart();
    ctx.actualizarLeyenda?.([], []);
    return false;
    }

export function buildDictFromUniqueValueRenderer(layer) {
    const m = new Map();
    const r = layer?.renderer;
    if (!r || r.type !== "unique-value") return m;

    const symbolColorToCss = (symbol) => {
        const color = symbol?.color;
        if (!color) return null;
        if (typeof color.toCss === "function") return color.toCss(true);
        if (Array.isArray(color)) {
            const [red = 153, green = 153, blue = 153, alpha = 255] = color;
            const opacity = alpha > 1 ? alpha / 255 : alpha;
            return `rgba(${red},${green},${blue},${Number.isFinite(opacity) ? opacity : 1})`;
        }
        if (typeof color === "object" && color !== null) {
            const red = color.r ?? color.red ?? 153;
            const green = color.g ?? color.green ?? 153;
            const blue = color.b ?? color.blue ?? 153;
            const alpha = color.a ?? color.alpha ?? 1;
            const opacity = alpha > 1 ? alpha / 255 : alpha;
            return `rgba(${red},${green},${blue},${Number.isFinite(opacity) ? opacity : 1})`;
        }
        return String(color);
    };

    const addInfo = (value, label, symbol) => {
        const v = String(value ?? "").trim();
        if (!v) return;
        m.set(v, {
            label: String(label ?? v).trim() || v,
            color: symbolColorToCss(symbol) || "#999"
        });
    };

    (r.uniqueValueInfos || []).forEach(info => {
        addInfo(info.value, info.label, info.symbol);
    });

    (r.uniqueValueGroups || []).forEach(group => {
        (group.classes || []).forEach(cls => {
            const rawValues = Array.isArray(cls.values) && cls.values.length
                ? cls.values
                : [cls.value];

            rawValues.forEach(raw => {
                const value = Array.isArray(raw)
                    ? raw.flat(Infinity).map(part => String(part ?? "").trim()).filter(Boolean).join(",")
                    : raw;
                addInfo(value, cls.label || cls.description, cls.symbol);
            });
        });
    });

    return m;
}


export function wrapLabel(text, maxLen = 22) {
    if (!text) return text;

    const words = String(text).split(' ');
    const lines = [];
    let line = '';

    for (const w of words) {
        const test = (line ? line + ' ' : '') + w;

        if (test.length > maxLen) {
        if (line) lines.push(line);
        line = w;
        } else {
        line = test;
        }
    }

    if (line) lines.push(line);

    return lines; // ← importante: devuelve array
}


export function escapeSqlString(s){
    return String(s).replace(/'/g, "''");
}


export function ordenarMeses(meses) {
    const ordenMeses = {
        'Enero': 1, 'Febrero': 2, 'Marzo': 3, 'Abril': 4,
        'Mayo': 5, 'Junio': 6, 'Julio': 7, 'Agosto': 8,
        'Septiembre': 9, 'Octubre': 10, 'Noviembre': 11, 'Diciembre': 12
    };
    return meses.sort((a, b) => (ordenMeses[a] || 99) - (ordenMeses[b] || 99));
}


export function rgbaFromEsriColor(c) {
    // c puede venir como [r,g,b,a]
    if (Array.isArray(c)) {
        const [r, g, b, a = 255] = c;
        const alpha = Math.max(0, Math.min(1, a / 255));
        return `rgba(${r},${g},${b},${alpha})`;
    }
    return "#999";
}


export function rgbaFromEsriColorArr(c) {
    if (!Array.isArray(c)) return "#999";
    const [r,g,b,a=255] = c;
    return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a/255))})`;
}


export function normKey(x){
    return String(x ?? "").trim().toLowerCase();
}
