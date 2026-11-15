/**
 * Revisión delegada de Fable sobre PUB12 (15-nov-2026): los avisos de la fuente de los doce controles de alta20c
 * van también en la respuesta determinista del EpiBot, en la función RAG y en el corpus del índice, no sólo en la
 * ficha. Avisos nominales sólo para las celdas del dictamen §1 y de picos_heredados, cada uno diciendo si la fuente
 * conservó o retiró el valor; y una nota general medida de bajas del acumulado en los doce. El alcance de las
 * infecciones intestinales en la función RAG no incluye A08.0 (rotavirus) aunque el shard sellado diga A08.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'fs';
import vm from 'node:vm';

const raiz = new URL('../../', import.meta.url);
const K = readFileSync(new URL('epibot/knowledge.json', raiz), 'utf-8');
const vista = (u) => String(u).match(/publication\/([a-z0-9_]+)\/vista\.json/);
globalThis.fetch = async (u) => ({
  ok: true,
  json: async () => JSON.parse(vista(u)
    ? readFileSync(new URL(`publication/${vista(u)[1]}/vista.json`, raiz), 'utf-8') : K),
});
const kb = await import('../js/kb.js');
const d = await kb.loadKnowledge();
await d.obesidad_pendiente;

async function pregunta(q) {
  kb._resetContext();
  const r = await kb.answerWithTrace(q);
  kb._resetContext();
  return String(r.response ?? '');
}

const DOCE = ['brucelosis_a23', 'reumatica_i00', 'bocio_e01', 'hepatitis_b_b16', 'rotavirus_a080', 'absceso_hepatico_a064',
  'leptospirosis_a27', 'helmintiasis_b65', 'desnutricion_moderada_e440', 'desnutricion_severa_e40', 'enterobiasis_b80',
  'giardiasis_a071'];

test('los avisos se generan por script versionado y cubren los doce', () => {
  assert.ok(existsSync(new URL('epibot/js/avisos_fuente.js', raiz)), 'falta epibot/js/avisos_fuente.js');
  const A = globalThis.EPI_AVISOS_FUENTE;
  assert.ok(A, 'EPI_AVISOS_FUENTE no está cargado en el EpiBot');
  // Los doce controles, más los aceptados con una celda de picos_heredados (sin nota general de la ventana del control).
  // Los cinco controles nuevos (dictamen complementario) también llevan nota; los aceptados con pico, sólo su aviso.
  const CINCO = ['coqueluchoide_u99', 'plaguicidas_t60', 'tos_ferina_a37', 'sindrome_meningeo_g00', 'monoxido_t58'];
  for (const id of [...DOCE, ...CINCO]) assert.ok(A[id] && A[id].nota, id);
  for (const id of Object.keys(A).filter((x) => !DOCE.includes(x) && !CINCO.includes(x))) assert.equal(A[id].nota, null, id);
  assert.match(readFileSync(new URL('epibot/js/avisos_fuente.js', raiz), 'utf-8'), /Generado por docs\/alta20c\/operacion\/avisos_controles12\.py/);
  // Bajas del acumulado medidas (mismas cifras que el JSON de la revisión de Fable y qa/retiros_ventana_controles12.tsv).
  const esperadas = { brucelosis_a23: [30, 74], reumatica_i00: [14, 91], bocio_e01: [36, 136], hepatitis_b_b16: [14, 19],
    rotavirus_a080: [24, 149], absceso_hepatico_a064: [17, 145], leptospirosis_a27: [6, 36], helmintiasis_b65: [4, 276],
    desnutricion_moderada_e440: [25, 834], desnutricion_severa_e40: [25, 223], enterobiasis_b80: [26, 179], giardiasis_a071: [21, 92] };
  for (const [id, [n, bruto]] of Object.entries(esperadas)) {
    assert.equal(A[id].nota.bajas, n, id);
    assert.equal(A[id].nota.retiro_bruto, bruto, id);
  }
  assert.equal(A.giardiasis_a071.indice_posterior.consulta, '2026-11-15T12:29:20Z');
});

const NOMINALES = [
  ['absceso hepático amebiano en México', /fuente retiró[\s\S]*acumulado de 1 con 0 casos nuevos: un retiro neto de 124 de los 125/],
  ['bocio endémico en Morelos', /fuente retiró[\s\S]*acumulado anual de 55[\s\S]*acumulado de 9 con 1 caso nuevo/],
  ['desnutrición moderada en Oaxaca', /retiro neto de 128 de los 139[\s\S]*acumulado de 364 con 2 casos nuevos|acumulado de 364 con 2 casos nuevos: un retiro neto de 128 de los 139/],
  ['leptospirosis en Veracruz', /fuente conserva[\s\S]*130, 65 y 29 casos de Veracruz[\s\S]*cerró 2025 en 378/],
  ['pronostico de leptospirosis', /130, 65 y 29 casos de Veracruz/],
  ['fiebre reumática en Querétaro', /2026_sem29 imprimió un acumulado de 7 \(1 en hombres y 6 en mujeres\), pero 2026_sem30 volvió a 59/],
  ['desnutrición severa en Jalisco', /152 casos de Jalisco[\s\S]*571 en 2026_sem43/],
  ['desnutrición severa en Querétaro', /91 casos de Querétaro[\s\S]*111 en 2026_sem43/],
  ['enterobiasis en Tlaxcala', /73 casos de Tlaxcala[\s\S]*fuente conserva|fuente conserva[\s\S]*73 casos de Tlaxcala/],
];
for (const [q, re] of NOMINALES) {
  test(`EpiBot determinista: «${q}» lleva su aviso de la fuente`, async () => {
    assert.match(await pregunta(q), re);
  });
}

test('EpiBot determinista: los doce llevan la nota general medida y ningún otro release la recibe', async () => {
  const A = globalThis.EPI_AVISOS_FUENTE;
  const consultas = { brucelosis_a23: 'brucelosis', reumatica_i00: 'fiebre reumatica aguda', bocio_e01: 'bocio endemico',
    hepatitis_b_b16: 'hepatitis virica b aguda', rotavirus_a080: 'rotavirus', absceso_hepatico_a064: 'absceso hepatico amebiano',
    leptospirosis_a27: 'leptospirosis', helmintiasis_b65: 'otras helmintiasis', desnutricion_moderada_e440: 'desnutricion moderada',
    desnutricion_severa_e40: 'desnutricion severa', enterobiasis_b80: 'enterobiasis', giardiasis_a071: 'giardiasis' };
  for (const [id, q] of Object.entries(consultas)) {
    const md = await pregunta(`pronostico de ${q}`);
    assert.match(md, new RegExp(`bajó ${A[id].nota.bajas} veces`), id);
  }
  assert.doesNotMatch(await pregunta('pronostico de ascariasis'), /Correcciones de la fuente/);
});

const rag = await import('../netlify/functions/rag.mjs');
async function postRag(query) {
  const res = await rag.default(new Request('http://x/.netlify/functions/rag', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query }),
  }));
  return (await res.json()).answer;
}
test('función RAG: el estado de un control afectado lleva sus avisos de la fuente', async () => {
  assert.match(await postRag('¿está validado el absceso hepático amebiano?'), /retiro neto de 124 de los 125/);
  assert.match(await postRag('¿es confiable la leptospirosis?'), /130, 65 y 29 casos de Veracruz/);
  assert.match(await postRag('¿está validada la giardiasis?'), /bajó 21 veces/);
});

test('corpus RAG: un fragmento de avisos de la fuente por cada control afectado', async () => {
  const { buildChunks } = await import('../scripts/lib/corpus.mjs');
  const { chunks } = buildChunks({});
  for (const id of DOCE) {
    const c = chunks.find((x) => x.id.startsWith(`release:${id}:`) && x.id.endsWith(':avisos-fuente'));
    assert.ok(c, id);
    assert.match(c.text, /Correcciones de la fuente en la ventana que repite el control/, id);
  }
  const abs = chunks.find((x) => x.id.startsWith('release:absceso_hepatico_a064:') && x.id.endsWith(':avisos-fuente'));
  assert.match(abs.text, /fuente retiró/);
  const bocio = chunks.find((x) => x.id.startsWith('release:bocio_e01:') && x.id.endsWith(':avisos-fuente'));
  assert.match(bocio.text, /Morelos/);
});

test('función RAG: el alcance de las infecciones intestinales excluye A08.0, que es rotavirus', () => {
  const RAG = readFileSync(new URL('epibot/netlify/functions/rag.mjs', raiz), 'utf8');
  const ctx = vm.runInNewContext(
    `${readFileSync(new URL('epibot/js/release_catalog.js', raiz), 'utf8')}\n${RAG.slice(RAG.indexOf('function stripAccents('), RAG.indexOf('// Rate limit + CORS'))}\n({ releasesDesdeCatalogo })`,
    { console });
  const CAT = JSON.parse(readFileSync(new URL('publication/catalog.json', raiz), 'utf8'));
  const leer = (p) => JSON.parse(readFileSync(new URL(`publication/${p}`, raiz), 'utf8'));
  const r = ctx.releasesDesdeCatalogo(CAT, leer);
  const a04 = r.find((x) => x.nombre.startsWith('Infecciones intestinales por otros organismos'));
  assert.ok(!a04.cie.includes('A08'), JSON.stringify(a04.cie));
  assert.ok(a04.cie.includes('A08 excepto A08.0'), JSON.stringify(a04.cie));
  assert.deepEqual(r.find((x) => x.nombre === 'Enteritis debida a rotavirus').cie, ['A08.0']);
});

// Revisión final de Fable (FABLE_PUB12_FIXES_FINAL_REVISION.md): empates dichos, «1 caso» en singular y el fragmento
// base del corpus de infecciones intestinales sin A08.0.
test('nota medida: los empates se nombran y no se desempatan en silencio', () => {
  const A = globalThis.EPI_AVISOS_FUENTE;
  assert.match(A.brucelosis_a23.nota.texto, /La mayor baja, de 8 casos, se repite dos veces, empatada: en Morelos \(acumulado 14 a 6[^)]*\) y en Michoacán \(acumulado 191 a 183/);
  assert.match(A.desnutricion_severa_e40.nota.texto, /mayor retiro en un solo boletín, de 39 casos, se repite dos veces, empatado: en Coahuila \(acumulado 62 a 25[^)]*\) y en Sinaloa \(acumulado 197 a 158/);
});

test('ningún aviso dice «1 casos»', () => {
  for (const [id, a] of Object.entries(globalThis.EPI_AVISOS_FUENTE)) {
    for (const x of [...a.avisos, a.nota].filter(Boolean)) assert.doesNotMatch(x.texto, /\b1 casos\b/, id);
  }
});

test('corpus RAG: el fragmento base de infecciones intestinales dice «A08 excepto A08.0», sin tocar el shard', async () => {
  const { buildChunks } = await import('../scripts/lib/corpus.mjs');
  const c = buildChunks({}).chunks.find((x) => /^release:intestinales_a04:[a-z0-9_]+$/.test(x.id));
  assert.ok(c);
  assert.match(c.text, /\(A04, A08 excepto A08\.0, A09\)/);
  assert.doesNotMatch(c.text, /\(A04, A08, A09\)/);
  const md = readFileSync(new URL(`publication/intestinales_a04/${c.id.split(':')[2]}/corpus/intestinales_a04.md`, raiz), 'utf-8');
  assert.match(md, /\(A04, A08, A09\)/, 'el shard sellado no se toca');
});
