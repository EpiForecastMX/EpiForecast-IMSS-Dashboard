/**
 * El EpiBot contesta primero el periodo pedido (mesa de la plataforma, 25-nov-2026, Codex Sol): «semana N de AAAA» y
 * «en 52 semanas»; y dice que «en lo que va del año» es la suma de las semanas de la serie, no el acumulado impreso.
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
const kb = await import('../js/kb.js');
await kb.loadKnowledge();
const pide = async (q) => { kb._resetContext?.(); return JSON.stringify(await kb.answerWithTrace(q)); };
const primera = (t) => JSON.parse(t).response?.split('\n').filter((l) => l.trim() && !l.startsWith('_') && !/^\*\*[^*]+\*\*$/.test(l.trim()))[0] ?? t;

test('semana N de AAAA: se contesta esa semana, con su rango de fechas', async () => {
  // El cuadro 17 del boletín 44 llega hasta la semana 43: los 3,293 casos de depresión son de la semana 43 (25 al 31 de octubre).
  const dep = await pide('¿Cuántos casos de depresión hubo en la semana 43 de 2026?');
  assert.match(dep, /\*\*En la semana 43 de 2026\*\* \(25 al 31 de octubre de 2026\) se notificaron \*\*3,293 casos\*\*/);
  assert.match(await pide('depresión en la semana 44 de 2026'), /\*\*La semana 44 de 2026\*\* \(1 al 7 de noviembre de 2026\) \*\*aún no tiene dato\*\*/);
  const den = await pide('dengue en la semana 44 de 2026');
  assert.match(den, /se notificaron \*\*575 casos\*\*/);
  // Una semana sin dato todavía: se dice y se da lo esperado, sin inventar un observado.
  const vari = await pide('varicela en la semana 44');
  assert.match(vari, /\*\*La semana 44 de 2026\*\* \(1 al 7 de noviembre de 2026\) \*\*aún no tiene dato\*\*/);
});

test('en 52 semanas: el total del horizonte encabeza, con su periodo', async () => {
  const r = await pide('¿Cuántos casos de asma se pronostican en México en 52 semanas?');
  assert.match(r, /\*\*En las 52 semanas del pronóstico\*\*, de la semana \d+ \([^)]+\) a la semana \d+ \([^)]+\), se esperan unos \*\*131,068 casos\*\*/);
  assert.ok(r.indexOf('131,068') < r.indexOf('12,854'), 'el total de 52 semanas va antes que las próximas 4');
});

test('en lo que va del año: se aclara que es la suma de las semanas de la serie', async () => {
  const r = await pide('casos de varicela en lo que va de 2026');
  assert.match(r, /\*\*En lo que va de 2026\*\* se han notificado \*\*46,525 casos\*\* en el país \(suma de las semanas de la serie publicada/);
  // Plan canónico 2.4: la viñeta ya no lleva la aclaración; va, igual de explícita, en la ficha plegada.
  const [, detalle] = r.split('<!--DETALLE-->');
  assert.match(detalle, /«En lo que va de 2026» es la suma de las semanas de la serie publicada/);
});
