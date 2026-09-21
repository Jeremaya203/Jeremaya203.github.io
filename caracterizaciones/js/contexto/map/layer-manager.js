import { SqlUtils } from '../utils/sql-utils.js';

export class LayerManager {
    constructor(state, eventBus, config, layerFactory) {
        this.state = state;
        this.eventBus = eventBus;
        this.config = config;
        this.layerFactory = layerFactory;
        this.layersGlobal = [];
        this.renderCycleId = 0;
        this.factorLayerCache = new Map();
        this.cachedLayers = new Set();
        this.pendingLayers = new Set();
        this.maxFactorLayerCacheEntries = 14;
        this.extentCache = new Map();
        this.maxExtentCacheEntries = 80;
    }

    async load(options = {}) {
        const map = this.state.map;
        if (!map) return null;

        const layerCfg = this.config.getActive(this.state);
        if (!layerCfg) {
            this.eventBus.emit('data:error', {
                source: 'LayerManager',
                error: new Error('No hay capa activa'),
                context: {}
            });
            return null;
        }

        const cycleId = ++this.renderCycleId;
        const requestId = options.requestId || cycleId;
        const whereBase = SqlUtils.combine(this.state.get('whereBase') || '1=1', layerCfg.filter?.fixedWhere);

        try {
            const sources = this._getSources(layerCfg);
            const cacheKey = this._getFactorCacheKey(layerCfg, whereBase, sources);
            const cached = cacheKey ? this._getCachedFactorLayers(cacheKey) : null;

            if (cached?.layers?.length) {
                if (cycleId !== this.renderCycleId) return null;
                const alreadyActive = cached.layers.length === this.layersGlobal.length
                    && cached.layers.every((layer, index) => layer === this.layersGlobal[index]);
                if (!alreadyActive) {
                    this.clear({ destroy: false });
                }
                cached.layers.forEach(layer => {
                    layer.definitionExpression = whereBase;
                    if (!alreadyActive && !map.layers?.includes?.(layer)) map.add(layer);
                });
                this._activateLayers(cached.layers, whereBase);
                if (!options.skipZoom) {
                    await this.zoomToLayers(cached.layers, whereBase, { cycleId });
                }
                if (cycleId !== this.renderCycleId) return null;
                this.eventBus.emit('layer:loaded', {
                    layer: cached.layers[0] || null,
                    layers: cached.layers,
                    config: layerCfg,
                    reused: true,
                    skipChart: !!options.skipChart,
                    requestId
                });
                return cached.layers[0] || null;
            }

            this.clear({ destroy: !cacheKey });
            const created = await Promise.allSettled(sources.map(source => this.layerFactory.create(layerCfg, whereBase, source)));
            const layers = created
                .filter(result => result.status === 'fulfilled' && result.value)
                .map(result => result.value);
            created
                .filter(result => result.status === 'rejected')
                .forEach(result => console.warn('[contexto2] No fue posible crear una fuente de capa', result.reason));
            if (!layers.length) throw new Error('No fue posible crear ninguna fuente de capa activa.');
            if (cycleId !== this.renderCycleId) {
                layers.forEach(layer => layer.destroy?.());
                return null;
            }

            layers.forEach(layer => {
                this.pendingLayers.add(layer);
                map.add(layer);
            });
            const loaded = await Promise.allSettled(layers.map(layer => layer.load().then(() => layer)));
            const readyLayers = loaded
                .filter(result => result.status === 'fulfilled' && result.value)
                .map(result => result.value);
            loaded
                .filter(result => result.status === 'rejected')
                .forEach(result => console.warn('[contexto2] No fue posible cargar una fuente de capa', result.reason));
            layers
                .filter(layer => !readyLayers.includes(layer))
                .forEach(layer => {
                    this.pendingLayers.delete(layer);
                    map.remove(layer);
                    layer.destroy?.();
                });
            if (!readyLayers.length) throw new Error('No fue posible cargar ninguna fuente de capa activa.');

            if (cycleId !== this.renderCycleId) {
                readyLayers.forEach(layer => {
                    this.pendingLayers.delete(layer);
                    map.remove(layer);
                    layer.destroy?.();
                });
                return null;
            }

            readyLayers.forEach(layer => this.pendingLayers.delete(layer));
            this._activateLayers(readyLayers, whereBase);
            if (!options.skipZoom) {
                await this.zoomToLayers(readyLayers, whereBase, { cycleId });
            }
            if (cycleId !== this.renderCycleId) return null;
            if (cacheKey) this._setCachedFactorLayers(cacheKey, readyLayers);
            this.eventBus.emit('layer:loaded', {
                layer: readyLayers[0] || null,
                layers: readyLayers,
                config: layerCfg,
                skipChart: !!options.skipChart,
                requestId
            });
            return readyLayers[0] || null;
        } catch (error) {
            this.eventBus.emit('data:error', {
                source: 'LayerManager',
                error,
                context: {
                    layerId: layerCfg.id,
                    requestId,
                    skipChart: !!options.skipChart,
                    groupId: layerCfg.groupId
                }
            });
            return null;
        }
    }

    clear(options = {}) {
        const destroy = options.destroy !== false;
        const map = this.state.map;
        this.layersGlobal.forEach(layer => {
            try {
                map?.remove(layer);
                if (destroy && !this.cachedLayers.has(layer)) layer.destroy?.();
            } catch (_error) {
                // ArcGIS puede lanzar si la capa ya fue removida.
            }
        });
        this.layersGlobal = [];
        this.state.layerGlobal = null;
        this.state.layersGlobal = [];
    }

    cancelPending() {
        this.renderCycleId++;
        this.pendingLayers.forEach(layer => {
            try {
                this.state.map?.remove(layer);
                layer.destroy?.();
            } catch (_error) {}
        });
        this.pendingLayers.clear();
    }

    _activateLayers(layers, whereBase) {
        this.layersGlobal = layers;
        this.state.layerGlobal = layers[0] || null;
        this.state.layersGlobal = layers;
        this.state.set('activeSelection', null);
        this.state.set('activeFilter', whereBase);
    }

    applyFilter(where) {
        const layers = this.state.layersGlobal?.length ? this.state.layersGlobal : [this.state.layerGlobal].filter(Boolean);
        if (!layers.length) return;
        const expression = where || this.state.get('whereBase') || '1=1';
        layers.forEach(layer => {
            layer.definitionExpression = expression;
        });
    }

    async zoomToLayer(layer, where, options = {}) {
        const view = this.state.view;
        if (!layer || !view || !where || where === '1=0') return;
        const cycleId = options.cycleId ?? this.renderCycleId;

        try {
            const result = await this._queryExtent(layer, where);
            if (cycleId !== this.renderCycleId) return false;
            if (result?.extent) {
                await view.goTo(result.extent.expand(1.15), {
                    duration: 700,
                    easing: 'ease-in-out'
                });
                return cycleId === this.renderCycleId;
            }
        } catch (error) {
            if (cycleId !== this.renderCycleId) return false;
            console.warn('[contexto2] No fue posible hacer zoom a la consulta', { error, where });
        }
        return false;
    }

    async zoomToLayers(layers, where, options = {}) {
        const view = this.state.view;
        if (!layers?.length || !view || !where || where === '1=0') return;
        const cycleId = options.cycleId ?? this.renderCycleId;

        for (const layer of layers) {
            if (cycleId !== this.renderCycleId) return false;
            try {
                const result = await this._queryExtent(layer, where);
                if (cycleId !== this.renderCycleId) return false;
                if (result?.extent) {
                    await view.goTo(result.extent.expand(1.15), {
                        duration: 700,
                        easing: 'ease-in-out'
                    });
                    return cycleId === this.renderCycleId;
                }
            } catch (error) {
                if (cycleId !== this.renderCycleId) return false;
                console.warn('[contexto2] No fue posible hacer zoom a una fuente de la consulta', { error, where });
            }
        }
        return false;
    }

    async _queryExtent(layer, where) {
        const key = [layer?.url || layer?.id || '', where || '1=1'].join('::');
        if (this.extentCache.has(key)) {
            const cached = this.extentCache.get(key);
            this.extentCache.delete(key);
            this.extentCache.set(key, cached);
            return cached;
        }

        const request = layer.queryExtent({ where });
        this.extentCache.set(key, request);
        while (this.extentCache.size > this.maxExtentCacheEntries) {
            this.extentCache.delete(this.extentCache.keys().next().value);
        }

        try {
            return await request;
        } catch (error) {
            this.extentCache.delete(key);
            throw error;
        }
    }

    _getSources(layerCfg) {
        if (Array.isArray(layerCfg?.mapSources) && layerCfg.mapSources.length) return layerCfg.mapSources;
        if (Array.isArray(layerCfg?.sources) && layerCfg.sources.length) return layerCfg.sources;
        return [layerCfg];
    }

    _getFactorCacheKey(layerCfg, whereBase, sources) {
        const cacheable = layerCfg?.groupId === 'factores_determinantes' || layerCfg?.mode === 'AMBIENTALES';
        if (!cacheable) return '';
        const sourceKey = (sources || []).map(source => source.url).join('|');
        const layerKey = layerCfg?.groupId === 'factores_determinantes'
            ? layerCfg.groupId
            : layerCfg.id;
        return [layerCfg.mode, layerKey, sourceKey].join('::');
    }

    _getCachedFactorLayers(key) {
        if (!this.factorLayerCache.has(key)) return null;
        const entry = this.factorLayerCache.get(key);
        this.factorLayerCache.delete(key);
        this.factorLayerCache.set(key, entry);
        return entry;
    }

    _setCachedFactorLayers(key, layers) {
        this.factorLayerCache.set(key, { layers });
        layers.forEach(layer => this.cachedLayers.add(layer));

        while (this.factorLayerCache.size > this.maxFactorLayerCacheEntries) {
            const oldestKey = this.factorLayerCache.keys().next().value;
            const oldest = this.factorLayerCache.get(oldestKey);
            this.factorLayerCache.delete(oldestKey);
            (oldest?.layers || []).forEach(layer => {
                this.cachedLayers.delete(layer);
                try {
                    this.state.map?.remove(layer);
                    layer.destroy?.();
                } catch (_error) {}
            });
        }
    }
}
