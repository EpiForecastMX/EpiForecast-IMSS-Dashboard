/**
 * Auditoría Codex de las categorías no modelables (`codex/AUDITORIA_FE_NOMOD.md`, NO_APTO sobre `15917621`):
 *  1. ALTA: ante un token fuera del vocabulario o una señal de riesgo, KB y función RAG sólo emiten la respuesta de crisis o de
 *     apoyo con la Línea de la Vida (800 911 2000), nunca un enlace a una ficha. «Quemaduras solares en Jalisco, me quemé» y
 *     «Tétanos neonatal en Jalisco, tengo 15 años» devolvían en la función RAG la aclaración del vecino con su página.
 *     Prueba de propiedad: cada una de las 32 no modelables, cada release y cada original, con una frase de riesgo personal.
 *  2. MEDIA: tétanos neonatal, tifo epidémico, P. falciparum, leishmaniasis visceral y quemaduras solares, pedidas por nombre
 *     completo o código, dan en la función RAG su motivo medido y sus cifras impresas, no la aclaración del bloque vecino.
 *  3. MEDIA: «casos de rubéola y síndrome de rubéola congénita» devuelve las dos categorías.
 * Con 15917621 fallan. Contrafactual: KB_MODULE=… RAG_MODULE=… node --test tests/test_nomod_codex_b44.mjs
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

const ACTUAL = JSON.parse(leer('assets/boletin/actual.json'));
const FOTO = JSON.parse(leer(`${ACTUAL.carpeta}/data.json`));
const NM = FOTO.diseases.filter((e) => e.status === 'No modelable');
const limpio = (n) => n.replace(/^[\^•]+/, '').replace(/\s+/g, ' ').trim();
const es = (v) => (v === '-' ? '–' : Number(v).toLocaleString('es-MX'));

async function kbTurno(q) {
  kb._resetContext();
  const r = await kb.answerWithTrace(q);
  kb._resetContext();
  return { handler: r.handler, md: String(r.response ?? '') };
}
async function ragTurno(q) {
  const res = await rag(new Request('http://x/.netlify/functions/rag', { method: 'POST', body: JSON.stringify({ query: q, history: [] }) }));
  return { status: res.status, ...(await res.json()) };
}

const NOMBRES = [...NM.map((e) => limpio(e.name)), ...C.releases.map((r) => r.nombre), 'Depresión', 'Parkinson', 'Alzheimer', 'Dengue'];
// Rediseño conversacional (24-nov-2026): «tengo 15 años» sin otra señal ya no es riesgo (tests/politica_conversacional.mjs).
const RIESGO = ['me quemé', 'me quiero morir'];

test('reproducciones de la auditoría: apoyo con la Línea de la Vida, sin enlace a ficha, en KB y RAG', async () => {
  for (const q of ['Quemaduras solares en Jalisco, me quemé']) {
    const k = await kbTurno(q);
    assert.match(k.md, /800 911 2000/, q);
    assert.match(k.md, /<!--SIN_GRAFICA-->/, q);
    assert.doesNotMatch(k.md, /\.html/, q);
    const r = await ragTurno(q);
    assert.equal(r.status, 200, q);
    assert.match(r.answer, /800 911 2000/, q);
    assert.doesNotMatch(r.answer, /\.html|más cercano/, q);
    assert.deepEqual(r.sources ?? [], [], q);
  }
});

test('propiedad: cada no modelable, cada release y cada original con una frase de riesgo personal da crisis o apoyo (KB)', async () => {
  const fallos = [];
  for (const n of NOMBRES) {
    for (const f of RIESGO) {
      const q = `${n} en Jalisco, ${f}`;
      const k = await kbTurno(q);
      if (!/800 911 2000/.test(k.md) || !k.md.includes('<!--SIN_GRAFICA-->') || /\.html|<!--[A-Z0-9_]+:\{/.test(k.md)) fallos.push(`${q} [${k.handler}]`);
    }
  }
  assert.deepEqual(fallos.slice(0, 20), [], `${fallos.length} fallos`);
  assert.ok(NOMBRES.length >= 32 + 148 + 4);
});

test('propiedad: lo mismo en la función RAG, sin modelo', async () => {
  const fallos = [];
  for (const n of NOMBRES) {
    for (const f of RIESGO) {
      const q = `${n} en Jalisco, ${f}`;
      const r = await ragTurno(q);
      if (r.status !== 200 || !/800 911 2000/.test(r.answer ?? '') || /\.html/.test(r.answer ?? '') || (r.sources ?? []).length) fallos.push(q);
    }
  }
  assert.deepEqual(fallos.slice(0, 20), [], `${fallos.length} fallos`);
});

test('función RAG: las cinco categorías tapadas por la guarda de vecinos dan su motivo y sus cifras, por nombre y por código', async () => {
  for (const codigo of ['A33', 'A75.0', 'B50', 'B55.0', 'L55']) {
    const e = NM.find((x) => x.code === codigo);
    for (const q of [limpio(e.name), `casos de ${limpio(e.name).toLowerCase()}`, codigo]) {
      const r = await ragTurno(q);
      assert.equal(r.status, 200, q);
      assert.equal(r.guarda, 'no_modelable', q);
      assert.ok(r.answer.startsWith(`**${limpio(e.name)} (${e.code})**`), `${q}: ${r.answer.slice(0, 120)}`);
      assert.match(r.answer, /\*\*no modelable\*\*/, q);
      assert.ok(r.answer.includes(`Motivo medido: ${e.reason.charAt(0).toLowerCase()}${e.reason.slice(1)}`), q);
      assert.ok(r.answer.includes(`Acumulado ${FOTO.meta.year}: **${es(e.cumulative)}`), q);
      assert.ok(r.answer.includes(`Acumulado comparable ${FOTO.meta.year - 1}: **${es(e.previous)}`), q);
      assert.doesNotMatch(r.answer, /más cercano|pronostican|52 semanas/, q);
    }
  }
});

test('EpiBot: las cinco también por código', async () => {
  for (const codigo of ['A33', 'A75.0', 'B50', 'B55.0', 'L55']) {
    const e = NM.find((x) => x.code === codigo);
    const k = await kbTurno(codigo);
    assert.equal(k.handler, 'answerRadarBoletin', codigo);
    assert.ok(k.md.startsWith(`**${e.name} (${e.code})**`), codigo);
    assert.match(k.md, /no modelable/, codigo);
  }
});

test('rubéola y síndrome de rubéola congénita pedidas juntas: las dos, en KB y RAG; el síndrome solo, sólo él', async () => {
  const k = await kbTurno('casos de rubéola y síndrome de rubéola congénita');
  assert.match(k.md, /^\*\*2 categorías del boletín\*\*/);
  assert.match(k.md, /\| Rubéola \| B06 \|/);
  assert.match(k.md, /\| Síndrome de rubéola congénita \| P35\.0 \|/);
  const r = await ragTurno('casos de rubéola y síndrome de rubéola congénita');
  assert.match(r.answer, /\*\*Rubéola \(B06\)\*\*/);
  assert.match(r.answer, /\*\*Síndrome de rubéola congénita \(P35\.0\)\*\*/);
  const solo = await kbTurno('síndrome de rubéola congénita');
  assert.ok(solo.md.startsWith('**Síndrome de rubéola congénita (P35.0)**'));
  const soloRag = await ragTurno('síndrome de rubéola congénita');
  assert.doesNotMatch(soloRag.answer, /\*\*Rubéola \(B06\)\*\*/);
});
