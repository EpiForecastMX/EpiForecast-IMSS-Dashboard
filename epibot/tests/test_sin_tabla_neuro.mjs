/**
 * Ninguna categoría del boletín que no se modela cae en la tabla de pronósticos del estado ni en el
 * agregado neuro (regresión del 10-nov-2026: «violencia intrafamiliar en jalisco» mostraba los
 * pronósticos de Depresión, Alzheimer y Parkinson de Jalisco).
 *
 * - Violencias: respuesta sin modelo y sin cifras, que remite al radar; no es una crisis personal y
 *   no lleva línea de ayuda.
 * - Autolesiones: conservan su respuesta específica con la línea ya existente.
 * - La corrección difusa no «corrige» un nombre del boletín hacia un padecimiento publicado.
 * - El nombre completo de una categoría gana a un alias parcial de un release.
 * - Un término clínico no reconocido con entidad o petición de datos no recibe cifras ajenas.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (r) => readFileSync(new URL(`../../${r}`, import.meta.url), 'utf-8');
const K = leer('epibot/knowledge.json');
globalThis.fetch = async (u) => {
  const m = String(u).match(/(publication\/[^?]+\.json|assets\/boletin\/[^?]+\.json)/);
  return { ok: true, json: async () => JSON.parse(m ? leer(m[1]) : K) };
};
const kb = await import('../js/kb.js');
const d = await kb.loadKnowledge();
await d.obesidad_pendiente;

const ACTUAL = JSON.parse(leer('assets/boletin/actual.json'));
const FOTO = JSON.parse(leer(`${ACTUAL.carpeta}/data.json`));

/** Handlers que muestran series publicadas o tablas por estado: nunca para una categoría no modelada. */
const CON_SERIES = new Set(['answerEstado', 'answerSpecificSeries', 'answerPadecimiento',
  'answerComparativaEstados', 'answerHistorico', 'answerBoletin', 'answerSexo', 'answerDistribucion',
  'answerRanking', 'answerPronostico', 'answerConteo', 'answerMapaMexico', 'answerZoom', 'answerAcumulado',
  'answerDengue', 'answerObesidad', 'answerDiabetes']);
const AJENO = /casos totales|modelos de producci[oó]n|agregado estatal neuro|Se pronostican|Pron[oó]stico \*\*congelado/;
const LINEA = /L[ií]nea de la Vida/;
/** Misma regla que el pulidor de app.js: un «publica» verbal sin clítico se volvería «pública». */
const PULIDOR_PUBLICA = /(?<!\b(?:se|que|no|lo|le|ya|también|tambien|galería|galeria) )\bpublica\b/;

async function conversa(...qs) {
  kb._resetContext();
  let r;
  for (const q of qs) r = await kb.answerWithTrace(q);
  kb._resetContext();
  return { handler: r.handler, md: String(r.response ?? '') };
}

function sinSeriesAjenas(r, q) {
  assert.ok(!CON_SERIES.has(r.handler), `${q} → ${r.handler}`);
  assert.doesNotMatch(r.md, AJENO, q);
  assert.doesNotMatch(r.md, PULIDOR_PUBLICA, `${q}: el pulidor escribiría «pública»`);
}

test('violencia intrafamiliar: sin tabla neuro, sin cifras y sin tratarla como crisis', async () => {
  for (const q of ['violencia intrafamiliar en jalisco', 'casos de violencia intrafamiliar en sonora',
    'violencia intrafamiliar en jalisco mujeres', 'cuantos casos de violencia intrafamiliar hubo',
    'violencia familiar en jalisco', 'violencia de genero en jalisco', 'cuantos casos de violencia de genero hubo',
    'abuso sexual en jalisco', 'maltrato infantil en jalisco', 'herida por arma de fuego en sonora',
    'heridas de bala en jalisco']) {
    const r = await conversa(q);
    sinSeriesAjenas(r, q);
    assert.equal(r.handler, 'answerPadecimientoNoModelado', q);
    assert.match(r.md, /no modela/, q);
    assert.match(r.md, /\.\.\/boletin\.html/, q);
    assert.doesNotMatch(r.md, LINEA, q);
    assert.match(r.md, /<!--SIN_GRAFICA-->/, q);
  }
});

test('el seguimiento tras una violencia no hereda el estado hacia la tabla neuro', async () => {
  for (const sig of ['y en sonora?', 'y hombres?', 'y mujeres?']) {
    const r = await conversa('violencia intrafamiliar en jalisco', sig);
    sinSeriesAjenas(r, sig);
  }
});

test('las autolesiones conservan su respuesta específica con la línea existente', async () => {
  for (const q of ['intento de suicidio en jalisco', 'envenenamiento autoinfligido en jalisco',
    'lesiones autoinfligidas en sonora',
    'lesion autoinfligida intencionalmente por objeto cortante en jalisco']) {
    const r = await conversa(q);
    sinSeriesAjenas(r, q);
    assert.match(r.md, LINEA, q);
    assert.match(r.md, /800 911 2000/, q);
    assert.doesNotMatch(r.md, /Boletín Epidemiológico \d+ de \d{4}, publicado/, q);
  }
  assert.equal((await conversa('tengo ganas de morir')).handler, 'answerCrisis');
});

test('la corrección difusa no convierte un nombre del boletín en otro padecimiento', async () => {
  for (const [q, nombre] of [['cuantos casos de colera hubo', 'Cólera'],
    ['deplecion del volumen deshidratacion en jalisco', 'Depleción del volumen'],
    ['faringitis y amigdalitis estreptococicas en jalisco', 'Faringitis y amigdalitis']]) {
    const r = await conversa(q);
    sinSeriesAjenas(r, q);
    assert.doesNotMatch(r.md, /Quisiste decir/, q);
    assert.ok(r.md.includes(nombre), q);
  }
});

test('el nombre completo de una categoría gana al alias parcial de un release', async () => {
  const r = await conversa('otras infecciones intestinales debidas a protozoarios en jalisco');
  assert.equal(r.handler, 'answerRadarNombreExacto');
  assert.match(r.md, /A07\.0, A07\.2, A07\.9/);
  assert.equal((await conversa('infecciones intestinales en jalisco')).handler, 'answerObesidad');
});

test('términos coloquiales: radar si la categoría es inequívoca, sin cifras ajenas si no', async () => {
  assert.equal((await conversa('mordedura de perro en jalisco')).handler, 'answerRadarBoletin');
  assert.equal((await conversa('accidentes de transito en sonora')).handler, 'answerRadarBoletin');
  assert.equal((await conversa('intoxicacion por alcohol en jalisco')).handler, 'answerRadarBoletin');
  for (const q of ['embarazo adolescente en jalisco', 'alcoholismo en jalisco', 'cuantos casos de alcoholismo hubo']) {
    const r = await conversa(q);
    sinSeriesAjenas(r, q);
    assert.equal(r.handler, 'answerCategoriaNoReconocida', q);
  }
});

test('barrido: ninguna categoría no modelada del radar vigente cae en series ajenas', async () => {
  const limpio = (s) => s.replace(/[°^•§]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const nombres = FOTO.diseases.filter((e) => !e.platform_id).map((e) => limpio(e.name));
  assert.ok(nombres.length > 100);
  for (const nom of nombres) {
    for (const q of [`${nom} en jalisco`, `cuantos casos de ${nom} hubo`]) sinSeriesAjenas(await conversa(q), q);
  }
});

test('los publicados y el resumen del estado no cambian', async () => {
  assert.equal((await conversa('depresion en jalisco')).handler, 'answerSpecificSeries');
  assert.equal((await conversa('depresoin en jalisco')).handler, 'answerSpecificSeries');
  assert.equal((await conversa('jalisco')).handler, 'answerEstado');
  assert.equal((await conversa('infeccion de vias urinarias en jalisco')).handler, 'answerObesidad');
  assert.equal((await conversa('diabetes en jalisco')).handler, 'answerDiabetes');
  assert.equal((await conversa('neumonias en puebla')).handler, 'answerObesidad');
});

test('las respuestas sin modelo sobreviven al pulidor ortográfico', async () => {
  for (const q of ['poliomielitis en jalisco', 'embarazo adolescente en jalisco', 'violencia intrafamiliar en jalisco',
    'tuberculosis en jalisco', 'cuantos padecimientos tiene el boletin']) {
    assert.doesNotMatch((await conversa(q)).md, PULIDOR_PUBLICA, q);
  }
});
