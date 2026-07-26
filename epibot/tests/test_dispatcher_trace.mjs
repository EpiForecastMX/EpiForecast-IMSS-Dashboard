/**
 * test_dispatcher_trace.mjs — 47.2-A.1: la traza del handler es correcta y completa.
 *
 * Lo que protege: que NINGUNA ruta capaz de producir respuesta quede sin dueño. La primera versión
 * dejaba en `null` los follow-ups de distribución, porque llaman al handler directamente en vez de
 * pasar por `runHandlers`. Un `handler=null` con respuesta no nula es siempre un fallo de traza.
 *
 * Uso: node --test tests/test_dispatcher_trace.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';

const kraw = readFileSync(new URL('../knowledge.json', import.meta.url), 'utf-8');
globalThis.fetch = async () => ({ ok: true, json: async () => JSON.parse(kraw) });
Math.random = () => 0.42;   // RNG controlado: answerGraficoAleatorio deja de ser irreproducible
const { answer, answerWithTrace, loadKnowledge, _resetContext } = await import('../js/kb.js');
await loadKnowledge();

async function traza(query, setup = null) {
  _resetContext();
  if (setup) await answerWithTrace(setup);
  return answerWithTrace(query);
}

test('answer() y answerWithTrace() salen del MISMO núcleo', async () => {
  for (const q of ['cuantos modelos hay', 'resultado del futbol', 'metodologia del paper']) {
    _resetContext();
    const solo = await answer(q);
    _resetContext();
    const { response } = await answerWithTrace(q);
    assert.equal(response, solo, `divergen para ${JSON.stringify(q)}`);
  }
});

test('toda respuesta no nula tiene handler; ningún null con respuesta', async () => {
  const casos = JSON.parse(readFileSync(new URL('./test_cases.json', import.meta.url), 'utf-8'));
  const huerfanos = [];
  for (const c of casos) {
    const { response, handler } = await traza(c.query, c.setupQuery);
    if (response !== null && handler === null) huerfanos.push(c.id);
    if (response === null && handler !== null) huerfanos.push(`${c.id}(inverso)`);
  }
  assert.deepEqual(huerfanos, [], 'respuestas sin dueño o handler sin respuesta');
});

test('el follow-up de distribución reporta answerDistribucion, no null', async () => {
  const { response, handler } = await traza('solo de la depresion', 'violin del smape');
  assert.ok(response, 'el follow-up debe responder');
  assert.equal(handler, 'answerDistribucion');
});

test('los guards previos a la cadena tienen identidad propia', async () => {
  assert.equal((await traza('resultado del futbol')).handler, 'answerFueraDeTema');
});

test('la cesión al RAG se reporta como handler nulo, no como un handler cualquiera', async () => {
  const { response, handler } = await traza('metodologia del paper');
  assert.equal(response, null);
  assert.equal(handler, null);
});

test('el handler observado es el REAL, no el esperado por el fixture', async () => {
  // G4: la precedencia corregida se demuestra por traza, no por mustContain.
  assert.equal((await traza('boxplot del smape')).handler, 'answerDistribucion');
  assert.equal((await traza('rango de smape')).handler, 'answerSmapeBox');
  assert.equal((await traza('tabla de metricas por padecimiento')).handler,
    'answerRendimientoPorPadecimiento');
});

test('con RNG fijo, dos resoluciones del handler aleatorio coinciden', async () => {
  const a = await traza('grafico aleatorio');
  const b = await traza('grafico aleatorio');
  assert.equal(a.response, b.response);
  assert.equal(a.handler, b.handler);
});
