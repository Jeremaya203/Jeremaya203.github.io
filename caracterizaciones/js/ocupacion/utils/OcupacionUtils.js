export class OcupacionUtils {
    static debounce(fn, ms = 120) {
        let timeout = null;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => fn(...args), ms);
        };
    }

    static toNum(value) {
        if (value == null) return null;
        const text = String(value).trim();
        if (!text) return null;
        const number = Number(text.replace(/\./g, "").replace(",", "."));
        return Number.isFinite(number) ? number : null;
    }

    static pctOfTotal(value, total) {
        const numericValue = Number(value) || 0;
        const numericTotal = Number(total) || 0;
        return numericTotal > 0 ? (numericValue / numericTotal) * 100 : 0;
    }

    static ensureNonEmptyOrExit(ctx, rows) {
        if (rows && rows.length) return true;
        ctx.destroyChart();
        ctx.actualizarLeyenda?.([], []);
        return false;
    }

    static wrapLabel(text, maxLen = 22) {
        if (!text) return text;

        const words = String(text).split(" ");
        const lines = [];
        let line = "";

        words.forEach(word => {
            const test = (line ? line + " " : "") + word;

            if (test.length > maxLen) {
                if (line) lines.push(line);
                line = word;
            } else {
                line = test;
            }
        });

        if (line) lines.push(line);
        return lines;
    }

    static ordenarMeses(meses) {
        const monthOrder = {
            Enero: 1,
            Febrero: 2,
            Marzo: 3,
            Abril: 4,
            Mayo: 5,
            Junio: 6,
            Julio: 7,
            Agosto: 8,
            Septiembre: 9,
            Octubre: 10,
            Noviembre: 11,
            Diciembre: 12
        };

        return meses.sort((a, b) => (monthOrder[a] || 99) - (monthOrder[b] || 99));
    }

    static rgbaFromEsriColor(color) {
        if (!Array.isArray(color)) return "#999";
        const [red, green, blue, alpha = 255] = color;
        return `rgba(${red},${green},${blue},${Math.max(0, Math.min(1, alpha / 255))})`;
    }

    static normKey(value) {
        return String(value ?? "").trim().toLowerCase();
    }
}
