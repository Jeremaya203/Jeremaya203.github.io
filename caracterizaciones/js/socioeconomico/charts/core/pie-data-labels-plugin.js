import { createPiePercentageLabelsPlugin as createSharedPiePercentageLabelsPlugin } from "../../../shared/charts/pie-percentage-labels-plugin.js?v=adaptive-internal-pie-labels-20260724";

export function createPiePercentageLabelsPlugin() {
    return createSharedPiePercentageLabelsPlugin({
        id: "socioeconomicoPiePercentageLabels",
        textColor: "#1e293b",
        guideColor: "rgba(30,41,59,0.72)",
        valuesArePercentages: false
    });
}

export function withPiePercentageLabels(config) {
    if (config?.type !== "pie" && config?.type !== "doughnut") return config;
    config.plugins = [
        ...(config.plugins || []),
        createPiePercentageLabelsPlugin()
    ];
    return config;
}
