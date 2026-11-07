/**
 * Detectores de padecimiento del EpiBot: entities.js, kb.js (_resolve) y rag.mjs.
 *
 * Regresiones halladas al probar el skill de padecimientos (5-nov-2026):
 * - «sobrepeso» dispara el handler de Obesidad pero no era alias en entities.js: el follow-up
 *   «y hombres?» heredaba el estado sin el padecimiento y respondía con datos neuro.
 * - Las listas de no modelados de _resolve comparaban por subcadena e incluían «demencia» (alias de
 *   Alzheimer): «y de demencia?» y «y obesidad?» («obesidad» contiene «sida») perdían el contexto.
 * - rag.mjs tenía su propio detector con solo los cuatro legacy: con estado y sin padecimiento,
 *   focusedFacts inyectaba series neuro de ese estado como «DATOS EXACTOS» para Gemini.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import vm from 'node:vm';

const K = readFileSync(new URL('../knowledge.json', import.meta.url), 'utf-8');
const V = readFileSync(new URL('../../publication/obesidad/vista.json', import.meta.url), 'utf-8');
globalThis.fetch = async (u) => ({
  ok: true,
  json: async () => JSON.parse(String(u).includes('publication/obesidad/vista.json') ? V : K),
});
const kb = await import('../js/kb.js');
const { detectEntities, ENFERMEDADES_NO_MODELADAS } = await import('../js/entities.js?v=34');
const KB = JSON.parse(K);
const d = await kb.loadKnowledge();
await d.obesidad_pendiente;

async function sigue(primera, segunda) {
  kb._resetContext();
  await kb.answerWithTrace(primera);
  const r = await kb.answerWithTrace(segunda);
  kb._resetContext();
  return { handler: r.handler, md: String(r.response ?? '') };
}

test('«sobrepeso» es alias de Obesidad en el detector de entidades', () => {
  assert.equal(detectEntities('sobrepeso en jalisco mujeres').padecimiento, 'Obesidad');
});

test('follow-up tras «sobrepeso en jalisco mujeres» sigue en Obesidad', async () => {
  const r = await sigue('sobrepeso en jalisco mujeres', 'y hombres?');
  assert.equal(r.handler, 'answerObesidad');
  assert.match(r.md, /Obesidad \(E66\) · Jalisco · Hombres/);
});

test('«y de demencia?» hereda el estado y responde Alzheimer, no «no modelado»', async () => {
  const r = await sigue('casos de depresion en jalisco', 'y de demencia?');
  assert.doesNotMatch(r.md, /no modela/);
  assert.match(r.md, /Alzheimer/);
  assert.match(r.md, /Jalisco/);
});

test('«y obesidad?» tras una consulta de Jalisco hereda el estado («obesidad» ⊃ «sida»)', async () => {
  const r = await sigue('casos de depresion en jalisco', 'y obesidad?');
  assert.equal(r.handler, 'answerObesidad');
  assert.match(r.md, /Obesidad \(E66\) · Jalisco/);
});

test('un no modelado en el follow-up sigue sin heredar contexto', async () => {
  const r = await sigue('casos de depresion en jalisco', 'y asma?');
  assert.match(r.md, /no modela asma/);
});

// ── rag.mjs: detectEntities + focusedFacts reales, sin red ─────────────────────────────────
const RAG = readFileSync(
  process.env.RAG_BASE || new URL('../netlify/functions/rag.mjs', import.meta.url), 'utf8');
const ini = RAG.indexOf('function stripAccents(');
const fin = RAG.indexOf('// Multi-turno');
const rag = vm.runInNewContext(
  `${readFileSync(new URL('../js/release_catalog.js', import.meta.url), 'utf8')}\n${RAG.slice(ini, fin)}\n({ detectEntities, focusedFacts })`, { console });
const NEURO = /Depresion|Parkinson|Alzheimer/;

test('rag.mjs reconoce Obesidad y sus alias', () => {
  for (const q of ['obesidad en jalisco', 'sobrepeso en jalisco', 'casos e66 jalisco', 'obesos en sonora']) {
    assert.equal(rag.detectEntities(q).padecimiento, 'Obesidad', q);
  }
});

test('rag.mjs no inyecta series neuro en una consulta de Obesidad por estado', () => {
  assert.doesNotMatch(rag.focusedFacts(KB, 'obesidad en jalisco mujeres'), NEURO);
  assert.doesNotMatch(rag.focusedFacts(KB, 'sobrepeso en jalisco'), NEURO);
});

test('rag.mjs no inyecta series neuro cuando se pregunta por un padecimiento no modelado', () => {
  assert.equal(rag.focusedFacts(KB, 'diabetes en jalisco'), '');
  assert.equal(rag.focusedFacts(KB, 'cancer en sonora mujeres'), '');
});

test('rag.mjs sigue dando los datos exactos neuro cuando se piden', () => {
  assert.match(rag.focusedFacts(KB, 'depresion en jalisco mujeres'), /Depresion · Jalisco/);
  assert.match(rag.focusedFacts(KB, 'demencia en jalisco'), /Alzheimer · Jalisco/);
});

test('la lista de no modelados de rag.mjs es la misma que la de entities.js', () => {
  const m = RAG.match(/const NO_MODELADAS = \[([\s\S]*?)\];/);
  assert.ok(m, 'rag.mjs declara NO_MODELADAS');
  // JSON: el arreglo del contexto vm es de otro realm y deepEqual estricto lo distingue.
  const lista = JSON.stringify(vm.runInNewContext(`[${m[1]}]`));
  assert.equal(lista, JSON.stringify(ENFERMEDADES_NO_MODELADAS));
});
