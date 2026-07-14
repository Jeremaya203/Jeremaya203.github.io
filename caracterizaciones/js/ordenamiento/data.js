export async function arcRestQuery(layerUrl, params, options = {}){
    const url = new URL(layerUrl.replace(/\/+$/, "") + "/query");
    for (const [k,v] of Object.entries(params)) url.searchParams.set(k, v);
    const timeoutMs = Number(options.timeoutMs || 0);
    const controller = timeoutMs > 0 ? new AbortController() : null;
    const timeoutId = controller
        ? setTimeout(() => controller.abort(), timeoutMs)
        : null;

    let res;
    try {
        res = await fetch(url.toString(), controller ? { signal: controller.signal } : undefined);
    } catch (e) {
        if (e?.name === "AbortError") {
            throw new Error(`Timeout consultando ${layerUrl}`);
        }
        throw e;
    } finally {
        if (timeoutId) clearTimeout(timeoutId);
    }

    if (!res.ok) throw new Error(`HTTP ${res.status} consultando ${layerUrl}`);
    const js = await res.json();
    if (js.error) throw new Error(js.error.message || "Error ArcGIS query");
    return js;
}

export async function fetchGroupedStats({
    layerUrl,
    where = "1=1",
    groupField,
    sumField,
    outFieldName = "sum_area",
    timeoutMs = 0
}) {
    const outStatistics = [{
        statisticType: "sum",
        onStatisticField: sumField,
        outStatisticFieldName: outFieldName
    }];

    const js = await arcRestQuery(layerUrl, {
        f: "json",
        where,
        groupByFieldsForStatistics: groupField,
        outStatistics: JSON.stringify(outStatistics),
        returnGeometry: "false"
    }, { timeoutMs });

    return (js.features || []).map(f => f.attributes || {});
}
