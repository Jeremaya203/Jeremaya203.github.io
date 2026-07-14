export function updateMapViewBadge(nombre) {
    const badgeText = document.getElementById("mapViewBadgeText");
    if (!badgeText) return;

    badgeText.textContent = nombre || "Vista";
}

export function setLegendLayerTitle(titleText) {
    const title = document.getElementById("legendTitle");
    if (title) title.textContent = titleText || "Leyenda";
}

export function clearLegend(titleText = "Leyenda") {
    const legendTitle = document.getElementById("legendTitle");
    const legendContent = document.getElementById("legendContent");

    if (legendTitle) legendTitle.textContent = titleText;
    if (legendContent) legendContent.innerHTML = "";

    window.__lastLegendRenderKey = "";
}

export function setSummaryText(text) {
    const summaryDiv = document.getElementById("summaryDiv");
    if (summaryDiv) {
        summaryDiv.textContent = text;
    }
}

function cleanChartTitleBase(title) {
    return String(title || "Distribución (%)")
        .replace(/\s+en\s+el\s+departamento\s+de\s+.+$/i, "")
        .replace(/\s+en\s+.+,\s*.+$/i, "")
        .replace(/\s+en\s+Colombia$/i, "")
        .trim();
}

function isNumericIdentifier(value) {
    return /^-?\d+(\.\d+)?$/.test(String(value ?? "").trim());
}

function normalizeDeptoCode(value) {
    const code = String(value ?? "").trim();
    if (!code || code === "0" || code.toUpperCase() === "COL") return "";
    return /^\d{1}$/.test(code) ? code.padStart(2, "0") : code;
}

function normalizeMunicipioCode(value) {
    const code = String(value ?? "").trim();
    if (!code) return "";
    return /^\d{1,4}$/.test(code) ? code.padStart(5, "0") : code;
}

function pickReadableName(value) {
    const text = String(value ?? "").trim();
    return text && !isNumericIdentifier(text) ? text : "";
}

function resolveTerritoryContext({ mpnombre, dpnombre, deps = {} }) {
    const {
        filtroNivel,
        deptoActual,
        municipioActual,
        diccionarioDepartamentos = {},
        diccionarioMunicipios = {}
    } = deps;

    const normalizedDepto = normalizeDeptoCode(deptoActual);
    const normalizedMunicipio = normalizeMunicipioCode(municipioActual);
    const deptoFromMunicipio = normalizeDeptoCode(normalizedMunicipio.substring(0, 2));

    if (filtroNivel === "MUNI" && normalizedMunicipio) {
        const municipio = diccionarioMunicipios[normalizedMunicipio] || pickReadableName(mpnombre) || normalizedMunicipio;
        const departamento =
            diccionarioDepartamentos[deptoFromMunicipio] ||
            diccionarioDepartamentos[normalizedDepto] ||
            pickReadableName(dpnombre) ||
            "";

        return departamento ? `${municipio}, ${departamento}` : municipio;
    }

    if (filtroNivel === "DEPTO" && normalizedDepto) {
        return diccionarioDepartamentos[normalizedDepto] || pickReadableName(dpnombre) || "Colombia";
    }

    const municipio = diccionarioMunicipios[normalizedMunicipio] || pickReadableName(mpnombre);
    const departamento =
        diccionarioDepartamentos[deptoFromMunicipio] ||
        diccionarioDepartamentos[normalizedDepto] ||
        pickReadableName(dpnombre);

    if (municipio && departamento) return `${municipio}, ${departamento}`;
    if (municipio) return municipio;
    if (departamento) return departamento;
    return "Colombia";
}

export function buildChartTitleWithTerritory(title, { mpnombre = null, dpnombre = null, deps = {} } = {}) {
    return `${cleanChartTitleBase(title)} en ${resolveTerritoryContext({ mpnombre, dpnombre, deps })}`;
}

function getBiofisicoChartBaseTitle(config) {
    if (config?.isDeptoRiskCount) return "Municipios por nivel de riesgo ante cambio climático";
    if (config?.isBF3) return "Distribución de geoformas";
    if (config?.isGeoforma && config?.isGeoformaDualChart) return "Distribución de geoformas y paisajes";
    if (config?.id === "hipsometria") return "Distribución de rangos hipsométricos";
    if (config?.climaType === "temp") return "Distribución de rangos de temperatura";
    if (config?.climaType === "precip") return "Distribución de rangos de precipitación";
    if (config?.climaType === "clima_tipo") return "Distribución de los tipos de climas";
    if (config?.climaType === "temp_cc") return "Escenario de cambio en las temperaturas";
    if (config?.climaType === "precip_cc") return "Escenario de cambio en las precipitaciones";
    if (config?.climaType === "riesgo_cc") return "Calificación de índices y subíndices por riesgo ante cambio climático";
    if (config?.ecosistemaType === "ecosistemas") return "Distribución de ecosistemas";
    if (config?.isHidro && config?.hidroType === "cuencas") return config?.isDeptoCuencasAgg
        ? "Zonas hidrográficas presentes"
        : "Distribución de las subzonas hidrográficas";
    if (config?.id === "escorrentia") return "Distribución de la escorrentía por rangos";
    if (config?.isSuelos && config?.suelosType === "orden") return "Distribución de órdenes y fertilidad de los suelos";
    if (config?.isSuelos && config?.suelosType === "vocacion") return "Distribución de vocaciones de los suelos y usos principales";
    if (config?.isSuelos && config?.suelosType === "conflictos") return "Distribución de los tipos de conflictos del suelo";
    if (config?.id === "inundaciones") return "Distribución de la susceptibilidad a inundaciones";
    if (config?.isFenomenos && config?.fenomenosType === "inundaciones") return "Porcentaje de susceptibilidad a inundaciones";
    if (config?.isFenomenos && config?.fenomenosType === "remocion") return "Distribución de las categorías de amenaza por remoción en masa";
    if (config?.isFenomenos && config?.fenomenosType === "degradacion") return "Distribución de la degradación del suelo";
    if (config?.isFenomenos && config?.fenomenosType === "sismica") return "Distribución de la intensidad sísmica esperada";
    return "Distribución (%)";
}

export function actualizarTituloGrafico(config, mpnombre, dpnombre, deps = {}) {
    const titleElement = document.getElementById("chartTitle");
    if (!titleElement) return;

    const titleDpnombre = pickReadableName(dpnombre) || deps.diccionarioDepartamentos?.[normalizeDeptoCode(deps.deptoActual)] || null;
    titleElement.textContent = buildChartTitleWithTerritory(getBiofisicoChartBaseTitle(config), {
        mpnombre: pickReadableName(mpnombre),
        dpnombre: titleDpnombre,
        deps
    });
}
