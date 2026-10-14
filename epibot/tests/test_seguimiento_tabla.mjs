/**
 * test_seguimiento_tabla.mjs — ronda W37 (decisiones del autor, 14-oct-2026).
 *
 * La tabla «Real vs Pronóstico 2026» del EpiBot pasó a «Seguimiento del pronóstico con corte W37»:
 * - sólo los pares POSTERIORES al corte se comparan; las semanas anteriores se consultan como
 *   observado (el ajuste dentro de muestra no se presenta como validación);
 * - «Periodo del boletín» con las fechas oficiales (el ds legado no es su inicio);
 * - semana, corte, horizonte y estado del par; un ausente sigue ausente, nunca cero;
 * - sin calificaciones automáticas («precisión excelente/buena/moderada»);
 * - el nacional por sexo se rotula «incremento neto del acumulado por sexo, sujeto a revisiones».
 *
 * No depende del knowledge.json en disco: arma uno mínimo en memoria.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

const DEF = 'incremento neto del acumulado por sexo, sujeto a revisiones';
const per = (s) => {
  const ini = new Date(Date.UTC(2026, 0, 4) + (s - 1) * 7 * 864e5);
  return { periodo_inicio: ini.toISOString().slice(0, 10), periodo_fin: new Date(+ini + 6 * 864e5).toISOString().slice(0, 10) };
};
const semanas = [];
for (let s = 1; s <= 52; s++) {
  const base = { anio: 2026, semana: s, etiqueta: `2026-W${String(s).padStart(2, '0')}`, ...per(s) };
  if (s <= 37) semanas.push({ ...base, fase: 'observado', real: 3000 + s });
  else if (s === 38) semanas.push({ ...base, fase: 'seguimiento', corte: '2026-W37', horizonte: 1, pronostico: 3118, real: 2748, estado: 'par', motivo: '', error_abs: 370, diferencia: 370 });
  else if (s === 39) semanas.push({ ...base, fase: 'seguimiento', corte: '2026-W37', horizonte: 2, pronostico: 3136, real: null, estado: 'ausente', motivo: 'revisión negativa del acumulado' });
  else semanas.push({ ...base, fase: 'pronostico', corte: '2026-W37', horizonte: s - 37, pronostico: 3100 + s, real: null, prophet: 1500, deepar: 3200, ensemble: 3100 + s, stacking: 3300 });
}
const WC = { version: 2, titulo: 'Seguimiento del pronóstico con corte W37', motor: 'Ensemble', modelo_productivo: 'ensemble', anio: 2026, corte: '2026-W37', pronostico_52_pasos: 160999, semanas };
const KB = {
  stats: { total_modelos: 333 },
  weekly_comparison: { Depresion: WC },
  seguimiento_post_corte: {
    rotulo: 'seguimiento diagnóstico posterior al corte; no evaluación independiente',
    corte: { etiqueta: '2026-W37' }, semanas_evaluadas: 2,
    definiciones: { general: 'casos de la semana (Casos_semana)', sexo_agregado: DEF },
    semanas: [{ etiqueta: '2026-W39', horizonte: 2, cohortes: { neuro: { series: 333, pares: 332, ausentes: 1, nacional: [
      { padecimiento: 'Parkinson', sexo: 'hombres', motor: 'Ensemble', pronostico: 88, real: 85, definicion_real: DEF },
    ] } } }],
    ausentes: [{ semana_objetivo: '2026-W39', padecimiento: 'Parkinson', entidad: 'Tamaulipas', sexo: 'hombres', motivo: 'revisión negativa del acumulado por sexo (148 → 146)' }],
  },
};
globalThis.fetch = async () => ({ ok: true, json: async () => JSON.parse(JSON.stringify(KB)) });

const kb = await import('../js/kb.js');
await kb.loadKnowledge();
const pregunta = async (q) => { kb._resetContext?.(); return kb.answerWithTrace(q); };
const filasTabla = (txt) => txt.split('\n').filter((l) => /^\| Sem \d+ \|/.test(l));

test('la tabla se titula por el corte y sólo compara las semanas posteriores a él', async () => {
  const r = await pregunta('real vs pronostico depresion');
  assert.equal(r.handler, 'answerComparacionSemanal');
  assert.match(r.response, /Seguimiento del pronóstico con corte W37/);
  assert.doesNotMatch(r.response, /Real vs Pron[oó]stico/);
  const filas = filasTabla(r.response);
  assert.deepEqual(filas.map((l) => l.split('|')[1].trim()), ['Sem 38', 'Sem 39']);
  assert.match(r.response, /ajuste dentro de muestra no se presenta como validación/);
});

test('cada par lleva el periodo oficial, el corte, el horizonte y su estado', async () => {
  const r = await pregunta('real vs pronostico depresion');
  assert.match(r.response, /\| Semana \| Periodo del boletín \| Corte \| Horizonte \| Observado \| Pronóstico \| Diferencia \(pron\. − obs\.\) \| Estado del par \|/);
  assert.match(r.response, /\| Sem 38 \| 20–26 sep 2026 \| W37 \| 1 \| 2,748 \| 3,118 \| \+370 \| par \|/);
  assert.doesNotMatch(r.response, /\| Inicio \||09-07/);  // el ds legado de la W38 no es su inicio
});

test('un ausente sigue ausente: sin cero, sin diferencia, con su motivo', async () => {
  const r = await pregunta('real vs pronostico depresion');
  assert.match(r.response, /\| Sem 39 \| 27 sep – 3 oct 2026 \| W37 \| 2 \| — \| 3,136 \| — \| ausente: revisión negativa del acumulado \|/);
  const m = r.response.match(/<!--WEEKLY:(.*?)-->/);
  assert.deepEqual(JSON.parse(m[1]).semanas, [
    { s: 38, r: 2748, p: 3118, estado: 'par' },
    { s: 39, r: null, p: 3136, estado: 'ausente' },
  ]);
});

test('sin calificaciones automáticas ni acumulados contra el ajuste', async () => {
  for (const q of ['real vs pronostico depresion', 'comparacion semanal', 'heatmap error semanal', 'zoom semanal depresion']) {
    const r = await pregunta(q);
    assert.doesNotMatch(r.response, /precisi[oó]n \*\*(excelente|buena|moderada)/i, q);
    assert.doesNotMatch(r.response, /Error acumulado|Acumulado \d+ semanas|= bueno|alta confianza/, q);
  }
});

test('una semana anterior al corte se consulta como observado, sin comparación', async () => {
  const r = await pregunta('compara semana 30 de depresion');
  assert.match(r.response, /anterior al corte: sólo se muestra lo observado/);
  assert.match(r.response, /Observado: \*\*3,030\*\* casos/);
  assert.doesNotMatch(r.response, /<!--WEEKLY/);
});

test('el nacional por sexo se rotula como incremento neto del acumulado y los ausentes se listan', async () => {
  const r = await pregunta('validacion semanal');
  assert.match(r.response, /\| Parkinson \| hombres \| 85 \| 88 \| incremento neto del acumulado por sexo, sujeto a revisiones \|/);
  assert.match(r.response, /No es un número demostrado de casos nuevos/);
  assert.match(r.response, /Tamaulipas · hombres: revisión negativa del acumulado por sexo \(148 → 146\)/);
});

test('los totales usan el pronóstico de 52 pasos desde el corte, no el ajuste del año', async () => {
  const r = await pregunta('pronostico acumulado');
  assert.match(r.response, /Total acumulado al final: \*\*160,999 casos\*\*/);
  assert.match(r.response, /52 pasos semanales desde el corte/);
});
