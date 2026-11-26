/**
 * Plan canónico del EpiBot, fase 1, entrega B (26-nov-2026; docs/PLAN_EPIBOT_CANON_2026-11-26.md):
 * 1.1 primera línea = la pregunta; 1.2 dengue por estados y periodo, sin atribuir El Niño al motor nacional;
 * 1.4 año anterior por semana epidemiológica; 1.6 consejo médico y viaje con ruta fija.
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
const pide = async (q) => { kb._resetContext?.(); const r = await kb.answerWithTrace(q); return { ...r, t: String(r.response || '') }; };
const primera = (t) => t.replace(/<!--[\s\S]*?-->/g, '').split('\n').map((l) => l.trim()).filter(Boolean)[0] || '';

test('1.1 la primera línea contesta: validación, sMAPE, pico de un no modelado; sin «Sí.» en preguntas abiertas ni con controles', async () => {
  assert.match(primera((await pide('¿la varicela está validada?')).t), /^\*\*¿Está validado\?\*\* No\. Varicela se publica como \*\*control estacional\*\*/);
  assert.match(primera((await pide('¿cuál es el sMAPE de hipertensión fuera de muestra?')).t), /^\*\*Error fuera de muestra \(sMAPE\):\*\* 1\.9 % en 2 semanas/);
  assert.match(primera((await pide('¿está validado el pronóstico de asma?')).t), /^\*\*¿Está validado\?\*\* Todavía no del todo.*2026-W42 ya era pública al emitir/);
  assert.match(primera((await pide('¿cuál es el pico esperado de influenza?')).t), /^\*\*No hay pronóstico ni pico esperado para Influenza:\*\*/);
  for (const q of ['¿dónde sube más rápido la hepatitis A?', '¿la leptospirosis va a subir?']) {
    assert.doesNotMatch(primera((await pide(q)).t), /^(Sí|No)\. /, q);
  }
});

test('1.2 dengue: «qué estados… próximo mes» da el ranking a 4 semanas; el pronóstico anual no dice que el motor nacional usa El Niño', async () => {
  const r = await pide('¿qué estados tendrán más casos de dengue el próximo mes?');
  assert.match(primera(r.t), /^\*\*Estados con más casos de dengue esperados en las próximas 4 semanas\*\*/);
  assert.match(r.t, /- \*\*Sinaloa\*\*: unos 3,483 casos/);
  assert.doesNotMatch(r.t, /52 semanas/);
  assert.match(r.t, /no suman lo mismo/, 'avisa que estados y nacional son modelos distintos');
  const anual = await pide('pronóstico de dengue para el próximo año');
  assert.match(anual.t, /\*\*En las 52 semanas del pronóstico\*\*.*\*\*8,811 casos\*\*/, 'horizonte posterior al corte, igual al publicado');
  const kbSrc = readFileSync(new URL('../js/kb.js', import.meta.url), 'utf-8');
  assert.doesNotMatch(kbSrc, /por eso el modelo usa esa señal del clima/);
});

test('1.4 el año anterior se compara por semana epidemiológica homóloga (2025 tuvo 53 semanas)', async () => {
  assert.match((await pide('q onda con la azucar en puebla')).t, /1,425 casos en las semanas 40 a 43 de 2026, 9 % más que en las mismas semanas de 2025 \(1,302\)/);
  assert.match((await pide('obesidad en el país')).t, /718,581 casos, 24 % más que a la misma fecha de 2025/);
  const { semanaEpi } = await import('../js/resumen_llano.js');
  assert.deepEqual(semanaEpi('2026-10-26'), [2026, 43]);
  assert.deepEqual(semanaEpi('2025-12-29'), [2025, 53]);
  assert.deepEqual(semanaEpi('2026-01-04'), [2026, 1]);
});

test('1.6 consejo médico con ruta fija, sin cifras ni Línea de la Vida; viaje sin valorar la seguridad; la crisis intacta', async () => {
  for (const q of ['puedo tomar paracetamol si tengo dengue', '¿el dengue mata?', '¿debo vacunarme contra la influenza?', 'embarazada con dengue qué hago', 'que tomo para el dengue', 'que le doy a mi hijo para la varicela']) {
    const r = await pide(q);
    assert.equal(r.handler, 'answerConsejoMedico', q);
    assert.match(primera(r.t), /^\*\*No (doy consejo médico|valoro la gravedad)/, q);
    assert.match(r.t, /\*\*911\*\*/, q);
    assert.doesNotMatch(r.t, /800 911 2000/, q);
    assert.doesNotMatch(r.t.replace(/911/g, ''), /\d{2,}/, `${q}: sin cifras`);
  }
  assert.notEqual((await pide('cuantos casos de ESAVI hay')).handler, 'answerConsejoMedico', 'una pregunta de datos sobre vacunación no es consejo');
  assert.match(primera((await pide('¿es seguro viajar a Cancún por el dengue?')).t), /^_No digo si es seguro viajar ni doy fechas para ir/);
  for (const q of ['me quiero morir', 'me tome todas las pastillas']) assert.equal((await pide(q)).handler, 'answerCrisis', q);
});
