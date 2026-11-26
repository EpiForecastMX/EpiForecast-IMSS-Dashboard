/**
 * Plan canónico del EpiBot, fase 1, entrega C (26-nov-2026): 1.3 «qué va al alza» sin controles ni modelos desviados en el
 * bloque de expectativas, con el corte de cada grupo; 1.5 confiabilidad coherente.
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

test('1.3 ningún control ni modelo desviado en «lo que más se espera que suba»; controles en su bloque; corte por grupo; marcador con series', async () => {
  const t = await pide('¿qué enfermedades van al alza?');
  const sube = t.split('**Lo que más se espera que baje')[0];
  const controles = new Set(resumen.padecimientos.filter((x) => x.control).map((x) => x.nombre));
  for (const n of controles) assert.doesNotMatch(sube, new RegExp(`\\*\\*${n.replace(/[()]/g, '\\$&')}\\*\\*`), `control en el bloque de alzas: ${n}`);
  assert.doesNotMatch(sube, /Leptospirosis|Hepatitis vírica A/);
  assert.match(t, /\*\*Controles estacionales, sin modelo validado:\*\*/);
  assert.match(t, /\(114 con datos hasta la semana del 26 de octubre de 2026 y 22 con datos hasta la semana del 2 de noviembre de 2026\)/);
  const g = JSON.parse(t.match(/<!--ALZA:(.*?)-->/)[1]);
  assert.equal(g.modo, 'cambio');
  assert.ok(g.filas.every((x) => x.serie && x.serie.o.length === 12 && x.serie.f.length === 4));
  assert.ok(g.filas.filter((x) => x.control).every((x) => controles.has(x.n)));
});

test('1.5 confiabilidad coherente: desvío grande con una semana baja la confiabilidad; PASS no dice «acertó»; asma explica su semana no prospectiva', async () => {
  assert.match(await pide('hepatitis A en el país'), /no hay una señal clara de cambio[\s\S]*en la semana ya comprobada se ha pasado[\s\S]*\*\*Confiabilidad: baja aquí\.\*\*/);
  const ob = await pide('obesidad en el país');
  assert.match(ob, /no fue peor que el control estacional/);
  assert.doesNotMatch(ob, /acertó/);
  assert.match(await pide('¿qué tan confiable es el pronóstico de asma?'), /va en 2 de 4 semanas\. De ellas, 2026-W42 ya era pública al emitir y no cuenta como prospectiva\./);
});
