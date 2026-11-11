# Dashboard epidemiológico nativo

El dashboard público (`/epidashboard`, fuente `EpiDashboard.html`) consume los JSON instalados del sitio y dibuja sus propios SVG. No necesita Tableau ni bibliotecas de gráficos externas. Comparte la identidad visual clara de la portada y la galería.

## Fuentes y alcance

- `Reports/zoom_data_neuro.json`: 333 series de Depresión, Parkinson y Alzheimer.
- `Reports/zoom_data_dengue.json`: 99 series de Dengue.
- `mexico_paths.json`: geometrías de las 32 entidades.

El dashboard enlaza a la galería y al boletín para los demás padecimientos publicados. No modifica releases, modelos, datasets, criterios de aceptación ni artefactos sellados.

`assets/dashboard/data.mjs` normaliza las claves y calcula las vistas; `dashboard.mjs` maneja el DOM y las selecciones. Las fuentes se cargan por cohorte, con caché y descarte de respuestas antiguas. Un fallo oculta la selección previa y permite reintentar.

## Lectura de las cifras

Cada combinación conserva su propia serie. No se suman nacional, estados, regiones o sexos entre sí. La distribución cuenta asignaciones de motores, no precisión. El mapa y el orden territorial muestran conteos absolutos, sin ajuste por población.

Sólo `y` posterior a `ds_corte` se presenta como pronóstico emitido; los puntos anteriores son ajuste y se excluyen. `last_real` separa el tramo con observaciones del tramo aún no observado. Los totales se calculan desde las cifras redondeadas de los JSON visuales, y pueden diferir del resumen productivo. Se conservan ceros, negativos y ausencias; el CSV deja las ausencias vacías.

Las fechas `d`, `ds_corte` y `last_real` son índices de las series. No se transforman en fechas oficiales del boletín. El corte y la última semana integrada se muestran con sus metadatos epidemiológicos; el eje, la tabla y el CSV identifican sus fechas como índices. No se desplazan valores para ajustar calendarios. La comparación posterior al corte es descriptiva, sin calificaciones de desempeño ni bandas de incertidumbre.

## Archivo oculto

La página anterior se conserva byte por byte en `EpiDashboard-tableau.html`. SHA-256 original: `dc48e2ba9cdcf9bfbbd16d9af24a62092d79d83001a690c126c3a578a0fac92d`.

Para mostrar la pestaña histórica: `/epidashboard?archivo=tableau`. El iframe se crea únicamente al pulsar «Cargar el archivo histórico». La experiencia normal no carga iframes ni recursos Tableau. El archivo tiene cabecera `X-Robots-Tag: noindex, nofollow`.

## Verificación

`npm run test:dashboard` ejecuta comprobaciones de sintaxis y pruebas con fixtures y fuentes instaladas: normalización de nombres, 432 series, 32 estados, separación de fases, horizontes, null/ceros/negativos, CSV, filtros, paginación, caché, carreras y ausencia de dependencias Tableau en la experiencia normal. Forma parte del build de Netlify, antes del gate del boletín.

El 11-nov-2026 se revisó con Opus 5.5, esfuerzo medium, y se probó en navegador a 1440 px y 390 px: controles, selección territorial con teclado, inspector semanal, tabla paginada y archivo bajo demanda. Los gates de cifras y RAG permanecen aplicables.
