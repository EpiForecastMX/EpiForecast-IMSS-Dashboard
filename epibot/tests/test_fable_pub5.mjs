/**
 * Revisión focal de Fable de la publicación de los cinco controles (FABLE_CONTROLES5_PUBLICACION_REVISION.json,
 * sha256 542dedbb…, decisión delegada; no firma humana). Correcciones de este archivo (M3 y B3 los cubre
 * otro ejecutor con sus propias pruebas):
 *   A1  D7 («no distingue intención») en la respuesta determinista, el estado de la función RAG y el corpus de
 *       plaguicidas (T60) y monóxido (T58), no sólo en la ficha.
 *   M1  tos ferina: «salto de 2025 (1,600 casos frente a 461 en 2024)», nunca «brote de 2025».
 *   M2  la nota de pico heredado no dice «causa no establecida» cuando la propia fuente retiró ese valor.
 *   B2  las fichas de los controles no anuncian «el estado de la validación».
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';

const K = readFileSync(new URL('../knowledge.json', import.meta.url), 'utf-8');
const vista = (u) => String(u).match(/publication\/([a-z0-9_]+)\/vista\.json/);
globalThis.fetch = async (u) => ({
  ok: true,
  json: async () => JSON.parse(vista(u)
    ? readFileSync(new URL(`../../publication/${vista(u)[1]}/vista.json`, import.meta.url), 'utf-8') : K),
});
const kb = await import('../js/kb.js');
const d = await kb.loadKnowledge();
await d.obesidad_pendiente;
const rag = await import('../netlify/functions/rag.mjs');

async function pregunta(q) {
  kb._resetContext();
  const r = await kb.answerWithTrace(q);
  kb._resetContext();
  return { handler: r.handler, md: String(r.response ?? '') };
}
async function postRag(query) {
  const res = await rag.default(new Request('http://x/.netlify/functions/rag', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query }),
  }));
  return { status: res.status, body: await res.json() };
}
const leer = (id) => readFileSync(new URL(`../../${id}.html`, import.meta.url), 'utf-8');
const D7 = /no distingue intención/i;
const LINEA = /800 911 2000/;
const CINCO = ['coqueluchoide_u99', 'plaguicidas_t60', 'tos_ferina_a37', 'sindrome_meningeo_g00', 'monoxido_t58'];

test('A1: la respuesta determinista de plaguicidas y monóxido dice que la serie no distingue intención', async () => {
  for (const q of ['plaguicidas nacional', 'intoxicación por plaguicidas en México', 'monóxido de carbono nacional',
    'intoxicación por monóxido de carbono en Jalisco']) {
    const { md } = await pregunta(q);
    assert.match(md, D7, q);
    assert.match(md, LINEA, q);
  }
});

test('A1: el estado de la función RAG de plaguicidas y monóxido lleva D7', async () => {
  for (const q of ['¿está validada la intoxicación por plaguicidas?', '¿es confiable la intoxicación por monóxido de carbono?']) {
    const { body } = await postRag(q);
    assert.match(body.answer, D7, q);
    assert.match(body.answer, LINEA, q);
  }
});

test('A1: el fragmento de avisos del corpus de plaguicidas y monóxido lleva D7; los otros tres no', async () => {
  const { buildChunks } = await import('../scripts/lib/corpus.mjs');
  const { chunks } = buildChunks({});
  for (const id of CINCO) {
    const c = chunks.find((x) => x.id.startsWith(`release:${id}:`) && x.id.endsWith(':avisos-fuente'));
    assert.ok(c, id);
    if (['plaguicidas_t60', 'monoxido_t58'].includes(id)) {
      assert.match(c.text, D7, id);
      assert.match(c.text, LINEA, id);
    } else assert.doesNotMatch(c.text, D7, id);
  }
});

test('A1: la ficha no repite D7 (ya lo dice su nota de alcance una sola vez)', () => {
  for (const id of ['plaguicidas_t60', 'monoxido_t58']) {
    assert.equal(leer(id).match(/No distingue intención\./g)?.length, 1, id);
  }
});

test('M1: tos ferina nombra el salto medido de 2025 y nunca un «brote de 2025»', () => {
  const s = leer('tos_ferina_a37');
  assert.doesNotMatch(s, /brote de 2025/);
  assert.match(s, /no anticipó el salto de 2025 \(1,600 casos frente a 461 en 2024\) y no anticipa brotes; los valores bajos del horizonte no significan que no se espere uno/);
});

test('M2: el pico de plaguicidas no dice «causa no establecida» junto al retiro y nombra la misma entidad', () => {
  const s = leer('plaguicidas_t60');
  const pico = s.match(/<p class="pico-heredado" data-pico="México\|2026-W16">[^\n]*<\/p>/)?.[0];
  assert.ok(pico);
  assert.doesNotMatch(pico, /su causa no está establecida/);
  assert.match(pico, /la fuente retiró después 57 de los 60 \(ver el aviso siguiente\)/);
  assert.match(pico, /60 casos del Estado de México/);
  assert.doesNotMatch(pico, /casos de México\b/);
});

test('B2: las fichas de los cinco controles no anuncian el estado de «la validación»', () => {
  for (const id of CINCO) assert.doesNotMatch(leer(id), /Cargando el estado de la validación/, id);
});
