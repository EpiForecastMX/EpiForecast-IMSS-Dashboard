/**
 * Alcance de los bloques publicados el 12-nov-2026 (fallo reproducido por el supervisor antes de
 * integrar): `nombraAlias` cambia los puntos por espacios, así que el alias «a06» abarcaba «A06.4» y
 * «h65» abarcaba «H65.2». Esos códigos quedan FUERA de los bloques A06.0-A06.3, A06.9 y H65.0-H65.1.
 * Estas pruebas cubren detección, respuesta del KB y la función RAG real, y conservan los positivos.
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
const { detectEntities, norm } = await import('../js/entities.js?v=53');
const { mencionaNoModelada } = await import('../js/release_config.js?v=19');
const d = await kb.loadKnowledge();
await d.obesidad_pendiente;

async function pregunta(q) {
  kb._resetContext();
  const r = await kb.answerWithTrace(q);
  kb._resetContext();
  return { handler: r.handler, md: String(r.response ?? '') };
}

const MARCAS = /OTITIS_H65|AMEBIASIS_A06|CONJUNTIVITIS_H10|VEHICULOS_V20|EMBARAZO_HIPERTENSIVOS_O10/;
const VECINO = {
  amebiasis: 'Amebiasis intestinal', otitis: 'Otitis media aguda', conjuntivitis: 'Conjuntivitis',
  vehiculos: 'Accidente de transporte en vehículos con motor',
};

const NEGATIVOS = [
  ['pronostico de A06.4 en Jalisco', VECINO.amebiasis],
  ['pronóstico de A06.5 en Oaxaca', VECINO.amebiasis],
  ['casos de A06.6', VECINO.amebiasis],
  ['A06.7 en Chiapas', VECINO.amebiasis],
  ['a06 8 en sonora', VECINO.amebiasis],
  ['absceso hepático amebiano en Oaxaca', VECINO.amebiasis],
  ['amebiasis extraintestinal en jalisco', VECINO.amebiasis],
  ['pronostico de H65.2 en Jalisco', VECINO.otitis],
  ['H65.3 en Sonora', VECINO.otitis],
  ['h65 9 en jalisco', VECINO.otitis],
  ['H66 en Jalisco', VECINO.otitis],
  ['H66.0 en Puebla', VECINO.otitis],
  ['otitis media supurativa en Jalisco', VECINO.otitis],
  ['otitis media crónica en Jalisco', VECINO.otitis],
  ['otitis externa en Jalisco', VECINO.otitis],
  ['conjuntivitis hemorrágica en Jalisco', VECINO.conjuntivitis],
  ['conjuntivitis viral en Sonora', VECINO.conjuntivitis],
  ['B30.3 en Jalisco', VECINO.conjuntivitis],
  ['conjuntivitis epidémica aguda hemorrágica', VECINO.conjuntivitis],
  ['peatón lesionado en accidente de tránsito en Jalisco', VECINO.vehiculos],
  ['peatones atropellados en jalisco', VECINO.vehiculos],
  ['accidente en bicicleta en Jalisco', VECINO.vehiculos],
  ['ciclistas lesionados en accidente de tránsito en Sonora', VECINO.vehiculos],
  ['accidente de transporte V15 en Jalisco', VECINO.vehiculos],
  ['V85 en Jalisco', VECINO.vehiculos],
];

for (const [q, vecino] of NEGATIVOS) {
  test(`fuera del bloque: «${q}» no recibe cifras de ${vecino}`, async () => {
    const qn = norm(q);
    assert.ok(mencionaNoModelada(qn), `mencionaNoModelada(${qn})`);
    const ent = detectEntities(q);
    assert.notEqual(ent.padecimiento, vecino, 'detectEntities');
    assert.ok(!(ent.padecimientos || []).includes(vecino), 'detectEntities (todos)');
    const { md } = await pregunta(q);
    assert.doesNotMatch(md, MARCAS, md.slice(0, 200));
    assert.doesNotMatch(md, /casos pronosticados|Pronóstico \*\*congelado\*\*/);
  });
}

// Términos coloquiales: no se atribuye un diagnóstico del bloque publicado.
for (const q of ['ojo rojo en jalisco', 'infección de oído en jalisco', 'ear infection in jalisco']) {
  test(`coloquial: «${q}» no responde con un bloque publicado`, async () => {
    const { md } = await pregunta(q);
    assert.doesNotMatch(md, MARCAS);
  });
}

const POSITIVOS = [
  ['A06.0 en Jalisco', /AMEBIASIS_A06/],
  ['A06.3 en Oaxaca', /AMEBIASIS_A06/],
  ['A06.9 en Oaxaca', /AMEBIASIS_A06/],
  ['amebiasis intestinal en Oaxaca', /AMEBIASIS_A06/],
  ['H65.0 en Jalisco', /OTITIS_H65/],
  ['H65.1 en Jalisco mujeres', /OTITIS_H65/],
  ['otitis media aguda en Jalisco', /OTITIS_H65/],
  ['conjuntivitis en Sonora', /CONJUNTIVITIS_H10/],
  ['accidente de transporte en vehículos con motor en Jalisco', /VEHICULOS_V20/],
  ['preeclampsia en Sonora', /EMBARAZO_HIPERTENSIVOS_O10/],
];
for (const [q, marca] of POSITIVOS) {
  test(`dentro del bloque: «${q}» responde su release`, async () => {
    const { md } = await pregunta(q);
    assert.match(md, marca);
  });
}

test('mixta: amebiasis intestinal con asma no se trata como subtipo ajeno', async () => {
  assert.equal(mencionaNoModelada(norm('compara amebiasis intestinal con asma')), null);
  const { handler } = await pregunta('compara amebiasis intestinal con asma');
  assert.equal(handler, 'answerReleasesMixtos');
});

test('crisis sigue primero y sin gráfica', async () => {
  const { handler, md } = await pregunta('tengo ganas de morir');
  assert.equal(handler, 'answerCrisis');
  assert.match(md, /SIN_GRAFICA/);
});

// Función RAG real: responde sin modelo ni cifras para un subtipo ajeno, antes de pedir la clave.
const rag = await import('../netlify/functions/rag.mjs');
async function postRag(query) {
  const res = await rag.default(new Request('http://x/.netlify/functions/rag', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query }),
  }));
  return { status: res.status, body: await res.json() };
}
for (const [q] of NEGATIVOS.slice(0, 6).concat([NEGATIVOS[7], NEGATIVOS[12], NEGATIVOS[17], NEGATIVOS[21]])) {
  test(`RAG real: «${q}» reconoce la categoría no publicada y no da cifras`, async () => {
    const { status, body } = await postRag(q);
    assert.equal(status, 200);
    assert.match(body.answer, /no modela/);
    assert.doesNotMatch(body.answer, /\d{1,3}(,\d{3})+|casos pronosticados/);
    assert.deepEqual(body.sources, []);
  });
}
