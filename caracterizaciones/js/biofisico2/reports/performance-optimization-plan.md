# Plan de optimizacion de rendimiento - Modulo Biofisico

## Objetivo

Optimizar el rendimiento del modulo Biofisico priorizando la carga rapida de mapa, capas y graficos, sin cambiar comportamiento funcional, servicios, campos, leyendas ni seleccion territorial.

Este documento es un plan tecnico inicial. No implica cambios funcionales todavia.

## Alcance analizado

- `js/biofisico2/main.js`
- `js/biofisico2/config.js`
- `js/biofisico2/data.js`
- `js/biofisico2/services/biofisicoQuery.service.js`
- `js/biofisico2/services/biofisicoLayer.service.js`
- `js/biofisico2/map/`
- `js/biofisico2/charts/`
- `js/biofisico2/ui/time-slider.js`
- `js/biofisico2/events/biofisico.events.js`

## Diagnostico general

`main.js` sigue siendo el cuello de botella principal porque concentra el ciclo de renderizado:

1. Limpia capas.
2. Crea `FeatureLayer`.
3. Aplica `definitionExpression`.
4. Agrega capa al mapa.
5. Consulta `queryExtent`.
6. Ejecuta zoom.
7. Llama `actualizarGrafica`.
8. Actualiza leyenda.
9. Consulta fuente.
10. Sincroniza estado global.

Esto provoca que una sola seleccion de departamento, municipio o subcapa pueda disparar varias consultas ArcGIS consecutivas sobre la misma capa y el mismo filtro.

## Problemas detectados

| Problema | Ubicacion | Impacto | Observacion |
|---|---|---:|---|
| `cargarCapaActual` recrea capas en cada cambio | `main.js` | Alto | Siempre hace `clearLayers()` y `new FeatureLayer`, aun si la capa y filtro no cambiaron. |
| Mapa y grafico consultan la misma fuente por separado | `main.js`, `charts/*` | Alto | La capa usa `queryExtent`; luego el grafico usa `queryFeatures` con el mismo `whereBase`. |
| Leyenda consulta otra vez despues del mapa/grafico | `main.js`, `biofisicoLegend.renderer.js` | Alto | `updateLegendByExtent` depende de `queryFeatures` por extension/campos. |
| `fetchLayerSource` consulta la capa cada vez | `biofisicoQuery.service.js` | Medio | Usa `queryFeatures({ where: "1=1", outFields: ["Fuente"], num: 1 })` por carga. Puede cachearse por URL. |
| `fetchMunicipalityInfo` usa `outFields: "*"` | `biofisicoQuery.service.js` | Medio | Solo deberia pedir campos usados por resumen/textos si se identifican. |
| Variantes crean varias capas a la vez | `main.js`, bloque `config.variants` | Alto | En geoformas/cuencas se crean varias `FeatureLayer`; solo una queda visible. |
| Watchers pueden disparar recalculos repetidos | `main.js`, `ui/time-slider.js` | Medio | `view.watch("scale")`, `view.watch("stationary")` y slider pueden repetir leyenda/grafico. |
| No hay cache central de queries | `data.js`, `services/*`, `charts/*` | Alto | Cada handler decide consultar de nuevo. |
| No hay cancelacion real de requests REST | `data.js` | Medio | Existe `renderCycleId` para ignorar respuestas antiguas, pero `fetch` no usa `AbortController`. |
| Lazy loading incompleto de graficos | `main.js`, `charts/chartRegistry.js` | Medio | El registry importa todos los handlers al cargar el modulo. |
| `main.js` mantiene router de graficos duplicado/parcial | `main.js`, `charts/chartController.js` | Medio | Existe `chartController.js`, pero `main.js` aun contiene `buildCtx`, `defaultQueryAndRenderHandler`, `HANDLERS` y `actualizarGrafica`. |

## Consultas duplicadas encontradas

### Seleccion municipio/departamento

Flujo actual probable:

1. `handleMunicipioSelectChange` o `handleDepartamentoSelectChange`.
2. `cargarCapaActual`.
3. `newLayer.queryExtent({ where: whereBase })`.
4. `actualizarGrafica(newLayer, config)`.
5. Handler de grafico ejecuta `queryFeatures` o `arcRestQuery`.
6. `updateLegendByExtent(newLayer, config)` ejecuta otra consulta para leyenda.
7. `fetchLayerSource(newLayer)` ejecuta otra consulta para fuente.

Resultado: una sola seleccion puede disparar 3 a 5 consultas al mismo servicio.

### Graficos

Patron repetido:

- `charts/relief/hypsometry.chart.js`
- `charts/climate/climates.chart.js`
- `charts/threatening-phenomena/*.chart.js`
- `charts/soils/*.chart.js`
- `charts/climate/climate-stacked.utils.js`

Varios handlers usan:

- `layer.createQuery()`
- `query.outFields = ctx.config.outFields`
- `query.returnGeometry = false`
- `layer.queryFeatures(query)`

Eso es correcto para graficos, pero se duplica cuando la misma informacion ya fue consultada para otra parte del ciclo.

### Estadisticas REST

`data.js` contiene:

- `arcRestQuery`
- `fetchBF3Stats`
- `fetchGroupedStats`

Estos ya usan `returnGeometry: "false"`, lo cual es positivo. Falta cache por `layerUrl + where + statistics`.

## Capas o servicios potencialmente mas pesados

| Grupo | Capas/configuracion | Motivo de peso |
|---|---|---|
| Geoformas | `config.variants`, MapServer 8/9 | Multiples capas por escala, diccionarios de renderer, leyenda por extension. |
| Cuencas hidrograficas | Variantes 19/20/21 | Varias capas y etiquetado dependiente de escala. |
| Ecosistemas | Ecosistemas y deforestacion | Campos categoricos, periodos, slider temporal. |
| Suelos | Orden, vocacion, conflictos | Graficos duales/bubble y diccionarios de renderer. |
| Fenomenos amenazantes | Inundaciones, remocion, degradacion, sismica | Varios handlers consultan features para grafico. |
| Clima | Temperatura, precipitacion, cambio CC | Series por periodo, time slider y consultas repetidas por periodo. |

## Funciones que disparan demasiadas consultas

| Funcion | Archivo | Consultas o redibujos asociados | Prioridad |
|---|---|---|---:|
| `cargarCapaActual` | `main.js` | Crea capa, consulta extent, grafico, leyenda, fuente | Alta |
| `actualizarGrafica` | `main.js` | Router de handlers, `queryFeatures`, REST statistics | Alta |
| `defaultQueryAndRenderHandler` | `main.js` / `charts/chartController.js` | `queryFeatures` para fallback general | Alta |
| `updateLegendByExtent` | `main.js` | Query de leyenda por extent/campos | Alta |
| `fetchLayerSource` | `services/biofisicoQuery.service.js` | Consulta fuente en cada carga | Media |
| `handleTimeSliderInput` | `ui/time-slider.js` | Cambia filtro y re-renderiza grafico | Media |
| `setActiveVariantLayerByScale` | `main.js` | Cambia variante, actualiza leyenda y grafico | Media |
| `filtrarPorAtributo` / filtros de grafico | `map/filters.js` | `queryExtent` por click de grafico/leyenda | Media |

## Estrategia para acelerar mapa

### 1. Cachear capas activas por clave

Crear un cache temporal en `map/biofisicoLayerCache.service.js` o `map/biofisicoMap.renderer.js`.

Clave sugerida:

```text
mode | config.id | layerUrl | whereBase | variantKey
```

Uso:

- Si la misma capa y filtro siguen activos, no recrear `FeatureLayer`.
- Si cambia solo el filtro, actualizar `definitionExpression`.
- Si cambia capa o modulo, destruir solo capas anteriores de Biofisico.

Riesgo: medio. Debe cuidarse que leyenda, filtros y estaciones no queden apuntando a una capa vieja.

### 2. Evitar `clearLayers()` agresivo cuando no hay cambio real

Antes de limpiar:

- Comparar `activeLayerKey`.
- Comparar `whereBase`.
- Comparar `currentMode`.
- Comparar `currentSubLayerIndex`.

Si no cambian, omitir recreacion de capa y solo refrescar controles necesarios.

Riesgo: medio.

### 3. Aplicar filtro desde la creacion de capa

Esto ya se hace con:

```js
definitionExpression: buildDefinitionExpression({ baseWhere: whereBase })
```

Debe mantenerse como regla. No crear capas sin filtro cuando hay municipio/departamento.

Riesgo: bajo.

### 4. Separar zoom de carga de datos

Mantener `queryExtent({ where })`, pero:

- Cachear extent por `layerUrl + whereBase`.
- No repetir zoom si el usuario ya esta en la misma seleccion.
- Ignorar respuestas antiguas con `renderCycleId`.
- En una fase posterior, usar `AbortController` en REST y `cancelled` guards en ArcGIS.

Riesgo: bajo a medio.

### 5. Optimizar variantes

Para `config.variants`:

- No crear todas las variantes si no son necesarias inicialmente.
- Crear primero solo la variante que corresponde a la escala actual.
- Lazy load de la segunda variante cuando cambia la escala.
- Mantener cache por `variantKey`.

Riesgo: alto, porque geoformas/cuencas dependen de escala, labels y grafico.

## Estrategia para acelerar graficos

### 1. Centralizar cache de queries de grafico

Crear `services/biofisicoQueryCache.service.js`.

Clave:

```text
queryType | layerUrl | where | outFields | groupBy | statistics
```

TTL sugerido:

- 5 minutos durante la sesion.
- Invalidar al cambiar municipio, departamento, capa, periodo o leyenda.

Riesgo: medio.

### 2. Reutilizar features entre mapa y grafico

Cuando `actualizarGrafica` usa la misma capa/filtro:

- Consultar features una sola vez con `returnGeometry: false`.
- Entregar resultado al renderer del grafico y a leyenda si los campos coinciden.
- Si la leyenda necesita campos distintos, hacer consulta separada pero cacheada.

Riesgo: medio-alto por variedad de graficos.

### 3. Lazy loading de handlers

Actualmente `chartRegistry.js` importa todos los handlers.

Propuesta:

- Convertir registry a imports dinamicos por grupo:
  - `RELIEVE`
  - `CLIMA`
  - `HIDROGRAFIA`
  - `ECOSISTEMAS`
  - `SUELOS`
  - `FENOMENOS`
- Cargar solo handlers del modo activo.
- Precargar en segundo plano el siguiente grupo solo si no afecta interaccion.

Riesgo: medio.

### 4. Evitar redibujos si los datos no cambiaron

Guardar `lastChartKey`:

```text
config.id | whereBase | period | legendFilter | chartVariantKey
```

Si no cambia:

- No destruir ni recrear Chart.js.
- Solo actualizar titulo/resumen si aplica.

Riesgo: bajo-medio.

## Estrategia de cache

### Cache propuesto

| Cache | Clave | Valor | Invalida cuando |
|---|---|---|---|
| `layerCache` | `layerUrl + where + variantKey` | `FeatureLayer` | cambia capa/filtro o limpieza total |
| `extentCache` | `layerUrl + where` | `Extent` | cambia filtro territorial |
| `queryCache` | `url + where + outFields + stats` | features/rows | cambia capa, filtro, periodo |
| `rendererCache` | `layerUrl` | renderer/diccionarios | rara vez; cache por sesion |
| `sourceCache` | `layerUrl` | texto fuente | nunca durante sesion |
| `municipalityInfoCache` | `mpcodigo` | atributos resumen | cambia municipio |

### Politicas

- Cache en memoria, no `localStorage`.
- TTL corto para queries de datos: 5 minutos.
- Sin TTL para renderer/fuente durante sesion.
- Limite de entradas: 100-200 claves para evitar crecimiento indefinido.
- Exponer `clearBiofisicoCache()` solo para debugging o refresh.

## Estrategia de lazy loading

1. Cargar al inicio solo:
   - mapa base,
   - diccionario territorial,
   - modo inicial `RELIEVE`,
   - capa activa cuando exista filtro.

2. Diferir:
   - handlers de graficos no activos,
   - diccionarios de geoformas/vocacion/orden suelo,
   - estaciones clima,
   - variantes de escala no visibles,
   - datos de fuente hasta que la capa ya este visible.

3. Preload opcional:
   - cuando el usuario abre un menu, precargar solo configuracion/handlers de ese grupo.

## Manejo de concurrencia y respuestas antiguas

Ya existe `renderCycleId`, pero debe formalizarse:

- Incrementar ciclo una sola vez por seleccion/carga.
- Propagar `cycleId` a mapa, grafico y leyenda.
- Cada promesa debe validar si sigue siendo el ciclo activo antes de pintar.
- Para `fetch` REST usar `AbortController`.
- Para ArcGIS `queryFeatures/queryExtent`, mantener guards de `destroyed`, `renderCycleId` y `layerGlobal`.

## Loading states

Agregar estados visuales livianos sin bloquear:

- `mapLoading`: capa consultando/zoom.
- `chartLoading`: grafico consultando.
- `legendLoading`: leyenda consultando.

Reglas:

- Mostrar "Cargando..." si la consulta supera 250 ms.
- Si responde rapido, no mostrar spinner para evitar parpadeos.
- En error, mostrar mensaje claro en grafico/resumen sin romper mapa.

## Cambios propuestos por fases

### Fase 1 - Medicion y guardas de no repeticion

Cambios:

- Agregar mediciones con `performance.now()` alrededor de:
  - `cargarCapaActual`
  - `queryExtent`
  - `actualizarGrafica`
  - `updateLegendByExtent`
  - `fetchLayerSource`
- Crear `activeRenderKey`.
- Si `activeRenderKey` no cambia, no recrear capa.

Riesgo: bajo.

Validaciones:

- Seleccionar departamento.
- Seleccionar municipio.
- Cambiar subcapa Relieve.
- Confirmar que Hipsometria renderiza igual.
- Confirmar sin errores en consola.

### Fase 2 - Cache de fuente, renderer y municipios

Cambios:

- Cachear `fetchLayerSource(layer)` por `layer.url`.
- Cachear diccionarios de renderer en `biofisicoLayer.service.js`.
- Cachear `fetchMunicipalityInfo(codigo)`.

Riesgo: bajo.

Validaciones:

- Texto/resumen sigue correcto.
- Fuente del mapa aparece igual.
- No se repite request de fuente al volver a la misma capa.

### Fase 3 - Cache de extent y queries sin geometria

Cambios:

- Crear `biofisicoQueryCache.service.js`.
- Cachear:
  - `queryExtent`
  - `queryFeatures` con `returnGeometry=false`
  - `arcRestQuery`
- Incluir TTL y limite.

Riesgo: medio.

Validaciones:

- Seleccionar mismo municipio dos veces no repite consultas pesadas.
- Cambiar municipio invalida el cache correcto.
- Cambiar periodo en clima/deforestacion consulta solo si cambia periodo.

### Fase 4 - Reducir duplicidad mapa-grafico

Cambios:

- `cargarCapaActual` debe producir un `renderPayload`:
  - `layer`
  - `config`
  - `whereBase`
  - `extent`
  - `chartFeatures` si ya fueron consultadas
- `actualizarGrafica` acepta datos precargados opcionales.

Riesgo: medio-alto.

Validaciones:

- Hipsometria, pendientes y geoformas.
- Clima con slider.
- Suelos y fenomenos.
- Graficos vacios muestran mensaje claro.

### Fase 5 - Lazy loading de graficos

Cambios:

- Convertir `chartRegistry.js` a carga por grupo.
- Main solo pide handlers del `currentMode`.
- Precargar grupo al hover/click de menu si hace falta.

Riesgo: medio.

Validaciones:

- Cada categoria carga su grafico al primer uso.
- Segundo uso de la categoria debe ser mas rapido.
- Sin errores por imports dinamicos.

### Fase 6 - Optimizar variantes de mapa

Cambios:

- Crear solo variante visible segun escala inicial.
- Cargar la otra variante bajo demanda.
- Cachear variantes por `config.id + variantKey + whereBase`.

Riesgo: alto.

Validaciones:

- Geoformas cambia por escala.
- Cuencas mantiene labels.
- Leyenda corresponde a variante activa.
- Grafico usa la variante correcta.

### Fase 7 - Cancelacion y timeouts

Cambios:

- Agregar `AbortController` en `arcRestQuery`.
- Timeout configurable por servicio.
- Ignorar respuestas antiguas con `cycleId`.
- Debounce en selectores de departamento/municipio.

Riesgo: medio.

Validaciones:

- Cambiar municipio rapidamente no deja capas viejas.
- No aparece grafico de seleccion anterior.
- No quedan errores no controlados en consola.

## Validaciones generales por fase

Cada fase debe validar:

- Carga inicial de `biofisico.html`.
- Seleccion de departamento.
- Seleccion de municipio.
- Zoom a municipio.
- Render de Hipsometria.
- Cambio entre Relieve, Clima, Hidrografia, Ecosistemas, Suelos y Fenomenos.
- Leyenda visible y filtrable.
- Texto/resumen descriptivo.
- Time slider en capas temporales.
- Sin errores en consola.
- Sin afectar `limites.html`, `limites2.html`, `ordenamiento.html` ni Socioeconomico.

## Indicadores de mejora esperados

| Indicador | Estado actual estimado | Meta |
|---|---:|---:|
| Requests por seleccion simple | 3 a 5 | 1 a 3 |
| Recreacion de capa si no cambia filtro | Si | No |
| Query de fuente por misma capa | Repetida | Cacheada |
| Query de grafico repetida | Frecuente | Cacheada/reutilizada |
| Imports de graficos al inicio | Todos | Solo grupo activo |
| Respuestas antiguas | Ignoradas parcialmente | Ignoradas/canceladas |

## Riesgos

- Cache mal invalidado puede mostrar datos de otro municipio o periodo.
- Reutilizar features entre mapa/grafico puede fallar si el grafico necesita campos distintos.
- Lazy loading de graficos puede romper handlers si dependen de variables globales de colores.
- Optimizar variantes por escala puede afectar geoformas/cuencas.
- Reducir `clearLayers()` puede dejar estaciones o capas auxiliares visibles si no se controla bien.

## Recomendacion de inicio

Empezar por fases 1 y 2:

1. Medir tiempos reales.
2. Evitar recreacion cuando no cambia `activeRenderKey`.
3. Cachear fuente, renderer y municipio.

Estas fases tienen bajo riesgo y deberian mejorar la percepcion de velocidad sin alterar graficos, servicios ni leyendas.

Despues avanzar a cache de queries y reduccion de duplicidad mapa-grafico, que son los cambios con mayor impacto pero tambien mayor riesgo.

## Registro de ejecucion

### Implementado - inicio de fases 1 y 2

- Se agrego cache en memoria para `arcRestQuery` en `data.js`.
- Se agrego deduplicacion de requests simultaneos y TTL de 5 minutos para consultas REST identicas.
- Se agrego cache para diccionario territorial en `biofisicoQuery.service.js`.
- Se agrego cache para `fetchMunicipalityInfo`.
- Se agrego cache para `fetchDistinctMunicipalityCodes`.
- Se agrego cache para `fetchLayerSource`.
- Se agrego funcion de limpieza `clearArcRestQueryCache`.
- Se agrego funcion de limpieza `clearBiofisicoQueryServiceCache`.
- Se agrego guarda en `cargarCapaActual` para no recrear capa si `currentMode`, subcapa, capa, filtro territorial y seleccion siguen iguales.

Validaciones ejecutadas:

- Sintaxis de todos los JS de `js/biofisico2`: OK.
- Import de `main.js`: OK.
- Prueba de cache `arcRestQuery`: dos consultas iguales producen un solo `fetch`.
- Prueba de cache de diccionario territorial: dos llamadas producen un solo `fetch`.

Pendiente siguiente:

- Medir tiempos reales con `performance.now`.
- Reducir duplicidad entre `cargarCapaActual`, `actualizarGrafica` y `updateLegendByExtent`.

### Implementado - avance de fase 3

- Se agrego `services/biofisicoArcgisCache.service.js`.
- Se agrego cache en memoria para `FeatureLayer.queryExtent`.
- Se agrego cache en memoria para `FeatureLayer.queryFeatures` cuando `returnGeometry=false`.
- Se conecto `cachedQueryExtent` en `main.js` para:
  - zoom de capa activa,
  - zoom de variantes,
  - zoom por grafico,
  - zoom de "ver todo".
- Se conecto `cachedQueryFeatures` en `main.js` para:
  - leyenda por extension,
  - handler generico de graficos.
- Se propago `cachedQueryFeatures` y `cachedQueryExtent` al contexto de graficos.
- Se actualizaron handlers especificos de `charts/` para usar `ctx.cachedQueryFeatures` con fallback directo.
- Se actualizo `map/filters.js` para usar `cachedQueryExtent` en filtros por rango/atributo.

Validaciones ejecutadas:

- Sintaxis de todos los JS de `js/biofisico2`: OK.
- Import de `main.js`: OK.
- HTTP local de `biofisico.html`, `main.js` y `biofisicoArcgisCache.service.js`: OK.
- Prueba de cache `cachedQueryFeatures`: dos consultas equivalentes producen una sola llamada a `queryFeatures`.
- Prueba de cache `cachedQueryExtent`: dos consultas equivalentes producen una sola llamada a `queryExtent`.

Pendiente siguiente:

- Reducir duplicidad entre mapa, grafico y leyenda reutilizando payloads.
- Evaluar lazy loading por grupo de graficos.
- Agregar cancelacion/timeout para `fetch` REST.

### Implementado - instrumentacion y timeout REST

- Se agrego `services/biofisicoPerformance.service.js`.
- Se registran metricas en memoria en `window.__biofisicoPerformanceMetrics`.
- Se puede activar logging con `window.__BIOFISICO_PERF__ = true`.
- Se instrumentaron consultas REST `arcRestQuery`.
- Se instrumentaron `cachedQueryFeatures`, `cachedQueryExtent` y cache hits.
- Se instrumentaron puntos clave de `cargarCapaActual`.
- Se instrumento `actualizarGrafica`.
- Se agrego timeout de 25 segundos a `arcRestQuery` con `AbortController`.

Validaciones ejecutadas:

- Sintaxis completa de JS: OK.
- Import de `main.js`: OK.
- Cache de FeatureLayer sigue deduplicando `queryFeatures` y `queryExtent`.
- `arcRestQuery` conserva cache y ahora corta requests colgados por timeout.

Pendiente siguiente:

- Reducir duplicidad entre mapa, grafico y leyenda reutilizando payloads.
- Evaluar lazy loading por grupo de graficos.
- Extender cancelacion/timeout a otros `fetch` directos si se confirma beneficio.

### Implementado - reutilizacion selectiva de payloads de graficos

- Se agrego una capa de acceso `ctx.queryFeatures` para los handlers de graficos.
- Los handlers de `charts/` que consultaban `layer.queryFeatures` ahora usan `ctx.queryFeatures` con fallback a `ctx.cachedQueryFeatures`.
- Se agrego prefetch selectivo de features en `cargarCapaActual` para graficos municipales que consumen la misma consulta filtrada de la capa activa.
- Se evita el prefetch en graficos con estadisticas REST, agregaciones departamentales y pendientes, para no disparar consultas extra.
- Se registra `queryFeatures.prefetchHit` cuando el grafico reutiliza el payload prefetched.

Impacto esperado:

- Menos consultas duplicadas entre renderizado de capa y renderizado de grafico.
- Mejor respuesta al cambiar municipio/capa cuando el grafico usa los mismos features filtrados.
- Menor riesgo de sobrecargar servicios ArcGIS porque el prefetch queda limitado a graficos que realmente consumen `queryFeatures`.

Pendiente siguiente:

- Revisar reutilizacion de datos para leyenda por extension.
- Evaluar lazy loading real de grupos de graficos.
- Extender cancelacion/timeout a `queryFeatures`/`queryExtent` si ArcGIS JS API lo permite de forma segura en esta version.

## Revision final contra codigo actual - 2026-06-11

### Estado real del plan

| Punto del plan | Estado | Evidencia en codigo | Decision |
|---|---|---|---|
| Medicion de tiempos | Implementado | `services/biofisicoPerformance.service.js`, metricas en `arcRestQuery`, `cachedQueryFeatures`, `cachedQueryExtent`, `actualizarGrafica`, `mapController` | Mantener |
| No recrear capa si no cambia seleccion | Implementado | `mapController` usa `activeLayerRenderKey` interno y reutiliza capa activa | Mantener |
| Cache REST | Implementado | `data.js` cachea `arcRestQuery` con TTL y timeout | Mantener |
| Cache `queryExtent` / `queryFeatures` sin geometria | Implementado | `services/biofisicoArcgisCache.service.js` | Mantener |
| Prefetch selectivo de features para graficos | Implementado | `mapQueryBuilder.createChartPrefetchQuery`, `chartController` usa `options.prefetchedFeatures` | Mantener |
| Cache de fuente y diccionarios territoriales | Implementado previamente | `services/biofisicoQuery.service.js` | Mantener |
| Reducir duplicidad mapa-grafico | Parcial | Prefetch cubre graficos basados en `queryFeatures`; leyenda sigue separada | No ampliar por ahora para evitar riesgo con campos de leyenda |
| Lazy loading de graficos por grupo | Pendiente | `chartRegistry.js` importa handlers estaticamente | Aplazar: riesgo medio por dependencias globales de colores y handlers |
| Optimizar variantes creando solo la visible | Pendiente | `mapController` crea todas las variantes configuradas | Aplazar: riesgo alto para geoformas/cuencas, labels y leyenda |
| Cancelacion ArcGIS `queryFeatures/queryExtent` | No aplicable directo | ArcGIS JS API no expone cancelacion uniforme en este uso actual | Mantener guards con `renderCycleId` y capa activa |
| Timeout/cancelacion REST | Implementado | `arcRestQuery` usa `AbortController` | Mantener |

### Optimizaciones seguras restantes

1. Exponer una limpieza central de caches Biofisico para el boton refrescar y recargas manuales.
2. Evitar `layer.refresh()` innecesario en `chartController.syncMapLayer` cuando `definitionExpression` no cambia.
3. Registrar metricas de cache clear/refresh para diagnostico.

### Optimizaciones aplazadas

- Lazy loading dinamico de graficos por grupo.
- Cache/reutilizacion de payloads para leyenda por extension.
- Creacion lazy de variantes por escala.

Estas tres quedan aplazadas porque pueden afectar render de graficos, leyendas o mapa por escala; requieren una fase dedicada con validacion visual completa en navegador real.

### Implementado - cierre de optimizacion segura

- Se agrego `services/biofisicoCache.service.js` como punto central de limpieza de caches runtime.
- `limpiarBusqueda()` ahora limpia:
  - cache REST de `arcRestQuery`,
  - cache ArcGIS de `queryExtent`/`queryFeatures`,
  - cache de diccionarios/fuente/municipio.
- La limpieza de cache solo se ejecuta en refresh manual para no perder beneficios durante navegacion normal.
- `chartController.syncMapLayer` ya no ejecuta `layer.refresh()` si `definitionExpression` no cambio.

Validaciones ejecutadas:

- Sintaxis completa de `js/biofisico2`: OK.
- HTTP local de `biofisico.html`: OK.
- Prueba de `clearBiofisicoRuntimeCaches`: OK.
- Prueba focal de `chartController.syncMapLayer`: no refresca cuando el filtro no cambia y conserva visibilidad/opacidad.

Estado final:

- Optimizaciones de bajo riesgo terminadas.
- Optimizaciones de riesgo medio/alto quedan documentadas para fase posterior con navegador real.

### Implementado - optimizacion de renderizado de servicios en mapa

- `mapController` ahora diferencia entre:
  - cambio real de estructura de capa,
  - cambio de filtro territorial sobre la misma capa simple.
- Si el usuario cambia departamento/municipio manteniendo la misma capa simple, ya no se ejecuta `clearLayers()` ni se crea un nuevo `FeatureLayer`.
- En ese caso se reutiliza la capa existente y solo se actualiza `definitionExpression`.
- La optimizacion se limita a capas sin `variants`; geoformas/cuencas/ecosistemas con variantes por escala conservan el flujo anterior por estabilidad.
- `queryExtent`/`goTo` se inician sin bloquear el render del grafico, manteniendo guards por `renderCycleId` y capa activa.
- El grafico y la leyenda siguen recibiendo el filtro actualizado.

Validaciones ejecutadas:

- Sintaxis completa de `js/biofisico2`: OK.
- HTTP local de `biofisico.html`: OK.
- Prueba focal de reutilizacion de capa simple: dos renders sobre la misma capa producen un solo `clearLayers()`.
- Prueba focal de zoom/grafico en capa reutilizada: se disparan `queryExtent` y `actualizarGrafica` con el nuevo filtro.

Impacto esperado:

- Menos destruccion/recreacion de capas al cambiar departamento o municipio dentro de la misma opcion biofisica.
- Menor tiempo hasta ver la capa filtrada, porque ArcGIS reutiliza la instancia de `FeatureLayer`.
- Menor bloqueo percibido, porque el grafico no espera a que termine el zoom.
