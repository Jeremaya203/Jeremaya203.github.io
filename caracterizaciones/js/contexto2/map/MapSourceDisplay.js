/**
 * MapSourceDisplay.js — Muestra la Fuente de la Capa Activa
 *
 * Consulta el campo 'Fuente' de la capa activa y lo muestra
 * en el elemento #mapSource.
 *
 * Responsabilidad:
 *   - queryFeatures para obtener el atributo 'Fuente'
 *   - Actualizar el DOM con el texto de la fuente
 *
 * Dependencias:
 *   - State.js
 *   - ArcGIS JS API (queryFeatures)
 */
export class MapSourceDisplay {
    constructor(state) {
        this.state = state;
    }

    update(layer) {
        // layer.queryFeatures({ where: '1=1', outFields: ['Fuente'], num: 1 })
        //   .then(result => { ... });
    }
}
