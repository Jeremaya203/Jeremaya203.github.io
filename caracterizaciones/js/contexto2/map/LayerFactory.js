/**
 * LayerFactory.js — Fábrica de Capas FeatureLayer
 *
 * Crea instancias de FeatureLayer de ArcGIS con la configuración
 * adecuada según el tipo de capa (determinantes, condicionantes, línea, punto).
 *
 * Responsabilidad:
 *   - Crear FeatureLayer con url, definitionExpression, outFields
 *   - Aplicar renderer personalizado según flags (isDeterminantes, isCondicionantes, etc.)
 *   - Manejar casos especiales: variants, capas de datos vs visuales
 *
 * Dependencias:
 *   - LayerConfig.js para obtener la configuración de la capa
 *   - ArcGIS JS API (FeatureLayer)
 */
export class LayerFactory {
    constructor(config, coloresServices = null) {
        this.config = config;
        this.coloresServices = coloresServices;
    }

    create(layerCfg, whereBase, source = null) {
        return new Promise((resolve, reject) => {
            window.require(['esri/layers/FeatureLayer'], (FeatureLayer) => {
                try {
                    const layerSource = source || layerCfg;
                    const renderer = this._buildRenderer(layerCfg, layerSource);
                    const popupTemplate = this._buildPopupTemplate(layerCfg);
                    const layer = new FeatureLayer({
                        url: layerSource.url,
                        title: layerSource.title || layerCfg.title,
                        outFields: this._buildMapOutFields(layerCfg, layerSource),
                        definitionExpression: whereBase || '1=1',
                        minScale: layerSource.minScale ?? layerCfg.minScale ?? 0,
                        maxScale: layerSource.maxScale ?? layerCfg.maxScale ?? 0,
                        popupEnabled: true,
                        ...(popupTemplate ? { popupTemplate } : {}),
                        ...(renderer ? { renderer } : {})
                    });
                    layer.contextoGeometryType = layerSource.geometryType || layerCfg.geometryType || null;
                    layer.contextoGeometryLabel = layerSource.geometryLabel || layerCfg.geometryLabel || null;
                    layer.contextoLegendField = (layerSource.map || layerCfg.map || {}).field || layerCfg.filter?.categoryField || null;
                    layer.contextoSourceLayerId = layerSource.url || layerSource.title || layer.id || null;
                    resolve(layer);
                } catch (error) {
                    reject(error);
                }
            });
        });
    }

    _buildRenderer(layerCfg, source = null) {
        const mapConfig = source?.map || layerCfg?.map || {};
        if (mapConfig.rendererType === 'service') {
            return null;
        }

        if (mapConfig.rendererType === 'simple') {
            const symbolType = (source?.geometryType || layerCfg?.geometryType) === 'point'
                ? 'simple-marker'
                : (source?.geometryType || layerCfg?.geometryType) === 'polyline'
                    ? 'simple-line'
                    : 'simple-fill';
            return {
                type: 'simple',
                symbol: this._buildSimpleSymbol(symbolType, mapConfig)
            };
        }

        if (mapConfig.colorDomain && this.coloresServices) {
            return this.coloresServices.buildUniqueValueRenderer(mapConfig.colorDomain, {
                field: mapConfig.field,
                fieldType: mapConfig.fieldType || layerCfg?.filter?.categoryFieldType || 'string',
                geometryType: source?.geometryType || layerCfg?.geometryType
            });
        }

        return null;
    }

    _buildMapOutFields(layerCfg, source = null) {
        const mapConfig = source?.map || layerCfg?.map || {};
        const fields = [
            mapConfig?.field,
            mapConfig?.labelField,
            layerCfg?.filter?.categoryField,
            layerCfg?.filter?.territoryField,
            layerCfg?.filter?.departmentField,
            layerCfg?.popup?.titleField,
            ...(layerCfg?.popup?.fields || []).map(item => item.field)
        ].filter(Boolean);

        return fields.length ? [...new Set(fields)] : (layerCfg.outFields?.length ? layerCfg.outFields : ['*']);
    }

    _buildSimpleSymbol(symbolType, mapConfig) {
        if (symbolType === 'simple-line') {
            return {
                type: 'simple-line',
                color: mapConfig.lineColor || mapConfig.outlineColor || mapConfig.fillColor || '#999',
                width: Number(mapConfig.lineWidth ?? mapConfig.outlineWidth ?? 1),
                style: mapConfig.lineStyle || 'solid'
            };
        }

        if (symbolType === 'simple-marker') {
            return {
                type: 'simple-marker',
                style: mapConfig.markerStyle || 'circle',
                color: mapConfig.fillColor || '#999',
                size: Number(mapConfig.size || 7),
                outline: {
                    color: mapConfig.outlineColor || '#666',
                    width: Number(mapConfig.outlineWidth ?? 0.7)
                }
            };
        }

        return {
            type: 'simple-fill',
            color: mapConfig.fillColor || '#999',
            outline: {
                color: mapConfig.outlineColor || '#666',
                width: Number(mapConfig.outlineWidth ?? 0.7)
            }
        };
    }

    _buildPopupTemplate(layerCfg) {
        const popup = layerCfg?.popup;
        if (!popup?.titleField && !popup?.fields?.length) return null;

        return {
            title: popup.title || (popup.titleField ? `{${popup.titleField}}` : layerCfg.title),
            content: [{
                type: 'fields',
                fieldInfos: (popup.fields || []).map(item => ({
                    fieldName: item.field,
                    label: item.label || item.field,
                    format: item.format
                }))
            }]
        };
    }

    _buildDeterminantesRenderer() {
        return {
            type: 'unique-value',
            field: 'determ',
            uniqueValueInfos: [
                { value: 1, label: 'Ambientales', symbol: { type: 'simple-fill', color: '#70ad47' } },
                { value: 2, label: 'Soberanía Alimentaria', symbol: { type: 'simple-fill', color: '#ffc000' } },
                { value: 3, label: 'Patrimoniales', symbol: { type: 'simple-fill', color: '#7030a0' } },
                { value: 4, label: 'Infraestructura', symbol: { type: 'simple-fill', color: '#a6a6a6' } },
                { value: 5, label: 'Áreas Metropolitanas y Suburbanización', symbol: { type: 'simple-fill', color: '#ed4de0' } },
                { value: 6, label: 'Proyectos Turísticos Especiales', symbol: { type: 'simple-fill', color: '#4472c4' } }
            ]
        };
    }

    _buildCondicionantesRenderer() {
        return {
            type: 'unique-value',
            field: 'tcondi',
            uniqueValueInfos: [
                { value: 1, label: 'Territorios Colectivos', symbol: { type: 'simple-fill', color: '#FFC000' } },
                { value: 2, label: 'ERNR', symbol: { type: 'simple-fill', color: '#B58B5D' } },
                { value: 3, label: 'Acuerdo de Paz', symbol: { type: 'simple-fill', color: '#EAEAEA' } },
                { value: 4, label: 'POSPR', symbol: { type: 'simple-fill', color: '#92D050' } },
                { value: 5, label: 'ZOMAC', symbol: { type: 'simple-fill', color: '#C55A11' } }
            ]
        };
    }
}
