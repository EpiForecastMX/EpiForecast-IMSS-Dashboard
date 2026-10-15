import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { filasComparacion, resumenPares, graficoRondas } from '../js/comparacion_rondas.js';

const data = JSON.parse(readFileSync(new URL('../comparacion_rondas.json', import.meta.url)));
const knowledge = JSON.parse(readFileSync(new URL('../knowledge.json', import.meta.url)));

test('las dos rondas conservan denominadores y ventanas separados', () => {
  for (const pad of ['Depresion','Parkinson','Alzheimer']) {
    assert.equal(resumenPares(filasComparacion(data,pad),'anterior').n,33);
    assert.equal(resumenPares(filasComparacion(data,pad),'actual').n,2);
    assert.equal(resumenPares(filasComparacion(data,pad,'archivo'),'anterior').n,16);
    assert.equal(filasComparacion(data,pad,'actual').length,2);
    assert.ok(data.series[pad].semanas.filter(w=>w.semana<=37).every(w=>w.actual===null));
  }
});

test('se reproducen los pares publicados de Depresión, sin ajuste dentro de muestra', () => {
  const rows=filasComparacion(data,'Depresion','actual');
  assert.deepEqual(rows.map(w=>[w.semana,w.real,w.actual]),[[38,2748,3118],[39,3332,3136]]);
  assert.deepEqual(resumenPares(rows,'actual'),{n:2,observado:6080,previsto:6254,diferencia:174,mae:283});
});

test('un observado ausente no se transforma en cero ni entra en el denominador', () => {
  const rows=structuredClone(filasComparacion(data,'Depresion','actual'));
  rows[0].real=null;
  assert.equal(resumenPares(rows,'actual').n,1);
  assert.equal(resumenPares(rows,'actual').observado,3332);
});

test('el origen de cada punto anterior permite distinguir retrospectiva y archivo previo', () => {
  const rows=filasComparacion(data,'Depresion');
  assert.equal(rows.find(w=>w.semana===7).procedencia_anterior,'archivo_wcp');
  assert.equal(rows.find(w=>w.semana===22).fase_anterior,'retrospectivo');
  assert.ok(rows.filter(w=>w.fase_anterior==='archivo_previo').every(w=>w.semana>=24 && w.procedencia_anterior==='snapshot_junio'));
  assert.equal(data.fuentes.snapshot_junio.commit,'8751ba63894d77c816a07579b03128e521c85c80');
});

test('las fechas del horizonte son las oficiales, sin desplazar el corte al último observado', () => {
  assert.equal(data.horizonte_actual.inicio,'2026-09-20');
  assert.equal(data.horizonte_actual.fin,'2027-09-11');
  assert.equal(data.horizonte_actual.primera,'2026-W38');
  assert.equal(data.horizonte_actual.ultima,'2027-W36');
  assert.deepEqual(data.horizonte_actual.pasos_sin_semana,['2026-12-28']);
});

test('el gráfico marca W38/W39 y no conecta ausencias ni muestra ajuste W1–W37', () => {
  const c=graficoRondas(data,'Depresion');
  assert.equal(c.datasets[2].data.filter(Number.isFinite).length,2);
  assert.equal(c.datasets[2].pointRadius,6);
  assert.equal(c.datasets[2].spanGaps,false);
  assert.deepEqual(graficoRondas(data,'Depresion','actual').labels,['Sem 38','Sem 39']);
});

globalThis.fetch=async url=>({ok:true,json:async()=>structuredClone(String(url).includes('comparacion_rondas')?data:knowledge)});
const kb=await import('../js/kb.js');
await kb.loadKnowledge();
test('EpiBot responde localmente a la nueva comparación y conserva el seguimiento corto', async () => {
  kb._resetContext?.();
  const r=await kb.answerWithTrace('comparar rondas depresion');
  assert.equal(r.handler,'answerComparacionRondas');
  assert.match(r.response,/retrospectiva/);
  assert.match(r.response,/<!--RONDAS:/);
  const weekly=await kb.answerWithTrace('real vs pronostico depresion');
  assert.equal(weekly.handler,'answerComparacionSemanal');
  assert.match(weekly.response,/Comparar 2026/);
});

test('las consultas de horizonte y corte no publican las fechas heredadas incorrectas', async () => {
  kb._resetContext?.();
  const r=await kb.answerWithTrace('horizonte de pronostico');
  assert.match(r.response,/2026-09-20/);
  assert.match(r.response,/2027-09-11/);
  assert.doesNotMatch(r.response,/2025-01-01|2026-09-21|2027-08-30/);
});

test('no atribuye el archivo nacional a una serie estatal o a un sexo', async () => {
  kb._resetContext?.();
  assert.match((await kb.answerWithTrace('comparar rondas depresion en Jalisco')).response,/sólo para/);
  kb._resetContext?.();
  assert.match((await kb.answerWithTrace('comparar rondas depresion hombres')).response,/sólo para/);
});

test('Dengue sólo compara las semanas que tienen archivo, sin inventar W7–W21', () => {
  const rows=filasComparacion(data,'Dengue');
  assert.equal(resumenPares(rows,'anterior').n,18);
  assert.equal(resumenPares(rows,'actual').n,2);
  assert.ok(rows.filter(w=>w.semana<22).every(w=>w.anterior===null));
});
