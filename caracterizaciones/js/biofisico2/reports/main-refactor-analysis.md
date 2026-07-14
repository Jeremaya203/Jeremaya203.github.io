# Analisis tecnico de refactorizacion de main.js

Fecha de analisis: 2026-06-10  
Archivo analizado: `js/biofisico2/main.js`  
Tamano actual estimado: 3161 lineas

## Meta

Reducir `main.js` hasta que tenga responsabilidad minima:

- inicializar el modulo Biofisico;
- importar modulos;
- crear el contexto principal;
- conectar controlador, estado, eventos, servicios, mapa y graficos;
- ejecutar la carga inicial;
- actuar solo como orquestador general.

`main.js` no debe conservar logica especifica de graficos, Chart.js, queries ArcGIS, filtros complejos, renderizado de capas, leyendas, popups, eventos detallados, textos descriptivos, configuraciones ni utilidades.

## Resumen ejecutivo

Aunque ya se movio una parte importante de graficos, eventos, servicios y UI, `main.js` todavia concentra responsabilidades criticas:

- Estado mutable global de mapa, filtros, capas, graficos y seleccion territorial.
- Zooms especificos de graficos interactivos.
- Renderizado y configuracion Chart.js principal.
- Carga y renderizado de capas ArcGIS.
- Leyenda interactiva y filtros visuales.
- Consultas por extension y highlight.
- Carga de selects territoriales.
- Contexto compartido para handlers de graficos.

La reduccion segura debe continuar por fases pequenas, con validacion despues de cada fase. La meta realista intermedia es bajar de 3161 lineas a 1600-2200 lineas. La meta final, cuando mapa/leyenda/Chart.js queden desacoplados, es 300-600 lineas.

## Orden sugerido de migracion

1. Estado mutable restante.
2. Servicios territoriales y selects.
3. Popups y estaciones.
4. Zooms derivados de graficos.
5. Leyenda interactiva y filtros visuales.
6. Renderizado/carga de capas.
7. Chart.js principal y bubble de orden del suelo.
8. Router/contexto de graficos.
9. Bootstrap final.

Este orden evita mover primero los bloques mas acoplados. Primero se estabiliza el estado y las dependencias, luego se extraen mapa/leyenda/graficos.

## Inventario de bloques detectados

| Bloque o funcion | Responsabilidad actual | Destino recomendado | Dependencias | Riesgo | Orden | Temporalmente en main.js | Eliminar despues | Reduccion estimada |
|---|---|---|---|---|---:|---|---|---:|
| Variables globales `currentMode`, `currentMainModule`, `currentSubLayerIndex`, `layerGlobal`, `layersGlobal`, `whereBase`, `municipioActual`, `deptoActual`, `filtroNivel`, `chartInstance`, `geoPieChartInstance`, `geoDonutChartInstance`, `legendFilterLabel`, `renderCycleId`, `highlightHandle` | Estado mutable transversal | `state/biofisico.state.js` | `syncStateFromGlobals`, mapa, eventos, graficos, leyenda | Alto | 1 | Getters/setters o contexto hasta completar extraccion | Declaraciones `let` duplicadas y sincronizacion manual | 120-220 |
| `syncStateFromGlobals` | Copia estado local hacia estado modular | `state/biofisico.state.js` o controlador de estado | Todas las variables globales | Alto | 1 | Adaptador de compatibilidad | Escritura manual campo por campo | 40-80 |
| `clearLayers` | Limpieza de capas y sincronizacion de estado | `map/biofisicoMap.renderer.js` o `map/layers.js` | `clearMapLayers`, estado de capas, highlight, leyenda | Medio | 2 | Llamada orquestadora | Lectura/escritura directa de estado local | 35-60 |
| `ensureMunicipalLayerIndex`, `getLayerListForCurrentLevel`, `clampSubLayerIndex` | Seleccion de subcapa segun nivel territorial | `app/layer-state.js` o `state/biofisico.state.js` | `LAYERS_CONFIG`, `DEPTO_ONLY_LAYER_IDS`, `DEPT_TO_MUNI_LAYER_ID` | Medio | 2 | Llamada a helper puro | Logica de indices en main | 50-90 |
| `updateURLByModule`, `getInitialModuleFromURL`, `applyInitialModuleFromURL` | Estado inicial desde URL | `config/biofisicoMenu.config.js` + `events/biofisicoNavigation.events.js` | `window.location`, `updateMapViewBadge`, estado | Bajo | 2 | Orquestar resultado inicial | Construccion directa de URL/estado | 35-70 |
| `toggleGeoformasCharts`, `destroyGeoformasCharts`, wrappers duales | Puente temporal para charts duales | `charts/chartRenderer.js` + estado chart | Instancias Chart.js, callbacks de zoom | Medio | 3 | Solo hasta mover estado de charts | Wrappers cuando estado quede fuera | 30-70 |
| `zoomMapaGeoformas`, `zoomMapaVocacion`, `zoomMapaOrdenSuelo` | Filtrado y zoom desde clicks de graficos | `map/biofisicoMap.renderer.js` o `map/biofisicoZoom.renderer.js` | `layerGlobal`, `view`, `whereBase`, `updateLegendByExtent`, `getActiveLayerConfig` | Medio | 4 | Inyectar `layer`, `view`, `whereBase` | Construccion de where y queryExtent en main | 180-260 |
| `setActiveVariantLayerByScale` | Cambio de capa variante por escala | `map/biofisicoMap.renderer.js` | `layersGlobal`, `view`, `chartLayerGlobal`, `renderCycleId`, leyenda, graficos | Alto | 6 | Callback coordinador | Watchers y seleccion de variante en main | 70-120 |
| `cargarDiccionarioMunicipios`, `cargarInfoMunicipio`, `actualizarFuente` | Consultas auxiliares | Ya parcialmente en `services/biofisicoQuery.service.js` | `fetch`, `FeatureLayer`, `sqlEquals` | Bajo | 2 | Solo asignacion de resultado a estado | Funcion completa en main | 20-40 restantes |
| `hideTimeSlider`, `showTimeSlider`, `getSelectedTimePeriod`, `handleTimeSliderInput` | UI y filtro temporal | `ui/biofisicoTimeSlider.renderer.js` + `events/biofisico.events.js` | DOM slider, `buildDefinitionExpression`, `actualizarGrafica`, capa activa | Medio | 3 | Callback para aplicar filtro | Logica de periodos y DOM en main | 130-210 |
| `renderSubTabs`, `renderControls`, `prevLayer`, `nextLayer` | Controles de subcapas | `ui/biofisico.controls.js` + `events/biofisico.events.js` | `currentMode`, `currentSubLayerIndex`, `cargarCapaActual` | Medio | 3 | Orquestar callbacks | DOM y navegacion de subcapas | 70-120 |
| `updateNavbarActive`, `syncDropdownBiofisico`, `setMode`, `limpiarBusqueda`, `init` | Eventos y navegacion UI | `events/biofisico.events.js` | DOM, estado, clear layers, leyenda, resumen, mapa | Medio | 3 | Registro general de eventos | Manipulacion detallada DOM/estado | 160-260 |
| `buildStationsPopupContent`, `ensureStationsLayer` | Popup y capa de estaciones | `map/biofisicoPopup.renderer.js` + `services/biofisicoLayer.service.js` | `FeatureLayer`, diccionarios territoriales, `escapeHtml`, URL estaciones | Bajo-Medio | 4 | Inyectar diccionarios | HTML de popup y definicion de FeatureLayer | 120-180 |
| `bindLegendClickOnce`, `getLegendTargetLayers`, `resetLegendVisualState`, `buildLegendWhere`, `applyLegendFilter` (dos implementaciones) | Eventos y filtros de leyenda | `events/biofisicoLegend.events.js` + `map/biofisicoLegend.renderer.js` | `window.__legendState`, `layerGlobal`, `layersGlobal`, `whereBase`, `view`, `queryExtent` | Alto | 5 | Crear API de leyenda inyectada | Implementaciones duplicadas y eventos DOM | 260-420 |
| `cargarCapaActual` | Carga/renderizado principal de capas | `map/biofisicoMap.renderer.js` | `FeatureLayer`, `LAYERS_CONFIG`, estado territorial, leyenda, estaciones, escala, graficos | Alto | 6 | Orquestador que llama servicio de mapa | Construccion de FeatureLayer, renderers, watchers | 400-650 |
| `getFieldDomainLabel`, `buildRuralPaletteFromRenderer` | Procesamiento de renderer/domain | `services/biofisicoLayer.service.js` o `utils/biofisicoArcgis.utils.js` | Renderer ArcGIS, domains | Bajo | 4 | Ninguno | Helpers puros en main | 60-100 |
| `cargarMunicipios`, `cargarDepartamentos`, `renderizarMunicipios` | Carga/render territorial y DOM selects | `services/biofisicoQuery.service.js` + `ui/biofisicoTerritory.renderer.js` | `FeatureLayer`, diccionarios, DOM selects | Medio | 2 | Asignacion al estado | DOM de selects en main | 100-160 |
| `createBiofisicoControllerApi` | API puente para eventos | `biofisico.controller.js` o `state/biofisico.context.js` | Estado, eventos, mapa, servicios | Alto | 8 | Puede quedar temporalmente | API gigante cuando estado/modulos esten desacoplados | 120-200 |
| `crearGraficaBubbleOrdenSuelo` | Render Chart.js especifico de suelos | `charts/soils/soil-order.chart.js` o `charts/chartRenderer.js` | Chart.js, callbacks de zoom, layout responsive | Medio-Alto | 7 | Wrapper minimo si requiere estado | Configuracion Chart.js en main | 350-500 |
| `crearGrafica` | Render Chart.js generico | `charts/chartRenderer.js` + `charts/chartOptions.js` | Chart.js, leyenda, filtros, click chart, BF3, pendientes, mapa | Alto | 7 | Wrapper temporal `crearGrafica(...)` | Configuracion de Chart.js, tooltips, onClick | 450-650 |
| `actualizarTituloGrafico` | Texto de titulo grafico | `charts/chartOptions.js` o `ui/biofisicoChartTitle.renderer.js` | Config, diccionarios, seleccion territorial | Bajo | 7 | Ninguno | Logica de titulo en main | 40-80 |
| `buildPaisajeDictFromRenderer`, `getLegendOutFields`, `buildLegendEntryFromAttrs`, `updateLegendByExtent` | Leyenda por extension | `map/biofisicoLegend.renderer.js` + `services/biofisicoLayer.service.js` | Renderer, diccionarios, `queryFeatures`, `view.extent`, colores | Alto | 5 | API con estado de capa activa | Query y armado de leyenda en main | 380-550 |
| `pickExistingField`, `pickVariantByScale`, `getDeptoCuencasGroupField` | Helpers mapa/graficos | `map/map.helpers.js` o `utils/biofisicoArcgis.utils.js` | Config, fields ArcGIS | Bajo | 4 | Ninguno | Helpers sueltos | 30-60 |
| `buildCtx`, `syncMapLayer`, `defaultQueryAndRenderHandler`, `actualizarGrafica`, `deps`, `HANDLERS` | Router de graficos y sincronizacion mapa-grafico | `charts/chartRegistry.js` + `charts/chartController.js` | Estado, mapa, leyenda, servicios, chart handlers | Alto | 8 | Main debe solo crear contexto y registrar handlers | Router y fallback handler en main | 280-420 |
| `applyWhereToActiveLayers`, `clearHighlight`, `ensureLayerView`, `highlightWhere`, `highlightWhereDebounced` | Filtros de capa y highlight | `map/biofisicoHighlight.renderer.js` + `map/biofisicoMap.renderer.js` | `layerGlobal`, `layersGlobal`, `view`, `queryObjectIds` | Medio | 6 | Callback inyectado | Highlight y definitionExpression en main | 90-140 |
| Autoseleccion por URL y `window.redirigir` | Navegacion inicial y preservacion de municipio | `events/biofisicoNavigation.events.js` | DOM selects, URLSearchParams | Bajo-Medio | 3 | Llamada de inicializacion | Interval/autoseleccion y redireccion en main | 60-100 |

## Fases recomendadas

### Fase A: Estado y contexto

- Mover variables mutables restantes a `state/biofisico.state.js`.
- Crear un contexto explicito: `createBiofisicoContext()`.
- Reemplazar lecturas directas por getters/setters pequenos.

Validacion: carga inicial, cambio de modo, refresh, seleccion de departamento y municipio.

Reduccion estimada: 160-300 lineas.

### Fase B: Territorio y URL

- Mover `cargarMunicipios`, `cargarDepartamentos`, `renderizarMunicipios`.
- Mover `updateURLByModule`, `getInitialModuleFromURL`, autoseleccion por URL y `window.redirigir`.

Destinos:

- `services/biofisicoQuery.service.js`
- `ui/biofisicoTerritory.renderer.js`
- `events/biofisicoNavigation.events.js`

Validacion: selects, URL con `id`, refresh, navegacion a otros modulos.

Reduccion estimada: 180-300 lineas.

### Fase C: Popup y estaciones

- Mover `buildStationsPopupContent`.
- Mover `ensureStationsLayer`.
- Mantener solo llamada desde carga de capa.

Destinos:

- `map/biofisicoPopup.renderer.js`
- `services/biofisicoLayer.service.js`

Validacion: popups de estaciones, campos mensuales, nombres municipio/departamento.

Reduccion estimada: 120-180 lineas.

### Fase D: Slider temporal y controles

- Mover `hideTimeSlider`, `showTimeSlider`, `getSelectedTimePeriod`, `handleTimeSliderInput`.
- Completar extraccion de `prevLayer`, `nextLayer`, `setMode`, `limpiarBusqueda`.

Destinos:

- `ui/biofisicoTimeSlider.renderer.js`
- `events/biofisico.events.js`
- `ui/biofisico.controls.js`

Validacion: slider zoom/tiempo, deforestacion, submenus, navegacion anterior/siguiente.

Reduccion estimada: 220-380 lineas.

### Fase E: Leyenda interactiva

- Unificar las dos funciones `applyLegendFilter`.
- Mover `bindLegendClickOnce`, `getLegendTargetLayers`, `resetLegendVisualState`, `buildLegendWhere`.
- Mover `getLegendOutFields`, `buildLegendEntryFromAttrs`, `updateLegendByExtent`.

Destinos:

- `events/biofisicoLegend.events.js`
- `map/biofisicoLegend.renderer.js`

Validacion: leyenda, click en clases, "Ver todo", filtros combinados, degradacion, orden suelo, BF3.

Reduccion estimada: 600-900 lineas.

### Fase F: Mapa y capas

- Mover `cargarCapaActual`.
- Mover `setActiveVariantLayerByScale`.
- Mover `applyWhereToActiveLayers`, highlight y helpers de escala.
- Mover `zoomMapaGeoformas`, `zoomMapaVocacion`, `zoomMapaOrdenSuelo`.

Destinos:

- `map/biofisicoMap.renderer.js`
- `map/biofisicoHighlight.renderer.js`
- `map/biofisicoZoom.renderer.js`

Validacion: todas las capas, cuencas multicapa, variantes por escala, zoom, highlight, popups.

Reduccion estimada: 700-1100 lineas.

### Fase G: Chart.js restante

- Mover `crearGraficaBubbleOrdenSuelo`.
- Mover `crearGrafica`.
- Mover `actualizarTituloGrafico`.
- Mantener en `main.js` solo registro de handlers o llamada al controlador de charts.

Destinos:

- `charts/chartRenderer.js`
- `charts/chartOptions.js`
- `charts/soils/soil-order.chart.js`
- `charts/chartInteractions.js`

Validacion: todos los graficos migrados, clicks de barras/pies, bubble de orden, leyenda sincronizada.

Reduccion estimada: 850-1200 lineas.

### Fase H: Router de graficos y bootstrap final

- Mover `buildCtx`, `syncMapLayer`, `defaultQueryAndRenderHandler`, `actualizarGrafica`, `deps`, `HANDLERS`.
- Crear `charts/biofisicoChart.controller.js` o ampliar `chartRegistry.js`.
- Reducir `main.js` a imports, creacion de contexto, inicializacion ArcGIS y llamadas de alto nivel.

Validacion: carga inicial, todas las categorias, filtros, leyendas, selects, popups y consola limpia.

Reduccion estimada: 300-500 lineas adicionales.

## Que debe quedar temporalmente en main.js

Mientras no se completen todas las fases, `main.js` puede conservar:

- Inicializacion AMD de ArcGIS (`require([...])`).
- Creacion inicial de `map` y `view`.
- Construccion temporal del contexto/controlador.
- Llamadas a `initAllDropdowns`, `initMapControls`, `initOverview`, `initScaleBar`.
- Puentes minimos hacia `window` que todavia usen `biofisico.html`, Limites u Ordenamiento.
- Wrappers pequenos para funciones que todavia dependen de estado no migrado.

Estos elementos deben revisarse al final para eliminar wrappers que hayan quedado sin necesidad.

## Codigo a eliminar despues de mover

- Variables globales duplicadas que ya existan en `state/biofisico.state.js`.
- Funciones duplicadas de leyenda, especialmente una de las dos `applyLegendFilter`.
- Wrappers de charts duales cuando `chartInstance`, `geoPieChartInstance` y `geoDonutChartInstance` vivan en estado modular.
- Helpers puros que ya existan en `utils/`, `map.helpers.js` o servicios.
- Cualquier acceso directo a `window.__legendState`, `window.activeFeatureLayer` o mapas globales si se reemplaza por estado formal.

## Riesgos principales

- `cargarCapaActual` mezcla capas, renderers, estaciones, leyenda, zoom, filtros y graficos; debe dividirse antes de moverla completa.
- `crearGrafica` mezcla Chart.js, filtros de mapa, leyenda y eventos; requiere inyeccion de callbacks.
- La leyenda tiene estado global y dos caminos de filtro; debe unificarse antes de extraer masivamente.
- Limites y Ordenamiento comparten controles y llamadas globales; cualquier cambio en eventos debe conservar esos puentes.
- Los handlers de graficos dependen del contexto `deps`; mover el router sin estado formal puede romper callbacks.

## Validacion obligatoria por fase

Despues de cada fase:

1. `node --check` para todos los JS de `js/biofisico2`.
2. Validacion de imports relativos.
3. Carga local de `biofisico.html`.
4. Prueba manual o automatizada de:
   - carga inicial;
   - seleccion de departamento;
   - seleccion de municipio;
   - renderizado de capas;
   - renderizado de graficos;
   - leyendas;
   - textos descriptivos;
   - zoom;
   - popups;
   - boton refrescar;
   - menu lateral;
   - submenus;
   - consola sin errores.

## Resultado final esperado

`main.js` deberia quedar como un archivo de inicializacion de aproximadamente 300-600 lineas, con esta forma conceptual:

```js
import { createBiofisicoContext } from "./biofisico.context.js";
import { initBiofisicoState } from "./state/biofisico.state.js";
import { initBiofisicoEvents } from "./events/biofisico.events.js";
import { initBiofisicoMap } from "./map/biofisicoMap.renderer.js";
import { initBiofisicoCharts } from "./charts/biofisicoChart.controller.js";
import { loadInitialBiofisicoData } from "./services/biofisicoQuery.service.js";

// Crear mapa/view, contexto, conectar modulos y ejecutar carga inicial.
```

La logica especifica debe vivir en modulos especializados; `main.js` solo debe coordinar.
