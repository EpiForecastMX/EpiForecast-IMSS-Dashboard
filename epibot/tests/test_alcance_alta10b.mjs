/**
 * Alcance del lote alta10b (12-nov-2026): cuatro aceptados en la prueba única de 2025 con la política de
 * cinco motores (validación prospectiva en curso) y seis controles estacionales publicados tras el rechazo
 * por autorización del autor (nunca validados). Cada consulta clara llega a su release con su estado; los
 * subtipos con código propio no reciben cifras de un bloque vecino; los términos genéricos piden precisar;
 * los rechazos sin control autorizado siguen sin modelarse.
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
const { norm } = await import('../js/entities.js?v=56');
const { mencionaNoModelada, aliasAmbiguo } = await import('../js/release_config.js?v=22');
const d = await kb.loadKnowledge();
await d.obesidad_pendiente;

async function pregunta(q) {
  kb._resetContext();
  const r = await kb.answerWithTrace(q);
  kb._resetContext();
  return { handler: r.handler, md: String(r.response ?? '') };
}

const MARCAS = /ASCARIASIS_B77|HEPATITIS_A_B15|CALOR_T67|OTRAS_HEPATITIS_B17|DESNUTRICION_LEVE_E441|SALMONELOSIS_A02|TIFOIDEA_A01|ESCARLATINA_A38|HEPATITIS_C_B17|DISPLASIA_SEVERA_N87/;
const SIN_CIFRAS = (md, q) => {
  assert.doesNotMatch(md, MARCAS, q);
  assert.doesNotMatch(md, /casos pronosticados|Pronóstico \*\*congelado\*\*/, q);
};

const ACEPTADOS = [
  ['ascariasis en Chiapas', 'ASCARIASIS_B77'], ['hepatitis A en Sonora', 'HEPATITIS_A_B15'],
  ['hepatitis vírica A en Jalisco', 'HEPATITIS_A_B15'], ['golpe de calor en Sonora', 'CALOR_T67'],
  ['efectos del calor y de la luz en Nuevo León', 'CALOR_T67'], ['otras hepatitis víricas en Jalisco', 'OTRAS_HEPATITIS_B17'],
  ['hepatitis E en Jalisco', 'OTRAS_HEPATITIS_B17'], ['B18.1 en Jalisco', 'OTRAS_HEPATITIS_B17'],
];
for (const [q, marca] of ACEPTADOS) {
  test(`aceptado: «${q}» responde su release con validación en curso`, async () => {
    const { md } = await pregunta(q);
    assert.match(md, new RegExp(marca));
    assert.match(md, /Validación prospectiva en curso|validación prospectiva está en curso/i);
    assert.doesNotMatch(md, /control estacional, no validado|PASS/);
  });
}

const CONTROLES = [
  ['desnutrición leve en Jalisco', 'DESNUTRICION_LEVE_E441'], ['salmonelosis en Jalisco', 'SALMONELOSIS_A02'],
  ['otras salmonelosis en Puebla', 'SALMONELOSIS_A02'], ['fiebre tifoidea en Sonora', 'TIFOIDEA_A01'],
  ['salmonella typhi en Jalisco', 'TIFOIDEA_A01'], ['escarlatina en Jalisco', 'ESCARLATINA_A38'],
  ['hepatitis C en Jalisco', 'HEPATITIS_C_B17'], ['displasia cervical severa en Jalisco', 'DISPLASIA_SEVERA_N87'],
  ['cáncer cervicouterino in situ en Sonora', 'DISPLASIA_SEVERA_N87'], ['N87.2 en Jalisco', 'DISPLASIA_SEVERA_N87'],
];
for (const [q, marca] of CONTROLES) {
  test(`control: «${q}» responde su release como control no validado`, async () => {
    const { md } = await pregunta(q);
    assert.match(md, new RegExp(marca));
    assert.match(md, /control estacional, no validado/);
    assert.doesNotMatch(md, /Validación prospectiva en curso|PASS|validación en curso/);
  });
}

test('el cáncer cervicouterino invasor sigue en C53 y el in situ en la displasia severa', async () => {
  const c53 = await pregunta('cáncer cervicouterino en Jalisco');
  assert.match(c53.md, /CANCER_CUELLO_UTERO_C53/);
  assert.doesNotMatch(c53.md, /DISPLASIA_SEVERA_N87/);
  const insitu = await pregunta('carcinoma in situ del cuello del útero en Jalisco');
  assert.match(insitu.md, /DISPLASIA_SEVERA_N87/);
  assert.doesNotMatch(insitu.md, /CANCER_CUELLO_UTERO_C53/);
});

test('sin sexo: la displasia severa no ofrece desglose por sexo', async () => {
  const { md } = await pregunta('displasia cervical severa en Jalisco mujeres');
  assert.match(md, /sexo/i);
  assert.doesNotMatch(md, /· Hombres\*\*|· Mujeres\*\*/);
});

// Subtipos con código propio o categorías vecinas sin pronóstico.
const AJENOS = [
  'hepatitis B en Jalisco', 'B16 en Sonora', 'hepatitis alcohólica en Jalisco', 'fiebre paratifoidea en Sonora',
  'A01.2 en Jalisco', 'desnutrición moderada en Jalisco', 'desnutrición severa en Sonora', 'kwashiorkor en Chiapas',
  'E44.0 en Jalisco', 'N87.9 en Jalisco',
];
for (const q of AJENOS) {
  test(`fuera del bloque: «${q}» no recibe cifras`, async () => {
    assert.ok(mencionaNoModelada(norm(q)), 'mencionaNoModelada');
    SIN_CIFRAS((await pregunta(q)).md, q);
  });
}

// Términos genéricos: piden precisar sin cifras.
for (const [q, nombra] of [
  ['hepatitis en Jalisco', /hepatitis virica a.*hepatitis virica c.*otras hepatitis viricas/s],
  ['displasia cervical en Jalisco', /displasia cervical leve y moderada.*displasia cervical severa/s],
  ['displasia cervical leve, moderada y severa en Jalisco', /displasia cervical leve y moderada.*displasia cervical severa/s],
  ['desnutrición en Jalisco', /desnutricion leve/],
]) {
  test(`ambiguo: «${q}» pide precisar sin cifras`, async () => {
    assert.ok(aliasAmbiguo(norm(q)), 'aliasAmbiguo');
    const { handler, md } = await pregunta(q);
    assert.equal(handler, 'answerAliasAmbiguo');
    SIN_CIFRAS(md, q);
    assert.match(md, nombra);
  });
}

// Alias por prefijo: una letra tras «hepatitis» no captura palabras que empiezan con ella.
for (const q of ['hepatitis en Sonora', 'hepatitis aguda en Jalisco', 'hepatitis crónica en Jalisco', 'hepatitis de Jalisco']) {
  test(`prefijo: «${q}» no se lee como un tipo de hepatitis`, async () => {
    SIN_CIFRAS((await pregunta(q)).md, q);
  });
}

// Rechazados en 2025 sin control autorizado y candidatos no abiertos: siguen sin cifras.
for (const q of ['helmintiasis en Jalisco', 'enterobiasis en Sonora', 'giardiasis en Jalisco', 'lombrices en Chiapas',
  'brucelosis en Sonora', 'leptospirosis en Veracruz']) {
  test(`no publicado: «${q}» no recibe cifras`, async () => {
    SIN_CIFRAS((await pregunta(q)).md, q);
  });
}

const rag = await import('../netlify/functions/rag.mjs');
async function postRag(query) {
  const res = await rag.default(new Request('http://x/.netlify/functions/rag', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query }),
  }));
  return { status: res.status, body: await res.json() };
}
for (const q of ['hepatitis B en Jalisco', 'desnutrición moderada en Jalisco', 'fiebre paratifoidea en Sonora']) {
  test(`RAG real: «${q}» responde sin modelo ni cifras`, async () => {
    const { status, body } = await postRag(q);
    assert.equal(status, 200);
    assert.doesNotMatch(body.answer, /\d{1,3}(,\d{3})+|casos pronosticados/);
    assert.deepEqual(body.sources, []);
  });
}

// Revisión de alias de Fable (FABLE_ALIAS_1) reproducida por root contra el KB vivo: cada caso falló antes.
async function conversa(...qs) {
  kb._resetContext();
  let r;
  for (const q of qs) r = await kb.answerWithTrace(q);
  kb._resetContext();
  return { handler: r.handler, md: String(r.response ?? '') };
}

for (const q of ['casos de hepatitis a nivel nacional', 'hepatitis a partir de 2020', 'hepatitis a la semana 42',
  'hepatitis e influenza en Jalisco']) {
  test(`A1: «${q}» no lee la preposición o la conjunción como letra del virus`, async () => {
    const { handler, md } = await conversa(q);
    assert.equal(handler, 'answerAliasAmbiguo', q);
    SIN_CIFRAS(md, q);
  });
}

test('A2: «have» no es la abreviatura HAV y las abreviaturas completas sí nombran su bloque', async () => {
  for (const q of ['what data do you have for Jalisco', 'do you have asthma data']) {
    assert.doesNotMatch((await conversa(q)).md, /HEPATITIS_A_B15|Hepatitis vírica A \(B15\) ·/, q);
  }
  assert.match((await conversa('VHA en Jalisco')).md, /HEPATITIS_A_B15/);
  assert.match((await conversa('VHC en Jalisco')).md, /HEPATITIS_C_B17/);
});

test('M1: la salmonelosis no tifoidea es A02 y no mezcla la tifoidea', async () => {
  for (const q of ['salmonelosis no tifoidea en Jalisco', 'non-typhoidal salmonella in Jalisco']) {
    const { md } = await conversa(q);
    assert.match(md, /SALMONELOSIS_A02/, q);
    assert.doesNotMatch(md, /TIFOIDEA_A01|Fiebre tifoidea/, q);
  }
});

test('M2: la hepatitis B crónica se aclara dentro de otras hepatitis, sin negarla como B16 ni darle cifras propias', async () => {
  for (const q of ['hepatitis B B18.1 en Jalisco', 'hepatitis B en fase crónica en Jalisco', 'hepatitis B crónica en Jalisco']) {
    const { handler, md } = await conversa(q);
    assert.equal(handler, 'answerAliasAmbiguo', q);
    assert.match(md, /otras hepatitis víricas/, q);
    assert.doesNotMatch(md, /no modela hepatitis vírica B aguda/, q);
    SIN_CIFRAS(md, q);
  }
  assert.match((await conversa('B18.1 en Jalisco')).md, /OTRAS_HEPATITIS_B17/);
});

test('M3: el seguimiento elíptico nombra el bloque hermano y no hereda el anterior', async () => {
  const c = await conversa('hepatitis A en Jalisco', '¿y la C?');
  assert.match(c.md, /HEPATITIS_C_B17/);
  assert.doesNotMatch(c.md, /HEPATITIS_A_B15/);
  const b = await conversa('hepatitis A en Jalisco', '¿y la B?');
  assert.doesNotMatch(b.md, /HEPATITIS_A_B15/);
  SIN_CIFRAS(b.md, 'y la B');
  const sev = await conversa('desnutrición leve en Jalisco', '¿y la severa?');
  assert.doesNotMatch(sev.md, /DESNUTRICION_LEVE_E441/);
  SIN_CIFRAS(sev.md, 'y la severa (desnutrición)');
  const dis = await conversa('displasia cervical leve en Jalisco', '¿y la severa?');
  assert.match(dis.md, /DISPLASIA_SEVERA_N87/);
  assert.doesNotMatch(dis.md, /DISPLASIA_LEVE_N87/);
});

test('M4: un código o nombre específico de un bloque de hepatitis no cae en la aclaración genérica', async () => {
  assert.match((await conversa('hepatitis B15 en Jalisco')).md, /HEPATITIS_A_B15/);
  assert.match((await conversa('hepatitis viral no especificada en Jalisco')).md, /OTRAS_HEPATITIS_B17/);
});

test('M5: «lombrices» junto a ascariasis no la niega; sola, pide precisar', async () => {
  assert.match((await conversa('ascariasis (lombrices intestinales) en Jalisco')).md, /ASCARIASIS_B77/);
  const l = await conversa('lombrices en Jalisco');
  assert.equal(l.handler, 'answerAliasAmbiguo');
  SIN_CIFRAS(l.md, 'lombrices');
});

test('extra: parvovirus B19 no es hepatitis, NIC III y el tumor in situ son D06, A01 pide precisar', async () => {
  SIN_CIFRAS((await conversa('parvovirus B19 en Jalisco')).md, 'parvovirus');
  for (const q of ['neoplasia intraepitelial cervical grado III en Jalisco', 'tumor in situ del cuello del útero en Jalisco']) {
    const { md } = await conversa(q);
    assert.match(md, /DISPLASIA_SEVERA_N87/, q);
    assert.doesNotMatch(md, /CANCER_CUELLO_UTERO_C53/, q);
  }
  const a01 = await conversa('A01 en Jalisco');
  assert.equal(a01.handler, 'answerAliasAmbiguo');
  assert.doesNotMatch(a01.md, /Alzheimer|Depresi|Parkinson/);
  SIN_CIFRAS(a01.md, 'A01');
});

for (const q of ['casos de hepatitis a nivel nacional', 'hepatitis B B18.1 en Jalisco', 'parvovirus B19 en Jalisco', 'A01 en Jalisco']) {
  test(`RAG real tras la revisión: «${q}» sin cifras ni fuentes`, async () => {
    const { status, body } = await postRag(q);
    assert.equal(status, 200);
    assert.doesNotMatch(body.answer, /\d{1,3}(,\d{3})+|casos pronosticados/);
    assert.deepEqual(body.sources, []);
  });
}

// Revisión final del frontend de Fable (B1): las formas con «vírica» y una palabra que empieza con la letra.
for (const q of ['hepatitis vírica en Jalisco', 'hepatitis vírica de Jalisco', 'hepatitis vírica aguda en Jalisco',
  'hepatitis vírica crónica en Jalisco']) {
  test(`B1: «${q}» pide precisar sin cifras de un bloque`, async () => {
    const { handler, md } = await conversa(q);
    assert.equal(handler, 'answerAliasAmbiguo', q);
    SIN_CIFRAS(md, q);
  });
  test(`B1 RAG real: «${q}» sin cifras ni fuentes`, async () => {
    const { status, body } = await postRag(q);
    assert.equal(status, 200);
    assert.doesNotMatch(body.answer, /\d{1,3}(,\d{3})+|casos pronosticados/);
    assert.deepEqual(body.sources, []);
  });
}

test('B1: las formas completas siguen resolviendo y el seguimiento también', async () => {
  assert.match((await conversa('hepatitis vírica A en Jalisco')).md, /HEPATITIS_A_B15/);
  assert.match((await conversa('hepatitis vírica C en Jalisco')).md, /HEPATITIS_C_B17/);
  assert.match((await conversa('hepatitis vírica E en Jalisco')).md, /OTRAS_HEPATITIS_B17/);
  const c = await conversa('hepatitis vírica A en Jalisco', '¿y la C?');
  assert.match(c.md, /HEPATITIS_C_B17/);
  assert.doesNotMatch(c.md, /HEPATITIS_A_B15/);
});

test('la exención de «hepatitis» no alcanza a otros términos genéricos («tumor»)', async () => {
  const { md } = await conversa('cáncer de mama y tumor de tiroides en Jalisco');
  assert.doesNotMatch(md, /Pronóstico \*\*congelado\*\*/);
});

test('«hepatitis A y B» no da cifras de A callando la B', async () => {
  assert.doesNotMatch((await conversa('hepatitis A y B en Jalisco')).md, /HEPATITIS_A_B15/);
});
