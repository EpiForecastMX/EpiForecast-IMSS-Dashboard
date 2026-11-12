/**
 * Consultas de riesgo personal y de categorías clínicas vecinas. Cada caso nació de una respuesta
 * real equivocada: «tengo ganas de morir» devolvía la tabla de motores y «depresion alta en sonora»
 * activaba Hipertensión porque contiene «presion alta».
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';

const K = readFileSync(new URL('../knowledge.json', import.meta.url), 'utf-8');
// Cada release lee su propia vista: sin ella, su respuesta sería «se está cargando» y sin marcador.
const vista = (u) => String(u).match(/publication\/([a-z0-9_]+)\/vista\.json/);
globalThis.fetch = async (u) => ({
  ok: true,
  json: async () => JSON.parse(vista(u)
    ? readFileSync(new URL(`../../publication/${vista(u)[1]}/vista.json`, import.meta.url), 'utf-8') : K),
});
const kb = await import('../js/kb.js');
const { detectEntities } = await import('../js/entities.js?v=40');
const { mencionaNoModelada, nombraAlias, respuestaCrisis, releaseConAlias } = await import('../js/release_config.js?v=6');
const d = await kb.loadKnowledge();
await d.obesidad_pendiente;

async function pregunta(q, previa) {
  kb._resetContext();
  if (previa) await kb.answerWithTrace(previa);
  const r = await kb.answerWithTrace(q);
  kb._resetContext();
  return { handler: r.handler, md: String(r.response ?? '') };
}

for (const q of ['quiero suicidarme', 'tengo ganas de morir', 'me quiero matar', 'no quiero vivir',
  'ya no quiero vivir', 'mi hijo se quiere suicidar', 'tengo pensamientos suicidas', 'I want to die',
  'quiero suicidarme en Jalisco', 'tengo ganas de morir, muéstrame la gráfica']) {
  test(`crisis: «${q}» recibe la Línea de la Vida y ningún dato`, async () => {
    const { handler, md } = await pregunta(q);
    assert.equal(handler, 'answerCrisis');
    assert.match(md, /800 911 2000/);
    assert.match(md, /911\*\*/);
    assert.match(md, /SIN_GRAFICA/);
    assert.doesNotMatch(md, /casos|motor|pronóstico/i);
  });
}

test('crisis: gana al contexto y no lo hereda después', async () => {
  const { handler } = await pregunta('quiero morir', 'depresion en jalisco');
  assert.equal(handler, 'answerCrisis');
});

for (const q of ['estadisticas de depresion en jalisco', 'quiero ver la tension arterial',
  'cuantos casos de obesidad hay', 'mortalidad por dengue']) {
  test(`crisis: «${q}» no se confunde`, () => assert.equal(respuestaCrisis(q), null));
}

for (const q of ['ideación suicida en jalisco', 'suicidio en jalisco', 'cuantos suicidios hubo en 2025',
  'intento de suicidio en coahuila', 'autolesiones en mujeres', 'ideacion suicida']) {
  test(`suicidio: «${q}» no se modela y da la línea de ayuda`, async () => {
    const { handler, md } = await pregunta(q);
    assert.equal(handler, 'answerPadecimientoNoModelado');
    assert.match(md, /no modela/);
    assert.match(md, /800 911 2000/);
    assert.doesNotMatch(md, /12,914|Resumen epidemiológico/);
  });
}

test('«depresion alta» sigue siendo Depresión', async () => {
  assert.equal(detectEntities('casos de depresion alta en sonora').padecimiento, 'Depresion');
  assert.deepEqual(detectEntities('casos de depresion alta en sonora').padecimientos, undefined);
  assert.equal(releaseConAlias('casos de depresion alta en sonora'), null);
  const { md } = await pregunta('casos de depresion alta en sonora');
  assert.doesNotMatch(md, /Hipertensión/);
});

test('los alias van al inicio de palabra y los códigos completos', () => {
  assert.ok(!nombraAlias('heatstroke en jalisco', 'stroke'));
  assert.ok(!nombraAlias('codigo ai10', 'i10'));
  assert.ok(!nombraAlias('codigo i100', 'i10'));
  assert.ok(nombraAlias('hipertensos en jalisco', 'hipertens'));
  assert.ok(nombraAlias('i10 en jalisco', 'i10'));
});

for (const [q, pad] of [['isquemica en jalisco', 'Enfermedad isquémica del corazón'],
  ['cardiopatía isquémica en jalisco', 'Enfermedad isquémica del corazón'],
  ['enfermedad coronaria en jalisco', 'Enfermedad isquémica del corazón'],
  ['enfermedad cerebro vascular en jalisco', 'Enfermedad cerebrovascular'],
  ['infarto cerebral en jalisco', 'Enfermedad cerebrovascular'],
  ['isquemia cerebral en sonora', 'Enfermedad cerebrovascular'],
  ['tension arterial en jalisco', 'Hipertensión arterial'],
  ['presion arterial en jalisco', 'Hipertensión arterial']]) {
  test(`alias: «${q}» → ${pad}`, async () => {
    assert.equal(detectEntities(q).padecimiento, pad);
    assert.equal(mencionaNoModelada(q.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()), null);
    const { handler } = await pregunta(q);
    assert.notEqual(handler, 'answerEstado');
    assert.notEqual(handler, 'answerPadecimientoNoModelado');
  });
}

test('«hipertension e isquemica» nombra los dos', () => {
  assert.deepEqual(detectEntities('hipertension e isquemica nacional').padecimientos,
    ['Hipertensión arterial', 'Enfermedad isquémica del corazón']);
});

test('seguimiento: «y la isquemica?» cambia de padecimiento', async () => {
  const { md } = await pregunta('y la isquemica?', 'hipertension en jalisco');
  assert.match(md, /isquémica/i);
  assert.doesNotMatch(md, /I10-I15/);
});

for (const q of ['cardiopatía en jalisco', 'cardiopatias en sonora', 'cardiopatia reumatica en jalisco',
  'hipotensión en jalisco', 'presion baja en jalisco', 'pulmonary hypertension', 'hipertensión portal en sonora', 'hipertensión intracraneal en jalisco']) {
  test(`no modelada: «${q}» no recibe cifras de otro padecimiento`, async () => {
    const { handler, md } = await pregunta(q);
    assert.equal(handler, 'answerPadecimientoNoModelado');
    assert.doesNotMatch(md, /Quisiste decir|12,914|616,887/);
  });
}

test('seguimiento de hipertensión: «y pulmonar?» no repite I10-I15', async () => {
  const { handler } = await pregunta('y pulmonar?', 'hipertension en jalisco');
  assert.equal(handler, 'answerPadecimientoNoModelado');
});

// Desde el 12-nov-2026 la hipertensión del embarazo tiene release propio (O10-O16): nunca recibe las
// cifras de la hipertensión arterial (I10-I15) ni se responde como no modelada.
for (const q of ['hipertension durante el embarazo en jalisco', 'presión alta en embarazadas',
  'hipertensión inducida por el embarazo', 'gestational hypertension in jalisco', 'preeclampsia en sonora']) {
  test(`embarazo: «${q}» responde O10-O16 y no I10-I15`, async () => {
    const { md } = await pregunta(q);
    assert.match(md, /O10-O16/);
    assert.match(md, /EMBARAZO_HIPERTENSIVOS_O10/);
    assert.doesNotMatch(md, /I10-I15|HIPERTENSION_I10/);
  });
}

test('seguimiento de hipertensión: «y gestacional?» pasa a O10-O16, no repite I10-I15', async () => {
  const { md } = await pregunta('y gestacional?', 'hipertension en jalisco');
  assert.match(md, /EMBARAZO_HIPERTENSIVOS_O10/);
  assert.doesNotMatch(md, /HIPERTENSION_I10/);
});

for (const q of ['infarto', 'infarto en jalisco', 'ataque al corazón', 'ataque cardiaco en jalisco', 'heart attack']) {
  test(`infarto: «${q}» responde igual y no afirma el alcance de I21`, async () => {
    const { handler, md } = await pregunta(q);
    assert.equal(handler, 'answerPadecimientoNoModelado');
    assert.match(md, /I20, I25/);
    assert.match(md, /no se puede afirmar/);
  });
}

test('el corrector no cambia presión por depresión ni prueba por Puebla', async () => {
  const a = await pregunta('presion arterial en jalisco');
  assert.doesNotMatch(a.md, /Quisiste decir/);
  const b = await pregunta('la enfermedad isquemica paso la prueba de 2025?');
  assert.doesNotMatch(b.md, /Quisiste decir/);
});

test('el handler real responde la crisis sin clave ni modelo, aunque pidan stream', async () => {
  const { default: handler } = await import('../netlify/functions/rag.mjs');
  const previa = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    const req = new Request('http://localhost/rag', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: '¡Tengo ganas de morir!', stream: true }),
    });
    const res = await handler(req);
    const r = await res.json();
    assert.equal(res.status, 200);
    assert.match(r.answer, /800 911 2000/);
    assert.doesNotMatch(r.answer, /SIN_GRAFICA/);
  } finally {
    if (previa !== undefined) process.env.GEMINI_API_KEY = previa;
  }
});
