/**
 * Decimoquinta auditoría Codex de alta_b44 (19-nov-2026, `codex/REAUDITORIA14_FE.md`, NO_APTO sobre `95e71f16`):
 *  1. El divisor de cláusulas ya no usa marcas de texto: divide en una lista y la frontera es `null` en el arreglo. El usuario
 *     escribiendo la marca antigua (o su variante compatible) queda fuera de vocabulario y nunca levanta la crisis.
 *  2. NFKC UNA vez en la entrada (kb.js, app.js, rag.mjs: consulta y cada turno del historial): las consultas de ancho completo
 *     se comportan igual que su versión ASCII. Prueba de propiedad: cada consulta funcional de las fichas en ancho completo da
 *     la misma respuesta que la ASCII, en KB y en RAG.
 * Con `95e71f16` fallan los casos positivos. Contrafactual: KB_MODULE=… RAG_MODULE=… node --test …
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



const MARCAS = ['qqsepqq', '𝓺𝓺𝓼𝓮𝓹𝓺𝓺', 'ｑｑｓｅｐｑｑ'];
for (const m of MARCAS) {
  test(`marca antigua «${m}»: fuera de vocabulario y nunca levanta la crisis (KB y RAG)`, async () => {
    assert.ok(C.fueraDeVocabulario(`asma en Jalisco, ${m}`), m);
    assert.equal(C.crisisEnTurnos(['me quiero morir', `asma en Jalisco, ${m}`], () => true), 'crisis');
    const conv = ['me quiero morir', `asma en Jalisco, ${m}`, 'X60 en Sonora'];
    for (const n of [2, 3]) {
      esApoyo((await conversa(...conv.slice(0, n))).md, conv[n - 1]);
      esApoyo(String((await ragTurno(...conv.slice(0, n))).answer), conv[n - 1]);
    }
  });
}
test('ningún token de texto interno en el código del divisor', () => {
  const src = leerArchivo(new URL('../js/release_catalog.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /qqsepqq/);
});
// 2. Casos de Codex: igual que su versión ASCII.
const PARES = [
  [['X60 en Sonora y ａｓｍａ'], ['X60 en Sonora y asma']],
  [['diabetes tipo 2 en Sonora', 'ａｓｍａ en Jalisco'], ['diabetes tipo 2 en Sonora', 'asma en Jalisco']],
  [['cuantos casos de asma en Ｓｏｎｏｒａ'], ['cuantos casos de asma en Sonora']],
];
for (const [ancho, ascii] of PARES) {
  test(`ancho completo igual que ASCII (KB y RAG): ${JSON.stringify(ancho)}`, async () => {
    const a = await conversa(...ancho); const b = await conversa(...ascii);
    assert.equal(a.handler, b.handler); assert.equal(a.md, b.md);
    const ra = String((await ragTurno(...ancho)).answer); const rb = String((await ragTurno(...ascii)).answer);
    assert.equal(ra, rb);
  });
}
const ANCHO = (t) => t.replace(/[A-Za-z0-9]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0xFEE0));
const FUNCIONALES = [...new Set([
  ...C.releases.flatMap((r) => [`${r.consulta} en Jalisco`, `¿está validado el pronóstico de ${r.consulta}?`]),
  ...JSON.parse(leerArchivo(new URL('./test_cases.json', import.meta.url), 'utf8')).map((c) => c.query),
])];
test('propiedad (KB): cada consulta funcional en ancho completo da la misma respuesta que la ASCII', async () => {
  const fallos = [];
  for (const q of FUNCIONALES) {
    const b1 = await conversa(q); const b2 = await conversa(q);
    const a = await conversa(ANCHO(q));
    if (a.handler !== b1.handler) { fallos.push(q); continue; }
    // Respuesta aleatoria (gráfica sorpresa): basta el mismo handler.
    if (b1.handler === 'answerGraficoAleatorio' || b1.md !== b2.md) continue;
    if (a.md !== b1.md) fallos.push(q);
  }
  assert.deepEqual(fallos.slice(0, 20), [], `${fallos.length} consultas difieren`);
});
test('propiedad (RAG): cada consulta de ficha en ancho completo da la misma respuesta que la ASCII', async () => {
  const fallos = [];
  for (const r of C.releases) {
    const q = `${r.consulta} en Jalisco`;
    const b = String((await ragTurno(q)).answer); const a = String((await ragTurno(ANCHO(q))).answer);
    if (a !== b) fallos.push(q);
  }
  assert.deepEqual(fallos.slice(0, 20), [], `${fallos.length} consultas difieren`);
});
