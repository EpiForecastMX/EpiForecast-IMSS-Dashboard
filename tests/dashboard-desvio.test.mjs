/**
 * Orden «Mayor desvío reciente» del panorama (decisión del autor, 25-nov-2026; acta en planes/mesa_plataforma_2026-11-25/).
 * Sólo lo ya medido en la serie nacional general después del origen, con observados y esperados a la vista.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCatalog } from '../scripts/build_dashboard_catalog.mjs';
import { recentOf } from '../assets/dashboard/unified.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel) => readFileSync(resolve(root, rel), 'utf8');
const { catalog } = buildCatalog(root);

test('recentOf toma lo publicado en oos y devuelve null sin semanas', () => {
  assert.equal(recentOf(null), null);
  assert.equal(recentOf({ semanas: 0, observado_total: 0, pronostico_total: 0 }), null);
  assert.deepEqual(recentOf({ semanas: 2, observado_total: 5402, pronostico_total: 6128.5, sesgo_pct: 13.45 }),
    { weeks: 2, observed: 5402, expected: 6128.5, biasPct: 13.45 });
});

test('el catálogo lleva el desvío reciente de cada release igual a su vista; los históricos no lo tienen', () => {
  let con = 0;
  for (const d of catalog.diseases) {
    const r = d.national?.general?.recent ?? null;
    if (d.kind === 'legacy') { assert.equal(r, null, d.id); continue; }
    const o = JSON.parse(leer(`publication/${d.id}/vista.json`)).series['nacional|mx|general']?.oos;
    if (!o?.semanas) { assert.equal(r, null, d.id); continue; }
    con++;
    assert.deepEqual(r, { weeks: o.semanas, observed: o.observado_total, expected: o.pronostico_total, biasPct: o.sesgo_pct }, d.id);
  }
  assert.ok(con > 50, `${con} con semanas medidas`);
  const asma = catalog.diseases.find((d) => d.id === 'asma_j45').national.general.recent;
  assert.deepEqual([asma.weeks, asma.observed, asma.expected], [2, 5402, 6128.5]);
});

test('el tablero ofrece el orden, lo explica en cada tarjeta y en la tabla, y deja al final lo que no tiene semanas', () => {
  assert.match(leer('EpiDashboard.html'), /<option value="desvio">Mayor desvío reciente<\/option>/);
  assert.match(leer('EpiDashboard.html'), /<th scope="col">Desvío reciente \(nacional\)<\/th>/);
  const js = leer('assets/dashboard/dashboard.mjs');
  assert.match(js, /desvio: \(a, b\) => \(desvioKey\(b\) - desvioKey\(a\)\) \|\| byName\(a, b\)/);
  assert.match(js, /const DESVIO_MIN_CASOS = 20;/);
  assert.match(js, /statusKind\(d\) === 'control' \? 'el control' : 'el pronóstico'/);
  assert.match(js, /observados frente a \$\{formatInt\(r\.expected\)\} esperados/);
});
