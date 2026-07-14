# Plan de Limpieza — Componente Límites (`js/limites/`)

**Fecha:** 2026-06-11  
**Objetivo:** Eliminar código muerto, código heredado de Biofísico y Ordenamiento, y dejar el componente Límites independiente y mantenible.

---

## 1. Archivos conectados a `limites.html`

`limites.html` carga un único script propio:

```html
<script type="module" src="./js/limites/main.js"></script>
```

**No hay otros scripts JS propios.** Las dependencias externas son:
- ArcGIS JS API 4.29 (`js.arcgis.com`)
- Chart.js 4.4.0 + Hammer.js + chartjs-plugin-zoom (CDN)

---

## 2. Árbol real de dependencias desde `main.js`

```
main.js
├── ./map/layer-loader.js          → createMunicipiosLayer, createDepartamentosLayer
├── ./map/overview.js              → initOverview
├── ./map/scale.js                 → initScaleBar
├── ./map/map.controls.js          → initMapControls
│   └── ./zoom.js                  → resetToColombia
├── ./ui/dropdowns.js              → initModuleDropdown, initDropdownDescargables
├── ./ui/ui.helpers.js             → updateMapViewBadge, setLegendLayerTitle
├── ./ui/summary.js                → actualizarResumen
│   └── ../utils.js                → escapeHtml
├── ./ui/legend.ui.js              → actualizarLeyendaDepartamentosLimites, toggleLegend
│   └── ../utils.js                → escapeAttr, escapeHtml
├── ./app/state.js                 → AppState
├── ./app/layer-state.js           → getActiveLayerConfig, getLayerListForCurrentLevel
│   └── ../config.js               → LAYERS_CONFIG, DEPTO_ONLY_LAYER_IDS
├── ./map/layers.js                → clearLayers (as clearMapLayers)
│   └── ../app/state.js            → AppState
├── ./map/map.core.js              → createMainMap
│   └── ../app/state.js            → AppState
├── ./config.js                    → LIMITES_CONFIG
├── ./utils.js                     → debounce, escapeHtml, sqlEquals, sqlStartsWith, normalizeCode, rgbaArrayToCss
├── ./legend.js                    → actualizarLeyendaLimitesMunicipales
├── ./data/territorial.js          → cargarDiccionarioDesdeApi
├── ./chart/municipios/chart.js    → renderChart (as renderChartMunicipios)
│   ├── ../chart.core.js           → createChart
│   └── ../chart.helpers.js        → defaultBarOptions, buildDataset
└── ./chart/departamentales/chart.js → renderChart (as renderChartDepartamentos)
    ├── ../chart.core.js           → createChart
    └── ../chart.helpers.js        → defaultBarOptions, buildDataset
```

### Archivos en `js/limites/` **NO conectados** al árbol (huérfanos):

| Archivo | Motivo |
|---|---|
| `data.js` | No importado por nadie |
| `map/filters.js` | No importado por nadie |
| `map/map.helpers.js` | No importado por nadie |
| `modules/limites/limites-municipales.loader.js` | No importado por nadie (duplicado de `layer-loader.js` + lógica en `main.js`) |

---

## 3. Auditoría de responsabilidades por archivo

### 3.1 `main.js` (641 líneas)
- **Qué hace:** Punto de entrada. Inicializa mapa ArcGIS, dropdowns, controles, carga municipios/departamentos, renderiza capas de Límites y gráficas.
- **¿Pertenece a Límites?** ✅ Sí, es el core del componente.
- **¿Código mezclado?** ⚠️ Sí. Contiene:
  - Lógica de **Time Slider** (líneas 176-276) heredada de Biofísico (capas con períodos temporales).
  - `cargarInfoMunicipio()` (línea 363) consulta un endpoint de Biofísico (`componentebiofisico/MapServer/40`) — no se usa en Límites.
  - `getFieldDomainLabel()`, `buildRuralPaletteFromRenderer()`, `highlightWhere()` — funciones de Biofísico sin uso real en Límites.
  - `onViewStop` debounce (línea 280) definido pero **nunca conectado a ningún evento**.
  - Variables `timeSliderWrap`, `timeSlider`, `timeSliderLabel` obtenidas del DOM pero los elementos no existen en `limites.html`.
  - `window.redirigir` (línea 629) — función para navegación entre módulos, pero en Límites no se usa (no hay enlaces que la llamen).

### 3.2 `config.js` (876 líneas)
- **Qué hace:** Exporta configuraciones de capas.
- **¿Pertenece a Límites?** ⚠️ Parcialmente. Solo `LIMITES_CONFIG` (líneas 743-788) pertenece a Límites.
- **¿Código mezclado?** 🚨 **Sí, masivamente:**
  - `LAYERS_CONFIG` (líneas 1-655): **100% Biofísico** (RELIEVE, CLIMA, HIDROGRAFIA, ECOSISTEMAS, SUELOS, FENOMENOS).
  - `ORDENAMIENTO_CONFIG` (líneas 658-741): **100% Ordenamiento**.
  - `DEPTO_ONLY_LAYER_IDS`, `DEPT_TO_MUNI_LAYER_ID`: para filtrar capas Biofísico departamentales.
  - `LEYENDA_RIESGO_CC`, `coloresCondicionEcos`, `condicionLabelToCode`, `coloresPendientes`, `pendientesLabelToCode`: paletas de colores de Biofísico.
- **¿Está siendo usado realmente?** `LIMITES_CONFIG` sí. El resto: `LAYERS_CONFIG` es importado por `layer-state.js` pero para un modo "LIMITES" que no existe en el diccionario (ver 3.8). El resto NO es importado por nadie.

### 3.3 `utils.js` (174 líneas)
- **Qué hace:** Utilidades generales (HTML, SQL, colores, debounce).
- **¿Pertenece a Límites?** ✅ Parcialmente. Las funciones usadas son genuinamente necesarias. Pero tiene muchas funciones heredadas sin uso.
- **¿Código muerto?** Sí, ~12 funciones exportadas no usadas (ver sección 5).

### 3.4 `legend.js` (247 líneas)
- **Qué hace:** Utilidades de leyenda + `actualizarLeyendaLimitesMunicipales`.
- **¿Pertenece a Límites?** ⚠️ La función `actualizarLeyendaLimitesMunicipales` sí. El resto (`buildLegendFromRenderer`, `getSymbolColorRGBA`, `sortLegendEntries`, `syncLegendToLabelSelection`) es código de Biofísico.
- **Problemas detectados:**
  - `sortLegendEntries` (línea 111) referencia variables **no definidas**: `coloresClimas`, `coloresHipsometricos`, `coloresEscorrentia` → **ReferenceError** si se ejecutara.
  - `syncLegendToLabelSelection` (línea 188) referencia `applyWhereToActiveLayers` y `whereBase` como globales (← patrón frágil de Biofísico).
  - `actualizarLeyendaLimitesMunicipales` está **duplicada** en `ui/legend.ui.js` (línea 39).

### 3.5 `data.js` (52 líneas)
- **Qué hace:** Funciones para queries agregados de ArcGIS (`arcRestQuery`, `fetchBF3Stats`, `fetchGroupedStats`).
- **¿Pertenece a Límites?** ❌ No. Son utilidades para Biofísico (agregaciones por grupo, estadísticas BF3).
- **¿Está siendo usado?** ❌ No importado por nadie.
- **¿Código muerto?** ✅ Archivo completo.

### 3.6 `data/territorial.js` (33 líneas)
- **Qué hace:** Carga el diccionario de municipios/departamentos desde API Geovisor.
- **¿Pertenece a Límites?** ✅ Sí. Los dropdowns de municipio/departamento dependen de esto.
- **¿Está siendo usado?** ✅ Importado desde `main.js`.

### 3.7 `app/state.js` (49 líneas)
- **Qué hace:** Estado global compartido.
- **¿Pertenece a Límites?** ⚠️ La estructura es genérica pero contiene campos específicos de otros módulos:
  - `currentMode: "RELIEVE"` → Biofísico
  - `currentMainModule: "BIOFISICO"` → Biofísico
  - `currentOrdenamientoTab: "CLASIFICACION_SUELO"` → Ordenamiento
  - `currentRuralChartView: "CATEGORIA"` → Ordenamiento
  - `legendWidget`, `stationsLayer` → Biofísico
  - `chartInstance`, `geoPieChartInstance`, `geoDonutChartInstance` → Biofísico
  - `updateLegendByExtent` → Biofísico
  - `currentSubLayerIndex` → Biofísico (subcapas)
  - Falta declarar `overviewView` (asignado en `overview.js` línea 114)

### 3.8 `app/layer-state.js` (24 líneas)
- **Qué hace:** Obtiene la lista de capas y la capa activa según el modo actual.
- **¿Pertenece a Límites?** ❌ **No funciona para Límites.** `LAYERS_CONFIG` solo tiene claves de Biofísico (`RELIEVE`, `CLIMA`, `HIDROGRAFIA`, `ECOSISTEMAS`, `SUELOS`, `FENOMENOS`). Cuando `AppState.currentMode = "LIMITES"`, `LAYERS_CONFIG["LIMITES"]` es `undefined` → `getLayerListForCurrentLevel()` retorna `[]` → `getActiveLayerConfig()` retorna `null`. **Este archivo es inútil para el componente Límites.**
- **¿Está siendo usado?** Sí, importado en `main.js` pero siempre retorna vacío/null.

### 3.9 `map/layer-loader.js` (102 líneas)
- **Qué hace:** Crea las capas de municipios y departamentos para Límites.
- **¿Pertenece a Límites?** ✅ Sí, exclusivamente.
- **¿Está siendo usado?** ✅ Importado desde `main.js`.

### 3.10 `map/layers.js` (63 líneas)
- **Qué hace:** Limpia capas del mapa y resetea estado.
- **¿Pertenece a Límites?** ✅ Mayormente sí, pero limpia `stationsLayer` (Biofísico) y `window.__geoformaSelectedPaisaje`, `window.__vocacionSelectedLabel` (Biofísico).
- **¿Está siendo usado?** ✅ Importado desde `main.js`.

### 3.11 `map/map.core.js` (48 líneas)
- **Qué hace:** Crea el mapa base con basemap satelital-topográfico.
- **¿Pertenece a Límites?** ✅ Sí.
- **¿Está siendo usado?** ✅ Importado desde `main.js`.

### 3.12 `map/map.controls.js` (66 líneas)
- **Qué hace:** Inicializa controles del mapa (zoom, home, locate, basemaps).
- **¿Pertenece a Límites?** ✅ Sí.
- **¿Está siendo usado?** ✅ Importado desde `main.js`.

### 3.13 `map/overview.js` (117 líneas)
- **Qué hace:** Minimapa de vista general (overview).
- **¿Pertenece a Límites?** ✅ Sí.
- **¿Está siendo usado?** ✅ Importado desde `main.js`.

### 3.14 `map/scale.js` (13 líneas)
- **Qué hace:** Barra de escala.
- **¿Pertenece a Límites?** ✅ Sí.
- **¿Está siendo usado?** ✅ Importado desde `main.js`.

### 3.15 `map/zoom.js` (45 líneas)
- **Qué hace:** Funciones de zoom (zoomToExtent, zoomToLayerObjectId, resetToColombia).
- **¿Pertenece a Límites?** ✅ Sí.
- **¿Está siendo usado?** ✅ `resetToColombia` importado desde `map.controls.js`.

### 3.16 `map/filters.js` (74 líneas)
- **Qué hace:** Construcción de cláusulas WHERE para filtrar capas.
- **¿Pertenece a Límites?** ❌ Está diseñado para Biofísico (maneja períodos de tiempo, deforestación, clima stacked, filtros genéricos).
- **¿Está siendo usado?** ❌ No importado por nadie.

### 3.17 `map/map.helpers.js` (29 líneas)
- **Qué hace:** Helpers para destruir capas, seleccionar capa por escala, título de geoformas.
- **¿Pertenece a Límites?** ❌ Código de Biofísico (geoformas, escala de variantes).
- **¿Está siendo usado?** ❌ No importado por nadie.

### 3.18 `chart/chart.core.js` (18 líneas)
- **Qué hace:** Wrapper de Chart.js (crear/destruir instancia).
- **¿Pertenece a Límites?** ✅ Sí.
- **¿Está siendo usado?** ✅ Importado por `chart/municipios/chart.js` y `chart/departamentales/chart.js`.

### 3.19 `chart/chart.helpers.js` (35 líneas)
- **Qué hace:** Opciones por defecto para gráficas de barras.
- **¿Pertenece a Límites?** ✅ Sí.
- **¿Está siendo usado?** ✅ Importado por ambos charts.

### 3.20 `chart/municipios/chart.js` (47 líneas)
- **Qué hace:** Renderiza gráfica de barras con líneas limítrofes por municipio.
- **¿Pertenece a Límites?** ✅ Sí, exclusivamente.
- **¿Está siendo usado?** ✅ Importado desde `main.js`.

### 3.21 `chart/departamentales/chart.js` (47 líneas)
- **Qué hace:** Renderiza gráfica de barras con áreas por departamento.
- **¿Pertenece a Límites?** ✅ Sí, exclusivamente.
- **¿Está siendo usado?** ✅ Importado desde `main.js`.

### 3.22 `ui/dropdowns.js` (94 líneas)
- **Qué hace:** Inicializa dropdowns de módulo y descargables.
- **¿Pertenece a Límites?** ✅ Mayormente. El dropdown de descargables tiene referencias a `btnDescargarPDF` que no existe en `limites.html`.
- **¿Está siendo usado?** ✅ Importado desde `main.js`.

### 3.23 `ui/legend.ui.js` (61 líneas)
- **Qué hace:** Funciones de UI para leyenda.
- **¿Pertenece a Límites?** ✅ `actualizarLeyendaDepartamentosLimites` y `toggleLegend` sí. `actualizarLeyenda` (genérica de Biofísico) no se usa. `actualizarLeyendaLimitesMunicipales` está duplicada con `legend.js`.
- **¿Está siendo usado?** ✅ Parcialmente.

### 3.24 `ui/summary.js` (26 líneas)
- **Qué hace:** Renderiza resumen de municipio/departamento seleccionado.
- **¿Pertenece a Límites?** ✅ Sí.
- **¿Está siendo usado?** ✅ Importado desde `main.js`.

### 3.25 `ui/ui.helpers.js` (28 líneas)
- **Qué hace:** Helpers de UI (badge, título de leyenda, clearLegend, setSummaryText).
- **¿Pertenece a Límites?** ✅ Sí.
- **¿Está siendo usado?** ✅ `updateMapViewBadge` y `setLegendLayerTitle` importados desde `main.js`.

### 3.26 `modules/limites/limites-municipales.loader.js` (95 líneas)
- **Qué hace:** Versión alternativa/duplicada de la carga de capa de municipios (misma lógica que `layer-loader.js` + `main.js`).
- **¿Pertenece a Límites?** ⚠️ Sí (en contenido), pero es código duplicado.
- **¿Está siendo usado?** ❌ No importado por nadie.

---

## 4. Detección de código muerto

### 4.1 Archivos completos para eliminar

| Archivo | Motivo | Riesgo |
|---|---|---|
| `data.js` | No importado. Utilidades de Biofísico. | 🔴 Medio — verificar que ningún HTML externo lo cargue con `<script>` |
| `map/filters.js` | No importado. Filtros para Biofísico (períodos, deforestación, clima). | 🔴 Medio |
| `map/map.helpers.js` | No importado. Helpers de Biofísico (geoformas, escala). | 🔴 Medio |
| `modules/limites/limites-municipales.loader.js` | No importado. Código duplicado de `layer-loader.js`. | 🟢 Bajo |

### 4.2 Funciones no llamadas / exports no usados

**`utils.js`:**
| Función | Usada por |
|---|---|
| `toNum` | ❌ Nadie |
| `pctOfTotal` | ❌ Nadie |
| `ensureNonEmptyOrExit` | ❌ Nadie |
| `buildDictFromUniqueValueRenderer` | ❌ Nadie |
| `wrapLabel` | ❌ Nadie |
| `escapeSqlString` | ❌ Nadie |
| `ordenarMeses` | ❌ Nadie |
| `rgbaFromEsriColor` | ❌ Nadie |
| `rgbaFromEsriColorArr` | ❌ Nadie |
| `normKey` | ❌ Nadie |
| `sqlLiteral` | ❌ Nadie (aunque `sqlEquals` la usa internamente, no se necesita exportar) |
| `sqlEqualsNumber` | ❌ Nadie |
| `andWhere` | ❌ Nadie |
| `safeCssColor` | ❌ Nadie |
| `escapeAttr` | ✅ `ui/legend.ui.js` |

**`legend.js`:**
| Función | Usada por |
|---|---|
| `buildLegendFromRenderer` | ❌ Nadie |
| `getSymbolColorRGBA` | ❌ Nadie directamente (referenciada como `typeof getSymbolColorRGBA === "function"` en `utils.js`) |
| `sortLegendEntries` | ❌ Nadie (además tiene ReferenceError) |
| `syncLegendToLabelSelection` | ❌ Nadie |
| `_normTxt` | Solo `syncLegendToLabelSelection` (que no se usa) |
| `actualizarLeyendaLimitesMunicipales` | ✅ `main.js` |

**`ui/legend.ui.js`:**
| Función | Usada por |
|---|---|
| `actualizarLeyenda` | ❌ Nadie (genérica de Biofísico) |
| `actualizarLeyendaLimitesMunicipales` | ❌ Nadie (duplicada, main.js usa la de `legend.js`) |
| `actualizarLeyendaDepartamentosLimites` | ✅ `main.js` |
| `toggleLegend` | ✅ `main.js` |

**`ui/ui.helpers.js`:**
| Función | Usada por |
|---|---|
| `clearLegend` | ❌ Nadie |
| `setSummaryText` | ❌ Nadie |
| `updateMapViewBadge` | ✅ `main.js` |
| `setLegendLayerTitle` | ✅ `main.js` |

**`map/zoom.js`:**
| Función | Usada por |
|---|---|
| `zoomToExtent` | ❌ Nadie externamente (solo internamente por `zoomToLayerObjectId`) |
| `zoomToLayerObjectId` | ❌ Nadie |
| `resetToColombia` | ✅ `map.controls.js` |

**`main.js` (funciones internas no llamadas):**
| Función/Variable | Estado |
|---|---|
| `cargarInfoMunicipio()` | ❌ Definida pero nunca llamada |
| `getFieldDomainLabel()` | ❌ Definida pero nunca llamada |
| `buildRuralPaletteFromRenderer()` | ❌ Definida, expuesta en window, nunca llamada |
| `highlightWhere()` | ❌ Definida pero nunca llamada |
| `onViewStop` (debounce) | ❌ Definido pero nunca conectado a evento |
| `timeSliderWrap`, `timeSlider`, `timeSliderLabel` | ❌ Elementos DOM que no existen en `limites.html` |
| `window.redirigir` | ❌ Definida pero sin uso en Límites |
| `showTimeSlider()` | ❌ Definida pero nunca llamada desde Límites (diseñada para capas Biofísico con período) |
| `handleTimeSliderInput()` | ❌ Solo llamado internamente por el slider en modo time |
| `hideTimeSlider()` | ✅ Usada en `limpiarBusqueda`, `cargarInfoMunicipio`, `cargarLimitesMunicipales`, `cargarLimitesDepartamentos` |

### 4.3 Imports no usados en `main.js`

De `utils.js` se importan 6 funciones, pero `rgbaArrayToCss` solo se usa en `buildRuralPaletteFromRenderer` (que no se llama). Verificar si `escapeHtml` se usa fuera de los imports — sí, en `redirigir` que no se usa.

### 4.4 Código duplicado

| Duplicación | Archivo 1 | Archivo 2 |
|---|---|---|
| `actualizarLeyendaLimitesMunicipales` | `legend.js:234` | `ui/legend.ui.js:39` |
| Carga de capa municipios | `map/layer-loader.js` | `modules/limites/limites-municipales.loader.js` |
| `getSymbolColorRGBA` | `legend.js:92` | `utils.js:90` (`rgbaFromEsriColor` es similar) |

### 4.5 Variables globales contaminadas desde Biofísico

En `map/layers.js` (clearLayers):
- `window.__lastLegendRenderKey` — usado por Biofísico
- `window.activeFeatureLayer` — usado por Biofísico
- `window.__geoformaSelectedPaisaje` — Biofísico
- `window.__vocacionSelectedLabel` — Biofísico

### 4.6 Código inalcanzable / errores potenciales

- `legend.js:111-175` (`sortLegendEntries`): Referencia `coloresClimas`, `coloresHipsometricos`, `coloresEscorrentia` que **no están definidos** → `ReferenceError`.
- `app/layer-state.js`: `LAYERS_CONFIG` no tiene clave `"LIMITES"` → `getLayerListForCurrentLevel()` siempre retorna `[]`.
- `legend.js:220`: `syncLegendToLabelSelection` referencia `applyWhereToActiveLayers` y `whereBase` como globales sin verificar que existan.

---

## 5. Clasificación de hallazgos

### 🔴 ELIMINAR (archivos completos)

| # | Archivo | Motivo |
|---|---|---|
| 1 | `data.js` | No usado. Funciones de Biofísico (BF3 stats, grouped stats). |
| 2 | `map/filters.js` | No usado. Filtros de Biofísico (períodos, deforestación, clima). |
| 3 | `map/map.helpers.js` | No usado. Helpers de Biofísico (geoformas, escala). |
| 4 | `modules/limites/limites-municipales.loader.js` | No usado. Duplicado de `layer-loader.js`. |

### 🟡 ELIMINAR (secciones de archivos)

| # | Archivo | Qué eliminar |
|---|---|---|
| 5 | `config.js` | `LAYERS_CONFIG` completo (líneas 1-655), `ORDENAMIENTO_CONFIG` (658-741), `DEPTO_ONLY_LAYER_IDS` (789-810), `DEPT_TO_MUNI_LAYER_ID` (812-832), `LEYENDA_RIESGO_CC` (836-843), `coloresCondicionEcos` (846-852), `condicionLabelToCode` (855-858), `coloresPendientes` (861-869), `pendientesLabelToCode` (871-874). **Solo conservar `LIMITES_CONFIG` (743-788).** |
| 6 | `utils.js` | Eliminar exports: `toNum`, `pctOfTotal`, `ensureNonEmptyOrExit`, `buildDictFromUniqueValueRenderer`, `wrapLabel`, `escapeSqlString`, `ordenarMeses`, `rgbaFromEsriColor`, `rgbaFromEsriColorArr`, `normKey`, `sqlLiteral`, `sqlEqualsNumber`, `andWhere`, `safeCssColor`. |
| 7 | `legend.js` | Eliminar: `buildLegendFromRenderer`, `getSymbolColorRGBA`, `sortLegendEntries`, `syncLegendToLabelSelection`, `_normTxt`. Solo conservar `actualizarLeyendaLimitesMunicipales`. |
| 8 | `ui/legend.ui.js` | Eliminar: `actualizarLeyenda` (genérica Biofísico), `actualizarLeyendaLimitesMunicipales` (duplicada). Conservar: `actualizarLeyendaDepartamentosLimites`, `toggleLegend`. |
| 9 | `ui/ui.helpers.js` | Eliminar: `clearLegend`, `setSummaryText`. Conservar: `updateMapViewBadge`, `setLegendLayerTitle`. |
| 10 | `app/state.js` | Eliminar campos: `currentMode`, `currentMainModule`, `currentOrdenamientoTab`, `currentRuralChartView`, `legendWidget`, `stationsLayer`, `currentSubLayerIndex`, `chartInstance`, `geoPieChartInstance`, `geoDonutChartInstance`, `updateLegendByExtent`. Agregar: `overviewView`. |
| 11 | `app/layer-state.js` | ⚠️ **Evaluar eliminación completa** (no funciona para modo LIMITES). Si se elimina, actualizar `main.js`. |
| 12 | `map/layers.js` | Eliminar referencias a: `window.activeFeatureLayer`, `window.__geoformaSelectedPaisaje`, `window.__vocacionSelectedLabel`, `AppState.stationsLayer`. |
| 13 | `map/zoom.js` | Eliminar exports no usados: `zoomToExtent`, `zoomToLayerObjectId`. Solo conservar `resetToColombia`. |
| 14 | `main.js` | Eliminar: lógica de Time Slider completa (líneas 175-276), `cargarInfoMunicipio()` (363-377), `getFieldDomainLabel()` (535-540), `buildRuralPaletteFromRenderer()` (542-557), `highlightWhere()` (576-590), `onViewStop` (280-288), `window.redirigir` (629-640). Variables no usadas: `timeSliderWrap`, `timeSlider`, `timeSliderLabel`. |

### 🟢 MANTENER

| Archivo | Razón |
|---|---|
| `data/territorial.js` | Carga diccionario de municipios/departamentos. Esencial. |
| `chart/chart.core.js` | Wrapper de Chart.js. |
| `chart/chart.helpers.js` | Opciones de gráficas. |
| `chart/municipios/chart.js` | Gráfica de límites municipales. |
| `chart/departamentales/chart.js` | Gráfica de límites departamentales. |
| `map/layer-loader.js` | Carga capas de Límites. |
| `map/map.core.js` | Crea mapa base. |
| `map/map.controls.js` | Controles del mapa. |
| `map/overview.js` | Minimapa. |
| `map/scale.js` | Barra de escala. |
| `ui/dropdowns.js` | Dropdowns de módulo y descargables. |
| `ui/summary.js` | Resumen de selección. |

### 🔵 REVISAR MANUALMENTE

| # | Archivo | Qué revisar |
|---|---|---|
| 15 | `ui/dropdowns.js` | `initDropdownDescargables` referencia `btnDescargarPDF` que no existe en `limites.html`. La función `setOpen` no está definida en el scope de `initDropdownDescargables` (bug). |
| 16 | `legend.js:220` | `syncLegendToLabelSelection` usa `applyWhereToActiveLayers` y `whereBase` como globales — si se decide conservar esta función, deben pasarse como parámetros. |
| 17 | `app/layer-state.js` | Si se decide mantener, necesita una entrada `LIMITES` en `LAYERS_CONFIG` o refactorizarse para usar `LIMITES_CONFIG` directamente. Actualmente está roto. |
| 18 | `main.js` | El import dinámico `import("./chart/chart.core.js")` (línea 100, 328) — verificar que funcione correctamente con los cambios. |

---

## 6. Propuesta de limpieza (orden sugerido)

### Fase 1: Eliminar archivos huérfanos (bajo riesgo)
1. Eliminar `data.js`
2. Eliminar `map/filters.js`
3. Eliminar `map/map.helpers.js`
4. Eliminar `modules/limites/limites-municipales.loader.js`
5. Eliminar directorio `modules/` (quedará vacío)

### Fase 2: Limpiar `config.js` (riesgo medio)
6. Extraer `LIMITES_CONFIG` a un nuevo archivo `config.js` limpio, o eliminar todo lo que no es `LIMITES_CONFIG` del archivo actual.
7. Verificar que `app/layer-state.js` no se rompa (requiere `LAYERS_CONFIG` y `DEPTO_ONLY_LAYER_IDS`).

### Fase 3: Refactorizar `app/layer-state.js` (riesgo medio)
8. Opción A: Eliminar el archivo y actualizar `main.js` para no importarlo.
9. Opción B: Reescribirlo para que use `LIMITES_CONFIG` en lugar de `LAYERS_CONFIG`, con modo `"LIMITES"`.

### Fase 4: Limpiar `app/state.js` (riesgo medio)
10. Eliminar campos de Biofísico/Ordenamiento.
11. Agregar campo `overviewView`.
12. Verificar que todas las referencias en `map/layers.js`, `map/map.core.js`, `map/overview.js`, `map/zoom.js` sigan funcionando.

### Fase 5: Limpiar `utils.js` (riesgo bajo)
13. Eliminar funciones no usadas.
14. Verificar que `ui/legend.ui.js` y `ui/summary.js` sigan importando correctamente.

### Fase 6: Limpiar `legend.js` (riesgo bajo-medio)
15. Dejar solo `actualizarLeyendaLimitesMunicipales`.
16. Eliminar código muerto.

### Fase 7: Limpiar `ui/legend.ui.js` (riesgo bajo)
17. Eliminar `actualizarLeyenda` y `actualizarLeyendaLimitesMunicipales` duplicada.

### Fase 8: Limpiar `ui/ui.helpers.js` (riesgo bajo)
18. Eliminar `clearLegend` y `setSummaryText`.

### Fase 9: Limpiar `map/layers.js` (riesgo bajo)
19. Eliminar referencias a variables globales de Biofísico.

### Fase 10: Limpiar `map/zoom.js` (riesgo bajo)
20. Eliminar exports no usados.

### Fase 11: Limpiar `main.js` (riesgo alto)
21. Eliminar toda la lógica de Time Slider.
22. Eliminar funciones no usadas.
23. Eliminar variables no usadas.
24. Eliminar `window.redirigir`.
25. Actualizar imports según las fases anteriores.
26. Si `app/layer-state.js` se eliminó, quitar su import y ajustar `renderControls`/`getActiveLayerConfig`.

---

## 7. Riesgos

| # | Cambio | Riesgo | Motivo | Validación requerida |
|---|---|---|---|---|
| 1-4 | Eliminar archivos huérfanos | 🟢 Bajo | No son importados por nadie en `js/limites/`. | Verificar que no haya `<script>` tags en `limites.html` que los carguen (no los hay). |
| 5-6 | Limpiar `config.js` | 🟡 Medio | `app/layer-state.js` importa `LAYERS_CONFIG` y `DEPTO_ONLY_LAYER_IDS`. Si se eliminan, `layer-state.js` debe actualizarse o eliminarse también. | Revisar imports de `layer-state.js`. |
| 7-9 | Refactorizar/eliminar `layer-state.js` | 🟡 Medio | `main.js` importa `getActiveLayerConfig` y `getLayerListForCurrentLevel`. Si se elimina el archivo, `main.js` debe adaptarse. Actualmente estas funciones retornan vacío/null, por lo que su impacto real es nulo. | Probar que `main.js` funcione sin estos imports. |
| 10-12 | Limpiar `app/state.js` | 🟡 Medio | Múltiples archivos importan `AppState`. Si se eliminan campos usados, habrá errores. | Revisar cada referencia a `AppState.X` en todos los archivos. |
| 13-14 | Limpiar `utils.js` | 🟢 Bajo | Solo se eliminan exports no usados. Las funciones internas (ej. `sqlLiteral` usada por `sqlEquals`) deben mantenerse aunque no se exporten. | Verificar que las funciones exportadas que sí se usan sigan funcionando. |
| 15-16 | Limpiar `legend.js` | 🟡 Medio | `utils.js:43` referencia `getSymbolColorRGBA` con `typeof`. Si se elimina, `buildDictFromUniqueValueRenderer` (que también se eliminará) fallaría. Pero como ambas se eliminan, no hay problema. | Verificar que `actualizarLeyendaLimitesMunicipales` siga funcionando. |
| 17-20 | Limpiar UI y map | 🟢 Bajo | Cambios localizados, sin dependencias complejas. | Prueba de regresión visual. |
| 21-26 | Limpiar `main.js` | 🔴 Alto | Es el punto de entrada principal. Los cambios deben ser precisos para no romper la funcionalidad de Límites. | Prueba completa: carga de página, selección de municipio, selección de departamento, cambio de pestaña, gráfica, leyenda, popups, zoom, búsqueda. |

---

## 8. Resumen de impacto

| Métrica | Antes | Después (estimado) |
|---|---|---|
| Archivos totales en `js/limites/` | 27 | ~19 |
| Líneas totales | ~2,800 | ~1,400 |
| `config.js` líneas | 876 | ~50 |
| `main.js` líneas | 641 | ~350 |
| Código de Biofísico eliminado | — | ~1,200 líneas |
| Código de Ordenamiento eliminado | — | ~85 líneas |
| Funciones muertas eliminadas | — | ~25 |
| Archivos huérfanos eliminados | — | 4 |

---

## 9. Notas adicionales

- **`coloresOcupacion.js`** en la raíz del proyecto no se toca (está fuera de `js/limites/`).
- **`js/archivosViejos/`** no se toca (está fuera del alcance).
- El CSS `css/stylesLimites.css` no se audita en este plan (solo JS).
- El `legend.js` tiene una función `_normTxt` (línea 177) que es privada (no exportada) — si `syncLegendToLabelSelection` se elimina, esta también debe eliminarse.
- `main.js` línea 100 hace `import("./chart/chart.core.js")` dinámico — esto es correcto y debe conservarse.
- El `AppState.overviewView` se asigna en `overview.js:114` pero no está declarado en `state.js`. Debe agregarse.

---

*Estado: ✅ EJECUTADO — 2026-06-11 14:03*

## 10. Resultado de la ejecución

| Fase | Acción | Estado |
|---|---|---|
| 1 | Eliminar `data.js`, `map/filters.js`, `map/map.helpers.js`, `modules/limites/limites-municipales.loader.js` | ✅ |
| 2 | Limpiar `config.js` — solo `LIMITES_CONFIG` (46 líneas) | ✅ |
| 3 | Eliminar `app/layer-state.js` | ✅ |
| 4 | Limpiar `app/state.js` — eliminados campos Biofísico/Ordenamiento | ✅ |
| 5 | Limpiar `utils.js` — 14 funciones muertas eliminadas | ✅ |
| 6 | Limpiar `legend.js` — solo `actualizarLeyendaLimitesMunicipales` | ✅ |
| 7 | Limpiar `ui/legend.ui.js` — eliminadas duplicadas y Biofísico | ✅ |
| 8 | Limpiar `ui/ui.helpers.js` — solo `updateMapViewBadge` y `setLegendLayerTitle` | ✅ |
| 9 | Limpiar `map/layers.js` — eliminadas referencias Biofísico | ✅ |
| 10 | Limpiar `map/zoom.js` — solo `resetToColombia` | ✅ |
| 11 | Limpiar `main.js` — Time Slider, funciones muertas, imports rotos eliminados | ✅ |
| — | Eliminar directorio `modules/` vacío | ✅ |

**Archivos resultantes:** 19 (antes 27)  
**Líneas eliminadas:** ~1,400 (Biofísico, Ordenamiento, código muerto)  
**Componentes no afectados:** Biofísico, Ordenamiento, Ocupación, Socioeconómico
