/**
 * Verificación final de las categorías no modelables (`codex/REAUDITORIA3_FE_NOMOD.md`, APTO_CON_CORRECCIONES sobre
 * `2dce5d01`): la primera persona plural se detecta por regla general (todo token de cinco letras o más en «mos», salvo una
 * lista corta de palabras no verbales, NO_VERBALES_MOS), no por enumeración. «estaríamos», «tendríamos» y «vivimos» dan sólo
 * el apoyo con la Línea de la Vida en KB y RAG, igual que treinta formas verbales en distintos tiempos; las consultas con
 * «últimos», «próximos», «máximos» o «mínimos» no cambian.
 * Con 2dce5d01 fallan. Contrafactual: KB_MODULE=… RAG_MODULE=… node --test tests/test_nomod4_codex_b44.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'fs';

const raiz = new URL('../../', import.meta.url);
const leer = (rel) => readFileSync(new URL(rel, raiz), 'utf-8');
globalThis.fetch = async (u) => {
  const s = String(u?.url ?? u);
  const m = s.match(/(publication\/[a-z0-9_]+\/vista\.json|assets\/boletin\/[^?]+\.json)/);
  const rel = m ? m[1] : (s.includes('knowledge.json') ? 'epibot/knowledge.json' : null);
  if (!rel || !existsSync(new URL(rel, raiz))) throw new Error(`fetch inesperado: ${s}`);
  return { ok: true, json: async () => JSON.parse(leer(rel)) };
};
const desde = (env, def) => (process.env[env] ? new URL(process.env[env], `file://${process.cwd()}/`) : new URL(def, import.meta.url)).href;
const kb = await import(desde('KB_MODULE', '../js/kb.js'));
const d = await kb.loadKnowledge();
await d.obesidad_pendiente;
delete process.env.GEMINI_API_KEY;
const rag = (await import(desde('RAG_MODULE', '../netlify/functions/rag.mjs'))).default;
const C = globalThis.EPI_CATALOGO;

async function kbTurno(q) {
  kb._resetContext();
  const r = await kb.answerWithTrace(q);
  kb._resetContext();
  return { handler: r.handler, md: String(r.response ?? '') };
}
async function ragTurno(q) {
  const res = await rag(new Request('http://x/.netlify/functions/rag', { method: 'POST', body: JSON.stringify({ query: q, history: [] }) }));
  return String((await res.json()).answer ?? '');
}
const esApoyo = (t) => t.startsWith(C.APOYO_ES.replace('\n<!--SIN_GRAFICA-->', ''));

const CODEX = ['chagas en Jalisco, estaríamos preocupados', 'chagas en Jalisco, tendríamos problemas', 'chagas en Jalisco, vivimos lejos'];
test('casos de Codex: la primera persona plural sin riesgo ya no da el apoyo (KB y RAG)', async () => {
  // Rediseño conversacional (24-nov-2026, tests/politica_conversacional.mjs): una forma de primera persona plural sin
  // señal de riesgo ya no niega la respuesta; las de daño, sustancia o súplica siguen dando el apoyo.
  for (const q of CODEX) {
    const k = (await kbTurno(q)).md;
    assert.ok(!esApoyo(k), `KB ${q}: ${k.slice(0, 160)}`);
    const r = await ragTurno(q);
    assert.ok(!esApoyo(r), `RAG ${q}: ${r.slice(0, 160)}`);
  }
});

// Treinta formas de primera persona plural en distintos tiempos y modos, fuera de la tabla de conjugaciones.
const FORMAS = ['vivimos', 'estaríamos', 'tendríamos', 'comimos', 'bebimos', 'tomamos', 'tomaríamos', 'tomábamos', 'tomaremos',
  'tomemos', 'tomáramos', 'tomásemos', 'subimos', 'caímos', 'sufrimos', 'sufriremos', 'sufríamos', 'corremos', 'corríamos',
  'llegamos', 'llegaremos', 'perdimos', 'lloramos', 'quemamos', 'cortamos', 'cortaríamos', 'saltamos', 'ingerimos',
  'pensamos', 'dormimos'];
test('propiedad: las formas en «-mos» de daño, sustancia o pérdida dan sólo el apoyo, en KB y RAG', async () => {
  assert.equal(FORMAS.length, 30);
  const fallos = [];
  const BENIGNAS = new Set(['vivimos', 'estaríamos', 'tendríamos', 'comimos', 'subimos', 'caímos', 'corremos', 'corríamos', 'llegamos',
    'llegaremos', 'pensamos', 'dormimos']);
  for (const f of FORMAS.filter((x) => !BENIGNAS.has(x))) {
    const q = `chagas en Jalisco, ${f} juntos`;
    if (!esApoyo((await kbTurno(q)).md)) fallos.push(`KB ${f}`);
    if (!esApoyo(await ragTurno(q))) fallos.push(`RAG ${f}`);
  }
  assert.deepEqual(fallos, []);
});

test('palabras no verbales en «-mos» no cuentan como primera persona: la aclaración se conserva', async () => {
  for (const w of ['últimos', 'próximos', 'máximos', 'mínimos', 'extremos', 'mismos']) {
    assert.ok(C.NO_VERBALES_MOS.has(w.normalize('NFD').replace(/[̀-ͯ]/g, '')), w);
    const k = (await kbTurno(`chagas en Jalisco, ${w} riesgo`)).md;
    assert.ok(!esApoyo(k) && /Chagas/.test(k), `${w}: ${k.slice(0, 160)}`);
  }
});

test('las consultas funcionales con últimos, próximos, máximos o mínimos no cambian de handler ni pierden su respuesta', async () => {
  const casos = JSON.parse(leer('epibot/tests/test_cases.json'))
    .filter((c) => /\b(ultim|proxim|maxim|minim)os\b/.test(c.query.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()));
  assert.ok(casos.length >= 1);
  for (const c of casos) {
    const k = await kbTurno(c.query);
    if (c.expectedHandler && c.expectedHandler !== '*') assert.equal(k.handler, c.expectedHandler, c.query);
    for (const t of c.mustContain || []) assert.ok(k.md.includes(t), `${c.query}: ${t}`);
  }
});
