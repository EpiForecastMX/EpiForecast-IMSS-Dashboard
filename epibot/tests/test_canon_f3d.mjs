/**
 * Plan canónico del EpiBot, 3.4 (26-nov-2026): cierres por perfil sobre los mismos hechos («en corto», «para nota», «para
 * junta»). Ninguna cifra nueva, sin motor, «para nota» con fecha, fuente y lo que no dice; «para junta» con qué no decidir.
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
const { tipoCierre, quitaCierre } = await import('../js/cierres.js');
const visible = (t) => String(t).replace(/<!--[\s\S]*?-->/g, '');
const cifras = (t) => (visible(t).match(/\d[\d,.]*\d|\d/g) || []).map((x) => x.replace(/[.,]$/, ''));

/** Conversación: devuelve cada turno con su handler. */
async function conversa(...qs) {
  kb._resetContext();
  const out = [];
  for (const q of qs) out.push(await kb.answerWithTrace(q));
  return out;
}

test('detecta los tres cierres y los separa de la consulta', () => {
  assert.equal(tipoCierre('en corto'), 'corto');
  assert.equal(tipoCierre('dímelo en pocas palabras'), 'corto');
  assert.equal(tipoCierre('para nota'), 'nota');
  assert.equal(tipoCierre('¿me lo das para una nota de prensa?'), 'nota');
  assert.equal(tipoCierre('para la junta con el director'), 'junta');
  assert.equal(tipoCierre('¿cómo va el dengue en Veracruz?'), null);
  assert.equal(quitaCierre('dengue en Veracruz para nota'), 'dengue en Veracruz');
  assert.equal(quitaCierre('diabetes tipo 2 en Nuevo León para junta'), 'diabetes tipo 2 en Nuevo León');
});

test('ninguna cifra nueva: cada número del cierre está en la respuesta de origen (releases y originales)', async () => {
  for (const base of ['dengue en Veracruz', 'escabiosis', 'varicela en Jalisco mujeres', 'diabetes tipo 2 en Nuevo León', 'depresión']) {
    for (const cierre of ['en corto', 'para nota', 'para junta']) {
      const [origen, r] = await conversa(base, cierre);
      assert.equal(r.handler, 'answerCierre', `${base} → ${cierre}`);
      const fuente = new Set(cifras(origen.response));
      const nuevas = cifras(r.response).filter((n) => !fuente.has(n));
      assert.deepEqual(nuevas, [], `${base} → ${cierre}: ${visible(r.response)}`);
      assert.doesNotMatch(visible(r.response), /\bmotor\b|DeepAR|Prophet|Ensemble|Stacking|portafolio/i, `${base} → ${cierre}`);
    }
  }
});

test('«para nota»: frase citable con fecha, fuente y lo que no dice; el control se dice como control', async () => {
  const [, r] = await conversa('escabiosis', 'para nota');
  const t = visible(r.response);
  assert.match(t, /^\*\*Para nota\*\*/);
  assert.match(t, /> Escabiosis en el país: /);
  assert.match(t, /hasta la semana \d+ \(\d+ al \d+ de [a-z]+ de \d{4}\)/);
  assert.match(t, /\*\*Qué no dice:\*\* son casos notificados al sistema de vigilancia, no todas las personas enfermas; no es una cifra oficial ni una alerta; es el control estacional/);
  assert.match(t, /\*\*Fuente:\*\* EpiForecast-MX \(https:\/\/epiforecast\.mx\), con datos del Boletín Epidemiológico de la Secretaría de Salud\./);
  assert.match(r.response, /<!--SIN_GRAFICA-->/);
});

test('«para junta»: qué mirar, qué tan firme es y qué no decidir; «en corto» en tres líneas', async () => {
  const [, j] = await conversa('diabetes tipo 2 en Nuevo León', 'para junta');
  const t = visible(j.response);
  assert.match(t, /^\*\*Para junta: Diabetes tipo II en Nuevo León\*\*/);
  assert.match(t, /- \*\*Qué mirar:\*\* /);
  assert.match(t, /- \*\*Qué tan firme es:\*\* confiabilidad baja aquí\./);
  assert.match(t, /- \*\*Qué no decidir con esto:\*\* .*Contrástalo con la información de tu jurisdicción/);
  const [, c] = await conversa('dengue en Veracruz', 'en corto');
  const lineas = visible(c.response).trim().split('\n').filter((l) => l.trim());
  assert.equal(lineas.length, 3, visible(c.response));
  assert.match(lineas[1], /^Confiabilidad media\./);
  assert.match(lineas[2], /^Datos hasta la semana 44 /);
});

test('con el padecimiento en la misma frase responde primero y resume después; sin consulta previa, lo pide', async () => {
  const [r] = await conversa('dengue en Veracruz para nota');
  assert.equal(r.handler, 'answerCierre');
  assert.match(visible(r.response), /> Dengue en Veracruz: /);
  const [s] = await conversa('para junta');
  assert.match(s.response, /necesito primero la consulta/);
  assert.doesNotMatch(visible(s.response), /\d/);
});

test('tras una crisis o un consejo médico no hay cierre con cifras', async () => {
  const [, crisis, nota] = await conversa('dengue en Veracruz', 'me quiero morir', 'para nota');
  assert.match(crisis.response, /800 911 2000/);
  assert.doesNotMatch(visible(nota.response), /Dengue en Veracruz: /);
  const [, , consejo] = await conversa('dengue en Veracruz', '¿puedo tomar paracetamol?', 'para nota');
  assert.doesNotMatch(visible(consejo.response), /Dengue en Veracruz: /);
});

test('las respuestas de datos ofrecen el botón «Resumen para nota»', async () => {
  for (const q of ['escabiosis', 'dengue en Veracruz']) {
    const [r] = await conversa(q);
    const sig = JSON.parse(r.response.match(/<!--SIGUE:(\[.*?\])-->/)[1]);
    assert.ok(sig.length <= 4);
    assert.deepEqual(sig.at(-1), { t: 'Resumen para nota', q: 'para nota' }, q);
  }
});
