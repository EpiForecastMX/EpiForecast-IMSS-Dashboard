/**
 * Lote alta_b44 (19-nov-2026): 59 releases del boletín 44 en el EpiBot y en la función RAG.
 *
 * - Crisis antes que datos: los temas sensibles se publicaron con OK nominal del autor SIN revisión clínica acreditada.
 *   Toda consulta de riesgo personal o de violencia vivida («tengo ganas de morir», «me pegan») y todo término genérico de
 *   suicidio o autolesión («suicidio en jalisco», «intento de suicidio») recibe la respuesta de crisis con la Línea de la Vida,
 *   sin cifras ni gráfica; sólo el código o el rótulo técnico completo de un release sensible abre su ficha, y nunca si la
 *   consulta trae además una señal de riesgo personal.
 * - Controles sin alternativa (rolling_cv_historia_corta_2024_v1, `portafolio_igual_al_control`): control estacional, no
 *   validado, nunca «validación en curso», aunque la etiqueta sellada del shard lo diga.
 * - Cada release responde por su consulta y su código; los nombres genéricos que abarcan varios bloques piden precisar.
 * Con el código anterior fallan: la crisis de «me pegan» y de «suicidio en jalisco», los controles sin alternativa, los
 * vecinos (sífilis congénita, gonorrea, B30.3, meningitis, G00.0/G00.1) y el numeral de ciento cuarenta y cinco.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';

const raiz = new URL('../../', import.meta.url);
const K = readFileSync(new URL('epibot/knowledge.json', raiz), 'utf-8');
globalThis.fetch = async (u) => {
  const s = String(u);
  const v = s.match(/publication\/([a-z0-9_]+)\/vista\.json/);
  const b = s.match(/(assets\/boletin\/[^?]+\.json)/);
  const ruta = v ? `publication/${v[1]}/vista.json` : b ? b[1] : null;
  try {
    return { ok: true, json: async () => JSON.parse(ruta ? readFileSync(new URL(ruta, raiz), 'utf-8') : K) };
  } catch {
    return { ok: false, json: async () => null };
  }
};
const kb = await import('../js/kb.js');
const { detectEntities } = await import('../js/entities.js');
const { RELEASES, releaseDeId } = await import('../js/release_config.js');
const { esControl, etiquetaVisible, ETIQUETA_SIN_ALTERNATIVA } = await import('../js/obesidad_kb.js');
const unified = await import('../../assets/dashboard/unified.mjs');
const corpus = await import('../scripts/lib/corpus.mjs');
const rag = await import('../netlify/functions/rag.mjs');
const d = await kb.loadKnowledge();
await d.obesidad_pendiente;

const IDS = [
  'alacran_t63', 'mordedura_perro_w54', 'mordedura_mamiferos_w55', 'toxoplasmosis_b58', 'teniasis_b68', 'cisticercosis_b69',
  'triquinosis_b75', 'conjuntivitis_hemorragica_b303', 'tracoma_a71', 'hipotermia_t68', 'tetanos_a34', 'viruela_simica_b04',
  'vph_b97', 'gonococica_a54', 'linfogranuloma_a55', 'chancro_blando_a57', 'herpes_genital_a600', 'tricomoniasis_a590',
  'paralisis_flacida_u98', 'iaas_sc', 'intox_alcohol_f100', 'alcoholica_higado_k70', 'anencefalia_q00', 'encefalocele_q01',
  'microcefalia_q02', 'espina_bifida_q05', 'labio_paladar_q35', 'viuda_negra_u602', 'violinista_u603', 'otras_aranas_t633',
  'abeja_u604', 'avispa_u605', 'otros_artropodos_t634', 'otros_ponzonosos_t631', 'mordedura_cascabel_u600',
  'mordedura_coral_u601', 'mordedura_otras_serpientes_t630', 'cirrosis_alcoholica_k703', 'chikungunya_a920',
  'envenenamiento_analgesicos_x60', 'envenenamiento_psicotropicos_x61', 'ahorcamiento_x70', 'disparo_arma_corta_x72',
  'objeto_cortante_x78', 'salto_lugar_elevado_x80', 'intento_suicidio_z915', 'ideacion_suicida_r458',
  'violencia_intrafamiliar_y07', 'tuberculosis_otras_formas_a171', 'chagas_aguda_b570', 'tifo_murino_a752',
  'sifilis_congenita_a50', 'esavi_y58', 'meningococica_a39', 'neumococo_a40', 'haemophilus_a41', 'herida_arma_fuego_w32',
  'chagas_cronica_b572', 'vih_b20',
];
const SENSIBLES = ['envenenamiento_analgesicos_x60', 'envenenamiento_psicotropicos_x61', 'ahorcamiento_x70',
  'disparo_arma_corta_x72', 'objeto_cortante_x78', 'salto_lugar_elevado_x80', 'intento_suicidio_z915',
  'ideacion_suicida_r458', 'violencia_intrafamiliar_y07', 'herida_arma_fuego_w32', 'intox_alcohol_f100', 'vih_b20'];
const vista = (id) => JSON.parse(readFileSync(new URL(`publication/${id}/vista.json`, raiz), 'utf-8'));
const SIN_ALT = IDS.filter((id) => vista(id).portafolio_igual_al_control === true);

async function pregunta(...qs) {
  kb._resetContext();
  let r;
  for (const q of qs) r = await kb.answerWithTrace(q);
  kb._resetContext();
  return { handler: r.handler, md: String(r.response ?? '') };
}
async function postRag(query) {
  const res = await rag.default(new Request('http://x/.netlify/functions/rag', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query }),
  }));
  return { status: res.status, body: await res.json() };
}

test('catálogo: los 59 releases del lote (y los 6 del lote 6) están instalados y declarados, con 151 padecimientos en el sitio', () => {
  const instalados = new Set(JSON.parse(readFileSync(new URL('publication/catalog.json', raiz), 'utf-8')).releases.map((r) => r.disease_id));
  for (const id of IDS) assert.ok(releaseDeId(id) && instalados.has(id), id);
  assert.equal(RELEASES.length + 4, 151);
  assert.deepEqual(RELEASES.filter((r) => r.sensible).map((r) => r.id).sort(), [...SENSIBLES].sort());
  assert.equal(SIN_ALT.length, 10);
  assert.deepEqual(RELEASES.filter((r) => r.controlSinAlternativa).map((r) => r.id).sort(), [...SIN_ALT].sort());
  for (const r of RELEASES.filter((x) => x.sensible)) {
    // Sin términos genéricos de riesgo personal: sólo el rótulo técnico completo y códigos.
    for (const a of r.alias) assert.doesNotMatch(a, /^(suicidio|suicida|intento de suicidio|ideacion suicida|autolesion|sida)$/, `${r.id}: ${a}`);
  }
});

const CRISIS = ['tengo ganas de morir', 'me quiero matar', 'me pegan', 'mi pareja me golpea', 'mi esposo me pega',
  'abusaron de mí', 'suicidio en jalisco', 'suicidio en Jalisco 2025', 'intento de suicidio en jalisco',
  'ideación suicida en jalisco', 'autolesiones en sonora', 'lesiones autoinfligidas en Jalisco', 'suicide in jalisco',
  'my partner hits me', 'R45.8 en jalisco, tengo ideación suicida', 'X70 en Jalisco porque me quiero matar'];
for (const q of CRISIS) {
  test(`crisis: «${q}» recibe la Línea de la Vida, sin cifras ni gráfica (EpiBot y RAG)`, async () => {
    const { handler, md } = await pregunta(q);
    assert.equal(handler, 'answerCrisis', q);
    assert.match(md, /800 911 2000/);
    assert.match(md, /<!--SIN_GRAFICA-->/);
    assert.doesNotMatch(md.replace(/800 911 2000|911|24 horas|24 hours/g, ''), /\d/, q);
    const { status, body } = await postRag(q);
    assert.equal(status, 200);
    assert.match(body.answer, /800 911 2000/);
    assert.doesNotMatch(body.answer.replace(/800 911 2000|911|24 horas|24 hours/g, ''), /\d/, q);
    assert.deepEqual(body.sources ?? [], []);
  });
}

test('crisis gana al contexto de un release sensible y no lo hereda', async () => {
  const r = await pregunta('X60 en Jalisco', 'me quiero morir');
  assert.equal(r.handler, 'answerCrisis');
  assert.doesNotMatch(r.md, /ENVENENAMIENTO_ANALGESICOS_X60|casos/);
});

for (const [q, id] of [['X60 en Jalisco', 'envenenamiento_analgesicos_x60'], ['Z91.5 en Jalisco', 'intento_suicidio_z915'],
  ['Historia personal de lesión autoinfligida intencionalmente (intento de suicidio) en Jalisco', 'intento_suicidio_z915'],
  ['R45.8 en Sonora', 'ideacion_suicida_r458'], ['x78 nacional', 'objeto_cortante_x78'],
  ['violencia intrafamiliar en Jalisco', 'violencia_intrafamiliar_y07'], ['Y07.1 en Jalisco', 'violencia_intrafamiliar_y07'],
  ['herida por arma de fuego en Sonora', 'herida_arma_fuego_w32'], ['intoxicación aguda por alcohol en Jalisco', 'intox_alcohol_f100'],
  ['VIH en Veracruz', 'vih_b20'], ['B24 en Veracruz', 'vih_b20']]) {
  test(`sensible técnico: «${q}» abre su ficha con la línea de apoyo, nunca la tabla neuro`, async () => {
    const { handler, md } = await pregunta(q);
    assert.equal(handler, 'answerObesidad', q);
    assert.match(md, new RegExp(`<!--${releaseDeId(id).marca}:`), q);
    assert.match(md, /Línea de la Vida[\s\S]*800 911 2000/, q);
  });
}

test('«sida» sigue sin modelarse: es otra definición, no el VIH publicado', async () => {
  const { md } = await pregunta('casos de sida en jalisco');
  assert.doesNotMatch(md, /VIH_B20:/);
});

for (const id of IDS) {
  test(`release: «${releaseDeId(id).consulta} en Jalisco» responde ${id} y detectEntities de rag.mjs lo reconoce`, async () => {
    const r = releaseDeId(id);
    const { md } = await pregunta(`${r.consulta} en Jalisco`);
    assert.match(md, new RegExp(`<!--${r.marca}:`), id);
    assert.equal(detectEntities(`${r.consulta} en Jalisco`).padecimiento, r.pad, id);
    if (esControl(vista(id))) {
      assert.match(md, /control estacional, no validado/i, id);
      assert.doesNotMatch(md, /Validación prospectiva en curso/, id);
    }
  });
}

for (const id of SIN_ALT) {
  test(`control sin alternativa: ${id} se presenta como control, nunca «en curso», en tablero, bot, RAG y corpus`, async () => {
    const v = vista(id);
    assert.match(v.publication_label, /en curso/, 'la etiqueta sellada del shard dice «en curso»');
    assert.equal(etiquetaVisible(v), ETIQUETA_SIN_ALTERNATIVA);
    assert.equal(unified.statusFromView(v).kind, 'control');
    assert.doesNotMatch(unified.statusFromView(v).label, /en curso/);
    const r = releaseDeId(id);
    assert.ok(r.pruebaSinAlternativa && r.pruebaSinAlternativa.fold === 'test_2026', id);
    const { md } = await pregunta(`${r.consulta} nacional`);
    assert.match(md, /no hubo otro motor que elegir/);
    assert.doesNotMatch(md, /Validación prospectiva en curso/);
    const { body } = await postRag(`¿está validado el pronóstico de ${r.consulta}?`);
    assert.match(body.answer, /control estacional, no validado/);
    assert.doesNotMatch(body.answer, /validación prospectiva está en curso|en curso \(/);
    const sellado = readFileSync(new URL(`publication/${id}/${v.release_id}/corpus/${id}.md`, raiz), 'utf-8');
    const vigente = corpus.conEstadoVigente(sellado, { disease_id: id, publication_label: v.publication_label },
      new URL('.', raiz).pathname, true);
    assert.doesNotMatch(vigente, /Validación prospectiva en curso|El veredicto del gate congelado es INCOMPLETE/);
    assert.match(vigente, /sólo puede dar CONTROL_ONLY/);
  });
}

for (const q of ['sífilis en Jalisco', 'tétanos en Jalisco', 'tuberculosis en Jalisco', 'chagas en Jalisco',
  'picadura en Sonora', 'mordedura en Sonora', 'mordedura de serpiente en Jalisco', 'mordedura de araña en Jalisco',
  'alcohol en Jalisco', 'cirrosis en Jalisco', 'meningococo en Jalisco', 'neumococo en Jalisco', 'gonorrea en Jalisco',
  'tifo en Jalisco', 'K70 en Jalisco', 'meningitis en Jalisco', 'chancro en Jalisco']) {
  test(`ambiguo: «${q}» pide precisar sin cifras`, async () => {
    const { handler, md } = await pregunta(q);
    assert.equal(handler, 'answerAliasAmbiguo', q);
    assert.doesNotMatch(md, /casos pronosticados|Pronóstico \*\*congelado\*\*|<!--[A-Z0-9_]+:\{/, q);
  });
}

for (const [q, marca] of [['sífilis congénita en Jalisco', 'SIFILIS_CONGENITA_A50'], ['A50 en Jalisco', 'SIFILIS_CONGENITA_A50'],
  ['conjuntivitis hemorrágica en Jalisco', 'CONJUNTIVITIS_HEMORRAGICA_B303'], ['meningitis meningocócica nacional', 'MENINGOCOCICA_A39'],
  ['gonorrea genitourinaria en Jalisco', 'GONOCOCICA_A54'], ['chancro blando en Jalisco', 'CHANCRO_BLANDO_A57'],
  ['tétanos A34 en Jalisco', 'TETANOS_A34'], ['chagas crónica en Jalisco', 'CHAGAS_CRONICA_B572'],
  ['picadura de alacrán en Sonora', 'ALACRAN_T63'], ['serpiente de cascabel en Sonora', 'MORDEDURA_CASCABEL_U600'],
  ['cirrosis alcohólica en Jalisco', 'CIRROSIS_ALCOHOLICA_K703'], ['chikungunya en Jalisco', 'CHIKUNGUNYA_A920']]) {
  test(`vecino publicado: «${q}» responde ${marca}`, async () => {
    const { md } = await pregunta(q);
    assert.match(md, new RegExp(`<!--${marca}:`), q);
  });
}

for (const [q, re] of [['meningitis por Haemophilus en Jalisco', /haemophilus_a41\.html/], ['G00.1 en Jalisco', /neumococo_a40\.html/],
  ['neumonía neumocócica en Jalisco', /enfermedad invasiva por neumococo/], ['hepatitis alcohólica en Jalisco', /K70\.1/],
  ['tétanos neonatal en Jalisco', /A33/], ['leishmaniasis visceral en Jalisco', /B55\.0/]]) {
  test(`subtipo sin serie propia: «${q}» se aclara sin cifras`, async () => {
    const { md } = await pregunta(q);
    assert.match(md, re, q);
    assert.doesNotMatch(md, /casos pronosticados|Pronóstico \*\*congelado\*\*|<!--[A-Z0-9_]+:\{/, q);
  });
}

// Lote 6 (19-nov-2026): la tuberculosis respiratoria, la meningitis tuberculosa y la leishmaniasis cutánea tienen su propio
// release; «tuberculosis», «rickettsiosis» y «leishmaniasis» a secas piden precisar sin cifras.
for (const [q, marca] of [['tuberculosis pulmonar en Jalisco', 'TUBERCULOSIS_RESPIRATORIA_A15'],
  ['meningitis tuberculosa en Jalisco', 'MENINGITIS_TUBERCULOSA_A170'], ['lepra en Sonora', 'LEPRA_A30'],
  ['otras rickettsiosis en Sonora', 'OTRAS_RICKETTSIOSIS_A79'], ['fiebre manchada en Sonora', 'FIEBRE_MANCHADA_A770'],
  ['leishmaniasis cutánea en Quintana Roo', 'LEISHMANIASIS_CUTANEA_B551']]) {
  test(`lote 6: «${q}» responde su release`, async () => {
    const { md } = await pregunta(q);
    assert.match(md, new RegExp(`<!--${marca}:`), q);
  });
}
for (const [q, nombra] of [['tuberculosis en Jalisco', /tuberculosis respiratoria.*meningitis tuberculosa.*otras formas/s],
  ['rickettsiosis en Sonora', /fiebre manchada.*tifo murino.*otras rickettsiosis/s], ['leishmaniasis en Jalisco', /visceral/]]) {
  test(`lote 6: «${q}» pide precisar sin cifras`, async () => {
    const { md } = await pregunta(q);
    assert.match(md, nombra, q);
    assert.doesNotMatch(md, /Pronóstico \*\*congelado\*\*|<!--[A-Z0-9_]+:\{/, q);
  });
}

test('el número de padecimientos se escribe en letra más allá de noventa y nueve', async () => {
  const { md } = await pregunta('casos de diabetes insipida en jalisco');
  assert.match(md, /ciento cincuenta y un padecimientos/);
});
