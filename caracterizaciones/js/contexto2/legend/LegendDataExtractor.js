import { ColorUtils } from '../utils/ColorUtils.js';

export class LegendDataExtractor {
    constructor(coloresServices = null) {
        this.coloresServices = coloresServices;
    }

    extract(layer, config) {
        if (Array.isArray(layer)) {
            return this.extractMany(layer, config);
        }

        const renderer = layer?.renderer;
        const infos = renderer?.uniqueValueInfos || [];
        const field = config?.legend?.field || config?.map?.field || renderer?.field;
        const colorDomain = config?.map?.colorDomain;

        return infos.map((info) => {
            const value = info.value ?? info.values?.[0]?.[0] ?? info.label;
            const label = info.label || String(value ?? 'Sin etiqueta');
            const colorInfo = this.coloresServices?.getColorInfo(colorDomain, value);
            return {
                code: String(value ?? label),
                value,
                label,
                field,
                color: this.getSymbolColor(info.symbol),
                iconUrl: this.getSymbolIconUrl(info.symbol),
                symbolType: this.getSymbolKind(info.symbol),
                hatchStyle: this.getSymbolHatchStyle(info.symbol) || this.getDomainHatchStyle(colorInfo),
                outlineColor: this.getSymbolOutlineColor(info.symbol) || colorInfo?.outlineColor,
                geometryLabel: this.getGeometryLabel(layer),
                sourceLayerId: layer?.id || layer?.uid || layer?.title || null
            };
        }).filter(item => item.label);
    }

    extractMany(layers = [], config) {
        return (layers || []).flatMap(layer => this.extract(layer, config));
    }

    extractFromAvailability(config, availability = []) {
        const field = config?.legend?.field || config?.filter?.categoryField || config?.map?.field;
        return (availability || []).flatMap(({ source, counts }) => {
            const colorDomain = source?.map?.colorDomain || config?.map?.colorDomain;
            const geometryLabel = source?.geometryLabel || this.getGeometryLabel(source);
            const geometryType = source?.geometryType || config?.geometryType;

            return [...(counts || new Map()).entries()]
                .filter(([, count]) => Number(count) > 0)
                .map(([value]) => {
                    const colorInfo = this.coloresServices?.getColorInfo(colorDomain, value);
                    return {
                        code: String(value),
                        value,
                        label: colorInfo?.label || String(value),
                        field,
                        color: geometryType === 'polyline'
                            ? (colorInfo?.lineColor || colorInfo?.fillColor || '#999')
                            : (colorInfo?.fillColor || colorInfo?.lineColor || '#999'),
                        iconUrl: colorInfo?.iconUrl || null,
                        symbolType: this.getDomainSymbolKind(geometryType, colorInfo),
                        hatchStyle: this.getDomainHatchStyle(colorInfo),
                        outlineColor: colorInfo?.outlineColor,
                        geometryLabel,
                        sourceLayerId: source?.url || source?.title || null
                    };
                });
        }).filter(item => item.label);
    }

    getSymbolColor(symbol) {
        const color = symbol?.color || symbol?.backgroundColor;
        return ColorUtils.toCss(color, '#999');
    }

    getSymbolIconUrl(symbol) {
        if (!symbol) return null;
        const type = String(symbol.type || '').toLowerCase();
        if (type === 'picture-marker' || type === 'esripms') {
            return symbol.url || null;
        }
        return null;
    }

    getSymbolKind(symbol) {
        const type = String(symbol?.type || '').toLowerCase();
        if (type.includes('line') || type === 'esrisls') return 'line';
        if (type.includes('marker') || type === 'esrisms' || type === 'esripms') return 'point';
        return 'polygon';
    }

    getDomainSymbolKind(geometryType, colorInfo = null) {
        const geometry = String(geometryType || '').toLowerCase();
        if (geometry.includes('line') || colorInfo?.lineColor) return 'line';
        if (geometry.includes('point') || colorInfo?.symbol?.type === 'point' || colorInfo?.symbol?.type === 'icon') return 'point';
        return 'polygon';
    }

    getSymbolHatchStyle(symbol) {
        const type = String(symbol?.type || '').toLowerCase();
        const style = String(symbol?.style || '').toLowerCase();
        if (!type.includes('fill') || !style || style === 'solid') return null;
        return style;
    }

    getDomainHatchStyle(colorInfo) {
        const type = String(colorInfo?.hatch?.type || '').toLowerCase();
        if (type.includes('dash') || type.includes('line') || type.includes('hatch')) {
            return 'forward-diagonal';
        }
        return null;
    }

    getSymbolOutlineColor(symbol) {
        return ColorUtils.toCss(symbol?.outline?.color, null);
    }

    sort(_config, entries) {
        const order = { Punto: 1, Línea: 2, Linea: 2, Polígono: 3, Poligono: 3 };
        return [...(entries || [])].sort((a, b) => {
            const geometryDiff = (order[a.geometryLabel] || 99) - (order[b.geometryLabel] || 99);
            if (geometryDiff) return geometryDiff;
            return a.label.localeCompare(b.label, 'es');
        });
    }

    getGeometryLabel(layer) {
        const title = String(layer?.title || '').toLowerCase();
        const geometryType = String(layer?.geometryType || '').toLowerCase();
        if (title.includes('punto') || geometryType.includes('point')) return 'Punto';
        if (title.includes('línea') || title.includes('linea') || geometryType.includes('polyline')) return 'Línea';
        if (title.includes('polígono') || title.includes('poligono') || geometryType.includes('polygon')) return 'Polígono';
        return null;
    }
}
