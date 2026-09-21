import { slopesPolarHandler } from "./relief/slopes-chart.js?v=pendientes-imageserver-20260716";
import { departmentHypsometryAggregateHandler, hipsometriaMunicipalHandler } from "./relief/hypsometry-chart.js?v=hipsometria-adaptive-bars-20260724";
import { bf3LandformsDepartmentPieHandler, dualLandformsHandler } from "./relief/geoforms-chart.js?v=geoformas-depto-title-fix-20260618";
import { climateDepartmentAggregateStackedHandler, temperatureStackedHandler } from "./climate/temperature-chart.js";
import { precipitationStackedHandler } from "./climate/precipitation-chart.js";
import { temperatureChangeCcStackedHandler } from "./climate/temperature-change-cc-chart.js";
import { precipitationChangeCcStackedHandler } from "./climate/precipitation-change-cc-chart.js";
import { climatesDepartmentPercentageHandler, climatesMunicipalHandler } from "./climate/climates-chart.js?v=axis-labels-final-20260617";
import { climateRiskDepartmentCountHandler, climateRiskMunicipalRadarHandler } from "./climate/climate-risk-chart.js";
import { basinsDepartmentDoughnutHandler, basinsMunicipalHandler } from "./hydrography/hydrographic-basins-chart.js?v=cuencas-depto-normalized-percent-active-20260617";
import { runoffDepartmentVerticalPercentageHandler, runoffMunicipalHandler } from "./hydrography/runoff-chart.js";
import { ecosystemConditionDepartmentDoughnutHandler, ecosystemsMunicipalHandler } from "./ecosystems/ecosystems-chart.js?v=ecosistemas-legend-real-codes-20260616";
import { forestDepartmentLineHandler, deforestationMunicipalSeriesHandler } from "./ecosystems/deforestation-regeneration-chart.js?v=deforestacion-sync-20260616";
import { soilOrderDepartmentPieHandler, soilOrderMunicipalHandler } from "./soils/soil-order-chart.js?v=orden-suelo-depto-normalized-20260617";
import { landSuitabilityDepartmentDoughnutHandler, dualLandSuitabilityHandler } from "./soils/soil-vocation-edaphic-supply-chart.js?v=vocacion-depto-multiseries-20260617";
import { landUseConflictsDepartmentPercentageHandler, landUseConflictsMunicipalHandler } from "./soils/land-use-conflicts-chart.js?v=axis-labels-final-20260617";
import { phenomenaDepartmentPercentageHandler, floodsMunicipalHandler } from "./threatening-phenomena/floods-chart.js";
import { massRemovalMunicipalHandler } from "./threatening-phenomena/mass-removal-hazard-chart.js?v=remocion-service-colors-20260724";
import { degradationDepartmentStackedHandler, degradationMunicipalSimpleHandler, degradationMunicipalStackedHandler } from "./threatening-phenomena/soil-degradation-chart.js?v=degradacion-domain-labels-v2-20260724";
import { seismicMunicipalHandler } from "./threatening-phenomena/expected-seismic-intensity-chart.js";

export function createBiofisicoChartHandlers(deps = {}) {
    globalThis.__biofisicoChartDeps = deps;

    return [
        hipsometriaMunicipalHandler(deps),
        departmentHypsometryAggregateHandler(deps),
        slopesPolarHandler(deps),
        phenomenaDepartmentPercentageHandler(deps),
        degradationDepartmentStackedHandler(deps),
        degradationMunicipalStackedHandler(deps),
        floodsMunicipalHandler(deps),
        massRemovalMunicipalHandler(deps),
        seismicMunicipalHandler(deps),
        degradationMunicipalSimpleHandler(deps),
        landSuitabilityDepartmentDoughnutHandler(deps),
        basinsMunicipalHandler(deps),
        basinsDepartmentDoughnutHandler(deps),
        runoffMunicipalHandler(deps),
        climateRiskDepartmentCountHandler(deps),
        dualLandSuitabilityHandler(deps),
        soilOrderMunicipalHandler(deps),
        landUseConflictsMunicipalHandler(deps),
        landUseConflictsDepartmentPercentageHandler(deps),
        soilOrderDepartmentPieHandler(deps),
        temperatureStackedHandler(deps),
        precipitationStackedHandler(deps),
        temperatureChangeCcStackedHandler(deps),
        precipitationChangeCcStackedHandler(deps),
        climatesMunicipalHandler(deps),
        climateRiskMunicipalRadarHandler(deps),
        climateDepartmentAggregateStackedHandler(deps),
        dualLandformsHandler(deps),
        bf3LandformsDepartmentPieHandler(deps),
        ecosystemsMunicipalHandler(deps),
        deforestationMunicipalSeriesHandler(deps),
        ecosystemConditionDepartmentDoughnutHandler(deps),
        climatesDepartmentPercentageHandler(deps),
        runoffDepartmentVerticalPercentageHandler(deps),
        forestDepartmentLineHandler(deps)
    ];
}

export const BIOFISICO_CHART_REGISTRY = {
    RELIEVE: ["hipsometria", "pendientes", "geoformas"],
    CLIMA: ["temperatura", "precipitacion", "climas", "temperatura_cc", "precipitacion_cc", "riesgo_cc"],
    HIDROGRAFIA: ["cuencas", "escorrentia"],
    ECOSISTEMAS: ["ecosistemas", "deforestacion"],
    SUELOS: ["orden_suelo", "vocacion", "conflictos"],
    FENOMENOS: ["inundaciones", "remocion", "degradacion", "sismica"],
    RELACIONES: ["inundaciones", "remocion", "degradacion", "sismica"]
};

export function getChartsForMode(mode) {
    return BIOFISICO_CHART_REGISTRY[mode] || [];
}
