# Auditoría y rediseño UX de EPI · 11 de noviembre de 2026

## Alcance y evidencia

Revisión de la interfaz anterior en escritorio y del rediseño a 1440 y 390 px, con consultas reales de prueba. Es una auditoría heurística y funcional; no se realizaron pruebas con participantes ni se midió una mejora de conversión. Se conserva la lógica de respuestas, detección de entidades, contexto, fuentes y datos publicados.

## Hallazgos y resolución

1. **Jerarquía inicial.** Cuatro indicadores de la cohorte original y herramientas técnicas aparecían antes de la consulta. Ahora se ofrecen cuatro tareas principales; los indicadores y herramientas permanecen en grupos desplegables, con su alcance explícito.
2. **Inicio poco orientado a tareas.** La bienvenida remitía al panel lateral. Ahora ofrece preguntas concretas por entidad, padecimiento y validación.
3. **Descubrimiento de consultas.** El menú largo no permitía buscar. Se añadió búsqueda por categoría, texto y consulta, sin eliminar destinos. Se verificaron coincidencias de diabetes y un término sin resultados.
4. **Lectura de respuestas extensas.** El desplazamiento al final dejaba fuera de pantalla el texto principal, por encima de la gráfica. Las respuestas completas se muestran desde el inicio; un botón permite ir al final. Si la persona subió a releer, no se mueve su posición. El flujo incremental conserva su seguimiento condicional.
5. **Composición.** La caja de una línea impedía redactar consultas en varios renglones. Ahora acepta Mayús+Enter, crece hasta una altura limitada y conserva Enter para enviar.
6. **Navegación móvil.** La detección anterior del teclado se basaba en la altura inicial y confundía un cambio de viewport con el teclado. Ahora requiere un editor enfocado, reducción real del viewport visual y ausencia de zoom. La cabecera permanece disponible.
7. **Foco y paneles.** Los paneles fuera de pantalla podían seguir recibiendo foco. Ahora los paneles cerrados no son enfocables; el cajón móvil recibe foco al abrir, lo contiene y lo devuelve al cerrar con Escape.
8. **Consistencia y legibilidad.** Se unificaron superficies claras, acentos verdes y tipografía del sistema. Se retiraron texturas y brillos del marco de conversación; se ajustaron tablas, fuentes y contraste de rótulos de gráficas.

## Regresión

Ocho pruebas nuevas cubren la apertura de respuestas largas, conservación de la posición de lectura, respuestas cortas, bienvenida, cambio de viewport, teclado enfocado, zoom y ausencia de API de viewport. Forman parte de `epibot/package.json:test:unit`.

Se ejecutan además las pruebas existentes de EPI, candidatos de publicación, WCP y boletín, y los contratos de cifras e índice RAG. La prueba visual cubre consulta por entidad, seguimiento, sugerencias, reinicio, composición y cajón móvil. La verificación final incluye la vista previa y la versión pública, con los SHA de Git y los hashes de sus archivos.

## Límites de la revisión

La simulación móvil verifica distribución y navegación, pero no sustituye pruebas en dispositivos físicos con todos sus teclados y lectores de pantalla. No se concedieron permisos nuevos de micrófono ni se afirmó una validación clínica. Las métricas científicas y el estado de validación de los padecimientos no cambian por este rediseño.
