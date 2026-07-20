export class LegendDataExtractor {
    static buildFromRenderer(layer) {
        const renderer = layer?.renderer;
        if (!renderer) return null;

        if (renderer.type === "unique-value") {
            return this._fromUniqueValueRenderer(renderer);
        }

        if (renderer.type === "class-breaks") {
            return this._fromClassBreaksRenderer(renderer);
        }

        if (renderer.type === "simple") {
            return {
                labels: ["Cobertura"],
                colors: [this.getSymbolColorRGBA(renderer.symbol) || "#999"],
                codes: ["0"],
                styles: [renderer.symbol?.style || "solid"]
            };
        }

        return null;
    }

    static getSymbolColorRGBA(symbol) {
        const color = symbol?.color;
        if (!color) return null;

        if (Array.isArray(color)) {
            const [red, green, blue, alpha = 255] = color;
            return `rgba(${red},${green},${blue},${Math.max(0, Math.min(1, alpha / 255))})`;
        }

        if (typeof color === "object" && color.r != null) {
            return `rgba(${color.r},${color.g},${color.b},${color.a ?? 1})`;
        }

        return null;
    }

    static sortEntries(config, entries) {
        if (!config) return entries;

        const extraerValorOrden = label => {
            const text = String(label || "")
                .replace(/,/g, ".")
                .replace(/–/g, "-")
                .replace(/\s+/g, " ")
                .trim();

            if (/^>/.test(text) || /^>=/.test(text)) {
                const match = text.match(/-?\d+(\.\d+)?/);
                return match ? Number(match[0]) + 100000 : 999999;
            }

            if (/^</.test(text) || /^<=/.test(text)) {
                const match = text.match(/-?\d+(\.\d+)?/);
                return match ? Number(match[0]) - 100000 : -999999;
            }

            const match = text.match(/-?\d+(\.\d+)?/);
            return match ? Number(match[0]) : 9999;
        };

        if (config.isClima && ["precip", "temp"].includes(config.climaType)) {
            return entries.slice().sort((a, b) => extraerValorOrden(a.label) - extraerValorOrden(b.label));
        }

        return entries.slice().sort((a, b) => String(a.label).localeCompare(String(b.label), "es"));
    }

    static _fromUniqueValueRenderer(renderer) {
        const labels = [];
        const colors = [];
        const codes = [];
        const styles = [];

        (renderer.uniqueValueInfos || []).forEach(info => {
            const value = info.value ?? "";
            labels.push(info.label || String(value));
            colors.push(this.getSymbolColorRGBA(info.symbol) || "#999");
            styles.push(info.symbol?.style || "solid");
            codes.push(String(value));
        });

        (renderer.uniqueValueGroups || []).forEach(group => {
            (group.classes || []).forEach(item => {
                const rawValue = item?.values?.[0]?.[0] ?? item?.label ?? item?.description ?? "";
                labels.push(item?.label || item?.description || String(rawValue));
                colors.push(this.getSymbolColorRGBA(item.symbol) || "#999");
                styles.push(item.symbol?.style || "solid");
                codes.push(String(rawValue));
            });
        });

        return this._dedupe({ labels, colors, codes, styles });
    }

    static _fromClassBreaksRenderer(renderer) {
        const labels = [];
        const colors = [];
        const codes = [];
        const styles = [];

        (renderer.classBreakInfos || []).forEach((info, index) => {
            labels.push(info.label || `${info.minValue} - ${info.maxValue}`);
            colors.push(this.getSymbolColorRGBA(info.symbol) || "#999");
            styles.push(info.symbol?.style || "solid");
            codes.push(String(index));
        });

        return { labels, colors, codes, styles };
    }

    static _dedupe({ labels, colors, codes, styles }) {
        const seen = new Set();
        const result = { labels: [], colors: [], codes: [], styles: [] };

        labels.forEach((label, index) => {
            const key = `${codes[index]}||${label}`;
            if (seen.has(key)) return;
            seen.add(key);

            result.labels.push(label);
            result.colors.push(colors[index]);
            result.codes.push(codes[index]);
            result.styles.push(styles[index]);
        });

        return result;
    }
}
