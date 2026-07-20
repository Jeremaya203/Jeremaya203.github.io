    'use strict';
    const API = window.OOT_API_BASE || '';

    const TIPO_RECURSO  = 'Cartillas, guias y manuales';
    const PAGINA_TITULO = 'Cartillas, Guías y Manuales';
    const PAGINA_DESC   = 'Material de divulgación y guías metodológicas para el OT.';
    const PAGINA_ICONO  = 'fa-book';

    let offset = 0;
    const POR_PAGINA = 12;
    let total = 0;

    window.addEventListener('DOMContentLoaded', async () => {
      document.getElementById('bc-nombre').textContent    = PAGINA_TITULO;
      document.getElementById('banner-titulo').innerHTML  = `<i class="fas ${PAGINA_ICONO} mr-2"></i>${PAGINA_TITULO}`;
      document.getElementById('banner-desc').textContent  = PAGINA_DESC;
      await cargarFiltros();
      await buscar(0);
    });

    async function cargarFiltros() {
      try {
        const [config, filtros] = await Promise.all([
          fetch(API + '/api/igac/config').then(r => r.json()),
          fetch(API + '/api/igac/documentos/filtros').then(r => r.json())
        ]);

        const annios = filtros?.annio?.FECHA || [];
        const selA = document.getElementById('filtro-annio');
        annios.forEach(a => {
          const o = document.createElement('option');
          o.value = a.id || a; o.textContent = a.text || a;
          selA.appendChild(o);
        });

        (config.DIMENSION || []).forEach(d => {
          const o = document.createElement('option');
          o.value = d.id; o.textContent = d.text;
          document.getElementById('filtro-dimension').appendChild(o);
        });

        (config.COMPONENTE || []).forEach(c => {
          const o = document.createElement('option');
          o.value = c.id; o.textContent = c.text;
          document.getElementById('filtro-componente').appendChild(o);
        });
      } catch(e) {
        console.warn('No se pudieron cargar los filtros:', e);
        if (window.OOT && OOT.notify) OOT.notify('No se pudieron cargar los filtros de búsqueda. Verifique su conexión.', 'warn');
      }
    }

    async function buscar(off = 0) {
      document.getElementById('estado-carga').style.display = 'block';
      document.getElementById('contenedor-recursos').innerHTML = '';
      document.getElementById('paginacion').style.display = 'none';

      const params = new URLSearchParams({
        start:  off,
        length: POR_PAGINA,
        search: document.getElementById('input-busqueda').value.trim(),
        tipo:   TIPO_RECURSO,
      });
      const dim  = document.getElementById('filtro-dimension').value;
      const comp = document.getElementById('filtro-componente').value;
      const ann  = document.getElementById('filtro-annio').value;
      if (dim)  params.append('dimension', dim);
      if (comp) params.append('componente', comp);
      if (ann)  params.append('annio', ann);

      try {
        const data = await fetch(`${API}/api/igac/recursos?${params}`).then(r => r.json());
        total  = data.recordsFiltered || data.recordsTotal || 0;
        offset = off;
        renderItems(data.data || []);
      } catch(e) {
        document.getElementById('contenedor-recursos').innerHTML = `
          <div class="alert alert-warning">
            <i class="fas fa-exclamation-triangle mr-2"></i>
            No se pudo conectar con el servicio del IGAC.
            <a href="https://www.colombiaot.gov.co" target="_blank" class="alert-link ml-2">
              Consultar en Colombia OT <i class="fas fa-external-link-alt"></i>
            </a>
          </div>`;
      } finally {
        document.getElementById('estado-carga').style.display = 'none';
      }
    }

    function renderItems(items) {
      const cont = document.getElementById('contenedor-recursos');
      if (!items.length) {
        cont.innerHTML = '<p class="text-center text-muted py-4">No se encontraron resultados.</p>';
        return;
      }
      const esc = s => window.OOT?.escapeHtml ? window.OOT.escapeHtml(s) : String(s)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;').replace(/'/g,'&#039;');

      const grid = document.createElement('div');
      grid.className = 'row';
      items.forEach(item => {
        const titulo = item.NOMBRE      || item.nombre      || 'Sin título';
        const desc   = item.DESCRIPCION || item.descripcion || '';
        const tipo   = item.TIPO_RECURSO|| item.tipo        || '';
        const fecha  = (item.FECHA_PUBLICACION || '').toString().match(/\d{4}/)?.[0] || '';
        const ent    = item.ENTIDAD     || '';
        const url    = item.URL1        || item.URL_METADATO|| item.url || '';

        const col = document.createElement('div');
        col.className = 'col-md-6 col-lg-4 mb-4';
        col.innerHTML = `
          <div class="card h-100">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-start mb-2">
                <span class="badge badge-primary small">${esc(tipo)}</span>
                <span class="text-muted small">${esc(fecha)}</span>
              </div>
              <h6 class="card-title">${esc(titulo)}</h6>
              <p class="card-text small text-muted">${esc(desc.replace(/<[^>]*>/g,'').substring(0,120))}${desc.length>120?'…':''}</p>
              ${ent ? `<p class="small text-muted mb-0"><i class="fas fa-building mr-1"></i>${esc(ent)}</p>` : ''}
            </div>
            ${url ? `<div class="card-footer bg-transparent border-top-0">
              <a href="${esc(url)}" target="_blank" rel="noopener" class="btn btn-sm btn-outline-primary">
                <i class="fas fa-external-link-alt mr-1"></i>Ver recurso
              </a>
            </div>` : ''}
          </div>`;
        grid.appendChild(col);
      });
      cont.appendChild(grid);

      const totalPags = Math.ceil(total / POR_PAGINA);
      const paginaNum = Math.floor(offset / POR_PAGINA);
      document.getElementById('info-pagina').textContent =
        `${offset + 1}–${Math.min(offset + POR_PAGINA, total)} de ${total}`;
      document.getElementById('btn-anterior').disabled = paginaNum === 0;
      document.getElementById('btn-siguiente').disabled = paginaNum >= totalPags - 1;
      document.getElementById('paginacion').style.display = 'flex';
    }

    document.getElementById('btn-buscar').addEventListener('click', () => buscar(0));
    document.getElementById('input-busqueda').addEventListener('keydown', e => { if(e.key==='Enter') buscar(0); });
    document.getElementById('filtro-annio').addEventListener('change', () => buscar(0));
    document.getElementById('filtro-dimension').addEventListener('change', () => buscar(0));
    document.getElementById('filtro-componente').addEventListener('change', () => buscar(0));
    document.getElementById('btn-anterior').addEventListener('click', () => buscar(offset - POR_PAGINA));
    document.getElementById('btn-siguiente').addEventListener('click', () => buscar(offset + POR_PAGINA));

    window.OOT.loadShell();
