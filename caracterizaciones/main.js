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
        linkList.querySelectorAll('a:not(#loginBtn)').forEach(a => {
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
    limites:        { label: 'Límites Municipales',      desc: 'Este proceso comprende el diagnóstico del estado actual de los límites de las entidades territoriales, mediante la verificación de sus líneas limítrofes para determinar si requieren proceso de deslinde. Se apoya en aerofotografías, ortofotografías, imágenes satelitales, cartografía e información catastral, así como en normatividad y documentos históricos. Busca apoyar el ordenamiento territorial del país y evaluar la apertura de procesos de deslinde y certificación limítrofe.', url: 'limites.html' },
    ordenamiento:   { label: 'Ordenamiento Territorial', desc: 'Este proceso comprende la identificación de las principales dinámicas y restricciones normativas asociadas al uso del suelo, de acuerdo con las competencias municipales establecidas en la Ley 388 de 1997 y sus decretos reglamentarios, que asignan a los municipios la clasificación del suelo y la reglamentación de usos de los predios. Se examina la vigencia de esta normatividad y su incidencia en el catastro, en particular en la clasificación del suelo y la definición de usos para los componentes rural y urbano. ', url: 'ordenamiento.html' },
    contexto:       { label: 'Contexto Legal',           desc: 'Este proceso tiene el objetivo de realizar la identificacin y análisis de normas asociadas con las restricciones de uso del suelo impuestas por entidades nacionales y regionales. Incluye determinantes, de obligatorio cumplimiento, y condicionantes, que son obras o situaciones relevantes por su impacto territorial. Este proceso permite reconocer las limitaciones legales que afectan el uso del suelo, y es fundamental para orientar adecuadamente la gestión, planificación y el ordenamiento territorial.', url: 'contexto.html' },
    biofisicos:     { label: 'Procesos Biofísicos',      desc: 'Este proceso comprende la caracterización de los medios naturales, conformados por diversos elementos (geoformas, clima, agua, vegetación, suelo, entre otros), en los que se presentan procesos, dinámicas e interacciones, y diversos grados de intervención humana. La visión general de los aspectos biofísicos permite diferenciar los espacios en varias temáticas y tener un panorama de las condiciones de oferta natural y de potencialidades o problemáticas ambientales a nivel rural.', url: 'biofisico.html' },
    ocupacion:      { label: 'Procesos de Ocupación',    desc: 'Este proceso entiende al territorio como una construcción social, resultado de la confluencia de factores geohistóricos, ambientales, económicos, políticos y culturales, lo que da lugar a patrones específicos de uso y asentamiento del espacio. Se analizadesde tres categorías clave: la distribución de la población (su configuración histórica, distribución, densidad y concentración urbana y rural), la composición demográfica actual (perspectivas de género, edad, pertenencia étnica, dinámicas de crecimiento ymigración, actores sociales y condiciones de seguridad) y la distribución de la propiedad (tamaño y tenencia de la tierra). ', url: 'ocupacion.html' },
    socioeconomicos:{ label: 'Procesos Socioeconómicos', desc: 'Este proceso permite identificar la importancia económica a partir de la construcción social presente en una entidad territorial que se soporta en los sectores económicos, dinámicas productivas, infraestructura de apoyo agropecuario, estrategias que orientan mayores rendimientos y productividad, así como la relevancia de los medios multimodales que permiten condicionar la competitividad del municipio en un contexto departamental y regional, analizando las dimensiones y variables de los indicadores de pobreza como el IPM y NBI.',     url: 'socioeconomico.html' },
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
  // Rueda estática (wireframe §C): cada gota ya está pre-orientada apuntando al
  // centro en su slot de diseño → sin rotación CSS. El click solo resalta + tarjeta.
  const SLOT_ROT = ['0deg', '0deg', '0deg', '0deg', '0deg', '0deg'];
  const ROTATION_DURATION = 560;
  const MODAL_DELAY       = 620;

  // currentSlots[i] = índice de slot que ocupa el botón i
  let currentSlots = bubbles.map((_, i) => i);
  let selectedBubble = null;
  let isAnimating    = false;

  // ── Tarjeta lateral (bifocal — reemplaza al modal, fiel al wireframe) ────
  const panel      = document.getElementById('tematicas-panel');
  const cardTitle  = panel && panel.querySelector('.tematicas__card-title');
  const cardDesc   = panel && panel.querySelector('.tematicas__card-desc');
  const cardCta    = panel && panel.querySelector('.tematicas__card-cta');
  const cardAccent = panel && panel.querySelector('.tematicas__card-accent');
  const cardClose  = panel && panel.querySelector('.tematicas__card-close');

  function openAuthenticationModal() {
    const firebaseAuth = window.firebase && window.firebase.auth
      ? window.firebase.auth()
      : null;

    if (!firebaseAuth || !window.OOTAuthModal) {
      console.error('[Caracterizaciones] El modal de autenticación no está disponible.');
      return;
    }

    window.OOTAuthModal.open(firebaseAuth);
  }

  if (cardCta) {
    cardCta.addEventListener('click', event => {
      const authSession = window.CaracterizacionesAuth;
      const firebaseUser = window.firebase && window.firebase.auth
        ? window.firebase.auth().currentUser
        : null;
      const currentUser = (authSession && authSession.getCurrentUser
        ? authSession.getCurrentUser()
        : null) || firebaseUser;

      if (currentUser) return;

      event.preventDefault();
      openAuthenticationModal();
    });
  }

  const accentMap = {
    limites:        '#8c5a2c',
    socioeconomicos:'#d48f28',
    ordenamiento:   '#7b2fa8',
    ocupacion:      '#1166b1',
    contexto:       '#a32d14',
    biofisicos:     '#2a7a6a',
  };

  // Rellena la tarjeta fija de la derecha con la temática seleccionada
  function updateCard(bubble) {
    if (!panel) return;
    const topic = bubble.dataset.topic;
    const info  = topicInfo[topic] || {};
    if (cardTitle)  cardTitle.textContent = info.label || '';
    if (cardDesc)   cardDesc.textContent  = info.desc  || '';
    if (cardCta)    cardCta.href          = info.url   || '#';
    if (cardAccent) cardAccent.style.background = accentMap[topic] || '#2c2c6a';
    panel.classList.remove('tematicas__panel--hidden');
  }

  if (cardClose) cardClose.addEventListener('click', () => {
    if (panel) panel.classList.add('tematicas__panel--hidden');
    if (selectedBubble) { selectedBubble.classList.remove('bubble--selected'); selectedBubble = null; }
  });

  // ── Carrusel ────────────────────────────────────────────────────────────
  function getSlot(bubble) {
    return currentSlots[bubbles.indexOf(bubble)];
  }

  function rotateTo(clickedBubble) {
    // Rueda estática: la gota se queda en su slot (punta ya apunta al centro).
    // El click solo cambia el foco visual y la tarjeta lateral.
    if (selectedBubble) selectedBubble.classList.remove('bubble--selected');
    selectedBubble = clickedBubble;
    clickedBubble.classList.add('bubble--selected');
    updateCard(clickedBubble);
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

  // Estado inicial de la tarjeta: Ordenamiento Territorial (por defecto — wireframe §C)
  const defaultBubble = bubbles.find(b => b.dataset.topic === 'ordenamiento');
  if (defaultBubble) updateCard(defaultBubble);

  /* ── 5. Público Objetivo — subtítulo cíclico automático ─────────────── */
  (function () {
    const sub  = document.getElementById('po-sub');
    const dots = Array.from(document.querySelectorAll('.publico-objetivo .dot'));
    const audiencias = [
      'Entes Territoriales Municipales',
      'Secretarías y/o oficinas de planeación municipales',
      'Gestores catastrales',
      'Otras entidades de orden nacional y regional',
    ];
    if (!sub || dots.length === 0) return;
    let idx = 0, timer = null;
    function show(i) {
      idx = (i + audiencias.length) % audiencias.length;
      sub.textContent = audiencias[idx];
      dots.forEach((d, k) => d.classList.toggle('dot--active', k === idx));
    }
    function restart() { clearInterval(timer); timer = setInterval(() => show(idx + 1), 4000); }
    dots.forEach((d, i) => d.addEventListener('click', () => { show(i); restart(); }));
    show(0);
    restart();
  })();

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
