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
const { detectEntities, norm } = await import('../js/entities.js?v=54');
const { mencionaNoModelada } = await import('../js/release_config.js?v=20');
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
  // Segunda revisión de Fable (12-nov-2026): variantes que recibían cifras del bloque vecino.
  ['amibiasis hepática en Oaxaca', VECINO.amebiasis],
  ['amibiasis extraintestinal en Jalisco', VECINO.amebiasis],
  ['amoebiasis hepática en Oaxaca', VECINO.amebiasis],
  ['amebiasis del hígado en Oaxaca', VECINO.amebiasis],
  ['otitis supurativa en Jalisco', VECINO.otitis],
  ['otitis media aguda supurativa en Jalisco', VECINO.otitis],
  ['otitis purulenta en Jalisco', VECINO.otitis],
  ['otitis interna en Jalisco', VECINO.otitis],
  ['conjuntivitis vírica en Sonora', VECINO.conjuntivitis],
  ['conjuntivitis por adenovirus en Sonora', VECINO.conjuntivitis],
  ['conjuntivitis adenoviral en Sonora', VECINO.conjuntivitis],
  ['conjuntivitis aguda epidémica hemorrágica en Sonora', VECINO.conjuntivitis],
  ['conjuntivitis gonocócica en Sonora', VECINO.conjuntivitis],
  ['conjuntivitis neonatal en Sonora', VECINO.conjuntivitis],
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

// Presión baja nunca se convierte en hipertensión, y la diabetes del embarazo no se adjudica a O10-O16.
const EMBARAZO_AJENO = [
  ['presión arterial baja en el embarazo en Jalisco', /presi[oó]n arterial baja/],
  ['tensión arterial baja en embarazadas en Sonora', /tensi[oó]n arterial baja/],
  ['diabetes gestacional e hipertensión en Jalisco', /diabetes gestacional/],
  ['hipertensión y diabetes en el embarazo en Jalisco', /diabetes en el embarazo/],
];
for (const [q, termino] of EMBARAZO_AJENO) {
  test(`embarazo: «${q}» conserva su término no modelado y no responde O10-O16`, async () => {
    assert.match(mencionaNoModelada(norm(q)) || '', termino);
    const { md } = await pregunta(q);
    assert.match(md, /no modela/);
    assert.doesNotMatch(md, /MARCA:|EMBARAZO_HIPERTENSIVOS_O10|DIABETES_T[12]|casos pronosticados/);
  });
}

// Cada consulta sugerida (botones, zoom, textos) resuelve a su propio release.
const { RELEASES } = await import('../js/release_config.js?v=20');
for (const r of RELEASES) {
  test(`consulta sugerida: «${r.consulta}» resuelve a ${r.id}`, async () => {
    const ent = detectEntities(`${r.consulta} en Jalisco`);
    assert.equal(ent.padecimiento, r.pad, 'detectEntities');
    const { md } = await pregunta(`${r.consulta} en Jalisco`);
    assert.match(md, new RegExp(r.marca));
  });
}

// Nombres genéricos que abarcan más que el bloque: se aclara sin cifras y se sugiere el nombre completo.
const { aliasAmbiguo, subtipoAjeno } = await import('../js/release_config.js?v=20');
const AMBIGUOS = [
  ['otitis en Jalisco', 'otitis media aguda'],
  ['otitis media en Jalisco', 'otitis media aguda'],
  ['pronóstico de H65 en Sonora', 'otitis media aguda'],
  ['h65 2 semanas en Jalisco', 'otitis media aguda'],
  ['amebiasis en Oaxaca', 'amebiasis intestinal'],
  ['amibiasis en Chiapas', 'amebiasis intestinal'],
  ['a06 4 semanas en Oaxaca', 'amebiasis intestinal'],
];
for (const [q, consulta] of AMBIGUOS) {
  test(`ambiguo: «${q}» pide precisar sin dar cifras`, async () => {
    assert.ok(aliasAmbiguo(norm(q)), 'aliasAmbiguo');
    assert.equal(subtipoAjeno(norm(q)), null, 'no es subtipo ajeno');
    const { handler, md } = await pregunta(q);
    assert.equal(handler, 'answerAliasAmbiguo');
    assert.doesNotMatch(md, MARCAS);
    assert.doesNotMatch(md, /\d{1,3}(,\d{3})+|casos pronosticados/);
    assert.match(md, new RegExp(`«${consulta}»`));
    const rag = await postRag(q);
    assert.equal(rag.status, 200);
    assert.equal(rag.body.answer, aliasAmbiguo(norm(q)).texto);
    assert.deepEqual(rag.body.sources, []);
  });
}

// Peatón o ciclista sin contexto de transporte no bloquea otro padecimiento publicado.
for (const [q, marca] of [['obesidad en ciclistas en Jalisco', /OBESIDAD|Obesidad/], ['asma en peatones en Sonora', /ASMA_J45/]]) {
  test(`sin sobrebloqueo: «${q}»`, async () => {
    assert.equal(subtipoAjeno(norm(q)), null);
    assert.equal(mencionaNoModelada(norm(q)), null);
    const { md } = await pregunta(q);
    assert.doesNotMatch(md, /no modela/);
    assert.match(md, marca);
  });
}

// Botones del panel: ninguno cae en la aclaración de nombre genérico ni en «no modela».
const PANEL = [...readFileSync(new URL('../index.html', import.meta.url), 'utf-8').matchAll(/data-q="([^"]+)"/g)].map((m) => m[1]);
test('panel: los botones existen', () => assert.ok(PANEL.length > 50));
for (const q of PANEL.filter((x) => /otitis|conjuntivitis|amebiasis|vehiculos|hipertensivos/.test(x))) {
  test(`panel: «${q}» responde su release`, async () => {
    const { handler, md } = await pregunta(q);
    assert.notEqual(handler, 'answerAliasAmbiguo');
    assert.doesNotMatch(md, /no modela/);
    assert.match(md, MARCAS);
  });
}
