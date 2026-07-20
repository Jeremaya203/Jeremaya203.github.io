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
        this.state.set('deptoActual', '');
        this.state.set('municipioActual', '');
        this.state.set('filtroNivel', '');
        this.state.set('whereBase', '');
        this.state.set('activeSelection', null);
        this.state.set('activeFilter', '');
        this.eventBus.emit('territory:changed', { codigo: null, nivel: null, skipReload: true });
        this.eventBus.emit('search:cleared');
    }

    restartCurrentQuery() {
        const municipio = String(this.muniSelect?.value || this.state.get('municipioActual') || '').trim();
        const departamento = String(this.deptoSelect?.value || this.state.get('deptoActual') || '').trim();
        const hasTerritory = Boolean(
            municipio
            || (departamento && departamento !== '0' && departamento !== 'COL')
        );

        if (!hasTerritory) return;

        if (municipio) {
            this.state.set('municipioActual', municipio);
            this.state.set('deptoActual', municipio.substring(0, 2));
            this.state.set('filtroNivel', 'MUNI');
            this.state.set('whereBase', `mpcodigo = '${municipio.replace(/'/g, "''")}'`);
        } else {
            this.state.set('municipioActual', '');
            this.state.set('deptoActual', departamento);
            this.state.set('filtroNivel', 'DEPTO');
            this.state.set('whereBase', `dpcodigo = '${departamento.replace(/'/g, "''")}'`);
        }

        this.eventBus.emit('query:restart');
    }
}
