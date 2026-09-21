export function debounce(callback, delayMs = 120) {
    let timeoutId = null;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => callback(...args), delayMs);
    };
}

/* ── HTML / SQL helpers ── */

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

export function convertAreaToSquareKilometers(value, sourceUnit = "km2") {
    if (value === null || value === undefined || value === "") return null;

    const number = Number(value);
    if (!Number.isFinite(number)) return null;

    return String(sourceUnit).toLowerCase() === "ha"
        ? number / 100
        : number;
}

export function normalizeDepartmentDisplayName(value, departmentCode = "") {
    const code = String(departmentCode ?? "").trim();
    const name = String(value ?? "").trim();
    const normalized = name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();

    if (
        code === "88" ||
        normalized === "san andres, providencia y santa catalina" ||
        normalized === "san andres providencia y santa catalina"
    ) {
        return "San Andr\u00e9s y Providencia";
    }

    return name;
}

export function getDepartmentDisplayName(departmentCode, departmentNames = {}) {
    const code = String(departmentCode ?? "").trim();
    if (code === "00") return "Área en litigio";
    return normalizeDepartmentDisplayName(departmentNames[code] || code, code);
}

export function getMunicipalityDisplayName(municipality, municipalityNames = {}) {
    const code = String(municipality?.codigo ?? municipality ?? "").trim();
    const name = String(municipality?.nombre ?? municipalityNames[code] ?? "").trim();

    if (code === "00000" || name === "00000") {
        return "Área en litigio";
    }

    return name || code;
}
