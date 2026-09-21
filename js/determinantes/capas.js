import { _detGeoJSON, _detOcultos, _popupHandlers, mapa, setDetGeoJSON } from './estado.js';
import { boundsDeGeoJSON, centroideGeoJSON } from './geometria.js';
import { _limpiarPopupHandlers, agregarCapaMapa } from './mapa.js';

export function mostrarResultadosMapa(data) {
  window.OOT.log('[DETERMINANTES] mostrarResultadosMapa()');
  if (!mapa) { console.error('[DETERMINANTES] No hay mapa'); return; }
  
  if (!mapa.isStyleLoaded()) {
    // 'idle' SI vuelve a dispararse tras la carga inicial; 'load' es de una sola vez y
    // mapa.loaded() sigue en false mientras queden teselas en vuelo -> con red lenta los
    // resultados no llegaban nunca al mapa.
    mapa.once('idle', () => mostrarResultadosMapa(data));
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
  // Fallback final: centroide aproximado de Colombia continental. El valor anterior
  // ([-74.2, 10.4]) era Santa Marta, resto del alcance original en Magdalena.
  if (!centro) centro = [-73.5, 4.6];
  
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
    const escV = (s) => window.OOT.escapeHtml(s == null ? '' : s);
    const onViabClick = function(e) {
      const p = e.features[0].properties || {};
      const npn = p.numero_predial || 'N/A';
      const viab = p.viabilidad || 'Sin datos';
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
    const escapeP = (s) => window.OOT.escapeHtml(s);
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
    setDetGeoJSON(data.determinantes_geojson);   // para el resaltado por selección
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
    
    // B.1.6 — Paleta de NIVELES de determinante (campo determ: 1-6).
    // Deliberadamente SIN verde, ámbar ni rojo: esos tres están reservados a los
    // VEREDICTOS de viabilidad (Compatible / Condicionado / No viable, ver _colorVeredicto).
    // Antes ambas escalas compartían #27ae60 y #c0392b, así que un polígono verde podía
    // leerse como "Ambientales" o como "Compatible" según el modo, y uno rojo como
    // "Áreas Metropolitanas" o como "No viable". Si se cambia esta paleta, mantenerla
    // fuera del semáforo o vuelve la ambigüedad.
    // Debe coincidir con las dos leyendas de Modulo_Determinantes.html (inline-extracted.css).
    const COLORES_NIVEL = ['#14857a', '#8a6d3b', '#8e44ad', '#2980b9', '#f2a3c7', '#C9421B'];
    const NOMBRES_NIVEL = ['Ambientales', 'Soberanía Alimentaria', 'Patrimoniales',
                           'Infraestructura', 'Áreas Metropolitanas', 'Proyectos Turísticos'];
    const COLOR_NIVEL_DEFAULT = '#7a62d0';

    let colorExpresion;
    if (tipoCampo === 'determ' && tieneCampoDeterm) {
      // El campo `determ` es numérico (1-6)
      colorExpresion = ['match', ['get', 'determ']];
      COLORES_NIVEL.forEach((color, i) => colorExpresion.push(i + 1, color));
      colorExpresion.push(COLOR_NIVEL_DEFAULT);
      window.OOT.log('[DETERMINANTES] Usando colores por campo determ');
    } else if (tipoCampo === 'tipo' || tipoCampo === 'nivel') {
      // `tipo` y `nivel` traen el nombre del nivel, no el número. Antes eran dos bloques
      // idénticos duplicados; se unifican para que no puedan desincronizarse.
      colorExpresion = ['match', ['get', tipoCampo]];
      NOMBRES_NIVEL.forEach((nombre, i) => colorExpresion.push(nombre, COLORES_NIVEL[i]));
      colorExpresion.push(COLOR_NIVEL_DEFAULT);
    } else {
      // Si no hay campo de nivel, usar morado por defecto
      colorExpresion = COLOR_NIVEL_DEFAULT;
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

export function mostrarPopupDeterminantes() {
  // Limpiar handlers previos para evitar acumulación de popups
  _limpiarPopupHandlers();
  
  const capas = ['determinantes-polygons','determinantes-lines','determinantes-points'];
  const capasVisibles = capas.filter(id => mapa && mapa.getLayer(id));
  if (capasVisibles.length === 0) return;
  
  const esc = (s) => window.OOT.escapeHtml(s);
  
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

// Resalta en amarillo TODOS los polígonos de una determinante (determ + nomdet)
// y reencuadra el mapa a su extensión. Se invoca desde el mapa y desde el listado.
// También sincroniza el ítem del listado lateral (añade .sel y hace scrollIntoView).
export function resaltarDeterminante(determ, nomdet) {
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

export function toggleDeterminanteVisibilidad(codigo, nombre, eyeBtn, item) {
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
