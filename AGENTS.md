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

## EpiBot y sitio: checkpoint 24/25-nov-2026 (en `main`, sin desplegar)

Prevalece sobre las secciones inferiores del EpiBot. **Lo servido**, sitio y EpiBot, es el PR #112 (`edbff2c`, `app.js?v=238`).
**Integrado y sin desplegar:** PR #113 a #131 (`main` `01604977`, `app.js?v=248`): no hay despliegues desde el 24-nov-2026 a
las 5:41 (hora del este) y, según el autor, Netlify no tendrá servicio hasta el 1-dic-2026; hasta entonces un push a `main`
no publica. Al volver, desplegar `main` y comprobar por contenido la versión servida. Planes: `docs/PLAN_EPIBOT_CONVERSACIONAL_2026-11-24.md`
y `docs/PLAN_EPIBOT_AGENTICO_2026-11-25.md`; actas en `/Users/haowei/Documents/Integrador/planes/mesa_*_2026-11-2*/` (carpeta del espacio de trabajo, fuera de ambos repositorios).

- **Vocabulario:** desde el PR #112 la lista blanca global ya no bloquea un turno natural (deroga lo que se diga de ella en
  alta_b44 y secciones inferiores): sólo `apoyoSuave` y `apoyoInmediato` dan el «no entendí» con la Línea de la Vida y sólo
  la crisis persiste. Los 12 releases sensibles conservan su guarda (cifras sólo con vocabulario técnico cerrado). No
  restaurar la lista global sin orden del autor.
- **Crisis:** las guardas corren antes que todo. Única excepción nueva, autorizada por el autor el 25-nov («sí, ajusta y
  sigue»): comparar padecimientos publicados no sensibles cuyo nombre lleva un término de lesión (`comparacionDePublicados`
  en `epibot/js/release_catalog.js`); no cubre primera persona, verbos de provocar, artículo indefinido ni ids sensibles.
  Cualquier otro cambio al detector se pregunta al autor; casos en `epibot/tests/test_crisis*.mjs`.
- **Cifras:** las respuestas calculadas salen de `epibot/js/calculo/` y de plantillas (`epibot/js/compuesta.js`); en la ruta
  generativa, ninguna cifra se muestra sin respaldo en el contexto (`epibot/netlify/lib/cifras_verificadas.mjs`, con
  excepciones para enteros de 0 a 12, años y códigos).
- **Controles:** nunca como modelo validado, tampoco en las gráficas («Control, no validado», en gris).
- **Gráficas:** seguir el «Sistema común de gráficas» del README; fechas de `zoom_series.json` sólo con `fechaEpiLegacy(d, pad)` (semana del boletín menos el rezago del cuadro: neurológicos 1, dengue 0);
  un cambio visible se revisa recapturando en el navegador a 1280 y 375 px.
- **Bandera y respaldo:** el planificador va detrás de `?agente=1` (o `localStorage.epibot_agente=1`) y no mostró ganancia
  medida en la batería ciega *dev* (187 frente a 187); su activación requiere la fase 5 del plan. El respaldo con Ollama
  (`EPI_LLM_RESPALDO`) queda apagado: los dos modelos probados cometieron errores clínicos. En Netlify no definir
  `EPI_LLM_RESPALDO` ni `EPI_LLM_LOCAL`. La clave de la API de Gemini probada el 25-nov responde 402 (la de producción no
  se ha verificado); el plan Ultra del autor sí cubre Antigravity (`agy`).
- **Al publicar un padecimiento:** su definición en `epibot/js/definiciones.js` si no es sensible (lo exige `tests/test_nlu.mjs`)
  y su área clínica en `assets/site/areas.mjs` (lo exige `tests/areas.test.mjs`). Tras el paso semanal, `npm run
  resumen:build` en `epibot/`.
- **Evaluación:** `npm test` (más de 2,100 pruebas) y `npm run eval:etiquetas` en `epibot/`. La batería ciega S vive en las
  actas: el conjunto de desarrollo (*dev*) ya se usó para ajustar; el de prueba (*test*) se abre una sola vez; le falta la
  parte escrita por personas.
- **Caché:** al cambiar un módulo, subir su `?v=` en todos los que lo importan y `app.js?v=` en `epibot/index.html`.
- **Prueba local completa:** `node epibot/scripts/servidor_local.mjs 8810` sirve el sitio y la función RAG.

# Instrucciones del repositorio

## Lote alta_b44 publicado (boletín 44, 19/20-nov-2026)

Prevalece en conteos sobre las secciones inferiores, que quedan como historia. Publicado y verificado el 19/20-nov-2026
(catálogo servido byte a byte en el frontend `4a9fdba1`, PR #102); la frase «versión candidata, sin desplegar» de este
bloque quedó superada. Lo que este bloque diga de la lista blanca global es historia: ver el checkpoint del 24/25-nov. Conteos del catálogo (`publication/catalog.json`, 148 releases visibles y `published`):

- **152 padecimientos en el sitio** = 4 del carril original + **148 releases del runner** (82 previos, 59 del lote
  alta_b44, 6 del lote 6: tuberculosis respiratoria, aceptada, y cinco controles estacionales tras rechazo por orden
  nominal del autor: meningitis tuberculosa, lepra, otras rickettsiosis, fiebre manchada y leishmaniasis cutánea; y el
  paludismo por P. vivax, control estacional sin desglose por sexo, 32 bases y 37 series).
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
- **Lista blanca global** (cuarta y quinta auditorías): se retiran del turno los fragmentos completos de padecimientos,
  códigos, radar y geografía (`epibot/js/vocab_cerrado.js`, generado por `npm run vocab:build`; `vocab:check` lo verifica)
  y el texto exacto que reconocen las guardas de alcance; nunca palabras sueltas generadas y lo que queda debe estar en la lista curada a mano `epibot/js/vocab_consulta.js` (palabras de consulta
  neutras, nunca riesgo, edades, cantidades ni estados de ánimo; números sólo como año o en una frase técnica). Un turno
  fuera de vocabulario no recibe cifras, gráfica ni ficha: apoyo fijo con la Línea de la Vida, persistente hasta un turno
  técnico. Todas las rutas de la interfaz, incluido «panorama», pasan por la misma guarda
  (`epibot/tests/test_vocab_codex_b44.mjs`, `epibot/tests/test_vocab5_codex_b44.mjs`,
  `epibot/tests/test_vocab6_codex_b44.mjs`, `epibot/tests/test_vocab7_codex_b44.mjs`). La edad sólo se retira en forma
  poblacional en tercera persona. La lista curada no admite pronombres, posesivos, parentesco, primera persona plural,
  verbos de deseo sueltos (sólo en frases de consulta como «quiero ver») ni verbos causativos, y toda
  respuesta de apoyo o crisis (KB o RAG) activa el estado persistente que la interfaz incorpora antes de cualquier ruta.
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
`tests/herramientas.test.mjs` fija la versión de `app.js`. `LuisMNA.jpeg` venía de WhatsApp con atributos de macOS
(`com.apple.quarantine`, `com.apple.macl`) que a veces impedían leerlo y hacían fallar con EPERM la copia de
`tests/site_shell.test.mjs`. El 25-nov-2026 se reemplazó por una copia idéntica byte a byte (sha256 `c6c736ad…`) sin esos
atributos; si el EPERM vuelve, revisar `xattr -l` del archivo antes de tocar la prueba.
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
