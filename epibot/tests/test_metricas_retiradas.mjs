/**
 * test_metricas_retiradas.mjs — métricas de selección W28–W37 retiradas (decisión del autor,
 * 13-oct-2026).
 *
 * En la ronda con corte W37 toda métrica de error por serie o por motor (SMAPE, MASE, RMSE, MAE,
 * medianas/medias, rankings y top/bottom por ellas, «precisión histórica») es el error de la ventana
 * con la que se eligió el motor productivo: diagnóstico de selección, no evaluación independiente.
 * El generador las quita de knowledge.json y declara `metricas_seleccion.publicadas === false`.
 *
 * Esta suite NO depende de qué knowledge.json haya en disco: aplica en memoria la MISMA regla de
 * retiro que el generador (claves `(^|_)(smape|mase|rmse|mae)(_|$)` o `precision_historica*` a
 * cualquier profundidad salvo bajo `definiciones`, y la sección `rendimiento_2026` entera) y le
 * pregunta al bot por la ruta de producción.
 *
 * Uso: node --test tests/test_metricas_retiradas.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';

const RX_CLAVE = /(^|_)(smape|mase|rmse|mae)(_|$)/i;
const retira = (k) => RX_CLAVE.test(k) || k.startsWith('precision_historica');
function limpia(o) {
  if (Array.isArray(o)) return o.map(limpia);
  if (o && typeof o === 'object') {
    return Object.fromEntries(Object.entries(o).filter(([k]) => !retira(k)).map(([k, v]) => [k, limpia(v)]));
  }
  return o;
}
function despoja(kb) {
  const out = {};
  for (const [k, v] of Object.entries(kb)) {
    if (k === 'rendimiento_2026') continue;
    out[k] = k === 'definiciones' ? v : limpia(v);
  }
  out.metricas_seleccion = {
    publicadas: false,
    ventana: 'W28–W37',
    rotulo: 'diagnóstico de selección W28–W37; no evaluación independiente',
    nota: 'Las métricas de error de esta ronda midieron la ventana con la que se eligió el motor de cada serie; no se publican como desempeño del pronóstico.',
  };
  return out;
}
/** Rutas de claves retiradas que sobreviven fuera de `definiciones`. */
function clavesRetiradas(o, ruta = '', out = []) {
  if (Array.isArray(o)) o.forEach((v, i) => clavesRetiradas(v, `${ruta}[${i}]`, out));
  else if (o && typeof o === 'object') {
    for (const [k, v] of Object.entries(o)) {
      if (ruta === '' && k === 'definiciones') continue;
      if (retira(k)) out.push(`${ruta}.${k}`);
      clavesRetiradas(v, `${ruta}.${k}`, out);
    }
  }
  return out;
}

const original = JSON.parse(readFileSync(new URL('../knowledge.json', import.meta.url), 'utf-8'));
const KB = despoja(original);
globalThis.fetch = async (u) => (String(u).includes('knowledge.json')
  ? { ok: true, json: async () => JSON.parse(JSON.stringify(KB)) }
  : { ok: false, json: async () => null });
Math.random = () => 0.42;
const kb = await import('../js/kb.js');
await kb.loadKnowledge();

const AVISO = /diagnóstico de selección/;
async function traza(query, setup = null) {
  kb._resetContext();
  if (setup) await kb.answerWithTrace(setup);
  return kb.answerWithTrace(query);
}
/** Un valor de métrica pintado: «SMAPE 16.1», «MASE: 0.57», «SMAPE mediano **20.4%**»… */
const RX_VALOR = /\b(s?mape|mase|rmse|mae)\b[\s:*(=]*(promedio|mediano|medio|de)?[\s:*(=]*\d/i;
/** Un «%» que no sigue a un número (salvo encabezados «| % |» y «% de…»). */
const RX_PCT_SUELTO = /(?<![\d*])\**%(?!\s*(de|del|mujeres|hombres)\b)/;

test('el helper lee la declaración y el aviso nombra la ventana', () => {
  assert.equal(kb.metricasRetiradas(KB), true);
  assert.equal(kb.metricasRetiradas({}), false);
  assert.equal(kb.metricasRetiradas({ metricas_seleccion: { publicadas: true } }), false);
  assert.equal(kb.metricasRetiradas(null), false);
  const aviso = kb.avisoMetricas(KB);
  assert.match(aviso, /W28–W37/);
  assert.match(aviso, AVISO);
  assert.match(aviso, /no evaluación independiente/);
  assert.equal(kb.rotuloMetricas(KB), KB.metricas_seleccion.rotulo);
});

test('la carga no re-deriva métricas retiradas en stats (_fixCohortStats)', () => {
  const sobrevivientes = clavesRetiradas(kb.getData());
  assert.deepEqual(sobrevivientes, []);
});

test('las preguntas por VALORES de métricas responden el aviso, sin cifras de error', async () => {
  const consultas = [
    'metricas globales', 'smape promedio del proyecto', 'cual es el mase promedio', 'que rmse tienen los modelos',
    'ranking de mejores modelos', 'top 5 peores modelos', 'mejores y peores modelos', 'que motor tiene mejor smape',
    'mase por motor', 'rango de smape', 'violin del smape', 'histograma de mase', 'tabla de metricas por padecimiento',
    'rendimiento 2026', 'matriz de rendimiento', 'rendimiento de dengue', 'mase de dengue', 'rendimiento de prophet',
    'comparar hombres y mujeres desempeno', 'volumen vs error', 'radar de motores',
  ];
  for (const q of consultas) {
    const { response, handler } = await traza(q);
    assert.ok(response, `${q}: debe responder (handler ${handler})`);
    assert.match(response, AVISO, `${q} (${handler}) no trae el aviso`);
    const visible = response.replace(/<!--[\s\S]*?-->/g, '');
    assert.doesNotMatch(visible, RX_VALOR, `${q} (${handler}) pinta un valor de métrica`);
    assert.doesNotMatch(response, /<!--(DISTRIB|GENCHART):/, `${q} (${handler}) emite un gráfico de métricas`);
  }
});

test('lo que no es métrica se conserva: motor productivo, reparto de motores, series', async () => {
  const serie = await traza('depresion en jalisco');
  assert.equal(serie.handler, 'answerSpecificSeries');
  assert.match(serie.response, /Modelo de producci[oó]n: \*\*\w+/);
  assert.doesNotMatch(serie.response, /SMAPE|Confianza|precisi[oó]n hist/i);

  const motor = await traza('que motor tiene mejor smape');
  assert.match(motor.response, /Series productivas/);

  const dengue = await traza('modelos de dengue');
  assert.equal(dengue.handler, 'answerDengue');
  assert.match(dengue.response, /motor productivo es \*\*\w+\*\*/);
  assert.doesNotMatch(dengue.response, /SMAPE \*\*/);

  const tabla = await traza('tabla de metricas por padecimiento');
  assert.match(tabla.response, /Motores productivos/);
});

test('las DEFINICIONES de SMAPE/MASE siguen respondiéndose', async () => {
  for (const [q, termino] of [['que es el smape', 'SMAPE'], ['que es mase', 'MASE'], ['que es rmse', 'RMSE'], ['que significa smape', 'SMAPE']]) {
    const { response, handler } = await traza(q);
    assert.equal(handler, 'answerDefinicion', q);
    assert.match(response, new RegExp(`\\*\\*${termino}\\*\\*:`), q);
  }
});

test('ninguna respuesta del fixture pinta undefined, NaN, null, «%» sin número ni valores de métrica', async () => {
  const casos = JSON.parse(readFileSync(new URL('./test_cases.json', import.meta.url), 'utf-8'));
  const malas = [];
  for (const c of casos) {
    let r;
    try { r = await traza(c.query, c.setupQuery || null); } catch (e) { malas.push(`${c.query}: CRASH ${e.message}`); continue; }
    if (!r.response) continue;
    const visible = r.response.replace(/<!--[\s\S]*?-->/g, '').replace(/\| % \|/g, '| pct |');
    for (const [rx, etiqueta] of [[/undefined/i, 'undefined'], [/\bNaN\b/, 'NaN'], [/\bnull\b/, 'null'],
      [RX_PCT_SUELTO, '% sin número'], [RX_VALOR, 'valor de métrica']]) {
      if (rx.test(visible)) malas.push(`#${c.id} ${c.query} (${r.handler}): ${etiqueta}`);
    }
    if (/<!--(COMPARE|DISTRIB|GENCHART)[^>]*"smape":\s*[\d"]/.test(r.response)) malas.push(`#${c.id} ${c.query}: marcador con smape`);
  }
  assert.deepEqual(malas, []);
});
