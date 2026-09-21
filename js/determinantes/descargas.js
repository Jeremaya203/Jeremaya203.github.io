import { API, _shpWritePromise, datosResultado, reporteTexto, setShpWritePromise } from './estado.js';

async function descargarDesdeBackend(geojson, formato, nombre) {
  try {
    const r = await fetch(API + '/api/determinantes/descargar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ geojson, formato, nombre })
    });
    if (!r.ok) throw new Error('Error ' + r.status);
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre + (formato === 'shp' ? '.zip' : '.geojson');
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } catch(e) {
    console.error('[DETERMINANTES] Error descarga:', e);
    window.OOT.notify('Error al descargar: ' + e.message, 'error');
  }
}

export function descargarReporte() {
  let texto = reporteTexto;
  if (!texto && datosResultado) {
    // Generar reporte básico si no hay reporte_final (ej. consulta por predio)
    const dets = datosResultado.determinantes_zona || datosResultado.determinantes || [];
    const predios = datosResultado.predios || [];
    texto = 'REPORTE DE DETERMINANTES\n';
    texto += '========================\n\n';
    texto += 'Total determinantes: ' + dets.length + '\n';
    texto += 'Total predios: ' + predios.length + '\n';
    texto += 'Predios viables: ' + (datosResultado.predios_viables || []).length + '\n\n';
    if (dets.length > 0) {
      texto += 'DETERMINANTES ENCONTRADOS:\n';
      dets.forEach((d, i) => {
        texto += (i + 1) + '. ' + (d.nomdet || d.nombre || 'Sin nombre') + ' | ' + (d.categoria || '') + '\n';
      });
    }
    if (predios.length > 0) {
      texto += '\nPREDIOS ANALIZADOS:\n';
      predios.forEach((p, i) => {
        texto += (i + 1) + '. NPN: ' + (p.npn || 'N/A') + ' | Área: ' + (p.area || 'N/A') + ' | Veredicto: ' + (p.veredicto || 'N/A') + '\n';
      });
    }
  }
  if (!texto) { window.OOT.notify('No hay reporte para descargar', 'warn'); return; }
  const muni = document.getElementById('municipio');
  const codMpio = muni ? muni.value.split('|')[0] : 'nacional';
  const fecha = new Date().toISOString().slice(0, 10);
  const blob = new Blob([texto], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'reporte_determinantes_' + codMpio + '_' + fecha + '.txt';
  a.click();
}

function _geojsonParaDescarga() {
  if (!datosResultado) return null;
  if (datosResultado.modo === 'viabilidad') {
    return { gj: datosResultado.predios_geojson, nombre: 'viabilidad_predial' };
  }
  if (datosResultado.modo === 'consulta_predio') {
    return { gj: datosResultado.predios_geojson, nombre: 'predios' };
  }
  return { gj: datosResultado.determinantes_geojson, nombre: 'determinantes' };
}

// Descarga un Blob con un nombre dado (sin viaje al backend).
function _descargarBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function descargarDeterminantesGeoJSON() {
  const data = _geojsonParaDescarga();
  if (!data || !data.gj) { window.OOT.notify('No hay datos para exportar', 'warn'); return; }
  const muni = document.getElementById('municipio');
  const codMpio = muni ? muni.value.split('|')[0] : 'nacional';
  const fecha = new Date().toISOString().slice(0, 10);
  // El GeoJSON YA está en memoria → se serializa en el cliente (instantáneo, sin backend).
  const blob = new Blob([JSON.stringify(data.gj)], { type: 'application/geo+json' });
  _descargarBlob(blob, data.nombre + '_' + codMpio + '_' + fecha + '.geojson');
}

function _cargarShpWrite() {
  if (window.shpwrite) return Promise.resolve(window.shpwrite);
  if (_shpWritePromise) return _shpWritePromise;
  setShpWritePromise(new Promise((resolve, reject) => {
    const s = document.createElement('script');
    // Resuelto contra OOT_BASE para que funcione tambien publicado bajo un subpath
    // (p.ej. usuario.github.io/repo/). El comentario anterior hablaba de un catch-all
    // hacia static/, topologia que desaparecio con el split de repositorios.
    s.src = (window.OOT_BASE || '') + '/js/shpwrite.js';
    s.onload = () => resolve(window.shpwrite);
    s.onerror = () => reject(new Error('No se pudo cargar shp-write'));
    document.head.appendChild(s);
  }));
  return _shpWritePromise;
}

function _b64aBlob(b64, mime) {
  const bin = atob(b64), len = bin.length, bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export async function descargarDeterminantesSHP() {
  const data = _geojsonParaDescarga();
  if (!data || !data.gj) { window.OOT.notify('No hay datos para exportar', 'warn'); return; }
  const muni = document.getElementById('municipio');
  const codMpio = muni ? muni.value.split('|')[0] : 'nacional';
  const fecha = new Date().toISOString().slice(0, 10);
  const fname = data.nombre + '_' + codMpio + '_' + fecha;
  // 1) Generación en el CLIENTE (rápida, sin viaje al backend).
  try {
    const shpwrite = await _cargarShpWrite();
    if (shpwrite && typeof shpwrite.zip === 'function') {
      // Nombres distintos por tipo de geometría → evita colisión de .shp dentro del ZIP.
      const opts = { folder: fname,
        types: { point: fname + '_puntos', polygon: fname + '_poligonos',
                 polyline: fname + '_lineas', line: fname + '_lineas' } };
      let out = shpwrite.zip(data.gj, opts);
      if (out && typeof out.then === 'function') out = await out;   // por si una versión devuelve Promise
      const blob = (out instanceof Blob) ? out
                 : (typeof out === 'string') ? _b64aBlob(out, 'application/zip') : null;
      if (blob) { _descargarBlob(blob, fname + '.zip'); return; }
    }
  } catch (e) {
    console.warn('[SHP] generación en cliente falló, usando backend:', e);
  }
  // 2) Fallback al backend (p. ej. sin la librería disponible).
  descargarDesdeBackend(data.gj, 'shp', fname);
}
