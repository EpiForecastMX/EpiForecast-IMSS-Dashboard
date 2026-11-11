import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as d from '../assets/dashboard/data.mjs';
const root = process.env.DASHBOARD_SOURCE || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));

test('all 432 installed legacy series resolve without dropping states, sexes or regions', () => {
  let count = 0;
  for (const p of d.PADECIMIENTOS) {
    const raw = read(d.COHORTS[p.cohort]);
    const index = d.buildIndex(raw, p.id);
    assert.equal(index.entities.size, p.id === 'dengue' ? 33 : 37);
    for (const e of index.entities.values()) {
      for (const s of d.SEXOS) {
        const series = d.getSeries(raw, index, e.slug, s.id);
        assert.ok(series, `${p.id}/${e.slug}/${s.id}`);
        const rows = d.buildRows(series);
        const kpis = d.computeKpis(series, rows, rows);
        assert.equal(kpis.pronostico.n, 52, `${p.id}/${e.slug}/${s.id}`);
        assert.ok(rows.every(r => r.date > series.dsCorte || r.pron === null));
        count++;
      }
    }
    for (const s of d.SEXOS) {
      const ranking = d.rankEstados(raw, index, s.id, 'pronostico', 'todo');
      assert.equal(ranking.filter(r => r.value !== null).length, 32);
      assert.ok(ranking.every(r => r.slug !== 'nacional' && !r.slug.startsWith('region-')));
      assert.equal(d.motorDistribution(raw, index, s.id).total, index.entities.size);
    }
  }
  assert.equal(count, 432);
});

test('all installed Mexico geometries join to the same 32 state identities', () => {
  const map = d.normalizeMap(read(d.MAP_URL));
  assert.equal(map.states.length, 32);
  assert.deepEqual(map.unknown, []);
  assert.deepEqual(new Set(map.states.map(s => s.slug)), new Set(d.ESTADOS.map(s => s.slug)));
});
