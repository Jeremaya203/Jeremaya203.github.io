import {
    climateStackedWhen,
    runClimateStackedHandler
} from "./climate-stacked-utils.js";

export function temperatureChangeCcStackedHandler(deps = {}) {
    return {
        when: climateStackedWhen("temp_cc"),
        run: async (ctx) => {
            try {
                await runClimateStackedHandler(ctx, deps);
            } catch (e) {
                console.error("CAMBIO_TEMPERATURA_CC_STACKED error:", e);
                ctx.destroyChart();
                ctx.updateLegend([], []);
            }
        }
    };
}
