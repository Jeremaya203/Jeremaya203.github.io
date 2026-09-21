import { cargarCapasEnMapa } from './capas.js';
import { actualizarListaMunicipios } from './escala.js';
import { API, _chartRafId, _fetchToken, siguienteFetchToken, catalogo, chartInstance, deptActivo, escalaActiva, mapa, setDatosActuales, setIndicadorActivo } from './estado.js';
import { actualizarBordeMunicipio, limpiarCapas } from './mapa.js';
import { seleccionarNacional } from './nacional.js';
import { renderizarLeyenda, renderizarStats } from './panel.js';

export async function seleccionarIndicador(id, municipio) {
  if (typeof municipio !== 'string') municipio = undefined;
  if (window.OOT && OOT.track) OOT.track('indicador_seleccionado', { indicador: id, escala: escalaActiva });
  if (escalaActiva === 'nacional') return seleccionarNacional(id);

  document.querySelectorAll('.ind-card').forEach(c => c.classList.remove('active'));
  const card = document.getElementById('card-' + id);
  if (card) card.classList.add('active');

  setIndicadorActivo(id);
  mostrarCargando(id);

  // En escala municipal, respetar el municipio ya elegido en el dropdown
  const muniSelect = document.getElementById('municipio-select');
  if (municipio === undefined && escalaActiva === 'municipal' && muniSelect && muniSelect.value) {
    municipio = muniSelect.value;
  }
  if (muniSelect) muniSelect.value = municipio || '';
  if (escalaActiva === 'municipal' && municipio) actualizarBordeMunicipio(municipio, false);

  // Token incremental para descartar respuestas obsoletas
  const myToken = siguienteFetchToken();

  // Timeout para cálculo de indicadores. 90s: el cómputo municipal en vivo de
  // amenaza/inundación lee la capa nacional de población y puede rondar ~50-60s.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90000);

  try {
    const body = {indicador_id: id, dept_code: deptActivo};
    if (municipio) body.municipio = municipio;
    const r = await fetch(API + '/api/indicadores/calcular', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      signal: ctrl.signal,
      body: JSON.stringify(body)
    });
    clearTimeout(timer);
    if (myToken !== _fetchToken) { window.OOT.log('[INDICADORES] Respuesta obsoleta descartada'); return; }
    if (!r.ok) {
      const err = await r.json().catch (() => ({}));
      const d = err.detail;
      throw new Error(
        typeof d === 'string' ? d 
        : Array.isArray(d) ? d.map(x => `${(x.loc || []).slice(1).join('.')}: ${x.msg}`).join('; ')
        : 'Error desconocido'
      );
    }
    const data = await r.json();
    if (myToken !== _fetchToken) return;
    if (window.OOT_DEBUG) window.OOT.log('Datos recibidos:', data);
    if (data.error === 'capa_no_disponible') {
      mostrarError(data.mensaje || 'Capa requerida no disponible en la GDB.');
      return;
    }
    mostrarResultado(data);
  } catch (e) {
    clearTimeout(timer);
    if (myToken !== _fetchToken) return;
    var msg = e.name === 'AbortError' 
      ? 'El cálculo tardó demasiado. Intente más tarde.' 
      : e.message;
    console.error('Error:', e);
    mostrarError(msg);
  }
}

export function mostrarInicial() {
  document.getElementById('panel-placeholder').style.display = 'flex';
  document.getElementById('panel-contenido').style.display = 'none';
  document.getElementById('map-loading').style.display = 'none';
  document.getElementById('map-error').style.display = 'none';
  document.getElementById('map-hint').style.display = 'block';
  limpiarCapas();  // ya destruye chartInstance y cancela _chartRafId
  document.querySelectorAll('.ind-card').forEach(c => c.classList.remove('active'));
  setIndicadorActivo(null);
  setDatosActuales(null);
  var _ctrl = document.getElementById('mapa-controles');
  if (_ctrl) _ctrl.innerHTML = '';
  const muniSelect = document.getElementById('municipio-select');
  if (muniSelect) muniSelect.value = '';
}

export function mostrarCargando(id) {
  document.getElementById('panel-placeholder').style.display = 'none';
  document.getElementById('panel-contenido').style.display = 'none';
  document.getElementById('map-loading').style.display = 'flex';
  document.getElementById('map-error').style.display = 'none';
  document.getElementById('map-hint').style.display = 'none';
  for (const inds of Object.values(catalogo)) {
    const ind = inds.find(i => i.id === id);
    if (ind) {
      document.getElementById('map-loading-titulo').textContent = 'Calculando: ' + ind.nombre;
      break;
    }
  }
}

export function mostrarError(msg) {
  document.getElementById('map-loading').style.display = 'none';
  document.getElementById('map-error').style.display = 'flex';
  document.getElementById('map-error-msg').textContent = msg;
  document.getElementById('panel-placeholder').style.display = 'flex';
  document.getElementById('panel-contenido').style.display = 'none';
}

function mostrarResultado(data) {
  setDatosActuales(data);
  document.getElementById('map-loading').style.display = 'none';
  document.getElementById('map-error').style.display = 'none';
  document.getElementById('map-hint').style.display = 'none';
  abrirVisor(data);
}

function abrirVisor(data) {
  document.getElementById('panel-placeholder').style.display = 'none';
  document.getElementById('panel-contenido').style.display = 'block';

  document.getElementById('vp-asunto').textContent = data.asunto;
  document.getElementById('vp-nombre').textContent = data.nombre;
  const badge = document.getElementById('vp-badge');
  badge.textContent = data.tipo === 'Simple' ? 'Puro' : data.tipo;
  badge.className = 'px-2 py-0.5 rounded-full text-xs font-bold ml-2 shrink-0 ' + (data.tipo === 'Compuesto' ? 'badge-compuesto' : 'badge-puro');

  let meta = null;
  for (const inds of Object.values(catalogo)) {
    const ind = inds.find(i => i.id === data.indicador_id);
    if (ind) { meta = ind; break; }
  }
  if (meta) {
    document.getElementById('vp-descripcion').textContent = meta.descripcion || '';
    const pqWrap = document.getElementById('vp-paraque-wrap');
    if (meta.para_que) {
      document.getElementById('vp-paraque').textContent = meta.para_que;
      pqWrap.style.display = '';
    } else {
      pqWrap.style.display = 'none';
    }
    document.getElementById('vp-fuente').textContent = meta.fuente || '';
    document.getElementById('vp-nivel').textContent = meta.nivel || '';
  }

  renderizarLeyenda(data.leyenda);
  renderizarStats(data.stats, data.unidad, data.indicador_id, data.leyenda);
  actualizarListaMunicipios();

  if (mapa.isStyleLoaded()) {
    cargarCapasEnMapa(data);
  } else {
    mapa.once('load', () => cargarCapasEnMapa(data));
  }
}

function cerrarVisor() {
  limpiarCapas();
  var _ctrl = document.getElementById('mapa-controles');
  if (_ctrl) _ctrl.innerHTML = '';
  document.getElementById('panel-placeholder').style.display = 'flex';
  document.getElementById('panel-contenido').style.display = 'none';
  document.getElementById('map-hint').style.display = 'block';
}
