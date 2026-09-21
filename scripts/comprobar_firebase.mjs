/* Comprueba a QUE proyecto de Firebase apunta cada ambiente, ejecutando `config.js`.
 *
 * `config.js` elige el proyecto por nombre de host: `localhost` y `127.0.0.1` usan el de
 * desarrollo (`colombiaot2`) y todo lo demas el institucional (`geovisor-igac`). Leer eso
 * a ojo no basta: un error en la tabla POR_HOST publicaria el sitio institucional contra
 * el proyecto de desarrollo, y no fallaria nada — simplemente ningun usuario real podria
 * entrar, o entrarian usuarios que no deberian.
 *
 * Se ejecuta el archivo de verdad en un contexto de `vm` con el DOM simulado, en vez de
 * buscar cadenas con una expresion regular: lo que se comprueba es el resultado, no que
 * el codigo se parezca a lo que se espera.
 *
 * Uso: node scripts/comprobar_firebase.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// (host, projectId esperado, authDomain esperado, OOT_API_BASE esperado)
//
// La columna de API es la que impide que vuelva a pasar lo de septiembre: desde `localhost`
// el frontend hablaba con el backend de PRODUCCION, asi que lo que se probaba en local no
// salia del codigo que se tenia delante.
const CASOS = [
  ['localhost',                      'colombiaot2',   'colombiaot2.firebaseapp.com',
   'http://localhost:8001'],
  ['127.0.0.1',                      'colombiaot2',   'colombiaot2.firebaseapp.com',
   'http://localhost:8001'],
  ['colombiaot.igac.gov.co',         'geovisor-igac', 'geovisor-igac.firebaseapp.com',
   'https://redgeodesica-cg.igac.gov.co'],
  ['pruebas-colombiaot.igac.gov.co', 'geovisor-igac', 'geovisor-igac.firebaseapp.com',
   'https://redgeodesica-cg.igac.gov.co'],
  ['jeremaya203.github.io',          'geovisor-igac', 'geovisor-igac.firebaseapp.com',
   'https://redgeodesica-cg.igac.gov.co'],
];

function resolverPara(hostname) {
  const nodo = () => new Proxy(function () {}, {
    get: (t, k) => (k === Symbol.toPrimitive ? () => '' : nodo()),
    set: () => true,
    apply: () => nodo(),
  });
  const ctx = {
    console: { warn() {}, error() {}, log() {} },
    setTimeout() {},
    sessionStorage: { getItem: () => null, setItem() {} },
    document: {
      addEventListener() {}, createElement: nodo, getElementById: nodo,
      querySelector: nodo, querySelectorAll: () => [], body: null,
      documentElement: nodo, head: nodo,
    },
    navigator: { userAgent: '' },
  };
  ctx.window = ctx;
  ctx.self = ctx;
  ctx.top = ctx;                 // no estamos en un iframe
  ctx.location = {
    hostname,
    search: '',
    href: `http://${hostname}/`,
    origin: `http://${hostname}`,
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(RAIZ, 'config.js'), 'utf8'), ctx,
                  { filename: 'config.js' });
  return { firebase: ctx.OOT_FIREBASE, api: ctx.OOT_API_BASE };
}

let fallos = 0;
for (const [host, proyecto, dominio, apiEsperada] of CASOS) {
  let conf, api;
  try {
    ({ firebase: conf, api } = resolverPara(host));
  } catch (e) {
    console.log(`  [FALLO  ] ${host}: config.js reventó al ejecutarse: ${e.message}`);
    fallos++;
    continue;
  }
  const okFb = conf && conf.projectId === proyecto && conf.authDomain === dominio;
  const okApi = api === apiEsperada;
  if (!okFb || !okApi) fallos++;
  const provs = conf && conf.proveedores ? conf.proveedores.join('+') : 'los seis por defecto';
  console.log(`  [${okFb && okApi ? 'OK     ' : 'FALLO  '}] ${host.padEnd(32)} -> `
              + `${conf ? conf.projectId : '(nada)'} · ${provs}`);
  console.log(`  ${' '.repeat(11)}${' '.repeat(32)}    API: ${api || '(vacia)'}`
              + (okApi ? '' : `   <-- se esperaba ${apiEsperada}`));
}

/* Segunda parte: que la barrera EXPLIQUE por que no puede autenticar, en vez de dejar
 * pasar el `auth/operation-not-supported-in-this-environment` de Firebase, que no le dice
 * al usuario que hacer. Los dos casos reales son abrir el HTML con doble clic (`file://`)
 * y tener el almacenamiento del sitio bloqueado. */
function diagnosticoCon({ protocol, hostname, storageOk }) {
  const nodo = () => new Proxy(function () {}, {
    get: (t, k) => (k === Symbol.toPrimitive ? () => '' : nodo()),
    set: () => true, apply: () => nodo(),
  });
  const mensajes = [];
  const denegar = () => { const e = new Error('denied'); e.name = 'SecurityError'; throw e; };
  const ctx = {
    console: { warn() {}, log() {}, error: (...a) => mensajes.push(a.join(' ')) },
    setTimeout() {},
    sessionStorage: { getItem: () => null, setItem() {} },
    localStorage: storageOk ? { setItem() {}, removeItem() {} }
                            : { setItem: denegar, removeItem() {} },
    document: {
      addEventListener() {}, createElement: nodo, getElementById: nodo, querySelector: nodo,
      querySelectorAll: () => [], body: { appendChild() {}, style: {} },
      documentElement: nodo, head: nodo,
    },
    navigator: { userAgent: '' },
  };
  ctx.window = ctx; ctx.self = ctx; ctx.top = ctx;
  ctx.location = { protocol, hostname, search: '', href: `${protocol}//${hostname}/`,
                   origin: `${protocol}//${hostname}` };
  // Firebase simulado, sin sesion: obliga al guardian a llegar hasta startLogin.
  ctx.firebase = {
    apps: [],
    initializeApp() { ctx.firebase.apps.push(1); },
    auth: Object.assign(() => ({ onAuthStateChanged: (cb) => cb(null) }), {
      GoogleAuthProvider: { PROVIDER_ID: 'google.com' },
      FacebookAuthProvider: { PROVIDER_ID: 'facebook.com' },
      EmailAuthProvider: { PROVIDER_ID: 'password' },
    }),
  };
  ctx.firebaseui = { auth: { AuthUI: function () { this.start = () => {}; },
                             CredentialHelper: { NONE: 'none' } } };
  ctx.firebaseui.auth.AuthUI.getInstance = () => null;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(RAIZ, 'config.js'), 'utf8'), ctx,
                  { filename: 'config.js' });
  return mensajes.join(' | ');
}

const ENTORNOS = [
  ['abierto con doble clic (file://)', { protocol: 'file:', hostname: '', storageOk: true },
   /file:/],
  ['servido por http en localhost', { protocol: 'http:', hostname: 'localhost', storageOk: true },
   null],
  ['http con el almacenamiento bloqueado',
   { protocol: 'http:', hostname: 'localhost', storageOk: false }, /almacenamiento/],
];
for (const [nombre, cfg, esperado] of ENTORNOS) {
  const msg = diagnosticoCon(cfg);
  const ok = esperado ? esperado.test(msg) : msg === '';
  if (!ok) fallos++;
  console.log(`  [${ok ? 'OK     ' : 'FALLO  '}] ${nombre.padEnd(37)} -> `
              + (msg ? msg.replace('[OOT.authGuard] No se puede autenticar aquí: ', '').slice(0, 60)
                     : 'sin impedimento, pasa a FirebaseUI'));
}

if (!fallos) {
  console.log(`  ${CASOS.length} ambientes con su proyecto y su API correctos, y `
              + `${ENTORNOS.length} entornos diagnosticados`);
}
process.exit(fallos ? 1 : 0);
