# Dashboard epidemiológico integral

`/epidashboard` consume las fuentes publicadas del proyecto y dibuja sus propios SVG, sin Tableau ni bibliotecas de gráficos externas. El plan y los criterios de aceptación están en `docs/PLAN_DASHBOARD_V2.md`.

## Herramientas

- **Panorama:** catálogo completo en tarjetas o tabla, búsqueda por nombre o CIE, filtro de estado, cortes individuales y entrada directa a las herramientas. No ordena padecimientos por un total de horizontes diferentes ni los suma.
- **Explorar:** padecimiento, sexo y territorio disponibles en la fuente; ventana y rango de fechas del índice; visibilidad de observado/pronóstico; mapa, orden territorial, inspector semanal, tabla paginada y ficha de procedencia. CSV y SVG autocontenido.
- **Comparar territorios:** hasta cuatro del mismo padecimiento y sexo, sólo fechas comunes, valores absolutos o base 100. La base es la primera fecha compartida con observado positivo para todas las series. Si no existe, se avisa y no se inventa un índice. Los territorios no se suman entre sí.
- **Perfil temporal:** matriz año por mes de observados, promedio semanal o suma, número de valores y ausencias. Una celda fija el rango de exploración y comparación. Los años parciales se identifican; no son evidencia de cambio de riesgo o de causalidad.
- **Vigilancia:** todas las categorías no agregadas del snapshot vigente del boletín, con búsqueda, grupo, cobertura y detalle. Se conserva el corte propio de cada cuadro y la página precisa del PDF. Sólo se muestran estados donde existen filas estatales; no se generan pronósticos para las categorías sin modelo publicado.

## Fuentes y catálogo de build

`npm run build:dashboard` genera `assets/dashboard/catalog.json` de forma determinista, sin red ni reloj, desde:

- `Reports/zoom_data_neuro.json` y `Reports/zoom_data_dengue.json`;
- `publication/catalog.json`, para decidir el conjunto publicado;
- `publication/<id>/vista.json`, para cada miembro elegible y su estado actual;
- hashes SHA-256 de esas fuentes.

El catálogo generado está ignorado por Git y se reconstruye antes de las pruebas y en cada build de Netlify. No crea una segunda lista manual de padecimientos ni modifica las vistas. Carga inicialmente unos 98 KB en el inventario del 11-nov-2026; las vistas completas se solicitan al seleccionar un padecimiento.

Ese inventario contiene 35 padecimientos y 3,577 productos: 432 legacy y 3,145 desde 31 releases. Cuatro releases sólo tienen General; sus otros sexos no se inventan. La vigilancia vigente ofrece 187 categorías no agregadas: 180 con 32 entidades y siete sólo nacionales. Estos números se calculan en ejecución y pruebas; no fijan la cobertura futura.

`lifecycle=published`, `mode=public`, visibilidad y canal web gobiernan la inclusión. `gallery_enabled=false` no excluye un miembro de este dashboard. Identidad incompleta, vista ausente, esquema incompatible o veredicto no publicable detienen el build. `CONTROL_ONLY` es control, nunca PASS.

## Contexto científico

El estado, etiqueta y semanas de seguimiento salen de la **vista actual**, que puede ser posterior al catálogo de instalación y al knowledge del release sellado. La emisión real se muestra separada del origen; un origen pasado no acredita que se emitiera antes de las observaciones.

Los productos derivados del runner no se cuentan como modelos entrenados independientes. Sus totales proceden de la vista publicada. En el carril legacy, los totales se calculan desde el JSON visual redondeado y pueden diferir del resumen productivo. General usa casos semanales; Hombres y Mujeres usan incrementos netos del acumulado, sujetos a revisiones. Los ceros, negativos y ausencias se conservan.

Las fechas `d` y `ds` son índices de las series, no un reemplazo del calendario oficial del boletín. No se desplazan valores para hacerlas coincidir. El origen y la última semana observada se muestran con sus metadatos epidemiológicos, y el eje, la tabla y los exportes identifican sus fechas como índices. El pronóstico sólo se presenta después de la frontera del corte; lo anterior no se vende como pronóstico.

No se publican las métricas de selección retiradas, nuevas tasas sin denominador, alertas de riesgo o intervalos inventados. La comparación posterior al corte es descriptiva y no acredita precisión. La verificación del código y de los hashes demuestra integridad y funcionamiento, no calidad predictiva.

## Vigilancia y celdas

`assets/boletin/actual.json` selecciona la carpeta de datos. `surveillance.mjs` usa `celdas.mjs` para interpretar cada cifra o marcador. Un guion sólo vale cero para calcular si la simbología de esa categoría y año lo permite. Cifras no publicadas y marcadores sin valor comparable permanecen distintos de cero. La columna del año anterior conserva su propio año semántico.

La cobertura de pronósticos se contrasta con el catálogo vigente. Buscar o filtrar no debe dejar el detalle de una categoría ajena al conjunto visible. Las 37 categorías de vigilancia cubiertas en el corte inicial corresponden a 35 padecimientos distintos, no a 37 modelos nuevos.

## URL, exportes y errores

`vista=panorama|explorar|comparar|perfil|vigilancia` selecciona herramienta. `p,s,t,v,m,desde,hasta,ser,c,cm,pm` conservan selección, ventana, rango y comparación. Una URL anterior con `p` pero sin `vista` abre el explorador. Un sexo o territorio no disponible produce un aviso explícito.

Los CSV incluyen contexto de fuente, origen, observación, emisión, estado y unidades. Las celdas ausentes quedan vacías; la fórmula de base 100 no cambia los valores originales. Los SVG llevan estilos, leyenda y procedencia embebidos, con texto envuelto para que el contexto no se recorte. Mostrar u ocultar una línea no cambia el total de la emisión completa, que se identifica como tal.

La caché comparte promesas y elimina fallos para permitir reintento. Las respuestas antiguas se descartan; durante una carga o tras un fallo se ocultan los datos de la selección previa. No se requiere almacenamiento local ni servicios externos.

## Archivo Tableau

`EpiDashboard-tableau.html` conserva la página anterior byte por byte. SHA-256: `dc48e2ba9cdcf9bfbbd16d9af24a62092d79d83001a690c126c3a578a0fac92d`.

`/epidashboard?archivo=tableau` revela su pestaña; el iframe sólo se crea al solicitar la carga histórica. La experiencia normal no solicita recursos Tableau. El archivo está excluido de buscadores con `X-Robots-Tag: noindex, nofollow`.

## Verificación y operación

`npm run test:dashboard` genera el catálogo y ejecuta sintaxis, pruebas de adaptadores, todos los productos instalados, estados, sexos ausentes, comparación, perfil, vigilancia, CSV, SVG y procedencia. `node scripts/build_dashboard_catalog.mjs --check` comprueba que el artefacto local coincide con las fuentes.

Antes de publicar se verifican también las suites y gates existentes del frontend, una auditoría independiente de Opus y QA de las herramientas en escritorio y móvil. La versión pública se compara con el SHA final del despliegue y con los archivos servidos. No se reentrena, no se promueven nuevos padecimientos y no se cambian artefactos sellados por ampliar este dashboard.
