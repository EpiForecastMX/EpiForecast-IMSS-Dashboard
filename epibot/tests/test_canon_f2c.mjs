/**
 * Plan canónico del EpiBot, fase 1, fase 2, entrega C (26-nov-2026): 2.3 un solo formato de semana en el texto,
 * «semana 43 (25 al 31 de octubre de 2026)», sin fechas sueltas ni etiquetas ISO fuera del detalle plegado.
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
const resumen = JSON.parse(readFileSync(new URL('epibot/resumen_padecimientos.json', raiz), 'utf-8'));
const { semanaTxt, semanaDeEtiqueta, rangoSemana } = await import('../js/resumen_llano.js');
const llano = (t) => t.split('<!--DETALLE-->')[0].replace(/<!--[\s\S]*?-->/g, '');
const ISO = /semana del \d{4}-\d{2}-\d{2}|\b20\d\d-W\d\d\b|\b20\d\d-\d\d-\d\d\b|semana del \d{1,2} de [a-z]+|la del \d{1,2} de [a-z]+/i;

test('2.3 semanaTxt: semana epidemiológica de domingo a sábado con su rango, también entre meses y años', () => {
  assert.equal(semanaTxt('2026-10-26'), 'semana 43 (25 al 31 de octubre de 2026)');
  assert.equal(semanaTxt('2026-10-25'), 'semana 43 (25 al 31 de octubre de 2026)', 'el domingo de los originales cae en la misma semana');
  assert.equal(semanaTxt('2026-11-30'), 'semana 48 (29 de noviembre al 5 de diciembre de 2026)');
  assert.equal(semanaTxt('2026-12-28'), 'semana 52 de 2026 (27 de diciembre de 2026 al 2 de enero de 2027)');
  assert.equal(semanaTxt('2027-01-04'), 'semana 1 (3 al 9 de enero de 2027)');
  assert.equal(semanaDeEtiqueta('2026-W42'), 'semana 42 (18 al 24 de octubre de 2026)');
  assert.equal(semanaDeEtiqueta('otra'), 'otra');
  assert.equal(rangoSemana('2026-10-25', '2026-10-31'), '25 al 31 de octubre de 2026');
});

// La cronología del catálogo publicado (release_catalog.js) conserva su texto: no se edita a mano.
test('2.3 las respuestas de la mesa no traen fechas sueltas ni etiquetas ISO fuera del detalle plegado', async () => {
  for (const q of ['¿hay mucho dengue en Veracruz?', '¿qué enfermedades van al alza?', 'varicela en Jalisco mujeres', '¿y en Monterrey?',
    '¿qué tan confiable es el pronóstico de asma?', '¿cuántos casos de asma se pronostican en 52 semanas?', 'resumen nacional de la semana',
    '¿qué estados tendrán más casos de dengue el próximo mes?', 'dame un grafico de asma',
    '¿Cuántas semanas de validación prospectiva lleva el pronóstico de otitis?']) {
    assert.doesNotMatch(llano(await pide(q)), ISO, q);
  }
  assert.match(await pide('¿qué tan confiable es el pronóstico de asma?'), /De ellas, la semana 42 \(18 al 24 de octubre de 2026\) ya era pública al emitir/);
  assert.match(await pide('¿qué estados tendrán más casos de dengue el próximo mes?'), /\*\*, desde la semana 45 \(/);
});
