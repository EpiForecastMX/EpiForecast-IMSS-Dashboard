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
import vm from 'node:vm';
import { summarizeCoverage } from '../../assets/boletin/coverage.mjs';

const leer = (r) => readFileSync(new URL(`../../${r}`, import.meta.url), 'utf-8');
const K = leer('epibot/knowledge.json');
globalThis.fetch = async (u) => {
  const m = String(u).match(/(publication\/[^?]+\.json|assets\/boletin\/[^?]+\.json)/);
  return { ok: true, json: async () => JSON.parse(m ? leer(m[1]) : K) };
};
const kb = await import('../js/kb.js');
const { detectEntities } = await import('../js/entities.js');
const oc = await import('../js/obesidad_charts.js');
const rc = await import('../js/release_config.js');
const d = await kb.loadKnowledge();
await d.obesidad_pendiente;

const app = leer('epibot/js/app.js');
const between = (a, b) => app.slice(app.indexOf(a), app.indexOf(b, app.indexOf(a)));
const extract = vm.runInNewContext(`(${between('function extractChartData(', '\nfunction ')})`, {
  getData: () => d, detectEntities, releaseConAlias: rc.releaseConAlias, graficaObesidad: oc.graficaObesidad, ...rc,
  graficoRondas: () => null, buildDengueAnual: () => ({ type: 'dengue' }), console,
});

const ACTUAL = JSON.parse(leer('assets/boletin/actual.json'));
const FOTO = JSON.parse(leer(`${ACTUAL.carpeta}/data.json`));
const CATALOG = JSON.parse(leer('publication/catalog.json'));

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

// alta_b44 (19-nov-2026): la violencia intrafamiliar (Y07.0-Y07.2) y la herida por arma de fuego (W32-W34) se publicaron con
// OK nominal del autor; su rótulo técnico responde su propio release, nunca la tabla neuro. Los términos genéricos siguen sin cifras.
test('violencia intrafamiliar y herida por arma de fuego: su propio release, nunca la tabla neuro', async () => {
  for (const [q, marca] of [['violencia intrafamiliar en jalisco', 'VIOLENCIA_INTRAFAMILIAR_Y07'],
    ['violencia intrafamiliar en jalisco mujeres', 'VIOLENCIA_INTRAFAMILIAR_Y07'],
    ['herida por arma de fuego en sonora', 'HERIDA_ARMA_FUEGO_W32']]) {
    const r = await conversa(q);
    assert.equal(r.handler, 'answerObesidad', q);
    assert.match(r.md, new RegExp(marca), q);
    assert.doesNotMatch(r.md, /casos totales|modelos de producci[oó]n|agregado estatal neuro/, q);
  }
});

test('violencias genéricas: sin tabla neuro, sin cifras y sin tratarlas como crisis', async () => {
  for (const q of ['violencia familiar en jalisco', 'violencia de genero en jalisco', 'cuantos casos de violencia de genero hubo',
    'abuso sexual en jalisco', 'maltrato infantil en jalisco', 'heridas de bala en jalisco']) {
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
    const r = await conversa('violencia de genero en jalisco', sig);
    sinSeriesAjenas(r, sig);
  }
});

test('las autolesiones conservan su respuesta específica con la línea existente', async () => {
  // alta_b44: los términos genéricos dan la respuesta de crisis; el rótulo técnico completo (X78) abre su release.
  for (const q of ['intento de suicidio en jalisco', 'envenenamiento autoinfligido en jalisco',
    'lesiones autoinfligidas en sonora']) {
    const r = await conversa(q);
    sinSeriesAjenas(r, q);
    assert.equal(r.handler, 'answerCrisis', q);
    assert.match(r.md, LINEA, q);
    assert.match(r.md, /800 911 2000/, q);
    assert.doesNotMatch(r.md, /Boletín Epidemiológico \d+ de \d{4}/, q);
  }
  assert.equal((await conversa('tengo ganas de morir')).handler, 'answerCrisis');
});

test('la corrección difusa no convierte un nombre del boletín en otro padecimiento', async () => {
  for (const [q, nombre] of [['cuantos casos de colera hubo', 'Cólera'],
    // La fiebre paratifoidea se publicó aceptada en alta20c: ya no es un nombre del radar sin modelo.
    ['deplecion del volumen deshidratacion en jalisco', 'Depleción del volumen'],
    // Lote 6: la leishmaniasis cutánea se publicó; la oncocercosis sigue sin modelarse.
    ['oncocercosis en jalisco', 'Oncocercosis']]) {
    const r = await conversa(q);
    sinSeriesAjenas(r, q);
    assert.doesNotMatch(r.md, /Quisiste decir/, q);
    assert.ok(r.md.includes(nombre), q);
  }
});

test('el nombre completo de una categoría gana al alias parcial de un release', async () => {
  // Desde los diez controles (12-nov-2026) A07 es su propio release: su nombre completo, que contiene
  // «infecciones intestinales», no recibe las cifras de A04.
  const r = await conversa('otras infecciones intestinales debidas a protozoarios en jalisco');
  assert.match(r.md, /PROTOZOARIOS_A07/);
  assert.doesNotMatch(r.md, /INTESTINALES_A04/);
  assert.equal((await conversa('infecciones intestinales en jalisco')).handler, 'answerObesidad');
});

test('términos coloquiales: radar si la categoría es inequívoca, sin cifras ajenas si no', async () => {
  // alta_b44: mordeduras por perro, triquinosis e intoxicación por alcohol tienen release propio.
  assert.match((await conversa('mordedura de perro en jalisco')).md, /MORDEDURA_PERRO_W54/);
  // «accidentes de tránsito» es más amplio que los bloques publicados V01-V09 y V20-V29, V40-V79: no
  // recibe el pronóstico de ninguno de los dos.
  const transito = await conversa('accidentes de transito en sonora');
  sinSeriesAjenas(transito, 'accidentes de transito en sonora');
  assert.doesNotMatch(transito.md, /VEHICULOS_V20|PEATON_V01|casos pronosticados/);
  assert.match((await conversa('triquinosis en sonora')).md, /TRIQUINOSIS_B75/);
  assert.match((await conversa('intoxicacion por alcohol en jalisco')).md, /INTOX_ALCOHOL_F100/);
  // «alcoholismo» abarca tres bloques publicados (F10.0, K70 y K70.3): pide precisar, sin cifras.
  for (const q of ['alcoholismo en jalisco', 'cuantos casos de alcoholismo hubo']) {
    const r = await conversa(q);
    sinSeriesAjenas(r, q);
    assert.equal(r.handler, 'answerAliasAmbiguo', q);
  }
  for (const q of ['embarazo adolescente en jalisco']) {
    const r = await conversa(q);
    sinSeriesAjenas(r, q);
    assert.equal(r.handler, 'answerCategoriaNoReconocida', q);
  }
});

test('barrido: ninguna categoría no modelada del radar vigente cae en series ajenas, gráficas ni sexo', async () => {
  const runnerIds = new Set(
    CATALOG.releases
      .filter((r) => r.lifecycle === 'published' && r.visible && r.channels?.includes('epibot'))
      .map((r) => r.disease_id),
  );
  assert.ok(runnerIds.size > 0, 'el catálogo instalado del runner no puede estar vacío');
  assert.ok(runnerIds.has('sifilis_adquirida_a51'), 'sífilis adquirida A51 ya está publicada en el catálogo');
  const legacyIds = new Set([
    ...Object.keys(d.stats?.por_pad || {}).map((k) => k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')),
    ...(d.dengue ? ['dengue'] : []),
  ]);
  assert.deepEqual([...legacyIds].sort(), ['alzheimer', 'dengue', 'depresion', 'parkinson']);
  const publicadosEsperados = new Set([...runnerIds, ...legacyIds]);
  assert.equal(FOTO.meta.platform_published, publicadosEsperados.size);

  const cob = summarizeCoverage(FOTO.diseases);
  assert.equal(cob.published, publicadosEsperados.size);
  assert.equal(FOTO.diseases.length, FOTO.meta.categories + FOTO.meta.aggregate_rows);
  const cubiertas = FOTO.diseases.filter((e) => !e.aggregate && publicadosEsperados.has(e.platform_id));
  assert.deepEqual([...new Set(cubiertas.map((e) => e.platform_id))].sort(), [...publicadosEsperados].sort());
  assert.equal(cubiertas.length, cob.covered);
  assert.equal(FOTO.meta.categories - cubiertas.length, cob.uncovered);

  const agregadas = FOTO.diseases.filter((e) => Boolean(e.aggregate));
  assert.ok(agregadas.length > 0 && agregadas.length === FOTO.meta.aggregate_rows);
  const noCubiertasSinAgregado = FOTO.diseases.filter((e) => !e.aggregate && !publicadosEsperados.has(e.platform_id));
  assert.ok(noCubiertasSinAgregado.length > 0 && noCubiertasSinAgregado.length === cob.uncovered);

  const esperadasSinModelo = FOTO.diseases.filter((e) => Boolean(e.aggregate) || !publicadosEsperados.has(e.platform_id));
  const sinModelo = FOTO.diseases.filter((e) => !e.platform_id);
  assert.equal(sinModelo.length, cob.uncovered + FOTO.meta.aggregate_rows);
  assert.deepEqual(sinModelo.map((e) => e.id), esperadasSinModelo.map((e) => e.id));
  assert.deepEqual(new Set(sinModelo.map((e) => e.name)), new Set(esperadasSinModelo.map((e) => e.name)));
  assert.ok(sinModelo.some((e) => e.name === 'Tétanos neonatal'));
  assert.ok(!sinModelo.some((e) => e.platform_id === 'sifilis_adquirida_a51'));

  const limpio = (s) => s.replace(/[°^•§]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const nombres = sinModelo.map((e) => limpio(e.name));
  assert.ok(nombres.length > 0);
  for (const nom of nombres) {
    const esAutolesion = /autoinfligid|suicid|ideacion/.test(nom);
    for (const q of [`${nom} en jalisco`, `cuantos casos de ${nom} hubo`, `${nom} en jalisco mujeres`]) {
      const r = await conversa(q);
      sinSeriesAjenas(r, q);
      assert.match(r.md, /<!--SIN_GRAFICA-->/, q);
      assert.doesNotMatch(r.md, rc.MARCADOR_RELEASE, q);
      assert.equal(extract(r.md, q), null, `${q}: no debe dibujar gráfica`);
      if (esAutolesion) {
        assert.match(r.md, LINEA, q);
        assert.doesNotMatch(r.md, /Boletín Epidemiológico \d+ de \d{4}/, q);
      } else {
        assert.doesNotMatch(r.md, LINEA, q);
      }
    }
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
