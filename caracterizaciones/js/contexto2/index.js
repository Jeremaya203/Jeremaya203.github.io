import { State } from './core/State.js';
import { EventBus } from './core/EventBus.js';
import { LayerConfig } from './config/LayerConfig.js?v=infra-point-summary-20260716';
import { ModeConfig } from './config/ModeConfig.js';
import { DictionaryService } from './services/DictionaryService.js';
import { ArcGISQueryService } from './services/ArcGISQueryService.js?v=ambiental-performance-v9-20260716';
import { TerritorialCatalogService } from './services/TerritorialCatalogService.js';
import { ColoresServices } from './services/coloresServices.js';
import { TerritorySelector } from './ui/TerritorySelector.js';
import { MunicipalitySelector } from './ui/MunicipalitySelector.js';
import { SearchControls } from './ui/SearchControls.js?v=context-search-controls-20260716';
import { MapInitializer } from './map/MapInitializer.js';
import { MapControls } from './map/MapControls.js';
import { MapClickHandler } from './map/MapClickHandler.js';
import { LayerFactory } from './map/LayerFactory.js';
import { LayerManager } from './map/LayerManager.js?v=ambiental-performance-v2-20260716';
import { LayerFilter } from './map/LayerFilter.js?v=ambiental-performance-v4-20260716';
import { OverviewMap } from './overview/OverviewMap.js';
import { OverviewDragHandler } from './overview/OverviewDragHandler.js';
import { DropdownManager } from './ui/DropdownManager.js';
import { DescargablesDropdown } from './ui/DescargablesDropdown.js';
import { SubtabManager } from './ui/SubtabManager.js?v=ambiental-performance-v5-20260716';
import { MapViewBadge } from './map/MapViewBadge.js';
import { LegendDataExtractor } from './legend/LegendDataExtractor.js';
import { LegendRenderer } from './legend/LegendRenderer.js';
import { ChartRegistry } from './charts/ChartRegistry.js';
import { ChartFactory } from './charts/ChartFactory.js';
import { ChartLifecycle } from './charts/ChartLifecycle.js';
import { ChartManager } from './charts/ChartManager.js?v=ambiental-performance-v10-20260716';
import { HorizontalBarRenderer } from './charts/renderers/HorizontalBarRenderer.js?v=national-ambiental-height-20260716';
import { SqlUtils } from './utils/SqlUtils.js';

const state = new State();
const eventBus = new EventBus();
const layerConfig = new LayerConfig();
const modeConfig = new ModeConfig();
const dictService = new DictionaryService();
const queryService = new ArcGISQueryService();
const territorialCatalogService = new TerritorialCatalogService(queryService, dictService, layerConfig);
const coloresServices = new ColoresServices();
const chartRegistry = new ChartRegistry();
const chartFactory = new ChartFactory();
const chartLifecycle = new ChartLifecycle();

const territorySelector = new TerritorySelector(state, eventBus, dictService);
const municipalitySelector = new MunicipalitySelector(state, eventBus, dictService, territorialCatalogService);
const searchControls = new SearchControls(state, eventBus);
const mapInitializer = new MapInitializer(state, eventBus);
const mapControls = new MapControls(state, eventBus);
const mapClickHandler = new MapClickHandler(state, eventBus);
const layerFactory = new LayerFactory(layerConfig, coloresServices);
const layerManager = new LayerManager(state, eventBus, layerConfig, layerFactory);
const layerFilter = new LayerFilter(state, eventBus);
const overviewMap = new OverviewMap(state, eventBus);
const overviewDragHandler = new OverviewDragHandler(state, eventBus, overviewMap);
const dropdownManager = new DropdownManager(state, eventBus);
const descargablesDropdown = new DescargablesDropdown();
const subtabManager = new SubtabManager(state, eventBus, layerConfig, queryService);
const mapViewBadge = new MapViewBadge(state, eventBus, modeConfig);
const legendExtractor = new LegendDataExtractor(coloresServices);
const legendRenderer = new LegendRenderer(state, eventBus);
const horizontalBarRenderer = new HorizontalBarRenderer(chartFactory, chartLifecycle, eventBus, state);
const chartManager = new ChartManager(state, eventBus, chartRegistry, chartFactory, chartLifecycle, queryService, {
    HorizontalBarRenderer: horizontalBarRenderer
}, coloresServices);
let territoryZoomRequestId = 0;
let layerReloadRequestId = 0;

function clearResidues(message = 'Cargando informacion...') {
    layerFilter.clearViewFilter();
    state.set('activeSelection', null);
    state.set('activeFilter', '');
    state.set('legendItems', []);
    chartManager.clear(message);
    legendRenderer.clear(message);
    if (state.view?.popup) state.view.popup.close();
}

async function reloadActiveLayer(message) {
    const requestId = ++layerReloadRequestId;
    clearResidues(message);
    const config = getActiveConfig();
    if (!config) {
        layerManager.clear();
        chartManager.showMessage(layerConfig.getEmptyMessage(state.get('currentMode')));
        legendRenderer.clear('Sin clases activas');
        return;
    }

    if (isFactoresDeterminantesConfig(config)) {
        await reloadFactoresDeterminantesLayer(config, requestId);
        return;
    }

    if (config.mode === 'AMBIENTALES') {
        await reloadAmbientalLayer(config, requestId);
        return;
    }

    await layerManager.load({ requestId });
}

async function reloadAmbientalLayer(config, requestId) {
    const where = SqlUtils.combine(state.get('whereBase') || '1=1', config.filter?.fixedWhere);
    state.set('activeLayerConfig', config);
    state.set('activeFilter', where);

    await chartManager.render();
    if (requestId !== layerReloadRequestId) return;
    await layerManager.load({ skipChart: true, requestId });
}

async function reloadFactoresDeterminantesLayer(config, requestId) {
    const where = SqlUtils.combine(state.get('whereBase') || '1=1', config.filter?.fixedWhere);
    state.set('activeLayerConfig', config);
    state.set('activeFilter', where);

    const zoomPromise = zoomToQueryExtent(config, where);
    const layerPromise = layerManager.load({ skipZoom: true, skipChart: true, requestId });
    const chartPromise = chartManager.render();

    const [zoomResult] = await Promise.allSettled([zoomPromise, chartPromise, layerPromise]);
    if (zoomResult.status !== 'fulfilled' || !zoomResult.value) {
        await layerManager.zoomToLayers(state.get('layersGlobal') || state.layersGlobal || [], where);
    }
}

function isFactoresDeterminantesConfig(config) {
    return config?.groupId === 'factores_determinantes';
}

async function zoomToQueryExtent(config, where) {
    const view = state.view;
    if (!view || !where || where === '1=0') return;

    const requestId = ++territoryZoomRequestId;
    const whereBase = state.get('whereBase') || '1=1';
    const territoryUrl = layerConfig.getLayerUrl?.();

    if (territoryUrl) {
        const zoomed = await zoomToFeatureLayerExtent(territoryUrl, whereBase, requestId);
        if (zoomed) return true;
    }

    const sources = getZoomSources(config, where, whereBase);

    for (const source of sources) {
        try {
            const data = await queryService.queryExtent(source.url, source.where);
            if (requestId !== territoryZoomRequestId) return;
            const extent = await buildGoToExtent(data?.extent, 1.15);
            if (extent) {
                await view.goTo(extent, {
                    duration: 550,
                    easing: 'ease-in-out'
                });
                return true;
            }
        } catch (error) {
            console.warn('[contexto2] No fue posible resolver el zoom inicial de Factores determinantes', {
                error,
                source: source?.title || source?.url,
                where: source?.where
            });
        }
    }
    return false;
}

async function zoomToFeatureLayerExtent(url, where, requestId) {
    const view = state.view;
    if (!view || !url || !where || where === '1=0') return false;

    let layer = null;
    try {
        const FeatureLayer = await getFeatureLayerClass();
        if (!FeatureLayer || requestId !== territoryZoomRequestId) return false;

        layer = new FeatureLayer({
            url,
            outFields: ['OBJECTID']
        });

        await layer.load();
        if (requestId !== territoryZoomRequestId) return false;

        const result = await layer.queryExtent({ where });
        if (requestId !== territoryZoomRequestId || !result?.extent) return false;

        await view.when?.();
        await view.goTo(result.extent.expand(1.15), {
            duration: 550,
            easing: 'ease-in-out'
        });
        return true;
    } catch (error) {
        console.warn('[contexto2] No fue posible hacer zoom territorial con FeatureLayer temporal', {
            error,
            url,
            where
        });
        return false;
    } finally {
        layer?.destroy?.();
    }
}

async function buildGoToExtent(extent, factor = 1) {
    const expanded = expandPlainExtent(extent, factor);
    if (!expanded) return null;

    const Extent = await getExtentClass();
    return Extent?.fromJSON ? Extent.fromJSON(expanded) : expanded;
}

function getFeatureLayerClass() {
    return new Promise((resolve) => {
        if (!window.require) {
            resolve(null);
            return;
        }
        window.require(['esri/layers/FeatureLayer'], (FeatureLayer) => resolve(FeatureLayer), () => resolve(null));
    });
}

function getExtentClass() {
    return new Promise((resolve) => {
        if (!window.require) {
            resolve(null);
            return;
        }
        window.require(['esri/geometry/Extent'], (Extent) => resolve(Extent), () => resolve(null));
    });
}

function expandPlainExtent(extent, factor = 1) {
    const xmin = Number(extent?.xmin);
    const ymin = Number(extent?.ymin);
    const xmax = Number(extent?.xmax);
    const ymax = Number(extent?.ymax);
    if (![xmin, ymin, xmax, ymax].every(Number.isFinite)) return null;
    if (factor <= 1) return extent;

    const width = xmax - xmin;
    const height = ymax - ymin;
    const extraX = width * (factor - 1) / 2;
    const extraY = height * (factor - 1) / 2;
    return {
        ...extent,
        xmin: xmin - extraX,
        ymin: ymin - extraY,
        xmax: xmax + extraX,
        ymax: ymax + extraY
    };
}

function getZoomSources(config, thematicWhere, territoryWhere) {
    const sources = [];
    const territoryUrl = layerConfig.getLayerUrl?.();

    if (territoryUrl) {
        sources.push({
            url: territoryUrl,
            title: 'Extension territorial',
            where: territoryWhere || '1=1'
        });
    }

    getConfigSources(config).forEach(source => {
        if (!source?.url) return;
        sources.push({
            ...source,
            where: thematicWhere
        });
    });

    return sources;
}

function getConfigSources(config) {
    if (Array.isArray(config?.mapSources) && config.mapSources.length) return config.mapSources;
    if (Array.isArray(config?.sources) && config.sources.length) return config.sources;
    return config?.url ? [config] : [];
}

function getActiveConfig() {
    const config = layerConfig.getActive(state);
    if (!config || !subtabManager.shouldUseActiveConfig(config)) return null;
    return config;
}

function enrichGeometrySelection(selection, config) {
    if (!config?.legend?.groupByGeometry || selection?.source === 'legend') return selection;

    const legendItems = state.get('legendItems') || [];
    if (!legendItems.length) return selection;

    const values = (selection?.values || (selection?.value != null ? [selection.value] : []))
        .map(value => String(value));
    if (!values.length) return selection;

    const geometryLabel = selection?.geometryLabel || config?.geometryLabel || null;
    const activeLegendItems = legendItems.filter(item => {
        const value = String(item.value ?? item.code ?? item.label);
        const matchesValue = values.includes(value);
        const matchesGeometry = !geometryLabel || item.geometryLabel === geometryLabel;
        return matchesValue && matchesGeometry;
    });
    if (!activeLegendItems.length) return selection;

    const activeKeys = new Set(activeLegendItems.map(item => `${item.geometryLabel || item.geometryType || 'sin-geometria'}::${item.value ?? item.code ?? item.label}`));
    const excludedLegendItems = legendItems.filter(item => {
        const key = `${item.geometryLabel || item.geometryType || 'sin-geometria'}::${item.value ?? item.code ?? item.label}`;
        return !activeKeys.has(key);
    });

    return {
        ...selection,
        geometryLabel,
        activeLegendItems,
        excludedLegendItems
    };
}

function connectEvents() {
    eventBus.on('map:ready', async () => {
        mapControls.init?.();
        mapClickHandler.init();
        await reloadActiveLayer('Cargando capa...');
    });

    eventBus.on('mode:changed', async ({ mode, subLayerIndex = 0, condicionantesGroup = null, labelMode = null }) => {
        layerReloadRequestId++;
        state.set('currentSubLayerIndex', subLayerIndex);
        state.set('currentMode', mode);
        state.set('condicionantesGroup', mode === 'CONDICIONANTES' ? condicionantesGroup : null);
        mapViewBadge.update(labelMode === 'CONDICIONANTES'
            ? modeConfig.getLabel('CONDICIONANTES')
            : modeConfig.getContextLabel(mode, { condicionantesGroup }));
        clearResidues('Cargando categoria...');
        layerManager.clear();
        subtabManager.render();
        await subtabManager.refresh({ deferAvailability: mode === 'AMBIENTALES' });
        await reloadActiveLayer('Cargando categoria...');
    });

    eventBus.on('sublayer:changed', async () => {
        await reloadActiveLayer('Cargando subcategoria...');
    });

    eventBus.on('sublayer:empty', async () => {
        clearResidues('');
        layerManager.clear();
        state.set('activeLayerConfig', null);
        chartManager.showMessage(layerConfig.getEmptyMessage(state.get('currentMode')));
        legendRenderer.clear('Sin clases activas');
    });

    eventBus.on('search:cleared', async () => {
        layerReloadRequestId++;
        territoryZoomRequestId++;
        layerConfig.clearAvailableLayerIds(state.get('currentMode'));
        clearResidues('Seleccione un departamento o municipio');
        layerManager.clear();
        state.set('activeLayerConfig', null);

        const view = state.view;
        if (!view) return;

        try {
            const target = mapInitializer.extentInicial || { center: [-73.5, 4.5], zoom: 5 };
            await view.goTo(target, { duration: 700, easing: 'ease-in-out' });
        } catch (_) { }
    });

    eventBus.on('query:restart', async () => {
        await reloadActiveLayer('Cargando consulta...');
    });

    eventBus.on('territory:changed', async (territory = {}) => {
        if (territory.skipReload) return;
        layerReloadRequestId++;
        const activeConfig = getActiveConfig();
        layerConfig.clearAvailableLayerIds(state.get('currentMode'));
        clearResidues('Cargando consulta...');
        subtabManager.render();
        const deferAvailability = state.get('currentMode') === 'AMBIENTALES'
            && activeConfig?.groupId !== 'gestion_riesgo_cambio_climatico';
        await subtabManager.refresh({ deferAvailability }).catch(error => {
            eventBus.emit('data:error', { source: 'SubtabManager.refresh', error, context: { mode: state.get('currentMode') } });
        });
        await reloadActiveLayer('Cargando consulta...');
    });

    eventBus.on('layer:loaded', async ({ layer, layers, config, skipChart = false, requestId = 0 }) => {
        if (requestId && requestId !== layerReloadRequestId) return;
        if (config?.mode && config.mode !== state.get('currentMode')) return;
        state.set('activeLayerConfig', config);
        let legendItems = config?.summaryOnly
            ? [{
                code: state.get('filtroNivel') === 'DEPTO'
                    ? state.get('deptoActual')
                    : state.get('municipioActual'),
                value: state.get('filtroNivel') === 'DEPTO'
                    ? state.get('deptoActual')
                    : state.get('municipioActual'),
                label: 'Límite administrativo',
                field: config?.filter?.categoryField,
                color: config?.map?.outlineColor || '#7f3a0b'
            }].filter(item => item.value)
            : legendExtractor.sort(config, legendExtractor.extract(layers?.length ? layers : layer, config));
        legendItems = await filterLegendItemsByAvailableValues(legendItems, layers?.length ? layers : [layer].filter(Boolean), config);
        state.set('legendItems', legendItems);
        if (config?.summaryOnly) {
            legendRenderer.render(legendItems, config);
        } else if (skipChart && config?.chart && config?.mode !== 'AMBIENTALES') {
            legendRenderer.render(legendItems, config);
        } else if (!config?.chart) {
            legendRenderer.clear('Sin clases activas');
        }
        if (!skipChart) await chartManager.render();
    });

    eventBus.on('chart:data-ready', ({ items, config }) => {
        const storedLegendItems = state.get('legendItems') || [];
        const legendItems = config?.legend?.preferMapItems && storedLegendItems.length
            ? storedLegendItems
            : items;
        legendRenderer.render(legendItems, config);
    });

    eventBus.on('selection:changed', (selection) => {
        const config = getActiveConfig();
        const normalized = enrichGeometrySelection({
            ...selection,
            layerId: selection.layerId || config?.id,
            field: selection.field || config?.filter?.categoryField || config?.legend?.field
        }, config);
        const where = layerFilter.buildSelectionWhere(normalized, config);
        normalized.where = where;
        if (config?.summaryOnly && normalized.source === 'legend') {
            state.set('activeSelection', normalized);
            if (normalized.values?.length) {
                layerFilter.apply('', { zoom: false, viewFilter: true });
            } else {
                layerFilter.apply('1=0', { zoom: false, viewFilter: true });
            }
            legendRenderer.setActive(normalized);
            return;
        }
        state.set('activeSelection', normalized);
        state.set('activeFilter', where);
        const usedGeometryLegendFilter = config?.legend?.groupByGeometry
            && layerFilter.applyGeometryLegendSelection(normalized, config);
        if (!usedGeometryLegendFilter) {
            layerFilter.apply(where, {
                zoom: normalized.source !== 'legend',
                viewFilter: normalized.source === 'legend'
            });
        }
        if (normalized.source !== 'legend') {
            legendRenderer.setActive(normalized);
        }
        chartManager.setActive(normalized);
    });

    eventBus.on('selection:cleared', (options = {}) => {
        state.set('activeSelection', null);
        state.set('activeFilter', '');
        if (options?.preserveLegend) {
            const legendItems = state.get('legendItems') || [];
            const allLegendValues = legendItems.map(item => String(item.value ?? item.code ?? item.label));
            const values = Array.isArray(options.allowedValues) && options.allowedValues.length
                ? options.allowedValues.map(value => String(value))
                : allLegendValues;
            const field = state.get('activeLayerConfig')?.legend?.field || state.get('activeLayerConfig')?.filter?.categoryField;
            const excludedValues = legendItems
                .map(item => String(item.value ?? item.code ?? item.label))
                .filter(value => !values.map(String).includes(value));
            const selection = {
                source: 'legend',
                field,
                values,
                excludedValues
            };
            const where = layerFilter.buildSelectionWhere(selection, state.get('activeLayerConfig'));
            layerFilter.apply(where, { zoom: false });
            legendRenderer.setActiveValues(values, { emit: false });
            return;
        }
        layerFilter.reset();
        legendRenderer.setActive(null);
        chartManager.setActive(null);
    });

    eventBus.on('data:error', ({ source, error, context = {} }) => {
        if (context.requestId && context.requestId !== layerReloadRequestId) return;
        if (context.skipChart || context.groupId === 'factores_determinantes') {
            console.warn(`[contexto2] ${source}:`, error);
            return;
        }
        console.error(`[contexto2] ${source}:`, error);
        chartManager.clear();
        legendRenderer.clear('No fue posible cargar la informacion.');
    });
}

async function filterLegendItemsByAvailableValues(items, layers, config) {
    if (!config?.legend?.filterByAvailableValues || !layers?.length) return items;

    const field = config.legend.field || config.filter?.categoryField;
    if (!field) return items;

    try {
        const sources = Array.isArray(config?.mapSources) && config.mapSources.length
            ? config.mapSources
            : layers.map(layer => ({
                url: layer.url,
                title: layer.title,
                geometryType: layer.geometryType,
                geometryLabel: legendExtractor.getGeometryLabel(layer),
                map: config.map
            }));
        const where = layers[0]?.definitionExpression || state.get('activeFilter') || state.get('whereBase') || '1=1';
        const availability = await queryService.queryGroupedCountsMany(sources, where, field);
        const availableItems = legendExtractor.sort(config, legendExtractor.extractFromAvailability(config, availability));
        if (availableItems.length) return availableItems;

        const countsByGeometry = new Map();
        availability.forEach(({ source, counts }) => {
            const geometryLabel = source?.geometryLabel || legendExtractor.getGeometryLabel(source);
            if (!countsByGeometry.has(geometryLabel)) countsByGeometry.set(geometryLabel, new Set());
            const values = countsByGeometry.get(geometryLabel);
            (counts || new Map()).forEach((count, value) => {
                if (Number(count) > 0) values.add(String(value));
            });
        });

        const filtered = items.filter(item => {
            const itemValue = String(item.value ?? item.code ?? item.label);
            const geometryValues = countsByGeometry.get(item.geometryLabel);
            return geometryValues?.has(itemValue);
        });
        return filtered.length ? filtered : items;
    } catch (error) {
        console.warn('[contexto2] No fue posible filtrar la leyenda por valores disponibles', error);
        return items;
    }
}

async function init() {
    connectEvents();
    dropdownManager.init();
    descargablesDropdown.init();
    searchControls.init();
    await subtabManager.refresh();
    mapViewBadge.update(modeConfig.getContextLabel(state.get('currentMode'), {
        condicionantesGroup: state.get('condicionantesGroup')
    }));

    try {
        await municipalitySelector.init();
    } catch (error) {
        console.error('[contexto2] MunicipalitySelector.init:', error);
        eventBus.emit('municipality:catalog-loaded', []);
    }

    await mapInitializer.init();
}

init().catch(console.error);
