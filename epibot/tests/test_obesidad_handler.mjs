/**
 * C7.7 — EpiBot: Obesidad responde con las cifras de su release publicado (vista derivada).
 *
 * Se alimenta con la vista REAL instalada en publication/obesidad/vista.json; si el sitio aún no la
 * tiene, la prueba falla (Obesidad está publicada y su vista es parte del sitio).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';

const K = readFileSync(new URL('../knowledge.json', import.meta.url), 'utf-8');
const V = readFileSync(new URL('../../publication/obesidad/vista.json', import.meta.url), 'utf-8');
const VISTA = JSON.parse(V);
globalThis.fetch = async (u) => ({
  ok: true,
  json: async () => JSON.parse(String(u).includes('publication/obesidad/vista.json') ? V : K),
});
const kb = await import('../js/kb.js');
const d = await kb.loadKnowledge();
await d.obesidad_pendiente;

test('la vista cargada es la del release publicado', () => {
  assert.equal(d.obesidad.schema, 'publication_view.v1');
  assert.match(d.obesidad.release_id, /^obesidad_release_/);
  assert.equal(Object.keys(d.obesidad.series).length, 111);
});

test('pronóstico nacional: cifras de la vista, etiqueta y sin intervalos', async () => {
  const r = await kb.answer('pronostico de obesidad');
  const nac = VISTA.series['nacional|mx|general'];
  assert.match(r, /Obesidad \(E66\) · Nacional · General/);
  assert.ok(r.includes(`${nac.oos.smape.toLocaleString('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`));
  assert.ok(r.includes(VISTA.publication_label));
  assert.ok(r.includes(VISTA.uncertainty_label));
  assert.match(r, /\.\.\/obesidad\.html/);
  assert.doesNotMatch(r, /intervalo de confianza del|banda/i);
});

test('estado y sexo se resuelven contra la vista', async () => {
  const r = await kb.answer('obesidad en cdmx mujeres');
  assert.match(r, /Ciudad de México · Mujeres/);
  const r2 = await kb.answer('cuantos casos de obesidad en nuevo leon hombres');
  assert.match(r2, /Nuevo León · Hombres/);
});

test('ranking fuera de muestra por estado', async () => {
  const r = await kb.answer('que estados tienen mejor precision en obesidad');
  assert.match(r, /desempeño fuera de muestra por estado/);
  assert.match(r, /Más precisos/);
  assert.match(r, /Menos precisos/);
});

test('Obesidad ya no se responde como padecimiento no modelado', async () => {
  const r = await kb.answer('casos de obesidad en jalisco');
  assert.doesNotMatch(r, /no modela/);
  const otro = await kb.answer('casos de asma en jalisco');
  assert.match(otro, /no modela asma/);
  assert.match(otro, /Obesidad\*\* \(CIE-10: E66\)/);
});
