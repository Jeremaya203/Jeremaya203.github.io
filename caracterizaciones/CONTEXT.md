# Contexto del Proyecto — Caracterizaciones Territoriales IGAC

## Resumen Ejecutivo
Landing page estática (`static/index.html`) para el proyecto "Caracterizaciones Territoriales Municipales" del IGAC. Contiene un diagrama interactivo central con 6 burbujas temáticas que representan los ejes de caracterización territorial.

## Estado Actual del Diagrama de Burbujas

### Dimensiones y Escala
- **Contenedor diagrama**: `780px × 780px` (escalado 30% desde los 600px originales)
- **Círculo CTM (centro)**: `234px × 234px`, texto "CTM" a 36px, color `#6b6b9a`
- **Burbujas**: `195px × 260px`, fuente 14px
- **Íconos dentro de burbujas**: `65px × 65px`
- **Gap ícono-label**: 8px

### Distribución y Posicionamiento
Las 6 burbujas están distribuidas en forma hexagonal alrededor del centro. Centro del diagrama = `(390, 390)`, radio de distribución = **180–186px** (lo suficientemente cerca para que las puntas entren dentro del círculo CTM, pero no tan cerca que se vean apretadas).

| Burbuja | Posición (`top`, `left`) | Rotación (`--rot`) | PNG fondo |
|---|---|---|---|
| Límites Municipales | `80px`, `292px` | `0deg` | `1.png` |
| Socioeconómicos | `167px`, `131px` | `255deg` | `2.png` |
| Ordenamiento Territorial | `167px`, `453px` | `285deg` | `3.png` |
| Ocupación | `353px`, `131px` | `60deg` | `4.png` |
| Contexto Legal | `353px`, `453px` | `240deg` | `5.png` |
| Biofísicos | `440px`, `292px` | `240deg` | `6.png` |

### Técnica de Rotación
Cada burbuja tiene:
1. **`transform: rotate(var(--rot))`** en `.tematicas__bubble` → rota la gota completa para que la punta apunte al centro.
2. **`.bubble__inner` con `transform: rotate(calc(-1 * var(--rot)))`** → contra-rota el contenido (ícono + label) para que queden derechos.

Esto permite que la punta de la gota apunte al CTM mientras el texto y el ícono permanecen legibles.

### Assets Utilizados
**Fondos de burbujas** (formas de gota con gradientes pre-bakeados):
- `Recursos_Base/1.png` … `6.png` — Cada uno tiene su propia rotación nativa (puntas apuntan en diferentes direcciones).

**Íconos** (logos blancos en fondo circular oscuro):
- `limites_municipales.png`, `pro_socieconomicos.png`, `ordenamiento_territorial.png`, `pro_ocupacion.png`, `contexto_legal.png`, `procesos_biofisicos.png`

### Responsive
- **≤900px**: Diagrama `442×442`, burbujas `110×150`, CTM `104×104`, posiciones recalculadas con r=102–106
- **≤600px**: Diagrama `390×390`, burbujas `98×130`, CTM `91×91`, posiciones recalculadas con r=90–93

## Historial de Iteraciones

1. **Inicio**: Burbujas hechas con CSS `clip-path` y gradientes. Problema: difícil de hacer que las puntas apunten al centro con contenido derecho.
2. **Reemplazo por PNGs**: Se usaron las gotas del diseñador (`1.png`–`6.png`) como fondos. Las gotas ya vienen con gradientes y formas orgánicas.
3. **Rotación calculada**: Script en Python analizó la dirección de la punta de cada PNG y calculó `--rot` para que todas apunten al centro.
4. **Counter-rotation**: Implementado `.bubble__inner` para mantener íconos y texto derechos.
5. **Escalado 30%**: A pedido del usuario, todo el diagrama creció: 600→780px, burbujas 150→195px, íconos 50→65px, CTM 180→234px.
6. **Intento de acercar puntas**: Se redujo radio de distribución a 180px para que las puntas entren más en el CTM. Quedó bien pero el usuario pidió que las puntas estén aún más metidas.
7. **Intento de alargar gotas**: Se cambió burbujas a `185×300px` con `background-size: 100% 100%` para estirar los PNGs. **Resultado: visualmente horrible**, se deformaron las formas orgánicas. Revertido inmediatamente.

## Objetivo Actual

### Lo que el usuario quiere
> "Que las puntas estén más metidas en el círculo de CTM, pero asegurando perfecta distribución, organización y centrado."

**La solución correcta**: No deformar los PNGs por CSS. Opciones viables:
1. **Editar los archivos PNG originales** (`1.png`–`6.png`) para que sean físicamente más altos/alargados (proporción ~1.5:1 o 1.6:1 en lugar de 1:1). Esto requiere trabajo de edición de imágenes.
2. **Aumentar el tamaño de las burbujas** dentro del contenedor actual manteniendo proporción, y ajustar posiciones para que las puntas caigan dentro del CTM.
3. **Reducir ligeramente el radio de distribución** unos 15–20px más (de 180 a ~160–165) para que las puntas entren más, aceptando que los cuerpos estarán un poco más cerca pero sin verse apretados.

### Lo que el usuario acaba de pedir
> "Esos botones deben tener animaciones"

Se refiere a las 6 burbujas temáticas del diagrama. Deben tener:
- **Animación de entrada**: Cuando la sección "Temáticas" aparece en viewport, las burbujas deben entrar con un efecto (fade-in, scale-up, o flotar desde sus posiciones).
- **Animación hover**: Al pasar el mouse, efecto visual atractivo (escala, brillo, sombra, quizás un leve "bounce" o pulso).
- **Animación activa/click**: Cuando se hace click, transición suave al estado activo.
- **Animación idle/subtle**: Movimiento sutil constante (floating) para dar vida al diagrama.
- **Animación del tooltip**: Aparecer/desaparecer suavemente.
- **Interacción entre burbujas**: Quizás un efecto de "onda" o secuencia cuando una se activa.

## Estructura HTML Relevante

```html
<section class="tematicas" id="tematicas">
  <div class="section-inner">
    <h2 class="section-title section-title--dark tematicas__heading">Temáticas</h2>
    <div class="tematicas__diagram" role="list">
      <div class="tematicas__center"><span>CTM</span></div>
      <button class="tematicas__bubble bubble--limites" data-topic="limites" role="listitem">
        <span class="bubble__inner">
          <img class="bubble__icon" src="./Recursos_Base/limites_municipales.png" alt="" loading="lazy">
          <span class="bubble__label">Límites<br>Municipales</span>
        </span>
      </button>
      <!-- ... 5 más ... -->
    </div>
  </div>
</section>
```

## CSS Clave Actual

```css
.tematicas__diagram {
  position: relative;
  width: 780px;
  height: 780px;
  margin: 48px auto 0;
}

.tematicas__center {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 234px; height: 234px;
  border-radius: 50%;
  background: var(--color-white);
  /* ... */
}

.tematicas__bubble {
  position: absolute;
  width: 195px; height: 260px;
  transform: rotate(var(--rot, 0deg));
  filter: drop-shadow(0 8px 24px rgba(0,0,0,.20));
  transition: transform .25s, filter .25s;
}

.tematicas__bubble:hover {
  transform: rotate(var(--rot, 0deg)) scale(1.08);
  filter: drop-shadow(0 12px 32px rgba(0,0,0,.35));
}

.bubble__inner {
  transform: rotate(calc(-1 * var(--rot, 0deg)));
}
```

## JavaScript Actual (Tooltip)

```javascript
const bubbles = document.querySelectorAll('.tematicas__bubble');
// Click en burbuja → muestra tooltip posicionado debajo
// Click fuera → oculta tooltip
```

## Notas Técnicas
- Los PNGs de fondo (`1.png`–`6.png`) son cuadrados (~147×147px) con formas de gota orgánicas y gradientes bakeados.
- No usar `background-size: 100% 100%` — deforma las formas orgánicas y se ve horrible.
- Las rotaciones (`--rot`) fueron calculadas con análisis de imagen para que las puntas apunten al centro. No cambiar a menos que se cambien los PNGs.
- El contenedor `.tematicas__diagram` puede crecer si es necesario, pero hay que ajustar todo proporcionalmente.
- El tooltip se posiciona absolutamente dentro del diagrama, calculando coordenadas relativas al `getBoundingClientRect()`.

## Próximos Pasos Pendientes
1. ✅ Documentar contexto (este archivo)
2. 🔄 Implementar animaciones en las 6 burbujas temáticas
3. ⏳ Revisar si las puntas necesitan entrar más al CTM (quizás reducir radio a ~165px o editar PNGs originales)
4. ⏳ Revisar responsive fino en móviles

## Paleta de Colores del Proyecto
- Fondo: `#fff5e6` (crema)
- Azul navy: `#2c2c6a`
- Azul: `#395bb3`
- Naranja: `#f29849`
- Texto CTM: `#6b6b9a`

## Archivos Relevantes
- `static/index.html` — Estructura HTML
- `static/styles.css` — Estilos (líneas 400–520 aprox para burbujas)
- `static/main.js` — Interactividad (líneas 113–168 para tooltip)
- `Recursos_Base/1.png` … `6.png` — Fondos de burbujas
- `Recursos_Base/*_municipales.png`, `pro_*.png` — Íconos
