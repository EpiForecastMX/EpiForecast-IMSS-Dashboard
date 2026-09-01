# EpiForecast-MX Dashboard

**Plataforma de inteligencia epidemiologica con asistente conversacional, visualizaciones interactivas y pronosticos multi-modelo para el IMSS.**

Sitio en vivo: [epiforecast.mx](https://epiforecast.mx/)

---

---

## Estado — 25 de agosto de 2026

| | |
|---|---|
| Datos reales hasta | **semana 31 de 2026** |
| Series productivas | **432** = 333 neuro + 99 dengue |
| Graficos publicados | **444** = 333 neuro + 111 dengue |
| Tablero Tableau | `javier.rebull3700` / `viz_epiforecastmx_17873231502650` |
| Despliegue | Netlify, automatico en push a `main` |
| Ramas | solo `main` |

### Contrato de cifras publicas

Las cuatro cifras de arriba estan **congeladas** y hay un gate que lo comprueba en cada
despliegue (`npm run deploy:verify`, invocado desde `netlify.toml`, ejecuta siempre
`cifras:verify` y `rag:ci` y falla si cualquiera falla).

**Prohibidas:** `435` (contaba dos veces las tres series `Dengue - Nacional`, una por motor),
`102`, `145` por sexo y `15` nacionales. Si alguna reaparece, el despliegue falla.

Y **«motor» es familia algoritmica, nunca una serie**: no se cuentan series por motor.

Contrato normativo completo: `docs/CONTRATO_VOCABULARIO_CIFRAS.md` del repo principal.

### Ortografia: se corrige al PINTAR, no al guardar

Las entidades se guardan **sin tilde** (`Nuevo Leon`, `Ciudad de Mexico`) porque ese es su
**identificador**: es la clave de `knowledge.json` y lo que devuelve el emparejador de
`entities.js`. **Acentuar esas claves rompe la busqueda en silencio.**

La correccion vive en **`js/display.js`** (`DISPLAY_NAMES` + `dn()`) y en `polishSpanish()`
para el markdown. **Regla: `dn()` solo sobre texto que va a pantalla o a voz, jamas sobre una
clave.** Una vista nueva que imprima nombres tiene que importar `display.js` — `comparador`,
`semaforo`, `mexico-map` y `timelapse` lo hacen.

---

## Descripcion

Dashboard interactivo del proyecto **EpiForecast-MX**, desarrollado en colaboracion entre el **Tecnologico de Monterrey** y el **Instituto Mexicano del Seguro Social (IMSS)**. Cubre cuatro padecimientos:

| Codigo CIE-10 | Padecimiento |
|:-:|---|
| F32 | Depresion |
| G20 | Enfermedad de Parkinson |
| G30 | Enfermedad de Alzheimer |
| A97 | Dengue *(4.o padecimiento, vectorial)* |

Los tres neurologicos son la cohorte de produccion principal (333 modelos). **Dengue** se incorporo como cuarto padecimiento, vectorial, con su propio pipeline de conteos: pagina publica en `dengue.html` (pronostico a 1 ano + proyeccion estacional ilustrativa a 5 anos) y respuestas del EpiBot. El sitio integra visualizaciones Tableau, un chatbot conversacional con base de conocimiento local + RAG (EpiBot), mapas interactivos de Mexico, y herramientas avanzadas de analisis epidemiologico.

---

## EpiBot - Asistente Conversacional

El componente principal del dashboard es **EpiBot** (`epibot/`), un asistente conversacional que responde preguntas sobre el proyecto con datos reales de los 333 modelos de produccion neurologicos y del 4.o padecimiento, **Dengue** (handler dedicado `answerDengue`, alimentado por una seccion `dengue` de `knowledge.json` derivada de los artefactos de produccion).

### Arquitectura

```
epibot/
├── index.html              # UI del chat (HTML5 + CSS custom)
├── knowledge.json          # Base de datos: metricas, boletin, modelos, config
├── css/style.css           # Estilos con paleta IMSS 2026
├── js/
│   ├── app.js              # UI principal, renderizado de charts y mensajes
│   ├── kb.js               # Base de conocimiento: 30+ handlers en cadena de prioridad
│   ├── entities.js         # Deteccion de entidades (estados, padecimientos, sexo, modelos)
│   ├── mexico-map.js       # Renderizador SVG de mapas de Mexico (32 entidades)
│   ├── timelapse.js        # Animacion temporal semana a semana
│   ├── semaforo.js         # Semaforo epidemiologico por niveles de riesgo
│   ├── comparador.js       # Comparador visual lado a lado de dos estados
│   └── voice.js            # Entrada/salida por voz (STT + TTS)
├── netlify/functions/       # Serverless function para fallback a Gemini
└── tests/                   # Tests unitarios
```

### Base de Conocimiento (kb.js)

- **30+ handlers** en cadena de prioridad que cubren: metricas globales, datos por padecimiento/estado/sexo, historico anual, comparativas entre estados, ranking de modelos, equipo, infraestructura, semanas epidemiologicas, boletin SINAVE y mas.
- **Cuadros de rendimiento 2026** (`answerRendimientoPorPadecimiento` + `_cuadroDengue`): tabla por padecimiento × motor con **SMAPE y MASE** (mediana/promedio) + fila productivo, para las 3 series neuro y **Dengue** (motores propios DeepAR/Prophet/NBGLM). Disparadores: "rendimiento por padecimiento", "smape y mase por padecimiento", "cuadro de dengue". Datos de la seccion `rendimiento_2026` de `knowledge.json`. Registrado antes de `answerMatrizRendimiento`.
- Respuestas basadas en **datos reales** de `knowledge.json` (generado por el pipeline del repo principal).
- Fallback a un **RAG real** (ver abajo) cuando la pregunta excede los handlers locales.
- Historial conversacional para contexto en preguntas de seguimiento.
- **Cache-bust al editar `kb.js`/`entities.js`**: sube `app.js?v=N` en `index.html` (la version de **afuera**; `/js/*` se sirve con `max-age=3600`), no solo el `?v` interno del import de `kb.js`. Sin ese bump el navegador sigue corriendo el `app.js` viejo cacheado (que importa el `kb.js` viejo). `knowledge.json` va con `no-cache` (se revalida solo).

### RAG Real (rag_index.json + netlify/functions/rag.mjs)

Para preguntas de conocimiento (metodologia, decisiones de diseno, el paper MICAI, "por que", "como funciona"), EpiBot usa **Retrieval-Augmented Generation** con grounding y citas:

- **Corpus** (`scripts/lib/corpus.mjs`): paper MICAI 2026 (`rag_sources/micai.txt`) + tarjetas en espanol que lo resumen (recall cross-lingue), notas/reportes HTML del proyecto, tarjetas estructuradas de `knowledge.json` (incluye macrorregiones, top entidades, desempeno por sexo y los **ORCID del equipo**). Chunking **consciente de secciones** (cada chunk lleva su seccion y la URL del documento). ~367 chunks.
- **Indexado incremental** (`npm run rag:build`): embeddings con **gemini-embedding-001** (768 dims via MRL) -> `rag_index.json` (~3 MB). **Cache por hash** (solo re-embebe lo nuevo), **resiliente** (no degrada un indice bueno) y **auto-rebuild en cada deploy** (`netlify.toml`; requiere `GEMINI_API_KEY` en el entorno de build).
- **Recuperacion hibrida + reranking** (runtime, `rag.mjs`): **coseno (semantico)** + **BM25 (lexico)** -> pool; **reranker LLM CONDICIONAL** (gemini-3.1-flash-lite) solo cuando la recuperacion no es ya muy confiable (`topSim < 0.72`, ahorra latencia); **diversidad MMR-lite** (max. 3 pasajes por documento). Degrada a lexico sin vectores.
- **Datos exactos (agentic)**: si la consulta menciona padecimiento+entidad, inyecta las cifras exactas de `knowledge.json` en el contexto (pronosticos precisos, sin deriva).
- **Confianza**: umbral de similitud (`SIM_MIN`) -> si la recuperacion es debil, EPI lo declara en vez de inventar.
- **Multi-turno**: reescribe seguimientos ("¿y en Jalisco?") como pregunta autonoma antes de recuperar; el cliente mantiene los seguimientos cortos dentro del RAG.
- **Generacion + STREAMING**: respuesta token a token (NDJSON; primer token ~1-3 s) citando las fuentes con `[n]`. La UI muestra **chips de fuente clicables** que abren el documento real (PDF/HTML), muestran el **extracto citado** al pasar el cursor y ofrecen "profundizar".
- **Evaluacion + guardarrail**: `rag:eval` (recall@k/MRR), `rag:eval:quality` (LLM-as-judge: fidelidad/relevancia), `rag:verify` (detecta drift; corre en `npm run check`).

```
npm run rag:build          # reindexa (incremental; necesita GEMINI_API_KEY)
npm run rag:eval           # recall@k / MRR del set de evaluacion
npm run rag:eval:quality   # fidelidad/relevancia (juez LLM)
npm run rag:verify         # falla si el indice esta desincronizado del corpus
```

> Notas de modelos: embeddings = **gemini-embedding-001** (no `text-embedding-004`, da 404). Generacion/expansion/rerank = **gemini-3.1-flash-lite** (con **gemini-2.5-flash** de respaldo); los `gemini-1.5-*` ya no estan disponibles.
> El `netlify.toml` de la **raiz** es el que manda: necesita `included_files=["epibot/knowledge.json","epibot/rag_index.json"]` o la funcion no encuentra el indice en produccion.

### Deteccion de Entidades (entities.js)

- **32 estados** + regiones INEGI con aliases (CDMX, Edomex, EdoMex, etc.)
- **4 padecimientos** con aliases y codigos CIE-10 (F32, G20, G30 y A97 Dengue)
- **Sexo** (hombres, mujeres, general) con variantes (masculino, femenino)
- **4 motores** de prediccion (Prophet, DeepAR, Ensemble, Stacking)
- Extraccion de anios, semanas, meses, rangos de edad, "ultimos N anios"
- Deteccion de multiples estados para activar el comparador
- Deteccion de lugares no reconocidos y lugares no mexicanos

### Funcionalidades del Chat

| Funcionalidad | Ejemplo de consulta |
|---|---|
| Metricas globales | "metricas globales", "como va el proyecto" |
| Por padecimiento | "depresion en Jalisco", "parkinson en mujeres" |
| Historico anual | "casos de alzheimer en 2023", "tendencia 2018-2024" |
| Comparativa estados | "compara CDMX y Nuevo Leon" |
| Ranking modelos | "mejores modelos", "peores SMAPE" |
| Datos del boletin | "boletin epidemiologico", "semana 52" |
| Resumen por anio | "resumen epidemiologico 2023" |
| Dengue (4.o padecimiento) | "que es el dengue", "pronostico de dengue", "dengue en Veracruz", "que modelos usan para dengue" |
| Equipo/infraestructura | "equipo del proyecto", "infraestructura AWS" |

---

## Visualizaciones Interactivas

### Charts Inline (Chart.js)

EpiBot genera graficas en vivo dentro del chat cuando detecta contexto numerico, con acabado unificado (gradientes por canvas, glow en lineas, crosshair, formato es-MX, paleta **Clinical Indigo**):

- **Barras agrupadas / apiladas** por padecimiento, motor, sexo o anio
- **Treemap** de casos por entidad · **Radar** de motores · **Sparklines** (16/32 estados)
- **Tendencia historica** (nacional o **por estado** cuando hay `anual_por_estado_pad`)
- **Matriz de rendimiento** (burbujas), **Calibracion** (scatter), **Arsenal de motores** (polar)
- **Medidor (gauge)** de salud, **Caja y bigotes** de SMAPE, **Cascada** (waterfall), **Volumen vs error** (combo doble eje)
- **Corredor de confianza**, **heatmap de error**, **mapa de Mexico**, **semaforo**, **timelapse**, **comparador**

Los graficos de seguimiento **heredan el padecimiento/estado del contexto** ("¿y en Jalisco?" tras una pregunta sobre Depresion grafica Depresion en Jalisco; "por sexo" cambia a barras por sexo).

### Mapas de Mexico (mexico-map.js)

Mapas SVG interactivos de las 32 entidades federativas:

- **Mapa de casos** por padecimiento y sexo (3 padecimientos x 3 filtros de sexo)
- **Mapa de SMAPE** con gradiente de precision por estado
- Tooltip con nombre del estado, valor y detalle al pasar el cursor
- Leyenda con gradiente de color dinamico
- Accesibles desde el menu hamburguesa del chat

### Timelapse Animado (timelapse.js)

Animacion temporal que muestra la evolucion semana a semana:

- 52 frames (uno por semana epidemiologica)
- Distribucion proporcional basada en patron semanal nacional
- Controles: play/pause, velocidad 1x/2x/4x, slider, contador de semana
- Escala de color consistente (min/max global)

### Semaforo Epidemiologico (semaforo.js)

Clasificacion de riesgo por estado basada en percentiles:

- 4 niveles: verde (< P25), amarillo (P25-P50), naranja (P50-P75), rojo (> P75)
- Grid de 32 tarjetas ordenadas por nivel de riesgo
- Cada tarjeta: nombre, tendencia (flecha SVG), casos, desglose por padecimiento, badge SMAPE
- Barra resumen con conteo por nivel y seccion de alertas

### Comparador de Estados (comparador.js)

Comparacion visual lado a lado de dos entidades:

- Se activa con "compara X y Y" cuando se detectan 2+ estados
- Layout split: dos columnas con divisor vertical
- Por columna: header con corona SVG para ganador, casos totales, metricas, barras por padecimiento
- Seccion versus: barras duales izquierda/derecha por padecimiento

### Reporte PDF (generatePDFReport)

Generacion de reporte ejecutivo imprimible:

- KPIs: casos totales, modelos, SMAPE mediano, motores
- Tabla por padecimiento con casos y SMAPE promedio
- Top 10 entidades con indicador de riesgo por color
- Mini semaforo de 32 entidades
- Distribucion de motores de IA
- Branding IMSS, boton "Imprimir / Guardar PDF"

---

## Entrada y Salida por Voz (voice.js)

### Speech-to-Text (STT)

- Boton de microfono al lado del input con animacion pulsante
- Web Speech API con `lang: 'es-MX'`
- Texto interim visible en el input como feedback visual
- Envio automatico al terminar de hablar
- Compatibilidad Safari (fallback via `onend` cuando `isFinal` no se dispara)
- Graceful degradation: boton oculto en navegadores sin soporte

### Text-to-Speech (TTS)

- Auto-speak cuando la pregunta fue por voz
- Boton de altavoz en cada respuesta para reproduccion manual
- **Seleccion inteligente de voz** con scoring:
  - Google cloud (+80) > Paulina macOS (+60) > otras voces
  - Penaliza voces novelty roboticas (Eddy, Rocko, Flo, etc.)
  - Rate/pitch ajustados por tipo de voz para naturalidad
- Nunca habla con voz en ingles (requiere voz espanola disponible)
- **Boton Stop** (rojo pulsante) aparece durante la reproduccion
- **Boton Mute** en header para silenciar/activar TTS globalmente
- Trunca respuestas largas a 600 caracteres
- Workaround para bug de Chrome que corta utterances largos

---

## Visualizaciones Tableau

El dashboard (`EpiDashboard.html`) incluye embeds interactivos de Tableau Public:

- **Tabla de datos consolidada** con datos SINAVE e INEGI
- **Mapa de Mexico** con densidad poblacional y casos por sexo
- **Categorias territoriales** por region geografica y socio-urbana
- **Casos por anio** con desagregacion por sexo
- **Casos por semana** con dinamica temporal
- **Predicciones** multi-modelo (Prophet, DeepAR, Ensemble, Stacking)

Son **diez vistas** del workbook `viz_epiforecastmx_17873231502650`, publicado en Tableau
Public bajo la cuenta **`javier.rebull3700`**.

> **Al republicar, conservar el nombre del workbook.** Los embeds lo alcanzan por
> `name='viz_epiforecastmx_17873231502650/<vista>'`; si Tableau le anade otra marca de tiempo
> hay que actualizar las **30 referencias** de `EpiDashboard.html` (10 en `name`, 20 en
> `static_image`).

> **El tablero lleva un extracto, no conexion viva.** El conector de Google Drive de Tableau
> Desktop Public Edition 2025.3.2 rechaza la lectura aun con el permiso concedido y
> confirmado (`A7AE75CC`); esta descartado todo lo descartable y documentado en
> `docs/GUIA_PUBLICAR_TABLEAU_2026-08-25.md` del repo principal. **Consecuencia: hay que
> republicar el workbook a mano** despues de cada actualizacion semanal.

---

## Galeria de Pronosticos

La seccion **Reports/** contiene una galeria HTML interactiva con graficos de pronostico organizados por padecimiento, entidad y sexo.

- Filtros por padecimiento, nivel (estatal, nacional, regional) y sexo
- Busqueda por nombre de estado o region
- Vista grid / lista con lightbox
- Ficha tecnica en cada grafico: modelo, metricas, tipo (propio vs fallback)

---

## Reportes HTML

| Archivo | Contenido |
|---|---|
| `reporte_resultados.html` | Resultados del modelado: KPIs, ranking de 333 modelos, cobertura |
| `comparacion_modelos.html` | Comparativa visual de 4 motores (Prophet, DeepAR, Ensemble, Stacking) |
| `validacion_semanal.html` | Validacion Real vs Forecast con datos del boletin mas reciente |
| `bitacora_modelado.html` | Bitacora historica del modelado Prophet v1-v6 |
| `ficha_tecnica_prophet.html` | Ficha tecnica del modelo Prophet |
| `hiperparametros_modelos.html` | Hiperparametros de los 4 motores |
| `conclusiones.html` | Conclusiones clave del proyecto |
| `construccion_dashboard.html` | Documentacion de la construccion del dashboard |
| `referencias.html` | Referencias bibliograficas |
| `auditoria_remediacion_2026.html` | Auditoria de calidad y remediacion |

---

## Novedades y prensa

La bitacora publica del proyecto vive en `novedades.html` y se alimenta **sola** de
`news.json`: la portada toma los items mas recientes para su banner y Novedades los pinta
todos. Cada hito grande tiene ademas **pagina propia**, enlazada desde su item.

| Pagina | Hito |
|---|---|
| `calass.html` | CALASS 2026 — XXXVI Congreso de la ALASS, Universite de Montreal, 27-ago-2026 |
| `helix.html` | Primer lugar en el International Summit HELIX 2026 Mexico |
| `future_health.html` | Ponencia aceptada en la 2nd Public Health Conference (Skopje) |
| `micai.html` | Articulo MICAI 2026 (version digital + PDF) |

### Publicar una noticia toca cinco superficies

1. **`news.json`** — el item nuevo va **primero**. Campos: `date`, `iso`, `type`, `tag`,
   `featured`, `title`, `body[]` (acepta HTML), `link` y el opcional **`summary`**. Sin
   `summary`, el banner de la portada corta el primer parrafo a 150 caracteres y suele
   partir la frase por la mitad.
2. **La pagina del hito**, si lo merece. Se clona el armazon de `helix.html`: nav,
   tipografia, galeria `.doc-gallery` y lightbox ya vienen resueltos.
3. **`index.html`** — el color del tag (`.news-tag--<type>`) y, si el `type` es nuevo, el
   filete de la tarjeta (`.news-card--<type>::before`).
4. **`index.html` otra vez: el banner estatico.** Es el respaldo para cuando falla el
   `fetch` de `news.json` y **no se actualiza solo**. Si no se toca, el sitio sigue
   anunciando como «lo mas nuevo» algo viejo cada vez que la red falla.
5. **`sitemap.xml`** — alta de la pagina nueva.

> **El gate de cifras alcanza a la pagina nueva.** `npm run cifras:verify` recorre **todo**
> el `.html`/`.json` publicado desde la raiz, no una lista escogida a mano. Una nota que
> escriba «435 modelos» rompe el despliegue, y hace bien.

### Las fotos

Se recortan a una proporcion **comun (3:2)** antes de subirlas: la galeria las coloca en una
reticula de dos columnas y, con proporciones distintas, los pies quedan desalineados. Las de
iPhone llegan en HEIC; `sips -s format jpeg` las convierte y, ya en Pillow,
`ImageOps.exif_transpose` respeta la orientacion (hay fotos con `orientation: 3`, giradas
180 grados, que sin eso salen de cabeza). Van a `Reports/<hito>/` a 1600 px de ancho y
calidad 82.

---

## Estructura del Sitio

```
EpiForecast-IMSS-Dashboard/
├── index.html                      # Pagina principal del proyecto
├── EpiDashboard.html               # Dashboard con visualizaciones Tableau
├── dengue.html                     # Pagina del 4.o padecimiento (Dengue): EDA, modelado y pronostico
├── novedades.html                  # Bitacora publica; se pinta desde news.json
├── news.json                       # Items de novedades, el mas reciente primero
├── calass.html                     # CALASS 2026, Montreal: la ponencia, con fotos
├── helix.html                      # Primer lugar en HELIX 2026 Mexico
├── future_health.html              # Ponencia aceptada en Skopje
├── micai.html                      # Articulo MICAI 2026 (version digital)
├── metodologia_dengue.html         # Metodologia del pipeline de Dengue
├── pipeline_diagramEDA.html        # Diagrama del pipeline de EDA
├── editorial.css                   # Nav y tipografia editorial, compartidos
├── sitemap.xml                     # Alta de cada pagina publicada
├── reporte_resultados.html         # Reporte interactivo de 333 modelos
├── comparacion_modelos.html        # Comparativa de 4 motores
├── validacion_semanal.html         # Validacion semanal Real vs Forecast
├── bitacora_modelado.html          # Bitacora Prophet v1-v6
├── ficha_tecnica_prophet.html      # Ficha tecnica Prophet
├── hiperparametros_modelos.html    # Hiperparametros de motores
├── conclusiones.html               # Conclusiones clave
├── construccion_dashboard.html     # Documentacion del dashboard
├── referencias.html                # Referencias bibliograficas
├── auditoria_remediacion_2026.html # Auditoria de calidad
├── Reports/
│   ├── index.html                  # Galeria interactiva de pronosticos
│   ├── Alzheimer/                  # PNGs por entidad y sexo
│   ├── Depresion/
│   ├── Parkinson/
│   ├── dengue/                     # Charts y JSON del 4.o padecimiento (mapa, EDA, pronostico)
│   ├── calass/                     # Fotos del congreso CALASS 2026
│   ├── helix/                      # Constancia del Summit HELIX 2026
│   └── future_health/              # Aceptacion de la ponencia de Skopje
├── epibot/                             # EpiBot - Asistente conversacional
│   ├── index.html                  # UI del chat
│   ├── knowledge.json              # Base de datos (metricas, boletin, modelos)
│   ├── css/style.css               # Estilos IMSS 2026
│   ├── js/
│   │   ├── app.js                  # UI, charts, mensajes (~2300 lineas)
│   │   ├── kb.js                   # Knowledge base, 30+ handlers (~3900 lineas)
│   │   ├── entities.js             # Deteccion de entidades NLP
│   │   ├── mexico-map.js           # Mapas SVG interactivos
│   │   ├── timelapse.js            # Animacion semanal
│   │   ├── semaforo.js             # Semaforo de riesgo
│   │   ├── comparador.js           # Comparador lado a lado
│   │   └── voice.js                # STT + TTS
│   ├── netlify/functions/          # Gemini fallback
│   └── tests/                      # Tests unitarios
└── README.md
```

---

## Navegacion

```
index.html
  ├──> EpiDashboard.html            (Dashboard Tableau)
  ├──> dengue.html                  (Dengue - 4.o padecimiento)
  ├──> reporte_resultados.html      (Reporte de Modelos)
  ├──> comparacion_modelos.html     (Comparativa de Motores)
  ├──> Reports/index.html           (Galeria de Pronosticos)
  ├──> novedades.html               (Bitacora publica)
  │      ├──> calass.html           (CALASS 2026, Montreal)
  │      ├──> helix.html            (HELIX 2026 Mexico)
  │      └──> future_health.html    (Skopje)
  └──> epibot/index.html                (EpiBot - Chat Inteligente)
```

Todas las paginas incluyen navegacion cruzada entre si.

---

## Stack Tecnico

| Componente | Tecnologia |
|---|---|
| Frontend | HTML5 + CSS3 + ES Modules (vanilla JS) |
| Chatbot | Knowledge base local + NLP de entidades |
| Visualizacion | Chart.js 4.x, SVG maps, Tableau Public |
| Voz | Web Speech API (SpeechRecognition + SpeechSynthesis) |
| Markdown | marked.js |
| IA fallback | Google Gemini via Netlify Functions |
| Hosting | Netlify (deploy automatico en push a main) |
| Repositorio | GitHub (EpiForecastMX) |

---

## Fuentes de Datos

- **SINAVE** -- Boletines epidemiologicos semanales (neurologicos 2014-2026; Dengue 2018-2026), procesados mediante pipeline automatizado. Incluye desglose por sexo y entidad federativa.
- **INEGI** -- Datos demograficos complementarios por entidad federativa.
- **knowledge.json** -- Generado por el pipeline del repo principal (`scripts/build_web_knowledge.py`), contiene: estadisticas globales, metricas por modelo/padecimiento/estado/sexo, datos del boletin, comparativa semanal, configuracion de entrenamiento.

### Actualizacion semanal

Desde el repo principal, un solo comando descarga el boletin mas reciente, regenera
`knowledge.json` y hace push a este dashboard:

```bash
# En el repo EpiForecast-MX
make update-week
```

**Pero eso no lo actualiza todo.** Quedan **dos pasos manuales** despues:

| paso | por que es manual |
|---|---|
| Publicar a Google Sheets | `data/processed/tableau_model.xlsx` esta **gitignorado** (11 MB) y ningun workflow lo genera, asi que `gsheets.yml` **no puede correr solo**: fallaria al no encontrarlo. |
| Republicar el workbook de Tableau | el tablero lleva **extracto**, no conexion viva (ver arriba). |

Hoja de datos vigente: `tableau_epiforecast` en el Drive de `javirebull@gmail.com`
(ID `1yQ4tL7NzaUBplsoOfP9BVXARwUrb8h0i70vpDGvHpOQ`), con las dos cuentas de servicio como
editoras. La variable `GSHEETS_SPREADSHEET_ID` del repo principal ya apunta ahi.

---

## Desarrollo Local

```bash
# Clonar el repositorio
git clone https://github.com/EpiForecastMX/EpiForecast-IMSS-Dashboard.git
cd EpiForecast-IMSS-Dashboard

# Servir con Python
python3 -m http.server 8080

# Abrir en navegador: http://localhost:8080
# EpiBot: http://localhost:8080/epibot/
```

Para el fallback de Gemini en desarrollo local, se requiere Netlify CLI:

```bash
npm install
netlify dev
```

---

## Despliegue

El sitio se despliega automaticamente a traves de **Netlify** al hacer push a la rama `main`. No requiere comandos de build.

---

## Proyecto Principal

Este dashboard es el componente de visualizacion del proyecto [EpiForecast-MX](https://github.com/EpiForecastMX/EpiForecast-MX), que incluye el pipeline completo de extraccion, procesamiento, entrenamiento multi-modelo (Prophet, DeepAR, Ensemble, Stacking) y generacion de pronosticos epidemiologicos.

---

## Equipo

| Integrante | Rol |
|---|---|
| Javier Rebull | Sr. Associate Application Developer - Santander Bank US |
| Juan Carlos Perez Nava | Profesional de TI -- IMSS |
| Luis Gerardo Sanchez Salazar | Sr. Controls Engineer -- Tesla |

**Asesora academica:** Dra. Grettel Barcelo Alonso -- Tecnologico de Monterrey

**Stakeholders IMSS:** Dra. Ruth Perez (Lider de Proyecto) -- Dra. Lina Diaz Castro (Investigadora en Psiquiatria)

---

<p align="center">
  <strong>Tecnologico de Monterrey</strong> · <strong>IMSS</strong> · Equipo 01 -- 2026
</p>
