import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as d from '../assets/dashboard/data.mjs';
import * as u from '../assets/dashboard/unified.mjs';

const root = process.env.DASHBOARD_SOURCE || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const has = (rel) => fs.existsSync(path.join(root, rel));
const read = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
const REAL = has('publication/catalog.json') && has(d.COHORTS.neuro) && has(d.COHORTS.dengue);

// ── fixtures ────────────────────────────────────────────────────────────────
const LEG_DATES = ['2026-08-17', '2026-08-24', '2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21'];
function zoomItem(seed) {
  return {
    motor: 'Ensemble', intervalo_disponible: false, color: '#000',
    d: LEG_DATES,
    r: [seed, 0, -1, seed + 2, null, null],
    y: [seed, 1, 2, 3, 4, 5],
    last_real: '2026-09-07', ds_corte: '2026-08-31',
    corte_modelo: { anio: 2026, semana: 35 }, ultima_semana_boletin: { anio: 2026, semana: 37 },
  };
}
function zoomFixture(folders) {
  const raw = {};
  for (const folder of folders) {
    for (const ent of ['Nacional', 'Aguascalientes', 'Jalisco']) {
      for (const sx of ['general', 'hombres', 'mujeres']) {
        raw[`${folder}/${ent}/${folder}_${ent}_${sx}.png`] = zoomItem(ent.length);
      }
    }
  }
  return raw;
}
const LEGACY = { neuro: zoomFixture(['Depresión', 'Parkinson', 'Alzheimer']), dengue: zoomFixture(['dengue']) };

const OBS = [['2026-01-05', 3], ['2026-01-12', 0], ['2026-01-19', -2], ['2026-01-26', null], ['2026-02-02', 5]];
const PRON = [['2026-01-26', 4.25], ['2026-02-02', 6.5], ['2026-02-09', 7.125]];

function makeView({
  id = 'demo_x01', release = `${id}_release_abc`, verdict = 'INCOMPLETE',
  label = 'Validación prospectiva en curso (1/4 semanas) · pronóstico puntual sin intervalos',
  weeks = 1, sexes = ['general', 'hombres', 'mujeres'], nombre = 'Demostración (X01, X02)',
  states = [['01', 'Aguascalientes'], ['15', 'México']], regions = [['centro', 'Región Centro']],
} = {}) {
  const series = {};
  const add = (nivel, sid, name, sx, motor) => {
    series[`${nivel}|${sid}|${sx}`] = {
      id: sid, motor, nivel, nombre: name, observado: OBS, pronostico: PRON,
      oos: { mae: 1 }, pronostico_52_total: 17.875, sexo: sx, sexo_nombre: sx,
    };
  };
  for (const sx of sexes) add('nacional', 'mx', 'Nacional', sx, 'portfolio');
  for (const [sid, name] of states) for (const sx of sexes) add('estado', sid, name, sx, sx === 'general' && sexes.length > 1 ? 'portfolio' : 'seasonal_mean_5y');
  for (const [sid, name] of regions) for (const sx of sexes) add('region', sid, name, sx, 'portfolio');
  return {
    schema: 'publication_view.v1', disease_id: id, release_id: release, display_name: nombre.replace(/ \(.*\)$/, ''),
    nombre_completo: nombre, forecast_emitted_at: '2026-11-06T13:51:05+00:00', horizon_weeks: 52,
    models: 4, products: Object.keys(series).length, observation_cutoff: [2026, 42],
    observation_cutoff_ds: '2026-10-19', observation_dataset_id: `${id}_x`, origin: [2026, 41],
    publication_label: label, uncertainty_label: 'Pronóstico puntual', verdict,
    weeks_available: weeks, weeks_required: 4, series,
  };
}
const member = (id, extra = {}) => ({
  disease_id: id, release_id: `${id}_release_abc`, lifecycle: 'published', mode: 'public',
  visible: true, channels: ['web'], gallery_enabled: false, verdict: 'INCOMPLETE', weeks_available: 0, ...extra,
});
const CONTROL_LABEL = 'Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos';

function fixtureCatalog() {
  const publication = {
    schema: 'publication_install.v1',
    releases: [
      member('demo_x01'), member('ctrl_c99'), member('pass_e66'), member('fem_c56'),
      member('draft_z1', { lifecycle: 'draft' }), member('private_z2', { mode: 'private' }),
      member('hidden_z3', { visible: false }), member('noweb_z4', { channels: ['epibot'] }),
    ],
  };
  const views = {
    demo_x01: makeView(),
    ctrl_c99: makeView({ id: 'ctrl_c99', label: CONTROL_LABEL, nombre: 'Tumor de control (C99)' }),
    pass_e66: makeView({ id: 'pass_e66', verdict: 'PASS', weeks: 4, label: 'Validación prospectiva superada (4/4 semanas)' }),
    fem_c56: makeView({ id: 'fem_c56', sexes: ['general'], nombre: 'Tumor maligno del ovario (C56)' }),
  };
  return { publication, views };
}

// ── catálogo ────────────────────────────────────────────────────────────────
test('makeCatalog joins 4 legacy and only published/public/visible/web releases (gallery flag ignored)', () => {
  const { publication, views } = fixtureCatalog();
  const c = u.makeCatalog({ legacy: LEGACY, publication, views });
  assert.equal(c.schema, 'epidashboard.catalog.v2');
  assert.deepEqual(c.diseases.map((x) => x.id), ['depresion', 'parkinson', 'alzheimer', 'dengue', 'ctrl_c99', 'demo_x01', 'fem_c56', 'pass_e66']);
  assert.deepEqual(c.summary.statusCounts, { legacy: 4, control: 1, pending: 2, pass: 1 });
  assert.equal(c.summary.legacy, 4);
  assert.equal(c.summary.release, 4);
  assert.equal(c.summary.series, c.diseases.reduce((a, x) => a + x.nSeries, 0));
});

test('release entries take labels, CIE, status, origin, cutoff and emission from the current view', () => {
  const { publication, views } = fixtureCatalog();
  const c = u.makeCatalog({ legacy: LEGACY, publication, views });
  const demo = u.catalogEntry(c, 'demo_x01');
  assert.equal(demo.label, 'Demostración (X01, X02)');
  assert.equal(demo.labelShort, 'Demostración');
  assert.equal(demo.cie, 'X01, X02');
  assert.equal(demo.url, 'publication/demo_x01/vista.json');
  assert.equal(demo.page, 'demo_x01.html');
  assert.deepEqual(demo.status, { kind: 'pending', label: views.demo_x01.publication_label, verdict: 'INCOMPLETE', weeksAvailable: 1, weeksRequired: 4 });
  assert.deepEqual(demo.origin, { anio: 2026, semana: 41 });
  assert.deepEqual(demo.lastObservation, { anio: 2026, semana: 42 });
  assert.equal(demo.lastIndex, '2026-10-19');
  assert.equal(demo.emittedAt, '2026-11-06T13:51:05+00:00');
  assert.equal(demo.nSeries, 12);
  assert.deepEqual(demo.sexes, ['general', 'hombres', 'mujeres']);
  // control: INCOMPLETE con etiqueta de control nunca es validación en curso
  const ctrl = u.catalogEntry(c, 'ctrl_c99');
  assert.equal(ctrl.status.kind, 'control');
  assert.equal(ctrl.status.verdict, 'INCOMPLETE');
  assert.equal(ctrl.group, u.GROUPS.tumores);
  assert.equal(u.catalogEntry(c, 'pass_e66').status.kind, 'pass');
  // sexos sólo general
  const fem = u.catalogEntry(c, 'fem_c56');
  assert.deepEqual(fem.sexes, ['general']);
  assert.deepEqual(Object.keys(fem.national), ['general']);
  assert.equal(fem.nSeries, 4);
});

test('national summary uses canonical total, exact sex and observed-only spark', () => {
  const { publication, views } = fixtureCatalog();
  const c = u.makeCatalog({ legacy: LEGACY, publication, views });
  const n = u.catalogEntry(c, 'demo_x01').national;
  assert.deepEqual(Object.keys(n), ['general', 'hombres', 'mujeres']);
  assert.equal(n.general.forecastTotal, 17.875);
  assert.equal(n.general.forecastTotalSource, u.TOTAL_SOURCES.canonical);
  assert.equal(n.general.forecastN, 3);
  assert.equal(n.general.start, '2026-01-26');
  assert.equal(n.general.end, '2026-02-09');
  assert.deepEqual(n.general.spark, [['2026-01-05', 3], ['2026-01-12', 0], ['2026-01-19', -2], ['2026-02-02', 5]]);
  // sin total canónico: suma sin redondeo
  const v = makeView();
  delete v.series['nacional|mx|general'].pronostico_52_total;
  const c2 = u.makeCatalog({ legacy: LEGACY, publication, views: { ...views, demo_x01: v } });
  const g = u.catalogEntry(c2, 'demo_x01').national.general;
  assert.equal(g.forecastTotal, 4.25 + 6.5 + 7.125);
  assert.equal(g.forecastTotalSource, u.TOTAL_SOURCES.sum);
});

test('legacy entries keep ids, urls, pages, CIE and rounded visual totals', () => {
  const { publication, views } = fixtureCatalog();
  const c = u.makeCatalog({ legacy: LEGACY, publication, views });
  const dep = u.catalogEntry(c, 'depresion');
  assert.equal(dep.kind, 'legacy');
  assert.equal(dep.url, d.COHORTS.neuro);
  assert.equal(dep.page, 'bitacora_modelado.html');
  assert.equal(dep.cie, 'F32');
  assert.equal(dep.releaseId, null);
  assert.equal(dep.emittedAt, null);
  assert.equal(dep.status.kind, 'legacy');
  assert.equal(dep.nSeries, 9);
  assert.equal(dep.national.general.forecastTotalSource, u.TOTAL_SOURCES.legacy);
  assert.equal(dep.national.general.forecastN, 3); // fechas > ds_corte
  assert.equal(dep.national.general.forecastTotal, 3 + 4 + 5);
  assert.deepEqual(dep.national.general.spark.map((p) => p[0]), ['2026-08-17', '2026-08-24', '2026-08-31', '2026-09-07']);
  const den = u.catalogEntry(c, 'dengue');
  assert.equal(den.page, 'dengue.html');
  assert.equal(den.cie, 'A97');
  assert.deepEqual(['parkinson', 'alzheimer'].map((id) => u.catalogEntry(c, id).cie), ['G20', 'G30']);
});

test('fails closed: missing view, FAIL, identity mismatch, unknown schema, duplicate ids', () => {
  const { publication, views } = fixtureCatalog();
  const without = { ...views };
  delete without.pass_e66;
  assert.throws(() => u.makeCatalog({ legacy: LEGACY, publication, views: without }), /vista ausente/);
  assert.throws(() => u.makeCatalog({ legacy: LEGACY, publication, views: { ...views, pass_e66: makeView({ id: 'pass_e66', verdict: 'FAIL' }) } }), /FAIL/);
  assert.throws(() => u.makeCatalog({ legacy: LEGACY, publication, views: { ...views, pass_e66: makeView({ id: 'pass_e66', release: 'otro' }) } }), /release_id/);
  assert.throws(() => u.makeCatalog({ legacy: LEGACY, publication, views: { ...views, pass_e66: makeView({ id: 'demo_x01' }) } }), /disease_id/);
  assert.throws(() => u.makeCatalog({ legacy: LEGACY, publication, views: { ...views, pass_e66: { ...makeView({ id: 'pass_e66' }), schema: 'x' } } }), /esquema/);
  assert.throws(() => u.makeCatalog({ legacy: LEGACY, publication, views: { ...views, pass_e66: makeView({ id: 'pass_e66', verdict: 'RARO' }) } }), /desconocido/);
  const dupPub = { ...publication, releases: [...publication.releases, member('demo_x01')] };
  assert.throws(() => u.makeCatalog({ legacy: LEGACY, publication: dupPub, views }), /duplicado/);
  const badProducts = { ...makeView({ id: 'pass_e66' }), products: 99 };
  assert.throws(() => u.makeCatalog({ legacy: LEGACY, publication, views: { ...views, pass_e66: badProducts } }), /products/);
  const badState = makeView({ id: 'pass_e66', states: [['99', 'Atlántida']] });
  assert.throws(() => u.makeCatalog({ legacy: LEGACY, publication, views: { ...views, pass_e66: badState } }), /territorio/);
});

test('validateCatalog rejects invalid schemas, duplicates and unsafe entries', () => {
  const { publication, views } = fixtureCatalog();
  const c = u.makeCatalog({ legacy: LEGACY, publication, views });
  assert.equal(u.validateCatalog(c), c);
  const clone = () => JSON.parse(JSON.stringify(c));
  assert.throws(() => u.validateCatalog({ ...clone(), schema: 'v1' }), /esquema/);
  const dup = clone(); dup.diseases.push({ ...dup.diseases[0] }); dup.summary = undefined;
  assert.throws(() => u.validateCatalog(dup), /duplicado/);
  const url = clone(); url.diseases[5].url = 'https://evil.example/x.json';
  assert.throws(() => u.validateCatalog(url), /url/);
  const dots = clone(); dots.diseases[5].url = '../secret.json';
  assert.throws(() => u.validateCatalog(dots), /url/);
  const sex = clone(); sex.diseases[5].sexes = ['general', 'otros'];
  assert.throws(() => u.validateCatalog(sex), /sexos/);
  const st = clone(); st.diseases[5].status.kind = 'legacy';
  assert.throws(() => u.validateCatalog(st), /estado/);
  const sum = clone(); sum.summary.series += 1;
  assert.throws(() => u.validateCatalog(sum), /summary/);
  // no exige 35: catálogo de un solo padecimiento es válido
  const one = clone(); one.diseases = [one.diseases[0]]; one.summary = undefined;
  assert.doesNotThrow(() => u.validateCatalog(one));
});

// ── datasets ────────────────────────────────────────────────────────────────
test('release dataset merges by ISO date, keeps zeros/negatives/nulls and only exact forecasts', () => {
  const { publication, views } = fixtureCatalog();
  const c = u.makeCatalog({ legacy: LEGACY, publication, views });
  const ds = u.normalizeDataset(u.catalogEntry(c, 'demo_x01'), views.demo_x01);
  assert.equal(ds.index.padecimiento.id, 'demo_x01');
  assert.deepEqual([...ds.index.entities.keys()], ['nacional', 'aguascalientes', 'mexico', 'region-centro']);
  assert.equal(ds.index.entities.get('mexico').label, 'Estado de México');
  assert.equal(ds.index.entities.get('region-centro').label, 'Región Centro');
  assert.equal(ds.index.entities.get('region-centro').tipo, 'region');
  const key = ds.index.entities.get('aguascalientes').keys.hombres;
  assert.equal(key, 'estado|01|hombres');
  const raw = ds.raw[key];
  assert.deepEqual(raw.d, ['2026-01-05', '2026-01-12', '2026-01-19', '2026-01-26', '2026-02-02', '2026-02-09']);
  assert.deepEqual(raw.r, [3, 0, -2, null, 5, null]);
  assert.deepEqual(raw.y, [null, null, null, 4.25, 6.5, 7.125]);
  assert.equal(raw.ds_corte, '2026-01-19');
  assert.equal(raw.last_real, '2026-02-02');
  assert.deepEqual(raw.corte_modelo, { anio: 2026, semana: 41 });
  assert.deepEqual(raw.ultima_semana_boletin, { anio: 2026, semana: 42 });
  assert.equal(raw.intervalo_disponible, false);
  assert.equal(raw.oos, undefined, 'las métricas retiradas no se propagan');
  const s = d.getSeries(ds.raw, ds.index, 'aguascalientes', 'hombres');
  const rows = d.buildRows(s);
  assert.deepEqual(rows.map((r) => r.fase), ['observado', 'observado', 'observado', 'verificable', 'verificable', 'futuro']);
  const k = d.computeKpis(s, rows, rows);
  assert.equal(k.pronostico.n, 3);
  assert.equal(k.pronostico.sum, 4.25 + 6.5 + 7.125);
  assert.equal(ds.metadata.emittedAt, '2026-11-06T13:51:05+00:00');
  assert.deepEqual(ds.metadata.origin, { anio: 2026, semana: 41 });
  assert.equal(ds.metadata.status.kind, 'pending');
  assert.equal(ds.metadata.derivedHint.models, 4);
  assert.equal(ds.metadata.derivedHint.portfolioProducts, 8);
  assert.equal(ds.metadata.source.url, 'publication/demo_x01/vista.json');
});

test('release dataset works with rankEstados and motorDistribution; sex resolution never invents sexes', () => {
  const { publication, views } = fixtureCatalog();
  const c = u.makeCatalog({ legacy: LEGACY, publication, views });
  const ds = u.normalizeDataset(u.catalogEntry(c, 'demo_x01'), views.demo_x01);
  const rank = d.rankEstados(ds.raw, ds.index, 'general', 'pronostico', 'todo');
  assert.equal(rank.length, 32);
  assert.equal(rank.filter((r) => r.value !== null).length, 2);
  assert.ok(rank.every((r) => r.slug !== 'nacional' && !r.slug.startsWith('region-')));
  const md = d.motorDistribution(ds.raw, ds.index, 'hombres');
  assert.equal(md.total, 4);
  assert.deepEqual(md.byTipo, { nacional: 1, estado: 2, region: 1 });

  const fem = u.normalizeDataset(u.catalogEntry(c, 'fem_c56'), views.fem_c56);
  assert.deepEqual(u.datasetSexes(fem, 'nacional'), ['general']);
  assert.deepEqual(u.datasetSexes(fem, 'no-existe'), []);
  assert.deepEqual(u.resolveDatasetSex(fem, 'nacional', 'mujeres'), { sex: 'general', fallback: true });
  assert.deepEqual(u.resolveDatasetSex(fem, 'nacional', 'general'), { sex: 'general', fallback: false });
  assert.deepEqual(u.resolveDatasetSex(fem, 'no-existe', 'general'), { sex: null, fallback: true });
  assert.equal(d.getSeries(fem.raw, fem.index, 'nacional', 'mujeres'), null);
  // sin general: cae al primero existente, siempre con aviso
  const onlyMen = { index: { entities: new Map([['nacional', { keys: { hombres: 'k' } }]]) } };
  assert.deepEqual(u.resolveDatasetSex(onlyMen, 'nacional', 'mujeres'), { sex: 'hombres', fallback: true });
});

test('release dataset fails closed on identity mismatch and bad pairs', () => {
  const { publication, views } = fixtureCatalog();
  const c = u.makeCatalog({ legacy: LEGACY, publication, views });
  const entry = u.catalogEntry(c, 'demo_x01');
  assert.throws(() => u.normalizeDataset(entry, views.pass_e66), /disease_id/);
  assert.throws(() => u.normalizeDataset(entry, null), /vista ausente/);
  const bad = makeView();
  bad.series['nacional|mx|general'] = { ...bad.series['nacional|mx|general'], observado: [['2026-01-05', 'x']] };
  assert.throws(() => u.normalizeDataset(entry, bad), /no numérico/);
  const unordered = makeView();
  unordered.series['nacional|mx|general'] = { ...unordered.series['nacional|mx|general'], pronostico: [['2026-02-09', 1], ['2026-01-26', 2]] };
  assert.throws(() => u.normalizeDataset(entry, unordered), /crecientes/);
  assert.throws(() => u.normalizeDataset({ ...entry, nSeries: 5 }, views.demo_x01), /series/);
});

test('legacy dataset reuses buildIndex and validates every expected key', () => {
  const { publication, views } = fixtureCatalog();
  const c = u.makeCatalog({ legacy: LEGACY, publication, views });
  const entry = u.catalogEntry(c, 'parkinson');
  const ds = u.normalizeDataset(entry, LEGACY.neuro);
  assert.equal(ds.raw, LEGACY.neuro);
  assert.equal(ds.index.padecimiento, entry);
  assert.deepEqual([...ds.index.entities.keys()], ['nacional', 'aguascalientes', 'jalisco']);
  assert.equal(ds.metadata.valuesRounded, true);
  assert.equal(ds.metadata.emittedAt, null);
  assert.deepEqual(u.datasetSexes(ds, 'jalisco'), ['general', 'hombres', 'mujeres']);
  const s = d.getSeries(ds.raw, ds.index, 'jalisco', 'mujeres');
  assert.deepEqual(s.r, [7, 0, -1, 9, null, null]);
  const missing = { ...LEGACY.neuro };
  delete missing['Parkinson/Jalisco/Parkinson_Jalisco_mujeres.png'];
  assert.throws(() => u.normalizeDataset(entry, missing), /sin clave mujeres/);
  const badDate = { ...LEGACY.neuro, 'Parkinson/Jalisco/Parkinson_Jalisco_hombres.png': { ...zoomItem(1), d: ['2026-08-17', 'x', ...LEG_DATES.slice(2)] } };
  assert.throws(() => u.normalizeDataset(entry, badDate), /fechas/);
});

test('helpers: CIE extraction and member filter', () => {
  assert.equal(u.extractCie({ nombre_completo: 'Infecciones respiratorias agudas (J00-J06, J20, J21 excepto J02, J03.0)' }), 'J00-J06, J20, J21 excepto J02, J03.0');
  assert.equal(u.extractCie({ nombre_completo: 'Obesidad (E66)', cie: 'E66.9' }), 'E66.9');
  assert.equal(u.extractCie({ nombre_completo: 'Sin código' }), null);
  assert.equal(u.isPublishedMember(member('a', { gallery_enabled: false })), true);
  assert.equal(u.isPublishedMember(member('a', { channels: undefined })), true);
  assert.equal(u.isPublishedMember(member('a', { visible: undefined })), true);
  assert.equal(u.isPublishedMember(member('a', { visible: false })), false);
  assert.equal(u.addDaysIso('2026-03-02', -7), '2026-02-23');
});

// ── contrato canónico de veredictos (INCOMPLETE, PASS, FAIL, CONTROL_ONLY) ──
test('CONTROL_ONLY is accepted as control, never pass, preserving literal verdict and label', () => {
  const { publication, views } = fixtureCatalog();
  const v = makeView({ id: 'pass_e66', verdict: 'CONTROL_ONLY', weeks: 4, label: CONTROL_LABEL });
  const c = u.makeCatalog({ legacy: LEGACY, publication, views: { ...views, pass_e66: v } });
  const e = u.catalogEntry(c, 'pass_e66');
  assert.deepEqual(e.status, { kind: 'control', label: CONTROL_LABEL, verdict: 'CONTROL_ONLY', weeksAvailable: 4, weeksRequired: 4 });
  assert.deepEqual(c.summary.statusCounts, { legacy: 4, control: 2, pending: 2, pass: 0 });
  const ds = u.normalizeDataset(e, v);
  assert.equal(ds.metadata.status.kind, 'control');
  assert.equal(ds.metadata.status.verdict, 'CONTROL_ONLY');
  // aunque la etiqueta no diga «control estacional», CONTROL_ONLY sigue siendo control
  const odd = makeView({ id: 'pass_e66', verdict: 'CONTROL_ONLY', weeks: 4, label: 'Etiqueta sin la palabra clave (4/4 semanas)' });
  assert.equal(u.statusFromView(odd).kind, 'control');
  assert.equal(u.statusFromView(odd).label, 'Etiqueta sin la palabra clave (4/4 semanas)');
  assert.equal(u.statusFromView(makeView({ verdict: 'PASS', weeks: 4 })).kind, 'pass');
});

test('FAIL stays closed in catalog and dataset, with any label or week count', () => {
  const { publication, views } = fixtureCatalog();
  for (const label of [CONTROL_LABEL, 'Validación prospectiva superada (4/4 semanas)']) {
    const v = makeView({ id: 'pass_e66', verdict: 'FAIL', weeks: 4, label });
    assert.throws(() => u.makeCatalog({ legacy: LEGACY, publication, views: { ...views, pass_e66: v } }), /FAIL/);
    assert.throws(() => u.statusFromView(v), /FAIL/);
  }
  const c = u.makeCatalog({ legacy: LEGACY, publication, views });
  assert.throws(() => u.normalizeDataset(u.catalogEntry(c, 'pass_e66'), makeView({ id: 'pass_e66', verdict: 'FAIL', weeks: 4 })), /FAIL/);
  assert.throws(() => u.statusFromView(makeView({ verdict: 'control_only' })), /desconocido/);
});

// ── elegibilidad separada de identidad ──────────────────────────────────────
test('eligible published/public/web members with malformed identity fail closed (never vanish)', () => {
  const { views } = fixtureCatalog();
  const base = [member('demo_x01')];
  const pubWith = (bad) => ({ schema: 'publication_install.v1', releases: [...base, bad] });
  const broken = [
    ['sin disease_id', { ...member('x'), disease_id: undefined }],
    ['disease_id null', { ...member('x'), disease_id: null }],
    ['disease_id vacío', { ...member('x'), disease_id: '' }],
    ['disease_id inválido', { ...member('x'), disease_id: 'Mal ID/..' }],
    ['disease_id numérico', { ...member('x'), disease_id: 42 }],
    ['sin release_id', { ...member('zz_a1'), release_id: undefined }],
    ['release_id vacío', { ...member('zz_a1'), release_id: '' }],
    ['release_id numérico', { ...member('zz_a1'), release_id: 7 }],
    ['release_id con espacios', { ...member('zz_a1'), release_id: 'zz a1' }],
    ['sin channels declarado igual elegible', { ...member('zz_a1'), channels: undefined, release_id: undefined }],
  ];
  for (const [why, bad] of broken) {
    assert.throws(() => u.selectPublishedMembers(pubWith(bad)), /disease_id|release_id/, why);
    assert.throws(() => u.makeCatalog({ legacy: LEGACY, publication: pubWith(bad), views }), /disease_id|release_id/, why);
  }
  assert.throws(() => u.selectPublishedMembers({ releases: [...base, { ...member('zz_a1'), release_id: 'demo_x01_release_abc' }] }), /release_id duplicado/);
});

test('channels type is validated when declared; non-object records fail', () => {
  const pub = (m) => ({ releases: [member('demo_x01'), m] });
  for (const channels of ['web', null, { web: true }, ['web', 1]]) {
    assert.throws(() => u.selectPublishedMembers(pub({ ...member('zz_a1'), channels })), /channels/, JSON.stringify(channels));
  }
  // la validación de tipo aplica aunque el registro no sea elegible
  assert.throws(() => u.selectPublishedMembers(pub({ ...member('zz_a1'), lifecycle: 'draft', channels: 'web' })), /channels/);
  for (const rec of [null, 'x', 3, []]) assert.throws(() => u.selectPublishedMembers(pub(rec)), /no es objeto/);
});

test('configured, private, invisible and no-web members are excluded even with malformed identity', () => {
  const ok = member('demo_x01');
  const excluded = [
    { lifecycle: 'configured', disease_id: undefined, release_id: undefined, mode: 'public', channels: ['web'] },
    { lifecycle: 'published', mode: 'private', disease_id: 'Mal ID', release_id: null, channels: ['web'] },
    { lifecycle: 'published', mode: 'public', visible: false, disease_id: null, channels: ['web'] },
    { lifecycle: 'published', mode: 'public', channels: ['epibot', 'reports'], disease_id: 42 },
    { lifecycle: 'published', mode: 'public', channels: [], release_id: 7 },
  ];
  const sel = u.selectPublishedMembers({ releases: [ok, ...excluded] });
  assert.deepEqual(sel.map((m) => m.disease_id), ['demo_x01']);
  for (const m of excluded) assert.equal(u.isEligibleMember(m), false);
  assert.equal(u.isEligibleMember(member('zz_a1', { gallery_enabled: false })), true);
  assert.equal(u.isEligibleMember({ ...member('zz_a1'), disease_id: undefined }), true, 'elegible: la identidad se valida aparte');
  assert.throws(() => u.assertMemberIdentity({ ...member('zz_a1'), disease_id: undefined }), /disease_id/);
  assert.equal(u.assertMemberIdentity(member('zz_a1')).disease_id, 'zz_a1');
});

// ── datos reales instalados ─────────────────────────────────────────────────
function realInputs() {
  const publication = read('publication/catalog.json');
  const views = {};
  for (const m of u.selectPublishedMembers(publication)) views[m.disease_id] = read(`publication/${m.disease_id}/vista.json`);
  return { legacy: { neuro: read(d.COHORTS.neuro), dengue: read(d.COHORTS.dengue) }, publication, views };
}

test('real: every published disease and series uses status from current views', { skip: !REAL }, () => {
  const inputs = realInputs();
  const c = u.makeCatalog(inputs);
  const releases = Object.keys(inputs.views).length;
  const products = Object.values(inputs.views).reduce((n,v) => n + Object.keys(v.series).length, 0);
  assert.equal(c.summary.diseases, d.PADECIMIENTOS.length + releases);
  assert.equal(c.summary.legacy, d.PADECIMIENTOS.length);
  assert.equal(c.summary.release, releases);
  assert.equal(c.summary.series, 432 + products);
  for (const e of c.diseases.filter((x) => x.kind === 'release')) {
    const v = inputs.views[e.id];
    assert.equal(e.releaseId, v.release_id);
    assert.equal(e.status.label, v.publication_label, e.id);
    assert.equal(e.status.verdict, v.verdict, e.id);
    assert.equal(e.status.weeksAvailable, v.weeks_available, e.id);
    assert.equal(e.status.weeksRequired, v.weeks_required, e.id);
    assert.deepEqual(e.origin, { anio: v.origin[0], semana: v.origin[1] });
    assert.equal(e.emittedAt, v.forecast_emitted_at);
    assert.equal(e.label, v.nombre_completo);
    assert.equal(e.labelShort, v.display_name);
    assert.ok(e.cie, `${e.id} sin CIE`);
    if (/control estacional/i.test(v.publication_label)) assert.equal(e.status.kind, 'control', e.id);
    else if (v.verdict === 'INCOMPLETE') assert.equal(e.status.kind, 'pending', e.id);
    const nat = v.series['nacional|mx|general'];
    assert.equal(e.national.general.forecastTotal, nat.pronostico_52_total, e.id);
    assert.ok(e.national.general.spark.length <= 26 && e.national.general.spark.length > 0);
    assert.ok(e.national.general.spark.at(-1)[0] <= v.observation_cutoff_ds, `${e.id}: spark con futuro`);
  }
  const ob = u.catalogEntry(c, 'obesidad');
  assert.equal(ob.status.kind, 'pass');
  assert.equal(ob.status.weeksAvailable, 4);
  assert.equal(ob.status.weeksRequired, 4);
  for (const id of ['cancer_ovario_c56', 'cancer_cuello_utero_c53', 'cancer_cuerpo_utero_c54', 'cancer_prostata_c61']) {
    assert.deepEqual(u.catalogEntry(c, id).sexes, ['general'], id);
    assert.equal(u.catalogEntry(c, id).nSeries, 37, id);
  }
  // gallery_enabled=false no excluye: todos los miembros publicados entran
  const selected = u.selectPublishedMembers(inputs.publication);
  assert.equal(selected.length, Object.keys(inputs.views).length);
  assert.equal(selected.filter((m) => m.gallery_enabled === false).length,
    inputs.publication.releases.filter((m) => u.isPublishedMember(m) && m.gallery_enabled === false).length);
  assert.deepEqual(Object.keys(c.summary.statusCounts), ['legacy', 'control', 'pending', 'pass']);
  assert.equal(c.summary.statusCounts.legacy, 4);
  assert.equal(c.summary.statusCounts.pass, Object.values(inputs.views).filter(v => v.verdict === 'PASS').length);
  // el catálogo de instalación trae 0/4 en todos los pendientes; la vista manda
  const stale = inputs.publication.releases.filter((m) => inputs.views[m.disease_id] && m.weeks_available !== inputs.views[m.disease_id].weeks_available);
  for (const m of stale) assert.equal(u.catalogEntry(c, m.disease_id).status.weeksAvailable, inputs.views[m.disease_id].weeks_available);
});

test('real: every installed series normalizes and works with data.mjs', { skip: !REAL }, () => {
  const inputs = realInputs();
  const c = u.makeCatalog(inputs);
  let total = 0;
  for (const e of c.diseases) {
    const payload = e.kind === 'legacy' ? inputs.legacy[e.cohort] : inputs.views[e.id];
    const ds = u.normalizeDataset(e, payload);
    for (const ent of ds.index.entities.values()) {
      const sexes = u.datasetSexes(ds, ent.slug);
      assert.ok(sexes.length, `${e.id}/${ent.slug}`);
      for (const sx of sexes) {
        const s = d.getSeries(ds.raw, ds.index, ent.slug, sx);
        assert.ok(s, `${e.id}/${ent.slug}/${sx}`);
        const rows = d.buildRows(s);
        assert.ok(rows.every((r) => r.pron === null || r.date > s.dsCorte));
        if (e.kind === 'release') {
          const v = inputs.views[e.id].series[ds.index.entities.get(ent.slug).keys[sx]];
          const k = d.computeKpis(s, rows, rows);
          assert.equal(k.pronostico.n, v.pronostico.filter((p) => typeof p[1] === 'number').length);
          assert.equal(s.r.filter((x) => x !== null).length, v.observado.filter((p) => typeof p[1] === 'number').length);
        }
        total += 1;
      }
    }
    const rank = d.rankEstados(ds.raw, ds.index, 'general', 'pronostico', 'todo');
    assert.equal(rank.filter((r) => r.value !== null).length, 32, e.id);
    assert.ok(d.motorDistribution(ds.raw, ds.index, 'general').total >= 33, e.id);
  }
  assert.equal(total, 432 + Object.values(inputs.views).reduce((n,v) => n + Object.keys(v.series).length, 0));
});

test('real: sex-specific releases are general-only and fallback is explicit', { skip: !REAL }, () => {
  const inputs = realInputs();
  const c = u.makeCatalog(inputs);
  const ds = u.normalizeDataset(u.catalogEntry(c, 'cancer_prostata_c61'), inputs.views.cancer_prostata_c61);
  assert.deepEqual(u.datasetSexes(ds, 'jalisco'), ['general']);
  assert.deepEqual(u.resolveDatasetSex(ds, 'jalisco', 'hombres'), { sex: 'general', fallback: true });
  assert.deepEqual([...ds.index.entities.values()].filter((x) => x.tipo === 'region').map((x) => x.slug).sort(),
    ['region-centro', 'region-norte', 'region-occidente', 'region-sureste']);
  assert.equal(ds.index.entities.size, 37);
});
