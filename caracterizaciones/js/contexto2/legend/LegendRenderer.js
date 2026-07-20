export class LegendRenderer {
    constructor(state, eventBus) {
        this.state = state;
        this.eventBus = eventBus;
        this.contentEl = document.getElementById('legendContent');
        this.titleEl = document.getElementById('legendTitle');
        this.toggleEl = document.getElementById('legendToggle');
        this.items = [];
        this.activeValues = new Set();
        this._bindToggle();
        this._bindClick();
    }

    render(items = [], config = null) {
        if (!this.contentEl) return;
        this.config = config;
        const allowedValues = config?.legend?.allowedValues;
        const filteredItems = Array.isArray(allowedValues) && allowedValues.length
            ? (items || []).filter(item => allowedValues.map(String).includes(String(item.value ?? item.code ?? item.label)))
            : items;
        this.items = this._dedupe(filteredItems, config).map(item => ({
            ...item,
            legendKey: this._itemKey(item, config)
        }));
        this.activeValues = new Set(this.items.map(item => item.legendKey));
        this.updateTitle(config?.title || 'Leyenda');

        if (!this.items.length) {
            this.contentEl.innerHTML = '<p class="oot-js-contexto-legend-1">Sin clases activas</p>';
            return;
        }

        this.contentEl.innerHTML = '';
        const frag = document.createDocumentFragment();

        let currentGeometry = null;
        this.items.forEach(item => {
            if (config?.legend?.groupByGeometry && item.geometryLabel && item.geometryLabel !== currentGeometry) {
                currentGeometry = item.geometryLabel;
                const header = document.createElement('div');
                header.className = 'legend-geometry-heading';
                header.textContent = currentGeometry;
                header.style.margin = '8px 0 5px';
                header.style.fontWeight = '700';
                header.style.fontSize = '12px';
                header.style.color = '#004A69';
                frag.appendChild(header);
            }

            const value = String(item.value ?? item.code ?? item.label);
            const row = document.createElement('button');
            row.type = 'button';
            row.className = 'legend-item';
            row.dataset.key = item.legendKey;
            row.dataset.value = value;
            row.dataset.label = item.label || value;
            row.style.width = '100%';
            row.style.border = '0';
            row.style.background = 'transparent';
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.gap = '8px';
            row.style.marginBottom = '6px';
            row.style.padding = '3px 2px';
            row.style.cursor = 'pointer';
            row.style.textAlign = 'left';

            const swatch = document.createElement('span');
            swatch.className = 'legend-color';
            if (item.iconUrl) {
                swatch.style.background = 'transparent';
                swatch.style.width = '18px';
                swatch.style.height = '18px';
                swatch.style.minWidth = '18px';
                swatch.style.display = 'inline-flex';
                swatch.style.alignItems = 'center';
                swatch.style.justifyContent = 'center';
                const img = document.createElement('img');
                img.src = item.iconUrl;
                img.alt = '';
                img.style.width = '18px';
                img.style.height = '18px';
                img.style.objectFit = 'contain';
                swatch.appendChild(img);
            } else {
                swatch.style.background = item.color || '#999';
                if (item.symbolType === 'point') {
                    swatch.style.borderRadius = '50%';
                    swatch.style.width = '12px';
                    swatch.style.height = '12px';
                    swatch.style.minWidth = '12px';
                } else if (item.symbolType === 'line') {
                    swatch.style.background = 'transparent';
                    swatch.style.width = '24px';
                    swatch.style.height = '0';
                    swatch.style.minWidth = '24px';
                    swatch.style.borderTop = `3px solid ${item.color || '#999'}`;
                    swatch.style.borderRadius = '0';
                } else if (item.hatchStyle) {
                    const color = item.color || '#999';
                    swatch.style.background = '#fff';
                    swatch.style.backgroundImage = `repeating-linear-gradient(135deg, transparent 0 4px, ${color} 4px 6px, transparent 6px 10px)`;
                    swatch.style.border = `1px solid ${item.outlineColor || color}`;
                }
            }

            const text = document.createElement('span');
            text.className = 'legend-label';
            text.textContent = item.label || value;

            row.appendChild(swatch);
            row.appendChild(text);
            frag.appendChild(row);
        });

        this.contentEl.appendChild(frag);
        this.setActiveValues([...this.activeValues], { emit: false, keys: true });
    }

    clear(message = 'Seleccione un departamento o municipio') {
        this.items = [];
        this.activeValues = new Set();
        if (this.contentEl) {
            const paragraph = document.createElement('p');
            paragraph.style.margin = '0';
            paragraph.style.color = '#666';
            paragraph.textContent = message;
            this.contentEl.replaceChildren(paragraph);
        }
        this.updateTitle('Leyenda');
    }

    setActive(selection) {
        const legendField = this.config?.legend?.field || this.config?.filter?.categoryField;
        if (selection?.field && legendField && selection.field !== legendField) return;
        if (Array.isArray(selection?.activeLegendItems)) {
            const keys = selection.activeLegendItems.map(item => item.legendKey || this._itemKey(item, this.config));
            this.setActiveValues(keys, { emit: false, keys: true });
            return;
        }
        if (!selection?.values && selection?.value == null) {
            this.setActiveValues(this.items.map(item => item.legendKey), { emit: false, keys: true });
            return;
        }
        const values = selection.values || [selection.value];
        this.setActiveValues(values, { emit: false });
    }

    setActiveValues(values, options = {}) {
        const rawValues = (values || []).map(v => String(v));
        const nextValues = options.keys
            ? rawValues
            : this.items
                .filter(item => rawValues.includes(String(item.value ?? item.code ?? item.label)))
                .map(item => item.legendKey);
        this.activeValues = new Set(nextValues);
        this._syncDom();
        if (options.emit) this._emitSelection('legend');
    }

    updateTitle(text) {
        if (this.titleEl) this.titleEl.textContent = text || 'Leyenda';
    }

    toggleCollapse() {
        if (!this.contentEl || !this.toggleEl) return;
        const collapsed = this.contentEl.classList.toggle('collapsed');
        this.toggleEl.textContent = collapsed ? '+' : '-';
    }

    _bindToggle() {
        if (!this.toggleEl) return;
        this.toggleEl.addEventListener('click', () => this.toggleCollapse());
    }

    _bindClick() {
        if (!this.contentEl) return;
        this.contentEl.addEventListener('click', (event) => {
            const itemEl = event.target.closest('.legend-item');
            if (!itemEl) return;
            const key = String(itemEl.dataset.key || itemEl.dataset.value || '');
            if (!key) return;

            if (this.activeValues.has(key)) {
                this.activeValues.delete(key);
            } else {
                this.activeValues.add(key);
            }
            this._syncDom();
            this._emitSelection('legend');
        });
    }

    _emitSelection(source) {
        const config = this.state.get('activeLayerConfig');
        const field = config?.legend?.field || config?.filter?.categoryField;
        const activeItems = this.items.filter(item => this.activeValues.has(item.legendKey));
        const excludedItems = this.items.filter(item => !this.activeValues.has(item.legendKey));
        const activeGeometryLabel = config?.geometryLabel || null;
        const visibleItemsForChart = config?.legend?.groupByGeometry && activeGeometryLabel
            ? activeItems.filter(item => item.geometryLabel === activeGeometryLabel)
            : activeItems;
        const values = [...new Set(visibleItemsForChart.map(item => String(item.value ?? item.code ?? item.label)))];
        const excludedValues = [...new Set(
            (config?.legend?.groupByGeometry && activeGeometryLabel
                ? excludedItems.filter(item => item.geometryLabel === activeGeometryLabel)
                : excludedItems
            ).map(item => String(item.value ?? item.code ?? item.label))
        )];
        this.eventBus.emit('selection:changed', {
            source,
            layerId: config?.id,
            field,
            values,
            excludedValues,
            activeLegendItems: activeItems,
            excludedLegendItems: excludedItems,
            label: values.length === 1 ? this._labelForValue(values[0]) : null
        });
    }

    _syncDom() {
        if (!this.contentEl) return;
        this.contentEl.querySelectorAll('.legend-item').forEach(node => {
            const active = this.activeValues.has(String(node.dataset.key || node.dataset.value || ''));
            node.classList.toggle('off', !active);
            node.style.opacity = active ? '1' : '0.35';
        });
    }

    _labelForValue(value) {
        return this.items.find(item => String(item.value ?? item.code ?? item.label) === String(value))?.label || String(value);
    }

    _dedupe(items, config = null) {
        const seen = new Set();
        const groupByGeometry = !!config?.legend?.groupByGeometry;
        return (items || []).filter(item => {
            const key = groupByGeometry
                ? [item.geometryLabel || '', item.value ?? item.code ?? item.label].join('::')
                : String(item.value ?? item.code ?? item.label);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    _itemKey(item, config = null) {
        const value = String(item.value ?? item.code ?? item.label);
        if (!config?.legend?.groupByGeometry) return value;
        return `${item.geometryLabel || item.geometryType || 'sin-geometria'}::${value}`;
    }
}
