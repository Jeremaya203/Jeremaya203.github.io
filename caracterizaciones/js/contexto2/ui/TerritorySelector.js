export class TerritorySelector {
    constructor(state, eventBus, dictService) {
        this.state = state;
        this.eventBus = eventBus;
        this.dictService = dictService;
        this.select = document.getElementById('departamentos');
        this._bindEvents();
    }

    _bindEvents() {
        this.eventBus.on('municipality:catalog-loaded', (data) => this._populate(data));
        this.select?.addEventListener('change', () => this._onChange());
    }

    _populate(todosMunicipios) {
        if (!this.select) return;

        if (!Array.isArray(todosMunicipios) || !todosMunicipios.length) {
            this.select.innerHTML = '<option value="0">No fue posible cargar departamentos</option>';
            return;
        }

        this.select.innerHTML = `<option value="0">Seleccione departamento</option>`;

        const optCol = document.createElement('option');
        optCol.value = 'COL';
        optCol.textContent = 'Colombia';
        this.select.appendChild(optCol);

        const deptosUnicos = [...new Set(todosMunicipios.map(m => m.depto))].sort((a, b) => {
            const nameA = a === '00' ? 'Área en litigio' : this.dictService.getDepartamentoName(a);
            const nameB = b === '00' ? 'Área en litigio' : this.dictService.getDepartamentoName(b);
            return nameA.localeCompare(nameB, 'es');
        });
        deptosUnicos.forEach(cod => {
            const opt = document.createElement('option');
            opt.value = cod;
            opt.textContent = cod === '00' ? 'Área en litigio' : this.dictService.getDepartamentoName(cod);
            this.select.appendChild(opt);
        });
    }

    _onChange() {
        if (!this.select) return;
        const val = this.select.value;

        if (val === 'COL') {
            this.state.set('deptoActual', '');
            this.state.set('municipioActual', '');
            this.state.set('filtroNivel', '');
            this.state.set('whereBase', '');
            this.eventBus.emit('territory:changed', { codigo: null, nivel: 'COL' });
            return;
        }

        if (val && val !== '0') {
            this.state.set('deptoActual', val);
            this.state.set('filtroNivel', 'DEPTO');
            this.state.set('whereBase', `dpcodigo = '${val}'`);
            this.eventBus.emit('territory:changed', { codigo: val, nivel: 'DEPTO' });
        } else {
            this.state.set('deptoActual', '');
            this.state.set('filtroNivel', '');
            this.state.set('whereBase', '');
            this.eventBus.emit('territory:changed', { codigo: null, nivel: null });
        }
    }
}
