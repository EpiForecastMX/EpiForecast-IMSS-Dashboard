/**
 * test_galeria_seguimiento.mjs — ronda W37 (decisiones del autor, 14-oct-2026).
 *
 * - «¿cuántos gráficos?» responde con la galería publicada (rosters.gallery_items = 432), no con los
 *   333 modelos neuro; «¿cuántos modelos?» distingue 333 neuro de las 432 series productivas.
 * - La validación lee `seguimiento_post_corte`: número de semanas evaluadas, corte y horizonte de
 *   cada semana; sin la sección remite a la página.
 * - La calibración sólo dibuja pares con semana declarada.
 *
 * No depende del knowledge.json en disco: arma uno mínimo en memoria.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

const SEG = {
  version: 2,
  rotulo: 'seguimiento diagnóstico posterior al corte; no evaluación independiente',
  corte: { etiqueta: '2026-W37' },
  semanas_evaluadas: 2,
  semanas: [
    { etiqueta: '2026-W38', horizonte: 1, cohortes: { neuro: { series: 333, pares: 329, ausentes: 4, error_abs_medio: 9.86, error_abs_mediano: 2 } } },
    { etiqueta: '2026-W39', horizonte: 2, cohortes: { neuro: { series: 333, pares: 332, ausentes: 1, error_abs_medio: 9.19, error_abs_mediano: 2 } } },
  ],
};
const KB = {
  stats: { total_modelos: 333, dist_motor: { Ensemble: 109, Stacking: 107, Prophet: 78, DeepAR: 39 } },
  rosters: { total_series: 432, gallery_items: 432, por_cohorte: { neuro: 333, dengue: 99 } },
  prod_models: [
    { padecimiento: 'Depresion', entidad: 'Nacional', sexo: 'general', pron_sem_previa: 3136, realidad_sem_previa: 3332,
      semana_validacion: '2026-W39', corte_validacion: '2026-W37', horizonte_validacion: 2 },
    { padecimiento: 'Depresion', entidad: 'Jalisco', sexo: 'general', pron_sem_previa: 99, realidad_sem_previa: 120 },
  ],
  seguimiento_post_corte: SEG,
  metricas_seleccion: { publicadas: false, rotulo: 'diagnóstico de selección W28–W37; no evaluación independiente' },
};
globalThis.fetch = async () => ({ ok: true, json: async () => JSON.parse(JSON.stringify(KB)) });

const kb = await import('../js/kb.js');
await kb.loadKnowledge();
const pregunta = async (q) => {
  kb._resetContext?.();
  return kb.answerWithTrace(q);
};

test('los gráficos se cuentan en la galería publicada', async () => {
  const r = await pregunta('¿cuántos gráficos publica la galería?');
  assert.match(r.response, /\*\*432 gráficos\*\*: 333 neuro y 99 de Dengue/);
  assert.doesNotMatch(r.response, /444/);
});

test('los modelos distinguen la cohorte neuro del total de series', async () => {
  const r = await pregunta('¿cuántos modelos hay?');
  assert.match(r.response, /333 modelos neuro/);
  assert.match(r.response, /432 series productivas/);
  assert.doesNotMatch(r.response, /en producci[oó]n total/);
});

test('la validación muestra las semanas evaluadas, el corte y el horizonte', async () => {
  const r = await pregunta('validacion semanal');
  assert.equal(r.handler, 'answerValidacion');
  assert.match(r.response, /\*\*2 semanas evaluadas\*\*/);
  assert.match(r.response, /corte en la semana 37 de 2026/);
  assert.match(r.response, /semana 38 de 2026\* — horizonte 1 semana desde el corte/);
  assert.match(r.response, /semana 39 de 2026\* — horizonte 2 semanas desde el corte/);
  assert.match(r.response, /no evaluación independiente/);
});

test('sin seguimiento la validación remite a la página y no inventa cifras', async () => {
  const d = kb.getData();
  const guardado = d.seguimiento_post_corte;
  delete d.seguimiento_post_corte;
  try {
    const r = await pregunta('validacion semanal');
    assert.match(r.response, /validacion_semanal\.html/);
    assert.doesNotMatch(r.response, /error absoluto/);
  } finally {
    d.seguimiento_post_corte = guardado;
  }
});

test('la calibración sólo usa pares con semana declarada', async () => {
  const r = await pregunta('calibracion');
  assert.match(r.response, /Se grafican \*\*1 modelos\*\*/);
  assert.match(r.response, /semana 39 de 2026, a 2 semanas del corte/);
});
