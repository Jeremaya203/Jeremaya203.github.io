/**
 * FormatUtils.js — Utilidades de Formato
 *
 * Funciones para formatear números, textos y etiquetas.
 *
 * Responsabilidad:
 *   - toNum(value): convierte string con formato colombiano a número
 *   - pctOfTotal(value, total): calcula porcentaje
 *   - wrapLabel(text, maxLen): divide texto largo en líneas
 *   - ordenarMeses(meses): ordena array de meses cronológicamente
 *
 * Dependencias:
 *   - Ninguna
 */
export class FormatUtils {
    static toNum(v) {
        if (v == null) return null;
        const s = String(v).trim();
        if (!s) return null;
        const n = Number(s.replace(/\./g, '').replace(',', '.'));
        return Number.isFinite(n) ? n : null;
    }

    static pctOfTotal(value, total) {
        const v = Number(value) || 0;
        const t = Number(total) || 0;
        return t > 0 ? (v / t) * 100 : 0;
    }

    static wrapLabel(text, maxLen = 22) {
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
        return lines;
    }
}
