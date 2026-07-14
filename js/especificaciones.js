    'use strict';
    const API = window.OOT_API_BASE || '';
    let todosArchivos = [];
    let categoriaActiva = '';

    const iconos = {
      '.pdf': { clase: 'icono-pdf', icon: 'fa-file-pdf' },
      '.zip': { clase: 'icono-zip', icon: 'fa-file-archive' },
    };

    const coloresCat = {
      'Guía técnica':          'primary',
      'Especificación técnica': 'info',
      'Normatividad':           'danger',
      'Datos técnicos':         'warning',
      'Anexo técnico':          'secondary',
    };

    window.addEventListener('DOMContentLoaded', async () => {
      try {
        const data = await fetch(API + '/api/ladm/archivos').then(r => r.json());
        todosArchivos = data.archivos || [];
        renderArchivos(todosArchivos);
      } catch(e) {
        document.getElementById('estado-carga').innerHTML =
          '<p class="text-danger"><i class="fas fa-exclamation-triangle mr-2"></i>No se pudieron cargar los archivos.</p>';
      }
    });

    function renderArchivos(archivos) {
      const estado = document.getElementById('estado-carga');
      const grid   = document.getElementById('grid-archivos');
      estado.style.display = 'none';
      grid.style.display   = 'flex';
      grid.innerHTML = '';

      if (!archivos.length) {
        grid.innerHTML = '<p class="text-muted col-12 text-center py-4">No hay archivos en esta categoría.</p>';
        return;
      }

      const esc = s => window.OOT?.escapeHtml ? window.OOT.escapeHtml(s) : String(s)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;').replace(/'/g,'&#039;');

      archivos.forEach(a => {
        const icono = iconos[a.extension] || { clase: 'icono-zip', icon: 'fa-file' };
        const color = coloresCat[a.categoria] || 'secondary';
        const col = document.createElement('div');
        col.className = 'col-md-6 col-lg-4 mb-4';
        col.innerHTML = `
          <div class="card card-archivo h-100">
            <div class="card-body">
              <div class="d-flex align-items-start mb-3">
                <div class="icono-tipo ${esc(icono.clase)} mr-3">
                  <i class="fas ${esc(icono.icon)}"></i>
                </div>
                <div>
                  <span class="badge badge-${color} badge-categoria">${esc(a.categoria)}</span>
                  <span class="tamano ml-2">${a.tamano_mb} MB</span>
                </div>
              </div>
              <h6 class="card-title">${esc(a.titulo)}</h6>
              <p class="card-text small text-muted">${esc(a.descripcion)}</p>
            </div>
            <div class="card-footer bg-transparent border-top-0 pt-0">
              <a href="${API}/api/ladm/descargar/${esc(a.nombre)}"
                 class="btn btn-sm btn-primary" download>
                <i class="fas fa-download mr-1"></i>Descargar
              </a>
              <span class="text-muted small ml-2">${esc(a.fecha)}</span>
            </div>
          </div>`;
        grid.appendChild(col);
      });
    }

    // Filtros por categoría
    document.querySelectorAll('.filtro-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        categoriaActiva = this.dataset.cat;
        const filtrados = categoriaActiva
          ? todosArchivos.filter(a => a.categoria === categoriaActiva)
          : todosArchivos;
        renderArchivos(filtrados);
      });
    });

    window.OOT.loadShell();
