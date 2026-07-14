const API_BASE = window.OOT_API_BASE || '';
let historial = [];
let consultando = false;
let convActualId = _generarSessionId();
const CONV_KEY = 'oot_chat_convs';
const CONV_TTL = 24 * 60 * 60 * 1000;   // 24 h — luego se autoeliminan
const CONV_MAX = 30;                    // H-13: tope de conversaciones guardadas
const CONV_MAX_BYTES = 2 * 1024 * 1024; // H-13: cota de tamaño (~2 MB, bajo el cupo de 5 MB)

function _generarSessionId() {
  return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function getSessionId() {
  let sid = sessionStorage.getItem('oot_chat_session');
  if (!sid) { sid = _generarSessionId(); sessionStorage.setItem('oot_chat_session', sid); }
  return sid;
}

async function verificarConexion() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const r = await fetch(`${API_BASE}/api/health`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (r.ok) {
      document.getElementById('status-dot').className = 'dot';
      document.getElementById('status-text').textContent = 'IA activa';
      document.getElementById('sidebar-status').textContent = 'Conectado';
    } else throw new Error();
  } catch {
    clearTimeout(timer);
    document.getElementById('status-dot').className = 'dot offline';
    document.getElementById('status-text').textContent = 'Sin conexión';
    document.getElementById('sidebar-status').textContent = 'Desconectado';
  }
}

function manejarTecla(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    enviarPregunta();
  }
}

function usarSugerencia(texto) {
  document.getElementById('input-pregunta').value = texto;
  document.getElementById('input-pregunta').focus();
}

function escapeHtml(t) {
  return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function agregarMensajeUsuario(texto) {
  const container = document.getElementById('messages');
  const div = document.createElement('div');
  div.className = 'message user';
  div.innerHTML = `
    <div class="message-avatar">
      <span class="material-symbols-outlined" style="color:#fff;font-size:18px">person</span>
    </div>
    <div class="message-content">
      <div class="message-label">Tú</div>
      <div class="message-bubble">${escapeHtml(texto)}</div>
    </div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function _markdownToHtml(texto) {
  // Doble barrera XSS sobre la respuesta del LLM/RAG (contenido NO confiable por
  // inyección de prompt) que luego se inyecta vía innerHTML:
  //   1) escape-first: se escapan &<> ANTES del markdown, así los únicos tags del
  //      resultado son <strong>/<br> que reintroduce esta función (nunca del modelo).
  //   2) DOMPurify con allowlist estricta: aunque el markdown crezca (enlaces, etc.),
  //      solo sobreviven <strong>/<br> sin atributos. Si la librería no cargó, el
  //      escape-first ya deja el HTML seguro (degradación sin abrir hueco).
  const html = escapeHtml(texto)
    .replace(/## (.+)/g, '<strong>$1</strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>');
  return (window.DOMPurify)
    ? window.DOMPurify.sanitize(html, { ALLOWED_TAGS: ['strong', 'br'], ALLOWED_ATTR: [] })
    : html;
}

function agregarMensajeBot(texto) {
  const container = document.getElementById('messages');
  const div = document.createElement('div');
  div.className = 'message bot';
  div.innerHTML = `
    <div class="message-avatar">
      <span class="material-symbols-outlined" style="color:#fff;font-size:18px">menu_book</span>
    </div>
    <div class="message-content">
      <div class="message-label">IA OOT Assistant</div>
      <div class="message-bubble">${_markdownToHtml(texto)}</div>
      <div class="message-time">${new Date().toLocaleTimeString('es-CO', {hour:'2-digit', minute:'2-digit'})}</div>
    </div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

function _crearBurbujaBotStream() {
  const container = document.getElementById('messages');
  const div = document.createElement('div');
  div.className = 'message bot';
  const contenido = document.createElement('div');
  contenido.className = 'message-bubble';
  contenido.innerHTML = '<span style="opacity:0.5;font-style:italic">Escribiendo...</span>';
  div.innerHTML = `
    <div class="message-avatar">
      <span class="material-symbols-outlined" style="color:#fff;font-size:18px">menu_book</span>
    </div>
    <div class="message-content">
      <div class="message-label">IA OOT Assistant</div>
    </div>`;
  div.querySelector('.message-content').appendChild(contenido);
  div.querySelector('.message-content').insertAdjacentHTML('beforeend', 
    `<div class="message-time">${new Date().toLocaleTimeString('es-CO', {hour:'2-digit', minute:'2-digit'})}</div>`);
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return { div, contenido };
}

function _agregarBotonDescargaNormas(mensajeDiv, textoRespuesta, pregunta) {
  if (!textoRespuesta.includes('Fuentes consultadas')) return;
  var content = mensajeDiv.querySelector('.message-content');
  if (!content || content.querySelector('.btn-descarga-normas')) return;
  var btn = document.createElement('button');
  btn.className = 'btn-descarga-normas';
  btn.style.cssText = 'margin-top:6px;display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:600;padding:4px 10px;border-radius:20px;background:var(--oot-s3);color:var(--oot-ochre);border:0.5px solid var(--oot-b2);cursor:pointer';
  btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:13px">download</span>Descargar fuentes (PDF)';
  btn.onclick = async function() {
    if (!pregunta) { window.OOT.notify('No se puede identificar la consulta de esta respuesta.', 'warn'); return; }
    var orig = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:13px">hourglass_top</span>Preparando ZIP...';
    try {
      var r = await fetch(API_BASE + '/api/consulta/fuentes-zip', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({pregunta: pregunta})
      });
      if (!r.ok) {
        var err = await r.json().catch(function(){ return {detail: 'Error ' + r.status}; });
        throw new Error(err.detail || ('Error ' + r.status));
      }
      var blob = await r.blob();
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'fuentes_OOT_' + new Date().toISOString().slice(0,10) + '.zip';
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      window.OOT.notify('No se pudieron descargar los PDFs de las fuentes. Intente nuevamente en unos momentos.', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = orig;
    }
  };
  content.insertBefore(btn, content.querySelector('.message-time'));
}

function agregarMensajeError(msg) {
  const container = document.getElementById('messages');
  const div = document.createElement('div');
  div.className = 'message bot';
  div.innerHTML = `
    <div class="message-avatar" style="background:var(--oot-red)">
      <span class="material-symbols-outlined" style="color:#fff;font-size:18px">error</span>
    </div>
    <div class="message-content">
      <div class="message-bubble" style="background:rgba(208,64,64,0.1);border-color:rgba(208,64,64,0.3);color:var(--oot-red-l)">
        <strong>Error:</strong> ${escapeHtml(msg)}<br>
        <span style="font-size:11px">El servicio de consulta no está disponible en este momento. Intente nuevamente en unos minutos.</span>
      </div>
    </div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

// ── Historial de conversaciones (localStorage, con TTL) ──
function _convsLoad() {
  // H-13: validación al leer — descarta contenido corrupto o con forma inesperada.
  try {
    const raw = JSON.parse(localStorage.getItem(CONV_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw.filter(c => c && typeof c === 'object' &&
      typeof c.id !== 'undefined' && typeof c.ts === 'number' && Array.isArray(c.mensajes));
  } catch (_) { return []; }
}
function _convsSave(convs) {
  // H-13: tope por cantidad (más recientes) + cota de tamaño; si excede el cupo de
  // localStorage se recorta la más antigua y se reintenta (en vez de perder todo en silencio).
  let lista = (Array.isArray(convs) ? convs : []).slice(0, CONV_MAX);
  for (let intento = 0; intento < CONV_MAX + 1; intento++) {
    const s = JSON.stringify(lista);
    if (s.length <= CONV_MAX_BYTES) {
      try { localStorage.setItem(CONV_KEY, s); return; }
      catch (_) { /* cupo excedido → recortar y reintentar */ }
    }
    if (lista.length <= 1) { try { localStorage.setItem(CONV_KEY, JSON.stringify(lista)); } catch (_) {} return; }
    lista = lista.slice(0, lista.length - 1);   // suelta la conversación más antigua
  }
}
function _convsPrune() {
  const now = Date.now();
  const convs = _convsLoad().filter(c => (now - c.ts) < CONV_TTL);
  _convsSave(convs);
  return convs;
}
function guardarConversacionActual() {
  if (!historial.length) return;
  const convs = _convsLoad();
  const primera = historial.find(m => m.rol === 'usuario');
  const titulo = (primera ? primera.texto : 'Consulta').replace(/\s+/g, ' ').trim().slice(0, 60);
  const conv = { id: convActualId, sid: getSessionId(), titulo: titulo, ts: Date.now(), mensajes: historial.slice() };
  const idx = convs.findIndex(c => c.id === convActualId);
  if (idx >= 0) convs[idx] = conv; else convs.unshift(conv);
  _convsSave(convs);
  renderHistorial();
}
function renderHistorial() {
  const cont = document.getElementById('historial-list');
  if (!cont) return;
  const convs = _convsPrune().sort((a, b) => b.ts - a.ts);
  if (!convs.length) { cont.innerHTML = '<div class="hist-empty">Sin conversaciones a&uacute;n</div>'; return; }
  cont.innerHTML = convs.map(c =>
    '<div class="hist-item' + (c.id === convActualId ? ' active' : '') + '" data-id="' + c.id + '">' +
      '<span class="material-symbols-outlined" style="font-size:16px">chat_bubble</span>' +
      '<span class="hist-title">' + escapeHtml(c.titulo) + '</span>' +
      '<button class="hist-del" data-del="' + c.id + '" title="Eliminar">&times;</button>' +
    '</div>'
  ).join('');
}
function cargarConversacion(id) {
  const conv = _convsLoad().find(c => c.id === id);
  if (!conv) return;
  convActualId = id;
  historial = (conv.mensajes || []).slice();
  if (conv.sid) sessionStorage.setItem('oot_chat_session', conv.sid);
  const faq = document.getElementById('faq-container'); if (faq) faq.style.display = 'none';
  const container = document.getElementById('messages');
  container.innerHTML = '';
  let _lastQ = '';
  historial.forEach(m => {
    if (m.rol === 'usuario') { _lastQ = m.texto; agregarMensajeUsuario(m.texto); }
    else { const d = agregarMensajeBot(m.texto); _agregarBotonDescargaNormas(d, m.texto, _lastQ); }
  });
  renderHistorial();
}
function borrarConversacion(id) {
  _convsSave(_convsLoad().filter(c => c.id !== id));
  if (id === convActualId) nuevaConsulta();
  else renderHistorial();
}

async function enviarPregunta() {
  if (consultando) return;
  const input = document.getElementById('input-pregunta');
  const pregunta = input.value.trim();
  if (!pregunta) return;
  if (window.OOT && OOT.track) OOT.track('consulta_normativa', { longitud: pregunta.length });

  consultando = true;
  input.value = '';
  document.getElementById('btn-enviar').disabled = true;

  agregarMensajeUsuario(pregunta);
  historial.push({rol: 'usuario', texto: pregunta});

  const faqContainer = document.getElementById('faq-container');
  if (faqContainer) faqContainer.style.display = 'none';

  document.getElementById('typing').style.display = 'flex';
  document.getElementById('messages').scrollTop = document.getElementById('messages').scrollHeight;

  try {
    let respuestaTexto = '';
    let respStream = null;
    try {
      respStream = await fetch(`${API_BASE}/api/consulta/stream`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({pregunta, session_id: getSessionId()})
      });
    } catch (_) { respStream = null; }

    document.getElementById('typing').style.display = 'none';

    if (respStream && respStream.ok) {
      const reader = respStream.body.getReader();
      const decoder = new TextDecoder();
      let { div: burbuja, contenido } = _crearBurbujaBotStream();
      const container = document.getElementById('messages');
      let buffer = '';

      outer: while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lineas = buffer.split('\n');
        buffer = lineas.pop();
        for (const linea of lineas) {
          if (!linea.startsWith('data: ')) continue;
          const payload = linea.slice(6).trim();
          if (payload === '[DONE]') break outer;
          let obj;
          try { obj = JSON.parse(payload); } catch (_) { continue; }
          if (obj.error) throw new Error(obj.error);
          if (obj.delta) {
            respuestaTexto += obj.delta;
            contenido.innerHTML = _markdownToHtml(respuestaTexto);
            container.scrollTop = container.scrollHeight;
          }
        }
      }
      if (!respuestaTexto) {
        contenido.innerHTML = '<span style="opacity:0.7;font-size:13px">Sin respuesta del servidor. Intente de nuevo.</span>';
      } else {
        _agregarBotonDescargaNormas(burbuja, respuestaTexto, pregunta);
      }
    } else {
      document.getElementById('typing').style.display = 'flex';
      const r = await fetch(`${API_BASE}/api/consulta/`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({pregunta, session_id: getSessionId()})
      });
      document.getElementById('typing').style.display = 'none';
      if (!r.ok) {
        const err = await r.json().catch(() => ({detail: `Error ${r.status}`}));
        throw new Error(err.detail || `Error ${r.status}`);
      }
      const data = await r.json();
      respuestaTexto = data.respuesta || 'Sin respuesta';
      const msgDiv = agregarMensajeBot(respuestaTexto);
      _agregarBotonDescargaNormas(msgDiv, respuestaTexto, pregunta);
    }

    historial.push({rol: 'bot', texto: respuestaTexto});
    guardarConversacionActual();
  } catch (e) {
    document.getElementById('typing').style.display = 'none';
    agregarMensajeError(e.message);
  } finally {
    consultando = false;
    document.getElementById('btn-enviar').disabled = false;
    input.focus();
  }
}

function nuevaConsulta() {
  historial = [];
  convActualId = _generarSessionId();
  sessionStorage.setItem('oot_chat_session', _generarSessionId());
  renderHistorial();
  const container = document.getElementById('messages');
  container.innerHTML = `
    <div class="message bot">
      <div class="message-avatar">
        <span class="material-symbols-outlined" style="color:#fff;font-size:18px">menu_book</span>
      </div>
      <div class="message-content">
        <div class="message-label">IA OOT Assistant</div>
        <div class="message-bubble">Nueva sesión iniciada. ¿En qué le puedo ayudar con la normatividad de ordenamiento territorial?</div>
      </div>
    </div>`;
}

function exportarChat() {
  if (!historial.length) { window.OOT.notify('No hay mensajes para exportar.', 'warn'); return; }
  let txt = 'CONSULTA NORMATIVA — COLOMBIA OT · IGAC 2026\n';
  txt += '='.repeat(55) + '\n';
  txt += `Fecha: ${new Date().toLocaleString('es-CO')}\n\n`;
  historial.forEach(m => {
    txt += m.rol === 'usuario' ? `\nUSUARIO:\n${m.texto}\n` : `\nASISTENTE:\n${m.texto}\n`;
    txt += '-'.repeat(40) + '\n';
  });
  const blob = new Blob([txt], {type: 'text/plain'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `consulta_OT_${Date.now()}.txt`;
  a.click();
}

window.OOT.loadShell();

// Historial: render inicial + delegación de clicks (cargar / borrar)
renderHistorial();
(function() {
  const lista = document.getElementById('historial-list');
  if (!lista) return;
  lista.addEventListener('click', function(e) {
    const del = e.target.closest('.hist-del');
    if (del) { e.stopPropagation(); borrarConversacion(del.getAttribute('data-del')); return; }
    const item = e.target.closest('.hist-item');
    if (item) cargarConversacion(item.getAttribute('data-id'));
  });
})();

verificarConexion();
setInterval(verificarConexion, 30000);

// ── Mobile tab bar ──────────────────────────────────────────────────────────
(function() {
  const bar = document.createElement('div');
  bar.className = 'mob-chat-tabs';
  bar.innerHTML =
    '<button class="mob-chat-tab" id="mob-chat-info" data-oot-click="_mobChatSidebar" data-oot-arg="true">' +
      '<span class="material-symbols-outlined">info</span>Acerca</button>' +
    '<button class="mob-chat-tab active" id="mob-chat-conv" data-oot-click="_mobChatSidebar" data-oot-arg="false">' +
      '<span class="material-symbols-outlined">chat</span>Chat</button>';
  document.body.appendChild(bar);
})();

function _mobChatSidebar(mostrar) {
  const sidebar = document.getElementById('chat-sidebar');
  const bd = document.getElementById('mob-chat-backdrop');
  if (sidebar) sidebar.classList.toggle('mob-visible', mostrar);
  if (bd) bd.style.display = mostrar ? 'block' : 'none';
  const infoTab = document.getElementById('mob-chat-info');
  const convTab = document.getElementById('mob-chat-conv');
  if (infoTab) infoTab.classList.toggle('active', mostrar);
  if (convTab) convTab.classList.toggle('active', !mostrar);
}
