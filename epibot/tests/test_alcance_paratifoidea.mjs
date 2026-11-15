/**
 * Fiebre paratifoidea (A01.1-A01.4), aceptada en su prueba única de 2025 (alta20c, 15-nov-2026): validación prospectiva
 * en curso (0 de 4), nunca PASS ni control. «Tifoidea» a secas sigue en la fiebre tifoidea (A01.0, control publicado) y
 * «salmonelosis» en otras salmonelosis (A02); «A01» a secas pide precisar entre los dos bloques.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';

const K = readFileSync(new URL('../knowledge.json', import.meta.url), 'utf-8');
const vista = (u) => String(u).match(/publication\/([a-z0-9_]+)\/vista\.json/);
globalThis.fetch = async (u) => ({
  ok: true,
  json: async () => JSON.parse(vista(u)
    ? readFileSync(new URL(`../../publication/${vista(u)[1]}/vista.json`, import.meta.url), 'utf-8') : K),
});
const kb = await import('../js/kb.js');
const { norm } = await import('../js/entities.js?v=56');
const { mencionaNoModelada, aliasAmbiguo } = await import('../js/release_config.js?v=22');
const d = await kb.loadKnowledge();
await d.obesidad_pendiente;

async function pregunta(q) {
  kb._resetContext();
  const r = await kb.answerWithTrace(q);
  kb._resetContext();
  return { handler: r.handler, md: String(r.response ?? '') };
}

for (const q of ['paratifoidea en Sonora', 'fiebre paratifoidea en Jalisco', 'A01.2 en Jalisco', 'salmonella paratyphi en Jalisco',
  'pronostico de fiebre paratifoidea']) {
  test(`aceptado: «${q}» responde paratifoidea con validación en curso`, async () => {
    assert.equal(mencionaNoModelada(norm(q)), null, q);
    const { md } = await pregunta(q);
    assert.match(md, /PARATIFOIDEA_A011/, q);
    assert.doesNotMatch(md, /TIFOIDEA_A01[^1]|SALMONELOSIS_A02/, q);
    assert.match(md, /Validación prospectiva en curso|validación prospectiva está en curso/i, q);
    assert.doesNotMatch(md, /control estacional, no validado|\bPASS\b/, q);
  });
}

test('«tifoidea» a secas sigue en la fiebre tifoidea y «salmonelosis» en otras salmonelosis', async () => {
  for (const q of ['tifoidea en Jalisco', 'fiebre tifoidea en Sonora']) {
    const { md } = await pregunta(q);
    assert.match(md, /TIFOIDEA_A01\b/, q);
    assert.doesNotMatch(md, /PARATIFOIDEA_A011/, q);
  }
  const s = await pregunta('salmonelosis en Jalisco');
  assert.match(s.md, /SALMONELOSIS_A02/);
  assert.doesNotMatch(s.md, /PARATIFOIDEA_A011/);
});

test('«A01» a secas pide precisar entre tifoidea y paratifoidea, sin cifras', async () => {
  assert.ok(aliasAmbiguo(norm('A01 en Jalisco')));
  const { handler, md } = await pregunta('A01 en Jalisco');
  assert.equal(handler, 'answerAliasAmbiguo');
  assert.match(md, /fiebre tifoidea.*fiebre paratifoidea/s);
  assert.doesNotMatch(md, /PARATIFOIDEA_A011|TIFOIDEA_A01|casos pronosticados/);
});

test('el pico heredado de Michoacán lleva su aviso de la fuente en la respuesta determinista', async () => {
  const { md } = await pregunta('paratifoidea en Michoacán');
  assert.match(md, /121 casos de Michoacán en 2026-W32 siguen en el acumulado anual: 250 antes, 372 con esa semana y 398/);
});

test('la ficha cita el renglón 178 del SUIVE-1 y describe la tendencia sin causalidad', () => {
  const s = readFileSync(new URL('../../paratifoidea_a011.html', import.meta.url), 'utf-8');
  assert.match(s, /renglón 178, con alcance A01\.1-A01\.4/);
  assert.match(s, /bajaron de 13,194 en 2014 a 3,796 en 2025/);
  assert.match(s, /no permiten atribuir la baja a una causa/);
  assert.match(s, /dictamen tomado bajo delegación del autor decidió/);
  assert.doesNotMatch(s, / y el autor decidió/);
});
