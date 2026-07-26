/**
 * test_precedencia.mjs — 47.2-B2: una regresión por CAUSA, no un parche por caso.
 *
 * Las 45 discrepancias de la matriz congelada (digest 0c23efc6…) no eran 45 defectos: eran doce
 * causas. Un handler generalista situado antes en la cadena contestaba preguntas con intención
 * explícita ajena — la ficha del padecimiento servía pronósticos, el resumen de métricas servía
 * definiciones, el histórico estatal se servía como forecast. Cada test de aquí fija UNA causa,
 * verificando el handler REAL (no sólo que la respuesta parezca razonable) y, donde el contrato lo
 * exige, el contenido.
 *
 * Uso: node --test tests/test_precedencia.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';

const kraw = readFileSync(new URL('../knowledge.json', import.meta.url), 'utf-8');
globalThis.fetch = async () => ({ ok: true, json: async () => JSON.parse(kraw) });
Math.random = () => 0.42;
const { answerWithTrace, loadKnowledge, _resetContext } = await import('../js/kb.js');
await loadKnowledge();

async function traza(query, setup = null) {
  _resetContext();
  if (setup) await answerWithTrace(setup);
  return answerWithTrace(query);
}

/** Afirma el handler REAL de cada consulta. */
async function ruta(pares) {
  for (const [query, esperado, setup] of pares) {
    const { response, handler } = await traza(query, setup);
    assert.equal(handler, esperado, `${JSON.stringify(query)} → ${handler} (esperado ${esperado})`);
    assert.ok(response, `${JSON.stringify(query)} debe responder algo`);
  }
}

test('C1 · la ficha del padecimiento no secuestra un pronóstico explícito', async () => {
  await ruta([
    ['pronostico de depresion', 'answerPronostico'],
    ['forecast de alzheimer', 'answerPronostico'],
    ['cuantos casos de parkinson se esperan', 'answerPronostico'],
    ['cuantos casos habra de depresion', 'answerPronostico'],
    ['prediccion de parkinson 2026', 'answerPronostico'],
  ]);
  // Sin intención de futuro, la ficha general SIGUE siendo suya: la cesión no puede ser total.
  await ruta([['resumen de depresion', 'answerPadecimiento'], ['parkinson', 'answerPadecimiento']]);
});

test('C2 · "cuantos modelos tiene X" es un conteo, no la ficha', async () => {
  const { response, handler } = await traza('cuantos modelos tiene parkinson');
  assert.equal(handler, 'answerConteo');
  assert.match(response, /111/, 'debe dar el número de modelos del padecimiento');
});

test('C3 · las preguntas de sexo respetan padecimiento y sexo heredado', async () => {
  const brecha = await traza('brecha de genero en depresion');
  assert.equal(brecha.handler, 'answerSexo');
  assert.match(brecha.response, /Depresion/, 'conserva el padecimiento preguntado');
  assert.match(brecha.response, /hombres/);
  assert.match(brecha.response, /mujeres/);
  assert.ok(!/enero/i.test(brecha.response), 'sin mes espurio (R56-P0)');
  assert.ok(!/Alzheimer|Parkinson/.test(brecha.response), 'sin tabla global ajena a la consulta');

  const followUp = await traza('y en hombres', 'resumen de depresion');
  assert.equal(followUp.handler, 'answerSexo');
  assert.match(followUp.response, /Depresion/, 'el follow-up hereda el padecimiento');
  assert.match(followUp.response, /hombres/, 'el follow-up conserva el sexo pedido');

  const otro = await traza('y para mujeres', 'alzheimer general');
  assert.equal(otro.handler, 'answerSexo');
  assert.match(otro.response, /Alzheimer/);
  assert.match(otro.response, /mujeres/);
});

test('C4 · la composición demográfica la responde answerDemografica, filtrada', async () => {
  await ruta([
    ['composicion demografica de depresion', 'answerDemografica'],
    ['composicion demografica por sexo', 'answerDemografica'],
    ['desglose demografico de parkinson', 'answerDemografica'],
    ['composicion por sexo y padecimiento', 'answerDemografica'],
  ]);
  const uno = await traza('desglose demografico de parkinson');
  assert.match(uno.response, /Parkinson/);
  assert.ok(!/Depresion|Alzheimer/.test(uno.response), 'con padecimiento nombrado no vuelca los tres');
  // "composicion por sexo" a secas sigue siendo la aritmética de los 333 modelos.
  await ruta([['composicion por sexo', 'answerProyectoMeta']]);
});

test('C5 · "la última semana" pide el último boletín, no la cobertura temporal', async () => {
  await ruta([
    ['datos de la ultima semana', 'answerSemanaActual'],
    ['ultimo dato disponible', 'answerSemanaActual'],
    ['que reporto la ultima semana', 'answerSemanaActual'],
  ]);
  // La cobertura temporal sigue siendo de answerTemporal.
  await ruta([['hasta cuando hay datos', 'answerTemporal'], ['cobertura temporal', 'answerTemporal']]);
});

test('C6 · con un padecimiento nombrado no se devuelve la matriz global', async () => {
  const { response, handler } = await traza('rendimiento de los modelos de parkinson');
  assert.equal(handler, 'answerPadecimiento');
  assert.match(response, /Parkinson/);
  await ruta([['matriz de rendimiento', 'answerMatrizRendimiento']]);
});

test('C7 · "que es <métrica>" es una definición, no un volcado de métricas', async () => {
  await ruta([
    ['que significa smape', 'answerDefinicion'],
    ['que es mase', 'answerDefinicion'],
    ['que es rmse', 'answerDefinicion'],
    ['que es el smape', 'answerDefinicion'],
    ['que significa overfitting', 'answerDefinicion'],
    ['que es leakage', 'answerDefinicion'],
  ]);
  // 'que es' sin término del glosario NO se lo lleva answerDefinicion.
  const pad = await traza('que es la depresion');
  assert.notEqual(pad.handler, 'answerDefinicion');
  // El resumen global de métricas sigue existiendo.
  await ruta([['metricas globales', 'answerMetricaGlobal']]);
});

test('C8 · ranking de precisión ≠ resumen de métricas ≠ ranking de entidades', async () => {
  await ruta([
    ['modelos con mejor smape', 'answerRanking'],
    ['modelos con peor rendimiento', 'answerRanking'],
    ['ranking mejores', 'answerRanking', 'metricas del parkinson'],
  ]);
  // El ranking de ENTIDADES (mayor/menor incidencia) se queda en el boletín.
  await ruta([
    ['ranking de depresion', 'answerBoletin'],
    ['estados con mayor incidencia de alzheimer', 'answerBoletin'],
  ]);
});

test('C9 · "que motor tiene mejor smape" compara motores; "modelos con..." no', async () => {
  const motor = await traza('que motor tiene mejor smape');
  assert.equal(motor.handler, 'answerMotor');
  assert.match(motor.response, /SMAPE/);
  // El discriminante es motor(es) vs modelo(s): esta sigue siendo un ranking de series.
  assert.equal((await traza('modelos con mejor smape')).handler, 'answerRanking');
});

test('C10 · la tendencia se pregunta también en participio', async () => {
  const { response, handler } = await traza('la depresion ha crecido o disminuido');
  assert.equal(handler, 'answerBoletin');
  assert.match(response, /Depresion/);
  assert.match(response, /crecimiento|descenso/, 'debe decir si crece o baja, no dar el pronóstico');
});

test('C11 · el histórico estatal es histórico, no el pronóstico del estado', async () => {
  await ruta([
    ['tendencia de depresion en jalisco', 'answerBoletin'],
    ['historico de parkinson en cdmx', 'answerBoletin'],
    ['como ha sido la depresion en oaxaca', 'answerBoletin'],
    ['evolucion del parkinson en guerrero', 'answerBoletin'],
    ['depresion en tabasco los ultimos 3 anos', 'answerBoletin'],
    ['historico de alzheimer en tamaulipas', 'answerBoletin'],
  ]);

  const conSerie = await traza('tendencia de depresion en jalisco');
  assert.match(conSerie.response, /Jalisco/);
  assert.ok(!/pr[oó]ximas 52 semanas/i.test(conSerie.response), 'no puede responder el forecast');
  assert.match(conSerie.response, /- 20\d\d: /, 'debe listar años del boletín');

  // Estado sin serie anual cargada: se DECLARA la limitación y se da el nacional, nunca silencio.
  const sinSerie = await traza('como ha sido la depresion en oaxaca');
  assert.match(sinSerie.response, /Oaxaca/);
  assert.match(sinSerie.response, /No tengo la serie anual/);
  assert.match(sinSerie.response, /nacional/i);

  // Sin vocabulario histórico explícito, "casos de X en Y" sigue siendo la serie productiva.
  assert.equal((await traza('casos de depresion en jalisco')).handler, 'answerSpecificSeries');
});
