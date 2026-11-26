# Plan canónico de mejora del EpiBot — 26-nov-2026

Orden del autor: «haz un plan canon de mejora del EpiBot con todos los agentes». Sale de la mesa de ocho asientos (Codex Sol,
Codex Astra, Grok, Fable, Opus, Gemini Neon, Gemini Hydrogen y DeepSeek), convocada sobre `main` `2cc09ef4` antes de tocar el
código, con 36 respuestas reales del motor local (`respuestas/respuestas.md`). Dictámenes en `dictamenes/`. Este documento
es el plan vigente del EpiBot; los planes anteriores (`mesa_epibot_agentico_2026-11-25/PLAN.md`) quedan como historia.

## Principio rector

**La primera línea contesta lo que se preguntó, con el dato correcto para ese periodo y ese lugar, y no afirma más de lo que
el dato sostiene.** Las ocho miradas llegan ahí: el motor calcula bien (Codex Sol reprodujo las sumas y los 136 resúmenes),
pero a menudo contesta otra pregunta, con otra ventana o con un verbo más seguro que su evidencia.

## Diagnóstico de consenso

| # | Problema | Evidencia (pregunta de la batería) | Asientos |
|---|---|---|---|
| D1 | La respuesta no empieza por lo pedido | «¿cuál es el sMAPE de hipertensión?» abre con 47,361 casos (el 1.9 % va en el plegado); «¿la varicela está validada?» abre con «aumente»; el pico de influenza nunca dice que no hay pico | Grok, Fable, Opus, Astra, Neon, DeepSeek |
| D2 | «Sí.»/«No.» en preguntas abiertas | «¿dónde sube más rápido la hepatitis A?» → «Sí.» y la tendencia nacional; «¿la leptospirosis va a subir?» (control) → «Sí.» | Grok, Fable, Hydrogen, Opus |
| D3 | Ruta equivocada en dengue | «¿qué estados tendrán más casos de dengue el próximo mes?» → 8,811 casos nacionales en 52 semanas y «el modelo usa esa señal del clima» (motor DeepAR; el escenario El Niño se retiró) | Sol, Astra, Grok, Fable, Hydrogen, Opus |
| D4 | «Qué va al alza» mezcla controles y desviados con pronósticos | Leptospirosis (+221 %, control que esperaba 68 y vio 2 en Veracruz) y hepatitis A (+68 %, se pasó 136 % en su única semana) encabezan; «corte común» falso (114 vistas en W43 y 22 en W44); la gráfica de barras de % del PR #146 amplifica el problema | Fable, Grok, Opus, Sol, DeepSeek |
| D5 | Comparación interanual desalineada | `indicadores()` resta 364 días: con 2025 de 53 semanas compara W40–W43 con W41–W44 (diabetes en Puebla −14 % debería ser +9 %; obesidad +22 % debería ser +24 %) | Sol |
| D6 | Validación y confiabilidad incoherentes | Asma «2/4» en el resumen y «1 prospectiva» en el detalle; «confiabilidad media» con 136 % de desvío en 1 semana (las degradaciones exigen ≥ 2 semanas); obesidad «alta… acertó» con −10.3 % de sesgo | Sol, Fable, Astra, Grok, DeepSeek |
| D7 | Preguntas clínicas sin ruta segura | «¿puedo tomar paracetamol con dengue?», «¿el dengue mata?», «¿debo vacunarme?» reciben cifras, el radar o «No entendí» con la Línea de la Vida; contagio y prevención dependen del RAG (Gemini en 402; el verificador no revisa afirmaciones clínicas) | Fable, Astra, DeepSeek |
| D8 | Viaje y seguridad personal | «¿es seguro viajar a Cancún por el dengue?» abre con «disminuya 55 %» (confiabilidad baja) y nunca dice que no valora la seguridad; `answerViaje` se apaga si hay padecimiento | Grok, Fable, Astra |
| D9 | Gráfica que no responde lo mismo que el texto | Ranking estatal y mapa en 52 semanas mientras el texto da 4; dengue sin marcador de gráfica; comparación de originales `SIN_GRAFICA`; preguntas de error dibujan la serie larga | Opus, Neon |
| D10 | Robustez y medición | La guarda de crisis del núcleo espera la red (`_resolve`); el calificador puede premiar respuestas vacías o sin la cifra pedida; la voz corta antes del dato y lee guiones bajos | Astra, Hydrogen, Neon |
| D11 | Formato y largo | Cinco formatos de semana en una respuesta («semanas 40 a 43», «Semana del 2026-11-02», «2026-W43»…); ~180 palabras antes del plegado; pies duplicados | Opus, Neon |
| D12 | Español coloquial y seguimientos | Coloquialismos que caen en FAQ; aclaraciones que pierden estado y sexo; corrector dividido | Hydrogen |

## Reglas que no cambian

Ninguna cifra inventada; un control nunca se presenta como validado ni como expectativa firme; casos notificados sin ajustar por
población; crisis y temas sensibles con su respuesta fija (sólo cambia el tono con orden del autor); ningún modelo generativo
redacta contenido clínico; no se guardan preguntas; no reentrenar ni reabrir 2025 ni cambiar criterios; la batería ciega
*test* se abre una sola vez, al final.

## Fase 1 — inmediata, sin decisión del autor

| # | Acción | Dónde | Aceptación |
|---|---|---|---|
| 1.1 | **Primera línea = la pregunta.** Ranuras para validación, sMAPE/error, pico y «no modelado»: «No: es el control estacional…», «sMAPE fuera de muestra: 1.9 % en 2 semanas», «No hay pico esperado: no se pronostica». «Sí»/«No» sólo si preguntaron «¿sube?/¿baja?» y nunca con control o confiabilidad baja | `resumen_llano.js:241`, `obesidad_kb.js` (patrón `confianza`), `radar_boletin.js` | Pruebas de primera oración en las 36 preguntas: ≥ 95 % contienen lo pedido; cero «Sí.» ante dónde/cuánto/pico/validada |
| 1.2 | **Dengue por estados y por periodo.** «Qué estados… próximo mes» → ranking estatal a 4 semanas con su corte; quitar «por eso el modelo usa esa señal del clima» y la geografía fija de `nota_mexico` | `kb.js:1711-1722`, `build_web_knowledge.py` (backend) | La pregunta no contiene «52 semanas»; nombra Sinaloa, Tabasco y Sonora con sus casos; `cifras:verify` |
| 1.3 | **«Qué va al alza» honesto.** Controles fuera de «se espera que suba» (bloque aparte «Sin modelo validado: repiten el año pasado»); un aceptado cuyo desvío medido ≥ cambio previsto pasa a «señal dudosa» aun con 1 semana; corte por grupo («114 hasta la semana 43, 22 hasta la 44»); cada renglón con su comprobación. **La gráfica del PR #146 se rehace como pequeños múltiplos** (12 semanas observadas + 4 pronosticadas, eje propio desde cero, controles en gris) | `conversacion.js:138`, `app.js` (`graficaAlza`) | Con los datos de hoy, ni leptospirosis ni hepatitis A en «al alza»; captura a 1280 y 375 px; tabla equivalente |
| 1.4 | **Calendario interanual por semana epidemiológica**, no por 364 días | `resumen_llano.js:38` (`indicadores`), `calendario_boletin.js` | Puebla +9 %, obesidad +24 %; el control conserva su rezago de 52 al cruzar W53 |
| 1.5 | **Validación coherente.** Resumen y detalle con el mismo par «semanas observadas / prospectivas»; degradar la confiabilidad con 1 semana si el desvío medido supera el cambio previsto; «alta» con sesgo > 10 % lo dice | `resumen_llano.js:66, :104`, `obesidad_kb.js` | Asma igual en las 3 respuestas; hepatitis A no dice «media» sin la salvedad; obesidad sin «acertó» |
| 1.6 | **Consejo médico y viaje con ruta fija**, antes de las rutas de datos: medicamentos, dosis, vacunas, letalidad, embarazo y viaje → «no doy consejo médico ni digo si es seguro», unidad de salud o 911, fuente oficial y oferta de cifras; sin Línea de la Vida salvo crisis | `kb.js` (`PREGUNTA_CLINICA`), `conversacion.js:777` (`answerViaje`) | Batería nueva de 40: 0 consejos, 0 volcados de cifras en el veredicto, 0 «No entendí» |
| 1.7 | **Crisis sin red.** La guarda corre antes de esperar datos también en el núcleo | `kb.js` (`_resolve`) | Con `fetch` bloqueado, «me quiero morir» responde la línea fija |
| 1.8 | **Medir bien.** El calificador exige la cifra y el periodo pedidos y no premia respuestas vacías; separar respuesta local, derivación y final | `eval/califica.mjs` | Re-calificar `main` con la rúbrica corregida y publicar la línea base nueva antes de comparar |

## Fase 2 — conversación, gráficas y accesibilidad

| # | Acción | Dónde | Aceptación |
|---|---|---|---|
| 2.1 | **«Dónde sube más rápido»** → ranking de los 32 estados por cambio (O4 → F4) con piso de casos, separado del ranking por volumen | `calculo/operaciones.js` (`compararRitmo`), `obesidad_kb.js` | Hepatitis A: CDMX encabeza el cambio relativo; Guanajuato (1 → 23) queda fuera por base pequeña |
| 2.2 | **Texto y gráfica con la misma ventana y orden** (ranking, mapa, sexo); marcador de gráfica también en los cuatro originales y en sus comparaciones; preguntas de error → zoom de seguimiento | `obesidad_charts.js`, `conversacion.js` (`answerLegacyLlano`), `app.js` | Prueba automática texto↔gráfica: 100 % en entidad, sexo, ventana y orden; cobertura de gráfica pertinente ≥ 95 % según la tabla de Opus |
| 2.3 | **Un solo formato de semana**: «semana 43 (25 al 31 de octubre)» en texto, eje y tabla; ISO sólo en el plegado | `calculo/series.js` (`semanaTxt`) | Cero «Semana del 20xx-» fuera del plegado |
| 2.4 | **Largo y jerarquía**: parte llana ≤ 3 viñetas y ~120 palabras; un solo pie; desvíos > 300 % dichos en casos («esperaba 68 y llegaron 2»); en el radar la cifra antes del motivo | `resumen_llano.js`, `radar_boletin.js` | Mediana ≤ 120 palabras, p90 ≤ 160 |
| 2.5 | **Clínica sin modelo generativo**: contagio, prevención y signos de alarma desde fichas curadas con enlace oficial; el RAG y DeepSeek remiten a la ficha | `definiciones.js`, `rag.mjs` | 30 preguntas clínicas respondidas en local; 0 enviadas al modelo |
| 2.6 | **Seguimientos y aclaraciones deterministas**: conservar estado y sexo en las aclaraciones; comparación multi-turno («¿y en Monterrey?» tras un ranking); botones para ambigüedades (hepatitis sin tipo, mes frente a 52 semanas) | `kb.js` (`_estadosPrevios`, `answerAliasAmbiguo`) | Batería de seguimientos nueva; ninguna ambigüedad resuelta sin preguntar |
| 2.7 | **Voz y accesibilidad**: la voz dice la cifra y el padecimiento, limpia `_cursiva_`, avisa que hay tabla y nunca omite el 911 en síntomas; enlaces legibles al visitar; objetivos táctiles de 44 px; tooltips acotados; comparador apilado a 375 px; timelapse en tema claro y con teclado | `voice.js`, `shell.css`, `style.css`, `timelapse.js`, `mexico-map.js` | 36 respuestas habladas con cifra; auditoría WCAG 2.2 AA de los widgets |

## Fase 3 — consolidación

| # | Acción | Aceptación |
|---|---|---|
| 3.1 | Reducir duplicación de `kb.js` (detección de entidades por turno, rutas caracterizadas) **después** de fijar el comportamiento con pruebas | Comparación pareada de respuestas sin cambios |
| 3.2 | Corrector ortográfico único y batería coloquial ampliada (erratas, jerga, aclaraciones), sin autocorrección agresiva de palabras cortas | `coloquial.json` ≥ 100 casos; cero deformaciones tipo «cólera → Colima» |
| 3.3 | Radar con gráfica sólo observada (sin pronóstico exploratorio) para influenza, COVID y febril exantemática | Leyenda «casos impresos en el boletín, sin modelo» |
| 3.4 | Cierres por perfil sobre los mismos hechos: «en corto», «para nota», «para junta» | Sin cifras nuevas; «para nota» con fecha, fuente y qué no dice |
| 3.5 | Revisión humana: clínico para los textos fijos (síntomas, signos de alarma, consejo médico) y lectores de salud y comunicación para la batería S; abrir *test* una sola vez | Acta firmada; medición final única |

## Decide el autor

1. **Tono de la crisis en tercera persona** («ideación suicida en Jalisco», «suicidio en México»): variante neutra sin «lo que me contaste», con la misma Línea de la Vida y sin cifras (Fable 7, Grok 9).
2. **Primera persona con padecimiento de salud mental** («tengo depresión»): apoyo suave antes que cifras (Fable 6).
3. **ENSO en dengue**: confirmar si el motor publicado usa El Niño; si no, se retira toda mención (1.2).
4. **Mes calendario**: qué semanas cuentan como «diciembre» (las que empiezan en el mes, propuesta de Sol).
5. **Pequeños múltiplos** como gráfica de «qué va al alza» (1.3) y de los controles en bloque propio.
6. **Quién valida las fichas clínicas** curadas (2.5) y la revisión clínica (3.5).
7. **«Para nota»**: si se publica o queda como copia para el usuario (3.4).

## Métricas canónicas

| Métrica | Hoy | Meta |
|---|---|---|
| `npm test` | 2,140 en verde | siempre en verde |
| `eval:etiquetas` (rúbrica corregida en 1.8) | 611/813 = 75.2 % (rúbrica actual) | ≥ 80 % con la rúbrica nueva, sin perder casos |
| Primera oración contiene lo pedido | sin medir | ≥ 95 % |
| Controles como expectativa firme / «Sí» con confiabilidad baja | presentes | 0 |
| Consejo médico o volcado de cifras ante tratamiento | presentes | 0 en 40 + 80 casos |
| Crisis | 100 % | 100 %, también sin red; 0 falsos negativos en 50 paráfrasis |
| Coherencia texto–gráfica | sin medir | 100 % |
| Comparaciones interanuales desalineadas | todas | 0 |
| Largo de la parte llana | ~180 palabras | mediana ≤ 120 |
| Batería ciega *test* | cerrada | se abre una vez, al final |

## Lo que no se hace

Relajar el detector de crisis; dejar que un modelo generativo redacte contenido clínico; intervalos, semáforos de riesgo o
«probabilidad de brote»; tasas por población dentro del bot; recomendaciones de viaje, vacunación o dosis; ocultar los
controles (se rotulan y se separan); activar el planificador como remedio; un diccionario masivo de jerga o autocorrección
difusa; abrir *test* durante el ajuste; gráfica en crisis, síntomas, definiciones o fuera de alcance.

## Orden de ejecución sugerido

F1 en tres entregas: (a) 1.7 y 1.8, que dan la línea base honesta; (b) 1.1, 1.2, 1.4 y 1.6, que cambian lo que se contesta;
(c) 1.3 y 1.5, que cambian cómo se presenta la confiabilidad (1.3 necesita la decisión 5). Cada entrega con `npm test`,
`eval:etiquetas` pareado contra `main` y capturas a 1280 y 375 px cuando cambie lo visible.
