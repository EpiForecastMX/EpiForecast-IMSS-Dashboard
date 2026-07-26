/**
 * test_entities.mjs — 47.2-B1: los meses se detectan como token completo (R56-P0).
 *
 * Lo que protege: `extractMonths` usaba `includes()`, asi que "genero" contenia "enero" y
 * "mayor" contenia "mayo". Toda pregunta de genero arrastraba una estimacion mensual de enero,
 * y "estados con mayor incidencia" quedaba marcada como consulta de mayo. Las regresiones son
 * positivas Y negativas: si alguien vuelve a subcadena, los meses reales siguen pasando pero
 * los falsos vuelven — por eso ambas mitades son obligatorias.
 *
 * Uso: node --test tests/test_entities.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { detectEntities } from '../js/entities.js';

const meses = q => detectEntities(q)._months;

test('los meses reales se siguen detectando', () => {
  assert.deepEqual(meses('enero 2026'), [1]);
  assert.deepEqual(meses('depresion en enero 2026'), [1]);
  assert.deepEqual(meses('casos en mayo'), [5]);
  assert.deepEqual(meses('parkinson en diciembre'), [12]);
  assert.deepEqual(meses('entre enero y marzo'), [1, 3]);
});

test('las palabras que CONTIENEN un mes no son un mes', () => {
  for (const q of ['genero', 'generos', 'brecha de genero',
    'hay diferencia de genero en parkinson', 'brecha de genero en depresion',
    'estados con mayor incidencia de alzheimer', 'la mayoria de los casos']) {
    assert.deepEqual(meses(q), [], `${JSON.stringify(q)} no menciona ningun mes`);
  }
});

test('ningun caso del fixture detecta un mes que su consulta no nombra', () => {
  const casos = JSON.parse(readFileSync(new URL('./test_cases.json', import.meta.url), 'utf-8'));
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const espurios = casos.filter(c => {
    const detectados = meses(c.query);
    if (!detectados.length) return false;
    const tokens = new Set(c.query.toLowerCase().split(/[^a-z0-9]+/));
    return detectados.some(m => !tokens.has(MESES[m - 1]));
  }).map(c => c.id);
  assert.deepEqual(espurios, [], 'meses detectados sin que la consulta los nombre');
});

test('las preguntas de genero no reciben una estimacion mensual (ids 337/338)', async () => {
  const kraw = readFileSync(new URL('../knowledge.json', import.meta.url), 'utf-8');
  globalThis.fetch = async () => ({ ok: true, json: async () => JSON.parse(kraw) });
  Math.random = () => 0.42;
  const { answer, loadKnowledge, _resetContext } = await import('../js/kb.js');
  await loadKnowledge();
  for (const q of ['hay diferencia de genero en parkinson', 'brecha de genero en depresion']) {
    _resetContext();
    const r = await answer(q);
    assert.ok(r, `${q} debe responder`);
    assert.ok(!/enero/i.test(r), `${q} no puede estimar enero: ${JSON.stringify(r)}`);
  }
});
