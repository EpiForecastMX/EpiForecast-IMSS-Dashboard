# Plan del dashboard integral

La primera versión sólo ofrecía cuatro padecimientos. La mejora incorpora todas las publicaciones instaladas y herramientas de análisis dentro del dashboard, con los mismos datos y estados científicos de sus fuentes.

## Alcance comprobado al iniciar, 11 de noviembre de 2026

El inventario contiene cuatro padecimientos legacy y 31 releases publicados. Sus 432 y 3,145 series suman 3,577 productos explorables. Cuatro releases sólo tienen General; no se les atribuye desglose por sexo. Las vistas actuales distinguen 12 controles estacionales, 18 validaciones en curso y una superada. El boletín vigente contiene 187 categorías no agregadas, de las que 180 tienen bloques estatales de 32 entidades y siete sólo presentan filas nacionales. El bloque agregado adicional permanece fuera del conteo.

Estos conteos son evidencia del inventario inicial, no constantes de la aplicación. La cobertura se calcula desde las fuentes instaladas en cada build.

## Etapas y condiciones de aceptación

### 1. Catálogo completo y adaptadores

Generar un catálogo ligero desde las fuentes legacy y todos los miembros públicos del catálogo de releases. Validar identidad, esquema, estado, número de productos, nombres, sexos y territorios. Una vista ausente o incompatible debe detener el build, sin excluir silenciosamente un padecimiento. El estado y seguimiento visibles proceden de la vista actual, no del catálogo inicial potencialmente anterior.

Aceptar sólo cuando la lista del dashboard coincida exactamente con el conjunto publicado y los valores observados y pronosticados sobrevivan a la normalización, sin redondeo adicional ni imputación.

### 2. Herramientas para el usuario

- Panorama de todos los padecimientos, buscador, filtros de estado y entrada directa al explorador.
- Exploración por enfermedad, sexo, territorio y periodo, mapa real de México, orden territorial, tabla, inspector semanal y ficha de procedencia.
- Comparación de hasta cuatro territorios del mismo padecimiento y sexo, en valores absolutos o base 100, con fechas comunes y base positiva compartida.
- Perfil temporal de los observados con matriz año por mes, promedio o suma y número de valores; selección de celda para explorar su periodo.
- Vigilancia de todas las categorías no agregadas del boletín, con filtros, corte propio y detalle estatal cuando existe.
- CSV y gráfico SVG descargable, contexto de la selección y enlaces compartibles.

Aceptar con pruebas reales de cada herramienta en escritorio y móvil. Un enlace a otra página no sustituye estas funciones.

### 3. Fidelidad y comunicación

Conservar los números, signos y ausencias de las fuentes. Distinguir productos derivados de modelos entrenados; no sumar padecimientos o ámbitos superpuestos. Separar emisión real, origen del modelo, fecha del índice y último boletín observado. Identificar los controles y las validaciones pendientes sin presentarlos como PASS. No añadir métricas retiradas, tasas sin denominador, alertas de riesgo ni nuevos intervalos.

Los periodos con distinto origen conservan su contexto. Las comparaciones temporales se limitan a series de un mismo padecimiento y fuente. Los meses sin datos no se convierten en cero ni los años parciales se presentan como años completos.

### 4. Verificación independiente

Pruebas unitarias y de integración sobre todas las publicaciones, condiciones adversas, cobertura del boletín y conservación de valores. Revisión de Opus en una sesión nueva sin historial de implementación. Corregir hallazgos reproducibles y volver a verificar las rutas afectadas.

La evidencia de integridad y funcionamiento no se presenta como certificación de calidad de los pronósticos.

### 5. Publicación y cierre

Validar en Netlify preview, integrar por PR y comprobar producción contra el SHA final y los assets servidos. Terminar backend y frontend en main, limpios y sincronizados con el remoto real. Retirar las ramas temporales propias después de verificar la integración.

No se reentrena, no se reabre 2025, no se promueven nuevos padecimientos y no se alteran artefactos sellados. El archivo Tableau se conserva íntegro, oculto y bajo demanda.

## Mantenimiento

El catálogo del dashboard es un artefacto de build generado desde las vistas instaladas, no otra lista manual de padecimientos. Los nuevos miembros ya publicados entran por ese contrato. Una nueva publicación científica sigue necesitando su procedimiento propio y no la autoriza este dashboard.
