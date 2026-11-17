/**
 * Regresión focal de producción (16-17 nov 2026): atribución temporal de métricas de `vista.json` vs prueba
 * retrospectiva única (`test_2025`), distinción entre portafolio rechazado y control estacional publicado (no
 * validado), herencia conversacional antes de guardas clínicas/alcance y proveniencia en contexto/snippets semánticos.
 *
 * Contrafactual:
 *   RAG_MODULE=../../../before/epibot/netlify/functions/rag.mjs node --import ./tests_focal/loader.mjs --test after/epibot/tests/test_rag_vista_periodos.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const raiz = new URL('../../', import.meta.url);
const INDICE = JSON.parse(readFileSync(new URL('epibot/rag_index.json', raiz), 'utf8'));
const VISTA_A51 = JSON.parse(readFileSync(new URL('publication/sifilis_adquirida_a51/vista.json', raiz), 'utf8'));
const VISTA_PINTO = JSON.parse(readFileSync(new URL('publication/mal_del_pinto_a67/vista.json', raiz), 'utf8'));
const moduloUrl = process.env.RAG_MODULE
  ? new URL(process.env.RAG_MODULE, `file://${process.cwd()}/`)
  : new URL('../netlify/functions/rag.mjs', import.meta.url);
const { default: handler } = await import(moduloUrl.href);

const ent = (n) => Math.round(Number(n)).toLocaleString('en-US');
const pct = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
const semana = ([a, s]) => `${a}-W${String(s).padStart(2, '0')}`;

const idxA51 = INDICE.chunks.findIndex((c) => c.section === 'sifilis_adquirida_a51');
const VEC_A51 = idxA51 >= 0 ? INDICE.vectors[idxA51] : new Array(768).fill(0.01);

const HISTORIA_REAL_JALISCO = [
  { role: 'user', text: '¿Cuántos casos de sífilis adquirida A51-A53 se pronostican en México en las 52 semanas?' },
  {
    role: 'assistant',
    text: 'El pronóstico total de **sífilis adquirida** (A51-A53) para el periodo de 52 semanas, comprendido entre la semana epidemiológica 2026-W43 y la 2027-W42, es de **23,405 casos** [3].\n\nEs fundamental precisar que este resultado corresponde a un modelo de control estacional (naive estacional con rezago de 52 semanas) [1][2]. Este portafolio no fue validado, ya que fue rechazado por el gate de aceptación y carece de bandas de incertidumbre o intervalos de confianza [1][3].',
  },
];

/**
 * Ejecuta `handler` con clave presente y Gemini simulado de forma determinista (nunca falla por quota/red).
 * Cuando el pipeline cae en generación LLM sin contrato temporal explícito en `systemInstruction`, reproduce
 * la confusión real observada en producción al leer el pasaje estatal de `rag_index.json`.
 */
async function consultar(query, { history = [], sinClave = false, vector = VEC_A51 } = {}) {
  const prevFetch = globalThis.fetch;
  const prevKey = process.env.GEMINI_API_KEY;
  let sistema = null;
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    const body = init.body ? JSON.parse(init.body) : {};
    const ok = (obj) => new Response(JSON.stringify(obj), { status: 200, headers: { 'content-type': 'application/json' } });
    if (u.includes(':embedContent')) return ok({ embedding: { values: vector } });
    if (u.includes(':generateContent')) {
      const promptUsr = (body.contents || []).map((c) => (c.parts || []).map((p) => p.text || '').join(' ')).join('\n');
      if (!body.systemInstruction) {
        // Llamada de contextualizeQuery (reescritura multi-turno).
        if (/jalisco/i.test(query)) return ok({ candidates: [{ content: { role: 'model', parts: [{ text: '¿Cuántos casos de sífilis adquirida A51-A53 se pronostican en Jalisco en las 52 semanas?' }] } }] });
        if (/embaraz/i.test(query)) return ok({ candidates: [{ content: { role: 'model', parts: [{ text: '¿Cuántos casos de sífilis adquirida se pronostican en mujeres embarazadas?' }] } }] });
        if (/bebe|newborn|recien/i.test(query)) return ok({ candidates: [{ content: { role: 'model', parts: [{ text: '¿Cuántos casos de sífilis adquirida se pronostican en bebés?' }] } }] });
        return ok({ candidates: [{ content: { role: 'model', parts: [{ text: query }] } }] });
      }
      sistema = body.systemInstruction.parts.map((p) => p.text).join('');
      const tieneContratoVista = /CONTRATO TEMPORAL Y CIFRAS DE LA VISTA PUBLICADA/.test(sistema);
      let texto = 'Respuesta generada sobre el contexto recuperado [1].';
      if (!tieneContratoVista && /jalisco/i.test(promptUsr)) {
        texto = 'Para el estado de Jalisco, el pronóstico para 2026-W43 a 2027-W42 es de **2,147 casos** [4]. El error de esta serie, evaluado retrospectivamente en una prueba de 2025, presentó un **sMAPE de 18.2 %** con un sesgo de **20.0 %** [4].';
      } else if (!tieneContratoVista && /23,405/.test(sistema)) {
        texto = 'El pronóstico nacional es de **23,405 casos** [3]. Corresponde a un control estacional. Este portafolio no fue validado, ya que fue rechazado por el gate de aceptación [1].';
      }
      return ok({ candidates: [{ content: { role: 'model', parts: [{ text: texto }] }, finishReason: 'STOP' }] });
    }
    throw new Error(`fetch inesperado: ${u}`);
  };
  if (sinClave) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = 'clave-de-prueba';
  try {
    const res = await handler(new Request('http://localhost/.netlify/functions/rag', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-nf-client-connection-ip': `ip-${Math.random()}` },
      body: JSON.stringify({ query, history }),
    }));
    return { status: res.status, r: await res.json(), sistema };
  } finally {
    globalThis.fetch = prevFetch;
    if (prevKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = prevKey;
  }
}

test('regresión real seguimiento «¿Y en Jalisco?»: devuelve 2,147 y atribuye métricas OOS a 2026-W43 (1 observación preemisión), nunca a prueba de 2025', async () => {
  const jal = VISTA_A51.series['estado|14|general'];
  const wOr = semana(VISTA_A51.origin);
  const wObs = semana(VISTA_A51.observation_cutoff);
  if (VISTA_A51.weeks_available === 1) {
    assert.equal(jal.pronostico_52_total, 2147);
    assert.equal(jal.oos.smape, 18.18);
    assert.equal(jal.oos.sesgo_pct, 20);
  }

  const { status, r } = await consultar('¿Y en Jalisco?', { history: HISTORIA_REAL_JALISCO });
  assert.equal(status, 200);
  assert.ok(r.answer.includes(ent(jal.pronostico_52_total)), `falta total 52 sem Jalisco (${ent(jal.pronostico_52_total)}): ${r.answer}`);
  // Contrato temporal crítico: las métricas de Jalisco (18.18/18.2 % y 20.0 %) NO pueden atribuirse a la prueba de 2025.
  assert.doesNotMatch(r.answer, /prueba(?: retrospectiva)? de 2025[^.\n]{0,80}(?:18\.18|18\.2)/i);
  assert.doesNotMatch(r.answer, /(?:18\.18|18\.2)[^.\n]{0,80}evaluad[oa] retrospectivamente en[^.\n]*2025/i);
  assert.ok(r.answer.includes(wOr), `debe declarar corte de entrenamiento ${wOr}`);
  assert.ok(r.answer.includes(wObs), `debe atribuir observación de vista a ${wObs}`);
  assert.ok(r.answer.includes(pct(jal.oos.smape)) || r.answer.includes('18.2'), 'debe informar sMAPE de la vista de Jalisco');
  assert.ok(r.answer.includes(pct(jal.oos.sesgo_pct)), 'debe informar sesgo de la vista de Jalisco');
  assert.ok(r.answer.includes(String(jal.oos.observado_total)) && r.answer.includes(String(Math.round(jal.oos.pronostico_total))), 'debe informar observados vs pronosticados de la semana evaluada');
  assert.match(r.answer, /no pertenecen a la prueba retrospectiva de 2025/i);
  assert.match(r.answer, /antes de emitir[\s\S]*no es prospectiv|no prospectiva respecto de la información/i);
});

test('nacional A51: 23,405 casos, 454 obs vs 447 pron (sMAPE 1.55 %, MAE 7) en 2026-W43; distingue portafolio rechazado de control no validado y 1/4 como contador técnico', async () => {
  const nac = VISTA_A51.series['nacional|mx|general'];
  if (VISTA_A51.weeks_available === 1) {
    assert.equal(nac.pronostico_52_total, 23405);
    assert.equal(nac.oos.observado_total, 454);
    assert.equal(nac.oos.pronostico_total, 447);
    assert.equal(nac.oos.smape, 1.55);
    assert.equal(nac.oos.mae, 7);
  }

  const { status, r } = await consultar('¿Cuántos casos de sífilis adquirida A51-A53 se pronostican en México en las 52 semanas?');
  assert.equal(status, 200);
  assert.ok(r.answer.includes(ent(nac.pronostico_52_total)));
  // Contrato semántico: el rechazado fue el portafolio seleccionado, NO el control estacional publicado; 1/4 es contador técnico.
  assert.doesNotMatch(r.answer, /este portafolio no fue validado,\s*ya que fue rechazado/i);
  assert.match(r.answer, /control estacional,\s*no validado/i);
  assert.match(r.answer, /el rechazado fue el portafolio(?: seleccionado)?,\s*no el control/i);
  assert.match(r.answer, /1 de 4[\s\S]{0,80}contador técnico/i);
  assert.ok(r.answer.includes(String(nac.oos.observado_total)) && r.answer.includes(String(Math.round(nac.oos.pronostico_total))));
  assert.ok(r.answer.includes(pct(nac.oos.smape)));
  assert.match(r.answer, new RegExp(`MAE[^.\\n]{0,15}\\b${nac.oos.mae}\\b`, 'i'));
  assert.match(r.answer, /2026-W42/);
  assert.match(r.answer, /2026-W43/);
});

test('desambiguación geográfica México (país) vs Estado de México vs CDMX y herencia de estrato por sexo', async () => {
  const edomex = VISTA_A51.series['estado|15|general'];
  const cdmx = VISTA_A51.series['estado|09|general'];
  const jalHom = VISTA_A51.series['estado|14|hombres'];

  const rEdo = (await consultar('¿Cuántos casos de sífilis adquirida se pronostican en el Estado de México?')).r;
  assert.ok(rEdo.answer.includes(ent(edomex.pronostico_52_total)));
  assert.match(rEdo.answer, /Estado de México/);

  const rCdmx = (await consultar('¿Cuántos casos de sífilis adquirida se pronostican en CDMX?')).r;
  assert.ok(rCdmx.answer.includes(ent(cdmx.pronostico_52_total)));

  const rHom = (await consultar('¿Y en hombres?', {
    history: [
      ...HISTORIA_REAL_JALISCO,
      { role: 'user', text: '¿Y en Jalisco?' },
      { role: 'assistant', text: 'En Jalisco se pronostican 2,147 casos.' },
    ],
  })).r;
  assert.ok(rHom.answer.includes(ent(jalHom.pronostico_52_total)));
  assert.match(rHom.answer, /Jalisco.*hombres/i);

  const rEst = (await consultar('¿Y está validada?', { history: HISTORIA_REAL_JALISCO, sinClave: true })).r;
  assert.equal(rEst.retrieval, 'vista');
  assert.match(rEst.answer, /Sífilis adquirida \(A51-A53\): control estacional, no validado\./);
});

test('seguimientos clínicos y prioridad de crisis: O98.1 embarazo, A50 congénita, menores sin A50 explícita, no-consejo y crisis sin fallthrough', async () => {
  const histA51 = [{ role: 'user', text: 'sífilis adquirida en Jalisco' }, { role: 'assistant', text: 'Pronóstico en Jalisco.' }];

  for (const seg of ['¿y en el embarazo?', '¿y en mujeres embarazadas?', 'and in pregnant women?', '¿cuántos en embarazadas?']) {
    const { r } = await consultar(seg, { history: histA51 });
    assert.match(r.answer, /no modela[\s\S]*O98\.1/i, seg);
    assert.doesNotMatch(r.answer, /2,147|23,405/, seg);
  }

  for (const seg of ['¿y la congénita?', 'and congenital?', '¿y neonatal?']) {
    const { r } = await consultar(seg, { history: histA51 });
    assert.match(r.answer, /no modela[\s\S]*A50/i, seg);
    assert.doesNotMatch(r.answer, /2,147|23,405/, seg);
  }

  for (const seg of ['¿y en bebés?', '¿y en recién nacidos?', '¿y en menores?', 'and in babies?', 'sífilis adquirida en niños en Jalisco']) {
    const { r } = await consultar(seg, { history: seg.includes('sífilis') ? [] : histA51 });
    assert.match(r.answer, /sin estratificación por edad ni por embarazo/i, seg);
    assert.match(r.answer, /A50/, seg);
    assert.doesNotMatch(r.answer, /2,147|23,405/, seg);
  }

  // Seguimiento tras A50 u O98.1 jamás hereda cifras de A51
  for (const prev of ['sífilis congénita en Jalisco', 'sífilis en el embarazo en Jalisco']) {
    const { r } = await consultar('¿y en Sonora?', { history: [{ role: 'user', text: prev }] });
    assert.match(r.answer, /no modela/i, prev);
    assert.doesNotMatch(r.answer, /762|2,147|23,405/, prev);
  }

  // Prioridad absoluta de crisis, incluso dentro de una conversación activa de A51
  const { r: rc } = await consultar('me quiero morir porque tengo sífilis adquirida', { history: histA51, sinClave: true });
  assert.match(rc.answer, /800 911 2000/);
  assert.match(rc.answer, /911/);
  assert.doesNotMatch(rc.answer, /2,147|23,405/);
});

test('ausencia de sexo en vulvovaginitis (directa y seguimiento), mal del pinto aceptado 1/4 sin fallo ni contaminación desde A51', async () => {
  const { r: rNoSexSeg } = await consultar('¿y para hombres?', {
    history: [{ role: 'user', text: '¿Cuántos casos de vulvovaginitis se pronostican en Jalisco?' }],
    sinClave: true,
  });
  assert.match(rNoSexSeg.answer, /no desglosa sexo; sus 37 series publicadas son por entidad y nacional, así que no existe pronóstico para hombres/);

  const chp = VISTA_PINTO.series['estado|07|general'];
  const { r: rPinto } = await consultar('¿Cuántos casos de mal del pinto se esperan en Chiapas?', { sinClave: true });
  assert.equal(rPinto.retrieval, 'vista');
  assert.ok(rPinto.answer.includes(ent(chp.pronostico_52_total)));
  assert.match(rPinto.answer, /aceptado en la prueba única retrospectiva de 2025/i);
  assert.match(rPinto.answer, /1 de 4[\s\S]{0,60}INCOMPLETE/);
  assert.doesNotMatch(rPinto.answer, /control estacional, no validado|el rechazado fue el portafolio/i);
  // Prohibido contaminar otros releases con métricas, IDs o cronología preemisión de A51
  assert.doesNotMatch(rPinto.answer, /23,405|2,147|0cc942faddb8|eaca7efc1a11|a18527def134|boletín 44|01:23:31/i);
});

test('vía semántica en servidor: contexto temporal separa vista 2026-W43 de 2025 y snippets llevan proveniencia real sin reescribir rag_index', async () => {
  const { r, sistema } = await consultar('¿Por qué fallaron los candidatos ETS y Ridge en sífilis adquirida?');
  assert.equal(r.retrieval, 'semantic');
  assert.ok(sistema, 'consulta metodológica abierta pasa por contexto semántico');
  assert.match(sistema, /2026-W43[\s\S]{0,80}NO prueba 2025/);
  assert.doesNotMatch(sistema, /las semanas evaluadas se registraron después de la emisión/);

  const snips = r.sources.map((s) => s.snippet || '');
  assert.ok(snips.length >= 3);
  for (const sn of snips) assert.doesNotMatch(sn, /las semanas evaluadas se registraron después de la emisión/);
  assert.ok(snips.some((sn) => /Control estacional no validado.*portafolio rechazado en prueba única 2025.*1\/4 contador técnico/.test(sn)));
  assert.ok(snips.some((sn) => /vista 2026-W43 \(no 2025\)|Vista por entidad en 2026-W43/.test(sn)));
});

test('cero valores numéricos de releases hardcodeados en rag.mjs ni en vista_grounding.mjs', () => {
  const codigo = readFileSync(new URL('../netlify/functions/rag.mjs', import.meta.url), 'utf8') + '\n' +
    readFileSync(new URL('../netlify/lib/vista_grounding.mjs', import.meta.url), 'utf8');
  for (const prohibido of ['23405', '23,405', '2147', '2,147', '454', '447', '1.55', '18.18', '18.2', '76.4', '64.2', '27.716934', '111.3']) {
    assert.ok(!codigo.includes(prohibido), `valor hardcodeado prohibido: ${prohibido}`);
  }
});
