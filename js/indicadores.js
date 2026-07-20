const API = window.OOT_API_BASE || '';
const escapeHtml = s => (window.OOT && window.OOT.escapeHtml) ? window.OOT.escapeHtml(s) : String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
let mapa = null;
let catalogo = {};
let indicadorActivo = null;
let capasActivas = {};
let datosActuales = null;
let chartInstance = null;
let _chartRafId = null;
let _mapHandlers = []; // {event, layer, fn}
let _nacionalPopup = null;
let deptActivo = '47';

async function cargarCatalogo() {
  try {
    const r = await fetch(API + '/api/indicadores/catalogo');
    if (!r.ok) throw new Error();
    const d = await r.json();
    catalogo = d.asuntos;
    renderizarSidebar(catalogo);
  } catch {
    document.getElementById('lista-indicadores').innerHTML = '<p class="text-xs text-center py-8 oot-js-indicadores-1">Error cargando catálogo.</p>';
  }
}

function renderizarSidebar(asuntos) {
  const iconos = {
    'Áreas protegidas y ecosistemas': 'forest',
    'Gestión del riesgo': 'warning',
    'Soberanía y seguridad alimentaria': 'agriculture',
    'Instrumentos POT': 'gavel',
    'Asentamientos humanos': 'location_city',
  };
  let html = '';
  for (const [asunto, indicadores] of Object.entries(asuntos)) {
    const ico = iconos[asunto] || 'analytics';
    const slug = asunto.replace(/\s+/g, '_');
    html += '<div class="asunto-grupo" data-asunto="' + asunto + '">';
    html += '<div class="asunto-header" data-oot-click="toggleAsunto" data-oot-arg="' + slug + '">';
    html += '<div class="flex items-center gap-2">';
    html += '<span class="material-symbols-outlined text-base oot-js-indicadores-2">' + ico + '</span>';
    html += '<span class="asunto-title text-xs font-bold uppercase tracking-wider oot-js-indicadores-3">' + escapeHtml(asunto) + '</span>';
    html += '</div>';
    html += '<span class="asunto-chevron open material-symbols-outlined text-sm oot-js-indicadores-4" id="chev-' + slug + '">expand_more</span>';
    html += '</div>';
    html += '<div class="asunto-body space-y-2 pb-2" id="body-' + slug + '">';
    for (const ind of indicadores) {
      const badge = ind.tipo === 'Compuesto'
        ? '<span class="badge-compuesto px-1.5 py-0.5 rounded text-xs font-bold">Compuesto</span>'
        : '<span class="badge-puro px-1.5 py-0.5 rounded text-xs font-bold">Puro</span>';
      if (!ind.disponible) {
        html += '<div class="ind-card disabled" id="card-' + ind.id + '" data-nombre="' + ind.nombre.toLowerCase() + '" title="No disponible">';
        html += '<div class="flex items-start justify-between gap-2">';
        html += '<p class="text-xs font-semibold leading-snug flex-1 oot-js-indicadores-4">' + escapeHtml(ind.nombre) + '</p>';
        html += '<span class="px-1.5 py-0.5 rounded text-xs font-bold oot-js-indicadores-5">Pendiente</span>';
        html += '</div>';
        html += '<p class="text-xs mt-1 oot-js-indicadores-4">' + ind.unidad + ' · ' + ind.fuente + '</p>';
        html += '</div>';
        continue;
      }
      html += '<div class="ind-card" id="card-' + ind.id + '" data-oot-click="seleccionarIndicador" data-oot-arg="' + ind.id + '" data-nombre="' + ind.nombre.toLowerCase() + '">';
      html += '<div class="flex items-start justify-between gap-2">';
      html += '<p class="text-xs font-semibold leading-snug flex-1 oot-js-indicadores-6">' + escapeHtml(ind.nombre) + '</p>';
      html += badge;
      html += '</div>';
      if (ind.resumen) html += '<p class="text-xs mt-1 leading-snug oot-js-indicadores-3">' + ind.resumen + '</p>';
      html += '<p class="text-xs mt-1 oot-js-indicadores-4">' + ind.unidad + ' · ' + ind.fuente + '</p>';
      html += '</div>';
    }
    html += '</div></div>';
  }
  document.getElementById('lista-indicadores').innerHTML = html;
}

function toggleAsunto(slug) {
  const body = document.getElementById('body-' + slug);
  const chev = document.getElementById('chev-' + slug);
  body.classList.toggle('collapsed');
  chev.classList.toggle('open');
}

function filtrarIndicadores(texto) {
  const q = texto.toLowerCase();
  document.querySelectorAll('.ind-card').forEach(card => {
    const nombre = card.dataset.nombre || '';
    card.style.display = nombre.includes(q) ? '' : 'none';
  });
  document.querySelectorAll('.asunto-grupo').forEach(grupo => {
    const visibles = [...grupo.querySelectorAll('.ind-card')].some(c => c.style.display !== 'none');
    grupo.style.display = visibles ? '' : 'none';
  });
}

let _fetchToken = 0;

let escalaActiva = 'nacional';

function cambiarEscala(escala) {
  escalaActiva = escala;
  if (escala !== 'municipal') actualizarBordeMunicipio(null);  // ocultar borde muni fuera de escala municipal
  document.querySelectorAll('.scale-btn').forEach(b => {
    const active = b.dataset.scale === escala;
    b.style.background = active ? 'var(--oot-azul)' : 'transparent';
    b.style.color = active ? '#fff' : 'var(--oot-tx2)';
  });
  const deptSec = document.getElementById('dept-filter-section');
  const muniSec = document.getElementById('municipio-filter-section');
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

function actualizarScopeLabel() {
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

const STAT_PRINCIPAL = {
  'cobveg':                'pct_natural',
  'amenaza_masa':          'total_personas',
  'amenaza_inundacion':    'total_personas',
  'priorizacion_agro':     'total_ha',
  'brecha_expansion':      'd_fuera_pct',
  'brecha_subutilizacion': 'd_dentro_pct',
  'deforestacion_pnn':     'area_pnn_terrestre_ha',
  'tensiones_territoriales':'total_conflictos',
};

async function seleccionarNacional(id) {
  indicadorActivo = id;
  mostrarCargando(id);
  const myToken = ++_fetchToken;
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

// Construye el coloreador del choropleth NACIONAL a partir de la leyenda PROPIA del
// indicador, para que cada uno use SUS colores (no una rampa verde genérica) y la leyenda
// mostrada coincida exactamente con el mapa.
//  · Leyenda de RANGOS de valor (todas las etiquetas traen número, p.ej. cobveg
//    "0–20%"…"80–100%") → step por umbral con los colores de la leyenda (esquema exacto).
//  · Leyenda CATEGÓRICA (amenaza/tensiones/brecha…) → rampa por cuantil usando la PALETA
//    del indicador, con leyenda de rangos calculados a partir de los datos.
// Rampas secuenciales TEMÁTICAS (claro→oscuro = menos→más) para el choropleth NACIONAL
// de indicadores con leyenda CATEGÓRICA. Las paletas categóricas (Alta/Media/Baja,
// Agrícola/Ganadera/…) son cualitativas y no comunican magnitud; aquí cada indicador usa
// un tono acorde a su tema. Los de RANGO de valor (cobveg) conservan su escala exacta.
const RAMPAS_NACIONAL = {
  amenaza_masa:             ['#feedde', '#fdbe85', '#fd8d3c', '#e6550d', '#a63603'], // naranjas (movimientos en masa)
  amenaza_inundacion:       ['#eff3ff', '#bdd7e7', '#6baed6', '#3182bd', '#08519c'], // azules (inundación)
  priorizacion_agro:        ['#edf8e9', '#bae4b3', '#74c476', '#31a354', '#006d2c'], // verdes (agropecuario)
  tensiones_territoriales:  ['#fee5d9', '#fcae91', '#fb6a4a', '#de2d26', '#a50f15'], // rojos (conflictos)
  brecha_expansion:         ['#f2f0f7', '#cbc9e2', '#9e9ac8', '#756bb1', '#54278f'], // morados (urbano-catastral)
  brecha_subutilizacion:    ['#edf8fb', '#b3cde3', '#8c96c6', '#8856a7', '#810f7c'], // morado-azul (urbano-catastral)
  deforestacion_pnn:        ['#edf8e9', '#bae4b3', '#74c476', '#31a354', '#006d2c'], // verdes (áreas protegidas)
};
const RAMPA_NACIONAL_DEFECTO = ['#d4ede7', '#7de0c4', '#27a880', '#1a6b55', '#0d3d30']; // teal

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
    if (v == null || isNaN(v) || v <= 0) return SIN;
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
  const values   = Object.entries(porDept)
    .map(([c, s]) => s[statKey]).filter(v => v != null && !isNaN(v) && v > 0);

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
  if (_nacionalPopup) { _nacionalPopup.remove(); _nacionalPopup = null; }
  _nacionalPopup = new maplibregl.Popup({closeButton:true, closeOnClick:true});
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
    .filter(x => x.val != null && !isNaN(x.val) && x.val > 0)
    .sort((a,b) => b.val - a.val);

  const total = sorted.reduce((s,x)=>s+x.val, 0);
  const cards = document.getElementById('stats-cards');
  if (cards) cards.innerHTML =
    `<div class="stat-card oot-js-indicadores-7">
      <div class="stat-val">${_fmt(Math.round(total))}</div>
      <div class="stat-label">Total nacional (${statsData.unidad})</div>
    </div>
    <div class="stat-card"><div class="stat-val">${sorted.length}</div><div class="stat-label">Depts con datos</div></div>
    <div class="stat-card"><div class="stat-val">${sorted[0] ? (NOMBRES_DEPTS[sorted[0].code]||sorted[0].code).split(' ')[0] : '—'}</div><div class="stat-label">Mayor valor</div></div>`;

  const detalle = document.getElementById('stats-detalle');
  if (detalle) detalle.innerHTML =
    '<p class="text-xs font-bold uppercase tracking-wider mb-2 oot-js-indicadores-4">Ranking departamentos</p>' +
    sorted.slice(0,10).map((x,i) =>
      `<div class="flex justify-between border-b border-ot-b1 py-1">
        <span class="oot-js-indicadores-3">${i+1}. ${NOMBRES_DEPTS[x.code]||x.code}</span>
        <span class="oot-js-indicadores-13">${_fmt(x.val)} ${statsData.unidad}</span>
      </div>`
    ).join('');

  document.getElementById('torta-section') && (document.getElementById('torta-section').style.display = 'none');

  renderizarLeyenda(colorear.leyenda);
}

async function seleccionarIndicador(id, municipio) {
  if (window.OOT && OOT.track) OOT.track('indicador_seleccionado', { indicador: id, escala: escalaActiva });
  if (escalaActiva === 'nacional') return seleccionarNacional(id);

  document.querySelectorAll('.ind-card').forEach(c => c.classList.remove('active'));
  const card = document.getElementById('card-' + id);
  if (card) card.classList.add('active');

  indicadorActivo = id;
  mostrarCargando(id);

  // En escala municipal, respetar el municipio ya elegido en el dropdown
  const muniSelect = document.getElementById('municipio-select');
  if (municipio === undefined && escalaActiva === 'municipal' && muniSelect && muniSelect.value) {
    municipio = muniSelect.value;
  }
  if (muniSelect) muniSelect.value = municipio || '';
  if (escalaActiva === 'municipal' && municipio) actualizarBordeMunicipio(municipio, false);

  // Token incremental para descartar respuestas obsoletas
  const myToken = ++_fetchToken;

  // Timeout para cálculo de indicadores. 90s: el cómputo municipal en vivo de
  // amenaza/inundación lee la capa nacional de población y puede rondar ~50-60s.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90000);

  try {
    const body = {indicador_id: id, dept_code: deptActivo};
    if (municipio) body.municipio = municipio;
    const r = await fetch(API + '/api/indicadores/calcular', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      signal: ctrl.signal,
      body: JSON.stringify(body)
    });
    clearTimeout(timer);
    if (myToken !== _fetchToken) { window.OOT.log('[INDICADORES] Respuesta obsoleta descartada'); return; }
    if (!r.ok) {
      const err = await r.json();
      throw new Error(err.detail || 'Error desconocido');
    }
    const data = await r.json();
    if (myToken !== _fetchToken) return;
    if (window.OOT_DEBUG) window.OOT.log('Datos recibidos:', data);
    if (data.error === 'capa_no_disponible') {
      mostrarError(data.mensaje || 'Capa requerida no disponible en la GDB.');
      return;
    }
    mostrarResultado(data);
  } catch (e) {
    clearTimeout(timer);
    if (myToken !== _fetchToken) return;
    var msg = e.name === 'AbortError' 
      ? 'El cálculo tardó demasiado. Intente más tarde.' 
      : e.message;
    console.error('Error:', e);
    mostrarError(msg);
  }
}

function mostrarInicial() {
  document.getElementById('panel-placeholder').style.display = 'flex';
  document.getElementById('panel-contenido').style.display = 'none';
  document.getElementById('map-loading').style.display = 'none';
  document.getElementById('map-error').style.display = 'none';
  document.getElementById('map-hint').style.display = 'block';
  limpiarCapas();  // ya destruye chartInstance y cancela _chartRafId
  document.querySelectorAll('.ind-card').forEach(c => c.classList.remove('active'));
  indicadorActivo = null;
  datosActuales = null;
  var _ctrl = document.getElementById('mapa-controles');
  if (_ctrl) _ctrl.innerHTML = '';
  const muniSelect = document.getElementById('municipio-select');
  if (muniSelect) muniSelect.value = '';
}

function mostrarCargando(id) {
  document.getElementById('panel-placeholder').style.display = 'none';
  document.getElementById('panel-contenido').style.display = 'none';
  document.getElementById('map-loading').style.display = 'flex';
  document.getElementById('map-error').style.display = 'none';
  document.getElementById('map-hint').style.display = 'none';
  for (const inds of Object.values(catalogo)) {
    const ind = inds.find(i => i.id === id);
    if (ind) {
      document.getElementById('map-loading-titulo').textContent = 'Calculando: ' + ind.nombre;
      break;
    }
  }
}

function mostrarError(msg) {
  document.getElementById('map-loading').style.display = 'none';
  document.getElementById('map-error').style.display = 'flex';
  document.getElementById('map-error-msg').textContent = msg;
  document.getElementById('panel-placeholder').style.display = 'flex';
  document.getElementById('panel-contenido').style.display = 'none';
}

function mostrarResultado(data) {
  datosActuales = data;
  document.getElementById('map-loading').style.display = 'none';
  document.getElementById('map-error').style.display = 'none';
  document.getElementById('map-hint').style.display = 'none';
  abrirVisor(data);
}

function abrirVisor(data) {
  document.getElementById('panel-placeholder').style.display = 'none';
  document.getElementById('panel-contenido').style.display = 'block';

  document.getElementById('vp-asunto').textContent = data.asunto;
  document.getElementById('vp-nombre').textContent = data.nombre;
  const badge = document.getElementById('vp-badge');
  badge.textContent = data.tipo === 'Simple' ? 'Puro' : data.tipo;
  badge.className = 'px-2 py-0.5 rounded-full text-xs font-bold ml-2 shrink-0 ' + (data.tipo === 'Compuesto' ? 'badge-compuesto' : 'badge-puro');

  let meta = null;
  for (const inds of Object.values(catalogo)) {
    const ind = inds.find(i => i.id === data.indicador_id);
    if (ind) { meta = ind; break; }
  }
  if (meta) {
    document.getElementById('vp-descripcion').textContent = meta.descripcion || '';
    const pqWrap = document.getElementById('vp-paraque-wrap');
    if (meta.para_que) {
      document.getElementById('vp-paraque').textContent = meta.para_que;
      pqWrap.style.display = '';
    } else {
      pqWrap.style.display = 'none';
    }
    document.getElementById('vp-fuente').textContent = meta.fuente || '';
    document.getElementById('vp-nivel').textContent = meta.nivel || '';
  }

  renderizarLeyenda(data.leyenda);
  renderizarStats(data.stats, data.unidad, data.indicador_id, data.leyenda);
  actualizarListaMunicipios();

  if (mapa.isStyleLoaded()) {
    cargarCapasEnMapa(data);
  } else {
    mapa.once('load', () => cargarCapasEnMapa(data));
  }
}

function cerrarVisor() {
  limpiarCapas();
  var _ctrl = document.getElementById('mapa-controles');
  if (_ctrl) _ctrl.innerHTML = '';
  document.getElementById('panel-placeholder').style.display = 'flex';
  document.getElementById('panel-contenido').style.display = 'none';
  document.getElementById('map-hint').style.display = 'block';
}

function inicializarMapa() {
  if (window.OOT_DEBUG) window.OOT.log('Inicializando mapa...');
  // Protocolo PMTiles (vector tiles de los indicadores de polígonos), registrado 1 sola vez.
  if (window.pmtiles && !window._pmtilesReg) {
    maplibregl.addProtocol('pmtiles', new pmtiles.Protocol().tile);
    window._pmtilesReg = true;
  }
  mapa = new maplibregl.Map({
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
  });
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
  });
}

function actualizarBordeMunicipio(code, zoomAlMuni) {
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

function actualizarBordeDept(code, zoomAlDept) {
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

function _colorPorCategoria(leyenda) {
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

// Indicadores cuya geometría se sirve por VECTOR TILES (PMTiles, resolución completa)
// en vez del GeoJSON del cache. Ver scripts/generar_tiles_src.py + generar_pmtiles.py.
const INDICADORES_PMTILES = new Set(['amenaza_masa', 'amenaza_inundacion', 'priorizacion_agro', 'tensiones_territoriales']);
// Estos se sirven POR DEPARTAMENTO (un .pmtiles por dept: <id>_<dep>.pmtiles) por ser
// demasiado grandes como archivo único. El resto usa un solo <id>.pmtiles.
// tensiones: 548k features → per-dept obligatorio.
const INDICADORES_PMTILES_POR_DEPT = new Set(['amenaza_masa', 'tensiones_territoriales']);

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

function cargarCapasEnMapa(data) {
  if (window.OOT_DEBUG) window.OOT.log('Cargando capas en mapa...', data.layers);

  limpiarCapas();
  capasActivas = {};
  var _ctrl2 = document.getElementById('mapa-controles');
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
        'tdeterm': 'Categoría',
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

function _limpiarMapHandlers() {
  if (!mapa) return;
  _mapHandlers.forEach(h => {
    try { mapa.off(h.event, h.layer, h.fn); } catch (e) {}
  });
  _mapHandlers = [];
}

function limpiarCapas() {
  if (!mapa) return;
  _limpiarMapHandlers();
  _limpiarHighlight();
  if (_nacionalPopup) { _nacionalPopup.remove(); _nacionalPopup = null; }
  if (_chartRafId) { cancelAnimationFrame(_chartRafId); _chartRafId = null; }
  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
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

function agregarToggleCapa(nombre, color, layerId) {
  const cont = document.getElementById('mapa-controles');
  if (!cont) return;
  const btn = document.createElement('button');
  btn.className = 'capa-btn activa';
  btn.style.setProperty('--color', color);
  btn.dataset.layer = layerId;
  btn.innerHTML = '<span class="capa-dot"></span> ' + nombre.replace(/_/g, ' ');
  btn.onclick = () => toggleCapa(btn, layerId, color);
  cont.appendChild(btn);
}

function toggleCapa(btn, layerId, color) {
  const fills = [layerId + '-fill', layerId, layerId + '-line'];
  const activa = btn.classList.contains('activa');
  fills.forEach(id => {
    if (mapa.getLayer(id)) mapa.setLayoutProperty(id, 'visibility', activa ? 'none' : 'visible');
  });
  btn.classList.toggle('activa', !activa);
}

function renderizarLeyenda(leyenda) {
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

function renderizarStats(stats, unidad, id, leyenda) {
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
    cardHtml = entries.map(([k, v]) => '<div class="stat-card"><div class="stat-val">' + _fmt(v) + '</div><div class="stat-label">' + k.replace(/_/g, ' ') + '</div></div>').join('');
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

const PALETA_CHART = ['#0891b2','#0e7490','#06b6d4','#22d3ee','#67e8f9','#155e75','#164e63','#a5f3fc'];
const INDICADORES_CON_CLICK = new Set(['cobveg','amenaza_masa','amenaza_inundacion','priorizacion_agro','deforestacion_pnn']);

function renderizarTorta(stats, id, leyenda) {
  const section = document.getElementById('torta-section');
  // Cancelar rAF pendiente antes de destruir el chart (evita race condition)
  if (_chartRafId) { cancelAnimationFrame(_chartRafId); _chartRafId = null; }
  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }

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
  _chartRafId = requestAnimationFrame(() => {
    _chartRafId = null;
    const ctx = document.getElementById('grafico-torta').getContext('2d');
    chartInstance = new Chart(ctx, {
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
          const unidad = (id === 'amenaza_masa' || id === 'amenaza_inundacion') ? 'personas' : 'Ha';
          return ' ' + ctx.label + ': ' + ctx.parsed.toLocaleString('es-CO') + ' ' + unidad + ' (' + pct + '%)';
        }}} }
      }
    });
    document.getElementById('grafico-torta').style.cursor = tieneClick ? 'pointer' : 'default';
    section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
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

function _limpiarHighlight() {
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
      .setHTML('<div class="oot-js-indicadores-15">' + escapeHtml(feature.properties.ap_nombre || '') + '</div><div class="oot-js-indicadores-18"><span class="oot-js-indicadores-17">Deforestación:</span> ' + ha.toLocaleString('es-CO') + ' Ha</div>')
      .addTo(mapa);
  }
  setTimeout(_limpiarHighlight, 6000);
}

const _municipiosCache = {};

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
async function actualizarListaMunicipios() {
  const section = document.getElementById('municipio-filter-section');
  const select = document.getElementById('municipio-select');
  if (!section || !select) return;
  if (escalaActiva !== 'municipal') { section.style.display = 'none'; return; }
  const municipios = await cargarMunicipios(deptActivo);
  if (!municipios.length) { section.style.display = 'none'; return; }
  const valorActual = select.value;
  select.innerHTML = '<option value="">Todos los municipios</option>' +
    municipios.map(m => `<option value="${m.codigo}"${m.codigo === valorActual ? ' selected' : ''}>${m.nombre}</option>`).join('');
  section.style.display = '';
}

async function filtrarPorMunicipio(codigoMunicipio) {
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

const NOMBRES_DEPTS = {
  '05':'Antioquia','08':'Atlántico','11':'Bogotá D.C.','13':'Bolívar','15':'Boyacá',
  '17':'Caldas','18':'Caquetá','19':'Cauca','20':'Cesar','23':'Córdoba','25':'Cundinamarca',
  '27':'Chocó','41':'Huila','44':'La Guajira','47':'Magdalena','50':'Meta','52':'Nariño',
  '54':'Norte de Santander','63':'Quindío','66':'Risaralda','68':'Santander','70':'Sucre',
  '73':'Tolima','76':'Valle del Cauca','81':'Arauca','85':'Casanare','86':'Putumayo',
  '88':'San Andrés','91':'Amazonas','94':'Guainía','95':'Guaviare','97':'Vaupés','99':'Vichada'
};

async function cargarDepartamentos() {
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
      `<option value="${code}"${code === deptActivo ? ' selected' : ''}>${NOMBRES_DEPTS[code] || code}</option>`
    ).join('');
    // En nacional la sección de dept va oculta (la controla cambiarEscala)
    section.style.display = (escalaActiva === 'nacional') ? 'none' : '';
  } catch(e) { console.warn('No se pudieron cargar departamentos:', e); }
}

function cambiarDepartamento(code) {
  deptActivo = code || '47';
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

function _fmt(n) {
  if (n === null || n === undefined) return '—';
  if (typeof n === 'number') return n.toLocaleString('es-CO');
  return n;
}

// Ejecutar después de que el DOM esté listo
window.addEventListener('DOMContentLoaded', function() {
  inicializarMapa();
  cargarDepartamentos();
  actualizarScopeLabel();
  cargarCatalogo().then(() => {
    const params = new URLSearchParams(window.location.search);
    const urlDept = params.get('dept');
    const urlId = params.get('indicador');
    if (urlDept) {
      // Si viene un dept en la URL, abrir en escala departamental
      deptActivo = urlDept;
      const s = document.getElementById('dept-select');
      if (s) s.value = urlDept;
      cambiarEscala('departamental');
    } else {
      cambiarEscala('nacional');  // default: Colombia
    }
    if (urlId) seleccionarIndicador(urlId);
  });
});

window.OOT.loadShell();

// ── Mobile tab bar ──────────────────────────────────────────────────────────
(function() {
  const bar = document.createElement('div');
  bar.className = 'mob-tabs-ind';
  bar.innerHTML =
    '<button class="mob-tab-ind" id="mob-ind-indic" data-oot-click="_mobIndTab" data-oot-arg="indic">' +
      '<span class="material-symbols-outlined">bar_chart</span>Indicadores</button>' +
    '<button class="mob-tab-ind active" id="mob-ind-mapa" data-oot-click="_mobIndTab" data-oot-arg="mapa">' +
      '<span class="material-symbols-outlined">map</span>Mapa</button>' +
    '<button class="mob-tab-ind" id="mob-ind-stats" data-oot-click="_mobIndTab" data-oot-arg="stats">' +
      '<span class="material-symbols-outlined">analytics</span>Estadísticas</button>';
  document.body.appendChild(bar);
})();

function _mobIndCerrar() {
  ['ind-aside','ind-stats'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('mob-visible');
  });
  const bd = document.getElementById('mob-backdrop-ind');
  if (bd) bd.style.display = 'none';
  ['mob-ind-indic','mob-ind-mapa','mob-ind-stats'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
  });
  const mapaTab = document.getElementById('mob-ind-mapa');
  if (mapaTab) mapaTab.classList.add('active');
}

function _mobIndTab(tab) {
  if (window.innerWidth > 900) return;
  _mobIndCerrar();
  const tabEl = document.getElementById('mob-ind-' + tab);
  if (tabEl) tabEl.classList.add('active');
  const bd = document.getElementById('mob-backdrop-ind');
  if (tab === 'indic') {
    const el = document.getElementById('ind-aside');
    if (el) el.classList.add('mob-visible');
    if (bd) bd.style.display = 'block';
  } else if (tab === 'stats') {
    const el = document.getElementById('ind-stats');
    if (el) el.classList.add('mob-visible');
    if (bd) bd.style.display = 'block';
  }
}
