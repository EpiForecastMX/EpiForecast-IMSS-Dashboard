/**
 * Lista curada de palabras de consulta neutras del EpiBot y de la función RAG (quinta auditoría Codex, 19-nov-2026; criterio
 * gramatical cerrado en la novena, `codex/REAUDITORIA8_FE.md`). VERSIONADA A MANO y revisable: no la genera ningún script.
 *
 * CRITERIO DE ADMISIÓN DE `palabras` (una palabra suelta): sólo sustantivos técnicos o de datos del proyecto, preposiciones,
 * artículos, conjunciones, interrogativos, cortesía sin verbo, nombres públicos del equipo, meses, variantes ortográficas de
 * esos términos y verbos impersonales o en tercera persona sin sujeto personal («afecta», «pronostican», «se esperan»). Una
 * forma cuya lectura en tercera persona es idéntica (imperfecto o condicional: «iba», «podría»; pretérito sin tilde:
 * «entrenó», «llegó», «construyó») se admite sólo por esa lectura; una forma ambigua entre demostrativo y verbo de 1.ª o
 * 2.ª persona («estas/estás», «este/esté») no entra (duodécima auditoría).
 * NUNCA entra como palabra suelta una forma verbal conjugada en primera o segunda persona, singular o plural (puedo, puedes,
 * tienes, sabes, quieres, siento, aguanto, soporto, estamos, dame, dime, muéstrame…), ni pronombres personales, posesivos o
 * reflexivos, parentesco o relaciones (yo, me, mi, te, tú, su, familiar, pareja, hijo…), verbos de deseo o necesidad (quiero,
 * necesito…), causativos o de acción sobre personas (causa, hace, da, pega, quema…), palabras de riesgo (métodos, sustancias,
 * autolesión, violencia, ingestión), edades, cantidades ni estados de ánimo: «vivo», «tomo», «tabletas», «sedantes»,
 * «golpes», «pills» o «poison» sólo cuentan dentro de un alias completo.
 * Las únicas formas de primera o segunda persona que se retiran están en `frases` (décima auditoría): una petición al bot
 * seguida INMEDIATAMENTE, con artículos o preposiciones opcionales, de un sustantivo de datos de la lista cerrada
 * `OBJETO_DATOS` («dame los casos de», «quiero ver la gráfica de», «give me the data»), o una pregunta con interrogativo
 * cuyo objeto es ese sustantivo («¿qué modelos usas?»), o una petición de conocimiento («dime», «qué sabes», «háblame»,
 * «cuéntame», «tell me») seguida de «sobre/de/del/acerca de» y del fragmento COMPLETO de un padecimiento no sensible y sin
 * término de lesión o daño (lo comprueba `analizaTurno` en js/release_catalog.js). El resto del turno sigue sometido a esta lista; cualquier verbo de
 * petición o de segunda persona (`VERBOS_PETICION`) impide retirar la edad y, con un id sensible, da la crisis.
 * Los padecimientos, códigos y estados NO van aquí: los reconoce como fragmentos completos `js/vocab_cerrado.js`.
 * Los números sólo valen como año (2014-2027) o dentro de una frase técnica de abajo; cualquier otro número (edades,
 * cantidades) queda fuera de vocabulario.
 */
// Edad en forma POBLACIONAL en tercera persona («mujeres de 30 años», «entre 40 y 45 años», «menores de 18», «de 15 a 19 años»).
// No se aplican si el turno trae primera o segunda persona o un familiar («tengo», «soy», «tienes», «mi hijo tiene»): el número queda fuera.
const EDAD_POBLACION = /\b(mujeres|hombres|personas|pacientes|adultos|jovenes|ninos|ninas|mayores|menores) de \d{1,2}( (a|y) \d{1,2})? anos( de edad)?\b/g;
const EDAD_RANGO = /\bentre \d{1,2} y \d{1,2} anos\b/g;
const EDAD_UMBRAL = /\b(mayores|menores) de \d{1,2}( anos)?\b/g;
const EDAD_DE_A = /\bde \d{1,2} a \d{1,2} anos\b/g;
// Undécima auditoría (`codex/REAUDITORIA10_FE.md`): FUENTE ÚNICA de los verbos de la lista curada. Todos son verbos de
// petición (VERBOS_PETICION se genera de aquí): sólo valen anclados (sustantivo de datos inmediato, «sobre/de/del» + un
// padecimiento no sensible, o una pregunta con interrogativo), impiden retirar la edad, nunca levantan la crisis y con
// ellos un fragmento de daño sólo vale inmediatamente tras un sustantivo de datos. Los participios usados como adjetivo
// («validado», «pronosticado», «publicado») no se cuentan como verbos.
const VERBOS_CURADOS = Object.freeze(`
  afecta llegaron pinta sigue consultar podria saber conocer informar mostrar decir compara comparan comparar comporta
  configuro contrasta crearon decia describe dicen dirige entreno es esperaba esperan esta estiman explica filtra
  funciona ha haber habra habria hay hubiera hubo iba iban llama llega llegan llego modelan muestra participo pasa
  pronostican puede selecciona ser significa son tiene tienen trabaja usa usan va van ver viene gana ganara reporto
  construyo influyen fallaron excluyo seleccionaron ocurrio modela evaluaron trata fue suma predice equivale queda
  publica quedo tuvieron cura descubrio diagnosticaron identifico prevenir viajar cuesta are is follow
`.split(/\s+/).filter(Boolean));
// Décima auditoría: peticiones al bot. Sólo se retiran ancladas a un sustantivo de datos de esta lista cerrada.
const OBJETO_DATOS = '(?:casos|caso|cifras|cifra|datos|dato|numero|numeros|pronostico|pronosticos|tendencia|tendencias|tasa|tasas|' +
  'estadisticas|estadistica|informacion|serie|series|grafica|graficas|grafico|graficos|modelos|modelo|' +
  // Undécima instrucción: métricas, resultados y motores también son sustantivos de datos.
  'metricas|metrica|resultados|resultado|motores|motor|' +
  'cases|data|numbers|forecast|forecasts|figures|stats|statistics)';
const ENLACE = '(?: (?:los|las|el|la|un|una|unos|unas|de|del|sobre|con|contra|me|mas|tus|sus|the|some|any|your|more|of))*';
// Verbos de petición o de segunda persona: también impiden retirar la edad aunque la petición sea válida.
const VERBOS_PETICION = ['quiero', 'quisiera', 'queremos', 'necesito', 'necesitamos', 'deseo', 'gustaria', 'dame', 'dime',
  'muestrame', 'ensename', 'comparalo', 'sorprendeme', 'podrias', 'puedes', 'sabes', 'usas', 'sacas', 'tienes', 'esperas',
  'generas', 'pronosticas', 'funcionas', 'hablame', 'cuentame', 'platicame', 'give', 'show', 'tell', 'can', 'could', 'you', 'do',
  ...VERBOS_CURADOS];
const PETICION_DESEO = new RegExp(`\\b(quiero|quisiera|queremos|necesito|necesitamos|deseo|me gustaria)( (ver|consultar|saber|conocer|revisar|comparar))?${ENLACE} ${OBJETO_DATOS}\\b`, 'g');
const PETICION_IMPERATIVO = new RegExp(`\\b(dame|dime|muestrame|ensename|comparalo|sorprendeme)${ENLACE} ${OBJETO_DATOS}\\b`, 'g');
const PETICION_CORTES = new RegExp(`\\b(podrias|puedes) (mostrar|mostrarme|decir|decirme|dar|darme|explicar|explicarme|ensenar|ensenarme|informar|consultar|comparar)${ENLACE} ${OBJETO_DATOS}\\b`, 'g');
const PETICION_PREGUNTA_OBJETO = new RegExp(`\\b(que|como|cuantos|cuantas|cuanto|donde|cual|cuales) ${OBJETO_DATOS} (sabes|usas|sacas|tienes|esperas|generas|pronosticas)\\b`, 'g');
const PETICION_PREGUNTA_VERBO = new RegExp(`\\b(que|como|cuantos|cuantas|cuanto|donde|cual|cuales) (sabes|usas|sacas|tienes|esperas|generas|pronosticas)${ENLACE} ${OBJETO_DATOS}\\b`, 'g');
const PETICION_INGLES = new RegExp(`\\b((can|could) you )?((give|show|tell) me|show|give|do you have)${ENLACE} ${OBJETO_DATOS}\\b`, 'g');
const PETICION_INGLES_PREGUNTA = new RegExp(`\\b(what|which|how many|how much) ${OBJETO_DATOS} do you (have|use|show)\\b`, 'g');
globalThis.EPI_VOCAB_CONSULTA = Object.freeze({
  frasesEdad: [EDAD_POBLACION, EDAD_RANGO, EDAD_UMBRAL, EDAD_DE_A],
  verbosPeticion: Object.freeze(VERBOS_PETICION),
  peticiones: Object.freeze([PETICION_DESEO, PETICION_IMPERATIVO, PETICION_CORTES, PETICION_PREGUNTA_OBJETO, PETICION_PREGUNTA_VERBO, PETICION_INGLES, PETICION_INGLES_PREGUNTA]),
  palabras: new Set([...VERBOS_CURADOS, ...`
    // Interrogativos, artículos, preposiciones, conectores, cortesía y verbos de consulta neutros.
    a ahora al algo el e otro uno siguiente nuevos cifras cifra
    numeros porfa porfavor basado base buenas buenos cada como comparacion
    comparativa con contra crecido cual cuales cuando
    cuantas cuanto cuantos de del desarrollado desde dia dias dicho
    disminuido donde en entre esa ese
    favor gracias habido
    hasta hey hola hoy la las
    los mas menos nada no noches o onda para pero por
    pronosticado pronosticados que quien quienes
    saludos segun si sido sobre solamente solo tal tambien
    tan tardes un una versus vs y
    // Términos de datos epidemiológicos y de la respuesta.
    actual actuales tendencias tasa tasas prevalencia comportamiento variacion estimacion proyeccion mensual series
    violin histograma mae reciente
    acierto alcance aleatorio alto ano anos boletin brecha caso casos cobertura completo composicion corte dato
    datos demografica demografico desglose diferencia disponible distribucion efectos entidad entidades
    epidemiologica estadisticas estado estados evolucion fecha femenino forecast fuente futuro ganador
    ganadores general genero grafica grafico historica historico historicos hombres horizonte incidencia
    informacion interesante masculino mayor mejor mejores menor mes meses mujeres nacional nivel numero padecimiento
    padecimientos periodo precision preciso prediccion promedio pronostico pronosticos proporcion proximas proximos
    ranking real realidad recientes regional reporte resumen semana semanal semanas series sexo sintomas
    tabla temporal tendencia top total ultima ultimas ultimo ultimos visualizacion
    // Términos técnicos del proyecto, sus métricas, motores e infraestructura.
    zoom mapa acumulado calibracion semaforo corredor radar avisos aviso validada validado confiable seguimiento curso
    ok excepto desempeno error volumen panorama kpis tablero dashboard meta modo control construccion
    // Preguntas de método sobre un release o el estudio MICAI que ya responden las pruebas de la función RAG.
    efecto valores imputados reparto calidad candidatos ets ridge
    estacionales mismo rondas comparativo picos autores ponencia wcp micai
    cita textual estudio afiliaciones independientes asignacion archivada ingenuo revision optima frente
    treemap letalidad vacuna about pdf galeria peores graficos graficas area apilada sparklines timelapse heatmap
    estacional ooad ventana naive up
    futuras previas utilidad
    analisis ar archivos articulo aws cd ci codigo commits configuracion cross deep deepar diagnostico diagnosticos
    ensemble entrenamiento epiforecast equipo fallback folds globales google infraestructura integrantes leakage
    lightgbm lineas mase metricas mlops modelo modelos motor motores nombre overfitting paper parametros pipeline
    problemas produccion prophet proyecto publicacion publicado referencia rendimiento resultados rmse sagemaker
    smape stacking tecnologia test tests validacion validation xgboost
    // Nombres públicos del equipo.
    carlos desarrollo dra gerardo jar jarcos jars javi javier jerry juan luis nava perez rebull ruth trabajo
    // Meses.
    abril agosto diciembre enero febrero julio junio marzo mayo noviembre octubre septiembre
    // Variantes ortográficas de términos técnicos que ya usan los casos funcionales.
    alzeimer alzheimr chiuahua depresoin depreson glovales jalsico parkinsn parkison pronositco puebal tendncia
    veracurz
    // Términos clínicos y de población que usan las guardas de alcance (subtipos y vecinos no modelados) y sus pruebas.
    embarazadas ciclistas cardiopatias pulmonary portal intracraneal inducida durante demencia perinatal vejiga
    lombrices women men pregnant newborns infants babies c obesdiad fetal tiroides infantil bebes recien nacidos ninos
    adultos mayores menores pacientes herpes zoster gestantes insulinodependiente treponema pallidum treponematosis
    mortinato syphilitic stillbirth rare materna lactantes clamidia ojo rojo infection endemica nonvenereal anogenitales
    insulina hipertensos
    // Preguntas de divulgación de los casos funcionales: personajes públicos, historia del padecimiento y comparación mundial.
    alguien ali artistas celebridades famoso famosos historia indices
    mohamed mundial mundo origen pais paises pakistan personajes robin rocky tratamiento unidos williams
    // Palabras de consultas fuera de tema de los casos funcionales (lugares y objetos; la respuesta las declina).
    atlantida california fantasma irapuato mordor narnia tesla texas
    // Inglés de consulta neutro.
    and cases data for forecast how in many of state the trend week weeks what year
`.split('\n').filter((l) => !l.trim().startsWith('//')).join(' ').split(/\s+/).filter(Boolean)]),
  verbosCurados: VERBOS_CURADOS,
  frases: [
    // Décima auditoría (`codex/REAUDITORIA9_FE.md`): toda petición al bot (deseo, imperativo, cortesía, segunda persona o su
    // equivalente inglés) sólo se retira si va seguida INMEDIATAMENTE, con artículos o preposiciones opcionales, de un
    // sustantivo de datos de la lista cerrada OBJETO_DATOS («dame los casos de», «quiero ver la gráfica de», «¿podrías mostrar
    // las estadísticas…?», «give me the data», «do you have cases»), o si es una pregunta con interrogativo cuyo objeto es ese
    // sustantivo («¿qué modelos usas?», «what data do you have»). «dame una herida…», «give me intoxicación…», «podrías dar
    // asfixia» o «qué sabes» quedan fuera de vocabulario.
    PETICION_DESEO,
    PETICION_IMPERATIVO,
    PETICION_CORTES,
    PETICION_PREGUNTA_OBJETO,
    PETICION_PREGUNTA_VERBO,
    PETICION_INGLES,
    PETICION_INGLES_PREGUNTA,
    // Construcciones impersonales con «se» (no reflexivas sobre una persona): «se esperan», «se pronostican», «se llama».
    /\bse (esperan?|esperaba|pronostic[a-z]*|estiman?|llama|entreno|comporta|selecciona[a-z]*|compara[a-z]*|modelan?|configuro|cura|trata|identifico|puede|sabe|reporta[a-z]*|notifica[a-z]*|registra[a-z]*|presentan?|obtiene|calcula|genera|usa|utiliza|construyo|eligi[a-z]*|valida[a-z]*|guardan|cubren|seleccionaron|excluyo|evaluaron|basa|define|mide|actualiza)\b/g,
    // «lo» como artículo neutro («lo que llegó», «lo pronosticado»), no como pronombre de persona.
    /\blo (que|pronosticado|esperado|observado|real|mismo)\b/g,
    // «su»/«sus» de un objeto del proyecto («su pronóstico», «sus motores»), no de una persona.
    /\bsus? (pronostico|pronosticos|motor|motores|error|errores|modelo|modelos|serie|series|ficha|validacion|tendencia|fuente|cifras|datos|control|release|codigo|alcance)\b/g,
    // Semanas y periodos: «semana 8», «sem 43», «2026-W43», «las próximas 52 semanas», «últimos 5 años», «CIE-10».
    /\b(semana|semanas|sem|week|weeks) \d{1,2}\b/g,
    /\b(\d{4} )?w\d{1,2}\b/g,
    /\b(ultimos|ultimas|proximos|proximas|siguientes|los|las|last|next) \d{1,2} (anos|semanas|meses|dias|years|weeks|months)\b/g,
    /\bcie 10\b/g,
    // Estratos de edad de una POBLACIÓN (no una edad en primera persona): «mujeres de 30 años», «menores de 18 años»,
    // «personas de 40 a 60 años», «entre 40 y 45 años». El handler responde que no hay desglose por edad.
    EDAD_POBLACION,
    EDAD_RANGO,
    EDAD_UMBRAL,
    EDAD_DE_A,
    // Duración en semanas del horizonte («52 semanas», «51 semanas»).
    /\b\d{1,2} (semanas|weeks)\b/g,
    // Preguntas clínicas y de divulgación de los casos funcionales: el verbo o el número sólo valen en la frase completa.
    /\b(que|cual|cuales) (medicamento|medicamentos|tratamiento|tratamientos) (tomar|usar)\b/g,
    /\b\d{1,2} (personajes|famosos|celebridades)\b/g,
    // Subtipos numerados de diabetes («tipo 2», «type 1», «tipo 1 y 2») y la dosis de una vacuna (no de un fármaco).
    /\b(tipo|type) (1|2|i|ii|uno|dos)( (y|o|and|or) (1|2|i|ii|uno|dos))?\b/g,
    /\bdosis de (la )?vacuna\b/g,
    // Conteos del propio proyecto («las 99 series», «333 modelos», «432 gráficos»), no cantidades de una persona.
    /\b\d{1,4} (series|modelos|graficos)\b/g,
    // Nombre alterno del bloque T60 («envenenamiento por plaguicidas»): la palabra sólo vale con su complemento.
    /\benvenenamiento por (plaguicidas|plaguicida|pesticidas)\b/g,
    // Frase de un caso funcional del dengue («¿dónde golpea más el dengue?»): el verbo sólo vale en esta frase completa.
    /\bdonde golpea mas\b/g,
  ],
});
