    async function cargarResumenIndicadores() {
      try {
        const base = window.OOT_API_BASE || '';
        const ctrl = new AbortController();
        setTimeout(() => ctrl.abort(), 8000);
        const r = await fetch(base + '/api/indicadores/resumen', { signal: ctrl.signal });
        if (!r.ok) throw new Error('no-ok');
        const data = await r.json();

        const cobveg = data.cobveg;
        if (cobveg && cobveg.pct_natural != null) {
          document.getElementById('cif-cobveg').textContent = cobveg.pct_natural.toFixed(1) + '%';
        }

        const amenaza = data.amenaza_masa;
        if (amenaza && amenaza.personas_amenazadas != null) {
          const n = amenaza.personas_amenazadas;
          document.getElementById('cif-amenaza').textContent =
            n >= 1000 ? (n / 1000).toFixed(1) + 'K' : n.toLocaleString('es-CO');
        }

        const brecha = data.brecha_expansion;
        if (brecha && brecha.d_fuera_pct != null) {
          document.getElementById('cif-brecha').textContent = brecha.d_fuera_pct.toFixed(1) + '%';
        }

        const deforest = data.deforestacion_pnn;
        if (deforest && deforest.area_deforestada_pnn_ha != null) {
          const ha = deforest.area_deforestada_pnn_ha;
          document.getElementById('cif-deforest').textContent =
            ha >= 1000 ? (ha / 1000).toFixed(1) + 'K ha' : Math.round(ha).toLocaleString('es-CO') + ' ha';
        }
      } catch(e) {
        document.getElementById('cifras-indicadores').style.display = 'none';
      }
    }

    function abrirModalNoticia(src) {
      const modal = document.getElementById('modal-noticia');
      const img = document.getElementById('modal-noticia-img');
      img.src = src;
      modal.style.display = 'flex';
      requestAnimationFrame(() => {
        modal.style.opacity = '1';
        modal.querySelector('div[onclick]').style.transform = 'scale(1)';
      });
      document.body.style.overflow = 'hidden';
    }

    function cerrarModalNoticia() {
      const modal = document.getElementById('modal-noticia');
      modal.style.opacity = '0';
      modal.querySelector('div[onclick]').style.transform = 'scale(0.92)';
      setTimeout(() => {
        modal.style.display = 'none';
        document.getElementById('modal-noticia-img').src = '';
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
