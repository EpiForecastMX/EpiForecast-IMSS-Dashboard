/**
 * Dos fallos reales de la API de la preview 82cf0812 (ROOT_FEEDBACK «MEDICIONES FINAL 82cf», 15-nov-2026):
 *
 * 1. «plaguicidas nacional» fue a la recuperación semántica y Gemini omitió la nota D7 («no distingue intención»),
 *    aunque el contexto la traía. La nota debe salir siempre para T60 y T58, también en streaming, sin depender del
 *    modelo y leída de los avisos generados (avisos_fuente.js).
 * 2. «meningitis meningocócica nacional» fue a la recuperación semántica y Gemini respondió los 861 casos del síndrome
 *    meníngeo, confundiendo G00.0 y G00.1 con la meningocócica. Una meningitis de tipo nombrado recibe un texto fijo,
 *    sin recuperación, modelo ni cifras, en la función RAG y en el EpiBot.
 *
 * Gemini se simula interceptando `fetch`: el generador devuelve exactamente las respuestas que dio la preview (sin la
 * nota D7 y con los 861 casos), así que con la versión anterior estas pruebas fallan.
 * Contrafactual: RAG_MODULE=<copia de la versión anterior dentro de netlify/functions/> node --test …
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';

const raiz = new URL('../../', import.meta.url);
const INDICE = JSON.parse(readFileSync(new URL('epibot/rag_index.json', raiz), 'utf8'));
const modulo = process.env.RAG_MODULE ? new URL(process.env.RAG_MODULE, `file://${process.cwd()}/`) : new URL('../netlify/functions/rag.mjs', import.meta.url);
const rag = await import(modulo.href);
const handler = rag.default;

const SIN_D7 = 'El pronóstico nacional para la Intoxicación por plaguicidas (T60) contempla un total de 2,512 casos [3].';
const CON_861 = 'Respecto al Síndrome meníngeo, las variantes de meningitis meningocócica correspondientes a los códigos G00.0 y '
  + 'G00.1 no se incluyen. La proyección abarca 52 semanas con un total de 861 casos pronosticados [1].';
const vectorDe = (pred) => INDICE.vectors[INDICE.chunks.findIndex(pred)];
const V_T60 = vectorDe((c) => /^release:plaguicidas_t60:/.test(c.id || ''));
const V_G00 = vectorDe((c) => /^release:sindrome_meningeo_g00:/.test(c.id || ''));

async function consultar(query, { texto, vector, stream = false }) {
  const previaFetch = globalThis.fetch;
  const previaClave = process.env.GEMINI_API_KEY;
  let generaciones = 0;
  globalThis.fetch = async (url) => {
    const u = String(url?.url ?? url);
    const resp = (obj) => new Response(JSON.stringify(obj), { status: 200, headers: { 'content-type': 'application/json' } });
    const cand = { candidates: [{ content: { role: 'model', parts: [{ text: texto }] }, finishReason: 'STOP', index: 0 }] };
    if (u.includes(':embedContent')) return resp({ embedding: { values: vector } });
    if (u.includes(':streamGenerateContent')) {
      generaciones++;
      return new Response(`data: ${JSON.stringify(cand)}\r\n\r\n`, { status: 200, headers: { 'content-type': 'text/event-stream' } });
    }
    if (u.includes(':generateContent')) {
      generaciones++;
      // contextualizeQuery y rerank también llaman a generateContent: sin historial no se reescribe la consulta.
      return resp(cand);
    }
    throw new Error(`fetch inesperado: ${u}`);
  };
  process.env.GEMINI_API_KEY = 'clave-de-prueba';
  try {
    const res = await handler(new Request('http://localhost/.netlify/functions/rag', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-nf-client-connection-ip': `m-${Math.random()}` },
      body: JSON.stringify({ query, stream }),
    }));
    const txt = await res.text();
    if (!stream) return { status: res.status, r: JSON.parse(txt), generaciones };
    const eventos = txt.trim().split('\n').map((l) => JSON.parse(l));
    return { status: res.status, answer: eventos.filter((e) => e.type === 'delta').map((e) => e.text).join(''), eventos, generaciones };
  } finally {
    globalThis.fetch = previaFetch;
    if (previaClave === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previaClave;
  }
}

const D7 = /\*\*No distingue intención\.\*\* El código T60 describe la naturaleza de la lesión/;
const D7_T58 = /\*\*No distingue intención\.\*\* El código T58/;

test('A1: «plaguicidas nacional» lleva la nota D7 aunque el modelo la omita (sin streaming)', async () => {
  const { status, r } = await consultar('plaguicidas nacional', { texto: SIN_D7, vector: V_T60 });
  assert.equal(status, 200);
  assert.ok(r.answer.startsWith(SIN_D7), 'conserva la respuesta generada');
  assert.match(r.answer, D7);
  assert.match(r.answer, /800 911 2000/);
});

test('A1: también en streaming, como un delta final', async () => {
  const { status, answer, eventos } = await consultar('plaguicidas nacional', { texto: SIN_D7, vector: V_T60, stream: true });
  assert.equal(status, 200);
  assert.match(answer, D7);
  assert.equal(eventos.at(-1).type, 'done');
});

test('A1: monóxido también; la nota no se duplica si el modelo ya la dio, y no alcanza a otros releases', async () => {
  assert.match((await consultar('monóxido de carbono nacional', { texto: 'Pronóstico nacional del monóxido.', vector: V_T60 })).r.answer, D7_T58);
  const ya = 'Pronóstico de plaguicidas. **No distingue intención.** El código T60 describe…';
  assert.equal((await consultar('plaguicidas nacional', { texto: ya, vector: V_T60 })).r.answer, ya);
  const otro = (await consultar('síndrome meníngeo nacional', { texto: 'Pronóstico del síndrome meníngeo.', vector: V_G00 })).r.answer;
  assert.doesNotMatch(otro, /No distingue intención/);
});

// alta_b44 (19-nov-2026): la meningitis meningocócica (A39.0) tiene release propio; la meningitis por Haemophilus (G00.0) y
// la neumocócica (G00.1) se cuentan dentro de sus bloques invasivos; la tuberculosa (A17.0) tiene release propio desde el lote 6. Todas
// reciben un texto fijo sin modelo ni cifras del síndrome meníngeo, salvo la meningocócica, que responde su release.
const TEXTO_FIJO = /no la pronostica|no forma parte del \*\*síndrome meníngeo\*\*/;
test('M: meningitis por Haemophilus o neumocócica reciben un texto fijo, sin modelo ni cifras del síndrome', async () => {
  for (const q of ['meningitis neumocócica en Jalisco', 'meningitis por Haemophilus',
    'meningitis G00.0']) {
    for (const stream of [false, true]) {
      const out = await consultar(q, { texto: CON_861, vector: V_G00, stream });
      assert.equal(out.generaciones, 0, `${q}: no debe llamar al modelo`);
      const a = stream ? (out.eventos?.[0]?.answer ?? out.answer) : out.r.answer;
      const texto = stream ? JSON.stringify(out.eventos ?? out) : a;
      assert.doesNotMatch(texto, /861/, q);
      assert.match(texto, TEXTO_FIJO, q);
      assert.doesNotMatch(texto.replace(/\(\.\.\/[a-z0-9_]+\.html\)/g, '').replace(/[A-Z]\d{2}(\.\d)?/g, ''), /\d/, q);
    }
  }
});

test('M: las consultas propias del síndrome meníngeo y «meningitis» a secas no cambian de ruta', async () => {
  assert.equal(rag.guardaMeningitisTipoRag('síndrome meníngeo nacional'), null);
  assert.equal(rag.guardaMeningitisTipoRag('meningitis en Jalisco'), null);
  assert.equal(rag.guardaMeningitisTipoRag('síndrome meníngeo y meningitis meningocócica'), null);
  // La meningocócica ya no es un texto fijo: la resuelve el alias de su release (o la aclaración de «meningococo»).
  assert.equal(rag.guardaMeningitisTipoRag('meningitis meningocócica nacional'), null);
  assert.equal(rag.guardaMeningitisTipoRag('enfermedad meningocócica en México'), null);
});

test('M: el EpiBot responde el mismo texto fijo, sin cifras de ningún pronóstico', async () => {
  const K = readFileSync(new URL('../knowledge.json', import.meta.url), 'utf-8');
  const previa = globalThis.fetch;
  globalThis.fetch = async (u) => {
    const m = String(u).match(/publication\/([a-z0-9_]+)\/vista\.json/);
    return { ok: true, json: async () => JSON.parse(m ? readFileSync(new URL(`../../publication/${m[1]}/vista.json`, import.meta.url), 'utf-8') : K) };
  };
  try {
    const kb = await import('../js/kb.js');
    const d = await kb.loadKnowledge(); await d.obesidad_pendiente;
    assert.equal(kb.MENINGITIS_TEXTO, rag.MENINGITIS_TEXTO_RAG, 'paridad de texto con la función RAG');
    assert.equal(kb.MENINGITIS_HIB_TEXTO, rag.MENINGITIS_HIB_TEXTO_RAG, 'paridad de texto con la función RAG');
    assert.equal(kb.MENINGITIS_NEUMO_TEXTO, rag.MENINGITIS_NEUMO_TEXTO_RAG, 'paridad de texto con la función RAG');
    kb._resetContext();
    const mc = await kb.answerWithTrace('meningitis meningocócica nacional');
    assert.match(String(mc.response), /MENINGOCOCICA_A39/);
    assert.doesNotMatch(String(mc.response), /SINDROME_MENINGEO_G00/);
    for (const q of ['meningitis neumocócica en Jalisco']) {
      kb._resetContext();
      const r = await kb.answerWithTrace(q);
      assert.equal(r.handler, 'answerMeningitisTipo', q);
      assert.doesNotMatch(String(r.response), /casos totales|SINDROME_MENINGEO_G00/, q);
    }
    // Lote 6: la meningitis tuberculosa (A17.0) responde su propio control, nunca el síndrome meníngeo.
    kb._resetContext();
    const tb = await kb.answerWithTrace('meningitis tuberculosa en Chiapas');
    assert.match(String(tb.response), /<!--MENINGITIS_TUBERCULOSA_A170:/);
    assert.doesNotMatch(String(tb.response), /SINDROME_MENINGEO_G00/);
    kb._resetContext();
    assert.notEqual((await kb.answerWithTrace('síndrome meníngeo en Jalisco')).handler, 'answerMeningitisTipo');
    kb._resetContext();
    assert.equal((await kb.answerWithTrace('meningitis en Jalisco')).handler, 'answerAliasAmbiguo');
  } finally {
    globalThis.fetch = previa;
  }
});

// Misma familia (ROOT_FEEDBACK «misma familia negativa»): códigos solos, «G00» a secas y el nombre publicado completo.
test('M: G00.0 y G00.1 a secas reciben el texto fijo, sin modelo ni cifras; «G00» a secas pide precisar', async () => {
  for (const [q, bloque] of [['G00.0 nacional', /haemophilus_a41/], ['G00.1 nacional', /neumococo_a40/], ['g00 0 en Jalisco', /haemophilus_a41/]]) {
    const out = await consultar(q, { texto: CON_861, vector: V_G00 });
    assert.equal(out.generaciones, 0, q);
    assert.match(out.r.answer, TEXTO_FIJO, q);
    assert.match(out.r.answer, bloque, q);
    assert.doesNotMatch(out.r.answer, /861/, q);
  }
  const g00 = await consultar('G00 nacional', { texto: CON_861, vector: V_G00 });
  assert.equal(g00.generaciones, 0);
  assert.match(g00.r.answer, /No doy cifras hasta saber cuál consultas/);
  assert.doesNotMatch(g00.r.answer, /861/);
});

test('M: el nombre publicado completo resuelve su release y no se lee como petición de un subtipo excluido', async () => {
  for (const q of ['Síndrome meníngeo (G00-G03, excepto G00.0 y G00.1) nacional', 'síndrome meníngeo G00-G03 excepto G00.0 y G00.1']) {
    const out = await consultar(q, { texto: 'Pronóstico del síndrome meníngeo.', vector: V_G00 });
    assert.equal(out.status, 200, q);
    assert.doesNotMatch(out.r.answer, /no modela el código G00\.0|no pronostica la meningitis/, q);
    assert.equal(out.r.answer, 'Pronóstico del síndrome meníngeo.', q);
    assert.ok(out.r.sources.length && out.r.sources.every((s) => s.section === 'sindrome_meningeo_g00'), q);
  }
  assert.equal((await consultar('G00.2 nacional', { texto: 'x', vector: V_G00 })).r.answer, 'x', 'G00.2 es del síndrome');
});

test('M: en el EpiBot, códigos solos sin cifras y nombre completo con su release', async () => {
  const K = readFileSync(new URL('../knowledge.json', import.meta.url), 'utf-8');
  const previa = globalThis.fetch;
  globalThis.fetch = async (u) => {
    const m = String(u).match(/publication\/([a-z0-9_]+)\/vista\.json/);
    return { ok: true, json: async () => JSON.parse(m ? readFileSync(new URL(`../../publication/${m[1]}/vista.json`, import.meta.url), 'utf-8') : K) };
  };
  try {
    const kb = await import('../js/kb.js');
    const d = await kb.loadKnowledge(); await d.obesidad_pendiente;
    assert.equal(kb.MENINGITIS_G00_TEXTO, rag.MENINGITIS_G00_TEXTO_RAG, 'paridad de texto');
    for (const q of ['G00.0 nacional', 'G00.1 nacional', 'G00 nacional']) {
      kb._resetContext();
      const r = await kb.answerWithTrace(q);
      assert.equal(r.handler, 'answerMeningitisTipo', q);
      assert.doesNotMatch(String(r.response), /casos totales|SINDROME_MENINGEO_G00/, q);
    }
    for (const q of ['Síndrome meníngeo (G00-G03, excepto G00.0 y G00.1) nacional', 'síndrome meníngeo G00-G03 excepto G00.0 y G00.1']) {
      kb._resetContext();
      assert.match(String((await kb.answerWithTrace(q)).response), /SINDROME_MENINGEO_G00/, q);
    }
  } finally {
    globalThis.fetch = previa;
  }
});
