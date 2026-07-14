export function buildStationsPopupContent(evt, deps) {
    const graphic = evt?.graphic || evt;
    const attributes = graphic?.attributes || {};

    const { escapeHtml, diccionarioMunicipios, diccionarioDepartamentos } = deps;

    const months = [
        { key: "ENE", t: "temene", p: "precene" },
        { key: "FEB", t: "temfeb", p: "precfeb" },
        { key: "MAR", t: "temmar", p: "precmar" },
        { key: "ABR", t: "temabr", p: "precabr" },
        { key: "MAY", t: "temmay", p: "precmay" },
        { key: "JUN", t: "temjun", p: "precjun" },
        { key: "JUL", t: "temjul", p: "precjul" },
        { key: "AGO", t: "temago", p: "precago" },
        { key: "SEP", t: "temsep", p: "precsep" },
        { key: "OCT", t: "temoct", p: "precoct" },
        { key: "NOV", t: "temnov", p: "precnov" },
        { key: "DIC", t: "temdic", p: "precdic" }
    ];

    const esc = value => escapeHtml(value);

    const toNum = value => {
        if (value == null) return null;
        const text = String(value).trim();
        if (!text) return null;
        const number = Number(text.replace(/\./g, "").replace(",", "."));
        return Number.isFinite(number) ? number : null;
    };

    const fmt = value => {
        const number = toNum(value);
        if (number == null) return "-";
        return number.toFixed(1).replace(".", ",");
    };

    const row = month => `
        <tr>
        <td style="padding:4px 6px; border-bottom:1px solid #eee;">${month.key}</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:right;">${fmt(attributes[month.t])}</td>
        <td style="padding:4px 6px; border-bottom:1px solid #eee; text-align:right;">${fmt(attributes[month.p])}</td>
        </tr>
    `;

    const mpCode = String(attributes.mpcodigo ?? "").trim();
    const dpCode = String(attributes.dpcodigo ?? "").trim();
    const mpNombreRaw = String(attributes.mpnombre ?? "").trim();
    const dpNombreRaw = String(attributes.dpnombre ?? "").trim();

    const mpNombreFinal = (!mpNombreRaw || mpNombreRaw === mpCode || !isNaN(mpNombreRaw))
        ? (diccionarioMunicipios?.[mpCode] || mpNombreRaw || mpCode)
        : mpNombreRaw;

    const dpNombreFinal = (!dpNombreRaw || dpNombreRaw === dpCode || !isNaN(dpNombreRaw))
        ? (diccionarioDepartamentos?.[dpCode] || dpNombreRaw || dpCode)
        : dpNombreRaw;

    return `
        <div style="font-size:12px; line-height:1.3;">
        <div><b>Estacion:</b> ${esc(attributes.nombest)} (${esc(attributes.codest)})</div>
        <div><b>Municipio:</b> ${esc(mpNombreFinal)} (${esc(mpCode)})</div>
        <div><b>Departamento:</b> ${esc(dpNombreFinal)} (${esc(dpCode)})</div>
        <div><b>Fuente:</b> ${esc(attributes.fuente)}</div>

        <hr style="margin:8px 0;">

        <div style="font-weight:600; margin-bottom:6px;">Promedios mensuales</div>
        <table style="width:100%; border-collapse:collapse;">
            <thead>
            <tr>
                <th style="text-align:left; padding:4px 6px; border-bottom:1px solid #ddd;">Mes</th>
                <th style="text-align:right; padding:4px 6px; border-bottom:1px solid #ddd;">Temp (C)</th>
                <th style="text-align:right; padding:4px 6px; border-bottom:1px solid #ddd;">Precip (mm)</th>
            </tr>
            </thead>
            <tbody>
            ${months.map(row).join("")}
            <tr>
                <td style="padding:4px 6px; border-top:1px solid #ddd;"><b>ANUAL</b></td>
                <td style="padding:4px 6px; border-top:1px solid #ddd; text-align:right;"><b>${fmt(attributes.temanual)}</b></td>
                <td style="padding:4px 6px; border-top:1px solid #ddd; text-align:right;"><b>${fmt(attributes.precanual)}</b></td>
            </tr>
            </tbody>
        </table>
        </div>
    `;
}
