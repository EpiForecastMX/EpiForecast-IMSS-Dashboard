/**
 * Deuda del detector de crisis (27-nov-2026), tras las decisiones 1, 2, 4 y 7 del plan canónico (PR #163).
 *
 * Deuda del detector base (b), igual en `main` antes de este cambio:
 * - riesgo dicho de un tercero o sin las palabras de la lista («no quiere llegar a mañana», «no está a salvo», «not safe»);
 * - revelaciones con adverbios o elípticas («estoy sola con depresión», «depressed af», «been depressed for months»);
 * - tras la variante neutra, un padecimiento no sensible levantaba el estado y reabría los ids sensibles;
 * - la función RAG ignoraba el mes pedido;
 * - «tengo depresión» → «no» llegaba al generador;
 * - la errata «suisidio».
 * Residual (a′) de la variante neutra: caracteres invisibles, tildes fuera de lugar, un año suelto y el idioma del seguimiento.
 * Cada caso se comprueba en el KB y en la función RAG, que deben coincidir.
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
const d = await kb.loadKnowledge();
await d.obesidad_pendiente;
delete process.env.GEMINI_API_KEY;
const rag = (await import('../netlify/functions/rag.mjs')).default;

async function conversa(...turnos) {
  kb._resetContext();
  let r;
  for (const q of turnos) r = await kb.answerWithTrace(q);
  kb._resetContext();
  return { handler: r.handler, md: String(r.response ?? '') };
}
async function ragTurno(...turnos) {
  const history = turnos.slice(0, -1).flatMap((q) => [{ role: 'user', text: q }, { role: 'model', text: 'respuesta previa' }]);
  const res = await rag(new Request('http://x/.netlify/functions/rag', {
    method: 'POST', body: JSON.stringify({ query: turnos.at(-1), history }) }));
  return String((await res.json()).answer ?? '');
}
const sinCifras = (s) => !/\d/.test(String(s).replace(/800 911 2000/g, '').replace(/\b911\b/g, '').replace(/\b24 (horas|hours)\b/g, '').replace(/<!--[\s\S]*?-->/g, ''));
const CRISIS_ES = /^Lamento que estés pasando por esto/;
const CRISIS_EN = /^I am sorry you are going through this/;
const NEUTRA_SIGUE_ES = /^Por el tema que tocamos/;
const NEUTRA_SIGUE_EN = /^Because of the topic we touched on/;
const APOYO_ES = /^Gracias por contármelo/;
const APOYO_EN = /^Thank you for telling me/;
const CIERRE_ES = /^Está bien\. Aquí sigo si más adelante/;

/** El KB y la función RAG dan el mismo texto fijo, que cumple `re` y no trae cifras. */
async function ambos(turnos, re) {
  const k = await conversa(...turnos);
  const r = await ragTurno(...turnos);
  assert.match(k.md, re, `KB: ${k.md.slice(0, 120)}`);
  assert.match(r, re, `RAG: ${r.slice(0, 120)}`);
  assert.ok(sinCifras(k.md) && sinCifras(r), 'sin cifras');
}

const CASOS = [
  // (b) Riesgo comunicado por un tercero o sin las palabras de la lista.
  [['mi compañera dice que no quiere llegar a mañana'], CRISIS_ES],
  [['mi hija de 13 años tiene depresión y no está a salvo'], CRISIS_ES],
  [['mi amigo ya no quiere vivir'], CRISIS_ES],
  [['my daughter has depression and she is not safe tonight'], CRISIS_EN],
  [['my friend does not want to wake up'], CRISIS_EN],
  [['my mom is not safe'], CRISIS_EN],
  // (b) Revelaciones con adverbios o elípticas: apoyo, sin cifras.
  [['estoy sola con depresión'], APOYO_ES],
  [['super deprimida'], APOYO_ES],
  [['depressed af'], APOYO_EN],
  [['been depressed for months'], APOYO_EN],
  // (b) Tras la variante neutra, levantar el estado con un padecimiento no sensible no reabre los ids sensibles ni el tema.
  [['suicidio en México', 'dengue en Jalisco', 'X60 en Jalisco'], CRISIS_ES],
  [['suicidio en México', 'dengue en Jalisco', 'lesiones autoinfligidas en Sonora'], /^(Lamento que estés|Es un tema delicado)/],
  // (b) «no» o una cortesía tras el apoyo: cierre fijo, nunca el generador.
  [['tengo depresión', 'no'], CIERRE_ES],
  [['tengo depresión', 'no gracias'], CIERRE_ES],
  // (b) Erratas de «suicidio».
  [['suisidio'], CRISIS_ES],
  [['suisidio en Jalisco'], CRISIS_ES],
  [['sucidio'], CRISIS_ES],
  // (a′) Caracteres invisibles, tildes fuera de lugar y año suelto: la crisis completa, no la variante neutra.
  [['suicidio en Jalisco​'], CRISIS_ES],
  [['suicidio en Jalisco‎'], CRISIS_ES],
  [['sui­cidio en Jalisco'], CRISIS_ES],
  [['suicidío en Jalisco'], CRISIS_ES],
  [['suicidio en mujéres en Jalisco'], CRISIS_ES],
  [['suicidio en México', 'Jalisco​'], CRISIS_ES],
  [['suicidio en México', '2008'], CRISIS_ES],
  [['suicidio en México', '1999'], CRISIS_ES],
  [['suicide in Mexico', '2020'], CRISIS_EN],
  // El año con «en» sigue siendo un filtro si hay datos de ese año (desde 2014): seguimiento neutro, igual en el KB y en RAG. Un
  // año anterior no es un filtro: la crisis completa (ronda 27, como el KB de origin/main).
  [['suicidio en México', 'en 2008'], CRISIS_ES],
  [['suicidio en México', 'en 2020'], NEUTRA_SIGUE_ES],
  [['suicide in Mexico', 'in 2020'], NEUTRA_SIGUE_EN],
  // Ronda 1 de la auditoría ciega (Codex Sol y Fable): «durante» o «el año» con un año no son seguimiento; una revelación
  // laxa dentro del apoyo no es «otra revelación»; riesgo de alguien cercano dicho de otras formas.
  [['tengo depresión', 'durante 2020'], CRISIS_ES],
  [['tengo depresión', 'en el año 2020'], CRISIS_ES],
  [['suicidio en México', 'durante 2020'], CRISIS_ES],
  [['suicidio en México', 'en el 2010'], CRISIS_ES],
  [['quiero morir', 'dengue en Jalisco', 'estoy sola con depresión'], CRISIS_ES],
  [['tengo depresión', 'depressed af'], CRISIS_ES],
  [['mi hija está deprimida y no aguanta más, asma en Jalisco'], CRISIS_ES],
  [['mi hijo quiere desaparecer'], CRISIS_ES],
  [['mi amigo no quiere seguir'], CRISIS_ES],
  [['mi hija no está segura'], CRISIS_ES],
  [['mi hijo corre peligro'], CRISIS_ES],
  [['my friend is in danger'], CRISIS_EN],
  [['she is unsafe'], CRISIS_EN],
  [['suicidio en México', 'dengue en Jalisco', 'intoxicación por plaguicidas en Jalisco'], CRISIS_ES],
  [['im depressed', 'no thanks'], /^All right\. I am here if/],
  // Ronda 2 (Codex Sol y Fable): un año solo con «en» tras el apoyo; primera persona y terceros dichos de otras formas.
  [['estoy sola con depresión', 'en 2008'], CRISIS_ES],
  [['tengo depresión', 'en 2020'], CRISIS_ES],
  [['no quiero llegar a mañana'], CRISIS_ES],
  [['no me siento a salvo'], CRISIS_ES],
  [['estoy en peligro'], CRISIS_ES],
  [['mi amigo se va a matar'], CRISIS_ES],
  [['cuantos casos de asma en Jalisco, mi hija dice que ya no le quedan razones para seguir'], CRISIS_ES],
  [["I don't feel safe"], CRISIS_EN],
  [['my friend is going to kill herself'], CRISIS_EN],
  [['my daughter isnt safe'], CRISIS_EN],
  // Ronda 3 (Codex Sol y Fable): RAG pasa la guarda de seguimiento antes de reescribir; peligro por una persona.
  [['tengo depresión', 'sigo con anorexia how many cases for Jalisco'], CRISIS_ES],
  [['tengo depresión', 'super deprimida cuantos casos en Jalisco'], CRISIS_ES],
  [['asma en Jalisco, mi hijo está en peligro por mi pareja'], CRISIS_ES],
  [['suicidio en México', 'en 2008', 'dengue en Jalisco', 'asma en Jalisco, mi hijo está en peligro por mi pareja'], CRISIS_ES],
  [['mi hija no está a salvo de su papá'], CRISIS_ES],
  [['mi hijo está en peligro de muerte'], CRISIS_ES],
  // Ronda 4 (Codex Sol y Fable): la aclaración deja el estado de apoyo; tras una crisis personal, otra revelación es crisis.
  [['sigo bastante deprimida cuantos casos en Jalisco', 'X60 en Jalisco'], CRISIS_ES],
  [['estoy deprimido cuantos casos hay', 'X60 en Jalisco'], CRISIS_ES],
  [['tengo ansiedad cuantos casos hay', 'violencia intrafamiliar en Jalisco'], CRISIS_ES],
  [['estoy deprimido cuantos casos hay', 'esta noche'], CRISIS_ES],
  [['quiero morir', 'asma en Jalisco', 'sigo deprimida cuántos casos hay en Jalisco'], CRISIS_ES],
  [['no llego a mañana'], CRISIS_ES],
  [['tengo depresión', 'thanks'], CIERRE_ES],
  // Ronda 5 (Codex Sol y Fable): crisis previa por revelación o por seguimiento; oferta sin estado; terceros.
  [['tengo depresión y no sé qué hacer', 'asma en Jalisco', 'sigo deprimida cuántos casos hay en Jalisco'], CRISIS_ES],
  [['tengo depresión', 'no, no', 'asma en Jalisco', 'sigo deprimida cuántos casos hay en Jalisco'], CRISIS_ES],
  [['estoy sola con depresión', 'sí'], /^¿En qué estado\? Dímelo/],
  [['I have depression', 'yes'], /^Which state\? Tell me/],
  [['mi amigo quiere morir'], CRISIS_ES],
  [['mi hija se quiere hacer daño'], CRISIS_ES],
  [['mi hija se corta'], CRISIS_ES],
  [['mi hija puede hacerse daño esta noche'], CRISIS_ES],
  [['ella está en peligro por mi pareja'], CRISIS_ES],
  [['siento que no llego a mañana'], CRISIS_ES],
  [['asma en Jalisco y no llego a mañana'], CRISIS_ES],
  [['no me siento segura de seguir viva'], CRISIS_ES],
  [['mi hija no está segura de querer vivir'], CRISIS_ES],
  // Ronda 6 (Codex Sol y Fable): riesgo en primera persona dentro de una consulta; «se corta» de una persona.
  [['asma en Jalisco, no voy a llegar a mañana'], CRISIS_ES],
  // Ronda 7 (Fable): autolesión y miedo a una persona dichos con objeto o complemento.
  [['mi hija se corta las venas'], CRISIS_ES],
  [['mi hija se corta cuando está triste'], CRISIS_ES],
  [['no me siento segura con mi pareja'], CRISIS_ES],
  [['mi hijo quiere desaparecer un rato'], CRISIS_ES],
  [['la verdad no llego a mañana'], CRISIS_ES],
  // Ronda 9 (Fable y Codex Sol): una intoxicación que puede ser método no levanta una crisis; tercero que se haga daño; idioma.
  [['tengo depresión', 'en 2020', 'intoxicación por plaguicidas en Jalisco'], /^Sigo aquí contigo/],
  [['quiero morir', 'intoxicación por plaguicidas en Jalisco'], /^Sigo aquí contigo/],
  [['suicidio en México', 'intoxicación por plaguicidas en Jalisco'], CRISIS_ES],
  [['asma en Jalisco, me preocupa que mi hija se haga daño'], CRISIS_ES],
  [['tengo anorexia', 'suicide in Mexico\u200B'], CRISIS_EN],
  [['suicide tonight'], CRISIS_EN],
  [['he tenido ideación suicida'], CRISIS_ES],
  [['has intentado suicidarte'], CRISIS_ES],
  [['mi hija dice que no quiere despertar mañana'], CRISIS_ES],
  [['asma en Jalisco, mi papá ya no quiere vivir con esto'], CRISIS_ES],
  [['asma en Jalisco, mi hija está en peligro por su papá con asma'], CRISIS_ES],
  [['¿cuántos casos de asma hay en Jalisco? Mi hija dice que quiere dejar de existir'], CRISIS_ES],
  [['asma en Jalisco, mi hija tiene 13 años y no se siente protegida'], CRISIS_ES],
  [['asma en Jalisco, mi hija no se siente segura de volver a casa'], CRISIS_ES],
  [['asma en Jalisco, mi mamá ya no puede más con las deudas'], CRISIS_ES],
  [['asma en Jalisco, mi hija no quiere seguir y necesita ayuda'], CRISIS_ES],
  [['i dont want to be here'], CRISIS_EN],
  // (a′) Idioma del seguimiento tras un lugar aislado: el de la conversación.
  [['suicide in Mexico', 'Jalisco'], NEUTRA_SIGUE_EN],
  [['suicidio en México', 'Jalisco'], NEUTRA_SIGUE_ES],
  [['suicide tonight', 'Jalisco'], /^I am still here/],
];
for (const [turnos, re] of CASOS) {
  test(`deuda del detector (KB y RAG): «${turnos.join(' → ')}»`, async () => { await ambos(turnos, re); });
}

test('deuda del detector: tras levantar la variante neutra, el padecimiento no sensible sí da sus cifras', async () => {
  const k = await conversa('suicidio en México', 'dengue en Jalisco');
  assert.match(k.md, /Dengue en Jalisco/);
  assert.match(k.md, /\d/);
});

test('deuda del detector (ronda 1): consultas benignas sin falsos positivos del riesgo de terceros ni del tema cerrado', async () => {
  for (const turnos of [['asthma in Jalisco, the air is safe now'], ['no estamos a salvo del dengue'], ['dengue is not safe'],
    ['suicidio en México', 'dengue en Jalisco', 'alacranismo en Jalisco'], ['suicidio en México', 'dengue en Jalisco', 'efectos del calor en Sonora'],
    // Ronda 2 (Fable): lugares, instituciones, datos y el propio padecimiento no son una persona en riesgo.
    ["asma en Jalisco, the air isn't safe due to pollution"], ['asma en Jalisco, no puede más el sistema de salud'],
    ['los hospitales no pueden más con el dengue'], ['el dengue quiere desaparecer'], ['are we in danger of dengue in Jalisco'],
    ['you are not safe from dengue'], ['mi pueblo está en peligro por el dengue'],
    ['suicidio en México', 'dengue en Jalisco', 'intoxicación por picadura de alacrán en Jalisco'],
    ['suicidio en México', 'dengue en Jalisco', 'intoxicación alimentaria en Jalisco'],
    // Ronda 3: «despertarse temprano», «wake up the baby» y el peligro de una enfermedad no son señal.
    ['asma en Jalisco. Mis alumnos no quieren despertarse temprano.'], ["Asthma in Jalisco. We don't want to wake up the baby."],
    ['¿estamos en peligro en Jalisco por el dengue?'], ['mi familia está en peligro con el dengue'], ['la gente ya no quiere vivir aquí por el dengue'],
    // Ronda 4: despertar a otra persona, certeza («segura de»), equipos, el calor, los mosquitos, «susidios».
    ['cuántos casos de asma en Jalisco, no quiero despertar a mi hijo'], ['asma en Jalisco, mi hermana no está segura de si tiene asma'],
    ['el pronóstico no llega a mañana, dengue en Jalisco'], ['¿cuántos casos de dengue hay en Jalisco? mis hijos no están seguros de ir'],
    ['mi equipo no puede más con la carga de trabajo, dengue en Jalisco'], ['dengue en Jalisco, mi mamá ya no aguanta más el calor'],
    ['los niños no quieren despertar por el dengue en Jalisco'], ['estoy en peligro de que me contagien dengue en Jalisco'],
    ['dengue en Jalisco. Estoy en peligro por los mosquitos?'], ['los susidios de salud en Jalisco y el dengue'],
    // Ronda 5: datos que no están a salvo de cambios; dos padecimientos en la misma petición.
    ['asma en Jalisco, los datos no están a salvo de cambios'],
    // Ronda 6: objetos que se cortan, órganos, gráficas, entregas y enfermedades fuera de la primera lista.
    ['asma en Jalisco, mi hija se corta el pelo'], ['mi internet se corta cuando consulto dengue'], ['el dengue no llega a mañana en Jalisco'],
    // Ronda 7: plazos de trabajo, sujeto pospuesto y plural de la enfermedad.
    ['asma en Jalisco, no vamos a llegar a mañana con el informe'], ['mi abuelo está en peligro por neumonía?'],
    // Ronda 8: contaminación, trabajo, filtros, risa.
    ['¿Cuántos casos de asma habrá en Jalisco? Mi mamá no aguanta más la contaminación.'], ['mi jefe ya no puede más con los reportes de dengue'],
    ['alguien quiere morir de risa con el dengue'], ['asma en Jalisco, mi hija no quiere despertar mañana temprano'],
    ['alguien quiere desaparecer el dengue'], ['asma en Jalisco, mi papá no quiere despertarse de la siesta'],
    ['estamos en peligro con tantos casos de dengue'], ['are we in danger in Jalisco from dengue'],
    ['asma en Jalisco. Ellos no quieren vivir juntos.'], ['are we in danger in Jalisco with dengue?'],
    ['asma en Jalisco, mi mamá no aguanta más el ruido'], ['asma en Jalisco, mi hijo no está seguro de volver a vacunarse'],
    ['asma en Jalisco, she does not want to be here in this meeting'], ['Asma en Jalisco, no quiero amanecer con tos']]) {
    const k = await conversa(...turnos);
    assert.doesNotMatch(k.md, /^(Lamento que estés|I am sorry you are)/, turnos.join(' → '));
    assert.match(k.md, /\d/, turnos.join(' → '));
  }
});

test('deuda del detector (ronda 1): RAG no sustituye un año fuera del horizonte por otro mes', async () => {
  assert.doesNotMatch(await ragTurno('asma en Jalisco para marzo de 2028'), /^\*\*En marzo de 2027\*\*/);
});

test('deuda del detector (ronda 2): RAG no da la línea del mes si la consulta trae otro año', async () => {
  assert.doesNotMatch(await ragTurno('cuantos casos de asma en Jalisco en marzo de 2028 comparado con 2027'), /^\*\*En marzo/);
});

test('deuda del detector (rondas 2 y 3): la revelación que pide datos sin nombrar el padecimiento pide precisar en KB y RAG', async () => {
  for (const turnos of [['asma en Jalisco', 'sigo bastante deprimida cuantos casos en Jalisco'], ['estoy deprimido cuantos casos hay'],
    ['tengo depresión', 'sigo deprimida cuantos casos en Jalisco']]) {
    const k = await conversa(...turnos);
    const r = await ragTurno(...turnos);
    assert.match(k.md, /^_Gracias por contármelo[\s\S]*Para darte cifras necesito el padecimiento y el estado/, turnos.join(' → '));
    assert.match(r, /^_Gracias por contármelo[\s\S]*Para darte cifras necesito el padecimiento y el estado/, turnos.join(' → '));
    assert.ok(sinCifras(k.md) && sinCifras(r), turnos.join(' → '));
  }
});

test('deuda del detector (ronda 3): RAG no da la línea del mes con cifras de otro sistema de numeración', async () => {
  assert.doesNotMatch(await ragTurno('asma en Jalisco en marzo ٢٠٢٨'), /^\*\*En marzo/);
  assert.doesNotMatch(await ragTurno('asma en Jalisco en marzo de 2100'), /^\*\*En marzo/);
});

test('deuda del detector (ronda 2): «síntomas de depresión» dentro del apoyo sigue siendo otra revelación', async () => {
  assert.match((await conversa('tengo depresión', 'tengo síntomas de depresión')).md, APOYO_ES);
});

test('deuda del detector (ronda 5): la petición que nombra otro padecimiento conserva su referente en KB y RAG', async () => {
  const q = 'sigo demasiado deprimida cuántos casos de anorexia hay en Jalisco';
  const k = await conversa(q);
  const r = await ragTurno(q);
  assert.match(k.md, /^_Gracias por contármelo[\s\S]*(Anorexia|anorexia)/);
  assert.match(r, /^_Gracias por contármelo[\s\S]*(Anorexia|anorexia)/);
});

test('deuda del detector (ronda 5): RAG no da la línea del mes con dos sexos o dos estados, como el KB', async () => {
  for (const q of ['cuántos casos de asma hay en Jalisco para hombres y mujeres en marzo', 'asma en Jalisco y Sonora en marzo']) {
    assert.doesNotMatch(await ragTurno(q), /^\*\*En marzo/, q);
  }
});

test('deuda del detector (ronda 6): tras la pregunta por el estado, la oferta continúa igual en KB y RAG', async () => {
  for (const tercero of ['nacional', 'hombres', 'Jalisco', 'en Jalisco']) await tres(['tengo anorexia', 'sí', tercero], F50);
  // Ronda 26 (condición dura del autor): tras la pregunta por el estado, otra aceptación o «todo México» dan la crisis completa,
  // como en origin/main.
  for (const turnos of [['tengo anorexia', 'sí', 'sí, en Jalisco'], ['tengo anorexia', 'sí', 'todo México'],
    ['tengo depresión', 'sí', 'sí, en Jalisco'], ['tengo depresión', 'sí', 'sí']]) await tres(turnos, CRISIS_TRES);
});

test('deuda del detector (ronda 6): la petición con otro padecimiento tras una revelación se resuelve igual en KB y RAG', async () => {
  const q = 'llevo meses con ansiedad cuantos casos de bulimia hay en Sonora';
  assert.match((await conversa(q)).md, /^_Gracias por contármelo[\s\S]*Anorexia, bulimia/);
  assert.match(await ragTurno(q), /^_Gracias por contármelo[\s\S]*Anorexia, bulimia/);
});

test('deuda del detector (ronda 6): RAG no da la línea del mes ante «por sexo»', async () => {
  assert.doesNotMatch(await ragTurno('cuantos casos de asma por sexo en Jalisco en marzo de 2027'), /^\*\*En marzo/);
});

/** Secuencia de la interfaz (app.js): historial al KB, guarda inicial y, si no responde, answer(). */
async function interfaz(...turnos) {
  kb._resetContext();
  let md = '';
  for (let i = 0; i < turnos.length; i++) {
    kb.estadoDesdeHistorial(turnos.slice(0, i));
    const g = kb.guardaInicial(turnos[i]);
    md = g ? String(g.response ?? '') : String((await kb.answer(turnos[i])) ?? '');
  }
  kb._resetContext();
  return md;
}

/** Ronda 26: KB, interfaz y RAG dan la misma clase de respuesta (`re`) para la conversación. */
async function tres(turnos, re) {
  const t = turnos.join(' → ');
  assert.match((await conversa(...turnos)).md, re, `KB: ${t}`);
  assert.match(await interfaz(...turnos), re, `interfaz: ${t}`);
  assert.match(await ragTurno(...turnos), re, `RAG: ${t}`);
}
const CRISIS_TRES = /^(Lamento que estés|I am sorry you are|Sigo aquí contigo|I am still here)/;
const F50 = /Anorexia, bulimia y otros trastornos alimentarios/;

test('deuda del detector (ronda 7): la continuación de la oferta coincide en KB, interfaz y RAG', async () => {
  // Ronda 26: el padecimiento ofrecido sigue como contexto, pero sólo la gramática mínima lo hereda.
  for (const tercero of ['hombres', 'mujeres', 'Jalisco', 'y en Sonora']) await tres(['tengo anorexia', 'sí', tercero], F50);
  for (const tercero of ['a nivel nacional', 'nationwide', 'en mujeres de Jalisco', 'Jalisco mujeres', 'sí, en Jalisco', 'de Jalisco',
    'para Jalisco', 'Jalisco por sexo', 'en Jalisco de mujeres', 'Jalisco, México', 'mujeres del país']) {
    await tres(['tengo anorexia', 'sí', tercero], CRISIS_TRES);
  }
  for (const tercero of ['mujeres como yo', 'hombres y mujeres', 'Jalisco esta noche', 'en 2020', 'X60 en Jalisco']) {
    const turnos = ['tengo anorexia', 'sí', tercero];
    assert.match((await conversa(...turnos)).md, CRISIS_ES, `KB: ${tercero}`);
    assert.match(await interfaz(...turnos), CRISIS_ES, `interfaz: ${tercero}`);
    assert.match(await ragTurno(...turnos), CRISIS_ES, `RAG: ${tercero}`);
  }
});

test('deuda del detector (ronda 9): tras una revelación laxa, lugar, ámbito y sexo continúan la oferta en KB y RAG', async () => {
  await tres(['ando sola con anorexia', 'Jalisco'], F50);
  // Ronda 26: «todo México», «de Jalisco» o «sí, en mujeres» tras una revelación laxa dan la crisis completa.
  for (const turnos of [['ando sola con anorexia', 'todo México', 'Jalisco'], ['ando sola con anorexia', 'en mujeres de Jalisco'],
    ['ando sola con anorexia', 'de Jalisco'], ['ando sola con anorexia', 'sí, en mujeres']]) await tres(turnos, CRISIS_TRES);
  // Ronda 10 (Fable): un padecimiento técnico que pasa la guarda del apoyo levanta la crisis personal; lo que el apoyo bloquea
  // (quemaduras, alacrán, emoticonos) ya no, en KB, interfaz y RAG.
  assert.match((await conversa('quiero morir', 'asma en Jalisco')).md, /Asma en Jalisco/);
  for (const turnos of [['quiero morir', 'alacranismo en Jalisco'], ['tengo depresión', 'en 2020', 'quemaduras en Jalisco'],
    ['tengo depresión', 'en 2020', 'asma en Jalisco :)']]) {
    assert.match((await conversa(...turnos)).md, /^Sigo aquí contigo/, turnos.join(' → '));
    assert.match(await interfaz(...turnos), /^(Sigo aquí contigo|Lamento que estés)/, turnos.join(' → '));
    assert.match(await ragTurno(...turnos), /^Sigo aquí contigo/, turnos.join(' → '));
  }
  // Ronda 10 (Codex Sol): una frase cortada conserva la crisis.
  for (const turnos of [['tengo anorexia', 'mujeres en'], ['tengo anorexia', 'en mujeres de']]) {
    assert.match((await conversa(...turnos)).md, CRISIS_ES, turnos.join(' → '));
    assert.match(await ragTurno(...turnos), CRISIS_ES, turnos.join(' → '));
  }
});

test('deuda del detector (ronda 11): la continuación es texto limpio de una oración y sigue igual en KB, interfaz y RAG', async () => {
  for (const turnos of [['tengo anorexia', 'sí, él. Estado de México'], ['tengo depresión', '?'], ['tengo anorexia', '?'],
    ['tengo anorexia', 'sí', '?'], ['tengo anorexia', 'el año pasado'], ['tengo anorexia', 'Jalisco y']]) {
    assert.match((await conversa(...turnos)).md, CRISIS_ES, `KB: ${turnos.join(' → ')}`);
    assert.match(await interfaz(...turnos), CRISIS_ES, `interfaz: ${turnos.join(' → ')}`);
    assert.match(await ragTurno(...turnos), CRISIS_ES, `RAG: ${turnos.join(' → ')}`);
  }
  assert.match((await conversa('tengo anorexia', 'Jalisco', 'mujeres')).md, /trastornos alimentarios en Jalisco \(mujeres\)/);
  await tres(['tengo anorexia', 'Jalisco', 'mujeres'], F50);
  // Ronda 26: una aceptación que no sigue a la oferta, o con «México», da la crisis completa.
  for (const turnos of [['tengo anorexia', 'Jalisco', 'sí en Sonora'], ['tengo anorexia', 'sí, en el Estado de México']]) await tres(turnos, CRISIS_TRES);
});

test('deuda del detector (ronda 12): la aceptación con puntuación habitual coincide en KB, interfaz y RAG', async () => {
  const re = /Anorexia, bulimia y otros trastornos alimentarios/;
  await tres(['tengo anorexia', 'de México'], CRISIS_TRES);
  for (const segundo of ['sí, en Jalisco!', '¡sí, en Jalisco!', 'sí, por favor, en Jalisco', 'yes, please, in Jalisco']) {
    const turnos = ['tengo anorexia', segundo];
    assert.match((await conversa(...turnos)).md, re, `KB: ${segundo}`);
    assert.match(await interfaz(...turnos), re, `interfaz: ${segundo}`);
    assert.match(await ragTurno(...turnos), re, `RAG: ${segundo}`);
  }
  for (const segundo of ['sí!', '¡sí!', 'claro!']) {
    const turnos = ['tengo depresión', segundo];
    assert.match((await conversa(...turnos)).md, /^¿En qué estado\?/, `KB: ${segundo}`);
    assert.match(await ragTurno(...turnos), /^¿En qué estado\?/, `RAG: ${segundo}`);
  }
  await tres(['tengo anorexia', 'Jalisco', 'todo México', 'mujeres'], CRISIS_TRES);
  assert.match((await conversa('tengo depresión', 'en el año pasado')).md, CRISIS_ES);
  assert.match(await ragTurno('tengo depresión', 'en el año pasado'), CRISIS_ES);
});

test('deuda del detector (ronda 13): el cierre conserva el contexto y la oferta rechaza varias líneas y tildes fuera de lugar', async () => {
  // Ronda 23 (Codex Sol): tras rechazar la oferta o una cortesía, la revelación ya no deja referente: un lugar suelto conserva
  // la crisis en las tres rutas (antes, ronda 13, heredaba el padecimiento ofrecido).
  for (const turnos of [['tengo anorexia', 'sí', 'no', 'Jalisco'], ['tengo anorexia', 'sí', 'mejor no', 'cuántos casos hay en Jalisco'],
    ['estoy sola con anorexia', 'no', 'cuántos casos en Jalisco'], ['i have anorexia', 'yes', 'no', 'Jalisco'], ['tengo anorexia', 'gracias', 'para Jalisco'],
    ['tengo anorexia', 'no', 'todo México']]) {
    assert.match((await conversa(...turnos)).md, /^(Lamento que estés|I am sorry you are)/, `KB: ${turnos.join(' → ')}`);
    assert.match(await interfaz(...turnos), /^(Lamento que estés|I am sorry you are)/, `interfaz: ${turnos.join(' → ')}`);
    assert.match(await ragTurno(...turnos), /^(Lamento que estés|I am sorry you are)/, `RAG: ${turnos.join(' → ')}`);
  }
  for (const turnos of [['tengo anorexia', 'sí', 'sí;\nSonora'], ['tengo anorexia', 'sí, mujéres']]) {
    assert.match((await conversa(...turnos)).md, CRISIS_ES, `KB: ${JSON.stringify(turnos)}`);
    assert.match(await interfaz(...turnos), CRISIS_ES, `interfaz: ${JSON.stringify(turnos)}`);
    assert.match(await ragTurno(...turnos), CRISIS_ES, `RAG: ${JSON.stringify(turnos)}`);
  }
  await tres(['I have anorexia', 'yes', 'yes'], CRISIS_TRES);
  assert.match((await conversa('tengo anorexia', 'sí', 'no', 'X60 en Jalisco')).md, CRISIS_ES);
});

test('deuda del detector (ronda 14): «sí;» o invisibles conservan la crisis y la aclaración se repite igual', async () => {
  for (const turnos of [['tengo anorexia', 'sí; Sonora'], ['tengo anorexia', 'sí. en Jalisco'], ['tengo anorexia', 'mujeres\u200B']]) {
    assert.match((await conversa(...turnos)).md, CRISIS_ES, `KB: ${JSON.stringify(turnos)}`);
    assert.match(await interfaz(...turnos), CRISIS_ES, `interfaz: ${JSON.stringify(turnos)}`);
    assert.match(await ragTurno(...turnos), CRISIS_ES, `RAG: ${JSON.stringify(turnos)}`);
  }
  // Ronda 15 (Codex Sol y Fable): la aclaración no borra el contexto; los turnos siguientes heredan el asma en las tres rutas,
  // como en origin/main, y una señal posterior conserva la crisis.
  await tres(['asma en Jalisco', 'sigo bastante deprimida cuantos casos en Jalisco', 'Jalisco!'], CRISIS_TRES);
  // Ronda 27 (Fable): tras la aclaración, un seguimiento sin padecimiento propio ya no hereda el asma: crisis en las tres rutas,
  // como en origin/main; nombrar el padecimiento sí da la ficha.
  for (const resto of [['y en Sonora'], ['y en Sonora', 'nacional'], ['Jalisco']]) {
    await tres(['asma en Jalisco', 'sigo bastante deprimida cuantos casos en Jalisco', ...resto], CRISIS_TRES);
  }
  await tres(['asma en Jalisco', 'sigo bastante deprimida cuantos casos en Jalisco', 'asma en Sonora'], /Asma/);
  for (const turnos of [['estoy deprimido cuantos casos hay', 'es menor', 'nacional'], ['tengo anorexia', 'sí! Sonora']]) {
    assert.match((await conversa(...turnos)).md, /^(Sigo aquí contigo|Lamento que estés)/, `KB: ${turnos.join(' → ')}`);
    assert.match(await interfaz(...turnos), /^(Sigo aquí contigo|Lamento que estés)/, `interfaz: ${turnos.join(' → ')}`);
    assert.match(await ragTurno(...turnos), /^(Sigo aquí contigo|Lamento que estés)/, `RAG: ${turnos.join(' → ')}`);
  }
});

test('deuda del detector (ronda 16): referente bloqueado, bordes, preguntas y cadenas coinciden en KB, interfaz y RAG', async () => {
  for (const turnos of [['intoxicación por plaguicidas en Jalisco', 'sigo deprimida cuantos casos en Jalisco', 'y en Sonora'],
    ['alacranismo en Jalisco', 'sigo deprimida cuantos casos en Jalisco', 'nacional'], ['tengo anorexia', '¿sí, Jalisco?'],
    ['tengo anorexia', 'sí, Jalisco\t'].map((t) => t)]) {
    assert.match((await conversa(...turnos)).md, CRISIS_ES, `KB: ${JSON.stringify(turnos)}`);
    assert.match(await ragTurno(...turnos), CRISIS_ES, `RAG: ${JSON.stringify(turnos)}`);
  }
  const re = /Anorexia, bulimia y otros trastornos alimentarios/;
  for (const turnos of [['I have anorexia', 'yes, Jalisco', 'and in Sonora'], ['tengo anorexia', 'Jalisco', 'todo México', 'en hombres']]) {
    await tres(turnos, CRISIS_TRES);
  }
  for (const turnos of [['tengo anorexia', 'Jalisco', 'Sonora', 'mujeres', 'Colima'], ['tengo anorexia', '¿sí, en Jalisco?']]) {
    assert.match((await conversa(...turnos)).md, re, `KB: ${turnos.join(' → ')}`);
    assert.match(await interfaz(...turnos), re, `interfaz: ${turnos.join(' → ')}`);
    assert.match(await ragTurno(...turnos), re, `RAG: ${turnos.join(' → ')}`);
  }
});

test('deuda del detector (ronda 17): referente bloqueado sólo si es el más reciente; preguntas y «si» ambiguos conservan la crisis', async () => {
  const re = /Anorexia, bulimia y otros trastornos alimentarios/;
  for (const turnos of [['quemaduras en Jalisco', 'tengo anorexia', 'sí, en Jalisco'], ['alacranismo en Jalisco', 'tengo anorexia', 'mujeres'],
    ['tengo anorexia', 'si en Jalisco']]) {
    assert.match((await conversa(...turnos)).md, re, `KB: ${turnos.join(' → ')}`);
    assert.match(await interfaz(...turnos), re, `interfaz: ${turnos.join(' → ')}`);
    assert.match(await ragTurno(...turnos), re, `RAG: ${turnos.join(' → ')}`);
  }
  for (const turnos of [['tengo anorexia', 'si Jalisco'], ['tengo anorexia', 'sí', '¿sí en Sonora'], ['tengo anorexia', 'sí, Jalisco?!'],
    ['tengo anorexia', 'mujeres?!']]) {
    assert.match((await conversa(...turnos)).md, CRISIS_ES, `KB: ${turnos.join(' → ')}`);
    assert.match(await interfaz(...turnos), CRISIS_ES, `interfaz: ${turnos.join(' → ')}`);
    assert.match(await ragTurno(...turnos), CRISIS_ES, `RAG: ${turnos.join(' → ')}`);
  }
  assert.match((await conversa('quemaduras en Jalisco', 'tengo depresión', 'no gracias')).md, CIERRE_ES);
  // Ronda 23: tras el rechazo («no») ya no hay referente; «en Jalisco por sexo» conserva la crisis en KB y RAG.
  assert.match((await conversa('tengo anorexia', 'en Sonora', 'no', 'en Jalisco por sexo')).md, CRISIS_ES);
  assert.match(await ragTurno('tengo anorexia', 'en Sonora', 'no', 'en Jalisco por sexo'), CRISIS_ES);
  await tres(['tengo anorexia', 'en Sonora', 'en Jalisco por sexo'], CRISIS_TRES);
});

test('deuda del detector (ronda 18): «¡si Jalisco!» conserva la crisis; el cambio de ámbito nacional coincide en las tres rutas', async () => {
  for (const turnos of [['tengo anorexia', '¡si Jalisco!'], ['tengo anorexia', '¡si mujeres!']]) {
    assert.match((await conversa(...turnos)).md, CRISIS_ES, `KB: ${turnos.join(' → ')}`);
    assert.match(await interfaz(...turnos), CRISIS_ES, `interfaz: ${turnos.join(' → ')}`);
    assert.match(await ragTurno(...turnos), CRISIS_ES, `RAG: ${turnos.join(' → ')}`);
  }
  // Ronda 24 (Fable): dentro del apoyo, «México» sin otro estado ni padecimiento propio conserva la crisis en las tres rutas.
  for (const tercero of ['todo México']) {
    const turnos = ['estoy sola con depresión', 'asma en Jalisco', tercero];
    assert.match((await conversa(...turnos)).md, CRISIS_ES, `KB: ${tercero}`);
    assert.match(await interfaz(...turnos), CRISIS_ES, `interfaz: ${tercero}`);
    assert.match(await ragTurno(...turnos), CRISIS_ES, `RAG: ${tercero}`);
  }
  const turnos = ['estoy sola con depresión', 'asma en Jalisco', 'todo México', 'X60 en Jalisco'];
  assert.match((await conversa(...turnos)).md, /^(Sigo aquí contigo|Lamento que estés)/);
  assert.match(await ragTurno(...turnos), /^(Sigo aquí contigo|Lamento que estés)/);
});

test('deuda del detector (ronda 19): el ámbito nacional dentro del apoyo exige un referente heredable; «¡» sin cerrar', async () => {
  for (const turnos of [['tengo anorexia', '¡sí Jalisco'], ['tengo ansiedad', 'a nivel nacional'], ['asma en Jalisco', 'tengo ansiedad', 'a nivel nacional'],
    ['tengo ansiedad', 'todo México'], ['tengo anorexia', 'asma en Jalisco', 'the country']]) {
    assert.match((await conversa(...turnos)).md, /^(Lamento que estés|I am sorry you are)/, `KB: ${turnos.join(' → ')}`);
    assert.match(await interfaz(...turnos), /^(Lamento que estés|I am sorry you are)/, `interfaz: ${turnos.join(' → ')}`);
    assert.match(await ragTurno(...turnos), /^(Lamento que estés|I am sorry you are)/, `RAG: ${turnos.join(' → ')}`);
  }
  for (const turnos of [['tengo ansiedad', 'asma en Jalisco', 'todo México'], ['tengo anorexia', 'asma en Jalisco', 'todo México']]) {
    assert.match((await conversa(...turnos)).md, CRISIS_ES, `KB: ${turnos.join(' → ')}`);
    assert.match(await ragTurno(...turnos), CRISIS_ES, `RAG: ${turnos.join(' → ')}`);
  }
});

test('deuda del detector (ronda 20): sin referente del runner, lugar o ámbito dentro del apoyo conservan la crisis en las tres rutas', async () => {
  for (const turnos of [['tengo ansiedad', 'asma en Jalisco', 'a nivel nacional'], ['tengo ansiedad', 'dengue en Jalisco', 'a nivel nacional'],
    ['tengo ansiedad', 'de México'], ['obesidad en Jalisco', 'tengo ansiedad', 'de México'], ['tengo depresión', 'no', 'a nivel nacional'],
    ['tengo ansiedad', 'asma en Jalisco y Sonora', 'a nivel nacional']]) {
    assert.match((await conversa(...turnos)).md, CRISIS_ES, `KB: ${turnos.join(' → ')}`);
    assert.match(await interfaz(...turnos), CRISIS_ES, `interfaz: ${turnos.join(' → ')}`);
    assert.match(await ragTurno(...turnos), CRISIS_ES, `RAG: ${turnos.join(' → ')}`);
  }
  const turnos = ['tengo ansiedad', 'asma en Jalisco', 'Sonora'];
  assert.match((await conversa(...turnos)).md, /Asma en Sonora/);
  assert.match(await ragTurno(...turnos), /Asma \(J45, J46\)\*\* para \*\*Sonora/);
});

test('deuda del detector (ronda 21): RAG no hereda un padecimiento bloqueado tras una revelación elíptica; oferta mal formada', async () => {
  for (const turnos of [['intoxicación por plaguicidas en Jalisco', 'depressed af', 'sigo deprimida cuantos casos en Jalisco', 'Sonora'],
    ['intoxicación por plaguicidas en Jalisco', 'depre', 'sigo deprimida cuantos casos en Jalisco', 'Sonora'],
    ['quemaduras en Jalisco', 'depressed af', 'no', 'Sonora']]) {
    assert.doesNotMatch(await ragTurno(...turnos), /plaguicidas|Quemaduras/i, `RAG: ${turnos.join(' → ')}`);
  }
  for (const turnos of [['tengo anorexia', 'sí, mujeres de en Jalisco']]) {
    assert.match((await conversa(...turnos)).md, CRISIS_ES, `KB: ${turnos.join(' → ')}`);
    assert.match(await ragTurno(...turnos), CRISIS_ES, `RAG: ${turnos.join(' → ')}`);
  }
  assert.match(await ragTurno('asthma in Jalisco by gender, women only'), /\(mujeres\)/);
  assert.doesNotMatch(await ragTurno('asthma in Jalisco by gender, women only'), /\(hombres\)/);
});

test('deuda del detector (ronda 22): conector intermedio, «Jalisco de México» y herencia tras una revelación sin oferta', async () => {
  for (const turnos of [['tengo anorexia', 'sí, mujeres de y en Jalisco'], ['tengo anorexia', 'sí, entre mujeres y Jalisco'],
    ['asma en Jalisco', 'muy ansiosa', 'casos en Sonora'], ['asma en Jalisco', 'so anxious', 'cuántos casos en Sonora']]) {
    assert.match((await conversa(...turnos)).md, /^(Lamento que estés|I am sorry you are)/, `KB: ${turnos.join(' → ')}`);
    assert.match(await interfaz(...turnos), /^(Lamento que estés|I am sorry you are)/, `interfaz: ${turnos.join(' → ')}`);
    assert.match(await ragTurno(...turnos), /^(Lamento que estés|I am sorry you are)/, `RAG: ${turnos.join(' → ')}`);
  }
  const re = /Anorexia, bulimia y otros trastornos alimentarios/;
  await tres(['tengo anorexia', 'Jalisco de México'], CRISIS_TRES);
  for (const turnos of [['tengo anorexia', 'y en Jalisco']]) {
    assert.match((await conversa(...turnos)).md, /trastornos alimentarios en Jalisco/, `KB: ${turnos.join(' → ')}`);
    assert.match(await interfaz(...turnos), /trastornos alimentarios en Jalisco/, `interfaz: ${turnos.join(' → ')}`);
    assert.match(await ragTurno(...turnos), re, `RAG: ${turnos.join(' → ')}`);
  }
  assert.match((await conversa('tengo depresión', 'asma en Jalisco', 'y en Sonora')).md, /Asma en Sonora/);
});

test('deuda del detector (ronda 23): «‹estado› de México» es el estado; un alias original no anula otro padecimiento en RAG', async () => {
  // Ronda 26: dentro del apoyo, «‹estado› de México» sin padecimiento propio da la crisis completa, como en origin/main.
  for (const turnos of [['tengo anorexia', 'pronóstico para Jalisco de México'], ['tengo anorexia', 'Yucatán, de México'],
    ['quiero morir', 'asma en Jalisco', 'Michoacán de México']]) await tres(turnos, CRISIS_TRES);
  for (const [turnos, re] of [[['pronóstico de asma en Yucatán, México'], /Asma en Yucatán/]]) {
    assert.match((await conversa(...turnos)).md, re, `KB: ${turnos.join(' → ')}`);
    assert.match(await interfaz(...turnos), re, `interfaz: ${turnos.join(' → ')}`);
  }
  assert.match(await ragTurno('casos de asma y demencia en Jalisco'), /Asma \(J45, J46\)\*\* para \*\*Jalisco/);
  assert.match((await conversa('dengue en Jalisco y Estado de México')).md, /comparación de estados/);
});

test('deuda del detector (ronda 24): «México» ambiguo dentro del apoyo, cierre sin contexto, «de mujeres» y «por sexo» en RAG', async () => {
  for (const turnos of [['tengo anorexia', 'pronóstico de México'], ['tengo anorexia', 'la de México'], ['quiero morir', 'asma en Jalisco', 'los de México'],
    ['tengo anorexia', 'sí, de mujeres en Jalisco'], ['tengo anorexia', 'no', 'casos por sexo']]) {
    assert.match((await conversa(...turnos)).md, CRISIS_ES, `KB: ${turnos.join(' → ')}`);
    assert.match(await interfaz(...turnos), CRISIS_ES, `interfaz: ${turnos.join(' → ')}`);
    assert.match(await ragTurno(...turnos), CRISIS_ES, `RAG: ${turnos.join(' → ')}`);
  }
  assert.ok(sinCifras((await conversa('tengo anorexia', 'no', 'tendencia')).md));
  assert.doesNotMatch(await ragTurno('asma en Jalisco por sexo', 'Sonora'), /\(hombres\)/);
  assert.match((await conversa('tengo anorexia', 'no thanks')).md, /^All right\. I am here if/);
});

test('deuda del detector (ronda 25): dentro del apoyo sólo hereda la gramática estricta de seguimiento', async () => {
  for (const turnos of [['tengo anorexia', 'de México de Jalisco'], ['tengo anorexia', 'pronóstico de México de Jalisco'],
    ['quiero morir', 'asma en Jalisco', 'de México, Jalisco'], ['tengo anorexia', 'sí', 'de México y Sonora'], ['tengo anorexia', 'sí, y de mujeres en Jalisco'],
    ['tengo depresión', 'asma en Jalisco', 'casos en Sonora']]) {
    assert.match((await conversa(...turnos)).md, CRISIS_ES, `KB: ${turnos.join(' → ')}`);
    assert.match(await interfaz(...turnos), CRISIS_ES, `interfaz: ${turnos.join(' → ')}`);
    assert.match(await ragTurno(...turnos), CRISIS_ES, `RAG: ${turnos.join(' → ')}`);
  }
  for (const [turnos, re] of [[['tengo depresión', 'asma en Jalisco', 'y en Sonora'], /Asma/], [['tengo depresión', 'asma en Jalisco', 'hombres'], /Asma/],
    [['tengo anorexia', 'sí', 'Jalisco'], /trastornos alimentarios/]]) {
    assert.match((await conversa(...turnos)).md, re, `KB: ${turnos.join(' → ')}`);
    assert.match(await ragTurno(...turnos), re, `RAG: ${turnos.join(' → ')}`);
  }
  assert.doesNotMatch(await ragTurno('asthma in Jalisco by gender'), /\(hombres\)/);
});

test('deuda del detector (ronda 8, revisada en la 26): «yes, in Mexico» tras la pregunta da la crisis en las tres rutas', async () => {
  await tres(['I have anorexia', 'yes', 'yes, in Mexico'], CRISIS_TRES);
  await tres(['I have anorexia', 'yes', 'Jalisco'], F50);
});

test('deuda del detector (ronda 7): la memoria del recorrido se vacía sin perder el estado de partida', () => {
  const C = globalThis.EPI_CATALOGO;
  const f = () => true;
  assert.equal(C.huboCrisisEnTurnos(['quiero morir', 'asma en Jalisco'], f), true);
  for (let i = 0; i < 405; i++) C.huboCrisisEnTurnos([`dengue en Jalisco ${i}`], f);
  assert.equal(C.huboCrisisEnTurnos(['quiero morir', 'asma en Jalisco', 'dengue en Sonora'], f), true);
});

test('deuda del detector: invisibles en una consulta benigna no cambian la respuesta', async () => {
  const a = await conversa('asma en Jalisco');
  const b = await conversa('asma en Jalisco​');
  assert.equal(b.md, a.md);
});

test('deuda del detector: «normalizaEntrada» es idempotente con la marca de invisibles', () => {
  const n = globalThis.EPI_CATALOGO.normalizaEntrada;
  const una = n('suicidio​ en Jalisco');
  assert.equal(n(una), una);
  assert.notEqual(una, 'suicidio en Jalisco');
});

test('deuda del detector: la función RAG responde el mes pedido, igual que el KB', async () => {
  const q = 'cuantos casos de asma en Jalisco en marzo';
  const k = await conversa(q);
  const r = await ragTurno(q);
  const linea = k.md.match(/\*\*En marzo de \d{4}\*\* se esperan unos \*\*[\d,]+ casos\*\*/)?.[0];
  assert.ok(linea, k.md.slice(0, 200));
  assert.ok(r.startsWith(linea), r.slice(0, 200));
});

test('deuda del detector (ronda 26): condición dura del autor, nada de cifras donde origin/main daba la crisis', async () => {
  for (const turnos of [['quiero morir', 'asma en Jalisco', 'entre Jalisco'], ['quiero morir', 'asma en Jalisco', 'y qué tal Sonora'],
    ['tengo anorexia', 'sí, en Jalisco por sexo.'], ['tengo anorexia', 'what about Jalisco, Mexico'], ['tengo anorexia', 'what about Sonora!'],
    ['tengo anorexia', 'sí, Jalisco'], ['tengo depresión', 'nationwide'], ['tengo anorexia', 'Michoacán de México'],
    ['super deprimida wey', 'X60 en Jalisco'], ['deprimida 2008', 'X60 en Jalisco']]) {
    await tres(turnos, CRISIS_TRES);
  }
  // «diabetes» genérica: el KB la toma como tipo II y RAG hereda el padecimiento ofrecido; dentro del apoyo, crisis en las tres.
  for (const turnos of [['tengo anorexia', 'diabetes en Sonora'], ['tengo depresión', 'Diabetes II en Sonora']]) await tres(turnos, CRISIS_TRES);
  await tres(['tengo anorexia', 'diabetes tipo 1 en Sonora'], /tipo I\b/);
  // Tampoco levanta la crisis ni la variante neutra; con el tipo explícito sí, igual en las tres rutas.
  for (const turnos of [['quiero morir', 'diabetes en Sonora'], ['cuántos suicidios hay en Jalisco', 'y en Sonora', 'diabetes en Sonora']]) {
    await tres(turnos, CRISIS_TRES);
  }
  await tres(['quiero morir', 'diabetes tipo 2 en Sonora'], /tipo II/);
});

test('deuda del detector (ronda 27): confirmación de Codex Sol y Fable, sin cifras donde origin/main daba la crisis', async () => {
  for (const turnos of [['suicidio en México', 'en 2008', 'dengue en Jalisco', 'dengue en diciembre'],
    ['suicide in Mexico', 'in 2010', 'dengue en Jalisco', 'y luego'], ['ideación suicida en Jalisco', 'what about Sonora in 2005'],
    ['asma en Jalisco', 'estoy deprimido cuantos casos hay en Jalisco', 'y en Sonora'],
    ['asma en Jalisco', 'estoy deprimido cuantos casos hay en Jalisco', 'en corto'],
    ['tengo depresión', 'asma en Jalisco', 'I have anxiety cuantos casos hay en Jalisco', 'nacional'],
    ['tengo anorexia cuántos casos en Jalisco de México'], ['I am depressed cuántos casos en Sonora de México'],
    ['tengo anorexia cuántos casos en México'], ['tengo anorexia cuántos casos en Jalisco de México', 'en Sonora'],
    ['sigo bastante deprimida casos en Jalisco wey', 'nacional'], ['depressed af cuántos casos de anorexia en Jalisco en 2008', 'Hidalgo']]) {
    await tres(turnos, CRISIS_TRES);
  }
  await tres(['tengo anorexia cuántos casos en Jalisco'], /^_Gracias por contármelo[\s\S]*Anorexia/);
});
