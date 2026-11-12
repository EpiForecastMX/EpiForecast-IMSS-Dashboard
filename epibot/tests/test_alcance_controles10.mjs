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
  for (const [q, cifra] of [['parotiditis en jalisco', '97.3'], ['peatón lesionado en jalisco', '84.8'], ['infecciones intestinales por protozoarios en jalisco', '71.0']]) {
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
  'displasia cervical severa en Jalisco', 'cáncer cervicouterino in situ en Sonora', 'N87.2 en Jalisco',
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

for (const [q, release] of [['faringitis en Jalisco', 'faringitis_j02'], ['amigdalitis en Sonora', 'faringitis_j02'], ['displasia cervical en Jalisco', 'displasia_leve_n87']]) {
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

for (const q of ['salmonelosis en Jalisco', 'fiebre tifoidea en Sonora', 'escarlatina en Jalisco', 'hepatitis C en Jalisco', 'displasia cervical severa y cáncer in situ en Sonora']) {
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
for (const q of ['giardiasis en Jalisco', 'herpes zóster en Jalisco', 'faringitis en Jalisco', 'displasia cervical severa en Jalisco']) {
  test(`RAG real: «${q}» responde sin modelo ni cifras`, async () => {
    const { status, body } = await postRag(q);
    assert.equal(status, 200);
    assert.doesNotMatch(body.answer, /\d{1,3}(,\d{3})+|casos pronosticados/);
    assert.deepEqual(body.sources, []);
  });
}
