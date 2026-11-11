import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as d from '../assets/dashboard/data.mjs';
import * as u from '../assets/dashboard/unified.mjs';
import * as a from '../assets/dashboard/analytics.mjs';

const root = process.env.DASHBOARD_SOURCE || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const has = (rel) => fs.existsSync(path.join(root, rel));
const read = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));

const A = {
  d: ['2026-01-05', '2026-01-12', '2026-01-19', '2026-01-26', '2026-02-02'],
  r: [0, 2, 4, null, 6],
  y: [9, 9, 9, 5, 7],
  dsCorte: '2026-01-19', lastReal: '2026-02-02',
};
const B = {
  d: ['2026-01-12', '2026-01-19', '2026-01-26', '2026-02-02', '2026-02-09'],
  r: [1, -1, 3, 4, null],
  y: [8, 8, 2, 3, 9],
  dsCorte: '2026-01-19', lastReal: '2026-02-02',
};
const items = () => [{ id: 'a', label: 'Territorio A', series: A }, { id: 'b', label: 'Territorio B', series: B }];

test('absolute comparison aligns only common dates without inventing zeros', () => {
  const c = a.buildComparison(items());
  assert.deepEqual(c.dates, ['2026-01-12', '2026-01-19', '2026-01-26', '2026-02-02']);
  assert.equal(c.mode, 'absolute');
  assert.equal(c.baselineDate, null);
  assert.equal(c.indexedAvailable, true);
  assert.equal(c.reason, null);
  assert.deepEqual(c.lines[0].real, [2, 4, null, 6]);
  assert.deepEqual(c.lines[0].pron, [null, null, 5, 7], 'y antes o en el corte no es pronóstico');
  assert.deepEqual(c.lines[1].real, [1, -1, 3, 4], 'negativos conservados');
  assert.deepEqual(c.lines[1].pron, [null, null, 2, 3]);
  assert.ok(c.lines.every((l) => l.baseline === null));
  assert.equal(c.lines.length, 2, 'sin línea de suma');
});

test('indexed comparison uses one common baseline with positive observed in every series', () => {
  const c = a.buildComparison(items(), { mode: 'indexed' });
  assert.equal(c.baselineDate, '2026-01-12');
  assert.deepEqual(c.lines[0].baseline, { date: '2026-01-12', value: 2 });
  assert.deepEqual(c.lines[1].baseline, { date: '2026-01-12', value: 1 });
  assert.deepEqual(c.lines[0].real, [100, 200, null, 300]);
  assert.deepEqual(c.lines[0].pron, [null, null, 250, 350]);
  assert.deepEqual(c.lines[1].real, [100, -100, 300, 400]);
  // recorte: 01-19 tiene negativo en B y 01-26 null en A → base 02-02
  const r = a.buildComparison(items(), { mode: 'indexed', from: '2026-01-19' });
  assert.deepEqual(r.dates, ['2026-01-19', '2026-01-26', '2026-02-02']);
  assert.equal(r.baselineDate, '2026-02-02');
  assert.deepEqual(r.lines[1].real, [-25, 75, 100]);
});

test('indexed comparison without common positive baseline returns no indexed values', () => {
  const c = a.buildComparison(items(), { mode: 'indexed', from: '2026-01-19', to: '2026-01-26' });
  assert.deepEqual(c.dates, ['2026-01-19', '2026-01-26']);
  assert.equal(c.indexedAvailable, false);
  assert.equal(c.baselineDate, null);
  assert.equal(c.reason, a.NO_BASELINE_REASON);
  assert.ok(c.lines.every((l) => l.baseline === null && l.real.every((v) => v === null) && l.pron.every((v) => v === null)));
  const abs = a.buildComparison(items(), { from: '2026-01-19', to: '2026-01-26' });
  assert.equal(abs.indexedAvailable, false);
  assert.deepEqual(abs.lines[0].real, [4, null]);
});

test('comparison guards: max four, same disease/sex, unique ids, disjoint dates', () => {
  const s = (id) => ({ id, label: id, series: A });
  assert.throws(() => a.buildComparison([s('1'), s('2'), s('3'), s('4'), s('5')]), /máximo/);
  assert.doesNotThrow(() => a.buildComparison([s('1'), s('2'), s('3'), s('4')]));
  assert.throws(() => a.buildComparison([s('1'), s('1')]), /repetida/);
  assert.throws(() => a.buildComparison([{ ...s('1'), sex: 'general' }, { ...s('2'), sex: 'mujeres' }]), /mismo/);
  assert.throws(() => a.buildComparison([{ ...s('1'), disease: 'x' }, { ...s('2'), disease: 'y' }]), /mismo/);
  assert.throws(() => a.buildComparison([]), /sin series/);
  assert.throws(() => a.buildComparison(items(), { mode: 'log' }), /modo/);
  const far = { ...A, d: ['2030-01-07', '2030-01-14', '2030-01-21', '2030-01-28', '2030-02-04'] };
  const c = a.buildComparison([s('1'), { id: '2', label: '2', series: far }]);
  assert.deepEqual(c.dates, []);
  assert.equal(c.reason, a.NO_COMMON_DATES_REASON);
});

test('comparison CSV is long-format, carries context and protects formulas', () => {
  const its = items();
  its[1].label = '=HYPERLINK("x")';
  const c = a.buildComparison(its, { mode: 'indexed' });
  const csv = a.comparisonCSV(c, {
    padecimiento: 'Obesidad (E66)', sexo: 'General', origen: '2026-W26', corte: '2026-W42',
    emision: '2026-07-25T04:55:28Z', estado: 'Validación prospectiva superada (4/4 semanas)', fuente: 'publication/obesidad/vista.json',
  });
  const lines = csv.trimEnd().split('\r\n');
  assert.equal(lines[0], a.COMPARISON_CSV_COLUMNS.join(','));
  assert.equal(lines.length, 1 + 2 * 4);
  assert.ok(lines.some((l) => l.includes(`"'=HYPERLINK(""x"")"`)), 'fórmula neutralizada');
  assert.ok(lines[1].startsWith('2026-01-12,a,Territorio A,100,,indice_base_100,indexed,2026-01-12,2,Obesidad (E66),General,2026-W26,2026-W42'));
  assert.ok(lines.every((l, i) => i === 0 || l.includes('publication/obesidad/vista.json')));
  assert.ok(csv.includes('Base 100 = observado de cada territorio en 2026-01-12'));
  assert.ok(!/total|suma/i.test(lines[0]), 'sin columnas de suma');
  const abs = a.comparisonCSV(a.buildComparison(items()));
  assert.ok(abs.split('\r\n')[1].includes(',casos_por_semana_indice,absolute,'));
  const none = a.comparisonCSV(a.buildComparison(items(), { mode: 'indexed', from: '2026-01-19', to: '2026-01-26' }));
  assert.ok(none.includes(a.NO_BASELINE_REASON));
});

test('temporal profile counts observed values, missing nulls and negatives per month', () => {
  const s = {
    d: ['2025-12-22', '2025-12-29', '2026-01-05', '2026-01-12', '2026-01-19', '2026-02-02'],
    r: [5, null, 0, -3, 4, null],
    y: [0, 0, 0, 0, 0, 9],
    dsCorte: '2026-01-12', lastReal: '2026-01-19',
  };
  const p = a.temporalProfile(s);
  assert.deepEqual(p.years, [2025, 2026]);
  assert.equal(p.cells.length, 24);
  const cell = (y, m) => p.cells.find((c) => c.year === y && c.month === m);
  assert.deepEqual(cell(2025, 12), { year: 2025, month: 12, sum: 5, mean: 5, n: 1, missing: 1, negative: 0, first: '2025-12-22', last: '2025-12-29' });
  assert.deepEqual(cell(2026, 1), { year: 2026, month: 1, sum: 1, mean: 1 / 3, n: 3, missing: 0, negative: 1, first: '2026-01-05', last: '2026-01-19' });
  assert.deepEqual(cell(2026, 2), { year: 2026, month: 2, sum: null, mean: null, n: 0, missing: 0, negative: 0, first: null, last: null },
    'semanas posteriores a la última observación no son faltantes');
  assert.deepEqual(cell(2025, 1).n, 0);
  assert.deepEqual(a.temporalProfile(s, { from: '2026-01-01' }).years, [2026]);
  assert.deepEqual(a.temporalProfile(s, { from: '2025-12-29', to: '2025-12-29' }), { years: [], cells: [] });
  assert.deepEqual(a.temporalProfile(null), { years: [], cells: [] });
  assert.deepEqual(a.cellRange(cell(2026, 1)), { from: '2026-01-05', to: '2026-01-19' });
  assert.equal(a.cellRange(cell(2026, 2)), null);
  // zeros cuentan como valores, no como faltantes
  const zeros = a.temporalProfile({ d: ['2026-03-02', '2026-03-09'], r: [0, 0], y: [null, null], dsCorte: null, lastReal: null });
  const mar = zeros.cells.find((c) => c.month === 3);
  assert.equal(mar.n, 2);
  assert.equal(mar.sum, 0);
  assert.equal(mar.missing, 0);
});

const REAL = has('publication/catalog.json') && has('publication/obesidad/vista.json') && has(d.COHORTS.neuro);

test('real: release and legacy comparisons and profiles on installed data', { skip: !REAL }, () => {
  const view = read('publication/obesidad/vista.json');
  const pubMember = read('publication/catalog.json').releases.find((m) => m.disease_id === 'obesidad');
  const entry = {
    id: 'obesidad', kind: 'release', releaseId: pubMember.release_id, url: 'publication/obesidad/vista.json',
    nSeries: Object.keys(view.series).length, sexes: ['general', 'hombres', 'mujeres'],
  };
  const ds = u.normalizeDataset(entry, view);
  const terr = ['jalisco', 'nuevo-leon', 'mexico', 'nacional'];
  const its = terr.map((t) => ({ id: t, label: t, series: d.getSeries(ds.raw, ds.index, t, 'general'), disease: 'obesidad', sex: 'general' }));
  const c = a.buildComparison(its, { mode: 'indexed' });
  assert.ok(c.dates.length > 100);
  assert.ok(c.indexedAvailable);
  const bi = c.dates.indexOf(c.baselineDate);
  assert.ok(c.lines.every((l) => l.real[bi] === 100));
  assert.ok(c.lines.every((l) => l.baseline.value > 0));
  const prof = a.temporalProfile(its[0].series);
  assert.ok(prof.years.length >= 3);
  assert.equal(prof.cells.length, prof.years.length * 12);
  const totalN = prof.cells.reduce((s, x) => s + x.n, 0);
  assert.equal(totalN, its[0].series.r.filter((v) => v !== null).length);

  const neuro = read(d.COHORTS.neuro);
  const idx = d.buildIndex(neuro, 'depresion');
  const leg = ['jalisco', 'sonora'].map((t) => ({ id: t, label: t, series: d.getSeries(neuro, idx, t, 'hombres') }));
  const lc = a.buildComparison(leg);
  assert.ok(lc.dates.length > 0);
  assert.ok(lc.lines.every((l) => l.pron.filter((v) => v !== null).length === 52));
});
