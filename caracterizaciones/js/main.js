/* ══════════════════════════════════════════════════════════════════════════
   main.js — Caracterizaciones Territoriales IGAC
   ══════════════════════════════════════════════════════════════════════════ */

"use strict";

const IMAGES = Object.freeze({
  logoSmall: 'img/logo-govco.png',
  logoFull: 'img/logo-igac-full.png',
  mapa: 'img/mapa_colombia.png',
  publicoBg: 'img/publico-objetivo-bg.jpg',
});

document.addEventListener('DOMContentLoaded', () => {

  /* ── 1. Images ─────────────────────────────────────────────────────────── */
  const PLACEHOLDER_LOGO = '';
  const PLACEHOLDER_LOGO_FULL = '';

  injectImage('logo-govco', () => IMAGES.logoSmall, PLACEHOLDER_LOGO);
  injectImage('logo-full',  () => IMAGES.logoFull,  PLACEHOLDER_LOGO_FULL);
  injectImage('img-mapa',   () => IMAGES.mapa,      null);

  /* Inject público objetivo background image */
  const publicTargetBackground = IMAGES.publicoBg;
  if (publicTargetBackground) {
    const publicTargetSection = document.querySelector('.publico-objetivo');
    if (publicTargetSection) publicTargetSection.style.backgroundImage = `url('${publicTargetBackground}')`;
  }

  /* ── 1b. Mobile navbar toggle ─────────────────────────────────────────── */
  const navigationToggleButton = document.querySelector('.nav-bar-toggle-igac');
  const mobileNav = document.querySelector('.navbarnavigac');
  const navigationLinks = document.getElementById('link-list');
  if (navigationToggleButton && mobileNav && navigationLinks) {
    navigationToggleButton.addEventListener('click', () => {
      const expanded = navigationToggleButton.getAttribute('aria-expanded') === 'true';
      navigationToggleButton.setAttribute('aria-expanded', String(!expanded));
      if (!expanded) {
        mobileNav.style.display = 'block';
        mobileNav.innerHTML = '';
        navigationLinks.querySelectorAll('a:not(#loginBtn)').forEach((link) => {
          const clonedLink = link.cloneNode(true);
          clonedLink.style.display = 'block';
          clonedLink.style.padding = '12px 24px';
          clonedLink.style.color = '#2c2c6a';
          clonedLink.style.fontFamily = "'Outfit', sans-serif";
          clonedLink.style.fontWeight = '500';
          clonedLink.style.borderBottom = '1px solid #eee';
          mobileNav.appendChild(clonedLink);
        });
      } else {
        mobileNav.style.display = 'none';
        mobileNav.innerHTML = '';
      }
    });
  }

  /* ── 2. Scroll reveal ────────────────────────────────────────────────── */
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('.reveal').forEach((element) => revealObserver.observe(element));

  /* ── 3. Contenidos slider ────────────────────────────────────────────── */
  const cardsTrack = document.getElementById('cards-track');
  const previousButton = document.getElementById('prev-btn');
  const nextButton = document.getElementById('next-btn');
  const dotsContainer = document.getElementById('contenidos-dots');

  if (cardsTrack && previousButton && nextButton && dotsContainer) {
    const CARDS_PER_PAGE = 3;
    const cards = Array.from(cardsTrack.querySelectorAll('.contenido-card'));
    const totalPages = Math.ceil(cards.length / CARDS_PER_PAGE);
    let currentPage  = 0;

    const dots = Array.from({ length: totalPages }, (_, index) => {
      const button = document.createElement('button');
      button.className = 'dot' + (index === 0 ? ' dot--active' : '');
      button.setAttribute('aria-label', `Página ${index + 1}`);
      button.setAttribute('role', 'listitem');
      button.addEventListener('click', () => goToPage(index));
      dotsContainer.appendChild(button);
      return button;
    });

    function goToPage(page) {
      currentPage = Math.max(0, Math.min(page, totalPages - 1));
      const viewport = cardsTrack.parentElement;
      const cardWidth = (viewport.offsetWidth - 56) / CARDS_PER_PAGE + 28;
      cardsTrack.style.transform = `translateX(-${currentPage * CARDS_PER_PAGE * cardWidth}px)`;

      dots.forEach((dot, index) => dot.classList.toggle('dot--active', index === currentPage));
      previousButton.disabled = currentPage === 0;
      nextButton.disabled = currentPage === totalPages - 1;
    }

    previousButton.addEventListener('click', () => goToPage(currentPage - 1));
    nextButton.addEventListener('click', () => goToPage(currentPage + 1));
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

  const topicsSection = document.querySelector('.tematicas');
  const topicsDiagram = document.querySelector('.tematicas__diagram');
  const centerLogo = document.querySelector('.tematicas__center');

  // Rueda estática (wireframe §C): cada gota ya está pre-orientada apuntando al
  // centro en su slot de diseño → sin rotación CSS. El click solo resalta + tarjeta.
  const SLOT_ROTATIONS = ['0deg', '0deg', '0deg', '0deg', '0deg', '0deg'];
  let selectedBubble = null;

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
    cardCta.addEventListener('click', (event) => {
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
    // Sin seleccion, las seis gotas vuelven a opacidad plena.
    if (topicsDiagram) topicsDiagram.classList.remove('has-selection');
  });

  // ── Carrusel ────────────────────────────────────────────────────────────
  function rotateTo(clickedBubble) {
    // Rueda estática: la gota se queda en su slot (punta ya apunta al centro).
    // El click solo cambia el foco visual y la tarjeta lateral.
    if (selectedBubble) selectedBubble.classList.remove('bubble--selected');
    selectedBubble = clickedBubble;
    clickedBubble.classList.add('bubble--selected');
    // has-selection es lo que baja la opacidad de las cinco no seleccionadas (css/index.css).
    if (topicsDiagram) topicsDiagram.classList.add('has-selection');
    updateCard(clickedBubble);
  }

  bubbles.forEach((bubble) => bubble.addEventListener('click', () => rotateTo(bubble)));

  // ── Animación de entrada ─────────────────────────────────────────────────
  if (topicsSection) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          bubbles.forEach((bubble, index) => {
            setTimeout(() => bubble.classList.add('is-visible'), index * 80);
          });
          if (centerLogo) {
            setTimeout(() => centerLogo.classList.add('is-visible'), bubbles.length * 80 + 100);
          }
          bubbles.forEach((bubble, index) => {
            bubble.style.transform = `rotate(${SLOT_ROTATIONS[index]})`;
            const inner = bubble.querySelector('.bubble__inner');
            if (inner) inner.style.transform = `rotate(-${SLOT_ROTATIONS[index]})`;
          });
          observer.unobserve(topicsSection);
        }
      });
    }, { threshold: 0.15 });
    observer.observe(topicsSection);
  }

  // Estado inicial de la tarjeta: Ordenamiento Territorial (por defecto — wireframe §C)
  // La gota tambien arranca resaltada para que tarjeta y diagrama digan lo mismo desde
  // el primer frame.
  const defaultBubble = bubbles.find((bubble) => bubble.dataset.topic === 'ordenamiento');
  if (defaultBubble) {
    selectedBubble = defaultBubble;
    defaultBubble.classList.add('bubble--selected');
    if (topicsDiagram) topicsDiagram.classList.add('has-selection');
    updateCard(defaultBubble);
  }

  /* ── 5. Público Objetivo — subtítulo cíclico automático ─────────────── */
  (function () {
    const subtitle = document.getElementById('po-sub');
    const dots = Array.from(document.querySelectorAll('.publico-objetivo .dot'));
    const audiences = [
      'Entes Territoriales Municipales',
      'Secretarías y/o oficinas de planeación municipales',
      'Gestores catastrales',
      'Otras entidades de orden nacional y regional',
    ];
    if (!subtitle || dots.length === 0) return;
    let currentIndex = 0;
    let timer = null;
    function show(index) {
      currentIndex = (index + audiences.length) % audiences.length;
      subtitle.textContent = audiences[currentIndex];
      dots.forEach((dot, dotIndex) => dot.classList.toggle('dot--active', dotIndex === currentIndex));
    }
    function restart() {
      clearInterval(timer);
      timer = setInterval(() => show(currentIndex + 1), 4000);
    }
    dots.forEach((dot, index) => dot.addEventListener('click', () => {
      show(index);
      restart();
    }));
    show(0);
    restart();
  })();

  /* ══════════════════════════════════════════════
     Helper functions
  ══════════════════════════════════════════════ */

  function injectImage(id, sourceProvider, fallback) {
    const image = document.getElementById(id);
    if (!image) return;
    const source = tryGet(sourceProvider);
    if (source) {
      image.src = source;
      image.addEventListener('load', () => hideSibling(image, '.que-son__image-placeholder'));
      image.addEventListener('error', () => {
        if (fallback) image.src = fallback;
      });
    } else if (fallback) {
      image.src = fallback;
    }
  }

  function hideSibling(element, selector) {
    const parent = element.parentElement;
    if (!parent) return;
    const placeholder = parent.querySelector(selector);
    if (placeholder) placeholder.classList.add('hidden');
  }

  function tryGet(callback) {
    try {
      return callback() || null;
    } catch {
      return null;
    }
  }

}); // end DOMContentLoaded
