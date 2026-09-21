import { mapa, modoActual, rutaZona, setDatosResultado, setDrawCoords, setDrawMode, setModoActual, setReporteTexto, setRutaZona, setZonaGeoJSON, zonaGeoJSON } from './estado.js';
import { limpiarArchivo } from './zona.js';

export function cambiarFuncion(modo) {
  window.OOT.log('[DETERMINANTES] cambiarFuncion:', modo, '-> modoActual:', modoActual);
  setModoActual(modo);
  const esArea = modo === 'consulta_area';
  const esViab = modo === 'viabilidad';

  // Actualizar pestañas (Consulta de área / Viabilidad predial)
  const tabCons = document.getElementById('tab-consulta');
  const tabViab = document.getElementById('tab-viabilidad');
  if (tabCons) {
    tabCons.style.background = esArea ? 'var(--oot-ochre)' : 'var(--oot-s2)';
    tabCons.style.color = esArea ? '#fff' : 'var(--oot-tx2)';
    tabCons.style.border = esArea ? 'none' : '1px solid var(--oot-b2)';
  }
  if (tabViab) {
    tabViab.style.background = esViab ? 'var(--oot-ochre)' : 'var(--oot-s2)';
    tabViab.style.color = esViab ? '#fff' : 'var(--oot-tx2)';
    tabViab.style.border = esViab ? 'none' : '1px solid var(--oot-b2)';
  }

  // Actualizar título de la zona a cargar según el modo
  const uploadTitulo = document.getElementById('upload-titulo');
  if (uploadTitulo) uploadTitulo.textContent = esArea ? 'Zona de Consulta' : 'Zona de Interés';

  // Actualizar el texto del botón de acción principal
  const btnTxt = document.getElementById('btn-ejecutar-txt');
  if (btnTxt) btnTxt.textContent = esArea ? 'Consultar Determinantes en Área' : 'Analizar Viabilidad Predial';

  // Ocultar el campo NPN (heredado del antiguo consulta_predio)
  const paramsNpn = document.getElementById('params-npn');
  if (paramsNpn) paramsNpn.style.display = 'none';

  // Mostrar/ocultar la sección de reglas (solo en consulta de área)
  const reglasSection = document.getElementById('reglas-section');
  if (reglasSection) reglasSection.style.display = esArea ? 'block' : 'none';

  // Mostrar/ocultar el uso pretendido (solo en viabilidad)
  const usoSection = document.getElementById('uso-pretendido-section');
  if (usoSection) usoSection.style.display = esViab ? 'block' : 'none';

  // B.1.4 — El área mínima filtra predios y solo la usa viabilidad; consulta_area la recibe
  // pero la ignora, así que mostrarla en ese modo confundía (parecía un control sin efecto).
  const areaMinSection = document.getElementById('area-minima-section');
  if (areaMinSection) areaMinSection.style.display = esViab ? 'block' : 'none';

  // B.1.8 — La leyenda describe los veredictos (Compatible/Condicionado/No viable), que solo
  // se emiten en viabilidad. En consulta de área no hay veredictos que leer.
  const leyendaSection = document.getElementById('ie-determinantes-26');
  if (leyendaSection) leyendaSection.style.display = esViab ? 'block' : 'none';

  if (rutaZona || zonaGeoJSON) reiniciar();
  else mostrarStep('upload');
}

export function mostrarStep(step) {
  window.OOT.log('[DETERMINANTES] mostrarStep:', step);

  // Animación de "agentes procesando" SOBRE el mapa: visible solo al procesar
  const animOv = document.getElementById('mapa-anim-overlay');
  const animVid = document.getElementById('proc-anim');
  if (animOv) {
    if (step === 'processing') {
      animOv.style.display = 'flex';
      if (animVid) { try { animVid.currentTime = 0; animVid.play(); } catch (e) {} }
    } else {
      animOv.style.display = 'none';
      if (animVid) { try { animVid.pause(); } catch (e) {} }
    }
  }

  // Ocultar todos los steps (limpiar también style.display inline que pueda persistir)
  document.querySelectorAll('.step').forEach(el => {
    el.classList.remove('active');
    el.style.display = '';
  });
  
  // Manejar el placeholder
  const placeholder = document.getElementById('placeholder');
  if (placeholder) {
    if (step === 'upload' || step === 'placeholder') {
      placeholder.style.display = 'flex';
      window.OOT.log('[DETERMINANTES] Mostrando placeholder');
      return;
    } else {
      placeholder.style.display = 'none';
    }
  }
  
  // Mostrar step específico
  const stepEl = document.getElementById('step-' + step);
  if (stepEl) {
    stepEl.classList.add('active');
    window.OOT.log('[DETERMINANTES] Step shown:', step);
  } else {
    console.warn('[DETERMINANTES] Step no encontrado: step-' + step);
    // Si no existe, mostrar placeholder
    if (placeholder) placeholder.style.display = 'flex';
  }
}

export function actualizarProceso(n) {
  window.OOT.log('[DETERMINANTES] actualizarProceso:', n);
  for (let i = 1; i <= 3; i++) {
    const el = document.getElementById('step' + i);
    if (!el) { console.warn('[DETERMINANTES] No step' + i); continue; }
    const icon = el.querySelector('.material-symbols-outlined');
    if (icon) icon.textContent = (i < n) ? 'check_circle' : (i === n ? 'radio_button_checked' : 'radio_button_unchecked');
    el.style.color = (i < n) ? 'var(--oot-teal)' : (i === n ? 'var(--oot-ochre)' : 'var(--oot-tx3)');
  }
}

export function _setProcesoPasos(pasos) {
  pasos.forEach(function(txt, i) {
    const el = document.getElementById('step' + (i + 1));
    if (!el) return;
    const spans = el.querySelectorAll('span');
    if (spans.length >= 2) spans[1].textContent = txt;
  });
}

export function mostrarTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  const panelDet = document.getElementById('panel-determinantes');
  const panelMapa = document.getElementById('panel-mapa');
  if (panelDet) panelDet.style.display = (tab === 'determinantes') ? 'block' : 'none';
  if (panelMapa) panelMapa.style.display = (tab === 'mapa') ? 'block' : 'none';
}

export function reiniciar() {
  window.OOT.log('[DETERMINANTES] reiniciar() called');
  setDrawCoords([]);
  setZonaGeoJSON(null);
  setRutaZona(null);
  setReporteTexto('');
  setDatosResultado(null);
  setDrawMode(false);
  
  // Limpiar UI
  limpiarArchivo();
  const reglasList = document.getElementById('reglas-list');
  const detsList = document.getElementById('determinantes-list');
  if (reglasList) reglasList.innerHTML = '';
  if (detsList) detsList.innerHTML = '';
  
  // Limpiar mapa
  if (mapa) {
    ['zona-source','zona-source-outline','zona-consulta','zona-consulta-line',
     'draw-polygon','draw-polygon-line','draw-points',
     'determinantes-polygons','determinantes-polygons-outline','determinantes-lines',
     'determinantes-points','predios-layer','predios-outline'].forEach(lid => {
      if (mapa.getLayer(lid)) mapa.removeLayer(lid);
    });
    ['zona-source','zona-consulta','draw-polygon','draw-points',
     'determinantes-polygons','determinantes-lines','determinantes-points','predios-source'].forEach(sid => {
      if (mapa.getSource(sid)) mapa.removeSource(sid);
    });
  }
  
  // Reset steps usando clases, no inline display
  const stepResults = document.getElementById('step-results');
  const stepError = document.getElementById('step-error');
  if (stepResults) stepResults.classList.remove('active');
  if (stepError) stepError.classList.remove('active');
  
  // Volver a placeholder
  const placeholder = document.getElementById('placeholder');
  if (placeholder) placeholder.style.display = 'flex';
  
  const badge = document.getElementById('draw-vertex-badge');
  if (badge) badge.textContent = '0';
  const btnFin = document.getElementById('btn-finalizar-zona');
  if (btnFin) { btnFin.disabled = true; btnFin.style.opacity = '0.4'; }
}

export function _mobCerrar() {
  document.querySelectorAll('.panel-left,.panel-right').forEach(p => p.classList.remove('mob-visible'));
  const bd = document.getElementById('mob-backdrop');
  if (bd) bd.style.display = 'none';
  ['mob-config','mob-mapa','mob-results'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
  });
  const mapaTab = document.getElementById('mob-mapa');
  if (mapaTab) mapaTab.classList.add('active');
}

export function _mobTab(tab) {
  const isMobile = window.innerWidth <= 900;
  if (!isMobile) return;
  _mobCerrar();
  const bd = document.getElementById('mob-backdrop');
  const tabEl = document.getElementById('mob-' + tab);
  if (tabEl) tabEl.classList.add('active');
  if (tab === 'config') {
    const pl = document.querySelector('.panel-left');
    if (pl) pl.classList.add('mob-visible');
    if (bd) bd.style.display = 'block';
  } else if (tab === 'results') {
    const pr = document.querySelector('.panel-right');
    if (pr) pr.classList.add('mob-visible');
    if (bd) bd.style.display = 'block';
  }
  // 'mapa' → sólo el mapa visible (ya limpió los drawers)
}

/* ── Registro de manejadores (ver oot.js) ─────────────────────────────────────
   Los data-oot-click del HTML se resuelven contra este registro. Mientras exista el
   respaldo por `window` esto es redundante, pero es lo que permite que estas funciones
   dejen de ser globales sin que los botones se queden mudos. */
