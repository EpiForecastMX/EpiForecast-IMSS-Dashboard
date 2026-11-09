// Tercera auditoría (9-nov-2026), A3: un pico aislado impreso en la fuente que el pronóstico repite
// se contextualiza en la página y en el corpus, sin tocar el dato ni el release.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { resolve } from 'path';

import { buildChunks } from '../scripts/lib/corpus.mjs';
import { arrastre, htmlPico, picosHeredados, semanaDe } from '../scripts/lib/picos_heredados.mjs';
import { paginaEsperada, revisa } from '../scripts/picos_heredados.mjs';

const ROOT = resolve(import.meta.dirname, '..', '..');
const vista = (id) => JSON.parse(readFileSync(resolve(ROOT, 'publication', id, 'vista.json'), 'utf-8'));

test('la semana MMWR sale del ds de la vista (lunes de un periodo que empieza en domingo)', () => {
  assert.deepEqual(semanaDe('2025-10-20'), [2025, 43]);
  assert.deepEqual(semanaDe('2026-10-19'), [2026, 42]);
  assert.deepEqual(semanaDe('2026-01-05'), [2026, 1]);
  assert.deepEqual(semanaDe('2027-01-04'), [2027, 1]);
});

test('Hodgkin: el pico de Morelos de 2025-W43 se repite en 2026-W42', () => {
  const [p, ...resto] = picosHeredados(vista('linfoma_hodgkin_c81'));
  assert.equal(resto.length, 0);
  assert.equal(p.estado, 'Morelos');
  assert.deepEqual(p.semanaObservada, [2025, 43]);
  assert.deepEqual(p.semanaPronosticada, [2026, 42]);
  assert.equal(p.observado, 213);
  assert.equal(p.pronosticado, 213);
  assert.equal(p.nacional, 227);
  assert.equal(p.medianaNacional, 17.5);
  assert.ok(Math.abs(p.participacion - 93.83) < 0.01 && Math.abs(p.veces - 12.97) < 0.01);
});

test('sólo seis releases publicados heredan un pico aislado de su fuente', () => {
  const { resumen } = revisa(ROOT);
  const con = Object.entries(resumen).filter(([, n]) => n).map(([id]) => id).sort();
  assert.deepEqual(con, [
    'cancer_ovario_c56', 'cancer_pancreas_c26', 'cancer_prostata_c61', 'cancer_pulmon_c33',
    'cerebrovascular_i60', 'linfoma_hodgkin_c81',
  ]);
});

const sintetica = (obs, pron) => ({
  series: {
    'nacional|mx|general': { pronostico: pron.map(([ds, y]) => [ds, y + 10]) },
    'estado|01|general': { nivel: 'estado', sexo: 'general', nombre: 'A', observado: obs, pronostico: pron },
  },
});
const semanas = (desde, ys) => ys.map((y, i) => [new Date(Date.parse(`${desde}T00:00:00Z`) + i * 7 * 864e5).toISOString().slice(0, 10), y]);

test('no se marca un pico sin volumen, con vecinas altas o que el pronóstico no repite', () => {
  // El pico observado en 2025-10-20 cae 364 días antes del primer pronóstico (2026-10-19).
  const pron = semanas('2026-10-19', [200, 2, 2]);
  assert.equal(picosHeredados(sintetica(semanas('2025-10-13', [2, 200, 2, 2]), pron)).length, 1, 'pico');
  assert.equal(picosHeredados(sintetica(semanas('2025-10-13', [0, 40, 0, 0]), pron)).length, 0, 'volumen');
  assert.equal(picosHeredados(sintetica(semanas('2025-10-13', [2, 60, 40, 2]), pron)).length, 0, 'vecinas altas');
  const bajo = semanas('2026-10-19', [3, 2, 2]);
  assert.equal(picosHeredados(sintetica(semanas('2025-10-13', [2, 200, 2, 2]), bajo)).length, 0, 'no heredado');
});

test('cada página publicada lleva exactamente la nota que su vista exige', () => {
  assert.deepEqual(revisa(ROOT).errores, []);
  const hodgkin = readFileSync(resolve(ROOT, 'linfoma_hodgkin_c81.html'), 'utf-8');
  assert.match(hodgkin, /data-pico="Morelos\|2025-W43"/);
  assert.match(hodgkin, /213 casos de Morelos: 93\.8 % de los 227 nacionales/);
  assert.doesNotMatch(hodgkin, /errata/i);
  assert.doesNotMatch(readFileSync(resolve(ROOT, 'obesidad.html'), 'utf-8'), /pico-heredado/);
});

test('la nota se reescribe sin duplicarse y una nota rancia se sustituye', () => {
  const html = readFileSync(resolve(ROOT, 'linfoma_hodgkin_c81.html'), 'utf-8');
  const picos = picosHeredados(vista('linfoma_hodgkin_c81'));
  assert.equal(paginaEsperada(html, picos), html);
  const rancia = html.replace(htmlPico(picos[0]), htmlPico({ ...picos[0], observado: 999 }));
  assert.notEqual(rancia, html);
  assert.equal(paginaEsperada(rancia, picos), html);
  assert.equal((paginaEsperada(html, picos).match(/pico-heredado/g) || []).length, 1);
  assert.doesNotMatch(paginaEsperada(html, []), /pico-heredado/);
});

test('el corpus contextualiza el pico en las tarjetas nacional y estatal', () => {
  const { chunks } = buildChunks({});
  const de = (id, sufijo) => chunks.find((c) => c.id.startsWith(`release:${id}:`) && c.id.endsWith(`:${sufijo}`));
  for (const s of ['nacional', 'estados']) {
    const c = de('linfoma_hodgkin_c81', s);
    assert.match(c.text, /Pico heredado de la fuente: En la semana epidemiológica 2025-W43 el boletín imprimió 213 casos de Morelos/);
    assert.match(c.text, /no debe leerse como un aumento esperado/);
  }
  assert.match(de('cerebrovascular_i60', 'nacional').text, /1,150 casos de Hidalgo/);
  assert.doesNotMatch(de('obesidad', 'nacional').text, /Pico heredado/);
});

test('la explicación del arrastre sale del motor de la serie (cuarta auditoría, B3)', () => {
  const [h] = picosHeredados(vista('linfoma_hodgkin_c81'));
  assert.deepEqual(h.motores, ['seasonal_naive_lag52']);
  assert.match(arrastre(h), /repite lo observado 52 semanas antes \(2025 tuvo 53 semanas epidemiológicas, por eso 2025-W43 cae en 2026-W42\)/);
  const [pa] = picosHeredados(vista('cancer_pancreas_c26'));
  assert.deepEqual(pa.motores, ['seasonal_mean_2y']);
  assert.match(arrastre(pa), /^La media estacional de dos años, el motor de esa serie, promedia la misma semana epidemiológica/);
  const [pu] = picosHeredados(vista('cancer_pulmon_c33'));
  assert.doesNotMatch(arrastre(pu), /53 semanas/, 'sin año de 53 semanas no hay corrimiento');
  assert.match(arrastre({ ...h, motores: ['seasonal_mean_2y', 'seasonal_naive_lag52'] }), /repiten o promedian/);
  const hodgkin = readFileSync(resolve(ROOT, 'linfoma_hodgkin_c81.html'), 'utf-8');
  assert.doesNotMatch(hodgkin, /misma semana de años anteriores/);
});
