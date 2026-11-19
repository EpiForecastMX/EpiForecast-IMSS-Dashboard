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

## Versión candidata alta_b44 (boletín 44, 19-nov-2026)

Prevalece en conteos sobre las secciones inferiores, que quedan como historia. **Versión candidata, sin desplegar:** la
producción servida sigue con la versión anterior hasta la revisión final, la integración en `main` y la comprobación del
contenido servido. Conteos del catálogo (`publication/catalog.json`, 141 releases visibles y `published`):

- **145 padecimientos en el sitio** = 4 del carril original + **141 releases del runner** (82 previos + 59 del lote
  alta_b44).
- Los 59 del lote: **14 portafolios aceptados** en su prueba única, **35 controles estacionales tras rechazo** (orden
  nominal del autor por id) y **10 controles sin alternativa** (un año de historia, el control fue el único candidato).
  Ningún control se presenta como validado ni como «validación en curso».
- **12 releases sensibles** (autolesión, ideación, violencia intrafamiliar, heridas por arma de fuego, intoxicación por
  alcohol y VIH): sólo se reconocen por su rótulo técnico o su código. Toda señal de riesgo personal (primera persona,
  menores, métodos, dosis, ingestiones, autolesión) recibe únicamente la respuesta de crisis con la Línea de la Vida
  (800 911 2000), sin cifras ni gráfica, y esa respuesta persiste en los seguimientos de la conversación
  (`epibot/tests/test_crisis_codex_b44.mjs`). Con un id sensible, sólo hay cifras si todos los términos de la consulta
  son vocabulario técnico cerrado (lista blanca única en `epibot/js/release_catalog.js`, compartida por EpiBot y RAG); las
  consultas mixtas no combinan cifras y F10.0 sólo cubre el alcohol sin calificativo, etílico o etanol
  (`epibot/tests/test_listablanca_codex_b44.mjs`).
  Criterio uniforme de fallar hacia la crisis: léxico de riesgo por formas verbales en español e inglés aunque el
  padecimiento no se resuelva, cualquier verbo de consumo en primera persona (falso positivo aceptado: «me tomé un café»),
  emojis de riesgo como señal explícita y otros símbolos como tokens no técnicos; sólo un turno enteramente técnico levanta
  la crisis (`epibot/tests/test_crisis3_codex_b44.mjs`).
- Las fichas muestran la **media observada** del total nacional en las 52 semanas hasta el corte, con su periodo, no la
  media del pronóstico (`epibot/tests/test_fichas_media_observada.mjs`).

## Versión con control A51 y fuente 2026-W44

Esta versión incorpora —como **versión candidata** previa al despliegue efectivo (mientras la producción actualmente servida en `https://epiforecast.mx/` permanece en **`85` padecimientos / `81` releases del runner y piloto `0/1`** hasta consumar la publicación real)— la configuración conjunta de **86 padecimientos para el sitio** (`4` del carril original + **82 releases del runner**, gobernados por `publication/catalog.json` y `config/padecimientos.yaml` del backend) en paridad `F5` sobre la **semana fuente `2026-W44`** (`dataset_boletin_epidemiologico.csv` consolidado candidato, sha256 `0f6252f94e78b4af62044f81abe3977006f7e1cadb45bab8baf1512fb823ad44`, `92,155,130` B; `BASE_85_W43` `8c21883a…` es prefijo byte a byte de `BASE_86_W43` `82b6bd85…`, y `BASE_86_W43` es prefijo byte a byte de este consolidado `W44`), junto con el `raw` actualizado de COVID-19 `2026-W44` (`cf66c8704d57d8239156a46d396da2c8edf2758b0ec9a783ca3b6d53a0e1daa4`) y su emisión protocolaria `2026-W44.json` (`c8c88c36…`, sin evaluación acumulada) en el backend como base previa para `N=45`.

- **Control estacional no validado de `sifilis_adquirida_a51` (`Sífilis adquirida`, `A51-A53`, `sifilis_adquirida_a51.html`, `lag=1`):** incorporado en esta versión candidata bajo `seasonal_naive_lag52` sin intervalos de incertidumbre (`sifilis_adquirida_a51_release_a18527def134`, entrenado hasta `2026-W42` desde fuente `43` sobre `sifilis_adquirida_a51_0cc942faddb8`, horizonte de `52` semanas desde el origen `2026-W43..2027-W42` y no `52` semanas futuras) por **autorización nominal directa del autor posterior al rechazo** (registro JSON local privado fuera de la web con sha256 opaco `8f3805d467815766228d2c34047bad9f69d80e7b9f1eed2e9bfa892a76e19d68`, instante de registro JSON `2026-11-17T01:20:40.821319+00:00` sin afirmar timestamp del mensaje de chat; en esta alta Fable audita de forma independiente y no decide —la delegación literal histórica de `alta20c` no se niega ni se hereda— ni equivale a firma humana ni a sello científico). El boletín `2026_sem44.pdf` (`2026-W43`) tuvo primera disponibilidad pública verificable (`2026-11-17T01:23:31.237010+00:00` UTC) **antes** de emitir el único pronóstico congelado (`2026-11-17T01:32:25.156213+00:00` UTC, `16 de noviembre de 2026` en Ciudad de México; observación separada `sifilis_adquirida_a51_eaca7efc1a11`, primer objetivo `2026-W43` conocido pre-emisión y no prospectivo); el contador `1/4 INCOMPLETE` es meramente técnico y transita a `CONTROL_ONLY` al completar `4` semanas sin aprobación científica (**nunca `PASS`**), con divulgación obligatoria de `MASE > 1` en `64/64` bases, `D1`, riesgos `K6` (sexo/errata `2015_sem40.pdf`, `32` filas vacías `keep_period` + `1` celda `n.e.` en `raw` frente a `66` filas modeladas imputadas y `0` en `2025`, `12` encabezados raster en corpus `<= W43` con encabezado `44` verificado aparte, alcance `A51-A53` sin `A50`/`O98.1` y desambiguación de `sífilis` a secas) y pico oficial de Coahuila (`250` en `2026_sem12.pdf` → objetivo `2026-W11` → eco `2027-W11`; guía en el backend: `docs/C7_18_PILOTO_CARBON.md` §5).
- **Disposición nominal real de `miasis` en `2026_sem44.pdf`:** autorización nominal directa del autor (registro JSON local privado fuera del repositorio web con sha256 opaco `febd17075686c7c63b7efe4e9e266ca8af865bfc0ca43c935d7741ca8530b45e`), exclusiva y no heredable para `2026_sem44.pdf` (`c6b328e4a88c293cbd9b912403b14f8e8a27ab54b780566fc51537b03b52d1a3`), pág. `81`, tabla `miasis`, col. `7`: suma estatal **`830`** frente al total impreso **`831`** (`delta = +1`) y **Chihuahua** `0 + 2 ≠ 1` (`0` en `2025`, `2` en `2026` y `1` impreso en el total; `29` entidades listadas sin imputar las `3` ausentes), conservando las cifras impresas intactas (`0` celdas modificadas) bajo `NO_RECONCILIADO` (etiqueta humana `NO RECONCILIADO`), sin crear tolerancias ni `PASS`. La foto `2026-w44` del radar (`assets/boletin/2026-w44/`) **ya está generada, visible localmente e instalada en el candidato de frontend**, exponiendo en `data.json` y `verification.json` (`myiasis_reconciled = false`) **únicamente la proyección técnica pública de `13` claves exactas** (`CLAVES_PROYECCION_MIASIS` —**`13` claves exactas, no `131`**— con hashes opacos SHA-256) y manteniendo el acta y el JSON de disposición completos en almacenamiento local privado **fuera de `assets/` y fuera de la web**; la fecha `16 de noviembre de 2026` de la fuente `44` se presenta como **fecha de referencia / primera disponibilidad comprobada** (`publication_date_basis = "first_verified_availability"`), sin afirmar fecha de publicación original desconocida.
- **Vigencia histórica y condición de despliegue verificado:** este bloque describe la configuración de **esta versión candidata** (la producción servida actual sigue en `85/81` y piloto `0/1` hasta el despliegue efectivo) y prevalece sobre las referencias inferiores fechadas al `15-nov-2026` (`2026-W43`) y sobre cualquier mención previa de `A51` a `lifecycle: configured` (`0/1`) o autorización de control pendiente (que se conservan como historia anterior a la autorización del control); **en cambio, la prueba única `test_2025` de `A51` (`sifilis_adquirida_a51_benchmark_test_73490ea8b2b5_749316ac335e`, `+27.716934 %` / `+27.7169 %` > `10 %` en nacional General) permanece definitivamente consumida y rechazada** (prohibido reabrir `2025`, reseleccionar o cambiar criterios). La disponibilidad pública efectiva en `https://epiforecast.mx/` está condicionada a la revisión final independiente (`Fable FINAL`, aún no emitida), la integración sincronizada en `main` de [EpiForecast-MX](https://github.com/EpiForecastMX/EpiForecast-MX) y [EpiForecast-IMSS-Dashboard](https://github.com/EpiForecastMX/EpiForecast-IMSS-Dashboard), las verificaciones remotas y la comprobación del contenido servido (ninguna se preafirma aquí; en el árbol candidato de backend `6c8021313f4589b070c726382ba8fe57abab882b` se verificó localmente la suite hidratada en `2,885 passed, 491 skipped, 66 deselected` con `6` docs propios en edición y sin equivaler a `main` integrado, y en el candidato local de frontend `fd10869af2fe17c06babd7ee14a4cea60c14557b` —sin push, PR ni deploy— se verificó el índice RAG real `epibot/rag_index.json` sha256 `c9ab21fd93f2a36fb92cea2a574ed71eebcfd5309c61ec65a1c3374d6a4a143b` con `806` vectores reales —`486` reutilizados y `320` nuevos bajo autorización nominal directa del autor para embeddings en Google Gemini— y `deploy:verify` local en `PASS`). Para consultar el estado operativo dinámico vigente, véase `planes/piloto_carbon_alta1_2026-11-15/ROOT_CURRENT_STATUS.json` (las instantáneas intermedias como `CURRENT_STATUS_CONTROL_v5.json` son registros históricos parciales que no constituyen cierre ni se reescriben) y, una vez consumado el despliegue real, el registro final de cierre verificado que emita `ROOT`.

## Checkpoint vigente — lote alta20c publicado — 15-nov-2026

Prevalece sobre las secciones siguientes en cuanto a conteos. El sitio sirve 85 padecimientos: 4 del carril original
y 81 releases del runner. Veinte se añadieron con alta20c: tres portafolios aceptados en su prueba única de 2025
(fiebre paratifoidea, mal del pinto y vulvovaginitis; validación prospectiva 0/4 en curso) y diecisiete controles
estacionales no validados por dictámenes delegados de Fable (delegación literal del autor del 15-nov; no son firma
humana): brucelosis, fiebre reumática, bocio, hepatitis B, rotavirus, absceso hepático amebiano, leptospirosis,
helmintiasis, desnutrición moderada y severa, enterobiasis, giardiasis, síndrome coqueluchoide, intoxicación por
plaguicidas, tos ferina, síndrome meníngeo e intoxicación por monóxido de carbono. Guía en el backend:
`docs/C7_17_ALTA20C.md`. Alcance del EpiBot: «meningitis» a secas pide precisar (el síndrome meníngeo es G00-G03
excepto G00.0 y G00.1); coqueluchoide y tos ferina son series distintas (rezago impreso 0: origen W43, primer
objetivo W44); plaguicidas y monóxido no distinguen intención y las consultas de riesgo personal reciben la respuesta
de crisis sin cifras (`epibot/tests/test_alcance_controles5.mjs`). La función RAG lee fichas HTML: deben ir en
`included_files` de `netlify.toml` (prueba `epibot/tests/test_rag_preview_aceptados3.mjs`).
Publicado y medido en producción: main `f065b839` (PR #98), Netlify `6af9d133`; 26/26 consultas a la API real, 141/141
archivos servidos byte iguales y navegador real. La nota D7 se añade de forma determinista a la respuesta generada
(`notaD7Rag`) porque el modelo puede omitirla; meningitis de tipo nombrado y G00.0/G00.1 reciben texto fijo
(`epibot/tests/test_meningitis_d7_rag.mjs`, `test_d7_guardas_alta20c.mjs`, `test_fable_pub5.mjs`). Tocar
`obesidad_kb.js` obliga a subir la cadena de caché `obesidad_kb.js` → `kb.js` → `app.js`, y
`tests/herramientas.test.mjs` fija la versión de `app.js`. Limitación ambiental: en este checkout, `npm run test:site`
da 106/107 porque `LuisMNA.jpeg` lleva un atributo de privacidad de macOS y el caso 101 de `tests/site_shell.test.mjs`
no puede copiarlo (EPERM); el mismo árbol da 107/107 en copia hermética. No tocar el archivo ni la prueba.
Mantenimiento pendiente, no ejecutado: O1 a O3 de la revisión final (`docs/DEUDAS_VIGENTES.md` del backend).

## Checkpoint — lote alta10b publicado — 12-nov-2026

Historia: tras alta10b el sitio servía 65 padecimientos: 4 del carril
original y 61 releases del runner. Diez se añadieron con el lote alta10b: cuatro portafolios aceptados en
la prueba única de 2025 con la política de cinco motores (ascariasis, hepatitis vírica A, efectos del calor y
de la luz, otras hepatitis víricas; validación prospectiva 0/4 en curso) y seis controles estacionales no
validados por autorización nominal del autor (desnutrición leve, otras salmonelosis, fiebre tifoidea,
escarlatina, hepatitis vírica C y displasia cervical severa con el cáncer cervicouterino in situ, sin sexo).
Guía en el backend: `docs/C7_16_ALTA10B.md`. Alcance del EpiBot: «hepatitis» a secas, «displasia
cervical» y «desnutrición» piden precisar; la hepatitis B aguda (B16), la paratifoidea, la desnutrición
moderada y severa y la displasia N87.9 no reciben cifras de un vecino (`epibot/tests/test_alcance_alta10b.mjs`).
Las letras de hepatitis se reescriben a «hepatitis vírica X» y esos alias llevan espacio final, porque
`nombraAlias` compara por prefijo («hepatitis virica a» capturaría «hepatitis virica aguda»).

## Checkpoint — lote alta20 publicado — 12-nov-2026

Historia (superada por alta10b y alta20c): el sitio servía entonces 55 padecimientos, 4 del carril original y 51
releases del runner. Veinte se añadieron el
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
