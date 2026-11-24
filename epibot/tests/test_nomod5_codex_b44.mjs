/**
 * Cuarta verificación de las categorías no modelables (`codex/REAUDITORIA4_FE_NOMOD.md`, APTO_CON_CORRECCIONES sobre
 * `d056d374`): la regla general de primera persona incluye los pronombres enclíticos (tokens de cinco letras o más en «nos»,
 * «me», «melo», «noslo»…), salvo las excepciones no verbales de NO_VERBALES_MOS. «chagas en Jalisco, cuidémonos» y
 * «…tranquilicémonos» dan sólo el apoyo con la Línea de la Vida en KB y RAG, igual que treinta formas enclíticas; las
 * excepciones conservan la aclaración y ninguna consulta funcional cambia.
 * Con d056d374 fallan. Contrafactual: KB_MODULE=… RAG_MODULE=… node --test tests/test_nomod5_codex_b44.mjs
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
// La respuesta de crisis (método propio: «matarme», «lastimarme») es más estricta que el apoyo y también vale.
const esAyuda = (t) => esApoyo(t) || /^Lamento que estés pasando por esto/.test(t);

const CODEX = ['chagas en Jalisco, cuidémonos', 'chagas en Jalisco, tranquilicémonos'];
test('casos de Codex: «tranquilicémonos» es súplica y da el apoyo; «cuidémonos» no (KB y RAG)', async () => {
  // Rediseño conversacional (24-nov-2026, tests/politica_conversacional.mjs): una forma de primera persona plural sin
  // señal de riesgo ya no niega la respuesta; las de daño, sustancia o súplica siguen dando el apoyo.
  const k = (await kbTurno('chagas en Jalisco, tranquilicémonos')).md;
  assert.ok(esApoyo(k), `KB: ${k.slice(0, 160)}`);
  assert.ok(esApoyo(await ragTurno('chagas en Jalisco, tranquilicémonos')));
  assert.ok(!esApoyo((await kbTurno('chagas en Jalisco, cuidémonos')).md));
});

// Treinta formas con pronombre enclítico de primera persona (imperativo, infinitivo, gerundio, exhortativo, «-melo»).
const FORMAS = ['ayúdanos', 'cuídame', 'dímelo', 'vámonos', 'cuidémonos', 'tranquilicémonos', 'matarme', 'ayudarnos',
  'explícamelo', 'dánoslo', 'protégenos', 'escúchame', 'abrázame', 'ayúdame', 'llévame', 'perdónanos', 'sálvanos',
  'cuidarnos', 'lastimarme', 'quemarnos', 'hiriéndome', 'cuidándonos', 'calmémonos', 'escondámonos',
  'llámame', 'acompáñame', 'avísanos', 'cálmame', 'olvídame', 'entiéndeme'];
test('propiedad: las formas enclíticas de daño o súplica dan el apoyo o la crisis, en KB y RAG', async () => {
  assert.equal(FORMAS.length, 30);
  const fallos = [];
  // Peticiones al bot sin riesgo: ya no dan el apoyo (rediseño conversacional, 24-nov-2026).
  const BENIGNAS = new Set(['dímelo', 'vámonos', 'cuidémonos', 'ayudarnos', 'explícamelo', 'dánoslo', 'llévame', 'cuidarnos',
    'cuidándonos', 'llámame', 'avísanos']);
  for (const f of FORMAS.filter((x) => !BENIGNAS.has(x))) {
    const q = `chagas en Jalisco, ${f}`;
    if (!esAyuda((await kbTurno(q)).md)) fallos.push(`KB ${f}`);
    if (!esAyuda(await ragTurno(q))) fallos.push(`RAG ${f}`);
  }
  assert.deepEqual(fallos, []);
});

test('las excepciones no verbales en «-nos» y «-me» conservan la aclaración', async () => {
  for (const w of ['menos', 'buenos', 'algunos', 'unos', 'informe', 'enorme', 'uniforme', 'vecinos']) {
    assert.ok(C.NO_VERBALES_MOS.has(w), w);
    const k = (await kbTurno(`chagas en Jalisco, ${w} riesgo`)).md;
    assert.ok(!esApoyo(k) && /Chagas/.test(k), `${w}: ${k.slice(0, 160)}`);
  }
});
