export async function arcRestQuery(layerUrl, params){
    const url = new URL(layerUrl.replace(/\/+$/, "") + "/query");
    for (const [k,v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`HTTP ${res.status} consultando ${layerUrl}`);
    const js = await res.json();
    if (js.error) throw new Error(js.error.message || "Error ArcGIS query");
    return js;
}

    // BF3: SUM(areat) y SUM(mparea) agrupado por paisaje
export async function fetchBF3Stats({ layerUrl, where, groupField, numField, denField }) {
    const outStatistics = [
        { statisticType: "sum", onStatisticField: numField, outStatisticFieldName: "sum_num" },
        { statisticType: "sum", onStatisticField: denField, outStatisticFieldName: "sum_den" }
    ];

    const js = await arcRestQuery(layerUrl, {
        f: "json",
        where: where || "1=1",
        groupByFieldsForStatistics: groupField,
        outStatistics: JSON.stringify(outStatistics),
        returnGeometry: "false"
    });

    const rows = (js.features || []).map(f => f.attributes || {});
    return rows;
}

export async function fetchGroupedStats({
    layerUrl,
    where = "1=1",
    groupField,
    sumField,
    outFieldName = "sum_area"
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
    });

    return (js.features || []).map(f => f.attributes || {});
}
