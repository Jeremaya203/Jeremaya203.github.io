# Plan de arquitectura de mapas - Biofisico

Fecha: 2026-06-11  
Alcance: `biofisico.html` y `js/biofisico2/`  
Objetivo: sacar el renderizado de mapas de `main.js` por fases pequenas, sin cambiar servicios, campos, simbologia, leyendas, filtros, graficos ni comportamiento visual.

## Estado actual detectado

`main.js` todavia concentra responsabilidades de mapa:

- Creacion de capas con `new FeatureLayer`.
- Render normal de una capa activa.
- Render de variantes por escala (`variants`), como cuencas, vocacion y conflictos.
- Cambio de capa visible segun escala.
- Limpieza y reemplazo de capas.
- Aplicacion de `definitionExpression`.
- Zoom por `queryExtent`.
- Sincronizacion con leyenda.
- Sincronizacion mapa-grafico.
- Prefetch de features para graficos.
- Capa de estaciones y popup meteorologico.
- Zooms especializados por grafico/leyenda:
  - geoformas,
  - vocacion,
  - orden de suelo,
  - seleccion por categoria de leyenda.

Archivos `map/` existentes que ya pueden aprovecharse:

- `map.core.js`: creacion base del mapa.
- `map.controls.js`: controles del mapa.
- `overview.js`: overview map.
- `scale.js`: escala.
- `zoom.js`: zoom generico.
- `layers.js`: limpieza de capas ligada a `AppState`.
- `filters.js`: `buildWhereBase`, `buildDefinitionExpression`, filtros de atributos.
- `map.helpers.js`: helpers de variantes, escala y diccionarios.
- `biofisicoMap.renderer.js`: estaciones, popup de estaciones y `applyWhereToLayers`.
- `biofisicoLegend.renderer.js`: leyenda biofisica.
- `biofisicoZoom.renderer.js`: zooms especializados.
- `biofisicoHighlight.renderer.js`: highlight.

## Principio de migracion

No se deben crear carpetas vacias ni archivos decorativos. Cada archivo nuevo debe recibir codigo real desde `main.js` o centralizar una responsabilidad ya existente.

La migracion debe mantener temporalmente una API pequena entre `main.js` y mapa, parecida a lo hecho con `charts/chartController.js`.

`main.js` debe quedar como orquestador:

- leer estado actual,
- obtener config activa,
- delegar render de mapa a `mapController`,
- delegar grafico a `chartController`,
- conectar eventos y estado.

## Arquitectura objetivo

```text
js/biofisico2/map/
├── mapController.js
├── mapRegistry.js
├── mapRenderer.js
├── mapLayerFactory.js
├── mapQueryBuilder.js
├── mapLegend.renderer.js
├── mapPopup.renderer.js
├── mapUtils.js
├── relief/
├── climate/
├── hydrography/
├── ecosystems/
├── soils/
└── threatening-phenomena/
```

No se recomienda crear `threatening-relationship/` todavia porque los placeholders de relaciones fueron eliminados y no hay handlers reales activos.

## Responsabilidades propuestas

### `mapController.js`

Responsabilidad:

- Exponer `createMapController(deps)`.
- Recibir `config`, `whereBase`, `currentCycle`, estado y dependencias ArcGIS.
- Coordinar render normal o render con variantes.
- Llamar a `mapRegistry` para handlers especificos.
- Delegar a `mapRenderer`.
- Devolver referencias actualizadas:
  - `layerGlobal`,
  - `layersGlobal`,
  - `chartLayerGlobal`,
  - `stationsLayer`,
  - `activeLayerRenderKey`.

Codigo candidato desde `main.js`:

- `cargarCapaActual`.
- `buildActiveLayerRenderKey`.
- `hasRenderableActiveLayer`.
- rama normal de capa.
- rama `variants`.
- mediciones `cargarCapaActual.layerReady` y `cargarCapaActual.variants`.

Riesgo: alto, porque toca seleccion municipio/departamento, zoom, leyenda y grafico.

### `mapRegistry.js`

Responsabilidad:

- Relacionar `config.id` con handler de mapa.
- Exponer `getMapHandler(config)`.
- Evitar `if/else` largos en `main.js` y `mapController`.

Primera version recomendada:

- Registrar handlers genericos por defecto.
- Registrar handlers especificos solo cuando se migre cada grupo.

Riesgo: bajo si inicia como registry pasivo.

### `mapRenderer.js`

Responsabilidad:

- Crear/agregar/remover capas.
- Aplicar visibilidad.
- Aplicar filtros.
- Ejecutar zoom principal.
- Ejecutar callback de leyenda.
- Ejecutar callback de grafico.

Codigo candidato desde `main.js`:

- `map.add(newLayer)`.
- `map.add(l)` para variantes.
- `layersGlobal.forEach(ly => ly.visible = ...)`.
- `cachedQueryExtent(...).then(view.goTo...)`.
- flujo comun posterior a `newLayer.when(...)`.

Riesgo: medio-alto.

### `mapLayerFactory.js`

Responsabilidad:

- Crear `FeatureLayer`.
- Aplicar `definitionExpression`.
- Definir `outFields`.
- Configurar `popupEnabled`.
- Crear capas con variantes.
- Crear capa de estaciones si se decide mover desde `biofisicoMap.renderer.js`.

Codigo candidato desde `main.js`:

- `new FeatureLayer({ url, definitionExpression, outFields, opacity, popupEnabled })`.
- configuracion de `minScale`, `maxScale` para variantes.
- conexion con `createBiofisicoStationsLayer`.

Riesgo: medio.

### `mapQueryBuilder.js`

Responsabilidad:

- Construir queries de mapa.
- Normalizar `whereBase`.
- Construir query de extent.
- Construir query de prefetch de grafico cuando aplique.
- Evitar duplicar `whereBase || "1=1"`.

Codigo candidato desde `main.js`:

- `buildFeatureQuerySignature`.
- `normalizeFeatureOutFields`.
- query de prefetch.
- query de extent.

Riesgo: bajo-medio.

### `mapLegend.renderer.js`

Responsabilidad:

- Adaptador de leyenda especifico para mapa.
- Encapsular `updateLegendByExtent`.
- Mantener leyendas por renderer y por categorias presentes.
- Mantener interaccion de apagar/encender categorias.

Codigo candidato desde `main.js`:

- `updateLegendByExtent`.
- `applyLegendFilter`.
- `bindLegendClickOnce`.
- `buildLegendWhere`.
- `resetLegendVisualState`.
- llamadas a `actualizarLeyenda`.

Riesgo: alto, porque la leyenda interactua con filtros, mapa, zoom y grafico.

### `mapPopup.renderer.js`

Responsabilidad:

- Centralizar popup de estaciones y futuros popups de capas.

Codigo candidato:

- `buildStationsPopupContent` desde `biofisicoMap.renderer.js`.
- `popupTemplate` de estaciones.

Riesgo: bajo si se mueve solo popup de estaciones.

### `mapUtils.js`

Responsabilidad:

- Helpers comunes de mapa que no dependan de estado global.
- Normalizacion de layers.
- Validacion de layer destruido.
- `safeGoToExtent`.
- `isLayerAlive`.
- helpers para variantes.

Codigo candidato:

- wrappers de validacion repetidos:
  - `if (currentCycle !== renderCycleId || layerGlobal !== newLayer || newLayer.destroyed) return`.
  - checks `layer && !layer.destroyed`.

Riesgo: bajo.

## Mapa por grupos

### Fase 1 - Base de arquitectura

Crear con codigo real:

- `mapController.js`
- `mapRenderer.js`
- `mapLayerFactory.js`
- `mapQueryBuilder.js`
- `mapUtils.js`
- `mapRegistry.js`

Migracion minima:

- Mover `buildActiveLayerRenderKey`.
- Mover `hasRenderableActiveLayer`.
- Mover creacion normal de `FeatureLayer` a `mapLayerFactory`.
- Mantener `cargarCapaActual` en `main.js`, pero llamando a helpers nuevos.

Validacion:

- Carga inicial.
- Seleccion departamento.
- Seleccion municipio.
- Hipsometria renderiza y hace zoom.
- Leyenda de Hipsometria funciona.
- Grafico sigue renderizando.

### Fase 2 - Render normal generico

Mover a `mapRenderer.js`:

- flujo normal de una capa:
  - crear layer,
  - agregar al mapa,
  - setear `layerGlobal`,
  - cargar fuente,
  - zoom por extent,
  - prefetch chart features,
  - actualizar grafica,
  - actualizar leyenda,
  - registrar metricas.

`main.js` debe delegar:

```js
await mapController.renderActiveLayer(config, {
  whereBase,
  filtroNivel,
  municipioActual,
  deptoActual
});
```

Validacion:

- Hipsometria.
- Temperatura.
- Ecosistemas.
- Inundaciones.

### Fase 3 - Variantes por escala

Mover flujo `config.variants`:

- crear capas variantes,
- elegir capa por escala,
- watchers de escala,
- labels por escala,
- `chartLayerGlobal`,
- leyenda por capa activa.

Archivos destino:

- `mapRenderer.js`
- `mapLayerFactory.js`
- `mapUtils.js`

Validacion:

- Cuencas.
- Vocacion.
- Conflictos.
- Cambios de escala.
- Grafico sigue usando la capa correcta.

### Fase 4 - Relieve

Crear con codigo real:

- `map/relief/hypsometry.map.js`
- `map/relief/slopes.map.js`
- `map/relief/geoforms.map.js`

Contenido:

- IDs soportados.
- estrategia de zoom.
- comportamiento de leyenda si aplica.
- necesidades de diccionario (`ensureGeoformasDict`).

Validacion:

- Hipsometria.
- Pendientes.
- Geoformas dual.
- Click grafico -> mapa.
- Leyenda -> filtro.

### Fase 5 - Clima

Crear:

- `temperature.map.js`
- `precipitation.map.js`
- `climates.map.js`
- `temperature-change-cc.map.js`
- `precipitation-change-cc.map.js`
- `climate-risk.map.js`

Mover solo configuracion/comportamiento especifico que hoy este disperso en `main.js`, no duplicar config de `config.js`.

Validacion:

- Temperatura.
- Precipitacion.
- Climas.
- Cambio CC.
- Riesgo CC radar.
- Estaciones meteorologicas si la capa activa lo requiere.

### Fase 6 - Hidrografia

Crear:

- `hydrographic-basins.map.js`
- `runoff.map.js`

Prioridad:

- variantes de cuencas 19/20/21.
- seleccion por escala.
- leyenda por renderer activo.

Validacion:

- Cuencas cambia por escala.
- Escorrentia.
- Zoom y leyenda.

### Fase 7 - Ecosistemas

Crear:

- `ecosystems.map.js`
- `deforestation-regeneration.map.js`

Validacion:

- Ecosistemas.
- Deforestacion/regeneracion.
- Slider temporal si aplica.

### Fase 8 - Suelos

Crear:

- `soil-order.map.js`
- `soil-vocation-edaphic-supply.map.js`
- `land-use-conflicts.map.js`

Prioridad:

- vocacion 29/30 por escala.
- conflictos 31/32 por escala.
- zoom especifico de orden de suelo/vocacion.

Validacion:

- Orden de suelo.
- Vocacion dual.
- Conflictos.
- Click grafico -> mapa.

### Fase 9 - Fenomenos amenazantes

Crear:

- `floods.map.js`
- `mass-removal-hazard.map.js`
- `soil-degradation.map.js`
- `expected-seismic-intensity.map.js`

Validacion:

- Inundaciones.
- Remocion.
- Degradacion.
- Sismica.
- Orden de leyenda.

### Fase 10 - Limpieza de `main.js`

Eliminar de `main.js` cuando ya esten migrados:

- `cargarCapaActual`.
- `applyWhereToActiveLayers`.
- zooms especificos si ya estan en handlers de mapa.
- `updateLegendByExtent`.
- helpers de firma/query si ya estan en `mapQueryBuilder`.
- acceso directo a `FeatureLayer` para mapas.

Validacion final:

- Carga inicial de `biofisico.html`.
- Select departamento.
- Select municipio.
- Boton refrescar.
- Ver todo.
- Cambio entre categorias.
- Cambio entre subtabs.
- Zoom.
- Leyenda.
- Grafico.
- Consola sin errores.

## Riesgos principales

| Riesgo | Nivel | Mitigacion |
|---|---:|---|
| Romper zoom al seleccionar municipio | Alto | Migrar primero queries/extent sin cambiar `whereBase`. |
| Romper mapa-grafico | Alto | Mantener `actualizarGrafica` como callback inyectado hasta terminar mapa. |
| Romper variantes por escala | Alto | Migrar variantes en fase independiente. |
| Duplicar filtros | Medio | Crear `mapQueryBuilder` antes de mover render. |
| Perder leyenda interactiva | Alto | No mover `updateLegendByExtent` hasta que render normal y variantes esten estables. |
| Crear archivos vacios | Bajo | Cada archivo nuevo debe recibir codigo real en el mismo commit/fase. |

## Primer cambio recomendado

La primera implementacion debe ser pequena:

1. Crear `mapQueryBuilder.js` con:
   - `normalizeFeatureOutFields`,
   - `buildFeatureQuerySignature`,
   - `createExtentQuery`,
   - `createChartPrefetchQuery`.
2. Crear `mapLayerFactory.js` con:
   - `createBiofisicoFeatureLayer`.
3. Cambiar `main.js` para usar estos helpers, sin mover aun `cargarCapaActual`.

Esto reduce riesgo y prepara el terreno para `mapController.js`.

## Criterios de exito

- `main.js` reduce responsabilidades de mapa por fases.
- Cada archivo nuevo tiene codigo real.
- No se duplican servicios ni campos.
- No cambia visualmente el mapa.
- No se renderiza Colombia completa cuando hay filtro territorial.
- No se rompe el controlador de graficos ya separado.

## Acciones aplicadas

- Se creo `map/mapController.js` y se conecto desde `main.js`.
- Se creo `map/mapRegistry.js` y se conecto a archivos especializados por grupo.
- Se creo `map/mapRenderer.js` con helpers reales para:
  - agregar capa activa al mapa,
  - controlar capa visible,
  - limpiar filtro de `LayerView`,
  - hacer zoom por extent,
  - actualizar leyenda con fallback,
  - crear watcher estacionario de leyenda.
- Se creo `map/mapLayerFactory.js` y `main.js` ya no instancia directamente capas biofisicas normales o variantes con `new FeatureLayer`; esa responsabilidad paso a la fabrica.
- Se creo `map/mapQueryBuilder.js` y se movieron:
  - firma de query de features,
  - construccion de query de extent,
  - construccion de query de prefetch de graficos,
  - decision de prefetch por id de capa.
- Se creo `map/mapUtils.js` y se movieron:
  - key de render activo,
  - validacion de capa renderizable,
  - validacion de render obsoleto,
  - medicion temporal de mapa.
- Se creo `map/mapPopup.renderer.js` y el popup de estaciones ya se consume desde ese archivo.
- Se movio el flujo principal de `cargarCapaActual` a `mapController.renderActiveLayer(...)`.
- `main.js` conserva solo una funcion puente `cargarCapaActual` para mantener compatibilidad con los eventos existentes.
- Se creo `map/mapRenderContext.js` para agrupar una sola vez las dependencias que necesita `mapController.renderActiveLayer(...)`.
- `cargarCapaActual` ya no contiene la lista larga de dependencias de render; ahora valida el contexto y delega al controlador.
- `activeLayerRenderKey` paso a ser estado interno de `mapController`.
- La actualizacion de `renderCycleId` y el reemplazo seguro de `scaleHandle` se centralizaron en `mapRenderContext.js`.
- Se corrigio la regresion donde `renderCycleId` se incrementaba antes y despues de `clearLayers()`, lo que marcaba la capa nueva como obsoleta e impedia zoom y graficos.
- Si la seleccion territorial/capa no cambia, `mapController` vuelve a invocar `actualizarGrafica(...)` sobre la capa activa para evitar quedarse sin grafico tras un intento previo fallido.
- Se elimino la copia antigua no usada de `buildStationsPopupContent` en `biofisicoMap.renderer.js`.
- Se crearon archivos especializados reales por grupo:
  - `relief/*.map.js`
  - `climate/*.map.js`
  - `hydrography/*.map.js`
  - `ecosystems/*.map.js`
  - `soils/*.map.js`
  - `threatening-phenomena/*.map.js`
- No se crearon archivos de `threatening-relationship` porque no hay mapas activos reales de relacion; crear placeholders iria contra la regla de no archivos vacios.

Validaciones ejecutadas:

- Sintaxis completa de `js/biofisico2`: OK.
- Carga HTTP local de `biofisico.html`: OK.
- Import controlado de `main.js`: limitado por mocks incompletos de ArcGIS/DOM en `overview.js`; no se detectaron errores de sintaxis ni imports rotos en los modulos nuevos.
- Validacion automatizada con Playwright: no ejecutable en este entorno porque el runtime trae `playwright`, pero falta `playwright-core`.

Pendiente tecnico:

- Migrar, en una fase posterior y de bajo riesgo, funciones auxiliares de zoom especializado que todavia leen `layerGlobal` directamente desde `main.js`.
- Validar en navegador real la interaccion completa departamento/municipio cuando haya un runtime Playwright completo o navegador automatizado disponible.
