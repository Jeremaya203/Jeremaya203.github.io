import { INDICADORES_PMTILES, INDICADORES_PMTILES_POR_DEPT, _mapHandlers, capasActivas, deptActivo, escalaActiva, escapeHtml, mapa, setCapasActivas } from './estado.js';
import { _colorPorCategoria, agregarToggleCapa, limpiarCapas } from './mapa.js';

// Renderiza un indicador desde su PMTiles (fill por categoria_ind, filtrado al dept activo).
// Los .pmtiles se sirven estáticos desde el MISMO origen que la página (no por OOT_API_BASE).
function _notaSinTile() {
  const cont = document.getElementById('mapa-controles');
  if (!cont) return;
  // Idempotente: si ya hay una nota (al alternar capas/indicadores), reutilizarla
  // en vez de apilar varias. Id estable para localizarla.
  let n = document.getElementById('nota-sin-tile');
  if (!n) {
    n = document.createElement('div');
    n.id = 'nota-sin-tile';
    cont.appendChild(n);
  }
  // H-16 / Obs 20: el 404 del tile puede ser "sin datos en esa unidad" o "los .pmtiles no se
  // desplegaron en este host" → mensaje funcional que cubre ambos casos sin inducir a error
  // (degradación controlada; no se deja el fallo solo en consola del navegador).
  n.textContent = 'Sin cobertura en la unidad seleccionada, o la capa de mapas (tiles) no está disponible en este despliegue.';
}

async function cargarCapaPMTiles(data, colorMap) {
  const id = data.indicador_id;
  const sourceId = 'src-' + id, layerId = 'lyr-' + id;
  // Base de los tiles: OOT_TILES_BASE explícito → si no, el MISMO origen que el frontend
  // (los .pmtiles se publican junto al sitio en /tiles/, p. ej. co-ubicados en GitHub Pages
  // → sin CORS). Para servirlos desde otro host, definir OOT_TILES_BASE en config.js.
  const tbase = (window.OOT_TILES_BASE || window.location.origin).replace(/\/$/, '');
  // amenaza_masa se sirve por departamento (<id>_<dep>.pmtiles); el resto, archivo único.
  const fname = INDICADORES_PMTILES_POR_DEPT.has(id) ? `${id}_${deptActivo}.pmtiles` : `${id}.pmtiles`;
  const httpUrl = `${tbase}/tiles/${fname}`;
  // Algunos departamentos no tienen datos del indicador → no existe el tile. Verificar
  // antes de cargar (range mínimo) para no disparar errores de MapLibre y avisar limpio.
  try {
    const probe = await fetch(httpUrl, { headers: { Range: 'bytes=0-0' } });
    if (probe.status === 404 || probe.status === 403 || probe.status >= 500) {
      _notaSinTile(); return;
    }
  } catch (e) { _notaSinTile(); return; }
  mapa.addSource(sourceId, { type: 'vector', url: `pmtiles://${httpUrl}` });

  // Campo de categoría: amenaza_masa (pipeline GDAL desde la capa Remoción) trae 'CATAME';
  // el resto trae 'categoria_ind'. Sus valores (Alta/Media/Baja…) coinciden con la leyenda.
  const catField = (id === 'amenaza_masa') ? 'CATAME' : 'categoria_ind';
  const fillColor = Object.keys(colorMap).length
    ? ['match', ['get', catField], ...Object.entries(colorMap).flat(), '#94a3b8']
    : '#3878c8';
  // Per-dept (<id>_<dep>.pmtiles): el archivo YA es el dept → sin filtro (y no trae 'dep').
  // Single-file nacional: filtrar al dept activo por el atributo 'dep'.
  const fOpts = INDICADORES_PMTILES_POR_DEPT.has(id)
    ? {}
    : { filter: ['==', ['get', 'dep'], String(deptActivo)] };

  mapa.addLayer({ id: layerId + '-fill', type: 'fill', source: sourceId,
    'source-layer': id, ...fOpts, paint: { 'fill-color': fillColor, 'fill-opacity': 0.65 } });
  mapa.addLayer({ id: layerId + '-line', type: 'line', source: sourceId,
    'source-layer': id, ...fOpts, paint: { 'line-color': '#ffffff', 'line-width': 0.4, 'line-opacity': 0.5 } });

  capasActivas[id] = true;
  agregarToggleCapa(id, '#3878c8', layerId);

  const onClick = (e) => {
    const p = (e.features && e.features[0] && e.features[0].properties) || {};
    new maplibregl.Popup({ closeButton: true, maxWidth: '240px' })
      .setLngLat(e.lngLat)
      .setHTML('<div class="oot-js-indicadores-14">' + escapeHtml(p[catField] || p.categoria_ind || id) + '</div>')
      .addTo(mapa);
  };
  mapa.on('click', layerId + '-fill', onClick);
  _mapHandlers.push({ event: 'click', layer: layerId + '-fill', fn: onClick });

  // Mantener los bordes administrativos por encima del relleno del indicador.
  ['dept-ref-fill', 'dept-ref-borde', 'muni-ref-fill', 'muni-ref-borde'].forEach(idr => {
    if (mapa.getLayer(idr)) mapa.moveLayer(idr);
  });
}

export function cargarCapasEnMapa(data) {
  if (window.OOT_DEBUG) window.OOT.log('Cargando capas en mapa...', data.layers);

  limpiarCapas();
  setCapasActivas({});
  const _ctrl2 = document.getElementById('mapa-controles');
  if (_ctrl2) _ctrl2.innerHTML = '';

  const colorMap = _colorPorCategoria(data.leyenda);

  // Indicadores de polígonos → vector tiles (geometría perfecta, recortada al depto).
  // EXCEPCIÓN escala municipal: los tiles son de granularidad departamental (no llegan
  // a municipio), así que ahí usamos el GeoJSON que el backend devuelve YA recortado al
  // municipio (basemap intacto, recorte real, sin máscara de color).
  if (INDICADORES_PMTILES.has(data.indicador_id) && escalaActiva !== 'municipal') {
    cargarCapaPMTiles(data, colorMap);
    return;
  }
  const layers = data.layers || {};
  const coloresPaleta = ['#c8573e','#3878c8','#4a9a5c','#7a62d0','#c4922a','#2a8f7a','#e07058','#5a5450'];

  let idx = 0;

  for (const [nombre, geojson] of Object.entries(layers)) {
    if (window.OOT_DEBUG) window.OOT.log('  - Capa:', nombre, 'features:', geojson?.features?.length || 0);
    
    if (!geojson || !geojson.features || geojson.features.length === 0) {
      console.warn('  Capa', nombre, 'vacía, saltando...');
      continue;
    }

    const sourceId = 'src-' + nombre;
    const layerId = 'lyr-' + nombre;
    const color = coloresPaleta[idx % coloresPaleta.length];
    idx++;

    // tolerance:0 → MapLibre rinde la geometría tal cual (ya viene pre-simplificada
    // del backend). Sin esto, geojson-vt la re-simplifica por tile y se ve facetada
    // o "triangulada" al hacer zoom.
    const srcOpts = { type: 'geojson', data: geojson, tolerance: 0 };
    if (nombre.includes('amenaza')) srcOpts.generateId = true;
    mapa.addSource(sourceId, srcOpts);

    const geomTipo = geojson.features[0]?.geometry?.type || 'Polygon';
    const esLinea = geomTipo.includes('Line');
    const esPunto = geomTipo.includes('Point');
    const esRunap = nombre === 'runap';

    if (esPunto) {
      mapa.addLayer({
        id: layerId, type: 'circle', source: sourceId,
        paint: {
          'circle-color': ['match', ['get', 'categoria_ind'],
            ...Object.entries(colorMap).flat(), color],
          'circle-radius': 5,
          'circle-opacity': 0.8,
        }
      });
    } else if (esLinea) {
      mapa.addLayer({
        id: layerId, type: 'line', source: sourceId,
        paint: { 'line-color': color, 'line-width': 2 }
      });
    } else if (esRunap) {
      mapa.addLayer({
        id: layerId + '-fill', type: 'fill', source: sourceId,
        paint: {
          'fill-color': [
            'case',
            ['==', ['get', 'categoria_ind'], 'Parque Nacional Natural'],
            [
              'step', ['coalesce', ['get', 'deforestacion_ha'], 0],
              '#166534',       // 0 ha = sin deforestación
              1,   '#4ade80',  // 1–99 ha = baja
              100, '#facc15',  // 100–299 ha = media
              300, '#f97316',  // 300–499 ha = alta
              500, '#dc2626'   // ≥500 ha = muy alta
            ],
            '#a78bfa'
          ],
          'fill-opacity': 0.75,
        }
      });
      mapa.addLayer({
        id: layerId + '-line', type: 'line', source: sourceId,
        paint: { 'line-color': '#ffffff', 'line-width': 0.5, 'line-opacity': 0.6 }
      });
    } else {
      mapa.addLayer({
        id: layerId + '-fill', type: 'fill', source: sourceId,
        paint: {
          'fill-color': Object.keys(colorMap).length > 0
            ? ['match', ['get', 'categoria_ind'], ...Object.entries(colorMap).flat(), '#94a3b8']
            : color,
          'fill-opacity': 0.65,
        }
      });
      mapa.addLayer({
        id: layerId + '-line', type: 'line', source: sourceId,
        paint: { 'line-color': '#ffffff', 'line-width': 0.4, 'line-opacity': 0.5 }
      });
    }

    capasActivas[nombre] = true;
    agregarToggleCapa(nombre, color, layerId);

    const targetLayer = esPunto ? layerId : layerId + '-fill';
    if (mapa.getLayer(targetLayer)) {
      // A.4.1 / A.4.2 — Sin alias, el popup muestra el nombre crudo del campo
      // ('area_ha' → "area ha"): abreviado, sin tilde e incomprensible. Todo campo
      // que llegue al usuario debe tener aquí su etiqueta en español y con unidad.
      const ALIAS_CAMPOS = {
        'NOMBRE_GEOGRAFICO': 'Municipio',
        'CATAME': 'Categoría amenaza',
        'BASE2001': 'Clase inundación',
        'nivel_2': 'Nivel cobertura',
        'tipo_front': 'Tipo frontera',
        'Vocacion': 'Vocación',
        'ap_nombre': 'Nombre parque',
        'ap_categor': 'Categoría RUNAP',
        'CODIGO_NOMBRE': 'Tipo área',
        'nomdet': 'Determinante',
        'tdeterm': 'Nivel',
        'area_ha': 'Área (ha)',
        'area_m2': 'Área (m²)',
        'porcentaje': 'Porcentaje (%)',
        'cobertura_zona_pct': 'Cobertura en la zona (%)',
        'deforestacion_ha': 'Deforestación (ha)',
        'personas': 'Personas',
        'hogares': 'Hogares',
        'viviendas': 'Viviendas',
        'T_Conflicto': 'Tipo de conflicto',
        'MpNombre': 'Municipio',
        'MpCodigo': 'Código del municipio',
        'codigo_municipio': 'Código del municipio',
        'clase_suelo': 'Clase de suelo',
        'acto_administrativo': 'Acto administrativo',
      };
      const onClick = (e) => {
        const props = e.features[0].properties;
        let html = '<div class="oot-js-indicadores-15">' + escapeHtml(props.categoria_ind || nombre) + '</div>';
        for (const [k, v] of Object.entries(props)) {
          if (k === 'categoria_ind' || k.startsWith('_')) continue;
          if (v !== null && v !== undefined && String(v).trim() !== '') {
            const label = ALIAS_CAMPOS[k] || k.replace(/_/g, ' ');
            html += '<div class="oot-js-indicadores-16"><span class="oot-js-indicadores-17">' + escapeHtml(label) + ':</span><span>' + escapeHtml(String(v)) + '</span></div>';
          }
        }
        new maplibregl.Popup({ closeButton: true, maxWidth: '260px' })
          .setLngLat(e.lngLat).setHTML(html).addTo(mapa);
      };
      const onEnter = () => mapa.getCanvas().style.cursor = 'pointer';
      const onLeave = () => mapa.getCanvas().style.cursor = '';
      mapa.on('click', targetLayer, onClick);
      mapa.on('mouseenter', targetLayer, onEnter);
      mapa.on('mouseleave', targetLayer, onLeave);
      _mapHandlers.push({event:'click', layer:targetLayer, fn:onClick});
      _mapHandlers.push({event:'mouseenter', layer:targetLayer, fn:onEnter});
      _mapHandlers.push({event:'mouseleave', layer:targetLayer, fn:onLeave});
    }
  }

  // Mantener los bordes administrativos por encima de las capas del indicador
  ['dept-ref-fill', 'dept-ref-borde', 'muni-ref-fill', 'muni-ref-borde'].forEach(id => {
    if (mapa.getLayer(id)) mapa.moveLayer(id);
  });

  // Zoom al bbox de los datos del indicador
  const bounds = new maplibregl.LngLatBounds();
  function _extendCoords(arr) {
    if (!Array.isArray(arr)) return;
    if (typeof arr[0] === 'number') { bounds.extend(arr); return; }
    arr.forEach(_extendCoords);
  }
  Object.values(layers).forEach(gj => {
    if (gj && gj.features) {
      gj.features.forEach(f => {
        if (f.geometry && f.geometry.coordinates) _extendCoords(f.geometry.coordinates);
      });
    }
  });
  if (!bounds.isEmpty()) {
    mapa.fitBounds(bounds, { padding: 40, maxZoom: 12, duration: 800 });
  }
}
