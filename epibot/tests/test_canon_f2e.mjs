/**
 * Plan canónico del EpiBot, fase 2, entrega E (26-nov-2026): 2.4 largo y jerarquía de la parte llana (a la vista, la
 * respuesta, tres viñetas como máximo, la confiabilidad breve y un solo pie; el resto, plegado) y 2.6 seguimientos y
 * aclaraciones deterministas (elegir una opción conserva estado y sexo, «¿y X?» suma un estado a la comparación, botones
 * para el periodo cuando la pregunta no lo dice).
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
const pide = async (q) => { kb._resetContext?.(); const r = await kb.answerWithTrace(q); return String(r.response || ''); };
const resumen = JSON.parse(readFileSync(new URL('epibot/resumen_padecimientos.json', raiz), 'utf-8'));
const { semanaTxt, semanaDeEtiqueta, rangoSemana } = await import('../js/resumen_llano.js');
const llano = (t) => t.split('<!--DETALLE-->')[0].replace(/<!--[\s\S]*?-->/g, '');
const { comprobadoTxt, PIE_LLANO } = await import('../js/resumen_llano.js');
const palabras = (t) => t.replace(/[*_#|>-]/g, ' ').split(/\s+/).filter((w) => /\w/.test(w)).length;
const vinetas = (t) => (t.match(/^\s*[-*] /gm) || []).length;

// Las 36 preguntas de la mesa del plan canónico (planes/mesa_epibot_canon_2026-11-26/).
const PANEL = ["¿hay mucho dengue en Veracruz?","¿qué enfermedades van al alza?","como anda lo del mosquito en yucatan","¿sube la diabetes en Nuevo León?","varicela en Jalisco mujeres","¿qué es la escabiosis?","¿cómo se contagia la varicela?","tengo fiebre y dolor de cabeza, ¿es dengue?","¿es seguro viajar a Cancún por el dengue?","cuantos casos de influenza hay en cdmx","me quiero morir","ideación suicida en Jalisco","¿y en Monterrey?","lo de la presion alta en monterrey","¿qué tan confiable es el pronóstico de asma?","compara dengue Veracruz vs Yucatán","mapa de diabetes tipo 2","¿en qué meses hay más casos de varicela?","¿cuál es el sMAPE de hipertensión fuera de muestra?","¿cuántos casos de depresión hubo en la semana 43 de 2026?","¿cuántos casos de asma se pronostican en 52 semanas?","acumulado de obesidad en 2026","ranking de estados para hepatitis A","¿la varicela está validada?","metodología de selección de motores","leptospirosis por sexo en Veracruz","resumen nacional de la semana","¿qué estados tendrán más casos de dengue el próximo mes?","¿dónde sube más rápido la hepatitis A?","enfermedad febril exantemática","covid en el país","¿cuál es el pico esperado de influenza?","q onda con la azucar en puebla","oye y el chikungunya?","dame un grafico de asma","¿quién ganó el partido?"];

test('2.4 la parte llana: mediana ≤ 120 palabras y p90 ≤ 160 en las preguntas de la mesa', async () => {
  const n = [];
  for (const q of PANEL) n.push(palabras(llano(await pide(q))));
  n.sort((a, b) => a - b);
  const q = (x) => n[Math.min(n.length - 1, Math.floor(x * n.length))];
  assert.ok(q(0.5) <= 120, `mediana ${q(0.5)}: ${n}`);
  assert.ok(q(0.9) <= 160, `p90 ${q(0.9)}: ${n}`);
});

test('2.4 una serie: tres viñetas como máximo, confiabilidad breve, un solo pie; el pico y las aclaraciones, plegados', async () => {
  for (const q of ['¿hay mucho dengue en Veracruz?', 'varicela en Jalisco mujeres', 'asma en Jalisco', 'parkinson en Jalisco']) {
    const t = await pide(q);
    const [l, detalle] = t.split('<!--DETALLE-->');
    assert.ok(vinetas(llano(l)) <= 3, q);
    assert.equal(llano(l).split(PIE_LLANO).length, 2, `${q}: un solo pie`);
    assert.doesNotMatch(l, /Pico esperado|suma de las semanas|cifra única|se eligió por su error|no todos los enfermos/, q);
    assert.match(detalle, /suma de las semanas de la serie publicada/, q);
    assert.match(l, /\*\*Confiabilidad: (alta|media|baja)( aquí)?\.\*\*/, q);
  }
  // El control nunca se presenta como validado, también en la versión breve.
  assert.match(llano(await pide('varicela en Jalisco mujeres')), /\*\*Confiabilidad: baja\.\*\* No es un modelo validado/);
  // Los originales: cómo se eligió el motor va en la ficha.
  assert.match((await pide('¿hay mucho dengue en Veracruz?')).split('<!--DETALLE-->')[1], /elegido por su error con datos que no vio/);
});

test('2.4 un desvío de más de 300 % se dice en casos, sin porcentaje', () => {
  assert.equal(comprobadoTxt({ semanas: 2, pronostico_total: 68, observado_total: 2, sesgo_pct: 3300 }, 'En las 2 semanas ya comprobadas'),
    'En las 2 semanas ya comprobadas esperaba 68 casos y llegaron 2.');
  assert.equal(comprobadoTxt({ semanas: 2, pronostico_total: 120, observado_total: 100, sesgo_pct: 20 }, 'En las 2 semanas ya comprobadas'),
    'En las 2 semanas ya comprobadas esperaba 120 casos y llegaron 100 (se pasó 20 %).');
});

test('2.4 radar: la cifra antes del motivo; el motivo medido completo va plegado', async () => {
  const t = await pide('cuantos casos de influenza hay en cdmx');
  const [l, detalle] = t.split('<!--DETALLE-->');
  assert.ok(l.indexOf('Casos de la semana') < l.indexOf('no modela'), 'la cifra va primero');
  assert.ok(l.indexOf('**Ciudad de México**') < l.indexOf('**Nacional**'), 'la entidad pedida va antes que el total nacional');
  assert.doesNotMatch(l, /Motivo medido/);
  assert.match(detalle, /Motivo medido/);
});

test('2.4 rankings: tres por bloque, la confiabilidad media sin marca y el método plegado', async () => {
  const t = await pide('¿qué enfermedades van al alza?');
  const [l, detalle] = t.split('<!--DETALLE-->');
  assert.ok(vinetas(llano(l)) <= 8);
  assert.doesNotMatch(l, /confiabilidad media/);
  assert.match(l, /sin marca, la confiabilidad es media/);
  assert.match(detalle, /Comparo \d+ padecimientos/);
  const m = JSON.parse(t.match(/<!--ALZA:(.*?)-->/)[1]);
  assert.equal(m.filas.length, (llano(l).match(/^- /gm) || []).length, 'la gráfica lleva las mismas filas que el texto');
});

// Una conversación de varios turnos, sin reiniciar el contexto entre ellos.
const charla = async (...qs) => { kb._resetContext?.(); const out = []; for (const q of qs) { const r = await kb.answerWithTrace(q); out.push({ h: r.handler, t: String(r.response || '') }); } return out; };
const sigue = (t) => JSON.parse((t.match(/<!--SIGUE:(.*?)-->/) || [])[1] || '[]');

test('2.6 tras una aclaración, «la A», «la segunda» u «otras» eligen la opción y conservan estado y sexo', async () => {
  const [a, b] = await charla('hepatitis en Jalisco mujeres', 'la c');
  assert.equal(a.h, 'answerAliasAmbiguo');
  assert.deepEqual(sigue(a.t).map((x) => x.q), ['hepatitis vírica a en Jalisco', 'hepatitis vírica b aguda en Jalisco', 'hepatitis vírica c en Jalisco', 'otras hepatitis víricas en Jalisco']);
  assert.match(llano(b.t), /^\*\*Hepatitis vírica C en Jalisco \(mujeres\):\*\*/);
  assert.match(llano((await charla('hepatitis en Sonora', 'la segunda'))[1].t), /^\*\*Hepatitis vírica B[^*]* en Sonora:\*\*/);
  assert.match(llano((await charla('hepatitis', 'otras'))[1].t), /^\*\*Otras hepatitis víricas en el país:\*\*/);
  assert.match(llano((await charla('amebiasis', 'la intestinal'))[1].t), /^\*\*Amebiasis intestinal en el país:\*\*/);
  // «¿y la B?» tras hepatitis A en Jalisco: los botones y la respuesta siguen en Jalisco.
  const [, c, d] = await charla('hepatitis A en Jalisco', '¿y la B?', 'aguda');
  assert.ok(sigue(c.t).every((x) => / en Jalisco$/.test(x.q)), c.t);
  assert.match(llano(d.t), /^\*\*Hepatitis vírica B[^*]* en Jalisco:\*\*/);
  // Lo que no es una opción no se resuelve a ciegas: sin padecimiento se vuelve a pedir que precise.
  const [, e] = await charla('hepatitis en Sonora', '¿y en Sonora?');
  assert.equal(e.h, 'answerAclaracionPendiente');
});

test('2.6 «¿y X?» tras comparar estados suma X a la comparación, con el mismo padecimiento y sexo', async () => {
  const [, b] = await charla('varicela en Jalisco y Sonora mujeres', '¿y Chiapas?');
  const m = JSON.parse(b.t.match(/<!--VARICELA_B01:(.*?)-->/)[1]);
  assert.equal(m.tipo, 'comparador');
  assert.deepEqual(m.estados, ['Jalisco', 'Sonora', 'Chiapas']);
  assert.match(llano(b.t), /comparación de estados, mujeres/);
  const [, d] = await charla('compara dengue Veracruz vs Yucatán', '¿y Tabasco?');
  const e = JSON.parse(d.t.match(/<!--ESTADOS:(.*?)-->/)[1]);
  assert.deepEqual(e.filas.map((f) => f[0]).sort(), ['Tabasco', 'Veracruz', 'Yucatán']);
  // Una consulta de un solo estado no deja comparación pendiente.
  const [, , f] = await charla('compara asma en Jalisco y Sonora', 'asma en Sonora', '¿y Chiapas?');
  assert.match(llano(f.t), /^\*\*Asma en Chiapas:\*\*/);
});

test('2.6 «¿cuántos casos habrá?» sin periodo ofrece las 52 semanas y el mes siguiente; con periodo, no', async () => {
  for (const q of ['¿cuántos casos de asma habrá?', '¿cuántos casos de dengue habrá en Veracruz?']) {
    const [x] = await charla(q);
    const b = sigue(x.t);
    assert.equal(b[0].t, 'En las 52 semanas', q);
    assert.match(b[0].q, /se pronostican en 52 semanas$/, q);
    assert.match(b[1].t, /^En (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)$/, q);
  }
  const [y] = await charla('cuantos casos de asma en Jalisco en diciembre de 2026');
  assert.ok(!sigue(y.t).some((x) => x.t === 'En las 52 semanas'));
  // El botón del mes da una respuesta del mes.
  const [z] = await charla(sigue((await charla('¿cuántos casos de asma habrá?'))[0].t)[1].q);
  assert.match(llano(z.t), /\*\*En diciembre de 2026\*\* se esperan unos \*\*[\d,]+ casos\*\*/);
});

test('la ficha «Hablando de» escribe el estado con su nombre («Ciudad de México», «Nuevo León»)', async () => {
  await charla('cuantos casos de influenza hay en cdmx');
  assert.equal(kb.contextoActual().estado, 'Ciudad de México');
  await charla('asma en Nuevo Leon');
  assert.equal(kb.contextoActual().estado, 'Nuevo León');
});
