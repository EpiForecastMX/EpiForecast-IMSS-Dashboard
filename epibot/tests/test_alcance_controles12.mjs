/**
 * Alcance de los doce controles de alta20c (15-nov-2026): rechazo de 2025 en el total nacional y publicación del
 * control estacional por el dictamen delegado de Fable (§1), nunca validados. Cada consulta clara llega a su
 * release como control no validado; los términos genéricos piden precisar («desnutrición», «hepatitis»,
 * «hepatitis B», «bocio», «absceso hepático», «lombrices», «helmintiasis»); la hepatitis B publicada es sólo la
 * aguda (B16) y la crónica sigue en otras hepatitis víricas; los subtipos con código propio no reciben cifras.
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

const MARCAS = /BRUCELOSIS_A23|REUMATICA_I00|BOCIO_E01|HEPATITIS_B_B16|ROTAVIRUS_A080|ABSCESO_HEPATICO_A064|LEPTOSPIROSIS_A27|HELMINTIASIS_B65|DESNUTRICION_MODERADA_E440|DESNUTRICION_SEVERA_E40|ENTEROBIASIS_B80|GIARDIASIS_A071|DESNUTRICION_LEVE_E441|OTRAS_HEPATITIS_B17|ASCARIASIS_B77|AMEBIASIS_A06|INTESTINALES_A04|PROTOZOARIOS_A07/;
const SIN_CIFRAS = (md, q) => {
  assert.doesNotMatch(md, MARCAS, q);
  assert.doesNotMatch(md, /casos pronosticados|Pronóstico \*\*congelado\*\*/, q);
};

const CONTROLES = [
  ['brucelosis en Sonora', 'BRUCELOSIS_A23'], ['fiebre de malta en Sonora', 'BRUCELOSIS_A23'],
  ['fiebre reumática en Querétaro', 'REUMATICA_I00'], ['fiebre reumática aguda en Coahuila', 'REUMATICA_I00'],
  ['bocio endémico en Morelos', 'BOCIO_E01'], ['E01 en Morelos', 'BOCIO_E01'],
  ['hepatitis B aguda en Jalisco', 'HEPATITIS_B_B16'], ['B16 en Sonora', 'HEPATITIS_B_B16'],
  ['rotavirus en Jalisco', 'ROTAVIRUS_A080'], ['enteritis por rotavirus en Chiapas', 'ROTAVIRUS_A080'],
  ['gastroenteritis por rotavirus en Puebla', 'ROTAVIRUS_A080'], ['A08.0 en Jalisco', 'ROTAVIRUS_A080'],
  ['absceso hepático amebiano en México', 'ABSCESO_HEPATICO_A064'], ['A06.4 en Jalisco', 'ABSCESO_HEPATICO_A064'],
  ['amebiasis hepática en Jalisco', 'ABSCESO_HEPATICO_A064'],
  ['leptospirosis en Veracruz', 'LEPTOSPIROSIS_A27'],
  ['otras helmintiasis en Tabasco', 'HELMINTIASIS_B65'],
  ['desnutrición moderada en Oaxaca', 'DESNUTRICION_MODERADA_E440'], ['E44.0 en Jalisco', 'DESNUTRICION_MODERADA_E440'],
  ['desnutrición severa en Jalisco', 'DESNUTRICION_SEVERA_E40'], ['kwashiorkor en Chiapas', 'DESNUTRICION_SEVERA_E40'],
  ['enterobiasis en Sonora', 'ENTEROBIASIS_B80'], ['oxiuriasis en Jalisco', 'ENTEROBIASIS_B80'],
  ['giardiasis en Jalisco', 'GIARDIASIS_A071'], ['A07.1 en Sonora', 'GIARDIASIS_A071'],
];
for (const [q, marca] of CONTROLES) {
  test(`control: «${q}» responde su release como control no validado`, async () => {
    const { md } = await pregunta(q);
    assert.match(md, new RegExp(marca), q);
    assert.match(md, /control estacional, no validado/, q);
    assert.doesNotMatch(md, /Validación prospectiva en curso|PASS|validación en curso/, q);
  });
}

test('los bloques vecinos conservan su serie: gastroenteritis, amebiasis intestinal y otras protozoosis', async () => {
  assert.match((await pregunta('gastroenteritis en Jalisco')).md, /INTESTINALES_A04/);
  assert.doesNotMatch((await pregunta('gastroenteritis en Jalisco')).md, /ROTAVIRUS_A080/);
  assert.match((await pregunta('amebiasis intestinal en Jalisco')).md, /AMEBIASIS_A06/);
  assert.doesNotMatch((await pregunta('amebiasis intestinal en Jalisco')).md, /ABSCESO_HEPATICO_A064/);
  assert.match((await pregunta('desnutrición leve en Jalisco')).md, /DESNUTRICION_LEVE_E441/);
  assert.match((await pregunta('hepatitis B crónica en Jalisco')).md, /B16/);
});

// Términos genéricos: piden precisar sin cifras y nombran los bloques publicados.
for (const [q, nombra] of [
  ['desnutrición en Jalisco', /desnutricion leve.*desnutricion moderada.*desnutricion severa/s],
  ['hepatitis en Jalisco', /hepatitis virica a.*hepatitis virica b aguda.*hepatitis virica c.*otras hepatitis viricas/s],
  ['hepatitis B en Jalisco', /hepatitis virica b aguda.*otras hepatitis viricas/s],
  ['bocio en Morelos', /bocio endemico/],
  ['absceso hepático en Jalisco', /absceso hepatico amebiano/],
  ['lombrices en Chiapas', /ascariasis.*enterobiasis.*otras helmintiasis/s],
  ['helmintiasis en Jalisco', /ascariasis.*enterobiasis.*otras helmintiasis/s],
]) {
  test(`ambiguo: «${q}» pide precisar sin cifras`, async () => {
    assert.ok(aliasAmbiguo(norm(q)), 'aliasAmbiguo');
    const { handler, md } = await pregunta(q);
    assert.equal(handler, 'answerAliasAmbiguo');
    SIN_CIFRAS(md, q);
    assert.match(md, nombra);
  });
}

// Subtipos o categorías vecinas con código propio: sin cifras.
for (const q of ['fiebre paratifoidea en Sonora', 'hepatitis alcohólica en Jalisco', 'A06.5 en Jalisco',
  'isosporiasis en Jalisco']) {
  test(`fuera del bloque: «${q}» no recibe cifras`, async () => {
    assert.ok(mencionaNoModelada(norm(q)), 'mencionaNoModelada');
    SIN_CIFRAS((await pregunta(q)).md, q);
  });
}

test('seguimiento en la familia de desnutrición: tras la moderada, «¿y la severa?» nombra la severa', async () => {
  kb._resetContext();
  await kb.answerWithTrace('desnutrición moderada en Jalisco');
  const r = await kb.answerWithTrace('¿y la severa?');
  kb._resetContext();
  assert.match(String(r.response), /DESNUTRICION_SEVERA_E40/);
});

test('la absceso hepático lleva su aviso de valor retirado y leptospirosis el de picos en la ficha', () => {
  const abs = readFileSync(new URL('../../absceso_hepatico_a064.html', import.meta.url), 'utf-8');
  assert.match(abs, /data-aviso="México\|2026-W01"/);
  assert.match(abs, /retiró/);
  const bocio = readFileSync(new URL('../../bocio_e01.html', import.meta.url), 'utf-8');
  assert.match(bocio, /data-aviso="Morelos\|2026-W24"/);
  const lep = readFileSync(new URL('../../leptospirosis_a27.html', import.meta.url), 'utf-8');
  assert.match(lep, /data-aviso="Veracruz\|2025-W44\.\.W46"/);
  for (const id of ['brucelosis_a23', 'reumatica_i00', 'bocio_e01', 'hepatitis_b_b16', 'rotavirus_a080',
    'absceso_hepatico_a064', 'leptospirosis_a27']) {
    const s = readFileSync(new URL(`../../${id}.html`, import.meta.url), 'utf-8');
    assert.match(s, /filas base \(\d+ %\) toman el reparto por sexo de ese respaldo/, id);
    assert.match(s, /control estacional, no validado/i, id);
    assert.doesNotMatch(s, /validación en curso/i, id);
  }
});

const rag = await import('../netlify/functions/rag.mjs');
async function postRag(query) {
  const res = await rag.default(new Request('http://x/.netlify/functions/rag', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query }),
  }));
  return { status: res.status, body: await res.json() };
}
for (const q of ['desnutrición en Jalisco', 'hepatitis B en Jalisco', 'fiebre paratifoidea en Sonora']) {
  test(`RAG real: «${q}» responde sin modelo ni cifras`, async () => {
    const { status, body } = await postRag(q);
    assert.equal(status, 200);
    assert.doesNotMatch(body.answer, /\d{1,3}(,\d{3})+|casos pronosticados/);
    assert.deepEqual(body.sources, []);
  });
}
