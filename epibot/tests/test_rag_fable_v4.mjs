/**
 * Regresión focal Fable Prelim + estabilidad ante avances semanales de boletín (17 nov 2026, V5):
 * - B1 hermético (siempre activo, independiente del boletín): copias en memoria con `sesgo_pct: null` (0 vs 5,
 *   0 vs 3, 0 vs 0) jamás imprimen `sesgo 0.0 %` en `vistaGroundedAnswer` ni en `enriquecerSemanticoVista`, mientras
 *   que `sesgo_pct: 0` real (observados === pronosticados > 0) sí se conserva como `0.0 %`.
 * - B1 integración viva + simulación de avance semanal (2/4 sesgo no nulo y 4/4 sesgo real 0.0 %): las aserciones
 *   sobre `handler` derivan expectativas del `oos` vigente (sin skips ni exigir `null` perpetuo ni 1 semana fija).
 * - B2/M1/K6/M2/M3/M4/S1/S2/S3/S4/S8: todos los totales y rangos MMWR se derivan de `origin` y `semanas` sin literales.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const raiz = new URL('../../', import.meta.url);
const leerJson = (rel) => JSON.parse(readFileSync(new URL(rel, raiz), 'utf8'));
const INDICE = leerJson('epibot/rag_index.json');
const VISTAS_VIVAS = Object.fromEntries([
  'sifilis_adquirida_a51', 'parotiditis_b26', 'obesidad', 'hipertension_i10',
  'asma_j45', 'mal_del_pinto_a67', 'monoxido_t58',
].map((id) => [id, leerJson(`publication/${id}/vista.json`)]));
const {
  sifilis_adquirida_a51: VISTA_A51,
  parotiditis_b26: VISTA_PARO,
  obesidad: VISTA_OBE,
  hipertension_i10: VISTA_HIP,
  asma_j45: VISTA_ASMA,
  mal_del_pinto_a67: VISTA_PINTO,
  monoxido_t58: VISTA_MONO,
} = VISTAS_VIVAS;

const moduloUrl = process.env.RAG_MODULE
  ? new URL(process.env.RAG_MODULE, `file://${process.cwd()}/`)
  : new URL('../netlify/functions/rag.mjs', import.meta.url);
const { default: handler } = await import(moduloUrl.href);
const { vistaGroundedAnswer, enriquecerSemanticoVista } = await import(new URL('../lib/vista_grounding.mjs', moduloUrl).href);

const ent = (n) => Math.round(Number(n)).toLocaleString('en-US');
const pct = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
const sem = ([a, s]) => `${a}-W${String(s).padStart(2, '0')}`;
const inicioMmwr = (a) => { const d = new Date(Date.UTC(a, 0, 1)).getUTCDay(); return Date.UTC(a, 0, 1 + (d <= 3 ? -d : 7 - d)); };
const semsMmwr = (a) => Math.round((inicioMmwr(a + 1) - inicioMmwr(a)) / (7 * 864e5));
const semSig = ([a, s], k) => { let y = a, w = s + k; while (w > semsMmwr(y)) { w -= semsMmwr(y); y += 1; } return [y, w]; };
const rangoEsp = (or, n, sep = ' a ') => (n === 1 ? sem(semSig(or, 1)) : `${sem(semSig(or, 1))}${sep}${sem(semSig(or, n))}`);

const idxA51 = INDICE.chunks.findIndex((c) => c.section === 'sifilis_adquirida_a51');
const VEC_DEF = idxA51 >= 0 ? INDICE.vectors[idxA51] : new Array(768).fill(0.01);
const TOTAL_NAC_A51 = ent(VISTA_A51.series['nacional|mx|general'].pronostico_52_total);

const HISTORIA_A51_NACIONAL = [
  { role: 'user', text: '¿Cuántos casos de sífilis adquirida A51-A53 se pronostican en México en las 52 semanas?' },
  { role: 'assistant', text: `El pronóstico de **Sífilis adquirida (A51-A53)** a nivel **nacional** (general) es de **${TOTAL_NAC_A51} casos** [1].` },
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

function clonarConOos(vistaBase, serieKey, oosNuevo, metaExtra = {}) {
  const copia = structuredClone(vistaBase);
  Object.assign(copia, metaExtra);
  copia.series[serieKey].oos = { ...copia.series[serieKey].oos, ...oosNuevo };
  return copia;
}

function verificarSesgoDerivadoVista(answer, v, serieKey, etiqueta) {
  const s = v.series[serieKey];
  assert.ok(answer.includes(ent(s.pronostico_52_total)), `${etiqueta}: falta total 52 sem`);
  if (s.oos?.semanas > 0) {
    assert.ok(answer.includes(rangoEsp(v.origin, s.oos.semanas, ' a ')), `${etiqueta}: falta rango OOS`);
    assert.ok(answer.includes(`${ent(s.oos.observado_total)} casos observados`), `${etiqueta}: falta observados`);
    assert.ok(answer.includes(`${ent(s.oos.pronostico_total)} pronosticados`), `${etiqueta}: falta pronosticados`);
    if (s.oos.sesgo_pct === null || s.oos.sesgo_pct === undefined) {
      assert.doesNotMatch(answer, /sesgo(?: de)?\s*-?\d/i, `${etiqueta}: prohibido inventar sesgo numérico cuando sesgo_pct es null`);
    } else {
      assert.ok(answer.includes(`sesgo de ${pct(s.oos.sesgo_pct)} %`), `${etiqueta}: falta sesgo real (${pct(s.oos.sesgo_pct)} %)`);
    }
  }
}

test('B1 hermético (independiente del boletín): copias sintéticas null (0 vs 5, 0 vs 3, 0 vs 0) jamás imprimen 0.0 % y sesgo real 0.0 % sí se conserva', () => {
  const casosNulos = [
    ['parotiditis 0 vs 5', '¿Cuántos casos de parotiditis infecciosa se pronostican en Jalisco?', 'parotiditis_b26', VISTA_PARO, 'estado|14|general',
      { semanas: 1, observado_total: 0, pronostico_total: 5, mae: 5, smape: 200.0, sesgo_pct: null }],
    ['A51 Campeche mujeres 0 vs 3', '¿Cuántos casos de sífilis adquirida en mujeres se pronostican en Campeche?', 'sifilis_adquirida_a51', VISTA_A51, 'estado|04|mujeres',
      { semanas: 1, observado_total: 0, pronostico_total: 3, mae: 3, smape: 200.0, sesgo_pct: null }],
    ['pinto Chiapas 0 vs 0', '¿Cuántos casos de mal del pinto se esperan en Chiapas?', 'mal_del_pinto_a67', VISTA_PINTO, 'estado|07|general',
      { semanas: 1, observado_total: 0, pronostico_total: 0, mae: 0, smape: 0.0, sesgo_pct: null }],
    ['monóxido Jalisco 0 vs 0', 'intoxicación por monóxido de carbono en Jalisco', 'monoxido_t58', VISTA_MONO, 'estado|14|general',
      { semanas: 1, observado_total: 0, pronostico_total: 0, mae: 0, smape: 0.0, sesgo_pct: null }],
  ];
  for (const [eti, q, id, base, skey, oosNulo] of casosNulos) {
    const vSint = clonarConOos(base, skey, oosNulo);
    const ans = vistaGroundedAnswer(q, [], { leerVista: () => vSint, leerFicha: () => '' });
    assert.ok(ans, eti);
    verificarSesgoDerivadoVista(ans.answer, vSint, skey, eti);
    const enr = enriquecerSemanticoVista({ foco: [id], searchQuery: q, hits: [], leerVista: () => vSint });
    assert.doesNotMatch(enr.extraFacts, /Serie [^\n]*sesgo/i, `${eti} (semántico): no debe imprimir sesgo cuando es null`);
  }
  // Contraparte hermética: cuando sesgo_pct es 0 real (5 observados vs 5 pronosticados), 0.0 % sí debe mostrarse.
  const vCeroReal = clonarConOos(VISTA_PARO, 'estado|14|general', { semanas: 2, observado_total: 5, pronostico_total: 5, mae: 0, smape: 0.0, sesgo_pct: 0.0 }, { weeks_available: 2 });
  const ansCero = vistaGroundedAnswer('¿Cuántos casos de parotiditis infecciosa se pronostican en Jalisco?', [], { leerVista: () => vCeroReal, leerFicha: () => '' });
  verificarSesgoDerivadoVista(ansCero.answer, vCeroReal, 'estado|14|general', 'parotiditis sesgo 0.0 % real');
  const enrCero = enriquecerSemanticoVista({ foco: ['parotiditis_b26'], searchQuery: 'parotiditis infecciosa en Jalisco', hits: [], leerVista: () => vCeroReal });
  assert.match(enrCero.extraFacts, /Serie Jalisco \(general\):[^\n]*sesgo 0\.0 %/);
});

test('B1 integración viva + simulación de avance semanal (2/4 sesgo no nulo y 4/4 sesgo 0.0 % real sin mutar archivos reales)', async () => {
  const citasVivas = [
    ['¿Cuántos casos de parotiditis infecciosa se pronostican en Jalisco?', 'parotiditis_b26', 'estado|14|general'],
    ['¿Cuántos casos de sífilis adquirida en mujeres se pronostican en Campeche?', 'sifilis_adquirida_a51', 'estado|04|mujeres'],
    ['¿Cuántos casos de mal del pinto se esperan en Chiapas?', 'mal_del_pinto_a67', 'estado|07|general'],
    ['intoxicación por monóxido de carbono en Jalisco', 'monoxido_t58', 'estado|14|general'],
  ];
  for (const [q, id, skey] of citasVivas) {
    const { status, r } = await consultar(q, { sinClave: true });
    assert.equal(status, 200, q);
    assert.equal(r.retrieval, 'vista', q);
    verificarSesgoDerivadoVista(r.answer, VISTAS_VIVAS[id], skey, `vivo ${id}`);
  }
  const { r: rSemParo, sistema } = await consultar('¿Por qué los motores estacionales de parotiditis infecciosa en Jalisco tienen error alto?');
  assert.equal(rSemParo.retrieval, 'semantic');
  assert.match(sistema, /Serie Jalisco \(general\):/);
  const sesgoParoVivo = VISTA_PARO.series['estado|14|general'].oos?.sesgo_pct;
  if (sesgoParoVivo === null || sesgoParoVivo === undefined) {
    assert.doesNotMatch(sistema, /Serie Jalisco[^\n]*sesgo/i);
  } else {
    assert.ok(sistema.includes(`sesgo ${pct(sesgoParoVivo)} %`));
  }

  // Simulación de boletines futuros sobre las mismas 4 consultas (2/4 con sesgo no-null y 4/4 con sesgo real 0.0 %):
  // demuestra que la lógica de verificación derivada jamás rompe cuando desaparecen los nulls o aparece un 0.0 % real.
  for (const [escenario, meta, oosSim] of [
    ['avance 2/4 sesgo no nulo', { weeks_available: 2, verdict: 'INCOMPLETE' }, { semanas: 2, observado_total: 8, pronostico_total: 10, mae: 1, smape: 22.22, sesgo_pct: 25.0 }],
    ['avance 4/4 sesgo 0.0 % real', { weeks_available: 4, verdict: 'CONTROL_ONLY' }, { semanas: 4, observado_total: 12, pronostico_total: 12, mae: 0, smape: 0.0, sesgo_pct: 0.0 }],
  ]) {
    for (const [q, id, skey] of citasVivas) {
      const vMut = clonarConOos(VISTAS_VIVAS[id], skey, oosSim, id === 'mal_del_pinto_a67' && meta.weeks_available === 4 ? { ...meta, verdict: 'PASS' } : meta);
      const ansMut = vistaGroundedAnswer(q, [], { leerVista: () => vMut, leerFicha: () => '' });
      verificarSesgoDerivadoVista(ansMut.answer, vMut, skey, `${escenario} ${id}`);
    }
  }
});

test('B2 (contexto semántico estatal multi-semana): obesidad e hipertensión declaran el rango completo derivado y conteo de observaciones', async () => {
  const obeJal = VISTA_OBE.series['estado|14|general'];
  const hipJal = VISTA_HIP.series['estado|14|general'];
  assert.ok(obeJal.oos.semanas > 1 && hipJal.oos.semanas > 1);
  const wObe = rangoEsp(VISTA_OBE.origin, obeJal.oos.semanas, ' a ');
  const wHip = rangoEsp(VISTA_HIP.origin, hipJal.oos.semanas, ' a ');

  const { r, sistema } = await consultar('Compara hipertensión arterial y obesidad en Jalisco');
  assert.equal(r.retrieval, 'semantic');
  assert.ok(sistema.includes(`vista ${wObe} (${obeJal.oos.semanas} obs.`), `falta rango estatal de obesidad (${wObe})`);
  assert.ok(sistema.includes(`vista ${wHip} (${hipJal.oos.semanas} obs.`), `falta rango estatal de hipertensión (${wHip})`);
  assert.doesNotMatch(sistema, new RegExp(`vista ${sem(semSig(VISTA_OBE.origin, 1))}:`));
  assert.doesNotMatch(sistema, new RegExp(`vista ${sem(semSig(VISTA_HIP.origin, 1))}:`));
});

test('M1 y V3 K6: alcance de EpiForecast, motores evaluados, «ok gracias» y reparto por sexo van a vía semántica sin reimprimir A51', async () => {
  const rScope = await consultar('¿Cuántos padecimientos modela EpiForecast?', { history: HISTORIA_A51_NACIONAL });
  assert.equal(rScope.r.retrieval, 'semantic');
  assert.match(rScope.sistema, /Alcance vigente:/);
  assert.ok(!rScope.r.answer.includes(TOTAL_NAC_A51));

  const rMotores = await consultar('¿Y qué motores se evaluaron?', { history: HISTORIA_A51_NACIONAL });
  assert.equal(rMotores.r.retrieval, 'semantic');
  assert.ok(rMotores.gemini > 0 && rMotores.sistema);

  const rGracias = await consultar('ok gracias', { history: HISTORIA_A51_NACIONAL });
  assert.equal(rGracias.r.retrieval, 'semantic');
  assert.ok(!rGracias.r.answer.includes(TOTAL_NAC_A51));

  const rK6 = await consultar('¿Cómo influyen los problemas del reparto por sexo en el pronóstico de sífilis adquirida A51-A53?');
  assert.equal(rK6.r.retrieval, 'semantic');
  assert.ok(rK6.gemini > 0 && rK6.sistema);
});

test('M2, M3, M4 y S4: asma_j45 preemisión multi-semana real + sintéticas FAIL, 2/4, 4/4 derivadas por calendario desde origin y semanas>0 sin métricas', async () => {
  const idxAsma = INDICE.chunks.findIndex((c) => c.section === 'asma_j45');
  const vecAsma = idxAsma >= 0 ? INDICE.vectors[idxAsma] : VEC_DEF;
  const wIniAsma = sem(semSig(VISTA_ASMA.origin, 1));
  assert.ok(VISTA_ASMA.series['estado|14|general'].oos.semanas > 1);
  const { r: rAsmaVista } = await consultar('¿Cuántos casos de asma se pronostican en Jalisco?', { sinClave: true });
  assert.equal(rAsmaVista.retrieval, 'vista');
  assert.match(rAsmaVista.answer, new RegExp(`primera semana \\(\\*\\*${wIniAsma}\\*\\*\\) ya era pública antes de emitir`));
  assert.doesNotMatch(rAsmaVista.answer, /semanas observadas[^.]*ya pública antes de emitir y no prospectiva/i);

  const { r: rAsmaSem, sistema: sisAsma } = await consultar('¿Por qué se excluyó el motor ETS en asma?', { vector: vecAsma });
  assert.equal(rAsmaSem.retrieval, 'semantic');
  assert.doesNotMatch(sisAsma, /las semanas evaluadas se registraron después de la emisión/);
  assert.match(sisAsma, new RegExp(`la primera semana evaluada \\(${wIniAsma}\\) ya era pública antes de emitir`));

  const vistaFail = clonarConOos(VISTA_PINTO, 'estado|07|general', { semanas: 4 }, { weeks_available: 4, weeks_required: 4, verdict: 'FAIL' });
  const ansFail = vistaGroundedAnswer('¿Cuántos casos de mal del pinto se esperan en Chiapas?', [], { leerVista: () => vistaFail, leerFicha: () => '' });
  assert.match(ansFail.answer, /veredicto \*\*FAIL\*\*/);
  assert.doesNotMatch(ansFail.answer, /en curso|sin fallo/i);

  for (const [wa, verdict] of [[2, 'INCOMPLETE'], [4, 'PASS']]) {
    const rangoDerivado = rangoEsp(VISTA_PINTO.origin, wa, '–');
    const vN = clonarConOos(VISTA_PINTO, 'nacional|mx|general', { semanas: wa, observado_total: 6, pronostico_total: 5, mae: 0.5, smape: 18.0, sesgo_pct: -16.7 }, { weeks_available: wa, verdict });
    const cid = `release:mal_del_pinto_a67:${vN.release_id}:nacional`;
    const enr = enriquecerSemanticoVista({ foco: ['mal_del_pinto_a67'], searchQuery: 'mal del pinto en Chiapas', hits: [{ chunk: { id: cid, section: 'mal_del_pinto_a67', text: 'texto' } }], leerVista: () => vN });
    assert.ok(enr.snippets.get(cid).includes(`vista ${rangoDerivado} (no 2025)`));
  }

  const vistaSinMet = clonarConOos(VISTA_PINTO, 'estado|07|general', { semanas: 1, observado_total: 0, pronostico_total: 0, mae: null, smape: null, sesgo_pct: null });
  const ansSinMet = vistaGroundedAnswer('¿Cuántos casos de mal del pinto se esperan en Chiapas?', [], { leerVista: () => vistaSinMet, leerFicha: () => '' });
  assert.match(ansSinMet.answer, /1 observación semanal registrada/);
  assert.doesNotMatch(ansSinMet.answer, /aún no hay semanas observadas evaluadas/i);
});

test('S1, S2, S3 y S8: tratamiento clínico, grupo etario adultos mayores, ranking estatal y suma en seguimiento A37+U99', async () => {
  const jalA51 = ent(VISTA_A51.series['estado|14|general'].pronostico_52_total);
  const rClin = await consultar('¿Cómo se trata la sífilis adquirida en Jalisco?');
  assert.equal(rClin.r.retrieval, 'semantic');
  assert.ok(!rClin.r.answer.includes(jalA51));

  const { r: rEdad } = await consultar('sífilis adquirida en adultos mayores en Jalisco', { sinClave: true });
  assert.equal(rEdad.retrieval, 'vista');
  assert.match(rEdad.answer, /sin estratificación por grupos de edad|no existe pronóstico específico por edad/i);
  assert.ok(!rEdad.answer.includes(jalA51));

  const rRank = await consultar('¿Qué estado tiene más casos de sífilis adquirida?');
  assert.equal(rRank.r.retrieval, 'semantic');
  assert.ok(!rRank.r.answer.includes(TOTAL_NAC_A51));

  const rSumaSeg = await consultar('¿y cuántos casos suma con síndrome coqueluchoide?', {
    history: [{ role: 'user', text: 'tos ferina en Jalisco' }, { role: 'assistant', text: 'Pronóstico de tos ferina.' }],
    sinClave: true,
  });
  assert.equal(rSumaSeg.gemini, 0);
  assert.equal(rSumaSeg.r.retrieval, 'none');
  assert.equal(rSumaSeg.r.guarda, 'suma_a37_u99');
  assert.match(rSumaSeg.r.answer, /no se suman: son series distintas/);
});
