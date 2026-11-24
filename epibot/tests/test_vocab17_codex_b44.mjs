/**
 * Decimosexta auditoría Codex de alta_b44 (19-nov-2026, `codex/REAUDITORIA15_FE.md`, NO_APTO sobre `74ad4950`): la guarda de
 * consultas mixtas sensibles obtiene TODAS las menciones con el resolutor único del catálogo (códigos CIE de releases y de
 * los originales F32/G20/G30/A97 con subcódigos, alias y nombres en inglés), en KB y en RAG antes de Gemini; y la salida
 * de consultas mixtas de obesidad_kb.js nunca responde con el nacional cuando se pidió un estado.
 * Prueba de propiedad: cada id sensible × cada original (código, nombre en español y en inglés) con estado: sin cifras.
 * Con `74ad4950` fallan los casos positivos. Contrafactual: KB_MODULE=… RAG_MODULE=… node --test …
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


const AYUDA = /Lamento que estés pasando por esto|I am sorry you are going through this|Sigo aquí contigo|I am still here|No reconozco algunos términos|No entendí bien tu mensaje|I do not recognize some terms|I did not quite understand/;


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



const MIXTAS = [
  // Codex, decimosexta auditoría (exactos)
  'X60 en Sonora y F32', 'X60 en Sonora y G20', 'X60 en Sonora y A97', 'X60 en Sonora y depression', 'Z91.5 en Sonora y A97',
  // propias
  'X60 en Sonora y F32.1', 'X70 en Jalisco y G30', 'VIH en Sonora y A97.0', 'X60 en Sonora y J45', 'X60 en Sonora y E66',
];
for (const q of MIXTAS) {
  test(`guarda mixta con códigos o nombres en inglés (KB y RAG): «${q}» sin cifras`, async () => {
    const { handler, md } = await conversa(q);
    assert.equal(handler, 'answerMixtaSensible', `${q}: ${handler}`);
    assert.ok(!C.respuestaConDatos(md.replace(/800 911 2000|\b911\b|\b24\b/g, '')), `${q}: ${md.slice(0, 200)}`);
    const r = await ragTurno(q);
    assert.match(String(r.answer), /No combino en una misma respuesta/, `${q}: ${String(r.answer).slice(0, 200)}`);
  });
}
test('resolutor único: códigos, subcódigos y nombres en inglés de los originales', () => {
  const m = (q) => C.padecimientosEnConsulta(q);
  assert.deepEqual(m('f32 y g20.1').legacy.sort(), ['Depresion', 'Parkinson']);
  assert.deepEqual(m('depression and alzheimer').legacy.sort(), ['Alzheimer', 'Depresion']);
  assert.deepEqual(m('A97.0').legacy, ['Dengue']);
  assert.ok(m('J45 en Sonora').releases.some((r) => r.id === 'asma_j45'));
});
test('consulta mixta no sensible con estado: nunca el total nacional', async () => {
  const { handler, md } = await conversa('obesidad y diabetes tipo 2 en Sonora');
  assert.equal(handler, 'answerReleasesMixtos');
  const d = kb.getData();
  const rs = C.releases.filter((x) => ['obesidad', 'diabetes_t2'].includes(x.id));
  assert.equal(rs.length, 2);
  for (const r of rs) {
    const nac = d[r.dataKey]?.series['nacional|mx|general'];
    assert.ok(nac, r.id);
    assert.ok(!md.includes(Math.round(nac.pronostico_52_total).toLocaleString('en-US')), `${r.id}: total nacional en ${md}`);
  }
  assert.match(md, /en Sonora/);
});
const LEGACY = [['F32', 'depresión', 'depression'], ['G20', 'parkinson', "parkinson's"], ['G30', 'alzheimer', "alzheimer's"], ['A97', 'dengue', 'dengue fever']];
test('propiedad (KB y RAG): cada id sensible × cada original (código, ES, EN) con estado no da cifras', async () => {
  const fallos = [];
  for (const id of C.IDS_LISTA_BLANCA) {
    const r = C.releases.find((x) => x.id === id);
    for (const formas of LEGACY) {
      for (const leg of formas) {
        for (const q of [`${r.consultaVisible} en Sonora y ${leg}`, `${leg} y ${r.consultaVisible} en Jalisco`]) {
          const { md } = await conversa(q);
          if (C.respuestaConDatos(md.replace(/800 911 2000|\b911\b|\b24\b/g, ''))) fallos.push(`KB ${q}`);
          const a = String((await ragTurno(q)).answer);
          if (C.respuestaConDatos(a.replace(/800 911 2000|\b911\b|\b24\b/g, '')) || /GEMINI_API_KEY/.test(a)) fallos.push(`RAG ${q}`);
        }
      }
    }
  }
  assert.deepEqual(fallos.slice(0, 20), [], `${fallos.length} consultas con cifras`);
});
