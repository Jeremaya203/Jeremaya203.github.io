# Diagnostico de rendimiento - Limites Municipales

Fecha: 2026-06-18

## Alcance

Revision del flujo de `limites.html` para Limites Municipales, principalmente en:

- `js/limites/main.js`
- `js/limites/map/layer-loader.js`
- `js/limites/chart/municipios/chart.js`
- `js/limites/data/timeline.js`
- `js/limites/legend.js`

El objetivo fue identificar cuellos de botella y aplicar solo mejoras que no cambian la logica funcional.

## Flujo observado antes de optimizar

Al seleccionar un departamento o municipio, el flujo municipal ejecutaba:

1. Crear o reutilizar capa municipal con `definitionExpression` base.
2. Consultar geometria territorial para ampliar lineas costeras.
3. Consultar lineas costeras por interseccion.
4. Consultar lineas normales para filtrar cierres costeros.
5. Aplicar `definitionExpression` enriquecido.
6. Consultar `queryExtent`.
7. Consultar `queryFeatures` para leyenda, renderer y estado del grafico.
8. Reconstruir renderer.
9. Reconstruir leyenda.
10. Renderizar grafico.
11. Si hay municipio, consultar tabla PA_LLI para linea de tiempo.
12. Consultar nombres de lineas para la linea de tiempo.
13. Renderizar linea de tiempo.
14. Actualizar resumen.
15. Ejecutar zoom.

## Hallazgos

### 1. Consulta duplicada del grafico municipal

`main.js` ya consultaba las features con:

```js
layer.queryFeatures({ where: enhancedWhereClause, ... })
```

Luego `renderChartMunicipios` volvia a consultar la misma capa cuando no recibia `prefilteredFeatures`. Esto duplicaba una consulta de atributos para los mismos `LLIdentif`.

### 2. Consulta duplicada de nombres en linea de tiempo

`fetchTimelineData` consultaba la tabla PA_LLI y, en paralelo, volvia a consultar `MapServer/0` para obtener `LLNombre`. Esos nombres ya estaban disponibles en las features consultadas por `main.js`.

### 3. Zoom tardio

El `queryExtent` se resolvia junto con las features, pero el zoom se ejecutaba al final, despues de grafico, timeline y resumen. Esto no cambiaba el resultado, pero empeoraba la percepcion de velocidad.

### 4. Render intermedio de capa municipal

El loader municipal dejaba visible la capa con el filtro base. Despues `main.js` aplicaba el filtro enriquecido con costeras. En municipios costeros esto podia causar un render inicial y luego otro render con el filtro final.

### 5. Eventos duplicados

Los listeners principales de leyenda y grafico tienen guardas (`legendHandlerAttached`, `chartSyncAttached`). No se detecto duplicacion directa en esa ruta.

### 6. Grafico y leyenda

La leyenda reconstruye DOM completo cuando llega una nueva seleccion territorial. Eso es aceptable para cambios de municipio/departamento. En toggles, no reconstruye la leyenda completa, solo cambia clases y filtra grafico.

El grafico se destruye y recrea para cada cambio. Optimizarlo con actualizacion incremental seria posible, pero implica mas riesgo visual y de estado, por lo que no se aplico en esta fase.

### 7. Consultas espaciales

Las consultas `intersects` para lineas costeras son necesarias para limitar la carga al territorio seleccionado. La excepcion de La Guajira se mantiene acotada a la geometria del municipio/departamento seleccionado y a jerarquia costera.

## Optimizaciones aplicadas

### 1. Reutilizacion de features para grafico

`main.js` ahora pasa las features ya consultadas a `renderChartMunicipios` mediante `prefilteredFeatures`.

Resultado esperado: se elimina una consulta redundante a `MapServer/0` por carga municipal.

### 2. Reutilizacion de nombres para linea de tiempo

`fetchTimelineData` acepta `options.lineNames`. Cuando `main.js` ya tiene `LLIdentif -> LLNombre`, la linea de tiempo no vuelve a consultar esos nombres.

Resultado esperado: se elimina una consulta redundante a `MapServer/0` cuando hay municipio seleccionado.

### 3. Zoom adelantado

El zoom se ejecuta apenas estan listos `extent` y renderer, antes de construir leyenda, grafico, timeline y resumen.

Resultado esperado: misma extension final, mejor percepcion de respuesta.

### 4. Evitar render municipal con filtro intermedio

`createOrUpdateMunicipiosLayer` deja la capa invisible hasta que `main.js` aplica el `definitionExpression` final y asigna el renderer. Luego se muestra una sola vez.

Resultado esperado: menos parpadeo y menos dibujo intermedio con filtro base.

## No modificado por riesgo funcional

- Logica de filtros municipales y departamentales.
- Popups.
- Interaccion grafico a mapa.
- Interaccion leyenda a mapa.
- Interaccion leyenda a grafico.
- Timeline visual.
- Formato de leyenda.
- Estrategia de consulta costera.
- Render departamental.

## Plan de siguientes fases

1. Instrumentar tiempos con `performance.mark` para medir seleccion, consultas, renderer, grafico, timeline y zoom.
2. Medir en casos pesados: La Guajira completo, municipio costero de La Guajira y departamento no costero.
3. Evaluar cache de features por `enhancedWhereClause`, con invalidacion por seleccion.
4. Evaluar cache de timeline por lista ordenada de `LLIdentif`.
5. Revisar actualizacion incremental de Chart.js solo si el costo del grafico sigue siendo alto.
6. Considerar cache de extensiones por `where`, especialmente para interacciones grafico/leyenda.

## Pruebas sugeridas

- Seleccionar La Guajira en Limites Municipales.
- Seleccionar un municipio costero de La Guajira.
- Seleccionar un departamento no costero.
- Seleccionar un municipio no costero.
- Alternar items de leyenda.
- Seleccionar y restaurar barras del grafico.
- Abrir popup de una linea.
- Usar eventos de linea de tiempo para zoom.
- Cambiar a Limites Departamentales y validar que no cambie el comportamiento.
