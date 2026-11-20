/**
 * Lista curada de palabras de consulta neutras del EpiBot y de la función RAG (quinta auditoría Codex, 19-nov-2026).
 * VERSIONADA A MANO y revisable: no la genera ningún script. Criterio de admisión: una palabra entra sólo si es de consulta
 * neutra (interrogativos, artículos, preposiciones, conectores, cortesía o verbos de consulta), un
 * término de datos o técnico del proyecto, un nombre público del equipo, un mes, o una variante ortográfica o palabra de
 * consulta que ya usan los 616 casos funcionales con una respuesta que lleva cifras.
 * NUNCA entran pronombres personales, posesivos ni reflexivos, parentesco o relaciones (yo, me, mi, estoy, soy, tengo, te,
 * su, familiar, pareja, papá, hijo…), primera persona plural (estamos, tenemos, somos, vamos…), verbos de deseo o
 * necesidad sueltos (quiero, quisiera, deseo, necesito; sólo en una frase de consulta de abajo), verbos causativos o de acción sobre personas (causa, hace, da, pega, quema…; el «se»
 * sólo vale en una construcción impersonal de abajo), ni palabras de riesgo (métodos, sustancias, autolesión, violencia, ingestión), edades, cantidades ni estados de
 * ánimo: «vivo», «tomo», «tabletas», «sedantes», «golpes», «pills» o «poison» sólo cuentan dentro de un alias completo.
 * Los padecimientos, códigos y estados NO van aquí: los reconoce como fragmentos completos `js/vocab_cerrado.js`.
 * Los números sólo valen como año (2014-2027) o dentro de una frase técnica de abajo; cualquier otro número (edades,
 * cantidades) queda fuera de vocabulario.
 */
// Edad en forma POBLACIONAL en tercera persona («mujeres de 30 años», «entre 40 y 45 años», «menores de 18», «de 15 a 19 años»).
// No se aplican si el turno trae primera persona o un familiar («tengo», «soy», «mi hijo tiene»): el número queda fuera.
const EDAD_POBLACION = /\b(mujeres|hombres|personas|pacientes|adultos|jovenes|ninos|ninas|mayores|menores) de \d{1,2}( (a|y) \d{1,2})? anos( de edad)?\b/g;
const EDAD_RANGO = /\bentre \d{1,2} y \d{1,2} anos\b/g;
const EDAD_UMBRAL = /\b(mayores|menores) de \d{1,2}( anos)?\b/g;
const EDAD_DE_A = /\bde \d{1,2} a \d{1,2} anos\b/g;
globalThis.EPI_VOCAB_CONSULTA = Object.freeze({
  frasesEdad: [EDAD_POBLACION, EDAD_RANGO, EDAD_UMBRAL, EDAD_DE_A],
  palabras: new Set(`
    // Interrogativos, artículos, preposiciones, conectores, cortesía y verbos de consulta neutros.
    a afecta ahora al algo el e otro uno siguiente llegaron nuevos pinta sigue tienes cifras cifra consultar
    podrias podria saber conocer informar numeros mostrar ensename porfa porfavor decir basado basas base buenas buenos cada como compara comparacion comparalo
    comparan comparar comparativa comporta con configuro contra contrasta crearon crecido creo cual cuales cuando
    cuantas cuanto cuantos dame de decia del desarrollado describe desde dia dias dicen dicho dime
    dirige disminuido donde en entre entreno es esa ese esperaba esperan esperas esta
    estas este estiman explica favor filtra fuiste funciona funcionas generas gracias ha haber habido habra
    habria hasta hay hey hola hoy hubiera hubo iba iban la las llama llega llegan llego
    los mas menos modelan muestra muestrame nada no noches o onda para participo pasa pero por
    pronosticado pronosticados pronostican pronosticas puede puedes puedo que quien quienes
    sabes sacas saludos segun selecciona ser si sido significa sobre solamente solo son sorprendeme tal tambien
    tan tardes tiene tienen trabaja un una usa usan usas va van ver versus viene vs y
    // Términos de datos epidemiológicos y de la respuesta.
    actual actuales tendencias tasa tasas prevalencia comportamiento variacion estimacion proyeccion mensual series
    violin histograma mae reciente
    acierto alcance aleatorio alto ano anos boletin brecha caso casos cobertura completo composicion corte dato
    datos demografica demografico desglose diferencia disponible distribucion efectos entidad entidades
    epidemiologica estadisticas estado estados evolucion fecha femenino forecast fuente futuro gana ganador
    ganadores ganara general genero grafica grafico historica historico historicos hombres horizonte incidencia
    informacion interesante masculino mayor mejor mejores menor mes meses mujeres nacional nivel numero padecimiento
    padecimientos periodo precision preciso prediccion promedio pronostico pronosticos proporcion proximas proximos
    ranking real realidad recientes regional reporte reporto resumen semana semanal semanas series sexo sintomas
    tabla temporal tendencia top total ultima ultimas ultimo ultimos visualizacion
    // Términos técnicos del proyecto, sus métricas, motores e infraestructura.
    zoom mapa acumulado calibracion semaforo corredor radar avisos aviso validada validado confiable seguimiento curso
    ok excepto desempeno error volumen panorama kpis tablero dashboard meta modo control construyo construccion
    // Preguntas de método sobre un release o el estudio MICAI que ya responden las pruebas de la función RAG.
    efecto valores imputados influyen reparto calidad candidatos fallaron ets ridge excluyo seleccionaron ocurrio
    estacionales modela evaluaron trata mismo fue suma rondas comparativo picos autores ponencia wcp predice micai
    cita textual estudio afiliaciones equivale independientes queda asignacion archivada ingenuo revision optima frente
    treemap letalidad vacuna about pdf publica galeria peores graficos graficas area apilada sparklines timelapse heatmap
    quedo estacional ooad ventana tuvieron naive follow up
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
    tepuede veracurz
    // Términos clínicos y de población que usan las guardas de alcance (subtipos y vecinos no modelados) y sus pruebas.
    embarazadas ciclistas cardiopatias pulmonary portal intracraneal inducida durante demencia perinatal vejiga
    lombrices women men pregnant newborns infants babies c obesdiad fetal tiroides infantil bebes recien nacidos ninos
    adultos mayores menores pacientes herpes zoster gestantes insulinodependiente treponema pallidum treponematosis
    mortinato syphilitic stillbirth rare materna lactantes clamidia ojo rojo infection endemica nonvenereal anogenitales
    insulina hipertensos
    // Preguntas de divulgación de los casos funcionales: personajes públicos, historia del padecimiento y comparación mundial.
    alguien ali artistas celebridades cura descubrio diagnosticaron famoso famosos historia identifico indices
    mohamed mundial mundo origen pais paises pakistan personajes prevenir robin rocky tratamiento unidos williams
    // Palabras de consultas fuera de tema de los casos funcionales (lugares y objetos; la respuesta las declina).
    atlantida california cuesta fantasma irapuato mordor narnia tesla texas viajar
    // Inglés de consulta neutro.
    and are cases data for forecast how in is many of show state the trend week weeks what year do you have
`.split('\n').filter((l) => !l.trim().startsWith('//')).join(' ').split(/\s+/).filter(Boolean)),
  frases: [
    // Octava auditoría: los verbos de deseo o necesidad sólo valen en una frase de consulta inequívoca seguida del dato
    // («quiero ver», «quisiera consultar», «necesito datos de», «dame los casos de»); sueltos quedan fuera de vocabulario.
    /\b(quiero|quisiera|queremos|necesito|necesitamos|deseo|me gustaria) (ver|consultar|saber|conocer|revisar|comparar|los datos de|datos de|las cifras de|cifras de|el pronostico de|la grafica de|informacion de|informacion sobre|los casos de)\b/g,
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
