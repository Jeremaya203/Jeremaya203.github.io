/**
 * arcgis-query-service.js — Consultas REST a Servicios ArcGIS
 *
 * Realiza consultas queryFeatures a los servicios REST de ArcGIS
 * y retorna datos procesados.
 *
 * Responsabilidad:
 *   - queryFeatures(url, where, outFields): retorna features[]
 *   - queryExtent(url, where): retorna el extent de los features
 *
 * Dependencias:
 *   - Fetch API (nativo)
 */
export class ArcGISQueryService {
    constructor() {
        this.cache = new Map();
        this.inFlight = new Map();
        this.maxCacheEntries = 160;
        this.sessionCacheTtlMs = 30 * 60 * 1000;
        this.sessionCachePrefix = 'ct-context-query-v1:';
    }

    async queryFeatures(url, where, outFields = ['*'], options = {}) {
        const requestOptions = this._getRequestOptions(options);
        const cacheKey = this._cacheKey('features', url, where, outFields, requestOptions);
        return this._fromCacheOrFetch(cacheKey, async () => {
            const usePaging = requestOptions.returnDistinctValues !== 'true'
                && requestOptions.returnDistinctValues !== true
                && requestOptions.returnIdsOnly !== 'true'
                && requestOptions.returnIdsOnly !== true;

            if (!usePaging) {
                const params = new URLSearchParams({
                    where,
                    outFields: outFields.join(','),
                    returnGeometry: 'false',
                    f: 'json',
                    ...requestOptions
                });
                const data = await this._fetchQueryJson(`${url}/query?${params.toString()}`, 2, options.signal);
                return data.features || [];
            }

            const pageSize = Number(requestOptions.resultRecordCount || 2000);
            const baseOptions = { ...requestOptions };
            delete baseOptions.resultOffset;
            delete baseOptions.resultRecordCount;

            const fetchPage = async (offset) => {
                const params = new URLSearchParams({
                    where,
                    outFields: outFields.join(','),
                    returnGeometry: 'false',
                    resultOffset: String(offset),
                    resultRecordCount: String(pageSize),
                    f: 'json',
                    ...baseOptions
                });
                return this._fetchQueryJson(`${url}/query?${params.toString()}`, 2, options.signal);
            };
            const isLastPage = (data) => {
                const features = data?.features || [];
                return !data?.exceededTransferLimit || features.length < pageSize || !features.length;
            };

            const initialOffset = Number(requestOptions.resultOffset || 0);
            const firstPage = await fetchPage(initialOffset);
            const allFeatures = [...(firstPage.features || [])];
            if (isLastPage(firstPage)) return allFeatures;

            if (!options.parallelPaging) {
                let offset = initialOffset + (firstPage.features || []).length;
                while (true) {
                    const data = await fetchPage(offset);
                    const features = data.features || [];
                    allFeatures.push(...features);
                    if (isLastPage(data)) break;
                    offset += features.length;
                }
                return allFeatures;
            }

            const parallelPages = Math.max(2, Math.min(4, Number(options.maxParallelPages || 3)));
            let nextOffset = initialOffset + pageSize;
            let finished = false;

            while (!finished) {
                const offsets = Array.from({ length: parallelPages }, (_, index) => nextOffset + index * pageSize);
                const pages = await Promise.all(offsets.map(offset => fetchPage(offset)));
                const lastPageIndex = pages.findIndex(isLastPage);
                const pagesToAppend = lastPageIndex >= 0 ? pages.slice(0, lastPageIndex + 1) : pages;
                pagesToAppend.forEach(data => allFeatures.push(...(data.features || [])));
                finished = lastPageIndex >= 0;
                nextOffset += parallelPages * pageSize;
            }

            return allFeatures;
        }, { shareInFlight: !options.signal });
    }

    async _fetchQueryJson(endpoint, maxAttempts = 2, signal = null) {
        let lastError = null;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const controller = new AbortController();
            const abortFromExternalSignal = () => controller.abort(signal?.reason);
            const timeoutId = setTimeout(() => controller.abort(), 45000);
            if (signal?.aborted) controller.abort(signal.reason);
            signal?.addEventListener?.('abort', abortFromExternalSignal, { once: true });

            try {
                const response = await fetch(endpoint, { signal: controller.signal });
                const data = await response.json();
                if (!response.ok || data.error) {
                    throw new Error(data.error?.message || `Error HTTP ${response.status}`);
                }
                return data;
            } catch (error) {
                lastError = error;
                if (signal?.aborted) throw error;
                if (attempt < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 350));
                }
            } finally {
                clearTimeout(timeoutId);
                signal?.removeEventListener?.('abort', abortFromExternalSignal);
            }
        }

        throw lastError || new Error('No fue posible completar la consulta.');
    }

    async queryCount(url, where, options = {}) {
        const cacheKey = this._cacheKey('count', url, where, [], {});
        return this._fromCacheOrFetch(cacheKey, async () => {
            const params = new URLSearchParams({
                where,
                returnCountOnly: 'true',
                f: 'json'
            });
            const data = await this._fetchQueryJson(`${url}/query?${params.toString()}`, 2, options.signal);
            return Number(data.count || 0);
        }, {
            shareInFlight: !options.signal,
            persistSession: true
        });
    }

    async queryGroupedCounts(url, where, groupField, options = {}) {
        const cacheKey = this._cacheKey('grouped-counts', url, where, [groupField], {});
        return this._fromCacheOrFetch(cacheKey, async () => {
            const params = new URLSearchParams({
                where,
                outStatistics: JSON.stringify([{
                    statisticType: 'count',
                    onStatisticField: groupField,
                    outStatisticFieldName: 'total'
                }]),
                groupByFieldsForStatistics: groupField,
                returnGeometry: 'false',
                f: 'json'
            });
            const data = await this._fetchQueryJson(`${url}/query?${params.toString()}`, 2, options.signal);
            const counts = new Map();
            (data.features || []).forEach(feature => {
                const attrs = feature.attributes || {};
                counts.set(String(attrs[groupField]), Number(attrs.total || 0));
            });
            return counts;
        }, {
            shareInFlight: !options.signal,
            persistSession: true,
            serialize: value => [...value.entries()],
            deserialize: value => new Map(value || [])
        });
    }

    async queryGroupedCountsMany(sources = [], where, groupField, options = {}) {
        const results = await Promise.allSettled((sources || []).map(async (source) => ({
            source,
            counts: await this.queryGroupedCounts(source.url, where, groupField, options)
        })));
        if (options.signal?.aborted) {
            throw new DOMException('Consulta agrupada cancelada', 'AbortError');
        }
        const fulfilled = results.filter(result => result.status === 'fulfilled');
        if (!fulfilled.length && sources.length) {
            throw new Error('No fue posible consultar conteos agrupados en ninguna fuente.');
        }
        const failedCount = results.length - fulfilled.length;
        if (failedCount > 0) {
            console.warn(`[contexto2] ${failedCount} fuente(s) no respondieron conteos agrupados; se continúa con las disponibles.`);
        }
        return results
            .map((result, index) => {
                if (result.status === 'fulfilled') return result.value;
                return {
                    source: sources[index],
                    counts: new Map()
                };
            });
    }

    async queryGroupedStatistics(url, where, statistics, groupByFields, options = {}) {
        const normalizedStatistics = (statistics || []).map(statistic => ({
            statisticType: statistic.statisticType,
            onStatisticField: statistic.onStatisticField,
            outStatisticFieldName: statistic.outStatisticFieldName
        }));
        const normalizedGroupFields = [...new Set((groupByFields || []).filter(Boolean))];
        const cacheKey = this._cacheKey(
            'grouped-statistics',
            url,
            where,
            normalizedGroupFields,
            { statistics: JSON.stringify(normalizedStatistics) }
        );

        return this._fromCacheOrFetch(cacheKey, async () => {
            const params = new URLSearchParams({
                where,
                outStatistics: JSON.stringify(normalizedStatistics),
                groupByFieldsForStatistics: normalizedGroupFields.join(','),
                returnGeometry: 'false',
                f: 'json'
            });
            const data = await this._fetchQueryJson(`${url}/query?${params.toString()}`, 2, options.signal);
            return data.features || [];
        }, {
            shareInFlight: !options.signal,
            persistSession: true
        });
    }

    async queryExtent(url, where, options = {}) {
        const cacheKey = this._cacheKey('extent', url, where, [], {});
        return this._fromCacheOrFetch(cacheKey, async () => {
            const params = new URLSearchParams({
                where,
                returnExtentOnly: 'true',
                returnGeometry: 'false',
                f: 'json'
            });
            const data = await this._fetchQueryJson(`${url}/query?${params.toString()}`, 2, options.signal);
            return data;
        }, { shareInFlight: !options.signal });
    }

    _getRequestOptions(options = {}) {
        const requestOptions = { ...options };
        delete requestOptions.parallelPaging;
        delete requestOptions.maxParallelPages;
        delete requestOptions.signal;
        return requestOptions;
    }

    _cacheKey(type, url, where, outFields = [], options = {}) {
        const normalizedFields = [...(outFields || [])].map(String).sort().join(',');
        const normalizedOptions = Object.entries(options || {})
            .filter(([, value]) => value !== undefined && value !== null)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => `${key}:${value}`)
            .join('|');
        return [type, url, where || '1=1', normalizedFields, normalizedOptions].join('::');
    }

    _getCache(key) {
        if (!this.cache.has(key)) return null;
        const value = this.cache.get(key);
        this.cache.delete(key);
        this.cache.set(key, value);
        return value;
    }

    async _fromCacheOrFetch(key, fetcher, options = {}) {
        if (this.cache.has(key)) return this._getCache(key);
        const sessionValue = options.persistSession
            ? this._getSessionCache(key, options.deserialize)
            : null;
        if (sessionValue !== null) {
            this._setCache(key, sessionValue);
            return sessionValue;
        }
        const shareInFlight = options.shareInFlight !== false;
        if (shareInFlight && this.inFlight.has(key)) return this.inFlight.get(key);

        if (!shareInFlight) {
            const value = await fetcher();
            this._setCache(key, value);
            if (options.persistSession) this._setSessionCache(key, value, options.serialize);
            return value;
        }

        const request = (async () => {
            const value = await fetcher();
            this._setCache(key, value);
            if (options.persistSession) this._setSessionCache(key, value, options.serialize);
            return value;
        })();

        this.inFlight.set(key, request);
        try {
            return await request;
        } finally {
            this.inFlight.delete(key);
        }
    }

    _setCache(key, value) {
        this.cache.set(key, value);
        while (this.cache.size > this.maxCacheEntries) {
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
        }
    }

    _getSessionCache(key, deserialize = null) {
        try {
            const storage = globalThis.sessionStorage;
            if (!storage) return null;
            const storageKey = this._getSessionStorageKey(key);
            const raw = storage.getItem(storageKey);
            if (!raw) return null;
            const entry = JSON.parse(raw);
            if (entry?.key !== key || Number(entry.expiresAt || 0) <= Date.now()) {
                storage.removeItem(storageKey);
                return null;
            }
            return typeof deserialize === 'function'
                ? deserialize(entry.value)
                : entry.value;
        } catch (_error) {
            return null;
        }
    }

    _setSessionCache(key, value, serialize = null) {
        try {
            const storage = globalThis.sessionStorage;
            if (!storage) return;
            const storedValue = typeof serialize === 'function' ? serialize(value) : value;
            storage.setItem(this._getSessionStorageKey(key), JSON.stringify({
                key,
                expiresAt: Date.now() + this.sessionCacheTtlMs,
                value: storedValue
            }));
        } catch (_error) {
            // Si sessionStorage está deshabilitado o sin cuota, continúa la caché en memoria.
        }
    }

    _getSessionStorageKey(key) {
        let hash = 2166136261;
        for (let index = 0; index < key.length; index++) {
            hash ^= key.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }
        return `${this.sessionCachePrefix}${(hash >>> 0).toString(36)}`;
    }
}
