/**
 * Mal del pinto (A67) y vulvovaginitis (N76), aceptados en su prueba única de 2025 (alta20c, 15-nov-2026): validación
 * prospectiva en curso (0 de 4), nunca PASS ni control. Vulvovaginitis no tiene desglose por sexo (37 series) y el bot
 * lo dice si se pide un sexo; «vaginitis» o una vulvovaginitis con agente nombrado (candidiásica, por tricomonas)
 * piden precisar, porque la candidiasis urogenital (B37.3-B37.4) es otro bloque publicado y la tricomoniasis no se
 * modela. La ficha de mal del pinto declara su error absoluto alto y el cambio de nivel de 2024 sin leerlo como menor
 * incidencia.
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
const { aliasAmbiguo } = await import('../js/release_config.js?v=22');
const d = await kb.loadKnowledge();
await d.obesidad_pendiente;

async function pregunta(q) {
  kb._resetContext();
  const r = await kb.answerWithTrace(q);
  kb._resetContext();
  return { handler: r.handler, md: String(r.response ?? '') };
}

for (const [q, marca] of [['mal del pinto en Veracruz', 'MAL_DEL_PINTO_A67'], ['A67 en Tamaulipas', 'MAL_DEL_PINTO_A67'],
  ['pronostico de mal del pinto', 'MAL_DEL_PINTO_A67'], ['vulvovaginitis en Jalisco', 'VULVOVAGINITIS_N76'],
  ['vulvovaginitis inespecífica en Sonora', 'VULVOVAGINITIS_N76'], ['N76 en Puebla', 'VULVOVAGINITIS_N76'],
  ['pronostico de vulvovaginitis', 'VULVOVAGINITIS_N76']]) {
  test(`aceptado: «${q}» responde su release con validación en curso`, async () => {
    const { md } = await pregunta(q);
    assert.match(md, new RegExp(marca), q);
    assert.match(md, /Validación prospectiva en curso|validación prospectiva está en curso/i, q);
    assert.doesNotMatch(md, /control estacional, no validado|\bPASS\b|CANDIDIASIS_B37/, q);
  });
}

test('sin sexo: vulvovaginitis no ofrece desglose por sexo', async () => {
  const { md } = await pregunta('vulvovaginitis en Jalisco mujeres');
  assert.match(md, /sexo/i);
  assert.doesNotMatch(md, /· Hombres\*\*|· Mujeres\*\*/);
});

for (const q of ['vaginitis en Jalisco', 'vulvovaginitis candidiásica en Jalisco', 'vulvovaginitis por tricomonas en Sonora']) {
  test(`ambiguo: «${q}» pide precisar sin cifras`, async () => {
    assert.ok(aliasAmbiguo(norm(q)), 'aliasAmbiguo');
    const { handler, md } = await pregunta(q);
    assert.equal(handler, 'answerAliasAmbiguo');
    assert.doesNotMatch(md, /VULVOVAGINITIS_N76|CANDIDIASIS_B37|casos pronosticados/);
    assert.match(md, /«vulvovaginitis».*«candidiasis urogenital»/s);
  });
}

test('la candidiasis vulvovaginal sigue en la candidiasis urogenital', async () => {
  const { md } = await pregunta('candidiasis vulvovaginal en Jalisco');
  assert.match(md, /CANDIDIASIS_B37/);
  assert.doesNotMatch(md, /VULVOVAGINITIS_N76/);
});

test('«pinta» suelta no dispara mal del pinto', async () => {
  const { md } = await pregunta('como pinta la depresion en jalisco');
  assert.doesNotMatch(md, /MAL_DEL_PINTO_A67/);
});

test('las fichas declaran error alto, cambio de nivel y continuidad del rótulo', () => {
  const mp = readFileSync(new URL('../../mal_del_pinto_a67.html', import.meta.url), 'utf-8');
  assert.match(mp, /sMAPE 111\.3, frente a 115\.8/);
  assert.match(mp, /no que el pronóstico sea preciso/);
  assert.match(mp, /no debe leerse como menor incidencia/);
  assert.match(mp, /dictamen tomado bajo delegación del autor decidió/);
  const vv = readFileSync(new URL('../../vulvovaginitis_n76.html', import.meta.url), 'utf-8');
  assert.match(vv, /«Vulvovaginitis Inespecífica» con el código A76\.0; desde 2017_sem02, «Vulvovaginitis» con N76/);
});
