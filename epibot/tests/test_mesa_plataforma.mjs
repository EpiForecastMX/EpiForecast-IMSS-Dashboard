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

test('«¿qué enfermedades van al alza?» trae pequeños múltiplos (plan canónico 1.3): mini serie por padecimiento, controles en gris', async () => {
  const src = app.match(/export function graficaAlza\(g\) \{[\s\S]*?\n\}\n/)[0].replace('export ', '');
  const ctx = vm.createContext({});
  vm.runInContext(`${src}; globalThis.graficaAlza = graficaAlza;`, ctx);
  const serie = { ini: '2026-08-10', o: [10, 12, 11, 13, 12, 14, 13, 15, 14, 16, 15, 17], f: [18, 19, 20, 21] };
  const g = ctx.graficaAlza({ modo: 'cambio', filas: [
    { n: 'Asma', o: 10545, f: 12854, d: 0.22, c: 'media', control: false, serie },
    { n: 'Shigelosis', o: 139, f: 77, d: -0.45, c: 'media', control: false, serie },
    { n: 'Varicela', o: 3896, f: 4594, d: 0.18, c: 'baja', control: true, serie },
  ] });
  assert.equal(g.type, 'multiples');
  assert.equal(g.items.length, 3);
  assert.deepEqual(g.items.map((x) => x.color), ['#b4541e', '#17644d', '#6b6f73']);
  assert.equal(g.items[0].labels.length, 16);
  assert.equal(g.items[0].labels[12], '2026-11-02');
  assert.equal(g.items[0].pron[11], 17, 'el pronóstico arranca en el último observado');
  assert.match(g.items[0].sub, /^10,545 → 12,854 en 4 semanas \(\+22 %\)$/);
  assert.match(g.items[2].sub, /control, no validado$/);
  assert.equal(ctx.graficaAlza({ filas: [] }), null);
  assert.match(app, /if \(chartData && chartData\.type === 'multiples'\) \{ renderMultiples\(canvas, chartData\); return; \}/);
  assert.match(app, /\.replace\(\/<!--ALZA:\.\*\?-->\/g, ''\)/, 'la marca no se ve en el texto');
});
