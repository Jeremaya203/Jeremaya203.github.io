export function buildCommonChartOptions(overrides = {}) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: { enabled: true }
        },
        ...overrides
    };
}

export function getAxisTitles(layerConfig, chartType, isVertical, datasets) {
    if (layerConfig?.isDeptoRiskCount) {
        return { xTitle: "Nivel de riesgo", yTitle: "Cantidad de municipios" };
    }

    let xTitle = "";
    let yTitle = "";

    if (chartType === "pie" || chartType === "radar") return { xTitle, yTitle };

    const valueTitle = "Porcentaje (%)";

    if (layerConfig?.id === "hipsometria") {
        if (isVertical) {
            xTitle = "Rangos (m)";
            yTitle = "Porcentaje (%)";
        } else {
            xTitle = "Porcentaje (%)";
            yTitle = "Rangos (m)";
        }
        return { xTitle, yTitle };
    }

    if (layerConfig?.isClima && layerConfig?.isStacked) {
        xTitle = "Periodo";
        yTitle = "Porcentaje (%)";
        return { xTitle, yTitle };
    }

    if (layerConfig?.isClima && layerConfig?.isLine) {
        xTitle = "Periodo";
        yTitle = "Porcentaje (%)";
        return { xTitle, yTitle };
    }

    if (layerConfig?.isClima && layerConfig?.climaType === "clima_tipo") {
        xTitle = "Porcentaje (%)";
        yTitle = "Tipo de clima";
        return { xTitle, yTitle };
    }

    if (layerConfig?.id === "escorrentia") {
        xTitle = "Rangos de escorrentía (mm)/año";
        yTitle = "Porcentaje (%)";
        return { xTitle, yTitle };
    }

    if (layerConfig?.isEcosistema && layerConfig?.ecosistemaType === "ecosistemas") {
        if (isVertical) {
            xTitle = "Ecosistemas";
            yTitle = "Porcentaje (%)";
        } else {
            xTitle = "Porcentaje (%)";
            yTitle = "Ecosistemas";
        }
        return { xTitle, yTitle };
    }

    if (layerConfig?.isEcosistema
        && layerConfig?.ecosistemaType === "deforestacion"
        && chartType === "line") {
        return { xTitle: "Periodo", yTitle: valueTitle };
    }

    if (layerConfig?.isFenomenos) {
        if (layerConfig.fenomenosType === "inundaciones") {
            xTitle = "Susceptibilidad por inundación";
            yTitle = "Porcentaje (%)";
            return { xTitle, yTitle };
        }

        if (layerConfig.fenomenosType === "degradacion") {
            xTitle = "Clase de degradación";
            yTitle = "Porcentaje (%)";
            return { xTitle, yTitle };
        }

        if (layerConfig.fenomenosType === "sismica") {
            xTitle = "Intensidad sísmica";
            yTitle = "Porcentaje (%)";
            return { xTitle, yTitle };
        }
    }

    if (layerConfig?.isSuelos && layerConfig?.suelosType === "conflictos") {
        if (isVertical) {
            xTitle = "Tipo de conflicto";
            yTitle = "Porcentaje (%)";
        } else {
            xTitle = "Porcentaje (%)";
            yTitle = "Tipo de conflicto";
        }
        return { xTitle, yTitle };
    }

    if (chartType === "bar") {
        if (isVertical) {
            xTitle = "Categoría";
            yTitle = valueTitle;
        } else {
            xTitle = valueTitle;
            yTitle = "Categoría";
        }
        return { xTitle, yTitle };
    }

    if (chartType === "line") {
        xTitle = "Categoría";
        yTitle = valueTitle;
        return { xTitle, yTitle };
    }

    return { xTitle, yTitle };
}
