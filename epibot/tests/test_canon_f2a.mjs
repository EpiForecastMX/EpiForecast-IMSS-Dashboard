/**
 * Plan canónico del EpiBot, fase 1, fase 2, entrega A (26-nov-2026): 2.1 «¿dónde sube más rápido?»
 * ordena por cambio porcentual entre entidades comparables, sin estados que bajan, y marca las bases pequeñas.
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

test('2.1 «dónde sube más rápido» ordena por cambio porcentual, con el veredicto en la primera línea', async () => {
  const t = await pide('¿dónde sube más rápido la hepatitis A?');
  const primera = t.split('\n').find((l) => l.trim());
  assert.match(primera, /^\*\*Hepatitis vírica A \(B15\), ambos sexos: sube más rápido en Ciudad de México\*\* \(\+\d+ %/);
  const pcts = [...t.split('\n').filter((l) => l.startsWith('- ')).join('\n').matchAll(/\(([+\u2212]\d+) %\)/g)].map((m) => Number(m[1].replace('\u2212', '-')));
  assert.ok(pcts.length >= 2, 'al menos dos entidades');
  assert.ok(pcts.every((p) => p > 0), 'ningún estado que baja en «sube»');
  for (let i = 1; i < pcts.length; i++) assert.ok(pcts[i] <= pcts[i - 1], 'orden descendente');
  assert.match(t, /menos de 10 casos/);
});

test('2.1 «dónde baja» sólo trae estados que bajan', async () => {
  const t = await pide('¿dónde baja más la hepatitis A?');
  const pcts = [...t.split('\n').filter((l) => l.startsWith('- ')).join('\n').matchAll(/\(([+\u2212]\d+) %\)/g)].map((m) => Number(m[1].replace('\u2212', '-')));
  assert.ok(pcts.length >= 1);
  assert.ok(pcts.every((p) => p < 0), 'ningún estado que sube en «baja»');
});

test('2.1 el ranking por volumen advierte las bases pequeñas', async () => {
  const t = await pide('ranking de estados para hepatitis A');
  assert.match(t, /base muy pequeña, el salto puede ser ruido/);
});

test('2.1 en los originales: «¿en qué estado sube más rápido el dengue?» y «¿dónde baja más?» ordenan por cambio porcentual', async () => {
  const lista = (t) => [...t.split('\n').filter((l) => l.startsWith('- ')).join('\n').matchAll(/\(([+−][\d,]+) %\)/g)].map((m) => Number(m[1].replace('−', '-').replace(/,/g, '')));
  const sube = await pide('¿en qué estado sube más rápido el dengue?');
  assert.match(sube.split('\n')[0], /^\*\*Dengue, ambos sexos: sube más rápido en [A-ZÁÉÍÓÚ]/);
  const ps = lista(sube);
  assert.ok(ps.length >= 2 && ps.every((p) => p > 0));
  for (let i = 1; i < ps.length; i++) assert.ok(ps[i] <= ps[i - 1]);
  const baja = await pide('¿dónde baja más el dengue?');
  assert.match(baja.split('\n')[0], /^\*\*Dengue, ambos sexos: baja más rápido en /);
  assert.ok(lista(baja).every((p) => p < 0));
  assert.match(await pide('¿en qué estado sube más rápido la depresión?'), /^\*\*Depresión, ambos sexos: sube más rápido en /);
  assert.match(await pide('¿dónde sube más el alzheimer en mujeres?'), /^\*\*Alzheimer, mujeres:\*\* no lo puedo decir/);
  assert.match(await pide('¿qué estados tendrán más casos de dengue el próximo mes?'), /^\*\*Estados con más casos de dengue esperados/, 'el ranking por volumen sigue');
});
