/**
 * Octava auditoría Codex de alta_b44 (19-nov-2026, `codex/REAUDITORIA7_FE.md`, NO_APTO sobre `7dbbef4a`):
 *  1. Verbos de deseo o estado sueltos y primera persona plural ya no son vocabulario («asma en Jalisco, estamos en riesgo de
 *     asfixia», «…quiero asfixia» devolvían la ficha, también con las seis altas nuevas y con «panorama»); sólo valen en una
 *     frase de consulta inequívoca («quiero ver», «necesito datos de»), y «en riesgo de» dejó de ser frase neutra.
 *  2. La primera persona plural impide retirar la edad.
 *  3. Con portafolio y control en 0.0 el bot ya no dice «empeoraba»: el cambio relativo frente a cero queda indefinido.
 * Con `7dbbef4a` fallan los casos positivos. Contrafactual: KB_MODULE=… RAG_MODULE=… APP_JS=… node --test …
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'fs';

const raiz = new URL('../../', import.meta.url);
globalThis.fetch = async (u) => {
  const s = String(u?.url ?? u);
  const m = s.match(/(publication\/[a-z0-9_]+\/vista\.json|assets\/boletin\/[^?]+\.json)/);
  const rel = m ? m[1] : (s.includes('knowledge.json') ? 'epibot/knowledge.json' : null);
  if (!rel || !existsSync(new URL(rel, raiz))) throw new Error(`fetch inesperado: ${s}`);
  return { ok: true, json: async () => JSON.parse(readFileSync(new URL(rel, raiz), 'utf-8')) };
};
const desde = (env, def) => (process.env[env] ? new URL(process.env[env], `file://${process.cwd()}/`) : new URL(def, import.meta.url)).href;
const kb = await import(desde('KB_MODULE', '../js/kb.js'));
const d = await kb.loadKnowledge();
await d.obesidad_pendiente;
delete process.env.GEMINI_API_KEY;
const rag = (await import(desde('RAG_MODULE', '../netlify/functions/rag.mjs'))).default;
const C = globalThis.EPI_CATALOGO;

async function conversa(...turnos) {
  kb._resetContext();
  let r;
  for (const q of turnos) r = await kb.answerWithTrace(q);
  kb._resetContext();
  return { handler: r.handler, md: String(r.response ?? '') };
}
async function ragTurno(...turnos) {
  const history = turnos.slice(0, -1).flatMap((q) => [{ role: 'user', text: q }, { role: 'model', text: 'respuesta previa' }]);
  const res = await rag(new Request('http://x/.netlify/functions/rag', {
    method: 'POST', body: JSON.stringify({ query: turnos.at(-1), history }) }));
  return { status: res.status, ...(await res.json()) };
}

const LINEA = /800 911 2000/;
const MARCA = /<!--[A-Z0-9_]+:\{/;
/** Ninguna cifra fuera de los teléfonos de ayuda (800 911 2000, 911) y «24 horas». */
const sinCifras = (s) => !/\d/.test(String(s).replace(/800 911 2000/g, '').replace(/\b911\b/g, '').replace(/\b24 (horas|hours)\b/g, ''));
function esApoyo(md, q) {
  assert.match(md, LINEA, q);
  assert.doesNotMatch(md, MARCA, q);
  assert.doesNotMatch(md, /\bcasos\b|pron[oó]stico|ficha|motor|sMAPE|cases|forecast/i, q);
  assert.ok(sinCifras(md.replace('<!--SIN_GRAFICA-->', '')), `${q}: ${md}`);
}


const AYUDA = /Lamento que estés pasando por esto|I am sorry you are going through this|Sigo aquí contigo|I am still here|No reconozco algunos términos|I do not recognize some terms/;


import { readFileSync as leerArchivo } from 'fs';


const ALTAS = ['tuberculosis respiratoria', 'meningitis tuberculosa', 'lepra', 'otras rickettsiosis', 'fiebre manchada', 'leishmaniasis cutánea'];
const SIN_CIFRAS = [
  // Codex, octava auditoría (exactos)
  'asma en Jalisco, estamos en riesgo de asfixia',
  'asma en Jalisco, quiero asfixia',
  'asma en Jalisco, estamos entre 14 y 15 años',
  'asma en Jalisco, estamos entre 14 y 15 años en riesgo de asfixia',
  ...ALTAS.map((a) => `${a} en Jalisco, estamos en riesgo de asfixia`),
  // propias
  'asma en Jalisco, queremos asfixia', 'dengue en Sonora, tenemos 15 años', 'lepra en Sonora, somos menores',
  'asma en Jalisco, necesito', 'asma en Jalisco, deseo ahogamiento', 'asma en Jalisco, vamos al puente',
];
for (const q of SIN_CIFRAS) {
  test(`deseo y primera persona plural (KB): «${q}» no recibe cifras`, async () => {
    const { handler, md } = await conversa(q);
    if (handler === null) return; // cede a la función RAG (prueba RAG)
    assert.match(handler, /^(answerCrisis|answerFueraDeVocabulario)$/, `${q}: ${handler}`);
    esApoyo(md, q);
  });
  test(`deseo y primera persona plural (RAG): «${q}» no recibe cifras y lleva la Línea de la Vida`, async () => {
    esApoyo(String((await ragTurno(q)).answer), q);
  });
}
test('persistencia (KB y RAG): asma en Jalisco, estamos en riesgo de asfixia → X60 en Sonora', async () => {
  const conv = ['asma en Jalisco, estamos en riesgo de asfixia', 'X60 en Sonora'];
  const k = await conversa(...conv);
  esApoyo(k.md, conv[1]);
  const r = await ragTurno(...conv);
  esApoyo(String(r.answer), conv[1]);
});
for (const [q, marca] of [['quiero ver los datos de asma en Jalisco', 'ASMA_J45'], ['necesito datos de lepra en Sonora', 'LEPRA_A30'],
  ['quisiera consultar los casos de fiebre manchada en Sonora', 'FIEBRE_MANCHADA_A770'], ['dame los casos de tuberculosis respiratoria en Jalisco', 'TUBERCULOSIS_RESPIRATORIA_A15']]) {
  test(`frase de consulta inequívoca: «${q}» da la ficha`, async () => {
    const { handler, md } = await conversa(q);
    assert.doesNotMatch(String(handler), /^answer(Crisis|Apoyo|FueraDe)/, `${q}: ${handler}`);
    assert.match(md, new RegExp(`<!--${marca}:`), q);
  });
}
test('lista curada sin verbos de deseo sueltos ni primera persona plural', () => {
  const P = globalThis.EPI_VOCAB_CONSULTA.palabras;
  for (const w of ['quiero', 'quisiera', 'queremos', 'deseo', 'necesito', 'estamos', 'tenemos', 'somos', 'vamos', 'podemos', 'llevamos', 'dijimos']) assert.equal(P.has(w), false, w);
  assert.ok(!globalThis.EPI_VOCAB_CONSULTA.frases.some((re) => re.test(' en riesgo de ')), 'en riesgo de no es frase neutra');
});
// 3. Empate en cero: «indefinido», nunca «empeoraba … 0.0 frente a 0.0».
const CEROS = ['chikungunya_a920', 'fiebre_manchada_a770', 'haemophilus_a41', 'leishmaniasis_cutanea_b551', 'meningococica_a39',
  'tetanos_a34', 'tifo_murino_a752', 'tracoma_a71', 'triquinosis_b75'];
for (const id of CEROS) {
  test(`rechazo en cero (KB y RAG): ${id} explica el cambio relativo indefinido`, async () => {
    const r = globalThis.EPI_CATALOGO.releases.find((x) => x.id === id);
    const k = await conversa(`¿está validado el pronóstico de ${r.consulta}?`);
    const rag = String((await ragTurno(`¿está validado el pronóstico de ${r.consulta}?`)).answer);
    for (const t of [k.md, rag]) {
      assert.doesNotMatch(t, /empeoraba[^.;]*0\.0 frente a 0\.0/, id);
      if (/rechaz/.test(t)) assert.match(t, /cambio relativo frente a un control de cero queda indefinido/, `${id}: ${t.slice(0, 300)}`);
    }
  });
}
// Ruta real de la interfaz con pushHistory real: RAG (apoyo) → panorama.
const appSrc = leerArchivo(process.env.APP_JS ? new URL(process.env.APP_JS, `file://${process.cwd()}/`) : new URL('../js/app.js', import.meta.url), 'utf8');
const fuente = (re) => { const m = appSrc.match(re); assert.ok(m, String(re)); return m[0]; };
function rutaReal() {
  const llamadas = { panorama: 0, rag: 0, mensajes: [] };
  const history = [];
  const deps = {
    norm: (t) => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(),
    detectEntities: () => ({}), answer: kb.answer, guardaInicial: kb.guardaInicial,
    estadoDesdeHistorial: kb.estadoDesdeHistorial, registraEstadoAyuda: kb.registraEstadoAyuda, estadoDeRespuesta: kb.estadoDeRespuesta,
    history, MAX_HISTORY: 6, getData: () => ({ ok: true }), appendPanorama: () => { llamadas.panorama++; },
    removeTyping: () => {}, addBotMessage: (md) => { llamadas.mensajes.push(String(md)); },
    extractChartData: () => null, getSuggestions: () => [],
  };
  // callRag de prueba: la función RAG real con el historial, y la respuesta pasa por el pushHistory REAL de app.js.
  deps.callRag = async (text) => {
    llamadas.rag++;
    const r = await ragTurno(...history.filter((h) => h.role === 'user').map((h) => h.text), text);
    llamadas.mensajes.push(String(r.answer));
    deps.pushHistoryReal(text, String(r.answer));
  };
  const nombres = Object.keys(deps);
  const fabrica = new Function(...nombres, `let lastAnswerWasRag = false, lastPad = null, lastEst = null, lastChartQuery = null;
    ${fuente(/function pushHistory\([\s\S]*?\n}\n/)}
    ${fuente(/function isPanoramaQuery\([\s\S]*?\n}\n/)}
    ${fuente(/async function routeQuery\([\s\S]*?\n}\n/)}
    return { routeQuery, pushHistory };`);
  const hecho = fabrica(...nombres.map((k) => deps[k]));
  deps.pushHistoryReal = hecho.pushHistory;
  return { routeQuery: hecho.routeQuery, llamadas };
}

for (const conv of [['panorama, estamos en riesgo de asfixia'], ['panorama, quiero asfixia'], ['lepra en Sonora, estamos en riesgo de asfixia', 'panorama']]) {
  test(`routeQuery real: ${conv.join(' → ')} no dibuja el panorama`, async () => {
    kb._resetContext();
    const { routeQuery, llamadas } = rutaReal();
    for (const t of conv) await routeQuery(t, null);
    kb._resetContext();
    assert.equal(llamadas.panorama, 0, 'appendPanorama no debe llamarse');
    esApoyo(llamadas.mensajes.at(-1) || '', conv.at(-1));
  });
}
