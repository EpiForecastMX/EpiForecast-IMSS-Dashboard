/**
 * test_runner_gate.mjs — 47.2-B3: el gate de handlers del runner oficial es REAL.
 *
 * Lo que protege: que `npm test` no vuelva a dar verde con la respuesta correcta saliendo del
 * handler equivocado. Antes de B3, `run_tests.js` sólo miraba el texto; un caso podía declarar
 * `answerPronostico`, responder por `answerPadecimiento` y pasar igual — así vivieron 65
 * discrepancias bajo una suite verde. Aquí se ejecuta el runner de verdad, sobre fixtures
 * fabricados en un temporal (el oficial NUNCA se toca), y se exige que las mutaciones lo pongan
 * en rojo.
 *
 * Uso: node --test tests/test_runner_gate.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { fileURLToPath } from 'url';

const RUNNER = fileURLToPath(new URL('./run_tests.js', import.meta.url));

/** Caso real: la respuesta contiene "Depresion" y "casos" salga por donde salga. */
const CASO = {
  id: 1,
  query: 'pronostico de depresion',
  expectedHandler: 'answerPronostico',
  mustContain: ['Depresion', 'casos'],
  mustNotContain: [],
  checkEntities: {},
};

/** Ejecuta el runner oficial contra un fixture propio. → {code, salida} */
function correr(casos) {
  const dir = mkdtempSync(join(tmpdir(), 'epibot-gate-'));
  const ruta = join(dir, 'fixture.json');
  writeFileSync(ruta, JSON.stringify(casos));
  try {
    const salida = execFileSync('node', [RUNNER, ruta], { encoding: 'utf-8' });
    return { code: 0, salida };
  } catch (err) {
    return { code: err.status ?? 1, salida: `${err.stdout || ''}${err.stderr || ''}` };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('control positivo: el caso bien declarado pasa', () => {
  const { code, salida } = correr([CASO]);
  assert.equal(code, 0, salida);
  assert.match(salida, /PASS: 1 \| FAIL: 0/);
});

test('respuesta compatible + handler equivocado = rc distinto de cero', () => {
  // El texto sigue conteniendo "Depresion" y "casos": sólo miente el nombre del handler.
  const { code, salida } = correr([{ ...CASO, expectedHandler: 'answerPadecimiento' }]);
  assert.notEqual(code, 0, 'el runner debe rechazar el handler equivocado');
  assert.match(salida, /HANDLER: expected "answerPadecimiento", got "answerPronostico"/);
});

test('declarar null una consulta que sí responde = rc distinto de cero', () => {
  const { code, salida } = correr([{ ...CASO, expectedHandler: null, mustContain: [] }]);
  assert.notEqual(code, 0);
  assert.match(salida, /HANDLER: expected null/);
});

test('el comodín no exige nombre pero conserva las demás aserciones', () => {
  assert.equal(correr([{ ...CASO, expectedHandler: '*' }]).code, 0);
  const roto = correr([{ ...CASO, expectedHandler: '*', mustContain: ['Parkinson'] }]);
  assert.notEqual(roto.code, 0, 'el comodín no puede desactivar mustContain');
  assert.match(roto.salida, /MUST_CONTAIN/);
});

test('una cesión al RAG declarada como handler concreto = rc distinto de cero', () => {
  // 'metodologia del paper' cede: respuesta null y handler null. Declararle dueño debe fallar.
  const { code, salida } = correr([{
    ...CASO, query: 'metodologia del paper', expectedHandler: 'answerProyectoMeta', mustContain: [],
  }]);
  assert.notEqual(code, 0);
  assert.match(salida, /HANDLER: expected "answerProyectoMeta", got "null"/);
});
