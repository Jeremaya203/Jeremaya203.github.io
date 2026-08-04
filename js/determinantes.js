// ===== VERIFICAR CARGA DE BIBLIOTECAS =====
window.OOT.log('[DETERMINANTES] Verificando bibliotecas...');
if (typeof maplibregl === 'undefined') {
  console.error('[DETERMINANTES] ERROR: maplibregl NO está cargado');
  document.getElementById('mapa-container').innerHTML = '<div class="oot-js-determinantes-11">ERROR: No se cargó maplibre-gl. Verifique su conexión.</div>';
} else {
  window.OOT.log('[DETERMINANTES] maplibregl OK:', typeof maplibregl);
}

// ===== VARIABLES GLOBALES =====
const API = window.OOT_API_BASE || '';
window.OOT.log('[DETERMINANTES] API_base:', API, '| OOT_API_BASE:', window.OOT_API_BASE);

let mapa = null;
let zonaGeoJSON = null;
let rutaZona = null;
let drawMode = false;
let drawCoords = [];
let reporteTexto = '';
let datosResultado = null;
let modoActual = 'consulta_area';
let ultimasReglasActivas = [];
let _popupHandlers = []; // {event, layer, fn}
let _detGeoJSON = null;  // FeatureCollection de determinantes renderizadas (para resaltar)

// Bbox [[minLng,minLat],[maxLng,maxLat]] de un FeatureCollection
function boundsDeGeoJSON(fc) {
  let minX = 180, minY = 90, maxX = -180, maxY = -90, found = false;
  const scan = (c) => {
    if (typeof c[0] === 'number') {
      if (c[0] < minX) minX = c[0]; if (c[1] < minY) minY = c[1];
      if (c[0] > maxX) maxX = c[0]; if (c[1] > maxY) maxY = c[1]; found = true;
    } else c.forEach(scan);
  };
  (fc.features || []).forEach(f => { if (f.geometry && f.geometry.coordinates) scan(f.geometry.coordinates); });
  return found ? [[minX, minY], [maxX, maxY]] : null;
}

// Resalta en amarillo TODOS los polígonos de una determinante (determ + nomdet)
// y reencuadra el mapa a su extensión. Se invoca desde el mapa y desde el listado.
// También sincroniza el ítem del listado lateral (añade .sel y hace scrollIntoView).
function resaltarDeterminante(determ, nomdet) {
  if (!mapa || !_detGeoJSON) return false;
  const dk = String(determ), nk = (nomdet == null ? '' : String(nomdet));
  const feats = (_detGeoJSON.features || []).filter(f => {
    const p = f.properties || {};
    return String(p.determ) === dk && (nk === '' || String(p.nomdet) === nk);
  });
  if (!feats.length) return false;
  const fc = { type: 'FeatureCollection', features: feats };
  if (mapa.getSource('det-highlight')) {
    mapa.getSource('det-highlight').setData(fc);
  } else {
    mapa.addSource('det-highlight', { type: 'geojson', data: fc });
    mapa.addLayer({ id: 'det-highlight-fill', type: 'fill', source: 'det-highlight',
      paint: { 'fill-color': '#ffe14d', 'fill-opacity': 0.55 } });
    mapa.addLayer({ id: 'det-highlight-line', type: 'line', source: 'det-highlight',
      paint: { 'line-color': '#ffcc00', 'line-width': 3 } });
  }
  const b = boundsDeGeoJSON(fc);
  if (b) { try { mapa.fitBounds(b, { padding: 60, maxZoom: 14, duration: 900 }); } catch (e) {} }

  // Sincronizar selección en el listado lateral
  document.querySelectorAll('.determinante-item.sel').forEach(el => el.classList.remove('sel'));
  for (const el of document.querySelectorAll('.determinante-item')) {
    if (el.dataset.determ === dk && (nk === '' || el.dataset.nomdet === nk)) {
      el.classList.add('sel');
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      break;
    }
  }

  return true;
}

function limpiarResaltadoDeterminante() {
  if (!mapa) return;
  ['det-highlight-fill', 'det-highlight-line'].forEach(l => { if (mapa.getLayer(l)) mapa.removeLayer(l); });
  if (mapa.getSource('det-highlight')) mapa.removeSource('det-highlight');
}

function _limpiarPopupHandlers() {
  if (!mapa) return;
  _popupHandlers.forEach(h => { try { mapa.off(h.event, h.layer, h.fn); } catch(e) {} });
  _popupHandlers = [];
}

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
      drawMode = false;
      drawCoords = [];
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

function iniciarMapa() {
  window.OOT.log('[DETERMINANTES] === iniciarMapa() ===');
  const container = document.getElementById('mapa-container');
  if (!container) {
    console.error('[DETERMINANTES] ERROR: No se encontró #mapa-container');
    return;
  }
  window.OOT.log('[DETERMINANTES] Container encontrado:', container.id);
  
  try {
    window.OOT.log('[DETERMINANTES] Creando mapa con maplibregl.Map...');
    mapa = new maplibregl.Map({
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
    });

    mapa.on('load', function() {
      // Cobertura nacional: no se dibuja borde de departamento inicial
      // ningún borde departamental por defecto. El mapa se reencuadra a la zona
      // de análisis cuando el usuario la sube o dibuja.
      window.OOT.log('[DETERMINANTES] Mapa listo (cobertura nacional).');
    });

    // Puntero grueso (celular/tablet): en táctil el evento 'click' sintético de
    // MapLibre no siempre dispara si el dedo se mueve un poco (se interpreta como
    // paneo) → los toques no colocaban vértices. Detectamos el "tap" a mano.
    const _coarsePointer = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    function _agregarVertice(lngLat) {
      drawCoords.push([lngLat.lng, lngLat.lat]);
      actualizarDibujo();
    }

    // Mouse (puntero fino): usar 'click'.
    mapa.on('click', function(e) {
      if (drawMode && !_coarsePointer) _agregarVertice(e.lngLat);
    });

    // Táctil: agregar vértice al levantar el dedo si fue un toque (poco movimiento),
    // no un paneo. Así se preserva el paneo (>14px) y cada tap coloca un punto.
    let _touchTap = null;
    mapa.on('touchstart', function(e) {
      if (!drawMode) { _touchTap = null; return; }
      const t = (e.points && e.points.length === 1) ? e.points[0] : null;
      _touchTap = t ? { x: t.x, y: t.y, ts: Date.now() } : null;
    });
    mapa.on('touchend', function(e) {
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

function iniciarDibujo() {
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
  
  drawMode = true;
  drawCoords = [];
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

function actualizarDibujo() {
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

function finalizarDibujo() {
  if (!mapa || drawCoords.length < 3) return;
  drawMode = false;
  const hintEl = document.getElementById('map-hint-det');
  if (hintEl) hintEl.classList.remove('active');
  if (mapa.getCanvas()) mapa.getCanvas().style.cursor = '';
  if (mapa.doubleClickZoom) mapa.doubleClickZoom.enable();
  
  // Cerrar el polígono: añadir el primer punto al final
  const closedCoords = [...drawCoords, drawCoords[0]];
  
  zonaGeoJSON = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [closedCoords] },
      properties: {}
    }]
  };
  
  rutaZona = null; // forzar re-subida del nuevo dibujo
  mostrarArchivoCargado('Zona dibujada (' + (closedCoords.length - 1) + ' pts)');
  dibujarZonaEnMapa(zonaGeoJSON);
  drawCoords = [];
  window.OOT.log('[DETERMINANTES] Dibujo completado con polígono cerrado');
}

function dibujarZonaEnMapa(gj) {
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
    if (f.geometry.type === 'Polygon') f.geometry.coordinates[0].forEach(c => bounds.extend(c));
    else if (f.geometry.type === 'MultiPolygon') f.geometry.coordinates.forEach(p => p[0].forEach(c => bounds.extend(c)));
  }
  if (gj.features) gj.features.forEach(collectBounds);
  else if (gj.geometry) collectBounds(gj);
  
  if (bounds.isEmpty()) {
    bounds.extend([-74.4, 10.2]);
    bounds.extend([-74.0, 11.0]);
  }
  mapa.fitBounds(bounds, { padding: 50 });
  window.OOT.log('[DETERMINANTES] Zona dibujada, zoom al área');
}

function handleFileSelect() {
  // Invocado por delegación (data-oot-change): `this` = el <input type=file>.
  const input = this;
  const file = input.files && input.files[0];
  if (!file) return;
  // Limpiar ruta anterior para forzar re-subida
  rutaZona = null;
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (ext === 'geojson' || ext === 'json') {
    const reader = new FileReader();
    reader.onload = function(evt) {
      try {
        zonaGeoJSON = JSON.parse(evt.target.result);
        if (!zonaGeoJSON.features && !zonaGeoJSON.geometry) throw new Error('GeoJSON inválido');
        mostrarArchivoCargado(file.name);
        _avisoPreview(false);            // GeoJSON: sí hay vista previa local
        dibujarZonaEnMapa(zonaGeoJSON);
      } catch(err) { window.OOT.notify('Error: ' + err.message, 'error'); }
    };
    reader.readAsText(file);
  } else if (ext === 'zip') {
    // H-19: Validar que el zip contenga al menos un archivo .shp en el navegador
    validarZipContieneShp(file, function(valido) {
      if (!valido) {
        window.OOT.notify('El archivo ZIP no contiene un Shapefile válido. Asegúrese de incluir el archivo .shp dentro del ZIP junto con los archivos .dbf, .shx y .prj.', 'error');
        input.value = '';
        return;
      }
      subirArchivoBackend(file, ext);
    });
  } else if (ext === 'kmz' || ext === 'kml') {
    subirArchivoBackend(file, ext);
  } else {
    window.OOT.notify(ext === 'shp'
      ? 'Un shapefile debe subirse comprimido en un .zip que incluya también .dbf, .shx y .prj.'
      : 'Formato no soportado: ' + ext, 'warn');
  }
  input.value = '';
}

function validarZipContieneShp(file, callback) {
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const buffer = e.target.result;
      const decoder = new TextDecoder('utf-8', { fatal: false });
      const text = decoder.decode(new Uint8Array(buffer));
      if (text.indexOf('.shp') !== -1 || text.indexOf('.SHP') !== -1) {
        callback(true);
      } else {
        callback(false);
      }
    } catch(err) {
      callback(false);
    }
  };
  const slice = file.slice(0, Math.min(file.size, 1024 * 1024));
  reader.readAsArrayBuffer(slice);
}

function subirArchivoBackend(file, ext) {
  const formData = new FormData();
  formData.append('zona', file);
  fetch(API + '/api/determinantes/upload', { method: 'POST', body: formData })
    .then(r => r.ok ? r.json() : Promise.reject(new Error('Upload fallido')))
    .then(data => {
      rutaZona = data.ruta;
      mostrarArchivoCargado(file.name);
      if (data.formato === 'geojson' && data.ruta) {
        _avisoPreview(false);
        return fetch(data.ruta).then(r => r.json()).then(gj => {
          zonaGeoJSON = gj;
          dibujarZonaEnMapa(gj);
        });
      }
      _avisoPreview(true, 'Vista previa en el mapa no disponible para ' + ext.toUpperCase() +
        '. El archivo se cargó correctamente; la zona se dibujará al ejecutar el análisis.');
    })
    .catch(err => window.OOT.notify('Error subiendo archivo: ' + err.message, 'error'));
}

// H-19: muestra/oculta el aviso de "sin vista previa" para formatos no-GeoJSON.
function _avisoPreview(show, msg) {
  const el = document.getElementById('preview-aviso');
  if (!el) return;
  el.style.display = show ? 'block' : 'none';
  el.textContent = show ? (msg || '') : '';
}

function mostrarArchivoCargado(name) {
  window.OOT.log('[DETERMINANTES] mostrarArchivoCargado:', name);
  const dz = document.getElementById('drop-zone');
  if (!dz) { console.error('[DETERMINANTES] No找到 drop-zone'); return; }
  
  dz.classList.add('loaded');
  // Buscar los elementos internos correctamente
  const spans = dz.querySelectorAll('span');
  const divs = dz.querySelectorAll('div');
  if (divs.length >= 1) divs[0].textContent = 'Archivo cargado';
  if (divs.length >= 2) divs[1].textContent = name;
  
  const fileInfo = document.getElementById('file-info');
  const fileName = document.getElementById('file-name');
  const btnEjecutar = document.getElementById('btn-ejecutar');
  
  if (fileInfo) fileInfo.classList.remove('hidden');
  if (fileName) fileName.textContent = name;
  if (btnEjecutar) btnEjecutar.disabled = false;
  
  window.OOT.log('[DETERMINANTES] Archivo cargado, botón habilitado');
}

function limpiarArchivo() {
  window.OOT.log('[DETERMINANTES] limpiarArchivo()');
  zonaGeoJSON = null;
  rutaZona = null;
  
  const dz = document.getElementById('drop-zone');
  if (dz) {
    dz.classList.remove('loaded');
    const divs = dz.querySelectorAll('div');
    if (divs.length >= 1) divs[0].textContent = 'Arrastra tu archivo';
    if (divs.length >= 2) divs[1].textContent = '.geojson, .zip (shapefile), .kmz, .kml';
  }
  _avisoPreview(false);
  
  const fileInfo = document.getElementById('file-info');
  const btnEjecutar = document.getElementById('btn-ejecutar');
  
  if (fileInfo) fileInfo.classList.add('hidden');
  if (btnEjecutar) btnEjecutar.disabled = true;
  
  // Limpiar mapa correctamente
  if (mapa) {
    ['draw-points','draw-polygon-line','draw-polygon','zona-consulta-line','zona-consulta'].forEach(lid => {
      if (mapa.getLayer(lid)) mapa.removeLayer(lid);
    });
    ['draw-points','draw-polygon','zona-consulta'].forEach(sid => {
      if (mapa.getSource(sid)) mapa.removeSource(sid);
    });
  }
  window.OOT.log('[DETERMINANTES] Archivo limpiado');
}

function deshacerVertice() {
  if (drawCoords.length > 0) {
    drawCoords.pop();
    actualizarDibujo();
  }
}

async function ejecutarAnalisis() {
  if (window.OOT && OOT.track) OOT.track('analisis_determinantes', { modo: (typeof modoActual !== 'undefined' ? modoActual : '') });
  window.OOT.log('[DETERMINANTES] === ejecutarAnalisis() ===');
  window.OOT.log('[DETERMINANTES] modoActual:', modoActual);
  window.OOT.log('[DETERMINANTES] zonaGeoJSON:', zonaGeoJSON ? 'CARGADO' : 'NULL');
  window.OOT.log('[DETERMINANTES] API:', API);
  
  if (!zonaGeoJSON && !rutaZona) { 
    window.OOT.notify('No hay zona de consulta. Cargue un archivo GeoJSON o dibuje una zona en el mapa.', 'warn');
    return; 
  }

  // Selector "Municipio de referencia" eliminado (era vestigial). Se envía vacío a
  // propósito: la viabilidad detecta el municipio real de la zona (gestor._resolver_municipio)
  // y la consulta de área es dirigida por la geometría.
  const codMpio = '', nombreMpio = '';
  const areaMinima = parseFloat(document.getElementById('area-minima')?.value) || 6;
  const reglas = [];
  if (document.getElementById('regla-aislamiento')?.checked) reglas.push('aislamiento_vias');
  if (document.getElementById('regla-paramos')?.checked) reglas.push('paramos');
  if (document.getElementById('regla-areas-vida')?.checked) reglas.push('areas_vida');
  if (document.getElementById('regla-centros')?.checked) reglas.push('centros_poblados');

  window.OOT.log('[DETERMINANTES] Params:', { codMpio, nombreMpio, areaMinima, reglas, modoActual });
  document.getElementById('placeholder')?.classList.add('hidden');
  mostrarStep('processing');
  actualizarProceso(1);

  try {
    window.OOT.log('[DETERMINANTES] ===== ANALISIS COMPLETO =====');

    // MODO VIABILIDAD PREDIAL (LLM)
    if (modoActual === 'viabilidad') {
      window.OOT.log('[DETERMINANTES] Modo: viabilidad (LLM)');
      const usoPretendido = document.getElementById('uso-pretendido')?.value || 'uso no especificado';

      // Actualizar labels de pasos para viabilidad
      const procTit = document.getElementById('proc-titulo');
      const procSub = document.getElementById('proc-subtitulo');
      if (procTit) procTit.textContent = 'Analizando viabilidad...';
      if (procSub) procSub.textContent = 'El análisis IA puede tardar varios minutos';
      _setProcesoPasos(['Cargando predios y determinantes', 'Evaluando normativa con IA', 'Generando reporte']);

      // Subir zona si no tenemos ruta
      let ruta = rutaZona;
      if (!ruta && zonaGeoJSON) {
        const formData = new FormData();
        const blob = new Blob([JSON.stringify(zonaGeoJSON)], { type: 'application/json' });
        formData.append('zona', blob, 'zona.geojson');
        const uploadRes = await fetch(API + '/api/determinantes/upload', { method: 'POST', body: formData });
        if (!uploadRes.ok) throw new Error('Error al subir archivo');
        const uploadData = await uploadRes.json();
        ruta = uploadData.ruta;
      }
      if (!ruta) throw new Error('No hay zona para analizar');

      actualizarProceso(1);

      // Health check
      const health = await fetch(API + '/api/health').catch(() => null);
      if (!health || !health.ok) throw new Error('El servicio de análisis no está disponible en este momento. Intente nuevamente en unos minutos.');

      actualizarProceso(2);

      // Timeout largo: LLM puede tardar minutos (25 predios × múltiples determinantes)
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 300000); // 5 min

      try {
        const res = await fetch(API + '/api/determinantes/ejecutar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: ctrl.signal,
          body: JSON.stringify({
            ruta_zona_interes: ruta,
            cod_municipio: codMpio,
            nombre_municipio: nombreMpio,
            area_minima_ha: areaMinima,
            uso_pretendido: usoPretendido,
            modo: 'viabilidad',
            max_predios: 25
          })
        });
        clearTimeout(timeout);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || 'Error HTTP ' + res.status);
        }
        const data = await res.json();
        actualizarProceso(3);
        mostrarResultados(data);
      } catch(fetchErr) {
        clearTimeout(timeout);
        if (fetchErr.name === 'AbortError') throw new Error('El análisis superó el tiempo límite (5 min). Intente con una zona más pequeña o menor área mínima.');
        throw fetchErr;
      }
      return;
    }

    // MODO CONSULTA ÁREA (original)
    window.OOT.log('[DETERMINANTES] Modo: consulta_area');
    const procTitA = document.getElementById('proc-titulo');
    const procSubA = document.getElementById('proc-subtitulo');
    if (procTitA) procTitA.textContent = 'Procesando...';
    if (procSubA) procSubA.textContent = 'Analizando determinantes';
    _setProcesoPasos(['Intersectando zonas', 'Aplicando reglas', 'Evaluando normativa']);
    
    // Verificar conexión primero
    const healthUrl = API + '/api/health';
    const healthCheck = await fetch(healthUrl).catch(e => {
      console.error('[DETERMINANTES] Error health:', e);
      return null;
    });
    
    if (!healthCheck || !healthCheck.ok) {
      throw new Error('El servicio de análisis no está disponible en este momento. Intente nuevamente en unos minutos.');
    }
    
    // Usar rutaZona existente si ya tenemos archivo subido, sino subir zonaGeoJSON
    let rutaParaAnalisis = rutaZona;
    
    if (!rutaParaAnalisis && zonaGeoJSON) {
      window.OOT.log('[DETERMINANTES] Subiendo zona para análisis...');
      const formData = new FormData();
      const blob = new Blob([JSON.stringify(zonaGeoJSON)], { type: 'application/json' });
      formData.append('zona', blob, 'zona.geojson');
      
      const uploadUrl = API + '/api/determinantes/upload';
      const uploadRes = await fetch(uploadUrl, { method: 'POST', body: formData });
      
      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        throw new Error('Error al subir archivo: ' + uploadRes.status + '\n' + errText);
      }
      
      const uploadData = await uploadRes.json();
      rutaParaAnalisis = uploadData.ruta;
      window.OOT.log('[DETERMINANTES] Ruta obtenida:', rutaParaAnalisis);
    }
    
    if (!rutaParaAnalisis) {
      throw new Error('No hay zona para analizar');
    }
    
    actualizarProceso(2);
    
    window.OOT.log('[DETERMINANTES] Ejecutando análisis...');
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 120000);
    
    const ejecutarUrl = API + '/api/determinantes/ejecutar';
    window.OOT.log('[DETERMINANTES] Ejecutar URL:', ejecutarUrl);
    
    const analysisRes = await fetch(ejecutarUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        ruta_zona_interes: rutaParaAnalisis,
        cod_municipio: codMpio,
        nombre_municipio: nombreMpio,
        area_minima_ha: areaMinima,
        uso_pretendido: '',
        modo: 'consulta_area',
        reglas_activas: reglas,
        max_predios: 25
      })
    });
    clearTimeout(timeout);
    window.OOT.log('[DETERMINANTES] Analysis response:', analysisRes.status);
    
    if (!analysisRes.ok) {
      const errText = await analysisRes.text();
      throw new Error('Error en análisis: ' + analysisRes.status + ' - ' + errText);
    }
    
    const result = await analysisRes.json();
    window.OOT.log('[DETERMINANTES] Result:', result);
    actualizarProceso(3);
    mostrarResultados(result);
    
  } catch(err) {
    console.error('[DETERMINANTES] Error:', err);
    // El abort del timeout (consulta_area) lanza un DOMException poco claro
    // ("signal is aborted without reason"); se traduce a un mensaje accionable.
    // La ruta de viabilidad ya arroja su propio mensaje amigable (no coincide con
    // /aborted/), así que este bloque no lo pisa.
    const esAbort = err && (err.name === 'AbortError' || /aborted/i.test(err.message || ''));
    const msg = esAbort
      ? 'El análisis superó el tiempo límite. Puede deberse a una zona muy extensa o a alta carga del servidor. Intente con una zona más pequeña o vuelva a intentarlo en unos minutos.'
      : (err && err.message ? err.message : 'Ocurrió un error al ejecutar el análisis.');
    const errEl = document.getElementById('error-msg');
    if (errEl) errEl.textContent = msg;
    mostrarStep('error');
  }
}

function cambiarFuncion(modo) {
  window.OOT.log('[DETERMINANTES] cambiarFuncion:', modo, '-> modoActual:', modoActual);
  modoActual = modo;
  var esArea = modo === 'consulta_area';
  var esViab = modo === 'viabilidad';

  // Actualizar pestañas (Consulta de área / Viabilidad predial)
  var tabCons = document.getElementById('tab-consulta');
  var tabViab = document.getElementById('tab-viabilidad');
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
  var uploadTitulo = document.getElementById('upload-titulo');
  if (uploadTitulo) uploadTitulo.textContent = esArea ? 'Zona de Consulta' : 'Zona de Interés';

  // Actualizar el texto del botón de acción principal
  var btnTxt = document.getElementById('btn-ejecutar-txt');
  if (btnTxt) btnTxt.textContent = esArea ? 'Consultar Determinantes en Área' : 'Analizar Viabilidad Predial';

  // Ocultar el campo NPN (heredado del antiguo consulta_predio)
  var paramsNpn = document.getElementById('params-npn');
  if (paramsNpn) paramsNpn.style.display = 'none';

  // Mostrar/ocultar la sección de reglas (solo en consulta de área)
  var reglasSection = document.getElementById('reglas-section');
  if (reglasSection) reglasSection.style.display = esArea ? 'block' : 'none';

  // Mostrar/ocultar el uso pretendido (solo en viabilidad)
  var usoSection = document.getElementById('uso-pretendido-section');
  if (usoSection) usoSection.style.display = esViab ? 'block' : 'none';

  // B.1.4 — El área mínima filtra predios y solo la usa viabilidad; consulta_area la recibe
  // pero la ignora, así que mostrarla en ese modo confundía (parecía un control sin efecto).
  var areaMinSection = document.getElementById('area-minima-section');
  if (areaMinSection) areaMinSection.style.display = esViab ? 'block' : 'none';

  // B.1.8 — La leyenda describe los veredictos (Compatible/Condicionado/No viable), que solo
  // se emiten en viabilidad. En consulta de área no hay veredictos que leer.
  var leyendaSection = document.getElementById('ie-determinantes-26');
  if (leyendaSection) leyendaSection.style.display = esViab ? 'block' : 'none';

  if (rutaZona || zonaGeoJSON) reiniciar();
  else mostrarStep('upload');
}

function mostrarStep(step) {
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

function actualizarProceso(n) {
  window.OOT.log('[DETERMINANTES] actualizarProceso:', n);
  for (let i = 1; i <= 3; i++) {
    const el = document.getElementById('step' + i);
    if (!el) { console.warn('[DETERMINANTES] No step' + i); continue; }
    const icon = el.querySelector('.material-symbols-outlined');
    if (icon) icon.textContent = (i < n) ? 'check_circle' : (i === n ? 'radio_button_checked' : 'radio_button_unchecked');
    el.style.color = (i < n) ? 'var(--oot-teal)' : (i === n ? 'var(--oot-ochre)' : 'var(--oot-tx3)');
  }
}

function mostrarResultados(data) {
  window.OOT.log('[DETERMINANTES] mostrarResultados() called');
  window.OOT.log('[DETERMINANTES] data keys:', Object.keys(data));
  window.OOT.log('[DETERMINANTES] modo:', data.modo);
  
  datosResultado = data;
  reporteTexto = data.reporte_final || '';
  
  // Título de resultados: en consulta_area la zona manda (puede cruzar varios municipios),
  // así que se usan los municipios REALES que devuelve el backend (#3), NO el desplegable
  // —que solo es referencia para viabilidad—. Antes mostraba siempre "Santa Marta" (default).
  const tituloMpio = document.getElementById('resultado-municipio');
  if (tituloMpio) {
    // Sin dropdown: el título usa los municipios REALES detectados por el backend a
    // partir de la zona (viabilidad y consulta_area). Si no vienen, etiqueta genérica.
    const reales = Array.isArray(data.municipios_zona) ? data.municipios_zona : [];
    tituloMpio.textContent = reales.length
      ? (reales.length <= 3 ? reales.map(m => m.nombre).join(', ') : reales.length + ' municipios')
      : (data.municipio_detectado || 'Zona consultada');
  }
  
  setTimeout(() => {
    mostrarResultadosMapa(data);
    mostrarPopupDeterminantes();
  }, 500);

  // ── MODO VIABILIDAD ──
  if (data.modo === 'viabilidad') {
    const evalNorm = data.evaluacion_normativa || [];
    const viabilidadMap = data.predios_viabilidad || {};
    const esc =(s) => String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

    // Elementos del DOM (declarados aquí para no depender de los que están más abajo)
    const totalDetsEl = document.getElementById('total-dets');
    const totalPrediosEl = document.getElementById('total-predios');
    const viablesEl = document.getElementById('viables');
    const noViablesEl = document.getElementById('no-viables');
    const listEl = document.getElementById('determinantes-list');
    if (!listEl) { mostrarStep('results'); return; }

    // Contar verdicts
    let nComp = 0, nCond = 0, nNoViab = 0;
    Object.values(viabilidadMap).forEach(function(v) {
      if (v.includes('Compatible')) nComp++;
      else if (v.includes('Condicionado')) nCond++;
      else if (v.includes('No viable')) nNoViab++;
    });

    // Stats cards
    if (totalDetsEl) { totalDetsEl.textContent = evalNorm.length; totalDetsEl.nextElementSibling.textContent = 'Predios'; totalDetsEl.style.color = ''; }
    if (totalPrediosEl) { totalPrediosEl.textContent = nComp; totalPrediosEl.nextElementSibling.textContent = 'Compatibles'; totalPrediosEl.style.color = 'var(--oot-green)'; }
    if (viablesEl) { viablesEl.textContent = nCond; viablesEl.nextElementSibling.textContent = 'Condicionados'; viablesEl.style.color = 'var(--oot-ochre)'; }
    if (noViablesEl) { noViablesEl.textContent = nNoViab; noViablesEl.nextElementSibling.textContent = 'No Viables'; noViablesEl.style.color = 'var(--oot-red)'; }

    listEl.innerHTML = '';

    // Uso pretendido badge
    if (data.uso_pretendido) {
      const usoEl = document.createElement('div');
      usoEl.className = 'oot-js-determinantes-39';
      usoEl.innerHTML = '<span class="material-symbols-outlined oot-js-determinantes-1">work</span> Uso analizado: <strong>' + window.OOT.escapeHtml(String(data.uso_pretendido)) + '</strong>';
      listEl.appendChild(usoEl);
    }

    if (evalNorm.length === 0) {
      listEl.innerHTML += '<div class="oot-js-determinantes-12">No se encontraron predios que cumplan el área mínima en esta zona.</div>';
    } else {
      const hdr = document.createElement('div');
      hdr.className = 'oot-js-determinantes-40';
      hdr.textContent = 'Predios Evaluados (' + evalNorm.length + ')';
      listEl.appendChild(hdr);

      evalNorm.forEach(function(predio) {
        const npn = predio.numero_predial;
        const viab = viabilidadMap[String(npn)] || '⚪ Sin información';
        const color = _viabColor(viab);
        const icon = _viabIcon(viab);
        const labelCorto = viab.replace(/^[\u{1F534}\u{1F7E1}\u{1F7E2}⚪️]/u, '').trim().split('\n')[0];

        const card = document.createElement('div');
        card.className = 'oot-js-determinantes-41';
        card.style.borderColor = color + '44';

        const header = document.createElement('div');
        header.className = 'oot-js-determinantes-42';
        header.style.background = color + '18';
        header.innerHTML =
          '<span class="oot-js-determinantes-13">' + icon + '</span>' +
          '<div class="oot-js-determinantes-9">' +
            '<div class="oot-js-determinantes-14" title="' + window.OOT.escapeHtml(String(npn)) + '">' + window.OOT.escapeHtml(String(npn)) + '</div>' +
            '<div class="oot-js-determinantes-15">' + (predio.area_ha || '?') + ' ha · ' + window.OOT.escapeHtml(String(predio.clase_pendiente || '—')) + '</div>' +
          '</div>' +
          '<span class="oot-js-determinantes-viab-label">' + window.OOT.escapeHtml(String(labelCorto)) + '</span>' +
          '<span class="material-symbols-outlined oot-js-determinantes-2">expand_more</span>';
        const viabLabelEl = header.querySelector('.oot-js-determinantes-viab-label');
        if (viabLabelEl) viabLabelEl.style.color = color;

        const body = document.createElement('div');
        body.className = 'oot-js-determinantes-43';

        (predio.veredictos || []).forEach(function(v) {
          const vc = _viabColor(v.veredicto || '');
          const vi = _viabIcon(v.veredicto || '');
          const fund = (v.fundamento || '').substring(0, 250);
          const detDiv = document.createElement('div');
          detDiv.className = 'oot-js-determinantes-44';
          detDiv.style.borderLeftColor = vc;
          detDiv.innerHTML =
            '<div class="oot-js-determinantes-16">' +
              '<span class="oot-js-determinantes-17">' + vi + '</span>' +
              '<span class="oot-js-determinantes-18">' + esc(v.determinante || '—') + '</span>' +
            '</div>' +
            (v.categoria ? '<div class="oot-js-determinantes-19">Nivel: ' + esc(v.categoria) + '</div>' : '') +
            '<div class="oot-js-determinantes-20">' + esc(fund) + (fund.length === 250 ? '…' : '') + '</div>';
          body.appendChild(detDiv);
        });

        header.onclick = function() {
          const open = body.style.display !== 'none';
          body.style.display = open ? 'none' : 'block';
          const chev = header.querySelector('.material-symbols-outlined');
          if (chev) chev.textContent = open ? 'expand_more' : 'expand_less';
          if (!open && mapa) {
            // Fly to predio on map when opening
            const feat = (data.predios_geojson || {features:[]}).features.find(function(f) { return String(f.properties.numero_predial) === String(npn); });
            if (feat && feat.geometry) { const c = centroideGeoJSON(feat); if (c) mapa.flyTo({ center: c, zoom: 16, duration: 800 }); }
          }
        };

        card.appendChild(header);
        card.appendChild(body);
        listEl.appendChild(card);
      });
    }

    mostrarStep('results');
    return;
  }

  const esModoPredio = data.modo === 'consulta_predio';
  
  // El backend devuelve determinantes_zona, no determinantes
  let determinantes = data.determinantes_zona || data.determinantes || [];
  let predios = data.predios || [];
  let reporte = data.reporte_final || '';
  let viablesCount = (data.predios_viables || []).length;
  let totalFiltrados = data.total_predios_filtrados || 0;
  
  const totalDetsEl = document.getElementById('total-dets');
  const totalPrediosEl = document.getElementById('total-predios');
  const viablesEl = document.getElementById('viables');
  const noViablesEl = document.getElementById('no-viables');
  
  if (esModoPredio) {
    // Modo predio: estadísticas de predios
    const prediosGeo = data.predios_geojson || { features: [] };
    const totalPredios = data.total_predios || prediosGeo.features.length;
    const conDets = prediosGeo.features.filter(f => (f.properties?.n_determinantes || 0) > 0).length;
    const sinDets = totalPredios - conDets;
    
    if (totalDetsEl) { totalDetsEl.textContent = totalPredios; totalDetsEl.nextElementSibling.textContent = 'Predios'; }
    if (totalPrediosEl) { totalPrediosEl.textContent = conDets; totalPrediosEl.nextElementSibling.textContent = 'Con Determinantes'; }
    if (viablesEl) { viablesEl.textContent = sinDets; viablesEl.nextElementSibling.textContent = 'Sin Determinantes'; viablesEl.style.color = 'var(--oot-ochre)'; }
    if (noViablesEl) { noViablesEl.textContent = ''; noViablesEl.nextElementSibling.textContent = ''; }
  } else {
    // Modo área: estadísticas normales
    if (totalDetsEl) { totalDetsEl.textContent = determinantes.length; totalDetsEl.nextElementSibling.textContent = 'Determinantes'; }
    if (totalPrediosEl) { totalPrediosEl.textContent = totalFiltrados; totalPrediosEl.nextElementSibling.textContent = 'Predios'; }
    if (viablesEl) { viablesEl.textContent = viablesCount; viablesEl.nextElementSibling.textContent = 'Viables'; viablesEl.style.color = 'var(--oot-green)'; }
    if (noViablesEl) { noViablesEl.textContent = totalFiltrados - viablesCount; noViablesEl.nextElementSibling.textContent = 'No Viables'; }
  }
  
  const listEl = document.getElementById('determinantes-list');
  if (!listEl) { console.error('[DETERMINANTES] determinantes-list not found'); return; }
  
  listEl.innerHTML = '';
  
  // ── MODO PREDIO ──
  if (esModoPredio) {
    const prediosGeo = data.predios_geojson || { features: [] };
    window.OOT.log('[DETERMINANTES] Modo predio - predios:', prediosGeo.features.length);
    
    if (prediosGeo.features.length > 0) {
      const header = document.createElement('div');
      header.className = 'oot-js-determinantes-45';
      header.textContent = 'Predios Encontrados (' + prediosGeo.features.length + ')';
      listEl.appendChild(header);
      
      prediosGeo.features.forEach((f, idx) => {
        const p = f.properties || {};
        const npn = p.numero_predial || p.NPN || 'N/A';
        const area = p.Shape_Area ? (p.Shape_Area / 10000).toFixed(2) + ' ha' : 'N/A';
        const nDets = p.n_determinantes || 0;
        const item = document.createElement('div');
        item.className = 'determinante-item';
        item.style.marginBottom = '8px';
        item.innerHTML = `
          <div class="determinante-header oot-js-determinantes-3">
            <span class="determinante-name oot-js-determinantes-4">${window.OOT.escapeHtml(String(npn))}</span>
            <span class="oot-js-determinantes-21">${nDets} det.</span>
          </div>
          <div class="determinante-desc oot-js-determinantes-5">Área: ${window.OOT.escapeHtml(String(area))}</div>
        `;
        item.style.cursor = 'pointer';
        item.onclick = () => {
          if (mapa && f.geometry) {
            const center = centroideGeoJSON(f);
            mapa.flyTo({ center: center, zoom: 16, duration: 1000 });
          }
        };
        listEl.appendChild(item);
      });
    } else {
      listEl.innerHTML = '<div class="text-xs text-center p-4 oot-js-determinantes-6">No se encontraron predios en esta zona</div>';
    }
    
    if (data.aviso) {
      const avisoEl = document.createElement('div');
      avisoEl.className = 'oot-js-determinantes-46';
      avisoEl.textContent = data.aviso;
      listEl.appendChild(avisoEl);
    }
  }
  
  // ── MODO ÁREA ──
  window.OOT.log('[DETERMINANTES] Adding determinantes to list...', determinantes.length);
  _detOcultos = [];   // reset visibilidad por-determinante en cada consulta nueva

  if (determinantes.length > 0) {
    const porCategoria = {};
    determinantes.forEach(det => {
      const cat = det.categoria || 'Otros';
      if (!porCategoria[cat]) porCategoria[cat] = [];
      porCategoria[cat].push(det);
    });
    
    const iconosCat = {
      'Ambientales': 'forest',
      'Soberanía Alimentaria': 'grass',
      'Patrimoniales': 'account_balance',
      'Infraestructura': 'settings_input_component',
      'Áreas Metropolitanas': 'location_city',
      'Proyectos Turísticos Especiales': 'beach_access',
      'Otros': 'category'
    };
    
    Object.entries(porCategoria).forEach(([cat, items]) => {
      const catHeader = document.createElement('div');
      catHeader.className = 'oot-js-determinantes-47';
      // cat proviene de la API (vocabulario controlado, pero se escapa por consistencia/H-12).
      catHeader.innerHTML = `
        <span class="material-symbols-outlined oot-js-determinantes-7">${iconosCat[cat] || 'category'}</span>
        <span class="oot-js-determinantes-22">${window.OOT.escapeHtml(String(cat))}</span>
        <span class="oot-js-determinantes-23">${items.length}</span>
      `;
      listEl.appendChild(catHeader);
      
      items.forEach((det, idx) => {
        const item = document.createElement('div');
        item.className = 'determinante-item';
        item.dataset.determ = String(det.codigo ?? '');
        item.dataset.nomdet = String(det.nombre ?? '');
        const areaInt = det.area_interseccion_m2 ? (det.area_interseccion_m2 / 10000).toFixed(2) + ' ha' : 'N/A';
        const cobertura = det.cobertura_zona_pct ? det.cobertura_zona_pct.toFixed(1) + '%' : 'N/A';
        const _esc = (s) => (window.OOT && window.OOT.escapeHtml) ? window.OOT.escapeHtml(String(s))
          : String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
        const nombreDet = det.determinante || det.nombre || ('Determinante ' + (idx + 1));
        item.innerHTML = `
          <div class="determinante-header oot-js-determinantes-8">
            <span class="determinante-name oot-js-determinantes-9">${_esc(nombreDet)}</span>
            <button class="det-eye oot-js-determinantes-24" title="Mostrar / ocultar en el mapa">
              <span class="material-symbols-outlined oot-js-determinantes-10">visibility</span>
            </button>
          </div>
          <div class="determinante-desc">Cobertura: ${cobertura} (${areaInt})</div>
        `;
        item.style.cursor = 'pointer';
        // Ojo → prende/apaga SOLO este determinante en el mapa (sin disparar el resaltado)
        const eyeBtn = item.querySelector('.det-eye');
        if (eyeBtn) eyeBtn.onclick = (ev) => {
          ev.stopPropagation();
          toggleDeterminanteVisibilidad(det.codigo, det.nombre, eyeBtn, item);
        };
        item.onclick = () => {
          if (!mapa) return;
          // Marcar ítem seleccionado en el listado
          document.querySelectorAll('.determinante-item.sel').forEach(el => el.classList.remove('sel'));
          item.classList.add('sel');
          item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          // Resaltar el polígono completo en amarillo y reencuadrar.
          // Si no hay geometría coincidente, vuela al centroide como fallback.
          if (!resaltarDeterminante(det.codigo, det.nombre)) {
            if (det.centroide_lon != null && det.centroide_lat != null) {
              mapa.flyTo({ center: [det.centroide_lon, det.centroide_lat], zoom: 13, duration: 1000 });
            }
          }
        };
        listEl.appendChild(item);
      });
    });
  }
  
  // También mostrar el reporte si existe
  if (reporte) {
    const reporteEl = document.createElement('div');
    reporteEl.style.marginTop = '16px';
    reporteEl.style.padding = '12px';
    reporteEl.style.background = 'var(--oot-s2)';
    reporteEl.style.borderRadius = '8px';
    reporteEl.style.fontSize = '11px';
    reporteEl.style.color = 'var(--oot-tx2)';
    reporteEl.style.whiteSpace = 'pre-wrap';
    reporteEl.style.maxHeight = '200px';
    reporteEl.style.overflowY = 'auto';
    reporteEl.textContent = reporte;
    listEl.appendChild(reporteEl);
  }
  
  if (determinantes.length === 0 && !reporte) {
    listEl.innerHTML = '<div class="text-xs text-center p-4 oot-js-determinantes-6">No se encontraron determinantes</div>';
  }
  
  const reglasList = document.getElementById('reglas-list');
  if (reglasList) reglasList.innerHTML = '';
  if (reglasList && data.reglas_geojson) {
    const reglas = data.reglas_geojson;
    const reglasKeys = Object.keys(reglas);
    if (reglasKeys.length > 0) {
      const reglasHeader = document.createElement('div');
      reglasHeader.className = 'oot-js-determinantes-48';
      reglasHeader.style.color = 'var(--oot-tx)';
      reglasHeader.textContent = 'Reglas Aplicadas';
      reglasList.appendChild(reglasHeader);
      
      const REGLA_CONFIG = {
        'aislamiento_vias': { nombre: 'Aislamiento de vías', color: 'var(--oot-red)' },
        'priorizacion_1pct': { nombre: 'Priorización compra predios 1%', color: 'var(--oot-blue)' },
        'areas_vida': { nombre: 'Áreas de vida / reforestación', color: 'var(--oot-green)' },
        'centros_poblados': { nombre: 'Centros poblados', color: 'var(--oot-ochre)' },
        'corredor_suburbano': { nombre: 'Corredor Vial Suburbano', color: 'var(--oot-terra)' }
      };
      
      reglasKeys.forEach(key => {
        const cfg = REGLA_CONFIG[key] || { nombre: key, color: 'var(--oot-tx3)' };
        const reglaEl = document.createElement('div');
        reglaEl.className = 'oot-js-determinantes-49';
        reglaEl.style.borderLeftColor = cfg.color;
        const tieneDatos = reglas[key] && reglas[key].features && reglas[key].features.length > 0;
        reglaEl.innerHTML = `
          <span class="oot-js-determinantes-regla-dot">${tieneDatos ? '🔴' : '⚪'}</span>
          <span class="oot-js-determinantes-25">${cfg.nombre}</span>
          <span class="oot-js-determinantes-23">${tieneDatos ? reglas[key].features.length + ' entidades' : 'sin datos'}</span>
        `;
        const reglaDotEl = reglaEl.querySelector('.oot-js-determinantes-regla-dot');
        if (reglaDotEl) reglaDotEl.style.color = cfg.color;
        reglasList.appendChild(reglaEl);
      });
    }
  }
  
  window.OOT.log('[DETERMINANTES] Calling mostrarStep(results)...');
  mostrarStep('results');
}

function getBadge(estado) {
  const e = (estado || '').toLowerCase();
  if (e.includes('compatible') || e.includes('viable')) return { cls: 'viable', text: 'Compatible' };
  if (e.includes('condicionado')) return { cls: 'condicionado', text: 'Condicionado' };
  if (e.includes('no viable')) return { cls: 'no-viable', text: 'No viable' };
  return { cls: 'condicionado', text: 'Evaluando' };
}

function _viabColor(text) {
  const t = text || '';
  if (t.includes('Compatible')) return '#27ae60';
  if (t.includes('Condicionado')) return '#f4a833';
  if (t.includes('No viable') || t.includes('no_viable')) return '#c0392b';
  return '#888888';
}

function _viabIcon(text) {
  const t = text || '';
  if (t.includes('Compatible')) return '🟢';
  if (t.includes('Condicionado')) return '🟡';
  if (t.includes('No viable') || t.includes('no_viable')) return '🔴';
  return '⚪';
}

function _setProcesoPasos(pasos) {
  pasos.forEach(function(txt, i) {
    const el = document.getElementById('step' + (i + 1));
    if (!el) return;
    const spans = el.querySelectorAll('span');
    if (spans.length >= 2) spans[1].textContent = txt;
  });
}

function mostrarTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  const panelDet = document.getElementById('panel-determinantes');
  const panelMapa = document.getElementById('panel-mapa');
  if (panelDet) panelDet.style.display = (tab === 'determinantes') ? 'block' : 'none';
  if (panelMapa) panelMapa.style.display = (tab === 'mapa') ? 'block' : 'none';
}

function reiniciar() {
  window.OOT.log('[DETERMINANTES] reiniciar() called');
  drawCoords = [];
  zonaGeoJSON = null;
  rutaZona = null;
  reporteTexto = '';
  datosResultado = null;
  drawMode = false;
  
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

function agregarCapaMapa(id, geojson, tipo, color, opacidad, outline) {
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

function bboxGeoJSON(gj) {
  if (!gj) return null;
  let coords = [];
  function extraer(obj) {
    if (!obj) return;
    if (obj.type === 'FeatureCollection') obj.features.forEach(f => extraer(f));
    else if (obj.type === 'Feature') extraer(obj.geometry);
    else if (obj.type === 'Polygon') obj.coordinates.forEach(r => r.forEach(c => coords.push(c)));
    else if (obj.type === 'MultiPolygon') obj.coordinates.forEach(p => p.forEach(r => r.forEach(c => coords.push(c))));
  }
  extraer(gj);
  if (!coords.length) return null;
  let lngs = coords.map(c => c[0]), lats = coords.map(c => c[1]);
  return [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]];
}

function centroideGeoJSON(gj) {
  const bb = bboxGeoJSON(gj);
  if (!bb) return null;
  return [(bb[0][0] + bb[1][0]) / 2, (bb[0][1] + bb[1][1]) / 2];
}

function mostrarResultadosMapa(data) {
  window.OOT.log('[DETERMINANTES] mostrarResultadosMapa()');
  if (!mapa) { console.error('[DETERMINANTES] No hay mapa'); return; }
  
  if (!mapa.loaded()) {
    mapa.once('load', () => mostrarResultadosMapa(data));
    return;
  }
  
  let zoomAlMapa = 11;
  let centro = null;
  
  // Limpiar listeners de popups previos y todas las capas viejas
  _limpiarPopupHandlers();
  ['determinantes-polygons','determinantes-polygons-outline','determinantes-lines','determinantes-points',
   'predios-layer','predios-outline','zona-source','zona-source-outline','zona-consulta','zona-consulta-line',
   'draw-polygon','draw-polygon-line','draw-points'].forEach(lid => {
    if (mapa.getLayer(lid)) mapa.removeLayer(lid);
  });
  ['determinantes-polygons','determinantes-lines','determinantes-points','predios-source',
   'zona-source','zona-consulta','draw-polygon','draw-points'].forEach(sid => {
    if (mapa.getSource(sid)) mapa.removeSource(sid);
  });
  
  if (data.zona_geojson) {
    centro = centroideGeoJSON(data.zona_geojson);
    agregarCapaMapa('zona-source', data.zona_geojson, 'fill', '#3878c8', 0.15, true);
    window.OOT.log('[DETERMINANTES] Zona renderizada');
  } else if (data.modo === 'consulta_predio' && data.predios_geojson && data.predios_geojson.features.length > 0) {
    centro = centroideGeoJSON(data.predios_geojson);
  }
  // Fallback final: si no se pudo calcular centro, usar centroide de Colombia
  if (!centro) centro = [-74.2, 10.4];
  
  // MODO VIABILIDAD: colorear predios por veredicto
  if (data.modo === 'viabilidad' && data.predios_geojson && data.predios_geojson.features.length > 0) {
    window.OOT.log('[DETERMINANTES] Renderizando viabilidad predial...', data.predios_geojson.features.length);
    // Inyectar viabilidad_key para expresión de color en MapLibre
    const gjViab = JSON.parse(JSON.stringify(data.predios_geojson));
    gjViab.features.forEach(function(f) {
      const v = f.properties.viabilidad || '';
      if (v.includes('Compatible')) f.properties.viabilidad_key = 'compatible';
      else if (v.includes('Condicionado')) f.properties.viabilidad_key = 'condicionado';
      else if (v.includes('No viable')) f.properties.viabilidad_key = 'no_viable';
      else f.properties.viabilidad_key = 'sin_info';
    });
    mapa.addSource('predios-source', { type: 'geojson', data: gjViab });
    mapa.addLayer({
      id: 'predios-layer',
      type: 'fill',
      source: 'predios-source',
      paint: {
        'fill-color': ['match', ['get', 'viabilidad_key'],
          'compatible',   '#27ae60',
          'condicionado', '#f4a833',
          'no_viable',    '#c0392b',
          '#888888'
        ],
        'fill-opacity': 0.65
      }
    });
    mapa.addLayer({
      id: 'predios-outline',
      type: 'line',
      source: 'predios-source',
      paint: { 'line-color': '#ffffff', 'line-width': 1.5, 'line-opacity': 0.9 }
    });
    const escV = (s) => String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
    const onViabClick = function(e) {
      const p = e.features[0].properties || {};
      const npn = p.numero_predial || 'N/A';
      const viab = p.viabilidad || '⚪ Sin datos';
      const area = p.Shape_Area ? (p.Shape_Area / 10000).toFixed(2) + ' ha' : 'N/A';
      let html = '<div class="oot-js-determinantes-26">';
      html += '<div class="oot-js-determinantes-27">Predio ' + escV(npn) + '</div>';
      html += '<div class="oot-js-determinantes-28">' + escV(viab) + '</div>';
      html += '<div class="oot-js-determinantes-29">Área: ' + escV(area) + '</div>';
      html += '</div>';
      new maplibregl.Popup({ closeButton: true, maxWidth: '300px' }).setLngLat(e.lngLat).setHTML(html).addTo(mapa);
    };
    const onViabEnter = () => mapa.getCanvas().style.cursor = 'pointer';
    const onViabLeave = () => mapa.getCanvas().style.cursor = '';
    mapa.on('click', 'predios-layer', onViabClick);
    mapa.on('mouseenter', 'predios-layer', onViabEnter);
    mapa.on('mouseleave', 'predios-layer', onViabLeave);
    _popupHandlers.push({event:'click', layer:'predios-layer', fn:onViabClick});
    _popupHandlers.push({event:'mouseenter', layer:'predios-layer', fn:onViabEnter});
    _popupHandlers.push({event:'mouseleave', layer:'predios-layer', fn:onViabLeave});
    zoomAlMapa = 14;
    if (!centro) centro = centroideGeoJSON(data.predios_geojson) || [-74.2, 10.4];
  }

  // MODO PREDIO: renderizar predios
  if (data.modo === 'consulta_predio' && data.predios_geojson && data.predios_geojson.features.length > 0) {
    window.OOT.log('[DETERMINANTES] Renderizando predios...', data.predios_geojson.features.length);
    mapa.addSource('predios-source', { type: 'geojson', data: data.predios_geojson });
    mapa.addLayer({
      id: 'predios-layer',
      type: 'fill',
      source: 'predios-source',
      paint: {
        'fill-color': ['case', ['>', ['get', 'n_determinantes'], 0], '#f4a833', '#4a90d9'],
        'fill-opacity': 0.4
      }
    });
    mapa.addLayer({
      id: 'predios-outline',
      type: 'line',
      source: 'predios-source',
      paint: { 'line-color': '#ffffff', 'line-width': 1, 'line-opacity': 0.8 }
    });
    // Popups para predios (registrar con limpieza para evitar acumulación)
    const escapeP = (s) => (window.OOT && window.OOT.escapeHtml) ? window.OOT.escapeHtml(s) : String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
    const onPredioClick = function(e) {
      const p = e.features[0].properties || {};
      const npn = p.numero_predial || 'N/A';
      const nDets = p.n_determinantes || 0;
      const area = p.Shape_Area ? (p.Shape_Area / 10000).toFixed(2) + ' ha' : 'N/A';
      let html = '<div class="oot-js-determinantes-26">';
      html += '<div class="oot-js-determinantes-27">Predio ' + escapeP(npn) + '</div>';
      html += '<div class="oot-js-determinantes-5">Área: ' + escapeP(area) + '</div>';
      html += '<div class="oot-js-determinantes-30">' + nDets + ' determinante(s) asociado(s)</div>';
      if (p.det_json) {
        try {
          const dets = JSON.parse(p.det_json);
          if (Array.isArray(dets) && dets.length > 0) {
            html += '<div class="oot-js-determinantes-31">Nombres: ' + escapeP(dets.map(d => d.nomdet || d.nombre || '—').join(', ')) + '</div>';
          }
        } catch(_) {}
      }
      html += '</div>';
      new maplibregl.Popup({ closeButton: true, maxWidth: '300px' }).setLngLat(e.lngLat).setHTML(html).addTo(mapa);
    };
    const onPredioEnter = () => mapa.getCanvas().style.cursor = 'pointer';
    const onPredioLeave = () => mapa.getCanvas().style.cursor = '';
    mapa.on('click', 'predios-layer', onPredioClick);
    mapa.on('mouseenter', 'predios-layer', onPredioEnter);
    mapa.on('mouseleave', 'predios-layer', onPredioLeave);
    _popupHandlers.push({event:'click', layer:'predios-layer', fn:onPredioClick});
    _popupHandlers.push({event:'mouseenter', layer:'predios-layer', fn:onPredioEnter});
    _popupHandlers.push({event:'mouseleave', layer:'predios-layer', fn:onPredioLeave});
  }
  
  if (data.determinantes_geojson && data.determinantes_geojson.features && data.determinantes_geojson.features.length > 0) {
    window.OOT.log('[DETERMINANTES] Renderizando determinantes...');
    _detGeoJSON = data.determinantes_geojson;   // para el resaltado por selección
    limpiarResaltadoDeterminante();             // limpiar selección previa
    
    // Detectar campo de tipo dinámicamente
    const sample = data.determinantes_geojson.features[0]?.properties || {};
    window.OOT.log('[DETERMINANTES] Campos disponibles en determinantes:', Object.keys(sample));
    window.OOT.log('[DETERMINANTES] Valores de ejemplo:', JSON.stringify(sample));
    
    // Determinar qué campo usar para colores - FORZAR a usar 'determ' si existe
    const tieneCampoDeterm = 'determ' in sample;
    const tipoCampo = tieneCampoDeterm ? 'determ' : (sample.tipo || sample.nivel || null);
    window.OOT.log('[DETERMINANTES] Campo para colores:', tipoCampo, '- tiene determ:', tieneCampoDeterm);
    
    // Remover capas anteriores
    ['determinantes-polygons','determinantes-polygons-outline','determinantes-lines','determinantes-points'].forEach(lid => {
      if (mapa.getLayer(lid)) mapa.removeLayer(lid);
    });
    ['determinantes-polygons','determinantes-lines','determinantes-points'].forEach(sid => {
      if (mapa.getSource(sid)) mapa.removeSource(sid);
    });
    
    // Mapeo de colores por categoría IGAC (campo determ: 1-6)
    let colorExpresion;
    if (tipoCampo === 'determ' && tieneCampoDeterm) {
      colorExpresion = [
        'match', ['get', 'determ'],
        1, '#27ae60',   // Ambientales
        2, '#e67e22',   // Soberanía Alimentaria
        3, '#8e44ad',   // Patrimoniales
        4, '#2980b9',   // Infraestructura
        5, '#c0392b',   // Áreas Metropolitanas
        6, '#16a085',   // Proyectos Turísticos
        '#7a62d0'       // default
      ];
      window.OOT.log('[DETERMINANTES] Usando colores por campo determ');
    } else if (tipoCampo === 'tipo') {
      colorExpresion = [
        'match', ['get', 'tipo'],
        'Ambientales', '#27ae60',
        'Soberanía Alimentaria', '#e67e22',
        'Patrimoniales', '#8e44ad',
        'Infraestructura', '#2980b9',
        'Áreas Metropolitanas', '#c0392b',
        'Proyectos Turísticos', '#16a085',
        '#7a62d0'
      ];
    } else if (tipoCampo === 'nivel') {
      colorExpresion = [
        'match', ['get', 'nivel'],
        'Ambientales', '#27ae60',
        'Soberanía Alimentaria', '#e67e22',
        'Patrimoniales', '#8e44ad',
        'Infraestructura', '#2980b9',
        'Áreas Metropolitanas', '#c0392b',
        'Proyectos Turísticos', '#16a085',
        '#7a62d0'
      ];
    } else {
      // Si no hay campo de tipo, usar morado por defecto
      colorExpresion = '#7a62d0';
    }
    
    // Separar por tipo de geometría
    const allFeatures = data.determinantes_geojson.features;
    const polygons = { type: 'FeatureCollection', features: allFeatures.filter(f => f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon')) };
    const lines    = { type: 'FeatureCollection', features: allFeatures.filter(f => f.geometry && (f.geometry.type === 'LineString' || f.geometry.type === 'MultiLineString')) };
    const points   = { type: 'FeatureCollection', features: allFeatures.filter(f => f.geometry && (f.geometry.type === 'Point' || f.geometry.type === 'MultiPoint')) };
    
    const currentOpacity = (document.getElementById('opacity-slider')?.value || 50) / 100;
    
    // Polígonos
    if (polygons.features.length > 0) {
      mapa.addSource('determinantes-polygons', { type: 'geojson', data: polygons });
      mapa.addLayer({
        id: 'determinantes-polygons',
        type: 'fill',
        source: 'determinantes-polygons',
        paint: { 'fill-color': colorExpresion, 'fill-opacity': currentOpacity }
      });
      mapa.addLayer({
        id: 'determinantes-polygons-outline',
        type: 'line',
        source: 'determinantes-polygons',
        paint: { 'line-color': '#ffffff', 'line-width': 1, 'line-opacity': 0.7 }
      });
    }
    
    // Líneas
    if (lines.features.length > 0) {
      mapa.addSource('determinantes-lines', { type: 'geojson', data: lines });
      mapa.addLayer({
        id: 'determinantes-lines',
        type: 'line',
        source: 'determinantes-lines',
        paint: { 'line-color': colorExpresion, 'line-width': 2, 'line-opacity': currentOpacity }
      });
    }
    
    // Puntos
    if (points.features.length > 0) {
      mapa.addSource('determinantes-points', { type: 'geojson', data: points });
      mapa.addLayer({
        id: 'determinantes-points',
        type: 'circle',
        source: 'determinantes-points',
        paint: { 'circle-color': colorExpresion, 'circle-radius': 6, 'circle-opacity': currentOpacity, 'circle-stroke-color': '#fff', 'circle-stroke-width': 1 }
      });
    }
    
    window.OOT.log('[DETERMINANTES] Determinantes renderizados:', allFeatures.length, { polygons: polygons.features.length, lines: lines.features.length, points: points.features.length });
  }
  
  mapa.flyTo({ center: centro, zoom: zoomAlMapa, duration: 1500 });
}

function mostrarPopupDeterminantes() {
  // Limpiar handlers previos para evitar acumulación de popups
  _limpiarPopupHandlers();
  
  const capas = ['determinantes-polygons','determinantes-lines','determinantes-points'];
  const capasVisibles = capas.filter(id => mapa && mapa.getLayer(id));
  if (capasVisibles.length === 0) return;
  
  const esc =(s) => (window.OOT && window.OOT.escapeHtml) ? window.OOT.escapeHtml(s) : String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  
  capasVisibles.forEach(cid => {
    const onClick = function(e) {
      const p = e.features[0].properties || {};
      resaltarDeterminante(p.determ, p.nomdet);   // resaltar polígono completo en amarillo
      let html = '<div class="oot-js-determinantes-32">';
      const nombre = p.nomdet || p.nombre || p.determinante || p.NOMDET || 'Determinante sin nombre';
      html += '<div class="oot-js-determinantes-33">' + esc(nombre) + '</div>';
      const tipo = p.tdeterm || p.tipo || p.determ || p.tipo_deter || p.nivel || '';
      if (tipo) html += '<div class="oot-js-determinantes-34"><span class="oot-js-determinantes-35">TIPO:</span> <span class="oot-js-determinantes-36">' + esc(tipo) + '</span></div>';
      const cat = p.categoria || p.cat || '';
      if (cat) html += '<div class="oot-js-determinantes-37"><span class="oot-js-determinantes-35">CATEGORÍA:</span> <span class="oot-js-determinantes-38">' + esc(cat) + '</span></div>';
      Object.entries(p).forEach(([k, v]) => {
        if (v !== null && v !== undefined && v !== '' && !['nomdet','nombre','determinante','NOMDET','tdeterm','tipo','determ','categoria','cat','tipo_deter','nivel'].includes(k)) {
          html += '<div class="oot-js-determinantes-37"><span class="oot-js-determinantes-35">' + esc(k.replace(/_/g,' ').toUpperCase()) + ':</span> <span class="oot-js-determinantes-5">' + esc(String(v).substring(0, 100)) + '</span></div>';
        }
      });
      html += '</div>';
      new maplibregl.Popup({ closeButton: true, maxWidth: '320px' })
        .setLngLat(e.lngLat).setHTML(html).addTo(mapa);
    };
    const onEnter = () => mapa.getCanvas().style.cursor = 'pointer';
    const onLeave = () => mapa.getCanvas().style.cursor = '';
    mapa.on('click', cid, onClick);
    mapa.on('mouseenter', cid, onEnter);
    mapa.on('mouseleave', cid, onLeave);
    _popupHandlers.push({event:'click', layer:cid, fn:onClick});
    _popupHandlers.push({event:'mouseenter', layer:cid, fn:onEnter});
    _popupHandlers.push({event:'mouseleave', layer:cid, fn:onLeave});
  });
}

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

function ajustarOpacidad(val) {
  const op = parseInt(val, 10) / 100;
  const valEl = document.getElementById('opacity-val');
  if (valEl) valEl.textContent = val + '%';
  if (!mapa) return;
  if (mapa.getLayer('determinantes-polygons')) mapa.setPaintProperty('determinantes-polygons', 'fill-opacity', op);
  if (mapa.getLayer('determinantes-lines')) mapa.setPaintProperty('determinantes-lines', 'line-opacity', op);
  if (mapa.getLayer('determinantes-points')) mapa.setPaintProperty('determinantes-points', 'circle-opacity', op);
}

// ── Visibilidad POR-DETERMINANTE (ojo de cada ítem del listado) ────────────────
let _detOcultos = [];   // [{determ, nomdet}] de los determinantes apagados
function toggleDeterminanteVisibilidad(codigo, nombre, eyeBtn, item) {
  const nb = (nombre == null ? '' : String(nombre));
  const i = _detOcultos.findIndex(h => String(h.determ) === String(codigo) && (h.nomdet || '') === nb);
  let visible;
  if (i >= 0) { _detOcultos.splice(i, 1); visible = true; }       // estaba oculto → mostrar
  else { _detOcultos.push({ determ: codigo, nomdet: nb }); visible = false; }  // mostrar → ocultar
  const icon = eyeBtn && eyeBtn.querySelector('.material-symbols-outlined');
  if (icon) icon.textContent = visible ? 'visibility' : 'visibility_off';
  if (eyeBtn) eyeBtn.style.color = visible ? 'var(--oot-tx2)' : 'var(--oot-tx3)';
  if (item) item.style.opacity = visible ? '1' : '0.5';
  aplicarFiltroDeterminantes();
}
function aplicarFiltroDeterminantes() {
  if (!mapa) return;
  // Un feature se OCULTA si coincide con algún determinante apagado (mismo criterio que
  // resaltarDeterminante: determ + nomdet; si el ítem no trae nomdet, oculta por determ).
  const filtro = _detOcultos.length
    ? ['all', ..._detOcultos.map(h => {
        const base = ['==', ['to-string', ['get', 'determ']], String(h.determ)];
        const cond = h.nomdet
          ? ['all', base, ['==', ['to-string', ['get', 'nomdet']], String(h.nomdet)]]
          : base;
        return ['!', cond];
      })]
    : null;
  ['determinantes-polygons', 'determinantes-polygons-outline', 'determinantes-lines', 'determinantes-points']
    .forEach(lid => { if (mapa.getLayer(lid)) mapa.setFilter(lid, filtro); });
}

function toggleCapa(tipo) {
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

function descargarReporte() {
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

function descargarDeterminantesGeoJSON() {
  const data = _geojsonParaDescarga();
  if (!data || !data.gj) { window.OOT.notify('No hay datos para exportar', 'warn'); return; }
  const muni = document.getElementById('municipio');
  const codMpio = muni ? muni.value.split('|')[0] : 'nacional';
  const fecha = new Date().toISOString().slice(0, 10);
  // El GeoJSON YA está en memoria → se serializa en el cliente (instantáneo, sin backend).
  const blob = new Blob([JSON.stringify(data.gj)], { type: 'application/geo+json' });
  _descargarBlob(blob, data.nombre + '_' + codMpio + '_' + fecha + '.geojson');
}

// Carga perezosa de shp-write (vendorizado en el repo → offline-friendly, sin CDN).
let _shpWritePromise = null;
function _cargarShpWrite() {
  if (window.shpwrite) return Promise.resolve(window.shpwrite);
  if (_shpWritePromise) return _shpWritePromise;
  _shpWritePromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'js/shpwrite.js';   // servido por el host estático (catch-all → static/js/)
    s.onload = () => resolve(window.shpwrite);
    s.onerror = () => reject(new Error('No se pudo cargar shp-write'));
    document.head.appendChild(s);
  });
  return _shpWritePromise;
}
function _b64aBlob(b64, mime) {
  const bin = atob(b64), len = bin.length, bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

async function descargarDeterminantesSHP() {
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

function _mobCerrar() {
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

function _mobTab(tab) {
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
