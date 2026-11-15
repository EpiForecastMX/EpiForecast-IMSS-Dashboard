/**
 * Cinco controles nuevos de alta20c (dictamen delegado complementario FABLE_CONTROLES5_DECISION_20261115.json, no firma
 * humana): síndrome coqueluchoide (U99), intoxicación por plaguicidas (T60), tos ferina (A37), síndrome meníngeo
 * (G00-G03 excepto G00.0 y G00.1) e intoxicación por monóxido de carbono (T58). Controles estacionales no validados:
 * nunca validados, aceptados, en validación ni PASS. Tos ferina y coqueluchoide son series distintas; «meningitis» a
 * secas pide precisar; las consultas de crisis que mencionan plaguicidas o monóxido reciben la respuesta de crisis; los
 * avisos de valores retirados por la fuente van en la respuesta determinista, en la función RAG y en el corpus.
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
const { aliasAmbiguo } = await import('../js/release_config.js?v=22');
const d = await kb.loadKnowledge();
await d.obesidad_pendiente;

async function pregunta(q) {
  kb._resetContext();
  const r = await kb.answerWithTrace(q);
  kb._resetContext();
  return { handler: r.handler, md: String(r.response ?? '') };
}
const MARCAS = /COQUELUCHOIDE_U99|PLAGUICIDAS_T60|TOS_FERINA_A37|SINDROME_MENINGEO_G00|MONOXIDO_T58/;

for (const [q, marca] of [['síndrome coqueluchoide en Chiapas', 'COQUELUCHOIDE_U99'], ['coqueluchoide en Jalisco', 'COQUELUCHOIDE_U99'],
  ['tos ferina en Jalisco', 'TOS_FERINA_A37'], ['tosferina en Sonora', 'TOS_FERINA_A37'], ['pertussis en Nuevo León', 'TOS_FERINA_A37'],
  ['intoxicación por plaguicidas en México', 'PLAGUICIDAS_T60'], ['T60 en Sinaloa', 'PLAGUICIDAS_T60'],
  ['síndrome meníngeo en Ciudad de México', 'SINDROME_MENINGEO_G00'], ['intoxicación por monóxido de carbono en Jalisco', 'MONOXIDO_T58'],
  ['monóxido de carbono en Chihuahua', 'MONOXIDO_T58']]) {
  test(`control: «${q}» responde su release como control no validado`, async () => {
    const { md } = await pregunta(q);
    assert.match(md, new RegExp(marca), q);
    assert.match(md, /control estacional, no validado/, q);
    assert.doesNotMatch(md, /Validación prospectiva en curso|validación en curso|\bPASS\b|aceptad[oa] en su prueba/, q);
  });
}

test('tos ferina y síndrome coqueluchoide se resuelven a series distintas, sin sumarse', async () => {
  const t = await pregunta('tos ferina en Jalisco');
  assert.doesNotMatch(t.md, /COQUELUCHOIDE_U99/);
  const c = await pregunta('síndrome coqueluchoide en Jalisco');
  assert.doesNotMatch(c.md, /TOS_FERINA_A37/);
});

test('«meningitis» a secas pide precisar; la meningocócica no recibe cifras del síndrome meníngeo', async () => {
  assert.ok(aliasAmbiguo(norm('meningitis en Jalisco')));
  const { handler, md } = await pregunta('meningitis en Jalisco');
  assert.equal(handler, 'answerAliasAmbiguo');
  assert.match(md, /G00-G03, excepto G00\.0 y G00\.1/);
  assert.doesNotMatch(md, MARCAS);
  assert.doesNotMatch((await pregunta('meningitis meningocócica en Jalisco')).md, /SINDROME_MENINGEO_G00/);
});

test('crisis: una consulta de riesgo personal que menciona plaguicidas o monóxido recibe la respuesta de crisis', async () => {
  for (const q of ['quiero matarme con plaguicidas', 'me quiero morir con monóxido de carbono']) {
    const { handler, md } = await pregunta(q);
    assert.equal(handler, 'answerCrisis', q);
    assert.match(md, /800 911 2000/, q);
    assert.doesNotMatch(md, MARCAS, q);
  }
  for (const q of ['suicidio con plaguicidas en Jalisco', 'intento de suicidio con monóxido en Jalisco']) {
    assert.doesNotMatch((await pregunta(q)).md, MARCAS, q);
  }
});

test('avisos de valores retirados en la respuesta determinista', async () => {
  assert.match((await pregunta('coqueluchoide en Chiapas')).md, /retiro neto de 36 de los 39/);
  assert.match((await pregunta('intoxicación por plaguicidas en México')).md, /retiro neto de 57 de los 60[\s\S]*de 91 nacionales/);
  assert.match((await pregunta('síndrome meníngeo en Ciudad de México')).md, /retiro neto de 31 de los 32/);
  for (const [q, n] of [['tos ferina en Jalisco', 2], ['monóxido de carbono en Jalisco', 21], ['síndrome meníngeo en Jalisco', 27]]) {
    assert.match((await pregunta(q)).md, new RegExp(`bajó ${n} veces`), q);
  }
});

const rag = await import('../netlify/functions/rag.mjs');
async function postRag(query) {
  const res = await rag.default(new Request('http://x/.netlify/functions/rag', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query }),
  }));
  return (await res.json()).answer;
}
test('función RAG: el estado del control lleva sus avisos y no se presenta como validado', async () => {
  const a = await postRag('¿está validada la intoxicación por plaguicidas?');
  assert.match(a, /control estacional, no validado/);
  assert.match(a, /retiro neto de 57 de los 60/);
  assert.match(await postRag('¿es confiable el síndrome coqueluchoide?'), /retiro neto de 36 de los 39/);
});

test('corpus RAG: un fragmento de avisos por control', async () => {
  const { buildChunks } = await import('../scripts/lib/corpus.mjs');
  const { chunks } = buildChunks({});
  for (const id of ['coqueluchoide_u99', 'plaguicidas_t60', 'tos_ferina_a37', 'sindrome_meningeo_g00', 'monoxido_t58']) {
    assert.ok(chunks.find((x) => x.id.startsWith(`release:${id}:`) && x.id.endsWith(':avisos-fuente')), id);
  }
});

test('fichas: rezago 0, alcance meníngeo, D7 y escasez declarados', () => {
  const leer = (id) => readFileSync(new URL(`../../${id}.html`, import.meta.url), 'utf-8');
  for (const id of ['coqueluchoide_u99', 'tos_ferina_a37']) {
    const s = leer(id);
    assert.match(s, /id="originTxt">W43 de 2026</, id);
    assert.match(s, /Esas semanas \(W44 a W47 de 2026\)/, id);
    assert.match(s, /semanaMas\(a, w, 0\)/, id);
  }
  assert.match(leer('coqueluchoide_u99'), /distinta de la tos ferina confirmada \(A37\)/);
  assert.match(leer('tos_ferina_a37'), /mediana nacional fue de 4 casos por semana \(258 en 52 semanas\)/);
  assert.match(leer('monoxido_t58'), /mediana nacional fue de 8 casos por semana \(483 en 52 semanas\)/);
  for (const id of ['plaguicidas_t60', 'monoxido_t58']) assert.match(leer(id), /No distingue intención/, id);
  const m = leer('sindrome_meningeo_g00');
  assert.match(m, /G00-G03, excepto G00\.0 y G00\.1/);
  assert.match(m, /Tamaulipas bajó de 118 a 62/);
  for (const id of ['coqueluchoide_u99', 'plaguicidas_t60', 'tos_ferina_a37', 'sindrome_meningeo_g00', 'monoxido_t58']) {
    const s = leer(id);
    assert.match(s, /control estacional, no validado/i, id);
    assert.doesNotMatch(s, /validación en curso|en validación|\bPASS\b/i, id);
    assert.match(s, /evidencia-indice/, id);
    assert.match(s, /incluidos sus picos y los valores que la fuente retiró/, id);
  }
});
