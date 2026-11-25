# EpiForecast-MX Dashboard

**Plataforma de inteligencia epidemiológica con asistente conversacional, visualizaciones interactivas y pronósticos multimodelo para el IMSS.**

Sitio en vivo: [epiforecast.mx](https://epiforecast.mx/)

El estado del e-póster WCP 2026 está en `wcp2026.html` y en la documentación interna del repo
principal (`Congresos/Mundial/ESTADO_ACTUAL_WCP.md`); este README describe el sitio.

---

## EpiBot y sitio: estado al 25-nov-2026

**Lo servido**, sitio y EpiBot, es el PR #112 (`edbff2c`, `app.js?v=238`). **Integrado en `main` y sin desplegar:** los PR
#113 a #131 (`main` `01604977`, `app.js?v=248`). No hay despliegues desde el 24-nov-2026 a las 5:41 (hora del este) y,
según el autor, Netlify no tendrá servicio hasta el 1-dic-2026; hasta entonces un push a `main` no publica. Pendiente:

- **EpiBot conversacional** (PR #113 a #118; el #112, con la guarda relajada y la respuesta llana, ya está servido):
  definiciones, ciudades → estado, pruebas de estrés y de conversación, contexto de varios turnos.
- **Mesa agéntica** (plan en `docs/PLAN_EPIBOT_AGENTICO_2026-11-25.md`; PR #124, #126, #128, #129): calculadora
  determinista (`epibot/js/calculo/`), preguntas compuestas (`epibot/js/compuesta.js`), memoria de lugar, verificador de
  cifras e interruptor del proveedor en la función RAG, ficha «Hablando de», voz y accesibilidad; planificador detrás de
  `?agente=1` y respaldo con Ollama, ambos apagados por omisión.
- **Gráficas** (PR #130 y #131): sistema común validado por la mesa de ocho expertos (ver «Sistema común de gráficas»).
- **Sitio** (PR #119 a #123 y #125): galería con tema oscuro real (el resto, «sólo claro»), áreas clínicas e iconos SVG
  dibujados por Gemini, mini-gráficas y tendencia en la galería, buscador en la portada. El PR #127 sólo documenta que
  `LuisMNA.jpeg` se reemplazó por una copia sin atributos de macOS.

Al volver Netlify: desplegar `main`, comprobar por contenido la versión servida (`epibot/index.html` con `app.js?v=248` o la
vigente) y probar en vivo una pregunta de cada tipo. La clave de la API de Gemini probada el 25-nov responde «402 Payment
Required» (la de producción no se ha verificado). Sin IA, el EpiBot de `main` sigue contestando con sus datos y, ante una
pregunta abierta, avisa que la IA de respaldo no está disponible; la versión servida (PR #112) no tiene ese interruptor.

---

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
- **Vigencia histórica y condición de despliegue verificado:** este bloque describe la configuración de **esta versión candidata** (la producción servida actual sigue en `85/81` y piloto `0/1` hasta el despliegue efectivo) y prevalece sobre las referencias inferiores fechadas al `15-nov-2026` (`boletín 43`) y sobre cualquier mención previa de `A51` a `lifecycle: configured` (`0/1`) o autorización de control pendiente (que se conservan como historia anterior a la autorización del control); **en cambio, la prueba única `test_2025` de `A51` (`sifilis_adquirida_a51_benchmark_test_73490ea8b2b5_749316ac335e`, `+27.716934 %` / `+27.7169 %` > `10 %` en nacional General) permanece definitivamente consumida y rechazada** (prohibido reabrir `2025`, reseleccionar o cambiar criterios). La disponibilidad pública efectiva en `https://epiforecast.mx/` está condicionada a la revisión final independiente (`Fable FINAL`, aún no emitida), la integración sincronizada en `main` de [EpiForecast-MX](https://github.com/EpiForecastMX/EpiForecast-MX) y [EpiForecast-IMSS-Dashboard](https://github.com/EpiForecastMX/EpiForecast-IMSS-Dashboard), las verificaciones remotas y la comprobación del contenido servido (ninguna se preafirma aquí; en el árbol candidato de backend `6c8021313f4589b070c726382ba8fe57abab882b` se verificó localmente la suite hidratada en `2,885 passed, 491 skipped, 66 deselected` con `6` docs propios en edición y sin equivaler a `main` integrado, y en el candidato local de frontend `fd10869af2fe17c06babd7ee14a4cea60c14557b` —sin push, PR ni deploy— se verificó el índice RAG real `epibot/rag_index.json` sha256 `c9ab21fd93f2a36fb92cea2a574ed71eebcfd5309c61ec65a1c3374d6a4a143b` con `806` vectores reales —`486` reutilizados y `320` nuevos bajo autorización nominal directa del autor para embeddings en Google Gemini— y `deploy:verify` local en `PASS`). Para consultar el estado operativo dinámico vigente, véase `planes/piloto_carbon_alta1_2026-11-15/ROOT_CURRENT_STATUS.json` (las instantáneas intermedias como `CURRENT_STATUS_CONTROL_v5.json` son registros históricos parciales que no constituyen cierre ni se reescriben) y, una vez consumado el despliegue real, el registro final de cierre verificado que emita `ROOT`.

---

## Estado: 15 de noviembre de 2026 (historia; los conteos vigentes están en «Lote alta_b44 publicado»)

| | |
|---|---|
| Padecimientos publicados | **85** = 4 del carril original + 81 releases del runner (veinte añadidos el 15-nov-2026 con alta20c: tres aceptados en la prueba de 2025, validación prospectiva 0/4 en curso, y diecisiete controles estacionales no validados) |
| Datos reales hasta | **boletín 43 de 2026** (carril original y radar); en los releases del runner, semana fuente 43: **semana 42** observada (semana 43 en síndrome coqueluchoide y tos ferina, con rezago impreso 0) |
| Series productivas del carril original | **432** = 333 neuro + 99 dengue |
| Gráficos publicados del carril original | **432** = 333 neuro + 99 dengue (ronda W37; hasta W33 eran 444 con las 4 regiones de dengue) |
| Tablero Tableau | histórico, corte W31 de 2026 (`javier.rebull3700` / `viz_epiforecastmx_17873231502650`) |
| Despliegue | Netlify, en cada push a `main`, tras el comando de build de `netlify.toml` |
| Ramas | sólo `main` |

### Contrato de cifras públicas

Las cifras del carril original están **congeladas** y un gate las comprueba en cada despliegue.
El build de Netlify (`command` de `netlify.toml`) corre, en orden, `test:dashboard`, `test:boletin`, `test:site`,
las pruebas del EpiBot (`npm test` en `epibot/`), las del contrato de cifras (`cifras:test`) y `npm run deploy:verify`. Éste comprueba primero la nota de picos heredados
de cada página de release (`picos_heredados.mjs --check`) y después ejecuta `cifras:verify` y
`rag:ci`, ambos siempre, conservando sus códigos de salida.

**Prohibidas:** `435` (contaba dos veces las tres series `Dengue - Nacional`, una por motor),
`102`, `145` por sexo, `15` nacionales, `444 gráficos` (desde W37) y la ecuación «111 x 3 = 435».
Si alguna reaparece, el despliegue falla.

Y **«motor» es familia algorítmica, nunca una serie**: no se cuentan series por motor.

Contrato normativo completo: `docs/CONTRATO_VOCABULARIO_CIFRAS.md` del repo principal.

### Ortografía: se corrige al PINTAR, no al guardar

Las entidades se guardan **sin tilde** (`Nuevo Leon`, `Ciudad de Mexico`) porque ese es su
**identificador**: es la clave de `knowledge.json` y lo que devuelve el emparejador de
`entities.js`. **Acentuar esas claves rompe la búsqueda en silencio.**

La corrección vive en **`js/display.js`** (`DISPLAY_NAMES` + `dn()`) y en `polishSpanish()`
para el markdown. **Regla: `dn()` sólo sobre texto que va a pantalla o a voz, jamás sobre una
clave.** Una vista nueva que imprima nombres tiene que importar `display.js`; `comparador`,
`semaforo`, `mexico-map`, `timelapse` y `app` lo hacen.

---

## Descripción

Dashboard interactivo del proyecto **EpiForecast-MX**, desarrollado en colaboración entre el
**Tecnológico de Monterrey** y el **Instituto Mexicano del Seguro Social (IMSS)**. Cubre
**152 padecimientos** (desde alta_b44, 19/20-nov-2026):

- **Carril original (cuatro):** Depresión (F32), enfermedad de Parkinson (G20), enfermedad de
  Alzheimer (G30) y Dengue (A97). Los tres neurológicos son la cohorte de 333 modelos; Dengue tiene
  su propio pipeline de conteos y página en `dengue.html` (pronóstico a un año; la proyección NB-GLM a
  cinco años se retiró en W37).
- **Releases del runner genérico (148 desde alta_b44):** publicados desde releases sellados
  (`publication/catalog.json`): obesidad, diabetes tipo I y II, anorexia y bulimia, hipertensión,
  enfermedad isquémica y cerebrovascular, seis padecimientos del radar del boletín (el sexto, asma),
  neumonías y bronconeumonías, diecisiete cánceres y, desde el 12-nov-2026, otitis media aguda,
  conjuntivitis, amebiasis intestinal, accidente de transporte en vehículos con motor y los trastornos
  hipertensivos del embarazo, parto y puerperio. El mismo día se sumaron quince más: intoxicación
  alimentaria bacteriana, shigelosis, erisipela, candidiasis urogenital y diabetes mellitus en el
  embarazo, aceptados con la política de cinco motores estacionales por decisión del autor, y diez
  controles estacionales no validados publicados tras el rechazo de 2025 por autorización nominal del
  autor (quemaduras, insuficiencia venosa periférica, hiperplasia de la próstata, escabiosis, protozoarios
  intestinales, faringitis estreptocócica, peatón lesionado, displasia cervical leve y moderada, varicela
  y parotiditis). Con el lote alta10b se sumaron diez más: ascariasis, hepatitis vírica A, efectos del calor
  y de la luz y otras hepatitis víricas, aceptados con la política de cinco motores en un orden de apertura
  fijado antes de abrir 2025 (tope de cuatro), y seis controles estacionales no validados por autorización
  nominal del autor (desnutrición leve, otras salmonelosis, fiebre tifoidea, escarlatina, hepatitis vírica C
  y displasia cervical severa con el cáncer cervicouterino in situ). El 15-nov-2026, con el lote alta20c, se sumaron
  veinte: fiebre paratifoidea, mal del pinto y vulvovaginitis, aceptados en su prueba única de 2025, y diecisiete
  controles estacionales no validados por dictámenes delegados de Fable bajo la delegación literal del autor (no firma
  humana): brucelosis, fiebre reumática, bocio, hepatitis B aguda, rotavirus, absceso hepático amebiano, leptospirosis,
  helmintiasis, desnutrición moderada y severa, enterobiasis, giardiasis, síndrome coqueluchoide, intoxicación por
  plaguicidas, tos ferina, síndrome meníngeo e intoxicación por monóxido de carbono. Cada uno tiene su página `<id>.html`. Los que no superaron su prueba de aceptación
  (2025 para la mayoría; 2026-W01 a W41 para los quince cánceres con datos sólo desde 2023) se
  publican con el control estacional y nunca como validados. Covid-19 aparece sólo en
  `rechazados.html`.

El sitio integra el radar del boletín (`boletin.html`), un chatbot conversacional con base de
conocimiento local y RAG (EpiBot), mapas interactivos de México y herramientas de análisis
epidemiológico.

---

## EpiBot: asistente conversacional

El componente principal del dashboard es **EpiBot** (`epibot/`), un asistente conversacional que
responde con datos reales de los 333 modelos neurológicos, de **Dengue** (handler `answerDengue`,
alimentado por la sección `dengue` de `knowledge.json`) y de los **148 padecimientos del
runner**, cuyos alias, marcadores de gráfica y páginas salen de `js/release_catalog.js` y cuyas cifras
salen de `publication/<id>/vista.json`.

### Arquitectura

```
epibot/
├── index.html              # UI del chat
├── knowledge.json          # Base de datos del carril original: boletín, modelos, config
├── rag_index.json          # Índice RAG (vectores y texto)
├── rag_sources/            # Fuentes del corpus (paper MICAI)
├── css/style.css           # Estilos Clinical Indigo
├── js/
│   ├── app.js              # UI principal, gráficas, ficha de la conversación y mensajes (~4,500 líneas)
│   ├── kb.js               # Base de conocimiento: guardas y handlers en cadena de prioridad (~6,600 líneas)
│   ├── conversacion.js     # Charla, ranking, síntomas, ciudades → estado, originales en lenguaje llano
│   ├── resumen_llano.js    # Respuesta llana: tendencia, frente al año anterior, pico y confiabilidad
│   ├── definiciones.js     # «¿Qué es…?» (136 definiciones; los temas sensibles no llevan)
│   ├── calculo/            # Calculadora determinista: series.js, operaciones.js, legitimidad.js
│   ├── compuesta.js        # Ritmo de cambio, «explícame la gráfica», meses con más casos, negativas razonadas
│   ├── memoria.js          # Memoria de lugar («soy enfermera en Mexicali», «en mi estado»)
│   ├── agente.js           # Planificador en el cliente (bandera ?agente=1)
│   ├── entities.js         # Detección de entidades (estados, padecimientos, sexo, motores)
│   ├── release_catalog.js  # Catálogo único de los releases del runner y de los no modelados
│   ├── release_config.js   # Alias, VOCAB, padMap y marcadores derivados del catálogo
│   ├── obesidad_kb.js      # Handler genérico de releases (respuestas desde la vista)
│   ├── obesidad_charts.js  # Gráficas de releases
│   ├── display.js          # Nombres para pantalla (dn) y polishSpanish
│   ├── comparador.js, comparador_data.js, mexico-map.js, timelapse.js, semaforo.js, voice.js
│   └── point_only.js, calendario_boletin.js, comparacion_rondas*.js
├── netlify/functions/rag.mjs   # RAG con Gemini (recuperación, rerank y generación verificada) y modos nlu y plan
├── netlify/lib/            # nlu.mjs (comprensión y planificador), proveedor.mjs (interruptor ante 402/cuota),
│                           # cifras_verificadas.mjs (ninguna cifra sin respaldo), respaldo.mjs (DeepSeek y Ollama), vistas
├── eval/                   # califica.mjs (etiquetas + oráculo), califica_s.mjs (batería ciega S), compara_agente.mjs
├── scripts/                # rag:build, resumen:build, servidor_local.mjs, install_publication.mjs, verify_deploy.mjs
└── tests/                  # Pruebas unitarias, de conversación, de estrés, de crisis y de gráficas (npm test)
```

### Base de conocimiento (kb.js)

- **Handlers** en cadena de prioridad: métricas globales, datos por padecimiento, estado y sexo,
  histórico anual, comparativas entre estados, motores, equipo, infraestructura, semanas
  epidemiológicas, boletín SINAVE y releases del runner.
- **Métricas de selección retiradas desde W37.** Las métricas de error por serie y por motor (SMAPE,
  MASE, RMSE, MAE) no se publican: midieron la ventana W28 a W37 con la que se eligió el motor y son
  diagnóstico de selección, no evaluación independiente (`metricas_seleccion.publicadas = false`).
  Los handlers, las gráficas y la galería responden con ese aviso y conservan el motor productivo, la
  distribución de motores y los conteos. Las definiciones de SMAPE y MASE siguen respondiéndose.
- Respuestas basadas en **datos reales** de `knowledge.json` (generado por el pipeline del repo
  principal) y de las vistas publicadas de cada release.
- Recurre al **RAG** (ver abajo) cuando la pregunta excede los handlers locales.
- Historial conversacional para preguntas de seguimiento.
- **Cache-bust al editar `kb.js`/`entities.js`**: sube `app.js?v=N` en `index.html` (la versión de
  **afuera**), no sólo el `?v` interno del import de `kb.js`. `/epibot/js/*` se sirve con
  `max-age=300` y `knowledge.json` con `max-age=3600` (`netlify.toml` de la raíz).

### Reglas de respuesta (24 y 25-nov-2026)

- **Ninguna cifra generada se muestra sin respaldo.** Las respuestas calculadas salen de las vistas, de `knowledge.json`,
  del radar o de la calculadora determinista. En la ruta generativa, `netlify/lib/cifras_verificadas.mjs` retira toda
  oración con una cifra que no esté en el contexto o en la pregunta (salvo enteros de 0 a 12, años y códigos) y el texto se
  envía ya verificado; el filtro comprueba números, no el sentido de la afirmación.
- **Crisis primero.** Ideación suicida, autolesión, ingestión y violencia vividas en primera persona reciben la respuesta de
  crisis antes de cualquier otra cosa; los 12 releases sensibles dan cifras sólo con vocabulario técnico cerrado. Excepción acotada (decisión del autor,
  25-nov): comparar padecimientos publicados no sensibles cuyo nombre lleva un término de lesión («compara picaduras de
  alacrán en Puebla y Tlaxcala») recibe datos; la primera persona, provocar, «una herida» y los ids sensibles siguen
  dando la crisis (`tests/test_crisis_comparaciones.mjs`).
- **Un control estacional nunca se presenta como validado**, ni en el texto ni en la gráfica («Control, no validado»).
- **Negativas razonadas** (`js/calculo/legitimidad.js`): tasas, significancia, brotes, causas, relación entre
  padecimientos, sumarlos y riesgo personal reciben una salvedad o una negativa con su motivo, no una cifra inventada.
- **Evaluación**: `npm run eval:etiquetas` califica si la respuesta acierta (padecimiento, estado y cifras contra un oráculo
  independiente), no sólo si «no falla». La batería ciega S vive fuera del repositorio con su sello SHA-256: el conjunto de
  desarrollo (*dev*) ya se usó para ajustar y el de prueba (*test*) se abre una sola vez. Medición pareada reglas frente al
  planificador: 187 frente a 187 en *dev*; 4/5 frente a 5/5 en cinco frases con varios pedidos (indicio, no prueba).

### RAG (rag_index.json + netlify/functions/rag.mjs)

Para preguntas de conocimiento (metodología, decisiones de diseño, el paper MICAI, «por qué», «cómo
funciona»), EpiBot usa **Retrieval-Augmented Generation** con grounding y citas:

- **Corpus** (`scripts/lib/corpus.mjs`): paper MICAI 2026 (`rag_sources/micai.txt`) y tarjetas en
  español que lo resumen, notas y reportes HTML del proyecto, tarjetas estructuradas de
  `knowledge.json` y el corpus de cada release publicado según `publication/pointers.json` (horizonte,
  corte de datos, desempeño fuera de muestra, motores, avisos de control y de picos heredados de la
  fuente). Chunking consciente de secciones. Unos 1,140 fragmentos (1,143 al 25-nov-2026).
- **Indexado incremental** (`npm run rag:build`): embeddings con **gemini-embedding-001** (768
  dimensiones vía MRL) en `rag_index.json` (~4.6 MB). Caché por hash (sólo reembebe lo nuevo) y
  reconstrucción en cada deploy (`rag:ci`, con `GEMINI_API_KEY` en el entorno de build).
- **Recuperación híbrida y reranking** (`rag.mjs`): coseno (semántico) y BM25 (léxico); reranker LLM
  condicional (gemini-3.1-flash-lite) sólo cuando `topSim < 0.72`; diversidad MMR-lite (máximo 3
  pasajes por documento).
- **Datos exactos**: si la consulta menciona padecimiento y entidad, inyecta las cifras exactas en el
  contexto. La línea «Alcance vigente» cuenta los releases visibles con canal `epibot`.
- **Confianza**: umbral de similitud (`SIM_MIN`); si la recuperación es débil, EPI lo declara.
- **Multiturno**: reescribe seguimientos («¿y en Jalisco?») como pregunta autónoma antes de recuperar.
- **Generación con streaming**: respuesta token a token (NDJSON) citando fuentes con `[n]`, con chips
  de fuente clicables.
- **Evaluación**: `rag:eval` (recall@k/MRR), `rag:eval:quality` (juez LLM), `rag:verify` (detecta
  drift; corre en `npm run check`).

```
npm run rag:build          # reindexa (incremental; necesita GEMINI_API_KEY)
npm run rag:eval           # recall@k / MRR del set de evaluación
npm run rag:eval:quality   # fidelidad y relevancia (juez LLM)
npm run rag:verify         # falla si el índice está desincronizado del corpus
```

> Modelos: embeddings = **gemini-embedding-001**. Generación, expansión y rerank =
> **gemini-3.1-flash-lite**, con **gemini-3.5-flash** de respaldo.
> El `netlify.toml` de la **raíz** es el que manda: necesita
> `included_files = ["epibot/knowledge.json", "epibot/rag_index.json", "publication/catalog.json", "publication/*/*/knowledge.json"]`
> o la función no encuentra el índice ni los releases en producción.

### Detección de entidades (entities.js)

- **32 estados** y regiones con alias (CDMX, Edomex, etc.).
- Los cuatro padecimientos originales y los alias y códigos CIE-10 de los 148 releases del
  runner (`release_catalog.js`), comparados al inicio de palabra; los no modelados salen de la lista
  única `noModeladas`.
- **Sexo** (hombres, mujeres, general) con variantes.
- **Motores** de predicción.
- Años, semanas, meses, rangos de edad, «últimos N años».
- Varios estados para activar el comparador; lugares no reconocidos o no mexicanos.

### Funcionalidades del chat

| Funcionalidad | Ejemplo de consulta |
|---|---|
| Métricas globales | «métricas globales», «cómo va el proyecto» |
| Por padecimiento | «depresión en Jalisco», «parkinson en mujeres», «obesidad en Sonora hombres» |
| Histórico anual | «casos de alzheimer en 2023», «tendencia 2018-2024» |
| Comparativa estados | «compara CDMX y Nuevo León» |
| Motores | «qué motor usa depresión en Jalisco», «distribución de motores» |
| Datos del boletín | «boletín epidemiológico», «semana 42» |
| Resumen por año | «resumen epidemiológico 2023» |
| Dengue | «qué es el dengue», «pronóstico de dengue», «dengue en Veracruz» |
| Releases del runner | «hipertensión en Jalisco», «comparar obesidad con diabetes» |
| Equipo e infraestructura | «equipo del proyecto», «infraestructura AWS» |

---

## Visualizaciones interactivas

### Sistema común de gráficas (mesa de ocho expertos, 25-nov-2026)

- Títulos, leyendas y descripciones emergentes en tinta oscura sobre fondo claro; sin suavizado (`tension: 0`) ni resplandor; eje Y con
  unidad («Casos notificados por semana»); fechas «ene 2025» sin girar y sin choques según el ancho real.
- Línea «último dato | pronóstico →» en el corte; el control estacional en gris con «Control, no validado».
- Colores de trazo con contraste de al menos 3:1 (`legible()` en `js/obesidad_charts.js`) y paleta categórica validada
  para daltonismo; mapas con rampa clara → oscura en cinco cuantiles, leyenda por clases y «sin ajustar por población».
- La gráfica responde lo mismo que el texto: hereda el estado de la conversación sólo si el texto también es de ese
  estado. El año en curso se rotula como parcial. Toda gráfica y mapa tiene tabla equivalente («Ver los datos…»).
- Fechas de los cuatro originales: `zoom_series.json` guarda la fecha interna del motor y la semana del boletín empieza
  13 días después; se muestran con `fechaBoletinLegacy` (`js/calculo/series.js`).
- Pruebas en `epibot/tests/test_graficas_mesa.mjs`. La revisión cubrió 22 preguntas capturadas del bot real; acta y capturas
  antes y después en `/Users/haowei/Documents/Integrador/planes/mesa_graficas_epibot_2026-11-25/` (fuera de los repositorios).

### Gráficas en el chat (Chart.js)

EpiBot genera gráficas dentro del chat cuando detecta contexto numérico, con acabado unificado
(gradientes, crosshair, formato es-MX, paleta **Clinical Indigo**): barras agrupadas y apiladas,
treemap, radar, sparklines, tendencia histórica, mapa de México, semáforo, timelapse y comparador.
Las gráficas de un release se dibujan desde el marcador de la respuesta; sin marcador no se dibuja
ninguna.

Las gráficas de seguimiento **heredan el padecimiento y el estado del contexto** («¿y en Jalisco?»
tras una pregunta sobre Depresión grafica Depresión en Jalisco).

### Mapas de México (mexico-map.js)

Mapas SVG de las 32 entidades: casos por padecimiento y sexo, tooltip, leyenda con gradiente
dinámico. Accesibles desde el menú del chat.

### Timelapse (timelapse.js)

Evolución semana a semana: 52 cuadros, controles de reproducción y velocidad, escala de color
global.

### Semáforo epidemiológico (semaforo.js)

Carga pronosticada por estado (no riesgo: casos sin ajustar por población), basada en percentiles: cuatro niveles, 32 tarjetas ordenadas,
tendencia, casos y desglose por padecimiento.

### Comparador de estados (comparador.js)

Comparación lado a lado de dos entidades («compara X y Y»), con casos, motor productivo por
padecimiento y barras duales.

### Reporte PDF (generatePDFReport)

Reporte ejecutivo imprimible: casos totales, series productivas, motores, top 10 entidades, mini
semáforo y distribución de motores.

---

## Entrada y salida por voz (voice.js)

### Speech-to-Text

- Botón de micrófono con animación, Web Speech API con `lang: 'es-MX'`.
- Texto intermedio visible y envío automático al terminar de hablar.
- Compatibilidad con Safari (respaldo vía `onend`) y botón oculto sin soporte.

### Text-to-Speech

- Habla sola cuando la pregunta fue por voz; botón de altavoz en cada respuesta.
- Selección de voz por puntaje (Google cloud > Paulina en macOS > otras), sin voces robóticas.
- Nunca habla con voz en inglés; botones de detener y silenciar; trunca a 600 caracteres.

---

## Visualizaciones Tableau

`EpiDashboard.html` incluye **diez vistas** del workbook `viz_epiforecastmx_17873231502650`,
publicado en Tableau Public bajo la cuenta **`javier.rebull3700`**. Es un **tablero histórico (corte
W31 de 2026)**, rotulado así en la página, y no forma parte del paso semanal.

> **Al republicar, conservar el nombre del workbook.** Los embeds lo alcanzan por
> `name='viz_epiforecastmx_17873231502650/<vista>'`; si Tableau le añade otra marca de tiempo
> hay que actualizar las **30 referencias** de `EpiDashboard.html` (10 en `name`, 20 en
> `static_image`).

> **El tablero lleva un extracto, no conexión viva.** El conector de Google Drive de Tableau
> Desktop Public Edition rechaza la lectura aun con el permiso concedido; está documentado en
> `docs/GUIA_PUBLICAR_TABLEAU_2026-08-25.md` del repo principal.

---

## Galería de pronósticos

`Reports/index.html` es la galería por padecimiento: entra por el catálogo del dashboard
(`assets/dashboard/catalog.json`), abre cada padecimiento en su total nacional y permite cambiar nivel,
territorio, sexo y vista (`?p=&s=&t=&nivel=&grafica=`, los mismos IDs que el dashboard). La lógica pura
vive en `Reports/galeria_core.mjs` y el controlador en `Reports/galeria.mjs` (pruebas en
`tests/galeria*.test.mjs`). Las 432 láminas del carril original siguen en la lista contractual `DATA`;
los releases del runner se dibujan desde su vista publicada, sin métricas de error.

### Chrome común, noticias y estado de las fichas (rediseño, hito 3)

- `assets/site/shell.config.json` es la fuente única de cabecera y pie; `node scripts/site_shell.mjs`
  estampa las 62 rutas y escribe `assets/site/shell.fragments.json` para el backend (`--check` en el
  build). Familias: portada, galería, dashboard, radar, EpiBot (app), fichas, editorial, noticias,
  congresos, micrositios de congreso (excepción de identidad acotada: cuerpo, idioma y hoja propios) y
  archivo Tableau. Las páginas con `productor.chrome` (validación, resultados, bitácora, comparación) se
  regeneran en el backend con `epiforecast.publication.editorial_chrome`; `--check` exige que su
  cabecera sea idéntica al fragmento de su familia.
- Recursos comunes versionados en `assets` del manifiesto (`?v=` igual en todas las páginas de la raíz);
  EpiBot los carga sin `?v` y Netlify los revalida (`must-revalidate` en `/assets/site/*`).
- `novedades.html` trae el archivo estático completo de `news.json` entre
  `<!-- noticias:archivo:start/end -->` (lo escribe `build_news_weekly.py`, también con
  `--solo-estaticos`), con las anclas de `assets/site/nota-ancla.js`; el JS lo repinta igual.
- Fichas: `assets/site/estado-ficha.js` pone `data-verdict` y `data-publication-kind` en `#statusCard`
  desde la vista cargada (misma regla que el Dashboard y la Galería) y `disease.css` lo colorea: superada
  verde, en curso azul, control ocre. Una ficha nueva copiada de otra hereda la llamada
  `EpiEstadoFicha.aplica($('statusCard'), V)`; no lleva clase de estado estática.

`Reports/obesidad_galeria.js` es el controlador de releases de la galería ANTERIOR. La galería actual
ya no lo carga; se conserva a propósito como compatibilidad de reversión (si se revierte el rediseño,
la galería vieja lo necesita) y lo siguen ejercitando `epibot/tests/test_obesidad_galeria.mjs`,
`test_release_catalogo.mjs` y `test_diabetes_release.mjs`. Retirarlo exige quitar a la vez el módulo,
esas pruebas y esta nota, en el mismo cambio.

---

## Páginas y reportes

| Archivo | Contenido |
|---|---|
| `<id>.html` (30) | Una página por release del runner: pronóstico, validación prospectiva y notas |
| `boletin.html` | Radar del boletín: 187 categorías y curvas desde 2013 |
| `rechazados.html` | Padecimientos rechazados por el gate de 2025 (Covid-19) |
| `dengue.html` | Dengue: EDA, modelado y pronóstico |
| `reporte_resultados.html` | Resultados del modelado del carril original |
| `comparacion_modelos.html` | Comparativa de motores |
| `comparacion_rondas.html` | Comparación entre rondas de selección |
| `validacion_semanal.html` | Validación real contra pronóstico con el boletín más reciente |
| `bitacora_modelado.html` | Bitácora histórica del modelado Prophet v1-v6 |
| `ficha_tecnica_prophet.html` | Ficha técnica del modelo Prophet |
| `hiperparametros_modelos.html` | Hiperparámetros de los motores |
| `conclusiones.html` | Conclusiones clave del proyecto |
| `construccion_dashboard.html` | Construcción del dashboard |
| `referencias.html` | Referencias bibliográficas |
| `auditoria_remediacion_2026.html` | Auditoría de calidad y remediación |

---

## Novedades y prensa

La bitácora pública vive en `novedades.html` y se alimenta **sola** de `news.json`: la portada toma
los ítems más recientes para su banner y Novedades los pinta todos. Cada hito grande tiene página
propia, enlazada desde su ítem.

| Página | Hito |
|---|---|
| `calass.html` | CALASS 2026, XXXVI Congreso de la ALASS, Université de Montréal, 27-ago-2026 |
| `helix.html` | Primer lugar en el International Summit HELIX 2026 México |
| `future_health.html` | Ponencia aceptada en la 2nd Public Health Conference (Skopje) |
| `micai2026.html` | Ponencia y artículo MICAI 2026 (`micai.html` redirige aquí) |
| `wcp2026.html` | E-póster WCP 2026 (Estocolmo) |

### Publicar una noticia toca cinco superficies

1. **`news.json`**: el ítem nuevo va **primero**. Campos: `date`, `iso`, `type`, `tag`, `featured`,
   `title`, `body[]` (acepta HTML), `link` y el opcional **`summary`**. Sin `summary`, el banner de
   la portada corta el primer párrafo a 150 caracteres.
2. **La página del hito**, si lo merece. Se clona el armazón de `helix.html`.
3. **`index.html`**: el color del tag (`.news-tag--<type>`) y, si el `type` es nuevo, el filete de la
   tarjeta (`.news-card--<type>::before`).
4. **`index.html` otra vez: el banner estático** (`#newsBannerRow`), respaldo para cuando falla el
   `fetch` de `news.json`. No se actualiza solo en una edición manual, pero `cifras:verify` falla el
   despliegue si no coincide con `news.json`.
5. **`sitemap.xml`**: alta de la página nueva.

> **El gate de cifras alcanza a la página nueva.** `npm run cifras:verify` recorre **todo** el
> `.html`/`.json` publicado desde la raíz. Una nota que escriba «435 modelos» rompe el despliegue.

### Las fotos

Se recortan a una proporción **común (3:2)** antes de subirlas: la galería las coloca en una
retícula de dos columnas y, con proporciones distintas, los pies quedan desalineados. Las de iPhone
llegan en HEIC; `sips -s format jpeg` las convierte y, ya en Pillow, `ImageOps.exif_transpose` respeta
la orientación. Van a `Reports/<hito>/` a 1600 px de ancho y calidad 82.

---

## Estructura del sitio

```
EpiForecast-IMSS-Dashboard/
├── index.html                      # Portada
├── <id>.html                       # 81 páginas de releases del runner
├── boletin.html                    # Radar del boletín
├── rechazados.html                 # Padecimientos rechazados (Covid-19)
├── dengue.html                     # Dengue
├── EpiDashboard.html               # Tableau (histórico)
├── novedades.html, news.json       # Bitácora pública
├── calass.html, helix.html, future_health.html, micai2026.html, wcp2026.html
├── reporte_resultados.html, comparacion_modelos.html, comparacion_rondas.html, validacion_semanal.html
├── bitacora_modelado.html, ficha_tecnica_prophet.html, hiperparametros_modelos.html
├── conclusiones.html, construccion_dashboard.html, referencias.html, auditoria_remediacion_2026.html
├── metodologia_dengue.html, pipeline_diagramEDA.html
├── editorial.css, sitemap.xml, netlify.toml, package.json
├── hero_series.json                # Las 4 series de la Figura 1 del carril original
├── publication/                    # catalog.json, pointers.json y una carpeta por release (vista.json)
├── assets/boletin/                 # Foto semanal del radar
├── scripts/                        # Radar del boletín (boletin_semana.py)
├── tests/                          # Pruebas del radar y del WCP
├── Reports/
│   ├── index.html                  # Galería de pronósticos
│   ├── Alzheimer/, Depresión/, Parkinson/, dengue/   # Gráficas del carril original
│   ├── publication/                # Shards de los releases
│   ├── galeria.mjs, galeria_core.mjs # Galería por padecimiento (controlador y lógica pura)
│   ├── obesidad_galeria.js         # Galería de releases anterior: sólo compatibilidad de reversión
│   ├── zoom_data_neuro.json, zoom_data_dengue.json
│   ├── motores/, micai2026/, wcp2026/, calass/, helix/, future_health/
├── epibot/                         # EpiBot (ver arriba)
└── README.md
```

---

## Navegación

```
index.html
  ├──> <id>.html (30)                (Releases del runner)
  ├──> boletin.html                  (Radar del boletín)
  ├──> rechazados.html               (Rechazados)
  ├──> dengue.html                   (Dengue)
  ├──> EpiDashboard.html             (Tableau, histórico)
  ├──> reporte_resultados.html       (Reporte de modelos)
  ├──> comparacion_modelos.html      (Comparativa de motores)
  ├──> Reports/index.html            (Galería de pronósticos)
  ├──> novedades.html                (Bitácora pública)
  │      ├──> calass.html, helix.html, future_health.html
  │      └──> micai2026.html, wcp2026.html
  └──> epibot/index.html             (EpiBot)
```

Todas las páginas incluyen navegación cruzada.

---

## Stack técnico

| Componente | Tecnología |
|---|---|
| Frontend | HTML5 + CSS3 + ES Modules (vanilla JS) |
| Chatbot | Base de conocimiento local, detección de entidades y RAG híbrido |
| Visualización | Chart.js 4.x, mapas SVG, Tableau Public |
| Voz | Web Speech API (SpeechRecognition + SpeechSynthesis) |
| Markdown | marked.js |
| IA | Google Gemini (embeddings, rerank y generación) vía Netlify Functions |
| Hosting | Netlify (despliegue en push a `main` tras el build) |
| Repositorio | GitHub (EpiForecastMX) |

---

## Fuentes de datos

- **SINAVE**: boletines epidemiológicos semanales (neurológicos 2014-2026; Dengue 2018-2026;
  releases del runner según su cuadro), procesados por pipeline. Incluyen desglose por entidad y,
  cuando el boletín lo trae, por sexo.
- **INEGI**: población por entidad federativa.
- **knowledge.json**: generado por el pipeline del repo principal
  (`scripts/build_web_knowledge.py`).
- **publication/**: vistas, punteros y catálogo de los releases sellados, instalados con
  `epibot/scripts/install_publication.mjs`.

### Actualización semanal

La semana avanza por tres carriles y ninguno publica una semana parcial:

1. **Carril original** (Depresión, Parkinson, Alzheimer y Dengue): el productor legacy v5, que vive
   fuera de los repositorios (`planes/`) y conserva las asignaciones congeladas en la ronda W37.
   `make update-week` del repo principal es histórico y aborta siempre en el preflight
   (`scripts/actualiza_semanal.sh`); no es una receta vigente.
2. **Releases publicados del runner** (81 al 15-nov-2026; el conjunto sale del registry): `make semana-revisa`, `make semana-observa PDF=… SALIDA=…`,
   `python -m scripts.paso_semanal consolida` y `make semana-vistas N=… FE=…` en el repo principal.
3. **Radar del boletín**: `python3 scripts/boletin_semana.py --pdf … --url-fuente … --publicacion …`
   en este repo (ver `scripts/README_radar_boletin.md`).

La hoja de Google Sheets y el workbook de Tableau son del tablero histórico (corte W31) y no se
actualizan con la semana.

---

## Desarrollo local

```bash
git clone https://github.com/EpiForecastMX/EpiForecast-IMSS-Dashboard.git
cd EpiForecast-IMSS-Dashboard
python3 -m http.server 8080
# Sitio: http://localhost:8080 · EpiBot: http://localhost:8080/epibot/
```

Para el EpiBot completo con su función RAG sin Netlify (la clave se lee del entorno y nunca se imprime):

```bash
node epibot/scripts/servidor_local.mjs 8810
# EpiBot: http://localhost:8810/epibot/ · planificador: http://localhost:8810/epibot/?agente=1
```

Cuando Gemini no responde (clave, facturación o cuota), la función usa un respaldo (`netlify/lib/respaldo.mjs`), con el
mismo verificador de cifras y una nota que lo rotula:

- **DeepSeek**, si existe `DEEPSEEK_API_KEY` (modelo `EPI_DEEPSEEK_MODELO`, por omisión `deepseek-flash`). En la comparación
  del 25-nov con nueve prompts reales respondió tan bien como Gemini, en 3 a 6 segundos (veredicto en
  `/Users/haowei/Documents/Integrador/planes/mesa_epibot_agentico_2026-11-25/respaldo_ollama/comparacion_modelos/VEREDICTO_PROVEEDORES.md`).
  DeepSeek procesa los datos en China y no ofrece embeddings: sin Gemini, la recuperación es léxica.
- **Ollama**, sólo para experimentos locales (`EPI_LLM_RESPALDO="http://localhost:11434|modelo"`); no definirla en Netlify:
  los modelos probados el 25-nov cometieron errores clínicos
  (`/Users/haowei/Documents/Integrador/planes/mesa_epibot_agentico_2026-11-25/respaldo_ollama/VEREDICTO.md`).

Pruebas y evaluación:

```bash
cd epibot && npm test && npm run eval:etiquetas
```

También funciona `netlify dev` con Netlify CLI.

---

## Despliegue

Cuando Netlify tiene servicio, despliega cada push a `main` tras correr el comando de build de `netlify.toml` (pruebas del
sitio, del tablero y del radar, `resumen:build`, `npm test` del EpiBot, contrato de cifras y `deploy:verify`). Si cualquiera
falla, el despliegue no se publica. Desde el 24-nov-2026 no hay despliegues (ver «EpiBot y sitio: estado al 25-nov-2026»).

---

## Proyecto principal

Este dashboard es el componente de visualización del proyecto
[EpiForecast-MX](https://github.com/EpiForecastMX/EpiForecast-MX), que incluye el pipeline completo
de extracción, procesamiento, entrenamiento, selección y generación de pronósticos epidemiológicos.

---

## Equipo

| Integrante | Rol |
|---|---|
| Javier Rebull | Sr. Associate Application Developer, Santander Bank US |
| Juan Carlos Pérez Nava | Profesional de TI, IMSS |
| Luis Gerardo Sánchez Salazar | Sr. Controls Engineer, Tesla |

**Asesora académica:** Dra. Grettel Barceló Alonso, Tecnológico de Monterrey

**Stakeholders IMSS:** Dra. Ruth Pérez (líder de proyecto) y Dra. Lina Díaz Castro (investigadora en
psiquiatría)

---

<p align="center">
  <strong>Tecnológico de Monterrey</strong> · <strong>IMSS</strong> · Equipo 01, 2026
</p>
