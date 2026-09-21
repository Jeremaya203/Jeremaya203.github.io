import { API, _chartRafId, _mapHandlers, _nacionalPopup, chartInstance, deptActivo, escalaActiva, escapeHtml, mapa, setChartInstance, setChartRafId, setMapHandlers, setMapa, setNacionalPopup } from './estado.js';
import { _limpiarHighlight } from './panel.js';

export function inicializarMapa() {
  if (window.OOT_DEBUG) window.OOT.log('Inicializando mapa...');
  // Protocolo PMTiles (vector tiles de los indicadores de polígonos), registrado 1 sola vez.
  if (window.pmtiles && !window._pmtilesReg) {
    maplibregl.addProtocol('pmtiles', new pmtiles.Protocol().tile);
    window._pmtilesReg = true;
  }
  setMapa(new maplibregl.Map({
    container: 'mapa-container',
    style: {
      version: 8,
      sources: {
        osm: {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '© OpenStreetMap'
        }
      },
      layers: [{id: 'osm', type: 'raster', source: 'osm'}]
    },
    center: [-73.5, 4.6],
    zoom: 4.3
  }));
  mapa.addControl(new maplibregl.NavigationControl(), 'top-right');
  mapa.addControl(new maplibregl.ScaleControl(), 'bottom-right');
  
  mapa.on('load', () => {
    if (window.OOT_DEBUG) window.OOT.log('Mapa cargado');
    mapa.addSource('dept-ref', {type: 'geojson', data: {type:'FeatureCollection', features:[]}, tolerance: 0});
    mapa.addLayer({
      id: 'dept-ref-fill', type: 'fill', source: 'dept-ref',
      paint: {'fill-color': '#c8573e', 'fill-opacity': 0.04}
    });
    mapa.addLayer({
      id: 'dept-ref-borde', type: 'line', source: 'dept-ref',
      paint: {'line-color': '#c8573e', 'line-width': 2, 'line-dasharray': [5, 3]}
    });
    // Borde del municipio seleccionado (escala municipal) — emphasis sólido
    mapa.addSource('muni-ref', {type: 'geojson', data: {type:'FeatureCollection', features:[]}, tolerance: 0});
    mapa.addLayer({
      id: 'muni-ref-fill', type: 'fill', source: 'muni-ref',
      paint: {'fill-color': '#0d9488', 'fill-opacity': 0.05}
    });
    mapa.addLayer({
      id: 'muni-ref-borde', type: 'line', source: 'muni-ref',
      paint: {'line-color': '#0d9488', 'line-width': 2.5}
    });
    // En escala nacional no dibujamos borde de dept (el default abre en nacional)
    if (escalaActiva !== 'nacional') actualizarBordeDept(deptActivo);

    if (window.ResizeObserver) {
      new ResizeObserver(() => mapa.resize())
        .observe(document.getElementById('mapa-container'));
    }
  });
}

export function actualizarBordeMunicipio(code, zoomAlMuni) {
  if (!mapa || !mapa.getSource('muni-ref')) return;
  if (!code) {
    mapa.getSource('muni-ref').setData({type:'FeatureCollection', features:[]});
    return;
  }
  fetch(API + '/api/geo/municipio/' + code)
    .then(r => r.json())
    .then(gj => {
      mapa.getSource('muni-ref').setData(gj);
      if (zoomAlMuni && gj && gj.features && gj.features.length > 0) {
        const bounds = new maplibregl.LngLatBounds();
        function _ext(arr) {
          if (!Array.isArray(arr)) return;
          if (typeof arr[0] === 'number') { bounds.extend(arr); return; }
          arr.forEach(_ext);
        }
        gj.features.forEach(f => { if (f.geometry?.coordinates) _ext(f.geometry.coordinates); });
        if (!bounds.isEmpty()) mapa.fitBounds(bounds, { padding: 50, maxZoom: 12, duration: 800 });
      }
    })
    .catch(() => {});
}

export function actualizarBordeDept(code, zoomAlDept) {
  if (!mapa || !mapa.getSource('dept-ref')) return;
  fetch(API + '/api/geo/departamento/' + (code || '47'))
    .then(r => r.json())
    .then(gj => {
      mapa.getSource('dept-ref').setData(gj);
      if (zoomAlDept && gj && gj.features && gj.features.length > 0) {
        const bounds = new maplibregl.LngLatBounds();
        function _ext(arr) {
          if (!Array.isArray(arr)) return;
          if (typeof arr[0] === 'number') { bounds.extend(arr); return; }
          arr.forEach(_ext);
        }
        gj.features.forEach(f => { if (f.geometry?.coordinates) _ext(f.geometry.coordinates); });
        if (!bounds.isEmpty()) mapa.fitBounds(bounds, { padding: 40, maxZoom: 10, duration: 800 });
      }
    })
    .catch(() => {});
}

export function _colorPorCategoria(leyenda) {
  const mapa_col = {};
  if (leyenda) leyenda.forEach(l => { mapa_col[l.label] = l.color; });
  return mapa_col;
}

function _extraerCoordenadas(geometry) {
  const coords = [];
  function _rec(arr) {
    if (!Array.isArray(arr)) return;
    if (typeof arr[0] === 'number') { coords.push(arr); return; }
    arr.forEach(_rec);
  }
  _rec(geometry.coordinates);
  return coords;
}

function _limpiarMapHandlers() {
  if (!mapa) return;
  _mapHandlers.forEach(h => {
    try { mapa.off(h.event, h.layer, h.fn); } catch (e) {}
  });
  setMapHandlers([]);
}

export function limpiarCapas() {
  if (!mapa) return;
  _limpiarMapHandlers();
  _limpiarHighlight();
  if (_nacionalPopup) { _nacionalPopup.remove(); setNacionalPopup(null); }
  if (_chartRafId) { cancelAnimationFrame(_chartRafId); setChartRafId(null); }
  if (chartInstance) { chartInstance.destroy(); setChartInstance(null); }
  const style = mapa.getStyle();
  if (!style) return;
  (style.layers || []).forEach(l => {
    if (l.id.startsWith('lyr-') || l.id.startsWith('src-') || l.id.startsWith('highlight-')) {
      if (mapa.getLayer(l.id)) mapa.removeLayer(l.id);
    }
  });
  Object.keys(style.sources || {}).forEach(s => {
    if (s.startsWith('src-') || s.startsWith('highlight-')) {
      if (mapa.getSource(s)) mapa.removeSource(s);
    }
  });
}

export function agregarToggleCapa(nombre, color, layerId) {
  const cont = document.getElementById('mapa-controles');
  if (!cont) return;
  const btn = document.createElement('button');
  btn.className = 'capa-btn activa';
  btn.style.setProperty('--color', color);
  btn.dataset.layer = layerId;
  btn.innerHTML = '<span class="capa-dot"></span> ' + escapeHtml(String(nombre).replace(/_/g, ' '));
  btn.onclick = () => toggleCapa(btn, layerId, color);
  cont.appendChild(btn);
}

export function toggleCapa(btn, layerId, color) {
  const fills = [layerId + '-fill', layerId, layerId + '-line'];
  const activa = btn.classList.contains('activa');
  fills.forEach(id => {
    if (mapa.getLayer(id)) mapa.setLayoutProperty(id, 'visibility', activa ? 'none' : 'visible');
  });
  btn.classList.toggle('activa', !activa);
}
