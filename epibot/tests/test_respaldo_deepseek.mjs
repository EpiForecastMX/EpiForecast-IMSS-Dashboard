/**
 * Respaldo con DeepSeek (25-nov-2026): con Gemini en 402 responde DeepSeek, antes que Ollama, con el mismo verificador de
 * cifras y rotulado; en los modos nlu y plan pide JSON. La clave nunca sale en la respuesta.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { _reiniciaProveedor } from '../netlify/lib/proveedor.mjs';
import { respaldos, specDeepSeek, AVISOS } from '../netlify/lib/respaldo.mjs';

const rag = (await import('../netlify/functions/rag.mjs')).default;
const CLAVE = 'sk-prueba-no-real-123';

async function conEntorno(env, fetchFalso, fn) {
  const previa = globalThis.fetch;
  const guardado = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]]));
  for (const [k, v] of Object.entries(env)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  globalThis.fetch = fetchFalso;
  _reiniciaProveedor();
  try { return await fn(); } finally {
    globalThis.fetch = previa;
    for (const [k, v] of Object.entries(guardado)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    _reiniciaProveedor();
  }
}

const gemini402 = () => new Response(JSON.stringify({ error: { code: 402, message: 'Payment Required' } }), { status: 402, statusText: 'Payment Required' });
const pide = async (body) => (await rag(new Request('http://x/.netlify/functions/rag', { method: 'POST',
  headers: { 'content-type': 'application/json', 'x-nf-client-connection-ip': `d-${Math.random()}` }, body: JSON.stringify(body) }))).json();

test('configuración: DeepSeek va antes que Ollama, con deepseek-flash por omisión', () => {
  assert.equal(specDeepSeek({}), null);
  assert.equal(specDeepSeek({ DEEPSEEK_API_KEY: '  ' }), null);
  assert.equal(specDeepSeek({ DEEPSEEK_API_KEY: CLAVE }).modelo, 'deepseek-flash');
  assert.equal(specDeepSeek({ DEEPSEEK_API_KEY: CLAVE, EPI_DEEPSEEK_MODELO: 'deepseek-v4-pro' }).modelo, 'deepseek-v4-pro');
  const r = respaldos({ DEEPSEEK_API_KEY: CLAVE, EPI_LLM_RESPALDO: 'http://localhost:11434|llama3.1' });
  assert.deepEqual(r.map((s) => s.tipo), ['deepseek', 'ollama']);
  assert.doesNotMatch(AVISOS.deepseek, /local|menos preciso/);
});

test('generación: con Gemini en 402 responde DeepSeek, sin cifras inventadas, rotulado y sin filtrar la clave', async () => {
  const llamadas = [];
  const falso = async (u, init) => {
    const url = String(u?.url ?? u);
    llamadas.push(url);
    if (url.includes('googleapis')) return gemini402();
    if (url === 'https://api.deepseek.com/chat/completions') {
      assert.equal(init.headers.Authorization, `Bearer ${CLAVE}`);
      const b = JSON.parse(init.body);
      assert.equal(b.model, 'deepseek-flash');
      assert.equal(b.messages[0].role, 'system');
      assert.equal(b.messages.at(-1).role, 'user');
      assert.equal(b.response_format, undefined);
      return new Response(JSON.stringify({ choices: [{ message: { content: 'El proyecto valida con datos reales. Hubo 424,242 casos inventados.' } }] }), { status: 200 });
    }
    throw new Error(`fetch inesperado: ${url}`);
  };
  await conEntorno({ GEMINI_API_KEY: 'clave-gemini', DEEPSEEK_API_KEY: CLAVE, EPI_DEEPSEEK_MODELO: undefined, EPI_LLM_RESPALDO: 'http://localhost:11434|llama3.1' }, falso, async () => {
    const a = await pide({ query: '¿qué metodología usa el proyecto para validar sus pronósticos?' });
    assert.equal(a.model, 'deepseek:deepseek-flash');
    assert.match(a.answer, /valida con datos reales/);
    assert.doesNotMatch(a.answer, /424/);
    assert.match(a.answer, /modelo de respaldo porque la IA principal no está disponible/);
    assert.doesNotMatch(JSON.stringify(a), new RegExp(CLAVE));
    assert.ok(!llamadas.some((u) => u.endsWith('/api/chat')), 'Ollama no se llama si DeepSeek responde');
  });
});

test('generación: si DeepSeek falla, sigue Ollama; sin respaldos, error claro', async () => {
  const falso = async (u) => {
    const url = String(u?.url ?? u);
    if (url.includes('googleapis')) return gemini402();
    if (url.includes('api.deepseek.com')) return new Response('{"error":"Insufficient Balance"}', { status: 402 });
    if (url.endsWith('/api/chat')) return new Response(JSON.stringify({ message: { content: 'Respuesta local.' } }), { status: 200 });
    throw new Error(`fetch inesperado: ${url}`);
  };
  const q = { query: '¿qué metodología usa el proyecto para validar sus pronósticos?' };
  await conEntorno({ GEMINI_API_KEY: 'clave-gemini', DEEPSEEK_API_KEY: CLAVE, EPI_LLM_RESPALDO: 'http://localhost:11434|llama3.1' }, falso, async () => {
    const a = await pide(q);
    assert.equal(a.model, 'ollama:llama3.1');
    assert.match(a.answer, /modelo local de respaldo, menos preciso/);
  });
  await conEntorno({ GEMINI_API_KEY: 'clave-gemini', DEEPSEEK_API_KEY: CLAVE, EPI_LLM_RESPALDO: undefined }, falso, async () => {
    const b = await pide(q);
    assert.ok(b.error && !/402|Payment|Balance|deepseek/i.test(b.error), JSON.stringify(b));
  });
});

test('modo nlu: sin Gemini clasifica DeepSeek en JSON y la crisis sigue antes de cualquier modelo', async () => {
  let n = 0;
  const falso = async (u, init) => {
    const url = String(u?.url ?? u);
    if (url.includes('api.deepseek.com')) {
      n++;
      const b = JSON.parse(init.body);
      assert.deepEqual(b.response_format, { type: 'json_object' });
      assert.equal(b.temperature, 0);
      return new Response(JSON.stringify({ choices: [{ message: { content: '{"padecimiento":"dengue","estado":"Veracruz","sexo":null,"intencion":"estado_actual","periodo":null}' } }] }), { status: 200 });
    }
    throw new Error(`fetch inesperado: ${url}`);
  };
  await conEntorno({ GEMINI_API_KEY: undefined, DEEPSEEK_API_KEY: CLAVE, EPI_LLM_RESPALDO: undefined, EPI_LLM_LOCAL: undefined }, falso, async () => {
    const r = await pide({ query: 'como anda lo del mosquito en veracruz', modo: 'nlu' });
    assert.equal(r.consulta, '¿cómo va dengue en Veracruz?');
    const crisis = await pide({ query: 'me quiero matar', modo: 'nlu' });
    assert.match(String(crisis.answer), /800 911 2000/);
    assert.equal(n, 1, 'la crisis no llega al modelo');
  });
});
