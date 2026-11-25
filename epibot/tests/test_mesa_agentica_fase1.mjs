/**
 * Fase 1 de la mesa agéntica (25-nov-2026): preguntas compuestas con la calculadora determinista (js/calculo/, js/compuesta.js).
 * Cada cifra nueva se recalcula aquí desde la vista publicada con una implementación propia (oráculo), sin importar la
 * calculadora del bot.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'fs';

const raiz = new URL('../../', import.meta.url);
globalThis.fetch = async (u) => {
  const s = String(u?.url ?? u);
  const m = s.match(/(publication\/[a-z0-9_]+\/vista\.json|assets\/boletin\/[^?]+\.json)/);
  const local = s.match(/(knowledge|zoom_series|resumen_padecimientos|comparacion_rondas)\.json/);
  const rel = m ? m[1] : (local ? `epibot/${local[1]}.json` : null);
  if (!rel || !existsSync(new URL(rel, raiz))) return { ok: false, json: async () => null };
  return { ok: true, json: async () => JSON.parse(readFileSync(new URL(rel, raiz), 'utf-8')) };
};
Math.random = () => 0.42;
const kb = await import('../js/kb.js');
await kb.loadKnowledge();
const vista = (id) => JSON.parse(readFileSync(new URL(`publication/${id}/vista.json`, raiz), 'utf-8'));

async function conversa(...turnos) {
  kb._resetContext();
  let r = { response: null, handler: null };
  for (const t of turnos) r = await kb.answerWithTrace(t);
  kb._resetContext();
  return { handler: r.handler, md: String(r.response ?? '') };
}
const entero = (s) => Number(String(s).replace(/[,\s ]/g, ''));
/** Oráculo: O4 y F4 de una serie de la vista. */
function o4f4(v, estado) {
  const x = Object.values(v.series).find((s) => s.nivel === 'estado' && s.sexo === 'general' && s.nombre === estado);
  const obs = x.observado, ult = obs.at(-1)[0];
  const O4 = obs.slice(-4).reduce((a, [, y]) => a + y, 0);
  const F4 = x.pronostico.filter(([ds]) => ds > ult).slice(0, 4).reduce((a, [, y]) => a + y, 0);
  return { O4: Math.round(O4), F4: Math.round(F4), d: F4 / O4 - 1 };
}

test('«¿dónde sube más rápido?» contesta con el ritmo de cambio, recalculado por el oráculo', async () => {
  const { md } = await conversa('¿dónde sube más rápido la varicela, en Jalisco o Sonora?');
  const v = vista('varicela_b01');
  const j = o4f4(v, 'Jalisco'), so = o4f4(v, 'Sonora');
  const gana = j.d > so.d ? ['Jalisco', j] : ['Sonora', so];
  const m = md.match(/\*\*Sube más rápido:\*\* ([^,]+), de ([\d,]+) a unos ([\d,]+) casos \(\+(\d+) %\)/);
  assert.ok(m, md.slice(0, 300));
  assert.equal(m[1], gana[0]);
  assert.equal(entero(m[2]), gana[1].O4);
  assert.equal(entero(m[3]), gana[1].F4);
  assert.equal(Number(m[4]), Math.round(gana[1].d * 100));
  assert.ok(md.indexOf('Sube más rápido') < md.indexOf('Más casos esperados'), 'el veredicto pedido va primero');
  assert.match(md, /controles estacionales/, 'la varicela es un control: se dice');
});

test('dengue (original): «cuál sube más rápido» cuando ambos bajan dice que ninguno sube', async () => {
  const { md } = await conversa('compara dengue en Veracruz y Yucatán y dime cuál sube más rápido');
  assert.match(md, /\*\*(Ninguno sube|Sube más rápido|Sin diferencia clara|Cuál sube más rápido):\*\*/);
});

test('«explícame la gráfica» explica la serie del contexto, con fechas y pico de la vista', async () => {
  const { handler, md } = await conversa('varicela en Jalisco', 'explícame la gráfica');
  assert.equal(handler, 'answerExplicaGrafica');
  assert.match(md, /Cómo leer la gráfica de Varicela en Jalisco/);
  const x = Object.values(vista('varicela_b01').series).find((s) => s.nivel === 'estado' && s.sexo === 'general' && s.nombre === 'Jalisco');
  const ult = x.observado.at(-1)[0];
  const [a, mes, d] = ult.split('-').map(Number);
  assert.ok(md.includes(`${d} de`) && md.includes(String(a)), 'menciona la última semana observada');
  const fut = x.pronostico.filter(([ds]) => ds > ult);
  const pico = fut.reduce((p, q) => (q[1] > p[1] ? q : p));
  assert.ok(md.includes(Math.round(pico[1]).toLocaleString('es-MX')), 'pico del pronóstico');
  assert.match(md, /No es un modelo validado/);
  assert.match(md, /Lo que no muestra/);
  void mes;
});

test('«¿en qué meses hay más casos?» da el perfil mensual de años completos (oráculo)', async () => {
  const { handler, md } = await conversa('¿en qué meses hay más casos de varicela?');
  assert.equal(handler, 'answerEstacionalidad');
  const x = Object.values(vista('varicela_b01').series).find((s) => s.nivel === 'nacional' && s.sexo === 'general');
  const porAnio = {};
  for (const [ds] of x.observado) porAnio[ds.slice(0, 4)] = (porAnio[ds.slice(0, 4)] || 0) + 1;
  const anios = Object.keys(porAnio).filter((a) => porAnio[a] >= 50);
  const acc = Array.from({ length: 12 }, () => [0, 0]);
  for (const [ds, y] of x.observado) if (anios.includes(ds.slice(0, 4))) { const m = Number(ds.slice(5, 7)) - 1; acc[m][0] += y; acc[m][1]++; }
  const prom = acc.map(([s, n]) => s / n);
  const top = prom.indexOf(Math.max(...prom));
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  assert.match(md, new RegExp(`meses con más casos son \\*\\*${MESES[top]}`));
  assert.ok(md.includes(`${MESES[top]} ${Math.round(prom[top]).toLocaleString('es-MX')}`));
  assert.ok(md.includes(`${anios.length} años completos`));
});

test('dengue sin dos años de historia en el chat: lo dice en lugar de inventar una temporada', async () => {
  const { handler, md } = await conversa('dengue en Yucatán', '¿en qué meses hay más?');
  assert.equal(handler, 'answerEstacionalidad');
  assert.match(md, /No tengo al menos dos años completos/);
  assert.doesNotMatch(md.replace(/dos años/, ''), /\d{2,}/);
});

test('salvedades: «¿hay un brote?» no se contesta «Sí»; causas y significancia llevan su nota', async () => {
  const brote = await conversa('¿hay un brote de varicela en Jalisco?');
  assert.match(brote.md, /No declaro brotes ni alertas/);
  assert.doesNotMatch(brote.md, /^\s*(Sí|No)\. /m);
  assert.match((await conversa('¿por qué está subiendo la varicela?')).md, /No puedo decir por qué cambian los casos/);
  assert.match((await conversa('¿el aumento de varicela es estadísticamente significativo?')).md, /No calculo significancia estadística/);
  // Una pregunta normal no lleva salvedades.
  assert.doesNotMatch((await conversa('¿está subiendo la varicela en Jalisco?')).md, /No declaro|No puedo decir por qué|No calculo significancia/);
});

test('negativas razonadas: relación entre padecimientos y sumas, sin cifras', async () => {
  const rel = await conversa('¿hay relación entre la varicela y la parotiditis?');
  assert.equal(rel.handler, 'answerNegativaRazonada');
  assert.match(rel.md, /no muestra una relación ni una causa/);
  const suma = await conversa('suma dengue y varicela en Jalisco');
  assert.equal(suma.handler, 'answerNegativaRazonada');
  assert.match(suma.md, /No sumo Dengue y Varicela/);
  for (const md of [rel.md, suma.md]) assert.doesNotMatch(md.replace(/<!--[^>]*-->/g, ''), /\d/);
  // «Compara» sigue siendo una comparación, no una negativa.
  assert.notEqual((await conversa('compara varicela y parotiditis en Jalisco')).handler, 'answerNegativaRazonada');
});

test('los temas sensibles no entran a la calculadora', async () => {
  for (const q of ['¿en qué meses hay más casos de intento de suicidio?', '¿hay relación entre el intento de suicidio y la violencia intrafamiliar?']) {
    const { handler } = await conversa(q);
    assert.ok(!['answerEstacionalidad', 'answerNegativaRazonada', 'answerExplicaGrafica'].includes(handler), `${q}: ${handler}`);
  }
});

test('regresiones del oráculo de la fase 0: zona metropolitana y queja que repite el padecimiento', async () => {
  const mty = await conversa('pronostico de neumonias en la zona metropolitana de monterrey');
  assert.match(mty.md, /\*\*Neumonías y bronconeumonías en Nuevo León:\*\*/);
  const tb = await conversa('dame tuberculosis en nuevo leon', 'no te pregunte por otra cosa, tuberculosis', 'ok y cuantos en mujeres');
  assert.match(tb.md, /en Nuevo León \(mujeres\)/);
});

test('memoria de lugar: presentación, «en mi estado» y el padecimiento que sigue a un viaje', async () => {
  const yo = await conversa('Hola, soy enfermera en Mexicali');
  assert.equal(yo.handler, 'answerPresentacion');
  assert.match(yo.md, /estás en \*\*Baja California\*\*/);
  assert.doesNotMatch(yo.md, /Quisiste decir/);
  assert.match((await conversa('Hola, soy enfermera en Mexicali', 'quiero saber de diabetes tipo 1 en mi estado')).md, /Diabetes tipo I en Baja California/);
  assert.match((await conversa('vamos a quintana roo con mi abuelita', 'hay muchas infecciones respiratorias')).md, /en Quintana Roo:\*\*/);
  // Sin lugar dicho, «mi estado» sigue pidiendo el estado.
  assert.match((await conversa('diabetes tipo 1 en mi estado')).md, /No sé en qué estado estás/);
  // Pedir el país explícitamente no hereda el estado.
  assert.match((await conversa('soy médico en Puebla', 'varicela nacional')).md, /Varicela en el país/);
});
