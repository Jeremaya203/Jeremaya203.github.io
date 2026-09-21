import { API, NOMBRES_DEPTS, RAMPAS_NACIONAL, RAMPA_NACIONAL_DEFECTO, STAT_PRINCIPAL, _fetchToken, siguienteFetchToken, _mapHandlers, _nacionalPopup, catalogo, escapeHtml, indicadorActivo, mapa, setIndicadorActivo, setNacionalPopup } from './estado.js';
import { mostrarCargando, mostrarError } from './indicador.js';
import { limpiarCapas } from './mapa.js';
import { _fmt, renderizarLeyenda } from './panel.js';

export async function seleccionarNacional(id) {
  setIndicadorActivo(id);
  mostrarCargando(id);
  const myToken = siguienteFetchToken();
  try {
    const [geoResp, statsResp] = await Promise.all([
      fetch(API + '/api/geo/nacional'),
      fetch(API + '/api/indicadores/nacional/' + id)
    ]);
    if (myToken !== _fetchToken) return;
    if (!geoResp.ok || !statsResp.ok) throw new Error('Error cargando datos nacionales');
    const geo   = await geoResp.json();
    const stats = await statsResp.json();
    if (myToken !== _fetchToken) return;
    renderizarChoroplethNacional(geo, stats);
  } catch(e) {
    if (myToken !== _fetchToken) return;
    mostrarError(e.message);
  }
}

// Redondeo "bonito" de los cortes de la leyenda nacional, con rigor por unidad:
//  · % → entero (12,3 → 12).
//  · conteos / ha → 2 cifras significativas, números redondos y legibles
//    (1.234 → 1.200; 45.231 → 45.000; 8,6 → 9). Evita decimales feos en la leyenda.
function _redondearLeyenda(v, unidad) {
  if (v == null || isNaN(v)) return v;
  if (unidad && unidad.indexOf('%') !== -1) return Math.round(v);
  if (v === 0) return 0;
  const d = Math.floor(Math.log10(Math.abs(v)));
  const mag = Math.pow(10, Math.max(0, d - 1));   // 2 cifras significativas (entero si v<10)
  return Math.round(v / mag) * mag;
}

function _coloreadorNacional(leyenda, values, unidad, indicadorId) {
  const SIN = '#1a2e40';
  const u = unidad ? ' ' + unidad : '';
  leyenda = leyenda || [];
  const parsed = leyenda.map(l => ({
    color: l.color, label: l.label,
    nums: (String(l.label).match(/\d[\d.,]*/g) || [])
            .map(s => parseFloat(s.replace(/\./g, '').replace(',', '.')))
            .filter(n => !isNaN(n)),
  }));
  const todasConNumero = parsed.length >= 2 && parsed.every(p => p.nums.length > 0);

  if (todasConNumero) {
    // Modo RANGOS: lower bound = primer número de cada etiqueta; color por umbral.
    const items = parsed.map(p => ({ color: p.color, lo: p.nums[0] }))
                        .sort((a, b) => a.lo - b.lo);
    return {
      color: v => {
        if (v == null || isNaN(v)) return SIN;
        let c = items[0].color;
        for (const it of items) if (v >= it.lo) c = it.color;
        return c;
      },
      leyenda: leyenda.concat([{ color: SIN, label: 'Sin datos' }]),
    };
  }

  // Modo CUANTIL con la rampa secuencial TEMÁTICA del indicador (no la paleta categórica,
  // que es cualitativa y no comunica magnitud). Claro→oscuro = menos→más.
  const pal = RAMPAS_NACIONAL[indicadorId] || RAMPA_NACIONAL_DEFECTO;
  const sorted = [...values].sort((a, b) => a - b);
  const N = sorted.length;
  // Cortes de cuantil REDONDEADOS = límite superior de cada bucket salvo el último
  // (pal.length-1 cortes). El coloreador Y la leyenda usan EXACTAMENTE estos cortes, así el
  // color de un dept siempre cae en el rango que muestra la leyenda. (Antes el color
  // bucketeaba por fracción de rango idx/N y no coincidía con los cortes redondeados.)
  let cortes = [];
  if (N) {
    const q = p => sorted[Math.min(N - 1, Math.floor(p * N))];
    for (let i = 0; i < pal.length - 1; i++) {
      cortes.push(_redondearLeyenda(q((i + 1) / pal.length), unidad));
    }
  }
  const color = v => {
    if (v == null || isNaN(v)) return SIN;   // 0 SI es dato; solo null/NaN es ausencia
    if (!N) return pal[0];
    for (let i = 0; i < cortes.length; i++) if (v <= cortes[i]) return pal[i];
    return pal[pal.length - 1];
  };
  let leyendaCalc = [];
  if (N) {
    leyendaCalc = pal.map((c, i) => ({
      color: c,
      label: i === 0 ? `≤ ${_fmt(cortes[0])}${u}`
           : i === pal.length - 1 ? `> ${_fmt(cortes[cortes.length - 1])}${u}`
           : `${_fmt(cortes[i - 1])} – ${_fmt(cortes[i])}${u}`,
    }));
  }
  leyendaCalc.push({ color: SIN, label: 'Sin datos' });
  return { color, leyenda: leyendaCalc };
}

function renderizarChoroplethNacional(geo, statsData) {
  limpiarCapas();
  const statKey  = STAT_PRINCIPAL[statsData.indicador_id];
  const porDept  = statsData.por_departamento;
  // Se admite el 0: es un valor legitimo (p.ej. 0 ha deforestadas). Antes se filtraba
  // con v > 0 y esos departamentos se pintaban y contaban como "Sin datos".
  const values   = Object.entries(porDept)
    .map(([c, s]) => s[statKey]).filter(v => v != null && !isNaN(v));

  // Coloreado según la leyenda PROPIA del indicador (no una rampa genérica). La leyenda
  // mostrada (colorear.leyenda) siempre coincide con los colores del mapa.
  const colorear = _coloreadorNacional(statsData.leyenda, values, statsData.unidad, statsData.indicador_id);

  const enriched = {
    ...geo,
    features: geo.features.map(f => {
      const code  = f.properties.dept_code;
      const s     = porDept[code] || {};
      const val   = s[statKey];
      return { ...f, properties: { ...f.properties,
        dept_nombre: NOMBRES_DEPTS[code] || code,
        valor: val ?? null,
        _color: colorear.color(val),
        _stats: JSON.stringify(s),
      }};
    })
  };

  mapa.addSource('src-nacional', { type:'geojson', data: enriched, generateId: true, tolerance: 0 });
  mapa.addLayer({ id:'lyr-nacional-fill', type:'fill', source:'src-nacional',
    paint:{ 'fill-color':['get','_color'], 'fill-opacity': 0.8 }});
  mapa.addLayer({ id:'lyr-nacional-borde', type:'line', source:'src-nacional',
    paint:{ 'line-color':'rgba(255,255,255,0.25)', 'line-width': 0.8 }});
  mapa.addLayer({ id:'lyr-nacional-hover', type:'fill', source:'src-nacional',
    paint:{ 'fill-color':'rgba(255,255,255,0.12)', 'fill-opacity':
      ['case',['boolean',['feature-state','hover'],false], 1, 0] }});

  let hoverId = null;
  if (_nacionalPopup) { _nacionalPopup.remove(); setNacionalPopup(null); }
  setNacionalPopup(new maplibregl.Popup({closeButton:true, closeOnClick:true}));
  const _onMoveNac = e => {
    if (e.features.length) {
      if (hoverId !== null) mapa.setFeatureState({source:'src-nacional',id:hoverId},{hover:false});
      hoverId = e.features[0].id;
      mapa.setFeatureState({source:'src-nacional',id:hoverId},{hover:true});
      mapa.getCanvas().style.cursor = 'pointer';
    }
  };
  const _onLeaveNac = () => {
    if (hoverId !== null) mapa.setFeatureState({source:'src-nacional',id:hoverId},{hover:false});
    hoverId = null;
    mapa.getCanvas().style.cursor = '';
  };
  const _onClickNac = e => {
    const p = e.features[0].properties;
    const val = p.valor;
    _nacionalPopup.setLngLat(e.lngLat)
      .setHTML(`<strong class="oot-js-indicadores-11">${escapeHtml(p.dept_nombre || '')}</strong><br>
        <span class="oot-js-indicadores-12">${val != null ? _fmt(val) + ' ' + escapeHtml(String(statsData.unidad||'')) : 'Sin datos'}</span>`)
      .addTo(mapa);
  };
  mapa.on('mousemove','lyr-nacional-fill', _onMoveNac);
  mapa.on('mouseleave','lyr-nacional-fill', _onLeaveNac);
  mapa.on('click','lyr-nacional-fill', _onClickNac);
  _mapHandlers.push({event:'mousemove', layer:'lyr-nacional-fill', fn:_onMoveNac});
  _mapHandlers.push({event:'mouseleave', layer:'lyr-nacional-fill', fn:_onLeaveNac});
  _mapHandlers.push({event:'click', layer:'lyr-nacional-fill', fn:_onClickNac});

  mapa.fitBounds([[-81.7,-4.2],[-66.9,13.4]], {padding:20, duration:800});

  // Panel de estadísticas nacionales
  document.getElementById('map-loading').style.display = 'none';
  document.getElementById('map-error').style.display = 'none';
  document.getElementById('map-hint').style.display = 'none';
  document.getElementById('panel-placeholder').style.display = 'none';
  document.getElementById('panel-contenido').style.display = 'block';

  document.getElementById('vp-asunto').textContent = statsData.asunto;
  document.getElementById('vp-nombre').textContent = statsData.nombre;
  const badge = document.getElementById('vp-badge');
  if (badge) { badge.textContent = 'Nacional'; badge.className = 'px-2 py-0.5 rounded-full text-xs font-bold ml-2 shrink-0 badge-puro'; }

  // Descripción / para qué (consistente con la vista departamental)
  let metaNac = null;
  for (const inds of Object.values(catalogo)) {
    const m = inds.find(i => i.id === (statsData.indicador_id || indicadorActivo));
    if (m) { metaNac = m; break; }
  }
  document.getElementById('vp-descripcion').textContent = metaNac ? (metaNac.descripcion || '') : '';
  const pqWrapNac = document.getElementById('vp-paraque-wrap');
  if (metaNac && metaNac.para_que) {
    document.getElementById('vp-paraque').textContent = metaNac.para_que;
    pqWrapNac.style.display = '';
  } else { pqWrapNac.style.display = 'none'; }
  document.getElementById('vp-fuente').textContent = metaNac ? (metaNac.fuente || '') : '';
  document.getElementById('vp-nivel').textContent = metaNac ? (metaNac.nivel || '') : '';

  const sorted = Object.entries(porDept)
    .map(([c,s]) => ({code:c, val:s[statKey]}))
    .filter(x => x.val != null && !isNaN(x.val))
    .sort((a,b) => b.val - a.val);

  const total = sorted.reduce((s,x)=>s+x.val, 0);
  const cards = document.getElementById('stats-cards');
  if (cards) cards.innerHTML =
    `<div class="stat-card oot-js-indicadores-7">
      <div class="stat-val">${_fmt(Math.round(total))}</div>
      <div class="stat-label">Total nacional (${escapeHtml(String(statsData.unidad || ''))})</div>
    </div>
    <div class="stat-card"><div class="stat-val">${sorted.length}</div><div class="stat-label">Depts con datos</div></div>
    <div class="stat-card"><div class="stat-val">${sorted[0] ? (NOMBRES_DEPTS[sorted[0].code]||sorted[0].code).split(' ')[0] : '—'}</div><div class="stat-label">Mayor valor</div></div>`;

  const detalle = document.getElementById('stats-detalle');
  if (detalle) detalle.innerHTML =
    '<p class="text-xs font-bold uppercase tracking-wider mb-2 oot-js-indicadores-4">Ranking departamentos</p>' +
    sorted.slice(0,10).map((x,i) =>
      `<div class="flex justify-between border-b border-ot-b1 py-1">
        <span class="oot-js-indicadores-3">${i+1}. ${NOMBRES_DEPTS[x.code]||x.code}</span>
        <span class="oot-js-indicadores-13">${_fmt(x.val)} ${escapeHtml(String(statsData.unidad || ''))}</span>
      </div>`
    ).join('');

  document.getElementById('torta-section') && (document.getElementById('torta-section').style.display = 'none');

  renderizarLeyenda(colorear.leyenda);
}
