import { clearArcRestQueryCache } from "../data.js";
import { clearBiofisicoArcgisCache } from "./biofisicoArcgisCache.service.js";
import { clearBiofisicoQueryServiceCache } from "./biofisicoQuery.service.js";
import { recordBiofisicoMetric } from "./biofisicoPerformance.service.js";

export function clearBiofisicoRuntimeCaches(reason = "manual") {
    clearArcRestQueryCache();
    clearBiofisicoArcgisCache();
    clearBiofisicoQueryServiceCache();
    recordBiofisicoMetric("cache.clear", 0, { reason });
}
