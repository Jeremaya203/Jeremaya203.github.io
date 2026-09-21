    // NOTA: aqui vivia cargarResumenIndicadores(), que pintaba el bloque "Colombia OT en
    // datos" desde GET /api/indicadores/resumen. Se retiro porque nadie la llamaba y
    // ninguno de los cinco id que usaba (cif-cobveg, cif-amenaza, cif-brecha,
    // cif-deforest, cifras-indicadores) existe en index.html. El endpoint sigue vivo: para
    // recuperar la funcion basta anadir ese bloque a la portada y volver a llamarla desde
    // el DOMContentLoaded de abajo (el codigo esta en el historial de git).

    function abrirModalNoticia(src) {
      const modal = document.getElementById('modal-noticia');
      const img = document.getElementById('modal-noticia-img');
      if (!modal || !img) return;
      img.src = src;
      modal.style.display = 'flex';
      requestAnimationFrame(() => {
        modal.style.opacity = '1';
        const panel = modal.querySelector('.oot-modal-panel');
        if (panel) panel.style.transform = 'scale(1)';
      });
      document.body.style.overflow = 'hidden';
    }

    function cerrarModalNoticia() {
      const modal = document.getElementById('modal-noticia');
      if (!modal) return;
      modal.style.opacity = '0';
      const panel = modal.querySelector('.oot-modal-panel');
      if (panel) panel.style.transform = 'scale(0.92)';
      // El restablecimiento va SIEMPRE, no puede depender de nada de arriba.
      setTimeout(() => {
        modal.style.display = 'none';
        const img = document.getElementById('modal-noticia-img');
        if (img) img.src = '';
        document.body.style.overflow = '';
      }, 300);
    }

    // ── Animación de conteo ascendente en las cifras de "Colombia OT en datos" ──
    function animarContador(el) {
      const raw = (el.dataset.valor || el.textContent).trim();
      el.dataset.valor = raw;                          // guarda el valor original
      const target = parseInt(raw.replace(/\D/g, ''), 10);   // "1.103"->1103, "4+"->4
      const suffix = raw.replace(/[\d.\s]/g, '');            // "4+"->"+", "1.103"->""
      if (!target) return;
      const duracion = 900;                            // rápida
      const inicio = performance.now();
      function frame(now) {
        const p = Math.min((now - inicio) / duracion, 1);
        const eased = 1 - Math.pow(1 - p, 3);          // ease-out
        const val = Math.round(eased * target);
        el.textContent = val.toLocaleString('es-CO') + suffix;
        if (p < 1) requestAnimationFrame(frame);
        else el.textContent = target.toLocaleString('es-CO') + suffix;
      }
      requestAnimationFrame(frame);
    }
    function initContadores() {
      const nums = document.querySelectorAll('.oot-statcard-num');
      nums.forEach(el => { el.dataset.valor = el.textContent.trim(); el.textContent = '0'; });
      const obs = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) { animarContador(entry.target); observer.unobserve(entry.target); }
        });
      }, { threshold: 0.4 });
      nums.forEach(el => obs.observe(el));
    }

    // DOMContentLoaded (no window.onload): inicializa el carrusel apenas el DOM está
    // listo, sin esperar a que carguen las imágenes pesadas → evita el FOUC/distorsión.
    document.addEventListener('DOMContentLoaded', function() {
      window.OOT.loadShell();
      initContadores();
      new Swiper('.oot-modulos-swiper', {
        slidesPerView: 1,
        spaceBetween: 20,
        loop: false,
        pagination: { el: '.swiper-pagination', clickable: true },
        navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
        breakpoints: {
          576: { slidesPerView: 2 },
          768: { slidesPerView: 3 },
          1200: { slidesPerView: 4 },
        }
      });
    });

/* ── Registro de manejadores (ver oot.js) ─────────────────────────────────────
   Los data-oot-click del HTML se resuelven contra este registro. Mientras exista el
   respaldo por `window` esto es redundante, pero es lo que permite que estas funciones
   dejen de ser globales sin que los botones se queden mudos. */
(function registrarHandlers() {
  const mapa = {
    abrirModalNoticia,
    cerrarModalNoticia,
  };
  const registrar = () => {
    if (!(window.OOT && window.OOT.registrarTodos)) return false;
    window.OOT.registrarTodos(mapa);
    return true;
  };
  // oot.js se carga antes que este archivo en todas las paginas; el listener es la red
  // por si alguna pagina futura invierte el orden.
  if (!registrar()) document.addEventListener('DOMContentLoaded', registrar);
})();
