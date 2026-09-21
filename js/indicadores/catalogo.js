import { API, catalogo, escapeHtml, setCatalogo } from './estado.js';

export async function cargarCatalogo() {
  try {
    const r = await fetch(API + '/api/indicadores/catalogo');
    if (!r.ok) throw new Error();
    const d = await r.json();
    setCatalogo(d.asuntos);
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
    html += '<div class="asunto-grupo" data-asunto="' + escapeHtml(asunto) + '">';
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
        html += '<div class="ind-card disabled" id="card-' + escapeHtml(ind.id) + '" data-nombre="' + escapeHtml(String(ind.nombre).toLowerCase()) + '" title="No disponible">';
        html += '<div class="flex items-start justify-between gap-2">';
        html += '<p class="text-xs font-semibold leading-snug flex-1 oot-js-indicadores-4">' + escapeHtml(ind.nombre) + '</p>';
        html += '<span class="px-1.5 py-0.5 rounded text-xs font-bold oot-js-indicadores-5">Pendiente</span>';
        html += '</div>';
        html += '<p class="text-xs mt-1 oot-js-indicadores-4">' + escapeHtml(ind.unidad) + ' · ' + escapeHtml(ind.fuente) + '</p>';
        html += '</div>';
        continue;
      }
      html += '<div class="ind-card" id="card-' + escapeHtml(ind.id) + '" data-oot-click="seleccionarIndicador" data-oot-arg="' + escapeHtml(ind.id) + '" data-nombre="' + escapeHtml(String(ind.nombre).toLowerCase()) + '">';
      html += '<div class="flex items-start justify-between gap-2">';
      html += '<p class="text-xs font-semibold leading-snug flex-1 oot-js-indicadores-6">' + escapeHtml(ind.nombre) + '</p>';
      html += badge;
      html += '</div>';
      if (ind.resumen) html += '<p class="text-xs mt-1 leading-snug oot-js-indicadores-3">' + escapeHtml(ind.resumen) + '</p>';
      html += '<p class="text-xs mt-1 oot-js-indicadores-4">' + escapeHtml(ind.unidad) + ' · ' + escapeHtml(ind.fuente) + '</p>';
      html += '</div>';
    }
    html += '</div></div>';
  }
  document.getElementById('lista-indicadores').innerHTML = html;
}

export function toggleAsunto(slug) {
  const body = document.getElementById('body-' + slug);
  const chev = document.getElementById('chev-' + slug);
  if (!body || !chev) return;
  body.classList.toggle('collapsed');
  chev.classList.toggle('open');
}

export function filtrarIndicadores(texto) {
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
