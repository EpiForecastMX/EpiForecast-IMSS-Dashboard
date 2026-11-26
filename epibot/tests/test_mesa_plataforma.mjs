/**
 * Mesa de la plataforma (25-nov-2026; acta en planes/mesa_plataforma_2026-11-25/), dictamen de Codex Astra.
 * - Si la biblioteca de Markdown (CDN) no carga, la respuesta se muestra igual y escapada, sin romper el chat.
 * - El dictado nunca borra ni envía lo que la persona ya había escrito.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import vm from 'node:vm';

const app = readFileSync(new URL('../js/app.js', import.meta.url), 'utf-8');

test('sin marked: Markdown mínimo, escapado y sin excepción; con marked, lo usa', () => {
  const src = app.match(/export function mdHtml\(md\) \{[\s\S]*?\n\}\n/)[0].replace('export ', '');
  const ctx = vm.createContext({});
  vm.runInContext(`${src}; globalThis.mdHtml = mdHtml;`, ctx);
  const html = ctx.mdHtml('**Varicela en Jalisco:** se espera que *aumente*.\n\n- Ahora: 249\n- Año: 3,653\n\n<script>alert(1)</script>');
  assert.equal(html, '<p><strong>Varicela en Jalisco:</strong> se espera que <em>aumente</em>.</p><ul><li>Ahora: 249</li><li>Año: 3,653</li></ul><p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
  ctx.marked = { parse: (md, o) => `M(${md},${o.breaks})` };
  assert.equal(ctx.mdHtml('x'), 'M(x,true)');
  assert.doesNotMatch(app, /\bmarked\.parse\(/, 'todas las llamadas pasan por mdHtml');
});

test('dictado: un error o un permiso negado conserva el borrador; el fin sin dictado no envía nada', async () => {
  let rec = null;
  globalThis.window = globalThis;
  globalThis.SpeechRecognition = class { constructor() { rec = this; } start() { this.onstart?.(); } stop() {} };
  const { initSTT } = await import('../js/voice.js');
  const escucha = {};
  const btn = { style: {}, title: '', classList: { add() {}, remove() {} }, setAttribute(k, v) { this[k] = v; }, addEventListener: (e, f) => { escucha[e] = f; } };
  const campo = { value: '', placeholder: 'Pregunta', addEventListener() {}, classList: { add() {}, remove() {} } };
  const enviados = [];
  initSTT(btn, campo, (t) => enviados.push(t));
  globalThis.speechSynthesis = undefined;

  campo.value = 'dengue en Veracruz';
  escucha.click();
  assert.equal(campo.value, 'dengue en Veracruz', 'pulsar el micrófono no borra el borrador');
  rec.onerror({ error: 'not-allowed' });
  assert.equal(campo.value, 'dengue en Veracruz');
  assert.equal(btn['aria-disabled'], 'true');
  rec.onend();
  assert.deepEqual(enviados, [], 'sin dictado no se envía el borrador');

  escucha.click();
  rec.onresult({ resultIndex: 0, results: Object.assign([Object.assign([{ transcript: 'asma en Jalisco', confidence: 0.9 }], { isFinal: true })], {}) });
  assert.deepEqual(enviados, ['asma en Jalisco']);
});
