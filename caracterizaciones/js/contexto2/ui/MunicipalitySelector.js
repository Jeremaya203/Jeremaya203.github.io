export class MunicipalitySelector {
    constructor(state, eventBus, dictService, territorialCatalogService) {
        this.state = state;
        this.eventBus = eventBus;
        this.dictService = dictService;
        this.territorialCatalogService = territorialCatalogService;
        this.select = document.getElementById('municipios');
        this.todosMunicipios = [];
        this._bindEvents();
    }

    _bindEvents() {
        this.eventBus.on('territory:changed', (data) => this._onTerritoryChange(data));
        this.select?.addEventListener('change', () => this._onChange());
    }

    async init() {
        const catalog = await this.territorialCatalogService.loadCatalog();
        this.todosMunicipios = catalog.todosMunicipios || [];

        this.state.set('todosMunicipios', this.todosMunicipios);
        this.eventBus.emit('municipality:catalog-loaded', this.todosMunicipios);
        this._render();
    }

    _onTerritoryChange(data) {
        if (data.nivel === 'MUNI') return;

        if (!this.select) return;

        this.select.value = '';
        if (data.nivel === 'DEPTO') {
            this._render(data.codigo);
        } else {
            this._render();
        }
    }

    _onChange() {
        if (!this.select) return;
        const codigo = this.select.value;
        if (!codigo) return;

        this.state.set('municipioActual', codigo);
        this.state.set('deptoActual', codigo.substring(0, 2));
        this.state.set('filtroNivel', 'MUNI');
        this.state.set('whereBase', `mpcodigo = '${codigo}'`);
        this.eventBus.emit('territory:changed', { codigo, nivel: 'MUNI' });
    }

    _render(deptoFiltro) {
        if (!this.select) return;
        this.select.innerHTML = '<option value="">Seleccione un municipio</option>';

        let list = this.todosMunicipios;
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

