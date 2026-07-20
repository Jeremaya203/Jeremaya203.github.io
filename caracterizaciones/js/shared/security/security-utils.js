export function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

export function escapeHtmlWithBreaks(value) {
    return escapeHtml(value).replace(/\r\n?|\n/g, "<br>");
}

export function escapeSqlString(value) {
    return String(value ?? "").replace(/'/g, "''");
}

export function normalizeMunicipalityCode(value) {
    const normalized = String(value ?? "").trim();
    if (/^\d{5}$/.test(normalized)) return normalized;
    if (/^\d{1,4}$/.test(normalized)) return normalized.padStart(5, "0");
    return "";
}

export function normalizeDepartmentCode(value) {
    const normalized = String(value ?? "").trim();
    if (/^\d{2}$/.test(normalized)) return normalized;
    if (/^\d$/.test(normalized)) return normalized.padStart(2, "0");
    return "";
}
