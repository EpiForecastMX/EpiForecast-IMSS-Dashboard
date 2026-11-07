/**
 * Seguimiento tras una respuesta de padecimiento NO modelado.
 *
 * Regresión (5-nov-2026, hallada al evaluar el skill de padecimientos): «asma en jalisco
 * mujeres» → «y hombres?» heredaba Jalisco y hombres sin padecimiento y respondía answerEstado con
 * la tabla neuro del estado (Depresión, Alzheimer, Parkinson), con su gráfica.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import vm from 'node:vm';

const K = readFileSync(new URL('../knowledge.json', import.meta.url), 'utf-8');
const V = readFileSync(new URL('../../publication/obesidad/vista.json', import.meta.url), 'utf-8');
globalThis.fetch = async (u) => ({
  ok: true,
  json: async () => JSON.parse(String(u).includes('publication/obesidad/vista.json') ? V : K),
});
const kb = await import('../js/kb.js');
const { detectEntities } = await import('../js/entities.js?v=34');
const oc = await import('../js/obesidad_charts.js?v=3');
const rc = await import('../js/release_config.js?v=1');
const d = await kb.loadKnowledge();
await d.obesidad_pendiente;

const app = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const between = (a, b) => app.slice(app.indexOf(a), app.indexOf(b, app.indexOf(a)));
const extract = vm.runInNewContext(`(${between('function extractChartData(', '\nfunction ')})`, {
  getData: () => d, detectEntities, releaseConAlias: rc.releaseConAlias, graficaObesidad: oc.graficaObesidad, ...rc,
  graficoRondas: () => null, console,
});

async function conversa(...qs) {
  kb._resetContext();
  let r;
  for (const q of qs) r = await kb.answerWithTrace(q);
  kb._resetContext();
  return { handler: r.handler, md: String(r.response ?? ''), q: qs[qs.length - 1] };
}

const NEURO_TABLA = /casos totales|Se pronostican/;

test('«y hombres?» tras «asma en jalisco mujeres» sigue diciendo que no se modela', async () => {
  const r = await conversa('asma en jalisco mujeres', 'y hombres?');
  assert.equal(r.handler, 'answerPadecimientoNoModelado');
  assert.match(r.md, /no modela asma/);
  assert.doesNotMatch(r.md, NEURO_TABLA);
});

test('el seguimiento no dibuja la gráfica neuro del estado', async () => {
  const r = await conversa('asma en jalisco mujeres', 'y hombres?');
  assert.equal(extract(r.md, r.q), null);
});

test('«y en sonora?» tras asma tampoco cae en la tabla neuro de Sonora', async () => {
  const r = await conversa('casos de asma en jalisco', 'y en sonora?');
  assert.match(r.md, /no modela asma/);
  assert.doesNotMatch(r.md, NEURO_TABLA);
});

test('nombrar un padecimiento modelado en el seguimiento sí lo responde, con el estado heredado', async () => {
  const dep = await conversa('asma en jalisco', 'y depresion?');
  assert.match(dep.md, /Depresi[oó]n en Jalisco/);
  const obe = await conversa('asma en jalisco', 'y obesidad?');
  assert.equal(obe.handler, 'answerObesidad');
  assert.match(obe.md, /Obesidad \(E66\) · Jalisco/);
});

test('el recuerdo del no modelado se borra con la siguiente respuesta modelada', async () => {
  const r = await conversa('asma en jalisco', 'casos de depresion en sonora', 'y hombres?');
  assert.doesNotMatch(r.md, /no modela/);
  assert.match(r.md, /Sonora/);
});

test('la respuesta de no modelado no dibuja gráfica ni en la primera consulta', async () => {
  const r = await conversa('asma en jalisco mujeres');
  assert.match(r.md, /<!--SIN_GRAFICA-->/);
  assert.equal(extract(r.md, r.q), null);
});

test('app.js retira el marcador SIN_GRAFICA antes de mostrar el texto', () => {
  assert.match(app, /replace\(\/<!--SIN_GRAFICA-->\/g, ''\)/);
});
