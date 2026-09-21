import { drawCoords, drawMode, mapa, setDrawCoords, setDrawMode, setRutaZona, setZonaGeoJSON, zonaGeoJSON } from './estado.js';
import { _mobTab } from './interfaz.js';
import { mostrarArchivoCargado } from './zona.js';

export function iniciarDibujo() {
  window.OOT.log('[DETERMINANTES] === iniciarDibujo() ===');
  window.OOT.log('[DETERMINANTES] mapa:', mapa ? 'EXISTE' : 'NULL');
  
  if (!mapa) { 
    window.OOT.notify('El mapa no está cargado. Recargue la página y espere a que se inicialice.', 'error');
    return; 
  }
  
  // Verificar que el mapa esté listo
  if (!mapa.isStyleLoaded()) {
    window.OOT.log('[DETERMINANTES] Mapa aún no está listo, esperando...');
    mapa.once('idle', function() {
      iniciarDibujo();
    });
    return;
  }
  
  setDrawMode(true);
  setDrawCoords([]);
  const hintEl = document.getElementById('map-hint-det');
  if (hintEl) hintEl.classList.add('active');
  if (mapa.getCanvas()) mapa.getCanvas().style.cursor = 'crosshair';

  // Táctil: el doble-toque hace zoom por defecto y estorba al cerrar el polígono;
  // se desactiva mientras se dibuja y se restaura al finalizar/cancelar.
  if (mapa.doubleClickZoom) mapa.doubleClickZoom.disable();
  // En móvil el botón "Dibujar" vive en el drawer de Config; pasamos a la vista de
  // Mapa para que se pueda tocar el mapa y quede visible la barra de dibujo.
  if (window.innerWidth <= 900 && typeof _mobTab === 'function') _mobTab('mapa');

  window.OOT.log('[DETERMINANTES] Dibujo activado. drawMode:', drawMode);
}

export function actualizarDibujo() {
  window.OOT.log('[DETERMINANTES] actualizarDibujo(), coords:', drawCoords.length);
  if (!mapa || drawCoords.length < 1) return;
  
  // Limpiar capas anteriores
  if (mapa.getLayer('draw-polygon-line')) { mapa.removeLayer('draw-polygon-line'); }
  if (mapa.getLayer('draw-polygon')) { mapa.removeLayer('draw-polygon'); }
  if (mapa.getSource('draw-polygon')) { mapa.removeSource('draw-polygon'); }
  if (mapa.getLayer('draw-points')) { mapa.removeLayer('draw-points'); }
  if (mapa.getSource('draw-points')) { mapa.removeSource('draw-points'); }
  
  // Si hay más de 1 punto, mostrar línea (cerrar anillo si hay 3+)
  if (drawCoords.length >= 2) {
    const ring = drawCoords.length >= 3 ? [...drawCoords, drawCoords[0]] : drawCoords;
    const gj = { type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: {} };
    mapa.addSource('draw-polygon', { type: 'geojson', data: gj });
    mapa.addLayer({ id: 'draw-polygon', type: 'fill', source: 'draw-polygon', paint: { 'fill-color': '#f4a833', 'fill-opacity': 0.3 } });
    mapa.addLayer({ id: 'draw-polygon-line', type: 'line', source: 'draw-polygon', paint: { 'line-color': '#f4a833', 'line-width': 2 } });
  }
  
  // Mostrar puntos vértices
  if (drawCoords.length >= 1) {
    const pointsGeoJSON = {
      type: 'FeatureCollection',
      features: drawCoords.map((c, i) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: c },
        properties: { index: i + 1 }
      }))
    };
    mapa.addSource('draw-points', { type: 'geojson', data: pointsGeoJSON });
    mapa.addLayer({
      id: 'draw-points',
      type: 'circle',
      source: 'draw-points',
      paint: {
        'circle-radius': 6,
        'circle-color': '#f4a833',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff'
      }
    });
  }
  
  // Actualizar badge y botón finalizar
  const badge = document.getElementById('draw-vertex-badge');
  const btnFin = document.getElementById('btn-finalizar-zona');
  if (badge) badge.textContent = String(drawCoords.length);
  if (btnFin) {
    btnFin.disabled = drawCoords.length < 3;
    btnFin.style.opacity = drawCoords.length < 3 ? '0.4' : '1';
  }
  
  window.OOT.log('[DETERMINANTES] Dibujo actualizado con', drawCoords.length, 'vértices');
}

export function finalizarDibujo() {
  if (!mapa || drawCoords.length < 3) return;
  setDrawMode(false);
  const hintEl = document.getElementById('map-hint-det');
  if (hintEl) hintEl.classList.remove('active');
  if (mapa.getCanvas()) mapa.getCanvas().style.cursor = '';
  if (mapa.doubleClickZoom) mapa.doubleClickZoom.enable();
  
  // Cerrar el polígono: añadir el primer punto al final
  const closedCoords = [...drawCoords, drawCoords[0]];
  
  setZonaGeoJSON({
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [closedCoords] },
      properties: {}
    }]
  });
  
  setRutaZona(null); // forzar re-subida del nuevo dibujo
  mostrarArchivoCargado('Zona dibujada (' + (closedCoords.length - 1) + ' pts)');
  dibujarZonaEnMapa(zonaGeoJSON);
  setDrawCoords([]);
  window.OOT.log('[DETERMINANTES] Dibujo completado con polígono cerrado');
}

export function deshacerVertice() {
  if (drawCoords.length > 0) {
    drawCoords.pop();
    actualizarDibujo();
  }
}

export function dibujarZonaEnMapa(gj) {
  window.OOT.log('[DETERMINANTES] dibujarZonaEnMapa()');
  if (!mapa) return;
  
  // Limpiar dibujo temporal
  if (mapa.getLayer('draw-points')) { mapa.removeLayer('draw-points'); }
  if (mapa.getSource('draw-points')) { mapa.removeSource('draw-points'); }
  if (mapa.getLayer('draw-polygon-line')) { mapa.removeLayer('draw-polygon-line'); }
  if (mapa.getLayer('draw-polygon')) { mapa.removeLayer('draw-polygon'); }
  if (mapa.getSource('draw-polygon')) { mapa.removeSource('draw-polygon'); }
  
  // Limpiar zona anterior
  if (mapa.getLayer('zona-consulta-line')) mapa.removeLayer('zona-consulta-line');
  if (mapa.getLayer('zona-consulta')) mapa.removeLayer('zona-consulta');
  if (mapa.getSource('zona-consulta')) mapa.removeSource('zona-consulta');
  
  mapa.addSource('zona-consulta', { type: 'geojson', data: gj });
  mapa.addLayer({ id: 'zona-consulta', type: 'fill', source: 'zona-consulta', paint: { 'fill-color': '#f4a833', 'fill-opacity': 0.4 } });
  mapa.addLayer({ id: 'zona-consulta-line', type: 'line', source: 'zona-consulta', paint: { 'line-color': '#f4a833', 'line-width': 2 } });
  
  const bounds = new maplibregl.LngLatBounds();
  function collectBounds(f) {
    if (!f || !f.geometry || !f.geometry.coordinates) return;
    if (f.geometry.type === 'Polygon') f.geometry.coordinates[0].forEach(c => bounds.extend(c));
    else if (f.geometry.type === 'MultiPolygon') f.geometry.coordinates.forEach(p => p[0].forEach(c => bounds.extend(c)));
  }
  if (gj.features) gj.features.forEach(collectBounds);
  else if (gj.geometry) collectBounds(gj);
  
  if (bounds.isEmpty()) {
    // Sin geometria utilizable (p.ej. el archivo trae puntos o lineas): encuadre
    // nacional. Antes se caia a un bbox de Magdalena, que desorientaba al usuario.
    bounds.extend([-81.7, -4.2]);
    bounds.extend([-66.9, 13.4]);
  }
  mapa.fitBounds(bounds, { padding: 50 });
  window.OOT.log('[DETERMINANTES] Zona dibujada, zoom al área');
}
