import { escapeHtml } from "../../../shared/security/security-utils.js";

export function createStationsController({
    FeatureLayer,
    map,
    stationsLayerUrl,
    getStationsLayer,
    setStationsLayer,
    getDiccionarioMunicipios,
    getDiccionarioDepartamentos
}) {
    function buildStationsPopupContent(evt) {
        const graphic = evt?.graphic || evt;
        const attrs = graphic?.attributes || {};
        const municipios = getDiccionarioMunicipios();
        const departamentos = getDiccionarioDepartamentos();

        const meses = [
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

        const esc = value => escapeHtml(value == null ? "-" : value);
        const toNumber = value => {
            if (value == null) return null;
            const normalized = String(value).trim();
            if (!normalized) return null;
            const number = Number(normalized.replace(/\./g, "").replace(",", "."));
            return Number.isFinite(number) ? number : null;
        };
        const fmt = value => {
            const number = toNumber(value);
            return number == null ? "-" : number.toFixed(1).replace(".", ",");
        };
        const fila = mes => `
            <tr>
                <td class="oot-js-socio-stations-1">${mes.key}</td>
                <td class="oot-js-socio-stations-2">${fmt(attrs[mes.t])}</td>
                <td class="oot-js-socio-stations-2">${fmt(attrs[mes.p])}</td>
            </tr>
        `;

        const mpCode = String(attrs.mpcodigo ?? "").trim();
        const dpCode = String(attrs.dpcodigo ?? "").trim();
        const mpNombreRaw = String(attrs.mpnombre ?? "").trim();
        const dpNombreRaw = String(attrs.dpnombre ?? "").trim();
        const mpNombreFinal = (!mpNombreRaw || mpNombreRaw === mpCode || !isNaN(mpNombreRaw))
            ? (municipios?.[mpCode] || mpNombreRaw || mpCode)
            : mpNombreRaw;
        const dpNombreFinal = (!dpNombreRaw || dpNombreRaw === dpCode || !isNaN(dpNombreRaw))
            ? (departamentos?.[dpCode] || dpNombreRaw || dpCode)
            : dpNombreRaw;

        return `
            <div class="oot-js-socio-stations-3">
                <div><b>Estacion:</b> ${esc(attrs.nombest)} (${esc(attrs.codest)})</div>
                <div><b>Municipio:</b> ${esc(mpNombreFinal)} (${esc(mpCode)})</div>
                <div><b>Departamento:</b> ${esc(dpNombreFinal)} (${esc(dpCode)})</div>
                <div><b>Fuente:</b> ${esc(attrs.fuente)}</div>
                <hr class="oot-js-socio-stations-4">
                <div class="oot-js-socio-stations-5">Promedios mensuales</div>
                <table class="oot-js-socio-stations-6">
                    <thead>
                        <tr>
                            <th class="oot-js-socio-stations-7">Mes</th>
                            <th class="oot-js-socio-stations-8">Temp (C)</th>
                            <th class="oot-js-socio-stations-8">Precip (mm)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${meses.map(fila).join("")}
                        <tr>
                            <td class="oot-js-socio-stations-9"><b>ANUAL</b></td>
                            <td class="oot-js-socio-stations-10"><b>${fmt(attrs.temanual)}</b></td>
                            <td class="oot-js-socio-stations-10"><b>${fmt(attrs.precanual)}</b></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
    }

    function ensureStationsLayer() {
        const existingLayer = getStationsLayer();
        if (existingLayer) return existingLayer;

        const layer = new FeatureLayer({
            url: stationsLayerUrl,
            outFields: [
                "nombest", "codest", "mpnombre", "mpcodigo", "dpnombre", "dpcodigo", "fuente",
                "temene", "temfeb", "temmar", "temabr", "temmay", "temjun", "temjul", "temago", "temsep", "temoct", "temnov", "temdic", "temanual",
                "precene", "precfeb", "precmar", "precabr", "precmay", "precjun", "precjul", "precago", "precsep", "precoct", "precnov", "precdic", "precanual"
            ],
            popupEnabled: true,
            popupTemplate: {
                title: "{nombest}",
                content: buildStationsPopupContent
            },
            minScale: 2500000,
            maxScale: 1
        });

        setStationsLayer(layer);
        return layer;
    }

    return {
        buildStationsPopupContent,
        ensureStationsLayer
    };
}
