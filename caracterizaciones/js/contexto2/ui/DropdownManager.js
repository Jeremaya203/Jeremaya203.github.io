import { ModuleNavigator } from '../navigation/ModuleNavigator.js';

const LEGAL_PAGES = {
    DETERMINANTES: 'Determinantes',
    DETERMINANTES_LINEA: 'Determinantes Linea',
    DETERMINANTES_PUNTO: 'Determinantes Punto',
    CONDICIONANTES: 'Condicionantes',
    AMBIENTALES: 'Ambientales',
    SOBERANIA_ALIMENTARIA: 'Soberanía Alimentaria',
    PATRIMONIALES: 'patrimoniales',
    INFRAESTRUCTURA: 'infraestructura',
    AREAS_METROPOLITANAS_SUBURBANIZACION: 'areas_metropolitanas_suburbanizacion',
    PROYECTOS_TURISTICOS_ESPECIALES: 'proyectos_turisticos_especiales_e_infraestructura_asociada'
};

const CONDICIONANTES_TARGETS = new Set([
    'Condicionantes',
    'factores_condicionantes',
    'territorios_colectivos',
    'exploracion_explotacion_recursos_no_renovables',
    'acuerdo_final_paz',
    'planes_ordenamiento_social_propiedad_rural',
    'zonas_afectadas_conflicto_armado'
]);

const CONDICIONANTES_GROUPS = {
    Condicionantes: 'factores_condicionantes',
    factores_condicionantes: 'factores_condicionantes',
    territorios_colectivos: 'territorios_colectivos',
    exploracion_explotacion_recursos_no_renovables: 'recursos_no_renovables',
    acuerdo_final_paz: 'acuerdo_final_paz',
    zonas_afectadas_conflicto_armado: 'zomac'
};

export class DropdownManager {
    constructor(state, eventBus) {
        this.state = state;
        this.eventBus = eventBus;
        this.navigator = new ModuleNavigator();
        this._bindGlobalClose();
        this.eventBus.on('mode:changed', (data) => this.syncActive(data));
    }

    init() {
        this._initDropdown('limitesDropdown', 'limitesTrigger', (target) => {
            this.navigator.navigateTo('limites.html', target);
        });
        this._initDropdown('ordenamientoDropdown', 'ordenamientoTrigger', (target) => {
            this.navigator.navigateTo('ordenamiento.html', target);
        });
        this._initDropdown('legalDropdown', 'legalTrigger', (target) => {
            this._onLegalItemClick(target);
        });
        this._initDropdown('biofisicoDropdown', 'biofisicoTrigger', (target) => {
            this.navigator.navigateTo('biofisico.html', target);
        });
        this._initDropdown('ocupacionDropdown', 'ocupacionTrigger', (target) => {
            this.navigator.navigateTo('ocupacion.html', target);
        });
        this._initDropdown('socioeconomicoDropdown', 'socioeconomicoTrigger', (target) => {
            this.navigator.navigateTo('socioeconomico.html', target);
        });
    }

    _initDropdown(dropdownId, triggerId, onItemClick) {
        const dropdown = document.getElementById(dropdownId);
        const trigger = document.getElementById(triggerId);
        const menu = dropdown?.querySelector('.dropdown-menu-custom');
        const items = dropdown?.querySelectorAll('.dropdown-item, .dropdown-subitem');
        if (!dropdown || !trigger || !menu || !items?.length) return;

        dropdown.addEventListener('mouseenter', () => {
            document.querySelectorAll('.modulo-dropdown.open').forEach(d => {
                if (d !== dropdown) d.classList.remove('open');
            });
            dropdown.classList.add('open');
        });

        dropdown.addEventListener('mouseleave', () => {
            dropdown.classList.remove('open');
        });

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const shouldOpen = !dropdown.classList.contains('open');
            document.querySelectorAll('.modulo-dropdown.open').forEach(d => {
                if (d !== dropdown) d.classList.remove('open');
            });
            dropdown.classList.toggle('open', shouldOpen);
        });

        items.forEach(item => {
            item.addEventListener('click', (e) => {
                const target = item.dataset.target;
                if (!target) return;

                e.stopPropagation();
                items.forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                if (typeof onItemClick === 'function') {
                    onItemClick(target, item);
                }
                dropdown.classList.remove('open');
            });
        });
    }

    _onLegalItemClick(target) {
        const mode = this._resolveMode(target);
        if (mode) {
            const condicionantesGroup = mode === 'CONDICIONANTES'
                ? (CONDICIONANTES_GROUPS[target] || null)
                : null;
            const labelMode = target === 'Condicionantes' ? 'CONDICIONANTES' : mode;
            this.state.set('currentMode', mode);
            this.eventBus.emit('mode:changed', { mode, subLayerIndex: 0, condicionantesGroup, labelMode });
        }
    }

    _resolveMode(target) {
        if (CONDICIONANTES_TARGETS.has(target)) return 'CONDICIONANTES';
        const reverse = {};
        Object.keys(LEGAL_PAGES).forEach(k => { reverse[LEGAL_PAGES[k]] = k; });
        return reverse[target] || null;
    }

    syncActive(data) {
        const mode = typeof data === 'string' ? data : data?.mode;
        const condicionantesGroup = typeof data === 'object' ? data?.condicionantesGroup : null;
        const items = document.querySelectorAll('#dropdownLegal .dropdown-item, #dropdownLegal .dropdown-subitem');
        if (!items.length) return;

        items.forEach(i => i.classList.remove('active'));

        if (mode === 'CONDICIONANTES' && condicionantesGroup) {
            if (data?.labelMode === 'CONDICIONANTES') {
                items.forEach(i => {
                    if (i.dataset.target === 'Condicionantes') i.classList.add('active');
                });
                return;
            }
            const target = Object.entries(CONDICIONANTES_GROUPS)
                .find(([, group]) => group === condicionantesGroup)?.[0];
            if (target) {
                items.forEach(i => {
                    if (i.dataset.target === target) i.classList.add('active');
                });
            }
            return;
        }

        const target = LEGAL_PAGES[mode];
        if (target) {
            items.forEach(i => {
                if (i.dataset.target === target) i.classList.add('active');
            });
        }
    }

    _bindGlobalClose() {
        document.addEventListener('click', (e) => {
            document.querySelectorAll('.modulo-dropdown.open').forEach(dropdown => {
                if (!dropdown.contains(e.target)) {
                    dropdown.classList.remove('open');
                }
            });
        });
    }
}
