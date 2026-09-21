/* Mapa del módulo: creación, capas e interacción.
 *
 * Vive aparte de uso-suelo.js para que ningún archivo del módulo pase de 500
 * líneas: aquí está el "cómo se dibuja y cómo responde el mapa", allá el flujo
 * de la consulta. Este archivo no sabe nada de la API ni del reporte; avisa de
 * lo que el usuario hace mediante los dos callbacks de `iniciarMapa`.
 *
 * El motor es MapLibre GL, el mismo de Modulo_Determinantes.html y
 * Modulo_Indicadores.html.
 *
 * El mapa base NO es OpenStreetMap. Comprobado el 2026-09-21:
 * tile.openstreetmap.org responde HTTP 200 pero devuelve, para cualquier
 * coordenada, la misma imagen de 6.987 bytes con el texto "403 Access blocked
 * - App is not following the tile usage policy of OpenStreetMap's
 * volunteer-run servers". Cuatro teselas de zooms y lugares distintos salieron
 * idénticas byte a byte. Como el bloqueo viaja con código 200, MapLibre no lo
 * detecta como error y lo pinta tal cual: el usuario ve un muro de carteles.
 *
 * Se usa en su lugar ArcGIS Online de Esri, que ya está en la lista blanca de
 * `_headers` (services.arcgisonline.com) y ya lo consume caracterizaciones/.
 *
 * OJO con el orden de la URL: ArcGIS REST es /tile/{z}/{fila}/{columna}, es
 * decir {z}/{y}/{x}. Escribirlo como {z}/{x}/{y} devuelve teselas de otro
 * lugar del planeta sin dar ningún error.
 */

import { escapar, formatoArea } from "./utilidades.js";

const ID_PREDIOS = "predios";
const ID_SELECCION = "seleccion";

/** Encuadre inicial sobre el país, antes de elegir municipio. */
export const VISTA_INICIAL = { center: [-74.1, 4.6], zoom: 4.4 };

const ESRI = "https://services.arcgisonline.com/ArcGIS/rest/services";
const ATRIBUCION_ESRI =
  'Mapa base &copy; <a href="https://www.esri.com/">Esri</a> y colaboradores';

/**
 * Mapas base disponibles. El de calles va primero porque es el que permite
 * reconocer dónde se está (veredas, vías, topónimos); la ortoimagen queda a un
 * clic para quien necesite el contexto visual del terreno, que es la "imagen o
 * base cartográfica de referencia" que menciona la sección 03 de la HU.
 */
export const MAPAS_BASE = [
  { id: "callejero", nombre: "Callejero", ruta: `${ESRI}/World_Topo_Map/MapServer` },
  { id: "gris", nombre: "Gris", ruta: `${ESRI}/Canvas/World_Light_Gray_Base/MapServer` },
  { id: "imagen", nombre: "Imagen", ruta: `${ESRI}/World_Imagery/MapServer` },
];

const BASE_POR_DEFECTO = MAPAS_BASE[0];

function fuenteBase(mapaBase) {
  return {
    type: "raster",
    tiles: [`${mapaBase.ruta}/tile/{z}/{y}/{x}`],
    tileSize: 256,
    maxzoom: 19,
    attribution: ATRIBUCION_ESRI,
  };
}

/** Colección vacía; se reutiliza para limpiar una fuente. */
export const VACIO = { type: "FeatureCollection", features: [] };

const AZUL = "#4a90d9";
const AMBAR = "#f4a833";

let mapa = null;
let emergente = null;

/**
 * Crea el mapa y engancha la interacción.
 *
 * @param {object} manejadores
 * @param {(numeroPredial: string) => void} manejadores.alElegirPredio
 *        Clic sobre un predio dibujado.
 * @param {(lon: number, lat: number) => void} manejadores.alElegirPunto
 *        Clic fuera de la capa: es la "selección directa sobre el mapa" de la HU.
 */
export function iniciarMapa({ alElegirPredio, alElegirPunto }) {
  mapa = new maplibregl.Map({
    container: "mapa",
    style: {
      version: 8,
      sources: { base: fuenteBase(BASE_POR_DEFECTO) },
      layers: [{ id: "base", type: "raster", source: "base" }],
    },
    ...VISTA_INICIAL,
    attributionControl: false,
  });

  mapa.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");
  mapa.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: "metric" }), "bottom-right");
  mapa.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

  emergente = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10 });

  mapa.on("load", () => {
    mapa.addSource(ID_PREDIOS, { type: "geojson", data: VACIO });
    mapa.addSource(ID_SELECCION, { type: "geojson", data: VACIO });

    mapa.addLayer({
      id: "predios-relleno",
      type: "fill",
      source: ID_PREDIOS,
      paint: { "fill-color": AZUL, "fill-opacity": 0.14 },
    });
    mapa.addLayer({
      id: "predios-borde",
      type: "line",
      source: ID_PREDIOS,
      paint: { "line-color": AZUL, "line-width": 0.7, "line-opacity": 0.75 },
    });
    // Realce al pasar el puntero: hace evidente que la capa es clicable.
    mapa.addLayer({
      id: "predios-hover",
      type: "fill",
      source: ID_PREDIOS,
      paint: { "fill-color": AZUL, "fill-opacity": 0.3 },
      filter: ["==", "numero_predial", ""],
    });
    mapa.addLayer({
      id: "seleccion-relleno",
      type: "fill",
      source: ID_SELECCION,
      paint: { "fill-color": AMBAR, "fill-opacity": 0.45 },
    });
    mapa.addLayer({
      id: "seleccion-borde",
      type: "line",
      source: ID_SELECCION,
      paint: { "line-color": AMBAR, "line-width": 2.5 },
    });

    mapa.on("mousemove", "predios-relleno", (evento) => {
      const rasgo = evento.features?.[0];
      if (!rasgo) return;
      mapa.getCanvas().style.cursor = "pointer";
      mapa.setFilter("predios-hover", ["==", "numero_predial", rasgo.properties.numero_predial]);
      emergente.setLngLat(evento.lngLat).setHTML(resumen(rasgo.properties)).addTo(mapa);
    });

    mapa.on("mouseleave", "predios-relleno", () => {
      mapa.getCanvas().style.cursor = "";
      mapa.setFilter("predios-hover", ["==", "numero_predial", ""]);
      emergente.remove();
    });

    mapa.on("click", "predios-relleno", (evento) => {
      const rasgo = evento.features?.[0];
      if (rasgo) alElegirPredio(rasgo.properties.numero_predial);
    });

    mapa.on("click", (evento) => {
      const encima = mapa.queryRenderedFeatures(evento.point, { layers: ["predios-relleno"] });
      if (encima.length === 0) alElegirPunto(evento.lngLat.lng, evento.lngLat.lat);
    });
  });

  /* MapLibre mide su contenedor una sola vez, al crearse. En la disposición de
     una columna (pantallas estrechas) ese contenedor todavía no tiene su alto
     definitivo, y el mapa se quedaba con un lienzo desfasado: la atribución y
     la escala aparecían, pero no se pintaba ninguna tesela. */
  new ResizeObserver(() => mapa.resize()).observe(document.getElementById("mapa"));
  montarSelectorDeBase();

  return mapa;
}

/**
 * Selector de mapa base.
 *
 * Cambia la FUENTE, no el estilo completo: `setStyle` borraría las capas de
 * predios y la selección, obligando a volver a pedirlas al servidor.
 */
function montarSelectorDeBase() {
  const contenedor = document.getElementById("selectorBase");
  if (!contenedor) return;

  for (const base of MAPAS_BASE) {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "base-opcion";
    boton.textContent = base.nombre;
    boton.setAttribute("aria-pressed", String(base.id === BASE_POR_DEFECTO.id));
    boton.addEventListener("click", () => {
      if (boton.getAttribute("aria-pressed") === "true") return;
      cambiarBase(base);
      contenedor
        .querySelectorAll(".base-opcion")
        .forEach((otro) => otro.setAttribute("aria-pressed", String(otro === boton)));
    });
    contenedor.append(boton);
  }
}

function cambiarBase(base) {
  const fuente = mapa.getSource("base");
  if (!fuente) return;
  fuente.setTiles([`${base.ruta}/tile/{z}/{y}/{x}`]);
}

function resumen(propiedades) {
  const area = Number(propiedades.area_terreno);
  return (
    `<strong>${escapar(propiedades.numero_predial)}</strong>` +
    (propiedades.direccion ? `<br>${escapar(propiedades.direccion)}` : "") +
    (Number.isFinite(area) ? `<br>${formatoArea.format(area)} m&sup2;` : "")
  );
}

/** Pinta la capa predial del municipio. */
export function dibujarCapa(geojson) {
  mapa?.getSource(ID_PREDIOS)?.setData(geojson);
}

/** Resalta el predio confirmado, o lo borra si se pasa null. */
export function dibujarSeleccion(geometria) {
  mapa
    ?.getSource(ID_SELECCION)
    ?.setData(geometria ? { type: "Feature", geometry: geometria, properties: {} } : VACIO);
}

/** Acerca el mapa a un recuadro [oeste, sur, este, norte]. */
export function encuadrar(bbox, relleno = 60) {
  mapa?.fitBounds(
    [
      [bbox[0], bbox[1]],
      [bbox[2], bbox[3]],
    ],
    { padding: relleno, duration: 700, maxZoom: 17 },
  );
}

/** Vuelve al encuadre inicial del país. */
export function volverAlInicio() {
  mapa?.flyTo({ ...VISTA_INICIAL, duration: 700 });
}

/**
 * Recuadro que cubre una FeatureCollection.
 *
 * Se calcula aquí y no con fitBounds sobre la geometría porque MapLibre no
 * expone el bbox de una fuente hasta que la ha teselado.
 */
export function bboxDeColeccion(geojson) {
  let oeste = 180;
  let sur = 90;
  let este = -180;
  let norte = -90;
  const recorrer = (nodo) => {
    if (typeof nodo[0] === "number") {
      oeste = Math.min(oeste, nodo[0]);
      este = Math.max(este, nodo[0]);
      sur = Math.min(sur, nodo[1]);
      norte = Math.max(norte, nodo[1]);
      return;
    }
    nodo.forEach(recorrer);
  };
  geojson.features.forEach((rasgo) => recorrer(rasgo.geometry.coordinates));
  return oeste <= este ? [oeste, sur, este, norte] : null;
}
