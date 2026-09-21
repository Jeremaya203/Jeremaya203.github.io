export class MunicipalitySelector {
    constructor(state, eventBus, dictService, territorialCatalogService) {
        this.state = state;
        this.eventBus = eventBus;
        this.dictService = dictService;
        this.territorialCatalogService = territorialCatalogService;
        this.select = document.getElementById('municipios');
        this.municipalities = [];
        this._bindEvents();
    }

    _bindEvents() {
        this.eventBus.on('territory:changed', (data) => this._onTerritoryChange(data));
        this.select?.addEventListener('change', () => this._onChange());
    }

    async init() {
        const catalog = await this.territorialCatalogService.loadCatalog();
        this.municipalities = catalog.municipalities || [];

        this.state.set('municipalities', this.municipalities);
        this.eventBus.emit('municipality:catalog-loaded', this.municipalities);
        this._render();
    }

    _onTerritoryChange(data) {
        if (data.level === 'MUNI') return;

        if (!this.select) return;

        this.select.value = '';
        if (data.level === 'DEPTO') {
            this._render(data.code);
        } else {
            this._render();
        }
    }

    _onChange() {
        if (!this.select) return;
        const code = this.select.value;
        if (!code) return;

        this.state.set('currentMunicipalityId', code);
        this.state.set('currentDepartmentId', code.substring(0, 2));
        this.state.set('territoryLevel', 'MUNI');
        this.state.set('whereBase', `mpcodigo = '${code}'`);
        this.eventBus.emit('territory:changed', { code, level: 'MUNI' });
    }

    _render(deptoFiltro) {
        if (!this.select) return;
        this.select.innerHTML = '<option value="">Seleccione un municipio</option>';

        let list = this.municipalities;
        if (deptoFiltro && deptoFiltro !== '0') {
            list = list.filter(m => m.depto === deptoFiltro);
        }

        list.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.codigo;
            opt.textContent = m.codigo === '00000' ? '\u00c1rea en litigio' : m.nombre;
            this.select.appendChild(opt);
        });
    }
}

