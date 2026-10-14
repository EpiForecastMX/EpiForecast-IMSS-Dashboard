/**
 * test_agregado_estatal.mjs — ronda W37 (decisión del autor, 14-oct-2026).
 *
 * El indicador «Notificaciones previstas · agregado estatal neuro» es el valor canónico del
 * backend (suma de los yhat originales de 96 series, redondeada una vez: 171,524). El EpiBot no
 * lo recalcula desde los totales por serie ya redondeados (171,525) y no llama «nacional» a la
 * suma de los 32 estados: los modelos nacionales conservan su pronóstico propio.
 *
 * No depende del knowledge.json en disco: arma uno mínimo en memoria.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

const ROT = 'Notificaciones previstas · agregado estatal neuro';
const DEN = '96 series: 32 estados × 3 padecimientos (Alzheimer, Depresión, Parkinson), modo general · 52 pasos desde el corte W37';
const pp = { Alzheimer: [1899.4, 1915, 'Prophet'], Depresion: [161887.1, 160999, 'Ensemble'], Parkinson: [7737.54, 7391, 'Prophet'] };
// Totales por serie ya redondeados que suman 171,525: si el EpiBot los recalcula, lo delata.
const prod_models = [];
for (const [p, [, nac, motor]] of Object.entries(pp)) {
  prod_models.push({ padecimiento: p, entidad: 'Nacional', sexo: 'general', modelo_produccion: motor, casos_52_semanas_futuro: nac });
  for (let i = 0; i < 32; i++) prod_models.push({ padecimiento: p, entidad: `Estado ${i}`, sexo: 'general', modelo_produccion: 'Ensemble', casos_52_semanas_futuro: i === 0 ? 1 : 0 });
}
const KB = {
  stats: {
    total_modelos: 333, motor_ganador: 'Ensemble', motor_ganador_pct: 32.7, pronostico_total: 171524,
    por_pad: Object.fromEntries(Object.entries(pp).map(([p, [v, nac]]) => [p, { n: 111, casos_futuro_total: Math.floor(v + 0.5),
      por_sexo: { general: { n: 37, n_estados: 32, casos_total: Math.floor(v + 0.5), casos_nacional: nac } } }])),
  },
  prod_models,
  agregado_estatal_neuro: {
    rotulo: ROT, corte: '2026-W37', series_incluidas: 96, valores: 4992, suma_original: 171524.0401, valor_mostrado: 171524,
    denominador: DEN, horizonte: { pasos: 52, semanas_del_boletin: '2026-W38 a 2027-W36 (51 semanas)', pasos_sin_semana_del_boletin: ['2026-12-28'] },
    por_padecimiento: Object.fromEntries(Object.entries(pp).map(([p, [v]]) => [p, { series: 32, suma_original: v, valor_mostrado: Math.floor(v + 0.5) }])),
  },
};
globalThis.fetch = async () => ({ ok: true, json: async () => JSON.parse(JSON.stringify(KB)) });

const kb = await import('../js/kb.js');
await kb.loadKnowledge();
const pregunta = async (q) => { kb._resetContext?.(); return kb.answerWithTrace(q); };

test('el EpiBot no recalcula el indicador desde totales redondeados', async () => {
  assert.equal(kb.getStats().pronostico_total, 171524);
  const r = await pregunta('hola');
  assert.match(r.response, new RegExp(`${ROT}: \\*\\*171,524\\*\\*`));
  assert.ok(r.response.includes(DEN));
  assert.doesNotMatch(r.response, /171,525/);
});

test('el total distingue los modelos nacionales del agregado estatal', async () => {
  const r = await pregunta('cual es el pronostico total');
  assert.equal(r.handler, 'answerPronostico');
  assert.doesNotMatch(r.response, /Pron[oó]stico Nacional/);
  assert.match(r.response, /\| Depresión \| 160,999 \| Ensemble \| 161,887 \|/);
  assert.match(r.response, /Horizonte: 52 pasos desde el corte: semanas del boletín 2026-W38 a 2027-W36 \(51 semanas\) y 1 paso sin semana/);
});

test('«nacional» es el pronóstico propio del modelo nacional', async () => {
  const r = await pregunta('pronostico de depresion');
  assert.match(r.response, /El modelo nacional \(Ensemble\) pronostica \*\*160,999 casos/);
  assert.match(r.response, /Agregado estatal \(32 estados, modo general, 52 pasos desde el corte\): \*\*161,887 casos\*\*/);
  const otro = await pregunta('depresion en narnia');
  assert.match(otro.response, /A nivel \*\*Nacional\*\*, el modelo nacional \(Ensemble\) pronostica \*\*160,999 casos/);
  assert.doesNotMatch(otro.response, /161,887/);
});

test('el reporte usa el indicador canónico, no una suma solapada', async () => {
  const r = await pregunta('reporte pdf');
  assert.ok(r.response.includes(`**${ROT}**: 171,524 casos (${DEN})`));
  assert.doesNotMatch(r.response, /Total nacional pronosticado/);
});
