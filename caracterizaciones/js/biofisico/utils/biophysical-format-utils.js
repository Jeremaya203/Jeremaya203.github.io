const SAFE_COLOR_RE = /^(#(?:[0-9a-f]{3,8})|rgba?\([\d\s.,%+-]+\)|hsla?\([\d\s.,%+-]+\)|[a-zA-Z]+)$/;

export function escapeHtml(value, fallback = "—") {
    if (value === null || value === undefined || value === "") return fallback;
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

export function escapeAttr(value, fallback = "") {
    return escapeHtml(value, fallback);
}

export function normalizeCode(value) {
    return String(value ?? "").trim();
}

export function sqlLiteral(value, type = "string") {
    if (value === null || value === undefined) return null;

    const s = String(value).replace(/\u0000/g, "").trim();

    if (!s || s.toLowerCase() === "null" || s.toLowerCase() === "nan") {
        return null;
    }

    if (type === "number") {
        const n = Number(s);
        return Number.isFinite(n) ? String(n) : null;
    }

    return `'${s.replace(/'/g, "''")}'`;
}

export function sqlEquals(field, value, options = {}) {
    const literal = sqlLiteral(value, options.type || "string");
    return literal === null ? `${field} IS NULL` : `${field} = ${literal}`;
}

export function sqlEqualsNumber(field, value) {
    return sqlEquals(field, value, { type: "number" });
}

export function sqlStartsWith(field, prefix) {
    const s = String(prefix ?? "").replace(/\u0000/g, "").trim();

    if (!s) return "1=1";

    return `${field} LIKE '${s.replace(/'/g, "''")}%'`;
}

export function andWhere(baseWhere, clause) {
    const base = baseWhere && String(baseWhere).trim()
        ? String(baseWhere).trim()
        : "1=1";

    return clause ? `${base} AND ${clause}` : base;
}

export function safeCssColor(value, fallback = "#999") {
    const s = String(value ?? "").trim();
    return SAFE_COLOR_RE.test(s) ? s : fallback;
}
