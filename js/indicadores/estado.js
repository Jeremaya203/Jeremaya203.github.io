/* Estado compartido del modulo de indicadores. Mismo criterio que en determinantes:
   las lecturas no se tocaron (un `import` de un `export let` es un enlace VIVO) y solo
   las asignaciones pasan por setter, porque un enlace importado es de solo lectura. */

export const API = window.OOT_API_BASE || '';

// Una sola implementacion de escape en todo el sitio: config.js -> OOT.escapeHtml.
// Las copias locales de esta funcion (habia cinco) divergian entre si; una solo
// cubria & < > y dejaba pasar comillas, que es exactamente lo que rompe un atributo.
export const escapeHtml = (s) => window.OOT.escapeHtml(s);

export let mapa = null;

export let catalogo = {};

export let indicadorActivo = null;

export let capasActivas = {};

export let datosActuales = null;

export let chartInstance = null;

export let _chartRafId = null;

export let _mapHandlers = []; // {event, layer, fn}

export let _nacionalPopup = null;

export let deptActivo = '47';

export let _fetchToken = 0;

export let escalaActiva = 'nacional';

export const _municipiosCache = {};

export const NOMBRES_DEPTS = {
  '05':'Antioquia','08':'Atlántico','11':'Bogotá D.C.','13':'Bolívar','15':'Boyacá',
  '17':'Caldas','18':'Caquetá','19':'Cauca','20':'Cesar','23':'Córdoba','25':'Cundinamarca',
  '27':'Chocó','41':'Huila','44':'La Guajira','47':'Magdalena','50':'Meta','52':'Nariño',
  '54':'Norte de Santander','63':'Quindío','66':'Risaralda','68':'Santander','70':'Sucre',
  '73':'Tolima','76':'Valle del Cauca','81':'Arauca','85':'Casanare','86':'Putumayo',
  '88':'San Andrés','91':'Amazonas','94':'Guainía','95':'Guaviare','97':'Vaupés','99':'Vichada'
};

export const STAT_PRINCIPAL = {
  'cobveg':                'pct_natural',
  'amenaza_masa':          'total_personas',
  'amenaza_inundacion':    'total_personas',
  'priorizacion_agro':     'total_ha',
  'brecha_expansion':      'd_fuera_pct',
  'brecha_subutilizacion': 'd_dentro_pct',
  'deforestacion_pnn':     'area_pnn_terrestre_ha',
  'tensiones_territoriales':'total_conflictos',
};

export const PALETA_CHART = ['#0891b2','#0e7490','#06b6d4','#22d3ee','#67e8f9','#155e75','#164e63','#a5f3fc'];

export const INDICADORES_CON_CLICK = new Set(['cobveg','amenaza_masa','amenaza_inundacion','priorizacion_agro','deforestacion_pnn']);

// Indicadores cuya geometría se sirve por VECTOR TILES (PMTiles, resolución completa)
// en vez del GeoJSON del cache. Ver scripts/generar_tiles_src.py + generar_pmtiles.py.
export const INDICADORES_PMTILES = new Set(['amenaza_masa', 'amenaza_inundacion', 'priorizacion_agro', 'tensiones_territoriales']);

// Estos se sirven POR DEPARTAMENTO (un .pmtiles por dept: <id>_<dep>.pmtiles) por ser
// demasiado grandes como archivo único. El resto usa un solo <id>.pmtiles.
// tensiones: 548k features → per-dept obligatorio.
export const INDICADORES_PMTILES_POR_DEPT = new Set(['amenaza_masa', 'tensiones_territoriales']);

// Construye el coloreador del choropleth NACIONAL a partir de la leyenda PROPIA del
// indicador, para que cada uno use SUS colores (no una rampa verde genérica) y la leyenda
// mostrada coincida exactamente con el mapa.
//  · Leyenda de RANGOS de valor (todas las etiquetas traen número, p.ej. cobveg
//    "0–20%"…"80–100%") → step por umbral con los colores de la leyenda (esquema exacto).
//  · Leyenda CATEGÓRICA (amenaza/tensiones/brecha…) → rampa por cuantil usando la PALETA
//    del indicador, con leyenda de rangos calculados a partir de los datos.
// Rampas secuenciales TEMÁTICAS (claro→oscuro = menos→más) para el choropleth NACIONAL
// de indicadores con leyenda CATEGÓRICA. Las paletas categóricas (Alta/Media/Baja,
// Agrícola/Ganadera/…) son cualitativas y no comunican magnitud; aquí cada indicador usa
// un tono acorde a su tema. Los de RANGO de valor (cobveg) conservan su escala exacta.
export const RAMPAS_NACIONAL = {
  amenaza_masa:             ['#feedde', '#fdbe85', '#fd8d3c', '#e6550d', '#a63603'], // naranjas (movimientos en masa)
  amenaza_inundacion:       ['#eff3ff', '#bdd7e7', '#6baed6', '#3182bd', '#08519c'], // azules (inundación)
  priorizacion_agro:        ['#edf8e9', '#bae4b3', '#74c476', '#31a354', '#006d2c'], // verdes (agropecuario)
  tensiones_territoriales:  ['#fee5d9', '#fcae91', '#fb6a4a', '#de2d26', '#a50f15'], // rojos (conflictos)
  brecha_expansion:         ['#f2f0f7', '#cbc9e2', '#9e9ac8', '#756bb1', '#54278f'], // morados (urbano-catastral)
  brecha_subutilizacion:    ['#edf8fb', '#b3cde3', '#8c96c6', '#8856a7', '#810f7c'], // morado-azul (urbano-catastral)
  deforestacion_pnn:        ['#edf8e9', '#bae4b3', '#74c476', '#31a354', '#006d2c'], // verdes (áreas protegidas)
};

export const RAMPA_NACIONAL_DEFECTO = ['#d4ede7', '#7de0c4', '#27a880', '#1a6b55', '#0d3d30']; // teal

export function setMapa(valor) { mapa = valor; }
export function setCatalogo(valor) { catalogo = valor; }
export function setIndicadorActivo(valor) { indicadorActivo = valor; }
export function setCapasActivas(valor) { capasActivas = valor; }
export function setDatosActuales(valor) { datosActuales = valor; }
export function setChartInstance(valor) { chartInstance = valor; }
export function setChartRafId(valor) { _chartRafId = valor; }
export function setMapHandlers(valor) { _mapHandlers = valor; }
export function setNacionalPopup(valor) { _nacionalPopup = valor; }
export function setDeptActivo(valor) { deptActivo = valor; }
/* `_fetchToken` se incrementaba con `++_fetchToken` en los dos sitios que lanzan una
   carga. Sobre un enlace importado eso es un TypeError en ejecucion ("Assignment to
   constant variable"), y no lo detecta ni el analisis del grafo de modulos ni
   `node --check`: solo se veria al pulsar un indicador. El incremento vive aqui. */
export function siguienteFetchToken() { return ++_fetchToken; }
export function setEscalaActiva(valor) { escalaActiva = valor; }
