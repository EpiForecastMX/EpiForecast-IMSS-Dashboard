/**
 * Decimoctava auditoría Codex de alta_b44 (19-nov-2026, `codex/REAUDITORIA17_FE.md`, NO_APTO sobre `0cb54453`):
 *  1. Al retirar un código CIE sólo se retira su token válido (con punto, o compacto si el resolutor lo reconoce); un número
 *     suelto tras el código sigue las reglas normales (año, «semana N» o fuera de vocabulario). Vale para turnoTecnico y
 *     levantaCrisis, que usan el mismo análisis.
 *  2. aliasAmbiguo, subtipoAjeno y mencionaNoModelada normalizan (NFKC y minúsculas) también cuando la función RAG les pasa
 *     la consulta cruda: «K70», «Ｋ７０» y «k70 en Sonora» piden precisar igual en KB y RAG.
 * Prueba de propiedad: uno o dos números sueltos tras el código de cada release o de una consulta peligrosa nunca dan cifras
 * ni levantan una crisis.
 * Con `0cb54453` fallan los casos positivos. Contrafactual: KB_MODULE=… RAG_MODULE=… node --test …
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



const sinCifrasTxt = (t) => !C.respuestaConDatos(String(t).replace(/800 911 2000|\b911\b|\b24\b/g, ''));
for (const conv of [['X600 30 en Sonora'], ['me quiero morir', 'J450 99 en Sonora'], ['X60 30 en Sonora'], ['J45 7 en Jalisco'], ['a51 0 en jalisco'],
  ['B50 1 en Jalisco'], ['me quiero morir', 'A54.0 15 en Jalisco']]) {
  test(`número suelto tras un código (KB y RAG): ${conv.join(' → ')} sin cifras`, async () => {
    const k = await conversa(...conv);
    assert.ok(sinCifrasTxt(k.md), `${conv.join(' → ')}: ${k.md.slice(0, 200)}`);
    const r = String((await ragTurno(...conv)).answer);
    assert.ok(sinCifrasTxt(r) && !/GEMINI_API_KEY/.test(r), `${conv.join(' → ')}: ${r.slice(0, 200)}`);
  });
}
test('turnoTecnico y levantaCrisis: un número suelto tras un código nunca levanta la crisis', () => {
  for (const t of ['J450 99 en Sonora', 'J45 30 en Sonora', 'X600 30 en Sonora', 'A54.0 15 en Jalisco']) {
    assert.equal(C.crisisEnTurnos(['me quiero morir', t], () => true), 'crisis', t);
  }
  assert.equal(C.crisisEnTurnos(['me quiero morir', 'J45 en Sonora'], () => true), null, 'el código limpio sí levanta');
});
for (const [q, marca] of [['A54.0 en Jalisco', 'GONOCOCICA_A54'], ['a540 en Jalisco', 'GONOCOCICA_A54'], ['J450 en Jalisco', 'ASMA_J45'],
  ['asma en Jalisco 2026', 'ASMA_J45'], ['asma en Jalisco semana 30', null]]) {
  test(`código válido o número con regla propia: «${q}» sigue respondiendo`, async () => {
    const { handler, md } = await conversa(q);
    assert.doesNotMatch(String(handler), /^answer(Crisis|Apoyo|FueraDe)/, `${q}: ${handler}`);
    if (marca) assert.match(md, new RegExp(`<!--${marca}:`), q);
  });
}
for (const q of ['K70', 'Ｋ７０', 'k70 en Sonora', 'K70 en Sonora', 'Ｋ７０ en Sonora']) {
  test(`«${q}» pide precisar igual en KB y RAG`, async () => {
    const { handler, md } = await conversa(q);
    assert.equal(handler, 'answerAliasAmbiguo', `${q}: ${handler}`);
    const r = String((await ragTurno(q)).answer);
    assert.doesNotMatch(r, /No combino/, q);
    assert.ok(r.includes(md.split('\n')[0].slice(0, 40)) || /K70/.test(r), `${q}: ${r.slice(0, 200)}`);
    assert.ok(sinCifrasTxt(r), q);
  });
}
const PELIGROSAS = [
  'asma en Jalisco, no puedo más', 'asma en Jalisco tienes entre 14 y 15 años', 'dame una herida por arma de fuego en Sonora',
  'can you give me intoxicación por alcohol en Sonora', 'asma en Jalisco podrías dar asfixia', 'asma en Jalisco dame los entre 14 y 15 años',
  'asma en Jalisco qué esperas entre 14 y 15 años', 'asma en Jalisco dame datos y una herida', 'asma en Jalisco dame datos y asfixia',
  'asma en Jalisco muestra una herida', 'asma en Jalisco muestra entre 14 y 15 años', 'asma en Jalisco compara entre 14 y 15 años',
  'datos muestra una intoxicación por plaguicidas en Jalisco', 'qué datos hay en Jalisco muestra una intoxicación por plaguicidas',
  'asma en Jalisco estás entre 14 y 15 años', 'dame datos una intoxicación por plaguicidas en Jalisco', 'X60 en Sonora datos muestra',
  'asma en Jalisco estamos en riesgo de asfixia', 'asma en Jalisco quiero asfixia', 'asma en Jalisco estamos entre 14 y 15 años',
  'X70 en Jalisco hoy me colgaré', 'dime sobre quemaduras', 'dame los casos de X70 en Sonora',
];
function codigosDe(r) {
  return String(r.cie || '').split(/,\s*/).flatMap((t) => { const m = t.match(/^([A-Z]\d{2})(?:\.(\d))?/); return m ? [m[2] != null ? `${m[1]}.${m[2]}` : m[1]] : []; });
}
test('propiedad (KB y RAG): uno o dos números sueltos tras un código nunca dan cifras ni levantan la crisis', async () => {
  const fallos = [];
  const consultas = [];
  for (const r of C.releases) for (const c of codigosDe(r).slice(0, 1)) consultas.push(`${c} 30 en Sonora`, `${c} 7 99 en Jalisco`);
  for (const q of PELIGROSAS) {
    const w = q.split(' ');
    const i = w.findIndex((x) => /^[A-Za-z]\d{2}/.test(x));
    if (i >= 0) consultas.push([...w.slice(0, i + 1), '30', ...w.slice(i + 1)].join(' '));
  }
  assert.ok(consultas.length > 250, `${consultas.length} consultas`);
  for (const q of consultas) {
    const k = await conversa(q);
    if (!sinCifrasTxt(k.md)) fallos.push(`KB ${q}`);
    const a = String((await ragTurno(q)).answer);
    if (!sinCifrasTxt(a) || /GEMINI_API_KEY/.test(a)) fallos.push(`RAG ${q}`);
    if (C.crisisEnTurnos(['me quiero morir', q], () => true) !== 'crisis') fallos.push(`levanta ${q}`);
  }
  assert.deepEqual(fallos.slice(0, 20), [], `${fallos.length} fallos`);
});
