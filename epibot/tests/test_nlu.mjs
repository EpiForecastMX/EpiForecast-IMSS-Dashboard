/**
 * Respaldo de comprensión con Gemini (netlify/lib/nlu.mjs, rediseño conversacional del 24-nov-2026): Gemini sólo clasifica
 * contra listas cerradas; la salida se valida campo por campo y nunca llega texto del modelo al usuario.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../js/vocab_cerrado.js';
import '../js/vocab_consulta.js';
import '../js/release_catalog.js';
import { catalogoNlu, validaNlu, consultaCanonica, interpretaConsulta, promptNlu, ESTADOS_32 } from '../netlify/lib/nlu.mjs';

const C = globalThis.EPI_CATALOGO;
const cat = catalogoNlu(C.releases);

test('la lista cerrada excluye todo padecimiento sensible e incluye los cuatro originales', () => {
  for (const r of C.releases.filter((x) => x.sensible)) assert.ok(!cat.some((c) => c.id === r.id), r.id);
  for (const id of ['dengue', 'depresion', 'parkinson', 'alzheimer', 'escabiosis_b86']) assert.ok(cat.some((c) => c.id === id), id);
  assert.equal(ESTADOS_32.length, 32);
  assert.match(promptNlu('hola', cat), /NO respondas la pregunta/);
});

test('salida válida → consulta canónica', () => {
  const v = validaNlu('{"padecimiento":"dengue","estado":"Veracruz","sexo":null,"intencion":"estado_actual","periodo":null}', cat);
  assert.equal(consultaCanonica(v), '¿cómo va dengue en Veracruz?');
  const t = validaNlu({ padecimiento: 'diabetes_t2', estado: 'Nuevo León', sexo: 'mujeres', intencion: 'tendencia', periodo: 'diciembre' }, cat);
  assert.match(consultaCanonica(t), /^¿está subiendo .+ en Nuevo León mujeres en diciembre\?$/);
  assert.equal(consultaCanonica(validaNlu({ intencion: 'ranking' }, cat)), '¿qué enfermedades van al alza?');
  assert.match(consultaCanonica(validaNlu({ padecimiento: 'escabiosis_b86', intencion: 'definicion' }, cat)), /^¿qué es escabiosis\?$/);
});

test('salida inválida, inventada, sensible o de otra intención → null', () => {
  for (const malo of [
    'no es json', '[]', '{"padecimiento":"inventado","intencion":"estado_actual"}',
    '{"padecimiento":"ahorcamiento_x70","intencion":"estado_actual"}', '{"padecimiento":"dengue","estado":"Texas","intencion":"estado_actual"}',
    '{"padecimiento":"dengue","intencion":"otra"}', '{"padecimiento":null,"intencion":"tendencia"}', '{"padecimiento":"dengue","intencion":"hackear"}',
  ]) assert.equal(consultaCanonica(validaNlu(malo, cat)), null, malo);
});

test('interpretaConsulta tolera errores y tiempos agotados del modelo', async () => {
  assert.deepEqual(await interpretaConsulta('x', C.releases, async () => { throw new Error('timeout'); }), { consulta: null, entendido: null });
  const r = await interpretaConsulta('lo del mosquito en veracruz', C.releases,
    async () => '```json\n{"padecimiento":"dengue","estado":"Veracruz","sexo":null,"intencion":"estado_actual","periodo":null}\n```');
  assert.equal(r.consulta, '¿cómo va dengue en Veracruz?');
});

test('la función RAG en modo nlu: crisis primero y sin clave no clasifica', async () => {
  delete process.env.GEMINI_API_KEY;
  globalThis.fetch = async () => { throw new Error('sin red'); };
  const rag = (await import('../netlify/functions/rag.mjs')).default;
  const llamar = async (query) => (await rag(new Request('http://x/.netlify/functions/rag', { method: 'POST', body: JSON.stringify({ query, modo: 'nlu' }) }))).json();
  const crisis = await llamar('me quiero matar');
  assert.match(String(crisis.answer), /800 911 2000/);
  assert.equal(crisis.consulta, undefined);
  const sinClave = await llamar('como anda lo del mosquito en veracruz');
  assert.equal(sinClave.consulta, null);
});

// Definiciones en lenguaje llano (js/definiciones.js), revisadas por un médico.
test('cada padecimiento no sensible tiene definición y ningún sensible la tiene', async () => {
  const { DEFINICIONES } = await import('../js/definiciones.js');
  for (const r of C.releases) {
    if (r.sensible) assert.equal(DEFINICIONES[r.id], undefined, r.id);
    else assert.ok(DEFINICIONES[r.id], `falta la definición de ${r.id}`);
  }
  for (const [id, t] of Object.entries(DEFINICIONES)) {
    const n = t.split(/\s+/).length;
    assert.ok(n >= 20 && n <= 70, `${id}: ${n} palabras`);
    assert.doesNotMatch(t, /[—“”]|\p{Extended_Pictographic}/u, id);
    assert.ok(C.releases.some((r) => r.id === id), `definición huérfana: ${id}`);
  }
});
