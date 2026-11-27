/**
 * Rutas caracterizadas sin datos del EpiBot, extraídas de kb.js (plan canónico 3.1, 26-nov-2026). El texto y el orden de las
 * reglas no cambian: la comparación pareada (eval/pareada.mjs) verifica respuesta, manejador y contexto en 3,726 turnos.
 *
 * - Guardas que ceden al modelo de lenguaje: razonamiento temporal fino, conocimiento general, consejo médico, fuera de tema.
 * - Guarda de inyección de instrucciones y su respuesta fija.
 * - Equipo y profesores del proyecto.
 * - Listas de intención que usa el ruteo de kb.js (_resolve).
 */
import { TOTAL_PUBLICADOS } from './conversacion.js?v=28';

/** ¿La consulta contiene alguno de los disparadores? (subcadena, como siempre en kb.js) */
export function any(q, triggers) { return triggers.some(t => q.includes(t)); }

// ---------------------------------------------------------------------------
// Detecta si la query requiere razonamiento temporal fino (diario)
// ---------------------------------------------------------------------------

export function needsGeminiReasoning(q) {
  const dailyMarkers = [
    'ayer', 'hoy', 'manana', 'anteayer', 'pasado manana',
    'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo',
    'dia de', 'al dia', 'por dia', 'diario', 'diaria', 'diariamente',
  ];
  const dataContext = ['caso', 'pronostico', 'forecast', 'prediccion', 'cuanto', 'estimacion'];
  return dailyMarkers.some(m => q.includes(m)) && dataContext.some(w => q.includes(w));
}

// ---------------------------------------------------------------------------
// Detecta preguntas de conocimiento general sobre padecimientos
// que el proyecto NO puede responder (ceder a Gemini)
// ---------------------------------------------------------------------------

export function needsGeneralKnowledge(q) {
  // Personajes famosos, celebridades
  const famousKw = [
    'famoso', 'famosa', 'celebridad', 'celebridades', 'personaje',
    'persona conocida', 'gente conocida', 'artista', 'actor', 'actriz',
    'cantante', 'deportista', 'politico', 'presidente',
    'quien tiene', 'quien padece', 'quien sufre', 'quien tuvo',
    'quien ha tenido', 'alguien famoso',
  ];
  if (any(q, famousKw)) return true;

  // Preguntas sobre paises (el proyecto solo cubre Mexico)
  const countryKw = [
    'que pais', 'paises', 'pais con mas', 'pais tiene', 'a nivel mundial',
    'en el mundo', 'mundial', 'globalmente', 'global',
    'latinoamerica', 'europa', 'asia', 'africa', 'norteamerica', 'sudamerica',
    'estados unidos', 'espana', 'argentina', 'colombia', 'chile', 'peru',
    'canada', 'brasil', 'francia', 'alemania', 'china', 'india', 'japon',
  ];
  // Palabra completa: «asia» aparecía dentro de «hiperplasia» y «displasia» y mandaba la consulta al RAG.
  if (countryKw.some((k) => new RegExp(`\\b${k}\\b`).test(q))) return true;

  // Preguntas sobre si alguien tuvo/tiene una enfermedad (persona especifica)
  // "rocky tenia parkinson", "mohamed ali tuvo parkinson", "mi abuelo tiene alzheimer"
  const personalDiseaseVerbs = [
    'tuvo ', 'tenia ', 'tiene ', 'padecio ', 'padecia ', 'sufrio ',
    'sufria ', 'murio de ', 'murio por ', 'fallecio de ', 'fallecio por ',
    'le diagnosticaron', 'le dieron', 'le detectaron',
  ];
  // Solo aplicar si NO hay keywords de datos/proyecto
  const dataKwCheck = ['caso', 'cuanto', 'pronostico', 'metrica', 'smape', 'modelo', 'semana',
    'boletin', 'historico', 'tendencia', 'ranking', 'motor', 'grafico',
    'estado', 'entidad', 'region', 'nacional', 'incidencia', 'dato'];
  if (any(q, personalDiseaseVerbs) && !any(q, dataKwCheck)) return true;

  // Preguntas personales de salud ("yo puedo ser paciente?", "me puede dar?")
  const personalHealthKw = [
    'yo puedo tener', 'yo puedo ser paciente', 'puedo ser paciente',
    'puedo ser uno de esos', 'me puede dar', 'me puedo enfermar',
    'puedo enfermarme', 'estoy en riesgo', 'tengo riesgo',
    'soy propenso', 'soy propensa', 'como se si tengo',
    'como saber si tengo', 'tengo sintomas', 'creo que tengo',
    'yo tengo', 'me da miedo tener', 'me preocupa tener',
  ];
  if (any(q, personalHealthKw)) return true;

  // Consejos medicos, tratamientos, curas
  const medicalKw = [
    'cura para', 'tiene cura', 'se puede curar', 'como se cura',
    'como tratar', 'como se trata', 'tratamiento para',
    'medicamento para', 'medicina para', 'farmaco para',
    'que tomar', 'medicamento', 'como prevenir', 'se puede prevenir',
    'como evitar', 'como detectar', 'como diagnosticar',
    'donde atender', 'donde tratan', 'a que medico', 'que doctor',
  ];
  if (any(q, medicalKw)) return true;

  return false;
}

// ---------------------------------------------------------------------------
// Detecta consejo clinico / recomendacion DIRIGIDA a una persona
// ("que le recomiendas a un depresivo", "como curar la depresion").
// EPI no es asesor medico: estas preguntas se ceden a Gemini, que responde
// con contexto general y el disclaimer "no constituye consejo medico".
// Se evalua ANTES del fuzzy/handlers, sin depender de que se haya detectado
// un padecimiento (el fuzzy podria inventar uno y volcar estadisticas).
// ---------------------------------------------------------------------------

export function needsMedicalAdvice(q) {
  // Vocabulario de DATOS / proyecto INEQUIVOCO: si aparece, es una consulta
  // sobre los modelos/series, no consejo clinico personal. Protege casos como
  // "que modelo me recomiendas para depresion". Se omiten terminos ambiguos
  // (tendencia, casos, incidencia): "tendencias a la psicosis" es clinico, no
  // un pedido de tendencia de datos. Esta exclusion solo aplica cuando ademas
  // hay verbo de consejo, asi que basta cubrir el vocabulario fuerte.
  const dataIntent = [
    'modelo', 'motor', 'pronostic', 'forecast', 'prediccion', 'smape', 'mase',
    'rmse', 'metrica', 'grafic', 'ranking', 'validacion', 'heatmap', 'dataset',
    'sinave', 'mapa de calor', 'serie de tiempo', 'entrena', 'hiperparametr',
    'overfitting', 'tableau',
  ];
  if (any(q, dataIntent)) return false;

  // Termino clinico/salud real (no jerga ambigua de datos).
  const clinical = [
    'depresi', 'depre', 'deprim', 'parkinson', 'alzheimer', 'psicosis',
    'psicotic', 'psicos', 'psiquiatr', 'narcis', 'narcic', 'suicid', 'ansiedad',
    'ansios', 'bipolar', 'esquizofren', 'demencia', 'salud mental', 'trastorno',
    'sintoma', 'temblor', 'rigidez', 'olvido', 'perdida de memoria', 'animo',
    'autoestima', 'emocional', 'panico', 'angustia', 'estres', 'insomnio',
    'enfermo', 'enferma', 'paciente', 'diagnostic',
  ];
  // Intencion de consejo / tratamiento / ayuda personal.
  const advice = [
    'recomend', 'recomien', 'aconsej', 'consejo', 'consejos', 'ayud', 'curar',
    'curo', 'curacion', 'tiene cura', 'hay cura', 'cura para', 'se puede curar',
    'tratar', 'tratamiento', 'terapia', 'pastilla', 'medicament', 'medicina',
    'remedio', 'farmac', 'sobrellev', 'superar', 'salir de', 'lidiar',
    'manejar la', 'manejar el', 'prevenir', 'que hago', 'que le doy', 'que doy',
    'que tomo', 'que debo', 'deberia', 'me siento', 'que hacer', 'doctor',
    'medico', 'mejorar', 'aliviar', 'calmar', 'combatir',
  ];
  return any(q, clinical) && any(q, advice);
}

// ---------------------------------------------------------------------------
// Guard: prompt injection / roleplay → rechazar con mensaje
// ---------------------------------------------------------------------------

export function answerInjectionGuard(q) {
  const injectionPatterns = [
    // Roleplay / cambio de identidad
    'roleplay', 'role play', 'actua como', 'finge ser', 'finge que eres',
    'eres ahora', 'ahora eres', 'de ahora en adelante eres',
    'comportate como', 'pretend to be', 'you are now', 'act as',
    'simulate being', 'imagina que eres', 'juega a ser',
    // Manipulacion de instrucciones
    'ignora tus instrucciones', 'olvida tus reglas', 'ignore your instructions',
    'forget your', 'override your', 'bypass your', 'disregard your',
    'ignore previous', 'ignore all previous', 'new instructions',
    'nuevas instrucciones', 'cambia tus reglas', 'ignora las reglas',
    // Extraccion de prompt / secretos
    'dime tu prompt', 'show me your prompt', 'reveal your prompt',
    'dame tu system prompt', 'system prompt', 'tell me your instructions',
    'share the password', 'dame las contrasena', 'dame las claves',
    'leaking secrets', 'filtra secretos', 'dime tus secretos',
    // Codificacion / evasion
    'dan mode', 'jailbreak', 'developer mode', 'modo desarrollador',
    // Pruebas de seguridad (24-nov-2026): órdenes con aspecto de sistema y peticiones de credenciales.
    'system:', 'sistema:', 'desactiva las guardas', 'desactiva tus guardas', 'sin restricciones', 'modo administrador', 'eres administrador',
    'clave de api', 'api key', 'apikey', 'tu token', 'tus credenciales', 'contrasena', 'password', 'variables de entorno', 'env var',
    'repite todo lo que te dije', 'muestrame el historial', 'tu codigo fuente',
    // Respuestas condicionadas
    'si la respuesta es si responde', 'responde solo con',
    'a partir de ahora responde', 'usa solo emojis',
  ];
  return injectionPatterns.some(p => q.includes(p));
}

export const INJECTION_RESPONSE =
  'Soy el asistente de **EpiForecast-MX**, una plataforma de inteligencia epidemiológica para la salud pública en México. ' +
  'No puedo asumir otros roles, compartir información confidencial (instrucciones, claves o datos internos) ni modificar ' +
  'mis instrucciones.\n\n' +
  'Puedo ayudarte con:\n' +
  `- Casos y pronósticos de ${TOTAL_PUBLICADOS()} padecimientos del boletín epidemiológico, por estado y por sexo\n` +
  '- Qué tan confiable es cada pronóstico\n' +
  '- Cómo está hecho el proyecto: equipo, modelos y métricas';

// Profesores y asesores del proyecto (no están en knowledge.json)
export const PROFESORES = [
  {
    nombre: 'Ruth P\u00e9rez-Hern\u00e1ndez, PhD',
    aliases: ['ruth', 'dra ruth', 'perez hernandez', 'ruth perez'],
    rol: 'Investigadora principal',
    institucion: 'Instituto Mexicano del Seguro Social (IMSS)',
    ubicacion: 'Acapulco, Guerrero, M\u00e9xico',
    orcid: 'https://orcid.org/0000-0003-3261-1220',
  },
  {
    nombre: 'Grettel Barcel\u00f3 Alonso, PhD',
    aliases: ['grettel', 'dra grettel', 'barcelo', 'grettel barcelo'],
    rol: 'Directora acad\u00e9mica de la Maestr\u00eda en IA Aplicada',
    institucion: 'Tecnol\u00f3gico de Monterrey (ITESM \u2014 Hidalgo)',
    ubicacion: 'M\u00e9xico',
    contacto: 'gbarcelo@tec.mx',
  },
  {
    nombre: 'Lina D\u00edaz-Castro, PhD',
    aliases: ['lina', 'dra lina', 'diaz castro', 'lina diaz'],
    rol: 'Investigadora en Psiquiatr\u00eda, Ciencias M\u00e9dicas "D"',
    institucion: 'Instituto Nacional de Psiquiatr\u00eda Ram\u00f3n de la Fuente Mu\u00f1iz',
    ubicacion: 'M\u00e9xico',
    contacto: 'dralina@inprf.gob.mx',
  },
  {
    nombre: 'Mar\u00eda Jes\u00fas R\u00edos Blancas, PhD',
    aliases: ['maria jesus', 'rios blancas', 'dra rios', 'dra maria'],
    rol: 'Coautora del art\u00edculo',
    institucion: '',
    ubicacion: '',
  },
  {
    nombre: 'Luis Eduardo Falc\u00f3n-Morales, PhD',
    aliases: ['falcon', 'dr falcon', 'falcon morales', 'luis falcon', 'luis eduardo falcon'],
    rol: 'Director de la Maestr\u00eda en Inteligencia Artificial Aplicada (MNA)',
    institucion: 'Tecnol\u00f3gico de Monterrey (ITESM)',
    ubicacion: 'M\u00e9xico',
    bio: 'Matem\u00e1tico con l\u00edneas de investigaci\u00f3n en \u00c1lgebra Geom\u00e9trica Conforme y Machine Learning aplicado a visi\u00f3n rob\u00f3tica, im\u00e1genes omnidireccionales, im\u00e1genes m\u00e9dicas y sistemas de recomendaci\u00f3n en redes sociales. En a\u00f1os recientes, investiga algoritmos de Deep Learning para problemas de seguridad social, generaci\u00f3n de texto (NLP) e im\u00e1genes m\u00e9dicas, generando m\u00faltiples tesis de posgrado y propuestas de innovaci\u00f3n. Ha participado en proyectos CONACYT con PYMES de Jalisco.',
  },
];

export function answerEquipo(q, ent, s, d) {
  const equipoTriggers = [
    'equipo', 'integrantes', 'miembros', 'quienes son', 'quienes hicieron',
    'quienes crearon', 'quienes desarrollaron', 'quien desarrollo', 'quien dirigio',
    'quien dirige', 'autores', 'creadores',
    'quien te creo', 'quien te hizo', 'quien te desarrollo', 'quien te programo',
    'quien te diseno', 'quien te construyo',
    'fuiste creado', 'fuiste desarrollado', 'fuiste hecho', 'fuiste programado',
    'te crearon', 'te desarrollaron', 'te hicieron', 'te programaron',
    'te creo', 'te hizo', 'te desarrollo',
  ];
  if (any(q, equipoTriggers)) {
    const eq = d.equipo || [];
    const lines = [
      '**Equipo EpiForecast-MX (Equipo 01)**\n',
      'Maestr\u00eda en Inteligencia Artificial Aplicada \u00b7 Tecnol\u00f3gico de Monterrey\n',
      '**Directivos, asesores y coautores:**\n',
    ];
    for (const p of PROFESORES) {
      lines.push(`- **${p.nombre}** \u00b7 ${p.rol}${p.institucion ? ` \u00b7 ${p.institucion}` : ''}`);
    }
    lines.push('\n**Equipo de desarrollo:**\n');
    for (const m of eq) {
      lines.push(
        `- **${m.nombre}** (${m.apodo}) \u00b7 ${m.matricula}\n` +
        `  ${m.rol} \u00b7 ${m.empleo}\n` +
        `  ${m.commits} commits` +
        (m.orcid ? `\n  ORCID: https://orcid.org/${m.orcid}` : '')
      );
    }
    lines.push(
      '\n**Proyecto:** Generalizaci\u00f3n de modelos nacionales de pron\u00f3stico epidemiol\u00f3gico ' +
      'hacia un enfoque modular con desagregaci\u00f3n por sexo y entidad federativa en M\u00e9xico (EpiForecast-MX). ' +
      'Pron\u00f3stico multi-modelo de Depresi\u00f3n (F32), Parkinson (G20) y Alzheimer (G30) para la salud p\u00fablica en M\u00e9xico.'
    );
    return lines.join('\n');
  }

  // Buscar profesores por alias
  for (const p of PROFESORES) {
    if (p.aliases.some(a => q.includes(a))) {
      const lines = [`**${p.nombre}**\n`];
      lines.push(`- **Rol:** ${p.rol}`);
      if (p.institucion) lines.push(`- **Instituci\u00f3n:** ${p.institucion}`);
      if (p.ubicacion) lines.push(`- **Ubicaci\u00f3n:** ${p.ubicacion}`);
      if (p.orcid) lines.push(`- **ORCID:** ${p.orcid}`);
      if (p.contacto) lines.push(`- **Contacto:** ${p.contacto}`);
      if (p.bio) lines.push(`\n${p.bio}`);
      lines.push(`\nParticipa en el proyecto EpiForecast-MX y el art\u00edculo *"De los datos a la predicci\u00f3n: un marco metodol\u00f3gico para la salud digital basado en la inteligencia artificial"*.`);
      return lines.join('\n');
    }
  }

  // Buscar miembros del equipo por alias
  const personTriggers = [
    'quien es', 'quien fue', 'que hace', 'que hizo', 'conoces a',
    'dime de', 'dime sobre', 'hablame de', 'cuentame de', 'cuentame sobre',
  ];
  // Detectar claims sobre participacion/desarrollo del equipo
  const participationKw = [
    'no participo', 'no desarrollo', 'no trabajo', 'no hizo',
    'participo en', 'desarrollo en', 'trabajo en',
    'si participo', 'contribuyo', 'tu desarrollo', 'tu implementacion',
    'dicen que', 'no es parte', 'no formo parte', 'formo parte',
  ];
  const isPerson = any(q, personTriggers);
  const isParticipation = any(q, participationKw);

  // Count how many team members are mentioned
  let mentionedMembers = 0;
  for (const m of (d.equipo || [])) {
    for (const alias of (m.aliases || [])) {
      if (q.includes(alias)) { mentionedMembers++; break; }
    }
  }

  // If 2+ team members mentioned with participation context → show full team
  if (isParticipation && mentionedMembers >= 2) {
    const eq = d.equipo || [];
    const lines = [
      'Los **3 integrantes** del equipo de desarrollo participaron activamente en el proyecto:\n',
    ];
    for (const m of eq) {
      lines.push(
        `- **${m.nombre}** (${m.apodo}) \u00b7 ${m.commits} commits \u00b7 ${m.rol}`
      );
    }
    lines.push(
      '\nTodos los integrantes contribuyeron al dise\u00f1o, desarrollo, entrenamiento de modelos y despliegue de la plataforma EpiForecast-MX.'
    );
    return lines.join('\n');
  }

  // Guard: mencionan a un integrante pero la pregunta es sobre el NOMBRE del proyecto → dejar pasar
  const aboutProjectName = any(q, ['se llama ', 'el nombre es ', 'el nombre del proyecto', 'el proyecto se llama', 'esto se llama']);
  if (aboutProjectName) return null;

  if (!isPerson && !isParticipation && q.split(' ').length > 3) return null;

  let bestInfo = null, bestLen = 0;
  for (const m of (d.equipo || [])) {
    for (const alias of (m.aliases || [])) {
      if (q.includes(alias) && alias.length > bestLen) { bestLen = alias.length; bestInfo = m; }
    }
  }
  if (bestInfo) {
    return (
      `**${bestInfo.nombre}**\n\n` +
      `- **Apodo:** ${bestInfo.apodo}\n` +
      `- **Matr\u00edcula:** ${bestInfo.matricula}\n` +
      `- **Rol:** ${bestInfo.rol}\n` +
      `- **Empleo actual:** ${bestInfo.empleo}\n` +
      `- **Commits:** ${bestInfo.commits}`
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Guard: tema fuera de alcance → ceder a Gemini
// ---------------------------------------------------------------------------

export function isOffTopic(q, ent) {
  // Clima / meteorología → fuera de alcance (y evita el fuzzy 'clima'→'colima')
  if (any(q, ['clima', 'pronostico del tiempo', 'pronostico del clima', 'va a llover', 'lluvia manana', 'que tiempo hara', 'tiempo atmosferico'])) return true;

  // Si detectamos entidades del dominio, no es off-topic
  if (ent.padecimiento || ent.estado || ent.modelo) return false;

  // Temas PERMITIDOS que Gemini puede responder (no bloquear):
  // - AI/ML: deep learning, redes neuronales, prophet, deepar, smape, etc.
  // - Salud: depresion, parkinson, alzheimer, imss, epidemiologia, etc.
  // - Ciencia de datos: python, modelos, metricas, overfitting, etc.
  const allowedTerms = [
    // AI / ML / Data Science
    'inteligencia artificial', 'machine learning', 'deep learning', 'red neuronal',
    'redes neuronales', 'modelo', 'algoritmo', 'entrenamiento', 'epoch', 'batch',
    'overfitting', 'underfitting', 'cross validation', 'validacion cruzada',
    'smape', 'rmse', 'mae', 'mase', 'mape', 'metrica', 'accuracy', 'precision',
    'prophet', 'deepar', 'xgboost', 'lightgbm', 'ridge', 'ensemble', 'stacking',
    'serie temporal', 'series de tiempo', 'time series', 'forecast', 'pronostico',
    'transformer', 'lstm', 'gru', 'autoregresivo', 'estacionari',
    'feature', 'hiperparametro', 'regularizacion', 'dropout', 'learning rate',
    'gradient', 'backpropagation', 'loss', 'optimizador', 'adam', 'sgd',
    'pytorch', 'tensorflow', 'gluonts', 'scikit', 'pandas', 'numpy',
    'python', 'sagemaker', 'aws', 'mlflow', 'mlops', 'pipeline',
    'regression', 'clasificacion', 'clustering', 'nlp', 'rag',
    // Salud / Epidemiologia / IMSS
    'salud', 'epidemiologia', 'epidemiologico', 'boletin', 'sinave',
    'imss', 'seguro social', 'ssa', 'secretaria de salud',
    'enfermedad', 'padecimiento', 'diagnostico', 'cie-10', 'cie10',
    'incidencia', 'prevalencia', 'mortalidad', 'morbilidad',
    'vacuna', 'tratamiento', 'terapia', 'farmaco', 'medicamento',
    'neurologia', 'psiquiatria', 'neurodegenerativ', 'mental',
    'sintoma', 'factor de riesgo', 'prevencion', 'deteccion',
    'semana epidemiologica', 'vigilancia', 'brote', 'pandemia',
    'diabetes', 'cancer', 'covid', 'influenza', 'obesidad',
    'hipertension', 'ansiedad', 'esquizofrenia',
    // Proyecto / Temporalidad / Equipo (handlers propios)
    'equipo', 'integrante', 'quien es', 'quienes', 'proyecto',
    'fecha', 'semana', 'que dia', 'que ano', 'cobertura', 'periodo',
    'dato', 'caso', 'cuantos', 'cuantas', 'ranking', 'mejor', 'peor',
    'sexo', 'hombre', 'mujer', 'genero',
    'validacion', 'test', 'infraestructura', 'arquitectura',
    'definicion', 'que significa', 'que quiere decir',
  ];
  if (allowedTerms.some(t => q.includes(t))) return false;

  // Solo bloquear temas claramente irrelevantes al proyecto
  const blockedTerms = [
    'weather', 'futbol', 'soccer', 'basket', 'deporte', 'olimpi',
    'formula 1', 'formula uno', ' f1 ', 'la f1', 'nascar', 'motogp',
    'champions', 'mundial', 'liga mx', 'premier league', 'nba', 'nfl', 'mlb',
    'pelicula', 'netflix', 'musica', 'cancion', 'concierto', 'serie de tv', 'una peli', 'pelis',
    'receta', 'cocina', 'restaurante',
    'bitcoin', 'crypto', 'bolsa de valores', 'acciones de',
    'vuelo', 'hotel', 'turismo', 'airbnb',
    'mascota', 'perro', 'gato',
    'chiste', 'joke', 'broma', 'meme',
    'horoscopo', 'signo zodiacal', 'tarot',
    'pokemon', 'videojuego', 'playstation', 'xbox', 'nintendo',
  ];

  // Bloquear si usan triggers ambiguos con temas bloqueados
  const ambiguousTriggers = ['pronostico', 'prediccion', 'cuantos', 'cuantas', 'quien gana', 'quien va a ganar', 'quien ganara', 'va a ganar'];
  const hasAmbiguous = ambiguousTriggers.some(t => q.includes(t));
  if (hasAmbiguous && blockedTerms.some(t => q.includes(t))) return true;

  // Detectar "f1" como Formula 1 (no confundir con codigos CIE F1x)
  if (/\bf1\b/.test(q) && any(q, ['gana', 'campeon', 'carrera', 'piloto', 'constructor', 'temporada', 'verstappen', 'hamilton'])) return true;

  // Preguntas puramente triviales o de entretenimiento
  const trivial = [
    'dime un chiste', 'cuenta un chiste', 'que hora es',
    'horoscopo', 'signo zodiacal',
    'quien va a ganar', 'quien ganara',
  ];
  if (trivial.some(t => q.includes(t))) return true;

  return false;
}

