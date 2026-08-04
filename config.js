/**
 * Colombia OT 2.0 — Configuración global
 *
 * ┌─ CONFIGURACIÓN PARA QUIEN MONTA EL FRONTEND ────────────────────────────────┐
 * │ Este sitio es 100% estático. El backend (API) corre en otra máquina y se    │
 * │ alcanza por una URL pública (túnel Cloudflare / dominio). Solo hay que      │
 * │ editar OOT_API_BASE (y opcionalmente OOT_TILES_BASE) abajo. No hay secretos │
 * │ en este archivo ni en el sitio.                                             │
 * └─────────────────────────────────────────────────────────────────────────────┘
 */

// ── Base del frontend (H-05 / H-10 — portabilidad de rutas) ───────────────────
// OOT_BASE se deriva de la ubicación de ESTE script (config.js vive en la raíz del
// frontend). Permite publicar el sitio en la RAÍZ ('') o bajo un SUBPATH (p.ej.
// '/observatorio') sin editar rutas: el shell (navbar/footer) usa el token %BASE% que
// loadShell reemplaza por este valor. '' = raíz → las rutas quedan como '/...'.
window.OOT_BASE = (function () {
  try {
    var cur = document.currentScript;
    if (!cur) {
      var ss = document.getElementsByTagName('script');
      for (var i = ss.length - 1; i >= 0; i--) {
        if (ss[i].src && /(^|\/)config\.js(\?|$)/.test(ss[i].src)) { cur = ss[i]; break; }
      }
    }
    if (cur && cur.src) {
      // Directorio de config.js → base del frontend, sin barra final ('' si es la raíz).
      return new URL('.', cur.src).pathname.replace(/\/$/, '');
    }
  } catch (e) {}
  return '';
})();

// ── Backend OOT (API) — resolución por AMBIENTE (H-09 / H-15) ─────────────────
// El backend de la API se resuelve por el HOSTNAME donde se sirve el frontend, así
// NO hay que editar código al desplegar y NO se depende de túneles temporales en
// producción. Dos casos:
//   • same-origin ('')  → la API se sirve junto al sitio (dev local con api.py, o el
//     servidor institucional Fullstack que sirve frontend + backend en el mismo host).
//   • dominio institucional → cuando el frontend está separado del backend.
// El backend debe permitir este origen en su CORS (CORS_ORIGINS).
//
// ⚠️ INFRAESTRUCTURA: los dominios de abajo son PLACEHOLDERS tentativos. Reemplazar
//    por los dominios API reales de cada ambiente cuando estén aprovisionados. Mientras
//    tanto, un operador puede apuntar temporalmente la entrada del ambiente a la URL
//    activa del backend (p.ej. un túnel) SIN commitear esa URL volátil al repositorio.
window.OOT_ENV_API = window.OOT_ENV_API || {
  'localhost':                      '',   // desarrollo (api.py sirve el sitio)
  '127.0.0.1':                      '',
  'jeremaya203.github.io':          'https://really-ordinary-pond-jersey.trycloudflare.com',   // file:// o same-origin sin host
  // --- Ambientación institucional del IGAC ---
  'pruebas-colombiaot.igac.gov.co': 'https://api-pruebas-oot.igac.gov.co', // Ambiente de pruebas
  'colombiaot.igac.gov.co':         'https://api-oot.igac.gov.co',         // Ambiente de producción
};
// Override explícito SOLO para desarrollo (p.ej. exponer un backend local por túnel):
// defina  window.OOT_API_REMOTE = 'https://xxxx.trycloudflare.com'  ANTES de este script.
// NUNCA debe ser el default de producción → por eso ya no se hardcodea ninguna URL aquí.
window.OOT_API_REMOTE = window.OOT_API_REMOTE || 'https://really-ordinary-pond-jersey.trycloudflare.com';
// Priorizar el override remoto (túnel de desarrollo) si está definido.
// Si no, resolver según el mapa de ambientes.
window.OOT_API_BASE = window.OOT_API_REMOTE || (
  (location.hostname in window.OOT_ENV_API)
    ? window.OOT_ENV_API[location.hostname]
    : ''
);

// ── Vector tiles (.pmtiles de indicadores) ────────────────────────────────────
// '' = se sirven desde el MISMO origen que el sitio (carpeta /tiles/ junto al frontend).
// Si los sirve el backend, pon aquí su URL base (normalmente la misma que OOT_API_BASE);
// en ese caso el backend debe exponer /tiles/*.pmtiles con CORS + soporte HTTP Range.
window.OOT_TILES_BASE = window.OOT_TILES_BASE || '';
if (!window.OOT_TILES_BASE && window.OOT_API_BASE) {
  window.OOT_TILES_BASE = window.OOT_API_BASE;
}

// ── Hardening de runtime (obs 12, 26) ─────────────────────────────────────────
// Bandera de depuración: false en producción → silencia console.log/console.debug
// (mecanismo CONTROLADO; definir window.OOT_DEBUG = true ANTES de este script para
// reactivar la traza durante desarrollo). console.warn/console.error se conservan.
window.OOT_DEBUG = window.OOT_DEBUG || false;
if (!window.OOT_DEBUG && typeof console !== 'undefined') {
  console.log = function () {};
  console.debug = function () {};
  console.info = function () {};
  console.warn = function () {};
}
// Favicon institucional en TODAS las páginas (sin editar cada <head>).
(function () {
  try {
    if (!document.querySelector('link[rel~="icon"]')) {
      var l = document.createElement('link');
      l.rel = 'icon'; l.type = 'image/svg+xml';
      l.href = (window.OOT_BASE || '') + '/images/nav/colombiaOT.svg';
      (document.head || document.documentElement).appendChild(l);
    }
  } catch (e) {}
})();

// ── Analítica GA4 (obs 3) ─────────────────────────────────────────────────────
// Mide visitas y uso de la plataforma (page_view automático en todas las páginas).
// ID de medición reutilizado de la plataforma institucional. Para desactivar: '' .
window.OOT_GA4_ID = (typeof window.OOT_GA4_ID === 'string') ? window.OOT_GA4_ID : 'G-78PPLF47WW';
(function () {
  try {
    if (!window.OOT_GA4_ID) return;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + window.OOT_GA4_ID;
    (document.head || document.documentElement).appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { dataLayer.push(arguments); };
    gtag('js', new Date());
    gtag('config', window.OOT_GA4_ID);
  } catch (e) {}
})();
// Helper de eventos para instrumentar acciones: OOT.track('nombre', { param: valor }).
window.OOT = window.OOT || {};
window.OOT.track = function (evento, params) {
  try { if (window.gtag) window.gtag('event', evento, params || {}); } catch (e) {}
};

// URL del backend de Colombia OT — reservada para fase 2
// Cuando se integre la API de Colombia OT, definir esta variable antes de usarla.
// Por ahora los módulos Colombia OT funcionan via hipervínculo directo.
// window.OOT_COT_API_BASE = 'https://serviciosgeovisor.igac.gov.co:8080/Geovisor';
window.OOT_COT_API_BASE = null; // null = fase 1, hipervínculo

// ── Funciones externas (Colombia OT) ─────────────────────────────────────────
// Cuando Colombia OT desaparezca, actualizar estas URLs a rutas del OOT.
// Cuando las funciones migren al OOT, cambiar a rutas relativas (e.g. './pot/').
window.OOT_COT_BASE = 'https://www.colombiaot.gov.co';

window.OOT_COT_URLS = {
  pot:          window.OOT_COT_BASE + '/pot/',
  vigencias:    window.OOT_COT_BASE + '/vigencias/',
  cartillas:    window.OOT_COT_BASE + '/cartillas/',
  normatividad: window.OOT_COT_BASE + '/normatividad/',
  ruta:         window.OOT_COT_BASE + '/ruta/',
  datosot:      window.OOT_COT_BASE + '/datosot/',
  aplicaciones: window.OOT_COT_BASE + '/aplicaciones/',
};

// ── Módulos OOT (rutas internas) ──────────────────────────────────────────────
window.OOT_MODULOS = {
  normativa:      './Modulo_Chat_normativo.html',
  determinantes:  './Modulo_Determinantes.html',
  indicadores:    './Modulo_Indicadores.html',
  // Obs 24: entradas inertes (páginas aún NO incluidas en el paquete). Reactivar cada
  // una SOLO cuando su HTML exista, para no dejar referencias muertas en la config.
  // municipios:   './Modulo_Municipios.html',
  // vigenciasOOT: './Modulo_Vigencias.html',
  // recursos:     './Modulo_Recursos.html',
  // acerca:       './Acerca.html',
};

// Rutas prefijadas con OOT_BASE para portabilidad en subpath (a raíz = idénticas).
window.OOT_COT_WRAPPERS = {
  pot:          (window.OOT_BASE || '') + '/colombia-ot/pot/index.html',
  ruta:         (window.OOT_BASE || '') + '/colombia-ot/ruta/index.html',
  cartillas:    (window.OOT_BASE || '') + '/colombia-ot/cartillas.html',
  // Obs 24: wrappers inertes (aún NO presentes en colombia-ot/). Reactivar cuando exista
  // cada archivo, para no dejar enlaces muertos.
  // vigencias:    '/colombia-ot/vigencias.html',
  // normatividad: '/colombia-ot/normatividad.html',
  // datosot:      '/colombia-ot/datosot.html',
  // aplicaciones: '/colombia-ot/aplicaciones.html',
  // documentos:   '/colombia-ot/documentos.html',
  // docuvisor:    '/colombia-ot/docuvisor.html',
};

// ── Helpers globales ──────────────────────────────────────────────────────────
window.OOT = window.OOT || {};

/**
 * Genera o recupera el session_id del chat normativo.
 * Persiste en sessionStorage (muere al cerrar la pestaña — correcto para chat).
 */
window.OOT.getSessionId = function() {
  let sid = sessionStorage.getItem('oot_session_id');
  if (!sid) {
    sid = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2);
    sessionStorage.setItem('oot_session_id', sid);
  }
  return sid;
};

window.OOT.newSession = function() {
  sessionStorage.removeItem('oot_session_id');
  return window.OOT.getSessionId();
};

/**
 * Sanitización XSS — usar SIEMPRE antes de insertar datos en el DOM.
 */
window.OOT.escapeHtml = function(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

/**
 * Navbar: abre/cierra el menú móvil (hamburguesa).
 */
window.OOT.toggleNav = function(btn) {
  const links = document.getElementById('oot-nav-links');
  if (!links) return;
  const open = links.classList.toggle('open');
  if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
};

/**
 * Navbar: abre/cierra un dropdown (Módulos / Acerca del POT).
 * En desktop el dropdown abre por hover (CSS); esto controla el click en móvil.
 */
window.OOT.toggleDropdown = function(btn) {
  const dd = btn.closest('.oot-nav-dd');
  if (!dd) return;
  document.querySelectorAll('.oot-nav-dd.open').forEach(el => { if (el !== dd) el.classList.remove('open'); });
  dd.classList.toggle('open');
};

// Cerrar dropdowns abiertos al hacer click fuera del navbar
document.addEventListener('click', function(e) {
  if (!e.target.closest('.oot-nav-dd')) {
    document.querySelectorAll('.oot-nav-dd.open').forEach(el => el.classList.remove('open'));
  }
});

/**
 * Carga el navbar y el footer como includes desde archivos HTML separados.
 * Llamar al inicio de cada página: OOT.loadShell()
 */
window.OOT.loadShell = async function() {
  const navEl  = document.getElementById('oot-navbar-placeholder');
  const footEl = document.getElementById('oot-footer-placeholder');

  // navbar.html y footer.html son estáticos: se sirven SIEMPRE desde el mismo
  // origen que la página (el host del frontend), NO desde OOT_API_BASE (backend/túnel).
  // OOT_API_BASE se usa solo para las llamadas a /api/* (ver módulos).
  // Se resuelven contra OOT_BASE (raíz o subpath) y su contenido lleva el token %BASE%
  // que se reemplaza aquí, para que las rutas del shell funcionen en cualquier base.
  const _base = window.OOT_BASE || '';
  const _fill = (html) => html.replace(/%BASE%/g, _base);

  // `cache: 'no-cache'` obliga a REVALIDAR el shell con el servidor en cada carga
  // (no lo re-descarga: si no cambió, el servidor responde 304 por ETag).
  // Sin esto, el navegador sirve el navbar/footer cacheados heurísticamente: tras el
  // renombrado Pagina_Principal.html → index.html (H-05), un usuario con el navbar viejo
  // en caché seguía pidiendo la ruta eliminada y recibía {"detail":"Not Found"}.
  // El shell es el índice de navegación del sitio: debe quedar siempre fresco.
  const _shellFetch = (url) => fetch(url, { cache: 'no-cache' });

  if (navEl) {
    try {
      const r = await _shellFetch(_base + '/navbar.html');
      if (r.ok) navEl.innerHTML = _fill(await r.text());
    } catch(e) { console.warn('OOT: no se pudo cargar navbar.html', e); }
  }
  if (footEl) {
    try {
      const r = await _shellFetch(_base + '/footer.html');
      if (r.ok) footEl.innerHTML = _fill(await r.text());
    } catch(e) { console.warn('OOT: no se pudo cargar footer.html', e); }

    // Badge de versión: el footer se inyecta con innerHTML, así que un <script>
    // dentro de footer.html NO se ejecutaría. Se resuelve aquí.
    fetch((window.OOT_API_BASE || '') + '/api/health')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const el = document.getElementById('oot-version-badge');
        if (el && d && d.version) el.textContent = 'Colombia OT 2.0 · v' + d.version;
      })
      .catch(() => {});
  }

  // Inicializar comportamiento interactivo del navbar (reemplaza navbar.js)
  setTimeout(() => {
    const dropDownBtn   = document.querySelector('.nav-bar-toggle-igac');
    const navbarigac    = document.querySelector('.navbarigac');
    const navbarnavigac = document.querySelector('.navbarnavigac');
    const linkList      = document.querySelector('#link-list');
    const logoIgac      = document.querySelector('.navbar-brand-igac');
    const barraGov      = document.querySelector('.barra_gov');

    if (dropDownBtn && navbarnavigac) {
      dropDownBtn.addEventListener('click', () => navbarnavigac.classList.toggle('expandMenu'));
    }

    function handleTablet(mq) {
      if (!linkList || !navbarnavigac || !navbarigac) return;
      if (mq.matches) { navbarnavigac.appendChild(linkList); }
      else { navbarigac.appendChild(linkList); }
    }
    const mqTablet = window.matchMedia('(max-width: 1024px)');
    handleTablet(mqTablet);
    mqTablet.addEventListener('change', handleTablet);

    function handleMobile(mq) {
      if (!logoIgac || !barraGov || !navbarigac) return;
      const logos = navbarigac.querySelector('.logos');
      if (mq.matches) { barraGov.appendChild(logoIgac); }
      else if (logos) { logos.appendChild(logoIgac); }
    }
    const mqMobile = window.matchMedia('(max-width: 526px)');
    handleMobile(mqMobile);
    mqMobile.addEventListener('change', handleMobile);

    // Colapsar los submenús desplegables del navbar
    const cb1 = document.querySelector('.collapse-button-1');
    const cm1 = document.querySelector('.collapse-menu-1');
    const cb2 = document.querySelector('.collapse-button-2');
    const cm2 = document.querySelector('.collapse-menu-2');
    if (cb1 && cm1) {
      cb1.addEventListener('click', () => { if (cm2) cm2.classList.remove('expand'); cm1.classList.toggle('expand'); });
    }
    if (cb2 && cm2) {
      cb2.addEventListener('click', () => { if (cm1) cm1.classList.remove('expand'); cm2.classList.toggle('expand'); });
    }

    // Marcar link activo. Home: la landing es index.html (H-05), servida en '/' o
    // '/index.html' → ambos deben resolver a 'index' (pathname '/' da '' → fallback).
    const page = (location.pathname.split('/').pop().replace('.html', '') || 'index').toLowerCase();
    document.querySelectorAll('#link-list a[data-page], .navbarnavigac a[data-page], .oot-dark-links a[data-page]').forEach(el => {
      if (el.dataset.page === page) el.classList.add('active');
    });

    // Botones #oot-login-btn/#oot-logout-btn viven en navbar.html: recién existen aquí,
    // tras la inyección.
    // - Páginas heredadas de colombiaot.gov.co (cargue, colombia-ot/pot) ya traen su PROPIO
    //   modal Firebase/FirebaseUI funcional (#modalLogin + gotoLogin()) — reusarlo evita
    //   inicializar Firebase dos veces en la misma página.
    // - El resto usa js/shared-auth.js (OOT.auth), más liviano (sin FirebaseUI/jQuery).
    if (window.OOT.auth) {
      window.OOT.auth.bindNavbar();
    } else if (typeof window.gotoLogin === 'function') {
      const loginBtn = document.getElementById('oot-login-btn');
      if (loginBtn && !loginBtn.dataset.ootBound) {
        loginBtn.dataset.ootBound = '1';
        loginBtn.addEventListener('click', (e) => { e.preventDefault(); window.gotoLogin(); });
      }
    }
  }, 50);

  // Sincronizar el alto real del navbar (ver _ootSyncNavbarH)
  _ootSyncNavbarH();

  // Verificar conexión
  setTimeout(() => verificarConexionGlobal(), 500);
};

/**
 * Publica el alto REAL del navbar en la variable CSS --oot-navbar-h.
 *
 * Los módulos full-screen (Chat, Determinantes, Indicadores) se dimensionan con
 * `calc(100dvh - var(--oot-navbar-h))`. Ese valor estaba clavado en 140px, que solo
 * es correcto en escritorio: al encogerse la banda institucional (≤768px) el navbar
 * real baja a ~132px y los módulos quedaban descuadrados. Medirlo evita tener que
 * mantener una constante por cada breakpoint.
 */
function _ootSyncNavbarH() {
  const nav = document.querySelector('.oot-dark-nav');
  if (!nav) return;

  const aplicar = () => {
    const h = Math.round(nav.getBoundingClientRect().height);
    if (h > 0) document.documentElement.style.setProperty('--oot-navbar-h', h + 'px');
  };

  aplicar();

  if (window.ResizeObserver) {
    new ResizeObserver(aplicar).observe(nav);
  } else {
    window.addEventListener('resize', aplicar);
  }
  // El menú móvil se despliega en absolute (no cambia el alto), pero al rotar el
  // dispositivo el navbar sí puede reflowear.
  window.addEventListener('orientationchange', () => setTimeout(aplicar, 100));
}

// Verificación de conexión global para el navbar
async function verificarConexionGlobal() {
  const badge = document.getElementById('badge-conexion');
  if (!badge) return;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);

  try {
    const base = window.OOT_API_BASE || '';
    const r = await fetch(base + '/api/health', { signal: ctrl.signal });
    clearTimeout(timer);
    if (r.ok) {
      badge.className = 'oot-api-badge oot-api-conectado';
      badge.textContent = 'Servidor activo';
    } else { throw new Error(); }
  } catch(e) {
    clearTimeout(timer);
    badge.className = 'oot-api-badge oot-api-desconectado';
    badge.textContent = 'Sin conexión';
  }
}
