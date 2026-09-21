/* Comprueba el grafo de modulos ES sin navegador.
 *
 * Importar el punto de entrada obliga a Node a resolver TODO el grafo de imports y a
 * verificar que cada nombre importado exista de verdad en el modulo de origen. Es lo
 * que detecta el fallo tipico de partir un archivo: mover una funcion y dejar atras el
 * ayudante del que dependia. En un script clasico eso no daba error hasta que alguien
 * pulsaba el boton; aqui revienta al importar.
 *
 * Lo que NO comprueba: identificadores indefinidos dentro de cuerpos de funcion que no
 * se llegan a ejecutar. Para eso sigue haciendo falta la revision en navegador.
 *
 * Uso: node scripts/comprobar_modulos.mjs js/determinantes/index.js [...]
 */
import { pathToFileURL } from 'node:url';
import path from 'node:path';

// DOM y librerias de mapa simulados: lo justo para que el codigo de nivel superior
// corra. No se simula comportamiento, solo presencia.
const nodo = () => new Proxy(function () {}, {
  get: (t, k) => (k === 'style' || k === 'classList' || k === 'dataset' ? nodo()
                : k === 'innerHTML' || k === 'textContent' || k === 'value' ? ''
                : k === Symbol.toPrimitive ? () => '' : nodo()),
  set: () => true,
  apply: () => nodo(),
});
globalThis.document = {
  addEventListener() {}, createElement: nodo, getElementById: nodo,
  querySelector: nodo, querySelectorAll: () => [], body: nodo(),
  documentElement: nodo(), head: nodo(), cookie: '', readyState: 'loading',
};
globalThis.window = new Proxy({
  OOT: new Proxy({ log() {}, loadShell() {}, registrar() {}, registrarTodos() {},
                   get() {}, post() {} }, { get: (t, k) => t[k] ?? (() => {}) }),
  location: { search: '', href: 'http://localhost/', hash: '' },
  addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }),
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
}, { get: (t, k) => (k in t ? t[k] : undefined), set: (t, k, v) => (t[k] = v, true) });
for (const k of ['navigator', 'localStorage', 'sessionStorage', 'location', 'matchMedia',
                 'addEventListener', 'requestAnimationFrame', 'cancelAnimationFrame',
                 'alert', 'confirm', 'getComputedStyle', 'Blob', 'URL', 'FileReader',
                 'AbortController', 'IntersectionObserver', 'ResizeObserver']) {
  if (globalThis[k] === undefined) globalThis[k] = globalThis.window[k] ?? (() => nodo());
}
globalThis.maplibregl = undefined;   // el codigo debe tolerar que no este
globalThis.Chart = undefined;
globalThis.OOT = globalThis.window.OOT;

let fallos = 0;
for (const rel of process.argv.slice(2)) {
  const url = pathToFileURL(path.resolve(rel)).href;
  try {
    await import(url);
    console.log(`  [OK     ] ${rel}: el grafo de modulos resuelve`);
  } catch (e) {
    fallos++;
    console.log(`  [FALLO  ] ${rel}: ${e.constructor.name}: ${e.message.split('\n')[0]}`);
  }
}
process.exit(fallos ? 1 : 0);
