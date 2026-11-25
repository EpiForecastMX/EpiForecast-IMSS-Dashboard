# Plan: EpiBot agéntico (mesa de expertos, 25-nov-2026)

Orden del autor: «haz un plan con todos los expertos para volver el EpiBot agéntico y que sea súper inteligente».
Mesa completa de ocho asientos, en paralelo y en solo lectura sobre el Dashboard `main` `683851b0`; ninguno falló.
Encargo: `ENCARGO.md`. Dictámenes íntegros: `dictamenes/`.

| Asiento | Perfil |
|---|---|
| Codex `gpt-6.2-sol` | Arquitectura agéntica, orquestación, Netlify |
| Codex `gpt-6.2-astra` | Seguridad y red team |
| Grok | Producto y diseño conversacional, celular y voz |
| Fable 5.2 | Epidemiología y estadística |
| Opus 5.5 | Evaluación |
| Gemini Neon (Antigravity) | Infraestructura, costo y proveedor |
| Gemini Hydrogen (Antigravity) | Accesibilidad, lenguaje llano y visualización |
| DeepSeek `deepseek-v4-pro` | Ingeniería de LLM y recuperación |

## Veredicto de la mesa

**Agéntico sí, pero acotado: un planificador que elige herramientas, una calculadora determinista que hace las cuentas y
plantillas que redactan.** Ningún asiento recomienda un agente autónomo. La inteligencia que falta no es de lenguaje: es
componer consultas («compara dengue en Veracruz y Yucatán y dime cuál sube más rápido»), calcular cosas nuevas sobre las
vistas, explicar gráficas, sostener el hilo y **saber decir con claridad qué pregunta no tiene respuesta con estos datos**
(Fable).

### Acuerdos unánimes (8 de 8)

1. **Crisis, sensibles y lista blanca corren antes de cualquier modelo**, sobre el texto crudo. Con señal de crisis no se
   llama al planificador ni al proveedor, no hay gráficas ni cifras.
2. **El modelo nunca escribe números.** Toda cifra sale de una herramienta y un verificador final rechaza cualquier dígito
   sin procedencia.
3. **Herramientas tipadas de lista cerrada** sobre `vista.json`, el radar, `resumen_padecimientos.json` y `knowledge.json`:
   reciben identificadores, nunca texto libre, URL, rutas ni expresiones.
4. **Plan acotado**: de 3 a 6 pasos, un solo replaneo, plazo global; al agotarse, respuesta determinista o una pregunta de
   precisión.
5. **El carril rápido actual se queda** para las preguntas simples (resuelve 60 a 75 % del tráfico en ~15 ms, sin costo).
   El agente entra sólo con consultas compuestas o no reconocidas.
6. **Memoria estructurada** (padecimiento, lugar, sexo, periodo, métrica, últimos resultados), no la transcripción.
7. **No hacer**: bucle ReAct abierto, LangChain o LangGraph, intérprete de código, consultas libres sobre los datos,
   modelo de visión para leer gráficas, memoria personal persistente, reentrenar o reabrir 2025 desde el bot.

### Desacuerdos y cómo se resuelven

| Tema | Posiciones | Resolución propuesta |
|---|---|---|
| ¿Redacta el modelo? | Fable, Opus, Grok y Codex: plantillas o marcadores `{{c:ID}}`. Neon, Hydrogen y DeepSeek: síntesis libre con verificador posterior. | Plantillas por defecto. Redacción con marcadores sólo si las plantillas se quedan cortas en la evaluación (Fable: «verificar es más frágil que no exponer»). |
| ¿Dónde corren las herramientas? | Grok: en el cliente, sobre las vistas que ya baja. Codex, Neon y DeepSeek: en una función `agent.mjs`. | Módulos puros e isomorfos (`epibot/js/calculo/`) que sirven en ambos lados; el planificador, que necesita la clave, en la función. |
| ¿Qué va primero? | Opus: el instrumento de medida. Fable, DeepSeek y Codex: la calculadora. Grok y Hydrogen: la experiencia en celular y voz. | Fase 0 mide y corrige; la fase 1 es la calculadora. La experiencia en celular va en paralelo porque no depende de nada. |

## Hallazgos que ya son defectos (verificar y corregir aunque no se haga el agente)

- **El cliente acepta un stream cortado como respuesta completa**: `app.js` no exige el evento `done` (Codex sol).
- **`rag.mjs` transmite texto generado antes de verificarlo**, envía hasta seis turnos de historial al proveedor y registra
  hasta 120 caracteres de la consulta (Codex astra).
- **El «402 Payment Required» no se clasifica**: se gasta un segundo intento con el otro modelo antes de un error genérico
  (Neon). `leerVista` vuelve a parsear ~500 KB por invocación y el paquete de la función ronda 90 MB.
- **Voz en iPhone**: la síntesis se pide fuera del gesto del usuario y suele quedar muda; el `textarea` hereda 14 px y
  provoca el zoom de iOS; el micrófono no interrumpe la lectura (Grok, sin comprobar en aparato).
- **Mapa y gráficas inaccesibles**: los estados del mapa sólo responden al cursor, sin foco ni etiqueta; los `canvas` no
  tienen texto equivalente; la voz borra las tablas y corta a 600 caracteres (Hydrogen).
- **La evaluación actual no mide aciertos**: «limpia» cuenta como buena una respuesta con el padecimiento o el estado
  equivocado; las 813 preguntas curadas traen etiquetas que ninguna prueba califica; las baterías «ciegas» ya no lo son
  porque se ajustó contra ellas (Opus).

## Límites de los datos (Fable, medido sobre las 148 vistas)

Ninguna vista trae intervalos; 147 están `INCOMPLETE` y 1 `PASS` (59 con 0 semanas comprobadas); 97 son controles; 49 % de
las 15,614 series suman menos de 52 casos al año; 125 vistas cortan en W43 y 23 en W44; no hay población (sólo conteos);
las últimas semanas son preliminares; los cuatro originales no tienen `vista.json`.

**Cálculos legítimos**: sumas y medias por ventana, razón interanual con banda de ruido de Poisson, acumulado, semana del
pico, perfil estacional, participación de un estado en el total, razón hombre/mujer de conteos, error ya publicado.

**Negativas razonadas** (respuesta de primera clase, con su motivo): tasas o riesgo, significancia o intervalos, más allá de
52 semanas, sumar padecimientos, pronóstico por sexo derivado por resta, correlación o causalidad, «el modelo acertó» con
menos de 4 semanas comprobadas, porcentajes con base menor a 10 casos, «brote» o alerta, comparar un control con un
portafolio o cortes distintos como si fueran equivalentes.

## Arquitectura

```
turno ─► guardas (crisis, sensibles, lista blanca) ─► carril rápido actual (kb.js, resumen_llano.js)
                                                   └► consulta compuesta o no reconocida
                                                        ─► planificador (JSON, ≤ 4 pasos, ids de lista cerrada)
                                                        ─► ejecutor determinista (herramientas en paralelo, traza)
                                                        ─► legitimidad (Hecho o Negativa)
                                                        ─► plantillas + verificador de procedencia
                                                        ─► texto, gráfica, tabla y frase hablada del mismo resultado
```

- `epibot/js/calculo/`: biblioteca pura e isomorfa; cada salida es un `Hecho` `{valor, unidad, serie, ventana, corte,
  tipo: observado|pronostico|control, advertencias[], formula, procedencia}`.
- `epibot/js/calculo/legitimidad.js`: decide antes de calcular si la operación procede.
- `epibot/js/redaccion/plantillas.js`: redacta desde `Hecho[]`; el control cambia el verbo («se repite lo del año
  anterior»), los datos preliminares y la falta de intervalos se anexan solos.
- `epibot/netlify/lib/agente/plan.mjs` (extiende `nlu.mjs`), `ejecuta.mjs`, `procedencia.mjs`;
  `netlify/functions/agent.mjs` con NDJSON `progress → result → done` (sólo progreso fijo antes del resultado).
- `epibot/netlify/lib/llm_provider.mjs`: adaptador único (Gemini REST, protocolo compatible con OpenAI, Ollama local) con
  interruptor de circuito ante 401, 402, 429 y 5xx, y `EPI_AGENT_MODE=full|degraded|off`.
- Memoria: ficha de conversación visible y editable (`ficha_turno.js`), estado firmado y de vida corta en el servidor.

### Herramientas (consolidadas de las ocho propuestas)

| Herramienta | Entrada | Salida | Fuente |
|---|---|---|---|
| `resolver` | mención, ámbito | id publicado, opciones para aclarar o ausencia; nunca sensibles sin lista blanca | `catalog.json`, `release_catalog.js`, radar |
| `serie` | id, lugar, sexo, tramo, ventana | serie observada o pronosticada con unidad, corte y procedencia | `vista.json`; adaptador para los 4 originales |
| `observado_ventana` | serie, 4/13/26/52 semanas o año | suma, media, n, bandera de preliminar | `vista.json` |
| `comparar_interanual` | serie, ventana | razón contra el año previo con banda de ruido | `vista.json` |
| `pronostico_ventana` | serie, ventana futura | suma puntual, «sin intervalo», tipo | `vista.json` |
| `comparar` | 2 a 4 series, métrica cerrada | tabla, veredicto, regla de empate o motivo de abstención | resultados del turno |
| `pico` y `estacionalidad` | serie | semana del pico; perfil por semana y n de años | `vista.json` |
| `ranking` | ámbito, métrica, piso de casos | lista con excluidos contados y cortes declarados | `resumen_padecimientos.json`, vistas |
| `calidad` | id | control o modelo, veredicto, semanas comprobadas, avisos | vista, avisos de fuente |
| `radar` | categoría, lugar | cifra impresa, marcador, conciliación | `assets/boletin/<semana>/data.json` |
| `explicar_grafica` | referencia a la gráfica mostrada | ejes, corte observado/pronóstico, pico, dirección, qué no muestra | la especificación ya dibujada |
| `definir` y `metodo` | id no sensible | definición; pasajes citados de la metodología | `definiciones.js`, `rag_index.json` (BM25) |
| `aclarar` | el dato que falta | una pregunta y hasta cuatro botones | catálogo |

## Fases

**Fase 0. Medir y corregir (local, sin proveedor, antes del 1-dic).**
Instrumento de Opus: calificar las etiquetas que ya existen, `eval/oraculo.mjs` que recalcula cada cifra desde las
vistas, `eval/procedencia.mjs`, y **medir al bot actual** con ellos (saldrán sus errores reales). Sellar la batería S
(600 preguntas nuevas de otras familias de modelos y de dos personas; *dev* 200, *test* 400 que se abre una sola vez).
Corregir los defectos de arriba: `done` obligatorio, 402 clasificado, registros sin texto crudo, caché de vistas.

**Fase 1. La calculadora (el mayor salto, sin modelo).**
`js/calculo/`, `legitimidad.js`, `Hecho`, plantillas compuestas, adaptador de los cuatro originales, `explicar_grafica`.
Desde el árbol actual ya responde «compara dengue en Veracruz y Yucatán», «¿cuándo es el pico?», «¿es mucho para esta
época?» y las negativas razonadas. Batería de 150 trampas de sobreafirmación.

**Fase 2. Experiencia en celular, voz y accesibilidad (en paralelo).**
Ficha de conversación visible y editable con botones que salen de ella; frase hablada de ~25 palabras y descargo una vez
por sesión; voz que funciona en iPhone (desbloqueo en el gesto, interrupción, confirmación si duda, manos libres
apagado); mapa con foco y etiquetas, tabla equivalente para cada gráfica, tablas en tarjetas a 360 px, `textarea` a 16 px;
motores y sMAPE fuera del camino por defecto («Para especialistas»).

**Fase 3. Planificador detrás de una bandera.**
Plan JSON validado sólo para consultas compuestas o no reconocidas; primero con Ollama local y respuestas simuladas;
adaptador de proveedor, presupuesto por turno (2 llamadas, 4 herramientas, 8 s) y por conversación, caché semanal por corte
de boletín. Sin proveedor responde la ruta determinista sin error visible.

**Fase 4. Redacción con marcadores (opcional).** Sólo si la fase 1 demuestra que las plantillas se quedan cortas.

**Fase 5. Despliegue (desde el 1-dic y con proveedor decidido).** Abrir una sola vez S-*test*, revisión humana de 100
pares, informe pareado bot frente a agente, despliegue en sombra, canario y reversión por configuración; comprobar la
versión servida.

## Umbrales para desplegar (todos a la vez)

- **Tolerancia cero**: crisis no detectadas, números sin procedencia, controles presentados como validados, intervalos
  inventados, ids sensibles fuera de la lista blanca, emojis. Las baterías de crisis y adversarias corren tres veces y deben
  pasar las tres.
- **Que no empeore**: las 2,094 pruebas actuales en verde; preguntas simples sin pérdida mayor a 2 puntos (McNemar
  pareada); falsas crisis no mayores que hoy.
- **Que sea mejor**: compuestas resueltas ≥ 85 % absoluto y ≥ 20 puntos sobre el bot actual; estado de la conversación
  correcto en ≥ 90 % de los turnos largos; preferencia humana ≥ 60 %.
- **Operación**: p95 ≤ 1 s en el carril rápido y ≤ 6 s en el agéntico; caída al bot actual con el proveedor apagado o en
  402; costo por conversación dentro del tope del autor.
- Los jueces de lenguaje sólo califican claridad, nunca exactitud, y sólo si calibran contra personas (κ ≥ 0.6); el juez de
  8B no sirve.

## Decisiones que son del autor

1. **Proveedor y presupuesto del modelo**: regularizar Gemini (402 del 25-nov, sin verificar si afecta a la clave de
   producción) u otro proveedor; tope mensual. Las fases 0 a 2 no lo necesitan.
2. **¿El modelo redacta alguna vez prosa?** La mesa recomienda que no en la primera versión.
3. **Petición al backend** (Fable): población por entidad e intervalos empíricos en `vista.json`. Sin eso, tasas e
   incertidumbre siguen vedadas. Toca artefactos del backend y requiere su autorización.
4. **Conversaciones reales para la fase sombra**: sólo anonimizadas y sin turnos de crisis, o se queda en reproducción
   local de baterías.
5. **Dos personas** (salud y periodismo) para escribir parte de la batería sellada y la revisión humana.
