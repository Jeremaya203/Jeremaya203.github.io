import { pendientesPolarHandler } from "./relief/slopes.chart.js?v=pendientes-imageserver-20260716";
import { hipsometriaDeptoAggHandler, hipsometriaMunicipalHandler } from "./relief/hypsometry.chart.js?v=hipsometria-muni-height-20260619";
import { bf3GeoformasDeptoPieHandler, geoformasDualHandler } from "./relief/geoforms.chart.js?v=geoformas-depto-title-fix-20260618";
import { climaDeptoAggStackedHandler, temperaturaStackedHandler } from "./climate/temperature.chart.js";
import { precipitacionStackedHandler } from "./climate/precipitation.chart.js";
import { cambioTemperaturaCcStackedHandler } from "./climate/temperature-change-cc.chart.js";
import { cambioPrecipitacionCcStackedHandler } from "./climate/precipitation-change-cc.chart.js";
import { climasDeptoPctHandler, climasMunicipalHandler } from "./climate/climates.chart.js?v=axis-labels-final-20260617";
import { riesgoCCDeptoCountHandler, riesgoCCMunicipalRadarHandler } from "./climate/climate-risk.chart.js";
import { cuencasDeptoDonutHandler, cuencasMunicipalHandler } from "./hydrography/hydrographic-basins.chart.js?v=cuencas-depto-normalized-percent-active-20260617";
import { escorrentiaDeptoPctVerticalHandler, escorrentiaMunicipalHandler } from "./hydrography/runoff.chart.js";
import { ecosistemasCondicionDeptoDonutHandler, ecosistemasMunicipalHandler } from "./ecosystems/ecosystems.chart.js?v=ecosistemas-legend-real-codes-20260616";
import { bosqueDeptoLineaHandler, deforestacionMunicipalSerieHandler } from "./ecosystems/deforestation-regeneration.chart.js?v=deforestacion-sync-20260616";
import { ordenSueloDeptoPieHandler, ordenSueloMunicipalHandler } from "./soils/soil-order.chart.js?v=orden-suelo-depto-normalized-20260617";
import { vocacionDeptoDonutHandler, vocacionDualHandler } from "./soils/soil-vocation-edaphic-supply.chart.js?v=vocacion-depto-multiseries-20260617";
import { conflictosSueloDeptoPctHandler, conflictosSueloMunicipalHandler } from "./soils/land-use-conflicts.chart.js?v=axis-labels-final-20260617";
import { fenomDeptoPctHandler, inundacionesMunicipalHandler } from "./threatening-phenomena/floods.chart.js";
import { remocionMunicipalHandler } from "./threatening-phenomena/mass-removal-hazard.chart.js?v=remocion-depto-normalized-percent-20260617";
import { degradacionDeptoStackedHandler, degradacionMunicipalSimpleHandler, degradacionMunicipalStackedHandler } from "./threatening-phenomena/soil-degradation.chart.js?v=soil-degradation-initial-active-20260617";
import { sismicaMunicipalHandler } from "./threatening-phenomena/expected-seismic-intensity.chart.js";

export function createBiofisicoChartHandlers(deps = {}) {
    globalThis.__biofisicoChartDeps = deps;

    return [
        hipsometriaMunicipalHandler(deps),
        hipsometriaDeptoAggHandler(deps),
        pendientesPolarHandler(deps),
        fenomDeptoPctHandler(deps),
        degradacionDeptoStackedHandler(deps),
        degradacionMunicipalStackedHandler(deps),
        inundacionesMunicipalHandler(deps),
        remocionMunicipalHandler(deps),
        sismicaMunicipalHandler(deps),
        degradacionMunicipalSimpleHandler(deps),
        vocacionDeptoDonutHandler(deps),
        cuencasMunicipalHandler(deps),
        cuencasDeptoDonutHandler(deps),
        escorrentiaMunicipalHandler(deps),
        riesgoCCDeptoCountHandler(deps),
        vocacionDualHandler(deps),
        ordenSueloMunicipalHandler(deps),
        conflictosSueloMunicipalHandler(deps),
        conflictosSueloDeptoPctHandler(deps),
        ordenSueloDeptoPieHandler(deps),
        temperaturaStackedHandler(deps),
        precipitacionStackedHandler(deps),
        cambioTemperaturaCcStackedHandler(deps),
        cambioPrecipitacionCcStackedHandler(deps),
        climasMunicipalHandler(deps),
        riesgoCCMunicipalRadarHandler(deps),
        climaDeptoAggStackedHandler(deps),
        geoformasDualHandler(deps),
        bf3GeoformasDeptoPieHandler(deps),
        ecosistemasMunicipalHandler(deps),
        deforestacionMunicipalSerieHandler(deps),
        ecosistemasCondicionDeptoDonutHandler(deps),
        climasDeptoPctHandler(deps),
        escorrentiaDeptoPctVerticalHandler(deps),
        bosqueDeptoLineaHandler(deps)
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
