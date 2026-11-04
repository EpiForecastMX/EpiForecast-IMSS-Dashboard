/**
 * C7.7 — Gráficas del EpiBot para Obesidad (E66).
 *
 * Regresión: «zoom obesidad» caía en las gráficas genéricas del carril legacy y pintaba Depresión.
 * Cada petición de gráfica con Obesidad debe salir de su vista publicada, con el mismo tipo en el
 * texto (kb.js) y en la gráfica (app.js), o declarar que esa gráfica no existe para Obesidad.
 * Se alimenta con la vista REAL instalada en publication/obesidad/vista.json.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import vm from 'node:vm';

const K = readFileSync(new URL('../knowledge.json', import.meta.url), 'utf-8');
const V = readFileSync(new URL('../../publication/obesidad/vista.json', import.meta.url), 'utf-8');
const VISTA = JSON.parse(V);
globalThis.fetch = async (u) => ({
  ok: true,
  json: async () => JSON.parse(String(u).includes('publication/obesidad/vista.json') ? V : K),
});
const kb = await import('../js/kb.js');
const { detectEntities } = await import('../js/entities.js');
// Misma URL que importan kb.js y app.js: un solo módulo.
const oc = await import('../js/obesidad_charts.js?v=1');
const d = await kb.loadKnowledge();
await d.obesidad_pendiente;

// extractChartData REAL de app.js, sin DOM. APP_BASE permite comprobar que falla en el árbol previo.
const app = readFileSync(process.env.APP_BASE || new URL('../js/app.js', import.meta.url), 'utf8');
const between = (a, b) => app.slice(app.indexOf(a), app.indexOf(b, app.indexOf(a)));
const extract = vm.runInNewContext(`(${between('function extractChartData(', '\nfunction ')})`, {
  getData: () => d, detectEntities, esObesidad: oc.esObesidad, graficaObesidad: oc.graficaObesidad,
  graficoRondas: () => null, console,
});

async function responde(q) {
  const r = await kb.answerWithTrace(q);
  return { handler: r.handler, md: String(r.response ?? ''), chart: extract(String(r.response ?? ''), q) };
}

const DISPONIBLES = [
  ['zoom obesidad', 'seguimiento', 'line'],
  ['zoom semanal de obesidad en cdmx hombres', 'seguimiento', 'line'],
  ['validación semanal obesidad', 'seguimiento', 'line'],
  ['tendencia histórica de obesidad', 'serie', 'line'],
  ['pronóstico de obesidad', 'serie', 'line'],
  ['obesidad en sonora mujeres', 'serie', 'line'],
  ['corredor de obesidad', 'banda', 'line'],
  ['mapa de obesidad', 'mapa', 'map'],
  ['mapa de obesidad por error', 'mapa', 'map'],
  ['treemap de obesidad', 'entidades', 'bar'],
  ['cuál estado tiene más obesidad', 'entidades', 'bar'],
  ['ranking de obesidad', 'ranking', 'bar'],
  ['mejores y peores obesidad', 'ranking', 'bar'],
  ['calibración de obesidad', 'calibracion', 'scatter'],
  ['volumen vs error obesidad', 'volumen_error', 'scatter'],
  ['acumulado de obesidad', 'acumulado', 'line'],
  ['obesidad por sexo', 'sexo', 'line'],
  ['área apilada obesidad jalisco', 'sexo', 'line'],
  ['comparativa de motores obesidad', 'motores', 'doughnut'],
  ['comparar jalisco y nuevo leon obesidad', 'comparador', 'line'],
  ['sparklines de obesidad', 'comparador', 'line'],
];

test('cada gráfica disponible sale de la vista de Obesidad y concuerda con el texto', async () => {
  for (const [q, tipo, forma] of DISPONIBLES) {
    assert.equal(oc.tipoGraficaObesidad(q), tipo, q);
    const { handler, md, chart } = await responde(q);
    assert.equal(handler, 'answerObesidad', q);
    assert.match(md, /Obesidad \(E66\)/, q);
    assert.ok(chart, `${q}: sin gráfica`);
    if (forma === 'map') {
      assert.equal(chart._mapChart, true, q);
      assert.match(chart.opts.title, /^Obesidad \(E66\)/, q);
    } else {
      assert.equal(chart.type, forma, q);
      assert.match(chart.title, /^Obesidad \(E66\)/, q);
    }
  }
});

test('las no disponibles lo dicen y no dibujan datos de otro padecimiento', async () => {
  for (const q of ['semáforo de obesidad', 'timelapse obesidad', 'heatmap de obesidad', 'radar obesidad', 'reporte pdf de obesidad']) {
    const { handler, md, chart } = await responde(q);
    assert.equal(handler, 'answerObesidad', q);
    assert.equal(chart, null, q);
    assert.ok(md.includes(oc.NO_DISPONIBLE[oc.tipoGraficaObesidad(q)]), q);
    assert.ok(md.includes(oc.ALTERNATIVAS), q);
  }
});

test('zoom: observado y pronóstico son exactamente los de la vista', async () => {
  const { chart } = await responde('zoom obesidad');
  const nac = VISTA.series['nacional|mx|general'];
  const obs = new Map(nac.observado);
  const pron = new Map(nac.pronostico);
  const [o, p] = chart.datasets;
  chart.labels.forEach((ds, i) => {
    assert.equal(o.data[i], obs.get(ds) ?? null, ds);
    assert.equal(p.data[i], pron.get(ds) ?? null, ds);
  });
  assert.ok(chart.labels.includes(VISTA.observation_cutoff_ds));
  assert.ok(chart.labels.some((ds) => ds > VISTA.observation_cutoff_ds), 'muestra semanas futuras');
  assert.ok(chart.labels[0] < nac.pronostico[0][0], 'muestra semanas previas al origen');
});

test('pronóstico puntual: ninguna gráfica dibuja bandas ni intervalos', async () => {
  for (const [q] of DISPONIBLES) {
    const { chart } = await responde(q);
    for (const ds of chart.datasets || []) {
      assert.doesNotMatch(ds.label || '', /intervalo|banda|p10|p90|inferior|superior/i, q);
      assert.ok(!['-1', '+1', 'origin'].includes(String(ds.fill)), q);
    }
  }
  assert.match((await responde('corredor de obesidad')).md, /sin intervalos/);
});

test('el mapa usa los 32 nombres del SVG', async () => {
  const svg = readFileSync(new URL('../js/mexico-map.js', import.meta.url), 'utf8');
  for (const q of ['mapa de obesidad', 'mapa de obesidad por error']) {
    const { chart } = await responde(q);
    const claves = Object.keys(chart.stateData);
    assert.equal(claves.length, 32, q);
    for (const k of claves) assert.ok(svg.includes(`'${k}'`), `${q}: ${k} no está en el mapa`);
  }
});

test('el sexo y el estado de la pregunta llegan a la gráfica', async () => {
  const { chart } = await responde('zoom obesidad cdmx hombres');
  assert.match(chart.title, /Ciudad de México · Hombres/);
  const s = VISTA.series[Object.keys(VISTA.series).find((k) => VISTA.series[k].nombre === 'Ciudad de México' && k.endsWith('|hombres'))];
  assert.equal(chart.datasets[1].data.find((y) => y != null), s.pronostico[0][1]);
});

test('motores: el texto cuenta los productos derivados correctamente', async () => {
  const { md } = await responde('motores de obesidad');
  assert.ok(md.includes(`los otros ${VISTA.products - VISTA.models} de los ${VISTA.products} productos`));
  const total = Object.values(VISTA.engines).reduce((a, n) => a + n, 0);
  assert.equal(total, VISTA.models);
});

test('si la pregunta nombra otro padecimiento, Obesidad no la intercepta', async () => {
  assert.equal((await kb.answerWithTrace('zoom depresion')).handler, 'answerZoom');
  assert.notEqual((await kb.answerWithTrace('comparar obesidad con depresion')).handler, 'answerObesidad');
});

test('las sugerencias tras una consulta de Obesidad son de Obesidad', () => {
  const sug = vm.runInNewContext(`(${between('function getSuggestions(', '\n// ---------------------------------------------------------------------------')})`, {
    norm: (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(),
    esObesidad: oc.esObesidad, metricasRetiradas: () => true, getData: () => d, detectEntities,
  });
  for (const q of ['zoom obesidad', 'mapa de obesidad']) {
    const s = sug(q);
    assert.ok(s.length >= 2, q);
    for (const x of s) assert.ok(oc.esObesidad(x.q), `${q}: ${x.q}`);
    assert.ok(!s.some((x) => x.q === q), `${q}: no se sugiere a sí misma`);
  }
});

test('las etiquetas conservan la semana en mayúscula', async () => {
  const { chart } = await responde('obesidad por sexo');
  for (const ds of chart.datasets) assert.doesNotMatch(ds.label, /-w\d/, ds.label);
  assert.ok(chart.datasets.some((ds) => ds.label.includes(`origen ${VISTA.origin[0]}-W${VISTA.origin[1]}`)));
});
