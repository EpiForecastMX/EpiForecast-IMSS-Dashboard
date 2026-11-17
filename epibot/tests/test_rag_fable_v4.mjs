/**
 * Regresión focal Fable Prelim + hallazgos contrastados por ROOT (17 nov 2026, V4):
 * - B1: métricas OOS `null` (p. ej. `sesgo_pct: null` en parotiditis Jalisco 0 vs 5, A51 Campeche mujeres 0 vs 3,
 *   mal del pinto Chiapas / monóxido Jalisco 0 vs 0) jamás se imprimen como `0.0 %`, ni en ruta vista ni en semántica.
 * - B2: rango OOS estatal en `enriquecerSemanticoVista` derivado de `s.oos.semanas` y calendario MMWR (obesidad 17 sem
 *   `2026-W27 a 2026-W43`, hipertensión 2 sem `2026-W42 a 2026-W43`), sin rotular acumulados multi-semana como 1 semana.
 * - M1: cambios de tema (alcance de EpiForecast, motores evaluados, cortesía «ok gracias») no heredan pronóstico previo.
 * - M2/M4/S4: veredicto `FAIL` explícito (nunca «en curso» ni «sin fallo»), `INCOMPLETE` y rangos 2/4 y 4/4 en memoria,
 *   y `semanas > 0` con métricas nulas sin afirmar «aún no hay semanas observadas».
 * - M3: cronología preemisión en multi-semana (`asma_j45` 2/4) acota sólo la primera semana y preserva las posteriores.
 * - S1/S2/S3/S8: tratamiento clínico y ranking estatal van a semántico; grupos de edad declaran ausencia de desglose
 *   etario sin atribuir serie general; seguimiento aditivo A37+U99 activa `guardaSumaA37U99Rag`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const raiz = new URL('../../', import.meta.url);
const leerJson = (rel) => JSON.parse(readFileSync(new URL(rel, raiz), 'utf8'));
const INDICE = leerJson('epibot/rag_index.json');
const [VISTA_A51, VISTA_PARO, VISTA_OBE, VISTA_HIP, VISTA_ASMA, VISTA_PINTO] = [
  'sifilis_adquirida_a51', 'parotiditis_b26', 'obesidad', 'hipertension_i10', 'asma_j45', 'mal_del_pinto_a67',
].map((id) => leerJson(`publication/${id}/vista.json`));

const moduloUrl = process.env.RAG_MODULE
  ? new URL(process.env.RAG_MODULE, `file://${process.cwd()}/`)
  : new URL('../netlify/functions/rag.mjs', import.meta.url);
const { default: handler } = await import(moduloUrl.href);
const { vistaGroundedAnswer, enriquecerSemanticoVista } = await import(new URL('../lib/vista_grounding.mjs', moduloUrl).href);

const ent = (n) => Math.round(Number(n)).toLocaleString('en-US');
const sem = ([a, s]) => `${a}-W${String(s).padStart(2, '0')}`;
const inicioMmwr = (a) => { const d = new Date(Date.UTC(a, 0, 1)).getUTCDay(); return Date.UTC(a, 0, 1 + (d <= 3 ? -d : 7 - d)); };
const semsMmwr = (a) => Math.round((inicioMmwr(a + 1) - inicioMmwr(a)) / (7 * 864e5));
const semSig = ([a, s], k) => { let y = a, w = s + k; while (w > semsMmwr(y)) { w -= semsMmwr(y); y += 1; } return [y, w]; };
const rangoEsp = (or, n, sep = ' a ') => (n === 1 ? sem(semSig(or, 1)) : `${sem(semSig(or, 1))}${sep}${sem(semSig(or, n))}`);

const idxA51 = INDICE.chunks.findIndex((c) => c.section === 'sifilis_adquirida_a51');
const VEC_DEF = idxA51 >= 0 ? INDICE.vectors[idxA51] : new Array(768).fill(0.01);

const HISTORIA_A51_NACIONAL = [
  { role: 'user', text: '¿Cuántos casos de sífilis adquirida A51-A53 se pronostican en México en las 52 semanas?' },
  { role: 'assistant', text: 'El pronóstico de **Sífilis adquirida (A51-A53)** a nivel **nacional** (general) es de **23,405 casos** [1].' },
];

async function consultar(query, { history = [], sinClave = false, vector = VEC_DEF } = {}) {
  const prevFetch = globalThis.fetch;
  const prevKey = process.env.GEMINI_API_KEY;
  let sistema = null;
  let gemini = 0;
  globalThis.fetch = async (url, init = {}) => {
    gemini += 1;
    const u = String(url);
    const body = init.body ? JSON.parse(init.body) : {};
    const ok = (obj) => new Response(JSON.stringify(obj), { status: 200, headers: { 'content-type': 'application/json' } });
    if (u.includes(':embedContent')) return ok({ embedding: { values: vector } });
    if (u.includes(':generateContent')) {
      if (!body.systemInstruction) return ok({ candidates: [{ content: { role: 'model', parts: [{ text: query }] } }] });
      sistema = body.systemInstruction.parts.map((p) => p.text).join('');
      return ok({ candidates: [{ content: { role: 'model', parts: [{ text: 'Respuesta semántica fundada en el contexto [1].' }] }, finishReason: 'STOP' }] });
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
    return { status: res.status, r: await res.json(), sistema, gemini };
  } finally {
    globalThis.fetch = prevFetch;
    if (prevKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = prevKey;
  }
}

test('B1 (determinista + semántica): sesgo_pct null jamás se imprime como 0.0 % en parotiditis Jalisco (0 vs 5), A51 Campeche mujeres (0 vs 3) ni casos 0 vs 0', async () => {
  const paroJal = VISTA_PARO.series['estado|14|general'];
  assert.equal(paroJal.oos.sesgo_pct, null, 'parotiditis Jalisco tiene sesgo_pct null en la vista pública');
  const { r: rParo } = await consultar('¿Cuántos casos de parotiditis infecciosa se pronostican en Jalisco?', { sinClave: true });
  assert.equal(rParo.retrieval, 'vista');
  assert.ok(rParo.answer.includes(ent(paroJal.pronostico_52_total)));
  assert.ok(rParo.answer.includes(`${ent(paroJal.oos.observado_total)} casos observados`) && rParo.answer.includes(`${ent(paroJal.oos.pronostico_total)} pronosticados`));
  assert.doesNotMatch(rParo.answer, /sesgo(?: de)?\s*0(?:\.0+)?\s*%/i, 'B1: prohibido fabricar sesgo 0.0 % cuando sesgo_pct es null');

  const campMuj = VISTA_A51.series['estado|04|mujeres'];
  assert.equal(campMuj.oos.sesgo_pct, null, 'A51 Campeche mujeres tiene sesgo_pct null en la vista pública');
  const { r: rCamp } = await consultar('¿Cuántos casos de sífilis adquirida en mujeres se pronostican en Campeche?', { sinClave: true });
  assert.equal(rCamp.retrieval, 'vista');
  assert.ok(rCamp.answer.includes(ent(campMuj.pronostico_52_total)));
  assert.doesNotMatch(rCamp.answer, /sesgo(?: de)?\s*0(?:\.0+)?\s*%/i, 'B1: Campeche mujeres no debe imprimir sesgo 0.0 %');

  for (const q0 of ['¿Cuántos casos de mal del pinto se esperan en Chiapas?', 'intoxicación por monóxido de carbono en Jalisco']) {
    const { r } = await consultar(q0, { sinClave: true });
    assert.doesNotMatch(r.answer, /sesgo(?: de)?\s*0(?:\.0+)?\s*%/i, q0);
  }

  // Ruta semántica: Serie Jalisco en CONTRATO TEMPORAL tampoco imprime sesgo 0 % cuando sesgo_pct es null.
  const { r: rSemParo, sistema } = await consultar('¿Por qué los motores estacionales de parotiditis infecciosa en Jalisco tienen error alto?');
  assert.equal(rSemParo.retrieval, 'semantic');
  assert.match(sistema, /Serie Jalisco \(general\):/);
  assert.doesNotMatch(sistema, /Serie Jalisco[^\n]*sesgo 0(?:\.0+)?\s*%/i);
});

test('B2 (contexto semántico estatal multi-semana): obesidad (17 sem) e hipertensión (2 sem) declaran el rango completo y conteo de observaciones', async () => {
  const obeJal = VISTA_OBE.series['estado|14|general'];
  const hipJal = VISTA_HIP.series['estado|14|general'];
  assert.ok(obeJal.oos.semanas > 1 && hipJal.oos.semanas > 1);
  const wObe = rangoEsp(VISTA_OBE.origin, obeJal.oos.semanas, ' a ');
  const wHip = rangoEsp(VISTA_HIP.origin, hipJal.oos.semanas, ' a ');

  const { r, sistema } = await consultar('Compara hipertensión arterial y obesidad en Jalisco');
  assert.equal(r.retrieval, 'semantic');
  assert.ok(sistema.includes(`vista ${wObe} (${obeJal.oos.semanas} obs.`), `falta rango estatal de obesidad (${wObe}): ${sistema}`);
  assert.ok(sistema.includes(`vista ${wHip} (${hipJal.oos.semanas} obs.`), `falta rango estatal de hipertensión (${wHip}): ${sistema}`);
  assert.doesNotMatch(sistema, new RegExp(`vista ${sem(semSig(VISTA_OBE.origin, 1))}:`), 'no debe atribuir 17 semanas sólo a la primera semana');
  assert.doesNotMatch(sistema, new RegExp(`vista ${sem(semSig(VISTA_HIP.origin, 1))}:`), 'no debe atribuir 2 semanas sólo a la primera semana');
});

test('M1 (no sobre-capturar seguimientos): alcance de EpiForecast, motores evaluados y «ok gracias» no devuelven el pronóstico previo de A51', async () => {
  const nacA51 = ent(VISTA_A51.series['nacional|mx|general'].pronostico_52_total);
  const rScope = await consultar('¿Cuántos padecimientos modela EpiForecast?', { history: HISTORIA_A51_NACIONAL });
  assert.equal(rScope.r.retrieval, 'semantic', 'pregunta de alcance del proyecto debe ir a vía semántica');
  assert.match(rScope.sistema, /Alcance vigente:/);
  assert.ok(!rScope.r.answer.includes(nacA51));

  const rMotores = await consultar('¿Y qué motores se evaluaron?', { history: HISTORIA_A51_NACIONAL });
  assert.equal(rMotores.r.retrieval, 'semantic', 'pregunta metodológica en seguimiento debe ir a vía semántica');
  assert.ok(rMotores.gemini > 0 && rMotores.sistema);

  const rGracias = await consultar('ok gracias', { history: HISTORIA_A51_NACIONAL });
  assert.equal(rGracias.r.retrieval, 'semantic', 'cortesía/cierre no debe reimprimir el bloque de pronóstico nacional');
  assert.ok(!rGracias.r.answer.includes(nacA51));
});

test('M2, M3, M4 y S4: asma_j45 multi-semana preemisión real + vistas sintéticas en memoria (FAIL explícito, 2/4, 4/4 y semanas>0 sin métricas)', async () => {
  // M3 con vista pública real de asma_j45 (2 semanas observadas: W42 preemisión, W43 posterior a la emisión).
  const idxAsma = INDICE.chunks.findIndex((c) => c.section === 'asma_j45');
  const vecAsma = idxAsma >= 0 ? INDICE.vectors[idxAsma] : VEC_DEF;
  const wIniAsma = sem(semSig(VISTA_ASMA.origin, 1));
  const { r: rAsmaVista } = await consultar('¿Cuántos casos de asma se pronostican en Jalisco?', { sinClave: true });
  assert.equal(rAsmaVista.retrieval, 'vista');
  assert.match(rAsmaVista.answer, new RegExp(`primera semana \\(\\*\\*${wIniAsma}\\*\\*\\) ya era pública antes de emitir`));
  assert.doesNotMatch(rAsmaVista.answer, /semanas observadas[^.]*ya pública antes de emitir y no prospectiva/i);

  const { r: rAsmaSem, sistema: sisAsma } = await consultar('¿Por qué se excluyó el motor ETS en asma?', { vector: vecAsma });
  assert.equal(rAsmaSem.retrieval, 'semantic');
  assert.doesNotMatch(sisAsma, /las semanas evaluadas se registraron después de la emisión/);
  assert.match(sisAsma, new RegExp(`la primera semana evaluada \\(${wIniAsma}\\) ya era pública antes de emitir`));

  // M2 + M4 + S4 con copias sintéticas en memoria de VISTA_PINTO (sin tocar ningún archivo vista.json real).
  const basePinto = structuredClone(VISTA_PINTO);
  const sintetica = (mut) => { const c = structuredClone(basePinto); mut(c); return c; };

  const vistaFail = sintetica((c) => { c.weeks_available = 4; c.weeks_required = 4; c.verdict = 'FAIL'; c.series['estado|07|general'].oos.semanas = 4; });
  const ansFail = vistaGroundedAnswer('¿Cuántos casos de mal del pinto se esperan en Chiapas?', [], { leerVista: () => vistaFail, leerFicha: () => '' });
  assert.match(ansFail.answer, /veredicto \*\*FAIL\*\*/);
  assert.doesNotMatch(ansFail.answer, /en curso|sin fallo/i, 'M2: un veredicto FAIL jamás puede decir en curso ni sin fallo');

  for (const [wa, verdict, sepFin] of [[2, 'INCOMPLETE', '2026-W43–2026-W44'], [4, 'PASS', '2026-W43–2026-W46']]) {
    const vN = sintetica((c) => {
      c.weeks_available = wa;
      c.verdict = verdict;
      c.series['nacional|mx|general'].oos = { semanas: wa, observado_total: 6, pronostico_total: 5, mae: 0.5, smape: 18.0, sesgo_pct: -16.7 };
    });
    const enr = enriquecerSemanticoVista({
      foco: ['mal_del_pinto_a67'],
      searchQuery: 'mal del pinto en Chiapas',
      hits: [{ chunk: { id: `release:mal_del_pinto_a67:${vN.release_id}:nacional`, section: 'mal_del_pinto_a67', text: 'texto' } }],
      leerVista: () => vN,
    });
    const sn = enr.snippets.get(`release:mal_del_pinto_a67:${vN.release_id}:nacional`);
    assert.ok(sn.includes(`vista ${sepFin} (no 2025)`), `M4 snippet multi-semana (${wa}/4): ${sn}`);
  }

  const vistaSinMet = sintetica((c) => {
    c.series['estado|07|general'].oos = { semanas: 1, observado_total: 0, pronostico_total: 0, mae: null, smape: null, sesgo_pct: null };
  });
  const ansSinMet = vistaGroundedAnswer('¿Cuántos casos de mal del pinto se esperan en Chiapas?', [], { leerVista: () => vistaSinMet, leerFicha: () => '' });
  assert.match(ansSinMet.answer, /1 observación semanal registrada/);
  assert.doesNotMatch(ansSinMet.answer, /aún no hay semanas observadas evaluadas/i, 'S4: no negar semanas observadas cuando semanas > 0');
});

test('S1, S2, S3 y S8: tratamiento clínico, grupo etario adultos mayores, ranking estatal y suma en seguimiento A37+U99', async () => {
  const jalA51 = ent(VISTA_A51.series['estado|14|general'].pronostico_52_total);
  const nacA51 = ent(VISTA_A51.series['nacional|mx|general'].pronostico_52_total);

  // S1: consulta de tratamiento clínico en estado no devuelve bloque de pronóstico estatal.
  const rClin = await consultar('¿Cómo se trata la sífilis adquirida en Jalisco?');
  assert.equal(rClin.r.retrieval, 'semantic');
  assert.ok(!rClin.r.answer.includes(jalA51));

  // S2: grupo etario no modelado («adultos mayores») aclara ausencia de desglose por edad sin atribuirle 2,147 casos.
  const { r: rEdad } = await consultar('sífilis adquirida en adultos mayores en Jalisco', { sinClave: true });
  assert.equal(rEdad.retrieval, 'vista');
  assert.match(rEdad.answer, /sin estratificación por grupos de edad|no existe pronóstico específico por edad/i);
  assert.ok(!rEdad.answer.includes(jalA51), 'S2: no atribuir serie general a adultos mayores');

  // S3: ranking estatal sin entidad nombrada va a semántico (:estados), nunca devuelve sólo el total nacional.
  const rRank = await consultar('¿Qué estado tiene más casos de sífilis adquirida?');
  assert.equal(rRank.r.retrieval, 'semantic');
  assert.ok(!rRank.r.answer.includes(nacA51));

  // S8: seguimiento aditivo tras tos ferina activa guardaSumaA37U99Rag sin llamar a Gemini.
  const rSumaSeg = await consultar('¿y cuántos casos suma con síndrome coqueluchoide?', {
    history: [{ role: 'user', text: 'tos ferina en Jalisco' }, { role: 'assistant', text: 'Pronóstico de tos ferina.' }],
    sinClave: true,
  });
  assert.equal(rSumaSeg.gemini, 0);
  assert.equal(rSumaSeg.r.retrieval, 'none');
  assert.equal(rSumaSeg.r.guarda, 'suma_a37_u99');
  assert.match(rSumaSeg.r.answer, /no se suman: son series distintas/);
});
