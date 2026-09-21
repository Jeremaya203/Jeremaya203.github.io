import { mapa } from './estado.js';

export function _mobIndCerrar() {
  ['ind-aside','ind-stats'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('mob-visible');
  });
  const bd = document.getElementById('mob-backdrop-ind');
  if (bd) bd.style.display = 'none';
  ['mob-ind-indic','mob-ind-mapa','mob-ind-stats'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
  });
  const mapaTab = document.getElementById('mob-ind-mapa');
  if (mapaTab) mapaTab.classList.add('active');
}

export function _mobIndTab(tab) {
  if (window.innerWidth > 900) return;
  _mobIndCerrar();
  const tabEl = document.getElementById('mob-ind-' + tab);
  if (tabEl) tabEl.classList.add('active');
  const bd = document.getElementById('mob-backdrop-ind');
  if (tab === 'indic') {
    const el = document.getElementById('ind-aside');
    if (el) el.classList.add('mob-visible');
    if (bd) bd.style.display = 'block';
  } else if (tab === 'stats') {
    const el = document.getElementById('ind-stats');
    if (el) el.classList.add('mob-visible');
    if (bd) bd.style.display = 'block';
  }
}

/* ── Registro de manejadores (ver oot.js) ─────────────────────────────────────
   Los data-oot-click del HTML se resuelven contra este registro. Mientras exista el
   respaldo por `window` esto es redundante, pero es lo que permite que estas funciones
   dejen de ser globales sin que los botones se queden mudos. */
