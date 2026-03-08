/**
 * kb.js - Base de conocimiento EpiForecast-MX (22 handlers).
 *
 * Port inteligente de epi_modules/features/knowledge_base.py.
 * Cada handler responde de forma directa y conversacional,
 * con estimaciones mensuales, contexto hist\u00f3rico e interpretaci\u00f3n.
 */

import { norm, detectEntities } from './entities.js';

let DATA = null;

export async function loadKnowledge() {
  if (DATA) return DATA;
  const cacheBust = `?t=${Date.now()}`;
  const resp = await fetch(`./knowledge.json${cacheBust}`);
  if (!resp.ok) throw new Error('No se pudo cargar knowledge.json');
  DATA = await resp.json();
  return DATA;
}

export function getStats() { return DATA?.stats || {}; }
export function getData() { return DATA; }

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function fmt(n) {
  if (n == null) return '?';
  return Number(n).toLocaleString('es-MX');
}

function pct(n) { return n == null ? '?' : `${n}%`; }

function any(q, triggers) { return triggers.some(t => q.includes(t)); }

const MONTH_NAMES = [
  'enero','febrero','marzo','abril','mayo','junio',
  'julio','agosto','septiembre','octubre','noviembre','diciembre',
];

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Estima casos mensuales a partir del pron\u00f3stico anual (52 semanas). */
function estimateMonthly(annualCases, monthNum) {
  const weeklyRate = annualCases / 52;
  return Math.round(weeklyRate * (DAYS_IN_MONTH[monthNum - 1] / 7));
}

/** Genera texto con estimaciones mensuales, distinguiendo pasado vs futuro. */
function monthEstimateText(total, months, years, pad, lugar, data) {
  if (!months.length || !total) return null;
  const lines = [];
  const year = years.length ? years[0] : new Date().getFullYear();
  const currentYear = new Date().getFullYear();
  const isPast = year < currentYear;

  // Si es fecha pasada, intentar usar datos hist\u00f3ricos del bolet\u00edn
  if (isPast && data) {
    const bol = data.boletin || {};
    let annualHist = null;
    const padKey = pad || null;
    const estKey = lugar || null;

    if (estKey && padKey) {
      annualHist = bol.anual_por_estado_pad?.[estKey]?.[padKey]?.[String(year)];
    }
    if (annualHist == null && padKey) {
      annualHist = bol.anual_por_pad?.[padKey]?.[String(year)];
    }

    if (annualHist != null) {
      for (const m of months) {
        const est = estimateMonthly(annualHist, m);
        lines.push(
          `En **${MONTH_NAMES[m - 1]} ${year}** se reportaron aproximadamente **~${fmt(est)} casos` +
          (pad ? ` de ${pad}` : '') +
          (lugar ? ` en ${lugar}` : '') +
          `**, bas\u00e1ndose en el total anual real de **${fmt(annualHist)} casos** registrados ese a\u00f1o.`
        );
      }
      lines.push('\n*Estimado proporcional a partir del total anual del bolet\u00edn (no disponemos de desglose mensual exacto).*');
      return lines.join('\n');
    }
  }

  // Futuro o sin datos hist\u00f3ricos: usar pron\u00f3stico
  const verb = isPast ? 'se reportaron aproximadamente' : 'se estiman';
  const source = isPast ? 'datos disponibles' : 'pron\u00f3stico anual';
  for (const m of months) {
    const est = estimateMonthly(total, m);
    lines.push(
      `Para **${MONTH_NAMES[m - 1]} ${year}** ${verb} **~${fmt(est)} casos` +
      (pad ? ` de ${pad}` : '') +
      (lugar ? ` en ${lugar}` : '') +
      `**, bas\u00e1ndose en ${source} de ${fmt(total)} casos.`
    );
  }
  lines.push(`\n*Estimado proporcional (${source} / 12 meses ajustado por d\u00edas).*`);
  return lines.join('\n');
}

/** Nivel de confianza basado en SMAPE. */
function confidence(smape) {
  if (smape == null) return 'sin datos';
  if (smape < 15) return 'alta';
  if (smape < 40) return 'moderada';
  if (smape < 80) return 'baja';
  return 'muy baja';
}

/** Busca posici\u00f3n de una entidad en el ranking de precisi\u00f3n para un padecimiento. */
function findRank(models, pad, estado) {
  const gen = models
    .filter(m => m.padecimiento === pad && m.sexo === 'general')
    .sort((a, b) => (a.smape_prod || 999) - (b.smape_prod || 999));
  const idx = gen.findIndex(m => norm(m.entidad || '') === norm(estado));
  return idx >= 0 ? { rank: idx + 1, total: gen.length } : null;
}

/** Contexto hist\u00f3rico del bolet\u00edn para pad y/o estado. */
function getHistContext(d, pad, estado) {
  let data = null;
  let label = '';
  if (estado && estado !== 'Nacional') {
    data = d.boletin?.anual_por_estado_pad?.[estado]?.[pad];
    label = estado;
  }
  if (!data && pad) {
    data = d.boletin?.anual_por_pad?.[pad];
    label = 'a nivel nacional';
  }
  if (!data) return null;

  const years = Object.keys(data).sort();
  if (!years.length) return null;

  const latest = years[years.length - 1];
  const prev = years.length > 1 ? years[years.length - 2] : null;
  const latestCount = data[latest];
  const prevCount = prev ? data[prev] : null;

  let change = '';
  if (prevCount && prevCount > 0) {
    const pc = ((latestCount - prevCount) / prevCount * 100).toFixed(1);
    change = ` (${Number(pc) >= 0 ? '+' : ''}${pc}% vs ${prev})`;
  }

  return `En ${latest}, ${label} report\u00f3 ${fmt(latestCount)} casos${pad ? ' de ' + pad : ''}${change}.`;
}

function getISOWeek(date) {
  const d = new Date(date.getTime());
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const week = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return { year: d.getFullYear(), week };
}

// ---------------------------------------------------------------------------
// Detecta si la query requiere razonamiento temporal fino (diario)
// ---------------------------------------------------------------------------

function needsGeminiReasoning(q) {
  const dailyMarkers = [
    'ayer', 'hoy', 'manana', 'anteayer', 'pasado manana',
    'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo',
    'dia de', 'al dia', 'por dia', 'diario', 'diaria', 'diariamente',
  ];
  const dataContext = ['caso', 'pronostico', 'forecast', 'prediccion', 'cuanto', 'estimacion'];
  return dailyMarkers.some(m => q.includes(m)) && dataContext.some(w => q.includes(w));
}

// ---------------------------------------------------------------------------
// Guard: padecimiento no modelado → retorna null para caer a Gemini
// ---------------------------------------------------------------------------

function answerPadecimientoNoModelado(q, ent, s, d) {
  // Si ya detectamos un padecimiento conocido, no es off-scope
  if (ent.padecimiento) return null;

  // Detectar enfermedades/padecimientos mencionados que NO modelamos
  const enfermedades = [
    'cancer', 'diabetes', 'hipertension', 'obesidad', 'asma', 'epilepsia',
    'esquizofrenia', 'ansiedad', 'bipolar', 'autismo', 'tdah', 'demencia',
    'influenza', 'dengue', 'covid', 'tuberculosis', 'vih', 'sida', 'colera',
    'sarampion', 'rubeola', 'hepatitis', 'zika', 'chikungunya', 'malaria',
    'leucemia', 'linfoma', 'tumor', 'neoplasia', 'cardiop', 'infarto',
    'embolia', 'neumonia', 'bronquitis', 'enfisema', 'cirrosis', 'artritis',
    'lupus', 'fibromialgia', 'esclerosis', 'huntington', 'ela ',
    'insuficiencia renal', 'insuficiencia cardiaca',
  ];

  // Solo activar si la pregunta parece pedir datos (casos, incidencia, etc.)
  const dataKw = ['caso', 'cuanto', 'incidencia', 'dato', 'estadistica',
    'numero', 'cifra', 'hubo', 'reporta', 'registro', 'pronostic',
    'prediccion', 'modelo', 'grafica', 'tendencia'];

  const matchedDisease = enfermedades.find(e => q.includes(e));
  if (matchedDisease && any(q, dataKw)) {
    return (
      `EpiForecast-MX **no modela ${matchedDisease}**. ` +
      'Nuestro proyecto se enfoca exclusivamente en 3 padecimientos del Bolet\u00edn Epidemiol\u00f3gico SINAVE:\n\n' +
      '- **Depresi\u00f3n** (CIE-10: F32)\n' +
      '- **Parkinson** (CIE-10: G20)\n' +
      '- **Alzheimer** (CIE-10: G30)\n\n' +
      '\u00bfTe gustar\u00eda consultar datos de alguno de estos padecimientos?'
    );
  }

  return null;
}

function answerLugarDesconocido(q, ent, s, d) {
  if (!ent._lugarDesconocido || ent.estado) return null;
  const lugar = ent._lugarDesconocido;
  return (
    `**${lugar.charAt(0).toUpperCase() + lugar.slice(1)}** no es una entidad federativa de M\u00e9xico.\n\n` +
    'EpiForecast-MX cubre \u00fanicamente las **32 entidades federativas** de M\u00e9xico, ' +
    '4 macrorregiones INEGI y el nivel Nacional.\n\n' +
    'Ejemplos: "Parkinson en Jalisco", "Depresi\u00f3n en CDMX", "Alzheimer en Nuevo Le\u00f3n".'
  );
}

// ---------------------------------------------------------------------------
// Handlers (respuestas directas y conversacionales)
// ---------------------------------------------------------------------------

function answerSaludo(q, ent, s, d) {
  const triggers = [
    'hola', 'buenos dias', 'buenas tardes', 'buenas noches',
    'hello', 'saludos', 'buen dia',
  ];
  if (!any(q, triggers)) return null;

  const total = s.total_modelos || 333;
  const motor = s.motor_ganador || 'DeepAR';
  const mpct = s.motor_ganador_pct || '';
  const forecast = s.pronostico_total ? Number(s.pronostico_total).toLocaleString('es-MX') : '?';

  return (
    '\u00a1Hola! Soy el asistente de **EpiForecast-MX**.\n\n' +
    `Tengo acceso a **${total} modelos** de producci\u00f3n. ` +
    `El motor ganador es **${motor}** (${mpct}% de las series) ` +
    `y el pron\u00f3stico total a 52 semanas es de **${forecast} casos**.\n\n` +
    'Puedo ayudarte con:\n' +
    '- **M\u00e9tricas** y rendimiento de modelos\n' +
    '- **Padecimientos**: Depresi\u00f3n, Parkinson, Alzheimer\n' +
    '- **Datos hist\u00f3ricos** del bolet\u00edn epidemiol\u00f3gico\n' +
    '- **Equipo**, infraestructura y configuraci\u00f3n\n' +
    '- **Pron\u00f3sticos** y validaci\u00f3n semanal\n\n' +
    '\u00bfQu\u00e9 te gustar\u00eda saber?'
  );
}

function answerEquipo(q, ent, s, d) {
  const equipoTriggers = [
    'equipo', 'integrantes', 'miembros', 'quienes son', 'quienes hicieron',
    'quienes crearon', 'quienes desarrollaron', 'autores', 'creadores',
  ];
  if (any(q, equipoTriggers)) {
    const eq = d.equipo || [];
    const lines = [
      '**Equipo EpiForecast-MX (Equipo 01)**\n',
      'Maestr\u00eda en Inteligencia Artificial Aplicada \u00b7 Tecnol\u00f3gico de Monterrey\n',
    ];
    for (const m of eq) {
      lines.push(
        `- **${m.nombre}** (${m.apodo}) \u00b7 ${m.matricula}\n` +
        `  ${m.rol} \u00b7 ${m.empleo}\n` +
        `  ${m.commits} commits`
      );
    }
    lines.push(
      '\nProyecto integrador para el IMSS: pron\u00f3stico epidemiol\u00f3gico ' +
      'multi-modelo de Depresi\u00f3n (F32), Parkinson (G20) y Alzheimer (G30).'
    );
    return lines.join('\n');
  }

  const personTriggers = [
    'quien es', 'quien fue', 'que hace', 'que hizo', 'conoces a',
    'dime de', 'dime sobre', 'hablame de', 'cuentame de', 'cuentame sobre',
  ];
  const isPerson = any(q, personTriggers);
  if (!isPerson && q.split(' ').length > 3) return null;

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

function answerTemporal(q, ent, s, d) {
  const triggers = [
    'que dia es', 'fecha de hoy', 'dia de hoy', 'fecha actual',
    'semana epidemiologica', 'semana epi', 'en que semana', 'que semana es',
    'que semana estamos', 'semana estamos', 'ultima semana', 'ultimo dato',
    'hasta cuando', 'hasta que fecha', 'hasta que semana', 'cobertura temporal',
    'rango de fecha', 'periodo de dato', 'desde cuando', 'cuando inicia',
    'cuando empieza', 'horizonte',
  ];
  if (!any(q, triggers)) return null;

  // Si mencionan un evento historico, no dar la fecha actual
  const historicalContext = ['ocurrio', 'fue', 'paso', 'inicio', 'empezo', 'surgio', 'covid', 'pandemia'];
  if (historicalContext.some(w => q.includes(w))) return null;

  const now = new Date();
  const iso = getISOWeek(now);
  const lines = [];

  const isDateQ = any(q, ['que dia es', 'fecha de hoy', 'dia de hoy', 'fecha actual']);
  if (isDateQ) {
    const dias = ['domingo', 'lunes', 'martes', 'mi\u00e9rcoles', 'jueves', 'viernes', 's\u00e1bado'];
    const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    lines.push(`Hoy es **${dias[now.getDay()]} ${now.getDate()} de ${meses[now.getMonth()]} de ${now.getFullYear()}**`);
    lines.push(`Semana epidemiol\u00f3gica: **${iso.week}** de ${iso.year}`);
  }

  const isWeekQ = any(q, ['semana epidemiologica', 'semana epi', 'en que semana', 'que semana es', 'que semana estamos', 'semana estamos']);
  if (isWeekQ && !isDateQ) {
    lines.push(`Estamos en la **semana epidemiol\u00f3gica ${iso.week}** de ${iso.year}.`);
  }

  const isCoverage = any(q, ['ultima semana', 'ultimo dato', 'hasta cuando', 'hasta que fecha', 'hasta que semana', 'cobertura temporal', 'rango de fecha', 'periodo de dato', 'desde cuando', 'cuando inicia', 'cuando empieza']);
  if (isCoverage) {
    const meta = d.boletin?.meta;
    if (meta) {
      if (lines.length) lines.push('');
      lines.push('**Cobertura del bolet\u00edn epidemiol\u00f3gico**:');
      lines.push(`- Desde: semana 1 de ${meta.min_anio}`);
      lines.push(`- Hasta: **semana ${meta.max_semana} de ${meta.max_anio}**`);
      lines.push(`- Registros totales: ${fmt(meta.total_registros)}`);
      lines.push('- Padecimientos: Depresi\u00f3n (F32), Parkinson (G20), Alzheimer (G30)');
      lines.push('- Entidades: 32 estados + Nacional');
      const rezago = meta.max_anio === iso.year ? iso.week - meta.max_semana : iso.week + (52 - meta.max_semana);
      if (rezago > 0) lines.push(`- Rezago: ~${rezago} semana(s) respecto a la semana actual (${iso.week})`);
    }
  }

  if (q.includes('horizonte') && !lines.length) {
    lines.push(`El horizonte de pron\u00f3stico es de **52 semanas** (hasta enero ${iso.year + 1} aproximadamente).`);
  }

  if (lines.length && !isDateQ && !isWeekQ) {
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    lines.unshift(`Fecha actual: ${dd}/${mm}/${now.getFullYear()} (semana epidemiol\u00f3gica ${iso.week})\n`);
  }

  return lines.length ? lines.join('\n') : null;
}

function answerProyectoMeta(q, ent, s, d) {
  const padTriggers = [
    'que padecimiento', 'cuales padecimiento', 'de que padecimiento',
    'padecimiento sabes', 'padecimiento manejas', 'padecimiento modela',
    'padecimiento pronostic', 'padecimiento cubre', 'padecimiento tiene',
    'que enfermedad', 'cuales enfermedad', 'enfermedad modela', 'enfermedad cubre',
    'que diagnostico', 'que cie', 'codigos cie', 'clasificacion internacional',
  ];
  if (any(q, padTriggers)) {
    const pp = s.por_pad || {};
    const lines = ['**EpiForecast-MX modela 3 padecimientos** de la Clasificaci\u00f3n Internacional de Enfermedades (CIE-10):\n'];
    for (const [nombre, cie, key] of [['Depresi\u00f3n', 'F32', 'Depresion'], ['Parkinson', 'G20', 'Parkinson'], ['Alzheimer', 'G30', 'Alzheimer']]) {
      const ps = pp[key] || {};
      let extra = '';
      if (ps.smape_prod_median != null) extra += ` | SMAPE mediano: ${ps.smape_prod_median}%`;
      if (ps.motor_ganador) extra += ` | Motor ganador: ${ps.motor_ganador}`;
      lines.push(`- **${nombre} (${cie})**${extra}`);
    }
    lines.push(`\nCada padecimiento genera **111 modelos** (37 geograf\u00edas \u00d7 3 modos de sexo) = **${s.total_modelos || 333} modelos totales**.`);
    return lines.join('\n');
  }

  const regionTriggers = ['region', 'macroregion', 'macro region', 'zona geografica', 'zonas del pais', 'division geografica', 'cuantas region', 'cuales region', 'que region', 'las region'];
  if (any(q, regionTriggers)) {
    const reg = d.regiones || {};
    const lines = ['**EpiForecast-MX usa 4 macrorregiones INEGI** de salud mental como geograf\u00edas adicionales:\n'];
    for (const [nombre, estados] of Object.entries(reg)) {
      lines.push(`- **${nombre}** (${estados.length} entidades): ${estados.join(', ')}`);
    }
    lines.push(`\nEstas regiones se modelan como series independientes y sirven de **fallback** para entidades con incidencia insuficiente (${s.fallback_n || 8} series usan fallback).`);
    lines.push('\n**37 geograf\u00edas totales**: 32 entidades + 4 regiones INEGI + Nacional.');
    return lines.join('\n');
  }

  const covidTriggers = ['covid', 'pandemia', 'franja covid', 'periodo covid', 'periodo pandem', 'confinamiento', 'cuarentena', 'cambio estructural'];
  if (any(q, covidTriggers)) {
    const ev = d.training_config?.eventos?.covid || {};
    return (
      '**Per\u00edodo COVID-19 en EpiForecast-MX**:\n\n' +
      `- **Inicio**: ${ev.inicio || '2020-03-23'} (15 de marzo de 2020)\n` +
      `- **Fin**: ${ev.fin || '2022-09-22'} (22 de septiembre de 2022)\n` +
      `- **Duraci\u00f3n**: ~2.5 a\u00f1os (${ev.duracion_semanas || 130} semanas)\n\n` +
      '**Impacto por padecimiento**:\n' +
      '- **Depresi\u00f3n**: ca\u00edda abrupta en 2020 seguida de rebote sostenido post-pandemia (super\u00f3 niveles pre-COVID)\n' +
      '- **Parkinson**: reducci\u00f3n moderada por ca\u00edda en consultas presenciales, recuperaci\u00f3n gradual en 2022\n' +
      '- **Alzheimer**: impacto similar a Parkinson, con potencial subdiagn\u00f3stico durante el confinamiento'
    );
  }

  // Composicion de los 333 modelos
  const compTriggers = ['composicion', 'de donde salen', 'por que 333', 'porque 333', 'como se compone',
    'de donde vienen', 'que son los 333', 'como se forman', 'como se calculan los 333',
    'explicame los 333', 'explica los 333', 'desglose de modelo'];
  if (any(q, compTriggers) || (q.includes('333') && any(q, ['que es', 'que son', 'como', 'por que', 'porque', 'explica', 'de donde']))) {
    const pp = s.por_pad || {};
    const lines = [
      '**Composición de los 333 modelos de producción**\n',
      'EpiForecast-MX genera modelos para **cada combinación única** de padecimiento, geografía y sexo:\n',
      '| Dimensión | Valores | Cantidad |',
      '|-----------|---------|:--------:|',
      '| Padecimientos | Depresión (F32), Parkinson (G20), Alzheimer (G30) | **3** |',
      '| Geografías | 32 entidades + 4 regiones INEGI + Nacional | **37** |',
      '| Sexo | General, Hombres, Mujeres | **3** |',
      '',
      '**3 padecimientos x 37 geografías x 3 sexos = 333 modelos**\n',
      'Cada modelo es una serie de tiempo independiente con su propio motor de predicción (DeepAR, Prophet, Ensemble o Stacking) seleccionado por menor SMAPE en cross-validation.\n',
      '**Desglose por padecimiento:**',
    ];
    for (const [nombre, key] of [['Depresión', 'Depresion'], ['Parkinson', 'Parkinson'], ['Alzheimer', 'Alzheimer']]) {
      const ps = pp[key] || {};
      lines.push(`- **${nombre}**: ${ps.n || 111} modelos | Motor ganador: ${ps.motor_ganador || '—'} | Pronóstico: ${fmt(ps.casos_futuro_total)} casos`);
    }
    return lines.join('\n');
  }

  const fuenteTriggers = ['fuente de datos', 'fuente de informacion', 'de donde vienen los datos', 'de donde salen los datos', 'de donde obtienen', 'de donde sacan', 'origen de los datos', 'origen de dato', 'cual es la fuente', 'que fuente', 'donde consiguen los datos', 'como obtienen los datos', 'base de datos original', 'datos originales', 'fuente oficial'];
  if (any(q, fuenteTriggers)) {
    const meta = d.boletin?.meta;
    return (
      '**Fuente de datos de EpiForecast-MX**\n\n' +
      'Los datos históricos provienen del **Boletín Epidemiológico del Sistema Nacional de Vigilancia Epidemiológica (SINAVE)**, ' +
      'publicado semanalmente por la **Secretaría de Salud** de México y reportado por el **IMSS**.\n\n' +
      '**Características del boletín:**\n' +
      `- **Cobertura temporal**: ${meta ? `semana 1 de ${meta.min_anio} a semana ${meta.max_semana} de ${meta.max_anio}` : '2014 a 2026'}\n` +
      '- **Frecuencia**: semanal (52 semanas epidemiológicas por año)\n' +
      '- **Granularidad**: por entidad federativa, padecimiento y sexo\n' +
      '- **Padecimientos cubiertos**: Depresión (F32), Parkinson (G20), Alzheimer (G30)\n' +
      '- **Desglose geográfico**: 32 entidades federativas de México\n\n' +
      'Los datos se extraen mediante scraping automatizado de los PDF del boletín y se procesan con Camelot (CI/CD en GitHub Actions).'
    );
  }

  const articuloTriggers = ['articulo', 'publicacion', 'paper', 'manuscrito', 'draft', 'titulo del articulo', 'nombre del articulo', 'como se llama el articulo', 'que se va a publicar', 'articulo cientifico', 'journal'];
  if (any(q, articuloTriggers)) {
    return (
      '**Artículo del proyecto EpiForecast-MX**\n\n' +
      '**Título**: *De los datos a la predicción: un marco metodológico para la salud digital basado en la inteligencia artificial*\n\n' +
      '**Subtítulo**: Modelado predictivo basado en inteligencia artificial en salud digital: un marco metodológico con aplicaciones clínicas\n\n' +
      '**Título en inglés**: *A methodological framework for artificial intelligence-based predictive modelling in digital health*\n\n' +
      '**Autores principales**:\n' +
      '- **Ruth Pérez-Hernández, PhD** — IMSS (investigadora principal)\n' +
      '- **Grettel Barceló Alonso, PhD** — Tecnológico de Monterrey (directora académica)\n' +
      '- **Lina Díaz-Castro, PhD** — Instituto Nacional de Psiquiatría Ramón de la Fuente Muñiz\n' +
      '- **María Jesús Ríos Blancas, PhD**\n' +
      '- **Javier Augusto Rebull Saucedo** — Santander Bank US\n' +
      '- **Juan Carlos Pérez Nava** — IMSS\n' +
      '- **Luis Gerardo Sánchez Salazar** — Tesla, Inc.\n\n' +
      '**Estado**: Draft v3 (en preparación para publicación)\n\n' +
      'El artículo documenta el marco metodológico completo del proyecto: desde la extracción de datos SINAVE hasta la predicción a 52 semanas usando los 4 motores (Prophet, DeepAR, Ensemble, Stacking).'
    );
  }

  const alcanceTriggers = ['que sabe', 'que puede', 'de que sabe', 'que conoce', 'que informacion tiene', 'que datos tiene', 'que cubre', 'alcance', 'capacidad', 'sobre que me puede'];
  if (any(q, alcanceTriggers)) {
    return (
      '**Puedo responder sobre el proyecto EpiForecast-MX**:\n\n' +
      '- **Padecimientos**: Depresi\u00f3n (F32), Parkinson (G20), Alzheimer (G30)\n' +
      '- **Geograf\u00edas**: 32 entidades + 4 regiones INEGI + Nacional\n' +
      `- **Modelos**: Prophet, DeepAR, Ensemble, Stacking (${s.total_modelos || 333} en producci\u00f3n)\n` +
      '- **M\u00e9tricas**: SMAPE, MASE, RMSE, MAE por serie\n' +
      '- **Bolet\u00edn epidemiol\u00f3gico**: datos hist\u00f3ricos 2014\u20132026\n' +
      '- **Equipo**: integrantes, roles, contribuciones\n' +
      '- **Infraestructura**: tests, CI/CD, SageMaker, costos\n' +
      '- **Franja COVID**: per\u00edodo, impacto, changepoints\n' +
      '- **Pron\u00f3sticos**: acumulados a 52 semanas por serie\n\n' +
      '\u00bfSobre cu\u00e1l de estos temas quieres saber m\u00e1s?'
    );
  }

  return null;
}

function answerTrainingConfig(q, ent, s, d) {
  const triggers = [
    'fecha de corte', 'fechas de corte', 'fecha corte', 'fechas corte',
    'corte de entrenamiento', 'corte entrenamiento', 'fecha de entrenamiento',
    'cuando se entreno', 'cuando se entrenaron', 'train test', 'train/test',
    'hiperparametro', 'hiperparametros', 'hyperparametr', 'cross validation',
    'validacion cruzada', 'cv fold', 'fold', 'test size', 'tamano de test',
    'tamano de prueba', 'tamano test', 'oof', 'out of fold', 'epoch',
    'learning rate', 'tasa de aprendizaje', 'capas', 'layers', 'dropout',
    'context length', 'prediction length', 'early stopping', 'patience',
    'configuracion del modelo', 'configuracion de entrenamiento',
    'config del modelo', 'config entrenamiento', 'parametros del modelo',
    'parametros de entrenamiento', 'como se entreno', 'como se entrenaron',
    'con que parametros', 'con que configuracion', 'grid search',
    'meta learner', 'metalearner', 'ridge', 'elasticnet',
    'estacionalidad', 'seasonality',
  ];
  const modelWords = ['prophet', 'deepar', 'deep ar', 'ensemble', 'stacking', 'xgboost', 'lightgbm'];
  const configWords = ['configuracion', 'config', 'parametro', 'parametros', 'hiperparametro', 'como se entreno', 'como entrena', 'como funciona'];
  const hasModelConfig = modelWords.some(m => q.includes(m)) && configWords.some(c => q.includes(c));
  if (!any(q, triggers) && !hasModelConfig) return null;

  const modelo = ent.modelo;
  const tc = d.training_config || {};
  const lines = [];

  const corteKw = any(q, ['fecha de corte', 'fecha corte', 'corte de entrenamiento', 'corte entrenamiento', 'train test', 'train/test', 'como se entreno', 'como se entrenaron']);
  if (corteKw || !modelo) {
    lines.push('**Fechas de corte de entrenamiento**\n');
    lines.push('Todos los modelos usan la misma fecha de corte:');
    lines.push(`- **Fecha de corte: ${tc.fecha_corte || '2025-01-01'}**`);
    lines.push('- Datos de entrenamiento: semana 1/2014 hasta semana 52/2024');
    lines.push('- Datos de prueba (CV): semana 1/2025 en adelante');
    lines.push(`- Horizonte de pron\u00f3stico: **${tc.horizonte || 52} semanas**`);
    lines.push('');
  }

  const mods = tc.modelos || {};

  const showProphet = modelo === 'Prophet' || (!modelo && any(q, ['prophet', 'fold', 'cv_weight', 'peso', 'weight', 'estacionalidad', 'seasonality', 'changepoint', 'change point', 'grid']));
  if (showProphet || (corteKw && !modelo)) {
    const p = mods.Prophet || {};
    lines.push('**Prophet**');
    lines.push(`- Validaci\u00f3n cruzada: **${p.cv_folds || 4} folds** (TS_SPLITS)`);
    lines.push(`- Tama\u00f1o de prueba por fold: **${p.test_size || 53} semanas**`);
    lines.push(`- Pesos de CV: [${(p.cv_weights || [0.5, 0.75, 1.0, 1.25]).join(', ')}] (m\u00e1s peso a folds recientes)`);
    lines.push(`- Estacionalidad: ${p.estacionalidad || 'multiplicativa (Depresi\u00f3n, Parkinson), aditiva (Alzheimer)'}`);
    lines.push('');
  }

  const showEnsemble = modelo === 'Ensemble' || (!modelo && any(q, ['ensemble', 'xgboost', 'oof', 'out of fold']));
  if (showEnsemble || (corteKw && !modelo)) {
    const e = mods.Ensemble || {};
    lines.push(`**Ensemble (${e.componentes || 'Prophet + XGBoost'})**`);
    lines.push(`- Horizonte: **${tc.horizonte || 52} semanas**`);
    lines.push(`- OOF cutoff: **${e.oof_cutoff || '2024-01-01'}**`);
    lines.push(`- XGBoost CV: **${e.xgb_cv_splits || 4} splits**, test_size=**${e.xgb_test_size || 26} semanas**`);
    lines.push(`- Hiperpar\u00e1metros XGBoost: ${e.xgb_params || 'n_estimators=500, max_depth=4, lr=0.05'}`);
    lines.push('');
  }

  const showStacking = modelo === 'Stacking' || (!modelo && any(q, ['stacking', 'lightgbm', 'meta learner', 'metalearner', 'ridge', 'elasticnet', 'ets']));
  if (showStacking || (corteKw && !modelo)) {
    const sk = mods.Stacking || {};
    lines.push(`**Stacking (${sk.componentes || 'Prophet + ETS + LightGBM + Ridge'})**`);
    lines.push(`- Horizonte: **${tc.horizonte || 52} semanas**`);
    lines.push(`- OOF cutoff: **${sk.oof_cutoff || '2024-01-01'}**`);
    lines.push(`- OOF folds: **${sk.oof_folds || 4}**, m\u00ednimo de entrenamiento: **${sk.min_train || 104} semanas** (2 a\u00f1os)`);
    lines.push(`- Meta-learner: ${sk.meta_learner || 'Ridge con pesos no negativos'}`);
    lines.push('');
  }

  const showDeepAR = modelo === 'DeepAR' || (!modelo && any(q, ['deepar', 'deep ar', 'epoch', 'capas', 'layers', 'dropout', 'context length', 'prediction length', 'early stopping', 'patience', 'learning rate', 'tasa de aprendizaje']));
  if (showDeepAR || (corteKw && !modelo)) {
    const da = mods.DeepAR || {};
    lines.push('**DeepAR (GluonTS + PyTorch)**');
    lines.push(`- Context length: **${da.context_length || 104} semanas** (2 a\u00f1os de historia)`);
    lines.push(`- Prediction length: **${da.prediction_length || 52} semanas**`);
    lines.push(`- Epochs: **${da.epochs || 300}** (m\u00e1x.)`);
    lines.push(`- Early stopping patience: **${da.early_stopping_patience || 15} epochs**`);
    lines.push(`- Arquitectura: ${da.capas || '2 LSTM, 40 celdas'}, dropout=${da.dropout || 0.1}`);
    lines.push(`- Learning rate: ${da.learning_rate || 0.001}`);
    lines.push(`- Batch size: ${da.batch_size || 32}`);
    lines.push('');
  }

  if (!lines.length) {
    lines.push('**Configuraci\u00f3n general de entrenamiento**\n');
    lines.push(`- Fecha de corte: **${tc.fecha_corte || '2025-01-01'}**`);
    lines.push(`- Horizonte: **${tc.horizonte || 52} semanas**`);
    lines.push('- Modelos: Prophet, DeepAR, Ensemble, Stacking');
    lines.push(`- Series: ${s.total_modelos || 333} (3 padecimientos \u00d7 37 geo \u00d7 3 sexo)`);
  }

  return lines.join('\n');
}

function answerSemanaActual(q, ent, s, d) {
  const triggers = [
    'esta semana', 'semana actual', 'semana pasada', 'semana anterior',
    'semana previa', 'casos nuevos', 'llegaron caso', 'nuevos caso',
    'ultimo dato', 'ultimos dato', 'dato reciente', 'datos reciente',
    'dato mas reciente', 'ultimo reporte', 'ultimo boletin', 'mas reciente',
  ];
  if (!any(q, triggers)) return null;

  const ult = d.boletin?.ultima_semana;
  if (!ult) return null;

  const lines = [];
  lines.push(`En la **semana ${ult.semana} de ${ult.anio}** (el dato m\u00e1s reciente del bolet\u00edn) se reportaron **${fmt(ult.total)} casos** en total.\n`);

  const porPad = ult.por_padecimiento || {};
  if (Object.keys(porPad).length) {
    lines.push('Desglose:');
    for (const [p, c] of Object.entries(porPad)) lines.push(`- **${p}**: ${fmt(c)} casos`);
  }

  return lines.join('\n');
}

function answerQueEsPadecimiento(q, ent, s, d) {
  const regexTriggers = [
    /\bque es\b/, /\bque significa\b/, /\bdime sobre\b/, /\bcuentame sobre\b/,
    /\bexplicame\b/, /\binformacion sobre\b/, /\bhablame de\b/, /\bdescribe\b/,
    /\bsintoma/, /\befecto/, /\bconsecuencia/, /\bcausa\b/, /\briesgo/,
    /\bimpacto en la salud\b/, /\bafecta\b/, /\bprovoca\b/,
    /\benfermedad\b/, /\btrastorno\b/, /padecimiento.*\bes\b/,
  ];
  if (!regexTriggers.some(r => r.test(q))) return null;

  const pad = ent.padecimiento;
  if (!pad) {
    if (any(q, ['los tres', 'los 3', 'tres padecimiento'])) {
      return ['Depresion', 'Parkinson', 'Alzheimer']
        .map(key => formatPadInfo(d.padecimiento_info?.[key], key, s))
        .filter(Boolean).join('\n\n---\n\n');
    }
    return null;
  }

  const info = d.padecimiento_info?.[pad];
  return info ? formatPadInfo(info, pad, s) : null;
}

function formatPadInfo(info, pad, s) {
  if (!info) return null;
  const lines = [
    `**${info.nombre_completo || pad} (CIE-10: ${info.cie})**\n`,
    `${info.descripcion}\n`,
    '**Efectos en la salud**:',
  ];
  for (const e of (info.efectos || [])) lines.push(`- ${e}`);
  if (info.nota_mexico) lines.push(`\n**En M\u00e9xico (IMSS)**: ${info.nota_mexico}`);

  const ps = s.por_pad?.[pad];
  if (ps) {
    lines.push('\n**Datos del proyecto EpiForecast-MX**:');
    if (ps.casos_futuro_total) lines.push(`- Pron\u00f3stico 52 semanas: ${fmt(ps.casos_futuro_total)} casos`);
    if (ps.smape_prod_mean != null) lines.push(`- SMAPE promedio: ${ps.smape_prod_mean}%`);
    if (ps.motor_ganador) lines.push(`- Motor ganador: ${ps.motor_ganador}`);
    if (ps.n) lines.push(`- Modelos de producci\u00f3n: ${ps.n}`);
  }
  lines.push('\n*Esta informaci\u00f3n es de car\u00e1cter general y no constituye consejo m\u00e9dico.*');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// BOLETIN (hist\u00f3rico) — skip si la pregunta es sobre pron\u00f3sticos futuros
// ---------------------------------------------------------------------------

function answerBoletin(q, ent, s, d) {
  const years = ent._years || [];
  const histTriggers = ['caso', 'incidencia', 'registro', 'hubo', 'reporto', 'reportaron', 'historico', 'historica', 'tendencia', 'evolucion', 'serie de tiempo', 'boletin', 'sinave', 'acumulado', 'anual', 'semanal', 'comparar ano', 'comparar anio', 'crecio', 'crecimiento', 'bajo', 'subio', 'aumento', 'disminuyo', 'maximo', 'minimo', 'pico', 'record'];
  const rankingKw = ['mas caso', 'mas incidencia', 'ranking', 'top ', 'mayor incidencia', 'mas reporta', 'menos caso', 'menor incidencia', 'que entidad', 'que estado', 'donde hay mas', 'cual tiene mas', 'estado con mas', 'estado con mayor', 'estado con menos', 'estado con menor', 'cual estado', 'cuales estado'];
  const hasYear = years.length > 0;
  const hasHist = any(q, histTriggers);
  const isRanking = any(q, rankingKw);

  if (!hasYear && !hasHist && !isRanking) return null;

  // Si la pregunta es sobre pron\u00f3sticos futuros, dejar que los handlers
  // de forecast se encarguen (answerSpecificSeries, answerPronostico, etc.)
  const futureKw = ['se espera', 'se esperan', 'pronostic', 'forecast', 'prediccion', 'predice', 'predecir', 'estima', 'estiman', 'habra', 'va a haber'];
  if (any(q, futureKw) && (ent.padecimiento || ent.estado)) return null;

  // Si tiene meses detectados y pad+estado, es pregunta de forecast
  const months = ent._months || [];
  if (months.length > 0 && ent.padecimiento) return null;

  const pad = ent.padecimiento;
  const estado = ent.estado;
  const bol = d.boletin || {};

  // Si pide ranking de modelos (no de entidades), dejar pasar a answerRanking
  if (isRanking && any(q, ['modelo', 'motor', 'mejores modelo', 'peores modelo', 'mejor modelo', 'peor modelo'])) return null;

  // Ranking de entidades
  if (isRanking) {
    const ranking = bol.ranking_entidades || [];
    if (!ranking.length) return null;

    const wantsLeast = any(q, ['menor', 'menos', 'bajo', 'baja', 'pocas', 'pocos', 'ultima', 'ultimas', 'ultimos']);
    const sorted = wantsLeast ? [...ranking].reverse() : ranking;
    const orderLabel = wantsLeast ? 'menor' : 'mayor';
    const padLabel = pad ? ` de ${pad}` : '';
    const total = ranking.reduce((sum, r) => sum + (r.casos || 0), 0);
    const lines = [`**Entidades con ${orderLabel} incidencia${padLabel}** (acumulado histórico):\n`];
    lines.push('| # | Entidad | Casos | % del total |');
    lines.push('|---|---------|------:|-------------|');
    sorted.slice(0, 15).forEach((r, i) => {
      const p = total > 0 ? ((r.casos / total) * 100).toFixed(1) : '?';
      lines.push(`| ${i + 1} | ${r.entidad} | ${fmt(r.casos)} | ${p}% |`);
    });
    if (sorted.length > 15) lines.push(`\n*... y ${sorted.length - 15} entidades más.*`);
    if (wantsLeast) {
      lines.push(`\nLas entidades con menor incidencia suelen tener menor población o menor cobertura de detección.`);
    } else {
      lines.push(`\n**Total acumulado**: ${fmt(total)} casos. Las 5 entidades principales concentran el ${total > 0 ? ((ranking.slice(0, 5).reduce((s, r) => s + (r.casos || 0), 0) / total) * 100).toFixed(1) : '?'}% del total.`);
    }
    return lines.join('\n');
  }

  // A\u00f1o + padecimiento (sin estado)
  if (hasYear && pad && !estado) {
    const anual = bol.anual_por_pad?.[pad];
    if (!anual) return null;
    const availYears = Object.keys(anual).map(Number).sort();
    const minY = availYears[0], maxY = availYears[availYears.length - 1];
    const yrStr = years.join(', ');
    const lines = [`**${pad}** (${yrStr}):\n`];
    const missing = [];
    for (const y of years) {
      const c = anual[String(y)];
      if (c != null) {
        const prev = anual[String(y - 1)];
        let change = '';
        if (prev && prev > 0) {
          const pc = ((c - prev) / prev * 100).toFixed(1);
          change = ` (${Number(pc) >= 0 ? '+' : ''}${pc}% vs ${y - 1})`;
        }
        lines.push(`- **${y}**: ${fmt(c)} casos${change}`);
      } else {
        missing.push(y);
      }
    }
    if (missing.length) {
      lines.push(`\nNo tengo datos para ${missing.length === 1 ? 'el año' : 'los años'} **${missing.join(', ')}**. El Boletín Epidemiológico SINAVE (nuestra fuente de datos) cubre de **${minY}** a **${maxY}**.`);
    }
    return lines.join('\n');
  }

  // A\u00f1o + estado
  if (hasYear && estado) {
    const estData = bol.anual_por_estado_pad?.[estado];
    if (!estData) return null;
    const yrStr = years.join(', ');
    const lines = [`**${estado}** (${yrStr}):\n`];
    const missing = [];
    if (pad) {
      const padData = estData[pad];
      if (!padData) return null;
      for (const y of years) {
        const c = padData[String(y)];
        if (c != null) lines.push(`- ${y}: ${fmt(c)} casos`);
        else missing.push(y);
      }
    } else {
      for (const [p, padData] of Object.entries(estData)) {
        lines.push(`\n**${p}**:`);
        for (const y of years) { const c = padData[String(y)]; if (c != null) lines.push(`- ${y}: ${fmt(c)} casos`); }
      }
    }
    if (missing.length) {
      lines.push(`\nNo tengo datos de ${estado} para ${missing.length === 1 ? 'el año' : 'los años'} **${missing.join(', ')}**. El Boletín Epidemiológico SINAVE cubre de **2014** a **2026**.`);
    }
    return lines.join('\n');
  }

  // A\u00f1o sin padecimiento ni estado → resumen del a\u00f1o
  if (hasYear && !pad && !estado) {
    const yrStr = years.join(', ');
    const lines = [`**Resumen epidemiol\u00f3gico ${yrStr}**:\n`];
    const anualPad = bol.anual_por_pad || {};
    const allAvailYears = Object.values(anualPad).flatMap(d => Object.keys(d).map(Number));
    const minY = Math.min(...allAvailYears);
    const maxY = Math.max(...allAvailYears);
    const missing = [];
    for (const y of years) {
      let total = 0;
      const parts = [];
      for (const [p, data] of Object.entries(anualPad)) {
        const c = data[String(y)];
        if (c != null) { total += c; parts.push(`  - ${p}: ${fmt(c)}`); }
      }
      if (parts.length > 0) {
        lines.push(`**${y}**: ${fmt(total)} casos totales`);
        lines.push(...parts);
        if (years.length > 1) lines.push('');
      } else {
        missing.push(y);
      }
    }
    if (missing.length) {
      lines.push(`\nNo tengo datos para ${missing.length === 1 ? 'el a\u00f1o' : 'los a\u00f1os'} **${missing.join(', ')}**. El Bolet\u00edn Epidemiol\u00f3gico SINAVE (nuestra fuente) cubre de **${minY}** a **${maxY}**.`);
    }
    return lines.join('\n');
  }

  // Tendencia hist\u00f3rica de un padecimiento (sin a\u00f1o espec\u00edfico, sin estado)
  if (pad && !hasYear && hasHist && !estado) {
    const anual = bol.anual_por_pad?.[pad];
    if (!anual) return null;
    const sortedYears = Object.keys(anual).sort();
    const first = sortedYears[0], last = sortedYears[sortedYears.length - 1];
    const firstC = anual[first], lastC = anual[last];

    const lines = [];
    // Lead with the trend summary
    if (firstC && lastC && firstC > 0) {
      const totalGrowth = ((lastC - firstC) / firstC * 100).toFixed(0);
      const direction = lastC > firstC ? 'crecimiento' : 'descenso';
      lines.push(`**${pad}** muestra un **${direction} del ${Math.abs(totalGrowth)}%** entre ${first} y ${last} (de ${fmt(firstC)} a ${fmt(lastC)} casos).\n`);
    } else {
      lines.push(`**${pad} \u2014 Evoluci\u00f3n hist\u00f3rica** (${first}\u2013${last}):\n`);
    }

    let prev = null, maxY = null, maxC = 0, minY = null, minC = Infinity;
    for (const y of sortedYears) {
      const c = anual[y];
      let change = '';
      if (prev != null && prev > 0) { const pc = (c - prev) / prev * 100; change = ` (${pc >= 0 ? '+' : ''}${pc.toFixed(1)}%)`; }
      lines.push(`- ${y}: ${fmt(c)} casos${change}`);
      if (c > maxC) { maxC = c; maxY = y; }
      if (c < minC) { minC = c; minY = y; }
      prev = c;
    }
    lines.push(`\n**Pico**: ${maxY} con ${fmt(maxC)} casos`);
    lines.push(`**Valle**: ${minY} con ${fmt(minC)} casos`);

    // COVID interpretation
    if (anual['2020'] && anual['2019'] && anual['2019'] > 0) {
      const covidDrop = ((anual['2020'] - anual['2019']) / anual['2019'] * 100).toFixed(1);
      if (Number(covidDrop) < -10) {
        lines.push(`\nEl impacto de la pandemia se observa en 2020 con una ca\u00edda del ${Math.abs(Number(covidDrop))}% respecto a 2019.`);
      }
    }

    return lines.join('\n');
  }

  return null;
}

// ---------------------------------------------------------------------------
// HISTORICO — prioriza años pasados sobre pronóstico
// ---------------------------------------------------------------------------

function answerHistorico(q, ent, s, d) {
  const years = ent._years || [];
  if (!years.length) return null;

  const currentYear = new Date().getFullYear();
  const pastYears = years.filter(y => y <= currentYear);
  if (!pastYears.length) return null;

  // Solo activar si hay contexto de datos historicos o grafico
  const histTriggers = ['grafico', 'grafica', 'historico', 'historica', 'como se ve',
    'datos de', 'cuantos caso', 'que paso', 'cuantos hubo', 'reportaron',
    'incidencia', 'tendencia', 'evolucion', 'chart'];
  if (!histTriggers.some(t => q.includes(t)) && !ent.padecimiento) return null;

  const bol = d.boletin || {};
  const anualNac = bol.anual_por_pad || {};
  const anualEst = bol.anual_por_estado_pad || {};
  const pad = ent.padecimiento;
  const estado = ent.estado;

  const lines = [];

  for (const year of pastYears) {
    const ys = String(year);

    // Intentar estado primero
    if (estado) {
      const estKey = Object.keys(anualEst).find(k => norm(k) === norm(estado));
      if (estKey && pad) {
        const val = anualEst[estKey]?.[pad]?.[ys];
        if (val != null) {
          lines.push(`En **${year}**, se reportaron **${fmt(val)} casos de ${pad}** en ${estKey}.`);
          // Variacion vs año anterior
          const prev = anualEst[estKey]?.[pad]?.[String(year - 1)];
          if (prev != null && prev > 0) {
            const pctChg = (((val - prev) / prev) * 100).toFixed(1);
            const arrow = pctChg > 0 ? 'aumento' : 'disminución';
            lines.push(`Esto representa un **${arrow} del ${Math.abs(pctChg)}%** respecto a ${year - 1} (${fmt(prev)} casos).`);
          }
          continue;
        }
      }
      // Estado sin datos → avisar y usar nacional
      if (pad) {
        const nacVal = anualNac[pad]?.[ys];
        if (nacVal != null) {
          lines.push(`El Boletín Epidemiológico SINAVE no incluye desglose histórico para **${estado}**. Solo ${Object.keys(anualEst).length} entidades tienen datos anuales desglosados.\n\nA nivel **nacional**, en ${year} se reportaron **${fmt(nacVal)} casos de ${pad}**.`);
          const prev = anualNac[pad]?.[String(year - 1)];
          if (prev != null && prev > 0) {
            const pctChg = (((nacVal - prev) / prev) * 100).toFixed(1);
            const arrow = pctChg > 0 ? 'aumento' : 'disminución';
            lines.push(`Variación: **${arrow} del ${Math.abs(pctChg)}%** vs ${year - 1}.`);
          }
          continue;
        }
      }
    }

    // Sin estado, datos nacionales
    if (pad) {
      const nacVal = anualNac[pad]?.[ys];
      if (nacVal != null) {
        lines.push(`En **${year}**, a nivel nacional se reportaron **${fmt(nacVal)} casos de ${pad}**.`);
        const prev = anualNac[pad]?.[String(year - 1)];
        if (prev != null && prev > 0) {
          const pctChg = (((nacVal - prev) / prev) * 100).toFixed(1);
          const arrow = pctChg > 0 ? 'aumento' : 'disminución';
          lines.push(`Variación: **${arrow} del ${Math.abs(pctChg)}%** vs ${year - 1}.`);
        }
        continue;
      }
    }

    // Sin padecimiento, resumen de todos
    if (!pad) {
      const pads = Object.keys(anualNac);
      const found = pads.filter(p => anualNac[p]?.[ys] != null);
      if (found.length) {
        lines.push(`**Incidencia nacional en ${year}:**`);
        for (const p of found) {
          lines.push(`- ${p}: **${fmt(anualNac[p][ys])} casos**`);
        }
        continue;
      }
    }

    lines.push(`No tengo datos para el año ${year}. El Boletín Epidemiológico SINAVE (nuestra fuente) cubre de 2014 a ${currentYear}.`);
  }

  if (!lines.length) return null;

  // Agregar contexto de tendencia si hay múltiples años disponibles
  if (pad && pastYears.length === 1) {
    const allYears = Object.keys(anualNac[pad] || {}).map(Number).sort();
    if (allYears.length > 3) {
      const first = anualNac[pad][String(allYears[0])];
      const last = anualNac[pad][String(allYears[allYears.length - 1])];
      if (first && last) {
        const trend = last > first ? 'creciente' : 'decreciente';
        lines.push(`\nLa tendencia general de ${pad} entre ${allYears[0]} y ${allYears[allYears.length - 1]} es **${trend}**.`);
      }
    }
  }

  // Si pidieron desglose semanal, avisar que no tenemos esa granularidad histórica
  if (any(q, ['por semana', 'semanal', 'semana a semana', 'cada semana', 'desglose semanal'])) {
    lines.push('\n**Nota:** los datos históricos del boletín están disponibles solo como acumulado anual. No contamos con desglose semanal por entidad para años anteriores.');
  }

  return lines.join('\n');
}  // answerHistorico

// ---------------------------------------------------------------------------
// SERIES ESPEC\u00cdFICAS (pad + estado) — respuesta directa e inteligente
// ---------------------------------------------------------------------------

function answerSpecificSeries(q, ent, s, d) {
  const pad = ent.padecimiento, estado = ent.estado;
  if (!pad || !estado) return null;

  const models = d.prod_models || [];
  const matches = models.filter(m =>
    m.padecimiento === pad && norm(m.entidad || '') === norm(estado)
  );
  if (!matches.length) return null;

  const sexo = ent.sexo;
  const gen = matches.find(m => m.sexo === 'general') || matches[0];
  const specific = sexo ? matches.find(m => m.sexo === sexo) : null;
  const primary = specific || gen;
  const total = primary.casos_52_semanas_futuro;
  const conf = confidence(primary.smape_prod);
  const months = ent._months || [];
  const years = ent._years || [];

  const lines = [];

  // Si pregunta por un mes espec\u00edfico → respuesta directa con estimaci\u00f3n
  if (months.length > 0) {
    const mText = monthEstimateText(total, months, years, pad, estado, d);
    if (mText) lines.push(mText);
    lines.push(`\nModelo: **${primary.modelo_produccion}** | Confianza: **${conf}** (SMAPE: ${primary.smape_prod}%)`);
    if (primary.precision_historica) lines.push(`Precisi\u00f3n hist\u00f3rica: **${primary.precision_historica}**`);
  } else {
    // Respuesta directa del pron\u00f3stico
    const sexoLabel = specific ? ` (${sexo})` : '';
    lines.push(
      `Se pronostican **${fmt(total)} casos de ${pad} en ${estado}${sexoLabel}** ` +
      `para las pr\u00f3ximas 52 semanas (confianza: **${conf}**).\n`
    );
    lines.push(`Modelo de producci\u00f3n: **${primary.modelo_produccion}** (SMAPE: ${primary.smape_prod}%` +
      (primary.precision_historica ? `, precisi\u00f3n hist\u00f3rica: ${primary.precision_historica}` : '') + ')');
  }

  // Tabla de desglose por sexo (solo si no pide sexo espec\u00edfico y hay varias series)
  if (!sexo && matches.length > 1) {
    lines.push('\n| Grupo | Pron\u00f3stico 52 sem | Motor | Confianza |');
    lines.push('|-------|-------------------|-------|-----------|');
    for (const m of matches) {
      const label = m.sexo === 'general' ? 'General' :
                    m.sexo === 'hombres' ? 'Hombres' : 'Mujeres';
      lines.push(`| ${label} | ${fmt(m.casos_52_semanas_futuro)} casos | ${m.modelo_produccion} | ${confidence(m.smape_prod)} (${m.smape_prod}%) |`);
    }

    // Si pregunt\u00f3 por mes, agregar columna de estimaci\u00f3n mensual
    if (months.length > 0) {
      const mName = MONTH_NAMES[months[0] - 1];
      lines.push(`\n**Estimaci\u00f3n para ${mName}:**`);
      for (const m of matches) {
        const est = estimateMonthly(m.casos_52_semanas_futuro, months[0]);
        const label = m.sexo === 'general' ? 'General' :
                      m.sexo === 'hombres' ? 'Hombres' : 'Mujeres';
        lines.push(`- ${label}: ~${fmt(est)} casos`);
      }
    }
  }

  // Contexto hist\u00f3rico
  const hist = getHistContext(d, pad, estado);
  if (hist) lines.push(`\n**Contexto hist\u00f3rico**: ${hist}`);

  // Posici\u00f3n en ranking de precisi\u00f3n
  const rank = findRank(models, pad, estado);
  if (rank) {
    lines.push(`\n${estado} ocupa la **posici\u00f3n #${rank.rank} de ${rank.total}** entidades en precisi\u00f3n de pron\u00f3stico para ${pad} (ordenado por SMAPE, menor es mejor).`);
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// COMPARATIVA DE ESTADOS — tabla + gráfico lado a lado
// ---------------------------------------------------------------------------

function answerComparativaEstados(q, ent, s, d) {
  const estados = ent._estados;
  if (!estados || estados.length < 2) return null;

  const compTriggers = ['compara', 'comparar', 'comparativ', 'diferencia', 'contrasta',
    ' vs ', 'versus', 'contra ', 'frente a'];
  // Also trigger if 2+ states detected with connectors
  const hasConnector = q.includes(' y ') || q.includes(' vs ') || q.includes(' con ');
  if (!any(q, compTriggers) && !hasConnector) return null;

  const models = d.prod_models || [];
  const pad = ent.padecimiento;
  const bol = d.boletin || {};
  const anualNac = bol.anual_por_pad || {};
  const anualEst = bol.anual_por_estado_pad || {};
  const years = ent._years || [];

  const lines = [];
  const padLabel = pad ? ` — ${pad}` : '';
  lines.push(`**Comparativa de ${estados.length} entidades${padLabel}**\n`);

  // Build comparison data per state
  const comparisons = [];
  for (const estado of estados) {
    const estModels = models.filter(m =>
      norm(m.entidad || '') === norm(estado) && m.sexo === 'general' &&
      (!pad || m.padecimiento === pad)
    );
    const estStats = s.por_estado?.[estado] || {};
    const totalCasos = estModels.reduce((sum, m) => sum + (m.casos_52_semanas_futuro || 0), 0);
    const smapeVals = estModels.filter(m => m.smape_prod != null).map(m => m.smape_prod);
    const avgSmape = smapeVals.length ? (smapeVals.reduce((a, b) => a + b, 0) / smapeVals.length).toFixed(1) : null;
    const motors = {};
    estModels.forEach(m => { motors[m.modelo_produccion] = (motors[m.modelo_produccion] || 0) + 1; });
    const topMotor = Object.entries(motors).sort((a, b) => b[1] - a[1])[0];

    // Historical data
    let histTotal = null;
    if (years.length) {
      const yr = String(years[0]);
      if (pad) {
        histTotal = anualEst[estado]?.[pad]?.[yr] ?? anualNac[pad]?.[yr];
      } else {
        const pads = Object.keys(anualEst[estado] || anualNac);
        histTotal = 0;
        for (const p of pads) {
          histTotal += (anualEst[estado]?.[p]?.[yr] ?? 0);
        }
        if (histTotal === 0) histTotal = null;
      }
    }

    comparisons.push({
      estado, totalCasos, avgSmape, topMotor, histTotal,
      nModelos: estModels.length,
      models: estModels,
    });
  }

  // Table header
  if (pad) {
    lines.push('| Entidad | Pronóstico 52 sem | SMAPE | Motor | Confianza |');
    lines.push('|---------|------------------:|------:|-------|-----------|');
    for (const c of comparisons) {
      const conf = c.avgSmape != null ? confidence(Number(c.avgSmape)) : '—';
      lines.push(`| **${c.estado}** | ${fmt(c.totalCasos)} casos | ${c.avgSmape ?? '—'}% | ${c.topMotor ? c.topMotor[0] : '—'} | ${conf} |`);
    }
  } else {
    lines.push('| Entidad | Pronóstico total | Modelos | SMAPE prom. | Motor principal |');
    lines.push('|---------|-----------------:|:-------:|------------:|-----------------|');
    for (const c of comparisons) {
      lines.push(`| **${c.estado}** | ${fmt(c.totalCasos)} casos | ${c.nModelos} | ${c.avgSmape ?? '—'}% | ${c.topMotor ? c.topMotor[0] : '—'} |`);
    }
  }

  // Historical comparison if years requested
  if (years.length && comparisons.some(c => c.histTotal != null)) {
    lines.push(`\n**Datos históricos (${years[0]}):**`);
    for (const c of comparisons) {
      if (c.histTotal != null) {
        lines.push(`- ${c.estado}: **${fmt(c.histTotal)} casos** registrados`);
      } else {
        lines.push(`- ${c.estado}: sin datos para ${years[0]}`);
      }
    }
  }

  // Insights
  lines.push('\n**Hallazgos:**');
  const sorted = [...comparisons].sort((a, b) => b.totalCasos - a.totalCasos);
  lines.push(`- Mayor incidencia pronosticada: **${sorted[0].estado}** (${fmt(sorted[0].totalCasos)} casos)`);
  lines.push(`- Menor incidencia pronosticada: **${sorted[sorted.length - 1].estado}** (${fmt(sorted[sorted.length - 1].totalCasos)} casos)`);

  if (sorted[0].totalCasos > 0 && sorted[sorted.length - 1].totalCasos > 0) {
    const ratio = (sorted[0].totalCasos / sorted[sorted.length - 1].totalCasos).toFixed(1);
    lines.push(`- Ratio: ${sorted[0].estado} tiene **${ratio}x** más casos que ${sorted[sorted.length - 1].estado}`);
  }

  const bestSmape = [...comparisons].filter(c => c.avgSmape != null).sort((a, b) => a.avgSmape - b.avgSmape);
  if (bestSmape.length) {
    lines.push(`- Mejor precisión: **${bestSmape[0].estado}** (SMAPE ${bestSmape[0].avgSmape}%)`);
  }

  // Store chart data for extractChartData to pick up
  lines.push(`\n<!--COMPARE:${JSON.stringify(comparisons.map(c => ({ estado: c.estado, total: c.totalCasos, smape: c.avgSmape, models: c.models.map(m => ({ pad: m.padecimiento, casos: m.casos_52_semanas_futuro, smape: m.smape_prod })) })))}-->`);

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// ESTADO (sin padecimiento espec\u00edfico) — resumen conversacional
// ---------------------------------------------------------------------------

function answerEstado(q, ent, s, d) {
  const estado = ent.estado;
  if (!estado || ent.padecimiento) return null;

  const estStats = s.por_estado?.[estado];
  if (!estStats) return null;

  const months = ent._months || [];
  const years = ent._years || [];
  const lines = [];

  // Lead con hallazgo principal
  if (estStats.casos_futuro != null) {
    lines.push(
      `**${estado}** tiene un pron\u00f3stico de **${fmt(estStats.casos_futuro)} casos totales** ` +
      `para las pr\u00f3ximas 52 semanas (${estStats.n || '?'} modelos de producci\u00f3n).\n`
    );
  } else {
    lines.push(`**${estado}** cuenta con **${estStats.n || '?'} modelos** de producci\u00f3n.\n`);
  }

  // Estimaci\u00f3n mensual
  if (months.length > 0 && estStats.casos_futuro) {
    const mText = monthEstimateText(estStats.casos_futuro, months, years, null, estado, d);
    if (mText) lines.push(mText + '\n');
  }

  // Confianza
  if (estStats.smape_prod_mean != null) {
    const conf = confidence(estStats.smape_prod_mean);
    lines.push(`Confianza general: **${conf}** (SMAPE promedio: ${estStats.smape_prod_mean}%)`);
  }

  // Desglose por padecimiento (solo general)
  const models = d.prod_models || [];
  const estModels = models.filter(m => norm(m.entidad || '') === norm(estado) && m.sexo === 'general');
  if (estModels.length) {
    lines.push('\n| Padecimiento | Pron\u00f3stico 52 sem | Motor | SMAPE |');
    lines.push('|-------------|-------------------|-------|-------|');
    for (const m of estModels) {
      lines.push(`| ${m.padecimiento} | ${fmt(m.casos_52_semanas_futuro)} casos | ${m.modelo_produccion} | ${m.smape_prod}% |`);
    }
  }

  // Motor dominante
  const dist = estStats.dist_motor;
  if (dist) {
    const dominant = Object.entries(dist).sort((a, b) => b[1] - a[1])[0];
    if (dominant) lines.push(`\nMotor dominante: **${dominant[0]}** (${dominant[1]} de ${estStats.n} series)`);
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// PADECIMIENTO (sin estado) — resumen inteligente
// ---------------------------------------------------------------------------

function answerPadecimiento(q, ent, s, d) {
  const pad = ent.padecimiento;
  if (!pad || ent.estado) return null;

  const ps = s.por_pad?.[pad];
  if (!ps) return null;

  const months = ent._months || [];
  const years = ent._years || [];
  const lines = [];

  // Detectar si pregunta por ranking de entidades
  const wantsRanking = any(q, [
    'mayor', 'mas', 'donde hay', 'cual ciudad', 'cual estado', 'cual entidad',
    'que ciudad', 'que estado', 'que entidad', 'donde se', 'mayor incidencia',
    'mayor indice', 'mas casos', 'mas incidencia', 'primer lugar', 'ranking',
    'top', 'menor', 'menos casos',
  ]);

  if (wantsRanking) {
    const models = d.prod_models || [];
    const isLeast = any(q, ['menor', 'menos', 'bajo', 'pocas']);
    const padModels = models
      .filter(m => m.padecimiento === pad && m.sexo === 'general' &&
        !String(m.entidad || '').startsWith('region_') && m.entidad !== 'Nacional')
      .sort((a, b) => isLeast
        ? (a.casos_52_semanas_futuro || 0) - (b.casos_52_semanas_futuro || 0)
        : (b.casos_52_semanas_futuro || 0) - (a.casos_52_semanas_futuro || 0));

    if (padModels.length) {
      const label = isLeast ? 'menor' : 'mayor';
      lines.push(`**Entidades con ${label} pronóstico de ${pad}** (52 semanas):\n`);
      lines.push('| # | Entidad | Casos pronosticados | Motor | SMAPE |');
      lines.push('|---|---------|--------------------:|-------|-------|');
      const top10 = padModels.slice(0, 10);
      top10.forEach((m, i) => {
        lines.push(`| ${i + 1} | ${m.entidad} | ${fmt(m.casos_52_semanas_futuro)} | ${m.modelo_produccion} | ${m.smape_prod}% |`);
      });

      const first = padModels[0];
      const total = ps.casos_futuro_total || 0;
      const pctFirst = total > 0 ? ((first.casos_52_semanas_futuro / total) * 100).toFixed(1) : '?';
      lines.push(`\n**${first.entidad}** concentra el **${pctFirst}%** del pronóstico nacional de ${pad} con **${fmt(first.casos_52_semanas_futuro)} casos**.`);

      return lines.join('\n');
    }
  }

  // Lead con hallazgo principal
  if (ps.casos_futuro_total) {
    lines.push(
      `Se pronostican **${fmt(ps.casos_futuro_total)} casos de ${pad}** a nivel nacional ` +
      `en las próximas 52 semanas (${ps.n} modelos).\n`
    );
  } else {
    lines.push(`**${pad}**: ${ps.n} modelos de producción.\n`);
  }

  // Estimacion mensual
  if (months.length > 0 && ps.casos_futuro_total) {
    const mText = monthEstimateText(ps.casos_futuro_total, months, years, pad, null, d);
    if (mText) lines.push(mText + '\n');
  }

  // Rendimiento
  if (ps.smape_prod_mean != null) {
    lines.push(`Rendimiento: SMAPE promedio **${ps.smape_prod_mean}%** (mediana: ${ps.smape_prod_median}%) — confianza **${confidence(ps.smape_prod_median)}**`);
  }
  if (ps.motor_ganador) {
    lines.push(`Motor ganador: **${ps.motor_ganador}** (${ps.motor_ganador_n} de ${ps.n} series, ${((ps.motor_ganador_n / ps.n) * 100).toFixed(0)}%)`);
  }

  // Distribucion de motores
  const dist = ps.dist_motor;
  if (dist) {
    lines.push('\n**Distribución de motores:**');
    for (const [motor, n] of Object.entries(dist)) {
      lines.push(`- ${motor}: ${n} series (${((n / ps.n) * 100).toFixed(1)}%)`);
    }
  }

  // Distribucion por sexo (si se pide o siempre como dato complementario)
  const wantsSex = any(q, ['sexo', 'genero', 'hombre', 'mujer', 'distribucion']);
  const psx = ps.por_sexo || {};
  if (wantsSex && Object.keys(psx).length) {
    lines.push('\n**Distribución por sexo:**\n');
    lines.push('| Sexo | Modelos | Casos pronosticados | SMAPE promedio | SMAPE mediana |');
    lines.push('|------|--------:|--------------------:|---------------:|--------------:|');
    for (const [sx, info] of Object.entries(psx)) {
      const label = sx === 'general' ? 'General' : sx === 'hombres' ? 'Hombres' : 'Mujeres';
      lines.push(`| ${label} | ${info.n} | ${fmt(info.casos_total)} | ${info.smape_prod_mean}% | ${info.smape_prod_median}% |`);
    }
    // Insight
    const h = psx.hombres, m = psx.mujeres;
    if (h && m) {
      const totalHM = (h.casos_total || 0) + (m.casos_total || 0);
      if (totalHM > 0) {
        const pctM = ((m.casos_total / totalHM) * 100).toFixed(1);
        const pctH = ((h.casos_total / totalHM) * 100).toFixed(1);
        const dominant = m.casos_total > h.casos_total ? 'mujeres' : 'hombres';
        const pctDom = m.casos_total > h.casos_total ? pctM : pctH;
        lines.push(`\nEl **${pctDom}%** de los casos pronosticados de ${pad} corresponden a **${dominant}**.`);
      }
    }
  }

  // Contexto historico
  const hist = getHistContext(d, pad, null);
  if (hist) lines.push(`\n**Contexto histórico**: ${hist}`);

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// MOTOR — con recomendaci\u00f3n
// ---------------------------------------------------------------------------

function answerMotor(q, ent, s, d) {
  const motorTriggers = ['modelo', 'motor', 'gana', 'ganador', 'cual gana', 'que modelo'];
  if (!any(q, motorTriggers) && !ent.modelo) return null;

  // "que es [motor]" → ceder a Gemini para explicacion conceptual + datos
  const conceptual = any(q, ['que es', 'como funciona', 'explicame', 'explicar', 'describe']);
  if (conceptual && ent.modelo) return null;

  const motor = ent.modelo;
  if (motor) {
    const ms = s.por_motor?.[motor];
    if (!ms) return null;
    const n = s.dist_motor?.[motor] || 0;
    const total = s.total_modelos || 333;
    const pctWin = ((n / total) * 100).toFixed(1);
    const isWinner = motor === s.motor_ganador;

    const lines = [
      `**${motor}** gana **${n} de ${total} series** (${pctWin}%)${isWinner ? ' \u2014 es el **motor ganador** global.' : '.'}\n`,
    ];

    lines.push('| M\u00e9trica | Promedio | Mediana |');
    lines.push('|---------|---------|---------|');
    if (ms.smape_mean != null) lines.push(`| SMAPE | ${ms.smape_mean}% | ${ms.smape_median}% |`);
    if (ms.mase_mean != null) lines.push(`| MASE | ${ms.mase_mean} | ${ms.mase_median} |`);
    if (ms.rmse_mean != null) lines.push(`| RMSE | ${ms.rmse_mean} | - |`);
    if (ms.mae_mean != null) lines.push(`| MAE | ${ms.mae_mean} | - |`);

    return lines.join('\n');
  }

  if (any(q, ['gana', 'ganador', 'cual gana', 'que modelo', 'comparar modelo', 'comparativa'])) {
    const pm = s.por_motor || {};
    const sorted = Object.entries(pm).sort((a, b) => (a[1].smape_mean || 999) - (b[1].smape_mean || 999));

    const lines = [
      `**${s.motor_ganador}** es el motor m\u00e1s utilizado, ganando **${s.motor_ganador_n} de ${s.total_modelos || 333} series** (${s.motor_ganador_pct}%).\n`,
    ];

    lines.push('| Motor | SMAPE medio | MASE medio | Series ganadas |');
    lines.push('|-------|------------|------------|----------------|');
    for (const [name, ms] of sorted) {
      const n = s.dist_motor?.[name] || 0;
      lines.push(`| ${name} | ${ms.smape_mean}% | ${ms.mase_mean} | ${n} |`);
    }

    const best = sorted[0];
    if (best) {
      lines.push(
        `\nEl sistema selecciona autom\u00e1ticamente el mejor motor para cada combinaci\u00f3n ` +
        `padecimiento/entidad/sexo. Aunque **${best[0]}** tiene el menor SMAPE promedio (${best[1].smape_mean}%), ` +
        `el motor \u00f3ptimo var\u00eda por serie.`
      );
    }

    return lines.join('\n');
  }

  return null;
}

function answerDemografica(q, ent, s, d) {
  const triggers = ['composicion demografica', 'distribucion por sexo', 'composicion por sexo', 'ratio hombre', 'ratio mujer', 'proporcion hombre', 'proporcion mujer'];
  if (!any(q, triggers)) return null;

  const demo = s.demo_historica;
  if (!demo) return null;

  const lines = ['**Composici\u00f3n demogr\u00e1fica hist\u00f3rica (bolet\u00edn)**\n'];
  for (const [pad, data] of Object.entries(demo)) {
    lines.push(`**${pad}**:`);
    lines.push(`- Hombres: ${fmt(data.hombres)} (${data.pct_h}%)`);
    lines.push(`- Mujeres: ${fmt(data.mujeres)} (${data.pct_m}%)`);
    lines.push(`- Total: ${fmt(data.total)}`);
    lines.push(`- Ratio M/H: ${data.ratio_mh}`);
    lines.push('');
  }
  return lines.join('\n');
}

function answerSexo(q, ent, s, d) {
  const triggers = ['sexo', 'genero', 'hombre', 'mujer'];
  if (!any(q, triggers)) return null;
  if (any(q, ['composicion demografica', 'distribucion por sexo'])) return null;

  const ps = s.por_sexo || {};
  if (!Object.keys(ps).length) return null;

  const lines = ['**An\u00e1lisis por sexo**\n'];
  for (const [sx, data] of Object.entries(ps)) {
    lines.push(`**${sx}** (${data.n} modelos):`);
    if (data.smape_mean != null) lines.push(`- SMAPE promedio: ${data.smape_mean}% (mediana: ${data.smape_median}%)`);
    if (data.mase_mean != null) lines.push(`- MASE promedio: ${data.mase_mean}`);
    lines.push('');
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// M\u00c9TRICAS GLOBALES — con interpretaci\u00f3n
// ---------------------------------------------------------------------------

function answerMetricaGlobal(q, ent, s, d) {
  const triggers = ['metrica', 'smape', 'mase', 'rmse', 'mae', 'rendimiento', 'performance', 'desempeno', 'error promedio'];
  if (!any(q, triggers)) return null;
  if (ent.padecimiento || ent.estado || ent.modelo) return null;

  const conf = confidence(s.smape_prod_median);
  const lines = [
    `Los **${s.total_modelos || 333} modelos** de producci\u00f3n tienen confianza **${conf}** ` +
    `(SMAPE mediano: **${s.smape_prod_median}%**).\n`,
  ];

  lines.push('| M\u00e9trica | Promedio | Mediana | M\u00edn | M\u00e1x |');
  lines.push('|---------|---------|---------|-----|-----|');
  for (const [name, prefix] of [['SMAPE', 'smape_prod'], ['MASE', 'mase_prod'], ['RMSE', 'rmse_prod'], ['MAE', 'mae_prod']]) {
    const mean = s[`${prefix}_mean`], median = s[`${prefix}_median`], min = s[`${prefix}_min`], max = s[`${prefix}_max`];
    if (mean != null) lines.push(`| ${name} | ${mean} | ${median} | ${min} | ${max} |`);
  }

  lines.push(`\nMotor ganador: **${s.motor_ganador}** (${s.motor_ganador_pct}% de las series)`);

  // Interpretaci\u00f3n
  if (s.smape_prod_median < 25) {
    lines.push('\nLa mediana de SMAPE por debajo de 25% indica que la **mayor\u00eda de los modelos tienen buen rendimiento predictivo**. Las series con mayor error suelen corresponder a padecimientos con baja incidencia (e.g., Alzheimer en estados peque\u00f1os).');
  } else if (s.smape_prod_median < 50) {
    lines.push('\nLa mediana de SMAPE entre 25-50% indica rendimiento **moderado** en la mayor\u00eda de las series.');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// RANKING — con insight
// ---------------------------------------------------------------------------

function answerRanking(q, ent, s, d) {
  const triggers = ['mejor', 'peor', 'top', 'ranking', 'mejores modelo', 'peores modelo',
    'mas preciso', 'mas precisos', 'mayor precision', 'menor error'];
  if (!any(q, triggers)) return null;

  const lines = [];
  // Filtrar series triviales (SMAPE ~0% = incidencia cercana a cero, no precision real)
  const top = (s.top5_smape || []).filter(m => m.smape > 0.5);
  if (top.length) {
    lines.push('**Los modelos más precisos** (menor error, excluyendo series con ~0 casos):\n');
    lines.push('| # | Serie | SMAPE | Motor |');
    lines.push('|---|-------|-------|-------|');
    top.forEach((m, i) => {
      lines.push(`| ${i + 1} | ${m.padecimiento} — ${m.entidad} (${m.sexo}) | ${m.smape}% | ${m.motor} |`);
    });
  }
  const bottom = s.bottom5_smape || [];
  if (bottom.length) {
    lines.push('\n**Los 5 modelos con mayor error** (requieren atención):\n');
    lines.push('| # | Serie | SMAPE | Motor |');
    lines.push('|---|-------|-------|-------|');
    bottom.forEach((m, i) => {
      lines.push(`| ${i + 1} | ${m.padecimiento} — ${m.entidad} (${m.sexo}) | ${m.smape}% | ${m.motor} |`);
    });
  }

  // Insight
  if (top.length && bottom.length) {
    lines.push(
      `\nLos mejores modelos con casos reales alcanzan SMAPE de **${top[0].smape}%** mientras los más difíciles llegan a **${bottom[bottom.length - 1].smape}%**. ` +
      `Las series con mayor error suelen corresponder a Alzheimer en estados con muy baja incidencia, donde pequeñas variaciones generan errores porcentuales altos.`
    );
  }
  lines.push('\n*Nota: Series con SMAPE=0% (ej. Alzheimer en BCS) corresponden a entidades con incidencia cercana a cero — no representan precisión excepcional sino predicciones triviales.*');

  return lines.length ? lines.join('\n') : null;
}

// ---------------------------------------------------------------------------
// DIAGN\u00d3STICOS — con interpretaci\u00f3n
// ---------------------------------------------------------------------------

function answerDiagnosticos(q, ent, s, d) {
  const triggers = ['overfitting', 'leakage', 'fallback', 'diagnostico', 'calidad de modelo', 'problema'];
  if (!any(q, triggers)) return null;

  const total = s.total_modelos || 333;
  const okPct = s.overfitting_ok != null ? ((s.overfitting_ok / total) * 100).toFixed(1) : null;

  const lines = [];

  // Lead con resumen
  if (okPct) {
    lines.push(`**${okPct}% de los modelos** (${s.overfitting_ok} de ${total}) pasan los diagn\u00f3sticos de calidad sin alertas.\n`);
  }

  if (s.overfitting_ok != null) {
    lines.push('**Overfitting** (ratio smape_test / smape_train):');
    lines.push(`- OK: **${s.overfitting_ok}**`);
    if (s.overfitting_moderado) lines.push(`- Moderado (>1.3\u00d7): **${s.overfitting_moderado}**`);
    if (s.overfitting_alto) lines.push(`- Alto (>2\u00d7): **${s.overfitting_alto}**`);
    lines.push('');
  }
  if (s.leakage_ok != null) {
    lines.push('**Leakage** (smape_train < 0.5%):');
    lines.push(`- OK: **${s.leakage_ok}**`);
    if (s.leakage_sospechoso) lines.push(`- Sospechoso: **${s.leakage_sospechoso}**`);
    lines.push('');
  }
  if (s.fallback_n != null) {
    lines.push(`**Fallback regional**: ${s.fallback_n} series (${((s.fallback_n / total) * 100).toFixed(1)}%) usan modelo regional por incidencia insuficiente.`);
    const detalles = s.fallback_detalles || [];
    if (detalles.length) {
      for (const det of detalles.slice(0, 5)) lines.push(`  - ${det}`);
      if (detalles.length > 5) lines.push(`  ... y ${detalles.length - 5} m\u00e1s`);
    }
  }

  // Interpretaci\u00f3n global
  const alertas = (s.overfitting_moderado || 0) + (s.overfitting_alto || 0) + (s.leakage_sospechoso || 0);
  if (alertas <= 5) {
    lines.push('\nEn general, los modelos muestran **buena salud diagn\u00f3stica** con m\u00ednimos casos de alerta.');
  } else if (alertas <= 20) {
    lines.push('\nHay algunas alertas menores que conviene monitorear, pero la mayor\u00eda de los modelos est\u00e1n en buen estado.');
  }

  return lines.join('\n');
}

function answerValidacion(q, ent, s, d) {
  const triggers = ['validacion', 'semanal', 'real vs', 'precision historica', 'acertamos', 'que tan preciso', 'precision del modelo'];
  if (!any(q, triggers)) return null;

  const lines = [];

  if (s.precision_historica_mean != null) {
    lines.push(`La precisi\u00f3n hist\u00f3rica promedio de los modelos es de **${s.precision_historica_mean}%** (mediana: ${s.precision_historica_median}%).\n`);
  }

  const val = s.validacion_semanal;
  if (val) {
    lines.push('**Validaci\u00f3n semanal** (pron\u00f3stico vs realidad en la \u00faltima semana disponible):');
    lines.push(`- Error absoluto medio: **${val.error_abs_medio}** casos`);
    lines.push(`- Error absoluto mediano: **${val.error_abs_mediano}** casos`);
    lines.push('');
  }

  if (s.precision_historica_mean != null && !val) {
    lines.push('**Precisi\u00f3n hist\u00f3rica** (52 semanas previas):');
    lines.push(`- Promedio: ${s.precision_historica_mean}%`);
    lines.push(`- Mediana: ${s.precision_historica_median}%`);
  }

  if (!lines.length) return null;

  // Interpretaci\u00f3n
  if (s.precision_historica_mean != null && s.precision_historica_mean > 85) {
    lines.push('\nLa precisi\u00f3n hist\u00f3rica superior al 85% indica que los modelos **replican adecuadamente** los patrones observados en las 52 semanas previas.');
  }

  return lines.join('\n');
}

function answerInfra(q, ent, s, d) {
  const triggers = ['tests', 'test unitario', 'codigo fuente', 'cobertura', 'infraestructura', 'github', 'ci cd', 'ci/cd', 'sagemaker', 'aws', 'costo', 'pipeline', 'mlops', 'lineas de codigo'];
  if (!any(q, triggers)) return null;

  const infra = d.infra || {};
  const lines = ['**Infraestructura del proyecto**\n'];
  lines.push(`- Tests: **${infra.tests || 849}** en ${infra.archivos_test || 46} archivos`);
  lines.push(`- L\u00edneas de c\u00f3digo: ~${fmt(infra.lineas_codigo || 13000)}`);
  lines.push(`- Cobertura: >${infra.cobertura || 92}%`);
  lines.push(`- CI/CD: ${infra.ci_cd || 'GitHub Actions (lint + typecheck + tests)'}`);
  lines.push(`- SageMaker: ${infra.sagemaker || 'ml.g4dn.xlarge (NVIDIA T4)'}`);
  lines.push(`- S3: ${infra.bucket_s3 || 's3://epiforecast-mx-data'}`);
  lines.push(`- Evaluaciones totales: ${fmt(infra.evaluaciones_totales || 1332)}`);
  return lines.join('\n');
}

function answerConteo(q, ent, s, d) {
  const triggers = ['cuantos', 'cuantas', 'total de modelo', 'numero de modelo', 'cantidad de modelo'];
  if (!any(q, triggers)) return null;

  // Si tiene pad+estado o meses, dejar que otros handlers se encarguen
  if ((ent.padecimiento && ent.estado) || (ent._months || []).length > 0) return null;

  const pad = ent.padecimiento, estado = ent.estado;
  const lines = [];

  if (pad) {
    const ps = s.por_pad?.[pad];
    if (ps) {
      lines.push(`**${pad}** tiene **${ps.n} modelos** de producci\u00f3n.`);
      const dist = ps.dist_motor;
      if (dist) {
        lines.push('\nDistribuci\u00f3n por motor:');
        for (const [motor, n] of Object.entries(dist)) lines.push(`- ${motor}: ${n} (${((n / ps.n) * 100).toFixed(1)}%)`);
      }
    }
  } else if (estado) {
    const es = s.por_estado?.[estado];
    if (es) lines.push(`**${estado}** tiene **${es.n} modelos** de producci\u00f3n.`);
  } else {
    lines.push(`**${s.total_modelos || 333} modelos** en producci\u00f3n total.`);
    const dist = s.dist_motor || {};
    lines.push('\nDistribuci\u00f3n por motor:');
    for (const [motor, n] of Object.entries(dist)) lines.push(`- ${motor}: ${n} (${((n / (s.total_modelos || 333)) * 100).toFixed(1)}%)`);
  }
  return lines.length ? lines.join('\n') : null;
}

// ---------------------------------------------------------------------------
// PRON\u00d3STICO — con estimaci\u00f3n mensual
// ---------------------------------------------------------------------------

function answerPronostico(q, ent, s, d) {
  const triggers = [
    'pronostico', 'casos futuro', 'futuro 52', '52 semanas', 'proximas', 'forecast',
    'prediccion total', 'casos esperado', 'se esperan', 'se espera',
    'se pronostica', 'se estima', 'se estiman', 'habra', 'va a haber',
  ];
  if (!any(q, triggers)) return null;

  // Si tiene pad+estado, dejar que answerSpecificSeries se encargue
  if (ent.padecimiento && ent.estado) return null;

  const pad = ent.padecimiento, estado = ent.estado;
  const months = ent._months || [];
  const years = ent._years || [];
  const lines = [];

  if (pad && !estado) {
    const ps = s.por_pad?.[pad];
    if (!ps?.casos_futuro_total) return null;

    lines.push(
      `Se pronostican **${fmt(ps.casos_futuro_total)} casos de ${pad}** a nivel nacional ` +
      `en las pr\u00f3ximas 52 semanas.\n`
    );

    if (months.length) {
      const mText = monthEstimateText(ps.casos_futuro_total, months, years, pad, null, d);
      if (mText) lines.push(mText);
    }

    if (ps.motor_ganador) {
      lines.push(`\nMotor ganador: **${ps.motor_ganador}** | Confianza: **${confidence(ps.smape_prod_median)}** (SMAPE mediano: ${ps.smape_prod_median}%)`);
    }

    const hist = getHistContext(d, pad, null);
    if (hist) lines.push(`\n**Contexto**: ${hist}`);

  } else if (estado && !pad) {
    const es = s.por_estado?.[estado];
    if (!es?.casos_futuro) return null;

    lines.push(
      `Se pronostican **${fmt(es.casos_futuro)} casos totales en ${estado}** ` +
      `para las pr\u00f3ximas 52 semanas.\n`
    );

    if (months.length) {
      const mText = monthEstimateText(es.casos_futuro, months, years, null, estado, d);
      if (mText) lines.push(mText);
    }

  } else {
    // Pron\u00f3stico global
    lines.push(`**Pron\u00f3stico total**: **${fmt(s.pronostico_total)} casos** en las pr\u00f3ximas 52 semanas.\n`);

    if (months.length) {
      const mText = monthEstimateText(s.pronostico_total, months, years, null, null, d);
      if (mText) lines.push(mText + '\n');
    }

    const pp = s.por_pad || {};
    lines.push('| Padecimiento | Pron\u00f3stico 52 sem | Motor ganador |');
    lines.push('|-------------|-------------------|---------------|');
    for (const [p, ps] of Object.entries(pp)) {
      if (ps.casos_futuro_total) {
        lines.push(`| ${p} | ${fmt(ps.casos_futuro_total)} casos | ${ps.motor_ganador || '-'} |`);
      }
    }
  }

  return lines.length ? lines.join('\n') : null;
}

function answerDefinicion(q, ent, s, d) {
  const triggers = ['que significa', 'definicion', 'cie', 'codigo', 'que quiere decir', 'como se define', 'a que se refiere'];
  if (!any(q, triggers)) return null;

  const defs = d.definiciones || {};
  const lines = [];
  for (const [term, def] of Object.entries(defs)) {
    if (q.includes(norm(term))) lines.push(`**${term}**: ${def}`);
  }
  if (!lines.length) {
    lines.push('**Definiciones del proyecto**\n');
    for (const [term, def] of Object.entries(defs)) lines.push(`- **${term}**: ${def}`);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Correcci\u00f3n fuzzy (Levenshtein) para typos
// ---------------------------------------------------------------------------

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = [];
  for (let i = 0; i <= m; i++) { dp[i] = [i]; }
  for (let j = 1; j <= n; j++) { dp[0][j] = j; }
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] !== b[j - 1] ? 1 : 0)
      );
    }
  }
  return dp[m][n];
}

/** Vocabulario conocido del proyecto: palabras clave que los handlers reconocen. */
const VOCAB = [
  'hola','buenos','dias','tardes','noches','saludos',
  'metricas','metrica','smape','mase','rmse','mae','rendimiento',
  'ranking','mejores','peores','modelos','modelo','motor','comparativa',
  'diagnosticos','diagnostico','overfitting','leakage','calidad',
  'pronostico','pronosticos','forecast','prediccion','futuro',
  'equipo','integrantes','miembros','autores',
  'tendencia','historica','historico','evolucion','boletin',
  'depresion','parkinson','alzheimer',
  'deepar','prophet','ensemble','stacking',
  'configuracion','entrenamiento','hiperparametros','parametros',
  'validacion','semanal','precision',
  'infraestructura','tests','cobertura','sagemaker',
  'cuantos','cuantas','total',
  'semana','epidemiologica','fecha',
  'padecimiento','padecimientos','enfermedad',
  'region','regiones','macroregion',
  'covid','pandemia',
  'sexo','genero','hombre','hombres','mujer','mujeres',
  'codigo','definicion','cie',
  'alcance','capacidad',
  'casos','incidencia','acumulado','anual',
  'estado','entidad','entidades','nacional',
  'enero','febrero','marzo','abril','mayo','junio',
  'julio','agosto','septiembre','octubre','noviembre','diciembre',
  // 32 entidades federativas
  'aguascalientes','campeche','chiapas','chihuahua','coahuila','colima',
  'durango','guanajuato','guerrero','hidalgo','jalisco','michoacan',
  'morelos','nayarit','oaxaca','puebla','queretaro','sinaloa','sonora',
  'tabasco','tamaulipas','tlaxcala','veracruz','yucatan','zacatecas',
  // Compuestos (se verifican por palabra)
  'baja','california','nuevo','leon','san','luis','potosi','quintana','roo',
  'ciudad','mexico',
];

/**
 * Intenta corregir cada palabra del query comparando con VOCAB.
 * Retorna el query corregido si hubo cambios, o null si no.
 */
// Palabras comunes del espanol que NO deben corregirse a entidades
const STOP_WORDS = new Set([
  'durante', 'despues', 'antes', 'entre', 'desde', 'hasta', 'sobre',
  'contra', 'hacia', 'para', 'como', 'cuando', 'donde', 'quien',
  'porque', 'aunque', 'mientras', 'siempre', 'nunca', 'apenas',
  'bien', 'mejor', 'peor', 'mayor', 'menor', 'mucho', 'poco',
  'todo', 'nada', 'algo', 'cada', 'otro', 'mismo', 'solo',
  'puede', 'puedo', 'puedes', 'quiero', 'tiene', 'hacer', 'haber',
  'sido', 'sera', 'esta', 'estan', 'fueron', 'siendo',
  'grafico', 'graficos', 'mostrar', 'muestra', 'comportaron',
  'compara', 'comparar', 'comparativa', 'diferencia', 'versus',
  'padecimientos', 'padecimiento', 'casos', 'datos', 'numero',
  'anos', 'anno', 'meses', 'semanas', 'dias',
  'mas', 'menos', 'preciso', 'precisos', 'distribucion',
]);

function fuzzyCorrect(q) {
  const words = q.split(' ');
  let changed = false;
  const fixed = words.map(w => {
    if (w.length < 3) return w;          // No corregir palabras muy cortas
    if (VOCAB.includes(w)) return w;     // Ya esta bien
    if (STOP_WORDS.has(w)) return w;     // Palabra comun, no corregir
    // Buscar la palabra m\u00e1s cercana en el vocabulario
    let best = w, bestDist = Infinity;
    for (const known of VOCAB) {
      // Solo comparar con palabras de longitud similar (+/- 2)
      if (Math.abs(known.length - w.length) > 2) continue;
      const dist = levenshtein(w, known);
      // Aceptar si distancia <= 2 Y menor al 40% de la longitud
      if (dist < bestDist && dist <= 2 && dist < w.length * 0.4) {
        bestDist = dist;
        best = known;
      }
    }
    if (best !== w) changed = true;
    return best;
  });
  return changed ? fixed.join(' ') : null;
}

// ---------------------------------------------------------------------------
// Cadena de handlers (orden de prioridad)
// ---------------------------------------------------------------------------

const HANDLERS = [
  answerSaludo, answerPadecimientoNoModelado, answerLugarDesconocido, answerEquipo, answerTemporal, answerProyectoMeta,
  answerTrainingConfig, answerSemanaActual, answerQueEsPadecimiento,
  answerBoletin, answerHistorico, answerSpecificSeries, answerComparativaEstados, answerEstado, answerPadecimiento,
  answerMotor, answerDemografica, answerSexo, answerMetricaGlobal,
  answerRanking, answerDiagnosticos, answerValidacion, answerInfra,
  answerConteo, answerPronostico, answerDefinicion,
];

function runHandlers(q, ent, s, d) {
  for (const handler of HANDLERS) {
    const result = handler(q, ent, s, d);
    if (result) return result;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Guard: tema fuera de alcance → ceder a Gemini
// ---------------------------------------------------------------------------

function isOffTopic(q, ent) {
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
    'diabetes', 'cancer', 'covid', 'influenza', 'dengue', 'obesidad',
    'hipertension', 'ansiedad', 'esquizofrenia',
  ];
  if (allowedTerms.some(t => q.includes(t))) return false;

  // Solo bloquear temas claramente irrelevantes al proyecto
  const blockedTerms = [
    'weather', 'futbol', 'soccer', 'basket', 'deporte', 'olimpi',
    'formula 1', 'formula uno', ' f1 ', 'la f1', 'nascar', 'motogp',
    'champions', 'mundial', 'liga mx', 'premier league', 'nba', 'nfl', 'mlb',
    'pelicula', 'netflix', 'musica', 'cancion', 'concierto', 'serie de tv',
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

// Contexto conversacional: entidades de la ultima pregunta exitosa
let lastEntities = {};

export async function answer(query) {
  const d = await loadKnowledge();
  const s = d.stats || {};
  const q = norm(query);
  const ent = detectEntities(query);

  // Si requiere razonamiento temporal fino (diario), ceder a Gemini
  if (needsGeminiReasoning(q)) return null;

  // Guard: tema fuera de alcance → ceder a Gemini
  if (isOffTopic(q, ent)) return null;

  // Detectar follow-ups conversacionales
  const followUpPrefixes = [
    'y en ', 'y el ', 'y la ', 'y los ', 'y las ', 'y que ',
    'pero ', 'pero en ', 'pero de ',
    'y para ', 'y del ', 'tambien en ', 'que hay de ', 'ahora ',
  ];
  const isFollowUp = (lastEntities.padecimiento || lastEntities.estado) &&
    (followUpPrefixes.some(p => q.startsWith(p)) || /^y \w/.test(q));

  // Merge de contexto conversacional
  function mergeWithContext(baseEnt) {
    const merged = { ...baseEnt };
    if (!merged.padecimiento && lastEntities.padecimiento) merged.padecimiento = lastEntities.padecimiento;
    if (!merged.estado && lastEntities.estado) merged.estado = lastEntities.estado;
    if (!merged.sexo && lastEntities.sexo) merged.sexo = lastEntities.sexo;
    if (!(merged._months || []).length && (lastEntities._months || []).length) merged._months = lastEntities._months;
    if (!(merged._years || []).length && (lastEntities._years || []).length) merged._years = lastEntities._years;
    return merged;
  }

  // Pre-calcular corrección fuzzy
  const corrected = fuzzyCorrect(q);
  const hasFuzzy = corrected && corrected !== q;

  // Si es follow-up, intentar con contexto heredado PRIMERO
  if (isFollowUp) {
    const merged = mergeWithContext(ent);
    const hasExtra = merged.padecimiento !== ent.padecimiento || merged.estado !== ent.estado ||
                     (merged._months || []).length !== (ent._months || []).length;
    if (hasExtra) {
      const resultCtx = runHandlers(q, merged, s, d);
      if (resultCtx) {
        const ctx = [merged.padecimiento, merged.estado].filter(Boolean).join(' en ');
        lastEntities = merged;
        return `*(Contexto: ${ctx})*\n\n${resultCtx}`;
      }
    }
  }

  // Corrección fuzzy con más entidades
  if (hasFuzzy) {
    const entFixed = detectEntities(corrected);
    const moreEntities =
      (!ent.padecimiento && entFixed.padecimiento) ||
      (!ent.estado && entFixed.estado) ||
      (!ent.modelo && entFixed.modelo);
    if (moreEntities) {
      const resultFixed = runHandlers(corrected, entFixed, s, d);
      if (resultFixed) {
        lastEntities = entFixed;
        return `*(¿Quisiste decir «${corrected}»?)*\n\n${resultFixed}`;
      }
    }
  }

  // Intento normal: query original
  const result = runHandlers(q, ent, s, d);
  if (result) {
    lastEntities = ent;
    return result;
  }

  // Corrección fuzzy completa
  if (hasFuzzy) {
    const entFixed = detectEntities(corrected);
    const resultFixed = runHandlers(corrected, entFixed, s, d);
    if (resultFixed) {
      lastEntities = entFixed;
      return `*(¿Quisiste decir «${corrected}»?)*\n\n${resultFixed}`;
    }
  }

  // Último intento: heredar contexto (para queries sin prefijo de follow-up)
  // NO heredar si la pregunta es claramente sobre otro tema (proyecto, equipo, etc.)
  const newTopicSignals = [
    'articulo', 'publicacion', 'paper', 'equipo', 'integrante', 'quien hizo',
    'infraestructura', 'arquitectura', 'pipeline', 'fuente de datos', 'fuente de informacion',
    'como funciona', 'que es epiforecast', 'que sabe', 'que puede', 'alcance',
    'configuracion', 'entrenamiento', 'region', 'macroregion',
    'composicion', '333', 'por que 333', 'covid', 'pandemia',
    'que padecimiento', 'cuales padecimiento', 'ayuda', 'hola', 'buenos dias',
    'que hora', 'quien gana', 'formula', ' f1',
  ];
  const isNewTopic = newTopicSignals.some(t => q.includes(t));

  if (!isFollowUp && !isNewTopic && (lastEntities.padecimiento || lastEntities.estado)) {
    // Solo heredar si la query tiene keywords de datos/epidemiologia
    const dataKeywords = ['caso', 'cuantos', 'cuantas', 'incidencia', 'dato', 'grafico', 'grafica',
      'pronostico', 'prediccion', 'historico', 'historica', 'tendencia', 'semana', 'ano',
      'boletin', 'metrica', 'smape', 'modelo', 'ranking', 'validacion', 'desglose',
      'comparar', 'motor', 'sexo', 'hombre', 'mujer', 'general', 'nacional'];
    const hasDataContext = dataKeywords.some(t => q.includes(t));

    if (hasDataContext) {
      const merged = mergeWithContext(ent);
      const hasExtra = merged.padecimiento !== ent.padecimiento || merged.estado !== ent.estado;
      if (hasExtra) {
        const resultCtx = runHandlers(q, merged, s, d);
        if (resultCtx) {
          const ctx = [merged.padecimiento, merged.estado].filter(Boolean).join(' en ');
          lastEntities = merged;
          return `*(Contexto: ${ctx})*\n\n${resultCtx}`;
        }
      }
    }
  }

  return null;
}
