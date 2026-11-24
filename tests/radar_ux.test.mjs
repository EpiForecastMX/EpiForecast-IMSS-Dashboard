// Revisión de UX para la presentación (mesa de expertos, 23-nov-2026): «Lo que cambia» y textos visibles.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel) => readFileSync(resolve(root, rel), 'utf8');
const imp = (rel) => import(pathToFileURL(resolve(root, rel)).href);
const actual = JSON.parse(leer('assets/boletin/actual.json'));
const data = JSON.parse(leer(`${actual.carpeta}/data.json`));

test('«Lo que cambia» ordena el mismo cambio de la columna «Vs. año anterior», sin agregados ni bases pequeñas', async () => {
  const { senales, cambio } = await imp('assets/boletin/senales.mjs');
  const { numero } = await imp('assets/boletin/celdas.mjs');
  const num = (v, d) => numero(v, d?.guion, null);
  const s = senales(data.diseases, num);
  assert.equal(s.suben.length, 5);
  assert.equal(s.bajan.length, 5);
  for (const x of [...s.suben, ...s.bajan]) {
    assert.ok(!x.d.aggregate);
    assert.ok(x.b >= 1000, `${x.d.name}: base ${x.b}`);
    assert.equal(x.pct, (num(x.d.cumulative, x.d) / num(x.d.previous, x.d) - 1) * 100);
    assert.equal(x.pct, cambio(x.d, num));
  }
  assert.ok(s.suben.every((x, i, a) => !i || a[i - 1].pct >= x.pct));
  assert.ok(s.bajan.every((x, i, a) => !i || a[i - 1].pct <= x.pct));
  assert.ok(s.suben.every((x) => x.pct > 0) && s.bajan.every((x) => x.pct < 0));
});

test('formato de cambio: un decimal, signo y «Sin cambio» al redondear a cero', async () => {
  const { textoCambio } = await imp('assets/boletin/senales.mjs');
  assert.equal(textoCambio(5), '+5.0 %');
  assert.equal(textoCambio(-8.14), '−8.1 %');
  assert.equal(textoCambio(-0.04), 'Sin cambio');
  assert.equal(textoCambio(null), 'Sin cifra comparable');
});

test('boletin.html: atribución, sección «Lo que cambia» y sin la ruta interna del pronóstico', () => {
  const html = leer('boletin.html');
  assert.match(html, /CON DATOS DEL SINAVE · DIRECCIÓN GENERAL DE EPIDEMIOLOGÍA/);
  assert.match(html, /<section id="senales" aria-labelledby="senales-heading">/);
  assert.match(html, /<a href="#senales">Lo que cambia<\/a>/);
  assert.match(html, /<button type="button" id="platformMore"/);
  assert.doesNotMatch(html, /Pronóstico nacional de 52 semanas/);
  assert.match(leer('assets/boletin/pronostico_vista.mjs'), /Fuente: \$\{fuenteLegible\(m\)\}/);
});
