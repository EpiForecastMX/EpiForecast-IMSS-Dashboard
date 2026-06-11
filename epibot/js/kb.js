/**
 * kb.js - Base de conocimiento EpiForecast-MX (22 handlers).
 *
 * Port inteligente de epi_modules/features/knowledge_base.py.
 * Cada handler responde de forma directa y conversacional,
 * con estimaciones mensuales, contexto hist\u00f3rico e interpretaci\u00f3n.
 */

import { norm, detectEntities } from './entities.js?v=28';

let DATA = null;

// Cohorte neurologica de produccion (333 modelos = 3 padecimientos x 111).
// Los handlers agregadores/nacionales son neuro-only; Dengue (cohorte de
// conteos) se responde por answerDengue y handlers con ent.padecimiento==='Dengue'.
const NEURO_PADS = ['Depresion', 'Parkinson', 'Alzheimer'];
function isNeuro(p) { return NEURO_PADS.includes(p); }

// Version de los datos para cache-bust estable (evita re-descargar 1.3 MB por visita).
// Subir esta constante cuando cambie knowledge.json / zoom_series.json.
const DATA_VERSION = '20260611';

export async function loadKnowledge() {
  if (DATA) return DATA;
  const cacheBust = `?v=${DATA_VERSION}`;
  const resp = await fetch(`./knowledge.json${cacheBust}`);
  if (!resp.ok) throw new Error('No se pudo cargar knowledge.json');
  DATA = await resp.json();
  _fixForecastTotals();
  _fixCohortStats();
  // Precarga en segundo plano el zoom por serie (estado×sexo, 432 series). No bloquea el
  // arranque; cuando llega, queda en DATA.zoom_series y lo usan answerZoom/buildZoomChart.
  fetch(`./zoom_series.json${cacheBust}`)
    .then(r => (r.ok ? r.json() : null))
    .then(z => { if (z) DATA.zoom_series = z; })
    .catch(() => {});
  return DATA;
}

/**
 * Corrige pronostico_total y casos_futuro_total para evitar conteo multiple.
 * El build original suma todas las filas (general+hombres+mujeres, Nacional+regiones+estados).
 * Lo correcto es usar solo sexo=general, excluyendo Nacional y regiones (evitar doble conteo).
 */
function _fixForecastTotals() {
  const models = DATA?.prod_models;
  const stats = DATA?.stats;
  if (!models || !stats) return;

  const pp = stats.por_pad || {};
  let grandTotal = 0;

  for (const pad of Object.keys(pp)) {
    // Sumar solo 32 estados individuales con sexo=general (sin Nacional ni regiones)
    const stateGenerals = models.filter(m =>
      m.padecimiento === pad &&
      m.sexo === 'general' &&
      m.entidad !== 'Nacional' &&
      !String(m.entidad || '').startsWith('Region') &&
      !String(m.entidad || '').startsWith('region')
    );
    const corrected = stateGenerals.reduce((sum, m) => sum + (m.casos_52_semanas_futuro || 0), 0);
    pp[pad].casos_futuro_total = corrected;
    // pronostico_total es la cohorte neuro (Dengue es conteos, no se mezcla).
    if (isNeuro(pad)) grandTotal += corrected;
  }

  stats.pronostico_total = grandTotal;
}

/**
 * Re-deriva las estadísticas GLOBALES (agregadores nacionales) sobre la cohorte
 * neuro (333 modelos), porque knowledge.json ahora mezcla Dengue (cohorte de
 * conteos) en stats.* (total_modelos=435, dist_motor, smape, diagnósticos, top5,
 * por_motor). El contrato es: los handlers agregadores/nacionales son neuro;
 * Dengue se sirve por answerDengue / d.dengue. Las series por padecimiento
 * (por_pad.Dengue) y prod_models con Dengue se conservan intactas para los
 * handlers específicos de Dengue.
 */
function _fixCohortStats() {
  const stats = DATA?.stats;
  const models = DATA?.prod_models;
  if (!stats || !Array.isArray(models)) return;

  const neuro = models.filter(m => isNeuro(m.padecimiento));
  if (!neuro.length) return;

  const median = (arr) => {
    if (!arr.length) return null;
    const a = [...arr].sort((x, y) => x - y);
    const mid = Math.floor(a.length / 2);
    return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
  };
  const mean = (arr) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null);
  const r2 = (v) => (v == null ? null : Math.round(v * 100) / 100);
  const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);
  const nums = (key) => neuro.map(m => m[key]).filter(v => v != null && isFinite(v));

  // Conteo y total fijos de la cohorte neuro
  stats.total_modelos = 333;

  // Distribución de motores ganadores (neuro)
  const dist = {};
  for (const m of neuro) {
    const mo = m.modelo_produccion;
    if (mo) dist[mo] = (dist[mo] || 0) + 1;
  }
  if (Object.keys(dist).length) {
    stats.dist_motor = dist;
    const win = Object.entries(dist).sort((a, b) => b[1] - a[1])[0];
    stats.motor_ganador = win[0];
    stats.motor_ganador_n = win[1];
    stats.motor_ganador_pct = r1((win[1] / 333) * 100);
  }

  // Métricas globales (neuro)
  for (const [prefix, key] of [['smape_prod', 'smape_prod'], ['mase_prod', 'mase_prod'], ['rmse_prod', 'rmse_prod'], ['mae_prod', 'mae_prod']]) {
    const vals = nums(key);
    if (!vals.length) continue;
    stats[`${prefix}_mean`] = r2(mean(vals));
    stats[`${prefix}_median`] = r2(median(vals));
    stats[`${prefix}_min`] = r2(Math.min(...vals));
    stats[`${prefix}_max`] = r2(Math.max(...vals));
  }

  // Precisión histórica (neuro): los valores vienen como "91.3%"
  const ph = neuro.map(m => parseFloat(String(m.precision_historica || '').replace('%', '')))
    .filter(v => isFinite(v));
  if (ph.length) {
    stats.precision_historica_mean = r1(mean(ph));
    stats.precision_historica_median = r1(median(ph));
  }

  // Diagnósticos (neuro)
  let ofOk = 0, ofMod = 0, ofAlto = 0, ofNd = 0, lkOk = 0, lkSosp = 0;
  for (const m of neuro) {
    const of = String(m.overfitting || '');
    if (of.startsWith('OK')) ofOk++;
    else if (of.startsWith('Moderado')) ofMod++;
    else if (of.startsWith('Alto')) ofAlto++;
    else ofNd++;
    const lk = String(m.leakage || '');
    if (lk.startsWith('Sospechoso')) lkSosp++;
    else if (lk.startsWith('OK')) lkOk++;
  }
  stats.overfitting_ok = ofOk;
  stats.overfitting_moderado = ofMod;
  stats.overfitting_alto = ofAlto;
  stats.overfitting_nd = ofNd;
  stats.leakage_ok = lkOk;
  stats.leakage_sospechoso = lkSosp;

  // Top/Bottom 5 por SMAPE (neuro)
  const bySmape = neuro.filter(m => m.smape_prod != null && isFinite(m.smape_prod))
    .map(m => ({ entidad: m.entidad, padecimiento: m.padecimiento, sexo: m.sexo, smape: r2(m.smape_prod), motor: m.modelo_produccion }));
  const asc = [...bySmape].sort((a, b) => a.smape - b.smape);
  stats.top5_smape = asc.slice(0, 5);
  stats.bottom5_smape = [...bySmape].sort((a, b) => b.smape - a.smape).slice(0, 5);

  // por_motor: métricas agregadas por motor (neuro)
  const pmOut = {};
  const byMotor = {};
  for (const m of neuro) {
    const mo = m.modelo_produccion;
    if (!mo) continue;
    (byMotor[mo] = byMotor[mo] || []).push(m);
  }
  for (const [mo, arr] of Object.entries(byMotor)) {
    const pick = (k) => arr.map(x => x[k]).filter(v => v != null && isFinite(v));
    const sm = pick('smape_prod'), ma = pick('mase_prod'), rm = pick('rmse_prod'), me = pick('mae_prod');
    pmOut[mo] = {
      smape_mean: r2(mean(sm)), smape_median: r2(median(sm)),
      mase_mean: r2(mean(ma)), mase_median: r2(median(ma)),
      rmse_mean: r2(mean(rm)), rmse_median: r2(median(rm)),
      mae_mean: r2(mean(me)), mae_median: r2(median(me)),
    };
  }
  if (Object.keys(pmOut).length) stats.por_motor = pmOut;
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

/** Devuelve rango fijo del horizonte de pronostico desde training_config (no se recalcula). */
function forecastDateRange(d) {
  const tc = d.training_config || {};
  if (!tc.horizonte_inicio || !tc.horizonte_fin) return null;

  const fmtDate = (iso) => {
    const dt = new Date(iso + 'T00:00:00');
    const day = dt.getDate();
    const m = MONTH_NAMES[dt.getMonth()];
    const y = dt.getFullYear();
    return `${day} de ${m} ${y}`;
  };

  const startLabel = fmtDate(tc.horizonte_inicio);
  const endLabel = fmtDate(tc.horizonte_fin);
  const entrenam = tc.ultimo_entrenamiento ? fmtDate(tc.ultimo_entrenamiento) : null;

  return {
    startDate: startLabel,
    endDate: endLabel,
    entrenam,
    label: `${startLabel} a ${endLabel}`,
  };
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
// Detecta preguntas de conocimiento general sobre padecimientos
// que el proyecto NO puede responder (ceder a Gemini)
// ---------------------------------------------------------------------------

function needsGeneralKnowledge(q) {
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
  if (any(q, countryKw)) return true;

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

function needsMedicalAdvice(q) {
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

function answerInjectionGuard(q) {
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
    // Respuestas condicionadas
    'si la respuesta es si responde', 'responde solo con',
    'a partir de ahora responde', 'usa solo emojis',
  ];
  return injectionPatterns.some(p => q.includes(p));
}

const INJECTION_RESPONSE =
  'Soy el asistente de **EpiForecast-MX**, una plataforma de inteligencia ' +
  'epidemiologica para la salud publica en Mexico. No puedo asumir otros roles, compartir informacion ' +
  'confidencial ni modificar mis instrucciones.\n\n' +
  'Puedo ayudarte con:\n' +
  '- Datos y pronosticos de **Depresion**, **Parkinson** y **Alzheimer**\n' +
  '- Metricas de los modelos de ML (SMAPE, MASE, RMSE)\n' +
  '- Datos historicos del boletin epidemiologico SINAVE\n' +
  '- Informacion del equipo, metodologia e infraestructura';

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
    'influenza', 'covid', 'tuberculosis', 'vih', 'sida', 'colera',
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
  // Activar si tiene data keywords, menciona un estado, o es un follow-up corto ("y del cancer")
  const isShortFollowUp = q.split(' ').length <= 5 && /^(y |y del |y de |y la |y el )/.test(q);
  if (matchedDisease && (any(q, dataKw) || ent.estado || isShortFollowUp)) {
    return (
      `EpiForecast-MX **no modela ${matchedDisease}**. ` +
      'Nuestro proyecto se enfoca en cuatro padecimientos del Bolet\u00edn Epidemiol\u00f3gico SINAVE:\n\n' +
      '- **Depresi\u00f3n** (CIE-10: F32)\n' +
      '- **Parkinson** (CIE-10: G20)\n' +
      '- **Alzheimer** (CIE-10: G30)\n' +
      '- **Dengue** (CIE-10: A97)\n\n' +
      '\u00bfTe gustar\u00eda consultar datos de alguno de estos padecimientos?'
    );
  }

  return null;
}

function answerLugarDesconocido(q, ent, s, d) {
  if (!ent._lugarDesconocido || ent.estado) return null;
  // No interceptar preguntas sobre metodologia/fuentes, historia/origen,
  // ni preguntas meta/valor/comparacion (no son lugares aunque mencionen "Google").
  const skipKw = ['basado', 'basas', 'basa', 'funciona', 'funcion', 'metodologia', 'sacas', 'obtienes', 'sabes',
    'historia', 'origen', 'descubri', 'viene de', 'por que se llama', 'inventor', 'creador',
    'en el mundo', 'mundial', 'global',
    'value', 'valor', 'diferencia', 'comparar', 'compararte', 'consultarte', 'preguntarte',
    'google', 'chatgpt', 'internet', 'buscar', 'busqueda', 'recomendacion', 'recomendaciones',
    'para que sirve', 'para que sirves', 'que haces', 'que puedes', 'quien eres', 'utilidad', 'ventaja', 'sirves'];
  if (any(q, skipKw)) return null;
  const lugar = ent._lugarDesconocido;
  const cap = lugar.charAt(0).toUpperCase() + lugar.slice(1);
  const lines = [
    `**${cap}** no es una entidad federativa de Mexico.\n`,
    'EpiForecast-MX cubre unicamente las **32 entidades federativas** de Mexico, ' +
    '4 macrorregiones INEGI y el nivel Nacional.\n',
  ];
  if (ent.padecimiento) {
    const ps = s.por_pad?.[ent.padecimiento];
    if (ps && ps.casos_futuro_total) {
      lines.push(`A nivel **Nacional**, se pronostican **${fmt(ps.casos_futuro_total)} casos de ${ent.padecimiento}** en 52 semanas (SMAPE: ${ps.smape_prod_median}%).`);
    }
    lines.push(`\nPrueba con una entidad valida: "${ent.padecimiento} en Jalisco", "${ent.padecimiento} en CDMX".`);
  } else {
    lines.push('Ejemplos: "Parkinson en Jalisco", "Depresion en CDMX", "Alzheimer en Nuevo Leon".');
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Guard: edad como variable exogena no disponible
// ---------------------------------------------------------------------------

function answerEdadNoDisponible(q, ent, s, d) {
  if (!ent._ageFilter || !ent.padecimiento) return null;
  // Si tiene estado, dejar que answerSpecificSeries maneje
  if (ent.estado) return null;

  const pad = ent.padecimiento;
  const sexoLabel = ent.sexo === 'hombres' ? 'hombres' : ent.sexo === 'mujeres' ? 'mujeres' : null;
  const lines = [
    `**Variable no disponible**: nuestros modelos de pronostico segmentan unicamente por **sexo** (hombres, mujeres, general) y **entidad federativa** (32 estados + Nacional). No manejamos edad, grupo etario ni otras variables exogenas.\n`,
  ];

  if (sexoLabel) {
    const articuloSexo = ent.sexo === 'hombres' ? 'Los' : 'Las';
    const ps = s.por_pad?.[pad]?.por_sexo?.[ent.sexo];
    lines.push(`Sin embargo, si contamos con pronosticos diferenciados por **sexo**:\n`);
    if (ps) {
      lines.push(`${articuloSexo} **${sexoLabel}** representan el **${ps.pct_series}** de las series de ${pad}.`);
      lines.push(`- Pronostico: **${fmt(ps.casos_futuro)}** casos en 52 semanas`);
      lines.push(`- SMAPE promedio: **${ps.smape_mean}%**`);
    }
  } else {
    const ps = s.por_pad?.[pad];
    if (ps?.casos_futuro_total) {
      lines.push(`Datos generales de **${pad}**:`);
      lines.push(`- Pronostico total: **${fmt(ps.casos_futuro_total)}** casos en 52 semanas`);
      lines.push(`- SMAPE mediano: **${ps.smape_median}%**`);
    }
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Handlers (respuestas directas y conversacionales)
// ---------------------------------------------------------------------------

function answerSaludo(q, ent, s, d) {
  // Nombre del sistema: respuesta corta "ordename"
  const nameOnly = ['epiforecast', 'epiforecast mx', 'epiforecast-mx', 'epiforecastmx'];
  if (nameOnly.some(n => q === n || q === n + '?')) {
    return '**Generalizaci\u00f3n de modelos nacionales de pron\u00f3stico epidemiol\u00f3gico hacia un enfoque modular con desagregaci\u00f3n por sexo y entidad federativa en M\u00e9xico** (EpiForecast-MX).\n\nPresente. Ordename, \u00bfqu\u00e9 necesitas saber?';
  }

  const triggers = [
    'hola', 'buenos dias', 'buenas tardes', 'buenas noches',
    'hello', 'saludos', 'buen dia', 'que onda', 'que tal', 'hey',
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
    '- **Padecimientos**: Depresi\u00f3n, Parkinson, Alzheimer y **Dengue**\n' +
    '- **Datos hist\u00f3ricos** del bolet\u00edn epidemiol\u00f3gico\n' +
    '- **Equipo**, infraestructura y configuraci\u00f3n\n' +
    '- **Pron\u00f3sticos** y validaci\u00f3n semanal\n\n' +
    'Para **Dengue** prueba: *pron\u00f3stico dengue*, *mapa de dengue*, *pr\u00f3ximo brote* o *hist\u00f3rico de dengue*.\n\n' +
    '\u00bfQu\u00e9 te gustar\u00eda saber?'
  );
}

// Profesores y asesores del proyecto (no están en knowledge.json)
const PROFESORES = [
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

function answerEquipo(q, ent, s, d) {
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
// Fecha de una semana epidemiologica especifica.
// "de que fecha es el boletin 20", "que fecha es la semana 20", "cuando fue la
// semana 12". Convierte semana epi -> rango lunes-domingo usando las fechas
// reales de weekly_comparison. Debe ir ANTES de answerTemporal (que daria la
// fecha de HOY) y answerBoletin (que volcaria el resumen historico).
// ---------------------------------------------------------------------------

function _fechaLarga(iso) {
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
    'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const dt = new Date(iso + 'T00:00:00');
  return `${dt.getDate()} de ${meses[dt.getMonth()]} de ${dt.getFullYear()}`;
}

function _addDiasISO(iso, dias) {
  const dt = new Date(iso + 'T00:00:00');
  dt.setDate(dt.getDate() + dias);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d2 = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d2}`;
}

function answerFechaSemana(q, ent, s, d) {
  const asksDate = any(q, ['fecha', 'cuando fue', 'cuando es', 'cuando va', 'que dia',
    'dia es', 'corresponde', 'a que dia', 'en que dia', 'que semana del calendario']);
  if (!asksDate) return null;

  // Extraer el numero de semana/boletin (1-53)
  const m = q.match(/\b(?:boletin|semana|sem)\s*(?:epidemiologica\s*)?(?:numero\s*|num\s*|no\s*|#\s*)?(\d{1,2})\b/);
  const week = m ? parseInt(m[1], 10) : ((ent._weeks || [])[0] ?? null);
  if (!week || week < 1 || week > 53) return null;

  const wc = d.weekly_comparison || {};
  const pads = Object.keys(wc);
  if (!pads.length) return null;
  const serie = wc[pads[0]];
  const anio = serie?.anio;
  const semObj = (serie?.semanas || []).find(x => x.semana === week);
  if (!semObj || !semObj.fecha) return null;

  const ini = _fechaLarga(semObj.fecha);
  const fin = _fechaLarga(_addDiasISO(semObj.fecha, 6));
  const lines = [];
  lines.push(`La **semana epidemiológica ${week} de ${anio}** abarca del **${ini}** al **${fin}** (lunes a domingo).`);

  // Casos reales reportados esa semana (suma de los 3 padecimientos), si los hay
  let totalReal = 0;
  let hayReal = false;
  for (const p of pads) {
    const so = (wc[p].semanas || []).find(x => x.semana === week);
    if (so && so.real != null) { totalReal += so.real; hayReal = true; }
  }
  if (hayReal) {
    lines.push(`\nEn esa semana se reportaron **${fmt(totalReal)} casos** en total en el boletín SINAVE.`);
  } else if (serie.semanas_reales != null && week > serie.semanas_reales) {
    lines.push(`\n*(Es una semana del horizonte de pronóstico; aún no hay dato real del boletín.)*`);
  }
  return lines.join('\n');
}

function answerTemporal(q, ent, s, d) {
  const triggers = [
    'que dia es', 'que fecha es', 'fecha de hoy', 'dia de hoy', 'fecha actual',
    'que ano es', 'que semana es',
    'semana epidemiologica', 'semana epi', 'en que semana',
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

  const isDateQ = any(q, ['que dia es', 'que fecha es', 'fecha de hoy', 'dia de hoy', 'fecha actual', 'que ano es']);
  if (isDateQ) {
    const dias = ['domingo', 'lunes', 'martes', 'mi\u00e9rcoles', 'jueves', 'viernes', 's\u00e1bado'];
    const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    lines.push(`Hoy es **${dias[now.getDay()]} ${now.getDate()} de ${meses[now.getMonth()]} de ${now.getFullYear()}**`);
    lines.push(`Semana epidemiol\u00f3gica: **${iso.week}** de ${iso.year}`);
  }

  const isWeekQ = any(q, ['semana epidemiologica', 'semana epi', 'en que semana', 'que semana es', 'que semana estamos', 'semana estamos']);
  if (isWeekQ && !isDateQ) {
    lines.push(`Estamos en la **semana epidemiol\u00f3gica ${iso.week}** de ${iso.year}.`);

    // Datos disponibles y avance del pronóstico
    const ult = d.boletin?.ultima_semana;
    const rng = forecastDateRange(d);
    if (ult) {
      lines.push(`Datos disponibles hasta: **semana ${ult.semana} de ${ult.anio}** (${fmt(ult.total)} casos reportados esa semana).`);
      const rezago = ult.anio === iso.year ? iso.week - ult.semana : iso.week + (52 - ult.semana);
      if (rezago > 0) lines.push(`Rezago del bolet\u00edn: **${rezago} semana(s)**.`);
    }
    if (rng) {
      // Calcular en qué semana del horizonte de 52 estamos
      const tc = d.training_config || {};
      const hStart = new Date(tc.horizonte_inicio + 'T00:00:00');
      const diffMs = now.getTime() - hStart.getTime();
      const semTranscurridas = Math.max(0, Math.floor(diffMs / (7 * 24 * 3600 * 1000)) + 1);
      if (semTranscurridas > 0 && semTranscurridas <= 52) {
        lines.push(`Avance del pron\u00f3stico: **semana ${semTranscurridas} de 52** (horizonte: ${rng.label}).`);
      } else if (semTranscurridas > 52) {
        lines.push(`El horizonte de pron\u00f3stico (${rng.label}) ya concluy\u00f3.`);
      }
      if (rng.entrenam) lines.push(`\u00daltimo entrenamiento: **${rng.entrenam}**.`);
    }
  }

  const isCoverage = any(q, ['ultima semana', 'ultimo dato', 'hasta cuando', 'hasta que fecha', 'hasta que semana', 'cobertura temporal', 'rango de fecha', 'periodo de dato', 'desde cuando', 'cuando inicia', 'cuando empieza']);
  const asksForecast = any(q, ['pronostic', 'forecast', 'predicci', 'predecir', 'pronosicad', 'horizonte']);

  // Si pregunta por horizonte de pronostico, mostrar info del forecast
  if ((isCoverage || q.includes('horizonte')) && asksForecast) {
    const rng = forecastDateRange(d);
    const tc = d.training_config || {};
    if (rng) {
      if (lines.length) lines.push('');
      lines.push('**Horizonte de pron\u00f3stico**:');
      lines.push(`- Desde: **${rng.startDate}**`);
      lines.push(`- Hasta: **${rng.endDate}**`);
      lines.push(`- Duraci\u00f3n: **52 semanas**`);
      if (rng.entrenam) lines.push(`- \u00daltimo entrenamiento: **${rng.entrenam}**`);
      lines.push(`- Modelos: **${tc.series_totales || 333}** series de producci\u00f3n`);
      // Semanas transcurridas
      const hStart = new Date(tc.horizonte_inicio + 'T00:00:00');
      const diffMs = now.getTime() - hStart.getTime();
      const semTranscurridas = Math.max(0, Math.floor(diffMs / (7 * 24 * 3600 * 1000)) + 1);
      if (semTranscurridas > 0 && semTranscurridas <= 52) {
        lines.push(`- Avance: **semana ${semTranscurridas} de 52**`);
      }
      // Datos reales disponibles dentro del horizonte
      const wc = d.weekly_comparison;
      if (wc) {
        const semsReales = Object.values(wc)[0]?.semanas?.filter(s => s.real != null).length || 0;
        if (semsReales > 0) lines.push(`- Semanas con datos reales: **${semsReales}** de 53`);
      }
    }
  } else if (isCoverage) {
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

  if (q.includes('horizonte') && !asksForecast && !lines.length) {
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
  // Nombre completo del proyecto
  const NOMBRE_REAL = '**Generalizaci\u00f3n de modelos nacionales de pron\u00f3stico epidemiol\u00f3gico ' +
    'hacia un enfoque modular con desagregaci\u00f3n por sexo y entidad federativa en M\u00e9xico** (EpiForecast-MX)';

  const nameTriggers = ['nombre del proyecto', 'nombre completo del proyecto', 'como se llama el proyecto',
    'como se llama este proyecto', 'titulo del proyecto', 'nombre oficial'];
  if (any(q, nameTriggers)) {
    return (
      `${NOMBRE_REAL}.\n\n` +
      'Proyecto integrador de la **Maestr\u00eda en Inteligencia Artificial Aplicada** ' +
      'del Tecnol\u00f3gico de Monterrey, desarrollado para la salud pública en México.\n\n' +
      'Pron\u00f3stico multi-modelo de Depresi\u00f3n (F32), Parkinson (G20) y Alzheimer (G30) ' +
      `con **${s.total_modelos || 333} modelos** de producci\u00f3n.`
    );
  }

  // Guard: alguien dice que el proyecto se llama de otra forma → corregir
  // Extraer el nombre reclamado (lo que viene DESPUES de "se llama")
  const claimMatch = q.match(/se llama\s+(.+?)(?:\s*$|\s*\?)/);
  const claimMatch2 = q.match(/el nombre (?:del proyecto )?es\s+(.+?)(?:\s*$|\s*\?)/);
  const claimedName = (claimMatch && claimMatch[1]) || (claimMatch2 && claimMatch2[1]) || null;

  if (claimedName) {
    // Verificar si el nombre reclamado ES el nombre real
    const nombresReales = ['epiforecast', 'epiforecast mx', 'epiforecast-mx', 'generalizacion de modelos'];
    const claimedIsReal = nombresReales.some(n => claimedName.includes(n));
    if (claimedIsReal) {
      return (
        `Correcto. El nombre completo es ${NOMBRE_REAL}.\n\n` +
        'Proyecto integrador de la **Maestr\u00eda en Inteligencia Artificial Aplicada** ' +
        'del Tecnol\u00f3gico de Monterrey, desarrollado para la salud pública en México.'
      );
    }
    // Nombre falso → corregir
    return (
      `No. El nombre del proyecto es ${NOMBRE_REAL}.\n\n` +
      'Ning\u00fan integrante del equipo ni la documentaci\u00f3n oficial usan otro nombre para el proyecto.'
    );
  }

  const padTriggers = [
    'que padecimiento', 'cuales padecimiento', 'de que padecimiento',
    'padecimiento sabes', 'padecimiento manejas', 'padecimiento modela',
    'padecimiento pronostic', 'padecimiento cubre', 'padecimiento tiene',
    'que enfermedad', 'cuales enfermedad', 'enfermedad modela', 'enfermedad cubre',
    'que diagnostico', 'que cie', 'codigos cie', 'clasificacion internacional',
  ];
  if (any(q, padTriggers)) {
    const pp = s.por_pad || {};
    const lines = ['**EpiForecast-MX modela cuatro padecimientos**: tres neurol\u00f3gicos (Depresi\u00f3n, Parkinson, Alzheimer) y **Dengue** (pipeline propio). Los tres neurol\u00f3gicos, de la Clasificaci\u00f3n Internacional de Enfermedades (CIE-10):\n'];
    lines.push('| Padecimiento | SMAPE mediano | Motor ganador | Series ganadas | Distribuci\u00f3n |');
    lines.push('|-------------|:------------:|:-------------:|:--------------:|:-----------|');
    for (const [nombre, cie, key] of [['Depresi\u00f3n', 'F32', 'Depresion'], ['Parkinson', 'G20', 'Parkinson'], ['Alzheimer', 'G30', 'Alzheimer']]) {
      const ps = pp[key] || {};
      const smape = ps.smape_prod_median != null ? ps.smape_prod_median + '%' : '?';
      const ganador = ps.motor_ganador || '?';
      const nGanador = ps.motor_ganador_n || '?';
      const total = ps.n || 111;
      // Build distribution string from dist_motor
      const dist = ps.dist_motor || {};
      const distStr = Object.entries(dist)
        .sort((a, b) => b[1] - a[1])
        .map(([m, n]) => `${m}: ${n}`)
        .join(', ');
      lines.push(`| **${nombre} (${cie})** | ${smape} | ${ganador} | ${nGanador}/${total} | ${distStr} |`);
    }
    // Global motor summary (cohorte neuro: numerador y denominador = 333)
    const motorTotals = {};
    for (const [pk, ps] of Object.entries(pp)) {
      if (!isNeuro(pk)) continue;
      for (const [m, n] of Object.entries(ps.dist_motor || {})) {
        motorTotals[m] = (motorTotals[m] || 0) + n;
      }
    }
    const globalWinner = Object.entries(motorTotals).sort((a, b) => b[1] - a[1]);
    if (globalWinner.length) {
      lines.push(`\n**Motor l\u00edder global**: **${globalWinner[0][0]}** con **${globalWinner[0][1]}/333** series ganadas (${((globalWinner[0][1] / 333) * 100).toFixed(0)}%).`);
      if (globalWinner.length > 1) {
        lines.push('Desglose: ' + globalWinner.map(([m, n]) => `${m} ${n}`).join(' | '));
      }
    }
    lines.push('\n---\n');
    lines.push('**Cobertura por padecimiento: 111 modelos**\n');
    lines.push('**37 geografias:**');
    lines.push('- 32 entidades federativas (una por estado)');
    lines.push('- 4 macrorregiones INEGI (Norte, Centro, Sur, Occidente)');
    lines.push('- 1 Nacional (agregado del pais)\n');
    lines.push('**3 modos de sexo** por cada geografia:');
    lines.push('- Hombres');
    lines.push('- Mujeres');
    lines.push('- General (combinado)\n');
    lines.push('37 geografias \u00d7 3 sexos = **111 modelos por padecimiento** \u00d7 3 padecimientos = **333 modelos totales** (cohorte neurol\u00f3gica).');
    const dgi = d.dengue;
    if (dgi) {
      lines.push('\n---\n');
      lines.push(`**4.\u00ba padecimiento, Dengue (A97)**: arbovirosis con **pipeline propio** (cohorte de conteos, no tasa), aparte de los 333 neuro. Serie ${dgi.cobertura}, ${dgi.n_series} series; productivos **${(dgi.motores_productivos || []).join(' y ')}**. Sumando Dengue, la plataforma totaliza **435 series**. Preg\u00fantame \u00abdengue\u00bb para su detalle.`);
    }
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
      `- **Inicio**: ${ev.inicio || '2020-03-23'} (23 de marzo de 2020)\n` +
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
  const stackedGuard = any(q, ['semanal', 'apilad', 'stacked', 'area']);
  if (!stackedGuard && (any(q, compTriggers) || (q.includes('333') && any(q, ['que es', 'que son', 'como', 'por que', 'porque', 'explica', 'de donde'])))) {
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
      'publicado semanalmente por la **Secretaría de Salud** de México a través del **SINAVE**.\n\n' +
      '**Características del boletín:**\n' +
      `- **Cobertura temporal**: ${meta ? `semana 1 de ${meta.min_anio} a semana ${meta.max_semana} de ${meta.max_anio}` : '2014 a 2026'}\n` +
      '- **Frecuencia**: semanal (52 semanas epidemiológicas por año)\n' +
      '- **Granularidad**: por entidad federativa, padecimiento y sexo\n' +
      '- **Padecimientos cubiertos**: Depresión (F32), Parkinson (G20), Alzheimer (G30) y Dengue (A97)\n' +
      '- **Desglose geográfico**: 32 entidades federativas de México\n\n' +
      'Los datos se extraen mediante scraping automatizado de los PDF del boletín y se procesan con Camelot (CI/CD en GitHub Actions).'
    );
  }

  const articuloTriggers = ['articulo', 'publicacion', 'paper ', 'manuscrito', 'draft', 'titulo del articulo', 'nombre del articulo', 'como se llama el articulo', 'que se va a publicar', 'articulo cientifico', 'revista cientifica', 'en que journal', 'que journal'];
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

  // Metodologia / En que te basas / Como funcionas
  const basisTriggers = [
    'en que te basa', 'en que estas basado', 'en que se basa', 'en que esta basado',
    'como funciona', 'como funcionas', 'como trabaja', 'como opera',
    'cual es la metodologia', 'metodologia', 'metodo que usa',
    'de donde sacas', 'de donde saca', 'de donde obtienes', 'de donde obtiene',
    'como sabes', 'como sabe', 'de donde sale',
    'que tecnologia', 'que modelos usa', 'que algoritmo',
    'como genera', 'como se genera', 'como pronostica', 'como predice',
    'como hace las prediccion', 'en base a que',
  ];
  if (any(q, basisTriggers)) {
    const meta = d.boletin?.meta;
    const dist = s.dist_motor || {};
    const tc = d.training_config || {};
    const lines = [
      '**Metodologia de EpiForecast-MX**\n',
      '**1. Fuente de datos**',
      'Los datos provienen del **Boletin Epidemiologico del SINAVE** (Sistema Nacional de Vigilancia Epidemiologica), publicado semanalmente por la Secretaria de Salud de Mexico.',
    ];
    if (meta) {
      lines.push(`- Periodo: **${meta.min_anio}** a **${meta.max_anio}** (semana ${meta.max_semana})`);
      lines.push(`- Registros: **${fmt(meta.total_registros)}** observaciones semanales`);
    }
    lines.push('- Padecimientos: **Depresion** (F32), **Parkinson** (G20), **Alzheimer** (G30)');
    lines.push('- Cobertura: 32 entidades federativas + 4 regiones INEGI + Nacional\n');

    lines.push('**2. Modelos de Machine Learning**');
    lines.push(`Se entrenan **${s.total_modelos || 333} modelos** (3 padecimientos x 37 geografias x 3 sexos), cada uno evaluado con 4 motores:\n`);
    lines.push('| Motor | Tipo | Descripcion |');
    lines.push('|-------|------|-------------|');
    lines.push('| **Prophet** | Aditivo/multiplicativo | Modelo de Meta (Facebook) para series de tiempo con estacionalidad y cambios de tendencia |');
    lines.push('| **DeepAR** | Red neuronal recurrente | Modelo de Amazon (GluonTS + PyTorch) que aprende patrones complejos de multiples series |');
    lines.push('| **Ensemble** | Hibrido | Combinacion de Prophet + XGBoost con features temporales |');
    lines.push('| **Stacking** | Meta-learner | Prophet + ETS + LightGBM apilados con Ridge como meta-modelo |\n');

    // Distribucion actual
    if (Object.keys(dist).length) {
      lines.push('**Distribución actual de motores ganadores:**');
      for (const [motor, n] of Object.entries(dist)) {
        const pct = s.total_modelos ? (n / s.total_modelos * 100).toFixed(1) : '?';
        lines.push(`- ${motor}: **${n}** series (${pct}%)`);
      }
      lines.push('');
    }

    lines.push('**3. Seleccion del modelo productivo**');
    lines.push('Para cada serie, se elige el motor con menor **SMAPE** (error porcentual simetrico) en validacion cruzada temporal. MASE y RMSE se usan como desempate.\n');

    lines.push('**4. Pronostico**');
    lines.push(`Horizonte de **${tc.horizonte || 52} semanas** hacia adelante (corte: ${tc.fecha_corte || '2025-01-01'}).`);
    if (s.smape_prod_median != null) {
      lines.push(`Precision global: SMAPE mediano **${s.smape_prod_median}%**.`);
    }

    return lines.join('\n');
  }

  const alcanceTriggers = ['que sabe', 'que puede', 'de que sabe', 'que conoce', 'que informacion tiene', 'que datos tiene', 'que cubre', 'alcance', 'capacidad', 'sobre que me puede'];
  // No disparar si preguntan por un padecimiento/estado/ano especifico ("que sabes del parkinson en 2017")
  if (any(q, alcanceTriggers) && !ent.padecimiento && !ent.estado && !(ent._years || []).length) {
    return (
      '**Puedo responder sobre el proyecto EpiForecast-MX**:\n\n' +
      '- **Padecimientos**: Depresi\u00f3n (F32), Parkinson (G20), Alzheimer (G30), Dengue (A97)\n' +
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

// ---------------------------------------------------------------------------
// Cuantas semanas epidemiologicas / boletines del anio en curso van cargados.
// ("cuantas semanas van en 2026", "cuantos boletines llevan") -> max_semana.
// Debe ir ANTES de answerBoletin (resumen del anio) y answerConteo (modelos),
// que secuestraban estas preguntas por el "cuantas" o el "2026".
// ---------------------------------------------------------------------------

function answerSemanasBoletin(q, ent, s, d) {
  const triggers = [
    'cuantas semana', 'cuantos semana', 'cuantos boletin', 'cuantas boletin',
    'cuanto boletin', 'semanas van', 'semanas llevan', 'semanas llevamos',
    'semanas hay', 'semanas computad', 'semanas cargad', 'semanas registrad',
    'semanas procesad', 'semanas transcurrid', 'semanas disponible',
    'semanas reportad', 'semanas capturad', 'semanas acumulad', 'semanas tienen',
    'semanas tenemos', 'semanas de boletin', 'semanas del boletin',
    'semanas de boletines', 'boletines van', 'boletines llevan', 'boletines hay',
    'boletines cargad', 'que semana va el boletin', 'en que semana va el',
  ];
  if (!any(q, triggers)) return null;

  // Preguntas sobre el horizonte FUTURO de pronostico -> otros handlers
  if (any(q, ['faltan', 'restan', 'quedan', 'horizonte', 'pronostic', 'forecast', 'futur'])) return null;

  const meta = d.boletin?.meta || {};
  const ult = d.boletin?.ultima_semana;
  const maxSem = meta.max_semana ?? ult?.semana;
  const maxAnio = meta.max_anio ?? ult?.anio;
  if (!maxSem) return null;

  const lines = [];
  lines.push(`Van **${maxSem} semanas epidemiológicas de ${maxAnio}** cargadas del boletín SINAVE (hasta la **semana ${maxSem} de ${maxAnio}**, de 52 posibles en el año).`);
  if (ult && ult.anio === maxAnio && ult.total != null) {
    lines.push(`\nEl dato más reciente es la **semana ${ult.semana} de ${ult.anio}**, con **${fmt(ult.total)} casos** reportados esa semana.`);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// DENGUE — 4.o padecimiento (cohorte de conteos, pipeline propio). Un handler
// dedicado posee TODAS las preguntas de Dengue: sus métricas y selección de motor
// no comparten estructura con la neuro (333 modelos por tasa), así que no puede
// servirse desde los handlers neuro. Lee la sección `d.dengue` (generada por
// build_web_knowledge.build_dengue_section) + `d.padecimiento_info.Dengue`.
// ---------------------------------------------------------------------------

function answerDengue(q, ent, s, d) {
  if (ent.padecimiento !== 'Dengue') return null;
  // El zoom semanal lo atiende answerZoom (corre despues y SI soporta Dengue via
  // weekly_comparison). Diferir para no interceptarlo con la ficha de texto.
  const zoomTriggers = ['zoom', 'detalle semanal', 'vista cercana', 'acercamiento'];
  const zoomAlt = (q.includes('real') && q.includes('pronostico') && q.includes('semanal')) ||
    (q.includes('semana a semana') && (q.includes('pronostico') || q.includes('modelo')));
  if (zoomTriggers.some(t => q.includes(t)) || zoomAlt) return null;
  const dg = d.dengue;
  if (!dg) return null;
  const info = d.padecimiento_info?.Dengue;
  const num = (n) => (n == null ? '?' : fmt(n));

  // Pronóstico / proyección
  if (any(q, ['pronostic', 'forecast', 'prediccion', 'predice', 'predecir', 'se espera', 'se esperan', 'proxim', 'a futuro', 'proyeccion', 'nino', 'enso', 'climatolog', 'brote'])) {
    return [
      '**Pronóstico de Dengue: al ritmo de El Niño**', '',
      `El motor productivo nacional es **${dg.motor_nacional}** (SMAPE ${dg.smape_nacional}% sobre ${dg.ultima_real.slice(0, 4)}). El pronóstico preciso es a **52 semanas**; más allá, proyectamos al ritmo de **El Niño**.`, '',
      `Los grandes brotes ocurren **cada ~5 años** en años de El Niño (2014, 2019, 2024), así que el **próximo se espera hacia 2029** (2024 + 5), con años bajos en medio. La gráfica muestra la serie real desde 2014 (El Niño en rojo, La Niña en verde) y el pronóstico al próximo El Niño:`, '',
      '![Pronóstico de dengue al ritmo de El Niño: serie 2014-2026 y pronóstico del próximo brote hacia 2029](../Reports/dengue/dengue_pronostico_nino.png)', '',
      `*La magnitud exacta del brote 2029 es incierta (El Niño no se pronostica con certeza a varios años): es un escenario de planeación, no una certeza. Última semana real: ${dg.ultima_real}.*`,
    ].join('\n');
  }

  // Modelos / motores / métricas (incluye "tasa": Dengue es conteos, no tasa) y nº de series
  if (any(q, ['modelo', 'motor', 'smape', 'metrica', 'mejor model', 'cual usan', 'que usan', 'deepar', 'prophet', 'ensemble', 'stacking', 'produccion', 'tasa', 'serie', 'series', 'tabla'])) {
    const tipos = {
      DeepAR: 'Red neuronal recurrente (GluonTS)',
      NBGLM: 'Conteos NegBin + Fourier + El Niño',
      Prophet: 'Tendencia + estacionalidad + El Niño',
      Ensemble: 'Prophet + XGBoost',
      Stacking: 'Prophet + ETS + LightGBM',
    };
    const prodSet = new Set(dg.motores_productivos || []);
    const orden = [...(dg.motores_entrenados || [])].sort((a, b) => {
      const d = (prodSet.has(b) ? 1 : 0) - (prodSet.has(a) ? 1 : 0);
      return d !== 0 ? d : (dg.dist_motor?.[b] || 0) - (dg.dist_motor?.[a] || 0);
    });
    const rows = orden.map((m) => {
      const p = prodSet.has(m);
      const ser = dg.dist_motor?.[m] || 0;
      const flag = m === dg.motor_nacional ? 'Sí (nacional)' : p ? 'Sí' : 'No';
      return `| ${m} | ${tipos[m] || '—'} | ${flag} | ${p ? fmt(ser) : '—'} |`;
    }).join('\n');
    return [
      '**Modelado de Dengue**', '',
      `**${dg.motores_entrenados.length} motores** entrenados, **${dg.motores_productivos.length}** productivos. Selección por serie (**${dg.n_series} series** = ${dg.n_entidades} entidades + agregados × 3 sexos) por SMAPE sobre la realidad ${dg.ultima_real.slice(0, 4)}:`, '',
      '| Motor | Tipo | Productivo | Series |',
      '|:------|:-----|:----------:|-------:|',
      rows, '',
      '![Distribución de motores productivos de Dengue: DeepAR 46, NBGLM 31, Prophet 22 series](../Reports/dengue/dengue_motores_dona.png)', '',
      `A nivel **nacional** el motor productivo es **${dg.motor_nacional}** (SMAPE **${dg.smape_nacional}%**). Se modela en **${dg.unidad}**.`, '',
      `*Ensemble y Stacking quedan fuera: los árboles (XGBoost/LightGBM) no extrapolan la dinámica epidémica a 52 semanas. Muchas de las ${dg.n_series} series tienen pocos casos; la señal robusta es la nacional.*`,
    ].join('\n');
  }

  // Sexo: el Dengue SÍ se modela por sexo (general/hombres/mujeres), pero el bot solo
  // expone los agregados nacional y por entidad — ser honesto en vez de soltar el panorama.
  if (ent.sexo === 'hombres' || ent.sexo === 'mujeres') {
    const donde = ent.estado ? ` en ${ent.estado}` : '';
    return `El Dengue **sí se modela por sexo** (general, hombres y mujeres: ${dg.n_series} series = ${dg.n_entidades} entidades + agregados × 3 sexos), pero el bot solo expone los agregados nacional y por entidad${donde}. El desglose por sexo del Dengue está en la tabla de producción y la página de Dengue. Puedo darte el total nacional, por entidad, el pronóstico o los modelos.`;
  }

  // Geografía: por estado / ranking / mapa
  if (ent.estado || any(q, ['donde', 'estado', 'entidad', 'mapa', 'ranking', 'top ', 'region', 'geografi', 'que estado', 'cuales estado'])) {
    const wantsMap = q.includes('mapa') || q.includes('coropletic') || q.includes('geografic');
    // Petición de un estado concreto (sin pedir mapa): dato puntual de esa entidad.
    if (ent.estado && !wantsMap) {
      const hit = (dg.top_entidades || []).find((x) => norm(x.entidad) === norm(ent.estado));
      const sin = (dg.sin_casos || []).find((x) => norm(x) === norm(ent.estado));
      if (hit) return `En **${hit.entidad}**, el dengue confirmado acumulado (${dg.cobertura}) suma **${num(hit.casos)} casos**: es una de las entidades de mayor carga del país.`;
      if (sin) return `**${sin}** no registra transmisión de dengue confirmada en todo el periodo (${dg.cobertura}). Pertenece al centro-altiplano, fuera del rango del vector *Aedes aegypti*.`;
      return `El dengue se concentra en el **sureste tropical y las costas** (${(dg.top_entidades || []).slice(0, 3).map((e) => e.entidad).join(', ')}). No tengo el desglose por entidad de ${ent.estado} en el bot; pídeme el **mapa de dengue** para ver la geografía completa.`;
    }
    // "peor / mayor" = mas carga (default). "menor / menos / pocas" = entidades con menos casos.
    const wantsLeast = any(q, ['menor', 'menos', 'pocas', 'pocos', 'baja carga', 'mas bajo', 'menos afectad']);
    if (wantsLeast) {
      const sinCasos = dg.sin_casos || [];
      const ranking = [...(dg.top_entidades || [])].sort((a, b) => (a.casos || 0) - (b.casos || 0)).slice(0, 5);
      const out = [
        `**Entidades con menor carga de dengue (${dg.cobertura}, casos confirmados)**`, '',
      ];
      if (sinCasos.length) {
        out.push(`Las de **menor carga** no registran transmisión confirmada en todo el periodo: **${sinCasos.join(' y ')}** con cero casos. Pertenecen al centro-altiplano, fuera del rango del vector *Aedes aegypti*.`);
      }
      if (ranking.length) {
        out.push('', 'Entre las que sí registran transmisión, las de menor carga son:');
        ranking.forEach((e, i) => out.push(`${i + 1}. ${e.entidad}: ${num(e.casos)} casos`));
      }
      out.push('', '![Mapa de México: casos confirmados de dengue por entidad, 2018-2026, escala logarítmica](../Reports/dengue/dengue_mapa_mexico.png)');
      return out.join('\n');
    }
    const top = (dg.top_entidades || []).map((e, i) => `${i + 1}. ${e.entidad}: ${num(e.casos)} casos`).join('\n');
    const out = [
      `**Dengue por entidad (${dg.cobertura}, casos confirmados)**`, '', top, '',
      `La carga vive en el **sureste tropical y las costas**. El centro-altiplano no registra transmisión confirmada: **${(dg.sin_casos || []).join(' y ')}** con cero casos en todo el periodo.`,
      // El mapa coroplético es la mejor visualización para "dónde golpea"; lo incluimos siempre.
      '',
      '![Mapa de México: casos confirmados de dengue por entidad, 2018-2026, escala logarítmica](../Reports/dengue/dengue_mapa_mexico.png)',
    ];
    return out.join('\n');
  }

  // Histórico / casos / pico / ciclo epidémico
  if (any(q, ['caso', 'cuanto', 'cuantos', 'historic', 'evolucion', 'pico', 'brote', 'epidemia', 'anual', 'por ano', 'por anio', 'tendencia', 'total', 'ola', 'ciclo']) || ent._years?.length) {
    const aniosTop = Object.entries(dg.anual).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([y, c]) => `${y} (${num(c)})`).join(', ');
    // Año específico pedido por el usuario: dato puntual de dg.anual.
    const yrPedido = (ent._years || []).find((y) => dg.anual?.[String(y)] != null);
    if (yrPedido) {
      return `En **${yrPedido}** se confirmaron **${num(dg.anual[String(yrPedido)])} casos** de dengue en México (${dg.unidad}). El año de mayor carga del periodo fue **${dg.anio_pico}** (${num(dg.casos_pico)} casos). Los grandes brotes llegan cada ~${dg.ciclo_anios} años (${(dg.anios_epidemicos || []).join(', ')}).`;
    }
    // Sin imagen embebida: la gráfica de evolución la genera el chart interactivo
    // (buildDengueAnual en app.js), como en los demás padecimientos.
    return [
      '**Dengue confirmado en México — histórico (2014-2026)**', '',
      `El año de mayor carga fue **${dg.anio_pico}** con **${num(dg.casos_pico)} casos**: la mayor epidemia de dengue registrada en las Américas. Años con más casos: ${aniosTop}.`, '',
      `El dengue vuelve en **olas**: grandes brotes cada **${dg.ciclo_anios} años** (${(dg.anios_epidemicos || []).join(' · ')}), coincidiendo con años de El Niño. Cobertura: ${dg.n_boletines} boletines semanales, ${dg.n_entidades} entidades, en **${dg.unidad}**.`,
    ].join('\n');
  }

  // Por defecto: qué es / síntomas / panorama
  const lines = [];
  if (info) {
    lines.push(`**${info.nombre_completo} (CIE-10: ${info.cie})**`, '', info.descripcion, '', '**Síntomas principales**:');
    for (const e of (info.efectos || [])) lines.push(`- ${e}`);
    if (info.nota_mexico) lines.push('', `**En México**: ${info.nota_mexico}`);
  } else {
    lines.push('**Dengue (CIE-10: A97)**');
  }
  lines.push(
    '',
    `**En EpiForecast-MX**: es el 4.o padecimiento, con serie ${dg.cobertura} (${dg.n_boletines} boletines). Se entrenan ${dg.motores_entrenados.length} motores y ${dg.motores_productivos.join(' y ')} son productivos. Pico histórico en ${dg.anio_pico} (${num(dg.casos_pico)} casos).`,
    '',
    'Pregúntame por su *pronóstico*, sus *modelos*, el *histórico* o *dónde* golpea más.',
    '',
    '*Esta información es de carácter general y no constituye consejo médico.*',
  );
  return lines.join('\n');
}

function answerQueEsPadecimiento(q, ent, s, d) {
  // Historia / origen / descubrimiento → ceder a Gemini (conocimiento general)
  const historyKw = [
    'historia', 'origen', 'descubri', 'quien fue', 'de donde viene',
    'por que se llama', 'como se descubri', 'cuando se descubri',
    'nombr', 'bautiz', 'pakistan', 'inventor', 'creador', 'identifico', 'identificar',
  ];
  if (any(q, historyKw)) return null;

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
  if (info.nota_mexico) lines.push(`\n**En M\u00e9xico**: ${info.nota_mexico}`);

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
  const hasLastN = ent._lastNYears != null;

  if (!hasYear && !hasHist && !isRanking && !hasLastN) return null;

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
    const lines = [];
    if (ent._ageFilter) {
      lines.push(`**Variable no disponible**: nuestros modelos segmentan por **sexo** y **entidad federativa**, no por edad. Se muestran los totales:\n`);
    }
    lines.push(`**${pad}** (${yrStr}):\n`);
    const currentYear = new Date().getFullYear();
    const partialWeek = bol.meta?.max_semana || 52;
    const isPartialYear = (y) => y === currentYear && bol.meta?.max_anio === currentYear && partialWeek < 48;
    const missing = [];
    for (const y of years) {
      const c = anual[String(y)];
      if (c != null) {
        const partial = isPartialYear(y) ? ` *(parcial, semana ${partialWeek} de 52)*` : '';
        const prev = anual[String(y - 1)];
        let change = '';
        if (prev && prev > 0 && !isPartialYear(y)) {
          const pc = ((c - prev) / prev * 100).toFixed(1);
          change = ` (${Number(pc) >= 0 ? '+' : ''}${pc}% vs ${y - 1})`;
        }
        lines.push(`- **${y}**: ${fmt(c)} casos${change}${partial}`);
      } else {
        missing.push(y);
      }
    }
    if (missing.length) {
      const tc = d.training_config || {};
      const hFin = tc.horizonte_fin;
      const hFinYear = hFin ? new Date(hFin + 'T00:00:00').getFullYear() : null;
      const inForecast = missing.filter(y => hFinYear && y <= hFinYear && y >= currentYear);
      const outOfRange = missing.filter(y => !inForecast.includes(y));
      if (inForecast.length) {
        const rng = forecastDateRange(d);
        const wc = d.weekly_comparison || {};
        const info = wc[pad];
        if (info && rng) {
          lines.push(`\n**${inForecast.join(', ')}** esta cubierto por el horizonte de pronostico (${rng.label}):`);
          const pron = (info.semanas || []).reduce((a, s) => a + s.pronostico, 0);
          lines.push(`- Pronostico total: **${fmt(pron)} casos** (modelo ${info.modelo_productivo || '-'})`);
        }
      }
      if (outOfRange.length) {
        lines.push(`\nNo tengo datos para ${outOfRange.length === 1 ? 'el a\u00f1o' : 'los a\u00f1os'} **${outOfRange.join(', ')}**. El Bolet\u00edn Epidemiol\u00f3gico SINAVE cubre de **${minY}** a **${maxY}**.`);
      }
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
      // Verificar si años faltantes caen en el horizonte de pronóstico
      const tc = d.training_config || {};
      const hFin = tc.horizonte_fin;
      const hFinYear = hFin ? new Date(hFin + 'T00:00:00').getFullYear() : null;
      const inForecast = missing.filter(y => hFinYear && y <= hFinYear && y >= new Date().getFullYear());
      const outOfRange = missing.filter(y => !inForecast.includes(y));

      if (inForecast.length) {
        const rng = forecastDateRange(d);
        const wc = d.weekly_comparison || {};
        lines.push('');
        for (const y of inForecast) {
          lines.push(`**${y}** esta cubierto por el horizonte de pronostico${rng ? ` (${rng.label})` : ''}:`);
          for (const [p, info] of Object.entries(wc)) {
            const sems = info.semanas || [];
            // Buscar semanas del año; si no hay (ej: 2027 solo tiene semanas con fecha 2026),
            // mostrar el total del pronostico completo
            let semsInYear = sems.filter(s => s.fecha && s.fecha.startsWith(String(y)));
            if (semsInYear.length === 0) {
              // El horizonte cubre hasta enero 2027 pero las fechas son 2025-12-29 a 2026-12-28
              const pron = sems.reduce((a, s) => a + s.pronostico, 0);
              if (pron > 0) lines.push(`- ${p}: el pronostico de 52 semanas totaliza **${fmt(pron)} casos** y se extiende hasta enero ${y} (${info.modelo_productivo || '-'})`);
              continue;
            }
            const pron = semsInYear.reduce((a, s) => a + s.pronostico, 0);
            if (pron > 0) lines.push(`- ${p}: **${fmt(pron)} casos** pronosticados (${info.modelo_productivo || '-'})`);
          }
        }
      }
      if (outOfRange.length) {
        lines.push(`\nNo tengo datos para ${outOfRange.length === 1 ? 'el a\u00f1o' : 'los a\u00f1os'} **${outOfRange.join(', ')}**. El Bolet\u00edn Epidemiol\u00f3gico SINAVE (nuestra fuente) cubre de **${minY}** a **${maxY}**.`);
      }
    }
    return lines.join('\n');
  }

  // Filtro por sexo (y/o edad) en datos hist\u00f3ricos
  if (pad && (ent.sexo || ent._ageFilter) && (hasHist || hasLastN || hasYear) && !estado) {
    const sexoLabel = ent.sexo === 'hombres' ? 'hombres' : ent.sexo === 'mujeres' ? 'mujeres' : null;
    const articuloSexo = ent.sexo === 'hombres' ? 'Los' : 'Las';
    const lines = [];

    // Aviso de variable ex\u00f3gena no soportada (edad, etc.)
    if (ent._ageFilter) {
      lines.push(`**Variable no disponible**: nuestros modelos de pron\u00f3stico segmentan \u00fanicamente por **sexo** (hombres, mujeres, general) y **entidad federativa** (32 estados + Nacional). No manejamos edad, grupo etario ni otras variables ex\u00f3genas.\n`);
    }

    if (sexoLabel) {
      const ps = s.por_pad?.[pad]?.por_sexo?.[ent.sexo];
      if (!ent._ageFilter) {
        lines.push(`*Nuestros modelos de pron\u00f3stico est\u00e1n diferenciados por sexo y entidad, al igual que los datos del Bolet\u00edn Epidemiol\u00f3gico SINAVE:*\n`);
      } else {
        lines.push(`Sin embargo, s\u00ed contamos con pron\u00f3sticos diferenciados por **sexo**:\n`);
      }
      if (ps) {
        const models = (d.prod_models || []).filter(m =>
          m.padecimiento === pad && m.sexo === ent.sexo &&
          m.entidad !== 'Nacional' &&
          !String(m.entidad || '').startsWith('Region') &&
          !String(m.entidad || '').startsWith('region')
        );
        const totalCasos = models.reduce((sum, m) => sum + (m.casos_52_semanas_futuro || 0), 0);
        lines.push(`**Pron\u00f3stico de ${pad} (${sexoLabel})** \u2014 pr\u00f3ximas 52 semanas:\n`);
        lines.push(`- Casos pronosticados: **${fmt(totalCasos)}**`);
        lines.push(`- Modelos: ${ps.n} series`);
        lines.push(`- SMAPE: ${ps.smape_prod_mean}% (media) / ${ps.smape_prod_median}% (mediana)`);
        if (ps.casos_nacional) lines.push(`- Nacional: **${fmt(ps.casos_nacional)} casos**`);

        const psGen = s.por_pad?.[pad]?.por_sexo?.general;
        if (psGen?.casos_nacional && ps.casos_nacional) {
          const pct = ((ps.casos_nacional / psGen.casos_nacional) * 100).toFixed(1);
          lines.push(`\n${articuloSexo} ${sexoLabel} representan el **${pct}%** del pron\u00f3stico nacional de ${pad}.`);
        }
      } else {
        lines.push(`No tengo datos de pron\u00f3stico para ${pad} filtrado por ${sexoLabel}.`);
      }
    } else if (ent._ageFilter && !sexoLabel) {
      // Solo edad, sin sexo
      const ps = s.por_pad?.[pad];
      if (ps?.casos_futuro_total) {
        lines.push(`**Pron\u00f3stico de ${pad} (general)** \u2014 pr\u00f3ximas 52 semanas: **${fmt(ps.casos_futuro_total)} casos**`);
        lines.push(`\nPuedes filtrar por **sexo** (hombres/mujeres) o por **entidad federativa**.`);
      }
    }
    return lines.join('\n');
  }

  // Tendencia hist\u00f3rica de un padecimiento (sin a\u00f1o espec\u00edfico, sin estado)
  if (pad && !hasYear && (hasHist || hasLastN) && !estado) {
    const anual = bol.anual_por_pad?.[pad];
    if (!anual) return null;

    // Detectar a\u00f1o parcial (actual) y excluirlo de tendencia/comparativas
    const currentYear = new Date().getFullYear();
    const maxWeek = bol.meta?.max_semana || 52;
    const maxAnio = bol.meta?.max_anio || currentYear;
    const isPartial = maxAnio === currentYear && maxWeek < 48;

    let sortedYears = Object.keys(anual).sort();
    // Excluir a\u00f1o parcial de la lista principal de tendencia
    const partialYear = isPartial ? String(currentYear) : null;
    const fullYears = partialYear ? sortedYears.filter(y => y !== partialYear) : sortedYears;

    // Limitar a "ultimos N anos" si se detect\u00f3
    const lastN = ent._lastNYears;
    const displayYears = lastN && lastN < fullYears.length
      ? fullYears.slice(-lastN)
      : fullYears;

    const first = displayYears[0], last = displayYears[displayYears.length - 1];
    const firstC = anual[first], lastC = anual[last];

    const lines = [];

    // Aviso de filtro de edad no disponible
    if (ent._ageFilter) {
      lines.push(`**Variable no disponible**: nuestros modelos segmentan por **sexo** y **entidad federativa**, no por edad. Se muestran los totales disponibles:\n`);
    }

    // Lead with the trend summary
    if (firstC && lastC && firstC > 0) {
      const totalGrowth = ((lastC - firstC) / firstC * 100).toFixed(0);
      const direction = lastC > firstC ? 'crecimiento' : 'descenso';
      lines.push(`**${pad}** muestra un **${direction} del ${Math.abs(totalGrowth)}%** entre ${first} y ${last} (de ${fmt(firstC)} a ${fmt(lastC)} casos).\n`);
    } else {
      lines.push(`**${pad} \u2014 Evoluci\u00f3n hist\u00f3rica** (${first}\u2013${last}):\n`);
    }

    let prev = null, maxY = null, maxC = 0, minY = null, minC = Infinity;
    for (const y of displayYears) {
      const c = anual[y];
      let change = '';
      if (prev != null && prev > 0) { const pc = (c - prev) / prev * 100; change = ` (${pc >= 0 ? '+' : ''}${pc.toFixed(1)}%)`; }
      lines.push(`- ${y}: ${fmt(c)} casos${change}`);
      if (c > maxC) { maxC = c; maxY = y; }
      if (c < minC) { minC = c; minY = y; }
      prev = c;
    }

    // A\u00f1o parcial como nota al pie
    if (partialYear && anual[partialYear] != null) {
      lines.push(`- ${partialYear}: ${fmt(anual[partialYear])} casos *(parcial, semana ${maxWeek} de 52)*`);
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

  // Resumen general de datos historicos (sin padecimiento, sin estado, sin ano)
  // Requiere triggers explicitos de historico/boletin (no solo "caso" o "semanal")
  const genericHistKw = ['historico', 'historica', 'datos historicos', 'boletin',
    'sinave', 'evolucion historica', 'serie de tiempo', 'acumulado'];
  const isGenericHist = any(q, genericHistKw);
  if (!pad && !estado && !hasYear && !ent.sexo && isGenericHist) {
    const anualPad = bol.anual_por_pad || {};
    const meta = bol.meta || {};
    const pads = Object.keys(anualPad);
    if (!pads.length) return null;

    const lines = [`**Datos historicos del Boletin Epidemiologico SINAVE**\n`];
    lines.push(`- Periodo: **${meta.min_anio || 2014}** a **${meta.max_anio || 2026}** (semana ${meta.max_semana || '?'})`);
    lines.push(`- Registros totales: **${fmt(meta.total_registros || 0)}**`);
    lines.push(`- Padecimientos: ${pads.map(p => `**${p}**`).join(', ')}`);
    lines.push(`- Entidades: 32 estados + Nacional\n`);

    const currentYear = new Date().getFullYear();
    const maxWeek = meta.max_semana || 52;
    const isPartial = (meta.max_anio === currentYear) && maxWeek < 48;

    for (const p of pads) {
      const data = anualPad[p];
      const allYrs = Object.keys(data).sort();
      // Excluir ano parcial de pico/valle/crecimiento
      const fullYrs = isPartial ? allYrs.filter(y => Number(y) !== currentYear) : allYrs;
      if (!fullYrs.length) continue;
      const totalFull = fullYrs.reduce((s, y) => s + (data[y] || 0), 0);
      const maxY = fullYrs.reduce((best, y) => (data[y] > data[best] ? y : best), fullYrs[0]);
      const minY = fullYrs.reduce((best, y) => (data[y] < data[best] ? y : best), fullYrs[0]);
      const lastY = fullYrs[fullYrs.length - 1];
      const firstY = fullYrs[0];
      const growth = data[firstY] > 0 ? (((data[lastY] - data[firstY]) / data[firstY]) * 100).toFixed(1) : '?';

      lines.push(`**${p}**:`);
      lines.push(`- Total acumulado (${firstY}-${lastY}): **${fmt(totalFull)} casos**`);
      lines.push(`- Pico: **${maxY}** con ${fmt(data[maxY])} casos`);
      lines.push(`- Valle: **${minY}** con ${fmt(data[minY])} casos`);
      lines.push(`- Crecimiento ${firstY} vs ${lastY}: **${growth}%**`);
      if (isPartial && data[String(currentYear)] != null) {
        lines.push(`- ${currentYear} *(parcial, semana ${maxWeek})*: ${fmt(data[String(currentYear)])} casos`);
      }
      lines.push('');
    }

    lines.push(`Puedes consultar datos por padecimiento, estado o rango de anos. Ejemplos:`);
    lines.push(`- "casos de depresion en 2020"`);
    lines.push(`- "tendencia de parkinson ultimos 5 anos"`);
    lines.push(`- "que estado tiene mas casos de alzheimer"`);

    return lines.join('\n');
  }

  return null;
}

// ---------------------------------------------------------------------------
// TREEMAP — panorama por entidad
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// MAPA DE MEXICO — coropletico por entidad
// ---------------------------------------------------------------------------

function answerMapaMexico(q, ent, s, d) {
  const triggers = ['mapa de mexico', 'mapa de la republica', 'mapa coropletico', 'mapa geografico', 'mapa nacional'];
  const triggerAlt = q.includes('mapa') && any(q, ['estado', 'entidad', 'mexico', 'republica', 'nacional', 'coropletico', 'geografico']);
  if (!any(q, triggers) && !triggerAlt) return null;

  const models = d.prod_models || [];
  if (!models.length) return null;

  const isSmape = any(q, ['smape', 'error', 'precision']);

  // Detectar padecimiento
  const padAliases = { depresion: 'Depresion', depression: 'Depresion', f32: 'Depresion',
    parkinson: 'Parkinson', g20: 'Parkinson', alzheimer: 'Alzheimer', g30: 'Alzheimer' };
  let filterPad = ent.padecimiento || null;
  if (!filterPad) {
    for (const [alias, pad] of Object.entries(padAliases)) {
      if (q.includes(alias)) { filterPad = pad; break; }
    }
  }

  // Detectar sexo
  const sexoAliases = { hombres: 'hombres', hombre: 'hombres', masculino: 'hombres',
    mujeres: 'mujeres', mujer: 'mujeres', femenino: 'mujeres' };
  let filterSexo = ent.sexo || 'general';
  if (filterSexo === 'general') {
    for (const [alias, sexo] of Object.entries(sexoAliases)) {
      if (q.includes(alias)) { filterSexo = sexo; break; }
    }
  }

  const sexoLabel = { general: 'ambos sexos', hombres: 'hombres', mujeres: 'mujeres' };

  // Funcion para agregar datos de un filtro
  function aggregateMap(padFilter, sexFilter) {
    const byEnt = {};
    for (const m of models) {
      if (m.sexo !== sexFilter) continue;
      if (padFilter && m.padecimiento !== padFilter) continue;
      const e = m.entidad || '';
      if (e === 'Nacional' || e.startsWith('region_') || e.startsWith('Region')) continue;
      if (!byEnt[e]) byEnt[e] = { casos: 0, smapes: [] };
      byEnt[e].casos += m.casos_52_semanas_futuro || 0;
      if (m.smape_prod != null) byEnt[e].smapes.push(m.smape_prod);
    }
    return Object.entries(byEnt)
      .map(([e, d]) => ({ e, casos: d.casos, smape: d.smapes.length ? d.smapes.reduce((a, v) => a + v, 0) / d.smapes.length : null }))
      .sort((a, b) => b.casos - a.casos);
  }

  const lines = [];

  if (filterPad) {
    // Mapa para un padecimiento especifico
    const sorted = aggregateMap(filterPad, filterSexo);
    const totalCasos = sorted.reduce((a, e) => a + e.casos, 0);
    lines.push(`**Mapa de Mexico - ${filterPad}** (${sexoLabel[filterSexo]}, ${sorted.length} estados)\n`);
    if (isSmape) {
      lines.push('Color: verde (buen SMAPE) a rojo (alto SMAPE).\n');
    } else {
      lines.push('Color: mas oscuro = menor incidencia, mas claro = mayor incidencia.\n');
    }
    lines.push('**Top 5 entidades**:');
    lines.push('| Entidad | Casos (52 sem) | SMAPE prom |');
    lines.push('|---------|---------------:|-----------:|');
    for (const e of sorted.slice(0, 5)) {
      lines.push(`| ${e.e} | ${fmt(e.casos)} | ${e.smape != null ? e.smape.toFixed(1) + '%' : '?'} |`);
    }
    lines.push(`\n**Total**: **${fmt(totalCasos)} casos** pronosticados (52 semanas).`);
  } else {
    // 3 mapas: uno por padecimiento
    const pads = ['Depresion', 'Parkinson', 'Alzheimer'];
    lines.push(`**Mapa de la Republica Mexicana** por padecimiento (${sexoLabel[filterSexo]})\n`);
    if (isSmape) {
      lines.push('Color: verde (buen SMAPE) a rojo (alto SMAPE).\n');
    } else {
      lines.push('Color: mas oscuro = menor incidencia, mas claro = mayor incidencia.\n');
    }
    for (const pad of pads) {
      const sorted = aggregateMap(pad, filterSexo);
      const totalCasos = sorted.reduce((a, e) => a + e.casos, 0);
      const top3 = sorted.slice(0, 3);
      lines.push(`**${pad}** - ${fmt(totalCasos)} casos totales:`);
      lines.push(`  Top 3: ${top3.map(e => e.e + ' (' + fmt(e.casos) + ')').join(', ')}`);
    }
    // Dengue: pronóstico 52 sem por entidad (consistente con neuro).
    if (!isSmape && d.dengue && d.dengue.por_entidad) {
      const pe = Object.entries(d.dengue.por_entidad).sort((a, b) => b[1] - a[1]);
      const tot = pe.reduce((a, kv) => a + kv[1], 0);
      lines.push(`**Dengue** - ${fmt(tot)} casos pronosticados (52 sem):`);
      lines.push(`  Top 3: ${pe.slice(0, 3).map(kv => kv[0] + ' (' + fmt(kv[1]) + ')').join(', ')}`);
    }
  }

  return lines.join('\n');
}

function answerTreemap(q, ent, s, d) {
  const triggers = ['treemap', 'mapa de entidad', 'panorama de entidad', 'panorama nacional'];
  const triggerAlt = (any(q, ['caso', 'pronostico']) && any(q, ['todas las entidad', 'todos los estado', 'por entidad', 'por estado']) && any(q, ['grafico', 'grafica', 'mostrar', 'ver']));
  if (!any(q, triggers) && !triggerAlt) return null;

  const models = d.prod_models || [];
  if (!models.length) return null;

  const byEnt = {};
  for (const m of models) {
    if (m.sexo !== 'general') continue;
    if (!isNeuro(m.padecimiento)) continue; // panorama neuro; Dengue va aparte
    const e = m.entidad || '';
    if (e === 'Nacional' || e.startsWith('region_')) continue;
    if (!byEnt[e]) byEnt[e] = { casos: 0, smapes: [] };
    byEnt[e].casos += m.casos_52_semanas_futuro || 0;
    if (m.smape_prod != null) byEnt[e].smapes.push(m.smape_prod);
  }

  const sorted = Object.entries(byEnt)
    .map(([e, d]) => ({ e, casos: d.casos, smape: d.smapes.length ? (d.smapes.reduce((a, v) => a + v, 0) / d.smapes.length).toFixed(1) : '?' }))
    .sort((a, b) => b.casos - a.casos);

  const lines = [];
  lines.push(`**Panorama nacional**: pronostico por entidad (${sorted.length} estados).\n`);
  lines.push('Color: verde (SMAPE < 30%) | amarillo (30-60%) | rojo (> 60%)\n');

  const top5 = sorted.slice(0, 5);
  lines.push('**Top 5 entidades** (mayor pronostico):');
  lines.push('| Entidad | Casos (52 sem) | SMAPE prom |');
  lines.push('|---------|---------------:|-----------:|');
  for (const e of top5) {
    lines.push(`| ${e.e} | ${fmt(e.casos)} | ${e.smape}% |`);
  }

  const totalCasos = sorted.reduce((a, e) => a + e.casos, 0);
  lines.push(`\n**Total nacional** (sin regiones): **${fmt(totalCasos)} casos** pronosticados.`);

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// RADAR — comparativa de motores
// ---------------------------------------------------------------------------

function answerRadar(q, ent, s, d) {
  const triggers = ['radar', 'spider', 'mejor motor', 'cual motor', 'cual es mejor'];
  const triggerAlt = any(q, ['comparar', 'comparativa']) && any(q, ['motor', 'algoritmo']);
  if (!any(q, triggers) && !triggerAlt) return null;

  const pm = s.por_motor;
  const dist = s.dist_motor;
  if (!pm || !dist) return null;

  const motors = Object.keys(pm);
  const totalSeries = Object.values(dist).reduce((a, v) => a + v, 0);

  const lines = [];
  lines.push('**Radar comparativo de motores**: 5 ejes normalizados (mayor area = mejor).\n');

  lines.push('| Motor | SMAPE | MASE | Series ganadas | RMSE | MAE |');
  lines.push('|-------|------:|-----:|---------------:|-----:|----:|');
  for (const m of motors) {
    const p = pm[m];
    const pct = ((dist[m] || 0) / totalSeries * 100).toFixed(0);
    lines.push(`| ${m} | ${p.smape_mean.toFixed(1)}% | ${p.mase_mean.toFixed(2)} | ${dist[m] || 0} (${pct}%) | ${p.rmse_mean.toFixed(1)} | ${p.mae_mean.toFixed(1)} |`);
  }

  // Determinar ganador por mayor area (menor metricas + mas series)
  const scores = motors.map(m => {
    const p = pm[m];
    return { m, score: (100 - p.smape_mean) + (100 - p.mase_mean * 50) + ((dist[m] || 0) / totalSeries * 100) };
  }).sort((a, b) => b.score - a.score);

  lines.push(`\n**Motor con mayor area**: ${scores[0].m} — mejor balance entre precision y cobertura.`);

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// SPARKLINES — grid de mini-graficos por estado
// ---------------------------------------------------------------------------

function answerSparklines(q, ent, s, d) {
  const triggers = ['sparkline', 'mini grafico', 'panorama', 'vista general'];
  const triggerAlt = any(q, ['todos los estado', '32 estado', 'cada estado', 'todas las entidad']);
  if (!any(q, triggers) && !triggerAlt) return null;

  // No activar si pide panorama de entidad (treemap)
  if (q.includes('entidad') && (q.includes('caso') || q.includes('pronostico'))) return null;

  const models = d.prod_models || [];
  if (!models.length) return null;

  const pads = ['Depresion', 'Parkinson', 'Alzheimer'];
  const byEnt = {};
  for (const m of models) {
    if (m.sexo !== 'general') continue;
    const e = m.entidad || '';
    if (e === 'Nacional' || e.startsWith('region_')) continue;
    if (!byEnt[e]) byEnt[e] = {};
    byEnt[e][m.padecimiento] = m.casos_52_semanas_futuro || 0;
  }

  const sorted = Object.entries(byEnt)
    .map(([e, d]) => ({ e, total: pads.reduce((a, p) => a + (d[p] || 0), 0) }))
    .sort((a, b) => b.total - a.total);

  const wantAll = any(q, ['todos', 'todas', 'cada estado', 'cada entidad', '32 estad', '32 entidad', 'completa', 'completo']);
  const shown = wantAll ? sorted.length : Math.min(16, sorted.length);
  const lines = [];
  lines.push(`**Vista panoramica**: pronostico 52 semanas por entidad (${sorted.length} estados).\n`);
  lines.push(wantAll
    ? `Se muestran **los ${shown} estados** en mini-graficos.\n`
    : `Se muestran los **${shown} estados** con mayor pronostico en mini-graficos (pide "todos los estados" para ver los ${sorted.length}).\n`);
  lines.push(`Total de estados: **${sorted.length}** | Padecimientos: Dep / Park / Alz`);

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// STACKED AREA — composicion semanal apilada
// ---------------------------------------------------------------------------

function answerStackedArea(q, ent, s, d) {
  const triggers = ['apilad', 'stacked', 'composicion', 'composicion semanal'];
  const triggerAlt = (any(q, ['proporcion', 'distribucion']) && any(q, ['semanal', 'semana'])) ||
    (any(q, ['area']) && any(q, ['padecimiento', 'enfermedad']));
  if (!any(q, triggers) && !triggerAlt) return null;

  const wc = d.weekly_comparison;
  if (!wc) return null;

  const pads = Object.keys(wc).filter(isNeuro);
  const totalPron = pads.reduce((a, p) => {
    return a + (wc[p]?.semanas || []).reduce((s, w) => s + w.pronostico, 0);
  }, 0);

  const lines = [];
  lines.push('**Composicion semanal apilada**: pronostico de los 3 padecimientos semana a semana.\n');
  lines.push(`Pronostico total (52 sem): **${fmt(totalPron)} casos**\n`);

  for (const p of pads) {
    const sems = wc[p]?.semanas || [];
    const total = sems.reduce((a, s) => a + s.pronostico, 0);
    const pct = totalPron > 0 ? ((total / totalPron) * 100).toFixed(1) : '?';
    lines.push(`- **${p}**: ${fmt(total)} casos (${pct}%)`);
  }

  lines.push('\n*El área de cada padecimiento muestra su proporción del total semanal.*');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// CORREDOR DE CONFIANZA — banda de 4 modelos
// ---------------------------------------------------------------------------

function answerCorredor(q, ent, s, d) {
  const triggers = ['corredor', 'confianza', 'banda', 'incertidumbre', 'consenso', 'dispersion'];
  const triggerAlt = any(q, ['4 modelo', 'cuatro modelo', 'los 4', 'los cuatro']);
  if (!any(q, triggers) && !triggerAlt) return null;

  const wc = d.weekly_comparison;
  if (!wc) return null;

  const MODELS = ['prophet', 'deepar', 'ensemble', 'stacking'];
  const pad = ent.padecimiento;
  // Cohorte neuro: el corredor compara los 4 motores. Dengue (prophet/deepar/nbglm)
  // se sirve por answerDengue, así que aquí solo neuro.
  const pads = pad ? [pad].filter(p => wc[p] && isNeuro(p)) : Object.keys(wc).filter(isNeuro);
  if (!pads.length) return null;
  const lines = [];

  lines.push('**Corredor de confianza**: banda formada por los 4 modelos (Prophet, DeepAR, Ensemble, Stacking).\n');
  lines.push('Donde la banda es **estrecha**, los modelos coinciden (alta confianza). Donde es **ancha**, hay divergencia.\n');

  for (const p of pads) {
    const info = wc[p];
    const sems = info.semanas || [];
    const spreads = sems.map(s => {
      const vals = MODELS.map(m => s[m] || 0);
      return Math.max(...vals) - Math.min(...vals);
    });
    const avgSpread = Math.round(spreads.reduce((a, v) => a + v, 0) / spreads.length);
    const maxSpread = Math.max(...spreads);
    const maxSpreadSem = sems[spreads.indexOf(maxSpread)]?.semana || '?';
    const minSpread = Math.min(...spreads);
    const minSpreadSem = sems[spreads.indexOf(minSpread)]?.semana || '?';

    lines.push(`**${p}** (productivo: ${info.modelo_productivo || '-'}):`);
    lines.push(`- Dispersión promedio: **${fmt(avgSpread)} casos/semana**`);
    lines.push(`- Mayor divergencia: semana ${maxSpreadSem} (**${fmt(maxSpread)} casos** de diferencia)`);
    lines.push(`- Mayor consenso: semana ${minSpreadSem} (**${fmt(minSpread)} casos** de diferencia)`);
    lines.push('');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// HEATMAP DE ERROR — donde acierta y falla el modelo
// ---------------------------------------------------------------------------

function answerErrorHeatmap(q, ent, s, d) {
  const triggers = ['heatmap', 'mapa de calor', 'donde falla', 'donde acierta'];
  const triggerAlt = any(q, ['error']) && any(q, ['semanal', 'semana', 'por semana']);
  if (!any(q, triggers) && !triggerAlt) return null;

  const wc = d.weekly_comparison;
  if (!wc) return null;

  const pad = ent.padecimiento;
  const pads = pad ? [pad].filter(p => wc[p] && isNeuro(p)) : Object.keys(wc).filter(isNeuro);
  if (!pads.length) return null;
  const lines = [];

  lines.push('**Mapa de error semanal**: porcentaje de desviación entre pronostico y realidad.\n');
  lines.push('Verde (< 15%) = bueno | Amarillo (15-40%) = aceptable | Rojo (> 40%) = fallo\n');

  for (const p of pads) {
    const sems = (wc[p]?.semanas || []).filter(s => s.real != null);
    if (!sems.length) continue;

    const errors = sems.map(s => {
      if (s.real === 0) return s.pronostico > 0 ? 100 : 0;
      return Math.abs(((s.pronostico - s.real) / s.real) * 100);
    });
    const good = errors.filter(e => e <= 15).length;
    const ok = errors.filter(e => e > 15 && e <= 40).length;
    const bad = errors.filter(e => e > 40).length;
    const avgErr = (errors.reduce((a, v) => a + v, 0) / errors.length).toFixed(1);
    const worstIdx = errors.indexOf(Math.max(...errors));
    const bestIdx = errors.indexOf(Math.min(...errors));

    lines.push(`**${p}** (${sems.length} semanas con datos):`);
    lines.push(`- Error promedio: **${avgErr}%**`);
    lines.push(`- Semanas verdes (< 15%): **${good}** | amarillas: **${ok}** | rojas: **${bad}**`);
    lines.push(`- Mejor semana: S${String(sems[bestIdx].semana).padStart(2, '0')} (**${errors[bestIdx].toFixed(1)}%**)`);
    lines.push(`- Peor semana: S${String(sems[worstIdx].semana).padStart(2, '0')} (**${errors[worstIdx].toFixed(1)}%**)`);
    lines.push('');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// ZOOM SEMANAL — vista detallada 2025-2027 (real vs pronostico)
// ---------------------------------------------------------------------------

function zoomIsoWeek(iso) {
  const dt = new Date(iso + 'T00:00:00'); dt.setHours(0, 0, 0, 0);
  dt.setDate(dt.getDate() + 3 - ((dt.getDay() + 6) % 7));
  const w1 = new Date(dt.getFullYear(), 0, 4);
  return 1 + Math.round(((dt - w1) / 864e5 - 3 + ((w1.getDay() + 6) % 7)) / 7);
}

// Texto del zoom por SERIE (estado × sexo), usando d.zoom_series (precargado).
function zoomSeriesText(s, pad, estado, sexo) {
  const estadoLbl = norm(estado) === 'mexico' ? 'Estado de Mexico' : estado;
  const sexoLbl = sexo === 'general' ? 'ambos sexos' : sexo;
  let realSum = 0, pronSum = 0, nReal = 0;
  for (let i = 0; i < s.d.length; i++) {
    if (s.r[i] != null) { nReal++; realSum += s.r[i]; if (s.y[i] != null) pronSum += s.y[i]; }
  }
  const futSum = s.y.reduce((a, v, i) => (s.r[i] == null && v != null ? a + v : a), 0);
  const diff = realSum - pronSum;
  const signo = diff >= 0 ? '+' : '-';
  const arrastre = diff >= 0 ? 'por encima del pronostico' : 'por debajo del pronostico';
  const errPct = realSum > 0 ? Math.abs((diff / realSum) * 100).toFixed(1) : '-';
  const wk = s.last_real ? zoomIsoWeek(s.last_real) : null;
  const lines = [];
  lines.push(`**Zoom semanal: ${pad} — ${estadoLbl} (${sexoLbl})**\n`);
  lines.push(`Real vs pronostico hasta la **semana ${wk != null ? wk : '-'}** (${s.last_real || '-'}), motor **${s.motor || '-'}**.\n`);
  lines.push(`- Semanas reales mostradas: **${nReal}**`);
  lines.push(`- Real acumulado: **${fmt(Math.round(realSum))}** · pronostico (mismas semanas): **${fmt(Math.round(pronSum))}**`);
  lines.push(`- Diferencia (real - pronostico): **${signo}${fmt(Math.round(Math.abs(diff)))}** casos (${arrastre}, error **${errPct}%**)`);
  lines.push(`- Pronostico a futuro (post semana ${wk != null ? wk : '-'}): **${fmt(Math.round(futSum))}** casos`);
  lines.push('\n*Línea sólida = real (boletin SINAVE), punteada = pronostico del motor productivo.*');
  return lines.join('\n');
}

function answerZoom(q, ent, s, d) {
  const triggers = ['zoom', 'detalle semanal', 'vista cercana', 'acercamiento'];
  const triggerAlt = (q.includes('real') && q.includes('pronostico') && q.includes('semanal')) ||
    (q.includes('semana a semana') && (q.includes('pronostico') || q.includes('modelo')));
  if (!triggers.some(t => q.includes(t)) && !triggerAlt) return null;

  // Por estado (y sexo): zoom de la serie específica si se detectó entidad y ya cargó el índice.
  if (ent.estado && ent.padecimiento && d.zoom_series) {
    const sexo = ent.sexo || 'general';
    const serie = d.zoom_series[`${norm(ent.padecimiento)}|${norm(ent.estado)}|${sexo}`];
    if (serie) return zoomSeriesText(serie, ent.padecimiento, ent.estado, sexo);
  }

  const wc = d.weekly_comparison;
  if (!wc) return null;

  const tc = d.training_config || {};
  const pads = Object.keys(wc);
  const pad = ent.padecimiento;
  // Dengue explícito conserva su zoom (answerDengue lo difiere aquí); el agregado es neuro.
  const filtered = pad ? pads.filter(p => p === pad) : pads.filter(isNeuro);

  const lines = [];
  lines.push('**Zoom semanal: Real vs Pronostico**\n');

  const rng = forecastDateRange(d);
  if (rng) {
    lines.push(`Horizonte: **${rng.label}**\n`);
  }

  for (const p of filtered) {
    const info = wc[p];
    const sems = info.semanas || [];
    const withReal = sems.filter(s => s.real != null);
    const totalReal = withReal.reduce((a, s) => a + s.real, 0);
    const totalPron = sems.reduce((a, s) => a + s.pronostico, 0);
    const modelo = info.modelo_productivo || '-';

    const ultimaSem = withReal.length > 0
      ? Math.max(...withReal.map(s => s.semana || 0))
      : 0;

    lines.push(`**${p}** (${modelo}):`);
    lines.push(`- Semanas con datos reales: **${withReal.length}** de ${sems.length}`);
    lines.push(`- Casos reales acumulados: **${fmt(totalReal)}**`);
    lines.push(`- Pronostico total (52 sem): **${fmt(totalPron)}**`);

    if (withReal.length > 0) {
      const realSum = withReal.reduce((a, s) => a + s.real, 0);
      const pronSum = withReal.reduce((a, s) => a + s.pronostico, 0);
      // Diferencia real - pronostico: positivo = realidad por ENCIMA del pronostico.
      const diff = realSum - pronSum;
      const signo = diff >= 0 ? '+' : '-';
      const arrastre = diff >= 0 ? 'por encima del pronostico' : 'por debajo del pronostico';
      const errorPct = realSum > 0 ? Math.abs((diff / realSum) * 100).toFixed(1) : '-';
      lines.push(`- Pronostico acumulado (a la semana ${ultimaSem}): **${fmt(pronSum)}**`);
      lines.push(`- Diferencia (real - pronostico): **${signo}${fmt(Math.abs(diff))}** casos (${arrastre})`);
      lines.push(`- Error acumulado (semanas con datos): **${errorPct}%**`);
    }
    lines.push('');
  }

  lines.push('*Línea sólida = datos reales, línea punteada = pronostico del modelo productivo.*');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// HISTORICO — prioriza años pasados sobre pronóstico
// ---------------------------------------------------------------------------

function answerHistorico(q, ent, s, d) {
  const years = ent._years || [];
  if (!years.length) return null;

  // Si pide pron\u00f3sticos, dejar que answerPronostico se encargue
  const futureKw = ['pronostic', 'forecast', 'prediccion', 'predice', 'predecir',
    'se espera', 'se esperan', 'estima', 'estiman', 'habra', 'va a haber'];
  if (futureKw.some(t => q.includes(t))) return null;

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

  // A\u00f1o parcial
  const maxWeek = bol.meta?.max_semana || 52;
  const maxAnio = bol.meta?.max_anio || currentYear;
  const isPartialYear = (y) => y === currentYear && maxAnio === currentYear && maxWeek < 48;

  const months = ent._months || [];
  const lines = [];

  for (const year of pastYears) {
    const ys = String(year);
    const partial = isPartialYear(year);
    const partialNote = partial ? ` *(parcial, semana ${maxWeek} de 52)*` : '';

    // Intentar estado primero
    if (estado) {
      const estKey = Object.keys(anualEst).find(k => norm(k) === norm(estado));
      if (estKey && pad) {
        const val = anualEst[estKey]?.[pad]?.[ys];
        if (val != null) {
          if (months.length > 0) {
            const mText = monthEstimateText(val, months, [year], pad, estKey, d);
            if (mText) { lines.push(mText); continue; }
          }
          lines.push(`En **${year}**, se reportaron **${fmt(val)} casos de ${pad}** en ${estKey}.${partialNote}`);
          if (!partial) {
            const prev = anualEst[estKey]?.[pad]?.[String(year - 1)];
            if (prev != null && prev > 0) {
              const pctChg = (((val - prev) / prev) * 100).toFixed(1);
              const arrow = pctChg > 0 ? 'aumento' : 'disminuci\u00f3n';
              lines.push(`Esto representa un **${arrow} del ${Math.abs(pctChg)}%** respecto a ${year - 1} (${fmt(prev)} casos).`);
            }
          }
          continue;
        }
      }
      // Estado sin datos → avisar y usar nacional
      if (pad) {
        const nacVal = anualNac[pad]?.[ys];
        if (nacVal != null) {
          if (months.length > 0) {
            const mText = monthEstimateText(nacVal, months, [year], pad, null, d);
            if (mText) { lines.push(mText); continue; }
          }
          lines.push(`No tengo datos hist\u00f3ricos anuales cargados para **${estado}** en este momento. Tengo desglose de ${Object.keys(anualEst).length} entidades.\n\nA nivel **nacional**, en ${year} se reportaron **${fmt(nacVal)} casos de ${pad}**.${partialNote}`);
          if (!partial) {
            const prev = anualNac[pad]?.[String(year - 1)];
            if (prev != null && prev > 0) {
              const pctChg = (((nacVal - prev) / prev) * 100).toFixed(1);
              const arrow = pctChg > 0 ? 'aumento' : 'disminuci\u00f3n';
              lines.push(`Variaci\u00f3n: **${arrow} del ${Math.abs(pctChg)}%** vs ${year - 1}.`);
            }
          }
          continue;
        }
      }
    }

    // Sin estado, datos nacionales
    if (pad) {
      const nacVal = anualNac[pad]?.[ys];
      if (nacVal != null) {
        if (months.length > 0) {
          const mText = monthEstimateText(nacVal, months, [year], pad, null, d);
          if (mText) { lines.push(mText); continue; }
        }
        lines.push(`En **${year}**, a nivel nacional se reportaron **${fmt(nacVal)} casos de ${pad}**.${partialNote}`);
        if (!partial) {
          const prev = anualNac[pad]?.[String(year - 1)];
          if (prev != null && prev > 0) {
            const pctChg = (((nacVal - prev) / prev) * 100).toFixed(1);
            const arrow = pctChg > 0 ? 'aumento' : 'disminuci\u00f3n';
            lines.push(`Variaci\u00f3n: **${arrow} del ${Math.abs(pctChg)}%** vs ${year - 1}.`);
          }
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

    // Verificar si el año cae dentro del horizonte de pronóstico
    const tc = d.training_config || {};
    const hFin = tc.horizonte_fin;
    const hFinYear = hFin ? new Date(hFin + 'T00:00:00').getFullYear() : null;
    if (hFinYear && year <= hFinYear && year >= currentYear) {
      const rng = forecastDateRange(d);
      const wc = d.weekly_comparison || {};
      if (rng) {
        lines.push(`**${year}** esta cubierto por el horizonte de pronostico (${rng.label}).`);
        if (pad) {
          const info = wc[pad];
          if (info && info.semanas) {
            const semsInYear = info.semanas.filter(s => s.fecha && s.fecha.startsWith(String(year)));
            const pron = semsInYear.reduce((a, s) => a + s.pronostico, 0);
            lines.push(`- ${pad}: **${fmt(pron)} casos** pronosticados en las semanas de ${year} (modelo ${info.modelo_productivo || '-'}).`);
          }
        } else {
          for (const [p, info] of Object.entries(wc)) {
            const semsInYear = info.semanas.filter(s => s.fecha && s.fecha.startsWith(String(year)));
            const pron = semsInYear.reduce((a, s) => a + s.pronostico, 0);
            if (pron > 0) lines.push(`- ${p}: **${fmt(pron)} casos** pronosticados en ${year} (${info.modelo_productivo || '-'})`);
          }
        }
        continue;
      }
    }
    lines.push(`No tengo datos para el año **${year}**. El Boletín Epidemiológico SINAVE (nuestra fuente) cubre de **2014** a **${currentYear}**.`);
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

  const compTriggers = ['compara', 'comparar', 'comparativ', 'comparalo', 'diferencia', 'contrasta',
    ' vs ', 'versus', 'contra ', 'frente a'];
  // Also trigger if 2+ states detected with connectors, or inherited from context
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
      (pad ? m.padecimiento === pad : isNeuro(m.padecimiento))
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
  lines.push(`\n<!--COMPARE:${JSON.stringify(comparisons.map(c => ({ estado: c.estado, total: c.totalCasos, smape: c.avgSmape, motor: c.topMotor ? c.topMotor[0] : '?', models: c.models.map(m => ({ pad: m.padecimiento, casos: m.casos_52_semanas_futuro, smape: m.smape_prod, motor: m.modelo_produccion })) })))}-->`);

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// ESTADO (sin padecimiento espec\u00edfico) — resumen conversacional
// ---------------------------------------------------------------------------

function answerEstado(q, ent, s, d) {
  const estado = ent.estado;
  if (!estado || ent.padecimiento) return null;

  // Las regiones llevan prefijo en por_estado ('region_Metropolitana alta') mientras
  // entities.js las canoniza como 'Region Metropolitana alta'. Resolver via norm().
  const porEstado = s.por_estado || {};
  let estStats = porEstado[estado];
  if (!estStats) {
    const keyMatch = Object.keys(porEstado).find(k => norm(k) === norm(estado));
    if (keyMatch) estStats = porEstado[keyMatch];
  }
  if (!estStats) return null;

  const months = ent._months || [];
  const years = ent._years || [];
  const lines = [];

  // El resumen por entidad es neuro (la nacional/estatal son agregadores de cohorte
  // neuro); Dengue se consulta aparte. por_estado mezcla Dengue para los 32 estados y
  // Nacional, as\u00ed que recalculamos desde prod_models filtrando a la cohorte neuro.
  const models = d.prod_models || [];
  const matchNeuro = models.filter(m => norm(m.entidad || '') === norm(estado) && isNeuro(m.padecimiento));
  if (!matchNeuro.length) return null;
  const estModels = matchNeuro.filter(m => m.sexo === 'general');
  const casosNeuro = estModels.reduce((a, m) => a + (m.casos_52_semanas_futuro || 0), 0);
  const nNeuro = matchNeuro.length;
  const smapeVals = matchNeuro.map(m => m.smape_prod).filter(v => v != null && isFinite(v));
  const smapeMean = smapeVals.length ? Math.round((smapeVals.reduce((a, b) => a + b, 0) / smapeVals.length) * 100) / 100 : null;

  // Lead con hallazgo principal
  if (casosNeuro) {
    lines.push(
      `**${estado}** tiene un pron\u00f3stico de **${fmt(casosNeuro)} casos totales** ` +
      `para las pr\u00f3ximas 52 semanas (${nNeuro} modelos de producci\u00f3n).\n`
    );
  } else {
    lines.push(`**${estado}** cuenta con **${nNeuro} modelos** de producci\u00f3n.\n`);
  }

  // Estimaci\u00f3n mensual
  if (months.length > 0 && casosNeuro) {
    const mText = monthEstimateText(casosNeuro, months, years, null, estado, d);
    if (mText) lines.push(mText + '\n');
  }

  // Confianza
  if (smapeMean != null) {
    const conf = confidence(smapeMean);
    lines.push(`Confianza general: **${conf}** (SMAPE promedio: ${smapeMean}%)`);
  }

  // Desglose por padecimiento (solo general, cohorte neuro)
  if (estModels.length) {
    lines.push('\n| Padecimiento | Pron\u00f3stico 52 sem | Motor | SMAPE |');
    lines.push('|-------------|-------------------|-------|-------|');
    for (const m of estModels) {
      lines.push(`| ${m.padecimiento} | ${fmt(m.casos_52_semanas_futuro)} casos | ${m.modelo_produccion} | ${m.smape_prod}% |`);
    }
  }

  // Motor dominante (neuro)
  const dist = {};
  for (const m of matchNeuro) {
    if (m.modelo_produccion) dist[m.modelo_produccion] = (dist[m.modelo_produccion] || 0) + 1;
  }
  const dominant = Object.entries(dist).sort((a, b) => b[1] - a[1])[0];
  if (dominant) lines.push(`\nMotor dominante: **${dominant[0]}** (${dominant[1]} de ${nNeuro} series)`);

  // Para Dengue en esta entidad, consulta aparte.
  lines.push('\n*El pron\u00f3stico de Dengue se consulta por separado (preg\u00fantame por dengue).*');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// PADECIMIENTO (sin estado) — resumen inteligente
// ---------------------------------------------------------------------------

function answerPadecimiento(q, ent, s, d) {
  const pad = ent.padecimiento;
  if (!pad || ent.estado) return null;

  // Historia / origen / descubrimiento → ceder a Gemini (conocimiento general)
  const historyKw = [
    'historia', 'origen', 'descubri', 'quien fue', 'de donde viene',
    'por que se llama', 'como se descubri', 'cuando se descubri',
    'nombr', 'bautiz', 'pakistan', 'inventor', 'creador', 'identifico', 'identificar',
  ];
  if (any(q, historyKw)) return null;

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
    'quien gana', 'quien ganara', 'ganara', 'ganar', 'ganando', 'lidera', 'lider',
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
      // Si piden "todos / completa / 32 / cada", listar todas las entidades.
      const wantAll = any(q, ['todos', 'todas', 'completa', 'completo', 'lista completa', 'el listado', 'cada estado', 'cada entidad', '32 estados', '32 entidades']);
      const rows = wantAll ? padModels : padModels.slice(0, 10);
      lines.push(`**Entidades con ${label} pronóstico de ${pad}** (52 semanas)${wantAll ? ` — las ${rows.length}` : ''}:\n`);
      lines.push('| # | Entidad | Casos pronosticados | Motor | SMAPE |');
      lines.push('|---|---------|--------------------:|-------|-------|');
      rows.forEach((m, i) => {
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

  // Distribucion de motores: tabla + dona (la dona solo si la consulta es de modelos, para
  // no suprimir el grafico de pronostico via el guard de imagen en consultas generales).
  const dist = ps.dist_motor;
  if (dist) {
    const orden = Object.entries(dist).sort((a, b) => b[1] - a[1]);
    lines.push('\n**Distribución de motores:**\n');
    lines.push('| Motor | Series | % |');
    lines.push('|:------|-------:|---:|');
    for (const [motor, n] of orden) {
      const g = motor === ps.motor_ganador ? ' (ganador)' : '';
      lines.push(`| ${motor}${g} | ${fmt(n)} | ${((n / ps.n) * 100).toFixed(0)}% |`);
    }
    if (any(q, ['tabla', 'modelo', 'motor', 'distribucion', 'reparto'])) {
      const padFile = pad.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      lines.push(
        '',
        `![Distribución de motores productivos de ${pad}](../Reports/motores/${padFile}_motores_dona.png)`,
      );
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

  if (any(q, ['gana', 'ganador', 'cual gana', 'que modelo', 'comparar modelo', 'comparativa', 'comparacion', 'comparan', 'comparar motor'])) {
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

  // Si pregunta por casos/pronosticos, ceder a answerPronostico
  const pronoWords = ['caso', 'pronostic', 'predicci', 'esperado', 'esperan', 'futuro', '52 semana', 'proxima'];
  if (pronoWords.some(w => q.includes(w))) return null;

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
    // Cohorte neuro (Dengue se cuenta aparte); robusto para regiones (clave con prefijo).
    const nNeuro = (d.prod_models || []).filter(m => norm(m.entidad || '') === norm(estado) && isNeuro(m.padecimiento)).length;
    if (nNeuro) lines.push(`**${estado}** tiene **${nNeuro} modelos** de producci\u00f3n (cohorte neurol\u00f3gica).`);
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
    'pronostic', 'casos futuro', 'futuro 52', '52 semanas', 'proximas', 'siguientes', 'forecast',
    'prediccion', 'predice', 'predecir', 'casos esperado', 'se esperan', 'se espera',
    'se estima', 'se estiman', 'habra', 'va a haber',
    'cuantos caso', 'cuantas caso',
  ];
  if (!any(q, triggers)) return null;

  // Si tiene pad+estado, dejar que answerSpecificSeries se encargue
  if (ent.padecimiento && ent.estado) return null;

  const pad = ent.padecimiento, estado = ent.estado;
  const months = ent._months || [];
  const years = ent._years || [];
  const lines = [];
  const rng = forecastDateRange(d);
  const horizLabel = rng ? `**${rng.startDate}** a **${rng.endDate}**` : '52 semanas';
  const entrenLabel = rng?.entrenam ? `Ultimo entrenamiento: **${rng.entrenam}**` : null;

  if (pad && !estado) {
    const ps = s.por_pad?.[pad];
    if (!ps?.casos_futuro_total) return null;

    lines.push(
      `Se pronostican **${fmt(ps.casos_futuro_total)} casos de ${pad}** a nivel nacional ` +
      `en las pr\u00f3ximas 52 semanas.\n`
    );
    if (rng) lines.push(`Horizonte: ${horizLabel}`);
    if (entrenLabel) lines.push(entrenLabel + '\n');

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
    // Cohorte neuro (Dengue aparte); recalcula desde prod_models para no mezclar Dengue.
    const genNeuro = (d.prod_models || []).filter(m =>
      norm(m.entidad || '') === norm(estado) && m.sexo === 'general' && isNeuro(m.padecimiento));
    const casosNeuro = genNeuro.reduce((a, m) => a + (m.casos_52_semanas_futuro || 0), 0);
    if (!casosNeuro) return null;

    lines.push(
      `Se pronostican **${fmt(casosNeuro)} casos totales en ${estado}** ` +
      `para las pr\u00f3ximas 52 semanas.\n`
    );
    if (rng) lines.push(`Horizonte: ${horizLabel}`);
    if (entrenLabel) lines.push(entrenLabel + '\n');

    if (months.length) {
      const mText = monthEstimateText(casosNeuro, months, years, null, estado, d);
      if (mText) lines.push(mText);
    }

  } else {
    // Pron\u00f3stico Nacional
    lines.push(`**Pron\u00f3stico Nacional**: **${fmt(s.pronostico_total)} casos** en las pr\u00f3ximas 52 semanas.\n`);
    if (rng) lines.push(`Horizonte: ${horizLabel}`);
    if (entrenLabel) lines.push(entrenLabel + '\n');

    if (months.length) {
      const mText = monthEstimateText(s.pronostico_total, months, years, null, null, d);
      if (mText) lines.push(mText + '\n');
    }

    // Buscar motores reales de Nacional (general) en prod_models
    const nacModels = (d.prod_models || []).filter(m => norm(m.entidad || '') === 'nacional' && m.sexo === 'general');
    const nacMotorMap = {};
    for (const m of nacModels) nacMotorMap[m.padecimiento] = m.modelo_produccion || '-';

    const pp = s.por_pad || {};
    lines.push('| Padecimiento | Pron\u00f3stico 52 sem | Modelo productivo |');
    lines.push('|-------------|-------------------|-------------------|');
    for (const [p, ps] of Object.entries(pp)) {
      if (!isNeuro(p)) continue; // Dengue es cohorte de conteos, se consulta aparte
      if (ps.casos_futuro_total) {
        const motor = nacMotorMap[p] || ps.motor_ganador || '-';
        lines.push(`| ${p} | ${fmt(ps.casos_futuro_total)} casos | ${motor} |`);
      }
    }
    lines.push('\n*El pron\u00f3stico de Dengue se consulta por separado (preg\u00fantame por dengue).*');
  }

  return lines.length ? lines.join('\n') : null;
}

function answerDefinicion(q, ent, s, d) {
  const triggers = ['que significa', 'definicion', ' cie', 'cie-10', 'cie 10', 'codigo', 'que quiere decir', 'como se define', 'a que se refiere'];
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
  'tendencia','historica','historico','evolucion','boletin','zoom','detalle','cercano','acercamiento',
  'corredor','confianza','banda','incertidumbre','consenso','dispersion','heatmap','mapa de calor','error',
  'treemap','radar','spider','sparkline','panorama','vista general','apilado','stacked','composicion',
  'mapa','republica','coropletico','geografico',
  'timelapse','animacion','semaforo','alerta','riesgo','reporte','exportar','pdf','ejecutivo',
  'depresion','parkinson','alzheimer',
  'dengue','dengues','arbovirosis','brote','epidemia',
  'deepar','prophet','ensemble','stacking','nbglm',
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
  'historia', 'origen', 'descubrio', 'nombre', 'inventor', 'creador',
  // Adjetivos/sustantivos validos que NO deben corregirse a un padecimiento:
  // "depresivo" (adjetivo) != "depresion" (la enfermedad modelada). Evita que
  // una consulta clinica/personal se convierta en un volcado de datos.
  'depresivo', 'depresiva', 'depresivos', 'depresivas', 'deprimido', 'deprimida',
  'narcisista', 'narcicista', 'narcisistas', 'psicotico', 'psicotica',
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
// Handler: Comparacion semanal Real vs Pronostico 2026
// ---------------------------------------------------------------------------

// Handler dedicado: comparación de desempeño por sexo (hombres vs mujeres)
function answerComparacionPorSexo(q, ent, s, d) {
  const trigger =
    (q.includes('hombre') && q.includes('mujer')) ||
    /\b(por sexo|entre sexos|por genero|comparativa de sexo|desempeno.*sexo|sexo.*desempeno)\b/.test(q);
  if (!trigger) return null;
  // Necesita un verbo de comparación o métrica para confirmar intención
  const verb = /\b(compar|diferenci|contrast|versus|\bvs\b|desempeno|metric|smape|pronost|cual.*mejor|cual.*peor)/.test(q);
  if (!verb) return null;

  const models = d?.prod_models || [];
  if (!models.length) return null;

  const PADS = ['Depresion', 'Parkinson', 'Alzheimer'];
  const PAD_LABEL = { Depresion: 'Depresión', Parkinson: 'Parkinson', Alzheimer: 'Alzheimer' };
  const SEXES = ['hombres', 'mujeres'];

  // Filtra a 32 estados (sin Nacional/regiones) para evitar doble conteo en pronóstico
  const realStates = models.filter(m =>
    m.entidad !== 'Nacional' &&
    !String(m.entidad || '').startsWith('Region') &&
    !String(m.entidad || '').startsWith('region')
  );

  const lines = ['**Desempeño del modelo: hombres vs mujeres**\n'];
  lines.push('Comparativa basada en los 333 modelos productivos (32 estados, sin doble conteo). Métricas SMAPE más bajas = mejor precisión.\n');
  lines.push('| Padecimiento | Sexo | N | SMAPE medio | MASE medio | Pronóstico 52 sem |');
  lines.push('|---|---|---:|---:|---:|---:|');

  const summary = {};
  for (const pad of PADS) {
    summary[pad] = {};
    for (const sx of SEXES) {
      const subset = realStates.filter(m => m.padecimiento === pad && m.sexo === sx);
      const smapes = subset.map(m => m.smape_prod).filter(v => v != null);
      const mases = subset.map(m => m.mase_prod).filter(v => v != null);
      const forecast = subset.reduce((sum, m) => sum + (m.casos_52_semanas_futuro || 0), 0);
      const smapeAvg = smapes.length ? smapes.reduce((a, b) => a + b, 0) / smapes.length : null;
      const maseAvg = mases.length ? mases.reduce((a, b) => a + b, 0) / mases.length : null;
      summary[pad][sx] = { n: subset.length, smapeAvg, maseAvg, forecast };
      const sxLabel = sx === 'hombres' ? 'Hombres' : 'Mujeres';
      lines.push(`| **${PAD_LABEL[pad]}** | ${sxLabel} | ${subset.length} | ${smapeAvg != null ? smapeAvg.toFixed(2) + '%' : '—'} | ${maseAvg != null ? maseAvg.toFixed(2) : '—'} | ${fmt(forecast)} |`);
    }
  }

  // Lecturas accionables
  lines.push('\n**Lecturas clave:**');
  for (const pad of PADS) {
    const h = summary[pad].hombres;
    const m = summary[pad].mujeres;
    if (h.smapeAvg == null || m.smapeAvg == null) continue;
    const mejor = h.smapeAvg < m.smapeAvg ? 'hombres' : 'mujeres';
    const peor = mejor === 'hombres' ? 'mujeres' : 'hombres';
    const diff = Math.abs(h.smapeAvg - m.smapeAvg).toFixed(2);
    const ratio = h.forecast && m.forecast ? (m.forecast / h.forecast).toFixed(2) : null;
    lines.push(`- **${PAD_LABEL[pad]}**: el modelo precisa más en **${mejor}** (SMAPE más bajo por ${diff} puntos vs ${peor}). ` +
      (ratio ? `La carga proyectada de mujeres es **${ratio}×** la de hombres.` : ''));
  }

  lines.push('\n**Notas metodológicas:**');
  lines.push('- SMAPE = Error porcentual absoluto simétrico (menor es mejor).');
  lines.push('- MASE = Error escalado vs naive estacional; <1 supera a la línea base.');
  lines.push('- Excluimos series Nacional y regionales para no contar dos veces.');
  lines.push('- En padecimientos con baja incidencia (p. ej., Alzheimer), SMAPE puede inflarse por divisiones cercanas a cero.');

  return lines.join('\n');
}

function answerComparacionSemanal(q, ent, s, d) {
  // Guard: comparaciones por sexo o género no son lo que este handler resuelve.
  // Dejar que answerComparacionPorSexo (o Gemini) las atienda.
  const sexCompare = (q.includes('hombre') && q.includes('mujer')) ||
                     /\b(por sexo|entre sexos|por genero|sexo masculino|sexo femenino|comparativa de sexo)\b/.test(q);
  if (sexCompare) return null;

  const triggers = [
    'real vs pronostico', 'real vs prediccion', 'real vs forecast',
    'pronostico vs real', 'prediccion vs real', 'forecast vs real',
    'como va el modelo', 'como van los modelo', 'como se comporta el modelo',
    'compara semana', 'comparar semana', 'comparacion semanal',
    'comparativa semanal', 'semana a semana',
    'que tan bien pronostic', 'que tan bien predic',
    'acierto semanal', 'acierto por semana',
    'cuantos casos van en', 'cuantos llevamos',
    'acumulado 2026', 'acumulado vs',
    'comparalo', 'comparalos', 'comparar contra', 'compara contra',
    'contra el pronostico', 'contra lo pronosticado',
  ];

  // Also match: "compara real" / "compara pronostico" / "como va depresion 2026"
  // "como se comportan/estan comportando los modelos", "que tal van los modelos"
  const hasCompare = any(q, triggers) ||
    (any(q, ['compara', 'comparar', 'comparativa', 'como va', 'como van']) &&
     any(q, ['real', 'pronostico', 'prediccion', 'forecast', 'modelo', '2026', 'semana'])) ||
    (any(q, ['comporta', 'comportan', 'comportando', 'funcionando', 'rindiendo', 'que tal van', 'que tal va']) &&
     any(q, ['modelo', 'productivo', 'pronostico', 'prediccion'])) ||
    (any(q, ['como esta', 'como estan', 'como va', 'como van']) &&
     any(q, ['modelo', 'productivo', 'pronostico']));

  // Frases que implican "cuanto habiamos pronosticado" (follow-up a datos reales)
  const retrospectiveTriggers = [
    'habiamos dicho', 'habiamos pronosticado', 'habiamos predicho',
    'dijimos que', 'dijimos', 'se esperaba', 'se pronosticaba',
    'pronosticabamos', 'ibamos a tener', 'iban a ser', 'iba a haber',
    'cuantos habria', 'cuantos iba', 'esperabamos', 'el pronostico decia',
    'cuanto se pronostico', 'cuanto pronosticamos', 'cuanto habiamos',
    'le atinamos', 'atinamos', 'acertamos', 'fallamos',
  ];
  const hasRetrospective = any(q, retrospectiveTriggers);

  // Contexto conversacional: si la ultima respuesta fue de datos semanales o comparacion,
  // ser mas flexible con triggers simples
  const prevWasRelevant = _lastHandlerFn === answerComparacionSemanal || _lastHandlerFn === answerSemanaActual;
  const hasSimpleCompare = prevWasRelevant &&
    (any(q, ['compara', 'comparar', 'solo', 'solo la semana', 'solo semana']) ||
     hasRetrospective ||
     /semana\s*\d/.test(q));

  if (!hasCompare && !hasSimpleCompare && !hasRetrospective) return null;

  const wc = d?.weekly_comparison;
  if (!wc || !Object.keys(wc).length) return null;

  // Detectar si piden una semana especifica: "solo la semana 8", "compara semana 8"
  const weekMatch = q.match(/semana\s*(\d{1,2})/);
  let requestedWeek = weekMatch ? parseInt(weekMatch[1], 10) : null;

  // Si es follow-up retrospectivo sin semana explicita, usar la ultima semana con datos reales
  if (!requestedWeek && hasRetrospective && prevWasRelevant) {
    const firstPad = Object.values(wc)[0];
    if (firstPad && firstPad.semanas) {
      const lastReal = firstPad.semanas.filter(w => w.real != null).pop();
      if (lastReal) requestedWeek = lastReal.semana;
    }
  }

  // Es single-week si dicen "solo", si es retrospectivo, o si es query corto con semana
  const singleWeek = requestedWeek && (
    any(q, ['solo', 'solamente', 'nada mas', 'unicamente', 'especifica']) ||
    hasRetrospective ||
    (q.split(/\s+/).length <= 7 && any(q, ['compara', 'comparar', 'comparalo']))
  );

  // Determine which padecimiento(s) to show. Agregado = cohorte neuro (la fila Total
  // suma solo neuro). Dengue explícito conserva su tabla; lo demás Dengue lo sirve answerDengue.
  const pad = ent.padecimiento;
  const padsToShow = pad ? [pad] : Object.keys(wc).filter(isNeuro);

  const lines = [];

  // Modo semana unica: tabla resumen compacta con los 3 padecimientos
  if (singleWeek && !pad) {
    const anio = Object.values(wc)[0]?.anio || 2026;
    lines.push(`**Semana ${requestedWeek} de ${anio}: Pronostico vs Realidad**\n`);
    lines.push('| Padecimiento | Pronostico | Real | Error |');
    lines.push('|-------------|----------:|-----:|------:|');
    let totalPron = 0, totalReal = 0;
    for (const p of padsToShow) {
      const info = wc[p];
      if (!info || !info.semanas) continue;
      const w = info.semanas.find(s => s.semana === requestedWeek && s.real != null);
      if (!w) continue;
      const pron = w.pronostico || 0;
      const real = w.real || 0;
      const errPct = real > 0 ? (Math.abs(pron - real) / real * 100).toFixed(1) : '0.0';
      const dir = pron > real ? '+' : pron < real ? '-' : '';
      lines.push(`| ${p} | ${fmt(pron)} | ${fmt(real)} | ${dir}${errPct}% |`);
      totalPron += pron;
      totalReal += real;
    }
    if (padsToShow.length > 1 && totalReal > 0) {
      const totalErr = (Math.abs(totalPron - totalReal) / totalReal * 100).toFixed(1);
      const totalDir = totalPron > totalReal ? '+' : totalPron < totalReal ? '-' : '';
      lines.push(`| **Total** | **${fmt(totalPron)}** | **${fmt(totalReal)}** | **${totalDir}${totalErr}%** |`);
    }
    // Interpretacion
    const totalErr = totalReal > 0 ? Math.abs(totalPron - totalReal) / totalReal * 100 : 0;
    lines.push('');
    if (totalErr < 5) lines.push('Precisión **excelente**: el error total es menor al 5%.');
    else if (totalErr < 15) lines.push('Precisión **buena**: el error total está entre 5-15%.');
    else lines.push('Precisión **moderada**: revisar los modelos con mayor desviación.');

    // Embed chart data: one per padecimiento for grid display
    for (const p of padsToShow) {
      const info = wc[p];
      if (!info || !info.semanas) continue;
      const w = info.semanas.find(sw => sw.semana === requestedWeek && sw.real != null);
      if (!w) continue;
      const chartPayload = JSON.stringify({
        pad: p,
        modelo: info.modelo_productivo || '?',
        anio,
        semanas: [{ s: w.semana, r: w.real, p: w.pronostico }],
      });
      lines.push(`\n<!--WEEKLY:${chartPayload}-->`);
    }
    return lines.length > 4 ? lines.join('\n') : null;
  }

  for (const p of padsToShow) {
    const info = wc[p];
    if (!info || !info.semanas) continue;

    const weeks = info.semanas;
    const realWeeks = weeks.filter(w => w.real != null);
    const modelo = info.modelo_productivo || '?';
    const anio = info.anio || 2026;

    if (!realWeeks.length) continue;

    // Si piden semana especifica (pero con padecimiento filtrado), filtrar
    const showWeeks = requestedWeek ? realWeeks.filter(w => w.semana === requestedWeek) : realWeeks;
    if (!showWeeks.length) continue;

    // Acumulados (siempre del total, no del filtro)
    const acumReal = realWeeks.reduce((s, w) => s + w.real, 0);
    const acumPron = realWeeks.reduce((s, w) => s + w.pronostico, 0);
    const diffPct = acumReal > 0 ? ((acumPron - acumReal) / acumReal * 100).toFixed(1) : '?';
    const diffSign = Number(diffPct) > 0 ? '+' : '';

    lines.push(`**${p} — Real vs Pronostico ${anio}** (modelo productivo: ${modelo})\n`);
    lines.push('| Semana | Inicio | Real | Pronostico | Diferencia |');
    lines.push('|--------|--------|-----:|----------:|-----------:|');

    for (const w of showWeeks) {
      const diff = w.pronostico - w.real;
      const sign = diff > 0 ? '+' : '';
      const pctStr = w.error_pct != null ? ` (${w.error_pct}%)` : '';
      const fechaStr = w.fecha ? w.fecha.slice(5) : '';
      lines.push(`| Sem ${w.semana} | ${fechaStr} | ${fmt(w.real)} | ${fmt(w.pronostico)} | ${sign}${fmt(diff)}${pctStr} |`);
    }

    if (!requestedWeek) {
      lines.push('');
      lines.push(`**Acumulado ${realWeeks.length} semanas:** Real **${fmt(acumReal)}** vs Pronostico **${fmt(acumPron)}** (${diffSign}${diffPct}%)`);

      // SMAPE promedio
      const smapes = realWeeks.filter(w => w.error_pct != null && w.real > 0).map(w => {
        const r = w.real, f = w.pronostico;
        return 200 * Math.abs(f - r) / (Math.abs(f) + Math.abs(r));
      });
      if (smapes.length) {
        const avgSmape = (smapes.reduce((a, b) => a + b, 0) / smapes.length).toFixed(1);
        lines.push(`**SMAPE promedio semanal:** ${avgSmape}%`);
      }

      // Upcoming weeks preview
      const futureWeeks = weeks.filter(w => w.real == null).slice(0, 4);
      if (futureWeeks.length) {
        lines.push(`\nPróximas semanas pronosticadas:`);
        for (const w of futureWeeks) {
          lines.push(`- Sem ${w.semana}: **${fmt(w.pronostico)}** casos`);
        }
      }
    }

    // Embed chart data for app.js
    const chartWeeks = requestedWeek
      ? showWeeks.map(w => ({ s: w.semana, r: w.real, p: w.pronostico }))
      : weeks.filter(w => w.real != null || w.semana <= (realWeeks.length + 4))
        .map(w => ({ s: w.semana, r: w.real ?? null, p: w.pronostico }));
    const chartPayload = JSON.stringify({ pad: p, modelo, anio, semanas: chartWeeks });
    lines.push(`\n<!--WEEKLY:${chartPayload}-->`);

    if (padsToShow.length > 1) lines.push('\n---\n');
  }

  return lines.length > 2 ? lines.join('\n') : null;
}

// ---------------------------------------------------------------------------
// Guard: pregunta personal/identidad dirigida al bot
// ---------------------------------------------------------------------------

function answerPreguntaPersonal(q, ent, s, d) {
  const selfPatterns = [
    'a ti te puede', 'te puede dar', 'tepuede dar', 'tu puedes tener', 'tu puedes enfermarte',
    'puedes enfermarte', 'puedes tener', 'te puedes enfermar', 'te va a dar',
    'te dara', 'te dio', 'tienes depresion', 'tienes parkinson', 'tienes alzheimer',
    'una ia puede tener', 'un robot puede tener', 'las maquinas se enferman',
    'te enfermas', 'sufres de', 'padeces de', 'padeces',
    'tu sientes', 'tu siente', 'sientes dolor', 'te duele',
    'eres humano', 'eres una persona', 'eres real', 'estas vivo',
    'tienes sentimiento', 'tienes emocione',
  ];
  if (!any(q, selfPatterns)) return null;

  const pad = ent.padecimiento;
  const lines = [
    'Soy un asistente de inteligencia artificial, asi que no puedo enfermarme, sentir dolor ni padecer enfermedades.',
    '',
  ];

  if (pad) {
    const info = d.padecimiento_info?.[pad];
    const ps = s.por_pad?.[pad];
    if (info) {
      lines.push(`Pero puedo contarte sobre **${info.nombre_completo || pad}** (CIE-10: ${info.cie}):\n`);
      lines.push(info.descripcion);
      if (info.nota_mexico) lines.push(`\n**En Mexico:** ${info.nota_mexico}`);
    }
    if (ps && ps.casos_futuro_total) {
      lines.push(`\n**En nuestro proyecto:** se pronostican **${fmt(ps.casos_futuro_total)} casos** en 52 semanas (SMAPE: ${ps.smape_prod_median}%, motor: ${ps.motor_ganador}).`);
    }
  } else {
    lines.push('Pero puedo ayudarte con informacion sobre **Depresion**, **Parkinson** y **Alzheimer**: pronosticos, datos historicos, metricas de los modelos y mas.');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Handler: Distribucion / violin / histograma de metricas
// ---------------------------------------------------------------------------

function answerDistribucion(q, ent, s, d) {
  const chartKw = ['violin', 'violine', 'boxplot', 'box plot', 'histograma', 'distribucion de'];
  const metricKw = ['smape', 'mase', 'rmse', 'mae'];

  // Follow-up: "solo de la depresion" despues de un grafico de distribucion
  const filterKw = ['solo', 'solamente', 'nada mas', 'unicamente', 'filtra', 'filtrar'];
  const isDistribFollowUp = _lastDistribMetric && !any(q, chartKw) &&
    (ent.padecimiento || ent.estado) && any(q, filterKw);

  if (!any(q, chartKw) && !(any(q, ['grafico', 'grafica', 'chart', 'plot']) && any(q, metricKw)) && !isDistribFollowUp) return null;

  // Detect which metric (use stored for follow-ups)
  let metric = null, metricLabel = '';
  if (isDistribFollowUp) {
    metric = _lastDistribMetric.metric;
    metricLabel = _lastDistribMetric.label;
  } else if (q.includes('mase')) { metric = 'mase_prod'; metricLabel = 'MASE'; }
  else if (q.includes('smape')) { metric = 'smape_prod'; metricLabel = 'SMAPE (%)'; }
  else if (q.includes('rmse')) { metric = 'rmse_prod'; metricLabel = 'RMSE'; }
  else if (q.includes('mae') && !q.includes('smape')) { metric = 'mae_prod'; metricLabel = 'MAE'; }
  else { metric = 'smape_prod'; metricLabel = 'SMAPE (%)'; }

  const models = d.prod_models || [];
  if (!models.length) return null;

  // Filter by padecimiento if detected
  const filterPad = ent.padecimiento;

  // Group values by padecimiento (or single group if filtered)
  const byPad = {};
  for (const m of models) {
    if (m.sexo !== 'general') continue; // Avoid triple-counting
    const pad = m.padecimiento || 'Otro';
    if (filterPad && pad !== filterPad) continue;
    if (!byPad[pad]) byPad[pad] = [];
    const val = m[metric];
    if (val != null && isFinite(val)) byPad[pad].push(val);
  }

  // Build histogram bins per padecimiento
  const allVals = Object.values(byPad).flat();
  if (!allVals.length) return null;

  // Determine bin range
  const sorted = [...allVals].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const maxBin = Math.ceil(p95 * 1.1);
  const numBins = Math.min(20, Math.max(8, Math.ceil(maxBin / 5) * 2));
  const binSize = maxBin / numBins;

  const binLabels = [];
  for (let i = 0; i < numBins; i++) {
    const lo = (i * binSize).toFixed(1);
    const hi = ((i + 1) * binSize).toFixed(1);
    binLabels.push(`${lo}-${hi}`);
  }

  const padNames = Object.keys(byPad).sort();
  const datasets = padNames.map(pad => {
    const counts = new Array(numBins).fill(0);
    for (const v of byPad[pad]) {
      const bin = Math.min(Math.floor(v / binSize), numBins - 1);
      counts[bin]++;
    }
    return { pad, counts };
  });

  // Stats per padecimiento
  const filterNote = filterPad ? ` — ${filterPad}` : '';
  const lines = [`**Distribución de ${metricLabel}${filterNote}** (modelos de producción, sexo=general)\n`];
  lines.push('| Padecimiento | N | Min | Q1 | Mediana | Q3 | Max | Promedio |');
  lines.push('|---|--:|--:|--:|--:|--:|--:|--:|');
  for (const pad of padNames) {
    const vals = [...byPad[pad]].sort((a, b) => a - b);
    const n = vals.length;
    const min = vals[0].toFixed(2);
    const max = vals[n - 1].toFixed(2);
    const q1 = vals[Math.floor(n * 0.25)].toFixed(2);
    const med = vals[Math.floor(n * 0.5)].toFixed(2);
    const q3 = vals[Math.floor(n * 0.75)].toFixed(2);
    const mean = (vals.reduce((a, b) => a + b, 0) / n).toFixed(2);
    lines.push(`| ${pad} | ${n} | ${min} | ${q1} | ${med} | ${q3} | ${max} | ${mean} |`);
  }

  // Embed chart data
  const chartData = { metric: metricLabel, bins: binLabels, datasets };
  lines.push(`\n<!--DISTRIB:${JSON.stringify(chartData)}-->`);

  _lastDistribMetric = { metric, label: metricLabel };
  _lastChartHandler = 'distribucion';
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Handler: Grafico aleatorio / interesante
// ---------------------------------------------------------------------------

function answerGraficoAleatorio(q, ent, s, d) {
  const randomKw = [
    'grafico interesante', 'grafica interesante', 'grafico aleatorio', 'grafica aleatoria',
    'sorprendeme', 'sorprendeme con', 'dame un grafico', 'dame una grafica',
    'grafico random', 'muestrame algo', 'algo interesante', 'visualizacion interesante',
  ];
  const isOtro = /^(otro|otra|uno mas|una mas|dame otro|dame otra|siguiente)(\s|$|\?)/.test(q);
  const isRandomReq = any(q, randomKw) || (isOtro && _lastChartHandler);

  if (!isRandomReq) return null;

  const models = d.prod_models || [];
  const anual = d.boletin?.anual_por_pad;
  if (!models.length) return null;

  // Catalogo de generadores de graficos
  const generators = [];

  // 1. Distribucion de metrica aleatoria
  const metrics = [
    { metric: 'smape_prod', label: 'SMAPE (%)' },
    { metric: 'mase_prod', label: 'MASE' },
    { metric: 'rmse_prod', label: 'RMSE' },
    { metric: 'mae_prod', label: 'MAE' },
  ];
  for (const m of metrics) {
    generators.push(() => _genDistribChart(models, m.metric, m.label));
  }

  // 2. Top 10 modelos por SMAPE (mejores)
  generators.push(() => {
    const top = models.filter(m => m.sexo === 'general' && m.smape_prod != null)
      .sort((a, b) => a.smape_prod - b.smape_prod).slice(0, 10);
    if (!top.length) return null;
    const labels = top.map(m => `${m.padecimiento.slice(0, 3)}-${(m.entidad || '').slice(0, 8)}`);
    const chart = { type: 'bar', title: 'Top 10 modelos: mejor SMAPE', labels,
      datasets: [{ label: 'SMAPE (%)', data: top.map(m => m.smape_prod), backgroundColor: '#2EC4A8CC', borderColor: '#2EC4A8', borderWidth: 1, borderRadius: 4 }] };
    const md = `**Top 10 modelos con mejor SMAPE** (sexo=general)\n\n| # | Padecimiento | Entidad | Motor | SMAPE |\n|--:|---|---|---|--:|\n` +
      top.map((m, i) => `| ${i + 1} | ${m.padecimiento} | ${m.entidad} | ${m.modelo_produccion} | ${m.smape_prod.toFixed(2)}% |`).join('\n');
    return { md, chart };
  });

  // 3. Top 10 peores modelos por SMAPE
  generators.push(() => {
    const worst = models.filter(m => m.sexo === 'general' && m.smape_prod != null)
      .sort((a, b) => b.smape_prod - a.smape_prod).slice(0, 10);
    if (!worst.length) return null;
    const labels = worst.map(m => `${m.padecimiento.slice(0, 3)}-${(m.entidad || '').slice(0, 8)}`);
    const chart = { type: 'bar', title: 'Top 10 modelos: peor SMAPE', labels,
      datasets: [{ label: 'SMAPE (%)', data: worst.map(m => m.smape_prod), backgroundColor: '#C83A5ACC', borderColor: '#C83A5A', borderWidth: 1, borderRadius: 4 }] };
    const md = `**Top 10 modelos con peor SMAPE** (sexo=general)\n\n| # | Padecimiento | Entidad | Motor | SMAPE |\n|--:|---|---|---|--:|\n` +
      worst.map((m, i) => `| ${i + 1} | ${m.padecimiento} | ${m.entidad} | ${m.modelo_produccion} | ${m.smape_prod.toFixed(2)}% |`).join('\n');
    return { md, chart };
  });

  // 4. Composicion de motores (donut)
  generators.push(() => {
    const dist = {};
    for (const m of models) { if (m.sexo === 'general') dist[m.modelo_produccion] = (dist[m.modelo_produccion] || 0) + 1; }
    const entries = Object.entries(dist).sort((a, b) => b[1] - a[1]);
    if (!entries.length) return null;
    const chart = { type: 'doughnut', title: 'Motores de producción: composición', labels: entries.map(e => e[0]),
      datasets: [{ data: entries.map(e => e[1]), backgroundColor: ['#2EC4A8', '#D4A84B', '#C83A5A', '#6366F1'], borderWidth: 0 }] };
    const total = entries.reduce((a, b) => a + b[1], 0);
    const md = `**Composición de motores de producción** (${total} modelos, sexo=general)\n\n` +
      entries.map(([motor, n]) => `- **${motor}**: ${n} modelos (${(n / total * 100).toFixed(1)}%)`).join('\n');
    return { md, chart };
  });

  // 5. Pronostico total por padecimiento (donut)
  generators.push(() => {
    const byPad = {};
    for (const m of models) {
      if (m.sexo !== 'general') continue;
      byPad[m.padecimiento] = (byPad[m.padecimiento] || 0) + (m.casos_52_semanas_futuro || 0);
    }
    const entries = Object.entries(byPad).sort((a, b) => b[1] - a[1]);
    if (!entries.length) return null;
    const total = entries.reduce((a, b) => a + b[1], 0);
    const chart = { type: 'doughnut', title: 'Pronostico 52 semanas por padecimiento', labels: entries.map(e => e[0]),
      datasets: [{ data: entries.map(e => e[1]), backgroundColor: ['#2EC4A8', '#D4A84B', '#C83A5A'], borderWidth: 0 }] };
    const md = `**Pronostico total a 52 semanas por padecimiento** (sexo=general)\n\n` +
      entries.map(([pad, n]) => `- **${pad}**: ${n.toLocaleString('es-MX')} casos (${(n / total * 100).toFixed(1)}%)`).join('\n') +
      `\n- **Total**: ${total.toLocaleString('es-MX')} casos`;
    return { md, chart };
  });

  // 6. Tendencia historica (line)
  if (anual) {
    generators.push(() => {
      const pads = Object.keys(anual);
      let allYears = new Set();
      pads.forEach(p => Object.keys(anual[p]).forEach(y => allYears.add(y)));
      allYears = [...allYears].sort();
      const datasets = pads.map((pad, i) => ({
        pad, data: allYears.map(y => anual[pad][y] || 0),
      }));
      const chart = { type: 'line', title: 'Evolucion historica de incidencia', labels: [...allYears],
        datasets: datasets.map((ds, i) => ({ label: ds.pad, data: ds.data,
          borderColor: ['#2EC4A8', '#D4A84B', '#C83A5A'][i], backgroundColor: ['#2EC4A8', '#D4A84B', '#C83A5A'][i] + '22',
          fill: true, tension: 0.4, borderWidth: 3, pointRadius: 4 })) };
      const md = `**Evolucion historica de incidencia** (${allYears[0]}–${allYears[allYears.length - 1]})\n\n` +
        pads.map(pad => {
          const vals = Object.values(anual[pad]);
          const total = vals.reduce((a, b) => a + b, 0);
          return `- **${pad}**: ${total.toLocaleString('es-MX')} casos acumulados`;
        }).join('\n');
      return { md, chart };
    });
  }

  // 7. Top 5 entidades por pronostico (por padecimiento aleatorio)
  const padNames = [...new Set(models.map(m => m.padecimiento))];
  for (const pad of padNames) {
    generators.push(() => {
      const padModels = models.filter(m => m.padecimiento === pad && m.sexo === 'general' && m.casos_52_semanas_futuro > 0)
        .sort((a, b) => b.casos_52_semanas_futuro - a.casos_52_semanas_futuro).slice(0, 8);
      if (padModels.length < 3) return null;
      const chart = { type: 'bar', title: `${pad}: top entidades por pronostico`, labels: padModels.map(m => m.entidad),
        datasets: [{ label: 'Casos (52 sem)', data: padModels.map(m => m.casos_52_semanas_futuro),
          backgroundColor: '#D4A84BCC', borderColor: '#D4A84B', borderWidth: 1, borderRadius: 4 }] };
      const md = `**${pad} — Entidades con mayor pronostico** (52 semanas)\n\n| # | Entidad | Casos | Motor |\n|--:|---|--:|---|\n` +
        padModels.map((m, i) => `| ${i + 1} | ${m.entidad} | ${(m.casos_52_semanas_futuro || 0).toLocaleString('es-MX')} | ${m.modelo_produccion} |`).join('\n');
      return { md, chart };
    });
  }

  // Pick random generator (avoid repeating the same as last time)
  let result = null;
  const tried = new Set();
  for (let attempt = 0; attempt < 5 && !result; attempt++) {
    const idx = Math.floor(Math.random() * generators.length);
    if (tried.has(idx)) continue;
    tried.add(idx);
    result = generators[idx]();
  }
  // Fallback: try all
  if (!result) {
    for (let i = 0; i < generators.length && !result; i++) {
      result = generators[i]();
    }
  }
  if (!result) return null;

  _lastChartHandler = 'aleatorio';
  return `${result.md}\n\n<!--GENCHART:${JSON.stringify(result.chart)}-->`;
}

/** Genera datos de distribucion como DISTRIB chart. */
function _genDistribChart(models, metric, metricLabel) {
  const byPad = {};
  for (const m of models) {
    if (m.sexo !== 'general') continue;
    const pad = m.padecimiento || 'Otro';
    if (!byPad[pad]) byPad[pad] = [];
    const val = m[metric];
    if (val != null && isFinite(val)) byPad[pad].push(val);
  }
  const allVals = Object.values(byPad).flat();
  if (!allVals.length) return null;
  const sorted = [...allVals].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const maxBin = Math.ceil(p95 * 1.1);
  const numBins = Math.min(20, Math.max(8, Math.ceil(maxBin / 5) * 2));
  const binSize = maxBin / numBins;
  const binLabels = [];
  for (let i = 0; i < numBins; i++) binLabels.push(`${(i * binSize).toFixed(1)}-${((i + 1) * binSize).toFixed(1)}`);
  const padNames = Object.keys(byPad).sort();
  const datasets = padNames.map(pad => {
    const counts = new Array(numBins).fill(0);
    for (const v of byPad[pad]) { counts[Math.min(Math.floor(v / binSize), numBins - 1)]++; }
    return { pad, counts };
  });
  const chart = { type: 'bar', title: `Distribución de ${metricLabel} por padecimiento`, labels: binLabels,
    datasets: datasets.map((ds, i) => ({ label: ds.pad, data: ds.counts,
      backgroundColor: ['#2EC4A8', '#D4A84B', '#C83A5A'][i] + '99', borderColor: ['#2EC4A8', '#D4A84B', '#C83A5A'][i],
      borderWidth: 2, borderRadius: 3 })),
    options: { scales: { x: { title: { display: true, text: metricLabel } }, y: { title: { display: true, text: 'Modelos' } } } } };
  const md = `**Distribución de ${metricLabel}** (modelos de producción, sexo=general)\n\n| Padecimiento | N | Min | Mediana | Max | Promedio |\n|---|--:|--:|--:|--:|--:|\n` +
    padNames.map(pad => {
      const vals = [...byPad[pad]].sort((a, b) => a - b);
      const n = vals.length;
      return `| ${pad} | ${n} | ${vals[0].toFixed(2)} | ${vals[Math.floor(n / 2)].toFixed(2)} | ${vals[n - 1].toFixed(2)} | ${(vals.reduce((a, b) => a + b, 0) / n).toFixed(2)} |`;
    }).join('\n');
  return { md, chart };
}

// ---------------------------------------------------------------------------
// TIMELAPSE — animacion semanal del mapa
// ---------------------------------------------------------------------------

function answerTimelapse(q, ent, s, d) {
  const triggers = ['timelapse', 'animacion', 'anima el mapa', 'mapa animado', 'semana a semana mapa', 'evolucion mapa'];
  if (!any(q, triggers)) return null;

  const models = d.prod_models || [];
  const wc = d.weekly_comparison;
  if (!models.length || !wc) return null;

  const pads = Object.keys(wc).filter(isNeuro);
  const nSemanas = wc[pads[0]]?.semanas?.length || 52;
  const totalNac = pads.reduce((a, p) => a + (wc[p]?.semanas || []).reduce((s, w) => s + w.pronostico, 0), 0);

  const lines = [];
  lines.push('**Timelapse epidemiologico**: animación semana a semana del pronostico a 52 semanas.\n');
  lines.push(`- ${pads.length} padecimientos, 32 entidades federativas`);
  lines.push(`- Horizonte: ${nSemanas} semanas`);
  lines.push(`- Total nacional pronosticado: **${fmt(totalNac)} casos**\n`);
  lines.push('Usa los controles para reproducir, pausar o navegar por semana.');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// SEMAFORO EPIDEMIOLOGICO — riesgo por entidad
// ---------------------------------------------------------------------------

function answerSemaforo(q, ent, s, d) {
  const triggers = ['semaforo', 'semaforo epidemiologico', 'alerta', 'riesgo por estado', 'nivel de riesgo'];
  if (!any(q, triggers)) return null;

  const models = d.prod_models || [];
  if (!models.length) return null;

  // Agregar por estado (sexo=general, todos los pads)
  const byEnt = {};
  for (const m of models) {
    if (m.sexo !== 'general') continue;
    if (!isNeuro(m.padecimiento)) continue; // semaforo neuro; Dengue va aparte
    const e = m.entidad || '';
    if (e === 'Nacional' || e.startsWith('region_') || e.startsWith('Region')) continue;
    if (!byEnt[e]) byEnt[e] = { casos: 0, smapes: [], pads: {} };
    byEnt[e].casos += m.casos_52_semanas_futuro || 0;
    if (m.smape_prod != null) byEnt[e].smapes.push(m.smape_prod);
    byEnt[e].pads[m.padecimiento] = (byEnt[e].pads[m.padecimiento] || 0) + (m.casos_52_semanas_futuro || 0);
  }

  // Calcular percentiles para umbrales
  const casosArr = Object.values(byEnt).map(e => e.casos).sort((a, b) => a - b);
  const p25 = casosArr[Math.floor(casosArr.length * 0.25)] || 0;
  const p50 = casosArr[Math.floor(casosArr.length * 0.50)] || 0;
  const p75 = casosArr[Math.floor(casosArr.length * 0.75)] || 0;

  let verde = 0, amarillo = 0, naranja = 0, rojo = 0;
  for (const data of Object.values(byEnt)) {
    if (data.casos >= p75) { rojo++; }
    else if (data.casos >= p50) { naranja++; }
    else if (data.casos >= p25) { amarillo++; }
    else { verde++; }
  }

  const sorted = Object.entries(byEnt).sort((a, b) => b[1].casos - a[1].casos);
  const lines = [];
  lines.push('**Semáforo epidemiologico**: clasificación de riesgo por entidad federativa.\n');
  lines.push(`| Nivel | Rango (casos 52 sem) | Estados |`);
  lines.push(`|-------|---------------------:|--------:|`);
  lines.push(`| Rojo | > ${fmt(p75)} | ${rojo} |`);
  lines.push(`| Naranja | ${fmt(p50)} - ${fmt(p75)} | ${naranja} |`);
  lines.push(`| Amarillo | ${fmt(p25)} - ${fmt(p50)} | ${amarillo} |`);
  lines.push(`| Verde | < ${fmt(p25)} | ${verde} |`);

  // Top alertas
  const alerts = sorted.slice(0, 3);
  lines.push('\n**Alertas (mayor incidencia):**');
  for (const [e, data] of alerts) {
    const topPad = Object.entries(data.pads).sort((a, b) => b[1] - a[1])[0];
    lines.push(`- **${e}**: ${fmt(data.casos)} casos (principal: ${topPad ? topPad[0] : '?'})`);
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// REPORTE PDF — generar reporte descargable
// ---------------------------------------------------------------------------

function answerReportePDF(q, ent, s, d) {
  const triggers = ['reporte pdf', 'generar reporte', 'exportar reporte', 'descargar reporte', 'reporte ejecutivo', 'imprimir reporte'];
  if (!any(q, triggers)) return null;

  const models = d.prod_models || [];
  const wc = d.weekly_comparison || {};
  const tc = d.training_config || {};

  const totalCasos = models.filter(m => m.sexo === 'general' && isNeuro(m.padecimiento))
    .reduce((a, m) => a + (m.casos_52_semanas_futuro || 0), 0);
  const pads = ['Depresion', 'Parkinson', 'Alzheimer'];

  const lines = [];
  lines.push('**Reporte ejecutivo generado.**\n');
  lines.push('Se abrira una ventana de impresion con el reporte completo que incluye:\n');
  lines.push('- Resumen ejecutivo con metricas globales');
  lines.push('- Semaforo epidemiologico (32 estados)');
  lines.push('- Pronostico a 52 semanas por padecimiento');
  lines.push('- Top 10 entidades por incidencia');
  lines.push('- Metricas de calidad por motor\n');
  lines.push(`**Total nacional pronosticado**: ${fmt(totalCasos)} casos (${s.total_modelos || 333} modelos).`);

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// MATRIZ DE RENDIMIENTO — burbujas precision vs error vs volumen
// ---------------------------------------------------------------------------

function answerMatrizRendimiento(q, ent, s, d) {
  const triggers = ['matriz de rendimiento', 'matriz', 'burbuja', 'scatter', 'grafico de dispersion', 'rendimiento de los modelos', 'rendimiento de modelos'];
  const triggerAlt = any(q, ['precision']) && any(q, ['error']);
  if (!any(q, triggers) && !triggerAlt) return null;

  const models = d.prod_models || [];
  if (!models.length) return null;

  const lines = [];
  lines.push('**Matriz de rendimiento**: cada burbuja es un modelo estatal (sexo general).\n');
  lines.push('- **Eje X**: precisión histórica (mayor es mejor)');
  lines.push('- **Eje Y**: SMAPE (menor es mejor)');
  lines.push('- **Tamaño**: volumen de casos pronosticados a 52 semanas');
  lines.push('- **Color**: padecimiento (Depresion, Parkinson, Alzheimer)\n');
  lines.push('Los modelos ideales se ubican **abajo a la derecha**: alta precisión y bajo error. Las burbujas grandes son estados de alta incidencia, donde mas importa acertar.');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// ARSENAL DE MOTORES — distribucion polar de los modelos
// ---------------------------------------------------------------------------

function answerArsenalMotores(q, ent, s, d) {
  const triggers = ['arsenal', 'polar', 'rosa de motores', 'grafico polar'];
  if (!any(q, triggers)) return null;

  const dm = s.dist_motor;
  if (!dm || !Object.keys(dm).length) return null;

  const total = Object.values(dm).reduce((a, b) => a + b, 0);
  const sorted = Object.entries(dm).sort((a, b) => b[1] - a[1]);

  const lines = [];
  lines.push(`**Arsenal de modelos**: distribución de los **${total} modelos** en producción por motor ganador.\n`);
  for (const [m, n] of sorted) {
    lines.push(`- **${m}**: ${n} modelos (${(n / total * 100).toFixed(0)}%)`);
  }
  lines.push('\nCada sector del grafico polar crece con la cantidad de modelos en que ese motor resulto ganador tras la validacion.');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// MOTORES POR PADECIMIENTO — barras apiladas
// ---------------------------------------------------------------------------

function answerMotoresPorPadecimiento(q, ent, s, d) {
  const triggers = ['motores por padecimiento', 'motor por padecimiento', 'motor dominante', 'motores por enfermedad', 'mix de motores'];
  const triggerAlt = any(q, ['motor']) && any(q, ['gana cada']);
  if (!any(q, triggers) && !triggerAlt) return null;

  const pp = s.por_pad;
  if (!pp || !Object.keys(pp).length) return null;

  const lines = [];
  lines.push('**Composicion de motores por padecimiento**: que motor gana en cada enfermedad.\n');
  for (const [pad, info] of Object.entries(pp)) {
    lines.push(`- **${pad}**: gana ${info.motor_ganador} (${info.motor_ganador_n}/${info.n} modelos)`);
  }
  lines.push('\nLas barras apiladas muestran cuantos modelos de cada motor (Prophet, DeepAR, Ensemble, Stacking) se eligieron por padecimiento.');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// MEJORES Y PEORES MODELOS — extremos de SMAPE
// ---------------------------------------------------------------------------

function answerMejoresPeores(q, ent, s, d) {
  const triggers = ['mejores y peores', 'peores y mejores', 'aciertos y errores'];
  const triggerAlt = any(q, ['ranking']) && any(q, ['precision']);
  if (!any(q, triggers) && !triggerAlt) return null;

  const top = s.top5_smape || [];
  const bot = s.bottom5_smape || [];
  if (!top.length && !bot.length) return null;

  const lines = [];
  lines.push('**Mejores y peores modelos por SMAPE**: los extremos de precision.\n');
  lines.push('**Mejores (menor SMAPE):**');
  for (const r of top.slice(0, 5)) {
    lines.push(`- ${r.entidad} · ${r.padecimiento} (${r.sexo}): ${r.smape}% — ${r.motor}`);
  }
  lines.push('\n**Peores (mayor SMAPE):**');
  for (const r of bot.slice(0, 5)) {
    lines.push(`- ${r.entidad} · ${r.padecimiento} (${r.sexo}): ${r.smape}% — ${r.motor}`);
  }
  lines.push('\n*El SMAPE alto suele concentrarse en Alzheimer: su baja incidencia hace que pocos casos amplifiquen el porcentaje de error.*');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// VOLUMEN VS ERROR — combo doble eje top estados
// ---------------------------------------------------------------------------

function answerVolumenError(q, ent, s, d) {
  const triggers = ['volumen vs error', 'doble eje'];
  const triggerAlt = (any(q, ['volumen']) && any(q, ['error'])) ||
    (any(q, ['casos']) && any(q, ['smape']) && any(q, ['estado']));
  if (!any(q, triggers) && !triggerAlt) return null;

  const models = d.prod_models || [];
  if (!models.length) return null;
  const byEnt = {};
  for (const m of models) {
    if (m.sexo !== 'general') continue;
    if (!isNeuro(m.padecimiento)) continue; // neuro; Dengue va aparte
    const e = m.entidad || '';
    if (e === 'Nacional' || e.startsWith('Region') || e.startsWith('region_')) continue;
    if (!byEnt[e]) byEnt[e] = { casos: 0, smapes: [] };
    byEnt[e].casos += m.casos_52_semanas_futuro || 0;
    if (m.smape_prod != null) byEnt[e].smapes.push(m.smape_prod);
  }
  const top = Object.entries(byEnt)
    .map(([n, o]) => ({ n, casos: o.casos, smape: o.smapes.length ? o.smapes.reduce((a, v) => a + v, 0) / o.smapes.length : 0 }))
    .sort((a, b) => b.casos - a.casos).slice(0, 3);

  const lines = [];
  lines.push('**Volumen vs error** en los estados de mayor incidencia: las barras muestran los casos pronosticados y la linea el SMAPE promedio.\n');
  for (const t of top) lines.push(`- **${t.n}**: ${fmt(t.casos)} casos · SMAPE ${t.smape.toFixed(1)}%`);
  lines.push('\nIdealmente, mas volumen deberia venir acompanado de menor error: la linea ayuda a detectar estados grandes con baja precision.');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// CALIBRACION — pronostico vs realidad
// ---------------------------------------------------------------------------

function answerCalibracion(q, ent, s, d) {
  const triggers = ['calibracion', 'calibrado'];
  const triggerAlt = any(q, ['pronostico']) && any(q, ['vs']) && any(q, ['realidad']);
  if (!any(q, triggers) && !triggerAlt) return null;

  const models = (d.prod_models || []).filter(m => m.pron_sem_previa != null && m.realidad_sem_previa != null);
  if (!models.length) return null;

  const lines = [];
  lines.push('**Calibracion de modelos**: cada punto compara el pronostico contra la realidad observada de la ultima semana.\n');
  lines.push('- **Eje X**: valor pronosticado');
  lines.push('- **Eje Y**: valor real');
  lines.push('- **Línea diagonal**: predicción perfecta\n');
  lines.push(`Se grafican **${models.length} modelos**. Los puntos sobre la diagonal estan bien calibrados; arriba subestiman y abajo sobreestiman.`);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// MASE POR MOTOR — skill score
// ---------------------------------------------------------------------------

function answerMasePorMotor(q, ent, s, d) {
  const triggers = ['mase por motor', 'mase de los motores', 'skill'];
  const triggerAlt = any(q, ['mase']) && any(q, ['motor']);
  if (!any(q, triggers) && !triggerAlt) return null;

  const pm = s.por_motor;
  if (!pm || !Object.keys(pm).length) return null;

  const rows = Object.entries(pm)
    .map(([m, v]) => ({ m, mase: v.mase_median != null ? v.mase_median : v.mase_mean }))
    .sort((a, b) => a.mase - b.mase);

  const lines = [];
  lines.push('**MASE mediano por motor** (Mean Absolute Scaled Error): mide el error relativo a un modelo ingenuo.\n');
  lines.push('- **MASE < 1**: el modelo supera al pronostico ingenuo (deseable)');
  lines.push('- **MASE >= 1**: no mejora al ingenuo\n');
  for (const r of rows) lines.push(`- **${r.m}**: ${r.mase.toFixed(2)}${r.mase < 1 ? ' ✓' : ''}`);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// PRONOSTICO ACUMULADO — curva nacional
// ---------------------------------------------------------------------------

function answerAcumulado(q, ent, s, d) {
  if (!any(q, ['acumulad'])) return null;

  const wc = d.weekly_comparison;
  if (!wc) return null;
  const pads = Object.keys(wc).filter(isNeuro);
  const total = pads.reduce((a, p) => a + (wc[p]?.semanas || []).reduce((x, w) => x + (w.pronostico || 0), 0), 0);
  const nSem = (wc[pads[0]]?.semanas || []).length || 52;

  const lines = [];
  lines.push('**Pronostico nacional acumulado**: suma de casos semana a semana de los 3 padecimientos.\n');
  lines.push(`- Horizonte: ${nSem} semanas`);
  lines.push(`- Total acumulado al final: **${fmt(total)} casos**\n`);
  lines.push('La curva muestra como se acumula la carga esperada; su pendiente indica la velocidad de aparicion de casos.');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// SALUD DE LOS MODELOS — overfitting + leakage
// ---------------------------------------------------------------------------

function answerSaludModelos(q, ent, s, d) {
  const triggers = ['salud de los modelos', 'salud de modelos', 'integridad de'];
  const triggerAlt = any(q, ['overfitting']) && any(q, ['leakage']);
  if (!any(q, triggers) && !triggerAlt) return null;
  if (s.overfitting_ok == null && s.leakage_ok == null) return null;

  const totalOf = (s.overfitting_ok || 0) + (s.overfitting_moderado || 0) + (s.overfitting_alto || 0) + (s.overfitting_nd || 0);
  const totalLk = (s.leakage_ok || 0) + (s.leakage_sospechoso || 0);

  const lines = [];
  lines.push('**Salud de los modelos**: control de calidad sobre overfitting y fuga de datos (leakage).\n');
  lines.push('**Overfitting:**');
  lines.push(`- OK: ${s.overfitting_ok || 0} · Moderado: ${s.overfitting_moderado || 0} · Alto: ${s.overfitting_alto || 0} · N/D: ${s.overfitting_nd || 0} (de ${totalOf})`);
  lines.push('\n**Fuga de datos (leakage):**');
  lines.push(`- OK: ${s.leakage_ok || 0} · Sospechoso: ${s.leakage_sospechoso || 0} (de ${totalLk})`);
  lines.push('\nLa amplia mayoria de modelos pasa ambos controles, lo que respalda la confiabilidad del pronostico.');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// MEDIDOR (gauge) de salud global
// ---------------------------------------------------------------------------

function answerGauge(q, ent, s, d) {
  const triggers = ['medidor', 'gauge', 'velocimetro', 'salud global'];
  const triggerAlt = any(q, ['porcentaje']) && any(q, ['sanos']);
  if (!any(q, triggers) && !triggerAlt) return null;
  if (s.overfitting_ok == null) return null;
  const total = s.total_modelos || 333;
  const ok = s.overfitting_ok;
  const pct = total ? Math.round(ok / total * 100) : 0;
  const lines = [];
  lines.push(`**Salud global de los modelos**: el ${pct}% (${ok} de ${total}) pasa el control de overfitting sin observaciones.`);
  lines.push(`\nEl medidor resume la robustez del sistema de un vistazo. Complementa con el control de fuga de datos (leakage OK en ${s.leakage_ok} series).`);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// RANGO DE SMAPE (caja y bigotes)
// ---------------------------------------------------------------------------

function answerSmapeBox(q, ent, s, d) {
  const triggers = ['caja y bigotes', 'boxplot', 'box plot', 'rango de smape', 'intercuartil', 'cuartil'];
  if (!any(q, triggers)) return null;
  const pp = s.por_pad;
  if (!pp) return null;
  const lines = [];
  lines.push('**Rango de SMAPE por padecimiento**: la barra muestra el rango intercuartil (p25–p75), donde se concentra la mitad central de los modelos.\n');
  for (const [pad, p] of Object.entries(pp)) {
    lines.push(`- **${pad}**: mediana ${p.smape_prod_median}% (media ${p.smape_prod_mean}%)`);
  }
  lines.push('\nUn rango más estrecho indica desempeño más homogéneo entre series; Alzheimer suele mostrar el rango más alto por su baja incidencia.');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// CASCADA (waterfall) de aporte por padecimiento
// ---------------------------------------------------------------------------

function answerWaterfall(q, ent, s, d) {
  const triggers = ['cascada', 'waterfall', 'aporte acumulado'];
  const triggerAlt = (any(q, ['contribucion']) && any(q, ['padecimiento'])) || (any(q, ['aporte']) && any(q, ['total']));
  if (!any(q, triggers) && !triggerAlt) return null;
  const pp = s.por_pad;
  if (!pp) return null;
  const entries = Object.entries(pp).map(([p, v]) => [p, v.casos_futuro_total || 0]);
  const total = entries.reduce((a, [, v]) => a + v, 0);
  const lines = [];
  lines.push('**Aporte acumulado al total nacional** (pronóstico a 52 semanas): cada barra se apila sobre la anterior hasta el total.\n');
  for (const [p, v] of entries.sort((a, b) => b[1] - a[1])) {
    const pct = total ? (v / total * 100).toFixed(1) : 0;
    lines.push(`- **${p}**: ${fmt(v)} casos (${pct}%)`);
  }
  lines.push(`\n**Total nacional**: ${fmt(total)} casos.`);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// GUARD: solicitudes de generar código → rechazar con cortesía
// (EPI no es un asistente de programación general)
// ---------------------------------------------------------------------------

function answerCodeRequest(q, ent, s, d) {
  const triggers = [
    'dame codigo', 'dame el codigo', 'damelo en codigo', 'escribe codigo', 'escribeme codigo',
    'genera codigo', 'generame codigo', 'hazme un codigo', 'hazme codigo', 'crea un codigo',
    'codigo en python', 'codigo de python', 'codigo python', 'code in python', 'python code',
    'script en python', 'programa en python', 'funcion en python', 'implementa en python',
    'escribe un programa', 'escribe una funcion', 'escribeme una funcion', 'en javascript',
    'codigo para', 'snippet', 'dame un ejemplo de codigo', 'escribe el codigo',
    'script', 'hazme un script', 'dame un script', 'un script', 'hazme un programa',
  ];
  if (!any(q, triggers)) return null;
  // No bloquear preguntas legítimas SOBRE el código/configuración del proyecto
  const legit = ['cuantas lineas', 'lineas de codigo', 'que configuracion', 'configuracion de entrenamiento',
    'hiperparametro', 'arquitectura', 'repositorio', 'que motor', 'que modelo'];
  if (any(q, legit)) return null;

  const lines = [];
  lines.push('Soy **EPI**, el asistente de inteligencia epidemiológica de EpiForecast-MX. No genero código a la medida ni funciono como asistente de programación general.');
  lines.push('\nEn cambio, puedo ayudarte con:');
  lines.push('- Pronósticos y métricas (SMAPE, MASE) por entidad y padecimiento');
  lines.push('- Comparativas de motores, mapas, semáforos y reportes');
  lines.push('- La metodología del proyecto y el paper MICAI');
  lines.push('\nPor ejemplo: «métricas globales», «depresión en Jalisco» o «cómo se elige el modelo por serie».');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Cadena de handlers (orden de prioridad)
// ---------------------------------------------------------------------------

const HANDLERS = [
  answerSaludo, answerPadecimientoNoModelado, answerDengue, answerLugarDesconocido, answerEdadNoDisponible, answerPreguntaPersonal, answerEquipo, answerFechaSemana, answerTemporal, answerProyectoMeta,
  answerTrainingConfig, answerSemanaActual, answerSemanasBoletin, answerQueEsPadecimiento,
  answerTimelapse, answerSemaforo, answerReportePDF,
  answerComparacionPorSexo,
  answerComparacionSemanal, answerMapaMexico, answerTreemap, answerRadar, answerSparklines, answerStackedArea,
  answerMatrizRendimiento, answerArsenalMotores, answerMotoresPorPadecimiento, answerMejoresPeores,
  answerVolumenError, answerCalibracion, answerMasePorMotor, answerAcumulado, answerSaludModelos,
  answerGauge, answerSmapeBox, answerWaterfall,
  answerCorredor, answerErrorHeatmap, answerZoom,
  answerBoletin, answerHistorico, answerComparativaEstados, answerSpecificSeries, answerEstado, answerPadecimiento,
  answerMotor, answerDemografica, answerSexo, answerDistribucion, answerGraficoAleatorio, answerMetricaGlobal,
  answerRanking, answerDiagnosticos, answerValidacion, answerInfra,
  answerConteo, answerPronostico, answerDefinicion,
];

function runHandlers(q, ent, s, d) {
  for (const handler of HANDLERS) {
    const result = handler(q, ent, s, d);
    if (result) {
      // Reset chart context when a non-chart handler answers
      if (handler !== answerDistribucion && handler !== answerGraficoAleatorio) {
        _lastDistribMetric = null;
        _lastChartHandler = null;
      }
      _lastHandlerFn = handler;
      return result;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Guard: tema fuera de alcance → ceder a Gemini
// ---------------------------------------------------------------------------

function isOffTopic(q, ent) {
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
let _lastDistribMetric = null;   // {metric, label} de la ultima distribucion
let _lastChartHandler = null;    // nombre del ultimo handler que genero grafico
let _lastHandlerFn = null;       // referencia al ultimo handler que respondio

/** Reset conversacional — solo para tests. */
export function _resetContext() { lastEntities = {}; _lastDistribMetric = null; _lastChartHandler = null; _lastHandlerFn = null; }

export async function answer(query) {
  const d = await loadKnowledge();
  const s = d.stats || {};
  const q = norm(query);
  const ent = detectEntities(query);

  // Guard: prompt injection / roleplay → rechazar inmediatamente
  if (answerInjectionGuard(q)) return INJECTION_RESPONSE;

  // Guard: solicitudes de generar código → rechazar ANTES del fuzzy/handlers
  // (evita que "codigo... regresion" se autocorrija a "depresion", etc.)
  const codeResp = answerCodeRequest(q, ent, s, d);
  if (codeResp) return codeResp;

  // Guard: temas claramente ajenos (clima, deportes, recetas, etc.) → declinar
  // LOCALMENTE, sin ceder a la IA. Evita además el fuzzy 'clima'→'colima'.
  const offTopic = ['clima', 'pronostico del tiempo', 'pronostico del clima', 'va a llover',
    'lluvia manana', 'que tiempo hara', 'tiempo atmosferico', 'temperatura ambiente',
    'horoscopo', 'signo zodiacal', 'receta', 'pozole', 'cocina', 'futbol', 'mundial',
    'champions', 'liga mx', 'chiste', 'bitcoin', 'criptomoneda', 'precio de las acciones',
    'pelicula', 'netflix', 'horario de', 'vuelos a', 'hotel en'];
  if (any(q, offTopic) && !ent.padecimiento && !ent.estado && !ent.modelo) {
    return 'Soy **EPI**, asistente de inteligencia epidemiológica de EpiForecast-MX. No respondo temas fuera del proyecto (clima, deportes, recetas, finanzas, etc.).\n\n' +
      'Puedo ayudarte con pronósticos, métricas y la metodología de **Depresión, Parkinson, Alzheimer y Dengue** en México. Por ejemplo: «métricas globales», «depresión en Jalisco» o «pronóstico de dengue».';
  }

  // Guard: preguntas sobre el PAPER / MICAI / metodología → ceder al RAG, que
  // tiene el artículo indexado. Se hace ANTES de los handlers locales para que
  // el menú genérico de "alcance" ('que sabes...') no las intercepte.
  const ragIntent = ['paper', 'micai', 'articulo', 'publicacion', 'abstract',
    'metodologia', 'contribucion', 'contribuciones', 'hallazgo', 'hallazgos',
    'limitacion', 'limitaciones', 'trabajo futuro', 'desagregacion', 'auditable',
    'seleccion por serie', 'seleccion auditable', 'rolling-origin', 'reproducible',
    'estado del arte', 'que propone', 'de que trata el estudio', 'hiperparametro', 'hiperparametros', 'orcid',
    // Identidad / por qué del nombre / alcance conceptual → mejor explicado por RAG
    'te llamas', 'te llaman', 'tu nombre', 'por que te llam', 'porque te llam',
    'por que se llama', 'porque se llama', 'por que el nombre', 'significa epi',
    'por que epidemiolog', 'epidemiologico si', 'epideomologico'];
  if (any(q, ragIntent) && !ent.estado) return null;

  // Si requiere razonamiento temporal fino (diario), ceder a Gemini
  if (needsGeminiReasoning(q)) return null;

  // Guard: consejo clinico / recomendacion para una persona → ceder a Gemini
  // (con disclaimer medico). Va ANTES del fuzzy para que un adjetivo como
  // "depresivo" no se autocorrija a "depresion" y dispare un volcado de datos.
  if (needsMedicalAdvice(q)) return null;

  // Guard: tema fuera de alcance → ceder a Gemini
  if (isOffTopic(q, ent)) return null;

  // Guard: conocimiento general sobre padecimientos → ceder a Gemini
  // (el proyecto solo tiene datos epidemiologicos de Mexico, no info general)
  if (ent.padecimiento && needsGeneralKnowledge(q)) return null;

  // Prioridad: follow-up de distribucion ("solo de la depresion" tras un violin/histograma)
  if (_lastDistribMetric) {
    const filterKw = ['solo', 'solamente', 'nada mas', 'unicamente', 'filtra', 'filtrar'];
    if ((ent.padecimiento || ent.estado) && any(q, filterKw)) {
      const distribResult = answerDistribucion(q, ent, s, d);
      if (distribResult) {
        lastEntities = ent;
        return distribResult;
      }
    }
  }

  // Detectar follow-ups conversacionales
  const followUpPrefixes = [
    'y en ', 'y el ', 'y la ', 'y los ', 'y las ', 'y que ',
    'pero ', 'pero en ', 'pero de ',
    'y para ', 'y del ', 'tambien en ', 'que hay de ', 'ahora ',
  ];
  const isFollowUp = (lastEntities.padecimiento || lastEntities.estado || lastEntities._estados) &&
    (followUpPrefixes.some(p => q.startsWith(p)) || /^y \w/.test(q));

  // Merge de contexto conversacional
  function mergeWithContext(baseEnt) {
    const merged = { ...baseEnt };
    if (!merged.padecimiento && lastEntities.padecimiento) merged.padecimiento = lastEntities.padecimiento;
    if (!merged.estado && lastEntities.estado) merged.estado = lastEntities.estado;
    if (!merged.sexo && lastEntities.sexo) merged.sexo = lastEntities.sexo;
    if (!(merged._months || []).length && (lastEntities._months || []).length) merged._months = lastEntities._months;
    if (!(merged._years || []).length && (lastEntities._years || []).length) merged._years = lastEntities._years;
    // Heredar m\u00faltiples estados para comparativas
    if (!merged._estados && lastEntities._estados) merged._estados = lastEntities._estados;
    // Heredar contexto de \u00faltimos N a\u00f1os
    if (merged._lastNYears == null && lastEntities._lastNYears != null) merged._lastNYears = lastEntities._lastNYears;
    return merged;
  }

  // Pre-calcular corrección fuzzy
  const corrected = fuzzyCorrect(q);
  const hasFuzzy = corrected && corrected !== q;

  // Si es follow-up, intentar con contexto heredado PRIMERO
  // PERO: si la query menciona un padecimiento no modelado, NO heredar — dejar que
  // answerPadecimientoNoModelado lo maneje con el query original
  if (isFollowUp) {
    const noModelado = [
      'cancer', 'diabetes', 'hipertension', 'obesidad', 'asma', 'epilepsia',
      'esquizofrenia', 'ansiedad', 'bipolar', 'autismo', 'tdah', 'demencia',
      'influenza', 'covid', 'tuberculosis', 'vih', 'sida', 'colera',
      'sarampion', 'rubeola', 'hepatitis', 'zika', 'chikungunya', 'malaria',
      'leucemia', 'linfoma', 'tumor', 'neoplasia', 'cardiop', 'infarto',
      'embolia', 'neumonia', 'bronquitis', 'enfisema', 'cirrosis', 'artritis',
      'lupus', 'fibromialgia', 'esclerosis', 'huntington', 'ela ',
      'insuficiencia renal', 'insuficiencia cardiaca',
    ];
    const mentionsUnmodeled = noModelado.some(e => q.includes(e));

    if (!mentionsUnmodeled) {
      const merged = mergeWithContext(ent);
      const hasExtra = merged.padecimiento !== ent.padecimiento || merged.estado !== ent.estado ||
                       merged.sexo !== ent.sexo ||
                       (merged._months || []).length !== (ent._months || []).length ||
                       (merged._estados && !ent._estados) ||
                       (merged._lastNYears != null && ent._lastNYears == null);
      if (hasExtra) {
        const resultCtx = runHandlers(q, merged, s, d);
        if (resultCtx) {
          const ctx = [merged.padecimiento, merged.estado, merged.sexo].filter(Boolean).join(' / ');
          lastEntities = merged;
          return `*(Contexto: ${ctx})*\n\n${resultCtx}`;
        }
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

  // No heredar contexto si menciona un padecimiento no modelado
  const noModeladoCtx = [
    'cancer', 'diabetes', 'hipertension', 'obesidad', 'asma', 'epilepsia',
    'esquizofrenia', 'ansiedad', 'bipolar', 'autismo', 'tdah', 'demencia',
    'influenza', 'tuberculosis', 'vih', 'sida', 'colera',
    'sarampion', 'hepatitis', 'zika', 'malaria', 'leucemia', 'linfoma',
    'tumor', 'neoplasia', 'infarto', 'neumonia', 'artritis', 'lupus',
    'esclerosis', 'huntington',
  ];
  const mentionsUnmodeledCtx = noModeladoCtx.some(e => q.includes(e));

  if (!isFollowUp && !isNewTopic && !mentionsUnmodeledCtx && (lastEntities.padecimiento || lastEntities.estado)) {
    // Solo heredar si la query tiene keywords de datos/epidemiologia
    const dataKeywords = ['caso', 'cuantos', 'cuantas', 'incidencia', 'dato', 'grafico', 'grafica',
      'pronostico', 'prediccion', 'historico', 'historica', 'tendencia', 'semana', 'ano',
      'boletin', 'metrica', 'smape', 'modelo', 'ranking', 'validacion', 'desglose',
      'comparar', 'motor', 'sexo', 'hombre', 'mujer', 'general', 'nacional'];
    const hasDataContext = dataKeywords.some(t => q.includes(t));

    if (hasDataContext) {
      const merged = mergeWithContext(ent);
      const hasExtra = merged.padecimiento !== ent.padecimiento || merged.estado !== ent.estado ||
                       merged.sexo !== ent.sexo ||
                       (merged._estados && !ent._estados) ||
                       (merged._lastNYears != null && ent._lastNYears == null);
      if (hasExtra) {
        const resultCtx = runHandlers(q, merged, s, d);
        if (resultCtx) {
          const ctx = [merged.padecimiento, merged.estado, merged.sexo].filter(Boolean).join(' / ');
          lastEntities = merged;
          return `*(Contexto: ${ctx})*\n\n${resultCtx}`;
        }
      }
    }
  }

  return null;
}
