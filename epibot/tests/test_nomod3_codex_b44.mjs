/**
 * Tercera auditoría Codex de las categorías no modelables (`codex/REAUDITORIA2_FE_NOMOD.md`, APTO_CON_CORRECCIONES sobre
 * `6bc45bb6`): la primera persona de la salida ante vocabulario desconocido incluye toda la primera persona plural, generada
 * desde la tabla de conjugaciones que usa la prueba de la lista curada (CONJUGACIONES_COMUNES), y los pronombres ingleses
 * we, our, us, ours, ourselves, I, me, my, mine y myself. «chagas en Jalisco, estamos preocupados / tenemos problemas /
 * somos menores» recibe sólo el apoyo con la Línea de la Vida, sin la aclaración, en KB y RAG.
 * Con 6bc45bb6 fallan. Contrafactual: KB_MODULE=… RAG_MODULE=… node --test tests/test_nomod3_codex_b44.mjs
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
  return String(r.response ?? '');
}
async function ragTurno(q) {
  const res = await rag(new Request('http://x/.netlify/functions/rag', { method: 'POST', body: JSON.stringify({ query: q, history: [] }) }));
  return String((await res.json()).answer ?? '');
}
const esApoyo = (t) => t.startsWith(C.APOYO_ES.replace('\n<!--SIN_GRAFICA-->', '')) || t.startsWith(C.APOYO_EN.replace('\n<!--SIN_GRAFICA-->', ''));

test('la tabla de conjugaciones es la del catálogo y trae la primera persona plural', () => {
  const T = C.CONJUGACIONES_COMUNES;
  assert.ok(T && Object.keys(T).length >= 11);
  for (const f of ['estamos', 'tenemos', 'somos', 'podemos', 'queremos', 'vamos', 'hacemos', 'sabemos', 'damos', 'vemos', 'decimos']) {
    assert.ok(Object.values(T).some((s) => s.split(' ').includes(f)), f);
  }
});

const PLURAL = [...new Set(Object.values(C.CONJUGACIONES_COMUNES).flatMap((s) => s.split(' ')).filter((f) => f.endsWith('mos')))];
const REPRO = ['chagas en Jalisco, estamos preocupados', 'chagas en Jalisco, tenemos problemas', 'chagas en Jalisco, somos menores'];

test('reproducciones: la primera persona plural sin riesgo recibe la aclaración de Chagas, sin el apoyo (KB y RAG)', async () => {
  // Rediseño conversacional (24-nov-2026, tests/politica_conversacional.mjs): una forma de primera persona plural sin
  // señal de riesgo ya no niega la respuesta; las de daño, sustancia o súplica siguen dando el apoyo.
  for (const q of REPRO) {
    const k = await kbTurno(q);
    assert.ok(!esApoyo(k), `KB ${q}: ${k.slice(0, 200)}`);
    assert.match(k, /Chagas/, q);
    const r = await ragTurno(q);
    assert.ok(!esApoyo(r), `RAG ${q}: ${r.slice(0, 200)}`);
  }
});

test('ninguna forma plural de la tabla ni pronombre inglés sin riesgo da el apoyo (KB y RAG)', async () => {
  const fallos = [];
  const frases = [...PLURAL.map((f) => `chagas en Jalisco, ${f} preocupados`),
    ...['we', 'our', 'us', 'ours', 'ourselves', 'i', 'me', 'my', 'mine', 'myself'].map((p) => `chagas in Jalisco, ${p} worried`)];
  for (const q of frases) {
    if (esApoyo(await kbTurno(q))) fallos.push(`KB ${q}`);
    if (esApoyo(await ragTurno(q))) fallos.push(`RAG ${q}`);
  }
  assert.deepEqual(fallos, []);
  assert.ok(PLURAL.length >= 50, String(PLURAL.length));
});
