/* ══════════════════════════════════════════════════════════════════════════
   main.js — Caracterizaciones Territoriales IGAC
   ══════════════════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {

  /* ── 1. Images ─────────────────────────────────────────────────────────── */
  const PLACEHOLDER_LOGO = '';
  const PLACEHOLDER_LOGO_FULL = '';

  injectImage('logo-govco', () => window.__IMG_LOGO_SMALL, PLACEHOLDER_LOGO, 'img');
  injectImage('logo-full',  () => window.__IMG_LOGO_FULL,  PLACEHOLDER_LOGO_FULL, 'img');
  injectImage('img-mapa',   () => window.__IMG_MAPA,      null, 'img');

  /* Inject público objetivo background image */
  const publicoBg = tryGet(() => window.__IMG_PUBLICO_BG);
  if (publicoBg) {
    const publicoSection = document.querySelector('.publico-objetivo');
    if (publicoSection) publicoSection.style.backgroundImage = `url('${publicoBg}')`;
  }

  /* ── 1b. Mobile navbar toggle ─────────────────────────────────────────── */
  const toggleBtn = document.querySelector('.nav-bar-toggle-igac');
  const mobileNav = document.querySelector('.navbarnavigac');
  const linkList = document.getElementById('link-list');
  if (toggleBtn && mobileNav && linkList) {
    toggleBtn.addEventListener('click', () => {
      const expanded = toggleBtn.getAttribute('aria-expanded') === 'true';
      toggleBtn.setAttribute('aria-expanded', String(!expanded));
      if (!expanded) {
        mobileNav.style.display = 'block';
        mobileNav.innerHTML = '';
        linkList.querySelectorAll('a').forEach(a => {
          const clone = a.cloneNode(true);
          clone.style.display = 'block';
          clone.style.padding = '12px 24px';
          clone.style.color = '#2c2c6a';
          clone.style.fontFamily = "'Outfit', sans-serif";
          clone.style.fontWeight = '500';
          clone.style.borderBottom = '1px solid #eee';
          mobileNav.appendChild(clone);
        });
      } else {
        mobileNav.style.display = 'none';
        mobileNav.innerHTML = '';
      }
    });
  }

  /* ── 2. Scroll reveal ────────────────────────────────────────────────── */
  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('in-view');
        revealObserver.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

  /* ── 3. Contenidos slider ────────────────────────────────────────────── */
  const track     = document.getElementById('cards-track');
  const prevBtn   = document.getElementById('prev-btn');
  const nextBtn   = document.getElementById('next-btn');
  const dotsWrap  = document.getElementById('contenidos-dots');

  if (track && prevBtn && nextBtn && dotsWrap) {
    const CARDS_PER_PAGE = 3;
    const cards = Array.from(track.querySelectorAll('.contenido-card'));
    const totalPages = Math.ceil(cards.length / CARDS_PER_PAGE);
    let currentPage  = 0;

    const dots = Array.from({ length: totalPages }, (_, i) => {
      const btn = document.createElement('button');
      btn.className = 'dot' + (i === 0 ? ' dot--active' : '');
      btn.setAttribute('aria-label', `Página ${i + 1}`);
      btn.setAttribute('role', 'listitem');
      btn.addEventListener('click', () => goToPage(i));
      dotsWrap.appendChild(btn);
      return btn;
    });

    function goToPage(page) {
      currentPage = Math.max(0, Math.min(page, totalPages - 1));
      const outer     = track.parentElement;
      const cardWidth = (outer.offsetWidth - 56) / CARDS_PER_PAGE + 28;
      track.style.transform = `translateX(-${currentPage * CARDS_PER_PAGE * cardWidth}px)`;

      dots.forEach((d, i) => d.classList.toggle('dot--active', i === currentPage));
      prevBtn.disabled = currentPage === 0;
      nextBtn.disabled = currentPage === totalPages - 1;
    }

    prevBtn.addEventListener('click', () => goToPage(currentPage - 1));
    nextBtn.addEventListener('click', () => goToPage(currentPage + 1));
    goToPage(0);

    window.addEventListener('resize', () => goToPage(currentPage), { passive: true });
  }

  /* ── 4. Temáticas bubbles — carrusel orbital v5 ──────────────────────── */
  const bubbles = Array.from(document.querySelectorAll('.tematicas__bubble'));

  const topicInfo = {
    limites:        { label: 'Límites Municipales',      desc: 'Estado de los límites municipales, fronteras y delimitaciones territoriales oficiales.',         url: 'https://dev-caracterizaciones.igac.gov.co/biofisico.html?vista=limites' },
    ordenamiento:   { label: 'Ordenamiento Territorial', desc: 'Estado de los POT, PBOT y EOT, normativa de uso del suelo y planificación urbana y rural.',       url: 'https://dev-caracterizaciones.igac.gov.co/biofisico.html?vista=pot' },
    contexto:       { label: 'Contexto Legal',           desc: 'Determinantes y condicionantes legales que definen el adecuado uso del suelo en cada municipio.', url: '#' },
    biofisicos:     { label: 'Procesos Biofísicos',      desc: 'Altitud, pendiente, relieve, clima, ecosistemas, cobertura vegetal y amenazas naturales.',        url: 'https://dev-caracterizaciones.igac.gov.co/biofisico.html' },
    ocupacion:      { label: 'Procesos de Ocupación',    desc: 'Distribución y crecimiento poblacional, tamaño de predios, condiciones de seguridad y acceso a servicios.', url: 'https://dev-caracterizaciones.igac.gov.co/ocupacion.html' },
    socioeconomicos:{ label: 'Procesos Socioeconómicos', desc: 'Actividades económicas, infraestructura, educación, salud y servicios básicos municipales.',     url: 'https://dev-caracterizaciones.igac.gov.co/socieconomico.html' },
  };

  const tematicasSection = document.querySelector('.tematicas');
  const ctmCenter        = document.querySelector('.tematicas__center');

  // SLOT_CLASSES[i] = clase CSS de la posición i (0=top, 1=top-izq, ...)
  const SLOT_CLASSES = [
    'bubble--slot-0', // top (12h) — destacada
    'bubble--slot-1', // top-izq (10h)
    'bubble--slot-2', // top-der (2h)
    'bubble--slot-3', // bot-izq (8h)
    'bubble--slot-4', // bot-der (4h)
    'bubble--slot-5', // abajo (6h)
  ];
  const SLOT_ROT = ['0deg', '255deg', '285deg', '60deg', '240deg', '240deg'];
  const ROTATION_DURATION = 560;
  const MODAL_DELAY       = 620;

  // currentSlots[i] = índice de slot que ocupa el botón i
  let currentSlots = bubbles.map((_, i) => i);
  let selectedBubble = null;
  let isAnimating    = false;

  // ── Modal emergente ─────────────────────────────────────────────────────
  const modal = document.createElement('div');
  modal.className = 'ctm-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.innerHTML = `
    <div class="ctm-modal__card">
      <div class="ctm-modal__accent"></div>
      <button class="ctm-modal__close" aria-label="Cerrar">✕</button>
      <h3 class="ctm-modal__title"></h3>
      <p class="ctm-modal__desc"></p>
      <a class="ctm-modal__cta" href="#">
        Redirigirme a <span class="ctm-modal__cta-name"></span>
      </a>
    </div>
  `;
  document.body.appendChild(modal);

  function openModal(bubble) {
    const topic = bubble.dataset.topic;
    const info  = topicInfo[topic] || {};
    modal.querySelector('.ctm-modal__title').textContent    = info.label || '';
    modal.querySelector('.ctm-modal__desc').textContent     = info.desc  || '';
    modal.querySelector('.ctm-modal__cta-name').textContent = info.label || '';
    modal.querySelector('.ctm-modal__cta').href = info.url || '#';
    const accentMap = {
      limites:        '#8c5a2c',
      socioeconomicos:'#d48f28',
      ordenamiento:   '#7b2fa8',
      ocupacion:      '#1166b1',
      contexto:       '#a32d14',
      biofisicos:     '#2a7a6a',
    };
    const accent = modal.querySelector('.ctm-modal__accent');
    if (accent) accent.style.background = accentMap[topic] || '#2c2c6a';
    modal.classList.add('ctm-modal--visible');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.classList.remove('ctm-modal--visible');
    document.body.style.overflow = '';
    if (selectedBubble) {
      selectedBubble.classList.remove('bubble--selected');
      selectedBubble = null;
    }
  }

  modal.querySelector('.ctm-modal__close').addEventListener('click', closeModal);
  modal.addEventListener('click', e => {
    if (e.target === modal) closeModal();
  });

  // ── Carrusel ────────────────────────────────────────────────────────────
  function getSlot(bubble) {
    return currentSlots[bubbles.indexOf(bubble)];
  }

  function rotateTo(clickedBubble) {
    if (isAnimating) return;

    const S = getSlot(clickedBubble);

    // Ya está en top y seleccionada → cerrar modal
    if (S === 0 && selectedBubble === clickedBubble) {
      closeModal();
      return;
    }

    // Ya está en top pero no estaba seleccionada → solo abrir modal
    if (S === 0) {
      if (selectedBubble) selectedBubble.classList.remove('bubble--selected');
      selectedBubble = clickedBubble;
      clickedBubble.classList.add('bubble--selected');
      openModal(clickedBubble);
      return;
    }

    isAnimating = true;

    // Cerrar modal si estaba abierto antes de rotar
    modal.classList.remove('ctm-modal--visible');
    document.body.style.overflow = '';
    if (selectedBubble) {
      selectedBubble.classList.remove('bubble--selected');
      selectedBubble = null;
    }

    // Calcular nuevos slots: rotar -S pasos para que clickedBubble quede en slot 0
    const newSlots = currentSlots.map(slot => (slot - S + 6) % 6);

    bubbles.forEach((bubble, i) => {
      bubble.classList.remove(SLOT_CLASSES[currentSlots[i]]);
      bubble.classList.add(SLOT_CLASSES[newSlots[i]]);
      bubble.style.transform = `rotate(${SLOT_ROT[newSlots[i]]})`;
      const inner = bubble.querySelector('.bubble__inner');
      if (inner) inner.style.transform = `rotate(-${SLOT_ROT[newSlots[i]]})`;
    });
    currentSlots = newSlots;

    setTimeout(() => {
      selectedBubble = clickedBubble;
      clickedBubble.classList.add('bubble--selected');
      isAnimating = false;
      setTimeout(() => openModal(clickedBubble), 80);
    }, ROTATION_DURATION);
  }

  bubbles.forEach(b => b.addEventListener('click', () => rotateTo(b)));

  // ── Animación de entrada ─────────────────────────────────────────────────
  if (tematicasSection) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          bubbles.forEach((bubble, i) => {
            setTimeout(() => bubble.classList.add('is-visible'), i * 80);
          });
          if (ctmCenter) {
            setTimeout(() => ctmCenter.classList.add('is-visible'), bubbles.length * 80 + 100);
          }
          bubbles.forEach((bubble, i) => {
            bubble.style.transform = `rotate(${SLOT_ROT[i]})`;
            const inner = bubble.querySelector('.bubble__inner');
            if (inner) inner.style.transform = `rotate(-${SLOT_ROT[i]})`;
          });
          observer.unobserve(tematicasSection);
        }
      });
    }, { threshold: 0.15 });
    observer.observe(tematicasSection);
  }

  /* ── 5. Público Objetivo dots (cosmetic) ────────────────────────────── */
  document.querySelectorAll('.publico-objetivo .dot').forEach((dot, i, arr) => {
    dot.addEventListener('click', () => {
      arr.forEach(d => d.classList.remove('dot--active'));
      dot.classList.add('dot--active');
    });
  });

  /* ══════════════════════════════════════════════
     Helper functions
  ══════════════════════════════════════════════ */

  function createSvgDataUrl(svg) {
    return 'data:image/svg+xml,' + encodeURIComponent(svg.trim());
  }

  function injectImage(id, srcFn, fallback, tag) {
    const el = document.getElementById(id);
    if (!el) return;
    const src = tryGet(srcFn);
    if (src) {
      el.src = src;
      el.addEventListener('load',  () => hideSibling(el, '.que-son__image-placeholder'));
      el.addEventListener('error', () => { if (fallback) el.src = fallback; });
    } else if (fallback) {
      el.src = fallback;
    }
  }

  function hideSibling(el, selector) {
    const parent = el.parentElement;
    if (!parent) return;
    const ph = parent.querySelector(selector);
    if (ph) ph.classList.add('hidden');
  }

  function tryGet(fn) {
    try { return fn() || null; } catch { return null; }
  }

}); // end DOMContentLoaded


/* ══════════════════════════════════════════════
   Modal CTM — estilos
══════════════════════════════════════════════ */
const modalStyles = document.createElement('style');
modalStyles.textContent = `
  .ctm-modal {
    position: fixed;
    inset: 0;
    z-index: 200;
    background: rgba(10, 10, 30, 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease;
    backdrop-filter: blur(4px);
  }
  .ctm-modal--visible {
    opacity: 1;
    pointer-events: auto;
  }

  .ctm-modal__card {
    background: #ffffff;
    border-radius: 20px;
    padding: 0;
    max-width: 480px;
    width: 100%;
    overflow: hidden;
    box-shadow: 0 24px 64px rgba(44,44,106,.25);
    transform: translateY(24px) scale(0.97);
    transition: transform 0.35s cubic-bezier(.34,1.56,.64,1);
    position: relative;
  }
  .ctm-modal--visible .ctm-modal__card {
    transform: translateY(0) scale(1);
  }

  .ctm-modal__accent {
    height: 8px;
    width: 100%;
    background: #2c2c6a;
  }

  .ctm-modal__close {
    position: absolute;
    top: 20px;
    right: 20px;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: #f5f5f5;
    border: none;
    cursor: pointer;
    font-size: 14px;
    color: #666;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
    line-height: 1;
  }
  .ctm-modal__close:hover { background: #e8e8e8; color: #333; }

  .ctm-modal__title {
    font-family: 'Outfit', sans-serif;
    font-size: 26px;
    font-weight: 700;
    color: #2c2c6a;
    padding: 32px 32px 12px;
    margin: 0;
    line-height: 1.2;
  }

  .ctm-modal__desc {
    font-family: 'Poppins', sans-serif;
    font-size: 14px;
    color: #2c2c6a;
    opacity: 0.72;
    line-height: 1.75;
    padding: 0 32px 28px;
    margin: 0;
  }

  .ctm-modal__cta {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin: 0 32px 32px;
    padding: 14px 24px;
    background: #2c2c6a;
    color: #ffffff;
    border-radius: 10px;
    font-family: 'Outfit', sans-serif;
    font-weight: 600;
    font-size: 15px;
    text-decoration: none;
    transition: background 0.2s, transform 0.2s;
  }
  .ctm-modal__cta:hover {
    background: #3d3d8a;
    transform: translateY(-1px);
  }
  .ctm-modal__cta::after {
    content: '→';
    font-size: 18px;
  }
`;
document.head.appendChild(modalStyles);
