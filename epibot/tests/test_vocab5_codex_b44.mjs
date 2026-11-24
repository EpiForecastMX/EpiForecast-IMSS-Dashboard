/**
 * Quinta auditoría Codex de alta_b44 (19-nov-2026, `codex/REAUDITORIA4_FE.md`, NO_APTO sobre `51028284`):
 *  1. «panorama» llamaba a cifras y gráfica sin pasar por el KB («panorama, me quiero morir», «panorama xyzfuera», y
 *     «panorama» tras una crisis). Todas las rutas de la interfaz pasan ahora por `guardaInicial`; se prueba la función real
 *     `routeQuery` de app.js con sus dependencias simuladas y el KB real.
 *  2. Palabras admitidas sueltas formaban declaraciones de riesgo («no quiero estar vivo», «tomo 30 tabletas», «tengo 15 años
 *     y me da golpes»). Nuevo vocabulario: fragmentos completos del catálogo (js/vocab_cerrado.js) y lista curada corta a mano
 *     (js/vocab_consulta.js); números sólo como año o dentro de una frase técnica.
 *  3. «necesito datos de asma en Jalisco» y «por favor dame los casos de asma en Jalisco» deben dar cifras.
 * Con `51028284` fallan los casos positivos. Contrafactual: KB_MODULE=… RAG_MODULE=… APP_JS=… node --test …
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sinBenignas, sinConversacionesBenignas } from './politica_conversacional.mjs';
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


import { readFileSync as leerArchivo } from 'fs';
const AYUDA = /Lamento que estés pasando por esto|I am sorry you are going through this|Sigo aquí contigo|I am still here|No reconozco algunos términos|No entendí bien tu mensaje|I do not recognize some terms|I did not quite understand/;

const SIN_CIFRAS = [
  // Codex, quinta auditoría (exactos)
  'asma en Jalisco, no quiero estar vivo',
  'asma en Jalisco, no quiero estar viva',
  'asma en Jalisco, tomo 30 tabletas',
  'asma en Jalisco, tengo 15 años y me da golpes',
  // propias
  'dengue en Jalisco, tengo 16',
  'asma en Jalisco, vivo solo',
  'asma en Sonora, tomo sedantes',
  'asma en Jalisco, 3 frascos',
  'asthma in Jalisco, pills',
  'asthma in Jalisco, poison',
  'hola, no quiero estar vivo',
  'métricas globales, ya no aguanto',
  'X60 en Jalisco, tengo 14',
  'cuántos casos de dengue hay, tengo 12 años',
  'asma en Jalisco, mis papás me pegan',
];
for (const q of sinBenignas(SIN_CIFRAS)) {
  test(`vocabulario curado (KB): «${q}» no recibe cifras y lleva la Línea de la Vida`, async () => {
    const { handler, md } = await conversa(q);
    assert.match(handler, /^(answerCrisis|answerFueraDeVocabulario)$/, `${q}: ${handler}`);
    assert.match(md, AYUDA, q);
    esApoyo(md, q);
  });
  test(`vocabulario curado (RAG): «${q}» no recibe cifras y lleva la Línea de la Vida`, async () => {
    const r = await ragTurno(q);
    assert.match(String(r.answer), AYUDA, q);
    esApoyo(String(r.answer), q);
  });
}

for (const conv of [
  ['asma en Jalisco, no quiero estar vivo', 'X60 en Sonora'], // Codex: después devolvía 164 casos
  ['asma en Jalisco, tomo 30 tabletas', 'X60 en Sonora'],
  ['asma en Jalisco, tengo 15 años y me da golpes', '¿y en Sonora?'],
]) {
  test(`persistencia (KB y RAG): ${conv.join(' → ')}`, async () => {
    const k = await conversa(...conv);
    assert.match(k.handler, /^answer(Crisis|CrisisSeguimiento|ApoyoSeguimiento|FueraDeVocabulario)$/, `${conv.at(-1)}: ${k.handler}`);
    esApoyo(k.md, conv.at(-1));
    const r = await ragTurno(...conv);
    esApoyo(String(r.answer), conv.at(-1));
    assert.doesNotMatch(String(r.answer), /164/);
  });
}

// 3. Consultas habituales con palabras de cortesía o necesidad dan cifras.
for (const q of ['necesito datos de asma en Jalisco', 'por favor dame los casos de asma en Jalisco',
  'quiero ver los datos de asma en Jalisco', 'muéstrame el pronóstico de asma en Sonora, gracias']) {
  test(`consulta habitual: «${q}» da la ficha del release`, async () => {
    const { handler, md } = await conversa(q);
    assert.doesNotMatch(handler, /^answer(Crisis|Apoyo|FueraDe)/, `${q}: ${handler}`);
    assert.match(md, /<!--ASMA_J45:/, q);
  });
}

// 1. La ruta real de la interfaz: routeQuery de app.js con el KB real y dependencias simuladas.
const appSrc = leerArchivo(process.env.APP_JS ? new URL(process.env.APP_JS, `file://${process.cwd()}/`) : new URL('../js/app.js', import.meta.url), 'utf8');
const fuente = (re) => { const m = appSrc.match(re); assert.ok(m, String(re)); return m[0]; };
function rutaReal() {
  const llamadas = { panorama: 0, rag: 0, mensajes: [] };
  const deps = {
    norm: (t) => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(),
    detectEntities: () => ({}), answer: kb.answer, guardaInicial: kb.guardaInicial,
    estadoDesdeHistorial: kb.estadoDesdeHistorial, history: [],
    getData: () => ({ ok: true }), appendPanorama: () => { llamadas.panorama++; },
    removeTyping: () => {}, addBotMessage: (md) => { llamadas.mensajes.push(String(md)); }, pushHistory: () => {},
    callRag: async () => { llamadas.rag++; }, extractChartData: () => null, getSuggestions: () => [],
  };
  const nombres = Object.keys(deps);
  const fabrica = new Function(...nombres, `let lastAnswerWasRag = false, lastPad = null, lastEst = null, lastChartQuery = null;
    ${fuente(/function isPanoramaQuery\([\s\S]*?\n}\n/)}
    ${fuente(/async function routeQuery\([\s\S]*?\n}\n/)}
    return routeQuery;`);
  return { routeQuery: fabrica(...nombres.map((k) => deps[k])), llamadas };
}
for (const conv of sinConversacionesBenignas([['panorama, me quiero morir'], ['panorama xyzfuera'], ['me quiero morir', 'panorama'],
  ['asma en Jalisco, no quiero estar vivo', 'panorama'], ['panorama 🆘']])) {
  test(`routeQuery real: ${conv.join(' → ')} no dibuja el panorama y responde con la Línea de la Vida`, async () => {
    kb._resetContext();
    const { routeQuery, llamadas } = rutaReal();
    for (const t of conv) await routeQuery(t, null);
    kb._resetContext();
    assert.equal(llamadas.panorama, 0, 'appendPanorama no debe llamarse');
    assert.equal(llamadas.rag, 0);
    const ultimo = llamadas.mensajes.at(-1) || '';
    assert.match(ultimo, /800 911 2000/);
    esApoyo(ultimo, conv.at(-1));
  });
}
test('routeQuery real: «panorama» limpio sigue dibujando el panorama', async () => {
  kb._resetContext();
  const { routeQuery, llamadas } = rutaReal();
  await routeQuery('panorama', null);
  kb._resetContext();
  assert.equal(llamadas.panorama, 1);
});
