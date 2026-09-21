import { API, NOMBRES_DEPTS, _municipiosCache, deptActivo, escalaActiva, escapeHtml, indicadorActivo, mapa, setDeptActivo, setEscalaActiva } from './estado.js';
import { seleccionarIndicador } from './indicador.js';
import { actualizarBordeDept, actualizarBordeMunicipio, limpiarCapas } from './mapa.js';

export function cambiarEscala(escala) {
  setEscalaActiva(escala);
  if (escala !== 'municipal') actualizarBordeMunicipio(null);  // ocultar borde muni fuera de escala municipal
  document.querySelectorAll('.scale-btn').forEach(b => {
    const active = b.dataset.scale === escala;
    b.style.background = active ? 'var(--oot-azul)' : 'transparent';
    // Correcciones 2026-09-01: el inactivo va en #e0e8f2 (documento p.5). Se fija aqui
    // porque este estilo inline pisa cualquier regla CSS en cuanto se cambia de escala.
    b.style.color = active ? '#fff' : '#e0e8f2';
  });
  const deptSec = document.getElementById('dept-filter-section');
  const muniSec = document.getElementById('municipio-filter-section');
  if (!deptSec || !muniSec) return;
  if (escala === 'nacional') {
    if (mapa && mapa.getSource('dept-ref'))
      mapa.getSource('dept-ref').setData({type:'FeatureCollection', features:[]});
    deptSec.style.display = 'none';
    muniSec.style.display = 'none';
  } else {
    deptSec.style.display = '';
    if (escala === 'departamental') muniSec.style.display = 'none';
    else if (escala === 'municipal') actualizarListaMunicipios();  // poblar lista al entrar a municipal
    actualizarBordeDept(deptActivo, escala === 'departamental' || escala === 'municipal');
  }
  actualizarScopeLabel();
  // Limpiar el mapa de inmediato ANTES de recargar, para que la capa anterior (p.ej. el
  // choropleth nacional) no persista en el hueco asíncrono si la nueva tarda en cargar.
  if (indicadorActivo) { limpiarCapas(); seleccionarIndicador(indicadorActivo); }
}

export function actualizarScopeLabel() {
  const el = document.getElementById('scope-label-text');
  if (!el) return;
  if (escalaActiva === 'nacional') {
    el.textContent = 'Colombia';
  } else if (escalaActiva === 'departamental') {
    el.textContent = NOMBRES_DEPTS[deptActivo] || deptActivo;
  } else {
    const muniSel = document.getElementById('municipio-select');
    const deptNom = NOMBRES_DEPTS[deptActivo] || deptActivo;
    const muniNom = muniSel && muniSel.value
      ? muniSel.options[muniSel.selectedIndex]?.text || muniSel.value
      : null;
    el.textContent = muniNom ? deptNom + ' › ' + muniNom : deptNom;
  }
}

async function cargarMunicipios(dept) {
  const key = dept || deptActivo || '47';
  if (_municipiosCache[key]) return _municipiosCache[key];
  try {
    const r = await fetch(API + '/api/geo/municipios?dept=' + key);
    if (r.ok) {
      _municipiosCache[key] = await r.json();
      return _municipiosCache[key];
    }
  } catch (e) { console.warn('No se pudieron cargar municipios:', e); }
  return [];
}

// Puebla y muestra el selector de municipio en escala municipal — independiente
// de tener un indicador seleccionado (la lista aparece al entrar a la escala).
export async function actualizarListaMunicipios() {
  const section = document.getElementById('municipio-filter-section');
  const select = document.getElementById('municipio-select');
  if (!section || !select) return;
  if (escalaActiva !== 'municipal') { section.style.display = 'none'; return; }
  const municipios = await cargarMunicipios(deptActivo);
  if (!municipios.length) { section.style.display = 'none'; return; }
  const valorActual = select.value;
  select.innerHTML = '<option value="">Todos los municipios</option>' +
    municipios.map(m => `<option value="${escapeHtml(m.codigo)}"${m.codigo === valorActual ? ' selected' : ''}>${escapeHtml(m.nombre)}</option>`).join('');
  section.style.display = 'block';
}

export async function filtrarPorMunicipio(codigoMunicipio) {
  actualizarScopeLabel();
  if (codigoMunicipio) {
    actualizarBordeMunicipio(codigoMunicipio, true);
  } else {
    actualizarBordeMunicipio(null);
    actualizarBordeDept(deptActivo, true);  // sin municipio → re-zoom al dept
  }
  // El borde/zoom del municipio se muestra aunque aún no haya indicador elegido;
  // el cálculo solo corre si ya hay uno activo.
  if (indicadorActivo) await seleccionarIndicador(indicadorActivo, codigoMunicipio || undefined);
}

export async function cargarDepartamentos() {
  try {
    const r = await fetch(API + '/api/indicadores/departamentos');
    if (!r.ok) return;
    const d = await r.json();
    const depts = d.departamentos || [];
    const section = document.getElementById('dept-filter-section');
    const select = document.getElementById('dept-select');
    if (!section || !select) return;
    if (depts.length <= 1) { section.style.display = 'none'; return; }
    select.innerHTML = depts.map(code =>
      `<option value="${escapeHtml(code)}"${code === deptActivo ? ' selected' : ''}>${escapeHtml(NOMBRES_DEPTS[code] || code)}</option>`
    ).join('');
    // En nacional la sección de dept va oculta (la controla cambiarEscala)
    section.style.display = (escalaActiva === 'nacional') ? 'none' : '';
  } catch(e) { console.warn('No se pudieron cargar departamentos:', e); }
}

export function cambiarDepartamento(code) {
  setDeptActivo(code || '47');
  actualizarBordeDept(deptActivo, true);
  actualizarBordeMunicipio(null);  // municipio reseteado al cambiar de dept
  const muniSelect = document.getElementById('municipio-select');
  if (muniSelect) muniSelect.value = '';
  if (escalaActiva === 'municipal') {
    actualizarListaMunicipios();  // repoblar lista con los municipios del nuevo dept
  } else {
    const muniSection = document.getElementById('municipio-filter-section');
    if (muniSection) muniSection.style.display = 'none';
  }
  actualizarScopeLabel();
  // Limpiar el mapa de inmediato ANTES de recargar, para que la capa anterior (p.ej. el
  // choropleth nacional) no persista en el hueco asíncrono si la nueva tarda en cargar.
  if (indicadorActivo) { limpiarCapas(); seleccionarIndicador(indicadorActivo); }
}
