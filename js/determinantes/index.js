import { ejecutarAnalisis } from './analisis.js';
import { descargarDeterminantesGeoJSON, descargarDeterminantesSHP, descargarReporte } from './descargas.js';
import { deshacerVertice, finalizarDibujo, iniciarDibujo } from './dibujo.js';
import { API, drawMode, mapa, setDrawCoords, setDrawMode } from './estado.js';
import { _mobCerrar, _mobTab, cambiarFuncion, mostrarTab, reiniciar } from './interfaz.js';
import { ajustarOpacidad, iniciarMapa, toggleCapa } from './mapa.js';
import { handleFileSelect, limpiarArchivo } from './zona.js';

// ===== VERIFICAR CARGA DE BIBLIOTECAS =====
window.OOT.log('[DETERMINANTES] Verificando bibliotecas...');

if (typeof maplibregl === 'undefined') {
  console.error('[DETERMINANTES] ERROR: maplibregl NO está cargado');
  document.getElementById('mapa-container').innerHTML = '<div class="oot-js-determinantes-11">ERROR: No se cargó maplibre-gl. Verifique su conexión.</div>';
} else {
  window.OOT.log('[DETERMINANTES] maplibregl OK:', typeof maplibregl);
}

window.OOT.log('[DETERMINANTES] API_base:', API, '| OOT_API_BASE:', window.OOT_API_BASE);

// ===== INICIALIZACIÓN =====
document.addEventListener('DOMContentLoaded', function() {
  window.OOT.log('[DETERMINANTES] DOM cargado, iniciando...');
  
  // Detectar modo desde URL (?modo=predio)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('modo') === 'predio' || urlParams.get('modo') === 'viabilidad') {
    window.OOT.log('[DETERMINANTES] Modo viabilidad detectado en URL');
    cambiarFuncion('viabilidad');
  }
  
  iniciarMapa();

  // Escape para cancelar dibujo
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && drawMode) {
      setDrawMode(false);
      setDrawCoords([]);
      const hintEl = document.getElementById('map-hint-det');
      if (hintEl) hintEl.classList.remove('active');
      if (mapa && mapa.getCanvas()) mapa.getCanvas().style.cursor = '';
      if (mapa && mapa.doubleClickZoom) mapa.doubleClickZoom.enable();
      // Limpiar dibujo temporal
      if (mapa) {
        ['draw-points','draw-polygon-line','draw-polygon'].forEach(lid => {
          if (mapa.getLayer(lid)) mapa.removeLayer(lid);
        });
        ['draw-points','draw-polygon'].forEach(sid => {
          if (mapa.getSource(sid)) mapa.removeSource(sid);
        });
      }
      const badge = document.getElementById('draw-vertex-badge');
      if (badge) badge.textContent = '0';
      window.OOT.log('[DETERMINANTES] Dibujo cancelado con Escape');
    }
  });
});

// Selector nacional de municipios ELIMINADO: era vestigial (la viabilidad detecta el
// municipio de la zona y la consulta de área es dirigida por la geometría). Se quitó el
// <select>, su carga (cargarSelectorMunicipios) y el catálogo DEPARTAMENTOS.

window.OOT.loadShell();

// ── Mobile tab bar ──────────────────────────────────────────────────────────
(function() {
  const bar = document.createElement('div');
  bar.className = 'mob-tabs';
  bar.innerHTML =
    '<button class="mob-tab active" id="mob-config" data-oot-click="_mobTab" data-oot-arg="config">' +
      '<span class="material-symbols-outlined">tune</span>Config</button>' +
    '<button class="mob-tab" id="mob-mapa" data-oot-click="_mobTab" data-oot-arg="mapa">' +
      '<span class="material-symbols-outlined">map</span>Mapa</button>' +
    '<button class="mob-tab" id="mob-results" data-oot-click="_mobTab" data-oot-arg="results">' +
      '<span class="material-symbols-outlined">analytics</span>Resultados</button>';
  document.body.appendChild(bar);
})();

/* Registro de manejadores. Con `<script type="module">` esto YA NO es redundante: en un
   modulo ES las `function` de nivel superior no se cuelgan de `window`, asi que el
   respaldo por `window` de oot.js no las encuentra. Todo `data-oot-*` de esta pagina
   tiene que estar en este mapa o el boton queda mudo — lo comprueba `verificar.py`.
   Se llama `manejadores` y no `mapa` para no tapar el mapa importado. */
(function registrarHandlers() {
  const manejadores = {
    cambiarFuncion,
    ejecutarAnalisis,
    iniciarDibujo,
    finalizarDibujo,
    deshacerVertice,
    handleFileSelect,
    limpiarArchivo,
    descargarDeterminantesGeoJSON,
    descargarDeterminantesSHP,
    descargarReporte,
    reiniciar,
    toggleCapa,
    mostrarTab,
    ajustarOpacidad,
    _mobCerrar,
    _mobTab,
  };
  const registrar = () => {
    if (!(window.OOT && window.OOT.registrarTodos)) return false;
    window.OOT.registrarTodos(manejadores);
    return true;
  };
  // oot.js se carga antes que este archivo en todas las paginas; el listener es la red
  // por si alguna pagina futura invierte el orden.
  if (!registrar()) document.addEventListener('DOMContentLoaded', registrar);
})();
