/**
 * ModeConfig.js — Configuración de Modos de Contexto Legal
 *
 * Define los modos disponibles y su relación con la UI (dropdowns, navbar, badges).
 *
 * Responsabilidad:
 *   - Mapeo de modo → label mostrado en UI
 *   - Mapeo de modo → botón de navbar activo
 *   - Mapeo de dropdown → modo
 *   - Resolver modo desde URL (tab parameter)
 *
 * Uso:
 *   modeConfig.getLabel('DETERMINANTES') → 'Determinantes'
 *   modeConfig.resolveFromTab('Ambientales') → 'AMBIENTALES'
 */
export class ModeConfig {
    constructor() {
        this.labels = {
            DETERMINANTES: 'Determinantes',
            DETERMINANTES_LINEA: 'Determinantes Línea',
            DETERMINANTES_PUNTO: 'Determinantes Punto',
            CONDICIONANTES: 'Condicionantes',
            AMBIENTALES: 'Ambientales',
            SOBERANIA_ALIMENTARIA: 'Soberanía Alimentaria',
            PATRIMONIALES: 'Patrimoniales',
            INFRAESTRUCTURA: 'Infraestructura',
            AREAS_METROPOLITANAS_SUBURBANIZACION: 'Áreas Metropolitanas y Suburbanización',
            PROYECTOS_TURISTICOS_ESPECIALES: 'Proyectos Turísticos Especiales'
        };

        this.condicionantesLabels = {
            factores_condicionantes: 'Factores Condicionantes',
            territorios_colectivos: 'Territorios Colectivos',
            recursos_no_renovables: 'Exploración y Explotación de Recursos No Renovables',
            acuerdo_final_paz: 'Acuerdo Final de Paz',
            zomac: 'Zonas más Afectadas por el Conflicto Armado'
        };

        this.navbarMap = {
            DETERMINANTES: 'btnDeterminantes',
            CONDICIONANTES: 'btnCondicionantes'
        };

        this.dropdownMap = {
            'Determinantes': 'DETERMINANTES',
            'Determinantes Linea': 'DETERMINANTES_LINEA',
            'Determinantes Línea': 'DETERMINANTES_LINEA',
            'Determinantes Punto': 'DETERMINANTES_PUNTO',
            'Condicionantes': 'CONDICIONANTES',
            'Ambientales': 'AMBIENTALES',
            'Soberanía Alimentaria': 'SOBERANIA_ALIMENTARIA',
            'Patrimoniales': 'PATRIMONIALES',
            'patrimoniales': 'PATRIMONIALES',
            'Infraestructura': 'INFRAESTRUCTURA',
            'infraestructura': 'INFRAESTRUCTURA',
            'Áreas Metropolitanas Suburbanización': 'AREAS_METROPOLITANAS_SUBURBANIZACION',
            'Áreas Metropolitanas y Suburbanización': 'AREAS_METROPOLITANAS_SUBURBANIZACION',
            'areas_metropolitanas_suburbanizacion': 'AREAS_METROPOLITANAS_SUBURBANIZACION',
            'Proyectos Turísticos Especiales e infraestructura asociada': 'PROYECTOS_TURISTICOS_ESPECIALES',
            'proyectos_turisticos_especiales_e_infraestructura_asociada': 'PROYECTOS_TURISTICOS_ESPECIALES'
        };

        this.tabToMode = {
            'Determinantes': 'DETERMINANTES',
            'Determinantes Polígono': 'DETERMINANTES',
            'Determinantes Linea': 'DETERMINANTES_LINEA',
            'Determinantes Línea': 'DETERMINANTES_LINEA',
            'Determinantes Punto': 'DETERMINANTES_PUNTO',
            'Condicionantes': 'CONDICIONANTES',
            'Ambientales': 'AMBIENTALES',
            'Soberanía Alimentaria': 'SOBERANIA_ALIMENTARIA',
            'Patrimoniales': 'PATRIMONIALES',
            'patrimoniales': 'PATRIMONIALES',
            'Infraestructura': 'INFRAESTRUCTURA',
            'infraestructura': 'INFRAESTRUCTURA',
            'Áreas Metropolitanas Suburbanización': 'AREAS_METROPOLITANAS_SUBURBANIZACION',
            'Áreas Metropolitanas y Suburbanización': 'AREAS_METROPOLITANAS_SUBURBANIZACION',
            'areas_metropolitanas_suburbanizacion': 'AREAS_METROPOLITANAS_SUBURBANIZACION',
            'Proyectos Turísticos Especiales e infraestructura asociada': 'PROYECTOS_TURISTICOS_ESPECIALES',
            'proyectos_turisticos_especiales_e_infraestructura_asociada': 'PROYECTOS_TURISTICOS_ESPECIALES'
        };
    }

    getLabel(mode) {
        return this.labels[mode] || mode || 'Vista';
    }

    getContextLabel(mode, options = {}) {
        if (mode === 'CONDICIONANTES' && options.condicionantesGroup) {
            return this.condicionantesLabels[options.condicionantesGroup] || this.getLabel(mode);
        }
        return this.getLabel(mode);
    }

    resolveFromTab(tab) {
        return this.tabToMode[tab] || null;
    }

    resolveFromDropdown(target) {
        return this.dropdownMap[target] || null;
    }
}
