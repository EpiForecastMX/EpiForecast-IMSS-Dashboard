/**
 * Plan canónico del EpiBot, 3.1 (26-nov-2026): reducir duplicación en kb.js sin cambiar respuestas.
 *
 * - La comparación pareada (eval/pareada.mjs, 3,726 turnos) se corre aparte: `npm run eval:pareada -- compara ref.json`.
 * - Aquí: petición compartida, fallo y reintento de las cuatro descargas (radar, resumen, vistas y zoom). Antes el radar y el
 *   resumen se pedían una sola vez al abrir y, si fallaban, ninguna consulta los volvía a pedir.
 * - Estructura: rutas fijas fuera de kb.js y una sola copia de los bloques que estaban repetidos en _resolve.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'fs';

const raiz = new URL('../../', import.meta.url);
const pedidos = [];
const fallas = { actual: 1, resumen: 1, vista: 1 };
globalThis.fetch = async (u) => {
  const s = String(u?.url ?? u);
  pedidos.push(s);
  if (/boletin\/actual\.json/.test(s) && fallas.actual-- > 0) return { ok: false, json: async () => null };
  if (/resumen_padecimientos\.json/.test(s) && fallas.resumen-- > 0) throw new Error('sin red');
  if (/publication\/varicela_b01\/vista\.json/.test(s) && fallas.vista-- > 0) return { ok: true, json: async () => ({ schema: 'otro' }) };
  const m = s.match(/(publication\/[a-z0-9_]+\/vista\.json|assets\/boletin\/[^?]+\.json)/);
  const local = s.match(/(knowledge|zoom_series|resumen_padecimientos|comparacion_rondas)\.json/);
  const rel = m ? m[1] : (local ? `epibot/${local[1]}.json` : null);
  if (!rel || !existsSync(new URL(rel, raiz))) return { ok: false, json: async () => null };
  return { ok: true, json: async () => JSON.parse(readFileSync(new URL(rel, raiz), 'utf-8')) };
};
Math.random = () => 0.42;
const kb = await import('../js/kb.js');
const { RELEASES } = await import('../js/release_config.js');
const cuenta = (re) => pedidos.filter((p) => re.test(p)).length;
const espera = () => new Promise((r) => setTimeout(r, 30));

test('radar: la petición del arranque falla, la siguiente consulta la reintenta y las concurrentes la comparten', async () => {
  await kb.loadKnowledge();
  await espera();
  assert.equal(cuenta(/boletin\/actual\.json/), 1);
  assert.ok(!kb.getData().radar_boletin, 'el fallo no deja datos');
  const [a, b] = [kb.cargaRadarDatos(), kb.cargaRadarDatos()];
  assert.equal(a, b, 'una sola petición para las dos consultas');
  await a;
  assert.equal(cuenta(/boletin\/actual\.json/), 2, 'se reintentó una vez');
  assert.ok(kb.getData().radar_boletin, 'quedó cargado');
  await kb.cargaRadarDatos();
  assert.equal(cuenta(/boletin\/actual\.json/), 2, 'ya cargado: no se vuelve a pedir');
});

test('resumen: un error de red en el arranque se reintenta con la siguiente consulta', async () => {
  assert.ok(!kb.getData().resumen_padecimientos);
  await kb.cargaResumen();
  assert.equal(cuenta(/resumen_padecimientos\.json/), 2);
  assert.ok(kb.getData().resumen_padecimientos);
});

test('vista: un esquema inválido no se guarda y la siguiente consulta la vuelve a pedir', async () => {
  const rel = RELEASES.find((r) => r.id === 'varicela_b01');
  assert.ok(rel, 'release de varicela');
  await kb.cargaVista(rel);
  assert.ok(!kb.getData()[rel.dataKey], 'esquema inválido descartado');
  const [a, b] = [kb.cargaVista(rel), kb.cargaVista(rel)];
  assert.equal(a, b);
  await a;
  assert.equal(cuenta(/publication\/varicela_b01\/vista\.json/), 2);
  assert.equal(kb.getData()[rel.dataKey]?.schema, 'publication_view.v1');
});

test('una consulta del radar responde tras el reintento (antes quedaba sin datos toda la sesión)', async () => {
  kb._resetContext();
  const r = await kb.answerWithTrace('colera en chiapas');
  assert.equal(r.handler, 'answerRadarBoletin');
  kb._resetContext();
});

test('estructura: rutas fijas fuera de kb.js y una sola copia de los bloques que se repetían en _resolve', () => {
  const src = readFileSync(new URL('../js/kb.js', import.meta.url), 'utf8');
  assert.match(src, /from '\.\/rutas_fijas\.js\?v=\d+'/);
  for (const f of ['function needsGeminiReasoning', 'function needsMedicalAdvice', 'function isOffTopic', 'function answerEquipo', 'const PROFESORES', 'function any(']) {
    assert.ok(!src.includes(f), `${f} sigue en kb.js`);
  }
  assert.equal(src.split('*(Contexto: ${ctx})*').length - 1, 1, 'un solo reintento con contexto');
  assert.equal(src.split('*(¿Quisiste decir «${corrected}»?)*').length - 1, 1, 'una sola respuesta corregida');
  assert.equal((src.match(/mencionaNoModelada\(q\) \|\| enRadar\(q\)/g) || []).length, 1, 'la mención de no modelados se calcula una vez');
  assert.ok(!/_radarPendiente|_resumenPendiente|_zoomPendiente/.test(src), 'las descargas usan la petición compartida');
});
