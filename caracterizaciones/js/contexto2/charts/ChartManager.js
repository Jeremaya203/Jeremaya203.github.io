import { SqlUtils } from '../utils/SqlUtils.js';

export class ChartManager {
    constructor(state, eventBus, registry, factory, lifecycle, queryService, renderers = {}, coloresServices = null) {
        this.state = state;
        this.eventBus = eventBus;
        this.registry = registry;
        this.factory = factory;
        this.lifecycle = lifecycle;
        this.queryService = queryService;
        this.renderers = renderers;
        this.coloresServices = coloresServices;
        this.currentRenderer = null;
        this.currentItems = [];
        this.currentSummaryGroups = [];
        this.currentSummaryConfig = null;
        this.requestId = 0;
        this.abortController = null;
        this.preparedCache = new Map();
        this.maxPreparedCacheEntries = 36;
        this.canvas = document.getElementById('chart');
        this.summaryEl = document.getElementById('summaryDiv-contexto');
        this.titleEl = document.getElementById('chartTitle');
    }

    init() {}

    async render() {
        const config = this.state.get('activeLayerConfig');
        this.clear();

        if (config?.summaryOnly && config?.summary?.enabled) {
            await this._renderSummaryOnly(config);
            return;
        }

        if (!config?.chart) {
            this._setMessage('La capa activa no tiene grafico configurado.');
            return;
        }

        const requestId = ++this.requestId;
        const abortController = new AbortController();
        this.abortController = abortController;
        const chartCfg = config.chart;
        const titleOnlyWithData = !!chartCfg.showTitleOnlyWithData;
        this._setTitle(titleOnlyWithData ? '' : this._buildChartTitle(config));
        this._setMessage(chartCfg.loadingMessage || 'Cargando información...');

        try {
            const where = SqlUtils.combine(this.state.get('whereBase') || '1=1', config.filter?.fixedWhere);
            const outFields = this._getChartOutFields(config);

            if (chartCfg.dataStrategy === 'grouped-counts' && chartCfg.statistic === 'count') {
                await this._renderGroupedCountChart(config, where, requestId, titleOnlyWithData);
                return;
            }

            const preparedKey = this._getPreparedCacheKey(config, where);
            const prepared = this._getPreparedCache(preparedKey);
            const features = prepared ? [] : await this._queryConfiguredFeatures(config, where, outFields, abortController.signal);
            if (requestId !== this.requestId) return;

            const summaryCountData = prepared
                ? null
                : (this._shouldUseSummaryCountMethod(config)
                    ? await this._buildSummaryCountDataFromFeatures(features, config, requestId, abortController.signal)
                    : null);
            if (requestId !== this.requestId) return;

            // Metodología anterior para gráficos de conteo:
            // const items = this._buildItems(features, config);
            // Esa ruta cuenta registros por categoría. La nueva ruta reutiliza
            // los grupos descriptivos para que barra y texto tengan el mismo total.
            const items = prepared?.items || summaryCountData?.items || this._buildItems(features, config);
            this.currentItems = items;
            this.eventBus.emit('chart:data-ready', { items, config });

            if (!items.length) {
                if (titleOnlyWithData) this._setTitle('');
                this._setMessage(chartCfg.noDataMessage || 'No hay información para la consulta seleccionada.');
                this._setPreparedCache(preparedKey, { items: [], summaryGroups: [] });
                return;
            }

            this._setTitle(this._buildChartTitle(config, features));
            this.currentRenderer = this.renderers[chartCfg.renderer] || this.renderers.HorizontalBarRenderer;
            this.currentRenderer?.render(items, config);
            this._setMessage('');
            if (prepared) {
                this.currentSummaryGroups = prepared.summaryGroups || [];
                this.currentSummaryConfig = config;
                this._paintSummaryGroups(this._filterSummaryGroups(this.currentSummaryGroups, this.state.get('activeSelection')), config);
                return;
            }
            if (summaryCountData) {
                this.currentSummaryGroups = summaryCountData.groups;
                this.currentSummaryConfig = config;
                this._paintSummaryGroups(this._filterSummaryGroups(summaryCountData.groups, this.state.get('activeSelection')), config);
                this._setPreparedCache(preparedKey, { items, summaryGroups: summaryCountData.groups });
                return;
            }
            await this._renderSummary(features, config, requestId, abortController.signal).catch(error => {
                if (requestId !== this.requestId) return;
                console.warn('[contexto2] ChartManager.summary:', error);
                this._setMessage('No fue posible consultar el detalle descriptivo.');
            });
            if (requestId === this.requestId && this.currentSummaryGroups.length) {
                this._setPreparedCache(preparedKey, { items, summaryGroups: this.currentSummaryGroups });
            }
        } catch (error) {
            if (requestId !== this.requestId) return;
            this.eventBus.emit('data:error', { source: 'ChartManager', error, context: { layerId: config.id } });
            if (titleOnlyWithData) this._setTitle('');
            this._setMessage('No fue posible generar el grafico para esta consulta.');
        }
    }

    setActive(selection) {
        this.currentRenderer?.setActive(selection);
        this._renderSummaryForSelection(selection);
    }

    clear(message = '') {
        this.abortController?.abort();
        this.abortController = null;
        this.requestId++;
        this.currentRenderer?.clear?.();
        this.currentRenderer = null;
        this.currentItems = [];
        this.currentSummaryGroups = [];
        this.currentSummaryConfig = null;
        this._resetChartSurface();
        this._setTitle('');
        this._setMessage(message);
    }

    showMessage(message) {
        this.clear();
        this._setMessage(message);
    }

    _resetChartSurface() {
        document.querySelectorAll('.chart-html-bars').forEach(node => node.remove());
        if (!this.canvas) return;

        this.lifecycle?.destroyCanvasChart?.(this.canvas);
        this.lifecycle?.clearCanvas?.(this.canvas);
        this.canvas.classList.remove('chart-canvas--dynamic');
        this.canvas.removeAttribute('width');
        this.canvas.removeAttribute('height');
        this.canvas.style.removeProperty('--chart-height');
        this.canvas.style.removeProperty('width');
        this.canvas.style.removeProperty('height');
        this.canvas.style.removeProperty('min-width');
        this.canvas.style.removeProperty('min-height');
        this.canvas.style.removeProperty('max-width');
        this.canvas.style.removeProperty('max-height');
        this.canvas.style.display = 'none';
    }

    _buildItems(features, config) {
        const chartCfg = config.chart;
        const categoryField = chartCfg.categoryField;
        const labelField = chartCfg.categoryLabelField || categoryField;
        const valueField = chartCfg.valueField;
        const useRawMunicipalPercentage = this._shouldUseRawMunicipalPercentage(chartCfg);
        const averageTerritoryPercentages = this._shouldAverageTerritoryPercentageChart(chartCfg);
        const legendItems = this.state.get('legendItems') || [];
        const legendByValue = new Map();
        const legendByLabel = new Map();

        legendItems.forEach(item => {
            legendByValue.set(String(item.value ?? item.code ?? item.label), item);
            legendByLabel.set(String(item.label ?? '').trim().toLowerCase(), item);
        });

        const groups = new Map();
        (features || []).forEach(feature => {
            const attrs = feature.attributes || {};
            const rawValue = this._resolveClassifiedValue(attrs, chartCfg.categoryClassifier, categoryField);
            if (rawValue == null || rawValue === '') return;

            const key = String(rawValue);
            const label = this._resolveClassifiedValue(attrs, chartCfg.categoryClassifier, labelField) || attrs[labelField] || key;
            const colorKey = chartCfg.colorValueField ? attrs[chartCfg.colorValueField] : rawValue;
            const rawAmount = chartCfg.statistic === 'count' ? 1 : attrs[valueField];
            if (chartCfg.statistic !== 'count' && (rawAmount == null || rawAmount === '')) return;

            const amount = chartCfg.statistic === 'count' ? 1 : Number(rawAmount);
            if (!Number.isFinite(amount) || amount < 0) return;
            if (amount === 0 && !this._isPercentageValueChart(chartCfg)) return;

            if (!groups.has(key)) {
                const legendItem = legendByValue.get(key) || legendByLabel.get(key.trim().toLowerCase());
                const domainName = chartCfg.colorDomain || config.map?.colorDomain;
                const colorInfo = this.coloresServices?.getColorInfo(domainName, colorKey ?? key);
                const fixedColor = chartCfg.fixedColor || config.map?.fillColor || null;
                groups.set(key, {
                    value: rawValue,
                    colorValue: colorKey,
                    label: legendItem?.label || (!chartCfg.colorValueField ? colorInfo?.label : null) || label,
                    total: 0,
                    color: fixedColor ||
                        (legendItem?.color && !this._isFallbackColor(legendItem.color)
                        ? legendItem.color
                        : (colorInfo?.fillColor || colorInfo?.lineColor || this._fallbackColor(groups.size))),
                    iconUrl: legendItem?.iconUrl || colorInfo?.iconUrl || null,
                    symbolType: legendItem?.symbolType || this._getSymbolType(domainName, colorInfo),
                    hatchStyle: legendItem?.hatchStyle || this._getHatchStyle(colorInfo),
                    outlineColor: legendItem?.outlineColor || colorInfo?.outlineColor,
                    hasRawMunicipalPercentage: false,
                    territoryTotals: new Map()
                });
            }
            const group = groups.get(key);
            if (useRawMunicipalPercentage) {
                if (!group.hasRawMunicipalPercentage) {
                    group.total = amount;
                    group.hasRawMunicipalPercentage = true;
                }
            } else if (chartCfg.statistic === 'value') {
                if (chartCfg.valueAggregation === 'first') {
                    if (!group.total) group.total = amount;
                } else {
                    group.total += amount;
                }
            } else {
                group.total += amount;
            }

            if (averageTerritoryPercentages) {
                const territoryCode = attrs[config.filter?.territoryField] || attrs.mpcodigo;
                if (territoryCode) {
                    const normalizedTerritoryCode = String(territoryCode);
                    group.territoryTotals.set(
                        normalizedTerritoryCode,
                        (group.territoryTotals.get(normalizedTerritoryCode) || 0) + amount
                    );
                }
            }
        });

        const items = [...groups.values()];
        const grandTotal = items.reduce((sum, item) => sum + Number(item.total || 0), 0);
        const percentageAverageDenominator = averageTerritoryPercentages
            ? this._getPercentageAverageDenominator()
            : 0;

        return this._sortChartItems(items
            .map(item => ({
                ...item,
                total: averageTerritoryPercentages && percentageAverageDenominator > 0
                    ? this._averageTerritoryPercentageTotal(item.territoryTotals, percentageAverageDenominator, item.total)
                    : this._normalizeChartTotal(item.total, chartCfg, grandTotal)
            })), chartCfg);
    }

    _isPercentageValueChart(chartCfg) {
        if (chartCfg?.valueField !== 'porcentaje') return false;
        if (chartCfg.valueFormat === 'integer' || chartCfg.statistic === 'count') return false;
        const percentageText = `${chartCfg.valueLabel || ''} ${chartCfg.title || ''}`.toLowerCase();
        return percentageText.includes('porcentaje') || percentageText.includes('percent');
    }

    _shouldUseRawMunicipalPercentage(chartCfg) {
        return this.state.get('filtroNivel') === 'MUNI' && this._isPercentageValueChart(chartCfg);
    }

    _shouldAverageTerritoryPercentageChart(chartCfg) {
        const filtroNivel = this.state.get('filtroNivel');
        const isDepartmentOrNational = filtroNivel === 'DEPTO' || !filtroNivel;
        if (!isDepartmentOrNational) return false;
        if (!this._isPercentageValueChart(chartCfg)) return false;
        if (chartCfg.valueDisplayMode === 'share-of-total') return false;
        if (chartCfg.valueAggregation === 'first') return false;
        return true;
    }

    _getPercentageAverageDenominator() {
        const todosMunicipios = this.state.get('todosMunicipios') || [];
        if (!Array.isArray(todosMunicipios)) return 0;

        if (this.state.get('filtroNivel') === 'DEPTO') {
            const deptoActual = this.state.get('deptoActual');
            if (!deptoActual) return 0;
            return todosMunicipios.filter(municipio => String(municipio.depto) === String(deptoActual)).length;
        }

        return todosMunicipios.length;
    }

    _averageTerritoryPercentageTotal(territoryTotals, averageDenominator, fallbackTotal = 0) {
        const denominator = Number(averageDenominator || 0);
        if (!(territoryTotals instanceof Map) || !Number.isFinite(denominator) || denominator <= 0) {
            return 0;
        }
        const total = [...territoryTotals.values()].reduce((sum, value) => {
            const numeric = Number(value || 0);
            if (!Number.isFinite(numeric) || numeric <= 0) return sum;
            return sum + Math.min(100, numeric);
        }, 0);
        const fallback = Number(fallbackTotal || 0);
        const numerator = total > 0 || !Number.isFinite(fallback) ? total : fallback;
        return Math.min(100, numerator / denominator);
    }

    _normalizeChartTotal(total, chartCfg, grandTotal) {
        const numeric = Number(total || 0);
        if (chartCfg.valueDisplayMode === 'share-of-total' && grandTotal > 0) {
            return (numeric / grandTotal) * 100;
        }
        if (chartCfg.valueFormat === 'integer' || chartCfg.statistic === 'count') {
            return Math.round(numeric);
        }
        return numeric;
    }

    _getChartOutFields(config) {
        const chartCfg = config.chart || {};
        const summaryCfg = config.summary || {};
        const nationalNamesOnly = this._isNationalNamesOnlySummary();
        const fields = [
            chartCfg.categoryField,
            chartCfg.categoryLabelField,
            chartCfg.colorValueField,
            ...(chartCfg.statistic === 'count' ? [] : [chartCfg.valueField]),
            config.filter?.categoryField,
            summaryCfg.groupField,
            summaryCfg.groupLabelField,
            summaryCfg.itemLabelField,
            ...(nationalNamesOnly ? [] : [summaryCfg.relation?.sourceKeyField]),
            ...(!nationalNamesOnly && !summaryCfg.relation ? [
                summaryCfg.normativeField,
                summaryCfg.analysisField
            ] : []),
            ...(this._shouldAverageTerritoryPercentageChart(chartCfg) ? [config.filter?.territoryField] : []),
            ...(config.mode === 'AMBIENTALES' ? [] : (config.outFields || []))
        ];
        return [...new Set(fields.filter(Boolean))];
    }

    _getPreparedCacheKey(config, where) {
        if (config?.mode !== 'AMBIENTALES') return '';
        return [
            config.id,
            this.state.get('filtroNivel') || 'NACIONAL',
            where || '1=1'
        ].join('::');
    }

    _getPreparedCache(key) {
        if (!key || !this.preparedCache.has(key)) return null;
        const value = this.preparedCache.get(key);
        this.preparedCache.delete(key);
        this.preparedCache.set(key, value);
        return value;
    }

    _setPreparedCache(key, value) {
        if (!key) return;
        this.preparedCache.set(key, value);
        while (this.preparedCache.size > this.maxPreparedCacheEntries) {
            this.preparedCache.delete(this.preparedCache.keys().next().value);
        }
    }

    async _queryConfiguredFeatures(config, where, outFields, signal = null) {
        const sources = Array.isArray(config?.sources) && config.sources.length
            ? config.sources
            : [{ url: config.url }];
        const options = config?.mode === 'AMBIENTALES'
            ? { parallelPaging: true, maxParallelPages: 3, signal }
            : {};
        const results = await Promise.all(sources.map(source =>
            this.queryService.queryFeatures(source.url, where, outFields, options)
        ));
        return results.flat();
    }

    async _renderGroupedCountChart(config, where, requestId, titleOnlyWithData) {
        // Metodología anterior:
        // const items = await this._queryGroupedCountItems(config, where);
        // Esta consulta agrupaba registros en ArcGIS. Se conserva disponible en
        // _queryGroupedCountItems para revertir si se requiere.
        const summaryCountData = this._shouldUseSummaryCountMethod(config)
            ? await this._querySummaryCountItems(config, where, requestId)
            : null;
        const items = summaryCountData?.items || await this._queryGroupedCountItems(config, where);
        if (requestId !== this.requestId) return;

        this.currentItems = items;
        this.eventBus.emit('chart:data-ready', { items, config });

        if (!items.length) {
            if (titleOnlyWithData) this._setTitle('');
            this._setMessage(config.chart?.noDataMessage || 'No hay información para la consulta seleccionada.');
            return;
        }

        this._setTitle(this._buildChartTitle(config, []));
        this.currentRenderer = this.renderers[config.chart.renderer] || this.renderers.HorizontalBarRenderer;
        this.currentRenderer?.render(items, config);
        this._setMessage('');
        if (summaryCountData) {
            this.currentSummaryGroups = summaryCountData.groups;
            this.currentSummaryConfig = config;
            this._paintSummaryGroups(this._filterSummaryGroups(summaryCountData.groups, this.state.get('activeSelection')), config);
            return;
        }
        this._renderGroupedCountSummary(config, where, requestId).catch(error => {
            if (requestId !== this.requestId) return;
            console.warn('[contexto2] ChartManager.summary:', error);
            this._setMessage('No fue posible consultar el detalle descriptivo.');
        });
    }

    async _queryGroupedCountItems(config, where) {
        const chartCfg = config.chart || {};
        const groupField = chartCfg.categoryField || config.filter?.categoryField;
        const sources = Array.isArray(config?.sources) && config.sources.length
            ? config.sources
            : [{ url: config.url }];
        // Metodología anterior de conteo de barras:
        // queryGroupedCountsMany usa estadísticas del servicio y suma registros
        // por categoría. La ruta principal nueva usa los grupos del resumen para
        // que el total del gráfico coincida con el texto descriptivo.
        const grouped = await this.queryService.queryGroupedCountsMany(sources, where, groupField);
        const totals = new Map();

        grouped.forEach(({ counts }) => {
            (counts || new Map()).forEach((count, value) => {
                const key = String(value);
                totals.set(key, (totals.get(key) || 0) + Number(count || 0));
            });
        });

        const domainName = chartCfg.colorDomain || config.map?.colorDomain;
        return this._sortChartItems([...totals.entries()]
            .filter(([, total]) => Number(total) > 0)
            .map(([key, total], index) => {
                const colorInfo = this.coloresServices?.getColorInfo(domainName, key);
                return {
                    value: key,
                    colorValue: key,
                    label: colorInfo?.label || key,
                    total: Math.round(Number(total || 0)),
                    color: colorInfo?.fillColor || colorInfo?.lineColor || this._fallbackColor(index),
                    iconUrl: colorInfo?.iconUrl || null,
                    symbolType: this._getSymbolType(domainName, colorInfo),
                    hatchStyle: this._getHatchStyle(colorInfo),
                    outlineColor: colorInfo?.outlineColor,
                    hasRawMunicipalPercentage: false,
                    territoryTotals: new Map()
                };
            }), chartCfg);
    }

    _shouldUseSummaryCountMethod(config) {
        return config?.chart?.statistic === 'count' &&
            config?.summary?.enabled &&
            !!config.summary.groupField &&
            !!config.summary.itemLabelField;
    }

    async _querySummaryCountItems(config, where, requestId) {
        const features = await this._querySummaryFeatures(config, where);
        if (requestId !== this.requestId) return null;
        return this._buildSummaryCountDataFromFeatures(features, config, requestId);
    }

    async _buildSummaryCountDataFromFeatures(features, config, requestId, signal = null) {
        const summaryCfg = config.summary || {};
        const relatedByKey = this._isNationalNamesOnlySummary()
            ? new Map()
            : await this._loadSummaryRelations(features, summaryCfg, signal);
        if (requestId !== this.requestId) return null;
        const groups = this._buildSummaryGroups(features, config, relatedByKey);
        return {
            groups,
            items: this._summaryGroupsToChartItems(groups, config)
        };
    }

    async _querySummaryFeatures(config, where) {
        const summaryCfg = config.summary || {};
        const outFields = this._getSummaryOutFields(config);
        const sources = Array.isArray(config?.sources) && config.sources.length
            ? config.sources
            : [{ url: summaryCfg.dataUrl || config.dataUrl || config.url }];
        const options = summaryCfg.distinct
            ? { returnDistinctValues: 'true' }
            : {};
        const results = await Promise.all(sources.map(source =>
            this.queryService.queryFeatures(summaryCfg.dataUrl || source.url, where, outFields, options)
        ));
        return results.flat();
    }

    _getSummaryOutFields(config) {
        const summaryCfg = config.summary || {};
        const nationalNamesOnly = this._isNationalNamesOnlySummary();
        return [...new Set([
            summaryCfg.groupField,
            summaryCfg.groupLabelField,
            summaryCfg.itemLabelField,
            ...(nationalNamesOnly ? [] : [summaryCfg.relation?.sourceKeyField]),
            ...(!nationalNamesOnly && !summaryCfg.relation ? [
                summaryCfg.normativeField,
                summaryCfg.analysisField
            ] : []),
            ...(config.mode === 'AMBIENTALES' ? [] : [
                config.filter?.territoryField,
                config.filter?.departmentField
            ]),
            ...(config.mode === 'AMBIENTALES' ? [] : (config.outFields || []))
        ].filter(Boolean))];
    }

    _summaryGroupsToChartItems(groups, config) {
        const chartCfg = config.chart || {};
        const domainName = chartCfg.colorDomain || config.summary?.groupColorDomain || config.map?.colorDomain;
        return this._sortChartItems((groups || [])
            .map((group, index) => {
                const key = String(group.value);
                const colorInfo = this.coloresServices?.getColorInfo(domainName, key);
                return {
                    value: key,
                    colorValue: key,
                    label: colorInfo?.label || group.label || key,
                    total: group.items?.length || 0,
                    color: colorInfo?.fillColor || colorInfo?.lineColor || this._fallbackColor(index),
                    iconUrl: colorInfo?.iconUrl || null,
                    symbolType: this._getSymbolType(domainName, colorInfo),
                    hatchStyle: this._getHatchStyle(colorInfo),
                    outlineColor: colorInfo?.outlineColor,
                    hasRawMunicipalPercentage: false,
                    territoryTotals: new Map()
                };
            })
            .filter(item => Number(item.total) > 0), chartCfg);
    }

    _sortChartItems(items, chartCfg = {}) {
        const order = Array.isArray(chartCfg.categoryOrder)
            ? chartCfg.categoryOrder.map(value => String(value))
            : [];
        if (order.length) {
            const orderMap = new Map(order.map((value, index) => [value, index]));
            return [...(items || [])].sort((a, b) => {
                const aOrder = orderMap.has(String(a.value)) ? orderMap.get(String(a.value)) : Number.MAX_SAFE_INTEGER;
                const bOrder = orderMap.has(String(b.value)) ? orderMap.get(String(b.value)) : Number.MAX_SAFE_INTEGER;
                return aOrder - bOrder || a.label.localeCompare(b.label, 'es');
            });
        }
        return [...(items || [])].sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, 'es'));
    }

    async _renderGroupedCountSummary(config, where, requestId) {
        const summaryCfg = config.summary || {};
        if (!summaryCfg.enabled) return;

        const features = await this._querySummaryFeatures(config, where);
        if (requestId !== this.requestId) return;
        await this._renderSummary(features, config, requestId);
    }

    async _renderSummaryOnly(config) {
        const requestId = ++this.requestId;
        const summaryCfg = config.summary || {};
        this._setTitle('');
        this._setMessage('Cargando información...');

        try {
            const where = SqlUtils.combine(
                this.state.get('whereBase') || '1=1',
                summaryCfg.fixedWhere
            );
            const outFields = [...new Set([
                summaryCfg.groupField,
                summaryCfg.groupLabelField,
                summaryCfg.itemLabelField,
                summaryCfg.relation?.sourceKeyField,
                ...(!summaryCfg.relation ? [
                    summaryCfg.normativeField,
                    summaryCfg.analysisField
                ] : []),
                ...(config.outFields || [])
            ].filter(Boolean))];
            const url = summaryCfg.dataUrl || config.dataUrl || config.url;
            const features = await this.queryService.queryFeatures(url, where, outFields);
            if (requestId !== this.requestId) return;

            if (!features?.length) {
                this._setMessage('No hay información descriptiva para la consulta seleccionada.');
                return;
            }

            await this._renderSummary(features, config, requestId);
        } catch (error) {
            if (requestId !== this.requestId) return;
            this.eventBus.emit('data:error', { source: 'ChartManager.summaryOnly', error, context: { layerId: config.id } });
            this._setMessage('No fue posible consultar el detalle descriptivo.');
        }
    }

    _fallbackColor(index) {
        const palette = ['#43aa8b', '#277da1', '#f8961e', '#f94144', '#90be6d', '#f3722c', '#f9c74f', '#577590'];
        return palette[index % palette.length];
    }

    _isFallbackColor(color) {
        const normalized = String(color || '').replace(/\s+/g, '').toLowerCase();
        return normalized === '#999' ||
            normalized === '#999999' ||
            normalized === 'rgb(153,153,153)' ||
            normalized === 'rgba(153,153,153,1)';
    }

    _getSymbolType(domainName, colorInfo = null) {
        const domain = this.coloresServices?.getDomain(domainName);
        const geometry = String(domain?.geometryType || '').toLowerCase();
        if (geometry.includes('line') || colorInfo?.lineColor) return 'line';
        if (geometry.includes('point') || colorInfo?.symbol?.type === 'point' || colorInfo?.symbol?.type === 'icon') return 'point';
        return 'polygon';
    }

    _getHatchStyle(colorInfo) {
        const type = String(colorInfo?.hatch?.type || '').toLowerCase();
        if (type.includes('dash') || type.includes('line') || type.includes('hatch')) {
            return 'forward-diagonal';
        }
        return null;
    }

    _setMessage(message) {
        if (!this.summaryEl) return;
        if (!message) {
            this.summaryEl.innerHTML = '';
            this.summaryEl.style.display = 'none';
            return;
        }
        this.summaryEl.style.display = 'block';
        this.summaryEl.innerHTML = `<p class="oot-js-contexto-chart-1">${this._escapeHtml(message)}</p>`;
    }

    _setTitle(title) {
        if (!this.titleEl) return;
        const text = String(title || '').trim();
        this.titleEl.textContent = text;
        this.titleEl.style.display = text ? '' : 'none';
    }

    _buildChartTitle(config, features = []) {
        const chartCfg = config.chart || {};
        const baseTitle = chartCfg.titleBase || chartCfg.title || config.title || 'Gráfico';
        if (!chartCfg.includeTerritoryInTitle) return baseTitle;

        const territoryLabel = this._getTerritoryTitleSuffix(features);
        return territoryLabel ? `${baseTitle} en ${territoryLabel}` : baseTitle;
    }

    _getTerritoryTitleSuffix(features = []) {
        const nivel = this.state.get('filtroNivel');
        const attrs = (features || []).find(feature => feature?.attributes)?.attributes || {};

        if (nivel === 'MUNI') {
            const municipio = this._normalizeTerritoryLabel(
                this._formatSummaryText(attrs.mpnombre) || this._getSelectedOptionText('municipios'),
                attrs.mpcodigo || this.state.get('municipioActual'),
                'MUNI'
            );
            const depto = this._normalizeTerritoryLabel(
                this._formatSummaryText(attrs.dpnombre) || this._getSelectedOptionText('departamentos'),
                attrs.dpcodigo || this.state.get('deptoActual'),
                'DEPTO'
            );
            if (this._isSameTerritoryLabel(municipio, depto)) return municipio;
            return [municipio, depto].filter(Boolean).join(', ');
        }

        if (nivel === 'DEPTO') {
            return this._normalizeTerritoryLabel(
                this._formatSummaryText(attrs.dpnombre) || this._getSelectedOptionText('departamentos'),
                attrs.dpcodigo || this.state.get('deptoActual'),
                'DEPTO'
            );
        }

        return '';
    }

    _getSelectedOptionText(selectId) {
        const select = document.getElementById(selectId);
        const text = select?.selectedOptions?.[0]?.textContent;
        const normalized = this._formatSummaryText(text);
        if (!normalized || normalized.toLowerCase().startsWith('seleccione')) return '';
        return normalized === 'Colombia' ? '' : normalized;
    }

    _normalizeTerritoryLabel(label, code, level) {
        const normalized = this._formatSummaryText(label);
        const normalizedCode = this._formatSummaryText(code);
        if (level === 'DEPTO' && (normalizedCode === '11' || normalized === '11')) {
            return 'Bogotá';
        }
        if (level === 'MUNI' && (normalizedCode === '11001' || normalized === '11001')) {
            return 'Bogotá';
        }
        return normalized;
    }

    _isSameTerritoryLabel(first, second) {
        const normalize = (value) => this._formatSummaryText(value)
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/,\s*d\.?c\.?$/i, '')
            .trim();
        const a = normalize(first);
        const b = normalize(second);
        return !!a && !!b && a === b;
    }

    async _renderSummary(features, config, requestId, signal = null) {
        const summaryCfg = config.summary;
        if (!this.summaryEl || !summaryCfg?.enabled) {
            this._setMessage('');
            return;
        }

        this._setMessage('Consultando detalle...');
        const relatedByKey = this._isNationalNamesOnlySummary()
            ? new Map()
            : await this._loadSummaryRelations(features, summaryCfg, signal);
        if (requestId !== this.requestId) return;

        const groups = this._buildSummaryGroups(features, config, relatedByKey);
        if (!groups.length) {
            this._setMessage('No hay informacion descriptiva para la consulta seleccionada.');
            return;
        }

        this.currentSummaryGroups = groups;
        this.currentSummaryConfig = config;
        this._paintSummaryGroups(this._filterSummaryGroups(groups, this.state.get('activeSelection')), config);
    }

    _renderSummaryForSelection(selection) {
        if (!this.currentSummaryConfig?.summary?.enabled || !this.currentSummaryGroups.length) return;
        this._paintSummaryGroups(this._filterSummaryGroups(this.currentSummaryGroups, selection), this.currentSummaryConfig);
    }

    _filterSummaryGroups(groups, selection) {
        const values = selection?.values || (selection?.value != null ? [selection.value] : null);
        if (!values) return groups;
        const summaryField = this.currentSummaryConfig?.summary?.groupField;
        if (selection?.field && summaryField && selection.field !== summaryField) return groups;

        const activeValues = new Set(values.map(value => String(value)));
        if (!activeValues.size) return [];

        return (groups || []).filter(group => activeValues.has(String(group.value)));
    }

    _paintSummaryGroups(groups, config) {
        if (!this.summaryEl) return;
        const summaryCfg = config.summary || {};
        const nationalNamesOnly = this._isNationalNamesOnlySummary();
        const itemSummaryCfg = nationalNamesOnly
            ? { ...summaryCfg, displayMode: 'names-only' }
            : summaryCfg;

        if (!groups.length) {
            this.summaryEl.innerHTML = '';
            this.summaryEl.style.display = 'none';
            return;
        }

        const title = summaryCfg.title
            ? `<h4 class="oot-js-contexto-chart-2">${this._escapeHtml(summaryCfg.title)}</h4>`
            : '';

        const content = groups.map(group => {
            const rows = group.items.map((item, index) => this._renderSummaryItem(item, itemSummaryCfg, index, group.items.length)).join('');
            const count = nationalNamesOnly
                ? ''
                : ` <span class="oot-js-contexto-chart-3">(${group.items.length})</span>`;

            return `
                <details class="oot-js-contexto-chart-4">
                    <summary class="oot-js-contexto-chart-5">
                        ${this._escapeHtml(group.label)}${count}
                    </summary>
                    <ul class="oot-js-contexto-chart-6">
                        ${rows}
                    </ul>
                </details>
            `;
        }).join('');

        this.summaryEl.style.display = 'block';
        this.summaryEl.innerHTML = `<div class="oot-js-contexto-chart-7">${title}${content}</div>`;
    }

    _isNationalNamesOnlySummary() {
        return !String(this.state.get('filtroNivel') || '').trim();
    }

    _renderSummaryItem(item, summaryCfg, index = 0, total = 1) {
        if (summaryCfg.displayMode === 'names-only') {
            return `
                <li class="oot-js-contexto-chart-8">
                    <strong class="oot-js-contexto-chart-9">${this._escapeHtml(item.name)}</strong>
                </li>
            `;
        }

        if (summaryCfg.displayMode === 'name-with-act') {
            const name = summaryCfg.hideItemName
                ? ''
                : `<strong class="oot-js-contexto-chart-10">${this._escapeHtml(item.name)}</strong>`;
            return `
                <li class="oot-js-contexto-chart-11">
                    ${name}
                    <div class="oot-js-contexto-chart-12"><b>Acto administrativo:</b> ${this._escapeHtml(item.normative)}</div>
                </li>
            `;
        }

        if (summaryCfg.displayMode === 'name-with-description') {
            const name = summaryCfg.hideItemName
                ? ''
                : `<strong class="oot-js-contexto-chart-10">${this._escapeHtml(item.name)}</strong>`;
            return `
                <li class="oot-js-contexto-chart-11">
                    ${name}
                    <div class="oot-js-contexto-chart-12"><b>Descripción:</b> ${this._escapeHtml(item.normative)}</div>
                </li>
            `;
        }

        if (summaryCfg.displayMode === 'name-with-act-description') {
            return `
                <li class="oot-js-contexto-chart-11">
                    <strong class="oot-js-contexto-chart-10">${this._escapeHtml(item.name)}</strong>
                    <div class="oot-js-contexto-chart-12"><b>Acto administrativo:</b> ${this._escapeHtml(item.normative)}</div>
                    <div><b>Descripción:</b> ${this._escapeHtml(item.analysis)}</div>
                </li>
            `;
        }

        if (summaryCfg.displayMode === 'name-with-analysis') {
            const name = summaryCfg.hideItemName
                ? ''
                : `<strong class="oot-js-contexto-chart-10">${this._escapeHtml(item.name)}</strong>`;
            const analysisTitle = total > 1
                ? `<strong class="oot-js-contexto-chart-13">Análisis temático ${index + 1} de ${total}</strong>`
                : `<strong class="oot-js-contexto-chart-13">Análisis temático</strong>`;
            return `
                <li class="oot-js-contexto-chart-11">
                    ${name}
                    ${analysisTitle}
                    <div>${this._escapeHtml(item.analysis)}</div>
                </li>
            `;
        }

        if (summaryCfg.displayMode === 'name-with-act-analysis') {
            const analysisTitle = total > 1
                ? `<strong class="oot-js-contexto-chart-13">Análisis temático ${index + 1} de ${total}</strong>`
                : `<strong class="oot-js-contexto-chart-13">Análisis temático</strong>`;
            return `
                <li class="oot-js-contexto-chart-11">
                    <strong class="oot-js-contexto-chart-10">${this._escapeHtml(item.name)}</strong>
                    <div class="oot-js-contexto-chart-12"><b>Acto administrativo:</b> ${this._escapeHtml(item.normative)}</div>
                    ${analysisTitle}
                    <div>${this._escapeHtml(item.analysis)}</div>
                </li>
            `;
        }

        return `
            <li class="oot-js-contexto-chart-11">
                <strong class="oot-js-contexto-chart-10">${this._escapeHtml(item.name)}</strong>
                <div class="oot-js-contexto-chart-12"><b>Descripción normativa:</b> ${this._escapeHtml(item.normative)}</div>
                <div><b>Análisis temático:</b> ${this._escapeHtml(item.analysis)}</div>
            </li>
        `;
    }

    async _loadSummaryRelations(features, summaryCfg, signal = null) {
        const relation = summaryCfg?.relation;
        if (!relation?.url || !relation.sourceKeyField || !relation.targetKeyField) return new Map();

        const keys = [...new Set((features || [])
            .map(feature => this._formatSummaryText(feature.attributes?.[relation.sourceKeyField]))
            .filter(Boolean))];
        if (!keys.length) return new Map();

        const batchSize = Number(relation.batchSize) > 0 ? Number(relation.batchSize) : 80;
        const relationFields = relation.outFields?.length
            ? relation.outFields
            : [summaryCfg.normativeField, summaryCfg.analysisField];
        const outFields = [...new Set([
            relation.targetKeyField,
            ...relationFields
        ].filter(Boolean))];
        const relatedByKey = new Map();
        const batches = [];

        for (let index = 0; index < keys.length; index += batchSize) {
            batches.push(keys.slice(index, index + batchSize));
        }

        const results = await this._mapWithConcurrency(batches, 3, async (batch) => {
            const where = SqlUtils.buildInClause(relation.targetKeyField, batch, relation.targetKeyType || 'string');
            return this.queryService.queryFeatures(relation.url, where, outFields, signal ? { signal } : {});
        });
        results.forEach(relatedFeatures => {
            (relatedFeatures || []).forEach(feature => {
                const attrs = feature.attributes || {};
                const key = this._formatSummaryText(attrs[relation.targetKeyField]);
                if (key) relatedByKey.set(key, attrs);
            });
        });

        return relatedByKey;
    }

    async _mapWithConcurrency(items, limit, mapper) {
        const results = new Array(items.length);
        let nextIndex = 0;
        const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
            while (nextIndex < items.length) {
                const index = nextIndex++;
                results[index] = await mapper(items[index], index);
            }
        });
        await Promise.all(workers);
        return results;
    }

    _buildSummaryGroups(features, config, relatedByKey = new Map()) {
        const summaryCfg = config.summary || {};
        const groupField = summaryCfg.groupField;
        const itemLabelField = summaryCfg.itemLabelField;
        if (!groupField || !itemLabelField) return [];

        const groups = new Map();
        (features || []).forEach(feature => {
            const attrs = feature.attributes || {};
            const rawGroup = this._resolveClassifiedValue(attrs, summaryCfg.groupClassifier, groupField);
            const itemName = this._formatSummaryText(attrs[itemLabelField]);
            if (rawGroup == null || rawGroup === '' || !itemName) return;

            const key = String(rawGroup);
            const relation = summaryCfg.relation || {};
            const relatedKey = this._formatSummaryText(attrs[relation.sourceKeyField]);
            const relatedAttrs = relatedByKey.get(relatedKey) || {};
            if (!groups.has(key)) {
                const colorInfo = this.coloresServices?.getColorInfo(summaryCfg.groupColorDomain, key);
                const fieldLabel = this._formatSummaryText(attrs[summaryCfg.groupLabelField]);
                const label = colorInfo?.label ||
                    fieldLabel ||
                    key;
                groups.set(key, {
                    value: rawGroup,
                    label,
                    itemsByKey: new Map()
                });
            }

            const normative = this._formatSummaryText(relatedAttrs[summaryCfg.normativeField]) ||
                this._formatSummaryText(attrs[summaryCfg.normativeField]) ||
                summaryCfg.emptyNormativeText ||
                'No registra descripción normativa.';
            const analysis = this._formatSummaryText(relatedAttrs[summaryCfg.analysisField]) ||
                this._formatSummaryText(attrs[summaryCfg.analysisField]) ||
                summaryCfg.emptyAnalysisText ||
                'No registra análisis temático.';
            const itemKey = relatedKey || `${itemName}|${normative}|${analysis}`;
            groups.get(key).itemsByKey.set(itemKey, {
                name: itemName,
                normative,
                analysis
            });
        });

        return [...groups.values()]
            .map(group => ({
                ...group,
                items: [...group.itemsByKey.values()]
                    .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }))
            }))
            .filter(group => group.items.length)
            .sort((a, b) => a.label.localeCompare(b.label, 'es', { sensitivity: 'base' }));
    }

    _formatSummaryText(value) {
        if (value == null) return '';
        return String(value).replace(/\s+/g, ' ').trim();
    }

    _resolveClassifiedValue(attrs, classifier, fallbackField) {
        if (classifier === 'puertosAeropuertos') {
            const name = String(attrs.nomdet ?? attrs.NomDet ?? '').toUpperCase();
            return name.includes('AEROPUERTO') ? 'Aeropuertos' : 'Puertos';
        }
        return attrs?.[fallbackField];
    }

    _escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
}
