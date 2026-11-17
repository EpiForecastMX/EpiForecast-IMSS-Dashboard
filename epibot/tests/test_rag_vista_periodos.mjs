/**
 * Regresión focal de producción (16-17 nov 2026, V2): atribución temporal de métricas de `vista.json` vs prueba
 * retrospectiva única (`test_2025`), distinción entre portafolio rechazado y control estacional publicado (no
 * validado), precedencia de guardas (`noModeladaSinVecino` sobre `hipertension_i10`, `estadoDeControl` puro sobre
 * `vistaGroundedAnswer`), ruta estructurada de controles D7 normales y expectativas derivadas de `vista.json`.
 *
 * Contrafactual:
 *   RAG_MODULE=../../../before/epibot/netlify/functions/rag.mjs node --import ./tests_focal/loader.mjs --test after_v2/epibot/tests/test_rag_vista_periodos.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const raiz = new URL('../../', import.meta.url);
const leerJson = (rel) => JSON.parse(readFileSync(new URL(rel, raiz), 'utf8'));
const INDICE = leerJson('epibot/rag_index.json');
const [VISTA_A51, VISTA_PINTO, VISTA_HIP, VISTA_PARO, VISTA_PROST, VISTA_MONO] = [
  'sifilis_adquirida_a51', 'mal_del_pinto_a67', 'hipertension_i10',
  'parotiditis_b26', 'hiperplasia_prostata_n40', 'monoxido_t58',
].map((id) => leerJson(`publication/${id}/vista.json`));
const moduloUrl = process.env.RAG_MODULE
  ? new URL(process.env.RAG_MODULE, `file://${process.cwd()}/`)
  : new URL('../netlify/functions/rag.mjs', import.meta.url);
const { default: handler } = await import(moduloUrl.href);

const ent = (n) => Math.round(Number(n)).toLocaleString('en-US');
const uno = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const pct = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
const sem = ([a, s]) => `${a}-W${String(s).padStart(2, '0')}`;
const idxA51 = INDICE.chunks.findIndex((c) => c.section === 'sifilis_adquirida_a51');
const VEC_A51 = idxA51 >= 0 ? INDICE.vectors[idxA51] : new Array(768).fill(0.01);
const HISTORIA_REAL_JALISCO = [
  { role: 'user', text: '¿Cuántos casos de sífilis adquirida A51-A53 se pronostican en México en las 52 semanas?' },
  { role: 'assistant', text: 'El pronóstico total de **sífilis adquirida** (A51-A53) para 2026-W43 a 2027-W42 es de **23,405 casos** [3]. Corresponde a un modelo de control estacional [1][2]. Este portafolio no fue validado, ya que fue rechazado por el gate de aceptación [1][3].' },
];

async function consultar(query, { history = [], sinClave = false, vector = VEC_A51 } = {}) {
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
      const promptUsr = (body.contents || []).map((c) => (c.parts || []).map((p) => p.text || '').join(' ')).join('\n');
      if (!body.systemInstruction) {
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
    return { status: res.status, r: await res.json(), sistema, gemini };
  } finally {
    globalThis.fetch = prevFetch;
    if (prevKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = prevKey;
  }
}

test('regresión real seguimiento «¿Y en Jalisco?»: devuelve total de vista y atribuye OOS a semana(s) de vista, nunca a prueba de 2025', async () => {
  const jal = VISTA_A51.series['estado|14|general'];
  const wOr = sem(VISTA_A51.origin);
  const wObs = sem(VISTA_A51.observation_cutoff);
  if (VISTA_A51.weeks_available === 1) {
    assert.equal(jal.pronostico_52_total, 2147);
    assert.equal(jal.oos.smape, 18.18);
    assert.equal(jal.oos.sesgo_pct, 20);
  }
  const { status, r } = await consultar('¿Y en Jalisco?', { history: HISTORIA_REAL_JALISCO });
  assert.equal(status, 200);
  assert.ok(r.answer.includes(ent(jal.pronostico_52_total)), `falta total 52 sem Jalisco (${ent(jal.pronostico_52_total)})`);
  assert.doesNotMatch(r.answer, /prueba(?: retrospectiva)? de 2025[^.\n]{0,80}(?:18\.18|18\.2)/i);
  assert.doesNotMatch(r.answer, /(?:18\.18|18\.2)[^.\n]{0,80}evaluad[oa] retrospectivamente en[^.\n]*2025/i);
  assert.ok(r.answer.includes(wOr) && r.answer.includes(wObs));
  assert.ok(r.answer.includes(pct(jal.oos.smape)) || r.answer.includes(uno(jal.oos.smape)));
  assert.ok(r.answer.includes(pct(jal.oos.sesgo_pct)));
  assert.ok(r.answer.includes(ent(jal.oos.observado_total)) && r.answer.includes(ent(jal.oos.pronostico_total)));
  assert.match(r.answer, /no pertenecen a la prueba retrospectiva de 2025/i);
  if (jal.oos.semanas === 1) {
    assert.match(r.answer, /antes de emitir[\s\S]*no es prospectiv|no prospectiva respecto de la información/i);
  }
});

test('nacional A51: deriva cifras de vista.json, distingue portafolio rechazado de control no validado y contador técnico dinámico', async () => {
  const nac = VISTA_A51.series['nacional|mx|general'];
  const wa = VISTA_A51.weeks_available ?? 0;
  const wr = VISTA_A51.weeks_required ?? 4;
  if (wa === 1) {
    assert.equal(nac.pronostico_52_total, 23405);
    assert.equal(nac.oos.observado_total, 454);
    assert.equal(nac.oos.pronostico_total, 447);
    assert.equal(nac.oos.smape, 1.55);
    assert.equal(nac.oos.mae, 7);
  }
  const { status, r } = await consultar('¿Cuántos casos de sífilis adquirida A51-A53 se pronostican en México en las 52 semanas?');
  assert.equal(status, 200);
  assert.ok(r.answer.includes(ent(nac.pronostico_52_total)));
  assert.doesNotMatch(r.answer, /este portafolio no fue validado,\s*ya que fue rechazado/i);
  assert.match(r.answer, /control estacional,\s*no validado/i);
  assert.match(r.answer, /el rechazado fue el portafolio(?: seleccionado)?,\s*no el control/i);
  assert.match(r.answer, new RegExp(`${wa} de ${wr}[\\s\\S]{0,80}contador técnico`, 'i'));
  assert.ok(r.answer.includes(ent(nac.oos.observado_total)) && r.answer.includes(ent(nac.oos.pronostico_total)));
  assert.ok(r.answer.includes(pct(nac.oos.smape)));
  assert.match(r.answer, new RegExp(`MAE[^.\\n]{0,15}\\b${nac.oos.mae}\\b`, 'i'));
  assert.ok(r.answer.includes(sem(VISTA_A51.origin)) && r.answer.includes(sem(VISTA_A51.observation_cutoff)));
});

test('desambiguación geográfica México vs Estado de México vs CDMX, herencia de sexo y consulta de error por entidad', async () => {
  const edomex = VISTA_A51.series['estado|15|general'];
  const cdmx = VISTA_A51.series['estado|09|general'];
  const jal = VISTA_A51.series['estado|14|general'];
  const jalHom = VISTA_A51.series['estado|14|hombres'];

  const rEdo = (await consultar('¿Cuántos casos de sífilis adquirida se pronostican en el Estado de México?')).r;
  assert.ok(rEdo.answer.includes(ent(edomex.pronostico_52_total)));
  assert.match(rEdo.answer, /Estado de México/);

  const rCdmx = (await consultar('¿Cuántos casos de sífilis adquirida se pronostican en CDMX?')).r;
  assert.ok(rCdmx.answer.includes(ent(cdmx.pronostico_52_total)));

  const rHom = (await consultar('¿Y en hombres?', {
    history: [...HISTORIA_REAL_JALISCO, { role: 'user', text: '¿Y en Jalisco?' }, { role: 'assistant', text: 'En Jalisco.' }],
  })).r;
  assert.ok(rHom.answer.includes(ent(jalHom.pronostico_52_total)));
  assert.match(rHom.answer, /Jalisco.*hombres/i);

  const rErrJal = (await consultar('¿Cuál fue el error de sífilis adquirida en Jalisco?', { sinClave: true })).r;
  assert.equal(rErrJal.retrieval, 'vista');
  assert.ok(rErrJal.answer.includes(pct(jal.oos.smape)) && rErrJal.answer.includes(sem(VISTA_A51.observation_cutoff)));
  assert.match(rErrJal.answer, /no pertenecen a la prueba retrospectiva de 2025/i);

  const rEst = (await consultar('¿Y está validada?', { history: HISTORIA_REAL_JALISCO, sinClave: true })).r;
  assert.equal(rEst.retrieval, 'vista');
  assert.match(rEst.answer, /Sífilis adquirida \(A51-A53\): control estacional, no validado\./);
});

test('seguimientos clínicos y prioridad de crisis: O98.1 embarazo, A50 congénita, menores sin A50 explícita y crisis sin fallthrough', async () => {
  const histA51 = [{ role: 'user', text: 'sífilis adquirida en Jalisco' }, { role: 'assistant', text: 'Pronóstico en Jalisco.' }];
  const jalTxt = ent(VISTA_A51.series['estado|14|general'].pronostico_52_total);
  const nacTxt = ent(VISTA_A51.series['nacional|mx|general'].pronostico_52_total);
  const reCifrasA51 = new RegExp(`${jalTxt}|${nacTxt}`);

  for (const seg of ['¿y en el embarazo?', '¿y en mujeres embarazadas?', 'and in pregnant women?', '¿cuántos en embarazadas?']) {
    const { r } = await consultar(seg, { history: histA51 });
    assert.match(r.answer, /no modela[\s\S]*O98\.1/i, seg);
    assert.doesNotMatch(r.answer, reCifrasA51, seg);
  }
  for (const seg of ['¿y la congénita?', 'and congenital?', '¿y neonatal?']) {
    const { r } = await consultar(seg, { history: histA51 });
    assert.match(r.answer, /no modela[\s\S]*A50/i, seg);
    assert.doesNotMatch(r.answer, reCifrasA51, seg);
  }
  for (const seg of ['¿y en bebés?', '¿y en recién nacidos?', '¿y en menores?', 'and in babies?', 'sífilis adquirida en niños en Jalisco']) {
    const { r } = await consultar(seg, { history: seg.includes('sífilis') ? [] : histA51 });
    assert.match(r.answer, /sin estratificación por edad ni por embarazo/i, seg);
    assert.match(r.answer, /A50/, seg);
    assert.doesNotMatch(r.answer, reCifrasA51, seg);
  }
  for (const prev of ['sífilis congénita en Jalisco', 'sífilis en el embarazo en Jalisco']) {
    const { r } = await consultar('¿y en Sonora?', { history: [{ role: 'user', text: prev }] });
    assert.match(r.answer, /no modela/i, prev);
    assert.doesNotMatch(r.answer, /\d{1,3}(,\d{3})+/, prev);
  }
  const { r: rc } = await consultar('me quiero morir porque tengo sífilis adquirida', { history: histA51, sinClave: true });
  assert.match(rc.answer, /800 911 2000/);
  assert.match(rc.answer, /911/);
  assert.doesNotMatch(rc.answer, reCifrasA51);
});

test('regresión nativa V2 (guarda presión baja vs hipertensión I10): noModeladaSinVecino precede a vista y seguimiento', async () => {
  for (const q of [
    'presión arterial baja en el embarazo en Jalisco',
    'tensión arterial baja en embarazadas en Sonora',
    'hipotensión en Jalisco',
  ]) {
    const { status, r, gemini } = await consultar(q, { sinClave: true });
    assert.equal(status, 200, q);
    assert.equal(gemini, 0, q);
    assert.match(r.answer, /no modela/, q);
    assert.doesNotMatch(r.answer, /\d{1,3}(,\d{3})+|casos pronosticados/, q);
    assert.deepEqual(r.sources, [], q);
  }
  const { r: rSegBaja } = await consultar('¿y con presión arterial baja?', {
    history: [{ role: 'user', text: 'hipertensión arterial en Jalisco' }],
    sinClave: true,
  });
  assert.match(rSegBaja.answer, /no modela/);
  assert.deepEqual(rSegBaja.sources, []);
  const jalHip = VISTA_HIP.series['estado|14|general'];
  const { r: rHip, gemini: gHip } = await consultar('¿Cuántos casos de hipertensión arterial se pronostican en Jalisco?', { sinClave: true });
  assert.equal(gHip, 0);
  assert.equal(rHip.retrieval, 'vista');
  assert.ok(rHip.answer.includes(ent(jalHip.pronostico_52_total)));
  assert.match(rHip.answer, new RegExp(`${VISTA_HIP.weeks_available} de ${VISTA_HIP.weeks_required}`));
});

test('regresión nativa V2 (precedencia estadoDeControl y ruta vista D7): parotiditis/hiperplasia/monóxido sin contaminar', async () => {
  const errParo = uno(VISTA_PARO.caida_al_control.comprobaciones.find((c) => c.ambito === 'smape_bases').control);
  const { r: conf, gemini: gConf } = await consultar('¿Es confiable el pronóstico de parotiditis infecciosa en Jalisco?', { sinClave: true });
  assert.equal(gConf, 0);
  assert.equal(conf.retrieval, 'vista');
  assert.match(conf.answer, /control estacional, no validado/);
  assert.ok(conf.answer.includes(`${errParo} en las series por estado y sexo`), conf.answer);
  assert.match(conf.answer, /Por estado es una referencia poco informativa/);
  assert.deepEqual(conf.sources.map((s) => s.url), ['../parotiditis_b26.html']);

  const errProst = uno(VISTA_PROST.caida_al_control.comprobaciones.find((c) => c.ambito === 'smape_bases').control);
  const { r: hip } = await consultar('¿Está validado el pronóstico de hiperplasia de próstata?', { sinClave: true });
  assert.match(hip.answer, /el rechazado fue el portafolio, no el control/);
  assert.ok(hip.answer.includes(`${errProst} en las series por estado`), hip.answer);
  assert.deepEqual(hip.sources.map((s) => s.url), ['../hiperplasia_prostata_n40.html']);
  const paroJal = ent(VISTA_PARO.series['estado|14|general'].pronostico_52_total);
  const { r: numParo } = await consultar('¿Cuántos casos de parotiditis infecciosa se pronostican en Jalisco?', { sinClave: true });
  assert.equal(numParo.retrieval, 'vista');
  assert.ok(numParo.answer.includes(paroJal));
  const monoJal = ent(VISTA_MONO.series['estado|14|general'].pronostico_52_total);
  const { r: rMono, gemini: gMono } = await consultar('intoxicación por monóxido de carbono en Jalisco');
  assert.equal(gMono, 0);
  assert.equal(rMono.retrieval, 'vista');
  assert.equal(rMono.guarda, undefined);
  assert.ok(rMono.answer.includes(monoJal));
  assert.doesNotMatch(rMono.answer, /sifilis_adquirida_a51|a18527def134|Sífilis adquirida/i);
  const { r: rPlag, gemini: gPlag } = await consultar('plaguicidas nacional');
  assert.equal(rPlag.retrieval, 'semantic');
  assert.ok(gPlag > 0);
});

test('vulvovaginitis sin sexo y mal del pinto aceptado con semanas/veredicto derivados de vista.json sin contaminar con A51', async () => {
  const { r: rNoSexSeg } = await consultar('¿y para hombres?', {
    history: [{ role: 'user', text: '¿Cuántos casos de vulvovaginitis se pronostican en Jalisco?' }],
    sinClave: true,
  });
  assert.match(rNoSexSeg.answer, /no desglosa sexo; sus 37 series publicadas son por entidad y nacional, así que no existe pronóstico para hombres/);

  const chp = VISTA_PINTO.series['estado|07|general'];
  const wa = VISTA_PINTO.weeks_available ?? 0;
  const wr = VISTA_PINTO.weeks_required ?? 4;
  const verdict = VISTA_PINTO.verdict;
  const { r: rPinto } = await consultar('¿Cuántos casos de mal del pinto se esperan en Chiapas?', { sinClave: true });
  assert.equal(rPinto.retrieval, 'vista');
  assert.ok(rPinto.answer.includes(ent(chp.pronostico_52_total)));
  assert.match(rPinto.answer, /aceptado en la prueba única retrospectiva de 2025/i);
  assert.match(rPinto.answer, new RegExp(`${wa} de ${wr}[\\s\\S]{0,80}${verdict}`));
  assert.doesNotMatch(rPinto.answer, /control estacional, no validado|el rechazado fue el portafolio/i);
  assert.doesNotMatch(rPinto.answer, /0cc942faddb8|eaca7efc1a11|a18527def134|boletín 44|01:23:31/i);
});

test('vía semántica en servidor: contexto temporal separa vista de 2025 y snippets llevan proveniencia derivada', async () => {
  const wa = VISTA_A51.weeks_available ?? 0;
  const wr = VISTA_A51.weeks_required ?? 4;
  const wObs = sem(VISTA_A51.observation_cutoff);
  const { r, sistema } = await consultar('¿Por qué fallaron los candidatos ETS y Ridge en sífilis adquirida?');
  assert.equal(r.retrieval, 'semantic');
  assert.ok(sistema);
  assert.match(sistema, new RegExp(`${wObs}[\\s\\S]{0,80}NO prueba 2025`));
  assert.doesNotMatch(sistema, /las semanas evaluadas se registraron después de la emisión/);

  const snips = r.sources.map((s) => s.snippet || '');
  assert.ok(snips.length >= 3);
  for (const sn of snips) assert.doesNotMatch(sn, /las semanas evaluadas se registraron después de la emisión/);
  assert.ok(snips.some((sn) => new RegExp(`Control estacional no validado.*portafolio rechazado en prueba única 2025.*${wa}\\/${wr} contador técnico`).test(sn)));
  assert.ok(snips.some((sn) => new RegExp(`vista ${wObs} \\(no 2025\\)|Vista por entidad en ${wObs}`).test(sn)));
});

test('cero valores numéricos de releases hardcodeados en rag.mjs, vista_grounding.mjs ni vista_turno.mjs', () => {
  const codigo = [
    readFileSync(new URL('../netlify/functions/rag.mjs', import.meta.url), 'utf8'),
    readFileSync(new URL('../netlify/lib/vista_grounding.mjs', import.meta.url), 'utf8'),
    readFileSync(new URL('../netlify/lib/vista_turno.mjs', import.meta.url), 'utf8'),
  ].join('\n');
  for (const prohibido of [
    '23405', '23,405', '2147', '2,147', '51404', '51,404', '24074', '24,074',
    '97.3', '25.0', '454', '447', '1.55', '18.18', '18.2', '76.4', '64.2', '27.716934', '111.3',
  ]) {
    assert.ok(!codigo.includes(prohibido), `valor hardcodeado prohibido: ${prohibido}`);
  }
});
