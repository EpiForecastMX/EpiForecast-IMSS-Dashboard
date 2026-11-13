/**
 * Alcance de los diez controles estacionales publicados tras el rechazo de 2025 por autorización del
 * autor (12-nov-2026). Cada consulta clara llega a su release y se declara control no validado; los
 * subtipos con código propio no reciben cifras de un bloque publicado; los términos genéricos piden
 * precisar; los cinco rechazos no autorizados siguen sin modelarse.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';

const K = readFileSync(new URL('../knowledge.json', import.meta.url), 'utf-8');
const vista = (u) => String(u).match(/publication\/([a-z0-9_]+)\/vista\.json/);
globalThis.fetch = async (u) => ({
  ok: true,
  json: async () => JSON.parse(vista(u)
    ? readFileSync(new URL(`../../publication/${vista(u)[1]}/vista.json`, import.meta.url), 'utf-8') : K),
});
const kb = await import('../js/kb.js');
const { norm } = await import('../js/entities.js?v=55');
const { mencionaNoModelada, aliasAmbiguo, subtipoAjeno } = await import('../js/release_config.js?v=21');
const d = await kb.loadKnowledge();
await d.obesidad_pendiente;

async function pregunta(q) {
  kb._resetContext();
  const r = await kb.answerWithTrace(q);
  kb._resetContext();
  return { handler: r.handler, md: String(r.response ?? '') };
}

const MARCAS = /QUEMADURAS_T20|IVP_I87|HIPERPLASIA_PROSTATA_N40|ESCABIOSIS_B86|PROTOZOARIOS_A07|FARINGITIS_J02|PEATON_V01|DISPLASIA_LEVE_N87|VARICELA_B01|PAROTIDITIS_B26/;
const VECINOS = /INTESTINALES_A04|IRA_J00|VEHICULOS_V20|CANCER_PROSTATA_C61|CANCER_CUELLO_UTERO_C53/;

const POSITIVOS = [
  ['quemaduras en Jalisco', 'QUEMADURAS_T20'], ['insuficiencia venosa periférica en Sonora', 'IVP_I87'],
  ['hiperplasia de la próstata en Jalisco', 'HIPERPLASIA_PROSTATA_N40'], ['escabiosis en Puebla', 'ESCABIOSIS_B86'],
  ['sarna en Oaxaca', 'ESCABIOSIS_B86'],
  ['otras infecciones intestinales debidas a protozoarios en Jalisco', 'PROTOZOARIOS_A07'],
  ['faringitis y amigdalitis estreptocócicas en Jalisco', 'FARINGITIS_J02'], ['faringitis estreptocócica en Sonora', 'FARINGITIS_J02'],
  ['peatón lesionado en accidente de transporte en Jalisco', 'PEATON_V01'], ['atropellados en Sonora', 'PEATON_V01'],
  ['displasia cervical leve y moderada en Jalisco', 'DISPLASIA_LEVE_N87'], ['varicela en Puebla', 'VARICELA_B01'],
  ['parotiditis infecciosa en Jalisco', 'PAROTIDITIS_B26'], ['paperas en Sonora', 'PAROTIDITIS_B26'],
];
for (const [q, marca] of POSITIVOS) {
  test(`control: «${q}» responde su release como control no validado`, async () => {
    const { md } = await pregunta(q);
    assert.match(md, new RegExp(marca));
    assert.match(md, /control estacional, no validado/);
    assert.match(md, /Error del control en la prueba de 2025 \(sMAPE\): \d+\.\d en las series por estado/);
    assert.doesNotMatch(md, /Validación prospectiva en curso|PASS|validación en curso/);
    assert.doesNotMatch(md, VECINOS);
  });
}

test('sólo los tres declarados advierten que por estado son referencia poco informativa', async () => {
  for (const [q, cifra] of [['parotiditis en jalisco', '97.3'], ['peatón lesionado en jalisco', '84.8'], ['otras infecciones intestinales debidas a protozoarios en jalisco', '71.0']]) {
    const { md } = await pregunta(q);
    assert.match(md, new RegExp(`Por estado es una referencia poco informativa: su error en las series por estado y sexo fue sMAPE ${cifra.replace('.', '\\.')}`), q);
  }
  for (const q of ['escabiosis en jalisco', 'quemaduras en jalisco', 'displasia cervical leve en jalisco']) {
    assert.doesNotMatch((await pregunta(q)).md, /poco informativa/, q);
  }
});

test('sin sexo: hiperplasia y displasia no ofrecen desglose por sexo', async () => {
  for (const q of ['hiperplasia de la próstata en Jalisco hombres', 'displasia cervical leve en Jalisco mujeres']) {
    const { md } = await pregunta(q);
    assert.match(md, /sexo/i, q);
    assert.doesNotMatch(md, /· Hombres\*\*|· Mujeres\*\*/, q);
  }
});

const AJENOS = [
  'giardiasis en Jalisco', 'A07.1 en Sonora', 'faringitis viral en Jalisco', 'J02.9 en Sonora',
  'N87.9 en Jalisco',
  'herpes zóster en Jalisco', 'quemaduras solares en Sonora', 'várices en Jalisco', 'parotiditis bacteriana en Puebla',
];
for (const q of AJENOS) {
  test(`fuera del bloque: «${q}» no recibe cifras`, async () => {
    assert.ok(mencionaNoModelada(norm(q)), 'mencionaNoModelada');
    const { md } = await pregunta(q);
    assert.doesNotMatch(md, MARCAS);
    assert.doesNotMatch(md, VECINOS);
    assert.doesNotMatch(md, /casos pronosticados|Pronóstico \*\*congelado\*\*/);
  });
}

// «Displasia cervical» abarca dos bloques publicados desde alta10b: release null y ambos nombrados (test_alcance_alta10b.mjs).
for (const [q, release] of [['faringitis en Jalisco', 'faringitis_j02'], ['amigdalitis en Sonora', 'faringitis_j02'], ['displasia cervical en Jalisco', null]]) {
  test(`ambiguo: «${q}» pide precisar sin cifras`, async () => {
    assert.equal(aliasAmbiguo(norm(q))?.release, release);
    const { md } = await pregunta(q);
    assert.doesNotMatch(md, MARCAS);
    assert.doesNotMatch(md, /casos pronosticados/);
  });
}

test('vecinos: el cáncer de próstata sigue en C61, peatones no son vehículos con motor y A04 no absorbe A07', async () => {
  const c61 = await pregunta('cáncer de próstata en Jalisco');
  assert.match(c61.md, /CANCER_PROSTATA_C61/);
  assert.doesNotMatch(c61.md, /HIPERPLASIA/);
  const hip = await pregunta('hiperplasia de la próstata en Sonora');
  assert.doesNotMatch(hip.md, /CANCER_PROSTATA_C61/);
  const v = await pregunta('accidentes en vehículos con motor en Jalisco');
  assert.match(v.md, /VEHICULOS_V20/);
  assert.doesNotMatch(v.md, /PEATON_V01/);
  const a04 = await pregunta('infecciones intestinales en Jalisco');
  assert.match(a04.md, /INTESTINALES_A04/);
  assert.doesNotMatch(a04.md, /PROTOZOARIOS_A07/);
  assert.equal(subtipoAjeno(norm('peatón lesionado en jalisco')), null);
});

// Salmonelosis, tifoidea, escarlatina, hepatitis C y displasia severa se publicaron como controles en alta10b.
for (const q of ['fiebre paratifoidea en Sonora', 'hepatitis B en Jalisco', 'desnutrición moderada en Jalisco', 'enterobiasis en Jalisco']) {
  test(`rechazo no autorizado: «${q}» sigue sin cifras de un release`, async () => {
    const { md } = await pregunta(q);
    assert.doesNotMatch(md, /MARCA:|casos pronosticados|Pronóstico \*\*congelado\*\*/);
  });
}

const rag = await import('../netlify/functions/rag.mjs');
async function postRag(query) {
  const res = await rag.default(new Request('http://x/.netlify/functions/rag', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query }),
  }));
  return { status: res.status, body: await res.json() };
}
for (const q of ['giardiasis en Jalisco', 'herpes zóster en Jalisco', 'faringitis en Jalisco', 'hepatitis B en Jalisco']) {
  test(`RAG real: «${q}» responde sin modelo ni cifras`, async () => {
    const { status, body } = await postRag(q);
    assert.equal(status, 200);
    assert.doesNotMatch(body.answer, /\d{1,3}(,\d{3})+|casos pronosticados/);
    assert.deepEqual(body.sources, []);
  });
}

// Revisión final de Fable (12-nov-2026): cada hallazgo con su regresión.
const SIN_CIFRAS = (md) => { assert.doesNotMatch(md, MARCAS); assert.doesNotMatch(md, VECINOS); assert.doesNotMatch(md, /casos pronosticados|Pronóstico \*\*congelado\*\*/); };

for (const q of ['insuficiencia venosa I87.0 en Jalisco', 'insuficiencia venosa I87.1 en Jalisco', 'insuficiencia venosa i87 8 en Jalisco',
  'insuficiencia venosa I879 en Jalisco', 'síndrome postrombótico en Jalisco', 'hiperplasia de próstata N41 en Jalisco',
  'escabiosis B85 en Jalisco', 'quemaduras T33 en Jalisco', 'displasia cervical leve, moderada y severa en Jalisco',
  'infecciones intestinales por protozoos en Jalisco', 'intestinal infections due to protozoa in Jalisco',
  'infecciones intestinales por protozoarios en Jalisco', 'varicela zoster en Jalisco', 'amigdalitis viral en Jalisco']) {
  test(`revisión final: «${q}» no recibe cifras de un bloque que no la cubre`, async () => {
    SIN_CIFRAS((await pregunta(q)).md);
  });
}

for (const [q, marca] of [['insuficiencia venosa I87.2 en Jalisco', 'IVP_I87'], ['hiperplasia de la próstata N40 en Jalisco', 'HIPERPLASIA_PROSTATA_N40'],
  ['escabiosis B86 en Jalisco', 'ESCABIOSIS_B86'], ['quemaduras T20 en Jalisco', 'QUEMADURAS_T20'], ['quemaduras T32 en Jalisco', 'QUEMADURAS_T20'],
  ['otras infecciones intestinales debidas a protozoarios en Jalisco', 'PROTOZOARIOS_A07'], ['parotiditis en jalisco w42', 'PAROTIDITIS_B26']]) {
  test(`revisión final: «${q}» conserva su release`, async () => {
    assert.match((await pregunta(q)).md, new RegExp(marca));
  });
}

test('revisión final: textos exactos de parotiditis, varicela zóster y amigdalitis', async () => {
  const pb = await pregunta('parotiditis bacteriana en Jalisco');
  assert.doesNotMatch(pb.md, /no infecciosa/);
  assert.match(pb.md, /no debida al virus de las paperas/);
  const vz = await pregunta('varicela zoster en Jalisco');
  assert.doesNotMatch(vz.md, /no modela herpes z/);
  assert.match(vz.md, /varicela \(B01\) y el herpes zóster \(B02\)/);
  assert.match((await pregunta('herpes zóster en Jalisco')).md, /no modela herpes zóster \(B02\)/);
  const am = await pregunta('amigdalitis viral en Jalisco');
  assert.match(am.md, /dentro del bloque de infecciones respiratorias agudas/);
  assert.doesNotMatch(am.md, /no modela/);
  const fv = await pregunta('faringitis viral en Jalisco');
  assert.match(fv.md, /no modela faringitis aguda no estreptocócica \(J02\.8-J02\.9\)/);
  const pr = await pregunta('infecciones intestinales por protozoos en Jalisco');
  assert.match(pr.md, /giardiasis \(A07\.1\)/);
});

test('revisión final: el nombre corto de A07 no abarca protozoosis no intestinales', async () => {
  const { releaseDeId } = await import('../js/release_config.js?v=21');
  assert.equal(releaseDeId('protozoarios_a07').nombreCorto, 'Otras protozoosis intestinales');
  assert.match((await pregunta(releaseDeId('protozoarios_a07').consulta + ' en jalisco')).md, /PROTOZOARIOS_A07/);
});

for (const q of ['insuficiencia venosa I87.0 en Jalisco', 'escabiosis B85 en Jalisco', 'varicela zoster en Jalisco', 'infecciones intestinales por protozoos en Jalisco']) {
  test(`RAG real (revisión final): «${q}» sin cifras`, async () => {
    const { status, body } = await postRag(q);
    assert.equal(status, 200);
    assert.doesNotMatch(body.answer, /\d{1,3}(,\d{3})+|casos pronosticados/);
    assert.deepEqual(body.sources, []);
  });
}

test('revisión final: «I87» sin decimal pide precisar y una unidad no se lee como decimal', async () => {
  assert.equal(aliasAmbiguo(norm('insuficiencia venosa i87 en jalisco'))?.release, 'ivp_i87');
  assert.match((await pregunta('quemaduras t20 2 semanas en jalisco')).md, /QUEMADURAS_T20/);
});

// Supervisor tras la revisión final: un nombre con el código de OTRO bloque publicado no es «no modelado».
for (const [q, nombre, codigo] of [['escabiosis B01 en Jalisco', 'escabiosis', 'B01'], ['insuficiencia venosa N40 en Jalisco', 'insuficiencia venosa periférica', 'N40']]) {
  test(`contradicción nombre-código: «${q}» aclara sin cifras ni «no modela»`, async () => {
    const { md } = await pregunta(q);
    SIN_CIFRAS(md);
    assert.doesNotMatch(md, new RegExp(`no modela[^.]*${codigo}`));
    assert.match(md, new RegExp(`«${nombre}» corresponde a .*el código ${codigo} corresponde a otro bloque publicado`));
    const { body } = await postRag(q);
    assert.doesNotMatch(body.answer, /no modela|\d{1,3}(,\d{3})+/);
    assert.match(body.answer, new RegExp(`el código ${codigo} corresponde a otro bloque publicado`));
    assert.deepEqual(body.sources, []);
  });
}

test('una comparación explícita con código no se trata como contradicción', async () => {
  assert.equal(aliasAmbiguo(norm('comparar escabiosis y B01 en jalisco')), null);
});

// Preview real (12-nov-2026): «¿es confiable … parotiditis en Jalisco?» mezcló el pasaje legacy de
// «fallback regional»; «¿está validado … hiperplasia?» trajo fuentes de C61 y llamó «rechazado» al control.
// El estado de un control se responde desde su vista, sin recuperación: aunque el índice traiga un
// pasaje contaminante, no puede entrar en la respuesta.
test('RAG real: el estado de un control sale de su vista, sin fuentes ajenas', async () => {
  const conf = await postRag('¿Es confiable el pronóstico de parotiditis infecciosa en Jalisco?');
  assert.equal(conf.status, 200);
  assert.match(conf.body.answer, /control estacional, no validado/);
  assert.match(conf.body.answer, /97\.3 en las series por estado y sexo/);
  assert.match(conf.body.answer, /Por estado es una referencia poco informativa/);
  assert.doesNotMatch(conf.body.answer, /regional|fallback|Depresi|Parkinson|Alzheimer/i);
  assert.deepEqual(conf.body.sources.map((s) => s.url), ['../parotiditis_b26.html']);
  const hip = await postRag('¿Está validado el pronóstico de hiperplasia de próstata?');
  assert.match(hip.body.answer, /el rechazado fue el portafolio, no el control/);
  assert.match(hip.body.answer, /25\.0 en las series por estado/);
  assert.doesNotMatch(hip.body.answer, /C61|tumor maligno|control rechazado/i);
  assert.deepEqual(hip.body.sources.map((s) => s.url), ['../hiperplasia_prostata_n40.html']);
  // Un aceptado no recibe este texto, y una comparación de dos releases tampoco.
  const acep = await postRag('¿Está validado el pronóstico de shigelosis?');
  assert.doesNotMatch(String(acep.body.answer || ''), /control estacional, no validado/);
});
