/**
 * DomainConfig.js — Dominios, Paletas de Colores y Constantes
 *
 * Contiene todos los dominios (mapeo código → nombre) y paletas de colores
 * utilizadas por los renderers de mapa y gráficos.
 *
 * Responsabilidad:
 *   - DETERM_DOMAIN: tipos de determinante (1=Ambientales, 2=Soberanía, etc.)
 *   - categoryColors: colores por categoría de determinante
 *   - sinapMap: códigos SINAP → nombre
 *   - fallbackLabels: etiquetas de respaldo para subtipos
 *   - CLASIFICACION_SUELO_PALETTE: colores para ordenamiento
 *
 * Dependencias:
 *   - Ninguna. Es datos puros.
 */
export class DomainConfig {
    constructor() {
        this.DETERM_DOMAIN = {
            1: '1_Ambientales',
            2: 'Soberanía Alimentaria',
            3: '3_Patrimoniales',
            4: '4_Infraestructura',
            5: '5_Áreas Metropolitanas y Suburbanización',
            6: '6_Proyectos Turísticos Especiales'
        };

        this.categoryColors = {
            1: '#70ad47',
            2: '#ffc000',
            3: '#7030a0',
            4: '#a6a6a6',
            5: '#ed4de0',
            6: '#4472c4'
        };

        this.sinapMap = {
            101: 'Parque Nacional Natural',
            102: 'Reserva Forestal Protectora Nacional',
            103: 'Parque Natural Regional',
            104: 'Reserva Natural de la Sociedad Civil',
            105: 'Distrito de Conservación de Suelos',
            106: 'Área de Recreación',
            108: 'Distrito Regional de Manejo Integrado',
            110: 'Reserva Nacional Natural',
            111: 'Reserva Forestal Protectora Regional',
            112: 'Santuario de Flora y Fauna',
            113: 'Santuario de Flora',
            114: 'Santuario de Fauna',
            115: 'Vía Parque'
        };

        this.CLASIFICACION_SUELO_PALETTE = {
            '1': { label: 'Urbano', fillColor: 'rgba(204, 140, 0, 1)' },
            '2': { label: 'Rural', fillColor: 'rgba(233, 255, 190, 1)' },
            '3': { label: 'Expansión urbana', fillColor: 'rgba(166, 13, 13, 1)' }
        };
    }
}
