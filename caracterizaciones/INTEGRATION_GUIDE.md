# Guía de Integración — Componente "Temáticas" (Diagrama de Burbujas IGAC)

> Documentación para extraer e integrar el componente de diagrama orbital + modal en otro frontend sin romper dependencias.

---

## 1. Inventario de Archivos

### Estructura del proyecto actual

| Ruta | Propósito | Tamaño aprox. | Dependencias |
|---|---|---|---|
| `static/index.html` | Landing page completa | ~10 KB | `styles.css`, `main.js`, `images.js` |
| `static/styles.css` | Estilos globales + componente | ~24 KB | Ninguna externa |
| `static/main.js` | Lógica del carrusel, modal, slider, navbar | ~14 KB | `images.js` (runtime) |
| `static/images.js` | Rutas base64 de assets | Variable (~2 MB si base64, ~100 B si rutas) | Ninguna |
| `Recursos_Base/1.png` … `6.png` | **Formas de gota** (fondos de burbujas) | ~50 KB c/u | Referenciados por CSS |
| `Recursos_Base/limites_municipales.png` | Ícono: límites | ~5 KB | Referenciado por HTML |
| `Recursos_Base/pro_socieconomicos.png` | Ícono: socioeconómicos | ~5 KB | Referenciado por HTML |
| `Recursos_Base/ordenamiento_territorial.png` | Ícono: ordenamiento | ~5 KB | Referenciado por HTML |
| `Recursos_Base/pro_ocupacion.png` | Ícono: ocupación | ~5 KB | Referenciado por HTML |
| `Recursos_Base/contexto_legal.png` | Ícono: contexto legal | ~5 KB | Referenciado por HTML |
| `Recursos_Base/procesos_biofisicos.png` | Ícono: biofísicos | ~5 KB | Referenciado por HTML |

**Nota:** El componente puede vivir **standalone** si copiás solo el HTML de la sección `<section class="tematicas">`, el CSS crítico, el bloque JS de temáticas y los 12 PNGs. No necesita React, build step ni dependencias de paquetes npm.

---

## 2. Estructura HTML del Componente

Copiar **exactamente** esta sección (líneas 121–173 de `index.html`):

```html
<!-- ══════════════════════════════════════════════
     TEMÁTICAS — Diagrama orbital de 6 burbujas + CTM
     ══════════════════════════════════════════════ -->
<section class="tematicas" id="tematicas">
  <div class="section-inner">
    <!-- Título de sección. Usa var(--font-display) y var(--fs-h2) del tema global -->
    <h2 class="section-title section-title--dark tematicas__heading">Temáticas</h2>

    <!-- Contenedor del diagrama. Dimensiones fijas 780×780px en desktop -->
    <div class="tematicas__diagram" role="list">

      <!-- Centro: círculo blanco CTM. z-index: 6 -->
      <div class="tematicas__center" aria-hidden="true">
        <span>CTM</span>
      </div>

      <!-- Burbuja 0: Límites Municipales — slot inicial top (0) -->
      <button class="tematicas__bubble bubble--limites bubble--slot-0"
              data-topic="limites" role="listitem">
        <span class="bubble__inner">
          <img class="bubble__icon"
               src="../Recursos_Base/limites_municipales.png"
               alt="Límites Municipales"/>
          <span class="bubble__label">Límites<br>Municipales</span>
        </span>
      </button>

      <!-- Burbuja 1: Socioeconómicos — slot inicial top-izq (1) -->
      <button class="tematicas__bubble bubble--socioeconomicos bubble--slot-1"
              data-topic="socioeconomicos" role="listitem">
        <span class="bubble__inner">
          <img class="bubble__icon"
               src="../Recursos_Base/pro_socieconomicos.png"
               alt="Socioeconómicos"/>
          <span class="bubble__label">Socioeconómicos</span>
        </span>
      </button>

      <!-- Burbuja 2: Ordenamiento Territorial — slot inicial top-der (2) -->
      <button class="tematicas__bubble bubble--ordenamiento bubble--slot-2"
              data-topic="ordenamiento" role="listitem">
        <span class="bubble__inner">
          <img class="bubble__icon"
               src="../Recursos_Base/ordenamiento_territorial.png"
               alt="Ordenamiento Territorial"/>
          <span class="bubble__label">Ordenamiento<br>Territorial</span>
        </span>
      </button>

      <!-- Burbuja 3: Ocupación — slot inicial bot-izq (3) -->
      <button class="tematicas__bubble bubble--ocupacion bubble--slot-3"
              data-topic="ocupacion" role="listitem">
        <span class="bubble__inner">
          <img class="bubble__icon"
               src="../Recursos_Base/pro_ocupacion.png"
               alt="Ocupación"/>
          <span class="bubble__label">Ocupación</span>
        </span>
      </button>

      <!-- Burbuja 4: Contexto Legal — slot inicial bot-der (4) -->
      <button class="tematicas__bubble bubble--contexto bubble--slot-4"
              data-topic="contexto" role="listitem">
        <span class="bubble__inner">
          <img class="bubble__icon"
               src="../Recursos_Base/contexto_legal.png"
               alt="Contexto Legal"/>
          <span class="bubble__label">Contexto<br>Legal</span>
        </span>
      </button>

      <!-- Burbuja 5: Procesos Biofísicos — slot inicial abajo (5) -->
      <button class="tematicas__bubble bubble--biofisicos bubble--slot-5"
              data-topic="biofisicos" role="listitem">
        <span class="bubble__inner">
          <img class="bubble__icon"
               src="../Recursos_Base/procesos_biofisicos.png"
               alt="Procesos Biofísicos"/>
          <span class="bubble__label">Procesos<br>Biofísicos</span>
        </span>
      </button>

    </div><!-- /.tematicas__diagram -->
  </div><!-- /.section-inner -->
</section>
```

**Claves del HTML:**
- Cada `<button>` tiene **dos clases fijas**: una de tema (`bubble--limites`) y una de slot inicial (`bubble--slot-0`).
- El atributo `data-topic` es obligatorio: es el lookup key para `topicInfo` en JS.
- `.bubble__inner` envuelve ícono + label. Se counter-rota con `transform: rotate(calc(-1 * var(--rot)))` para que el texto quede derecho.
- No hay SVG inline, `<defs>`, ni `<clipPath>`. Todo son PNGs.

---

## 3. CSS Crítico del Componente

Copiar **todo** este bloque en el CSS del proyecto receptor. Es independiente del resto del landing.

```css
/* ════════════════════════════════════════════════════════════════════════════
   COMPONENTE: Temáticas — Diagrama orbital de burbujas
   ════════════════════════════════════════════════════════════════════════════ */

/* Contenedor de sección */
.tematicas {
  background: var(--color-bg);
  padding-block: var(--section-pad);
}

.tematicas__heading { margin-bottom: 0; }

/* Diagrama 780×780px centrado. El centro geométrico es (390,390) */
.tematicas__diagram {
  position: relative;
  width: 780px;
  height: 780px;
  margin: 48px auto 0;
}

/* Círculo CTM — z-index 6 (detrás de burbujas normales, delante de fondo) */
.tematicas__center {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 234px; height: 234px;
  border-radius: 50%;
  background: var(--color-white);
  box-shadow: 0 4px 24px rgba(0,0,0,.15);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-display);
  font-size: 36px;
  font-weight: 700;
  color: #6b6b9a;
  z-index: 6;
}

/* ── Burbuja genérica ── */
.tematicas__bubble {
  position: absolute;
  width: 195px; height: 260px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-white);
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 14px;
  line-height: 1.3;
  text-align: center;
  z-index: 5;
  opacity: 0;                 /* empieza invisible; JS añade .is-visible */
  box-shadow: none;
  transition: top 0.55s cubic-bezier(.4,0,.2,1),
              left 0.55s cubic-bezier(.4,0,.2,1),
              transform 0.55s cubic-bezier(.4,0,.2,1),
              filter .25s;
  border: none;
  cursor: pointer;
  filter: drop-shadow(0 8px 24px rgba(0,0,0,.20));
}

.tematicas__bubble:hover {
  filter: drop-shadow(0 16px 40px rgba(0,0,0,.40)) brightness(1.08);
}

.tematicas__bubble:focus-visible {
  outline: 3px solid var(--color-orange);
  outline-offset: 3px;
}

/* Destacada: burbuja que ocupa el slot 0 (top) */
.tematicas__bubble.bubble--selected {
  z-index: 20;
  filter: drop-shadow(0 16px 40px rgba(0,0,0,.50)) brightness(1.15) !important;
}

/* ── Entrada animada ── */
@keyframes bubbleEntrance {
  0%   { opacity: 0; transform: rotate(var(--rot, 0deg)) scale(0.4); filter: drop-shadow(0 0 0 rgba(0,0,0,0)); }
  70%  { opacity: 1; transform: rotate(var(--rot, 0deg)) scale(1.06); filter: drop-shadow(0 12px 28px rgba(0,0,0,.25)); }
  100% { opacity: 1; transform: rotate(var(--rot, 0deg)) scale(1);    filter: drop-shadow(0 8px 24px rgba(0,0,0,.20)); }
}

.tematicas__bubble.is-visible {
  animation: bubbleEntrance 0.65s cubic-bezier(.34,1.56,.64,1) forwards;
}

/* Stagger de entrada */
.tematicas__bubble.is-visible:nth-child(2) { animation-delay: 0.00s; }
.tematicas__bubble.is-visible:nth-child(3) { animation-delay: 0.08s; }
.tematicas__bubble.is-visible:nth-child(4) { animation-delay: 0.16s; }
.tematicas__bubble.is-visible:nth-child(5) { animation-delay: 0.24s; }
.tematicas__bubble.is-visible:nth-child(6) { animation-delay: 0.32s; }
.tematicas__bubble.is-visible:nth-child(7) { animation-delay: 0.40s; }

/* Brillo pulsante del CTM */
@keyframes ctmGlow {
  0%, 100% { box-shadow: 0 4px 24px rgba(0,0,0,.15); }
  50%      { box-shadow: 0 4px 32px rgba(107,107,154,.30), 0 0 50px rgba(107,107,154,.12); }
}

.tematicas__center.is-visible {
  animation: ctmGlow 3s ease-in-out infinite;
}

/* ── Inner: contenido que se mantiene derecho ── */
.bubble__inner {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transform: rotate(calc(-1 * var(--rot, 0deg)));
}

.bubble__icon {
  width: 65px;
  height: 65px;
  object-fit: contain;
  display: block;
}

.bubble__label {
  font-size: 14px;
  font-weight: 700;
  line-height: 1.2;
  text-align: center;
  color: var(--color-white);
  text-shadow: 0 1px 4px rgba(0,0,0,.3);
  pointer-events: none;
}

/* ── Fondos de gota (fijos por temática) ── */
.bubble--limites        { background: url('../Recursos_Base/1.png') center/contain no-repeat; }
.bubble--socioeconomicos{ background: url('../Recursos_Base/2.png') center/contain no-repeat; }
.bubble--ordenamiento   { background: url('../Recursos_Base/3.png') center/contain no-repeat; }
.bubble--ocupacion      { background: url('../Recursos_Base/4.png') center/contain no-repeat; }
.bubble--contexto       { background: url('../Recursos_Base/5.png') center/contain no-repeat; }
.bubble--biofisicos     { background: url('../Recursos_Base/6.png') center/contain no-repeat; }

/* ── Slots de posición (el carrusel rota estas clases) ──
   Top/left están calculados para que las puntas apunten al centro del
   diagrama (390,390) con radio ~185px.
   --rot en cada slot debe coincidir con SLOT_ROT en main.js.          */
.bubble--slot-0 { top:  80px; left: 292px; --rot:   0deg; }
.bubble--slot-1 { top: 167px; left: 131px; --rot: 255deg; }
.bubble--slot-2 { top: 167px; left: 453px; --rot: 285deg; }
.bubble--slot-3 { top: 353px; left: 131px; --rot:  60deg; }
.bubble--slot-4 { top: 353px; left: 453px; --rot: 240deg; }
.bubble--slot-5 { top: 440px; left: 292px; --rot: 240deg; }
```

### Responsive breakpoints

```css
@media (max-width: 820px) {
  .tematicas__diagram { width: 600px; height: 600px; }
  .tematicas__center  { width: 180px; height: 180px; font-size: 28px; }
  .tematicas__bubble  { width: 150px; height: 200px; font-size: 12px; }
  .bubble__icon       { width: 50px;  height: 50px; }
  .bubble--slot-0 { top:  60px; left: 225px; }
  .bubble--slot-1 { top: 127px; left: 101px; }
  .bubble--slot-2 { top: 127px; left: 349px; }
  .bubble--slot-3 { top: 272px; left: 101px; }
  .bubble--slot-4 { top: 272px; left: 349px; }
  .bubble--slot-5 { top: 338px; left: 225px; }
}

@media (max-width: 900px) {
  .tematicas__diagram { width: 442px; height: 442px; }
  .tematicas__center  { width: 104px; height: 104px; font-size: 21px; }
  .tematicas__bubble  { width: 110px; height: 150px; font-size: 12px; }
  .bubble__icon   { width: 47px; height: 47px; }
  .bubble--slot-0 { top:  44px; left: 166px; }
  .bubble--slot-1 { top:  93px; left:  74px; }
  .bubble--slot-2 { top:  93px; left: 258px; }
  .bubble--slot-3 { top: 199px; left:  74px; }
  .bubble--slot-4 { top: 199px; left: 258px; }
  .bubble--slot-5 { top: 248px; left: 166px; }
}

@media (max-width: 600px) {
  .tematicas__diagram { width: 390px; height: 390px; }
  .tematicas__center  { width: 91px; height: 91px; font-size: 18px; }
  .tematicas__bubble  { width: 98px; height: 130px; font-size: 10px; }
  .bubble__icon   { width: 39px; height: 39px; }
  .bubble--slot-0 { top:  40px; left: 146px; }
  .bubble--slot-1 { top:  83px; left:  65px; }
  .bubble--slot-2 { top:  83px; left: 227px; }
  .bubble--slot-3 { top: 177px; left:  65px; }
  .bubble--slot-4 { top: 177px; left: 227px; }
  .bubble--slot-5 { top: 220px; left: 146px; }
}
```

---

## 4. JavaScript Crítico

### Bloque de temáticas (sección 4 de `main.js`)

Copiar **exactamente** desde `/* ── 4. Temáticas bubbles … */` hasta `observer.observe(tematicasSection);`:

```javascript
/* ── 4. Temáticas bubbles — carrusel orbital v5 ──────────────────────── */
const bubbles = Array.from(document.querySelectorAll('.tematicas__bubble'));

const topicInfo = {
  limites:        { label: 'Límites Municipales',      desc: 'Estado de los límites municipales…',         url: 'https://dev-caracterizaciones.igac.gov.co/biofisico.html?vista=limites' },
  ordenamiento:   { label: 'Ordenamiento Territorial', desc: 'Estado de los POT, PBOT y EOT…',           url: 'https://dev-caracterizaciones.igac.gov.co/biofisico.html?vista=pot' },
  contexto:       { label: 'Contexto Legal',           desc: 'Determinantes y condicionantes legales…',  url: '#' },
  biofisicos:     { label: 'Procesos Biofísicos',      desc: 'Altitud, pendiente, relieve…',             url: 'https://dev-caracterizaciones.igac.gov.co/biofisico.html' },
  ocupacion:      { label: 'Procesos de Ocupación',    desc: 'Distribución y crecimiento poblacional…',  url: 'https://dev-caracterizaciones.igac.gov.co/ocupacion.html' },
  socioeconomicos:{ label: 'Procesos Socioeconómicos', desc: 'Actividades económicas…',                  url: 'https://dev-caracterizaciones.igac.gov.co/socieconomico.html' },
};

const tematicasSection = document.querySelector('.tematicas');
const ctmCenter        = document.querySelector('.tematicas__center');

// SLOT_CLASSES[i] = clase CSS de la posición i (0=top, 1=top-izq, …)
const SLOT_CLASSES = [
  'bubble--slot-0', // top (12h) — destacada
  'bubble--slot-1', // top-izq (10h)
  'bubble--slot-2', // top-der (2h)
  'bubble--slot-3', // bot-izq (8h)
  'bubble--slot-4', // bot-der (4h)
  'bubble--slot-5', // abajo (6h)
];

// --rot aplicado por JS. Debe coincidir con las clases .bubble--slot-* en CSS.
const SLOT_ROT = ['0deg', '255deg', '285deg', '60deg', '240deg', '240deg'];
const ROTATION_DURATION = 560; // ms — igual a transition del CSS

// Estado: currentSlots[i] = índice de slot que ocupa el botón i
let currentSlots = bubbles.map((_, i) => i);
let selectedBubble = null;
let isAnimating    = false;

// ── Modal emergente (inyectado en <body>) ────────────────────────────────
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
  modal.querySelector('.ctm-modal__cta').href             = info.url  || '#';

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

// ── Carrusel ─────────────────────────────────────────────────────────────
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

  // Cerrar modal si estaba abierto
  modal.classList.remove('ctm-modal--visible');
  document.body.style.overflow = '';
  if (selectedBubble) {
    selectedBubble.classList.remove('bubble--selected');
    selectedBubble = null;
  }

  // Rotar slots: cada burbuja avanza S posiciones en sentido horario
  const newSlots = currentSlots.map(slot => (slot - S + 6) % 6);

  bubbles.forEach((bubble, i) => {
    // Intercambiar clase de posición (tema no cambia)
    bubble.classList.remove(SLOT_CLASSES[currentSlots[i]]);
    bubble.classList.add(SLOT_CLASSES[newSlots[i]]);

    // Aplicar rotación inline (CSS ya no tiene transform fijo)
    bubble.style.transform = `rotate(${SLOT_ROT[newSlots[i]]})`;

    // Counter-rotate del contenido para mantenerlo derecho
    const inner = bubble.querySelector('.bubble__inner');
    if (inner) inner.style.transform = `rotate(-${SLOT_ROT[newSlots[i]]})`;
  });

  currentSlots = newSlots;

  // Al terminar la transición: marcar como seleccionada y abrir modal
  setTimeout(() => {
    selectedBubble = clickedBubble;
    clickedBubble.classList.add('bubble--selected');
    isAnimating = false;
    setTimeout(() => openModal(clickedBubble), 80);
  }, ROTATION_DURATION);
}

bubbles.forEach(b => b.addEventListener('click', () => rotateTo(b)));

// ── Animación de entrada (IntersectionObserver) ──────────────────────────
if (tematicasSection) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // Stagger: cada burbuja entra 80ms después de la anterior
        bubbles.forEach((bubble, i) => {
          setTimeout(() => bubble.classList.add('is-visible'), i * 80);
        });
        // CTM aparece después de la última burbuja
        if (ctmCenter) {
          setTimeout(() => ctmCenter.classList.add('is-visible'),
                     bubbles.length * 80 + 100);
        }
        // Aplicar rotaciones iniciales inline
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
```

### Estilos inyectados del modal

Copiar **después** del cierre del `DOMContentLoaded`:

```javascript
/* ══════════════════════════════════════════════
   Modal CTM — estilos inyectados
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
```

---

## 5. Assets Requeridos

Copiar estos 12 archivos a la misma ruta relativa (`../Recursos_Base/` desde el HTML, o ajustar las rutas en CSS/HTML):

| Archivo | Tipo | Uso |
|---|---|---|
| `Recursos_Base/1.png` | Forma de gota | Fondo burbuja Límites |
| `Recursos_Base/2.png` | Forma de gota | Fondo burbuja Socioeconómicos |
| `Recursos_Base/3.png` | Forma de gota | Fondo burbuja Ordenamiento |
| `Recursos_Base/4.png` | Forma de gota | Fondo burbuja Ocupación |
| `Recursos_Base/5.png` | Forma de gota | Fondo burbuja Contexto Legal |
| `Recursos_Base/6.png` | Forma de gota | Fondo burbuja Biofísicos |
| `Recursos_Base/limites_municipales.png` | Ícono | Logo dentro de burbuja 0 |
| `Recursos_Base/pro_socieconomicos.png` | Ícono | Logo dentro de burbuja 1 |
| `Recursos_Base/ordenamiento_territorial.png` | Ícono | Logo dentro de burbuja 2 |
| `Recursos_Base/pro_ocupacion.png` | Ícono | Logo dentro de burbuja 3 |
| `Recursos_Base/contexto_legal.png` | Ícono | Logo dentro de burbuja 4 |
| `Recursos_Base/procesos_biofisicos.png` | Ícono | Logo dentro de burbuja 5 |

**Nota:** Si el proyecto receptor usa otro path, actualizar:
- Las reglas `background: url('../Recursos_Base/N.png')` en CSS
- Los `src="../Recursos_Base/..."` en el HTML

---

## 6. Variables CSS del Tema Global

El componente usa estas `var()`. Si el proyecto receptor **no** las define, agregarlas en `:root`:

```css
:root {
  /* Colores obligatorios */
  --color-bg:    #fff5e6;   /* fondo crema de la sección */
  --color-white: #ffffff;   /* fondo del CTM y modal */
  --color-navy:  #2c2c6a;   /* no usado directamente en burbujas, pero en texto del modal */
  --color-orange:#f29849;   /* outline de focus-visible */

  /* Tipografía obligatoria */
  --font-display: 'Outfit', sans-serif;   /* títulos, labels, CTM */
  --font-body:    'Poppins', sans-serif;   /* descripción del modal */

  /* Spacing opcional (solo para .tematicas padding) */
  --section-pad: clamp(48px, 7vw, 100px);
}
```

**Fuentes web:** El componente necesita que las fuentes Outfit y Poppins estén cargadas. Si el receptor no las tiene, agregar al `<head>`:

```html
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700&family=Poppins:wght@400;500;600&display=swap" rel="stylesheet">
```

---

## 7. Instrucciones de Integración

### Paso 1 — `<head>` del proyecto receptor

```html
<!-- Fuentes (si no las tiene ya) -->
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700&family=Poppins:wght@400;500;600&display=swap" rel="stylesheet">

<!-- Variables CSS (si no las tiene ya) -->
<style>
  :root {
    --color-bg:    #fff5e6;
    --color-white: #ffffff;
    --color-navy:  #2c2c6a;
    --color-orange:#f29849;
    --font-display: 'Outfit', sans-serif;
    --font-body:    'Poppins', sans-serif;
    --section-pad: clamp(48px, 7vw, 100px);
  }
</style>
```

### Paso 2 — CSS

1. Copiar el bloque "CSS Crítico del Componente" (sección 3 de esta guía) al final del CSS del receptor.
2. Ajustar las rutas `../Recursos_Base/N.png` si los assets van a otra carpeta.

### Paso 3 — HTML

1. Pegar la sección `<section class="tematicas">` (sección 2 de esta guía) en el `<body>` donde corresponda.
2. Ajustar `src="..."` de los íconos si cambió la ruta de assets.

### Paso 4 — JS

1. Copiar el bloque "Bloque de temáticas" (sección 4) dentro del callback `DOMContentLoaded` del receptor, **o** como módulo independiente si usa ES modules.
2. Copiar los "Estilos inyectados del modal" (también sección 4) **después** del cierre del `DOMContentLoaded`.

### Paso 5 — Assets

1. Copiar los 12 PNGs listados en la sección 5 a la carpeta que se indicó en CSS/HTML.

### Verificación rápida

Abrir la página, hacer scroll hasta la sección Temáticas y verificar:
1. Las 6 burbujas aparecen con stagger (una tras otra).
2. Click en una burbuja que no esté arriba → todas giran y la clickeada queda arriba.
3. El modal aparece con la franja de color del tema, título, descripción y CTA.
4. Click fuera del modal o en ✕ → cierra.
5. Click en la burbuja de arriba cuando ya está seleccionada → cierra modal.

---

## 8. Bugs Conocidos / Pendientes

### Críticos
1. **Rotación de las gotas no apunta al centro visualmente.**
   - Los valores `SLOT_ROT` fueron restaurados a los originales del script Python (`0deg`, `255deg`, `285deg`, `60deg`, `240deg`, `240deg`), pero en pantalla las puntas no quedan exactamente centradas en el CTM. Esto puede deberse a que los PNGs de las gotas (`1.png`–`6.png`) tienen una orientación nativa diferente a la que asume `--rot`, o a que el centro visual de la gota no coincide con su centro geométrico.
   - **Para corregir:** Necesita análisis visual iterativo. Ajustar `SLOT_ROT[n]` y `--rot` en cada slot hasta que la punta de cada PNG apunte al centro del CTM.

2. **Doble definición de `.bubble--selected`.**
   - En `styles.css` hay DOS reglas `.tematicas__bubble.bubble--selected` (líneas 472 y 501). La segunda usa `transform: rotate(var(--rot, 0deg)) scale(1.1)`, pero como el `transform` base del botón ya no usa `var(--rot)` (se maneja inline por JS), esta regla puede no tener efecto o entrar en conflicto.

### Menores
3. **Tooltip CSS huérfano.**
   - Existen reglas `@keyframes tooltipIn` y `.tematicas__tooltip--visible` en CSS, pero el tooltip flotante fue reemplazado por el modal emergente. Se pueden eliminar sin consecuencias.

4. **Contexto Legal sin URL real.**
   - `topicInfo.contexto.url === '#'`. Esperando URL definitiva del cliente.

### No bugs, pero a mejorar
5. **No hay degradado progresivo si JS falla.**
   - Si el JS no carga, las burbujas quedan en `opacity: 0` (invisibles). El CSS base no muestra nada sin la clase `.is-visible`.
   - **Fix rápido:** Agregar `.tematicas__bubble { opacity: 1; }` dentro de `@media (prefers-reduced-motion: reduce)` o como fallback.

6. **Imágenes en `images.js` hardcodeadas a rutas físicas.**
   - `logo-govco.png` e `logo-igac-full.png` deben existir en `images/`. Si se mueve el proyecto, las rutas se rompen. El script Python para regenerar `images.js` con base64 está documentado pero no automatizado.

7. **No hay test de accesibilidad con lector de pantalla.**
   - Aria-labels básicos presentes (`role="listitem"`, `aria-hidden="true"` en CTM). No verificado con NVDA/VoiceOver.

---

*Documento generado el 2026-05-27. Refleja el estado exacto de los archivos en ese momento.*
