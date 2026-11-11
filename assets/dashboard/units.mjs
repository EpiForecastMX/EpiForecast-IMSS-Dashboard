// units.mjs: nomenclatura pura de unidades del dashboard (sin DOM; probada con node:test).
// Sólo nombra y contextualiza valores: no cambia valores, fórmulas ni el cálculo del índice base 100.
//
// Contrato:
//   * Series históricas (entry.kind === 'legacy'), sexo General: Casos_semana publicados → casos semanales.
//   * Series históricas, Hombres o Mujeres: incrementos netos semanales del acumulado por sexo. Pueden
//     ser negativos e incluir revisiones de cifras previas: NO son casos nuevos.
//   * Releases (cualquier sexo): casos semanales de la vista publicada.
// La unidad aplica a observado y pronóstico de la misma serie.

export const UNIT_IDS = Object.freeze({
  cases: 'casos_por_semana_indice',
  net: 'incremento_neto_por_semana_indice',
  indexed: 'indice_base_100',
});

export const NET_INCREMENT_NOTE =
  'Hombres y Mujeres de las series históricas son incrementos netos semanales del acumulado por sexo: ' +
  'pueden incluir revisiones de cifras previas y ser negativos; no equivalen a casos nuevos.';

/** ¿La serie (padecimiento + sexo) se expresa en incrementos netos del acumulado? */
export function isNetIncrement(kind, sex) {
  return kind === 'legacy' && sex !== 'general';
}

/**
 * Unidad de los valores absolutos de una serie.
 * Devuelve { id, net, label, short, observedLabel, forecastLabel, baselineUnit, note }.
 */
export function valueUnit(kind, sex) {
  if (isNetIncrement(kind, sex)) {
    return Object.freeze({
      id: UNIT_IDS.net,
      net: true,
      label: 'incrementos netos semanales del acumulado',
      short: 'incr. netos',
      observedLabel: 'Observado (incremento neto del acumulado)',
      forecastLabel: 'Pronóstico (incremento neto del acumulado)',
      baselineUnit: 'de incremento neto',
      note: NET_INCREMENT_NOTE,
    });
  }
  return Object.freeze({
    id: UNIT_IDS.cases,
    net: false,
    label: 'casos semanales',
    short: 'casos',
    observedLabel: 'Observado (casos semanales)',
    forecastLabel: 'Pronóstico (casos semanales)',
    baselineUnit: 'casos',
    note: null,
  });
}

/** Rótulo genérico de la escala de comparación; la unidad concreta va en el contexto. */
export function scaleLabel(mode) {
  return mode === 'indexed' ? 'Base 100' : 'Valores absolutos';
}

/**
 * Descripción de la escala de una comparación (pantalla, SVG y CSV).
 * baselines: [{label, value}] sólo para mode 'indexed' con base disponible.
 */
export function comparisonScaleText(kind, sex, mode, baselineDate = null, baselines = [], fmt = String) {
  const u = valueUnit(kind, sex);
  if (mode === 'indexed' && baselineDate) {
    const parts = baselines.map((b) => `${b.label} = ${fmt(b.value)} ${u.baselineUnit}`);
    const base = `Base 100 en la fecha del índice ${baselineDate}: ${parts.join('; ')}. ` +
      `Cada valor se divide entre el observado de su propio territorio en esa fecha (${u.label}).`;
    return u.net ? `${base} La base es un incremento neto del acumulado, no un número de casos nuevos.` : base;
  }
  const abs = `Valores absolutos por territorio, en ${u.label}; sin ajuste por población.`;
  return u.net ? `${abs} ${NET_INCREMENT_NOTE}` : abs;
}

/** Unidad para el CSV de comparación (código estable). */
export function comparisonUnitId(kind, sex, mode) {
  return mode === 'indexed' ? UNIT_IDS.indexed : valueUnit(kind, sex).id;
}

/** Rótulo del origen del total nacional del catálogo (forecastTotalSource de unified.mjs). */
export function totalSourceLabel(source) {
  switch (source) {
    case 'pronostico_52_total': return 'total publicado en la vista';
    case 'suma_puntos_vista_sin_redondear': return 'suma de los puntos publicados, sin redondeo';
    case 'suma_json_visual_redondeado': return 'suma de valores visuales redondeados';
    default: return 'total del catálogo';
  }
}

/** Evita repetir «N/M semanas» cuando la etiqueta oficial ya lo incluye. */
export function statusText(label, weeksAvailable, weeksRequired) {
  const weeks = Number.isInteger(weeksAvailable) && Number.isInteger(weeksRequired)
    ? `${weeksAvailable}/${weeksRequired} semanas` : null;
  const l = typeof label === 'string' ? label.trim() : '';
  if (!weeks) return l;
  if (l && /\d+\s*\/\s*\d+\s*semanas/i.test(l)) return l;
  return l ? `${l} · ${weeks}` : weeks;
}
