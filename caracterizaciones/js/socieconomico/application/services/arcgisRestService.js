export async function arcRestQuery(layerUrl, params) {

    const url = new URL(layerUrl.replace(/\/+$/, "") + "/query");

    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null) {
            url.searchParams.set(k, v);
        }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
        const res = await fetch(url.toString(), {
            signal: controller.signal
        });

        if (!res.ok) {
            throw new Error(`HTTP ${res.status} consultando ${layerUrl}`);
        }

        const js = await res.json();

        if (js.error) {
            throw new Error(js.error.message || "Error ArcGIS query");
        }

        return js;

    } catch (e) {

        if (e.name === "AbortError") {
            console.warn("⏱ Timeout en arcRestQuery:", layerUrl);
        } else {
            console.error("arcRestQuery error:", e);
        }

        // 🔴 fallback seguro (clave)
        return { features: [] };

    } finally {
        clearTimeout(timeout);
    }
}
    // BF3: SUM(areat) y SUM(mparea) agrupado por paisaje
export async function fetchBF3Stats({ layerUrl, where, groupField, numField, denField }) {

    const outStatistics = [
        { statisticType: "sum", onStatisticField: numField, outStatisticFieldName: "sum_num" },
        { statisticType: "sum", onStatisticField: denField, outStatisticFieldName: "sum_den" }
    ];

    const js = await arcRestQuery(layerUrl, {
        f: "json",
        where: where && where.trim() ? where : "1=1",
        groupByFieldsForStatistics: groupField || "",
        outStatistics: JSON.stringify(outStatistics),
        returnGeometry: "false"
    });

    return (js.features || []).map(f => f.attributes || {});
}