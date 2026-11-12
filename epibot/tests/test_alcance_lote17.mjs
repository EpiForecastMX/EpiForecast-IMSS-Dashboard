/**
 * Alcance de los cinco publicados del lote 17 (12-nov-2026): intoxicación alimentaria bacteriana (A05),
 * shigelosis (A03), erisipela (A46), candidiasis urogenital (B37.3-B37.4) y diabetes mellitus en el
 * embarazo (O24.4, sin sexo). Cada consulta clara llega a su release; los subtipos con código propio y
 * los vecinos rechazados sin control autorizado (salmonelosis, tifoidea, hepatitis C)
 * no reciben cifras de un bloque publicado; «candidiasis» a secas pide precisar.
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
const { detectEntities, norm } = await import('../js/entities.js?v=55');
const { mencionaNoModelada, aliasAmbiguo, subtipoAjeno } = await import('../js/release_config.js?v=21');
const d = await kb.loadKnowledge();
await d.obesidad_pendiente;

async function pregunta(q) {
  kb._resetContext();
  const r = await kb.answerWithTrace(q);
  kb._resetContext();
  return { handler: r.handler, md: String(r.response ?? '') };
}

const NUEVOS = /ALIMENTARIA_A05|SHIGELOSIS_A03|ERISIPELA_A46|CANDIDIASIS_B37|EMBARAZO_DIABETES_O24/;
const VECINOS = /INTESTINALES_A04|IRA_J00|DIABETES_T[12]|EMBARAZO_HIPERTENSIVOS_O10/;

const POSITIVOS = [
  ['intoxicación alimentaria bacteriana en Jalisco', /ALIMENTARIA_A05/],
  ['intoxicación alimentaria en Sonora', /ALIMENTARIA_A05/],
  ['A05 en Jalisco', /ALIMENTARIA_A05/],
  ['shigelosis en Jalisco', /SHIGELOSIS_A03/],
  ['disentería bacilar en Oaxaca', /SHIGELOSIS_A03/],
  ['erisipela en Puebla', /ERISIPELA_A46/],
  ['candidiasis urogenital en Jalisco', /CANDIDIASIS_B37/],
  ['candidiasis vaginal en Sonora', /CANDIDIASIS_B37/],
  ['B37.3 en Jalisco', /CANDIDIASIS_B37/],
  ['diabetes mellitus en el embarazo en Jalisco', /EMBARAZO_DIABETES_O24/],
  ['diabetes gestacional en Sonora', /EMBARAZO_DIABETES_O24/],
  ['O24.4 en Jalisco', /EMBARAZO_DIABETES_O24/],
];
for (const [q, marca] of POSITIVOS) {
  test(`dentro del bloque: «${q}» responde su release`, async () => {
    const { md } = await pregunta(q);
    assert.match(md, marca);
    assert.doesNotMatch(md, VECINOS);
  });
}

const AJENOS = [
  'candidiasis oral en Jalisco', 'candidiasis esofágica en Sonora', 'candidiasis cutánea en Puebla',
  'B37.0 en Jalisco', 'algodoncillo en Jalisco',
  'diabetes tipo 2 en el embarazo en Jalisco', 'diabetes pregestacional en Sonora', 'O24.1 en Jalisco',
  'erisipeloide en Jalisco', 'A26 en Sonora',
];
for (const q of AJENOS) {
  test(`fuera del bloque: «${q}» no recibe cifras`, async () => {
    assert.ok(subtipoAjeno(norm(q)), 'subtipoAjeno');
    assert.ok(mencionaNoModelada(norm(q)), 'mencionaNoModelada');
    const { md } = await pregunta(q);
    assert.doesNotMatch(md, NUEVOS);
    assert.doesNotMatch(md, VECINOS);
    assert.doesNotMatch(md, /casos pronosticados|Pronóstico \*\*congelado\*\*/);
  });
}

// Rechazados en 2025 o vecinos de bloque: ni el release del lote ni la IRA, A04 o tipo I/II.
const RECHAZADOS = [
  'salmonelosis en Jalisco', 'fiebre tifoidea en Sonora', 'hepatitis C en Jalisco', 'hepatitis A en Sonora',
];
for (const q of RECHAZADOS) {
  test(`no publicado: «${q}» no recibe cifras de un vecino`, async () => {
    const { md } = await pregunta(q);
    assert.doesNotMatch(md, NUEVOS);
    assert.doesNotMatch(md, VECINOS);
    assert.doesNotMatch(md, /casos pronosticados|Pronóstico \*\*congelado\*\*/);
  });
}

test('ambiguo: «candidiasis en Jalisco» pide precisar sin cifras', async () => {
  assert.ok(aliasAmbiguo(norm('candidiasis en Jalisco')));
  const { handler, md } = await pregunta('candidiasis en Jalisco');
  assert.equal(handler, 'answerAliasAmbiguo');
  assert.doesNotMatch(md, NUEVOS);
  assert.match(md, /«candidiasis urogenital»/);
});

test('sin sexo: diabetes en el embarazo con «mujeres» avisa y no inventa desglose', async () => {
  const { md } = await pregunta('diabetes gestacional en Jalisco mujeres');
  assert.match(md, /EMBARAZO_DIABETES_O24/);
  assert.match(md, /sexo/i);
});

test('la erisipela no captura el erisipeloide por prefijo', () => {
  assert.notEqual(detectEntities('erisipeloide en jalisco').padecimiento, 'Erisipela');
});

const rag = await import('../netlify/functions/rag.mjs');
async function postRag(query) {
  const res = await rag.default(new Request('http://x/.netlify/functions/rag', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query }),
  }));
  return { status: res.status, body: await res.json() };
}
for (const q of ['candidiasis oral en Jalisco', 'diabetes tipo 2 en el embarazo en Jalisco', 'erisipeloide en Jalisco', 'candidiasis en Jalisco']) {
  test(`RAG real: «${q}» responde sin modelo ni cifras`, async () => {
    const { status, body } = await postRag(q);
    assert.equal(status, 200);
    assert.doesNotMatch(body.answer, /\d{1,3}(,\d{3})+|casos pronosticados/);
    assert.deepEqual(body.sources, []);
  });
}
