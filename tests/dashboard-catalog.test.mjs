import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as u from '../assets/dashboard/unified.mjs';
import { buildCatalog, checkCatalog, DEFAULT_OUT } from '../scripts/build_dashboard_catalog.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(process.env.DASHBOARD_SOURCE || path.join(here, '..'));
const script = path.join(here, '..', 'scripts', 'build_dashboard_catalog.mjs');
const has = (rel) => fs.existsSync(path.join(root, rel));
const REAL = has('publication/catalog.json');
const read = rel => JSON.parse(fs.readFileSync(path.join(root,rel),'utf8'));
const expectedMembers = () => u.selectPublishedMembers(read('publication/catalog.json'));
const expectedCount = () => 4 + expectedMembers().length;
const expectedSeries = () => 432 + expectedMembers().reduce((n,m) => n + Object.keys(read(`publication/${m.disease_id}/vista.json`).series).length,0);
const sha = (rel) => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, rel))).digest('hex');

test('builder output is deterministic, valid and covers the full installed publication set', { skip: !REAL }, () => {
  const a = buildCatalog(root);
  const b = buildCatalog(root);
  assert.equal(a.text, b.text, 'misma entrada, mismos bytes');
  assert.ok(a.text.endsWith('\n'));
  const parsed = u.validateCatalog(JSON.parse(a.text));
  assert.equal(parsed.schema, 'epidashboard.catalog.v2');
  assert.equal(parsed.summary.diseases, expectedCount());
  assert.equal(parsed.summary.legacy, 4);
  assert.equal(parsed.summary.release, expectedMembers().length);
  assert.equal(parsed.summary.series, expectedSeries());
  assert.equal(parsed.diseases.length, expectedCount());
  assert.ok(!/"(generatedAt|generated_at|timestamp|builtAt)"/.test(a.text), 'sin marca de reloj');
  assert.ok(!/"oos"|"smape"|"mae"|"sesgo_pct"/.test(a.text), 'sin métricas retiradas');
});

test('builder records source hashes for the ficha', { skip: !REAL }, () => {
  const { catalog } = buildCatalog(root);
  for (const e of catalog.diseases) {
    assert.match(e.sourceSha256, /^[0-9a-f]{64}$/);
    const rel = e.kind === 'legacy' ? e.url : `publication/${e.id}/vista.json`;
    assert.equal(e.url, rel);
    assert.equal(e.sourceSha256, sha(rel), e.id);
  }
  assert.equal(catalog.sources.publicationCatalog.sha256, sha('publication/catalog.json'));
  assert.equal(catalog.sources.zoom.neuro.sha256, sha(catalog.sources.zoom.neuro.path));
  assert.equal(catalog.sources.zoom.dengue.sha256, sha(catalog.sources.zoom.dengue.path));
});

test('installed assets/dashboard/catalog.json matches the builder byte for byte', { skip: !REAL }, () => {
  const res = checkCatalog(root, DEFAULT_OUT);
  assert.deepEqual(res, { ok: true, reason: null },
    'ejecute: node scripts/build_dashboard_catalog.mjs (desde la raíz) y vuelva a probar');
});

test('--check reports missing or stale output with rc != 0', { skip: !REAL }, () => {
  assert.deepEqual(checkCatalog(root, 'assets/dashboard/__no_existe__.json'), { ok: false, reason: 'falta assets/dashboard/__no_existe__.json' });
  assert.equal(checkCatalog(root, 'package.json').ok, false);
  const missing = spawnSync(process.execPath, [script, '--root', root, '--check', '--out', 'assets/dashboard/__no_existe__.json'], { encoding: 'utf8' });
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /falta/);
  const stale = spawnSync(process.execPath, [script, '--root', root, '--check', '--out', 'package.json'], { encoding: 'utf8' });
  assert.notEqual(stale.status, 0);
  assert.match(stale.stderr, /desactualizado/);
  const bad = spawnSync(process.execPath, [script, '--root', root, '--check', '--out', '../fuera.json'], { encoding: 'utf8' });
  assert.notEqual(bad.status, 0);
  const unknown = spawnSync(process.execPath, [script, '--bogus'], { encoding: 'utf8' });
  assert.notEqual(unknown.status, 0);
});

test('catalog entries expose the brief contract for the UI', { skip: !REAL }, () => {
  const { catalog } = buildCatalog(root);
  const required = ['id', 'label', 'labelShort', 'cie', 'kind', 'cohort', 'url', 'page', 'releaseId', 'nSeries',
    'sexes', 'status', 'origin', 'lastObservation', 'lastIndex', 'emittedAt', 'national'];
  for (const e of catalog.diseases) {
    for (const f of required) assert.ok(Object.hasOwn(e, f), `${e.id}.${f}`);
    for (const f of ['kind', 'label', 'verdict', 'weeksAvailable', 'weeksRequired']) assert.ok(Object.hasOwn(e.status, f), `${e.id}.status.${f}`);
    for (const [sx, n] of Object.entries(e.national)) {
      for (const f of ['forecastTotal', 'forecastN', 'start', 'end', 'spark']) assert.ok(Object.hasOwn(n, f), `${e.id}.national.${sx}.${f}`);
      assert.ok(n.spark.length <= 26);
    }
    assert.ok(e.national.general, `${e.id} sin nacional general`);
  }
  const ids = catalog.diseases.map((e) => e.id);
  assert.deepEqual(ids.slice(0, 4), ['depresion', 'parkinson', 'alzheimer', 'dengue']);
  assert.equal(new Set(ids).size, expectedCount());
  const counts = catalog.summary.statusCounts;
  assert.equal(counts.legacy + counts.control + counts.pending + counts.pass, expectedCount());
});
