export class HorizontalBarRenderer {
    constructor(chartFactory, chartLifecycle, eventBus, state = null) {
        this.chartFactory = chartFactory;
        this.chartLifecycle = chartLifecycle;
        this.eventBus = eventBus;
        this.state = state;
        this.chart = null;
        this.allItems = [];
        this.visibleItems = [];
        this.config = null;
        this.lastLegendValues = null;
    }

    render(items, config) {
        this.config = config;
        this.allItems = [...(items || [])];
        this.visibleItems = [...this.allItems];
        this.lastLegendValues = null;
        this._draw(this.visibleItems);
    }

    setActive(selection) {
        if (!this.config) return;
        const chartField = this.config?.chart?.selectionField || this.config?.chart?.categoryField;
        const linkedField = this.config?.chart?.colorValueField || this.config?.filter?.categoryField;
        const matchesChartField = !selection?.field || !chartField || selection.field === chartField;
        const matchesLinkedField = selection?.field && linkedField && selection.field === linkedField;
        if (!matchesChartField && !matchesLinkedField) return;

        const values = selection?.values || (selection?.value != null ? [selection.value] : null);
        if (!values) {
            this.visibleItems = this._itemsForAllowedLegendValues();
            this._draw(this.visibleItems);
            return;
        }
        if (!values.length && this.config?.chart?.keepVisibleWhenSelectionEmpty) {
            if (selection?.source === 'legend') this.visibleItems = [];
            this._draw([], { keepCanvasVisible: true });
            return;
        }
        const active = new Set(values.map(v => String(v)));
        const valueGetter = matchesLinkedField
            ? (item) => item.colorValue
            : (item) => item.value;

        if (selection?.source === 'legend') {
            this.lastLegendValues = new Set(active);
            this.visibleItems = this.allItems.filter(item => active.has(String(valueGetter(item))));
            this._draw(this.visibleItems);
            return;
        }

        this._draw(this.visibleItems.length ? this.visibleItems : this.allItems, {
            activeValues: active,
            activeValueGetter: valueGetter,
            highlightOnly: true
        });
    }

    clear() {
        this._destroyChart();
        this._resetCanvasLayout();
        this.allItems = [];
        this.visibleItems = [];
        this.lastLegendValues = null;
    }

    _resetCanvasLayout() {
        const canvas = document.getElementById('chart');
        this._clearHtmlBars();
        if (!canvas) return;
        canvas.closest('.chart-canvas-wrap')?.style.removeProperty('max-height');
        this.chartLifecycle?.destroyCanvasChart?.(canvas);
        this.chartLifecycle?.clearCanvas?.(canvas);
        canvas.classList.remove('chart-canvas--dynamic');
        canvas.removeAttribute('width');
        canvas.removeAttribute('height');
        canvas.style.removeProperty('--chart-height');
        canvas.style.removeProperty('display');
        canvas.style.removeProperty('width');
        canvas.style.removeProperty('min-height');
        canvas.style.removeProperty('height');
        canvas.style.removeProperty('max-height');
        canvas.style.removeProperty('min-width');
        canvas.style.removeProperty('max-width');
        canvas.ondblclick = null;
    }

    _prepareCanvasLayout(canvas, items) {
        const count = items.length;
        const dense = count > 8;
        const veryDense = count > 12;
        const width = window.innerWidth || 1280;
        const isVerySmallScreen = width <= 420;
        const isSmallScreen = width <= 768;
        const yTickSize = this._getYAxisTickSize(items, {
            veryDense,
            dense,
            isVerySmallScreen,
            isSmallScreen
        });
        const labelWrapOptions = this._getYAxisLabelWrapOptions(canvas, {
            dense,
            isSmallScreen,
            yTickSize,
            titleFontSize: isVerySmallScreen ? 10 : 11
        });
        const labelLineCount = this._estimateMaxLabelLines(items, labelWrapOptions);
        const baseRowHeight = veryDense ? 34 : dense ? 40 : 44;
        const rowHeight = Math.max(baseRowHeight, 24 + labelLineCount * 15);
        const naturalChartHeight = Math.max(320, count * rowHeight);
        const nationalMaxHeight = Number(this.config?.chart?.nationalMaxHeight || 0);
        const isNationalView = !String(this.state?.get?.('filtroNivel') || '').trim();
        const chartHeight = isNationalView && nationalMaxHeight > 0
            ? Math.min(naturalChartHeight, Math.max(320, nationalMaxHeight))
            : naturalChartHeight;
        const canvasWrap = canvas.closest('.chart-canvas-wrap');
        if (canvasWrap && isNationalView && nationalMaxHeight > 0) {
            canvasWrap.style.maxHeight = 'none';
        }

        if (count > 6) {
            canvas.classList.add('chart-canvas--dynamic');
            canvas.style.setProperty('--chart-height', `${chartHeight}px`);
        } else {
            canvas.classList.remove('chart-canvas--dynamic');
            canvas.style.removeProperty('--chart-height');
        }

        return { dense, veryDense, rowHeight, chartHeight, labelLineCount, labelWrapOptions, yTickSize };
    }

    _destroyChart() {
        if (this.chart) {
            this.chartLifecycle.destroy(this.chart);
            this.chart = null;
        }
    }

    _draw(items, options = {}) {
        const canvas = document.getElementById('chart');
        if (!canvas) return;

        this._destroyChart();
        this._resetCanvasLayout();
        const keepCanvasVisible = !!options.keepCanvasVisible;
        if (this.config?.chart?.useHtmlDenseLabels && items.length > 6) {
            canvas.style.display = 'none';
            this._drawHtmlBars(items, options);
            return;
        }
        this._clearHtmlBars();
        canvas.style.display = items.length || keepCanvasVisible ? 'block' : 'none';

        const layout = this._prepareCanvasLayout(canvas, items);
        const { dense, veryDense, labelWrapOptions, yTickSize } = layout;
        const width = window.innerWidth || 1280;
        const isVerySmallScreen = width <= 420;
        const isSmallScreen = width <= 768;
        const axisFont = {
            family: 'Outfit, sans-serif',
            weight: '400'
        };
        const titleFont = {
            family: 'Outfit, sans-serif',
            size: isVerySmallScreen ? 10 : 11,
            weight: '400'
        };
        const thinBars = !!this.config?.chart?.thinBars;
        const labels = items.map(item => this._formatCategoryLabel(item.label, labelWrapOptions));
        const values = items.map(item => Number(item.total || 0));
        const activeValues = options.activeValues instanceof Set ? options.activeValues : null;
        const activeValueGetter = typeof options.activeValueGetter === 'function'
            ? options.activeValueGetter
            : (item) => item.value;
        const hasHighlight = !!activeValues?.size && !!options.highlightOnly;
        const colors = items.map(item => {
            const color = item.color || '#999';
            if (!hasHighlight) return color;
            return activeValues.has(String(activeValueGetter(item)))
                ? color
                : this._withOpacity(color, 0.24);
        });
        const borderColors = items.map(item => {
            const color = item.color || '#999';
            if (!hasHighlight) return color;
            return activeValues.has(String(activeValueGetter(item))) ? '#1f2937' : this._withOpacity(color, 0.18);
        });
        const borderWidths = items.map(item => {
            if (!hasHighlight) return 1;
            return activeValues.has(String(activeValueGetter(item))) ? 2 : 1;
        });

        this.chart = this.chartFactory.create('bar', canvas, {
            labels,
            datasets: [{
                label: this.config?.chart?.valueLabel || 'Porcentaje',
                data: values,
                backgroundColor: colors,
                borderColor: borderColors,
                borderWidth: borderWidths,
                borderRadius: 4,
                barThickness: thinBars ? (veryDense ? 10 : dense ? 12 : 14) : (veryDense ? 14 : dense ? 16 : 22),
                categoryPercentage: veryDense ? 0.72 : dense ? 0.78 : 0.82
            }]
        }, {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            resizeDelay: 120,
            layout: {
                padding: {
                    right: veryDense ? 8 : 12
                }
            },
            onClick: (_event, elements) => {
                if (!elements.length) return;
                const item = items[elements[0].index];
                if (!item) return;
                this.eventBus.emit('selection:changed', {
                    source: 'chart',
                    layerId: this.config?.id,
                    field: this.config?.chart?.selectionField || this.config?.filter?.categoryField || this.config?.chart?.categoryField,
                    value: item.value,
                    values: [item.value],
                    label: item.label
                });
            },
            scales: {
                x: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: this.config?.chart?.valueLabel || 'Porcentaje de determinante',
                        font: titleFont
                    },
                    ticks: {
                        callback: (value) => this._formatValue(value),
                        maxTicksLimit: dense ? 5 : 8,
                        font: {
                            ...axisFont,
                            size: isVerySmallScreen ? 9 : 10
                        }
                    }
                },
                y: {
                    afterFit: (scale) => {
                        scale.width = this._calculateYAxisWidth(scale, labels, {
                            canvas,
                            yTickSize,
                            titleFontSize: titleFont.size,
                            isSmallScreen
                        });
                    },
                    title: {
                        display: true,
                        text: this.config?.chart?.categoryLabel || 'Subtipo de determinante',
                        font: titleFont,
                        padding: {
                            bottom: 10
                        }
                    },
                    ticks: {
                        autoSkip: false,
                        padding: 8,
                        font: {
                            ...axisFont,
                            size: yTickSize
                        }
                    },
                    grid: {
                        display: true,
                        color: 'rgba(0,0,0,0.06)'
                    }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => this._formatValue(ctx.parsed.x)
                    }
                }
            }
        }, [this._valueLabelsPlugin(), this._highlightGlowPlugin()]);

        if (this.chart) {
            this.chartLifecycle.register(this.chart);
            this.chart.resize();
            this._bindCanvasDoubleClick(canvas);
        }
    }

    _itemsForAllowedLegendValues() {
        if (!(this.lastLegendValues instanceof Set)) return [...this.allItems];
        return this.allItems.filter(item => {
            const values = [item.value, item.colorValue]
                .filter(value => value != null)
                .map(value => String(value));
            return values.some(value => this.lastLegendValues.has(value));
        });
    }

    _bindCanvasDoubleClick(canvas) {
        canvas.ondblclick = (event) => {
            const points = this.chart?.getElementsAtEventForMode?.(event, 'nearest', { intersect: true }, true) || [];
            if (points.length) return;
            this._restoreAllowedCategories();
        };
    }

    _restoreAllowedCategories() {
        this.visibleItems = [...this.allItems];
        this.lastLegendValues = null;
        this._draw(this.visibleItems, { keepCanvasVisible: true });
        this.eventBus.emit('selection:cleared', {
            source: 'chart'
        });
    }

    _allowedLegendValues() {
        if (this.lastLegendValues instanceof Set) return [...this.lastLegendValues];
        return this.allItems
            .map(item => item.colorValue ?? item.value)
            .filter(value => value != null)
            .map(value => String(value));
    }

    _valueLabelsPlugin() {
        return {
            id: 'contexto2HorizontalValueLabels',
            afterDatasetsDraw: (chart) => {
                const { ctx } = chart;
                const dataset = chart.data.datasets[0];
                const meta = chart.getDatasetMeta(0);
                const width = window.innerWidth || 1280;
                const labelCount = chart.data.labels.length;
                const fontSize = width <= 420 ? 10 : (labelCount > 12 ? 10 : 11);
                ctx.save();
                ctx.font = `500 ${fontSize}px Outfit, sans-serif`;
                ctx.textBaseline = 'middle';
                meta.data.forEach((bar, index) => {
                    const value = Number(dataset.data[index] || 0);
                    this._drawValueLabel(ctx, chart, bar, this._formatValue(value));
                });
                ctx.restore();
            }
        };
    }

    _drawValueLabel(ctx, chart, bar, label) {
        const placement = this.config?.chart?.valueLabelPlacement;
        if (placement !== 'center-or-end') {
            ctx.fillStyle = '#333';
            ctx.fillText(label, bar.x + 6, bar.y);
            return;
        }

        const chartArea = chart.chartArea || {};
        const compact = chart.data.labels.length > 12;
        const paddingX = compact ? 0 : 6;
        const paddingY = 3;
        const gap = 6;
        const radius = 4;
        const textWidth = ctx.measureText(label).width;
        const boxWidth = textWidth + paddingX * 2;
        const boxHeight = 18;
        const barStart = Math.min(bar.base ?? 0, bar.x ?? 0);
        const barEnd = Math.max(bar.base ?? 0, bar.x ?? 0);
        const barWidth = Math.max(0, barEnd - barStart);
        const fitsInside = barWidth >= boxWidth + gap * 2;

        let boxX = fitsInside
            ? barStart + (barWidth - boxWidth) / 2
            : barEnd + gap;

        const minX = Number.isFinite(chartArea.left) ? chartArea.left : boxX;
        const maxX = Number.isFinite(chartArea.right) ? chartArea.right - boxWidth : boxX;
        boxX = Math.max(minX, Math.min(boxX, maxX));

        const boxY = bar.y - boxHeight / 2;
        if (!compact) {
            this._roundedRect(ctx, boxX, boxY, boxWidth, boxHeight, radius);
            ctx.fillStyle = 'rgba(255,255,255,0.94)';
            ctx.fill();
            ctx.lineWidth = 1;
            ctx.strokeStyle = 'rgba(0,0,0,0.12)';
            ctx.stroke();
        }

        ctx.fillStyle = compact && fitsInside ? '#fff' : '#333';
        ctx.textAlign = 'center';
        ctx.fillText(label, boxX + boxWidth / 2, bar.y);
        ctx.textAlign = 'left';
    }

    _roundedRect(ctx, x, y, width, height, radius) {
        const r = Math.min(radius, width / 2, height / 2);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + width - r, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + r);
        ctx.lineTo(x + width, y + height - r);
        ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
        ctx.lineTo(x + r, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    _calculateYAxisWidth(scale, labels, options = {}) {
        const canvas = options.canvas;
        const chartWidth = canvas?.clientWidth || 420;
        const ctx = scale?.chart?.ctx;
        const labelFontSize = Number(options.yTickSize || 11);
        const titleFontSize = Number(options.titleFontSize || 11);
        const axisTitle = this.config?.chart?.categoryLabel || '';

        const labelWidth = this._measureMaxLabelWidth(ctx, labels, labelFontSize);
        const titleReserve = axisTitle ? titleFontSize + 12 : 0;
        const tickReserve = labelWidth > 0 ? 14 : 0;
        const measuredWidth = Math.ceil(titleReserve + tickReserve + labelWidth);

        const minWidth = Math.ceil(titleReserve + (options.isSmallScreen ? 42 : 54));
        const maxWidth = this._getMaxYAxisWidth(chartWidth, options.isSmallScreen, minWidth);
        const fallbackWidth = Number(scale?.width || 0);

        return Math.max(
            minWidth,
            Math.min(Math.max(measuredWidth, fallbackWidth), Math.max(minWidth, maxWidth))
        );
    }

    _getYAxisLabelWrapOptions(canvas, options = {}) {
        const chartWidth = canvas?.clientWidth || 420;
        const titleReserve = this.config?.chart?.categoryLabel
            ? Number(options.titleFontSize || 11) + 18
            : 0;
        const minWidth = Math.ceil(titleReserve + (options.isSmallScreen ? 42 : 54));
        const maxAxisWidth = this._getMaxYAxisWidth(chartWidth, options.isSmallScreen, minWidth);
        const maxPixelWidth = Math.max(54, maxAxisWidth - titleReserve - 22);

        return {
            dense: !!options.dense,
            maxPixelWidth,
            fontSize: Number(options.yTickSize || 11),
            forceFullLabels: true
        };
    }

    _highlightGlowPlugin() {
        return {
            id: 'contexto2HorizontalHighlightGlow',
            beforeDatasetsDraw: (chart) => {
                const dataset = chart.data.datasets[0];
                const meta = chart.getDatasetMeta(0);
                if (!Array.isArray(dataset.borderWidth)) return;

                const highlighted = meta.data
                    .map((bar, index) => ({ bar, index }))
                    .filter(({ index }) => Number(dataset.borderWidth[index]) > 1);
                if (!highlighted.length) return;

                const { ctx } = chart;
                ctx.save();
                ctx.shadowColor = 'rgba(0, 0, 0, 0.24)';
                ctx.shadowBlur = 10;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 2;
                highlighted.forEach(({ bar, index }) => {
                    ctx.fillStyle = dataset.backgroundColor[index];
                    const props = bar.getProps(['x', 'y', 'base', 'height'], true);
                    const x = Math.min(props.base, props.x);
                    const width = Math.abs(props.x - props.base);
                    const height = Math.max(8, props.height || 12);
                    this._roundedRect(ctx, x, props.y - height / 2, width, height, 5);
                    ctx.fill();
                });
                ctx.restore();
            }
        };
    }

    _getMaxYAxisWidth(chartWidth, isSmallScreen, minWidth = 80) {
        const reservedPlotWidth = isSmallScreen ? 130 : 190;
        const proportionalWidth = Math.floor(chartWidth * (isSmallScreen ? 0.44 : 0.38));
        const availableWidth = Math.max(minWidth, chartWidth - reservedPlotWidth);
        return Math.max(minWidth, Math.min(proportionalWidth, availableWidth));
    }

    _getYAxisTickSize(items, options = {}) {
        const base = options.veryDense
            ? 9
            : options.dense
                ? 10
                : options.isVerySmallScreen
                    ? 9
                    : options.isSmallScreen
                        ? 10
                        : 11;
        const maxLength = Math.max(0, ...(items || []).map(item => String(item.label || '').length));
        if (maxLength > 60) return Math.max(8, base - 2);
        if (maxLength > 38) return Math.max(8, base - 1);
        return base;
    }

    _measureMaxLabelWidth(ctx, labels, fontSize) {
        if (!ctx) {
            return Math.max(0, ...(labels || []).map(label => this._labelTextLength(label))) * fontSize * 0.54;
        }

        ctx.save();
        ctx.font = `400 ${fontSize}px Outfit, sans-serif`;
        const maxWidth = Math.max(0, ...(labels || []).map(label => {
            const lines = Array.isArray(label) ? label : [label];
            return Math.max(0, ...lines.map(line => ctx.measureText(String(line || '')).width));
        }));
        ctx.restore();
        return maxWidth;
    }

    _labelTextLength(label) {
        const lines = Array.isArray(label) ? label : [label];
        return Math.max(0, ...lines.map(line => String(line || '').length));
    }

    _drawHtmlBars(items, options = {}) {
        const canvas = document.getElementById('chart');
        const wrap = canvas?.closest('.chart-canvas-wrap');
        if (!wrap) return;

        this._clearHtmlBars();
        const maxValue = Math.max(...items.map(item => Number(item.total || 0)), 0);
        const list = document.createElement('div');
        list.className = 'chart-html-bars';
        list.addEventListener('dblclick', (event) => {
            if (event.target.closest('.chart-html-bar-row')) return;
            this._restoreAllowedCategories();
        });
        const activeValues = options.activeValues instanceof Set ? options.activeValues : null;
        const activeValueGetter = typeof options.activeValueGetter === 'function'
            ? options.activeValueGetter
            : (item) => item.value;
        const hasHighlight = !!activeValues?.size && !!options.highlightOnly;

        items.forEach(item => {
            const value = Number(item.total || 0);
            const percentWidth = maxValue > 0 ? Math.max(2, (value / maxValue) * 100) : 0;
            const active = !hasHighlight || activeValues.has(String(activeValueGetter(item)));
            const row = document.createElement('button');
            row.type = 'button';
            row.className = 'chart-html-bar-row';
            row.classList.toggle('is-active', hasHighlight && active);
            row.classList.toggle('is-dimmed', hasHighlight && !active);
            row.style.opacity = active ? '1' : '0.35';
            row.style.boxShadow = hasHighlight && active ? '0 8px 18px rgba(0,0,0,0.16)' : '';
            row.dataset.value = String(item.value ?? '');
            row.addEventListener('click', () => {
                this.eventBus.emit('selection:changed', {
                    source: 'chart',
                    layerId: this.config?.id,
                    field: this.config?.chart?.selectionField || this.config?.filter?.categoryField || this.config?.chart?.categoryField,
                    value: item.value,
                    values: [item.value],
                    label: item.label
                });
            });

            const label = document.createElement('span');
            label.className = 'chart-html-bar-label';
            label.textContent = item.label || String(item.value ?? '');

            const track = document.createElement('span');
            track.className = 'chart-html-bar-track';

            const fill = document.createElement('span');
            fill.className = 'chart-html-bar-fill';
            fill.style.width = `${percentWidth}%`;
            fill.style.background = item.color || '#999';
            fill.style.outline = hasHighlight && active ? '2px solid #1f2937' : '';

            const valueEl = document.createElement('span');
            valueEl.className = 'chart-html-bar-value';
            valueEl.textContent = this._formatValue(value);

            track.appendChild(fill);
            track.appendChild(valueEl);
            row.appendChild(label);
            row.appendChild(track);
            list.appendChild(row);
        });

        wrap.appendChild(list);
    }

    _clearHtmlBars() {
        document.querySelectorAll('.chart-html-bars').forEach(node => node.remove());
    }

    _withOpacity(color, opacity) {
        const value = String(color || '').trim();
        const safeOpacity = Math.max(0, Math.min(1, Number(opacity)));
        if (/^rgba?\(/i.test(value)) {
            const parts = value.match(/[\d.]+/g) || [];
            if (parts.length >= 3) return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${safeOpacity})`;
        }
        if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) {
            const hex = value.slice(1);
            const full = hex.length === 3
                ? hex.split('').map(char => char + char).join('')
                : hex;
            const num = Number.parseInt(full, 16);
            const r = (num >> 16) & 255;
            const g = (num >> 8) & 255;
            const b = num & 255;
            return `rgba(${r}, ${g}, ${b}, ${safeOpacity})`;
        }
        return value;
    }

    _formatCategoryLabel(label, options = {}) {
        const text = String(label || '');
        if (!this.config?.chart?.wrapCategoryLabels) return text;

        return this._wrapToLines(text, options);
    }

    _formatValue(value) {
        const numeric = Number(value || 0);
        if (this.config?.chart?.valueFormat === 'integer') {
            return String(Math.round(numeric));
        }
        const decimals = this._getPercentageDecimals(numeric);
        return `${numeric.toFixed(decimals)}%`;
    }

    _getPercentageDecimals(numeric) {
        if (numeric > 0 && numeric < 0.01) {
            for (let decimals = 3; decimals <= 8; decimals++) {
                if (Number(numeric.toFixed(decimals)) > 0) return decimals;
            }
            return 8;
        }
        if (numeric > 0 && numeric < 0.1) return 3;
        return 2;
    }

    _estimateMaxLabelLines(items, options = {}) {
        if (!this.config?.chart?.wrapCategoryLabels) return 1;
        return Math.max(1, ...(items || []).map(item => {
            const wrapped = this._wrapToLines(item.label, options);
            return Array.isArray(wrapped) ? wrapped.length : 1;
        }));
    }

    _wrapToLines(text, options = {}) {
        const normalized = String(text || '').replace(/\s+/g, ' ').trim();
        if (options.maxPixelWidth) {
            return this._wrapToMeasuredLines(normalized, options);
        }

        const maxLength = Number(this.config?.chart?.categoryLabelMaxLength || (options.dense ? 22 : 28));
        if (!normalized || normalized.length <= maxLength) return normalized;

        const words = normalized.split(' ');
        if (words.length < 2) return normalized;

        const lines = [];
        let current = '';
        words.forEach(word => {
            const next = current ? `${current} ${word}` : word;
            if (current && next.length > maxLength) {
                lines.push(current);
                current = word;
            } else {
                current = next;
            }
        });
        if (current) lines.push(current);

        const maxLines = options.forceFullLabels ? 0 : Number(this.config?.chart?.categoryLabelMaxLines || 0);
        if (maxLines > 0 && lines.length > maxLines) {
            const visible = lines.slice(0, maxLines - 1);
            visible.push(lines.slice(maxLines - 1).join(' '));
            return visible;
        }

        return lines;
    }

    _wrapToMeasuredLines(text, options = {}) {
        const normalized = String(text || '').replace(/\s+/g, ' ').trim();
        if (!normalized) return '';

        const maxPixelWidth = Number(options.maxPixelWidth || 0);
        if (!Number.isFinite(maxPixelWidth) || maxPixelWidth <= 0) return normalized;

        const measure = this._createTextMeasurer(options.fontSize || 11);
        if (measure(normalized) <= maxPixelWidth) return normalized;

        const words = normalized.split(' ');
        const lines = [];
        let current = '';

        words.forEach(word => {
            const next = current ? `${current} ${word}` : word;
            if (current && measure(next) > maxPixelWidth) {
                lines.push(current);
                current = this._splitLongWord(word, maxPixelWidth, measure, lines);
            } else if (!current && measure(word) > maxPixelWidth) {
                current = this._splitLongWord(word, maxPixelWidth, measure, lines);
            } else {
                current = next;
            }
        });

        if (current) lines.push(current);
        return lines.length === 1 ? lines[0] : lines;
    }

    _splitLongWord(word, maxPixelWidth, measure, lines) {
        if (measure(word) <= maxPixelWidth) return word;

        let current = '';
        String(word).split('').forEach(char => {
            const next = `${current}${char}`;
            if (current && measure(next) > maxPixelWidth) {
                lines.push(current);
                current = char;
            } else {
                current = next;
            }
        });
        return current;
    }

    _createTextMeasurer(fontSize) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return (value) => String(value || '').length * Number(fontSize || 11) * 0.54;

        ctx.font = `400 ${Number(fontSize || 11)}px Outfit, sans-serif`;
        return (value) => ctx.measureText(String(value || '')).width;
    }
}
