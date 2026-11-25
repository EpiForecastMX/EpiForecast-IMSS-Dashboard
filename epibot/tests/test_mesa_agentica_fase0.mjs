/**
 * Fase 0 de la mesa agéntica (25-nov-2026): defectos que la mesa encontró en la ruta generativa.
 * - Un 402 de facturación no se reintenta con otro modelo y apaga el proveedor (interruptor de circuito).
 * - «rate» dentro de la URL «…:generateContent» ya no se confunde con un límite de cuota.
 * - Ninguna cifra generada sin respaldo en el contexto llega a la persona, tampoco en streaming.
 * - El registro de la función no guarda el texto de la consulta.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { registraFallo, proveedorBloqueado, reintentable, _reiniciaProveedor, mensajeUsuario } from '../netlify/lib/proveedor.mjs';
import { cifrasSinRespaldo, depuraCifras, canonico } from '../netlify/lib/cifras_verificadas.mjs';

test('proveedor: 402 y clave inválida son fatales; 429 es cuota; la URL de generateContent no es cuota', () => {
  _reiniciaProveedor();
  const t0 = 1_000_000;
  assert.equal(registraFallo(new Error('[GoogleGenerativeAI Error]: Error fetching from https://x/models/m:generateContent: [402 Payment Required]'), t0), 'fatal');
  assert.ok(proveedorBloqueado(t0 + 60e3));
  assert.ok(!proveedorBloqueado(t0 + 6 * 60e3));
  _reiniciaProveedor();
  assert.equal(registraFallo(new Error('[429 Too Many Requests] Resource has been exhausted (e.g. check quota).'), t0), 'cuota');
  assert.ok(!reintentable('cuota') && !reintentable('fatal') && reintentable('otro') && reintentable('red'));
  _reiniciaProveedor();
  assert.equal(registraFallo(new Error('Error fetching from https://generativelanguage.googleapis.com/v1beta/models/m:generateContent: stub'), t0), 'otro');
  assert.ok(!proveedorBloqueado(t0));
  assert.doesNotMatch(mensajeUsuario('fatal'), /402|Gemini|payment/i);
  _reiniciaProveedor();
});

test('cifras: separadores de miles y decimales se comparan en forma canónica', () => {
  assert.equal(canonico('2,512'), '2512');
  assert.equal(canonico('2 512'), '2512');
  assert.equal(canonico('14,7'), '14.7');
  const ctx = 'Pronóstico 52 semanas: 2512 casos; sMAPE 14.72 %.';
  assert.deepEqual(cifrasSinRespaldo('Se esperan 2,512 casos (sMAPE 14.7 %) en 52 semanas de 2026.', ctx), []);
  assert.deepEqual(cifrasSinRespaldo('Se esperan 3,100 casos.', ctx), ['3,100']);
  // Códigos CIE, semanas W43, citas [3] y enteros pequeños no cuentan como cifras.
  assert.deepEqual(cifrasSinRespaldo('El bloque J45.0 en la semana W43 [3] cubre 4 semanas.', ''), []);
});

test('cifras: se retira sólo la oración sin respaldo; sin contenido, null', () => {
  const ctx = 'Nacional: 1050 casos en la próxima semana.';
  const { texto, retiradas } = depuraCifras('Se esperan 1,050 casos. Eso es 37 % más que en 2025. Fuente [1].', ctx);
  assert.equal(texto, 'Se esperan 1,050 casos. Fuente [1].');
  assert.deepEqual(retiradas, ['37']);
  assert.equal(depuraCifras('Habrá 99,999 casos.', ctx).texto, null);
});

// La función completa con Gemini simulado: un 402 en la generación no se reintenta, y una cifra inventada no se muestra.
const raiz = new URL('../../', import.meta.url);
const INDICE = JSON.parse(readFileSync(new URL('epibot/rag_index.json', raiz), 'utf8'));
const rag = await import('../netlify/functions/rag.mjs');

async function consultar(query, { texto, status = 200, stream = false }) {
  const previa = globalThis.fetch;
  const clave = process.env.GEMINI_API_KEY;
  const gens = [];
  globalThis.fetch = async (u) => {
    const url = String(u?.url ?? u);
    if (url.includes(':embedContent')) return new Response(JSON.stringify({ embedding: { values: INDICE.vectors[0] } }), { status: 200 });
    if (url.includes('enerateContent')) {
      gens.push(url);
      if (status !== 200) return new Response(JSON.stringify({ error: { code: status, message: 'Payment Required' } }), { status, statusText: 'Payment Required' });
      return new Response(JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ text: texto }] }, finishReason: 'STOP', index: 0 }] }), { status: 200 });
    }
    throw new Error(`fetch inesperado: ${url}`);
  };
  process.env.GEMINI_API_KEY = 'clave-de-prueba';
  try {
    const res = await rag.default(new Request('http://x/.netlify/functions/rag', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-nf-client-connection-ip': `f0-${Math.random()}` },
      body: JSON.stringify({ query, stream }),
    }));
    const txt = await res.text();
    return { status: res.status, txt, gens };
  } finally {
    globalThis.fetch = previa;
    if (clave === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = clave;
  }
}

test('RAG: una cifra inventada por el modelo no llega a la persona (con y sin streaming)', async () => {
  _reiniciaProveedor();
  const q = '¿qué metodología usa el proyecto para validar sus pronósticos?';
  const inventada = 'El proyecto valida con datos reales. En total hubo 987,654 casos de algo.';
  for (const stream of [false, true]) {
    const { status, txt } = await consultar(q, { texto: inventada, stream });
    assert.equal(status, 200);
    assert.doesNotMatch(txt, /987,654|987654/);
    assert.match(txt, /valida con datos reales/);
    if (stream) {
      const ev = txt.trim().split('\n').map((l) => JSON.parse(l));
      assert.equal(ev[0].type, 'progress');
      assert.equal(ev.at(-1).type, 'done');
      assert.equal(ev.filter((e) => e.type === 'delta').length, 1, 'el texto sale de una vez, ya verificado');
    }
  }
});

test('RAG: un 402 se intenta una sola vez y apaga el proveedor; el mensaje no expone el error', async () => {
  _reiniciaProveedor();
  const q = '¿qué metodología usa el proyecto para validar sus pronósticos?';
  const a = await consultar(q, { status: 402 });
  assert.equal(a.gens.filter((u) => /gemini-3\.5-flash/.test(u)).length, 0, 'no reintenta con el segundo modelo');
  assert.doesNotMatch(a.txt, /402|Payment|Gemini/);
  const b = await consultar(q, { status: 402 });
  assert.equal(b.gens.length, 0, 'con el interruptor abierto no vuelve a llamar al proveedor');
  _reiniciaProveedor();
});

test('RAG: el registro no guarda el texto de la consulta', () => {
  const fuente = readFileSync(new URL('../netlify/functions/rag.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(fuente, /q="\$\{query/);
});
