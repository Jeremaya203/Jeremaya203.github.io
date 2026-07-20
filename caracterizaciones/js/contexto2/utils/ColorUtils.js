/**
 * ColorUtils.js — Utilidades de Color
 *
 * Funciones para convertir colores entre formatos usados por
 * ArcGIS y CSS.
 *
 * Responsabilidad:
 *   - rgbaFromEsriColor(color): [r,g,b,a] → 'rgba(r,g,b,a)'
 *   - rgbaArrayToCss(arr, fallback): array → CSS string
 *
 * Dependencias:
 *   - Ninguna
 */
export class ColorUtils {
    static toCss(color, fallback = '#999') {
        if (Array.isArray(color)) return this.rgbaArrayToCss(color, fallback);
        if (typeof color === 'string') return color;

        const rgba = this._readRgba(color);
        if (rgba) return this.rgbaArrayToCss(rgba, fallback);

        return fallback;
    }

    static rgbaFromEsriColor(c) {
        if (Array.isArray(c)) {
            const [r, g, b, a = 255] = c;
            return `rgba(${r},${g},${b},${this._normalizeAlpha(a)})`;
        }
        return '#999';
    }

    static rgbaArrayToCss(arr, fallback = '#999') {
        if (!Array.isArray(arr) || arr.length < 3) return fallback;
        const [r, g, b, a = 255] = arr;
        return `rgba(${r},${g},${b},${this._normalizeAlpha(a)})`;
    }

    static _readRgba(color) {
        if (!color || typeof color !== 'object') return null;

        if (typeof color.toRgba === 'function') {
            const rgba = color.toRgba();
            if (Array.isArray(rgba)) return rgba;
        }

        if (typeof color.toJSON === 'function') {
            const json = color.toJSON();
            if (Array.isArray(json)) return json;
            const fromJson = this._readRgbaObject(json);
            if (fromJson) return fromJson;
        }

        return this._readRgbaObject(color);
    }

    static _readRgbaObject(color) {
        if (!color || typeof color !== 'object') return null;
        const r = color.r ?? color.red;
        const g = color.g ?? color.green;
        const b = color.b ?? color.blue;
        const a = color.a ?? color.alpha ?? 1;

        if ([r, g, b].some(value => typeof value !== 'number')) return null;
        return [r, g, b, a];
    }

    static _normalizeAlpha(alpha) {
        const value = Number(alpha);
        if (!Number.isFinite(value)) return 1;
        return Math.max(0, Math.min(1, value <= 1 ? value : value / 255));
    }
}
