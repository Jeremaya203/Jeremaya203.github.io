export function debounce(fn, ms = 120) {
    let t = null;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), ms);
    };
}

/* ── HTML / SQL helpers ── */

export function escapeHtml(value, fallback = "—") {
    if (value === null || value === undefined || value === "") return fallback;
    return String(value)
        .replace(/&/g, "&")
        .replace(/</g, "<")
        .replace(/>/g, ">")
        .replace(/"/g, "'")
        .replace(/'/g, "&#39;");
}

export function escapeAttr(value, fallback = "") {
    return escapeHtml(value, fallback);
}

function sqlLiteral(value, type = "string") {
    if (value === null || value === undefined) return null;
    const s = String(value).replace(/\u0000/g, "").trim();
    if (!s || s.toLowerCase() === "null" || s.toLowerCase() === "nan") return null;
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

export function sqlStartsWith(field, prefix) {
    const s = String(prefix ?? "").replace(/\u0000/g, "").trim();
    if (!s) return "1=1";
    return `${field} LIKE '${s.replace(/'/g, "''")}%'`;
}

export function sqlContains(field, value) {
    const s = String(value ?? "").replace(/\u0000/g, "").trim();
    if (!s) return "1=1";
    return `${field} LIKE '%${s.replace(/'/g, "''")}%'`;
}

export function normalizeCode(value) {
    return String(value ?? "").trim();
}

export function getDepartamentoDisplayName(codigoDepto, diccionarioDepartamentos = {}) {
    const codigo = String(codigoDepto ?? "").trim();
    if (codigo === "00") return "Área en litigio";
    return diccionarioDepartamentos[codigo] || codigo;
}

export function getMunicipioDisplayName(municipio, diccionarioMunicipios = {}) {
    const codigo = String(municipio?.codigo ?? municipio ?? "").trim();
    const nombre = String(municipio?.nombre ?? diccionarioMunicipios[codigo] ?? "").trim();

    if (codigo === "00000" || nombre === "00000") {
        return "Área en litigio";
    }

    return nombre || codigo;
}
