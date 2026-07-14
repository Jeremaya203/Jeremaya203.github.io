export async function zoomMapaGeoformasRenderer({
    paisajeValue,
    relieveValue = null,
    layer,
    view,
    whereBase,
    getActiveLayerConfig,
    updateLegendByExtent
}) {
    if (!layer || !view) {
        console.warn("No hay layerGlobal o view disponible para geoformas");
        return;
    }

    const paisVal = formatSqlValue(paisajeValue);
    const relVal = formatSqlValue(relieveValue);

    if (!paisVal) {
        console.warn("No se recibió paisaje para filtrar geoformas");
        return;
    }

    const isDetalleLayer = Number(layer.layerId) === 9;
    const wherePaisaje = whereBase
        ? `${whereBase} AND paisaje = ${paisVal}`
        : `paisaje = ${paisVal}`;
    const wherePaisajeRelieve = (isDetalleLayer && relVal)
        ? (whereBase
            ? `${whereBase} AND paisaje = ${paisVal} AND trelieve = ${relVal}`
            : `paisaje = ${paisVal} AND trelieve = ${relVal}`)
        : null;

    layer.definitionExpression = wherePaisajeRelieve || wherePaisaje;

    if (wherePaisajeRelieve && await zoomToWhere(layer, view, wherePaisajeRelieve, 1.2, "geoformas")) return;
    if (await zoomToWhere(layer, view, wherePaisaje, 1.2, "geoformas")) return;

    const config = getActiveLayerConfig();
    if (config && typeof updateLegendByExtent === "function") {
        updateLegendByExtent(layer, config);
    }

    console.warn("No se pudo hacer zoom para geoformas");
}

export async function zoomMapaVocacionRenderer({
    vocacionValue,
    usoValue = null,
    layer,
    view,
    whereBase,
    getActiveLayerConfig,
    updateLegendByExtent
}) {
    if (!layer || !view) {
        console.warn("No hay layerGlobal o view disponible para vocación");
        return;
    }

    const vocVal = formatSqlValue(vocacionValue);
    const usoVal = formatSqlValue(usoValue);

    if (!vocVal) {
        console.warn("No se recibió vocación para filtrar");
        return;
    }

    const isDetalleLayer = Number(layer.layerId) === 30;
    const whereVocacion = whereBase
        ? `${whereBase} AND vocacion = ${vocVal}`
        : `vocacion = ${vocVal}`;
    const whereVocacionUso = (isDetalleLayer && usoVal)
        ? (whereBase
            ? `${whereBase} AND vocacion = ${vocVal} AND usopvoc = ${usoVal}`
            : `vocacion = ${vocVal} AND usopvoc = ${usoVal}`)
        : null;

    layer.definitionExpression = whereVocacionUso || whereVocacion;

    if (whereVocacionUso && await zoomToWhere(layer, view, whereVocacionUso, 1.2, "vocación")) return;
    if (await zoomToWhere(layer, view, whereVocacion, 1.2, "vocación")) return;

    const config = getActiveLayerConfig();
    if (config && typeof updateLegendByExtent === "function") {
        updateLegendByExtent(layer, config);
    }

    console.warn("No se pudo hacer zoom para vocación");
}

export async function zoomMapaOrdenSueloRenderer({
    ordenValue,
    fertilidadValue,
    layer,
    view,
    whereBase,
    sqlLiteral,
    sqlEquals,
    andWhere
}) {
    if (!layer || !view) {
        console.warn("No hay layerGlobal o view disponible para zoom");
        return;
    }

    const isEmptyFert =
        fertilidadValue === null ||
        fertilidadValue === undefined ||
        String(fertilidadValue).trim() === "" ||
        String(fertilidadValue).trim().toLowerCase() === "no aplica" ||
        String(fertilidadValue).trim().toLowerCase() === "sin dato";

    const ordVal = sqlLiteral(ordenValue);
    const fertClause = sqlEquals("fertilidad", fertilidadValue);

    if (ordVal === null) {
        console.warn("No se recibió orden de suelo válido para filtrar");
        return;
    }

    const whereSoloOrden = andWhere(whereBase, `ordsuelo = ${ordVal}`);
    const whereOrdenFert = andWhere(whereBase, `ordsuelo = ${ordVal} AND ${fertClause}`);

    layer.definitionExpression = isEmptyFert ? whereSoloOrden : whereOrdenFert;

    if (!isEmptyFert && await zoomToWhere(layer, view, whereOrdenFert, 1.35, "orden de suelo")) return;
    if (await zoomToWhere(layer, view, whereSoloOrden, 1.35, "orden de suelo")) return;

    console.warn("No se pudo hacer zoom con ningún filtro");
}

function formatSqlValue(value) {
    const text = String(value ?? "").trim();
    if (!text) return null;

    const isNum = /^-?\d+(\.\d+)?$/.test(text);
    return isNum ? text : `'${text.replace(/'/g, "''")}'`;
}

async function zoomToWhere(layer, view, where, expandFactor, context) {
    try {
        const query = layer.createQuery();
        query.where = where;
        query.returnGeometry = false;

        const result = await layer.queryExtent(query);

        if (result?.extent) {
            await view.goTo(result.extent.expand(expandFactor), {
                duration: 1200,
                easing: "ease-in-out"
            });
            return true;
        }
        return false;
    } catch (error) {
        console.warn(`Falló queryExtent ${context} con:`, where, error);
        return false;
    }
}
