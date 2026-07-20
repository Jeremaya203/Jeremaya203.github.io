import { SqlUtils } from '../utils/SqlUtils.js';

export class LayerFilter {
    constructor(state, eventBus) {
        this.state = state;
        this.eventBus = eventBus;
        this.filterCycleId = 0;
    }

    apply(where, options = {}) {
        const layers = this._getLayers();
        if (!layers.length) return;
        const expression = where || this.state.get('whereBase') || '1=1';
        if (options.viewFilter) {
            this._applyViewFilter(expression);
            this.state.set('activeFilter', expression);
            return;
        }
        this._clearViewFilter();
        layers.forEach(layer => {
            layer.definitionExpression = expression;
        });
        this.state.set('activeFilter', expression);
        if (options.zoom !== false) this._zoomToWhere(expression);
    }

    applySelection(selection, config) {
        const where = this.buildSelectionWhere(selection, config);
        this.apply(where, { zoom: selection?.source !== 'legend' });
    }

    applyGeometryLegendSelection(selection, config) {
        const layers = this._getLayers();
        if (!layers.length) return false;
        const items = selection?.activeLegendItems;
        if (!Array.isArray(items)) return false;

        const base = SqlUtils.combine(this.state.get('whereBase') || '1=1', config?.filter?.fixedWhere);
        const field = selection?.field || config?.filter?.categoryField || config?.legend?.field;
        if (!field) return false;

        const fieldType = config?.filter?.categoryFieldType || config?.chart?.selectionFieldType || 'string';
        const valuesByGeometry = new Map();
        items.forEach(item => {
            const geometryKey = this._normalizeGeometryKey(item.geometryType || item.geometryLabel);
            const value = item.value ?? item.code ?? item.label;
            if (!geometryKey || value == null || value === '') return;
            if (!valuesByGeometry.has(geometryKey)) valuesByGeometry.set(geometryKey, new Set());
            valuesByGeometry.get(geometryKey).add(String(value));
        });

        this._clearViewFilter();
        layers.forEach(layer => {
            const geometryKey = this._normalizeGeometryKey(layer.contextoGeometryType || layer.contextoGeometryLabel || layer.geometryType || layer.title);
            const values = [...(valuesByGeometry.get(geometryKey) || [])];
            const categoryWhere = values.length
                ? SqlUtils.buildInClause(layer.contextoLegendField || field, values, fieldType)
                : '1=0';
            layer.definitionExpression = SqlUtils.combine(base, categoryWhere || '1=0');
        });
        this.state.set('activeFilter', base);
        return true;
    }

    applyLegendFilter(legendState) {
        this.apply(legendState?.where || this.state.get('whereBase') || '1=1');
    }

    reset() {
        const config = this.state.get('activeLayerConfig');
        this.apply(SqlUtils.combine(this.state.get('whereBase') || '1=1', config?.filter?.fixedWhere));
    }

    clearViewFilter() {
        this._clearViewFilter();
    }

    buildSelectionWhere(selection, config) {
        const base = SqlUtils.combine(this.state.get('whereBase') || '1=1', config?.filter?.fixedWhere);
        const field = selection?.field || config?.filter?.categoryField || config?.legend?.field;
        const values = selection?.values || (selection?.value != null ? [selection.value] : null);
        if (!field) return base;
        if (!values || !values.length) return SqlUtils.combine(base, '1=0');

        const mappedWhere = this._buildMappedSelectionWhere(values, config, selection);
        if (mappedWhere) return SqlUtils.combine(base, mappedWhere);

        const fieldType = field === config?.chart?.selectionField
            ? (config?.chart?.selectionFieldType || config?.filter?.categoryFieldType || 'string')
            : (config?.filter?.categoryFieldType || 'string');
        const excludedValues = selection?.excludedValues || [];
        if (selection?.source === 'legend' && excludedValues.length && excludedValues.length < values.length) {
            const exclusionWhere = SqlUtils.buildNotInClause(field, excludedValues, fieldType);
            return SqlUtils.combine(base, exclusionWhere || '1=0');
        }
        const categoryWhere = SqlUtils.buildInClause(field, values, fieldType);
        return SqlUtils.combine(base, categoryWhere || '1=0');
    }

    _buildMappedSelectionWhere(values, config, selection) {
        const map = config?.filter?.selectionWhereByValue;
        if (!map) return '';
        const included = (values || [])
            .map(value => map[String(value)])
            .filter(Boolean);
        if (!included.length) return '';

        const allClauses = Object.values(map).filter(Boolean);
        if (included.length === allClauses.length && selection?.source === 'legend') return '';
        return included.length === 1
            ? included[0]
            : `(${included.map(clause => `(${clause})`).join(' OR ')})`;
    }

    _zoomToWhere(where) {
        const layer = this._getLayers()[0];
        const view = this.state.view;
        if (!layer || !view || !where || where === '1=0') return;

        layer.queryExtent({ where }).then((result) => {
            if (result?.extent) view.goTo(result.extent.expand(1.2)).catch(() => {});
        }).catch(() => {});
    }

    _applyViewFilter(where) {
        const layers = this._getLayers();
        const view = this.state.view;
        if (!view || !layers.length) return;

        const cycleId = ++this.filterCycleId;
        layers.forEach(layer => {
            view.whenLayerView(layer).then(layerView => {
                if (cycleId !== this.filterCycleId) return;
                layerView.filter = where && where !== '1=1' ? { where } : null;
            }).catch(() => {
                if (cycleId !== this.filterCycleId) return;
                layer.definitionExpression = where || this.state.get('whereBase') || '1=1';
            });
        });
    }

    _clearViewFilter() {
        const layers = this._getLayers();
        const view = this.state.view;
        if (!view || !layers.length) return;

        const cycleId = ++this.filterCycleId;
        layers.forEach(layer => {
            view.whenLayerView(layer).then(layerView => {
                if (cycleId !== this.filterCycleId) return;
                layerView.filter = null;
            }).catch(() => {});
        });
    }

    _getLayers() {
        return this.state.layersGlobal?.length
            ? this.state.layersGlobal
            : [this.state.layerGlobal].filter(Boolean);
    }

    _normalizeGeometryKey(value) {
        const text = String(value || '').toLowerCase();
        if (text.includes('point') || text.includes('punto')) return 'point';
        if (text.includes('polyline') || text.includes('linea') || text.includes('línea')) return 'polyline';
        if (text.includes('polygon') || text.includes('poligono') || text.includes('polígono')) return 'polygon';
        return '';
    }
}
