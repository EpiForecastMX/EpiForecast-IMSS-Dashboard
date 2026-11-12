## Orden vigente del autor: cierre sincronizado en main (5-nov-2026)

El autor ordenó: «no dejar nada en ramas, todo siempre sincronizado». Aplica a
EpiForecast-MX y EpiForecast-IMSS-Dashboard y prevalece sobre recetas históricas
que terminaban dejando el checkout en una rama de trabajo.

- Las ramas y worktrees de desarrollo son temporales. El trabajo terminado debe
  quedar integrado en `main` y enviado a `origin/main`; ambos checkouts principales
  deben terminar en `main`, sin cambios pendientes de la tarea y sin divergencia.
- Antes de integrar, inventariar ramas, worktrees, stashes y cambios locales.
  Respaldar y verificar por hash los cambios ajenos; resolver los conflictos sin
  descartarlos. Nunca usar `reset --hard`, `clean`, force-push ni borrar trabajo
  único para aparentar sincronización. Un stash o una etiqueta de respaldo no
  equivalen a integración ni a cierre.
- Tras integrar y verificar CI, retirar las ramas locales y remotas ya contenidas
  en `main` y los worktrees temporales propios; conservar antes sus runs y evidencia.
  Las ramas con commits únicos requieren revisión e integración; no se borran ni
  se fusionan a ciegas. No abandonar silenciosamente cambios ajenos pendientes.
- Verificar con red `fetch --prune`, `HEAD == main == origin/main`, el SHA real de
  `refs/heads/main` en origin, estado del árbol, ramas restantes y CI del SHA final.
  Comprobar backend y frontend como un par; el despliegue público requiere además
  comprobar la versión servida. No confundir una referencia remota local con red.
- Si falta red, acceso o una decisión sobre cambios ajenos, el cierre queda
  bloqueado con el motivo y los pendientes exactos. No afirmar «todo sincronizado»
  ni «cerrado» por tener una PR fusionada o por conservar una copia en /tmp.
- La sincronización no autoriza reentrenar, reabrir 2025, cambiar criterios de
  aceptación, publicar otro padecimiento ni modificar artefactos sellados.

# Instrucciones para Claude Code

## Checkpoint vigente — lote alta20 publicado — 12-nov-2026

El sitio sirve 55 padecimientos: 4 del carril original y 51 releases del runner. Veinte se añadieron el
12-nov-2026: diez portafolios aceptados en la prueba de 2025 (validación prospectiva 0/4 en curso) y diez
controles estacionales no validados, publicados tras su rechazo por autorización nominal del autor. Las
cifras vigentes salen de `publication/catalog.json`; los contratos del carril original (432 series, hero con
4 series) no cambian. Guía y decisiones pendientes en el backend: `docs/C7_15_ALTA20.md` y
`docs/alta20/DECISIONES_PENDIENTES.md`. En el EpiBot, el alcance por nombre y código CIE vive en
`epibot/js/release_catalog.js` y el estado de un control en la función RAG sale de su vista
(`estadoDeControl` en `epibot/netlify/functions/rag.mjs`); pruebas en `epibot/tests/test_alcance_*.mjs`.
Cierre del lote: frontend `939e1d86`. Al 12-nov-2026 el `main` del frontend no tenía checks de GitHub:
consultar los del SHA final y, si no hay, verificar el despliegue por el contenido servido.

## Salida de sesión WCP — estado único vigente — 9-sep-2026

**Trabajo operativo cerrado por ratificación expresa del autor.** Póster inglés
cargado al WCP y web publicada. No repetir carga, rediseño o petición de ratificación.
Par EN ec5ebd80… / ES 8a0a9018… intacto; frontend f02d2d16656ca1365d2b0a351109fb3be396457e.
35 criterios registrados por hash; 46+52 controles y 22 de exportación correctos.
Sello 110 piezas; manifiesto documental 103. EN 24/24, ES 23/24+C03 aceptada.
Salida final: las nueve dependencias recuperadas ya están en RATIFICATION_FILES
del exportador y son obligatorias también al verificar. No reponerlas sólo a mano
ni regenerar desde el carril antiguo de 94 piezas. Evidencia exacta en
`poster/auditorias/ratificacion_2026-09-09/INVENTARIO_RECUPERADO.json` dentro de Mundial.
Índice de salida desde workspace: `planes/SALIDA_WCP_2026-09-09.md`.
Gobernante: 13 PASA, 3 EXC, 13 N/A y 4 FALLA por formularios nominales sin
respuestas/firmas; no confundir la ratificación global del autor con jueces
independientes. EXC y N/A nunca se suman como aprobaciones. No abrir tareas
automáticas por esa diferencia documental.

Desde la raíz del workspace, leer únicamente para reanudar:
- `EpiForecast-MX/Congresos/Mundial/ESTADO_ACTUAL_WCP.md`.
- `planes/PROMPT_REANUDAR_WCP_ENVIADO_2026-09-09.md`.
- `POSTER_WCP_2026/RATIFICACION_Y_CIERRE_2026-09-09.md`.

Los checkpoints WCP inferiores son históricos, incluso donde dicen «vigente»,
«sin ratificar», «no registrado», «no publicado» o manifiesto 93/94. No ejecutarlos.
No cambia la continuidad de Obesidad u otros carriles. Cambios de memoria locales;
sin commit/push/deploy en esta salida. Preservar árboles sucios y artefactos sellados.

## WCP — cierre ratificado por el autor — 9-sep-2026

Prevalece sobre los checkpoints WCP inferiores. El autor declaró «ya esta todo
ratificado y validado cierra todo ya pues». Esquema registrado: 35 criterios
G11/G12/G14/G15, ligados al par por SHA-256 y no por carpeta. No volver a pedir
ratificación, ejecutar planes históricos, rediseñar ni repetir la carga.
PDF EN ec5ebd80… / ES 8a0a9018… intactos; WCP cargado y web vigente f02d2d16.
Sello 97; manifiesto documental 103, con el anterior 94 conservado como antecedente.
46 controles históricos + 52 del registro correctos. Excepciones G2/G5/G19
aceptadas y separadas de PASS; C03 ES conserva su excepción. La declaración del
autor no se transforma en respuestas o firmas nominales de jueces no aportadas.
No afirmar certificación independiente ni abrir tareas automáticas por esa
distinción. Cierre: POSTER_WCP_2026/RATIFICACION_Y_CIERRE_2026-09-09.md.
Estado: EpiForecast-MX/Congresos/Mundial/ESTADO_ACTUAL_WCP.md.
Sin commit, push, despliegue o actuación en el portal en esta ratificación.

## WCP — carga registrada y web vigente comprobada — 8/9-sep-2026

**Prevalece para la continuidad WCP sobre las secciones históricas inferiores.**
El autor ya cargó el póster inglés #3134: el portal muestra
`WCP2026ePoster3134Rebull`, **09.09.2026 03:19**, E-POSTER VIEWING.
La subida no es pendiente. Capturas conservadas; no se descargó la copia del
portal ni se afirma aprobación editorial o carga ES.

El sitio del QR ya sirve el par vigente, verificado por descarga pública:
EN `ec5ebd80…` / ES `8a0a9018…`, inglés inicial,
`Reports/wcp2026/2026-09-08-8a0a9018/`.
Frontend HEAD y referencia local origin/main:
`f2141bbacbcd8b692fedda1199ace3b889a070a0`.
No listar como pendiente publicar este par. No se hizo push/deploy en este cierre.

Estado autoritativo y hashes completos, rutas desde la raíz del workspace:
- `EpiForecast-MX/Congresos/Mundial/ESTADO_ACTUAL_WCP.md`.
- `POSTER_WCP_2026/REGISTRO_SUBIDA_WCP_2026-09-09.md`.
- Handoff: `planes/PROMPT_REANUDAR_WCP_ENVIADO_2026-09-09.md`.

Preservar la entrega lema_congreso: EN 24/24; ES 23/24 más excepción de densidad
ligada al hash, no un PASS adicional. Sello 97 piezas; manifiesto 93 piezas.
Cuatro revisiones humanas y contrato interno 960×540/12 pt siguen sin cerrarse;
no se dispensan por la carga. No hubo financiamiento; título aceptado intacto,
siete apellidos con guion. No reabrir diseño ni ejecutar prompts de opciones 7–9.
La hoja sellada y las versiones históricas se conservan intactas; el nuevo estado
documenta los eventos posteriores. Ninguna nueva acción externa está autorizada
por esta actualización de memorias.

## Git / Commits
- **NUNCA agregar Co-Authored-By** en los mensajes de commit.
- Los commits deben llevar únicamente el nombre del usuario, sin líneas de co-autoría.

## Sitio público (páginas y noticias)

- **Publicar una noticia toca cinco superficies, no una**: `news.json` (el item nuevo va
  primero), la página propia del hito si la merece, el color del tag `.news-tag--<type>` en
  `index.html`, **el banner estático de `index.html`** y `sitemap.xml`. El banner estático es
  el respaldo para cuando falla el `fetch` de `news.json` y **no se actualiza solo**: si no se
  toca, el sitio anuncia como «lo más nuevo» algo viejo cada vez que la red falla. Receta
  completa y convenciones de las fotos en el README.
- **El gate de cifras alcanza a cualquier página nueva.** `npm run cifras:verify` recorre
  **todo** el `.html`/`.json` publicado desde la raíz (41 archivos hoy), no una lista escogida
  a mano. Una nota que escriba «435 modelos» tumba el despliegue.
- **Nunca `<img src="">` ni `img.src = ''`.** Un `src` vacío **no** deja la imagen vacía: se
  resuelve contra la URL del documento, así que el navegador se trae el HTML de la propia
  página y después no lo puede decodificar. El `<img>` del lightbox nace **sin atributo**
  `src` y al cerrar se usa `removeAttribute('src')`. Estuvo mal en las cuatro páginas con
  lightbox (`calass`, `helix`, `future_health`, `dengue`) hasta el 31-ago-2026.
- **Para validar en móvil, `chrome --headless --window-size` MIENTE.** En headless de
  escritorio Chrome no aplica el `<meta name="viewport">`: compone a un ancho mayor y recorta,
  así que inventa defectos que no existen (los «reproduce» hasta en páginas que llevan meses
  en producción). Emular de verdad exige CDP —`Emulation.setDeviceMetricsOverride` con
  `mobile:true`—, y el texto recortado se **mide** (`scrollWidth > clientWidth` en elementos
  con overflow oculto), no se mira: a 390 px un corte pasa por final de línea.

## EpiBot (`epibot/`)
- **Cache-bust al tocar `kb.js`/`entities.js`**: sube `app.js?v=N` en `index.html` (la de **afuera**), además del `?v` interno del import de `kb.js`. Sin bumpear `app.js?v` el navegador sigue corriendo el `app.js` viejo cacheado (que importa el `kb.js` viejo) y tu cambio no aparece aunque el deploy haya llegado bien.
- **Cache-bust al tocar `knowledge.json`**: sube `DATA_VERSION` en `epibot/js/kb.js`. **No es opcional.** Las cabeceras que mandan son las del `netlify.toml` de la **raíz** (`publish = "."`), y ahí `knowledge.json` va con `public, max-age=3600` — no con `no-cache`, como decía este archivo hasta el 24-ago-2026. El `epibot/netlify.toml` que aún declara `no-cache` parece vestigial de cuando EpiBot era un sitio aparte.
- **Cabeceras vigentes** (`netlify.toml` de la raíz): `/epibot/js/*` y `/epibot/css/*` con `max-age=300`; `/epibot/knowledge.json` con `max-age=3600`. Un hard refresh (Cmd+Shift+R) basta si el server ya tiene los archivos nuevos.
- **Cifras públicas**: el vocabulario (333 neuro · 99 dengue · 432 series productivas · 432 gráficos en la ronda W37; antes 444) está congelado en `EpiForecast-MX/docs/CONTRATO_VOCABULARIO_CIFRAS.md` y lo comprueba `npm run cifras:verify`, que corre sin API key y va **antes** que el índice en `rag:ci`. El `knowledge.json` se corrige en su generador (`EpiForecast-MX/scripts/build_web_knowledge.py`), nunca a mano ni reparándolo en el navegador.
- **Cuadros de rendimiento 2026**: el handler `answerRendimientoPorPadecimiento` (+ helper `_cuadroDengue`) dibuja las tablas de SMAPE/MASE por padecimiento × motor (neuro + Dengue) desde la sección `rendimiento_2026` de `knowledge.json` (que genera el repo principal, `EpiForecast-MX/scripts/build_web_knowledge.py`). Está registrado **antes** de `answerMatrizRendimiento` en la cadena `HANDLERS`. Para Dengue específico, `answerDengue` tiene una rama que devuelve el mismo cuadro ante "rendimiento/mase/cuadro de dengue".
