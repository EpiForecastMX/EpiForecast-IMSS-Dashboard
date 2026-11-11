// analytics.mjs: comparación de territorios y perfil temporal. Puro, sin DOM ni red.
// Reglas:
//   * sólo fechas comunes a todas las series; sin interpolar, sin ceros inventados, sin sumar líneas;
//   * pronóstico sólo en fechas posteriores a dsCorte de cada serie;
//   * base 100 con UNA fecha común: la primera con observado > 0 en todas las series;
//     si no existe, no se calculan valores indexados;
//   * el perfil temporal usa sólo observados (r); null es faltante, no cero;
//     es un diagnóstico de fechas del índice, no una alerta ni evidencia causal.

import { csvField } from './data.mjs';

export const MAX_COMPARE = 4;
export const UNITS = Object.freeze({
  absolute: 'casos_por_semana_indice',
  indexed: 'indice_base_100',
});
export const NO_BASELINE_REASON =
  'No hay una fecha común con observado positivo en todas las series: no se calcula base 100.';
export const NO_COMMON_DATES_REASON = 'Las series no comparten fechas en el rango elegido.';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const inRange = (d, from, to) => (!from || d >= from) && (!to || d <= to);

function seriesMap(series) {
  const m = new Map();
  series.d.forEach((date, i) => {
    const r = isNum(series.r[i]) ? series.r[i] : null;
    const y = series.dsCorte && date > series.dsCorte && isNum(series.y[i]) ? series.y[i] : null;
    m.set(date, { r, y });
  });
  return m;
}

/**
 * items: [{id, label, series, disease?, sex?}] con series de data.getSeries().
 * Devuelve {dates, lines, mode, baselineDate, indexedAvailable, reason}.
 */
export function buildComparison(items, { mode = 'absolute', from = null, to = null } = {}) {
  if (!Array.isArray(items) || !items.length) throw new Error('[analytics] sin series para comparar');
  if (items.length > MAX_COMPARE) throw new Error(`[analytics] máximo ${MAX_COMPARE} series`);
  if (mode !== 'absolute' && mode !== 'indexed') throw new Error(`[analytics] modo desconocido: ${mode}`);
  const ids = new Set();
  for (const it of items) {
    if (!it || !it.series || !Array.isArray(it.series.d)) throw new Error('[analytics] serie inválida');
    if (ids.has(it.id)) throw new Error(`[analytics] serie repetida: ${it.id}`);
    ids.add(it.id);
  }
  const same = (f) => items.every((it) => it[f] === undefined || it[f] === items[0][f]);
  if (!same('disease') || !same('sex')) {
    throw new Error('[analytics] sólo se comparan territorios del mismo padecimiento y sexo');
  }

  const maps = items.map((it) => seriesMap(it.series));
  let dates = [...maps[0].keys()].filter((d) => maps.every((m) => m.has(d)) && inRange(d, from, to));
  dates = [...new Set(dates)].sort();

  const baselineDate = dates.find((d) => maps.every((m) => isNum(m.get(d).r) && m.get(d).r > 0)) ?? null;
  const indexedAvailable = baselineDate !== null;

  let reason = null;
  if (!dates.length) reason = NO_COMMON_DATES_REASON;
  else if (mode === 'indexed' && !indexedAvailable) reason = NO_BASELINE_REASON;

  const lines = items.map((it, k) => {
    const m = maps[k];
    let real = dates.map((d) => m.get(d).r);
    let pron = dates.map((d) => m.get(d).y);
    let baseline = null;
    if (mode === 'indexed') {
      if (indexedAvailable) {
        const base = m.get(baselineDate).r;
        baseline = { date: baselineDate, value: base };
        const idx = (v) => (v === null ? null : (v / base) * 100);
        real = real.map(idx);
        pron = pron.map(idx);
      } else {
        real = real.map(() => null);
        pron = pron.map(() => null);
      }
    }
    return { id: it.id, label: String(it.label ?? it.id), real, pron, baseline };
  });

  return {
    dates,
    lines,
    mode,
    baselineDate: mode === 'indexed' ? baselineDate : null,
    indexedAvailable,
    reason,
    unit: UNITS[mode],
    range: { from: from ?? null, to: to ?? null },
  };
}

export const COMPARISON_CSV_COLUMNS = Object.freeze([
  'fecha_indice_serie', 'territorio_id', 'territorio', 'observado', 'pronostico', 'unidad', 'modo',
  'fecha_base', 'valor_base_observado', 'padecimiento', 'sexo', 'origen', 'corte_observacion',
  'emision', 'estado_publicacion', 'fuente', 'nota',
  'cie', 'veredicto', 'release_id', 'sha256_fuente', 'rango_desde', 'rango_hasta',
]);

/**
 * CSV largo (una fila por fecha y territorio). Nunca suma entre líneas.
 * meta: {padecimiento, sexo, origen, corte, emision, estado, fuente, nota}.
 */
export function comparisonCSV(comparison, meta = {}) {
  const c = comparison;
  const nota = [c.reason, meta.nota,
    c.mode === 'indexed' && c.baselineDate
      ? `Base 100 = observado de cada territorio en ${c.baselineDate}` : null,
    'Fechas del índice de la serie, no calendario oficial; territorios no sumables entre sí',
  ].filter(Boolean).join(' | ');
  // meta.unidad permite rotular p. ej. incrementos netos por sexo (legacy); en base 100 manda el índice.
  const unit = c.mode === 'indexed' ? UNITS.indexed : (meta.unidad ?? c.unit ?? UNITS.absolute);
  const origen = meta.origen ?? meta.semanaOrigen;
  const corte = meta.corte ?? meta.ultimaSemanaObservada;
  const contexto = [meta.cie, meta.veredicto, meta.releaseId, meta.sha256, meta.desde, meta.hasta];
  const lines = [COMPARISON_CSV_COLUMNS.join(',')];
  const push = (vals) => lines.push(vals.map(csvField).join(','));
  for (const line of c.lines) {
    if (!c.dates.length) {
      push([null, line.id, line.label, null, null, unit, c.mode, null, null,
        meta.padecimiento, meta.sexo, origen, corte, meta.emision, meta.estado, meta.fuente, nota, ...contexto]);
      continue;
    }
    c.dates.forEach((date, i) => {
      push([
        date, line.id, line.label, line.real[i], line.pron[i], unit, c.mode,
        line.baseline?.date ?? null, line.baseline?.value ?? null,
        meta.padecimiento, meta.sexo, origen, corte, meta.emision, meta.estado, meta.fuente, nota, ...contexto,
      ]);
    });
  }
  return `${lines.join('\r\n')}\r\n`;
}

/**
 * Matriz año × mes de observados. Sólo fechas del índice hasta lastReal (si existe):
 * las semanas posteriores no son faltantes, aún no se observan.
 * n = valores finitos; missing = null observados; sum/mean null cuando n = 0.
 */
export function temporalProfile(series, { from = null, to = null } = {}) {
  const empty = { years: [], cells: [] };
  if (!series || !Array.isArray(series.d)) return empty;
  const limit = series.lastReal ?? null;
  const pts = [];
  series.d.forEach((date, i) => {
    if (!inRange(date, from, to)) return;
    if (limit && date > limit) return;
    const v = series.r[i];
    pts.push({ date, v: isNum(v) ? v : null });
  });
  const years = [...new Set(pts.filter((p) => p.v !== null).map((p) => Number(p.date.slice(0, 4))))].sort((a, b) => a - b);
  if (!years.length) return empty;
  const cells = [];
  for (const year of years) {
    for (let month = 1; month <= 12; month += 1) {
      const prefix = `${year}-${String(month).padStart(2, '0')}`;
      const inCell = pts.filter((p) => p.date.startsWith(prefix));
      const vals = inCell.filter((p) => p.v !== null).map((p) => p.v);
      const n = vals.length;
      const sum = n ? vals.reduce((a, b) => a + b, 0) : null;
      cells.push({
        year,
        month,
        sum,
        mean: n ? sum / n : null,
        n,
        missing: inCell.length - n,
        negative: vals.filter((v) => v < 0).length,
        first: inCell.length ? inCell[0].date : null,
        last: inCell.length ? inCell[inCell.length - 1].date : null,
      });
    }
  }
  return { years, cells };
}

/** Rango [from, to] de una celda del perfil (para fijar el rango del explorador). */
export function cellRange(cell) {
  if (!cell || !cell.first) return null;
  return { from: cell.first, to: cell.last };
}
