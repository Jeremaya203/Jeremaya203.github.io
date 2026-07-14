import {
    climateStackedWhen,
    runClimateStackedHandler
} from "./climate-stacked.utils.js";

export function precipitacionStackedHandler(deps = {}) {
    return {
        when: climateStackedWhen("precip"),
        run: async (ctx) => {
            try {
                await runClimateStackedHandler(ctx, deps);
            } catch (e) {
                console.error("PRECIPITACION_STACKED error:", e);
                ctx.destroyChart();
                ctx.actualizarLeyenda([], []);
            }
        }
    };
}
