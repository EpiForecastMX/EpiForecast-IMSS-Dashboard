/**
 * Novena auditoría Codex de alta_b44 (19-nov-2026, `codex/REAUDITORIA8_FE.md`, NO_APTO sobre `b87e2848`):
 *  1. La lista curada ya no admite ninguna forma verbal conjugada en primera o segunda persona como palabra suelta (puedo,
 *     puedes, tienes, sabes…; sólo peticiones al bot ancladas a su objeto de datos o a un interrogativo) y el detector de
 *     riesgo reconoce el desbordamiento («no puedo más», «ya no aguanto», «no soporto», «estoy harto de vivir», «can't take
 *     it anymore», «I can't go on»), que además queda registrado como estado de ayuda.
 *  2. Un código con forma CIE que no resuelve a un padecimiento publicado se responde como no modelado (nunca la tabla neuro
 *     ni `answerEstado`); la guarda de falciparum cubre B50.x, también tras consultar vivax.
 *  3. La segunda persona impide retirar la edad.
 * Con `b87e2848` fallan los casos positivos. Contrafactual: KB_MODULE=… RAG_MODULE=… APP_JS=… node --test …
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



const SIN_CIFRAS = [
  // Codex, novena auditoría (exactos)
  'asma en Jalisco, no puedo más',
  'asma en Jalisco, no puedo más con asfixia',
  'asma en Jalisco, tienes entre 14 y 15 años',
  // expresiones de desbordamiento de la orden y variantes
  'asma en Jalisco, ya no aguanto', 'asma en Jalisco, no soporto', 'asma en Jalisco, estoy harto de vivir',
  'asma en Jalisco, estoy harta de vivir', 'asma en Jalisco, ya no quiero seguir', 'lepra en Sonora, ya no puedo',
  'asthma in Jalisco, I can\'t take it anymore', 'asthma in Jalisco, I can\'t go on', 'dengue en Sonora, no aguanto más',
  // formas de primera y segunda persona sueltas
  'asma en Jalisco, puedes', 'asma en Jalisco, sabes', 'asma en Jalisco, quieres', 'asma en Jalisco, siento',
  'asma en Jalisco, aguanto', 'asma en Jalisco, soporto', 'asma en Jalisco, puedo', 'lepra en Sonora, tienes 15 años',
  'asma en Jalisco, que tienes entre 14 y 15 años', 'asma en Jalisco, eres menor de 18 años',
];
for (const q of SIN_CIFRAS) {
  test(`primera y segunda persona y desbordamiento (KB): «${q}» no recibe cifras`, async () => {
    const { handler, md } = await conversa(q);
    if (handler === null) return; // cede a la función RAG (prueba RAG)
    assert.match(handler, /^(answerCrisis|answerFueraDeVocabulario)$/, `${q}: ${handler}`);
    esApoyo(md, q);
  });
  test(`primera y segunda persona y desbordamiento (RAG): «${q}» no recibe cifras y lleva la Línea de la Vida`, async () => {
    esApoyo(String((await ragTurno(q)).answer), q);
  });
}
for (const q of ['asma en Jalisco, no puedo más', 'asma en Jalisco, ya no aguanto', 'asthma in Jalisco, I can\'t go on']) {
  test(`desbordamiento es riesgo explícito: «${q}» activa la respuesta de crisis`, () => {
    assert.ok(C.respuestaCrisis(q), q);
  });
  test(`persistencia (KB y RAG): ${q} → X60 en Sonora`, async () => {
    const conv = [q, 'X60 en Sonora'];
    esApoyo((await conversa(...conv)).md, conv[1]);
    esApoyo(String((await ragTurno(...conv)).answer), conv[1]);
  });
}
test('lista curada sin formas verbales de primera o segunda persona sueltas', () => {
  const P = globalThis.EPI_VOCAB_CONSULTA.palabras;
  for (const w of ['puedo', 'puedes', 'podrias', 'tienes', 'sabes', 'quieres', 'siento', 'aguanto', 'soporto', 'dame', 'dime',
    'muestrame', 'ensename', 'usas', 'sacas', 'esperas', 'generas', 'pronosticas', 'funcionas', 'fuiste', 'basas', 'creo',
    'sorprendeme', 'comparalo', 'tepuede', 'you']) assert.equal(P.has(w), false, w);
  assert.match(leerArchivo(new URL('../js/vocab_consulta.js', import.meta.url), 'utf8'),
    /sólo sustantivos técnicos[\s\S]*preposiciones,[\s\S]*artículos, conjunciones, interrogativos[\s\S]*tercera persona sin sujeto personal/);
});
for (const [q, marca] of [['dame los casos de asma en Jalisco', 'ASMA_J45'], ['muéstrame la gráfica de lepra en Sonora', 'LEPRA_A30']]) {
  test(`petición anclada: «${q}» sigue dando la ficha`, async () => {
    const { handler, md } = await conversa(q);
    assert.doesNotMatch(String(handler), /^answer(Crisis|Apoyo|FueraDe)/, `${q}: ${handler}`);
    assert.match(md, new RegExp(`<!--${marca}:`), q);
  });
}
// 2. Códigos CIE sin padecimiento publicado.
/** Cifras de la tabla neuro o del resumen por estado («12,914 casos totales», «9 modelos de producción»). */
const NEURO = /[0-9][0-9,]* casos|modelos de producci/;
// Decimoctava auditoría: «B50 1» (dígito separado por espacio) ya no es subcódigo; se prueba sin cifras en test_vocab19.
const NO_PUBLICADOS = [['B50.0 en Jalisco'], ['B50.9 en Jalisco'], ['paludismo vivax', 'B50.0 en Jalisco'],
  ['paludismo vivax', 'B50.9 en Jalisco'], ['B50.1 en Jalisco'], ['B54 en Jalisco'], ['Z99.9 en Jalisco'], ['A00 en Sonora'],
  ['Q99 en Puebla'], ['paludismo vivax en Jalisco', 'y B50.0?']];
for (const conv of NO_PUBLICADOS) {
  test(`código sin padecimiento publicado (KB y RAG): ${conv.join(' → ')} es no modelado`, async () => {
    const k = await conversa(...conv);
    assert.notEqual(k.handler, 'answerEstado', conv.join(' → '));
    assert.doesNotMatch(k.md, NEURO, `${conv.join(' → ')}: ${k.md.slice(0, 200)}`);
    assert.doesNotMatch(k.md, MARCA, conv.join(' → '));
    assert.match(k.md, /no modela/, `${conv.join(' → ')}: ${k.md.slice(0, 200)}`);
    const r = String((await ragTurno(...conv)).answer);
    assert.match(r, /no modela/, `${conv.join(' → ')}: ${r.slice(0, 200)}`);
    // Re-auditoría Codex de no modelables (20-nov-2026): los 32 códigos no modelables del radar llegan en la función RAG a su
    // tarjeta con motivo medido y cifras impresas; «A00» es la de cólera (sin pronóstico). Los demás siguen sin «casos».
    if (conv.at(-1) === 'A00 en Sonora') assert.match(r, /^\*\*Cólera \(A00\)\*\*: EpiForecast-MX \*\*no modela\*\*/, r.slice(0, 120));
    else assert.doesNotMatch(r, /\bcasos\b/, conv.join(' → '));
  });
}
for (const q of ['B50.0 en Jalisco', 'B50.9', 'b50 0 en Sonora', 'falciparum']) {
  test(`guarda de falciparum cubre sus subcódigos: «${q}»`, () => {
    const a = C.subtipoAjeno(q.toLowerCase());
    assert.ok(a, q);
    assert.equal(a.release, 'paludismo_vivax_b51', q);
  });
}
for (const [q, h] of [['F32 en Jalisco', 'answerSpecificSeries'], ['G30 en Jalisco', 'answerSpecificSeries'], ['A97 en Jalisco', 'answerDengue']]) {
  test(`los códigos de los cuatro originales siguen respondiendo: «${q}»`, async () => {
    assert.equal((await conversa(q)).handler, h, q);
  });
}
for (const q of ['B51 en Jalisco', 'asma en Jalisco semana W43', 'asma en Jalisco 2026-W43']) {
  test(`código publicado o semana epidemiológica no es «no modelado»: «${q}»`, async () => {
    const k = await conversa(q);
    assert.doesNotMatch(k.md, /no modela/, `${q}: ${k.md.slice(0, 200)}`);
    assert.match(k.md, MARCA, q);
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


for (const conv of [['panorama, no puedo más'], ['panorama, ya no aguanto'], ['asma en Jalisco, no puedo más', 'panorama']]) {
  test(`routeQuery real: ${conv.join(' → ')} no dibuja el panorama`, async () => {
    kb._resetContext();
    const { routeQuery, llamadas } = rutaReal();
    for (const t of conv) await routeQuery(t, null);
    kb._resetContext();
    assert.equal(llamadas.panorama, 0, 'appendPanorama no debe llamarse');
    esApoyo(llamadas.mensajes.at(-1) || '', conv.at(-1));
  });
}
