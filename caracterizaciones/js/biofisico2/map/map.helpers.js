export function destroyLayerSafe(layer) {
    try {
        layer?.destroy?.();
    } catch (e) {}
}

export function pickLayerByScale(layers, view) {
    if (!view) return layers[0];

    const s = Number(view.scale);
    if (!Number.isFinite(s)) return layers[0];

    return (
        layers.find(l =>
            (l.minScale === 0 || s <= l.minScale) &&
            (l.maxScale === 0 || s >= l.maxScale)
        ) || layers[0]
    );
}

export function getGeoformasScaleTitle(scale) {
    const s = Number(scale);

    if (s > 2000000) {
        return "Geoformas - Paisaje";
    }


    return "Geoformas - Tipo de relieve";
}

export function pickExistingField(layer, candidates) {
    const fields = (layer?.fields || []).map(field => String(field.name).toLowerCase());
    for (const candidate of candidates) {
        if (fields.includes(String(candidate).toLowerCase())) return candidate;
    }
    return null;
}

export function pickVariantByScale(config, scale) {
    if (!config?.variants?.length) return null;
    return config.variants.find(variant => scale <= variant.minScale && scale > variant.maxScale) ||
        config.variants[config.variants.length - 1];
}

export function getDeptoCuencasGroupField(config, layer) {
    const map = config?.cuencasAgg?.groupByLayerId || {};
    const layerId = layer?.layerId;
    return map[layerId] || config?.cuencasAgg?.groupField || "zonahid";
}

export function buildCuencasDictFromRenderer(layerJson) {
    const infos = layerJson?.drawingInfo?.renderer?.uniqueValueInfos || [];
    const map = new Map();

    infos.forEach(info => {
        const value = String(info.value);
        const label = String(info.label || value);
        const color = info?.symbol?.color || [150, 150, 150, 255];
        const rgba = `rgba(${color[0]},${color[1]},${color[2]},${(color[3] ?? 255) / 255})`;

        map.set(value, { label, color: rgba });
    });

    return map;
}