import { actualizarDibujo, finalizarDibujo } from './dibujo.js';
import { _popupHandlers, drawCoords, drawMode, mapa, setMapa, setPopupHandlers } from './estado.js';

export function iniciarMapa() {
  window.OOT.log('[DETERMINANTES] === iniciarMapa() ===');
  const container = document.getElementById('mapa-container');
  if (!container) {
    console.error('[DETERMINANTES] ERROR: No se encontró #mapa-container');
    return;
  }
  window.OOT.log('[DETERMINANTES] Container encontrado:', container.id);
  
  try {
    window.OOT.log('[DETERMINANTES] Creando mapa con maplibregl.Map...');
    setMapa(new maplibregl.Map({
      container: 'mapa-container',
      style: {
        version: 8,
        sources: {
          'osm': {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap'
          }
        },
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
      },
      center: [-73.5, 4.6],
      zoom: 5
    }));

    mapa.on('load', function() {
      // Cobertura nacional: no se dibuja borde de departamento inicial
      // ningún borde departamental por defecto. El mapa se reencuadra a la zona
      // de análisis cuando el usuario la sube o dibuja.
      window.OOT.log('[DETERMINANTES] Mapa listo (cobertura nacional).');
    });

    // Puntero grueso (celular/tablet): en táctil el evento 'click' sintético de
    // MapLibre no siempre dispara si el dedo se mueve un poco (se interpreta como
    // paneo) → los toques no colocaban vértices. Detectamos el "tap" a mano.
    // No se decide una sola vez por matchMedia('(pointer: coarse)'): un portatil con
    // pantalla tactil reporta coarse y entonces el raton dejaba de colocar vertices.
    // Se marca cuando llega un toque real y se ignora el 'click' sintetico posterior.
    let _ultimoTouch = 0;
    function _agregarVertice(lngLat) {
      drawCoords.push([lngLat.lng, lngLat.lat]);
      actualizarDibujo();
    }

    // Mouse (puntero fino): usar 'click'.
    mapa.on('click', function(e) {
      // 500 ms: ventana en la que el navegador emite el click sintetico tras un toque.
      if (drawMode && (Date.now() - _ultimoTouch) > 500) _agregarVertice(e.lngLat);
    });

    // Táctil: agregar vértice al levantar el dedo si fue un toque (poco movimiento),
    // no un paneo. Así se preserva el paneo (>14px) y cada tap coloca un punto.
    let _touchTap = null;
    mapa.on('touchstart', function(e) {
      if (!drawMode) { _touchTap = null; return; }
      _ultimoTouch = Date.now();
      const t = (e.points && e.points.length === 1) ? e.points[0] : null;
      _touchTap = t ? { x: t.x, y: t.y, ts: Date.now() } : null;
    });
    mapa.on('touchend', function(e) {
      _ultimoTouch = Date.now();
      if (!drawMode || !_touchTap) { _touchTap = null; return; }
      const pt = (e.points && e.points[0]) || e.point;
      const moved = pt ? Math.hypot(pt.x - _touchTap.x, pt.y - _touchTap.y) : 0;
      const dt = Date.now() - _touchTap.ts;
      _touchTap = null;
      if (moved <= 14 && dt <= 700) _agregarVertice(e.lngLat);
    });

    mapa.on('dblclick', function(e) {
      if (drawMode && drawCoords.length >= 3) {
        finalizarDibujo();
      }
    });

  if (window.ResizeObserver) {
    new ResizeObserver(() => mapa.resize())
      .observe(document.getElementById('mapa-container'));
  }  
    window.OOT.log('[DETERMINANTES] Mapa creado');
  } catch(e) {
    console.error('[DETERMINANTES] Error creando mapa:', e);
  }
}

export function agregarCapaMapa(id, geojson, tipo, color, opacidad, outline) {
  if (!mapa || !geojson) { console.warn('[MAP] No mapa o geojson:', id); return; }
  if (mapa.getLayer(id)) mapa.removeLayer(id);
  if (mapa.getLayer(id + '-outline')) mapa.removeLayer(id + '-outline');
  if (mapa.getSource(id)) mapa.removeSource(id);
  
  mapa.addSource(id, { type: 'geojson', data: geojson });
  
  if (tipo === 'fill') {
    mapa.addLayer({ id: id, type: 'fill', source: id,
      paint: { 'fill-color': color, 'fill-opacity': opacidad || 0.5 }
    });
    if (outline !== false) {
      mapa.addLayer({ id: id + '-outline', type: 'line', source: id,
        paint: { 'line-color': color, 'line-width': 2, 'line-opacity': 0.9 }
      });
    }
  }
}

export function ajustarOpacidad(val) {
  const op = parseInt(val, 10) / 100;
  const valEl = document.getElementById('opacity-val');
  if (valEl) valEl.textContent = val + '%';
  if (!mapa) return;
  if (mapa.getLayer('determinantes-polygons')) mapa.setPaintProperty('determinantes-polygons', 'fill-opacity', op);
  if (mapa.getLayer('determinantes-lines')) mapa.setPaintProperty('determinantes-lines', 'line-opacity', op);
  if (mapa.getLayer('determinantes-points')) mapa.setPaintProperty('determinantes-points', 'circle-opacity', op);
}

export function toggleCapa(tipo) {
  if (!mapa) return;
  const ids = {
    polygons: ['determinantes-polygons', 'determinantes-polygons-outline'],
    lines: ['determinantes-lines'],
    points: ['determinantes-points']
  };
  const checkbox = document.getElementById('toggle-' + tipo);
  const visible = checkbox ? checkbox.checked : true;
  (ids[tipo] || []).forEach(lid => {
    if (mapa.getLayer(lid)) mapa.setLayoutProperty(lid, 'visibility', visible ? 'visible' : 'none');
  });
}

export function _limpiarPopupHandlers() {
  if (!mapa) return;
  _popupHandlers.forEach(h => { try { mapa.off(h.event, h.layer, h.fn); } catch(e) {} });
  setPopupHandlers([]);
}
