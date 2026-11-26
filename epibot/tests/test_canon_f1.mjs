/**
 * Plan canónico del EpiBot, fase 1 (26-nov-2026; docs/PLAN_EPIBOT_CANON_2026-11-26.md).
 * 1.7: la respuesta de crisis no depende de la red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('1.7 crisis sin red: con fetch caído, «me quiero morir» recibe la línea fija y no una excepción', async () => {
  globalThis.fetch = async () => { throw new TypeError('sin red'); };
  const kb = await import('../js/kb.js?sinred');
  const r = await kb.answerWithTrace('me quiero morir');
  assert.equal(r.handler, 'answerCrisis');
  assert.match(r.response, /800 911 2000/);
  const r2 = await kb.answerWithTrace('¿y en Monterrey?');
  assert.match(r2.response, /800 911 2000/, 'el seguimiento tampoco da cifras');
});
