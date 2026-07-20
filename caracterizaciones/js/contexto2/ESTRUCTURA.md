# Estructura del modulo `contexto2`

Este documento define la arquitectura base para desarrollar las tematicas de `contexto2.html`.

El patron principal que debe soportar la arquitectura es:

1. Renderizar una capa en el mapa.
2. Construir uno o varios graficos asociados.
3. Renderizar una leyenda.
4. Sincronizar mapa, grafico y leyenda mediante una interaccion bidireccional.

La prioridad de esta arquitectura es mantener los desarrollos futuros simples, consistentes y repetibles. No se deben crear reglas o componentes nuevos si no resuelven un problema real de reutilizacion, acoplamiento o mantenimiento.

---

## Organizacion de carpetas

```text
js/contexto2/
|
|-- index.js
|
|-- core/
|   |-- State.js
|   `-- EventBus.js
|
|-- config/
|   |-- LayerConfig.js
|   |-- ModeConfig.js
|   `-- DomainConfig.js
|
|-- map/
|   |-- MapInitializer.js
|   |-- LayerFactory.js
|   |-- LayerManager.js
|   |-- LayerFilter.js
|   |-- MapHighlighter.js
|   |-- MapClickHandler.js
|   |-- MapControls.js
|   |-- MapViewBadge.js
|   `-- MapSourceDisplay.js
|
|-- overview/
|   |-- OverviewMap.js
|   `-- OverviewDragHandler.js
|
|-- legend/
|   |-- LegendRenderer.js
|   |-- LegendFilter.js
|   `-- LegendDataExtractor.js
|
|-- charts/
|   |-- ChartRegistry.js
|   |-- ChartFactory.js
|   |-- ChartLifecycle.js
|   |-- ChartManager.js
|   `-- renderers/
|       |-- DoughnutRenderer.js
|       |-- HorizontalBarRenderer.js
|       |-- StackedBarRenderer.js
|       |-- PieRenderer.js
|       `-- LineaInfraestructuraRenderer.js
|
|-- ui/
|   |-- DropdownManager.js
|   |-- DescargablesDropdown.js
|   |-- SubtabManager.js
|   |-- TerritorySelector.js
|   |-- MunicipalitySelector.js
|   |-- SearchControls.js
|   |-- NavigationControls.js
|   `-- NavbarManager.js
|
|-- services/
|   |-- ArcGISQueryService.js
|   |-- ArcGISStatisticService.js
|   |-- DictionaryService.js
|   `-- TerritoryDataService.js
|
|-- navigation/
|   |-- ModuleNavigator.js
|   |-- ModeSwitcher.js
|   |-- SubLayerNavigator.js
|   `-- UrlStateManager.js
|
`-- utils/
    |-- ColorUtils.js
    |-- FormatUtils.js
    |-- SqlUtils.js
    `-- DomUtils.js
```

---

## Responsabilidad por carpeta

### `core/`

Contiene las piezas transversales.

- `State.js`: unica fuente de verdad para modo activo, territorio activo, subcapa activa, filtro base y seleccion activa.
- `EventBus.js`: canal de comunicacion entre dominios.

### `config/`

Contiene configuracion declarativa. Aqui se describe que existe, no como se renderiza en detalle.

- `LayerConfig.js`: tematicas, capas, campos, tipos de renderer, campos de categoria, campos de valor, filtros base y reglas de leyenda.
- `ModeConfig.js`: modos disponibles y su relacion con la UI.
- `DomainConfig.js`: dominios, etiquetas, colores y constantes compartidas.

### `map/`

Contiene todo lo relacionado con ArcGIS MapView y FeatureLayer.

- Crea capas.
- Agrega o limpia capas.
- Aplica filtros.
- Resalta entidades.
- Convierte clicks del mapa en eventos de seleccion.

No debe construir graficos ni escribir HTML de leyendas.

### `charts/`

Contiene todo lo relacionado con Chart.js.

- Selecciona el renderer adecuado.
- Consulta datos si el grafico lo necesita.
- Crea, actualiza y destruye instancias Chart.js.
- Convierte clicks del grafico en eventos de seleccion.

No debe modificar directamente capas del mapa ni elementos de leyenda.

### `legend/`

Contiene renderizado e interaccion de leyendas.

- Extrae datos de leyenda desde renderers ArcGIS o configuracion.
- Renderiza HTML.
- Convierte clicks de leyenda en eventos de seleccion.

No debe aplicar filtros directamente sobre FeatureLayer.

### `ui/`

Contiene controles de interfaz: dropdowns, selects, subtabs, botones y navbar.

La UI solo debe cambiar estado o emitir eventos. No debe consultar servicios ArcGIS directamente salvo casos de carga inicial de listas controladas, como municipios/departamentos.

### `services/`

Contiene acceso a datos externos.

- Consultas REST ArcGIS.
- Estadisticas.
- Diccionarios.
- Datos de territorio.

Los servicios no deben conocer el DOM, Chart.js ni MapView.

### `utils/`

Contiene utilidades puras y sin estado.

---

## Reglas de arquitectura

### 1. Una clase por archivo

Cada archivo debe exportar una unica clase principal. El nombre del archivo debe coincidir con el nombre de la clase.

```js
// Correcto
// LegendRenderer.js
export class LegendRenderer {}
```

Excepcion: archivos de configuracion o constantes pueden exportar datos puros si se decide migrar alguna configuracion fuera de clases.

### 2. Una responsabilidad por clase

Una clase debe tener una razon clara para cambiar.

Ejemplos:

- `LegendRenderer` renderiza HTML de leyenda.
- `LegendFilter` interpreta clicks de leyenda y emite seleccion.
- `LayerFilter` aplica filtros sobre capas.

Si una clase empieza a consultar datos, renderizar DOM y aplicar filtros, debe dividirse.

### 3. `State.js` es la unica fuente de verdad

No se debe usar `window.*` para compartir estado entre modulos.

El estado minimo debe cubrir:

- `currentMode`
- `currentSubLayerIndex`
- `municipioActual`
- `deptoActual`
- `filtroNivel`
- `whereBase`
- `activeSelection`
- `activeFilter`

`activeSelection` debe representar la seleccion comun de mapa, grafico y leyenda.

Ejemplo recomendado:

```js
state.set('activeSelection', {
    source: 'chart',
    layerId: 'determinantes_sinap',
    field: 'tdeterm',
    value: 101,
    label: 'Parque Nacional Natural',
    where: 'tdeterm = 101'
});
```

### 4. La interaccion usa un contrato unico de seleccion

Mapa, grafico y leyenda no deben manejar filtros independientes.

Todo click relevante debe convertirse en el mismo evento:

```js
eventBus.emit('selection:changed', {
    source: 'legend',
    layerId,
    field,
    value,
    label,
    where
});
```

Los modulos reaccionan asi:

- `LayerFilter` aplica el filtro al mapa.
- `MapHighlighter` resalta entidades si corresponde.
- `ChartManager` actualiza o resalta el grafico si corresponde.
- `LegendRenderer` actualiza el item activo.
- `State` guarda `activeSelection` y `activeFilter`.

Para limpiar la seleccion se usa:

```js
eventBus.emit('selection:cleared', { source: 'reset' });
```

### 5. Comunicacion entre dominios mediante `EventBus`

Una clase de `charts/` no debe importar clases de `map/`. Una clase de `legend/` no debe importar clases de `charts/`. Una clase de `ui/` no debe modificar directamente capas o graficos.

Correcto:

```js
eventBus.emit('selection:changed', selection);
```

Incorrecto:

```js
import { LayerFilter } from '../map/LayerFilter.js';
layerFilter.apply(where);
```

Excepciones permitidas:

- Clases de una misma carpeta pueden colaborar entre si.
- `index.js` puede importar e instanciar cualquier modulo.
- Los servicios y utilidades pueden ser usados por cualquier dominio.
- Un renderer de grafico puede usar `ChartFactory` y `ChartLifecycle`.

### 6. `index.js` es el orquestador de conexiones entre dominios

`index.js` debe:

- Crear instancias compartidas.
- Inyectar dependencias.
- Inicializar modulos.
- Conectar eventos entre dominios.

Los modulos pueden escuchar eventos propios de su dominio, pero las conexiones cruzadas deben ser visibles en `index.js`.

Ejemplo:

```js
eventBus.on('selection:changed', (selection) => {
    state.set('activeSelection', selection);
    state.set('activeFilter', selection.where);
    layerFilter.apply(selection.where);
    legendRenderer.setActive(selection);
    chartManager.setActive(selection);
});
```

Esto evita que, al crecer el numero de tematicas, la sincronizacion quede dispersa en muchos archivos.

### 7. El HTML no contiene logica de negocio

`contexto2.html` mantiene la estructura del DOM.

No debe contener:

- `onclick` para cambiar modos.
- `onclick` para filtrar capas.
- logica de consulta.
- logica de sincronizacion.

La interaccion debe registrarse desde clases de `ui/`, `map/`, `charts/` o `legend/`.

Excepcion tecnica: scripts externos necesarios para cargar librerias globales como ArcGIS o Chart.js.

### 8. Las consultas SQL se construyen con utilidades

No se deben concatenar valores de usuario directamente en clausulas `WHERE`.

Usar `SqlUtils` para:

- escapar strings,
- construir `IN`,
- combinar filtros base y filtros de seleccion.

Correcto:

```js
const where = SqlUtils.combine(
    state.get('whereBase'),
    SqlUtils.equals('mpcodigo', codigo)
);
```

Si `SqlUtils` no tiene el helper necesario, se agrega ahi antes de duplicar concatenaciones en otros modulos.

### 9. Cada nueva consulta debe limpiar residuos visuales y de estado

Al cambiar de categoria, subcategoria, municipio, departamento, modo o subcapa,
no debe quedar ningun residuo de la consulta anterior en mapa, grafico o
leyenda.

Antes de cargar una nueva consulta se debe limpiar, segun aplique:

- filtros activos de capas,
- highlights del mapa,
- popups abiertos,
- seleccion activa de leyenda,
- seleccion o hover activo del grafico,
- instancia anterior de Chart.js,
- mensajes o resumenes asociados a la consulta anterior,
- `activeSelection`,
- `activeFilter`.

La limpieza debe ocurrir antes de renderizar la nueva capa, grafico o leyenda.

Eventos que obligan a limpiar residuos:

- `mode:changed`
- `sublayer:changed`
- `territory:changed`
- `selection:cleared`
- `search:reset`

El usuario nunca debe ver una leyenda filtrada, un grafico seleccionado, un
highlight o una capa filtrada que pertenezca a un municipio, departamento,
categoria o subcapa anterior.

---

## Contrato de una tematica

Cada nueva tematica debe poder declararse principalmente desde configuracion.

Una tematica debe definir, cuando aplique:

```js
{
    id: 'determinantes_sinap',
    mode: 'DETERMINANTES',
    title: 'SINAP',
    url: '...',
    geometryType: 'polygon',
    outFields: ['mpcodigo', 'subdet', 'tdeterm', 'porcentaje'],

    map: {
        rendererType: 'unique-value',
        field: 'subdet',
        colorDomain: 'sinapColors'
    },

    chart: {
        type: 'doughnut',
        renderer: 'DoughnutRenderer',
        categoryField: 'subdet',
        valueField: 'porcentaje',
        statistic: 'sum'
    },

    legend: {
        source: 'renderer',
        field: 'subdet',
        filterable: true
    },

    filter: {
        territoryField: 'mpcodigo',
        categoryField: 'subdet'
    }
}
```

No todas las tematicas necesitan todos los bloques, pero si una tematica tiene mapa, grafico y leyenda, esos bloques deben estar declarados.

### Beneficio de este contrato

Cuando existan muchas tematicas, la mayor parte del trabajo sera agregar o ajustar configuracion. Solo se crea un renderer nuevo cuando el tipo de visualizacion realmente no exista.

---

## Como agregar contenido nuevo

### Agregar una tematica con renderer existente

1. Agregar la entrada en `LayerConfig.js`.
2. Declarar los bloques `map`, `chart`, `legend` y `filter` que apliquen.
3. Si usa dominios o colores compartidos, agregarlos en `DomainConfig.js`.
4. Verificar que mapa, grafico y leyenda reaccionen a `selection:changed`.

No se debe modificar `LayerManager`, `ChartManager` o `LegendRenderer` solo para agregar una tematica si el tipo de renderer ya existe.

### Agregar un tipo de grafico nuevo

1. Crear un renderer en `charts/renderers/`.
2. Registrar el tipo en `ChartRegistry.js` o en la configuracion equivalente.
3. El renderer debe emitir `selection:changed` cuando el usuario haga click en una categoria.
4. El renderer no debe aplicar filtros al mapa directamente.

### Agregar un renderer de mapa nuevo

1. Agregar el caso generico en `LayerFactory.js`.
2. Declarar su uso desde `LayerConfig.js`.
3. Evitar flags especificos por tematica.

Correcto:

```js
map: { rendererType: 'unique-value', field: 'subdet' }
```

Incorrecto:

```js
isDeterminantesSinap: true
```

Los flags especificos solo son aceptables temporalmente durante migraciones.

### Agregar un modo nuevo

1. Agregar el modo en `ModeConfig.js`.
2. Agregar sus tematicas en `LayerConfig.js`.
3. Agregar textos, dominios o colores en `DomainConfig.js` si aplica.
4. Conectar la UI desde clases de `ui/`, no desde HTML inline.

---

## Eventos estandar

| Evento | Emisor | Datos | Uso |
|---|---|---|---|
| `map:ready` | `MapInitializer` | `{ map, view }` | Inicializar capas y controles |
| `mode:changed` | UI / `ModeSwitcher` | `{ mode }` | Cambiar modo activo |
| `sublayer:changed` | `SubLayerNavigator` / `SubtabManager` | `{ index, layerId }` | Cambiar tematica activa |
| `territory:changed` | `TerritorySelector` / `MunicipalitySelector` | `{ codigo, nivel }` | Cambiar filtro territorial |
| `selection:changed` | mapa, grafico o leyenda | `{ source, layerId, field, value, label, where }` | Sincronizar mapa, grafico y leyenda |
| `selection:cleared` | reset / busqueda | `{ source }` | Limpiar seleccion y filtros |
| `search:reset` | `SearchControls` | `{}` | Restaurar estado inicial |
| `data:error` | services/managers | `{ source, error, context }` | Mostrar o registrar errores |

Se deben preferir estos eventos sobre crear eventos especificos por componente, salvo que exista una necesidad clara.

---

## Reglas para evitar duplicacion

1. Si dos tematicas usan el mismo tipo de consulta y grafico, deben compartir renderer.
2. Si solo cambian campos, colores, titulos o filtros, debe resolverse por configuracion.
3. Si un renderer necesita muchas condiciones por `layerId`, la configuracion esta incompleta o el renderer tiene demasiadas responsabilidades.
4. Si una tematica obliga a modificar mas de tres dominios de codigo (`map`, `charts`, `legend`, `ui`), revisar primero si falta un contrato declarativo.

---

## Criterios antes de aceptar una nueva tematica

Antes de considerar lista una tematica, debe cumplir:

- La capa se carga desde `LayerManager`.
- El grafico se crea desde `ChartManager`.
- La leyenda se renderiza desde `LegendRenderer`.
- El click en mapa actualiza grafico y leyenda.
- El click en grafico filtra o resalta mapa y leyenda.
- El click en leyenda filtra o resalta mapa y grafico.
- El reset limpia `activeSelection`, `activeFilter`, mapa, grafico y leyenda.
- Al cambiar municipio, departamento, categoria, modo o subcapa no quedan
  residuos visuales ni filtros de la consulta anterior.
- No hay estado compartido por `window.*`.
- No hay `onclick` nuevo en `contexto2.html`.
- La mayor parte de la tematica esta declarada en configuracion.

---

## Principio de mantenimiento

No se debe agregar una abstraccion solo por estilo.

Un cambio arquitectonico se justifica solo si:

- reduce duplicacion real,
- elimina acoplamiento entre dominios,
- permite agregar varias tematicas con menos cambios,
- hace mas clara la sincronizacion mapa/grafico/leyenda,
- o evita inconsistencias de estado.

Si una necesidad aparece solo una vez y no afecta el patron general, se resuelve localmente sin crear una capa adicional de arquitectura.
