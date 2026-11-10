# EpiForecast-MX Dashboard

**Plataforma de inteligencia epidemiológica con asistente conversacional, visualizaciones interactivas y pronósticos multimodelo para el IMSS.**

Sitio en vivo: [epiforecast.mx](https://epiforecast.mx/)

El estado del e-póster WCP 2026 está en `wcp2026.html` y en la documentación interna del repo
principal (`Congresos/Mundial/ESTADO_ACTUAL_WCP.md`); este README describe el sitio.

---

## Estado: 10 de noviembre de 2026

| | |
|---|---|
| Padecimientos publicados | **35** = 4 del carril original + 31 releases del runner |
| Datos reales hasta | **boletín 43 de 2026** (carril original y radar); **semana 42** observada en los releases del runner |
| Series productivas del carril original | **432** = 333 neuro + 99 dengue |
| Gráficos publicados del carril original | **432** = 333 neuro + 99 dengue (ronda W37; hasta W33 eran 444 con las 4 regiones de dengue) |
| Tablero Tableau | histórico, corte W31 de 2026 (`javier.rebull3700` / `viz_epiforecastmx_17873231502650`) |
| Despliegue | Netlify, en cada push a `main`, tras el comando de build de `netlify.toml` |
| Ramas | sólo `main` |

### Contrato de cifras públicas

Las cifras del carril original están **congeladas** y un gate las comprueba en cada despliegue.
El build de Netlify corre, en orden, las pruebas del radar (`test:boletin`), las del contrato de
cifras (`cifras:test`) y `npm run deploy:verify`. Éste comprueba primero la nota de picos heredados
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
**treinta y cinco padecimientos**:

- **Carril original (cuatro):** Depresión (F32), enfermedad de Parkinson (G20), enfermedad de
  Alzheimer (G30) y Dengue (A97). Los tres neurológicos son la cohorte de 333 modelos; Dengue tiene
  su propio pipeline de conteos y página en `dengue.html` (pronóstico a un año; la proyección NB-GLM a
  cinco años se retiró en W37).
- **Releases del runner genérico (treinta y uno):** publicados desde releases sellados
  (`publication/catalog.json`): obesidad, diabetes tipo I y II, anorexia y bulimia, hipertensión,
  enfermedad isquémica y cerebrovascular, seis padecimientos del radar del boletín (el sexto, asma),
  neumonías y bronconeumonías y diecisiete cánceres. Cada uno tiene su página `<id>.html`. Los que no superaron su prueba de aceptación
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
alimentado por la sección `dengue` de `knowledge.json`) y de los **treinta y un padecimientos del
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
│   ├── app.js              # UI principal, gráficas y mensajes (~4,200 líneas)
│   ├── kb.js               # Base de conocimiento: handlers en cadena de prioridad (~5,900 líneas)
│   ├── entities.js         # Detección de entidades (estados, padecimientos, sexo, motores)
│   ├── release_catalog.js  # Catálogo único de los releases del runner y de los no modelados
│   ├── release_config.js   # Alias, VOCAB, padMap y marcadores derivados del catálogo
│   ├── obesidad_kb.js      # Handler genérico de releases (respuestas desde la vista)
│   ├── obesidad_charts.js  # Gráficas de releases
│   ├── display.js          # Nombres para pantalla (dn) y polishSpanish
│   ├── comparador.js, comparador_data.js, mexico-map.js, timelapse.js, semaforo.js, voice.js
│   └── point_only.js, calendario_boletin.js, comparacion_rondas*.js
├── netlify/functions/rag.mjs   # RAG con Gemini (recuperación, rerank y generación)
├── scripts/                # rag:build, install_publication.mjs, picos_heredados.mjs, verify_deploy.mjs
└── tests/                  # Pruebas unitarias y de conversación
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

### RAG (rag_index.json + netlify/functions/rag.mjs)

Para preguntas de conocimiento (metodología, decisiones de diseño, el paper MICAI, «por qué», «cómo
funciona»), EpiBot usa **Retrieval-Augmented Generation** con grounding y citas:

- **Corpus** (`scripts/lib/corpus.mjs`): paper MICAI 2026 (`rag_sources/micai.txt`) y tarjetas en
  español que lo resumen, notas y reportes HTML del proyecto, tarjetas estructuradas de
  `knowledge.json` y el corpus de cada release publicado según `publication/pointers.json` (horizonte,
  corte de datos, desempeño fuera de muestra, motores, avisos de control y de picos heredados de la
  fuente). Chunking consciente de secciones. ~560 chunks.
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
- Los cuatro padecimientos originales y los alias y códigos CIE-10 de los treinta y un releases del
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

Clasificación de riesgo por estado basada en percentiles: cuatro niveles, 32 tarjetas ordenadas,
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

`Reports/index.html` contiene la galería interactiva organizada por padecimiento, nivel (nacional,
estatal, regional) y sexo, con búsqueda, vista de cuadrícula o lista y lightbox. Las 432 gráficas del
carril original están en la lista `DATA`. Los releases del runner se integran en los mismos niveles,
dibujados con Chart.js desde su vista publicada (`Reports/obesidad_galeria.js`), fuera de `DATA` y
sin métricas de error.

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
├── <id>.html                       # 31 páginas de releases del runner
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
│   ├── obesidad_galeria.js         # Galería de releases (desde la vista)
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
2. **Treinta y un releases del runner**: `make semana-revisa`, `make semana-observa PDF=… SALIDA=…`,
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

Para la función RAG en local se requiere Netlify CLI:

```bash
npm install
netlify dev
```

---

## Despliegue

Netlify despliega en cada push a `main` tras correr el comando de build de `netlify.toml` (pruebas
del radar, contrato de cifras, nota de picos y gates de cifras y RAG). Si cualquiera falla, el
despliegue no se publica.

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
