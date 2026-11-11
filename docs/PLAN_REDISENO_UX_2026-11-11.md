# Plan de rediseño de la portada — 11 de noviembre de 2026

## Problema que resuelve

La portada mezclaba navegación, contexto académico y decenas de actualizaciones en un párrafo inicial. El menú duplicaba un catálogo de 35 padecimientos, la figura mostraba decenas de botones y casi 3.000 líneas de estilos acumulados dificultaban sostener una jerarquía visual coherente.

La nueva portada permite elegir una tarea, localizar un padecimiento y distinguir datos observados, pronósticos y controles estacionales.

## Orden de la experiencia

1. **Orientación inmediata.** Encabezado compacto con cuatro destinos y acceso a EPI. Un titular breve explica el propósito; la edición del boletín identifica el corte de los datos.
2. **Primera exploración.** La figura nacional usa datos reales existentes y un selector de padecimiento. La leyenda, las unidades, las fechas, la escala y el corte se mantienen junto a la curva.
3. **Elección por tarea.** Radar para consultar observaciones, galería para explorar pronósticos y EPI para preguntar con fuentes. El tablero histórico identifica explícitamente su corte W31.
4. **Localización por tema.** Catálogo de los 35 padecimientos, búsqueda por nombre, código CIE-10 y alias existentes, filtro por área de salud y acceso directo al resultado. Las primeras ocho fichas reducen el recorrido inicial; la búsqueda y los filtros muestran todas las coincidencias.
5. **Lectura progresiva.** Cada ficha conserva la explicación científica en «Cómo se obtuvo». Los controles estacionales llevan una etiqueta diferente. La validación se remite al estado vigente de cada página, sin convertir «publicado» en «validado».
6. **Profundización voluntaria.** Noticias, metodología, cohorte original, investigación y atribuciones se consultan después de las herramientas. Los accesos a WCP, MICAI, equipo, auditoría y referencias permanecen disponibles.

## Sistema visual

Fondo claro, verde institucional, tipografía del sistema y una sola hoja de estilos. La figura conserva un panel oscuro para mantener legibles las paletas de las series existentes. Espaciado y tamaños comparten una escala consistente. Los módulos se apilan en móvil; el menú se abre con botón y la figura utiliza un selector nativo en todas las anchuras.

## Accesibilidad y estados

- Enlace para saltar al contenido, estructura semántica, navegación con nombre y foco visible.
- Búsqueda y selector con etiquetas; contador de coincidencias anunciado sin mover el foco.
- Menú móvil con `aria-expanded`, cierre con Escape y devolución del foco al botón.
- Todos los padecimientos accesibles sin JavaScript; los filtros se activan al cargar la mejora progresiva.
- Mensaje de búsqueda sin resultados con enlace al radar.
- Error de carga de la gráfica explicado con acceso a la galería; no se conserva un estado «cargando» indefinido.
- Preferencias de movimiento reducido respetadas por el desplazamiento y la gráfica.

## Contratos que se conservan

`newsBannerRow`, sus clases y su bloque estático mantienen la forma que utilizan el generador semanal y el gate de cifras. La hidratación de noticias continúa leyendo `news.json`. Las series siguen saliendo de `hero_series.json` y las vistas de publicación existentes, sin recalcular ni modificar los datos. El catálogo conserva los 35 nombres, descripciones, códigos y enlaces originales. El indicador de motor líder mantiene sus anclas dentro del detalle de la cohorte original, cuyo alcance se aclara.

## Criterios de aceptación

- Radar, galería y EPI están a un clic desde la portada.
- Los 35 padecimientos se pueden localizar y abrir; buscar sin tildes debe encontrar nombres acentuados, y un código CIE debe encontrar su ficha.
- Elegir otra serie actualiza figura y descripción sin generar decenas de botones.
- La portada permite llegar al contenido con teclado y no presenta desbordamiento horizontal en móvil.
- Noticias estáticas y dinámicas coinciden con `news.json`; los gates de cifras y RAG continúan aprobando.
- Se preservan los estados científicos y las atribuciones; ningún control se presenta como pronóstico validado.
- Antes del cierre se comprueban la versión pública, CI y sincronización del par backend/frontend según `AGENTS.md`.

## Medición posterior

Si existe analítica autorizada, evaluar cuántas visitas llegan a radar/galería/EPI, uso de búsqueda y búsquedas sin resultados. Contrastar con una prueba de tareas con personas: localizar Diabetes II, consultar notificaciones de Dengue y encontrar el estado de validación de un control estacional. Este documento define la evaluación; no afirma pruebas con usuarios realizadas.
