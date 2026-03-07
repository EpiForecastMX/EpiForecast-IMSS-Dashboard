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
  const resp = await fetch('./knowledge.json');
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
    'que dia', 'que fecha', 'fecha de hoy', 'dia de hoy', 'fecha actual',
    'semana epidemiologica', 'semana epi', 'en que semana', 'que semana es',
    'que semana estamos', 'semana estamos', 'ultima semana', 'ultimo dato',
    'hasta cuando', 'hasta que fecha', 'hasta que semana', 'cobertura temporal',
    'rango de fecha', 'periodo de dato', 'desde cuando', 'cuando inicia',
    'cuando empieza', 'horizonte',
  ];
  if (!any(q, triggers)) return null;

  const now = new Date();
  const iso = getISOWeek(now);
  const lines = [];

  const isDateQ = any(q, ['que dia', 'que fecha', 'fecha de hoy', 'dia de hoy', 'fecha actual']);
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
    const padLabel = pad ? ` de ${pad}` : '';
    const total = ranking.reduce((sum, r) => sum + (r.casos || 0), 0);
    const lines = [`**Ranking de entidades por incidencia${padLabel}** (acumulado hist\u00f3rico):\n`];
    lines.push('| # | Entidad | Casos | % del total |');
    lines.push('|---|---------|-------|-------------|');
    ranking.slice(0, 15).forEach((r, i) => {
      const p = total > 0 ? ((r.casos / total) * 100).toFixed(1) : '?';
      lines.push(`| ${i + 1} | ${r.entidad} | ${fmt(r.casos)} | ${p}% |`);
    });
    if (ranking.length > 15) lines.push(`\n*... y ${ranking.length - 15} entidades m\u00e1s.*`);
    lines.push(`\n**Total acumulado**: ${fmt(total)} casos. Las 5 entidades principales concentran el ${total > 0 ? ((ranking.slice(0, 5).reduce((s, r) => s + (r.casos || 0), 0) / total) * 100).toFixed(1) : '?'}% del total.`);
    return lines.join('\n');
  }

  // A\u00f1o + padecimiento (sin estado)
  if (hasYear && pad && !estado) {
    const anual = bol.anual_por_pad?.[pad];
    if (!anual) return null;
    const yrStr = years.join(', ');
    const lines = [`**${pad}** (${yrStr}):\n`];
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
      }
    }
    return lines.length > 1 ? lines.join('\n') : null;
  }

  // A\u00f1o + estado
  if (hasYear && estado) {
    const estData = bol.anual_por_estado_pad?.[estado];
    if (!estData) return null;
    const yrStr = years.join(', ');
    const lines = [`**${estado}** (${yrStr}):\n`];
    if (pad) {
      const padData = estData[pad];
      if (!padData) return null;
      for (const y of years) { const c = padData[String(y)]; if (c != null) lines.push(`- ${y}: ${fmt(c)} casos`); }
    } else {
      for (const [p, padData] of Object.entries(estData)) {
        lines.push(`\n**${p}**:`);
        for (const y of years) { const c = padData[String(y)]; if (c != null) lines.push(`- ${y}: ${fmt(c)} casos`); }
      }
    }
    return lines.length > 1 ? lines.join('\n') : null;
  }

  // A\u00f1o sin padecimiento ni estado → resumen del a\u00f1o
  if (hasYear && !pad && !estado) {
    const yrStr = years.join(', ');
    const lines = [`**Resumen epidemiol\u00f3gico ${yrStr}**:\n`];
    const anualPad = bol.anual_por_pad || {};
    for (const y of years) {
      let total = 0;
      const parts = [];
      for (const [p, data] of Object.entries(anualPad)) {
        const c = data[String(y)];
        if (c != null) { total += c; parts.push(`  - ${p}: ${fmt(c)}`); }
      }
      lines.push(`**${y}**: ${fmt(total)} casos totales`);
      lines.push(...parts);
      if (years.length > 1) lines.push('');
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

  // Lead con hallazgo principal
  if (ps.casos_futuro_total) {
    lines.push(
      `Se pronostican **${fmt(ps.casos_futuro_total)} casos de ${pad}** a nivel nacional ` +
      `en las pr\u00f3ximas 52 semanas (${ps.n} modelos).\n`
    );
  } else {
    lines.push(`**${pad}**: ${ps.n} modelos de producci\u00f3n.\n`);
  }

  // Estimaci\u00f3n mensual
  if (months.length > 0 && ps.casos_futuro_total) {
    const mText = monthEstimateText(ps.casos_futuro_total, months, years, pad, null, d);
    if (mText) lines.push(mText + '\n');
  }

  // Rendimiento
  if (ps.smape_prod_mean != null) {
    lines.push(`Rendimiento: SMAPE promedio **${ps.smape_prod_mean}%** (mediana: ${ps.smape_prod_median}%) \u2014 confianza **${confidence(ps.smape_prod_median)}**`);
  }
  if (ps.motor_ganador) {
    lines.push(`Motor ganador: **${ps.motor_ganador}** (${ps.motor_ganador_n} de ${ps.n} series, ${((ps.motor_ganador_n / ps.n) * 100).toFixed(0)}%)`);
  }

  // Distribuci\u00f3n de motores
  const dist = ps.dist_motor;
  if (dist) {
    lines.push('\n**Distribuci\u00f3n de motores:**');
    for (const [motor, n] of Object.entries(dist)) {
      lines.push(`- ${motor}: ${n} series (${((n / ps.n) * 100).toFixed(1)}%)`);
    }
  }

  // Contexto hist\u00f3rico
  const hist = getHistContext(d, pad, null);
  if (hist) lines.push(`\n**Contexto hist\u00f3rico**: ${hist}`);

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// MOTOR — con recomendaci\u00f3n
// ---------------------------------------------------------------------------

function answerMotor(q, ent, s, d) {
  const motorTriggers = ['modelo', 'motor', 'gana', 'ganador', 'cual gana', 'que modelo'];
  if (!any(q, motorTriggers) && !ent.modelo) return null;

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
  const triggers = ['mejor', 'peor', 'top', 'ranking', 'mejores modelo', 'peores modelo'];
  if (!any(q, triggers)) return null;

  const lines = [];
  const top = s.top5_smape || [];
  if (top.length) {
    lines.push('**Los 5 modelos m\u00e1s precisos** (menor error):\n');
    lines.push('| # | Serie | SMAPE | Motor |');
    lines.push('|---|-------|-------|-------|');
    top.forEach((m, i) => {
      lines.push(`| ${i + 1} | ${m.padecimiento} \u2014 ${m.entidad} (${m.sexo}) | ${m.smape}% | ${m.motor} |`);
    });
  }
  const bottom = s.bottom5_smape || [];
  if (bottom.length) {
    lines.push('\n**Los 5 modelos con mayor error** (requieren atenci\u00f3n):\n');
    lines.push('| # | Serie | SMAPE | Motor |');
    lines.push('|---|-------|-------|-------|');
    bottom.forEach((m, i) => {
      lines.push(`| ${i + 1} | ${m.padecimiento} \u2014 ${m.entidad} (${m.sexo}) | ${m.smape}% | ${m.motor} |`);
    });
  }

  // Insight
  if (top.length && bottom.length) {
    lines.push(
      `\nLos mejores modelos alcanzan SMAPE de **${top[0].smape}%** mientras los m\u00e1s dif\u00edciles llegan a **${bottom[bottom.length - 1].smape}%**. ` +
      `Las series con mayor error suelen corresponder a Alzheimer en estados con muy baja incidencia, donde peque\u00f1as variaciones generan errores porcentuales altos.`
    );
  }

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
function fuzzyCorrect(q) {
  const words = q.split(' ');
  let changed = false;
  const fixed = words.map(w => {
    if (w.length < 3) return w;          // No corregir palabras muy cortas
    if (VOCAB.includes(w)) return w;     // Ya est\u00e1 bien
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
  answerSaludo, answerEquipo, answerTemporal, answerProyectoMeta,
  answerTrainingConfig, answerSemanaActual, answerQueEsPadecimiento,
  answerBoletin, answerSpecificSeries, answerEstado, answerPadecimiento,
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

export async function answer(query) {
  const d = await loadKnowledge();
  const s = d.stats || {};
  const q = norm(query);
  const ent = detectEntities(query);

  // Pre-calcular correcci\u00f3n fuzzy
  const corrected = fuzzyCorrect(q);
  const hasFuzzy = corrected && corrected !== q;

  // Si hay correcci\u00f3n fuzzy, verificar si detecta m\u00e1s entidades
  // (e.g., "depresoin" -> "depresion" detecta padecimiento)
  if (hasFuzzy) {
    const entFixed = detectEntities(corrected);
    const moreEntities =
      (!ent.padecimiento && entFixed.padecimiento) ||
      (!ent.estado && entFixed.estado) ||
      (!ent.modelo && entFixed.modelo);

    if (moreEntities) {
      // La correcci\u00f3n encontr\u00f3 entidades que el original no: preferir corregida
      const resultFixed = runHandlers(corrected, entFixed, s, d);
      if (resultFixed) {
        return `*(\u00bfQuisiste decir \u00ab${corrected}\u00bb?)*\n\n${resultFixed}`;
      }
    }
  }

  // Intento 1: query original
  const result = runHandlers(q, ent, s, d);
  if (result) return result;

  // Intento 2: correcci\u00f3n fuzzy de typos (para triggers, no solo entidades)
  if (hasFuzzy) {
    const entFixed = detectEntities(corrected);
    const resultFixed = runHandlers(corrected, entFixed, s, d);
    if (resultFixed) {
      return `*(\u00bfQuisiste decir \u00ab${corrected}\u00bb?)*\n\n${resultFixed}`;
    }
  }

  return null;
}
