import {
    climateStackedWhen,
    runClimateStackedHandler
} from "./climate-stacked-utils.js";

export function precipitationChangeCcStackedHandler(deps = {}) {
    return {
        when: climateStackedWhen("precip_cc"),
        run: async (ctx) => {
            try {
                await runClimateStackedHandler(ctx, deps);
            } catch (e) {
                console.error("CAMBIO_PRECIPITACION_CC_STACKED error:", e);
                ctx.destroyChart();
                ctx.updateLegend([], []);
            }
        }
    };
}
