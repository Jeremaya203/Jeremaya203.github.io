# Plan de Refactorización - `main.js` → Arquitectura Modular

**Fecha:** 2026-06-10  
**Archivo:** `js/biofisico2/main.js` (2,521 líneas)  
**Objetivo:** Reducir `main.js` a ~400-600 líneas, moviendo cada responsabilidad a su módulo correspondiente.

---

## Diagnóstico Actual

`main.js` ya tiene imports hacia una estructura modular (40+ imports), pero **aún contiene dentro del bloque `require([...])`** (líneas 586-2521) la mayor parte de la lógica:

| Bloque | Líneas aprox. | Responsabilidad | ¿Dónde debería estar? |
|---|---|---|---|
| Variables globales (estado mutable) | L342-395 | Estado de app | `state/biofisico.state.js` |
| `syncStateFromGlobals`, `clearLayers` | L243-317 | Sincronización estado | `state/biofisico.state.js` |
| `cargarCapaActual` | L888-1142 | Carga/renderizado de capas | `map/biofisicoMap.renderer.js` *(nuevo)* |
| `crearGrafica` | L1472-1880 | Renderizado Chart.js | `charts/chartRenderer.js` *(nuevo)* |
| `crearGraficaBubbleOrdenSuelo` | L1462-1469 | Chart de suelos | `charts/soils/orden-suelo.chart.js` *(nuevo)* |
| `updateLegendByExtent` + helpers | L1906-2221 | Leyenda por extensión | `map/biofisicoLegend.renderer.js` *(nuevo)* |
| `applyLegendFilter`, `bindLegendClickOnce` | L856-1220 | Filtros de leyenda | `events/biofisicoLegend.events.js` *(nuevo)* |
| `cargarMunicipios`, `cargarDepartamentos`, `renderizarMunicipios` | L1227-1280 | Carga territorial | `services/biofisicoQuery.service.js` + `ui/biofisicoTerritory.renderer.js` |
| Time slider (estado + callbacks) | L641-684 | UI slider temporal | `ui/time-slider.js` (ya existe parcialmente) |
| `buildCtx` + `deps` + `HANDLERS` + `actualizarGrafica` | L2232-2443 | Router de gráficos | `charts/chartRegistry.js` *(nuevo)* |
| `createBiofisicoControllerApi` | L1282-1454 | API controlador | `biofisico.controller.js` |
| Estaciones/popups | L847-854 | Popup estaciones | `map/biofisicoPopup.renderer.js` *(nuevo)* |
| `setActiveVariantLayerByScale` | L484-542 | Cambio capa por escala | `map/biofisicoMap.renderer.js` *(nuevo)* |
| `defaultQueryAndRenderHandler` | L2295-2381 | Handler fallback charts | `charts/chartRegistry.js` *(nuevo)* |
| Highlight functions | L2453-2476 | Highlight de features | Ya en `map/biofisicoHighlight.renderer.js` (wrappers en main) |
| Inicialización `init()` | L757-768 | Bootstrap | Se queda en `main.js` |

---

## Fases de Refactorización (8 fases)

### Fase 1: Mover Estado Global
**Archivos destino:** `state/biofisico.state.js`
**Líneas a mover:** ~120 líneas
**Riesgo:** ALTO

**Acciones:**
1. Crear un objeto `BiofisicoContext` que contenga TODAS las variables de estado (L342-395)
2. Mover `syncStateFromGlobals` al state module como `syncFromContext(ctx)`
3. Mover `clearLayers` al módulo de capas
4. Mover `ensureMunicipalLayerIndex`, `clampSubLayerIndex`, `getLayerListForCurrentLevel` a `app/layer-state.js`
5. Reemplazar `let` globales por getters/setters del contexto

**Validación:** Carga inicial, cambio de modo, refresh, selección depto/municipio.

---

### Fase 2: Mover Carga Territorial y URL
**Archivos destino:** `services/biofisicoQuery.service.js`, `ui/biofisicoTerritory.renderer.js`, `events/biofisicoNavigation.events.js`
**Líneas a mover:** ~100 líneas
**Riesgo:** BAJO

**Acciones:**
1. Mover `cargarDiccionarioMunicipios` → `services/biofisicoQuery.service.js` (ya tiene las dependencias)
2. Mover `cargarInfoMunicipio` → `services/biofisicoQuery.service.js`
3. Mover `cargarMunicipios`, `cargarDepartamentos`, `renderizarMunicipios` → `ui/biofisicoTerritory.renderer.js`
4. Mover `updateURLByModule`, `getInitialModuleFromURL`, `applyInitialModuleFromURL` → `events/biofisicoNavigation.events.js`
5. Mover `actualizarResumen`, `actualizarFuente` → `ui/biofisicoSummary.renderer.js`

**Validación:** Selects depto/municipio, URL con `?id=`, refresh, navegación a otros módulos.

---

### Fase 3: Mover Time Slider
**Archivos destino:** `ui/time-slider.js` (expandir el existente)
**Líneas a mover:** ~60 líneas
**Riesgo:** MEDIO

**Acciones:**
1. Mover el estado del time slider (variables `timeSliderPeriods`, `timeSliderIndex`, etc.) al contexto
2. Mover `hideTimeSlider`, `showTimeSlider`, `getSelectedTimePeriod`, `handleTimeSliderInput` al módulo `ui/time-slider.js`
3. `main.js` solo llamará `createTimeSlider(...)` y expondrá lo necesario a `window`

**Validación:** Slider zoom/tiempo, deforestación, cambio de periodos.

---

### Fase 4: Mover Popups y Estaciones
**Archivos destino:** `map/biofisicoPopup.renderer.js`, `services/biofisicoLayer.service.js`
**Líneas a mover:** ~50 líneas
**Riesgo:** BAJO-MEDIO

**Acciones:**
1. Mover `ensureStationsLayer` y `createBiofisicoStationsLayer` → `services/biofisicoLayer.service.js` o archivo nuevo `map/stations.factory.js`
2. Mover `buildStationsPopupContent` → `map/biofisicoPopup.renderer.js`
3. `main.js` solo importará y pasará dependencias (diccionarios, escapeHtml)

**Validación:** Popups de estaciones climáticas, campos mensuales, nombres mpio/depto.

---

### Fase 5: Mover Leyenda Interactiva
**Archivos destino:** `map/biofisicoLegend.renderer.js`, `events/biofisicoLegend.events.js`
**Líneas a mover:** ~380 líneas
**Riesgo:** ALTO

**Acciones:**
1. Mover `getLegendOutFields` → `map/biofisicoLegend.renderer.js`
2. Mover `buildLegendEntryFromAttrs` → `map/biofisicoLegend.renderer.js`
3. Mover `updateLegendByExtent` (líneas 2070-2221) → `map/biofisicoLegend.renderer.js`
4. Mover `applyLegendFilter` (líneas 1166-1220) → `map/biofisicoLegend.renderer.js`
5. Mover `bindLegendClickOnce` (líneas 856-886) → `events/biofisicoLegend.events.js`
6. Unificar las dos implementaciones de filtro de leyenda (actualmente hay lógica duplicada)
7. Reemplazar `window.__legendState` por estado del contexto

**Validación:** Click en clases de leyenda, toggle on/off, "Ver todo", filtros combinados.

---

### Fase 6: Mover Carga de Capas (`cargarCapaActual`)
**Archivos destino:** `map/biofisicoMap.renderer.js`
**Líneas a mover:** ~350 líneas
**Riesgo:** ALTO

**Acciones:**
1. Mover `cargarCapaActual` completo (L888-1142) → `map/biofisicoMap.renderer.js`
2. Mover `setActiveVariantLayerByScale` (L484-542) → mismo archivo
3. Mover `applyWhereToActiveLayers` (si no está ya en `map/biofisicoMap.renderer.js`)
4. Mover watchers de escala y `scaleHandle`
5. `cargarCapaActual` recibirá el contexto completo inyectado

**Validación:** Todas las capas (geoformas, clima, suelos, ecosistemas, fenómenos, cuencas), variantes multicapa, zoom inicial, popups.

---

### Fase 7: Mover Charts (Chart.js)
**Archivos destino:** `charts/chartRenderer.js`, `charts/soils/orden-suelo.chart.js`, `charts/chartRegistry.js`
**Líneas a mover:** ~550 líneas
**Riesgo:** ALTO

**Acciones:**
1. Mover `crearGrafica` (L1472-1880) → `charts/chartRenderer.js` como función pura que recibe contexto
2. Mover `crearGraficaBubbleOrdenSuelo` wrapper → `charts/soils/orden-suelo.chart.js`
3. Mover `actualizarTituloGrafico` → `charts/chartOptions.js`
4. Mover `buildPaisajeDictFromRenderer` → `map/biofisicoLegend.renderer.js`
5. Mover atributos de filtro (`createAttributeFilters`, `filtrarPorRangoPeriodo`, `filtrarPorRangoCodigo`, `filtrarPorAtributo`) → `map/filters.js`

**Validación:** Todos los gráficos (barras, pie, doughnut, radar, polarArea, línea, bubble), clicks, tooltips, zoom desde gráfico.

---

### Fase 8: Mover Router de Gráficos y Bootstrap Final
**Archivos destino:** `charts/chartRegistry.js`, `biofisico.controller.js`
**Líneas a mover:** ~200 líneas
**Riesgo:** MEDIO

**Acciones:**
1. Mover `buildCtx` → `charts/chartRegistry.js` como `createChartContext(ctx)`
2. Mover `syncMapLayer` → `charts/chartRegistry.js`
3. Mover `defaultQueryAndRenderHandler` → `charts/chartRegistry.js`
4. Mover `deps`, `HANDLERS`, `actualizarGrafica` → `charts/chartRegistry.js`
5. Mover `createBiofisicoControllerApi` → `biofisico.controller.js`
6. `main.js` quedará como orquestador puro: imports, creación de mapa/view, inicialización de módulos

**Validación:** Carga inicial completa, todas las categorías, filtros, leyendas, selects, popups, consola limpia.

---

## `main.js` Después de la Refactorización (~450 líneas)

```js
// === IMPORTS (se mantienen los existentes + nuevos) ===
import { createBiofisicoContext } from "./state/biofisico.context.js";
import { initBiofisicoState } from "./state/biofisico.state.js";
import { initTerritoryLoader } from "./ui/biofisicoTerritory.renderer.js";
import { initTimeSlider } from "./ui/time-slider.js";
import { initLegendSystem } from "./map/biofisicoLegend.renderer.js";
import { initLayerLoader } from "./map/biofisicoMap.renderer.js";
import { initChartSystem } from "./charts/chartRegistry.js";
import { createBiofisicoControllerApi } from "./biofisico.controller.js";
// ... otros imports existentes ...

require([
    "esri/Map",
    "esri/views/MapView",
    // ... módulos ArcGIS ...
], function(EsriMap, MapView, ...) {
    
    // 1. Crear contexto central
    const ctx = createBiofisicoContext();
    
    // 2. Crear mapa y vista
    const mainMap = createMainMap({ EsriMap, MapView, ... });
    ctx.map = mainMap.map;
    ctx.view = mainMap.view;
    
    // 3. Inicializar estado
    initBiofisicoState(ctx);
    
    // 4. Inicializar dropdowns y controles de mapa
    initAllDropdowns(createBiofisicoControllerApi(ctx));
    initDropdownDescargables();
    initMapControls({ view: ctx.view, ... });
    initScaleBar({ view: ctx.view, ... });
    initOverview({ ... });
    
    // 5. Inicializar time slider
    initTimeSlider(ctx);
    
    // 6. Inicializar sistema de leyenda
    initLegendSystem(ctx);
    
    // 7. Inicializar cargador de capas
    initLayerLoader(ctx);
    
    // 8. Inicializar sistema de gráficos
    initChartSystem(ctx);
    
    // 9. Inicializar carga territorial
    initTerritoryLoader(ctx);
    
    // 10. Bindear eventos principales
    bindMainButtonEvents({ ... });
    bindTerritorySelectEvents({ ... });
    
    // 11. Inicializar desde URL
    initBiofisicoMunicipioFromUrl({ ... });
    attachBiofisicoRedirectHandler({ ... });
    
    // 12. Arrancar
    ctx.view.when(() => {
        ctx.init();
    });
});
```

---

## Estructura Final del Directorio `js/biofisico2/`

```
js/biofisico2/
├── main.js                          (~450 líneas - orquestador)
├── biofisico.controller.js          (API del controlador)
├── config.js                        (configuración central)
├── data.js                          (consultas ArcGIS)
├── utils.js                         (utilidades generales)
├── legend.js                        (helpers de leyenda)
├── app/
│   └── layer-state.js               (estado de capas)
├── charts/
│   ├── chartRegistry.js             (router de gráficos + handlers)
│   ├── chartRenderer.js             (crearGrafica genérico)
│   ├── chartOptions.js              (títulos, opciones)
│   ├── chartUtils.js                (utilidades chart)
│   ├── soils/
│   │   └── orden-suelo.chart.js     (bubble orden suelo)
│   ├── climate/
│   ├── ecosystems/
│   ├── hydrography/
│   ├── relief/
│   └── threatening-phenomena/
├── config/
│   └── biofisicoUi.config.js        (labels UI)
├── events/
│   ├── biofisico.events.js          (eventos de UI)
│   ├── biofisicoNavigation.events.js(navegación URL)
│   └── biofisicoLegend.events.js    (eventos de leyenda)
├── map/
│   ├── biofisicoHighlight.renderer.js
│   ├── biofisicoLegend.renderer.js  (leyenda completa)
│   ├── biofisicoMap.renderer.js     (carga de capas)
│   ├── biofisicoPopup.renderer.js   (popups de estaciones)
│   ├── biofisicoZoom.renderer.js    (zooms específicos)
│   ├── filters.js                   (filtros where)
│   ├── layers.js                    (gestión de capas)
│   ├── map.controls.js
│   ├── map.core.js
│   ├── map.helpers.js
│   ├── overview.js
│   ├── scale.js
│   └── zoom.js
├── modules/
│   ├── limites/
│   └── ordenamiento/
├── services/
│   ├── biofisicoLayer.service.js    (diccionarios, colores)
│   └── biofisicoQuery.service.js    (consultas territoriales)
├── state/
│   ├── biofisico.context.js         (NUEVO - contexto central)
│   └── biofisico.state.js           (sync/read state)
├── ui/
│   ├── biofisico.controls.js
│   ├── biofisicoSummary.renderer.js
│   ├── biofisicoTerritory.renderer.js
│   ├── dropdowns.js
│   ├── time-slider.js
│   └── ui.helpers.js
└── utils/
    └── biofisicoFormat.utils.js
```

---

## Archivos a Eliminar (código muerto - ya identificado)

Según `dead-code-report.md`, estos archivos NO se usan y deben eliminarse:
- `charts/chartRegistry.js` → se reescribirá
- `charts/chartRenderer.js` → se reescribirá
- `charts/chartOptions.js` → se reescribirá
- `charts/chartUtils.js` → se reescribirá
- `biofisico.events.js` → duplicado
- `biofisico.state.js` → se simplificará
- `config/biofisicoLayers.config.js`
- `config/biofisicoMenu.config.js`
- `services/biofisicoQuery.service.js` → se reescribirá
- `services/biofisicoLayer.service.js` → se simplificará
- `services/biofisicoText.service.js`
- `map/biofisicoMap.renderer.js` → se reescribirá
- `map/biofisicoLegend.renderer.js` → se reescribirá
- `map/biofisicoPopup.renderer.js` → se reescribirá
- `utils/biofisicoDom.utils.js`
- `utils/biofisicoFormat.utils.js`
- `utils/biofisicoArcgis.utils.js`
- `coloresBiofisico.js`

---

## Riesgos y Mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| `cargarCapaActual` mezcla capas, renderers, estaciones, leyenda, zoom, filtros y gráficos | ALTO | Dividir en sub-funciones antes de mover |
| `crearGrafica` mezcla Chart.js, filtros, leyenda y eventos | ALTO | Inyectar callbacks en vez de depender de globales |
| La leyenda tiene estado global `window.__legendState` | ALTO | Migrar a contexto formal |
| Límites y Ordenamiento comparten controles con Biofísico | MEDIO | Mantener puentes en `createBiofisicoControllerApi` |
| Los handlers de gráficos dependen del contexto `deps` | MEDIO | Mover `deps` completo al router de charts |

---

## Validación por Fase

Después de CADA fase:
1. `node --check` para todos los JS de `js/biofisico2`
2. Verificar imports relativos
3. Cargar `biofisico.html` localmente
4. Probar:
   - Carga inicial
   - Selección de departamento
   - Selección de municipio
   - Renderizado de capas
   - Renderizado de gráficos
   - Leyendas interactivas
   - Textos descriptivos
   - Zoom
   - Popups
   - Botón refrescar
   - Menú lateral y submenús
   - Navegación a Ordenamiento y Límites
   - Consola sin errores

---

## Estimación de Reducción

| Fase | Líneas removidas de main.js |
|---|---|
| Fase 1 (Estado) | ~120 |
| Fase 2 (Territorio) | ~100 |
| Fase 3 (Time Slider) | ~60 |
| Fase 4 (Popups) | ~50 |
| Fase 5 (Leyenda) | ~380 |
| Fase 6 (Capas) | ~350 |
| Fase 7 (Charts) | ~550 |
| Fase 8 (Router + API) | ~460 |
| **TOTAL** | **~2,070 líneas** |
| **main.js final** | **~450 líneas** |