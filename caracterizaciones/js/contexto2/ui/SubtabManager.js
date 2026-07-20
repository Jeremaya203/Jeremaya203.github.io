import { SqlUtils } from '../utils/SqlUtils.js';

export class SubtabManager {
    constructor(state, eventBus, layerConfig, queryService = null) {
        this.state = state;
        this.eventBus = eventBus;
        this.layerConfig = layerConfig;
        this.queryService = queryService;
        this.container = document.getElementById('subtabsControls');
        this.selectedGroupId = null;
        this.selectedLayerId = null;
        this._lastMode = null;
        this.refreshCycleId = 0;
        this._bindEvents();
    }

    _bindEvents() {}

    shouldUseActiveConfig(config) {
        if (!this.selectedGroupId || !config?.groupId) return true;
        return config.groupId === this.selectedGroupId;
    }

    async refresh(options = {}) {
        const cycleId = ++this.refreshCycleId;
        const mode = this.state.get('currentMode');
        if (this._lastMode !== mode) {
            this.selectedGroupId = null;
            this.selectedLayerId = null;
            this._lastMode = mode;
        }

        const rawList = this.layerConfig.getRawList(mode);
        const needsAvailability = rawList.some(cfg => cfg.availability?.requiresData);

        this.layerConfig.clearAvailableLayerIds(mode);
        this._ensureValidActiveIndex();
        this.render();

        if (!needsAvailability || !this.queryService) return;

        const completeAvailability = async () => {
            await this._refreshAvailability();
            if (cycleId !== this.refreshCycleId || mode !== this.state.get('currentMode')) return;
            this._ensureValidActiveIndex();
            this.render();
        };

        if (options.deferAvailability) {
            setTimeout(() => {
                completeAvailability().catch(error => {
                    console.warn('[contexto2] No fue posible actualizar la disponibilidad de subcapas', error);
                });
            }, 0);
            return;
        }

        await completeAvailability();
    }

    render() {
        if (!this.container) return;

        this.container.innerHTML = '';
        this.container.classList.remove('subtabs-controls--grouped');
        const wrap = this.container.closest('.chart-card-wrap');
        wrap?.classList.remove('chart-card-wrap--patrimonial-submenu');
        wrap?.querySelector('.patrimonial-geometry-tabs')?.remove();
        wrap?.querySelector('.chart-card')?.classList.remove(
            'chart-card--patrimonial-submenu',
            'chart-card--patrimonial-without-geometry-tabs'
        );

        const mode = this.state.get('currentMode');
        const nivel = this.state.get('filtroNivel');
        const condicionantesGroup = this.state.get('condicionantesGroup');
        const currentIdx = this.state.get('currentSubLayerIndex');
        const list = this.layerConfig.getList(mode, nivel, condicionantesGroup);
        const rawList = this.layerConfig.getRawList(mode);
        const isGrouped = rawList.some(cfg => cfg.groupId);

        if (isGrouped) {
            this._renderGrouped(rawList, list, currentIdx);
            return;
        }

        if (!list.length) {
            this.container.style.display = 'none';
            return;
        }

        if (list.length === 1 && list[0]?.hideSubtabs) {
            this.container.style.display = 'none';
            this.state.set('currentSubLayerIndex', 0);
            return;
        }

        this.container.style.display = 'flex';
        this.container.style.flexDirection = '';
        this.container.style.gap = '';
        list.forEach((cfg, idx) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'subtab-btn' + (idx === currentIdx ? ' active' : '');
            btn.textContent = cfg.title || `Capa ${idx + 1}`;

            btn.addEventListener('click', () => {
                this.state.set('currentSubLayerIndex', idx);
                this.render();
                this.eventBus.emit('sublayer:changed', { index: idx, layerId: cfg.id });
            });

            this.container.appendChild(btn);
        });
    }

    _renderGrouped(rawList, activeList, currentIdx) {
        const mode = this.state.get('currentMode');
        this.container.style.display = 'flex';
        this.container.style.flexDirection = '';
        this.container.style.gap = '';
        this.container.classList.add('subtabs-controls--grouped');
        const wrap = this.container.closest('.chart-card-wrap');
        const chartCard = wrap?.querySelector('.chart-card');

        const hasAvailabilityFilter = !!this.layerConfig.availableLayerIdsByMode?.has?.(mode);
        const isWaitingForPatrimonialAvailability = mode === 'PATRIMONIALES' && !hasAvailabilityFilter;
        const activeIds = new Set((activeList || []).map(cfg => cfg.id));
        const activeCfg = activeList[currentIdx] || activeList[0];
        const groups = [];
        const byGroup = new Map();

        rawList.forEach((cfg) => {
            const groupId = cfg.groupId || cfg.id;
            if (!byGroup.has(groupId)) {
                const group = {
                    id: groupId,
                    title: cfg.groupTitle || cfg.title || `Capa ${groups.length + 1}`,
                    items: []
                };
                byGroup.set(groupId, group);
                groups.push(group);
            }
            const activeIdx = (activeList || []).findIndex(item => item.id === cfg.id);
            byGroup.get(groupId).items.push({
                cfg,
                idx: activeIdx,
                available: hasAvailabilityFilter
                    ? activeIds.has(cfg.id)
                    : !isWaitingForPatrimonialAvailability
            });
        });
        const activeGroupId = this._resolveActiveGroupId(groups, activeCfg);

        const groupRow = document.createElement('div');
        groupRow.className = 'patrimonial-main-tabs';

        groups.forEach(group => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'subtab-btn' + (group.id === activeGroupId ? ' active' : '');
            btn.textContent = group.title;
            btn.addEventListener('click', () => this._selectGroup(group));
            groupRow.appendChild(btn);
        });

        this.container.appendChild(groupRow);

        const activeGroup = byGroup.get(activeGroupId);
        if (!activeGroup || !activeGroup.items.length) return;

        const geometryItems = activeGroup.items.filter(item => item.cfg.geometryLabel && !item.cfg.hideGeometryTab && item.available);
        if (geometryItems.length < 2) {
            if (mode === 'PATRIMONIALES') {
                chartCard?.classList.add('chart-card--patrimonial-without-geometry-tabs');
            }
            return;
        }

        const geometryRow = document.createElement('div');
        geometryRow.className = 'patrimonial-geometry-tabs';

        geometryItems.forEach(({ cfg, idx, available }) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            const isActive = cfg.id === (this.selectedLayerId || activeCfg?.id);
            btn.className = 'patrimonial-geometry-btn' + (isActive ? ' active' : '');
            btn.textContent = cfg.geometryLabel || cfg.title || `Capa ${idx + 1}`;
            btn.addEventListener('click', () => this._selectGeometry(cfg, idx, available));
            geometryRow.appendChild(btn);
        });

        if (!geometryRow.children.length) return;
        chartCard?.classList.add('chart-card--patrimonial-submenu');
        chartCard?.prepend(geometryRow);
    }

    _isGroupedMode() {
        const mode = this.state.get('currentMode');
        return this.layerConfig.getRawList(mode).some(cfg => cfg.groupId);
    }

    async _refreshAvailability() {
        const mode = this.state.get('currentMode');
        const rawList = this.layerConfig.getRawList(mode);
        const needsAvailability = rawList.some(cfg => cfg.availability?.requiresData);

        if (!needsAvailability || !this.queryService) {
            this.layerConfig.clearAvailableLayerIds(mode);
            return;
        }

        const whereBase = this.state.get('whereBase') || '1=1';
        const checks = await this._resolveAvailability(rawList, whereBase);

        this.layerConfig.setAvailableLayerIds(
            mode,
            checks.filter(item => item.available).map(item => item.id)
        );
    }

    async _resolveAvailability(rawList, whereBase) {
        const checks = rawList.map(cfg => ({ id: cfg.id, available: !cfg.availability?.requiresData }));
        const pending = rawList.filter(cfg => cfg.availability?.requiresData);
        const fallback = [];
        const groups = new Map();

        pending.forEach(cfg => {
            const batch = this._getBatchableAvailability(cfg, whereBase);
            if (!batch) {
                fallback.push(cfg);
                return;
            }
            if (!groups.has(batch.key)) {
                groups.set(batch.key, {
                    url: batch.url,
                    where: batch.where,
                    groupField: batch.groupField,
                    items: []
                });
            }
            groups.get(batch.key).items.push({
                id: cfg.id,
                value: batch.value
            });
        });

        await Promise.all([
            ...Array.from(groups.values()).map(group => this._applyGroupedAvailability(group, checks)),
            ...fallback.map(cfg => this._applyFallbackAvailability(cfg, whereBase, checks))
        ]);

        return checks;
    }

    async _applyGroupedAvailability(group, checks) {
        try {
            const counts = await this.queryService.queryGroupedCounts(group.url, group.where, group.groupField);
            group.items.forEach(item => {
                this._setAvailability(checks, item.id, Number(counts.get(String(item.value)) || 0) > 0);
            });
        } catch (error) {
            console.warn('[contexto2] No fue posible validar disponibilidad agrupada', { groupField: group.groupField, error });
            group.items.forEach(item => this._setAvailability(checks, item.id, false));
        }
    }

    async _applyFallbackAvailability(cfg, whereBase, checks) {
        const where = SqlUtils.combine(whereBase, cfg.filter?.fixedWhere);
        try {
            const sources = Array.isArray(cfg.sources) && cfg.sources.length ? cfg.sources : [{ url: cfg.url }];
            const counts = await Promise.all(sources.map(source => this.queryService.queryCount(source.url, where)));
            const count = counts.reduce((sum, value) => sum + Number(value || 0), 0);
            this._setAvailability(checks, cfg.id, count > 0);
        } catch (error) {
            console.warn('[contexto2] No fue posible validar disponibilidad de subcapa', { layerId: cfg.id, error });
            this._setAvailability(checks, cfg.id, false);
        }
    }

    _getBatchableAvailability(cfg, whereBase) {
        const sources = Array.isArray(cfg.sources) && cfg.sources.length ? cfg.sources : [{ url: cfg.url }];
        if (sources.length !== 1 || !sources[0]?.url) return null;

        const groupField = cfg.availability?.field || cfg.filter?.categoryField;
        const fixedWhere = cfg.filter?.fixedWhere;
        if (!groupField || !fixedWhere) return null;

        const equality = this._extractEqualityCondition(fixedWhere, groupField);
        if (!equality) return null;

        const where = SqlUtils.combine(whereBase, equality.remainingWhere || '1=1');
        const key = [sources[0].url, where, groupField].join('::');
        return {
            key,
            url: sources[0].url,
            where,
            groupField,
            value: equality.value
        };
    }

    _extractEqualityCondition(where, field) {
        const normalizedField = String(field || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const expression = String(where || '').trim();
        const pattern = new RegExp(`^(.*?)(?:\\s+AND\\s+)?${normalizedField}\\s*=\\s*('?[^']+'?|[\\w.-]+)\\s*$`, 'i');
        const match = expression.match(pattern);
        if (!match) return null;

        const value = String(match[2] || '').replace(/^'|'$/g, '');
        const remainingWhere = String(match[1] || '').trim().replace(/\s+AND\s*$/i, '').trim();
        return {
            value,
            remainingWhere: remainingWhere || '1=1'
        };
    }

    _setAvailability(checks, id, available) {
        const item = checks.find(check => check.id === id);
        if (item) item.available = available;
    }

    _ensureValidActiveIndex() {
        const mode = this.state.get('currentMode');
        const nivel = this.state.get('filtroNivel');
        const list = this.layerConfig.getList(mode, nivel, this.state.get('condicionantesGroup'));
        const rawList = this.layerConfig.getRawList(mode);
        const currentIdx = Number(this.state.get('currentSubLayerIndex') || 0);

        if (this.selectedLayerId) {
            const selectedIdx = list.findIndex(cfg => cfg.id === this.selectedLayerId);
            if (selectedIdx >= 0) {
                this.state.set('currentSubLayerIndex', selectedIdx);
                return;
            }
        }

        if (this.selectedGroupId && rawList.some(cfg => cfg.groupId === this.selectedGroupId)) {
            const groupLayers = list.filter(cfg => cfg.groupId === this.selectedGroupId);
            if (!groupLayers.length) return;

            const activeCfg = list[currentIdx];
            if (activeCfg?.groupId === this.selectedGroupId) return;

            const firstIdx = list.findIndex(cfg => cfg.groupId === this.selectedGroupId);
            if (firstIdx >= 0) {
                this.state.set('currentSubLayerIndex', firstIdx);
                this.selectedLayerId = list[firstIdx]?.id || this.selectedLayerId;
            }
            return;
        }

        if (!list.length) {
            this.state.set('currentSubLayerIndex', 0);
            return;
        }

        if (currentIdx >= list.length) {
            this.state.set('currentSubLayerIndex', 0);
        }

        if (!this.selectedGroupId) {
            const nextIdx = Number(this.state.get('currentSubLayerIndex') || 0);
            this.selectedGroupId = list[nextIdx]?.groupId || list[0]?.groupId || null;
            this.selectedLayerId = list[nextIdx]?.id || list[0]?.id || null;
        }
    }

    _resolveActiveGroupId(groups, activeCfg) {
        if (this.selectedGroupId && groups.some(group => group.id === this.selectedGroupId)) {
            return this.selectedGroupId;
        }
        if (activeCfg?.groupId && groups.some(group => group.id === activeCfg.groupId)) {
            return activeCfg.groupId;
        }
        return groups[0]?.id;
    }

    _selectGroup(group) {
        this.selectedGroupId = group.id;
        const first = group.items.find(item => item.available);
        if (!first) {
            this.selectedLayerId = group.items[0]?.cfg?.id || null;
            this.render();
            this.eventBus.emit('sublayer:empty', { groupId: group.id, layerId: this.selectedLayerId });
            return;
        }
        this.selectedLayerId = first.cfg.id;
        this.state.set('currentSubLayerIndex', first.idx);
        this.render();
        this.eventBus.emit('sublayer:changed', { index: first.idx, layerId: first.cfg.id });
    }

    _selectGeometry(cfg, idx, available) {
        this.selectedGroupId = cfg.groupId || this.selectedGroupId;
        this.selectedLayerId = cfg.id;
        if (!available || idx < 0) {
            this.render();
            this.eventBus.emit('sublayer:empty', { groupId: cfg.groupId, layerId: cfg.id });
            return;
        }
        this.state.set('currentSubLayerIndex', idx);
        this.render();
        this.eventBus.emit('sublayer:changed', { index: idx, layerId: cfg.id });
    }
}
