import { clearArcRestQueryCache } from "../data.js";
import { clearBiofisicoArcgisCache } from "./biophysical-arcgis-cache-service.js";
import { clearBiofisicoQueryServiceCache } from "./biophysical-query-service.js";
import { recordBiofisicoMetric } from "./biophysical-performance-service.js";

export function clearBiofisicoRuntimeCaches(reason = "manual") {
    clearArcRestQueryCache();
    clearBiofisicoArcgisCache();
    clearBiofisicoQueryServiceCache();
    recordBiofisicoMetric("cache.clear", 0, { reason });
}
