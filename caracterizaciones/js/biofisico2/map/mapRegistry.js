import { hypsometryMap } from "./relief/hypsometry.map.js";
import { slopesMap } from "./relief/slopes.map.js";
import { geoformsMap } from "./relief/geoforms.map.js";
import { temperatureMap } from "./climate/temperature.map.js";
import { precipitationMap } from "./climate/precipitation.map.js";
import { climatesMap } from "./climate/climates.map.js";
import { temperatureChangeCcMap } from "./climate/temperature-change-cc.map.js";
import { precipitationChangeCcMap } from "./climate/precipitation-change-cc.map.js";
import { climateRiskMap } from "./climate/climate-risk.map.js";
import { hydrographicBasinsMap } from "./hydrography/hydrographic-basins.map.js";
import { runoffMap } from "./hydrography/runoff.map.js";
import { ecosystemsMap } from "./ecosystems/ecosystems.map.js";
import { deforestationRegenerationMap } from "./ecosystems/deforestation-regeneration.map.js";
import { soilOrderMap } from "./soils/soil-order.map.js";
import { soilVocationEdaphicSupplyMap } from "./soils/soil-vocation-edaphic-supply.map.js";
import { landUseConflictsMap } from "./soils/land-use-conflicts.map.js";
import { floodsMap } from "./threatening-phenomena/floods.map.js";
import { massRemovalHazardMap } from "./threatening-phenomena/mass-removal-hazard.map.js";
import { soilDegradationMap } from "./threatening-phenomena/soil-degradation.map.js";
import { expectedSeismicIntensityMap } from "./threatening-phenomena/expected-seismic-intensity.map.js";

export const BIOFISICO_MAP_HANDLERS = [
    hypsometryMap,
    slopesMap,
    geoformsMap,
    temperatureMap,
    precipitationMap,
    climatesMap,
    temperatureChangeCcMap,
    precipitationChangeCcMap,
    climateRiskMap,
    hydrographicBasinsMap,
    runoffMap,
    ecosystemsMap,
    deforestationRegenerationMap,
    soilOrderMap,
    soilVocationEdaphicSupplyMap,
    landUseConflictsMap,
    floodsMap,
    massRemovalHazardMap,
    soilDegradationMap,
    expectedSeismicIntensityMap
];

export const BIOFISICO_MAP_REGISTRY = {
    RELIEVE: ["hipsometria", "pendientes", "geoformas"],
    CLIMA: ["temperatura", "precipitacion", "climas", "cambio_temp", "cambio_precip", "riesgo_cc"],
    HIDROGRAFIA: ["cuencas", "escorrentia"],
    ECOSISTEMAS: ["ecosistemas", "deforestacion"],
    SUELOS: ["orden_suelo", "vocacion", "conflictos"],
    FENOMENOS: ["inundaciones", "remocion", "degradacion", "sismica"]
};

export function getBiofisicoMapGroup(config) {
    return getBiofisicoMapHandler(config)?.group || null;
}

export function getBiofisicoMapHandler(config) {
    return BIOFISICO_MAP_HANDLERS.find(handler => handler.supports(config)) || null;
}

export function getBiofisicoMapRegistryEntry(config) {
    const handler = getBiofisicoMapHandler(config);

    return {
        id: config?.id || "",
        group: handler?.group || null,
        strategy: handler?.strategy || "single-layer",
        hasVariants: Array.isArray(config?.variants) && config.variants.length > 0
    };
}
