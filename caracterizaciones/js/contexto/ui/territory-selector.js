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

    _populate(municipalities) {
        if (!this.select) return;

        if (!Array.isArray(municipalities) || !municipalities.length) {
            this.select.innerHTML = '<option value="0">No fue posible cargar departamentos</option>';
            return;
        }

        this.select.innerHTML = `<option value="0">Seleccione departamento</option>`;

        const optCol = document.createElement('option');
        optCol.value = 'COL';
        optCol.textContent = 'Colombia';
        this.select.appendChild(optCol);

        const uniqueDepartmentCodes = [...new Set(municipalities.map(municipality => municipality.depto))].sort((a, b) => {
            const nameA = a === '00' ? 'Área en litigio' : this.dictService.getDepartmentName(a);
            const nameB = b === '00' ? 'Área en litigio' : this.dictService.getDepartmentName(b);
            return nameA.localeCompare(nameB, 'es');
        });
        uniqueDepartmentCodes.forEach(cod => {
            const opt = document.createElement('option');
            opt.value = cod;
            opt.textContent = cod === '00' ? 'Área en litigio' : this.dictService.getDepartmentName(cod);
            this.select.appendChild(opt);
        });
    }

    _onChange() {
        if (!this.select) return;
        const val = this.select.value;

        if (val === 'COL') {
            this.state.set('currentDepartmentId', '');
            this.state.set('currentMunicipalityId', '');
            this.state.set('territoryLevel', '');
            this.state.set('whereBase', '');
            this.eventBus.emit('territory:changed', { code: null, level: 'COL' });
            return;
        }

        if (val && val !== '0') {
            this.state.set('currentDepartmentId', val);
            this.state.set('territoryLevel', 'DEPTO');
            this.state.set('whereBase', `dpcodigo = '${val}'`);
            this.eventBus.emit('territory:changed', { code: val, level: 'DEPTO' });
        } else {
            this.state.set('currentDepartmentId', '');
            this.state.set('territoryLevel', '');
            this.state.set('whereBase', '');
            this.eventBus.emit('territory:changed', { code: null, level: null });
        }
    }
}
