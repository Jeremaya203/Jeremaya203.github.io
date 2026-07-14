# Analisis de archivos huerfanos - Biofisico

Fecha: 2026-06-11  
Alcance revisado: `biofisico.html` y `js/biofisico2/`  
Regla aplicada: no eliminar por sospecha; se revisaron imports, nombres exportados, usos por `window`, referencias textuales y logica equivalente en `main.js`.

## Resumen ejecutivo

| Archivo | Decision recomendada | Motivo principal | Accion propuesta |
|---|---|---|---|
| `services/biofisicoTerritory.loader.js` | Integrar, no eliminar | Encapsula carga territorial equivalente a funciones aun inline en `main.js` | Integrar en fase controlada con contexto/estado |
| `map/biofisicoPopup.renderer.js` | No aplica: archivo ausente | El archivo no existe actualmente en la carpeta | Crear solo cuando se extraiga popup real |
| `state/biofisico.context.js` | Integrar, no eliminar | Sirve para desacoplar estado global, pero requiere migracion amplia | Integrar despues de estabilizar `AppState` |
| `charts/chartController.js` | Integrado | Duplica parcialmente el router de graficos actual de `main.js` | Conectado desde `main.js`; router inline retirado |
| `ui/biofisicoTerritory.renderer.js` | Integrar junto con loader | Solo lo usa el loader, pero contiene render territorial reutilizable | Mantener y conectar desde loader |
| `utils/biofisicoDom.utils.js` | Eliminado | Utilidades minimas sin imports ni ventaja real hoy | Archivo eliminado |
| `charts/threatening-relationship/*.chart.js` | Eliminado | Archivos placeholder, sin handlers reales ni imports | 4 archivos eliminados |

## Acciones aplicadas

- Se elimino `utils/biofisicoDom.utils.js`.
- Se eliminaron los cuatro placeholders de `charts/threatening-relationship/`.
- Se integro `charts/chartController.js` desde `main.js`.
- Se retiro de `main.js` la logica inline equivalente a:
  - `buildCtx`
  - `syncMapLayer`
  - `defaultQueryAndRenderHandler`
  - construccion manual de `deps`
  - `HANDLERS`
  - `actualizarGrafica`
- Se mantuvo un adaptador local `chartControllerContext` en `main.js` para evitar migrar todo el estado global de una sola vez.

## Detalle por archivo

### 15. `services/biofisicoTerritory.loader.js`

- Estado actual: existe, exporta `createTerritoryLoader(ctx, dependencies)`.
- Referencias encontradas:
  - No tiene imports desde archivos ejecutables.
  - Importa `biofisicoQuery.service.js`, `config.js`, `biofisicoFormat.utils.js`, `ui/biofisicoTerritory.renderer.js`, `biofisicoNavigation.events.js` y `ui.helpers.js`.
  - Aparece mencionado en reportes/planes, pero no en ejecucion.
- Logica equivalente en `main.js`:
  - `cargarDiccionarioMunicipios`
  - `cargarInfoMunicipio`
  - `cargarMunicipios`
  - `cargarDepartamentos`
  - `renderizarMunicipios`
  - partes de seleccion territorial y reset de filtros.
- Decision recomendada: integrar.
- Justificacion: representa una responsabilidad clara y reduce `main.js`; no es basura, es una extraccion preparada pero desconectada.
- Riesgo de eliminarlo: medio. Se perderia trabajo util de modularizacion y habria que recrear el loader territorial.
- Riesgo de integrarlo: medio-alto. Actualmente asume un `ctx` con getters/setters y mezcla todavia referencias de otros modulos (`ORDENAMIENTO`, `LIMITES`) dentro de `applyInitialModuleFromURL`, algo que no debe entrar en Biofisico limpio.
- Accion propuesta:
  - Integrarlo solo despues de conectar `state/biofisico.context.js`.
  - Antes de integrar, eliminar de este loader las rutas de `ORDENAMIENTO` y `LIMITES`, o dejarlas fuera del flujo de Biofisico.
  - Reemplazar en `main.js` las funciones territoriales inline por metodos del loader en una fase pequena y verificable.

### 16. `map/biofisicoPopup.renderer.js`

- Estado actual: no existe en `js/biofisico2/map/`.
- Referencias encontradas:
  - No hay imports reales.
  - Aparece solo en reportes/planes como destino propuesto.
- Logica equivalente en `main.js`:
  - El popup/capa de estaciones hoy se gestiona mediante `createBiofisicoStationsLayer(...)` y `ensureStationsLayer`.
- Decision recomendada: no eliminar; no hay archivo que eliminar.
- Justificacion: es un archivo esperado por la arquitectura, pero actualmente ausente.
- Riesgo de eliminarlo: ninguno, porque no existe.
- Riesgo de integrarlo/crearlo: bajo-medio si se extrae solo render de popup; medio si se mueve tambien la capa de estaciones.
- Accion propuesta:
  - Crear `map/biofisicoPopup.renderer.js` en una fase futura solo si se mueve `buildStationsPopupContent` o la logica equivalente desde el servicio/capa actual.
  - No crear archivo vacio.

### 17. `state/biofisico.context.js`

- Estado actual: existe, exporta `createBiofisicoContext()` y `STATE_PROPS`.
- Referencias encontradas:
  - No importado por codigo ejecutable.
  - Depende de `../app/state.js`.
  - Mencionado en reportes/planes.
- Logica equivalente en `main.js`:
  - Variables globales/locales como `currentMode`, `whereBase`, `municipioActual`, `deptoActual`, `layerGlobal`, `chartInstance`, `renderCycleId`, etc.
- Decision recomendada: integrar.
- Justificacion: es clave para reducir variables globales y permitir que controladores, servicios, mapa y graficos compartan estado sin copiar datos.
- Riesgo de eliminarlo: medio. Se perderia una pieza util para desmontar el monolito.
- Riesgo de integrarlo: alto. Migrar estado puede romper seleccion, filtros, zoom, graficos y leyendas si se hace de una sola vez.
- Accion propuesta:
  - No conectarlo masivamente todavia.
  - Primera fase segura: usarlo solo como adaptador de lectura para `chartController.js` o `biofisicoTerritory.loader.js`, sin reemplazar todas las variables de `main.js`.
  - Segunda fase: migrar grupos de estado por responsabilidad: territorial, mapa, graficos, leyenda.

### 18. `charts/chartController.js`

- Estado actual: existe, exporta `createChartController(mainDeps)`.
- Referencias encontradas:
  - No importado por codigo ejecutable.
  - Importa `chartRenderer.js`, `chartRegistry.js`, `chartOptions.js`.
  - Mencionado en reportes/planes.
- Logica equivalente en `main.js`:
  - `buildCtx`
  - `syncMapLayer`
  - `defaultQueryAndRenderHandler`
  - construccion de `deps`
  - `HANDLERS`
  - `actualizarGrafica`
- Decision recomendada: integrar.
- Justificacion: es el mejor candidato para reducir `main.js` de forma visible. La responsabilidad es clara y coincide con el objetivo de dejar `main.js` como orquestador.
- Riesgo de eliminarlo: alto. Contiene una extraccion real de graficos que ya refleja gran parte del router actual.
- Riesgo de integrarlo: alto. El `main.js` actual ya evoluciono con cache, metricas y prefetch; `chartController.js` puede estar ligeramente desactualizado frente al router inline.
- Accion propuesta:
  - Actualizar `chartController.js` para recibir `measureBiofisicoAsync`, `recordBiofisicoMetric` y la firma de prefetch usada actualmente.
  - Conectar `createChartController(...)` desde `main.js`.
  - Retirar de `main.js` solo cuando `actualizarGrafica` externo reproduzca exactamente el comportamiento actual.
  - Validar cada grupo de graficos despues de conectar.

### 19. `ui/biofisicoTerritory.renderer.js`

- Estado actual: existe, exporta `renderDepartamentosSelect` y `renderMunicipiosSelect`.
- Referencias encontradas:
  - Solo importado por `services/biofisicoTerritory.loader.js`.
  - No importado directamente por `main.js`.
- Logica equivalente en `main.js`:
  - `cargarDepartamentos`
  - `renderizarMunicipios`
- Decision recomendada: integrar junto con `biofisicoTerritory.loader.js`.
- Justificacion: aunque hoy depende de un loader desconectado, su responsabilidad es clara y reemplaza render DOM inline.
- Riesgo de eliminarlo: medio. Es util si se integra el loader territorial.
- Riesgo de integrarlo: bajo-medio. Debe respetar IDs existentes: `departamentos` y `municipios`.
- Accion propuesta:
  - Mantener.
  - Ajustar textos con encoding correcto si se toca.
  - Conectarlo solo a traves del loader para no duplicar render de selects.

### 20. `utils/biofisicoDom.utils.js`

- Estado actual: existe, exporta `byId`, `setText`, `setHtml`.
- Referencias encontradas:
  - No importado por codigo ejecutable.
  - No hay referencias a `byId`, `setText` ni `setHtml` fuera del propio archivo.
- Logica equivalente en `main.js`:
  - Uso directo y disperso de `document.getElementById`, `textContent` e `innerHTML`.
- Decision recomendada: eliminar si se busca limpieza inmediata; integrar solo si se inicia una fase DOM.
- Justificacion: el archivo es demasiado pequeno y generico; mantenerlo desconectado no reduce `main.js`.
- Riesgo de eliminarlo: bajo. No hay imports ni uso indirecto detectado.
- Riesgo de integrarlo: bajo, pero con beneficio bajo si solo reemplaza tres helpers.
- Accion propuesta:
  - Opcion recomendada para limpieza: eliminarlo.
  - Si se decide integrarlo, hacerlo junto con una extraccion real de UI/DOM; no conectarlo solo para justificar su existencia.

### 21. `charts/threatening-relationship/floods-relation.chart.js`

- Estado actual: existe, exporta un objeto constante `floodsRelationChart`.
- Referencias encontradas:
  - No importado por `chartRegistry.js`.
  - No importado por `chartController.js`.
  - No aparece en `main.js`.
  - No hay configuracion activa que use `rel_inundaciones`.
- Decision recomendada: eliminar.
- Justificacion: es placeholder, no handler de Chart.js, no consulta datos y no participa en la ejecucion.
- Riesgo de eliminarlo: bajo.
- Riesgo de integrarlo: medio. Integrarlo requeriria disenar funcionalidad nueva de relaciones, no solo conectar un archivo.
- Accion propuesta: eliminar en fase de limpieza.

### 22. `charts/threatening-relationship/mass-removal-hazard-relation.chart.js`

- Estado actual: existe, exporta `massRemovalHazardRelationChart`.
- Referencias encontradas:
  - Sin imports desde registro/controlador/main.
  - No hay uso de `rel_remocion_masa`.
- Decision recomendada: eliminar.
- Justificacion: placeholder sin logica de grafico.
- Riesgo de eliminarlo: bajo.
- Riesgo de integrarlo: medio.
- Accion propuesta: eliminar en fase de limpieza.

### 23. `charts/threatening-relationship/soil-degradation-relation.chart.js`

- Estado actual: existe, exporta `soilDegradationRelationChart`.
- Referencias encontradas:
  - Sin imports desde registro/controlador/main.
  - No hay uso de `rel_degradacion_suelo`.
- Decision recomendada: eliminar.
- Justificacion: placeholder sin logica de grafico.
- Riesgo de eliminarlo: bajo.
- Riesgo de integrarlo: medio.
- Accion propuesta: eliminar en fase de limpieza.

### 24. `charts/threatening-relationship/expected-seismic-intensity-relation.chart.js`

- Estado actual: existe, exporta `expectedSeismicIntensityRelationChart`.
- Referencias encontradas:
  - Sin imports desde registro/controlador/main.
  - No hay uso de `rel_intensidad_sismica`.
- Decision recomendada: eliminar.
- Justificacion: placeholder sin logica de grafico.
- Riesgo de eliminarlo: bajo.
- Riesgo de integrarlo: medio.
- Accion propuesta: eliminar en fase de limpieza.

## Orden sugerido de accion

1. Eliminar los cuatro placeholders de `charts/threatening-relationship/`.
2. Eliminar `utils/biofisicoDom.utils.js` solo si no se va a iniciar una fase DOM inmediatamente.
3. Integrar `charts/chartController.js` para sacar de `main.js` el router de graficos.
4. Integrar `state/biofisico.context.js` de forma incremental.
5. Integrar `services/biofisicoTerritory.loader.js` + `ui/biofisicoTerritory.renderer.js`.
6. Crear `map/biofisicoPopup.renderer.js` solo cuando se extraiga popup real.

## Validacion recomendada antes de eliminar

- Ejecutar busqueda final:
  - `rg -n "floodsRelationChart|massRemovalHazardRelationChart|soilDegradationRelationChart|expectedSeismicIntensityRelationChart|rel_inundaciones|rel_remocion_masa|rel_degradacion_suelo|rel_intensidad_sismica" js/biofisico2 biofisico.html`
  - `rg -n "byId\\(|setText\\(|setHtml\\(|biofisicoDom\\.utils" js/biofisico2 biofisico.html`
- Ejecutar sintaxis JS completa.
- Cargar `biofisico.html`.
- Validar seleccion departamento/municipio y grafico de Hipsometria.
