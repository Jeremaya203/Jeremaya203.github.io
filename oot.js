// oot.js — Estado global OOT · sin variables sueltas en window
'use strict';

// El objeto se nombra _OOT y NO OOT a proposito: una declaracion `const OOT` en el
// ambito global crea un binding lexico que TIENE PRECEDENCIA sobre la propiedad
// window.OOT que ya creo config.js. Con `const OOT`, cualquier script posterior que
// escriba `OOT.algo` (sin `window.`) resolvia a este objeto —que no tiene escapeHtml,
// loadShell ni track— en vez de al fusionado. Por eso OOT.track() se descartaba en
// silencio en chat-normativo.js, determinantes.js e indicadores.js.
const _OOT = {
  // Configuración (se sobrescribe desde config.js)
  API_BASE: window.OOT_API_BASE || '',

  // Estado de sesión (sin auth por ahora)
  state: {
    currentPage: null,
    lastMunicipio: null,
  },

  // Caché en memoria: evita refetch en la misma sesión
  cache: {
    municipios: null,   // Array de municipios
    recursos: null,     // Últimos resultados del buscador
    catalogo: null,     // Config inicial (temáticas, tags)
  },

  // ── Fetch helper con timeout, reintentos y error handling (H-14) ──────────────
  // Reintenta SOLO condiciones transitorias (red caída, timeout, HTTP 5xx/429) con
  // backoff exponencial. Los 4xx (petición inválida) NO se reintentan. `retries=0`
  // desactiva el reintento (por defecto GET reintenta, POST no, por idempotencia).
  async _fetchJson(url, opts, timeoutMs, retries) {
    const _esRetryable = (e) => e && (e.name === 'AbortError' || e._retryable === true);
    for (let intento = 0; ; intento++) {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const r = await fetch(url, Object.assign({ signal: ctrl.signal }, opts));
        clearTimeout(tid);
        if (!r.ok) {
          const err = new Error(`HTTP ${r.status}`);
          err._retryable = (r.status >= 500 || r.status === 429);
          throw err;
        }
        return await r.json();
      } catch (e) {
        clearTimeout(tid);
        if (intento < retries && _esRetryable(e)) {
          const espera = 500 * Math.pow(2, intento);   // 500ms, 1s, 2s…
          await new Promise(res => setTimeout(res, espera));
          continue;   // reintentar
        }
        throw e;
      }
    }
  },

  async get(path, params = {}, { retries = 2, timeoutMs = 20000 } = {}) {
    const url = new URL(_OOT.API_BASE + path, window.location.href);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    try {
      return await _OOT._fetchJson(url.toString(), {}, timeoutMs, retries);
    } catch (e) {
      console.error(`[OOT] GET ${path} falló:`, e.message);
      throw e;
    }
  },

  async post(path, body = {}, { retries = 0, timeoutMs = 30000 } = {}) {
    const opts = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    };
    try {
      return await _OOT._fetchJson(_OOT.API_BASE + path, opts, timeoutMs, retries);
    } catch (e) {
      console.error(`[OOT] POST ${path} falló:`, e.message);
      throw e;
    }
  },

  // ── Notificación funcional al usuario (H-14 / H-18) ───────────────────────────
  // Toast efímero sin dependencias, para comunicar fallos de servicios externos
  // (API, tiles, fuentes de terceros) en vez de dejar el error solo en consola.
  notify(msg, tipo = 'error', ms = 5000) {
    try {
      let cont = document.getElementById('oot-toast-cont');
      if (!cont) {
        cont = document.createElement('div');
        cont.id = 'oot-toast-cont';
        cont.className = 'oot-toast-cont';
        document.body.appendChild(cont);
      }
      const t = document.createElement('div');
      const bgClass = tipo === 'error' ? 'oot-toast-error' : (tipo === 'warn' ? 'oot-toast-warn' : 'oot-toast-info');
      t.className = 'oot-toast ' + bgClass;
      t.textContent = String(msg);
      cont.appendChild(t);
      requestAnimationFrame(() => { t.style.opacity = '1'; });
      setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 250); }, ms);
    } catch (_) {}
  },

  // ── Traza de depuración encapsulada (H-11) ────────────────────────────────────
  // API sancionada para trazas: solo imprime si window.OOT_DEBUG === true. Es la vía
  // recomendada para código nuevo. Nota: config.js YA anula console.log/console.debug
  // globalmente en producción (!OOT_DEBUG), así que las trazas existentes tampoco
  // contaminan la consola; OOT.log añade la intención explícita.
  log(...args) {
    // console.error es el UNICO metodo que config.js no anula en produccion.
    if (window.OOT_DEBUG) { try { console.error(...args); } catch (_) {} }
  },

  // ── Utilidades ────────────────────────────────────────────────────
  limpiarTexto(s) {
    return s?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() ?? '';
  },

  getParameterByName(name) {
    const url = new URLSearchParams(window.location.search);
    return url.get(name);
  },

  formatNumber(n) {
    return new Intl.NumberFormat('es-CO').format(n);
  },

  formatHa(n) {
    return `${_OOT.formatNumber(Math.round(n))} ha`;
  },

  // ── localStorage helpers (H-13: guardas de esquema + tope de tamaño) ───────────
  // Solo se guardan valores primitivos (strings/números de selecciones recientes).
  // Tope duro de 8 KB por clave para no llenar localStorage con datos corruptos.
  saveRecent(key, value, maxItems = 5) {
    try {
      const prev = _OOT.getRecent(key);   // ya validado como array
      const nueva = [value, ...prev.filter(v => v !== value)].slice(0, maxItems);
      const serial = JSON.stringify(nueva);
      if (serial.length > 8192) return;  // descarta escrituras anómalas
      localStorage.setItem(`oot_${key}`, serial);
    } catch (_) {}
  },

  getRecent(key) {
    try {
      const raw = JSON.parse(localStorage.getItem(`oot_${key}`) || '[]');
      // Guarda de esquema: si el dato del cliente no es un array, se descarta.
      if (!Array.isArray(raw)) return [];
      return raw.filter(v => v === null || ['string', 'number', 'boolean'].includes(typeof v));
    } catch (_) { return []; }
  },
};

window.OOT = Object.assign(window.OOT || {}, _OOT);

// ── Delegación de eventos (H-04 / CSP sin 'unsafe-inline') ────────────────────
// Reemplaza los manejadores inline (onclick=""/onchange=""/…) para poder endurecer
// la CSP quitando 'unsafe-inline' de script-src. Cada elemento declara:
//   data-oot-click="funcion"     (o -change / -input / -keydown)
//   data-oot-arg="valor"         (opcional; literal a pasar a la función)
// Sin data-oot-arg: click → pasa el elemento (this); change/input → el.value;
// keydown → el evento. La escucha vive en `document`, así que también funciona con
// elementos inyectados por JS (mob bars, etc.). Resuelve rutas con punto (OOT.toggleNav).
(function () {
  // Registro explicito de manejadores. Antes esto resolvia el nombre contra `window`,
  // lo que ataba el despachador a que TODA funcion de modulo fuera global: el dia que
  // un modulo pase a ES modules o encapsule sus funciones, los data-oot-* dejan de
  // encontrarlas y los botones quedan mudos, sin error visible.
  //
  // Ahora hay un registro propio y `window` queda como respaldo mientras los modulos
  // migran. Cuando el registro este completo, ese respaldo se puede quitar y ese sera
  // el momento en que el frontend deje de depender del ambito global.
  const _handlers = Object.create(null);

  window.OOT = window.OOT || {};
  window.OOT.registrar = function (nombre, fn) {
    if (typeof fn !== 'function') { console.warn('[OOT] registrar: no es funcion:', nombre); return; }
    _handlers[nombre] = fn;
  };
  window.OOT.registrarTodos = function (mapa) {
    Object.keys(mapa || {}).forEach((k) => window.OOT.registrar(k, mapa[k]));
  };
  window.OOT.handlers = _handlers;   // solo lectura de facto: para diagnostico

  function _resolve(name) {
    const registrado = _handlers[name];
    if (typeof registrado === 'function') return registrado;
    // Respaldo: nombre global, con soporte de rutas con punto (OOT.toggleNav).
    return String(name).split('.').reduce((o, k) => (o == null ? o : o[k]), window);
  }
  function _coerce(v) {
    if (v === 'true') return true;
    if (v === 'false') return false;
    return v;
  }
  function _run(el, ev, tipo, payload) {
    const name = el.getAttribute('data-oot-' + tipo);
    if (!name) return;
    const fn = _resolve(name);
    if (typeof fn !== 'function') { console.warn('[OOT] handler no encontrado:', name); return; }
    const arg = el.getAttribute('data-oot-arg');
    fn.call(el, arg != null ? _coerce(arg) : payload, ev);
  }
  document.addEventListener('click',   (ev) => { const el = ev.target.closest('[data-oot-click]');   if (el) _run(el, ev, 'click', el); });
  document.addEventListener('change',  (ev) => { const el = ev.target.closest('[data-oot-change]');  if (el) _run(el, ev, 'change', el.value); });
  document.addEventListener('input',   (ev) => { const el = ev.target.closest('[data-oot-input]');   if (el) _run(el, ev, 'input', el.value); });
  document.addEventListener('keydown', (ev) => { const el = ev.target.closest('[data-oot-keydown]'); if (el) _run(el, ev, 'keydown', ev); });
  // Helpers para lo que antes eran expresiones inline sueltas:
  window._ootTriggerFile = function (id) { const i = document.getElementById(id); if (i) i.click(); };
  window._ootNoop = function () {};
})();
