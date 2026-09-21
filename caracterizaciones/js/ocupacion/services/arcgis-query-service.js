export class ArcGISQueryService {
    static async query(layerUrl, params, options = {}) {
        const endpoint = layerUrl.replace(/\/+$/, "") + "/query";
        const controlParams = new Set(["cacheKey", "cacheTtlMs", "signal"]);
        const requestParams = {};

        Object.entries(params).forEach(([key, value]) => {
            if (controlParams.has(key)) return;
            if (value == null) return;
            requestParams[key] = String(value);
        });

        const usePost = requestParams.returnGeometry === "true";
        const cacheKey = options.cacheKey || params.cacheKey || `${endpoint}|${JSON.stringify(requestParams)}`;
        const cache = options.cache || null;
        const ttlMs = options.cacheTtlMs || params.cacheTtlMs;

        if (cache) {
            const cached = cache.get(cacheKey);
            if (cached) return cached;
        }

        const signal = options.signal || params.signal;
        const response = usePost
            ? await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams(requestParams),
                signal
            })
            : await fetch(`${endpoint}?${new URLSearchParams(requestParams)}`, { signal });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status} consultando ${layerUrl}`);
        }

        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("json")) {
            const text = await response.text();
            throw new Error(`Respuesta no JSON consultando ${layerUrl}: ${text.slice(0, 120)}`);
        }

        const json = await response.json();
        if (json.error) {
            throw new Error(json.error.message || "Error ArcGIS query");
        }

        cache?.set(cacheKey, json, ttlMs);
        return json;
    }

    static async fetchBF3Stats({ layerUrl, where, groupField, numField, denField }) {
        const outStatistics = [
            { statisticType: "sum", onStatisticField: numField, outStatisticFieldName: "sum_num" },
            { statisticType: "sum", onStatisticField: denField, outStatisticFieldName: "sum_den" }
        ];

        const json = await this.query(layerUrl, {
            f: "json",
            where: where || "1=1",
            groupByFieldsForStatistics: groupField,
            outStatistics: JSON.stringify(outStatistics),
            returnGeometry: "false"
        }, arguments[0]);

        return (json.features || []).map(feature => feature.attributes || {});
    }

    static async fetchGroupedStats({
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

        const json = await this.query(layerUrl, {
            f: "json",
            where,
            groupByFieldsForStatistics: groupField,
            outStatistics: JSON.stringify(outStatistics),
            returnGeometry: "false"
        }, arguments[0]);

        return (json.features || []).map(feature => feature.attributes || {});
    }
}
