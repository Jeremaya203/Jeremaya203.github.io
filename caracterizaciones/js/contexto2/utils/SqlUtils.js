/**
 * SqlUtils.js — Utilidades para Consultas SQL en ArcGIS
 *
 * Funciones para escapar strings y construir cláusulas WHERE
 * de forma segura.
 *
 * Responsabilidad:
 *   - escapeString(s): escapa comillas simples para SQL
 *   - buildInClause(field, values, fieldType): construye IN (...)
 *   - buildWhere(baseWhere, additionalWhere): combina WHEREs con AND
 *
 * Dependencias:
 *   - Ninguna
 */
export class SqlUtils {
    static escapeString(s) {
        return String(s).replace(/'/g, "''");
    }

    static equals(field, value, fieldType = 'string') {
        if (!field) return null;
        const s = String(value ?? '').trim();
        if (s === '') return null;
        const isNumeric = ['small-integer', 'integer', 'single', 'double', 'long', 'number'].includes(fieldType);
        if (isNumeric && !isNaN(s)) return `${field} = ${Number(s)}`;
        return `${field} = '${this.escapeString(s)}'`;
    }

    static buildInClause(field, values, fieldType = 'string') {
        if (!values || !values.length) return null;
        const isNumeric = ['small-integer', 'integer', 'single', 'double', 'long'].includes(fieldType);
        const formatted = values.map(v => {
            const s = String(v ?? '').trim();
            if (isNumeric && s !== '' && !isNaN(s)) return Number(s);
            return `'${s.replace(/'/g, "''")}'`;
        });
        return `${field} IN (${formatted.join(',')})`;
    }

    static buildNotInClause(field, values, fieldType = 'string') {
        const clause = this.buildInClause(field, values, fieldType);
        return clause ? `NOT (${clause})` : null;
    }

    static combine(first, second) {
        if (!first) return second;
        if (!second) return first;
        return `(${first}) AND (${second})`;
    }
}
