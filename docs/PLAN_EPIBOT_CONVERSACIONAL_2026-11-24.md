# Plan de rediseño conversacional del EpiBot (24 de noviembre de 2026)

## Por qué

Crítica recibida: «no sirve, es peor que hablarle a Alexa o a Siri». Prueba en vivo en
`https://epiforecast.mx/epibot/` el 24-nov-2026: de doce preguntas naturales, diez recibieron
«No reconozco algunos términos de tu mensaje… Línea de la Vida 800 911 2000», incluidas
«¿está subiendo la diabetes en Nuevo León?», «¿qué tan confiables son sus pronósticos?» y «gracias».

## Mesa redonda (cuatro expertos, mismo día)

| Experto | Diagnóstico principal |
|---|---|
| Seguridad y crisis | La guarda global de vocabulario cerrado (`fueraDeVocabulario`) rechaza toda palabra fuera de una lista blanca y el estado «apoyo» es pegajoso. Pero 97 frases de riesgo de las pruebas sólo las frena esa guarda: retirarla exige ampliar el detector de crisis. Hay falsos positivos de crisis («¿cuántas personas pueden morir de dengue?», «me tomé la presión»). |
| Arquitecto NLU | La intención se decide por listas de palabras; la primera pregunta de cada sesión responde «todavía se está cargando» porque se descargan las 151 vistas (unos 71 MB) sin esperarlas. No hay tendencia, periodos, confianza ni ranking entre padecimientos. La memoria no recuerda la intención. |
| Diseño conversacional | El saludo es técnico y obsoleto (333 modelos, cuatro padecimientos). Las respuestas ponen la metodología primero y la cifra al final. Los chips y el panel hablan de motores, no de preguntas de usuario. «Gracias» y «ayuda» no tienen respuesta. |
| Epidemiología | Lo que la gente pregunta: ¿cuántos casos?, ¿sube o baja?, ¿es mucho comparado con otros años?, ¿dónde hay más?, ¿qué tan confiable es? Todo se puede calcular de `vista.json` (observado, pronóstico, desempeño fuera de muestra) sin inventar intervalos ni presentar un control como validado. |

## Reglas que no cambian

- Un control estacional nunca se presenta como validado; no hay intervalos donde no los hay.
- Ninguna cifra la genera Gemini; los números salen de `vista.json`, `knowledge.json` o el radar.
- Riesgo real (ideación suicida, autolesión, ingestión en primera persona, violencia) recibe la
  respuesta de crisis. Los padecimientos sensibles (X60-X84, X70, violencias) conservan su guarda estricta.

## Fases

1. **Seguridad proporcionada.** Retirar la guarda global de vocabulario para turnos sin riesgo y sin
   padecimiento sensible; eliminar el estado «apoyo»; ampliar el detector de crisis (normalización de
   leet, letras repetidas y separadas, jergas, inglés) hasta cubrir las frases de riesgo de las pruebas;
   corregir falsos positivos («morir de dengue», «me tomé la presión»). Un turno personal ambiguo sin
   ningún dato reconocido recibe «no entendí» con una línea de apoyo suave, sin pegarse a los turnos
   siguientes. Mismo cambio en el cliente y en la función RAG.
2. **Carga bajo demanda.** La vista del padecimiento pedido se descarga y se espera antes de responder;
   se deja de precargar todo el catálogo.
3. **Respuesta primero.** Para los padecimientos del runner: primera línea con la respuesta directa
   (sube, baja o estable), luego casos recientes frente al año anterior, lo esperado en las próximas
   cuatro semanas, los estados con más casos y la confiabilidad en tres niveles (alta, media, baja)
   en lenguaje llano. La ficha técnica queda plegada en «Cómo se calculó».
4. **Intenciones.** Tendencia, periodos («próximo mes», «la semana pasada»), confianza, definición
   («qué es»), ranking entre padecimientos («qué enfermedades van al alza»); la memoria conserva la
   intención para «¿y en Sonora?».
5. **Charla y ayuda.** Saludo al día (152 padecimientos), «gracias», «qué puedes hacer», síntomas
   («no puedo diagnosticar; acude a tu unidad de salud»), «no entendí» con sugerencias basadas en lo
   que sí se entendió.
6. **Interfaz.** Chips y estado vacío con preguntas de usuario; herramientas técnicas agrupadas como
   «Para especialistas»; botones de seguimiento por respuesta.
7. **Verificación.** Batería de frases naturales como prueba de regresión, suite completa en verde,
   despliegue y comprobación en vivo.

## Implementado (24 de noviembre de 2026)

| Fase | Cambio | Dónde |
|---|---|---|
| 1 | La lista blanca global sólo niega la respuesta a un turno personal sin ningún dato reconocido; el estado «apoyo» ya no persiste. Detector de crisis ampliado: leet, letras repetidas o separadas, caracteres de ancho cero, jergas («petatear», «dar cuello», «ya valí»), inglés («unalive», «nobody would miss me»), violencia vivida («me hace daño», «me da golpes»). Señales débiles (sustancias sueltas, «no puedo», súplicas, escritura no latina) dan una vez el «no entendí» con la Línea de la Vida, sin cifras. Falsos positivos corregidos: «morir de dengue», «desaparecer el dengue», «me tomé la presión». | `js/release_catalog.js` (`apoyoSuave`, `apoyoInmediato`, `riesgoAmpliado`), `js/kb.js`, `netlify/functions/rag.mjs` |
| 2 | Las vistas (unos 500 KB cada una, 71 MB en total) se cargan sólo cuando la consulta nombra el padecimiento. Adiós al «todavía se está cargando». | `js/kb.js` (`cargaVista`, `cargaVistasDeConsulta`) |
| 3 | Respuesta llana: primero si sube, baja o se mantiene (con freno de credibilidad y aviso de notificación atípica), luego casos frente al año anterior, acumulado del año, pico esperado, dónde hay más y confiabilidad alta, media o baja; la ficha técnica se pliega en «Cómo se calculó». Los controles estacionales se dicen en condicional y nunca como validados. También para Dengue, Depresión, Parkinson y Alzheimer. | `js/resumen_llano.js`, `js/obesidad_kb.js`, `js/conversacion.js` (`answerLegacyLlano`) |
| 4 | Intenciones: tendencia («¿está subiendo…?» responde «Sí» o «No»), periodos («en diciembre», «la semana pasada», «este año»), confiabilidad, «qué es» (con enlace a MedlinePlus en español), ranking «¿qué enfermedades van al alza?» desde `resumen_padecimientos.json` (sin temas sensibles ni series de menos de 50 casos). La memoria conserva padecimiento, estado y sexo para «¿y en Sonora?», «¿y en mujeres?». | `js/conversacion.js`, `scripts/build_resumen_padecimientos.mjs` |
| 5 | Saludo al día (152 padecimientos), «gracias», «adiós», «¿qué puedes hacer?», síntomas (no diagnostica; urgencias y 911 ante datos de alarma), confiabilidad general con el conteo real por nivel. Prompt del RAG: respuesta directa en la primera oración, lenguaje llano, sin consejo médico. | `js/conversacion.js`, `netlify/functions/rag.mjs` |
| 6 | Estado vacío con preguntas de usuario, botones de seguimiento propuestos por cada respuesta (`<!--SIGUE:…-->`), panel lateral con «Preguntas frecuentes» y «Para especialistas». | `js/app.js`, `index.html`, `css/shell.css` |
| 7 | `tests/test_rediseno_conversacional.mjs` (116 pruebas: preguntas naturales, frases benignas, riesgo real, señales débiles, falsos positivos, respuesta llana, ranking, carga bajo demanda). Las pruebas antiguas filtran con `tests/politica_conversacional.mjs` las frases que ahora se responden a propósito; la seguridad real sigue exigida. | `tests/` |

**Mantenimiento semanal.** Tras instalar vistas nuevas, `npm run resumen:build` regenera el resumen nacional; `npm test`
falla con un mensaje claro si quedó desfasado y el build de Netlify lo regenera antes de las pruebas.

**Pendiente.** Definiciones clínicas propias de los 148 padecimientos (hoy se enlaza a MedlinePlus) y un respaldo de
comprensión con Gemini en modo JSON para frases que el parser no entiende.
