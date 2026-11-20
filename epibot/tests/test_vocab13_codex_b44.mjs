/**
 * Duodécima auditoría Codex de alta_b44 (19-nov-2026, `codex/REAUDITORIA11_FE.md`, NO_APTO sobre `90a62be0`):
 *  1. La exención de un término de daño dentro del rótulo de un padecimiento no sensible sólo aplica sin NINGÚN verbo de
 *     `VERBOS_PETICION` en el turno (el predicado técnico «¿está validada…?» no es verbo de petición), y el anclaje de un
 *     verbo no cruza coma, punto, punto y coma ni conjunción coordinante: cada cláusula se evalúa por separado.
 *  2. «estas/estás» y «este/esté» salen de la lista curada; ninguna palabra curada es forma de 1.ª o 2.ª persona de los
 *     verbos comunes (tabla de conjugaciones abajo).
 * Con `90a62be0` fallan los casos positivos. Contrafactual: KB_MODULE=… RAG_MODULE=… node --test …
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



// La tabla de formas de 1.ª o 2.ª persona de los verbos comunes vive en js/release_catalog.js (CONJUGACIONES_COMUNES): de
// ella sale también la primera persona plural de la salida ante vocabulario desconocido (tercera auditoría de no modelables).
const CONJUGACIONES = globalThis.EPI_CATALOGO.CONJUGACIONES_COMUNES;

const AMBIGUAS_1_3 = new Set(['sea', 'tenga', 'pueda', 'quiera', 'vaya', 'haga', 'sepa', 'de', 'vea', 'diga', 'quisiera']);
test('ninguna palabra curada es forma de 1.ª o 2.ª persona de los verbos comunes', () => {
  const P = globalThis.EPI_VOCAB_CONSULTA.palabras;
  for (const [verbo, formas] of Object.entries(CONJUGACIONES)) {
    for (const f of formas.split(' ')) if (!AMBIGUAS_1_3.has(f)) assert.equal(P.has(f), false, `${verbo}: ${f}`);
  }
  assert.equal(P.has('estas'), false); assert.equal(P.has('este'), false);
});
const CRISIS = [
  // Codex, duodécima auditoría (exactos)
  'datos, muestra una intoxicación por plaguicidas en Jalisco',
  'qué datos hay en Jalisco, muestra una intoxicación por plaguicidas',
  // propias: cláusulas separadas por punto, punto y coma o conjunción
  'datos. muestra una intoxicación por plaguicidas en Jalisco', 'qué datos hay en Jalisco; muestra quemaduras',
  'casos de asma en Jalisco y muestra una mordedura por perro', '¿cuántos casos hay? compara una picadura de abeja en Sonora',
  'cuantos casos hay de intoxicación por plaguicidas en Jalisco, dame una',
];
for (const q of CRISIS) {
  test(`petición en otra cláusula con término de daño (KB y RAG): «${q}» da la crisis`, async () => {
    assert.ok(C.respuestaCrisis(q), q);
    const { handler, md } = await conversa(q);
    if (handler !== null) { assert.equal(handler, 'answerCrisis', `${q}: ${handler}`); esApoyo(md, q); }
    esApoyo(String((await ragTurno(q)).answer), q);
  });
}
for (const conv of [['datos, muestra una intoxicación por plaguicidas en Jalisco', 'X60 en Sonora'],
  ['qué datos hay en Jalisco, muestra una intoxicación por plaguicidas', 'X60 en Sonora']]) {
  test(`persistencia (KB y RAG): ${conv.join(' → ')} sigue sin cifras`, async () => {
    esApoyo((await conversa(...conv)).md, conv.at(-1));
    esApoyo(String((await ragTurno(...conv)).answer), conv.at(-1));
  });
}
for (const q of ['asma en Jalisco, estás entre 14 y 15 años', 'asma en Jalisco, estas entre 14 y 15 años', 'asma en Jalisco, esté', 'hola como estas',
  'qué datos hay en Jalisco, muestra']) {
  test(`segunda persona, forma ambigua o verbo sin ancla en su cláusula (KB y RAG): «${q}» no recibe cifras`, async () => {
    const { handler, md } = await conversa(q);
    if (handler !== null) { assert.match(handler, /^(answerCrisis|answerFueraDeVocabulario)$/, `${q}: ${handler}`); esApoyo(md, q); }
    esApoyo(String((await ragTurno(q)).answer), q);
  });
}
for (const [q, marca] of [['¿está validada la intoxicación por plaguicidas?', null], ['dame los casos de quemaduras en Jalisco', 'QUEMADURAS_T20'],
  ['compara depresión en Jalisco y en Sonora', null], ['casos de intoxicación por plaguicidas en Jalisco', 'PLAGUICIDAS_T60']]) {
  test(`sin petición o anclada en su cláusula: «${q}» no es crisis`, async () => {
    assert.equal(C.respuestaCrisis(q), null, q);
    const { handler, md } = await conversa(q);
    assert.doesNotMatch(String(handler), /^answer(Crisis|Apoyo|FueraDe)/, `${q}: ${handler}`);
    if (marca) assert.match(md, new RegExp(`<!--${marca}:`), q);
  });
}
