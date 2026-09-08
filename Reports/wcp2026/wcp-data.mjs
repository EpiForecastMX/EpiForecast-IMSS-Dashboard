export const ASSETS = 'Reports/wcp2026/2026-09-08-00567d59/';
export function initialLanguage(search = '') {
  return new URLSearchParams(search).get('lang') === 'es' ? 'es' : 'en';
}
export function metrics(row, weeks = 25) {
  if (![8, 25].includes(weeks)) throw new Error('Unsupported evaluation window');
  const start = weeks === 8 ? 17 : 0;
  const actual = row.observations.slice(start, 25);
  const predicted = row.forecasts.slice(start, 25);
  if (actual.length !== weeks || predicted.length !== weeks) throw new Error('Incomplete window');
  const sum = values => values.reduce((a, b) => a + b, 0);
  const errors = actual.map((v, i) => Math.abs(v - predicted[i]));
  const smape = sum(actual.map((v, i) => {
    const denominator = Math.abs(v) + Math.abs(predicted[i]);
    return denominator === 0 ? 0 : 200 * errors[i] / denominator;
  })) / weeks;
  const observed = sum(actual), forecast = sum(predicted);
  return { smape, mae: sum(errors) / weeks, observed, forecast,
    deviation: observed === 0 ? null : 100 * (forecast - observed) / observed, weeks };
}
export function sortedStates(data) {
  return [...data.states].sort((a, b) => a.smape - b.smape || a.name.localeCompare(b.name));
}
export function medianState(data) {
  const a = sortedStates(data); return (a[15].smape + a[16].smape) / 2;
}
export function validateData(data) {
  const finite = a => Array.isArray(a) && a.every(v => Number.isFinite(v) && v >= 0);
  if (data?.version !== '2026-09-08-00567d59' || data.national?.length !== 3 || data.states?.length !== 32) throw new Error('Unexpected study version');
  if (new Set(data.national.map(r => r.condition)).size !== 3 || !['depresion','parkinson','alzheimer'].every(k => data.national.some(r => r.condition === k))) throw new Error('Invalid conditions');
  for (const r of data.national) {
    if (![r.observations,r.forecasts,r.historical,r.model,r.lower,r.upper].every(finite)) throw new Error('Invalid series value');
    if (r.observations.length !== 25 || r.forecasts.length !== 25 || r.historical.length !== 52 || r.dates.length !== 79 || [r.model,r.lower,r.upper].some(a => a.length !== 79)) throw new Error('Incomplete series');
    if (r.dates[0] !== '2025-08-04' || r.dates[78] !== '2027-02-01' || r.dates.some((v,i) => !/^\d{4}-\d{2}-\d{2}$/.test(v) || (i > 0 && Date.parse(v)-Date.parse(r.dates[i-1]) !== 604800000))) throw new Error('Invalid weekly dates');
    if (r.observations.some((v,i) => v !== r.historical[27+i]) || r.forecasts.some((v,i) => Math.abs(v-r.model[27+i]) > .00001)) throw new Error('Chart/evaluation disagreement');
    if (r.lower.some((v,i) => v > r.upper[i])) throw new Error('Invalid interval');
  }
  if (new Set(data.states.map(r=>r.name)).size !== 32 || data.states.some(r => typeof r.name !== 'string' || !Number.isFinite(r.smape) || r.smape<0 || r.smape>200)) throw new Error('Invalid states');
  if (data.sex.women !== 67753 || data.sex.men !== 24974 || data.sex.total !== 92727 || data.sex.year !== 2026 || data.sex.week !== 31) throw new Error('Invalid descriptive sex totals');
  return data;
}
