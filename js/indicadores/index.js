import { toggleAsunto, cargarCatalogo, filtrarIndicadores } from './catalogo.js';
import { actualizarScopeLabel, cambiarDepartamento, cambiarEscala, cargarDepartamentos, filtrarPorMunicipio } from './escala.js';
import { mapa, setDeptActivo } from './estado.js';
import { mostrarInicial, seleccionarIndicador } from './indicador.js';
import { _mobIndCerrar, _mobIndTab } from './interfaz.js';
import { inicializarMapa, toggleCapa } from './mapa.js';

// Ejecutar después de que el DOM esté listo
window.addEventListener('DOMContentLoaded', function() {
  inicializarMapa();
  cargarDepartamentos();
  actualizarScopeLabel();
  cargarCatalogo().then(() => {
    const params = new URLSearchParams(window.location.search);
    const urlDept = params.get('dept');
    const urlId = params.get('indicador');
    if (urlDept) {
      // Si viene un dept en la URL, abrir en escala departamental
      setDeptActivo(urlDept);
      const s = document.getElementById('dept-select');
      if (s) s.value = urlDept;
      cambiarEscala('departamental');
    } else {
      cambiarEscala('nacional');  // default: Colombia
    }
    if (urlId) seleccionarIndicador(urlId);
  });
});

window.OOT.loadShell();

// ── Mobile tab bar ──────────────────────────────────────────────────────────
(function() {
  const bar = document.createElement('div');
  bar.className = 'mob-tabs-ind';
  bar.innerHTML =
    '<button class="mob-tab-ind" id="mob-ind-indic" data-oot-click="_mobIndTab" data-oot-arg="indic">' +
      '<span class="material-symbols-outlined">bar_chart</span>Indicadores</button>' +
    '<button class="mob-tab-ind active" id="mob-ind-mapa" data-oot-click="_mobIndTab" data-oot-arg="mapa">' +
      '<span class="material-symbols-outlined">map</span>Mapa</button>' +
    '<button class="mob-tab-ind" id="mob-ind-stats" data-oot-click="_mobIndTab" data-oot-arg="stats">' +
      '<span class="material-symbols-outlined">analytics</span>Estadísticas</button>';
  document.body.appendChild(bar);
})();

/* Registro de manejadores. Con `<script type="module">` esto YA NO es redundante: en un
   modulo ES las `function` de nivel superior no se cuelgan de `window`, asi que el
   respaldo por `window` de oot.js no las encuentra. Todo `data-oot-*` de esta pagina
   tiene que estar en este mapa o el control queda mudo — lo comprueba `verificar.py`.
   Se llama `manejadores` y no `mapa` para no tapar el mapa importado. */
(function registrarHandlers() {
  const manejadores = {
    cambiarEscala,
    cambiarDepartamento,
    filtrarPorMunicipio,
    filtrarIndicadores,
    seleccionarIndicador,
    mostrarInicial,
    toggleCapa,
    _mobIndCerrar,
    _mobIndTab,
    toggleAsunto,
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
