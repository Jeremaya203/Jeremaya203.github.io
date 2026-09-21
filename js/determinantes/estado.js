/* Estado compartido del modulo de determinantes.

   Va en un modulo propio porque lo leen casi todos los demas. Las lecturas NO se
   tocaron al partir el archivo: un `import` de un `export let` es un enlace VIVO, asi
   que `mapa` sigue viendo el valor actual desde cualquier modulo. Lo que un enlace
   importado no permite es ASIGNAR (es de solo lectura), y de ahi los setters: son las
   27 asignaciones que habia en el monolito, ni una mas.

   Asignar directamente `mapa = x` desde otro modulo no falla en silencio: es un
   TypeError en ejecucion, que es justo lo que se quiere. */

// ===== VARIABLES GLOBALES =====
export const API = window.OOT_API_BASE || '';

export let mapa = null;

export let zonaGeoJSON = null;

export let rutaZona = null;

export let drawMode = false;

export let drawCoords = [];

export let reporteTexto = '';

export let datosResultado = null;

export let modoActual = 'consulta_area';

export let _popupHandlers = []; // {event, layer, fn}

export let _detGeoJSON = null;  // FeatureCollection de determinantes renderizadas (para resaltar)

// ── Visibilidad POR-DETERMINANTE (ojo de cada ítem del listado) ────────────────
export let _detOcultos = [];   // [{determ, nomdet}] de los determinantes apagados

// Carga perezosa de shp-write (vendorizado en el repo → offline-friendly, sin CDN).
export let _shpWritePromise = null;

export function setMapa(valor) { mapa = valor; }
export function setZonaGeoJSON(valor) { zonaGeoJSON = valor; }
export function setRutaZona(valor) { rutaZona = valor; }
export function setDrawMode(valor) { drawMode = valor; }
export function setDrawCoords(valor) { drawCoords = valor; }
export function setReporteTexto(valor) { reporteTexto = valor; }
export function setDatosResultado(valor) { datosResultado = valor; }
export function setModoActual(valor) { modoActual = valor; }
export function setPopupHandlers(valor) { _popupHandlers = valor; }
export function setDetGeoJSON(valor) { _detGeoJSON = valor; }
export function setDetOcultos(valor) { _detOcultos = valor; }
export function setShpWritePromise(valor) { _shpWritePromise = valor; }
