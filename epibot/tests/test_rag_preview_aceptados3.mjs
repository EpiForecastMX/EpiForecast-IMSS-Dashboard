/**
 * Hallazgos de la API RAG real de la preview 98 (15-nov-2026, ROOT_FEEDBACK «Fable5completado y hallazgos RAG»):
 *
 * 1. «¿El mal del pinto está validado y qué tan preciso fue su pronóstico?» fue a la recuperación semántica y
 *    contestó que no existía información de precisión: omitió el error alto de la prueba retrospectiva de 2025 y el
 *    cambio de nivel de 2024 que declara su ficha, y trajo pasajes de las infecciones intestinales y del carril legacy.
 * 2. «¿Hay pronóstico de vulvovaginitis para hombres?» recuperó el «meta_modo» de Prophet de «Construcción del
 *    dashboard» (carril legacy) aunque el release no tiene desglose por sexo.
 *
 * El estado de un aceptado sale de su vista y de su ficha publicada (no de cifras escritas en la función), y una
 * consulta que nombra releases del runner sólo recupera fragmentos de esos releases. Gemini se simula interceptando
 * `fetch`: el embedding de la consulta se fija al vector del pasaje legacy que contaminó la preview, para reproducir
 * la recuperación del fallo sin red ni clave.
 *
 * Contrafactual: RAG_MODULE=<ruta a una copia de la versión anterior dentro de netlify/functions/> node --test …
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';

const raiz = new URL('../../', import.meta.url);
const INDICE = JSON.parse(readFileSync(new URL('epibot/rag_index.json', raiz), 'utf8'));
const modulo = process.env.RAG_MODULE ? new URL(process.env.RAG_MODULE, `file://${process.cwd()}/`) : new URL('../netlify/functions/rag.mjs', import.meta.url);
const { default: handler } = await import(modulo.href);

const vectorDe = (pred) => {
  const i = INDICE.chunks.findIndex(pred);
  assert.ok(i >= 0, 'pasaje de referencia ausente del índice');
  return INDICE.vectors[i];
};
const LLAVES = vectorDe((c) => c.source === 'Construcción del dashboard' && c.title === 'Contrato de llaves');
const FALLBACK = vectorDe((c) => c.source === 'Reporte de resultados' && /fallback/.test(c.title));
const PROPHET = vectorDe((c) => c.source === 'Ficha técnica — Prophet');

/** Llama al handler con Gemini simulado; devuelve la respuesta JSON y el systemInstruction que recibió el generador. */
async function consultar(query, { vector = null, sinClave = false } = {}) {
  const previaFetch = globalThis.fetch;
  const previaClave = process.env.GEMINI_API_KEY;
  let sistema = null;
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    const cuerpo = init.body ? JSON.parse(init.body) : {};
    const resp = (obj) => new Response(JSON.stringify(obj), { status: 200, headers: { 'content-type': 'application/json' } });
    if (u.includes(':embedContent')) return resp({ embedding: { values: vector || LLAVES } });
    if (u.includes(':generateContent')) {
      if (cuerpo.systemInstruction) sistema = cuerpo.systemInstruction.parts.map((p) => p.text).join('');
      return resp({ candidates: [{ content: { role: 'model', parts: [{ text: 'respuesta simulada' }] }, finishReason: 'STOP' }] });
    }
    throw new Error(`fetch inesperado: ${u}`);
  };
  if (sinClave) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = 'clave-de-prueba';
  try {
    const res = await handler(new Request('http://localhost/.netlify/functions/rag', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-nf-client-connection-ip': `t-${Math.random()}` },
      body: JSON.stringify({ query }),
    }));
    return { status: res.status, r: await res.json(), sistema };
  } finally {
    globalThis.fetch = previaFetch;
    if (previaClave === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previaClave;
  }
}

// Texto visible de la ficha publicada, para comprobar que las cifras de la respuesta salen de ahí.
const fichaPlana = (pag) => readFileSync(new URL(pag, raiz), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '')
  .replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');

test('mal del pinto: el estado declara error alto de la prueba y cambio de nivel de 2024, desde su ficha y sin modelo', async () => {
  const { r, sistema } = await consultar('¿El mal del pinto está validado y qué tan preciso fue su pronóstico?', { vector: FALLBACK });
  assert.equal(sistema, null, 'no debe pasar por Gemini');
  assert.equal(r.retrieval, 'vista');
  const a = r.answer;
  assert.match(a, /todavía no está validado/);
  assert.doesNotMatch(a, /(?<!no )(está|fue) validad[oa]/);
  assert.match(a, /sMAPE 111\.3, frente a 115\.8 del control estacional/);
  assert.match(a, /no que el pronóstico sea preciso/);
  assert.match(a, /Cambio de nivel en 2024\./);
  assert.match(a, /280 en 2023 a 133 en 2024 y 78 en 2025/);
  assert.match(a, /no debe leerse como menor incidencia/);
  assert.match(a, /0 de 4 semanas/);
  assert.doesNotMatch(a, /no existe información sobre su precisión/);
  // Ninguna cifra de error prospectiva: sólo la de la prueba de 2025.
  assert.doesNotMatch(a, /fuera de muestra (fue|de) \d/);
  // Las cifras están en la ficha publicada, no inventadas por la función.
  const ficha = fichaPlana('mal_del_pinto_a67.html');
  for (const cifra of ['sMAPE 111.3, frente a 115.8', '280 en 2023 a 133 en 2024 y 78 en 2025', '25 de las 30 entidades']) {
    assert.ok(ficha.includes(cifra), cifra);
    assert.ok(a.includes(cifra), cifra);
  }
  assert.deepEqual(r.sources.map((s) => s.section), ['mal_del_pinto_a67']);
});

test('la función no escribe a mano las cifras del mal del pinto', () => {
  const src = readFileSync(modulo, 'utf8');
  for (const cifra of ['111.3', '115.8', '133 en 2024']) assert.ok(!src.includes(cifra), cifra);
});

test('mal del pinto por la vía semántica: sólo pasajes propios y sus notas de error y nivel en el contexto', async () => {
  const { r, sistema } = await consultar('¿Cuántos casos de mal del pinto se esperan en Chiapas?', { vector: FALLBACK });
  assert.equal(r.retrieval, 'semantic');
  assert.ok(r.sources.length > 0);
  for (const s of r.sources) assert.equal(s.section, 'mal_del_pinto_a67', `${s.source} — ${s.title}`);
  assert.ok(sistema);
  assert.match(sistema, /Error alto aunque aceptado:/);
  assert.match(sistema, /Cambio de nivel en 2024\./);
  assert.doesNotMatch(sistema, /fallback.{0,10}regional/i);
});

test('vulvovaginitis en hombres: sin pasajes legacy de meta_modo/Prophet y con la falta de desglose por sexo', async () => {
  const { r, sistema } = await consultar('¿Hay pronóstico de vulvovaginitis para hombres?', { vector: LLAVES });
  assert.equal(r.retrieval, 'semantic');
  assert.ok(r.sources.length > 0);
  for (const s of r.sources) {
    assert.equal(s.section, 'vulvovaginitis_n76', `${s.source} — ${s.title}`);
    assert.notEqual(s.source, 'Construcción del dashboard');
  }
  assert.doesNotMatch(sistema, /meta_modo/);
  assert.match(sistema, /no desglosa sexo; sus 37 series publicadas son por entidad y nacional, así que no existe pronóstico para hombres/);
});

test('comparación tifoidea-paratifoidea: sólo pasajes de los dos releases nombrados', async () => {
  const { r } = await consultar('¿La fiebre tifoidea y la fiebre paratifoidea son lo mismo?', { vector: PROPHET });
  assert.ok(r.sources.length > 0);
  const secciones = new Set(r.sources.map((s) => s.section));
  for (const s of secciones) assert.ok(['tifoidea_a01', 'paratifoidea_a011'].includes(s), s);
  assert.equal(secciones.size, 2);
});

test('sin release nombrado o con un padecimiento legacy, la recuperación no se acota', async () => {
  const { r } = await consultar('¿Cómo se construyó el dashboard y qué es meta_modo?', { vector: LLAVES });
  assert.ok(r.sources.some((s) => s.source === 'Construcción del dashboard'));
  const { r: r2 } = await consultar('¿Qué motor usa la depresión y cuál la vulvovaginitis?', { vector: LLAVES });
  assert.ok(r2.sources.some((s) => s.source === 'Construcción del dashboard'));
});

test('otros aceptados: estado desde vista y ficha, sin métricas que su página no publique', async () => {
  const { r } = await consultar('¿está validada la vulvovaginitis?', { sinClave: true });
  assert.equal(r.retrieval, 'vista');
  assert.match(r.answer, /Superó la prueba de 2025 frente al control estacional\./);
  assert.match(r.answer, /todavía no está validado/);
  assert.doesNotMatch(r.answer, /sMAPE/);
  const p = (await consultar('¿es confiable la fiebre paratifoidea?', { sinClave: true })).r.answer;
  assert.match(p, /Un pico que la fuente conserva\./);
  assert.equal(p.match(/Un pico que la fuente conserva\./g).length, 1, 'el aviso de la fuente no se duplica');
});

test('controles y crisis no cambian', async () => {
  const { r } = await consultar('¿es confiable la leptospirosis?', { sinClave: true });
  assert.equal(r.retrieval, 'vista');
  assert.match(r.answer, /control estacional, no validado/);
  assert.match(r.answer, /130, 65 y 29 casos de Veracruz/);
  const { r: c } = await consultar('¡Tengo ganas de morir!', { sinClave: true });
  assert.match(c.answer, /800 911 2000/);
});

test('netlify.toml empaqueta las fichas que lee la función', () => {
  // Sin la ficha en included_files, en producción el estado de un aceptado vuelve a la recuperación semántica.
  const toml = readFileSync(new URL('netlify.toml', raiz), 'utf8');
  const inc = (toml.match(/included_files\s*=\s*\[([^\]]*)\]/) || [])[1] || '';
  assert.match(inc, /"[^"]*\.html"/, 'included_files no incluye las fichas .html de la raíz');
});
