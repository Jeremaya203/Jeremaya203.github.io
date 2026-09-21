export class SearchControls {
    constructor(state, eventBus) {
        this.state = state;
        this.eventBus = eventBus;
        this.refreshBtn = document.getElementById('btnRefreshBusqueda');
        this.resetBtn = document.getElementById('btnReiniciarConsulta');
        this.deptoSelect = document.getElementById('departamentos');
        this.muniSelect = document.getElementById('municipios');
    }

    init() {
        this.refreshBtn?.addEventListener('click', () => this.clearSearch());
        this.resetBtn?.addEventListener('click', () => this.restartCurrentQuery());
    }

    clearSearch() {
        if (this.deptoSelect) this.deptoSelect.value = '0';
        if (this.muniSelect) this.muniSelect.value = '';
        this.state.set('currentDepartmentId', '');
        this.state.set('currentMunicipalityId', '');
        this.state.set('territoryLevel', '');
        this.state.set('whereBase', '');
        this.state.set('activeSelection', null);
        this.state.set('activeFilter', '');
        this.eventBus.emit('territory:changed', { code: null, level: null, skipReload: true });
        this.eventBus.emit('search:cleared');
    }

    restartCurrentQuery() {
        const municipalityId = String(this.muniSelect?.value || this.state.get('currentMunicipalityId') || '').trim();
        const departmentId = String(this.deptoSelect?.value || this.state.get('currentDepartmentId') || '').trim();
        const hasTerritory = Boolean(
            municipalityId
            || (departmentId && departmentId !== '0' && departmentId !== 'COL')
        );

        if (!hasTerritory) return;

        if (municipalityId) {
            this.state.set('currentMunicipalityId', municipalityId);
            this.state.set('currentDepartmentId', municipalityId.substring(0, 2));
            this.state.set('territoryLevel', 'MUNI');
            this.state.set('whereBase', `mpcodigo = '${municipalityId.replace(/'/g, "''")}'`);
        } else {
            this.state.set('currentMunicipalityId', '');
            this.state.set('currentDepartmentId', departmentId);
            this.state.set('territoryLevel', 'DEPTO');
            this.state.set('whereBase', `dpcodigo = '${departmentId.replace(/'/g, "''")}'`);
        }

        this.eventBus.emit('query:restart');
    }
}
