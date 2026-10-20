import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {semanaBoletin,estadoHorizonte,rezagoBoletin} from '../js/calendario_boletin.js';
import {formatoCasos,rangoGrafico,graficoRondas,comparacionRondasMd} from '../js/comparacion_rondas.js';

const data=JSON.parse(readFileSync(new URL('../comparacion_rondas.json',import.meta.url)));
const knowledge=JSON.parse(readFileSync(new URL('../knowledge.json',import.meta.url)));
knowledge.comparacion_rondas=data;

test('14-oct pertenece a W41, con cambio de semana en domingo y fronteras de año oficiales',()=>{
  for(const [fecha,year,week] of [
    ['2026-10-10',2026,40],['2026-10-11',2026,41],['2026-10-14',2026,41],['2026-10-18',2026,42],
    ['2026-01-03',2025,53],['2026-01-04',2026,1],['2027-01-02',2026,52],['2027-01-03',2027,1],
  ]) assert.deepEqual(semanaBoletin(fecha),{year,week});
});

test('el rezago cruza años con 53 semanas sin asumir siempre 52',()=>{
  assert.equal(rezagoBoletin('2026-01-04',2025,53),1);
  assert.equal(rezagoBoletin('2026-10-14',2026,39),2);
});

test('el horizonte cuenta sólo las tres semanas posteriores al corte, no las 40 del año',()=>{
  const h=estadoHorizonte(knowledge,'2026-10-14','Depresion');
  assert.equal(h.corte,'2026-W37');assert.equal(h.semanasObservadas,3);
  assert.equal(h.periodoActual,4);assert.equal(h.pasos,52);assert.equal(h.sinSemana,1);
});

test('los casos se presentan enteros, sin alterar datos ni conservar un menos cero',()=>{
  assert.equal(formatoCasos(2972.446289),'2,972');
  assert.equal(formatoCasos(-2.553711),'-3');
  assert.equal(formatoCasos(-0.3),'0');
  assert.equal(formatoCasos(null),'—');assert.equal(formatoCasos(0),'0');
  assert.match(comparacionRondasMd(data,'Depresion'),/modelo nacional/);
  assert.ok(data.series.Depresion.semanas.find(w=>w.semana===7).anterior%1!==0);
});

test('zoom ajusta el eje a los datos y el gráfico de año conserva el origen cero',()=>{
  const range=rangoGrafico([2748,3118,3332,3136],true);
  assert.ok(range.min>0 && range.min<2748);assert.ok(range.max>3332);
  assert.ok(range.max-range.min<1000);
  assert.equal(rangoGrafico([2748,3332],false).min,0);
});

test('las leyendas son breves; motor y origen permanecen en texto y tooltips',()=>{
  const chart=graficoRondas(data,'Depresion');
  assert.deepEqual(chart.datasets.map(s=>s.label),['Observado','Ronda anterior','Actual · W37']);
  assert.equal(chart.options.plugins.legend.position,'bottom');
  assert.ok(chart.options.plugins.title.text.every(t=>t.length<=28));
  assert.equal(chart.options.plugins.tooltip.callbacks.label({dataset:chart.datasets[1],parsed:{y:2972.45}}),'Ronda anterior (deepar): 2,972');
});

globalThis.fetch=async url=>({ok:true,json:async()=>structuredClone(String(url).includes('comparacion_rondas')?data:knowledge)});
const kb=await import('../js/kb.js');await kb.loadKnowledge();

test('el propio zoom ofrece el enlace a la ronda anterior y lleva el padecimiento elegido',async()=>{
  for(const [q,pad] of [['zoom depresion','Depresion'],['zoom dengue','Dengue']]) {
    kb._resetContext?.();const r=await kb.answerWithTrace(q);
    assert.equal(r.handler,'answerZoom');assert.match(r.response,/ronda anterior nacional/);
    assert.ok(r.response.includes(`comparacion_rondas.html?pad=${pad}`));
  }
});

test('la respuesta de horizonte publica W41, W37 y 3 observadas, nunca 40 de 52',async()=>{
  const DateReal=globalThis.Date;
  globalThis.Date=class extends DateReal {
    constructor(...args){super(...(args.length?args:[2026,9,14,12]));}
  };
  try {
    kb._resetContext?.();const r=await kb.answerWithTrace('horizonte de pronostico');
    assert.equal(r.handler,'answerTemporal');
    assert.match(r.response,/semana epidemiol[oó]gica 41/);
    assert.match(r.response,/2026-W37/);
    assert.match(r.response,/datos reales dentro del horizonte: \*\*3\*\*/);
    assert.doesNotMatch(r.response,/39 de 52|semana epidemiol[oó]gica 42/);
  } finally {globalThis.Date=DateReal;}
});
