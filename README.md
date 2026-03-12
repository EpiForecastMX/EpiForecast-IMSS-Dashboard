# EpiForecast-MX Dashboard

**Plataforma de inteligencia epidemiologica con asistente conversacional, visualizaciones interactivas y pronosticos multi-modelo para el IMSS.**

Sitio en vivo: [proyectointegrador.org](https://proyectointegrador.org/)

---

## Descripcion

Dashboard interactivo del proyecto **EpiForecast-MX**, desarrollado en colaboracion entre el **Tecnologico de Monterrey** y el **Instituto Mexicano del Seguro Social (IMSS)**. Cubre tres padecimientos clave:

| Codigo CIE-10 | Padecimiento |
|:-:|---|
| F32 | Depresion |
| G20 | Enfermedad de Parkinson |
| G30 | Enfermedad de Alzheimer |

El sitio integra visualizaciones Tableau, un chatbot conversacional con base de conocimiento local (EpiBot), mapas interactivos de Mexico, y herramientas avanzadas de analisis epidemiologico.

---

## EpiBot - Asistente Conversacional

El componente principal del dashboard es **EpiBot** (`kb/`), un asistente conversacional que responde preguntas sobre el proyecto con datos reales de 333 modelos de produccion.

### Arquitectura

```
kb/
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
- Respuestas basadas en **datos reales** de `knowledge.json` (generado por el pipeline del repo principal).
- Fallback a **Gemini** via Netlify Function cuando la pregunta excede la base local.
- Historial conversacional para contexto en preguntas de seguimiento.

### Deteccion de Entidades (entities.js)

- **32 estados** + regiones INEGI con aliases (CDMX, Edomex, EdoMex, etc.)
- **3 padecimientos** con aliases y codigos CIE-10 (F32, G20, G30)
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
| Equipo/infraestructura | "equipo del proyecto", "infraestructura AWS" |

---

## Visualizaciones Interactivas

### Charts Inline (Chart.js)

EpiBot genera graficas en vivo dentro del chat cuando detecta contexto numerico:

- **Barras agrupadas** por padecimiento y anio
- **Treemap** de casos por entidad (color segun SMAPE)
- **Radar** comparativo de motores de prediccion
- **Barras** SMAPE por motor
- **Corredor endemico** para padecimientos con datos historicos

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

## Estructura del Sitio

```
EpiForecast-IMSS-Dashboard/
├── index.html                      # Pagina principal del proyecto
├── EpiDashboard.html               # Dashboard con visualizaciones Tableau
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
│   └── Parkinson/
├── kb/                             # EpiBot - Asistente conversacional
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
  ├──> reporte_resultados.html      (Reporte de Modelos)
  ├──> comparacion_modelos.html     (Comparativa de Motores)
  ├──> Reports/index.html           (Galeria de Pronosticos)
  └──> kb/index.html                (EpiBot - Chat Inteligente)
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
| Repositorio | GitHub (IntegradorIMSS2026Team01) |

---

## Fuentes de Datos

- **SINAVE** -- Boletines epidemiologicos semanales (2012-2025), procesados mediante pipeline automatizado. Incluye desglose por sexo y entidad federativa.
- **INEGI** -- Datos demograficos complementarios por entidad federativa.
- **knowledge.json** -- Generado por el pipeline del repo principal (`scripts/build_web_knowledge.py`), contiene: estadisticas globales, metricas por modelo/padecimiento/estado/sexo, datos del boletin, comparativa semanal, configuracion de entrenamiento.

---

## Desarrollo Local

```bash
# Clonar el repositorio
git clone https://github.com/IntegradorIMSS2026Team01/EpiForecast-IMSS-Dashboard.git
cd EpiForecast-IMSS-Dashboard

# Servir con Python
python3 -m http.server 8080

# Abrir en navegador: http://localhost:8080
# EpiBot: http://localhost:8080/kb/
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

Este dashboard es el componente de visualizacion del proyecto [EpiForecast-MX](https://github.com/IntegradorIMSS2026Team01/EpiForecast-MX), que incluye el pipeline completo de extraccion, procesamiento, entrenamiento multi-modelo (Prophet, DeepAR, Ensemble, Stacking) y generacion de pronosticos epidemiologicos.

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
