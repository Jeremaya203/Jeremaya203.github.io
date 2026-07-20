export function createBiofisicoFeatureLayer({
    FeatureLayer,
    config,
    definitionExpression,
    visible = true,
    opacity = 0.8,
    minScale = 0,
    maxScale = 0
}) {
    return new FeatureLayer({
        url: config.url,
        definitionExpression,
        outFields: config.mapOutFields || config.outFields || ["*"],
        opacity,
        visible,
        minScale,
        maxScale
    });
}

export function createBiofisicoImageryLayer({
    ImageryLayer,
    config,
    mosaicWhere = "1=0",
    visible = true,
    opacity = 0.88
}) {
    const layerOptions = {
        url: config.mapUrl,
        title: config.title,
        opacity,
        visible,
        popupEnabled: false,
        mosaicRule: {
            where: mosaicWhere || "1=0"
        }
    };

    if (config.mapRasterFunctionName) {
        layerOptions.rasterFunction = {
            functionName: config.mapRasterFunctionName
        };
    }

    return new ImageryLayer(layerOptions);
}

export function createBiofisicoVariantLayers({
    FeatureLayer,
    config,
    definitionExpression,
    opacity = 0.8
}) {
    return (config.variants || []).map(variant => {
        const layer = new FeatureLayer({
            url: variant.url,
            definitionExpression,
            outFields: config.mapOutFields || config.outFields || ["*"],
            opacity,
            visible: false,
            minScale: variant.minScale,
            maxScale: variant.maxScale
        });

        return { key: variant.key, layer };
    });
}

export function configureVariantLayerLabels(layer) {
    layer.labelsVisible = false;
    layer.labelingInfo = [];
}
