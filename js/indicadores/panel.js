import { INDICADORES_CON_CLICK, PALETA_CHART, _chartRafId, chartInstance, datosActuales, escapeHtml, mapa, setChartInstance, setChartRafId } from './estado.js';

export function renderizarLeyenda(leyenda) {
  const cont = document.getElementById('leyenda-container');
  if (!leyenda || leyenda.length === 0) { cont.innerHTML = '<p class="text-xs oot-js-indicadores-4">Sin leyenda</p>'; return; }
  cont.innerHTML = leyenda.map(l => `
    <div class="flex items-center gap-2 text-xs oot-js-indicadores-3">
      <span class="leyenda-dot" data-color="${escapeHtml(l.color)}"></span>
      <span>${escapeHtml(l.label)}</span>
    </div>
  `).join('');
  cont.querySelectorAll('.leyenda-dot').forEach(function(dot) {
    dot.style.background = dot.dataset.color;
  });
}

export function renderizarStats(stats, unidad, id, leyenda) {
  const cards = document.getElementById('stats-cards');
  const detalle = document.getElementById('stats-detalle');
  if (!stats) { cards.innerHTML = ''; detalle.innerHTML = ''; return; }

  let cardHtml = '';
  if (id === 'cobveg') {
    cardHtml = '<div class="stat-card"><div class="stat-val">' + (stats.pct_natural ?? '—') + '%</div><div class="stat-label">Cob. Vegetal Natural</div></div>' +
      '<div class="stat-card"><div class="stat-val">' + _fmt(stats.natural_ha) + '</div><div class="stat-label">Ha vegetación natural</div></div>';
  } else if (id === 'amenaza_masa' || id === 'amenaza_inundacion') {
    cardHtml = '<div class="stat-card"><div class="stat-val">' + _fmt(stats.total_personas) + '</div><div class="stat-label">Personas</div></div>' +
      '<div class="stat-card"><div class="stat-val">' + _fmt(stats.total_viviendas) + '</div><div class="stat-label">Viviendas</div></div>';
  } else if (id === 'deforestacion_pnn') {
    const haDefor = stats.area_deforestada_pnn_ha != null ? _fmt(stats.area_deforestada_pnn_ha) : '—';
    cardHtml = '<div class="stat-card"><div class="stat-val">' + _fmt(stats.parques_nacionales) + '</div><div class="stat-label">Parques</div></div>' +
      '<div class="stat-card"><div class="stat-val">' + _fmt(stats.area_pnn_terrestre_ha) + '</div><div class="stat-label">Ha PNN</div></div>' +
      '<div class="stat-card oot-js-indicadores-8"><div class="stat-val oot-js-indicadores-9">' + haDefor + '</div><div class="stat-label">Ha Deforestadas 2021–2022</div></div>';
  } else if (id === 'priorizacion_agro') {
    cardHtml = '<div class="stat-card oot-js-indicadores-7"><div class="stat-val">' + _fmt(stats.total_ha) + '</div><div class="stat-label">Ha total cruce</div></div>' +
      '<div class="stat-card"><div class="stat-val">' + _fmt(stats.area_agricola_ha) + '</div><div class="stat-label">Ha Agrícola</div></div>' +
      '<div class="stat-card"><div class="stat-val">' + _fmt(stats.area_ganadera_ha) + '</div><div class="stat-label">Ha Ganadera</div></div>' +
      '<div class="stat-card oot-js-indicadores-7"><div class="stat-val">' + _fmt(stats.area_agroforestal_ha) + '</div><div class="stat-label">Ha Agroforestal</div></div>';
  } else if (id === 'brecha_expansion') {
    cardHtml = '<div class="stat-card"><div class="stat-val">' + (stats.d_fuera_pct ?? '—') + '%</div><div class="stat-label">D_fuera</div></div>' +
      '<div class="stat-card"><div class="stat-val">' + _fmt(stats.area_perimetros_ha) + '</div><div class="stat-label">Ha perímetro</div></div>';
  } else if (id === 'brecha_subutilizacion') {
    cardHtml = '<div class="stat-card"><div class="stat-val">' + (stats.d_dentro_pct ?? '—') + '%</div><div class="stat-label">D_dentro</div></div>' +
      '<div class="stat-card"><div class="stat-val">' + _fmt(stats.predios_rurales_dentro) + '</div><div class="stat-label">Predios rurales dentro</div></div>';
  } else if (id === 'tensiones_territoriales') {
    cardHtml = '<div class="stat-card oot-js-indicadores-7"><div class="stat-val">' + _fmt(stats.total_conflictos) + '</div><div class="stat-label">Conflictos de uso del suelo</div></div>';
  } else {
    // Solo valores escalares (nunca objetos/arrays → evita "[object Object]")
    const entries = Object.entries(stats)
      .filter(([k, v]) => v !== null && v !== undefined && typeof v !== 'object')
      .slice(0, 2);
    cardHtml = entries.map(([k, v]) => '<div class="stat-card"><div class="stat-val">' + _fmt(v) + '</div><div class="stat-label">' + escapeHtml(k.replace(/_/g, ' ')) + '</div></div>').join('');
  }
  cards.innerHTML = cardHtml || '<p class="text-xs oot-js-indicadores-10">Sin estadísticas</p>';

  renderizarTorta(stats, id, leyenda);

  let detalleHtml = '';
  if (stats.por_categoria) {
    detalleHtml += '<p class="text-xs font-bold uppercase tracking-wider mb-2 oot-js-indicadores-4">Por categoría</p>';
    for (const [cat, vals] of Object.entries(stats.por_categoria)) {
      const vStr = typeof vals === 'object' ? 'Personas: ' + _fmt(vals.personas) + ' · Hogares: ' + _fmt(vals.hogares) : _fmt(vals);
      detalleHtml += '<div class="flex justify-between border-b border-ot-b1 py-1"><span class="oot-js-indicadores-3">' + escapeHtml(cat) + '</span><span class="oot-js-indicadores-17">' + vStr + '</span></div>';
    }
  }
  if (stats.por_categoria_ha) {
    detalleHtml += '<p class="text-xs font-bold uppercase tracking-wider mb-2 mt-3 oot-js-indicadores-4">Área (ha)</p>';
    for (const [cat, ha] of Object.entries(stats.por_categoria_ha)) {
      detalleHtml += '<div class="flex justify-between border-b border-ot-b1 py-1"><span class="oot-js-indicadores-3">' + escapeHtml(cat) + '</span><span class="oot-js-indicadores-17">' + _fmt(ha) + ' ha</span></div>';
    }
  }
  if (stats.por_cruce && Array.isArray(stats.por_cruce)) {
    detalleHtml += '<p class="text-xs font-bold uppercase tracking-wider mb-2 mt-3 oot-js-indicadores-4">Cruce</p>';
    for (const row of stats.por_cruce) {
      const cat = row.tipo_front + ' — ' + row.Vocacion;
      detalleHtml += '<div class="flex justify-between border-b border-ot-b1 py-1"><span class="oot-js-indicadores-3">' + escapeHtml(cat) + '</span><span class="oot-js-indicadores-17">' + _fmt(row.area_ha) + ' ha <span class="oot-js-indicadores-4">(' + row.porcentaje + '%)</span></span></div>';
    }
  }
  if (stats.conteos_por_tipo && typeof stats.conteos_por_tipo === 'object') {
    detalleHtml += '<p class="text-xs font-bold uppercase tracking-wider mb-2 mt-3 oot-js-indicadores-4">Por tipo de conflicto</p>';
    for (const [cat, n] of Object.entries(stats.conteos_por_tipo)) {
      detalleHtml += '<div class="flex justify-between border-b border-ot-b1 py-1"><span class="oot-js-indicadores-3">' + escapeHtml(cat) + '</span><span class="oot-js-indicadores-17">' + _fmt(n) + '</span></div>';
    }
  }
  if (stats.nota) {
    detalleHtml += '<p class="text-xs mt-3 italic oot-js-indicadores-4">' + escapeHtml(stats.nota) + '</p>';
  }
  detalle.innerHTML = detalleHtml || '<p class="text-xs oot-js-indicadores-4">Sin estadísticas adicionales</p>';
}

function renderizarTorta(stats, id, leyenda) {
  const section = document.getElementById('torta-section');
  // Cancelar rAF pendiente antes de destruir el chart (evita race condition)
  if (_chartRafId) { cancelAnimationFrame(_chartRafId); setChartRafId(null); }
  if (chartInstance) { chartInstance.destroy(); setChartInstance(null); }

  if (id === 'brecha_expansion' || id === 'brecha_subutilizacion') {
    section.style.display = 'none';
    return;
  }

  const leyendaColores = (leyenda && leyenda.length > 0) ? leyenda.map(e => e.color) : null;
  const leyendaByLabel = {};
  if (leyenda) leyenda.forEach(e => { leyendaByLabel[e.label] = e.color; });
  let labels = [], valores = [], colores = [];
  let layerName = null;

  if (id === 'cobveg') {
    labels  = ['Bosque denso', 'Bosque abierto', 'Otras coberturas'];
    valores = [stats.bosque_denso_ha || 0, stats.bosque_abierto_ha || 0, Math.max(0, (stats.total_ha || 0) - (stats.natural_ha || 0))];
    // Las 3 categorias NO son los rangos de % de la leyenda del mapa: colores propios y distinguibles.
    colores = ['#166534', '#4ade80', '#cbd5e1'];
    layerName = 'cobertura';
  } else if ((id === 'amenaza_masa' || id === 'amenaza_inundacion') && stats.por_categoria) {
    for (const [cat, vals] of Object.entries(stats.por_categoria)) {
      labels.push(cat);
      valores.push(typeof vals === 'object' ? (vals.personas || 0) : (vals || 0));
    }
    // T4.5: usar el mismo color por nombre de categoría que usa el mapa (no por posición)
    colores = labels.map(cat => leyendaByLabel[cat] || PALETA_CHART[labels.indexOf(cat) % PALETA_CHART.length]);
    layerName = 'amenaza';
  } else if (id === 'priorizacion_agro' && stats.por_cruce && stats.por_cruce.length) {
    // Consolidar en 3 grupos por Vocacion
    const grupos = {};
    stats.por_cruce.forEach(row => {
      const v = row.Vocacion || 'Otro';
      grupos[v] = (grupos[v] || 0) + (row.area_ha || 0);
    });
    Object.entries(grupos).forEach(([v, ha], i) => {
      labels.push(v);
      valores.push(ha);
      colores.push(leyendaByLabel[v] || PALETA_CHART[i % PALETA_CHART.length]);
    });
    layerName = 'priorizacion';
  } else if (id === 'deforestacion_pnn') {
    const top = stats.top_parques_deforestados;
    if (top && top.length > 0) {
      const colorPorHa = (ha) => {
        if (ha >= 500) return '#dc2626';
        if (ha >= 300) return '#f97316';
        if (ha >= 100) return '#facc15';
        if (ha > 0)    return '#4ade80';
        return '#166534';
      };
      top.forEach(p => {
        labels.push(p.nombre);
        valores.push(p.ha);
        colores.push(colorPorHa(p.ha || 0));
      });
    } else { section.style.display = 'none'; return; }
    layerName = 'runap';
  } else if (id === 'tensiones_territoriales' && stats.por_categoria) {
    for (const [cat, count] of Object.entries(stats.por_categoria)) {
      labels.push(cat);
      valores.push(typeof count === 'object' ? (count.total || 0) : (count || 0));
      colores.push(leyendaByLabel[cat] || PALETA_CHART[labels.length % PALETA_CHART.length]);
    }
    layerName = 'conflictos';
  }

  if (valores.length === 0 || valores.every(v => v === 0)) {
    section.style.display = 'none';
    return;
  }

  const tieneClick = INDICADORES_CON_CLICK.has(id) && layerName;
  section.style.display = '';
  setChartRafId(requestAnimationFrame(() => {
    setChartRafId(null);
    const ctx = document.getElementById('grafico-torta').getContext('2d');
    setChartInstance(new Chart(ctx, {
      type: 'doughnut',
      data: { labels, datasets: [{ data: valores, backgroundColor: colores, borderWidth: 2, borderColor: '#ffffff', hoverOffset: tieneClick ? 12 : 6 }] },
      options: {
        responsive: true, cutout: '55%',
        onClick: tieneClick ? (evt, elements) => {
          if (!elements.length || !datosActuales) return;
          const label = chartInstance.data.labels[elements[0].index];
          if (id === 'deforestacion_pnn') { volarAParque(label); } else { volarACategoria(label, layerName); }
        } : undefined,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => {
          const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
          const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
          // A.4.1 — El símbolo de hectárea es 'ha' en minúscula (SI), no 'Ha'.
          const unidad = (id === 'amenaza_masa' || id === 'amenaza_inundacion') ? 'personas' : 'ha';
          return ' ' + ctx.label + ': ' + ctx.parsed.toLocaleString('es-CO') + ' ' + unidad + ' (' + pct + '%)';
        }}} }
      }
    }));
    document.getElementById('grafico-torta').style.cursor = tieneClick ? 'pointer' : 'default';
    section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }));
}

function volarACategoria(label, layerName) {
  if (!mapa || !datosActuales || !datosActuales.layers) return;
  const geojson = datosActuales.layers[layerName];
  if (!geojson || !geojson.features) return;

  const labelNorm = label.trim().toLowerCase();
  const features = geojson.features.filter(f => {
    const cat = (f.properties.categoria_ind || '').trim().toLowerCase();
    return cat === labelNorm || cat.includes(labelNorm) || labelNorm.includes(cat);
  });

  if (!features.length) return;
  _limpiarHighlight();
  const highlightGJ = { type: 'FeatureCollection', features };
  mapa.addSource('highlight-src', { type: 'geojson', data: highlightGJ, tolerance: 0 });
  mapa.addLayer({ id: 'highlight-line', type: 'line', source: 'highlight-src', paint: { 'line-color': '#facc15', 'line-width': 3, 'line-opacity': 1 } });
  mapa.addLayer({ id: 'highlight-fill', type: 'fill', source: 'highlight-src', paint: { 'fill-color': '#facc15', 'fill-opacity': 0.25 } });

  const bounds = new maplibregl.LngLatBounds();
  features.forEach(f => {
    if (!f.geometry) return;
    function _add(arr) { if (!Array.isArray(arr)) return; if (typeof arr[0] === 'number') { bounds.extend(arr); return; } arr.forEach(_add); }
    _add(f.geometry.coordinates);
  });

  if (!bounds.isEmpty()) { mapa.fitBounds(bounds, { padding: 60, maxZoom: 10, duration: 1000 }); }
  setTimeout(_limpiarHighlight, 5000);
}

export function _limpiarHighlight() {
  if (!mapa) return;
  ['highlight-fill', 'highlight-line'].forEach(id => { if (mapa.getLayer(id)) mapa.removeLayer(id); });
  if (mapa.getSource('highlight-src')) mapa.removeSource('highlight-src');
}

function volarAParque(nombre) {
  if (!mapa || !datosActuales || !datosActuales.layers) return;
  const geojson = datosActuales.layers['runap'];
  if (!geojson || !geojson.features) return;

  const nombreNorm = nombre.trim().toLowerCase();
  const feature = geojson.features.find(f => {
    const n = (f.properties.ap_nombre || '').trim().toLowerCase();
    return n === nombreNorm || n.includes(nombreNorm) || nombreNorm.includes(n);
  });

  if (!feature || !feature.geometry) return;
  _limpiarHighlight();
  const highlightGJ = { type: 'FeatureCollection', features: [feature] };
  mapa.addSource('highlight-src', { type: 'geojson', data: highlightGJ, tolerance: 0 });
  mapa.addLayer({ id: 'highlight-line', type: 'line', source: 'highlight-src', paint: { 'line-color': '#facc15', 'line-width': 4, 'line-opacity': 1 } });
  mapa.addLayer({ id: 'highlight-fill', type: 'fill', source: 'highlight-src', paint: { 'fill-color': '#facc15', 'fill-opacity': 0.3 } });

  const bounds = new maplibregl.LngLatBounds();
  function _addCoords(arr) { if (!Array.isArray(arr)) return; if (typeof arr[0] === 'number') { bounds.extend(arr); return; } arr.forEach(_addCoords); }
  _addCoords(feature.geometry.coordinates);

  if (!bounds.isEmpty()) {
    mapa.fitBounds(bounds, { padding: 80, maxZoom: 9, duration: 1200 });
    const ha = feature.properties.deforestacion_ha || 0;
    const centro = bounds.getCenter();
    new maplibregl.Popup({ closeButton: true, maxWidth: '220px' })
      .setLngLat(centro)
      .setHTML('<div class="oot-js-indicadores-15">' + escapeHtml(feature.properties.ap_nombre || '') + '</div><div class="oot-js-indicadores-18"><span class="oot-js-indicadores-17">Deforestación:</span> ' + ha.toLocaleString('es-CO') + ' ha</div>')
      .addTo(mapa);
  }
  setTimeout(_limpiarHighlight, 6000);
}

export function _fmt(n) {
  if (n === null || n === undefined) return '—';
  if (typeof n === 'number') return n.toLocaleString('es-CO');
  return n;
}
