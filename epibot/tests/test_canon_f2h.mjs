/**
 * Plan canónico del EpiBot, 2.2 para los originales (26-nov-2026): una pregunta por el error o la confiabilidad de dengue,
 * depresión, Parkinson o Alzheimer lleva el zoom de seguimiento (observado frente al pronóstico desde el corte, de 13 semanas
 * antes del corte a 7 después de la última observada), de la misma serie que el texto.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'fs';

const raiz = new URL('../../', import.meta.url);
globalThis.fetch = async (u) => {
  const s = String(u?.url ?? u);
  const m = s.match(/(publication\/[a-z0-9_]+\/vista\.json|assets\/boletin\/[^?]+\.json)/);
  const local = s.match(/(knowledge|zoom_series|resumen_padecimientos|comparacion_rondas)\.json/);
  const rel = m ? m[1] : (local ? `epibot/${local[1]}.json` : null);
  if (!rel || !existsSync(new URL(rel, raiz))) return { ok: false, json: async () => null };
  return { ok: true, json: async () => JSON.parse(readFileSync(new URL(rel, raiz), 'utf-8')) };
};
Math.random = () => 0.42;
const kb = await import('../js/kb.js');
await kb.loadKnowledge();
const pide = async (q) => { kb._resetContext?.(); const r = await kb.answerWithTrace(q); return String(r.response || ''); };
const zoom = JSON.parse(readFileSync(new URL('../zoom_series.json', import.meta.url), 'utf-8'));
const { PREGUNTA_ERROR } = await import('../js/obesidad_kb.js');
const { PREGUNTA_ERROR_LEGACY } = await import('../js/conversacion.js');
const { fechaEpiLegacy } = await import('../js/calculo/series.js');

const app = readFileSync(new URL('../js/app.js', import.meta.url), 'utf-8');
const fuente = (re) => app.match(re)[0].replace(/^export /, '');
const vm = await import('node:vm');
const ctx = vm.createContext({ norm: (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(),
  dn: (t) => t, fechaEpiLegacy, UNCERTAINTY_LABEL: 'pronóstico puntual, sin intervalo' });
vm.runInContext(`${fuente(/export function ventanaSeguimiento\(s\) \{[\s\S]*?\n\}\n/)}
${fuente(/function buildSeriesZoom\(s0, pad, estado, sexo, ventana = null\) \{[\s\S]*?\n\}\n/)}
globalThis.ventana = ventanaSeguimiento; globalThis.zoomSerie = buildSeriesZoom;`, ctx);

const marca = (t) => { const m = t.match(/<!--ZOOM_SEGUIMIENTO:(\{.*?\})-->/); return m && JSON.parse(m[1]); };

test('la expresión de preguntas de error es la misma en los releases y en los originales', () => {
  assert.equal(PREGUNTA_ERROR_LEGACY.source, PREGUNTA_ERROR.source);
});

test('preguntas de error de los cuatro originales llevan el marcador de la serie del texto; las de casos, no', async () => {
  const casos = [
    ['¿qué tan confiable es el pronóstico de dengue en Veracruz?', 'dengue|veracruz|general'],
    ['¿cuál es el error del pronóstico de depresión?', 'depresion|nacional|general'],
    ['error de parkinson en mujeres', 'parkinson|nacional|mujeres'],
    ['¿qué tan bien le fue al pronóstico de alzheimer en Jalisco?', 'alzheimer|jalisco|general'],
  ];
  for (const [q, clave] of casos) {
    const m = marca(await pide(q));
    assert.ok(m, q);
    assert.equal(m.clave, clave, q);
    assert.ok(zoom[clave], `${clave} existe en zoom_series`);
  }
  assert.equal(marca(await pide('dengue en Veracruz')), null);
  assert.equal(marca(await pide('¿cuántos casos de depresión se esperan?')), null);
});

test('la gráfica de seguimiento recorta a 13 semanas antes del corte y 7 después de la última observada', () => {
  const s = zoom['dengue|veracruz|general'];
  const v = ctx.ventana(s);
  const i0 = s.d.findIndex((d) => d > s.ds_corte);
  const ultima = s.r.reduce((a, x, i) => (x != null ? i : a), -1);
  assert.equal(v.d[0], s.d[Math.max(0, i0 - 13)]);
  assert.equal(v.d.at(-1), s.d[Math.min(s.d.length - 1, Math.max(ultima, i0) + 7)]);
  for (const k of ['r', 'y']) assert.equal(v[k].length, v.d.length);
  const g = ctx.zoomSerie(s, 'Dengue', 'Veracruz', 'general', 'seguimiento');
  assert.equal(g.labels.length, v.d.length);
  assert.match(g.title, /zoom semanal: observado frente al pronóstico/);
  const obs = g.datasets.find((d) => /^Observado/.test(d.label)).data;
  assert.ok(obs.some((x) => x != null), 'hay semanas observadas en la ventana');
  const pron = g.datasets.find((d) => /^Pronóstico desde el corte/.test(d.label)).data;
  assert.equal(pron.slice(0, 13).filter((x) => x != null).length, 0, 'antes del corte no se dibuja el ajuste');
  // Sin ventana, la serie completa de siempre.
  assert.equal(ctx.zoomSerie(s, 'Dengue', 'Veracruz', 'general').labels.length, s.d.length);
});

test('app.js usa el marcador antes de la regla de dengue y lo quita del texto visible', () => {
  const i = app.indexOf("markdown.match(/<!--ZOOM_SEGUIMIENTO:(.*?)-->/)");
  assert.ok(i > 0 && i < app.indexOf("detectEntities(query).padecimiento === 'Dengue' && !qn.includes('zoom')"));
  assert.match(app, /\.replace\(\/<!--ZOOM_SEGUIMIENTO:\.\*\?-->\/g, ''\)/);
});
